import test from 'node:test';
import assert from 'node:assert/strict';
import { STORE_KEY, emptyAlbum, addCard, nameCard, recordRound, finishDaily, normalizeAlbum, dayKey } from './core.mjs';
import { mergeAlbums, openAlbumStore, findPlayHost } from './album.mjs';
import { WORDS } from './words.mjs';
import { createWorldPlayHost } from '../play-common/account-host.mjs';
import { PLAY_RECORD_KEYS, validatePlayValue, emptyPlayState } from '../play-common/play-data.mjs';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const Q = [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]];
const shot = (word, extra = {}) => ({ word, kind: 'plate', q: Q, style: 'blade', vertical: false, ...extra });
function albumWith(...entries) {
  const a = emptyAlbum();
  for (const [word, named, at] of entries) { addCard(a, shot(word), 'gate', at); if (named) nameCard(a, word, at + 1); }
  return normalizeAlbum(a);
}
const sameShape = (x, y) => assert.deepEqual(JSON.parse(JSON.stringify(x)), JSON.parse(JSON.stringify(y)));

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); }, removeItem: (k) => { map.delete(k); }, dump: () => Object.fromEntries(map) };
}
/** synk-play의 계약만 흉내 낸 가짜 서버: 키마다 앞 값이 다르면 409, 끝낸 명령의 응답을 돌려준다. */
function fakeServer({ refuse = null, down = false } = {}) {
  const state = emptyPlayState(); let revision = 0;
  const reply = () => ({ ok: true, scope: 'synk-play', accountId: ACCOUNT, revision, state: JSON.parse(JSON.stringify(state)) });
  const client = {
    async load() { if (server.down) throw Object.assign(Error('offline'), { code: 'NETWORK' }); return reply(); },
    async mutate(body) {
      server.posts.push(body);
      if (server.down) throw Object.assign(Error('offline'), { code: 'NETWORK' });
      if (server.refuse) throw Object.assign(Error(server.refuse), { code: server.refuse, status: 400 });
      for (const c of body.changes) if ((state.records[c.key] ?? null) !== c.previous) throw Object.assign(Error('conflict'), { code: 'REVISION_CONFLICT', status: 409 });
      for (const c of body.changes) { if (c.value === null) delete state.records[c.key]; else state.records[c.key] = c.value; }
      revision += 1;
      return reply();
    },
  };
  const server = { client, state, posts: [], refuse, down, get revision() { return revision; }, set(key, value) { state.records[key] = value; revision += 1; } };
  return server;
}
function device({ server, storage = memoryStorage(), hostOverride = null }) {
  const listeners = new Map();
  const host = hostOverride || createWorldPlayHost({ accountId: ACCOUNT, client: server.client, guard() {}, storage, locks: null, uuid: () => crypto.randomUUID() });
  const win = { SYNKPlayHost: host, localStorage: storage, addEventListener: (n, fn) => listeners.set(n, fn), document: { addEventListener() {}, visibilityState: 'visible' } };
  win.parent = win;
  return { host, win, storage, leave: (event) => listeners.get('pagehide')?.(event) };
}
const open = (d, opts = {}) => openAlbumStore({ win: d.win, storage: d.storage, accountKey: ACCOUNT, gapMs: 5, ...opts });
const settle = async (d) => { await new Promise((r) => setTimeout(r, 30)); await d.host.flush?.().catch(() => {}); };

test('서버와 같은 키가 놀이 기록 목록에 있고, 낱말을 다 모은 앨범도 놀이 기록 한도 안이다', () => {
  assert.ok(PLAY_RECORD_KEYS.includes(STORE_KEY));
  const a = emptyAlbum();
  const scene = Array.from({ length: 7 }, (_, i) => ({ q: Q, text: `판 글자 ${i}`, style: 'blade' }));
  for (const id of Object.keys(WORDS)) { addCard(a, shot(id), 'gate', 1793000000000); a.cards[id].scene = scene; nameCard(a, id, 1793000000001); }
  for (let i = 0; i < 400; i += 1) a.daily[new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10)] = 1;
  const value = JSON.stringify(a);
  assert.equal(validatePlayValue(STORE_KEY, value), value);
  assert.ok(new TextEncoder().encode(value).length < 512 * 1024, `앨범 ${value.length}자`);
});

test('합치면 이름을 잃지 않고, 어느 쪽에서 몇 번 합쳐도 답이 같다', () => {
  const phone = albumWith(['library', true, 100], ['cat', false, 50]);
  const laptop = albumWith(['library', false, 20], ['cat', true, 300], ['bank', false, 10]);
  const one = mergeAlbums(phone, laptop), two = mergeAlbums(laptop, phone);
  assert.deepEqual(Object.keys(one.cards).sort(), ['bank', 'cat', 'library']);
  for (const id of ['library', 'cat']) assert.equal(one.cards[id].named, true, id);
  assert.equal(one.cards.library.at, 20, '사진은 먼저 찍은 쪽');
  assert.equal(one.cards.library.namedAt, 101);
  assert.equal(one.cards.bank.named, false);
  sameShape(one.cards, two.cards);
  sameShape(mergeAlbums(one, one), one);
  sameShape(mergeAlbums(one, phone), one);
});

