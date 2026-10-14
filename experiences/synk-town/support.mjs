/** Local Town reading adapter. The host owns its clock, answer key and persistence.
 * Core supplies exact reading/format priorities; this is neither an account profile
 * nor a proficiency engine. A proposal never changes an accepted life scene.
 */
import { READING_CHECKS, readingMetadata, readingAnswer, readingFeedback } from './understanding.mjs';
import Learning from '../../atlas/learning.js';
import Strata from '../../strata/index.js';
import mapData from '../../strata/maps/topik-i.json' with {type:'json'};
const map = Strata.createMap(mapData);
const VERSION = 'town-reading-support-1', SCOPE = 'preview-local-reading';
const modes = ['plain', 'stepwise'], skills = ['detail', 'sequence', 'negation'];
const kindSkills = { tea: 'sequence', coordination: 'sequence', help: 'detail' };
const clone = value => structuredClone(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const check = (ok, code, message, status = 400) => { if (!ok) throw new SupportError(code, message, status); };
export class SupportError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
function itemFor(id) { return READING_CHECKS.find(item => item.id === id); }
function clock(nowMs) { check(integer(nowMs), 'invalid-support-clock', '읽기 기록의 시간을 확인할 수 없어요.', 503); return new Date(nowMs).toISOString(); }
function mode(value) { check(modes.includes(value), 'invalid-language-support', '설명 방식을 다시 골라 주세요.'); return value; }
export function initialSupport() {
  return { schema: 1, scope: SCOPE, revision: 0, sequence: 0, presentations: [], attempts: [], active: null,
    selection: { mode: 'plain', source: 'default', basis: null } };
}
function validBasis(b) {
  return b && b.policy === Learning.POLICY.version && b.version === VERSION && Object.hasOwn(kindSkills, b.kind)
    && b.skillId === `ko.reading.${kindSkills[b.kind]}` && b.difficulty === 1 && b.responseFormat === 'single-choice'
    && ['practice', 'supported', 'checking', 'review', 'recent-independent'].includes(b.state)
    && Array.isArray(b.evidence) && b.evidence.every(id => typeof id === 'string' && /^support-answer-[1-9]\d*$/.test(id))
    && Array.isArray(b.supportingEvidence) && b.supportingEvidence.every(id => typeof id === 'string' && /^support-answer-[1-9]\d*$/.test(id));
}
export function assertSupport(s) {
  const invalid = () => new SupportError('invalid-support-save', '이 브라우저 체험의 읽기 기록을 확인할 수 없어요.', 503);
  if (!s || s.schema !== 1 || s.scope !== SCOPE || !integer(s.revision) || !integer(s.sequence)
    || !Array.isArray(s.presentations) || s.presentations.length > 10000 || !Array.isArray(s.attempts)
    || s.attempts.length > s.presentations.length || !s.selection || !modes.includes(s.selection.mode)
    || !['default', 'explicit', 'accepted-proposal'].includes(s.selection.source)
    || (s.selection.source === 'accepted-proposal' ? !validBasis(s.selection.basis) : s.selection.basis !== null)) throw invalid();
  const presented = new Map(), answered = new Set(), families = new Set(); let lastAt = -Infinity;
  for (const p of s.presentations) {
    const item = itemFor(p?.itemId), n = Number(p?.id?.replace('support-presentation-', ''));
    if (!item || p.id !== `support-presentation-${n}` || !Number.isSafeInteger(n) || n <= 0 || n > s.sequence
      || presented.has(p.id) || p.itemVersion !== 'v1' || typeof p.hinted !== 'boolean'
      || !integer(p.atMs) || p.atMs < lastAt || p.firstExposure !== !families.has(readingMetadata(item).familyKey)) throw invalid();
    lastAt = p.atMs; families.add(readingMetadata(item).familyKey); presented.set(p.id, p);
  }
  for (const a of s.attempts) {
    const p = presented.get(a?.presentationId), item = p && itemFor(p.itemId);
    if (!p || answered.has(p.id) || a.id !== p.id.replace('presentation', 'answer') || a.itemId !== p.itemId
      || !integer(a.atMs) || a.atMs < p.atMs || !Number.isInteger(a.choice) || a.choice < 0 || a.choice >= item.choices.length
      || a.correct !== (a.choice === item.correct) || a.assisted !== p.hinted || a.independent !== (p.firstExposure && !p.hinted)
      || a.grading !== 'local-server-scored') throw invalid();
    answered.add(p.id);
  }
  if (s.active !== null && (!s.active || typeof s.active.open !== 'boolean' || !presented.has(s.active.presentationId)
    || s.active.presentationId !== s.presentations.at(-1)?.id)) throw invalid();
  if (s.selection.basis && [...s.selection.basis.evidence, ...s.selection.basis.supportingEvidence].some(id => !s.attempts.some(a => a.id === id))) throw invalid();
  return s;
}
function summaryFor(s, nowMs) {
  const asOf = clock(nowMs);
  const attempts = s.attempts.map(a => ({ eventId: a.id, at: new Date(a.atMs).toISOString(),
    verdict: a.correct ? 'correct' : 'incorrect', independent: a.independent, assisted: a.assisted,
    measure: readingMetadata(itemFor(a.itemId)) }));
  return Learning.summarizeLearning({ summary: { asOf, attempts }, map, complete: true });
}
function presentationHistory(s) {
  return s.presentations.map(p => { const m = readingMetadata(itemFor(p.itemId)); return { taskId: m.id, itemKey: m.itemKey, measure: { familyKey: m.familyKey } }; });
}
function openItem(s, payload, nowMs) {
  check(s.presentations.length < 10000, 'support-history-full', '이 체험의 읽기 기록이 가득 찼어요. 읽기 기록을 지운 뒤 다시 시작할 수 있어요.', 409);
  check(payload.skill === undefined || skills.includes(payload.skill), 'invalid-reading-skill', '읽기 영역을 다시 골라 주세요.');
  const candidates = READING_CHECKS.filter(item => payload.skill === undefined || item.skill === payload.skill)
    .map(item => { const m = readingMetadata(item); return { ...m, skillIds: [m.skillId] }; });
  const result = Learning.recommend({ profile: summaryFor(s, nowMs), candidates, presentations: presentationHistory(s) });
  check(result.selected, 'reading-unavailable', '지금 열 수 있는 안내문이 없어요.', 409);
  const item = itemFor(result.selected.id), family = readingMetadata(item).familyKey;
  const id = `support-presentation-${++s.sequence}`;
  s.presentations.push({ id, itemId: item.id, itemVersion: 'v1', atMs: nowMs, hinted: false,
    firstExposure: !s.presentations.some(p => readingMetadata(itemFor(p.itemId)).familyKey === family) });
  s.active = { presentationId: id, open: true };
}
function current(s, payload, { unanswered = false } = {}) {
  check(s.active?.open && payload.presentationId === s.active.presentationId, 'stale-reading', '지금 열린 안내문을 다시 확인해 주세요.', 409);
  const p = s.presentations.find(p => p.id === s.active.presentationId);
  check(!unanswered || !s.attempts.some(a => a.presentationId === p.id), 'reading-already-answered', '이미 답한 안내문이에요. 다음 안내문을 열 수 있어요.', 409);
  return p;
}
function proposalFor(s, { nowMs, kind = 'tea' }, profile = summaryFor(s, nowMs)) {
  check(Object.hasOwn(kindSkills, kind), 'invalid-support-kind', '생활 장면을 다시 확인해 주세요.');
  const skillId = `ko.reading.${kindSkills[kind]}`, bucket = profile.skills.find(row => row.id === skillId).levels[1].formats['single-choice'];
  let proposed = null, reason = null;
  if (bucket.status === 'practice' || bucket.status === 'supported' || bucket.status === 'checking' && bucket.incorrect > 0) {
    proposed = 'stepwise'; reason = '이 체험의 해당 읽기 기록을 바탕으로, 다음 생활의 설명을 한 부분씩 보고 고를 수 있어요.';
  } else if (bucket.status === 'recent-independent') {
    proposed = 'plain'; reason = '최근 해당 안내문을 도움 없이 답한 기록이 있어요. 다음 생활은 설명을 한 번에 보고, 필요할 때 다시 요청할 수 있어요.';
  }
  // Missing/old evidence is not evidence of low ability. An explicit choice stays
  // selected even when a fresh proposal offers another option.
  if (!proposed || proposed === s.selection.mode) return null;
  const supportingEvidence = s.attempts.filter(a => a.assisted && a.correct && a.atMs <= nowMs
    && nowMs - a.atMs <= Learning.POLICY.recentDays * 86400000 && readingMetadata(itemFor(a.itemId)).skillId === skillId).map(a => a.id);
  const basis = { version: VERSION, policy: profile.policy, kind, skillId, difficulty: 1, responseFormat: 'single-choice',
    state: bucket.status, evidence: [...bucket.evidence], supportingEvidence };
  return { id: `${VERSION}:${s.revision}:${kind}:${proposed}:${bucket.status}`, mode: proposed,
    label: proposed === 'stepwise' ? '다음 생활은 하나씩 설명해 주세요' : '다음 생활은 한 번에 설명해 주세요', reason, ...basis };
}
export function commandSupport(s, type, payload = {}, { nowMs, kind = 'tea' } = {}) {
  assertSupport(s); clock(nowMs);
  check(nowMs >= Math.max(0, ...s.presentations.map(p => p.atMs), ...s.attempts.map(a => a.atMs)), 'invalid-support-clock', '읽기 기록의 시간을 다시 확인해 주세요.', 503);
  switch (type) {
    case 'SUPPORT_OPEN':
      if (s.active) s.active.open = true;
      else openItem(s, payload, nowMs);
      break;
    case 'SUPPORT_HINT': {
      const p = current(s, payload, { unanswered: true }); p.hinted = true; break;
    }
    case 'SUPPORT_ANSWER': {
      const p = current(s, payload, { unanswered: true }), item = itemFor(p.itemId);
      check(Number.isInteger(payload.choice) && payload.choice >= 0 && payload.choice < item.choices.length, 'invalid-reading-answer', '보기 하나를 골라 주세요.');
      const result = readingAnswer(item, payload.choice);
      s.attempts.push({ id: p.id.replace('presentation', 'answer'), presentationId: p.id, itemId: item.id, atMs: nowMs,
        choice: payload.choice, correct: result.correct, assisted: p.hinted, independent: p.firstExposure && !p.hinted, grading: 'local-server-scored' });
      break;
    }
    case 'SUPPORT_NEXT':
      check(s.active?.open && s.attempts.some(a => a.presentationId === s.active.presentationId), 'reading-answer-pending', '안내문을 먼저 읽고 답하거나 닫아 주세요.', 409);
      openItem(s, payload, nowMs); break;
    case 'SUPPORT_CLOSE': if (s.active) s.active.open = false; break;
    case 'SUPPORT_SET': s.selection = { mode: mode(payload.mode), source: 'explicit', basis: null }; break;
    case 'SUPPORT_ACCEPT': {
      const p = proposalFor(s, { nowMs, kind: payload.kind ?? kind });
      check(p && p.id === payload.proposalId, 'stale-support-proposal', '읽기 기록이 바뀌었어요. 지금 제안을 다시 확인해 주세요.', 409);
      const { id, mode: accepted, label, reason, ...basis } = p;
      s.selection = { mode: accepted, source: 'accepted-proposal', basis }; break;
    }
    case 'SUPPORT_CLEAR': {
      const revision = s.revision; Object.assign(s, initialSupport(), { revision }); break;
    }
    default: throw new SupportError('unknown-support-command', '읽기와 설명 설정을 다시 확인해 주세요.');
  }
  s.revision++; assertSupport(s);
}
export function snapshotSupport(s) {
  assertSupport(s); return { mode: s.selection.mode, source: s.selection.source, revision: s.revision, basis: clone(s.selection.basis) };
}
export function viewSupport(s, { nowMs, kind = 'tea' } = {}) {
  assertSupport(s); const profile = summaryFor(s, nowMs);
  const p = s.active && s.presentations.find(p => p.id === s.active.presentationId), item = p && itemFor(p.itemId);
  const a = p && s.attempts.find(a => a.presentationId === p.id);
  return { scope: SCOPE, scopeLabel: '이 개발 체험에서 직접 답한 읽기 기록 · WORLD 계정과 연결되지 않음', accountLinked: false,
    selection: snapshotSupport(s), proposal: proposalFor(s, { nowMs, kind }, profile),
    profile: { policy: profile.policy, mapVersion: map.map_ver, grade: null, learningEffectClaim: false,
      skills: skills.map(id => { const row = profile.skills.find(x => x.id === `ko.reading.${id}`);
        return { id: row.id, label: row.label, ...clone(row.levels[1].formats['single-choice']) }; }) },
    reading: p ? { open: s.active.open, presentationId: p.id, item: { id: item.id, skill: item.skill, passage: item.passage, question: item.question, choices: [...item.choices] },
      hint: p.hinted ? item.hint : null, answered: !!a,
      feedback: a ? { line: readingFeedback(item, a.choice), correct: a.correct, selected: a.choice, correctChoice: item.correct,
        independent: a.independent, assisted: a.assisted, eventId: a.id } : null } : null };
}
