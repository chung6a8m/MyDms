# B04 Gate A — Closeout & restricted evidence intake

**State on 14/11/2026: `NOT_READY`.** This is an execution package, **not a signed Gate A decision**. Upstream Product C′ `eb9c4b04e334530367b80ea4178edb4dd4a07491` and Acceptance R `e47c3feb44c02a0fdf46c35f6c4b2f57c4365470` are immutable.

## What is implemented

- Public, synthetic-only B04 contract and [validation](../../tools/evidence/check-public-synthetic.mjs) remain separate from real R010 S3 evidence.
- [Gate A pending template](../../fixtures/evidence/b04-gate-a-pending.example.json), [read-only structural assessor](../../tools/evidence/assess-b04-gate-a.mjs), and negative tests. Public CI explicitly **cannot** grant Gate A.
- Disposable SQL **infrastructure smoke** is constrained to a GitHub-hosted ephemeral runner and Docker `--network none` (container-internal localhost only; no host published port). The smoke does **not** run SQL business tests or approve the proposed B05/B06 sandbox.
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
2. Populate in the protected copy: `recordKind=RESTRICTED_DOSSIER_STRUCTURAL_ONLY_NOT_AUTHORIZATION`, `classification=RESTRICTED_INTERNAL_NOT_FOR_PUBLIC_GIT`, and the exact tested source commit in `sourceSha`.
3. Set each actual completed control to `EVIDENCED` and its `evidenceRef` to a protected proof reference. Pending controls retain `PENDING` + null. Record real role reviewer principal, approval reference and timestamp for each APPROVED Technical, QA, Operations, Security and Finance record, with no fictitious independent signatures.
4. Only **after** all evidence and reviews, an authorized Owner may issue an external versioned decision limited to `AUTHORIZED_B05_B06_NONPRODUCTION_ONLY`. No S6-A business runtime permission is implied.
5. Run locally in the restricted environment:

```bash
node tools/evidence/assess-b04-gate-a.mjs --restricted private-evidence/gate-a-assessment.json
```

The output `STRUCTURALLY_COMPLETE_REQUIRES_LIVE_ATTESTATION` means the *fields* are present, **not that they are authentic**. Independently inspect actual storage/provider configuration, denied-access logs, runner isolation, redaction results, reviewers' identity/delegation and actual approval ref/time. A JSON record cannot self-certify its own provenance. Only then update Issue #4 with non-sensitive proof links and ask the Owner for the Gate A decision; keep the issue open until done.

## Public CI validation

```bash
node --test tests/evidence/public-synthetic.test.mjs tests/evidence/gate-a-readiness.test.mjs
node tools/evidence/check-public-synthetic.mjs fixtures/evidence/foundation-public-synthetic.example.json
node tools/evidence/assess-b04-gate-a.mjs --public fixtures/evidence/b04-gate-a-pending.example.json
```

**Expected:** CI passes a safe, pending template, prints `Gate A NOT_READY`, and rejects fake `READY`, forged approval, P0 waiver, duplicate reviewer principal or unclassified raw fields. CI must not use `--restricted` or publish a real dossier.

## Release boundary and remaining owner work

**Blocker:** [B04 Issue #4](https://github.com/chung6a8m/MyDms/issues/4). [B05/TADR-01 #5](https://github.com/chung6a8m/MyDms/issues/5) and [B06/TADR-02 #6](https://github.com/chung6a8m/MyDms/issues/6) stay `PLANNED_BLOCKED_GATE_A`. `Gate B=BLOCKED`; TADR-01..06 still `DESIGN_CANDIDATE`; EV-01..15 real pending; G-STOCK/G-CUT/G-IDEMP/G-LEDGER/G-INV are non-waivable; B_NO_CHANNEL blocked, OFFLINE_WRITE and PRODUCTION_CUTOVER disabled. Once Gate A is authentically authorized, it only admits bounded **nonproduction** B05/B06 spikes; Gate B needs technical/QA/Finance TADR review and separate Owner authorization.
