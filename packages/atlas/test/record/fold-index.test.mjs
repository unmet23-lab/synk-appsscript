// 단계 1 색인 잇기(단계 3 · 11-11) — openMap(...).foldIndex(= { edition: 'index-<태그 판>', lookup(itemKey), familySkills })를
// 서버 접기와 기기 기록부에 그대로 넘긴다. 실제 지도(map/index.json)로: 접기는 색인의 단위를 읽고(사건에 적힌 단위가 아니다),
// 판 묶음에 태그 판이 들고, 기기 얹기는 계열 → 능력(familySkills)을 색인에서 받아 요약 · 든 제시가 모르는 능력 줄도 기다린다.
// 태그 판이 오르면(단계 1이 태그를 더 붙이면) 서버는 옆에 다시 짓고, 앞 판 기기는 얹지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { createClient, createServer, memory, PARAMS } from '../support/trail-sync.mjs';
import { rng } from '../support/trail-world.mjs';

const { openMap } = await subject('map/index.mjs');
const { foldEdition } = await subject('record/server.mjs');
const { groupsOf } = await subject('record/adapt.mjs');
const { linesOfGroups } = await subject('record/rows.mjs');
const { viewOf } = await subject('record/summary.mjs');
const { entryOf } = await subject('record/server.mjs');

const raw = JSON.parse(fs.readFileSync(new URL('../../map/index.json', import.meta.url), 'utf8'));
const map = openMap({ index: raw });

// 능력이 둘 넘는 계열과, 그 계열에서 능력이 서로 다른 문항 둘(단위가 있는 것).
function pickFamily() {
  for (const [family, skills] of map.familySkills) {
    if (skills.length < 2) continue;
    const items = map
      .items()
      .filter(item => item.familyKey === family && !item.units[0].startsWith('family:'));
    const a = items.find(item => item.skillId === skills[0]);
    const b = items.find(item => item.skillId === skills[1]);
    if (a && b) return { family, skills, a, b };
  }
  throw new Error('능력이 둘인 계열이 지도에 없다');
}
const { family, skills, a, b } = pickFamily();

const presented = (item, overrides = {}) => ({
  setId: 'set1',
  itemKey: item.itemKey,
  familyKey: item.familyKey,
  skillId: item.skillId,
  difficulty: item.difficulty,
  responseFormat: item.responseFormat,
  modality: 'reading',
  audioRequired: false,
  confounded: false,
  units: [...item.units],
  firstExposure: true,
  editions: { ...PARAMS.editions, index: map.editions.index },
  expected: { floor: 0.25, memory: 0.5, skill: 0.6 },
  arm: 'adaptive',
  reason: { code: 'unit.new', slots: {}, evidence: {}, target: null, tier: 2, introduced: [] },
  ...overrides,
});
const answer = presentationId => ({
  presentationId,
  attemptNo: 1,
  verdict: 'correct',
  errorTags: [],
});

test('foldIndex는 단계 1 지도의 판 · 문항 · 계열 → 능력을 그대로 든다', () => {
  assert.equal(map.foldIndex.edition, map.editions.index);
  assert.match(map.foldIndex.edition, /^index-\d+$/);
  assert.deepEqual(map.foldIndex.lookup(a.itemKey), map.item(a.itemKey));
  assert.equal(map.foldIndex.familySkills, map.familySkills);
  assert.equal(
    foldEdition(PARAMS, map.foldIndex).split('+')[3],
    map.editions.index,
    '판 묶음에 태그 판이 든다',
  );
});

