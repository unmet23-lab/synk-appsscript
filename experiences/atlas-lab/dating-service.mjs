// Local product service; central SYNK owns real identity. Demo has a separate DB,
// explicit fictional login and short-lived memory-only tokens, never an auth fallback.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import Domain from '../../atlas/domain.js';
import Ask from '../../atlas/ask.js';
import Personalization from '../../atlas/personalization.js';
import ConditionalPreference from '../../atlas/conditional-preference.js';
import { createDiscoveryAdapter, DISCOVERY_FIELDS } from './discovery.mjs';
import { validateMeetingRegions, compareMeetingRegions } from './meeting-regions.mjs';
import { getIntroductionGuidance } from './introduction-guidance.mjs';
import { normalizePublicExpirations, projectPublicAnswers } from './public-profile.mjs';
import { createAppointmentsAdapter } from './appointments.mjs';
import { createDatingAccountVerifier } from './dating-auth.mjs';
import { createIntroductionsAdapter } from './introductions.mjs';
import { createProductExperience } from './product-experience.mjs';
import { createMeetingAlignment } from './meeting-alignment.mjs';
import { createDatingLifecycleVerifier } from './dating-lifecycle.mjs';
import { createDatingAdultVerifier, datingAdultStatus, datingAdultProjection } from './dating-adult.mjs';
import { createDatingTransport } from './dating-transport.mjs';
import { createDatingAdmission } from './dating-admission.mjs';

