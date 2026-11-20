// 순간 맞춤(Flow — 아틀라스 설계 §5-2 작업 난이도). 옛 atlas/flow.js의 뜻을 옮겼다(단계 4 계획 §23-4).
// 내용은 손잡이를 쉬운 값부터 어려운 값 순서로 밝힌다. 내용마다 두 추정 — 지금 이 사람이 견디는 내용의 도전과 시간 압박 — 을
// 들고, 응답 하나 뒤에 손잡이 하나를 한 칸 돌려 그 사람을 내용의 목표 성공률 가까이에 둔다.
// 순수 함수다: 입출력 · 시계 · 네트워크 · 모델 호출 · 신원이 없다. 시각은 호스트가 넘기고 기억은 호스트가 저장한다.
// 추정은 점수 · 등급 · 숙달이 아니고 그렇게 보이지 않는다. 손잡이를 움직이는 것은 본인이 밝힌 선택과 응답뿐이다 — 나이 · 성별 ·
// 국적 같은 인구 칸은 없고 받지 않는다. 도움은 도전을 올리지 않고, 도움 줄이기는 제안하고 받아들일 뿐 강요하지 않는다.
// 모든 바뀜의 마지막 말은 가드(guard.mjs check)다.
//
// 옛 것과 다른 점(설계 주인 승인 — §23-4 · §23-11의 2):
//   · items(문항 난도 단계)는 손잡이가 아니다 — 새 엔진에서는 두뇌가 문항 난도를 고른다. 정의에서 받되 손잡이 목록에 넣지 않고,
//     observe({ level })로 받은 「낸 문항의 난도」를 관찰 칸에 둔다. 그 칸은 기대 성공률(challenge)의 내용 몫에 items.weight로 들고
//     (관찰 전에는 items.start), Flow가 돌리지 않는다 — 그 단계의 올림 · 내림과 그 안내 줄이 나오지 않는다. Flow가 바라는 문항 단계
//     (옛 run.level() · settings().level)는 없다.
//   · 손잡이가 items뿐인 내용은 순간 맞춤이 없다 — settings().adaptive가 거짓이고 시작 코드는 start.none(줄 없음)이다.
//   · 옛 기억(v: 2)에 문항 난도 칸(ITEM)이 있어도 그 칸만 빼고 읽는다(새 길이 처음 열 때 옛 내용 기억을 씨앗으로 한 번 읽는다).
//   · priorFromSummary는 옮기지 않았다 — 새 길은 내용 기억이 없으면 내용의 시작값에서 연다(start의 prior 칸은 같은 뜻으로 남는다).
// 그 밖의 뜻(목표 · 걸음 크기 · 오늘 · 표시 설정 · 가드 · 도움 줄이기 · 기억)은 같은 입력에 옛 것과 같은 결과를 낸다
// (test/flow/parity.test.mjs가 items 없는 내용으로 맞댄다).
import { check } from './guard.mjs';

export const VERSION = 'flow-1';
export const KINDS = Object.freeze(['content', 'pace', 'support']);
export const OUTCOMES = Object.freeze(['success', 'fail', 'timeout', 'skip', 'void']);
export const MODES = Object.freeze(['auto', 'fixed', 'easier', 'harder']);
export const CONDITIONS = Object.freeze(['good', 'okay', 'tired', 'no_time']);
export const DIMENSIONS = Object.freeze(['content', 'pace']);
// 옛 기억의 문항 난도 칸 이름. 손잡이 id로 쓰지 못한다 — 옛 기억의 그 칸이 다른 손잡이로 읽히지 않게.
export const ITEM = 'item.difficulty';
const DAY = 86_400_000;
const RETURN_AFTER = 14 * DAY;
const LATENCIES = 20;
// 걸음 크기(로짓). 증거가 방향을 바꾸면 줄고, 같은 쪽을 가리키는 답이 넷 이어지면 되살아난다 — 빨리 바뀌는 사람도 따라간다.
const RATE = Object.freeze({ max: 1.2, half: 3, min: 0.3, recover: 4 });
// 조용한 성공이 이만큼 이어지면 추정이 뒤처져 있어도 한 칸 올린다.
const STREAK = 4;
// 조용한 성공 두 번쯤이면 한 칸 오르고, 놓침 한 번이면 내린다(답답함이 쉬움보다 비싸다).
const DEADBAND = 0.75;
// 시간이 다 되는 것이 가장 답답한 놓침이라 시간 압박은 그것을 드물게 두려 한다.
const PACE_TARGET = 0.9;

const copy = value => JSON.parse(JSON.stringify(value));
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const scalar = value =>
  ['number', 'string', 'boolean'].includes(typeof value) &&
  (typeof value !== 'number' || Number.isFinite(value));
