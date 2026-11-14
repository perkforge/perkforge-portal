import { randomBytes, timingSafeEqual } from 'node:crypto';
import { jwtVerify } from 'jose';
export const random = () => randomBytes(32).toString('base64url');
export function equal(a, b) { return typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
export function safeReturn(value) { return value === '/' ? value : '/'; }
export class Sessions {
  constructor(max = 1000, now = Date.now) { this.items = new Map(); this.max = max; this.now = now; }
  get(id) { const s = this.items.get(id); if (s && s.expires > this.now()) return s; this.items.delete(id); }
  create(value, ttl) { for (const id of this.items.keys()) this.get(id); if (this.items.size >= this.max) throw new Error('Session capacity reached'); const id = random(); this.items.set(id, { ...value, expires: this.now() + ttl }); return id; }
  delete(id) { this.items.delete(id); }
}
export async function validateAccess(token, keys, config) {
  const { payload } = await jwtVerify(token, keys, { issuer: config.issuer, audience: config.audience, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'] });
  const roles = payload.resource_access?.[config.audience]?.roles;
  const policyGroups = config.accessPolicy === 'platform-admins' ? ['/platform/admins']
    : config.accessPolicy === 'home' ? ['/tenants/home/admins', '/tenants/home/developers', '/tenants/home/viewers'] : null;
  // Platform authority is independent of tenant membership or tenant-scoped roles.
  const roleAllowed = config.accessPolicy === 'platform-admins'
    || (config.accessPolicy === 'home' && Array.isArray(roles) && roles.includes('tenant-reader'));
  if (!policyGroups || !roleAllowed || typeof payload.sub !== 'string' || !payload.sub || payload.azp !== config.clientId || !Array.isArray(payload.groups) || !payload.groups.some(g => policyGroups.includes(g))) throw new Error('Forbidden');
  return payload;
}
