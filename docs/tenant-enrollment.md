# Tenant enrollment integration (Portal #5)

## This change

Portal adds a platform-admin-only read-only enrollment section. With runtime
`ENROLLMENT_SOURCE=github-public`, its API reads the latest published non-prerelease
from the fixed public `perkforge/perkforge-platform-tenants` GitHub repository.
The default is `disabled`. No credential is required. Release links are constructed
locally, redirects rejected, responses bounded, upstream failures sanitized.

This is **published source evidence, not deployment evidence**. Cluster deployment
is explicitly unavailable. No tenant creation, user mutation, MR submission or
provisioning is enabled. Existing directory fixtures remain separately labeled.

Deployment must permit HTTPS egress to GitHub's API for the optional source reader.
No network policy changes are included. If blocked/rate-limited, the UI shows
unavailable rather than a stale or fabricated result. A refresh reads source again.
Configuration, not rebuilt images, selects the integration (BODA).

## Existing lifecycle, not a parallel controller

The enrollment repository owns tenant foundation, source/reconcile manifests,
cluster selectors and scoped Ansible prerequisites. Portal should prepare a change
against approved templates there, never accept arbitrary manifests, commands,
repositories or namespace targets from a browser. Existing CI, human review and
release produce an immutable configuration ref. Scoped prerequisite execution and
Flux reconciliation remain authoritative. A merged MR is not a completed tenant.

Future MR preparation needs a reviewed profile-to-template contract, collision
checks and repository-scoped writer identity. This PR deliberately does not invent
that contract or silently grant it. No speculative queue/database is introduced.

## Concrete live-status extension

Inspection of the pilot found `portal-runtime` has token automount disabled and no
Flux read role. Do not reuse `portal-reconciler`, `portal-deployer`, operator kubeconfig
or bootstrap credentials. A future reviewed reader should have only `get` on named
GitRepository/Kustomization resources in explicit enrollment/config namespaces;
no list/watch across the cluster, Secrets, mutation or tenant payload access.
Permit only required Kubernetes API egress and use a projected short-lived audience-
bound token. Extend admission deliberately rather than disabling its token guard.

Status must separately report desired enrollment release, source artifact revision,
Flux observed generation, conditions, applied revision and capture time. Suspended,
stale, missing, reconciling and failed are not Ready. Even Flux Ready does not prove
identity/native-service readiness. Retain per-stage evidence; retry only the failed
idempotent step against the same intended revision, not broad rollback/replay.

Tenant-admin user management is a later scoped identity adapter: exact tenant group
and verified subject membership only; no platform roles, global user reset/delete,
or incidental grants from parent groups. Downstream revocation/session checks are
required before declaring removal complete.

## Pinned declared enrollment inventory

The optional reader additionally accepts `ENROLLMENT_SOURCE_COMMIT` (exact 40-hex
commit) and `ENROLLMENT_SELECTOR` (one supported explicit cluster root). Both are
required together. Read the generated artifact from the resolved published
enrollment release, not moving main or a browser-provided path. CI in enrollment
verifies the projection against Kustomize; the manifests remain authoritative.

Latest published release metadata and selected inventory commit are deliberately
separate: latest does not mean selected/deployed. The reader accesses only the
fixed public repo/artifact using a bounded response, rejects redirects, validates
schema, and omits unknown fields. Missing old-release artifacts, blocked egress,
rate limits or malformed content are unavailable, never empty successful inventory.
Entries are application enrollments, not inferred customer tenants/users.

### Preferred restricted-cluster transport

Set `ENROLLMENT_SOURCE=gitops-configmap` and project the derived artifact read-only
at `/etc/portal/enrollment/enrollment-inventory.json`. Set the selected source
commit and selector as above through GitOps configuration. The mount and metadata
must come from the same pinned source release, enforced by configuration CI. This
mode requires `ENROLLMENT_INVENTORY_SHA256` from the same reviewed source commit;
runtime verifies exact artifact bytes before reporting available. A stale/wrong
mount fails closed. Configuration CI must verify the declared commit-to-digest
binding against the published release. This mode performs **no GitHub requests**, needs no service-account token, and leaves
latest-release metadata disabled. Source commit is configuration provenance, not
live Flux observation. The image is unchanged between environments.

Delivery must be automated through existing app/enrollment release manifests, not
an operator snapshot or ad-hoc kubectl ConfigMap. Runtime namespace permissions
remain owned by the existing deployer; enrollment must not gain runtime write
authority just to deliver this data. This PR implements the reader only: mount
wiring and cross-repository pin checks are still required before activation.

## Offline change preview (source-only proposal, #5)

`server/enrollment-preview.mjs` and `scripts/enrollment-preview.mjs` implement a
pure no-write MR preview. The CLI reads a bounded JSON envelope on stdin with
`contract`, `inventory`, `sourceCommit`, and `request`, then emits JSON on stdout.
It makes no network calls, writes no files, uses no credentials and exposes no HTTP
route or browser form. It is not tenant creation or a user-management interface.

The proposed platform-owned `contracts/preview-v1.json` in the enrollment repo
maps one existing application release pin. Supply its contract and inventory from
the same reviewed immutable commit; the offline module does not fetch or attest
that provenance. The test fixture is a format fixture, never runtime authority.
The request shape is:

```json
{"operation":"application-release-pin","mapping":"integrated-portal-release","expectedTag":"v2.3.1","proposedTag":"v2.4.0"}
```

