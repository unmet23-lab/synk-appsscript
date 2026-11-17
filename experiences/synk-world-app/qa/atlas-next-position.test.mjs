// 4-4a 「내 위치」 새 판의 계약(단계4_계획 §21-3 · 21-4 · 21-11) — world-position-next.mjs. 칸 셋의 경계, 다의 길(닿을 수 없는 칸에서만 streak ·
// peak — 설계 주인 11-16 새벽, 카본 A1과 4c의 안을 합침), 방금 답한 능력(칸이 따라오는 중 — 카본 A4), 기록이 다 왔는가(카본 A12), 놓친 수의 범위(카본 A5), 옮겨 오기 전 기록, 돌아올 단위
// 카드(검토 C1 · C2 · 카본 A6)를 본다. 끝의 장면은 진짜 엔진 코치와 진짜 지도로 칸이 접힘을 따라오는지 본다.
// 변형 시험(qa/position-mutants.mjs)은 깬 사본을 SYNK_POSITION_NEXT_MODULE로 넘긴다. 그 밖에는 원본이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';

const P = await import(
  process.env.SYNK_POSITION_NEXT_MODULE
    ? pathToFileURL(process.env.SYNK_POSITION_NEXT_MODULE).href
    : new URL('../world-position-next.mjs', import.meta.url).href
);
const { buildPositionNext, examSkills, recheckCards, unitRoutes, unseenFamilies, difficultyCell, recordsComplete, estimateNext } = P;
import { ESTIMATE_POLICY } from '../world-position.mjs';
import { createPositionNextView } from '../world-position-next-view.mjs';

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 16, 1, 0, 0);
const SKILLS = Object.freeze([
  { id: 'ko.reading.a', domain: 'reading' },
  { id: 'ko.reading.b', domain: 'reading' },
  { id: 'ko.listening.c', domain: 'listening' },
]);
const cell = (difficulty, independent, correct, helped = 0, lastAt = T0) => ({
  difficulty,
  independent,
  correct,
  helped,
  lastAt,
});
const line = (id, cells, { n = null, streak = 0, level = null, peak } = {}) => ({
  id,
  theta: 0,
  n: n ?? cells.reduce((sum, row) => sum + row.independent, 0),
  streak,
  level,
  ...(peak === undefined ? {} : { peak }),
  cells,
});
const guestStorage = (extra = {}) => ({
  available: true,
  guest: true,
  base: true,
  pending: 0,
  unsent: 0,
  unfolded: 0,
  sync: { stopped: false, writesOff: false, switchOff: false },
  waiting: false,
  ...extra,
});
const summaryOf = (skills, { storage = guestStorage(), carried = null } = {}) => ({
  skills,
  units: [],
  carried,
  storage,
});
const board = (skills, options = {}) =>
  buildPositionNext({ exam: 'topik1', skills: SKILLS, summary: summaryOf(skills, options), ...options.build });
const cellOf = (result, id) => result.skills.find(skill => skill.id === id).cell;

test('난도 칸 하나의 경계 — 첫 답 3개와 4개, 맞힌 비율 0.79와 0.8(정수 셈), 도움만 받은 칸은 연습 중', () => {
  assert.equal(difficultyCell(cell(1, 3, 3)), 'practicing', '첫 답 3개 — 표본이 모자람');
  assert.equal(difficultyCell(cell(1, 4, 4)), 'independent');
  assert.equal(difficultyCell(cell(1, 5, 4)), 'independent', '0.8');
  assert.equal(difficultyCell(cell(1, 100, 79)), 'practicing', '0.79');
  assert.equal(difficultyCell(cell(1, 100, 80)), 'independent', '0.8');
  assert.equal(difficultyCell(cell(1, 15, 12)), 'independent', '0.8(12/15)');
  assert.equal(difficultyCell(cell(1, 15, 11)), 'practicing', '0.73(11/15)');
  assert.equal(difficultyCell(cell(1, 0, 0, 1)), 'practicing', '도움받은 첫 만남만');
  assert.equal(difficultyCell(cell(1, 0, 0, 0)), 'notyet');
});

test('능력의 칸 — 본 난도가 모두 혼자 해냄이어야 혼자 해냄, 하나만이면 연습 중, 본 난도가 없으면 아직', () => {
  const result = board([
    line('ko.reading.a', [cell(1, 5, 5), cell(2, 4, 4)]),
    line('ko.reading.b', [cell(1, 5, 5), cell(2, 2, 1)]),
  ]);
  assert.equal(cellOf(result, 'ko.reading.a'), 'independent');
  assert.equal(cellOf(result, 'ko.reading.b'), 'practicing');
  assert.equal(cellOf(result, 'ko.listening.c'), 'notyet', '만난 적 없는 능력');
  assert.deepEqual(result.counts, { independent: 1, practicing: 1, notyet: 1 });
  assert.deepEqual(result.domains.reading, { total: 2, checked: 2, independent: 1, practicing: 1, notyet: 0 });
  assert.deepEqual(result.domains.listening, { total: 1, checked: 0, independent: 0, practicing: 0, notyet: 1 });
});

// 다의 길의 F — 칸(능력 | 난도)마다 처음 보는 계열 수. 아래 시험의 칸은 ko.reading.a의 난도 2다.
const left = map => (id, difficulty) => map[`${id}|${difficulty}`] ?? 0;
const stuckLine = extra => line('ko.reading.a', [cell(1, 6, 6), cell(2, 4, 2)], extra);

