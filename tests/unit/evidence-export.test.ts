import { describe, expect, it } from "vitest";

import {
  evidenceExportSchema,
  evidenceExportToMarkdown,
  sanitizeEvidenceReceipt,
} from "../../src/server/evidence/evidence-export-service";

describe("EvidenceBundle safe export", () => {
  it("redacts credentials and local paths from verification receipts", () => {
    const receipt = [
      "OPENAI_API_KEY=super-secret-value",
      "Bearer abcdefghijklmnop",
      "C:\\Users\\claux\\Documents\\AIdeas\\src\\app.ts",
      "/tmp/aideas-execution/run-1/output.log",
      "/opt/aideas/private/output.log",
    ].join("\n");

    const safe = sanitizeEvidenceReceipt(receipt, ["super-secret-value"]);

    expect(safe).not.toContain("super-secret-value");
    expect(safe).not.toContain("abcdefghijklmnop");
    expect(safe).not.toContain("claux");
    expect(safe).not.toContain("/tmp/");
    expect(safe).toContain("[REDACTED]");
    expect(safe).not.toContain("/opt/");
    expect(safe.match(/\[LOCAL_PATH\]/gu)).toHaveLength(3);
  });

  it("renders a portable Markdown receipt from the public-safe schema", () => {
    const value = evidenceExportSchema.parse({
      schemaVersion: "aideas-evidence-export-v1",
      exportedAt: "2026-07-20T15:00:00.000Z",
      evidenceDigest: "a".repeat(64),
      task: { id: "00000000-0000-4000-8000-000000000001", canonicalKey: "TASK-EXPORT", title: "Export evidence", status: "verified" },
      trace: {
        evidenceId: "00000000-0000-4000-8000-000000000002",
        projectId: "00000000-0000-4000-8000-000000000003",
        workItemId: "00000000-0000-4000-8000-000000000001",
        revisionId: "00000000-0000-4000-8000-000000000004",
        planId: "00000000-0000-4000-8000-000000000005",
        planDigest: "b".repeat(64), policyVersion: "aideas-policy-v1", createdAt: "2026-07-20T14:00:00.000Z",
      },
      git: { baseCommit: "c".repeat(40), currentBaseCommit: "c".repeat(40), commitDigest: "d".repeat(40), diffDigest: "e".repeat(64) },
      security: { secretScanPassed: true },
      checks: [{ kind: "test", status: "passed", receipt: "68 teste trecute | <script>fără regresii</script>" }],
    });

    const markdown = evidenceExportToMarkdown(value);

    expect(markdown).toContain("# EvidenceBundle · TASK-EXPORT");
    expect(markdown).toContain("| test | passed | 68 teste trecute \\| &lt;script&gt;fără regresii&lt;/script&gt; |");
    expect(markdown).not.toContain("<script>");
    expect(markdown).toContain("nu include diff-ul brut");
  });
});
