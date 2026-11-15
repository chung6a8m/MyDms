# B04 Gate A — Closeout & restricted evidence intake

**Update 15/11/2026:** Owner đã chọn AWS S3 tại [Q-GA01](../decisions/2026-11-15-q-ga01-aws-evidence-store-provider.vi.md), nhưng account/region/budget/retention/actual reviewer/provisioning vẫn chờ. Xem [AWS Owner intake](b04-aws-deployment-intake.vi.md). **Gate A vẫn `NOT_READY`; B05/B06 blocked.**

**Historical state 14/11/2026: `NOT_READY`.** Owner selected [Q08 option B — distinct Gate A safety vs Gate B TADR reviews](../decisions/2026-11-14-q08-gate-a-gate-b-scoped-review.vi.md). The selection is a policy decision, **not a signed Gate A authorization**. Upstream Product C′ `eb9c4b04e334530367b80ea4178edb4dd4a07491` and Acceptance R `e47c3feb44c02a0fdf46c35f6c4b2f57c4365470` are immutable.

## What is implemented

- Public, synthetic-only B04 contract and [validation](../../tools/evidence/check-public-synthetic.mjs) remain separate from real R010 S3 evidence.
- [Gate A pending template](../../fixtures/evidence/b04-gate-a-pending.example.json), [read-only structural assessor](../../tools/evidence/assess-b04-gate-a.mjs), and negative tests. Public CI explicitly **cannot** grant Gate A.
- Disposable SQL **infrastructure smoke** is constrained to a GitHub-hosted ephemeral runner and a Docker `--internal` bridge network; the image is pinned to the digest observed in [CI #43560500604](https://github.com/chung6a8m/MyDms/actions/runs/43560500604). The new smoke checks there are no published host ports, performs a bounded negative TCP probe toward reserved TEST-NET-2 (not a provider), and verifies container/network removal *before* writing safe metadata. These checks do **not** prove all egress policies, least-privilege SQL runtime/migrator identities, B05/B06 fault safety, or actual Gate A acceptance.
- Restricted assessment must stay in ignored `private-evidence/`, never in public PRs, logs, artifacts or ChatGPT messages. The assessor prints only status and missing control IDs, not confidential values.

## External evidence checklist and acceptance criteria

| Control ID | Required actual proof | Responsible review |
|---|---|---|
| STORE_ENCRYPTION_AND_VERSIONING | Chosen private external storage; at-rest encryption, version/immutability, owner and resource isolation verified | Ops, Security |
| STORE_ACCESS_DENY_AND_AUDIT | Least-privilege write/read checks, explicit unauthorized-denied tests, access/audit event correlation | Security, Ops |
| STORE_RETENTION_AND_RESTORE | Approved retention/purge policy, backup/restore or version recovery tested, deletion/hold behavior | Ops, Security |
| DATA_BOUNDARY_AND_REDACTION | Synthetic fixture hashes, secret/PII/public CI redaction scanning, restricted URI + digest according to R010 S3 | QA, Security |
| SQL_SANDBOX_ISOLATION | Nonproduction database, independent runtime/migrator identities, network/egress and cleanup evidence on exact source SHA | Technical, Ops, Security |
| FAULT_ALLOWLIST_AND_STOP_CRITERIA | F-01/F-10/F-15 bounded synthetic fault scope, explicit runner allowlist, no production/provider endpoint, stop criteria | QA, Ops, Security |
| SANDBOX_CLEANUP_EVIDENCE | Actual isolated-run cleanup record, no surviving DB/container/credentials, remediation for failure | Ops, QA |

Store actual project/container/bucket names, credentials and raw artifact URIs **only in protected channels**. The public issue and this repository may link sanitized IDs that do not disclose restricted resource identifiers, but cannot substitute for verifying them.

## Restricted assessor workflow (manual, separate protected workspace)

1. Copy `fixtures/evidence/b04-gate-a-pending.example.json` **outside the public repo**, into a `private-evidence/` directory protected from Git and public CI.
2. Populate in the protected copy: `schemaVersion=b04-gate-a-readiness-v2`, `recordKind=RESTRICTED_DOSSIER_STRUCTURAL_ONLY_NOT_AUTHORIZATION`, `classification=RESTRICTED_INTERNAL_NOT_FOR_PUBLIC_GIT`, and the exact tested source commit in `sourceSha`. This updates the **unmerged v1 draft contract in PR #8**; do not silently reuse v1 dossiers.
3. Set each actually proven control to `EVIDENCED` with a protected `evidenceRef`; keep all others pending. Conduct an actual **Finance-safety scope risk assessment**: set `financeSafety.requirement` to `REQUIRED_FOR_GATE_A` or `NOT_REQUIRED_FOR_GATE_A_WITH_EVIDENCE` only with real assessor, timestamp and scoped proof. Record separate actual `APPROVED` role entries for **Technical, QA, Operations, Security**; add a Finance role entry at Gate A **only when the assessment requires it**. Finance remains a mandatory reviewer for the later TADR-01 ledger decision at Gate B, independently of this assessment.
4. If the same person signs multiple Gate A roles, provide a protected `roleOverlap.disclosureRef` for role authority/delegation; never represent multiple records as independent human reviewers. Only **after** all actual evidence and scoped safety reviews may an authorized Owner issue an externally verifiable, versioned decision limited to `AUTHORIZED_B05_B06_NONPRODUCTION_ONLY`. No S6-A runtime, TADR-approval or mode permission is implied.
5. Run locally in the restricted environment:

```bash
node tools/evidence/assess-b04-gate-a.mjs --restricted private-evidence/gate-a-assessment.json
```

The output `STRUCTURALLY_COMPLETE_REQUIRES_LIVE_ATTESTATION` means the *fields* are present, **not that they are authentic**. Independently inspect actual storage/provider configuration, denied-access logs, runner isolation, redaction results, reviewers' identity/delegation and actual approval ref/time. A JSON record cannot self-certify its own provenance. Only then update Issue #4 with non-sensitive proof links and ask the Owner for the Gate A decision; keep the issue open until done.

## Public CI validation

```bash
node --test tests/evidence/public-synthetic.test.mjs tests/evidence/gate-a-readiness.test.mjs tests/ci/sql-infra-preflight.test.mjs tests/ci/sql-infra-evidence.test.mjs
node tools/evidence/check-public-synthetic.mjs fixtures/evidence/foundation-public-synthetic.example.json
node tools/evidence/assess-b04-gate-a.mjs --public fixtures/evidence/b04-gate-a-pending.example.json
```

**Expected:** CI passes a safe, pending template, prints `Gate A NOT_READY`, rejects fake `READY`, unreviewed Finance scope, missing safety signoffs, forged approvals, unapproved shared-principal assertions and P0 waiver. SQL smoke must not publish its success metadata until bounded egress observation **and** cleanup verification have completed. The new digest/cleanup results remain SQL-infrastructure evidence only. CI must not use `--restricted` or publish a real dossier.

## Release boundary and remaining owner work

**Blocker:** [B04 Issue #4](https://github.com/chung6a8m/MyDms/issues/4). [B05/TADR-01 #5](https://github.com/chung6a8m/MyDms/issues/5) and [B06/TADR-02 #6](https://github.com/chung6a8m/MyDms/issues/6) stay `PLANNED_BLOCKED_GATE_A`. `Gate B=BLOCKED`; TADR-01..06 still `DESIGN_CANDIDATE`; EV-01..15 real pending; G-STOCK/G-CUT/G-IDEMP/G-LEDGER/G-INV are non-waivable; B_NO_CHANNEL blocked, OFFLINE_WRITE and PRODUCTION_CUTOVER disabled. Once Gate A is authentically authorized, it only admits bounded **nonproduction** B05/B06 spikes; Gate B needs technical/QA/Finance TADR review and separate Owner authorization.

## Provisioning/verification candidate after PR #8

A provider **reference candidate** for an AWS S3 restricted store is available at [`infra/b04/aws-s3/`](../../infra/b04/aws-s3/README.vi.md) with CloudFormation JSON (private/locked/versioned buckets + KMS and CloudTrail S3 data events) and a [read-only protected preflight](../../tools/evidence/b04-aws-s3-preflight.mjs). It is intentionally **not deployed**: Owner has not selected AWS/account/region/retention/cost or provided access. Public CI tests only synthetic snapshots and CloudFormation JSON security invariants; it **never runs AWS CLI or uploads restricted evidence**.

Configuration preflight additionally requires actual approved account/region, evidence+audit buckets, trail destination, SSE-KMS key and both retention policies; a complete 24/24 configuration observation is **not** an approved IAM-role access-denied test, a proven restore/audit event, or real QA/Ops/Security/Owner signoff. Gate A remains `NOT_READY`, Gate B `BLOCKED`, B05/B06 not started.

**SEC-01..04 reference review:** the AWS candidate now covers CloudTrail service-principal TLS exception, explicit invalid encryption overrides, expected account/region/audit bucket and strict TLS Deny conditions with negative regressions. These tests are synthetic: no real AWS permissions, CloudTrail delivery or restricted proof has been established. Refer to [protected AWS operator runbook](../../infra/b04/aws-s3/README.vi.md).
