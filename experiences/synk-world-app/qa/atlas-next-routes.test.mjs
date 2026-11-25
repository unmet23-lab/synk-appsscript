// 4-6e-2 길 표(단계4_계획 §25-3 불변식 다 — world-home-games.mjs createRoutes · routeFrom)와 홈 숙제 줄의 길(world-today.mjs homeworkActivities)을
// 본다. 진짜 엔진 코치(손님 메모리 저장소) · 진짜 지도 조각 · 진짜 짧은 연습 풀로 돈다. 셸의 배선(계획 · 홈 · 내 위치가 같은 길 표 한 벌을 읽음)은
// qa/atlas-next-routes-shell.test.mjs가 본다. 변형 시험(qa/today-mutants.mjs)은 깬 사본을 SYNK_HOME_GAMES_MODULE · SYNK_TODAY_MODULE로 넘긴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { sliceOf } from '../../../packages/atlas/tools/map-ship.mjs';
import { worldPosition } from '../world-position-kit.mjs';
import { homeBanksOf } from '../world-atlas-next.mjs';
import { createPracticeNextSession } from '../world-practice-next.mjs';

const moduleOf = (name, fallback) => (process.env[name] ? pathToFileURL(process.env[name]).href : new URL(fallback, import.meta.url).href);
const HG = await import(moduleOf('SYNK_HOME_GAMES_MODULE', '../world-home-games.mjs'));
const { todayActivities, HOMEWORK_PREFIX } = await import(moduleOf('SYNK_TODAY_MODULE', '../world-today.mjs'));
const { createRoutes, routeFrom, homeGames } = HG;

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const INDEX = readJson('../../../packages/atlas/map/index.json');
const UNITS = readJson('../../../packages/atlas/map/units.json');
const WORDS = readJson('../../../packages/atlas/map/words.json');
worldPosition.topik.use(readJson('../world-topik-items.json'));
const PRACTICE = worldPosition.practice.pool;
const DIAGNOSTIC = worldPosition.items;
const MOCK = worldPosition.mock.pool;
const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 18, 1, 0, 0);
const listening = item => item.audioRequired ?? item.modality === 'listening';
const PLAYS = { allowedPlays: () => 2, nextPlay: () => 'first' };
const DETAIL = 'ko.listening.detail';
// 바람길 듣기 확인의 ko.listening.detail 네 문항은 단위가 모두 G211이다 — 이 단위가 든 짧은 연습 문항(읽기)을 놓치면 넷이 함께 돌아온다.
const G211_READING = 'blank-slice.e06.v2';
// 리듬 t0q0(ko.listening.detail 두 문항)의 단위 G302가 든 짧은 연습 문항(읽기).
const G302_READING = 'blank-slice.e07.v2';

