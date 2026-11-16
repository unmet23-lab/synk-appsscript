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
