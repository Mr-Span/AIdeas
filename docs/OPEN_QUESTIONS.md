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
- client/operator collaboration is two-way;
- the client sees the resulting plan as high-level steps and a compact tracker;
- only verified steps are green; raw research and engineering internals stay
  outside the client projection.

## Branding decision for the pilot

The operator selected `Faur`, from Romanian `a făuri`. Research found an
existing Bucharest AI company at `faur.ai` whose platform includes a product
named `Forge`. `Faur` is therefore authentic but not unique in the target
category. The operator decided to keep it temporarily as an internal working
name and replace it later. AIdeas remains the public product name; no public
`Faur` rebrand is part of AI-002.

## Point 4 — client contribution mode

The architecture supports owner and limited-client actors without changing the
canonical pipeline. Result visibility is now confirmed: the client sees the
published plan steps, their safe status/next action, and verified-green
progress, with a two-way public question/answer thread. The client does not see
raw research, prompts, Git/provider/database detail, or internal evidence.

The first pilot must still decide:

1. separate client device over secured LAN, operator-assisted entry, or an
   importable submission bundle;
2. the identity/session mechanism for the separate client;
3. whether public-internet access is explicitly excluded from v1.

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
