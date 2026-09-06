#!/usr/bin/env node
/* 프로필굽기 — SNS 프로필 이미지(정사각 PNG)를 로고 정본 하나에서 굽는다.
 *
 * 왜 있나 (유호 지시 2026-08-28 「synkbrief 프로필 이미지 구워줘」):
 *   계정이 다섯 자리에 서고(콘텐츠_배분 §8) 자리마다 같은 얼굴이 필요하다. 손으로 만들면
 *   자리마다 갈린다 — 마스코트 10벌 실측이 그 값을 이미 냈다. 그래서 도형은 `lib/로고정본.js`
 *   한 곳에서만 오고, 여기는 «바탕·크기·크롭 안전»만 정한다.
 *
 * 🔴 프로필의 진짜 제약 둘 — 이게 이 파일이 존재하는 까닭이다:
 *   ① **원으로 잘린다.** 다섯 자리(인스타·유튜브·틱톡·스레드·링크드인) 전부 원형 크롭이라
 *      정사각 모서리는 «반드시» 사라진다. 안전 지름 = 캔버스의 100%이고, 가로로 긴 워드마크는
 *      그 원 안에 들어가려고 작아진다 — 그래서 기호·도장이 워드마크보다 유리하다.
 *   ② **아주 작게 뜬다.** 인스타 피드 32px · 검색 44px · 프로필 지면 90px 남짓.
 *      1080 으로 굽되 판정은 32px 로 한다(시안 지면이 그 크기를 같이 낸다).
 *
 * 사용:
 *   node tools/프로필굽기.js                     네 안 전부 + 시안 지면
 *   node tools/프로필굽기.js --안 도장코랄       한 안만
 *   node tools/프로필굽기.js --크기 1080         (기본 1080)
 *   출력 = docs/SHIFT/프로필/<안>.png · 시안 = docs/SHIFT/프로필/시안.html
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { 색, defs, 도장, 기호, 워드마크 } = require('./lib/로고정본.js');
const 마스코트자산 = require('./lib/마스코트자산.js');
/* 브랜드 서체(SUIT)는 «굽기»가 지면 안에 싣는다 — 이름만 부르고 안 실으면 막힌 적이 없어
 * 경고도 안 뜨고 그냥 시스템 고딕으로 떨어진다(tests/지면폰트.test.js ⑦ · 정본 lib/브랜드폰트.js). */
const 브랜드폰트 = require('./lib/브랜드폰트.js');

const ROOT = path.resolve(__dirname, '..');
const 낼곳 = path.join(ROOT, 'docs/SHIFT/프로필');

/* 두 보정 — 눈으로 잡은 것이 아니라 정본이 이미 아는 값이다.
 * ① 세로: 도장 viewBox 는 `0 0 120 126` 인데 배지 «원»의 중심은 cy=58 이다(아래 6단위는 접지 그림자
 *    자리). 캔버스 중심 63 과 5 단위 어긋나 있어, 그대로 두면 원형 크롭에서 배지가 위로 뜨고
 *    아래만 비어 보인다 — 08-28 렌더 눈검증. 5/126 ≈ 4.0% 내린다.
 * ② 가로: 꺾쇠는 꼭짓점이 왼쪽이라 시각 무게가 오른쪽으로 쏠린다. 도장 함수가 그 보정을
 *    `translate(-3.6,0)` 로 이미 쥐고 있는데(로고정본 주석 「광학 중심 · 렌더 눈검증 08-24」),
 *    기호를 «맨몸»으로 쓰는 ③에는 그 보정이 안 따라온다. 기호 viewBox 폭 66 기준 3.6 = 5.45%. */
const 도장세로보정 = '4.0%';
const 기호가로보정 = '-5.45%';

