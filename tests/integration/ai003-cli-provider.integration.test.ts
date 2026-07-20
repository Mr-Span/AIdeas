import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { describe, expect, it } from "vitest";

import { CodexCliProvider } from "../../src/server/execution/codex-cli-provider";
import type { ManagedProcess } from "../../src/server/execution/process-supervisor";
import { createAI003WorkspaceFixture } from "../helpers/ai003-fixtures";

function fakeChildProcess() {
  const emitter = new EventEmitter() as ChildProcessWithoutNullStreams;
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  Object.assign(emitter, {
    stdin,
    stdout,
    stderr,
    pid: 4242,
    killed: false,
    exitCode: null,
    signalCode: null,
    kill() {
      Object.assign(emitter, { killed: true, exitCode: 1 });
      emitter.emit("exit", 1, null);
      return true;
    },
  });
  let resolveExit!: ManagedProcess extends { exit: Promise<infer T> }
    ? (value: T) => void
    : never;
  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolvePromise) => {
      resolveExit = resolvePromise;
    },
  );
  return {
    process: { child: emitter, exit },
    stdout,
    terminate() {
      Object.assign(emitter, { killed: true, exitCode: 1 });
      stdout.end();
      resolveExit({ code: 1, signal: null });
    },
  };
}

describe("Codex CLI provider process boundary", () => {
  it("uses the injected process-tree terminator for cancellation", async () => {
    const fixture = createAI003WorkspaceFixture();
    const fake = fakeChildProcess();
    let terminated = false;
    const provider = new CodexCliProvider({
      enabled: true,
      allowedWorkspaceRoot: fixture.root,
      forbiddenWorkspacePaths: [process.cwd()],
      command: "codex-fixture",
      probe: async () => ({
        provider: "codex",
        status: "ready",
        version: "codex-cli 0.145.0-alpha.18",
        authMode: "chatgpt",
        detail: "Synthetic ready state.",
      }),
      processFactory: () => {
        queueMicrotask(() => {
          fake.stdout.write(
            '{"type":"thread.started","thread_id":"thread-cli-fixture"}\n',
          );
        });
        return fake.process;
      },
      terminateTree: async () => {
        terminated = true;
        fake.terminate();
      },
    });
    const runId = "00000000-0000-4000-8000-000000000044";
    const iterator = provider
      .start({
        runId,
        workspacePath: fixture.workspace,
        prompt: "Inspect synthetic content.",
        timeoutMs: 30_000,
        capabilityGrant: {
          sandboxMode: "read-only",
          networkAccess: false,
          webSearch: "disabled",
          approvalPolicy: "never",
        },
      })
      [Symbol.asyncIterator]();
    try {
      await expect(iterator.next()).resolves.toMatchObject({
        value: { type: "process_started", processId: 4242 },
      });
      await expect(iterator.next()).resolves.toMatchObject({
        value: { type: "started", providerRunId: "thread-cli-fixture" },
      });
      await expect(provider.cancel(runId)).resolves.toEqual({
        runId,
        accepted: true,
        status: "cancelling",
      });
      expect(terminated).toBe(true);
      await expect(iterator.next()).resolves.toMatchObject({
        value: { type: "failed", code: "cancelled" },
      });
    } finally {
      fixture.cleanup();
    }
  });
});
