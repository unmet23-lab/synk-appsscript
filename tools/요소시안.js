#!/usr/bin/env node
/**
 * 요소시안 — `tools/세트굽기.js` 가 구운 요소 전부를 **한 지면**에 세운다.
 *
 * 왜 있나 (유호 08-22 「전부 해줘」):
 *   93장이 폴더에 흩어져 있으면 «다 됐는지»도 «맞는지»도 못 본다. 판정은 나란히 놓고 하는 것이다.
 *   오브 시안(`tools/오브시안.js`)과 같은 통로다 — 원고만 짓고 지면은 Loom L4 가 입힌다.
 *
 * 🚫 브랜드렌더린트에 등록하지 않는다 — 여러 요소를 나란히 세우는 것이 이 지면의 «내용»이라
 *   신호 1점 규율이 원리상 위반으로 잡힌다(브랜드킷·오브 시안과 같은 갈래).
 *
 * 사용:  node tools/요소시안.js [--방 docs/캐릭터/요소공방_0822] [--폭 300]
 *        → docs/요소_시안.html
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 1) {
    if (!v[i].startsWith('--')) continue;
    a[v[i].slice(2)] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[i += 1] : '1';
  }
  return a;
})();
const 방 = path.resolve(루트, 인자['방'] || path.join('docs', '캐릭터', '요소공방_0822'));
const 출력 = path.join(루트, 'docs', '요소_시안.html');
const 미리폭 = parseInt(인자['폭'] || '300', 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 세트마다의 «왜» — 격자만 있으면 예쁜지만 보게 된다. 판정에 필요한 것은 «어디에 쓰이나»다. */
const 설명 = {
  기호: ['정답·보상·좋아요와 하단 탭 넷 — <b>학생이 하루에 가장 여러 번 보는 픽셀</b>이다.',
        '도안 여덟은 함수가 아니라 «점 목록»이라(<code>요소굽기.py 도안들</code>) 새 기호는 한 줄로 는다.'],
  숫자: ['0~9 낱장은 <b>조합용</b>(어떤 수든 나열로 선다) · 01~12 통짜는 자간에 손맛이 필요한 자리(단락 머리·월).',
        '「/ · % +」 는 진행 표기(3/10 · 85%)를 위한 것이다.'],
  자모: ['우리는 <b>한국어 학원</b>이다 — 자모가 실물이면 그 자체가 교보재다.',
        '획이 가는 홑획(ㅡ·ㅣ)은 복셀 리메시가 뭉갤 수 있어 눈으로 본다(글자공방 함정 ①).'],
  요일: ['출석 달력·시간표 — 반복 노출이 많은 자리다.'],
  살림: ['도장 = 찍힌다는 «행위»가 곧 보상 · 게이지 고리 = 털실이 12시부터 시계 방향으로 감겨 차오른다.',
        '직선 진행바가 이미 털실이라 원형도 같은 재료여야 학생이 두 번 안 배운다.'],
  음식: ['플레이팅 갈래 — 만두(몽골 부즈와 한국 만두가 겹치는 음식) · 김밥(단면) · 붕어빵(겨울 낱말).'],
  넘버쿠키: ['번호의 «요리 플레이팅»판 — 표지·특별면의 한 점용(본문 자동 번호는 CSS <code>counter</code> 몫 그대로).'],
  음식되굽기: ['접시가 <b>평평한 원반 → 그릇(바닥판+림)</b> 으로 올라간 뒤의 1호·2호. 옛 v1 은 그 전 판이다.'],
};

