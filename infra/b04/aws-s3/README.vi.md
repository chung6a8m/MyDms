# B04 — AWS S3 restricted evidence store (ứng viên tham chiếu, chưa triển khai)

**Trạng thái cập nhật 15/11/2026:** `AWS_S3_SELECTED_BY_OWNER_IN_CHAT / NOT_PROVISIONED / GATE_A_NOT_READY`. Owner đã chọn **AWS S3** theo [Q-GA01](../../../docs/decisions/2026-11-15-q-ga01-aws-evidence-store-provider.vi.md); **chưa** phê duyệt account/region/cost/retention/roles hoặc quyền execute change-set. Bản hướng dẫn này vẫn là **reference**, không phải evidence thực hoặc Gate A approval; xem [Issue #4](https://github.com/chung6a8m/MyDms/issues/4).

## 1. Điều kiện trước khi triển khai CloudFormation

Chỉ kỹ sư có quyền ở **AWS account được Owner chấp thuận**, trong **protected operator session**, mới thực hiện các thao tác tạo tài nguyên. Không để ChatGPT/GitHub public CI tự áp dụng template.

1. Owner đã chọn AWS S3 (Q-GA01); **vẫn cần** chốt AWS account/region, ngân sách và người vận hành trước khi có thể xét provisioning. CloudTrail object data events có thể phát sinh chi phí.
2. Finance/Security/Ops/Legal (theo phạm vi) đánh giá retention, backup, quyền xóa và rủi ro tuân thủ. Phải chọn `RetentionMode` (`GOVERNANCE` hoặc `COMPLIANCE`), số ngày giữ *evidence* và *audit* riêng; **không có default**. Object Lock + versioning khó/không thể vô hiệu hóa sau khi bật, và COMPLIANCE không cho xóa sớm.
3. Xác định thực tế IAM roles riêng cho write, read, audit và break-glass; KMS permissions, separation of duties và quyền CloudFormation administrator. Template **không tạo IAM principals hay cấp quyền đọc/ghi**, nên chưa chứng minh least privilege.
4. Khóa nguồn chứng thực, hạn chế quyền operator, đặt tên bucket/trail trong **private channel**, không đưa resource/account IDs, access keys, logs, signed links hoặc `private-evidence/` vào GitHub, Issues/PR comments hay public Actions.

## 2. Cấu hình ứng viên

[CloudFormation JSON](evidence-store.template.json) tạo theo lựa chọn có kiểm soát, khi operator áp dụng sau phê duyệt:

- Bucket evidence: `BlockPublicAccess` bốn mức, `BucketOwnerEnforced`, versioning, S3 Object Lock (mode/days có Owner quyết định), SSE-KMS bằng CMK có rotation và **explicit bucket-policy Deny** cho SSE-S3, SSE-C, thuật toán khác, `aws:kms` thiếu key ID hoặc key ID không trùng CMK được duyệt; request không mang header mã hóa vẫn sử dụng default SSE-KMS của bucket. Không `forceDestroy`.
- Bucket audit riêng: private, versioned, WORM/retention, server-side encryption; TLS 1.2+ Deny áp dụng cho non-AWS service principals (`aws:PrincipalIsAWSService=false`) nhằm tránh chặn CloudTrail service-to-service. Principal CloudTrail chỉ được Allow theo `aws:SourceArn` gắn với trail cụ thể; **bắt buộc thử thực** log delivery.
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

Script yêu cầu các biến môi trường trong **protected terminal**: `MYDMS_B04_EVIDENCE_BUCKET`, `MYDMS_B04_AUDIT_BUCKET`, `MYDMS_B04_AUDIT_TRAIL`, `MYDMS_B04_APPROVED_AWS_ACCOUNT`, `MYDMS_B04_APPROVED_AWS_REGION`, `MYDMS_B04_AWS_PARTITION`, `MYDMS_B04_EXPECTED_KMS_KEY_ARN`, `MYDMS_B04_APPROVED_RETENTION_DAYS`, `MYDMS_B04_APPROVED_AUDIT_RETENTION_DAYS`, `MYDMS_B04_APPROVED_RETENTION_MODE`, `MYDMS_B04_SOURCE_SHA` và AWS CLI đã login. Account/region, bucket/trail/KMS key và retention **phải được Owner duyệt trước**. Mọi S3 API có `--expected-bucket-owner`, mọi AWS CLI đọc cấu hình có `--region` cụ thể. Preflight đọc account-level public block, cả hai buckets, mô tả/destination/ARN/region của CloudTrail, log file validation, thông báo lỗi giao log và event selectors; chỉ ghi các trạng thái tổng hợp (không chứa resource IDs) dưới `private-evidence/` mode 0600. Mọi provider credentials/errors phải xử lý trong kênh bảo mật.

Dù **24/24 cấu hình PASS**, output vẫn `gateA=NOT_READY`. Đây là kiểm tra cấu hình **chỉ đọc**, không phải AWS policy simulation; không chứng minh quyền IAM/KMS thực, restore/retention, CloudTrail **đã giao và đối chiếu** một sự kiện thực hay danh tính reviewer. Khi thiếu một phép đo, công cụ phải giữ `PENDING_CONFIGURATION_OR_PROOF`. Việc dùng `get-bucket-location` phục vụ đối chiếu vùng hiện chỉ là tương thích với AWS CLI, cần rà soát quyền API trong môi trường protected.


## SEC-01..SEC-04: kiểm tra bổ sung trước change-set

- **SEC-01:** Test cả hai TLS Deny statements có điều kiện `aws:PrincipalIsAWSService=false`; kiểm tra CloudTrail SourceArn và thực tế ghi audit sau khi Owner duyệt triển khai. Tránh coi service exclusion là chính sách TLS áp dụng cho AWS service.
- **SEC-02:** Kiểm thử request dùng default SSE-KMS không gửi header được phép bởi chính các Deny về mã hóa; gửi `AES256`, `aws:kms` thiếu key, key khác, key không có thuật toán và SSE-C đều bị Deny. Đây là regression về cấu trúc IAM rule, **không phải policy simulator thực**; cần test authorized/denied `PutObject` trên AWS riêng.
- **SEC-03:** `sts.Account`, approved region, `--expected-bucket-owner` của cả evidence+audit, `DescribeTrails` đúng trail ARN/HomeRegion/S3BucketName/LogFileValidationEnabled, không có reported S3 delivery error và S3 data selectors gắn đúng ARN. `LatestDeliveryError` trống **chưa chứng minh** sự kiện đã được ghi; cần kiểm thử sinh/nhận/audit.
- **SEC-04:** TLS policy validation chỉ chấp nhận canonical Deny với tập Condition đúng và service-principal exception; mọi điều kiện khác có thể giới hạn Deny (như `StringEquals` tag) phải trả pending. Các phép so sánh JSON không phụ thuộc thứ tự key.

Các tiêu chí CloudFormation/Policy tham chiếu tới tài liệu AWS: [S3 condition keys](https://docs.aws.amazon.com/AmazonS3/latest/userguide/amazon-s3-policy-keys.html), [Using SSE-KMS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html), [CloudTrail describe-trails](https://docs.aws.amazon.com/cli/latest/reference/cloudtrail/describe-trails.html), [get-trail-status](https://docs.aws.amazon.com/cli/latest/reference/cloudtrail/get-trail-status.html). Kết quả chưa được xác minh với account thật; không chuyển Gate A/B.

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
