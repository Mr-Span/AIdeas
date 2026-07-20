import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { getProjectService } from "@/server/domain/runtime";
import { defaultDataRoot, getControlStore } from "@/server/storage/runtime";

import { ExecutionBroker } from "./broker";

type BrokerRegistry = Map<string, ExecutionBroker>;

const registryKey = Symbol.for("aideas.execution-broker.registry");
const globalWithRegistry = globalThis as typeof globalThis & {
  [registryKey]?: BrokerRegistry;
};

export function getExecutionBroker(dataRoot = defaultDataRoot()) {
  if (!globalWithRegistry[registryKey]) {
    globalWithRegistry[registryKey] = new Map();
  }
  const key = resolve(dataRoot);
  const registry = globalWithRegistry[registryKey];
  const existing = registry.get(key);
  if (existing) return existing;

  const mainRepositoryPath =
    process.env.AIDEAS_REPOSITORY_ROOT ??
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  const broker = new ExecutionBroker({
    store: getControlStore(key),
    projectService: getProjectService(key),
    allowedWorkspaceRoot: resolve(
      process.env.AIDEAS_EXECUTION_ROOT ?? join(tmpdir(), "aideas-execution"),
    ),
    protectedWorkspacePaths: [mainRepositoryPath],
    mainRepositoryPath,
  });
  registry.set(key, broker);
  return broker;
}
