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
