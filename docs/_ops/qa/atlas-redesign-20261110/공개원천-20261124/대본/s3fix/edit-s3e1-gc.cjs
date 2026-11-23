'use strict';
// 검수 s3e1 GPT 묶음 C의 world-month-answer 지적 고침(GC1 · GC2).
//   node edit-s3e1-gc.cjs <world-month-answer.mjs가 있는 폴더>
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'world-month-answer.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl, count = 1) => {
  const f = eol(find);
  const n = s.split(f).length - 1;
  if (n !== count) throw Error(`${n}번(${count}이어야): ${find.slice(0, 90)}`);
  s = s.split(f).join(eol(repl));
};

// 표지의 값: 고유 글자 하나 → { id, floor }(GC2). 판 바닥(floor)은 연습 기록 비우기가 올린 판이다.
rep(`// 지우기 표지(검수 s3d GH2) — 세대 수는 문서마다 따로라, 다른 탭의 지우는 길이 이 문서의 묻는 중인 물음을 늦은 답으로 만들지 못했다(그 늦은 답이
// 지운 뒤에 학습일 답 · 근거를 다시 적었다). 그래서 새 길이 물을 때 계정마다 표지 하나를 저장소에 두고(없을 때만 만든다), 지우는 길은 두 열쇠와 함께
// 그 표지도 지운다. 물을 때 든 표지가 들일 때 · 적을 때와 다르면 들이지도 적지도 않는다. 묻지 않는 문서(꺼진 판)는 표지를 만들지 않으므로 지우는 길은
// 지우기만 한다(쓰기 0). 값은 고유한 글자 하나다 — 개인 기록이 아니다.
export const CLEAR_KIND = Object.freeze({ prefix: 'synk:world:month-clear:' });
let marks = 0;
const markOf = (storage, account) => {
  try {
    return storage?.getItem(keyOf(CLEAR_KIND, account)) ?? null;
  } catch {
    return null;
  }
};
const makeMark = (storage, account) => {
  if (markOf(storage, account) !== null) return;
  marks += 1;
  try {
    storage?.setItem(keyOf(CLEAR_KIND, account), \`\${Date.now().toString(36)}.\${marks.toString(36)}.\${Math.random().toString(36).slice(2, 10)}\`);
  } catch {
    // 막힌 저장소 — 이 문서의 세대 수만 남는다
  }
};`,
 `// 지우기 표지(검수 s3d GH2) — 세대 수는 문서마다 따로라, 다른 탭의 지우는 길이 이 문서의 묻는 중인 물음을 늦은 답으로 만들지 못했다(그 늦은 답이
// 지운 뒤에 학습일 답 · 근거를 다시 적었다). 그래서 새 길이 물을 때 계정마다 표지 하나를 저장소에 두고(없을 때만 만든다), 지우는 길은 두 열쇠와 함께
// 그 표지도 지운다. 물을 때 든 표지가 들일 때 · 적을 때와 다르면 들이지도 적지도 않는다. 묻지 않는 문서(꺼진 판)는 표지를 만들지 않으므로 지우는 길은
// 지우기만 한다(쓰기 0). 값은 { id, floor }다 — 개인 기록이 아니다. id는 고유한 글자 하나로 물음의 표지(stamp)에 든다. floor는 연습 기록 비우기가
// 올린 판이다 — 비우기는 표지를 지우지 않고 floor만 올려 그보다 앞선 판의 물음만 늦은 답으로 만든다. 예전에는 비우기가 표지를 통째로 지워(표지 값에
// 판이 없어 판을 읽을 수 없는 값으로 지웠다) 새 판에서 다른 탭이 물은 답까지 버렸다(검수 s3e1 GC2).
export const CLEAR_KIND = Object.freeze({ prefix: 'synk:world:month-clear:' });
let marks = 0;
const markOf = (storage, account) => {
  let raw = null;
  try {
    raw = storage?.getItem(keyOf(CLEAR_KIND, account)) ?? null;
  } catch {
    return null;
  }
  if (typeof raw !== 'string' || !raw) return null;
  let value = null;
  try {
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  // 꼴이 아닌 값은 그 글자를 id로 본다(바닥 없음).
  return plain(value) && typeof value.id === 'string' && value.id
    ? { id: value.id, floor: Number.isSafeInteger(value.floor) ? value.floor : null }
    : { id: raw, floor: null };
};
const makeMark = (storage, account) => {
  if (markOf(storage, account) !== null) return;
  marks += 1;
  const id = \`\${Date.now().toString(36)}.\${marks.toString(36)}.\${Math.random().toString(36).slice(2, 10)}\`;
  try {
    storage?.setItem(keyOf(CLEAR_KIND, account), JSON.stringify({ id, floor: null }));
  } catch {
    // 막힌 저장소 — 이 문서의 세대 수만 남는다(이 물음의 답은 저장소에 적지 않는다 — GC1)
  }
};
// 이 계정의 판 바닥 — 표지의 floor(없으면 null).
const floorOf = (storage, account) => markOf(storage, account)?.floor ?? null;
// 표지의 floor를 올린다. 표지가 없으면 묻는 중인 새 길 물음도 없다(물음은 표지를 만든다 — 만들지 못한 물음은 저장소에 적지 않는다). floor를 적지
// 못하면 표지를 지운다 — 어느 탭의 앞 판 물음도 그 답을 적지 않게(새 판의 물음도 함께 다시 묻는다).
const raiseFloor = (storage, account, before) => {
  const mark = markOf(storage, account);
  if (!mark || (mark.floor !== null && mark.floor >= before)) return;
  try {
    storage.setItem(keyOf(CLEAR_KIND, account), JSON.stringify({ id: mark.id, floor: before }));
  } catch {
    try {
      storage.removeItem(keyOf(CLEAR_KIND, account));
    } catch {
      // 막힌 저장소 — 표지를 지우지도 못하면 저장소에 적는 물음도 없다(적기는 같은 저장소의 표지를 다시 읽는다)
    }
  }
};
// 물음의 판이 판 바닥 위인가(바닥이 없으면 참).
const aboveFloor = (floor, revision) => floor === null || (Number.isSafeInteger(revision) && revision >= floor);`);

