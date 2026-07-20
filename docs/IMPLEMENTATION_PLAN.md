# AIdeas implementation plan

Status: `v0.4 decision draft`, 2026-07-18. This document owns ordering, work packets and
gates. A phase is complete only when its gate is demonstrated.

## Delivery principle

Build one complete thread through the system before adding broad modules:

```text
capture
→ durable semantic revision
→ bounded research proposal
→ operator clarification
→ approved plan and DAG
→ isolated repository work
→ evidence
→ policy-gated integration
```

AIdeas uses its own repository as the first real project. Early execution tasks
must be reversible and noncritical.

## Phase 0 — Public-safe product shell

Status: complete in AI-001 and published at
`https://github.com/Mr-Span/AIdeas`.

Delivered:

- production Next.js baseline without environment-dependent template services;
- responsive idea intake, notes, local-only media selection and approval toggle;
- truthful disconnected-provider and non-persistence states;
- design concepts and repo-local control plane;
- public-repository secret/data exclusions;
- lint, typecheck, unit, production build and focused browser verification.

Gate P0:

- production build and focused Playwright pass on desktop and mobile;
- rendered UI is compared with both design concepts;
- no `.env*`, database, credential, client data or build artifact is tracked;
- public GitHub repository and remote file/visibility readback succeed.

## Phase 1 — Durable intake and Project Graph kernel

Task: AI-002. Estimated engineering effort: 1–3 weeks.

Implementation status: complete and integrated into `main` through PR #2 at
merge commit `97c3153`.

Work packets:

1. define Zod contracts for `CreateProject`, `AppendCapture`,
   `ProposeChangeSet`, `ApproveChangeSet`, and query DTOs;
2. add SQLite driver, migrations and one-writer repository boundary;
3. persist immutable captures, projects, revisions, nodes, edges, artifact
   manifests/links, audit and idempotency receipts;
4. add API handlers with actor, origin/CSRF, body limits, idempotency and
   expected version;
5. connect save/load/submit in the UI and add pending/error/recovery states;
6. write original `capture.md` and synthetic media to a content-addressed local
   Artifact Store outside Git, with quarantine and atomic promotion;
7. add active/completed/grace/pinned/purge lifecycle fields and calculate the
   provisional completion-plus-30-days deadline;
8. implement interrupted-boundary reconciliation, backup, restore, integrity,
   and migration smoke tests;
9. persist public client/engineer collaboration entries and build a dedicated
   client DTO that excludes internal notes and infrastructure detail;
10. persist high-level plan-step projections with the invariant that only an
    evidence-bound `verified` step may render green in the mini tracker.

Gate P1:

- create/save/reload works across process restart;
- duplicate submission returns the original result, not a second revision;
- stale expected version returns a visible conflict;
- original Markdown/media capture and every approved revision can be reconstructed;
- the same idempotency key does not duplicate files or manifest rows;
- completion creates a 30-day deadline and reopening cancels it;
- database and artifacts never enter Git;
- a limited test actor uses the same capture API but cannot open the DB or choose
  a host filesystem path; actual LAN exposure waits for point 4;
- public questions, answers and corrections round-trip while private entries do
  not appear in the client projection;
- the client tracker contains only published high-level plan steps, and no
  client command can create a verified-green transition.

## Phase 2 — Provider feasibility and normalized execution

Task: AI-003. Estimated effort: 2–4 weeks because provider behavior and Windows
sandboxing are the highest uncertainties.

Status: complete locally on 2026-07-20. Secured LAN identity and final purge
semantics remain explicit backlog and disabled.