test('다의 길 — 닿을 수 없는 칸에서만 streak과 peak으로 푼다: 처음 보는 문항이 남은 ①은 풀리지 않고, 다 쓴 ①은 풀리고, ②는 내려가지 않고, peak이 없는 옛 요약은 풀리지 않는다(설계 주인 11-16)', () => {
  // ① 난도 2에서 두 번 놓쳐 막혔다(2/4). 그 뒤 이어서 넷을 맞혔고 그 가운데 난도 2가 있다(peak 2).
  // 난도 2에 처음 보는 계열이 여섯 남았다 — 다 맞히면 8/10(0.8)에 닿으므로 실제 문항으로 확인한다.
  const open = board([stuckLine({ streak: 4, level: 2, peak: 2 })], { build: { unseen: left({ 'ko.reading.a|2': 6 }) } });
  assert.equal(cellOf(open, 'ko.reading.a'), 'practicing', '처음 보는 문항이 남은 ①');
  assert.deepEqual(open.attention, ['ko.reading.a'], '막힌 난도의 놓침 둘 — 먼저 볼 항목');
  // 다섯만 남았으면 다 맞혀도 7/9(0.78) — 닿을 수 없다.
  const short = board([stuckLine({ streak: 4, level: 2, peak: 2 })], { build: { unseen: left({ 'ko.reading.a|2': 5 }) } });
  assert.equal(cellOf(short, 'ko.reading.a'), 'independent', '다 써도 닿지 못하는 ①');
  // 난도 2를 다 쓴 ① — 풀린다. 다의 길로 풀린 능력은 난도 2 칸에 놓침이 남아도 먼저 볼 항목이 아니다.
  const spent = board([stuckLine({ streak: 4, level: 2, peak: 2 })], { build: { unseen: left({}) } });
  assert.equal(cellOf(spent, 'ko.reading.a'), 'independent', '다 쓴 ①');
  assert.deepEqual(spent.attention, []);
  // ② 다의 길로 풀린 뒤 난도 1의 새 문항을 하나 더 맞혔다 — streak 5, level 1, peak 2. 내려가지 않는다.
  const easier = board([stuckLine({ streak: 5, level: 1, peak: 2 })], { build: { unseen: left({}) } });
  assert.equal(cellOf(easier, 'ko.reading.a'), 'independent', '②는 내려가지 않는다');
  assert.equal(easier.skills[0].peak, 2);
  // peak이 없는 옛 요약 — 풀지 않는다(다음 접기에서 채워진다).
  const old = board([stuckLine({ streak: 4, level: 2 })], { build: { unseen: left({}) } });
  assert.equal(cellOf(old, 'ko.reading.a'), 'practicing', 'peak이 없는 옛 요약');
  assert.equal(old.skills[0].peak, null);
});

test('다의 길 — 칸이 따라오는 중(아직 접히지 않은 측정 답)이면 열지 않는다: 처음 보는 계열 수와 streak은 보기에서 바로 오르고 칸은 바탕 요약에서만 와서, 접히기 전에는 닿을 수 있는 칸이 닿을 수 없어 보인다(카본 끝 판 C1)', () => {
  // ① 바탕 요약: 난도 1이 2/2(처음 보는 계열 둘), 난도 2가 1/1. 난도 1의 처음 보는 문항 하나를 방금 혼자 맞혔다 — n 4, streak 4, peak 2, 남은 계열 하나.
  //    접히면 난도 1이 3/3에 하나가 남아 4/4로 닿을 수 있는 칸이다.
  const one = board([line('ko.reading.a', [cell(1, 2, 2), cell(2, 1, 1)], { n: 4, streak: 4, level: 1, peak: 2 })], {
    build: { unseen: left({ 'ko.reading.a|1': 1 }) },
  });
  assert.equal(cellOf(one, 'ko.reading.a'), 'practicing');
  assert.equal(one.skills[0].catching, true, '칸이 따라오는 중');
  // ② 바탕 요약: 난도 1이 3/3(처음 보는 계열 없음), 난도 2는 아직(처음 보는 계열 다섯). 난도 2의 첫 문항을 방금 혼자 맞혔다 — n 4, streak 4, peak 2.
  //    접히면 난도 2가 1/1에 넷이 남아 닿을 수 있는 칸이다.
  const two = board([line('ko.reading.a', [cell(1, 3, 3)], { n: 4, streak: 4, level: 2, peak: 2 })], {
    build: { unseen: left({ 'ko.reading.a|2': 4 }) },
  });
  assert.equal(cellOf(two, 'ko.reading.a'), 'practicing');
  assert.equal(two.skills[0].catching, true);
});

