import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'infra/b04/aws-s3/evidence-store.template.json';
const t = JSON.parse(fs.readFileSync(path,'utf8'));
const resources=t.Resources;
const bucketNames=['EvidenceBucket','AuditBucket'];

test('CloudFormation reference has explicit owner parameters; no implicit retention defaults',()=>{
  assert.equal(t.AWSTemplateFormatVersion,'2010-09-09');
  for(const key of ['EvidenceBucketName','AuditBucketName','TrailName',
    'RetentionMode','EvidenceRetentionDays','AuditRetentionDays']){
    assert.ok(t.Parameters[key],key);
    assert.equal('Default' in t.Parameters[key],false,'Must require Owner input: '+key);
  }
  assert.deepEqual(t.Parameters.RetentionMode.AllowedValues,['GOVERNANCE','COMPLIANCE']);
  assert.equal(t.Parameters.EvidenceRetentionDays.MinValue,1);
  assert.equal(t.Parameters.AuditRetentionDays.MinValue,1);
});
test('evidence and audit buckets are private, encrypted, versioned and retained',()=>{
  for(const name of bucketNames){
    const b=resources[name];
    assert.equal(b.Type,'AWS::S3::Bucket');
    assert.equal(b.DeletionPolicy,'Retain');
    assert.equal(b.UpdateReplacePolicy,'Retain');
    assert.equal(b.Properties.ObjectLockEnabled,true);
    assert.equal(b.Properties.ObjectLockConfiguration.ObjectLockEnabled,'Enabled');
    assert.equal(b.Properties.VersioningConfiguration.Status,'Enabled');
    for(const field of ['BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets'])
      assert.equal(b.Properties.PublicAccessBlockConfiguration[field],true);
    assert.equal(b.Properties.OwnershipControls.Rules[0].ObjectOwnership,'BucketOwnerEnforced');
    assert.equal(b.Properties.BucketEncryption.ServerSideEncryptionConfiguration.length,1);
  }
});
test('evidence data requires customer-managed KMS and rotation',()=>{
  assert.equal(resources.EvidenceKmsKey.Properties.EnableKeyRotation,true);
  assert.equal(resources.EvidenceKmsKey.DeletionPolicy,'Retain');
  const sse=resources.EvidenceBucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration[0];
  assert.equal(sse.ServerSideEncryptionByDefault.SSEAlgorithm,'aws:kms');
  assert.deepEqual(sse.ServerSideEncryptionByDefault.KMSMasterKeyID,
    {'Fn::GetAtt':['EvidenceKmsKey','Arn']});
});
test('audit bucket permits CloudTrail only through scoped service policy and denies insecure TLS',()=>{
  const list=resources.AuditBucketPolicy.Properties.PolicyDocument.Statement;
  const writer=list.find(q=>q.Sid==='AWSCloudTrailWrite');
  assert.equal(writer.Effect,'Allow');
  assert.deepEqual(writer.Principal,{Service:'cloudtrail.amazonaws.com'});
  assert.ok(writer.Condition.StringEquals['aws:SourceArn']);
  assert.ok(writer.Condition.StringEquals['s3:x-amz-acl']);
  assert.ok(list.some(q=>q.Sid==='DenyInsecureTransport' && q.Effect==='Deny'));
  assert.ok(list.some(q=>q.Sid==='DenyTLSBelow12' && q.Effect==='Deny'));
});
test('evidence bucket disallows insecure TLS',()=>{
  const list=resources.EvidenceBucketPolicy.Properties.PolicyDocument.Statement;
  assert.ok(list.find(q=>q.Sid==='DenyInsecureTransport' && q.Effect==='Deny'));
  assert.ok(list.find(q=>q.Sid==='DenyTLSBelow12' && q.Effect==='Deny'));
});
test('CloudTrail has object-level read/write events and log-file validation',()=>{
  const trail=resources.EvidenceObjectTrail;
  assert.equal(trail.Type,'AWS::CloudTrail::Trail');
  assert.equal(trail.Properties.IsLogging,true);
  assert.equal(trail.Properties.EnableLogFileValidation,true);
  assert.equal(trail.Properties.EventSelectors[0].ReadWriteType,'All');
  const target=trail.Properties.EventSelectors[0].DataResources[0];
  assert.equal(target.Type,'AWS::S3::Object');
  assert.deepEqual(target.Values,[{'Fn::Sub':'${EvidenceBucket.Arn}/'}]);
});
test('template does not silently provision identities or modify approved product baseline',()=>{
  for(const [name,x] of Object.entries(resources)){
    assert.ok(!x.Type.startsWith('AWS::IAM::Role'),name);
    assert.ok(!x.Type.startsWith('AWS::IAM::User'),name);
  }
  assert.equal(Object.keys(resources).length,6);
});


