import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { CLARIFICATION_IDS } from "../../src/domain/intake-questions";
import type { ImplementationTask } from "../../src/server/planning/contracts";
import type { ExecutionProvider, ExecutionStart } from "../../src/server/execution/contracts";
import { WorkExecutor } from "../../src/server/work/work-executor";
import { ActionPolicyService } from "../../src/server/policy/action-service";
import { IntegrationService } from "../../src/server/integration/integration-service";
import type { GitHubAdapter } from "../../src/server/integration/github-adapter";
import { createTestFixture } from "../helpers/ai002-fixtures";
import { createAI003WorkspaceFixture } from "../helpers/ai003-fixtures";

function fakeProvider(inputs: ExecutionStart[], unsafe = false): ExecutionProvider {
  return {
    async preflight() { return { provider: "codex", status: "ready", version: "fixture", authMode: "chatgpt", detail: "ready" }; },
    async *start(input) {
      inputs.push(input);
      yield { type: "started" as const, runId: input.runId, providerRunId: input.runId };
      const resultText = input.capabilityGrant.sandboxMode === "workspace-write"
        ? "Implemented synthetic task."
        : JSON.stringify({ approved: true, summary: "Diff-ul respectă packetul.", findings: [] });
      if (input.capabilityGrant.sandboxMode === "workspace-write") {
        appendFileSync(join(input.workspacePath, "README.md"), unsafe ? "\nAPI_KEY=\"supersecret123\"\n" : "\nVerified AI-005 change.\n", "utf8");
      }
      yield { type: "completed" as const, runId: input.runId, providerRunId: input.runId, resultText, resultDigest: createHash("sha256").update(resultText).digest("hex"), truncated: false };
    },
    async *resume() { throw new Error("not used"); },
    async cancel(runId) { return { runId, accepted: false, status: "unknown" }; },
    async inspect(runId) { return { runId, providerRunId: null, status: "unknown", startedAt: null, completedAt: null, errorCode: null }; },
  };
}

function setupWorkItem(unsafe = false) {
  const fixture = createTestFixture({ idFactory: randomUUID });
  const source = createAI003WorkspaceFixture();
  const workspaceRoot = mkdtempSync(join(tmpdir(), "aideas-ai005-executor-"));
  const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source.workspace, encoding: "utf8" }).trim();
  const created = fixture.service.createProject({ displayName: "AI-005 executor", idempotencyKey: `create-${randomUUID()}` });
  const saved = fixture.service.saveDraft({
    projectId: created.project.id, expectedVersion: 0, idempotencyKey: `save-${randomUUID()}`, actorKind: "operator", idea: "Task sintetic",
    clarifications: Object.fromEntries(CLARIFICATION_IDS.map((id) => [id, `Răspuns ${id}`])), notes: "Sintetic", approvalRequired: false,
  });
  const project = fixture.service.submitProject({ projectId: created.project.id, expectedVersion: saved.version, idempotencyKey: `submit-${randomUUID()}`, actorKind: "operator" }).project;
  const revisionId = project.draft.revisionId!;
  const roundId = randomUUID();
  const planId = randomUUID();
  const workItemId = randomUUID();
  const now = new Date().toISOString();
  const planDigest = "a".repeat(64);
  const task: ImplementationTask = {
    id: "TASK-README", title: "Update README", objective: "Adaugă dovada verticalei.", ownerProfile: "worker", priority: "P1",
    requirementIds: ["REQ-README"], riskIds: [], acceptanceIds: ["AC-README"], componentIds: ["CMP-README"], dependsOn: [],
    fileScopes: ["README.md"], sharedOwnershipRationale: null, contextRefs: ["revision:synthetic"], verificationCommands: ["test", "security"],
    evidenceRequired: ["diff", "checks", "independent_review", "secret_scan"], stopRules: ["Nu modifica alte fișiere."], effort: "minute",
  };
  fixture.store.database.prepare("INSERT INTO research_rounds(id, project_id, revision_id, status, result_json, responses_json, approved_revision_id, created_at, completed_at, updated_at) VALUES (?, ?, ?, 'approved', '{}', '{}', ?, ?, ?, ?)")
    .run(roundId, project.id, revisionId, revisionId, now, now, now);
  fixture.store.database.prepare(
    `INSERT INTO implementation_plans(id, project_id, revision_id, research_round_id, status, provider_kind, plan_json, validation_json, plan_digest, base_commit, policy_version, approved_at, created_at, completed_at, updated_at)
     VALUES (?, ?, ?, ?, 'approved', 'codex_cli', '{}', '[]', ?, ?, 'aideas-policy-v1', ?, ?, ?, ?)`,
  ).run(planId, project.id, revisionId, roundId, planDigest, baseCommit, now, now, now, now);
  fixture.store.database.prepare("INSERT INTO plan_approvals(plan_id, project_id, revision_id, plan_digest, policy_version, actor_kind, approved_at) VALUES (?, ?, ?, ?, 'aideas-policy-v1', 'operator', ?)")
    .run(planId, project.id, revisionId, planDigest, now);
  fixture.store.database.prepare("INSERT INTO work_items(id, plan_id, project_id, canonical_key, title, packet_json, status, created_at, updated_at) VALUES (?, ?, ?, 'TASK-README', 'Update README', ?, 'ready', ?, ?)")
    .run(workItemId, planId, project.id, JSON.stringify(task), now, now);
  const inputs: ExecutionStart[] = [];
  const provider = fakeProvider(inputs, unsafe);
  const executor = new WorkExecutor({
    store: fixture.store, allowedWorkspaceRoot: workspaceRoot, protectedWorkspacePaths: [source.workspace], mainRepositoryPath: source.workspace,
    defaultProviderKind: "codex_cli", providers: { codex_cli: provider, codex_sdk: provider }, enabled: true,
    runVerification: async (_path, kind) => ({ kind, status: "passed", receipt: `${kind} synthetic pass` }),
  });
  return { fixture, source, workspaceRoot, project, workItemId, executor, inputs, baseCommit };
}