const within = (value, min, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export const sigmoid = x => 1 / (1 + Math.exp(-x));
export const logit = p => Math.log(p / (1 - p));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
const fail = message => {
  throw new TypeError(`Flow: ${message}`);
};
const time = value => {
  const n = Date.parse(value);
  if (typeof value !== 'string' || !Number.isFinite(n)) fail('invalid time');
  return n;
};
const dimensionOf = knob => (knob.kind === 'pace' ? 'pace' : 'content');

// ── 내용 정의 ──
// 손잡이마다 쉬운 값부터 값을 늘어놓고, start는 내용의 기본 자리다. kind: 'content'(무엇을 묻나) · 'pace'(시간 압박) · 'support'(도움).
// follows: 'declared'는 본인 선택만 움직인다(글자 크기 · 움직임 …). items는 내용이 꺼내 쓸 수 있는 문항 난도 단계다(관찰 칸 — 위 머리).
const defined = new WeakSet();
const SPEC_KEYS = Object.freeze(['id', 'version', 'target', 'scale', 'knobs', 'items']);
const KNOB_KEYS = Object.freeze(['id', 'values', 'start', 'weight', 'kind', 'follows', 'label']);

const levelsOk = levels =>
  Array.isArray(levels) &&
  levels.length >= 2 &&
  levels.length <= 6 &&
  levels.every(
    (level, index) => Number.isInteger(level) && (index === 0 || level > levels[index - 1]),
  );

function itemsOf(items) {
  if (
    !items ||
    typeof items !== 'object' ||
    Object.keys(items).some(key => !['levels', 'weight', 'start'].includes(key))
  )
    fail('invalid item levels');
  const levels = items.levels ?? [1, 2, 3];
  const start = items.start ?? 0;
  const weight = items.weight ?? 2;
  if (
    !levelsOk(levels) ||
    !Number.isInteger(start) ||
    start < 0 ||
    start >= levels.length ||
    !within(weight, 0.25, 4)
  )
    fail('invalid item levels');
  return { levels: [...levels], weight, start };
}

const knobOk = (value, seen) =>
  id(value.id) &&
  !seen.has(value.id) &&
  Array.isArray(value.values) &&
  value.values.length >= 2 &&
  value.values.length <= 12 &&
  value.values.every(scalar) &&
  Number.isInteger(value.start) &&
  value.start >= 0 &&
  value.start < value.values.length &&
  within(value.weight, 0.25, 4) &&
  KINDS.includes(value.kind) &&
  [null, 'declared'].includes(value.follows) &&
  typeof value.label === 'string' &&
  value.label.length <= 60;

function knobOf(knob, seen) {
  if (!knob || typeof knob !== 'object' || Object.keys(knob).some(key => !KNOB_KEYS.includes(key)))
    fail('invalid knob');
  const value = {
    id: knob.id,
    values: knob.values,
    start: knob.start ?? 0,
    weight: knob.weight ?? 1,
    kind: knob.kind ?? 'content',
    follows: knob.follows ?? null,
    label: knob.label ?? knob.id,
  };
  if (!knobOk(value, seen)) fail(`invalid knob ${knob?.id}`);
  seen.add(value.id);
  return value;
}

function specHead(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('content spec required');
  if (Object.keys(input).some(key => !SPEC_KEYS.includes(key))) fail('unknown spec field');
  const spec = {
    id: input.id,
    version: input.version ?? 1,
    target: input.target ?? 0.75,
    scale: input.scale ?? 0.5,
    knobs: [],
    items: null,
  };
  if (!id(spec.id) || !Number.isInteger(spec.version) || spec.version < 1)
    fail('invalid content id or version');
  if (!within(spec.target, 0.55, 0.9) || !within(spec.scale, 0.2, 1.5))
    fail('target must be 0.55-0.9 and scale 0.2-1.5');
  return spec;
}

export function defineContent(input) {
  if (defined.has(input)) return input;
  const spec = specHead(input);
  const knobs = input.knobs ?? [];
  if (!Array.isArray(knobs) || knobs.length > 8 || (!knobs.length && !input.items))
    fail('one to eight knobs required');
  if (input.items != null) spec.items = itemsOf(input.items);
  const seen = new Set([ITEM]);
  for (const knob of knobs) spec.knobs.push(knobOf(knob, seen));
  const result = Object.freeze(copy(spec));
  defined.add(result);
  return result;
}

// 한 차원의 도전(로짓): 손잡이 몫에 내용의 scale을 곱한다. 내용 차원(과 전체)에는 낸 문항의 난도 몫(items.weight × 그 자리)이 든다 —
// item은 낸 단계의 자리이고, 주지 않으면 내용의 시작 단계다. items 없는 내용에서는 옛 challenge와 같은 값이다.
export function challenge(spec, indices, dimension = null, item = spec.items?.start ?? 0) {
  const items = spec.items && dimension !== 'pace' ? spec.items.weight * item : 0;
  return (
    spec.scale *
    spec.knobs.reduce(
      (sum, knob) =>
        sum +
        (dimension === null || dimensionOf(knob) === dimension
          ? knob.weight * indices[knob.id]
          : 0),
      items,
    )
  );
}
const defaults = spec => Object.fromEntries(spec.knobs.map(knob => [knob.id, knob.start]));
// 그 차원에 도전이 있나. 내용 차원은 돌릴 수 있는 손잡이가 없어도 낸 문항의 난도(items)가 있으면 있다 — 시간과 내용이 목표를 나눈다.
const has = (spec, dimension) =>
  spec.knobs.some(knob => dimensionOf(knob) === dimension && knob.follows !== 'declared') ||
  (dimension === 'content' && spec.items !== null);
/* 두 차원의 목표 — 둘의 곱이 전체 목표다. 내용의 목표 성공률에서 시간은 PACE_TARGET을, 내용은 나머지를 겨눈다. 쉽게(또는 어렵게)
 * 고른 날은 두 목표를 같은 비율로 옮긴다 — 시계나 내용 어느 한쪽이 먼저 어려워지지 않게. */
function targets(spec, overall) {
  const timed = has(spec, 'pace');
  const contented = has(spec, 'content');
  if (!(timed && contented))
    return { content: contented ? overall : PACE_TARGET, pace: timed ? overall : PACE_TARGET };
  const pace = clamp(PACE_TARGET * Math.sqrt(overall / spec.target), 0.75, 0.97);
  return { content: clamp(overall / pace, 0.55, 0.95), pace };
}

const estimateOk = value =>
  value &&
  typeof value === 'object' &&
  within(value.theta, -20, 20) &&
  within(value.n, 0, 1e6) &&
  within(value.reversals, 0, 1e6);
const memoryOk = (spec, memory) =>
  memory != null &&
  typeof memory === 'object' &&
  memory.v === 2 &&
  memory.content === spec.id &&
  memory.specVersion === spec.version &&
  estimateOk(memory.estimates?.content) &&
  estimateOk(memory.estimates?.pace) &&
  typeof memory.at === 'string' &&
  Number.isFinite(Date.parse(memory.at)) &&
  !!memory.indices &&
  typeof memory.indices === 'object' &&
  Array.isArray(memory.latencies) &&
  memory.latencies.length <= LATENCIES &&
  memory.latencies.every(ms => within(ms, 0, 600000));

// 내용 기억을 읽는다. 이 내용의 손잡이 칸만 읽으므로 옛 기억의 문항 난도 칸(ITEM)은 저절로 빠진다.
function validMemory(spec, memory) {
  if (!memoryOk(spec, memory)) return null;
  const indices = {};
  for (const knob of spec.knobs) {
    const index = memory.indices[knob.id];
    indices[knob.id] =
      Number.isInteger(index) && index >= 0 && index < knob.values.length ? index : knob.start;
  }
  // 마지막으로 관찰한 문항 난도 자리 — 오래 쉬고 돌아온 판의 추정 상한이 그 자리에서 선다(카본 끝 판 E2). 없거나 틀리면 내용의 시작 단계.
  const item = memory.item;
  return {
    estimates: copy(memory.estimates),
    at: memory.at,
    indices,
    latencies: [...memory.latencies],
    item:
      spec.items && Number.isInteger(item) && item >= 0 && item < spec.items.levels.length
        ? item
        : null,
  };
}

/* 본인이 고른 표시 설정(Core personalization의 presentation)을 이 내용의 잠금으로(설계 아틀라스_순간맞춤 §9). 낱말은 개인화 어댑터의
 * 것이다. support 'step'은 돌릴 수 있는 도움 손잡이를 모두 가장 많은 도움(첫 값)에, 'independent'는 가장 적은 도움에 두고,
 * 'choose'는 판에 맡긴다(도움 줄이기는 제안하고 받아들일 뿐). textSize · motion · explanation은 같은 id의 follows: 'declared'
 * 손잡이가 그 값을 가질 때 그 값에 둔다. audio는 판이 아니라 판 고르기의 몫이다. 그 밖의 것(분 · 목표 · 까닭 · 나이 · 인구 칸)은 거절한다. */
export const PRESENTATION = Object.freeze({
  support: Object.freeze(['choose', 'step', 'independent']),
  textSize: Object.freeze(['standard', 'large']),
  explanation: Object.freeze(['brief', 'standard', 'detailed']),
  motion: Object.freeze(['full', 'reduced']),
  audio: Object.freeze(['off', 'available']),
});
const FOLLOWED = Object.freeze(['textSize', 'motion', 'explanation']);

function presentationCheck(presentation) {
  if (
    !presentation ||
    typeof presentation !== 'object' ||
    Array.isArray(presentation) ||
    Object.keys(presentation).some(key => !Object.hasOwn(PRESENTATION, key))
  )
    fail(`presentation accepts only ${Object.keys(PRESENTATION).join(', ')}`);
  for (const [key, value] of Object.entries(presentation))
    if (value != null && !PRESENTATION[key].includes(value)) fail(`invalid presentation ${key}`);
}

// 한 손잡이의 잠금 자리. 잠그지 않으면 -1.
function lockOf(knob, presentation, support) {
  if (knob.follows === 'declared')
    return FOLLOWED.includes(knob.id) && presentation[knob.id] != null
      ? knob.values.indexOf(presentation[knob.id])
      : -1;
  if (knob.kind === 'support' && support !== 'choose')
    return support === 'step' ? 0 : knob.values.length - 1;
  return -1;
}

export function declaredFrom(input, presentation) {
  const spec = defineContent(input);
  presentationCheck(presentation);
  const support = presentation.support ?? 'choose';
  const knobs = {};
  for (const knob of spec.knobs) {
    const index = lockOf(knob, presentation, support);
    if (index >= 0) knobs[knob.id] = index;
  }
  return { knobs };
}

// ── 한 판(start가 돌려주는 run)의 상태 r과 그 계산 ──
const lockedIn = (r, knob) => Object.hasOwn(r.locks, knob.id) || knob.follows === 'declared';
// 목표까지의 거리(손잡이 칸). 음수면 지금 자리가 그 사람에게 어렵다.
const gap = (r, dimension, goal = r.aim, theta = r.estimates[dimension].theta) =>
  (theta - logit(goal[dimension]) - challenge(r.spec, r.indices, dimension, r.item)) / r.spec.scale;
const chance = (r, dimension, at = r.indices) =>
  sigmoid(r.estimates[dimension].theta - challenge(r.spec, at, dimension, r.item));
const expected = (r, at = r.indices) =>
  (has(r.spec, 'content') ? chance(r, 'content', at) : 1) *
  (has(r.spec, 'pace') ? chance(r, 'pace', at) : 1);

// 추정은 내용이 나타낼 수 있는 것보다 멀리 달아나지 않는다 — 마음이 바뀌면 빨리 따라간다. 오늘 손으로 정한 손잡이는 이 폭을 좁히지
// 않는다(추정은 오늘의 선택이 아니라 사람에 관한 것이다). 내용 차원에는 문항 난도 단계의 폭도 든다(옛 ITEM 손잡이의 폭과 같다).
function span(r, dimension, goal = r.aim) {
  const { spec, indices } = r;
  const knobs = spec.knobs.filter(knob => dimensionOf(knob) === dimension);
  const items = dimension === 'content' ? spec.items : null;
  const fixed = knob => (knob.follows === 'declared' ? indices[knob.id] : null);
  const low = spec.scale * knobs.reduce((sum, k) => sum + k.weight * (fixed(k) ?? 0), 0);
  const high =
    spec.scale *
    knobs.reduce(
      (sum, k) => sum + k.weight * (fixed(k) ?? k.values.length - 1),
      items ? items.weight * (items.levels.length - 1) : 0,
    );
  return [
    low + logit(goal[dimension]) - 2 * spec.scale,
    high + logit(goal[dimension]) + 2 * spec.scale,
  ];
}
function bound(r, dimension) {
  const [low, high] = span(r, dimension);
  r.estimates[dimension].theta = clamp(r.estimates[dimension].theta, low, high);
}

function learn(r, dimension, y, weight, ceiling = Infinity) {
  const e = r.estimates[dimension];
  const p = chance(r, dimension);
  const sign = Math.sign(y - p);
  if (sign && e.sign && sign !== e.sign) {
    e.reversals += 1;
    e.streak = 0;
  } else if (sign) {
    e.streak += 1;
    if (e.streak >= RATE.recover) {
      e.reversals = Math.max(0, e.reversals - 1);
      e.streak = 0;
    }
  }
  if (sign) e.sign = sign;
  const rate = Math.max(RATE.min, RATE.max / (1 + e.reversals / RATE.half));
  e.theta = clamp(e.theta + Math.min(ceiling, rate * weight * (y - p)), -20, 20);
  e.n += weight;
  bound(r, dimension);
}

function because(direction, knob, observed) {
  if (direction > 0) return knob.kind === 'pace' ? 'comfortable-success' : 'steady-success';
  if (observed?.assisted && observed.outcome === 'success') return 'help-needed';
  if (knob.kind === 'pace')
    return observed?.outcome === 'timeout' ? 'time-ran-out' : 'time-pressure';
  if (knob.kind === 'support') return 'more-help';
  return 'content-miss';
}

// 올림은 작은 걸음부터, 내림은 큰 덜어냄부터(도움은 마지막). 도움을 줄이는 쪽은 여기서 고르지 않는다.
function orderedPool(r, dimension, direction, held) {
  const pool = r.spec.knobs.filter(
    knob =>
      dimensionOf(knob) === dimension && !held(knob) && (direction < 0 || knob.kind !== 'support'),
  );
  const byWeight = list =>
    [...list].sort((a, b) => (direction > 0 ? a.weight - b.weight : b.weight - a.weight));
  return [
    ...byWeight(pool.filter(k => k.kind !== 'support')),
    ...byWeight(pool.filter(k => k.kind === 'support')),
  ];
}

/* 한 차원에서 손잡이 하나를 한 칸, 가드의 레일 안에서. 내용은 내용 손잡이를 먼저 덜고 도움은 그 뒤에 더한다. held와 history는 오늘의
 * 판의 것이다 — 아래 여는 자리의 「보통 판」을 따로 셈할 때만 그 판의 것을 넘긴다. */
function settle(r, dimension, direction, observed, reason, options = {}) {
  const { phase = 'response', held = knob => lockedIn(r, knob), history = r.changes } = options;
  for (const knob of orderedPool(r, dimension, direction, held)) {
    const from = r.indices[knob.id];
    const to = from + direction;
    if (to < 0 || to >= knob.values.length) continue;
    // 다음 답이 곧바로 도로 내릴 자리로 올리지 않는다(큰 걸음은 더 또렷한 앞섬을 기다린다). 조용한 연속의 걸음은 시험 삼아 따로 본다.
    if (
      direction > 0 &&
      phase === 'response' &&
      reason !== 'quiet-streak' &&
      gap(r, dimension) - knob.weight <= -DEADBAND
    )
      continue;
    const rail = { spec: r.spec, knob: knob.id, from, to, step: r.step, phase, history };
    if (!check({ ...rail, frozen: !r.adaptive }).ok) continue;
    r.indices[knob.id] = to;
    const change = {
      step: r.step,
      phase,
      knob: knob.id,
      kind: knob.kind,
      dimension,
      from,
      to,
      direction,
      because: reason || because(direction, knob, observed),
      value: knob.values[to],
    };
    history.push(change);
    return change;
  }
  return null;
}

// ── 여는 자리 ──
// 앞선 근거는 추정 쪽으로 여러 칸을 갈 수 있다. 기억은 멈춘 자리에서 이어 가며 그 추정이나 오늘의 선택이 바랄 때 내리기만 한다.
// 오래 쉬었다 오면 지난번보다 한 칸 가볍게 열고 추정을 그 자리에 맞춰 내린다. 피곤한 날의 여는 자리는 내리기만 한다.
function openMoves(r, goal, theta, { ease, limit, why, held, history }) {
  const moves = [];
  const directions = {};
  const off = d => gap(r, d, goal, theta[d]);
  // 목표에서 가장 먼 차원부터. 그 차원에 갈 걸음이 없으면(끝 · 잠김 · 가드가 막음) 응답처럼 다음 차원으로. 저마다 한 번씩 보고,
  // 아무도 못 움직이면 끝난다. 앞선 근거의 큰 걸음이 목표를 건너갈 수 있다 — 이 여는 자리 안에서는 되돌아가지 않는다.
  const due = d =>
    Math.abs(off(d)) >= DEADBAND &&
    (!ease || off(d) < 0) &&
    (!directions[d] || directions[d] === Math.sign(off(d)));
  for (let n = 0; n < limit; n += 1) {
    const ranked = DIMENSIONS.filter(due).sort((a, b) => Math.abs(off(b)) - Math.abs(off(a)));
    let change = null;
    for (const dimension of ranked) {
      change = settle(r, dimension, Math.sign(off(dimension)), null, why, {
        phase: 'opening',
        held,
        history,
      });
      if (change) break;
    }
    if (!change) break;
    directions[change.dimension] = change.direction;
    moves.push(change);
  }
  return moves;
}

function openReturning(r) {
  for (const dimension of DIMENSIONS) {
    const change = settle(r, dimension, -1, null, 'returning', { phase: 'opening' });
    if (change) {
      r.opening.push(change);
      break;
    }
  }
  for (const dimension of DIMENSIONS)
    r.estimates[dimension].theta = Math.min(
      r.estimates[dimension].theta,
      logit(r.aim[dimension]) + challenge(r.spec, r.indices, dimension, r.seen),
    );
}

/* 쉽게 · 어렵게 고른 날이나 피곤한 날에는 「보통 판」의 여는 자리를 먼저 셈해 따로 둔다 — 같은 사람 · 앞선 근거 · 기억에, 모드도 컨디션도
 * 손으로 정한 것도 없는 판이다. 그 자리 쪽으로 가는 걸음은 앞선 근거나 기억의 것이라 남기고, 그 자리와의 차이(지나친 걸음이나 오늘이
 * 가지 않은 걸음)는 오늘만의 것이다. 그 판에서 잠긴 손잡이는 적응 판이 닿았던 자리에서 열고 다른 손잡이처럼 움직인다 — 앞선 근거나
 * 기억이 그 손잡이에 바란 걸음이 다른 손잡이로 옮겨 가지 않게. 본인 선택만 따르는 손잡이는 내용의 값에 둔다(기억은 선택한 값을 두지
 * 않는다). 잠긴 손잡이 자체는 있던 자리(reached)에 두고, 오늘의 판은 정한 대로 둔다. 제 자리 · 잠금 · 기록으로 같은 가드 안에서,
 * 같은 한도와 걸음으로 셈하고, 오늘의 판에는 아무것도 남기지 않는다. 보통 자동 판은 이 따로 판을 만들지 않는다. */
function homeOf(r, basis, plan) {
  const today = r.indices;
  const declaredOnly = knob => knob.follows === 'declared';
  r.indices = Object.fromEntries(
    r.spec.knobs.map(knob => [knob.id, declaredOnly(knob) ? knob.start : r.reached[knob.id]]),
  );
  const theta = Object.fromEntries(
    DIMENSIONS.map(d => [d, clamp(r.unbound[d], ...span(r, d, r.ordinary))]),
  );
  openMoves(r, r.ordinary, theta, {
    ...plan,
    ease: basis === 'memory',
    held: declaredOnly,
    history: [],
  });
  const home = r.indices;
  r.indices = today;
  return home;
}

function todayReason(r, change, why) {
  if (change.direction > 0) return r.mode === 'harder' ? 'declared-harder' : why;
  if (r.calm) return 'tired';
  return r.mode === 'easier' ? 'declared-easier' : why;
}

function openAdapted(r, basis) {
  const why = basis === 'memory' ? 'memory' : 'prior';
  const plan = { limit: basis === 'memory' ? 2 : 12, why };
  const home = r.mode !== 'auto' || r.calm ? homeOf(r, basis, plan) : null;
  const theta = Object.fromEntries(DIMENSIONS.map(d => [d, r.estimates[d].theta]));
  const moves = openMoves(r, r.aim, theta, {
    ...plan,
    ease: basis === 'memory' || r.calm,
    held: knob => lockedIn(r, knob),
    history: r.changes,
  });
  for (const change of moves) {
    if (home && (home[change.knob] - change.from) * change.direction <= 0)
      change.because = todayReason(r, change, why);
    r.opening.push(change);
  }
  if (home)
    for (const knob of r.spec.knobs) r.todayOnly[knob.id] = r.indices[knob.id] - home[knob.id];
}

// ── 응답 ──
function observationCheck(spec, { outcome, assisted, repeat, pressure, latencyMs, level }) {
  if (
    !OUTCOMES.includes(outcome) ||
    typeof assisted !== 'boolean' ||
    typeof repeat !== 'boolean' ||
    (pressure !== null && !within(pressure, 0, 1.5)) ||
    (latencyMs !== null && !within(latencyMs, 0, 600000))
  )
    fail('invalid observation');
  if (level !== null && (!spec.items || !spec.items.levels.includes(level)))
    fail('invalid item level');
}

// 내용: 무엇을 답했나(시간 초과는 내용에 대해 말하지 않는다). 시간: 시간이 있었나. 한계 가까이의 답은 시간에 반만 친다.
// 쓴 시간의 몫을 모르면 시간 안의 답은 「시간 안」이라고만, 반 무게로 친다. 도움을 본 성공은 추정을 올리지 않는다.
function learnContent(r, { outcome, assisted, repeat }) {
  if (outcome !== 'success') return learn(r, 'content', 0, 1);
  learn(r, 'content', assisted ? 0.5 : 1, repeat && !assisted ? 0.5 : 1, assisted ? 0 : Infinity);
}
function learnPace(r, { outcome, pressure }) {
  if (outcome === 'timeout') learn(r, 'pace', 0, 1);
  else if (pressure !== null) learn(r, 'pace', 1 - 0.5 * clamp((pressure - 0.5) / 0.5, 0, 1), 1);
  else learn(r, 'pace', 1, 0.5);
}
function learnFrom(r, observed, about) {
  if (about.content) learnContent(r, observed);
  if (about.pace) learnPace(r, observed);
}

function countRun(r, { outcome, assisted, repeat, latencyMs }, evidence) {
  if (outcome === 'success' && !assisted && !repeat) {
    r.quiet += 1;
    if (latencyMs !== null) r.latencies.push(Math.round(latencyMs));
  } else if (evidence) r.quiet = 0;
  if (outcome === 'success') r.steady += 1;
  else if (outcome === 'fail' || outcome === 'timeout') r.steady = 0;
  while (r.latencies.length > LATENCIES) r.latencies.shift();
}

// 「혼자 여러 번 이어서 해냈다: 한 칸 위로」(설계 §5-2). 추정보다 빨리 배우는 사람도 잡는다 — 추정이 그 걸음을 따라간다.
function quietStep(r, pressure) {
  const ready = DIMENSIONS.filter(
    d => gap(r, d) >= 0 && !(d === 'pace' && pressure !== null && pressure > 0.5),
  ).sort((a, b) => gap(r, b) - gap(r, a) || (a === 'content' ? -1 : 1));
  for (const dimension of ready) {
    const change = settle(r, dimension, 1, r.last, 'quiet-streak');
    if (!change) continue;
    // 그 사람이 목표 가까이에서 아직 해낼 수 있는 걸음만. 아니면 되돌리고 기다린다.
    if (chance(r, dimension) < r.aim[dimension] - 0.15) {
      r.indices[change.knob] = change.from;
      r.changes.pop();
      continue;
    }
    // 시험 삼은 걸음: 추정은 그 자리를 붙들 만큼만 움직인다 — 놓침 한 번이면 돌아온다.
    r.estimates[dimension].theta = Math.max(
      r.estimates[dimension].theta,
      logit(r.aim[dimension]) + challenge(r.spec, r.indices, dimension, r.item) - r.spec.scale / 2,
    );
    r.quiet = 0;
    return change;
  }
  return null;
}

// 내림이 먼저다 — 목표에서 가장 아래로 먼 차원부터. 그다음 때가 된 올림. 올리는 것은 혼자 해낸 성공뿐이다 — 놓치거나 시간이 다 되거나
// 도움을 본 답은 다른 차원이 준비돼 보여도 올리지 않는다. 난도를 실은 응답을 혼자 해냈으면 내용 차원은 내리지 않는다 — 그 난도를 해낸
// 증거다. 두뇌가 더 어려운 문항을 내 기대 성공률이 내려갔다는 것만으로는 내리지 않는다(끝 판 E1 · 다시 보기 C1 — 같은 난도를 이어 해내도
// 그대로다). 난도를 관찰한 뒤 난도를 싣지 않은 응답은 지금 난도 자리의 응답이라 같다(둘째 다시 보기 A1). 난도를 한 번도 관찰하지 않은 판은
// 옛 판과 같다.
function decide(r, { outcome, assisted, pressure, level }) {
  const held = outcome === 'success' && !assisted && (level != null || r.leveled);
  const below = d => gap(r, d) <= -DEADBAND && !(held && d === 'content');
  const lower = DIMENSIONS.filter(below).sort((a, b) => gap(r, a) - gap(r, b));
  const raise =
    !r.calm && outcome === 'success' && !assisted
      ? DIMENSIONS.filter(
          d => gap(r, d) >= DEADBAND && !(d === 'pace' && pressure !== null && pressure >= 0.85),
        ).sort((a, b) => gap(r, b) - gap(r, a))
      : [];
  for (const dimension of lower) {
    const change = settle(r, dimension, -1, r.last);
    if (change) return change;
  }
  if (lower.length) return null;
  for (const dimension of raise) {
    const change = settle(r, dimension, 1, r.last);
    if (change) return change;
  }
  return r.quiet >= STREAK && !r.calm ? quietStep(r, pressure) : null;
}

/* 응답마다. pressure는 내용이 알 때 쓴 시간의 몫(0-1), assisted는 답 전에 도움이 화면에 있었음, repeat는 전에 만난 문항, level은 낸
 * 문항의 난도 단계(관찰 칸 — 다음 관찰까지 기대 성공률에 든다). 건너뛰거나 무효인 응답(소리 실패 · 앱 숨김 · 잘못 누름)은 증거가 아니라
 * 아무것도 움직이지 않는다. */
function observe(r, input = {}) {
  const {
    outcome,
    assisted = false,
    repeat = false,
    pressure = null,
    latencyMs = null,
    level = null,
  } = input;
  const observed = { outcome, assisted, repeat, pressure, latencyMs, level };
  observationCheck(r.spec, observed);
  const about = {
    content: outcome === 'success' || (outcome === 'fail' && !(pressure !== null && pressure >= 1)),
    pace: has(r.spec, 'pace') && ['success', 'fail', 'timeout'].includes(outcome),
  };
  const evidence = about.content || about.pace;
  r.responses += 1;
  if (evidence) r.step += 1;
  // 증거가 아닌 응답(건너뜀 · 무효)의 문항 난도는 판의 기준으로 두지 않는다(GPT 끝 판 E2).
  if (level !== null && evidence) r.item = r.seen = r.spec.items.levels.indexOf(level);
  r.leveled ||= level !== null && evidence;
  const before = expected(r);
  learnFrom(r, observed, about);
  countRun(r, observed, evidence);
  r.last = { outcome, assisted, repeat, pressure };
  const change = r.adaptive && evidence ? decide(r, observed) : null;
  // 방금 바뀐 도움 단계는 도움 줄이기를 묻기 전에 제 성공을 다시 쌓는다.
  if (change && change.kind === 'support') r.steady = 0;
  r.trace.push({
    response: r.responses,
    step: r.step,
    outcome,
    assisted,
    repeat,
    pressure,
    expected: round(before, 3),
    content: round(r.estimates.content.theta, 3),
    pace: round(r.estimates.pace.theta, 3),
    change: change && copy(change),
  });
  return { change: change && copy(change), settings: settingsOf(r), evidence };
}

function settingsOf(r) {
  const { spec, indices } = r;
  return {
    content: spec.id,
    policy: VERSION,
    arm: r.arm,
    mode: r.mode,
    adaptive: r.adaptive,
    values: Object.fromEntries(spec.knobs.map(knob => [knob.id, knob.values[indices[knob.id]]])),
    indices: { ...indices },
    expected: round(expected(r), 2),
  };
}

// ── 도움 줄이기 ──
// 그 사람이 도움 줄이기 제안(lines.mjs supportStep)을 받아들였다. 도움 손잡이 하나가 도움이 적은 쪽으로 한 칸 — 다른 것은 바뀌지 않는다.
// 다른 바뀜과 같은 응답에서, 올린 직후, 피곤한 날에는 하지 않는다. 제안은 나중에 다시 올 수 있다.
const lessHelpKnob = r =>
  r.spec.knobs.find(
    k => k.kind === 'support' && !lockedIn(r, k) && r.indices[k.id] < k.values.length - 1,
  );
const lessHelpRail = (r, knob) =>
  check({
    spec: r.spec,
    knob: knob.id,
    from: r.indices[knob.id],
    to: r.indices[knob.id] + 1,
    step: r.step,
    phase: 'accepted',
    history: r.changes,
    frozen: false,
  }).ok;

function lessHelpAllowed(r) {
  const knob = lessHelpKnob(r);
  return !!knob && r.adaptive && !r.calm && lessHelpRail(r, knob);
}

function acceptLessHelp(r) {
  const knob = lessHelpKnob(r);
  if (!knob || !r.adaptive || r.calm || !lessHelpRail(r, knob)) return null;
  const from = r.indices[knob.id];
  const to = from + 1;
  r.indices[knob.id] = to;
  // 시험 삼은 걸음처럼 붙든다: 추정은 그 사람의 선택을 지킬 만큼만 움직여, 다음 여는 자리가 슬며시 되돌리지 않게 한다(도움 본 성공은
  // 추정을 올리지 않는다). 놓치면 도움은 여전히 돌아온다.
  r.estimates.content.theta = Math.max(
    r.estimates.content.theta,
    logit(r.aim.content) + challenge(r.spec, r.indices, 'content', r.item) - r.spec.scale / 2,
  );
  const change = {
    step: r.step,
    phase: 'accepted',
    knob: knob.id,
    kind: knob.kind,
    dimension: 'content',
    from,
    to,
    direction: 1,
    because: 'accepted-less-help',
    value: knob.values[to],
  };
  // 이어진 성공은 이 걸음에 썼다 — 새 도움 단계는 제 성공을 다시 쌓는다.
  r.steady = 0;
  r.changes.push(change);
  return copy(change);
}

// 돌릴 수 있는 손잡이가 모두 가장 쉬운 자리인 차원. 거기서도 힘들면 내용 자체에 더 쉬운 걸음이 없다 — 더 쉬운 내용을 권한다.
const floorOf = r =>
  DIMENSIONS.filter(d => {
    const knobs = r.spec.knobs.filter(k => dimensionOf(k) === d && !lockedIn(r, k));
    return knobs.length > 0 && knobs.every(k => r.indices[k.id] === 0);
  });

// 다음을 위해 호스트가 저장하는 것: 내용마다, 신원 · 답 · 글 없이. 추정은 판마다 배우고, 남기는 자리는 적응 판이 닿은 자리뿐이다 —
// 오늘의 선택만을 위해 간 여는 걸음은 뺀다.
function memoryOf(r, at) {
  const { spec } = r;
  return {
    v: 2,
    content: spec.id,
    specVersion: spec.version,
    policy: VERSION,
    at: new Date(time(at)).toISOString(),
    estimates: Object.fromEntries(
      DIMENSIONS.map(d => [
        d,
        {
          theta: round(r.estimates[d].theta, 4),
          n: round(r.estimates[d].n, 2),
          reversals: r.estimates[d].reversals,
        },
      ]),
    ),
    indices: Object.fromEntries(
      spec.knobs.map(k => [
        k.id,
        r.adaptive && !lockedIn(r, k)
          ? clamp(r.indices[k.id] - (r.todayOnly[k.id] || 0), 0, k.values.length - 1)
          : r.reached[k.id],
      ]),
    ),
    latencies: [...r.latencies],
    ...(spec.items ? { item: r.seen } : {}),
  };
}

// ── 시작 ──
const START = Object.freeze(['spec', 'memory', 'prior', 'declared', 'condition', 'arm', 'now']);

function declaredCheck(spec, declared) {
  if (
    !declared ||
    typeof declared !== 'object' ||
    Array.isArray(declared) ||
    Object.keys(declared).some(key => !['mode', 'knobs'].includes(key))
  )
    fail('declared must be { mode, knobs }');
  const mode = declared.mode ?? 'auto';
  const locks = { ...(declared.knobs ?? {}) };
  if (!MODES.includes(mode)) fail('invalid declared mode');
  for (const [knobId, index] of Object.entries(locks)) {
    const knob = spec.knobs.find(k => k.id === knobId);
    if (!knob || !Number.isInteger(index) || index < 0 || index >= knob.values.length)
      fail(`invalid declared knob ${knobId}`);
  }
  return { mode, locks };
}

function dayCheck({ condition, arm, prior }) {
  if (condition !== null && !CONDITIONS.includes(condition)) fail('invalid condition');
  if (!['adapted', 'baseline'].includes(arm)) fail('invalid arm');
  if (prior !== null && (typeof prior !== 'object' || !within(prior.content, -20, 20)))
    fail('invalid prior');
}

// 새 사람은 내용의 기본 자리에서 정확히 연다. 기억이 있으면 그 추정과 자리에서, 앞선 근거가 있으면 그 내용 추정에서.
function placeOf(spec, remembered, prior) {
  const base = defaults(spec);
  const ordinary = targets(spec, spec.target);
  const fresh = dimension => ({
    theta: challenge(spec, base, dimension) + logit(ordinary[dimension]),
    n: 0,
    reversals: 0,
    streak: 0,
    sign: 0,
  });
  const estimates = { content: fresh('content'), pace: fresh('pace') };
  if (remembered) {
    for (const dimension of DIMENSIONS)
      Object.assign(estimates[dimension], remembered.estimates[dimension], { streak: 0, sign: 0 });
    return { estimates, indices: { ...remembered.indices }, basis: 'memory' };
  }
  if (prior) estimates.content.theta = prior.content;
  return { estimates, indices: { ...base }, basis: prior ? 'prior' : 'default' };
}

function introOf(r, basis, returning) {
  if (!r.flows) return 'none';
  if (!r.adaptive) return r.arm === 'baseline' ? 'baseline' : 'fixed';
  if (returning) return 'returning';
  return r.condition === 'tired' ? 'tired' : basis;
}

// 그 밖의 것은 받지 않는다: 프로필 · 나이 · 성별 · 국적 같은 인구 칸이 없다.
function optionsCheck(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    Object.keys(options).some(key => !START.includes(key))
  )
    fail(`start accepts only ${START.join(', ')}`);
}

