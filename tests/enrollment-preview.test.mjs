import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { previewEnrollmentChange } from '../server/enrollment-preview.mjs';
const contract = JSON.parse(readFileSync(new URL('./fixtures/preview-v1.json', import.meta.url)));
function input() { return { contract: structuredClone(contract), sourceCommit: 'a'.repeat(40),
  inventory: { schemaVersion: 1, evidenceType: 'declared-enrollment-selection', selections: { 'local-nextcloud-portal': [{ name: 'tenant-portal', namespace: 'tenant-portal-config', source: { name: 'tenant-portal', namespace: 'tenant-portal-config', ref: { tag: 'v2.3.1' } } }] } },
  request: { operation: 'application-release-pin', mapping: 'integrated-portal-release', expectedTag: 'v2.3.1', proposedTag: 'v2.4.0' } }; }
test('deterministic bounded semantic proposal, never a submitted MR or deployment', () => {
  const data = input(); const before = JSON.stringify(data); const result = previewEnrollmentChange(data);
  assert.equal(result.status, 'proposal'); assert.equal(result.writable, false); assert.equal(result.readyToSubmit, false);
  assert.equal(result.changes.length, 1); assert.equal(result.changes[0].field, '/spec/ref/tag');
  assert.deepEqual(result, previewEnrollmentChange(data)); assert.equal(JSON.stringify(data), before);
  data.request.proposedTag = data.request.expectedTag; assert.equal(previewEnrollmentChange(data).status, 'no-change');
});
test('customer creation and membership are explicitly unconfigured', () => {
  for (const operation of ['create-customer', 'change-membership']) {
    const data = input(); data.request = { operation };
    assert.equal(previewEnrollmentChange(data).reason, 'customer-or-membership-template-unconfigured');
  }
});
test('reject arbitrary browser targets, stale pins, collisions and future schema', () => {
  const cases = [d => { d.request.namespace = 'other'; }, d => { d.request.proposedTag = 'main'; },
    d => { d.request.expectedTag = 'v1.0.0'; }, d => { d.contract.schemaVersion = 2; },
    d => { d.contract.applicationProfiles.push(d.contract.applicationProfiles[0]); },
    d => { d.contract.applicationProfiles[0].template = '../escape'; },
    d => { d.inventory.selections['local-nextcloud-portal'].push(d.inventory.selections['local-nextcloud-portal'][0]); },
    d => { d.inventory.selections['local-nextcloud-portal'][0].source.ref.branch = 'main'; },
    d => { d.contract.customerTemplates.push({ id: 'unreviewed' }); }, d => { d.sourceCommit = 'main'; }];
  for (const mutate of cases) { const data = input(); mutate(data); const result = previewEnrollmentChange(data); assert.equal(result.status, 'blocked'); assert.deepEqual(result.changes, []); }
});
test('offline CLI emits proposal and rejects malformed/oversized input without echoing it', () => {
  const run = value => spawnSync(process.execPath, ['scripts/enrollment-preview.mjs'], { input: value, encoding: 'utf8' });
  const good = run(JSON.stringify(input())); assert.equal(good.status, 0); assert.equal(JSON.parse(good.stdout).status, 'proposal');
  for (const bad of ['private-invalid-input', 'x'.repeat(262145)]) { const r = run(bad); assert.equal(r.status, 2); assert.equal(r.stdout, ''); assert.equal(r.stderr, 'Invalid preview input; no changes made.\n'); }
});
