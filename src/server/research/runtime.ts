import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { getProjectService } from "@/server/domain/runtime";
import { defaultDataRoot, getControlStore } from "@/server/storage/runtime";

import { ResearchRoundService } from "./round-service";

type Registry = Map<string, ResearchRoundService>;
const registryKey = Symbol.for("aideas.research-round.registry");
const globalWithRegistry = globalThis as typeof globalThis & {
  [registryKey]?: Registry;
};

export function getResearchRoundService(dataRoot = defaultDataRoot()) {
  globalWithRegistry[registryKey] ??= new Map();
  const key = resolve(dataRoot);
  const existing = globalWithRegistry[registryKey].get(key);
  if (existing) return existing;
  const mainRepositoryPath =
    process.env.AIDEAS_REPOSITORY_ROOT ??
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  const service = new ResearchRoundService({
    store: getControlStore(key),
    projectService: getProjectService(key),
    allowedWorkspaceRoot: resolve(
      process.env.AIDEAS_EXECUTION_ROOT ?? join(tmpdir(), "aideas-execution"),
    ),
    protectedWorkspacePaths: [mainRepositoryPath],
    mainRepositoryPath,
  });
  globalWithRegistry[registryKey].set(key, service);
  return service;
}
