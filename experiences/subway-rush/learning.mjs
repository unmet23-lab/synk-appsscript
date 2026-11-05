// 게임은 원고와 판정을 맡고, 아틀라스는 공통 기록과 다음 연습의 선택을 맡는다(말 랠리 · 빈칸 베기와 같은 연결, 설계 3절).
// 결정 하나 = 듣기 문항 하나(보기 셋, 음성 필요). 안내를 끝까지 들려준 뒤 첫 손짓만 혼자 해낸 근거다(delivery: completed).
// 환승 말이 없는 역의 「그대로」와 장면으로 풀리는 만남은 평가하지 않는 응답으로 닫는다. 고른 칸은 기계 ID로만 남는다.
import { returnPractice } from './kit/return-practice.mjs';
import { practiceStarts, journeyFrom } from './journeys.mjs?v=return-20261105';

export const GAME_ID = 'subway-rush';
export const FORMAT = 'single-choice';

// 문장 · 보기 · 정답을 바꾸면 그 문항의 판을 올린다(학습기준 §7-2).
export const ITEM_VERSION = Object.freeze({});

export function decisionMeta(d) {
  const version = ITEM_VERSION[d.id] || 1;
  return { id: `${GAME_ID}.${d.id}`, itemKey: `${GAME_ID}.${d.id}.v${version}`, familyKey: `${GAME_ID}.${d.family}.v1`, skillId: d.skillId, difficulty: d.difficulty,
    modality: 'listening', responseFormat: FORMAT, audioRequired: true, confounded: false, conceptIds: [] };
}
export function meetingMeta(item) {
  const version = ITEM_VERSION[item.id] || 1;
  return { id: `${GAME_ID}.${item.id}`, itemKey: `${GAME_ID}.${item.id}.v${version}`, familyKey: `${GAME_ID}.${item.family}.v1`, skillId: item.skillId, difficulty: item.difficulty,
    modality: 'listening', responseFormat: FORMAT, audioRequired: true, confounded: false, conceptIds: [] };
}
export function answerPayload({ correct, assessable, selectedId, correctId, reason = null }) {
  const payload = { correct, assessable };
  if (selectedId) payload.choice = { selectedId, correctId };
  // 찍어도 맞는 칸의 까닭은 게임이 아는 말이고 Trail의 사유 목록에는 없다. 사유 없이 평가하지 않는 응답(unassessed)으로 남는다.
  if (!assessable && reason && reason !== 'guessable') payload.reason = reason;
  return payload;
}

/** 문항 하나의 기록. 기록이 거절돼도(저장소 막힘 · 다른 탭) 게임은 멈추지 않는다. coach가 없으면 아무것도 안 한다. */
export function createExchange(coach, meta) {
  const safe = (fn) => { try { return fn(); } catch { return null; } };
  const pid = coach ? safe(() => coach.present(meta)) : null;
  let closed = !pid, delivered = false;
  return {
    pid,
    heard(ok) { if (closed || delivered) return null; delivered = true; return safe(() => coach.delivery(pid, { audio: ok ? 'completed' : 'failed' })); },
    help(kind) { if (closed) return null; return safe(() => coach.help(pid, kind)); },
    answer(payload) { if (closed) return null; closed = true; return safe(() => coach.answer(pid, payload)); },
    cancel() { if (closed) return null; closed = true; return safe(() => coach.answer(pid, { correct: null, assessable: false, reason: 'unanswered' })); },
  };
}

/** 후보 여정들 가운데 아틀라스가 고른 문항(덜 만난 · 놓친)이 든 여정을 앞세운다(다음 판 복습). 고르지 못하면 첫 후보. */
export function preferJourney(coach, journeys) {
  if (!coach || journeys.length < 2) return journeys[0];
  try {
    const seen = new Map();
    for (const j of journeys) for (const d of j.decisions) if (d.assessable && !seen.has(d.id)) seen.set(d.id, d);
    const items = [...seen.values()].map((d) => { const m = decisionMeta(d); return { id: m.id, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality, responseFormat: m.responseFormat, itemKey: m.itemKey, familyKey: m.familyKey, conceptIds: m.conceptIds, audioRequired: true }; });
    const r = coach.recommend(items, { audioAvailable: true });
    const want = r?.status === 'ready' ? r.selected?.id : null;
    return (want && journeys.find((j) => j.decisions.some((d) => `${GAME_ID}.${d.id}` === want))) || journeys[0];
  } catch { return journeys[0]; }
}