const PREFIX = '/api/atlas-dating', MAX_BODY = 32768, DAY = 86400000, BOOKMARK_LIMIT = 5;
const plain = x => !!x && Object.getPrototypeOf(x) === Object.prototype;
const own = (x, key) => Object.hasOwn(x, key);
const exact = (x, keys) => plain(x) && Object.keys(x).every(key => keys.includes(key));
const clone = x => JSON.parse(JSON.stringify(x));
const id = x => typeof x === 'string' && /^[A-Za-z0-9_.:@-]{1,160}$/.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x);
const uuid = x => typeof x === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const hash = x => createHash('sha256').update(x).digest('hex');
const canonical = x => JSON.stringify(x, (_key, value) => plain(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
const fail = (status, code) => { throw Object.assign(new Error(code), { status, code }); };
const requireThat = (condition, code = 'invalid-action') => { if (!condition) fail(400, code); };
// SQLite extended codes retain their primary code in the low byte. Keep the
// native error/path private and keep 5xx outcomes uncertain until receipt lookup.
const unavailableStorage = error => error?.code === 'store-unavailable' || error?.code === 'ERR_SQLITE_ERROR'
  && Number.isInteger(error.errcode) && [5, 6, 8, 10, 11, 13, 14, 26].includes(error.errcode & 255);
const finiteText = (value, maximum, required = false) => typeof value === 'string' && value.length <= maximum && (!required || !!value.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
function profileBasics(profile) {
  requireThat(plain(profile) && finiteText(profile.nickname, 60, true) && finiteText(profile.region, 80) && finiteText(profile.intro, 400));
  return { nickname: profile.nickname.trim(), region: profile.region.trim(), intro: profile.intro.trim() };
}
const fields = new Map(DISCOVERY_FIELDS.map(field => [field.id, field]));
function choices(value, { publicValues = false } = {}) {
  requireThat(plain(value) && Object.keys(value).length <= DISCOVERY_FIELDS.length);
  const normalized = {};
  for (const [key, answer] of Object.entries(value)) {
    const code = publicValues ? 'invalid-public-values' : 'invalid-preferences';
    requireThat(key !== 'consent' && fields.has(key), code);
    if (fields.get(key).kind === 'regions') {
      try { normalized[key] = validateMeetingRegions(answer); } catch { fail(400, code); }
    } else {
      requireThat(fields.get(key).options.some(option => option.value === answer), code);
      normalized[key] = answer;
    }
  }
  return clone(normalized);
}
const blank = at => ({ profile: { nickname: '', region: '', intro: '', values: {}, required: [] }, preferences: {},
  consents: { profilePublic: false, receiveInvitations: false, storePreferences: false },
  onboardingState: { consentsConfirmed: false },
  adult: { selfDeclared: false, verified: false, at: null }, paused: false, blocks: [], discovery: null, discoveryEpoch: null, archivedReflections: [], createdAt: at, updatedAt: at });
const DEMO_ROLES = ['adult-a', 'adult-b', 'sample-1', 'sample-2', 'sample-3', 'operator'];
const DEMO_SAMPLES = [
  { role: 'sample-1', nickname: '가상 예시 민서', pace: 'lead', plan: 'planned', purpose: 'gradual', contact: 'few-days', rhythm: 'early', notice: 'advance' },
  { role: 'sample-2', nickname: '가상 예시 하린', pace: 'listen', plan: 'planned', purpose: 'committed', contact: 'daily', rhythm: 'late', notice: 'when-free' },
  { role: 'sample-3', nickname: '가상 예시 도윤', pace: 'lead', plan: 'spontaneous', purpose: 'open', contact: 'flexible', rhythm: 'variable', notice: 'flexible' },
];
export const DATING_DEMO_ROLES = Object.freeze(DEMO_ROLES.map(role => Object.freeze({ role,
  label: DEMO_SAMPLES.find(sample => sample.role === role)?.nickname || (role === 'operator' ? '가상 운영자' : role === 'adult-a' ? '내 가상 역할' : '기존 상대 가상 역할') })));
const demoRole = accountId => accountId?.startsWith('demo:') && DEMO_ROLES.includes(accountId.slice(5)) ? accountId.slice(5) : null;
async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail(415, 'json-required');
  let bytes = 0; const parts = [];
  for await (const part of req) { bytes += part.length; if (bytes > MAX_BODY) fail(413, 'body-too-large'); parts.push(part); }
  let value; try { value = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { fail(400, 'invalid-json'); }
  requireThat(plain(value), 'invalid-json'); return value;
}
export function createDatingService({ store, mode = store?.mode, accountConfig, operatorIds = [], verify, lifecycle, adultVerification, transport: transportConfig, authAdmission,
  discoveryAdapter, discoveryFactory = createDiscoveryAdapter, appointmentsAdapter = createAppointmentsAdapter(), clock = () => new Date() } = {}) {
  if (!store?.transaction || store.mode !== mode || !['demo', 'account'].includes(mode) || typeof clock !== 'function'
    || !Array.isArray(operatorIds) || operatorIds.some(value => !id(value))) throw new TypeError('A separate configured dating store and verified operators are required.');
  if (mode === 'demo' && verify) throw new TypeError('Demo and account verification must not be mixed.');
  if (mode === 'demo' && lifecycle !== undefined) throw new TypeError('Central lifecycle delivery is unavailable in demo mode.');
  if (mode === 'demo' && adultVerification !== undefined) throw new TypeError('Server adult verification is unavailable in the fictional demo.');
  if (transportConfig !== undefined && !exact(transportConfig, ['publicOrigin', 'trustedProxyIPs'])) throw new TypeError('Explicit dating transport settings are required.');
  const transport = createDatingTransport({ ...transportConfig, mode });
  const verifier = mode === 'account' ? verify || createDatingAccountVerifier(accountConfig) : null;
  const admission = mode === 'account' ? createDatingAdmission(authAdmission) : null;
  const lifecycleVerifier = lifecycle === undefined ? null : createDatingLifecycleVerifier(lifecycle);
  const adultVerifier = adultVerification === undefined ? null : createDatingAdultVerifier(adultVerification);
  // Bound whole sweeps as well as individual assertions. Capacity rejection
  // must happen before applyAdultChecks: it is not evidence to revoke consent.
  const adultAdmission = mode === 'account' ? createDatingAdmission({ maxActive: 2, maxQueued: 8, waitMs: 1000 }) : null;
  // A previously enforced database must not fall back to declarations when its
  // server verifier is accidentally omitted on restart.
  let adultRequired = mode === 'account' && store.transaction(tx => {
    if (adultVerifier || tx.accounts().some(row => !!row.document?.adultVerification)) tx.requireAdultVerification();
    return tx.adultRequired();
  });
  const operators = new Set(mode === 'demo' ? ['demo:operator'] : operatorIds);
  const demoTokens = new Map(), previews = new Map(), resultTokens = new Map(), introductions = createIntroductionsAdapter(), experience = createProductExperience(), alignment = createMeetingAlignment(); let stopped = false;
  const now = () => { const value = clock(); const at = new Date(value instanceof Date ? value.getTime() : value); if (!Number.isFinite(at.getTime())) throw new TypeError('Invalid dating clock'); return store.transaction(tx => tx.time(at.toISOString())); };
  async function authenticate(req, res) {
    const match = /^Bearer ([^\s]{1,8192})$/i.exec(req.headers.authorization || '');
    if (!match) fail(401, 'authentication-required');
    if (mode === 'demo') {
      const token = demoTokens.get(hash(match[1]));
      if (!token || token.expiresAt <= Date.parse(now())) fail(401, 'demo-session-expired');
      return Promise.resolve({ accountId: token.accountId });
    }
    if (!verifier) fail(503, 'account-not-configured');
    const controller = new AbortController(), cancel = () => controller.abort();
    req.once('aborted', cancel); res.once('close', cancel);
    if (req.aborted || res.destroyed) cancel();
    try {
      const identity = await admission.run(() => verifier(match[1]), { signal: controller.signal });
      if (!identity || !id(identity.accountId) || identity.accountId.startsWith('demo:')) fail(401, 'authentication-required');
      return { accountId: identity.accountId };
    } finally { req.removeListener('aborted', cancel); res.removeListener('close', cancel); }
  }
  async function checkAdults(req, res, subjectId, at) {
    const controller = new AbortController(), cancel = () => controller.abort();
    req.once('aborted', cancel); res.once('close', cancel);
    if (req.aborted || res.destroyed) cancel();
    try {
      return await adultAdmission.run(async () => {
        if (stopped) fail(503, 'service-closed');
        const deadline = performance.now() + 8000;
        const ids = store.transaction(tx => [...new Set([subjectId, ...tx.accounts()
          .filter(row => row.document && row.status !== 'deleted').map(row => row.id)])]);
        const batch = new AbortController(), cancelBatch = () => batch.abort();
        controller.signal.addEventListener('abort', cancelBatch, { once: true });
        if (controller.signal.aborted) cancelBatch();
        const checks = new Map(); let next = 0, timer;
        const assertReady = () => {
          if (performance.now() >= deadline) fail(429, 'account-busy');
          if (batch.signal.aborted) fail(499, 'request-cancelled');
          if (stopped) fail(503, 'service-closed');
        };
        const workers = Array.from({ length: Math.min(ids.length, 4, adultVerifier?.maxActive || 4) }, async () => {
          while (next < ids.length) {
            assertReady();
            const id = ids[next++];
            checks.set(id, adultVerifier ? await adultVerifier.check(id, at, { signal: batch.signal }) : { claim: null, unavailable: true });
          }
        });
        try {
          await Promise.race([Promise.all(workers), new Promise((_, reject) => {
            timer = setTimeout(() => {
              reject(Object.assign(new Error('account-busy'), { status: 429, code: 'account-busy' }));
              batch.abort();
            }, Math.max(0, deadline - performance.now()));
          })]);
          assertReady();
          return checks;
        } catch (error) { batch.abort(); throw error; }
        finally { clearTimeout(timer); controller.signal.removeEventListener('abort', cancelBatch); }
      }, { signal: controller.signal });
    } finally { req.removeListener('aborted', cancel); res.removeListener('close', cancel); }
  }
  const onboarded = row => row?.status === 'active' && row.document?.adult.selfDeclared === true && !!row.document.profile.nickname;
  function onboardingView(row) {
    const doc = row.document, profile = !!doc.profile.nickname, adult = doc.adult.selfDeclared === true;
    // Older completed documents predate explicit confirmation tracking. Keep
    // their established state; every newly created account records it exactly.
    const consents = doc.onboardingState ? doc.onboardingState.consentsConfirmed === true : profile && adult || Object.values(doc.consents).some(value => value === true);
    return { complete: onboarded(row) && consents, steps: { profile, adult, consents },
      missing: [!profile && 'nickname', !adult && 'adult-self-declaration', !consents && 'consents'].filter(Boolean) };
  }
  const centralBlocked = row => !!row?.centralAvailability && row.centralAvailability.status !== 'active';
  const centralReady = row => !centralBlocked(row) && !row?.centralAvailability?.resume_required;
  const centralView = row => row.centralAvailability ? { status: row.centralAvailability.status, sequence: row.centralAvailability.sequence,
    resumeRequired: row.centralAvailability.resume_required === 1, canResume: row.status === 'active' && !centralBlocked(row) && row.centralAvailability.resume_required === 1 } : null;
  const adultVerified = row => !adultRequired && !row?.document?.adultVerification || row?.adultCheck?.allowed === true;
  const adultReady = row => adultVerified(row) && (!adultRequired || row.document?.adultVerification?.resumeRequired !== true);
  const disclosed = row => onboarded(row) && centralReady(row) && adultReady(row) && row.document.consents.profilePublic;
  const publicAccount = row => disclosed(row) && !row.document.paused;
  const pairAccessible = (a, b) => disclosed(a) && disclosed(b) && a.document.consents.receiveInvitations && b.document.consents.receiveInvitations
    && !a.document.blocks.includes(b.id) && !b.document.blocks.includes(a.id);
  const connectedAllowed = (a, b) => pairAccessible(a, b) && !a.document.paused && !b.document.paused;
  const publicAnswers = (row, at) => projectPublicAnswers(row.document.profile, at);
  function bootstrapDemo(tx, at) {
    for (const sample of DEMO_SAMPLES) {
      const document = blank(at), values = { availability: 'weekend' };
      for (const axis of ['pace', 'plan', 'purpose', 'contact', 'rhythm', 'notice']) { values[`self.${axis}`] = sample[axis]; values[`wants.${axis}`] = 'any'; }
      document.profile = { nickname: sample.nickname, region: '가상 지역', intro: '직접 역할을 열어 초대와 약속에 응답하는 가상 성인 예시예요.', values, required: [] };
      document.adult = { selfDeclared: true, verified: false, at }; document.consents = { profilePublic: true, receiveInvitations: true, storePreferences: true };
      document.onboardingState.consentsConfirmed = true;
      // INSERT OR IGNORE preserves every user edit and deletion tombstone.
      tx.ensureAccount(`demo:${sample.role}`, document);
    }
  }
  function introState(tx, a, b, at) { return tx.introduction(a, b)?.document || introductions.create({ people: [a, b], at }); }
  function introRecord(tx, a, b, input) {
    const old = tx.introduction(a, b), state = old?.document || introductions.create({ people: [a, b], at: input.at });
    const next = introductions.record(state, { ...input, expectedRevision: state.revision });
    return tx.putIntroduction(a, b, next, old ? old.revision : null).document;
  }
  function syncDateGates(tx, actor, at) {
    for (const pair of tx.pairs(actor)) if (pair.document) for (const person of [pair.a, pair.b]) {
      const receiving = appointmentsAdapter.inspect(pair.document, { viewer: person, at }).me.receiving;
      if (!receiving || receiving.state === 'open') continue;
      const requestId = `date-gate-${hash(`${pair.id}:${person}:${receiving.appointmentId}:${receiving.proposalVersion}:${receiving.state}`).slice(0, 40)}`;
      const old = tx.introduction(pair.a, pair.b);
      if (old?.document.events.some(event => event.actor === person && event.requestId === requestId)) continue;
      introRecord(tx, pair.a, pair.b, { kind: 'close', actor: person, requestId, at });
    }
  }
  function introView(tx, pair, viewer, at, available = true, paused = false) {
    const row = tx.introduction(pair.a, pair.b);
    const projected = { ...introductions.inspect(row?.document || introductions.create({ people: [pair.a, pair.b], at }), { viewer, at, pairId: pair.id }),
      revision: row?.revision || 0 };
    projected.canDecline=projected.canRespond;
    if (!available) return { ...projected, current: null, accepted: false, canRespond: false, canDecline:false, canWithdraw: false, canSend: false, canReopen: false };
    if (paused) { projected.canRespond = false; projected.canDecline=false; projected.canReopen = false; projected.canSend = false; }
    if(!projected.accepted&&!currentIntroductionCompatible(tx,tx.account(pair.a),tx.account(pair.b),at,projected.current?.from)){
      projected.canRespond=false;projected.canSend=false;
    }
    return projected;
  }
  function ownReflections(pair, actor, at) {
    return pair.document ? appointmentsAdapter.inspect(pair.document, { viewer: actor, at }).me.reflections.map(item => ({ ...item, pairId: pair.id })) : [];
  }
  function closePairs(tx, actor, target = null, erase = false, at, retire = false) {
    if (!erase) for (const intro of tx.introductions(actor)) if (!target || intro.a === target || intro.b === target) {
      if (!retire) introRecord(tx, intro.a, intro.b, { kind: 'close', actor, requestId: randomUUID(), at });
      else {
        // Preserve the original history, but start a closed receiving gate with
        // no old invitation. A full 2000-event history cannot block a central hold.
        tx.retireIntroduction(intro, at);
        let state = introductions.create({ people: [intro.a, intro.b], at });
        for (const person of [intro.a, intro.b]) if (person === actor || introductions.inspect(intro.document, { viewer: person, at }).canReopen)
          state = introductions.record(state, { kind: 'close', actor: person, requestId: randomUUID(), at, expectedRevision: state.revision });
        tx.putIntroduction(intro.a, intro.b, state, intro.revision);
      }
    }
    if (erase) tx.eraseIntroductions(actor);
    for (const pair of tx.pairs(actor)) if ((!target || pair.a === target || pair.b === target) && (pair.status === 'active' || erase)) {
      tx.clearAlignment(pair.id, erase);
      if (erase && pair.document) {
        // Deleting my account must not erase the other person's own reflection.
        // Retain only that person's words, with no partner profile or schedule.
        const peer = tx.account(pair.a === actor ? pair.b : pair.a), reflections = peer?.document ? ownReflections(pair, peer.id, at) : [];
        if (reflections.length) {
          const unique = new Map([...(peer.document.archivedReflections || []), ...reflections].map(item => [`${item.pairId}:${item.appointmentId}`, item]));
          tx.updateAccount(peer, { ...peer.document, archivedReflections: [...unique.values()] });
        }
      }
      tx.updatePair(pair, erase ? null : pair.document, 'closed');
    }
  }
  function deleteDatingAccount(tx, row, at) {
    if (row.status === 'deleted') return row;
    closePairs(tx, row.id, null, true, at); tx.eraseReports(row.id); tx.eraseReceipts(row.id); tx.eraseExposures(row.id);
    // Keep no private shortlist reference to an account after its deletion.
    for (const owner of tx.accounts()) if (owner.id !== row.id && owner.document?.bookmarks?.some(item => item.targetAccountId === row.id))
      tx.updateAccount(owner, { ...owner.document, bookmarks: owner.document.bookmarks.filter(item => item.targetAccountId !== row.id), updatedAt: at });
    return tx.updateAccount(row, null, 'deleted');
  }
  function holdDatingAccount(tx, row, at) {
    if (!row?.document || row.status === 'deleted') return;
    closePairs(tx, row.id, null, false, at, true);
    tx.updateAccount(row, { ...row.document, consents: { ...row.document.consents, profilePublic: false, receiveInvitations: false },
      allowanceGeneration: (row.document.allowanceGeneration || 0) + 1,
      alignmentGeneration: (row.document.alignmentGeneration || 0) + 1, updatedAt: at });
  }
  function applyAdultChecks(tx, checks, at) {
    const conflicts = new Set();
    for (const [subjectId, checked] of checks) {
      let row = tx.account(subjectId); if (!row?.document || row.status === 'deleted') continue;
      const previous = row.document.adultVerification;
      const issuer = adultVerifier?.issuer || previous?.claim?.issuer;
      let claim = checked.claim, stale = false, conflictedSequence = previous?.conflictedSequence || null;
      if (claim && previous?.claim?.issuer === issuer) {
        if (claim.sequence < previous.claim.sequence) { claim = previous.claim; stale = true; }
        else if (claim.sequence === previous.claim.sequence && canonical(claim) !== canonical(previous.claim)) {
          conflictedSequence = Math.max(conflictedSequence || 0, claim.sequence); claim = null; conflicts.add(subjectId);
        }
      }
      // A transport retry may restore an identical trusted result. An
      // equivocated sequence cannot: only a higher authoritative claim clears
      // its persistent fence, including after restart or older late callbacks.
      if (claim && !stale && conflictedSequence && claim.sequence > conflictedSequence) conflictedSequence = null;
      const fenced = conflictedSequence && (!claim || claim.sequence <= conflictedSequence);
      const status = checked.unavailable || !claim || fenced || stale && previous?.status === 'unavailable' ? 'unavailable' : datingAdultStatus(claim, at);
      // Enabling the contract cannot relabel an old self-declared acceptance.
      const legacyAccess = (!previous || previous.claim?.issuer !== issuer) && (row.document.consents.profilePublic || row.document.consents.receiveInvitations || tx.pairs(subjectId).some(pair => pair.status === 'active'));
      const resumeRequired = previous?.resumeRequired === true || status !== 'verified' || legacyAccess;
      const hold = legacyAccess || status !== 'verified' && (row.document.consents.profilePublic || row.document.consents.receiveInvitations || tx.pairs(subjectId).some(pair => pair.status === 'active'));
      // Both people can expire in one read. Each retirement needs a distinct
      // logical time, just as independently delivered central holds do.
      if (hold) { at = tx.time(at, true); holdDatingAccount(tx, row, at); row = tx.account(subjectId); }
      const next = { claim: claim || (previous?.claim?.issuer === issuer ? previous?.claim || null : null), status, resumeRequired, conflictedSequence,
        checkedAt: previous?.checkedAt || at };
      const meaning = value => value ? { claim: value.claim, status: value.status, resumeRequired: value.resumeRequired, conflictedSequence: value.conflictedSequence || null } : null;
      if (canonical(meaning(previous)) !== canonical(meaning(next))) {
        next.checkedAt = at; tx.updateAccount(row, { ...row.document, adultVerification: next, updatedAt: at });
      }
    }
    return conflicts;
  }
  function adultTransaction(tx, checks, at) {
    if (!adultRequired) return tx;
    const decorate = row => row && ({ ...row, adultCheck: { checkedAt: checks.has(row.id) ? at : null,
      allowed: checks.has(row.id) && !checks.get(row.id).unavailable && row.document?.adultVerification?.status !== 'unavailable'
        && datingAdultStatus(row.document?.adultVerification?.claim, at) === 'verified' } });
    return { ...tx, account: key => decorate(tx.account(key)), accounts: () => tx.accounts().map(decorate),
      ensureAccount: (...args) => decorate(tx.ensureAccount(...args)), updateAccount: (...args) => decorate(tx.updateAccount(...args)) };
  }
  function applyAvailability(tx, event, at) {
    const priorSequence = tx.availabilitySequence(event.subjectId, event.sequence), previous = tx.centralAvailability(event.subjectId);
    if (priorSequence && priorSequence.status !== event.status || previous?.sequence === event.sequence && previous.status !== event.status)
      fail(409, 'lifecycle-sequence-conflict');
    tx.rememberAvailabilitySequence(event.subjectId, event.sequence, event.status);
    const row = tx.account(event.subjectId);
    if (row?.status === 'deleted' || previous && event.sequence <= previous.sequence) return 'ignored';
    const missingHold = event.status === 'active' && event.sequence > 1 && (!previous || previous.status === 'active');
    const hold = event.status !== 'active' || missingHold;
    tx.putCentralAvailability(event.subjectId, event.sequence, event.status, hold || previous?.resume_required === 1, at);
    if (hold) holdDatingAccount(tx, row, at);
    return 'applied';
  }
  const alignmentFields = ['self.plan', 'self.pace', 'self.notice'];
  function alignmentState(tx, pair) {
    const saved = tx.alignment(pair.id);
    return saved?.document || alignment.create({ revision: saved?.revision || 0 });
  }
  function alignmentContext(tx, pair, at) {
    const a = tx.account(pair.a), b = tx.account(pair.b), introduction = introView(tx, pair, pair.a, at);
    // A confirmed appointment that reached its start is consumed even if later
    // cancelled. A cancellation before its start does not establish a meeting.
    const started = tx.pairs(pair.a).filter(item => item.a === pair.a && item.b === pair.b && item.document).some(item => {
      const appointments = appointmentsAdapter.inspect(item.document, { viewer: pair.a, at }).appointments;
      return appointments.some(meeting => [{ ...meeting.proposal, people: meeting.people, closedAt: meeting.closedAt }, ...meeting.history].some(proposal =>
        proposal.people.every(person => person.response === 'accept') && Date.parse(proposal.schedule.startsAt) <= Date.parse(at)
        && (!proposal.closedAt || Date.parse(proposal.closedAt) >= Date.parse(proposal.schedule.startsAt))
        && (!proposal.supersededAt || Date.parse(proposal.supersededAt) >= Date.parse(proposal.schedule.startsAt))));
    });
    return { pairId: pair.id, available: pair.status === 'active' && connectedAllowed(a, b), firstMeetingStarted: started,
      introduction: { id: introduction.current?.id || null, sentAt: introduction.current?.sentAt || null, accepted: introduction.accepted },
      people: [a, b].map(account => { const values = publicAnswers(account, at).values; return { id: account.id, label: account.document?.profile.nickname || '', generation: account.document?.alignmentGeneration || 0,
        values: Object.fromEntries(alignmentFields.filter(field => own(values, field)).map(field => [field, values[field]])) }; }) };
  }
  function visibleProfiles(tx, me, at) {
    if (!publicAccount(me)) return [];
    return tx.accounts().filter(row => row.id !== me.id && !operators.has(row.id) && publicAccount(row)
      && !me.document.blocks.includes(row.id) && !row.document.blocks.includes(me.id)).map(row => { const current = publicAnswers(row, at), profile = row.document.profile; return { accountId: row.id,
        nickname: profile.nickname, region: profile.region, intro: profile.intro, values: current.values, required: current.required,
        adult: { selfDeclared: true, verified: false }, canConnect: connectedAllowed(me, row) }; });
  }
  function discoveryFor(tx, me, at) {
    const candidates = visibleProfiles(tx, me, at).slice(0, 100).map(profile => ({ id: profile.accountId, label: profile.nickname, tagline: profile.intro, region: profile.region,
      values: { ...profile.values, consent: true }, required: profile.required }));
    return discoveryFactory({ Domain, Ask, Personalization, ConditionalPreference, candidates, ownerId: me.id, contextId: mode === 'demo' ? 'dating-demo-accounts' : 'dating-account', synthetic: false });
  }
  function meetingRegionsCompatible(tx,a,b,at){
    if(!a?.document||!b?.document)return false;
    const publicA=publicAnswers(a,at).values['self.meetingRegions'],publicB=publicAnswers(b,at).values['self.meetingRegions'];
    const declared=row=>row.document.consents.storePreferences&&row.document.discovery
      ?discoveryFor(tx,row,at).meetingRegionDeclaration(row.document.discovery,{at}):null;
    const privateA=declared(a),privateB=declared(b);
    if(!publicA&&!publicB&&!privateA&&!privateB&&!own(a.document.profile.values,'self.meetingRegions')&&!own(b.document.profile.values,'self.meetingRegions'))return true;
    return compareMeetingRegions(privateA,publicB).status==='overlap'&&compareMeetingRegions(privateB,publicA).status==='overlap';
  }
  function currentIntroductionCompatible(tx, a, b, at, senderId) {
    if (!a?.document || !b?.document || !meetingRegionsCompatible(tx,a,b,at)) return false;
    const aa = publicAnswers(a,at), bb = publicAnswers(b,at);
    // Expiration must not silently remove a public required choice, including
    // a formerly published "any". Missing old optional fields remain compatible.
    if ([aa,bb].some(answer => answer.expiredFields.includes('availability'))) return false;
    for (const [owner, peer] of [[aa,bb],[bb,aa]]) for (const field of owner.required) {
      if (owner.expiredFields.includes(field)) return false;
      if (owner.values[field] !== 'any' && peer.expiredFields.includes(field.replace('wants.','self.'))) return false;
    }
    // A pending request is rechecked against its sender's current required
    // recommendation evidence. It does not invent recipient private answers.
    const sender = senderId === a.id ? a : senderId === b.id ? b : null;
    const recipient = sender === a ? b : a;
    return !sender || !!sender.document.discovery && discoveryFor(tx,sender,at).inspect(sender.document.discovery,{at}).candidates
      .some(candidate => candidate.id === recipient.id && candidate.status === 'eligible');
  }
  function migrateDemoDiscovery(tx, row, at) {
    const old = row.document?.discovery;
    if (mode !== 'demo' || !old || own(old, 'ownerId')) return row;
    const legacy = discoveryAdapter || createDiscoveryAdapter({ Domain, Ask, Personalization });
    const previous = legacy.inspect(old, { at }), adapter = discoveryFor(tx, row, at), remapped = new Map();
    const obsolete = new Set(['select', 'unselect', 'expose', 'feedback', 'restore-candidate', 'hide-candidate', 'unhide-candidate', 'skip']);
    let events = old.events.filter(event => !obsolete.has(event.kind)).map((event, index) => { const id = `event-${index + 1}`; remapped.set(event.id, id); return { ...clone(event), id }; });
    events = events.map(event => ({ ...event, ...(event.changeId ? { changeId: remapped.get(event.changeId) } : {}), ...(event.sceneResponseId ? { sceneResponseId: remapped.get(event.sceneResponseId) } : {}) }));
    let state = { ...adapter.create('first', { at }), events };
    if (events.length < 500) {
      // Candidate-bound observations and old selections are never reinterpreted as account activity.
      state = adapter.record(state, { kind: 'start-context', at: new Date(Math.max(Date.parse(at), Date.parse(events.at(-1)?.at || at) + 1)).toISOString() });
    } else {
      // A full legacy log is archived intact. Compact its currently valid baseline
      // declarations only; expired and once-only answers cannot become permanent.
      state = adapter.create('first', { at });
      for (const field of previous.fields) {
        const eventAt = new Date(Date.parse(at) + state.events.length).toISOString();
        const known = field.baseline.state === 'known' && (!field.baseline.provenance?.until || Date.parse(field.baseline.provenance.until) > Date.parse(eventAt));
        const lastDeclared = old.events.filter(event => event.kind === 'set' && event.field === field.id && event.target !== 'context').at(-1);
        if (!known && !(field.required && field.id.startsWith('wants.') && lastDeclared)) continue;
        state = adapter.record(state, { kind: 'set', field: field.id, value: known ? field.baseline.value : lastDeclared.value, required: field.required, target: 'baseline', at: eventAt,
          ...(known && field.baseline.provenance?.until ? { until: field.baseline.provenance.until } : {}) });
        if (!known) state = adapter.record(state, { kind: 'clear', field: field.id, target: 'baseline', at: new Date(Date.parse(at) + state.events.length).toISOString() });
      }
      const preserve = action => { state = adapter.record(state, { ...action, at: new Date(Date.parse(at) + state.events.length).toISOString() }); };
      if (previous.priorities.baseline.length) preserve({ kind: 'priorities', fields: previous.priorities.baseline, target: 'baseline' });
      if (previous.questionControl.mode) preserve({ kind: 'question-mode', mode: previous.questionControl.mode });
      if (previous.questionsPaused) preserve({ kind: 'stop-questions' });
      for (const reason of previous.reasons) preserve({ kind: 'reason', field: reason.field, value: reason.value });
      state = adapter.record(state, { kind: 'start-context', at: new Date(Date.parse(at) + state.events.length).toISOString() });
    }
    const finalAt = state.events.at(-1).at; tx.time(finalAt);
    adapter.inspect(state, { at: finalAt });
    const document = { ...row.document, discovery: state, discoveryEpoch: randomUUID(), legacyDiscovery: clone(old),
      discoveryMigration: { at: finalAt, from: 'fixed-fictional-pool', notice: '추천과 초대를 같은 가상 계정으로 연결했어요. 평소 답은 유지하고 새 추천 상황을 시작했어요. 이전 가상 후보 선택과 이번만 답은 새 계정에 옮기지 않았어요.' } };
    tx.eraseExposures(row.id); return tx.updateAccount(row, document);
  }
  function balanceExposure(tx, discovery) {
    if (mode !== 'account' || !discovery?.topTierIds?.length) return discovery;
    const counts = tx.exposureCounts(), tier = new Set(discovery.topTierIds);
    const ranked = discovery.candidates.filter(candidate => tier.has(candidate.id))
      .sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0));
    let index = 0;
    return { ...discovery, candidates: discovery.candidates.map(candidate => tier.has(candidate.id) ? ranked[index++] : candidate),
      topCandidateId: ranked[0]?.id || discovery.topCandidateId,
      tieNotice: ranked.length > 1 ? '명시한 조건에서 같은 우선순위예요. 계정 전체에서 덜 표시된 후보부터 순서를 나눴어요. 호감이나 수락 가능성을 뜻하지 않아요.' : discovery.tieNotice };
  }
  const candidateKey = id => `candidate.${hash(id).slice(0, 40)}`;
  const experienceWorkspace = actor => `dating.${hash(actor).slice(0, 40)}`;
  const ownCriteria = projected => ({ context: { id: projected.context.id, closed: projected.context.closed, expiresAt: projected.context.expiresAt },
    fields: projected.fields.map(field => ({ id: field.id, state: field.state, value: field.value, required: field.required, requiredValue: field.requiredValue,
      baseline: { state: field.baseline.state, value: field.baseline.value }, context: { state: field.context.state, value: field.context.value } })), priorities: projected.priorities,
    conditionalPreference: projected.conditionalPreference || null });
  const criteriaKey = (state, projected) => hash(canonical({ criteria: ownCriteria(projected),
    // Event lineage prevents a later undo or identical re-entry from reviving an old correction.
    lineage: state.events.filter(event => ['set', 'clear', 'mark-unknown', 'revert-context', 'start-context', 'close-context', 'undo-field', 'priorities', 'undo-priorities'].includes(event.kind)
      || ['conditional-set', 'conditional-clear'].includes(event.kind)
      || event.kind === 'feedback' && event.decision === 'skip-current').map(event => event.id) }));
  const visibleKeys = projected => (projected?.candidates || []).map(candidate => candidateKey(candidate.id));
  function currentAllowance(tx, row, current, candidateId, at) {
    const projected = current.projected, candidate = projected.candidates.find(item => item.id === candidateId), condition = projected.conditionalPreference;
    if (row.status !== 'active' || row.document.paused || !publicAccount(row) || !row.document.consents.storePreferences
      || projected.context.closed || candidate?.status !== 'eligible' || condition?.effective?.status !== 'active'
      || !candidate.reasonDetails?.some(reason => reason.owner === 'self' && reason.field === 'wants.contact' && reason.comparison === 'conditional'
        && reason.conditionStatus === 'satisfied' && reason.conditionalRuleId === 'contact-with-notice')) return null;
    const peer = tx.account(candidateId), rule = condition.effective.rule;
    if (!peer || !publicAccount(peer)) return null;
    const ruleKey = hash(canonical(rule)), candidatePublicKey = hash(canonical({ profile: publicAnswers(peer,at), generation: peer.document.allowanceGeneration || 0 }));
    const ownerGeneration = row.document.allowanceGeneration || 0, contextId = projected.context.id;
    const ownKey = hash(canonical({ criteria: ownCriteria(projected), epoch: row.document.discoveryEpoch,
      // Preserve declaration/condition lineage without treating question controls or private reaction notes as changed evidence.
      lineage: current.state.events.filter(event => ['set', 'clear', 'mark-unknown', 'revert-context', 'start-context', 'close-context', 'undo-field', 'priorities', 'undo-priorities', 'conditional-set', 'conditional-clear'].includes(event.kind)
        || event.candidateId === candidateId && (['hide-candidate', 'unhide-candidate', 'restore-candidate'].includes(event.kind)
          || event.kind === 'feedback' && event.decision === 'skip-current')).map(event => event.id) }));
    const binding = hash(canonical({ ruleKey, candidatePublicKey, ownerGeneration, contextId, ownKey }));
    const limits = [rule.until, rule.source.until, projected.context.expiresAt].filter(Boolean);
    return { id: rule.id, target: condition.target, description: condition.description, capturedAt: at,
      ...(limits.length ? { until: new Date(Math.min(...limits.map(Date.parse))).toISOString() } : {}), binding, ruleKey, ruleAt: rule.at,
      source: { eventId: rule.source.eventId, at: rule.source.at, duration: rule.source.duration, encounterId: rule.source.encounterId,
        ...(rule.source.until ? { until: rule.source.until } : {}) }, contextId, candidatePublicKey, ownerGeneration, ownKey, responseRevision: 0 };
  }
  function allowanceBinding(tx, row, record, current, at) {
    if (!record?.allowance) return null;
    const candidate = current.projected.candidates.find(item => candidateKey(item.id) === record.selectedId);
    return candidate ? currentAllowance(tx, row, current, candidate.id, at)?.binding || null : null;
  }
  function allowanceAction(tx, row, input, current, at) {
    if (!exact(input, ['decisionId']) || !uuid(input.decisionId)) fail(400, 'invalid-allowance-review');
    const state = row.document.experience || experience.create(), record = state.records.find(item => item.id === input.decisionId);
    let source; try { source = experience.allowanceSource(state, input.decisionId, at, { binding: allowanceBinding(tx, row, record, current, at), requireStop: true }); }
    catch { fail(409, 'allowance-review-unavailable'); }
    return { action: { kind: 'conditional-clear', target: source.target }, responseKey: hash(canonical({ binding: source.binding, response: source.response, revision: source.responseRevision })) };
  }
  function recordExplicitExposure(tx, row, doc, candidateIds, at, adapter = discoveryFor(tx, row, at)) {
    doc.discovery = adapter.record(doc.discovery || adapter.create('first', { at }), { kind: 'expose', candidateIds, at });
    if (!doc.discoveryEpoch) doc.discoveryEpoch = randomUUID();
    if (mode === 'account') {
      const current = adapter.inspect(doc.discovery, { at });
      for (const candidate of candidateIds) tx.expose(row.id, `${doc.discoveryEpoch}:${current.context.id}`, candidate);
    }
  }
  const priorityKey = (state, target = 'context') => hash(canonical(state.events.filter(event => {
    const source = event.kind === 'undo-priorities' ? state.events.find(item => item.id === event.changeId) : event;
    return ['priorities', 'undo-priorities'].includes(event.kind) && (source?.target || 'baseline') === target;
  }).map(event => event.id)));
  const effectivePriorityTarget = projected => projected.priorities.context !== null && !projected.priorities.expired?.context ? 'context' : 'baseline';
  const effectivePriorityDeadline = projected => { const target = effectivePriorityTarget(projected);
    return projected.priorities.expired?.[target] ? null : projected.priorities.deadlines?.[target] || null; };
  const restorationKey = (projected, action) => hash(canonical(action.kind === 'undo-priorities'
    ? { priorities: projected.priorities, lineage: projected.priorityChanges.map(item => item.id) }
    : projected.fields.find(field => field.id === action.field)));
  function captureMeetingCriteria(tx, row, doc, pairId, at) {
    if (!doc.consents.storePreferences || !doc.discovery) return;
    const projected = discoveryFor(tx, row, at).inspect(doc.discovery, { at });
    const criteria = projected.priorities.effective.flatMap(fieldId => {
      const field = projected.fields.find(item => item.id === fieldId), provenance = field?.effective.provenance;
      return field?.state === 'known' && provenance?.eventId ? [{ field: field.id, label: field.label, value: field.value, valueLabel: field.valueLabel,
        declarationId: provenance.eventId, declarationTarget: field.source, ...(provenance.until ? { until: provenance.until } : {}) }] : [];
    });
    const priorityTarget = effectivePriorityTarget(projected);
    doc.experience = experience.captureCriteria(doc.experience || experience.create(), { pairId, contextId: projected.context.id,
      priorityTarget, priorityKey: priorityKey(doc.discovery, priorityTarget), criteria }, at);
  }
  const criterionPriorityKey = current => hash(canonical({ baseline: priorityKey(current.state, 'baseline'), context: priorityKey(current.state, 'context'), priorities: current.projected.priorities }));
  function criterionReflectionSnapshot(row, pair, fieldId, current) {
    const field = current.projected.fields.find(item => item.id === fieldId), provenance = field?.effective.provenance;
    if (row.status !== 'active' || row.document.paused || !row.document.consents.storePreferences || current.projected.context.closed
      || fields.get(fieldId)?.kind !== 'wants' || fields.get(fieldId)?.legacy || field?.state !== 'known' || field.value === 'any' || !provenance?.eventId
      || current.projected.priorities.effective.includes(fieldId)) fail(409, 'criterion-review-unavailable');
    return { contextId: current.projected.context.id, priorityKey: criterionPriorityKey(current), criteria: [...current.projected.priorities.effective],
      selectedId: candidateKey(row.id === pair.a ? pair.b : pair.a), criterion: { field: field.id, label: field.label, value: field.value, valueLabel: field.valueLabel,
        declarationId: provenance.eventId, declarationTarget: field.source, ...(provenance.until ? { until: provenance.until } : {}) } };
  }
  function criterionAction(tx, row, input, current, at) {
    requireThat(exact(input, ['pairId', 'appointmentId', 'field', 'target', 'replaceField', 'until']) && id(input.pairId) && id(input.appointmentId) && fields.has(input.field), 'invalid-preview');
    const source = experience.criterionSource(row.document.experience || experience.create(), input, at), pair = tx.pair(input.pairId);
    if (!pair || pair.status !== 'active' || !pair.document || ![pair.a, pair.b].includes(row.id)
      || !pairAccessible(tx.account(pair.a), tx.account(pair.b))) fail(409, 'criterion-review-unavailable');
    const appointment = appointmentsAdapter.inspect(pair.document, { viewer: row.id, at }).appointments.find(item => item.id === input.appointmentId);
    const field = current.projected.fields.find(item => item.id === input.field), ownPerson = appointment?.people.find(person => person.id === row.id);
    if (source.review.response.value === 'more-important') {
      requireThat(['baseline', 'context'].includes(input.target) && (!own(input, 'until') || typeof input.until === 'string' && Number.isFinite(Date.parse(input.until))
        && new Date(input.until).toISOString() === input.until && Date.parse(input.until) > Date.parse(at)), 'invalid-preview');
      if (!appointment?.canReflect || appointment.proposal.version !== source.review.proposalVersion || ownPerson.completedAt !== source.review.completedAt)
        fail(409, 'criterion-review-unavailable');
      const effectiveTarget = effectivePriorityTarget(current.projected);
      const captured = source.review.source, now = criterionReflectionSnapshot(row, pair, input.field, current), limits = [source.criterion.until, effectivePriorityDeadline(current.projected)];
      if (canonical(captured) !== canonical(now) || input.target === 'baseline' && source.criterion.declarationTarget !== 'baseline'
        || input.target === 'baseline' && effectiveTarget !== 'baseline') fail(409, 'criterion-review-unavailable');
      if (input.target === 'context') limits.push(current.projected.context.expiresAt);
      const maximum = limits.filter(Boolean).length ? new Date(Math.min(...limits.filter(Boolean).map(Date.parse))).toISOString() : null;
      if (maximum && input.until && Date.parse(input.until) > Date.parse(maximum)) fail(400, 'criterion-scope-exceeded');
      const existing = current.projected.priorities.effective;
      requireThat(existing.length === 2 ? typeof input.replaceField === 'string' && existing.includes(input.replaceField) : !own(input, 'replaceField'), 'criterion-replacement-required');
      const until = input.until || maximum;
      return { kind: 'priorities', fields: [...existing.filter(field => field !== input.replaceField), input.field], target: input.target, ...(until ? { until } : {}) };
    }
    requireThat(!['target', 'replaceField', 'until'].some(key => own(input, key)), 'invalid-preview');
    const priorityTarget = effectivePriorityTarget(current.projected);
    if (!appointment?.canReflect || appointment.proposal.version !== source.review.proposalVersion || ownPerson.completedAt !== source.review.completedAt
      || ((source.priorityTarget !== 'baseline' || source.criterion.declarationTarget !== 'baseline') && source.contextId !== current.projected.context.id)
      || current.projected.context.closed || priorityTarget !== source.priorityTarget || source.priorityKey !== priorityKey(current.state, priorityTarget)
      || !current.projected.priorities.effective.includes(input.field) || field?.state !== 'known' || field.value !== source.criterion.value
      || field.effective.provenance?.eventId !== source.criterion.declarationId) fail(409, 'criterion-review-unavailable');
    const limits = [effectivePriorityDeadline(current.projected), current.projected.context.expiresAt].filter(Boolean);
    return { kind: 'priorities', fields: current.projected.priorities.effective.filter(field => field !== input.field), target: 'context',
      ...(limits.length ? { until: new Date(Math.min(...limits.map(Date.parse))).toISOString() } : {}) };
  }
  function restoreAction(row, decisionId, current, at) {
    requireThat(uuid(decisionId), 'invalid-preview');
    let source;
    try { source = experience.restoreSource(row.document.experience || experience.create(), decisionId, at, visibleKeys(current.projected)); }
    catch { fail(409, 'restoration-unavailable'); }
    if (source.contextId !== current.projected.context.id || current.projected.context.closed) fail(409, 'restoration-unavailable');
    const changes = source.action.kind === 'undo-priorities' ? current.projected.priorityChanges : current.projected.changes;
    // Only this declaration may be reverted; other fields stay independent. The
    // actual preview/apply still runs the adapter's complete validation.
    if (!source.currentKey || source.currentKey !== restorationKey(current.projected, source.action)
      || !changes?.some(item => item.id === source.action.changeId && item.canUndo)) fail(409, 'restoration-unavailable');
    return source.action;
  }
  function changedCriteria(before, after) {
    const a = ownCriteria(before), b = ownCriteria(after), caption = field => `평소: ${field.baseline.valueLabel} / 이번: ${field.context.valueLabel} / ${field.required ? '필수' : '필수 아님'}`;
    const changes = b.fields.flatMap((field, index) => canonical(a.fields[index]) === canonical(field) ? []
      : [{ field: field.id, before: caption(before.fields[index]), after: caption(after.fields[index]) }]);
    if (canonical(a.priorities) !== canonical(b.priorities)) {
      const labels = value => ['baseline', 'context'].map(key => `${key === 'baseline' ? '평소' : '이번'}: ${value[key] === null ? '평소 기준을 따름' : value[key].map(id => fields.get(id)?.label || id).join(', ') || '별도 우선순위 없음'}`).join(' / ');
      changes.push({ field: 'priorities', before: labels(a.priorities), after: labels(b.priorities) });
    }
    if (canonical(before.conditionalPreference) !== canonical(after.conditionalPreference)) {
      const clock = at => `${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(at))} (한국 시간)`;
      const caption = owner => {
        const projection = owner.conditionalPreference;
        const layer = target => {
          const item = projection?.[target], range = target === 'baseline' ? '평소 허용(앞으로도)' : '이번 허용(이번 추천에서만)';
          if (!item?.rule) return `${range}: 없음`;
          const status = item.status === 'active' ? '사용 가능' : ({ 'rule-expired': '허용 기한이 지나 사용 안 함', 'source-expired': '원래 답의 기한이 지나 사용 안 함',
            'source-changed': '원래 답을 다시 확인하거나 바꾸어 사용 안 함', 'required-primary': '연락 필수조건을 유지하므로 사용 안 함',
            'context-ended': '해당 추천 회차가 끝나 사용 안 함', 'not-yet-declared': '아직 적용 시점 전' }[item.reason] || '현재 사용 안 함');
          const limits = [[item.rule.until, '허용 조건'], [item.rule.source.until, '원래 연락 답'], ...(target === 'context' ? [[owner.context.expiresAt, '이번 회차']] : [])].filter(([at]) => at);
          const earliest = limits.length ? Math.min(...limits.map(([at]) => Date.parse(at))) : null;
          const deadline = earliest === null ? '별도 종료 시점 없음' : `${clock(earliest)}까지 · ${limits.filter(([at]) => Date.parse(at) === earliest).map(([, label]) => label).join('·')} 기한`;
          return `${range}: ${status}, ${deadline}${target === 'context' ? ' · 회차가 먼저 끝나면 함께 종료' : ''}`;
        };
        const effective = projection?.effective?.status === 'active' ? projection.target === 'context' ? '이번 허용 사용' : '평소 허용 사용' : '조건부 허용 없이 원래 연락 기준으로 비교';
        const original = owner.fields.find(field => field.id === 'wants.contact');
        return `${projection?.description || '직접 정한 연락 간격의 허용 조건'} / ${layer('baseline')} / ${layer('context')} / 현재 비교: ${effective} / 원래 연락 답: ${original?.valueLabel || '미확인'}`;
      };
      const sameEffective = before.conditionalPreference?.target === after.conditionalPreference?.target
        && canonical(before.conditionalPreference?.effective) === canonical(after.conditionalPreference?.effective);
      const sameOriginal = canonical(a.fields.find(field => field.id === 'wants.contact')) === canonical(b.fields.find(field => field.id === 'wants.contact'));
      const continuity = `${sameEffective ? ' 현재 사용하는 허용 조건은 그대로예요.' : ''}${sameOriginal ? ' 원래 연락 답은 바뀌지 않아요.' : ''}`;
      changes.push({ field: 'conditional.contact', before: caption(before), after: caption(after) + continuity });
    }
    return changes.filter(change => change.before !== change.after);
  }
  function tokenFor(map, data, at) {
    for (const [key, row] of map) if (Date.parse(row.expiresAt) <= Date.parse(at)) map.delete(key);
    if (map.size >= 2000) map.delete(map.keys().next().value);
    const token = randomBytes(32).toString('base64url'); map.set(token, { ...data, expiresAt: new Date(Date.parse(at) + 5 * 60000).toISOString() }); return token;
  }
  function discoverySnapshot(tx, row, at) {
    if (row.status !== 'active' || !row.document.adult.selfDeclared || row.document.paused || !row.document.consents.storePreferences) fail(403, 'discovery-unavailable');
    const adapter = discoveryFor(tx, row, at), state = row.document.discovery || adapter.create('first', { at });
    const projected = balanceExposure(tx, adapter.inspect(state, { at }));
    const binding = hash(canonical({ revision: row.revision, pool: visibleProfiles(tx, row, at), ownPublicAnswers: publicAnswers(row,at), counts: mode === 'account' ? tx.exposureCounts() : null,
      // Time itself changes each request; evaluated meaning (including expiry) binds the review instead.
      context: projected.context, fields: projected.fields, candidates: projected.candidates, top: projected.topCandidateId, question: projected.question, priorities: projected.priorities || null,
      conditionalPreference: projected.conditionalPreference || null }));
    return { adapter, state, projected, binding };
  }
  function ownedToken(map, token, actor, at) {
    const record = typeof token === 'string' && map.get(token);
    if (!record || record.actor !== actor || Date.parse(record.expiresAt) <= Date.parse(at)) fail(409, 'preview-stale');
    return record;
  }
  function preview(tx, row, input, at) {
    requireThat(exact(input, ['expectedRevision', 'action', 'sourceDecisionId', 'criterionReview', 'restoreDecisionId', 'allowanceReview', 'exposedCandidateIds']) && Number.isSafeInteger(input.expectedRevision)
      && ['action', 'criterionReview', 'restoreDecisionId', 'allowanceReview'].filter(key => own(input, key)).length === 1
      && (!own(input, 'sourceDecisionId') || own(input, 'action') && uuid(input.sourceDecisionId))
      && (!own(input, 'action') || plain(input.action) && !['at', 'id', 'actor', 'person'].some(key => own(input.action, key))), 'invalid-preview');
    if (row.revision !== input.expectedRevision) fail(409, 'revision-conflict');
    const current = discoverySnapshot(tx, row, at);
    const allowance = input.allowanceReview ? allowanceAction(tx, row, input.allowanceReview, current, at) : null;
    const action = allowance ? allowance.action : input.criterionReview ? criterionAction(tx, row, input.criterionReview, current, at)
      : input.restoreDecisionId ? restoreAction(row, input.restoreDecisionId, current, at) : input.action;
    const startingContext = action.kind === 'start-context';
    if (startingContext && input.sourceDecisionId || own(input, 'exposedCandidateIds') && !startingContext) fail(400, 'invalid-context-preview');
    if (startingContext) requireThat(Array.isArray(input.exposedCandidateIds) && input.exposedCandidateIds.length <= 100
      && new Set(input.exposedCandidateIds).size === input.exposedCandidateIds.length
      && input.exposedCandidateIds.every(candidateId => typeof candidateId === 'string'
        && current.projected.candidates.some(candidate => candidate.id === candidateId && candidate.status === 'eligible')), 'invalid-context-exposure');
    if (input.sourceDecisionId && ['conditional-set', 'conditional-clear'].includes(action.kind)) fail(400, 'conditional-correction-link-unsupported');
    // Preview the exact old-context exposure/start sequence without writing either
    // account preferences or shared exposure counts. The opaque token owns it.
    let previewState = current.state, exposureAt = null;
    if (startingContext && input.exposedCandidateIds.length) {
      exposureAt = new Date(Math.max(Date.parse(at), Date.parse(current.state.events.at(-1)?.at || at) + 1)).toISOString();
      previewState = current.adapter.record(previewState, { kind: 'expose', candidateIds: input.exposedCandidateIds, at: exposureAt });
    }
    const proposed = current.adapter.preview(previewState, action, { at: exposureAt || at });
    if (input.sourceDecisionId) experience.correctionSource(row.document.experience || experience.create(), input.sourceDecisionId, at, visibleKeys(current.projected));
    const afterState = current.adapter.applyPreview(previewState, proposed, { at: exposureAt || at }), afterAt = afterState.events.at(-1).at;
    let previewTx = tx;
    if (startingContext && mode === 'account') {
      const counts = { ...tx.exposureCounts() };
      for (const candidateId of input.exposedCandidateIds) if (!current.projected.exposure.some(item => item.candidateId === candidateId && item.currentCount > 0))
        counts[candidateId] = (counts[candidateId] || 0) + 1;
      previewTx = { ...tx, exposureCounts: () => counts };
    }
    const after = balanceExposure(previewTx, current.adapter.inspect(afterState, { at: afterAt }));
    const summary = data => ({ topCandidateId: data.topCandidateId, topLabel: data.candidates.find(candidate => candidate.id === data.topCandidateId)?.label || null,
      eligibleIds: data.candidates.filter(candidate => candidate.status === 'eligible').map(candidate => candidate.id) });
    const beforeSummary = summary(current.projected), afterSummary = summary(after);
    const criterionSource = input.criterionReview ? experience.criterionSource(row.document.experience || experience.create(), input.criterionReview, at) : null;
    const criterionChange = criterionSource?.review.response.value === 'more-important' ? { kind: 'more-important', label: criterionSource.criterion.label,
      valueLabel: criterionSource.criterion.valueLabel, target: action.target,
      replaceLabel: input.criterionReview.replaceField ? fields.get(input.criterionReview.replaceField).label : null,
      until: action.until || null, completedAt: criterionSource.review.completedAt } : null;
    const token = tokenFor(previews, { actor: row.id, revision: row.revision, binding: current.binding, proposed, sourceDecisionId: input.sourceDecisionId || null,
      criterionReview: input.criterionReview || null, restoreDecisionId: input.restoreDecisionId || null,
      contextExposure: startingContext ? { candidateIds: clone(input.exposedCandidateIds), at: exposureAt, contextId: current.projected.context.id } : null,
      allowanceReview: input.allowanceReview ? { ...clone(input.allowanceReview), responseKey: allowance.responseKey } : null }, at);
    return { ok: true, preview: { token, sourceDecisionId: input.sourceDecisionId || null, expiresAt: previews.get(token).expiresAt, before: beforeSummary, after: { ...afterSummary, status: after.status },
      ...(criterionChange ? { criterionChange } : {}),
      ...(proposed.contextTransition ? { contextTransition: proposed.contextTransition } : {}),
      entered: proposed.entered, left: proposed.left, held: proposed.held, selectionWillClear: proposed.selectionWillClear, changes: changedCriteria(current.projected, after),
      summary: !afterSummary.topCandidateId ? '적용하면 현재 확인된 조건에서 추천을 보류해요.' : beforeSummary.topCandidateId === afterSummary.topCandidateId
        ? `적용해도 ${afterSummary.topLabel}부터 살펴보는 순서는 같아요.` : `적용하면 ${afterSummary.topLabel}부터 살펴봐요.` } };
  }
  function view(tx, row, at, isOperator) {
    if (row.status === 'deleted') return { accountId: row.id, revision: row.revision, status: 'deleted', deleted: true, pairs: [], candidates: [], inbox: [] };
    if (centralBlocked(row)) return { accountId: row.id, revision: row.revision, status: row.status, mode, synthetic: mode === 'demo',
      centralAvailability: centralView(row), pairs: [], candidates: [], inbox: [], introductions: [], discovery: null };
    syncDateGates(tx, row.id, at);
    const doc = row.document, candidates = visibleProfiles(tx, row, at), pairRows = tx.pairs(row.id);
    let cachedDiscovery; const currentDiscovery = () => cachedDiscovery ||= discoverySnapshot(tx, row, at);
    const pairs = pairRows.map(pair => {
      const a = tx.account(pair.a), b = tx.account(pair.b);
      const accessible = pairAccessible(a, b), paused = !!(a?.document?.paused || b?.document?.paused);
      const introduction = introView(tx, pair, row.id, at, accessible, paused);
      if (pair.status !== 'active' || !accessible) return { pairId: pair.id, revision: pair.revision, status: 'closed', introduction: { ...introduction, current: null, accepted: false, canSend: false, canRespond: false, canWithdraw: false }, view: null };
      const projected = appointmentsAdapter.inspect(pair.document, { viewer: row.id, at });
      if (paused || !introduction.accepted) { projected.canPropose = false; for (const item of projected.appointments) { item.canRevise = false; item.canRespond = false; } }
      if (paused && projected.me.receiving) projected.me.receiving.canReopen = false;
      const availability = account => { const value = publicAnswers(account,at).values.availability; return ['weekend', 'weekday', 'any'].includes(value) ? value : null; };
      const partner = row.id === a.id ? b : a;
      const scheduleContext = { myAvailability: availability(row), partnerAvailability: availability(partner), source: 'public-profile', asOf: at };
      // A client-memory draft guard, not authorization or persisted draft content. Exclude reads and private counterpart reactions.
      const scheduleDraftBasis = hash(canonical({ actor: row.id, pairId: pair.id,
        introduction: { id: introduction.accepted ? introduction.current?.id || null : null, accepted: introduction.accepted, revision: introduction.revision },
        ownerGeneration: doc.allowanceGeneration || 0, partnerGeneration: partner.document.alignmentGeneration || 0,
        scheduleEvents: pair.document.events.filter(event => ['propose', 'revise', 'respond', 'cancel', 'complete', 'reopen'].includes(event.kind)).map(event => event.id),
        nextForm: projected.me.nextForm || null,
        availability: { mine: scheduleContext.myAvailability, partner: scheduleContext.partnerAvailability } }));
      const savedCriteria = doc.experience?.meetingCriteria?.find(item => item.pairId === pair.id);
      const criterionReviews = projected.appointments.map(appointment => {
        const review = savedCriteria?.reviews.find(item => item.appointmentId === appointment.id);
        const current = !paused && row.status === 'active' && doc.adult.selfDeclared && doc.consents.storePreferences ? currentDiscovery() : null;
        const addedCriteria = appointment.canReflect && current ? current.projected.fields.flatMap(field => {
          try { const source = criterionReflectionSnapshot(row, pair, field.id, current); return [{ field: field.id, label: field.label, value: source.criterion.value, valueLabel: field.valueLabel }]; }
          catch { return []; }
        }) : [];
        let canPreview = false;
        if (review?.response.value === 'less-important' && !paused) try {
          criterionAction(tx, row, { pairId: pair.id, appointmentId: appointment.id, field: review.field }, currentDiscovery(), at); canPreview = true;
        } catch { /* Ineligible source stays a personal reflection, not a suggested mutation. */ }
        if (review?.response.value === 'more-important' && !paused) try {
          criterionAction(tx, row, { pairId: pair.id, appointmentId: appointment.id, field: review.field, target: 'context',
            ...(current.projected.priorities.effective.length === 2 ? { replaceField: current.projected.priorities.effective[0] } : {}) }, current, at); canPreview = true;
        } catch { /* A saved reflection is never authority to revive a stale declaration. */ }
        return { appointmentId: appointment.id, criteria: (savedCriteria?.criteria || []).map(({ field, label, valueLabel }) => ({ field, label, valueLabel })),
          addedCriteria, canAdd: appointment.canReflect && !!addedCriteria.length, replacementOptions: (current?.projected.priorities.effective || []).map(field => ({ field, label: fields.get(field)?.label || field })),
          ...(review?.source ? { reviewCriterion: { label: review.source.criterion.label, valueLabel: review.source.criterion.valueLabel, ...(review.source.criterion.until ? { until: review.source.criterion.until } : {}) },
            canApplyBaseline: canPreview && review.source.criterion.declarationTarget === 'baseline' && !!current && effectivePriorityTarget(current.projected) === 'baseline' } : {}),
          selectedField: review?.field || null, response: review?.response || null, canRespond: appointment.canReflect && !!savedCriteria?.criteria.length,
          canPreview, ...(!canPreview ? { previewUnavailableReason: !savedCriteria?.criteria.length ? '당시 직접 정한 중요 기준 기록이 없어요.' : '당시 기준이나 현재 선언이 달라졌거나 아직 비교할 회고가 없어요.' } : {}) };
      });
      return { pairId: pair.id, revision: pair.revision, status: 'active', paused, introduction, view: projected, criterionReviews, scheduleDraftBasis,
        alignment: alignment.inspect(alignmentState(tx, pair), alignmentContext(tx, pair, at), { viewer: row.id, at }),
        scheduleContext };
    });
    const reports = tx.reports(row.id, isOperator).map(report => isOperator ? { ...report } : ({ id: report.id, targetAccountId: report.target, reason: report.reason,
      details: report.details, status: report.status, at: report.at, updatedAt: report.updated_at }));
    const canDiscover = row.status === 'active' && !centralBlocked(row) && doc.adult.selfDeclared && !doc.paused && doc.consents.storePreferences;
    const discovery = canDiscover ? clone(currentDiscovery().projected) : null;
    if (discovery) discovery.candidates = discovery.candidates.map(candidate => {
      const target = tx.account(candidate.id), related = pairRows.filter(pair => [pair.a, pair.b].includes(candidate.id));
      const pairRow = related.find(pair => pair.status === 'active') || related.sort((a, b) => (b.document?.createdAt || '').localeCompare(a.document?.createdAt || ''))[0];
      const pair = pairRow ? pairs.find(pair => pair.pairId === pairRow.id) : null;
      const intro = target ? introductions.inspect(introState(tx, row.id, target.id, at), { viewer: row.id, at }) : null;
      const canConnect = candidate.status === 'eligible' && connectedAllowed(row, target) && currentIntroductionCompatible(tx,row,target,at) && !!intro?.canSend;
      const ownRegion = discovery.fields.find(field => field.id === 'self.meetingRegions');
      const publishedPeer = candidates.find(profile => profile.accountId === candidate.id);
      const currentOwnPublic = publicAnswers(row,at);
      const introductionGuidance = getIntroductionGuidance({ canConnect, ownReceiveInvitations: doc.consents.receiveInvitations,
        ownExpiredPublicFields: currentOwnPublic.expiredFields.filter(field => field === 'availability' || field === 'self.meetingRegions'
          || currentOwnPublic.required.includes(field) && fields.get(field)?.kind === 'wants'),
        ownPrivateRegions: ownRegion?.state === 'known' ? ownRegion.value : undefined,
        ownPublicRegions: currentOwnPublic.values['self.meetingRegions'], peerPublicRegions: publishedPeer?.values['self.meetingRegions'],
        introduction: pair ? { hasHistory: true, canReopen: pair.introduction?.canReopen === true,
          canRespond: pair.introduction?.canRespond === true, canDecline: pair.introduction?.canDecline === true,
          canWithdraw: pair.introduction?.canWithdraw === true, accepted: pair.introduction?.accepted === true,
          status: pair.introduction?.current?.status || null } : null });
      return { ...candidate, accountId: candidate.id, canConnect, introductionGuidance,
        pairId: pair?.pairId || null, introductionStatus: pair?.introduction.current?.status || null,
        demoRole: mode === 'demo' ? demoRole(candidate.id) : null, publicAvailability: target ? publicAnswers(target,at).values.availability || null : null };
    });
    const rawExperience = doc.experience || experience.create();
    const allowanceBindings = discovery ? Object.fromEntries(rawExperience.records.filter(record => record.allowance)
      .map(record => [record.id, allowanceBinding(tx, row, record, currentDiscovery(), at)])) : {};
    const privateExperience = experience.inspect(rawExperience, { workspace: experienceWorkspace(row.id), at, allowedSelectedIds: visibleKeys(discovery), allowanceBindings });
    privateExperience.records = privateExperience.records.map(record => {
      const raw = rawExperience.records.find(item => item.id === record.id);
      const current = discovery?.candidates.find(candidate => candidateKey(candidate.id) === raw.selectedId);
      let canRestore = false;
      if (record.responses.followup?.value === 'worse') try { restoreAction(row, record.id, currentDiscovery(), at); canRestore = true; } catch { /* No inferred restoration for legacy or stale declarations. */ }
      return { ...record, selectedId: current?.id || null, selectedLabel: current?.label || null,
        ...(record.followup ? { followup: { ...record.followup, canRestore, ...(!canRestore ? { restoreUnavailableReason: '현재 유효한 더 멀어짐 응답과 그대로 남은 원수정이 있을 때만 되돌릴 수 있어요.' } : {}) } } : {}) };
    });
    privateExperience.criterionReviews = (doc.experience?.meetingCriteria || []).flatMap(meeting => meeting.reviews.map(review => ({ pairId: meeting.pairId,
      appointmentId: review.appointmentId, field: review.field, label: (review.source?.criterion || meeting.criteria.find(item => item.field === review.field)).label,
      valueLabel: (review.source?.criterion || meeting.criteria.find(item => item.field === review.field)).valueLabel,
      date: review.completedAt, response: clone(review.response) })));
    privateExperience.recommendationToken = discovery?.topCandidateId ? tokenFor(resultTokens, { actor: row.id, revision: row.revision,
      binding: currentDiscovery().binding }, at) : null;
    const bookmarks = doc.bookmarks || [];
    const eligibleIds = new Set((discovery?.candidates || []).filter(candidate => candidate.status === 'eligible').map(candidate => candidate.id));
    // Persist only private references. Never return a withdrawn profile, old
    // name, target ID, or reason why the person is no longer available.
    const savedCandidates = { items: bookmarks.map(item => ({ id: item.id, savedAt: item.savedAt,
      candidateId: eligibleIds.has(item.targetAccountId) ? item.targetAccountId : null })), limit: BOOKMARK_LIMIT,
      canAdd: !!discovery && publicAccount(row) && bookmarks.length < BOOKMARK_LIMIT && eligibleIds.size > 0 };
    const { legacyDiscovery: _legacy, alignmentGeneration: _alignmentGeneration, allowanceGeneration: _allowanceGeneration, adultVerification: _adultVerification, bookmarks: _bookmarks, onboardingState: _onboardingState, ...publicDoc } = doc;
    const adultProjection = datingAdultProjection({ required: adultRequired, state: doc.adultVerification, checkedAt: row.adultCheck?.checkedAt, at,
      localActive: row.status === 'active' && centralReady(row) });
    return { accountId: row.id, revision: row.revision, status: row.status, mode, synthetic: mode === 'demo', asOf: at, ...clone(publicDoc), publicAnswers: publicAnswers(row,at), discovery, experience: privateExperience,
      centralAvailability: centralView(row), savedCandidates,
      adult: { ...doc.adult, verified: adultRequired && adultProjection.status === 'verified', verification: adultProjection }, operator: isOperator, candidates, pairs, reports,
      introductions: pairs.filter(pair => pair.introduction.current).map(pair => ({ pairId: pair.pairId, ...pair.introduction })),
      recommendationPool: { shown: Math.min(candidates.length, 100), total: candidates.length, limited: candidates.length > 100 },
      archivedReflections: [...(doc.archivedReflections || []), ...tx.pairs(row.id).filter(pair => pair.status === 'closed').flatMap(pair => ownReflections(pair, row.id, at))],
      inbox: pairs.flatMap(pair => (pair.view?.inbox || []).map(item => ({ ...item, pairId: pair.pairId }))),
      onboarding: onboardingView(row),
      limitations: [adultRequired ? '서버의 성인 확인 결과만 적용해요. 실제 인증 업체 연결은 아직 운영하지 않아요.' : '성인 여부는 본인 진술이며 인증되지 않았어요.', '현재 이 서비스는 로컬 호스트에서만 동작해요. 외부 초대·이메일·푸시는 보내지 않아요.'] };
  }
  const actionFields = { onboard: ['profile', 'declared', 'consents'], profile: ['profile'], 'public-answer': ['field', 'value', 'required', 'until'],
    'bookmark-save': ['targetAccountId'], 'bookmark-remove': ['bookmarkId'], preferences: ['preferences'], consents: ['consents'], adult: ['declared'], pause: ['paused'],
    block: ['targetAccountId'], unblock: ['targetAccountId'], report: ['targetAccountId', 'reason', 'details'],
    'admin-report': ['reportId', 'status', 'decision', 'note'], delete: [], discovery: ['action'], connect: ['targetAccountId'],
    'apply-preview': ['preview'], 'publish-baseline': ['fields'], experience: ['action'], introduction: ['pairId', 'expectedIntroductionRevision', 'action'], appointment: ['pairId', 'expectedPairRevision', 'action'], alignment: ['pairId', 'expectedAlignmentRevision', 'action'] };
  function mutate(tx, row, action, requestId, at, isOperator) {
    requireThat(plain(action) && own(actionFields, action.kind) && exact(action, ['kind', ...actionFields[action.kind]])
      && actionFields[action.kind].every(key => own(action, key)));
    if (row.status === 'deleted') fail(410, 'account-deleted');
    if (centralBlocked(row)) fail(403, 'account-unavailable');
    const retractExperience = action.kind === 'experience' && plain(action.action) &&
       (action.action.kind === 'evaluation-consent' && action.action.enabled === false || ['respond', 'comfort', 'goal', 'followup', 'criterion', 'allowance-review'].includes(action.action.kind) && action.action.value === null);
    if (row.status === 'suspended' && !['delete', 'report', 'pause', 'consents', 'block', 'bookmark-remove'].includes(action.kind) && !retractExperience) fail(403, 'account-suspended');
    const doc = clone(row.document); let result = {};
    // Fix the legacy interpretation before this write adds another setup step.
    // Otherwise an old profile-only row could appear consent-confirmed merely
    // because the following individual adult declaration completes its basics.
    if (!doc.onboardingState) doc.onboardingState = { consentsConfirmed: onboardingView(row).steps.consents };
    syncDateGates(tx, row.id, at);
    function applyConsents(next) {
      requireThat(exact(next, ['profilePublic', 'receiveInvitations', 'storePreferences']) && Object.keys(next).length === 3 && Object.values(next).every(value => typeof value === 'boolean'));
      if ((next.profilePublic || next.receiveInvitations) && (!doc.adult.selfDeclared || !doc.profile.nickname)) fail(403, 'onboarding-required');
      if ((next.profilePublic || next.receiveInvitations) && !adultVerified(row)) fail(403, 'adult-verification-required');
      if (doc.consents.profilePublic && !next.profilePublic || doc.consents.receiveInvitations && !next.receiveInvitations) closePairs(tx, row.id, null, false, at);
      doc.consents = clone(next); doc.onboardingState = { consentsConfirmed: true };
      if (adultRequired && row.status === 'active' && !centralBlocked(row) && (next.profilePublic || next.receiveInvitations) && doc.adultVerification) doc.adultVerification.resumeRequired = false;
      if (row.status === 'active' && (next.profilePublic || next.receiveInvitations)) tx.resumeCentralAvailability(row.id);
      if (!doc.consents.storePreferences) { doc.preferences = {}; doc.discovery = null; doc.discoveryEpoch = null; delete doc.legacyDiscovery; delete doc.discoveryMigration; delete doc.bookmarks; doc.experience = experience.create(); tx.eraseExposures(row.id); }
    }
    if (action.kind === 'onboard') {
      requireThat(exact(action.profile, ['nickname', 'region', 'intro']) && action.declared === true);
      doc.profile = { ...doc.profile, ...profileBasics(action.profile) };
      doc.adult = { selfDeclared: true, verified: false, at };
      applyConsents(action.consents);
    } else if (action.kind === 'profile') {
      const p = action.profile;
      requireThat(exact(p, ['nickname', 'region', 'intro', 'values', 'required', 'expirations']));
      const basics = profileBasics(p);
      const values = choices(p.values || {}, { publicValues: true }), required = p.required || [];
      requireThat(Array.isArray(required) && new Set(required).size === required.length && required.every(key => key.startsWith('wants.') && own(values, key)));
      const expirations = normalizePublicExpirations(p.expirations,{values,previousValues:doc.profile.values,previousExpirations:doc.profile.expirations||{},at});
      doc.profile = { ...basics, values, required: clone(required), ...(Object.keys(expirations).length ? {expirations} : {}) };
    } else if (action.kind === 'public-answer') {
      const field = fields.get(action.field);
      requireThat(!!field && action.field !== 'consent' && typeof action.required === 'boolean'
        && (!action.required || field.kind === 'wants'), 'invalid-public-values');
      const values = { ...doc.profile.values }, required = doc.profile.required.filter(key => key !== action.field);
      let expirations;
      if (action.value === null) {
        requireThat(action.required === false && action.until === null, 'invalid-public-values');
        delete values[action.field];
        expirations = normalizePublicExpirations(undefined, { values, previousValues: doc.profile.values, previousExpirations: doc.profile.expirations || {}, at });
      } else {
        requireThat(!field.legacy || own(values, action.field) && canonical(values[action.field]) === canonical(action.value), 'invalid-public-values');
        values[action.field] = choices({ [action.field]: action.value }, { publicValues: true })[action.field];
        if (action.required) required.push(action.field);
        expirations = normalizePublicExpirations({ [action.field]: action.until }, { values, previousValues: doc.profile.values, previousExpirations: doc.profile.expirations || {}, at });
      }
      doc.profile = { ...doc.profile, values, required, expirations };
      result = { field: action.field, withdrawn: action.value === null };
    } else if (action.kind === 'bookmark-save') {
      requireThat(id(action.targetAccountId) && action.targetAccountId !== row.id, 'invalid-target');
      if (!publicAccount(row) || !doc.consents.storePreferences) fail(403, 'discovery-unavailable');
      const current = discoverySnapshot(tx, row, at);
      if (!current.projected.candidates.some(candidate => candidate.id === action.targetAccountId && candidate.status === 'eligible')) fail(403, 'candidate-unavailable');
      const bookmarks = doc.bookmarks || [], existing = bookmarks.find(item => item.targetAccountId === action.targetAccountId);
      if (existing) result = { bookmarkId: existing.id, alreadySaved: true };
      else {
        if (bookmarks.length >= BOOKMARK_LIMIT) fail(409, 'bookmark-limit');
        const bookmark = { id: randomUUID(), targetAccountId: action.targetAccountId, savedAt: at };
        doc.bookmarks = [...bookmarks, bookmark]; result = { bookmarkId: bookmark.id, alreadySaved: false };
      }
    } else if (action.kind === 'bookmark-remove') {
      requireThat(uuid(action.bookmarkId), 'invalid-bookmark');
      const bookmarks = doc.bookmarks || [];
      if (!bookmarks.some(item => item.id === action.bookmarkId)) fail(404, 'bookmark-unavailable');
      doc.bookmarks = bookmarks.filter(item => item.id !== action.bookmarkId);
      result = { bookmarkId: action.bookmarkId, removed: true };
    } else if (action.kind === 'publish-baseline') {
      if (!doc.consents.storePreferences || !doc.discovery) fail(403, 'preference-storage-consent-required');
      requireThat(Array.isArray(action.fields) && action.fields.length > 0 && action.fields.length <= DISCOVERY_FIELDS.length
        && new Set(action.fields).size === action.fields.length && action.fields.every(field => typeof field === 'string' && field.startsWith('self.') && fields.has(field) && !fields.get(field).legacy), 'invalid-public-values');
      const projected = discoveryFor(tx, row, at).inspect(doc.discovery, { at });
      const published = {};
      for (const field of action.fields) {
        const baseline = projected.fields.find(item => item.id === field)?.baseline;
        if (baseline?.state !== 'known') fail(409, 'baseline-unavailable');
        published[field] = baseline.value;
      }
      doc.profile.values = { ...doc.profile.values, ...choices(published, { publicValues: true }) };
      result = { publishedFields: clone(action.fields) };
    } else if (action.kind === 'preferences') {
      if (!doc.consents.storePreferences) fail(403, 'preference-storage-consent-required');
      doc.preferences = choices(action.preferences);
    } else if (action.kind === 'consents') {
      applyConsents(action.consents);
    } else if (action.kind === 'adult') {
      requireThat(typeof action.declared === 'boolean'); doc.adult = { selfDeclared: action.declared, verified: false, at };
      if (!action.declared) { doc.consents.profilePublic = false; doc.consents.receiveInvitations = false; closePairs(tx, row.id, null, false, at); }
    } else if (action.kind === 'pause') {
      requireThat(typeof action.paused === 'boolean'); doc.paused = action.paused;
    } else if (['block', 'unblock', 'report', 'connect'].includes(action.kind)) {
      requireThat(id(action.targetAccountId) && action.targetAccountId !== row.id, 'invalid-target');
      const target = tx.account(action.targetAccountId);
      if (!target || target.status === 'deleted') fail(404, 'target-unavailable');
      if (action.kind === 'block') { doc.blocks = [...new Set([...doc.blocks, target.id])]; closePairs(tx, row.id, target.id, false, at); }
      else if (action.kind === 'unblock') doc.blocks = doc.blocks.filter(value => value !== target.id);
      else if (action.kind === 'report') {
        requireThat(['safety', 'harassment', 'impersonation', 'other'].includes(action.reason) && finiteText(action.details, 1000));
        const reportId = randomUUID(); tx.addReport({ id: reportId, reporter: row.id, target: target.id, reason: action.reason, details: action.details.trim(), at }); result = { reportId };
      } else {
        if (!connectedAllowed(row, target)) fail(403, 'connection-unavailable');
        if (!doc.discovery || !discoveryFor(tx, row, at).inspect(doc.discovery, { at }).candidates.some(candidate => candidate.id === target.id && candidate.status === 'eligible')) fail(403, 'matching-confirmation-required');
        if(!currentIntroductionCompatible(tx,row,target,at))fail(403,'matching-confirmation-required');
        let pair = tx.pairFor(row.id, target.id);
        if (!pair) { const pairId = randomUUID(); const state = appointmentsAdapter.create({ pairId, people: [{ id: row.id, label: doc.profile.nickname }, { id: target.id, label: target.document.profile.nickname }], at });
          pair = tx.putPair({ id: pairId, a: row.id, b: target.id, revision: state.revision, document: state }); }
        const intro = introRecord(tx, row.id, target.id, { kind: 'send', actor: row.id, requestId, pairId: pair.id, at });
        tx.clearAlignment(pair.id);
        recordExplicitExposure(tx, row, doc, [target.id], at);
        captureMeetingCriteria(tx, row, doc, pair.id, at);
        result = { pairId: pair.id, introductionId: introductions.inspect(intro, { viewer: row.id, at }).current.id };
      }
    } else if (action.kind === 'admin-report') {
      if (!isOperator) fail(403, 'operator-required');
      requireThat(uuid(action.reportId) && ['reviewing', 'resolved', 'dismissed'].includes(action.status) && ['none', 'suspend-target', 'restore-target'].includes(action.decision) && finiteText(action.note, 1000));
      const report = tx.report(action.reportId); if (!report) fail(404, 'report-unavailable');
      if (action.decision !== 'none') {
        const target = tx.account(report.target); if (!target || target.status === 'deleted') fail(410, 'target-unavailable');
        tx.updateAccount(target, { ...target.document, allowanceGeneration: (target.document.allowanceGeneration || 0) + 1 }, action.decision === 'suspend-target' ? 'suspended' : 'active');
        if (action.decision === 'suspend-target') closePairs(tx, target.id, null, false, at);
      }
      tx.updateReport(report.id, { status: action.status, decision: action.decision, note: action.note.trim(), at });
    } else if (action.kind === 'delete') {
      return { row: deleteDatingAccount(tx, row, at), result: { deleted: true } };
    } else if (action.kind === 'apply-preview') {
      const saved = ownedToken(previews, action.preview, row.id, at), current = discoverySnapshot(tx, row, at);
      if (saved.revision !== row.revision || saved.binding !== current.binding) fail(409, 'preview-stale');
      if (saved.criterionReview) criterionAction(tx, row, saved.criterionReview, current, at);
      if (saved.restoreDecisionId) restoreAction(row, saved.restoreDecisionId, current, at);
      if (saved.allowanceReview) {
        const verified = allowanceAction(tx, row, { decisionId: saved.allowanceReview.decisionId }, current, at);
        if (verified.responseKey !== saved.allowanceReview.responseKey) fail(409, 'preview-stale');
      }
      try {
        doc.discovery = current.state;
        if (saved.contextExposure?.candidateIds.length) {
          if (saved.contextExposure.contextId !== current.projected.context.id || saved.contextExposure.candidateIds.some(candidateId =>
            !current.projected.candidates.some(candidate => candidate.id === candidateId && candidate.status === 'eligible'))) fail(409, 'preview-stale');
          recordExplicitExposure(tx, row, doc, saved.contextExposure.candidateIds, saved.contextExposure.at, current.adapter);
        }
        doc.discovery = current.adapter.applyPreview(doc.discovery, saved.proposed, { at });
      } catch { fail(409, 'preview-stale'); }
      if (saved.contextExposure) { at = tx.time(doc.discovery.events.at(-1).at); result = { contextStarted: true }; }
      if (!doc.discoveryEpoch) doc.discoveryEpoch = randomUUID();
      if (saved.criterionReview) {
        const source = experience.criterionSource(doc.experience || experience.create(), saved.criterionReview, at);
        if (source.review.response.value === 'more-important') {
          const after = current.adapter.inspect(doc.discovery, { at }), changes = changedCriteria(current.projected, after), correctionId = randomUUID();
          const restore = { kind: 'undo-priorities', changeId: doc.discovery.events.at(-1).id };
          doc.experience = experience.criterionCorrection(doc.experience, { id: correctionId, sourceCriterion: saved.criterionReview,
            contextId: after.context.id, basisKey: criteriaKey(doc.discovery, after), changes,
            ...(saved.proposed.action.until ? { until: saved.proposed.action.until } : {}), restore: { ...restore, currentKey: restorationKey(after, restore) } }, at);
          result = { correctionId };
        }
      }
      if (saved.sourceDecisionId) {
        const after = current.adapter.inspect(doc.discovery, { at }), changes = changedCriteria(current.projected, after);
        experience.correctionSource(doc.experience || experience.create(), saved.sourceDecisionId, at, visibleKeys(current.projected));
        if (changes.length) {
          const correctionId = randomUUID();
          const restore = saved.proposed.action.kind === 'priorities' ? { kind: 'undo-priorities', changeId: doc.discovery.events.at(-1).id }
            : { kind: 'undo-field', field: saved.proposed.action.field, changeId: doc.discovery.events.at(-1).id };
          doc.experience = experience.correct(doc.experience || experience.create(), { id: correctionId, sourceDecisionId: saved.sourceDecisionId,
            contextId: after.context.id, basisKey: criteriaKey(doc.discovery, after), changes,
            restore: { ...restore, currentKey: restorationKey(after, restore) } }, at, visibleKeys(current.projected));
          result = { correctionId };
        }
      }
      if (saved.restoreDecisionId) doc.experience = experience.restored(doc.experience, saved.restoreDecisionId, at, visibleKeys(current.projected));
    } else if (action.kind === 'experience') {
      if (!doc.consents.storePreferences) fail(403, 'preference-storage-consent-required');
      const event = action.action; requireThat(plain(event));
      let state = doc.experience || experience.create();
      if (['goal', 'evaluation-consent'].includes(event.kind)) state = experience.setting(state, event, at);
      else if (event.kind === 'view-result') {
        requireThat(exact(event, ['kind', 'token']));
        const saved = ownedToken(resultTokens, event.token, row.id, at), current = discoverySnapshot(tx, row, at);
        if (saved.revision !== row.revision || saved.binding !== current.binding || !current.projected.topCandidateId) fail(409, 'preview-stale');
        const decisionId = randomUUID();
        const allowance = currentAllowance(tx, row, current, current.projected.topCandidateId, at);
        state = experience.decide(state, { id: decisionId, contextId: current.projected.context.id,
          candidateIds: current.projected.candidates.filter(candidate => candidate.status === 'eligible').map(candidate => candidateKey(candidate.id)),
          selectedId: candidateKey(current.projected.topCandidateId), ...(allowance ? { allowance } : {}) }, at, { basisKey: criteriaKey(current.state, current.projected), allowedSelectedIds: visibleKeys(current.projected) }); result = { decisionId };
        // The existing explicit "review this recommendation" action identifies the
        // one result the person chose to inspect; ordinary GET never records it.
        recordExplicitExposure(tx, row, doc, [current.projected.topCandidateId], at, current.adapter);
      } else if (event.kind === 'deliver') {
        requireThat(exact(event, ['kind', 'decisionId'])); state = experience.deliver(state, event.decisionId, at);
      } else if (event.kind === 'respond') {
        requireThat(exact(event, ['kind', 'decisionId', 'metric', 'value'])); state = experience.respond(state, event, at);
      } else if (event.kind === 'allowance-review') {
        requireThat(exact(event, ['kind', 'decisionId', 'value']) && uuid(event.decisionId) && [null, 'keep', 'stop', 'unknown'].includes(event.value));
        const record = state.records.find(item => item.id === event.decisionId), current = event.value === null ? null : discoverySnapshot(tx, row, at);
        const binding = current ? allowanceBinding(tx, row, record, current, at) : null;
        try { state = experience.allowanceReview(state, event, at, { binding }); } catch { fail(409, 'allowance-review-unavailable'); }
      } else if (event.kind === 'followup') {
        requireThat(exact(event, ['kind', 'decisionId', 'value']));
        // Withdrawal is always possible from the owner's record, including after peer withdrawal or suspension.
        const projected = event.value === null ? null : discoverySnapshot(tx, row, at).projected;
        state = experience.followup(state, event, at, { allowedSelectedIds: event.value === null ? undefined : visibleKeys(projected) });
      } else if (event.kind === 'criterion') {
        requireThat(exact(event, ['kind', 'pairId', 'appointmentId', 'field', 'value', 'confirmedValue']) && id(event.pairId) && id(event.appointmentId) && fields.has(event.field)
          && (event.value === 'more-important' ? typeof event.confirmedValue === 'string' : !own(event, 'confirmedValue')));
        if (event.value === null) state = experience.criterion(state, { pairId: event.pairId, appointmentId: event.appointmentId, field: event.field, value: null }, at);
        else {
          const pair = tx.pair(event.pairId);
          if (!pair?.document || ![pair.a, pair.b].includes(row.id)) fail(404, 'pair-unavailable');
          const appointment = appointmentsAdapter.inspect(pair.document, { viewer: row.id, at }).appointments.find(item => item.id === event.appointmentId);
          if (!appointment?.canReflect) fail(403, 'own-completion-required');
          let source;
          if (event.value === 'more-important') {
            if (pair.status !== 'active' || !pairAccessible(tx.account(pair.a), tx.account(pair.b)) || doc.paused) fail(409, 'criterion-review-unavailable');
            const current = discoverySnapshot(tx, row, at); source = criterionReflectionSnapshot(row, pair, event.field, current);
            requireThat(event.confirmedValue === source.criterion.value, 'criterion-answer-confirmation-required');
            if (!(state.meetingCriteria || []).some(meeting => meeting.pairId === pair.id))
              state = experience.captureCriteria(state, { pairId: pair.id, contextId: source.contextId, priorityKey: source.priorityKey, criteria: [] }, at, { startedAt: pair.document.createdAt });
          }
          state = experience.criterion(state, { pairId: pair.id, appointmentId: appointment.id, proposalVersion: appointment.proposal.version,
            completedAt: appointment.people.find(person => person.id === row.id).completedAt, field: event.field, value: event.value, ...(source ? { source } : {}) }, at);
        }
      } else if (event.kind === 'comfort') {
        requireThat(exact(event, ['kind', 'pairId', 'appointmentId', 'value']) && id(event.pairId) && id(event.appointmentId));
        if (event.value === null) {
          state = experience.withdrawComfort(state, event, at);
        } else {
        const pair = tx.pair(event.pairId);
        if (!pair || !pair.document || ![pair.a, pair.b].includes(row.id)) fail(404, 'pair-unavailable');
        const appointment = appointmentsAdapter.inspect(pair.document, { viewer: row.id, at }).appointments.find(item => item.id === event.appointmentId);
        if (!appointment?.canReflect) fail(403, 'own-completion-required');
        state = experience.comfort(state, { id: `meeting.${hash(`${pair.id}:${appointment.id}`).slice(0, 40)}`, pairId: pair.id, appointmentId: appointment.id,
          proposalVersion: appointment.proposal.version, at: appointment.proposal.proposedAt, completedAt: appointment.people.find(person => person.id === row.id).completedAt }, event.value, at);
        }
      } else fail(400, 'invalid-experience-action');
      doc.experience = state;
    } else if (action.kind === 'discovery') {
      if (!doc.adult.selfDeclared || doc.paused || !doc.consents.storePreferences) fail(403, 'discovery-unavailable');
      requireThat(plain(action.action) && !['at', 'id', 'actor', 'person'].some(key => own(action.action, key)));
      const adapter = discoveryFor(tx, row, at), state = doc.discovery || adapter.create('first', { at });
      doc.discovery = adapter.record(state, { ...clone(action.action), at });
      if (!doc.discoveryEpoch) doc.discoveryEpoch = randomUUID();
      if (mode === 'account' && action.action.kind === 'expose') {
        const current = adapter.inspect(doc.discovery, { at });
        for (const candidate of action.action.candidateIds) tx.expose(row.id, `${doc.discoveryEpoch}:${current.context.id}`, candidate);
      }
    } else if (action.kind === 'introduction') {
      requireThat(id(action.pairId) && Number.isSafeInteger(action.expectedIntroductionRevision) && action.expectedIntroductionRevision >= 0 && plain(action.action)
        && ['respond', 'withdraw', 'reopen'].includes(action.action.kind) && !['actor', 'at', 'requestId', 'expectedRevision'].some(key => own(action.action, key)));
      const pair = tx.pair(action.pairId);
      if (!pair || ![pair.a, pair.b].includes(row.id)) fail(404, 'pair-unavailable');
      const a = tx.account(pair.a), b = tx.account(pair.b);
      if (!pairAccessible(a, b)) fail(410, 'pair-closed');
      if ((a.document.paused || b.document.paused) && action.action.kind !== 'withdraw') fail(403, 'pair-paused');
      if(action.action.kind==='respond'&&action.action.value==='accept'){
        const pending = introductions.inspect(introState(tx,a.id,b.id,at),{viewer:row.id,at}).current;
        if(!currentIntroductionCompatible(tx,a,b,at,pending?.from))fail(403,'matching-confirmation-required');
      }
      if (pair.status !== 'active' && action.action.kind !== 'reopen') fail(410, 'pair-closed');
      const old = tx.introduction(pair.a, pair.b);
      if ((old?.revision || 0) !== action.expectedIntroductionRevision) fail(409, 'introduction-revision-conflict');
      if (action.action.kind === 'reopen') {
        for (const prior of tx.pairs(row.id).filter(item => item.a === pair.a && item.b === pair.b && item.document)) {
          const receiving = appointmentsAdapter.inspect(prior.document, { viewer: row.id, at }).me.receiving;
          if (receiving?.canReopen) {
            const state = appointmentsAdapter.record(prior.document, { kind: 'reopen', actor: row.id, requestId: `intro-reopen-${hash(`${requestId}:${prior.id}`).slice(0, 40)}`, at,
              expectedRevision: prior.document.revision, appointmentId: receiving.appointmentId, proposalVersion: receiving.proposalVersion });
            tx.updatePair(prior, state);
          }
        }
      }
      introRecord(tx, pair.a, pair.b, { ...action.action, actor: row.id, requestId, at }); result = { pairId: pair.id };
      if (['withdraw', 'reopen'].includes(action.action.kind) || action.action.value === 'decline') tx.clearAlignment(pair.id);
      if (action.action.kind === 'respond' && action.action.value === 'accept') captureMeetingCriteria(tx, row, doc, pair.id, at);
    } else if (action.kind === 'alignment') {
      const alignmentActionFields = !action.action?.kind ? ['key', 'value']
        : action.action.kind === 'propose-option' ? ['key', 'kind', 'optionId']
        : action.action.kind === 'cancel-option' ? ['key', 'kind'] : [];
      requireThat(id(action.pairId) && Number.isSafeInteger(action.expectedAlignmentRevision) && action.expectedAlignmentRevision >= 0
        && exact(action.action, alignmentActionFields) && Object.keys(action.action).length === alignmentActionFields.length);
      const pair = tx.pair(action.pairId);
      if (!pair || ![pair.a, pair.b].includes(row.id)) fail(404, 'pair-unavailable');
      const state = alignmentState(tx, pair), context = alignmentContext(tx, pair, at);
      const next = alignment.record(state, context, { ...action.action, actor: row.id, at, expectedRevision: action.expectedAlignmentRevision });
      tx.putAlignment(pair.id, next, state.revision); result = { pairId: pair.id };
    } else if (action.kind === 'appointment') {
      requireThat(id(action.pairId) && Number.isSafeInteger(action.expectedPairRevision) && action.expectedPairRevision >= 0 && plain(action.action)
        && !['actor', 'person', 'at', 'id', 'requestId', 'expectedRevision'].some(key => own(action.action, key)));
      const pair = tx.pair(action.pairId);
      if (!pair || ![pair.a, pair.b].includes(row.id)) fail(404, 'pair-unavailable');
      const accountA = tx.account(pair.a), accountB = tx.account(pair.b);
      if (pair.status !== 'active' || !pairAccessible(accountA, accountB)) fail(410, 'pair-closed');
      if ((accountA.document.paused || accountB.document.paused) && ['propose', 'revise', 'respond', 'reopen'].includes(action.action.kind)) fail(403, 'pair-paused');
      if (['propose', 'revise', 'respond'].includes(action.action.kind) && !introView(tx, pair, row.id, at).accepted) fail(403, 'introduction-required');
      if (pair.revision !== action.expectedPairRevision) fail(409, 'pair-revision-conflict');
      const state = appointmentsAdapter.record(pair.document, { ...clone(action.action), actor: row.id, at, requestId, expectedRevision: pair.revision });
      tx.updatePair(pair, state); result = { pairId: pair.id };
    }
    const publicBasisChanged = alignmentFields.some(field => doc.profile.values[field] !== row.document.profile.values[field]
      || (doc.profile.expirations?.[field]||null)!==(row.document.profile.expirations?.[field]||null));
    const accessChanged = doc.paused !== row.document.paused || doc.adult.selfDeclared !== row.document.adult.selfDeclared
      || doc.consents.profilePublic !== row.document.consents.profilePublic || doc.consents.receiveInvitations !== row.document.consents.receiveInvitations;
    if (canonical(doc.profile) !== canonical(row.document.profile) || accessChanged
      || canonical(doc.blocks) !== canonical(row.document.blocks) || doc.consents.storePreferences !== row.document.consents.storePreferences)
      doc.allowanceGeneration = (row.document.allowanceGeneration || 0) + 1;
    if (publicBasisChanged || accessChanged) {
      doc.alignmentGeneration = (row.document.alignmentGeneration || 0) + 1;
      for (const pair of tx.pairs(row.id)) tx.clearAlignment(pair.id);
    }
    doc.updatedAt = at; return { row: tx.updateAccount(row, doc), result };
  }
  function respond(res, status, value) {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...(status === 429 && value.error?.code === 'account-busy' ? { 'Retry-After': '1' } : {}) }); res.end(JSON.stringify(value));
  }
  async function handle(req, res) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname !== PREFIX && !pathname.startsWith(PREFIX + '/')) return false;
    try {
      if (stopped) fail(503, 'service-closed');
      if (pathname === PREFIX + '/lifecycle') {
        if (mode !== 'account') fail(404, 'not-found');
        if (!lifecycleVerifier) fail(503, 'lifecycle-not-configured');
        if (req.method !== 'POST') fail(405, 'method-not-allowed');
        transport.assertRequest(req, { serverToServer: true });
        lifecycleVerifier.authenticate(req);
        if (new URL(req.url, 'http://localhost').search) fail(400, 'invalid-lifecycle-route');
        const input = await body(req), observedAt = new Date(clock()).toISOString(), event = lifecycleVerifier.event(input, observedAt);
        if (stopped) fail(503, 'service-closed');
        const output = store.transaction(tx => {
          const digest = hash(canonical(event)), old = tx.lifecycleReceipt(event.issuer, event.eventId);
          if (old) { if (old.digest !== digest) fail(409, 'lifecycle-event-conflict'); return JSON.parse(old.result); }
          const at = tx.time(observedAt, true), existing = tx.account(event.subjectId);
          let result;
          if (event.type === 'account.deleted') {
            if (existing) deleteDatingAccount(tx, existing, at); else tx.ensureDeletedAccount(event.subjectId);
            result = { ok: true, eventId: event.eventId, subjectId: event.subjectId, status: 'deleted' };
          } else result = { ok: true, eventId: event.eventId, subjectId: event.subjectId, status: applyAvailability(tx, event, at), sequence: event.sequence };
          tx.putLifecycleReceipt(event.issuer, event.eventId, digest, at, result); return result;
        });
        respond(res, 200, output); return true;
      }
      transport.assertRequest(req);
      if (pathname === PREFIX + '/config' && req.method === 'GET') { respond(res, 200, { ok: true, mode, configured: mode === 'demo' || !!verifier, localOnly: !transport.publicOrigin, synthetic: mode === 'demo',
        ...(mode === 'demo' ? { demoRoles: DATING_DEMO_ROLES } : {}) }); return true; }
      if (pathname === PREFIX + '/demo/session') {
        if (mode !== 'demo') fail(404, 'not-found'); if (req.method !== 'POST') fail(405, 'method-not-allowed');
        const input = await body(req); requireThat(exact(input, ['role']) && DEMO_ROLES.includes(input.role));
        if (stopped) fail(503, 'service-closed');
        const at = now(), accountId = `demo:${input.role}`;
        store.transaction(tx => { bootstrapDemo(tx, at); const row = tx.ensureAccount(accountId, blank(at)); if (row.status === 'deleted') fail(410, 'account-deleted'); });
        for (const [key, value] of demoTokens) if (value.expiresAt <= Date.parse(at)) demoTokens.delete(key);
        if (demoTokens.size >= 1000) fail(429, 'demo-session-capacity');
        const token = randomBytes(32).toString('base64url'), expiresAt = Date.parse(at) + DAY; demoTokens.set(hash(token), { accountId, expiresAt });
        respond(res, 200, { ok: true, token, accountId, expiresAt: new Date(expiresAt).toISOString(), synthetic: true }); return true;
      }
      if (!['/me', '/state', '/inbox', '/action', '/preview', '/receipt'].some(route => pathname === PREFIX + route)) fail(404, 'not-found');
      const mutation = pathname.endsWith('/action'), isPreview = pathname.endsWith('/preview'); if (req.method !== (mutation || isPreview ? 'POST' : 'GET')) fail(405, 'method-not-allowed');
      const isReceipt = pathname.endsWith('/receipt'), query = new URL(req.url, 'http://localhost').searchParams;
      if (isReceipt) requireThat([...query.keys()].length === 1 && query.has('requestId') && uuid(query.get('requestId')), 'invalid-receipt-query');
      const input = mutation || isPreview ? await body(req) : null;
      if (stopped) fail(503, 'service-closed');
      const identity = await authenticate(req, res);
      if (stopped) fail(503, 'service-closed');
      let observedAt = now(), adultChecks = new Map(), adultConflicts = new Set();
      if (!adultRequired && mode === 'account') adultRequired = store.transaction(tx => {
        if (tx.accounts().some(row => !!row.document?.adultVerification)) tx.requireAdultVerification();
        return tx.adultRequired();
      });
      if (adultRequired) {
        // This host has only a server-injected local assertion function. It does
        // not fetch an external provider or pass the account bearer token.
        adultChecks = await checkAdults(req, res, identity.accountId, observedAt);
        if (stopped) fail(503, 'service-closed');
        observedAt = now();
        const applied = store.transaction(tx => { const at = tx.time(observedAt, mutation); tx.ensureAccount(identity.accountId, blank(at)); const conflicts = applyAdultChecks(tx, adultChecks, at); return { at: tx.time(at), conflicts }; });
        observedAt = applied.at; adultConflicts = applied.conflicts;
      }
      if (stopped) fail(503, 'service-closed');
      if (mutation) requireThat(exact(input, ['requestId', 'expectedRevision', 'action']) && Object.keys(input).length === 3 && uuid(input.requestId) && Number.isSafeInteger(input.expectedRevision) && input.expectedRevision >= 0, 'invalid-envelope');
      const output = store.transaction(originalTx => {
        let at = originalTx.time(observedAt, mutation && !adultRequired);
        const tx = adultTransaction(originalTx, adultChecks, at);
        let row = isPreview ? tx.account(identity.accountId) : tx.ensureAccount(identity.accountId, blank(at));
        if (!row) fail(403, 'onboarding-required');
        row = migrateDemoDiscovery(tx, row, at); at = tx.time(at);
        const isOperator = row.status === 'active' && !centralBlocked(row) && operators.has(row.id);
        if (centralBlocked(row) && (isPreview || isReceipt)) fail(403, 'account-unavailable');
        if (isPreview) return preview(tx, row, input, at);
        if (isReceipt) {
          if (row.status === 'deleted') fail(410, 'account-deleted');
          if (row.status !== 'active') fail(403, row.status === 'suspended' ? 'account-suspended' : 'account-unavailable');
          const requestId = query.get('requestId'), old = tx.receipt(row.id, requestId), currentView = view(tx, row, at, isOperator);
          return old ? { ok: true, status: 'applied', requestId, appliedRevision: old.revision, result: JSON.parse(old.result), view: currentView }
            : { ok: true, status: 'not-found', requestId, view: currentView };
        }
        if (!mutation) return { ok: true, view: view(tx, row, at, isOperator) };
        if (row.status === 'deleted') fail(410, 'account-deleted');
        const digest = hash(canonical(input)), old = tx.receipt(row.id, input.requestId);
        if (old) {
          if (old.digest !== digest) fail(409, 'idempotency-conflict');
          return { ok: true, replayed: true, appliedRevision: old.revision, result: JSON.parse(old.result), view: view(tx, row, at, isOperator) };
        }
        if (centralBlocked(row)) fail(403, 'account-unavailable');
        const privacyExit = input.action?.kind === 'delete' || input.action?.kind === 'consents'
          && input.action.consents?.profilePublic === false && input.action.consents?.receiveInvitations === false;
        if (adultConflicts.has(row.id) && !privacyExit) fail(409, 'adult-verification-conflict');
        if (row.revision !== input.expectedRevision) fail(409, 'revision-conflict');
        const changed = mutate(tx, row, input.action, input.requestId, at, isOperator); row = changed.row; at = tx.time(at);
        tx.putReceipt(row.id, input.requestId, digest, row.revision, changed.result);
        return { ok: true, replayed: false, appliedRevision: row.revision, result: changed.result, view: view(tx, row, at, isOperator) };
      });
      respond(res, 200, output); return true;
    } catch (error) {
      const storageFailure = unavailableStorage(error);
      const status = storageFailure ? 503 : error.status || (error instanceof TypeError ? 400 : 500),
        code = storageFailure ? 'storage-unavailable' : error.code || (status === 400 ? 'invalid-action' : status === 409 ? 'revision-conflict' : 'service-error');
      respond(res, status, { ok: false, error: { code } }); return true;
    }
  }
  return Object.freeze({ mode, handle, close() { stopped = true; admission?.close(); adultAdmission?.close(); adultVerifier?.close(); demoTokens.clear(); previews.clear(); resultTokens.clear(); store.close(); } });
}
