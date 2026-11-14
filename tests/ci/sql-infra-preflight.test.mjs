import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const script = 'scripts/ci/sql-infra-smoke.sh';
const source = fs.readFileSync(script, 'utf8');
const run = vars => spawnSync('bash', [script], {
  encoding: 'utf8',
  env: {
    ...process.env,
    GITHUB_ACTIONS: 'true',
    RUNNER_ENVIRONMENT: 'github-hosted',
    MYDMS_SQL_TEST_DISPOSABLE: 'YES',
    SQL_CONNECTION_STRING: '',
    MYDMS_PRODUCTION_CONNECTION: '',
    MYDMS_SQL_CONNECTION_STRING: '',
    DATABASE_URL: '',
    GITHUB_SHA: 'a'.repeat(40),
    MYDMS_SOURCE_HEAD_SHA: 'b'.repeat(40),
    ...vars
  }
});

test('non-Actions runner fails before Docker', () => {
  assert.equal(run({ GITHUB_ACTIONS: 'false' }).status, 12);
});
test('self-hosted runner fails before Docker', () => {
  assert.equal(run({ RUNNER_ENVIRONMENT: 'self-hosted' }).status, 15);
});
test('external SQL connection fails without logging credential', () => {
  const r = run({ SQL_CONNECTION_STRING: 'TOP_SECRET_VALUE' });
  assert.equal(r.status, 13);
  assert.equal((r.stderr || '').includes('TOP_SECRET_VALUE'), false);
});
test('alternate external SQL configuration fails closed', () => {
  assert.equal(run({ DATABASE_URL: 'TOP_SECRET_VALUE' }).status, 13);
});
test('missing source/checkout SHA fails before Docker', () => {
  const r = run({ GITHUB_SHA: 'invalid', MYDMS_SOURCE_HEAD_SHA: 'invalid' });
  assert.equal(r.status, 20);
});
test('SQL image pinned to observed, reviewed digest; mutable 2022-latest not used', () => {
  assert.match(source, /pinned_digest="sha256:[a-f0-9]{64}"/);
  assert.match(source, /image_ref="mcr\.microsoft\.com\/mssql\/server@\$\{pinned_digest\}"/);
  assert.doesNotMatch(source, /2022-latest/);
});
test('isolated SQL container has no published ports and bounded TEST-NET egress probe', () => {
  assert.match(source, /docker network create --driver bridge --internal/);
  assert.match(source, /--network "\$network_name"/);
  assert.match(source, /HostConfig\.PortBindings/);
  assert.match(source, /\/dev\/tcp\/198\.51\.100\.1\/443/);
  assert.match(source, /timeout 6s docker exec/);
  assert.doesNotMatch(source, /--publish/);
});
test('smoke cannot claim success before container and network cleanup verification', () => {
  assert.match(source, /trap cleanup EXIT/);
  assert.match(source, /docker rm -f "\$name"/);
  assert.match(source, /docker network rm "\$network_name"/);
  assert.match(source, /containerAndNetworkCleanupVerified/);
  assert.match(source, /rm -f artifacts\/ci\/sql-infra-smoke\.json/);
  const after = source.indexOf('containerAndNetworkCleanupVerified');
  const before = source.indexOf('cleanup() {');
  assert.ok(after > before);
});
test('nonproduction result does not claim any business ledger tests', () => {
  assert.match(source, /"realBusinessTests":0/);
  assert.match(source, /"productVerified":false/);
});
