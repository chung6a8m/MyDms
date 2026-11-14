# Business Module-First — Candidate source boundaries

The monorepo uses one deployable API host for now, multiple `net10.0` class libraries, and two independent React/Vite application shells. It is **not** a microservice architecture.

| Layer | Allowed dependency | Prohibited |
|---|---|---|
| BuildingBlocks | .NET BCL | Platform, business or infrastructure |
| Module.Domain | BuildingBlocks | Application, Infrastructure, HTTP, SQL, other modules |
| Module.Application | Own Domain + BuildingBlocks | Foreign infrastructure/domain, ASP.NET, SQL drivers |
| Module.Infrastructure | Own Application/Domain + BuildingBlocks | Foreign module persistence |
| Platform.Tenancy | BuildingBlocks | Business domains |
| Host/API | Infrastructure and platform | Business rules implemented in host |
| Frontend | Versioned API contracts | Direct TenantDB access or hidden production endpoints |

Platform DB is for trusted tenant registry, authority and lifecycle; TenantDB is unique per tenant. Neither DB schemas nor migration owner are decided in B01/B02. No current HTTP tenant resolution is implemented. `/health/ready` must return 503 until secure provisioning and DB verification exist.

Modules Inventory, Sales and Settlement are scaffolded only; Catalog, Customers, Trips and Integrations are reserved in planning docs to avoid meaningless project bloat. Per-module Domain/Application/Infrastructure separation is implemented in source.

One business action affecting Stock and AR/custody/advance/CustomerCredit must be atomic **within the same TenantDB** when required by Product C′. Deciding SQL isolation, locking, index design, optimistic concurrency and correction workflow is reserved for TADR-01. Deciding exact idempotency keys/hash, ACK durability and worker recovery is TADR-02. No cross-module auto-commit or eventual-consistency shortcut may waive those invariants.
