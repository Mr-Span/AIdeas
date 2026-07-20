# AIdeas

AIdeas is a personal, local-first workspace for turning a rough application or
website idea into a researched, clarified, reviewable, and eventually
executable implementation plan.

The repository is also the pilot project for the wider agentic forge. The
operator-selected working name is `Faur`, but public umbrella branding remains
unresolved because a direct AI-market collision exists. AIdeas must prove the
workflow on itself before it is trusted to build other products.

## Current status

The personal single-host pilot now includes:

- durable SQLite intake, revisions, Markdown/media artifacts and two-way client
  collaboration;
- Codex owner-local execution through a provider-neutral server adapter;
- four bounded research roles with typed evidence, redaction consent, retry and
  budget controls;
- a typed architecture plan, deterministic DAG validator, visual plan review
  and digest-bound operator approval;
- durable task packets, immutable ContextPackets, isolated worktree execution,
  allowlisted checks, independent review and EvidenceBundles;
- policy-gated push, PR and merge with remote readback and explicit approval
  pause when required.

Claude, secured LAN, automatic retention purge, deploy, publication and payment
adapters are not enabled. Only synthetic data belongs in repository tests.

## Run locally

Requirements: Node.js 24 and pnpm 11.7.

```powershell
pnpm.cmd install
pnpm.cmd dev
```

Open `http://localhost:3000`.

Verification:

```powershell
pnpm.cmd verify
pnpm.cmd exec playwright install chromium
pnpm.cmd test:e2e
```

## Security boundary

This public repository intentionally contains no `.env` file, API key, OAuth
token, personal provider session, client data, local SQLite database, or runtime
artifact. Provider credentials will stay outside the repository and outside the
browser. See [Security](docs/SECURITY.md) and
[Provider adapters](docs/PROVIDER_ADAPTERS.md).

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [AI-005 executable architecture packet](docs/AI005_ARCHITECTURE_PACKET.md)
- [Open decisions](docs/OPEN_QUESTIONS.md)
- [Data ingest and retention](docs/DATA_INGEST_AND_RETENTION.md)
- [Naming and clearance status](docs/NAMING.md)
- [Design specification](docs/design/README.md)
- [Agent resume packet](GPT/README.md)

## License

Licensed under the [MIT License](LICENSE).
