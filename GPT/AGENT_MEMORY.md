# Agent memory

- Product: AIdeas, a personal local-first idea-to-execution workspace and the
  pilot for the wider forge.
- User boundary: one operator; optional secured LAN access from the operator's
  devices. This is not yet a public multi-user SaaS.
- Human checkpoints: intake, final plan review, and unresolved blockers.
- Repository actions: push, PR, and merge may be autonomous after evidence
  gates and policy evaluation. Payments, publication, and deploy always require
  approval.
- Framework: Next.js App Router, React, strict TypeScript, Tailwind CSS,
  shadcn/ui, lucide-react.
- Data decision: SQLite v1, single writer on the Control Service host; no shared
  database file over LAN.
- Canonical semantics: Project Graph. Obsidian may later be a human knowledge
  surface and projection, never the operational database.
- Provider boundary: adapters for Codex and Claude run server-side. Personal
  local sessions may be supported only in trusted owner mode; client/product
  mode requires supported API or enterprise authentication.
- Current code: UI-only vertical with truthful non-persistence and disconnected
  provider states. It does not execute agents.
- Verification: `pnpm.cmd verify`, then focused Playwright tests.
- Secrets: no `.env` files, API keys, tokens, login stores, databases, client
  content, or runtime artifacts in Git.