test('SEC-01: both TLS denials exempt AWS service principal while preserving CloudTrail SourceArn',()=>{
  for(const name of ['EvidenceBucketPolicy','AuditBucketPolicy']){
    const statements=resources[name].Properties.PolicyDocument.Statement;
    const transport=statements.find(s=>s.Sid==='DenyInsecureTransport');
    assert.equal(transport.Condition.Bool['aws:SecureTransport'],'false');
    assert.equal(transport.Condition.Bool['aws:PrincipalIsAWSService'],'false');
    const tls=statements.find(s=>s.Sid==='DenyTLSBelow12');
    assert.equal(tls.Condition.NumericLessThan['s3:TlsVersion'],1.2);
    assert.deepEqual(tls.Condition.Bool,{'aws:PrincipalIsAWSService':'false'});
  }
  const audit=resources.AuditBucketPolicy.Properties.PolicyDocument.Statement;
  for(const id of ['AWSCloudTrailAclCheck','AWSCloudTrailWrite']){
    const s=audit.find(x=>x.Sid===id);
    assert.equal(s.Principal.Service,'cloudtrail.amazonaws.com');
    assert.ok(s.Condition.StringEquals['aws:SourceArn']);
  }
});

test('SEC-02: explicit non-KMS, wrong KMS key, missing key and SSE-C must be denied',()=>{
 const evidence=resources.EvidenceBucketPolicy.Properties.PolicyDocument.Statement;
 const target={'Fn::Sub':'${EvidenceBucket.Arn}/*'};
 const actions=[
  'DenyExplicitNonKmsEncryption',
  'DenyExplicitKmsWithoutKey',
  'DenyExplicitKmsKeyWithoutAlgorithm',
  'DenyExplicitNonApprovedKmsKey',
  'DenyExplicitCustomerProvidedKeys'
 ];
 for(const name of actions){
  const statement=evidence.find(s=>s.Sid===name);
  assert.equal(statement.Effect,'Deny');
  assert.equal(statement.Principal,'*');
  assert.equal(statement.Action,'s3:PutObject');
  assert.deepEqual(statement.Resource,[target]);
 }
 const keyStmt=evidence.find(s=>s.Sid==='DenyExplicitNonApprovedKmsKey');
 assert.deepEqual(keyStmt.Condition.StringNotEquals['s3:x-amz-server-side-encryption-aws-kms-key-id'],
  {'Fn::GetAtt':['EvidenceKmsKey','Arn']});
 const headerStmt=evidence.find(s=>s.Sid==='DenyExplicitNonKmsEncryption');
 assert.deepEqual(headerStmt.Condition,{
  Null:{'s3:x-amz-server-side-encryption':'false'},
  StringNotEquals:{'s3:x-amz-server-side-encryption':'aws:kms'}
 });
});

test('CloudFormation never introduces provider deployments or Owner-implied approval in workflow',()=>{
 const workflow=fs.readFileSync('.github/workflows/foundation-ci.yml','utf8');
 assert.ok(!/cloudformation\s+(deploy|execute-change-set|create-stack)/.test(workflow));
 assert.ok(!/aws\s+s3api\s+(put|delete)/.test(workflow));
});
