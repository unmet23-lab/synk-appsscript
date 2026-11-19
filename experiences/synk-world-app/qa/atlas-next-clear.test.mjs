// Atlas 재설계 단계 4 · 4-5 — 입구(world-atlas-next.mjs)의 연습 기록 비우기(단계4_계획 §22-4 · 22-1의 4). 손님 · 올리는 계정 · 기기 길 계정,
// 판 견줌(lastClear)과 남은 걸음 표지, 본인 값 옮기기, 앞 판 쓸기, 30일째 답 지우기, 손님 호스트의 은퇴 알림을 본다.
// 앞의 두 바퀴는 진짜 엔진 코치 + 리허설 trail(rehearsal-trail.mjs)로 돌고, 갈래는 가짜 코치로 하나씩 돈다.
// 변형 시험(qa/position-mutants.mjs의 clear)은 깬 입구 사본을 SYNK_ATLAS_NEXT_MODULE로 넘긴다. 그 밖에는 원본이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { createRehearsalTrail } from '../rehearsal-trail.mjs';
import { createPracticeNextSession } from '../world-practice-next.mjs';
import { bankItems } from '../world-topik-items.mjs';
import { allowedPlays, nextPlay } from '../world-exam-form.mjs';
import { PLAN_LOG_PREFIX } from '../world-plan-next.mjs';

const { createAtlasNext, rehearsalTrail, LEGACY_KEY, CLEARING_MARK, CLEARED_MARK, NEXT_MARK, SWITCH_MARK } = await import(
  process.env.SYNK_ATLAS_NEXT_MODULE
    ? pathToFileURL(process.env.SYNK_ATLAS_NEXT_MODULE).href
    : '../world-atlas-next.mjs'
);

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const MAP_DATA = {
  index: readJson('../../../packages/atlas/map/index.json'),
  units: readJson('../../../packages/atlas/map/units.json'),
};
const BANK = bankItems(readJson('../world-topik-items.json'));
const READING = (() => {
  const by = new Map();
  for (const item of BANK) {
    if (!by.has(item.skillId)) by.set(item.skillId, []);
    by.get(item.skillId).push(item);
  }
  return [...by]
    .filter(([id, items]) => id.includes('.reading.') && items.length >= 8)
    .sort((a, b) => b[1].length - a[1].length)[0][1];
})();
const A_ID = '44444444-4444-4444-8444-444444444444';
const POOL = [{ itemKey: 'topik-items.x1' }];

async function until(check, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw Error('기다린 일이 오지 않았다');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
// 열쇠를 셀 수 있는 저장소(localStorage 꼴 — 앞 판 쓸기가 열쇠를 센다). 이 시험들의 계정은 서버 스위치 목록에 든 계정이라, 따로 적은 답이
// 없으면 기기가 켜짐 답을 받아 둔 것으로 읽는다(스위치 먼저 묻기 — §6 「1단계 켜기」 4).
function memoryStorage(entries = []) {
  const map = new Map(entries);
  const known = key => (key.startsWith(SWITCH_MARK) ? '{"on":true}' : null);
  return {
    map,
    get length() {
      return map.size;
    },
    key: index => [...map.keys()][index] ?? null,
    getItem: key => (map.has(key) ? map.get(key) : known(key)),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: key => {
      map.delete(key);
    },
  };
}
function recorder() {
  const notes = [];
  return { notes, note: (kind, outcome) => notes.push([kind, outcome]), snapshot: () => ({ notes: notes.length }) };
}
const markOf = storage => JSON.parse(storage.getItem(CLEARING_MARK + A_ID) ?? 'null');
// 판 견줌의 두 수 — 이 기기가 몫을 마친 판(settled)과 마지막 비우기를 물은 때의 계정 판(asked).
const clearedOf = storage => JSON.parse(storage.getItem(CLEARED_MARK + A_ID) ?? 'null');

// 옛 엔진 구역의 열쇠(synk-account scopedStorage — `synk.account.<계정 열쇠>.r<판>.`). 엔진 기록 열쇠는 쓸고, 본인 값 · 오늘 상태는 둔다.
const zone = (accountKey, revision) => `synk.account.${accountKey}.r${revision}.`;
const engineKeys = (accountKey, revision) =>
  [
    LEGACY_KEY,
    `${LEGACY_KEY}.page.7.1-events`,
    `${LEGACY_KEY}.writer.3`,
    `${LEGACY_KEY}.flow`,
    `synk.atlas.learning-sync.v1.${accountKey}`,
    `synk.atlas.learning-sync.v1.${accountKey}.page.2.1-queue`,
    `synk.atlas.learning-sync.v1.${accountKey}.writer.1`,
  ].map(name => zone(accountKey, revision) + name);
const ownKeys = (accountKey, revision) => ({
  presentation: `${zone(accountKey, revision)}${LEGACY_KEY}.presentation`,
  hangul: `${zone(accountKey, revision)}hangul-stage.v1`,
  today: `${zone(accountKey, revision)}${LEGACY_KEY}.today`,
});
// 앞 판(r1)의 두 구역 · 교실 구역 · 판 기록 · 30일째 답을 채운 저장소.
function filledStorage(extra = []) {
  const entries = [];
  for (const accountKey of [A_ID, `local:${A_ID}`]) {
    for (const key of engineKeys(accountKey, 1)) entries.push([key, 'engine']);
    const own = ownKeys(accountKey, 1);
    entries.push([own.presentation, '{"support":"step"}'], [own.hangul, '{"v":1}'], [own.today, '"tired"']);
  }
  entries.push(
    [`synk.account.${A_ID}:class:c1.r1.${LEGACY_KEY}`, 'class'],
    [`${PLAN_LOG_PREFIX}synk-atlas:${A_ID}:1`, '[]'],
    [`${PLAN_LOG_PREFIX}synk-atlas:local:${A_ID}:1`, '[]'],
    [`synk:world:month-answer:${A_ID}`, '{}'],
    [`synk:world:first-answers:${A_ID}`, '{}'],
    [zone(A_ID, 2) + LEGACY_KEY, 'new'],
    [zone(`local:${A_ID}`, 2) + LEGACY_KEY, 'new'],
    [`${PLAN_LOG_PREFIX}synk-atlas:${A_ID}:2`, '[]'],
    ...extra,
  );
  return memoryStorage(entries);
}
// 비운 뒤 이 기기의 몫 — 본인 값은 새 판 구역으로(앞 판의 것은 둔다), 앞 판의 엔진 기록 열쇠 · 판 기록은 두 구역 모두 쓸고, 교실 구역 ·
// 오늘 상태는 건드리지 않고, 30일째 답은 지운다.
function assertSettled(storage, { path = 'upload', to = 2, presentation = '{"support":"step"}' } = {}) {
  const key = path === 'upload' ? A_ID : `local:${A_ID}`;
  const own = ownKeys(key, to);
  assert.equal(storage.getItem(own.presentation), presentation, '고른 화면 값을 새 판 구역으로 옮겼다(이미 있으면 덮지 않는다)');
  assert.equal(storage.getItem(own.hangul), '{"v":1}', '한글 진도 사본을 새 판 구역으로 옮겼다');
  assert.equal(storage.getItem(own.today), null, '오늘 상태는 옮기지 않는다');
  for (const accountKey of [A_ID, `local:${A_ID}`])
    for (const name of engineKeys(accountKey, 1)) assert.equal(storage.getItem(name), null, `앞 판을 쓸었다 — ${name}`);
  assert.equal(storage.getItem(ownKeys(key, 1).presentation), '{"support":"step"}', '본인 값은 쓸지 않는다');
  assert.equal(storage.getItem(ownKeys(key, 1).today), '"tired"', '오늘 상태는 쓸지도 옮기지도 않는다');
  assert.equal(storage.getItem(`synk.account.${A_ID}:class:c1.r1.${LEGACY_KEY}`), 'class', '교실 구역은 건드리지 않는다');
  assert.equal(storage.getItem(`${PLAN_LOG_PREFIX}synk-atlas:${A_ID}:1`), null);
  assert.equal(storage.getItem(`${PLAN_LOG_PREFIX}synk-atlas:local:${A_ID}:1`), null);
  assert.equal(storage.getItem(`synk:world:month-answer:${A_ID}`), null, '30일째 문장의 답을 지웠다');
  assert.equal(storage.getItem(`synk:world:first-answers:${A_ID}`), null);
  for (const accountKey of [A_ID, `local:${A_ID}`])
    assert.equal(storage.getItem(zone(accountKey, 2) + LEGACY_KEY), 'new', '새 판의 기록은 쓸지 않는다');
  assert.equal(storage.getItem(`${PLAN_LOG_PREFIX}synk-atlas:${A_ID}:2`), '[]', '새 판의 판 기록은 쓸지 않는다');
}
// 옛 엔진의 손님 기록(옛 엔진 reset은 빈 로그와 새 epoch을 쓴다). fail이면 그 code로 던진다.
function oldEngine(storage, { fail = null, flush = async () => ({ ok: true }) } = {}) {
  const old = {
    cleared: 0,
    flushed: 0,
    flush: async () => {
      old.flushed += 1;
      return flush();
    },
    clear: async () => {
      if (fail) throw Object.assign(Error(fail), { code: fail });
      old.cleared += 1;
      storage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, epoch: `wiped-${old.cleared}`, events: [] }));
    },
  };
  return old;
}

// 진짜 엔진 코치 + 리허설 trail. 기기마다 제 포트(저장소 이름마다 하나)를 두고, 계정 비우기의 손님 저장소 옆으로 열기에는 그 포트를 준다
// (브라우저는 IndexedDB에서 찾는다).
function harness() {
  let now = Date.UTC(2026, 10, 18, 1, 0, 0);
  const time = { now: () => now, advance: ms => { now += ms; } };
  const index = atlas.openMap({ index: MAP_DATA.index }).foldIndex;
  const server = createRehearsalTrail({ atlas, index, now: time.now, warn: () => {} });
  const requests = [];
  const fetcher = async (url, init = {}) => {
    const u = new URL(url, 'http://local');
    const path = u.pathname.replace('/api/world/rehearsal/', '');
    const method = init.method ?? 'GET';
    requests.push(`${method} ${path}`);
    h.onRequest?.(path, method);
    const reply = await server.handle({
      account: { id: A_ID },
      path,
      method,
      query: u.searchParams,
      body: init.body ? Buffer.from(init.body) : undefined,
      headers: new Headers(init.headers),
    });
    return { ok: reply.status < 400, status: reply.status, json: async () => reply.body };
  };
  const ports = new Map();
  const portOf = key => {
    if (!ports.has(key)) ports.set(key, atlas.memoryPort());
    return ports.get(key);
  };
  const keyOf = host =>
    host.key ?? (host.guest ? atlas.storeName({}) : atlas.storeName({ account: host.account, revision: host.revision }));
  const scope = { location: { origin: 'https://clear.test' }, addEventListener() {}, removeEventListener() {} };
  scope.parent = scope;
  const load = async () => ({
    SynkAtlas: { load: async () => atlas },
    coach: options => {
      const made = atlas.createCoach({
        ...options,
        scope,
        mapData: MAP_DATA,
        dayOffset: 540,
        host: { ...options.host, port: portOf(keyOf(options.host)), now: time.now },
      });
      const wrapped = Object.fromEntries(
        Object.entries(made).map(([name, value]) => [name, typeof value === 'function' ? value.bind(made) : value]),
      );
      const guestPort = () => (ports.has(atlas.storeName({})) ? { guestPort: ports.get(atlas.storeName({})) } : {});
      wrapped.reset = opts => made.reset({ ...opts, ...guestPort() });
      return wrapped;
    },
  });
  const plays = { allowedPlays, nextPlay };
  async function practise(coach, length = 2) {
    const session = createPracticeNextSession({ plays, coach, pool: READING, length });
    while (session.next()) {
      if (!session.current.heard) session.delivery('completed');
      session.answer(session.current.item.correctId);
      time.advance(30_000);
    }
    return session.settled();
  }
  const h = { time, server, fetcher, requests, ports, load, practise, onRequest: null };
  return h;
}
const events = async port => (await port.read()).filter(row => row.value.kind === 'event');

test('손님 한 바퀴 — 손님 저장소와 옛 엔진의 손님 기록을 비우고, 손님 판 기록 열쇠를 지우고, 같은 문서의 손님 코치를 은퇴시킨다', { timeout: 60_000 }, async () => {
  const h = harness();
  const storage = memoryStorage([[LEGACY_KEY, JSON.stringify({ version: 1, epoch: 'old-1', events: [] })]]);
  const old = oldEngine(storage);
  const guest = createAtlasNext({ owner: 'guest', storage, load: h.load, health: recorder(), oldEngine: old });
  const coach = await guest.practiceCoach(READING);
  await h.practise(coach);
  const port = h.ports.get(atlas.storeName({}));
  assert.ok((await events(port)).length > 0, '손님 연습이 손님 저장소에 있다');
  const planKey = `${PLAN_LOG_PREFIX}${atlas.storeName({})}`;
  storage.setItem(planKey, '[]');
  const reasons = [];
  guest.retired(coach, detail => reasons.push(detail.reason));
  assert.deepEqual(await guest.clearPractice(), { ok: true, path: 'guest', partial: false });
  assert.deepEqual(await events(port), [], '손님 저장소를 비웠다');
  assert.equal(old.cleared, 1, '옛 엔진의 손님 기록도 비웠다');
  assert.equal(old.flushed, 0, '손님은 올리지 않는다');
  assert.equal(storage.getItem(planKey), null, '손님 판 기록 열쇠를 지웠다');
  await until(() => reasons.length);
  assert.deepEqual(reasons, ['cleared'], '같은 문서의 손님 코치를 은퇴시킨다');
  const again = await guest.practiceCoach(READING);
  assert.ok(again && again !== coach, '다시 정해 새 코치로 연다');
  guest.dispose();
  // 옛 엔진의 손님 기록을 다른 창이 쥐었으면 「일부만 비움」 — 새 길은 비었다.
  const busyStorage = memoryStorage([[LEGACY_KEY, JSON.stringify({ version: 1, epoch: 'old-2', events: [] })]]);
  const busy = createAtlasNext({
    owner: 'guest',
    storage: busyStorage,
    load: harness().load,
    health: recorder(),
    oldEngine: oldEngine(busyStorage, { fail: 'STORAGE_BUSY' }),
  });
  assert.ok(await busy.practiceCoach(READING));
  assert.deepEqual(await busy.clearPractice(), { ok: true, path: 'guest', partial: true });
  busy.dispose();
  // 기기에 저장소가 없으면 「지금은 비우지 못했어요」.
  const bare = createAtlasNext({ owner: 'guest', storage: null, load: harness().load, health: recorder() });
  assert.deepEqual(await bare.clearPractice(), { ok: false, path: 'guest', code: 'NO_STORAGE', known: true });
  bare.dispose();
});

