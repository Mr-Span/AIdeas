import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { WorkspacePolicyError } from "./workspace-policy";

function isInside(parent: string, candidate: string) {
  const fromParent = relative(
    resolve(/* turbopackIgnore: true */ parent),
    resolve(/* turbopackIgnore: true */ candidate),
  );
  return (
    fromParent === "" ||
    (!fromParent.startsWith("..") && !isAbsolute(fromParent))
  );
}

function git(
  cwd: string,
  args: readonly string[],
  timeout = 30_000,
): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      "git",
      [...args],
      { cwd, encoding: "utf8", timeout, windowsHide: true },
      (error, stdout) => {
        if (error) {
          rejectPromise(new WorkspacePolicyError("Git worktree operation failed."));
          return;
        }
        resolvePromise(stdout.trim());
      },
    );
  });
}

export type ExecutionWorkspace = {
  path: string;
  baseCommit: string;
  mainHeadBefore: string;
  mainStatusBefore: string;
};

export class WorkspaceSupervisor {
  readonly sourceRepository: string;
  readonly workspaceRoot: string;

  constructor(input: { sourceRepository: string; workspaceRoot: string }) {
    this.sourceRepository = resolve(
      /* turbopackIgnore: true */ input.sourceRepository,
    );
    this.workspaceRoot = resolve(
      /* turbopackIgnore: true */ input.workspaceRoot,
    );
    if (isInside(this.sourceRepository, this.workspaceRoot)) {
      throw new WorkspacePolicyError(
        "Execution worktrees must live outside the protected checkout.",
      );
    }
  }

  async create(input: {
    runId: string;
    contextMarkdown: string;
    contextFileName?: "AIDEAS_RESEARCH_CONTEXT.md" | "AIDEAS_PLAN_CONTEXT.md" | "AIDEAS_TASK_CONTEXT.md";
  }) {
    if (!/^[a-f0-9-]{36}$/i.test(input.runId)) {
      throw new WorkspacePolicyError("Run identifier is not valid for a worktree.");
    }
    await mkdir(/* turbopackIgnore: true */ this.workspaceRoot, {
      recursive: true,
    });
    const workspacePath = join(
      /* turbopackIgnore: true */ this.workspaceRoot,
      input.runId,
    );
    if (!isInside(this.workspaceRoot, workspacePath)) {
      throw new WorkspacePolicyError("Execution worktree escaped its root.");
    }

    const [mainHeadBefore, mainStatusBefore] = await Promise.all([
      git(this.sourceRepository, ["rev-parse", "HEAD"]),
      git(this.sourceRepository, ["status", "--short"]),
    ]);
    await git(this.sourceRepository, [
      "worktree",
      "add",
      "--detach",
      workspacePath,
      mainHeadBefore,
    ]);
    try {
      await writeFile(
        join(
          /* turbopackIgnore: true */ workspacePath,
          input.contextFileName ?? "AIDEAS_RESEARCH_CONTEXT.md",
        ),
        input.contextMarkdown,
        { encoding: "utf8", flag: "wx" },
      );
    } catch (error) {
      await this.remove(workspacePath).catch(() => undefined);
      throw error;
    }
    return {
      path: workspacePath,
      baseCommit: mainHeadBefore,
      mainHeadBefore,
      mainStatusBefore,
    } satisfies ExecutionWorkspace;
  }

  async verifyProtectedCheckout(workspace: ExecutionWorkspace) {
    const [mainHeadAfter, mainStatusAfter] = await Promise.all([
      git(this.sourceRepository, ["rev-parse", "HEAD"]),
      git(this.sourceRepository, ["status", "--short"]),
    ]);
    return {
      unchanged:
        mainHeadAfter === workspace.mainHeadBefore &&
        mainStatusAfter === workspace.mainStatusBefore,
      mainHeadBefore: workspace.mainHeadBefore,
      mainHeadAfter,
      mainStatusBefore: workspace.mainStatusBefore,
      mainStatusAfter,
      baseCommit: workspace.baseCommit,
    };
  }

  async adopt(workspacePath: string): Promise<ExecutionWorkspace> {
    const target = resolve(/* turbopackIgnore: true */ workspacePath);
    if (!isInside(this.workspaceRoot, target) || target === this.workspaceRoot) {
      throw new WorkspacePolicyError("Refusing to adopt an unmanaged worktree.");
    }
    const [baseCommit, mainHeadBefore, mainStatusBefore] = await Promise.all([
      git(target, ["rev-parse", "HEAD"]),
      git(this.sourceRepository, ["rev-parse", "HEAD"]),
      git(this.sourceRepository, ["status", "--short"]),
    ]);
    return {
      path: target,
      baseCommit,
      mainHeadBefore,
      mainStatusBefore,
    };
  }

  async remove(workspacePath: string) {
    const target = resolve(/* turbopackIgnore: true */ workspacePath);
    if (!isInside(this.workspaceRoot, target) || target === this.workspaceRoot) {
      throw new WorkspacePolicyError("Refusing to remove an unmanaged worktree.");
    }
    await git(this.sourceRepository, ["worktree", "remove", "--force", target]);
    await git(this.sourceRepository, ["worktree", "prune"]);
    await rm(/* turbopackIgnore: true */ target, {
      recursive: true,
      force: true,
    });
  }
}