test('다의 길 — 쉬운 난도 넷의 streak(peak 1)으로는 막힌 난도 2를 풀지 않고, streak 3 · F를 모름 · 닿을 수 있는 칸이 하나라도 있으면 풀지 않는다', () => {
  const spent = { build: { unseen: left({}) } };
  assert.equal(cellOf(board([stuckLine({ streak: 4, level: 1, peak: 1 })], spent), 'ko.reading.a'), 'practicing', '쉬운 난도 넷');
  assert.equal(cellOf(board([stuckLine({ streak: 3, level: 2, peak: 2 })], spent), 'ko.reading.a'), 'practicing', 'streak 3');
  assert.equal(cellOf(board([stuckLine({ streak: 4, level: 3, peak: 3 })], spent), 'ko.reading.a'), 'independent', '막힌 난도보다 높은 난도에서 끝나도 풀린다');
  // F를 모른다(unseen 없음 · 수가 아님) — 닿을 수 있는 것으로 보고 풀지 않는다.
  assert.equal(cellOf(board([stuckLine({ streak: 4, level: 2, peak: 2 })]), 'ko.reading.a'), 'practicing', 'unseen 없음');
  assert.equal(
    cellOf(board([stuckLine({ streak: 4, level: 2, peak: 2 })], { build: { unseen: () => null } }), 'ko.reading.a'),
    'practicing',
    'F를 모름',
  );
  // 열린 칸 둘 — 난도 2는 다 썼지만 난도 3(1/2)은 처음 보는 계열이 넷 남아 닿을 수 있다(5/6) — 풀지 않는다.
  const two = line('ko.reading.a', [cell(1, 6, 6), cell(2, 4, 2), cell(3, 2, 1)], { streak: 4, level: 3, peak: 3 });
  assert.equal(cellOf(board([two], { build: { unseen: left({ 'ko.reading.a|3': 4 }) } }), 'ko.reading.a'), 'practicing');
  assert.equal(cellOf(board([two], { build: { unseen: left({ 'ko.reading.a|3': 2 }) } }), 'ko.reading.a'), 'independent', '둘 다 닿을 수 없으면 가장 높은 난도 3 이상의 peak으로');
  // 문턱 경계 — 1/1에 처음 보는 계열이 셋 남으면 다 맞혀 4/4(첫 답 4개, 0.8 이상)에 닿는다 — 풀지 않는다.
  const edge = line('ko.reading.a', [cell(1, 6, 6), cell(2, 1, 1)], { streak: 4, level: 2, peak: 2 });
  assert.equal(cellOf(board([edge], { build: { unseen: left({ 'ko.reading.a|2': 3 }) } }), 'ko.reading.a'), 'practicing', '표본 4에 닿는다');
  assert.equal(cellOf(board([edge], { build: { unseen: left({ 'ko.reading.a|2': 2 }) } }), 'ko.reading.a'), 'independent', '표본 4에 못 닿는다');
});

test('다의 길의 F — 진단 풀과 짧은 연습 풀에서 칸마다 처음 보는 계열을 한 번씩 세고, 만난 계열과 뺀 문항은 빼고, 만남을 모르는 문항은 처음 볼 수도 있는 것으로 센다', () => {
  const item = (itemKey, familyKey, difficulty = 2, skillId = 'ko.reading.a') => ({ itemKey, familyKey, difficulty, skillId });
  const unseen = unseenFamilies(
    [
      {
        items: [item('d.1', 'f.1'), item('d.2', 'f.2'), item('race:1', 'f.r'), item('d.3', 'f.3', 3)],
        exposures: [{ met: false }, { met: true }, { met: false }, { met: false }],
      },
      {
        items: [item('p.1', 'f.1'), item('p.4', 'f.4'), item('p.5', 'f.5'), item('p.6', 'f.6', 2, 'ko.reading.b')],
        exposures: [{ met: false }, { met: null }],
      },
    ],
    row => row.itemKey.startsWith('race:'),
  );
  // 난도 2: f.1(진단 · 짧은 연습에 둘 — 한 번), f.4(모름), f.5(묶음 만남이 모자람 — 모름). f.2는 만났고 f.r은 뺀 문항이다.
  assert.equal(unseen('ko.reading.a', 2), 3);
  assert.equal(unseen('ko.reading.a', 3), 1);
  assert.equal(unseen('ko.reading.b', 2), 1);
  assert.equal(unseen('ko.reading.c', 1), 0, '문항이 없는 칸');
});

test('다의 길 — 만남을 모르는 문항(met null)은 처음 볼 수도 있는 문항이라 그 칸을 닿을 수 있는 칸으로 두어 streak 길을 열지 않는다(설계 주인 11-16 물음 4 덧붙임)', () => {
  const item = n => ({ itemKey: `d.${n}`, familyKey: `f.${n}`, difficulty: 2, skillId: 'ko.reading.a' });
  const items = [1, 2, 3, 4, 5, 6].map(item);
  const fresh = [1, 2, 3, 4, 5].map(() => ({ met: false }));
  const cellWith = unseen => cellOf(board([stuckLine({ streak: 4, level: 2, peak: 2 })], { build: { unseen } }), 'ko.reading.a');
  // 난도 2(2/4)에 처음 보는 계열이 다섯이면 다 맞혀도 7/9 — 닿을 수 없어 streak 길로 풀린다(여섯째 문항은 이미 만났다).
  assert.equal(cellWith(unseenFamilies([{ items, exposures: [...fresh, { met: true }] }])), 'independent');
  // 여섯째 문항의 만남을 모르면(met null) 처음 볼 수도 있는 문항으로 센다 — 여섯이면 8/10에 닿을 수 있어 풀지 않는다.
  const unknown = unseenFamilies([{ items, exposures: [...fresh, { met: null }] }]);
  assert.equal(unknown('ko.reading.a', 2), 6);
  assert.equal(cellWith(unknown), 'practicing', '만남을 모르는 문항이 길을 닫는다');
  // 묶음 만남이 모자라 그 문항의 만남이 아예 없어도 같다.
  assert.equal(cellWith(unseenFamilies([{ items, exposures: fresh }])), 'practicing');
});

