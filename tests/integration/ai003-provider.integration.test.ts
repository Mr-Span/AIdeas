import type {
  ThreadEvent,
  TurnOptions,
} from "@openai/codex-sdk";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CodexSdkProvider,
  type CodexSdkProviderOptions,
} from "../../src/server/execution/codex-sdk-provider";
import type { ExecutionEvent } from "../../src/server/execution/contracts";
import { createAI003WorkspaceFixture } from "../helpers/ai003-fixtures";

const fixtures: Array<ReturnType<typeof createAI003WorkspaceFixture>> = [];
const runId = "00000000-0000-4000-8000-000000000003";

afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup();
});

function fixture() {
  const value = createAI003WorkspaceFixture();
  fixtures.push(value);
  return value;
}

function readyProbe() {
  return Promise.resolve({
    provider: "codex" as const,
    status: "ready" as const,
    version: "codex-cli fixture",
    authMode: "chatgpt" as const,
    detail: "Synthetic ready state.",
  });
}

function clientFromGenerator(
  generate: (options?: TurnOptions) => AsyncGenerator<ThreadEvent>,
) {
  return {
    startThread() {
      return {
        id: null,
        async runStreamed(_input: string, options?: TurnOptions) {
          return { events: generate(options) };
        },
      };
    },
  };
}

function provider(
  options: Pick<CodexSdkProviderOptions, "codex"> &
    Partial<Omit<CodexSdkProviderOptions, "codex">>,
) {
  const workspace = fixture();
  return {
    workspace,
    provider: new CodexSdkProvider({
      enabled: true,
      allowedWorkspaceRoot: workspace.root,
      forbiddenWorkspacePaths: [process.cwd()],
      probe: readyProbe,
      ...options,
    }),
  };
}

function request(workspacePath: string, timeoutMs = 30_000) {
  return {
    runId,
    workspacePath,
    prompt: "Inspect the synthetic fixture.",
    timeoutMs,
    capabilityGrant: {
      sandboxMode: "read-only" as const,
      networkAccess: false,
      webSearch: "disabled" as const,
      approvalPolicy: "never" as const,
    },
  };
}

