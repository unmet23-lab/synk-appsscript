// 기록 · 저장 시험의 바탕(단계 3) — 메모리 서버 저장소와 임의의 사건 열 만들기.
// 메모리 저장소는 SYNK-talk의 SQL 저장소(lib/atlas-trail-store.js)와 같은 포트를 같은 뜻으로 낸다 — 패키지의 서버 접기 순서
// (src/record/server.mjs)를 메모리로 돌리고, Talk 시험은 같은 순서를 PGlite의 SQL로 돌린다.
import { pick, rng } from './seeds.mjs';
import { subject } from './subject.mjs';

const R = await subject('record/events.mjs');
const A = await subject('record/adapt.mjs');

// ── 메모리 서버(한 계정) ─────────────────────────────────────────────────────────────
export function createMemoryAccount() {
  const log = [];
  const heads = new Map();
  let seq = 0;
  let floor = 0;
  let pinned = () => false;

  function append(events, receivedMs) {
    return events.map(event => {
      seq += 1;
      const record = { seq, receivedMs, event: structuredClone(event) };
      log.push(record);
      return record;
    });
  }

  const visible = () => log.filter(record => record.seq > floor);

  function port(head) {
    const rowsOf = source => head.rows.get(source) ?? [];
    const allRows = () => [...head.rows.values()].flat();
    const lineKey = (kind, key) => `${kind}\u0000${key}`;
    return {
      head: async () => ({
        foldedUntil: head.foldedUntil,
        floorSeq: floor,
        lineSeq: head.lineSeq,
        issued: structuredClone(head.issued),
      }),
      writeHead: async patch => Object.assign(head, structuredClone(patch)),
      entriesAfter: async (after, limit) =>
        visible()
          .filter(record => record.seq > after)
          .slice(0, limit),
      maxSeq: async () => seq,
      eventById: async (id, until = Infinity) =>
        visible().find(record => record.event.id === id && record.seq <= until) ?? null,
      presentationsOf: async (decisionId, until = Infinity) =>
        visible().filter(
          r =>
            r.seq <= until &&
            r.event.type === R.EVENT_TYPES.presented &&
            r.event.decisionId === decisionId,
        ),
      group: async (sourceId, until = Infinity) => {
        const all = visible().filter(record => record.seq <= until);
        const source = all.find(r => r.event.id === sourceId && A.isSource(r.event));
        if (!source) return null;
        const children = all.filter(r => r.event.presentationId === sourceId);
        const ids = new Set([sourceId, ...children.map(r => r.event.id)]);
        if (source.event.schema === 1 && source.event.decisionId) ids.add(source.event.decisionId);
        const exclusions = all.filter(
          r => r.event.type === R.EVENT_TYPES.excluded && ids.has(r.event.targetId),
        );
        return { source, children, exclusions };
      },
      rowsOf: async source => structuredClone(rowsOf(source)),
      replaceRows: async (source, rows) => {
        if (rows.length) head.rows.set(source, structuredClone(rows));
        else head.rows.delete(source);
      },
      unitRows: async unit =>
        structuredClone(
          allRows().filter(r => (r.kind === 'unit' || r.kind === 'say') && r.unit === unit),
        ),
      familyRows: async family =>
        structuredClone(
          allRows().filter(r => (r.kind === 'meet' || r.kind === 'carry') && r.family === family),
        ),
      familiesOfSkill: async skill => [
        ...new Set(
          allRows()
            .filter(r => r.kind === 'meet' && r.skill === skill)
            .map(r => r.family),
        ),
      ],
      lines: async (kind, keys) =>
        new Map(
          keys
            .filter(key => head.lines.has(lineKey(kind, key)))
            .map(key => [key, structuredClone(head.lines.get(lineKey(kind, key)).value)]),
        ),
      writeLines: async changes => {
        for (const { kind, key, value } of changes) {
          head.lineSeq += 1;
          head.lines.set(lineKey(kind, key), {
            kind,
            key,
            value: structuredClone(value),
            seq: head.lineSeq,
          });
        }
      },
      linesSince: async after =>
        [...head.lines.values()]
          .filter(line => line.seq > after)
          .sort((a, b) => a.seq - b.seq)
          .map(line => structuredClone(line)),
    };
  }

  const account = {
    active: async () => {
      const head = [...heads.values()].find(h => h.state === 'active');
      return head ? { edition: head.edition } : null;
    },
    head: async edition => (heads.has(edition) ? { ...heads.get(edition) } : null),
    create: async (edition, state) => {
      heads.set(edition, {
        edition,
        state,
        foldedUntil: 0,
        lineSeq: 0,
        issued: [],
        rows: new Map(),
        lines: new Map(),
      });
    },
    store: edition => port(heads.get(edition)),
    activate: async edition => {
      for (const key of [...heads.keys()]) if (key !== edition) heads.delete(key);
      heads.get(edition).state = 'active';
    },
  };

  return {
    account,
    append,
    log: () => visible(),
    rawLog: () => log,
    heads,
    // 비우기(계획 §14 — SQL engine.clear_synk_practice와 같은 뜻): 다른 표(교실 연결 · 첫걸음 점수)가 문 사건(pinned)만 남기고 지우고,
    // Trail 머리를 모두 지우고(파생 값), 바닥 = 지우기 전 마지막 차례(큰 값으로만)를 계정에 적는다. 저장소는 바닥 아래를 어디서도 돌려주지 않는다.
    clear() {
      const keep = log.filter(record => pinned(record));
      log.length = 0;
      log.push(...keep);
      floor = Math.max(floor, seq);
      heads.clear();
      return { kept: keep.length, floor };
    },
    floor: () => floor,
    pin(test) {
      pinned = test;
    },
  };
}

