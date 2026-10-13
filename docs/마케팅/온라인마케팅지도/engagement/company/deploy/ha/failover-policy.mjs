// Preparation only: deterministic decisions, no network, shell, scheduler or mutations.
// A production adapter must authenticate observations, CAS-persist every phase,
// and complete the acceptance gates in plan.json before enabling any action.
export const POLICY = Object.freeze({
  failureMs: 180_000, pollMs: 10_000, maxGapMs: 20_000,
  localFreshMs: 15_000, externalFreshMs: 90_000, clockToleranceMs: 5_000,
  maxMaintenanceMs: 1_800_000, externalQuorum: 2,
});
const statusValues = new Set(['healthy', 'unhealthy', 'unknown']);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = n => Number.isSafeInteger(n) && n >= 0;
const fresh = (at, now, limit) => timestamp(at) && at <= now && now - at <= limit;

export function initialState() {
  return {version: 1, bootId: null, activeId: null, lastMono: null, lastWall: null,
    sinceMono: null, sinceWall: null, samples: 0};
}

// Monotonic elapsed time AND wall time are required. One repeated, missing,
// contradictory or stale observation can never become three minutes of proof.
export function observe(previous, observation, {activeId, observerIds, maintenanceUntil = 0} = {}) {
  const p = previous ?? initialState();
  const o = observation ?? {};
  const reset = reason => ({state: initialState(), decision: 'WAIT', reason});
  if (typeof activeId !== 'string' || !activeId || !Array.isArray(observerIds)
      || observerIds.length < POLICY.externalQuorum || new Set(observerIds).size !== observerIds.length
      || observerIds.some(id => typeof id !== 'string' || !id)
      || typeof o.bootId !== 'string' || !o.bootId
      || !timestamp(o.monoMs) || !timestamp(o.wallMs)) return reset('INVALID_OBSERVATION');
  if (maintenanceUntil !== 0 && (!timestamp(maintenanceUntil)
      || maintenanceUntil - o.wallMs > POLICY.maxMaintenanceMs)) return reset('INVALID_MAINTENANCE');
  if (maintenanceUntil > o.wallMs) return reset('MAINTENANCE');
  if (p.version !== 1 || !Number.isSafeInteger(p.samples) || p.samples < 0
      || (p.lastMono !== null && !timestamp(p.lastMono)) || (p.lastWall !== null && !timestamp(p.lastWall))
      || (p.sinceMono !== null && !timestamp(p.sinceMono)) || (p.sinceWall !== null && !timestamp(p.sinceWall))
      || ((p.lastMono === null) !== (p.lastWall === null))
      || ((p.sinceMono === null) !== (p.sinceWall === null))
      || (p.sinceMono !== null && (p.sinceMono > p.lastMono || p.sinceWall > p.lastWall))) return reset('INVALID_STATE');
  let base = p;
  if (p.bootId !== o.bootId || p.activeId !== activeId) base = initialState();
  if (base.lastMono !== null) {
    const monotonicDelta = o.monoMs - base.lastMono, wallDelta = o.wallMs - base.lastWall;
    if (monotonicDelta <= 0 || wallDelta <= 0) return reset('REPLAY_OR_REVERSED_CLOCK');
    if (Math.abs(monotonicDelta - wallDelta) > POLICY.clockToleranceMs) return reset('CLOCK_JUMP');
    if (monotonicDelta > POLICY.maxGapMs) base = initialState();
  }
  const s = {...base, bootId: o.bootId, activeId, lastMono: o.monoMs, lastWall: o.wallMs};
  const clear = reason => ({state: {...s, sinceMono: null, sinceWall: null, samples: 0}, decision: 'WAIT', reason});
  if (!o.local || o.local.nodeId !== activeId || !statusValues.has(o.local.status)
      || !fresh(o.local.at, o.wallMs, POLICY.localFreshMs)) return clear('LOCAL_UNKNOWN');
  if (o.local.status !== 'unhealthy') return clear(o.local.status === 'healthy' ? 'RECOVERED' : 'LOCAL_UNKNOWN');
  const seen = new Set(), votes = [];
  if (!Array.isArray(o.external)) return clear('EXTERNAL_UNKNOWN');
  for (const v of o.external) {
    if (!v || !observerIds.includes(v.id) || seen.has(v.id) || !statusValues.has(v.status)
        || !fresh(v.at, o.wallMs, POLICY.externalFreshMs)) return clear('EXTERNAL_UNKNOWN');
    seen.add(v.id); votes.push(v.status);
  }
  if (votes.includes('healthy')) return clear('EXTERNAL_DISAGREEMENT');
  if (votes.filter(v => v === 'unhealthy').length < POLICY.externalQuorum) return clear('NO_EXTERNAL_QUORUM');
  s.sinceMono ??= o.monoMs; s.sinceWall ??= o.wallMs; s.samples += 1;
  const elapsedMs = Math.min(o.monoMs - s.sinceMono, o.wallMs - s.sinceWall);
  return {state: s, decision: elapsedMs >= POLICY.failureMs ? 'CONFIRMED_OUTAGE' : 'WAIT',
    reason: elapsedMs >= POLICY.failureMs ? 'CONTINUOUS_180_SECONDS' : 'OBSERVING', elapsedMs};
}