These tags illustrate input, not verified published releases. The planner rejects
unknown fields, arbitrary target paths/namespaces, ambiguous inventory, conflicting
base tags, unsupported contract versions and duplicate mappings. An unchanged pin
produces no changes. Output is a semantic file/resource/field proposal, not an
executable YAML/JSON patch. It always reports `writable:false` and
`readyToSubmit:false`. A future reviewed writer must verify source provenance,
re-read the exact base file and target, validate the published release and existing
cross-repository constraints, then use normal review/CI. No credentials or grants
are added by this code. BODA is preserved: contract data, not a rebuilt image,
would select approved targets.

`create-customer` and `change-membership` explicitly fail closed because the
contract has no reviewed templates for those operations. Customer identity,
profile foundations, immutable subject mapping, tenant-admin permissions and
revocation remain open design/acceptance work. Existing app enrollment must never
be repurposed as customer identity. No platform or native team administrator role
is inferred, and the owner-only pilot is unchanged.

## Authenticated membership request preview (source-only, default off)

The next bounded slice adds POST `/api/tenant-requests/preview` (bearer only) and
POST `/bff/tenant-requests/preview` (session plus same-origin CSRF). It **does not**
submit or persist requests, create tenants/accounts, contact Keycloak, or change
memberships. There is no new browser UI. Every response explicitly reports
`persisted:false`, `submitted:false`, `writable:false`, `readyToSubmit:false`.

Both routes retain existing JWT issuer/audience/azp/signature/expiry and login
policy. Operation authorization additionally requires either exact
`/platform/admins`, independently of tenant roles, or **both** the generic realm
role `tenant-admin` and `/tenants/<target>/admins`. Admin in a plus viewer in b
never authorizes b. This source does not broaden the current platform-admin-only
pilot admission or enable tenant logins.

Default configuration has no context digest, so authenticated previews are
unavailable. A future separately reviewed delivery may mount a nonpublic,
read-only `/etc/portal/tenant-requests/context.json` and configure its exact
`TENANT_REQUEST_CONTEXT_SHA256`. This change supplies neither mount nor snapshot,
credentials, network access or deployment values. SHA256 binds bytes to reviewed
configuration, **not** live Keycloak truth or repository provenance. A trusted
producer must verify ownership and IDs; browser payloads cannot supply this file.
Operation authorization happens before reading private context. The fixed-path
reader stats the opened regular file and reads at most 256 KiB plus one overflow
byte, closing the handle on every outcome; it rejects mismatched/oversized JSON and the planner rejects
snapshots older than 15 minutes or over one minute in the future. No refresher or
live reader is implemented; stale input deliberately becomes unavailable.

Snapshot v1 fields: `schemaVersion:1`, `realm:"perkforge"`, exact HTTPS `issuer`
matching the signature-verified JWT issuer (not browser input), immutable
`sourceCommit`, ISO `capturedAt`, empty `customerProfiles`, and `contexts`.
A matching realm name in another environment is insufficient. UUIDs must use
canonical lowercase form to avoid case-variant collision ambiguity. Each context
has canonical `id`, `groups` keyed by the three existing generic
roles (each exact immutable `id` and tenant-qualified `path`), and
`eligibleSubjects` records (`subject` UUID and `memberGroupIds` limited to that
context). Eligibility means separately reviewed existing-subject/context linkage,
not all users discovered in a realm. No email/name account matching is supported.
The tests contain synthetic snapshots, not production identity inventory.

Membership input is `{operation,tenant,subject,role}`. Operation is
`add-membership` or `remove-membership`; only `tenant-developer` and
`tenant-viewer` requests can produce proposals. Existing/no-op and removal states
are calculated against the declared snapshot, not queried live. Unknown subjects,
missing/duplicate IDs and cross-context group data fail closed. Tenant-admin
membership, self-elevation/last-admin policy and role assignment mechanics are
not chosen here and remain blocked. No global account creation/reset/deletion,
impersonation, direct realm-role mapping or platform privileges are supported.

A platform-admin may validate `{operation:"create-customer",tenant,profile}`
against canonical slug/reserved-name and existing-context collision rules, but
creation **always remains blocked** while customer profile templates are absent.
This does not turn application enrollment into customer identity.

Policy source: platform `configuration/authorization/desired.yaml`, `MATRIX.md`,
`foundation.yaml`, `tasks/foundation-tenant.yaml`, `PORTAL-ROLES.md` and
`contexts/verify.py` (under `big-bang-bootstrap`). Native fine-grained Keycloak
administration versus a constrained membership writer remains unresolved. Before
any writer: revalidate actor, exact immutable group/subject ownership and expected
membership, authorize the minimal scope, then record native readback and downstream
revocation/session checks. Never reuse bootstrap/realm-admin credentials in Portal.

## Request-preview UI (source only)

The workspace includes an explicitly non-submitting membership preview form. It
checks an authenticated configuration/admission-only capability endpoint, which
reads no private inventory and returns no identities. Default configuration keeps
the form disabled. Existing runtime remains unchanged until a separately reviewed
release and delivery. No customer creation or admin-role option is offered.
Cancel, Escape and workspace navigation discard inputs/results and abort pending
reads; late responses cannot reopen or populate a newer form. Repeated clicks
cannot issue overlapping previews. No local/session storage is used.

The form requires a previously reviewed context and immutable subject ID; it does
not discover or list realm users. BFF authorization remains authoritative. A
configured capability is not proof a fresh valid snapshot exists. Preview results
never say a request was saved or submitted. See [the concrete remaining CRUD
requirements](tenant-management-next.md). Run `npm run check` and, with the existing
Playwright Chromium installed, `node scripts/test-request-preview-ui.mjs` for local
built-UI synthetic-response checks. No live identity or cluster endpoint is used.
