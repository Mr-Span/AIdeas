import { describe, expect, it } from "vitest";

import {
  capabilityGrantSchema,
  executionEventSchema,
  executionStartSchema,
} from "../../src/server/execution/contracts";
import {
  buildCodexEnvironment,
} from "../../src/server/execution/codex-local-probe";
import {
  createRedactor,
  redactAndLimit,
  REDACTION_MARKER,
} from "../../src/server/execution/redaction";

const runId = "00000000-0000-4000-8000-000000000003";

describe("AI-003 execution contracts", () => {
  it("accepts the least-privilege owner-local request", () => {
    const request = executionStartSchema.parse({
      runId,
      workspacePath: "C:\\synthetic-fixture",
      prompt: "Inspect the synthetic fixture without changing it.",
      timeoutMs: 30_000,
      capabilityGrant: {
        sandboxMode: "read-only",
        networkAccess: false,
        webSearch: "disabled",
        approvalPolicy: "never",
      },
    });

    expect(request.capabilityGrant).toEqual(
      capabilityGrantSchema.parse(request.capabilityGrant),
    );
  });

  it("rejects unbounded timeouts and approval-capable requests", () => {
    expect(() =>
      executionStartSchema.parse({
        runId,
        workspacePath: "fixture",
        prompt: "Inspect",
        timeoutMs: 31 * 60 * 1_000,
        capabilityGrant: {
          sandboxMode: "read-only",
          networkAccess: false,
          webSearch: "disabled",
          approvalPolicy: "on-request",
        },
      }),
    ).toThrow();
  });

  it("validates normalized terminal events", () => {
    const event = executionEventSchema.parse({
      type: "completed",
      runId,
      providerRunId: "thread-1",
      resultText: "safe result",
      resultDigest: "a".repeat(64),
      truncated: false,
    });
    expect(event.type).toBe("completed");
  });
});

describe("AI-003 secret boundary", () => {
  it("redacts exact canaries and common credential shapes", () => {
    const canary = "canary-owner-secret";
    const redact = createRedactor([canary]);
    const output = redact(
      `value=${canary} OPENAI_API_KEY=sk-example123456789 Bearer abc.def.ghi123456`,
    );

    expect(output).not.toContain(canary);
    expect(output).not.toContain("sk-example");
    expect(output).not.toContain("abc.def");
    expect(output.match(/\[REDACTED\]/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it("redacts before applying output bounds", () => {
    const redact = createRedactor(["private-value"]);
    const output = redactAndLimit("private-value and more text", redact, 10);
    expect(output.text).toContain(REDACTION_MARKER.slice(0, 10));
    expect(output.text).not.toContain("private-value");
    expect(output.truncated).toBe(true);
  });

  it("builds an allowlisted child environment without provider keys", () => {
    const environment = buildCodexEnvironment({
      PATH: "safe-path",
      USERPROFILE: "safe-profile",
      CODEX_HOME: "safe-codex-home",
      OPENAI_API_KEY: "must-not-cross",
      CODEX_ACCESS_TOKEN: "must-not-cross",
      ANTHROPIC_API_KEY: "must-not-cross",
    });

    expect(environment).toEqual({
      CODEX_HOME: "safe-codex-home",
      PATH: "safe-path",
      USERPROFILE: "safe-profile",
    });
  });
});
