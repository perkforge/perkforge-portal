import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { previewTenantRequest, loadTenantRequestSnapshot } from '../server/tenant-request-preview.mjs';
import { buildApp } from '../server/app.mjs';
import { Sessions, validateAccess } from '../server/security.mjs';
import { readConfig } from '../server/config.mjs';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = Date.now();
function snapshot() { return { schemaVersion: 1, realm: 'perkforge', sourceCommit: 'b'.repeat(40), capturedAt: new Date(now).toISOString(), customerProfiles: [], contexts: ['home', 'other'].map((tenant, index) => ({ id: tenant,
  groups: Object.fromEntries([['tenant-admin', 'admins'], ['tenant-developer', 'developers'], ['tenant-viewer', 'viewers']].map(([role, suffix], i) => [role, { id: id(index * 10 + i + 1), path: `/tenants/${tenant}/${suffix}` }])),
  eligibleSubjects: [{ subject: id(100 + index), memberGroupIds: [id(index * 10 + 3)] }],
})) }; }
const request = { operation: 'add-membership', tenant: 'home', subject: id(100), role: 'tenant-developer' };
const admin = { sub: id(900), groups: ['/tenants/home/admins'], realm_access: { roles: ['tenant-admin'] } };
test('exact generic-role plus tenant context; platform-admin independent; mixed membership denied', () => {
  const s = snapshot(); const before = JSON.stringify(s);
  const r = previewTenantRequest(admin, request, s, now);
  assert.equal(r.status, 'proposal'); assert.equal(r.persisted, false); assert.equal(r.submitted, false); assert.equal(r.readyToSubmit, false);
  assert.equal(r.change.groupPath, '/tenants/home/developers'); assert.equal(r.change.groupId, id(2));
  assert.equal(previewTenantRequest({ sub: id(900), groups: ['/platform/admins'] }, request, s, now).status, 'proposal');
  for (const principal of [{ ...admin, realm_access: {} }, { ...admin, groups: ['/tenants/home'] },
    { ...admin, groups: ['/tenants/other/admins', '/tenants/home/viewers'] }, { ...admin, groups: ['/platform/engineers'] }, { ...admin, groups: ['/platform/admins-extra'] }]) {
    assert.equal(previewTenantRequest(principal, request, s, now).status, 'denied');
  }
  assert.equal(JSON.stringify(s), before);
});
test('no account writes, admin policy, unknown subjects or customer templates assumed', () => {
  const s = snapshot();
  for (const operation of ['reset-user', 'delete-user', 'create-user', 'impersonate']) assert.equal(previewTenantRequest(admin, { ...request, operation }, s, now).status, 'invalid');
  assert.equal(previewTenantRequest(admin, { ...request, role: 'tenant-admin' }, s, now).reason, 'admin-membership-policy-unconfigured');
  assert.equal(previewTenantRequest(admin, { ...request, subject: id(101) }, s, now).reason, 'subject-not-approved-for-context');
  assert.equal(previewTenantRequest(admin, { ...request, role: 'platform-admin' }, s, now).status, 'invalid');
  const pa = { sub: id(900), groups: ['/platform/admins'] };
  for (const tenant of ['platform', 'kube-system', '../escape', 'other/path']) assert.equal(previewTenantRequest(pa, { operation: 'create-customer', tenant, profile: 'il2' }, s, now).status, 'invalid');
  assert.equal(previewTenantRequest(pa, { operation: 'create-customer', tenant: 'new', profile: 'il2' }, s, now).reason, 'customer-profile-unconfigured');
  assert.equal(previewTenantRequest(pa, { operation: 'create-customer', tenant: 'home', profile: 'il2' }, s, now).reason, 'tenant-collision');
  assert.equal(previewTenantRequest(admin, { operation: 'create-customer', tenant: 'home', profile: 'il2' }, s, now).status, 'denied');
});
test('snapshot stale/ambiguous/cross-context data fails closed; repeat and removal are truthful', () => {
  const mutations = [s => { s.capturedAt = new Date(now - 900001).toISOString(); }, s => { s.contexts.push(s.contexts[0]); },
    s => { s.contexts[1].groups['tenant-admin'].id = id(1); }, s => { s.contexts[0].groups['tenant-admin'].path = '/platform/admins'; },
    s => { s.contexts[0].eligibleSubjects[0].memberGroupIds.push(id(13)); }, s => { s.customerProfiles.push({ id: 'il2' }); },
    s => { s.contexts[0].eligibleSubjects.push(s.contexts[0].eligibleSubjects[0]); }];
  for (const mutate of mutations) { const s = snapshot(); mutate(s); assert.equal(previewTenantRequest(admin, request, s, now).reason, 'reviewed-context-unavailable'); }
  assert.equal(previewTenantRequest(admin, { ...request, role: 'tenant-viewer' }, snapshot(), now).status, 'no-change');
  const removal = previewTenantRequest(admin, { ...request, operation: 'remove-membership', role: 'tenant-viewer' }, snapshot(), now);
  assert.equal(removal.change.expectedPresent, true); assert.ok(removal.requiredChecks.includes('native-readback-and-downstream-revocation'));
});
test('default off, exact digest binding and bounded fixed artifact read', async () => {
  let reads = 0; const bytes = Buffer.from(JSON.stringify(snapshot())); const digest = createHash('sha256').update(bytes).digest('hex');
  const reader = async path => { reads++; assert.equal(path, '/etc/portal/tenant-requests/context.json'); return bytes; };
  assert.equal(await loadTenantRequestSnapshot({}, reader), undefined); assert.equal(reads, 0);
  assert.deepEqual(await loadTenantRequestSnapshot({ tenantRequestDigest: digest }, reader), snapshot());
  assert.equal(await loadTenantRequestSnapshot({ tenantRequestDigest: 'a'.repeat(64) }, reader), undefined);
  assert.equal(await loadTenantRequestSnapshot({ tenantRequestDigest: digest }, async () => Buffer.alloc(262145)), undefined);
  assert.equal(readConfig({}).tenantRequestDigest, undefined);
  assert.throws(() => readConfig({ TENANT_REQUEST_CONTEXT_SHA256: 'moving' }));
});
test('real JWT API/BFF checks, CSRF and existing pilot admission remain authoritative', async t => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const bytes = Buffer.from(JSON.stringify(snapshot()));
  const config = { origin: 'https://portal.test', issuer: 'https://issuer.test', audience: 'portal-api', clientId: 'portal', accessPolicy: 'home', tenantRequestDigest: createHash('sha256').update(bytes).digest('hex') };
  const sessions = new Sessions();
  const app = await buildApp(config, { static: false, sessions, verify: token => validateAccess(token, publicKey, config), tenantRequestRead: async () => bytes }); t.after(() => app.close());
  const sign = claims => new SignJWT({ ...admin, azp: 'portal', resource_access: { 'portal-api': { roles: ['tenant-reader'] } }, ...claims }).setProtectedHeader({ alg: 'RS256' }).setIssuer(config.issuer).setAudience(config.audience).setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const token = await sign({});
  const call = headers => app.inject({ method: 'POST', url: '/api/tenant-requests/preview', headers, payload: request });
  assert.equal((await call({})).statusCode, 401);
  assert.equal((await call({ authorization: `Bearer ${token}` })).json().status, 'proposal');
  for (const claims of [{ realm_access: {} }, { azp: 'other' }, { groups: ['/tenants/other/admins', '/tenants/home/viewers'] }]) assert.equal((await call({ authorization: `Bearer ${await sign(claims)}` })).statusCode, 403);
  const cookie = `__Host-portal=${sessions.create({ token, csrf: 'guard' }, 10000)}`;
  const bff = headers => app.inject({ method: 'POST', url: '/bff/tenant-requests/preview', headers: { cookie, ...headers }, payload: request });
  assert.equal((await bff({ origin: config.origin })).statusCode, 403);
  assert.equal((await bff({ origin: 'https://evil.test', 'x-csrf-token': 'guard' })).statusCode, 403);
  assert.equal((await bff({ origin: config.origin, 'x-csrf-token': 'guard' })).json().persisted, false);
  config.accessPolicy = 'platform-admins'; // Existing owner-only pilot still denies tenant admission.
  assert.equal((await call({ authorization: `Bearer ${token}` })).statusCode, 403);
  const pa = await sign({ groups: ['/platform/admins'], realm_access: {}, resource_access: {} });
  assert.equal((await call({ authorization: `Bearer ${pa}` })).statusCode, 200);
  delete config.tenantRequestDigest;
  assert.equal((await call({ authorization: `Bearer ${pa}` })).statusCode, 503);
});
