# Agent memory

- Product: AIdeas, a personal local-first idea-to-execution workspace and the
  pilot for the wider forge.
- Forge naming: operator selected `Faur` from `a făuri`, but `faur.ai` is an
  existing Romanian AI company with a `Forge` product. Treat Faur as an
  internal/working name until collision and legal clearance are resolved.
- User boundary: one operator plus an optional limited client contributor. This
  is not a public multi-user SaaS.
- Human checkpoints: intake, final plan review, and unresolved blockers.
- Repository actions: push, PR, and merge may be autonomous after evidence
  gates and policy evaluation. Payments, publication, and deploy always require
  approval.
- Framework: Next.js App Router, React, strict TypeScript, Tailwind CSS,
  shadcn/ui, lucide-react.
- Data decision: one SQLite writer owns structured records/manifests; immutable
  Markdown/media bytes live in a content-addressed Artifact Store outside Git.
- Intake modes: owner and limited client use the same capture pipeline. The
  client never opens SQLite or receives provider/repository authority.
- Retention: provisional active-project lifetime plus 30 days after explicit
  completion; point 5 still owns purge/audit/backup/early-deletion details.
- Canonical semantics: Project Graph. Obsidian may later be a human knowledge
  surface and projection, never the operational database.
- Provider boundary: implement Codex owner-local first on the trusted host.
  Claude API/product mode follows only after the common contract is stable.
- Public license: MIT, copyright 2026 Mr-Span.
- Current code: UI-only vertical with truthful non-persistence and disconnected
  provider states. It does not execute agents.
- Verification: `pnpm.cmd verify`, then focused Playwright tests.
- Secrets: no `.env` files, API keys, tokens, login stores, databases, client
  content, or runtime artifacts in Git.
