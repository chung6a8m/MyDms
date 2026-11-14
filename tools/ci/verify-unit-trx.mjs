import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Only synthetic TRX counters: fail closed on missing/zero/skipped/failed test cases.
// Avoid raw test output or personally identifying result names in public metadata.
export function parseTrxCounters(xml, minCount = 3) {
  const match = xml.match(/<Counters\b([^>]*)\/?\s*>/i);
  if (!match) throw Error('Missing TRX Counters');
  const attrs = Object.fromEntries(
    [...match[1].matchAll(/([\w]+)\s*=\s*"([^"]+)"/g)].map(a => [a[1], a[2]])
  );
  const required = ['total', 'executed', 'passed', 'failed', 'notExecuted'];
  const counts = {};
  for (const key of required) {
    const v = attrs[key];
    if (!/^\d+$/.test(v ?? '')) throw Error('Invalid or missing TRX counter: ' + key);
    counts[key] = Number(v);
  }
  for (const key of ['error', 'timeout', 'aborted', 'inconclusive', 'notRunnable', 'disconnected', 'warning']) {
    if (attrs[key] !== undefined && (!/^\d+$/.test(attrs[key]) || Number(attrs[key]) !== 0))
      throw Error('Non-PASS TRX counter: ' + key);
  }
  if (counts.total < minCount || counts.executed !== counts.total ||
      counts.passed !== counts.total || counts.failed !== 0 || counts.notExecuted !== 0) {
    throw Error('TRX does not satisfy minimum non-skipped PASS: ' + JSON.stringify(counts));
  }
  return counts;
}

function main() {
  const filename = process.argv[2] || '';
  if (!filename) throw Error('Usage: node tools/ci/verify-unit-trx.mjs path/to/file.trx');
  const bytes = fs.readFileSync(filename);
  const counters = parseTrxCounters(bytes.toString('utf8'), 3);
  const sourceHeadSha = process.env.MYDMS_SOURCE_HEAD_SHA || 'LOCAL_NOT_ATTESTED';
  const checkoutSha = process.env.MYDMS_CHECKOUT_SHA || 'LOCAL_NOT_ATTESTED';
  if (process.env.GITHUB_ACTIONS === 'true' &&
      (![sourceHeadSha, checkoutSha].every(x => /^[0-9a-f]{40}$/.test(x)))) {
    throw Error('Missing trusted CI source / checkout commit SHA');
  }
  const metadata = {
    recordKind: 'FOUNDATION_UNIT_SYNTHETIC_CI_ONLY',
    sourceHeadSha,
    testedCheckoutSha: checkoutSha,
    ciRunId: process.env.GITHUB_RUN_ID || null,
    artifactTrxSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    counters,
    productVerified: false,
    tenantGoLiveAccepted: false
  };
  const out = path.resolve('artifacts/ci/foundation-unit-metadata.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(metadata, null, 2) + '\n');
  console.log('PASS_FOUNDATION_TRX_SYNTHETIC_ONLY', JSON.stringify({ counters, sourceHeadSha }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
