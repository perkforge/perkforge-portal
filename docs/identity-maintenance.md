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
