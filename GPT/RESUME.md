# Resume

Active task: AI-003 — the sole current front: provider-neutral
ExecutionProvider feasibility with Codex owner-local first.

Last verified state: the AI-003 owner-local feasibility harness is integrated
into `main` through PR #4 at merge commit `ec869ff`. GitHub Actions `verify`
passed. The provider contract, hardened SDK adapter, structured read-only live
run, real cancellation, safe event/redaction boundary, and fixture workspace
policy pass 14 focused tests plus 2 real Codex turns. The complete local suite
passes 32 tests, a warning-free production build, and 4 Chromium scenarios.

AI-002 remains the durable base: SQLite revisions, content-addressed artifacts,
idempotent create/save/submit, backup/recovery primitives, public two-way
collaboration, and the client-safe five-step mini-tracker are in `main`.

Known honest boundary: providers remain disconnected and no agent is claimed to
start. LAN access is disabled pending authenticated client/operator identity and
an upstream request-size cap. Completion records a provisional 30-day deadline,
but automatic purge is disabled until warning, residual-audit, backup-lag, and
early-deletion semantics are confirmed.

Next sequence:

1. persist the Execution Broker run/event/provider-thread ledger in SQLite;
2. reconcile interrupted runs and support inspect/resume proposal after restart;
3. add the external worktree/process-tree supervisor and crash injection;
4. implement stable `codex exec --json` recovery/diagnostic compatibility;
5. expose an operator-only project research route after durable capture/policy;
6. keep Research visibly blocked until that route has a real start receipt.

AI-003 harness evidence: the provider-neutral contract, SDK adapter, safe event
normalization, timeout/cancel, redaction, environment allowlist, and workspace
policy are implemented. Twelve focused tests and two real owner-local Codex
turns pass; the real fixture remained byte-for-byte and Git clean.

Explicit backlog after AI-003: point 4 client transport/authenticated identity
and point 5 completion warning, residual audit, backup deletion lag, and early
deletion semantics. LAN and automatic purge remain disabled; neither blocks the
current provider harness.
