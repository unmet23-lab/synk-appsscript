#!/usr/bin/env node
/* 한 컷을 «촘촘히» 훑는다 — 어긋남이 시작되는 «초»를 찾을 때 쓴다.
 *
 * 09-05: 컷4(눈 붙이기)에서 둘째 눈이 붙는 순간 배치가 어긋났다(유호 지적).
 * 조각을 그 «전»에서 끊으면 다시 굽지 않고 고칠 수 있어서, 몇 초인지 정확히 재야 했다.
 *
 * 쓰기: node tools/컷훑기.js 4            — 컷4 를 0.5초 간격으로
 *      node tools/컷훑기.js 4 2.5 5.5    — 그 구간만
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 방 = path.join(뿌리, '영상', 'out', '홍보_4K_v2');
const 낼곳 = path.join(방, '_확인');

(async () => {
  const [번호, 부터 = 0, 까지 = 8] = process.argv.slice(2);
  const f = fs.readdirSync(방).find((n) => n.normalize('NFC').startsWith(`컷${번호}_`) && n.endsWith('.mp4'));
  if (!f) { console.log(`🔴 컷${번호} 가 없다.`); process.exit(1); }

  fs.mkdirSync(낼곳, { recursive: true });
  const 초들 = [];
  for (let t = Number(부터); t <= Number(까지) - 0.01; t += 0.5) 초들.push(Number(t.toFixed(2)));
  const 칸 = 초들.map((t) => `eq(n\\,${Math.round(t * 24)})`).join('+');
  const 열 = Math.min(초들.length, 6);
  const 줄 = Math.ceil(초들.length / 열);

  const 낼것 = path.join(낼곳, `컷${번호}_훑기.jpg`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(방, f),
    '-vf', `select='${칸}',scale=380:-1,tile=${열}x${줄}`, '-frames:v', '1', 낼것]);
  console.log(`✅ ${낼것}`);
  console.log(`   ${초들.map((t) => t + 's').join(' · ')}`);
})();