// 지우는 길 — before를 주면 세대 수와 표지 id는 그대로 두고 판 바닥만 올린다(GC2).
rep(`// 지우는 길(로그아웃 · 동의 끔 · 계정 바꿈 · 연습 기록 비우기) — 그 계정의 두 열쇠(학습일 답 · 근거)를 지우고 세대 수를 올린다(물은 뒤의 늦은
// 답을 적지 않게). 한 열쇠를 지우다 저장소가 던져도 다른 열쇠는 지운다. before(연습 기록 비우기가 올린 새 판)를 주면 그보다 앞선 판의 답만
// 지운다 — 늦게 끝난 앞 비우기가 새 판에서 적은 답을 지웠다(4-5 입구 다시 검수 GA1 · GB6). 판을 읽을 수 없는 값은 지운다.
export function clearMonthAnswer(storage, account, { before = null } = {}) {
  generation += 1;
  if (Number.isSafeInteger(before)) storage = keepNewer(storage, before);
  for (const kind of [...KINDS, CLEAR_KIND]) {`,
 `// 지우는 길(로그아웃 · 동의 끔 · 계정 바꿈 · 연습 기록 비우기) — 그 계정의 두 열쇠(학습일 답 · 근거)를 지우고 세대 수를 올린다(물은 뒤의 늦은
// 답을 적지 않게). 한 열쇠를 지우다 저장소가 던져도 다른 열쇠는 지운다. before(연습 기록 비우기가 올린 새 판)를 주면 그보다 앞선 판의 답만
// 지운다 — 늦게 끝난 앞 비우기가 새 판에서 적은 답을 지웠다(4-5 입구 다시 검수 GA1 · GB6). 판을 읽을 수 없는 값은 지운다. 그때는 세대 수와
// 표지 id를 그대로 두고 판 바닥만 올린다 — 앞 판의 물음만 늦은 답이 되고, 새 판에서 물은 답은 산다(검수 s3e1 GC2).
export function clearMonthAnswer(storage, account, { before = null } = {}) {
  if (Number.isSafeInteger(before)) {
    if (!account) return;
    raiseFloor(storage, account, before);
    const older = keepNewer(storage, before);
    for (const kind of KINDS) {
      try {
        older?.removeItem(keyOf(kind, account));
      } catch {
        // 저장소가 막혀도 판 바닥은 올렸다 — 다음 읽기는 판 · 학습일로 다시 거른다
      }
    }
    return;
  }
  generation += 1;
  for (const kind of [...KINDS, CLEAR_KIND]) {`);