/* 재방문 맞춤 판(다른 일곱 게임과 같은 kit/return-practice 기준): 이 게임에서 도움 없이 처음 듣고 답한 서로 다른 문항을 두 번 놓친 유형만 말한다.
 * 한 판에 몇 번 만나지 않는 안내라 말 랠리 · 빈칸 베기의 이음말처럼 근거 둘부터 본다. 말하는 것은 단서의 종류뿐이고 정답 쪽은 말하지 않는다.
 * 통로 방면은 계열이 하나라 서로 다른 두 문항이 없고, 만남은 판의 첫 문항이 될 수 없어 예고하지 않는다. */
export const RETURN_PATTERNS = Object.freeze({
  off: { minEvidence: 2, why: '전에 내릴 역에 섰을 때 안내를 놓친 적이 있어요.', next: '이번 첫 안내도 그런 말이에요. 역 이름과 문 쪽을 끝까지 듣고 골라 보세요.' },
  pass: { minEvidence: 2, why: '전에 ‘갈아타실 분은 내리시기 바랍니다’를 듣고 내 역이 아닌데 내린 적이 있어요.', next: '이번 첫 안내에도 갈아타는 말이 나와요. 내가 내릴 역인지 끝까지 들어 보세요.' },
  exit: { minEvidence: 2, why: '전에 길 안내가 말한 출구 번호를 놓친 적이 있어요.', next: '이번 첫 안내도 출구 번호를 말해요. 숫자를 끝까지 듣고 골라 보세요.' },
  closed: { minEvidence: 2, why: '전에 공사로 막힌 출구 대신 어느 출구로 가라는 안내를 놓친 적이 있어요.', next: '이번 첫 안내도 그런 말이에요. 막힌 번호와 쓸 수 있는 번호를 가려 들어 보세요.' },
  service: { minEvidence: 2, why: '전에 ‘까지만 운행합니다’나 ‘서지 않습니다’처럼 운행이 바뀌는 안내를 놓친 적이 있어요.', next: '이번 첫 안내도 그런 말이에요. 무엇이 바뀌었는지 끝까지 듣고 골라 보세요.' },
});
const OFF_WHY = Object.freeze({ door: '전에 ‘내리실 문은’ 뒤에 나오는 문 쪽을 놓친 적이 있어요.', station: '전에 안내의 역 이름을 놓쳐 내릴 역을 지나친 적이 있어요.' });
export function patternOfFamily(familyKey) {
  const family = String(familyKey).replace(`${GAME_ID}.`, '').replace(/\.v\d+$/, '');
  if (/^stop\.[a-z0-9]+\.off$/.test(family)) return 'off';
  if (/^stop\.[a-z0-9]+\.pass$/.test(family)) return 'pass';
  if (/^exit\.\d$/.test(family)) return 'exit';
  if (/^busy\.exit\.\d$/.test(family)) return 'closed';
  if (/^busy\.(?:short|delay|express\.[a-z0-9]+)$/.test(family)) return 'service';
  return null;
}
// 내릴 역 안내는 공통 판정이 내준 최근 독립 근거의 오답에서 실제로 고른 칸만 본다: 모두 반대 문이면 문 쪽, 모두 「그대로」면 역 이름.
// 선택이 없거나 섞였으면 원인을 단정하지 않는 기본 문구. 그 밖의 예전 · 도움 · 소리 실패 기록은 읽지 않는다.
const offClue = (selectedId) => selectedId === 'subway.stay' ? 'station' : selectedId === 'subway.left' || selectedId === 'subway.right' ? 'door' : null;
function offWhy(coach, evidenceIds) {
  const evidence = new Set(evidenceIds), clues = new Set();
  for (const event of coach.events()) if (evidence.has(event.id) && event.verdict === 'incorrect') clues.add(offClue(event.choice?.selectedId));
  const [clue] = clues;
  return clues.size === 1 && clue ? OFF_WHY[clue] : RETURN_PATTERNS.off.why;
}
/** 다음 판의 맞춤 연습. { journey(그 문항이 첫 평가인 여정), why, next, ... } 또는 null. */
export function missedPractice(coach, level) {
  const plan = returnPractice({ coach, gameId: GAME_ID, patterns: RETURN_PATTERNS, patternOfFamily,
    freshItems: (pattern) => [...practiceStarts(level).values()].filter((row) => patternOfFamily(decisionMeta(row.decision).familyKey) === pattern)
      .map((row) => { const meta = decisionMeta(row.decision); return { id: meta.id, item: row, meta }; }) });
  if (!plan) return null;
  return { ...plan, why: plan.patternId === 'off' ? offWhy(coach, plan.evidenceIds) : plan.why, journey: journeyFrom(plan.target.item) };
}
// 이 게임 기록의 사실만 읽는다. 다른 게임의 기록은 말하지 않고, 찍어도 맞는 칸(guessable)은 세지 않는다.
function pastAnswers(coach) {
  const summary = coach.summary();
  if (summary?.storage?.available !== true || summary.evidenceComplete !== true) return null;
  const independent = new Set(), events = coach.events(), byId = new Map(events.map((event) => [event.id, event]));
  for (const skill of summary.skills || []) for (const level of Object.values(skill.levels || {})) for (const cell of Object.values(level.formats || {})) for (const id of cell.evidence || []) independent.add(id);
  const helped = new Set(events.filter((e) => e.type === 'practice.helped').map((e) => e.presentationId));
  const failed = new Set(events.filter((e) => e.type === 'practice.delivery' && e.audio !== 'completed').map((e) => e.presentationId));
  return events.filter((e) => e.type === 'practice.attempted' && byId.get(byId.get(e.presentationId)?.decisionId)?.experienceId === GAME_ID).map((e) => ({
    kind: failed.has(e.presentationId) ? 'audio' : helped.has(e.presentationId) ? 'helped' : independent.has(e.id) ? (e.verdict === 'correct' ? 'solo' : 'missed') : 'other',
  }));
}
/** 입구 한 줄. 놓친 유형이 없으면 저장된 사실만 말하고, 할 말이 없으면 null(첫 방문과 같은 입구). 소리 실패 · 도움을 오답으로 말하지 않는다. */
export function entryNote(coach, plan = null) {
  if (plan) return `${plan.why} ${plan.next}`;
  try {
    const rows = coach ? pastAnswers(coach) : null;
    if (!rows?.length) return null;
    const recent = rows.filter((row) => row.kind !== 'other').slice(-3);
    if (recent.some((row) => row.kind === 'audio')) return '전에 소리가 끊긴 안내가 있었어요. 틀린 것으로 세지 않았어요. 소리를 확인하고 다시 들어 보세요.';
    if (recent.some((row) => row.kind === 'helped')) return '전에 다시 듣기나 글 보기를 쓴 안내가 있었어요. 이번에는 먼저 끝까지 듣고 골라 보세요.';
    const solo = rows.filter((row) => row.kind === 'solo').length;
    if (solo && recent.at(-1)?.kind === 'solo') return `지금까지 안내 ${solo}개를 처음 듣고 도움 없이 맞혔어요.`;
  } catch { /* 기록을 읽지 못하면 말하지 않는다 */ }
  return null;
}

// 문항 검수 기록(experiences/topik-items/review/existing-verdicts.json)은 기계 키를 ASCII로 옮기기 전 키로 남아 있다. 안내 · 보기 · 정답은 그대로라 판정이 그대로 이어진다.
const REVIEWED_BEFORE = 'subway-rush.fork.cheongnyangni.';
export const reviewedKey = (itemKey) => itemKey.startsWith(REVIEWED_BEFORE) ? `subway-rush.fork.청량리.${itemKey.slice(REVIEWED_BEFORE.length)}` : itemKey;
