# Deployment ownership and gates — inactive

This repository owns the application source, tests and Dockerfile only. The
[tenant repository](https://github.com/perkforge/perkforge-tenant-portal) owns the
Helm/Fleet application definitions and tenant configuration. Platform owns namespace,
project/quota, RBAC, service identity grants, NetworkPolicy, admission, internal TLS
ingress and restricted Fleet registration. Household apps cannot modify these controls.

The Dockerfile requires `NODE_IMAGE` with a reviewed Node24 Debian slim image digest.
Example build shape: `docker build --build-arg NODE_IMAGE=node:24-bookworm-slim@sha256:<reviewed-digest> .`.
The placeholder must be replaced; no image has been built or published by this change.
Review/scan the resulting image and pin its digest in the tenant repository after
resource approval. Docker builds are intentionally not run on the constrained lab.
The runtime is UID/GID1000 and the build context allowlist excludes secrets and evidence.

The process binds loopback by default. `LISTEN_HOST=0.0.0.0` is an explicit container
setting for pod networking behind separately approved internal HTTPS ingress and
NetworkPolicy. It does not change cookie security or trust forwarded headers. Never
run that setting on the workstation to expose the app. Tenant deployment is disabled.

Before activation separately approve fresh capacity, namespace/project/quota and
admission controls, immutable image/repository pins, non-root read-only container,
internal TLS host and routing, OIDC client with exact callback/audience/group/role
mapping and secure secret delivery. One replica is required by process-local sessions.
Do not enable paused Keycloak or grant GitLab/Keycloak administrative privileges.
