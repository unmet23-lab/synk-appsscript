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

// 쓰기 트랜잭션 하나에 요청들을 낸다. 요청을 만드는 도중 동기 예외(값을 복제할 수 없음 · 잘못된 열쇠)가 나면 이미 낸 요청까지
// 트랜잭션째 되돌리고 그 예외를 던진다 — 그대로 두면 앞의 요청은 저절로 커밋되고 호출자는 실패를 받아 다시 쓰며 겹친다(GPT 끝 판 GB1).
async function atomically(transaction, issue) {
  const settled = finished(transaction);
  const requests = [];
  const track = request => requests.push(done(request));
  try {
    issue(transaction.objectStore(STORE), track);
  } catch (error) {
    for (const request of requests) request.catch(() => {});
    try {
      transaction.abort();
    } catch {
      // 이미 끝난 트랜잭션 — 되돌릴 것이 없다.
    }
    await settled.catch(() => {});
    throw error;
  }
  const [results] = await Promise.all([Promise.all(requests), settled]);
  return results;
}

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
      const keys = await atomically(db.transaction(STORE, 'readwrite'), (store, track) => {
        for (const value of values) track(store.add(value));
      });
      // 알림은 저장과 따로 — 커밋한 뒤 채널이 닫혀 던져도 저장된 열쇠를 돌려준다(실패로 돌리면 다시 써서 겹친다, GPT 끝 판 GB2).
      try {
        channel?.postMessage({ appended: keys.at(-1) });
      } catch {
        // 다른 탭은 다음 읽기에서 꼬리를 본다.
      }
      return keys;
    },
    async remove(keys) {
      await atomically(db.transaction(STORE, 'readwrite'), (store, track) => {
        for (const key of keys) track(store.delete(key));
      });
    },
    async close() {
      db.close();
    },
  };
}
