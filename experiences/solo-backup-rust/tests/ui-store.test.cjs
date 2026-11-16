'use strict';
// 상태 읽기 층(ui/state-store.js) — 구독 · 폴링 전환, 늦게 온 답 버리기, 두 번 누름 막기, 엔진 오류 글을 옮기지 않기.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'ui', 'state-store.js')).href);
const S = (n) => ({ version: '0.7.0', n });

test('처음에 한 번 읽고 그 뒤로는 알림을 받는다', async () => {
  const { createStore } = await load();
  let listener = null, seen = [];
  const api = { getState: async () => ({ ok: true, value: S(1) }), onState: async (cb) => { listener = cb; return () => { listener = null; }; } };
  const store = createStore(api, { onChange: (x) => seen.push(x.state?.n) });
  await store.start();
  assert.equal(store.state.n, 1);
  listener(S(2));
  assert.equal(store.state.n, 2);
  listener({ nope: true }); // 상태 모양이 아니면 버린다
  assert.equal(store.state.n, 2);
  store.stop();
  assert.equal(listener, null);
  assert.deepEqual(seen, [1, 2]);
});

test('구독이 안 되면 2초마다 다시 읽는다', async () => {
  const { createStore } = await load();
  let timer = null, reads = 0;
  const api = { getState: async () => ({ ok: true, value: S(++reads) }), onState: () => Promise.reject(new Error('x')) };
  const store = createStore(api, { setTimer: (fn, ms) => { timer = { fn, ms }; return 1; }, clearTimer: () => { timer = null; } });
  await store.start();
  assert.equal(timer.ms, 2000);
  await timer.fn();
  assert.equal(store.state.n, 2);
  store.stop();
  assert.equal(timer, null);
});

test('도는 호출이 있으면 두 번째 누름은 엔진에 가지 않는다', async () => {
  const { createStore } = await load();
  let calls = 0, release;
  const api = { getState: async () => ({ ok: true, value: S(1) }), backupNow: () => { calls++; return new Promise((r) => { release = r; }); } };
  const store = createStore(api);
  const first = store.call('backupNow');
  assert.deepEqual(await store.call('backupNow'), { ok: false, code: 'BUSY' });
  release({ ok: true, value: S(5) });
  assert.equal((await first).ok, true);
  assert.equal(calls, 1);
  assert.equal(store.state.n, 5);
  assert.deepEqual(await store.call('없는메서드'), { ok: false, code: 'NO_METHOD' });
});

test('엔진의 오류 글은 버리고 code만 넘긴다', async () => {
  const { createStore, failureText } = await load();
  const api = { getState: async () => ({ ok: true, value: S(1) }), backupNow: async () => ({ ok: false, error: 'B2 저장소 restic 오류', code: 'JOB_BUSY' }) };
  const r = await createStore(api).call('backupNow');
  assert.deepEqual(r, { ok: false, code: 'JOB_BUSY' });
  assert.equal(failureText(r.code), '하던 일이 끝난 뒤 다시 눌러 주세요.');
  assert.doesNotMatch(failureText('UNKNOWN'), /저장소|restic/);
});

test('폴더 고르기를 사람이 닫은 것은 실패가 아니라 CANCELED다', async () => {
  const { createStore } = await load();
  const api = { getState: async () => ({ ok: true, value: S(1) }), restoreLatest: async () => ({ ok: false, error: '복구를 취소했습니다.' }) };
  assert.deepEqual(await createStore(api).call('restoreLatest'), { ok: false, code: 'CANCELED' });
});

test('첫 읽기가 실패하고 구독만 되면, 첫 상태가 올 때까지 다시 읽고 그 뒤로는 알림만 받는다(카본 A13)', async () => {
  const { createStore } = await load();
  let timer = null, reads = 0, listener = null, seen = [];
  const api = {
    getState: async () => (++reads === 1 ? { ok: false } : { ok: true, value: S(reads) }),
    onState: async (cb) => { listener = cb; return () => {}; },
  };
  const store = createStore(api, { onChange: (x) => seen.push(x.failure), setTimer: (fn, ms) => { timer = { fn, ms }; return 1; }, clearTimer: () => { timer = null; } });
  await store.start();
  assert.equal(store.state, null);
  assert.equal(seen.at(-1), 'READ_FAILED'); // 화면은 이 code로 까닭을 쓴다
  assert.equal(timer.ms, 2000);
  await timer.fn();
  assert.equal(store.state.n, 2);
  assert.equal(timer, null);
  listener(S(9));
  assert.equal(store.state.n, 9);
});

test('놓을 자리 · 마지막 폴더 거절은 엔진 부호로 가린다 — 글 읽기를 걷었다(조율 세션 25d66f324)', async () => {
  const { createStore } = await load();
  const coded = { getState: async () => ({ ok: true, value: S(1) }), restoreLatest: async () => ({ ok: false, error: '모든 작업 폴더·백업 저장소·앱 설정과 분리된 위치를 선택해 주세요.', code: 'OUTPUT_UNSAFE' }), removeSource: async () => ({ ok: false, error: '백업할 폴더를 하나 이상 남겨 주세요.', code: 'LAST_FOLDER' }) };
  const cs = createStore(coded);
  assert.deepEqual(await cs.call('restoreLatest', { place: 'default' }), { ok: false, code: 'OUTPUT_UNSAFE' });
  assert.deepEqual(await cs.call('removeSource', 'x'), { ok: false, code: 'LAST_FOLDER' });
  // 부호 없는 같은 글은 더는 갈래로 읽지 않는다
  const api = { getState: async () => ({ ok: true, value: S(1) }), restoreLatest: async () => ({ ok: false, error: '모든 작업 폴더·백업 저장소·앱 설정과 분리된 위치를 선택해 주세요.' }), removeSource: async () => ({ ok: false, error: '백업할 폴더를 하나 이상 남겨 주세요.' }) };
  const store = createStore(api);
  assert.deepEqual(await store.call('restoreLatest'), { ok: false, code: 'FAILED' });
  assert.deepEqual(await store.call('removeSource', 'x'), { ok: false, code: 'FAILED' });
});
