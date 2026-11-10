// IndexedDB 저장 포트(port.mjs의 꼴). 자동 열쇠 저장소 하나 — 덧붙이기 한 번이 트랜잭션 하나라 탭 사이에서 원자적이다.
// 다른 탭 · 게임 틀이 덧붙이면 BroadcastChannel로 알린다(받는 쪽은 range로 꼬리만 읽는다 — 설계 §5-4 「탭과 틀」).
const STORE = 'log';

const done = request =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const finished = transaction =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Atlas record: 저장이 취소됐다'));
    // 요청 하나의 오류가 트랜잭션으로 올라오는 동안에는 transaction.error가 아직 비어 있다 — 요청의 오류를 쓴다(아르곤 끝 판 C4).
    transaction.onerror = event =>
      reject(
        transaction.error ?? event?.target?.error ?? new Error('Atlas record: 저장에 실패했다'),
      );
  });

export async function idbPort(name, { indexedDB = globalThis.indexedDB, channel = null } = {}) {
  if (!indexedDB)
    throw Object.assign(new Error('Atlas record: IndexedDB가 없다'), {
      code: 'STORAGE_UNAVAILABLE',
    });
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => {
    if (!open.result.objectStoreNames.contains(STORE))
      open.result.createObjectStore(STORE, { autoIncrement: true });
  };
  const db = await done(open);
  const each = async (range = null) => {
    const transaction = db.transaction(STORE, 'readonly');
    const store = transaction.objectStore(STORE);
    const [keys, values] = await Promise.all([
      done(store.getAllKeys(range)),
      done(store.getAll(range)),
    ]);
    return keys.map((key, i) => ({ key, value: values[i] }));
  };
  return {
    read: () => each(),
    range: afterKey => each(globalThis.IDBKeyRange.lowerBound(afterKey, true)),
    async append(values) {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const requests = values.map(value => done(store.add(value)));
      const [keys] = await Promise.all([Promise.all(requests), finished(transaction)]);
      channel?.postMessage({ appended: keys.at(-1) });
      return keys;
    },
    async remove(keys) {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      for (const key of keys) store.delete(key);
      await finished(transaction);
    },
    async close() {
      db.close();
    },
  };
}
