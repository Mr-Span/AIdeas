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

Status: complete and integrated into `main` through PR #2 at merge commit
`97c3153`.

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
- public collaboration entries persist as a two-way client/engineer thread;
- the client projection contains only published high-level plan steps and safe
  public messages;
- only an evidence-bound `verified` step renders green, and client actions
  cannot create that transition;
- client payloads exclude prompts, raw research, provider/Git/DB/storage paths,
  internal evidence, private notes, and provisional forge branding.

Verification: `pnpm.cmd verify`, 18 unit/integration/contract tests, 4 Chromium
end-to-end tests, and rendered desktop/mobile QA pass.

## AI-003 — ExecutionProvider feasibility harness

Status: active. Codex owner-local is the only current implementation front;
the UI truthfully keeps providers disconnected until a real tracked run starts.

Current slice:

- provider-neutral contract and normalized event/error vocabulary;
- official TypeScript SDK adapter using the operator's host-local Codex auth;
- `codex exec --json` retained as a stable fallback/diagnostic surface;
- App Server excluded from the critical path while it remains experimental;
- fixture-only live smoke with read-only sandbox, timeout, cancellation, secret
  redaction, and proof that the main checkout is unchanged.

Current evidence: provider contract and SDK harness implemented; 14 focused
contract/integration tests pass; two real owner-local turns pass (structured
read-only output and cancellation). Remaining before completion: durable broker
ledger/restart reconciliation, worktree/process-tree supervisor, CLI recovery
adapter, and operator-only project research route. See
`docs/AI003_ARCHITECTURE_PACKET.md`.

Acceptance:

- provider-neutral run/event/cancel/result contract;
- Codex owner-local SDK adapter behind the provider-neutral port;
- Claude API/product adapter remains a later contract-compatible slice;
- server-side credential handling; no secret reaches client/log/artifact;
- structured events, cancellation, timeout, rate-limit and auth errors;
- fixture-only worktree, no writes to the main checkout;
- official provider terms/auth boundary documented and tested.

## Backlog — explicitly deferred after AI-003

### BL-001 — Secured LAN client identity and transport

Status: backlog. LAN remains disabled; no separate client device is enabled
until transport, authentication, session revocation, origin/CSRF, and upstream
request limits are implemented and verified.

### BL-002 — Final purge semantics

Status: backlog. The provisional completion-plus-30-days deadline remains, but
automatic deletion stays disabled until warning/approval, residual audit,
backup deletion lag, and early-deletion behavior are confirmed.

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
