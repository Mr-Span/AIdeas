import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export class WorkspacePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePolicyError";
  }
}

function isInside(parent: string, candidate: string) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent))
  );
}

export async function validateExecutionWorkspace(options: {
  allowedRoot: string;
  workspacePath: string;
  forbiddenPaths?: readonly string[];
}) {
  const root = await realpath(resolve(options.allowedRoot));
  const requested = resolve(options.workspacePath);
  const requestedMetadata = await lstat(requested).catch(() => null);

  if (!requestedMetadata?.isDirectory() || requestedMetadata.isSymbolicLink()) {
    throw new WorkspacePolicyError("Workspace must be a real directory.");
  }

  const workspace = await realpath(requested);
  if (!isInside(root, workspace)) {
    throw new WorkspacePolicyError("Workspace is outside the allowed root.");
  }

  for (const forbiddenPath of options.forbiddenPaths ?? []) {
    const forbidden = await realpath(resolve(forbiddenPath)).catch(() => null);
    if (forbidden && isInside(forbidden, workspace)) {
      throw new WorkspacePolicyError("Workspace overlaps a protected checkout.");
    }
  }

  const gitMarker = await lstat(resolve(workspace, ".git")).catch(() => null);
  if (!gitMarker || (!gitMarker.isDirectory() && !gitMarker.isFile())) {
    throw new WorkspacePolicyError("Workspace is not a Git repository or worktree.");
  }

  const projectCodexConfig = await lstat(resolve(workspace, ".codex")).catch(
    () => null,
  );
  if (projectCodexConfig) {
    throw new WorkspacePolicyError(
      "Workspace contains project-scoped Codex configuration.",
    );
  }

  return workspace;
}
