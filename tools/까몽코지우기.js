#!/usr/bin/env node
/* 까몽이 정본에서 «코»를 지운다 — 정본끼리 어긋난 자리를 맞춘다.
 *
 * ■ 무엇이 어긋났나 (09-05 유호 발견 「까몽이가 왜 코가 있는것같지? 점같은게 있는데」)
 *   정본_4K 의 까몽이 열 벌 중 **일부에만** 코(작은 짙은 점)가 있다:
 *     코 없음 = 본체 · 눈감음 · 놀람        코 있음 = 눈웃음 · 윙크 · 으쓱 · 졸림
 *   마스코트 정체성은 «본체»가 지므로 코가 있는 쪽이 어긋난 판이다.
 *   그리고 코가 있으면 진짜 고양이에 가까워져 «무섭게» 읽힌다(유호 09-05 같은 날 지적).
 *
 * ■ 어떻게 지우나
 *   delogo 로 그 자리를 주변 털로 메운다. 털이 무늬 없이 이어지는 자리라 티가 거의 안 난다.
 *   🔑 **원본은 안 건드린다** — `누끼`·`코없음` 처럼 사본으로 낸다(유호님이 배치한 자산이다).
 *
 * ■ 쓰기
 *   node tools/까몽코지우기.js                 — 코 있는 넷을 전부
 *   node tools/까몽코지우기.js 까몽_눈웃음      — 그것만
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 정본방 = path.join(뿌리, 'docs', '캐릭터', '정본_4K');
const 낼곳 = path.join(정본방, '코없음');

/* 코 자리 — 4096² 정본 기준. 표정마다 얼굴 각도가 조금씩 달라 자리도 조금씩 다르다.
 * 값은 09-05 에 눈으로 재서 넣었다(자동으로 찾는 자를 지으면 «코 아닌 점»까지 지운다). */
const 코자리 = {
  까몽_눈웃음: { x: 1725, y: 1548, w: 150, h: 140 },
  까몽_윙크: { x: 1700, y: 1520, w: 140, h: 130 },
  까몽_으쓱: { x: 1710, y: 1420, w: 140, h: 130 },
  까몽_졸림: { x: 1720, y: 1580, w: 140, h: 130 },
};

(async () => {
  const 고른 = process.argv.slice(2);
  const 할것 = 고른.length ? 고른.filter((n) => 코자리[n]) : Object.keys(코자리);
  if (!할것.length) { console.log(`🔴 아는 이름이 없다. 있는 것: ${Object.keys(코자리).join(' · ')}`); process.exit(1); }

  fs.mkdirSync(낼곳, { recursive: true });
  for (const 이름 of 할것) {
    const 원본 = path.join(정본방, `${이름}.png`);
    if (!fs.existsSync(원본)) { console.log(`🟠 ${이름} 없다 — 건너뛴다`); continue; }
    const z = 코자리[이름];
    const 낼것 = path.join(낼곳, `${이름}.png`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 원본,
      '-vf', `delogo=x=${z.x}:y=${z.y}:w=${z.w}:h=${z.h}:show=0`, 낼것]);
    console.log(`✅ ${이름}  (코 자리 ${z.w}×${z.h} @ ${z.x},${z.y})`);
  }
  console.log(`\n${낼곳}\n⚠ 원본은 그대로다 — 이 폴더가 사본이다.`);
})();
