// 묶음 색인 · 손님 접기 대조 시험의 바탕(기기 답 저장 빠르게 하기 설계 2-5, 11-23). 기록부의 든 사건(held)을 흉내 낸다 — 든 차례 · 포트 열쇠 ·
// 같은 번호의 더 작은 열쇠(R10) · 치우기 · 통째로 다시 읽기 · 지도 더하기. 사건 열은 trail-world 꼴에 제외의 갈래(답 · 제시 · 전달 · 장부 ·
// 옛 꼴 결정 · 판 사건 · 없는 번호)를 더하고, 든 차례와 열쇠 차례를 따로 섞는다(부모보다 자식 먼저, 다른 탭 차례).
import { subject } from './subject.mjs';
import {
  bank,
  createDevice,
  createLegacyDevice,
  newState,
  pick,
  stepDevice,
} from './trail-world.mjs';

const { deviceKey, groupsOf } = await subject('record/adapt.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');
const { addHeldSkills } = await subject('record/own.mjs');

// log.mjs의 entryOf와 같은 기록 꼴 — 2판은 사건 번호, 옛 꼴은 든 차례(position).
export const entryOf = item => ({
  event: item.event,
  key: item.event.schema === 2 ? item.event.id : deviceKey(item.position, item.event),
  atMs: Date.parse(item.event.at),
});

// 고칠 수 있는 문항 색인(지도를 더하면 revision이 오르고 몇 문항의 계열 · 단위가 바뀐다).
export function mutableIndex(items, random) {
  let table = new Map(items.map(item => [item.itemKey, { ...item }]));
  const index = {
    edition: 'index-a',
    revision: 0,
    familySkills: new Map([['fam0', [items[0].skillId]]]),
    lookup: key => table.get(key) ?? null,
    addMap() {
      table = new Map(
        [...table].map(([key, item]) => [
          key,
          random() < 0.3
            ? {
                ...item,
                units: random() < 0.5 ? [] : [`u${Math.floor(random() * 5)}`],
                familyKey: random() < 0.3 ? `fam${Math.floor(random() * 5)}` : item.familyKey,
              }
            : item,
        ]),
      );
      index.revision += 1;
      index.familySkills.set(`fam${Math.floor(random() * 5)}`, [pick(random, items).skillId]);
    },
  };
  return index;
}

// 판 사건(2판 결정 · 마침 · 응답)과 제외 — 색인은 꼴을 보지 않는다(접기 재료가 아닌 사건과 그것을 겨눈 제외).
const v2 = (id, type, at, fields) => ({ schema: 2, id, type, at, revision: 1, ...fields });

// 겨눌 사건 — 옛 꼴 결정 · 답 · 제시를 더 자주(늦게 드는 결정 · 머리를 기다리는 제외가 자주 서게).
function targetOf(random, pool, i) {
  const roll = random();
  const of = type => pool.filter(event => event.type === type);
  const list =
    roll < 0.25
      ? of(EVENT_TYPES.setDecided)
      : roll < 0.45
        ? of(EVENT_TYPES.attempted)
        : roll < 0.6
          ? of(EVENT_TYPES.presented)
          : pool;
  if (roll > 0.95 || !list.length) return `missing${i}`;
  return pick(random, list).id;
}

// 더한 사건은 아무 자리에나 끼운다 — 겨눈 사건보다 먼저 만든 제외도 선다.
function extraEvents(random, made, count) {
  const at = () => made[Math.floor(random() * made.length)].at;
  for (let i = 0; i < count; i += 1) {
    const roll = random();
    const event =
      roll < 0.15
        ? v2(`set${i}`, EVENT_TYPES.setDecided, at(), { setId: 'set1' })
        : roll < 0.2
          ? v2(`done${i}`, EVENT_TYPES.setCompleted, at(), {})
          : v2(`x${i}`, EVENT_TYPES.excluded, at(), { targetId: targetOf(random, made, i) });
    made.splice(Math.floor(random() * (made.length + 1)), 0, event);
  }
  return made;
}

// 사건 열 하나(만든 차례). 2판 기기 둘 · 옛 꼴 기기 하나가 번갈아 만든다.
export function eventPool(random, { steps = 40 } = {}) {
  const items = bank(random);
  const ctx = { items, indexEdition: 'index-a' };
  const devices = [
    [createDevice('aaaa', { random }), newState()],
    [createDevice('bbbb', { random }), newState()],
    [createLegacyDevice('old', { random }), newState()],
  ];
  const made = [];
  for (let step = 0; step < steps; step += 1) {
    const [device, state] = pick(random, devices);
    made.push(...stepDevice(device, state, ctx, random));
  }
  return { items, events: extraEvents(random, made, Math.floor(random() * 16)) };
}

// 만든 차례를 흐트린 차례 — 창 width 안에서 섞는다(부모보다 자식이 먼저 드는 차례가 생긴다).
export const jitter = (random, list, width) =>
  list
    .map((value, i) => ({ value, at: i + random() * width }))
    .sort((a, b) => a.at - b.at)
    .map(({ value }) => value);

// 기록부의 든 사건 흉내 — 넣으면 색인(있으면)에도 넣는다. key는 포트 열쇠다.
export function createHeld(groups = null) {
  const held = new Map();
  let positions = 0;
  const self = {
    held,
    groups,
    take(event, key) {
      const item = held.get(event.id);
      if (item) {
        if (key < item.key) item.key = key;
        groups?.lowerKey(event.id, item.key);
        return;
      }
      positions += 1;
      const fresh = { event, key, position: positions };
      held.set(event.id, fresh);
      groups?.add(entryOf(fresh), key);
    },
    // 치우기 — 지운 뒤 색인을 통째로 다시 짓는다(log.mjs compact).
    drop(ids) {
      for (const id of ids) held.delete(id);
      groups?.rebuild(held.values(), entryOf);
    },
    // 통째로 다시 읽기(resetRead → 포트 차례로 다시 든다 — 같은 번호는 더 작은 열쇠로 한 번).
    reload() {
      const rows = [...held.values()].sort((a, b) => a.key - b.key);
      held.clear();
      positions = 0;
      groups?.reset();
      for (const item of rows) self.take(item.event, item.key);
    },
    entries: () => [...held.values()].map(entryOf),
    keyOf: id => held.get(id).key,
    until: until => [...held.values()].filter(item => item.key <= until).map(entryOf),
    byKey: () => [...held.values()].sort((a, b) => a.key - b.key).map(entryOf),
    groupsAt: until => groupsOf(self.until(until)),
    maxKey: () => Math.max(0, ...[...held.values()].map(item => item.key)),
  };
  return self;
}

// 든 제시의 계열 → 능력(familySkillsOf의 「든 사건」 몫, 처음부터).
export function heldSkillsOf(events) {
  const out = new Map();
  addHeldSkills(events, (family, skills) =>
    out.set(family, [...new Set([...(out.get(family) ?? []), ...skills])]),
  );
  return out;
}
