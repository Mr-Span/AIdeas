# Decisions

## 2026-07-18 — Product and operator boundary

Personal, single-operator product with optional secured LAN access. The
client-facing intake does not imply that clients receive provider credentials or
direct runtime access.

## 2026-07-18 — Human checkpoints

The operator intervenes at initial intake, final plan review, and when the
system cannot resolve a blocker. Push/PR/merge may be autonomous after evidence
gates. Payments, publication, and deploy always require approval.

## 2026-07-18 — Canonical data ownership

Project Graph owns approved semantics; Work Control owns execution status; Git
owns code; SQLite is the v1 operational store; Obsidian is a future
knowledge/projection surface.

## 2026-07-18 — Pilot and repository

AIdeas is the real pilot product. Its repository is public, but secrets, `.env`
files, provider sessions, client data, SQLite files, and runtime artifacts are
excluded.

## 2026-07-18 — Provider boundary

Use server-side provider adapters. Trusted personal mode may call a locally
authenticated tool, but client/product mode must use provider-supported API or
enterprise authentication and separate billing.

## 2026-07-18 — Forge name

Provisional: `Urzeon` is the leading working candidate because it evokes the
Romanian “a urzi” — to weave/construct — and no obvious exact-name software
collision appeared in preliminary checks. This is not proof of availability. It
requires operator approval and formal trademark/domain clearance before release
branding.
