'use strict';
// GH2 덧: 같은 세대에서 표지가 처음 생긴 것(다른 상자 · 다른 탭이 물으며 둠)은 지우는 길이 아니다 — 상자를 비우지 않는다.  node edit-gh2b.cjs <폴더>
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'world-month-answer.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const find = eol(`    const now = answers.stamp(owner);
    if (state.owner === owner && state.generation === now) return;
`);
if (s.split(find).length !== 2) throw Error('자리');
s = s.replace(find, () => eol(`    const now = answers.stamp(owner);
    if (state.owner === owner && state.generation === now) return;
    // 같은 세대에서 표지가 처음 생긴 것뿐이면(같은 계정의 다른 상자나 다른 탭이 물으며 둠) 지우는 길이 아니다 — 상자를 비우지 않는다(검수 s3d GH2).
    if (state.owner === owner && String(state.generation).endsWith('|') && now.startsWith(String(state.generation))) {
      state.generation = now;
      return;
    }
`));
fs.writeFileSync(file, s);
console.log('GH2 덧 고침');
