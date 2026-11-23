'use strict';
// 공개되는 WORLD 원천 주석에서 검수 모델 이름(Opus · flash)을 지운다(본 검수 Fable F2 — 화면 · 데이터 · 주석에 도구 이름을 남기지 않는 원칙).
// 줄끝(CRLF/LF)은 그대로 둔다. 바꾼 수가 기대와 다르면 아무것도 쓰지 않고 멈춘다.
//   node scrub-opus.cjs <저장소 뿌리> [--실행]
const fs = require('node:fs'), path = require('node:path');
const root = process.argv[2];
const run = process.argv.includes('--실행');
const plan = [
  ['experiences/synk-world-app/app-shell.mjs', [[/4-5 Opus 대체/g, '4-5 대체', 2]]],
  ['experiences/synk-world-app/world-atlas-next.mjs', [[/4-5 Opus 대체/g, '4-5 대체', 5]]],
  ['experiences/synk-world-app/world-old-engine-doors.mjs', [[/4-5 Opus 대체/g, '4-5 대체', 3]]],
  ['experiences/synk-world-app/world-reminder-device.mjs', [[/\(둘째 다시 검수 -c Opus(\r?\n)/g, '(둘째 다시 검수 -c$1', 1]]],
  ['experiences/brand-opening/world-strings.mjs', [
    [/원문을 안 본 Opus 직역/g, '원문을 안 본 직역', 1],
    [/flash와 Opus 직역이 원문 뜻과 같음/g, '두 직역이 원문 뜻과 같음', 1],
    [/flash 직역 (「[^」]*」가 원문 뜻과 같음), Opus 확인\)/g, '직역 $1)', 1],
  ]],
];
let bad = 0;
const out = [];
for (const [rel, rules] of plan) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, 'utf8');
  for (const [re, to, want] of rules) {
    const n = (text.match(re) || []).length;
    if (n !== want) { console.log(`${rel}: ${re} ${n}곳 — 기대 ${want}`); bad++; continue; }
    text = text.replace(re, to);
  }
  const left = text.split('\n').filter(l => /\b[Oo]pus\b/.test(l) && !/codecs=opus|webm\/opus/.test(l)).length;
  if (left) { console.log(`${rel}: Opus가 ${left}줄 남음`); bad++; }
  out.push([file, text]);
}
if (bad) { console.log('멈춤 — 쓰지 않았다'); process.exit(1); }
if (run) for (const [file, text] of out) fs.writeFileSync(file, text);
console.log(run ? `씀 ${out.length}개` : `시험 통과 ${out.length}개(--실행으로 씀)`);