/** 렌더 한 장 → webp data URI. 실패는 던진다(빈 값으로 물러서면 그림 없는 칸이 조용히 나간다). */
function 인라인(파일, 폭) {
  const 임시 = path.join(os.tmpdir(), `요소시안-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '84', 임시],
      { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

function main() {
  if (!fs.existsSync(방)) {
    console.error(`🔴 렌더 방이 없다 — \`node tools/세트굽기.js --세트 전부\` 를 먼저 돌린다.\n   ${방}`);
    process.exit(1);
  }
  // 세트 표의 «차례»를 그대로 쓴다 — 폴더 이름 정렬은 뜻이 없다.
  const 차례 = Object.keys(require('./세트굽기.js').세트들);
  const 세트들 = 차례.filter((s) => fs.existsSync(path.join(방, s)));
  if (!세트들.length) { console.error('🔴 구운 세트가 0 — 세트굽기부터.'); process.exit(1); }

  let 총 = 0;
  const 절들 = 세트들.map((세트, i) => {
    const 파일들 = fs.readdirSync(path.join(방, 세트)).filter((f) => f.endsWith('.png')).sort();
    총 += 파일들.length;
    process.stdout.write(`  ${세트} ${파일들.length}장 인라인… `);
    const 칸 = 파일들.map((f) => {
      const uri = 인라인(path.join(방, 세트, f), 미리폭);
      return `<figure class="유리 잔잔 요소칸"><img src="${uri}" alt="${esc(f)}">
        <figcaption>${esc(f.replace(/\.png$/, ''))}</figcaption></figure>`;
    }).join('');
    console.log('됐다');
    const 왜 = (설명[세트] || []).map((p) => `<p class="듦">${p}</p>`).join('');
    return `<h2 id="s${i + 1}" class="듦"><span class="번호">${String(i + 1).padStart(2, '0')}</span>
      <span>${esc(세트)} — ${파일들.length}장</span></h2>${왜}
      <div class="요소줄">${칸}</div>`;
  });

  const 첫 = (() => {
    const s = 세트들[0];
    const f = fs.readdirSync(path.join(방, s)).find((x) => x.endsWith('.png'));
    return 인라인(path.join(방, s, f), 320);
  })();

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>요소 공방 — 세트 굽기</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/요소시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 렌더 = ${path.relative(루트, 방).replace(/\\/g, '/')} (Blender Cycles · tools/세트굽기.js) · 지면 = tools/펠트문서.js -->
<!--펠트스킨-->
<style>
/* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
.요소칸{flex:0 1 168px;padding:0;overflow:hidden;text-align:center;}
.요소칸 img{display:block;width:100%;height:auto;}
.요소칸 figcaption{padding:8px 8px 11px;font-size:.78rem;}
.요소줄{display:flex;flex-wrap:wrap;gap:12px;margin:1.15em 0;}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">요소 공방</p>
  <ol>${세트들.map((s, i) => `
    <li><a href="#s${i + 1}"><span class="n">${String(i + 1).padStart(2, '0')}</span> ${esc(s)}</a></li>`).join('')}
  </ol>
</nav>

<div class="글">

<header class="표지">
  <img src="${첫}" alt="" style="width:150px;border-radius:18px" aria-hidden="true">
  <div>
    <p class="꼭지">SYNK Loom · Blender Cycles 실굽기</p>
    <h1>요소 공방</h1>
    <p class="한줄">유호님 08-22 「전부 해줘」 — 앱·교재·PDF 에 설 요소를 <b>세트 단위로</b> 구웠다.
    전부 같은 통로(<code>요소굽기.py</code>) · 같은 재료(펠트·실) · 같은 조명이라 <b>한 세계의 물건</b>이다.</p>
    <p class="메타">자동 생성 · <code>node tools/세트굽기.js --세트 전부</code> → <code>node tools/요소시안.js</code> ·
    렌더 ${총}장 · 지면 = Loom L4 · 색 = 디자인_토큰.json</p>
  </div>
</header>

<div class="유리 알림 듦"><b>도안은 함수가 아니라 «점 목록»이다</b> — 기호 여덟(체크·별·하트·집·책·차트·사람·말풍선)은
같은 함수 하나가 낸다. 새 기호를 더하는 값은 <b>점 목록 한 줄</b>이고, 리메시·실땀·조명 규율은 판마다 안 갈린다.
요소가 늘 때마다 굽기 함수가 늘면 그 규율이 먼저 갈린다 — 그게 진짜 비용이다.</div>

${절들.join('\n')}

<h2 id="끝" class="듦"><span class="번호">${String(세트들.length + 1).padStart(2, '0')}</span><span>정할 것</span></h2>
<ul class="듦">
<li><b>더 구울 것</b> — 남은 후보는 슬라이더(털실 당김)·스테퍼·토스트·모달·탭 전환·읽음 표시다
(<code>docs/양모공방_요소사전.md</code> §5). 순서는 유호님 몫이다.</li>
<li><b>다음 이음매</b> — 이 렌더를 앱·지면에 «부품»으로 꽂는 배선(투명 배경 뽑기 + 부품표 등재)은 별건이다.</li>
</ul>

<footer class="메타">렌더 = <code>${esc(path.relative(루트, 방).replace(/\\/g, '/'))}/</code> ·
굽기 = <code>node tools/세트굽기.js</code>(Blender 5.2 · Cycles) ·
지면 = <code>tools/펠트문서.js</code>(Loom L4) · 색 = <code>docs/디자인_토큰.json</code>.</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `요소-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  console.log(`■ 요소 시안  ${path.relative(루트, 출력)}  ` +
    `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 세트 ${세트들.length} · 렌더 ${총}장)`);
}

if (require.main === module) main();
