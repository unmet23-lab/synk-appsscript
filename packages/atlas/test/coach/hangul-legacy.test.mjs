// 옛 한글 기록 다시 접기 — 기기 묶은 색인(4-7 — 단계4_계획 §26-6). 손님 호스트가 옛 기기 로그를 손님 저장소로 옮기면(carryLegacy) 기록부가
// 호스트의 묶은 색인(coach/host.mjs compositeIndex)으로 접는다. 묶은 색인의 family(계열 → 계열 줄)가 홈이 늘 받는 조각(world-life)에 실린
// 한글 계열 줄을 찾아, 옛 한글 답이 꼴마다 계열 단위가 아니라 글자 단위(ko.hangul.<글자>)에 쌓인다. 서버 길은 test/record/hangul-legacy.test.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { subject, subjectTool } from '../support/subject.mjs';

const { createCoach } = await subject('coach/index.mjs');
const { openMap } = await subject('map/index.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { sliceOf } = await subjectTool('map-ship.mjs');

const read = name =>
  JSON.parse(fs.readFileSync(new URL(`../../map/${name}`, import.meta.url), 'utf8'));
const index = read('index.json');
const words = read('words.json');
const units = read('units.json');
const T0 = Date.UTC(2026, 10, 1, 3);
let stores = 0;

const legacy = (id, m, type, fields) => {
  const at = new Date(T0 + m * 60_000).toISOString();
  return { schema: 1, id, scope: { domain: 'LAB' }, at, recordedAt: at, type, ...fields };
};
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
  ...hangul(2, 'see_pick', 'v-a', 2, 'binary-choice'),
  ...hangul(3, 'match', 'c-g', 2, 'single-choice'),
];

async function homeCoach(map) {
  stores += 1;
  const coach = createCoach({
    gameId: 'world-home',
    map,
    seed: 'hangul-legacy',
    dayOffset: 0,
    host: {
      guest: true,
      port: memoryPort(),
      key: `synk-atlas:hangul-legacy-${process.pid}-${stores}`,
      now: () => T0 + 3_600_000,
      legacy: async () => ({ log: OLD, ledger: null }),
    },
  });
  await coach.ready;
  return coach;
}
const unitsOf = coach =>
  coach
    .summary()
    .units.map(row => row.unit)
    .sort();

test('손님 기기 — 홈 조각의 한글 계열 줄로 옮겨 온 옛 한글 답이 글자 단위에 쌓인다(묶은 색인 family, 4-7 §26-6)', async () => {
  const home = openMap({ index: [sliceOf(index, 'world-life', words)], units });
  const coach = await homeCoach(home);
  try {
    assert.deepEqual(unitsOf(coach), ['ko.hangul.c-g', 'ko.hangul.v-a']);
    const va = coach.summary().units.find(row => row.unit === 'ko.hangul.v-a');
    assert.deepEqual(
      [va.kind, va.sittings],
      ['hangul', 1],
      '두 꼴의 답이 한 글자 · 한 자리에 쌓인다',
    );
  } finally {
    coach.dispose();
  }
  // 계열 줄 찾기를 모르는 지도(고치기 전 꼴)면 꼴마다 계열 단위다 — 이 시험이 묶은 색인의 family를 본다.
  const blind = Object.freeze({ ...home, familyRow: undefined });
  const before = await homeCoach(blind);
  try {
    assert.deepEqual(unitsOf(before), [
      'family:hangul-stage.listen_pick.v-a',
      'family:hangul-stage.match.c-g',
      'family:hangul-stage.see_pick.v-a',
    ]);
  } finally {
    before.dispose();
  }
});
