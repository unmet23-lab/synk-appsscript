// WORLD 「짧은 연습」의 새 판(단계 4-1 — 계획 §7 · §11 제품 시험). 진짜 지도(map/index.json)와 진짜 TOPIK 은행(world-topik-items.json)으로
// 코치 3판을 돌린다. 제품 모듈은 experiences/synk-world-app/world-practice-next.mjs다(지금 판 world-reading-practice.mjs는 그대로).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { sliceOf } from '../../tools/map-ship.mjs';
import { PACKAGE_ROOT, subject } from '../support/subject.mjs';
import { clock, createCoach, memoryPort } from './support.mjs';

const { openMap } = await subject('map/index.mjs');

const REPO = path.join(PACKAGE_ROOT, '..', '..');
const WORLD = path.join(REPO, 'experiences', 'synk-world-app');
const load = file => import(pathToFileURL(path.join(WORLD, file)).href);
const { createPracticeNextSession, endingLine, endingOf } = await load('world-practice-next.mjs');
const { createPositionView } = await load('world-position-ui.mjs');
const STRINGS = (
  await import(
    pathToFileURL(path.join(REPO, 'experiences', 'brand-opening', 'world-strings.mjs')).href
  )
).default;
// 판 끝 화면을 한국어로 그린다(화면 글 표의 ko 줄 그대로).
const view = createPositionView({
  t: (key, vars = {}) =>
    String(STRINGS[key]?.ko ?? key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? ''),
});
const { bankItems } = await load('world-topik-items.mjs');
const { allowedPlays, nextPlay } = await load('world-exam-form.mjs');
const plays = { allowedPlays, nextPlay };
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const BANK = bankItems(readJson(path.join(WORLD, 'world-topik-items.json')));
const MAP_DATA = {
  index: readJson(path.join(PACKAGE_ROOT, 'map', 'index.json')),
  units: readJson(path.join(PACKAGE_ROOT, 'map', 'units.json')),
};

const bySkill = new Map();
for (const item of BANK) {
  if (!bySkill.has(item.skillId)) bySkill.set(item.skillId, []);
  bySkill.get(item.skillId).push(item);
}
const readingSkill = [...bySkill]
  .filter(([id, items]) => id.includes('.reading.') && items.length >= 8)
  .sort((a, b) => b[1].length - a[1].length)[0];

let stores = 0;
async function guestCoach() {
  stores += 1;
  const time = clock();
  const coach = createCoach({
    gameId: 'world-practice',
    mapData: MAP_DATA,
    dayOffset: 540,
    // 능력 이름 — 셸(app-shell.mjs lazyAtlasNext)이 넘기는 것과 같다(「한 단계 올려」 줄이 능력 이름을 말한다).
    label: id => STRINGS[`position.skill.${id}`]?.ko ?? null,
    host: {
      guest: true,
      port: memoryPort(),
      key: `synk-atlas:world-practice-${process.pid}-${stores}`,
      now: time.now,
    },
  });
  await coach.ready;
  return { coach, time };
}

async function play(session, time, choose) {
  const shown = [];
  while (session.next()) {
    const now = session.current;
    shown.push(now);
    if (!now.heard) session.delivery('completed');
    const item = now.item;
    session.answer(choose(item, shown.length - 1));
    time.advance(30_000);
  }
  return shown;
}

test('은행 바탕: 읽기 항목 하나에 문항이 여럿 있고, 지도가 그 문항을 단위 둘 이상으로 안다', () => {
  assert.ok(readingSkill, '문항 여덟 개 이상인 읽기 항목');
  const map = MAP_DATA.index;
  assert.ok(map.items.length > 1000);
});