test('서버 접기는 색인의 단위를 읽는다 — 사건에 적힌 단위가 틀려도 · 태그 판이 오르면 옆에 다시 짓는다', async () => {
  const server = createServer({ random: rng(11), index: map.foldIndex });
  const phone = await createClient(server, { name: 'phone' });
  const shown = phone.device.make(
    'practice.presented',
    presented(a, { units: ['ko.word.fake0000'] }),
  );
  phone.device.make('practice.attempted', answer(shown.id));
  await phone.push();
  const summary = await server.summary(null);
  assert.equal(summary.edition, foldEdition(PARAMS, map.foldIndex));
  const unitKeys = summary.lines.filter(line => line.kind === 'unit').map(line => line.key);
  assert.deepEqual(
    unitKeys.sort(),
    [...a.units].sort(),
    '색인의 단위만 — 사건에 적힌 단위는 접기에 안 든다',
  );

  // 태그 판이 오른 지도(같은 문항의 단위가 바뀜) — 판 묶음이 달라 옆에 짓고 바꿔 끼운다. 기준은 같은 사건을 새 색인으로 처음부터 접은 줄.
  const bumped = {
    edition: `index-${Number(map.editions.index.slice(6)) + 1}`,
    lookup: key =>
      key === a.itemKey ? { ...map.item(key), units: ['ko.word.new9999'] } : map.item(key),
    familySkills: map.familySkills,
  };
  server.index = bumped;
  await server.fold();
  const after = await server.summary(null);
  assert.equal(after.edition, foldEdition(PARAMS, bumped));
  const want = linesOfGroups(groupsOf(server.server.log().map(entryOf)), {
    memory,
    params: PARAMS,
    index: bumped,
  });
  assert.deepEqual(
    after.lines.filter(line => line.kind === 'unit').map(line => line.key),
    [...want.unit.keys()],
  );
  assert.deepEqual([...want.unit.keys()], ['ko.word.new9999']);
  // 앞 판 색인을 든 기기는 새 판 요약에 얹지 않는다(요약 값만 — 판이 섞이지 않게).
  await phone.pull();
  assert.equal(phone.record.summary.edition, foldEdition(PARAMS, bumped));
  // 아직 안 접힌 내 답(다른 문항)을 둔다 — 얹을 것이 있어야 「얹지 않는다」를 잴 수 있다(아르곤 끝 판 F2).
  const next = phone.device.make('practice.presented', presented(b));
  phone.device.make('practice.attempted', answer(next.id));
  await phone.settle();
  const view = phone.record.view();
  const base = viewOf(phone.record.summary);
  assert.equal(view.waitAll, true, '판 묶음이 다른 요약에는 내 사건을 얹지 않는다');
  assert.deepEqual(view.memory, base.memory, '요약 값만 — 안 접힌 답의 단위가 얹히지 않는다');
  assert.deepEqual(view.ability, base.ability);
  assert.ok(view.memory.has('ko.word.new9999'), '요약 값(새 판의 단위)은 그대로 보인다');
});

test('기기 얹기는 계열 → 능력을 색인에서 받는다 — 요약 · 든 제시가 모르는 능력 줄도 기다린다(openMap 꼴 색인)', async () => {
  for (const [label, index] of [
    ['openMap foldIndex', map.foldIndex],
    // 같은 판 · 같은 문항 찾기이되 계열 → 능력이 빠진 색인(단계 1이 familySkills를 더하기 전의 꼴).
    ['familySkills 없는 색인', { edition: map.foldIndex.edition, lookup: map.foldIndex.lookup }],
  ]) {
    const server = createServer({ random: rng(21), index: map.foldIndex });
    // 다른 기기가 계열의 둘째 능력 문항을 먼저 맞혀 서버가 접었다 — 요약의 계열 줄은 그 능력만 안다.
    const laptop = await createClient(server, { name: 'laptop' });
    const seen = laptop.device.make('practice.presented', presented(b));
    laptop.device.make('practice.attempted', answer(seen.id));
    await laptop.push();
    // 이 기기는 옛 기록에서 그 계열을 옮겨 온다(처음 옮기는 장부 — 어떤 만남보다 먼저). 첫 만남이 장부 쪽으로 바뀌므로
    // 그 계열에 서는 능력 줄을 모두 기다려야 한다 — 어느 능력인지는 색인의 familySkills가 안다.
    const phone = await createClient(server, { name: 'phone', index });
    phone.device.make('record.carried', { families: { [family]: 1 }, items: {}, after: null });
    await phone.settle();
    const base = phone.record.summary;
    assert.deepEqual(
      base.lines.family.get(family).skills ?? [],
      [b.skillId],
      `${label}: 요약의 계열 줄은 둘째 능력만 안다`,
    );
    const view = phone.record.view();
    assert.ok(view.waitSkills.has(b.skillId), `${label}: 요약이 아는 능력은 기다린다`);
    if (index === map.foldIndex) {
      for (const skill of skills)
        assert.ok(view.waitSkills.has(skill), `${label}: 색인이 아는 능력 ${skill}도 기다린다`);
    } else {
      assert.equal(
        view.waitSkills.has(a.skillId),
        false,
        `${label}: 색인이 없으면 첫째 능력은 모른다`,
      );
    }
  }
});
