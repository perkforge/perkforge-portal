import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
export function identityReviewRequired(paths) {
  return paths.some(p => /^server\/.+\.(mjs|js|ts)$/.test(p) || /^src\/(Enrollment|main)\.tsx$/.test(p));
}
export function checkIdentityReview(paths) {
  if (!identityReviewRequired(paths)) return;
  if (!paths.includes('src/architecture/catalog.json') || !paths.some(p => /^docs\/(architecture-explorer|identity-maintenance)\.md$/.test(p))) {
    throw new Error('Identity-related change requires the current C4 catalog and identity documentation in the same PR. Record observed/staged/source-only state and evidence, not inferred deployment.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, head] = process.argv.slice(2);
  if (![base, head].every(s => /^[a-f0-9]{40}$/.test(s || ''))) throw new Error('Expected exact base and head commit IDs');
  const paths = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' }).trim().split('\n');
  checkIdentityReview(paths);
  console.log('Identity documentation change guard passed. Human review still checks accuracy and cross-repository deployment evidence.');
}
