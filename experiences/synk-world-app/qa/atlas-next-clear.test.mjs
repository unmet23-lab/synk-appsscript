// Atlas 재설계 단계 4 · 4-5 — 입구(world-atlas-next.mjs)의 연습 기록 비우기(단계4_계획 §22-4 · 22-1의 4). 손님 · 올리는 계정 · 기기 길 계정,
// 「비우는 중」 표지와 lastClear 맞추기, 본인 값 옮기기, 앞 판 쓸기, 30일째 답 지우기, 손님 호스트의 은퇴 알림을 본다.
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

const { createAtlasNext, rehearsalTrail, LEGACY_KEY, CLEARING_MARK, CLEARING_MS, NEXT_MARK } = await import(
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
// 열쇠를 셀 수 있는 저장소(localStorage 꼴 — 앞 판 쓸기가 열쇠를 센다).
function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    map,
    get length() {
      return map.size;
    },
    key: index => [...map.keys()][index] ?? null,
    getItem: key => (map.has(key) ? map.get(key) : null),
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

test('올리는 계정 한 바퀴 — 옛 대기열을 먼저 올리고 「비우는 중」 표지를 적은 뒤 서버를 비우고, 본인 값을 새 판으로 옮기고 앞 판을 쓸고 새 판으로 다시 연다', { timeout: 60_000 }, async () => {
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
  assert.deepEqual(
    markAtClear && [markAtClear.account, markAtClear.path, markAtClear.revision, Number.isFinite(markAtClear.at), markAtClear.left],
    [A_ID, 'upload', 1, true, undefined],
    '서버 비우기 앞에 「비우는 중」 표지(계정 · 판 · 적은 때)를 적었다',
  );
  assert.equal(markOf(storage), null, '끝나면 표지를 지운다');
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

test('올리기를 못 하면 아무것도 지우지 않는다 — 옛 대기열을 못 올리면 엔진 비우기를 부르지 않고, 새 길 올리기에서 멈추면 표지를 지운다', async () => {
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
  assert.equal(markOf(storage), null, '서버에 닿지 않았으니 표지를 지운다');
  assert.equal(storage.getItem(ownKeys(A_ID, 1).presentation), '{"support":"step"}', '아무것도 쓸지 않았다');
  assert.equal(storage.getItem(engineKeys(A_ID, 1)[0]), 'engine');
  stuck.dispose();
  thrown.dispose();
  newPath.dispose();
});

test('옛 대기열은 코치를 연 뒤 「비우는 중」 표지를 적기 바로 전에 올린다 — 서버 비우기와의 틈을 줄인다(4-5 Opus 대체 설계 검토 F1)', async () => {
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
  assert.deepEqual(seen, [[1, null, 0]], '코치를 연 뒤, 표지를 적고 엔진 비우기를 부르기 전에 한 번 올렸다');
  next.dispose();
});

test('늦게 끝난 비우기는 그사이 다른 탭이 적은 더 새 판의 「새 길 간 적 있음」 표지를 내리지 않는다(4-5 코드 다시 검수 GPT -c GA2)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  let release;
  const held = new Promise(resolve => {
    release = resolve;
  });
  const { load } = fakeLoader(async given => {
    if (given.settle) return settled;
    await held;
    return CLEARED(2);
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: { flush: async () => true } });
  const done = next.clearPractice();
  await until(() => markOf(storage));
  storage.setItem(NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 3 }));
  release();
  assert.equal((await done).ok, true);
  assert.equal(JSON.parse(storage.getItem(NEXT_MARK + A_ID)).revision, 3, '더 새 판을 내리지 않는다');
  next.dispose();
});

