'use strict';
// GG1: 새 길 「내 위치」가 옛 코치를 들지 않은 탭에서도 계정의 한글 열쇠를 학습 호스트의 status()로 짓는다.  node edit-gg1.cjs <폴더>
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'world-learning-ui.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${n}번: ${find.slice(0, 80)}`); s = s.replace(f, () => eol(repl)); };
rep(`  if(owner!=='guest'&&!coachNow)return null;`,
`  // 옛 코치를 들지 않은 탭(새 길은 옛 코치를 열지 않는다 — 검수 s3d GG1): 계정의 한글 열쇠는 학습 호스트의 status()(계정 열쇠 · 동의 판)로 짓는다.
  // hangulProgressKey는 코치를 「호스트를 가진가」(assignment)로만 보고 열쇠는 호스트 status()로 짓는다 — 옛 코치 · 옛 저장소를 열지 않는다(설계 주인 11-15).
  // 호스트가 계정 구역을 모르면 열쇠가 없다(null — 읽지 않는다).
  if(owner!=='guest'&&!coachNow)coachNow=HOSTED_KEY;`);
rep(` function heldCoach(){`,
` const HOSTED_KEY=Object.freeze({assignment:()=>null});
 function heldCoach(){`);
fs.writeFileSync(file, s);
console.log('GG1 고침');
