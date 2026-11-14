# Evidence handling

**No MyDms runtime evidence has been approved.**

This directory may contain **metadata-only** evidence of CI and safe synthetic tests. Do not commit raw SQL backups, keys, customer data, physical device journals, personal records, provider invoices or privileged logs.

Distinguish: `PLAN_ONLY`, `BUILD_VERIFIED`, `INFRA_SQL_READY_ONLY`, `EXECUTED_UNREVIEWED`, `PRODUCT_VERIFIED`, `TENANT_GO_LIVE_ACCEPTED`.

For every real-system test, capture source/build SHA, testRunId, mode, environment, fake/synthetic tenant scope, schema version, fixture hash, actual/expected source-line and ledger diffs, artifact URI and SHA256, reviewer identity and timestamp. Without actual tests, all EV-01..15 remain pending. GitHub Actions CI is not a substitute for independent role-scoped review.

Secure external evidence store (access control, encryption, retention, audit and consent) remains unconfigured and is a B04 gate before sensitive tests.