let stores = 0;
async function homeCoach({ start = T0 } = {}) {
  stores += 1;
  let now = start;
  const banks = homeBanksOf(PRACTICE);
  const coach = atlas.createCoach({
    gameId: 'world-home',
    mapData: { index: banks.map(bank => sliceOf(INDEX, bank, WORDS)), units: UNITS, words: WORDS },
    dayOffset: 540,
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:routes-${process.pid}-${stores}`, now: () => now },
  });
  await coach.ready;
  return { coach, time: { advance: ms => (now += ms), get t() { return now; } } };
}
async function answer(coach, item, correct = true) {
  const pid = coach.present({ itemKey: item.itemKey });
  if (listening(item)) coach.delivery(pid, { audio: 'completed' });
  await coach.answer(pid, { correct, assessable: true }).stored;
}
// 띄우기만 하고 닫는다(답 없음) — 저장이 끝나야 묶음 만남에 비친다.
async function showOnly(coach, item) {
  coach.present({ itemKey: item.itemKey });
  await new Promise(resolve => setTimeout(resolve, 15));
}
const itemOf = key => PRACTICE.find(item => item.itemKey === key);
const gamesNow = (options = {}) => homeGames({ progress: {}, settings: { targetGrade: 2 }, storage: null, ...options });
const routesOf = (coach, options = {}) =>
  createRoutes({ coach, diagnostic: DIAGNOSTIC, practice: PRACTICE, mock: MOCK, games: gamesNow(), itemUnits: key => coach.itemUnits(key), ...options });
// 씨앗을 고정한 의사 난수(mulberry32).
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('안쪽 함수(routeFrom)는 그 능력 밖의 문항을 받으면 던진다 — 다른 능력의 짧은 연습 문항도, 게임 문항도(설계 주인 25-12의 10)', () => {
  const own = PRACTICE.find(item => item.skillId === DETAIL);
  const other = PRACTICE.find(item => item.skillId === 'ko.reading.detail');
  const [runner] = gamesNow();
  const foreignGame = runner.items.find(item => item.skillId !== DETAIL);
  const ownGame = runner.items.find(item => item.skillId === DETAIL);
  assert.equal(routeFrom(DETAIL, [{ kind: 'practice', item: own, fresh: true }]).route, 'practice');
  assert.throws(() => routeFrom(DETAIL, [{ kind: 'practice', item: own, fresh: true }, { kind: 'practice', item: other, fresh: true }]), TypeError, '다른 능력의 짧은 연습 문항');
  assert.throws(() => routeFrom(DETAIL, [{ kind: 'game', game: runner, item: foreignGame, fresh: true, returned: false }]), TypeError, '다른 능력의 게임 문항');
  assert.equal(routeFrom(DETAIL, [{ kind: 'game', game: runner, item: ownGame, fresh: true, returned: false }]).gameId, 'runner');
  // 짧은 연습이 먼저다 — 처음 보는 짧은 연습 문항이 하나라도 있으면 게임이 남아도 짧은 연습이다.
  const both = routeFrom(DETAIL, [
    { kind: 'game', game: runner, item: ownGame, fresh: true, returned: false },
    { kind: 'practice', item: own, fresh: true },
  ]);
  assert.equal(both.route, 'practice');
  assert.deepEqual(both.games.map(game => game.gameId), ['runner'], '게임 차례는 함께 낸다(계획의 듣기 근거)');
});

test('길 표는 묶음 만남 한 번에 진단 · 짧은 연습 · 시험 형식 · 게임 · 입장 검사를 이 차례로 묻고, 만남 줄을 갈래마다 그 풀의 길이로 낸다', async () => {
  const { coach } = await homeCoach();
  const asked = [];
  const sent = [];
  const counting = { ...coach, exposures: items => (asked.push(items.length), sent.push(items.map(item => item.itemKey)), coach.exposures(items)) };
  const games = gamesNow();
  const gameItems = games.flatMap(game => game.items);
  // 입장 검사 은행의 문항 가운데 다른 풀에 없는 것이고 하나는 이미 만났다 — 어느 풀의 앞 · 끝에서 자른 만남과도 다르다(사슬 -c GB4 · -d GA4).
  const used = new Set([...DIAGNOSTIC, ...PRACTICE, ...MOCK, ...gameItems].map(item => item.itemKey));
  const col = name => INDEX.fields.indexOf(name);
  const entry = INDEX.items
    .filter(row => row[col('bank')] === 'entry-check' && String(row[col('skillId')]).includes('.reading.') && !used.has(row[col('itemKey')]))
    .slice(0, 3)
    .map(row => ({ itemKey: row[col('itemKey')], skillId: row[col('skillId')], modality: 'reading' }));
  assert.equal(entry.length, 3);
  await answer(coach, entry[1]);
  for (const [name, pool] of Object.entries({ DIAGNOSTIC, PRACTICE, MOCK, gameItems }))
    for (const part of [pool.slice(0, 3), pool.slice(-3)]) assert.notDeepEqual(coach.exposures(entry), coach.exposures(part), `${name} 묶음의 만남과 다르다`);
  const routes = createRoutes({ coach: counting, diagnostic: DIAGNOSTIC, practice: PRACTICE, mock: MOCK, entry, games, itemUnits: key => coach.itemUnits(key) });
  assert.deepEqual(asked, [DIAGNOSTIC.length + PRACTICE.length + MOCK.length + gameItems.length + entry.length], '묶음 만남은 한 번');
  // 차례 그대로 — 문항과 만남 줄이 갈래마다 짝이 맞는다(4-6e-2 검수 GPT GB4).
  assert.deepEqual(sent[0], [...DIAGNOSTIC, ...PRACTICE, ...MOCK, ...gameItems, ...entry].map(item => item.itemKey), '진단 · 짧은 연습 · 시험 형식 · 게임 · 입장 검사 차례');
  const metOf = items => coach.exposures(items);
  assert.deepEqual(routes.rows.entry, metOf(entry), '입장 검사 몫의 줄은 그 문항들의 만남이다');
  assert.deepEqual(routes.rows.games, metOf(gameItems), '게임 몫의 줄은 게임 문항들의 만남이다');
  assert.deepEqual(routes.rows.mock, metOf(MOCK));
  assert.equal(routes.rows.diagnostic.length, DIAGNOSTIC.length);
  assert.equal(routes.rows.practice.length, PRACTICE.length);
  assert.equal(routes.rows.mock.length, MOCK.length, '시험 형식 몫은 그 풀의 길이만큼 — 「나머지 전부」가 아니다');
  assert.equal(routes.rows.games.length, gameItems.length);
  assert.equal(routes.rows.entry.length, entry.length);
  routes.routeOf(DETAIL);
  routes.routeOf('ko.reading.detail');
  assert.equal(asked.length, 1, '길을 물어도 만남을 다시 묻지 않는다');
  // 「ko.listening.word」는 짧은 연습 풀에도 홈 게임에도 문항이 없다 — 길이 없다(모자람, 옛 길과 같다 — 25-12의 2).
  const word = routes.routeOf('ko.listening.word');
  assert.equal(word.route, null);
  assert.deepEqual([word.practice.length, word.games.length], [0, 0]);
  coach.dispose();
});

test('실제 세트 ti-l-e-s01 — ti-l-e-001을 만났고 ti-l-e-002의 능력에 다른 새 문항이 없으면, 그 능력의 짧은 연습 새 문항은 0이고 길은 게임이다(v6 검토)', async () => {
  const { coach } = await homeCoach();
  const first = itemOf('topik-items.ti-l-e-001.v1');
  const second = itemOf('topik-items.ti-l-e-002.v1');
  assert.equal(first.setId, 'ti-l-e-s01');
  assert.equal(second.setId, 'ti-l-e-s01');
  assert.notEqual(first.skillId, second.skillId, '같은 세트의 다른 능력');
  const skill = second.skillId;
  await answer(coach, first);
  for (const item of PRACTICE.filter(row => row.skillId === skill && row !== second)) await answer(coach, item);
  const routes = routesOf(coach);
  const route = routes.routeOf(skill);
  assert.equal(route.practice.length, 0, '같은 세트의 다른 능력 문항을 만났으니 ti-l-e-002는 처음 보는 문항이 아니다');
  assert.equal(route.route, 'game');
  assert.equal(route.gameId, 'rhythm', '리듬 곡 문항에 그 능력의 처음 보는 문항이 남았다');
  // 실제 짧은 연습도 같은 답이다(세트는 풀 전체에서 찾는다 — 셸의 runPracticeNext와 같은 setPool).
  const session = createPracticeNextSession({ coach, pool: PRACTICE.filter(item => item.skillId === skill), setPool: PRACTICE, length: 5, plays: PLAYS });
  assert.equal(session.freshLeft(), 0);
  coach.dispose();
});

test('띄우기만 하고 닫은 마지막 짧은 연습 문항은 아직 처음 보는 문항이다 — 길은 짧은 연습이고 실제 짧은 연습도 그 문항을 낸다(측정용 met, 화면용 seen이 아니다)', async () => {
  const { coach } = await homeCoach();
  const skill = 'ko2.reading.structure';
  const items = PRACTICE.filter(item => item.skillId === skill);
  const last = items.at(-1);
  for (const item of items.slice(0, -1)) await answer(coach, item);
  await showOnly(coach, last);
  const routes = routesOf(coach);
  assert.equal(routes.rows.practice[PRACTICE.indexOf(last)].seen, true, '화면용으로는 봤다');
  const route = routes.routeOf(skill);
  assert.deepEqual(route.practice, [last]);
  assert.equal(route.route, 'practice');
  const session = createPracticeNextSession({ coach, pool: items, setPool: PRACTICE, length: 5, plays: PLAYS });
  assert.equal(session.freshLeft(), 1);
  coach.dispose();
});

test('대조 시험 — 씨앗을 고정한 무작위 기억 상태 여럿에서, 길 표가 「짧은 연습」이라고 한 능력은 실제 짧은 연습의 freshLeft()가 1 이상이고 아니면 0이다(설계 주인 25-12의 12 · 14)', async () => {
  const skills = [...new Set(PRACTICE.map(item => item.skillId))].sort();
  const seen = { practice: 0, other: 0 };
  for (const seed of [11, 23, 37, 41, 53, 67]) {
    const random = seeded(seed);
    const { coach } = await homeCoach();
    // 능력 넷을 골라 문항마다 답 · 띄우기만 · 그대로를 무작위로 — 첫째는 세트가 있는 TOPIK I 듣기 능력이고 문항을 거의 다 쓴다(남는 것은 띄우기만 한
    // 문항뿐일 수 있다).
    const exhausted = skills.filter(id => /^ko\.listening\./.test(id))[Math.floor(random() * 7)];
    const picked = new Set([exhausted]);
    while (picked.size < 4) picked.add(skills[Math.floor(random() * skills.length)]);
    for (const item of PRACTICE.filter(row => picked.has(row.skillId))) {
      const roll = random();
      if (roll < (item.skillId === exhausted ? 0.9 : 0.6)) await answer(coach, item, random() < 0.8);
      else if (roll < (item.skillId === exhausted ? 0.97 : 0.75)) coach.present({ itemKey: item.itemKey });
    }
    await new Promise(resolve => setTimeout(resolve, 20));
    const routes = routesOf(coach);
    for (const skill of skills) {
      const route = routes.routeOf(skill);
      const session = createPracticeNextSession({ coach, pool: PRACTICE.filter(item => item.skillId === skill), setPool: PRACTICE, length: 5, plays: PLAYS });
      const left = session.freshLeft();
      assert.equal(route.route === 'practice', left >= 1, `씨앗 ${seed} · ${skill} — 길 ${route.route} · freshLeft ${left}`);
      assert.equal(route.practice.length, left, `씨앗 ${seed} · ${skill} — 처음 보는 문항 수가 같다`);
      seen[route.route === 'practice' ? 'practice' : 'other'] += 1;
    }
    coach.dispose();
  }
  assert.ok(seen.practice > 0 && seen.other > 0, `두 갈래가 모두 나온다 — ${JSON.stringify(seen)}`);
});

test('게임 길 — 처음 보는 문항이 남은 게임의 차례. 앞 게임의 처음 보는 문항이 모두 돌아온 단위에 걸리면 뒤 게임이 앞으로 오고, 돌아온 단위는 물을 때마다 읽는다(v7 검토)', async () => {
  const { coach, time } = await homeCoach();
  // 짧은 연습 풀에서 이 능력을 빼 게임 길만 본다(셸 시험은 실제 풀로 같은 장면을 본다).
  const practice = PRACTICE.filter(item => item.skillId !== DETAIL);
  await answer(coach, itemOf(G211_READING), false);
  const routes = routesOf(coach, { practice });
  const before = routes.routeOf(DETAIL);
  assert.equal(before.route, 'game');
  assert.deepEqual(before.games.map(game => game.gameId), ['runner', 'rhythm'], '돌아온 단위가 없으면 목록 차례');
  assert.equal(before.gameId, 'runner');
  // 시각만 지난다(쓰기 · 받기 알림 없음) — 같은 길 표에 다시 묻는다.
  for (let hours = 0; hours < 48 && !coach.due().some(row => row.unit === 'ko.grammar.G211'); hours += 1) time.advance(HOUR);
  assert.ok(coach.due().some(row => row.unit === 'ko.grammar.G211'), 'G211이 돌아왔다');
  const after = routes.routeOf(DETAIL);
  assert.deepEqual(after.games.map(game => [game.gameId, game.left > 0]), [['rhythm', true], ['runner', false]], '바람길의 처음 보는 문항이 모두 돌아온 단위에 걸렸다');
  assert.equal(after.gameId, 'rhythm');
  assert.equal(after.games[1].items.length, 4, '돌아온 단위에 걸린 문항도 처음 보는 문항이다(그날 복습 칸이 맡는다)');
  coach.dispose();
});

test('게임 문항의 처음 보는가는 묶음 만남의 게임 몫(seen === false)이다 — 띄우기만 하고 닫은 게임 문항은 처음이 아니다(셋째 판 확인 N1)', async () => {
  const { coach } = await homeCoach();
  const practice = PRACTICE.filter(item => item.skillId !== DETAIL);
  const [runner] = gamesNow();
  const shown = runner.items.filter(item => item.skillId === DETAIL);
  // 바람길의 이 능력 문항을 모두 띄우기만 한다 — 바람길은 이 능력의 게임 길에서 빠진다.
  for (const item of shown) coach.present({ itemKey: item.itemKey });
  await new Promise(resolve => setTimeout(resolve, 20));
  const route = createRoutes({ coach, practice, games: gamesNow(), itemUnits: key => coach.itemUnits(key) }).routeOf(DETAIL);
  assert.deepEqual(route.games.map(game => game.gameId), ['rhythm']);
  assert.equal(route.gameId, 'rhythm');
  coach.dispose();
});

// 홈 숙제 줄(§25-3 「네 화면」 — homeworkActivities). 계획이 낸 숙제 줄을 그대로 넘긴다.
const homeworkOf = (routes, coach, rows, settings = {}, dueUnits = null) =>
  todayActivities({
    settings,
    engine: true,
    pool: PRACTICE,
    dueUnits: dueUnits ?? new Set(coach.due().map(row => row.unit)),
    itemUnits: key => coach.itemUnits(key),
    week: { examPlan: { homework: rows }, routes },
    labels: id => id,
  }).filter(act => act.role === 'homework');

test('홈 숙제 줄은 그 능력의 길로 연다 — 게임 길이면 그 게임의 처음 보는 문항 가운데 돌아온 단위가 든 것을 뺀 것이 후보이고, 활동 id는 그대로다', async () => {
  const { coach, time } = await homeCoach();
  const practice = PRACTICE.filter(item => item.skillId !== DETAIL);
  await answer(coach, itemOf(G211_READING), false);
  await answer(coach, itemOf(G302_READING), false);
  for (let hours = 0; hours < 48 && !['ko.grammar.G211', 'ko.grammar.G302'].every(unit => coach.due().some(row => row.unit === unit)); hours += 1)
    time.advance(HOUR);
  const routes = routesOf(coach, { practice });
  const route = routes.routeOf(DETAIL);
  assert.equal(route.gameId, 'rhythm', '바람길은 모두 돌아온 단위에 걸렸다');
  const row = { skillId: DETAIL, domain: 'listening', status: 'missed', fresh: 0, activities: route.games.map(game => game.id) };
  const [act] = homeworkOf(routes, coach, [row]);
  assert.equal(act.plan.id, `${HOMEWORK_PREFIX}${DETAIL}`, '활동 id는 길과 상관없이 그대로');
  assert.equal(act.open.route, 'game');
  assert.equal(act.open.gameId, 'rhythm', '단추는 셸의 짧은 이름으로 연다');
  assert.equal(act.kind, 'new', '오늘 공부 칸');
  const keys = act.plan.candidates.map(candidate => candidate.itemKey);
  const rhythm = route.games[0].items.map(item => item.itemKey);
  assert.ok(keys.length > 0 && keys.length < rhythm.length);
  assert.ok(keys.every(key => rhythm.includes(key)), '그 게임의 처음 보는 문항');
  assert.ok(!keys.some(key => /t0q0/.test(key)), '돌아온 단위(G302)가 든 문항은 뺀다 — 그날 복습 칸이 맡는다');
  assert.deepEqual(act.plan.facts.goals, [{ kind: 'homework', skill: DETAIL, status: 'missed' }]);
  // 소리를 끈 날은 잠근다(풀어서 한 번 더 셈할 몫을 든다).
  const [locked] = homeworkOf(routes, coach, [row], { audio: 'off' });
  assert.equal(locked.blocked, 'audio.unavailable');
  assert.equal(locked.open.route, 'game');
  assert.equal(locked.unlocked.candidates.length, keys.length);
  // 모든 게임의 처음 보는 문항이 돌아온 단위에 걸린 날 — 후보가 없다(줄이 서지 않고 계획 판 단추만 남는다, 25-12의 9).
  const allDue = new Set([...route.games.flatMap(game => game.items.flatMap(item => coach.itemUnits(item.itemKey).map(unit => unit.unit)))]);
  const [dry] = homeworkOf(routes, coach, [row], {}, allDue);
  assert.equal(dry.plan.candidates.length, 0);
  coach.dispose();
});

test('홈 숙제 줄 — 짧은 연습 길이면 그 능력의 처음 보는 짧은 연습 문항(실제 짧은 연습의 판정)이 후보다. 소리를 끈 날 처음 보는 짧은 연습이 남은 듣기 숙제는 짧은 연습 길로 잠긴다(계획의 fresh로 가르지 않는다)', async () => {
  const { coach } = await homeCoach();
  const routes = routesOf(coach);
  const route = routes.routeOf(DETAIL);
  assert.equal(route.route, 'practice');
  // 소리를 끈 날 계획은 듣기 짧은 연습을 세지 않아 숙제 줄의 fresh가 0이다 — 그래도 길은 짧은 연습이다.
  const row = { skillId: DETAIL, domain: 'listening', status: 'missed', fresh: 0, activities: route.games.map(game => game.id) };
  const [locked] = homeworkOf(routes, coach, [row], { audio: 'off' });
  assert.equal(locked.open.route, 'practice', '짧은 연습 길로 잠긴다');
  assert.equal(locked.blocked, 'audio.unavailable');
  const [open] = homeworkOf(routes, coach, [{ ...row, fresh: route.practice.length }]);
  assert.equal(open.open.route, 'practice');
  assert.deepEqual(open.plan.candidates.map(candidate => candidate.itemKey), route.practice.map(item => item.itemKey));
  // 띄우기만 한 문항(화면용 seen)도 후보다 — 실제 짧은 연습이 그 문항을 낸다.
  const shown = route.practice[0];
  await showOnly(coach, shown);
  const again = routesOf(coach);
  const [after] = homeworkOf(again, coach, [{ ...row, fresh: 1 }]);
  assert.ok(after.plan.candidates.some(candidate => candidate.itemKey === shown.itemKey));
  coach.dispose();
});

test('홈 숙제 줄 — 길 표 없이 fresh만 넘기는 앞 공개판 셸(③)과 짝지어도 숙제 줄이 선다: 그 셸의 규칙 그대로 그 능력의 처음 보는 짧은 연습 문항에서 돌아온 단위를 뺀 것이 후보다(새 사슬 GC2)', async () => {
  const { coach } = await homeCoach();
  const row = { skillId: DETAIL, domain: 'listening', status: 'missed', fresh: 3, activities: [] };
  const items = PRACTICE.filter(item => item.skillId === DETAIL);
  const met = coach.exposures(PRACTICE);
  const fresh = item => met[PRACTICE.indexOf(item)]?.seen === false;
  const homeworkWith = (week, settings = {}, dueUnits = new Set()) =>
    todayActivities({ settings, engine: true, pool: PRACTICE, dueUnits, itemUnits: key => coach.itemUnits(key), week: { examPlan: { homework: [row] }, ...week }, labels: id => id }).filter(act => act.role === 'homework');
  const keysOf = act => act.plan.candidates.map(candidate => candidate.itemKey);
  const [act] = homeworkWith({ fresh });
  assert.ok(act, '숙제 줄이 빠지지 않는다');
  assert.equal(act.plan.id, `${HOMEWORK_PREFIX}${DETAIL}`);
  assert.equal(act.open.route, 'practice', '앞 공개판 셸에는 게임 길이 없다');
  assert.deepEqual(keysOf(act), items.map(item => item.itemKey), '그 능력의 처음 보는 짧은 연습 문항');
  // 본 문항과 돌아온 단위가 든 문항은 뺀다(지금 판 ③과 같은 거름).
  const [seen] = homeworkWith({ fresh: item => item !== items[0] && fresh(item) });
  assert.deepEqual(keysOf(seen), items.slice(1).map(item => item.itemKey));
  const due = new Set(coach.itemUnits(items[0].itemKey).map(unit => unit.unit));
  const kept = items.filter(item => !coach.itemUnits(item.itemKey).some(unit => due.has(unit.unit)));
  const [returned] = homeworkWith({ fresh }, {}, due);
  assert.ok(kept.length < items.length);
  assert.deepEqual(keysOf(returned), kept.map(item => item.itemKey));
  // 소리를 끈 날은 잠근다.
  assert.equal(homeworkWith({ fresh }, { audio: 'off' })[0].blocked, 'audio.unavailable');
  // 길 표를 넘기면 fresh는 보지 않는다 · 둘 다 없으면 줄이 없다.
  const [both] = homeworkWith({ routes: routesOf(coach), fresh: () => false });
  assert.deepEqual(keysOf(both), routesOf(coach).routeOf(DETAIL).practice.map(item => item.itemKey));
  assert.deepEqual(homeworkWith({}), []);
  coach.dispose();
});

test('길 표의 읽개 — 여러 능력을 한 번에 물어도 돌아온 단위를 한 번만 읽고, 처음 보는 게임 문항이 없는 능력에는 읽지 않는다. 새 읽개는 그때의 돌아온 단위를 읽는다(사슬 -c GC3)', async () => {
  const { coach, time } = await homeCoach();
  let asked = 0;
  const counting = { ...coach, due: () => ((asked += 1), coach.due()) };
  await answer(coach, itemOf(G211_READING), false);
  const practice = PRACTICE.filter(item => item.skillId !== DETAIL);
  const routes = routesOf(counting, { practice });
  const skills = [...new Set([...routes.pools.practice, ...routes.pools.games].map(item => item.skillId))];
  assert.equal(asked, 0, '표를 지을 때는 읽지 않는다');
  const read = routes.reader();
  const listed = skills.map(id => read(id));
  assert.equal(asked, 1, '능력이 여럿이어도 한 번');
  assert.deepEqual(listed, skills.map(id => routes.routeOf(id)), '읽개와 routeOf의 답이 같다');
  assert.ok(listed.some(route => route.games.length > 0));
  asked = 0;
  for (const id of skills.filter(id => !listed[skills.indexOf(id)].games.length)) routes.routeOf(id);
  assert.equal(asked, 0, '처음 보는 게임 문항이 없는 능력에는 읽지 않는다');
  const none = createRoutes({ coach: counting, practice, games: [], itemUnits: key => coach.itemUnits(key) }).reader();
  for (const id of skills) none(id);
  assert.equal(asked, 0, '게임이 없는 문서는 읽지 않는다');
  // 시각만 지난다 — 앞서 받은 읽개는 그대로, 새로 받은 읽개와 routeOf는 그때의 돌아온 단위를 읽는다.
  const before = read(DETAIL).gameId;
  for (let hours = 0; hours < 48 && !coach.due().some(row => row.unit === 'ko.grammar.G211'); hours += 1) time.advance(HOUR);
  assert.notEqual(routes.reader()(DETAIL).gameId, before, '돌아온 단위에 걸린 게임이 뒤로 간다');
  assert.equal(routes.routeOf(DETAIL).gameId, routes.reader()(DETAIL).gameId);
  coach.dispose();
});

test('손님에게 닫힌 게임과 해금 전 환승은 길 표의 게임 길에 없다', async () => {
  const { coach } = await homeCoach();
  const practice = PRACTICE.filter(item => item.skillId !== DETAIL);
  const closed = createRoutes({ coach, practice, games: gamesNow({ openGames: ['hangul'] }), itemUnits: key => coach.itemUnits(key) });
  assert.equal(closed.routeOf(DETAIL).route, null, '손님에게 닫힌 게임은 길이 아니다');
  const locked = createRoutes({ coach, practice, games: gamesNow(), itemUnits: key => coach.itemUnits(key) });
  assert.ok(!locked.routeOf(DETAIL).games.some(game => game.gameId === 'subway'), '해금 전 환승');
  const opened = createRoutes({
    coach,
    practice,
    games: gamesNow({ progress: { lessons: { 'greetings-expressions': { completedAt: T0 - HOUR, startedAt: T0 - 2 * HOUR, answers: {} } } } }),
    itemUnits: key => coach.itemUnits(key),
  });
  assert.ok(opened.routeOf(DETAIL).games.some(game => game.gameId === 'subway'), '해금 뒤 환승이 든다');
  coach.dispose();
});

test('첫 등굣길 학생이 그 난도에서 낼 수 있는 환승 문항을 다 만났으면, 옛 후보 함수에만 있는 문항(종각 갈래 등)이 남아도 환승은 게임 길이 아니다(§25-1 · 25-3)', async () => {
  const { coach } = await homeCoach();
  const practice = PRACTICE.filter(item => item.skillId !== DETAIL);
  const opened = { lessons: { 'greetings-expressions': { completedAt: T0 - HOUR, startedAt: T0 - 2 * HOUR, answers: {} } } };
  const list = gamesNow({ progress: opened });
  const subway = list.find(game => game.gameId === 'subway');
  assert.equal(subway.items.length, 25, '목표 2급 — 첫 등굣길');
  for (const item of subway.items.filter(row => row.skillId === DETAIL)) await answer(coach, item);
  const route = createRoutes({ coach, practice, games: list, itemUnits: key => coach.itemUnits(key) }).routeOf(DETAIL);
  assert.ok(!route.games.some(game => game.gameId === 'subway'), '게임이 내는 결정을 다 만났다 — 옛 후보 함수의 종각 갈래 · 하차 문항은 목록에 없다');
  assert.ok(route.games.length > 0, '다른 게임은 남는다');
  coach.dispose();
});
