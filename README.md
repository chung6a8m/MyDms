# MyDms

**Private, proprietary Product DMS** — SaaS dành cho doanh nghiệp SME phân phối FMCG tại Việt Nam.

> Internal source repository. All rights reserved by the repository owner. Public visibility or possession of source does not grant a license to copy, redistribute, or deploy it. Final legal/licensing wording is subject to Owner/legal review.

## Engineering direction (Owner Q01–Q08, 14/11/2026)

- Monorepo: .NET 10 + SQL Server + React/TypeScript.
- Independent Modular Monolith, database-per-tenant, business-module-first Clean Architecture.
- Layered CI with real SQL/API verification per stage; Owner-driven merge after appropriate CI.
- Two review gates: isolated nonproduction TADR-01/02 technical spikes after Gate A; S6-A production-quality runtime only after Gate B (real technical/QA/Finance review plus Owner authorization).

Product policies are governed by the immutable Product Baseline C′ `eb9c4b04e334530367b80ea4178edb4dd4a07491` and acceptance metadata R `e47c3feb44c02a0fdf46c35f6c4b2f57c4365470` in [research repository](https://github.com/chung6a8m/research-sme-phan-phoi-hang-tieu-dung). Do **not** treat documentation, model-only CI, synthetic fixtures, or merged source as Product Verified / Tenant Go-Live.

**Current state:** source bootstrap in progress; TADR-01..06 still `DESIGN_CANDIDATE`, all runtime evidence pending, B_NO_CHANNEL blocked, Offline Write and production cutover disabled. No customer data or production credentials may be introduced into bootstrap/test artifacts.
