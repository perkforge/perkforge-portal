import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { Sessions, validateAccess, safeReturn } from '../server/security.mjs';
import { buildApp } from '../server/app.mjs';
import { readConfig } from '../server/config.mjs';
import { listTenants } from '../server/tenants.mjs';
const config = { origin: 'https://portal.test', issuer: 'https://issuer.test', audience: 'portal-api', clientId: 'portal', mode: 'mock', accessPolicy: 'home' };
const { privateKey, publicKey } = await generateKeyPair('RS256');
async function token(overrides = {}) { return new SignJWT({ sub: 'user', azp: 'portal', groups: ['/tenants/home/viewers'], resource_access: { 'portal-api': { roles: ['tenant-reader'] } }, ...overrides }).setProtectedHeader({ alg: 'RS256' }).setIssuer(config.issuer).setAudience(config.audience).setIssuedAt().setExpirationTime('5m').sign(privateKey); }
test('JWT rejects wrong issuer/audience/role/group/client/expiry/signature', async () => {
  assert.equal((await validateAccess(await token(), publicKey, config)).sub, 'user');
  for (const group of ['/tenants/home/admins', '/tenants/home/developers', '/tenants/home/viewers']) {
    assert.equal((await validateAccess(await token({ groups: [group] }), publicKey, config)).sub, 'user');
  }
  for (const overrides of [{ resource_access: {} }, { groups: ['/tenants/other/viewers'] }, { azp: 'other' }]) await assert.rejects(validateAccess(await token(overrides), publicKey, config));
  for (const changes of [{ issuer: 'https://wrong.test' }, { audience: 'other' }]) await assert.rejects(validateAccess(await token(), publicKey, { ...config, ...changes }));
  const expired = await new SignJWT({ sub: 'user' }).setProtectedHeader({ alg: 'RS256' }).setIssuer(config.issuer).setAudience(config.audience).setIssuedAt().setExpirationTime(1).sign(privateKey);
  await assert.rejects(validateAccess(expired, publicKey, config));
  await assert.rejects(validateAccess(await token(), (await generateKeyPair('RS256')).publicKey, config));
});
test('bounded sessions expire, cannot resurrect, and redirect is fixed', () => {
  let now = 0; const s = new Sessions(1, () => now); const id = s.create({}, 10); assert.throws(() => s.create({}, 10)); now = 10; assert.equal(s.get(id), undefined); s.create({}, 10);
  for (const path of ['//evil.test', 'https://evil.test', '/\\evil.test', '/admin', '/']) assert.equal(safeReturn(path), '/');
});
test('platform admin authority is independent of tenant roles on every API/session path', async t => {
  for (const accessPolicy of ['platform-admins', 'home', 'unknown', undefined, null, '', [], {}, 'toString']) {
    const trial = { ...config, accessPolicy };
    const sessions = new Sessions();
    const app = await buildApp(trial, { static: false, sessions, verify: value => validateAccess(value, publicKey, trial) });
    t.after(() => app.close());
    const cases = [
      [{ groups: ['/platform/admins'], resource_access: {} }, accessPolicy === 'platform-admins'],
      [{ groups: ['/platform/admins'], resource_access: { 'portal-api': { roles: 'tenant-reader' } } }, accessPolicy === 'platform-admins'],
      [{ groups: ['/platform/admins'] }, accessPolicy === 'platform-admins'],
      [{ groups: ['/tenants/home/viewers'] }, accessPolicy === 'home'],
      [{ groups: ['/tenants/home/viewers'], resource_access: {} }, false],
      [{ groups: ['/tenants/other/admins'] }, false],
      [{ groups: ['/platform/developers'] }, false],
      [{ groups: ['/platform/admins-extra'] }, false],
      [{ groups: '/platform/admins' }, false],
      [{ groups: [null, 123, {}] }, false],
      [{ groups: [] }, false],
      [{ groups: ['/platform/admins'], azp: 'other' }, false],
      [{ groups: ['/platform/admins'], sub: null }, false],
    ];
    for (const [claims, allowed] of cases) {
      const access = await token(claims);
      const cookie = `__Host-portal=${sessions.create({ token: access, csrf: 'csrf' }, 10000)}`;
      assert.equal((await app.inject({ url: '/api/tenants', headers: { authorization: `Bearer ${access}` } })).statusCode, allowed ? 200 : 403);
      assert.equal((await app.inject({ url: '/bff/tenants', headers: { cookie } })).statusCode, allowed ? 200 : 403);
      assert.equal((await app.inject({ url: '/auth/session', headers: { cookie } })).json().authenticated, allowed);
    }
  }
});
test('platform admin JWT still requires correct issuer, audience, client, expiry and signature', async () => {
  const trial = { ...config, accessPolicy: 'platform-admins' };
  const access = await token({ groups: ['/platform/admins'], resource_access: {} });
  for (const changes of [{ issuer: 'https://wrong.test' }, { audience: 'other' }, { clientId: 'other' }]) {
    await assert.rejects(validateAccess(access, publicKey, { ...trial, ...changes }));
  }
  await assert.rejects(validateAccess(access, (await generateKeyPair('RS256')).publicKey, trial));
  const expired = await new SignJWT({ sub: 'user', azp: 'portal', groups: ['/platform/admins'] }).setProtectedHeader({ alg: 'RS256' }).setIssuer(config.issuer).setAudience(config.audience).setIssuedAt().setExpirationTime(1).sign(privateKey);
  await assert.rejects(validateAccess(expired, publicKey, trial));
});
test('configuration fails closed and adapter cannot connect', () => {
  assert.equal(readConfig({}).listenHost, '127.0.0.1');
  assert.equal(readConfig({ LISTEN_HOST: '0.0.0.0' }).listenHost, '0.0.0.0');
  assert.throws(() => readConfig({ LISTEN_HOST: 'public.invalid' }));
  assert.throws(() => readConfig({ PORTAL_ORIGIN: 'http://portal.test' }));
  assert.throws(() => readConfig({ TENANT_SOURCE: 'live' }));
  assert.throws(() => readConfig({ OIDC_ISSUER: 'https://issuer.test' }));
  assert.equal(readConfig({}).accessPolicy, 'home');
  assert.equal(readConfig({ PORTAL_ACCESS_POLICY: 'platform-admins' }).accessPolicy, 'platform-admins');
  assert.throws(() => readConfig({ PORTAL_ACCESS_POLICY: 'all' }));
  const configured = { OIDC_ISSUER: config.issuer, OIDC_CLIENT_ID: config.clientId, OIDC_CLIENT_SECRET: 'fixture', OIDC_AUDIENCE: config.audience };
  assert.throws(() => readConfig(configured));
  assert.equal(readConfig({ ...configured, PORTAL_ACCESS_POLICY: 'home' }).accessPolicy, 'home');
  assert.deepEqual(listTenants().tenants, []); assert.equal(listTenants('mock').source.connected, false); assert.equal(listTenants('mock').tenants.length, 1);
});
test('cookie session, bearer boundary, CSRF, logout and replay', async t => {
  const sessions = new Sessions(); const access = await token();
  const app = await buildApp(config, { static: false, sessions, verify: t => validateAccess(t, publicKey, config) }); t.after(() => app.close());
  const guest = await app.inject('/auth/session');
  assert.match(guest.headers['set-cookie'], /Secure/); assert.match(guest.headers['set-cookie'], /HttpOnly/); assert.match(guest.headers['set-cookie'], /SameSite=Lax/); assert.equal(guest.headers['cache-control'], 'no-store');
  assert.equal((await app.inject('/api/tenants')).statusCode, 401);
  assert.equal((await app.inject('/bff/tenants')).statusCode, 401);
  const id = sessions.create({ token: access, csrf: 'csrf' }, 10000); const cookie = `__Host-portal=${id}`;
  assert.equal((await app.inject({ url: '/api/tenants', headers: { cookie } })).statusCode, 401);
  const result = await app.inject({ url: '/bff/tenants', headers: { cookie } }); assert.equal(result.statusCode, 200); assert.equal(result.json().source.mode, 'mock'); assert.ok(!result.body.includes(access));
  assert.equal((await app.inject({ url: '/api/tenants', headers: { authorization: 'Bearer invalid' } })).statusCode, 403);
  for (const headers of [{ cookie }, { cookie, origin: 'https://evil.test', 'x-csrf-token': 'csrf' }]) assert.equal((await app.inject({ method: 'POST', url: '/auth/logout', headers })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie, origin: config.origin, 'x-csrf-token': 'csrf' } })).statusCode, 200);
  assert.equal((await app.inject({ url: '/bff/tenants', headers: { cookie } })).statusCode, 401);
  assert.equal((await app.inject('/auth/callback?code=secret&state=bad')).statusCode, 400);
});