/** 안 넷 — 바탕과 «무엇을 얹나»만 다르다. 도형은 전부 정본에서 온다. */
const 안들 = {
  도장양모: {
    이름: '① 도장 · 양모 바탕',
    설명: '펠트 배지 그대로. 실땀 테두리가 원 안에 살아 있다',
    바탕: 색['Paper'],
    속: (px) => 도장({ px: Math.round(px * 0.86) }),
    밀기: `translateY(${도장세로보정})`,
  },
  도장밤: {
    이름: '② 도장 · 밤 바탕',
    설명: '같은 배지, 어두운 바탕. 흰 피드에서 원이 또렷하다',
    바탕: 색['Ink Deep'],
    속: (px) => 도장({ px: Math.round(px * 0.86) }),
    밀기: `translateY(${도장세로보정})`,
    /* 🔴 09-01 에 잠깐 `@yuhobuilds` 확정이었다가 같은 날 ④로 넘어갔다(유호 픽 「밤워드마크로 바꿔줘」).
     *   가른 것은 «구별»이다 — 이 배지는 `@synkbrief`(⑤)와 같은 그림이라 32px 에서 바탕색으로만
     *   갈렸다. 두 채널이 나란히 뜨는 자리(계정 전환·댓글)에서는 그 차이가 안 읽힌다. */
  },
  코랄기호: {
    이름: '③ 코랄 면 · 기호',
    설명: '원형 크롭과 정확히 맞는다. 32px 에서 가장 오래 버틴다',
    바탕: 색['Coral'],
    속: (px) => 기호({ px: Math.round(px * 0.52), 색값: 색['Paper'], 펠트: false }),
    땀: true,
    밀기: `translateX(${기호가로보정})`,
  },
  밤워드마크: {
    이름: '④ 밤 바탕 · 워드마크',
    설명: '이름이 읽힌다. 다만 원 안에 넣느라 작아진다',
    바탕: 색['Ink Deep'],
    속: (px) => 워드마크({ 판: '다크', 표현: '펠트', 색갈래: '코랄' }),
    /* 🔑 폭 0.62 → 0.80 (확정되던 날 · 09-01). 후보일 때는 «비교용»이라 작아도 됐지만,
     *   프로필이 되는 순간 판정 자리가 32px 로 바뀐다 — 거기서 「synk」가 읽혀야 한다.
     *   원 안에 들어가는 한계는 폭이 아니라 «대각선»이다: 워드마크 종횡비 ≈3.3:1 이므로
     *   √(w² + (w/3.3)²) ≤ D → w ≤ 0.95·D. 0.80 은 그 안에서 가장자리 숨통을 남긴 값이다.
     *   ⚠ 원형 크롭이라 «폭»만 보고 키우면 모서리가 잘린다 — 대각선으로 셈해야 맞는다. */
    폭: 0.80,
    확정: 'yuhobuilds_프로필',
  },
  도장꽉: {
    이름: '⑤ 도장 · 꽉 채움 — ✅ 확정 (08-28)',
    설명: '①의 흰 링을 없앤 판. 배지 자체가 프로필이 된다 · 업로드본 = synkbrief_프로필.png',
    바탕: 색['Paper'],
    속: (px) => 도장({ px: Math.round(px * 1.02) }),
    밀기: `translateY(${도장세로보정})`,
    확정: 'synkbrief_프로필',
  },
  몽글양모: {
    이름: '⑥ 몽글 · 양모 바탕 — ✅ 확정 (09-01) · @synkkorean (SYNK LAB)',
    설명: '학생이 아는 얼굴. 코랄 몽글이 양모 위에서 또렷하다 · 업로드본 = synklab_프로필.png',
    바탕: 색['Paper'],
    속: (px) => 마스코트(),
    배율: 1.22,
    /* 🔑 학생 접점 채널의 얼굴은 **로고가 아니라 마스코트**다 — 몽골 학생이 아는 것은 `synk` 라는
     *   글자가 아니라 몽글이고, 32px 목록에서도 «누구»인지가 먼저 읽힌다. 같은 배너·같은 천을
     *   쓰면서 프로필만 이렇게 갈리는 까닭이 그것이다(SHIFT 두 자리는 도장이 맞다). */
    확정: 'synklab_프로필',
  },
  몽글밤: {
    이름: '⑦ 몽글 · 밤 바탕',
    설명: '같은 얼굴, 대비가 가장 크다',
    바탕: 색['Ink Deep'],
    속: (px) => 마스코트(),
    배율: 1.22,
  },
  몽글크게: {
    이름: '⑧ 몽글 · 최대로 키운 판 <한계 시험>',
    설명: '32px 에서 살리려고 1.45배까지 키웠다 — 치맛단이 원 밖으로 나간다',
    바탕: 색['Paper'],
    속: (px) => 마스코트(),
    배율: 1.45,
    한계: true,
  },
  몽글코랄: {
    이름: '⑨ 몽글 · 코랄 바탕 <반례>',
    설명: '🚫 킷이 막는 자리 — 몽글이 코랄 펠트라 같은 코랄 면 위에서 윤곽이 먹힌다',
    바탕: 색['Coral'],
    속: (px) => 마스코트(),
    배율: 1.22,
    반례: true,
  },
};

