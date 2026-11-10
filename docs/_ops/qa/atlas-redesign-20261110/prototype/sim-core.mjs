// 가상 학습자 비교의 공통 부품: 가상 학습자의 「진짜 기억」, 견줄 방식 셋(지금 엔진 · 고정 사다리 · 새 두뇌), 하루 일정 돌리기.
// 장면: 낱말 60개, 낱말마다 문항 2개(네 보기 중 고르기). 가상 학습자의 진짜 기억은 새 두뇌(FSRS)와 다른 모형으로 만든다 —
// 낱말마다 반감기가 있고, 어렵게 떠올릴수록 크게 늘고, 못 떠올리면 줄어든다. 못 떠올리면 넷 중 하나를 찍는다.
// 이 숫자는 규칙을 견주는 자료다. 실제 학습 효과의 증거가 아니다.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARAMS, createMemory, createLearner, choose, present, record, startSession } from './brain.mjs';
import { loadFsrs } from './fsrs-path.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.ATLAS_ROOT || path.resolve(here, '../../../../..');
const tsfsrs = loadFsrs();

export const DAY = 86400000, T0 = Date.parse('2026-12-01T09:00:00Z');
export const WORDS = 60, GUESS = 0.25, SKILL = 'ko.reading.vocabulary';
const wordId = i => `ko.word.w${String(i + 1).padStart(4, '0')}`;
export const items = Array.from({ length: WORDS }, (_, w) => [0, 1].map(v => ({
  id: `sim.w${w}.v${v}`, itemKey: `sim.w${w}.v${v}`, familyKey: `sim.w${w}.v${v}`, word: w, order: w,
  skillId: SKILL, skillIds: [SKILL], modality: 'reading', difficulty: 1, responseFormat: 'single-choice', audioRequired: false,
  conceptIds: [wordId(w)], kcIds: [wordId(w)],
}))).flat();

const rng = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const normal = random => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

// 가상 학습자의 진짜 기억. base = 처음 만난 낱말의 반감기 중앙값(일), slope = 어렵게 떠올릴수록 얼마나 크게 느는가,
// lapse = 못 떠올렸을 때 반감기에 곱하는 값, guessShrink = 찍어서 맞힌 답도 못 떠올린 것으로 칠 것인가(거짓이면 반감기를 그대로 둔다).
export function createTruth(seed, { base = 0.7, slope = 3, lapse = 0.4, guessShrink = true } = {}) {
  const random = rng(seed), speed = Math.exp(0.35 * normal(random)); // 사람마다 다른 속도
  const words = Array.from({ length: WORDS }, () => ({ h: null, last: null, base: base * speed * Math.exp(0.6 * normal(random)) })); // 낱말마다 다른 첫 반감기
  const recall = (w, now) => (words[w].h == null ? 0 : Math.pow(2, -((now - words[w].last) / DAY) / words[w].h));
  return {
    recall,
    // 문항 하나를 만난다: 떠올리면 맞고, 못 떠올리면 찍는다. 정답을 확인하므로 만난 뒤에는 다시 배운 상태가 된다.
    meet(w, now) {
      const word = words[w], p = recall(w, now), remembered = random() < p, correct = remembered || random() < GUESS;
      if (word.h == null) word.h = word.base;
      else if (remembered) word.h = Math.min(180, word.h * (1 + slope * (1 - p)) + 0.05);
      else if (!correct || guessShrink) word.h = Math.max(word.base * 0.8, word.h * lapse);
      word.last = now;
      return { correct, p };
    },
    known: now => words.reduce((sum, _, w) => sum + recall(w, now), 0),
    met: () => words.filter(word => word.h != null).length,
  };
}

let currentEngine = null;
const loadCurrent = () => (currentEngine ||= require(path.join(ROOT, 'docs/_ops/qa/atlas-fable-review-20261110/repro/core1/common.cjs')));

