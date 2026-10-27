# Design

React + TypeScript + Vite provides a small responsive UI. Fastify serves its static
build and BFF/API routes. openid-client performs OIDC; jose verifies JWTs. The
Node process is the only token holder. Current official references:
- https://github.com/panva/openid-client (code flow, PKCE and nonce)
- https://github.com/panva/jose (JWT/JWKS verification)
- https://vite.dev/guide/ (build tool)
- https://nodejs.org/en/download (Node 24 LTS)

Flow: browser cookie → BFF → bearer access token → protected API → tenant adapter.
The future GitLab adapter is a separate trust boundary: Keycloak access tokens must
never become GitLab administrative credentials or be forwarded to GitLab.

The adapter fixes its source to exact logical group path
`/PerkForge/platform/tenants`. Initial assumption: tenants are its **direct
subgroups**, with no recursive traversal. Future resolution must strip only the
leading display slash when encoding GitLab's group identifier and preserve case.
Return only bounded `{id, name, path}` DTOs, with at most 100 direct groups,
explicit pagination/truncation metadata, bounded text lengths, and approved
household visibility rules before live access. Current fixtures contain one
static DTO; no arbitrary provider JSON or user-selected group paths are accepted.

All responses carry source metadata (`mode`, `connected: false`, `provider`,
`path`, `scope`). Disabled mode is empty; mock mode uses `fixture-home` and the UI
labels it example data. Neither claims live health or real tenant presence.

Future GitLab/Keycloak mutation operations have no routes, credentials, grants,
or feature switches here. Adding them requires explicit authorization, least
privilege scopes, per-operation authorization, CSRF, audit redaction and threat
review. The portal remains a Home household application, not platform administration.

Deployment ownership: application source/image build stays here; Helm/Fleet app
definitions live in perkforge-tenant-portal; platform foundations/security and
registration live in perkforge-platform. See deployment.md.