test('올리는 계정 한 바퀴 — 옛 대기열을 먼저 올리고 서버를 비우고, 본인 값을 새 판으로 옮기고 앞 판을 쓸고, 이 판까지 몫을 마쳤다고 적은 뒤 새 판으로 다시 연다', { timeout: 60_000 }, async () => {
  const h = harness();
  const storage = filledStorage();
  const order = [];
  const old = oldEngine(storage, {
    flush: async () => {
      order.push('flush');
      return { ok: true };
    },
  });
  let markAtClear = null;
  h.onRequest = (path, method) => {
    if (path !== 'trail-clear' || method !== 'POST') return;
    order.push('clear');
    markAtClear = markOf(storage);
  };
  const next = createAtlasNext({ owner: A_ID, storage, trail: rehearsalTrail({ fetcher: h.fetcher }), load: h.load, health: recorder(), oldEngine: old });
  const coach = await next.practiceCoach(READING);
  assert.ok(coach, '새 길(올리는 길)');
  await h.practise(coach);
  const reasons = [];
  next.retired(coach, detail => reasons.push(detail.reason));
  const done = await next.clearPractice();
  assert.deepEqual(done, { ok: true, path: 'upload', revision: 2, partial: false });
  assert.deepEqual(order, ['flush', 'clear'], '옛 엔진의 올리기 대기열을 먼저 올린다');
  assert.equal(markAtClear, null, '서버 비우기 앞에 표지를 적지 않는다 — 결과를 모르면 판 견줌이 맞춘다');
  assert.equal(markOf(storage), null, '남은 걸음이 없다');
  assert.deepEqual(clearedOf(storage), { account: A_ID, settled: 2, asked: 2 }, '이 판까지 몫을 마쳤다');
  assertSettled(storage);
  await until(() => reasons.length);
  assert.deepEqual(reasons, ['cleared']);
  const last = await (await h.fetcher('/api/world/rehearsal/trail-clear', { headers: { 'x-synk-contract': '1', 'x-synk-product': 'world' } })).json();
  assert.deepEqual(last.lastClear?.revision, 2, '서버가 판을 올리고 마지막 비우기를 적었다');
  const after = await next.practiceCoach(READING);
  assert.ok(after && after !== coach);
  assert.ok(h.ports.has(atlas.storeName({ account: A_ID, revision: 2 })), '새 판의 저장소로 다시 열었다');
  next.dispose();
});

test('같은 판의 「새 길 간 적 있음」 길은 확인된 쪽만 바꾼다 — 판 견줌 · 판 정하기 끝은 판을 올리지 않고 길만 바뀐 읽기(서버 쓰기 깃발)로 기기 길 판 2를 올리는 길로 덮지 않는다(입구 다시 검수 -d 카본 A1)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'device', revision: 2 })]]);
  const line = accountLine({ revision: 2 }); // 같은 판 2인데 쓰기 깃발이 켜져 올리는 길로 읽힌다
  line.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 5 } });
  // 엔진을 받는 데 오래 걸린다 — 새 판의 코치가 서지 않아 첫 받기(markWent)도 없다.
  const never = new Promise(() => {});
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: () => never, health: recorder() });
  void next.practiceCoach(POOL);
  await until(() => clearedOf(storage)?.settled === 2);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(wentOf(storage), { went: true, path: 'device', revision: 2 }, '첫 받기가 확인하기 전에는 같은 판의 길을 바꾸지 않는다');
  next.dispose();
});

// talk 비우기 문의 공유 막이(단계4_계획 §6 「1단계 켜기」 3 — 설계 주인 11-19 밤): #25가 들어갈 때까지 교실 · 타운 공유가 켜진 계정의 비우기를
// 거절한다. 상태 · 코드 · 본문 꼴은 4-8 세션이 talk에 지은 것이다(가지 claude/atlas-20-readers-fenced 7b094807 — 409, 이 길의 다른 오류와 같은
// { ok: false, error: { code, message } }). 기기는 408 · 429 · 5xx가 아닌 4xx를 「서버가 받지 않음」으로 본다.
const SHARING_REFUSAL = { status: 409, error: 'CLASSROOM_SHARING_ON' };
test('비우기 문이 공유가 켜진 계정을 거절하면(#25 전 talk 막이) 결과를 아는 실패다 — 아무것도 바꾸지 않고, 셸은 「지금은 비우지 못했어요」로 알린다(입구 다시 검수 -c GPT GA1 · 설계 주인 11-19 밤)', { timeout: 60_000 }, async () => {
  const h = harness();
  const storage = filledStorage();
  const fetcher = async (url, init = {}) => {
    if (String(url).endsWith('/rehearsal/trail-clear') && (init.method ?? 'GET') === 'POST')
      return { ok: false, status: SHARING_REFUSAL.status, json: async () => ({ ok: false, error: { code: SHARING_REFUSAL.error, message: SHARING_REFUSAL.error } }) };
    return h.fetcher(url, init);
  };
  const next = createAtlasNext({ owner: A_ID, storage, trail: rehearsalTrail({ fetcher }), load: h.load, health: recorder(), oldEngine: oldEngine(storage) });
  const coach = await next.practiceCoach(READING);
  assert.ok(coach, '새 길(올리는 길)');
  await h.practise(coach);
  assert.deepEqual(await next.clearPractice(), { ok: false, path: 'upload', step: 'clear', code: SHARING_REFUSAL.error, known: true });
  assert.equal(markOf(storage), null, '남은 걸음 표지를 적지 않았다');
  assert.equal(clearedOf(storage)?.settled ?? 0, 0, '몫을 마친 판을 올리지 않았다');
  for (const accountKey of [A_ID, `local:${A_ID}`]) {
    for (const name of engineKeys(accountKey, 1)) assert.equal(storage.getItem(name), 'engine', `앞 판을 쓸지 않았다 — ${name}`);
    assert.equal(storage.getItem(ownKeys(accountKey, 2).hangul), null, '본인 값을 옮기지 않았다');
  }
  assert.equal(storage.getItem(`synk:world:month-answer:${A_ID}`), '{}', '30일째 답을 지우지 않았다');
  const last = await (await h.fetcher('/api/world/rehearsal/trail-clear', { headers: { 'x-synk-contract': '1', 'x-synk-product': 'world' } })).json();
  assert.equal(last.lastClear, null, '서버는 비우지 않았다');
  // 셸은 비우기 실패 가운데 UNSENT만 따로 알리고, 그 밖은 모두 「지금은 비우지 못했어요」(me.clearFailed)다 — 새 글을 두지 않는다.
  const shell = fs.readFileSync(new URL('../app-shell.mjs', import.meta.url), 'utf8');
  assert.match(shell, /result\?\.code==='UNSENT'\?'me\.clearUnsent':'me\.clearFailed'/);
  next.dispose();
});

// ── 갈래 — 가짜 코치(reset을 시험마다 정한다) · 가짜 계정 줄 ──────────────────────────────────────────
// 계정 줄 — 부를 때마다 지금 값을 준다. lastClear()는 state.lastClear가 정한다(없으면 그 줄에 읽기가 없다).
function accountLine({ enabled = true, revision = 1, learningSync = true } = {}) {
  const state = { enabled, revision, learningSync, clears: [], lastClear: async () => ({ ok: true, revision: state.revision, lastClear: null }) };
  state.trail = async () => ({
    learning: { enabled: state.enabled, revision: state.revision },
    learningSync: state.learningSync,
    transport: at => ({
      get: async () => ({ summary: null, serverTime: 0 }),
      post: async () => ({ accepted: [], clamped: [], summary: null, serverTime: 0 }),
      // 서버 비우기는 판을 올린다(talk · 리허설과 같다).
      clear: async () => {
        state.clears.push(at);
        state.revision = at + 1;
        return { ok: true, revision: at + 1 };
      },
    }),
    ...(state.lastClear ? { lastClear: () => state.lastClear() } : {}),
    postLegacy: async () => ({ ok: true }),
  });
  return state;
}
// 가짜 코치 — reset(options)는 script가 답한다(options.settle이면 남은 걸음).
const CLEARED = (revision = 2, guest = { ok: true, dropped: 0, legacy: 'none' }) => ({ ok: true, path: 'upload', revision, guest });
function fakeLoader(script = () => CLEARED()) {
  const opened = [];
  const engine = { storeName: atlas.storeName };
  const coach = options => {
    const made = {
      options,
      resets: [],
      disposed: 0,
      ready: Promise.resolve(),
      summary: () => ({ storage: { base: true } }),
      synced: async () => ({ ok: true, base: true }),
      reset: async given => {
        made.resets.push(given);
        return script(given, made);
      },
      dispose() {
        made.disposed += 1;
      },
    };
    opened.push(made);
    return made;
  };
  return { opened, load: async () => ({ SynkAtlas: { load: async () => engine }, coach }) };
}
const settled = { ok: true, path: 'upload', settled: 'cleared', guest: { ok: true, dropped: 0, legacy: 'none' } };

test('올리기를 못 하면 아무것도 지우지 않는다 — 옛 대기열을 못 올리면 엔진 비우기를 부르지 않고, 새 길 올리기에서 멈추면 아무것도 적지 않는다', async () => {
  const storage = filledStorage();
  const line = accountLine();
  const { opened, load } = fakeLoader();
  const stuck = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: { flush: async () => false } });
  assert.deepEqual(await stuck.clearPractice(), { ok: false, path: 'upload', step: 'upload', code: 'UNSENT', known: true });
  assert.deepEqual(opened.flatMap(made => made.resets), [], '엔진 비우기를 부르지 않았다');
  assert.equal(markOf(storage), null, '표지를 적지 않았다');
  const thrown = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: { flush: async () => { throw Error('NETWORK'); } } });
  assert.equal((await thrown.clearPractice()).code, 'UNSENT');
  // 새 길의 대기열은 엔진 reset이 서버 비우기 앞에서 올린다 — 거기서 멈추면 서버에 닿지 않은 것이 분명하다.
  const upload = fakeLoader(() => ({ ok: false, path: 'upload', step: 'upload', code: 'UNSENT', known: true }));
  const newPath = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: upload.load, health: recorder(), oldEngine: oldEngine(storage) });
  assert.deepEqual(await newPath.clearPractice(), { ok: false, path: 'upload', step: 'upload', code: 'UNSENT', known: true });
  assert.equal(upload.opened[0].resets.length, 1);
  assert.equal(markOf(storage), null, '서버에 닿지 않았으니 표지를 적지 않는다');
  assert.equal(storage.getItem(ownKeys(A_ID, 1).presentation), '{"support":"step"}', '아무것도 쓸지 않았다');
  assert.equal(storage.getItem(engineKeys(A_ID, 1)[0]), 'engine');
  // 이 기기의 몫을 적을 저장소가 없으면 서버를 비우지 않는다. 스위치 답도 적지 못해 지금 판으로 열린다(스위치 먼저 묻기 — §6 「1단계 켜기」 4).
  const bare = fakeLoader();
  const noStore = createAtlasNext({ owner: A_ID, storage: null, trail: line.trail, load: bare.load, health: recorder() });
  assert.deepEqual(await noStore.clearPractice(), { ok: false, path: 'old', code: 'NOT_NEXT', known: true });
  assert.deepEqual(bare.opened.flatMap(made => made.resets), [], '엔진 비우기를 부르지 않았다');
  stuck.dispose();
  thrown.dispose();
  newPath.dispose();
  noStore.dispose();
});

test('옛 대기열은 코치를 연 뒤 엔진 비우기 바로 전에 올린다 — 서버 비우기와의 틈을 줄인다(4-5 Opus 대체 설계 검토 F1)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  const { opened, load } = fakeLoader();
  const seen = [];
  const next = createAtlasNext({
    owner: A_ID,
    storage,
    trail: line.trail,
    load,
    health: recorder(),
    oldEngine: {
      flush: async () => {
        seen.push([opened.length, markOf(storage), opened.flatMap(made => made.resets).length]);
        return true;
      },
    },
  });
  assert.equal((await next.clearPractice()).ok, true);
  assert.deepEqual(seen, [[1, null, 0]], '코치를 연 뒤, 엔진 비우기를 부르기 전에 한 번 올렸다(표지는 적지 않는다)');
  next.dispose();
});

test('늦게 끝난 비우기는 그사이 다른 탭이 적은 더 새 판의 「새 길 간 적 있음」 표지를 내리지 않는다(4-5 코드 다시 검수 GPT -c GA2)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  let release;
  const held = new Promise(resolve => {
    release = resolve;
  });
  const { opened, load } = fakeLoader(async given => {
    if (given.settle) return settled;
    await held;
    return CLEARED(2);
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: { flush: async () => true } });
  const done = next.clearPractice();
  await until(() => opened.some(made => made.resets.length));
  storage.setItem(NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 3 }));
  release();
  assert.equal((await done).ok, true);
  assert.equal(JSON.parse(storage.getItem(NEXT_MARK + A_ID)).revision, 3, '더 새 판을 내리지 않는다');
  next.dispose();
});

