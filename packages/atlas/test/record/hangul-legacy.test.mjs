// 옛 한글 기록 다시 접기(4-7 — 단계4_계획 §26-6). 한글 만나기의 옛 꼴 사건은 문항 열쇠가 판마다 새 해시라 색인에 없다. 접기 어댑터는
// 열쇠로 못 찾은 옛 꼴 제시를 measure의 계열로 계열 줄에서 다시 찾아 그 줄의 단위(ko.hangul.<글자>)와 지금 계열 이름을 쓴다. 능력 · 난도 · 꼴은 사건 값이고
// levels는 보지 않는다(levels 밖 null 길을 타지 않게). 서버 색인(openMap(...).foldIndex.family)과 기기 묶은 색인(test/coach 쪽) 모두다.
// 계열 줄이 없는 낱말 읽기는 계열 단위 그대로이고(§26-2), 색인에 있는 옛 꼴 · 2판 사건은 바뀌지 않는다. 다시 접게 하는 값은 RECORD_EDITION
// record-5다 — 손님 기기는 판 묶음이 다른 요약을 받지 않고 든 사건으로 다시 접는다. 홈이 늘 받는 조각(world-life)에 한글 계열 줄이 실려
// 그때 묶은 색인이 그 줄을 안다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { subject, subjectTool } from '../support/subject.mjs';
import { memory, PARAMS } from '../support/trail-sync.mjs';

const { openMap } = await subject('map/index.mjs');
const { groupsOf, itemOf } = await subject('record/adapt.mjs');
const { linesOfGroups } = await subject('record/rows.mjs');
const { foldEdition, RECORD_EDITION } = await subject('record/server.mjs');
const { openRecord } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { sliceOf } = await subjectTool('map-ship.mjs');

// 지도 자료는 시험 대상(src)이 아니라 패키지의 생성물이다.
const read = name =>
  JSON.parse(fs.readFileSync(new URL(`../../map/${name}`, import.meta.url), 'utf8'));
const index = read('index.json');
const words = read('words.json');
const T0 = Date.UTC(2026, 10, 1, 3);

const legacy = (id, m, type, fields) => {
  const at = new Date(T0 + m * 60_000).toISOString();
  return { schema: 1, id, scope: { domain: 'LAB' }, at, recordedAt: at, type, ...fields };
};
// 한글 만나기 learning.mjs itemMetadata가 남긴 꼴 — 열쇠 끝(글 · 보기 해시)은 판마다 다르다.
const hangul = (n, type, letter, difficulty, responseFormat) => [
  legacy(`p${n}`, n, 'practice.presented', {
    itemKey: `hangul-stage.${type}.${letter}.h${n}.o${n}`,
    firstExposure: true,
    measure: {
      skillId: type === 'see_pick' ? 'ko.hangul.read' : 'ko.hangul.sound',
      modality: type === 'see_pick' ? 'reading' : 'listening',
      difficulty,
      familyKey: `hangul-stage.${type}.${letter}`,
      audioRequired: type !== 'see_pick',
      confounded: false,
      responseFormat,
    },
  }),
  legacy(`d${n}`, n, 'practice.delivery', { presentationId: `p${n}`, audio: 'completed' }),
  legacy(`a${n}`, n, 'practice.attempted', {
    presentationId: `p${n}`,
    attemptNo: 1,
    verdict: 'correct',
    errorTags: [],
  }),
];
const OLD = [
  ...hangul(1, 'listen_pick', 'v-a', 1, 'binary-choice'),
  ...hangul(2, 'see_pick', 'v-a', 3, 'single-choice'),
  ...hangul(3, 'match', 'c-g', 2, 'single-choice'),
  // levels 밖 난도여도(짝 맞추기는 1 · 2) 옛 답은 글자 단위로 접힌다 — 다시 찾기는 levels를 보지 않는다.
  ...hangul(4, 'match', 'c-n', 3, 'single-choice'),
  // 낱말 읽기(계열 줄 없음) — 계열 단위 그대로.
  ...hangul(5, 'listen_pick', 'w1a2b3', 1, 'binary-choice'),
];
const presentedOf = n => OLD.find(event => event.id === `p${n}`);
const entriesOf = events =>
  events.map((event, i) => ({
    event,
    key: `a.${String(Date.parse(event.at)).padStart(13, '0')}.l${String(i).padStart(9, '0')}`,
    atMs: Date.parse(event.at),
  }));
