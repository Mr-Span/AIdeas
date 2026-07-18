# AI-002 architecture packet

Status: frozen implementation contract for the durable draft vertical slice.
This packet narrows the wider architecture to the production code that may be
implemented in AI-002.

## Outcome

AI-002 must make an AIdeas project durable without implying that research,
planning agents, Codex execution, or authenticated client access already exist.
It also establishes the data contract for a two-way client-engineer workflow:

- the client can contribute intake, media, answers, corrections, and messages;
- the engineer/operator can return questions and publish a high-level plan;
- the client sees a small progress tracker, not the internal execution graph;
- a plan step is green only after the system records verified completion;
- all browser payloads are projections and never expose storage or provider
  authority.

`Faur` remains an internal working name. It must not appear in public or
client-visible application payloads in this slice.

## Roles and authority

### Operator

- owns the local Codex session and trusted host;
- can see engineering detail in later operator-only surfaces;
- can publish client-visible plan summaries and questions;
- can complete, reopen, or pin a project;
- cannot bypass evidence when marking a plan step `verified`.

### Client contributor

- can create and revise intake content through the API/UI;
- can upload allowed media, answer questions, and propose corrections;
- can read only the client projection of the plan and conversation;
- cannot set plan status, mark a step verified, open SQLite, select host paths,
  access Git/provider state, or trigger external side effects.

AI-002 does not provide authenticated LAN identity. Until a later access-control
slice exists, the application must describe any role preview as a preview and
must not claim cryptographic attribution of a client message.

## Client-visible plan contract

The public projection contains only:

- project display name and lifecycle state;
- high-level plan step title and client-safe summary;
- one of `not_started`, `in_progress`, `waiting_client`, `blocked`, `verified`;
- sanitized blocker or next-action text when explicitly published;
- `updated_at` and, for verified steps, `verified_at`;
- aggregate progress: `verified_visible_steps / visible_steps`;
- public conversation entries and revision acknowledgements.

The projection never contains:

- prompts, agent reasoning, raw traces, model/provider/session information;
- Git branch, commit, diff, worktree, repository path, or merge-policy detail;
- SQLite paths, artifact paths, backup paths, internal row IDs, or SQL errors;
- raw evidence bundles, secret values, environment data, internal cost data, or
  unpublished engineering notes;
- the provisional forge name.

### Verified-green invariant

Only `verified` renders green. A transition to `verified` requires an internal
evidence reference and verification timestamp. `in_progress` is blue,
`waiting_client` is amber, `blocked` is red, and `not_started` is neutral.
Client messages and UI actions can never create this transition.

## Durable data model

All timestamps are UTC ISO-8601 strings. IDs are opaque UUIDs. SQLite is opened
only by the server-side Control Store.

### `projects`

- `id`, `display_name`, `lifecycle_state`, `current_version`;
- `completed_at`, `purge_after`, `pinned_at`;
- `created_at`, `updated_at`.

Lifecycle values are `active`, `completed`, `grace`, and `pinned`. Completion
sets a provisional `purge_after = completed_at + 30 days`; reopening clears it.
AI-002 must not run automatic purge while the remaining retention policy is
unresolved.

### `capture_events`

Immutable records for owner/client intake, notes, submissions, questions,
answers, corrections, and media. Each record points to an artifact digest and
records actor kind, event kind, project version, provenance, and creation time.

### `project_revisions`

Immutable, monotonically versioned snapshots. A save requires
`expected_version`; a stale writer receives a stable conflict error. Each
revision points to its canonical `capture.md` artifact and optional media.

### `artifacts` and `revision_artifacts`

The Artifact Store owns bytes. SQLite stores digest, media type, byte length,
safe display name, relative storage key, provenance, and link records. The API
never returns the relative storage key.

### `plan_steps`

Stores stable step ID, project ID, plan revision, position, internal status,
client title/summary, client visibility, sanitized next action, evidence
reference, verification timestamp, and update timestamp. Client projection uses
an allowlist serializer rather than removing fields from a raw row.

### `collaboration_entries`

