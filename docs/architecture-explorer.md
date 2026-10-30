# Platform Explorer

Open **Explore the platform** or `/#/explore/index`. The portal embeds the official
LikeC4-generated React renderer; there is no remote iframe or diagram service.
The diagram is lazy loaded, preserving the small workspace entry bundle. Its
renderer is approximately 696 kB gzipped; cache policy remains the portal's no-store.

The six views cover panorama, platform internals, identity/trust/data flows,
proposed platform authorization scope, generic tenant isolation, and planned image
intake. Two guided journeys cover image intake and the existing portal sign-in.
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

Current means implemented in the referenced portal source, not deployed/live.
Unverified means documented platform design without target-specific deployment
verification. Planned means future work. Every element and relationship carries
one of these states. The intake journey is entirely planned, even where it touches
an existing tool: reviewed Git desired-state references go to Flux; image bytes go
from Harbor to the Kubernetes runtime. A successful scan alone does not authorize
publication, deployment or an ATO.

Sources were inspected on 2026-10-30 at platform commit
`a70bf98016a36a660523f22a80baff1517807cb0` and portal commit
`89f3637e472802bf4be1ffcf99fea367ebae56e1`. Existing source and test definitions are
links to evidence *limits*, not claims of passed live isolation tests. Issue #79
is the authority for proposed intake. Maintainer content/disclosure approval is
pending. Proposed owners are Platform Engineering and portal maintainers; formal
ownership and ongoing review live in platform #81. Update source pins, dates,
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
