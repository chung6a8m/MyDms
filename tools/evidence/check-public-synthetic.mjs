import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const fields = ['schemaVersion','recordKind','runKind','executionStatus','classification','scope','sourceRepository','sourceHeadSha','testedCheckoutSha','testRunId','fixtureHash','artifacts','review','blockers','productVerified','tenantGoLiveAccepted','gateA','gateB','realEvRuns'];

export function validatePublicSyntheticRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Evidence must be an object');
  if (Object.keys(value).sort().join('|') !== [...fields].sort().join('|'))
    throw Error('Unknown/missing evidence properties (fail closed)');
  const expect = (ok, reason) => { if (!ok) throw Error(reason); };
  expect(value.schemaVersion === 's6-0-public-synthetic-v1', 'Unexpected version');
  expect(value.classification === 'PUBLIC_SYNTHETIC_METADATA_ONLY', 'Restricted evidence must not enter public Git');
  expect(value.scope === 'FOUNDATION_B04_ONLY' && value.sourceRepository === 'chung6a8m/MyDms', 'Scope/authority mismatch');
  expect(value.productVerified === false && value.tenantGoLiveAccepted === false && value.realEvRuns === 0, 'Cannot self-approve Product/tenant EV');
  expect(value.gateA === 'NOT_READY' && value.gateB === 'BLOCKED', 'Gate promotion not permitted by synthetic evidence');
  expect(value.review && !Array.isArray(value.review) &&
         Object.keys(value.review).sort().join('|') === ['reviewer','signoffRef','state'].sort().join('|') &&
         value.review.state === 'NOT_SUBMITTED' && value.review.reviewer === null && value.review.signoffRef === null,
         'Never fabricate reviewer or acceptance');
  expect(Array.isArray(value.blockers) &&
         value.blockers.includes('B04_SECURE_STORE_NOT_CONFIGURED') &&
         value.blockers.includes('B04_QA_OPS_SECURITY_APPROVAL_PENDING') &&
         new Set(value.blockers).size === value.blockers.length, 'B04 blockers are non-waivable here');
  expect(Array.isArray(value.artifacts), 'Artifact list required');
  for (const artifact of value.artifacts) {
    expect(artifact && typeof artifact === 'object' && !Array.isArray(artifact) &&
           Object.keys(artifact).sort().join('|') === ['kind','sha256','classification'].sort().join('|'),
           'Raw or unclassified artifact field prohibited');
    expect(['UNIT_TEST_COUNTERS','SQL_INFRA_METADATA','BUILD_METADATA'].includes(artifact.kind) &&
           SHA64.test(artifact.sha256) && artifact.classification === 'PUBLIC_SYNTHETIC_METADATA_ONLY',
           'Unsafe artifact metadata');
  }
  if (value.runKind === 'EXAMPLE') {
    expect(value.recordKind === 'SYNTHETIC_EXAMPLE_NOT_EXECUTED' &&
           value.executionStatus === 'NOT_RUN' &&
           value.sourceHeadSha === null && value.testedCheckoutSha === null &&
           value.testRunId === null && value.fixtureHash === null &&
           value.artifacts.length === 0, 'Example cannot claim execution');
  } else if (value.runKind === 'SYNTHETIC_CI') {
    expect(value.recordKind === 'SYNTHETIC_CI_RUN_NOT_PRODUCT_EV' &&
           value.executionStatus === 'EXECUTED_UNREVIEWED' &&
           SHA40.test(value.sourceHeadSha) && SHA40.test(value.testedCheckoutSha) &&
           typeof value.testRunId === 'string' && value.testRunId.length >= 6 &&
           SHA64.test(value.fixtureHash), 'CI metadata requires traceable source and fixture');
  } else throw Error('Only synthetic EXAMPLE or SYNTHETIC_CI is permitted');

  return { status: 'PASS_B04_PUBLIC_SYNTHETIC_CONTRACT_ONLY', runKind: value.runKind, productVerified: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const filename = process.argv[2];
  if (!filename) throw Error('Usage: node tools/evidence/check-public-synthetic.mjs <example.json>');
  const payload = JSON.parse(fs.readFileSync(filename, 'utf8'));
  console.log(JSON.stringify(validatePublicSyntheticRecord(payload)));
}
