import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// A tiny, deliberately limited IAM condition model for documented deny predicates.
// It is a regression test, NOT an AWS policy simulator or live IAM authorization proof.
const template=JSON.parse(fs.readFileSync('infra/b04/aws-s3/evidence-store.template.json','utf8'));
const statements=template.Resources.EvidenceBucketPolicy.Properties.PolicyDocument.Statement;
const evidenceSse=statements.filter(s=>s.Action==='s3:PutObject');
const actualKmsArn='arn:aws:kms:ap-southeast-1:123456789012:key/approved-test-key';
const ENC='s3:x-amz-server-side-encryption';
const KEY='s3:x-amz-server-side-encryption-aws-kms-key-id';
const CUSTOMER='s3:x-amz-server-side-encryption-customer-algorithm';
const expectedKey={ 'Fn::GetAtt':['EvidenceKmsKey','Arn'] };

function isDeniedBySseGuard(headers) {
  return evidenceSse.some(s=>{
    const condition=s.Condition;
    const entries=Object.entries(condition);
    return entries.every(([operator,predicates])=>Object.entries(predicates).every(([key,v])=>{
      const value=headers[key];
      const actual=(v && typeof v==='object')
        ? (assert.deepEqual(v,expectedKey),actualKmsArn) : v;
      if(operator==='Null') return (value===undefined || value===null) === (actual==='true');
      if(operator==='StringNotEquals') return value!==actual;
      throw Error('Unknown condition operator in restricted SSE security guard: '+operator);
    }));
  });
}
test('exactly five explicit-override deny controls remain present',()=>{
 assert.deepEqual(evidenceSse.map(s=>s.Sid),[
  'DenyExplicitNonKmsEncryption','DenyExplicitKmsWithoutKey',
  'DenyExplicitKmsKeyWithoutAlgorithm','DenyExplicitNonApprovedKmsKey',
  'DenyExplicitCustomerProvidedKeys']);
 for(const s of evidenceSse){
  assert.equal(s.Effect,'Deny');
  assert.equal(s.Principal,'*');
  assert.equal(s.Action,'s3:PutObject');
 }
});
test('default encryption with no supplied SSE headers is not denied',()=>{
 assert.equal(isDeniedBySseGuard({}),false);
});
test('explicit AES256 override is denied',()=>{
 assert.equal(isDeniedBySseGuard({[ENC]:'AES256'}),true);
});
test('explicit aws:kms but missing KMS key is denied (no AWS-managed-key fallback)',()=>{
 assert.equal(isDeniedBySseGuard({[ENC]:'aws:kms'}),true);
});
test('explicit aws:kms with wrong KMS ARN is denied',()=>{
 assert.equal(isDeniedBySseGuard({[ENC]:'aws:kms',[KEY]:'arn:aws:kms:another:key/bad'}),true);
});
test('KMS key ID without explicit aws:kms algorithm is denied',()=>{
 assert.equal(isDeniedBySseGuard({[KEY]:actualKmsArn}),true);
});
test('explicit approved aws:kms key is not denied by these guards',()=>{
 assert.equal(isDeniedBySseGuard({[ENC]:'aws:kms',[KEY]:actualKmsArn}),false);
});
test('explicit customer provided SSE-C encryption is denied',()=>{
 assert.equal(isDeniedBySseGuard({[CUSTOMER]:'AES256'}),true);
});
test('SSE-C override cannot be paired with otherwise allowed SSE-KMS',()=>{
 assert.equal(isDeniedBySseGuard({[CUSTOMER]:'AES256',[ENC]:'aws:kms',[KEY]:actualKmsArn}),true);
});
