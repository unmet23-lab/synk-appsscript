#!/usr/bin/env node
'use strict';
// 시안을 동시에 셋까지 굽는다. 사용: node 모두굽기.cjs <이름…> — 이름의 @뒤는 같은 지시문 다른 판(O1_나전@2).
// 이름이 O로 시작하면 OFALIN 원고, 아니면 OUTBLUE 원고를 참고로 넣는다.
const path = require('path');
const { spawn } = require('child_process');
const 여기 = __dirname;
const 뿌리 = 'C:/Users/q1212/Documents/SYNK-appsscript';
const 줄 = process.argv.slice(2);
let 도는 = 0;
let 실패 = 0;
function 다음() {
  while (도는 < 3 && 줄.length) {
    const 이름 = 줄.shift();
    const 지시 = path.join(여기, '지시문', 이름.split('@')[0] + '.txt');
    const 원고 = path.join(여기, '원고', 이름.startsWith('O') ? 'OFALIN_세리프.jpg' : 'OUTBLUE_넓은.jpg');
    도는 += 1;
    const 자식 = spawn(process.execPath, [path.join(여기, '굽기.cjs'), 지시, 이름.replace('@', '_'), 원고], { cwd: 뿌리, stdio: 'inherit' });
    자식.on('close', (코드) => { 도는 -= 1; if (코드) { 실패 += 1; console.error(`[실패] ${이름} ${코드}`); } 다음(); });
  }
  if (!도는 && !줄.length) process.exit(실패 ? 1 : 0);
}
다음();
