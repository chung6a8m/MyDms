import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SHA40 = /^[a-f0-9]{40}$/;
const ACCOUNT = /^\d{12}$/;
const REGION = /^[a-z]{2}(?:-[a-z]+)+-\d$/;
const FLAGS = ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'];
const ENC = 's3:x-amz-server-side-encryption';
const KEY = 's3:x-amz-server-side-encryption-aws-kms-key-id';
const CUSTOMER = 's3:x-amz-server-side-encryption-customer-algorithm';
const check = (id, success) => ({
  id, status: success ? 'PASS_CONFIG_ONLY' : 'PENDING_CONFIGURATION_OR_PROOF'
});
const keysExactly = (value, names) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).sort().join('|') === names.slice().sort().join('|');
const canonical = v => Array.isArray(v) ? v.map(canonical) :
  v !== null && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])]))
    : v;
const equals = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const isAllPublicBlocked = x => FLAGS.every(key => x?.[key] === true);
const parsePolicy = raw => {
  try {
    const policy = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(policy?.Statement) ? policy.Statement : [];
  } catch { return []; }
};
const deny = (s, arn, condition) =>
  s?.Effect === 'Deny' && s?.Principal === '*' && s?.Action === 's3:PutObject' &&
  (s?.Resource === arn + '/*' ||
    (Array.isArray(s?.Resource) && s.Resource.length === 1 && s.Resource[0] === arn + '/*')) &&
  equals(s.Condition, condition);

// Deliberately recognizes only canonical, unqualified deny conditions; no "other"
// IAM Condition operator can restrict the TLS denial while still returning PASS.
export function matchesSecurePolicy(document, bucketArn) {
  const statements = parsePolicy(document);
  const both = s => s?.Effect === 'Deny' && s.Principal === '*' &&
    s.Action === 's3:*' && Array.isArray(s.Resource) &&
    s.Resource.length === 2 &&
    s.Resource.includes(bucketArn) && s.Resource.includes(bucketArn + '/*');
  const transport = { Bool: {
    'aws:SecureTransport': 'false', 'aws:PrincipalIsAWSService': 'false'
  }};
  const tls12 = { NumericLessThan: { 's3:TlsVersion': 1.2 },
    Bool: { 'aws:PrincipalIsAWSService': 'false' } };
  return statements.some(s => both(s) && equals(s.Condition, transport)) &&
    statements.some(s => both(s) && equals(s.Condition, tls12));
}

export function matchesEvidenceSsePolicy(document, bucketArn, kmsArn) {
  const statements = parsePolicy(document);
  const conditions = [
    { Null: { [ENC]: 'false' }, StringNotEquals: { [ENC]: 'aws:kms' } },
    { Null: { [ENC]: 'false', [KEY]: 'true' } },
    { Null: { [ENC]: 'true', [KEY]: 'false' } },
    { Null: { [KEY]: 'false' }, StringNotEquals: { [KEY]: kmsArn } },
    { Null: { [CUSTOMER]: 'false' } }
  ];
  // Default SSE-KMS requires NO client header; explicit overrides must pass exact key checks.
  return conditions.every(c => statements.some(s => deny(s, bucketArn, c)));
}

const normalizedLocation = loc => loc === null || loc === '' || loc === undefined
  ? 'us-east-1' : loc === 'EU' ? 'eu-west-1' : loc;
const absent = value => value === undefined || value === null || value === '';
const locationOK = (loc, expected) =>
  loc && Object.hasOwn(loc, 'LocationConstraint') &&
  normalizedLocation(loc.LocationConstraint) === expected;
