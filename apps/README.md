# Web apps (React + TypeScript + Vite)

Two deployable UI shells with a shared dependency lock at repository root:

- `apps/admin-web/` is a **shell only**; no customer, stock, payments or business operations.
- `apps/field-pwa/` includes a web manifest but **no service worker/offline write**; `OFFLINE_WRITE=DISABLED_PENDING` and `B_NO_CHANNEL=BLOCKED`.
- `apps/shared/src/scope.ts` carries **compile-time informational guard values** for the bootstrap UI only; **not** a security boundary or actual server authorization. Runtime admission must be server-side after Product Verification/tenant gates.

Commands from repository root: `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run build`.
Use pinned Node 22.16.0, lockfile v3. Lockfile references a **pruned exact-version dependency subset** from a prior reviewed ReactWebUI dependency resolution; this re-use is dependency metadata, not inherited security or test evidence.
