# TADR-01 — Transaction & Ledger (DESIGN_CANDIDATE)

**Not approved.** Review owners required: Technical, QA, Finance (ledger). Source scope: MyDms nonproduction spike only.

## Questions for B05
- SQL schema/index strategy for stock MAIN/TRIP/lot, A reservation, B quota, price/cost, AR, custody, advance, CustomerCredit.
- Single transaction commit/rollback across cross-module ledgers, per-source line invariants, consistent lock order and bounded retry.
- Isolation strategy and races in one tenant; isolation and authority of independent tenant databases.
- Moving-average cost per SKU × location, corrections and periodic accounting bridge.
- Transaction-owned idempotency outcomes and external outbox effects that must only publish after commit.

## Proposed proof (not yet executed)
Create disposable SQL fixture, run positive/negative event scenarios with simultaneous commands, induced rollback and retry, per-source before/after ledger differences, unique constraints and concurrency. Record actual buildSha/SQL digest/testRunId; no real NPP data.

## Decision constraints
Evidence target AC-03/06/09/10/20/21 and EV-03/06/07. Execution is NOT product verification. Record options, rejected approaches, locks/isolation, migration and actual technical/QA/Finance signoffs before Gate B.