test('다섯 문항 판은 단위가 둘 · 셋인 TOPIK 문항으로도 다섯까지 간다(아르곤 A1 — 새것 한도는 단위로 3n)', async () => {
  const { coach, time } = await guestCoach();
  const pool = readingSkill[1];
  const session = createPracticeNextSession({ plays, coach, pool, length: 5 });
  const shown = await play(session, time, item => item.correctId);
  assert.equal(shown.length, 5, `낸 문항 ${shown.length} — 끝난 까닭 ${session.ending?.kind}`);
  assert.equal(session.ending.kind, 'done');
  for (const now of shown)
    assert.ok(
      typeof now.why === 'string' || now.fresh,
      '엔진이 겨눈 문항은 이유 한 줄, 처음 보는 채우기 문항은 이유 없이',
    );
  const rows = await session.settled();
  assert.ok(rows.every(row => row.stored));
  assert.ok(
    rows.filter(row => row.independent).length >= 1,
    '처음 본 문항을 혼자 맞힌 답은 저장 뒤 혼자 맞힘이다',
  );
  coach.dispose();
});

test('놓친 단위는 같은 판에서 다른 문항으로 다시 나온다(설계 §1 표 1행)', async () => {
  const { coach, time } = await guestCoach();
  const pool = readingSkill[1];
  const session = createPracticeNextSession({ plays, coach, pool, length: 7 });
  const wrong = item => item.choices.find(choice => choice.id !== item.correctId).id;
  const shown = await play(session, time, (item, i) => (i === 0 ? wrong(item) : item.correctId));
  assert.ok(shown.length >= 4);
  assert.ok(
    shown.slice(1).some(now => /다른 문제로 한 번 더|한 번 더 만나요/.test(now.why ?? '')),
    `「다시」 이유가 나온다 — ${shown.map(now => now.why).join(' | ')}`,
  );
  coach.dispose();
});

test('전부 혼자 맞히는 학습자 — 답 뒤 「정답 보기」가 있어도 이어서 혼자 맞힌 수가 오르고 「한 단계 올려」가 나오며 「쉬운 것부터」는 없다(Fable 5.2 최종 F1)', async () => {
  const { coach, time } = await guestCoach();
  const pool = readingSkill[1];
  const shown = [];
  let independent = 0;
  for (let round = 0; round < 3; round += 1) {
    const session = createPracticeNextSession({ plays, coach, pool, length: 5 });
    shown.push(...(await play(session, time, item => item.correctId)));
    independent += (await session.settled()).filter(row => row.independent).length;
    time.advance(5 * 60_000);
  }
  const whys = shown.map(now => now.why ?? '');
  assert.ok(
    whys.some(why => /이어서 혼자 맞혔어요/.test(why)),
    `skill.up — ${whys.join(' | ')}`,
  );
  assert.ok(!whys.some(why => /쉬운 것부터/.test(why)), `skill.ease 없음 — ${whys.join(' | ')}`);
  const skills = coach.summary().skills.filter(skill => skill.streak > 0);
  assert.equal(
    skills.reduce((sum, skill) => sum + skill.streak, 0),
    independent,
    '혼자 맞힌 처음 본 문항마다 이어서 맞힌 수가 하나씩',
  );
  coach.dispose();
});

test('하루 새 단위 한도를 다 쓴 날 새 항목의 판 — 한 문항도 못 내도 끝 까닭은 limited, 끝 화면에 「새 말 더 배우기」(Fable 5.2 최종 F2)', async () => {
  const { coach, time } = await guestCoach();
  const skills = [...bySkill].filter(
    ([id, items]) => id.includes('.reading.') && items.length >= 5,
  );
  let empty = null;
  for (const [id, pool] of skills.slice(0, 8)) {
    const session = createPracticeNextSession({ plays, coach, pool, setPool: BANK, length: 5 });
    const shown = await play(session, time, item => item.correctId);
    const results = await session.settled();
    assert.notEqual(session.ending.kind, 'none', `${id}: 낸 문항 ${shown.length} — none`);
    if (!shown.length) {
      empty = { id, results, ending: session.ending };
      break;
    }
    time.advance(3 * 60_000);
  }
  assert.ok(empty, '같은 날 새 항목을 잇달아 열면 한도를 다 쓴 판이 온다');
  assert.equal(empty.ending.kind, 'limited');
  const html = view.renderPracticeNextDone({
    skill: { id: empty.id, label: empty.id },
    results: empty.results,
    ending: empty.ending,
    count: 5,
  });
  assert.match(html, /data-practice-end-line>이번 판의 새 말은 여기까지예요/);
  assert.match(html, /data-practice-more/);
  coach.dispose();
});

