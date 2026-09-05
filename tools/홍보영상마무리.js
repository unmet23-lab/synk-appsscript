#!/usr/bin/env node
/* 홍보영상의 «마무리 화면» — 명품 TV 광고의 엔딩 문법을 따른다.
 *
 * ■ 09-05 1차가 왜 탈락했나 (유호 「너무 촌스럽고 이상해 · 싸구려같아」)
 *   문구를 넉 줄 넣고 화면 가운데 몰아넣었다. 그건 «정보를 담은 카드»지 광고 엔딩이 아니다.
 *   조사해 보니 명품 광고의 엔딩은 정반대였다:
 *     · 에르메스 = 「vast, empty negative spaces 에 solitary object 하나」 — 로고 하나만 남긴다.
 *     · 여백이 곧 값이다 — 「the more breathing room, the more prestigious」.
 *     · 절제가 자신감이다 — 「luxury's restraint signals confidence」. 크게 외치면 싸구려가 된다.
 *     · 자간 — 「premium fonts feel breathable, spacing creating rhythm」.
 *     · 「typography can whisper louder than shouting」.
 *
 * ■ 그래서 이 판이 지키는 다섯
 *   ① 로고 하나가 주인공. 카피 문구를 없앴다(「한 명 한 명, 손으로」는 광고 카피라 탈락).
 *   ② 글자를 «작게». 로고 높이가 화면의 4% 남짓 — 커질수록 싸구려가 된다.
 *   ③ 자간을 넓힌다. drawtext 에 자간 옵션이 없어 글자 사이에 얇은 공백을 넣는다.
 *   ④ 정보(한국어·날짜)는 «속삭이는» 크기로, 투명도를 낮춰 로고를 안 건드린다.
 *   ⑤ 바탕은 어두운 펠트 실물. 앞 20초가 밝은 나무·빛이라 여기서 어두워지며 숨이 끊긴다.
 *      🔑 펠트 «질감»이 곧 우리 재질이다 — 장식 요소를 얹지 않는 것이 조사 결과와 맞다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 방 = path.join(뿌리, '영상', 'out', '홍보_4K_v2');
const 바탕 = path.join(뿌리, 'docs', 'Loom_자산', '구움', '펠트_어두운판.webp');

const Paper = '0xFBF7F0';      // 종이 — 어두운 면 위 글자
const 화면 = { w: 3840, h: 2160 };
const 길이 = 7.0;              // 어두워지고(1.2) 로고가 떠오르고(2.0) 머물고(1.8) 사라진다(2.0)

/** 자간을 넓힌다 — drawtext 에 옵션이 없어 글자 사이에 얇은 공백(U+2009)을 끼운다. */
const 벌려 = (s, 겹 = 1) => s.split('').join(' '.repeat(겹));

function 서체(이름) {
  const 원본 = path.join(뿌리, 'docs', '브랜드_폰트', 'SUIT', `SUIT-${이름}.otf`);
  const 사본 = path.join(os.tmpdir(), `synk_suit_${이름.toLowerCase()}.otf`);
  if (!fs.existsSync(사본)) fs.copyFileSync(원본, 사본);
  return 사본.replace(/\\/g, '/').replace(/:/g, '\\:');
}

/* 로고가 주인공이고 나머지 둘은 «속삭인다». 크기 비는 100 : 34 : 27 이다. */
const 줄들 = [
  { 글: 벌려('SYNK LAB', 3), 서체: 'Medium', 크기: 96, y: 0.448, 뜸: 1.2, 투명도: 1.00 },
  /* 🔴 09-05 유호 지적 「영상 내용이 한국어 어학원이라는 느낌이 좀 없어」 — 「한국어」 한 낱말로는
   *   과목만 말하고 «학원»이 안 전달됐다. 두 글자를 더한다. 이 정도로는 최소화가 안 깨진다. */
  { 글: 벌려('한국어 학원', 2), 서체: 'Regular', 크기: 34, y: 0.556, 뜸: 2.0, 투명도: 0.58 },
  /* 「체험 2주」를 같이 적는다 — 날짜만 있으면 무슨 날인지 모른다.
   * 「파일럿」은 우리 안에서 리허설을 가리키는 말이라 대외 문구에 쓰지 않는다. */
  { 글: 벌려('2027. 02. 11   체험 2주', 1), 서체: 'Regular', 크기: 30, y: 0.735, 뜸: 2.6, 투명도: 0.50 },
];

(async () => {
  if (!fs.existsSync(바탕)) { console.log(`🔴 어두운 펠트 바탕이 없다: ${바탕}`); process.exit(1); }

  /* 바탕: 정사각 펠트를 16:9 로 «잘라» 넣고(늘이면 결이 뭉갠다), 한 번 더 어둡게 눌러
   * 글자만 남는 무대를 만든다. 결은 남기되 존재를 낮춘다. */
  const 필터 = [`[0:v]scale=${화면.w}:-1,crop=${화면.w}:${화면.h},`
    + `eq=brightness=-0.06:contrast=0.88:saturation=0.7,format=rgba[bg]`];

  let 앞 = '[bg]';
  줄들.forEach((줄, i) => {
    const 나감 = i === 줄들.length - 1 ? '[out]' : `[t${i}]`;
    /* 로고가 먼저 떠오르고 정보가 뒤따른다. 다 함께 마지막 2초에 사라진다. */
    const 뜸 = 줄.뜸; const 오름 = 1.8; const 끝 = 길이 - 2.0;
    const 알파 = `if(lt(t,${뜸}),0,`
      + `if(lt(t,${(뜸 + 오름).toFixed(2)}),(t-${뜸})/${오름}*${줄.투명도},`
      + `if(lt(t,${끝}),${줄.투명도},${줄.투명도}*(1-(t-${끝})/2))))`;
    필터.push(`${앞}drawtext=fontfile='${서체(줄.서체)}':text='${줄.글}':`
      + `fontsize=${줄.크기}:fontcolor=${Paper}:x=(w-text_w)/2:y=h*${줄.y}:`
      + `alpha='${알파}'${나감}`);
    앞 = 나감;
  });

  const 낼것 = path.join(방, '마무리.mp4');
  fs.mkdirSync(방, { recursive: true });
  console.log(`■ 마무리 ${길이}초 · ${화면.w}×${화면.h} · 어두운 펠트`);
  줄들.forEach((줄) => console.log(`   ${줄.크기}px  ${줄.글.replace(/ /g, '')}`));

  execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
    '-loop', '1', '-t', String(길이), '-i', 바탕,
    '-filter_complex', 필터.join(';'), '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', '24',
    낼것], { stdio: ['ignore', 'inherit', 'inherit'] });

  console.log(`\n✅ ${낼것}  (${(fs.statSync(낼것).size / 1024 / 1024).toFixed(1)} MB)`);
})();
