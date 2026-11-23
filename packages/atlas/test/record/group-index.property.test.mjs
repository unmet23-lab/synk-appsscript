// 대조 시험 1(기기 답 저장 빠르게 하기 설계 2-5, 11-23) — 묶음 색인(src/record/groups.mjs)이 걸음마다 처음부터 지은 값과 같다.
//   묶음 = groupsOf(지금 든 것)(자식 · 제외의 배열 차례까지), 근거 줄 = rowsOfGroup, 자른 묶음의 근거 줄 = groupsOf(열쇠 ≤ until)의 근거 줄.
//   코치에 내주는 묶음 = 포트 열쇠 차례로 지은 groupsOf, 계열 모음 = 앞 코치 거르기, 계열 → 능력 표 = familySkillsOf(든 사건),
//   닿는 줄 메모 = 묶음 전부로 잰 touchesOf. 근거 줄이 바뀐 묶음은 모두 「닿은 묶음」에 든다(손님 접기 ③이 그것만 다시 접는다 — 검토 D1).
// 넣는 차례는 무작위로 섞는다(부모보다 자식 먼저 · 다른 탭 차례). 같은 번호 두 열쇠(R10), 치우기, 통째로 다시 읽기, 지도 더하기를 섞는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createHeld,
  entryOf,
  eventPool,
  heldSkillsOf,
  jitter,
  mutableIndex,
} from '../support/held-world.mjs';
import { pick, rng, seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';

const { createGroupIndex } = await subject('record/groups.mjs');
const { groupsOf, itemOf, deviceKey } = await subject('record/adapt.mjs');
const { rowsOfGroup } = await subject('record/rows.mjs');
const { familySkillsOf, touchesOf } = await subject('record/own.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');

const editionOf = index => () => `p+m+a+${index.edition}+r`;

function world(seed) {
  const random = rng(seed);
  const { items, events } = eventPool(random, { steps: 20 + Math.floor(random() * 40) });
  const index = mutableIndex(items, random);
  const groups = createGroupIndex(index, editionOf(index));
  const held = createHeld(groups);
  // 포트 열쇠 — 만든 차례를 따로 흐트린다(10씩 띄워 같은 번호의 더 작은 열쇠를 끼울 자리를 둔다).
  const keys = new Map(
    jitter(random, events, 1 + random() * 30).map((event, i) => [event.id, (i + 1) * 10]),
  );
  return { random, index, groups, held, keys, order: jitter(random, events, 1 + random() * 12) };
}

const memberships = want => {
  const of = new Map();
  for (const [id, group] of want)
    for (const entry of [group.source, ...group.children, ...group.exclusions]) {
      if (!of.has(entry.event.id)) of.set(entry.event.id, new Set());
      of.get(entry.event.id).add(id);
    }
  return of;
};

function checkGroups(w, want, label) {
  assert.deepEqual(w.groups.all(), want, `${label}: 묶음(자식 · 제외 차례까지)`);
  const of = memberships(want);
  for (const id of w.held.held.keys())
    assert.deepEqual(
      w.groups.sourcesOf(id) ?? new Set(),
      of.get(id) ?? new Set(),
      `${label}: ${id}의 묶음`,
    );
  for (const [id, group] of want)
    assert.deepEqual(w.groups.rows(id), rowsOfGroup(group, w.index), `${label}: ${id} 근거 줄`);
}

function checkCut(w, label) {
  const until = Math.floor(w.random() * (w.held.maxKey() + 10));
  const want = w.held.groupsAt(until);
  for (const id of w.groups.all().keys()) {
    const group = want.get(id);
    assert.deepEqual(
      w.groups.rowsAt(id, until).rows,
      group ? rowsOfGroup(group, w.index) : [],
      `${label}: ${id} until ${until}`,
    );
  }
  assert.deepEqual(
    w.groups.rowsUntil(until),
    [...want.values()].flatMap(group => rowsOfGroup(group, w.index)),
    `${label}: 열쇠 ≤ ${until}의 근거 줄 전부`,
  );
}

// 앞 코치 길 — heldEvents()의 포트 열쇠 차례로 groupsOf를 짓고 계열로 거른다(coach/record.mjs의 앞 판).
function checkCoach(w, want, label) {
  const keyed = groupsOf(w.held.byKey());
  assert.deepEqual(w.groups.keyedGroups(), keyed, `${label}: 코치에 내주는 묶음(포트 열쇠 차례)`);
  for (const id of keyed.keys()) assert.deepEqual(w.groups.keyedGroup(id), keyed.get(id));
  const families = new Set(['fam0', 'fam1', 'fam2', 'fam3', 'fam4', 'missing']);
  for (const family of families) {
    const old = [...want]
      .filter(([, group]) => {
        const event = group.source.event;
        if (event.type === EVENT_TYPES.carried) return true;
        return event.type === EVENT_TYPES.presented && itemOf(event, w.index)?.familyKey === family;
      })
      .map(([id]) => [id, keyed.get(id)]);
    assert.deepEqual(w.groups.familyGroups(family), old, `${label}: 계열 ${family}의 묶음`);
  }
}

function checkSkills(w, label) {
  const events = [...w.held.held.values()].map(item => item.event);
  const summaries = [
    null,
    {
      lines: {
        family: new Map([
          ['fam1', { skills: ['ko.zzz'] }],
          ['famX', { skills: [] }],
        ]),
      },
    },
  ];
  const summary = pick(w.random, summaries);
  assert.deepEqual(
    w.groups.familySkills(summary),
    familySkillsOf(summary, w.index, heldSkillsOf(events)),
    `${label}: 계열 → 능력`,
  );
}

function checkTouches(w, want, label) {
  const ids = [...w.held.held.keys()];
  for (const id of [pick(w.random, ids), pick(w.random, ids), 'missing'])
    assert.deepEqual(
      touchesOf(w.groups.touching(id), id, w.index),
      touchesOf(want.values(), id, w.index),
      `${label}: ${id}의 닿는 줄`,
    );
}

// 근거 줄이 바뀐(또는 새로 선) 묶음은 모두 닿은 묶음에 든다 — 지도가 바뀐 걸음은 손님 접기가 처음부터 짓는다(stamp).
function checkTouched(w, before, want, stamp, label) {
  const touched = w.groups.drainTouched();
  if (stamp !== w.groups.stamp()) return;
  for (const [id, group] of want) {
    const rows = rowsOfGroup(group, w.index);
    if (!before.has(id) || JSON.stringify(before.get(id)) !== JSON.stringify(rows))
      assert.ok(touched.has(id), `${label}: 근거 줄이 바뀐 ${id}가 닿은 묶음에 없다`);
  }
}

function snapshot(w) {
  return new Map(
    [...w.held.groupsAt(Number.POSITIVE_INFINITY)].map(([id, g]) => [id, rowsOfGroup(g, w.index)]),
  );
}

function step(w, event) {
  const roll = w.random();
  w.held.take(event, w.keys.get(event.id));
  // 같은 번호가 더 작은 열쇠로 다시 선다(R10 — 두 탭이 겹쳐 옮긴 기록)
  if (roll < 0.08) w.held.take(event, w.keys.get(event.id) - 5);
  else if (roll < 0.1) w.index.addMap();
  else if (roll < 0.11) w.index.edition = 'index-b';
  else if (roll < 0.13) w.held.reload();
  else if (roll < 0.15) {
    const ids = [...w.held.held.keys()];
    w.held.drop(ids.filter(() => w.random() < 0.15));
  }
}

async function run(seed) {
  const w = world(seed);
  w.groups.drainTouched();
  let before = new Map();
  let stamp = w.groups.stamp();
  w.order.forEach((event, i) => {
    step(w, event);
    const label = `씨앗 ${seed} 걸음 ${i}`;
    const want = groupsOf(w.held.entries());
    checkGroups(w, want, label);
    checkTouched(w, before, want, stamp, label);
    before = snapshot(w);
    stamp = w.groups.stamp();
    checkCut(w, label);
    if (w.random() < 0.3 || i === w.order.length - 1) {
      checkCut(w, label);
      checkCoach(w, want, label);
      checkSkills(w, label);
      checkTouches(w, want, label);
    }
  });
}

test('대조 1 — 묶음 색인은 넣는 차례 · 같은 번호 두 열쇠 · 치우기 · 다시 읽기 · 지도 더하기를 섞어도 걸음마다 처음부터 지은 묶음 · 근거 줄 · 자른 근거 줄 · 코치 묶음 · 계열 → 능력 · 닿는 줄과 같다', async () => {
  for (const seed of seedRange({ count: 60 })) await run(seed);
});

// 고정 장면 — 검토 D1 · D3(11-23). 옛 꼴 판 결정 D가 그 제시 P · 답 · D를 겨눈 제외 E보다 늦게 들면 E는 그때 P 묶음에 붙고, P가 닿은 묶음이다.
// 제외 E(답 A를 겨눔) → A → 제시 P 차례로 들면 E는 P를 기다렸다가 붙는다.
const legacy = (id, m, type, fields) => {
  const at = new Date(Date.parse('2026-11-01T00:00:00.000Z') + m * 60_000).toISOString();
  return { schema: 1, id, scope: { domain: 'LAB' }, at, recordedAt: at, type, ...fields };
};
const measure = {
  skillId: 'ko.listening.detail',
  modality: 'listening',
  difficulty: 1,
  familyKey: 'fam0',
  audioRequired: false,
  confounded: false,
  responseFormat: 'single-choice',
};
const D = legacy('d1', 0, 'decision.made', {
  experienceId: 'game',
  variant: 'v',
  policy: 'x',
  evidence: [],
});
const P = legacy('p1', 1, 'practice.presented', {
  decisionId: 'd1',
  itemKey: 'old-item',
  firstExposure: true,
  measure,
});
const A = legacy('a1', 2, 'practice.attempted', {
  presentationId: 'p1',
  attemptNo: 1,
  verdict: 'correct',
  errorTags: [],
});
const plainIndex = { edition: 'index-a', lookup: () => null };

test('대조 1 고정 — 옛 꼴 판 결정이 제시 · 답 · 그 결정을 겨눈 제외보다 늦게 들어도 제외가 그 제시 묶음에 붙고, 그 묶음은 닿은 묶음이다(검토 D1)', () => {
  const E = legacy('e1', 3, 'record.excluded', { targetId: 'd1' });
  const groups = createGroupIndex(plainIndex, () => 'ed');
  const held = createHeld(groups);
  for (const [event, key] of [
    [P, 2],
    [A, 3],
    [E, 4],
  ])
    held.take(event, key);
  const folded = groups.rows('p1');
  const graded = rows => rows.some(row => row.kind === 'meet' && row.grade != null);
  assert.equal(graded(folded), true, '결정이 들기 전에는 답이 판정된 만남이다');
  groups.drainTouched();
  held.take(D, 1);
  assert.deepEqual(groups.all(), groupsOf(held.entries()));
  assert.deepEqual(
    groups.get('p1').exclusions.map(e => e.event.id),
    ['e1'],
  );
  assert.equal(
    groups.drainTouched().has('p1'),
    true,
    '결정이 들어 제외가 붙은 제시가 닿은 묶음이다',
  );
  assert.deepEqual(groups.rows('p1'), rowsOfGroup(groupsOf(held.entries()).get('p1'), plainIndex));
  assert.equal(graded(groups.rows('p1')), false, '결정을 겨눈 제외가 그 답을 거뒀다');
  assert.equal(
    groups.rowsAt('p1', 3).cut,
    true,
    '결정 열쇠(1)는 작지만 제외(4)가 until 3 뒤라 자른다',
  );
});

test('대조 1 고정 — 옛 꼴 판 결정이 제시 · 답 · 제외보다 뒤 열쇠면, 그 사이까지 접을 때 제외는 아직 그 묶음에 들지 않는다(hot은 결정 열쇠까지)', () => {
  const E = legacy('e1', 3, 'record.excluded', { targetId: 'd1' });
  const groups = createGroupIndex(plainIndex, () => 'ed');
  const held = createHeld(groups);
  for (const [event, key] of [
    [P, 2],
    [A, 3],
    [E, 4],
    [D, 9],
  ])
    held.take(event, key);
  const cut = groups.rowsAt('p1', 5);
  assert.equal(cut.cut, true);
  assert.deepEqual(cut.rows, rowsOfGroup(held.groupsAt(5).get('p1'), plainIndex));
  assert.notDeepEqual(cut.rows, groups.rows('p1'), '열쇠 5까지는 결정이 없어 답이 거둬지지 않았다');
});

// 제외 둘이 한 묶음에 드는 차례 — 먼저 든 제외 X1은 겨눈 답을 기다리고, 뒤에 든 X2는 바로 붙는다. 묶음의 제외는 든 차례(X1, X2)다.
test('대조 1 고정 — 기다렸다 붙는 제외도 묶음 안에서는 든 차례에 선다(groupsOf와 같은 배열 차례)', () => {
  const X1 = legacy('x1', 4, 'record.excluded', { targetId: 'a1' });
  const X2 = legacy('x2', 5, 'record.excluded', { targetId: 'p1' });
  const groups = createGroupIndex(plainIndex, () => 'ed');
  const held = createHeld(groups);
  for (const [event, key] of [
    [D, 1],
    [P, 2],
    [X1, 6],
    [X2, 7],
    [A, 3],
  ])
    held.take(event, key);
  assert.deepEqual(
    groups.get('p1').exclusions.map(e => e.event.id),
    ['x1', 'x2'],
  );
  assert.deepEqual(groups.all(), groupsOf(held.entries()));
});

test('대조 1 고정 — 제외 E(답 A를 겨눔) → A → 제시 P 차례로 들면 E는 P를 기다렸다가 붙는다(검토 D3)', () => {
  const E = legacy('e2', 3, 'record.excluded', { targetId: 'a1' });
  const groups = createGroupIndex(plainIndex, () => 'ed');
  const held = createHeld(groups);
  for (const [event, key] of [
    [E, 4],
    [A, 3],
    [D, 1],
    [P, 2],
  ])
    held.take(event, key);
  const want = groupsOf(held.entries());
  assert.deepEqual(groups.all(), want);
  assert.deepEqual(
    want.get('p1').exclusions.map(e => e.event.id),
    ['e2'],
  );
  // 든 차례는 E, A, D, P — 코치에는 포트 열쇠 차례로
  assert.deepEqual(groups.keyedGroups(), groupsOf(held.byKey()));
  assert.equal(deviceKey(2, P).endsWith('l000000002'), true);
  assert.equal(entryOf(held.held.get('p1')).key, deviceKey(4, P), '옛 꼴 기록 열쇠는 든 차례');
});
