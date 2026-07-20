import { z } from "zod";

const identifier = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}-[A-Z0-9][A-Z0-9_-]{1,31}$`));

export const planRequirementSchema = z.object({
  id: identifier("REQ"),
  title: z.string().trim().min(1).max(160),
  statement: z.string().trim().min(1).max(2_000),
  sourceRefs: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
}).strict();

export const acceptanceCriterionSchema = z.object({
  id: identifier("AC"),
  requirementIds: z.array(identifier("REQ")).min(1).max(20),
  statement: z.string().trim().min(1).max(2_000),
  verification: z.string().trim().min(1).max(1_000),
}).strict();

export const architectureComponentSchema = z.object({
  id: identifier("CMP"),
  name: z.string().trim().min(1).max(120),
  responsibility: z.string().trim().min(1).max(2_000),
  sourceOfTruth: z.string().trim().min(1).max(500),
  interfaces: z.array(z.string().trim().min(1).max(500)).max(20),
  securityBoundary: z.string().trim().min(1).max(1_000),
}).strict();

export const architectureEdgeSchema = z.object({
  from: identifier("CMP"),
  to: identifier("CMP"),
  relationship: z.string().trim().min(1).max(300),
}).strict();

export const planRiskSchema = z.object({
  id: identifier("RISK"),
  title: z.string().trim().min(1).max(160),
  impact: z.enum(["low", "medium", "high", "critical"]),
  mitigation: z.string().trim().min(1).max(2_000),
}).strict();

export const planBlockerSchema = z.object({
  id: identifier("BLOCK"),
  detail: z.string().trim().min(1).max(2_000),
  resolutionNeeded: z.string().trim().min(1).max(2_000),
  blockingTaskIds: z.array(identifier("TASK")).max(30),
}).strict();

export const verificationCommandSchema = z.enum([
  "lint",
  "typecheck",
  "test",
  "build",
  "security",
]);

export const evidenceKindSchema = z.enum([
  "diff",
  "checks",
  "independent_review",
  "secret_scan",
  "integration_readback",
]);

export const implementationTaskSchema = z.object({
  id: identifier("TASK"),
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(2_000),
  ownerProfile: z.string().trim().min(1).max(120),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  requirementIds: z.array(identifier("REQ")).min(1).max(30),
  riskIds: z.array(identifier("RISK")).max(30),
  acceptanceIds: z.array(identifier("AC")).min(1).max(30),
  componentIds: z.array(identifier("CMP")).min(1).max(20),
  dependsOn: z.array(identifier("TASK")).max(30),
  fileScopes: z.array(z.string().trim().min(1).max(300)).min(1).max(40),
  sharedOwnershipRationale: z.string().trim().min(1).max(1_000).nullable(),
  contextRefs: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
  verificationCommands: z.array(verificationCommandSchema).min(1).max(5),
  evidenceRequired: z.array(evidenceKindSchema).min(1).max(5),
  stopRules: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  effort: z.string().trim().min(1).max(120),
}).strict();

export const clientPlanStepSchema = z.object({
  taskIds: z.array(identifier("TASK")).min(1).max(30),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
}).strict();

export const implementationPlanSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4_000),
  benefits: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20),
  limitations: z.array(z.string().trim().min(1).max(1_000)).max(20),
  assumptions: z.array(z.string().trim().min(1).max(1_000)).max(30),
  requirements: z.array(planRequirementSchema).min(1).max(100),
  acceptanceCriteria: z.array(acceptanceCriterionSchema).min(1).max(150),
  components: z.array(architectureComponentSchema).min(1).max(60),
  architectureEdges: z.array(architectureEdgeSchema).max(150),
  risks: z.array(planRiskSchema).max(80),
  blockers: z.array(planBlockerSchema).max(40),
  tasks: z.array(implementationTaskSchema).min(1).max(150),
  clientSteps: z.array(clientPlanStepSchema).min(1).max(20),
}).strict();

export const planStatusSchema = z.enum([
  "generating",
  "waiting_operator",
  "blocked",
  "failed",
  "approved",
  "superseded",
]);

export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;
export type ImplementationTask = z.infer<typeof implementationTaskSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;

export type PlanValidationIssue = {
  code: string;
  path: string;
  message: string;
  severity: "error" | "warning";
};

export type ImplementationPlanDto = {
  id: string;
  revisionId: string;
  status: PlanStatus;
  digest: string | null;
  baseCommit: string;
  policyVersion: string;
  plan: ImplementationPlan | null;
  validation: PlanValidationIssue[];
  providerRunId: string | null;
  errorDetail: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImplementationPlanStateDto = {
  latestPlan: ImplementationPlanDto | null;
};
