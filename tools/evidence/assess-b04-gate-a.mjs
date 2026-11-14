import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GATE_A_CHECKS = Object.freeze([
  'STORE_ENCRYPTION_AND_VERSIONING',
  'STORE_ACCESS_DENY_AND_AUDIT',
  'STORE_RETENTION_AND_RESTORE',
  'DATA_BOUNDARY_AND_REDACTION',
  'SQL_SANDBOX_ISOLATION',
  'FAULT_ALLOWLIST_AND_STOP_CRITERIA',
  'SANDBOX_CLEANUP_EVIDENCE'
]);
// Owner selected Q08 option B: scoped safety reviews BEFORE spikes, TADR reviews AFTER spikes.
export const GATE_A_ROLES = Object.freeze(['TECHNICAL', 'QA', 'OPERATIONS', 'SECURITY']);
export const GATE_B_LEDGER_TADR_ROLES = Object.freeze(['TECHNICAL', 'QA', 'FINANCE']);
const FINANCE_REQUIREMENTS = Object.freeze([
  'PENDING_SCOPE_ASSESSMENT',
  'REQUIRED_FOR_GATE_A',
  'NOT_REQUIRED_FOR_GATE_A_WITH_EVIDENCE'
]);
const SHA40 = /^[a-f0-9]{40}$/;
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const must = (condition, reason) => { if (!condition) throw Error(reason); };
const obj = (value, keys, label) => {
  must(value !== null && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  must(Object.keys(value).sort().join('|') === keys.slice().sort().join('|'),
    label + ' unexpected/missing fields');
};
const ref = value => typeof value === 'string' && value.length >= 10 &&
  value.length <= 512 && !/[\x00-\x1f]/.test(value);
const date = value => typeof value === 'string' && UTC_TIME.test(value) &&
  Number.isFinite(Date.parse(value));

export function assessB04GateA(record, { restricted = false } = {}) {
  obj(record, ['schemaVersion','recordKind','classification','sourceRepository','sourceSha','scope',
    'checks','financeSafety','reviews','roleOverlap','ownerGateA','safety'], 'Gate A assessment');
  must(record.schemaVersion === 'b04-gate-a-readiness-v2', 'Unexpected Gate A record version');
  must(record.sourceRepository === 'chung6a8m/MyDms' &&
    record.scope === 'B05_B06_ISOLATED_SYNTHETIC_NONPRODUCTION_ONLY', 'Scope/source mismatch');
  must(record.recordKind === (restricted
    ? 'RESTRICTED_DOSSIER_STRUCTURAL_ONLY_NOT_AUTHORIZATION'
    : 'PUBLIC_PENDING_TEMPLATE_NOT_EVIDENCE'), 'Incorrect record kind');
  must(record.classification === (restricted
    ? 'RESTRICTED_INTERNAL_NOT_FOR_PUBLIC_GIT'
    : 'PUBLIC_SYNTHETIC_TEMPLATE_ONLY'), 'Incorrect evidence classification');
  must(restricted ? SHA40.test(record.sourceSha) : record.sourceSha === null,
    'Source SHA must be exact for restricted assessment and null for public template');

  obj(record.safety, ['gateA','gateB','productVerified','tenantGoLiveAccepted','realEvRuns',
    'offlineWrite','bNoChannel','p0Waivers'], 'Safety');
  must(record.safety.gateA === 'NOT_READY' && record.safety.gateB === 'BLOCKED' &&
    record.safety.productVerified === false && record.safety.tenantGoLiveAccepted === false &&
    record.safety.realEvRuns === 0 && record.safety.offlineWrite === 'DISABLED_PENDING' &&
    record.safety.bNoChannel === 'BLOCKED' && Array.isArray(record.safety.p0Waivers) &&
    record.safety.p0Waivers.length === 0, 'Gate/production self-promotion or P0 waiver forbidden');

  const pending = [];
  must(Array.isArray(record.checks) && record.checks.length === GATE_A_CHECKS.length,
    'All Gate A safety controls are required');
  const checkIds = new Set();
  for (const c of record.checks) {
    obj(c, ['id','status','evidenceRef'], 'Control');
    must(GATE_A_CHECKS.includes(c.id) && !checkIds.has(c.id), 'Unknown/duplicate Gate A control');
    checkIds.add(c.id);
    must(['PENDING','EVIDENCED'].includes(c.status), 'Invalid control status');
    must(c.status === 'PENDING' ? c.evidenceRef === null : restricted && ref(c.evidenceRef),
      'Control evidence must be restricted and structurally traceable');
    if (!restricted) must(c.status === 'PENDING', 'Public fixture cannot claim safety evidence');
    if (c.status === 'PENDING') pending.push('CONTROL:' + c.id);
  }

  obj(record.financeSafety, ['requirement','assessmentRef','assessedByRef','assessedAt'],
    'Finance Gate A safety-scope assessment');
  const finance = record.financeSafety;
  must(FINANCE_REQUIREMENTS.includes(finance.requirement), 'Invalid finance safety-scope status');
  if (finance.requirement === 'PENDING_SCOPE_ASSESSMENT') {
    must(finance.assessmentRef === null && finance.assessedByRef === null &&
      finance.assessedAt === null, 'Pending Finance scope cannot carry purported decision');
    pending.push('FINANCE_GATE_A_SCOPE_ASSESSMENT');
  } else {
    must(restricted && ref(finance.assessmentRef) && ref(finance.assessedByRef) &&
      date(finance.assessedAt),
      'Gate A Finance requirement/waiver requires a scoped risk assessment with actual provenance');
  }
  if (!restricted) must(finance.requirement === 'PENDING_SCOPE_ASSESSMENT',
    'Public fixture cannot waive or impose Finance safety role');

  must(Array.isArray(record.reviews) &&
    record.reviews.length >= GATE_A_ROLES.length &&
    record.reviews.length <= GATE_A_ROLES.length + 1,
    'Gate A needs four safety roles, with conditional Finance only');
  const seenRoles = new Set();
  const approvedPrincipals = new Map();
  const approvalRefs = new Set();
  for (const r of record.reviews) {
    obj(r, ['role','status','principalRef','approvalRef','decidedAt'], 'Role review');
    must([...GATE_A_ROLES,'FINANCE'].includes(r.role) && !seenRoles.has(r.role),
      'Unknown/duplicate Gate A review role');
    seenRoles.add(r.role);
    must(['PENDING','APPROVED'].includes(r.status), 'Invalid role review status');
    if (r.status === 'APPROVED') {
      must(restricted && ref(r.principalRef) && ref(r.approvalRef) && date(r.decidedAt),
        'Approved roles require real restricted provenance fields');
      must(!approvalRefs.has(r.approvalRef), 'Role-scoped signoffs require different approval references');
      approvalRefs.add(r.approvalRef);
      approvedPrincipals.set(r.principalRef, (approvedPrincipals.get(r.principalRef) || []).concat(r.role));
    } else {
      must(r.principalRef === null && r.approvalRef === null && r.decidedAt === null,
        'Pending role cannot carry purported approval');
      pending.push('REVIEW:' + r.role);
    }
    if (!restricted) must(r.status === 'PENDING', 'Public fixture cannot claim reviewer acceptance');
  }
  for (const role of GATE_A_ROLES)
    must(seenRoles.has(role), 'Missing Gate A safety reviewer: ' + role);
  if (finance.requirement === 'REQUIRED_FOR_GATE_A') {
    if (!seenRoles.has('FINANCE')) pending.push('REVIEW:FINANCE');
  } else must(!seenRoles.has('FINANCE'),
    'Finance Gate A reviewer allowed only after assessed ledger-specific safety requirement');

  obj(record.roleOverlap, ['disclosureRef'], 'Role overlap disclosure');
  const shared = [...approvedPrincipals.values()].filter(roles => roles.length > 1);
  if (shared.length) {
    must(restricted && ref(record.roleOverlap.disclosureRef),
      'Shared principal requires real, scoped multirole/authority disclosure for review');
  } else must(record.roleOverlap.disclosureRef === null,
    'No multirole disclosure should be asserted without overlap');
  // A shared principal never becomes an "independent reviewer" by appearing in more role records.
  // External review MUST inspect the delegation and independence evidence before any Owner decision.

  obj(record.ownerGateA, ['status','principalRef','approvalRef','decidedAt'], 'Owner decision');
  const decision = record.ownerGateA;
  must(['PENDING','AUTHORIZED_B05_B06_NONPRODUCTION_ONLY'].includes(decision.status),
    'Unrecognized/overbroad Gate A decision');
  if (decision.status === 'PENDING') {
    must(decision.principalRef === null && decision.approvalRef === null &&
      decision.decidedAt === null, 'Pending Owner Gate A cannot carry purported approval');
    pending.push('OWNER_GATE_A');
  } else {
    must(restricted && ref(decision.principalRef) && ref(decision.approvalRef) &&
      date(decision.decidedAt) && pending.length === 0,
      'Owner authorization requires all scoped controls and safety reviews evidenced first');
  }
  if (!restricted) must(decision.status === 'PENDING', 'Public CI cannot authorize Gate A');

  // This checks only field structure. It does NOT authenticate any person, artifact,
  // cloud store, decision, G-IDEMP, or real TADR review, and NEVER grants Gate A/B.
  return {
    validation: restricted ? 'PASS_RESTRICTED_STRUCTURE_ONLY' : 'PASS_PUBLIC_PENDING_TEMPLATE_ONLY',
    readiness: pending.length ? 'BLOCKED_PENDING_EXTERNAL_EVIDENCE'
      : 'STRUCTURALLY_COMPLETE_REQUIRES_LIVE_ATTESTATION',
    scope: 'GATE_A_SAFETY_ONLY_NOT_GATE_B_TADR',
    pending,
    sharedPrincipalGroups: shared.length,
    gateA: 'NOT_READY', gateB: 'BLOCKED', productVerified: false
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , flag, filename] = process.argv;
  if (!['--public','--restricted'].includes(flag) || !filename)
    throw Error('Usage: node tools/evidence/assess-b04-gate-a.mjs --public <fixture.json> | --restricted <private-evidence/...json>');
  const restricted = flag === '--restricted';
  if (restricted) {
    if (process.env.GITHUB_ACTIONS === 'true') throw Error('Restricted assessments cannot run in public Actions');
    const segments = path.resolve(filename).split(path.sep);
    if (!segments.includes('private-evidence')) throw Error('Restricted input must live under ignored private-evidence/');
  }
  const payload = JSON.parse(fs.readFileSync(filename, 'utf8'));
  console.log(JSON.stringify(assessB04GateA(payload, { restricted }), null, 2));
}
