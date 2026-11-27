#!/usr/bin/env node
// 웹 계정 화면의 Workspace 안내를 지금 PC에 맞춘 공개 후보를 짓는다(2026-11-27).
// PC 0.5.0이 PC 앱 안의 Workspace 설치 화면을 거뒀고, 0.5.9가 따로 설치하던 Workspace 앱을 거뒀다.
// 공개본 account/dist/platform.js는 master 빌드와 구성이 달라 통째로 덮지 않고, 바뀐 조각만 얹는다.
//   node patch-live.mjs <공개본 폴더> <master 새 빌드 platform.js> <후보 폴더>
// 단언: 조각마다 공개본에서 한 번만 맞고, 되돌리면 공개본과 바이트까지 같고, 묶음이 문법상 읽히고,
//       얹은 네 자리(앱 상세 · PC 앱 받기 · 도움말 · 여는 법 창)가 새 빌드의 같은 자리와 글자까지 같다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const [live, build, out] = process.argv.slice(2);
if (!out) { console.error('쓰기: node patch-live.mjs <공개본 폴더> <새 빌드> <후보 폴더>'); process.exit(2); }
const file = 'account/dist/platform.js';
const before = fs.readFileSync(path.join(live, file), 'utf8');
const B = fs.readFileSync(build, 'utf8').replace(/\r\n/g, '\n');
const cut = (s, from, to) => { const i = s.indexOf(from), j = s.indexOf(to, i); assert.ok(i >= 0 && j > i, from); return s.slice(i, j); };
const REGIONS = [
  ['function appPage(', 'function downloads('],
  ['function downloads(', 'function settings('],
  ['function help(', 'function render('],
  ['else if(action==="install-info")', 'else if(action==="refresh-clients")'],
];

const PC = '회사 초대를 받은 계정이면 SYNK PC 앱 안에서도 열 수 있어요.';
const OPEN = 'Workspace는 회사에서 안내받은 Workspace 주소로 브라우저에서 열어요.';
const pairs = [
  ['world?"웹에서 바로 하거나 PC 앱에 설치해 써요":', 'world?"설치 없이 휴대폰 브라우저에서 바로 해요":'],
  ['<dt>설치</dt><dd>SYNK PC 앱 안에서 골라 설치해요.</dd>', '<dt>설치</dt><dd>${world?"따로 설치하지 않아요. 휴대폰 브라우저에서 바로 열어요.":"따로 설치하지 않아요. 회사 초대를 받은 계정이면 SYNK PC 앱 안에서도 열려요."}</dd>'],
  ['button("설치 안내","install-info",app.id,"plain")', 'button("여는 법","install-info",app.id,"plain")'],
  ['"SYNK PC 앱을 먼저 설치하고, Workspace는 그 안에서 골라 설치해요. WORLD는', `"SYNK PC 앱을 받아 설치해요. ${OPEN} WORLD는`],
  ['<h2 id="dl-apps-title">PC 앱 안에서 설치하는 앱</h2>', '<h2 id="dl-apps-title">PC 앱에서 여는 앱</h2>'],
  ['<h2>2. Workspace는 PC 앱 안에서 설치해요.</h2><p>PC 앱을 깔아도 Workspace가 저절로 깔리지는 않아요. PC 앱에서 Workspace를 고르고 「설치 파일 준비」 → 「설치 시작」을 누르면 설치 창이 열려요. 한국어',
    `<h2>2. Workspace는 브라우저에서 열어요.</h2><p>${OPEN} ${PC} 한국어`],
  ['modal("Workspace 설치","Workspace 설치 파일은 SYNK PC 앱 안에 들어 있어요. PC 앱에서 Workspace를 고르고 「설치 파일 준비」 → 「설치 시작」을 누르면 설치 창이 열려요. 다 깔리면 「설치 상태 확인」을 눌러 바로 열어요.")',
    `modal("Workspace 여는 법","${OPEN} ${PC}")`],
];

let text = before;
for (const [a, b] of pairs) { assert.equal(text.split(a).length, 2, `한 번만 맞아야: ${a.slice(0, 70)}`); text = text.replace(a, () => b); }
let back = text;
for (const [a, b] of [...pairs].reverse()) { assert.equal(back.split(b).length, 2, `되돌리기: ${b.slice(0, 70)}`); back = back.replace(b, () => a); }
assert.equal(back, before, '되돌리면 공개본과 같아야');
new Function(text);
for (const old of ['설치 파일 준비', '설치 시작', 'Workspace는 그 안에서 골라 설치', 'PC 앱 안에서 설치하는 앱', 'Workspace는 PC 앱 안에서 설치', 'SYNK PC 앱 안에서 골라 설치', 'Workspace 앱을 이미 설치한', '"Workspace 설치"'])
  assert.ok(!text.includes(old), `남은 옛 글: ${old}`);
for (const [from, to] of REGIONS) assert.equal(cut(text, from, to), cut(B, from, to), `새 빌드와 다른 자리: ${from}`);
assert.equal(text.split(OPEN).length - 1, 3);
assert.equal(text.split('회사 초대를 받은 계정이면 SYNK PC 앱 안에서도 열').length - 1, 3);

fs.mkdirSync(path.join(out, 'account/dist'), { recursive: true });
fs.writeFileSync(path.join(out, file), text);
console.log(file, before.length, '→', text.length, `조각 ${pairs.length}`, '자리 4곳이 새 빌드와 같음');
