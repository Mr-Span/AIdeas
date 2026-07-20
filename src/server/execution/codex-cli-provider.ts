import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";

import {
  executionResumeSchema,
  executionStartSchema,
  type CancelReceipt,
  type ExecutionErrorCode,
  type ExecutionEvent,
  type ExecutionProvider,
  type ExecutionResume,
  type ExecutionStart,
  type ProviderHealth,
  type ProviderRunState,
} from "./contracts";
import {
  buildCodexEnvironment,
  createCodexLocalProbe,
  type CodexLocalProbe,
} from "./codex-local-probe";
import {
  spawnManagedProcess,
  terminateProcessTree,
  type ManagedProcess,
} from "./process-supervisor";
import { createRedactor, redactAndLimit } from "./redaction";
import {
  validateExecutionWorkspace,
  WorkspacePolicyError,
} from "./workspace-policy";

const MAX_EVENT_CHARACTERS = 20_000;
const MAX_RESULT_CHARACTERS = 200_000;
const SUPPORTED_CLI_MINORS = new Set([144, 145]);

type ActiveCliRun = {
  process: ManagedProcess;
  cancellationReason: "cancelled" | "timeout" | null;
};

type CliProcessFactory = typeof spawnManagedProcess;
type ProcessTreeTerminator = typeof terminateProcessTree;

export type CodexCliProviderOptions = {
  enabled: boolean;
  allowedWorkspaceRoot: string;
  forbiddenWorkspacePaths?: readonly string[];
  sensitiveValues?: readonly string[];
  probe?: CodexLocalProbe;
  command?: string;
  processFactory?: CliProcessFactory;
  terminateTree?: ProcessTreeTerminator;
  clock?: () => Date;
};

export function isSupportedCodexCliVersion(version: string | null) {
  if (!version) return false;
  const match = version.match(/\b(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?\b/u);
  if (!match) return false;
  return Number(match[1]) === 0 && SUPPORTED_CLI_MINORS.has(Number(match[2]));
}

export function parseCodexJsonLine(line: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON line is not an object");
    }
    const event = parsed as Record<string, unknown>;
    if (typeof event.type !== "string" || !event.type) {
      throw new Error("JSON line has no event type");
    }
    return event;
  } catch {
    throw new Error("Codex JSONL protocol parse failure.");
  }
}

function newestCodexDesktopExecutable(
  environment: Readonly<Record<string, string | undefined>>,
) {
  if (process.platform !== "win32" || !environment.LOCALAPPDATA) return "codex";
  const binRoot = join(environment.LOCALAPPDATA, "OpenAI", "Codex", "bin");
  try {
    const candidates = readdirSync(binRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(binRoot, entry.name, "codex.exe"))
      .filter((candidate) => {
        try {
          return statSync(candidate).isFile();
        } catch {
          return false;
        }
      })
      .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
    return candidates[0] ?? "codex";
  } catch {
    return "codex";
  }
}

