import test from 'node:test';
import assert from 'node:assert/strict';
import { enrollmentStatus } from '../server/enrollment.mjs';
import { buildApp } from '../server/app.mjs';
const release = { tag_name: 'v2.3.0', published_at: '2026-11-14T00:00:00Z', draft: false, prerelease: false };
test('disabled source performs no network operation', async () => {
  const result = await enrollmentStatus({ fetcher: () => { throw new Error('must not call'); } });
  assert.equal(result.source.state, 'disabled'); assert.equal(result.deployment.state, 'unavailable'); assert.equal(result.capabilities.createTenant, false);
});
test('public fixed release metadata never implies deployed', async () => {
  const result = await enrollmentStatus({ enabled: true, fetcher: async (url, options) => { assert.equal(url, 'https://api.github.com/repos/perkforge/perkforge-platform-tenants/releases/latest'); assert.equal(options.redirect, 'error'); return new Response(JSON.stringify({ ...release, html_url: 'https://evil.invalid', body: 'do not expose' })); } });
  assert.equal(result.source.release.url, 'https://github.com/perkforge/perkforge-platform-tenants/releases/tag/v2.3.0'); assert.equal(result.deployment.state, 'unavailable'); assert.ok(!JSON.stringify(result).includes('evil'));
});
test('bad responses fail closed without leaking response content', async () => {
  for (const response of [new Response('secret', { status: 403 }), new Response('x'.repeat(131073)), new Response('{bad'), new Response(JSON.stringify({ ...release, tag_name: '../../bad' })), new Response(JSON.stringify({ ...release, draft: true }))]) {
    const result = await enrollmentStatus({ enabled: true, fetcher: async () => response }); assert.equal(result.source.state, 'unavailable'); assert.equal(result.source.release, null);
  }
});
test('enrollment API requires exact platform administrator group; cookies alone do not authorize', async t => {
  let groups = ['/tenants/home/admins']; let reads = 0;
  const app = await buildApp({ origin: 'https://portal.test', enrollmentSource: 'github-public' }, { static: false, verify: async () => ({ groups }), enrollmentFetch: async () => { reads++; return new Response(JSON.stringify(release)); } }); t.after(() => app.close());
  assert.equal((await app.inject('/api/enrollment')).statusCode, 401);
  assert.equal((await app.inject('/bff/enrollment')).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/enrollment', headers: { authorization: 'Bearer test' } })).statusCode, 403); assert.equal(reads, 0);
  groups = ['/platform/admins']; assert.equal((await app.inject({ url: '/api/enrollment', headers: { authorization: 'Bearer test' } })).statusCode, 200); assert.equal(reads, 1);
});
