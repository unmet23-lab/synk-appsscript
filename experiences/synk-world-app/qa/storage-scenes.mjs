// 셈 시험이 함께 도는 저장소 기본 장면(설계 주인 11-17 — 단계4_계획 §21-23의 6). 학습일 답(world-month-answer.mjs)과 예상 급수 근거 상자(§21-23의 2)의
// 셈 시험이 이 목록을 돈다. 기기 저장소가 막혀도 묻기 · 받기 · 다시 그리기의 상한이 서고, 이 문서가 든 답으로 그리는지 본다.
//   memoryStorage(): 막히지 않은 저장소(localStorage 꼴 — getItem · setItem · removeItem, 든 값은 map).
//   blockedStorages(): 막힌 저장소 넷(이름 → 저장소) — 없음 · 읽기가 던짐 · 쓰기가 말없이 버림 · 쓰기가 던짐.
//   writesBlockedAfter(seed): 쓰기만 막히고 앞 답이 남은 저장소(용량 초과 — 4-4c 끝 판 GPT GB1). seed(storage)로 앞 답을 적은 뒤 쓰기만 던진다.
//     { storage, unblock() }을 돌려준다 — unblock은 쓰기를 되살린다(다른 탭이 더 새 답을 적는 장면).
export function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    map,
  };
}

export function blockedStorages() {
  return {
    없음: null,
    '읽기가 던짐': {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {},
      removeItem() {},
    },
    '쓰기가 말없이 버림': { getItem: () => null, setItem() {}, removeItem() {} },
    '쓰기가 던짐': {
      getItem: () => null,
      setItem() {
        throw new Error('quota');
      },
      removeItem() {},
    },
  };
}

export function writesBlockedAfter(seed) {
  const storage = memoryStorage();
  seed(storage);
  const write = storage.setItem;
  storage.setItem = () => {
    throw new Error('quota');
  };
  return {
    storage,
    unblock() {
      storage.setItem = write;
    },
  };
}