export const policies = {
  // 새 두뇌 시제품. params로 등급 대응(weakWeight) · 한도를 바꿔 견준다.
  brain({ params = PARAMS } = {}) {
    const memory = createMemory(tsfsrs, params), learner = createLearner();
    let shown = null;
    return { start: now => startSession(learner, now, params),
      next(now) { const row = choose(items, learner, memory, now, { params })[0]; if (row.none) return null; present(learner, row); shown = row; return row.item; }, // 낼 것이 없으면 판을 끝낸다
      answer: (item, correct, now) => record(learner, memory, item, { correct, assessable: true, target: shown.target }, now, params), learner };
  },
  // 고정 사다리(생활 한국어의 지금 방식): 맞히면 1 · 3 · 7 · 14 · 30일 뒤, 틀리면 처음 칸부터 · 1분 뒤 다시. 돌아온 것은 가장 오래 밀린 것부터.
  // 견주는 것이 「언제 다시」뿐이도록 나머지 규칙은 새 두뇌와 같게 둔다: 틀린 것은 다른 문항 둘 뒤에 다시 · 한 판에 두 번까지(다 쓰면 그 판에서는 더 내지 않고
  // 다음 판에 돌아온 것으로 온다), 새것은 같은 한 판 · 하루 한도, 할 것이 없으면 아는 것(이 판에서 안 만난 것 → 가장 오래 안 본 것)으로 채운다.
  // 채우느라 때가 되기 전에 낸 것을 맞혀도 칸을 올리지 않는다(같은 칸의 간격을 그때부터 다시 센다) — 새 두뇌의 「같은 자리」 규칙과 같은 뜻이다.
  // 낼 것이 하나도 없으면(다시를 다 쓴 낱말과 한도 밖 새 낱말만 남으면) 판을 끝낸다.
  // 두 갈래로 돌린다: ladder = 복습 먼저(돌아온 것이 남아 있으면 새것을 내지 않는다 — 지금 제품에 가깝다), ladderMix = 새 두뇌처럼 돌아온 것 셋에 새것 하나.
  ladderMix(options = {}) { return policies.ladder({ ...options, interleave: PARAMS.interleave }); },
  ladder({ newPerSession = PARAMS.newPerSession, newPerDay = PARAMS.newPerDay, retryMax = PARAMS.retryMax, interleave = Infinity } = {}) {
    const STEPS = [1, 3, 7, 14, 30], state = new Map(), variant = new Map(), shownAt = new Map();
    let queue = [], count = 0, nextNew = 0, fresh = 0, sinceNew = 0, tries = new Map(), met = new Set(), day = { key: null, fresh: 0 }, filler = false;
    const pick = w => { const v = (variant.get(w) || 0) % 2; variant.set(w, v + 1); return items[w * 2 + v]; };
    const held = w => queue.some(row => row.w === w) || (tries.get(w) ?? -1) >= retryMax; // 다시 낼 차례를 기다리거나 이 판의 재시도를 다 쓴 낱말
    const canNew = () => nextNew < WORDS && fresh < newPerSession && day.fresh < newPerDay;
    const takeNew = () => { nextNew += 1; fresh += 1; day.fresh += 1; sinceNew = 0; return pick(nextNew - 1); };
    return { start(now) { const key = Math.floor(now / DAY); if (day.key !== key) day = { key, fresh: 0 }; fresh = 0; sinceNew = 0; tries = new Map(); met = new Set(); queue = []; },
      next(now) {
        filler = false;
        const retry = queue.find(row => count - row.at >= 2);
        if (retry) { queue = queue.filter(row => row !== retry); return pick(retry.w); }
        const due = [...state].filter(([w, s]) => s.due <= now && !held(w)).sort((a, b) => a[1].due - b[1].due)[0];
        if (due && sinceNew >= interleave && canNew()) return takeNew();
        if (due) { sinceNew += 1; return pick(due[0]); }
        if (canNew()) return takeNew();
        filler = true;
        const soon = [...state].filter(([w]) => !held(w) && !met.has(w)).sort((a, b) => a[1].due - b[1].due)[0];
        if (soon) return pick(soon[0]);
        const any = [...state].filter(([w]) => !held(w)).sort((a, b) => (shownAt.get(a[0]) ?? 0) - (shownAt.get(b[0]) ?? 0))[0];
        if (any) return pick(any[0]);
        filler = false;
        if (queue.length) { const row = queue[0]; queue = queue.slice(1); return pick(row.w); } // 다시 낼 차례를 기다리는 것뿐이면 차례를 당겨 낸다
        return null;
      },
      answer(item, correct, now) {
        count += 1; met.add(item.word); shownAt.set(item.word, count);
        const s = state.get(item.word) || { step: -1, due: 0 };
        if (correct && filler && s.step >= 0) s.due = now + STEPS[s.step] * DAY; // 때가 되기 전에 채우기로 맞힌 것: 칸은 그대로, 간격만 다시 센다
        else if (correct) { s.step = Math.min(STEPS.length - 1, s.step + 1); s.due = now + STEPS[s.step] * DAY; }
        else {
          const tried = (tries.get(item.word) ?? -1) + 1; tries.set(item.word, tried);
          s.step = -1; s.due = now + 60000;
          if (tried < retryMax) queue.push({ w: item.word, at: count });
        }
        state.set(item.word, s);
      } };
  },
  // 지금 엔진(atlas/game-learning.js의 코치 그대로). 문항 번호는 사람마다 섞는다 — 지금 엔진은 동점을 문항 번호 순으로 가르므로,
  // 같은 낱말의 두 문항이 번호로 이웃하면 20초 간격으로 잇달아 내는 장면이 설정 탓에 생긴다.
  current({ seed = 1 } = {}) {
    const { map, GL, memoryStorage } = loadCurrent();
    if (map.getNode(SKILL)?.kind !== 'skill' || !map.getNode(wordId(0))) throw new Error('지도에 능력 · 낱말 마디가 없다');
    const random = rng(seed * 7919 + 13), order = items.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const shuffled = items.map((item, i) => { const id = `sim.q${String(order[i]).padStart(3, '0')}`; return { ...item, id, itemKey: id, familyKey: id }; });
    const clock = { now: T0 };
    const coach = GL.createGame({ gameId: 'sim30', map, storage: memoryStorage(), clock: () => new Date(clock.now).toISOString() });
    let pid = null;
    return { start() {}, next(now) { clock.now = now; const item = coach.recommend(shuffled, { audioAvailable: true }).selected; pid = coach.present(item); return item; },
      answer(item, correct, now) { clock.now = now + 5000; coach.answer(pid, { correct, assessable: true }); } };
  },
};

