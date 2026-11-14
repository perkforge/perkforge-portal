import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMembershipExecution, transitionMembershipExecution, sameIdempotentIntent } from '../server/membership-execution-contract.mjs';
import { readExactMembership } from '../server/keycloak-membership-readback.mjs';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const issuer = 'https://identity.example/auth/realms/perkforge';
const now = Date.now();
const principal = { sub: id(99), iss: issuer, groups: ['/tenants/home/admins'], realm_access: { roles: ['tenant-admin'] } };
const snapshot = { schemaVersion: 1, issuer, realm: 'perkforge', sourceCommit: 'a'.repeat(40), capturedAt: new Date(now).toISOString(), customerProfiles: [], contexts: [{ id: 'home', groups: {
  'tenant-admin': { id: id(1), path: '/tenants/home/admins' }, 'tenant-developer': { id: id(2), path: '/tenants/home/developers' }, 'tenant-viewer': { id: id(3), path: '/tenants/home/viewers' },
}, eligibleSubjects: [{ subject: id(10), memberGroupIds: [] }] }] };
const request = { operation: 'add-membership', tenant: 'home', subject: id(10), role: 'tenant-viewer' };
const context = { principal, snapshot, now };
const prepare = (changes = {}) => prepareMembershipExecution({ requestId: id(90), idempotencyKey: 'fixture-key-1', principal, snapshot, request, ...changes }, now);
const evidence = present => ({ issuer, subject: id(10), groupId: id(3), groupPath: '/tenants/home/viewers', ownershipVerified: true, present, receiptRef: 'fixture-owned-readback' });
const step = (record, event, ctx = context) => transitionMembershipExecution(record, record.revision, event, ctx);
test('write-ahead transition emits one exact command, not a connected write or storage acknowledgement', () => {
  let record = prepare().record; assert.equal(record.state, 'requested');
  const approval = step(record, { type: 'approval-recorded', receiptRef: 'review-1' }); assert.equal(approval.command, null);
  record = approval.record;
  const intent = step(record, { type: 'write-intent-recorded', evidence: evidence(false) });
  assert.equal(intent.requiresDurableCommit, true); assert.equal(intent.audit.revision, 2); assert.equal(intent.record.nativeAttempted, true);
  assert.deepEqual(intent.command, { method: 'PUT', url: `${issuer.replace('/realms/perkforge', '')}/admin/realms/perkforge/users/${id(10)}/groups/${id(3)}`, expectedStatus: 204, redirects: 'reject', body: null, retry: 'never-without-native-readback' });
  assert.equal(record.state, 'approved', 'input record remains immutable');
  assert.throws(() => step(intent.record, { type: 'write-intent-recorded', evidence: evidence(false) }));
  const native = step(intent.record, { type: 'native-readback', evidence: evidence(true) }); assert.equal(native.record.state, 'native-verified');
  assert.notEqual(native.record.state, 'verified', 'native write alone does not complete downstream membership');
  const done = step(native.record, { type: 'downstream-verified', receiptRef: 'native-adapters-acceptance' }); assert.equal(done.record.state, 'verified'); assert.equal(done.command, null);
});
test('uncertain effect never emits another write; readback resumes or stays uncertain', () => {
  const approved = step(prepare().record, { type: 'approval-recorded', receiptRef: 'review-1' }).record;
  const applying = step(approved, { type: 'write-intent-recorded', evidence: evidence(false) }).record;
  const uncertain = step(applying, { type: 'write-outcome-unknown' }).record;
  assert.throws(() => step(uncertain, { type: 'write-intent-recorded', evidence: evidence(false) }));
  assert.equal(step(uncertain, { type: 'native-readback', evidence: evidence(false) }).record.state, 'uncertain');
  const recovered = step(uncertain, { type: 'native-readback', evidence: evidence(true) }); assert.equal(recovered.record.state, 'native-verified'); assert.equal(recovered.command, null);
});
test('idempotency scope, revision, drift and current authorization fail closed', () => {
  const first = prepare().record;
  assert.equal(sameIdempotentIntent(first, prepare({ requestId: id(91) }).record), true);
  assert.equal(sameIdempotentIntent(first, prepare({ request: { ...request, role: 'tenant-developer' } }).record), false);
  assert.throws(() => sameIdempotentIntent(first, prepare({ idempotencyKey: 'other-key' }).record));
  assert.throws(() => transitionMembershipExecution(first, 99, { type: 'approval-recorded', receiptRef: 'r' }, context));
  assert.throws(() => step(first, { type: 'approval-recorded', receiptRef: 'r' }, { ...context, principal: { ...principal, groups: ['/tenants/other/admins', '/tenants/home/viewers'] } }));
  const approved = step(first, { type: 'approval-recorded', receiptRef: 'r' }).record;
  assert.throws(() => step(approved, { type: 'write-intent-recorded', evidence: evidence(true) }));
  assert.throws(() => step(approved, { type: 'write-intent-recorded', evidence: { ...evidence(false), ownershipVerified: false } }));
  const tampered = structuredClone(approved); tampered.target.groupId = id(1);
  assert.throws(() => step(tampered, { type: 'write-intent-recorded', evidence: evidence(false) }));
  assert.throws(() => step(approved, { type: 'downstream-verified', receiptRef: 'premature' }));
  const rejected = step(approved, { type: 'rejected', receiptRef: 'owner-denied' }); assert.equal(rejected.record.state, 'rejected'); assert.equal(rejected.command, null);
});
test('removal stays native-verified until downstream revocation receipt', () => {
  const memberSnapshot = structuredClone(snapshot); memberSnapshot.contexts[0].eligibleSubjects[0].memberGroupIds = [id(3)];
  const ctx = { ...context, snapshot: memberSnapshot };
  const row = prepare({ snapshot: memberSnapshot, request: { ...request, operation: 'remove-membership' } }).record;
  const approved = step(row, { type: 'approval-recorded', receiptRef: 'r' }, ctx).record;
  const applying = step(approved, { type: 'write-intent-recorded', evidence: evidence(true) }, ctx); assert.equal(applying.command.method, 'DELETE');
  assert.equal(step(applying.record, { type: 'native-readback', evidence: evidence(false) }, ctx).record.state, 'native-verified');
});
function transport({ count = 201, denied = false, drift = false, hidden = false } = {}) {
  const calls = []; let counts = 0;
  const get = async request => {
    calls.push(request); assert.equal(request.method, 'GET'); assert.equal(request.redirects, 'reject'); assert.equal(request.maxBytes, 65536);
    const path = new URL(request.url).pathname; let data;
    if (path.endsWith('/groups/count')) data = { count: count + (drift && counts++ ? 1 : 0) };
    else if (path.endsWith(`/groups/${id(3)}`)) data = { id: id(3), path: '/tenants/home/viewers', access: { view: !denied } };
    else if (path.endsWith('/groups')) data = !hidden && new URL(request.url).searchParams.get('first') === '100' ? [{ id: id(3), path: '/tenants/home/viewers' }] : [];
    else data = { id: id(10), enabled: true };
    return { status: 200, url: request.url, data };
  };
  return { get, calls };
}
test('native readback covers unfiltered count despite empty filtered pages', async () => {
  const fixture = transport();
  const r = await readExactMembership({ issuer, subject: id(10), groupId: id(3) }, fixture.get);
  assert.equal(r.present, true); assert.equal(r.ownershipVerified, false);
  assert.equal(fixture.calls.filter(c => c.url.includes('?first=')).length, 3);
  const absent = await readExactMembership({ issuer, subject: id(10), groupId: id(3) }, transport({ hidden: true }).get); assert.equal(absent.present, false);
});
test('native readback refuses permission ambiguity, excessive pagination, drift and redirects', async () => {
  for (const options of [{ denied: true }, { count: 1001 }, { drift: true }]) await assert.rejects(readExactMembership({ issuer, subject: id(10), groupId: id(3) }, transport(options).get));
  await assert.rejects(readExactMembership({ issuer, subject: id(10), groupId: id(3) }, async req => ({ status: 200, url: req.url, redirected: true, data: {} })));
  await assert.rejects(readExactMembership({ issuer, subject: id(10), groupId: id(3) }, async () => { throw new Error('secret-token-must-not-escape'); }), { message: 'Membership readback unavailable' });
  await assert.rejects(readExactMembership({ issuer: 'http://identity.example/realms/perkforge', subject: id(10), groupId: id(3) }, transport().get));
});