test('앞 비우기의 남은 걸음 표지는 새 비우기가 서버에 닿지 않고 끝나면 되돌리고, 결과를 모르면 표지에 실어 두었다가 하루가 지나면 되살린다(4-5 코드 다시 검수 GPT -c GA3)', async () => {
  const prior = { account: A_ID, path: 'upload', revision: 2, at: Date.now() - 1000, left: 'cleared' };
  const stuck = { ok: true, path: 'upload', settled: 'cleared', guest: { ok: false, code: 'STORAGE_FAILED', dropped: 0, legacy: 'kept' } };
  // 첫 확인에서 멈췄다(UNSENT_SKIPPED) — 서버에 닿지 않았으니 앞 표지를 되돌린다.
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
  assert.deepEqual([markOf(s1)?.revision, markOf(s1)?.left], [2, 'cleared'], '앞 비우기의 남은 걸음 표지를 되돌렸다');
  n1.dispose();
  // 결과를 모른다 — 새 표지가 앞 남은 걸음을 싣고, 하루가 지나도 비워지지 않았으면 그것으로 되살린다.
  const s2 = filledStorage();
  s2.setItem(CLEARING_MARK + A_ID, JSON.stringify(prior));
  const l2 = accountLine({ revision: 2 });
  l2.lastClear = async () => {
    throw Object.assign(Error('NETWORK'), { code: 'NETWORK', retryable: true });
  };
  const n2 = createAtlasNext({
    owner: A_ID,
    storage: s2,
    trail: l2.trail,
    load: fakeLoader(given => (given.settle ? stuck : { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false })).load,
    health: recorder(),
  });
  assert.equal((await n2.clearPractice()).known, false);
  assert.deepEqual(markOf(s2)?.then, { revision: 2, left: 'cleared' }, '결과를 모르는 표지가 앞 남은 걸음을 싣는다');
  s2.setItem(CLEARING_MARK + A_ID, JSON.stringify({ ...markOf(s2), at: Date.now() - CLEARING_MS - 1 }));
  l2.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 1 } });
  n2.redecide();
  assert.ok(await n2.practiceCoach(POOL));
  await until(() => markOf(s2)?.left === 'cleared');
  assert.equal(markOf(s2).revision, 2, '하루가 지나 앞 남은 걸음으로 되살렸다');
  n2.dispose();
});

test('지금 보낼 수 없는 옛 사건 — 옛 대기열의 몫을 엔진 reset에 넘겨 새 길의 몫과 한 번에 알리고(UNSENT_SKIPPED) 표지를 지운다. 학생이 그 수를 확인하면 다시 불러 비운다(4-5 Opus 대체 설계 검토 F4)', async () => {
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
  assert.equal(markOf(storage), null, '서버에 닿지 않았으니 표지를 지운다');
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
  // 도는 사이 새 비우기가 표지를 적었다 — 앞 걸음의 결과로 지우지 않는다.
  const fresh = { account: A_ID, path: 'upload', revision: 3, at: Date.now() };
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify(fresh));
  release();
  await until(() => finished);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(markOf(storage), fresh);
  next.dispose();
});

test('로그아웃한 기기의 손님 입구도 비우기가 확인된 계정의 남은 걸음을 뒤에서 마저 한다 — 결과를 모르는 표지는 그 계정이 돌아올 때까지 둔다(4-5 Opus 대체 설계 검토 F7 · 설계 주인 11-18)', { timeout: 20_000 }, async () => {
  const storage = filledStorage();
  const B_ID = '55555555-5555-4555-8555-555555555555';
  // 결과를 모르는 표지(B)를 먼저 둔다 — 뒤에서 차례로 도는 손님 걸음이 A에 닿았으면 B는 이미 지나갔다.
  storage.setItem(CLEARING_MARK + B_ID, JSON.stringify({ account: B_ID, path: 'upload', revision: 1, at: Date.now() }));
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify({ account: A_ID, path: 'upload', revision: 2, at: Date.now(), left: 'cleared' }));
  const seen = [];
  const { load } = fakeLoader(given => {
    seen.push([given.settle ?? null, given.account ?? null, given.revision ?? null]);
    return { ok: true, path: 'device', settled: given.settle, guest: { ok: true, dropped: 1, legacy: 'none' } };
  });
  const guest = createAtlasNext({ owner: 'guest', storage, load, health: recorder() });
  assert.ok(await guest.practiceCoach(POOL));
  await until(() => storage.getItem(CLEARING_MARK + A_ID) === null);
  assert.deepEqual(seen, [['cleared', A_ID, 2]], '확인된 계정의 걸음만 — 어느 계정인지 넘긴다');
  assert.ok(storage.getItem(CLEARING_MARK + B_ID), '결과를 모르는 표지는 둔다');
  guest.dispose();
});

