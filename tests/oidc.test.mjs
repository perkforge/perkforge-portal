import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import * as oidc from 'openid-client';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { buildApp } from '../server/app.mjs';
import { validateAccess } from '../server/security.mjs';
test('isolated OIDC code flow verifies PKCE, nonce, state, single-use callback and session rotation', async t => {
  const { privateKey, publicKey } = await generateKeyPair('RS256'); const jwk = { ...await exportJWK(publicKey), kid: 'fixture', alg: 'RS256', use: 'sig' };
  const fixture = Fastify(); t.after(() => fixture.close()); fixture.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_r, body, done) => done(null, new URLSearchParams(body)));
  let nonce; let challenge; let badNonce = false; let exchanges = 0;
  fixture.get('/jwks', async () => ({ keys: [jwk] }));
  await fixture.listen({ host: '127.0.0.1', port: 0 }); const issuer = `http://127.0.0.1:${fixture.server.address().port}`;
  // Routes must precede listen; token endpoint uses a separate fixture below.
  await fixture.close();
  const server = Fastify(); t.after(() => server.close()); server.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_r, body, done) => done(null, new URLSearchParams(body)));
  server.get('/jwks', async () => ({ keys: [jwk] }));
  const config = { origin: 'https://portal.test', issuer, audience: 'portal-api', clientId: 'portal', mode: 'disabled' };
  async function sign(claims, aud) { return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).setIssuer(issuer).setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(privateKey); }
  server.post('/token', async req => { exchanges++; assert.equal(await oidc.calculatePKCECodeChallenge(req.body.get('code_verifier')), challenge); return { token_type: 'Bearer', access_token: await sign({ sub: 'fixture-user', azp: 'portal', groups: ['/tenants/home/viewers'], resource_access: { 'portal-api': { roles: ['tenant-reader'] } } }, 'portal-api'), id_token: await sign({ sub: 'fixture-user', nonce: badNonce ? 'wrong' : nonce }, 'portal') }; });
  await server.listen({ host: '127.0.0.1', port: Number(new URL(issuer).port) });
  const client = new oidc.Configuration({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` }, 'portal', 'fixture-secret'); oidc.allowInsecureRequests(client);
  const app = await buildApp(config, { static: false, provider: client, verify: token => validateAccess(token, createLocalJWKSet({ keys: [jwk] }), config) }); t.after(() => app.close());
  async function start() { const s = await app.inject('/auth/session'); const login = await app.inject({ method: 'POST', url: '/auth/login', headers: { cookie: s.headers['set-cookie'].split(';')[0], origin: config.origin, 'x-csrf-token': s.json().csrf }, payload: { returnTo: '//evil.test' } }); assert.equal(login.statusCode, 200); const url = new URL(login.json().authorizationUrl); nonce = url.searchParams.get('nonce'); challenge = url.searchParams.get('code_challenge'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); return { cookie: login.headers['set-cookie'].split(';')[0], state: url.searchParams.get('state') }; }
  let flow = await start(); let result = await app.inject({ url: `/auth/callback?code=fixture&state=${flow.state}`, headers: { cookie: flow.cookie } }); assert.equal(result.statusCode, 302); assert.equal(result.headers.location, '/'); const authenticated = [result.headers['set-cookie']].flat().at(-1).split(';')[0]; assert.notEqual(authenticated, flow.cookie); assert.equal((await app.inject({ url: '/bff/tenants', headers: { cookie: authenticated } })).statusCode, 200);
  assert.equal((await app.inject({ url: `/auth/callback?code=fixture&state=${flow.state}`, headers: { cookie: flow.cookie } })).statusCode, 400);
  flow = await start(); const before = exchanges; result = await app.inject({ url: '/auth/callback?code=fixture&state=wrong', headers: { cookie: flow.cookie } }); assert.equal(result.statusCode, 401); assert.equal(exchanges, before);
  flow = await start(); badNonce = true; result = await app.inject({ url: `/auth/callback?code=fixture&state=${flow.state}`, headers: { cookie: flow.cookie } }); assert.equal(result.statusCode, 401);
});