const unitKeys = lines => [...lines.unit.keys()].sort();
const LETTERS = ['ko.hangul.c-g', 'ko.hangul.c-n', 'ko.hangul.v-a'];
// 고친 뒤: 글자 셋 + 계열 줄이 없는 낱말 읽기의 계열 단위.
const FIXED = ['family:hangul-stage.listen_pick.w1a2b3', ...LETTERS];
// 고치기 전: 같은 글자도 꼴마다 다른 계열 단위였다(4-7 §26-6 재현).
const BROKEN = [
  'family:hangul-stage.listen_pick.v-a',
  'family:hangul-stage.listen_pick.w1a2b3',
  'family:hangul-stage.match.c-g',
  'family:hangul-stage.match.c-n',
  'family:hangul-stage.see_pick.v-a',
];
// 다시 찾기가 없던 색인(고치기 전 꼴) — 같은 판 · 같은 문항 찾기.
const withoutFamily = given => ({
  edition: given.edition,
  lookup: given.lookup,
  familySkills: given.familySkills,
});

test('옛 꼴 한글 답은 계열 줄의 글자 단위로 접힌다 — 서버 색인(foldIndex.family), 낱말 읽기는 계열 단위(4-7 §26-6)', () => {
  const map = openMap({ index });
  const lines = linesOfGroups(groupsOf(entriesOf(OLD)), {
    memory,
    params: PARAMS,
    index: map.foldIndex,
  });
  assert.deepEqual(unitKeys(lines), FIXED, '글자 단위 셋 — 낱말 읽기는 계열 단위 그대로');
  assert.equal(itemOf(presentedOf(5), map.foldIndex).units, undefined, '낱말 읽기는 단위가 없다');
  const seen = itemOf(presentedOf(2), map.foldIndex);
  assert.deepEqual(
    [seen.familyKey, seen.skillId, seen.difficulty, seen.responseFormat, seen.units],
    ['hangul-stage.see_pick.v-a', 'ko.hangul.read', 3, 'single-choice', ['ko.hangul.v-a']],
    '단위는 계열 줄, 능력 · 난도 · 꼴은 사건 값',
  );
  // 능력은 사건에 적힌 값이다 — 계열 줄의 능력과 달라도 바꾸지 않는다(4-7 엔진 검수 GA2 · GA4).
  const odd = itemOf(
    { ...presentedOf(1), measure: { ...presentedOf(1).measure, skillId: 'ko.hangul.read' } },
    map.foldIndex,
  );
  assert.deepEqual([odd.skillId, odd.units], ['ko.hangul.read', ['ko.hangul.v-a']]);
  // 단위가 비어 있는 계열 줄(드라마 시범)의 옛 사건은 능력도 단위도 이 고침 전과 같다.
  assert.equal(
    map.foldIndex.family('s1e01-6').units.length,
    0,
    '드라마 시범 계열 줄은 단위가 비어 있다',
  );
  const drama = itemOf(
    {
      ...presentedOf(1),
      itemKey: 'nobody.drama',
      measure: { ...presentedOf(1).measure, familyKey: 's1e01-6', skillId: 'ko.speaking.ask' },
    },
    map.foldIndex,
  );
  assert.deepEqual([drama.skillId, drama.units], ['ko.speaking.ask', undefined]);
  // 고치기 전 꼴(다시 찾기 없음)은 꼴마다 계열 단위였다 — 이 시험이 고침을 본다.
  const before = linesOfGroups(groupsOf(entriesOf(OLD)), {
    memory,
    params: PARAMS,
    index: withoutFamily(map.foldIndex),
  });
  assert.deepEqual(unitKeys(before), BROKEN);
});