function safeFailure(
  error: unknown,
  cancellationReason: ActiveCliRun["cancellationReason"],
): { code: ExecutionErrorCode; detail: string; retryable: boolean } {
  if (cancellationReason === "timeout") {
    return { code: "timeout", detail: "The Codex CLI run exceeded its time limit.", retryable: true };
  }
  if (cancellationReason === "cancelled") {
    return { code: "cancelled", detail: "The Codex CLI run was cancelled.", retryable: false };
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (/protocol|jsonl|json line/u.test(message)) {
    return { code: "provider_protocol", detail: "Codex returned an unsupported JSONL stream.", retryable: false };
  }
  if (/401|403|unauthorized|authentication|not logged in/u.test(message)) {
    return { code: "auth_required", detail: "Codex authentication is unavailable.", retryable: false };
  }
  if (/429|rate limit|quota/u.test(message)) {
    return { code: "rate_limited", detail: "Codex rate limit or quota was reached.", retryable: true };
  }
  if (/network|connection|unavailable|503|502/u.test(message)) {
    return { code: "provider_unavailable", detail: "Codex is temporarily unavailable.", retryable: true };
  }
  return { code: "provider_error", detail: "Codex CLI could not complete the run.", retryable: false };
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function toolCategory(item: Record<string, unknown>) {
  switch (item.type) {
    case "command_execution":
    case "file_change":
    case "mcp_tool_call":
    case "web_search":
      return item.type;
    default:
      return null;
  }
}

function toolLifecycle(type: string, item: Record<string, unknown>) {
  if (type === "item.started" || type === "item.updated") return "started" as const;
  return item.status === "failed" ? ("failed" as const) : ("completed" as const);
}

export function buildCodexCliArguments(
  input: ExecutionStart | ExecutionResume,
  providerRunId?: string,
) {
  if (providerRunId) {
    return [
      "exec",
      "resume",
      "--json",
      "--ignore-user-config",
      "--ignore-rules",
      "--strict-config",
      "-c",
      'approval_policy="never"',
      "-c",
      `sandbox_mode="${input.capabilityGrant.sandboxMode}"`,
      "-c",
      `sandbox_workspace_write.network_access=${input.capabilityGrant.networkAccess}`,
      "-c",
      `web_search="${input.capabilityGrant.webSearch}"`,
      "-c",
      "features.hooks=false",
      providerRunId,
      "-",
    ];
  }
  return [
    "exec",
    "--json",
    "--color",
    "never",
    "--ignore-user-config",
    "--ignore-rules",
    "--strict-config",
    "--sandbox",
    input.capabilityGrant.sandboxMode,
    "-C",
    input.workspacePath,
    "-c",
    'approval_policy="never"',
    "-c",
    `sandbox_workspace_write.network_access=${input.capabilityGrant.networkAccess}`,
    "-c",
    `web_search="${input.capabilityGrant.webSearch}"`,
    "-c",
    "features.hooks=false",
    "-",
  ];
}

export class CodexCliProvider implements ExecutionProvider {
  private readonly enabled: boolean;
  private readonly allowedWorkspaceRoot: string;
  private readonly forbiddenWorkspacePaths: readonly string[];
  private readonly probe: CodexLocalProbe;
  private readonly command: string;
  private readonly processFactory: CliProcessFactory;
  private readonly terminateTree: ProcessTreeTerminator;
  private readonly clock: () => Date;
  private readonly redact: (value: string) => string;
  private readonly activeRuns = new Map<string, ActiveCliRun>();
  private readonly states = new Map<string, ProviderRunState>();

  constructor(options: CodexCliProviderOptions) {
    this.enabled = options.enabled;
    this.allowedWorkspaceRoot = options.allowedWorkspaceRoot;
    this.forbiddenWorkspacePaths = options.forbiddenWorkspacePaths ?? [];
    const environment = buildCodexEnvironment();
    this.probe = options.probe ?? createCodexLocalProbe(environment);
    this.command = options.command ?? newestCodexDesktopExecutable(environment);
    this.processFactory = options.processFactory ?? spawnManagedProcess;
    this.terminateTree = options.terminateTree ?? terminateProcessTree;
    this.clock = options.clock ?? (() => new Date());
    this.redact = createRedactor(options.sensitiveValues);
  }

  async preflight(): Promise<ProviderHealth> {
    if (!this.enabled) {
      return {
        provider: "codex",
        status: "blocked",
        version: null,
        authMode: "unknown",
        code: "disabled",
        detail: "Execuția Codex locală este dezactivată în configurația serverului.",
      };
    }
    const health = await this.probe();
    if (health.status === "ready" && !isSupportedCodexCliVersion(health.version)) {
      return {
        ...health,
        status: "blocked",
        code: "provider_protocol",
        detail: "The installed Codex CLI version is outside the validated compatibility window.",
      };
    }
    return health;
  }

  start(rawInput: ExecutionStart) {
    return this.run(rawInput);
  }

  resume(rawInput: ExecutionResume) {
    const input = executionResumeSchema.parse(rawInput);
    return this.run(input, input.providerRunId);
  }

  private async *run(
    rawInput: ExecutionStart | ExecutionResume,
    resumeProviderRunId?: string,
  ): AsyncIterable<ExecutionEvent> {
    const input = resumeProviderRunId
      ? executionResumeSchema.parse(rawInput)
      : executionStartSchema.parse(rawInput);
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
      yield {
        type: "blocked",
        runId: input.runId,
        code: "invalid_workspace",
        detail:
          error instanceof WorkspacePolicyError
            ? error.message
            : "Workspace validation failed.",
      };
      return;
    }

    const request = { ...input, workspacePath: workspace };
    const managed = this.processFactory({
      command: this.command,
      args: buildCodexCliArguments(request, resumeProviderRunId),
      cwd: workspace,
      env: buildCodexEnvironment() as NodeJS.ProcessEnv,
    });
    const active: ActiveCliRun = { process: managed, cancellationReason: null };
    this.activeRuns.set(input.runId, active);
    this.states.set(input.runId, {
      runId: input.runId,
      providerRunId: resumeProviderRunId ?? null,
      status: "running",
      startedAt: this.clock().toISOString(),
      completedAt: null,
      errorCode: null,
    });
    if (!managed.child.pid) {
      await this.terminateTree(managed.child);
      yield {
        type: "failed",
        runId: input.runId,
        code: "provider_error",
        detail: "Codex CLI did not expose a process identifier.",
        retryable: false,
      };
      this.activeRuns.delete(input.runId);
      return;
    }
    yield {
      type: "process_started",
      runId: input.runId,
      processId: managed.child.pid,
    };
    managed.child.stdin.end(input.prompt, "utf8");

    const timeout = setTimeout(() => {
      active.cancellationReason = "timeout";
      void this.terminateTree(managed.child);
    }, input.timeoutMs);
    let providerRunId = resumeProviderRunId ?? null;
    let finalResponse = "";
    let turnCompleted = false;
    let stderr = "";
    managed.child.stderr.setEncoding("utf8");
    managed.child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-20_000);
    });

    try {
      const lines = createInterface({ input: managed.child.stdout, crlfDelay: Infinity });
      for await (const line of lines) {
        if (!line.trim()) continue;
        const event = parseCodexJsonLine(line);
        const type = typeof event.type === "string" ? event.type : "";
        if (type === "thread.started") {
          if (typeof event.thread_id !== "string" || !event.thread_id) {
            throw new Error("Codex JSONL protocol omitted the thread id.");
          }
          providerRunId = event.thread_id;
          const state = this.states.get(input.runId);
          if (state) state.providerRunId = providerRunId;
          yield { type: "started", runId: input.runId, providerRunId };
          continue;
        }
        if (type === "item.started" || type === "item.updated" || type === "item.completed") {
          const item = event.item;
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const safeItem = item as Record<string, unknown>;
          if (type === "item.completed" && safeItem.type === "agent_message" && typeof safeItem.text === "string") {
            finalResponse = this.redact(safeItem.text);
            const safeMessage = redactAndLimit(safeItem.text, this.redact, MAX_EVENT_CHARACTERS);
            yield { type: "message", runId: input.runId, text: safeMessage.text, truncated: safeMessage.truncated };
            continue;
          }
          const category = toolCategory(safeItem);
          if (category) {
            yield { type: "tool", runId: input.runId, name: category, status: toolLifecycle(type, safeItem) };
          }
          continue;
        }
        if (type === "turn.completed") {
          const usage = event.usage && typeof event.usage === "object"
            ? (event.usage as Record<string, unknown>)
            : {};
          turnCompleted = true;
          yield {
            type: "usage",
            runId: input.runId,
            inputTokens: numberField(usage.input_tokens),
            cachedInputTokens: numberField(usage.cached_input_tokens),
            outputTokens: numberField(usage.output_tokens),
            reasoningOutputTokens: numberField(usage.reasoning_output_tokens),
          };
          continue;
        }
        if (type === "turn.failed" || type === "error") {
          throw new Error("Codex JSONL reported a provider failure.");
        }
      }
      const exit = await managed.exit;
      if (exit.code !== 0 || !providerRunId || !turnCompleted) {
        throw new Error(
          exit.code !== 0
            ? `Codex process failed. ${stderr}`
            : "Codex JSONL protocol ended without a terminal event.",
        );
      }
      const safeResult = redactAndLimit(finalResponse, this.redact, MAX_RESULT_CHARACTERS);
      const resultDigest = createHash("sha256").update(safeResult.text, "utf8").digest("hex");
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
      const failure = safeFailure(error, active.cancellationReason);
      const state = this.states.get(input.runId);
      if (state) {
        state.status = failure.code === "cancelled" ? "cancelled" : failure.code === "timeout" ? "timed_out" : "failed";
        state.completedAt = this.clock().toISOString();
        state.errorCode = failure.code;
      }
      yield { type: "failed", runId: input.runId, ...failure };
    } finally {
      clearTimeout(timeout);
      if (!managed.child.killed && managed.child.exitCode === null) {
        active.cancellationReason ??= "cancelled";
        await this.terminateTree(managed.child);
      }
      this.activeRuns.delete(input.runId);
    }
  }

  async cancel(runId: string): Promise<CancelReceipt> {
    const active = this.activeRuns.get(runId);
    const state = this.states.get(runId);
    if (!active || !state || state.status !== "running") {
      return { runId, accepted: false, status: state?.status ?? "unknown" };
    }
    active.cancellationReason = "cancelled";
    state.status = "cancelling";
    await this.terminateTree(active.process.child);
    return { runId, accepted: true, status: "cancelling" };
  }

  async inspect(runId: string): Promise<ProviderRunState> {
    const state = this.states.get(runId);
    return state
      ? { ...state }
      : { runId, providerRunId: null, status: "unknown", startedAt: null, completedAt: null, errorCode: null };
  }
}
