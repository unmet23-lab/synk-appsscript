// 저장 포트(설계 §5-4 「저장 포트」) — 기기의 기록부가 쓰는 작은 그릇. 브라우저는 IndexedDB(idb.mjs), 시험은 메모리,
// PC 앱 · Talk 앱은 호스트가 준 저장소를 같은 꼴로 꽂는다.
//   read()               [{ key, value }] — 열쇠 순(덧붙인 차례)
//   append(values, { expect }?)
//                        [key…] — 여러 기록을 한 번에(원자적으로: 전부 쓰이거나 하나도 안 쓰인다). 열쇠는 늘 커진다. expect(지우기 세대)를
//                        주면 막이 트랜잭션이다 — 저장소의 세대가 expect가 아니면 아무것도 쓰지 않고 CLEARED(그때의 세대 gen을 싣는다)로
//                        거절한다(단계 4 계획 §22-4 「늦게 쓰는 탭의 막이」 — 다른 탭이 비운 뒤 앞 세대를 읽은 탭이 지워진 제시에 답을 이어
//                        쓰지 않게). 기록부의 덧붙이기는 모두 expect를 준다. 막이를 모르는 포트는 둘째 인자를 버리고 막이 없이 쓴다.
//   range(afterKey)      afterKey보다 뒤의 기록(다른 탭이 덧붙인 꼬리만 읽기)
//   remove(keys)         치우기(오래되고 서버가 접은 기록, 지난 요약)
//   swap({ expect, gen, removeAll, remove, append, plan })
//                        [key…] — 막이 트랜잭션 하나로 지우고(removeAll — 머리 기록 말고 전부 · remove — 그 열쇠들), 세대를 gen으로 바꾸고
//                        (null이면 그대로), append를 덧붙인다(비우기 — 단계 4 계획 §22-4). 이 문이 없는 포트는 안에서 비우지 못한다.
//                        plan(rows)을 주면 막이를 지난 같은 트랜잭션에서 머리 기록 말고 지금 든 기록을 모두 읽어 넘기고, plan이 돌려준
//                        { remove, append }로 지우고 덧붙인다(remove · append 인자 대신). plan이 null을 돌려주면 아무것도 쓰지 않고 세대도 그대로
//                        둔다([]). plan은 동기 함수다 — 고른 뒤 다른 탭이 덧붙인 기록이 고르기에서 빠지지 않게 읽기와 쓰기 사이를 비우지 않는다
//                        (계정 비우기의 넷째 걸음 — 4-5 코드 검수 GPT GB1).
//   close()
// 지우기 세대는 열쇠 0(GEN_KEY)의 머리 기록 { kind: 'gen', gen }에 둔다 — read()는 그것을 맨 앞에 내고, range()는 내지 않는다(다른 탭은 비울 때
// 함께 덧붙이는 비움 표지로 안다). 머리 기록이 없으면 세대는 0이다. 비워도 열쇠 번호는 이어진다(IndexedDB의 열쇠 생성기처럼).
// 기록 하나는 구조 복제가 되는 값이다. 포트는 머리 기록 말고는 값을 해석하지 않는다.

export const GEN_KEY = 0;
export const genOf = value => (Number.isSafeInteger(value?.gen) && value.gen > 0 ? value.gen : 0);
export const clearedError = gen =>
  Object.assign(new Error('Atlas record: 다른 탭이 저장소를 비웠다'), { code: 'CLEARED', gen });

export function memoryPort({ failWith = null } = {}) {
  const rows = [];
  let next = 1;
  let generation = 0;
  let failure = failWith;
  const copy = value => structuredClone(value);
  const head = () =>
    generation > 0 ? [{ key: GEN_KEY, value: { kind: 'gen', gen: generation } }] : [];
  // 쓰기 앞의 확인 — 실패하는 그릇(시험)과 막이(세대가 다르면 CLEARED).
  const check = expect => {
    if (failure) throw failure;
    if (expect !== null && expect !== generation) throw clearedError(generation);
  };
  const drop = keys => {
    const gone = new Set(keys);
    for (let i = rows.length - 1; i >= 0; i -= 1) if (gone.has(rows[i].key)) rows.splice(i, 1);
  };
  // 복제해 둔 값들을 덧붙인다(복제는 바꾸기 전에 한다 — 복제가 던지면 아무것도 바꾸지 않는다).
  const push = values => {
    const keys = values.map(() => next++);
    values.forEach((value, i) => rows.push({ key: keys[i], value }));
    return keys;
  };
  return {
    async read() {
      return [...head(), ...rows.map(row => ({ key: row.key, value: copy(row.value) }))];
    },
    async append(values, { expect = null } = {}) {
      check(expect);
      return push(values.map(copy));
    },
    async swap({
      expect = null,
      gen = null,
      removeAll = false,
      remove = [],
      append = [],
      plan = null,
    } = {}) {
      check(expect);
      const decided = plan
        ? plan(rows.map(row => ({ key: row.key, value: copy(row.value) })))
        : { remove, append };
      if (!decided) return [];
      const values = (decided.append ?? []).map(copy);
      if (removeAll) rows.length = 0;
      else drop(decided.remove ?? []);
      if (gen !== null) generation = gen;
      return push(values);
    },
    async range(afterKey) {
      return rows
        .filter(row => row.key > afterKey)
        .map(row => ({ key: row.key, value: copy(row.value) }));
    },
    async remove(keys) {
      drop(keys);
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
// local: 동의 꺼짐 · 쓰기 문 닫힘(learningSync 거짓) 계정의 기기 길 — 기기가 원천이고 올리지 않는다(단계 4 계획 §18-5-5 E1). 이름을
// 제품이 글자로 짓지 않는다(다음 제품이 다르게 지으면 저장소가 갈린다).
export function storeName({ account = null, revision = null, local = false }) {
  if (account == null) return 'synk-atlas:guest';
  if (!Number.isSafeInteger(revision) || revision < 1)
    throw new TypeError('Atlas record: 계정 저장에는 동의 판 번호가 있어야 한다');
  return local ? `synk-atlas:local:${account}:${revision}` : `synk-atlas:${account}:${revision}`;
}