test('돌아온 것이 없는 첫날의 판 — 놓친 뒤 「다시」를 기다리는 동안에도 어느 문항에도 「다 만났어요」가 없다(Fable 5.2 최종 F3)', async () => {
  const { coach, time } = await guestCoach();
  const pool = readingSkill[1];
  const shown = [];
  for (let round = 0; round < 3; round += 1) {
    const session = createPracticeNextSession({ plays, coach, pool, setPool: BANK, length: 7 });
    const wrong = item => item.choices.find(choice => choice.id !== item.correctId).id;
    shown.push(
      ...(await play(session, time, (item, i) => (i % 3 === 0 ? wrong(item) : item.correctId))),
    );
    await session.settled();
    time.advance(3 * 60_000);
  }
  assert.ok(shown.length >= 14);
  assert.deepEqual(
    shown.filter(now => /다 만났어요/.test(now.why ?? '')).map(now => now.item.itemKey),
    [],
  );
  coach.dispose();
});

test('WORLD 입구가 받는 은행 조각만으로 연습 풀의 모든 문항이 색인 문항으로 찾아진다 — 마을 읽기(synk-town → synk-town-reading)도(Fable 5.2 최종 F4)', async () => {
  const { banksOf } = await load('world-atlas-next.mjs');
  const { worldPosition } = await load('world-position-kit.mjs');
  worldPosition.topik.use(readJson(path.join(WORLD, 'world-topik-items.json')));
  const pool = worldPosition.practice.pool;
  assert.ok(
    pool.some(item => item.itemKey.startsWith('synk-town.')),
    '마을 읽기 문항이 풀에 있다',
  );
  const banks = banksOf(pool);
  assert.ok(banks.includes('synk-town-reading'));
  const full = openMap(MAP_DATA);
  const sliced = openMap({
    index: banks.map(bank => sliceOf(MAP_DATA.index, bank)),
    units: MAP_DATA.units,
  });
  const shape = item =>
    item && JSON.stringify([item.familyKey, item.skillId, item.difficulty, item.units, item.order]);
  const off = pool.filter(
    item => !full.item(item) || shape(sliced.item(item)) !== shape(full.item(item)),
  );
  assert.deepEqual(
    off.map(item => item.itemKey),
    [],
    '조각 지도에서 색인 밖 문항(family 단위 · 진도 맨 뒤)으로 떨어진 문항',
  );
});

test('판이 일찍 끝나면 그 까닭을 사실대로 고른다 — 돌아온 것을 안 낸 판에 「다 만났어요」가 없다', () => {
  assert.deepEqual(endingOf({ status: 'none' }, { due: false }), { kind: 'none' });
  // 낼 것이 없어도(none) 그 판의 사실이 먼저다(Fable 5.2 최종 F2)
  assert.deepEqual(endingOf({ status: 'none', facts: { limited: true } }, { due: false }), {
    kind: 'limited',
  });
  assert.deepEqual(endingOf({ status: 'none', facts: { held: 'day' } }, { due: true }), {
    kind: 'capped',
  });
  assert.deepEqual(endingOf({ status: 'none', facts: { held: 'stubborn' } }, { due: false }), {
    kind: 'stubborn',
  });
  assert.deepEqual(endingOf({ status: 'none', facts: {} }, { due: true }), { kind: 'none' });
  assert.deepEqual(endingOf({ status: 'idle', facts: { held: 'day' } }, { due: false }), {
    kind: 'capped',
  });
  assert.deepEqual(endingOf({ status: 'idle', facts: { limited: true } }, { due: false }), {
    kind: 'limited',
  });
  assert.deepEqual(endingOf({ status: 'idle', facts: {} }, { due: true }), { kind: 'idle' });
  assert.deepEqual(endingOf({ status: 'idle', facts: {} }, { due: false }), { kind: 'exhausted' });
});

