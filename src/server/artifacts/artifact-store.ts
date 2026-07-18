import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";

import { DomainError } from "@/server/domain/errors";

export const MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;
export const MAX_ARTIFACTS_PER_REVISION = 10;
const SAFE_MEDIA_TYPES = new Set([
  "application/json",
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/markdown",
  "text/plain",
]);

export function isSafeArtifactMediaType(mediaType: string) {
  return SAFE_MEDIA_TYPES.has(mediaType);
}

export type StoredArtifact = {
  digest: string;
  mediaType: string;
  byteLength: number;
  displayName: string;
  storageKey: string;
};

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeDisplayName(value: string) {
  const name = basename(value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "-")
    .trim();

  return (name || "artifact").slice(0, 180);
}

function assertInside(root: string, target: string) {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  const pathFromRoot = relative(resolvedRoot, resolvedTarget);
  if (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..")
  ) {
    return;
  }
  throw new DomainError(
    "STORAGE_UNAVAILABLE",
    "Locația artefactului nu este validă.",
    500,
  );
}

function assertNoLinkedPathComponents(root: string, target: string) {
  assertInside(root, target);
  const pathFromRoot = relative(resolve(root), resolve(target));
  const segments = pathFromRoot ? pathFromRoot.split(sep) : [];
  let current = resolve(root);

  if (lstatSync(current).isSymbolicLink()) {
    throw new DomainError(
      "STORAGE_UNAVAILABLE",
      "Directorul de artefacte nu poate fi o legătură simbolică.",
      500,
    );
  }

  for (const segment of segments) {
    current = join(current, segment);
    if (!existsSync(current)) break;
    if (lstatSync(current).isSymbolicLink()) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Calea artefactului conține o legătură simbolică.",
        500,
      );
    }
  }
}

function assertRealPathInside(root: string, target: string) {
  const realRoot = realpathSync.native(root);
  const realTarget = realpathSync.native(target);
  assertInside(realRoot, realTarget);
}

export class ArtifactStore {
  readonly root: string;
  readonly quarantineRoot: string;

  constructor(dataRoot: string) {
    this.root = join(dataRoot, "artifacts");
    this.quarantineRoot = join(dataRoot, "quarantine");
    mkdirSync(this.root, { recursive: true });
    mkdirSync(this.quarantineRoot, { recursive: true });
    assertNoLinkedPathComponents(this.root, this.root);
    assertNoLinkedPathComponents(this.quarantineRoot, this.quarantineRoot);
  }

  put(input: {
    bytes: Uint8Array;
    displayName: string;
    mediaType: string;
  }): StoredArtifact {
    const { bytes } = input;
    if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
      throw new DomainError(
        "PAYLOAD_TOO_LARGE",
        "Fișierul depășește limita de 20 MB.",
        413,
      );
    }
    if (!isSafeArtifactMediaType(input.mediaType)) {
      throw new DomainError(
        "UNSUPPORTED_MEDIA",
        "Tipul fișierului nu este acceptat.",
        415,
      );
    }

    const digest = sha256(bytes);
    const storageKey = join("sha256", digest.slice(0, 2), digest).replaceAll(
      "\\",
      "/",
    );
    const target = join(this.root, ...storageKey.split("/"));
    assertInside(this.root, target);
    assertNoLinkedPathComponents(this.root, dirname(target));
    mkdirSync(dirname(target), { recursive: true });
    assertNoLinkedPathComponents(this.root, dirname(target));
    assertRealPathInside(this.root, dirname(target));

    if (!existsSync(target)) {
      const temporary = join(this.quarantineRoot, `${randomUUID()}.part`);
      assertInside(this.quarantineRoot, temporary);
      const handle = openSync(temporary, "wx");
      try {
        writeFileSync(handle, bytes);
      } finally {
        closeSync(handle);
      }

      try {
        renameSync(temporary, target);
      } catch (error) {
        if (!existsSync(target)) throw error;
        rmSync(temporary, { force: true });
      }
    }

    // Revalidate the final path after rename (or a concurrent deduplication win)
    // so a linked or non-file target can never be returned as a stored artifact.
    assertNoLinkedPathComponents(this.root, target);
    assertRealPathInside(this.root, target);
    if (!lstatSync(target).isFile()) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Artefactul existent nu este un fișier obișnuit.",
        500,
      );
    }

    return {
      digest,
      mediaType: input.mediaType,
      byteLength: bytes.byteLength,
      displayName: safeDisplayName(input.displayName),
      storageKey,
    };
  }

  read(storageKey: string) {
    if (!/^sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(storageKey)) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Referința artefactului nu este validă.",
        500,
      );
    }
    const target = join(this.root, ...storageKey.split("/"));
    assertInside(this.root, target);
    assertNoLinkedPathComponents(this.root, target);
    assertRealPathInside(this.root, target);
    if (!lstatSync(target).isFile()) {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "Artefactul nu este un fișier obișnuit.",
        500,
      );
    }
    return readFileSync(target);
  }

  listDigests() {
    const digests: string[] = [];
    const shaRoot = join(this.root, "sha256");
    if (!existsSync(shaRoot)) return digests;
    assertNoLinkedPathComponents(this.root, shaRoot);
    assertRealPathInside(this.root, shaRoot);

    for (const prefix of readdirSync(shaRoot, { withFileTypes: true })) {
      if (!prefix.isDirectory() || !/^[a-f0-9]{2}$/.test(prefix.name)) continue;
      const prefixRoot = join(shaRoot, prefix.name);
      assertNoLinkedPathComponents(this.root, prefixRoot);
      assertRealPathInside(this.root, prefixRoot);
      for (const entry of readdirSync(prefixRoot, { withFileTypes: true })) {
        if (entry.isFile() && /^[a-f0-9]{64}$/.test(entry.name)) {
          digests.push(entry.name);
        }
      }
    }

    return digests.toSorted();
  }

  exists(storageKey: string) {
    if (!/^sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(storageKey)) return false;
    const target = join(this.root, ...storageKey.split("/"));
    assertInside(this.root, target);
    if (!existsSync(target)) return false;
    assertNoLinkedPathComponents(this.root, target);
    assertRealPathInside(this.root, target);
    return lstatSync(target).isFile() && statSync(target).isFile();
  }
}
