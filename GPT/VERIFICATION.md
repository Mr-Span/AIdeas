# Verification

## 2026-07-18 — Bootstrap checks

- Target path `C:\Users\claux\Documents\AIdeas` did not exist before creation.
- The production starter was copied from
  `Environment/templates/nextjs-saas`, excluding `.env*`, `node_modules`,
  `.next`, reports, test results, and build metadata.
- Template-only Neon, Sentry, Better Auth, Drizzle, and Stripe code and
  dependencies were removed; the pilot currently has no provider credentials
  and no persistence layer.
- `pnpm.cmd install`: pass; lockfile supply-chain policy reported pass.
- `pnpm.cmd lint`: pass.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:run`: pass, 1 file / 3 unit tests.
- `pnpm.cmd build`: pass; Next.js `16.2.10` produced the static `/` route.
- `pnpm.cmd test:e2e`: pass, 4/4 Chromium tests including the accepted desktop
  and mobile viewports.
- Focused non-visual Playwright rerun: pass, 2/2 tests and no hydration warning.
  The earlier warning appeared only while Playwright injected temporary caret
  styles for screenshots.
- Visual review completed against
  `docs/design/aideas-intake-desktop-v1.png` and
  `docs/design/aideas-intake-mobile-v1.png`.
- No horizontal overflow was detected at `390 × 844`.
- Repository scan found no `.env` files and no high-signal secret patterns.
- `.gitignore` excludes environment files, local AIdeas state, SQLite files,
  build output, coverage, Playwright reports, and TypeScript build metadata.
- GitHub CLI `2.96.0` is authenticated as `Mr-Span`.
- `Mr-Span/AIdeas` did not exist at preflight time.
- Staged `git diff --check`: pass; staged secret scan: clean.

## 2026-07-18 — Publication readback

- Public repository created at `https://github.com/Mr-Span/AIdeas`.
- GitHub readback reports `visibility: PUBLIC`, `isPrivate: false`, and default
  branch `main`.
- Initial remote commit:
  `a12310fe0d4e82327ff98b3057ab11f693016ce5` (`Bootstrap AIdeas pilot`).
- Recursive remote tree readback returned 69 paths.
- Remote path scan found no `.env`, `.aideas`, database/SQLite, Playwright
  report, test-results, or TypeScript build-metadata path.
- Local `main` tracks `origin/main`.

## 2026-07-18 — Decision record v0.3

- Operator decisions captured: MIT license, Codex owner-local first, immutable
  Markdown/media ingest, SQLite manifest ownership, and provisional active plus
  30-day post-completion retention.
- Exact-name research found an existing Romanian AI company at `faur.ai` with a
  `Forge` product; `Faur` is recorded as internal/provisional rather than unique
  or legally cleared.
- New data-ingest specification separates file bytes in an Artifact Store from
  structured manifests and Project Graph state in SQLite.
