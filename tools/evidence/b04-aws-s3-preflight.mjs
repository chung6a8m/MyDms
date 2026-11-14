import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SHA40 = /^[a-f0-9]{40}$/;
const REQUIRED_FLAGS = ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'];
const status = (id, ok) => ({ id, status: ok ? 'PASS_CONFIG_ONLY' : 'PENDING_CONFIGURATION_OR_PROOF' });

function matchesSecurePolicy(document, bucketArn) {
  try {
    const p = typeof document === 'string' ? JSON.parse(document) : document;
    if (!Array.isArray(p?.Statement)) return false;
    const denies = p.Statement.filter(x => x.Effect === 'Deny' &&
      x.Principal === '*' && (x.Action === 's3:*' || x.Action?.includes?.('s3:*')) &&
      Array.isArray(x.Resource) && x.Resource.includes(bucketArn) &&
      x.Resource.includes(bucketArn + '/*'));
    const tls = denies.some(x => String(x.Condition?.Bool?.['aws:SecureTransport']) === 'false');
    const minTls = denies.some(x => Number(x.Condition?.NumericLessThan?.['s3:TlsVersion']) === 1.2);
    return tls && minTls;
  } catch {
    return false;
  }
}

export function evaluateB04S3ReadOnlySnapshot(x, { bucketArn, retentionDays } = {}) {
  if (!x || typeof x !== 'object' || Array.isArray(x) ||
      typeof bucketArn !== 'string' || !bucketArn.startsWith('arn:') ||
      !Number.isInteger(retentionDays) || retentionDays <= 0) {
    throw Error('Invalid protected preflight inputs');
  }
  const pab = x.publicAccessBlock?.PublicAccessBlockConfiguration;
  const owned = x.ownership?.OwnershipControls?.Rules;
  const sse = x.encryption?.ServerSideEncryptionConfiguration?.Rules;
  const rule = x.objectLock?.ObjectLockConfiguration;
  const bucketPolicyStatus = x.policyStatus?.PolicyStatus;
  const events = x.eventSelectors?.EventSelectors;
  const lock = rule?.Rule?.DefaultRetention;
  const checks = [
    status('PUBLIC_ACCESS_BLOCK_ALL_FOUR', REQUIRED_FLAGS.every(k => pab?.[k] === true)),
    status('BUCKET_OWNER_ENFORCED', Array.isArray(owned) && owned.some(q => q.ObjectOwnership === 'BucketOwnerEnforced')),
    status('VERSIONING_ENABLED', x.versioning?.Status === 'Enabled'),
    status('SSE_KMS_DEFAULT', Array.isArray(sse) && sse.some(q =>
      q.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'aws:kms' &&
      typeof q.ApplyServerSideEncryptionByDefault?.KMSMasterKeyID === 'string' &&
      q.ApplyServerSideEncryptionByDefault.KMSMasterKeyID.length > 10)),
    status('OBJECT_LOCK_DEFAULT_RETENTION', rule?.ObjectLockEnabled === 'Enabled' &&
      ['GOVERNANCE','COMPLIANCE'].includes(lock?.Mode) &&
      Number(lock?.Days) === retentionDays),
    status('BUCKET_POLICY_NON_PUBLIC', bucketPolicyStatus?.IsPublic === false),
    status('DENY_INSECURE_TRANSPORT_TLS_BELOW_12',
      matchesSecurePolicy(x.bucketPolicy?.Policy, bucketArn)),
    status('CLOUDTRAIL_LOGGING', x.trailStatus?.IsLogging === true),
    status('CLOUDTRAIL_S3_OBJECT_READ_WRITE_EVENTS', Array.isArray(events) &&
      events.some(z => z.ReadWriteType === 'All' &&
        Array.isArray(z.DataResources) && z.DataResources.some(d =>
          d.Type === 'AWS::S3::Object' && Array.isArray(d.Values) &&
          d.Values.some(v => v === bucketArn + '/'))))
  ];
  return {
    schemaVersion: 'b04-aws-s3-readonly-config-observation-v1',
    recordKind: 'RESTRICTED_CLOUD_CONFIG_OBSERVATION_NOT_GATE_A_APPROVAL',
    scope: 'B04_STORE_CONFIGURATION_ONLY',
    classification: 'RESTRICTED_INTERNAL_NOT_FOR_PUBLIC_GIT',
    provider: 'AWS_S3_REFERENCE_CANDIDATE',
    checks,
    readyForHumanReview: checks.every(z => z.status === 'PASS_CONFIG_ONLY'),
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
    gateA: 'NOT_READY',
    gateB: 'BLOCKED',
    productVerified: false,
    tenantGoLiveAccepted: false
  };
}

