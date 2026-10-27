# Household portal

Minimal React/TypeScript UI and Node 24 BFF for sign-in and a protected tenant directory.
GitLab is **disabled**. No live tenant data, credentials, client registrations or privileged operations are included.

## Local development

Use Node 24 LTS and npm. `npm ci`, `npm run check`, then `npm start`.
By default the server binds `127.0.0.1:3000` and serves the Vite build. The disconnected UI
can be inspected at http://127.0.0.1:3000; authentication requires an independently
approved HTTPS reverse proxy at `PORTAL_ORIGIN` because cookies are always Secure.
Copy `.env.example` to ignored `.env` only when identity configuration is approved.
No development option disables cookie security or token verification.
The tenant repo owns Kubernetes/Fleet definitions; this app repo provides its Dockerfile.
`TENANT_SOURCE=mock` produces one explicitly labeled fixture after authentication.
`TENANT_SOURCE=disabled` (default) returns an empty directory with disconnected metadata.
Any other mode fails startup. No GitLab network client exists.

Commands: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`,
`npm audit --omit=dev --audit-level=high`. Tests use ephemeral localhost OIDC fixtures;
no Keycloak instance, container, cluster, or GitLab is needed.

See [security](security.md), [design](design.md), and [deployment gates](deployment.md).
