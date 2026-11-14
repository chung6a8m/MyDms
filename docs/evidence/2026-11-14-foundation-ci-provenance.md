# Foundation CI provenance — B01/B02/B03

**Scope:** foundation verification only, not domain E2E, Product Verification or tenant Go-Live.

## Verified historical candidate

| Field | Verified observation |
|---|---|
| Source PR | [MyDms PR #1](https://github.com/chung6a8m/MyDms/pull/1) |
| CI workflow | [Run #43552194768](https://github.com/chung6a8m/MyDms/actions/runs/43552194768) |
| Source HEAD | `b4683f84248ba7f580c54c91022216101e1d747a` |
| Jobs | dotnet-build-unit, architecture-boundary, react-typescript-build, disposable-sql-infra-only, mit-license-governance |
| Conclusion | **5/5 SUCCESS** |
| C# unit tests | **3 passed, 0 failed, 0 skipped**, per actual job log |
| SQL scope | SQL Server 2022 disposable infrastructure readiness only; no business schema/ledger/ACK |
| Artifact evidence | `unit-test-evidence`, `sql-infra-evidence` (short-retention synthetic CI) |

**New PR hardening:** prohibit `npm ci --no-audit`, introduce high/critical npm audit step, require nonzero and non-skipped TRX test counters and source SHA metadata, disallow missing unit/SQL artifacts. Exact HEAD CI must be rechecked after this change; this paragraph records the **historical candidate**, not a forecast.

## Remaining B04 controls

Public GitHub Actions artifacts are **not** the secure external evidence store required for real NPP/provider/operational artifacts. Before fault injection/technical spikes involving privileged data, obtain an isolated nonproduction SQL environment, approved safety runbook, least-privilege access, data/secret controls, actual QA/Ops/Security reviews and secure-store location/retention/audit. Keep `Gate A=NOT_READY` until these are evidenced.

All `EV-01..EV-15` real-system statuses remain pending; `TADR-01/02=DESIGN_CANDIDATE`, Gate B blocked.
