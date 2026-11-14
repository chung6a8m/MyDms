# MyDms

**Open-source Product DMS — MIT License** — SaaS dành cho doanh nghiệp SME phân phối FMCG tại Việt Nam.

> **Giấy phép:** [MIT](LICENSE) · Copyright (c) 2026 chung6a8m. Cho phép sử dụng, sửa đổi, phân phối và kinh doanh theo MIT, với nghĩa vụ giữ thông báo bản quyền và giấy phép. Source công khai không đồng nghĩa được công khai dữ liệu tenant, secrets hay raw evidence.

## Engineering direction (Q01 v2: MIT; Q02–Q08 unchanged, 14/11/2026)

- Monorepo: .NET 10 + SQL Server + React/TypeScript.
- Independent Modular Monolith, database-per-tenant, business-module-first Clean Architecture.
- Layered CI with real SQL/API verification per stage; Owner-driven merge after appropriate CI.
- Two review gates: isolated nonproduction TADR-01/02 technical spikes after Gate A; S6-A production-quality runtime only after Gate B (real technical/QA/Finance review plus Owner authorization).

Product policies are governed by the immutable Product Baseline C′ `eb9c4b04e334530367b80ea4178edb4dd4a07491` and acceptance metadata R `e47c3feb44c02a0fdf46c35f6c4b2f57c4365470` in [research repository](https://github.com/chung6a8m/research-sme-phan-phoi-hang-tieu-dung). Do **not** treat documentation, model-only CI, synthetic fixtures, or merged source as Product Verified / Tenant Go-Live.

**Current state (14/11/2026):** [S6-0 B01–B03 bootstrap](docs/plans/active-s6-0.md) and [B04 public synthetic contract](docs/evidence/2026-11-14-s6-0-b04-closeout.md) merged with foundation CI passing. **Gate A remains NOT_READY** until restricted external evidence store and real QA/Ops/Security safety approval. B05/B06 spikes NOT_STARTED; TADR-01..06 DESIGN_CANDIDATE, all real EV pending, B_NO_CHANNEL blocked, Offline Write and cutover disabled. No customer data or production credentials may enter public artifacts.
