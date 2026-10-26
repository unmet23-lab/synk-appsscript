#!/usr/bin/env node
'use strict';
/**
 * 9번 이미지 콘티 — 지시문/_참고.json의 컷을 세 장씩 나란히 굽는다(굽기 계정 돌려 쓰기는 이미지콘티_굽기.cjs → tools/codex계정.js).
 * bash 하위 셸(xargs)로 넘기면 한글 경로 인자가 깨져 「참고 그림이 없다」로 끝나서(10-26) node가 직접 넘긴다.
 *
 *   node 이미지콘티_굽기묶음.cjs [S02a S02b …]   (생략하면 전부)
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const 여기 = __dirname;
const 참고표 = JSON.parse(fs.readFileSync(path.join(여기, '지시문', '_참고.json'), 'utf8'));
const 할것 = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(참고표);
const 동시 = 3;

function 굽기(이름) {
  return new Promise((풀림) => {
    const 인자 = [path.join(여기, '이미지콘티_굽기.cjs'), path.join(여기, '지시문', `${이름}.txt`), 이름, ...참고표[이름]];
    const 자식 = spawn(process.execPath, 인자, { cwd: 여기, stdio: ['ignore', 'pipe', 'pipe'] });
    let 끝줄 = '';
    const 받기 = (d) => { const t = d.toString('utf8').trim(); if (t) 끝줄 = t.split('\n').pop(); };
    자식.stdout.on('data', 받기);
    자식.stderr.on('data', 받기);
    자식.on('close', (code) => { console.log(`${이름} 종료 ${code} · ${끝줄}`); 풀림(code); });
  });
}

(async () => {
  const 줄 = [...할것];
  const 일꾼 = Array.from({ length: Math.min(동시, 줄.length) }, async () => {
    while (줄.length) await 굽기(줄.shift());
  });
  await Promise.all(일꾼);
})();
