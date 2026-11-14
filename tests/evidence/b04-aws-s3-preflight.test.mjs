import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { collectB04S3Snapshot, evaluateB04S3ReadOnlySnapshot, matchesSecurePolicy,
  matchesEvidenceSsePolicy } from '../../tools/evidence/b04-aws-s3-preflight.mjs';

const id='123456789012';
const region='ap-southeast-1';
const partition='aws';
const evidenceBucket='synthetic-b04-evidence';
const auditBucket='synthetic-b04-audit';
const trailName='synthetic-b04-trail';
const evidenceArn='arn:aws:s3:::'+evidenceBucket;
const auditArn='arn:aws:s3:::'+auditBucket;
const kmsKeyArn='arn:aws:kms:'+region+':'+id+':key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const trailArn='arn:aws:cloudtrail:'+region+':'+id+':trail/'+trailName;
const ENC='s3:x-amz-server-side-encryption';
const KEY='s3:x-amz-server-side-encryption-aws-kms-key-id';
const CUSTOMER='s3:x-amz-server-side-encryption-customer-algorithm';
const expected={accountId:id,region,partition,evidenceBucket,auditBucket,trailName,kmsKeyArn,
 evidenceRetentionDays:90,auditRetentionDays:30,retentionMode:'GOVERNANCE'};
const blocked={BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,
 RestrictPublicBuckets:true};
const tls=(arn)=>[
 {Effect:'Deny',Principal:'*',Action:'s3:*',Resource:[arn,arn+'/*'],
  Condition:{Bool:{'aws:SecureTransport':'false','aws:PrincipalIsAWSService':'false'}}},
 {Effect:'Deny',Principal:'*',Action:'s3:*',Resource:[arn,arn+'/*'],
  Condition:{NumericLessThan:{'s3:TlsVersion':1.2},
   Bool:{'aws:PrincipalIsAWSService':'false'}}}
];
const sse=()=>{
 const deny=condition=>({Effect:'Deny',Principal:'*',Action:'s3:PutObject',
  Resource:evidenceArn+'/*',Condition:condition});
 return [
  deny({Null:{[ENC]:'false'},StringNotEquals:{[ENC]:'aws:kms'}}),
  deny({Null:{[ENC]:'false',[KEY]:'true'}}),
  deny({Null:{[ENC]:'true',[KEY]:'false'}}),
  deny({Null:{[KEY]:'false'},StringNotEquals:{[KEY]:kmsKeyArn}}),
  deny({Null:{[CUSTOMER]:'false'}})
 ];
};
const bucket=(arn,days,kms=false)=>({
  publicAccessBlock:{PublicAccessBlockConfiguration:structuredClone(blocked)},
  ownership:{OwnershipControls:{Rules:[{ObjectOwnership:'BucketOwnerEnforced'}]}},
  versioning:{Status:'Enabled'},
  encryption:{ServerSideEncryptionConfiguration:{Rules:[{ApplyServerSideEncryptionByDefault:
   kms?{SSEAlgorithm:'aws:kms',KMSMasterKeyID:kmsKeyArn}:{SSEAlgorithm:'AES256'}}]}},
  objectLock:{ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',
   Rule:{DefaultRetention:{Mode:'GOVERNANCE',Days:days}}}},
  policyStatus:{PolicyStatus:{IsPublic:false}},
  bucketPolicy:{Policy:JSON.stringify({Version:'2012-10-17',
   Statement:[...tls(arn),...(kms?sse():[])]})},
  location:{LocationConstraint:region}
});
const mock=()=>({
 identity:{Account:id,Arn:'arn:aws:sts::'+id+':assumed-role/B04Operator/reviewer'},
 accountPublicAccessBlock:{PublicAccessBlockConfiguration:structuredClone(blocked)},
 evidence:bucket(evidenceArn,90,true),
 audit:bucket(auditArn,30,false),
 trailDescription:{trailList:[{Name:trailName,TrailARN:trailArn,
  HomeRegion:region,S3BucketName:auditBucket,LogFileValidationEnabled:true}]},
 trailStatus:{IsLogging:true,LatestDeliveryError:'',LatestDigestDeliveryError:''},
 eventSelectors:{TrailARN:trailArn,EventSelectors:[{ReadWriteType:'All',
  DataResources:[{Type:'AWS::S3::Object',Values:[evidenceArn+'/']}]}]}
});
const assess=(x=mock())=>evaluateB04S3ReadOnlySnapshot(x,expected);
const pending=(x)=>assess(x).checks.filter(t=>t.status!=='PASS_CONFIG_ONLY').map(t=>t.id);
const mod=fn=>{const x=mock();fn(x);return pending(x);};

