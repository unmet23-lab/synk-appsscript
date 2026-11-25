#!/usr/bin/env node
// 둘째 판(2026-11-26): 플랫폼 PATH 그림을 PATH 앱의 「줄에 매단 카드 세 장」으로 바꾸고, Fable 후속(F3 입학 면접 범위 · 검색 낱말)을 얹는다.
//   node patch-live-2.mjs <공개본 폴더> <후보 폴더> <카드 그림>
// patch-live.mjs와 같은 단언: 조각마다 공개본에서 한 번만 맞고, 되돌리면 공개본과 바이트까지 같다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const [live, out, cards] = process.argv.slice(2);
if (!cards) { console.error('쓰기: node patch-live-2.mjs <공개본 폴더> <후보 폴더> <카드 그림>'); process.exit(2); }
const file = 'account/dist/platform.js';
const before = fs.readFileSync(path.join(live, file), 'utf8');
const pairs = [
  ['"image":"path-vr-felt.webp"', '"image":"path-app-cards.webp"'],
  ['"keywords":["패스","유학","대학","입학","서류","장학금","면접","진로","취업","VR","Quest"]', '"keywords":["패스","유학","대학","입학","서류","장학금","면접","진로","취업"]'],
  ['<span>고른 대학의 입학 면접을 미리 연습해요.</span>', '<span>학부 과정을 고르면 그 대학의 입학 면접을 미리 연습해요.</span>'],
];
let text = before;
for (const [a, b] of pairs) { assert.equal(text.split(a).length, 2, a); text = text.replace(a, () => b); }
let back = text;
for (const [a, b] of [...pairs].reverse()) { assert.equal(back.split(b).length, 2, b); back = back.replace(b, () => a); }
assert.equal(back, before);
new Function(text);
fs.mkdirSync(path.join(out, 'account/dist'), { recursive: true });
fs.mkdirSync(path.join(out, 'account/assets'), { recursive: true });
fs.writeFileSync(path.join(out, file), text);
fs.copyFileSync(cards, path.join(out, 'account/assets/path-app-cards.webp'));
console.log(file, before.length, '→', text.length, `조각 ${pairs.length}`);
