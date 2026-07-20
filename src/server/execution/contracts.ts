import { z } from "zod";

const jsonObjectSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= 65_536,
    "Output schema exceeds 64 KiB.",
  );

export const executionErrorCodeSchema = z.enum([
  "auth_required",
  "rate_limited",
  "provider_unavailable",
  "timeout",
  "cancelled",
  "invalid_workspace",
  "capability_denied",
  "disabled",
  "duplicate_run",
  "provider_protocol",
  "provider_error",
]);

export const executionProviderKindSchema = z.enum(["codex_sdk", "codex_cli"]);

export const capabilityGrantSchema = z.object({
  sandboxMode: z.enum(["read-only", "workspace-write"]),
  networkAccess: z.boolean(),
  webSearch: z.enum(["disabled", "cached", "live"]),
  approvalPolicy: z.literal("never"),
});

export const executionStartSchema = z.object({
  runId: z.string().uuid(),
  workspacePath: z.string().trim().min(1).max(1_024),
  prompt: z.string().trim().min(1).max(100_000),
  outputSchema: jsonObjectSchema.optional(),
  timeoutMs: z.number().int().min(1_000).max(30 * 60 * 1_000),
  capabilityGrant: capabilityGrantSchema,
});

export const executionResumeSchema = executionStartSchema.extend({
  providerRunId: z.string().uuid(),
});

export const executionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("process_started"),
    runId: z.string().uuid(),
    processId: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("started"),
    runId: z.string().uuid(),
    providerRunId: z.string().min(1),
  }),
  z.object({
    type: z.literal("message"),
    runId: z.string().uuid(),
    text: z.string(),
    truncated: z.boolean(),
  }),
  z.object({
    type: z.literal("tool"),
    runId: z.string().uuid(),
    name: z.string().min(1),
    status: z.enum(["started", "completed", "failed"]),
  }),
  z.object({
    type: z.literal("usage"),
    runId: z.string().uuid(),
    inputTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    reasoningOutputTokens: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("blocked"),
    runId: z.string().uuid(),
    code: executionErrorCodeSchema,
    detail: z.string().min(1),
  }),
  z.object({
    type: z.literal("completed"),
    runId: z.string().uuid(),
    providerRunId: z.string().min(1),
    resultText: z.string(),
    resultDigest: z.string().regex(/^[a-f0-9]{64}$/),
    truncated: z.boolean(),
  }),
  z.object({
    type: z.literal("failed"),
    runId: z.string().uuid(),
    code: executionErrorCodeSchema,
    detail: z.string().min(1),
    retryable: z.boolean(),
  }),
]);

export type ExecutionErrorCode = z.infer<typeof executionErrorCodeSchema>;
export type ExecutionProviderKind = z.infer<typeof executionProviderKindSchema>;
export type CapabilityGrant = z.infer<typeof capabilityGrantSchema>;
export type ExecutionStart = z.infer<typeof executionStartSchema>;
export type ExecutionResume = z.infer<typeof executionResumeSchema>;
export type ExecutionEvent = z.infer<typeof executionEventSchema>;

export type ProviderHealth = {
  provider: "codex";
  status: "ready" | "blocked";
  version: string | null;
  authMode: "chatgpt" | "api_key" | "unknown";
  code?: ExecutionErrorCode;
  detail: string;
};

export type ProviderRunStatus =
  | "unknown"
  | "starting"
  | "blocked"
  | "running"
  | "cancelling"
  | "resume_available"
  | "cancelled"
  | "timed_out"
  | "completed"
  | "failed";

export type ProviderRunState = {
  runId: string;
  providerRunId: string | null;
  status: ProviderRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: ExecutionErrorCode | null;
};

export type CancelReceipt = {
  runId: string;
  accepted: boolean;
  status: ProviderRunStatus;
};

export interface ExecutionProvider {
  preflight(): Promise<ProviderHealth>;
  start(input: ExecutionStart): AsyncIterable<ExecutionEvent>;
  resume(input: ExecutionResume): AsyncIterable<ExecutionEvent>;
  cancel(runId: string): Promise<CancelReceipt>;
  inspect(runId: string): Promise<ProviderRunState>;
}
