#!/usr/bin/env node
/* 배너굽기 — 유튜브 채널 배너를 로고 정본 하나에서 굽는다. (유호 지시 2026-08-28)
 *
 * 🔑 «배너»와 «채널아트»는 같은 것이다 — 유튜브가 옛 이름(채널 아트)을 버리고
 *   지금은 고객센터에서도 「배너 이미지」 하나로 부른다. 파일도 하나만 올린다.
 *
 * 🔴 규격 — 2026-08-28 유튜브 고객센터 «원문 실측»(support.google.com/youtube/answer/10456525):
 *   · 업로드 최소: 16:9 의 **2048×1152**
 *   · 권장(특히 TV 화면을 염두에 둘 경우): **2560×1440**  ← 여기서 굽는 크기
 *   · **텍스트·로고가 잘리지 않는 최소 크기: 1235×338**  ← 이 파일의 존재 이유
 *   · 파일 크기 6MB 이하
 *   ⚠ 데스크톱·모바일이 «각각» 몇 픽셀을 보여주는지는 **공식 문서에 없다**(안 재봤다).
 *     흔히 도는 2560×423 은 출처를 못 찾았으므로 여기 쓰지 않는다 —
 *     확실한 것은 1235×338 하나뿐이고, 그 안에만 넣으면 어디서도 안 잘린다.
 *
 * 🔑 그래서 배너 디자인의 전부는 이것이다: **캔버스의 48%×23% 짜리 가운데 띠.**
 *   대부분의 채널이 이걸 몰라서 큰 화면에서만 멀쩡하고 폰에서 글자가 잘린다.
 *   바깥 영역은 «분위기»만 진다 — 글자도 로고도 두지 않는다.
 *
 * 사용:
 *   node tools/배너굽기.js               안 전부 + 시안 지면
 *   node tools/배너굽기.js --안 밤       한 안만
 *   node tools/배너굽기.js --안내선      안전 영역을 그려 넣은 «검수용» 판도 같이 굽는다
 *   출력 = docs/SHIFT/배너/<안>.png · 시안 = docs/SHIFT/배너/시안.html
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { 색, defs, 기호, 워드마크 } = require('./lib/로고정본.js');

const ROOT = path.resolve(__dirname, '..');
const 낼곳 = path.join(ROOT, 'docs/SHIFT/배너');

const W = 2560, H = 1440;          // 권장 크기(TV 포함)
const 안전W = 1235, 안전H = 338;    // 어디서도 안 잘리는 띠

/** 문안 — 공개선 12칸을 지난다.
 *  ⑫ 기본 시제 = 「짓고 있습니다」 · ⑩ 돈 ✗ · ⑪ 일의 숫자는 배너에 안 쓴다(안 바뀌는 자리라 낡는다).
 *  ⚠ 업로드 주기도 안 쓴다 — 아직 확정이 아니고(첫 3편 실측 뒤), 박으면 못 지키는 날 거짓말이 된다. */
const 큰줄 = 'AI로 교육 회사를 짓고 있습니다';
const 작은줄 = '학원 하나를 혼자 짓는 실황';

const 안들 = {
  밤: {
    이름: '① 밤 바탕',
    설명: '유튜브 기본이 다크라 화면에 이어 붙는다',
    바탕: 색['Ink Deep'],
    글자: 색['Paper'],
    보조: 색['Stone'],
    로고: () => 워드마크({ 판: '다크', 표현: '펠트', 색갈래: '코랄' }),
  },
  양모: {
    이름: '② 양모 바탕',
    설명: '브랜드 지면과 같은 결. 다크 UI 위에서 카드처럼 뜬다',
    바탕: 색['Paper'],
    글자: 색['Ink'],
    보조: color('Ash Wool'),
    로고: () => 워드마크({ 판: '라이트', 표현: '펠트', 색갈래: '코랄' }),
  },
  밤기호: {
    이름: '③ 밤 바탕 · 기호 워터마크',
    설명: '바깥 영역에 꺾쇠를 크게 눕혔다 — 큰 화면에서만 보이는 덤',
    바탕: 색['Ink Deep'],
    글자: 색['Paper'],
    보조: 색['Stone'],
    로고: () => 워드마크({ 판: '다크', 표현: '펠트', 색갈래: '코랄' }),
    워터마크: true,
  },
};

