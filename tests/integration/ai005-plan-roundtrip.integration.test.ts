import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CLARIFICATION_IDS } from "../../src/domain/intake-questions";
import type { ImplementationPlan } from "../../src/server/planning/contracts";
import { PlanService } from "../../src/server/planning/plan-service";
import type { ExecutionProvider, ExecutionStart } from "../../src/server/execution/contracts";
import { createTestFixture } from "../helpers/ai002-fixtures";
import { createAI003WorkspaceFixture } from "../helpers/ai003-fixtures";

const plan: ImplementationPlan = {
  title: "AIdeas vertical slice", summary: "Plan final sintetic.", benefits: ["Trasabilitate completă."], limitations: ["Un operator."], assumptions: [],
  requirements: [{ id: "REQ-PLAN", title: "Plan", statement: "Planul este aprobat prin digest.", sourceRefs: ["revision:approved"] }],
  acceptanceCriteria: [{ id: "AC-PLAN", requirementIds: ["REQ-PLAN"], statement: "Aprobarea materializează taskuri.", verification: "Integrare SQLite." }],
  components: [
    { id: "CMP-PLAN", name: "Planner", responsibility: "Produce plan tipizat.", sourceOfTruth: "implementation_plans", interfaces: ["PlanService"], securityBoundary: "operator-only" },
    { id: "CMP-POLICY", name: "Policy", responsibility: "Evaluează evidence.", sourceOfTruth: "policy version", interfaces: ["EvidenceBundle"], securityBoundary: "server-owned" },
  ],
  architectureEdges: [{ from: "CMP-PLAN", to: "CMP-POLICY", relationship: "approved digest" }],
  risks: [{ id: "RISK-STALE", title: "Stale digest", impact: "high", mitigation: "Digest și policy version." }], blockers: [],
  tasks: [
    { id: "TASK-PLAN", title: "Persist plan", objective: "Salvează planul.", ownerProfile: "backend", priority: "P1", requirementIds: ["REQ-PLAN"], riskIds: ["RISK-STALE"], acceptanceIds: ["AC-PLAN"], componentIds: ["CMP-PLAN"], dependsOn: [], fileScopes: ["src/server/planning"], sharedOwnershipRationale: null, contextRefs: ["revision:approved"], verificationCommands: ["test"], evidenceRequired: ["diff", "checks", "independent_review", "secret_scan"], stopRules: ["Oprește la digest stale."], effort: "1 zi" },
    { id: "TASK-POLICY", title: "Gate policy", objective: "Blochează side effects.", ownerProfile: "security", priority: "P1", requirementIds: ["REQ-PLAN"], riskIds: ["RISK-STALE"], acceptanceIds: ["AC-PLAN"], componentIds: ["CMP-POLICY"], dependsOn: ["TASK-PLAN"], fileScopes: ["src/server/policy"], sharedOwnershipRationale: null, contextRefs: ["plan:digest"], verificationCommands: ["test", "security"], evidenceRequired: ["diff", "checks", "independent_review", "secret_scan"], stopRules: ["Oprește fără evidence."], effort: "1 zi" },
  ],
  clientSteps: [{ taskIds: ["TASK-PLAN", "TASK-POLICY"], title: "Plan și control", summary: "Planul este pregătit pentru execuție sigură." }],
};

function provider(inputs: ExecutionStart[]): ExecutionProvider {
  return {
    async preflight() { return { provider: "codex", status: "ready", version: "fixture", authMode: "chatgpt", detail: "ready" }; },
    async *start(input) {
      inputs.push(input);
      yield { type: "started" as const, runId: input.runId, providerRunId: input.runId };
      const resultText = JSON.stringify(plan);
      yield { type: "completed" as const, runId: input.runId, providerRunId: input.runId, resultText, resultDigest: createHash("sha256").update(resultText).digest("hex"), truncated: false };
    },
    async *resume() { throw new Error("not used"); },
    async cancel(runId) { return { runId, accepted: false, status: "unknown" }; },
    async inspect(runId) { return { runId, providerRunId: null, status: "unknown", startedAt: null, completedAt: null, errorCode: null }; },
  };
}