// 오늘의 전체 목표: 쉽게 고른 판은 높이고 어렵게 고른 판은 낮추며, 피곤한 날은 더 높인다.
const overallOf = (spec, mode, condition) =>
  clamp(
    spec.target +
      (mode === 'easier' ? 0.1 : mode === 'harder' ? -0.1 : 0) +
      (condition === 'tired' ? 0.08 : 0),
    0.55,
    0.92,
  );

function runOf(spec, { mode, locks, condition, arm, remembered, placed }) {
  // 손잡이가 items뿐인 내용에는 순간 맞춤이 없다(위 머리).
  const flows = spec.knobs.length > 0;
  return {
    spec,
    mode,
    locks,
    condition,
    arm,
    flows,
    adaptive: flows && arm === 'adapted' && mode !== 'fixed',
    // 피곤한 날(설계 §4-9): 판 동안 아무것도 어려워지지 않고 도움 줄이기를 묻지 않는다. 내리기는 하고, 높은 목표가 시작을 덜 수 있다.
    calm: condition === 'tired',
    aim: targets(spec, overallOf(spec, mode, condition)),
    // 보통 날 자동 모드의 목표 — 앞선 근거나 기억만으로 놓이는 자리.
    ordinary: targets(spec, spec.target),
    estimates: placed.estimates,
    indices: placed.indices,
    // 적응 판이 닿았던 자리. 고정 · 비교 판이나 손으로 정한 손잡이는 오늘 다른 자리에서 하지만 기억의 이 자리를 덮지 않는다.
    reached: { ...placed.indices },
    latencies: remembered ? remembered.latencies : [],
    changes: [],
    trace: [],
    opening: [],
    // step은 증거였던 응답만 센다 — 가드의 쉼은 그것으로 잰다. steady는 도움이 있든 없든 이어진 성공이다 — 답마다 도움이 보이는
    // 곳에서는 조용한 성공이 없어도 도움 줄이기를 물을 수 있어야 한다(lines.mjs supportStep).
    step: 0,
    responses: 0,
    quiet: 0,
    steady: 0,
    last: null,
    // 오늘의 여는 자리가 앞선 근거나 기억만의 자리에서 손잡이마다 얼마나 떨어져 끝났나 — 오늘의 선택(피곤한 날, 쉽게 · 어렵게 고른 판)만을
    // 위해 간 몫이다. 남기는 것에서 되돌려, 다음 날은 적응 판이 닿은 자리에서 연다.
    todayOnly: {},
    // 낸 문항의 난도 자리(관찰 칸). 판을 열 때는 내용의 시작 단계다 — 아직 낸 문항이 없다.
    item: spec.items ? spec.items.start : 0,
    // 마지막으로 관찰한 난도 자리 — 기억에 남기고, 오래 쉬고 돌아온 판의 추정 상한만 이 자리에서 선다(카본 끝 판 E2). 보통 날 여는 자리는
    // 시작 단계로 셈한다 — 기억한 어려운 난도로 셈하면 혼자 해낸 판을 다시 열자마자 내린다(GPT 다시 보기 GC4).
    seen: spec.items ? (remembered?.item ?? spec.items.start) : 0,
    // 이 판에서 낸 문항의 난도를 한 번이라도 관찰했다 — 그 뒤 난도를 싣지 않은 응답도 지금 난도 자리(item)의 응답으로 본다.
    leveled: false,
    unbound: null,
  };
}

