# Generic backup and recovery flow

This is a sanitized operational model, not a cluster-specific recovery script or permission to execute one. It intentionally contains no host/disk identities, private paths, capture IDs, secret inventory or key material. The concrete owner runbook remains in private custody. Restore and cutover are different decisions.

## Capture and preserve a complete generation

- Capture application files, a matching database snapshot/dump and the required protected application configuration consistently. A completion receipt binds one generation; do not mix generations or use a partial run.
- Keep compatible runtime/tool versions and independent recovery/unlock access available. A running timer, backup directory or Git repository does not prove a usable data backup.
- Verify an independent copy's lengths and hashes against its receipt. Copy integrity is not an application restore test; a second local disk is not automatically off-site or a different failure domain.
- Preserve the source read-only or as a verified equivalent copy before replacement. Interrupted, missing or unexpected artifacts are stop conditions. Never overwrite the only surviving copy.

## Restore and validate in isolation

1. Select a complete paired generation and compatible application/database tooling. Inspect the image/layout without modifying it; avoid journal replay. Stop for an unexpected format rather than guessing repair commands.
2. Restore files into a new volume or writable disposable working copy and the database into a new isolated instance. Never aim restore tools at production by default.
3. Recreate only reviewed isolated configuration and references. Do not blindly replay production manifests. Keep scheduled jobs, mail, hooks, public ingress and real identity-provider callbacks disabled or isolated so a drill cannot act on live services.
4. Boot the compatible recovered application. Verify readiness, paired database/file consistency, representative important files, sizes and available hashes. Record counts, exclusions, algorithms, errors and duration privately, without revealing contents or credentials.
5. Verify intended and denied access separately. A database boot is not browser SSO, tenant-isolation or whole-cluster recovery proof.

## Review cutover separately

Review recovery point and possible newer-data loss, downtime, desired-state ownership, database/volume references, identity and validation before production replacement. Preserve surviving data and the recovery source. Use reviewed source changes, then verify the application, other workloads, access, observability and future backups. Remove only identified disposable resources after proving another valid copy remains. Fix forward and retain failure evidence.

## Credential and whole-cluster dependencies

An encrypted vault export and downloaded-copy verification are not a replacement-vault import or account-recovery procedure. Keep its decryption password, account recovery and service bootstrap materials independently accessible; do not rely on the failed service to recover itself. Stop when required material is missing. Excluded data and unverified import/service coverage remain explicit gaps.

Generic whole-cluster order: independent source/artifact/credential/PKI access → reviewed host/network/DNS/time → compatible control-plane recovery inputs → storage/operator readiness → identity and secrets services → databases/applications → intended/denied access, observability and backups. Each service needs compatible independent state. Git desired state and one application's paired backup are not control-plane, identity-provider or secret-service backups. Use the actual supported backend procedure; never substitute a familiar snapshot command for a different storage backend.

## Evidence boundaries

A bounded restore from the primary application recovery set passed app/database startup and active-file size/hash checks. The secondary copy completed with destination hash verification; application restore from that copied set remains untested. Whole-cluster recovery, complete service recovery, replacement-vault import and full node-loss/rebuild/HA tests remain unverified. No general RPO/RTO is established by this model. A past success is not today's scheduled-run success.

The C4 view keeps these proven and unproven stages distinct. Cluster-specific topology and executable owner recovery procedures are a later modeling layer, not invented in this generic flow.
