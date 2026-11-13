// 4-2 생활(단계 4 계획 §19-3 · F): 코치 겉에 더한 것 — 요약 단위 줄의 다음 돌아올 때(dueAt), 요약의 「보기가 얹지 못함」(storage.waiting),
// 지도 문항의 단위(itemUnits(itemKey) — 제품이 단위를 짓지 않는다). 진짜 지도(map/index.json · units.json)의 생활 문항으로 돈다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT, subject } from '../support/subject.mjs';
import { clock, createCoach, memoryPort, PARAMS } from './support.mjs';

const DAY = 86_400_000;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const MAP_DATA = {
  index: readJson(path.join(PACKAGE_ROOT, 'map', 'index.json')),
  units: readJson(path.join(PACKAGE_ROOT, 'map', 'units.json')),
};
// 생활 원고의 첫 인사(「안녕하세요.」) — 생활 단위 하나를 싣는 고르는 꼴 문항.
const HELLO = 'life.greetings-expressions-hello';
const { openMap } = await subject('map/index.mjs');
const { acquireHost, installHostMaker, releaseHost } = await subject('coach/host.mjs');
// 태그 없는 생활 문항(계열 단위로만 기억이 선다 — §19-0) — 지도에서 찾는다.
const UNTAGGED = openMap(MAP_DATA)
  .items('world-life')
  .find(item => item.units.length === 1 && item.units[0].startsWith('family:'));

let stores = 0;
async function lifeCoach() {
  stores += 1;
  const time = clock();
  const coach = createCoach({
    gameId: 'world-life',
    mapData: MAP_DATA,
    dayOffset: 540,
    host: {
      guest: true,
      port: memoryPort(),
      key: `synk-atlas:world-life-${process.pid}-${stores}`,
      now: time.now,
    },
  });
  await coach.ready;
  return { coach, time };
}

test('itemUnits(itemKey) — 지도 문항의 단위를 이름 · 갈래와 함께(열쇠 글자 · { itemKey }), 태그 없는 문항은 계열 단위 그대로, 얼린 사본, 준비 전 NOT_READY(설계 주인 11-13)', async () => {
  stores += 1;
  const early = createCoach({
    gameId: 'world-life',
    mapData: MAP_DATA,
    dayOffset: 540,
    host: {
      guest: true,
      port: memoryPort(),
      key: `synk-atlas:world-life-${process.pid}-${stores}`,
      now: clock().now,
    },
  });
  assert.throws(
    () => early.itemUnits(HELLO),
    error => error.code === 'NOT_READY',
    '지도를 받기 전에는 빈 목록이 아니라 NOT_READY — 받는 동안 「생활 단위 없음」으로 읽히지 않게',
  );
  await early.ready;
  early.dispose();
  const { coach } = await lifeCoach();
  const hello = [{ unit: 'ko.life.greet-hello', kind: 'life', label: '안녕하세요.' }];
  assert.deepEqual(coach.itemUnits(HELLO), hello);
  assert.deepEqual(coach.itemUnits({ itemKey: HELLO }), hello, '{ itemKey }로도');
  assert.ok(
    Object.isFrozen(coach.itemUnits(HELLO)) && Object.isFrozen(coach.itemUnits(HELLO)[0]),
    '얼린 사본',
  );
  assert.ok(UNTAGGED, '태그 없는 생활 문항이 지도에 있다');
  assert.deepEqual(
    coach.itemUnits(UNTAGGED.itemKey),
    [{ unit: UNTAGGED.units[0], kind: 'family', label: null }],
    '태그 없는 문항은 계열 단위 그대로 — due() · summary()에 뜨는 줄과 같다',
  );
  assert.deepEqual(coach.itemUnits('life.없는-문항'), []);
  assert.deepEqual(
    coach.itemUnits({
      itemKey: 'life.없는-문항',
      familyKey: 'x',
      skillId: 's',
      difficulty: 1,
      responseFormat: 'single-choice',
    }),
    [],
    '지도에 없는 문항은 메타를 든 객체여도 빈 목록',
  );
  assert.deepEqual(coach.itemUnits(null), []);
  coach.dispose();
  assert.throws(
    () => coach.itemUnits(HELLO),
    error => error.code === 'DISPOSED',
    '닫힌 코치는 답하지 않는다',
  );
});

