import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ControlStore } from "../../src/server/storage/control-store";
import { ProjectService } from "../../src/server/domain/project-service";

export type AI002TestFixture = {
  root: string;
  store: ControlStore;
  service: ProjectService;
  cleanup: () => void;
};

type TestFixtureOptions = {
  clock?: () => Date;
  idFactory?: () => string;
};

function createDeterministicIdFactory() {
  let counter = 0;
  return () => {
    const seed = String(counter++).padStart(12, "0");
    return `00000000-0000-0000-0000-${seed}`;
  };
}

export function createTestFixture(options: TestFixtureOptions = {}): AI002TestFixture {
  const root = mkdtempSync(join(tmpdir(), "aideas-ai002-"));
  const store = new ControlStore({ dataRoot: root });
  const service = new ProjectService(store, {
    clock: options.clock,
    idFactory: options.idFactory ?? createDeterministicIdFactory(),
  });

  return {
    root,
    store,
    service,
    cleanup: () => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