test('결과를 모르는 비우기 — 표지를 남기고 「지금은 비우지 못했어요」, 다음 다시 정하기가 같은 계정의 새 lastClear를 받은 뒤에 남은 걸음을 마저 한다', async () => {
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
  assert.deepEqual([markOf(storage).revision, markOf(storage).left], [1, undefined], '결과를 모르니 표지를 남긴다');
  assert.equal(storage.getItem(engineKeys(A_ID, 1)[0]), 'engine', '아무것도 쓸지 않았다');
  // 아직 새 값을 못 받았다(마지막 비우기를 못 읽음) — 다시 정해도 표지를 그대로 둔다.
  next.redecide();
  assert.ok(await next.practiceCoach(POOL));
  assert.equal(markOf(storage)?.revision, 1);
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

test('서버가 받지 않은 비우기(409) — 비워지지 않은 것을 읽었으면 표지를 지우고, 못 읽었으면 남기고, 다른 기기가 먼저 비웠으면 이 기기의 몫은 하되 「비웠어요」가 아니라 판이 바뀌었다고 알린다(4-5 끝 판 GPT GC4)', async () => {
  const conflict = { ok: false, path: 'upload', step: 'clear', code: 'REVISION_CONFLICT', known: true };
  // 비워지지 않았다(마지막 비우기 없음) — 표지를 지운다.
  const s1 = filledStorage();
  const l1 = accountLine();
  const n1 = createAtlasNext({ owner: A_ID, storage: s1, trail: l1.trail, load: fakeLoader(() => conflict).load, health: recorder() });
  assert.deepEqual(await n1.clearPractice(), { ok: false, path: 'upload', step: 'clear', code: 'REVISION_CONFLICT', known: true });
  assert.equal(markOf(s1), null);
  // 마지막 비우기를 못 읽었다 — 다른 기기가 비웠을 수 있어 표지를 남긴다.
  const s2 = filledStorage();
  const l2 = accountLine();
  l2.lastClear = null;
  const n2 = createAtlasNext({ owner: A_ID, storage: s2, trail: l2.trail, load: fakeLoader(() => conflict).load, health: recorder() });
  assert.equal((await n2.clearPractice()).known, true);
  assert.equal(markOf(s2)?.revision, 1, '읽기가 없는 줄 — 표지를 남긴다');
  // 다른 기기가 먼저 비웠다(마지막 비우기의 판이 표지의 판보다 뒤) — 이 기기의 몫(본인 값 · 앞 판 쓸기 · 남은 걸음)은 성공 길과 같이 한다.
  // 이 비우기는 서버가 받지 않았으니 「비웠어요」가 아니다 — 그사이 새 판에 쌓인 기록이 남았을 수 있다. 다시 누르면 새 판을 비운다.
  const s3 = filledStorage();
  const l3 = accountLine();
  l3.lastClear = async () => ({ ok: true, revision: 2, lastClear: { revision: 2, at: 9 } });
  const third = fakeLoader(given => (given.settle ? settled : conflict));
  const n3 = createAtlasNext({ owner: A_ID, storage: s3, trail: l3.trail, load: third.load, health: recorder() });
  const coach = await n3.practiceCoach(POOL);
  const reasons = [];
  n3.retired(coach, detail => reasons.push(detail.reason));
  l3.revision = 2; // 다른 기기가 비워 서버는 이미 새 판이다 — 이 문서는 아직 판 1의 코치를 들고 있다
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

test('결과를 모르는 표지는 하루가 지나도 비워지지 않았으면 지운다 — 하루 안이면 두고, 다른 계정의 표지는 건드리지 않는다', async () => {
  const stale = { account: A_ID, path: 'upload', revision: 1, at: Date.now() - CLEARING_MS - 1000 };
  const other = { account: 'acct-other', path: 'upload', revision: 1, at: 0 };
  const storage = filledStorage([
    [CLEARING_MARK + A_ID, JSON.stringify(stale)],
    [`${CLEARING_MARK}acct-other`, JSON.stringify(other)],
  ]);
  const line = accountLine();
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader().load, health: recorder() });
  assert.ok(await next.practiceCoach(POOL));
  assert.equal(markOf(storage), null, '하루가 지났고 비워지지 않았다');
  assert.equal(JSON.parse(storage.getItem(`${CLEARING_MARK}acct-other`)).account, 'acct-other');
  next.dispose();
  const fresh = filledStorage([[CLEARING_MARK + A_ID, JSON.stringify({ ...stale, at: Date.now() - 1000 })]]);
  const kept = createAtlasNext({ owner: A_ID, storage: fresh, trail: accountLine().trail, load: fakeLoader().load, health: recorder() });
  assert.ok(await kept.practiceCoach(POOL));
  assert.equal(markOf(fresh)?.revision, 1, '하루 안 — 늦게 끝나는 요청이 있을 수 있어 둔다');
  kept.dispose();
  const earlier = filledStorage([[CLEARING_MARK + A_ID, JSON.stringify({ ...stale, at: Date.now() - 1000 })]]);
  const past = accountLine();
  past.lastClear = async () => ({ ok: true, revision: 1, lastClear: { revision: 1, at: 3 } });
  const before = createAtlasNext({ owner: A_ID, storage: earlier, trail: past.trail, load: fakeLoader().load, health: recorder() });
  assert.ok(await before.practiceCoach(POOL));
  assert.equal(markOf(earlier)?.revision, 1, '표지의 판보다 뒤에 비운 것만 비워진 것이다 — 표지 앞의 비우기(판 0 → 1)는 아니다');
  assert.equal(earlier.getItem(engineKeys(A_ID, 1)[0]), 'engine', '쓸지 않았다');
  before.dispose();
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

test('늦게 끝난 앞 비우기는 그사이 다른 탭이 마친 뒤 비우기의 남은 걸음 표지를 지우지 않는다 — 다음 오프라인 시작은 뒤 비우기의 판을 연다(4-5 끝 판 GPT GC2)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  const slow = heldTrail(line);
  // 탭 A — 서버 비우기(1 → 2) 뒤 이 기기의 몫(계정 다시 읽기)이 늦는다.
  const a = fakeLoader(given => {
    if (given.settle) return settled;
    line.revision = 2;
    slow.hold();
    return CLEARED(2);
  });
  const tabA = createAtlasNext({ owner: A_ID, storage, trail: slow.trail, load: a.load, health: recorder(), oldEngine: flushed });
  const doneA = tabA.clearPractice();
  await until(() => slow.held());
  // 탭 B — 판 2를 비우고(2 → 3) 옛 손님 로그를 다른 창이 쥐어 4b가 남았다.
  const busy = { ok: true, path: 'upload', settled: 'legacy', guest: { ok: true, dropped: 0, legacy: 'busy' } };
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
  assert.deepEqual(
    [markOf(storage)?.revision, markOf(storage)?.left],
    [3, 'legacy'],
    '앞 비우기가 뒤 비우기의 남은 걸음 표지를 지우지 않았다',
  );
  assert.equal(wentOf(storage).revision, 3);
  tabA.dispose();
  tabB.dispose();
  const reopened = createAtlasNext({ owner: A_ID, storage, trail: offlineTrail, load: fakeLoader().load, health: recorder() });
  assert.equal((await reopened.practiceCoach(POOL))?.options.host.revision, 3, '뒤 비우기의 판으로 연다');
  reopened.dispose();
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

test('늦게 끝난 앞 비우기의 남은 걸음은 그사이 다른 탭이 시작한 비우기의 표지에 실어 두고, 그 비우기가 서버에 닿지 않고 끝나면 되살린다(4-5 끝 판 GPT GC2)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  const slow = heldTrail(line);
  const a = fakeLoader(given => {
    if (given.settle) return settled;
    line.revision = 2;
    slow.hold();
    return CLEARED(2, { ok: true, dropped: 0, legacy: 'busy' }); // 4b가 남았다
  });
  const tabA = createAtlasNext({ owner: A_ID, storage, trail: slow.trail, load: a.load, health: recorder(), oldEngine: flushed });
  const doneA = tabA.clearPractice();
  await until(() => slow.held());
  // 탭 B — 판 2에서 새 비우기를 시작했다(표지 { 2 } — 결과를 아직 모른다). 그 비우기는 올리기에서 멈춘다.
  let stop;
  const stopping = new Promise(resolve => {
    stop = resolve;
  });
  const b = fakeLoader(async given => {
    if (given.settle) return settled;
    await stopping;
    return { ok: false, path: 'upload', step: 'upload', code: 'UNSENT', known: true };
  });
  const tabB = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: b.load, health: recorder(), oldEngine: flushed });
  const doneB = tabB.clearPractice();
  await until(() => markOf(storage)?.revision === 2 && !markOf(storage).left && b.opened.some(made => made.resets.length));
  slow.release();
  assert.equal((await doneA).ok, true);
  assert.deepEqual(markOf(storage).then, { revision: 2, left: 'legacy' }, '앞 비우기의 남은 걸음을 뒤 비우기의 표지에 실었다');
  stop();
  assert.equal((await doneB).code, 'UNSENT');
  assert.deepEqual(
    [markOf(storage)?.revision, markOf(storage)?.left],
    [2, 'legacy'],
    '뒤 비우기가 서버에 닿지 않아 앞 비우기의 남은 걸음을 되살렸다',
  );
  tabA.dispose();
  tabB.dispose();
});

test('서버에 닿지 않은 비우기는 그사이 다른 탭이 적은 표지를 되돌리지 않는다(4-5 끝 판 GPT GC2)', async () => {
  const storage = filledStorage();
  const line = accountLine();
  let refuse;
  const refusing = new Promise(resolve => {
    refuse = resolve;
  });
  let resetting = false;
  const { load } = fakeLoader(async given => {
    if (given.settle) return settled;
    resetting = true;
    await refusing;
    return { ok: false, path: 'upload', step: 'clear', code: 'REVISION_CONFLICT', known: true };
  });
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: flushed });
  const done = next.clearPractice();
  await until(() => resetting);
  const theirs = { account: A_ID, path: 'upload', revision: 1, at: Date.now() + 1 }; // 다른 탭이 같은 판에서 시작한 비우기
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify(theirs));
  refuse();
  assert.equal((await done).code, 'REVISION_CONFLICT');
  assert.deepEqual(markOf(storage), theirs, '다른 탭의 표지를 지우지 않았다');
  next.dispose();
});

