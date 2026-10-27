# Household portal

Minimal React/TypeScript UI and Node 24 BFF for sign-in and a protected tenant directory.
GitLab is **disabled**. No live tenant data, credentials, client registrations or privileged operations are included.

## Local development

Use Node 24 LTS and npm. `npm ci`, `npm run check`, then `npm start`.
By default the server binds `127.0.0.1:3000` and serves the Vite build. The disconnected UI
can be inspected at http://127.0.0.1:3000; authentication requires an independently
approved HTTPS reverse proxy at `PORTAL_ORIGIN` because cookies are always Secure.
Copy `.env.example` to ignored `.env` only when identity configuration is approved.
No development option disables cookie security or token verification.
The tenant repo owns Kubernetes/Fleet definitions; this app repo provides its Dockerfile.
`TENANT_SOURCE=mock` produces one explicitly labeled fixture after authentication.
`TENANT_SOURCE=disabled` (default) returns an empty directory with disconnected metadata.
Any other mode fails startup. No GitLab network client exists.

Commands: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`,
`npm audit --omit=dev --audit-level=high`. Tests use ephemeral localhost OIDC fixtures;
no Keycloak instance, container, cluster, or GitLab is needed.

See [security](security.md), [design](design.md), and [deployment gates](deployment.md).

## Container publication

The `portal-image` workflow builds and checks linux/amd64 images on pull requests;
only merged `main` (or a manual run on main) publishes to
`ghcr.io/perkforge/perkforge-portal`. It uses the repository's short-lived
`GITHUB_TOKEN` with contents read and packages write; no PAT or stored registry
credential is required. Actions and the official Node base are pinned by digest/SHA.
The allowlisted Docker context excludes environment files, credentials, tests and
local evidence. The same built image passes a network-isolated runtime check before
publication. No build secret is supplied. npm audit covers production JS dependencies;
this is not an OS vulnerability scan or live authentication test.

Tags are `sha-<full source commit>`; the workflow reuses an existing source tag on retry and rejects a conflicting version tag.
Tags are not registry-enforced immutable: deployment must use the registry digest in
the successful run summary. An Actions rebuild need not match the earlier local
Podman image digest. No `latest` tag or automatic deployment is configured.

**Public images are approved for testing only.** Revisit visibility before production
or household use. GHCR initially creates packages private even for a public repository;
a package administrator must set this package public after its first publication,
then verify anonymous pulls. Do not create cluster pull credentials for this testing
choice. The workflow does not change package visibility or repository settings.
Merging this workflow is required for the first main publication. Review the resulting
registry digest before proposing tenant/platform pins; publication does not activate
portal, provision Keycloak, or change cluster permissions.


### Conventional Commit releases

[release-please](https://github.com/googleapis/release-please-action) maintains a release
PR updating package.json, package-lock.json, the release manifest and changelog.
It does not commit to main or merge its PR. The starting baseline is the existing
0.1.0 package version at commit 5efe468; it does not invent a historical v0.1.0 release.
Only subsequent changes contribute to the next release.

| Commit since baseline | Next version from 0.1.0 |
| --- | --- |
| `fix: correct callback` | 0.1.1 |
| `feat: add tenant filter` | 0.2.0 |
| `feat!: change API` or a `BREAKING CHANGE:` footer | 1.0.0 |
| `docs: explain setup`, `chore: refresh tooling`, tests only | No release |

Both pre-1.0 downgrade options are explicitly false. Highest eligible bump wins;
release-please also treats `perf` as a patch. Use Conventional Commit squash-merge
subjects and preserve breaking-change footers in the final squash message. A PR title
alone does not change versioning if the merged commit has a different subject.

Merge ordinary PRs to publish source-SHA images and update the pending release PR.
Review and manually merge that release PR to create a GitHub release/tag and publish
`vMAJOR.MINOR.PATCH` pointing to the same registry digest as its source-SHA image.
The workflow uses the same run because GITHUB_TOKEN-created tags do not trigger another
workflow. Retrying main publication reuses an existing source image, verifies its source
label, and fills in a missing version tag; conflicting version digests fail closed.
No floating major/minor/latest tags or automatic merges are created.

The read-only check job builds/tests the image. Only the publish job has packages write.
The separate release job needs contents, pull-requests and issues write for release PRs,
tags/releases and labels, as documented by release-please. These rights are reviewable
in this PR; no repository settings are changed automatically. GitHub may require the
owner to enable Actions creating PRs. GITHUB_TOKEN-created release PRs do not trigger
normal PR CI: run `portal-image` manually on the release branch for read-only checks
before merging (publishing and release jobs are main-only). No PAT is required.

Offline release tests use release-please 17.3.0, the version bundled by the pinned
action, with a fake GitHub file reader. Nine cases verify actual release-PR eligibility
and bump behavior, including both breaking forms, squash subjects and no-release
changes. No release API is called by these tests. Workflow publication/retry behavior
still requires the first approved main run; actionlint is syntax checking, not that
integration test. The repository currently has Actions-created PRs disabled; its
owner must enable that setting before release-please can open a release PR.
