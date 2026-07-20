# Verification

## 2026-07-20 — AI-003 broker, CLI and research loop

- Added SQLite migrations for execution runs, normalized events, provider
  threads, and terminal receipts; start is idempotent and interrupted active
  runs reconcile through provider inspection into a terminal or explicit
  `resume_available` state.
- Added guarded external Git worktrees, protected-main before/after proof,
  Windows descendant-process termination, bounded/redacted JSONL event parsing,
  and a CLI compatibility gate validated for host `codex-cli
  0.145.0-alpha.18`.
- CLI process IDs are persisted before thread start. Restart reconciliation
  verifies the OS process name/command marker and terminates the exact stale
  Codex process tree before offering explicit resume; an unverifiable process
  fails closed. Resume is protected by a transactional status CAS and an
  idempotency receipt, and uses a constant server-owned continuation prompt.
- Added a loopback-only operator session plus CSRF token. Research routes accept
  only project/revision/version/idempotency identifiers; client-supplied prompts,
  paths, provider selection, and capability grants are rejected by contract.
- `dev` and `start` bind to `127.0.0.1` by default. LAN exposure is not part of
  this gate and remains disabled until BL-001 supplies real transport identity.
- A submitted revision can now start research, poll durable progress, resume or
  cancel, persist the final Markdown report through the Artifact Store, and
  render the result in the operator UI. A step becomes green only after a real
  completed receipt.
- `pnpm.cmd verify`: pass — lint, generated route types, strict TypeScript, 13
  test files / 48 tests, and production build.
- `pnpm.cmd exec playwright test tests/e2e/intake.spec.ts`: pass — 2/2 Chromium
  desktop/mobile flows with a fresh temporary data root.
- Focused live CLI test: pass in 21.94s using the existing ChatGPT login against
  a synthetic read-only Git repository. It emitted a started and completed
  receipt, did not disclose the canary, and did not alter Git status or the
  fixture README digest.
- Live durable-broker test: pass in 66.00s. A synthetic eight-answer revision
  traversed capture, submit, external worktree, real Codex CLI, normalized
  events, Artifact Store persistence, terminal receipt, and the evidence-gated
  Research transition to `verified`.
- No real client content was used by live verification. `.env`, credentials,
  provider stores, SQLite data, worktrees, and test reports remain outside Git.
