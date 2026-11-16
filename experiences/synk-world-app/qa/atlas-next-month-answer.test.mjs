// 30일째 문장의 계정 길 — 학습일 답의 저장 · 자리 견주기 · 묻기와 받기의 상한(world-month-answer.mjs · 단계4_계획 §21-22 「설계 검토로 고친 것」 ·
// 「설계 다시 검수로 고친 것」). 앞쪽은 저장소와 견주기의 낱 규칙이고, 뒤쪽은 진짜 엔진 코치 + 리허설 trail(rehearsal-trail.mjs — talk와 같은 접기
// · 돌아보기 읽기)로 도는 장면이다. 장면마다 판 그리기 · 묻기 · 받기(coach.pull)를 세어 상한을 본다(설계 주인 11-16 밤 조건 2).
//   묻기 ≤ 기기 자리가 바뀐 수 + 1 · 받기 ≤ 답의 자리마다 1 · 묻기가 다시 그린 판은 모두 쓸 수 있는 답을 그린다.
// 접기 상한은 리허설 서버에서 작게 준다(talk는 2,000건 — 사건이 상한을 넘는 계정을 몇십 건으로 짓는다). 변형 시험(qa/position-mutants.mjs)은
// 깬 사본을 SYNK_MONTH_ANSWER_MODULE로 넘긴다. 그 밖에는 원본이다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { acquireHost, releaseHost } from '../../../packages/atlas/src/coach/host.mjs';
import { createRehearsalTrail } from '../rehearsal-trail.mjs';
import { rehearsalTrail } from '../world-atlas-next.mjs';
import { bankItems } from '../world-topik-items.mjs';

const {
  aheadOf,
  createMonthAnswers,
  createMonthAsker,
  headOrder,
  lookbackCode,
  monthOfAnswer,
  positionOf,
  samePosition,
  verdictOf,
} = await import(
  process.env.SYNK_MONTH_ANSWER_MODULE ? pathToFileURL(process.env.SYNK_MONTH_ANSWER_MODULE).href : '../world-month-answer.mjs'
);

const GEN_A = '1794441600000.aaaaaaaa';
const GEN_B = '1794445200000.bbbbbbbb'; // 한 시간 뒤에 만든 머리
const at = (foldedUntil, gen = GEN_A, edition = 'e1') => ({ edition, gen, foldedUntil });
const WINDOWS = {
  monthAgo: { from: 1, to: 2 },
  since: { from: 2, to: 3 },
  last7: { from: 2.5, to: 3 },
};
function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    map,
  };
}

// ── 낱 규칙 ─────────────────────────────────────────────────────────────────────────────

test('자리 견주기 — 같으면 쓴다 · 답의 머리가 새것이면 뒤처짐 · 같은 머리에서 기기가 덜 접혔으면 뒤처짐', () => {
  assert.equal(verdictOf(at(5), { askedFrom: at(5), at: at(5) }), 'use');
  assert.equal(verdictOf(at(5), { askedFrom: at(5), at: at(1, GEN_B, 'e2') }), 'behind', '다시 지은 머리(ability-2)의 답');
  assert.equal(verdictOf(at(5), { askedFrom: at(5), at: at(9) }), 'behind', '다른 기기의 답을 서버가 먼저 접었다');
  assert.equal(verdictOf(at(7), { askedFrom: at(5), at: at(9) }), 'behind', '물은 뒤 조금 받았지만 아직 뒤처졌다 — 다시 묻지 않는다');
  assert.equal(aheadOf(at(9), at(5)), true);
  assert.equal(aheadOf(at(5, null, 'new'), at(5, null, 'old')), false, 'gen 없는 머리끼리는 차례를 가리지 못한다');
});

test('자리 견주기 — 다시 묻기는 물은 뒤 기기 자리가 바뀌었을 때만(상한 — 설계 다시 검수 Fable P1 · 카본 A1)', () => {
  assert.equal(verdictOf(at(9), { askedFrom: at(5), at: at(5) }), 'ask', '물은 뒤 받기로 기기가 앞섰다');
  assert.equal(verdictOf(at(5, GEN_B, 'e2'), { askedFrom: at(5), at: at(5) }), 'ask', '물은 뒤 새 머리를 받았다');
  assert.equal(verdictOf(at(9), { askedFrom: at(9), at: at(5) }), 'behind', '기기 자리가 그대로 — 서버의 자리는 앞으로만 간다');
  assert.equal(verdictOf(at(5, null, 'old'), { askedFrom: at(5, null, 'old'), at: at(5, null, 'new') }), 'behind', 'gen 없는 옛 머리끼리');
  assert.equal(verdictOf(at(5, null, 'new'), { askedFrom: at(5, null, 'old'), at: at(5, null, 'old') }), 'ask');
});

