// 능력 판 이름을 ability-2로 올린 뜻(단계 4 계획 §21-22 — 설계 주인 답 2). 능력 줄에 peak을 접게 되어 판 이름을 올린다. 판 묶음
// (foldEdition)이 바뀌어 서버 머리가 옆에 다시 접히고, 다시 접은 능력 줄의 theta · n · streak · level은 그대로이며 peak이 선다.
// 옛 길(SYNK-talk lib/atlas/*)은 params.editions.ability를 읽지 않는다 — 이 판 이름을 읽는 곳은 params.mjs와 foldEdition, 제시 사건의
// editions 칸뿐이다(커밋 글에 적는다).
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { createMemoryAccount, T0 } from '../support/trail-world.mjs';

const { createEvent, eventId } = await subject('record/events.mjs');
const { foldAccount, foldEdition } = await subject('record/server.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { PARAMS } = await subject('params.mjs');

const memory = createMemory(PARAMS);
const NOW = T0 + 1e9;

test('능력 판 이름은 ability-2다 — 판 묶음(foldEdition)에 들어 서버 머리와 손님 요약을 다시 접는다', () => {
  assert.equal(PARAMS.editions.ability, 'ability-2');
  assert.ok(foldEdition(PARAMS, undefined).split('+').includes('ability-2'));
});

// 측정 답 열여덟 — 두 능력 · 난도 1 ~ 3, 다섯째마다 놓침(streak이 끊겼다 다시 선다).
function measuredEvents() {
  let n = 0;
  const make = (type, fields) => {
    n += 1;
    const atMs = T0 + n * 60_000;
    return createEvent(type, fields, { id: eventId(atMs, n, 'ability2'), atMs, revision: 1 });
  };
  const skills = ['ko.listening.detail', 'ko.reading.detail'];
  const events = [];
  for (let i = 0; i < 18; i += 1) {
    const unit = `u${i}`;
    const shown = make('practice.presented', {
      setId: 'set1',
      itemKey: `it${i}`,
      familyKey: `fam${i}`,
      skillId: skills[i % 2],
      difficulty: 1 + (i % 3),
      responseFormat: 'single-choice',
      units: [unit],
      modality: 'listening',
      audioRequired: false,
      confounded: false,
      firstExposure: true,
      editions: { ...PARAMS.editions, ability: 'ability-1', index: 'index-0' },
      expected: { floor: 0.25, memory: 1, skill: 0.6 },
      arm: 'adaptive',
      reason: {
        code: 'unit.new',
        slots: {},
        evidence: {},
        target: unit,
        tier: 2,
        introduced: [unit],
      },
    });
    const verdict = i % 5 === 4 ? 'incorrect' : 'correct';
    events.push(
      shown,
      make('practice.attempted', {
        presentationId: shown.id,
        attemptNo: 1,
        verdict,
        errorTags: [],
      }),
    );
  }
  return events;
}

async function foldUntilServed(server, params) {
  let result = null;
  for (let guard = 0; guard < 100; guard += 1) {
    result = await foldAccount(server.account, { memory, params, nowMs: NOW });
    if (result.done && !result.building) return result;
  }
  return result;
}

const skillLinesOf = (server, edition) =>
  new Map(
    [...server.heads.get(edition).lines.values()]
      .filter(line => line.kind === 'skill' && line.value)
      .map(line => [line.key, line.value]),
  );

function assertSameAbility(before, after) {
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
  for (const [skill, value] of after) {
    const was = before.get(skill);
    for (const field of ['theta', 'n', 'streak', 'level'])
      assert.deepEqual(value[field], was[field], `${skill} ${field}`);
    assert.ok(Object.hasOwn(value, 'peak'), `${skill} — peak 칸이 섰다`);
    if (value.streak > 0)
      assert.ok(Number.isFinite(value.peak), `${skill} — streak 안의 가장 높은 난도`);
  }
}

test('ability-1 머리(peak 없는 옛 줄)는 다시 접혀 theta · n · streak · level이 같고 peak이 선다', async () => {
  const server = createMemoryAccount();
  server.append(measuredEvents(), T0 + 2e6);
  const old = { ...PARAMS, editions: { ...PARAMS.editions, ability: 'ability-1' } };
  const oldEdition = foldEdition(old, undefined);
  const newEdition = foldEdition(PARAMS, undefined);
  assert.notEqual(oldEdition, newEdition);
  await foldUntilServed(server, old);
  // ability-1 때의 줄 — peak 칸이 없던 때처럼 지운다.
  for (const value of skillLinesOf(server, oldEdition).values()) delete value.peak;
  const before = skillLinesOf(server, oldEdition);
  assert.ok(before.size >= 2, '능력 줄이 섰다');
  const result = await foldUntilServed(server, PARAMS);
  assert.equal(result.served, newEdition, '옆에 다시 접어 바꿔 끼웠다');
  assert.equal(server.heads.has(oldEdition), false, '옛 판 머리는 지웠다');
  assertSameAbility(before, skillLinesOf(server, newEdition));
});
