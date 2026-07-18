# Codex and Claude provider adapters

Verified against official documentation on 2026-07-18. Provider behavior and
terms must be revalidated before implementing the adapter.

## Decision

AIdeas exposes a provider-neutral server-side port. The browser sees normalized
run state and safe events, never provider credentials or a raw privileged
protocol.

Implementation order:

1. Codex adapter because AIdeas and the wider forge are Codex-first;
2. Claude adapter behind the same contract;
3. accept/reject each adapter by contract and security tests, not feature count.

## Codex

OpenAI documents the TypeScript Codex SDK for server-side use and specifically
lists internal tools, applications, agents and CI/CD as use cases. A thread can
be continued or resumed, which fits AIdeas' provider port. For automation, the
SDK is preferred over a custom App Server client. The App Server supports rich
clients and JSON-RPC; its WebSocket transport is documented as experimental and
unsupported, so AIdeas v1 will not expose it as a remote browser service.

Codex can authenticate locally with ChatGPT or an API key. OpenAI recommends API
key authentication for programmatic workflows and warns not to expose Codex
execution in untrusted or public environments. Therefore:

- trusted owner mode may use a local authenticated Codex installation;
- client/product mode uses supported programmatic authentication and isolated
  billing/runtime;
- no ChatGPT login session is copied into AIdeas, a client browser, Git or a
  remote runner;
- `codex exec --json` is a controlled fallback, not the primary contract.

Official sources:

- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Codex authentication](https://learn.chatgpt.com/docs/auth)
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

## Claude

Anthropic's current TypeScript integration is the Claude Agent SDK package
`@anthropic-ai/claude-agent-sdk`. It streams messages and exposes cancellation,
session and permission controls suitable for the normalized provider port.

Anthropic states that third-party developers may not offer `claude.ai` login or
subscription rate limits inside their products without prior approval, and that
products/services should use API key authentication through Claude Console or a
supported cloud provider. Therefore:

- an ordinary individual may use local Claude Code for trusted personal work;
- AIdeas must not present the operator's Claude subscription as a login for a
  client-facing product;
- supported API/cloud authentication is mandatory for product/client mode;
- API credentials remain server-side and outside the public repository.

Official sources:

- [Claude Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart)
- [Claude Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Claude Code authentication](https://code.claude.com/docs/en/authentication)
- [Claude legal and compliance guidance](https://code.claude.com/docs/en/legal-and-compliance)

## Normalization tests

Both adapters must demonstrate:

- version/capability preflight;
- structured start and stable provider run ID;
- streamed messages and tool lifecycle without secret leakage;
- cancellation and timeout;
- session inspect/resume after process restart where supported;
- authentication failure, unavailable model, rate limit, billing/quota and
  provider outage mapping;
- bounded working directory and capability policy;
- usage telemetry only when the provider reports it; no estimates presented as
  measured cost;
- final result and artifacts referenced by digest;
- no direct canonical state or approval mutation.

## Explicit non-goals for the first adapter slice

- sharing personal subscription access with clients;
- browser-to-provider direct calls;
- remote unsupported WebSocket App Server exposure;
- silently falling back to another provider/account or billing mode;
- multi-tenant credential storage;
- unattended deploy, publication or payment.
