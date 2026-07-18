# Open decisions for operator confirmation

Most architecture-changing questions are closed. These decisions remain:

## 1. Forge name

Recommendation: approve `Urzeon` as the working name and run formal clearance
before using it publicly. Alternative: keep `Project Forge` as codename while a
new naming round is run.

## 2. Public repository license

The repository should remain public without a license until you choose one.
That preserves copyright but does not grant reuse rights. Recommendation for an
open-source project: Apache-2.0 if you want an explicit patent grant; MIT if you
want the shortest permissive license.

## 3. Personal provider authentication

Recommendation: support two explicit modes, never an ambiguous shared login:

- `owner-local`: call the operator's locally authenticated provider on the
  trusted host, personal use only;
- `api-product`: supported API/enterprise credentials and separate billing for
  any client-facing or public service.

Confirm whether v1 should implement `owner-local` for both providers or Codex
first, followed by Claude API mode.

## 4. Client role on LAN

Recommendation: even though the installation is personal, model two roles from
the first LAN release:

- operator: providers, repositories, approvals and execution;
- contributor/client: assigned intake, notes and media only.

Confirm whether a client will ever connect from a separate device in the first
pilot, or whether all client input is entered by you.

## 5. Media retention

Recommendation: file bytes live in a content-addressed local artifact directory;
SQLite stores metadata, digest, provenance and retention state. Confirm the
default retention window for rejected/unapproved media; proposed default is 30
days with manual pinning.

## 6. Approval-toggle default

Requirement says push/PR/merge should be autonomous. Recommendation: repository
approval toggle defaults **off**, while risk policy can force approval. Confirm
that new projects should inherit this autonomous default.

None of these blocks publishing the current public-safe UI shell. They must be
closed before their corresponding runtime feature ships.