test('결과를 모르는 표지를 맞추는 사이 다른 탭이 새 비우기의 표지를 적었으면 그 표지를 덮지 않고, 비운 판보다 앞선 판의 코치를 열지 않는다(4-5 끝 판 GPT GC2 · GC3)', async () => {
  const storage = filledStorage();
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify({ account: A_ID, path: 'upload', revision: 1, at: Date.now() - 1000 }));
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
  const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load: fakeLoader(() => settled).load, health: recorder() });
  const opening = next.practiceCoach(POOL);
  await until(() => asked);
  // 그사이 늦게 끝난 요청이 서버를 비웠고(판 2), 다른 탭이 판 2에서 새 비우기를 시작했다.
  line.revision = 2;
  const theirs = { account: A_ID, path: 'upload', revision: 2, at: Date.now() };
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify(theirs));
  answer();
  assert.equal((await opening)?.options.host.revision, 2, '비운 판(1)의 코치를 열지 않았다');
  assert.deepEqual(markOf(storage), theirs, '다른 탭의 표지를 덮지 않았다');
  next.dispose();
});

test('판을 정한 뒤에 끝난 비우기를 맞추면 그 판의 코치를 열지 않고 다시 정한다 — 「새 길 간 적 있음」도 새 판이다(4-5 끝 판 GPT GC3)', async () => {
  const storage = filledStorage();
  storage.setItem(NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 }));
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify({ account: A_ID, path: 'upload', revision: 1, at: Date.now() - 1000 }));
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
});

