# Platform Explorer

Open **Architecture documents** or `/#/explore/identityLifecycle`. The portal embeds the official
LikeC4-generated React renderer; there is no remote iframe or diagram service.
The diagram is lazy loaded, preserving the small workspace entry bundle. Its
renderer is approximately 704 kB gzipped; cache policy remains the portal's no-store.

The first four identity views cover the end-to-end lifecycle, bootstrap, human access,
and workload access. Six retained reference views cover panorama, platform internals, identity/trust/data flows,
proposed platform authorization scope, generic tenant isolation, and planned image
intake. Three guided journeys cover identity, image intake and portal sign-in.
Keyboard-accessible text cards and relationship lists provide equivalent prose
when a diagram cannot be loaded or used. Search/status filters apply to cards;
the complete visual context remains visible. Hash navigation supports deep links,
refresh and browser back/forward. Nothing in the explorer controls a cluster.

## Model and provenance

`src/architecture/catalog.json` is the single reviewed source for nodes, edges,
view scopes, cards, journeys and provenance. `npm run architecture:source` renders
it into readable `architecture/public/model.c4`; commit both. `npm run build`
checks consistency, validates LikeC4 and generates the React module locally. Large
generated JS and types are ignored. The pinned generator is a build dependency.

Current means implemented in the referenced source, not deployed/live.
Unverified means documented platform design without target-specific deployment
verification. Planned means future work. Every element and relationship carries
one of these states. The intake journey is entirely planned, even where it touches
an existing tool: reviewed Git desired-state references go to Flux; image bytes go
from Harbor to the Kubernetes runtime. A successful scan alone does not authorize
publication, deployment or an ATO.

The retained reference views were inspected on 2026-10-30 at platform commit
`a70bf98016a36a660523f22a80baff1517807cb0` and portal commit
`89f3637e472802bf4be1ffcf99fea367ebae56e1`. Existing source and test definitions are
links to evidence *limits*, not claims of passed live isolation tests. Issue #79
is the authority for proposed intake. Maintainer content/disclosure approval is
pending. Proposed owners are Platform Engineering and portal maintainers; formal
ownership and ongoing identity review live in platform #377 (with earlier governance work in #81). Update source pins, dates,
statuses and links alongside implementation changes. Never automatically mark a
component deployed from Git presence or a passing documentation build.

## Disclosure and audiences

Everything under `architecture/public` and the catalog is explicitly public-safe
educational content. It contains no real tenant inventory, addresses, credentials,
restricted topology or operational evidence. It is available signed out and is
safe to download: hiding public UI elements is not an access control.

Selecting a node or relationship opens an accessible portal detail card below the map.
Subsystem navigation uses LikeC4 navigation targets and the same hash routes.

Signed-in users additionally receive `/bff/architecture-context` guidance selected
by the configured existing home or platform-admin access policy. Each request
validates the server-held token; anonymous requests return 401, invalid grants 403.
Tokens and policy decisions stay on the server. Tenant guidance contains no other
tenants or privileged operating instructions. This does not implement issue #9's
API split or alter the portal's existing access-policy/group validation.

Actual restricted models are deliberately omitted. Before adding one, use separate
server-side storage outside static build inputs and separately authorized delivery
per tenant/role on every request, including assets and generated diagrams. Never
import it into the public catalog/generator, return a universal model and filter
it in JavaScript, or rely on obscured URLs. Add cross-tenant/admin denial tests
before delivery. Current scope offers public-safe platform and tenant views plus
authorized workspace guidance, not production sensitive-model storage.

## Standalone reuse

`npm run architecture:standalone` builds a sanitized LikeC4 site in
`dist-architecture/` with hash navigation for static hosts. Serve that directory
locally to review; this command does not publish it or change repository visibility.
Only `architecture/public` is an input. Public publication requires the maintainer's
content/disclosure review; repository links retain their existing permissions.

## Validate a change

Use Node 24: `npm ci && npm run check`. `npm run typecheck` also generates types.
`npm run architecture:standalone` verifies the reusable output. `npm audit
--omit=dev --audit-level=high` checks production dependencies. Existing image CI
runs the aggregate checks and builds the same generated model inside Docker.
Local UI QA should cover every view, nodes/relationships, card search and empty
results, status filters, journey bounds/repeated navigation, workspace return,
deep links/back/forward/reload, mobile widths and browser CSP/errors. Keep positive
and negative session/API tests. No real identity, network or cluster access is
needed; test fixtures remain local.