- Public branch `codex/ai003-broker-cli-research` was pushed at commit
  `474f515`; [PR #7](https://github.com/Mr-Span/AIdeas/pull/7) passed the
  clean-checkout [GitHub Actions verify](https://github.com/Mr-Span/AIdeas/actions/runs/29752905964).

## 2026-07-20 — Eight-question intake

- Replaced the hardcoded `4 din 8` prototype with eight navigable clarification
  cards and progress derived only from non-empty answers.
- Drafts can be saved at any point; submission moves to the first incomplete
  question and accepts an explicit `Nu știu încă` as an answer.
- Each answer persists in the versioned SQLite revision payload and in the
  immutable `capture.md`; legacy single-idea revisions map only to the audience
  and problem question without inventing completed answers.
- `pnpm.cmd verify`: pass; 7 Vitest files / 35 tests and production build pass.
- Focused Chromium end-to-end suite: pass, 2/2, including 1→8 completion,
  save/reload persistence, submission, mobile tracker, and no horizontal
  overflow at `390 × 844`.
- Desktop `1280 × 900` and mobile `390 × 844` screenshots render without a
  framework overlay. The integrated browser could not be reused after its
  prior connection-error page was blocked by browser URL policy, so final
  rendered evidence used the repository's isolated Chromium runner.

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

## 2026-07-18 — AI-003 harness GitHub integration

- Branch `codex/ai003-codex-provider` was published without environment files,
  secrets, databases, runtime state, client data, provider auth stores, or test
  reports.
- [GitHub Actions verify](https://github.com/Mr-Span/AIdeas/actions/runs/29645284521)
  passed on harness commit `b0b30bf`.
- [PR #4](https://github.com/Mr-Span/AIdeas/pull/4) was ready, mergeable, and
  merged into `main` as `ec869ff04a6bab4abf6d7fb9e3973a98df8d18b5`.
- Remote `refs/heads/main` and the local fast-forwarded `main` both read back as
  `ec869ff`; the working tree was clean and the local-only preview returned HTTP
  200 on `127.0.0.1:3001`.
- AI-003 remains active. The next eligible packet is the durable Execution
  Broker ledger and restart reconciliation; secured LAN and final purge remain
  backlog.

## 2026-07-20 — AI-004 specialized research round trip

- Migration 4 creates durable `research_rounds` and `research_role_runs` with
  foreign keys, checked lifecycle values and artifact references.
- Four role profiles run through the existing provider-neutral AI-003 port in
  external read-only worktrees. Intent analysis has network/web disabled; the
  other three roles receive live-web grants. Concurrency is bounded to two.
- Codex CLI `--output-schema` was verified from the installed command help and
  is now wired to a server-owned temporary schema file. The SDK path continues
  to receive the same schema directly.
- Focused owner-local live suite after the CLI schema change: 1 file / 3 tests
  passed in 64.95s. `codex exec` returned schema-valid JSON from a synthetic
  read-only repository, the SDK structured run passed, cancellation passed,
  the canary stayed redacted and the fixture checkout remained unchanged.
- Typed output validation enforces HTTP(S) URLs, ISO retrieval time,
  quote/summary boundary, confidence, 25-word quote limit and evidence for
  market findings.
- Deterministic reconciliation retains contributing roles and distinct
  evidence, merges duplicate titles/questions, and links explicit opposing
  stances without hiding either proposal.
- Operator-only APIs reject missing sessions and client-supplied roles, prompts
  or capability grants. Approval validates card IDs, blocking answers and A/B
  options before creating a new immutable revision.
- The integration fixture contains an explicit prompt-injection string. All
  four provider calls retained server prompts and grants; no provider output
  writes canonical state without the approval command.
- `pnpm.cmd lint`: pass.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:run`: pass, 16 files / 54 tests.
- `pnpm.cmd build`: pass, including both AI-004 dynamic routes.
- First `pnpm.cmd verify:full` passed lint, typecheck, all 54 tests and build;
  Playwright could not start because the existing PID 8800 dev server held the
  repository's Next dev lock. PID 8800 was verified as Node and stopped.
- First five-test Chromium run found a real concurrent operator-session race:
  AI-003 and AI-004 bootstrap requests could issue different cookie/token pairs.
  A shared in-flight session promise fixed the race.
- Final `pnpm.cmd test:e2e`: pass, 5/5 Chromium tests. Coverage includes the
  AI-004 proposal/evidence view, blocking question, A/B selection and approved
  revision, plus existing durable intake, two-way collaboration, mobile
  overflow and visual checks.
- Final post-documentation `pnpm.cmd verify:full`: pass; lint, TypeScript,
  16 files / 54 tests, production build and 5/5 Chromium tests all passed in
  one clean gate. `pnpm.cmd audit --prod`: no known vulnerabilities.
- Live client-data research was not run. Provider behavior is covered by the
  same local adapters validated in AI-003 plus synthetic AI-004 provider-port
  fixtures. Interrupted multi-role rounds fail visibly and require an explicit
  new round; partial-role resume remains a product decision.

## 2026-07-20 — AI-005 final plan and autonomous execution gate

- Migration 5 was exercised on fresh SQLite stores and now includes plan,
  approval, work DAG, ContextPacket, attempt/lease, EvidenceBundle, action
  approval and integration receipt records. AI-004 round digest, retry lineage,
  token usage and billable-copy fields are included in the same migration.
- Plan validation fixtures cover valid traceability plus missing references,
  cycles and unexplained file ownership overlap. Policy fixtures cover green
  autonomous Git, stale base, failed secret scan and digest-bound deploy
  approval.
- The plan round-trip fixture generated a typed plan through the provider port,
  approved the exact digest and policy version, materialized two task packets
  and one dependency, and updated the client-safe plan step only after approval.
- The work-execution fixture changed a synthetic repo in an external worktree,
  used workspace-write for the worker and read-only for a separate verifier,
  created an isolated commit/branch, kept the protected checkout clean and
  persisted EvidenceBundle. A second fixture inserted a secret-shaped
  `API_KEY`; the attempt was blocked before commit and produced no evidence.
- The synthetic GitHub adapter exercised policy evaluation, push/PR/merge
  ordering and terminal merge receipt. Deploy remained denied until a distinct
  action approval was persisted.
- AI-004 hardening fixtures prove retry only reruns incomplete roles on the same
  round digest and that the per-round token budget blocks provider work. The
  test exposed a parallel cleanup race; `Promise.allSettled` now waits for both
  roles before the round becomes terminal.
- `pnpm.cmd verify`: pass with lint, TypeScript, 21 files / 68 tests and a
  warning-free Next.js production build exposing all AI-005 routes.
- Initial six-test Playwright run used two workers against one SQLite/dev-server
  instance; 5/6 passed and the intake hydration flow raced before its first
  controlled input update. The harness now uses one worker, matching the
  single-writer architecture. The two intake tests passed alone, then final
  `pnpm.cmd test:e2e` passed 6/6 Chromium tests.
- `pnpm.cmd audit --prod`: no known vulnerabilities. `git diff --check`: pass.
- Owner-local live AI-005 contract: 1/1 passed in 32.30s. The installed Codex
  CLI returned a schema-valid acyclic implementation plan from a synthetic
  read-only repo with network/web disabled; the fixture checkout remained
  clean. No client data was used.
