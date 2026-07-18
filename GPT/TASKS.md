# Tasks

## AI-001 — Bootstrap the public pilot and truthful intake UI

Status: done locally; GitHub publication pending.

Acceptance:

- production Next.js baseline copied without cache/build/env files;
- public-safe docs and secret policy;
- responsive card-based intake UI matching accepted desktop/mobile concepts;
- real local interactions and explicit unavailable states;
- lint, typecheck, unit tests, build, and focused browser flow pass;
- public GitHub readback confirms repository visibility and committed file set.

## AI-002 — SQLite durable draft slice

Status: next eligible after AI-001 publication.

Ownership: `src/server/storage/**`, `src/server/domain/**`, migrations, API route,
contract/unit/integration tests, and the intake save/load connection.

Acceptance:

- one Control Service writer owns the database;
- immutable `CaptureEvent` and versioned `ProjectRevision` persist;
- save and reload survive restart;
- idempotency key prevents duplicate submission;
- backup/restore and `integrity_check` pass;
- SQLite file and backups remain ignored by Git;
- no browser or LAN client opens the database file.

Verification: `pnpm.cmd verify` plus storage integration and restart tests.

## AI-003 — ExecutionProvider feasibility harness

Status: blocked by AI-002 contracts and operator auth-mode confirmation.

Acceptance:

- provider-neutral run/event/cancel/result contract;
- Codex SDK adapter and Claude Agent SDK adapter behind the same port;
- server-side credential handling; no secret reaches client/log/artifact;
- structured events, cancellation, timeout, rate-limit and auth errors;
- fixture-only worktree, no writes to the main checkout;
- official provider terms/auth boundary documented and tested.

## AI-004 — Research and clarification round trip

Status: pending AI-003.

Acceptance:

- multiple specialized roles receive bounded context packets;
- web claims retain source URL, retrieval time, quote/summary boundary, and
  confidence;
- suggestions, A/B options, media guidance, risks, and follow-up questions are
  returned as typed proposals;
- operator edits and approves a new Project Graph revision.

## AI-005 — Final plan and autonomous execution gate

Status: pending AI-004.

Acceptance:

- approved revision becomes a dependency DAG and implementation packets;
- evidence bundle gates commit/push/PR/merge;
- unresolved blockers return to the operator;
- payment/publication/deploy remain impossible without explicit approval bound
  to action digest and policy version.
