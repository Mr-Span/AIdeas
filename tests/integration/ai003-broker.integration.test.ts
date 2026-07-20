import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CLARIFICATION_IDS } from "../../src/domain/intake-questions";
import { ExecutionBroker } from "../../src/server/execution/broker";
import type {
  ExecutionEvent,
  ExecutionProvider,
  ExecutionResume,
  ExecutionStart,
} from "../../src/server/execution/contracts";
import { WorkspaceSupervisor } from "../../src/server/execution/workspace-supervisor";
import { createTestFixture } from "../helpers/ai002-fixtures";
import { createAI003WorkspaceFixture } from "../helpers/ai003-fixtures";

const providerRunId = "00000000-0000-4000-8000-000000000088";

function readyProvider(events?: (input: ExecutionStart) => ExecutionEvent[]): ExecutionProvider {
  return {
    async preflight() {
      return {
        provider: "codex",
        status: "ready",
        version: "codex-cli fixture",
        authMode: "chatgpt",
        detail: "Synthetic ready state.",
      };
    },
    async *start(input) {
      for (const event of
        events?.(input) ?? [
          { type: "started", runId: input.runId, providerRunId },
          {
            type: "message",
            runId: input.runId,
            text: "Synthetic research result",
            truncated: false,
          },
          {
            type: "completed",
            runId: input.runId,
            providerRunId,
            resultText: "# Synthetic research result\n\nEvidence-backed output.",
            resultDigest: createHash("sha256")
              .update("# Synthetic research result\n\nEvidence-backed output.")
              .digest("hex"),
            truncated: false,
          },
        ]) {
        yield event;
      }
    },
    async *resume(input: ExecutionResume) {
      yield {
        type: "started",
        runId: input.runId,
        providerRunId: input.providerRunId,
      };
    },
    async cancel(runId) {
      return { runId, accepted: false, status: "unknown" };
    },
    async inspect(runId) {
      return {
        runId,
        providerRunId: null,
        status: "unknown",
        startedAt: null,
        completedAt: null,
        errorCode: null,
      };
    },
  };
}

function submittedProject(service: ReturnType<typeof createTestFixture>["service"]) {
  const created = service.createProject({
    displayName: "Synthetic research project",
    idempotencyKey: `create-${randomUUID()}`,
  });
  const clarifications = Object.fromEntries(
    CLARIFICATION_IDS.map((id) => [id, `Synthetic answer for ${id}`]),
  );
  const saved = service.saveDraft({
    projectId: created.project.id,
    expectedVersion: 0,
    idempotencyKey: `save-${randomUUID()}`,
    actorKind: "operator",
    idea: "Synthetic product idea",
    clarifications,
    notes: "Synthetic notes",
    approvalRequired: true,
  });
  return service.submitProject({
    projectId: created.project.id,
    expectedVersion: saved.version,
    idempotencyKey: `submit-${randomUUID()}`,
    actorKind: "operator",
  }).project;
}

async function waitForTerminal(broker: ExecutionBroker, projectId: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = await broker.getResearchState(projectId);
    if (!state.activeRun) return state;
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 10));
  }
  throw new Error("Broker did not reach a terminal state.");
}