test('방금 답한 능력 — 아직이면 연습 중으로 끌어올리고, 혼자 해냄은 이어서 맞혔으면 그대로 · 놓쳤으면 연습 중(카본 A4)', () => {
  // 칸에는 아직 답이 없고 n은 1 — 끌어올린다.
  const fresh = board([line('ko.reading.a', [], { n: 1, streak: 1, level: 1 })]);
  const a = fresh.skills.find(skill => skill.id === 'ko.reading.a');
  assert.equal(a.cell, 'practicing');
  assert.equal(a.catching, true);
  assert.equal(fresh.catching, true);
  // 혼자 해냄(4/4)인 능력에서 접히지 않은 첫 답 둘을 이어서 맞혔다 — 그대로.
  const kept = board([line('ko.reading.a', [cell(1, 4, 4)], { n: 6, streak: 6, level: 1 })]);
  assert.equal(cellOf(kept, 'ko.reading.a'), 'independent', '맞힌 답이 칸을 내리지 않는다(설계 주인 11-15)');
  // 같은 능력에서 접히지 않은 첫 답 둘 가운데 하나를 놓쳤다(streak 1) — 연습 중.
  const slipped = board([line('ko.reading.a', [cell(1, 4, 4)], { n: 6, streak: 1, level: 1 })]);
  assert.equal(cellOf(slipped, 'ko.reading.a'), 'practicing', '놓친 뒤에는 접히기 전에도 연습 중');
  // 연습 중은 그대로, 표지만.
  const practicing = board([line('ko.reading.a', [cell(1, 2, 1)], { n: 3, streak: 1, level: 1 })]);
  const row = practicing.skills.find(skill => skill.id === 'ko.reading.a');
  assert.equal(row.cell, 'practicing');
  assert.equal(row.catching, true);
  // 접혔으면(n = 칸 합) 표지가 없다.
  assert.equal(board([line('ko.reading.a', [cell(1, 2, 1)])]).catching, false);
});

test('놓친 수와 도움받은 수는 아직 혼자 해냄이 아닌 난도 칸에서만 — 혼자 해냄 난도의 지난 놓침은 먼저 볼 항목을 만들지 않는다(카본 A5)', () => {
  const result = board([
    // 난도 1은 8/10(혼자 해냄), 난도 2는 1/1(표본이 모자라 연습 중) — 놓친 수 0.
    line('ko.reading.a', [cell(1, 10, 8), cell(2, 1, 1)]),
    // 난도 1에서 셋 가운데 하나를 놓쳤다 — 놓친 수 1.
    line('ko.reading.b', [cell(1, 3, 2)]),
  ]);
  const a = result.skills.find(skill => skill.id === 'ko.reading.a');
  assert.equal(a.cell, 'practicing');
  assert.equal(a.missed, 0);
  assert.equal(a.answered, 11, '근거 수는 모든 난도의 혼자 낸 첫 답');
  assert.deepEqual(result.attention, ['ko.reading.b']);
});

test('먼저 볼 항목의 차례 — 놓친 수와 도움받은 수의 합 → 지금 낼 새 문항 → 마지막 때가 늦은 것 → id, 셋까지', () => {
  const skills = [
    { id: 'ko.reading.a', domain: 'reading' },
    { id: 'ko.reading.b', domain: 'reading' },
    { id: 'ko.reading.c', domain: 'reading' },
    { id: 'ko.reading.d', domain: 'reading' },
    { id: 'ko.reading.e', domain: 'reading' },
  ];
  const summary = summaryOf([
    line('ko.reading.a', [cell(1, 3, 2, 0, T0 - 3 * DAY)]), // 1
    line('ko.reading.b', [cell(1, 3, 1, 0, T0 - 5 * DAY)]), // 2
    line('ko.reading.c', [cell(1, 3, 2, 0, T0 - DAY)]), // 1, 더 늦음
    line('ko.reading.d', [cell(1, 3, 2, 0, T0 - 9 * DAY)]), // 1, 새 문항 있음
    line('ko.reading.e', [cell(1, 4, 4)]), // 혼자 해냄 — 빠진다
  ]);
  const result = buildPositionNext({ skills, summary, prefer: id => id === 'ko.reading.d' });
  assert.deepEqual(result.attention, ['ko.reading.b', 'ko.reading.d', 'ko.reading.c']);
});

test('기록이 다 왔는가 — 기기에만 두는 기록부는 바탕 요약과 기다림만, 서버 길 계정은 첫 받기와 올리기 상태까지(카본 A12 · 검토 A3)', () => {
  assert.equal(recordsComplete(guestStorage()), true, '손님');
  assert.equal(recordsComplete(guestStorage({ waiting: true })), false, '보기가 기다린다');
  assert.equal(recordsComplete(guestStorage({ base: false })), false);
  // 동의를 끈 계정(기기 길)도 기기에만 두는 기록부다 — 첫 받기를 묻지 않는다.
  assert.equal(recordsComplete(guestStorage(), null), true, '동의를 끈 계정');
  const server = guestStorage({ guest: false });
  assert.equal(recordsComplete(server, null), false, '이 문서에서 첫 받기 전');
  assert.equal(recordsComplete(server, { ok: false }), false, '오프라인으로 연 계정');
  assert.equal(recordsComplete(server, { ok: true }), true);
  // 첫 받기가 실패로 끝난 뒤 받기가 됐다 — 엔진은 synced()에 처음 실패를 그대로 돌려주고 pulled만 세운다(Fable 끝 판 F1).
  const pulled = { ...server, sync: { ...server.sync, pulled: true } };
  assert.equal(recordsComplete(pulled, { ok: false, kind: 'offline' }), true, '뒤의 받기가 됐다');
  assert.equal(recordsComplete(pulled, null), true);
  for (const stop of ['stopped', 'writesOff', 'switchOff']) {
    assert.equal(
      recordsComplete({ ...server, sync: { ...server.sync, [stop]: true } }, { ok: true }),
      false,
      stop,
    );
    assert.equal(recordsComplete({ ...pulled, sync: { ...pulled.sync, [stop]: true } }, { ok: false }), false, `pulled · ${stop}`);
  }
  const result = board([], { storage: guestStorage({ unfolded: 2 }) });
  assert.equal(result.complete, true);
  assert.equal(result.unfolded, true, '아직 칸에 들지 않은 답');
});

