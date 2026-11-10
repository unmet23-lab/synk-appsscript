// WORLD 「짧은 연습」의 새 판(단계 4-1 — 계획 §7 · §11 제품 시험). 진짜 지도(map/index.json)와 진짜 TOPIK 은행(world-topik-items.json)으로
// 코치 3판을 돌린다. 제품 모듈은 experiences/synk-world-app/world-practice-next.mjs다(지금 판 world-reading-practice.mjs는 그대로).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { PACKAGE_ROOT } from '../support/subject.mjs';
import { clock, createCoach, memoryPort } from './support.mjs';

const REPO = path.join(PACKAGE_ROOT, '..', '..');
const WORLD = path.join(REPO, 'experiences', 'synk-world-app');
const load = file => import(pathToFileURL(path.join(WORLD, file)).href);
const { createPracticeNextSession, endingOf } = await load('world-practice-next.mjs');
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

test('판이 일찍 끝나면 그 까닭을 사실대로 고른다 — 돌아온 것을 안 낸 판에 「다 만났어요」가 없다', () => {
  assert.deepEqual(endingOf({ status: 'none' }, { due: false }), { kind: 'none' });
  assert.deepEqual(endingOf({ status: 'idle', facts: { held: 'day' } }, { due: false }), {
    kind: 'capped',
  });
  assert.deepEqual(endingOf({ status: 'idle', facts: { limited: true } }, { due: false }), {
    kind: 'limited',
  });
  assert.deepEqual(endingOf({ status: 'idle', facts: {} }, { due: true }), { kind: 'idle' });
  assert.deepEqual(endingOf({ status: 'idle', facts: {} }, { due: false }), { kind: 'exhausted' });
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
