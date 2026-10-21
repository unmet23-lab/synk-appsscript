// 게임은 원고와 판정을 맡고, 아틀라스는 공통 기록과 다음 연습의 선택을 맡는다(빈칸 베기와 같은 연결).
// 몽글의 말 하나 = 듣기 문항 하나(보기 셋 고르기, 음성 필요). 받아친 대답(고른 카드)이 그 말의 답이다.
// 음성을 끝까지 들려준 뒤에만 혼자 해낸 근거가 된다(delivery: completed). 소리를 꺼서 못 들었으면 그 답은 평가하지 않는다.
// 공은 고를 때까지 라켓 앞에서 기다려 준다(10-03 「공이 기다려 줘요」 — 시간이 지나 놓치는 일이 없다). 기다리는 동안 다시 듣기·글로 보기를 쓰면
// 도움으로 남는다. 그만두기로 닫은 문항은 평가하지 않는 응답이다.
import { ITEMS, SKILL_LABEL } from './content.mjs';

export const GAME_ID = 'talk-rally';
export const FORMAT = 'single-choice';

// 몽글의 말·대답 카드·정답을 바꾸면 그 말의 판을 올린다(학습기준 §7-2 문항 내용 판). 계열(familyKey)은 v1 그대로 두어 예전 판을 이미
// 들은 사람에게는 새 문항이 아니라 반복으로 남는다. 설명·난도만 고치면 판은 그대로다(learning.test.mjs가 지문을 본다).
// 2026-10-21: 문항 검수 판정대로 뜻이 어색한 오답 「아니요, 물이 커요」를 「아니요, 물이 있어요」로 바꾼 r01이 2판.
export const ITEM_VERSION = Object.freeze({ r01: 2 });
// 학습 기록의 언어 난도(Core 칸, 작성 기준 §3). 원고의 difficulty는 게임 안 단계(처음 판은 쉬운 말부터·공이 오는 시간·「조금 어려운 말」
// 표시·그날의 판 섞기)이고, 문항 검수가 한마디 인사·물음이라 1급 앞쪽(난도 1)으로 본 열다섯은 학습 기록에 1로 남긴다(2026-10-21 판정,
// 결정 표 같은 날 판단). 단계 2에서 난도 2로 남는 말은 「-아/어 보다」를 묻는 r08이다.
export const LANGUAGE_DIFFICULTY = Object.freeze({ r07: 1, r09: 1, w06: 1, w08: 1, w09: 1, w10: 1, w11: 1,
  f06: 1, f11: 1, f12: 1, f13: 1, f14: 1, f15: 1, f16: 1, f18: 1 });
export function itemMetadata(item) {
  const family = `${GAME_ID}.${item.id}.v1`, key = `${GAME_ID}.${item.id}.v${ITEM_VERSION[item.id] || 1}`;
  return { id: `${GAME_ID}.${item.id}`, itemKey: key, familyKey: family, skillId: item.skill, difficulty: LANGUAGE_DIFFICULTY[item.id] ?? item.difficulty,
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

/** 공통 기록 요약에서 이 게임의 학습 항목 상태(같은 형식·듣기 기록만, 10-21부터 듣고 알맞게 대답하기 하나). 빈칸 베기와 같은 방식. */
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