// ── 임의의 세계 ───────────────────────────────────────────────────────────────────
export const SKILLS = ['ko.listening.detail', 'ko.reading.detail'];
const FORMATS = ['binary-choice', 'single-choice', 'cup-compose', 'spoken'];
export const T0 = Date.parse('2026-11-01T00:00:00.000Z');
const MINUTE = 60_000;

export function bank(random) {
  const items = [];
  for (let f = 0; f < 4; f += 1)
    for (let i = 0; i < 2; i += 1) {
      const skill = f === 3 ? SKILLS[i] : SKILLS[f % 2];
      items.push({
        itemKey: `it${f}${i}`,
        familyKey: `fam${f}`,
        skillId: skill,
        difficulty: 1 + Math.floor(random() * 3),
        responseFormat: pick(random, FORMATS),
        unknownOption: random() < 0.3,
        audioRequired: random() < 0.3,
        units: random() < 0.6 ? [`u${f}`, ...(random() < 0.5 ? [`u${(f + 1) % 4}`] : [])] : [],
      });
    }
  return items;
}

// 문항 색인(단계 1의 꼴). 판을 바꾸면 몇 문항의 단위가 바뀐다 — 「태그 고침」.
export function indexOf(items, edition, random = null) {
  const table = new Map(
    items.map(item => {
      let units = item.units;
      if (random && random() < 0.5) units = random() < 0.5 ? [] : [`u${Math.floor(random() * 5)}`];
      return [item.itemKey, { ...item, units: [...units] }];
    }),
  );
  return { edition, lookup: key => table.get(key) ?? null };
}

function presentedV2(item, ctx, random) {
  const tier = Math.floor(random() * 5);
  const target = item.units.length && random() < 0.7 ? pick(random, item.units) : null;
  return {
    setId: 'set1',
    itemKey: item.itemKey,
    familyKey: item.familyKey,
    skillId: item.skillId,
    difficulty: item.difficulty,
    responseFormat: item.responseFormat,
    modality: 'listening',
    audioRequired: item.audioRequired,
    confounded: random() < 0.05,
    units: [...item.units],
    firstExposure: pick(random, [true, false, null]),
    ...(item.unknownOption ? { unknownOption: true } : {}),
    editions: {
      params: 'params-1',
      memory: 'memory-1',
      ability: 'ability-1',
      select: 'select-1',
      index: ctx.indexEdition,
    },
    expected: { floor: 0.25, memory: 0.5, skill: 0.6 },
    arm: pick(random, ['adaptive', 'filler']),
    reason: {
      code: 'unit.new',
      slots: {},
      evidence: {},
      target,
      tier,
      introduced: target && tier === 2 ? [target] : [],
    },
  };
}

// 기기 하나 — 2판 사건을 만든다(단조 시각, 만든 차례대로 커지는 번호).
export function createDevice(name, { random, revision = 1, start = T0 }) {
  let last = start;
  let n = 0;
  const tagValue = `${name}`.padEnd(8, '0').slice(0, 8);
  return {
    name,
    revision,
    time: () => last,
    tick(ms) {
      last += ms;
    },
    make(type, fields) {
      last += random() < 0.15 ? 0 : 1 + Math.floor(random() * 3 * MINUTE);
      const atMs = last;
      n += 1;
      return R.createEvent(type, fields, {
        id: R.eventId(atMs, n % 10000, tagValue),
        atMs,
        revision: this.revision,
      });
    },
  };
}

