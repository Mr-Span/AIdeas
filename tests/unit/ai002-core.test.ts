import { describe, expect, it } from "vitest";

import { ProjectService } from "../../src/server/domain/project-service";
import { DomainError } from "../../src/server/domain/errors";
import { ControlStore } from "../../src/server/storage/control-store";
import { createTestFixture } from "../helpers/ai002-fixtures";

type DbRow = Record<string, unknown>;

function assertDomainError(run: () => void, code: string) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    if (error instanceof DomainError) {
      expect(error.code).toBe(code);
      return;
    }
  }
  throw new Error(`Expected DomainError ${code}`);
}

function queryCount(service: ProjectService, query: string) {
  const row = service.store.database
    .prepare(query)
    .get() as { count: number } | undefined;
  return Number(row?.count ?? 0);
}

function hasForbiddenKeys(value: unknown, forbidden: Set<string>): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => hasForbiddenKeys(entry, forbidden));
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => forbidden.has(key) || hasForbiddenKeys(nested, forbidden),
  );
}

describe("AI-002 project service contract", () => {
  it("is idempotent on createProject and rejects idempotency conflicts", () => {
    const { service, cleanup } = createTestFixture();
    try {
      const first = service.createProject({
        displayName: "My App Idea",
        idempotencyKey: "create-project-key",
      });
      const replay = service.createProject({
        displayName: "My App Idea",
        idempotencyKey: "create-project-key",
      });

      expect(first.replayed).toBe(false);
      expect(replay.replayed).toBe(true);
      expect(replay.project.id).toBe(first.project.id);
      expect(service.diagnostics().projects).toBe(1);

      assertDomainError(
        () =>
          service.createProject({
            displayName: "Different Name",
            idempotencyKey: "create-project-key",
          }),
        "IDEMPOTENCY_CONFLICT",
      );
    } finally {
      cleanup();
    }
  });

  it("creates immutable revisions and deduplicates idempotent draft replay", () => {
    const { service, cleanup } = createTestFixture();
    try {
      const created = service.createProject({
        displayName: "Immutable Capture",
        idempotencyKey: "create-immutable",
      });
      const projectId = created.project.id;

      const firstSave = service.saveDraft({
        projectId,
        expectedVersion: 0,
        idempotencyKey: "save-first",
        actorKind: "client",
        idea: "First draft",
        notes: "Notes",
        approvalRequired: true,
      });

      const revisionCountBeforeReplay = service.diagnostics().revisions;
      const artifactCountBeforeReplay = service.diagnostics().artifacts;

      const replay = service.saveDraft({
        projectId,
        expectedVersion: 0,
        idempotencyKey: "save-first",
        actorKind: "client",
        idea: "First draft",
        notes: "Notes",
        approvalRequired: true,
      });

      expect(replay.replayed).toBe(true);
      expect(firstSave.version).toBe(1);
      expect(service.diagnostics().revisions).toBe(revisionCountBeforeReplay);
      expect(service.diagnostics().artifacts).toBe(artifactCountBeforeReplay);

      const versions = service.store.database
        .prepare(
          "SELECT version, payload_json FROM project_revisions WHERE project_id = ? ORDER BY version",
        )
        .all(projectId) as DbRow[];
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
      expect(JSON.parse(String(versions[0].payload_json))).toMatchObject({
        idea: "First draft",
      });
    } finally {
      cleanup();
    }
  });

  it("deduplicates media bytes by hash across separate revisions", () => {
    const { service, cleanup } = createTestFixture();
    try {
      const project = service.createProject({
        displayName: "Media Dedupe",
        idempotencyKey: "create-media",
      });
      const projectId = project.project.id;

      const mediaBytes = new TextEncoder().encode("shared-media-bytes");
      const first = service.saveDraft({
        projectId,
        expectedVersion: 0,
        idempotencyKey: "save-media-1",
        actorKind: "client",
        idea: "Draft with media",
        notes: "",
        approvalRequired: false,
        media: [
          {
            bytes: mediaBytes,
            displayName: "mock.png",
            mediaType: "image/png",
          },
        ],
      });

      const second = service.saveDraft({
        projectId,
        expectedVersion: 1,
        idempotencyKey: "save-media-2",
        actorKind: "client",
        idea: "Draft with same media bytes",
        notes: "",
        approvalRequired: false,
        media: [
          {
            bytes: new TextEncoder().encode("shared-media-bytes"),
            displayName: "mock.png",
            mediaType: "image/png",
          },
        ],
      });

      expect(first.version).toBe(1);
      expect(second.version).toBe(2);
      expect(first.artifactDigests[1]).toBe(second.artifactDigests[1]);
      expect(service.diagnostics().artifacts).toBe(3);
      expect(service.diagnostics().revisions).toBe(2);
      const mediaRows = service.store.database
        .prepare(
          "SELECT DISTINCT artifact_digest FROM revision_artifacts WHERE revision_id IN (SELECT id FROM project_revisions WHERE project_id = ?) AND purpose = 'media'",
        )
        .all(projectId) as DbRow[];
      expect(mediaRows).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  it("fails stale draft saves with VERSION_CONFLICT without creating extra rows", () => {
    const { service, cleanup } = createTestFixture();
    try {
      const project = service.createProject({
        displayName: "Stale Draft",
        idempotencyKey: "create-stale",
      });
      const projectId = project.project.id;

      service.saveDraft({
        projectId,
        expectedVersion: 0,
        idempotencyKey: "save-fresh",
        actorKind: "client",
        idea: "Current draft",
        notes: "",
        approvalRequired: false,
      });

      assertDomainError(
        () =>
          service.saveDraft({
            projectId,
            expectedVersion: 0,
            idempotencyKey: "save-stale",
            actorKind: "client",
            idea: "Stale draft",
            notes: "",
            approvalRequired: false,
          }),
        "VERSION_CONFLICT",
      );

      expect(service.diagnostics().revisions).toBe(1);
      expect(queryCount(service, "SELECT COUNT(*) AS count FROM revision_artifacts")).toBe(1);
      expect(queryCount(service, "SELECT COUNT(*) AS count FROM capture_events")).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("submits with intake verification and research awaiting an operator start", () => {
    const { service, cleanup } = createTestFixture();
    try {
      const project = service.createProject({
        displayName: "Submission",
        idempotencyKey: "create-submit",
      });
      const projectId = project.project.id;

      const saved = service.saveDraft({
        projectId,
        expectedVersion: 0,
        idempotencyKey: "save-submit",
        actorKind: "client",
        idea: "Submitted idea",
        notes: "Submitted notes",
        approvalRequired: false,
      });

      const submit = service.submitProject({
        projectId,
        expectedVersion: saved.version,
        idempotencyKey: "submit-ok",
        actorKind: "client",
      });

      expect(submit.providerStarted).toBe(false);
      const steps = service.store.database
        .prepare(
          "SELECT position, status, next_action, evidence_ref FROM plan_steps WHERE project_id = ? ORDER BY position",
        )
        .all(projectId) as DbRow[];

      expect(steps).toHaveLength(5);
      expect(steps[0].status).toBe("verified");
      expect(steps[0].evidence_ref).toBe(`revision:${submit.revisionId}`);
      expect(steps[1].status).toBe("not_started");
      expect(String(steps[1].next_action)).toContain("pornită");
      expect(
        service
          .getClientProjection(projectId)
          .plan.steps.filter((step) => step.status === "verified").length,
      ).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("requires evidence for verified plan steps and excludes internal projection fields", () => {
    const { service, cleanup } = createTestFixture();
    try {
      const project = service.createProject({
        displayName: "Plan Safety",
        idempotencyKey: "create-plan",
      });
      const projectId = project.project.id;

      const firstStep = service.store.database
        .prepare(
          "SELECT id FROM plan_steps WHERE project_id = ? ORDER BY position ASC LIMIT 1",
        )
        .get(projectId) as { id: string };

      assertDomainError(
        () =>
          service.updatePlanStep({
            projectId,
            stepId: firstStep.id,
            status: "verified",
          }),
        "VALIDATION_ERROR",
      );

      const projection = service.getClientProjection(projectId);
      const forbidden = new Set([
        "evidenceRef",
        "storageKey",
        "storage_key",
        "db",
        "database",
        "git",
        "provider",
        "providerStarted",
        "faur",
        "path",
      ]);

      expect(hasForbiddenKeys(projection, forbidden)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("round-trips public collaboration while hiding internal entries", () => {
    const { service, cleanup } = createTestFixture();
    try {
      const project = service.createProject({
        displayName: "Collab",
        idempotencyKey: "create-collab",
      });
      const projectId = project.project.id;

      service.appendPublicCollaboration({
        projectId,
        idempotencyKey: "public-1",
        actorKind: "client",
        entryKind: "question",
        body: "Public question",
      });
      const afterPublic = service.getClientProjection(projectId);
      expect(afterPublic.collaboration).toHaveLength(1);
      expect(afterPublic.collaboration[0]).toMatchObject({
        actorKind: "client",
        entryKind: "question",
        body: "Public question",
        attribution: "unverified-local",
      });

      service.appendInternalCollaboration({
        projectId,
        idempotencyKey: "internal-1",
        actorKind: "operator",
        entryKind: "acknowledgement",
        body: "Internal note",
      });
      const afterInternal = service.getClientProjection(projectId);
      expect(afterInternal.collaboration).toHaveLength(1);
      expect(afterInternal.collaboration[0].body).toBe("Public question");
    } finally {
      cleanup();
    }
  });

  it("reopens persisted project after control-store close", () => {
    const fixture = createTestFixture();
    try {
      const created = fixture.service.createProject({
        displayName: "Reload Project",
        idempotencyKey: "create-reload",
      });
      const projectId = created.project.id;
      fixture.service.saveDraft({
        projectId,
        expectedVersion: 0,
        idempotencyKey: "save-reload",
        actorKind: "client",
        idea: "Idea to persist",
        notes: "",
        approvalRequired: false,
      });

      fixture.store.close();
      const reopenedStore = new ControlStore({ dataRoot: fixture.root });
      const reopenedService = new ProjectService(reopenedStore);

      const reloaded = reopenedService.getClientProjection(projectId);
      expect(reloaded.version).toBe(1);
      expect(reloaded.draft.idea).toBe("Idea to persist");
      reopenedStore.close();
    } finally {
      fixture.cleanup();
    }
  });

  it("sets 30-day purge date on completion and clears it on reopen", () => {
    const anchor = new Date("2026-01-01T00:00:00.000Z");
    const { service, cleanup } = createTestFixture({
      clock: () => anchor,
    });
    try {
      const created = service.createProject({
        displayName: "Lifecycle",
        idempotencyKey: "create-lifecycle",
      });
      const projectId = created.project.id;
      service.saveDraft({
        projectId,
        expectedVersion: 0,
        idempotencyKey: "save-lifecycle",
        actorKind: "client",
        idea: "Closing draft",
        notes: "",
        approvalRequired: false,
      });

      const completed = service.completeProject({
        projectId,
        idempotencyKey: "complete-1",
      });
      expect(completed.lifecycleState).toBe("completed");
      expect(completed.completedAt).toBe(anchor.toISOString());
      expect(completed.purgeAfter).toBe(
        new Date(anchor.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      );

      const reopened = service.reopenProject({
        projectId,
        idempotencyKey: "reopen-1",
      });
      expect(reopened.lifecycleState).toBe("active");
      expect(reopened.purgeAfter).toBeNull();
    } finally {
      cleanup();
    }
  });
});