test('옮겨 오기 전 기록 — 그 시험의 능력만 같은 칸 꼴로 따로 싣고, 측정 칸에는 더하지 않는다(정본 §5-6)', () => {
  const carried = {
    at: new Date(T0 - 9 * DAY).toISOString(),
    skills: [
      { id: 'ko.reading.a', cells: [{ difficulty: 1, independent: 3, correct: 2, helped: 0, lastAt: new Date(T0 - 10 * DAY).toISOString() }] },
      { id: 'ko2.reading.z', cells: [{ difficulty: 2, independent: 1, correct: 1, helped: 0, lastAt: null }] },
    ],
  };
  const result = board([], { carried });
  assert.equal(result.carried.at, T0 - 9 * DAY);
  assert.deepEqual(
    result.carried.skills.map(row => [row.id, row.answered, row.correct]),
    [['ko.reading.a', 3, 2]],
    'TOPIK I 판에는 TOPIK I 능력만',
  );
  assert.equal(cellOf(result, 'ko.reading.a'), 'notyet', '측정 칸은 비어 있다');
  assert.equal(board([]).carried, null, '코치가 내지 않으면 없다');
});

test('시험의 능력 목록 — Strata 지도의 듣기 · 읽기 능력(TOPIK I 16 · TOPIK II 12)', () => {
  const nodes = [
    ...readJson('../../../strata/maps/topik-i.json').nodes,
    ...readJson('../../../strata/maps/topik-ii.json').nodes,
  ];
  const one = examSkills(nodes, 'topik1');
  const two = examSkills(nodes, 'topik2');
  assert.equal(one.length, 16);
  assert.equal(two.length, 12);
  assert.ok(one.every(skill => /^ko\.(listening|reading)\./.test(skill.id)));
  assert.ok(two.every(skill => /^ko2\.(listening|reading)\./.test(skill.id)));
});

// ── 돌아올 단위 카드(§21-4) ──
const unitsOf = map => item => map[item.itemKey] ?? [];
const items = {
  'p.1': [{ unit: 'ko.word.apple', kind: 'word', label: '사과' }],
  'p.2': [{ unit: 'ko.grammar.seyo', kind: 'grammar', label: '-(으)세요' }],
  'p.3': [{ unit: 'family:topik.x', kind: 'family', label: null }],
  'p.4': [{ unit: 'ko.word.pear', kind: 'word', label: null }],
  'l.1': [{ unit: 'ko.life.order', kind: 'life', label: '주문하기' }],
  'p.5': [{ unit: 'ko.word.listen', kind: 'word', label: '듣다' }],
};
const routes = unitRoutes({
  itemUnits: unitsOf(items),
  practice: [
    { itemKey: 'p.1', modality: 'reading' },
    { itemKey: 'p.2', modality: 'reading' },
    { itemKey: 'p.3', modality: 'reading' },
    { itemKey: 'p.4', modality: 'reading' },
    { itemKey: 'p.5', modality: 'listening' },
  ],
  life: [{ itemKey: 'l.1' }],
});

test('카드 — 이름이 서는 단위만(문항 없음 · 이름 null · family: 단위는 뺀다 — 검토 C1), 지금 돌아온 것 다음에 앞으로 돌아올 것', () => {
  const due = [
    { unit: 'ko.grammar.seyo', lapses: 2, sittings: 3 },
    { unit: 'family:topik.x', lapses: 1, sittings: 1 },
    { unit: 'ko.word.pear', lapses: 0, sittings: 2 },
    { unit: 'ko.word.ghost', lapses: 0, sittings: 1 },
  ];
  const units = [
    { unit: 'ko.word.apple', due: false, dueAt: T0 + 3 * DAY, lapses: 0, sittings: 2 },
    { unit: 'ko.life.order', due: false, dueAt: T0 + DAY, lapses: 1, sittings: 2 },
    { unit: 'ko.grammar.seyo', due: true, dueAt: T0 - DAY, lapses: 2, sittings: 3 },
    { unit: 'ko.word.listen', due: false, dueAt: Number.POSITIVE_INFINITY, lapses: 0, sittings: 1 },
  ];
  const cards = recheckCards({ due, units, routes });
  assert.deepEqual(
    cards.map(row => [row.unit, row.dueNow, row.why]),
    [
      ['ko.grammar.seyo', true, null],
      ['ko.life.order', false, 'not-due'],
      ['ko.word.apple', false, 'not-due'],
    ],
    '돌아올 때가 정해지지 않은 단위(dueAt 무한)는 뺀다(카본 A6)',
  );
  assert.equal(cards[0].label, '-(으)세요');
  assert.deepEqual(cards[0].items, ['p.2'], '그 단위가 든 문항만 후보로');
  assert.equal(cards[1].source, 'life');
});

