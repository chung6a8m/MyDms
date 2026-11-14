# B04 — AWS S3 restricted evidence store (ứng viên tham chiếu, chưa triển khai)

**Trạng thái:** `PROVIDER_CANDIDATE / NOT_PROVISIONED / NOT_APPROVED`. Đây là bộ hướng dẫn cho một lựa chọn **AWS S3**, **không phải** quyết định Owner chọn AWS, không phải evidence thực, không phải Gate A approval. Dự án tiếp tục dùng <Link> không? Không dùng MDX ở tài liệu; xem [Issue #4](https://github.com/chung6a8m/MyDms/issues/4).

## 1. Điều kiện trước khi triển khai CloudFormation

Chỉ kỹ sư có quyền ở **AWS account được Owner chấp thuận**, trong **protected operator session**, mới thực hiện các thao tác tạo tài nguyên. Không để ChatGPT/GitHub public CI tự áp dụng template.

1. Owner chọn nhà cung cấp (AWS S3 hoặc phương án tương đương), AWS account/region, ngân sách và người vận hành. CloudTrail object data events có thể phát sinh chi phí.
2. Finance/Security/Ops/Legal (theo phạm vi) đánh giá retention, backup, quyền xóa và rủi ro tuân thủ. Phải chọn `RetentionMode` (`GOVERNANCE` hoặc `COMPLIANCE`), số ngày giữ *evidence* và *audit* riêng; **không có default**. Object Lock + versioning khó/không thể vô hiệu hóa sau khi bật, và COMPLIANCE không cho xóa sớm.
3. Xác định thực tế IAM roles riêng cho write, read, audit và break-glass; KMS permissions, separation of duties và quyền CloudFormation administrator. Template **không tạo IAM principals hay cấp quyền đọc/ghi**, nên chưa chứng minh least privilege.
4. Khóa nguồn chứng thực, hạn chế quyền operator, đặt tên bucket/trail trong **private channel**, không đưa resource/account IDs, access keys, logs, signed links hoặc `private-evidence/` vào GitHub, Issues/PR comments hay public Actions.

## 2. Cấu hình ứng viên

[CloudFormation JSON](evidence-store.template.json) tạo theo lựa chọn có kiểm soát, khi operator áp dụng sau phê duyệt:

- Bucket evidence: `BlockPublicAccess` bốn mức, `BucketOwnerEnforced`, versioning, S3 Object Lock (mode/days có Owner quyết định), SSE-KMS bằng CMK có rotation, Deny non-TLS và TLS dưới 1.2; không `forceDestroy`.
- Bucket audit riêng: private, versioned, WORM/retention, server-side encryption, Deny non-TLS và TLS dưới 1.2.
- CloudTrail với event selector S3 object `ReadWriteType=All`, log file validation và log gửi audit bucket riêng; data-event logging không mặc nhiên bật ở mọi trail.
- Bucket/KMS `DeletionPolicy=Retain`, `UpdateReplacePolicy=Retain`, nhưng **chính sách IAM least privilege, KMS trust và chu kỳ xóa/lưu trữ vẫn cần review thực**.

Đây chỉ là baseline kỹ thuật. Bắt buộc thực hiện kiểm tra bảo mật/chi phí trên *change set* trước khi áp dụng; tham chiếu [AWS S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-configure.html), [Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html) và [CloudTrail data events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html).

## 3. Quy trình vận hành ở protected workstation

Đầu tiên xác minh principal/account thực qua `aws sts get-caller-identity` và kiểm tra account/region được Owner duyệt. Phải dùng phiên đăng nhập được cấp quyền hạn chế; **không dùng GitHub Actions public hoặc production credentials**.

Trong môi trường riêng tư, chuẩn bị CloudFormation parameters (không commit):

```text
private-evidence/
  b04-s3-stack-params.json     # AWS::CloudFormation::Parameters; names/days đã duyệt
  b04-s3-change-set-review.md  # quyền, costs, lifecycle và approver
  b04-s3-observation.json      # chỉ tạo sau bước read-only thực
  b04-gate-a-assessment.json   # cấu trúc Gate A v2, chưa tự tạo chữ ký
```

Kiểm tra template mà **không** áp dụng:

```bash
aws cloudformation validate-template \
  --template-body file://infra/b04/aws-s3/evidence-store.template.json
```

Sau khi Owner chọn AWS và chấp thuận tài nguyên/cost/retention, operator có thể tạo **CloudFormation change set** bằng `--template-body file://...` và `--parameters file://private-evidence/b04-s3-stack-params.json`, kiểm tra IAM/KMS/bucket policy/CloudTrail trước khi `execute-change-set`. Không tự thực hiện bước execute từ public CI. Retention `COMPLIANCE` và Object Lock có tác động khó đảo ngược.

## 4. Đối chiếu cấu hình thực (chỉ đọc)

Sau khi thực sự provision và dùng AWS CLI trong **protected terminal**, truyền tên bucket/trail, retention đã ký và source SHA bằng environment ở kênh bảo mật. Không đưa credentials/identifiers vào PR, lệnh ví dụ công khai hoặc artifact public.

```bash
node tools/evidence/b04-aws-s3-preflight.mjs \
  --restricted private-evidence/b04-s3-observation.json
```

Script yêu cầu: `MYDMS_B04_EVIDENCE_BUCKET`, `MYDMS_B04_AUDIT_TRAIL`, `MYDMS_B04_APPROVED_RETENTION_DAYS`, `MYDMS_B04_SOURCE_SHA` và AWS CLI đã login. Nó chỉ gọi read-only S3/CloudTrail/STS APIs, kiểm tra chín nhóm cấu hình, rồi ghi bản redacted cấu hình dưới `private-evidence/` với quyền file 0600. Mọi lỗi/provider credentials phải được xử lý trong môi trường bảo mật.

Dù **9/9 cấu hình PASS**, output vẫn `gateA=NOT_READY`. Một tệp JSON có trường PASS không chứng minh quyền IAM, bảo đảm WORM, CloudTrail audit thực hoặc danh tính reviewer.

## 5. Các phép kiểm thực bắt buộc, không tự động chạy

- **Access-denied thực:** sử dụng riêng một authorized reader, authorized writer, auditor, và unauthorized principal; kiểm `PutObject/GetObject/ListBucket/DeleteObject/GetObjectVersion` theo allow/deny, ghi principalRef/decision/protected trace thực. Không dùng quyền admin để tự chứng minh least privilege.
- **Retention & restore thực:** sử dụng dữ liệu *synthetic được phép*, prefix thử nghiệm riêng; kiểm phiên bản v1/v2, đọc lại phiên bản trước, retention và xóa bị chặn khi còn thời gian khóa, chính sách purge/restore đã duyệt. Khi thử Object Lock, không thể xóa sớm; cần budget/cleanup phù hợp.
- **Audit thực:** tạo sự kiện truy cập synthetic, chờ CloudTrail giao log, đối chiếu S3 data events của *thao tác thực*, thời gian, request/identity và hash qua protected evidence; không mặc định trail `IsLogging=true` nghĩa delivery đã PASS.
- **SQL runtime/migrator, fault allowlist F-01/F-10/F-15:** approval Technical/QA/Ops/Security độc lập với cấu hình S3, kiểm chứng runner không có production/provider egress, dữ liệu/test cleanup thực.
- **Finance Safety Scope:** hồ sơ `financeSafety` phải được đánh giá có evidence thật; Finance chỉ là Gate A required nếu ledger-specific safety assessment xác định. Finance TADR-01 ledger review vẫn bắt buộc tại Gate B.
- **Review/Owner acceptance:** Technical/QA/Ops/Security ký đúng scope và timestamp thực, người kiêm nhiệm phải khai báo ủy quyền/thẩm quyền. Owner cấp versioned `AUTHORIZED_B05_B06_NONPRODUCTION_ONLY` sau khi *tất cả* preconditions vượt qua. Không bật S6-A/production.

Lưu record thực theo R010 S3 evidence semantics ở kho restricted, đối chiếu `artifact.sha256`, `testRunId`, `sourceSha`, môi trường, tester và reviewer. Các tham chiếu công khai chỉ được ghi đã redacted, không rò resource names hoặc raw evidence.

## 6. Phân lớp trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| `REFERENCE_TEMPLATE_REVIEWED` | CloudFormation candidate đã được code-review; chưa provision |
| `CLOUD_CONFIG_OBSERVED` | Protected read-only API xác nhận cấu hình tại thời điểm quan sát; chưa đủ Gate A |
| `REAL_ACCESS_AUDIT_RESTORE_VERIFIED` | Có phép thử deny/audit/restore thực, nguồn và reviewer độc lập |
| `ROLE_SAFETY_REVIEW_ACCEPTED` | Có Technical/QA/Ops/Security và Finance điều kiện, với actual refs |
| `OWNER_GATE_A_AUTHORIZED` | Chỉ sau hồ sơ/decision riêng có phiên bản, giới hạn B05/B06 nonproduction |

**Hiện chưa đủ cơ sở khẳng định bất kỳ trạng thái thực nào sau `REFERENCE_TEMPLATE`.** Giữ [Gate A Issue #4](https://github.com/chung6a8m/MyDms/issues/4) OPEN; [B05](https://github.com/chung6a8m/MyDms/issues/5)/[B06](https://github.com/chung6a8m/MyDms/issues/6) BLOCKED và `Gate B=BLOCKED`. Product Baseline C′ / Acceptance R bất biến.
