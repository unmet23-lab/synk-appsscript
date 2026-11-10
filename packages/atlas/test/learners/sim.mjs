// 가상 학습자 묶음의 공통 부품(설계 §11 가상 학습자 관문 2~5 · 시제품 prototype/sim-core.mjs를 옮겼다 — 지금 엔진 비교는 뺐다).
// 장면: 낱말 60개, 낱말마다 문항 2개(넷 중 고르기). 가상 학습자의 진짜 기억은 새 두뇌(FSRS)와 다른 모형으로 만든다 —
// 낱말마다 반감기가 있고, 어렵게 떠올릴수록 크게 늘고, 못 떠올리면 줄어든다. 못 떠올리면 넷 중 하나를 찍는다.
// 견주는 방식은 셋이다: 새 두뇌(brain) · 고정 사다리 1·3·7·14·30일 두 갈래(ladder 복습 먼저 · ladderMix 셋에 하나 새것).
// 이 숫자는 규칙을 견주는 자료다. 실제 학습 효과의 증거가 아니다(설계 §3-8 「이 비교의 한계」).
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';

const brain = await subject();
export const { PARAMS } = brain;

export const DAY = 86_400_000;
export const T0 = Date.parse('2026-12-01T09:00:00Z');
export const WORDS = 60;
const GUESS = 0.25;
const SKILL = 'ko.reading.vocabulary';
const wordId = i => `ko.word.w${String(i + 1).padStart(4, '0')}`;
export const items = Array.from({ length: WORDS }, (_, w) =>
  [0, 1].map(v => ({
    itemKey: `sim.w${w}.v${v}`,
    familyKey: `sim.w${w}.v${v}`,
    word: w,
    order: w,
    skillId: SKILL,
    difficulty: 1,
    responseFormat: 'single-choice',
    units: [wordId(w)],
  })),
).flat();

const normal = random => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

