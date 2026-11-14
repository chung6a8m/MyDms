import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrxCounters } from '../../tools/ci/verify-unit-trx.mjs';

const trx = attributes => '<TestRun><ResultSummary><Counters ' + attributes + ' /></ResultSummary></TestRun>';
const complete = 'total="3" executed="3" passed="3" failed="0" notExecuted="0" error="0" timeout="0"';

test('3 real passed counters are accepted', () => {
  assert.equal(parseTrxCounters(trx(complete)).passed, 3);
});
test('zero executed tests are rejected', () => {
  assert.throws(() => parseTrxCounters(trx('total="0" executed="0" passed="0" failed="0" notExecuted="0"')));
});
test('skipped tests are rejected', () => {
  assert.throws(() => parseTrxCounters(trx('total="3" executed="2" passed="2" failed="0" notExecuted="1"')));
});
test('missing counters are rejected', () => {
  assert.throws(() => parseTrxCounters('<TestRun />'));
});
test('failed tests are rejected', () => {
  assert.throws(() => parseTrxCounters(trx('total="3" executed="3" passed="2" failed="1" notExecuted="0"')));
});
test('non numeric counters are rejected', () => {
  assert.throws(() => parseTrxCounters(trx('total="three" executed="3" passed="3" failed="0" notExecuted="0"')));
});
