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
only a push to `main` that creates a release publishes to
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

**Keep the GHCR package private.** The earlier public-testing choice was withdrawn.
GitHub Actions still publishes with its repository GITHUB_TOKEN. For Kubernetes pulls,
the platform provisions a separate read-only registry credential as a namespaced
imagePullSecret, and the tenant chart references its name. No credential belongs in
Git, image layers, workflow logs or chat. Credential creation and authenticated pull
verification require separate approval; this documentation does not provision them.
The workflow does not change package visibility or repository settings.
Merge this workflow, then review and merge its generated release PR for the first publication. Review the resulting
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

Merge ordinary PRs to build/test and update the pending release PR; they publish no image.
Review and manually merge that release PR to create a GitHub release/tag and publish
`vMAJOR.MINOR.PATCH` pointing to the same registry digest as its source-SHA image.
The release PR merge produces a push to main. Only when release-please reports
`release_created` does that same workflow publish both source-SHA and version tags.
PRs, feature branches, manual dispatches and tag pushes never publish. Manual runs
remain available for checks only. GITHUB_TOKEN-created tags need no separate trigger.
If publication fails, use **Re-run failed jobs** on the original main-push run while
its image artifact is retained (one day), preserving the successful release job's
outputs. Re-running all jobs can yield `release_created=false` and skip publication;
a manual dispatch cannot recover publication. Do not create another version or bypass
the trigger restriction automatically. An expired artifact requires a reviewed recovery
plan. A retry reuses the existing SHA image, verifies its source label and rejects a
conflicting version digest.
No floating major/minor/latest tags or automatic merges are created.

The read-only check job builds/tests the image. Only the publish job has packages write.
The separate release job needs contents, pull-requests and issues write for release PRs,
tags/releases and labels, as documented by release-please. These rights are reviewable
in this PR; no repository settings are changed automatically. GitHub may require the
owner to enable Actions creating PRs; this repository's setting is now enabled with
read-only default token permissions. For a bot-created release PR, GitHub creates
approval-required `pull_request` runs. In the PR merge box, select **Approve workflows
to run**, then wait for those existing runs before merging. Do not start a duplicate
manual workflow merely because checks have not started. Dispatch remains a checks-only
fallback when specifically needed; it is not the normal release review flow.

This was verified for release PR #3: automatic runs
[40586116015](https://github.com/perkforge/perkforge-portal/actions/runs/40586116015)
and [40586115946](https://github.com/perkforge/perkforge-portal/actions/runs/40586115946)
were created, then expired without approval. A separate manual validation passed before
merge. The earlier claim that GITHUB_TOKEN categorically suppresses PR checks was
incorrect. See [GitHub's current trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
No extra token, GitHub App, reopen, or diagnostic commit is necessary.

Offline release tests use release-please 17.3.0, the version bundled by the pinned
action, with a fake GitHub file reader. Nine cases verify actual release-PR eligibility
and bump behavior, including both breaking forms, squash subjects and no-release
changes. No release API is called by these tests. Workflow publication/retry behavior
still requires the first approved main run; actionlint is syntax checking, not that
integration test. The owner has enabled Actions-created PRs; workflow-run approval is a separate step.

For this initial rollout: enable **Settings → Actions → General → Workflow permissions
→ Allow GitHub Actions to create and approve pull requests**, then merge the workflow
PR. The `feat` change should propose a **0.2.0** release PR from the 0.1.0 baseline
(unless other eligible commits are merged first). Approve the existing release PR workflow runs, review its changelog/version updates,
and merge it once they pass. That second main push publishes
`v0.2.0` and its full-SHA tag. No image is published by the first merge alone.
The workflow never approves or merges PRs despite the combined GitHub setting label.

See [Platform Explorer](architecture-explorer.md) for visual architecture, boundary views and model review.