// 가상 학습자의 진짜 기억. base = 처음 만난 낱말의 반감기 중앙값(일), slope = 어렵게 떠올릴수록 얼마나 크게 느는가,
// lapse = 못 떠올렸을 때 반감기에 곱하는 값, guessShrink = 찍어서 맞힌 답도 못 떠올린 것으로 칠 것인가(거짓이면 반감기를 그대로 둔다).
export function createTruth(seed, { base = 0.7, slope = 3, lapse = 0.4, guessShrink = true } = {}) {
  const random = rng(seed | 0);
  const speed = Math.exp(0.35 * normal(random)); // 사람마다 다른 속도
  // 낱말마다 다른 첫 반감기
  const words = Array.from({ length: WORDS }, () => ({
    h: null,
    last: null,
    base: base * speed * Math.exp(0.6 * normal(random)),
  }));
  const recall = (w, now) =>
    words[w].h == null ? 0 : 2 ** (-((now - words[w].last) / DAY) / words[w].h);
  return {
    recall,
    // 문항 하나를 만난다: 떠올리면 맞고, 못 떠올리면 찍는다. 정답을 확인하므로 만난 뒤에는 다시 배운 상태가 된다.
    meet(w, now) {
      const word = words[w];
      const p = recall(w, now);
      const remembered = random() < p;
      const correct = remembered || random() < GUESS;
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

// 새 두뇌. params로 등급 대응(weakWeight) · 한도를 바꿔 견준다. 낼 것이 없으면 판을 끝낸다.
function brainPolicy({ params = PARAMS } = {}) {
  const memory = brain.createMemory(params);
  const learner = brain.createLearner();
  let shown = null;
  return {
    learner,
    start: now => brain.startSession(learner, now, params),
    next(now) {
      const row = brain.choose(items, learner, memory, now, { params })[0];
      if (row.none) return null;
      brain.present(learner, row);
      shown = row;
      return row.item;
    },
    answer: (item, correct, now) =>
      brain.record(
        learner,
        memory,
        item,
        { correct, assessable: true, target: shown.target },
        now,
        params,
      ),
  };
}

// 고정 사다리(생활 한국어의 지금 방식): 맞히면 1 · 3 · 7 · 14 · 30일 뒤, 틀리면 처음 칸부터 · 1분 뒤 다시. 돌아온 것은 가장 오래 밀린 것부터.
// 견주는 것이 「언제 다시」뿐이도록 나머지 규칙은 새 두뇌와 같게 둔다: 틀린 것은 다른 문항 둘 뒤에 다시 · 한 판에 두 번까지,
// 새것은 같은 한 판 · 하루 한도, 할 것이 없으면 아는 것으로 채운다. 채우느라 때가 되기 전에 낸 것을 맞혀도 칸을 올리지 않는다.
// 두 갈래: ladder = 복습 먼저(돌아온 것이 남아 있으면 새것을 내지 않는다), ladderMix = 돌아온 것 셋에 새것 하나.
function ladderPolicy({
  newPerSession = PARAMS.newPerSession,
  newPerDay = PARAMS.newPerDay,
  retryMax = PARAMS.retryMax,
  interleave = Number.POSITIVE_INFINITY,
} = {}) {
  const STEPS = [1, 3, 7, 14, 30];
  const state = new Map();
  const variant = new Map();
  const shownAt = new Map();
  const ctx = {
    queue: [],
    count: 0,
    nextNew: 0,
    fresh: 0,
    sinceNew: 0,
    tries: new Map(),
    met: new Set(),
  };
  let day = { key: null, fresh: 0 };
  let filler = false;
  const pick = w => {
    const v = (variant.get(w) || 0) % 2;
    variant.set(w, v + 1);
    return items[w * 2 + v];
  };
  // 다시 낼 차례를 기다리거나 이 판의 재시도를 다 쓴 낱말
  const held = w => ctx.queue.some(row => row.w === w) || (ctx.tries.get(w) ?? -1) >= retryMax;
  const canNew = () => ctx.nextNew < WORDS && ctx.fresh < newPerSession && day.fresh < newPerDay;
  const takeNew = () => {
    ctx.nextNew += 1;
    ctx.fresh += 1;
    day.fresh += 1;
    ctx.sinceNew = 0;
    return pick(ctx.nextNew - 1);
  };
  const oldest = list => list.sort((a, b) => a[1].due - b[1].due)[0];
  function fill() {
    filler = true;
    const soon = oldest([...state].filter(([w]) => !held(w) && !ctx.met.has(w)));
    if (soon) return pick(soon[0]);
    const any = [...state]
      .filter(([w]) => !held(w))
      .sort((a, b) => (shownAt.get(a[0]) ?? 0) - (shownAt.get(b[0]) ?? 0))[0];
    if (any) return pick(any[0]);
    filler = false;
    if (!ctx.queue.length) return null;
    const row = ctx.queue[0]; // 다시 낼 차례를 기다리는 것뿐이면 차례를 당겨 낸다
    ctx.queue = ctx.queue.slice(1);
    return pick(row.w);
  }
  return {
    start(now) {
      const key = Math.floor(now / DAY);
      if (day.key !== key) day = { key, fresh: 0 };
      Object.assign(ctx, { fresh: 0, sinceNew: 0, tries: new Map(), met: new Set(), queue: [] });
    },
    next(now) {
      filler = false;
      const retry = ctx.queue.find(row => ctx.count - row.at >= 2);
      if (retry) {
        ctx.queue = ctx.queue.filter(row => row !== retry);
        return pick(retry.w);
      }
      const due = oldest([...state].filter(([w, s]) => s.due <= now && !held(w)));
      if (due && ctx.sinceNew >= interleave && canNew()) return takeNew();
      if (due) {
        ctx.sinceNew += 1;
        return pick(due[0]);
      }
      if (canNew()) return takeNew();
      return fill();
    },
    answer(item, correct, now) {
      ctx.count += 1;
      ctx.met.add(item.word);
      shownAt.set(item.word, ctx.count);
      const s = state.get(item.word) || { step: -1, due: 0 };
      if (correct && filler && s.step >= 0) s.due = now + STEPS[s.step] * DAY;
      else if (correct) {
        s.step = Math.min(STEPS.length - 1, s.step + 1);
        s.due = now + STEPS[s.step] * DAY;
      } else {
        const tried = (ctx.tries.get(item.word) ?? -1) + 1;
        ctx.tries.set(item.word, tried);
        s.step = -1;
        s.due = now + 60000;
        if (tried < retryMax) ctx.queue.push({ w: item.word, at: ctx.count });
      }
      state.set(item.word, s);
    },
  };
}

export const policies = {
  brain: brainPolicy,
  ladder: ladderPolicy,
  ladderMix: (options = {}) => ladderPolicy({ ...options, interleave: PARAMS.interleave }),
};

// 판 하나를 돌린다: 낼 것이 없으면 그 판은 거기서 끝난다. 그 판에서 맞힌 수를 돌려준다.
function runSession(real, agent, session, out) {
  let now = T0 + session.day * DAY + (session.at || 0);
  let right = 0;
  agent.start(now);
  for (let i = 0; i < session.n; i += 1) {
    const item = agent.next(now);
    if (!item) break;
    const { correct, p } = real.meet(item.word, now + 5000);
    if (p > 0.95) out.easy += 1;
    else if (p > 0 && p < 0.5) out.lost += 1;
    out.total += 1;
    out.correct += correct ? 1 : 0;
    right += correct ? 1 : 0;
    agent.answer(item, correct, now);
    now += 20000;
  }
  return right;
}

// 하루 일정대로 한 사람을 돌린다. sessions = [{ day, at(그날 안의 시각, ms), n }].
export function runOne(
  name,
  seed,
  { truth = {}, policy = {}, sessions, marks = [7, 14, 30], restDays = 7 } = {},
) {
  const real = createTruth(seed, truth);
  const agent = policies[name]({ ...policy, seed });
  const out = { marks: {}, easy: 0, lost: 0, total: 0, correct: 0, sessions: [], agent };
  const lastDay = Math.max(...sessions.map(s => s.day));
  for (const session of sessions) {
    const before = real.met();
    const startTotal = out.total;
    const right = runSession(real, agent, session, out);
    const shown = out.total - startTotal;
    out.sessions.push({
      day: session.day,
      success: right / Math.max(1, shown),
      shown,
      fresh: real.met() - before,
    });
    const isLastOfDay = !sessions.some(
      s => s.day === session.day && (s.at || 0) > (session.at || 0),
    );
    if (isLastOfDay && marks.includes(session.day + 1))
      out.marks[session.day + 1] = {
        known: real.known(T0 + (session.day + 1) * DAY),
        met: real.met(),
      };
  }
  out.rest = real.known(T0 + (lastDay + 1 + restDays) * DAY); // 마지막 날 뒤 일주일을 쉬고 물으면
  out.met = real.met();
  return out;
}

export const daily = (days, n, skip = []) =>
  Array.from({ length: days }, (_, day) => ({ day, n })).filter(s => !skip.includes(s.day));
export const mean = list => list.reduce((a, b) => a + b, 0) / list.length;

export function runMany(name, options, learners = 40) {
  const runs = Array.from({ length: learners }, (_, i) => runOne(name, 1000 + i, options));
  return {
    runs,
    known: day => mean(runs.map(r => r.marks[day]?.known ?? Number.NaN)),
    rest: mean(runs.map(r => r.rest)),
    met: mean(runs.map(r => r.met)),
    success: mean(runs.map(r => r.correct / r.total)),
    easy: mean(runs.map(r => r.easy / r.total)), // 또렷한데(떠올릴 확률 0.95 넘게) 또 물은 몫
    lost: mean(runs.map(r => r.lost / r.total)), // 잊은 뒤에야(0.5 아래) 물은 몫
  };
}

// 가정 36가지: 망각 속도 2 × 어렵게 떠올린 보람 3 × 놓쳤을 때 깎임 3 × 찍어 맞힌 답의 처리 2.
export const ASSUMPTIONS = [0.7, 2].flatMap(base =>
  [1.5, 3, 6].flatMap(slope =>
    [0.25, 0.4, 0.6].flatMap(lapse =>
      [true, false].map(guessShrink => ({ base, slope, lapse, guessShrink })),
    ),
  ),
);
