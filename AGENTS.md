# AIdeas repository guidance

- Read `GPT/README.md`, `GPT/AGENT_MEMORY.md`, the active task in
  `GPT/TASKS.md`, and the latest relevant decisions, risks, and verification
  entries before broad exploration.
- Use Next.js App Router, strict TypeScript, Tailwind CSS, shadcn/ui, and
  lucide-react. Preserve server/client component boundaries.
- Keep the product local-first and personal. LAN clients must call the host API;
  they must never open or copy the SQLite file.
- SQLite is the v1 operational store. All writes must pass through one Control
  Service writer; projections and indexes must be rebuildable.
- Agents may propose typed changes but may not write canonical state directly.
- Human input is expected at intake, final review, and unresolved blockers.
  Push/PR/merge may become autonomous after evidence gates. Payments,
  publication, and deploy always require human approval.
- Provider credentials and sessions are server-side only. Never expose Codex,
  Claude, GitHub, or MCP credentials to the browser.
- Never create or commit `.env`, `.env.*`, API keys, OAuth tokens, cookies,
  provider login stores, client data, SQLite databases, runtime artifacts, or
  copied personal documents.
- Use synthetic data clearly labelled as demo data until real persistence and
  access controls exist.
- Validate every external input at the server boundary with Zod.
- Run `pnpm.cmd verify` and focused Playwright coverage before completion.
- Update `GPT/VERIFICATION.md` with factual commands and results only.
