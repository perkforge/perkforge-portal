# What still separates request previews from tenant CRUD (#5)

The current source can validate an authenticated **unsaved preview**. It cannot
create a customer, save/submit a request, change Keycloak membership or reconcile
native applications. No preview response is an operation receipt. This checklist
is the next implementation/approval plan, not authorization to run it.

## 1. One reviewed customer foundation profile

Reuse canonical tenant slug validation, role names and group paths from platform
`authorization/foundation.yaml`, `desired.yaml`, `PORTAL-ROLES.md` and the context
verifier. Those define policy; they are not a complete reusable customer deployment.
The existing Portal and Nextcloud enrollment folders are application specimens,
not interchangeable customer templates. Do not rerun the old empty-group realm
foundation over a realm that now has roles and memberships.

The smallest missing profile must explicitly choose:
- permitted application/configuration release and cluster/environment/profile;
- owned runtime/control namespaces, scoped reconciliation identities and admission;
- quotas, allowed workload identities, network/routing and storage requirements;
- exact identity context and supported private-channel/topic/project destinations,
  with native IDs resolved separately and no tenant shared-team administration;
- collision/ownership checks, partial-stage receipts and deprovisioning retention.

A profile change belongs in platform-owned enrollment, reviewed with its rendered
positive/negative fixtures. Portal may select its immutable ID, never accept
arbitrary namespaces/manifests or silently copy a live pilot's grants. Proposed
customer creation remains blocked until this exists.

## 2. Verified context snapshot producer and custody

The preview consumes a fixed private read-only JSON artifact, bound to the exact
HTTPS issuer, reviewed source commit, expected digest and capture time. It contains
verified group UUIDs, explicitly eligible existing subject UUIDs and only their
context-local memberships. Names/email are not identity linking. Public Git and
browser bundles must not contain this inventory. Snapshot hash alone proves bytes,
not identity ownership, eligibility or provenance.

A reviewed producer must check the selected realm/issuer, managed group ownership,
exact paths and non-composite role mappings, subject identity and explicit context
eligibility, full pagination and unexpected inherited/direct grants. It needs
GET-only access to the exact reviewed groups/subjects/memberships; it must not
reset/delete users, create credentials or enumerate unrelated realm identities.
A concrete native service scope and protected delivery are **not implemented**.
The 15-minute freshness rule intentionally makes stale snapshots unavailable;
there is no refresh job. Use existing runtime OpenBao/ESO patterns only after the
exact record, consumer Secret/mount and producer authority are reviewed. Never
reuse master/realm-admin/bootstrap credentials inside Portal.

## 3. Minimal membership writer, not a realm administrator

Desired effect scope is only add/remove membership of an approved existing subject
in the exact reviewed tenant developer/viewer group IDs. Revalidate generic role
**and** target admin group (or independent platform-admin) at execution, not just
preview time. Refuse platform groups, arbitrary group IDs, nested-group adoption,
account creation/reset/deletion/impersonation, role-definition/mapping changes and
all admin-membership/self-elevation/last-admin policy until separately settled.

Native Keycloak FGAP versus a constrained service remains an existing unresolved
mechanism. Verify the pinned version's actual group-specific membership permissions
and denial behavior before naming a deployable grant. Do not substitute broad
`manage-users`/realm-admin because a narrow API wrapper appears safe. Required
acceptance includes a-admin/b-viewer mixed membership, foreign subjects/groups,
replacement IDs, conflicting concurrent membership and expired/revoked authority.
No service identity, token or permission has been created by these previews.

## 4. Durable request, audit and idempotent execution

The current form does not store anything. Before adding a submit button, choose
reviewed protected persistence and a single writer/outbox owner. No new database or
queue is selected or deployed here. A durable record needs request ID, verified
issuer/actor subject, context/target subject, allowed action, expected membership
and source revision, idempotency key, timestamps, state and sanitized native
readback receipts. Keep identity-bearing requests in protected storage, not public
source MRs; customer infrastructure changes can use ordinary reviewed enrollment
MRs without personal identity payloads.

Enforce CSRF/origin for browser submissions, authorization on every read/retry,
unique idempotency scope, compare-before-write and serialized context operations.
Retry only an unresolved idempotent step; uncertain native outcomes require
readback, not duplicate grants. Never record bearer/session tokens or raw API errors
in audit. Distinguish requested, approved, applying, partially failed and verified;
MR merged or group changed is not deployment/offboarding complete.

## 5. Native readback and revocation acceptance

After membership changes, verify Keycloak readback and each selected native
adapter. OIDC login does not synchronize GitLab projects, Mattermost private
channels, Grafana query scope or ntfy recipients. Removal remains incomplete while
sessions/tokens/native memberships still permit access. Preserve independent
recovery; no blanket delete/reset or automatic rollback. Capture positive and
cross-context denial plus session-expiry evidence and expose partial failures.

**Morning decision:** choose the first customer profile/application scope and the
reviewed native delegation/persistence approach. Then implement and test one
end-to-end operation before any exact live credential/network/grant batch. Until
then this is source-only preview capability, not delivered tenant CRUD.
