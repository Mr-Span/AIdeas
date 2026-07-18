# Data ingest and retention

Status: `v0.3 decision draft`, 2026-07-18. This document owns the client/owner
intake modes, file-to-database boundary, and retention lifecycle. Technical
storage contracts remain in `ARCHITECTURE.md`; security controls remain in
`SECURITY.md`.

## Confirmed direction

- The first execution provider is the operator's locally authenticated Codex
  installation on the trusted host.
- A client never receives the operator's Codex session, provider credentials,
  repository access, or database access.
- Client input is preserved as Markdown plus original media files before any
  model transforms it.
- SQLite stores structured records, manifests, provenance, digests, links, and
  retention state. It does not become a container for large media blobs.
- The provisional default retains project material while the project is active
  and for 30 days after the operator marks it complete.

## Two operating modes, one canonical pipeline

### Owner mode

The operator uses AIdeas on the trusted host. Intake still passes through the
same capture command and Artifact Store used by client submissions. After the
capture transaction succeeds, an approved workflow may call the locally
authenticated Codex adapter.

### Client contribution mode

A limited client session can submit assigned intake cards, notes, Markdown, and
media through an authenticated upload API. The client cannot call provider,
repository, approval, execution, export-all, or administration endpoints.

The first pilot still needs to choose its client transport:

- secured LAN browser on a separate device;
- operator-assisted entry on the owner device; or
- an exportable submission bundle that the operator imports.

Public-internet upload is a later deployment mode with a different identity,
tenancy, abuse, privacy, and incident-response model.

## Storage split

| Data | Canonical storage | Notes |
|---|---|---|
| original idea/answers | immutable `capture.md` artifact | preserves the client's wording and encoding |
| original media | content-addressed Artifact Store | stored by digest; never under a public Git path |
| capture/artifact manifest | SQLite | project, actor, digest, MIME, size, origin, storage key |
| approved semantics | versioned Project Graph in SQLite | facts, assumptions, requirements, decisions, risks |
| extracted text/thumbnails | derived artifact | rebuildable and purged with its source unless pinned |
| provider/run output | evidence/artifact records | redacted, digest-linked, retention-classified |
| source code | Git | client uploads and runtime data never enter Git |

A recommended local data root is an application-owned directory outside the
checkout, such as `%LOCALAPPDATA%/AIdeas/data`. One possible layout is:

```text
data/
  projects/<project-id>/captures/<capture-id>/capture.md
  artifacts/sha256/<prefix>/<digest>
  quarantine/<upload-id>
  backups/<backup-id>
  aideas.sqlite
```

Paths are implementation details. Canonical references use opaque IDs and
digests, never browser-supplied filesystem paths.

## Atomic submission flow

1. Authenticate the actor and verify project assignment, origin, CSRF token,
   quota, and idempotency key.
2. Stream uploads into quarantine with total/per-file limits; do not buffer
   arbitrary media in application memory.
3. Detect and allowlist MIME type, reject unsafe names/types, calculate SHA-256,
   and run the configured content/malware checks.
4. Write the immutable Markdown capture and accepted media to temporary
   application-owned paths, then atomically promote them to the Artifact Store.
5. In one SQLite transaction, insert the CaptureEvent, artifact manifests,
   links, audit event, outbox item, and retention class.
6. Acknowledge success only after both file promotion and database commit have a
   recoverable receipt. Reconciliation repairs a crash between these boundaries.
7. Create or propose a Project Graph revision. Models receive a bounded Context
   Packet; they never mutate the original files or canonical records directly.
8. In owner mode, policy may enqueue a Codex owner-local run. In client mode,
   the browser only sees normalized status and safe results.

## Retention lifecycle

```text
active project
  -> operator marks completed
  -> 30-day grace period
  -> purge_due
  -> verified purge receipt

completed -> reopened cancels the current purge deadline
any state -> pinned/legal_hold suspends automatic deletion
```

Provisional policy:

- retain original captures, approved media, and required evidence while the
  project is active;
- set `retention_due_at = completed_at + 30 days` when the operator explicitly
  marks the project complete;
- reopening the project clears the deadline and returns it to active retention;
- pinning is per project or artifact and records actor, reason, and expiry;
- purge removes file bytes, previews, extracted text, and unneeded run artifacts
  through an allowlisted deletion worker;
- retain only the minimum audit receipt and digests after purge, subject to the
  final privacy decision;
- backups must age out deleted client bytes within a documented maximum, not
  silently retain them forever.

## Decisions still required for points 4 and 5

### Client access

1. Is the first client pilot a separate secured-LAN device, operator-assisted
   entry, or an importable submission bundle?
2. Can a client return to edit previous answers, or only append a new revision?
3. Does the client see research/plan results, or only submit and answer cards?
4. Is remote internet access explicitly out of v1?

### Retention and deletion

1. What exact event means project completion: final merge, delivery, invoice
   closure, or an explicit operator action? Recommendation: explicit action.
2. Should the system warn at 7 days before purge and require no response, or
   require a final deletion confirmation?
3. After purge, may minimal hashes/audit receipts remain, or must the project be
   fully anonymized?
4. What is the maximum backup deletion lag? Recommendation: 30 additional days.
5. Can the client request earlier deletion, and which evidence must be retained
   for contractual/security reasons?

## AI-002 acceptance impact

AI-002 must prove the boundary locally before LAN exposure:

- save one Markdown capture and one synthetic media file outside Git;
- store their manifest, digest, provenance, and links in SQLite;
- reload them after process restart;
- replay the same idempotency key without duplicating bytes or rows;
- reconcile an interrupted file/transaction boundary;
- mark a project complete, calculate the 30-day deadline, and cancel it on
  reopen;
- prove backup/restore and `integrity_check` without publishing client data.
