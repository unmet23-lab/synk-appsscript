'use strict';

// A local, controlled-language demonstration. This does not infer complete
// hypothesis coverage, transcribe audio, or certify a learner's competence.
const clone = value => structuredClone(value);
const VERSION = '0.5.0';
const { createResolver } = require('./projection.cjs');
const { normalizeHelpScope, normalizeTimeBounds, refineTimeBounds, classifyHelpTime } = require('./temporal-evidence.cjs');
const { planEvidencePreserving } = require('./observation-planner.cjs');
const TARGET = '친구를 만나서 카페에 갔어요';
const ALTERNATIVE = '친구가 만나서 카페에 갔어요';
const TASK_PROMPT = '내가 친구를 만난 뒤 카페에 간 일을 말해 주세요. 화자는 행위자이고 친구는 만난 대상입니다.';
const ABLATIONS = ['none', 'no-purpose', 'no-epoch', 'no-target', 'predicted-response'];
const examples = Object.freeze([
  { id: 'particle-ambiguity', title: '조사는 보류, 과거형은 보존', description: '두 조사 해석이 갈리는 통제 사례에서 목적별 부분 반영과 실제 재청취를 비교합니다.' },
  { id: 'unknown-coverage', title: '모르는 원인이 남은 경우', description: '전사 후보가 같아도 관련 미확인 범위가 남으면 반영하지 않습니다.' },
  { id: 'natural-alternative', title: '자연스러운 다른 의미', description: '친구가 주어일 수 있는 표현을 문항 역할 확인 없이 문법 오류로 단정하지 않습니다.' },
]);