test('판 수는 부풀지 않고, 내 기록은 가장 좋은 값, 이어 한 날은 달력에서 다시 센다', () => {
  const a = emptyAlbum(), b = emptyAlbum();
  recordRound(a, 'gate', { ms: 60000, first: 2, of: 4 }); recordRound(a, 'gate', { ms: 70000, first: 3, of: 4 });
  recordRound(b, 'gate', { ms: 50000, first: 1, of: 4 });
  const day = Date.UTC(2026, 10, 4, 3);
  finishDaily(a, day - 86400000); finishDaily(b, day);
  assert.equal(b.streak, 1);
  const m = mergeAlbums(a, b);
  assert.equal(m.plays, 2); assert.equal(m.placePlays.gate, 2);
  assert.deepEqual(m.best.gate, { ms: 50000, first: 3, of: 4 });
  assert.equal(m.streak, 2, '두 기기의 하루씩이 이어진 이틀이다');
  assert.equal(mergeAlbums(m, a).streak, 2);
  assert.ok(m.daily[dayKey(day)] && m.daily[dayKey(day - 86400000)]);
});

test('안내문 켜기는 나중에 바꾼 쪽을 따르고, 모르면 계정 값을 따른다', () => {
  const off = { ...emptyAlbum(), notices: false, noticesAt: 200 }, on = { ...emptyAlbum(), notices: true, noticesAt: 100 };
  assert.equal(mergeAlbums(on, off).notices, false);
  assert.equal(mergeAlbums(off, on).notices, false);
  assert.equal(mergeAlbums({ ...emptyAlbum(), notices: true }, { ...emptyAlbum(), notices: false }).notices, true);
  assert.equal('noticesAt' in mergeAlbums(emptyAlbum(), emptyAlbum()), false);
});

test('저장을 지운 새 기기에서 같은 계정으로 앨범과 이름이 그대로 보인다', async () => {
  const server = fakeServer();
  const a = device({ server });
  const store = await open(a);
  assert.equal(store.existed, false);
  addCard(store.album, shot('library'), 'gate', 100); nameCard(store.album, 'library', 101);
  addCard(store.album, shot('cat'), 'gate', 200);
  recordRound(store.album, 'gate', { ms: 61000, first: 3, of: 4 });
  store.saveNow();
  await settle(a);
  assert.ok(server.state.records[STORE_KEY], '계정에 올라갔다');

  const b = device({ server });
  const fresh = await open(b);
  assert.equal(fresh.existed, true);
  assert.equal(fresh.album.cards.library.named, true);
  assert.equal(fresh.album.cards.cat.named, false);
  assert.equal(fresh.album.placePlays.gate, 1, '두 번째 장소가 다시 잠기지 않는다');
  assert.ok(b.storage.getItem(`${STORE_KEY}:${ACCOUNT}`), '기기 사본도 생긴다');
  const postsBefore = server.posts.length;
  await settle(b);
  assert.equal(server.posts.length, postsBefore, '받기만 한 기기는 다시 쓰지 않는다');
});

test('이미 기기에 쌓인 앨범은 지우지 않고 계정으로 옮긴다 — 이 계정 사본만, 손님 사본은 빼고', async () => {
  const server = fakeServer();
  const legacy = albumWith(['library', true, 100]), guest = albumWith(['cat', true, 100]);
  const other = albumWith(['bank', true, 100]);
  const storage = memoryStorage({
    [`${STORE_KEY}:${ACCOUNT}`]: JSON.stringify(legacy), [`${STORE_KEY}:local:${ACCOUNT}`]: JSON.stringify(albumWith(['dorm', false, 40])),
    [`${STORE_KEY}:device`]: JSON.stringify(guest), [`${STORE_KEY}:22222222-2222-4222-8222-222222222222`]: JSON.stringify(other),
  });
  const before = storage.getItem(`${STORE_KEY}:device`);
  const d = device({ server, storage });
  const store = await open(d);
  await settle(d);
  assert.deepEqual(Object.keys(store.album.cards).sort(), ['dorm', 'library']);
  const saved = JSON.parse(server.state.records[STORE_KEY]);
  assert.equal(saved.cards.library.named, true);
  assert.equal(saved.cards.dorm.named, false);
  assert.ok(storage.getItem(`${STORE_KEY}:${ACCOUNT}`), '기기 사본은 남는다');
  assert.ok(storage.getItem(`${STORE_KEY}:local:${ACCOUNT}`));
  assert.equal(storage.getItem(`${STORE_KEY}:device`), before);
});

