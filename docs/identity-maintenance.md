# Current identity state is part of done

Corey's requirement: identity changes must keep the Portal C4 view current. The
model is a reviewed, dated snapshot, not automatic cluster discovery. This applies
to installers/bootstrap, human roles, operators, workload service accounts, OpenBao
policies, ESO delivery, notification publishers/subscribers, tenant authority and
future external resource trust.

## Required change sequence

1. Name the affected actor, verifier, allowed action, resource/topic/namespace and
   credential custodian. Identify what was preserved and what changed. Never put
   credentials, private account inventory or secret-bearing evidence in the model.
2. Update `src/architecture/catalog.json` with the source-backed design and its
   separate `identitySnapshot`. A merged PR is `source-only`; prerequisites without
   a verified running consumer are `staged`. Only dated direct evidence supports
   `observed-active`. Keep untested/future trust `unverified` or `planned`.
3. Link the source PR and sanitized observation evidence. Include negative checks,
   pending user acceptance and limits. Native route activation is not message or
   phone receipt; successful authentication is not application authorization.
4. Regenerate with `npm run architecture:source`, run `npm run check`, and review
   model/UI changes alongside the identity change. Preserve platform-admin authority
   independently of tenant roles. Avoid reclassifying existing nodes from Git alone.
5. Coordinate the model update and normal Portal image/config/enrollment release
   with the identity rollout. Verify the served snapshot's date/content after
   rollout, then close the identity ticket only when runtime and documentation
   acceptance are both satisfied. If a runtime change precedes its Portal release,
   explicitly report the temporary documentation gap; do not call the work done.

## Guard and limits

Portal PR CI checks all server sources plus the main authentication shell and enrollment UI, and
requires catalog plus identity documentation changes in that PR. Unit tests verify
snapshot shape/state/evidence and guard behavior. This catches an omitted review,
not false prose or a stale cluster. Human review remains responsible for accuracy.
Cross-repository platform, enrollment and app-config identity changes are **not**
automatically detected by this Portal-only guard. Their PRs must link the companion
Portal model PR/release and include the same acceptance checklist. Extending that
mechanical guard to those repositories is follow-up work, not implemented discovery.

A new environment promotes the same image; environment-specific facts need reviewed
snapshot input, not target-dependent rebuilds. No API credentials, cluster tokens or
new network access are introduced by this documentation feature. The authenticated
architecture-delivery change is separately tracked in Portal #10; this sanitized
snapshot must not be mistaken for implemented private-model delivery.

## Verified pilot transition

The current snapshot records the live read-only Portal inventory as a pinned published-source baseline, never current cluster state or tenant/user CRUD. Mattermost native readiness, closed signup and owner-confirmed Keycloak login/private-channel visibility are separate from continuous group membership enforcement and alert delivery, which must not be inferred. Native emergency administration remains outside Keycloak, with approved vault custody and temporary bootstrap access disabled. The default-off reviewed membership adapter is source capability, not an active scheduler or enrollment hook. Grafana explicit-subject administration is likewise not automatic group-to-organization synchronization. Tenant organization roles and data-source isolation remain future work.

The private pilot channel now has a channel-locked Grafana receiver: one labeled native contact-point test and exact channel readback are verified, with the existing phone receiver preserved. This is not evidence of production firing/recovery/repeat behavior or continuous tenant membership enforcement.


The source-only enrollment proposal planner does not create tenants, users,
Keycloak groups or native-service memberships. Customer and membership templates
remain explicitly unconfigured; offline application-pin proposals do not expand
platform-admin or tenant-admin authority and are not deployed management UI.

The authenticated request-preview source adds no live authority: tenant-admin
needs both the generic realm role and exact target admin group; platform-admin
remains independent. A digest-bound, fresh, operator-reviewed snapshot is required
but is not delivered. Only eligible existing-subject developer/viewer membership
proposals are supported; customer templates and admin-membership policy remain
blocked. Responses are neither persisted nor submitted. Current pilot admission,
shared-account protections and native role definitions remain unchanged.

Review hardening binds the context snapshot to the verified JWT issuer, not merely
a shared realm name. Unauthorized actors never load private context; opened-file
stat and capped reads prevent unbounded allocation, and immutable UUID inputs
reject noncanonical casing. These are source checks, not new runtime authority.
## Earlier logging pilot acceptance (superseded scope)

The earlier pilot distinguished scoped installers, the own-namespace operator,
an API-only collector account, the authenticated TLS gateway and Grafana query
identity. That pilot selected opted-in pod logs, not host mounts or arbitrary
tenant logs. Opt-in labels are collection filters; the service account RBAC
permits pod-log reads across the pilot namespace, not only labeled pods. Installer-only metadata exceptions are read-only node
listing and get of its exact namespace. These metadata exceptions add no extra Secret or other-resource authority and
do not expand collector permissions; existing Helm installer authority is separate.
That pilot used one platform-admin write/query machine identity: no tenant
isolation claim is justified. Its credentials were manually staged in protected runtime
Secrets, not ESO-managed. The current scoped transition below supersedes that custody and collector scope.

Actual pilot collection is verified: opted-in synthetic records reach the
collector through the Kubernetes API, tested synthetic password fields were redacted, and an
otherwise identical unopted workload is excluded. The gateway enforces the
authenticated identity mapping despite spoofed tenant headers and rejects invalid
credentials. An actual Grafana datasource-proxy query returns the redacted records;
native logging and existing metrics health and dashboards are preserved. A unique
pre-restart direct-push sentinel survives a controlled backend-only restart on the
same persistent volume, without relying on collector replay. Temporary synthetic
workloads were cleaned up.

