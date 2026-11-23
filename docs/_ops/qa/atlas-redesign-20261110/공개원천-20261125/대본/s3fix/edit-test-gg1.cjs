'use strict';
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'atlas-next-position-shell.test.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${n}번: ${find.slice(0, 80)}`); s = s.replace(f, () => eol(repl)); };
rep(`test('한글 열쇠 — 엔진 판은 이 화면이 이미 든 옛 코치에서만 짓고, 열쇠 하나 때문에 옛 코치를 만들지 않는다(설계 주인 11-15)', async () => {`,
`test('한글 열쇠 — 엔진 판은 옛 코치 없이도 학습 호스트의 status()로 계정 · 판 구역 열쇠를 지어 졸업을 읽고, 열쇠 하나 때문에 옛 코치를 만들지 않는다(설계 주인 11-15 · 검수 s3d GG1)', async () => {`);
rep(`    status: () => ({ accountKey: 'acct-1', revision: 3 }),`, `    status: () => ({ accountKey: 'acct-1', revision }),`);
rep(`  const created = [];
  const empty =`, `  const created = [];
  let revision = 3;
  const empty =`);
rep(`    // 든 옛 코치가 없다 — 계정의 한글 자리를 모르는 것(지금 판에서 학습 호스트가 아직 없을 때와 같다)으로 한글 판을 연다.
    await app.education.position();
    assert.match(app.last(), /data-position-board="hangul"/);
    assert.deepEqual(created, [], '열쇠 하나 때문에 옛 코치를 만들지 않는다');`,
`    // 든 옛 코치가 없어도 학습 호스트의 status()로 이 계정 · 판 구역 열쇠를 지어 졸업을 읽고 엔진 판을 연다(검수 s3d GG1 — 전에는 한글 판으로 갔다).
    const touched0 = { ...globals.touched };
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    assert.deepEqual(created, [], '열쇠 하나 때문에 옛 코치를 만들지 않는다');
    assert.deepEqual(globals.touched, touched0, 'IndexedDB · /atlas/를 늘리지 않는다');
    // 졸업 기록이 없는 판 구역(동의 판이 바뀜)이면 한글 판이다 — 열쇠가 그 계정 · 판 구역의 것이다.
    revision = 4;
    await app.education.position();
    assert.match(app.last(), /data-position-board="hangul"/);
    revision = 3;`);
fs.writeFileSync(file, s);
console.log('GG1 시험 고침');
