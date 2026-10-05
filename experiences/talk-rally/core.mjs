// 말 랠리 — 한 판 구성·점수·공 속도·긋기 방향 판정·원고 검사(순수 함수, 화면 없음).
import { ITEMS, SKILL_LABEL, ROUND_SIZE } from './content.mjs';

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
 * 한 판(기본 12번 주고받기) 고르기 — 빈칸 베기와 같은 규칙.
 * 아틀라스 필요 순서(ranked)를 앞에, 두 학습 항목을 적어도 4개씩, 처음이면 난도 1부터, 고른 뒤 쉬운 것부터.
 * 아틀라스 순서가 없으면 seed(판 번호)로 섞어 판마다 다른 말이 나오게 한다.
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

/** 맞게 받아치면 100점, 랠리가 이어질수록 20점씩 더(최대 +100). 세 번 연속마다 스매시(+50). 공이 라켓에 닿기 전에 고르면 ‘빠르게!’(+50). */
export const QUICK_BONUS = 50;
export const isSmash = (streak) => streak > 0 && streak % 3 === 0;
export const pointsFor = (streak, { quick = false } = {}) => 100 + 20 * Math.min(Math.max(streak - 1, 0), 5) + (isSmash(streak) ? 50 : 0) + (quick ? QUICK_BONUS : 0);

/** results: {itemId, skill, choice, correct(true/false, 예전 기록의 놓침은 null), points, quick(공이 닿기 전에 고름), helped(다시 듣기·글로 보기)} */
export function scoreRound(results) {
  const total = results.length;
  const correct = results.filter((r) => r.correct === true).length;
  const missed = results.filter((r) => r.correct === null).length;
  let run = 0, bestRally = 0;
  for (const r of results) { run = r.correct === true ? run + 1 : 0; bestRally = Math.max(bestRally, run); }
  const stars = total && correct === total ? 3 : correct >= total - 2 && total > 2 ? 2 : correct >= Math.ceil(total / 2) ? 1 : 0;
  const bySkill = {};
  for (const r of results) { const b = (bySkill[r.skill] ||= { correct: 0, total: 0 }); b.total += 1; if (r.correct === true) b.correct += 1; }
  const score = results.reduce((s, r) => s + (r.points || 0), 0);
  const quick = results.filter((r) => r.correct === true && r.quick).length, helped = results.filter((r) => r.helped).length;
  return { total, correct, missed, bestRally, stars, bySkill, score, quick, helped };
}

/**
 * 몽글이 친 공이 내 라켓까지 오는 시간(초). 공은 고를 때까지 라켓 앞에서 기다려 주므로(10-03 「공이 기다려 줘요」) 이 시간은 실패의 기한이 아니라
 * ‘빠르게!’ 보너스를 받을 수 있는 시간이다(대답 카드는 몽글이 말을 시작할 때 나온다). 랠리가 이어질수록 조금씩 빨라진다(속도감).
 * 조금 어려운 말은 조금 더 오래, 천천히 모드는 1.4배. 처음 판은 2.4초에서 1.5초까지 줄어 배우는 사람에게 너무 빨랐다(10-03 유호님).
 */
export function flightTime({ rally = 0, difficulty = 1, slow = false } = {}) {
  const base = difficulty >= 2 ? 3.0 : 2.8;
  const t = Math.max(2.0, base - 0.1 * Math.min(rally, 8));
  return Math.round((slow ? t * 1.4 : t) * 100) / 100;
}

/**
 * 위로 그은 방향 → 카드 자리(0 왼쪽 · 1 가운데 · 2 오른쪽). 아래로 긋거나 너무 짧으면 null.
 * dx·dy는 화면 픽셀(아래가 +). 위쪽 기준으로 ±22°는 가운데, 그보다 왼쪽·오른쪽으로 기울면 그쪽.
 */
export function swipeLane(dx, dy, { minPx = 36 } = {}) {
  if (Math.hypot(dx, dy) < minPx || dy > -minPx * 0.5) return null;
  const deg = Math.atan2(dx, -dy) * 180 / Math.PI;   // 0 = 바로 위, − 왼쪽, + 오른쪽
  return deg < -22 ? 0 : deg > 22 ? 2 : 1;
}

/** 원고 검사: id·보기 셋이 서로 다름·정답 = 첫 보기·학습 항목·난도·설명·음성 파일 이름. */
export function validateItems(items = ITEMS) {
  const errors = [], ids = new Set();
  for (const x of items) {
    if (ids.has(x.id)) errors.push(`${x.id}: 같은 id`); ids.add(x.id);
    if (!x.line || !/[?.!]$/.test(x.line)) errors.push(`${x.id}: 몽글의 말은 문장 부호로 끝난다`);
    if (x.options.length !== 3 || new Set(x.options).size !== 3) errors.push(`${x.id}: 서로 다른 대답 셋`);
    if (x.options[0] !== x.answer) errors.push(`${x.id}: 정답은 첫 보기`);
    if (!SKILL_LABEL[x.skill]) errors.push(`${x.id}: 모르는 학습 항목 ${x.skill}`);
    if (![1, 2].includes(x.difficulty)) errors.push(`${x.id}: 난도 1·2`);
    if (!x.why) errors.push(`${x.id}: 설명 없음`);
    if (x.voice !== `assets/voice/${x.id}.mp3`) errors.push(`${x.id}: 음성 파일 이름`);
  }
  return errors;
}
