import { createHash } from 'node:crypto';
export const selectors = ['local', 'dev', 'local-nextcloud', 'local-nextcloud-portal'];
const base = 'https://api.github.com/repos/perkforge/perkforge-platform-tenants/contents/enrollment-inventory.json';
const name = value => typeof value === 'string' && /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(value) && value.length <= 253;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && Array.from(value).every(c => c.charCodeAt(0) >= 32);
export function validateInventory(data, selector) {
  if (data.schemaVersion !== 1 || data.evidenceType !== 'declared-enrollment-selection' || !selectors.includes(selector)) throw new Error('Unsupported inventory');
  const entries = data.selections?.[selector];
  if (!Array.isArray(entries) || entries.length > 100) throw new Error('Invalid selection');
  const seen = new Set();
  return entries.map(entry => {
    const source = entry.source; const key = `${entry.namespace}/${entry.name}`;
    if (!name(entry.name) || !name(entry.namespace) || (entry.targetNamespace !== null && !name(entry.targetNamespace)) || !text(entry.path) || typeof entry.suspended !== 'boolean' || !source || !name(source.name) || !name(source.namespace) || typeof source.suspended !== 'boolean' || !source.ref || typeof source.ref !== 'object' || Array.isArray(source.ref) || seen.has(key)) throw new Error('Invalid entry');
    seen.add(key); const ref = {};
    for (const [key, value] of Object.entries(source.ref)) {
      if (!['tag', 'commit', 'branch', 'semver'].includes(key) || !text(value)) throw new Error('Invalid ref');
      ref[key] = value;
    }
    if (!Object.keys(ref).length) throw new Error('Missing source ref');
    return { name: entry.name, namespace: entry.namespace, targetNamespace: entry.targetNamespace, path: entry.path, suspended: entry.suspended, source: { name: source.name, namespace: source.namespace, suspended: source.suspended, ref } };
  });
}
export async function readInventory({ commit, selector, fetcher = fetch } = {}) {
  const result = { state: 'disabled', commit: null, selector: null, entries: [] };
  if (!commit || !selector) return result;
  if (!/^[a-f0-9]{40}$/.test(commit) || !selectors.includes(selector)) return { ...result, state: 'unavailable' };
  Object.assign(result, { state: 'unavailable', commit, selector });
  try {
    const response = await fetcher(`${base}?ref=${commit}`, { redirect: 'error', signal: AbortSignal.timeout(4000), headers: { Accept: 'application/vnd.github.raw+json' } });
    if (!response.ok) return result;
    const reader = response.body.getReader(); const chunks = []; let length = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > 131072) { await reader.cancel(); throw new Error('Oversize inventory'); } chunks.push(value); }
    const entries = validateInventory(JSON.parse(Buffer.concat(chunks).toString('utf8')), selector);
    return { ...result, state: 'available', entries, checkedAt: new Date().toISOString() };
  } catch { return result; }
}

// Kubernetes projects ConfigMaps using symlinks. The fixed, read-only mount is
// configured by GitOps, never a browser path or a writable working directory.
export async function readMountedInventory({ commit, selector, expectedDigest, readFile } = {}) {
  const result = { state: 'disabled', commit: null, selector: null, entries: [] };
  if (!commit || !selector) return result;
  if (!/^[a-f0-9]{40}$/.test(commit) || !selectors.includes(selector)) return { ...result, state: 'unavailable' };
  Object.assign(result, { state: 'unavailable', commit, selector, transport: 'gitops-configmap' });
  if (!/^[a-f0-9]{64}$/.test(expectedDigest || '')) return result;
  try {
    const read = readFile || (async () => {
      const { open } = await import('node:fs/promises');
      const file = await open('/etc/portal/enrollment/enrollment-inventory.json', 'r');
      try {
        const buffer = Buffer.alloc(131073); let total = 0;
        while (total < buffer.length) { const { bytesRead } = await file.read(buffer, total, buffer.length - total, total); if (!bytesRead) break; total += bytesRead; }
        return buffer.subarray(0, total);
      }
      finally { await file.close(); }
    });
    const content = await read();
    if (Buffer.byteLength(content) > 131072) throw new Error('Oversize inventory');
    if (createHash('sha256').update(content).digest('hex') !== expectedDigest) throw new Error('Inventory digest mismatch');
    const entries = validateInventory(JSON.parse(content.toString()), selector);
    return { ...result, state: 'available', entries, checkedAt: new Date().toISOString() };
  } catch { return result; }
}
