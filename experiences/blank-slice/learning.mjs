// 게임은 원고와 판정을 맡고, 아틀라스는 공통 기록과 다음 연습의 선택을 맡는다.
// 문장 하나 = 읽기 문항 하나. 베기 점수와 별도로 정답 공개 전 정적 보기에서 답한다.
// 베기·놓침만으로는 읽기 기록을 만들지 않는다. 정적 확인을 닫은 경우도 오답이 아니다.
import { ITEMS, SKILL_LABEL } from './content.mjs';

export const GAME_ID = 'blank-slice';
export const FORMAT = 'single-choice';

// 조사·문형 문항이 쓰는 TOPIK I 문형(strata/topik-i.grammar.json). 정답과 빈칸 뒤 말을 보고 Strata의
// grammarOf(strata/topik-i-forms.js)가 고른 것이고, 시험이 둘이 같은지 본다(교원 검수 전 초안).
// 이음말(그래서·하지만·그리고)은 문형이 아니라 잇지 않는다. 낱말 문항도 잇지 않는다.
export const GRAMMAR = Object.freeze({ p01: 'G203', p02: 'G207', p03: 'G201', t01: 'G208', p04: 'G309', p05: 'G210', e01: 'G303',
  e02: 'G301', e03: 'G401', e04: 'G305', e05: 'G406', a01: 'G209', e06: 'G211', e07: 'G302', e08: 'G308', e09: 'G506', e10: 'G501', p06: 'G203' });

export function itemMetadata(item) {
  const key = `${GAME_ID}.${item.id}.v1`;
  return { id: `${GAME_ID}.${item.id}`, itemKey: key, familyKey: key, skillId: item.skill, difficulty: item.difficulty,
    modality: 'reading', responseFormat: FORMAT, audioRequired: false, confounded: false, conceptIds: GRAMMAR[item.id] ? [GRAMMAR[item.id]] : [] };
}

/** WORLD가 확정한 실제 문항만 출제한다. null은 기존 자유 플레이다. */
export function assignmentItems(target, items = ITEMS) {
  if (!target) return null;
  const selected = new Map();
  for (const required of target.items || []) {
    const item = items.find(x => {
      const m = itemMetadata(x);
      return m.itemKey === required.itemKey && m.familyKey === required.familyKey
        && m.skillId === required.skillId && m.difficulty === required.difficulty
        && m.modality === required.modality && m.responseFormat === required.responseFormat
        && m.skillId === target.skillId && m.difficulty === target.difficulty
        && m.modality === target.modality && m.responseFormat === target.responseFormat;
    });
    if (item) selected.set(required.familyKey, item);
  }
  return [...selected.values()];
}

export const assignmentLabel = target => target?.description || (target ? `${SKILL_LABEL[target.skillId] || '목표 읽기'} · 난도 ${target.difficulty} · 목표 ${target.requiredAttempts}문항` : '');

export function candidates(items) {
  return items.map((x) => {
    const m = itemMetadata(x);
    return { id: m.id, itemId: x.id, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality,
      responseFormat: m.responseFormat, itemKey: m.itemKey, conceptIds: m.conceptIds };
  });
}

/** 필요 순서. 아틀라스를 못 쓰면 null(원고 순서로 진행). */
export function rankItems(coach, items) {
  if (!coach) return null;
  try {
    const r = coach.recommend(candidates(items), { audioAvailable: true });
    if (r.status !== 'ready') return null;
    return { order: [r.selected, ...r.alternatives].map((x) => x.itemId), reason: r.reason, skillId: r.focusSkillId, state: r.state };
  } catch { return null; }
}

/** 시간 제한 없는 정적 확인의 답. 정답 공개 전이므로 독립 응답이 가능하다. */
export const answerPayload = (correct) => ({ correct, assessable: true });
/** 읽기 확인 없이 종료. */
export const missedPayload = () => ({ correct: null, assessable: false, reason: 'unanswered' });

/** 조작 결과를 받지 않는다. 읽기 선택 한 번만 기록하고 취소는 평가하지 않는다. */
export function createReadingConfirmation(coach, item) {
  const pid = coach.present(itemMetadata(item)); let closed = false;
  return {
    pid,
    confirm(choice) {
      if (closed) return null;
      if (!item.options.includes(choice)) throw new Error('보기에서 답을 골라 주세요.');
      const result = coach.answer(pid, answerPayload(choice === item.answer));
      closed = true; return result;
    },
    cancel() { if (closed) return null; closed = true; return coach.answer(pid, missedPayload()); },
  };
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
const LEVEL_LABEL = { 1: '쉬운 문장', 2: '조금 어려운 문장' };
// 학습 항목마다 이 게임의 문장에 실제로 있는 난도
const LEVELS = Object.fromEntries(Object.keys(SKILL_LABEL).map((id) =>
  [id, [...new Set(ITEMS.filter((x) => x.skill === id).map((x) => x.difficulty))].sort((a, b) => a - b)]));

/**
 * 공통 기록 요약에서 이 게임의 두 학습 항목 상태(같은 형식·읽기 기록만).
 * 난도마다 따로 말한다. 쉬운 문장은 혼자 해냈어도 조금 어려운 문장은 아직 기록이 적을 수 있다.
 * ‘다음 연습’(tone: focus)은 아틀라스가 다음 판에 고른 항목(focusSkillId)을 따른다.
 * 그래서 결과의 꼬리표와 다음 판 이유가 같은 말을 한다. focusSkillId가 없으면 상태의 우선순위로 정한다.
 */
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
