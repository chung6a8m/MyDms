import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validatePublicSyntheticRecord } from '../../tools/evidence/check-public-synthetic.mjs';

const example = JSON.parse(fs.readFileSync('fixtures/evidence/foundation-public-synthetic.example.json','utf8'));
const bad = mutate => { const v=structuredClone(example); mutate(v); assert.throws(()=>validatePublicSyntheticRecord(v)); };

test('read-only placeholder is accepted, never as execution evidence',()=>{
  assert.equal(validatePublicSyntheticRecord(example).runKind,'EXAMPLE');
});
test('fabricated Product Verification fails closed',()=>bad(x=>{x.productVerified=true}));
test('fake Gate A fails closed',()=>bad(x=>{x.gateA='READY'}));
test('fake reviewer approval fails closed',()=>bad(x=>{x.review={state:'APPROVED',reviewer:'fake',signoffRef:'synthetic'}}));
test('restricted artifact/URI cannot be carried in public metadata',()=>bad(x=>{x.artifacts.push({kind:'SQL_INFRA_METADATA',sha256:'a'.repeat(64),classification:'RESTRICTED_INTERNAL',uri:'https://some-storage.invalid/raw'})}));
test('fabricated run without source attribution fails closed',()=>bad(x=>{x.runKind='SYNTHETIC_CI'}));
test('unknown tenant data field fails closed',()=>bad(x=>{x.tenantId='real-tenant-001'}));
test('B04 unconfigured secure store must remain blocker',()=>bad(x=>{x.blockers=[]}));
test('synthetic CI counters may be observed but never approve EV',()=>{
  const x=structuredClone(example);
  x.recordKind='SYNTHETIC_CI_RUN_NOT_PRODUCT_EV';
  x.runKind='SYNTHETIC_CI';
  x.executionStatus='EXECUTED_UNREVIEWED';
  x.sourceHeadSha='a'.repeat(40);
  x.testedCheckoutSha='b'.repeat(40);
  x.testRunId='SYNTHETIC_ONLY_NOT_ACTUAL';
  x.fixtureHash='c'.repeat(64);
  x.artifacts=[{kind:'UNIT_TEST_COUNTERS',sha256:'d'.repeat(64),classification:'PUBLIC_SYNTHETIC_METADATA_ONLY'}];
  assert.equal(validatePublicSyntheticRecord(x).productVerified,false);
});
