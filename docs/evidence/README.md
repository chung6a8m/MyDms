# Evidence handling

**No MyDms runtime evidence has been approved.** [B04 bounded closeout](2026-11-14-s6-0-b04-closeout.md) records the merged public synthetic contract and the remaining restricted-store Gate A blocker. Foundation tests can record public non-sensitive synthetic counters, checked-out merge SHA and source PR SHA, but not tenant/provider/ledger data.

This directory may contain **metadata-only** evidence of CI and safe synthetic tests. Do not commit raw SQL backups, keys, customer data, physical device journals, personal records, provider invoices or privileged logs.

Distinguish: `PLAN_ONLY`, `BUILD_VERIFIED`, `INFRA_SQL_READY_ONLY`, `EXECUTED_UNREVIEWED`, `PRODUCT_VERIFIED`, `TENANT_GO_LIVE_ACCEPTED`.

For every real-system test, capture source/build SHA, testRunId, mode, environment, fake/synthetic tenant scope, schema version, fixture hash, actual/expected source-line and ledger diffs, artifact URI and SHA256, reviewer identity and timestamp. Without actual tests, all EV-01..15 remain pending. GitHub Actions CI is not a substitute for independent role-scoped review.

For non-sensitive open-source bootstrap only, see [B04 public synthetic metadata contract](../../contracts/evidence/foundation-public-synthetic.schema.json), [example](../../fixtures/evidence/foundation-public-synthetic.example.json) and [validator](../../tools/evidence/check-public-synthetic.mjs). These are not substitutes for R010 S3 evidence-run.

Owner chọn **AWS S3** tại [Q-GA01](../decisions/2026-11-15-q-ga01-aws-evidence-store-provider.vi.md) (15/11/2026); chọn provider **không** tương đương provisioning hoặc kiểm chứng. Secure external evidence store (access control, encryption, retention, audit and consent) remains **unconfigured**. See [B04 safety plan](../runbooks/b04-sandbox-and-evidence-safety.md); actual reviewer approval is pending and remains a Gate A condition.

Gate A protected evidence intake and structural checks: [B04 Gate A closeout runbook](../runbooks/b04-gate-a-closeout.md), [pending template](../../fixtures/evidence/b04-gate-a-pending.example.json) and [assessor](../../tools/evidence/assess-b04-gate-a.mjs). The public CI always reports `NOT_READY` and never reads restricted data.

For PR #8 finding F2/F3 closeout, the pinned container-image digest, source/checkout SHA, reserved TEST-NET-2 denied TCP observation, published-port count and verified container/network cleanup are recorded in **public synthetic infrastructure-only evidence** after cleanup. They are not restricted store, least-privilege SQL business test, Gate A safety authorization or EV PASS. See [Gate A runbook](../runbooks/b04-gate-a-closeout.md).

Provider-specific AWS reference (**selected in Owner Q-GA01, not deployed/verified**): [S3/CloudTrail candidate and protected operator playbook](../../infra/b04/aws-s3/README.vi.md) and [read-only preflight](../../tools/evidence/b04-aws-s3-preflight.mjs). Public CI only tests synthetic shapes. No AWS account, credentials, bucket, CloudTrail log delivery, restricted artifact or reviewer is verified from these files.

AWS candidate SEC-01..04 security regression is **SOURCE/SYNTHETIC TEST ONLY**. A passing provider configuration check still lacks real IAM/KMS access decisions, CloudTrail actual delivery, object version restore, retention/legal review and human approvals. See [AWS preflight scope](../../infra/b04/aws-s3/README.vi.md).