test('카드 — 열 수 없는 까닭: 하루 상한 · 소리를 끈 날(듣기 문항뿐) · 생활 복습이 낼 수 없음, 열둘까지', () => {
  const due = [
    { unit: 'ko.word.apple', lapses: 0, sittings: 2 },
    { unit: 'ko.word.listen', lapses: 0, sittings: 1 },
    { unit: 'ko.life.order', lapses: 1, sittings: 2 },
  ];
  const capped = recheckCards({ due, units: [], routes, capped: true });
  assert.equal(capped.find(row => row.unit === 'ko.word.apple').why, 'capped');
  assert.equal(
    capped.find(row => row.unit === 'ko.life.order').why,
    'capped',
    '하루 상한은 엔진 전체의 값이라 생활 카드도 상한 날에는 열지 않는다(4-3 GB1 — 생활 판정은 상한을 보지 않는다)',
  );
  const cappedNone = recheckCards({ due, units: [], routes, capped: true, lifeOpen: () => false });
  assert.equal(
    cappedNone.find(row => row.unit === 'ko.life.order').why,
    'no-item',
    '늘 그런 까닭(낼 문항 없음)이 오늘만 그런 까닭(상한)보다 앞이다',
  );
  const quiet = recheckCards({ due, units: [], routes, audioAvailable: false });
  assert.equal(quiet.find(row => row.unit === 'ko.word.listen').why, 'audio');
  assert.equal(quiet.find(row => row.unit === 'ko.word.apple').why, null, '읽기 문항은 소리 없이 연다');
  const life = recheckCards({ due, units: [], routes, lifeOpen: unit => unit !== 'ko.life.order' });
  assert.equal(life.find(row => row.unit === 'ko.life.order').why, 'no-item');
  const many = recheckCards({
    due: Array.from({ length: 20 }, () => ({ unit: 'ko.word.apple' })),
    units: Array.from({ length: 20 }, (_, i) => ({ unit: `ko.word.x${i}`, dueAt: T0 + i })),
    routes: new Map(
      Array.from({ length: 20 }, (_, i) => [`ko.word.x${i}`, { unit: `ko.word.x${i}`, label: `x${i}`, life: false, items: ['p'], silent: true }]),
    ),
  });
  assert.equal(many.length, 12);
});

test('카드 — 생활 문항에 든 낱말 단위는 짧은 연습 길이다(생활 판정은 생활 단위만 복습으로 낸다 — 11-16 4c)', () => {
  const both = unitRoutes({
    itemUnits: unitsOf({
      'l.1': [
        { unit: 'ko.life.order', kind: 'life', label: '주문하기' },
        { unit: 'ko.word.tea', kind: 'word', label: '차' },
      ],
      'l.2': [{ unit: 'ko.word.only', kind: 'word', label: '만' }],
      'p.6': [{ unit: 'ko.word.tea', kind: 'word', label: '차' }],
    }),
    practice: [{ itemKey: 'p.6', modality: 'reading' }],
    life: [{ itemKey: 'l.1' }, { itemKey: 'l.2' }],
  });
  assert.equal(both.get('ko.life.order').life, true);
  assert.equal(both.get('ko.word.tea').life, false, '짧은 연습에도 있는 낱말은 짧은 연습으로 연다');
  assert.deepEqual(both.get('ko.word.tea').items, ['p.6']);
  const cards = recheckCards({
    due: [{ unit: 'ko.word.tea' }, { unit: 'ko.word.only' }, { unit: 'ko.life.order' }],
    units: [],
    routes: both,
    lifeOpen: () => true,
  });
  assert.deepEqual(
    cards.map(row => [row.unit, row.source, row.why]),
    [
      ['ko.word.tea', 'practice', null],
      ['ko.word.only', 'practice', 'no-item'],
      ['ko.life.order', 'life', null],
    ],
    '생활 문항에만 있는 낱말은 지금 낼 문항이 없다',
  );
});