// No automatic reversal: once an operation has started, its durable operation ID
// must be reconciled. An unknown API outcome is not permission to issue it twice.
export const PHASES = Object.freeze([
  'FENCE_OLD_WRITER', 'ATTACH_REGIONAL_DISK', 'ACCEPT_DATA',
  'START_CANDIDATE', 'VERIFY_CANDIDATE', 'EXPOSE_CANDIDATE', 'COMPLETE',
]);

export function armingBlockers(plan, acceptance = {}) {
  const reasons = [];
  if (plan?.schema !== 'synk-ha-plan/v1') reasons.push('PLAN_SCHEMA');
  if (plan?.armed !== true) reasons.push('DISARMED');
  if (plan?.trigger?.continuousFailureSeconds !== 180) reasons.push('180_SECONDS_REQUIRED');
  if (plan?.data?.singleWriter !== true || plan?.data?.replication !== 'regional-pd-synchronous') reasons.push('STORAGE_DESIGN');
  if (plan?.routing?.dropTrafficIfUnhealthy !== true) reasons.push('ALL_UNHEALTHY_MUST_DROP');
  if (plan?.automaticFailback !== false) reasons.push('AUTOMATIC_FAILBACK_FORBIDDEN');
  if (!/^[0-9]{1,32}$/.test(plan?.data?.diskId ?? '')
      || !/^[0-9]{1,32}$/.test(plan?.nodes?.primary?.instanceId ?? '')
      || !/^[0-9]{1,32}$/.test(plan?.nodes?.standby?.instanceId ?? '')
      || plan.nodes.primary.instanceId === plan.nodes.standby.instanceId
      || !hash(plan?.release?.manifestSha256)) reasons.push('LIVE_RESOURCE_IDENTITIES_REQUIRED');
  for (const name of REQUIRED_ACCEPTANCE) if (acceptance[name] !== true) reasons.push(name);
  return reasons;
}

export const REQUIRED_ACCEPTANCE = Object.freeze([
  'recurringCostApproved', 'cloudResourcesCreated', 'regionalDataMigrationAccepted',
  'latestReleaseAndImagesOnBothNodes', 'originalKeysAndSessionsPreserved',
  'bootAndDockerWriterGateVerified', 'inFlightExternalWorkFencingVerified',
  'durableHealthImplemented', 'controllerAdaptersImplemented', 'authenticatedProbesVerified',
  'casStateAndOperationReconciliationVerified', 'controllerIdentityRestricted',
  'outboundConnectivityVerified', 'loadBalancerAndTlsVerified', 'maintenanceGateIntegrated',
  'naturalMonitoringWindowAccepted', 'actualFailoverDrillPassed',
]);

