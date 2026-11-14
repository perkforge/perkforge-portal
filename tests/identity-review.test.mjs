import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkIdentityReview } from '../scripts/check-identity-docs.mjs';
test('identity-sensitive code cannot omit model and docs review', () => {
  for (const p of ['server/security.mjs', 'server/app.mjs', 'server/config.mjs', 'server/enrollment.mjs', 'src/Enrollment.tsx']) {
    assert.throws(() => checkIdentityReview([p]));
    assert.throws(() => checkIdentityReview([p,'docs/identity-maintenance.md']));
    assert.doesNotThrow(() => checkIdentityReview([p,'src/architecture/catalog.json','docs/identity-maintenance.md']));
  }
  assert.doesNotThrow(() => checkIdentityReview(['src/style.css']));
});
test('current identity snapshot labels evidence and never implies discovery', async () => {
  const c=JSON.parse(await readFile(new URL('../src/architecture/catalog.json',import.meta.url)));
  assert.ok(Number.isFinite(Date.parse(c.identitySnapshot.checkedAt)));
  assert.match(c.identitySnapshot.notice,/not automatic discovery/);
  const ids=new Set(c.nodes.map(n=>n.id));
  for(const r of c.identitySnapshot.records){assert.ok(ids.has(r.id));assert.ok(['observed-active','staged','source-only','planned','unverified'].includes(r.state));assert.match(r.evidence,/^https:\/\/github.com\/perkforge\//);assert.ok(r.summary.length>50);}
  assert.equal(c.identitySnapshot.records.find(r=>r.id==='mattermostOperator').state,'staged');
  assert.equal(c.identitySnapshot.records.find(r=>r.id==='portalInventory').state,'source-only');
});