function color(k) { return 색[k]; }

/** 한 안의 자립형 HTML. `안내선` 이 참이면 안전 영역을 그린다(검수용 · 업로드본에는 안 넣는다). */
function 지면(안, 안내선) {
  const a = 안들[안];
  const 워터 = a.워터마크 ? `<div class="워터">${기호({ px: 1180, 색값: 색['Coral'], 펠트: false, 투명도: 0.085 })}</div>` : '';
  const 선 = 안내선 ? `<div class="안전선"><span>안전 영역 ${안전W}×${안전H} — 여기 밖은 기기에 따라 잘린다</span></div>` : '';
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:${a.바탕};}
  .판{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${a.바탕};
    display:grid;place-items:center;
    font-family:'Inter Tight','SUIT Variable',system-ui,'Malgun Gothic',sans-serif;}
  /* 바깥 영역은 «분위기»만 — 글자도 로고도 두지 않는다. */
  .결{position:absolute;inset:0;z-index:0;
    background:radial-gradient(ellipse 62% 78% at 50% 50%, ${a.바탕} 0%, ${a.바탕} 46%, rgba(0,0,0,0.16) 100%);}
  .워터{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1;
    display:grid;place-items:center;}
  .워터 svg{display:block;}
  /* 안전 영역 — 모든 글자가 여기 «안»에 있다.
   * 🔴 overflow:hidden 이 이 파일의 안전장치다. 첫 판은 내용(로고 212 + 큰줄 109 + 작은줄 55 + 간격 68
   *    = 444px)이 338 을 넘겼는데, flex 는 넘친 것을 «바깥으로 밀어» 조용히 안전 영역 밖에 세웠다
   *    — 큰 화면에서는 멀쩡해 보이고 폰에서만 잘린다(08-28 실측 · 안내선 판에서 잡았다).
   *    이제 넘치면 그 자리에서 «잘려» 보이므로 눈검증이 반드시 잡는다.
   *    아래 크기는 합이 316px 로 22px 여유를 둔 값이다 — 문안을 늘리면 이 셈을 다시 한다. */
  .속{position:relative;z-index:3;width:${안전W}px;height:${안전H}px;overflow:hidden;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;}
  .로고{width:190px;}
  .로고 svg{width:100%;height:auto;display:block;}
  .큰{font-size:80px;font-weight:800;letter-spacing:-0.035em;line-height:1.14;color:${a.글자};margin:0;}
  .작은{font-size:36px;font-weight:500;letter-spacing:-0.01em;color:${a.보조};margin:0;}
  .안전선{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;
    width:${안전W}px;height:${안전H}px;box-sizing:border-box;
    border:3px dashed rgba(249,104,89,.85);border-radius:8px;}
  .안전선 span{position:absolute;left:0;top:-46px;font-size:26px;color:#F96859;white-space:nowrap;}
</style>
<div class="판">
  <div class="결"></div>${워터}${선}
  <div class="속">
    <div class="로고">${a.로고()}</div>
    <p class="큰">${큰줄}</p>
    <p class="작은">${작은줄}</p>
  </div>
</div>`;
}

function 크롬() {
  const 후보 = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(fs.existsSync);
  if (!후보.length) throw new Error('크롬을 못 찾았다 — 후보 2곳에 없다');
  return 후보[0];
}

function 굽기(안, 안내선) {
  const 이름 = 안내선 ? `${안}_안내선` : 안;
  const src = path.join(낼곳, `_${이름}.html`);
  const png = path.join(낼곳, `${이름}.png`);
  fs.writeFileSync(src, 지면(안, 안내선), 'utf8');
  const r = spawnSync(크롬(), ['--headless=new', '--disable-gpu', '--force-device-scale-factor=1',
    '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${png}`,
    'file:///' + src.replace(/\\/g, '/')], { encoding: 'utf8' });
  if (!fs.existsSync(png)) throw new Error(`굽기 실패: ${이름}\n${r.stderr || ''}`);
  fs.unlinkSync(src);
  const 바이트 = fs.statSync(png).size;
  /* 6MB 는 유튜브가 거절하는 선이다 — 넘으면 조용히 두지 않고 그 자리에서 말한다. */
  const 넘음 = 바이트 > 6 * 1024 * 1024;
  return { 안: 이름, png, 바이트, 넘음 };
}