test('앞 비우기의 남은 걸음 표지는 새 비우기가 건드리지 않는다 — 서버에 닿지 않고 끝나도, 결과를 몰라도 그대로이고, 서버에서 끝난 새 비우기는 다음 판 견줌이 따라 한다(4-5 코드 다시 검수 GPT -c GA3)', async () => {
  const prior = { account: A_ID, path: 'upload', revision: 2, at: Date.now() - 1000, left: 'cleared' };
  const stuck = { ok: true, path: 'upload', settled: 'cleared', guest: { ok: false, code: 'STORAGE_FAILED', dropped: 0, legacy: 'kept' } };
  // 첫 확인에서 멈췄다(UNSENT_SKIPPED) — 서버에 닿지 않았다.
  const s1 = filledStorage();
  s1.setItem(CLEARING_MARK + A_ID, JSON.stringify(prior));
  const l1 = accountLine({ revision: 2 });
  const n1 = createAtlasNext({
    owner: A_ID,
    storage: s1,
    trail: l1.trail,
    load: fakeLoader(given => (given.settle ? stuck : { ok: false, path: 'upload', step: 'upload', code: 'UNSENT_SKIPPED', skipped: 1, known: true })).load,
    health: recorder(),
  });
  assert.equal((await n1.clearPractice()).code, 'UNSENT_SKIPPED');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(markOf(s1), prior, '앞 비우기의 남은 걸음 표지가 그대로다');
  n1.dispose();
  // 결과를 모른다(마지막 비우기도 못 읽음) — 앞 표지는 그대로다. 그 비우기가 서버에서 끝났으면(판 3) 계정 판이 오른 뒤의 판 견줌이 따라 한다.
  const s2 = filledStorage();
  s2.setItem(CLEARING_MARK + A_ID, JSON.stringify(prior));
  const l2 = accountLine({ revision: 2 });
  l2.lastClear = async () => {
    throw Object.assign(Error('NETWORK'), { code: 'NETWORK', retryable: true });
  };
  const second = fakeLoader(given => (given.settle ? stuck : { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false }));
  const n2 = createAtlasNext({ owner: A_ID, storage: s2, trail: l2.trail, load: second.load, health: recorder() });
  assert.equal((await n2.clearPractice()).known, false);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(markOf(s2), prior, '결과를 모르는 비우기도 앞 표지를 바꾸지 않는다');
  l2.revision = 3;
  l2.lastClear = async () => ({ ok: true, revision: 3, lastClear: { revision: 3, at: 1 } });
  n2.redecide();
  assert.equal((await n2.practiceCoach(POOL))?.options.host.revision, 3);
  await until(() => markOf(s2)?.revision === 3);
  assert.equal(markOf(s2).left, 'cleared', '서버에서 끝난 새 비우기(판 3)의 남은 걸음이 앞 걸음을 품는다');
  await until(() => second.opened.some(made => made.resets.some(given => given.settle === 'cleared' && given.revision === 3)));
  n2.dispose();
});

test('지금 보낼 수 없는 옛 사건 — 옛 대기열의 몫을 엔진 reset에 넘겨 새 길의 몫과 한 번에 알리고(UNSENT_SKIPPED) 아무것도 적지 않는다. 학생이 그 수를 확인하면 다시 불러 비운다(4-5 Opus 대체 설계 검토 F4)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  const { opened, load } = fakeLoader(given => {
    const skipped = 1 + (given.skippedElsewhere ?? 0);
    return (given.allowSkipped ?? 0) >= skipped
      ? CLEARED()
      : { ok: false, path: 'upload', step: 'upload', code: 'UNSENT_SKIPPED', skipped, known: true };
  });
  const next = createAtlasNext({
    owner: A_ID,
    storage,
    trail: line.trail,
    load,
    health: recorder(),
    oldEngine: { flush: async () => ({ ok: false, code: 'UNSENT_SKIPPED', skipped: 3 }) },
  });
  assert.deepEqual(await next.clearPractice(), { ok: false, path: 'upload', step: 'upload', code: 'UNSENT_SKIPPED', skipped: 4, known: true });
  assert.equal(markOf(storage), null, '서버에 닿지 않았으니 표지를 적지 않는다');
  assert.equal((await next.clearPractice({ allowSkipped: 4 })).ok, true, '확인한 수까지 비운다');
  assert.deepEqual(
    opened.flatMap(made => made.resets.map(given => [given.allowSkipped, given.skippedElsewhere])),
    [[0, 3], [4, 3]],
  );
  next.dispose();
});

test('남은 걸음은 뒤에서 한다 — 판 정하기는 손님 저장소의 걸음을 기다리지 않고, 옛 엔진 문에 임대를 기다리지 말라고(wait 0) 넘긴다. 그사이 새 비우기가 표지를 바꿨으면 덮지 않는다(4-5 Opus 대체 설계 검토 F7 · 설계 주인 11-18)', { timeout: 20_000 }, async () => {
  const storage = filledStorage();
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify({ account: A_ID, path: 'upload', revision: 2, at: Date.now(), left: 'legacy' }));
  const line = accountLine({ revision: 2 });
  let release;
  const held = new Promise(resolve => {
    release = resolve;
  });
  const seen = [];
  let finished = false;
  const { load } = fakeLoader(async given => {
    if (!given.settle) return CLEARED();
    seen.push(given);
    await held;
    finished = true;
    return { ok: true, path: 'upload', settled: given.settle, guest: { ok: true, dropped: 0, legacy: 'cleared' } };
  });
  const waits = [];
  const next = createAtlasNext({
    owner: A_ID,
    storage,
    trail: line.trail,
    load,
    health: recorder(),
    oldEngine: {
      flush: async () => true,
      clear: async options => {
        waits.push(options?.wait ?? null);
        return 'cleared';
      },
    },
  });
  assert.ok(await next.practiceCoach(POOL), '남은 걸음을 기다리지 않고 코치를 낸다');
  await until(() => seen.length === 1);
  assert.equal(markOf(storage)?.left, 'legacy', '남은 걸음이 아직 돈다');
  await seen[0].legacy.clear({});
  assert.deepEqual(waits, [0], '옛 쓰기 임대를 기다리지 않는다');
  // 도는 사이 다른 탭이 더 새 비우기의 남은 걸음 표지를 적었다 — 앞 걸음의 결과로 지우지 않는다.
  const fresh = { account: A_ID, path: 'upload', revision: 3, at: Date.now(), left: 'cleared' };
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify(fresh));
  release();
  await until(() => finished);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(markOf(storage), fresh);
  next.dispose();
});

test('로그아웃한 기기의 손님 입구도 남은 걸음 표지가 있는 계정의 걸음을 뒤에서 마저 한다 — 이 기기가 아직 따라 하지 않은 비우기는 그 계정이 돌아오면 판 견줌이 맞춘다(4-5 Opus 대체 설계 검토 F7 · 설계 주인 11-18)', { timeout: 20_000 }, async () => {
  const storage = filledStorage();
  const B_ID = '55555555-5555-4555-8555-555555555555';
  // 남은 걸음이 없는 옛 꼴의 표지(B — 결과를 모르던 표지)를 먼저 둔다. 읽지 않는다 — 뒤에서 차례로 도는 손님 걸음이 A에 닿았으면 B는 이미 지나갔다.
  storage.setItem(CLEARING_MARK + B_ID, JSON.stringify({ account: B_ID, path: 'upload', revision: 1, at: Date.now() }));
  storage.setItem(CLEARED_MARK + B_ID, JSON.stringify({ account: B_ID, settled: 0, asked: 0 }));
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify({ account: A_ID, path: 'upload', revision: 2, at: Date.now(), left: 'cleared' }));
  const seen = [];
  const { load } = fakeLoader(given => {
    seen.push([given.settle ?? null, given.account ?? null, given.revision ?? null]);
    return { ok: true, path: 'device', settled: given.settle, guest: { ok: true, dropped: 1, legacy: 'none' } };
  });
  const guest = createAtlasNext({ owner: 'guest', storage, load, health: recorder() });
  assert.ok(await guest.practiceCoach(POOL));
  await until(() => storage.getItem(CLEARING_MARK + A_ID) === null);
  assert.deepEqual(seen, [['cleared', A_ID, 2]], '남은 걸음 표지가 있는 계정의 걸음만 — 어느 계정인지 넘긴다');
  assert.ok(storage.getItem(CLEARING_MARK + B_ID), '옛 꼴의 표지는 건드리지 않는다');
  assert.deepEqual(JSON.parse(storage.getItem(CLEARED_MARK + B_ID)), { account: B_ID, settled: 0, asked: 0 }, '손님은 그 계정의 판 견줌을 하지 않는다');
  guest.dispose();
});

test('결과를 모르는 비우기 — 아무것도 적지 않고 「지금은 비우지 못했어요」, 계정 판이 오르면 다음 다시 정하기가 같은 계정의 마지막 비우기를 읽어 이 기기의 몫과 남은 걸음을 한다', async () => {
  const storage = filledStorage();
  const line = accountLine();
  line.lastClear = async () => {
    throw Object.assign(Error('NETWORK'), { code: 'NETWORK', retryable: true });
  };
  const { opened, load } = fakeLoader(given =>
    given.settle ? settled : { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false },
  );
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: oldEngine(storage) });
  assert.deepEqual(await next.clearPractice(), { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false });
  assert.equal(markOf(storage), null, '결과를 모르는 비우기를 따로 적지 않는다');
  assert.equal(clearedOf(storage), null, '마지막 비우기를 못 읽어 물은 판을 올리지 않았다');
  assert.equal(storage.getItem(engineKeys(A_ID, 1)[0]), 'engine', '아무것도 쓸지 않았다');
  // 아직 새 값을 못 받았다(마지막 비우기를 못 읽음) — 다시 정해도 아무것도 하지 않는다.
  next.redecide();
  assert.ok(await next.practiceCoach(POOL));
  assert.equal(storage.getItem(engineKeys(A_ID, 1)[0]), 'engine');
  // 늦게 끝난 요청이 서버를 비웠다(판 2 · 마지막 비우기 2) — 다음 다시 정하기가 맞춘다.
  line.revision = 2;
  line.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 5 } });
  storage.setItem(ownKeys(A_ID, 2).presentation, '{"support":"independent"}'); // 새 판에서 이미 고른 값
  next.redecide();
  const after = await next.practiceCoach(POOL);
  assert.equal(after.options.host.revision, 2);
  await until(() => markOf(storage) === null); // 손님 저장소의 걸음은 뒤에서 돈다(F7)
  assertSettled(storage, { presentation: '{"support":"independent"}' });
  assert.deepEqual(
    opened.flatMap(made => made.resets.map(given => [made.options.host.revision, given.settle ?? null, given.revision ?? null])),
    [[1, null, null], [2, 'cleared', 2]],
    '손님 저장소의 걸음은 새 판의 코치로 — 서버를 다시 비우지 않고, 넷째 걸음의 경계로 그 비우기가 올린 판을 넘긴다(F5)',
  );
  next.dispose();
});

test('서버가 받지 않은 비우기(409) — 아무것도 적지 않고 판을 다시 정한다. 마지막 비우기를 못 읽었으면 물은 판을 올리지 않아 계정 판이 오른 뒤의 판 견줌이 맞춘다. 다른 기기가 먼저 비웠으면 이 기기의 몫은 하되 「비웠어요」가 아니라 판이 바뀌었다고 알린다(4-5 끝 판 GPT GC4 · Fable 5.2 설계 검토 F2)', async () => {
  const conflict = { ok: false, path: 'upload', step: 'clear', code: 'REVISION_CONFLICT', known: true };
  // 비워지지 않았다(마지막 비우기 없음) — 아무것도 적지 않고, 판을 다시 정한다.
  const s1 = filledStorage();
  const l1 = accountLine();
  const n1 = createAtlasNext({ owner: A_ID, storage: s1, trail: l1.trail, load: fakeLoader(() => conflict).load, health: recorder() });
  const c1 = await n1.practiceCoach(POOL);
  const r1 = [];
  n1.retired(c1, detail => r1.push(detail.reason));
  assert.deepEqual(await n1.clearPractice(), { ok: false, path: 'upload', step: 'clear', code: 'REVISION_CONFLICT', known: true });
  assert.equal(markOf(s1), null);
  assert.equal(s1.getItem(engineKeys(A_ID, 1)[0]), 'engine', '아무것도 쓸지 않았다');
  await until(() => r1.length);
  assert.deepEqual(r1, ['account'], '판을 다시 정한다');
  // 마지막 비우기를 못 읽었다(읽기가 없는 줄) — 아무것도 적지 않는다. 다른 기기가 비웠으면 계정 판이 오른 뒤의 판 견줌이 맞춘다.
  const s2 = filledStorage();
  const l2 = accountLine();
  l2.lastClear = null;
  const n2 = createAtlasNext({ owner: A_ID, storage: s2, trail: l2.trail, load: fakeLoader(given => (given.settle ? settled : conflict)).load, health: recorder() });
  assert.equal((await n2.clearPractice()).known, true);
  assert.equal(markOf(s2), null, '읽기가 없는 줄 — 표지를 적지 않는다');
  assert.equal(clearedOf(s2), null, '물은 판을 올리지 않았다');
  l2.revision = 2;
  l2.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 9 } });
  assert.equal((await n2.practiceCoach(POOL))?.options.host.revision, 2);
  await until(() => markOf(s2) === null && clearedOf(s2)?.settled === 2);
  assertSettled(s2);
  // 다른 기기가 먼저 비웠다(마지막 비우기의 판이 고른 판보다 뒤) — 이 기기의 몫(본인 값 · 앞 판 쓸기 · 남은 걸음)은 성공 길과 같이 한다.
  // 이 비우기는 서버가 받지 않았으니 「비웠어요」가 아니다 — 그사이 새 판에 쌓인 기록이 남았을 수 있다. 다시 누르면 새 판을 비운다.
  const s3 = filledStorage();
  const l3 = accountLine();
  const third = fakeLoader(given => (given.settle ? settled : conflict));
  const n3 = createAtlasNext({ owner: A_ID, storage: s3, trail: l3.trail, load: third.load, health: recorder() });
  const coach = await n3.practiceCoach(POOL);
  const reasons = [];
  n3.retired(coach, detail => reasons.push(detail.reason));
  // 다른 기기가 비워 서버는 이미 새 판이다 — 이 문서는 아직 판 1의 코치를 들고 있다.
  l3.revision = 2;
  l3.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 9 } });
  assert.deepEqual(await n3.clearPractice(), { ok: false, path: 'upload', step: 'clear', code: 'PLAN_CHANGED', known: true });
  assert.equal(JSON.parse(s3.getItem(NEXT_MARK + A_ID)).revision, 2, '「새 길 간 적 있음」은 새 판이다');
  assertSettled(s3);
  assert.equal(markOf(s3), null);
  await until(() => reasons.length);
  assert.deepEqual(reasons, ['cleared']);
  assert.deepEqual(
    third.opened.flatMap(made => made.resets.map(given => [made.options.host.revision, given.settle ?? null])),
    [[1, null], [2, 'cleared']],
    '손님 저장소의 걸음(넷째 걸음과 4b)은 곧바로 새 판의 코치로 마저 한다',
  );
  n1.dispose();
  n2.dispose();
  n3.dispose();
});

