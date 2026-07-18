# Decisions

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
