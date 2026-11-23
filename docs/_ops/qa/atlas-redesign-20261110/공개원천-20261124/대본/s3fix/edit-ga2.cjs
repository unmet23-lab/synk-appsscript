'use strict';
// GPT s3e2 GA2: 동의 바꾸기가 실패하면 계정을 다시 읽는다 — 계정 묶음에 refreshLearning이 없으면(지금 라이브 묶음) restore()로 읽는다.
//   node edit-ga2.cjs <app-shell.mjs가 있는 폴더>
const fs = require('node:fs'), path = require('node:path');
const file = path.join(process.argv[2], 'app-shell.mjs');
let s = fs.readFileSync(file, 'utf8');
const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
const rep = (find, repl) => { const f = eol(find); const n = s.split(f).length - 1; if (n !== 1) throw Error(`${n}번: ${find.slice(0, 90)}`); s = s.replace(f, () => eol(repl)); };
rep(` // 토글은 잠근다 — 먼저 풀면 옛 체크 · 판 번호로 다시 눌러 또 실패했다(처리 다시 검수 A1).
 return account.refreshLearning?.().then(()=>{if(screen==='world-profile')profile();},()=>{});}`,
 ` // 토글은 잠근다 — 먼저 풀면 옛 체크 · 판 번호로 다시 눌러 또 실패했다(처리 다시 검수 A1). 계정 묶음에 refreshLearning이 없으면(공개 직후의
 // 옛 묶음) 세션을 다시 확인하는 restore()로 읽는다 — 그대로 두면 다른 기기가 바꾼 판 번호로 같은 충돌이 되풀이됐다(검수 s3e2 GA2).
 return Promise.resolve().then(()=>typeof account.refreshLearning==='function'?account.refreshLearning():account.restore?.()).then(()=>{if(screen==='world-profile')profile();},()=>{});}`);
fs.writeFileSync(file, s);
console.log('GA2 고침:', file);
