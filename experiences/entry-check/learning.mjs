// 게임은 원고와 판정을 맡고, 아틀라스는 공통 기록과 다음 연습의 선택을 맡는다.
// 손님 한 명 = 읽기 문항 하나. 통과 또는 규칙 하나를 고르는 응답이라 형식은 single-choice다(보기 = 통과 + 규칙 3~4개).
import { VENUES } from './content.mjs';
import { SKILL_LABEL } from './content.mjs';

export const GAME_ID = 'entry-check';
export const FORMAT = 'single-choice';

// 순간 맞춤(Core flow.js, 아틀라스_순간맞춤 §5): 돋보기가 스스로 나오는 때만 이 사람에 맞춘다.
// 규칙·손님·정답은 그대로다. 도움이 많은 쪽이 앞이고, 처음 값은 지금 방식(누르면 나옴)이다.
// 막히면 엔진이 더 일찍 보여 주고, 늦추는 것은 물어보고 받아들일 때만 한다. 입구에서 고른 도움 방식이 있으면 그대로 따른다.
export const FLOW_ENTRY = { id: 'entry-check.magnifier', version: 1, target: 0.8, knobs: [
  { id: 'magnifier', kind: 'support', label: '돋보기 도움', values: ['바로', '머뭇거리면', '누르면'], start: 2 }] };
// 첫 돋보기가 스스로 나오는 때(ms). null은 눌렀을 때만. 'stuck'은 그 사람이 머뭇거린다고 볼 때.
export const MAGNIFIER_AFTER = { 바로: 0, 머뭇거리면: 'stuck', 누르면: null };
// '머뭇거리면'은 모두에게 같은 시계가 아니다. 이 사람이 돋보기 없이 바르게 도장을 찍어 온 시간에 맞춘다
// (Vellum stuckFor: 그런 응답 다섯 번 뒤부터 그 시간의 가운데 값 × 2.5, 8~90초. 그 전에는 엔진 기본 40초).
// 게임이 따로 짧은 시계를 정하면 천천히 꼼꼼히 읽는 사람이 매번 끊겨, 혼자 푼 기록이 쌓이지 않는다.
// 돋보기 단추는 언제든 누를 수 있다.
export function magnifierAfter(flow) {
  if (!flow) return null;
  const after = MAGNIFIER_AFTER[flow.settings().values.magnifier];
  return after === 'stuck' ? flow.stuck().afterMs : after;
}
// 지난번에 이어 가는 근무는 따로 말하지 않는다. 피곤한 날·오랜만인 날은 엔진의 기본 문장 한 줄로 알린다.
export const FLOW_WORDS = { 'ease.support': '다음 손님부터는 돋보기를 조금 더 일찍 보여 줄게요.',
  'accepted-less-help': '말한 대로 돋보기를 조금 늦게 보여 줄게요.', 'start.memory': '', 'start.prior': '' };

// 규칙 문장이 쓰는 TOPIK I 문형(strata/topik-i.grammar.json). 문장을 Strata의 grammarIn
// (strata/topik-i-forms.js)이 읽은 것이고, 시험이 둘이 같은지 본다(교원 검수 전 초안).
// 손님 문항은 판단 근거가 되는 규칙(evidence)들의 문형을 쓴다.
export const RULE_GRAMMAR = Object.freeze({
  'pool.cap': ['G403'], 'pool.food': ['G402'], 'pool.kid': ['G212', 'G403'],
  'library.card': ['G402'], 'library.food': ['G402', 'G401'], 'library.time': ['G212', 'S104', 'G402'],
  'museum.time': ['G212', 'S105', 'S107', 'G402'], 'museum.camera': ['G402'], 'museum.fee': ['G212', 'S107', 'G402'],
  'concert.date': ['G212', 'G402'], 'concert.chair': ['G505', 'G402'], 'concert.kid': ['G212', 'G403'], 'concert.food': ['S104', 'G402'] });
