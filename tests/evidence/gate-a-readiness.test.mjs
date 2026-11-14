import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assessB04GateA, GATE_A_CHECKS, GATE_A_ROLES } from '../../tools/evidence/assess-b04-gate-a.mjs';

const example = JSON.parse(fs.readFileSync('fixtures/evidence/b04-gate-a-pending.example.json', 'utf8'));
const checkBad = change => {
  const x = structuredClone(example);
  change(x);
  assert.throws(() => assessB04GateA(x));
};
const makeRestricted = () => {
  const x = structuredClone(example);
  x.recordKind = 'RESTRICTED_DOSSIER_STRUCTURAL_ONLY_NOT_AUTHORIZATION';
  x.classification = 'RESTRICTED_INTERNAL_NOT_FOR_PUBLIC_GIT';
  x.sourceSha = 'a'.repeat(40);
  return x;
};
const makeComplete = () => {
  const x = makeRestricted();
  for (const c of x.checks) {
    c.status = 'EVIDENCED';
    c.evidenceRef = 'restricted-record:' + c.id;
  }
  for (const r of x.reviews) {
    r.status = 'APPROVED';
    r.principalRef = 'principal-for-' + r.role;
    r.approvalRef = 'restricted-review:' + r.role;
    r.decidedAt = '2026-11-14T01:00:00Z';
  }
  x.ownerGateA = {
    status: 'AUTHORIZED_B05_B06_NONPRODUCTION_ONLY',
    principalRef: 'principal-for-OWNER',
    approvalRef: 'restricted-owner-decision:1',
    decidedAt: '2026-11-14T02:00:00Z'
  };
  return x;
};

test('public template is valid but keeps Gate A blocked', () => {
  const x = assessB04GateA(example);
  assert.equal(x.gateA, 'NOT_READY');
  assert.equal(x.readiness, 'BLOCKED_PENDING_EXTERNAL_EVIDENCE');
  assert.equal(x.pending.length, GATE_A_CHECKS.length + GATE_A_ROLES.length + 1);
});
test('reject fake Gate A or Product Verification', () => checkBad(x => { x.safety.gateA = 'READY'; }));
test('reject fake Product Verified flag', () => checkBad(x => { x.safety.productVerified = true; }));
test('reject P0 waiver', () => checkBad(x => { x.safety.p0Waivers = ['G-STOCK']; }));
test('reject public evidence ref', () => checkBad(x => {
  x.checks[0].status = 'EVIDENCED'; x.checks[0].evidenceRef = 'public-url:evidence';
}));
test('reject fabricated public reviewer', () => checkBad(x => {
  x.reviews[0].status = 'APPROVED'; x.reviews[0].principalRef = 'principal-fake';
  x.reviews[0].approvalRef = 'approval-fake'; x.reviews[0].decidedAt = '2026-11-14T01:00:00Z';
}));
test('reject unscoped Owner approval', () => checkBad(x => {
  x.ownerGateA.status = 'AUTHORIZED_ALL_RUNTIME';
}));
test('reject missing/duplicate controls', () => checkBad(x => { x.checks[1].id = x.checks[0].id; }));
test('reject unknown properties (secrets and raw artifacts)', () => checkBad(x => {
  x.storeCredentials = 'unacceptable';
}));
test('restricted dossier missing evidence stays blocked', () => {
  const x = assessB04GateA(makeRestricted(), { restricted: true });
  assert.equal(x.gateA, 'NOT_READY');
  assert.equal(x.pending.length, 13);
});
test('reject restricted reviewer identity reused across roles', () => {
  const x = makeComplete();
  x.reviews[1].principalRef = x.reviews[0].principalRef;
  assert.throws(() => assessB04GateA(x, { restricted: true }), /independent/);
});
test('reject Owner authorization if a required control is pending', () => {
  const x = makeComplete();
  x.checks[0].status = 'PENDING'; x.checks[0].evidenceRef = null;
  assert.throws(() => assessB04GateA(x, { restricted: true }));
});
test('reject invalid source hash and fake approval time', () => {
  const x = makeComplete(); x.sourceSha = 'not-a-commit';
  assert.throws(() => assessB04GateA(x, { restricted: true }));
  const y = makeComplete(); y.reviews[0].decidedAt = 'yesterday';
  assert.throws(() => assessB04GateA(y, { restricted: true }));
});
test('even a structurally complete restricted input NEVER grants Gate A', () => {
  const report = assessB04GateA(makeComplete(), { restricted: true });
  assert.equal(report.readiness, 'STRUCTURALLY_COMPLETE_REQUIRES_LIVE_ATTESTATION');
  assert.equal(report.gateA, 'NOT_READY');
  assert.equal(report.productVerified, false);
});
