import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  join,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import { ArtifactStore } from "@/server/artifacts/artifact-store";
import { DomainError } from "@/server/domain/errors";

import { migrations } from "./migrations";

export type ControlStoreOptions = {
  dataRoot: string;
};

type BackupArtifact = {
  digest: string;
  storageKey: string;
  byteLength: number;
};

type BackupManifest = {
  format: "aideas-backup";
  version: 1;
  createdAt: string;
  database: {
    file: "aideas.sqlite";
    sha256: string;
  };
  artifacts: BackupArtifact[];
};

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function safeDataRoot(input: string) {
  const dataRoot = resolve(input);
  if (dataRoot === parse(dataRoot).root) {
    throw new DomainError(
      "STORAGE_UNAVAILABLE",
      "Directorul de date este prea larg.",
      500,
    );
  }
  return dataRoot;
}

function assertInside(root: string, target: string) {
  const pathFromRoot = relative(resolve(root), resolve(target));
  if (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..")
  ) {
    return;
  }
  throw new DomainError(
    "STORAGE_UNAVAILABLE",
    "Backupul conține o cale invalidă.",
    409,
  );
}

function sha256File(filePath: string) {
  const digest = createHash("sha256");
  const handle = openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(handle, buffer, 0, buffer.byteLength, null);
      if (bytesRead) digest.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    closeSync(handle);
  }
  return digest.digest("hex");
}

function storageKeyForDigest(digest: string) {
  return `sha256/${digest.slice(0, 2)}/${digest}`;
}

function readArtifactRows(database: DatabaseSync): BackupArtifact[] {
  const rows = database
    .prepare(
      "SELECT digest, storage_key, byte_length FROM artifacts ORDER BY digest",
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => {
    const digest = String(row.digest);
    const storageKey = String(row.storage_key);
    const byteLength = Number(row.byte_length);
    if (
      !DIGEST_PATTERN.test(digest) ||
      storageKey !== storageKeyForDigest(digest) ||
      !Number.isSafeInteger(byteLength) ||
      byteLength < 0
    ) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Manifestul de artefacte din SQLite nu este valid.",
        409,
      );
    }
    return { digest, storageKey, byteLength };
  });
}

function parseBackupManifest(value: unknown): BackupManifest {
  if (!value || typeof value !== "object") {
    throw new DomainError("STORAGE_UNAVAILABLE", "Manifestul backupului lipsește.", 409);
  }
  const candidate = value as Partial<BackupManifest>;
  if (
    candidate.format !== "aideas-backup" ||
    candidate.version !== 1 ||
    !candidate.database ||
    candidate.database.file !== "aideas.sqlite" ||
    !DIGEST_PATTERN.test(candidate.database.sha256 ?? "") ||
    typeof candidate.createdAt !== "string" ||
    Number.isNaN(Date.parse(candidate.createdAt)) ||
    !Array.isArray(candidate.artifacts)
  ) {
    throw new DomainError(
      "STORAGE_UNAVAILABLE",
      "Manifestul backupului nu este valid.",
      409,
    );
  }

  const artifacts = candidate.artifacts.map((artifact) => {
    if (
      !artifact ||
      !DIGEST_PATTERN.test(artifact.digest) ||
      artifact.storageKey !== storageKeyForDigest(artifact.digest) ||
      !Number.isSafeInteger(artifact.byteLength) ||
      artifact.byteLength < 0
    ) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Manifestul backupului conține un artefact invalid.",
        409,
      );
    }
    return artifact;
  });
  if (new Set(artifacts.map((artifact) => artifact.digest)).size !== artifacts.length) {
    throw new DomainError(
      "STORAGE_UNAVAILABLE",
      "Manifestul backupului conține artefacte duplicate.",
      409,
    );
  }
  return candidate as BackupManifest;
}

function assertRegularBundleFile(bundleRoot: string, target: string) {
  assertInside(bundleRoot, target);
  if (!existsSync(target)) {
    throw new DomainError("NOT_FOUND", "Backupul este incomplet.", 404);
  }
  const entry = lstatSync(target);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new DomainError(
      "STORAGE_UNAVAILABLE",
      "Backupul conține o intrare de fișier invalidă.",
      409,
    );
  }
  assertInside(realpathSync.native(bundleRoot), realpathSync.native(target));
}

export class ControlStore {
  readonly dataRoot: string;
  readonly databasePath: string;
  readonly artifacts: ArtifactStore;
  readonly database: DatabaseSync;

  constructor(options: ControlStoreOptions) {
    this.dataRoot = safeDataRoot(options.dataRoot);
    mkdirSync(this.dataRoot, { recursive: true });
    this.databasePath = join(this.dataRoot, "aideas.sqlite");
    this.artifacts = new ArtifactStore(this.dataRoot);
    this.database = new DatabaseSync(this.databasePath, {
      allowExtension: false,
      defensive: true,
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    this.applyMigrations();
  }

  private applyMigrations() {
    const applied = this.database.prepare(
      "SELECT 1 AS present FROM schema_migrations WHERE version = ?",
    );
    const record = this.database.prepare(
      "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
    );

    for (const migration of migrations) {
      if (applied.get(migration.version)) continue;
      this.transaction(() => {
        this.database.exec(migration.sql);
        record.run(migration.version, new Date().toISOString());
      });
    }
  }

  transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      if (this.database.isTransaction) this.database.exec("ROLLBACK");
      throw error;
    }
  }

  integrityCheck() {
    return this.database
      .prepare("PRAGMA integrity_check")
      .all()
      .map((row) => String(row.integrity_check));
  }