test('판 견줌 — 계정 판이 마지막으로 물은 판보다 오를 때만 마지막 비우기를 묻고, 이 기기가 몫을 마친 판보다 뒤의 비우기만 따라 한다. 다른 계정의 표지와 옛 꼴의 표지는 건드리지 않는다', async () => {
  // 몫을 마친 판의 비우기(판 0 → 1)는 다시 하지 않는다 — 물은 판만 올린다.
  const earlier = filledStorage([[CLEARED_MARK + A_ID, JSON.stringify({ account: A_ID, settled: 1, asked: 0 })]]);
  const past = accountLine();
  let asks = 0;
  past.lastClear = async () => {
    asks += 1;
    return { ok: true, revision: 1, lastClear: { revision: 1, at: 3 } };
  };
  const steps = [];
  const quiet = fakeLoader(given => {
    steps.push(given.settle ?? null);
    return settled;
  });
  const before = createAtlasNext({ owner: A_ID, storage: earlier, trail: past.trail, load: quiet.load, health: recorder() });
  assert.ok(await before.practiceCoach(POOL));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(asks, 1);
  assert.deepEqual(clearedOf(earlier), { account: A_ID, settled: 1, asked: 1 });
  assert.equal(earlier.getItem(engineKeys(A_ID, 1)[0]), 'engine', '쓸지 않았다');
  assert.equal(earlier.getItem(`synk:world:month-answer:${A_ID}`), '{}', '30일째 답도 그대로다');
  assert.deepEqual(steps, [], '손님 저장소의 걸음을 다시 하지 않는다');
  assert.equal(markOf(earlier), null);
  // 계정 판이 그대로면 다시 정해도 묻지 않는다 — 비우기는 늘 판을 올린다.
  before.redecide();
  assert.ok(await before.practiceCoach(POOL));
  assert.equal(asks, 1, '판이 그대로 — 그사이 비우기도 없다');
  before.dispose();
  // 다른 계정의 표지와 남은 걸음이 없는 옛 꼴의 표지(결과를 모르던 표지)는 읽지도 바꾸지도 않는다.
  const other = { account: 'acct-other', path: 'upload', revision: 2, at: 0, left: 'cleared' };
  const legacyForm = { account: A_ID, path: 'upload', revision: 1, at: Date.now() - 1000 };
  const storage = filledStorage([
    [CLEARING_MARK + A_ID, JSON.stringify(legacyForm)],
    [`${CLEARING_MARK}acct-other`, JSON.stringify(other)],
  ]);
  const seen = [];
  const { load } = fakeLoader(given => {
    seen.push(given.settle ?? null);
    return settled;
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: accountLine().trail, load, health: recorder() });
  assert.ok(await next.practiceCoach(POOL));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(seen, [], '남은 걸음이 없다');
  assert.deepEqual(markOf(storage), legacyForm, '옛 꼴의 표지는 읽지 않는다');
  assert.deepEqual(JSON.parse(storage.getItem(`${CLEARING_MARK}acct-other`)), other, '다른 계정의 표지는 건드리지 않는다');
  assert.equal(storage.getItem(engineKeys(A_ID, 1)[0]), 'engine');
  next.dispose();
});

test('옛 손님 로그 남음 — 4b를 다른 창이 쥐었으면 표지에 남은 걸음을 적고 곧바로 다시 정해 4b만 마저 한다. 그래도 안 되면 「일부만 비움」', async () => {
  const storage = filledStorage();
  const line = accountLine();
  const busyGuest = { ok: true, dropped: 2, legacy: 'busy' };
  let second = 'cleared';
  const { opened, load } = fakeLoader(given =>
    given.settle
      ? { ok: true, path: 'upload', settled: given.settle, guest: { ok: true, dropped: 0, legacy: second } }
      : CLEARED(2, busyGuest),
  );
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: oldEngine(storage) });
  await next.practiceCoach(POOL);
  line.revision = 2;
  assert.deepEqual(await next.clearPractice(), { ok: true, path: 'upload', revision: 2, partial: false });
  assert.deepEqual(
    opened.flatMap(made => made.resets.map(given => [made.options.host.revision, given.settle ?? null])),
    [[1, null], [2, 'legacy']],
    '넷째 걸음은 이미 했다 — 4b만(옮긴 사건을 다시 지우지 않는다)',
  );
  assert.equal(markOf(storage), null);
  next.dispose();
  // 또 바쁘면 표지(새 판 · 옛 손님 로그 남음)를 남기고 「일부만 비움」 — 다음 다시 정하기가 또 한다.
  const s2 = filledStorage();
  const l2 = accountLine();
  second = 'busy';
  const n2 = createAtlasNext({ owner: A_ID, storage: s2, trail: l2.trail, load: fakeLoader(given =>
    given.settle ? { ok: true, path: 'upload', settled: given.settle, guest: { ok: true, dropped: 0, legacy: second } } : CLEARED(2, busyGuest),
  ).load, health: recorder() });
  await n2.practiceCoach(POOL);
  l2.revision = 2;
  assert.deepEqual(await n2.clearPractice(), { ok: true, path: 'upload', revision: 2, partial: true });
  assert.deepEqual([markOf(s2).revision, markOf(s2).left], [2, 'legacy']);
  second = 'cleared';
  n2.redecide();
  assert.ok(await n2.practiceCoach(POOL));
  await until(() => markOf(s2) === null); // 다음 다시 정하기가 뒤에서 마저 하고 표지를 지운다(F7)
  n2.dispose();
  // 넷째 걸음이 안 됐으면(손님 저장소를 못 엶) 넷째 걸음과 4b를 다시 한다.
  const s3 = filledStorage();
  const l3 = accountLine();
  const third = fakeLoader(given => (given.settle ? settled : CLEARED(2, { ok: false, code: 'STORAGE_FAILED', dropped: 0, legacy: 'kept' })));
  const n3 = createAtlasNext({ owner: A_ID, storage: s3, trail: l3.trail, load: third.load, health: recorder() });
  await n3.practiceCoach(POOL);
  l3.revision = 2;
  assert.equal((await n3.clearPractice()).partial, false);
  assert.deepEqual(
    third.opened.flatMap(made => made.resets.map(given => given.settle ?? null)),
    [null, 'cleared'],
  );
  n3.dispose();
});

test('옛 엔진의 비우는 문에 옛 로그 읽개를 함께 넘긴다 — 4b의 다시 판단이 쓰기 임대를 쥔 채 이 읽개로 이 기기의 옛 손님 로그를 읽는다(4-5 코드 검수 GPT GA1)', async () => {
  const storage = filledStorage();
  storage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, epoch: 'e-read', events: [{ id: 'old-1' }] }));
  const line = accountLine();
  const seen = [];
  const old = {
    flush: async () => ({ ok: true }),
    clear: async options => {
      seen.push(options);
      return 'kept';
    },
  };
  const { load } = fakeLoader(async given => {
    const outcome = await given.legacy.clear({ check: () => false });
    return CLEARED(2, { ok: true, dropped: 0, legacy: outcome === 'kept' ? 'kept' : 'cleared' });
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: old });
  await next.practiceCoach(POOL);
  line.revision = 2;
  assert.equal((await next.clearPractice()).ok, true);
  assert.equal(seen.length, 1);
  assert.equal(typeof seen[0].check, 'function', '엔진이 준 판단을 그대로 넘긴다');
  assert.equal(typeof seen[0].read, 'function', '옛 로그 읽개를 함께 넘긴다');
  assert.deepEqual([seen[0].read()?.epoch, seen[0].read()?.log.map(event => event.id)], ['e-read', ['old-1']], '이 기기의 옛 손님 로그를 읽는다');
  next.dispose();
});

test('기기 길 계정 — 같은 길 하나다: 서버 비우기는 입구가 그 판의 나르개로 주고, 옛 대기열은 올리지 않으며, 본인 값은 local: 구역으로 옮긴다', async () => {
  const storage = filledStorage();
  const line = accountLine({ enabled: false });
  const old = oldEngine(storage);
  const { opened, load } = fakeLoader(async given => {
    const answer = await given.clear();
    return { ok: true, path: 'device', revision: answer.revision, guest: { ok: true, dropped: 0, legacy: 'none' } };
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: old });
  const coach = await next.practiceCoach(POOL);
  assert.equal(coach.options.host.guest, true, '기기 길');
  const done = await next.clearPractice();
  assert.deepEqual(done, { ok: true, path: 'device', revision: 2, partial: false });
  assert.deepEqual(line.clears, [1], '그 판의 나르개로 비웠다');
  assert.equal(old.flushed, 0, '기기 길은 올리지 않는다');
  assert.equal(typeof opened[0].resets[0].clear, 'function');
  assertSettled(storage, { path: 'device' });
  next.dispose();
  // 판을 다시 읽은 뒤(planNow의 다시 보기) 비우기 직전에 판이 바뀌었으면 비우지 않고 다시 정한다. 비우는 동안의 둘째 읽기부터 판 3이다.
  const moved = accountLine({ enabled: false });
  let reads = 0;
  let flipAfter = Infinity;
  const trail = async () => {
    reads += 1;
    const value = await moved.trail();
    return reads > flipAfter ? { ...value, learning: { ...value.learning, revision: 3 } } : value;
  };
  const stale = fakeLoader();
  const n2 = createAtlasNext({ owner: A_ID, storage: filledStorage(), trail, load: stale.load, health: recorder() });
  await n2.practiceCoach(POOL);
  flipAfter = reads + 1;
  assert.deepEqual(await n2.clearPractice(), { ok: false, path: 'device', step: 'clear', code: 'PLAN_CHANGED', known: true });
  assert.deepEqual(stale.opened.flatMap(made => made.resets), [], '비우지 않았다');
  assert.deepEqual(moved.clears, []);
  n2.dispose();
});

test('비운 뒤 「새 길 간 적 있음」 표지는 새 판을 가리킨다 — 새 판 코치가 서기 전에 계정을 못 읽고 다시 열어도 앞 판 저장소를 열지 않는다(올리는 계정 · 기기 길 계정, 4-5 Opus 대체 설계 검토 F3)', async () => {
  const offline = async () => {
    throw Object.assign(Error('NETWORK'), { code: 'NETWORK', retryable: true });
  };
  for (const path of ['upload', 'device']) {
    const storage = filledStorage();
    const line = accountLine({ enabled: path === 'upload' });
    const { load } = fakeLoader(async given => {
      const revision = given.clear ? (await given.clear()).revision : 2;
      return { ok: true, path, revision, guest: { ok: true, dropped: 0, legacy: 'none' } };
    });
    const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: oldEngine(storage) });
    await next.practiceCoach(POOL);
    assert.equal((await next.clearPractice()).ok, true, path);
    assert.deepEqual(JSON.parse(storage.getItem(NEXT_MARK + A_ID)), { went: true, path, revision: 2 }, `${path} — 표지가 새 판이다`);
    next.dispose();
    // 새 판 코치가 서기 전에 망이 끊겼다 — 다시 열어 계정을 못 읽으면 표지의 판으로 연다.
    const reopened = createAtlasNext({ owner: A_ID, storage, trail: offline, load, health: recorder() });
    const coach = await reopened.practiceCoach(POOL);
    assert.equal(coach?.options.host.revision, 2, `${path} — 앞 판(1)이 아니라 새 판의 저장소를 연다`);
    reopened.dispose();
  }
});

test('새 길이 아니면(스위치 꺼짐) 엔진 비우기를 하지 않는다 · 겹쳐 누르면 도는 비우기를 그대로 준다', async () => {
  const off = createAtlasNext({
    owner: A_ID,
    storage: memoryStorage([[`synk.atlas.next.${A_ID}`, '{"off":true}']]),
    trail: accountLine().trail,
    load: fakeLoader().load,
    health: recorder(),
  });
  assert.deepEqual(await off.clearPractice(), { ok: false, path: 'old', code: 'NOT_NEXT', known: true });
  off.dispose();
  const storage = filledStorage();
  const line = accountLine();
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const { opened, load } = fakeLoader(async () => {
    await gate;
    return CLEARED();
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder() });
  const first = next.clearPractice();
  const again = next.clearPractice();
  assert.equal(first, again, '같은 약속');
  await until(() => opened.some(made => made.resets.length));
  release();
  assert.equal((await first).ok, true);
  assert.equal(opened.flatMap(made => made.resets).length, 1, '한 번만 비웠다');
  next.dispose();
});

