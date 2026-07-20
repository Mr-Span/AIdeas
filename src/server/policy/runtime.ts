import { defaultDataRoot, getControlStore } from "@/server/storage/runtime";

import { ActionPolicyService } from "./action-service";

type Registry = Map<string, ActionPolicyService>;
const registryKey = Symbol.for("aideas.action-policy.registry");
const globalWithRegistry = globalThis as typeof globalThis & { [registryKey]?: Registry };

export function getActionPolicyService(dataRoot = defaultDataRoot()) {
  globalWithRegistry[registryKey] ??= new Map();
  const existing = globalWithRegistry[registryKey].get(dataRoot);
  if (existing) return existing;
  const service = new ActionPolicyService(getControlStore(dataRoot));
  globalWithRegistry[registryKey].set(dataRoot, service);
  return service;
}