  async backupTo(destination: string) {
    const resolvedDestination = safeDataRoot(destination);
    if (existsSync(resolvedDestination)) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Destinația backupului există deja sau este invalidă.",
        409,
      );
    }

    const parent = dirname(resolvedDestination);
    mkdirSync(parent, { recursive: true });
    const stagingRoot = join(
      parent,
      `.${basename(resolvedDestination)}.partial-${randomUUID()}`,
    );
    mkdirSync(stagingRoot, { recursive: false });

    try {
      const databaseBackupPath = join(stagingRoot, "aideas.sqlite");
      await backup(this.database, databaseBackupPath);

      const snapshot = new DatabaseSync(databaseBackupPath, { readOnly: true });
      let artifacts: BackupArtifact[];
      try {
        artifacts = readArtifactRows(snapshot);
      } finally {
        snapshot.close();
      }

      for (const artifact of artifacts) {
        if (!this.artifacts.exists(artifact.storageKey)) {
          throw new DomainError(
            "STORAGE_UNAVAILABLE",
            "Backupul nu poate continua deoarece lipsește un artefact.",
            409,
          );
        }
        const source = join(
          this.artifacts.root,
          ...artifact.storageKey.split("/"),
        );
        if (
          lstatSync(source).size !== artifact.byteLength ||
          sha256File(source) !== artifact.digest
        ) {
          throw new DomainError(
            "STORAGE_UNAVAILABLE",
            "Backupul nu poate continua deoarece un artefact este corupt.",
            409,
          );
        }
        const target = join(stagingRoot, "artifacts", ...artifact.storageKey.split("/"));
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target, fsConstants.COPYFILE_EXCL);
      }

      const manifest: BackupManifest = {
        format: "aideas-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        database: {
          file: "aideas.sqlite",
          sha256: sha256File(databaseBackupPath),
        },
        artifacts,
      };
      writeFileSync(
        join(stagingRoot, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      );
      renameSync(stagingRoot, resolvedDestination);
      return resolvedDestination;
    } catch (error) {
      rmSync(stagingRoot, { recursive: true, force: true });
      throw error;
    }
  }

  close() {
    if (this.database.isOpen) this.database.close();
  }

  static restoreFromBackup(input: { backupPath: string; dataRoot: string }) {
    const backupRoot = safeDataRoot(input.backupPath);
    if (!existsSync(backupRoot)) {
      throw new DomainError("NOT_FOUND", "Backupul nu există.", 404);
    }
    const rootEntry = lstatSync(backupRoot);
    if (rootEntry.isSymbolicLink() || !rootEntry.isDirectory()) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Backupul nu este un director valid.",
        409,
      );
    }

    const manifestPath = join(backupRoot, "manifest.json");
    assertRegularBundleFile(backupRoot, manifestPath);
    let manifest: BackupManifest;
    try {
      manifest = parseBackupManifest(
        JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
      );
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Manifestul backupului nu poate fi citit.",
        409,
      );
    }

    const databaseBackupPath = join(backupRoot, manifest.database.file);
    assertRegularBundleFile(backupRoot, databaseBackupPath);
    if (sha256File(databaseBackupPath) !== manifest.database.sha256) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Baza de date din backup nu corespunde manifestului.",
        409,
      );
    }

    const probe = new DatabaseSync(databaseBackupPath, { readOnly: true });
    try {
      const result = probe.prepare("PRAGMA integrity_check").get();
      if (String(result?.integrity_check) !== "ok") {
        throw new DomainError(
          "STORAGE_UNAVAILABLE",
          "Backupul nu trece verificarea de integritate.",
          409,
        );
      }
      if (JSON.stringify(readArtifactRows(probe)) !== JSON.stringify(manifest.artifacts)) {
        throw new DomainError(
          "STORAGE_UNAVAILABLE",
          "Artefactele backupului nu corespund bazei de date.",
          409,
        );
      }
    } finally {
      probe.close();
    }

    for (const artifact of manifest.artifacts) {
      const source = join(backupRoot, "artifacts", ...artifact.storageKey.split("/"));
      assertRegularBundleFile(backupRoot, source);
      if (
        lstatSync(source).size !== artifact.byteLength ||
        sha256File(source) !== artifact.digest
      ) {
        throw new DomainError(
          "STORAGE_UNAVAILABLE",
          "Un artefact din backup nu corespunde manifestului.",
          409,
        );
      }
    }

    const dataRoot = safeDataRoot(input.dataRoot);
    if (existsSync(dataRoot)) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Restaurarea necesită un director de date nou.",
        409,
      );
    }
    const parent = dirname(dataRoot);
    mkdirSync(parent, { recursive: true });
    const stagingRoot = join(parent, `.${basename(dataRoot)}.restore-${randomUUID()}`);
    mkdirSync(stagingRoot, { recursive: false });

    try {
      copyFileSync(
        databaseBackupPath,
        join(stagingRoot, "aideas.sqlite"),
        fsConstants.COPYFILE_EXCL,
      );
      for (const artifact of manifest.artifacts) {
        const source = join(
          backupRoot,
          "artifacts",
          ...artifact.storageKey.split("/"),
        );
        const target = join(stagingRoot, "artifacts", ...artifact.storageKey.split("/"));
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target, fsConstants.COPYFILE_EXCL);
      }
      renameSync(stagingRoot, dataRoot);
    } catch (error) {
      rmSync(stagingRoot, { recursive: true, force: true });
      throw error;
    }
    return new ControlStore({ dataRoot });
  }
}
