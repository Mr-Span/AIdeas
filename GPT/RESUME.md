# Resume

Active task: AI-003 — the provider-neutral ExecutionProvider feasibility
harness with Codex owner-local first.

Last verified state: AI-002 is integrated into `main` through PR #2 at merge
commit `97c3153`. SQLite revisions, content-addressed artifacts,
idempotent create/save/submit, backup/recovery primitives, public two-way
collaboration, and the client-safe five-step mini-tracker pass 18 Vitest and
4 Chromium end-to-end tests plus a warning-free production build.

Known honest boundary: providers remain disconnected and no agent is claimed to
start. LAN access is disabled pending authenticated client/operator identity and
an upstream request-size cap. Completion records a provisional 30-day deadline,
but automatic purge is disabled until warning, residual-audit, backup-lag, and
early-deletion semantics are confirmed.

Next sequence:

1. freeze the provider-neutral run/event/cancel/result contract;
2. verify the supported Codex owner-local authentication and execution surface;
3. implement the Codex adapter without exposing session credentials to clients;
4. add structured events, timeout, cancellation, and fixture-worktree isolation;
5. keep Research visibly blocked until a real provider run has started;
6. separately decide the secured-LAN transport/session model before client-device
   access is enabled.

Open before LAN/purge release: point 4 client transport and authenticated
identity; point 5 completion warning, residual audit, backup deletion lag, and
early deletion semantics.