test('손님 호스트는 다른 탭이 손님 저장소를 비웠다는 알림(STORE_CLEARED)만 받아 다시 정하고, 저장소 닫힘(STORE_CLOSED)은 지금처럼 두고 계기에만 남긴다', async () => {
  const { opened, load } = fakeLoader();
  const guest = createAtlasNext({ owner: 'guest', storage: memoryStorage(), load, health: recorder() });
  const coach = await guest.practiceCoach(POOL);
  const reasons = [];
  guest.retired(coach, detail => reasons.push(detail.reason));
  assert.equal(typeof coach.options.host.onAccount, 'function');
  coach.options.host.onAccount({ kind: 'store', code: 'STORE_CLOSED', status: null, revision: null });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(reasons, [], '닫힘은 은퇴시키지 않는다');
  coach.options.host.onAccount({ kind: 'store', code: 'STORE_CLEARED', status: null, revision: null });
  await until(() => reasons.length);
  assert.deepEqual(reasons, ['store']);
  assert.notEqual(await guest.practiceCoach(POOL), coach);
  assert.equal(opened.length, 2);
  guest.dispose();
});

// ── 4-5 끝 판 GPT 묶음 C — 비우기 표지와 판(GC2 · GC3 · GC4 · GC6) ──────────────────────────────────────────
const offlineTrail = async () => {
  throw Object.assign(Error('NETWORK'), { code: 'NETWORK', retryable: true });
};
const wentOf = storage => JSON.parse(storage.getItem(NEXT_MARK + A_ID) ?? 'null');
// 붙잡을 수 있는 계정 줄 — hold() 뒤의 읽기는 release()까지 기다린다.
function heldTrail(line) {
  let gate = null;
  let open = null;
  return {
    trail: async () => {
      if (gate) await gate;
      return line.trail();
    },
    hold() {
      gate = new Promise(resolve => {
        open = resolve;
      });
    },
    release() {
      const done = open;
      gate = null;
      open = null;
      done?.();
    },
    held: () => gate != null,
  };
}
const flushed = { flush: async () => true };

test('늦게 끝난 앞 비우기는 그사이 다른 탭이 마친 뒤 비우기의 남은 걸음 표지를 지우지도 덮지도 않는다 — 다음 오프라인 시작은 뒤 비우기의 판을 연다(4-5 끝 판 GPT GC2)', async () => {
  // 이 기기의 옛 손님 로그는 다른 창이 쥐고 있다 — 4b는 어느 탭에서도 아직 못 한다.
  const busy = { ok: true, path: 'upload', settled: 'legacy', guest: { ok: true, dropped: 0, legacy: 'busy' } };
  for (const [name, late] of [
    ['남은 걸음 없음', { ok: true, dropped: 0, legacy: 'none' }],
    ['4b 남음', { ok: true, dropped: 0, legacy: 'busy' }],
  ]) {
    const storage = filledStorage();
    const line = accountLine();
    const slow = heldTrail(line);
    // 탭 A — 서버 비우기(1 → 2) 뒤 이 기기의 몫(계정 다시 읽기)이 늦는다.
    const a = fakeLoader(given => {
      if (given.settle) return busy;
      line.revision = 2;
      slow.hold();
      return CLEARED(2, late);
    });
    const tabA = createAtlasNext({ owner: A_ID, storage, trail: slow.trail, load: a.load, health: recorder(), oldEngine: flushed });
    const doneA = tabA.clearPractice();
    await until(() => slow.held());
    // 탭 B — 판 2를 비우고(2 → 3) 4b가 남았다.
    const b = fakeLoader(given => {
      if (given.settle) return busy;
      line.revision = 3;
      return CLEARED(3, { ok: true, dropped: 0, legacy: 'busy' });
    });
    const tabB = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: b.load, health: recorder(), oldEngine: flushed });
    assert.deepEqual(await tabB.clearPractice(), { ok: true, path: 'upload', revision: 3, partial: true });
    assert.deepEqual([markOf(storage)?.revision, markOf(storage)?.left], [3, 'legacy']);
    slow.release();
    assert.equal((await doneA).ok, true);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(
      [markOf(storage)?.revision, markOf(storage)?.left],
      [3, 'legacy'],
      `${name} — 앞 비우기가 뒤 비우기의 남은 걸음 표지를 지우지도 덮지도 않았다`,
    );
    assert.equal(wentOf(storage).revision, 3);
    assert.deepEqual(clearedOf(storage), { account: A_ID, settled: 3, asked: 3 }, `${name} — 앞 비우기가 몫을 마친 판을 내리지 않았다`);
    tabA.dispose();
    tabB.dispose();
    const reopened = createAtlasNext({ owner: A_ID, storage, trail: offlineTrail, load: fakeLoader().load, health: recorder() });
    assert.equal((await reopened.practiceCoach(POOL))?.options.host.revision, 3, `${name} — 뒤 비우기의 판으로 연다`);
    reopened.dispose();
  }
});

test('「새 길 간 적 있음」의 판은 내려가지 않는다 — 늦게 온 계정 읽기가 앞 판을 주어 그 판의 코치를 열어도, 다음 오프라인 시작은 더 새 판을 연다(4-5 끝 판 GPT GC2)', async () => {
  const storage = filledStorage();
  storage.setItem(NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 3 }));
  const stale = accountLine({ revision: 2 }); // 다른 탭이 판 3으로 비운 뒤 늦게 온 판 2의 계정 줄
  const next = createAtlasNext({ owner: A_ID, storage, trail: stale.trail, load: fakeLoader().load, health: recorder() });
  assert.equal((await next.practiceCoach(POOL))?.options.host.revision, 2);
  assert.deepEqual(wentOf(storage), { went: true, path: 'upload', revision: 3 }, '판 2의 코치가 표지를 내리지 않았다');
  next.dispose();
  const reopened = createAtlasNext({ owner: A_ID, storage, trail: offlineTrail, load: fakeLoader().load, health: recorder() });
  assert.equal((await reopened.practiceCoach(POOL))?.options.host.revision, 3);
  reopened.dispose();
});

test('늦게 끝난 앞 비우기의 남은 걸음은 그사이 다른 탭이 시작한 비우기가 서버에 닿지 않고 끝나도 그대로 남는다(4-5 끝 판 GPT GC2)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  const slow = heldTrail(line);
  // 이 기기의 옛 손님 로그는 다른 창이 쥐고 있다 — 4b는 어느 탭에서도 아직 못 한다.
  const busy = { ok: true, path: 'upload', settled: 'legacy', guest: { ok: true, dropped: 0, legacy: 'busy' } };
  const a = fakeLoader(given => {
    if (given.settle) return busy;
    line.revision = 2;
    slow.hold();
    return CLEARED(2, { ok: true, dropped: 0, legacy: 'busy' }); // 4b가 남았다
  });
  const tabA = createAtlasNext({ owner: A_ID, storage, trail: slow.trail, load: a.load, health: recorder(), oldEngine: flushed });
  const doneA = tabA.clearPractice();
  await until(() => slow.held());
  // 탭 B — 판 2에서 새 비우기를 시작했다. 그 비우기는 올리기에서 멈춘다.
  let stop;
  const stopping = new Promise(resolve => {
    stop = resolve;
  });
  const b = fakeLoader(async given => {
    if (given.settle) return busy;
    await stopping;
    return { ok: false, path: 'upload', step: 'upload', code: 'UNSENT', known: true };
  });
  const tabB = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: b.load, health: recorder(), oldEngine: flushed });
  const doneB = tabB.clearPractice();
  await until(() => b.opened.some(made => made.resets.length));
  slow.release();
  assert.deepEqual(await doneA, { ok: true, path: 'upload', revision: 2, partial: true });
  assert.deepEqual([markOf(storage)?.revision, markOf(storage)?.left], [2, 'legacy'], '앞 비우기가 남은 걸음을 제 표지로 적었다');
  stop();
  assert.equal((await doneB).code, 'UNSENT');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(
    [markOf(storage)?.revision, markOf(storage)?.left],
    [2, 'legacy'],
    '뒤 비우기가 서버에 닿지 않고 끝나도 앞 비우기의 남은 걸음이 그대로다',
  );
  tabA.dispose();
  tabB.dispose();
});

test('서버가 받지 않은 비우기는 그사이 다른 탭이 적은 표지를 건드리지 않는다(4-5 끝 판 GPT GC2)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  let refuse;
  const refusing = new Promise(resolve => {
    refuse = resolve;
  });
  let resetting = false;
  // 이 기기의 옛 손님 로그는 다른 창이 쥐고 있다 — 4b는 어느 탭에서도 아직 못 한다.
  const busy = { ok: true, path: 'upload', settled: 'legacy', guest: { ok: true, dropped: 0, legacy: 'busy' } };
  const { load } = fakeLoader(async given => {
    if (given.settle) return busy;
    resetting = true;
    await refusing;
    return { ok: false, path: 'upload', step: 'clear', code: 'REVISION_CONFLICT', known: true };
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: flushed });
  const done = next.clearPractice();
  await until(() => resetting);
  // 다른 탭이 같은 판을 비우고(1 → 2) 몫을 마쳤고, 4b가 남았다 — 서버도 판 2와 그 마지막 비우기를 준다(입구 다시 검수 GPT GA6).
  const theirs = { account: A_ID, path: 'upload', revision: 2, at: Date.now() + 1, left: 'legacy' };
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify(theirs));
  storage.setItem(CLEARED_MARK + A_ID, JSON.stringify({ account: A_ID, settled: 2, asked: 2 }));
  line.revision = 2;
  line.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 1 } });
  refuse();
  assert.equal((await done).code, 'PLAN_CHANGED', '서버가 받지 않았고 다른 탭이 비웠다 — 판이 바뀌었다고 알린다');
  assert.deepEqual(markOf(storage), theirs, '다른 탭의 표지를 지우지 않았다');
  next.dispose();
});

test('판 견줌으로 맞추는 사이 다른 탭이 같은 비우기의 남은 걸음 표지를 적었으면 덮지 않고, 비운 판보다 앞선 판의 코치를 열지 않는다(4-5 끝 판 GPT GC2 · GC3)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  let answer;
  const answering = new Promise(resolve => {
    answer = resolve;
  });
  let asked = false;
  line.lastClear = async () => {
    asked = true;
    await answering;
    return { ok: true, revision: 2, lastClear: { revision: 2, at: 5 } };
  };
  // 손님 저장소의 걸음은 끝나지 않는다 — 그동안 표지를 지켜본다.
  const never = new Promise(() => {});
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(given => (given.settle ? never : settled)).load, health: recorder() });
  const opening = next.practiceCoach(POOL);
  await until(() => asked);
  // 그사이 늦게 끝난 요청이 서버를 비웠고(판 2), 다른 탭이 그 비우기를 따라 하며 넷째 걸음을 마치고 4b만 남겼다.
  line.revision = 2;
  const theirs = { account: A_ID, path: 'upload', revision: 2, at: Date.now(), left: 'legacy' };
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify(theirs));
  answer();
  assert.equal((await opening)?.options.host.revision, 2, '비운 판(1)의 코치를 열지 않았다');
  assert.deepEqual(markOf(storage), theirs, '같은 판의 표지는 먼저 적은 것을 둔다 — 다른 탭의 표지를 덮지 않았다');
  next.dispose();
});

test('판을 정한 뒤에 끝난 비우기를 맞추면 그 판의 코치를 열지 않고 다시 정한다 — 「새 길 간 적 있음」도 새 판이다(4-5 끝 판 GPT GC3)', async () => {
  const storage = filledStorage();
  storage.setItem(NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 }));
  const line = accountLine();
  // 판 1을 정한 직후 늦게 끝난 요청이 서버를 비웠다 — 마지막 비우기 읽기는 판 2를 준다.
  line.lastClear = async () => {
    line.revision = 2;
    return { ok: true, revision: 2, lastClear: { revision: 2, at: 5 } };
  };
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.equal((await next.practiceCoach(POOL))?.options.host.revision, 2, '판 1의 코치가 아니라 다시 정한 판 2의 코치다');
  assert.equal(wentOf(storage).revision, 2);
  next.dispose();
  // 남은 걸음 표지를 못 적어도(저장소가 그 열쇠를 받지 않는다) 마지막 비우기의 판으로 가른다 — 표지로는 알 수 없다.
  const full = filledStorage();
  full.setItem(NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 }));
  const put = full.setItem;
  full.setItem = (key, value) => {
    if (key.startsWith(CLEARING_MARK)) throw Error('QuotaExceededError');
    put(key, value);
  };
  const late = accountLine();
  late.lastClear = async () => {
    late.revision = 2;
    return { ok: true, revision: 2, lastClear: { revision: 2, at: 5 } };
  };
  const blocked = createAtlasNext({ owner: A_ID, storage: full, trail: late.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.equal((await blocked.practiceCoach(POOL))?.options.host.revision, 2, '표지를 못 적어도 비운 판(1)의 코치를 열지 않는다');
  assert.equal(markOf(full), null);
  blocked.dispose();
});

test('비우기를 맞추면 새 판의 코치가 서기 전에 「새 길 간 적 있음」을 새 판으로 올린다 — 그사이 문서를 닫아도 다음 오프라인 시작이 비운 판을 열지 않는다(4-5 끝 판 GPT GC3)', async () => {
  const storage = filledStorage();
  storage.setItem(NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 }));
  const line = accountLine({ revision: 2 });
  line.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 5 } });
  // 엔진을 받는 데 오래 걸린다 — 새 판의 코치가 서지 않는다.
  const never = new Promise(() => {});
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: () => never, health: recorder() });
  void next.practiceCoach(POOL);
  await until(() => markOf(storage)?.left === 'cleared');
  assert.equal(wentOf(storage).revision, 2, '코치가 서기 전에 새 판이다');
  next.dispose();
});

