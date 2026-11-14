import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assessB04GateA, GATE_A_CHECKS, GATE_A_ROLES, GATE_B_LEDGER_TADR_ROLES
} from '../../tools/evidence/assess-b04-gate-a.mjs';

const example = JSON.parse(fs.readFileSync('fixtures/evidence/b04-gate-a-pending.example.json', 'utf8'));
const rejectPublic = change => {
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
const review = role => ({
  role, status: 'APPROVED',
  principalRef: 'principal-for-' + role,
  approvalRef: 'restricted-review:' + role,
  decidedAt: '2026-11-14T01:00:00Z'
});
const makeComplete = () => {
  const x = makeRestricted();
  for (const c of x.checks) {
    c.status = 'EVIDENCED';
    c.evidenceRef = 'restricted-record:' + c.id;
  }
  x.financeSafety = {
    requirement: 'NOT_REQUIRED_FOR_GATE_A_WITH_EVIDENCE',
    assessmentRef: 'restricted-scoped-risk-review:finance',
    assessedByRef: 'qualified-safety-assessor',
    assessedAt: '2026-11-14T00:30:00Z'
  };
  x.reviews = GATE_A_ROLES.map(review);
  x.ownerGateA = {
    status: 'AUTHORIZED_B05_B06_NONPRODUCTION_ONLY',
    principalRef: 'principal-for-OWNER',
    approvalRef: 'restricted-owner-decision:1',
    decidedAt: '2026-11-14T02:00:00Z'
  };
  return x;
};

test('public v2 template stays blocked with scoped Gate A roles and pending Finance assessment', () => {
  const res = assessB04GateA(example);
  assert.equal(res.gateA, 'NOT_READY');
  assert.equal(res.scope, 'GATE_A_SAFETY_ONLY_NOT_GATE_B_TADR');
  assert.equal(res.readiness, 'BLOCKED_PENDING_EXTERNAL_EVIDENCE');
  assert.equal(res.pending.length, GATE_A_CHECKS.length + GATE_A_ROLES.length + 2);
  assert.deepEqual(example.reviews.map(r => r.role), [...GATE_A_ROLES]);
});
test('Gate B ledger TADR requires Finance independently of Gate A scope', () => {
  assert.deepEqual(GATE_B_LEDGER_TADR_ROLES, ['TECHNICAL', 'QA', 'FINANCE']);
});
test('fake public Gate A promotion fails closed', () => rejectPublic(x => { x.safety.gateA = 'READY'; }));
test('fake public Product Verified flag fails closed', () => rejectPublic(x => { x.safety.productVerified = true; }));
test('P0 waiver is rejected', () => rejectPublic(x => { x.safety.p0Waivers = ['G-STOCK']; }));
test('public evidence ref is rejected', () => rejectPublic(x => {
  x.checks[0].status = 'EVIDENCED'; x.checks[0].evidenceRef = 'public-url:evidence';
}));
test('fake public reviewer approval is rejected', () => rejectPublic(x => {
  x.reviews[0] = review('TECHNICAL');
}));
test('public Finance waiver without scoped assessment is rejected', () => rejectPublic(x => {
  x.financeSafety.requirement = 'NOT_REQUIRED_FOR_GATE_A_WITH_EVIDENCE';
}));
test('public Finance Gate A reviewer not allowed without proven requirement', () => rejectPublic(x => {
  x.reviews.push({role:'FINANCE', status:'PENDING',principalRef:null,approvalRef:null,decidedAt:null});
}));
test('out-of-scope Owner Gate A authorization is rejected', () => rejectPublic(x => {
  x.ownerGateA.status = 'AUTHORIZED_ALL_RUNTIME';
}));
test('duplicate controls rejected', () => rejectPublic(x => { x.checks[1].id = x.checks[0].id; }));
test('unrecognized fields containing raw evidence rejected', () => rejectPublic(x => { x.storeCredentials = 'nope'; }));
test('required roles cannot be omitted', () => {
  const x = makeRestricted();
  x.reviews.pop();
  assert.throws(() => assessB04GateA(x,{restricted:true}));
});
test('restricted dossier with Finance assessment pending remains blocked', () => {
  const result = assessB04GateA(makeRestricted(),{restricted:true});
  assert.equal(result.gateA, 'NOT_READY');
  assert.ok(result.pending.includes('FINANCE_GATE_A_SCOPE_ASSESSMENT'));
});
test('scoped no-Finance Gate A path is structurally complete but never grants Gate A', () => {
  const report = assessB04GateA(makeComplete(),{restricted:true});
  assert.equal(report.readiness, 'STRUCTURALLY_COMPLETE_REQUIRES_LIVE_ATTESTATION');
  assert.equal(report.gateA, 'NOT_READY');
  assert.equal(report.productVerified, false);
});
test('finance safety REQUIRED adds conditional review; missing Finance blocks authorization', () => {
  const x = makeComplete();
  x.financeSafety.requirement = 'REQUIRED_FOR_GATE_A';
  assert.throws(() => assessB04GateA(x,{restricted:true}),/Owner authorization requires/);
  x.ownerGateA = {status:'PENDING',principalRef:null,approvalRef:null,decidedAt:null};
  assert.ok(assessB04GateA(x,{restricted:true}).pending.includes('REVIEW:FINANCE'));
  x.reviews.push(review('FINANCE'));
  x.ownerGateA = makeComplete().ownerGateA;
  const report=assessB04GateA(x,{restricted:true});
  assert.equal(report.pending.length, 0);
  assert.equal(report.gateA,'NOT_READY');
});
test('Finance role cannot be attached when assessed not needed for Gate A', () => {
  const x=makeComplete();
  x.reviews.push(review('FINANCE'));
  assert.throws(() => assessB04GateA(x,{restricted:true}));
});
test('Finance scope without actual risk assessment provenance rejected', () => {
  const x=makeComplete(); x.financeSafety.assessmentRef=null;
  assert.throws(() => assessB04GateA(x,{restricted:true}));
});
test('same principal across roles cannot silently claim independence', () => {
  const x=makeComplete();
  x.reviews[1].principalRef=x.reviews[0].principalRef;
  assert.throws(() => assessB04GateA(x,{restricted:true}), /Shared principal requires/);
  x.roleOverlap.disclosureRef='restricted-scoped-multirole-authorization';
  const res=assessB04GateA(x,{restricted:true});
  assert.equal(res.sharedPrincipalGroups,1);
  assert.equal(res.gateA,'NOT_READY');
});
test('spurious multirole disclosure rejected', () => {
  const x=makeComplete();
  x.roleOverlap.disclosureRef='restricted-scoped-multirole-authorization';
  assert.throws(()=>assessB04GateA(x,{restricted:true}));
});
test('same approval reference cannot count for two roles', () => {
  const x=makeComplete();
  x.reviews[1].approvalRef=x.reviews[0].approvalRef;
  assert.throws(()=>assessB04GateA(x,{restricted:true}),/different approval references/);
});
test('Owner authorization with pending mandatory safety control rejected', () => {
  const x=makeComplete();
  x.checks[0].status='PENDING';x.checks[0].evidenceRef=null;
  assert.throws(()=>assessB04GateA(x,{restricted:true}));
});
test('invalid exact SHA and approval date rejected', () => {
  const x=makeComplete();x.sourceSha='not-a-commit';
  assert.throws(()=>assessB04GateA(x,{restricted:true}));
  const y=makeComplete();y.reviews[0].decidedAt='yesterday';
  assert.throws(()=>assessB04GateA(y,{restricted:true}));
});
test('unrecognized v1 template requires explicit v2 update', () => {
  const x=structuredClone(example);x.schemaVersion='b04-gate-a-readiness-v1';
  assert.throws(()=>assessB04GateA(x),/version/);
});
