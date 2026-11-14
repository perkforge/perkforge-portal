// Pure execution protocol, NOT a durable queue or connected writer. Never imported
// by HTTP routes. A future store must atomically CAS state+audit before dispatch.
import { createHash } from 'node:crypto';
import { previewTenantRequest } from './tenant-request-preview.mjs';
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const receipt = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(v);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function require(value) { if (!value) throw new Error('Invalid membership execution transition'); }
function binding(record) { return [record.requestId, record.issuer, record.actorSubject, record.idempotencyKey, record.request, record.target, record.sourceCommit]; }
function valid(record) {
  require(record?.schemaVersion === 1 && uuid(record.requestId) && receipt(record.idempotencyKey)
    && typeof record.issuer === 'string' && uuid(record.actorSubject)
    && Number.isSafeInteger(record.revision) && record.revision >= 0
    && record.intentDigest === digest(binding(record)));
}
export function prepareMembershipExecution({ requestId, idempotencyKey, principal, request, snapshot }, now = Date.now()) {
  const preview = previewTenantRequest(principal, request, snapshot, now);
  require(preview.status === 'proposal' && uuid(requestId) && uuid(principal.sub) && receipt(idempotencyKey));
  const record = { schemaVersion: 1, requestId, issuer: principal.iss, actorSubject: principal.sub, idempotencyKey,
    request: structuredClone(request), target: structuredClone(preview.change), sourceCommit: preview.sourceCommit,
    revision: 0, state: 'requested', nativeAttempted: false };
  record.intentDigest = digest(binding(record));
  return { record, audit: { event: 'request-recorded', requestId, revision: 0, intentDigest: record.intentDigest } };
}
export function sameIdempotentIntent(existing, candidate) {
  valid(existing); valid(candidate);
  // Request IDs may differ on retry; key scope and semantic intent must not.
  require(existing.issuer === candidate.issuer && existing.actorSubject === candidate.actorSubject && existing.idempotencyKey === candidate.idempotencyKey);
  return digest(binding(existing).slice(1)) === digest(binding(candidate).slice(1));
}
export function transitionMembershipExecution(record, expectedRevision, event, { principal, snapshot, now = Date.now() } = {}) {
  valid(record); require(expectedRevision === record.revision && event && typeof event.type === 'string');
  const next = structuredClone(record); let command = null;
  const reauthorize = () => {
    require(principal?.sub === record.actorSubject && principal?.iss === record.issuer);
    const current = previewTenantRequest(principal, record.request, snapshot, now);
    require(['proposal', 'no-change'].includes(current.status));
    // No-change has no target payload: still bind the immutable group ID explicitly.
    const group = snapshot.contexts.find(c => c.id === record.request.tenant)?.groups[record.request.role];
    require(group?.id === record.target.groupId && group.path === record.target.groupPath);
  };
  const evidence = () => {
    const e = event.evidence;
    require(e && e.issuer === record.issuer && e.subject === record.target.subject && e.groupId === record.target.groupId
      && e.groupPath === record.target.groupPath && e.ownershipVerified === true && typeof e.present === 'boolean' && receipt(e.receiptRef));
    return e;
  };
  if (event.type === 'approval-recorded') {
    require(record.state === 'requested' && receipt(event.receiptRef)); reauthorize(); next.state = 'approved';
  } else if (event.type === 'write-intent-recorded') {
    require(record.state === 'approved' && !record.nativeAttempted); reauthorize();
    const e = evidence(); require(e.present === record.target.expectedPresent);
    next.state = 'applying'; next.nativeAttempted = true;
    command = membershipWriteCommand(record);
  } else if (event.type === 'write-outcome-unknown') {
    require(record.state === 'applying' && record.nativeAttempted); next.state = 'uncertain';
  } else if (event.type === 'native-readback') {
    require(['applying', 'uncertain', 'native-verified'].includes(record.state) && record.nativeAttempted); reauthorize();
    const e = evidence();
    next.state = e.present === (record.request.operation === 'add-membership') ? 'native-verified' : 'uncertain';
  } else if (event.type === 'downstream-verified') {
    require(record.state === 'native-verified' && receipt(event.receiptRef)); reauthorize(); next.state = 'verified';
  } else if (event.type === 'rejected') {
    require(['requested', 'approved'].includes(record.state) && !record.nativeAttempted && receipt(event.receiptRef)); next.state = 'rejected';
  } else throw new Error('Invalid membership execution transition');
  next.revision++;
  const audit = { event: event.type, requestId: record.requestId, revision: next.revision, intentDigest: record.intentDigest,
    state: next.state, receiptRef: event.receiptRef || event.evidence?.receiptRef || null };
  // This is a transaction proposal. Dispatch command ONLY after durable exclusive
  // claim + successful atomic CAS of next/audit. A reducer return is not that ack.
  return { record: next, audit, command, requiresDurableCommit: true };
}
function membershipWriteCommand(record) {
  const issuer = new URL(record.issuer);
  require(issuer.protocol === 'https:' && !issuer.username && !issuer.password && !issuer.search && !issuer.hash
    && issuer.href === record.issuer && issuer.pathname.endsWith('/realms/perkforge'));
  const base = record.issuer.slice(0, -'/realms/perkforge'.length);
  require(uuid(record.target.subject) && uuid(record.target.groupId) && ['add-membership', 'remove-membership'].includes(record.request.operation));
  return { method: record.request.operation === 'add-membership' ? 'PUT' : 'DELETE',
    url: `${base}/admin/realms/perkforge/users/${record.target.subject}/groups/${record.target.groupId}`,
    expectedStatus: 204, redirects: 'reject', body: null, retry: 'never-without-native-readback' };
}
