import { execFileSync } from "node:child_process";

import { getActionPolicyService } from "@/server/policy/runtime";
import { defaultDataRoot, getControlStore } from "@/server/storage/runtime";

import { CliGitHubAdapter } from "./github-adapter";
import { IntegrationService } from "./integration-service";

type Registry = Map<string, IntegrationService>;
const registryKey = Symbol.for("aideas.integration-service.registry");
const globalWithRegistry = globalThis as typeof globalThis & { [registryKey]?: Registry };

export function getIntegrationService(dataRoot = defaultDataRoot()) {
  globalWithRegistry[registryKey] ??= new Map();
  const existing = globalWithRegistry[registryKey].get(dataRoot);
  if (existing) return existing;
  const repositoryPath = process.env.AIDEAS_REPOSITORY_ROOT ?? execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", windowsHide: true }).trim();
  const service = new IntegrationService(
    getControlStore(dataRoot),
    getActionPolicyService(dataRoot),
    new CliGitHubAdapter(repositoryPath),
  );
  globalWithRegistry[registryKey].set(dataRoot, service);
  return service;
}