test('비운 뒤 「새 길 간 적 있음」은 이 기기의 몫(계정 다시 읽기)을 기다리기 전에 새 판으로 옮긴다 — 그사이 문서를 닫아도 앞 판에 머물지 않는다(4-5 끝 판 GPT GC3)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  const slow = heldTrail(line);
  const { load } = fakeLoader(given => {
    if (given.settle) return settled;
    line.revision = 2;
    slow.hold();
    return CLEARED(2);
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: slow.trail, load, health: recorder(), oldEngine: flushed });
  const done = next.clearPractice();
  await until(() => slow.held());
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(wentOf(storage)?.revision, 2, '기다리기 전에 새 판이다');
  slow.release();
  assert.equal((await done).ok, true);
  next.dispose();
});

test('다른 기기의 비우기를 따라 할 때도 「새 길 간 적 있음」은 이 기기의 몫(계정 다시 읽기)을 기다리기 전에 고른 판으로 옮긴다 — 그사이 문서를 닫아도 비운 판에 머물지 않는다(4-5 끝 판 GPT GC3)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
  const line = accountLine({ revision: 2 });
  const slow = heldTrail(line);
  line.lastClear = async () => {
    slow.hold(); // 이 기기의 몫이 계정을 다시 읽는 자리를 붙든다
    return { ok: true, revision: 2, lastClear: { revision: 2, at: 5 } };
  };
  const next = createAtlasNext({ owner: A_ID, storage, trail: slow.trail, load: fakeLoader(() => settled).load, health: recorder() });
  const opening = next.practiceCoach(POOL);
  await until(() => slow.held());
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(wentOf(storage), { went: true, path: 'upload', revision: 2 }, '기다리기 전에 고른 판(비운 뒤의 판 2)이다');
  slow.release();
  assert.equal((await opening)?.options.host.revision, 2);
  next.dispose();
});

test('앞선 판을 알아 다시 정한 올리는 길은 첫 받기 전에도 「새 길 간 적 있음」을 방금 읽은 판으로 옮긴다 — 새 판 코치가 서기 전에 문서를 닫아도 다음 오프라인 시작이 비운 판을 열지 않는다(4-5 끝 판 GPT GC3 · 입구 다시 검수 -c GPT GA4)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
  const line = accountLine();
  line.lastClear = async () => {
    line.revision = 2; // 판 1을 정한 직후 늦게 끝난 요청이 서버를 비웠다
    return { ok: true, revision: 2, lastClear: { revision: 2, at: 5 } };
  };
  // 엔진을 받는 데 오래 걸린다 — 새 판의 코치가 서지 않아 첫 받기(markWent)도 없다.
  const never = new Promise(() => {});
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: () => never, health: recorder() });
  void next.practiceCoach(POOL);
  await until(() => wentOf(storage)?.revision === 2);
  assert.deepEqual(wentOf(storage), { went: true, path: 'upload', revision: 2 }, '다시 정한 판 2의 올리는 길');
  next.dispose();
});

test('결과를 모르는 비우기 뒤의 마지막 비우기가 누르기 전에 끝났으면(서버 시각) 이 비우기가 아니다 — 이 기기의 몫은 하고 판이 바뀌었다고 알린다. 누른 뒤면 「비웠어요」(4-5 끝 판 GPT GC4)', async () => {
  const lost = { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false };
  const skew = 3_600_000; // 서버 시계가 기기보다 한 시간 앞선다 — 견주기는 serverTime으로 잰 어긋남을 쓴다
  for (const [name, before, expected] of [
    ['누르기 전', true, { ok: false, path: 'upload', step: 'clear', code: 'PLAN_CHANGED', known: true }],
    ['누른 뒤', false, { ok: true, path: 'upload', revision: 2, partial: false }],
  ]) {
    const storage = filledStorage();
    const line = accountLine();
    let pressed = null;
    line.lastClear = async () => {
      const server = Date.now() + skew;
      if (line.revision < 2) return { ok: true, revision: line.revision, serverTime: server, lastClear: null };
      const at = before ? pressed + skew - 60_000 : server;
      return { ok: true, revision: 2, serverTime: server, lastClear: { revision: 2, at } };
    };
    const { load } = fakeLoader(given => {
      if (given.settle) return settled;
      line.revision = 2;
      return lost;
    });
    const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: flushed });
    pressed = Date.now();
    assert.deepEqual(await next.clearPractice(), expected, name);
    assertSettled(storage);
    assert.equal(markOf(storage), null, `${name} — 남은 걸음까지 했다`);
    next.dispose();
  }
});

test('앞 판의 열쇠를 못 지웠으면 「일부만 비움」이고 표지에 쓸기를 남겨 다음 다시 정하기가 다시 쓴다 — 쓸기만 남았으면 손님 코치는 열지 않는다(4-5 끝 판 GPT GC6)', async () => {
  const storage = filledStorage();
  const stuck = zone(A_ID, 1) + LEGACY_KEY;
  let broken = true;
  const remove = storage.removeItem;
  storage.removeItem = key => {
    if (broken && key === stuck) throw Error('QuotaExceededError');
    remove(key);
  };
  const line = accountLine();
  const { opened, load } = fakeLoader(given => {
    if (given.settle) return settled;
    line.revision = 2;
    return CLEARED(2);
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: flushed });
  assert.deepEqual(await next.clearPractice(), { ok: true, path: 'upload', revision: 2, partial: true });
  assert.equal(storage.getItem(stuck), 'engine', '못 지운 열쇠가 남았다');
  assert.equal(storage.getItem(zone(`local:${A_ID}`, 1) + LEGACY_KEY), null, '나머지는 지웠다');
  assert.deepEqual([markOf(storage)?.revision, markOf(storage)?.left], [2, 'sweep']);
  broken = false;
  next.redecide();
  assert.ok(await next.practiceCoach(POOL));
  await until(() => markOf(storage) === null);
  assert.equal(storage.getItem(stuck), null, '다시 정하며 다시 쓸었다');
  assert.ok(
    !opened.some(made => made.resets.some(given => given.settle === 'sweep')),
    '쓸기만 남았으면 손님 코치를 열지 않는다',
  );
  next.dispose();
});

test('새 비우기는 결과를 모르는 앞 비우기의 맞추기를 잃게 하지 않는다 — 서버에 닿지 않고 끝나도, 거절되어도, 결과를 몰라도 그 앞의 남은 걸음 표지는 그대로이고, 서버에서 끝난 앞 비우기는 판 견줌이 따라 한다(4-5 끝 판 Fable F3)', async () => {
  // 첫 비우기는 서버에서 끝나고(판 2) 옛 손님 로그(4b)를 남겼다. 둘째 비우기는 서버에서 끝났지만(판 3) 이 기기는 결과를 모른다.
  const prior = { account: A_ID, path: 'upload', revision: 2, at: Date.now() - 1000, left: 'legacy' };
  // 이 기기의 옛 손님 로그는 다른 창이 쥐고 있다 — 4b는 남는다.
  const busy = { ok: true, path: 'upload', settled: 'legacy', guest: { ok: true, dropped: 0, legacy: 'busy' } };
  // reads: 'never'(셋째 비우기 동안 마지막 비우기를 못 읽음) · 'after'(셋째 비우기가 실패한 뒤에는 읽힌다)
  const run = async (answer, reads) => {
    const storage = filledStorage();
    storage.setItem(CLEARING_MARK + A_ID, JSON.stringify(prior));
    storage.setItem(CLEARED_MARK + A_ID, JSON.stringify({ account: A_ID, settled: 2, asked: 2 }));
    const line = accountLine({ revision: 3 });
    let online = false;
    line.lastClear = async () => {
      if (!online) throw Object.assign(Error('NETWORK'), { code: 'NETWORK', retryable: true });
      return { ok: true, revision: 3, lastClear: { revision: 3, at: 1 } };
    };
    const loader = fakeLoader(given => {
      if (given.settle) return busy;
      if (reads === 'after') online = true;
      return answer;
    });
    const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: loader.load, health: recorder() });
    const done = await next.clearPractice();
    await new Promise(resolve => setTimeout(resolve, 50));
    // 판 2의 엔진 기록 — 둘째 비우기(판 3)를 따라 하면 쓴다.
    const after = { done, mark: markOf(storage), cleared: clearedOf(storage), engine: storage.getItem(zone(A_ID, 2) + LEGACY_KEY) };
    // 망이 돌아왔다 — 다시 정하면 판 견줌이 서버에서 끝난 둘째 비우기를 따라 한다.
    online = true;
    next.redecide();
    assert.equal((await next.practiceCoach(POOL))?.options.host.revision, 3);
    await until(() => clearedOf(storage)?.settled === 3 && markOf(storage)?.revision === 3 && markOf(storage).left === 'legacy');
    after.followed = { left: markOf(storage).left, engine: storage.getItem(zone(A_ID, 2) + LEGACY_KEY) };
    next.dispose();
    return after;
  };
  const untouched = (out, name) => {
    assert.deepEqual(out.mark, prior, `${name} — 앞 비우기의 남은 걸음 표지가 그대로다`);
    assert.deepEqual(out.cleared, { account: A_ID, settled: 2, asked: 2 }, `${name} — 둘째 비우기를 따라 할 자리가 남았다`);
    assert.equal(out.engine, 'new', `${name} — 판 2를 아직 쓸지 않았다`);
  };
  // 셋째 비우기가 올리기에서 멈췄다 — 서버에 닿지 않았다.
  const upload = await run({ ok: false, path: 'upload', step: 'upload', code: 'UNSENT', known: true }, 'never');
  assert.equal(upload.done.code, 'UNSENT');
  untouched(upload, '올리기에서 멈춤');
  // 서버가 받지 않았고(409) 마지막 비우기를 못 읽었다.
  const refused = await run({ ok: false, path: 'upload', step: 'clear', code: 'REVISION_CONFLICT', known: true }, 'never');
  assert.equal(refused.done.code, 'REVISION_CONFLICT');
  untouched(refused, '서버가 받지 않음');
  // 셋째 비우기도 결과를 모른다.
  const unknown = await run({ ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false }, 'never');
  assert.equal(unknown.done.known, false);
  untouched(unknown, '결과를 모름');
  for (const out of [upload, refused, unknown])
    assert.deepEqual(out.followed, { left: 'legacy', engine: null }, '다시 정하며 둘째 비우기를 따라 했다(판 3의 남은 걸음 — 4b만 남음)');
  // 서버가 받지 않았고 마지막 비우기는 읽혔다 — 실패 길의 판 견줌이 곧바로 둘째 비우기를 따라 한다.
  const read = await run({ ok: false, path: 'upload', step: 'clear', code: 'REVISION_CONFLICT', known: true }, 'after');
  assert.equal(read.done.code, 'REVISION_CONFLICT');
  assert.equal(read.mark.revision, 3, '판 3의 남은 걸음 표지가 앞 표지를 품는다');
  assert.deepEqual(read.cleared, { account: A_ID, settled: 3, asked: 3 });
  assert.equal(read.engine, null, '판 3 앞의 판을 쓸었다');
});

// ── Fable 5.2 설계 검토(atlas-redesign-stage4-me-clearing-design-20261119) — 판 견줌으로 바꾼 뒤의 장면 ─────────────────────
test('결과를 모르는 비우기를 맞추기 전에 다시 비워도 앞 비우기의 몫을 잃지 않는다 — 다시 비우기가 닿지 못하면 실패 길의 판 견줌이 앞 비우기를 따라 하고, 닿으면 그 비우기의 몫이 앞 판의 본인 값을 잇는다(Fable 5.2 설계 검토 F1)', async () => {
  const own = revision => ownKeys(A_ID, revision).presentation;
  const log = revision => zone(A_ID, revision) + LEGACY_KEY;
  for (const reaches of [false, true]) {
    const storage = memoryStorage([
      [own(1), '{"support":"step"}'],
      [log(1), 'engine-r1'],
      [NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })],
    ]);
    const line = accountLine();
    let online = false;
    line.lastClear = async () => {
      if (!online) throw Object.assign(Error('NETWORK'), { code: 'NETWORK', retryable: true });
      return { ok: true, revision: line.revision, lastClear: line.last ?? null };
    };
    // 첫 비우기 — 서버는 비웠지만(1 → 2) 답이 끊겼고, 마지막 비우기도 못 읽는다.
    const first = fakeLoader(given => {
      if (given.settle) return settled;
      line.revision = 2;
      line.last = { revision: 2, at: 1 };
      return { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false };
    });
    const doc1 = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: first.load, health: recorder(), oldEngine: flushed });
    assert.equal((await doc1.clearPractice()).known, false);
    doc1.dispose();
    // 새로 연다 — 계정은 읽었고(판 2) 마지막 비우기만 못 읽어, 맞추지 못한 채 판 2의 코치가 선다.
    const second = fakeLoader(given => {
      if (given.settle) return settled;
      if (!reaches) return { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false };
      line.revision = 3;
      line.last = { revision: 3, at: 2 };
      return CLEARED(3);
    });
    const doc2 = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: second.load, health: recorder(), oldEngine: flushed });
    assert.equal((await doc2.practiceCoach(POOL))?.options.host.revision, 2);
    assert.equal(storage.getItem(log(1)), 'engine-r1', '아직 맞추지 못했다');
    // 판 2에서 고른 화면 값 — 다시 비우기가 닿으면 가장 가까운 판(2)의 값을 옮겨야 한다(입구 다시 검수 GPT GA7).
    if (reaches) storage.setItem(own(2), '{"support":"independent"}');
    online = true;
    const again = await doc2.clearPractice();
    if (!reaches) {
      assert.deepEqual(again, { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false });
      assert.equal(storage.getItem(own(2)), '{"support":"step"}', '첫 비우기를 따라 해 본인 값을 판 2로 옮겼다');
      assert.equal(storage.getItem(log(1)), null, '앞 판을 쓸었다');
      assert.deepEqual(clearedOf(storage), { account: A_ID, settled: 2, asked: 2 });
      assert.deepEqual([markOf(storage)?.revision, markOf(storage)?.left], [2, 'cleared'], '손님 저장소의 걸음을 남겼다');
      doc2.redecide();
      assert.ok(await doc2.practiceCoach(POOL));
      await until(() => markOf(storage) === null);
      assert.ok(
        second.opened.some(made => made.resets.some(given => given.settle === 'cleared' && given.revision === 2)),
        '넷째 걸음과 4b를 첫 비우기가 올린 판(2)을 경계로 했다',
      );
    } else {
      assert.deepEqual(again, { ok: true, path: 'upload', revision: 3, partial: false });
      assert.equal(storage.getItem(own(3)), '{"support":"independent"}', '본인 값이 남은 가장 가까운 앞 판(2)에서 판 3으로 옮겼다');
      assert.equal(storage.getItem(log(1)), null, '앞 판을 쓸었다');
      assert.deepEqual(clearedOf(storage), { account: A_ID, settled: 3, asked: 3 });
      assert.equal(markOf(storage), null);
    }
    doc2.dispose();
  }
});

