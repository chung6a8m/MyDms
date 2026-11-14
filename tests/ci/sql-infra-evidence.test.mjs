import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PINNED_SQL_2022_DIGEST, validateSqlInfraEvidence }
  from '../../tools/ci/verify-sql-infra-evidence.mjs';

const record = () => ({
  result: 'INFRA_SQL_READY_ONLY',
  classification: 'PUBLIC_SYNTHETIC_METADATA_ONLY',
  imageId: 'sha256:' + 'a'.repeat(64),
  imagePinnedDigest: PINNED_SQL_2022_DIGEST,
  sourceHeadSha: 'b'.repeat(40),
  testedCheckoutSha: 'c'.repeat(40),
  ciRunId: '123456',
  networkIsolation: 'DOCKER_INTERNAL_BRIDGE_NEGATIVE_PROBE',
  negativeEgressProbe: 'DENIED_TEST_NET_198_51_100_1_PORT_443',
  hostPublishedPorts: 0,
  containerAndNetworkCleanupVerified: true,
  realBusinessTests: 0,
  productVerified: false
});
const reject = change => {
  const x=record(); change(x);
  assert.throws(()=>validateSqlInfraEvidence(x));
};
test('valid synthetic-only infra artifact never promotes Gate A',()=>{
  const result=validateSqlInfraEvidence(record(),{sourceSha:'b'.repeat(40), checkoutSha:'c'.repeat(40)});
  assert.equal(result.gateA,'NOT_READY');
});
test('untrusted source SHA fails',()=>assert.throws(
  ()=>validateSqlInfraEvidence(record(), {sourceSha:'d'.repeat(40)})));
test('mutable or alternate image digest rejected',()=>reject(x=>{x.imagePinnedDigest='sha256:'+'e'.repeat(64);}));
test('cleanup must be verified',()=>reject(x=>{x.containerAndNetworkCleanupVerified=false;}));
test('egress probe may not claim unknown result',()=>reject(x=>{x.negativeEgressProbe='NOT_RUN';}));
test('public CI cannot publish real business tests',()=>reject(x=>{x.realBusinessTests=1;}));
test('public CI cannot self-approve Product',()=>reject(x=>{x.productVerified=true;}));
test('public CI rejects raw/sensitive fields',()=>reject(x=>{x.connectionString='secret';}));
test('port publishing fails closed',()=>reject(x=>{x.hostPublishedPorts=1;}));
