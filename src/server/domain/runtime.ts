import { ProjectService } from "./project-service";
import { defaultDataRoot, getControlStore } from "@/server/storage/runtime";

type ServiceRegistry = Map<string, ProjectService>;

const serviceRegistryKey = Symbol.for("aideas.project-service.registry");
const globalWithServices = globalThis as typeof globalThis & {
  [serviceRegistryKey]?: ServiceRegistry;
};

export function getProjectService(dataRoot = defaultDataRoot()) {
  if (!globalWithServices[serviceRegistryKey]) {
    globalWithServices[serviceRegistryKey] = new Map();
  }
  const services = globalWithServices[serviceRegistryKey];
  const existing = services.get(dataRoot);
  if (existing?.store.database.isOpen) return existing;
  const service = new ProjectService(getControlStore(dataRoot));
  services.set(dataRoot, service);
  return service;
}
