import { createHash } from "node:crypto";

import {
  Codex,
  type ThreadEvent,
  type ThreadOptions,
  type TurnOptions,
} from "@openai/codex-sdk";

import {
  executionStartSchema,
  type CancelReceipt,
  type ExecutionErrorCode,
  type ExecutionEvent,
  type ExecutionProvider,
  type ExecutionStart,
  type ProviderHealth,
  type ProviderRunState,
} from "./contracts";
import {
  buildCodexEnvironment,
  createCodexLocalProbe,
  type CodexLocalProbe,
} from "./codex-local-probe";
import { createRedactor, redactAndLimit } from "./redaction";
import {
  validateExecutionWorkspace,
  WorkspacePolicyError,
} from "./workspace-policy";

const MAX_EVENT_CHARACTERS = 20_000;
const MAX_RESULT_CHARACTERS = 200_000;

type CodexThreadLike = {
  readonly id: string | null;
  runStreamed(
    input: string,
    options?: TurnOptions,
  ): Promise<{ events: AsyncGenerator<ThreadEvent> }>;
};

type CodexClientLike = {
  startThread(options?: ThreadOptions): CodexThreadLike;
  resumeThread?(id: string, options?: ThreadOptions): CodexThreadLike;
};

type ActiveRun = {
  controller: AbortController;
  cancellationReason: "cancelled" | "timeout" | null;
};

export type CodexSdkProviderOptions = {
  enabled: boolean;
  allowedWorkspaceRoot: string;
  forbiddenWorkspacePaths?: readonly string[];
  sensitiveValues?: readonly string[];
  codex?: CodexClientLike;
  probe?: CodexLocalProbe;
  clock?: () => Date;
};

function toolStatus(event: ThreadEvent) {
  if (event.type === "item.started") return "started" as const;
  if (event.type === "item.completed") {
    return event.item.type === "command_execution" && event.item.status === "failed"
      ? ("failed" as const)
      : event.item.type === "mcp_tool_call" && event.item.status === "failed"
        ? ("failed" as const)
        : event.item.type === "file_change" && event.item.status === "failed"
          ? ("failed" as const)
          : ("completed" as const);
  }
  if (event.type !== "item.updated") return "started" as const;
  if (event.item.type === "command_execution" || event.item.type === "mcp_tool_call") {
    return event.item.status === "failed" ? ("failed" as const) : ("started" as const);
  }
  return "started" as const;
}

function safeToolName(event: ThreadEvent) {
  if (
    event.type !== "item.started" &&
    event.type !== "item.updated" &&
    event.type !== "item.completed"
  ) {
    return null;
  }

  switch (event.item.type) {
    case "command_execution":
      return "command_execution";
    case "file_change":
      return "file_change";
    case "mcp_tool_call":
      return "mcp_tool_call";
    case "web_search":
      return "web_search";
    default:
      return null;
  }
}

