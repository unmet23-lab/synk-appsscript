// 대조 시험 4(기기 답 저장 빠르게 하기 설계 2-5 · 검토 D4, 11-23) — 코치의 측정용 첫 만남(leadAt) · 놓침 기록(meets) · 소리 전달(deliveredAt)을
// 앞 길(heldEvents()의 포트 열쇠 차례로 groupsOf를 짓고 옛 꼴 열쇠는 i + 1)과 새 길(기록부의 묶음 색인)로 같은 기록부에서 견준다.
//   소비자가 쓰는 값(측정의 exposure · independent, delivered, 놓침 기록 줄)은 늘 같아야 한다.
//   날값은 2판 사건에서 같아야 한다. 옛 꼴 사건은 기록 열쇠 글자(i + 1 → 든 차례 position)만 다를 수 있다 — 그 수를 센다.
// 자물쇠 없는 손님 탭 여럿 · 한 포트에서 옛 기록 옮기기(같은 번호가 두 열쇠 — R10), 다른 탭 차례, 다른 탭 제시에 단 답을 섞는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { memory, PARAMS } from '../support/trail-sync.mjs';
import {
  bank,
  createLegacyDevice,
  indexOf,
  newState,
  pick,
  rng,
  stepDevice,
  T0,
} from '../support/trail-world.mjs';

const { openRecord } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { deviceKey, groupsOf, itemOf, foldEventsOf, audiosBefore } =
  await subject('record/adapt.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');
const { evidenceOf } = await subject('fold/evidence.mjs');
const { legacyToImport } = await subject('record/carry.mjs');
const coach = await subject('coach/record.mjs');
const { answerLogOf } = await subject('coach/answer-log.mjs');

const SET = `set.game-a.${T0 - 1000}.abcdef.1`;
// 옛 꼴 열쇠(a.<시각>.l<든 차례 9자리>)와 그 바로 앞 장부 만남(끝 글자를 하나 내리고 ~ — 0은 /가 된다).
const isLegacyKey = id => /\.l[0-9/]{9}~?$/.test(id);

// ── 앞 길(coach/record.mjs의 11-23 앞 판 그대로) ──
const entriesOf = events =>
  events.map((event, i) => ({
    event,
    key: event.schema === 2 ? event.id : deviceKey(i + 1, event),
    atMs: Date.parse(event.at),
  }));
function familyGroups(entries, family, index) {
  return [...groupsOf(entries)].filter(([, group]) => {
    const event = group.source.event;
    if (event.type === EVENT_TYPES.carried) return true;
    return event.type === EVENT_TYPES.presented && itemOf(event, index)?.familyKey === family;
  });
}
function marksOf(groups, index) {
  const folds = [];
  const sourceOf = new Map();
  for (const [source, group] of groups)
    for (const fold of foldEventsOf(group, index)) {
      folds.push(fold);
      sourceOf.set(fold.id, source);
    }
  return { marks: evidenceOf(folds).marks, sourceOf };
}
const leadOfMark = (lead, sourceOf) =>
  lead
    ? {
        id: lead.id,
        source: sourceOf.get(lead.id) ?? null,
        carried: lead.carried === true,
        solo: lead.unaided === true && lead.grade != null,
      }
    : null;
const oldLeadAt = (record, family, at, index) => {
  const { marks, sourceOf } = marksOf(
    familyGroups(entriesOf(record.heldEvents()), family, index),
    index,
  );
  return leadOfMark(
    (marks.get(family) ?? []).find(mark => mark.at === at),
    sourceOf,
  );
};
function oldMeets(record, index) {
  const groups = groupsOf(entriesOf(record.heldEvents()));
  const { marks, sourceOf } = marksOf(groups, index);
  const leadOf = (family, at) =>
    leadOfMark(
      (marks.get(family) ?? []).find(mark => mark.at === at),
      sourceOf,
    );
  return { groups, leadOf };
}
function oldDelivered(record, presentationId, answerId) {
  const group = groupsOf(entriesOf(record.heldEvents())).get(presentationId);
  if (!group?.children.some(entry => entry.key === answerId)) return false;
  if (group.source.event.audioRequired !== true) return true;
  return audiosBefore(group).get(answerId) === 'completed';
}

