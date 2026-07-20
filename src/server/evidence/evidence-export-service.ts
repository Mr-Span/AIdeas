import { createHash } from "node:crypto";

import { z } from "zod";

import { DomainError } from "@/server/domain/errors";
import { createRedactor, redactAndLimit } from "@/server/execution/redaction";
import { evidenceBundleSchema } from "@/server/policy/contracts";
import type { ControlStore } from "@/server/storage/control-store";

type Row = Record<string, unknown>;

export const evidenceExportFormatSchema = z.enum(["json", "markdown"]);
export type EvidenceExportFormat = z.infer<typeof evidenceExportFormatSchema>;

const exportCheckSchema = z.object({
  kind: z.string(),
  status: z.enum(["passed", "failed"]),
  receipt: z.string(),
}).strict();

export const evidenceExportSchema = z.object({
  schemaVersion: z.literal("aideas-evidence-export-v1"),
  exportedAt: z.string().datetime(),
  evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  task: z.object({
    id: z.string().uuid(),
    canonicalKey: z.string(),
    title: z.string(),
    status: z.enum(["verified", "integrated"]),
  }).strict(),
  trace: z.object({
    evidenceId: z.string().uuid(),
    projectId: z.string().uuid(),
    workItemId: z.string().uuid(),
    revisionId: z.string().uuid(),
    planId: z.string().uuid(),
    planDigest: z.string().regex(/^[a-f0-9]{64}$/),
    policyVersion: z.string(),
    createdAt: z.string().datetime(),
  }).strict(),
  git: z.object({
    baseCommit: z.string(),
    currentBaseCommit: z.string(),
    commitDigest: z.string().nullable(),
    diffDigest: z.string(),
  }).strict(),
  security: z.object({ secretScanPassed: z.boolean() }).strict(),
  checks: z.array(exportCheckSchema),
}).strict();

export type EvidenceExport = z.infer<typeof evidenceExportSchema>;

export type EvidenceExportArtifact = {
  body: string;
  contentType: string;
  filename: string;
};