test('판 끝 줄의 엔진 문장은 끝 까닭이 엔진의 것일 때만 — 처음 보는 문항이 바닥난 판에 「다 만났어요」가 없다(Fable P1-1)', () => {
  const idle = { code: 'idle', line: '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.' };
  assert.equal(endingLine('idle', idle), idle.line);
  assert.equal(endingLine('exhausted', idle), null);
  assert.equal(endingLine('limited', idle), null);
  assert.equal(endingLine('capped', idle), null, '하루 상한 판에는 그 이유 종류(day.capped)만');
  assert.equal(
    endingLine('capped', { code: 'day.capped', line: '오늘은 여기까지예요.' }),
    '오늘은 여기까지예요.',
  );
  const done = ending =>
    view.renderPracticeNextDone({
      skill: { id: 'ko.reading.x', label: '읽기' },
      results: [],
      ending,
    });
  // 판 끝 화면은 끝 까닭이 먼저다 — 엔진 문장(why)이 실려 와도 exhausted · limited에는 제품 문장을 쓴다.
  assert.doesNotMatch(done({ kind: 'exhausted', why: idle.line }), /다 만났어요/);
  assert.match(done({ kind: 'exhausted', why: null }), /새 문항은 여기까지예요/);
  assert.match(done({ kind: 'limited', why: null }), /새 말은 여기까지예요/);
  assert.match(done({ kind: 'idle', why: idle.line }), /다 만났어요/);
});

test('처음 보는 문항이 남은 동안은 같은 항목을 잇달아 연습해도 판 길이까지 간다 — idle이면 처음 보는 문항으로 잇는다(Fable P1-1)', async () => {
  const { coach, time } = await guestCoach();
  const pool = readingSkill[1];
  const unseen = () => pool.filter(item => coach.exposure(item).seen === false).length;
  let rounds = 0;
  while (unseen() >= 5) {
    const session = createPracticeNextSession({ plays, coach, pool, length: 5 });
    const shown = await play(session, time, item => item.correctId);
    await session.settled();
    rounds += 1;
    assert.equal(
      shown.length,
      5,
      `${rounds}판: 낸 문항 ${shown.length} — 끝난 까닭 ${session.ending.kind}`,
    );
    if (session.ending.kind !== 'idle')
      assert.doesNotMatch(session.ending.why ?? '', /다 만났어요/);
    time.advance(5 * 60_000);
  }
  assert.ok(rounds >= 3, `잇달아 ${rounds}판`);
  // 처음 보는 문항이 바닥난 뒤 끝나는 판은 그 까닭(exhausted)을 말하고, 엔진의 「다 만났어요」를 빌리지 않는다.
  for (let round = 0; round < 3; round += 1) {
    const session = createPracticeNextSession({ plays, coach, pool, length: 5 });
    await play(session, time, item => item.correctId);
    if (['exhausted', 'limited'].includes(session.ending.kind))
      assert.equal(session.ending.why, null);
    time.advance(5 * 60_000);
  }
  coach.dispose();
});

test('문항 앞 해설을 본 답은 도움받은 답이다 — 근거를 부풀리지 않는다', async () => {
  const { coach, time } = await guestCoach();
  const session = createPracticeNextSession({ plays, coach, pool: readingSkill[1], length: 1 });
  session.next();
  assert.equal(session.preHelp(), true);
  assert.equal(session.preHelp(), false, '한 번만');
  session.answer(session.current.item.correctId);
  time.advance();
  const [row] = await session.settled();
  assert.equal(row.independent, false);
  assert.equal(row.assisted, true);
  coach.dispose();
});

