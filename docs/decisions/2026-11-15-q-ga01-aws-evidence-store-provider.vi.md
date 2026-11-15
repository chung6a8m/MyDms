# Q-GA01 — Quyết định Owner về nhà cung cấp kho evidence B04

**Ngày ghi nhận:** 15/11/2026 (Asia/Bangkok). **Phiên bản:** 1.0. **Nguồn:** cuộc phỏng vấn Owner với ChatGPT, trả lời "Q-GA01: Tôi chọn phương án 1". Bản ghi do trợ lý chuẩn bị theo yêu cầu triển khai tiếp; đây **không phải chữ ký GitHub của Owner**, không có approvalRef/timestamp chữ ký được xác minh độc lập.

## Quyết định chính thức về hướng chọn nhà cung cấp

- **Q-GA01: Phương án 1 — AWS S3**. Chọn AWS làm nhà cung cấp kho evidence **restricted external** phục vụ B04, cùng kiến trúc đích S3 private evidence bucket + audit bucket, SSE-KMS, CloudTrail object data events, versioning và S3 Object Lock.
- Có thể tái sử dụng [AWS CloudFormation reference](../../infra/b04/aws-s3/evidence-store.template.json), [protected read-only preflight](../../tools/evidence/b04-aws-s3-preflight.mjs) và [runbook AWS](../../infra/b04/aws-s3/README.vi.md) trên MyDms `main`. Code tham chiếu và synthetic CI **không** phải bằng chứng cloud đã provision.
- Phạm vi quyết định chỉ là **lựa chọn provider + kiến trúc đích**. **Chưa** lựa chọn hay công khai account/Region, tài khoản thanh toán, định danh operator, ngân sách, IAM/KMS roles, retention mode/days, chi phí CloudTrail, change set, hoặc thời điểm triển khai; không tự gán bất kỳ mặc định an toàn/chi phí nào.
- CloudFormation `execute-change-set` và hoạt động mang tính provisioning **chưa được ủy quyền** bởi Q-GA01. Chỉ dùng account đã được Owner chấp thuận và protected operator channel; không chuyển secrets, account IDs, bucket names, IAM/KMS ARNs, restricted artifacts hay dữ liệu NPP lên public GitHub/ChatGPT.

## Các quyết định và bằng chứng tiếp theo

| ID | Cần chốt/xác minh | Trạng thái |
|---|---|---|
| Q-GA02 | Mô hình tài khoản AWS (Organizations member / account độc lập / nonproduction hiện hữu), ownership và billing | `PENDING_OWNER` |
| Q-GA03 | Region (cùng yêu cầu residency/egress) | `PENDING_OWNER` |
| Q-GA04 | Object Lock mode và retention days **riêng** evidence + audit; quyền purge/break-glass | `PENDING_OWNER` |
| Q-GA05 | Ngân sách/trần cảnh báo và người vận hành có quyền apply change set | `PENDING_OWNER` |
| Q-GA06 | IAM/KMS write/read/audit/break-glass và separation of duties | `PENDING_ROLE_REVIEW` |
| B04-LIVE | Access allow/deny, object-level audit correlation, version restore/retention, synthetic data boundary, isolated SQL identities/egress, bounded fault/cleanup | `NOT_RUN` |
| Q-GA07 | Technical / QA / Operations / Security safety review; Finance Gate A theo documented assessment | `PENDING_ROLE_APPROVAL` |
| Q-GA08 | **Owner Gate A authorization riêng**, versioned, chỉ cho B05/B06 synthetic nonproduction | `NOT_GRANTED` |

Điều kiện kiểm chứng chi tiết: [B04 Gate A closeout](../runbooks/b04-gate-a-closeout.md) và [AWS deployment intake](../runbooks/b04-aws-deployment-intake.vi.md). Mọi phép thử thực có `sourceSha`, testRunId, artifact SHA256, private URI, reviewerRef thực và thời điểm đúng nguồn. Test/template/assessor không tự xác nhận quyền hạn hay kết quả.

## Trạng thái chưa thay đổi

`Gate A=NOT_READY`, `Gate B=BLOCKED`, `B05/B06=PLANNED_BLOCKED_GATE_A`, `TADR-01/02=DESIGN_CANDIDATE`. Không có real `EV-01..15 PASS`, không được tự cho phép S6-A, Product Verification, Tenant Go-Live, Mode Admission, Offline Write, B_NO_CHANNEL hoặc Production Cutover; năm P0 không được miễn trừ.

Bảo toàn Product C′ `eb9c4b04e334530367b80ea4178edb4dd4a07491` và Acceptance R `e47c3feb44c02a0fdf46c35f6c4b2f57c4365470`. Hồ sơ lựa chọn Q-GA01 **không phải** `OWNER_GATE_A_AUTHORIZED`.