test('머리 차례는 엔진 headOrder와 같은 규칙 — gen의 시각이 큰 쪽이 새 머리, gen이 없으면 가장 작다', () => {
  assert.equal(headOrder({ gen: GEN_B }, { gen: GEN_A }), 1);
  assert.equal(headOrder({ gen: GEN_A }, { gen: GEN_B }), -1);
  assert.equal(headOrder({ gen: GEN_A }, { gen: GEN_A }), 0);
  assert.equal(headOrder({ gen: GEN_A }, { gen: null }), 1);
  assert.equal(headOrder({ gen: null }, {}), 0);
});

test('자리 꼴 — 빈 판 이름 · 음수 · 정수가 아닌 표지 · 글이 아닌 gen은 null · 까닭 코드', () => {
  assert.deepEqual(positionOf({ edition: 'e', gen: null, foldedUntil: 0 }), { edition: 'e', gen: null, foldedUntil: 0 });
  for (const bad of [null, {}, { edition: '', foldedUntil: 1 }, { edition: 'e', foldedUntil: -1 }, { edition: 'e', foldedUntil: 1.5 }, { edition: 'e', foldedUntil: 1, gen: 3 }])
    assert.equal(positionOf(bad), null, JSON.stringify(bad));
  assert.equal(samePosition(at(1), at(1)), true);
  assert.equal(samePosition(at(1), null), false);
  assert.equal(lookbackCode('fold-failed'), 'LOOKBACK_FOLD_FAILED');
  assert.equal(lookbackCode('events-remain'), 'LOOKBACK_EVENTS_REMAIN');
  assert.equal(lookbackCode('rebuilding'), 'LOOKBACK_REBUILDING');
  assert.equal(lookbackCode('???'), 'LOOKBACK_FAILED');
});

test('학습일 답 — 계정마다 열쇠 하나 · 동의 판 · 학습일이 다르면 버린다 · 꼴이 틀리면 버린다 · 값에는 단위 id와 숫자만', () => {
  const storage = memoryStorage();
  const answers = createMonthAnswers({ storage });
  const month = [{ unit: 'u0', misses: 2, reviews: 3, last: 2.9, evidence: { text: '문항 글' } }];
  assert.equal(answers.write('acct', { revision: 3, day: 'd1', askedFrom: at(5), at: at(5), windows: WINDOWS, month, since: answers.generation() }), true);
  assert.equal(storage.map.size, 1);
  const raw = JSON.parse([...storage.map.values()][0]);
  assert.deepEqual(raw.month, [{ unit: 'u0', misses: 2, reviews: 3, last: 2.9 }], '근거 글 · 문항 글은 두지 않는다');
  const read = answers.read('acct', { revision: 3, day: 'd1' });
  assert.deepEqual(read.at, at(5));
  assert.equal(answers.read('acct', { revision: 4, day: 'd1' }), null, '동의 판이 바뀌면 버린다');
  assert.equal(answers.read('acct', { revision: 3, day: 'd2' }), null, '학습일이 바뀌면 다시 묻는다');
  assert.equal(answers.read('other', { revision: 3, day: 'd1' }), null, '다른 계정은 그 값을 읽지 못한다');
  storage.setItem([...storage.map.keys()][0], '{"v":1,"revision":3,"day":"d1","askedFrom":{},"at":{},"windows":{},"month":[]}');
  assert.equal(answers.read('acct', { revision: 3, day: 'd1' }), null, '꼴이 틀리면 버린다');
  const [entry] = monthOfAnswer(read);
  assert.deepEqual(entry.evidence, { ...WINDOWS, misses: 2, reviews: 3, last: 2.9 }, '근거는 창과 숫자로 다시 짓는다');
});

