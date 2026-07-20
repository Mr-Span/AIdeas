import { z } from "zod";

export const POLICY_VERSION = "aideas-policy-v1";

export const actionKindSchema = z.enum([
  "commit",
  "push",
  "pull_request",
  "merge",
  "payment",
  "publication",
  "deploy",
]);

export const evidenceCheckSchema = z.object({
  kind: z.enum(["lint", "typecheck", "test", "build", "security", "independent_review", "integration_readback"]),
  status: z.enum(["passed", "failed"]),
  receipt: z.string().trim().min(1).max(2_000),
}).strict();

export const evidenceBundleSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  workItemId: z.string().uuid(),
  revisionId: z.string().uuid(),
  planId: z.string().uuid(),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/),
  policyVersion: z.literal(POLICY_VERSION),
  baseCommit: z.string().regex(/^[a-f0-9]{40,64}$/),
  currentBaseCommit: z.string().regex(/^[a-f0-9]{40,64}$/),
  diffDigest: z.string().regex(/^[a-f0-9]{64}$/),
  commitDigest: z.string().regex(/^[a-f0-9]{40,64}$/).nullable(),
  secretScanPassed: z.boolean(),
  checks: z.array(evidenceCheckSchema).min(1).max(30),
  createdAt: z.string().datetime(),
}).strict();

export type ActionKind = z.infer<typeof actionKindSchema>;
export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;

export type ActionApproval = {
  actionKind: ActionKind;
  actionDigest: string;
  policyVersion: typeof POLICY_VERSION;
  approvedAt: string;
};

export type PolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reasons: string[];
  policyVersion: typeof POLICY_VERSION;
};
