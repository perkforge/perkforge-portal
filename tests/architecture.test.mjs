import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { buildApp } from '../server/app.mjs';
import { Sessions } from '../server/security.mjs';
const catalog = JSON.parse(await readFile(new URL('../src/architecture/catalog.json', import.meta.url)));
const config = { origin: 'https://portal.test', mode: 'disabled', accessPolicy: 'home' };
test('sanitized catalog has grounded status, complete cards, valid scopes and source provenance', () => {
  const ids = new Set(catalog.nodes.map(n => n.id));
  assert.equal(ids.size, catalog.nodes.length);
  for (const node of catalog.nodes) {
    assert.ok(['current', 'planned', 'unverified'].includes(node.status));
    for (const field of ['purpose', 'usage', 'configuration', 'runbook']) assert.ok(node[field].length > 15);
    const url = new URL(node.source); assert.equal(url.hostname, 'github.com'); assert.ok(!url.username && !url.password);
    assert.match(node.source, /\/(blob\/[a-f0-9]{40}\/|issues\/\d+)/);
    if (node.parent) assert.ok(ids.has(node.parent));
  }
  for (const view of catalog.views) for (const id of view.nodes) assert.ok(ids.has(id));
  for (const edge of catalog.edges) { assert.ok(ids.has(edge.source) && ids.has(edge.target)); assert.ok(['current', 'planned', 'unverified'].includes(edge.status)); }
  assert.equal(catalog.journeys.find(j => j.id === 'intake').status, 'planned');
  assert.deepEqual(catalog.journeys.find(j => j.id === 'intake').steps.map(s => s.node), ['external', 'gitlab', 'harbor', 'platform.flux', 'tenant.workload']);
  assert.ok(!JSON.stringify(catalog).match(/https?:\/\/(?:localhost|127\.|10\.|192\.168\.)|BEGIN .*PRIVATE KEY|client_secret|access_token/));
});
test('architecture context fails closed, is audience-specific, and checks authorization on every request', async t => {
  for (const accessPolicy of ['home', 'platform-admins']) {
    const sessions = new Sessions(); let valid = true;
    const app = await buildApp({ ...config, accessPolicy }, { static: false, sessions, verify: async token => { if (token !== 'allowed' || !valid) throw new Error('Denied'); return { sub: 'fixture' }; } });
    t.after(() => app.close());
    assert.equal((await app.inject('/bff/architecture-context')).statusCode, 401);
    assert.equal((await app.inject({ url: '/bff/architecture-context', headers: { authorization: 'Bearer allowed' } })).statusCode, 401);
    const id = sessions.create({ token: 'allowed', csrf: 'fixture' }, 60000); const headers = { cookie: `__Host-portal=${id}` };
    const result = await app.inject({ url: '/bff/architecture-context', headers });
    assert.equal(result.statusCode, 200); assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.json().audience, accessPolicy === 'home' ? 'Tenant workspace' : 'Platform engineering workspace');
    assert.deepEqual(Object.keys(result.json()).sort(), ['audience', 'notice', 'views']);
    assert.deepEqual(result.json().views, accessPolicy === 'home' ? ['tenantBoundary', 'identity'] : ['platformBoundary', 'foundation', 'identity']);
    valid = false; assert.equal((await app.inject({ url: '/bff/architecture-context', headers })).statusCode, 403);
    sessions.delete(id); assert.equal((await app.inject({ url: '/bff/architecture-context', headers })).statusCode, 401);
  }
});
test('compiled architecture and every static asset require a currently verified cookie session', async t => {
  const sessions = new Sessions(); let valid = true;
  const app = await buildApp(config, { sessions, verify: async token => { if (token !== 'allowed' || !valid) throw new Error('Denied'); return { sub: 'fixture' }; } });
  t.after(() => app.close());
  const html = await app.inject('/'); assert.equal(html.statusCode, 200);
  assert.match(html.body, /auth\/bootstrap.js/); assert.doesNotMatch(html.body, /assets\/|identitySnapshot|likec4/i);
  assert.match(html.headers['content-security-policy'], /script-src 'self'/);
  assert.equal(html.headers['cache-control'], 'no-store');
  const bootstrap = await app.inject('/auth/bootstrap.js'); assert.equal(bootstrap.statusCode, 200);
  assert.doesNotMatch(bootstrap.body, /import |catalog|identitySnapshot|likec4/);
  const assets = await readdir(new URL('../dist/assets', import.meta.url));
  const guest = sessions.create({ csrf: 'guest' }, 60000);
  const id = sessions.create({ token: 'allowed', csrf: 'fixture' }, 60000);
  const headers = { cookie: `__Host-portal=${id}` };
  for (const name of assets) {
    const url = `/assets/${name}`;
    for (const extra of [{}, {cookie: `__Host-portal=${guest}`}, {authorization: 'Bearer allowed'}, {range: 'bytes=0-100'}]) {
      const response = await app.inject({ url, headers: extra }); assert.equal(response.statusCode, 401); assert.equal(response.headers['cache-control'], 'no-store');
    }
    assert.equal((await app.inject({ method: 'HEAD', url })).statusCode, 401);
    const asset = await app.inject({ url, headers }); assert.equal(asset.statusCode, 200);
    assert.equal(asset.headers['cache-control'], 'no-store');
    assert.ok(!asset.body.includes('Platform engineering workspace'));
    assert.ok(!asset.body.includes('fixture-home'));
  }
  const path = `/assets/${assets[0]}`;
  for (const url of [path.replace('/assets/', '/%61ssets/'), path.replace('/assets/', '/assets%2f'), path + '?download=1', '/index.html?x=1']) {
    const response = await app.inject(url); assert.ok([200,401,404].includes(response.statusCode)); assert.doesNotMatch(response.body, /identitySnapshot|likec4|src="\/assets\//i);
  }
  for (const url of ['/architecture/private/model.json', '/architecture/public/model.c4', '/src/architecture/catalog.json', '/server/app.mjs', '/.env']) {
    assert.equal((await app.inject(url)).statusCode, 401);
    assert.equal((await app.inject({ url, headers })).statusCode, 404);
  }
  assert.match((await app.inject({ url: '/', headers })).body, /assets\//);
  valid = false; assert.equal((await app.inject({ url: path, headers })).statusCode, 401);
  valid = true; assert.equal((await app.inject({ url: path, headers })).statusCode, 401); // invalidation is durable
  const expired = sessions.create({ token: 'allowed', csrf: 'fixture' }, -1);
  assert.equal((await app.inject({ url: path, headers: {cookie:`__Host-portal=${expired}`} })).statusCode, 401);
  const active = sessions.create({ token: 'allowed', csrf: 'fixture' }, 60000);
  const cookie = `__Host-portal=${active}`;
  const logout = await app.inject({ method:'POST', url:'/auth/logout', headers:{ cookie, origin: config.origin, 'x-csrf-token':'fixture' } });
  assert.equal(logout.statusCode, 200);
  assert.equal((await app.inject({ url:path, headers:{cookie} })).statusCode,401);
  assert.match((await app.inject({url:'/',headers:{cookie}})).body,/Sign in/);
});

test('identity document spans bootstrap to tenant and keeps external resources planned', () => {
  assert.equal(catalog.views[0].id, 'identityLifecycle');
  for (const id of ['installer', 'nodeIdentity', 'bootstrap', 'gitops', 'appInstaller', 'human', 'platformAuthority', 'tenantAuthority', 'runtimeIdentity', 'baoIdentity', 'esoIdentity', 'serviceCredentials', 'pki', 'recovery', 'cloudTrust', 'rds']) {
    assert.ok(catalog.views[0].nodes.includes(id), id);
  }
  for (const id of ['cloudTrust', 'rds']) assert.equal(catalog.nodes.find(n => n.id === id).status, 'planned');
  assert.equal(catalog.nodes.find(n => n.id === 'tenantAuthority').status, 'unverified');
  assert.match(catalog.nodes.find(n => n.id === 'platformAuthority').usage, /without requiring a tenant role/);
  assert.equal(catalog.journeys.find(j => j.id === 'identityLifecycle').status, 'unverified');
  assert.ok(!JSON.stringify(catalog).includes('home.arpa'));
});
