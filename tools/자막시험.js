#!/usr/bin/env node
/* 자막 한 줄이 화면에 «실제로» 찍히나 — 0원 시험.
 * 09-05: 잇기에 넣은 자막이 완성본에 안 보였다. 필터가 조용히 무시된 것인지,
 * 알파 식이 0을 낸 것인지, 자리가 화면 밖인지 가르려면 한 프레임을 직접 뽑아 봐야 한다. */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 방 = path.join(뿌리, '영상', 'out', '홍보_4K_v2');
const 낼곳 = path.join(방, '_확인');

const 서체 = (() => {
  const 원본 = path.join(뿌리, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Regular.otf');
  const 사본 = path.join(os.tmpdir(), 'synk_suit_regular.otf');
  if (!fs.existsSync(사본)) fs.copyFileSync(원본, 사본);
  return 사본.replace(/\\/g, '/').replace(/:/g, '\\:');
})();

const 벌려 = (s) => s.split('').join(' ');

(async () => {
  fs.mkdirSync(낼곳, { recursive: true });
  const 원본 = path.join(방, '컷5_몽글.mp4');
  if (!fs.existsSync(원본)) { console.log('🔴 컷5 가 없다.'); process.exit(1); }

  /* 잇기와 «같은 모양»으로 필터를 짜되 알파는 상수로 둔다 — 알파 식이 범인인지 가르는 자다. */
  const 시험들 = [
    { 이름: '46px', 크기: 46, 알파: '0.72' },
    { 이름: '92px', 크기: 92, 알파: '0.72' },
    { 이름: '130px', 크기: 130, 알파: '0.72' },
  ];

  for (const 시 of 시험들) {
    const { 크기 } = 시;
    const 낼것 = path.join(낼곳, `자막시험_${시.이름}.jpg`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '3.0', '-i', 원본,
      '-vf', `drawtext=fontfile='${서체}':text='${벌려('안녕하세요')}':fontsize=${크기}:`
        + `fontcolor=0xFBF7F0:x=(w-text_w)/2:y=h*0.815:alpha='${시.알파}',scale=900:-1`,
      '-frames:v', '1', 낼것]);
    console.log(`✅ ${시.이름} → ${path.basename(낼것)}`);
  }
  console.log(`\n${낼곳}`);
})();