test('서버가 받지 않은 비우기 뒤에는 판을 다시 정한다 — 다른 기기에서 동의를 껐다 켜 판만 올랐으면 다시 누를 때 새 판으로 비운다(Fable 5.2 설계 검토 F2)', async () => {
  const storage = memoryStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
  const line = accountLine();
  const sent = [];
  const { load } = fakeLoader(async (given, made) => {
    if (given.settle) return settled;
    const at = made.options.host.revision;
    sent.push(at);
    if (at !== line.revision) return { ok: false, path: 'upload', step: 'clear', code: 'REVISION_CONFLICT', known: true };
    line.revision = at + 1;
    return CLEARED(at + 1);
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder() });
  assert.equal((await next.practiceCoach(POOL))?.options.host.revision, 1);
  line.revision = 2; // 다른 기기에서 동의를 껐다 켰다 — 판만 올랐고 마지막 비우기는 그대로(없음)
  assert.equal((await next.clearPractice()).code, 'REVISION_CONFLICT');
  assert.deepEqual(await next.clearPractice(), { ok: true, path: 'upload', revision: 3, partial: false });
  assert.deepEqual(sent, [1, 2], '다시 누르면 다시 정한 판 2로 비운다');
  next.dispose();
});

test('표지가 없는 기기도 다른 기기의 비우기를 따라 한다 — 계정 판이 오르면 마지막 비우기를 읽고, 이 기기의 몫과 넷째 걸음 · 4b를 그 비우기가 올린 판을 경계로 한다(Fable 5.2 설계 검토 F3 · 설계 주인 11-19 아침)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
  const line = accountLine({ revision: 2 });
  line.lastClear = async () => ({ ok: true, revision: 2, serverTime: Date.now(), lastClear: { revision: 2, at: Date.now() - 60_000 } });
  const { opened, load } = fakeLoader(() => settled);
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder() });
  assert.equal((await next.practiceCoach(POOL))?.options.host.revision, 2);
  await until(() => markOf(storage) === null && opened.some(made => made.resets.length));
  assertSettled(storage);
  assert.deepEqual(wentOf(storage), { went: true, path: 'upload', revision: 2 });
  assert.deepEqual(clearedOf(storage), { account: A_ID, settled: 2, asked: 2 });
  assert.deepEqual(
    opened.flatMap(made => made.resets.map(given => [made.options.host.revision, given.settle ?? null, given.revision ?? null])),
    [[2, 'cleared', 2]],
    '넷째 걸음과 4b — 그 비우기가 올린 판을 경계로',
  );
  // 다시 정해도 같은 비우기를 다시 하지 않는다.
  next.redecide();
  assert.ok(await next.practiceCoach(POOL));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(opened.flatMap(made => made.resets).length, 1, '몫을 마친 비우기는 다시 하지 않는다');
  next.dispose();
});

// ── 입구 다시 검수(atlas-redesign-stage4-me-clearing-20261119 — GPT)의 장면 ─────────────────────────────────────
test('늦게 끝난 앞 비우기는 그사이 새 판에서 적은 30일째 답을 지우지 않는다 — 그 비우기보다 앞선 판의 답만 지운다(입구 다시 검수 GPT GA1 · GB6)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  const slow = heldTrail(line);
  const a = fakeLoader(given => {
    if (given.settle) return settled;
    line.revision = 2;
    slow.hold();
    return CLEARED(2);
  });
  const tabA = createAtlasNext({ owner: A_ID, storage, trail: slow.trail, load: a.load, health: recorder(), oldEngine: flushed });
  const doneA = tabA.clearPractice();
  await until(() => slow.held());
  const b = fakeLoader(given => {
    if (given.settle) return settled;
    line.revision = 3;
    return CLEARED(3);
  });
  const tabB = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: b.load, health: recorder(), oldEngine: flushed });
  assert.equal((await tabB.clearPractice()).ok, true);
  assert.equal(storage.getItem(`synk:world:month-answer:${A_ID}`), null, '판 3의 비우기는 앞 판의 답을 지웠다');
  const answer = JSON.stringify({ v: 1, revision: 3, day: 30 });
  storage.setItem(`synk:world:month-answer:${A_ID}`, answer); // 판 3에서 적은 답
  slow.release();
  assert.equal((await doneA).ok, true);
  assert.equal(storage.getItem(`synk:world:month-answer:${A_ID}`), answer, '늦게 끝난 판 2의 비우기가 판 3의 답을 지우지 않았다');
  tabA.dispose();
  tabB.dispose();
});

test('이 기기가 따라 한 비우기보다 앞선 판을 늦게 온 계정 읽기가 주면 그 판의 코치를 열지 않고 다시 정한다(입구 다시 검수 GPT GA2 · GB3)', async () => {
  const storage = filledStorage([
    [CLEARED_MARK + A_ID, JSON.stringify({ account: A_ID, settled: 2, asked: 2 })],
    [NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 2 })],
  ]);
  const line = accountLine({ revision: 2 });
  let late = true;
  const trail = async () => {
    const value = await line.trail();
    if (!late) return value;
    late = false;
    return { ...value, learning: { ...value.learning, revision: 1 } }; // 다른 탭이 비우기 전에 떠난 계정 읽기가 늦게 왔다
  };
  const next = createAtlasNext({ owner: A_ID, storage, trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.equal((await next.practiceCoach(POOL))?.options.host.revision, 2, '비운 판(1)의 코치를 열지 않는다');
  next.dispose();
});

test('남은 걸음 표지를 못 적으면 몫을 마친 판을 올리지 않는다 — 다음에 열 때 다시 따라 해 넷째 걸음과 4b를 한다(입구 다시 검수 GPT GB2 · GA4)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
  const put = storage.setItem;
  let full = true;
  storage.setItem = (key, value) => {
    if (full && key.startsWith(CLEARING_MARK)) throw Error('QuotaExceededError');
    put(key, value);
  };
  const line = accountLine({ revision: 2 });
  line.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 5 } });
  const doc1 = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.equal((await doc1.practiceCoach(POOL))?.options.host.revision, 2);
  assert.equal(clearedOf(storage)?.settled ?? 0, 0, '표지를 못 적어 올리지 않았다');
  doc1.dispose();
  full = false;
  const second = fakeLoader(() => settled);
  const doc2 = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: second.load, health: recorder() });
  assert.ok(await doc2.practiceCoach(POOL));
  await until(() => clearedOf(storage)?.settled === 2 && markOf(storage) === null);
  assert.ok(
    second.opened.some(made => made.resets.some(given => given.settle === 'cleared' && given.revision === 2)),
    '다음에 열 때 넷째 걸음과 4b를 했다',
  );
  doc2.dispose();
});

test('판 견줌은 두 구역의 본인 값을 모두 옮긴다 — 고른 길과 다른 길에서 고른 값도 비운 뒤의 판에 남는다(입구 다시 검수 GPT GB4)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
  storage.setItem(ownKeys(`local:${A_ID}`, 2).hangul, '{"v":2}'); // 판 2의 기기 길에서 고른 한글 진도
  const line = accountLine({ revision: 3 });
  line.lastClear = async () => ({ ok: true, revision: 3, lastClear: { revision: 3, at: 5 } });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.ok(await next.practiceCoach(POOL));
  assert.equal(storage.getItem(ownKeys(`local:${A_ID}`, 3).hangul), '{"v":2}', '기기 길 구역의 가장 가까운 앞 판(2)에서 옮겼다');
  assert.equal(storage.getItem(ownKeys(A_ID, 3).hangul), '{"v":1}', '올리는 길 구역도 옮겼다');
  next.dispose();
});

test('본인 값을 못 옮기면 몫을 마친 판을 올리지 않는다 — 따라 한 비우기는 다음에 열 때 다시 옮기고, 누른 비우기는 「일부만 비움」이다(입구 다시 검수 GPT GB5)', async () => {
  const failing = target => {
    const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
    const put = storage.setItem;
    storage.full = true;
    storage.setItem = (key, value) => {
      if (storage.full && key === target) throw Error('QuotaExceededError');
      put(key, value);
    };
    return storage;
  };
  const target = ownKeys(A_ID, 2).hangul;
  const storage = failing(target);
  const line = accountLine({ revision: 2 });
  line.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 5 } });
  const doc1 = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.ok(await doc1.practiceCoach(POOL));
  assert.equal(storage.getItem(target), null);
  assert.equal(clearedOf(storage)?.settled ?? 0, 0, '본인 값을 다 옮기지 못해 올리지 않았다');
  doc1.dispose();
  storage.full = false;
  const doc2 = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.ok(await doc2.practiceCoach(POOL));
  await until(() => clearedOf(storage)?.settled === 2);
  assert.equal(storage.getItem(target), '{"v":1}', '다음에 열 때 다시 옮겼다');
  doc2.dispose();
  const pressedAt = failing(target);
  const l2 = accountLine();
  const pressed = createAtlasNext({
    owner: A_ID,
    storage: pressedAt,
    trail: l2.trail,
    load: fakeLoader(given => {
      if (given.settle) return settled;
      l2.revision = 2;
      return CLEARED(2);
    }).load,
    health: recorder(),
    oldEngine: flushed,
  });
  assert.deepEqual(await pressed.clearPractice(), { ok: true, path: 'upload', revision: 2, partial: true });
  assert.equal(clearedOf(pressedAt)?.settled ?? 0, 0, '누른 비우기도 올리지 않았다');
  pressed.dispose();
});

test('기기 길 판은 판 견줌에 읽은 계정 줄을 넘긴다 — 다시 정한 판에서 마지막 비우기를 물으려고 계정 줄을 또 읽지 않는다(입구 다시 검수 GPT GB7)', async () => {
  const line = accountLine({ enabled: false, revision: 2 });
  let reads = 0;
  const trail = async () => {
    reads += 1;
    const value = await line.trail();
    return reads === 1 ? { ...value, learning: { ...value.learning, revision: 1 } } : value; // 첫 읽기는 앞 판
  };
  const next = createAtlasNext({ owner: A_ID, storage: filledStorage(), trail, load: fakeLoader().load, health: recorder() });
  const coach = await next.practiceCoach(POOL);
  assert.deepEqual([coach?.options.host.guest, coach?.options.host.revision], [true, 2]);
  assert.equal(reads, 3, '판 정하기 · 다시 보기 · 다시 정하기 — 판 견줌은 읽지 않는다');
  next.dispose();
});

test('동의로 판만 오르면 물은 판(asked)만 오르고 몫을 마친 판(settled)은 그대로다 — 다시 열어도 같은 마지막 비우기를 또 묻지 않는다(입구 다시 검수 GPT GA5)', async () => {
  const storage = filledStorage([[CLEARED_MARK + A_ID, JSON.stringify({ account: A_ID, settled: 1, asked: 1 })]]);
  const line = accountLine({ revision: 3 }); // 동의를 껐다 켜 판만 3으로 올랐다
  let asks = 0;
  line.lastClear = async () => {
    asks += 1;
    return { ok: true, revision: 3, lastClear: { revision: 1, at: 3 } };
  };
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader().load, health: recorder() });
  assert.ok(await next.practiceCoach(POOL));
  assert.deepEqual(clearedOf(storage), { account: A_ID, settled: 1, asked: 3 });
  next.redecide();
  assert.ok(await next.practiceCoach(POOL));
  assert.equal(asks, 1, '판이 그대로 — 다시 묻지 않는다');
  next.dispose();
});

test('두 탭이 같은 비우기를 따라 할 때 늦은 탭은 다른 탭이 마친 남은 걸음을 다시 적지 않는다(입구 다시 검수 GPT GB6)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
  const line = accountLine({ revision: 2 });
  line.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 5 } });
  // 탭 A — 판 견줌의 몫에서 쓸기 직전의 계정 다시 읽기가 늦는다(둘째 읽기).
  let reads = 0;
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const slowTrail = async () => {
    reads += 1;
    if (reads === 2) await gate;
    return line.trail();
  };
  const a = fakeLoader(() => settled);
  const tabA = createAtlasNext({ owner: A_ID, storage, trail: slowTrail, load: a.load, health: recorder() });
  const openingA = tabA.practiceCoach(POOL);
  await until(() => reads === 2);
  const tabB = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.ok(await tabB.practiceCoach(POOL));
  await until(() => clearedOf(storage)?.settled === 2 && markOf(storage) === null);
  const answer = JSON.stringify({ v: 1, revision: 2, day: 30 });
  storage.setItem(`synk:world:month-answer:${A_ID}`, answer); // 탭 B가 판 2에서 적은 30일째 답
  release();
  assert.ok(await openingA);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(storage.getItem(`synk:world:month-answer:${A_ID}`), answer, '늦은 탭이 판 2의 답을 지우지 않았다');
  assert.equal(markOf(storage), null, '늦은 탭이 마친 남은 걸음 표지를 다시 적지 않았다');
  assert.deepEqual(
    a.opened.flatMap(made => made.resets.map(given => given.settle ?? null)),
    [],
    '늦은 탭은 손님 저장소의 걸음을 다시 하지 않았다',
  );
  tabA.dispose();
  tabB.dispose();
});

