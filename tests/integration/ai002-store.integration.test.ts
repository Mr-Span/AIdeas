import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { TextDecoder, TextEncoder } from "node:util";

import { describe, expect, it } from "vitest";

import { ProjectService } from "../../src/server/domain/project-service";
import { ControlStore } from "../../src/server/storage/control-store";
import { createTestFixture } from "../helpers/ai002-fixtures";

describe("AI-002 control-store integration contracts", () => {
  it("backs up and restores SQLite, media, and public collaboration atomically", async () => {
    const source = createTestFixture();
    const backupPath = join(source.root, "backup.bundle");

    try {
      const project = source.service.createProject({
        displayName: "Backup Test",
        idempotencyKey: "create-backup",
      });
      const projectId = project.project.id;
      const mediaBody = "client-media-body";
      const saved = source.service.saveDraft({
        projectId,
        expectedVersion: 0,
        idempotencyKey: "save-backup",
        actorKind: "client",
        idea: "Persistent idea",
        notes: "",
        approvalRequired: false,
        media: [
          {
            bytes: new TextEncoder().encode(mediaBody),
            displayName: "client-reference.txt",
            mediaType: "text/plain",
          },
        ],
      });
      source.service.appendPublicCollaboration({
        projectId,
        idempotencyKey: "public-backup",
        actorKind: "client",
        entryKind: "message",
        body: "Public backup message",
      });

      const backedUp = await source.service.backupTo(backupPath);
      expect(backedUp).toBe(backupPath);
      source.store.close();

      const restoreParent = mkdtempSync(join(tmpdir(), "aideas-ai002-restore-"));
      const restoreRoot = join(restoreParent, "restored-data");
      try {
        const restoredStore = ControlStore.restoreFromBackup({
          backupPath,
          dataRoot: restoreRoot,
        });
        const restoredService = new ProjectService(restoredStore);
        const restoredProjection = restoredService.getClientProjection(projectId);

        expect(restoredProjection.id).toBe(projectId);
        expect(restoredProjection.version).toBe(1);
        expect(restoredProjection.collaboration).toHaveLength(1);
        expect(restoredProjection.collaboration[0]?.body).toBe(
          "Public backup message",
        );
        const mediaRow = restoredStore.database
          .prepare("SELECT storage_key FROM artifacts WHERE digest = ?")
          .get(saved.artifactDigests[1]) as { storage_key: string };
        expect(
          new TextDecoder().decode(
            restoredStore.artifacts.read(mediaRow.storage_key),
          ),
        ).toBe(mediaBody);
        expect(restoredStore.integrityCheck()).toEqual(["ok"]);
        expect(restoredService.diagnostics().projects).toBe(1);
        restoredStore.close();
      } finally {
        rmSync(restoreParent, { recursive: true, force: true });
      }
    } finally {
      source.cleanup();
    }
  });

  it("reconciles missing and orphaned artifacts safely", () => {
    const serviceFixture = createTestFixture();
    try {
      const project = serviceFixture.service.createProject({
        displayName: "Reconcile",
        idempotencyKey: "create-reconcile",
      });
      const projectId = project.project.id;
      serviceFixture.service.saveDraft({
        projectId,
        expectedVersion: 0,
        idempotencyKey: "save-reconcile",
        actorKind: "client",
        idea: "Reconcile idea",
        notes: "",
        approvalRequired: false,
      });

      const artifactRow = serviceFixture.store.database
        .prepare("SELECT digest, storage_key FROM artifacts ORDER BY storage_key LIMIT 1")
        .get() as { digest: string; storage_key: string };

      const missingTarget = join(
        serviceFixture.store.artifacts.root,
        ...artifactRow.storage_key.split("/"),
      );
      rmSync(missingTarget, { force: true });
      const firstPass = serviceFixture.service.reconcile();
      expect(firstPass.missingDigests).toContain(artifactRow.digest);

      const orphanDigest = createHash("sha256")
        .update("orphan-artifact-content")
        .digest("hex");
      const orphanTarget = join(
        serviceFixture.store.artifacts.root,
        "sha256",
        orphanDigest.slice(0, 2),
        orphanDigest,
      );
      mkdirSync(dirname(orphanTarget), { recursive: true });
      writeFileSync(orphanTarget, "orphan");
      const listedDigests = serviceFixture.store.artifacts.listDigests();
      expect(listedDigests).toContain(orphanDigest);

      const secondPass = serviceFixture.service.reconcile();
      expect(secondPass.orphanDigests).toContain(orphanDigest);
      expect(secondPass.missingDigests).toContain(artifactRow.digest);
    } finally {
      serviceFixture.cleanup();
    }
  });
});