export function beginFailover({plan, acceptance, outage, from, to, operationId, diskId, releaseSha256, activeEpoch, now}) {
  const blockers = armingBlockers(plan, acceptance);
  if (outage?.decision !== 'CONFIRMED_OUTAGE' || !outage.state
      || !fresh(outage.state.lastWall, now, POLICY.localFreshMs)
      || !timestamp(outage.state.lastMono) || !timestamp(now)
      || !timestamp(outage.state.sinceWall) || !timestamp(outage.state.sinceMono)
      || outage.state.lastWall - outage.state.sinceWall < POLICY.failureMs
      || outage.state.lastMono - outage.state.sinceMono < POLICY.failureMs) blockers.push('FRESH_OUTAGE_REQUIRED');
  if (!from || !to || from === to || outage?.state?.activeId !== from
      || from !== plan?.nodes?.primary?.instanceId || to !== plan?.nodes?.standby?.instanceId
      || diskId !== plan?.data?.diskId || releaseSha256 !== plan?.release?.manifestSha256
      || typeof operationId !== 'string' || !/^[a-z0-9-]{16,80}$/.test(operationId)
      || !/^[0-9]{1,32}$/.test(diskId ?? '') || !hash(releaseSha256)
      || !Number.isSafeInteger(activeEpoch) || activeEpoch < 1) blockers.push('TARGET_IDENTITY');
  if (blockers.length) return {decision: 'HOLD', blockers};
  return {decision: 'PREPARED', state: {version: 1, operationId, from, to, diskId,
    releaseSha256, phase: PHASES[0], phaseStartedAt: now, generation: 1, activeEpoch}};
}

// A phase receipt is only meaningful after a production adapter authenticates and
// verifies it. This function never treats a boolean sent by a public client as proof.
export function advancePhase(state, receipt, now) {
  const hold = reason => ({decision: 'HOLD', reason, state});
  if (!state || !PHASES.includes(state.phase) || state.phase === 'COMPLETE'
      || !timestamp(now) || !timestamp(state.phaseStartedAt)
      || !Number.isSafeInteger(state.generation) || state.generation < 1
      || !Number.isSafeInteger(state.activeEpoch) || state.activeEpoch < 1) return hold('NO_ACTIVE_PHASE');
  if (!receipt || receipt.operationId !== state.operationId || receipt.phase !== state.phase
      || receipt.from !== state.from || receipt.to !== state.to || receipt.generation !== state.generation
      || !fresh(receipt.at, now, POLICY.localFreshMs) || receipt.at < state.phaseStartedAt) return hold('RECEIPT_IDENTITY_OR_FRESHNESS');
  if (receipt.status !== 'DONE' || receipt.error || receipt.outcomeUnknown) return hold('OUTCOME_NOT_CONFIRMED');
  const checks = {
    FENCE_OLD_WRITER: () => receipt.oldVmStopped === true && receipt.bootGateRevoked === true
      && receipt.oldRoutingDisabled === true && receipt.externalReplaySafe === true,
    ATTACH_REGIONAL_DISK: () => receipt.diskId === state.diskId && receipt.forceAttachOperationDone === true
      && receipt.storageFenceVerified === true && receipt.writableOwner === state.to,
    ACCEPT_DATA: () => receipt.diskId === state.diskId && receipt.mountedDiskId === state.diskId
      && receipt.originalKeyMatches === true && receipt.bothDbsIntegrityOk === true
      && receipt.identityAndSessionsConsistent === true && receipt.localFilesAccepted === true
      && receipt.releaseSha256 === state.releaseSha256 && receipt.imagesAndEnvAccepted === true,
    START_CANDIDATE: () => receipt.onlyWriter === state.to && receipt.activeGeneration === state.activeEpoch
      && receipt.startCompleted === true,
    VERIFY_CANDIDATE: () => receipt.onlyWriter === state.to && receipt.activeGeneration === state.activeEpoch
      && receipt.releaseSha256 === state.releaseSha256 && receipt.durableHealthOk === true
      && receipt.authBoundaryOk === true && receipt.outboundOk === true,
    EXPOSE_CANDIDATE: () => receipt.healthyBackend === state.to && receipt.oldBackendReady === false
      && receipt.publicHttpsReady === true && receipt.failbackDisabled === true,
  };
  if (!checks[state.phase]()) return hold('PHASE_EVIDENCE_INCOMPLETE');
  const next = {...state, phase: PHASES[PHASES.indexOf(state.phase) + 1], phaseStartedAt: now,
    generation: state.generation + 1};
  return {decision: next.phase === 'COMPLETE' ? 'COMPLETE' : 'PREPARED', state: next};
}