test('요약 단위 줄의 dueAt — 마지막 자리 + 다음 간격(혼자 맞힌 고르기 약 1.3일 · 놓침 6시간), 시간이 흘러도 그대로, 그때를 지나면 돌아온 것(F · Fable 5.2 합친 끝 판 넘친 #14)', async () => {
  const { coach, time } = await lifeCoach();
  const pid = coach.present({ itemKey: HELLO });
  const out = coach.answer(pid, { correct: true, assessable: true });
  await out.stored;
  const [line] = coach.summary().units;
  assert.equal(line.unit, 'ko.life.greet-hello');
  assert.ok(line.lastAt >= time.t && line.lastAt < time.t + 10, '마지막 자리는 답한 때');
  const gap = (line.dueAt - line.lastAt) / DAY;
  assert.ok(gap > 1.2 && gap < 1.4, `첫 약한 성공 ${gap}일`);
  assert.equal(line.due, false);
  time.advance(Math.ceil(line.dueAt - time.t) + 1000);
  const later = coach.summary().units[0];
  assert.equal(later.due, true, '다음 때를 지나면 돌아온 것');
  assert.equal(
    later.dueAt,
    line.dueAt,
    '시간이 흘러도 다음 때는 그대로 — 볼 때마다 「지금 + 간격」으로 밀리지 않는다(Fable 5.2 합친 끝 판 넘친 #14)',
  );
  assert.deepEqual(
    coach.due().map(row => row.unit),
    ['ko.life.greet-hello'],
  );
  coach.dispose();

  const missed = await lifeCoach();
  const p2 = missed.coach.present({ itemKey: HELLO });
  await missed.coach.answer(p2, { correct: false, assessable: true }).stored;
  const [lapse] = missed.coach.summary().units;
  assert.ok(
    Math.abs((lapse.dueAt - lapse.lastAt) / DAY - 0.25) < 0.01,
    '놓침은 같은 자리 6시간 뒤',
  );
  missed.coach.dispose();
});

test('요약의 storage.waiting — 보기가 얹을 수 있으면 거짓(손님 기기는 원천이라 base 참)', async () => {
  const { coach } = await lifeCoach();
  const { storage } = coach.summary();
  assert.equal(storage.waiting, false);
  assert.equal(storage.base, true);
  coach.dispose();
});

test('요약의 storage.waiting은 보기가 통째로 못 얹을 때만 참 — 줄마다 기다림(waitUnits · waitSkills)만 있는 보기에서는 거짓(Fable 5.2 합친 끝 판 넘친 #14)', async () => {
  // 같은 손님 저장소를 연 두 탭 — B의 시계가 10분 뒤라(5분 넘게 앞선 다른 탭 시각은 따라가지 않는다) B가 저장 중인 답이 A의 답보다 앞에 선다
  const port = memoryPort();
  stores += 1;
  const key = `synk-atlas:world-life-wait-${process.pid}-${stores}`;
  const tab = () => {
    const top = { location: { origin: 'https://world.test' } };
    top.parent = top;
    installHostMaker(top, { openPort: () => port });
    return top;
  };
  const [topA, topB] = [tab(), tab()];
  const ahead = clock();
  const behind = clock(ahead.t - 10 * 60_000);
  const open = (time, scope) =>
    createCoach({
      gameId: 'world-life',
      mapData: MAP_DATA,
      dayOffset: 540,
      scope,
      host: { guest: true, key, now: time.now },
    });
  const a = open(ahead, topA);
  await a.ready;
  const b = open(behind, topB);
  await b.ready;
  await a.answer(a.present({ itemKey: HELLO }), { correct: true, assessable: true }).stored;
  const hostB = await acquireHost({ key, params: PARAMS, now: behind.now, guest: true }, topB);
  await hostB.refresh(); // A의 답을 꼬리로 읽는다
  const late = b.answer(b.present({ itemKey: HELLO }), { correct: true, assessable: true });
  const view = hostB.view();
  assert.equal(view.waitAll, false);
  assert.ok(view.waitUnits.size + view.waitSkills.size > 0, '줄마다 기다림이 있다');
  assert.equal(
    b.summary().storage.waiting,
    false,
    '줄 기다림만 있으면 거짓 — 돌아온 복습 전체를 「확인 중」으로 두지 않는다',
  );
  assert.equal(await late.stored, true);
  releaseHost(hostB);
  a.dispose();
  b.dispose();
});