// 하루 일정대로 한 사람을 돌린다. sessions = [{ day, at(그날 안의 시각, ms), n }].
export function runOne(name, seed, { truth = {}, policy = {}, sessions, marks = [7, 14, 30], restDays = 7 } = {}) {
  const real = createTruth(seed, truth), agent = policies[name]({ ...policy, seed });
  const out = { marks: {}, easy: 0, lost: 0, total: 0, correct: 0, sessions: [] };
  const lastDay = Math.max(...sessions.map(s => s.day));
  for (const session of sessions) {
    let now = T0 + session.day * DAY + (session.at || 0), right = 0; const before = real.met(), startTotal = out.total;
    agent.start(now);
    for (let i = 0; i < session.n; i += 1) {
      const item = agent.next(now);
      if (!item) break; // 낼 것이 없으면 그 판은 거기서 끝난다
      const { correct, p } = real.meet(item.word, now + 5000);
      if (p > 0.95) out.easy += 1; else if (p > 0 && p < 0.5) out.lost += 1;
      out.total += 1; if (correct) { out.correct += 1; right += 1; }
      agent.answer(item, correct, now); now += 20000;
    }
    out.sessions.push({ day: session.day, success: right / Math.max(1, out.total - startTotal), fresh: real.met() - before });
    const isLastOfDay = !sessions.some(s => s.day === session.day && (s.at || 0) > (session.at || 0));
    if (isLastOfDay && marks.includes(session.day + 1)) out.marks[session.day + 1] = { known: real.known(T0 + (session.day + 1) * DAY), met: real.met() };
  }
  out.rest = real.known(T0 + (lastDay + 1 + restDays) * DAY); // 마지막 날 뒤 일주일을 쉬고 물으면
  out.met = real.met();
  return out;
}

export const daily = (days, n, skip = []) => Array.from({ length: days }, (_, day) => ({ day, n })).filter(s => !skip.includes(s.day));
export const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
export function runMany(name, options, learners = 40) {
  const runs = Array.from({ length: learners }, (_, i) => runOne(name, 1000 + i, options));
  const mark = day => mean(runs.map(r => r.marks[day]?.known ?? NaN));
  return { runs, known: mark, rest: mean(runs.map(r => r.rest)), met: mean(runs.map(r => r.met)), easy: mean(runs.map(r => r.easy / r.total)), lost: mean(runs.map(r => r.lost / r.total)), success: mean(runs.map(r => r.correct / r.total)) };
}
