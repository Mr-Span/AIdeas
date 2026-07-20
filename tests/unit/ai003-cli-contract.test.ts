import { describe, expect, it } from "vitest";

import {
  buildCodexCliArguments,
  isSupportedCodexCliVersion,
  parseCodexJsonLine,
} from "../../src/server/execution/codex-cli-provider";

describe("Codex CLI compatibility boundary", () => {
  it("accepts only the explicitly validated CLI minor window", () => {
    expect(isSupportedCodexCliVersion("codex-cli 0.144.5")).toBe(true);
    expect(isSupportedCodexCliVersion("codex-cli 0.145.0-alpha.18")).toBe(true);
    expect(isSupportedCodexCliVersion("codex-cli 0.146.0")).toBe(false);
    expect(isSupportedCodexCliVersion("unexpected")).toBe(false);
  });

  it("accepts object JSONL events and rejects malformed protocol lines", () => {
    expect(
      parseCodexJsonLine(
        '{"type":"thread.started","thread_id":"thread-fixture"}',
      ),
    ).toEqual({ type: "thread.started", thread_id: "thread-fixture" });
    expect(() => parseCodexJsonLine("not json")).toThrow(
      "Codex JSONL protocol parse failure.",
    );
    expect(() => parseCodexJsonLine("[]")).toThrow(
      "Codex JSONL protocol parse failure.",
    );
    expect(() => parseCodexJsonLine('{"value":1}')).toThrow(
      "Codex JSONL protocol parse failure.",
    );
  });

  it("reapplies the server capability grant when a CLI thread resumes", () => {
    const args = buildCodexCliArguments(
      {
        runId: "00000000-0000-4000-8000-000000000044",
        providerRunId: "00000000-0000-4000-8000-000000000088",
        workspacePath: "C:\\synthetic-worktree",
        prompt: "Continue the synthetic analysis.",
        timeoutMs: 30_000,
        capabilityGrant: {
          sandboxMode: "read-only",
          networkAccess: false,
          webSearch: "disabled",
          approvalPolicy: "never",
        },
      },
      "00000000-0000-4000-8000-000000000088",
    );
    expect(args).toContain('sandbox_mode="read-only"');
    expect(args).toContain("sandbox_workspace_write.network_access=false");
    expect(args).toContain('web_search="disabled"');
    expect(args).not.toContain("--dangerously-bypass-approvals-and-sandbox");
  });
});
