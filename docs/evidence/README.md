# Evidence handling

**No MyDms runtime evidence has been approved.** Foundation tests can record public non-sensitive synthetic counters, checked-out merge SHA and source PR SHA, but not tenant/provider/ledger data.

This directory may contain **metadata-only** evidence of CI and safe synthetic tests. Do not commit raw SQL backups, keys, customer data, physical device journals, personal records, provider invoices or privileged logs.

Distinguish: `PLAN_ONLY`, `BUILD_VERIFIED`, `INFRA_SQL_READY_ONLY`, `EXECUTED_UNREVIEWED`, `PRODUCT_VERIFIED`, `TENANT_GO_LIVE_ACCEPTED`.

For every real-system test, capture source/build SHA, testRunId, mode, environment, fake/synthetic tenant scope, schema version, fixture hash, actual/expected source-line and ledger diffs, artifact URI and SHA256, reviewer identity and timestamp. Without actual tests, all EV-01..15 remain pending. GitHub Actions CI is not a substitute for independent role-scoped review.

For non-sensitive open-source bootstrap only, see [B04 public synthetic metadata contract](../../contracts/evidence/foundation-public-synthetic.schema.json), [example](../../fixtures/evidence/foundation-public-synthetic.example.json) and [validator](../../tools/evidence/check-public-synthetic.mjs). These are not substitutes for R010 S3 evidence-run.

Secure external evidence store (access control, encryption, retention, audit and consent) remains **unconfigured**. See [B04 safety plan](../runbooks/b04-sandbox-and-evidence-safety.md); actual reviewer approval is pending and remains a Gate A condition.