test('같은 지문 세트의 다른 문항을 본 문항은 처음 보는 문항이 아니다(지금 판 freshBySet 규칙)', async () => {
  const sets = new Map();
  for (const item of BANK.filter(item => item.setId && item.modality === 'reading')) {
    if (!sets.has(item.setId)) sets.set(item.setId, []);
    sets.get(item.setId).push(item);
  }
  const pair = [...sets.values()].find(list => list.length >= 2);
  assert.ok(pair, '세트 문항이 있다');
  const { coach, time } = await guestCoach();
  coach.recommend([pair[0]], { set: { length: 1 } });
  const first = coach.present(pair[0]);
  coach.answer(first, { correct: true, assessable: true });
  time.advance();
  const session = createPracticeNextSession({
    plays,
    coach,
    pool: [pair[1]],
    setPool: BANK,
    length: 1,
  });
  session.next();
  session.answer(session.current.item.correctId);
  const [row] = await session.settled();
  assert.equal(row.independent, false, '세트를 이미 읽은 문항은 측정 근거가 아니다');
  coach.dispose();
});

test('듣기 문항은 끝까지 들은 뒤에만 답을 받고, 건너뛰면 판정할 수 없는 답이다', async () => {
  const listening = [...bySkill].find(
    ([id, items]) => id.includes('.listening.') && items.length >= 3,
  );
  assert.ok(listening);
  const { coach } = await guestCoach();
  const session = createPracticeNextSession({ plays, coach, pool: listening[1], length: 2 });
  const now = session.next();
  assert.equal(now.heard, false);
  assert.equal(session.answer(now.item.correctId), null, '듣기 전에는 답을 받지 않는다');
  assert.equal(session.replay(), 'first');
  session.delivery('completed');
  const skipped = session.skip();
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.verdict, 'unassessed');
  coach.dispose();
});

test('WORLD 입구 — 손님 코치에 옛 기록 읽개를 넘기고, 준비 중에 닫으면 그 코치를 닫으며, 입구 받기 실패도 계기에 남긴다(GPT GB1 · GB2 · GB3)', async () => {
  const { createAtlasNext, LEGACY_KEY } = await load('world-atlas-next.mjs');
  const stored = new Map([
    [
      LEGACY_KEY,
      JSON.stringify({ version: 1, events: [{ schema: 1, id: 'old' }], ledger: { keys: {} } }),
    ],
  ]);
  const storage = { getItem: key => stored.get(key) ?? null };
  const notes = [];
  const health = { note: (kind, outcome) => notes.push([kind, outcome]) };
  let captured = null;
  let release = null;
  let disposed = 0;
  const fake = {
    ready: new Promise(resolve => {
      release = resolve;
    }),
    dispose: () => {
      disposed += 1;
    },
  };
  const next = createAtlasNext({
    owner: 'guest',
    health,
    storage,
    load: async () => ({
      coach: options => {
        captured = options;
        return fake;
      },
    }),
  });
  const pending = next.practiceCoach(BANK.slice(0, 3));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(captured.host.legacy(), {
    log: [{ schema: 1, id: 'old' }],
    ledger: { keys: {} },
  });
  next.dispose();
  release();
  assert.equal(await pending, null, '닫힌 뒤 준비된 코치는 돌려주지 않는다');
  assert.equal(disposed, 1, '그 코치를 닫는다');
  const failing = createAtlasNext({
    owner: 'guest',
    health,
    storage,
    load: async () => {
      throw Object.assign(new Error('offline'), { reason: 'IMPORT' });
    },
  });
  assert.equal(await failing.practiceCoach(BANK.slice(0, 3)), null);
  assert.deepEqual(notes.at(-1), ['load', { ok: false, code: 'LOAD_IMPORT' }]);
});

