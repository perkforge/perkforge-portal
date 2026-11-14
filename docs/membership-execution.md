# Membership execution protocol (source contract, not enabled)

This extends #5 beyond a preview shape with a tested write-ahead/state/audit
protocol and pinned native readback adapter. **There is no connected writer,
durable request store, queue, submit route, credential or live policy here.**
The modules are not imported by HTTP routes. Mocked tests establish contract
behavior, not Keycloak authorization, atomic persistence or native denial proof.

## Reuse the reviewed request, not another entitlement registry

`prepareMembershipExecution` consumes the existing reviewed context snapshot and
`previewTenantRequest` result. It accepts only an actual developer/viewer membership
proposal for an eligible existing subject. It preserves immutable issuer, actor,
subject/group ID/path, expected membership, source commit and request action.
Customer creation/admin membership remain blocked. The intent digest detects
accidental record mutation; it is **not** a signature, approval or provenance proof.
Only authenticated, server-verified principals and protected trusted records may
reach this internal module.

## Required durable-store transaction

The returned record/audit/command is a **transaction proposal**, not a persisted
request or permission to dispatch. Before connecting a transport, implement:
1. Atomic insert/lookup unique on `(issuer, actorSubject, idempotencyKey)`. The
   same key with different semantic intent conflicts; retries return the existing
   request. `sameIdempotentIntent` supplies only the comparison, not uniqueness.
2. An exclusive durable claim for the request and target membership tuple. A
   stale worker must not regain authority when its lease expires; use fencing.
3. Atomic compare-and-swap of exact revision **together with** its audit event.
   The reducer's expected-revision check is not a distributed lock or datastore
   CAS. Competing workers using the same old value must not both commit.
4. Dispatch only the command from a successfully committed write-intent under
   the exclusive claim. A crash after that commit, even before sending, is
   conservatively uncertain: read back first, never blindly replay the write.
5. Protected access-controlled request/audit storage, retention and receipt
   ownership. No in-memory production store or database deployment is provided.

State path: `requested → approved → applying → native-verified → verified`.
`applying → uncertain` covers lost/failed responses. `uncertain` can only read back,
not emit another native write. A mismatched readback remains uncertain and needs
explicit reconciliation. `requested/approved → rejected` makes no native change.
No reducer event resets an uncertain/verified request to approved.

Approval and downstream receipt references are trusted internal inputs whose
producer/custody must be implemented. A future HTTP request must never supply
`ownershipVerified`, approval or downstream receipt assertions; only trusted
server-side inspectors/review/audit owners may produce them. The reducer checks
syntax, not the truth of
those attestations. Reauthorization uses the existing exact tenant-role-plus-group
rule, the same actor/issuer and fresh reviewed context before execution/readback.
Revoked or wrong-tenant actors fail closed. Actual executor integration must run
JWT verification/current authorization, not trust browser-supplied claim objects.

The write command can only name one exact Keycloak user/group membership PUT or
DELETE, with no body, redirects or automatic retry. It is data only; no module
sends it. Native success alone is not `verified`: downstream admission/revocation
and session/token denial need a distinct trusted receipt. Do not mark offboarding
complete while a private channel, project, token or app session still works.

## Pinned native evidence: Keycloak26.8.1

Platform source pins chart7.3.2-bb.1 with Iron Bank Keycloak26.8.1. These findings
come from that exact upstream source, not an assumption about latest docs:

- [UserResource.joinGroup/removeMembership](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/services/resources/admin/UserResource.java)
  requires **both** user `manage-group-membership` and target group
  `manage-membership`. Join also checks admin roles inherited through the group.
- [UserPermissionsV2](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/services/resources/admin/fgap/UserPermissionsV2.java)
  and [GroupPermissionsV2](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/services/resources/admin/fgap/GroupPermissionsV2.java)
  support resource-specific scopes. Broad `manage-users` is a bypass, **not a
  necessary minimum**. `manage-members` is not the narrow `manage-membership`.
- [AdminPermissionsSchema](https://github.com/keycloak/keycloak/blob/26.8.1/server-spi-private/src/main/java/org/keycloak/authorization/fgap/AdminPermissionsSchema.java)
  also maps `manage-membership-of-members` to user membership authority via a
  group; do not enable that broader relationship as a substitute for an approved
  exact eligible-user set.
- [Profile](https://github.com/keycloak/keycloak/blob/26.8.1/common/src/main/java/org/keycloak/common/Profile.java)
  makes v2 the default feature, while
  [FineGrainedAdminPermissionEvaluator](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/services/resources/admin/fgap/FineGrainedAdminPermissionEvaluator.java)
  additionally requires the same realm and realm admin permissions enabled.
  Feature availability does **not** mean policies/grants exist in this cluster.
- [GroupUtils.checkAdminGroupRoles](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/utils/GroupUtils.java)
  checks parent/composite admin-role injection; this is not a substitute for our
  exact owned non-composite tenant role/group contract.

Candidate native scope for the membership effect and readback is `view` plus
`manage-group-membership` on explicitly eligible users, and `view` plus
`manage-membership` on exact developer/viewer groups. No `manage`, password reset,
impersonation, map-roles, broad user query or realm-admin fallback. A dedicated
service identity and scope creation remain unapproved/unimplemented, not deployed
by this source. Source-parent/role ownership verification may need additional
bounded **read-only** authority, which must be separately enumerated and proven.

## Filtered readback is not complete inventory

26.8.1's `UserResource.groupMembership` paginates user groups **before filtering**
by `canView`. An empty/short page is therefore not the end. The injected GET-only
`readExactMembership` adapter verifies the exact target group is viewable, reads
user group count, covers the bounded unfiltered range, then checks count again.
It rejects counts above1000, duplicate IDs, oversized responses, redirects,
permission ambiguity and changed counts. It returns only the exact target fact,
not other groups or profile fields. It deliberately returns
`ownershipVerified:false`: matching IDs/presence and HTTP200 do not attest roles,
parent ownership or effective grants. The future trusted inspector must supply
that independent proof. Group representations can themselves filter roles, so
empty role lists under restricted permission cannot prove no hidden grant.

The injected transport must enforce trusted CA, deadline, response byte limit
while reading, exact URL and redirect refusal. The adapter verifies returned
metadata and size but cannot implement socket limits in an injected function.
No default fetch/token/connection exists. Count-before/after is not a transaction;
same-count concurrent changes remain possible. Serialization of our own writer
and fresh inspection/readback are necessary, and external admin drift remains an
explicit acceptance case rather than a false atomicity claim.

## Next native acceptance, not performed

Verify live feature/realm policy mode read-only, then review exact service/subject/
group IDs and protected custody before any grant. On an isolated approved fixture:
prove eligible user/target group add+remove; deny foreign user/group, platform/admin
group, direct role mapping, password reset, deletion and impersonation. Test group
replacement and inherited/admin-role injection, filtered pagination, lost response,
crash windows and revoked actor. Verify downstream denial after removal. Source
fixtures do not prove any of these native permission checks passed.

Run `node --test tests/membership-execution.test.mjs` and `npm run check`.
Customer foundation profile and persistence choices remain as described in
[the actual CRUD prerequisites](tenant-management-next.md).
