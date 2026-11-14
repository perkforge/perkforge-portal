import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { fileURLToPath } from 'node:url';
import * as oidc from 'openid-client';
import { createRemoteJWKSet } from 'jose';
import { Sessions, random, equal, safeReturn, validateAccess } from './security.mjs';
import { listTenants } from './tenants.mjs';
const cookieName = '__Host-portal';
const cookieOptions = { path: '/', secure: true, httpOnly: true, sameSite: 'lax' };
export async function buildApp(config, options = {}) {
  // No request logging: callback URLs contain authorization codes.
  const app = Fastify({ logger: false, bodyLimit: 8192, trustProxy: false });
  const sessions = options.sessions || new Sessions();
  let discovery;
  let keys;
  async function provider() {
    if (options.provider) return options.provider;
    if (!config.issuer) throw new Error('Identity unavailable');
    if (!discovery) {
      discovery = await oidc.discovery(new URL(config.issuer), config.clientId, config.clientSecret, undefined, { timeout: 5 });
      const uri = new URL(discovery.serverMetadata().jwks_uri);
      if (uri.protocol !== 'https:') throw new Error('Insecure JWKS');
      keys = createRemoteJWKSet(uri, { timeoutDuration: 5000 });
    }
    return discovery;
  }
  const verify = options.verify || (async token => { await provider(); return validateAccess(token, keys, config); });
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], connectSrc: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"] } } });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.addHook('onRequest', async (_req, reply) => { reply.header('Cache-Control', 'no-store'); });
  app.setErrorHandler((_error, _req, reply) => reply.code(503).send({ error: 'Service unavailable. Please try again.' }));
  function session(req) { return sessions.get(req.cookies[cookieName]); }
  function setCookie(reply, id, ttl) { reply.setCookie(cookieName, id, { ...cookieOptions, maxAge: Math.floor(ttl / 1000) }); }
  function csrf(req, reply) {
    const s = session(req);
    if (req.headers.origin !== config.origin || !s || !equal(req.headers['x-csrf-token'], s.csrf)) { reply.code(403).send({ error: 'Request rejected' }); return false; }
    return true;
  }
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/auth/session', async (req, reply) => {
    let s = session(req);
    if (s?.token) {
      try { const p = await verify(s.token); return { authenticated: true, user: { name: String(p.preferred_username || p.sub).slice(0, 100) }, expiresAt: s.expires, csrf: s.csrf }; }
      catch { sessions.delete(req.cookies[cookieName]); s = undefined; }
    }
    if (!s) { const id = sessions.create({ csrf: random() }, 600_000); setCookie(reply, id, 600_000); s = sessions.get(id); }
    return { authenticated: false, loginConfigured: Boolean(config.issuer), csrf: s.csrf };
  });
  app.post('/auth/login', async (req, reply) => {
    if (!csrf(req, reply)) return;
    const client = await provider();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState(); const nonce = oidc.randomNonce();
    const id = sessions.create({ csrf: random(), verifier, state, nonce, returnTo: safeReturn(req.body?.returnTo) }, 300_000);
    sessions.delete(req.cookies[cookieName]); setCookie(reply, id, 300_000);
    const url = oidc.buildAuthorizationUrl(client, { redirect_uri: `${config.origin}/auth/callback`, scope: 'openid profile', code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', state, nonce });
    return { authorizationUrl: url.href };
  });
  app.get('/auth/callback', async (req, reply) => {
    const s = session(req); sessions.delete(req.cookies[cookieName]); reply.clearCookie(cookieName, cookieOptions);
    if (!s?.state) return reply.code(400).send({ error: 'Login expired. Start again.' });
    try {
      const client = await provider();
      const tokens = await oidc.authorizationCodeGrant(client, new URL(req.url, config.origin), { pkceCodeVerifier: s.verifier, expectedState: s.state, expectedNonce: s.nonce, idTokenExpected: true });
      const p = await verify(tokens.access_token);
      if (tokens.claims()?.sub !== p.sub) throw new Error('Subject mismatch');
      const ttl = Math.min(1_800_000, p.exp * 1000 - Date.now());
      if (ttl <= 0) throw new Error('Expired token');
      const id = sessions.create({ token: tokens.access_token, csrf: random() }, ttl);
      setCookie(reply, id, ttl); return reply.redirect(s.returnTo);
    } catch { return reply.code(401).send({ error: 'Sign-in could not be completed. Return home and try again.' }); }
  });
  app.post('/auth/logout', async (req, reply) => {
    if (!csrf(req, reply)) return;
    sessions.delete(req.cookies[cookieName]); reply.clearCookie(cookieName, cookieOptions); return { signedOut: true };
  });
  // Bearer-only API boundary. Cookies never authorize this route.
  app.get('/api/tenants', async (req, reply) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if (!match) return reply.code(401).header('WWW-Authenticate', 'Bearer').send({ error: 'Bearer token required' });
    try { await verify(match[1]); } catch { return reply.code(403).send({ error: 'Access denied' }); }
    return listTenants(config.mode);
  });
  app.get('/bff/tenants', async (req, reply) => {
    const s = session(req);
    if (!s?.token) return reply.code(401).send({ error: 'Sign in to view tenants' });
    // Same-process HTTP injection preserves the real bearer middleware without a network hop.
    const result = await app.inject({ method: 'GET', url: '/api/tenants', headers: { authorization: `Bearer ${s.token}` } });
    return reply.code(result.statusCode).type('application/json').send(result.body);
  });
  // Audience-specific guidance is authorized server-side on every request. The
  // client bundle contains only the separate, explicitly sanitized public model.
  app.get('/bff/architecture-context', async (req, reply) => {
    const s = session(req);
    if (!s?.token) return reply.code(401).send({ error: 'Sign in to view workspace context' });
    try { await verify(s.token); } catch { return reply.code(403).send({ error: 'Access denied' }); }
    return config.accessPolicy === 'platform-admins'
      ? { audience: 'Platform engineering workspace', views: ['platformBoundary', 'foundation', 'identity'], notice: 'Review platform scope, shared-service responsibilities and proposed authorization boundaries. This is sanitized documentation; no administrative controls or restricted inventory are provided.' }
      : { audience: 'Tenant workspace', views: ['tenantBoundary', 'identity'], notice: 'Review the generic tenant boundary and shared responsibilities. No other tenant inventory or administrative operational detail is available. Your resource access is decided by application policy and Kubernetes RBAC.' };
  });
  if (options.static !== false) await app.register(staticFiles, { root: fileURLToPath(new URL('../dist', import.meta.url)), index: 'index.html', cacheControl: false });
  return app;
}