Immutable public or internal thread entries. Public entries store author kind,
entry kind (`question`, `answer`, `message`, `correction`, `acknowledgement`),
body artifact digest, related plan step/revision, and timestamps. Client queries
return only entries explicitly marked public through an allowlist DTO.

### `idempotency_receipts`

Maps `(project_id, command_name, idempotency_key)` to request digest and stable
response. Reusing the key with a different request returns
`IDEMPOTENCY_CONFLICT`; replaying the same request returns the original result.

## Artifact protocol

The server data root is configured server-side and defaults to `.aideas/` under
the application root. It contains the SQLite file, `artifacts/`, `quarantine/`,
and `backups/`; all remain outside Git.

1. Validate content type, byte limit, and safe display name.
2. Compute SHA-256 from bytes.
3. Write to a unique quarantine file without following client paths.
4. Atomically promote to `artifacts/sha256/<prefix>/<digest>`.
5. In one SQLite transaction, create/link immutable records and idempotency
   receipt.
6. If the database transaction fails after promotion, the bytes are an
   unreferenced content-addressed orphan, not a broken canonical reference.
7. Reconciliation detects missing references and old unreferenced bytes without
   deleting active or newly written content.

## Initial HTTP surface

Route handlers use the Node.js runtime and validate all inputs with Zod.

- `POST /api/projects`: create a project idempotently.
- `GET /api/projects/:projectId`: return the client-safe workspace projection.
- `PUT /api/projects/:projectId/draft`: save Markdown fields and optional media
  as one expected-version revision.
- `POST /api/projects/:projectId/submit`: persist a submitted revision while
  truthfully reporting that no provider run started.
- `GET|POST /api/projects/:projectId/collaboration`: read public entries or add
  a validated public contribution.

Operator-only plan-step mutation remains a server/domain command until real
authentication exists. It must not be exposed as a client-authorized HTTP
operation in AI-002.

Error responses use stable codes and safe messages:
`VALIDATION_ERROR`, `NOT_FOUND`, `VERSION_CONFLICT`,
`IDEMPOTENCY_CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA`, and
`STORAGE_UNAVAILABLE`. Raw SQL, filesystem paths, and stack traces are logged
only through a future redacted operator channel, never returned.

## Single-writer and recovery contract

- use one process-local Control Store singleton for the configured data root;
- initialize migrations before accepting commands;
- enable foreign keys, defensive mode, WAL, and a bounded busy timeout;
- wrap every aggregate mutation in `BEGIN IMMEDIATE` / commit / rollback;
- make reads return immutable DTOs, not live database rows;
- expose explicit `integrityCheck`, `backup`, `restore`, and `reconcile`
  operations for tests and operator tooling;
- package each backup as an immutable manifest plus a consistent SQLite
  snapshot and every referenced content-addressed artifact; transient
  quarantine parts are not canonical backup content;
- restore only into a fresh data root after database integrity, manifest,
  byte-length, digest, and DB-to-artifact consistency checks pass;
- opening a second writer through a browser or client API is impossible by
  construction.

The Node 24 built-in `node:sqlite` adapter is the first implementation because
the pinned runtime already provides `DatabaseSync` and `backup`. The storage
port remains isolated so the adapter can be replaced if release-candidate API
stability becomes a production concern.

## AI-002 acceptance checks

- create/save/load survives closing and reopening the Control Store;
- a duplicate idempotency key does not create extra rows or bytes;
- stale expected version fails without partial artifacts linked to a revision;
- media digest deduplicates identical bytes;
- only allowlisted client fields leave the route handler;
- only an evidence-bound `verified` step appears green in the UI;
- public collaboration entries round-trip; internal entries never appear;
- completion sets the provisional 30-day timestamp and reopen clears it;
- reconciliation reports orphans/missing artifacts safely;
- backup restores SQLite, uploaded media, capture Markdown, and public
  collaboration to a separate test root and passes `PRAGMA integrity_check`;
- `.aideas`, database files, backups, artifacts, and client fixtures remain
  ignored by Git;
- lint, typecheck, unit/integration tests, build, and focused Playwright pass.