Related: portal #10, #6, #5, #9; platform #81, #21, #77, #79, #80.

## First review document: end-to-end identity

The Portal's **Architecture documents** entry opens `/#/explore/identityLifecycle`.
Four linked views and an install-to-workload walkthrough cover:

1. Node installer, verified SSH/become, RKE2 registration and node identity.
2. Platform bootstrap, Flux repository authentication versus reconciliation service
   accounts, and application installer/operator authority.
3. Human Keycloak authentication, independent platform-admin authority, tenant
   membership and each application's native authorization.
4. Human/machine OpenBao roles, ESO service accounts and destinations, pod service
   accounts, backend credentials, TLS signing/trust and recovery custody.
5. Explicitly **planned** external workload federation and RDS/database access.

The November 14 source pass uses platform revision
`1e9e455b0cd8fdef3f740fdd8a74379f02dbf915` and Portal's role-independent platform
policy from `93929c12a7f93e7eaad6323e411ddb461c57c645`. Older panorama cards retain
older immutable references and their original unverified labels. This is a first
reviewable model, not a claim that every desired native authorization mapping has
been deployed. In particular the full tenant lifecycle, recovery/elevation and
external-resource federation remain incomplete. No credential values, item IDs,
private node addresses, personal account names or live tenant inventory are included.

Platform-admin access is distinct from tenant access. The current Portal validates
issuer, audience, authorized client and exact platform-admin group without requiring
a tenant-reader role. The separate home policy still requires its existing tenant
role and group. The Explorer introduces no identity mutation or runtime permissions.

### Adopter and maintenance workflow (BODA)

Add documents as reviewed catalog views/journeys, not uploaded HTML or runtime code.
Keep environment-specific issuer/hostname/trust and secret configuration out of the
model and image. Generate with the pinned LikeC4 dependency during the normal image
build, publish once and promote the immutable digest; never rebuild for a target.
The same sanitized artifact can be reviewed in any environment. Content updates
receive source review, model validation and a new normal release like other code.

For each new identity, document owner, purpose, provisioning actor, authentication,
authorization scope, credential custody/delivery, expiry/rotation/revocation,
break-glass interaction and source/evidence limits. For each trust edge, distinguish
an intended contract from an observed enforcement result. Kubernetes Secret LIST
includes contents; narrowed writes alone do not isolate a cluster-wide secret reader.
Avoid claiming that cloud API identity automatically authorizes database SQL access.

### Validation and evidence plan

Platform issue [#377](https://github.com/perkforge/perkforge-platform/issues/377)
tracks review and subsequent tests. The eventual evidence matrix should pair each
trust edge with positive and negative checks: correct and wrong audience/subject,
wrong tenant, absent/revoked group, expired session/token, unauthorized Secret paths,
service-account substitution, installer privilege retirement and external-resource
cross-tenant denial. Record exact artifact/configuration versions, date, expected
versus observed behavior and known gaps. Rendering this document is not a security
proof. This first Portal delivery does not close the wider identity evidence issue.

## Current identity state

The dated identity observations panel separates observed-active, staged, source-only, planned and unverified state from source-code status. It explicitly reports pending native delivery/phone acceptance and staged Mattermost/inventory integrations. Maintain it as part of every identity change using [the identity definition of done](identity-maintenance.md). It is not automatic discovery. The current snapshot becomes visible only when its normal Portal release is promoted; a source merge alone does not update the running page.

## Authenticated artifact boundary

The entire compiled Portal artifact (including architecture/model/lazy assets) now requires a cookie session whose token passes the existing access-policy verifier on every request. A minimal public sign-in page/script contains no application or diagram imports. Pending-login cookies and bearer headers do not authorize static assets. Health and OIDC routes remain public; no-store applies throughout. Logout destroys the session and replaces the document, and expiry reloads the document into sign-in. Page exit clears the rendered workspace; a restored back-forward-cache document reloads through the server gate. Previously downloaded bytes cannot be recalled from a client.

This is an access gate, not a new private-model or per-tenant model separation implementation. The sanitized catalog remains shared among identities allowed by the configured policy. Issue #10 stays open until its distinct role-appropriate private-model acceptance is implemented. Source merge alone is not runtime protection; publish and deploy the same immutable image normally before claiming the public asset exposure is closed.