// ── 견주기 ──
const measuredOf = (lead, presented, answerId) => {
  const exposure = lead && !lead.carried && lead.source === presented.id ? 'new' : 'repeat';
  return { exposure, independent: exposure === 'new' && lead.id === answerId && lead.solo };
};

function compareLead(tally, oldLead, newLead, label) {
  if (oldLead == null || newLead == null) {
    assert.deepEqual(newLead, oldLead, label);
    return;
  }
  if (!isLegacyKey(oldLead.id) || !isLegacyKey(newLead.id)) {
    assert.deepEqual(newLead, oldLead, `${label}: 2판 lead는 날값까지 같다`);
    return;
  }
  // 옛 꼴 lead — 열쇠 글자만 다를 수 있다
  const { id: a, ...restOld } = oldLead;
  const { id: b, ...restNew } = newLead;
  assert.deepEqual(restNew, restOld, `${label}: 옛 꼴 lead는 열쇠 글자 밖이 같다`);
  if (a !== b) tally.legacyKeyOnly += 1;
}

const idsOf = list => list.map(entry => entry.event.id);
function compareGroups(oldGroups, newGroups, label) {
  assert.deepEqual([...newGroups.keys()], [...oldGroups.keys()], `${label}: 묶음 차례`);
  for (const [id, group] of oldGroups) {
    const mine = newGroups.get(id);
    const v2 = group.source.event.schema === 2;
    if (v2) assert.deepEqual(mine, group, `${label}: 2판 묶음 ${id}`);
    else {
      assert.deepEqual(idsOf(mine.children), idsOf(group.children), `${label}: ${id} 자식`);
      assert.deepEqual(idsOf(mine.exclusions), idsOf(group.exclusions), `${label}: ${id} 제외`);
    }
  }
}

function answerLog(record, index, meets, now) {
  const host = {
    trail: { record, meets: () => meets },
    view: () => record.view(),
    index,
    now: () => now,
  };
  return answerLogOf(host, { days: 365, games: null });
}

function compareTab(tab, w, label) {
  const { record } = tab;
  const view = record.view();
  const items = record.heldItems().map(item => item.event);
  const byId = new Map(items.map(event => [event.id, event]));
  for (const family of view.met.keys()) {
    const at = view.met.get(family);
    compareLead(
      w.tally,
      oldLeadAt(record, family, at, w.index),
      coach.leadAt(record, family, at, w.index),
      `${label}: 계열 ${family}`,
    );
    w.tally.leads += 1;
  }
  for (const answer of items) {
    if (answer.type !== EVENT_TYPES.attempted) continue;
    const presented = byId.get(answer.presentationId);
    assert.equal(
      coach.deliveredAt(record, answer.presentationId, answer.id),
      oldDelivered(record, answer.presentationId, answer.id),
      `${label}: ${answer.id} 소리 전달`,
    );
    if (!presented || answer.schema !== 2) continue;
    const family = itemOf(presented, w.index)?.familyKey;
    if (view.waitAll === true || !view.met.has(family)) continue;
    const at = view.met.get(family);
    assert.deepEqual(
      measuredOf(coach.leadAt(record, family, at, w.index), presented, answer.id),
      measuredOf(oldLeadAt(record, family, at, w.index), presented, answer.id),
      `${label}: ${answer.id} 측정`,
    );
    w.tally.measured += 1;
  }
  const before = oldMeets(record, w.index);
  const after = coach.meetsOf(record, w.index);
  compareGroups(before.groups, after.groups, label);
  const rows = answerLog(record, w.index, after, w.clock);
  assert.deepEqual(rows, answerLog(record, w.index, before, w.clock), `${label}: 놓침 기록`);
  w.tally.rows += rows.rows.length;
}

