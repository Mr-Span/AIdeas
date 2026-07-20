# Decisions

## 2026-07-20 — AI-003 execution boundary

The trusted-host web runtime uses the stable `codex exec --json` adapter by
default because it can use the existing Codex/ChatGPT login without bundling the
SDK executable discovery into a Next.js route. `AIDEAS_CODEX_PROVIDER=sdk`
retains the official SDK adapter as an explicit option. Both implement the same
provider-neutral contract and stay disabled unless
`AIDEAS_CODEX_ENABLED=1` is set on the trusted server process.

Only a loopback request with an HttpOnly operator-session cookie and matching
CSRF token may start, resume, or cancel research. Browser input cannot choose a
prompt, host path, provider, sandbox, network grant, or approval policy. The
server compiles the submitted revision and labels all captured/client content
as untrusted data. LAN execution remains disabled until BL-001.

## 2026-07-18 — AI-003 is the sole active front

The operator prioritized the Codex owner-local integration and research
feasibility slice. Secured LAN client identity/transport and the final
post-retention purge semantics move to explicit backlog and do not block
AI-003. Both features remain disabled until their later evidence gates pass.

Local verification found Codex authenticated through ChatGPT. The official
TypeScript SDK is the primary server-side adapter surface; stable
`codex exec --json` remains the fallback and diagnostic path. Experimental App
Server transport is not part of the pilot's critical path.

## 2026-07-18 — Product and operator boundary

Personal, single-operator product with optional secured client contribution.
The client-facing intake never grants provider credentials, repository access,
database access, host paths, execution, or external-side-effect authority.

## 2026-07-18 — Human checkpoints

The operator intervenes at initial intake, final plan review, and when the
system cannot resolve a blocker. Push/PR/merge may be autonomous after evidence
gates. Payments, publication, and deploy always require approval.

## 2026-07-18 — Canonical data ownership

Project Graph owns approved semantics; Work Control owns execution status; Git
owns code; SQLite owns structured operational records and manifests; original
Markdown/media and large outputs live in a content-addressed Artifact Store
outside Git. Obsidian remains a future knowledge/projection surface.

## 2026-07-18 — Owner and client ingest

Owner and limited-client modes use the same capture pipeline. Client data is
first preserved as immutable Markdown/media artifacts and recorded in SQLite by
manifest, digest, provenance, links, audit, and retention state. A client never
writes SQLite or calls Codex directly. Only the trusted Control Service may
enqueue analysis after persistence and policy checks.

Point 4 remains open: separate secured-LAN client, operator-assisted entry, or
an importable submission bundle for the first pilot.

## 2026-07-18 — Client-visible plan and two-way review

The client/engineer relationship is two-way. The client can submit input,
answer public questions, send corrections, and review the resulting plan. The
client sees only high-level published plan steps and a compact progress tracker;
only evidence-verified steps are green. Prompts, raw research, provider/Git/DB
details, internal evidence, and private engineering notes remain operator-only.
The transport and authenticated client-session mechanism remain open.

## 2026-07-18 — Retention

Provisional default: retain project data while active and for 30 days after an
explicit operator completion event. Reopening cancels the deadline; pin/legal
hold suspends purge. Post-purge audit data, warnings, backup deletion lag, and
early client deletion remain open under point 5.

## 2026-07-18 — Provider order

Implement Codex owner-local first on the trusted operator host. Stabilize a
provider-neutral contract before adding Claude API/product mode. Never share the
operator's personal session with a client.

## 2026-07-18 — Public license

The AIdeas public repository uses the MIT License, copyright 2026 Mr-Span.

## 2026-07-18 — Forge name and collision

The operator selected `Faur`, from Romanian `a făuri`, as the desired forge
name. Research found an existing Bucharest enterprise-AI company at `faur.ai`
whose platform includes a product named `Forge`, plus the established FAUR SA.
Therefore `Faur` is recorded as a working/internal name, not a cleared unique
public brand. AIdeas public branding remains unchanged pending an explicit
collision decision and formal clearance.

The operator has chosen to keep `Faur` temporarily and replace it later. No
public rebrand is authorized during AI-002.

## 2026-07-20 — AI-004 data and retry policy

Raw research remains operator-only. An operator may explicitly publish a
selected clarification into the public client thread. Starting a specialized
round requires consent after a redaction preview; the server applies the same
secret, email and phone redaction before building provider context. Interrupted
rounds retry only incomplete roles and remain bound to the original round
digest. Concurrency is capped at two and token budgets are enforced per round
and calendar month. Every nonblocking card requires either an answer/choice or
an explicit dismiss reason.

## 2026-07-20 — AI-005 execution and integration policy

The final plan is immutable after approval and is signed by project revision,
plan digest and `aideas-policy-v1`. Task packets use server-owned verification
commands and evidence requirements. Workers may edit only declared file scopes
inside an external worktree; they cannot commit or trigger external actions.
The control service performs the isolated commit only after checks, secret scan
and independent review. Push, PR and merge may continue automatically when the
project toggle is off; with the toggle on, the integration run pauses at the
exact action target. Payment, publication and deploy always pause for a
separate action approval.
