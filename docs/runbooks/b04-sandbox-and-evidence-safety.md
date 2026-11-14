# B04 — Public OSS sandbox & evidence safety (candidate / NOT approved)

**Status:** `B04_CONTRACT_PREPARED / SECURE_EVIDENCE_STORE_NOT_CONFIGURED / ROLE_REVIEW_PENDING`.

## Contract boundaries

Normative real-product observations come from R010 S3 [evidence-run.schema.json](https://github.com/chung6a8m/research-sme-phan-phoi-hang-tieu-dung/blob/eb9c4b04e334530367b80ea4178edb4dd4a07491/reports/2026-11-13-10-product-reference-go-live-blueprint/s3/evidence-run.schema.json) and the current S3 AC/EV register. MyDms `contracts/evidence/foundation-public-synthetic.schema.json` is a **narrow synthetic public CI metadata format only**, not a replacement for S3 evidence or product/mode approval.

- `EXAMPLE/NOT_RUN` is template data; must not present testRunId, real hash, reviewer or artifact.
- `SYNTHETIC_CI/EXECUTED_UNREVIEWED` may carry tested source/checkout commit, fixture hash, run ID and SHA-256 hashes of **public synthetic metadata**. It **never grants PRODUCT_VERIFIED, TENANT_GO_LIVE, Gate A or Gate B**.
- No PII, actual tenant identifiers, real customer/outlet/ship-to details, secrets, bank/accounting evidence, provider invoice, real device journals or restricted raw artifacts in public repository, PR comments, workflow logs or public GitHub Actions artifacts.
- R010 `artifacts.uri + sha256 + classification` for real evidence must point to a secured, access-controlled store, not an ordinary public artifact URL.

## S6-0 isolated test safety requirements (not yet attested)

| Area | Candidate control | Evidence needed |
|---|---|---|
| Scope | Disposable **nonproduction** SQL Server on runner, loopback binding, no production credentials or outbound provider calls | CI job source SHA, run ID, container digest, steps and cleanup logs |
| Data | Synthetic fixtures with known source IDs/hashes only; deterministic reset | Fixture generation/checksum, negative tests for cross-tenant isolation |
| Access | GitHub token `contents: read`, separated SQL runtime vs privileged migrator/test identities | Permission review and actual sandbox configuration |
| Fault injection | Allowlist of destructive actions within disposable container; deny all unapproved network targets | Security/QA/Ops approval with exact command/mode/build, rollback/cleanup proof |
| Evidence store | **External, private, encrypted**, least privilege, audit, immutable/versioned storage, retention and purge policy | Selected provider/project/container, owner, access tests, backup/restore and audit event |
| Public artifacts | CI-only test counters and safe metadata; no real business traces | Data classification checks and sample uploaded artifacts reviewed |
| Sign-off | Technical/QA/Ops/Security and Finance for ledger context where necessary | Real reviewer identity, decision ID, timestamp and approval reference |

Current state: SQL infra smoke exists and passed on foundation CI; **no approved external evidence store, real reviewer identities or fault-injection authorization** have been established. RPO/RTO, evidence retention time and sandbox budgets are **UNSET** until appropriate review.

## Q08 gate interpretation

- **Gate A:** Only after safety/fixture/source boundaries and relevant B04 review evidence are complete may B05/B06 run bounded synthetic technical spikes. This document is a proposal, **not Owner/QA/Ops sign-off**.
- **Gate B:** Actual Technical/QA/Finance TADR-01/02 approval + reproducible API/SQL negative tests + explicit Owner authorization. PR merge and CI synthetic green never grant it.
- B_NO_CHANNEL BLOCKED, OFFLINE_WRITE/PRODUCTION_CUTOVER DISABLED_PENDING, five P0 nonwaivable.

## Actionable handoff

1. Decide and provision a suitable external private artifact store (e.g. Azure Blob private storage, S3 private bucket, or equivalent). Configure encryption, audit and access policy; don't store access keys in Git.
2. Document verified disposable SQL/test runner identity, fixture generator and allowed fault scope. Review any network egress.
3. Assign actual QA/Ops/Security owners, review B04 safety/runbook and record dated approval evidence. No substitute fake reviewers.
4. Then authorize B05/B06 source spike PRs. Synthetic CI alone may continue in the meantime without claiming Gate A.
