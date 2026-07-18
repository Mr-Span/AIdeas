# Resume

Active task: AI-002 — SQLite durable draft slice.

Last verified state: AI-001 is complete and published at
`https://github.com/Mr-Span/AIdeas`. The responsive intake UI, public-safe
documentation, visual concepts, tests, build, secret scans, and remote GitHub
readback all pass.

Known honest boundary: UI state is in-memory only; no SQLite persistence or
agent provider is active. Do not start provider integration before the storage
contracts are stable.

Next sequence:

1. define commands, queries, immutable capture events, and project revisions;
2. add SQLite migrations behind a single-writer Control Service boundary;
3. implement idempotent create/save/load/submit handlers with version checks;
4. connect the intake UI to durable save/load and explicit recovery states;
5. prove restart durability, duplicate-submit behavior, backup/restore, and
   `integrity_check`;
6. keep the database, backups, artifacts, and all client content outside Git.
