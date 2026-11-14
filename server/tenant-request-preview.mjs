import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const roles = ['tenant-admin', 'tenant-developer', 'tenant-viewer'];
const leaf = { 'tenant-admin': 'admins', 'tenant-developer': 'developers', 'tenant-viewer': 'viewers' };
const reserved = new Set(['platform', 'system', 'kube-system', 'default', 'bigbang', 'cattle-system', 'keycloak', 'openbao', 'headlamp', 'longhorn-system']);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const slug = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,30}$/.test(value) && !reserved.has(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === [...keys].sort().join();
function validSnapshot(s, now) {
  if (!exact(s, ['schemaVersion', 'realm', 'sourceCommit', 'capturedAt', 'customerProfiles', 'contexts']) || s.schemaVersion !== 1 || s.realm !== 'perkforge'
    || typeof s.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(s.sourceCommit)
    || typeof s.capturedAt !== 'string' || !Number.isFinite(Date.parse(s.capturedAt))
    || now - Date.parse(s.capturedAt) > 900000 || Date.parse(s.capturedAt) - now > 60000
    || !Array.isArray(s.customerProfiles) || s.customerProfiles.length
    || !Array.isArray(s.contexts) || s.contexts.length > 100) return false;
  const contextIds = new Set(); const groupIds = new Set();
  for (const c of s.contexts) {
    if (!exact(c, ['id', 'groups', 'eligibleSubjects']) || !slug(c.id) || contextIds.has(c.id) || !exact(c.groups, roles)
      || !Array.isArray(c.eligibleSubjects) || c.eligibleSubjects.length > 1000) return false;
    contextIds.add(c.id);
    for (const role of roles) {
      const group = c.groups[role];
      if (!exact(group, ['id', 'path']) || !uuid(group.id) || groupIds.has(group.id)
        || group.path !== `/tenants/${c.id}/${leaf[role]}`) return false;
      groupIds.add(group.id);
    }
    const subjects = new Set(); const localGroups = Object.values(c.groups).map(g => g.id);
    for (const subject of c.eligibleSubjects) {
      if (!exact(subject, ['subject', 'memberGroupIds']) || !uuid(subject.subject) || subjects.has(subject.subject)
        || !Array.isArray(subject.memberGroupIds) || subject.memberGroupIds.length > 3
        || new Set(subject.memberGroupIds).size !== subject.memberGroupIds.length
        || !subject.memberGroupIds.every(id => localGroups.includes(id))) return false;
      subjects.add(subject.subject);
    }
  }
  return true;
}
function result(status, reason, extra = {}) {
  return { status, reason, mode: 'preview-only', persisted: false, submitted: false, writable: false, readyToSubmit: false, ...extra };
}
// Caller supplies only a signature/issuer/audience/azp/expiry-verified principal.
// This additional operation check never grants login or broadens the pilot policy.
export function previewTenantRequest(principal, request, snapshot, now = Date.now()) {
  if (!slug(request?.tenant)) return result('invalid', 'invalid-tenant-request');
  const groups = Array.isArray(principal?.groups) ? principal.groups : [];
  const platformAdmin = groups.includes('/platform/admins');
  const tenantAdmin = groups.includes(`/tenants/${request.tenant}/admins`)
    && Array.isArray(principal?.realm_access?.roles) && principal.realm_access.roles.includes('tenant-admin');
  if (!principal?.sub || !(platformAdmin || tenantAdmin)) return result('denied', 'access-denied');
  if (request.operation === 'create-customer' && !platformAdmin) return result('denied', 'access-denied');
  if (!validSnapshot(snapshot, now)) return result('blocked', 'reviewed-context-unavailable');
  const context = snapshot.contexts.find(c => c.id === request.tenant);
  if (request.operation === 'create-customer') {
    if (!exact(request, ['operation', 'tenant', 'profile']) || typeof request.profile !== 'string' || !/^[a-z][a-z0-9-]{0,62}$/.test(request.profile)) return result('invalid', 'invalid-tenant-request');
    return result('blocked', context ? 'tenant-collision' : 'customer-profile-unconfigured');
  }
  if (!exact(request, ['operation', 'tenant', 'subject', 'role']) || !['add-membership', 'remove-membership'].includes(request.operation)
    || !uuid(request.subject) || !roles.includes(request.role)) return result('invalid', 'invalid-membership-request');
  if (!context) return result('blocked', 'reviewed-context-unavailable');
  // Admin membership/self-elevation/last-admin policies are not chosen by this slice.
  if (request.role === 'tenant-admin') return result('blocked', 'admin-membership-policy-unconfigured');
  const subject = context.eligibleSubjects.find(s => s.subject === request.subject);
  if (!subject) return result('blocked', 'subject-not-approved-for-context');
  const group = context.groups[request.role];
  const present = subject.memberGroupIds.includes(group.id);
  const change = (request.operation === 'add-membership') !== present;
  return result(change ? 'proposal' : 'no-change', 'review-required', {
    context: context.id, sourceCommit: snapshot.sourceCommit, capturedAt: snapshot.capturedAt,
    change: change ? { operation: request.operation, subject: subject.subject, groupId: group.id, groupPath: group.path, expectedPresent: present } : null,
    requiredChecks: ['revalidate-actor-and-context', 're-read-immutable-subject-and-group-ownership', 'compare-membership-before-write', 'approved-scoped-writer', 'native-readback-and-downstream-revocation'],
    notice: 'No request saved or sent; no account, membership, role or deployment changed.',
  });
}
export async function loadTenantRequestSnapshot(config, reader = readFile) {
  if (!config.tenantRequestDigest) return undefined;
  try {
    const bytes = await reader('/etc/portal/tenant-requests/context.json');
    if (bytes.length > 262144 || createHash('sha256').update(bytes).digest('hex') !== config.tenantRequestDigest) return undefined;
    return JSON.parse(bytes.toString('utf8'));
  } catch { return undefined; }
}
