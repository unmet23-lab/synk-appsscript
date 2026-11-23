'use strict';
// GH2: 다른 탭의 지우는 길(로그아웃 · 동의 바꿈 · 비우기)이 이 탭의 묻는 중인 물음을 늦은 답으로 만든다 — 계정마다 지우기 표지를 저장소에 둔다.
//   node edit-gh2.cjs <폴더(master experiences/synk-world-app 또는 후보 원본 world)>
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'world-month-answer.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${n}번: ${find.slice(0, 80)}`); s = s.replace(f, () => eol(repl)); };

rep(`let generation = 0;
const keyOf = (kind, account) => \`\${kind.prefix}\${account}\`;
`, `let generation = 0;
const keyOf = (kind, account) => \`\${kind.prefix}\${account}\`;

// 지우기 표지(검수 s3d GH2) — 세대 수는 문서마다 따로라, 다른 탭의 지우는 길이 이 문서의 묻는 중인 물음을 늦은 답으로 만들지 못했다(그 늦은 답이
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
};
`);
rep(`  for (const kind of KINDS) {
    try {
      if (account) storage?.removeItem(keyOf(kind, account));`, `  for (const kind of [...KINDS, CLEAR_KIND]) {
    try {
      if (account) storage?.removeItem(keyOf(kind, account));`);
rep(`export function createMonthAnswers({ storage = globalThis.localStorage, kind = MONTH_KIND } = {}) {
  return {
    generation: () => generation,`, `export function createMonthAnswers({ storage = globalThis.localStorage, kind = MONTH_KIND } = {}) {
  // 물음의 표지 — 이 문서의 세대 수와 계정의 지우기 표지. ensure면 표지가 없을 때 만든다(새 길이 물을 때만).
  const stampOf = (account, ensure = false) => {
    if (ensure && account) makeMark(storage, account);
    return \`\${generation}|\${(account && markOf(storage, account)) ?? ''}\`;
  };
  return {
    generation: () => generation,
    stamp: (account, { ensure = false } = {}) => stampOf(account, ensure),`);
rep(`    // 답을 적는다 — 물을 때의 세대 수가 지금과 같고 저장소가 있을 때만(지우는 길이 그 사이에 돌았으면 적지 않는다). 적었나를 돌려준다.
    write(account, { revision, day, since, ...answer }) {
      if (since !== generation) return false;`, `    // 답을 적는다 — 물을 때의 표지(세대 수 · 지우기 표지 — stamp)가 지금과 같고 저장소가 있을 때만(이 문서나 다른 탭의 지우는 길이 그 사이에
    // 돌았으면 적지 않는다). 적었나를 돌려준다.
    write(account, { revision, day, since, ...answer }) {
      if (since !== stampOf(account)) return false;`);
// 묻는 상자: 세대 수 대신 표지로 따른다
rep(`  const follow = owner => {
    const now = answers.generation();`, `  const follow = owner => {
    const now = answers.stamp(owner);`);
rep(`    const since = answers.generation();`, `    // 물을 때 계정의 지우기 표지를 둔다(없을 때만 — 검수 s3d GH2). 이 문서가 표지를 만든 것뿐이면 상자를 비우지 않는다(follow가 표지가 생긴 것을
    // 지우는 길로 읽지 않게).
    const before = answers.stamp(owner);
    const since = answers.stamp(owner, { ensure: true });
    if (state.owner === owner && state.generation === before) state.generation = since;`);
rep(`      if (!alive(owner) || since !== answers.generation()) return false;`, `      if (!alive(owner) || since !== answers.stamp(owner)) return false;`);
fs.writeFileSync(file, s);
console.log('GH2 고침');