const bucketChecks = (label, b, region, retentionDays, { kmsArn = null, arn } = {}) => {
  const block = b?.publicAccessBlock?.PublicAccessBlockConfiguration;
  const owners = b?.ownership?.OwnershipControls?.Rules;
  const enc = b?.encryption?.ServerSideEncryptionConfiguration?.Rules;
  const lock = b?.objectLock?.ObjectLockConfiguration;
  const d = lock?.Rule?.DefaultRetention;
  const sse = (Array.isArray(enc) && enc.length === 1)
    ? enc[0].ApplyServerSideEncryptionByDefault : null;
  const kmsOK = kmsArn
    ? sse?.SSEAlgorithm === 'aws:kms' && sse?.KMSMasterKeyID === kmsArn
    : sse?.SSEAlgorithm === 'AES256';
  return [
    check(label + '_REGION_MATCH', locationOK(b?.location, region)),
    check(label + '_PUBLIC_ACCESS_BLOCK', isAllPublicBlocked(block)),
    check(label + '_OWNERSHIP_ENFORCED', Array.isArray(owners) &&
      owners.length === 1 && owners[0].ObjectOwnership === 'BucketOwnerEnforced'),
    check(label + '_VERSIONING_ENABLED', b?.versioning?.Status === 'Enabled'),
    check(label + '_ENCRYPTION_EXPECTED', kmsOK),
    check(label + '_OBJECT_LOCK_RETENTION', lock?.ObjectLockEnabled === 'Enabled' &&
      ['GOVERNANCE','COMPLIANCE'].includes(d?.Mode) &&
      Number(d?.Days) === retentionDays),
    check(label + '_BUCKET_POLICY_PRIVATE', b?.policyStatus?.PolicyStatus?.IsPublic === false),
    check(label + '_TLS_DENY_NON_SERVICE', matchesSecurePolicy(b?.bucketPolicy?.Policy, arn)),
    ...(kmsArn ? [check('EVIDENCE_EXPLICIT_SSE_KMS_DENY',
      matchesEvidenceSsePolicy(b?.bucketPolicy?.Policy, arn, kmsArn))] : [])
  ];
};

