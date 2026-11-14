# S6-0 testing and evidence safety runbook

## Guardrails
- GitHub repository must remain `private` and use least-privilege CI `contents: read`.
- CI creates **only disposable synthetic SQL** on GitHub hosted runner. There must be no production endpoint, provider token or customer source file.
- `MYDMS_SQL_TEST_DISPOSABLE=YES` is mandatory for SQL scripts; script rejects non-GitHub execution by default. No external `SQL_CONNECTION_STRING` is read by the fixture.
- SQL Server container bound only to loopback; password generated in runner memory, not in Git, logs or artifacts. Cleanup uses `trap`, including on failure.
- CI `sql-smoke` proves only SQL service availability, **not** stock/ledger/ACK or Product Verification.
- Network access to invoice/accounting providers is out of scope and disabled by policy until explicit sandbox approval.
- No production secrets in CI. Raw evidence store, retention, role assignments and fault-injection safety plan require real Owner/QA/Ops/Security review (B04 still partially pending).

## Local
Run `node tools/architecture/check-boundaries.mjs --self-test`, `dotnet restore MyDms.slnx`, `dotnet build MyDms.slnx -c Release`, `dotnet test MyDms.slnx -c Release`, `npm ci`, `npm run typecheck`, `npm run build`, `npm run test:unit`.

These are candidate commands; record actual run SHA/results. Build/health do not prove tenant readiness.

## S6 Gate A/B
B00 private + B01-B04 sandbox safety proven before any B05/B06 spike. Gate B requires TADR-01/02 Technical/QA review, Finance for finance ledger, actual evidence/dispositions, no P0 waiver and explicit Owner S6-A authorization. Missing roles remain PENDING/BLOCKED.
