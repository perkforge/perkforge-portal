import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkIdentityReview } from '../scripts/check-identity-docs.mjs';
test('identity-sensitive code cannot omit model and docs review', () => {
  for (const p of ['server/security.mjs', 'server/app.mjs', 'server/config.mjs', 'server/enrollment.mjs', 'server/enrollment-inventory.mjs', 'src/Enrollment.tsx', 'src/main.tsx']) {
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
  assert.equal(c.identitySnapshot.records.find(r=>r.id==='mattermostOperator').state,'observed-active');
  assert.equal(c.identitySnapshot.records.find(r=>r.id==='portalInventory').state,'observed-active');
});

test('logging ownership guard is distinct from staged query authorization', async () => {
  const c=JSON.parse(await readFile(new URL('../src/architecture/catalog.json',import.meta.url)));
  const guard=c.nodes.find(n=>n.id==='loggingOwnership');
  assert.equal(guard.status,'current');
  assert.match(guard.configuration,/No tenant query access/);
  assert.ok(c.views.find(v=>v.id==='loggingIdentity').nodes.includes(guard.id));
  assert.equal(c.identitySnapshot.records.find(r=>r.id===guard.id).state,'observed-active');
  assert.match(c.identitySnapshot.records.find(r=>r.id==='loggingQuery').summary,/only Viewer/);
  assert.doesNotMatch(JSON.stringify(c), /c0248f64|log-ownership-tenant-portal|loki-boundary-auth/);
});

test('current logging edges match scoped ESO custody and read/write boundaries', async () => {
  const c=JSON.parse(await readFile(new URL('../src/architecture/catalog.json',import.meta.url)));
  const edges=c.edges.filter(e=>e.source.startsWith('logging')||e.target.startsWith('logging'));
  assert.doesNotMatch(JSON.stringify(edges),/Manually staged|pilot machine|admin pilot|Approved pilot/);
  for(const id of ['loggingGateway','loggingCollector','loggingQuery']) assert.ok(edges.some(e=>e.source==='esoIdentity'&&e.target===id&&e.status==='current'));
  assert.match(edges.find(e=>e.source==='loggingCollector'&&e.target==='loggingGateway').title,/push-only/);
  assert.match(edges.find(e=>e.source==='loggingQuery'&&e.target==='loggingGateway').title,/fixed Portal query partition/);
  assert.match(c.nodes.find(n=>n.id==='loggingQuery').configuration,/all three|All three/);
  assert.match(c.nodes.find(n=>n.id==='loggingQuery').runbook,/revoked token/);
  assert.match(c.nodes.find(n=>n.id==='pipelineCoverage').source,/\/docs\/delivery-pipelines\.md$/);
  assert.match(c.nodes.find(n=>n.id==='backupCapture').source,/\/docs\/backup-restore\.md$/);
});

test('GitLab onboarding identity inventory separates provisioned custody from finite runtime', async () => {
  const c=JSON.parse(await readFile(new URL('../src/architecture/catalog.json',import.meta.url)));
  const view=c.views.find(v=>v.id==='gitlabOnboardingIdentity');
  for(const id of ['glNamedAdmin','glTestHuman','glRootIssuer','glSetupOperators','glEso','glParentBot','glAdminReader','glKcReader','glRuntime','glFoundation','glAttestor','glWriter']) assert.ok(view.nodes.includes(id));
  const get=id=>c.nodes.find(n=>n.id===id);
  assert.match(get('glNamedAdmin').configuration,/not automatic/);
  assert.match(get('glParentBot').configuration,/parent subtree, not one child/);
  assert.match(get('glAdminReader').configuration,/Broad instance read/);
  assert.match(get('glWriter').configuration,/No Kubernetes service-account token/);
  assert.match(get('glSetupOperators').configuration,/revoked with accessor readback/);
  assert.match(get('glSetupOperators').configuration,/Persistent policies, ESO roles/);
  assert.match(get('glKcReader').configuration,/member-profile/);
  assert.match(get('glKcReader').runbook,/descendant/);
  assert.match(get('glRuntime').configuration,/no initializer Pod, helper or finite Jobs/);
  assert.match(get('glRuntime').configuration,/eight Deny bindings are active/);
  assert.equal(get('glRuntime').status,'planned');
  assert.equal(c.identitySnapshot.records.find(r=>r.id==='glRuntime').state,'staged');
  assert.doesNotMatch(JSON.stringify(view),/portal-test-admin|parent.?id|192\.168|10\.42/);
});
