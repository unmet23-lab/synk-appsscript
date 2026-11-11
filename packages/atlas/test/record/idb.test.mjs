// 기기 IndexedDB 포트(src/record/idb.mjs)의 원자성 장면(GPT 끝 판 GB1 · GB2). IndexedDB의 트랜잭션 규칙 가운데 이 포트가 기대는
// 것만 흉내 낸 작은 가짜로 돈다 — 요청은 트랜잭션이 끝날 때 한꺼번에 반영되고(자동 커밋), abort하면 낸 요청이 모두 되돌아가며,
// 값을 복제할 수 없거나 열쇠가 잘못되면 add · delete가 그 자리에서(동기로) 던진다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';

const { idbPort } = await subject('record/idb.mjs');

function fakeIndexedDB() {
  const rows = new Map();
  let next = 1;
  const later = fn => setTimeout(fn, 0);
  const request = () => ({ onsuccess: null, onerror: null, result: undefined, error: null });
  function transaction() {
    const ops = [];
    const pending = [];
    const tx = { oncomplete: null, onabort: null, onerror: null, error: null, aborted: false };
    const settle = () =>
      later(() => {
        if (tx.aborted) return;
        for (const op of ops) op();
        for (const { req, result } of pending) {
          req.result = result();
          req.onsuccess?.();
        }
        tx.oncomplete?.();
      });
    let scheduled = false;
    const issue = (op, result) => {
      const req = request();
      ops.push(op);
      pending.push({ req, result });
      if (!scheduled) {
        scheduled = true;
        settle();
      }
      return req;
    };
    tx.abort = () => {
      tx.aborted = true;
      const error = Object.assign(new Error('aborted'), { name: 'AbortError' });
      later(() => {
        for (const { req } of pending) {
          req.error = error;
          req.onerror?.();
        }
        tx.error = error;
        tx.onabort?.();
      });
    };
    tx.objectStore = () => ({
      add(value) {
        if (value?.uncloneable)
          throw Object.assign(new Error('복제할 수 없다'), { name: 'DataCloneError' });
        const key = next++;
        return issue(
          () => rows.set(key, structuredClone(value)),
          () => key,
        );
      },
      delete(key) {
        if (key == null) throw Object.assign(new Error('잘못된 열쇠'), { name: 'DataError' });
        return issue(
          () => rows.delete(key),
          () => undefined,
        );
      },
      getAllKeys: () => {
        const req = request();
        later(() => {
          req.result = [...rows.keys()];
          req.onsuccess?.();
        });
        return req;
      },
      getAll: () => {
        const req = request();
        later(() => {
          req.result = [...rows.values()].map(v => structuredClone(v));
          req.onsuccess?.();
        });
        return req;
      },
    });
    return tx;
  }
  const db = {
    objectStoreNames: { contains: () => true },
    transaction,
    close() {},
  };
  return {
    rows,
    open() {
      const req = request();
      req.result = db;
      later(() => req.onsuccess?.());
      return req;
    },
  };
}

test('덧붙이기 도중 값 하나를 복제할 수 없으면 아무것도 남기지 않고 실패한다 — 앞의 값만 저장되어 다시 쓸 때 겹치지 않게', async () => {
  const fake = fakeIndexedDB();
  const port = await idbPort('t', { indexedDB: fake });
  assert.deepEqual(await port.append([{ n: 1 }]), [1]);
  await assert.rejects(port.append([{ n: 2 }, { uncloneable: true }]), { name: 'DataCloneError' });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(
    (await port.read()).map(row => row.value),
    [{ n: 1 }],
    '실패한 덧붙이기의 앞 값은 되돌아갔다',
  );
});

test('지우기 도중 잘못된 열쇠가 섞이면 하나도 지우지 않고 실패한다', async () => {
  const fake = fakeIndexedDB();
  const port = await idbPort('t', { indexedDB: fake });
  await port.append([{ n: 1 }, { n: 2 }]);
  await assert.rejects(port.remove([1, null]), { name: 'DataError' });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(
    (await port.read()).map(row => row.key),
    [1, 2],
    '앞의 지우기도 되돌아갔다',
  );
  await port.remove([1]);
  assert.deepEqual(
    (await port.read()).map(row => row.key),
    [2],
  );
});

test('저장이 끝난 뒤 다른 탭 알림이 던져도 덧붙이기는 성공이고 열쇠를 돌려준다(닫힌 채널)', async () => {
  const fake = fakeIndexedDB();
  const channel = {
    postMessage() {
      throw Object.assign(new Error('닫힌 채널'), { name: 'InvalidStateError' });
    },
  };
  const port = await idbPort('t', { indexedDB: fake, channel });
  assert.deepEqual(await port.append([{ n: 1 }]), [1]);
  assert.equal((await port.read()).length, 1, '한 번만 저장됐다');
});
