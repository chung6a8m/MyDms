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
export const GATE_A_ROLES = Object.freeze(['TECHNICAL', 'QA', 'OPERATIONS', 'SECURITY', 'FINANCE']);
const SHA40 = /^[a-f0-9]{40}$/;
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const must = (condition, why) => { if (!condition) throw Error(why); };
const obj = (value, keys, label) => {
  must(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  must(Object.keys(value).sort().join('|') === keys.slice().sort().join('|'), label + ' unexpected/missing fields');
};
const ref = value => typeof value === 'string' && value.length >= 10 &&
  value.length <= 512 && !/[\x00-\x1f]/.test(value);
const date = value => typeof value === 'string' && UTC_TIME.test(value) &&
  Number.isFinite(Date.parse(value));

export function assessB04GateA(record, { restricted = false } = {}) {
  obj(record, ['schemaVersion','recordKind','classification','sourceRepository','sourceSha','scope',
    'checks','reviews','ownerGateA','safety'], 'Gate A assessment');
  must(record.schemaVersion === 'b04-gate-a-readiness-v1', 'Unexpected schema version');
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

  must(Array.isArray(record.checks) && record.checks.length === GATE_A_CHECKS.length,
    'All Gate A controls required');
  const pending = [];
  const ids = new Set();
  for (const c of record.checks) {
    obj(c, ['id','status','evidenceRef'], 'Control');
    must(GATE_A_CHECKS.includes(c.id) && !ids.has(c.id), 'Unknown/duplicate Gate A control');
    ids.add(c.id);
    must(['PENDING','EVIDENCED'].includes(c.status), 'Invalid control status');
    must(c.status === 'PENDING' ? c.evidenceRef === null : restricted && ref(c.evidenceRef),
      'Control evidence must be restricted and structurally traceable');
    if (!restricted) must(c.status === 'PENDING', 'Public fixture cannot claim evidence');
    if (c.status === 'PENDING') pending.push('CONTROL:' + c.id);
  }

  must(Array.isArray(record.reviews) && record.reviews.length === GATE_A_ROLES.length,
    'All role-scoped review records required');
  const seenRoles = new Set();
  const approvedPrincipals = new Set();
  for (const r of record.reviews) {
    obj(r, ['role','status','principalRef','approvalRef','decidedAt'], 'Role review');
    must(GATE_A_ROLES.includes(r.role) && !seenRoles.has(r.role), 'Unknown/duplicate reviewer role');
    seenRoles.add(r.role);
    must(['PENDING','APPROVED'].includes(r.status), 'Invalid review status');
    if (r.status === 'APPROVED') {
      must(restricted && ref(r.principalRef) && ref(r.approvalRef) && date(r.decidedAt),
        'Approved roles require real restricted provenance fields');
      must(!approvedPrincipals.has(r.principalRef), 'One principal is not independent multi-role review');
      approvedPrincipals.add(r.principalRef);
    } else {
      must(r.principalRef === null && r.approvalRef === null && r.decidedAt === null,
        'Pending review cannot carry purported signatures');
      pending.push('REVIEW:' + r.role);
    }
    if (!restricted) must(r.status === 'PENDING', 'Public fixture cannot claim role acceptance');
  }

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
      'Owner authorization requires all controls and role reviews evidenced first');
  }
  if (!restricted) must(decision.status === 'PENDING', 'Public CI cannot authorize Gate A');

  // Structural validation is NOT authentication of a provider, approval, artifact or signer.
  // The returned gate state is NEVER promoted; external independent verification is mandatory.
  return {
    validation: restricted ? 'PASS_RESTRICTED_STRUCTURE_ONLY' : 'PASS_PUBLIC_PENDING_TEMPLATE_ONLY',
    readiness: pending.length ? 'BLOCKED_PENDING_EXTERNAL_EVIDENCE'
      : 'STRUCTURALLY_COMPLETE_REQUIRES_LIVE_ATTESTATION',
    pending,
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
