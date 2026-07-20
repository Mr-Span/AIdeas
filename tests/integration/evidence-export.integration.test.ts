import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CLARIFICATION_IDS } from "../../src/domain/intake-questions";
import { EvidenceExportService, evidenceExportSchema } from "../../src/server/evidence/evidence-export-service";
import { POLICY_VERSION, evidenceBundleSchema } from "../../src/server/policy/contracts";
import { createTestFixture } from "../helpers/ai002-fixtures";

describe("EvidenceBundle export service", () => {
  it("exports the latest verified bundle as safe JSON and Markdown", () => {
    const fixture = createTestFixture({ idFactory: randomUUID });
    try {
      const created = fixture.service.createProject({ displayName: "Evidence export", idempotencyKey: `create-${randomUUID()}` });
      const saved = fixture.service.saveDraft({
        projectId: created.project.id, expectedVersion: 0, idempotencyKey: `save-${randomUUID()}`, actorKind: "operator",
        idea: "Export EvidenceBundle", clarifications: Object.fromEntries(CLARIFICATION_IDS.map((id) => [id, `Răspuns ${id}`])), notes: "fixture", approvalRequired: false,
      });
      const project = fixture.service.submitProject({ projectId: created.project.id, expectedVersion: saved.version, idempotencyKey: `submit-${randomUUID()}`, actorKind: "operator" }).project;
      const revisionId = project.draft.revisionId!;
      const roundId = randomUUID();
      const planId = randomUUID();
      const workItemId = randomUUID();
      const evidenceId = randomUUID();
      const now = "2026-07-20T14:00:00.000Z";
      const planDigest = "a".repeat(64);
      const task = {
        id: "TASK-EXPORT", title: "Export evidence", objective: "Exportă bundle-ul verificat.", ownerProfile: "backend", priority: "P1",
        requirementIds: ["REQ-EXPORT"], riskIds: [], acceptanceIds: ["AC-EXPORT"], componentIds: ["CMP-EVIDENCE"], dependsOn: [],
        fileScopes: ["src/server/evidence"], sharedOwnershipRationale: null, contextRefs: ["plan"], verificationCommands: ["test"],
        evidenceRequired: ["diff", "checks", "independent_review", "secret_scan"], stopRules: ["Nu expune secrete."], effort: "minute",
      };
      fixture.store.database.prepare("INSERT INTO research_rounds(id, project_id, revision_id, status, result_json, responses_json, approved_revision_id, created_at, completed_at, updated_at) VALUES (?, ?, ?, 'approved', '{}', '{}', ?, ?, ?, ?)")
        .run(roundId, project.id, revisionId, revisionId, now, now, now);
      fixture.store.database.prepare(
        `INSERT INTO implementation_plans(id, project_id, revision_id, research_round_id, status, provider_kind, plan_json, validation_json, plan_digest, base_commit, policy_version, approved_at, created_at, completed_at, updated_at)
         VALUES (?, ?, ?, ?, 'approved', 'codex_cli', '{}', '[]', ?, ?, ?, ?, ?, ?, ?)`,
      ).run(planId, project.id, revisionId, roundId, planDigest, "b".repeat(40), POLICY_VERSION, now, now, now, now);
      fixture.store.database.prepare("INSERT INTO work_items(id, plan_id, project_id, canonical_key, title, packet_json, status, created_at, updated_at) VALUES (?, ?, ?, 'TASK-EXPORT', 'Export evidence', ?, 'verified', ?, ?)")
        .run(workItemId, planId, project.id, JSON.stringify(task), now, now);
      const evidence = evidenceBundleSchema.parse({
        id: evidenceId, projectId: project.id, workItemId, revisionId, planId, planDigest, policyVersion: POLICY_VERSION,
        baseCommit: "b".repeat(40), currentBaseCommit: "b".repeat(40), diffDigest: "c".repeat(64), commitDigest: "d".repeat(40),
        secretScanPassed: true,
        checks: [{ kind: "test", status: "passed", receipt: "Passed at C:\\Users\\owner\\AIdeas; OPENAI_API_KEY=private-value" }],
        createdAt: now,
      });
      fixture.store.database.prepare(
        `INSERT INTO evidence_bundles(id, project_id, work_item_id, plan_id, revision_id, plan_digest, policy_version, base_commit, current_base_commit, diff_digest, commit_digest, bundle_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(evidence.id, evidence.projectId, evidence.workItemId, evidence.planId, evidence.revisionId, evidence.planDigest, evidence.policyVersion, evidence.baseCommit, evidence.currentBaseCommit, evidence.diffDigest, evidence.commitDigest, JSON.stringify(evidence), now);

      const service = new EvidenceExportService(fixture.store, () => new Date("2026-07-20T15:00:00.000Z"));
      const jsonArtifact = service.export(project.id, workItemId, "json");
      const parsed = evidenceExportSchema.parse(JSON.parse(jsonArtifact.body));
      const markdownArtifact = service.export(project.id, workItemId, "markdown");

      expect(jsonArtifact).toMatchObject({ contentType: "application/json; charset=utf-8", filename: "aideas-task-export-evidence.json" });
      expect(parsed).toMatchObject({ exportedAt: "2026-07-20T15:00:00.000Z", task: { canonicalKey: "TASK-EXPORT", status: "verified" }, security: { secretScanPassed: true } });
      expect(jsonArtifact.body).not.toContain("C:\\Users");
      expect(jsonArtifact.body).not.toContain("private-value");
      expect(markdownArtifact.filename).toBe("aideas-task-export-evidence.md");
      expect(markdownArtifact.body).toContain("# EvidenceBundle · TASK-EXPORT");
      expect(markdownArtifact.body).toContain("[LOCAL_PATH]");
    } finally {
      fixture.cleanup();
    }
  });
});
