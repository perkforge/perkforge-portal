# Current delivery pipelines and image builds

Source/run inventory checked 2026-11-14 across eight nonarchived PerkForge repositories. This is a reviewed snapshot, not automatic discovery of external CI. No workflow was dispatched, enabled or modified for this inventory.

## Current workflow inventory

| Repository / workflow | State | Trigger | Output / boundary |
|---|---|---|---|
| [perkforge-platform / configuration-release.yml](https://github.com/perkforge/perkforge-platform/blob/dfc0fb585910ea370b0e3854058f9fc866ef7866/.github/workflows/configuration-release.yml) | Mixed: source release enabled; validation paused | Main/PR/manual | Versioned Git source release and resolved commit; no image build |
| [perkforge-platform / gitops-selection.yml](https://github.com/perkforge/perkforge-platform/blob/dfc0fb585910ea370b0e3854058f9fc866ef7866/.github/workflows/gitops-selection.yml) | Paused at job level | Reusable call/manual | Offline source/native validation definitions; all current jobs if:false |
| [perkforge-portal / check.yml](https://github.com/perkforge/perkforge-portal/blob/0c17afcf7aa6b8c60b0c360df3e298d5275d4976/.github/workflows/check.yml) | Enabled | Push/PR | Lint, build, tests and identity-doc review |
| [perkforge-portal / image.yml](https://github.com/perkforge/perkforge-portal/blob/0c17afcf7aa6b8c60b0c360df3e298d5275d4976/.github/workflows/image.yml) | Enabled, publication release-gated | PR/main/manual | Checked image artifact → GHCR source/version tags and verified digest |
| [perkforge-platform-tenants / configuration-release.yml](https://github.com/perkforge/perkforge-platform-tenants/blob/c1d105b9ff9ad359ecd128d2ffd1ba0f126239c0/.github/workflows/configuration-release.yml) | Enabled | Main/PR/manual | Versioned enrollment source and exact tag/commit |
| [perkforge-platform-tenants / nextcloud-candidate.yml](https://github.com/perkforge/perkforge-platform-tenants/blob/c1d105b9ff9ad359ecd128d2ffd1ba0f126239c0/.github/workflows/nextcloud-candidate.yml) | Enabled | Push/PR | Native candidate/admission evidence; not a deploy |
| [perkforge-platform-tenants / offline-enrollment.yml](https://github.com/perkforge/perkforge-platform-tenants/blob/c1d105b9ff9ad359ecd128d2ffd1ba0f126239c0/.github/workflows/offline-enrollment.yml) | Enabled | Push/PR/reusable call | Rendered enrollment and source validation |
| [perkforge-platform-tenants / portal-eso-foundation.yml](https://github.com/perkforge/perkforge-platform-tenants/blob/c1d105b9ff9ad359ecd128d2ffd1ba0f126239c0/.github/workflows/portal-eso-foundation.yml) | Enabled test; inactive deployment stage | Push/PR | Foundation/ESO source checks; no live provisioning |
| [perkforge-tenant-portal / check.yml](https://github.com/perkforge/perkforge-tenant-portal/blob/35d9894e2e0d7c0e76a9feceeca02c9aebde2096/.github/workflows/check.yml) | Enabled | Push/PR/reusable call | Offline chart, provenance and configuration tests |
| [perkforge-tenant-portal / configuration-release.yml](https://github.com/perkforge/perkforge-tenant-portal/blob/35d9894e2e0d7c0e76a9feceeca02c9aebde2096/.github/workflows/configuration-release.yml) | Enabled | Main/PR/manual | Versioned chart/config source tag and commit; no image rebuild |
| [perkforge-tenant-nextcloud / offline-nextcloud.yml](https://github.com/perkforge/perkforge-tenant-nextcloud/blob/c079cdff6a859064805abfa887cee67caaf8d255/.github/workflows/offline-nextcloud.yml) | Enabled | Push/PR | Offline chart/SSO contract checks |
| [perkforge-tenant-nextcloud / sso-image-promote.yml](https://github.com/perkforge/perkforge-tenant-nextcloud/blob/c079cdff6a859064805abfa887cee67caaf8d255/.github/workflows/sso-image-promote.yml) | Manual, explicit publication gates | Manual dispatch | Promote reviewed artifact privately to GHCR without rebuild; receipt, not deploy |
| [perkforge-tenant-nextcloud / sso-image-review.yml](https://github.com/perkforge/perkforge-tenant-nextcloud/blob/c079cdff6a859064805abfa887cee67caaf8d255/.github/workflows/sso-image-review.yml) | Manual only | Manual dispatch | Pinned application + OIDC image; reviewed artifact/hashes, not publication |

GitHub reports these workflow definitions as active, but that does **not** make every job active. All platform `gitops-selection` jobs and `release-checks` are explicitly `if: false`; the platform main release job deliberately permits source releases despite skipped validation dependencies. Recent PR checks there are skipped, not passed. Other listed repositories have successful recent runs, but a successful manual/check run alone does not prove publication or deployment.

The private operator-recovery repository, `perkforge-paas-ui` and `perkforge-rmf-field-guide` have no checked-in GitHub Actions workflow in this inventory. No claim is made about unidentified external build services. The proposed GitLab/Trivy/Harbor intake remains planned: no `.gitlab-ci` definition was found in these reviewed repository trees, and the live GitLab server job inventory was not inspected.

## The two current application-image build paths

1. **Portal:** aggregate tests and dependency audit precede a digest-pinned Node-base build. The same checked image is saved as an artifact. Only a normal main release may publish that artifact to GHCR, with source and version tags checked against the registry digest. PR/manual check runs do not publish. No target environment triggers a rebuild.
2. **Nextcloud SSO:** a manual review workflow builds from pinned Nextcloud and OIDC inputs with network-disabled build/runtime verification, saves the image archive and hashes, and leaves publication separate. A second manual workflow validates the exact reviewed artifact and publication/package-visibility guards before promoting it to private GHCR without rebuilding. A declaration of the promotion workflow is not evidence that its publish gates were true for a particular run.

No other Dockerfile/Containerfile image-build definition was found in the eight current repository trees. Native Big Bang package images are selected upstream Registry One artifacts, not new PerkForge application builds. The planned intake/scanning pipeline must not be presented as running merely because GitLab or Harbor exists.

## Build once, then select and reconcile

Published image digest → application configuration release → enrollment source/runtime contract → reviewed platform source selection → Flux reconciliation → runtime image pull. Configuration/enrollment releases produce versioned Git sources, not rebuilt application images. Every promotion verifies immutable source/tag/digest relationships and preserves target-specific configuration outside the image. Helm reconciliation, workload readiness, SSO/authorization and usable application behavior remain separate acceptance stages.

The Portal C4 delivery view summarizes these paths. Original catalog revision metadata is model-source provenance, not a live deployment selector. Refresh this inventory and its source links when workflow definitions, pause state, publication gates or build sources change.
