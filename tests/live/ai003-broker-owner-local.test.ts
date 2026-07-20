import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CLARIFICATION_IDS } from "../../src/domain/intake-questions";
import { ExecutionBroker } from "../../src/server/execution/broker";
import { createTestFixture } from "../helpers/ai002-fixtures";
import { createAI003WorkspaceFixture } from "../helpers/ai003-fixtures";

describe("AI003 durable broker owner-local live path", () => {
  it("turns a submitted synthetic revision into a persisted Codex report", async () => {
    const fixture = createTestFixture();
    const source = createAI003WorkspaceFixture();
    const executionRoot = mkdtempSync(join(tmpdir(), "aideas-live-broker-"));
    const broker = new ExecutionBroker({
      store: fixture.store,
      projectService: fixture.service,
      allowedWorkspaceRoot: executionRoot,
      protectedWorkspacePaths: [source.workspace],
      mainRepositoryPath: source.workspace,
      defaultProviderKind: "codex_cli",
      enabled: true,
    });

    try {
      const created = fixture.service.createProject({
        displayName: "Synthetic AIdeas live broker",
        idempotencyKey: `create-${randomUUID()}`,
      });
      const saved = fixture.service.saveDraft({
        projectId: created.project.id,
        expectedVersion: created.project.version,
        idempotencyKey: `save-${randomUUID()}`,
        actorKind: "operator",
        idea: "A local-first intake assistant for synthetic software ideas.",
        clarifications: Object.fromEntries(
          CLARIFICATION_IDS.map((id) => [id, `Synthetic answer for ${id}.`]),
        ),
        notes: "Use only this synthetic fixture and return concise Romanian Markdown.",
        approvalRequired: true,
      });
      const submitted = fixture.service.submitProject({
        projectId: created.project.id,
        expectedVersion: saved.version,
        idempotencyKey: `submit-${randomUUID()}`,
        actorKind: "operator",
      }).project;
      const started = await broker.startResearch({
        projectId: submitted.id,
        expectedVersion: submitted.version,
        revisionId: submitted.draft.revisionId!,
        idempotencyKey: `research-${randomUUID()}`,
      });
      const runId = started.activeRun?.runId ?? started.latestRun?.runId;
      expect(runId).toBeTruthy();
      await broker.waitForRun(runId!);
      const state = await broker.getResearchState(submitted.id);
      expect(state.latestRun).toMatchObject({
        runId,
        providerKind: "codex_cli",
        status: "completed",
        resultDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      });
      expect(state.latestRun?.resultText).toContain("Rezumat executiv");
      expect(state.project.plan.steps[1]).toMatchObject({ status: "verified" });
    } finally {
      fixture.cleanup();
      source.cleanup();
      rmSync(executionRoot, { recursive: true, force: true });
    }
  }, 180_000);
});
