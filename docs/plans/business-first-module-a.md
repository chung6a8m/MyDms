# Solo-dev business-first: Module A Domain Slice 01

Ngày: 15/11/2026. Trạng thái: SOURCE CANDIDATE — DOMAIN/UNIT TEST ONLY. Không có S6-A runtime authorization.

Product authority: C′ eb9c4b04e334530367b80ea4178edb4dd4a07491, Acceptance R e47c3feb44c02a0fdf46c35f6c4b2f57c4365470.

## Phạm vi đã viết

- Sales.Domain/AOrder.cs: tạo đơn A DRAFT với Customer ổn định, Outlet tùy chọn và ShipTo snapshot; giữ quote và terms tại Confirm.
- Phân biệt CreditPolicy UNSET và APPROVED=0: không mở bán chịu từ default thiếu duyệt.
- SimulateDelivery tính giao từng phần theo source line, hạn nợ riêng theo ngày giao và số ngày đã snapshot, không vượt lượng còn lại.
- Lượng, giá tiền dùng decimal; số tiền đã quote được giữ theo line; với nhiều lần giao dùng phân bổ lũy kế để không mất tổng.
- Unit tests kiểm tra chuyển trạng thái mô phỏng, quote/terms, trùng nguồn, vượt nguồn, không mutate khi validation lỗi và COD.

## Ranh giới không vượt

Đây là **in-memory domain exercise**; Confirm **không** xác nhận đã giữ hàng hay shared customer credit, SimulateDelivery **không** phải giao hàng thực hay AR posted. Tầng ngoài chưa xác minh seller profile, authority, stock reservation, warehouse writer, cash verified, tax/commercial pricing 5 families, credit exposure, transaction atomicity, idempotency bền, invoice/provider hoặc accounting. Công thức MidpointRounding.AwayFromZero cho phân bổ dự kiến ở đây chỉ là DOMAIN DESIGN CANDIDATE, chưa phê duyệt production.

Không thêm HTTP endpoints, persistence, database migration, cloud provisioning, secrets, provider egress, offline grant, mode admission, cutover. B05/B06 vẫn NOT_STARTED và BLOCKED_BY_GATE_A; Gate B vẫn BLOCKED. EV-01..15 thực pending; Product Verification và Tenant Go-Live chưa được cấp.

## Cách kiểm chứng

1. Chạy dotnet restore MyDms.slnx, dotnet build MyDms.slnx -c Release --no-restore, rồi dotnet test tests/Unit/MyDms.UnitTests/MyDms.UnitTests.csproj -c Release --no-build.
2. Review source + negative tests trên PR; chỉ ghi CI PASS khi GitHub Actions thực sự chạy thành công trên HEAD đúng.
3. Sau Gate A phê duyệt bằng chứng thật, mới chạy các spike B05/B06 có kiểm soát. Sau review TADR-01/02 và Gate B có Owner authorization riêng mới mở S6-A/SQL/API runtime.
4. Triển khai domain/test song song với chuỗi Safety/Verification, tiếp theo A Online E2E → B_ONLINE → MIXED. Offline A và B cần alternative channel vẫn là nhánh riêng/deferred.

## Trace

- BR-02/03/08/10; DC-05/09; SM-01; SOP-02 của Product Baseline.
- MyDms Gate A: https://github.com/chung6a8m/MyDms/issues/4 ; B05: https://github.com/chung6a8m/MyDms/issues/5 ; B06: https://github.com/chung6a8m/MyDms/issues/6.
- S6 research roadmap: https://github.com/chung6a8m/research-sme-phan-phoi-hang-tieu-dung/pull/3.

Không chỉnh lại C′/R hay Q08 trong PR này. Nếu cần nới gate, phải có Owner policy amendment riêng.