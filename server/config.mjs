export function readConfig(env = process.env) {
  const origin = env.PORTAL_ORIGIN || 'https://localhost:3443';
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('PORTAL_ORIGIN must be an HTTPS origin');
  const issuer = env.OIDC_ISSUER;
  if (issuer && new URL(issuer).protocol !== 'https:') throw new Error('OIDC issuer must use HTTPS');
  if (issuer && (!env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET || !env.OIDC_AUDIENCE)) throw new Error('Incomplete OIDC configuration');
  const mode = env.TENANT_SOURCE || 'disabled';
  if (!['disabled', 'mock'].includes(mode)) throw new Error('GitLab live access is not implemented');
  return { origin, issuer, clientId: env.OIDC_CLIENT_ID, clientSecret: env.OIDC_CLIENT_SECRET, audience: env.OIDC_AUDIENCE, mode };
}
