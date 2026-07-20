# Risks

| ID | Risk | Impact | Mitigation / gate |
|---|---|---|---|
| R-001 | A personal provider session is exposed to clients | account compromise or policy violation | server-side adapter only; client/product mode uses supported API or enterprise auth |
| R-002 | Public Git history contains a secret or client data | irreversible disclosure | no env files; pre-commit secret scan; explicit staged-file review; synthetic fixtures only |
| R-003 | Agents mutate canonical state directly | corrupted or contradictory plan | typed proposals; expected version; deterministic command handler; audit event |
| R-004 | SQLite is shared over LAN or gains multiple writers | corruption or locking failures | DB remains on host; one writer; LAN via API; migration trigger for sustained concurrency |
| R-005 | UI implies research or execution succeeded when no provider ran | loss of trust | truthful disconnected/blocked states and receipts for every run |
| R-006 | Research introduces prompt injection or unsupported claims | unsafe actions or false plan | untrusted-source labeling, capability isolation, citations, readback, approval policy |
| R-007 | Autonomous merge accepts stale evidence | regression in main | evidence bound to base commit and diff digest; revalidate after base advances |
| R-008 | Scope expands before the core loop works | long delay and operating burden | AIdeas vertical first; gate new contexts on measured benefit |
| R-009 | Working forge name collides with a mark or domain | forced rebrand | no public umbrella branding until clearance and operator approval |
| R-010 | A partially completed multi-role round is resumed with inconsistent context after restart | contradictory or stale proposals | mark interrupted roles/round failed, preserve artifacts, require a new explicit round; decide partial retry policy before unattended operation |
| R-011 | Simultaneous operator API bootstrap requests rotate the local session cookie | valid operator is rejected or a mutation appears stuck | share one in-flight session promise in the browser; contract and Chromium regression coverage |
