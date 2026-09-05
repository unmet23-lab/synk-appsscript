#!/usr/bin/env node
/* 벽에 거는 «펠트 액자» — 마지막 장면의 벽에 얹을 정보판.
 *
 * ■ 왜 만드나 (유호 제안 09-05)
 *   「옆으로 움직였을 때 액자로 SYNK LAB 한국어 2027 2 11 이거 펠트로 이쁘게 액자형식으로
 *    벽에 붙여놔도 좋을것같은데?」 — 장면이 «바뀌는» 엔딩 대신 영상 «안»에서 정보가 나온다.
 *
 * ■ 왜 굽지 않고 여기서 만드나
 *   09-05 에 자수 글자 「가」를 밑그림에 넣어 세 번 구웠고 세 번 다 저쪽이 다시 그렸다
 *   (안전필터 · 산호 무늬 · 기하 무늬). **영상 굽기는 글자를 못 지킨다.**
 *   그래서 액자는 편집에서 얹는다 — 그러면 한 글자도 안 변한다.
 *
 * ■ 결은 명품 광고 엔딩 문법을 그대로 따른다(결정.md 09-05)
 *   로고 하나가 주인공 · 글자를 작게 · 자간을 벌린다 · 정보는 속삭인다 · 장식을 안 얹는다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 낼곳 = path.join(뿌리, '영상', 'out', '홍보_4K_v2', '_밑그림');
const 바탕 = path.join(뿌리, 'docs', 'Loom_자산', '구움', '펠트_종이바탕.webp');

/* 액자 규격 — 4K 화면(3840×2160)에 얹을 크기다. 벽의 한 자리를 차지하되 주인공을 안 가린다. */
const 액자 = { w: 940, h: 1180 };
const Ink = '0x2B2320';
const Coral = '0xF96859';

function 서체(이름) {
  const 원본 = path.join(뿌리, 'docs', '브랜드_폰트', 'SUIT', `SUIT-${이름}.otf`);
  const 사본 = path.join(os.tmpdir(), `synk_suit_${이름.toLowerCase()}.otf`);
  if (!fs.existsSync(사본)) fs.copyFileSync(원본, 사본);
  return 사본.replace(/\\/g, '/').replace(/:/g, '\\:');
}
const 벌려 = (s, 겹 = 1) => s.split('').join(' '.repeat(겹));

const 줄들 = [
  { 글: 벌려('SYNK LAB', 2), 서체: 'Medium', 크기: 78, y: 0.40, 색: Ink },
  { 글: 벌려('한국어 학원', 1), 서체: 'Regular', 크기: 34, y: 0.50, 색: Coral },
  { 글: 벌려('2027. 02. 11', 1), 서체: 'Regular', 크기: 30, y: 0.655, 색: Ink },
  { 글: 벌려('체험 2주', 1), 서체: 'Regular', 크기: 28, y: 0.715, 색: Ink },
];

(async () => {
  if (!fs.existsSync(바탕)) { console.log(`🔴 펠트 바탕이 없다: ${바탕}`); process.exit(1); }
  fs.mkdirSync(낼곳, { recursive: true });

  /* 바탕 = 펠트 천을 액자 크기로 자른다. 테두리는 «짙은 펠트 선» 두 겹으로 만든다
   * (실물 액자를 흉내내지 않는다 — 흉내는 09-01 에 탈락한 자리다). */
  const 필터 = [
    /* 바탕이 정사각(2000²)이라 «세로»를 기준으로 늘려야 액자 높이가 찬다. */
    `[0:v]scale=-1:${액자.h},crop=${액자.w}:${액자.h},eq=brightness=0.02:saturation=0.9,`
    + `drawbox=x=0:y=0:w=${액자.w}:h=${액자.h}:color=0x8D857A@0.9:t=7,`
    + `drawbox=x=26:y=26:w=${액자.w - 52}:h=${액자.h - 52}:color=0xC7BFB2@0.75:t=2,format=rgba[bg]`,
  ];
  let 앞 = '[bg]';
  줄들.forEach((줄, i) => {
    const 나감 = i === 줄들.length - 1 ? '[out]' : `[t${i}]`;
    필터.push(`${앞}drawtext=fontfile='${서체(줄.서체)}':text='${줄.글}':`
      + `fontsize=${줄.크기}:fontcolor=${줄.색}:x=(w-text_w)/2:y=h*${줄.y}${나감}`);
    앞 = 나감;
  });

  const 낼것 = path.join(낼곳, '펠트액자.png');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 바탕,
    '-filter_complex', 필터.join(';'), '-map', '[out]', '-frames:v', '1', 낼것]);

  const 확인 = path.join(낼곳, '_액자확인.jpg');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 낼것, '-vf', 'scale=470:-1', 확인]);
  console.log(`✅ ${낼것}  (${액자.w}×${액자.h})`);
  줄들.forEach((줄) => console.log(`   ${줄.크기}px  ${줄.글.replace(/ /g, '')}`));
})();
