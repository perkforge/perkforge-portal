import { selectors } from './enrollment-inventory.mjs';
export function readConfig(env = process.env) {
  const listenHost = env.LISTEN_HOST || '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(listenHost)) throw new Error('Unsupported listen address');
  const origin = env.PORTAL_ORIGIN || 'https://localhost:3443';
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('PORTAL_ORIGIN must be an HTTPS origin');
  const issuer = env.OIDC_ISSUER;
  if (issuer && new URL(issuer).protocol !== 'https:') throw new Error('OIDC issuer must use HTTPS');
  if (issuer && (!env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET || !env.OIDC_AUDIENCE)) throw new Error('Incomplete OIDC configuration');
  const mode = env.TENANT_SOURCE || 'disabled';
  if (!['disabled', 'mock'].includes(mode)) throw new Error('GitLab live access is not implemented');
  const enrollmentSource = env.ENROLLMENT_SOURCE || 'disabled';
  if (!['disabled', 'github-public', 'gitops-configmap'].includes(enrollmentSource)) throw new Error('Unsupported enrollment source');
  const inventoryDigest = env.ENROLLMENT_INVENTORY_SHA256;
  if (enrollmentSource === 'gitops-configmap' && !/^[a-f0-9]{64}$/.test(inventoryDigest || '')) throw new Error('GitOps inventory requires expected SHA256');
  const inventoryCommit = env.ENROLLMENT_SOURCE_COMMIT;
  const inventorySelector = env.ENROLLMENT_SELECTOR;
  if (Boolean(inventoryCommit) !== Boolean(inventorySelector) || (inventoryCommit && (!/^[a-f0-9]{40}$/.test(inventoryCommit) || !selectors.includes(inventorySelector)))) throw new Error('Enrollment inventory requires exact commit and supported selector');
  const tenantRequestDigest = env.TENANT_REQUEST_CONTEXT_SHA256;
  if (tenantRequestDigest !== undefined && !/^[a-f0-9]{64}$/.test(tenantRequestDigest)) throw new Error('Tenant request context requires exact SHA256');
  const accessPolicy = env.PORTAL_ACCESS_POLICY || 'home';
  if (issuer && !env.PORTAL_ACCESS_POLICY) throw new Error('Explicit portal access policy required for SSO');
  if (!['home', 'platform-admins'].includes(accessPolicy)) throw new Error('Unsupported portal access policy');
  return { listenHost, origin, issuer, clientId: env.OIDC_CLIENT_ID, clientSecret: env.OIDC_CLIENT_SECRET, audience: env.OIDC_AUDIENCE, mode, accessPolicy, enrollmentSource, inventoryCommit, inventorySelector, inventoryDigest, tenantRequestDigest };
}
