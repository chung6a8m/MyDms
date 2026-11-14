import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/ci/sql-infra-smoke.sh';
const run = vars => spawnSync('bash', [script], {
  encoding: 'utf8',
  env: { ...process.env, GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted',
    MYDMS_SQL_TEST_DISPOSABLE: 'YES', SQL_CONNECTION_STRING: '',
    MYDMS_PRODUCTION_CONNECTION: '', MYDMS_SQL_CONNECTION_STRING: '', DATABASE_URL: '', ...vars }
});

test('non-Actions runners fail before Docker', () => {
  const r = run({ GITHUB_ACTIONS: 'false' });
  assert.equal(r.status, 12);
});
test('self-hosted runners fail before Docker', () => {
  const r = run({ RUNNER_ENVIRONMENT: 'self-hosted' });
  assert.equal(r.status, 15);
});
test('external SQL connection fails without disclosing it', () => {
  const r = run({ SQL_CONNECTION_STRING: 'TOP_SECRET_VALUE' });
  assert.equal(r.status, 13);
  assert.equal((r.stderr || '').includes('TOP_SECRET_VALUE'), false);
});
test('alternate external SQL configuration fails closed', () => {
  const r = run({ DATABASE_URL: 'TOP_SECRET_VALUE' });
  assert.equal(r.status, 13);
});
test('infra container cannot publish ports or reach provider network', () => {
  const src = fs.readFileSync(script, 'utf8');
  assert.match(src, /--network none/);
  assert.doesNotMatch(src, /--publish/);
  assert.match(src, /HostConfig.NetworkMode/);
  assert.match(src, /CONTAINER_NETWORK_NONE/);
});
