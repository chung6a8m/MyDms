# Owner Q08 — Gate A / Gate B reviewer scope (14/11/2026)

**Decision provenance:** Owner selected **option B in the ChatGPT review conversation on 14/11/2026**, in response to [PR #8 review F1](https://github.com/chung6a8m/MyDms/pull/8#discussion_r4571656584). This record captures the chosen policy, **not a GitHub-authenticated Owner Gate A approval** and not an approval by independent reviewers. The approved Product C′ and Acceptance Record R are unchanged.

## Selected policy B — two distinct gates

| | Gate A — safe synthetic technical spikes | Gate B — product-runtime authorization |
|---|---|---|
| Timing | Before B05/B06 isolated nonproduction execution | After B05/B06 evidence and actual TADR-01/02 reviews |
| Mandatory roles | Technical, QA, Operations, Security, each with real scoped acceptance/authority | TADR-01 Technical/QA/Finance for ledger; TADR-02 Technical/QA, with Ops/Security as scope requires |
| Finance | **Conditional**, only when a real documented Gate A ledger-specific safety risk assessment requires it | **Required for TADR-01 ledger decision** independently of Gate A Finance assessment |
| Source evidence | Verified restricted storage, access-denied/audit, retention/restore, data boundary, SQL sandbox isolation, fault allowlist, cleanup and actual role approvals | Reviewed technical alternatives, SQL/API atomicity/ACK/replay evidence, finance ledger review, signed/versioned TADR and Owner authorization |
| Owner permission | **Only** B05/B06 bounded synthetic nonproduction spikes | S6-A engineering/runtime development after independent review |
| Forbidden | Production data/credentials/providers, B_NO_CHANNEL, OFFLINE_WRITE, cutover, product/tenant verification, P0 waiver | Implicit product verification, tenant Go-Live or automatic mode admission |

No assumption of five distinct human reviewers is imposed at Gate A. Each reviewerRef must identify a real role-scoped decision and actual authority; if one person legitimately serves multiple roles, this must be disclosed with separately traceable role approvalRefs and verified delegation/Owner authorization, **never presented as independent human reviews**. Any domain-specific maker–checker independence requirement remains a separate mandatory check.

## Versioned machine contract

The candidate Gate A dossier is now `b04-gate-a-readiness-v2` (supersedes unmerged v1 proposed in PR #8). Required Gate A safety roles: `TECHNICAL`, `QA`, `OPERATIONS`, `SECURITY`. The `financeSafety` record begins `PENDING_SCOPE_ASSESSMENT`; protected evidence must document whether Finance is `REQUIRED_FOR_GATE_A` or `NOT_REQUIRED_FOR_GATE_A_WITH_EVIDENCE`, with actual assessor, decision timestamp and protected ref. It **cannot be turned off by a bare boolean**. Finance review is mandatory at Gate A when required by that assessment.

If a restricted record has multiple role claims by one principal, `roleOverlap.disclosureRef` must point to actual role/authority acceptance evidence. The source code only checks syntax and declares such groups; it cannot authenticate their independence or valid delegation.

`assess-b04-gate-a.mjs` **always** emits `gateA=NOT_READY`, even when a restricted input is structurally complete. A separate authenticated Owner Gate A decision, checked against actual provider/sandbox, role authority and test results, is needed to authorize execution. Gate B is not accepted or represented by the Gate A dossier.

## Boundaries that remain unchanged

[MyDms B04 Issue #4](https://github.com/chung6a8m/MyDms/issues/4) is OPEN; restricted evidence store, actual reviewer/safety signoffs, Finance scope assessment and Owner Gate A authorization have not been demonstrated. B05/B06 remain blocked and TADR-01/02 DESIGN_CANDIDATE. Product Verified / Tenant Go-Live / EV PASS remain pending. Source PR merge by Owner under Q07 does not change any of those states.

Source Product Baseline: `eb9c4b04e334530367b80ea4178edb4dd4a07491`. Acceptance metadata R: `e47c3feb44c02a0fdf46c35f6c4b2f57c4365470`.
