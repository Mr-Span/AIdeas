import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { defaultDataRoot, getControlStore } from "@/server/storage/runtime";

import { WorkExecutor } from "./work-executor";

type Registry = Map<string, WorkExecutor>;
const registryKey = Symbol.for("aideas.work-executor.registry");
const globalWithRegistry = globalThis as typeof globalThis & { [registryKey]?: Registry };

export function getWorkExecutor(dataRoot = defaultDataRoot()) {
  globalWithRegistry[registryKey] ??= new Map();
  const key = resolve(dataRoot);
  const existing = globalWithRegistry[registryKey].get(key);
  if (existing) return existing;
  const mainRepositoryPath = process.env.AIDEAS_REPOSITORY_ROOT ?? execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", windowsHide: true }).trim();
  const service = new WorkExecutor({
    store: getControlStore(key),
    allowedWorkspaceRoot: resolve(process.env.AIDEAS_EXECUTION_ROOT ?? join(tmpdir(), "aideas-execution")),
    protectedWorkspacePaths: [mainRepositoryPath],
    mainRepositoryPath,
  });
  globalWithRegistry[registryKey].set(key, service);
  return service;
}