/** 시안 — 판정 자리. data URI 는 «한 번만» 적는다(프로필 시안이 13.7MB 로 부은 그 함정). */
function 시안(굽힌것) {
  const 키 = {};
  굽힌것.forEach(({ 안 }, i) => { 키[안] = `--b${i + 1}`; });
  const 변수 = 굽힌것.map(({ 안, png }) =>
    `    ${키[안]}:url("data:image/png;base64,${fs.readFileSync(png).toString('base64')}");`).join('\n');

  const 칸 = 굽힌것.map(({ 안, 바이트, 넘음 }) => {
    const a = 안들[안] || { 이름: 안, 설명: '' };
    const v = `background-image:var(${키[안]})`;
    return `<section class="안">
  <h2>${a.이름}</h2>
  <p class="설명">${a.설명}</p>
  <div class="띠줄"><span class="라벨">전체 (TV·큰 화면)</span><i class="배너" style="${v}"></i></div>
  <div class="띠줄"><span class="라벨">안전 영역만 (어디서도 안 잘리는 부분)</span>
    <i class="잘린띠" style="${v}"></i></div>
  <p class="파일"><code>docs/SHIFT/배너/${안}.png</code> · ${(바이트 / 1048576).toFixed(2)}MB
    ${넘음 ? '<b class="빨강">🔴 6MB 초과 — 유튜브가 거절한다</b>' : '<span class="초록">✅ 6MB 이하</span>'}</p>
</section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>yuhobuilds 유튜브 배너 — 세 안</title>
<style>
  :root{--paper:${색['Paper']};--inkdeep:${색['Ink Deep']};--coral:${색['Coral']};
    --stone:${색['Stone']};--ash:${색['Ash Wool']};
${변수}
  }
  body{margin:0;padding:40px 24px 72px;background:var(--inkdeep);color:var(--paper);
    font-family:'Inter Tight','SUIT Variable',system-ui,'Malgun Gothic',sans-serif;}
  .지면{max-width:1000px;margin:0 auto;}
  h1{font-size:1.9rem;font-weight:800;letter-spacing:-.03em;margin:0 0 8px;}
  .머리{color:var(--stone);font-size:.95rem;line-height:1.7;margin:0 0 36px;}
  .머리 b{color:var(--paper);}
  .안{padding:24px;margin:0 0 20px;border-radius:18px;
    background:rgba(228,228,231,.045);box-shadow:inset 0 0 0 1px rgba(228,228,231,.12);}
  .안 h2{font-size:1.05rem;font-weight:800;margin:0 0 4px;}
  .설명{color:var(--stone);font-size:.88rem;margin:0 0 18px;}
  .띠줄{margin:0 0 16px;}
  .라벨{display:block;font-size:.76rem;color:var(--ash);margin:0 0 6px;}
  .배너{display:block;width:100%;aspect-ratio:${W}/${H};border-radius:10px;
    background-size:cover;background-position:center;}
  /* 안전 영역만 보여 주는 띠 — 배너를 확대해 가운데 1235×338 만 창에 남긴다. */
  .잘린띠{display:block;width:100%;aspect-ratio:${안전W}/${안전H};border-radius:10px;
    background-size:${(W / 안전W * 100).toFixed(2)}% auto;background-position:center;
    box-shadow:inset 0 0 0 2px rgba(249,104,89,.5);}
  .파일{margin:14px 0 0;font-size:.78rem;color:var(--ash);}
  .빨강{color:#FD9C87;} .초록{color:var(--stone);}
  code{font-family:'DM Mono',ui-monospace,Consolas,monospace;font-size:.92em;}
  .꼬리{margin-top:32px;color:var(--stone);font-size:.86rem;line-height:1.75;}
  .꼬리 b{color:var(--paper);}
</style></head>
<body><div class="지면">
<h1>yuhobuilds 유튜브 배너 — 세 안</h1>
<p class="머리"><b>배너와 채널아트는 같은 것입니다</b> — 유튜브가 옛 이름(채널 아트)을 버리고 지금은 「배너 이미지」 하나로 부릅니다. 올리는 파일도 하나입니다.<br>
규격은 2026-08-28 에 유튜브 고객센터 원문으로 확인했습니다: 권장 <b>2560×1440</b>(TV 포함) · 최소 2048×1152 · <b>글자가 안 잘리는 영역 1235×338</b> · 6MB 이하.<br>
🔴 <b>판정은 아래 «안전 영역만» 줄로 하십시오</b> — 캔버스의 48%×23% 짜리 가운데 띠이고, 폰에서 보이는 것이 그것입니다.
다시 구우려면 <code>node tools/배너굽기.js</code>.</p>
${칸}
<p class="꼬리">
<b>바깥 영역에는 글자도 로고도 두지 않았습니다</b> — 큰 화면에서만 보이는 자리라 거기에 뜻을 실으면 폰에서 그 뜻이 사라집니다. 대신 «분위기»(가장자리로 갈수록 어두워지는 결)만 넣었고, ③은 꺾쇠를 크게 눕혀 큰 화면의 덤으로 뒀습니다.<br>
<b>업로드 주기는 안 적었습니다</b> — 아직 확정이 아니고(첫 3편 실측 뒤), 배너에 박으면 못 지키는 날 그것이 거짓말이 됩니다. 같은 이유로 「곧 나옵니다」류와 숫자도 뺐습니다(공개선 ⑫·⑪).
</p>
</div></body></html>`;
}

function main() {
  const argv = process.argv.slice(2);
  const 하나 = argv.includes('--안') ? argv[argv.indexOf('--안') + 1] : null;
  const 안내선 = argv.includes('--안내선');
  if (하나 && !안들[하나]) throw new Error(`모르는 안: ${하나} (있는 것: ${Object.keys(안들).join(' · ')})`);

  fs.mkdirSync(낼곳, { recursive: true });
  const 목록 = 하나 ? [하나] : Object.keys(안들);
  const 굽힌것 = [];
  for (const 안 of 목록) {
    const r = 굽기(안, false);
    console.log(`${r.넘음 ? '🔴' : '✅'} ${안.padEnd(8)} ${W}×${H} · ${(r.바이트 / 1048576).toFixed(2)}MB${r.넘음 ? ' — 6MB 초과!' : ''}`);
    굽힌것.push(r);
    if (안내선) {
      const g = 굽기(안, true);
      console.log(`   ↳ 검수용 안내선 판 · ${path.relative(ROOT, g.png)}`);
    }
  }

  if (!하나) {
    const s = path.join(낼곳, '시안.html');
    fs.writeFileSync(s, 시안(굽힌것), 'utf8');
    console.log(`\n📄 시안 = ${path.relative(ROOT, s)} — «안전 영역만» 줄로 고르십시오`);
  }
  console.log(`\n[배너굽기] ${굽힌것.length}벌 · ${path.relative(ROOT, 낼곳)}`);
}

main();
