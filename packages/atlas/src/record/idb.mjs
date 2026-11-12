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

// 열기가 다른 연결에 막혔을 때(뒤 판 엔진이 저장소 꼴을 올리는데 옛 판 탭이 연결을 쥔 채) 기다리는 한도 — 넘으면 STORAGE_FAILED로
// 거절해 coach.ready가 거절도 없이 멈추지 않게 한다(단계 4 §18-5-5 G3). 시험만 blockedWait로 바꾼다.
export const BLOCKED_WAIT_MS = 3000;

const storageFailed = (message, cause) =>
  Object.assign(new Error(`Atlas record: ${message}`), { code: 'STORAGE_FAILED', cause });

// 열기 — 막히면(onblocked) 한도 뒤 거절하고, 그 뒤 늦게 열린 연결은 바로 닫는다(아무도 들지 않은 연결이 다른 탭의 판 올리기를 막지 않게).
function openDb(indexedDB, name, wait) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name, 1);
    let timer = null;
    let gaveUp = false;
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE))
        open.result.createObjectStore(STORE, { autoIncrement: true });
    };
    open.onblocked = () => {
      if (timer) return;
      timer = setTimeout(() => {
        gaveUp = true;
        reject(storageFailed('다른 연결이 저장소를 놓지 않는다'));
      }, wait);
      timer.unref?.();
    };
    open.onsuccess = () => {
      clearTimeout(timer);
      if (gaveUp) open.result.close();
      else resolve(open.result);
    };
    open.onerror = () => {
      clearTimeout(timer);
      reject(open.error ?? storageFailed('저장소를 열지 못했다'));
    };
  });
}

export async function idbPort(
  name,
  {
    indexedDB = globalThis.indexedDB,
    channel = null,
    blockedWait = BLOCKED_WAIT_MS,
    onClosed = null,
  } = {},
) {
  if (!indexedDB)
    throw Object.assign(new Error('Atlas record: IndexedDB가 없다'), {
      code: 'STORAGE_UNAVAILABLE',
    });
  const db = await openDb(indexedDB, name, blockedWait);
  // 다른 탭(뒤 판 엔진)이 저장소 꼴을 올리려 하거나 판이 오른 저장소를 열어 이 판 저장소를 지우면 이 연결을 닫아 비켜 준다 — 첫 공개 판에
  // 이 손잡이가 없으면 뒤 판에서는 고칠 수 없다(옛 탭은 이미 떠 있다, G3). 닫힌 뒤의 읽기 · 쓰기는 던지고 기록부는 저장 실패로 받는다.
  // 닫은 것은 onClosed로 알린다 — 호스트가 셸에 알려 판을 다시 정하게(Fable 5.2 끝 판 F5 — 저장 안 되는 연습이 알림 없이 이어졌다).
  db.onversionchange = () => {
    db.close();
    try {
      onClosed?.();
    } catch {
      // 알림이 던져도 연결은 닫혔다
    }
  };
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
