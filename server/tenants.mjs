export const sourcePath = '/PerkForge/platform/tenants';
// Future adapter: direct subgroups only. Never enumerate recursively or accept browser paths.
// There is deliberately no GitLab transport, credential, or enabled mode.
export function listTenants(mode = 'disabled') {
  if (!['disabled', 'mock'].includes(mode)) throw new Error('Unsupported tenant source');
  return { source: { provider: 'gitlab', path: sourcePath, mode, connected: false, scope: 'direct-subgroups' }, tenants: mode === 'mock' ? [{ id: 'fixture-home', name: 'Example household', path: `${sourcePath}/fixture-home` }] : [] };
}
