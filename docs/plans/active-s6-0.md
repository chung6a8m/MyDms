# Active S6-0 Foundation Bootstrap (Q01–Q08)

| Step | Status | Requirement |
|---|---|---|
| B00 MIT open-source policy | OWNER_DECIDED / PR_PENDING | Public source under MIT, LICENSE + notices in source PR #1; verify merged default branch separately |
| B01 Source bootstrap | SOURCE_PR_CANDIDATE / HISTORICAL_CI_PASS | .NET 10 solution, React apps, source files, CI build |
| B02 Architecture boundaries | IMPLEMENTED / HISTORICAL_CI_PASS | Static graph check + negative self-tests; CI required |
| B03 CI layering | FOUNDATION_CI_5_OF_5_PASS_ON_B4683F8 / NEW_HEAD_PENDING | .NET unit, TS frontend, architecture and isolated SQL infra smoke |
| B04 Evidence safety | POLICY_AND_SYNTHETIC_CI_ONLY / SECURE_STORE_NOT_CONFIGURED | No real tenant data, secrets or external provider; secure evidence store/retention pending real setup |
| B05 TADR-01 spike | NOT_STARTED | Needs Gate A actual safe SQL sandbox |
| B06 TADR-02 spike | NOT_STARTED | Needs Gate A; no runtime admission |
| B07 Role-scoped review | PENDING_REVIEWERS | Technical/QA/Finance as applicable |
| B08 Gate B | BLOCKED | Explicit Owner S6-A authorization and approved TADR |

## Historical initial CI attempt (resolved for current public repository)

- Source HEAD `af2a8f43c9a49a4cb0a6e053e33422ac4be17aa3`, [MyDms PR #1](https://github.com/chung6a8m/MyDms/pull/1).
- [GitHub Actions run #43548426310](https://github.com/chung6a8m/MyDms/actions/runs/43548426310) concluded `failure`. **All four jobs terminated with zero steps recorded** (GitHub API); fetching logs returned BlobNotFound.
- This is `CI_INFRA_BLOCKED / NO_TEST_STEPS_EXECUTED`, not a proven C#/TS/test code failure. Root cause is not established. Historical record: [MyDms Issue #2](https://github.com/chung6a8m/MyDms/issues/2) CLOSED after current public repository runner succeeded; precise cause of the earlier private-repo failure remains UNKNOWN.
- A read-only reference/dependency inspection through connector checked **13 csproj and 18 ProjectReference edges, 0 invalid dependencies** on this source candidate. This is `SOURCE_STATIC_INSPECTION_ONLY`, **not** a substitute for runnable architecture test, .NET build or SQL test.
- Foundation build/unit/Node/SQL-infrastructure checks subsequently ran and PASSED at commit `b4683f84248ba7f580c54c91022216101e1d747a` ([run #43552194768](https://github.com/chung6a8m/MyDms/actions/runs/43552194768)). New CI hardening remains unverified until its own exact-HEAD run. B04 secure evidence store and actor assignments also pending. Gate A remains **NOT_READY**.

See [CI source-bound evidence](../evidence/2026-11-14-foundation-ci-provenance.md); do not promote **new** source changes until exact-HEAD checks complete. **Q01 v2 (14/11/2026): Owner now selects Public/MIT**, superseding historical Private/Proprietary. Public CI logs/artifacts must never contain real NPP data, credentials or raw evidence. A Draft PR is not a merged MIT license on `main`; record exact HEAD/CI and Owner merge separately.

Owner decision Q01–08: [research PR #3](https://github.com/chung6a8m/research-sme-phan-phoi-hang-tieu-dung/pull/3). Source governance Issue #4 remains open pending B01–B08 review.

**Product scope:** A, B_ONLINE and MIXED may be developed/verified; they are not admitted to production. B_NO_CHANNEL BLOCKED; OFFLINE_WRITE and PRODUCTION_CUTOVER DISABLED_PENDING. All EV-01..15 real evidence pending.