Natural retention deletion, production-volume growth/debug policy, comprehensive
redaction, tenant query isolation and restore remain separate, unverified
acceptance. The logging ticket remains open. The owner also confirmed visual
receipt of the private Mattermost native test; production alert firing/recovery
and repeat behavior are separate from that contact-point test.

The request-preview UI is source-only and disabled when no reviewed snapshot
configuration exists. Its capability endpoint reveals only configuration/admission
booleans, never realm user/group inventory. The form has no submit/persist action;
server operation authorization and all identity boundaries remain unchanged.

The source-only execution protocol reuses existing request context and refuses
replayed writes after uncertain outcomes. Native26.8.1 evidence requires user
manage-group-membership plus exact group manage-membership; no broad user-admin
role is assumed. GET-only readback accounts for permission-filtered pagination
and explicitly does not verify ownership. No connected writer, durable storage,
service credential, grant or native acceptance is introduced by these fixtures.

## Scoped logging transition and namespace ownership

The Portal runtime namespace now has a separately approved native ownership
guard: its immutable UID, context and log epoch must remain bound together.
Typechecking and native positive/negative admission checks passed; ordinary
updates and existing foundation SSA remain accepted, while deletion and binding
changes are denied. No namespace was deleted to test this. The independent offline
CREATE fixture is not yet executed, and trusted platform administrators can alter
the guard. Source and evidence are recorded in platform PR430/432.

This guard is a prerequisite, not a log access grant. Reviewed source PR425/429/433
provides distinct writer and reader credentials, exact-record OpenBao/ESO custody,
server-fixed query partitions and a platform-only dashboard. The active platform-only
stage is described below; expansion and tenant acceptance are not implied by
source publication or pod readiness. Tenant exposure stays disabled until server-side cross-scope
and identity/session denial checks pass. Dashboard namespace filters never enforce
authorization. Platform federation supports historical queries, not multi-tenant
live tail. Namespace reuse needs a new ownership epoch after explicit revocation,
not a one-time UID check alone.

Portal compiled-asset authentication is now deployed and verified separately from
role-specific private-model delivery. A later model release must preserve that
boundary and accurately mark which logging stages are active.

The catalog `platformRevision` and `portalRevision` fields retain original model-source provenance, not current deployed release selectors. Per-node links and dated identity observations carry their own evidence; do not infer runtime state from those original revision fields.

The Grafana identity-provider transport fix (platform PR431) adds only the exact ingress backend/translated TLS port to existing egress. TLS verification, client credentials and human roles remain unchanged. Workload discovery/token-path checks and owner browser login succeeded; tenant datasource isolation is a separate boundary.

## Current platform-only scoped collection

Phase A is active. Four dedicated runtime records are synchronized through
exact-record OpenBao/ESO delivery. A distinct collector writer and platform reader
replace shared write/query use; the preserved legacy pilot reader is not a writer.
The collector has cluster pod metadata/log read authority plus get/watch on its
one exact credential Secret, not unrestricted Secret access or host mounts.
Trusted Kubernetes metadata selects an ownership epoch or platform-only fallback.

Actual gateway queries return Mattermost and Flux workload records. Portal is
currently quiet. Collection expands through reviewed namespace stages only as capacity is measured;
cluster-wide authorization is not all-cluster coverage. Source selection and dated
acceptance determine the stage; the view does not infer coverage from RBAC.
The initial collector credential-read denial caused a collection gap. No lossless
rollout, natural-pruning, restore or comprehensive-redaction claim is made.

The native platform dashboard is provisioned against a distinct read-only
datasource and preserves all 41 earlier dashboard UIDs. Actual chained namespace/pod/container queries and log/volume/count panels passed
through Grafana in both default-All and selected-pod forms. Newly ingested
records retain indexed pod labels after the native processing correction; older
records are not retroactively indexed. The owner confirmed visual pod-log receipt in the dashboard; the assistant
verified native queries separately because no browser was registered. A Ready pod or provisioned dashboard
alone would not have been query proof. Tenant reader mapping remains disabled, with
cross-scope and identity/session denial gates still separate. Historical federation
does not support multi-tenant live tail.

## Delivery and recovery are part of the identity model

The [current pipeline inventory](delivery-pipelines.md) distinguishes actual build/release paths, paused validation, manual promotion and planned intake. The [generic backup/restore model](backup-restore.md) separates paired capture, independent copy integrity, isolated application proof and reviewed cutover, including independent credential custody and unverified whole-cluster dependencies. No private recovery topology or runtime secrets are included.

The existing canonical platform-engineer group now receives a dedicated, noncomposite Grafana-client entitlement and same-client scope mapping; live OAuth assigns platform-org Viewer while administrator authority remains separate. No human memberships changed. Native readback and fixture proof do not replace an actual engineer-only human login, which remains untested. Tenant org exposure remains off.

New private operational Mattermost channels have role-based membership and owner-confirmed visibility. The one-shot adapter is not continuous reconciliation; the tenant deployment channel remains recovery-only at this checkpoint. New relay credentials are staged, not evidence of delivered messages, and the new route is not yet deployed.
