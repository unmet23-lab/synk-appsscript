// 게임은 원고와 판정을 맡고, 아틀라스는 공통 기록과 다음 연습의 선택을 맡는다(빈칸 베기와 같은 연결).
// 몽글의 말 하나 = 듣기 문항 하나(보기 셋 고르기, 음성 필요). 받아친 대답(고른 카드)이 그 말의 답이다.
// 음성을 끝까지 들려준 뒤에만 혼자 해낸 근거가 된다(delivery: completed). 소리를 꺼서 못 들었으면 그 답은 평가하지 않는다.
// 공은 고를 때까지 라켓 앞에서 기다려 준다(10-03 「공이 기다려 줘요」 — 시간이 지나 놓치는 일이 없다). 기다리는 동안 다시 듣기·글로 보기를 쓰면
// 도움으로 남는다. 그만두기로 닫은 문항은 평가하지 않는 응답이다.
import { ITEMS, SKILL_LABEL } from './content.mjs';

export const GAME_ID = 'talk-rally';
export const FORMAT = 'single-choice';

export function itemMetadata(item) {
  const key = `${GAME_ID}.${item.id}.v1`;
  return { id: `${GAME_ID}.${item.id}`, itemKey: key, familyKey: key, skillId: item.skill, difficulty: item.difficulty,
    modality: 'listening', responseFormat: FORMAT, audioRequired: true, confounded: false, conceptIds: [] };
}

export function candidates(items) {
  return items.map((x) => {
    const m = itemMetadata(x);
    return { id: m.id, itemId: x.id, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality,
      responseFormat: m.responseFormat, itemKey: m.itemKey, familyKey: m.familyKey, conceptIds: m.conceptIds };
  });
}

/** 필요 순서. 아틀라스를 못 쓰면 null(원고 순서로 진행). */
export function rankItems(coach, items, { audioAvailable = true } = {}) {
  if (!coach) return null;
  try {
    const r = coach.recommend(candidates(items), { audioAvailable });
    if (r.status !== 'ready') return null;
    return { order: [r.selected, ...r.alternatives].map((x) => x.itemId), reason: r.reason, skillId: r.focusSkillId, state: r.state };
  } catch { return null; }
}

export const answerPayload = (correct) => ({ correct, assessable: true });
export const missedPayload = () => ({ correct: null, assessable: false, reason: 'unanswered' });

/**
 * 말 하나의 기록. 몽글이 말을 시작할 때 present, 음성이 끝나면 heard(true)·못 틀면 heard(false).
 * 답은 한 번만(받아친 카드). 다시 듣기·글로 보기는 help. 그만두면 평가하지 않는 응답으로 닫는다.
 * 기록이 거절돼도(다른 탭에서 기록을 지움 등) 게임은 멈추지 않는다.
 */
export function createExchange(coach, item) {
  const pid = coach.present(itemMetadata(item)); let closed = false, delivered = false;
  const safe = (fn) => { try { return fn(); } catch { return null; } };
  return {
    pid,
    heard(ok) { if (closed || delivered) return null; delivered = true; return safe(() => coach.delivery(pid, { audio: ok ? 'completed' : 'failed' })); },
    help(kind) { if (closed) return null; return safe(() => coach.help(pid, kind)); },
    confirm(choice) {
      if (closed) return null;
      if (!item.options.includes(choice)) throw new Error('보기에서 대답을 골라 주세요.');
      closed = true;
      return safe(() => coach.answer(pid, answerPayload(choice === item.answer)));
    },
    cancel() { if (closed) return null; closed = true; return safe(() => coach.answer(pid, missedPayload())); },
  };
}

/* 순간 맞춤(Core flow.js): 공이 오는 시간만 이 사람에 맞춘다. 몽글의 말·대답·정답과 듣기 기록은 그대로다(빈칸 베기 FLOW_SLICE와 같은 방식).
 * 값은 쉬운 것(공이 천천히 옴 = ‘빠르게!’를 받을 시간이 김)부터, 처음은 원래 게임(1배). 맞는 칸으로 받아치면 성공(공이 날기 시작한 뒤
 * 고르기까지 쓴 시간의 비율이 압박, 몽글이 말하는 중에 고르면 0, 공이 기다린 뒤에 고르면 1보다 큼), 다른 칸이면 실수다. 공은 기다려 주므로
 * 시간 부족(timeout)은 없다. 다시 듣기·글로 보기를 쓴 답은 도움으로 넘겨 빨라지지 않게 한다. 받아치기는 듣기 근거가 아니다(createExchange가 맡는다). */
