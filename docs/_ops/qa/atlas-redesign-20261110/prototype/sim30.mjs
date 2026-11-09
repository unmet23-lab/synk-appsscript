// 30일 가상 학습자 비교: 지금 엔진 · 고정 사다리(1·3·7·14·30일) · 새 두뇌 시제품.
// 장면: 낱말 60개, 낱말마다 문항 2개(네 보기 중 고르기), 하루 한 판 20문항, 30일.
// 가상 학습자의 「진짜 기억」은 새 두뇌와 다른 모형(낱말마다 반감기, 어렵게 떠올릴수록 크게 늘고 놓치면 줄어듦)으로 만든다.
// 이 숫자는 구현과 규칙을 견주는 자료다. 실제 학습 효과의 증거가 아니다.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemory, createLearner, choose, present, record, startSession } from './brain.mjs';
import { loadFsrs } from './fsrs-path.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.ATLAS_ROOT || path.resolve(here, '../../../../..');
const { map, GL, memoryStorage } = require(path.join(ROOT, 'docs/_ops/qa/atlas-fable-review-20261110/repro/core1/common.cjs'));
const memory = createMemory(loadFsrs());

const DAY = 86400000, T0 = Date.parse('2026-12-01T09:00:00Z');
const WORDS = 60, PER_DAY = 20, DAYS = 30, LEARNERS = Number(process.env.LEARNERS || 40), GUESS = 0.25;
const BASE = Number(process.env.BASE || 0.7); // 처음 만난 낱말의 반감기 중앙값(일). 0.7 = 하루 뒤 37%만 기억(빨리 잊음), 2 = 하루 뒤 71%(천천히 잊음)
const SKILL = 'ko.reading.vocabulary';
if (map.getNode(SKILL)?.kind !== 'skill') throw new Error(`${SKILL} 능력이 지도에 없다`);
const wordId = i => `ko.word.w${String(i + 1).padStart(4, '0')}`;
if (!map.getNode(wordId(0))) throw new Error('낱말 마디가 지도에 없다');
const items = Array.from({ length: WORDS }, (_, w) => [0, 1].map(v => ({
  id: `sim.w${w}.v${v}`, itemKey: `sim.w${w}.v${v}`, familyKey: `sim.w${w}.v${v}`, word: w, order: w,
  skillId: SKILL, skillIds: [SKILL], modality: 'reading', difficulty: 1, responseFormat: 'single-choice', audioRequired: false,
  conceptIds: [wordId(w)], kcIds: [wordId(w)],
}))).flat();

const rng = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const normal = random => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

// 가상 학습자의 진짜 기억.
function createTruth(seed) {
  const random = rng(seed), speed = Math.exp(0.35 * normal(random)); // 사람마다 다른 속도
  const words = Array.from({ length: WORDS }, () => ({ h: null, last: null, base: BASE * speed * Math.exp(0.6 * normal(random)) })); // 낱말마다 다른 첫 반감기(일)
  const recall = (w, now) => (words[w].h == null ? 0 : Math.pow(2, -((now - words[w].last) / DAY) / words[w].h));
  return {
    recall,
    // 문항 하나를 만난다: 떠올리면 맞고, 못 떠올리면 찍는다. 정답을 확인하므로 만난 뒤에는 다시 배운 상태가 된다.
    meet(w, now) {
      const word = words[w], p = recall(w, now), remembered = random() < p, correct = remembered || random() < GUESS;
      if (word.h == null) word.h = word.base;
      else if (remembered) word.h = Math.min(180, word.h * (1 + 3 * (1 - p)) + 0.05);
      else word.h = Math.max(word.base * 0.8, word.h * 0.4);
      word.last = now;
      return { correct, p };
    },
    known: now => words.reduce((sum, _, w) => sum + recall(w, now), 0),
    met: () => words.filter(word => word.h != null).length,
  };
}