export function evaluateB04S3ReadOnlySnapshot(x, expected) {
  const {
    accountId, region, partition, evidenceBucket, auditBucket, trailName, kmsKeyArn,
    evidenceRetentionDays, auditRetentionDays
  } = expected || {};
  if (!x || typeof x !== 'object' || Array.isArray(x) ||
    !ACCOUNT.test(accountId || '') || !REGION.test(region || '') ||
    !['aws','aws-cn','aws-us-gov'].includes(partition) ||
    !evidenceBucket || !auditBucket || evidenceBucket === auditBucket ||
    !trailName || !Number.isInteger(evidenceRetentionDays) || evidenceRetentionDays <= 0 ||
    !Number.isInteger(auditRetentionDays) || auditRetentionDays <= 0 ||
    !new RegExp('^arn:' + partition + ':kms:' + region + ':' + accountId + ':key/').test(kmsKeyArn || '')) {
    throw Error('Protected approved AWS account/region/bucket/retention/KMS expectations required');
  }
  const evidenceArn = 'arn:' + partition + ':s3:::' + evidenceBucket;
  const auditArn = 'arn:' + partition + ':s3:::' + auditBucket;
  const trailArn = 'arn:' + partition + ':cloudtrail:' + region + ':' + accountId + ':trail/' + trailName;
  const identity = x.identity;
  const trails = x.trailDescription?.trailList;
  const trail = Array.isArray(trails) && trails.length === 1 ? trails[0] : null;
  const status = x.trailStatus;
  const selectors = x.eventSelectors;
  const matchesTrail = trail?.Name === trailName && trail.TrailARN === trailArn &&
    trail.HomeRegion === region && trail.S3BucketName === auditBucket &&
    absent(trail.S3KeyPrefix);
  const checks = [
    check('AWS_IDENTITY_APPROVED', identity?.Account === accountId &&
      typeof identity?.Arn === 'string' &&
      identity.Arn.startsWith('arn:' + partition + ':') &&
      identity.Arn.includes(':' + accountId + ':')),
    check('ACCOUNT_PUBLIC_ACCESS_BLOCK_ALL_FOUR',
      isAllPublicBlocked(x.accountPublicAccessBlock?.PublicAccessBlockConfiguration)),
    ...bucketChecks('EVIDENCE', x.evidence, region, evidenceRetentionDays,
      { arn: evidenceArn, kmsArn: kmsKeyArn }),
    ...bucketChecks('AUDIT', x.audit, region, auditRetentionDays, { arn: auditArn }),
    check('TRAIL_ACCOUNT_REGION_AUDIT_DESTINATION_MATCH', matchesTrail),
    check('TRAIL_LOG_FILE_VALIDATION', matchesTrail && trail.LogFileValidationEnabled === true),
    check('TRAIL_LOGGING', matchesTrail && status?.IsLogging === true),
    check('TRAIL_NO_REPORTED_S3_DELIVERY_ERRORS', matchesTrail &&
      absent(status?.LatestDeliveryError) && absent(status?.LatestDigestDeliveryError)),
    check('TRAIL_SOURCE_BOUND_S3_READ_WRITE', matchesTrail &&
      selectors?.TrailARN === trailArn && Array.isArray(selectors.EventSelectors) &&
      selectors.EventSelectors.some(s => s.ReadWriteType === 'All' &&
        Array.isArray(s.DataResources) && s.DataResources.some(r =>
          r.Type === 'AWS::S3::Object' && Array.isArray(r.Values) &&
          r.Values.includes(evidenceArn + '/'))) &&
      (!Array.isArray(selectors.AdvancedEventSelectors) || selectors.AdvancedEventSelectors.length === 0))
  ];
  return {
    schemaVersion: 'b04-aws-s3-readonly-config-observation-v2',
    recordKind: 'RESTRICTED_CLOUD_CONFIG_OBSERVATION_NOT_GATE_A_APPROVAL',
    scope: 'B04_STORE_CONFIGURATION_ONLY',
    classification: 'RESTRICTED_INTERNAL_NOT_FOR_PUBLIC_GIT',
    provider: 'AWS_S3_REFERENCE_CANDIDATE_NOT_OWNER_SELECTED',
    checks,
    readyForHumanReview: checks.every(s => s.status === 'PASS_CONFIG_ONLY'),
    pendingExternalProof: [
      'ROLE_BOUND_IAM_KMS_LEAST_PRIVILEGE',
      'DENIED_READ_WRITE_TEST_FROM_UNAUTHORIZED_PRINCIPAL',
      'OBJECT_LEVEL_AUDIT_EVENT_CORRELATION',
      'ACTUAL_VERSION_RESTORE_AND_RETENTION_PURGE_PROOF',
      'SQL_RUNTIME_MIGRATOR_IDENTITY_SEPARATION',
      'FAULT_INJECTION_BOUNDARY_AND_CLEANUP_APPROVAL',
      'FINANCE_SAFETY_SCOPE_ASSESSMENT',
      'TECHNICAL_QA_OPERATIONS_SECURITY_ROLE_APPROVAL',
      'OWNER_GATE_A_DECISION'
    ],
    gateA: 'NOT_READY', gateB: 'BLOCKED',
    productVerified: false, tenantGoLiveAccepted: false
  };
}

function awsJson(args) {
  const result = spawnSync('aws', [...args, '--output','json','--no-cli-pager'], {
    encoding:'utf8', timeout:20000, maxBuffer:1_000_000,
    stdio:['ignore','pipe','pipe']
  });
  if (result.error || result.status !== 0) throw Error('Protected AWS read-only preflight failed on one required control');
  try { return JSON.parse(result.stdout); }
  catch { throw Error('Protected AWS read-only preflight returned invalid JSON'); }
}

export function collectB04S3Snapshot(aws, { evidenceBucket, auditBucket, trailName, accountId, region }) {
  if (typeof aws !== 'function' || !evidenceBucket || !auditBucket || !trailName ||
      !ACCOUNT.test(accountId || '') || !REGION.test(region || '')) {
    throw Error('Protected account/buckets/trail/region must be specified');
  }
  const call = args => aws([...args, '--region',region]);
  const s3 = (verb,name) => call(['s3api',verb,'--bucket',name,'--expected-bucket-owner',accountId]);
  const bucket = name => ({
    publicAccessBlock: s3('get-public-access-block',name),
    ownership: s3('get-bucket-ownership-controls',name),
    versioning: s3('get-bucket-versioning',name),
    encryption: s3('get-bucket-encryption',name),
    objectLock: s3('get-object-lock-configuration',name),
    policyStatus: s3('get-bucket-policy-status',name),
    bucketPolicy: s3('get-bucket-policy',name),
    location: s3('get-bucket-location',name)
  });
  return {
    identity: call(['sts','get-caller-identity']),
    accountPublicAccessBlock: call(['s3control','get-public-access-block','--account-id',accountId]),
    evidence: bucket(evidenceBucket),
    audit: bucket(auditBucket),
    trailDescription: call(['cloudtrail','describe-trails','--trail-name-list',trailName,
      '--no-include-shadow-trails']),
    trailStatus: call(['cloudtrail','get-trail-status','--name',trailName]),
    eventSelectors: call(['cloudtrail','get-event-selectors','--trail-name',trailName])
  };
}

