# S6-0 testing and evidence safety runbook

## Guardrails
- Repository visibility is **public** and source license is **MIT (Owner Q01 v2)**; CI must remain least-privilege (`contents: read`). Public job logs/artifacts must not disclose secrets, real NPP/Customer data, raw invoices or restricted evidence.
- CI creates **only disposable synthetic SQL** on GitHub hosted runner, with test evidence limited to non-sensitive counters, source/checkout SHA, safe SQL image identifiers and synthetic fixtures. There must be no production endpoint, provider token or customer source file.
- `MYDMS_SQL_TEST_DISPOSABLE=YES` is mandatory for SQL scripts; script rejects non-GitHub execution by default. No external `SQL_CONNECTION_STRING` is read by the fixture.
- SQL infrastructure-only smoke runs **only on a GitHub-hosted runner** with a pinned SQL Server 2022 container digest, Docker `--internal` bridge and no published host ports. It makes a bounded negative egress probe to reserved TEST-NET-2 and verifies container/network cleanup **before** writing success metadata. The password stays only in runner memory; failure must not publish a positive proof. This is not an authorized B05/B06 API/SQL fault-injection sandbox; actual runtime/migrator privilege separation, restricted store, independent reviewers and full safety gates are still pending.
- CI `sql-smoke` proves only SQL service availability, **not** stock/ledger/ACK or Product Verification. C# TRX must show executed tests > 0 and no skipped/failing tests; npm audit must not be disabled by install flags.
- Network access to invoice/accounting providers is out of scope and disabled by policy until explicit sandbox approval.
- No production secrets in CI. Raw evidence store, retention, role assignments and fault-injection safety plan require real Owner/QA/Ops/Security review (B04 still partially pending).

## Local
Run `node tools/architecture/check-boundaries.mjs --self-test`, `dotnet restore MyDms.slnx`, `dotnet build MyDms.slnx -c Release`, `dotnet test MyDms.slnx -c Release`, `npm ci`, `npm run typecheck`, `npm run build`, `npm run test:unit`.

These are candidate commands; record actual run SHA/results. Build/health do not prove tenant readiness.

Public-only synthetic metadata is checked using `tools/evidence/check-public-synthetic.mjs`; no restricted artifacts or reviewer sign-offs may be encoded as public synthetic CI acceptance. See [B04 safety plan](b04-sandbox-and-evidence-safety.md).

## S6 Gate A/B
B00 MIT/public governance + B01–B04 sandbox safety proven before any B05/B06 spike. Gate B requires TADR-01/02 Technical/QA review, Finance for finance ledger, actual evidence/dispositions, no P0 waiver and explicit Owner S6-A authorization. Missing roles remain PENDING/BLOCKED.
