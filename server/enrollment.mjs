const repo = 'https://github.com/perkforge/perkforge-platform-tenants';
const endpoint = 'https://api.github.com/repos/perkforge/perkforge-platform-tenants/releases/latest';
// Fixed public source only. No browser-controlled URLs, refs, credentials or writes.
export async function enrollmentStatus({ enabled = false, fetcher = fetch } = {}) {
  const result = {
    repository: repo,
    source: { state: enabled ? 'unavailable' : 'disabled', release: null },
    deployment: { state: 'unavailable', reason: 'No scoped Flux reader is configured. A published release does not prove deployment.' },
    capabilities: { createTenant: false, manageUsers: false },
  };
  if (!enabled) return result;
  try {
    const response = await fetcher(endpoint, { redirect: 'error', signal: AbortSignal.timeout(4000), headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) return result;
    const reader = response.body.getReader(); let bytes = 0; const chunks = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 131072) { await reader.cancel(); throw new Error('Oversize source response'); } chunks.push(value); }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (data.draft || data.prerelease || !/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(data.tag_name) || !Number.isFinite(Date.parse(data.published_at))) return result;
    result.source = { state: 'available', release: { tag: data.tag_name, publishedAt: data.published_at, url: `${repo}/releases/tag/${data.tag_name}` }, checkedAt: new Date().toISOString() };
  } catch { /* Fail closed, without exposing upstream errors or request details. */ }
  return result;
}