function text(value, name = 'text', allowEmpty = true) {
  if (typeof value !== 'string' || value.length > 8000 || (!allowEmpty && !value.trim())) throw new TypeError(`${name}: 올바른 문자열이 필요합니다.`);
  return value.normalize('NFC').trim();
}
function own(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
function flag(payload, key, fallback) { return own(payload, key) ? payload[key] === true : fallback; }
function blankUtterance(id, epoch, at, sequence, helpIds = []) {
  return { id, epoch, at, sequence, audio: null, alternatives: [], source: null, scopeConfirmed: false,
    humanConfirmed: false, machineAlternatives: [], exposureScopeConfirmed: false, helpIds: [...helpIds],
    performanceTimeConfirmed: false, performanceTimeSource: 'unknown', performanceInterval: null,
    performanceTimeConfirmedAt: null, performanceHelpIds: [], revisions: { audio: 0, transcript: 0, review: 0 } };
}
function createSession({ id, mode = 'example', exampleId = 'particle-ambiguity', createdAt = new Date().toISOString() } = {}) {
  text(id, 'id', false);
  if (!['example', 'recording'].includes(mode)) throw new TypeError('mode는 example 또는 recording입니다.');
  const ex = examples.find(e => e.id === exampleId);
  if (mode === 'example' && !ex) throw new TypeError('알 수 없는 예시입니다.');
  const original = blankUtterance('original', 'e0', createdAt, 0);
  if (mode === 'example') Object.assign(original, {
    alternatives: (exampleId === 'particle-ambiguity' ? [TARGET, ALTERNATIVE] : [exampleId === 'natural-alternative' ? ALTERNATIVE : TARGET]).map(t => ({ text: t, source: 'fixture' })),
    source: 'fixture', scopeConfirmed: true, exposureScopeConfirmed: true, syntheticEvidence: true,
    performanceTimeConfirmed: true, performanceTimeSource: 'fixture-assumption',
    performanceInterval: { startedAt: createdAt, endedAt: createdAt }, performanceTimeConfirmedAt: createdAt,
  });
  return { schemaVersion: 1, id, mode, exampleId: mode === 'example' ? exampleId : null, createdAt, revision: 0,
    task: { id: 'controlled-friend-trip', prompt: TASK_PROMPT, supported: true,
      roleConfirmed: mode === 'example' && exampleId !== 'natural-alternative', pastIndependent: mode === 'example',
      supportScope: '이 통제 한국어 문장의 조사·역할·과거형만 처리' },
    original, responses: [], helpEvents: [], purpose: 'original-performance',
    unknown: { enabled: mode === 'example' && exampleId === 'unknown-coverage', kind: 'all', reason: '해석에 영향을 주는 미확인 원인', scope: ['all'] },
    eventLog: [], lastChange: null };
}
function alternativesFrom(values, source) {
  if (!Array.isArray(values) || values.length > 40) throw new TypeError('alternatives는 최대 40개의 배열입니다.');
  return values.map((v, i) => {
    const entry = typeof v === 'string' ? { text: v } : v;
    if (!entry || typeof entry !== 'object') throw new TypeError(`alternatives[${i}] 형식이 올바르지 않습니다.`);
    return { ...clone(entry), text: text(entry.text, 'alternative.text', false), source };
  });
}
function locate(session, payload, create, event) {
  if ((payload.role || 'original') === 'original') return session.original;
  if (payload.role !== 'response') throw new TypeError('role은 original 또는 response입니다.');
  const id = payload.responseId || payload.utteranceId;
  let response = id ? session.responses.find(r => r.id === id) : session.responses.at(-1);
  if (!response && !create) throw new TypeError('먼저 응답을 만들거나 정확한 responseId를 지정해 주세요.');
  if (!response) {
    response = blankUtterance(id || `response-${session.responses.length + 1}`, `e${session.responses.length + 1}`, event.at,
      session.eventLog.length + 1, session.helpEvents.map(h => h.id));
    response.exposureScopeConfirmed = session.original.exposureScopeConfirmed;
    session.responses.push(response);
  }
  return response;
}

function captureInterval(payload, receivedAt) {
  if (payload.acquisition !== 'microphone') return null;
  const start = Date.parse(payload.captureStartedAt), end = Date.parse(payload.captureEndedAt), received = Date.parse(receivedAt);
  if (![start, end, received].every(Number.isFinite) || end < start || end > received) return null;
  return { startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString() };
}
function confirmPerformanceTime(session, target, payload, event) {
  if (!own(payload, 'performanceTimeConfirmed')) return;
  target.performanceTimeConfirmed = payload.performanceTimeConfirmed === true;
  target.performanceTimeReviewedAt = event.at;
  if (!target.performanceTimeConfirmed) { target.performanceTimeSource = 'unknown'; return; }
  // A person may confirm occurrence/relative order without inventing a date.
  // Keep real recorder intervals; otherwise preserve an explicit human relation.
  if (target.performanceInterval && ['browser-recorder', 'fixture-assumption'].includes(target.performanceTimeSource)) return;
  target.performanceTimeSource = 'human-review'; target.performanceInterval = null;
  target.performanceTimeConfirmedAt = event.at;
  target.performanceRelation = target.id === 'original' ? 'before-recorded-help' : 'after-recorded-help';
  target.performanceHelpIds = session.helpEvents.map(h => h.id);
}

function applyEvent(input, incoming) {
  if (!input || input.schemaVersion !== 1) throw new TypeError('알 수 없는 세션 형식입니다.');
  if (!incoming || typeof incoming.type !== 'string') throw new TypeError('event.type이 필요합니다.');
  const session = clone(input);
  const p = { ...incoming, ...(incoming.payload || {}) };
  const event = { id: incoming.id || incoming.eventId || `event-${session.eventLog.length + 1}`, type: incoming.type,
    at: incoming.at || p.at || new Date().toISOString() };
  // The store owns stale revision / idempotency checks. The local guard also
  // protects pure-module callers from replaying the same event twice.
  if (session.eventLog.some(e => e.id === event.id)) return session;
  let target;
  switch (event.type) {
    case 'audio-attached':
      text(p.audioRef, 'audioRef', false);
      target = locate(session, p, true, event);
      const changedAudio = target.audio?.audioRef !== p.audioRef;
      if (changedAudio) {
        target.alternatives = []; target.machineAlternatives = []; target.source = null;
        target.scopeConfirmed = false; target.humanConfirmed = false;
        const interval = captureInterval(p, event.at);
        target.performanceInterval = interval;
        target.performanceTimeConfirmed = Boolean(interval);
        target.performanceTimeSource = interval ? 'browser-recorder' : 'unknown';
        target.performanceTimeConfirmedAt = interval ? event.at : null;
        target.performanceHelpIds = []; target.performanceRelation = null;
      }
      target.audio = { audioRef: p.audioRef, mimeType: p.mimeType || null, durationMs: p.durationMs ?? null,
        fileName: p.fileName || null, acquisition: p.acquisition === 'microphone' ? 'microphone' : 'file',
        attachedAt: changedAudio ? event.at : target.audio.attachedAt,
        captureStartedAt: changedAudio ? (p.captureStartedAt || null) : target.audio.captureStartedAt,
        captureEndedAt: changedAudio ? (p.captureEndedAt || null) : target.audio.captureEndedAt,
        recordedAt: changedAudio ? (target.performanceInterval?.startedAt || null) : target.audio.recordedAt };
      target.revisions.audio++;
      // Capture the recording event, never the later transcription completion.
      if (target.id === 'original' && changedAudio) {
        target.at = event.at; target.sequence = session.eventLog.length + 1;
        target.helpIds = session.helpEvents.map(h => h.id);
      }
      target.syntheticEvidence = false;
      break;
    case 'transcripts-set':
      if (!['machine', 'human'].includes(p.source || 'machine')) throw new TypeError('전사 source가 올바르지 않습니다.');
      target = locate(session, p, false, event);
      if ((p.source || 'machine') === 'machine') {
        target.machineAlternatives = alternativesFrom(p.alternatives, 'machine');
        if (target.humanConfirmed) {
          // Keep the recognizer's actual output without overwriting a later
          // human review when the request finishes out of order.
          target.revisions.machine = (target.revisions.machine || 0) + 1;
          break;
        }
      }
      target.alternatives = alternativesFrom(p.alternatives, p.source || 'machine');
      target.source = p.source || 'machine';
      // A recognizer's confidence or top-one agreement never grants scope.
      target.scopeConfirmed = target.source !== 'machine' && p.scopeConfirmed === true;
      target.humanConfirmed = target.source === 'human' && p.confirmed === true;
      target.exposureScopeConfirmed = flag(p, 'exposureScopeConfirmed', target.exposureScopeConfirmed);
      target.revisions.transcript++;
      if (own(p, 'taskRoleConfirmed')) session.task.roleConfirmed = p.taskRoleConfirmed === true;
      if (own(p, 'pastIndependent')) session.task.pastIndependent = p.pastIndependent === true;
      break;
    case 'review-original':
    case 'review-response':
      target = locate(session, { ...p, role: event.type === 'review-original' ? 'original' : 'response' }, false, event);
      target.alternatives = p.alternatives ? alternativesFrom(p.alternatives, 'human') :
        (p.text?.trim() ? [{ text: text(p.text), source: 'human' }] : []);
      target.source = 'human'; target.humanConfirmed = p.confirmed === true;
      target.scopeConfirmed = p.confirmed === true && flag(p, 'scopeConfirmed', true);
      target.exposureScopeConfirmed = flag(p, 'exposureScopeConfirmed', target.exposureScopeConfirmed);
      target.revisions.review++; target.revisions.transcript++;
      confirmPerformanceTime(session, target, p, event);
      break;
    case 'help-presented':
      const scope = normalizeHelpScope(p.skills);
      session.helpEvents.push({ id: event.id, text: text(p.text, 'help.text', false), exposesAnswer: p.exposesAnswer !== false,
        at: event.at, sequence: session.eventLog.length + 1,
        skills: scope.skills, scope, actual: true,
        ...(own(p, 'timeBounds') ? { timeBounds: normalizeTimeBounds(p.timeBounds) } : {}), refinements: [] });
      break;
    case 'help-refined': {
      const help = session.helpEvents.find(h => h.id === p.helpId);
      if (!help) throw new TypeError('확인할 도움 사건을 찾을 수 없습니다.');
      const sourceRef = text(p.sourceRef, 'sourceRef', false);
      if (!own(p, 'timeBounds') && !own(p, 'skills')) throw new TypeError('확인한 시간 범위 또는 능력 범위가 필요합니다.');
      const before = { timeBounds: help.timeBounds || null, scope: clone(help.scope || normalizeHelpScope(help.skills)) };
      if (own(p, 'timeBounds')) {
        if (!help.timeBounds) throw new TypeError('기존 시간 범위가 있는 도움만 범위를 좁힐 수 있습니다. 새 사건의 정정과 구분해 주세요.');
        help.timeBounds = refineTimeBounds(help.timeBounds, p.timeBounds);
      }
      if (own(p, 'skills')) {
        const nextScope = normalizeHelpScope(p.skills);
        if (nextScope.status !== 'known') throw new TypeError('범위 확인에는 지원하는 능력 코드를 지정해 주세요.');
        const priorScope = help.scope || normalizeHelpScope(help.skills);
        if (priorScope.status === 'known' && !priorScope.skills.includes('all') && nextScope.skills.some(s => !priorScope.skills.includes(s)))
          throw new TypeError('범위를 넓히는 정정은 범위 정밀화로 처리할 수 없습니다.');
        help.scope = { ...nextScope, sourceRef }; help.skills = nextScope.skills;
      }
      help.refinements = [...(help.refinements || []), { eventId: event.id, at: event.at, sourceRef, before,
        after: { timeBounds: help.timeBounds || null, scope: clone(help.scope || normalizeHelpScope(help.skills)) } }];
      break;
    }
    case 'response-added':
      target = locate(session, { ...p, role: 'response', responseId: p.responseId || `response-${session.responses.length + 1}` }, true, event);
      if (p.alternatives) target.alternatives = alternativesFrom(p.alternatives, p.source || 'human');
      else if (own(p, 'text')) target.alternatives = p.text.trim() ? [{ text: text(p.text), source: p.source || 'human' }] : [];
      target.source = p.source || 'human'; target.humanConfirmed = p.confirmed === true;
      target.scopeConfirmed = target.source !== 'machine' && p.scopeConfirmed === true && p.confirmed === true;
      target.exposureScopeConfirmed = flag(p, 'exposureScopeConfirmed', target.exposureScopeConfirmed);
      if (p.audioRef) target.audio = { audioRef: text(p.audioRef, 'audioRef', false), mimeType: p.mimeType || null };
      target.revisions.transcript++;
      break;
    case 'task-confirmed':
      session.task.roleConfirmed = flag(p, 'roleConfirmed', session.task.roleConfirmed);
      session.task.pastIndependent = flag(p, 'pastIndependent', session.task.pastIndependent);
      session.original.exposureScopeConfirmed = flag(p, 'exposureScopeConfirmed', session.original.exposureScopeConfirmed);
      if (own(p, 'prompt')) {
        session.task.prompt = text(p.prompt, 'prompt', false);
        session.task.supported = session.task.prompt === TASK_PROMPT;
        if (!session.task.supported) { session.task.roleConfirmed = false; session.task.pastIndependent = false; }
      }
      break;
    case 'unknown-set':
      session.unknown = { enabled: p.enabled === true, reason: p.reason ? text(p.reason) : '해석에 영향을 주는 미확인 원인',
        kind: ['all', 'transcription', 'semantic', 'exposure'].includes(p.kind) ? p.kind : 'all',
        scope: Array.isArray(p.scope) && p.scope.length && p.scope.every(s => ['all', 'object', 'past', 'asr'].includes(s)) ? [...p.scope] : ['all'] };
      break;
    case 'purpose-set':
      if (!['original-performance', 'asr-data'].includes(p.purpose)) throw new TypeError('지원하지 않는 사용 목적입니다.');
      session.purpose = p.purpose;
      break;
    default: throw new TypeError(`지원하지 않는 이벤트: ${event.type}`);
  }
  session.eventLog.push({ ...event, target: target?.id || null });
  session.revision = (session.revision || 0) + 1;
  session.lastChange = { eventId: event.id, type: event.type, target: target?.id || null };
  return session;
}

function parseControlled(input) {
  const normalized = input.normalize('NFC').trim().replace(/[.!?。！？]+$/u, '').replace(/\s+/gu, ' ');
  const match = /^(?:(?:저는|나는|제가) )?친구(를|가) 만나서 카페에 (갔어요|가요)$/u.exec(normalized);
  return match ? { text: normalized, particle: match[1], past: match[2] === '갔어요' } : null;
}
function hasAudio(session, utterance) {
  return Boolean(utterance.audio?.audioRef || (session.mode === 'example' && utterance.syntheticEvidence));
}
function unknownAffects(session, skill) {
  const u = session.unknown;
  if (!u?.enabled) return false;
  if (skill === 'asr' && ['semantic', 'exposure'].includes(u.kind)) return false;
  if (u.scope.includes('all') || u.scope.includes(skill)) return true;
  if (skill === 'asr' && u.scope.includes('object')) return true;
  // Locality requires an explicit independence condition, never an empty map.
  if (skill === 'past' && !session.task.pastIndependent) return true;
  return false;
}
function timingFor(session, utterance, skill) {
  const relevant = session.helpEvents.filter(h => {
    const scope = h.scope || normalizeHelpScope(h.skills);
    return h.exposesAnswer && (skill === 'asr' || scope.status === 'unknown' || scope.skills.includes(skill) || scope.skills.includes('all'));
  });
  const legacyFixture = session.mode === 'example' && utterance.syntheticEvidence && utterance.performanceTimeConfirmed === undefined;
  const result = { confirmed: utterance.performanceTimeConfirmed === true || Boolean(legacyFixture), before: [], overlapping: [], unknown: [], scopeUnknown: [], relations: [] };
  if (!result.confirmed) return result;
  const interval = utterance.performanceInterval || (legacyFixture ? { startedAt: utterance.at, endedAt: utterance.at } : null);
  if (interval) {
    const start = Date.parse(interval.startedAt), end = Date.parse(interval.endedAt);
    if (![start, end].every(Number.isFinite) || end < start) return { ...result, confirmed: false };
    for (const h of relevant) {
      const comparison = classifyHelpTime(h, { ...utterance, performanceInterval: interval });
      result.relations.push({ helpId: h.id, ...comparison });
      if (comparison.relation !== 'after' && (h.scope || normalizeHelpScope(h.skills)).status === 'unknown') result.scopeUnknown.push(h);
      if (comparison.relation === 'unknown') result.unknown.push(h);
      else if (comparison.relation === 'before') result.before.push(h);
      else if (comparison.relation === 'overlap') result.overlapping.push(h);
    }
    return result;
  }
  if (utterance.performanceTimeSource !== 'human-review') return { ...result, confirmed: false };
  const known = new Set(utterance.performanceHelpIds || []);
  for (const h of relevant) {
    if (known.has(h.id)) {
      if (utterance.performanceRelation === 'after-recorded-help') result.before.push(h);
    } else {
      let earliest = Date.parse(h.at);
      if (own(h, 'timeBounds')) {
        try { earliest = Date.parse(normalizeTimeBounds(h.timeBounds).earliestAt); } catch { earliest = NaN; }
      }
      const reviewed = Date.parse(utterance.performanceTimeConfirmedAt);
      const afterReview = Number.isFinite(earliest) && Number.isFinite(reviewed) && earliest > reviewed;
      // A new late-arriving help event was not covered by the human's earlier
      // relative-order confirmation. There is no timestamp to safely order it.
      if (!afterReview) result.unknown.push(h);
      result.relations.push({ helpId: h.id, relation: afterReview ? 'after' : 'unknown',
        reasonCode: afterReview ? 'help-after-human-review' : 'new-help-outside-relative-review',
        helpBounds: h.timeBounds || null, performanceBounds: null });
    }
    if ((result.before.includes(h) || result.unknown.includes(h)) && (h.scope || normalizeHelpScope(h.skills)).status === 'unknown') result.scopeUnknown.push(h);
  }
  return result;
}
function helpFor(session, utterance, skill) {
  return timingFor(session, utterance, skill).before;
}
function collectBlockers(session, u, skill, claim, timing, flags) {
  const rows = [], isPerformance = skill !== 'asr', original = claim.id === 'original';
  const add = (condition, code, reason, group = `${u.id}:${skill}`, status = 'held') => {
    if (condition) rows.push({ id: `${group}:${code}`, code, reason, status });
  };
  const parsed = u.alternatives.map(a => parseControlled(a.text));
  add(flags.requireActual && u.predicted, 'actual-observation-required', '조건부 예상은 실제 관측을 대신하지 않습니다.');
  add(!hasAudio(session, u), 'missing-audio', '이 발화의 원음이 아직 연결되지 않았습니다.', u.id);
  add(!u.alternatives.length, 'no-transcript', '실제 전사 또는 청취 확인이 필요합니다.', u.id);
  add(u.alternatives.some(a => a.unknown === true || a.status === 'unintelligible' || /^(?:\[(?:불명|청취\s*불명|inaudible|unknown)\]|불명|청취\s*불명|unknown|<unk>|\?+)$/iu.test(a.text.trim())),
    'unknown-transcript', '청취 불명은 확인된 단어열이 아닙니다.', u.id);
  add(unknownAffects(session, skill), 'relevant-unknown', `관련 미확인 범위가 남아 있습니다: ${session.unknown.reason}`);
  add(isPerformance && parsed.some(p => !p), 'unsupported-expression', '현재 통제 문장 규칙 밖의 표현입니다. 자연스러운 대안일 수 있으므로 오류로 확정하지 않습니다.');
  add(!u.scopeConfirmed, 'scope-unconfirmed', '전사 후보가 관련 해석 범위를 다루는지 확인해야 합니다.', u.id);
  add(u.source !== 'fixture' && !u.humanConfirmed, 'transcript-not-reviewed', '원음을 들은 사람의 전사 확인이 필요합니다.', u.id);
  if (isPerformance) {
    add(session.task.supported === false, 'unsupported-task', '이 문항은 현재 역할 규칙의 지원 범위 밖입니다.', 'task');
    add(!timing.confirmed, 'performance-time-unconfirmed', '파일 업로드 시각과 실제 수행 시각을 구분해야 합니다.', u.id);
    add(timing.scopeUnknown.length, 'help-scope-unknown', '도움이 영향을 준 능력 범위를 확인하지 못했습니다.');
    add(timing.overlapping.length, 'help-overlaps-capture', '도움과 녹음 구간이 겹쳐 전체를 도움 전 또는 후 수행으로 단정할 수 없습니다.');
    add(timing.unknown.length, 'help-time-order-unknown', '도움과 발화의 선후 관계를 확정할 수 없습니다.');
    add(!u.exposureScopeConfirmed, 'exposure-scope-unconfirmed', '이 시점의 앱 내 도움 관측 범위를 확인해야 합니다.', u.id);
    add(flags.respectEpoch && original && u.epoch !== claim.epoch, 'later-response-not-original-evidence', '새 응답은 처음 수행으로 소급할 수 없습니다.', u.id, 'excluded');
    add(flags.respectEpoch && original && timing.before.some(h => (h.scope || normalizeHelpScope(h.skills)).status === 'known'),
      'original-was-assisted', '원래 시도 전에 관련 답이 노출됐습니다. 독립 수행으로 사용할 수 없습니다.', `${u.id}:${skill}`, 'excluded');
    add(skill === 'object' && !session.task.roleConfirmed, 'role-unconfirmed', '문항의 행위자와 대상을 확인해야 합니다.', 'task');
    add(skill === 'past' && !session.task.pastIndependent, 'independence-unconfirmed', '과거형 관측과 조사 해석의 독립 조건을 확인해야 합니다.', 'task');
  }
  if (u.alternatives.length && (!isPerformance || parsed.every(Boolean))) {
    const effects = effectsFor(u, skill, parsed);
    add(new Set(effects).size !== 1, 'effect-disagreement', '지원 해석에 따라 해당 기록이 달라집니다.');
  }
  return rows;
}
function effectsFor(u, skill, parsed) {
  return u.alternatives.map((a, i) => skill === 'asr' ? a.text.normalize('NFC').trim().replace(/\s+/gu, ' ') : skill === 'object' ?
    (parsed[i].particle === '를' ? '명시된 역할 요구에 부합하는 사용 관측' : '명시된 역할 요구와의 관계 재확인') :
    (parsed[i].past ? '과거형 사용 관측' : '과거 시제 요구 재확인'));
}
function makeCell(session, u, skill, { claim = u, respectEpoch = true, requireActual = true, preparedTiming } = {}) {
  const isOriginal = claim.id === 'original';
  const purpose = skill === 'asr' ? 'asr-data' : (isOriginal ? 'original-performance' : 'response-performance');
  const label = skill === 'asr' ? '정확한 원음–전사 쌍' : skill === 'object' ? '문항의 역할 요구 사용' : '별도 구간의 과거형 사용';
  const dependencies = [`${u.id}:audio`, `${u.id}:${skill === 'asr' ? 'transcript' : skill}`, `${u.id}:scope`, `unknown:${skill}`];
  if (skill !== 'asr') dependencies.push(`${u.id}:help`, `${u.id}:performance-time`, `${u.id}:exposure-scope`, `task:${skill === 'object' ? 'role' : 'past-independence'}`);
  const timing = preparedTiming || timingFor(session, u, skill);
  const cell = { id: `${claim.epoch}:${skill}`, label, purpose, epoch: claim.epoch, utteranceId: claim.id, skill,
    status: 'held', value: null, reason: '', reasonCode: '', dependencies, effectSet: [],
    evidenceSource: u.predicted ? 'prediction-not-observation' : u.source, evidenceEpoch: u.epoch,
    sourceAudioRef: u.audio?.audioRef || null,
    observedAt: u.performanceInterval?.startedAt || null, receivedAt: u.at, performanceTimeSource: u.performanceTimeSource || 'unknown',
    assistance: !timing.confirmed || timing.unknown.length || timing.overlapping.length || timing.scopeUnknown.length ? 'unknown' : timing.before.length ? 'after-help' : 'no-recorded-help',
    temporalEvidence: skill === 'asr' ? null : timing.relations,
    supportScope: session.task.supportScope, synthetic: session.mode === 'example' && u.syntheticEvidence === true };
  cell.blockers = collectBlockers(session, u, skill, claim, timing, { respectEpoch, requireActual });
  const parsed = u.alternatives.map(a => parseControlled(a.text));
  if (u.alternatives.length && (skill === 'asr' || parsed.every(Boolean))) {
    const effects = effectsFor(u, skill, parsed);
    if (cell.blockers.every(b => b.code === 'effect-disagreement')) cell.effectSet = [...new Set(effects)];
    if (new Set(effects).size > 1) {
      const j = effects.findIndex(e => e !== effects[0]);
      cell.witness = [{ text: u.alternatives[0].text, effect: effects[0] }, { text: u.alternatives[j].text, effect: effects[j] }];
    }
  }
  if (cell.blockers.length) {
    const first = cell.blockers[0];
    return Object.assign(cell, { status: first.status, reasonCode: first.code, reason: first.reason });
  }
  cell.status = 'accepted'; cell.value = cell.effectSet[0]; cell.reasonCode = 'invariant-and-eligible';
  cell.reason = skill === 'asr' ? '이 원음의 전사와 관련 범위를 확인했습니다. 도움 여부와 별개로 음성 자료의 자격을 판단합니다.' :
    `${isOriginal ? '처음 시점' : '이 새 응답 시점'}의 관련 해석이 같은 기록을 내고, 문항·의존·도움 관측 조건을 충족합니다.${cell.assistance === 'after-help' ? ' 도움 후 관측으로만 남깁니다.' : ' 확인된 앱 내 관측 범위에 한정합니다.'}`;
  if (u.predicted) cell.reason = '비교 모드: 실제 관측 요건을 끄고 조건부 재청취 분기를 확정된 근거로 사용한 결과입니다.';
  else if (!respectEpoch && u.epoch !== claim.epoch) cell.reason = '비교 모드: 시점별 귀속을 끄고 새 응답을 처음 수행의 근거로 사용한 결과입니다.';
  return cell;
}
function earlierBoundary(session, u, flags, projected = makeCell(session, u, 'object', { claim: session.original, ...flags })) {
  const temporalFailure = flags.respectEpoch;
  return { ...projected, id: `${u.epoch}:earlier-proof`, label: '이 응답으로 처음의 독립 수행 확정', purpose: 'original-performance',
    epoch: 'e0', evidenceEpoch: u.epoch, utteranceId: u.id, skill: 'earlier-proof',
    status: temporalFailure ? 'excluded' : projected.status, value: temporalFailure ? null : projected.value,
    reason: temporalFailure ? '나중의 실제 응답은 새 시점의 근거입니다. 도움 뒤 정답이나 나중의 성공만으로 처음 발화·독립 수행을 확정하지 않습니다.' : projected.reason,
    reasonCode: temporalFailure ? 'later-response-not-original-evidence' : projected.reasonCode,
    dependencies: [`${u.id}:response`, `${u.id}:help`, 'original:evidence'] };
}
function summarize(cells) {
  const count = status => cells.filter(c => c.status === status).length;
  return { total: cells.length, accepted: count('accepted'), held: count('held'), excluded: count('excluded'),
    acceptedAsr: cells.filter(c => c.purpose === 'asr-data' && c.status === 'accepted').length,
    acceptedPerformance: cells.filter(c => c.purpose !== 'asr-data' && c.status === 'accepted').length,
    metricScope: '이 세션의 기록 처리 개수이며 정확도·실력·등록 가능성이 아닙니다.' };
}
function observationCandidates(session, cells) {
  const responsesById = new Map(session.responses.map(r => [r.id, r]));
  const desired = cells.filter(c => c.status === 'held' && (session.purpose === 'asr-data' ? c.purpose === 'asr-data' : c.purpose !== 'asr-data'));
  const listenCanAddress = new Set(['no-transcript', 'scope-unconfirmed', 'transcript-not-reviewed', 'effect-disagreement']);
  const originalTargets = desired.filter(c => c.utteranceId === 'original' && listenCanAddress.has(c.reasonCode)).map(c => c.id);
  const responseTargets = desired.filter(c => c.utteranceId !== 'original' && listenCanAddress.has(c.reasonCode) &&
    hasAudio(session, responsesById.get(c.utteranceId))).map(c => c.id);
  const taskTargets = desired.filter(c => ['role-unconfirmed', 'independence-unconfirmed', 'exposure-scope-unconfirmed', 'performance-time-unconfirmed'].includes(c.reasonCode)).map(c => c.id);
  const cost = seconds => ({ seconds, basis: 'controlled-assumption-not-measured' });
  const resolution = targets => ({ min: 0, max: targets.length, basis: '조건부 계획. 불명·무응답이면 실제 해소는 0일 수 있음' });
  return [
    { id: 'review-original', label: '처음 원음의 불분명한 구간 다시 듣기', intrinsicAllowed: hasAudio(session, session.original), targets: originalTargets,
      reason: '처음 원음의 전사·청취 불명에 의존하는 보류만 대상으로 합니다. 새 학생 수행을 만들지 않습니다.',
      expectedResolution: resolution(originalTargets), exposesAnswer: false, createsEpoch: false, cost: cost(8),
      // These are conditional authored alternatives, not predicted actual results.
      branches: [...session.original.alternatives.map(a => ({ kind: 'heard-text', text: a.text, support: 'conditional' })),
        { kind: 'unintelligible', support: 'conditional' }] },
    { id: 'review-response', label: '새 응답의 원음을 듣고 전사 확인', intrinsicAllowed: session.responses.some(r => hasAudio(session, r)),
      targets: responseTargets, reason: '이미 들어온 실제 응답의 전사를 확인합니다. 처음 발화로 소급하지 않습니다.',
      expectedResolution: resolution(responseTargets), exposesAnswer: false, createsEpoch: false, cost: cost(8) },
    { id: 'confirm-task-conditions', label: '문항·발화 시점·도움 관측 조건 확인', intrinsicAllowed: true,
      targets: taskTargets, reason: '체크만으로 근거가 생기는 것은 아닙니다. 실제 문항·구간·사건 기록으로 조건을 확인합니다.',
      expectedResolution: resolution(taskTargets), exposesAnswer: false, createsEpoch: false, cost: cost(5) },
    { id: 'ask-unrelated-preference', label: '관계없는 선호 질문', intrinsicAllowed: true, targets: [],
      reason: '비교용 공통 후보입니다. 어떤 선호 답도 이 조사·시제 보류를 구별하지 못합니다.',
      expectedResolution: resolution([]), exposesAnswer: false, createsEpoch: true, cost: cost(1) },
    { id: 'show-answer-and-respond', label: '모범 문장을 보여주고 새 응답 받기', intrinsicAllowed: desired.length > 0, targets: [],
      reason: '도움 뒤 새 수행을 얻는 행동입니다. 처음 발화의 독립 수행 보류를 직접 해소하는 근거로는 선택하지 않습니다.',
      expectedResolution: { min: 0, max: 0, basis: '처음 시점은 해소하지 않음; 새 시점 관측 가능' },
      exposesAnswer: true, createsEpoch: true, eligibleForOriginal: false, educationalOnly: true, material: TARGET, cost: cost(1) },
  ];
}
function planObservations(session, cells, candidateSet, flags) {
  const pending = cells.some(c => c.status === 'held' && (session.purpose === 'asr-data' ? c.purpose === 'asr-data' : c.purpose !== 'asr-data'));
  const actions = candidateSet.map(c => ({ ...clone(c),
    allowed: pending && c.intrinsicAllowed && (c.educationalOnly || !flags.targetEffects || c.targets.length > 0),
    selectable: pending && c.intrinsicAllowed && !c.educationalOnly && c.eligibleForOriginal !== false &&
      (!flags.targetEffects || c.targets.length > 0) }));
  // Both paths use exactly the same candidates and assumed costs. Only the
  // connection to a held effect is disabled by the no-target configuration.
  const selectable = actions.filter(a => a.selectable).sort((a, b) => a.cost.seconds - b.cost.seconds || a.id.localeCompare(b.id));
  return { actions, selectedAction: selectable[0]?.id || null };
}
function evidencePlan(session, cells) {
  const wanted = cells.filter(c => c.status === 'held' && c.utteranceId === 'original' && c.purpose === session.purpose);
  const targets = wanted.map(c => ({ id: c.id, epoch: c.epoch, purpose: c.purpose, blockers: c.blockers }));
  const blockers = [...new Map(targets.flatMap(t => t.blockers).map(b => [b.id, b])).values()];
  const specs = [
    ['listen-original', '처음 원음의 전사·해석 확인', 8, ['no-transcript', 'unknown-transcript', 'scope-unconfirmed', 'transcript-not-reviewed', 'effect-disagreement'], hasAudio(session, session.original)],
    ['inspect-task', '실제 문항의 역할·독립 조건 확인', 5, ['role-unconfirmed', 'independence-unconfirmed'], true],
    ['inspect-capture', '녹음의 실제 시점·관측 범위 확인', 5, ['performance-time-unconfirmed', 'exposure-scope-unconfirmed'], true],
    ['inspect-help-time', '도움 기록의 발생 가능 시간을 좁히기', 3, ['help-time-order-unknown'], session.helpEvents.some(h => h.timeBounds)],
    ['inspect-help-scope', '도움이 영향을 준 능력 범위 확인', 3, ['help-scope-unknown'], session.helpEvents.some(h => h.scope?.status === 'unknown')],
  ];
  const actions = specs.map(([id, title, costUnits, codes, available]) => ({ id, title, costUnits, available,
    resolves: blockers.filter(b => codes.includes(b.code)).map(b => b.id), exposesAnswer: false, createsEpoch: false }));
  // A whole-session audit is a meaningful common alternative to several narrow
  // inspections; the cost is a declared comparison assumption, not a stopwatch.
  actions.push({ id: 'audit-existing-record', title: '원음과 문항·도움 기록을 함께 확인', costUnits: 15, available: hasAudio(session, session.original),
    resolves: [...new Set(actions.flatMap(a => a.resolves))], exposesAnswer: false, createsEpoch: false });
  actions.push({ id: 'show-answer-new-response', title: '답을 보여주고 새 응답 받기', costUnits: 1, available: true,
    resolves: session.purpose === 'asr-data' ? [] : blockers.map(b => b.id), exposesAnswer: true, createsEpoch: true, eligibleForOriginal: false });
  const result = planEvidencePreserving({ targets, actions, budget: 32, maxDepth: 8, maxStates: 5000 });
  return { ...result, targets, actions, contract: 'synk.evidence-plan.v1',
    scope: '지원하는 확인 수단과 가정 비용 아래의 조건부 계획입니다. 확인 실패·불명·반대 근거가 나오면 실제 판정은 그대로 보류되거나 제외되며 새로 계획합니다.' };
}
function policyFor(ablation) {
  return { separatePurposes: ablation !== 'no-purpose', respectEpoch: ablation !== 'no-epoch',
    targetEffects: ablation !== 'no-target', requireActual: ablation !== 'predicted-response' };
}
function sourceFor(session, claim, skill, flags, conditionalBranch) {
  if (claim.id === 'original' && !flags.respectEpoch && skill !== 'asr' && session.responses.length) return session.responses.at(-1);
  if (claim.id === 'original' && !flags.requireActual && conditionalBranch) return { ...clone(claim),
    alternatives: [{ text: conditionalBranch.text, source: 'human' }], source: 'human', scopeConfirmed: true,
    humanConfirmed: true, predicted: true };
  return claim;
}
function projectedCell(session, source, skill, claim, flags, resolver) {
  const timing = timingFor(session, source, skill);
  // These are the complete inputs read by makeCell, grouped by the condition
  // they can invalidate. Raw recognizer alternatives that did not replace a
  // human review and unrelated task/UNKNOWN fields cannot dirty this cell.
  const inputs = {
    claim: { id: claim.id, epoch: claim.epoch },
    audio: { id: source.id, epoch: source.epoch, at: source.at, audio: source.audio, syntheticEvidence: source.syntheticEvidence, mode: session.mode },
    transcript: { alternatives: source.alternatives, source: source.source, predicted: source.predicted },
    reviewScope: { scopeConfirmed: source.scopeConfirmed, humanConfirmed: source.humanConfirmed },
    timing: { ...timing, performanceInterval: source.performanceInterval, performanceTimeSource: source.performanceTimeSource },
    unknown: { affects: unknownAffects(session, skill), reason: unknownAffects(session, skill) ? session.unknown.reason : null },
    task: { supportScope: session.task.supportScope, ...(skill === 'asr' ? {} : { supported: session.task.supported,
      condition: skill === 'object' ? session.task.roleConfirmed : session.task.pastIndependent }) },
    exposureScope: skill === 'asr' ? null : source.exposureScopeConfirmed,
    policy: { respectEpoch: flags.respectEpoch, requireActual: flags.requireActual }
  };
  const key = `${flags.respectEpoch ? 'epoch' : 'no-epoch'}:${flags.requireActual ? 'actual' : 'predicted'}:${claim.id}:${source.id}:${skill}`;
  return resolver.resolve(key, inputs, () => makeCell(session, source, skill, { claim, ...flags, preparedTiming: timing }));
}
function projectWithPolicy(session, flags, conditionalBranch, resolver) {
  const utterances = [session.original, ...session.responses];
  return utterances.flatMap(claim => {
    const drafts = ['asr', 'object', 'past'].map(skill => projectedCell(session, sourceFor(session, claim, skill, flags, conditionalBranch), skill, claim, flags, resolver));
    // The comparison applies one global admission gate to the same projection
    // drafts. Main keeps each consumer's eligibility separate.
    const globalGate = flags.separatePurposes || drafts.every(d => d.status === 'accepted');
    const admitted = drafts.map(d => globalGate || d.status !== 'accepted' ? d : { ...d, status: 'held', value: null,
      reasonCode: 'global-admission-gate', reason: '목적별 자격 분리를 끈 비교입니다. 같은 발화의 모든 용도가 통과해야 하나의 전체 승인으로 처리합니다.' });
    return [...admitted, ...(claim.id === 'original' ? [] : [earlierBoundary(session, claim, flags,
      projectedCell(session, claim, 'object', session.original, flags, resolver))])];
  });
}
function evaluatePolicy(session, ablation, commonCandidates, resolver, preparedCells) {
  const flags = policyFor(ablation);
  const firstBranch = commonCandidates.find(a => a.id === 'review-original')?.branches?.find(b => b.kind === 'heard-text');
  const conditionalBranch = session.responses.length === 0 ? firstBranch : null;
  const cells = preparedCells || projectWithPolicy(session, flags, conditionalBranch, resolver);
  const candidateSet = ablation === 'no-target' || ablation === 'none' ? commonCandidates : observationCandidates(session, cells);
  const planned = planObservations(session, cells, candidateSet, flags);
  return { version: VERSION, ablation, diagnosticOnly: ablation !== 'none', flags, cells, candidateSet: clone(candidateSet), ...planned,
    conditionalEvidence: conditionalBranch ? { ...conditionalBranch, actual: false, usedForJudgment: !flags.requireActual } : null,
    metrics: summarize(cells), summary: '자료마다 사용처·능력·시점을 나누어 실제 근거로 다시 판단합니다.',
    comparisonScope: '구성별 기준 규칙의 차이 시연입니다. 진보성·실제 성능 우위를 입증하는 실험이 아닙니다.',
    limits: ['음성–확인 전사 쌍은 문장 종류와 무관하게 처리합니다. 문법·역할 효과는 지정한 통제 문장만 지원합니다.',
      '해석 범위·의존 독립성의 사람 확인은 모든 원인을 찾아냈다는 인증이 아닙니다.',
      '도움 없음은 확인한 앱 내 범위에 한정하며 외부 도움 전체를 보증하지 않습니다.',
      '파일 업로드 시각은 발화 시각이 아닙니다. 브라우저 녹음 구간 또는 사람의 상대 시점 확인을 근거로 구분합니다.',
      '예상 응답은 관측 사실이 아닙니다. 실제 응답 전에는 본 판단에 반영하지 않습니다.',
      '관측 비용 1·5·8초와 응답 분기는 설명용 가정입니다. 실제 시간·해소율을 측정한 값이 아닙니다.'] };
}
function compared(result, base) {
  const byId = new Map(base.cells.map(c => [c.id, c]));
  const changed = result.cells.filter(c => {
    const before = byId.get(c.id);
    return !before || before.status !== c.status || JSON.stringify(before.value) !== JSON.stringify(c.value);
  });
  result.comparedWithMain = { changedCells: changed.map(c => c.id),
    promotedWithoutMainSupport: changed.filter(c => c.status === 'accepted' && byId.get(c.id)?.status !== 'accepted').length,
    retainedRecordsLost: changed.filter(c => c.status !== 'accepted' && byId.get(c.id)?.status === 'accepted').length,
    selectedActionChanged: result.selectedAction !== base.selectedAction,
    basis: '동일 세션의 본 규칙과 비교; 외부 정답표나 실제 정확도 측정이 아님' };
  return result;
}
function evaluate(session, { ablation = 'none', previousProjection = null, engineKey = VERSION, forceFull = false } = {}) {
  if (!ABLATIONS.includes(ablation)) throw new TypeError('지원하지 않는 비교 방식입니다.');
  const resolver = createResolver(previousProjection, engineKey, { forceFull });
  const initial = projectWithPolicy(session, policyFor('none'), null, resolver);
  const commonCandidates = observationCandidates(session, initial);
  const base = evaluatePolicy(session, 'none', commonCandidates, resolver, initial);
  base.evidencePlan = evidencePlan(session, initial);
  if (ablation !== 'none') return { ...compared(evaluatePolicy(session, ablation, commonCandidates, resolver), base), ...resolver.finish() };
  base.comparisons = ABLATIONS.slice(1).map(id => {
    const r = compared(evaluatePolicy(session, id, commonCandidates, resolver), base);
    return { id, ablation: id, diagnosticOnly: true, cells: r.cells, actions: r.actions, selectedAction: r.selectedAction,
      candidateSet: r.candidateSet, flags: r.flags, metrics: r.metrics, comparedWithMain: r.comparedWithMain,
      comparisonScope: r.comparisonScope, conditionalEvidence: r.conditionalEvidence };
  });
  return { ...base, ...resolver.finish() };
}

module.exports = { VERSION, createSession, applyEvent, evaluate, examples, TARGET, ABLATIONS };
