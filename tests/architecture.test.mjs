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
test('production static delivery exposes only public-safe assets and never architecture source/private paths', async t => {
  const app = await buildApp(config); t.after(() => app.close());
  for (const url of ['/architecture/private/model.json', '/architecture/public/model.c4', '/src/architecture/catalog.json', '/server/app.mjs', '/.env']) assert.equal((await app.inject(url)).statusCode, 404, url);
  const html = await app.inject('/'); assert.equal(html.statusCode, 200);
  assert.match(html.headers['content-security-policy'], /script-src 'self'/);
  const assets = await readdir(new URL('../dist/assets', import.meta.url));
  for (const name of assets) {
    const asset = await app.inject(`/assets/${name}`); assert.equal(asset.statusCode, 200);
    assert.equal(asset.headers['cache-control'], 'no-store');
    assert.ok(!asset.body.includes('Platform engineering workspace')); // authorized context stays on server
    assert.ok(!asset.body.includes('fixture-home')); // directory fixture stays on server
  }
});