test('WORLD 입구 — 브라우저가 저장소를 막아 localStorage를 읽기만 해도 던지면 옛 기록 읽개 없이 새 길 코치를 연다(지금 판으로 넘어가지 않는다, GPT 최종 GB1)', async () => {
  const { createAtlasNext } = await load('world-atlas-next.mjs');
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw Object.assign(new Error('The operation is insecure.'), { name: 'SecurityError' });
    },
  });
  try {
    const notes = [];
    const health = { note: (kind, outcome) => notes.push([kind, outcome]) };
    let captured = null;
    const made = { ready: Promise.resolve(), dispose() {} };
    const next = createAtlasNext({
      owner: 'guest', // 셸(app-shell.mjs lazyAtlasNext)처럼 storage를 주지 않는다
      health,
      load: async () => ({
        coach: options => {
          captured = options;
          return made;
        },
      }),
    });
    assert.equal(await next.practiceCoach(BANK.slice(0, 3)), made, '새 길 코치를 돌려준다');
    assert.equal(captured.host.legacy, null, '옛 기록 읽개 없이 연다');
    assert.deepEqual(notes, [
      ['save', { ok: false, code: 'LEGACY_STORAGE' }],
      ['load', { ok: true }],
    ]);
    next.dispose();
  } finally {
    if (before) Object.defineProperty(globalThis, 'localStorage', before);
    else delete globalThis.localStorage;
  }
});

// 아르곤 끝 판(11-11): 측정 자격을 가르는 제품 규칙은 화면용 seen이 아니라 측정용 met을 쓰고, 좁혀 다시 묻기는 같은 지문 세트를 이미
// 만난 문항을 거르고, 「모르겠어요」는 지도 문항의 표지(코치가 실어 줌)로 둔다.
test('같은 지문 세트의 다른 문항을 띄우기만 하고 닫았으면 이 문항은 아직 처음이다 — 측정 자격은 만남으로 가른다(아르곤 끝 판)', async () => {
  const sets = new Map();
  for (const item of BANK.filter(item => item.setId && item.modality === 'reading')) {
    if (!sets.has(item.setId)) sets.set(item.setId, []);
    sets.get(item.setId).push(item);
  }
  const pair = [...sets.values()].find(list => list.length >= 2);
  const { coach, time } = await guestCoach();
  coach.recommend([pair[0]], { set: { length: 1 } });
  coach.present(pair[0]); // 띄우기만 하고 닫힘
  await coach.finishSet({ record: false }).folded; // 그 제시의 저장까지 끝난 뒤
  time.advance();
  assert.equal(coach.exposure(pair[0]).seen, true);
  assert.equal(coach.exposure(pair[0]).met, false);
  const session = createPracticeNextSession({
    plays,
    coach,
    pool: [pair[1]],
    setPool: BANK,
    length: 1,
  });
  session.next();
  session.answer(session.current.item.correctId);
  const [row] = await session.settled();
  assert.equal(row.independent, true, '세트를 읽기만 하고 답하지 않았으면 측정 근거다');
  coach.dispose();
});

// 겉만 흉내 낸 코치 — 엔진은 늘 할 것이 없고(idle), 맨 앞 채우기는 이미 만난 문항이다.
function fakeCoach({ met, unknown = new Set() }) {
  const calls = [];
  return {
    calls,
    recommend(pool, options = {}) {
      calls.push({ keys: pool.map(item => item.itemKey), pool: options.pool ?? null });
      const top = options.pool ? pool[0] : pool.find(item => met.has(item.itemKey));
      if (!top) return { status: 'none', selected: null, facts: {}, why: null };
      return {
        status: 'idle',
        selected: top,
        tier: 3,
        facts: {},
        why: { code: 'idle', line: '오늘 돌아온 것은 다 만났어요.' },
        unknownOption: unknown.has(top.itemKey),
      };
    },
    exposure: item => ({ seen: met.has(item.itemKey), met: met.has(item.itemKey) }),
    present: () => 'pid',
    answer: () => ({ verdict: 'unknown', evidence: Promise.resolve({ independent: false }) }),
    help() {},
    delivery() {},
    finishSet() {},
  };
}
const fakeItem = (key, setId = null) => ({
  id: key,
  itemKey: key,
  setId,
  skillId: 'ko.reading.x',
  modality: 'reading',
  choices: [{ id: 'a' }, { id: 'b' }],
  correctId: 'a',
});

