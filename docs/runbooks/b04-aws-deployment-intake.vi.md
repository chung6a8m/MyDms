# B04 — AWS S3: Owner intake và tiến trình kiểm chứng Gate A

**Cập nhật 15/11/2026:** Q-GA01 đã chọn AWS S3 theo [quyết định có phiên bản](../decisions/2026-11-15-q-ga01-aws-evidence-store-provider.vi.md). **Không được** provision hoặc chạy fault-injection chỉ từ quyết định này. Public repo dùng để lưu hợp đồng kỹ thuật và trạng thái đã khử nhạy cảm; thực thi với AWS account/roles/evidence trong protected workspace độc lập.

## Phỏng vấn nối tiếp (mỗi câu quyết định độc lập)

1. **Q-GA02 — AWS account boundary:** (A) AWS Organizations member account riêng cho restricted B04 evidence; (B) AWS account độc lập mới dành riêng cho nonproduction evidence; (C) dùng nonproduction AWS account hiện hữu có boundary IAM/KMS/network đã kiểm chứng; (D) cần kiểm kê account trước khi quyết định. Khuyến nghị A khi đã có Organizations; B nếu chưa có. Không điền account ID vào GitHub.
2. **Q-GA03 — Region:** vùng AWS cho evidence và audit, xét vị trí dữ liệu, tính năng hỗ trợ, chi phí, latency và pháp lý. Không tự chọn bằng suy đoán địa lý. Region đã duyệt phải được ràng vào protected preflight.
3. **Q-GA04 — Retention:** chọn `GOVERNANCE` hay `COMPLIANCE`, `evidenceRetentionDays` và `auditRetentionDays` tách riêng; kiểm soát quyền `BypassGovernanceRetention`/break-glass, legal hold, lifecycle và ngân sách giữ nhiều phiên bản. Không có giá trị mặc định trước phê duyệt.
4. **Q-GA05 — Cost & operator:** owner thanh toán, AWS budgets/alerts và phạm vi quyền tạo thay đổi; kiểm tra CloudTrail S3 data-event charges, KMS requests, versions và Object Lock giữ lâu. Không thực thi `execute-change-set` trước phê duyệt resource/cost/retention riêng.
5. **Q-GA06 — Real IAM/KMS:** reader/writer/auditor/unauthorized/break-glass độc lập theo least privilege; KMS key policy; audit bucket và CloudTrail log delivery; phân quyền Terraform/CloudFormation executor được thẩm tra.
6. **Q-GA07 — Protected proof & signoffs:** thực hiện bảy B04 controls, Finance safety scope assessment, Technical/QA/Ops/Security role-scoped signatures; có thể kiêm vai nếu thẩm quyền/ủy quyền thực, phải công bố overlap; không coi cùng GitHub account là bốn reviewer độc lập.
7. **Q-GA08 — Separate Owner authorization:** chỉ sau bằng chứng và reviewer thực mới có `AUTHORIZED_B05_B06_NONPRODUCTION_ONLY` kèm source SHA, phạm vi và điều kiện dừng; không cấp Gate B hoặc runtime/pilot.

## Phases có thể thực hiện (fail-closed)

| Giai đoạn | Hành động | Đầu ra/giới hạn |
|---|---|---|
| 0 — Hợp đồng | Read-only review CloudFormation + B04 template, chính sách an toàn | `OWNER_PROVIDER_SELECTED` nhưng `NOT_PROVISIONED` |
| 1 — Protected preflight | Sau Q-GA02..05: xác nhận AWS identity, region, budget, account-level public block, IAM/KMS design; CloudFormation validate-template, change-set **review** | Ghi bằng chứng riêng; không execute chỉ vì preflight PASS |
| 2 — Resource provisioning | Chỉ operator được ủy quyền, resource/account/region/cost/retention được duyệt; áp dụng change-set đã review | Store vẫn `UNVERIFIED` cho tới live checks |
| 3 — Store verification | Authorized `Put/Get/List/GetVersion`; unauthorized DENIED; audit CloudTrail events được giao và đối chiếu; version restore, retention/delete/hold tests trên synthetic-only objects | Protected run artifacts + hashes, không public raw |
| 4 — SQL safety | Runner/SQL runtime vs migrator roles, TEST-NET bounded egress deny, F-01/F-10/F-15 allowlist, stop conditions, cleanup thực | Không chạy B05/B06 khi Gate A chưa được ký |
| 5 — Review & Owner | Technical/QA/Ops/Security actual refs; Finance theo risk scope; Owner GitHub/records scoped approval riêng | Gate A mới có thể được xem xét |

## Bảo mật và bằng chứng

- Chỉ kiểm thử synthetic fixtures; không có dữ liệu khách hàng, hóa đơn thực, bank credentials, provider endpoints, secrets hoặc production SQL.
- Preflight: `node tools/evidence/b04-aws-s3-preflight.mjs --restricted private-evidence/b04-s3-observation.json` **chỉ sau** khi đã có real account, approval parameters và AWS CLI trong protected terminal. Công cụ không chứng minh live allow/deny hay Owner authorization.
- Assessor: `node tools/evidence/assess-b04-gate-a.mjs --restricted private-evidence/gate-a-assessment.json`; structural completeness không xác thực reviewer/gate. Raw evidence, account info, hashes of restricted contents và URI riêng phải ở encrypted restricted store.
- Với Object Lock, bucket/version có thể không xóa được cho tới khi hết thời hạn; mọi chi phí và cleanup exception phải được tính trước. Không thử bypass COMPLIANCE, không dùng quyền root/admin làm bằng chứng least privilege.
- Evidence manifest cuối phải truy vết actual source SHA, fixture SHA, runId, identity refs, operation, expected/observed, artifact digest, reviewer refs & dates. Public CI chỉ cho synthetic metadata.

Xem thêm [runbook nguồn AWS](../../infra/b04/aws-s3/README.vi.md), [Gate A seven controls](b04-gate-a-closeout.md), [Issue #4](https://github.com/chung6a8m/MyDms/issues/4), [B05](https://github.com/chung6a8m/MyDms/issues/5) và [B06](https://github.com/chung6a8m/MyDms/issues/6).