test('비우기를 맞추면 새 판의 코치가 서기 전에 「새 길 간 적 있음」을 새 판으로 올린다 — 그사이 문서를 닫아도 다음 오프라인 시작이 비운 판을 열지 않는다(4-5 끝 판 GPT GC3)', async () => {
  const storage = filledStorage();
  storage.setItem(NEXT_MARK + A_ID, JSON.stringify({ went: true, path: 'upload', revision: 1 }));
  storage.setItem(CLEARING_MARK + A_ID, JSON.stringify({ account: A_ID, path: 'upload', revision: 1, at: Date.now() - 1000 }));
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

test('결과를 모르는 비우기 뒤의 마지막 비우기가 이 비우기의 표지를 적기 전에 끝났으면(서버 시각) 이 비우기가 아니다 — 이 기기의 몫은 하고 판이 바뀌었다고 알린다. 표지를 적은 뒤면 「비웠어요」(4-5 끝 판 GPT GC4)', async () => {
  const lost = { ok: false, path: 'upload', step: 'clear', code: 'NETWORK', known: false };
  const skew = 3_600_000; // 서버 시계가 기기보다 한 시간 앞선다 — 견주기는 serverTime으로 잰 어긋남을 쓴다
  for (const [name, before, expected] of [
    ['표지 앞', true, { ok: false, path: 'upload', step: 'clear', code: 'PLAN_CHANGED', known: true }],
    ['표지 뒤', false, { ok: true, path: 'upload', revision: 2, partial: false }],
  ]) {
    const storage = filledStorage();
    const line = accountLine();
    line.lastClear = async () => {
      const server = Date.now() + skew;
      const at = before ? markOf(storage).at + skew - 60_000 : server;
      return { ok: true, revision: 2, serverTime: server, lastClear: { revision: 2, at } };
    };
    const { load } = fakeLoader(given => {
      if (given.settle) return settled;
      line.revision = 2;
      return lost;
    });
    const next = createAtlasNext({ owner: A_ID, storage, trail: line.trail, load, health: recorder(), oldEngine: flushed });
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
