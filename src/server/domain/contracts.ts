import { z } from "zod";

export const actorKindSchema = z.enum(["operator", "client", "unverified"]);
export const collaborationKindSchema = z.enum([
  "question",
  "answer",
  "message",
  "correction",
  "acknowledgement",
]);
export const planStepStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "waiting_client",
  "blocked",
  "verified",
]);

export const projectIdSchema = z.string().uuid();

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Cheia de idempotency are un format invalid.");

export const createProjectInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  idempotencyKey: idempotencyKeySchema,
});

export const saveDraftInputSchema = z.object({
  projectId: projectIdSchema,
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: idempotencyKeySchema,
  actorKind: actorKindSchema,
  idea: z.string().max(100_000),
  notes: z.string().max(100_000),
  approvalRequired: z.boolean(),
});

export const submitProjectInputSchema = z.object({
  projectId: projectIdSchema,
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: idempotencyKeySchema,
  actorKind: actorKindSchema,
});

export const collaborationInputSchema = z.object({
  projectId: projectIdSchema,
  idempotencyKey: idempotencyKeySchema,
  actorKind: actorKindSchema,
  entryKind: collaborationKindSchema,
  body: z.string().trim().min(1).max(20_000),
  relatedPlanStepId: z.string().uuid().optional(),
  relatedRevisionId: z.string().uuid().optional(),
});

export type ActorKind = z.infer<typeof actorKindSchema>;
export type CollaborationKind = z.infer<typeof collaborationKindSchema>;
export type PlanStepStatus = z.infer<typeof planStepStatusSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftInputSchema>;
export type SubmitProjectInput = z.infer<typeof submitProjectInputSchema>;
export type CollaborationInput = z.infer<typeof collaborationInputSchema>;

export type ProjectLifecycle = "active" | "completed" | "grace" | "pinned";

export type MediaInput = {
  bytes: Uint8Array;
  displayName: string;
  mediaType: string;
};

export type ClientPlanStepDto = {
  id: string;
  title: string;
  summary: string;
  status: PlanStepStatus;
  nextAction: string | null;
  updatedAt: string;
  verifiedAt: string | null;
};

export type ClientCollaborationEntryDto = {
  id: string;
  actorKind: ActorKind;
  entryKind: CollaborationKind;
  body: string;
  attribution: "unverified-local" | "authenticated";
  relatedPlanStepId: string | null;
  relatedRevisionId: string | null;
  createdAt: string;
};

export type ClientProjectDto = {
  id: string;
  displayName: string;
  lifecycleState: ProjectLifecycle;
  version: number;
  completedAt: string | null;
  purgeAfter: string | null;
  updatedAt: string;
  draft: {
    revisionId: string | null;
    idea: string;
    notes: string;
    approvalRequired: boolean;
    submitted: boolean;
  };
  plan: {
    verifiedSteps: number;
    visibleSteps: number;
    progressPercent: number;
    steps: ClientPlanStepDto[];
  };
  collaboration: ClientCollaborationEntryDto[];
};

export type CreateProjectResult = {
  project: ClientProjectDto;
  replayed: boolean;
};

export type SaveDraftResult = {
  project: ClientProjectDto;
  revisionId: string;
  version: number;
  artifactDigests: string[];
  replayed: boolean;
};

export type SubmitProjectResult = {
  project: ClientProjectDto;
  revisionId: string;
  version: number;
  providerStarted: false;
  replayed: boolean;
};

export type AppendCollaborationResult = {
  entry: ClientCollaborationEntryDto;
  replayed: boolean;
};

export type PlanStepUpdate = {
  projectId: string;
  stepId: string;
  status: PlanStepStatus;
  clientSummary?: string;
  nextAction?: string | null;
  evidenceRef?: string;
};

export type ReconciliationReport = {
  referencedArtifacts: number;
  storedArtifacts: number;
  orphanDigests: string[];
  missingDigests: string[];
};