test('학습일 답 — 지우는 길(로그아웃 · 동의 끔 · 계정 바꿈 · 비우기)은 열쇠를 지우고 세대 수를 올려, 그 전에 물은 늦은 답을 적지 않는다', () => {
  const storage = memoryStorage();
  const answers = createMonthAnswers({ storage });
  const since = answers.generation();
  answers.write('acct', { revision: 3, day: 'd1', askedFrom: at(5), at: at(5), windows: WINDOWS, month: [], since });
  answers.clear('acct');
  assert.equal(answers.read('acct', { revision: 3, day: 'd1' }), null, '로그아웃 뒤 같은 브라우저에서 그 값을 읽지 못한다');
  assert.equal(answers.write('acct', { revision: 3, day: 'd1', askedFrom: at(5), at: at(5), windows: WINDOWS, month: [], since }), false, '지우기 전에 물은 늦은 답은 적지 않는다');
  assert.equal(storage.map.size, 0);
});

test('학습일 답 — 저장소가 막혀도 던지지 않는다(읽기는 null — 서버에 다시 묻는다)', () => {
  const broken = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
  const answers = createMonthAnswers({ storage: broken });
  assert.equal(answers.read('acct', { revision: 1, day: 'd' }), null);
  assert.equal(answers.write('acct', { revision: 1, day: 'd', askedFrom: at(1), at: at(1), windows: WINDOWS, month: [], since: answers.generation() }), false);
  assert.doesNotThrow(() => answers.clear('acct'));
});