// 옛 꼴 기기 — schema 1 사건(지금 Trail 꼴).
export function createLegacyDevice(name, { random, start = T0 }) {
  let last = start;
  let n = 0;
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  return {
    name,
    legacy: true,
    make(type, fields) {
      last += random() < 0.2 ? 0 : 1 + Math.floor(random() * 3 * MINUTE);
      n += 1;
      const at = new Date(last).toISOString();
      return { schema: 1, id: `${name}${n}`, scope, at, recordedAt: at, type, ...fields };
    },
  };
}

const verdictOf = (random, v2) =>
  pick(
    random,
    v2
      ? ['correct', 'correct', 'incorrect', 'unknown', 'unassessed', 'skipped']
      : ['correct', 'correct', 'incorrect', 'unassessed', 'skipped'],
  );

// 한 기기에서 한 걸음 — 새로 만든 사건들(옛 꼴 제시는 결정이 앞에 붙어 둘)을 돌려준다.
// open = 이 기기가 연 제시들, made = 이 기기가 만든 사건 전부.
export function stepDevice(device, state, ctx, random) {
  const before = state.made.length;
  stepOnce(device, state, ctx, random);
  return state.made.slice(before);
}

function stepOnce(device, state, ctx, random) {
  const v2 = !device.legacy;
  const roll = random();
  if (roll < 0.25 || !state.open.length) return presentStep(device, state, ctx, random, v2);
  const p = pick(random, state.open);
  if (roll < 0.35)
    return push(
      state,
      device.make('practice.delivery', {
        presentationId: p.id,
        audio: pick(random, ['pending', 'completed', 'completed', 'failed']),
      }),
    );
  if (roll < 0.47)
    return push(
      state,
      device.make('practice.helped', {
        presentationId: p.id,
        helpId: `h${state.made.length}`,
        level: pick(random, ['cue', 'explanation', 'answer']),
        contentRef: 'hint.v1',
      }),
    );
  if (roll < 0.75) return attemptStep(device, state, p, random, v2);
  if (roll < 0.83 && state.made.length && !ctx.solo) return excludeStep(device, state, random);
  if (v2 && (roll < 0.92 || ctx.solo))
    return push(
      state,
      device.make('unit.stated', {
        unit: `u${Math.floor(random() * 5)}`,
        say: pick(random, ['known', 'relearn']),
      }),
    );
  if (v2) return carryStep(device, state, ctx, random);
  return presentStep(device, state, ctx, random, v2);
}

function push(state, event) {
  state.made.push(event);
  return event;
}

function presentStep(device, state, ctx, random, v2) {
  const item = pick(random, ctx.items);
  if (v2) {
    const event = push(state, device.make('practice.presented', presentedV2(item, ctx, random)));
    state.open.push(event);
    state.attempts.set(event.id, 0);
    return event;
  }
  const decision = push(
    state,
    device.make('decision.made', {
      experienceId: 'game',
      variant: 'standard',
      policy: 'x',
      evidence: [],
    }),
  );
  const event = push(
    state,
    device.make('practice.presented', {
      decisionId: decision.id,
      taskId: 'task',
      taskVersion: 'v1',
      itemKey: item.itemKey,
      conceptIds: [item.skillId],
      firstExposure: pick(random, [true, true, false, null]),
      measure: {
        skillId: item.skillId,
        modality: 'listening',
        difficulty: item.difficulty,
        familyKey: item.familyKey,
        audioRequired: item.audioRequired,
        confounded: random() < 0.05,
        responseFormat: item.responseFormat,
      },
    }),
  );
  state.open.push(event);
  state.attempts.set(event.id, 0);
  return event;
}

function attemptStep(device, state, p, random, v2) {
  const attemptNo = state.attempts.get(p.id) + 1;
  state.attempts.set(p.id, attemptNo);
  const reason = random() < 0.08 ? { reason: pick(random, ['storage', 'audio', 'demo']) } : {};
  return push(
    state,
    device.make('practice.attempted', {
      presentationId: p.id,
      attemptNo,
      verdict: verdictOf(random, v2),
      errorTags: [],
      ...reason,
    }),
  );
}

function excludeStep(device, state, random) {
  const target = pick(
    random,
    state.made.filter(e => e.type !== 'record.excluded'),
  );
  return push(state, device.make('record.excluded', { targetId: target.id }));
}

function carryStep(device, state, ctx, random) {
  const families = {};
  for (const item of ctx.items)
    if (random() < 0.3) families[item.familyKey] = 1 + Math.floor(random() * 7);
  if (!Object.keys(families).length) families.fam0 = 1;
  const after =
    random() < 0.5
      ? null
      : new Date(device.time() - Math.floor(random() * 60 * MINUTE)).toISOString();
  return push(state, device.make('record.carried', { families, items: {}, after }));
}

export const newState = () => ({ open: [], made: [], attempts: new Map() });
export { rng, pick };
