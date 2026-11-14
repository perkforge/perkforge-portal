import test from 'node:test';
import assert from 'node:assert/strict';
import { readInventory, validateInventory } from '../server/enrollment-inventory.mjs';
import { readConfig } from '../server/config.mjs';
const commit = 'a'.repeat(40);
const entry = { name: 'app', namespace: 'app-config', targetNamespace: 'app', path: './gitops/local', suspended: false, source: { name: 'app', namespace: 'app-config', ref: { tag: 'v1.0.0' }, suspended: true } };
const data = { schemaVersion: 1, evidenceType: 'declared-enrollment-selection', selections: { local: [entry] } };
test('inventory is fixed-path commit-pinned and explicitly declared-only', async () => {
  const result = await readInventory({ commit, selector: 'local', fetcher: async (url, opts) => { assert.equal(url, `https://api.github.com/repos/perkforge/perkforge-platform-tenants/contents/enrollment-inventory.json?ref=${commit}`); assert.equal(opts.redirect, 'error'); return new Response(JSON.stringify(data)); } });
  assert.equal(result.state, 'available'); assert.deepEqual(result.entries, [entry]); assert.equal(result.commit, commit);
  assert.equal((await readInventory()).state, 'disabled');
});
test('malformed, missing and oversized inventory are unavailable, never success-empty', async () => {
  for (const body of ['invalid', 'a'.repeat(131073), JSON.stringify({ ...data, schemaVersion: 9 }), JSON.stringify({ ...data, selections: {} })]) {
    assert.equal((await readInventory({ commit, selector: 'local', fetcher: async () => new Response(body) })).state, 'unavailable');
  }
  assert.equal((await readInventory({ commit, selector: 'local', fetcher: async () => new Response('', { status: 404 }) })).state, 'unavailable');
});
test('unsafe refs/selectors never cause network access and config fails closed', async () => {
  let requests = 0;
  assert.equal((await readInventory({ commit: 'main', selector: 'local', fetcher: () => { requests++; } })).state, 'unavailable'); assert.equal(requests, 0);
  assert.throws(() => readConfig({ ENROLLMENT_SOURCE_COMMIT: commit }));
  assert.throws(() => readConfig({ ENROLLMENT_SOURCE_COMMIT: commit, ENROLLMENT_SELECTOR: '../../bad' }));
  assert.equal(readConfig({ ENROLLMENT_SOURCE_COMMIT: commit, ENROLLMENT_SELECTOR: 'local' }).inventoryCommit, commit);
});
test('projection strips unknown fields; duplicates and missing source refs fail', () => {
  const extra = structuredClone(data); extra.selections.local[0].status = 'Ready';
  assert.deepEqual(validateInventory(extra, 'local'), [entry]);
  extra.selections.local.push(entry); assert.throws(() => validateInventory(extra, 'local'));
  const bad = structuredClone(data); bad.selections.local[0].source.ref = {}; assert.throws(() => validateInventory(bad, 'local'));
  assert.deepEqual(validateInventory({ ...data, selections: { local: [] } }, 'local'), []);
});
