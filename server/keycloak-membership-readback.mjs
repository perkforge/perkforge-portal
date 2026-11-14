// Pinned26.8.1 GET-only protocol adapter with an explicitly injected transport.
// No fetch/token/default connection; ownership/role policy verification remains a
// separate required receipt, not implied by membership presence or HTTP200.
export async function readExactMembership({ issuer, subject, groupId }, get) {
  const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
  const fail = () => { throw new Error('Membership readback unavailable'); };
  if (!uuid(subject) || !uuid(groupId) || typeof get !== 'function') fail();
  let url;
  try { url = new URL(issuer); } catch { fail(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.href !== issuer || !url.pathname.endsWith('/realms/perkforge')) fail();
  const base = issuer.slice(0, -'/realms/perkforge'.length) + '/admin/realms/perkforge';
  const read = async path => {
    const target = base + path;
    try {
      const response = await get({ method: 'GET', url: target, redirects: 'reject', maxBytes: 65536, timeoutMs: 5000 });
      if (response?.status !== 200 || response.url !== target || response.redirected || Buffer.byteLength(JSON.stringify(response.data)) > 65536) fail();
      return response.data;
    } catch { fail(); } // Never propagate raw transport/API errors or credentials.
  };
  const user = await read(`/users/${subject}`); if (user.id !== subject || user.enabled !== true) fail();
  const group = await read(`/groups/${groupId}`);
  // Exact target must be viewable; filtered listing absence alone proves nothing.
  if (group.id !== groupId || group.access?.view !== true || typeof group.path !== 'string') fail();
  const first = await read(`/users/${subject}/groups/count`);
  if (!Number.isSafeInteger(first.count) || first.count < 0 || first.count > 1000) fail();
  const seen = new Set(); let present = false;
  // Keycloak paginates first, then filters by group-view permission. Never stop
  // at a short/empty filtered page; cover the unfiltered count instead.
  for (let offset = 0; offset < first.count; offset += 100) {
    const page = await read(`/users/${subject}/groups?first=${offset}&max=100&briefRepresentation=true`);
    if (!Array.isArray(page) || page.length > 100) fail();
    for (const member of page) {
      if (!uuid(member?.id) || seen.has(member.id)) fail(); seen.add(member.id);
      if (member.id === groupId) { if (member.path !== group.path) fail(); present = true; }
    }
  }
  const last = await read(`/users/${subject}/groups/count`);
  if (last.count !== first.count) fail();
  return { issuer, subject, groupId, groupPath: group.path, present, ownershipVerified: false,
    limitation: 'Not a transaction or global-membership audit; concurrent same-count changes require writer serialization and fresh ownership checks.' };
}