describe("AI005 isolated work execution", () => {
  it("writes in a worktree, verifies independently, commits, and persists evidence", async () => {
    const setup = setupWorkItem();
    try {
      const started = await setup.executor.start({ projectId: setup.project.id, workItemId: setup.workItemId, idempotencyKey: `execute-${randomUUID()}` });
      const attemptId = started.workItems[0].latestAttempt!.id;
      await setup.executor.waitForAttempt(attemptId);
      const completed = setup.executor.getState(setup.project.id).workItems[0];
      expect(completed.status, completed.latestAttempt?.errorDetail ?? "").toBe("verified");
      expect(completed.evidence).toMatchObject({ baseCommit: setup.baseCommit, currentBaseCommit: setup.baseCommit, secretScanPassed: true });
      expect(completed.evidence?.checks.map((check) => check.kind)).toEqual(expect.arrayContaining(["test", "security", "independent_review"]));
      expect(setup.inputs).toHaveLength(2);
      expect(setup.inputs[0].capabilityGrant.sandboxMode).toBe("workspace-write");
      expect(setup.inputs[1].capabilityGrant.sandboxMode).toBe("read-only");
      expect(execFileSync("git", ["status", "--short"], { cwd: setup.source.workspace, encoding: "utf8" })).toBe("");
      expect(execFileSync("git", ["rev-parse", "aideas/task-readme"], { cwd: setup.source.workspace, encoding: "utf8" }).trim()).toBe(completed.evidence?.commitDigest);
      const policy = new ActionPolicyService(setup.fixture.store);
      expect(policy.evaluate({ projectId: setup.project.id, workItemId: setup.workItemId, actionKind: "merge", target: "main" }).allowed).toBe(true);
      expect(policy.evaluate({ projectId: setup.project.id, workItemId: setup.workItemId, actionKind: "deploy", target: "production" }).allowed).toBe(false);
      expect(policy.approve({ projectId: setup.project.id, workItemId: setup.workItemId, actionKind: "deploy", target: "production" })).toMatchObject({ allowed: true, requiresApproval: true });
      const calls: string[] = [];
      const github: GitHubAdapter = {
        async preflight() { calls.push("preflight"); },
        async repositoryInfo() { return { nameWithOwner: "fixture/aideas", defaultBranch: "main" }; },
        async push(branch, commit) { calls.push(`push:${branch}:${commit}`); },
        async ensurePullRequest() { calls.push("pr"); return { url: "https://github.example/pr/1", state: "OPEN", mergeCommit: null }; },
        async mergePullRequest() { calls.push("merge"); return { url: "https://github.example/pr/1", state: "MERGED", mergeCommit: "e".repeat(40) }; },
      };
      const integration = new IntegrationService(setup.fixture.store, policy, github);
      const integrating = await integration.start({ projectId: setup.project.id, workItemId: setup.workItemId });
      await integration.waitForRun(integrating!.id);
      expect(integration.getState(setup.project.id, setup.workItemId)).toMatchObject({ status: "integrated", mergeCommit: "e".repeat(40) });
      expect(calls).toEqual(expect.arrayContaining(["preflight", "pr", "merge"]));
    } finally {
      setup.fixture.cleanup(); setup.source.cleanup(); rmSync(setup.workspaceRoot, { recursive: true, force: true });
    }
  });

  it("blocks a secret-shaped diff before commit", async () => {
    const setup = setupWorkItem(true);
    try {
      const started = await setup.executor.start({ projectId: setup.project.id, workItemId: setup.workItemId, idempotencyKey: `execute-${randomUUID()}` });
      await setup.executor.waitForAttempt(started.workItems[0].latestAttempt!.id);
      const blocked = setup.executor.getState(setup.project.id).workItems[0];
      expect(blocked.status).toBe("blocked");
      expect(blocked.latestAttempt?.errorDetail).toContain("Secret scan");
      expect(blocked.evidence).toBeNull();
    } finally {
      setup.fixture.cleanup(); setup.source.cleanup(); rmSync(setup.workspaceRoot, { recursive: true, force: true });
    }
  });
});