async function collect(stream: AsyncIterable<ExecutionEvent>) {
  const events: ExecutionEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe("CodexSdkProvider", () => {
  it("normalizes SDK events and never forwards command output or reasoning", async () => {
    const secret = "owner-secret-canary";
    const codex = clientFromGenerator(async function* () {
      yield { type: "thread.started", thread_id: "thread-fixture" };
      yield { type: "turn.started" };
      yield {
        type: "item.completed",
        item: { id: "reasoning", type: "reasoning", text: `private ${secret}` },
      };
      yield {
        type: "item.completed",
        item: {
          id: "command",
          type: "command_execution",
          command: `echo ${secret}`,
          aggregated_output: secret,
          exit_code: 0,
          status: "completed",
        },
      };
      yield {
        type: "item.completed",
        item: {
          id: "message",
          type: "agent_message",
          text: `Safe summary; canary=${secret}`,
        },
      };
      yield {
        type: "turn.completed",
        usage: {
          input_tokens: 12,
          cached_input_tokens: 2,
          output_tokens: 3,
          reasoning_output_tokens: 1,
        },
      };
    });
    const setup = provider({ codex, sensitiveValues: [secret] });

    const events = await collect(setup.provider.start(request(setup.workspace.workspace)));
    const serialized = JSON.stringify(events);

    expect(events.map((event) => event.type)).toEqual([
      "started",
      "tool",
      "message",
      "usage",
      "completed",
    ]);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("echo");
    expect(events.at(-1)).toMatchObject({
      type: "completed",
      providerRunId: "thread-fixture",
    });
    await expect(setup.provider.inspect(runId)).resolves.toMatchObject({
      status: "completed",
      providerRunId: "thread-fixture",
    });
  });

  it("cancels an active SDK turn through AbortSignal", async () => {
    const codex = clientFromGenerator(async function* (options) {
      yield { type: "thread.started", thread_id: "thread-cancel" };
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      await new Promise<void>((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });
    const setup = provider({ codex });
    const iterator = setup.provider.start(request(setup.workspace.workspace))[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toMatchObject({
      value: { type: "started", providerRunId: "thread-cancel" },
    });
    await expect(setup.provider.cancel(runId)).resolves.toEqual({
      runId,
      accepted: true,
      status: "cancelling",
    });
    await expect(iterator.next()).resolves.toMatchObject({
      value: { type: "failed", code: "cancelled", retryable: false },
    });
    await expect(setup.provider.inspect(runId)).resolves.toMatchObject({
      status: "cancelled",
      errorCode: "cancelled",
    });
  });

  it("maps timeout to a safe retryable failure", async () => {
    const codex = clientFromGenerator(async function* (options) {
      yield { type: "thread.started", thread_id: "thread-timeout" };
      await new Promise<void>((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });
    const setup = provider({ codex });
    const events = await collect(
      setup.provider.start(request(setup.workspace.workspace, 1_000)),
    );

    expect(events.at(-1)).toMatchObject({
      type: "failed",
      code: "timeout",
      retryable: true,
    });
    await expect(setup.provider.inspect(runId)).resolves.toMatchObject({
      status: "timed_out",
    });
  });

  it("blocks duplicate run identifiers", async () => {
    const codex = clientFromGenerator(async function* () {
      yield { type: "thread.started", thread_id: "thread-complete" };
      yield { type: "turn.started" };
      yield {
        type: "turn.completed",
        usage: {
          input_tokens: 0,
          cached_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
        },
      };
    });
    const setup = provider({ codex });
    await collect(setup.provider.start(request(setup.workspace.workspace)));
    const replay = await collect(setup.provider.start(request(setup.workspace.workspace)));
    expect(replay).toEqual([
      {
        type: "blocked",
        runId,
        code: "duplicate_run",
        detail: "A run with this identifier already exists.",
      },
    ]);
  });

  it("blocks workspaces outside the configured fixture root", async () => {
    const setup = provider({
      codex: clientFromGenerator(async function* () {
        throw new Error("must not start");
      }),
    });
    const events = await collect(setup.provider.start(request(process.cwd())));
    expect(events).toEqual([
      {
        type: "blocked",
        runId,
        code: "invalid_workspace",
        detail: "Workspace is outside the allowed root.",
      },
    ]);
  });

  it("blocks project-scoped Codex configuration in a fixture", async () => {
    const setup = provider({
      codex: clientFromGenerator(async function* () {
        throw new Error("must not start");
      }),
    });
    mkdirSync(join(setup.workspace.workspace, ".codex"));
    const events = await collect(
      setup.provider.start(request(setup.workspace.workspace)),
    );
    expect(events).toEqual([
      {
        type: "blocked",
        runId,
        code: "invalid_workspace",
        detail: "Workspace contains project-scoped Codex configuration.",
      },
    ]);
  });

  it("cancels the SDK turn when a stream consumer disconnects", async () => {
    let observedSignal: AbortSignal | undefined;
    const codex = clientFromGenerator(async function* (options) {
      observedSignal = options?.signal;
      yield { type: "thread.started", thread_id: "thread-disconnect" };
      yield { type: "turn.started" };
    });
    const setup = provider({ codex });

    for await (const event of setup.provider.start(request(setup.workspace.workspace))) {
      expect(event.type).toBe("started");
      break;
    }

    expect(observedSignal?.aborted).toBe(true);
    await expect(setup.provider.inspect(runId)).resolves.toMatchObject({
      status: "cancelled",
      errorCode: "cancelled",
    });
  });

  it("keeps owner-local execution disabled unless explicitly enabled", async () => {
    const workspace = fixture();
    const disabled = new CodexSdkProvider({
      enabled: false,
      allowedWorkspaceRoot: workspace.root,
      codex: clientFromGenerator(async function* () {
        throw new Error("must not start");
      }),
      probe: readyProbe,
    });
    await expect(disabled.preflight()).resolves.toMatchObject({
      status: "blocked",
      code: "disabled",
    });
    const events = await collect(disabled.start(request(workspace.workspace)));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "blocked", code: "disabled" });
  });
});
