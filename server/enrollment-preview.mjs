// Pure, offline proposal builder. Deliberately not registered as an HTTP route.
// Contract + inventory must be supplied from the same reviewed source commit.
const tag = /^v\d+\.\d+\.\d+$/;
const name = /^[a-z][a-z0-9-]{0,62}$/;
function exact(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
function blocked(reason) {
  return { mode: 'preview-only', writable: false, readyToSubmit: false, status: 'blocked', reason, changes: [] };
}
export function previewEnrollmentChange({ contract, inventory, sourceCommit, request }) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit || '')) return blocked('invalid-source-commit');
  if (!exact(contract, ['schemaVersion', 'kind', 'status', 'repository', 'customerTemplates', 'membershipTemplates', 'applicationProfiles'])
    || contract.schemaVersion !== 1 || contract.kind !== 'EnrollmentPreviewContract'
    || contract.status !== 'proposal-only' || contract.repository !== 'perkforge/perkforge-platform-tenants'
    || !Array.isArray(contract.customerTemplates) || contract.customerTemplates.length
    || !Array.isArray(contract.membershipTemplates) || contract.membershipTemplates.length
    || !Array.isArray(contract.applicationProfiles) || contract.applicationProfiles.length > 100) return blocked('unsupported-contract');
  const ids = new Set();
  const targets = new Set();
  for (const m of contract.applicationProfiles) {
    if (!exact(m, ['id', 'cluster', 'environment', 'profile', 'selector', 'application', 'namespace', 'template', 'resourceKind', 'field'])
      || !['id', 'cluster', 'environment', 'profile', 'selector', 'application', 'namespace'].every(k => typeof m[k] === 'string' && name.test(m[k]))
      || m.template !== `clusters/${m.selector}/kustomization.yaml`
      || m.resourceKind !== 'GitRepository' || m.field !== '/spec/ref/tag') return blocked('invalid-mapping');
    const target = `${m.template}:${m.namespace}:${m.application}:${m.field}`;
    if (ids.has(m.id) || targets.has(target)) return blocked('mapping-collision');
    ids.add(m.id); targets.add(target);
  }
  if (request?.operation === 'create-customer' || request?.operation === 'change-membership') return blocked('customer-or-membership-template-unconfigured');
  if (!exact(request, ['operation', 'mapping', 'expectedTag', 'proposedTag']) || request.operation !== 'application-release-pin'
    || !tag.test(request.expectedTag) || !tag.test(request.proposedTag)) return blocked('invalid-request');
  const mapping = contract.applicationProfiles.find(m => m.id === request.mapping);
  if (!mapping) return blocked('unknown-mapping');
  if (inventory?.schemaVersion !== 1 || inventory.evidenceType !== 'declared-enrollment-selection'
    || !Array.isArray(inventory.selections?.[mapping.selector])) return blocked('inventory-unavailable');
  const entries = inventory.selections[mapping.selector];
  if (entries.length > 100) return blocked('inventory-unavailable');
  const matches = entries.filter(e => e?.name === mapping.application && e?.namespace === mapping.namespace);
  if (matches.length !== 1) return blocked('inventory-collision-or-missing');
  const entry = matches[0];
  if (entry.source?.name !== mapping.application || entry.source?.namespace !== mapping.namespace
    || !exact(entry.source?.ref, ['tag']) || entry.source.ref.tag !== request.expectedTag) return blocked('stale-or-conflicting-base');
  const changes = request.proposedTag === request.expectedTag ? [] : [{
    file: mapping.template,
    target: { kind: mapping.resourceKind, name: mapping.application, namespace: mapping.namespace },
    field: mapping.field, expected: request.expectedTag, proposed: request.proposedTag,
  }];
  return { mode: 'preview-only', writable: false, readyToSubmit: false, status: changes.length ? 'proposal' : 'no-change',
    repository: contract.repository, sourceCommit, selection: mapping.selector,
    evidence: 'declared-source-only', changes,
    requiredChecks: ['verify-contract-and-inventory-at-source-commit', 're-read-source-target-and-check-base', 'verify-published-release-and-compatibility', 'review-and-repository-ci'],
    notice: 'No MR submitted, release published, resource reconciled or identity changed.' };
}