function awsJson(args) {
  const result = spawnSync('aws', [...args, '--output', 'json', '--no-cli-pager'], {
    encoding: 'utf8', timeout: 20000, maxBuffer: 1_000_000,
    stdio: ['ignore','pipe','pipe']
  });
  // Provider output, resource names, authorization errors and URLs are not exposed to public logs.
  if (result.error || result.status !== 0) throw Error('Protected AWS read-only preflight failed on one required control');
  try { return JSON.parse(result.stdout); }
  catch { throw Error('Protected AWS read-only preflight returned invalid JSON'); }
}

export function collectB04S3Snapshot(aws, { bucket, trail }) {
  if (typeof aws !== 'function' || !bucket || !trail) throw Error('Missing protected store/trail references');
  return {
    publicAccessBlock: aws(['s3api','get-public-access-block','--bucket',bucket]),
    ownership: aws(['s3api','get-bucket-ownership-controls','--bucket',bucket]),
    versioning: aws(['s3api','get-bucket-versioning','--bucket',bucket]),
    encryption: aws(['s3api','get-bucket-encryption','--bucket',bucket]),
    objectLock: aws(['s3api','get-object-lock-configuration','--bucket',bucket]),
    policyStatus: aws(['s3api','get-bucket-policy-status','--bucket',bucket]),
    bucketPolicy: aws(['s3api','get-bucket-policy','--bucket',bucket]),
    trailStatus: aws(['cloudtrail','get-trail-status','--name',trail]),
    eventSelectors: aws(['cloudtrail','get-event-selectors','--trail-name',trail])
  };
}

export function assertProtectedOutput(target) {
  const p = path.resolve(target);
  // Reject symlinked working directory and pre-existing targets.
  const parts = p.split(path.sep);
  if (!parts.includes('private-evidence') ||
      fs.existsSync(p) || !fs.existsSync(path.dirname(p)) ||
      !fs.statSync(path.dirname(p)).isDirectory()) {
    throw Error('Output must be a new file in an existing protected private-evidence/ folder');
  }
  const parentReal = fs.realpathSync(path.dirname(p));
  if (!parentReal.split(path.sep).includes('private-evidence'))
    throw Error('Protected folder must not escape through symlink');
  return p;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--restricted')
    throw Error('Usage: node tools/evidence/b04-aws-s3-preflight.mjs --restricted private-evidence/observation.json');
  if (process.env.GITHUB_ACTIONS === 'true') throw Error('Restricted cloud inspection forbidden in public CI');
  const output = assertProtectedOutput(process.argv[3]);
  const bucket = process.env.MYDMS_B04_EVIDENCE_BUCKET;
  const trail = process.env.MYDMS_B04_AUDIT_TRAIL;
  const sourceSha = process.env.MYDMS_B04_SOURCE_SHA;
  const retention = Number(process.env.MYDMS_B04_APPROVED_RETENTION_DAYS);
  if (!bucket || !trail || !SHA40.test(sourceSha || '') ||
      !Number.isInteger(retention) || retention <= 0) {
    throw Error('Missing provider identifiers, exact source SHA or Owner-approved retention period in protected environment');
  }
  // The account/partition is read only and stored neither in this record nor stdout.
  const sts = awsJson(['sts','get-caller-identity']);
  const partition = /^arn:([^:]+):/.exec(sts.Arn || '')?.[1];
  if (!partition) throw Error('Could not verify authenticated AWS partition');
  const bucketArn = 'arn:' + partition + ':s3:::' + bucket;
  const observations = collectB04S3Snapshot(awsJson, { bucket, trail });
  const report = evaluateB04S3ReadOnlySnapshot(observations, {
    bucketArn, retentionDays: retention
  });
  const outputRecord = {
    ...report, sourceSha, observedAt: new Date().toISOString()
  };
  fs.writeFileSync(output, JSON.stringify(outputRecord,null,2) + '\n', {
    flag: 'wx', mode: 0o600
  });
  console.log(JSON.stringify({ status: 'RESTRICTED_CONFIG_OBSERVED_NOT_APPROVED',
    passConfigChecks: report.checks.filter(x => x.status === 'PASS_CONFIG_ONLY').length,
    totalConfigChecks: report.checks.length,
    gateA: 'NOT_READY', gateB: 'BLOCKED' }));
}
