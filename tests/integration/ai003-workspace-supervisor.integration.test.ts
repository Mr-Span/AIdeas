import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { WorkspaceSupervisor } from "../../src/server/execution/workspace-supervisor";
import { createAI003WorkspaceFixture } from "../helpers/ai003-fixtures";

describe("AI003 workspace supervisor", () => {
  it("creates and removes an external detached worktree without mutating main", async () => {
    const source = createAI003WorkspaceFixture();
    const externalRoot = mkdtempSync(join(tmpdir(), "aideas-worktrees-"));
    const supervisor = new WorkspaceSupervisor({
      sourceRepository: source.workspace,
      workspaceRoot: externalRoot,
    });
    const runId = "00000000-0000-4000-8000-000000000033";
    try {
      const workspace = await supervisor.create({
        runId,
        contextMarkdown: "# Synthetic research context\n",
      });
      expect(
        readFileSync(join(workspace.path, "AIDEAS_RESEARCH_CONTEXT.md"), "utf8"),
      ).toContain("Synthetic research context");
      expect(await supervisor.verifyProtectedCheckout(workspace)).toMatchObject({
        unchanged: true,
      });
      const adopted = await supervisor.adopt(workspace.path);
      expect(adopted).toMatchObject({
        path: workspace.path,
        baseCommit: workspace.baseCommit,
      });
      expect(await supervisor.verifyProtectedCheckout(adopted)).toMatchObject({
        unchanged: true,
      });
      await supervisor.remove(workspace.path);
      expect(
        execFileSync("git", ["status", "--short"], {
          cwd: source.workspace,
          encoding: "utf8",
        }),
      ).toBe("");
    } finally {
      source.cleanup();
      rmSync(externalRoot, { recursive: true, force: true });
    }
  });

  it("rejects a worktree root inside the protected checkout", () => {
    const source = createAI003WorkspaceFixture();
    try {
      expect(
        () =>
          new WorkspaceSupervisor({
            sourceRepository: source.workspace,
            workspaceRoot: join(source.workspace, ".runs"),
          }),
      ).toThrow("outside the protected checkout");
    } finally {
      source.cleanup();
    }
  });
});