// ── 장면 바탕 ───────────────────────────────────────────────────────────────────────────

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const MAP_DATA = { index: readJson('../../../packages/atlas/map/index.json'), units: readJson('../../../packages/atlas/map/units.json') };
const BANK = bankItems(readJson('../world-topik-items.json'));
const ITEM = BANK.find(item => item.skillId?.includes('.reading.'));
const ITEMS = BANK.filter(item => item.skillId === ITEM.skillId).slice(0, 12);
const A_ID = '44444444-4444-4444-8444-444444444444';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T = Date.UTC(2026, 10, 16, 3, 0, 0); // 11-16 한국 낮 12시(학습일은 현지 새벽 4시에 넘어간다)
const OFFSET = 540; // 한국 — 기기의 현지 시각 − UTC(분)
const dayOf = t => Math.floor((t + OFFSET * 60_000 - 4 * HOUR) / DAY);
// 엔진이 ability-2로 오르기 전의 서버(판 묶음 이름의 능력 판만 다르다 — 카본의 장면).
const OLD = { ...atlas, PARAMS: { ...atlas.PARAMS, editions: { ...atlas.PARAMS.editions, ability: 'ability-1' } } };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(check, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error('기다린 일이 오지 않았다');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
async function quiet(rounds = 40) {
  for (let i = 0; i < rounds; i += 1) await tick();
}

// 리허설 서버 하나(합성 계정 하나) — use(engine, cap)는 같은 계정 기록으로 판 묶음 · 접기 상한이 다른 서버를 켠다(엔진을 올린 배포의 흉내).
function worldOf() {
  let now = T;
  const time = { now: () => now, set: t => (now = t), advance: ms => (now += ms) };
  const index = atlas.openMap({ index: MAP_DATA.index }).foldIndex;
  const accounts = new Map();
  let server = null;
  const use = (engine, cap = engine.FOLD_CAP) => {
    server = createRehearsalTrail({ atlas: engine, index, now: time.now, warn: () => {}, accounts, cap });
  };
  use(atlas);
  const account = { id: A_ID };
  const fetcher = async (url, init = {}) => {
    const u = new URL(url, 'http://local');
    const reply = await server.handle({
      account,
      path: u.pathname.replace('/api/world/rehearsal/', ''),
      method: init.method ?? 'GET',
      query: u.searchParams,
      body: init.body ? Buffer.from(init.body) : undefined,
      headers: new Headers(init.headers),
    });
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
  };
  const trail = rehearsalTrail({ fetcher, owner: () => A_ID });
  // 서버에 쌓인 사건 수(다시 짓는 장면의 상한을 정할 때) · 다른 기기의 받기(그 기기의 판으로 — 접기를 한 걸음 민다).
  const rows = () => accounts.get(A_ID)?.store.visible() ?? [];
  const logged = () => rows().at(-1)?.seq ?? 0;
  const count = () => rows().length;
  const headers = { 'x-synk-contract': '1', 'x-synk-product': 'world' };
  const read = async revision =>
    (await (await fetcher(`/api/world/rehearsal/trail?revision=${revision}`, { headers })).json()).summary;
  const clear = async revision =>
    (await fetcher('/api/world/rehearsal/trail-clear', { method: 'POST', body: JSON.stringify({ revision }), headers })).json();
  return { time, use, trail, logged, count, read, clear, edition: engine => engine.foldEdition(engine.PARAMS, index) };
}

// 기기 하나 — 진짜 엔진 코치(서버 길 계정) · 그 호스트 손잡이(올리기는 시험이 부른다) · 받기를 잡아 두거나 끊는 손잡이 · 돌아보기 읽기 셈.
let devices = 0;
async function deviceOf(world) {
  const line = await world.trail();
  const revision = line.learning.revision;
  const base = line.transport(revision);
  const knobs = { hold: null, offline: false, asks: 0, replies: [], lookbackHold: null };
  const transport = {
    post: (events, since) => base.post(events, since),
    get: async since => {
      if (knobs.hold) await knobs.hold;
      if (knobs.offline) throw Object.assign(new Error('NETWORK'), { code: 'NETWORK', retryable: true });
      return base.get(since);
    },
  };
  const key = `synk-atlas:month-answer-${process.pid}-${(devices += 1)}`;
  const coach = atlas.createCoach({
    gameId: 'world-month',
    mapData: MAP_DATA,
    dayOffset: OFFSET,
    host: { guest: false, account: A_ID, revision, key, port: atlas.memoryPort(), transport, now: world.time.now },
  });
  await coach.ready;
  const handle = await acquireHost({ key, params: atlas.PARAMS, now: world.time.now, guest: false }, globalThis);
  const ask = async offset => {
    knobs.asks += 1;
    if (knobs.lookbackHold) await knobs.lookbackHold;
    const got = await base.lookback(offset);
    knobs.replies.push(got);
    return got;
  };
  return {
    coach,
    handle,
    revision,
    knobs,
    line: { revision, ask },
    position: () => positionOf(coach.summary().storage.sync?.received),
    close() {
      releaseHost(handle);
      coach.dispose();
    },
  };
}

// 한 문항을 차례로 푼다 — 단계마다 시각 · 맞힘 · 힌트. 단계마다 올린다(서버가 받은 뒤 접는다).
async function study(world, device, steps, item = ITEM) {
  for (const step of steps) {
    world.time.set(step.at);
    const pid = device.coach.present(item);
    if (step.hint) device.coach.help(pid, 'hint');
    world.time.advance(20_000);
    await device.coach.answer(pid, { correct: step.correct, assessable: true }).stored;
    await device.handle.settled();
    await device.handle.upload();
  }
}
// 사건 수를 채우는 연습(다시 짓는 장면) — 서로 다른 문항을 맞힌다.
async function practise(world, device, count) {
  for (let i = 0; i < count; i += 1) {
    const pid = device.coach.present(ITEMS[i % ITEMS.length]);
    world.time.advance(20_000);
    await device.coach.answer(pid, { correct: true, assessable: true }).stored;
  }
  await device.handle.settled();
  await device.handle.upload();
}

// 내 위치 판 — 셸처럼 판을 그릴 때마다 묻기 · 받기 상자(createMonthAsker)를 부르고, 받기 알림(watch)이 오면 다시 그린다. 묻기가 다시 그리면
// 그 판이 쓸 수 있는 답을 그렸는지 센다. 기기 자리는 그릴 때마다 적어 바뀐 수를 센다. 상자 하나를 기기 여럿이 이어 쓸 수 있다(같은 문서).
function panelOf(world, first, { storage = memoryStorage() } = {}) {
  const counts = { renders: 0, redraws: 0, wasted: 0, pulls: 0, positions: [], notes: [], shown: null };
  let device = first;
  let off = null;
  const answers = createMonthAnswers({ storage });
  const asker = createMonthAsker({
    answers,
    account: () => A_ID,
    lineOf: () => device.line,
    dayOf: () => dayOf(world.time.now()),
    offsetOf: () => OFFSET,
    redraw: () => {
      counts.redraws += 1;
      if (!render()) counts.wasted += 1;
    },
    note: code => counts.notes.push(code),
    alive: () => true,
  });
  // 코치는 얼린 객체라 상자가 부르는 두 메서드만 옮기고 받기를 센다.
  const view = () => ({
    summary: () => device.coach.summary(),
    pull: () => {
      counts.pulls += 1;
      return device.coach.pull();
    },
  });
  function track() {
    const now = device.position();
    if (now && !samePosition(now, counts.positions.at(-1))) counts.positions.push(now);
  }
  function render() {
    counts.renders += 1;
    track();
    const got = asker.month(view());
    counts.shown = got ? got.month : null;
    return got;
  }
  const attach = next => {
    off?.();
    device = next;
    off = device.coach.watch(() => render());
  };
  attach(first);
  return {
    counts,
    render,
    answers,
    use: attach,
    close: () => off?.(),
    // 상한 — 묻기 ≤ 기기 자리가 바뀐 수 + 1 · 받기 ≤ 답의 자리마다 1 · 묻기가 다시 그린 판은 모두 쓸 수 있는 답(설계 주인 조건 2 · 3).
    bounded(asks, replies, label) {
      track();
      const changes = Math.max(counts.positions.length - 1, 0);
      assert.ok(asks <= changes + 1, `${label}: 묻기 ${asks} ≤ 기기 자리가 바뀐 수 ${changes} + 1`);
      const places = new Set(replies.map(got => JSON.stringify(positionOf(got?.summaryAt))).filter(key => key !== 'null'));
      assert.ok(counts.pulls <= places.size, `${label}: 받기 ${counts.pulls} ≤ 답의 자리 ${places.size}`);
      assert.equal(counts.wasted, 0, `${label}: 쓸 수 없는 답으로 다시 그리지 않는다`);
    },
  };
}

// ── 장면: 카본의 장면(다시 짓기) ─────────────────────────────────────────────────────────

test('카본의 장면 ① — ability-2로 다시 짓는 동안 사건이 접기 상한을 넘는 계정이 첫 받기에서 옛 판을 받고 곧 내 위치 판을 연다(판의 첫 물음이 다시 짓기를 끝낸다)', { timeout: 60_000 }, async () => {
  const world = worldOf();
  world.use(OLD);
  const other = await deviceOf(world);
  await practise(world, other, 4);
  await until(async () => (await world.read(other.revision))?.foldedUntil >= world.logged());
  other.close();
  // 엔진을 올린 배포 — 첫 받기는 상한만큼만 짓고 옛 판을 내준다. 판의 첫 물음이 나머지를 지어 머리를 바꿔 끼운다.
  world.use(atlas, Math.ceil(world.count() / 2));
  const device = await deviceOf(world);
  await device.coach.synced();
  assert.equal(device.position().edition, world.edition(OLD), '첫 받기는 옛 판');
  const panel = panelOf(world, device);
  assert.equal(panel.render(), null, '곧 내 위치 판을 연다 — 묻고 문장 없이 그린다');
  await until(() => device.position()?.edition === world.edition(atlas) && panel.counts.shown);
  for (let i = 0; i < 4; i += 1) assert.ok(panel.render(), '같은 자리 — 적은 답을 쓴다');
  await quiet();
  assert.equal(device.knobs.asks, 1, '묻기는 한 번');
  assert.equal(panel.counts.pulls, 1, '새 머리의 답 — 받기를 한 번 불렀다');
  assert.equal(device.knobs.replies[0].complete, true);
  panel.bounded(device.knobs.asks, device.knobs.replies, '카본 ①');
  panel.close();
  device.close();
});

test('카본의 장면 ② — 다시 짓기가 여러 걸음이면 판을 거듭 그려도 다시 묻지 않고, 기기가 새 머리를 받은 뒤 한 번 더 묻는다', { timeout: 60_000 }, async () => {
  const world = worldOf();
  world.use(OLD);
  const other = await deviceOf(world);
  await practise(world, other, 12);
  await until(async () => (await world.read(other.revision))?.foldedUntil >= world.logged());
  other.close();
  world.use(atlas, 2);
  const device = await deviceOf(world);
  await device.coach.synced();
  assert.equal(device.position().edition, world.edition(OLD));
  const panel = panelOf(world, device);
  assert.equal(panel.render(), null);
  await until(() => device.knobs.replies.length === 1);
  await quiet();
  assert.equal(device.knobs.replies[0].complete, false, '아직 짓는 중');
  assert.equal(device.knobs.replies[0].reason, 'rebuilding');
  assert.deepEqual(panel.counts.notes, ['LOOKBACK_REBUILDING'], '까닭을 계기에 남긴다');
  for (let i = 0; i < 4; i += 1) assert.equal(panel.render(), null, '짓는 동안 — 문장 없이');
  await quiet();
  assert.equal(device.knobs.asks, 1, '기기 자리가 그대로면 다시 묻지 않는다(상한)');
  // 다른 기기의 읽기가 다시 짓기를 끝낸다 — 이 기기는 화면이 다시 보일 때 받는다(5분 막이 뒤).
  await until(async () => (await world.read(device.revision))?.edition === world.edition(atlas), 20_000);
  world.time.advance(6 * 60_000);
  await device.handle.pull();
  await until(() => device.knobs.asks === 2 && panel.counts.shown);
  await quiet();
  assert.equal(device.position().edition, world.edition(atlas));
  assert.equal(device.knobs.replies[1].complete, true);
  assert.ok(panel.counts.redraws >= 1, '같은 자리의 답 — 다시 그렸다');
  panel.bounded(device.knobs.asks, device.knobs.replies, '카본 ②');
  panel.close();
  device.close();
});

// ── 장면: 다른 기기에서 기록을 비움 · 첫 받기 전 · 뒤처진 기기 ─────────────────────────────

test('다른 기기에서 기록을 비워 판과 gen이 바뀐다 — 앞 판의 답은 새 판에 쓰지 않고, 새 판에서 한 번 묻는다', { timeout: 60_000 }, async () => {
  const world = worldOf();
  const first = await deviceOf(world);
  await practise(world, first, 3);
  const panel = panelOf(world, first);
  panel.render();
  await until(() => panel.counts.shown);
  const before = first.position();
  // 다른 기기가 연습 기록을 비운다(동의 판이 오르고 머리가 다시 선다). 이 기기는 다음 받기에서 판이 바뀐 것을 안다.
  await world.clear(first.revision);
  for (let i = 0; i < 3; i += 1) panel.render();
  world.time.advance(6 * 60_000);
  await first.handle.pull();
  await quiet();
  assert.equal(first.coach.summary().storage.sync.stopped, 'account', '앞 판 코치는 멈췄다 — 셸이 새 판으로 다시 연다');
  const second = await deviceOf(world);
  assert.equal(second.revision, first.revision + 1);
  await second.coach.synced();
  await practise(world, second, 1);
  panel.use(second);
  panel.render();
  await until(() => second.knobs.asks === 1 && panel.counts.shown);
  await quiet();
  assert.notEqual(second.position().gen, before.gen, '새 머리');
  assert.equal(first.knobs.asks, 1);
  panel.bounded(first.knobs.asks + second.knobs.asks, [...first.knobs.replies, ...second.knobs.replies], '비움');
  panel.close();
  first.close();
  second.close();
});

test('첫 받기 전 — 받은 요약의 자리가 없으면 묻지 않고, 첫 받기 알림이 판을 다시 그리면 한 번 묻는다', { timeout: 60_000 }, async () => {
  const world = worldOf();
  const other = await deviceOf(world);
  await practise(world, other, 3);
  other.close();
  let release = null;
  const held = new Promise(resolve => {
    release = resolve;
  });
  // 첫 받기를 잡아 둔 채 연다 — 셸이 판을 먼저 그린다.
  const device = await deviceOfHeld(world, held);
  const panel = panelOf(world, device);
  for (let i = 0; i < 3; i += 1) assert.equal(panel.render(), null, '첫 받기 전');
  await quiet();
  assert.equal(device.knobs.asks, 0, '자리가 없으면 묻지 않는다');
  release();
  await until(() => panel.counts.shown);
  await quiet();
  assert.equal(device.knobs.asks, 1);
  panel.bounded(device.knobs.asks, device.knobs.replies, '첫 받기 전');
  panel.close();
  device.close();
});
// 첫 받기를 잡아 둔 기기 — 코치가 열 때 내는 받기가 held를 기다린다.
async function deviceOfHeld(world, held) {
  const line = await world.trail();
  const revision = line.learning.revision;
  const base = line.transport(revision);
  const knobs = { asks: 0, replies: [] };
  const transport = {
    post: (events, since) => base.post(events, since),
    get: async since => {
      await held;
      return base.get(since);
    },
  };
  const key = `synk-atlas:month-answer-${process.pid}-${(devices += 1)}`;
  const coach = atlas.createCoach({
    gameId: 'world-month',
    mapData: MAP_DATA,
    dayOffset: OFFSET,
    host: { guest: false, account: A_ID, revision, key, port: atlas.memoryPort(), transport, now: world.time.now },
  });
  await coach.ready;
  return {
    coach,
    revision,
    knobs,
    line: {
      revision,
      ask: async offset => {
        knobs.asks += 1;
        const got = await base.lookback(offset);
        knobs.replies.push(got);
        return got;
      },
    },
    position: () => positionOf(coach.summary().storage.sync?.received),
    close: () => coach.dispose(),
  };
}

test('뒤처진 기기 — 답의 자리로 받기를 한 번 부르고, 받기가 끊겨도 그 자리에서는 다시 부르지도 다시 묻지도 않는다(설계 주인 조건 1)', { timeout: 60_000 }, async () => {
  const world = worldOf();
  const device = await deviceOf(world);
  await practise(world, device, 2);
  // 다른 기기의 답을 서버가 먼저 접는다 — 이 기기는 아직 모른다(같은 머리에서 뒤처짐).
  const other = await deviceOf(world);
  await practise(world, other, 2);
  other.close();
  device.knobs.offline = true;
  const panel = panelOf(world, device);
  assert.equal(panel.render(), null);
  await until(() => device.knobs.replies.length === 1 && panel.counts.pulls === 1);
  await quiet();
  const stored = panel.answers.read(A_ID, { revision: device.revision, day: dayOf(world.time.now()) });
  assert.ok(stored && aheadOf(stored.at, device.position()), '답의 자리가 기기보다 앞선다');
  for (let i = 0; i < 4; i += 1) assert.equal(panel.render(), null, '뒤처진 동안 — 문장 없이');
  device.knobs.offline = false;
  for (let i = 0; i < 2; i += 1) panel.render();
  await quiet();
  assert.equal(device.knobs.asks, 1, '뒤처진 동안 다시 묻지 않는다');
  assert.equal(panel.counts.pulls, 1, '받기가 끊겨도 그 자리에서는 다시 부르지 않는다');
  // 이 기기가 다음 답을 올리면 앞선 요약을 받는다 — 그 자리에서 한 번 더 묻는다.
  await practise(world, device, 1);
  await until(() => device.knobs.asks === 2 && panel.counts.shown);
  await quiet();
  panel.bounded(device.knobs.asks, device.knobs.replies, '뒤처진 기기');
  panel.close();
  device.close();
});

test('머리 차례를 가리지 못하는 답(gen 없는 옛 머리끼리 판 묶음만 다르다) — 기기 자리가 그대로면 다시 묻지 않고 그 자리로 한 번 받는다', async () => {
  const storage = memoryStorage();
  const answers = createMonthAnswers({ storage });
  const device = { edition: 'e-old', gen: null, foldedUntil: 5 };
  const there = { edition: 'e-new', gen: null, foldedUntil: 3 };
  answers.write(A_ID, { revision: 1, day: 7, askedFrom: device, at: there, windows: WINDOWS, month: [], since: answers.generation() });
  let asks = 0;
  let pulls = 0;
  const coach = {
    summary: () => ({ storage: { guest: false, unfolded: 0, sync: { received: device } } }),
    pull: () => {
      pulls += 1;
      return Promise.resolve(false);
    },
  };
  const asker = createMonthAsker({
    answers,
    account: () => A_ID,
    lineOf: () => ({
      revision: 1,
      ask: async () => {
        asks += 1;
        return { complete: true, summaryAt: there, lookback: { windows: WINDOWS, month: [] } };
      },
    }),
    dayOf: () => 7,
    offsetOf: () => OFFSET,
    redraw: () => {},
    note: () => {},
    alive: () => true,
  });
  for (let i = 0; i < 4; i += 1) {
    assert.equal(asker.month(coach), null);
    await quiet(5);
  }
  assert.equal(asks, 0, '기기 자리가 그대로 — 다시 묻지 않는다(상한)');
  assert.equal(pulls, 1, '그 자리로 한 번 받는다');
});

// ── 장면: 설계 주인 11-16 저녁 조건 1의 넷 ─────────────────────────────────────────────

// 30일째 문장이 서는 기록 — 한 달 전 창에 놓친 자리 둘, 그 뒤 혼자 맞힌 자리 셋(마지막은 오늘).
const MISSES = [
  { at: T - 35 * DAY, correct: false },
  { at: T - 33 * DAY, correct: false },
];
const REVIEWS = [
  { at: T - 20 * DAY, correct: true },
  { at: T - 10 * DAY, correct: true },
];

test('같은 자리 안에서 혼자 맞힌 뒤 힌트로 맞힌 답이 다른 기기에서 접히면 문장이 숨는다', { timeout: 60_000 }, async () => {
  const world = worldOf();
  const other = await deviceOf(world);
  await study(world, other, [...MISSES, ...REVIEWS, { at: T - 2 * HOUR, correct: true }]);
  world.time.set(T);
  const device = await deviceOf(world);
  await device.coach.synced();
  const panel = panelOf(world, device);
  panel.render();
  await until(() => panel.counts.shown);
  assert.ok(panel.counts.shown.length > 0, '문장이 선다');
  // 다른 기기 — 같은 자리(6시간 안)에서 힌트를 보고 맞힌다.
  await study(world, other, [{ at: T - HOUR, correct: true, hint: true }]);
  other.close();
  world.time.set(T + 10 * 60_000);
  await device.handle.pull();
  await until(() => device.knobs.asks === 2 && panel.counts.shown && panel.counts.shown.length === 0);
  await quiet();
  assert.deepEqual(panel.counts.shown, [], '문장이 숨는다');
  panel.bounded(device.knobs.asks, device.knobs.replies, '힌트');
  panel.close();
  device.close();
});

test('아침에 빈 답을 적은 뒤 낮에 조건을 채우면 문장이 선다(같은 학습일)', { timeout: 60_000 }, async () => {
  const world = worldOf();
  const other = await deviceOf(world);
  await study(world, other, [...MISSES, ...REVIEWS]);
  other.close();
  world.time.set(T - 4 * HOUR); // 아침 8시
  const device = await deviceOf(world);
  await device.coach.synced();
  const panel = panelOf(world, device);
  panel.render();
  await until(() => panel.counts.shown);
  assert.deepEqual(panel.counts.shown, [], '아침 — 조건이 차지 않았다');
  await study(world, device, [{ at: T + 2 * HOUR, correct: true }]); // 낮 2시
  await until(() => device.knobs.asks === 2 && panel.counts.shown?.length > 0);
  await quiet();
  assert.equal(dayOf(T - 4 * HOUR), dayOf(T + 2 * HOUR), '같은 학습일');
  panel.bounded(device.knobs.asks, device.knobs.replies, '아침과 낮');
  panel.close();
  device.close();
});

test('내 놓침이 서버에 닿기 전에는 묻지 않는다 · 물은 사이 칸 밖의 답이 서면 그 답을 적지 않는다(storage.unfolded > 0)', { timeout: 60_000 }, async () => {
  const world = worldOf();
  const other = await deviceOf(world);
  await study(world, other, [...MISSES, ...REVIEWS, { at: T - 2 * HOUR, correct: true }]);
  other.close();
  world.time.set(T);
  const device = await deviceOf(world);
  await device.coach.synced();
  const panel = panelOf(world, device);
  // 놓침 — 저장됐지만 아직 올리지 않았다.
  const pid = device.coach.present(ITEM);
  world.time.advance(20_000);
  await device.coach.answer(pid, { correct: false, assessable: true }).stored;
  assert.ok(device.coach.summary().storage.unfolded > 0);
  assert.equal(panel.render(), null);
  await quiet();
  assert.equal(device.knobs.asks, 0, '내 놓침이 서버에 닿기 전에는 묻지 않는다');
  await device.handle.settled();
  await device.handle.upload();
  await until(() => device.knobs.asks === 1 && panel.counts.shown);
  assert.deepEqual(panel.counts.shown, [], '오늘의 놓침이 든 답 — 문장이 서지 않는다');
  // 물은 사이 — 묻기를 잡아 두고 그 사이 답을 하나 더 낸다(저장만).
  let release = null;
  device.knobs.lookbackHold = new Promise(resolve => {
    release = resolve;
  });
  world.time.set(T + DAY); // 다음 학습일 — 다시 묻는다
  panel.render();
  await until(() => device.knobs.asks === 2);
  const next = device.coach.present(ITEM);
  world.time.advance(20_000);
  await device.coach.answer(next, { correct: true, assessable: true }).stored;
  release();
  device.knobs.lookbackHold = null;
  await until(() => device.knobs.replies.length === 2);
  await quiet();
  assert.equal(panel.answers.read(A_ID, { revision: device.revision, day: dayOf(world.time.now()) }), null, '물은 사이 칸 밖의 답이 섰다 — 적지 않는다');
  panel.bounded(device.knobs.asks, device.knobs.replies, '놓침');
  panel.close();
  device.close();
});

