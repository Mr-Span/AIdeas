import { createHash, randomUUID } from "node:crypto";
import { TextDecoder, TextEncoder } from "node:util";

import type { StoredArtifact } from "@/server/artifacts/artifact-store";
import {
  intakeQuestions,
  normalizeClarificationAnswers,
  type ClarificationAnswers,
} from "@/domain/intake-questions";
import {
  collaborationInputSchema,
  createProjectInputSchema,
  planStepStatusSchema,
  saveDraftInputSchema,
  submitProjectInputSchema,
  type ActorKind,
  type AppendCollaborationResult,
  type ClientCollaborationEntryDto,
  type ClientPlanStepDto,
  type ClientProjectDto,
  type CollaborationInput,
  type CreateProjectInput,
  type CreateProjectResult,
  type MediaInput,
  type PlanStepStatus,
  type PlanStepUpdate,
  type ProjectLifecycle,
  type ReconciliationReport,
  type SaveDraftInput,
  type SaveDraftResult,
  type SubmitProjectInput,
  type SubmitProjectResult,
} from "@/server/domain/contracts";
import { DomainError } from "@/server/domain/errors";
import { ControlStore } from "@/server/storage/control-store";

type ProjectServiceOptions = {
  clock?: () => Date;
  idFactory?: () => string;
};

type DraftPayload = {
  idea: string;
  clarifications: ClarificationAnswers;
  notes: string;
  approvalRequired: boolean;
  submitted: boolean;
};