test('좁혀 다시 묻기는 같은 지문 세트를 이미 만난 문항을 거른다 — 그 문항은 측정 기회가 아니다(아르곤 끝 판)', () => {
  const pool = [fakeItem('q1', 's1'), fakeItem('q2', 's1'), fakeItem('q3')];
  const coach = fakeCoach({ met: new Set(['q1']) });
  const session = createPracticeNextSession({ plays, coach, pool, length: 1 });
  session.next();
  const narrowed = coach.calls.find(call => call.pool === 'unseen');
  assert.deepEqual(narrowed.keys, ['q3'], '세트를 만난 q2는 처음 보는 문항으로 좁힌 후보에 없다');
  assert.equal(session.current.item.itemKey, 'q3');
});

test('「모르겠어요」는 지도 문항의 표지로 둔다 — 제품 문항 객체에 칸이 없어도(아르곤 끝 판)', () => {
  const pool = [fakeItem('q1'), fakeItem('q2')];
  const coach = fakeCoach({ met: new Set(['q1']), unknown: new Set(['q2']) });
  const session = createPracticeNextSession({ plays, coach, pool, length: 1 });
  const now = session.next();
  assert.equal(now.item.unknownOption, undefined, '제품 문항에는 표지가 없다');
  assert.equal(now.unknown, true);
  assert.equal(session.unknown().verdict, 'unknown');
});

test('WORLD 입구 — 후보에 연 코치가 받지 않은 은행이 있으면 그 은행의 코치를 따로 연다(아르곤 끝 판 B5 · 다시 A4)', async () => {
  const { createAtlasNext } = await load('world-atlas-next.mjs');
  const opened = [];
  let disposed = 0;
  const next = createAtlasNext({
    owner: 'guest',
    storage: { getItem: () => null },
    load: async () => ({
      coach: options => {
        opened.push(options.banks.join(','));
        return { ready: Promise.resolve(), dispose: () => (disposed += 1) };
      },
    }),
  });
  const topik = BANK.slice(0, 2);
  const first = await next.practiceCoach(topik);
  assert.equal(await next.practiceCoach(topik), first, '같은 은행이면 다시 쓴다');
  await next.practiceCoach([...topik, { itemKey: 'entry-check.x1' }]);
  assert.deepEqual(opened, ['topik-items', 'entry-check,topik-items']);
  assert.equal(disposed, 0, '앞 코치는 그대로 둔다 — 은행 조합마다 코치 하나');
  // 준비 중에 다른 은행으로 불러도 각자 제 코치를 받는다(아르곤 다시 A4)
  const [x, y] = await Promise.all([
    next.practiceCoach([{ itemKey: 'snap-words.x1' }]),
    next.practiceCoach([{ itemKey: 'talk-rally.x1' }]),
  ]);
  assert.notEqual(x, y);
  next.dispose();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(disposed, 4, '닫을 때 모두 닫는다');
});

test('「다시」를 기다리는 사이의 채우기(status ready · 이유 idle)에는 「다 만났어요」를 달지 않는다(Fable 5.2 최종 F3)', () => {
  const pool = [fakeItem('q1'), fakeItem('q2')];
  const line = '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.';
  const coach = {
    ...fakeCoach({ met: new Set() }),
    recommend: () => ({
      status: 'ready',
      selected: pool[0],
      tier: 4,
      facts: {},
      why: { code: 'idle', line },
    }),
  };
  const session = createPracticeNextSession({ plays, coach, pool, length: 2 });
  assert.equal(session.next().why, null);
  // 다른 이유(다시 · 돌아온 것 · 새것)는 그대로 싣는다
  coach.recommend = () => ({
    status: 'ready',
    selected: pool[1],
    tier: 0,
    facts: {},
    why: { code: 'unit.retry', line: '방금 놓친 「…」, 다른 문제로 한 번 더 만나요.' },
  });
  session.skip();
  assert.match(session.next().why, /한 번 더 만나요/);
});