// ── 진짜 코치 장면 — 칸이 접힘을 따라온다 ──
test('진짜 코치 · 진짜 지도 — 답한 능력은 접히기 전 연습 중(칸이 따라오는 중 · 아직 칸에 들지 않은 답), 판 끝에 접으면 칸이 든다', async () => {
  const MAP_DATA = {
    index: readJson('../../../packages/atlas/map/index.json'),
    units: readJson('../../../packages/atlas/map/units.json'),
  };
  const { bankItems } = await import('../world-topik-items.mjs');
  const bank = bankItems(readJson('../world-topik-items.json')).filter(
    item => item.skillId === 'ko.reading.detail',
  );
  assert.ok(bank.length >= 5, 'TOPIK 읽기 문항');
  let now = T0;
  const coach = atlas.createCoach({
    gameId: 'world-home',
    mapData: MAP_DATA,
    dayOffset: 540,
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:position-next-${process.pid}`, now: () => now },
  });
  await coach.ready;
  const skills = [{ id: 'ko.reading.detail', domain: 'reading' }];
  const before = buildPositionNext({ skills, summary: coach.summary() });
  assert.equal(before.skills[0].cell, 'notyet');
  // 같은 계열을 피해 처음 보는 문항 다섯을 혼자 맞힌다.
  const families = new Set();
  const fresh = bank.filter(item => !families.has(item.familyKey) && families.add(item.familyKey)).slice(0, 5);
  for (const item of fresh) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    now += 60_000;
  }
  const mid = buildPositionNext({ skills, summary: coach.summary() });
  assert.equal(mid.skills[0].catching, true, '칸이 따라오는 중');
  assert.equal(mid.skills[0].cell, 'practicing', '접히기 전에는 연습 중으로 끌어올림');
  assert.equal(mid.unfolded, true, '아직 칸에 들지 않은 답');
  assert.equal(await coach.finishSet({ kind: 'short' }).folded, true);
  const after = buildPositionNext({ skills, summary: coach.summary() });
  assert.equal(after.skills[0].catching, false);
  assert.equal(after.unfolded, false);
  assert.equal(after.skills[0].answered, fresh.length);
  assert.equal(after.complete, true);
  coach.dispose();
});

test('진짜 계정 길 코치 — 첫 받기가 끊긴 뒤 올리기만 되면 기록이 다 오지 않았고, 받기가 되면 synced()는 처음 실패 그대로인 채 다 왔다(Fable 끝 판 F1 · 설계 주인 11-16 조건 4)', async () => {
  const { rng } = await import('../../../packages/atlas/test/support/seeds.mjs');
  const { createServer } = await import('../../../packages/atlas/test/support/trail-sync.mjs');
  const { bankOf, clock, createCoach, fakeMap, memoryPort, PARAMS } = await import('../../../packages/atlas/test/coach/support.mjs');
  const { subject } = await import('../../../packages/atlas/test/support/subject.mjs');
  const { acquireHost, releaseHost } = await subject('coach/host.mjs');
  const items = bankOf(rng(311), { items: 6 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(312), index: { edition: 'index-t', lookup: key => map.item(key) } });
  await server.fold();
  let offline = false;
  const transport = {
    post: (events, since) => server.post(events, since),
    async get(since) {
      if (offline) throw Object.assign(new Error('NETWORK'), { code: 'NETWORK', retryable: true });
      return { summary: await server.summary(since), serverTime: server.now };
    },
  };
  const time = clock();
  const port = memoryPort();
  const key = `synk-atlas:position-next-pulled-${process.pid}`;
  const host = { guest: false, account: 'acct-pulled', revision: 1, key, port, transport, now: time.now };
  const openCoach = async () => {
    const coach = createCoach({ gameId: 'sync', map, seed: 's', dayOffset: 0, host });
    await coach.ready;
    return { coach, handle: await acquireHost({ key, params: PARAMS, now: time.now, guest: false }) };
  };
  // 앞 문서가 요약을 받아 둔 기기 — 다시 연 문서의 첫 받기가 끊긴다(바탕 요약은 있다).
  const earlier = await openCoach();
  assert.equal((await earlier.coach.synced(1000)).ok, true);
  releaseHost(earlier.handle);
  earlier.coach.dispose();
  offline = true;
  const { coach, handle } = await openCoach();
  try {
    const first = await coach.synced(1000);
    assert.deepEqual([first.ok, first.kind, first.base], [false, 'offline', true]);
    // 올리기만 된다(시험 넷째) — 답을 올려도 받기가 된 적이 없어 기록이 다 오지 않았다.
    await coach.answer(coach.present(items[0]), { correct: true, assessable: true }).stored;
    await handle.upload();
    assert.equal(coach.summary().storage.sync.failures, 0, '올리기는 됐다');
    assert.equal(recordsComplete(coach.summary().storage, first), false, '올리기만 되고 받기는 끊겼다');
    // 뒤의 받기가 된다 — synced()는 처음 실패 그대로이고(§18-5-5 G4의 판 정하기는 그대로), 기록은 다 왔다.
    offline = false;
    await new Promise(resolve => setTimeout(resolve, 0));
    await handle.pull({ force: true });
    const again = await coach.synced(1000);
    assert.deepEqual([again.ok, again.kind], [false, 'offline'], 'synced()는 처음 실패 그대로');
    assert.equal(coach.summary().storage.sync.pulled, true);
    assert.equal(recordsComplete(coach.summary().storage, again), true, '뒤의 받기가 되면 기록이 다 왔다');
  } finally {
    releaseHost(handle);
    coach.dispose();
  }
});

// ── 예상 급수 칸의 새 길 값(4-4d — 단계4_계획 §21-23의 2): 능력 id마다의 근거 수를 시험 · 영역으로 묶어 지금 판 문턱으로 센다 ──
const COUNTS = Object.freeze({
  'ko.listening.detail': 6,
  'ko.listening.main': 5,
  'ko.reading.main': 12,
  'ko.reading.detail': 7, // TOPIK I 30 · 듣기 11 · 읽기 19
  'ko2.reading.detail': 4,
  'ko2.listening.main': 2,
  'ko.writing.sentence': 9, // 쓰기 — 영역이 아니라 세지 않는다
  'world.speaking.answer': 3, // 시험 능력이 아니다
});

test('예상 급수 칸 — 능력 id 앞머리로 시험을, 둘째 마디로 영역을 묶어 지금 판 문턱(전체 30 · 영역별 10)으로 센다(4-4d — §21-23의 2)', () => {
  const one = estimateNext({ bySkill: COUNTS, form: 'topik-i', policy: ESTIMATE_POLICY });
  assert.equal(one.status, 'no-estimator', '문턱을 넘어도 급수는 내지 않는다');
  assert.equal(one.evidence, 30);
  assert.deepEqual(one.perDomain, { listening: 11, reading: 19 });
  assert.equal(one.needed, ESTIMATE_POLICY.minEvidence);
  assert.equal(one.neededPerDomain, ESTIMATE_POLICY.minPerDomain);
  assert.equal(one.grade, null);
  assert.equal(one.range, null);
  assert.equal(one.passClaim, false);
  const two = estimateNext({ bySkill: COUNTS, form: 'topik-ii', policy: ESTIMATE_POLICY });
  assert.equal(two.status, 'too-early');
  assert.equal(two.evidence, 6, 'TOPIK II 능력(ko2.)만');
  assert.deepEqual(two.perDomain, { listening: 2, reading: 4 });
  // 전체는 넘어도 한 영역이 모자라면 이르다
  const thin = estimateNext({ bySkill: { 'ko.reading.main': 25, 'ko.listening.main': 9 }, form: 'topik-i', policy: ESTIMATE_POLICY });
  assert.equal(thin.status, 'too-early');
  assert.equal(thin.evidence, 34);
  // 꼴이 아닌 수는 세지 않는다
  const odd = estimateNext({ bySkill: { 'ko.reading.main': -3, 'ko.listening.main': 2.5, 'ko.reading.detail': '4', 'ko.reading.x': 1 }, form: 'topik-i', policy: ESTIMATE_POLICY });
  assert.equal(odd.evidence, 1);
});

test('예상 급수 칸 — 근거 수를 모르면(null) 「확인 중」이고 수를 세지 않는다 · 빈 근거(0)는 이르다 · IBT로 본다고 하면 지금 판처럼 잇지 않는다', () => {
  const unknown = estimateNext({ bySkill: null, form: 'topik-i', policy: ESTIMATE_POLICY });
  assert.equal(unknown.status, 'checking');
  assert.equal(unknown.evidence, 0);
  const empty = estimateNext({ bySkill: {}, form: 'topik-i', policy: ESTIMATE_POLICY });
  assert.equal(empty.status, 'too-early', '빈 근거는 아는 0이다');
  assert.equal(estimateNext({ bySkill: COUNTS, form: 'topik-i', mode: 'ibt', policy: ESTIMATE_POLICY }).status, 'mode-unsupported');
  assert.equal(estimateNext({ bySkill: null, form: 'topik-i', mode: 'ibt', policy: ESTIMATE_POLICY }).status, 'mode-unsupported');
  assert.throws(() => estimateNext({ bySkill: COUNTS, form: 'topik-i' }), /policy/, '문턱 정책이 없으면 던진다(셸은 그 칸을 비운다)');
  // 근거를 읽지 못했으면(근거 상자가 그 자리에서 묻기를 그만두었다) 「확인 중」이 아니라 읽지 못함이다(설계 주인 11-17 저녁 답 4 나).
  const unread = estimateNext({ bySkill: null, unread: true, form: 'topik-i', policy: ESTIMATE_POLICY });
  assert.equal(unread.status, 'unread');
  assert.equal(unread.evidence, 0);
  assert.deepEqual(estimateNext({ bySkill: COUNTS, unread: true, form: 'topik-i', policy: ESTIMATE_POLICY }), estimateNext({ bySkill: COUNTS, form: 'topik-i', policy: ESTIMATE_POLICY }), '수를 알면 수가 이긴다');
  assert.equal(estimateNext({ bySkill: null, unread: true, mode: 'ibt', policy: ESTIMATE_POLICY }).status, 'mode-unsupported', 'IBT는 그대로');
  assert.equal(estimateNext({ bySkill: null, unread: 'yes', policy: ESTIMATE_POLICY }).status, 'checking', '참일 때만');
});

test('새 판 그림 — 예상 급수 칸은 모를 때 「기록 확인 중」만, 알면 모은 답 수를, 시험 형식을 열 수 있으면 단추를 단다(4-4d)', () => {
  // 글 열쇠와 값을 그대로 보이는 t — 값은 따옴표 없이 잇는다(그림이 글을 이스케이프한다).
  const t = (key, values = {}) => {
    const pairs = Object.entries(values).map(([name, value]) => `${name}=${value}`);
    return pairs.length ? `${key}(${pairs.join(',')})` : key;
  };
  const view = createPositionNextView({ t });
  const board = { exam: 'topik1', skills: [], attention: [], counts: { independent: 0, practicing: 0, notyet: 0 }, total: 0, complete: true, unfolded: false, catching: false, domains: {}, carried: null };
  const draw = (estimate, mock = null) => view.board({ board, estimate, mock });
  const unknown = draw(estimateNext({ bySkill: null, policy: ESTIMATE_POLICY }));
  assert.match(unknown, /data-estimate="checking"/);
  assert.match(unknown, /homeTutor\.checking/, '「기록 확인 중」');
  assert.ok(!unknown.includes('position.estimate.collected'), '수를 그리지 않는다');
  assert.ok(!unknown.includes('data-evidence'), '수 칸도 없다');
  const known = draw(estimateNext({ bySkill: COUNTS, form: 'topik-ii', policy: ESTIMATE_POLICY }), { minutes: 26 });
  assert.match(known, /data-estimate="too-early" data-evidence="6" data-listening="2" data-reading="4"/);
  assert.match(known, /position\.estimate\.early/);
  assert.match(known, /position\.estimate\.collected\(n=6,listening=2,reading=4\)/);
  assert.match(known, /<button[^>]*data-position-mock>mock\.open\(minutes=26\)/, '시험 형식 단추');
  const none = draw(estimateNext({ bySkill: {}, policy: ESTIMATE_POLICY }));
  assert.ok(!none.includes('position.estimate.collected'), '모은 답이 0이면 수 줄은 없다');
  assert.ok(!none.includes('data-position-mock'), '열 수 없으면 단추가 없다');
  assert.ok(!draw(null).includes('data-estimate'), '값이 없으면 칸이 없다');
  // 읽지 못함 — 상태 줄 없이 그린다(「기록 확인 중」도 수도 없다). 시험 형식 단추는 그대로 단다(설계 주인 11-17 저녁 답 4 나).
  const unread = draw(estimateNext({ bySkill: null, unread: true, policy: ESTIMATE_POLICY }), { minutes: 26 });
  assert.match(unread, /data-estimate="unread"/);
  assert.ok(!unread.includes('homeTutor.checking'), '「기록 확인 중」이 없다');
  assert.ok(!unread.includes('wpos-estimate-state'), '상태 줄이 없다');
  assert.ok(!unread.includes('data-evidence') && !unread.includes('position.estimate.collected'), '수가 없다');
  assert.match(unread, /<button[^>]*data-position-mock>/, '시험 형식 단추는 그대로');
});
