# Deployment gates — inactive

No Docker build, workload manifests, deployment workflow, ingress, secrets, or
live OIDC setup are shipped. The platform proposal is outside all active Fleet
paths. Initial process storage requires one replica; restart logs users out.

Before deployment separately approve: fresh host/VM capacity, an immutable image
and commit pin, namespace/project/quota integration, non-root read-only container,
loopback proxy topology and HTTPS hostname/certificate, OIDC client with exact
callback URI and narrow audience/group/role mapping, secret delivery, scoped Fleet
service account and network policy enforcement tests. The Node loopback listener
requires a same-pod reverse proxy or an explicitly reviewed listener change;
a Kubernetes Service alone cannot reach it. Do not enable paused Keycloak as part
of installing this code. Do not grant GitLab or Keycloak administrative access.
