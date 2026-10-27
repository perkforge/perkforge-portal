// Offline verification against the library bundled by the pinned release-please action.
// Usage: node scripts/release-version-check.mjs /absolute/test-install/package.json
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const load = createRequire(process.argv[2]);
load('release-please');
const { Node } = load('release-please/build/src/strategies/node');
const { DefaultVersioningStrategy } = load('release-please/build/src/versioning-strategies/default');
const { parseConventionalCommits } = load('release-please/build/src/commit');
const { Version } = load('release-please/build/src/version');
const { TagName } = load('release-please/build/src/util/tag-name');
const config = JSON.parse(readFileSync('release-please-config.json')).packages['.'];
const strategy = new Node({
  github: {
    repository: { owner: 'perkforge', repo: 'perkforge-portal' },
    getFileContentsOnBranch: async () => ({ parsedContent: readFileSync('package.json', 'utf8') }),
  },
  targetBranch: 'main', includeComponentInTag: false,
  versioningStrategy: new DefaultVersioningStrategy({
    bumpMinorPreMajor: config['bump-minor-pre-major'],
    bumpPatchForMinorPreMajor: config['bump-patch-for-minor-pre-major'],
  }),
});
for (const [message, expected] of [
  ['fix: callback', '0.1.1'], ['feat: tenant filter', '0.2.0'],
  ['feat!: API change', '1.0.0'],
  ['fix: API change\n\nBREAKING CHANGE: incompatible API', '1.0.0'],
  ['feat: tenant filter (#23)', '0.2.0'], ['perf: faster requests', '0.1.1'],
  ['docs: setup', null], ['chore: tooling', null], ['test: fixture', null],
]) {
  const pr = await strategy.buildReleasePullRequest(
    parseConventionalCommits([{ sha: 'a'.repeat(40), message }]),
    { tag: new TagName(Version.parse('0.1.0')), sha: 'b'.repeat(40) },
  );
  assert.equal(pr?.version.toString() ?? null, expected, message);
}
console.log('Nine release version/eligibility cases passed; no GitHub requests made.');