describe("AI003 durable execution broker", () => {
  it("stores safe events and the completed result in ArtifactStore", async () => {
    const fixture = createTestFixture();
    const source = createAI003WorkspaceFixture();
    const workspaceRoot = mkdtempSync(join(tmpdir(), "aideas-broker-worktrees-"));
    const provider = readyProvider();
    const broker = new ExecutionBroker({
      store: fixture.store,
      projectService: fixture.service,
      allowedWorkspaceRoot: workspaceRoot,
      protectedWorkspacePaths: [source.workspace],
      mainRepositoryPath: source.workspace,
      providers: { codex_sdk: provider, codex_cli: provider },
      enabled: true,
    });
    try {
      const project = submittedProject(fixture.service);
      const started = await broker.startResearch({
        projectId: project.id,
        expectedVersion: project.version,
        revisionId: project.draft.revisionId!,
        idempotencyKey: `research-${randomUUID()}`,
      });
      const startedRunId = started.activeRun?.runId ?? started.latestRun?.runId;
      expect(startedRunId).toBeTruthy();
      await broker.waitForRun(startedRunId!);
      const state = await waitForTerminal(broker, project.id);
      expect(state.latestRun).toMatchObject({
        status: "completed",
        resultText: expect.stringContaining("Synthetic research result"),
      });
      const runId = state.latestRun!.runId;
      const run = fixture.store.database
        .prepare(
          "SELECT output_artifact_digest FROM execution_runs WHERE id = ?",
        )
        .get(runId) as { output_artifact_digest: string };
      const artifact = fixture.store.database
        .prepare("SELECT storage_key FROM artifacts WHERE digest = ?")
        .get(run.output_artifact_digest) as { storage_key: string };
      expect(fixture.store.artifacts.exists(artifact.storage_key)).toBe(true);
      const serializedEvents = JSON.stringify(
        fixture.store.database
          .prepare("SELECT payload_json FROM execution_events WHERE run_id = ?")
          .all(runId),
      );
      const terminal = JSON.stringify(
        fixture.store.database
          .prepare(
            "SELECT payload_json FROM execution_terminal_receipts WHERE run_id = ?",
          )
          .get(runId),
      );
      expect(serializedEvents).not.toContain("Evidence-backed output");
      expect(terminal).not.toContain("Evidence-backed output");
    } finally {
      fixture.cleanup();
      source.cleanup();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("inspects interrupted runs and proposes explicit resume after restart", async () => {
    const fixture = createTestFixture();
    const source = createAI003WorkspaceFixture();
    const workspaceRoot = mkdtempSync(join(tmpdir(), "aideas-reconcile-worktrees-"));
    const supervisor = new WorkspaceSupervisor({
      sourceRepository: source.workspace,
      workspaceRoot,
    });
    const project = submittedProject(fixture.service);
    const runId = randomUUID();
    const workspace = await supervisor.create({
      runId,
      contextMarkdown: "# Interrupted synthetic context\n",
    });
    const prompt = fixture.store.artifacts.put({
      bytes: new TextEncoder().encode("Synthetic prompt"),
      displayName: "research-context.md",
      mediaType: "text/markdown",
    });
    const now = new Date().toISOString();
    fixture.store.database
      .prepare(
        `INSERT INTO artifacts(digest, media_type, byte_length, display_name, storage_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        prompt.digest,
        prompt.mediaType,
        prompt.byteLength,
        prompt.displayName,
        prompt.storageKey,
        now,
      );
    fixture.store.database
      .prepare(
        `INSERT INTO execution_runs(
          id, project_id, revision_id, provider_kind, purpose, workspace_path,
          prompt_artifact_digest, status, provider_run_id, provider_pid, created_at,
          last_event_at, updated_at
        ) VALUES (?, ?, ?, 'codex_cli', 'research', ?, ?, 'running', ?, 4242, ?, ?, ?)`,
      )
      .run(
        runId,
        project.id,
        project.draft.revisionId,
        workspace.path,
        prompt.digest,
        providerRunId,
        now,
        now,
        now,
      );
    let resumeCount = 0;
    const provider = {
      ...readyProvider(),
      async *resume(input: ExecutionResume) {
        resumeCount += 1;
        yield {
          type: "started" as const,
          runId: input.runId,
          providerRunId: input.providerRunId,
        };
        yield {
          type: "completed" as const,
          runId: input.runId,
          providerRunId: input.providerRunId,
          resultText: "# Resumed synthetic result",
          resultDigest: createHash("sha256")
            .update("# Resumed synthetic result")
            .digest("hex"),
          truncated: false,
        };
      },
    } satisfies ExecutionProvider;
    const broker = new ExecutionBroker({
      store: fixture.store,
      projectService: fixture.service,
      allowedWorkspaceRoot: workspaceRoot,
      protectedWorkspacePaths: [source.workspace],
      mainRepositoryPath: source.workspace,
      workspaceSupervisor: supervisor,
      providers: { codex_sdk: provider, codex_cli: provider },
      staleProcessReaper: async () => "missing",
      enabled: true,
    });
    try {
      const state = await broker.getResearchState(project.id);
      expect(state.latestRun).toMatchObject({
        runId,
        status: "resume_available",
        canResume: true,
      });
      expect(
        fixture.store.database
          .prepare(
            "SELECT terminal_type FROM execution_terminal_receipts WHERE run_id = ?",
          )
          .get(runId),
      ).toMatchObject({ terminal_type: "resume_available" });
      const idempotencyKey = `resume-${randomUUID()}`;
      const [first, replay] = await Promise.all([
        broker.resumeResearch(project.id, runId, idempotencyKey),
        broker.resumeResearch(project.id, runId, idempotencyKey),
      ]);
      expect(first.latestRun?.runId).toBe(runId);
      expect(replay.latestRun?.runId).toBe(runId);
      expect(resumeCount).toBe(1);
      await broker.waitForRun(runId);
      const terminalReplay = await broker.resumeResearch(
        project.id,
        runId,
        idempotencyKey,
      );
      expect(terminalReplay.latestRun).toMatchObject({
        runId,
        status: "completed",
      });
      expect(resumeCount).toBe(1);
    } finally {
      await supervisor.remove(workspace.path).catch(() => undefined);
      fixture.cleanup();
      source.cleanup();
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