test('색인에 있는 옛 꼴 · 계열 줄이 없는 옛 꼴 · 2판 사건은 다시 찾기로 바뀌지 않는다', () => {
  const map = openMap({ index });
  const [item] = map.items('topik-items');
  const measure = {
    skillId: item.skillId,
    modality: 'reading',
    difficulty: item.difficulty,
    familyKey: item.familyKey,
    audioRequired: false,
    confounded: false,
    responseFormat: item.responseFormat,
  };
  const indexed = legacy('p9', 9, 'practice.presented', {
    itemKey: item.itemKey,
    firstExposure: true,
    measure,
  });
  assert.deepEqual(
    itemOf(indexed, map.foldIndex).units,
    [...item.units],
    '색인에 있는 옛 꼴은 색인 그대로',
  );
  const loose = legacy('p10', 10, 'practice.presented', {
    itemKey: 'nobody.x',
    firstExposure: true,
    measure: { ...measure, familyKey: 'nobody' },
  });
  assert.equal(
    itemOf(loose, map.foldIndex).units,
    undefined,
    '계열 줄도 없는 옛 꼴은 계열 단위 그대로',
  );
  const current = {
    schema: 2,
    id: 'c1',
    type: 'practice.presented',
    at: new Date(T0).toISOString(),
    itemKey: 'hangul-stage.listen_pick.v-a.zz',
    familyKey: 'hangul-stage.listen_pick.v-a',
    skillId: 'ko.hangul.sound',
    difficulty: 1,
    responseFormat: 'binary-choice',
    units: ['ko.hangul.v-a'],
  };
  assert.deepEqual(itemOf(current, map.foldIndex).units, ['ko.hangul.v-a'], '2판은 적힌 단위');
  assert.deepEqual(
    itemOf({ ...current, units: [] }, map.foldIndex).units,
    undefined,
    '2판은 다시 찾지 않는다 — 단위를 비운 2판 제시는 계열 단위 그대로',
  );
  // 이름이 바뀐 계열의 옛 꼴은 계열 줄의 지금 이름으로 접힌다 — 색인에 있는 문항처럼 기기의 계열 묶음 찾기(groups familyGroups)가
  // 지금 이름으로 묻는다. 옛 이름 따라가기는 색인(familyRow)이 한다(test/unit/map/compose.test.mjs).
  const renamed = {
    lookup: () => null,
    family: key =>
      key === 'hangul-stage.pair.v-a'
        ? { familyKey: 'hangul-stage.match.v-a', units: ['ko.hangul.v-a'] }
        : null,
  };
  const old = itemOf(
    {
      ...presentedOf(1),
      measure: { ...presentedOf(1).measure, familyKey: 'hangul-stage.pair.v-a' },
    },
    renamed,
  );
  assert.deepEqual([old.familyKey, old.units], ['hangul-stage.match.v-a', ['ko.hangul.v-a']]);
});

test('판 묶음에 record-5가 들고, 손님 기기는 판 묶음이 다른 요약을 받지 않고 홈 조각의 한글 계열 줄로 다시 접는다(4-7 §26-6)', async () => {
  assert.equal(RECORD_EDITION, 'record-5');
  const home = openMap({ index: [sliceOf(index, 'world-life', words)] });
  assert.ok(
    home.foldIndex.family('hangul-stage.listen_pick.v-a'),
    '홈이 늘 받는 조각에 한글 계열 줄이 있다',
  );
  const edition = foldEdition(PARAMS, home.foldIndex);
  assert.ok(edition.includes('record-5'));
  const clock = { now: T0 + 3_600_000 };
  const open = (port, given, tag) =>
    openRecord({
      port,
      guest: true,
      memory,
      params: PARAMS,
      index: given,
      now: () => clock.now,
      tag,
    });

  // 고치기 전 판이 옮겨 접어 둔 손님 저장소 — 다시 찾기가 없어 꼴마다 계열 단위였고, 요약은 그 판(record-4)의 묶음 이름으로 남았다.
  const first = memoryPort();
  const old = await open(first, withoutFamily(home.foldIndex), 'oldxxxxx');
  await old.importLegacy(OLD);
  await old.localSaved();
  assert.deepEqual(unitKeys(old.summary.lines), BROKEN, '고치기 전 꼴은 꼴마다 계열 단위였다');
  const rows = await first.read();
  const local = rows.find(row => row.value.kind === 'local');
  assert.ok(local, '접어 둔 손님 요약이 저장소에 있다');
  const stale = rows.map(({ value }) =>
    value.kind === 'local'
      ? {
          ...value,
          summary: {
            ...value.summary,
            edition: value.summary.edition.replace('record-5', 'record-4'),
          },
        }
      : value,
  );
  const migrated = memoryPort();
  await migrated.append(stale);
  const fresh = await open(migrated, home.foldIndex, 'newxxxxx');
  assert.equal(fresh.summary.edition, edition, '지금 판 묶음으로 다시 접었다');
  assert.deepEqual(unitKeys(fresh.summary.lines), FIXED, '옛 한글 답이 글자 단위로 다시 접혔다');

  // 판 묶음이 같고 새 사건이 없으면 다시 접지 않는다 — 판을 올리지 않으면 바로잡히지 않는다(record-5를 올린 까닭).
  const same = memoryPort();
  await same.append(rows.map(row => row.value));
  const kept = await open(same, home.foldIndex, 'samexxxx');
  assert.deepEqual(unitKeys(kept.summary.lines), BROKEN, '같은 판 묶음의 요약은 그대로 받는다');
});
