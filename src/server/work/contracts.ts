import type { ImplementationTask } from "@/server/planning/contracts";
import type { EvidenceBundle } from "@/server/policy/contracts";

export type WorkItemStatus =
  | "blocked"
  | "queued"
  | "ready"
  | "running"
  | "verifying"
  | "verified"
  | "integrated"
  | "failed";

export type WorkAttemptDto = {
  id: string;
  attemptNumber: number;
  status: "running" | "verifying" | "verified" | "failed" | "blocked" | "expired";
  errorDetail: string | null;
  evidenceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkItemDto = {
  id: string;
  canonicalKey: string;
  title: string;
  status: WorkItemStatus;
  packet: ImplementationTask;
  dependencies: Array<{ id: string; canonicalKey: string; status: WorkItemStatus }>;
  latestAttempt: WorkAttemptDto | null;
  evidence: EvidenceBundle | null;
};

export type WorkControlStateDto = {
  planId: string | null;
  planDigest: string | null;
  policyVersion: string | null;
  workItems: WorkItemDto[];
};