describe("AI005 plan round trip", () => {
  it("generates, validates, approves, and materializes the dependency DAG", async () => {
    const fixture = createTestFixture();
    const source = createAI003WorkspaceFixture();
    const workspaceRoot = mkdtempSync(join(tmpdir(), "aideas-ai005-worktrees-"));
    const inputs: ExecutionStart[] = [];
    const fake = provider(inputs);
    try {
      const created = fixture.service.createProject({ displayName: "AI-005 synthetic", idempotencyKey: `create-${randomUUID()}` });
      const saved = fixture.service.saveDraft({
        projectId: created.project.id, expectedVersion: 0, idempotencyKey: `save-${randomUUID()}`, actorKind: "operator",
        idea: "Construiește un plan sigur.", clarifications: Object.fromEntries(CLARIFICATION_IDS.map((id) => [id, `Răspuns ${id}`])),
        notes: "Sintetic", approvalRequired: false,
      });
      const submitted = fixture.service.submitProject({ projectId: created.project.id, expectedVersion: saved.version, idempotencyKey: `submit-${randomUUID()}`, actorKind: "operator" }).project;
      const roundId = randomUUID();
      const now = new Date().toISOString();
      fixture.store.database.prepare(
        `INSERT INTO research_rounds(id, project_id, revision_id, status, result_json, responses_json, approved_revision_id, created_at, completed_at, updated_at)
         VALUES (?, ?, ?, 'approved', '{}', '{}', ?, ?, ?, ?)`,
      ).run(roundId, submitted.id, submitted.draft.revisionId, submitted.draft.revisionId, now, now, now);
      const service = new PlanService({
        store: fixture.store, projectService: fixture.service, allowedWorkspaceRoot: workspaceRoot,
        protectedWorkspacePaths: [source.workspace], mainRepositoryPath: source.workspace,
        defaultProviderKind: "codex_cli", providers: { codex_cli: fake, codex_sdk: fake }, enabled: true,
      });
      const started = await service.start({ projectId: submitted.id, expectedVersion: submitted.version, revisionId: submitted.draft.revisionId!, idempotencyKey: `plan-${randomUUID()}` });
      await service.waitForPlan(started.latestPlan!.id);
      const waiting = service.getState(submitted.id).latestPlan!;
      expect(waiting.status).toBe("waiting_operator");
      expect(waiting.validation).toEqual([]);
      expect(waiting.digest).toMatch(/^[a-f0-9]{64}$/);
      expect(inputs[0].capabilityGrant).toMatchObject({ sandboxMode: "read-only", networkAccess: false, webSearch: "disabled" });
      expect(inputs[0].prompt).toContain("date neîncrezute");
      service.approve({ projectId: submitted.id, planId: waiting.id, expectedVersion: submitted.version, planDigest: waiting.digest!, policyVersion: waiting.policyVersion, idempotencyKey: `approve-${randomUUID()}` });
      expect(service.getState(submitted.id).latestPlan?.status).toBe("approved");
      const workItems = fixture.store.database.prepare("SELECT canonical_key, status FROM work_items WHERE plan_id = ? ORDER BY canonical_key").all(waiting.id) as Array<Record<string, unknown>>;
      expect(workItems).toEqual([
        expect.objectContaining({ canonical_key: "TASK-PLAN", status: "ready" }),
        expect.objectContaining({ canonical_key: "TASK-POLICY", status: "queued" }),
      ]);
      expect(fixture.store.database.prepare("SELECT COUNT(*) AS count FROM work_item_dependencies").get()).toMatchObject({ count: 1 });
      expect(fixture.service.getClientProjection(submitted.id).plan.steps[3].status).toBe("verified");
    } finally {
      fixture.cleanup(); source.cleanup(); rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