- `pnpm.cmd lint`: pass.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:run`: pass, 1 file / 3 tests.
- No application source or rendered UI changed; the branch CI build remains the
  clean-clone production-build gate.
- Notion hub, AIdeas pilot, architecture, implementation, and reconciliation
  pages were updated and read back successfully with no stale `Urzeon` entry.

## 2026-07-18 — AI-002 durable drafts and client tracking

- SQLite control storage uses WAL, foreign keys, defensive mode, an explicit
  busy timeout, immutable revisions, idempotency receipts, audit records, and
  one service-owned writer boundary.
- Backup now produces an immutable bundle containing a hashed SQLite snapshot,
  manifest, and every referenced artifact. Restore is fresh-root and atomic;
  the integration test reconstructs uploaded media and the public conversation,
  then passes `integrity_check`.
- Markdown/media bytes are stored by SHA-256 outside Git; SQLite stores their
  manifests and revision links. Final targets are revalidated after atomic
  rename or concurrent deduplication, including symbolic-link checks.
- Public project responses expose only the allowlisted client DTO. They omit
  prompts, raw research, internal evidence, provider/Git/database/storage
  details, private notes, and the provisional `Faur` name.
- Public collaboration is persisted as a two-way thread. Until transport and
  authentication are chosen, browser-originated authors are always marked
  `unverified`; callers cannot self-assign the client or operator role.
- The client mini-tracker publishes five high-level steps. Only an internally
  evidence-bound `verified` transition renders green; clients cannot mutate
  plan status. A disconnected provider leaves Research visibly blocked and no
  agent is claimed to have started.
- `pnpm.cmd verify`: pass; lint, TypeScript, 4 Vitest files / 18 tests, and the
  warning-free Next.js 16.2.10 production build all passed.
- `pnpm.cmd test:e2e`: pass, 4/4 Chromium tests covering durable save,
  collaboration, repeated selection of the same upload, truthful
  submit/progress, screenshots, and mobile overflow.
- In-app browser QA passed at 1280 px and 390 × 844: correct green/red/neutral
  states, all five mobile stages, saved SQLite version, public message, no
  horizontal overflow, and no framework overlay or console error.
- The remaining LAN release gates are authenticated client/operator identity
  and an upstream request-size cap; provider execution remains intentionally
  disconnected. Exact purge/audit/backup behavior after the provisional 30-day
  retention deadline remains a product decision.

## 2026-07-18 — AI-002 GitHub integration

- Branch `codex/ai002-durable-drafts` was published without environment files,
  secrets, SQLite state, client data, build output, or test reports.
- The first PR run exposed a clean-clone-only issue: the unanchored
  `artifacts/` ignore rule also excluded `src/server/artifacts/`. The rule was
  narrowed to `/artifacts/`, the source module was added, and local typecheck
  plus 18 tests passed again.
- [GitHub Actions verify](https://github.com/Mr-Span/AIdeas/actions/runs/29643277500)
  passed on final branch commit `f5e2972`.
- [PR #2](https://github.com/Mr-Span/AIdeas/pull/2) was marked ready only after
  the check passed, then merged into `main` as `97c3153`.

## 2026-07-18 — AI-003 owner-local Codex feasibility harness

- Priority was realigned: AI-003 is the sole active implementation front;
  secured LAN identity/transport and final purge semantics are explicit backlog
  with both features still disabled. The same state was written to and read
  back from the AIdeas pilot and implementation-plan pages in Notion.
- Target-host readback: system `codex-cli 0.145.0-alpha.18` and
  `codex login status` reports `Logged in using ChatGPT`.
- Official `@openai/codex-sdk` `0.144.5` is pinned. Its installed package
  documents that it wraps a pinned Codex CLI and exchanges JSONL over
  stdin/stdout. `codex exec` is the stable fallback/diagnostic surface; local
  `codex app-server --help` identifies App Server as experimental.
- Provider-neutral start/event/cancel/inspect contracts, safe error vocabulary,
  workspace policy, environment allowlist, secret redaction, output bounds,
  timeout, cancellation, duplicate-run rejection, and disabled-by-default
  behavior are implemented under `src/server/execution`.
- The SDK harness disables lifecycle hooks and configured MCP servers through
  config overrides. A fixture containing project-scoped `.codex` configuration
  is rejected before provider start. The browser and project API are not wired
  to the provider.
- Focused contract/integration suite: 2 files / 14 tests — pass. It includes
  consumer-disconnect cancellation and protected/out-of-root workspace blocks.
- Real owner-local suite `pnpm.cmd test:ai003:live`: 1 file / 2 tests — pass
  after the security overrides. One run returned JSON-Schema output in a
  read-only synthetic repo; the second was cancelled after the real
  `thread.started` event.
- Live fixture readback: Git status stayed clean and the README SHA-256 stayed
  unchanged after both runs. The synthetic canary was absent from every
  normalized AIdeas event. The main AIdeas checkout was a forbidden path.
- Honest boundary: SDK threads are provider-managed resumable local sessions.
  The harness proves AIdeas event redaction, not removal from provider session
  history. Only synthetic data was used.
- Final post-hardening `pnpm.cmd verify`: pass with lint, TypeScript, 6 files /
  32 tests, and a warning-free Next.js production build.
- `pnpm.cmd audit --prod` initially reported one moderate PostCSS advisory on
  Next's transitive `postcss@8.4.31`. A workspace override pins `8.5.16` for the
  dependency tree; `pnpm why postcss` reports one patched version and the final
  production audit reports no known vulnerabilities.
- Post-override `pnpm.cmd verify`: pass again with 6 files / 32 tests and the
  production build. Final focused lint and typecheck after Playwright config
  hardening also pass.
- A repeated dev-mode E2E run on the old fixed `.aideas/e2e` data root exceeded
  the original 5-second expectations while API buttons remained pending. The
  harness now creates a fresh OS-temp data root per invocation and uses bounded
  30-second expectations / 120-second test limits for slow Windows cold-route
  compilation; no local retry was added.
- Final `pnpm.cmd test:e2e`: pass, 4/4 Chromium tests. The existing intake
  remains truthful: Research is blocked because no operator-only project run
  route is enabled yet.
