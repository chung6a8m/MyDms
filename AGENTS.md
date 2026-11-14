# MyDms — Agent/Contributor Policy

## Binding decisions
- **Private/proprietary** monorepo, .NET 10/SQL Server/React+TypeScript.
- **Product Baseline C′ immutable:** `eb9c4b04e334530367b80ea4178edb4dd4a07491`; metadata R `e47c3feb44c02a0fdf46c35f6c4b2f57c4365470` in research repository.
- Business Module-First with Domain → Application → Infrastructure dependency direction; host composes infrastructure.
- Q07 solo Owner PR merge after applicable CI **does not grant** Technical/QA/Finance approval.
- Q08 Gate A isolated spike first; Gate B actual TADR-01/02 review and Owner runtime authorization later.

## Non-negotiable safety
- No production tenant, data, secrets, or provider calls in tests. No customer data in Git.
- No mode admission, offline writes, cutover, invoice issuance or ledger posts in foundation.
- Never claim `PRODUCT_VERIFIED`, `TENANT_GO_LIVE_ACCEPTED` or EV PASS from build, mocked tests, GitHub merge or synthetic CI.
- Non-waivable gates: G-STOCK, G-CUT, G-IDEMP, G-LEDGER and G-INV; B_NO_CHANNEL blocked.
- Cross-module atomic stock + 3-ledger design requires TADR-01; durable inbox/outbox/ACK requires TADR-02.
- Build/test changes must include exact HEAD SHA, environment, runnable commands, negative cases and provenance.

## Repo layout
`src/server/Host`, `src/server/BuildingBlocks`, `src/server/Platform`, `src/server/Modules`, `apps/admin-web`, `apps/field-pwa`, `tests`, `tools/architecture`, `docs`. Empty domains (Catalog/Customers/Trips/Integrations) are tracked in docs, not empty projects.

## Coding conventions
- Public API contracts must not expose EF/ADO.NET/ASP.NET types or domain persistence internals.
- No feature code in host; API health/live is a process signal only. Readiness must fail closed until real authority/SQL checks exist.
- No direct business table access across module boundaries; design atomic transaction coordination in TADR-01.
- Keep build deterministic, pin dependencies, fail on mandatory skipped tests, do not suppress security audit.
- Source, PR comments and technical records in Vietnamese where appropriate; code symbols English.