The provider contract and SDK harness entered `main` through
[PR #4](https://github.com/Mr-Span/AIdeas/pull/4). AI003-B/C/D now add the
durable broker, restart reconciliation, external worktree/process supervisor,
version-gated CLI adapter, operator-only API, and the first real research result
in the UI. Final publication evidence lives in `GPT/VERIFICATION.md`.

Sequence:

1. freeze `ExecutionProvider` contract and event schema;
2. implement the operator's Codex owner-local TypeScript SDK adapter server-side;
3. retain stable `codex exec --json` as a controlled fallback and diagnostic;
4. keep experimental App Server transport outside the critical path;
5. normalize start, stream, usage, interrupt, timeout, auth failure, rate limit,
   resume/inspect and final result;
6. create fixture repository and worktree manager;
7. apply path, command, network and duration capability grants;
8. add canary-secret redaction and event/artifact filters;
9. crash the broker/runner at each side-effect boundary and reconcile;
10. schedule Claude API/product mode only after the common contract is stable.

Gate P2:

- the Codex owner-local adapter passes the common contract and security tests;
- contract fixtures define the later Claude API adapter without sharing a
  personal subscription or client-facing login;
- a run can be cancelled and inspected after restart;
- main checkout remains unchanged;
- provider credentials are absent from browser, prompt packet, logs, artifacts
  and Git;
- no provider session is exposed to an untrusted or public client;
- auth and provider outage produce stable blocked reasons.

## Phase 3 — Research and clarification loop

Task: AI-004. Estimated effort: 2–4 weeks.

Status: complete locally. The AI-003 baseline now feeds four specialized,
bounded provider runs, typed evidence/proposals, deterministic reconciliation,
operator clarification cards and an approval-bound immutable revision. See
`AI004_ARCHITECTURE_PACKET.md`.

Work packets:

- coverage model for audience, problem, outcome, constraints, data, money,
  geography, integrations, content/media, risk and acceptance;
- minimal role router for intent analyst, market researcher, validator and
  media strategist;
- source evidence schema, web gateway and untrusted-content boundary;
- typed proposals: findings, questions, assumptions, risks, A/B choices,
  experiments and media inventory;
- proposal merge/deduplication and contradiction view;
- operator clarification cards and revision diff;
- evaluation set with known questions/sources and prompt-injection fixtures.

Gate P3:

- research claims are traceable and stale/weak evidence is visible;
- duplicate findings are reconciled, not repeated across agent reports;
- model output cannot change Project Graph without validation and approval;
- operator can complete another round without re-entering known facts;
- prompt-injection fixtures cannot widen capabilities or trigger writes.

## Phase 4 — Architecture, plan and final review

Estimated effort: 2–4 weeks.

Work packets:

- architecture proposal schema and source-of-truth matrix;
- requirement-to-component and requirement-to-acceptance traceability;
- work DAG materializer with dependency validation;
- task packets containing scope, files, context, tests, evidence and stop rules;
- effort/cost range and limitation report;
- visual architecture map generated from structured nodes/edges;
- final review UI with semantic diff and explicit execution approval;
- approval bound to revision, plan digest and policy version.

Gate P4:

- every task traces to an approved requirement or risk mitigation;
- DAG has no cycle, missing dependency or overlapping file ownership that the
  planner left unexplained;
- operator can change/reject part of the plan without regenerating everything;
- execution cannot begin with a stale or unsigned plan digest.

## Phase 5 — End-to-end execution on AIdeas

Task: AI-005. Estimated effort: 4–8 weeks.

Work packets:

- ready queue, leases, fencing tokens, attempts and durable FSM;
- Context Compiler and immutable ContextPacket manifest;
- isolated branch/worktree lifecycle;
- bounded repair loop with a new attempt and previous evidence retained;
- independent verifier profile;
- EvidenceBundle policy for each work type;
- Git push/PR/merge adapter with remote/base readback;
- approval toggle and risk override;
- unresolved-blocker inbox;
- integration receipt and knowledge projection.

Gate P5:

- an approved AIdeas work item is implemented, tested, independently reviewed,
  committed and integrated according to policy;
- replay, restart and expired worker cannot duplicate or finalize incorrectly;
- stale base invalidates evidence;
- push/PR/merge can run autonomously with the toggle off and green evidence;
- payment/publication/deploy remain blocked without distinct approval;
- operator can explain the complete timeline from capture to commit.

## Phase 6 — Reliability and secured LAN

Estimated effort: 3–6 weeks.

- scheduled backup/restore drill and corruption procedure;
- artifact/worktree retention and bounded garbage collection;
- provider outage, disk-full, stale context and network fault injection;
- LAN TLS/tunnel, operator/client roles, session revocation and allowlist;
- read-only connector/MCP gateway first;
- structured logs, health, counters and incident center;
- security regression suite and dependency/update process;
- optional one-way Obsidian projection with reconciliation proposals.

Gate P6:

- recovery and fault matrix passes repeatedly;
- LAN client cannot reach host filesystem, provider credentials or owner-only
  commands;
- every external effect has a receipt or reconciliation item;
- operator can disable LAN/providers and continue using durable local drafts.

## Conditional extensions

Only after measured core-loop value:

- LangGraph for one cognitive loop that beats a deterministic baseline;
- FTS plus embeddings when link/lexical retrieval misses measured sources;
- limited parallel worktrees with conflict forecast;
- Plane as optional board projection;
- Postgres and Temporal when multi-user/multi-host durability triggers occur;
- marketing/media/business contexts with separate ownership, rights, costs and
  mandatory publication/payment approval.

## Verification matrix

| Boundary | Required tests |
|---|---|
| UI | keyboard, focus, mobile/desktop, form errors, empty/loading/blocked states |
| Domain | invariants, version conflicts, graph validation, DAG cycles, policy table |
| SQLite | migration, WAL writer, replay, crash, backup/restore, integrity |
| Providers | contract, stream parsing, cancel, resume, timeout, auth/rate limit |
| Workspace | dirty checkout, path traversal, symlink, timeout, process cleanup |
| Evidence | digest mismatch, stale base, missing test, reviewer disagreement |
| Git integration | branch/push/PR/merge receipt, conflict, protected branch |
| Security | secret canary, prompt injection, CSRF/origin, malicious attachment |
| Operations | disk full, corrupted index, provider outage, orphaned lease |

## Effort range

The reliable personal v1 remains approximately 15–28 engineer-weeks after the
architecture decisions, even with agent assistance. The range is dominated by
provider control, Windows/WSL sandboxing, crash recovery and security evidence,
not the intake UI. Public multi-user SaaS and automated business/media release
flows are separate projects.

## Immediate next task

Implement AI-003 now: the provider-neutral ExecutionProvider feasibility
harness with Codex owner-local first. Provider
integration must preserve the now-stable persistence/client-projection contract;
Research stays visibly blocked until a real provider run has started. Secured
LAN identity and automatic purge are explicit backlog and remain disabled.