export function assertProtectedOutput(target) {
  const p = path.resolve(target);
  const parts = p.split(path.sep);
  if (!parts.includes('private-evidence') || fs.existsSync(p) ||
      !fs.existsSync(path.dirname(p)) || !fs.statSync(path.dirname(p)).isDirectory()) {
    throw Error('Output must be new and under protected private-evidence/');
  }
  const realParent = fs.realpathSync(path.dirname(p));
  if (!realParent.split(path.sep).includes('private-evidence'))
    throw Error('Protected output must not escape via symlink');
  return p;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--restricted')
    throw Error('Usage: node tools/evidence/b04-aws-s3-preflight.mjs --restricted private-evidence/observation.json');
  if (process.env.GITHUB_ACTIONS === 'true') throw Error('Restricted cloud inspection forbidden in public CI');
  const out = assertProtectedOutput(process.argv[3]);
  const expected = {
    evidenceBucket: process.env.MYDMS_B04_EVIDENCE_BUCKET,
    auditBucket: process.env.MYDMS_B04_AUDIT_BUCKET,
    trailName: process.env.MYDMS_B04_AUDIT_TRAIL,
    accountId: process.env.MYDMS_B04_APPROVED_AWS_ACCOUNT,
    region: process.env.MYDMS_B04_APPROVED_AWS_REGION,
    partition: process.env.MYDMS_B04_AWS_PARTITION,
    kmsKeyArn: process.env.MYDMS_B04_EXPECTED_KMS_KEY_ARN,
    evidenceRetentionDays: Number(process.env.MYDMS_B04_APPROVED_RETENTION_DAYS),
    auditRetentionDays: Number(process.env.MYDMS_B04_APPROVED_AUDIT_RETENTION_DAYS)
  };
  // Validate public-safe shapes BEFORE any credentialed read-only AWS invocation.
  if (!SHA40.test(process.env.MYDMS_B04_SOURCE_SHA || '') ||
      !ACCOUNT.test(expected.accountId || '') || !REGION.test(expected.region || '') ||
      !['aws','aws-cn','aws-us-gov'].includes(expected.partition) ||
      !expected.evidenceBucket || !expected.auditBucket ||
      expected.evidenceBucket === expected.auditBucket || !expected.trailName ||
      !Number.isInteger(expected.evidenceRetentionDays) || expected.evidenceRetentionDays < 1 ||
      !Number.isInteger(expected.auditRetentionDays) || expected.auditRetentionDays < 1 ||
      !(expected.kmsKeyArn || '').startsWith(
        'arn:' + expected.partition + ':kms:' + expected.region + ':' + expected.accountId + ':key/')) {
    throw Error('Owner-approved source SHA, provider identity, buckets, KMS and retentions required');
  }
  // Every S3 query specifies --expected-bucket-owner; every AWS call pins the approved Region.
  const observations = collectB04S3Snapshot(awsJson, expected);
  const report = evaluateB04S3ReadOnlySnapshot(observations, expected);
  fs.writeFileSync(out, JSON.stringify({
    ...report, sourceSha: process.env.MYDMS_B04_SOURCE_SHA,
    observedAt: new Date().toISOString()
  },null,2) + '\n', { flag:'wx', mode:0o600 });
  console.log(JSON.stringify({
    status:'RESTRICTED_CONFIG_OBSERVED_NOT_APPROVED',
    passConfigChecks:report.checks.filter(s=>s.status==='PASS_CONFIG_ONLY').length,
    totalConfigChecks:report.checks.length, gateA:'NOT_READY', gateB:'BLOCKED'
  }));
}