// ── 세계 ──
const hop = () => new Promise(resolve => setImmediate(resolve));
function tabPort(base, random) {
  let chain = Promise.resolve();
  const wrap =
    name =>
    (...args) => {
      const promise = base[name](...args);
      promise.catch(() => {});
      const n = Math.floor(random() * 4);
      const run = chain.then(async () => {
        for (let i = 0; i < n; i += 1) await hop();
        return promise;
      });
      chain = run.catch(() => {});
      return run;
    };
  return {
    read: wrap('read'),
    range: wrap('range'),
    append: wrap('append'),
    remove: wrap('remove'),
    close: async () => {},
  };
}

async function openTab(w, i) {
  const record = await openRecord({
    port: tabPort(w.base, w.random),
    guest: true,
    memory,
    params: PARAMS,
    index: w.index,
    now: () => w.clock,
    tag: `t${i}`.padEnd(8, 'x'),
  });
  const tab = { i, record, state: newState(), flows: [] };
  tab.device = {
    name: `t${i}`,
    time: () => record.clock.lastAt,
    make(type, fields) {
      const more = type === EVENT_TYPES.presented ? { ...fields, setId: SET } : fields;
      const { event, stored } = record.add(type, more);
      tab.flows.push(stored);
      if (type === EVENT_TYPES.presented) w.shown.push(event);
      return event;
    },
  };
  return tab;
}

// 다른 탭이 띄운 제시에 이 탭이 답을 단다(이 탭이 그 제시를 들었으면) — 같은 제시의 답이 탭마다 다른 차례로 든다(검토 D4).
function answerOther(w, tab) {
  const shown = w.shown.filter(event => tab.record.has(event.id));
  if (!shown.length) return;
  const presentationId = pick(w.random, shown).id;
  const { stored } = tab.record.add(EVENT_TYPES.attempted, {
    presentationId,
    attemptNo: 1 + Math.floor(w.random() * 3),
    verdict: pick(w.random, ['correct', 'incorrect']),
    errorTags: [],
  });
  tab.flows.push(stored);
}

async function carryOld(w, tab) {
  await tab.record.refresh();
  await tab.record.importLegacy(legacyToImport(w.old.log, id => tab.record.has(id)));
}

function stepWorld(w) {
  w.clock += Math.floor(w.random() * 2 * 60_000);
  const tab = pick(w.random, w.tabs);
  const roll = w.random();
  if (roll < 0.5) stepDevice(tab.device, tab.state, w.ctx, w.random);
  else if (roll < 0.6) answerOther(w, tab);
  else if (roll < 0.7) w.all.push(tab.record.refresh());
  else if (roll < 0.78) w.all.push(tab.record.refold());
  else {
    w.old.log.push(...stepDevice(w.old.device, w.old.state, w.ctx, w.random));
    w.all.push(carryOld(w, tab));
  }
}

async function quiet(w) {
  const flows = w.tabs.flatMap(tab => tab.flows.splice(0));
  await Promise.allSettled([...w.all.splice(0), ...flows]);
}

async function run(seed, tally) {
  const random = rng(seed);
  const items = bank(random);
  const w = {
    random,
    items,
    index: indexOf(items, 'index-a'),
    base: memoryPort(),
    clock: T0,
    tabs: [],
    all: [],
    shown: [],
    tally,
    old: { device: createLegacyDevice('old', { random }), state: newState(), log: [] },
  };
  w.ctx = { items, indexEdition: 'index-a' };
  for (let i = 0; i < 2 + (seed % 2); i += 1) w.tabs.push(await openTab(w, i));
  for (let step = 0; step < 50; step += 1) {
    stepWorld(w);
    if (random() < 0.5) await hop();
    if (random() < 0.2) {
      await quiet(w);
      for (const tab of w.tabs) compareTab(tab, w, `씨앗 ${seed} 걸음 ${step} 탭 ${tab.i}`);
    }
  }
  await quiet(w);
  for (const tab of w.tabs) {
    await tab.record.refresh();
    compareTab(tab, w, `씨앗 ${seed} 끝 탭 ${tab.i}`);
  }
}

