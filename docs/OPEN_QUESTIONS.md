# Decisions and remaining questions

## Confirmed on 2026-07-18

- public repository license: MIT;
- first execution provider: Codex owner-local on the trusted operator host;
- client/product browser never receives the local Codex session or credentials;
- client submissions are preserved as Markdown plus media artifacts;
- SQLite stores structured state, manifests, provenance, digests, links, and
  retention state rather than large binary media blobs;
- provisional retention: through active project work and 30 days after explicit
  completion;
- repository approval toggle defaults off (autonomous after evidence gates),
  while policy may force approval.

## Branding blocker

The operator selected `Faur`, from Romanian `a făuri`. Research found an
existing Bucharest AI company at `faur.ai` whose platform includes a product
named `Forge`. `Faur` is therefore authentic but not unique in the target
category. Decide whether it remains an internal name, is used despite the
collision after legal review, or is replaced by a distinctive public form.

## Point 4 — client contribution mode

The architecture supports owner and limited-client actors without changing the
canonical pipeline. The first pilot must still decide:

1. separate client device over secured LAN, operator-assisted entry, or an
   importable submission bundle;
2. append-only client revisions versus editing an unsubmitted draft;
3. whether the client sees returned research/plan results;
4. whether public-internet access is explicitly excluded from v1.

## Point 5 — retention and deletion

The provisional lifecycle is `active -> completed -> 30-day grace -> purge`.
Still confirm:

1. completion is an explicit operator action rather than inferred from merge,
   delivery, or billing;
2. whether a seven-day warning is informational or deletion needs approval;
3. what minimal audit/digests may remain after file purge;
4. maximum backup deletion lag (recommended: 30 additional days);
5. client early-deletion requests and any contractual evidence exception.

The client-mode transport and final purge semantics do not block the AI-002
local persistence slice. They do block enabling LAN client upload and automatic
deletion in production.
