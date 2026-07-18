import { join, resolve } from "node:path";

import { ControlStore } from "./control-store";

type StoreRegistry = Map<string, ControlStore>;

const registryKey = Symbol.for("aideas.control-store.registry");
const globalWithRegistry = globalThis as typeof globalThis & {
  [registryKey]?: StoreRegistry;
};

function registry() {
  if (!globalWithRegistry[registryKey]) {
    globalWithRegistry[registryKey] = new Map();
  }
  return globalWithRegistry[registryKey];
}

export function defaultDataRoot() {
  const localDataRoot = join(
    /* turbopackIgnore: true */ process.cwd(),
    ".aideas",
  );
  return resolve(
    /* turbopackIgnore: true */ process.env.AIDEAS_DATA_DIR ?? localDataRoot,
  );
}

export function getControlStore(dataRoot = defaultDataRoot()) {
  const key = resolve(/* turbopackIgnore: true */ dataRoot);
  const stores = registry();
  const existing = stores.get(key);
  if (existing?.database.isOpen) return existing;

  const store = new ControlStore({ dataRoot: key });
  stores.set(key, store);
  return store;
}

export function closeControlStore(dataRoot = defaultDataRoot()) {
  const key = resolve(/* turbopackIgnore: true */ dataRoot);
  const store = registry().get(key);
  if (!store) return;
  store.close();
  registry().delete(key);
}