type ReceiptRow = {
  request_digest: string;
  response_json: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1_000;

const DEFAULT_PLAN_STEPS = [
  {
    title: "Idee și context",
    summary: "Colectăm obiectivul, publicul, constrângerile și materialele.",
    status: "in_progress" as const,
  },
  {
    title: "Cercetare și validare",
    summary: "Verificăm ipotezele și alternativele înainte de plan.",
    status: "not_started" as const,
  },
  {
    title: "Clarificări client–inginer",
    summary: "Rezolvăm întrebările și confirmăm alegerile importante.",
    status: "not_started" as const,
  },
  {
    title: "Plan tehnic",
    summary: "Publicăm arhitectura și pașii mari de implementare.",
    status: "not_started" as const,
  },
  {
    title: "Implementare și verificare",
    summary: "Executăm pașii aprobați și confirmăm rezultatele prin dovezi.",
    status: "not_started" as const,
  },
] as const;

function normalizeForJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeForJson((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(normalizeForJson(value));
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function text(row: Record<string, unknown>, key: string) {
  return String(row[key]);
}

function nullableText(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value === null || value === undefined ? null : String(value);
}

function integer(row: Record<string, unknown>, key: string) {
  return Number(row[key]);
}

function buildCaptureMarkdown(input: {
  displayName: string;
  idea: string;
  clarifications: ClarificationAnswers;
  notes: string;
  approvalRequired: boolean;
  submitted: boolean;
}) {
  const clarificationMarkdown = intakeQuestions
    .map(
      (question, index) =>
        `### ${index + 1}. ${question.title}\n\n${input.clarifications[question.id]?.trim() || "_Fără răspuns_"}`,
    )
    .join("\n\n");
  return `# ${input.displayName}\n\n## Idee\n\n${input.idea}\n\n## Clarificări\n\n${clarificationMarkdown}\n\n## Notițe\n\n${input.notes}\n\n## Control\n\n- Aprobare umană Git: ${input.approvalRequired ? "da" : "nu"}\n- Trimis pentru analiză: ${input.submitted ? "da" : "nu"}\n`;
}

export class ProjectService {
  private readonly clock: () => Date;
  private readonly idFactory: () => string;

  constructor(
    readonly store: ControlStore,
    options: ProjectServiceOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
  }

  private now() {
    return this.clock().toISOString();
  }

  private getReceipt<T>(
    scopeId: string,
    commandName: string,
    idempotencyKey: string,
    requestDigest: string,
  ): T | null {
    const row = this.store.database
      .prepare(
        `SELECT request_digest, response_json
         FROM idempotency_receipts
         WHERE scope_id = ? AND command_name = ? AND idempotency_key = ?`,
      )
      .get(scopeId, commandName, idempotencyKey) as ReceiptRow | undefined;

    if (!row) return null;
    if (row.request_digest !== requestDigest) {
      throw new DomainError(
        "IDEMPOTENCY_CONFLICT",
        "Cheia de idempotency a fost folosită pentru alte date.",
        409,
      );
    }
    return JSON.parse(row.response_json) as T;
  }

  private recordReceipt(
    scopeId: string,
    commandName: string,
    idempotencyKey: string,
    requestDigest: string,
    response: unknown,
    createdAt: string,
  ) {
    this.store.database
      .prepare(
        `INSERT INTO idempotency_receipts(
          scope_id, command_name, idempotency_key, request_digest,
          response_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        scopeId,
        commandName,
        idempotencyKey,
        requestDigest,
        JSON.stringify(response),
        createdAt,
      );
  }

  private audit(input: {
    projectId: string | null;
    actorKind: ActorKind | "system";
    eventKind: string;
    subjectId?: string;
    payload?: unknown;
    createdAt: string;
  }) {
    this.store.database
      .prepare(
        `INSERT INTO audit_events(
          id, project_id, actor_kind, event_kind, subject_id,
          payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        this.idFactory(),
        input.projectId,
        input.actorKind,
        input.eventKind,
        input.subjectId ?? null,
        stableJson(input.payload ?? {}),
        input.createdAt,
      );
  }

  private requireProject(projectId: string) {
    const row = this.store.database
      .prepare(
        `SELECT id, display_name, lifecycle_state, current_version,
                current_revision_id, completed_at, purge_after, updated_at
         FROM projects WHERE id = ?`,
      )
      .get(projectId) as Record<string, unknown> | undefined;
    if (!row) {
      throw new DomainError("NOT_FOUND", "Proiectul nu există.", 404);
    }
    return row;
  }

  private requireVersion(projectId: string, expectedVersion: number) {
    const project = this.requireProject(projectId);
    if (integer(project, "current_version") !== expectedVersion) {
      throw new DomainError(
        "VERSION_CONFLICT",
        "Proiectul a fost modificat. Reîncarcă ultima versiune.",
        409,
      );
    }
    return project;
  }

  private insertArtifact(artifact: StoredArtifact, createdAt: string) {
    this.store.database
      .prepare(
        `INSERT OR IGNORE INTO artifacts(
          digest, media_type, byte_length, display_name, storage_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        artifact.digest,
        artifact.mediaType,
        artifact.byteLength,
        artifact.displayName,
        artifact.storageKey,
        createdAt,
      );
  }

  createProject(rawInput: CreateProjectInput): CreateProjectResult {
    const input = createProjectInputSchema.parse(rawInput);
    const commandName = "create_project";
    const scopeId = "global";
    const requestDigest = sha256(stableJson(input));
    const existing = this.getReceipt<CreateProjectResult>(
      scopeId,
      commandName,
      input.idempotencyKey,
      requestDigest,
    );
    if (existing) return { ...existing, replayed: true };

    const createdAt = this.now();
    const projectId = this.idFactory();

    return this.store.transaction(() => {
      const transactionalExisting = this.getReceipt<CreateProjectResult>(
        scopeId,
        commandName,
        input.idempotencyKey,
        requestDigest,
      );
      if (transactionalExisting) {
        return { ...transactionalExisting, replayed: true };
      }

      this.store.database
        .prepare(
          `INSERT INTO projects(
            id, display_name, lifecycle_state, current_version,
            created_at, updated_at
          ) VALUES (?, ?, 'active', 0, ?, ?)`,
        )
        .run(projectId, input.displayName, createdAt, createdAt);

      const insertStep = this.store.database.prepare(
        `INSERT INTO plan_steps(
          id, project_id, position, status, client_visible, client_title,
          client_summary, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      );
      DEFAULT_PLAN_STEPS.forEach((step, position) => {
        insertStep.run(
          this.idFactory(),
          projectId,
          position,
          step.status,
          step.title,
          step.summary,
          createdAt,
        );
      });

      this.audit({
        projectId,
        actorKind: "operator",
        eventKind: "project_created",
        subjectId: projectId,
        createdAt,
      });

      const response: CreateProjectResult = {
        project: this.getClientProjection(projectId),
        replayed: false,
      };
      this.recordReceipt(
        scopeId,
        commandName,
        input.idempotencyKey,
        requestDigest,
        response,
        createdAt,
      );
      return response;
    });
  }

  saveDraft(
    rawInput: SaveDraftInput & { media?: MediaInput[] },
  ): SaveDraftResult {
    const input = saveDraftInputSchema.parse(rawInput);
    const media = rawInput.media ?? [];
    if (media.length > 10) {
      throw new DomainError(
        "PAYLOAD_TOO_LARGE",
        "Poți salva maximum 10 fișiere într-o revizie.",
        413,
      );
    }

    const mediaFingerprint = media.map((item) => ({
      digest: sha256(item.bytes),
      displayName: item.displayName,
      mediaType: item.mediaType,
      byteLength: item.bytes.byteLength,
    }));
    const requestDigest = sha256(stableJson({ input, media: mediaFingerprint }));
    const commandName = "save_draft";
    const existing = this.getReceipt<SaveDraftResult>(
      input.projectId,
      commandName,
      input.idempotencyKey,
      requestDigest,
    );
    if (existing) return { ...existing, replayed: true };

    const createdAt = this.now();
    const revisionId = this.idFactory();
    const nextVersion = input.expectedVersion + 1;
    const payload: DraftPayload = {
      idea: input.idea,
      clarifications: input.clarifications,
      notes: input.notes,
      approvalRequired: input.approvalRequired,
      submitted: false,
    };

    return this.store.transaction(() => {
      const transactionalExisting = this.getReceipt<SaveDraftResult>(
        input.projectId,
        commandName,
        input.idempotencyKey,
        requestDigest,
      );
      if (transactionalExisting) {
        return { ...transactionalExisting, replayed: true };
      }

      const project = this.requireVersion(
        input.projectId,
        input.expectedVersion,
      );
      const capture = this.store.artifacts.put({
        bytes: encoder.encode(
          buildCaptureMarkdown({
            displayName: text(project, "display_name"),
            idea: input.idea,
            clarifications: input.clarifications,
            notes: input.notes,
            approvalRequired: input.approvalRequired,
            submitted: false,
          }),
        ),
        displayName: "capture.md",
        mediaType: "text/markdown",
      });
      const storedMedia = media.map((item) => this.store.artifacts.put(item));
      [capture, ...storedMedia].forEach((artifact) =>
        this.insertArtifact(artifact, createdAt),
      );

      this.store.database
        .prepare(
          `INSERT INTO project_revisions(
            id, project_id, version, capture_artifact_digest, actor_kind,
            submitted, payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .run(
          revisionId,
          input.projectId,
          nextVersion,
          capture.digest,
          input.actorKind,
          stableJson(payload),
          createdAt,
        );

      const linkArtifact = this.store.database.prepare(
        `INSERT INTO revision_artifacts(
          revision_id, artifact_digest, purpose, position, display_name
        ) VALUES (?, ?, ?, ?, ?)`,
      );
      linkArtifact.run(revisionId, capture.digest, "capture", 0, "capture.md");
      storedMedia.forEach((artifact, index) => {
        linkArtifact.run(
          revisionId,
          artifact.digest,
          "media",
          index + 1,
          artifact.displayName,
        );
      });

      const insertCapture = this.store.database.prepare(
        `INSERT INTO capture_events(
          id, project_id, revision_id, actor_kind, event_kind,
          artifact_digest, provenance_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insertCapture.run(
        this.idFactory(),
        input.projectId,
        revisionId,
        input.actorKind,
        "draft_saved",
        capture.digest,
        stableJson({ source: "intake", displayName: "capture.md" }),
        createdAt,
      );
      storedMedia.forEach((artifact) => {
        insertCapture.run(
          this.idFactory(),
          input.projectId,
          revisionId,
          input.actorKind,
          "media_added",
          artifact.digest,
          stableJson({
            source: "upload",
            displayName: artifact.displayName,
            mediaType: artifact.mediaType,
          }),
          createdAt,
        );
      });

      this.store.database
        .prepare(
          `UPDATE projects
           SET current_version = ?, current_revision_id = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(nextVersion, revisionId, createdAt, input.projectId);

      this.audit({
        projectId: input.projectId,
        actorKind: input.actorKind,
        eventKind: "draft_saved",
        subjectId: revisionId,
        payload: { version: nextVersion, mediaCount: storedMedia.length },
        createdAt,
      });

      const response: SaveDraftResult = {
        project: this.getClientProjection(input.projectId),
        revisionId,
        version: nextVersion,
        artifactDigests: [capture, ...storedMedia].map((item) => item.digest),
        replayed: false,
      };
      this.recordReceipt(
        input.projectId,
        commandName,
        input.idempotencyKey,
        requestDigest,
        response,
        createdAt,
      );
      return response;
    });
  }

  submitProject(rawInput: SubmitProjectInput): SubmitProjectResult {
    const input = submitProjectInputSchema.parse(rawInput);
    const commandName = "submit_project";
    const requestDigest = sha256(stableJson(input));
    const existing = this.getReceipt<SubmitProjectResult>(
      input.projectId,
      commandName,
      input.idempotencyKey,
      requestDigest,
    );
    if (existing) return { ...existing, replayed: true };

    const createdAt = this.now();
    const revisionId = this.idFactory();
    const nextVersion = input.expectedVersion + 1;

    return this.store.transaction(() => {
      const transactionalExisting = this.getReceipt<SubmitProjectResult>(
        input.projectId,
        commandName,
        input.idempotencyKey,
        requestDigest,
      );
      if (transactionalExisting) {
        return { ...transactionalExisting, replayed: true };
      }

      const project = this.requireVersion(
        input.projectId,
        input.expectedVersion,
      );
      const currentRevisionId = nullableText(project, "current_revision_id");
      if (!currentRevisionId) {
        throw new DomainError(
          "VALIDATION_ERROR",
          "Salvează proiectul înainte de trimitere.",
          400,
        );
      }
      const currentRevision = this.store.database
        .prepare("SELECT payload_json FROM project_revisions WHERE id = ?")
        .get(currentRevisionId) as Record<string, unknown> | undefined;
      if (!currentRevision) {
        throw new DomainError(
          "NOT_FOUND",
          "Revizia curentă nu există.",
          404,
        );
      }
      const currentPayload = JSON.parse(
        text(currentRevision, "payload_json"),
      ) as DraftPayload;
      currentPayload.clarifications = normalizeClarificationAnswers(
        currentPayload.clarifications,
        currentPayload.idea,
      );
      const submittedPayload: DraftPayload = {
        ...currentPayload,
        submitted: true,
      };
      const capture = this.store.artifacts.put({
        bytes: encoder.encode(
          buildCaptureMarkdown({
            displayName: text(project, "display_name"),
            ...submittedPayload,
          }),
        ),
        displayName: "capture.md",
        mediaType: "text/markdown",
      });
      this.insertArtifact(capture, createdAt);
      this.store.database
        .prepare(
          `INSERT INTO project_revisions(
            id, project_id, version, capture_artifact_digest, actor_kind,
            submitted, payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(
          revisionId,
          input.projectId,
          nextVersion,
          capture.digest,
          input.actorKind,
          stableJson(submittedPayload),
          createdAt,
        );
      this.store.database
        .prepare(
          `INSERT INTO revision_artifacts(
            revision_id, artifact_digest, purpose, position, display_name
          ) VALUES (?, ?, 'capture', 0, 'capture.md')`,
        )
        .run(revisionId, capture.digest);
      this.store.database
        .prepare(
          `INSERT INTO revision_artifacts(
            revision_id, artifact_digest, purpose, position, display_name
          )
          SELECT ?, artifact_digest, purpose, position, display_name
          FROM revision_artifacts
          WHERE revision_id = ? AND purpose = 'media'`,
        )
        .run(revisionId, currentRevisionId);
      this.store.database
        .prepare(
          `INSERT INTO capture_events(
            id, project_id, revision_id, actor_kind, event_kind,
            artifact_digest, provenance_json, created_at
          ) VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?)`,
        )
        .run(
          this.idFactory(),
          input.projectId,
          revisionId,
          input.actorKind,
          capture.digest,
          stableJson({ source: "intake_submission" }),
          createdAt,
        );
      this.store.database
        .prepare(
          `UPDATE projects
           SET current_version = ?, current_revision_id = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(nextVersion, revisionId, createdAt, input.projectId);

      const planSteps = this.store.database
        .prepare("SELECT id, position FROM plan_steps WHERE project_id = ?")
        .all(input.projectId) as Record<string, unknown>[];
      const intakeStep = planSteps.find((row) => integer(row, "position") === 0);
      const researchStep = planSteps.find((row) => integer(row, "position") === 1);
      if (intakeStep) {
        this.store.database
          .prepare(
            `UPDATE plan_steps
             SET status = 'verified', evidence_ref = ?, verified_at = ?,
                 next_action = NULL, updated_at = ?
             WHERE id = ?`,
          )
          .run(`revision:${revisionId}`, createdAt, createdAt, text(intakeStep, "id"));
      }
      if (researchStep) {
        this.store.database
          .prepare(
            `UPDATE plan_steps
             SET status = 'blocked',
                 next_action = 'Așteptăm conectarea providerului pentru cercetare.',
                 evidence_ref = NULL, verified_at = NULL, updated_at = ?
             WHERE id = ?`,
          )
          .run(createdAt, text(researchStep, "id"));
      }

      this.audit({
        projectId: input.projectId,
        actorKind: input.actorKind,
        eventKind: "project_submitted",
        subjectId: revisionId,
        payload: { version: nextVersion, providerStarted: false },
        createdAt,
      });

      const response: SubmitProjectResult = {
        project: this.getClientProjection(input.projectId),
        revisionId,
        version: nextVersion,
        providerStarted: false,
        replayed: false,
      };
      this.recordReceipt(
        input.projectId,
        commandName,
        input.idempotencyKey,
        requestDigest,
        response,
        createdAt,
      );
      return response;
    });
  }

  appendPublicCollaboration(
    rawInput: CollaborationInput,
  ): AppendCollaborationResult {
    return this.appendCollaboration(rawInput, "public");
  }

  appendInternalCollaboration(rawInput: CollaborationInput) {
    return this.appendCollaboration(rawInput, "internal");
  }

  private appendCollaboration(
    rawInput: CollaborationInput,
    visibility: "public" | "internal",
  ): AppendCollaborationResult {
    const input = collaborationInputSchema.parse(rawInput);
    const commandName = `append_${visibility}_collaboration`;
    const requestDigest = sha256(stableJson({ input, visibility }));
    const existing = this.getReceipt<AppendCollaborationResult>(
      input.projectId,
      commandName,
      input.idempotencyKey,
      requestDigest,
    );
    if (existing) return { ...existing, replayed: true };

    const createdAt = this.now();
    const entryId = this.idFactory();

    return this.store.transaction(() => {
      const transactionalExisting =
        this.getReceipt<AppendCollaborationResult>(
          input.projectId,
          commandName,
          input.idempotencyKey,
          requestDigest,
        );
      if (transactionalExisting) {
        return { ...transactionalExisting, replayed: true };
      }

      this.requireProject(input.projectId);
      if (input.relatedPlanStepId) {
        const step = this.store.database
          .prepare(
            "SELECT 1 AS present FROM plan_steps WHERE id = ? AND project_id = ?",
          )
          .get(input.relatedPlanStepId, input.projectId);
        if (!step) {
          throw new DomainError("NOT_FOUND", "Pasul nu există.", 404);
        }
      }
      if (input.relatedRevisionId) {
        const revision = this.store.database
          .prepare(
            "SELECT 1 AS present FROM project_revisions WHERE id = ? AND project_id = ?",
          )
          .get(input.relatedRevisionId, input.projectId);
        if (!revision) {
          throw new DomainError("NOT_FOUND", "Revizia nu există.", 404);
        }
      }

      const artifact = this.store.artifacts.put({
        bytes: encoder.encode(input.body),
        displayName: "collaboration.md",
        mediaType: "text/markdown",
      });
      this.insertArtifact(artifact, createdAt);
      this.store.database
        .prepare(
          `INSERT INTO collaboration_entries(
            id, project_id, revision_id, plan_step_id, actor_kind, entry_kind,
            body_artifact_digest, visibility, attribution, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unverified-local', ?)`,
        )
        .run(
          entryId,
          input.projectId,
          input.relatedRevisionId ?? null,
          input.relatedPlanStepId ?? null,
          input.actorKind,
          input.entryKind,
          artifact.digest,
          visibility,
          createdAt,
        );
      this.audit({
        projectId: input.projectId,
        actorKind: input.actorKind,
        eventKind: `${visibility}_collaboration_added`,
        subjectId: entryId,
        payload: { entryKind: input.entryKind },
        createdAt,
      });

      const entry: ClientCollaborationEntryDto = {
        id: entryId,
        actorKind: input.actorKind,
        entryKind: input.entryKind,
        body: input.body,
        attribution: "unverified-local",
        relatedPlanStepId: input.relatedPlanStepId ?? null,
        relatedRevisionId: input.relatedRevisionId ?? null,
        createdAt,
      };
      const response: AppendCollaborationResult = {
        entry,
        replayed: false,
      };
      this.recordReceipt(
        input.projectId,
        commandName,
        input.idempotencyKey,
        requestDigest,
        response,
        createdAt,
      );
      return response;
    });
  }

  updatePlanStep(input: PlanStepUpdate) {
    const status = planStepStatusSchema.parse(input.status);
    if (status === "verified" && !input.evidenceRef?.trim()) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Un pas verificat necesită o referință internă de evidence.",
        400,
      );
    }
    this.requireProject(input.projectId);
    const step = this.store.database
      .prepare("SELECT id FROM plan_steps WHERE id = ? AND project_id = ?")
      .get(input.stepId, input.projectId);
    if (!step) throw new DomainError("NOT_FOUND", "Pasul nu există.", 404);

    const updatedAt = this.now();
    this.store.transaction(() => {
      this.store.database
        .prepare(
          `UPDATE plan_steps
           SET status = ?,
               client_summary = COALESCE(?, client_summary),
               next_action = ?,
               evidence_ref = ?,
               verified_at = ?,
               updated_at = ?
           WHERE id = ? AND project_id = ?`,
        )
        .run(
          status,
          input.clientSummary ?? null,
          input.nextAction ?? null,
          status === "verified" ? (input.evidenceRef ?? null) : null,
          status === "verified" ? updatedAt : null,
          updatedAt,
          input.stepId,
          input.projectId,
        );
      this.audit({
        projectId: input.projectId,
        actorKind: "system",
        eventKind: "plan_step_updated",
        subjectId: input.stepId,
        payload: { status },
        createdAt: updatedAt,
      });
    });
    return this.getClientProjection(input.projectId);
  }

  completeProject(input: { projectId: string; idempotencyKey: string }) {
    return this.changeLifecycle(input, "complete_project", true);
  }

  reopenProject(input: { projectId: string; idempotencyKey: string }) {
    return this.changeLifecycle(input, "reopen_project", false);
  }

  private changeLifecycle(
    input: { projectId: string; idempotencyKey: string },
    commandName: "complete_project" | "reopen_project",
    completing: boolean,
  ) {
    this.requireProject(input.projectId);
    const requestDigest = sha256(stableJson({ ...input, commandName }));
    const existing = this.getReceipt<ClientProjectDto & { replayed: boolean }>(
      input.projectId,
      commandName,
      input.idempotencyKey,
      requestDigest,
    );
    if (existing) return { ...existing, replayed: true };

    const nowDate = this.clock();
    const updatedAt = nowDate.toISOString();
    const purgeAfter = completing
      ? new Date(nowDate.getTime() + THIRTY_DAYS_MS).toISOString()
      : null;

    return this.store.transaction(() => {
      const transactionalExisting = this.getReceipt<
        ClientProjectDto & { replayed: boolean }
      >(
        input.projectId,
        commandName,
        input.idempotencyKey,
        requestDigest,
      );
      if (transactionalExisting) {
        return { ...transactionalExisting, replayed: true };
      }

      this.requireProject(input.projectId);
      this.store.database
        .prepare(
          `UPDATE projects
           SET lifecycle_state = ?, completed_at = ?, purge_after = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          completing ? "completed" : "active",
          completing ? updatedAt : null,
          purgeAfter,
          updatedAt,
          input.projectId,
        );
      this.audit({
        projectId: input.projectId,
        actorKind: "operator",
        eventKind: completing ? "project_completed" : "project_reopened",
        subjectId: input.projectId,
        payload: { purgeAfter },
        createdAt: updatedAt,
      });
      const response = Object.assign(this.getClientProjection(input.projectId), {
        replayed: false,
      });
      this.recordReceipt(
        input.projectId,
        commandName,
        input.idempotencyKey,
        requestDigest,
        response,
        updatedAt,
      );
      return response;
    });
  }

  getClientProjection(projectId: string): ClientProjectDto {
    const project = this.requireProject(projectId);
    const currentRevisionId = nullableText(project, "current_revision_id");
    let payload: DraftPayload = {
      idea: "",
      notes: "",
      approvalRequired: false,
      submitted: false,
      clarifications: {},
    };
    if (currentRevisionId) {
      const revision = this.store.database
        .prepare("SELECT payload_json FROM project_revisions WHERE id = ?")
        .get(currentRevisionId) as Record<string, unknown> | undefined;
      if (revision) payload = JSON.parse(text(revision, "payload_json")) as DraftPayload;
    }
    const clarifications = normalizeClarificationAnswers(
      payload.clarifications,
      payload.idea,
    );

    const stepRows = this.store.database
      .prepare(
        `SELECT id, status, client_title, client_summary, next_action,
                evidence_ref, verified_at, updated_at
         FROM plan_steps
         WHERE project_id = ? AND client_visible = 1
         ORDER BY position`,
      )
      .all(projectId) as Record<string, unknown>[];
    const steps: ClientPlanStepDto[] = stepRows.map((row) => {
      const storedStatus = text(row, "status") as PlanStepStatus;
      const evidenceRef = nullableText(row, "evidence_ref");
      const verifiedAt = nullableText(row, "verified_at");
      const status =
        storedStatus === "verified" && (!evidenceRef || !verifiedAt)
          ? "blocked"
          : storedStatus;
      return {
        id: text(row, "id"),
        title: text(row, "client_title"),
        summary: text(row, "client_summary"),
        status,
        nextAction:
          status === "blocked" && storedStatus === "verified"
            ? "Verificarea pasului este incompletă."
            : nullableText(row, "next_action"),
        updatedAt: text(row, "updated_at"),
        verifiedAt: status === "verified" ? verifiedAt : null,
      };
    });

    const collaborationRows = this.store.database
      .prepare(
        `SELECT c.id, c.actor_kind, c.entry_kind, c.attribution,
                c.plan_step_id, c.revision_id, c.created_at, a.storage_key
         FROM collaboration_entries c
         JOIN artifacts a ON a.digest = c.body_artifact_digest
         WHERE c.project_id = ? AND c.visibility = 'public'
         ORDER BY c.created_at, c.id`,
      )
      .all(projectId) as Record<string, unknown>[];
    const collaboration: ClientCollaborationEntryDto[] = collaborationRows.map(
      (row) => ({
        id: text(row, "id"),
        actorKind: text(row, "actor_kind") as ActorKind,
        entryKind: text(row, "entry_kind") as ClientCollaborationEntryDto["entryKind"],
        body: decoder.decode(this.store.artifacts.read(text(row, "storage_key"))),
        attribution: text(
          row,
          "attribution",
        ) as ClientCollaborationEntryDto["attribution"],
        relatedPlanStepId: nullableText(row, "plan_step_id"),
        relatedRevisionId: nullableText(row, "revision_id"),
        createdAt: text(row, "created_at"),
      }),
    );

    const verifiedSteps = steps.filter((step) => step.status === "verified").length;
    return {
      id: text(project, "id"),
      displayName: text(project, "display_name"),
      lifecycleState: text(project, "lifecycle_state") as ProjectLifecycle,
      version: integer(project, "current_version"),
      completedAt: nullableText(project, "completed_at"),
      purgeAfter: nullableText(project, "purge_after"),
      updatedAt: text(project, "updated_at"),
      draft: {
        revisionId: currentRevisionId,
        idea: payload.idea,
        clarifications,
        notes: payload.notes,
        approvalRequired: payload.approvalRequired,
        submitted: payload.submitted,
      },
      plan: {
        verifiedSteps,
        visibleSteps: steps.length,
        progressPercent: steps.length
          ? Math.round((verifiedSteps / steps.length) * 100)
          : 0,
        steps,
      },
      collaboration,
    };
  }

  reconcile(): ReconciliationReport {
    const rows = this.store.database
      .prepare("SELECT digest, storage_key FROM artifacts ORDER BY digest")
      .all() as Record<string, unknown>[];
    const referenced = new Set(rows.map((row) => text(row, "digest")));
    const stored = new Set(this.store.artifacts.listDigests());
    const missingDigests = rows
      .filter((row) => !this.store.artifacts.exists(text(row, "storage_key")))
      .map((row) => text(row, "digest"));
    const orphanDigests = [...stored].filter((digest) => !referenced.has(digest));
    return {
      referencedArtifacts: referenced.size,
      storedArtifacts: stored.size,
      orphanDigests: orphanDigests.toSorted(),
      missingDigests: missingDigests.toSorted(),
    };
  }

  integrityCheck() {
    return this.store.integrityCheck();
  }

  backupTo(destination: string) {
    return this.store.backupTo(destination);
  }

  diagnostics() {
    const count = (table: string) =>
      Number(
        (
          this.store.database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as
            | Record<string, unknown>
            | undefined
        )?.count ?? 0,
      );
    return {
      projects: count("projects"),
      revisions: count("project_revisions"),
      captures: count("capture_events"),
      artifacts: count("artifacts"),
      collaboration: count("collaboration_entries"),
      receipts: count("idempotency_receipts"),
    };
  }
}
