# TADR-02 — Durability & Idempotency (DESIGN_CANDIDATE)

**Not approved.** Review owners required: Engineering/Technical and QA; Security/Ops where authority/recovery requires.

## Questions for B06
- Canonical command ID, effect ID, payload hash and idempotency key scope; replay vs duplicate payload conflict.
- Durable inbox and outbox committed with business state; distinguish accepted durability from merely HTTP-received or queued.
- Commit succeeded but response lost; original outcome recovery and authorization re-check; concurrent same-key claims.
- Dependency-aware worker/poison flow, audit, crash replay and non-expiring tombstones; fail closed on unknown outcome.
- Offline PWA durability and device grant **separate** from scoped online API test.

## Proposed proof (not yet executed)
Disposable SQL + controlled HTTP transport drops and process restarts with synthetic fixtures. Verify exactly one effect on same key, conflict on same key/different hash, and durable status after SQL commit; trace source SHA and F-01/F-10/F-15. Do not claim EV-08/09 offline evidence.

## Decision constraints
Evidence target AC-09/11/12/15 and EV-08/11 (online portion only). Separate Technical/QA review and versioned decision required before Gate B.