const CASE_GRAMMAR = new Map(VENUES.flatMap((v) => v.cases.map((c) => [c.id, [...new Set(c.evidence.flatMap((r) => RULE_GRAMMAR[`${v.id}.${r}`] || []))]])));

// 손님의 서류·짐·말·정답을 바꾸면 그 손님의 판을 올린다(학습기준 §7-2 문항 내용 판). 계열(familyKey)은 v1 그대로 두어
// 예전 판을 이미 본 사람에게는 새 문항이 아니라 반복으로 남는다. 해설·난도만 고치면 판은 그대로다. 바꾸고 판을 안 올리면 learning.test.mjs가 잡는다.
// 2026-10-21: 문항 검수 판정대로 고친 둘이 2판 — concert-12(손님 말이 안내문 근거를 먼저 알려 주지 않게), pool-14(손님을 이름이 흔한 등장인물로).
// 같은 날 재검수: concert-12는 9일 표를 들여보내는 내용이 바뀐 날짜(부정·변경)를 읽는 concert-10과 같아, 짝 concert-03처럼 날짜가 다른
// 표를 가진 손님(세부, 「표 날짜와 안내문의 허용 날짜 대조」)으로 다시 써서 3판.
export const ITEM_VERSION = Object.freeze({ 'concert-12': 3, 'pool-14': 2 });
// 학습 기록의 언어 난도(Core 칸, 작성 기준 §3)는 손님 모두 2다. 어느 손님이든 안내문 세 줄 이상(2단계 문형 -아/어야 하다·-(으)ㄹ 수 없다·
// -(으)면, 바뀐 날짜·나이 조건)을 손님의 서류·짐·말과 함께 대조하는 글이기 때문이다(2026-10-21 문항 검수 판정, 결정 표 같은 날 판단).
// 원고의 difficulty는 게임 안 단계로, 첫 근무에 넣을 쉬운 통과 손님(core.mjs composeShift)을 고를 때만 쓴다. 모두 같은 칸이라
// 다시 확인 손님은 예전처럼 같은 학습 항목의 손님과 짝이 된다(correction.mjs sameMeasure).
export const LANGUAGE_DIFFICULTY = 2;
export function caseMetadata(c) {
  const family = `${GAME_ID}.${c.id}.v1`, key = `${GAME_ID}.${c.id}.v${ITEM_VERSION[c.id] || 1}`;
  return { id: `${GAME_ID}.${c.id}`, itemKey: key, familyKey: family, skillId: c.skill, difficulty: LANGUAGE_DIFFICULTY,
    modality: 'reading', responseFormat: FORMAT, audioRequired: false, confounded: false, conceptIds: [...(CASE_GRAMMAR.get(c.id) || [])] };
}
export function assignmentCases(cases,target){
  if(!target)return cases;
  return cases.filter(c=>{const m=caseMetadata(c);return m.skillId===target.skillId&&m.difficulty===target.difficulty&&m.modality===target.modality&&m.responseFormat===target.responseFormat&&target.familyKeys?.includes(m.familyKey)&&(!target.itemKeys?.length||target.itemKeys.includes(m.itemKey));});
}
export function assignmentVenues(target,seen=[]){
  if(!target)return [];
  return VENUES.filter(v=>assignmentCases(v.cases,target).length).sort((a,b)=>assignmentCases(b.cases,target).filter(c=>!seen.includes(c.id)).length-assignmentCases(a.cases,target).filter(c=>!seen.includes(c.id)).length);
}
export function entryTargetLabel(target){return `이번 목표: 읽기 · ${SKILL_LABEL[target.skillId]||'과제 표현'} · 난도 ${target.difficulty}. 과제로 받은 손님 ${target.requiredAttempts}명을 확인해요.`;}

export function caseCandidates(cases) {
  return cases.map((c) => {
    const m = caseMetadata(c);
    return { id: m.id, caseId: c.id, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality,
      responseFormat: m.responseFormat, itemKey: m.itemKey, familyKey: m.familyKey, conceptIds: m.conceptIds };
  });
}

