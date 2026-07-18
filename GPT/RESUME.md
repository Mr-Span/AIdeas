# Resume

Active task: AI-002 — SQLite plus Artifact Store durable capture slice.

Last verified state: AI-001 is complete and published at
`https://github.com/Mr-Span/AIdeas`. MIT, Codex owner-local-first, the
Markdown/media-to-manifest boundary, and the provisional completion-plus-30-day
retention rule are recorded decisions.

Known honest boundary: UI state is in-memory only; no SQLite persistence,
Artifact Store, client upload, retention worker, or provider is active. Do not
start provider integration before the capture/storage contracts are stable.

Next sequence:

1. define commands, queries, immutable captures, artifact manifests, and project
   revisions;
2. add SQLite migrations behind a single-writer Control Service boundary;
3. add quarantine and a content-addressed Artifact Store outside Git;
4. implement idempotent create/save/load/submit with atomic file/DB receipts and
   version checks;
5. connect the intake UI to durable save/load and explicit recovery states;
6. implement active/completed/grace/pinned retention state and the provisional
   30-day deadline;
7. prove restart durability, duplicate submission, interrupted-boundary
   reconciliation, backup/restore, and `integrity_check`.

Open before LAN/purge release: point 4 client transport/visibility and point 5
completion, warning, residual audit, backup lag, and early deletion semantics.
