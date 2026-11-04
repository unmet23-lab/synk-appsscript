// 게임은 원고와 판정을 맡고, 아틀라스는 공통 기록과 다음 연습의 선택을 맡는다(말 랠리 · 빈칸 베기와 같은 연결, 설계 3절).
// 결정 하나 = 듣기 문항 하나(보기 셋, 음성 필요). 안내를 끝까지 들려준 뒤 첫 손짓만 혼자 해낸 근거다(delivery: completed).
// 환승 말이 없는 역의 「그대로」와 장면으로 풀리는 만남은 평가하지 않는 응답으로 닫는다. 고른 칸은 기계 ID로만 남는다.
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
  if (!assessable && reason) payload.reason = reason;
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