/** 자유 근무의 기본 손님 필요 순서. 확인용은 오답 뒤 또는 명시된 WORLD 과제에서만 쓴다. */
export function rankCases(coach, cases) {
  if (!coach) return null;
  const baseCases = cases.filter(c => !c.followupOnly);
  if (!baseCases.length) return null;
  try {
    const r = coach.recommend(caseCandidates(baseCases), { audioAvailable: true });
    if (r.status !== 'ready') return null;
    return { order: [r.selected, ...r.alternatives].map((x) => x.caseId), reason: r.reason, skillId: r.focusSkillId, state: r.state };
  } catch { return null; }
}

/**
 * 열린 근무지 전체에서 지금 가장 필요한 학습 항목을 받고, 그 항목의 손님이 가장 많은 근무지를 고른다.
 * 같으면 아틀라스가 1순위로 고른 손님의 근무지, 그다음 앞 일차. 이유 문구는 아틀라스(Vellum)의 것이다.
 */
export function recommendVenue(coach, venueIds) {
  const venues = VENUES.filter((v) => venueIds.includes(v.id));
  if (!coach || !venues.length) return null;
  try {
    const cands = venues.flatMap((v) => caseCandidates(v.cases.filter(c => !c.followupOnly)).map((c) => ({ ...c, venueId: v.id })));
    const r = coach.recommend(cands, { audioAvailable: true });
    if (r.status !== 'ready') return null;
    const skill = r.focusSkillId || r.selected.skillIds[0];
    const count = (v) => v.cases.filter((c) => !c.followupOnly && c.skill === skill).length;
    const best = [...venues].sort((a, b) => count(b) - count(a) || (b.id === r.selected.venueId) - (a.id === r.selected.venueId) || a.day - b.day)[0];
    return { venueId: best.id, reason: r.reason, skillId: skill, state: r.state, count: count(best) };
  } catch { return null; }
}

/** 도장(응답)을 아틀라스 답안으로. 안내문은 늘 보이는 읽기 지문이라 도움으로 세지 않는다(레이싱 읽기 관례). */
export const answerPayload = (correct, choice) => ({ correct, assessable: true, ...(choice ? { choice: { selectedId: choice.selectedId, correctId: choice.correctId } } : {}) });

const STATUS = {
  unseen: { text: '아직 기록이 적어요', tone: 'quiet' },
  checking: { text: '확인하는 중이에요', tone: 'quiet' },
  practice: { text: '조금 더 연습하면 좋아요', tone: 'focus' },
  supported: { text: '도움과 함께 해냈어요', tone: 'quiet' },
  'recent-independent': { text: '최근 혼자 해냈어요', tone: 'good' },
  review: { text: '다시 볼 때예요', tone: 'focus' },
};
const PRIORITY = { practice: 6, review: 5, supported: 4, checking: 3, unseen: 2, 'recent-independent': 1 };

/**
 * 공통 기록 요약에서 이 게임이 연습하는 세 학습 항목의 상태를 뽑는다.
 * 같은 형식(single-choice)·읽기 기록만 본다. 다른 형식의 정답률을 섞지 않는다.
 */
export function skillReport(summary) {
  if (!summary?.skills) return [];
  return Object.keys(SKILL_LABEL).map((id) => {
    const s = summary.skills.find((x) => x.id === id);
    const buckets = s ? [1, 2, 3].map((d) => s.levels?.[d]?.formats?.[FORMAT]).filter((f) => f && (f.lastAt || f.assisted)) : [];
    const top = buckets.sort((a, b) => (PRIORITY[b.status] || 0) - (PRIORITY[a.status] || 0))[0];
    const status = top?.status || 'unseen';
    const n = buckets.reduce((sum, f) => sum + (f.n || 0), 0);
    const correct = buckets.reduce((sum, f) => sum + (f.correct || 0), 0);
    return { id, label: SKILL_LABEL[id], status, ...STATUS[status], n, correct };
  });
}