export const FLOW_RALLY = { id: 'talk-rally.flight', version: 1, target: 0.8, knobs: [
  { id: 'flight', kind: 'pace', label: '공이 오는 시간', values: [1.3, 1.2, 1.1, 1, 0.95, 0.9], start: 3 }] };
export const FLOW_WORDS = { 'raise.pace': '공이 조금 빨라져요.', 'ease.pace': '공이 조금 천천히 와요.', 'start.memory': '', 'start.prior': '',
  'start.tired': '오늘은 공이 빨라지지 않아요.', 'start.returning': '오랜만이라 공을 천천히 쳐요.' };
/** 한 번 주고받은 결과를 순간 맞춤의 관측으로. used: 공이 오는 시간 중 고르기까지 쓴 비율(기다린 뒤면 1보다 큼). choice가 null이면 놓침(만일의 길). */
export function rallyObservation({ choice, answer, used = null, assisted = false }) {
  if (choice == null) return { outcome: 'timeout' };
  const pressure = Number.isFinite(used) ? Math.min(1.5, Math.max(0, used)) : null;
  return { outcome: choice === answer ? 'success' : 'fail', pressure, assisted: !!assisted };
}

const STATUS = {
  unseen: { text: '아직 기록이 적어요', tone: 'quiet' },
  checking: { text: '확인하는 중이에요', tone: 'quiet' },
  practice: { text: '조금 더 연습하면 좋아요', tone: 'focus' },
  supported: { text: '도움과 함께 해냈어요', tone: 'quiet' },
  'recent-independent': { text: '최근 혼자 해냈어요', tone: 'good' },
  review: { text: '다시 볼 때예요', tone: 'focus' },
};
const PRIORITY = { practice: 6, review: 5, supported: 4, checking: 3, unseen: 2, 'recent-independent': 1 };
const LEVEL_LABEL = { 1: '쉬운 말', 2: '조금 어려운 말' };
const LEVELS = Object.fromEntries(Object.keys(SKILL_LABEL).map((id) =>
  [id, [...new Set(ITEMS.filter((x) => x.skill === id).map((x) => x.difficulty))].sort((a, b) => a - b)]));

/** 공통 기록 요약에서 이 게임의 두 학습 항목 상태(같은 형식·듣기 기록만). 빈칸 베기와 같은 방식. */
export function skillReport(summary, { focusSkillId = null } = {}) {
  if (!summary?.skills) return [];
  return Object.keys(SKILL_LABEL).map((id) => {
    const s = summary.skills.find((x) => x.id === id);
    const levels = LEVELS[id].map((d) => {
      const f = s?.levels?.[d]?.formats?.[FORMAT];
      const status = f && (f.lastAt || f.assisted) && STATUS[f.status] ? f.status : 'unseen';
      return { d, status, n: f?.n || 0, correct: f?.correct || 0 };
    });
    const seen = levels.filter((l) => l.status !== 'unseen');
    const status = [...seen].sort((a, b) => (PRIORITY[b.status] || 0) - (PRIORITY[a.status] || 0))[0]?.status || 'unseen';
    const same = levels.every((l) => l.status === levels[0].status);
    const text = same ? STATUS[levels[0].status].text
      : levels.map((l) => `${LEVEL_LABEL[l.d] || `난도 ${l.d}`}: ${STATUS[l.status].text}`).join(' · ');
    const own = STATUS[status].tone;
    const tone = !focusSkillId ? own : id === focusSkillId ? 'focus' : own === 'focus' ? 'quiet' : own;
    return { id, label: SKILL_LABEL[id], status, text, tone, levels,
      n: seen.reduce((sum, l) => sum + l.n, 0), correct: seen.reduce((sum, l) => sum + l.correct, 0) };
  });
}
