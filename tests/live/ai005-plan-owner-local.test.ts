import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { z } from "zod";
import { afterAll, describe, expect, it } from "vitest";

import { CodexCliProvider } from "../../src/server/execution/codex-cli-provider";
import { implementationPlanSchema } from "../../src/server/planning/contracts";
import { hasPlanErrors, validateImplementationPlan } from "../../src/server/planning/validate-plan";
import { createAI003WorkspaceFixture } from "../helpers/ai003-fixtures";

const fixture = createAI003WorkspaceFixture();
const provider = new CodexCliProvider({
  enabled: true,
  allowedWorkspaceRoot: fixture.root,
  forbiddenWorkspacePaths: [process.cwd()],
});

afterAll(() => fixture.cleanup());

describe("AI005 Codex owner-local planning contract", () => {
  it("returns a schema-valid, acyclic plan without modifying the fixture", async () => {
    await expect(provider.preflight()).resolves.toMatchObject({ status: "ready", authMode: "chatgpt" });
    let resultText: string | null = null;
    for await (const event of provider.start({
      runId: randomUUID(),
      workspacePath: fixture.workspace,
      prompt: [
        "Read the synthetic README without editing files or using network tools.",
        "Return a minimal Romanian implementation plan for adding a docs/status.md file.",
        "Use IDs REQ-DOCS, AC-DOCS, CMP-DOCS and TASK-DOCS.",
        "The task fileScopes must be docs/status.md, verificationCommands must contain test, and evidenceRequired must contain diff, checks, independent_review and secret_scan.",
        "Use no blockers, no architecture edges and exactly one client step. Return only JSON.",
      ].join("\n"),
      outputSchema: z.toJSONSchema(implementationPlanSchema) as Record<string, unknown>,
      timeoutMs: 180_000,
      capabilityGrant: { sandboxMode: "read-only", networkAccess: false, webSearch: "disabled", approvalPolicy: "never" },
    })) {
      if (event.type === "completed") resultText = event.resultText;
      if (event.type === "failed" || event.type === "blocked") throw new Error(event.detail);
    }
    const plan = implementationPlanSchema.parse(JSON.parse(resultText ?? ""));
    expect(hasPlanErrors(validateImplementationPlan(plan))).toBe(false);
    expect(execFileSync("git", ["status", "--short"], { cwd: fixture.workspace, encoding: "utf8" })).toBe("");
  });
});
