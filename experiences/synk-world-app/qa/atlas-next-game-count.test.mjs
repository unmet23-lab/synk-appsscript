// 4-6e-2 게임 판의 한 수(불변식 나)와 곁 기록의 열쇠(불변식 가) — 단계4_계획 §25-3 「시험」의 「한 수(나)」 · 「열쇠(가)」. 진짜 엔진 코치(손님 메모리
// 저장소)와 진짜 입구(world-atlas-next.mjs)로 돈다. 게임 문(world-atlas-game.mjs)은 입구가 문을 만들 때 넘기는 것과 같은 입구 자리(gameCoach · retired ·
// ended)로 연다. 엔진의 순간 맞춤 내용 기억은 입구와 같은 기기 저장소에 둔다(앱에서는 둘 다 localStorage다).
// 변형 시험(qa/plan-mutants.mjs의 game · entry 갈래)은 깬 문 사본을 SYNK_ATLAS_GAME_MODULE로, 깬 입구 사본을 SYNK_ATLAS_NEXT_MODULE로 넘긴다. 그 밖에는 원본이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import * as flowMemory from '../../../packages/atlas/src/coach/flow-memory.mjs';
import { createRehearsalTrail } from '../rehearsal-trail.mjs';
import * as examPlan from '../world-exam-plan.mjs';
import { worldLearning } from '../world-learning-map.mjs';
import { buildPlanNext, createPlanLog, PLAN_LOG_PREFIX, planBoard, planLogKey, planReader, sideKey } from '../world-plan-next.mjs';
import { FLOW_RUSH, FLOW_WORDS, orderMetadata } from '../../order-rush/learning.mjs';
import { ORDERS } from '../../order-rush/core.mjs';
import { checkMetadata, LISTENING_CHECKS } from '../../korean-runner/listening-check.mjs';

const moduleOf = (name, fallback) => (process.env[name] ? pathToFileURL(process.env[name]).href : new URL(fallback, import.meta.url).href);
const door = await import(moduleOf('SYNK_ATLAS_GAME_MODULE', '../world-atlas-game.mjs'));
const { createAtlasNext, createWriteCount, rehearsalTrail, SWITCH_MARK } = await import(moduleOf('SYNK_ATLAS_NEXT_MODULE', '../world-atlas-next.mjs'));

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const MAP_DATA = { index: readJson('../../../packages/atlas/map/index.json'), units: readJson('../../../packages/atlas/map/units.json') };
const ROWS = MAP_DATA.index.items.map(row => Object.fromEntries(MAP_DATA.index.fields.map((field, at) => [field, row[at]])));
const NODES = worldLearning.SKILLS;
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 18, 1, 0, 0); // 11-18(수) 10:00 KST — 이번 주 월요일은 11-16
const A_ID = '55555555-5555-4555-8555-555555555555';
const GUEST = atlas.storeName({});
const RUNNER = ['korean-runner'];
const RUSH = ['order-rush', 'order-rush-beginner'];
const check = at => checkMetadata(LISTENING_CHECKS[at]);
const EXAM_T1 = { reasons: ['exam'], primaryReason: 'exam', examType: 'topik1', targetGrade: 2, examDate: '2027-04-18', weeklyMinutes: 120 };
const FLOW_PREFIX = flowMemory.FLOW_MEMORY_PREFIX;

