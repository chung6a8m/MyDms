import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PINNED_SQL_2022_DIGEST = 'sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f';
const SHA40 = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const expectedKeys = ['result','classification','imageId','imagePinnedDigest','sourceHeadSha',
  'testedCheckoutSha','ciRunId','networkIsolation','negativeEgressProbe','hostPublishedPorts',
  'containerAndNetworkCleanupVerified','realBusinessTests','productVerified'];

export function validateSqlInfraEvidence(payload, { sourceSha, checkoutSha } = {}) {
  const must = (ok, reason) => { if (!ok) throw Error(reason); };
  must(payload && typeof payload === 'object' && !Array.isArray(payload), 'Infra metadata must be an object');
  must(Object.keys(payload).sort().join('|') === expectedKeys.slice().sort().join('|'),
    'Unknown/missing infra metadata field');
  must(payload.result === 'INFRA_SQL_READY_ONLY' &&
    payload.classification === 'PUBLIC_SYNTHETIC_METADATA_ONLY',
    'Only synthetic SQL infrastructure evidence permitted');
  must(SHA256.test(payload.imageId) && payload.imagePinnedDigest === PINNED_SQL_2022_DIGEST,
    'SQL image digest or image ID invalid');
  must(SHA40.test(payload.sourceHeadSha) && SHA40.test(payload.testedCheckoutSha),
    'Exact source and checkout SHA required');
  if (sourceSha !== undefined) must(payload.sourceHeadSha === sourceSha, 'Source SHA mismatch');
  if (checkoutSha !== undefined) must(payload.testedCheckoutSha === checkoutSha, 'Checkout SHA mismatch');
  must(typeof payload.ciRunId === 'string' && /^\d+$/.test(payload.ciRunId),
    'Valid CI run ID required');
  must(payload.networkIsolation === 'DOCKER_INTERNAL_BRIDGE_NEGATIVE_PROBE' &&
    payload.negativeEgressProbe === 'DENIED_TEST_NET_198_51_100_1_PORT_443' &&
    payload.hostPublishedPorts === 0 && payload.containerAndNetworkCleanupVerified === true,
    'Network/cleanup safety checks not evidenced');
  must(payload.realBusinessTests === 0 && payload.productVerified === false,
    'Infrastructure check cannot assert business/product verification');
  return { status: 'PASS_SQL_INFRA_SYNTHETIC_METADATA_ONLY',
    sourceSha: payload.sourceHeadSha,
    productVerified: false, gateA: 'NOT_READY' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw Error('Usage: node tools/ci/verify-sql-infra-evidence.mjs <artifact.json>');
  const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(validateSqlInfraEvidence(payload, {
    sourceSha: process.env.MYDMS_SOURCE_HEAD_SHA,
    checkoutSha: process.env.GITHUB_SHA
  })));
}