// 표지(stamp)에는 표지의 id만 든다. 판 바닥을 낸다. 표지가 없는 물음 · 판 바닥 아래 판의 답은 적지 않는다(GC1 · GC2).
rep(`    return \`\${generation}|\${(account && markOf(storage, account)) ?? ''}\`;
  };
  return {
    generation: () => generation,
    stamp: (account, { ensure = false } = {}) => stampOf(account, ensure),`,
 `    return \`\${generation}|\${(account && markOf(storage, account)?.id) ?? ''}\`;
  };
  return {
    generation: () => generation,
    stamp: (account, { ensure = false } = {}) => stampOf(account, ensure),
    // 판 바닥 — 연습 기록 비우기가 올린 판(없으면 null). 그보다 앞선 판의 물음은 늦은 답이다(GC2).
    floor: account => (account ? floorOf(storage, account) : null),`);
rep(`    write(account, { revision, day, since, ...answer }) {
      if (since !== stampOf(account)) return false;
      if (!storage) return false;`,
 `    write(account, { revision, day, since, ...answer }) {
      if (since !== stampOf(account)) return false;
      // 표지가 없는 물음(표지를 만들지 못했다 — 용량 초과 · 막힌 저장소)의 답은 적지 않는다. 다른 탭의 지우는 길이 돌았는지 가릴 수 없다 — 다른
      // 탭이 동의를 끄며 공간을 비운 뒤 그 앞에 물은 답이 다시 적혔다(검수 s3e1 GC1). 그 답은 이 문서의 답(kept)으로만 남는다.
      if (typeof since !== 'string' || since.endsWith('|')) return false;
      if (!aboveFloor(floorOf(storage, account), revision)) return false;
      if (!storage) return false;`);

// 물음 — 답이 왔을 때 판 바닥 아래의 판이면 늦은 답이다(GC2). 답을 들이기 전에 지금 코치가 아직 계정 기록인가 본다(GC1).
rep(`    const still = () => {
      if (!alive(owner) || since !== answers.stamp(owner)) return false;
      try {`,
 `    const still = () => {
      if (!alive(owner) || since !== answers.stamp(owner)) return false;
      if (!aboveFloor(answers.floor?.(owner) ?? null, revision)) return false; // 연습 기록 비우기가 앞 판을 지웠다(GC2)
      try {`);
rep(`      const holder = holderOf(coach, line);
      const storage = holder.storage;
      if (got?.complete !== true) {`,
 `      const holder = holderOf(coach, line);
      const storage = holder.storage;
      // 들일 코치가 이제 계정 기록이 아니면(물은 사이 동의를 껐다 — 코치가 기기 기록으로 바뀜) 들지도 적지도 다시 그리지도 않는다(검수 s3e1 GC1).
      if (storage && storage.guest !== false) return;
      if (got?.complete !== true) {`);

fs.writeFileSync(file, s);
console.log('GC 고침:', file);