async function until(check, label = '기다린 일', ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw Error(`${label}이 오지 않았다`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
// 열쇠를 셀 수 있는 저장소(localStorage 꼴 — 쓸기가 열쇠를 센다). 계정은 서버 스위치 목록에 든 계정으로 읽는다.
function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    map,
    get length() {
      return map.size;
    },
    key: index => [...map.keys()][index] ?? null,
    getItem: key => (map.has(key) ? map.get(key) : key.startsWith(SWITCH_MARK) ? '{"on":true}' : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}
const recorder = () => ({ note() {}, snapshot: () => ({}) });
// 그 저장소 이름의 곁 기록 열쇠(기본 열쇠 · @세대 · #표지) — 이름이 더 긴 다른 저장소는 빼고 본다.
const keysWith = (storage, base) => [...storage.map.keys()].filter(key => key === base || key.startsWith(`${base}@`) || key.startsWith(`${base}#`)).sort();
const valueOf = (storage, key) => JSON.parse(storage.map.get(key) ?? 'null');

// 한 문서(탭) — 진짜 엔진 코치 + 진짜 입구. 같은 기기의 여러 탭은 기기 저장소(storage)와 엔진 저장소 포트(ports)를 함께 쓴다.
// noGen: 엔진 판에 세대 칸이 없는 판(되돌림) — 코치 요약에서 storage.generation을 뺀다. trail: 계정 길(리허설 서버).
function tab({ storage = memoryStorage(), ports = new Map(), noGen = false, owner = 'guest', trail = null, start = T0, onFinish = null } = {}) {
  let now = start;
  const time = { now: () => now, advance: ms => (now += ms), at: value => (now = value) };
  const portOf = key => {
    if (!ports.has(key)) ports.set(key, atlas.memoryPort());
    return ports.get(key);
  };
  const keyOf = host => host.key ?? (host.guest ? GUEST : atlas.storeName({ account: host.account, revision: host.revision }));
  const scope = { location: { origin: 'https://count.test' }, addEventListener() {}, removeEventListener() {} };
  scope.parent = scope;
  const load = async () => ({
    SynkAtlas: { load: async () => atlas },
    coach: options => {
      const made = atlas.createCoach({
        ...options,
        scope,
        mapData: MAP_DATA,
        dayOffset: 540,
        host: { ...options.host, prefs: { ...options.host?.prefs, storage }, port: portOf(keyOf(options.host)), now: time.now },
      });
      const wrapped = Object.fromEntries(Object.entries(made).map(([name, value]) => [name, typeof value === 'function' ? value.bind(made) : value]));
      if (onFinish)
        wrapped.finishSet = (...args) => {
          const out = made.finishSet(...args);
          onFinish(out);
          return out;
        };
      wrapped.reset = opts => made.reset({ ...opts, ...(ports.has(GUEST) ? { guestPort: ports.get(GUEST) } : {}) });
      if (noGen)
        wrapped.summary = (...args) => {
          const summary = made.summary(...args);
          const { generation: _generation, ...rest } = summary.storage;
          return { ...summary, storage: rest };
        };
      return wrapped;
    },
  });
  const next = createAtlasNext({ owner, storage, load, health: recorder(), now: time.now, ...(trail ? { trail } : {}) });
  const ends = [];
  next.gameEnds(end => ends.push(end));
  // 입구가 문을 만들 때 넘기는 입구 자리(world-atlas-next.mjs gameDoor)와 같은 꼴 — 문 모듈은 시험이 고른 것이다. later: 셸 창의 다음 차례.
  const doorOf = (gameId, { later = fn => fn() } = {}) =>
    door.createGameDoor({
      entry: { gameCoach: (game, banks) => next.gameCoach(game, banks), retired: (made, fn) => next.retired(made, fn), ended: (made, end) => void next.gameEnded(made, end) },
      gameId,
      later,
    });
  return { next, storage, ports, time, ends, doorOf, log: async (gameId = 'korean-runner', banks = RUNNER) => next.planLog(await next.gameCoach(gameId, banks)) };
}
// 판 기록으로 센 이번 주 수(영역 → done).
function doneOf(log, now) {
  const summary = { skills: [], units: [], carried: null, storage: { available: true, guest: true, base: true, pending: 0, unsent: 0, unfolded: 0, waiting: false } };
  const reader = planReader({ board: planBoard({ nodes: NODES, summary }), nodes: NODES, start: () => false });
  const plan = buildPlanNext({ examPlan, info: examPlan.examInfo(EXAM_T1), reader, log, now });
  return Object.fromEntries(plan.areas.map(row => [row.area, row.done]));
}
// 한 판 — 소리가 드는 문항은 끝까지 들려준 뒤(audio 'completed') 답한다. 돌려줌은 겉의 answer가 준 것.
function heard(face, item, { audio = 'completed', answer = { correct: true, assessable: true }, present = {} } = {}) {
  const pid = face.present({ ...item, ...present });
  if (audio) face.delivery(pid, { audio });
  return { pid, recorded: answer ? face.answer(pid, answer) : null };
}

/* ── 한 수(나) ── */

test('한 수 — 일반 길(바람길)과 손잡이 길(주문 폭주) 각각에서 같은 판이 한 수가 된다 · 경험이 달라 10분 뒤 판도 한 수를 더 올린다', { timeout: 60_000 }, async () => {
  const closed = [];
  const t = tab({ onFinish: out => closed.push(out) });
  // 바람길 — 일반 코치 answer의 돌려줌(판정이 맨 위 verdict).
  const runner = t.doorOf('korean-runner');
  const face = await runner.api.open({ gameId: 'korean-runner', banks: RUNNER });
  const { recorded } = heard(face, check(0));
  assert.equal(recorded.verdict, 'correct');
  assert.equal(recorded.modality, 'listening', '엔진이 형식을 돌려준다');
  face.finishSet({ record: false });
  await until(() => t.ends.length === 1, '바람길 판 끝');
  assert.deepEqual(t.ends[0].areas, ['listening']);
  assert.equal(typeof closed[0]?.folded?.then, 'function');
  assert.equal(t.ends[0].folded, closed[0].folded, '게임이 스스로 닫은 판도 그 판의 다시 접기를 싣는다(사슬 -d GA2)');
  assert.equal(t.ends[0].gameId, 'korean-runner');
  // 주문 폭주 — 순간 맞춤 손잡이 answer의 recorded(판정이 recorded.verdict, 맨 위에는 없다).
  t.time.advance(10 * MIN);
  const rush = t.doorOf('order-rush');
  const cafe = await rush.api.open({ gameId: 'order-rush', banks: RUSH });
  const live = cafe.live(FLOW_RUSH, { declared: {}, words: FLOW_WORDS });
  const pid = live.present(orderMetadata(ORDERS[0]));
  cafe.delivery(pid, { audio: 'completed' });
  const out = live.answer(pid, { correct: true, assessable: true }, { pressure: 0.2 });
  assert.equal(out.recorded.verdict, 'correct');
  assert.equal(out.verdict, undefined, '손잡이 길의 판정은 recorded 안에만 있다');
  assert.equal(typeof out.evidence, 'boolean', '손잡이 길 맨 위의 evidence는 순간 맞춤의 근거 표지다(저장 뒤 evidence는 recorded 안)');
  cafe.finishSet({ record: false });
  await until(() => t.ends.length === 2, '주문 폭주 판 끝');
  assert.deepEqual(t.ends[1].areas, ['listening']);
  assert.equal(typeof closed[1]?.folded?.then, 'function');
  assert.equal(t.ends[1].folded, closed[1].folded, '손잡이 길의 판도 같다(사슬 -d GA2)');
  const log = await t.log();
  assert.deepEqual(
    log.rows().map(row => [row.area, row.at, row.experience]),
    [['listening', T0, 'korean-runner'], ['listening', T0 + 10 * MIN, 'order-rush']],
    '형식 · 판이 닫힌 때 · 게임 이름 한 줄씩',
  );
  assert.equal(doneOf(log, T0 + HOUR).listening, 2, '바람길 판 뒤 10분의 주문 폭주 판은 듣기 한 수를 더 올린다');
  t.next.dispose();
});

test('한 수 — 입구가 연 게임 문(gameDoor — 셸 launchGame이 여는 길)도 판 끝 함수를 넘겨 한 판이 판 기록과 판 끝 알림에 든다', { timeout: 60_000 }, async () => {
  const closed = [];
  const t = tab({ onFinish: out => closed.push(out) });
  const gate = t.next.gameDoor('korean-runner');
  const face = await gate.api.open({ gameId: 'korean-runner', banks: RUNNER });
  heard(face, check(0));
  face.finishSet({ record: false });
  await until(() => t.ends.length === 1, '판 끝');
  assert.deepEqual(t.ends[0].areas, ['listening']);
  assert.equal(closed.length, 1);
  assert.equal(typeof closed[0]?.folded?.then, 'function');
  assert.equal(t.ends[0].folded, closed[0].folded, '게임이 스스로 닫은 판도 그 판의 다시 접기를 싣는다(사슬 -d GA2)');
  assert.deepEqual((await t.log()).rows().map(row => [row.area, row.experience]), [['listening', 'korean-runner']]);
  gate.dispose();
  t.next.dispose();
});

test('한 수 — 건너뛰기만 · 전달을 알리지 않은 답(pending) · failed 뒤의 답 · 답 뒤에 끝난 소리만 낸 판은 세지 않는다 · 게임이 audioRequired: false를 넘겨도 지도가 소리가 드는 문항이면 같다 · 가려진 답과 판정 못 한 첫 답 뒤의 판정 답은 센다 · 같은 판을 두 번 적지 않는다', { timeout: 60_000 }, async () => {
  const t = tab();
  const queue = [];
  const runner = t.doorOf('korean-runner', { later: fn => queue.push(fn) });
  const face = await runner.api.open({ gameId: 'korean-runner', banks: RUNNER });
  const set = async (label, play) => {
    const before = t.ends.length;
    play();
    face.finishSet({ record: false });
    await until(() => t.ends.length === before + 1, label);
    t.time.advance(30 * MIN);
    return t.ends.at(-1).areas;
  };
  assert.deepEqual(await set('건너뛰기', () => heard(face, check(1), { answer: { correct: null, assessable: true } })), [], '건너뛰기만 한 판');
  assert.deepEqual(await set('pending', () => heard(face, check(2), { audio: null })), [], '소리를 알리지 않은 답');
  assert.deepEqual(await set('failed', () => heard(face, check(3), { audio: 'failed' })), [], 'failed 뒤의 답');
  assert.deepEqual(
    await set('답 뒤 소리', () => {
      const { pid } = heard(face, check(4), { audio: 'pending' });
      face.delivery(pid, { audio: 'completed' });
    }),
    [],
    '답 뒤에 끝난 소리는 그 답을 되살리지 않는다(저장 뒤 기록부의 사건으로 정한 전달)',
  );
  assert.deepEqual(
    await set('게임의 audioRequired: false', () => heard(face, check(5), { audio: null, present: { audioRequired: false } })),
    [],
    '소리가 드는가는 지도 값이 먼저다 — 게임이 넘긴 값을 읽지 않는다',
  );
  assert.deepEqual(await set('가려진 답', () => heard(face, check(6), { present: { confounded: true } })), ['listening'], '가려진(confounded) 답만 낸 판은 센다');
  assert.deepEqual(
    await set('판정 못 한 첫 답 뒤', () => {
      const { pid } = heard(face, check(7), { answer: { correct: null, assessable: false, reason: 'unanswered' } });
      face.answer(pid, { correct: false, assessable: true });
    }),
    ['listening'],
    '판정 못 한 첫 답 뒤의 첫 판정 답도 센다',
  );
  // 같은 판을 두 번 적지 않는다 — 판 끝 뒤 패널을 닫아도(코치 판을 한 번 더 닫는다) 판 끝을 다시 알리지 않는다.
  const ended = t.ends.length;
  runner.dispose();
  queue.splice(0).forEach(fn => fn());
  await settle();
  assert.equal(t.ends.length, ended, '판 끝 뒤 패널을 닫아도 다시 알리지 않는다');
  const log = await t.log();
  assert.equal(log.rows().length, 2, '센 판 둘만 적었다');
  t.next.dispose();
});

test('한 수 — 답을 낸 뒤 finishSet 전에 패널을 닫아도 셸 창의 다음 차례에 닫힌 그 판이 판 기록과 판 끝 알림에 든다 · 답 없이 문항만 본 판도 판 끝을 알린다(다시 접기 folded를 싣는다)', { timeout: 60_000 }, async () => {
  const closed = [];
  const t = tab({ onFinish: out => closed.push(out) });
  const queue = [];
  const first = t.doorOf('korean-runner', { later: fn => queue.push(fn) });
  const face = await first.api.open({ gameId: 'korean-runner', banks: RUNNER });
  heard(face, check(0));
  first.dispose(); // 셸의 닫기 단추 — 판은 다음 차례에 닫힌다
  assert.equal(t.ends.length, 0, '닫기는 다음 차례');
  queue.splice(0).forEach(fn => fn());
  await until(() => t.ends.length === 1, '닫힌 판의 판 끝');
  assert.deepEqual(t.ends[0].areas, ['listening']);
  assert.equal(closed.length, 1, '코치의 판을 한 번 닫았다');
  assert.equal(typeof closed[0]?.folded?.then, 'function');
  assert.equal(t.ends[0].folded, closed[0].folded, '판 끝 알림에 그 판의 다시 접기(코치 finishSet의 folded)를 싣는다(사슬 -c GA1)');
  assert.deepEqual((await t.log()).rows().map(row => row.area), ['listening']);
  // 답 없이 문항만 보고 닫은 판 — 센 첫 답이 없어도 알린다(셸이 묶음 만남을 다시 묻는다).
  t.time.advance(HOUR);
  const second = t.doorOf('korean-runner', { later: fn => queue.push(fn) });
  const again = await second.api.open({ gameId: 'korean-runner', banks: RUNNER });
  again.present(check(1));
  second.dispose();
  queue.splice(0).forEach(fn => fn());
  await until(() => t.ends.length === 2, '답 없는 판의 판 끝');
  assert.deepEqual(t.ends[1].areas, []);
  // 같은 패널의 다시 open도 판 끝이다(틀 다시 싣기).
  const third = t.doorOf('korean-runner');
  const one = await third.api.open({ gameId: 'korean-runner', banks: RUNNER });
  heard(one, check(2));
  await third.api.open({ gameId: 'korean-runner', banks: RUNNER });
  await until(() => t.ends.length === 3, '다시 open의 판 끝');
  assert.deepEqual(t.ends[2].areas, ['listening']);
  // 아무것도 하지 않은 겉은 판 끝이 아니다.
  third.dispose();
  await settle();
  assert.equal(t.ends.length, 3);
  t.next.dispose();
});

test('한 수 — 열두 게임 각각 한 판 뒤 판 기록에 엔진이 돌려준 형식이 게임 이름과 함께 든다', { timeout: 120_000 }, async () => {
  const t = tab();
  // 한글 만나기(4-7)는 은행 문항이 없고 계열 줄로 문항을 낸다 — 판마다 제품이 넘긴 난도 · 응답 꼴로 짓는다.
  const letter = { itemKey: 'hangul-stage.listen_pick.v-a.qa.qa', familyKey: 'hangul-stage.listen_pick.v-a', skillId: 'ko.hangul.sound', modality: 'listening', difficulty: 1, responseFormat: 'binary-choice', audioRequired: true, flags: 1 };
  const games = Object.keys(door.GAME_BANKS);
  assert.equal(games.length, 12);
  let at = 0;
  for (const gameId of games) {
    const banks = [...door.GAME_BANKS[gameId]];
    const row = gameId === 'hangul-stage' ? letter : ROWS.find(item => item.bank === banks[0]);
    const face = await t.doorOf(gameId).api.open({ gameId, banks });
    assert.ok(face, `${gameId}: 새 길 겉`);
    const { recorded } = heard(face, gameId === 'hangul-stage' ? letter : { itemKey: row.itemKey }, { audio: row.flags & 1 ? 'completed' : null });
    assert.equal(recorded.modality, row.modality ?? row.skillId.split('.')[1], `${gameId}: 엔진이 돌려준 형식`);
    face.finishSet({ record: false });
    at += 1;
    await until(() => t.ends.length === at, `${gameId} 판 끝`);
    const log = await t.log();
    assert.deepEqual(log.rows().at(-1), { area: recorded.modality, at: t.time.now(), experience: gameId }, `${gameId}: 판 기록 한 줄`);
    t.time.advance(30 * MIN);
  }
  t.next.dispose();
});

test('한 수 — 코치가 형식 · evidence를 돌려주지 않는 엔진 판이면 판을 적지 않고(판 끝은 알린다), 기록 안 된 답(stored: false)은 세지 않는다 — 판 끝 셈은 저장 뒤 evidence를 쓴다', { timeout: 60_000 }, async () => {
  const late = new Map();
  const fake = (verdict, { modality = 'listening', evidence } = {}) => ({ verdict, ...(modality ? { modality } : {}), ...(evidence ? { evidence } : {}) });
  assert.equal(await door.countedModalities([{ pid: 'p', recorded: fake('correct') }]), null, 'evidence가 없는 엔진 판');
  assert.equal(await door.countedModalities([{ pid: 'p', recorded: fake('correct', { modality: null, evidence: Promise.resolve({ stored: true, delivered: true }) }) }]), null, '형식이 없는 엔진 판');
  assert.deepEqual(await door.countedModalities([{ pid: 'p', recorded: fake('correct', { evidence: Promise.resolve({ stored: false, delivered: false }) }) }]), [], '기록 안 된 답');
  // 답할 때가 아니라 저장 뒤 풀린 evidence로 센다 — 판 끝에 아직 풀리지 않았으면 기다린다.
  const pending = countedLater(late);
  const counted = door.countedModalities([{ pid: 'p', recorded: fake('incorrect', { modality: 'reading', evidence: pending }) }]);
  late.get('resolve')({ stored: true, delivered: true });
  assert.deepEqual(await counted, ['reading']);
  // 입구: 형식 · 전달 칸이 없는 판(counted null)은 적지 않고 판 끝만 알린다.
  const t = tab();
  const coach = await t.next.gameCoach('korean-runner', RUNNER);
  assert.equal(await t.next.gameEnded(coach, { gameId: 'korean-runner', counted: Promise.resolve(null), folded: null }), true);
  assert.equal(t.ends.length, 1);
  assert.deepEqual(t.ends[0].areas, []);
  assert.deepEqual(t.next.planLog(coach).rows(), [], '판을 적지 않는다');
  t.next.dispose();
});
test('기록이 바뀐 셈 — 순간 맞춤 손잡이(겉의 live())의 제시 · 답도 셈을 올린다 · 손잡이의 다른 칸은 그대로다(4-6e-2 검수 Fable F1 — 주문 폭주 · 레이싱)', { timeout: 60_000 }, async () => {
  const t = tab();
  const coach = await t.next.gameCoach('order-rush', RUSH);
  const writes = createWriteCount();
  const face = writes.face(coach);
  const handle = face.live(FLOW_RUSH, { declared: {}, words: FLOW_WORDS });
  assert.equal(writes.count(), 0, '손잡이를 여는 것은 쓰기가 아니다');
  assert.equal(typeof handle.settings, 'function');
  assert.equal(handle.spec.id, FLOW_RUSH.id, '손잡이의 다른 칸은 그대로 옮긴다');
  const item = orderMetadata(ORDERS[0]);
  const pid = handle.present(item);
  assert.equal(writes.count(), 1, '손잡이의 제시');
  handle.answer(pid, { correct: true, assessable: true });
  assert.equal(writes.count(), 2, '손잡이의 답');
  handle.end();
  assert.equal(writes.count(), 2, '판 끝(내용 기억 저장)은 기록부 쓰기가 아니다');
  t.next.dispose();
});
test('기록이 바뀐 셈 — 입구가 연 게임 문의 순간 맞춤 손잡이로 제시하고 답하면 홈 플래너의 셈(writes)이 오른다(사슬 -c GA2)', { timeout: 60_000 }, async () => {
  const t = tab();
  const planner = await t.next.homePlanner();
  const rush = t.doorOf('order-rush');
  const cafe = await rush.api.open({ gameId: 'order-rush', banks: RUSH });
  const live = cafe.live(FLOW_RUSH, { declared: {}, words: FLOW_WORDS });
  const opened = planner.writes();
  const pid = live.present(orderMetadata(ORDERS[0]));
  const shown = planner.writes();
  assert.ok(shown > opened, '손잡이의 제시');
  live.answer(pid, { correct: true, assessable: true }, { pressure: 0.2 });
  assert.ok(planner.writes() > shown, '손잡이의 답');
  t.next.dispose();
});
function countedLater(slots) {
  return new Promise(resolve => slots.set('resolve', resolve));
}

test('한 수 — 다른 탭이 손님 기록을 비운 뒤, 비운 것을 아직 모르는 탭에서 늦게 끝난 판은 판 기록을 되살리지 않는다(비운 세대 표지 — 4-6e-2 검수 GPT GC1)', { timeout: 60_000 }, async () => {
  const storage = memoryStorage();
  const ports = new Map();
  const a = tab({ storage, ports });
  const b = tab({ storage, ports });
  const coach = await a.next.gameCoach('korean-runner', RUNNER);
  assert.equal(coach.summary().storage.generation, 0);
  a.next.planLog(coach).record('listening', T0 - HOUR, 'korean-runner');
  // a의 판 끝이 셈을 기다리는 사이 b가 비운다. 이 시험의 탭은 서로의 알림을 듣지 않아 a는 비운 것을 모른다(은퇴하지 않는다).
  const slots = new Map();
  const late = a.next.gameEnded(coach, { gameId: 'korean-runner', counted: countedLater(slots), folded: null });
  assert.deepEqual(await b.next.clearPractice(), { ok: true, path: 'guest', partial: false });
  assert.deepEqual(keysWith(storage, PLAN_LOG_PREFIX + GUEST), [], 'b의 쓸기가 앞 세대 판 기록을 지웠다');
  slots.get('resolve')(['listening']);
  assert.equal(await late, true, '판 끝은 알린다');
  assert.deepEqual(a.ends.at(-1).areas, ['listening']);
  assert.deepEqual(keysWith(storage, PLAN_LOG_PREFIX + GUEST), [], '방금 지운 열쇠에 줄이 다시 생기지 않는다');
  assert.equal(a.next.planLog(coach).record('reading', T0, 'korean-runner'), false, '같은 탭의 다음 쓰기도 막는다');
  assert.deepEqual(keysWith(storage, PLAN_LOG_PREFIX + GUEST), []);
  const fresh = await b.log();
  assert.equal(fresh.key, planLogKey(GUEST, 1));
  assert.deepEqual(fresh.rows(), []);
  assert.equal(fresh.record('listening', T0, 'korean-runner'), true, '새 세대 탭은 쓴다');
  a.next.dispose();
  b.next.dispose();
});

test('열쇠 — 비운 적이 있는 손님이 IndexedDB만 잃어 세대 0으로 다시 서도(표지와 @1은 localStorage에 남음) 판 기록을 적고 이번 주 수에 든다. 연 때 본 표지보다 뒤 세대의 표지가 서면 막는다', { timeout: 60_000 }, async () => {
  const storage = memoryStorage();
  const before = tab({ storage });
  await before.next.gameCoach('korean-runner', RUNNER);
  assert.equal((await before.next.clearPractice()).ok, true);
  const second = await before.log();
  assert.equal(second.record('listening', T0 - HOUR, 'korean-runner'), true);
  before.next.dispose();
  assert.ok(storage.map.has(planLogKey(GUEST, 1)) && valueOf(storage, `${FLOW_PREFIX}${GUEST}#cleared`).gen === 1);
  // 엔진 저장소 포트를 새로 준다 — 브라우저가 IndexedDB만 비운 것과 같다.
  const t = tab({ storage });
  const coach = await t.next.gameCoach('korean-runner', RUNNER);
  assert.equal(coach.summary().storage.generation, 0, '기록부는 세대 0에서 다시 선다');
  const log = t.next.planLog(coach);
  assert.equal(log.record('listening', T0, 'korean-runner'), true, '판 기록이 멈추지 않는다');
  assert.equal(doneOf(log, T0 + HOUR).listening, 1);
  // 연 때 본 표지보다 뒤 세대의 표지가 서면 막는다(표지를 손으로 세운다). 유실 뒤 첫 비우기는 기록부 세대가 0에서 1로 올라 표지가 1 그대로다 — 이
  // 탭은 그 비우기를 모르고, 잃기 전의 @1 줄이 새 세대에서 다시 읽힌다. 세대 다시 쓰기는 엔진에서 고친다(단계4_계획 §6 GA1 — 손님 스위치 전).
  storage.map.set(`${FLOW_PREFIX}${GUEST}#cleared`, JSON.stringify({ v: 1, gen: 2 }));
  assert.equal(log.record('listening', T0 + HOUR, 'korean-runner'), false);
  t.next.dispose();
});

test('열쇠 — 세대 0의 옛 꼴 판 기록은 이어받기를 적지 못한 저장소(가득 참)에서도 이 세대의 줄로 읽는다(4-6e-2 검수 GPT GC3)', () => {
  const storage = memoryStorage([[planLogKey(GUEST, 0), JSON.stringify({ v: 1, rows: [{ area: 'listening', at: T0 }, { area: 'recheck', at: T0 - DAY }] })]]);
  const full = { ...storage, setItem() { throw Error('QuotaExceededError'); } };
  const log = createPlanLog({ storage: full, store: GUEST, gen: 0 });
  assert.equal(log.adopt(), false, '이어받기를 적지 못한다');
  assert.equal(valueOf(storage, planLogKey(GUEST, 0)).gen, undefined, '값은 옛 꼴 그대로');
  assert.deepEqual(log.rows().map(row => row.area), ['listening', 'recheck']);
  assert.equal(log.lastCheck(), T0 - DAY);
  assert.equal(doneOf(log, T0 + HOUR).listening, 1);
  // 세대 1 이상에서는 옛 꼴을 읽지 않는다(쓸기가 지울 줄이다).
  assert.deepEqual(createPlanLog({ storage: full, store: GUEST, gen: 1 }).rows(), []);
});

test('한 수 — 판을 다시 정해 닫힌 판(retired)은 판 끝을 부르지 않고, 은퇴한 코치(gone)의 늦은 판 끝은 적지도 알리지도 않는다 — 손님 기록을 비운 뒤 판 기록이 비어 있다', { timeout: 60_000 }, async () => {
  const t = tab();
  const ended = [];
  const runner = door.createGameDoor({
    entry: {
      gameCoach: (game, banks) => t.next.gameCoach(game, banks),
      retired: (made, fn) => t.next.retired(made, fn),
      ended: (made, end) => {
        ended.push(end);
        void t.next.gameEnded(made, end);
      },
    },
    gameId: 'korean-runner',
    later: fn => fn(),
  });
  const face = await runner.api.open({ gameId: 'korean-runner', banks: RUNNER });
  const coach = await t.next.gameCoach('korean-runner', RUNNER);
  heard(face, check(0));
  // 앞서 끝난 판의 판 끝이 아직 셈을 기다리는 사이 손님 기록을 비운다.
  const slots = new Map();
  const late = t.next.gameEnded(coach, { gameId: 'korean-runner', counted: countedLater(slots), folded: null });
  assert.deepEqual(await t.next.clearPractice(), { ok: true, path: 'guest', partial: false });
  await until(() => face.closed, '다시 정한 판의 겉 닫힘');
  runner.dispose();
  await settle();
  assert.deepEqual(ended, [], '판을 다시 정해 닫힌 판은 판 끝을 부르지 않는다');
  slots.get('resolve')(['listening']);
  assert.equal(await late, false, '은퇴한 코치의 늦은 판 끝');
  assert.equal(t.ends.length, 0, '알리지도 않는다');
  assert.deepEqual(keysWith(t.storage, PLAN_LOG_PREFIX + GUEST), [], '손님 기록을 비운 뒤 판 기록 열쇠가 없다');
  const fresh = await t.log();
  assert.deepEqual(fresh.rows(), []);
  t.next.dispose();
});

/* ── 열쇠(가) ── */

test('열쇠 — 셸의 열쇠 함수가 엔진 내용 기억이 실제로 쓴 열쇠와 세대 0 · 1 · 2에서 같고, 비운 세대 표지 열쇠(#cleared)의 짜임도 같다', { timeout: 60_000 }, async () => {
  assert.equal(door.FLOW_MEMORY_PREFIX, flowMemory.FLOW_MEMORY_PREFIX);
  assert.equal(door.FLOW_CLEARED_SUFFIX, flowMemory.FLOW_CLEARED_SUFFIX);
  const t = tab();
  for (const gen of [0, 1, 2]) {
    const coach = await t.next.gameCoach('order-rush', RUSH);
    assert.equal(coach.summary().storage.generation, gen, `세대 ${gen}`);
    coach.live(FLOW_RUSH, { declared: {}, words: FLOW_WORDS }).end();
    assert.ok(t.storage.map.has(sideKey(FLOW_PREFIX, GUEST, gen)), `세대 ${gen}: 엔진이 쓴 내용 기억 열쇠 = 셸 함수`);
    assert.equal(valueOf(t.storage, sideKey(FLOW_PREFIX, GUEST, gen)).gen, gen);
    assert.equal(t.next.planLog(coach).key, planLogKey(GUEST, gen));
    assert.equal(planLogKey(GUEST, gen), `${PLAN_LOG_PREFIX}${GUEST}${gen ? `@${gen}` : ''}`);
    if (gen) assert.equal(valueOf(t.storage, `${FLOW_PREFIX}${GUEST}${door.FLOW_CLEARED_SUFFIX}`).gen, gen, '비운 세대 표지 열쇠');
    if (gen < 2) assert.equal((await t.next.clearPractice()).ok, true);
  }
  t.next.dispose();
});

test('열쇠 — 비운 뒤 옛 탭의 쓰기는 새 세대 읽기에 나오지 않고, 다음 열기에 앞선 세대의 @k · 세대가 앞선 기본 열쇠 · 앞선 세대의 판 기록이 0이다 · #cleared · 뒤 세대 · 다른 저장소 이름의 열쇠는 그대로다 · 세대가 다시 올라도 세대 0 탭은 비우기 전 기억을 읽거나 쓰지 않는다', { timeout: 60_000 }, async () => {
  const storage = memoryStorage([
    [`${FLOW_PREFIX}synk-atlas:guest-other`, JSON.stringify({ v: 1, gen: 0, seeded: true, contents: {}, declined: {} })],
    [`${PLAN_LOG_PREFIX}synk-atlas:guest-other`, JSON.stringify({ v: 1, gen: 0, rows: [] })],
    [`${PLAN_LOG_PREFIX}${GUEST}@9`, JSON.stringify({ v: 1, gen: 9, rows: [] })],
    [`${FLOW_PREFIX}${GUEST}@9`, JSON.stringify({ v: 1, gen: 9, seeded: true, contents: {}, declined: {} })],
  ]);
  const ports = new Map();
  const old = tab({ storage, ports }); // 비운 것을 모르는 탭
  const now = tab({ storage, ports });
  const oldCoach = await old.next.gameCoach('order-rush', RUSH);
  const oldLive = oldCoach.live(FLOW_RUSH, { declared: {}, words: FLOW_WORDS });
  oldLive.end();
  (await old.log()).record('listening', T0 - HOUR, 'korean-runner');
  // 이 탭이 두 번 비운다 — 사이에 세대 1의 곁 기록을 쓴다(@1).
  await now.log();
  assert.equal((await now.next.clearPractice()).ok, true);
  const mid = await now.next.gameCoach('order-rush', RUSH);
  mid.live(FLOW_RUSH, { declared: {}, words: FLOW_WORDS }).end();
  (await now.log('order-rush', RUSH)).record('listening', T0, 'order-rush');
  assert.ok(storage.map.has(`${FLOW_PREFIX}${GUEST}@1`) && storage.map.has(`${PLAN_LOG_PREFIX}${GUEST}@1`));
  assert.equal((await now.next.clearPractice()).ok, true);
  // 옛 탭(세대 0)의 늦은 쓰기 — 판 기록도 내용 기억도 비운 세대 표지가 막는다.
  assert.equal((await old.log()).record('listening', T0 + 5 * MIN, 'korean-runner'), false);
  oldLive.end();
  // 막이를 모르는 앞 판 탭이 비운 뒤에 쓴 앞선 세대의 열쇠(기본 열쇠 · @1)를 심는다 — 다음 열기의 세대 쓸기가 지울 것이 있어야 한다(카본 A1).
  for (const [gen, key] of [[0, sideKey(PLAN_LOG_PREFIX, GUEST, 0)], [1, sideKey(PLAN_LOG_PREFIX, GUEST, 1)]])
    storage.setItem(key, JSON.stringify({ v: 1, gen, rows: [{ area: 'listening', at: T0 + 5 * MIN, experience: 'korean-runner' }] }));
  for (const [gen, key] of [[0, sideKey(FLOW_PREFIX, GUEST, 0)], [1, sideKey(FLOW_PREFIX, GUEST, 1)]])
    storage.setItem(key, JSON.stringify({ v: 1, gen, seeded: true, contents: {}, declined: {} }));
  assert.equal(keysWith(storage, `${PLAN_LOG_PREFIX}${GUEST}`).length, 3, '열기 전 — 앞선 세대 둘과 뒤 세대 하나');
  assert.equal(keysWith(storage, `${FLOW_PREFIX}${GUEST}`).length, 4, '열기 전 — 앞선 세대 둘 · 표지 · 뒤 세대 하나');
  const after = await now.next.gameCoach('korean-runner', RUNNER);
  assert.equal(after.summary().storage.generation, 2);
  const log = now.next.planLog(after);
  assert.deepEqual(log.rows(), [], '비운 뒤 옛 탭의 쓰기가 새 세대 읽기에 나오지 않는다');
  assert.equal(doneOf(log, T0 + HOUR).listening ?? 0, 0);
  assert.deepEqual(
    keysWith(storage, `${PLAN_LOG_PREFIX}${GUEST}`),
    [`${PLAN_LOG_PREFIX}${GUEST}@9`],
    '앞선 세대의 판 기록(기본 열쇠 · @1)은 0, 뒤 세대 열쇠는 그대로',
  );
  assert.deepEqual(
    keysWith(storage, `${FLOW_PREFIX}${GUEST}`),
    [`${FLOW_PREFIX}${GUEST}#cleared`, `${FLOW_PREFIX}${GUEST}@9`],
    '앞선 세대의 내용 기억(@1 · 세대가 앞선 기본 열쇠)은 0, #cleared와 뒤 세대는 그대로',
  );
  assert.equal(valueOf(storage, `${FLOW_PREFIX}${GUEST}#cleared`).gen, 2);
  assert.ok(storage.map.has(`${FLOW_PREFIX}synk-atlas:guest-other`) && storage.map.has(`${PLAN_LOG_PREFIX}synk-atlas:guest-other`), '다른 저장소 이름의 열쇠는 그대로');
  // 세대 0 탭(비운 것을 모름)은 #cleared가 남아 있어 비우기 전 기억을 읽지도 쓰지도 않는다(4c 20beea9ed와 함께 돈다).
  const unaware = flowMemory.createFlowMemory({ storage, store: GUEST, generation: () => 0 });
  assert.equal(unaware.memory(FLOW_RUSH.id), null, '세대 0 탭이 비우기 전 기억을 읽지 않는다');
  assert.equal(unaware.save(FLOW_RUSH.id, { at: 1 }, 0), false, '세대 0 탭이 쓰지 않는다');
  assert.equal(storage.map.has(`${FLOW_PREFIX}${GUEST}`), false);
  old.next.dispose();
  now.next.dispose();
});

test('열쇠 — 손님 기록을 비운 직후, 다음 코치를 열기 전에 앞 세대 판 기록 · 내용 기억 열쇠가 0이다 · 세대 칸이 없는 엔진 판에서 비우면 판 기록 열쇠를 지워 이번 주 계획이 비우기 전 판을 세지 않는다', { timeout: 60_000 }, async () => {
  const t = tab();
  const coach = await t.next.gameCoach('order-rush', RUSH);
  coach.live(FLOW_RUSH, { declared: {}, words: FLOW_WORDS }).end();
  t.next.planLog(coach).record('listening', T0, 'order-rush');
  assert.ok(t.storage.map.has(planLogKey(GUEST, 0)) && t.storage.map.has(sideKey(FLOW_PREFIX, GUEST, 0)));
  assert.equal((await t.next.clearPractice()).ok, true);
  assert.equal(t.storage.map.has(planLogKey(GUEST, 0)), false, '앞 세대 판 기록 열쇠');
  assert.equal(t.storage.map.has(sideKey(FLOW_PREFIX, GUEST, 0)), false, '앞 세대 내용 기억 열쇠');
  assert.ok(t.storage.map.has(`${FLOW_PREFIX}${GUEST}#cleared`));
  t.next.dispose();
  // 세대 칸이 없는 엔진 판(되돌림) — 세대 0 열쇠에 gen 없이 적고, 비우면 그 열쇠를 지운다.
  const bare = tab({ noGen: true });
  const old = await bare.log();
  assert.equal(old.key, planLogKey(GUEST, 0));
  old.record('listening', T0, 'korean-runner');
  assert.equal(valueOf(bare.storage, planLogKey(GUEST, 0)).gen, undefined, '값에 gen을 싣지 않는다');
  assert.equal(doneOf(old, T0 + HOUR).listening, 1);
  assert.equal((await bare.next.clearPractice()).ok, true);
  assert.equal(bare.storage.map.has(planLogKey(GUEST, 0)), false, '판 기록 열쇠를 지웠다');
  assert.equal(doneOf(await bare.log(), T0 + HOUR).listening ?? 0, 0, '이번 주 계획이 비우기 전 판을 세지 않는다');
  bare.next.dispose();
});

test('열쇠 — 세대 0: 지금 판(옛 꼴)에서 듣기와 시험 형식을 한 판씩 한 뒤 새 판으로 올리면 둘 다 1이고, 두 번 열어도 1이다 · 되돌림 → 복귀를 두 번 되풀이해도 판 수가 겹치지 않는다', { timeout: 60_000 }, async () => {
  const week = examPlan.examWeek(T0);
  const storage = memoryStorage([[planLogKey(GUEST, 0), JSON.stringify({ v: 1, rows: [{ area: 'listening', at: week.start + HOUR }, { area: 'mock', at: week.start + 2 * HOUR }] })]]);
  const ports = new Map();
  const counts = async () => {
    const t = tab({ storage, ports });
    const log = await t.log();
    const done = doneOf(log, T0);
    const mock = log.times('mock').filter(at => at >= week.start && at < week.end).length;
    t.next.dispose();
    return { listening: done.listening ?? 0, mock, rows: valueOf(storage, planLogKey(GUEST, 0)).rows.length, gen: valueOf(storage, planLogKey(GUEST, 0)).gen };
  };
  assert.deepEqual(await counts(), { listening: 1, mock: 1, rows: 2, gen: 0 }, '새 판으로 올리면 둘 다 1 — 그 자리에서 gen 0을 실어 이어받는다');
  assert.deepEqual(await counts(), { listening: 1, mock: 1, rows: 2, gen: 0 }, '두 번 열어도 1');
  // 되돌림(세대 칸이 없는 엔진 판)이 gen 없이 적고, 복귀한 판이 다시 이어받는다 — 두 번.
  createPlanLog({ storage, store: GUEST, gen: null }).record('listening', week.start + DAY, 'world-practice');
  assert.deepEqual(await counts(), { listening: 2, mock: 1, rows: 3, gen: 0 });
  createPlanLog({ storage, store: GUEST, gen: null }).record('mock', week.start + DAY + HOUR);
  assert.deepEqual(await counts(), { listening: 2, mock: 2, rows: 4, gen: 0 }, '되돌림 → 복귀를 두 번 되풀이해도 판 수가 겹치지 않는다');
});

test('열쇠 — 세대 1 이상: 옛 꼴(gen 없는) 판 기록 줄은 옮기지 않고 쓸기가 지운다 · 같은 쓸기가 #cleared 표지와 gen이 달린 줄은 건드리지 않는다 · 구판 탭이 비운 뒤 늦게 쓴 줄이 새 세대에 나오지 않는다', { timeout: 60_000 }, async () => {
  const t = tab();
  await t.log();
  assert.equal((await t.next.clearPractice()).ok, true);
  // 구판 탭(gen을 모르는 앞 판)이 비운 뒤 기본 열쇠에 늦게 쓴 줄, 이 세대의 판 기록(@1).
  t.storage.setItem(planLogKey(GUEST, 0), JSON.stringify({ v: 1, rows: [{ area: 'listening', at: T0 - HOUR }, { area: 'reading', at: T0 - HOUR }] }));
  t.storage.setItem(planLogKey(GUEST, 1), JSON.stringify({ v: 1, gen: 1, rows: [{ area: 'reading', at: T0 - 2 * HOUR, experience: 'snap-words' }] }));
  const coach = await t.next.gameCoach('order-rush', RUSH); // 문서에서 세대 1의 코치를 처음 연다 — 쓸기
  assert.equal(coach.summary().storage.generation, 1);
  assert.equal(t.storage.map.has(planLogKey(GUEST, 0)), false, '세대 1 이상의 옛 꼴 판 기록은 쓸기가 지운다');
  assert.deepEqual(valueOf(t.storage, planLogKey(GUEST, 1)).rows, [{ area: 'reading', at: T0 - 2 * HOUR, experience: 'snap-words' }], 'gen이 달린 줄은 그대로 — 옛 꼴을 옮겨 오지 않는다');
  assert.ok(t.storage.map.has(`${FLOW_PREFIX}${GUEST}#cleared`), '#cleared는 그대로');
  const done = doneOf(t.next.planLog(coach), T0);
  assert.equal(done.listening ?? 0, 0, '구판 탭이 비운 뒤 늦게 쓴 줄이 새 세대에 나오지 않는다');
  assert.equal(done.reading, 1);
  t.next.dispose();
});

test('열쇠 — 비우기 자리의 쓸기는 옛 꼴을 옮기지 않는다 — 비우기 전의 옛 꼴 판 기록은 새 세대에 나오지 않는다', { timeout: 60_000 }, async () => {
  const storage = memoryStorage([[planLogKey(GUEST, 0), JSON.stringify({ v: 1, rows: [{ area: 'listening', at: T0 - HOUR }] })]]);
  const t = tab({ storage, noGen: true }); // 옛 꼴이 그대로 남는 판(되돌림)에서 연 코치 — 이어받지 않는다
  await t.log();
  t.next.dispose();
  const now = tab({ storage, ports: t.ports });
  const coach = await now.next.gameCoach('korean-runner', RUNNER);
  storage.setItem(planLogKey(GUEST, 0), JSON.stringify({ v: 1, rows: [{ area: 'listening', at: T0 - HOUR }] })); // 연 뒤 구판 탭이 다시 적은 옛 꼴
  assert.equal(coach.summary().storage.generation, 0);
  assert.equal((await now.next.clearPractice()).ok, true);
  assert.deepEqual(keysWith(storage, `${PLAN_LOG_PREFIX}${GUEST}`), [], '비우기 자리의 쓸기는 옛 꼴을 새 세대로 옮기지 않고 지운다');
  assert.equal(doneOf(await now.log(), T0).listening ?? 0, 0);
  now.next.dispose();
});

test('열쇠 — 손님 reset 뒤 쓸기를 돌려도 4c 고침(20beea9ed)의 이어받기와 #cleared 표지가 그대로다 — 기본 열쇠에 같은 세대의 앞 꼴 기억이 있으면 다음 코치가 그것을 읽고, 앞선 세대 열쇠만 0이 된다', { timeout: 60_000 }, async () => {
  const t = tab();
  await t.log();
  assert.equal((await t.next.clearPractice()).ok, true);
  assert.equal((await t.next.clearPractice()).ok, true);
  // 세대 2 — 기본 열쇠에 같은 세대의 앞 꼴 기억(앞 판 엔진이 세대를 기본 열쇠에 함께 둔 꼴)과 늦게 선 앞선 세대 열쇠(@1).
  t.storage.setItem(sideKey(FLOW_PREFIX, GUEST, 0), JSON.stringify({ v: 1, gen: 2, seeded: true, contents: { 'test.marker': { kept: true } }, declined: {} }));
  t.storage.setItem(sideKey(FLOW_PREFIX, GUEST, 1), JSON.stringify({ v: 1, gen: 1, seeded: true, contents: {}, declined: {} }));
  const coach = await t.next.gameCoach('order-rush', RUSH);
  assert.equal(coach.summary().storage.generation, 2);
  assert.equal(t.storage.map.has(sideKey(FLOW_PREFIX, GUEST, 1)), false, '앞선 세대 열쇠만 0');
  assert.equal(valueOf(t.storage, sideKey(FLOW_PREFIX, GUEST, 0)).gen, 2, '같은 세대가 든 기본 열쇠는 지우지 않는다');
  assert.equal(valueOf(t.storage, `${FLOW_PREFIX}${GUEST}#cleared`).gen, 2, '#cleared는 그대로');
  coach.live(FLOW_RUSH, { declared: {}, words: FLOW_WORDS }).end();
  assert.deepEqual(valueOf(t.storage, sideKey(FLOW_PREFIX, GUEST, 2)).contents['test.marker'], { kept: true }, '다음 코치가 같은 세대의 앞 꼴 기억을 이어받았다');
  t.next.dispose();
});

test('열쇠 — 계정은 세대가 늘 0이다 — 계정 길에서 비워도 저장소 이름(판)이 바뀌고 기기 세대는 오르지 않는다', { timeout: 60_000 }, async () => {
  const time = { at: T0 };
  const index = atlas.openMap({ index: MAP_DATA.index }).foldIndex;
  const server = createRehearsalTrail({ atlas, index, now: () => time.at, warn: () => {} });
  const fetcher = async (url, init = {}) => {
    const u = new URL(url, 'http://local');
    const reply = await server.handle({
      account: { id: A_ID },
      path: u.pathname.replace('/api/world/rehearsal/', ''),
      method: init.method ?? 'GET',
      query: u.searchParams,
      body: init.body ? Buffer.from(init.body) : undefined,
      headers: new Headers(init.headers),
    });
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
  };
  const t = tab({ owner: A_ID, trail: rehearsalTrail({ fetcher }) });
  const first = await t.next.gameCoach('korean-runner', RUNNER);
  assert.ok(first, '새 길(올리는 길)');
  assert.equal(first.summary().storage.generation, 0);
  assert.equal(t.next.planLog(first).key, planLogKey(atlas.storeName({ account: A_ID, revision: 1 }), 0));
  t.next.planLog(first).record('listening', T0, 'korean-runner');
  const cleared = await t.next.clearPractice();
  assert.equal(cleared.ok, true);
  const second = await t.next.gameCoach('korean-runner', RUNNER);
  assert.equal(second.summary().storage.generation, 0, '계정 비우기는 기기 세대를 올리지 않는다');
  const key = t.next.planLog(second).key;
  assert.equal(key, planLogKey(atlas.storeName({ account: A_ID, revision: cleared.revision }), 0));
  assert.ok(!key.includes('@'), '계정 판 기록 열쇠에는 세대가 붙지 않는다');
  assert.deepEqual(t.next.planLog(second).rows(), [], '비운 판의 기록은 읽히지 않는다');
  t.next.dispose();
});
