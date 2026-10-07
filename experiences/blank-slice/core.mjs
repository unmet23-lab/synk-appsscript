// 빈칸 베기 — 판정·한 판 구성·점수·시간·배치·베기 판정(순수 함수, 화면 없음).
import { ITEMS, SKILL_LABEL, ROUND_SIZE } from './content.mjs';

export const BLANK = '{}';
export const parts = (text) => { const i = text.indexOf(BLANK); return [text.slice(0, i), text.slice(i + BLANK.length)]; };
export const filled = (item, word) => item.text.replace(BLANK, word);
export const judge = (item, word) => ({ correct: word === item.answer });
/** 받침에 맞는 조사: 끝 글자에 받침이 있으면 앞의 것, 없으면 뒤의 것(가방은·우유는, 가방이에요·우유예요). */
export const josa = (word, withBatchim, without) => { const c = String(word).charCodeAt(String(word).length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? withBatchim : without; };

/** 시험용 결정적 난수(xorshift). */
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function shuffled(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * 한 판(기본 12문장) 고르기.
 * - 아틀라스 필요 순서(ranked)를 앞에 두고 나머지는 원고 순서.
 * - 두 학습 항목(낱말·조사/문형)을 적어도 4문장씩 넣는다.
 * - 처음이면 난도 1부터 고른다.
 * - 고른 뒤에는 쉬운 것 → 어려운 것(같은 난도는 필요 순서 유지)으로 늘어놓는다.
 * - 아틀라스 순서가 없으면(기록을 못 쓰는 브라우저) seed(판 번호)로 섞어, 판마다 다른 문장이 나오게 한다.
 */
export function composeRound(items = ITEMS, { ranked = null, size = ROUND_SIZE, firstTime = false, seed = 0 } = {}) {
  const byId = new Map(items.map((x) => [x.id, x]));
  const base = !ranked?.length && !firstTime && seed ? shuffled(items, rng(seed * 7919)) : items;
  let order = [...(ranked || []).filter((id) => byId.has(id)), ...base.map((x) => x.id)]
    .filter((id, i, a) => a.indexOf(id) === i).map((id) => byId.get(id));
  if (firstTime) order = [...order.filter((x) => x.difficulty === 1), ...order.filter((x) => x.difficulty !== 1)];
  const n = Math.min(size, items.length);
  const minEach = Math.min(4, Math.floor(n / 3));
  const picked = [];
  for (const skill of Object.keys(SKILL_LABEL)) {
    for (const x of order.filter((y) => y.skill === skill).slice(0, minEach)) if (!picked.includes(x)) picked.push(x);
  }
  for (const x of order) { if (picked.length >= n) break; if (!picked.includes(x)) picked.push(x); }
  const rank = new Map(order.map((x, i) => [x.id, i]));
  return picked.slice(0, n).sort((a, b) => a.difficulty - b.difficulty || rank.get(a.id) - rank.get(b.id));
}

/** 점수: 맞히면 100, 연속이면 20씩 더(최대 +100). */
export const pointsFor = (combo) => 100 + 20 * Math.min(Math.max(combo - 1, 0), 5);

/** results: {itemId, skill, choice(null=놓침), correct(true/false/null), points} */
export function scoreRound(results) {
  const total = results.length;
  const correct = results.filter((r) => r.correct === true).length;
  const missed = results.filter((r) => r.correct === null).length;
  let run = 0, bestRun = 0;
  for (const r of results) { run = r.correct === true ? run + 1 : 0; bestRun = Math.max(bestRun, run); }
  const stars = total && correct === total ? 3 : correct >= total - 2 && total > 2 ? 2 : correct >= Math.ceil(total / 2) ? 1 : 0;
  const bySkill = {};
  for (const r of results) { const b = (bySkill[r.skill] ||= { correct: 0, total: 0 }); b.total += 1; if (r.correct === true) b.correct += 1; }
  const score = results.reduce((s, r) => s + (r.points || 0), 0);
  return { total, correct, missed, bestRun, stars, bySkill, score };
}

/** 조각이 떠 있는 시간(초). 연속으로 맞히면 조금씩 빨라진다(속도감). 천천히 모드는 1.4배. */
export function hangTime({ difficulty = 1, combo = 0, slow = false } = {}) {
  const base = difficulty >= 2 ? 3.3 : 3.6;
  const t = Math.max(2.6, base - 0.12 * Math.min(combo, 6));
  return Math.round((slow ? t * 1.4 : t) * 100) / 100;
}

/** 처음 던지기 전 문장을 읽는 시간(ms). 글자 수에 비례하고 2.6초를 넘지 않는다. */
export function readDelay(text, { slow = false } = {}) {
  const n = text.replace(/\s/g, '').replace(BLANK, '').length;
  const ms = Math.min(2600, 700 + 70 * n);
  return Math.round(slow ? ms * 1.4 : ms);
}

/**
 * 조각 4개 배치. x: 가로(-1~1, 화면 폭 비율), apex: 꼭대기(0~1, 던지는 띠의 높이 비율), delay: 던지는 시각(초).
 * 좁은 화면은 2열 × 위아래. 같은 열의 두 조각은 같은 순간·같은 체공 시간으로 던져 공중에서 늘 위아래로 떨어져 있다
 * (높이 = 꼭대기 × 같은 포물선 모양이라 겹치지 않는다).
 */
export function tossLayout(aspect) {
  if (aspect < 0.95) {
    return [
      { x: -0.5, apex: 0.95, delay: 0 }, { x: 0.5, apex: 0.95, delay: 0.1 },
      { x: -0.5, apex: 0.42, delay: 0 }, { x: 0.5, apex: 0.42, delay: 0.1 },
    ];
  }
  return [
    { x: -0.72, apex: 0.62, delay: 0 }, { x: -0.24, apex: 0.92, delay: 0.12 },
    { x: 0.24, apex: 0.92, delay: 0.24 }, { x: 0.72, apex: 0.62, delay: 0.36 },
  ];
}

/**
 * 그은 선분 a→b가 사각형 r{l,t,r,b}에 처음 닿는 위치(0~1). 안 닿으면 null(Liang–Barsky).
 * 한 번 그어 여러 조각을 지나도 먼저 닿은 조각 하나만 벤다.
 */
export function segmentEntry(a, b, r) {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy], q = [a.x - r.l, r.r - a.x, a.y - r.t, r.b - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return t0;
}

/** 원고 검사: 빈칸 하나, 보기 넷이 서로 다름, 정답 = 첫 보기, 학습 항목·난도·설명. */
export function validateItems(items = ITEMS) {
  const errors = [], ids = new Set();
  for (const x of items) {
    if (ids.has(x.id)) errors.push(`${x.id}: 같은 id`); ids.add(x.id);
    if (x.text.split(BLANK).length !== 2) errors.push(`${x.id}: 빈칸은 하나`);
    if (x.options.length !== 4 || new Set(x.options).size !== 4) errors.push(`${x.id}: 서로 다른 보기 넷`);
    if (x.options[0] !== x.answer) errors.push(`${x.id}: 정답은 첫 보기`);
    if (!SKILL_LABEL[x.skill]) errors.push(`${x.id}: 모르는 학습 항목 ${x.skill}`);
    if (![1, 2].includes(x.difficulty)) errors.push(`${x.id}: 난도 1·2`);
    if (!x.why) errors.push(`${x.id}: 설명 없음`);
  }
  return errors;
}
