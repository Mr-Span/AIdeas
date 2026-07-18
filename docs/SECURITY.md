# Security and public repository policy

AIdeas is public source code operating near local repositories, provider
accounts and client ideas. Its safe default is no secret, no client data and no
external side effect.

## Never commit

- `.env` or `.env.*` files, including examples that encourage copied values;
- API keys, OAuth tokens, session cookies, access/refresh tokens or private keys;
- Codex, Claude, GitHub, browser, MCP or operating-system credential stores;
- SQLite databases, WAL/SHM files, backups or migration snapshots containing
  user data;
- client ideas, media, portfolios, personal documents or real project exports;
- run logs, prompts, screenshots or artifacts containing private content;
- local worktrees, build output, coverage, Playwright reports or caches.

The public repository uses synthetic, clearly labelled fixtures only.

## Runtime secret model

The browser never receives provider credentials. In trusted owner mode, the
server-side adapter may call an already authenticated local CLI/SDK using the
provider's credential store. In API/product mode, secrets come from an OS
credential store or approved secret manager and are injected only into the
provider subprocess/request boundary.

AIdeas documentation lists setting names and setup flows, not secret values. No
repo-local env file is required by the current UI.

## Trust zones

```text
untrusted: client/browser input, web pages, attachments, model output, MCP output
controlled: Control Service commands, schemas, policy engine, audit and outbox
privileged: provider adapter, Git credential helper, workspace manager, backups
canonical: SQLite records, Git commits, content-addressed artifacts
```

Data crossing from untrusted to controlled is size-limited, content-typed,
validated and stored with provenance. Text inside a source or attachment is
data; it cannot grant tools, network, filesystem or side-effect permission.

## Required controls before provider execution

- threat model for local host, LAN client, malicious source and malicious repo;
- exact capability grants for path, command, tool, network, time and action
  class;
- process-tree timeout/cancellation and worktree isolation;
- secret-canary tests across prompt, stdout/stderr, event stream and artifacts;
- redaction before persistence and observability;
- provider auth/rate-limit errors converted to safe stable codes;
- no raw provider event serialized directly to the browser;
- dependency lockfile and update verification.

## Required controls before LAN mode

- LAN disabled by default and explicit bind configuration;
- TLS or trusted encrypted tunnel;
- strong operator authentication and separate limited client role;
- origin allowlist, CSRF protection, session revocation and rate limits;
- upload size/type restrictions, safe preview and content quarantine;
- owner-only provider, repository integration and approval endpoints;
- emergency disable switch and audit readback.

## Approval integrity

An approval is valid only for its exact action class, target, subject digest,
policy version and expiration. Git approval cannot authorize deploy, publication
or payment. Any material change invalidates approval and re-runs policy.

## Public-publish checklist

Before every push:

1. inspect `git status --short --branch` and the full intended diff;
2. stage explicit paths or the whole tree only when the new repo scope is known;
3. search tracked candidates for env files, secrets, tokens, credentials,
   databases, client terms and generated artifacts;
4. run lint, typecheck, tests and production build;
5. run focused browser checks for changed journeys;
6. inspect the committed tree, then push;
7. read back repository visibility, default branch, commit and file tree from
   GitHub.

If a secret ever enters Git history, stop publication, revoke/rotate it first,
then follow an explicitly approved history-remediation procedure.