function classifyFailure(
  error: unknown,
  cancellationReason: ActiveRun["cancellationReason"],
): { code: ExecutionErrorCode; detail: string; retryable: boolean } {
  if (cancellationReason === "timeout") {
    return { code: "timeout", detail: "The Codex run exceeded its time limit.", retryable: true };
  }
  if (cancellationReason === "cancelled") {
    return { code: "cancelled", detail: "The Codex run was cancelled.", retryable: false };
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (/\b(401|403|unauthorized|authentication|not logged in)\b/u.test(message)) {
    return { code: "auth_required", detail: "Codex authentication is unavailable.", retryable: false };
  }
  if (/\b(429|rate limit|quota)\b/u.test(message)) {
    return { code: "rate_limited", detail: "Codex rate limit or quota was reached.", retryable: true };
  }
  if (/\b(network|connection|timed out|unavailable|503|502)\b/u.test(message)) {
    return { code: "provider_unavailable", detail: "Codex is temporarily unavailable.", retryable: true };
  }
  if (/failed to parse item|protocol/u.test(message)) {
    return { code: "provider_protocol", detail: "Codex returned an unsupported event stream.", retryable: false };
  }
  return { code: "provider_error", detail: "Codex could not complete the run.", retryable: false };
}

export class CodexSdkProvider implements ExecutionProvider {
  private readonly enabled: boolean;
  private readonly allowedWorkspaceRoot: string;
  private readonly forbiddenWorkspacePaths: readonly string[];
  private readonly codex: CodexClientLike;
  private readonly probe: CodexLocalProbe;
  private readonly clock: () => Date;
  private readonly redact: (value: string) => string;
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly states = new Map<string, ProviderRunState>();

  constructor(options: CodexSdkProviderOptions) {
    this.enabled = options.enabled;
    this.allowedWorkspaceRoot = options.allowedWorkspaceRoot;
    this.forbiddenWorkspacePaths = options.forbiddenWorkspacePaths ?? [];
    this.clock = options.clock ?? (() => new Date());
    this.redact = createRedactor(options.sensitiveValues);
    const environment = buildCodexEnvironment();
    this.codex =
      options.codex ??
      new Codex({
        env: environment,
        config: {
          features: { hooks: false },
          mcp_servers: {},
        },
      });
    this.probe = options.probe ?? createCodexLocalProbe(environment);
  }

  async preflight(): Promise<ProviderHealth> {
    if (!this.enabled) {
      return {
        provider: "codex",
        status: "blocked",
        version: null,
        authMode: "unknown",
        code: "disabled",
        detail: "Codex owner-local execution is disabled by configuration.",
      };
    }
    return this.probe();
  }

  async *start(rawInput: ExecutionStart): AsyncIterable<ExecutionEvent> {
    const input = executionStartSchema.parse(rawInput);
    if (this.states.has(input.runId)) {
      yield {
        type: "blocked",
        runId: input.runId,
        code: "duplicate_run",
        detail: "A run with this identifier already exists.",
      };
      return;
    }

    const health = await this.preflight();
    if (health.status !== "ready") {
      const code = health.code ?? "provider_unavailable";
      this.states.set(input.runId, {
        runId: input.runId,
        providerRunId: null,
        status: "blocked",
        startedAt: null,
        completedAt: this.clock().toISOString(),
        errorCode: code,
      });
      yield { type: "blocked", runId: input.runId, code, detail: health.detail };
      return;
    }

    let workspace: string;
    try {
      workspace = await validateExecutionWorkspace({
        allowedRoot: this.allowedWorkspaceRoot,
        workspacePath: input.workspacePath,
        forbiddenPaths: this.forbiddenWorkspacePaths,
      });
    } catch (error) {
      const detail =
        error instanceof WorkspacePolicyError
          ? error.message
          : "Workspace validation failed.";
      this.states.set(input.runId, {
        runId: input.runId,
        providerRunId: null,
        status: "blocked",
        startedAt: null,
        completedAt: this.clock().toISOString(),
        errorCode: "invalid_workspace",
      });
      yield {
        type: "blocked",
        runId: input.runId,
        code: "invalid_workspace",
        detail,
      };
      return;
    }

    const activeRun: ActiveRun = {
      controller: new AbortController(),
      cancellationReason: null,
    };
    this.activeRuns.set(input.runId, activeRun);
    this.states.set(input.runId, {
      runId: input.runId,
      providerRunId: null,
      status: "running",
      startedAt: this.clock().toISOString(),
      completedAt: null,
      errorCode: null,
    });

    const timeout = setTimeout(() => {
      activeRun.cancellationReason = "timeout";
      activeRun.controller.abort();
    }, input.timeoutMs);

    let providerRunId: string | null = null;
    let finalResponse = "";
    let turnCompleted = false;

    try {
      const thread = this.codex.startThread({
        workingDirectory: workspace,
        sandboxMode: input.capabilityGrant.sandboxMode,
        networkAccessEnabled: input.capabilityGrant.networkAccess,
        webSearchMode: input.capabilityGrant.webSearch,
        approvalPolicy: input.capabilityGrant.approvalPolicy,
      });
      const { events } = await thread.runStreamed(input.prompt, {
        signal: activeRun.controller.signal,
        outputSchema: input.outputSchema,
      });

      for await (const event of events) {
        if (event.type === "thread.started") {
          providerRunId = event.thread_id;
          const state = this.states.get(input.runId);
          if (state) state.providerRunId = providerRunId;
          yield { type: "started", runId: input.runId, providerRunId };
          continue;
        }

        if (
          event.type === "item.completed" &&
          event.item.type === "agent_message"
        ) {
          const safeMessage = redactAndLimit(
            event.item.text,
            this.redact,
            MAX_EVENT_CHARACTERS,
          );
          finalResponse = this.redact(event.item.text);
          yield {
            type: "message",
            runId: input.runId,
            text: safeMessage.text,
            truncated: safeMessage.truncated,
          };
          continue;
        }

        const toolName = safeToolName(event);
        if (toolName) {
          yield {
            type: "tool",
            runId: input.runId,
            name: toolName,
            status: toolStatus(event),
          };
          continue;
        }

        if (event.type === "turn.completed") {
          turnCompleted = true;
          yield {
            type: "usage",
            runId: input.runId,
            inputTokens: event.usage.input_tokens,
            cachedInputTokens: event.usage.cached_input_tokens,
            outputTokens: event.usage.output_tokens,
            reasoningOutputTokens: event.usage.reasoning_output_tokens,
          };
          continue;
        }

        if (event.type === "turn.failed") {
          throw new Error(event.error.message);
        }
        if (event.type === "error") {
          throw new Error(event.message);
        }
      }

      if (!providerRunId || !turnCompleted) {
        throw new Error("provider protocol ended without a terminal event");
      }

      const safeResult = redactAndLimit(
        finalResponse,
        this.redact,
        MAX_RESULT_CHARACTERS,
      );
      const resultDigest = createHash("sha256")
        .update(safeResult.text, "utf8")
        .digest("hex");
      const state = this.states.get(input.runId);
      if (state) {
        state.status = "completed";
        state.completedAt = this.clock().toISOString();
      }
      yield {
        type: "completed",
        runId: input.runId,
        providerRunId,
        resultText: safeResult.text,
        resultDigest,
        truncated: safeResult.truncated,
      };
    } catch (error) {
      const failure = classifyFailure(error, activeRun.cancellationReason);
      const state = this.states.get(input.runId);
      if (state) {
        state.status =
          failure.code === "cancelled"
            ? "cancelled"
            : failure.code === "timeout"
              ? "timed_out"
              : "failed";
        state.completedAt = this.clock().toISOString();
        state.errorCode = failure.code;
      }
      yield { type: "failed", runId: input.runId, ...failure };
    } finally {
      clearTimeout(timeout);
      const state = this.states.get(input.runId);
      if (state && (state.status === "running" || state.status === "cancelling")) {
        if (!activeRun.controller.signal.aborted) {
          activeRun.cancellationReason = "cancelled";
          activeRun.controller.abort();
        }
        state.status =
          activeRun.cancellationReason === "timeout" ? "timed_out" : "cancelled";
        state.completedAt = this.clock().toISOString();
        state.errorCode =
          activeRun.cancellationReason === "timeout" ? "timeout" : "cancelled";
      }
      this.activeRuns.delete(input.runId);
    }
  }

  async cancel(runId: string): Promise<CancelReceipt> {
    const activeRun = this.activeRuns.get(runId);
    const state = this.states.get(runId);
    if (!activeRun || !state || state.status !== "running") {
      return { runId, accepted: false, status: state?.status ?? "unknown" };
    }

    activeRun.cancellationReason = "cancelled";
    state.status = "cancelling";
    activeRun.controller.abort();
    return { runId, accepted: true, status: "cancelling" };
  }

  async inspect(runId: string): Promise<ProviderRunState> {
    const state = this.states.get(runId);
    return state
      ? { ...state }
      : {
          runId,
          providerRunId: null,
          status: "unknown",
          startedAt: null,
          completedAt: null,
          errorCode: null,
        };
  }
}
