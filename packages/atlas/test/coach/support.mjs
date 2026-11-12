// 코치 시험의 바탕 — 작은 문항 은행 · 가짜 지도 · 조절하는 시계 · 두뇌만 돌리는 기준 판.
import { AsyncLocalStorage } from 'node:async_hooks';
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

// Web Locks(navigator.locks) 흉내 — 이름마다 하나씩, 먼저 청한 것부터 주고 다시 들어갈 수 없다(쥔 채로 또 청하면 앞이 놓을 때까지
// 기다린다 — 진짜 Web Locks와 같다, §18-5-1 R1 s8). signal로 거둘 수 있고, ifAvailable이면 쥘 수 없을 때 기다리지 않고 null로 부른다.
// hold(name)는 다른 탭이 쥐고 안 놓는 것(돌려준 함수로 놓는다). requests는 청한 차례(이름 · ifAvailable)를 남긴다. reentered는 쥔 일 안에서
// 같은 이름을 또 청한 것 — 진짜 Web Locks에서는 앞이 놓을 때까지 기다리고, 앞이 그것을 기다리면 그 저장소의 일이 모두 멈춘다(s8).
// 쥔 일의 비동기 문맥(AsyncLocalStorage)으로 가린다 — 그 일이 놓은 뒤에 돈 청하기(예약해 둔 다음 바퀴)는 세지 않는다.
const holding = new AsyncLocalStorage();
export function fakeLocks() {
  const lanes = new Map();
  const requests = [];
  const laneOf = name => {
    if (!lanes.has(name)) lanes.set(name, { held: false, queue: [] });
    return lanes.get(name);
  };
  const aborted = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
  function grant(lane, callback, resolve, reject) {
    const token = {};
    lane.held = true;
    lane.holder = token;
    const outer = holding.getStore() ?? [];
    holding
      .run([...outer, token], () => Promise.resolve().then(() => callback({ mode: 'exclusive' })))
      .then(resolve, reject)
      .finally(() => {
        lane.held = false;
        lane.holder = null;
        lane.queue.shift()?.();
      });
  }
  const reentered = [];
  const locks = {
    requests,
    reentered,
    held: name => laneOf(name).held,
    hold(name) {
      let release = null;
      void locks.request(name, {}, () => new Promise(resolve => (release = resolve)));
      return () => release?.();
    },
    request(name, options, callback) {
      requests.push({ name, ifAvailable: options?.ifAvailable === true });
      const lane = laneOf(name);
      if (lane.held && (holding.getStore() ?? []).includes(lane.holder)) reentered.push(name);
      const free = !lane.held && !lane.queue.length;
      if (options?.ifAvailable && !free) return Promise.resolve().then(() => callback(null));
      return new Promise((resolve, reject) => {
        const signal = options?.signal ?? null;
        if (signal?.aborted) {
          reject(aborted());
          return;
        }
        const abort = () => {
          const at = lane.queue.indexOf(go);
          if (at < 0) return;
          lane.queue.splice(at, 1);
          reject(aborted());
        };
        const go = () => {
          signal?.removeEventListener?.('abort', abort);
          grant(lane, callback, resolve, reject);
        };
        signal?.addEventListener?.('abort', abort, { once: true });
        if (free) go();
        else lane.queue.push(go);
      });
    },
  };
  return locks;
}
