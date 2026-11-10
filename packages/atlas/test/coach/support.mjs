// 코치 시험의 바탕 — 작은 문항 은행 · 가짜 지도 · 조절하는 시계 · 두뇌만 돌리는 기준 판.
import { pick, rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';

export const { createCoach } = await subject('coach/index.mjs');
export const { memoryPort } = await subject('record/port.mjs');
export const { checkEvent, EVENT_TYPES } = await subject('record/events.mjs');
export const { PARAMS } = await subject('params.mjs');
export const { createMemory } = await subject('memory/index.mjs');
export const { choose } = await subject('select/choose.mjs');
export const { createLearner, present, record, startSession } = await subject('select/session.mjs');

export const T0 = Date.UTC(2026, 10, 11, 1, 0, 0);
export const STEP = 20_000;

const FORMATS = ['single-choice', 'binary-choice', 'cup-compose'];

// 문항 은행: 단위 풀에서 하나~셋을 고른 문항들. 계열마다 능력 하나.
export function bankOf(random, { items = 14, units = 9, skills = 3 } = {}) {
  const pool = Array.from({ length: units }, (_, i) => `ko.word.u${i}`);
  return Array.from({ length: items }, (_, i) => {
    const count = 1 + Math.floor(random() * 3);
    const own = [...new Set(Array.from({ length: count }, () => pick(random, pool)))];
    return Object.freeze({
      itemKey: `t.i${i}`,
      familyKey: `t.f${Math.floor(i / 2)}`,
      skillId: `ko.reading.s${Math.floor(i / 2) % skills}`,
      difficulty: 1 + (i % 3),
      responseFormat: pick(random, FORMATS),
      units: Object.freeze(own),
      order: i,
      modality: 'reading',
    });
  });
}

// 지도의 겉(map.item · editions · familySkills · unit) — 코치는 이것만 읽는다.
export function fakeMap(items, edition = 'index-t') {
  const byKey = new Map(
    items.map(item => {
      const { modality, ...brain } = item;
      return [item.itemKey, Object.freeze(brain)];
    }),
  );
  const familySkills = new Map();
  for (const item of items)
    familySkills.set(item.familyKey, [
      ...new Set([...(familySkills.get(item.familyKey) ?? []), item.skillId]),
    ]);
  return {
    editions: { map: 'map-1', index: edition },
    familySkills,
    item: ref => byKey.get(typeof ref === 'string' ? ref : ref?.itemKey) ?? null,
    unit: id => ({ id, label: id.split('.').at(-1) }),
  };
}

export function clock(start = T0) {
  const state = { t: start };
  return {
    now: () => state.t,
    advance: (ms = STEP) => (state.t += ms),
    get t() {
      return state.t;
    },
  };
}

let stores = 0;
export async function openCoach({
  items,
  port = memoryPort(),
  time,
  seed = 'coach-seed',
  ...rest
}) {
  stores += 1;
  const coach = createCoach({
    gameId: 'coach-test',
    map: fakeMap(items),
    seed,
    dayOffset: 0,
    host: { guest: true, port, key: `synk-atlas:test-${process.pid}-${stores}`, now: time.now },
    ...rest,
  });
  await coach.ready;
  return { coach, port };
}

// 정답 여부 — 문항 · 걸음마다 정해진 값(두 판이 같은 답을 낸다).
export const answerOf = (_, item, step) => {
  const h = [...`${item.itemKey}|${step}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return h % 100 < 62;
};
