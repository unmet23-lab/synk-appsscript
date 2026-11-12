// 계정 저장소 이름 읽기와 앞 판 사본 버리기(설계 §5-3 「비우기」 — 단계 4 계획 §18-5-5 E3). 비우기는 서버의 동의 판을 올린다. 판이 바뀐 것을
// 본 기기는 앞 판의 자기 사본을 버린다 — 그 판의 대기열은 서버가 판 번호로 받지 않으니 남겨 둘 까닭이 없고, 남기면 저장 용량만 먹는다.
// 이름은 record/port.mjs의 storeName이 짓는다(여기는 읽기만).
import { storeName } from '../record/port.mjs';

// 저장소 이름 → { account, revision, local }. 손님 저장소 · 모르는 꼴은 null.
export function storeParts(name) {
  const match = /^synk-atlas:(local:)?(.+):(\d+)$/.exec(String(name ?? ''));
  if (!match) return null;
  const revision = Number(match[3]);
  if (!Number.isSafeInteger(revision) || revision < 1) return null;
  return { account: match[2], revision, local: Boolean(match[1]) };
}

// name(지금 연 계정 저장소)보다 앞 판인 같은 계정의 저장소를 지운다 — 올리는 길 · 기기 길 둘 다. 판 이름 목록(indexedDB.databases())이
// 없는 브라우저는 바로 앞 판 둘만 지운다. 다른 탭이 앞 판을 열어 두었으면 그 탭이 onversionchange로 닫은 뒤 브라우저가 마저 지운다 —
// 기다리지 않는다(지우기는 사본 정리이지 맞음의 조건이 아니다). 지운(지우려 한) 이름을 돌려준다.
export async function dropEarlier(name, { indexedDB = globalThis.indexedDB } = {}) {
  const self = storeParts(name);
  if (!indexedDB || !self || self.revision < 2) return [];
  let names = null;
  try {
    if (typeof indexedDB.databases === 'function')
      names = (await indexedDB.databases()).map(db => db?.name).filter(Boolean);
  } catch {
    names = null;
  }
  const earlier = names
    ? names.filter(other => {
        const parts = storeParts(other);
        return parts !== null && parts.account === self.account && parts.revision < self.revision;
      })
    : [false, true].map(local =>
        storeName({ account: self.account, revision: self.revision - 1, local }),
      );
  for (const other of earlier) {
    try {
      indexedDB.deleteDatabase(other);
    } catch {
      // 지우지 못해도 연다 — 다음에 열 때 다시 지운다.
    }
  }
  return earlier;
}
