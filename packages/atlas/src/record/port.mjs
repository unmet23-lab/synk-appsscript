// 저장 포트(설계 §5-4 「저장 포트」) — 기기의 기록부가 쓰는 작은 그릇. 브라우저는 IndexedDB(idb.mjs), 시험은 메모리,
// PC 앱 · Talk 앱은 호스트가 준 저장소를 같은 꼴로 꽂는다.
//   read()               [{ key, value }] — 열쇠 순(덧붙인 차례)
//   append(values)       [key…] — 여러 기록을 한 번에(원자적으로: 전부 쓰이거나 하나도 안 쓰인다). 열쇠는 늘 커진다
//   range(afterKey)      afterKey보다 뒤의 기록(다른 탭이 덧붙인 꼬리만 읽기)
//   remove(keys)         치우기(오래되고 서버가 접은 기록, 지난 요약)
//   close()
// 기록 하나는 구조 복제가 되는 값이다. 포트는 값을 해석하지 않는다.

export function memoryPort({ failWith = null } = {}) {
  const rows = [];
  let next = 1;
  let failure = failWith;
  const copy = value => structuredClone(value);
  return {
    async read() {
      return rows.map(row => ({ key: row.key, value: copy(row.value) }));
    },
    async append(values) {
      if (failure) throw failure;
      const keys = values.map(() => next++);
      values.forEach((value, i) => rows.push({ key: keys[i], value: copy(value) }));
      return keys;
    },
    async range(afterKey) {
      return rows
        .filter(row => row.key > afterKey)
        .map(row => ({ key: row.key, value: copy(row.value) }));
    },
    async remove(keys) {
      const gone = new Set(keys);
      for (let i = rows.length - 1; i >= 0; i -= 1) if (gone.has(rows[i].key)) rows.splice(i, 1);
    },
    async close() {},
    // 시험용 — 저장이 실패하는 그릇(쓰기 실패를 흉내 낸다).
    failNext(error) {
      failure = error;
    },
    heal() {
      failure = null;
    },
    size: () => rows.length,
  };
}

// 저장 이름 — 계정과 동의 판마다 따로(지금 규칙 그대로). 손님은 계정 대신 guest.
export function storeName({ account = null, revision = null }) {
  if (account == null) return 'synk-atlas:guest';
  if (!Number.isSafeInteger(revision) || revision < 1)
    throw new TypeError('Atlas record: 계정 저장에는 동의 판 번호가 있어야 한다');
  return `synk-atlas:${account}:${revision}`;
}