test('두 기기 값이 다르면 이름 붙은 카드를 합쳐 계정과 기기에 같이 둔다', async () => {
  const server = fakeServer();
  server.set(STORE_KEY, JSON.stringify(albumWith(['library', false, 100], ['bank', true, 300])));
  const storage = memoryStorage({ [`${STORE_KEY}:${ACCOUNT}`]: JSON.stringify(albumWith(['library', true, 200], ['cat', true, 250])) });
  const d = device({ server, storage });
  const store = await open(d);
  await settle(d);
  for (const id of ['library', 'bank', 'cat']) assert.equal(store.album.cards[id].named, true, id);
  const saved = JSON.parse(server.state.records[STORE_KEY]);
  for (const id of ['library', 'bank', 'cat']) assert.equal(saved.cards[id].named, true, `계정 ${id}`);
  assert.equal(JSON.parse(storage.getItem(`${STORE_KEY}:${ACCOUNT}`)).cards.bank.named, true);
});

test('옛 호스트(키를 모른다)에서는 기기 사본으로 돌고 앨범이 비지 않는다', async () => {
  const seed = { [`${STORE_KEY}:${ACCOUNT}`]: JSON.stringify(albumWith(['library', true, 100])) };
  const storage = memoryStorage(seed);
  const oldHost = { ready: async () => ({}), status: () => ({ accountId: ACCOUNT, rejected: 0 }), storage: () => ({ getItem() { throw Object.assign(Error('INVALID_PLAY_KEY'), { code: 'INVALID_PLAY_KEY' }); }, setItem() { throw Error('쓰면 안 된다'); } }), subscribe() { throw Error('구독하면 안 된다'); } };
  const d = device({ storage, hostOverride: oldHost });
  const store = await open(d);
  assert.equal(store.status().account, false);
  assert.equal(store.album.cards.library.named, true);
  addCard(store.album, shot('cat'), 'gate', 200); store.save();
  assert.ok(JSON.parse(storage.getItem(`${STORE_KEY}:${ACCOUNT}`)).cards.cat);
});

test('서버가 거절하면 앨범은 그대로이고, 격리 기록을 쌓지 않게 그 판에서 계정 쓰기를 멈춘다', async () => {
  const server = fakeServer({ refuse: 'INVALID_PLAY_STATE' });
  const d = device({ server });
  const store = await open(d);
  addCard(store.album, shot('library'), 'gate', 100); nameCard(store.album, 'library', 101);
  store.saveNow();
  await settle(d);
  assert.equal(store.album.cards.library.named, true);
  assert.equal(d.host.status().rejected, 1);
  addCard(store.album, shot('cat'), 'gate', 200); store.save();
  await settle(d); store.saveNow(); await settle(d);
  assert.equal(d.host.status().rejected, 1, '거절된 뒤에는 더 보내지 않는다');
  assert.equal(store.status().account, false);
  server.refuse = null;
  const reopened = device({ server, storage: d.storage });
  const again = await open(reopened);
  await settle(reopened);
  assert.equal(again.album.cards.library.named, true, '다시 열어도 비지 않는다');
  assert.ok(JSON.parse(server.state.records[STORE_KEY]).cards.cat, '서버가 받게 되면 기기 사본이 올라간다');
});

test('연결이 끊겨도 앨범은 그대로이고, 저장을 기다리던 기록은 다시 연결되면 올라간다', async () => {
  const server = fakeServer();
  const d = device({ server });
  const store = await open(d);
  server.down = true;
  addCard(store.album, shot('library'), 'gate', 100); nameCard(store.album, 'library', 101);
  store.saveNow();
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(store.album.cards.library.named, true);
  assert.equal(server.state.records[STORE_KEY], undefined);
  server.down = false;
  await d.host.retry();
  assert.equal(JSON.parse(server.state.records[STORE_KEY]).cards.library.named, true);
});

test('다른 기기가 쓴 값이 호스트에 들어오면 합쳐 두어, 다음 쓰기가 충돌하지 않는다', async () => {
  const server = fakeServer();
  const phone = device({ server }), laptop = device({ server });
  const onLaptop = await open(laptop);
  addCard(onLaptop.album, shot('library'), 'gate', 100); nameCard(onLaptop.album, 'library', 101); onLaptop.saveNow();
  await settle(laptop);
  const onPhone = await open(phone);
  addCard(onPhone.album, shot('cat'), 'gate', 200); nameCard(onPhone.album, 'cat', 201); onPhone.saveNow();
  await settle(phone);
  await laptop.host.retry(); // 노트북 화면이 다시 보일 때 호스트가 하는 일
  assert.equal(onLaptop.album.cards.cat?.named, true, '폰에서 붙인 이름이 들어온다');
  addCard(onLaptop.album, shot('bank'), 'gate', 300); onLaptop.saveNow();
  await settle(laptop);
  assert.notEqual(laptop.host.status().phase, 'conflict');
  const saved = JSON.parse(server.state.records[STORE_KEY]);
  assert.deepEqual(Object.keys(saved.cards).sort(), ['bank', 'cat', 'library']);
});