test('synthetic fully constrained snapshot is configuration-only; Gate A always NOT_READY',()=>{
 const r=assess();
 assert.equal(r.checks.length,24);
 assert.equal(r.readyForHumanReview,true);
 assert.equal(r.gateA,'NOT_READY');
 assert.equal(r.gateB,'BLOCKED');
 assert.ok(r.pendingExternalProof.includes('OBJECT_LEVEL_AUDIT_EVENT_CORRELATION'));
});
test('wrong STS account/partition is never accepted',()=>{
 assert.ok(mod(x=>{x.identity.Account='999999999999';}).includes('AWS_IDENTITY_APPROVED'));
 assert.ok(mod(x=>{x.identity.Arn='arn:aws:sts::999999999999:assumed-role/x/y';}).includes('AWS_IDENTITY_APPROVED'));
});
test('account-level public access block is mandatory',()=>{
 assert.ok(mod(x=>{x.accountPublicAccessBlock.PublicAccessBlockConfiguration.RestrictPublicBuckets=false;})
  .includes('ACCOUNT_PUBLIC_ACCESS_BLOCK_ALL_FOUR'));
});
test('wrong evidence or audit Region fails closed',()=>{
 assert.ok(mod(x=>{x.evidence.location.LocationConstraint='us-east-1';}).includes('EVIDENCE_REGION_MATCH'));
 assert.ok(mod(x=>{x.audit.location.LocationConstraint='us-east-1';}).includes('AUDIT_REGION_MATCH'));
});
test('public access, ownership, versioning remain mandatory for both buckets',()=>{
 const r=mod(x=>{x.audit.ownership.OwnershipControls.Rules[0].ObjectOwnership='ObjectWriter';
  x.evidence.versioning.Status='Suspended';
  x.audit.publicAccessBlock.PublicAccessBlockConfiguration.BlockPublicPolicy=false;});
 assert.ok(r.includes('AUDIT_OWNERSHIP_ENFORCED'));
 assert.ok(r.includes('EVIDENCE_VERSIONING_ENABLED'));
 assert.ok(r.includes('AUDIT_PUBLIC_ACCESS_BLOCK'));
});
test('evidence must use EXACT expected KMS ARN, and audit AES256',()=>{
 const r=mod(x=>{x.evidence.encryption.ServerSideEncryptionConfiguration.Rules[0]
 .ApplyServerSideEncryptionByDefault.KMSMasterKeyID='arn:aws:kms:other:key/x';
 x.audit.encryption.ServerSideEncryptionConfiguration.Rules[0]
 .ApplyServerSideEncryptionByDefault.SSEAlgorithm='aws:kms';});
 assert.ok(r.includes('EVIDENCE_ENCRYPTION_EXPECTED'));
 assert.ok(r.includes('AUDIT_ENCRYPTION_EXPECTED'));
});
test('object lock and respective approved retention verified on both buckets',()=>{
 const r=mod(x=>{x.audit.objectLock.ObjectLockConfiguration.Rule.DefaultRetention.Days=90;
 x.evidence.objectLock.ObjectLockConfiguration.ObjectLockEnabled='Disabled';});
 assert.ok(r.includes('AUDIT_OBJECT_LOCK_RETENTION'));
 assert.ok(r.includes('EVIDENCE_OBJECT_LOCK_RETENTION'));
 assert.ok(mod(x=>{x.evidence.objectLock.ObjectLockConfiguration.Rule.DefaultRetention.Mode='COMPLIANCE';}).includes('EVIDENCE_OBJECT_LOCK_RETENTION'));
});
test('S3 policy nonpublic and TLS guards on both buckets',()=>{
 const r=mod(x=>{x.audit.policyStatus.PolicyStatus.IsPublic=true;
 x.evidence.bucketPolicy.Policy='{"Statement":[]}';});
 assert.ok(r.includes('AUDIT_BUCKET_POLICY_PRIVATE'));
 assert.ok(r.includes('EVIDENCE_TLS_DENY_NON_SERVICE'));
 assert.ok(r.includes('EVIDENCE_EXPLICIT_SSE_KMS_DENY'));
});
test('SEC-01: a TLS deny lacking the service-principal exception fails',()=>{
 const x=mock(),p=JSON.parse(x.audit.bucketPolicy.Policy);
 delete p.Statement[0].Condition.Bool['aws:PrincipalIsAWSService'];
 x.audit.bucketPolicy.Policy=JSON.stringify(p);
 assert.ok(pending(x).includes('AUDIT_TLS_DENY_NON_SERVICE'));
});
test('SEC-04: extra limiting principal condition causes TLS deny to fail',()=>{
 const x=mock(),p=JSON.parse(x.evidence.bucketPolicy.Policy);
 p.Statement[0].Condition.StringEquals={'aws:PrincipalTag/team':'limited'};
 x.evidence.bucketPolicy.Policy=JSON.stringify(p);
 assert.equal(matchesSecurePolicy(p,evidenceArn),false);
 assert.ok(pending(x).includes('EVIDENCE_TLS_DENY_NON_SERVICE'));
});
test('SEC-04: relaxed TLS version or wildcard resources fail',()=>{
 const p=JSON.parse(mock().audit.bucketPolicy.Policy);
 p.Statement[1].Condition.NumericLessThan['s3:TlsVersion']=1.0;
 assert.equal(matchesSecurePolicy(p,auditArn),false);
 p.Statement[1].Condition.NumericLessThan['s3:TlsVersion']=1.2;
 p.Statement[1].Resource=['*'];
 assert.equal(matchesSecurePolicy(p,auditArn),false);
});
test('SEC-02: missing/extra encryption-override deny is not accepted',()=>{
 const x=mock(), p=JSON.parse(x.evidence.bucketPolicy.Policy);
 p.Statement.pop();
 assert.equal(matchesEvidenceSsePolicy(p,evidenceArn,kmsKeyArn),false);
 x.evidence.bucketPolicy.Policy=JSON.stringify(p);
 assert.ok(pending(x).includes('EVIDENCE_EXPLICIT_SSE_KMS_DENY'));
});
test('SEC-02: overriding encryption deny with principal tag is not accepted',()=>{
 const p=JSON.parse(mock().evidence.bucketPolicy.Policy);
 p.Statement.find(s=>s.Action==='s3:PutObject').Condition.StringEquals={'aws:PrincipalTag/team':'limited'};
 assert.equal(matchesEvidenceSsePolicy(p,evidenceArn,kmsKeyArn),false);
});
test('SEC-03: trail cannot point at another S3 audit bucket',()=>{
 assert.ok(mod(x=>{x.trailDescription.trailList[0].S3BucketName='some-other-audit-bucket';})
  .includes('TRAIL_ACCOUNT_REGION_AUDIT_DESTINATION_MATCH'));
});
test('SEC-03: trail account ARN, HomeRegion and name are checked',()=>{
 for(const prop of ['TrailARN','HomeRegion','Name']) {
  const r=mod(x=>{x.trailDescription.trailList[0][prop]='wrong';});
  assert.ok(r.includes('TRAIL_ACCOUNT_REGION_AUDIT_DESTINATION_MATCH'));
 }
});
test('SEC-03: log file validation mandatory and S3 delivery errors block configuration',()=>{
 const r=mod(x=>{x.trailDescription.trailList[0].LogFileValidationEnabled=false;
 x.trailStatus.LatestDeliveryError='AccessDenied';});
 assert.ok(r.includes('TRAIL_LOG_FILE_VALIDATION'));
 assert.ok(r.includes('TRAIL_NO_REPORTED_S3_DELIVERY_ERRORS'));
});
test('SEC-03: digest failure, trail stopped or selector different ARN fails',()=>{
 const r=mod(x=>{x.trailStatus.IsLogging=false;
 x.trailStatus.LatestDigestDeliveryError='Denied';
 x.eventSelectors.TrailARN='wrong';});
 assert.ok(r.includes('TRAIL_LOGGING'));
 assert.ok(r.includes('TRAIL_NO_REPORTED_S3_DELIVERY_ERRORS'));
 assert.ok(r.includes('TRAIL_SOURCE_BOUND_S3_READ_WRITE'));
});
test('SEC-03: wrong read/write data event resource is rejected',()=>{
 const r=mod(x=>{x.eventSelectors.EventSelectors[0].DataResources[0].Values=[auditArn+'/'];});
 assert.ok(r.includes('TRAIL_SOURCE_BOUND_S3_READ_WRITE'));
});
test('region us-east-1 null and EU legacy location compatibility',()=>{
 const x=mock();
 const e={...expected,region:'us-east-1',kmsKeyArn:'arn:aws:kms:us-east-1:'+id+':key/example'};
 x.evidence.location.LocationConstraint=null;
 x.audit.location.LocationConstraint=null;
 x.evidence.encryption.ServerSideEncryptionConfiguration.Rules[0]
  .ApplyServerSideEncryptionByDefault.KMSMasterKeyID=e.kmsKeyArn;
 assert.ok(!evaluateB04S3ReadOnlySnapshot(x,e).checks.some(s=>
  s.id.endsWith('REGION_MATCH') && s.status!=='PASS_CONFIG_ONLY'));
});
test('operator must provide approved account/region/retention/KMS expectations',()=>{
 assert.throws(()=>evaluateB04S3ReadOnlySnapshot(mock(),{...expected,accountId:'unknown'}));
 assert.throws(()=>evaluateB04S3ReadOnlySnapshot(mock(),{...expected,auditRetentionDays:0}));
 assert.throws(()=>evaluateB04S3ReadOnlySnapshot(mock(),{...expected,retentionMode:'UNSET'}));
 assert.throws(()=>evaluateB04S3ReadOnlySnapshot(mock(),{...expected,kmsKeyArn:'not-an-arn'}));
});
test('protected AWS collection uses ONLY read-only API calls and approved Region',()=>{
 const calls=[];
 collectB04S3Snapshot(args=>{calls.push(args);return {}},{
  accountId:id,region,evidenceBucket,auditBucket,trailName
 });
 assert.equal(calls.length,21);
 assert.ok(calls.some(a=>a[0]==='sts' && a[1]==='get-caller-identity'));
 assert.ok(calls.some(a=>a[0]==='s3control' && a[1]==='get-public-access-block'));
 assert.ok(calls.some(a=>a[0]==='cloudtrail' && a[1]==='describe-trails'));
 for(const args of calls) {
  assert.ok(args[1].startsWith('get-') || args[1]==='describe-trails',
   'No cloud create, update or delete command');
  assert.deepEqual(args.slice(-2),['--region',region]);
  if(args[0]==='s3api') {
    const ownerArg=args.indexOf('--expected-bucket-owner');
    assert.ok(ownerArg>0,'S3 request must bind the approved bucket owner');
    assert.equal(args[ownerArg+1],id);
  }
 }
});
test('public CI refuses protected AWS collection before network access',()=>{
 const r=spawnSync(process.execPath,
  ['tools/evidence/b04-aws-s3-preflight.mjs','--restricted','private-evidence/test.json'],
  {encoding:'utf8',env:{...process.env,GITHUB_ACTIONS:'true'}});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/Restricted cloud inspection forbidden/);
});
