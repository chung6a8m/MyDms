import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  collectB04S3Snapshot, evaluateB04S3ReadOnlySnapshot
} from '../../tools/evidence/b04-aws-s3-preflight.mjs';

const bucketArn='arn:aws:s3:::synthetic-b04-bucket';
const policy={
  Version:'2012-10-17',
  Statement:[
    {Effect:'Deny',Principal:'*',Action:'s3:*',Resource:[bucketArn,bucketArn+'/*'],
      Condition:{Bool:{'aws:SecureTransport':'false'}}},
    {Effect:'Deny',Principal:'*',Action:'s3:*',Resource:[bucketArn,bucketArn+'/*'],
      Condition:{NumericLessThan:{'s3:TlsVersion':1.2}}}
  ]
};
function mockSnapshot() {
  return {
    publicAccessBlock:{PublicAccessBlockConfiguration:{
      BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,RestrictPublicBuckets:true
    }},
    ownership:{OwnershipControls:{Rules:[{ObjectOwnership:'BucketOwnerEnforced'}]}},
    versioning:{Status:'Enabled'},
    encryption:{ServerSideEncryptionConfiguration:{Rules:[{
      ApplyServerSideEncryptionByDefault:{SSEAlgorithm:'aws:kms',KMSMasterKeyID:'arn:aws:kms:region:account:key/mock'}
    }]}},
    objectLock:{ObjectLockConfiguration:{ObjectLockEnabled:'Enabled',
      Rule:{DefaultRetention:{Mode:'GOVERNANCE',Days:90}}}},
    policyStatus:{PolicyStatus:{IsPublic:false}},
    bucketPolicy:{Policy:JSON.stringify(policy)},
    trailStatus:{IsLogging:true},
    eventSelectors:{EventSelectors:[{ReadWriteType:'All',
      DataResources:[{Type:'AWS::S3::Object',Values:[bucketArn+'/']}]}]}
  };
}
const assess=x=>evaluateB04S3ReadOnlySnapshot(x,{bucketArn,retentionDays:90});
const failures=x=>assess(x).checks.filter(z=>z.status!=='PASS_CONFIG_ONLY').map(z=>z.id);

test('all synthetic cloud configuration passes, yet Gate A is NOT_READY',()=>{
  const r=assess(mockSnapshot());
  assert.equal(r.checks.length,9);
  assert.ok(r.checks.every(z=>z.status==='PASS_CONFIG_ONLY'));
  assert.equal(r.readyForHumanReview,true);
  assert.equal(r.gateA,'NOT_READY');
  assert.equal(r.productVerified,false);
  assert.ok(r.pendingExternalProof.includes('DENIED_READ_WRITE_TEST_FROM_UNAUTHORIZED_PRINCIPAL'));
});
test('public access controls must all be enabled',()=>{
  const x=mockSnapshot();x.publicAccessBlock.PublicAccessBlockConfiguration.BlockPublicPolicy=false;
  assert.ok(failures(x).includes('PUBLIC_ACCESS_BLOCK_ALL_FOUR'));
});
test('bucket owner enforcement is required',()=>{
  const x=mockSnapshot();x.ownership.OwnershipControls.Rules[0].ObjectOwnership='ObjectWriter';
  assert.ok(failures(x).includes('BUCKET_OWNER_ENFORCED'));
});
test('missing versioning or object lock stays pending',()=>{
  const x=mockSnapshot();x.versioning.Status='Suspended';
  x.objectLock.ObjectLockConfiguration.Rule.DefaultRetention.Days=1;
  assert.ok(failures(x).includes('VERSIONING_ENABLED'));
  assert.ok(failures(x).includes('OBJECT_LOCK_DEFAULT_RETENTION'));
});
test('SSE-S3 alone is not enough for proposed SSE-KMS candidate',()=>{
  const x=mockSnapshot();
  x.encryption.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm='AES256';
  assert.ok(failures(x).includes('SSE_KMS_DEFAULT'));
});
test('public bucket status is rejected',()=>{
  const x=mockSnapshot();x.policyStatus.PolicyStatus.IsPublic=true;
  assert.ok(failures(x).includes('BUCKET_POLICY_NON_PUBLIC'));
});
test('missing explicit TLS controls is rejected',()=>{
  const x=mockSnapshot();x.bucketPolicy.Policy='{"Statement":[]}';
  assert.ok(failures(x).includes('DENY_INSECURE_TRANSPORT_TLS_BELOW_12'));
});
test('CloudTrail logging off or missing S3 object events is rejected',()=>{
  const x=mockSnapshot();x.trailStatus.IsLogging=false;
  x.eventSelectors.EventSelectors[0].ReadWriteType='WriteOnly';
  assert.ok(failures(x).includes('CLOUDTRAIL_LOGGING'));
  assert.ok(failures(x).includes('CLOUDTRAIL_S3_OBJECT_READ_WRITE_EVENTS'));
});
test('invalid expected retention cannot self-authorize',()=>{
  assert.throws(()=>evaluateB04S3ReadOnlySnapshot(mockSnapshot(),{bucketArn,retentionDays:0}));
});
test('collector uses only read-only AWS API commands',()=>{
  const issued=[];
  const fake= args=> {issued.push(args); return {mock:true}; };
  collectB04S3Snapshot(fake,{bucket:'synthetic-b04-bucket',trail:'synthetic-b04-trail'});
  assert.equal(issued.length,9);
  for(const args of issued) {
    assert.ok(/^get-/.test(args[1]),'No write/delete/list unsafe mutation permitted');
    assert.ok(!args.some(s=>/password|secret|token/i.test(s)));
  }
});
test('public CI refuses protected AWS CLI before querying credentials or network',()=>{
  const r=spawnSync(process.execPath,['tools/evidence/b04-aws-s3-preflight.mjs','--restricted',
    'private-evidence/test.json'],{encoding:'utf8',env:{...process.env,GITHUB_ACTIONS:'true'}});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Restricted cloud inspection forbidden in public CI/);
});