test('뒤에 나온 판(v2)이 쓴 계정 기록은 합쳐 덮지 않는다', async () => {
  const server = fakeServer();
  const future = JSON.stringify({ v: 2, cards: { library: {} } });
  server.set(STORE_KEY, future);
  const d = device({ server, storage: memoryStorage({ [`${STORE_KEY}:${ACCOUNT}`]: JSON.stringify(albumWith(['cat', true, 100])) }) });
  const store = await open(d);
  store.saveNow();
  await settle(d);
  assert.equal(server.state.records[STORE_KEY], future);
  assert.equal(store.album.cards.cat.named, true);
});

test('빈 앨범은 계정에 쓰지 않고, 호스트가 멈춰도 앨범은 열린다', async () => {
  const server = fakeServer();
  const d = device({ server });
  await open(d); await settle(d);
  assert.equal(server.posts.length, 0);
  const hanging = { ready: () => new Promise(() => {}), status: () => ({}), storage() { throw Error('닿으면 안 된다'); } };
  const seeded = memoryStorage({ [`${STORE_KEY}:${ACCOUNT}`]: JSON.stringify(albumWith(['cat', true, 100])) });
  const h = device({ storage: seeded, hostOverride: hanging });
  const store = await open(h, { readyMs: 10 });
  assert.equal(store.album.cards.cat.named, true);
  assert.equal(store.status().account, false);
});

test('사이트 데이터가 막혀 localStorage를 읽기만 해도 던지는 브라우저에서도 앨범이 열리고 판이 돈다', async () => {
  const win = { get localStorage() { throw Object.assign(Error('denied'), { name: 'SecurityError' }); } }; win.parent = win;
  const store = await openAlbumStore({ win, accountKey: 'device' });
  assert.equal(store.existed, false);
  addCard(store.album, shot('cat'), 'gate', 1);
  store.save(); store.saveNow();
  assert.ok(store.album.cards.cat);
});

test('호스트 준비가 막혀도 어느 계정인지는 알아, 이 계정의 기기 사본을 읽는다(손님 사본으로 떨어지지 않는다)', async () => {
  const storage = memoryStorage({ [`${STORE_KEY}:${ACCOUNT}`]: JSON.stringify(albumWith(['library', true, 1])), [`${STORE_KEY}:device`]: JSON.stringify(albumWith(['cat', true, 1])) });
  const down = { ready: async () => { throw Object.assign(Error('offline'), { code: 'NETWORK' }); }, status: () => ({ accountId: ACCOUNT, rejected: 0 }), storage() { throw Error('닿으면 안 된다'); } };
  const d = device({ storage, hostOverride: down });
  const store = await openAlbumStore({ win: d.win, storage, accountKey: 'device', gapMs: 5 });
  assert.deepEqual(Object.keys(store.album.cards), ['library']);
  assert.equal(store.status().deviceKey, `${STORE_KEY}:${ACCOUNT}`);
});

test('뒤로 가기 캐시에 들어갈 때는 호스트 구독을 끊지 않아, 돌아온 뒤 다른 기기 값도 합친다', async () => {
  const server = fakeServer();
  const phone = device({ server }), laptop = device({ server });
  const onLaptop = await open(laptop);
  addCard(onLaptop.album, shot('library'), 'gate', 100); onLaptop.saveNow(); await settle(laptop);
  laptop.leave({ persisted: true });
  const onPhone = await open(phone);
  addCard(onPhone.album, shot('cat'), 'gate', 200); nameCard(onPhone.album, 'cat', 201); onPhone.saveNow(); await settle(phone);
  await laptop.host.retry();
  assert.equal(onLaptop.album.cards.cat?.named, true);
});

test('손님 체험 호스트 · 호스트 없음은 계정 저장이 아니다', async () => {
  const win = { SYNKPlayHost: { trial: true }, localStorage: memoryStorage() }; win.parent = win;
  assert.equal(findPlayHost(win), null);
  const alone = { localStorage: memoryStorage() }; alone.parent = alone;
  assert.equal(findPlayHost(alone), null);
  const store = await openAlbumStore({ win: alone, storage: alone.localStorage });
  addCard(store.album, shot('cat'), 'gate', 1); store.save();
  assert.ok(alone.localStorage.getItem(`${STORE_KEY}:device`));
});