function openRun(options) {
  optionsCheck(options);
  const { memory = null, prior = null, declared = {}, condition = null, arm = 'adapted' } = options;
  const spec = defineContent(options.spec);
  const { mode, locks } = declaredCheck(spec, declared);
  dayCheck({ condition, arm, prior });
  const startedAt = time(options.now);
  const remembered = validMemory(spec, memory);
  const placed = placeOf(spec, remembered, prior);
  // 오래 쉬었다 오면 빨리 다시 배운다(아래 여는 자리가 한 칸 가볍게 연다). 날 수는 세지도 보이지도 않는다.
  const returning = !!remembered && startedAt - time(remembered.at) > RETURN_AFTER;
  if (returning)
    for (const dimension of DIMENSIONS)
      placed.estimates[dimension].reversals = Math.min(placed.estimates[dimension].reversals, 1);
  const r = runOf(spec, { mode, locks, condition, arm, remembered, placed });
  for (const knob of spec.knobs) {
    if (Object.hasOwn(locks, knob.id)) r.indices[knob.id] = locks[knob.id];
    // 고정 · 비교 판은 내용의 기본값을 쓴다(밝힌 잠금은 늘 지킨다).
    else if (!r.adaptive || knob.follows === 'declared') r.indices[knob.id] = knob.start;
  }
  // 오늘의 목표가 묶기 전의 추정. 보통 날은 제 자리에서 따로 묶는다.
  r.unbound = Object.fromEntries(DIMENSIONS.map(d => [d, r.estimates[d].theta]));
  for (const dimension of DIMENSIONS) bound(r, dimension);
  if (r.adaptive && returning) openReturning(r);
  else if (r.adaptive) openAdapted(r, placed.basis);
  return { r, intro: introOf(r, placed.basis, returning) };
}

export function start(options = {}) {
  const { r, intro } = openRun(options);
  return {
    spec: r.spec,
    settings: () => settingsOf(r),
    intro: () => ({ code: `start.${intro}`, opening: copy(r.opening) }),
    observe: input => observe(r, input),
    lessHelpAllowed: () => lessHelpAllowed(r),
    acceptLessHelp: () => acceptLessHelp(r),
    quietStreak: () => r.quiet,
    steadyStreak: () => r.steady,
    floor: () => floorOf(r),
    latencies: () => [...r.latencies],
    trace: () => copy(r.trace),
    changes: () => copy(r.changes),
    last: () => r.last && { ...r.last },
    memory: at => memoryOf(r, at),
  };
}