/** 몽글 누끼 — 경로는 `lib/마스코트자산.js` 한 창구에서만 온다(마스코트 10벌 공존의 교훈).
 *  표정은 «눈웃음» — 프로필은 인사하는 얼굴이다. */
function 마스코트() {
  const p = 마스코트자산.절대경로('눈웃음', { 누끼: true });
  const b64 = fs.readFileSync(p).toString('base64');
  return `<img src="data:image/png;base64,${b64}" alt="몽글" data-synk-mascot style="width:100%;height:auto;display:block">`;
}

/** 한 안의 자립형 HTML. 원형 크롭 안내선은 굽지 않는다(시안 지면에서만 그린다). */
function 지면(안, px) {
  const a = 안들[안];
  const 땀 = a.땀 ? `<svg class="땀" viewBox="0 0 120 120" aria-hidden="true">${defs()}
    <g filter="url(#sl-soft)">
      <circle cx="60" cy="60" r="50" fill="none" stroke="${색['Stitch']}" stroke-width="1.6"
        stroke-dasharray="4.6 3.8 4.1 4.3 3.7 4.4" stroke-linecap="round" opacity="0.72"/>
    </g></svg>` : '';
  /* 🔑 키우기는 «폭»이 아니라 «배율»로 한다 — width:130% 를 주면 요소가 판을 넘어
   *    grid 중앙 정렬이 넘친 쪽으로 밀린다(08-28 실측: 몽글이 오른쪽 아래로 빠졌다).
   *    transform:scale 은 «중심»을 기준으로 커져서 정렬이 그대로 남는다. */
  const 폭 = a.폭 ? `width:${Math.round(px * a.폭)}px;` : '';
  const 변형 = [a.배율 ? `scale(${a.배율})` : '', a.밀기 || ''].filter(Boolean).join(' ');
  const 밀기 = 변형 ? `transform:${변형};` : '';
  return `<!doctype html><meta charset="utf-8">
<style>
  /* 낫표 「 」 교정 — 값의 정본 = docs/디자인_토큰.json 「서체.낫표교정」(유호 확정 08-31). 스택보다 먼저 선다. */
  @font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Apple SD Gothic Neo'),local('Noto Sans KR'),local('Noto Sans CJK KR');unicode-range:U+300C-300D;}
  html,body{margin:0;padding:0;background:${a.바탕};}
  .판{width:${px}px;height:${px}px;display:grid;place-items:center;position:relative;overflow:hidden;background:${a.바탕};}
  .속{position:relative;z-index:2;${폭}${밀기}}
  .속 svg{width:100%;height:auto;display:block;}
  .땀{position:absolute;inset:0;width:100%;height:100%;z-index:1;}
</style>
<div class="판">${땀}<div class="속">${a.속(px)}</div></div>`;
}

function 크롬() {
  const 후보 = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(fs.existsSync);
  if (!후보.length) throw new Error('크롬을 못 찾았다 — 후보 2곳에 없다');
  return 후보[0];
}

function 굽기(안, px) {
  const src = path.join(낼곳, `_${안}.html`);
  const png = path.join(낼곳, `${안}.png`);
  fs.writeFileSync(src, 지면(안, px), 'utf8');
  const r = spawnSync(크롬(), ['--headless=new', '--disable-gpu', '--force-device-scale-factor=1',
    '--hide-scrollbars', `--window-size=${px},${px}`, `--screenshot=${png}`,
    'file:///' + src.replace(/\\/g, '/')], { encoding: 'utf8' });
  if (!fs.existsSync(png)) throw new Error(`굽기 실패: ${안}\n${r.stderr || ''}`);
  fs.unlinkSync(src);
  return { 안, png, 바이트: fs.statSync(png).size };
}

/** 시안 지면 — 유호님이 «작은 크기»로 고르시는 자리. 판정 축은 1080 이 아니라 32px 이다.
 *
 * 🔴 data URI 는 «한 번만» 적는다. 첫 판은 같은 PNG 를 안마다 7곳(큰 것 1 + 미리보기 6)에
 *    통째로 박아 시안이 **13.7MB** 가 됐다(08-28 실측). base64 는 1.33배로 부는데 거기에 7을
 *    곱한 값이다. CSS 커스텀 프로퍼티에 한 번 정의하고 `background-image` 로 참조하면 1/7 이 된다.
 *    ⚠ 변수 이름은 **ASCII** 로 짓는다 — 바깥으로 «키»로 나가는 낱말의 자리다. */