const policies = {
  // 새 두뇌 시제품
  brain() {
    const learner = createLearner();
    return { start: () => startSession(learner), next: now => { const row = choose(items, learner, memory, now)[0]; present(learner, row); return row.item; },
      answer: (item, correct, now) => record(learner, memory, item, { correct, assessable: true }, now) };
  },
  // 고정 사다리(생활 한국어의 지금 방식): 맞히면 1·3·7·14·30일 뒤, 틀리면 문항 둘 뒤 다시 · 처음 칸부터
  ladder() {
    const STEPS = [1, 3, 7, 14, 30], state = new Map(); let queue = [], count = 0, nextNew = 0, variant = new Map();
    const pick = w => { const v = (variant.get(w) || 0) % 2; variant.set(w, v + 1); return items[w * 2 + v]; };
    return { start: () => { queue = []; count = 0; },
      next(now) {
        count += 1;
        const retry = queue.find(row => count - row.at >= 2);
        if (retry) { queue = queue.filter(row => row !== retry); return pick(retry.w); }
        const due = [...state].filter(([, s]) => s.due <= now).sort((a, b) => a[1].due - b[1].due)[0];
        if (due) return pick(due[0]);
        if (nextNew < WORDS) { nextNew += 1; return pick(nextNew - 1); }
        return pick([...state].sort((a, b) => a[1].due - b[1].due)[0][0]); // 할 것이 없으면 가장 먼저 돌아올 낱말
      },
      answer(item, correct, now) {
        const s = state.get(item.word) || { step: -1, due: 0 };
        if (correct) { s.step = Math.min(STEPS.length - 1, s.step + 1); s.due = now + STEPS[s.step] * DAY; }
        else { s.step = -1; s.due = now + DAY; queue.push({ w: item.word, at: count }); }
        state.set(item.word, s);
      } };
  },
  // 지금 엔진(atlas/game-learning.js의 코치 그대로)
  current() {
    const clock = { now: T0 };
    const coach = GL.createGame({ gameId: 'sim30', map, storage: memoryStorage(), clock: () => new Date(clock.now).toISOString() });
    let pid = null;
    return { start() {}, next(now) { clock.now = now; const item = coach.recommend(items, { audioAvailable: true }).selected; pid = coach.present(item); return item; },
      answer(item, correct, now) { clock.now = now + 5000; coach.answer(pid, { correct, assessable: true }); } };
  },
};

function runOne(name, seed) {
  const truth = createTruth(seed), policy = policies[name]();
  const out = { marks: {}, easy: 0, lost: 0, total: 0 };
  for (let day = 0; day < DAYS; day += 1) {
    let now = T0 + day * DAY; policy.start();
    for (let i = 0; i < PER_DAY; i += 1) {
      const item = policy.next(now), { correct, p } = truth.meet(item.word, now + 5000);
      if (p > 0.95) out.easy += 1; else if (p > 0 && p < 0.5) out.lost += 1;
      out.total += 1; policy.answer(item, correct, now); now += 20000;
    }
    if ([6, 13, 29].includes(day)) out.marks[day + 1] = { known: truth.known(T0 + (day + 1) * DAY), met: truth.met() };
  }
  out.week = truth.known(T0 + (DAYS + 7) * DAY); // 30일 뒤 일주일을 쉬고 물으면
  return out;
}

const names = (process.env.POLICIES || 'current,ladder,brain').split(',');
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
console.log(`낱말 ${WORDS}개 · 하루 ${PER_DAY}문항 · ${DAYS}일 · 가상 학습자 ${LEARNERS}명 평균 · 첫 반감기 중앙값 ${BASE}일`);
console.log('방식        | 7일째 아는 낱말 | 14일째 | 30일째 | 일주일 쉰 뒤 | 만난 낱말 | 이미 또렷한데 또 물음 | 잊은 뒤에야 물음');
for (const name of names) {
  const runs = Array.from({ length: LEARNERS }, (_, i) => runOne(name, 1000 + i));
  const cell = day => mean(runs.map(r => r.marks[day].known)).toFixed(1);
  console.log(`${name.padEnd(11)} | ${cell(7).padStart(15)} | ${cell(14).padStart(6)} | ${cell(30).padStart(6)} | ${mean(runs.map(r => r.week)).toFixed(1).padStart(12)} | ${mean(runs.map(r => r.marks[30].met)).toFixed(1).padStart(9)} | ${(100 * mean(runs.map(r => r.easy / r.total))).toFixed(0).padStart(20)}% | ${(100 * mean(runs.map(r => r.lost / r.total))).toFixed(0).padStart(15)}%`);
}