test('대조 4 — 측정 · 소리 전달 · 놓침 기록은 앞 길과 새 길이 같고, 날값은 2판에서 같으며 옛 꼴은 열쇠 글자만 다르다(설계 ① · 검토 D4)', async () => {
  const tally = { leads: 0, measured: 0, rows: 0, legacyKeyOnly: 0 };
  for (let seed = 1; seed <= 40; seed += 1) await run(seed, tally);
  assert.ok(tally.measured > 100 && tally.rows > 50, JSON.stringify(tally));
  console.log(`대조 4: ${JSON.stringify(tally)}`);
});

// 같은 제시의 답 둘이 열쇠와 반대 차례로 든다 — 탭 B가 먼저 저장한 답(작은 열쇠)을 탭 A는 제 답(큰 열쇠)보다 늦게 읽는다. 놓침 기록의 첫 판정
// 답은 포트 열쇠 차례(앞 길)로 고른다(검토 D4).
test('대조 4 고정 — 같은 제시의 답 둘이 열쇠와 반대 차례로 들어도 놓침 기록은 앞 길과 같다(검토 D4)', async () => {
  const random = rng(7);
  const items = bank(random);
  const index = indexOf(items, 'index-a');
  const base = memoryPort();
  const clock = { now: T0 };
  const open = tag =>
    openRecord({
      port: base,
      guest: true,
      memory,
      params: PARAMS,
      index,
      now: () => clock.now,
      tag,
    });
  const a = await open('aaaaaaaa');
  const b = await open('bbbbbbbb');
  const item = items[0];
  const shown = a.add(EVENT_TYPES.presented, {
    setId: SET,
    itemKey: item.itemKey,
    familyKey: item.familyKey,
    skillId: item.skillId,
    difficulty: item.difficulty,
    responseFormat: item.responseFormat,
    modality: 'listening',
    audioRequired: false,
    confounded: false,
    units: ['u0'],
    firstExposure: true,
    editions: { params: 'p', memory: 'm', ability: 'a', select: 's', index: 'index-a' },
    expected: { floor: 0.25, memory: 0.5, skill: 0.6 },
    arm: 'adaptive',
    reason: { code: 'unit.new', slots: {}, evidence: {}, target: 'u0', tier: 2, introduced: [] },
  });
  await shown.stored;
  await b.refresh();
  clock.now += 1000;
  const first = b.add(EVENT_TYPES.attempted, {
    presentationId: shown.event.id,
    attemptNo: 1,
    verdict: 'incorrect',
    errorTags: [],
  });
  await first.stored;
  clock.now += 1000;
  const second = a.add(EVENT_TYPES.attempted, {
    presentationId: shown.event.id,
    attemptNo: 1,
    verdict: 'correct',
    errorTags: [],
  });
  await second.stored;
  await a.refresh(); // 탭 A는 제 답 뒤에 B의 앞 열쇠 답을 읽는다
  assert.deepEqual(
    a.heldItems().map(i => i.event.id),
    [shown.event.id, second.event.id, first.event.id],
    'A가 든 차례는 열쇠와 반대다',
  );
  const log = meets => answerLog(a, index, meets, clock.now);
  const now = log(coach.meetsOf(a, index));
  assert.deepEqual(now, log(oldMeets(a, index)));
  assert.equal(now.rows[0].eventId, first.event.id, '첫 판정 답은 열쇠가 앞선 B의 답이다');
  assert.equal(now.rows[0].verdict, 'incorrect');
});