// ── 입구 다시 검수 -b(atlas-redesign-stage4-me-clearing-20261119-b — GPT)의 장면 ─────────────────────────────────────
test('늦게 온 앞 판 계정 읽기는 따라 한 비우기 뒤의 「새 길 간 적 있음」 길을 덮지 않는다 — 다시 읽기가 끊겨도 표지의 기기 길 판 3을 연다(입구 다시 검수 -b GPT GA1)', async () => {
  const storage = filledStorage([
    [CLEARED_MARK + A_ID, JSON.stringify({ account: A_ID, settled: 3, asked: 3 })],
    [NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'device', revision: 3 })],
  ]);
  const line = accountLine({ revision: 1 }); // 다른 탭이 동의를 끄고 판 3을 비우기 전에 떠난 올리는 길 판 1의 읽기
  let reads = 0;
  const trail = async () => {
    reads += 1;
    if (reads === 1) return line.trail();
    throw Object.assign(Error('NETWORK'), { code: 'NETWORK' }); // 다시 정할 때의 계정 읽기는 끊긴다
  };
  const next = createAtlasNext({ owner: A_ID, storage, trail, load: fakeLoader(() => settled).load, health: recorder() });
  await next.practiceCoach(POOL);
  assert.deepEqual(wentOf(storage), { went: true, path: 'device', revision: 3 }, '표지의 길이 기기 길 판 3 그대로다');
  next.dispose();
});

test('마지막 비우기 답을 기다리는 사이 다른 탭이 그 뒤의 비우기를 따라 했으면 기다린 판의 코치를 열지 않고 다시 정한다(입구 다시 검수 -b GPT GA5)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
  const line = accountLine({ revision: 1 });
  let asks = 0;
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  line.lastClear = async () => {
    asks += 1;
    if (asks === 1) {
      await gate; // 탭 A의 물음 — 다른 탭이 비우기 전의 답이 늦게 온다
      return { ok: true, revision: 1, lastClear: null };
    }
    return { ok: true, revision: 2, lastClear: { revision: 2, at: 5 } };
  };
  const tabA = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  const openingA = tabA.practiceCoach(POOL);
  await until(() => asks === 1);
  line.revision = 2; // 다른 탭(B)이 판 2로 비웠다
  const tabB = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.equal((await tabB.practiceCoach(POOL))?.options.host.revision, 2);
  await until(() => clearedOf(storage)?.settled === 2);
  release();
  assert.equal((await openingA)?.options.host.revision, 2, '판 1의 코치를 열지 않고 다시 정한 판 2의 코치를 연다');
  tabA.dispose();
  tabB.dispose();
});

test('이 세대의 판 견줌이 끝난 뒤 다른 탭이 그 뒤의 비우기를 따라 했으면, 다음 열기는 앞 판 코치를 다시 쓰지 않고 다시 정한다(입구 다시 검수 -b GPT GA8)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 })]]);
  const line = accountLine({ revision: 1 });
  const tabA = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.equal((await tabA.practiceCoach(POOL))?.options.host.revision, 1);
  line.revision = 2;
  line.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 5 } });
  const tabB = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  assert.ok(await tabB.practiceCoach(POOL));
  await until(() => clearedOf(storage)?.settled === 2);
  assert.equal((await tabA.practiceCoach(POOL))?.options.host.revision, 2, '다음 열기는 판 2의 코치');
  tabA.dispose();
  tabB.dispose();
});

test('결과를 모르는 비우기를 마지막 비우기로 맞출 때 남은 걸음 표지를 못 적으면 「일부만 비움」이다 — 두 수도 올리지 않는다(입구 다시 검수 -b GPT GA7)', async () => {
  const storage = filledStorage();
  const put = storage.setItem;
  storage.setItem = (key, value) => {
    if (key.startsWith(CLEARING_MARK)) throw Error('QuotaExceededError');
    put(key, value);
  };
  const line = accountLine();
  line.lastClear = async () =>
    line.revision < 2
      ? { ok: true, revision: line.revision, lastClear: null }
      : { ok: true, revision: 2, serverTime: Date.now(), lastClear: { revision: 2, at: Date.now() } };
  const { load } = fakeLoader(given => {
    if (given.settle) return settled;
    line.revision = 2;
    return { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false };
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: flushed });
  assert.deepEqual(await next.clearPractice(), { ok: true, path: 'upload', revision: 2, partial: true });
  assert.equal(clearedOf(storage)?.settled ?? 0, 0, '두 수를 올리지 않았다');
  next.dispose();
});

test('누른 비우기의 몫이 처음에 막혀도 같은 요청 안의 다시 정하기가 마치면 「일부만 비움」이 아니다(입구 다시 검수 -b GPT GA2)', async () => {
  const storage = filledStorage();
  const target = ownKeys(A_ID, 2).hangul;
  const sweepKey = engineKeys(A_ID, 1)[0];
  const put = storage.setItem;
  const drop = storage.removeItem;
  let fullOnce = true;
  let stuckOnce = true;
  storage.setItem = (key, value) => {
    if (fullOnce && key === target) {
      fullOnce = false;
      throw Error('QuotaExceededError'); // 처음 옮길 때만 자리가 없다
    }
    put(key, value);
  };
  storage.removeItem = key => {
    if (stuckOnce && key === sweepKey) {
      stuckOnce = false;
      throw Error('busy'); // 처음 쓸 때만 막힌다 — 쓸기를 남겨 같은 요청 안에서 다시 정한다
    }
    drop(key);
  };
  const line = accountLine();
  line.lastClear = async () => ({ ok: true, revision: line.revision, lastClear: line.revision >= 2 ? { revision: 2, at: 5 } : null });
  const { load } = fakeLoader(given => {
    if (given.settle) return settled;
    line.revision = 2;
    return CLEARED(2);
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: flushed });
  assert.deepEqual(await next.clearPractice(), { ok: true, path: 'upload', revision: 2, partial: false });
  assert.equal(storage.getItem(target), '{"v":1}', '같은 요청 안의 다시 정하기가 옮겼다');
  assert.equal(clearedOf(storage)?.settled, 2);
  assert.equal(markOf(storage), null);
  next.dispose();
});

// ── 입구 다시 검수 -c(atlas-redesign-stage4-me-clearing-20261119-c — GPT)의 장면 ─────────────────────────────────────
test('늦게 온 앞 판 계정 읽기는 다른 탭이 기기 길로 비우고 남긴 걸음 표지가 있어도 「새 길 간 적 있음」의 길을 덮지 않는다 — 다시 읽기가 끊겨도 기기 길 판 3을 연다(입구 다시 검수 -c GPT GA4)', async () => {
  const storage = filledStorage([
    [CLEARED_MARK + A_ID, JSON.stringify({ account: A_ID, settled: 3, asked: 3 })],
    [NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'device', revision: 3 })],
    [CLEARING_MARK + A_ID, JSON.stringify({ account: A_ID, path: 'device', revision: 3, at: 5, left: 'cleared' })],
  ]);
  const line = accountLine({ revision: 1 }); // 다른 탭이 동의를 끄고 판 3을 비우기 전에 떠난 올리는 길 판 1의 읽기
  let reads = 0;
  const trail = async () => {
    reads += 1;
    if (reads === 1) return line.trail();
    throw Object.assign(Error('NETWORK'), { code: 'NETWORK' }); // 다시 정할 때의 계정 읽기는 끊긴다
  };
  const next = createAtlasNext({ owner: A_ID, storage, trail, load: fakeLoader(() => settled).load, health: recorder() });
  const coach = await next.practiceCoach(POOL);
  assert.deepEqual(wentOf(storage), { went: true, path: 'device', revision: 3 }, '표지의 길이 기기 길 판 3 그대로다');
  assert.equal(coach?.options.host.revision, 3);
  assert.equal(coach?.options.host.guest, true, '기기 길 판 3을 연다');
  next.dispose();
});

test('판 견줌은 앞선 판의 길로 「새 길 간 적 있음」을 비운 뒤의 판에 적지 않는다 — 늦게 온 판 1의 올리는 길이 기기 길 판 3의 표지를 덮지 않는다(입구 다시 검수 -c GPT GA4)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'device', revision: 3 })]]);
  const line = accountLine({ revision: 1 });
  line.lastClear = async () => ({ ok: true, revision: 3, lastClear: { revision: 3, at: 5 } });
  let reads = 0;
  const trail = async () => {
    reads += 1;
    if (reads === 1) return line.trail();
    throw Object.assign(Error('NETWORK'), { code: 'NETWORK' });
  };
  const next = createAtlasNext({ owner: A_ID, storage, trail, load: fakeLoader(() => settled).load, health: recorder() });
  const coach = await next.practiceCoach(POOL);
  assert.deepEqual(wentOf(storage), { went: true, path: 'device', revision: 3 }, '표지의 길이 기기 길 판 3 그대로다');
  assert.equal(coach?.options.host.guest, true, '기기 길 판 3을 연다');
  next.dispose();
});

test('비우며 「새 길 간 적 있음」을 처음에 못 적어도(저장소가 참) 앞 판을 쓸어 자리가 나면 다시 적는다 — 오프라인으로 다시 열면 비운 뒤의 기기 길 판을 연다(입구 다시 검수 -c GPT GA2)', async () => {
  const storage = filledStorage();
  const put = storage.setItem;
  const drop = storage.removeItem;
  let full = false;
  storage.setItem = (key, value) => {
    if (full && key === NEXT_MARK + A_ID) throw Error('QuotaExceededError');
    put(key, value);
  };
  storage.removeItem = key => {
    drop(key);
    if (key.includes('.r1.')) full = false; // 앞 판을 쓸면 자리가 난다
  };
  const line = accountLine({ enabled: false });
  const { load } = fakeLoader(async given => {
    const answer = await given.clear();
    return { ok: true, path: 'device', revision: answer.revision, guest: { ok: true, dropped: 0, legacy: 'none' } };
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: oldEngine(storage) });
  assert.ok(await next.practiceCoach(POOL));
  full = true;
  assert.deepEqual(await next.clearPractice(), { ok: true, path: 'device', revision: 2, partial: false });
  assert.deepEqual(wentOf(storage), { went: true, path: 'device', revision: 2 }, '쓸기 뒤에 다시 적었다');
  next.dispose();
  const reopened = createAtlasNext({ owner: A_ID, storage, trail: offlineTrail, load, health: recorder() });
  const coach = await reopened.practiceCoach(POOL);
  assert.equal(coach?.options.host.revision, 2, '오프라인으로 다시 열면 비운 뒤의 판 2를 연다');
  reopened.dispose();
});

test('다른 기기의 비우기를 따라 할 때 「새 길 간 적 있음」을 처음에 못 적어도(저장소가 참) 앞 판을 쓸어 자리가 나면 다시 적는다 — 오프라인으로 다시 열면 비운 뒤의 기기 길 판을 연다(입구 다시 검수 -c GPT GA2)', async () => {
  const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'device', revision: 1 })]]);
  const put = storage.setItem;
  const drop = storage.removeItem;
  let full = true; // 처음부터 참 — 판 정하기의 표지 쓰기도 실패한다
  storage.setItem = (key, value) => {
    if (full && key === NEXT_MARK + A_ID) throw Error('QuotaExceededError');
    put(key, value);
  };
  storage.removeItem = key => {
    drop(key);
    if (key.includes('.r1.')) full = false; // 앞 판을 쓸면 자리가 난다
  };
  const line = accountLine({ enabled: false, revision: 2 }); // 다른 기기가 판 1을 비워 판 2다
  line.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 5 } });
  const { load } = fakeLoader(() => settled);
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder() });
  assert.equal((await next.practiceCoach(POOL))?.options.host.revision, 2);
  assert.deepEqual(wentOf(storage), { went: true, path: 'device', revision: 2 }, '쓸기 뒤에 다시 적었다');
  next.dispose();
  const reopened = createAtlasNext({ owner: A_ID, storage, trail: offlineTrail, load, health: recorder() });
  assert.equal((await reopened.practiceCoach(POOL))?.options.host.revision, 2, '오프라인으로 다시 열면 비운 뒤의 판 2를 연다');
  reopened.dispose();
});

test('「새 길 간 적 있음」이 비운 판에 남았으면 오프라인 시작은 그 판을 열지 않고 곧바로 지금 판이다 — 세 번 다시 정하다 PATH_CHANGING으로 끝나지 않는다(입구 다시 검수 -c GPT GA2)', async () => {
  for (const extra of [
    [[CLEARED_MARK + A_ID, JSON.stringify({ account: A_ID, settled: 2, asked: 2 })]],
    [[CLEARING_MARK + A_ID, JSON.stringify({ account: A_ID, path: 'device', revision: 2, at: 5, left: 'cleared' })]],
  ]) {
    const storage = filledStorage([[NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'device', revision: 1 })], ...extra]);
    const health = recorder();
    const { opened, load } = fakeLoader(() => settled);
    const next = createAtlasNext({ owner: A_ID, storage, trail: offlineTrail, load, health });
    assert.equal(await next.practiceCoach(POOL), null, '비운 판 1을 열지 않는다');
    assert.deepEqual(opened, [], '코치를 열지 않았다');
    const codes = health.notes.map(([, outcome]) => outcome?.code);
    assert.ok(codes.includes('PATH_NETWORK'), '계정을 못 읽은 일시 실패로 지금 판');
    assert.ok(!codes.includes('PATH_CHANGING'), '판을 거듭 다시 정하지 않는다');
    next.dispose();
  }
});