function 시안(굽힌것) {
  const 키 = {};
  굽힌것.forEach(({ 안, png }, i) => {
    키[안] = `--p${i + 1}`;
  });
  const 변수 = 굽힌것.map(({ 안, png }) =>
    `    ${키[안]}:url("data:image/png;base64,${fs.readFileSync(png).toString('base64')}");`).join('\n');

  const 칸 = 굽힌것.map(({ 안 }) => {
    const a = 안들[안];
    const v = `background-image:var(${키[안]})`;
    const 미리 = [32, 44, 90].map((s) =>
      `<figure><i class="썸" style="width:${s}px;height:${s}px;${v}"></i><figcaption>${s}px</figcaption></figure>`).join('');
    return `<section class="안">
  <h2>${a.이름}</h2>
  <p class="설명">${a.설명}</p>
  <div class="줄">
    <div class="큰"><i class="썸 판" style="${v}" role="img" aria-label="${a.이름}"></i><span class="테">원형 크롭</span></div>
    <div class="미리들">
      <div class="작은 낮"><span class="띠">밝은 피드</span>${미리}</div>
      <div class="작은 밤"><span class="띠">어두운 피드</span>${미리}</div>
    </div>
  </div>
  <p class="파일"><code>docs/SHIFT/프로필/${안}.png</code></p>
</section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>synkbrief 프로필 — 네 안</title>
${브랜드폰트.블록()}
<style>
  /* 낫표 「 」 교정 — 값의 정본 = docs/디자인_토큰.json 「서체.낫표교정」(유호 확정 08-31). 스택보다 먼저 선다. */
  @font-face{font-family:'SYNK Bracket';src:local('Malgun Gothic'),local('Apple SD Gothic Neo'),local('Noto Sans KR'),local('Noto Sans CJK KR');unicode-range:U+300C-300D;}
  :root{--paper:${색['Paper']};--ink:${색['Ink']};--inkdeep:${색['Ink Deep']};
    --stitch:${색['Stitch']};--coral:${색['Coral']};--coral3:${색['Coral 3']};--stone:${색['Stone']};--ash:${색['Ash Wool']};
${변수}
  }
  .썸{display:block;border-radius:50%;background-size:cover;background-position:center;background-repeat:no-repeat;}
  body{margin:0;padding:40px 24px 72px;background:var(--inkdeep);color:var(--paper);
    font-family:'SYNK Bracket','Inter Tight','SUIT Variable',system-ui,'Malgun Gothic',sans-serif;}
  .지면{max-width:960px;margin:0 auto;}
  h1{font-size:1.9rem;font-weight:800;letter-spacing:-.03em;margin:0 0 8px;}
  .머리{color:var(--stone);font-size:.95rem;line-height:1.7;margin:0 0 40px;}
  .머리 b{color:var(--paper);}
  .안{padding:24px;margin:0 0 20px;border-radius:18px;
    background:rgba(228,228,231,.045);box-shadow:inset 0 0 0 1px rgba(228,228,231,.12);}
  .안 h2{font-size:1.05rem;font-weight:800;margin:0 0 4px;}
  .설명{color:var(--stone);font-size:.88rem;margin:0 0 18px;}
  .줄{display:flex;gap:32px;align-items:center;flex-wrap:wrap;}
  .큰{position:relative;}
  .큰 .판{width:180px;height:180px;box-shadow:0 10px 30px -12px rgba(0,0,0,.9);}
  .큰 .테{position:absolute;left:0;right:0;bottom:-22px;text-align:center;
    font-size:.72rem;color:var(--ash);}
  .미리들{display:flex;flex-direction:column;gap:12px;}
  .작은{display:flex;gap:20px;align-items:flex-end;padding:12px 18px;border-radius:14px;position:relative;}
  .작은.낮{background:var(--paper);}
  .작은.밤{background:#0f0f11;box-shadow:inset 0 0 0 1px rgba(228,228,231,.14);}
  .작은 figure{margin:0;text-align:center;}
  .작은 .썸{margin:0 auto 6px;}
  .작은 figcaption{font-size:.68rem;}
  .작은.낮 figcaption{color:#6b6459;}
  .작은.밤 figcaption{color:var(--stone);}
  .띠{align-self:center;font-size:.7rem;letter-spacing:.02em;white-space:nowrap;min-width:62px;}
  .작은.낮 .띠{color:#6b6459;}
  .작은.밤 .띠{color:var(--ash);}
  .파일{margin:22px 0 0;font-size:.78rem;color:var(--ash);}
  code{font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:.92em;}
  .꼬리{margin-top:36px;color:var(--stone);font-size:.86rem;line-height:1.75;}
  .꼬리 b{color:var(--paper);}
</style></head>
<body><div class="지면">
<h1>synkbrief 프로필 — 네 안</h1>
<p class="머리">도형은 전부 <b>로고 정본</b>에서 나왔고(<code>tools/lib/로고정본.js</code>), 바탕만 다릅니다.
다시 구우려면 <code>node tools/프로필굽기.js</code>.<br>
🔴 <b>판정은 왼쪽 큰 것이 아니라 오른쪽 작은 것으로 하십시오</b> — 인스타 피드에서 실제로 보이는 크기는 <b>32px</b>입니다.
그리고 다섯 자리 전부 <b>원으로 자릅니다</b>. 네모 모서리는 어디서도 안 보입니다.</p>
${칸}
<p class="꼬리">
<b>제 픽 = ③ 코랄 면 · 기호</b> — 원형 크롭과 정확히 맞아 32px 에서 가장 오래 버티고,
코랄이 브랜드 신호색이라 흰 피드·검은 피드 어디서든 눈에 걸립니다.
①②는 배지의 결이 살아 좋지만 <b>실땀이 32px 에서 사라집니다</b>(작은 크기에서는 ③과 거의 같아 보입니다).
④는 이름이 읽히는 대신 원 안에 들어가느라 작아지는데, 표시 이름이 이미 「SYNK 브리핑」이라 <b>같은 말을 두 번 하는 자리</b>입니다.
</p>
</div></body></html>`;
}

function main() {
  const argv = process.argv.slice(2);
  const px = Number((argv[argv.indexOf('--크기') + 1] || 0)) || 1080;
  const 하나 = argv.includes('--안') ? argv[argv.indexOf('--안') + 1] : null;
  if (하나 && !안들[하나]) throw new Error(`모르는 안: ${하나} (있는 것: ${Object.keys(안들).join(' · ')})`);

  fs.mkdirSync(낼곳, { recursive: true });
  const 목록 = 하나 ? [하나] : Object.keys(안들);
  const 굽힌것 = 목록.map((안) => {
    const r = 굽기(안, px);
    console.log(`✅ ${안.padEnd(10)} ${px}×${px} · ${(r.바이트 / 1024).toFixed(0)}KB`);
    return r;
  });

  /* 확정된 안은 «업로드본» 이름으로 한 벌 더 남긴다 — 유호님이 다섯 자리에 올리실 파일이
   * 후보 이름(`도장꽉.png`)이면 어느 것이 확정인지 파일 이름이 말하지 않는다.
   * 이 한 벌만 git 이 쥔다(나머지 후보는 .gitignore · 시안이 품고 있다). */
  /* 🔴 `find` 였다 — 확정이 «하나뿐»이라는 가정이 박혀 있었고, 채널이 셋이 되자
   *    그 가정이 조용히 나머지를 버렸다(배너굽기에서도 같은 자리를 고쳤다 · 09-01). */
  const 확정들 = 굽힌것.filter(({ 안 }) => 안들[안].확정);
  for (const 확정안 of 확정들) {
    const 업로드본 = path.join(낼곳, `${안들[확정안.안].확정}.png`);
    fs.copyFileSync(확정안.png, 업로드본);
    console.log(`\n🏷  확정 = ${path.relative(ROOT, 업로드본)} (← ${확정안.안})`);
  }

  if (!하나) {
    const s = path.join(낼곳, '시안.html');
    fs.writeFileSync(s, 시안(굽힌것), 'utf8');
    console.log(`📄 시안 = ${path.relative(ROOT, s)} — 32px 로 고르십시오`);
  }
  console.log(`\n[프로필굽기] ${굽힌것.length}벌 · ${path.relative(ROOT, 낼곳)}`);
}

main();
