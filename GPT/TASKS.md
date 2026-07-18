# Tasks

## AI-001 — Bootstrap the public pilot and truthful intake UI

Status: complete. Public repository: `https://github.com/Mr-Span/AIdeas`.

Acceptance:

- production Next.js baseline copied without cache/build/env files;
- public-safe docs and secret policy;
- responsive card-based intake UI matching accepted desktop/mobile concepts;
- real local interactions and explicit unavailable states;
- lint, typecheck, unit tests, build, and focused browser flow pass;
- public GitHub readback confirms repository visibility and committed file set.

## AI-002 — SQLite durable draft slice

Status: next eligible production task.

Ownership: `src/server/storage/**`, `src/server/artifacts/**`,
`src/server/domain/**`, migrations, API route, contract/unit/integration tests,
and the intake save/load connection.

Acceptance:

- one Control Service writer owns the database;
- immutable `CaptureEvent` and versioned `ProjectRevision` persist;
- original `capture.md` and synthetic media live in an Artifact Store outside
  Git; SQLite stores their manifest, digest, provenance, and links;
- save and reload survive restart;
- idempotency key prevents duplicate rows and file bytes;
- completion creates a provisional 30-day retention deadline and reopen cancels
  it;
- interrupted file/transaction boundaries reconcile safely;
- backup/restore and `integrity_check` pass;
- SQLite file and backups remain ignored by Git;
- no browser or LAN client opens the database file.

Verification: `pnpm.cmd verify` plus storage integration and restart tests.

## AI-003 — ExecutionProvider feasibility harness

Status: blocked by AI-002 contracts. Codex owner-local is confirmed first.

Acceptance:

- provider-neutral run/event/cancel/result contract;
- Codex owner-local SDK adapter behind the provider-neutral port;
- Claude API/product adapter remains a later contract-compatible slice;
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