const WINDOWS_PATH = /(?:^|[\s("'])([A-Za-z]:[\\/][^\s"'<>|\r\n]+)/gmu;
const UNC_PATH = /(?:^|[\s("'])(\\\\[^\s"'<>|\r\n]+)/gmu;
const POSIX_LOCAL_PATH = /(?:^|[\s("'=])((?:\/(?!\/)[^/\s"'<>|\r\n]+){2,}\/?)/gmu;

function replaceCapturedPath(input: string, pattern: RegExp) {
  return input.replace(pattern, (match, path: string) => match.slice(0, match.length - path.length) + "[LOCAL_PATH]");
}

export function sanitizeEvidenceReceipt(input: string, sensitiveValues: readonly string[] = []) {
  const redact = createRedactor(sensitiveValues);
  const secretSafe = redactAndLimit(input.replaceAll("\r\n", "\n"), redact, 800).text;
  return replaceCapturedPath(
    replaceCapturedPath(replaceCapturedPath(secretSafe, WINDOWS_PATH), UNC_PATH),
    POSIX_LOCAL_PATH,
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function markdownText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function markdownCell(value: string) {
  return markdownText(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

export function evidenceExportToMarkdown(value: EvidenceExport) {
  const commit = value.git.commitDigest ?? "Nu există";
  return [
    `# EvidenceBundle · ${value.task.canonicalKey}`,
    "",
    `**Task:** ${markdownText(value.task.title)}`,
    `**Status:** ${value.task.status}`,
    `**Exportat:** ${value.exportedAt}`,
    `**Evidence digest:** \`${value.evidenceDigest}\``,
    "",
    "## Trasabilitate",
    "",
    `- Evidence ID: \`${value.trace.evidenceId}\``,
    `- Project ID: \`${value.trace.projectId}\``,
    `- Work item ID: \`${value.trace.workItemId}\``,
    `- Revision ID: \`${value.trace.revisionId}\``,
    `- Plan ID: \`${value.trace.planId}\``,
    `- Plan digest: \`${value.trace.planDigest}\``,
    `- Policy: \`${value.trace.policyVersion}\``,
    `- Evidence creat: ${value.trace.createdAt}`,
    "",
    "## Git și securitate",
    "",
    `- Base commit: \`${value.git.baseCommit}\``,
    `- Current base commit: \`${value.git.currentBaseCommit}\``,
    `- Commit: \`${commit}\``,
    `- Diff digest: \`${value.git.diffDigest}\``,
    `- Secret scan: **${value.security.secretScanPassed ? "passed" : "failed"}**`,
    "",
    "## Verificări",
    "",
    "| Verificare | Status | Receipt sigur |",
    "| --- | --- | --- |",
    ...value.checks.map((check) => `| ${markdownCell(check.kind)} | ${check.status} | ${markdownCell(check.receipt)} |`),
    "",
    "> Exportul nu include diff-ul brut, output provider, secrete sau căi locale. Integritatea se verifică prin digesturi.",
    "",
  ].join("\n");
}

function safeFilenamePart(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "");
  return normalized.slice(0, 64) || "task";
}

export class EvidenceExportService {
  constructor(
    private readonly store: ControlStore,
    private readonly clock: () => Date = () => new Date(),
    private readonly sensitiveValues: readonly string[] = [],
  ) {}

  get(projectId: string, workItemId: string): EvidenceExport {
    const row = this.store.database.prepare(
      `SELECT e.bundle_json, w.id AS work_item_id, w.canonical_key, w.title, w.status
       FROM evidence_bundles e
       JOIN work_items w ON w.id = e.work_item_id
       WHERE e.project_id = ? AND e.work_item_id = ?
       ORDER BY e.created_at DESC
       LIMIT 1`,
    ).get(projectId, workItemId) as Row | undefined;

    if (!row) {
      throw new DomainError("NOT_FOUND", "Taskul nu are încă un EvidenceBundle exportabil.", 404);
    }
    if (row.status !== "verified" && row.status !== "integrated") {
      throw new DomainError("VERSION_CONFLICT", "EvidenceBundle poate fi exportat numai pentru un task verificat.", 409);
    }

    const evidence = evidenceBundleSchema.parse(JSON.parse(String(row.bundle_json)));
    const originalDigest = createHash("sha256").update(stableJson(evidence), "utf8").digest("hex");
    return evidenceExportSchema.parse({
      schemaVersion: "aideas-evidence-export-v1",
      exportedAt: this.clock().toISOString(),
      evidenceDigest: originalDigest,
      task: {
        id: String(row.work_item_id),
        canonicalKey: String(row.canonical_key),
        title: String(row.title),
        status: row.status,
      },
      trace: {
        evidenceId: evidence.id,
        projectId: evidence.projectId,
        workItemId: evidence.workItemId,
        revisionId: evidence.revisionId,
        planId: evidence.planId,
        planDigest: evidence.planDigest,
        policyVersion: evidence.policyVersion,
        createdAt: evidence.createdAt,
      },
      git: {
        baseCommit: evidence.baseCommit,
        currentBaseCommit: evidence.currentBaseCommit,
        commitDigest: evidence.commitDigest,
        diffDigest: evidence.diffDigest,
      },
      security: { secretScanPassed: evidence.secretScanPassed },
      checks: evidence.checks.map((check) => ({
        ...check,
        receipt: sanitizeEvidenceReceipt(check.receipt, this.sensitiveValues),
      })),
    });
  }

  export(projectId: string, workItemId: string, format: EvidenceExportFormat): EvidenceExportArtifact {
    const value = this.get(projectId, workItemId);
    const basename = `aideas-${safeFilenamePart(value.task.canonicalKey)}-evidence`;
    if (format === "markdown") {
      return { body: evidenceExportToMarkdown(value), contentType: "text/markdown; charset=utf-8", filename: `${basename}.md` };
    }
    return { body: `${JSON.stringify(value, null, 2)}\n`, contentType: "application/json; charset=utf-8", filename: `${basename}.json` };
  }
}
