#!/usr/bin/env node
/**
 * 오브시안 — 「오브의 기본 염료를 무엇으로 둘까」 판정 재료를 **실물 렌더 + Loom 지면**으로 굽는다.
 *
 * 판 이력 (셋째 판 · 유호 교정 두 번을 먹었다):
 *   1판 = 부품만 받고 골격은 손 CSS → 「너무 허접해보여」(08-20). 통로 밖 손 CSS 의 대가.
 *   2판 = Loom L4 지면 주입으로 골격은 잡았으나 오브가 여전히 **CSS 흉내**(box-shadow + 천 타일)
 *        → 「내가 원하는 퀄리티는 이게 아니야」(08-21). 글자공방 3종(자수·레터프레스·라벨)은
 *        Blender Cycles «실굽기»인데 오브만 그림이었다 — 같은 지면에 서면 그 차이가 그대로 보인다.
 *   3판(이것) = **오브도 실굽기다.** `tools/오브굽기.js`(Blender · 요소굽기 형태=오브)가 구운
 *        26색 렌더를 그대로 싣는다. 결정.md 08-20 「앱 UI·UX 는 블렌더로 굽는 펠트 실물
 *        오브젝트로 전부 대체 — CSS 목업은 임시 비계」의 집행이다.
 *
 * 🔑 실굽기가 사진 재염색(펠트천굽기.py)의 한계도 푼다 — 저쪽은 밝은 원료 사진의 채널 게인이라
 *   어두운 색에서 결이 죽지만(Ink 36.8%·Ink Deep 6.3%), 3D 털은 그 색으로 «직접» 심으므로
 *   **Ink·Ink Deep 오브도 섬유가 산다**(렌더 실측 08-21). 어두운 양모 사진이 선행 조건이 아니게 됐다.
 *
 * 구조: 원고(HTML)만 짓고 `<!--펠트스킨-->` 에 `tools/펠트문서.js`(Loom L4)가 지면을 주입한다.
 *   렌더는 ffmpeg 로 webp 축소해 data URI 인라인 — 자립형 1파일(첨부 단독으로 열린다).
 *
 * 🚫 브랜드렌더린트에 등록하지 않는다 — 색 26종을 나란히 세우는 것이 이 지면의 «내용»이라
 *   신호 1점 규율이 원리상 위반으로 잡힌다(브랜드킷.html 과 같은 갈래).
 *
 * 사용법:  node tools/오브시안.js            → docs/오브_시안.html
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 렌더방 = path.join(루트, 'docs', '캐릭터', '오브공방_0821');
const 토큰길 = path.join(루트, 'docs', '디자인_토큰.json');
const 출력 = path.join(루트, 'docs', '오브_시안.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 렌더 한 장 → webp data URI. 실패는 던진다(빈 값으로 물러서면 그림 없는 칸이 조용히 나간다). */
function 인라인(파일, 폭) {
  const 임시 = path.join(os.tmpdir(), `오브시안-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '82', 임시],
      { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

function main() {
  if (!fs.existsSync(렌더방)) {
    console.error('🔴 렌더가 없다 — `node tools/오브굽기.js` 를 먼저 돌린다.');
    process.exit(1);
  }
  const 킷 = JSON.parse(fs.readFileSync(토큰길, 'utf8'))['색']['킷'];
  const 이름값 = Object.fromEntries(킷.map((c) => [c['이름'], c['hex']]));

  // 렌더 목록 — 킷 순서(램프 순)로 정렬한다. 파일명은 공백→_ 규약(오브굽기.js).
  const 순서 = 킷.map((c) => c['이름']);
  const 렌더들 = fs.readdirSync(렌더방).filter((f) => f.endsWith('.png'))
    .map((f) => ({ 이름: f.replace(/\.png$/, '').replace(/_/g, ' '), 파일: path.join(렌더방, f) }))
    .sort((a, b) => 순서.indexOf(a.이름) - 순서.indexOf(b.이름));
  if (!렌더들.length) { console.error('🔴 렌더 0장 — 오브굽기부터.'); process.exit(1); }

  console.log(`렌더 ${렌더들.length}장 인라인 중…`);
  for (const r of 렌더들) r.uri = 인라인(r.파일, 560);
  const 유력이름 = ['Coral', 'Lapis', 'Meadow', 'Butter', 'Pop', 'Oat', 'Stitch', 'Ink'];
  const 유력 = 렌더들.filter((r) => 유력이름.includes(r.이름));
  const 코랄 = 렌더들.find((r) => r.이름 === 'Coral') || 렌더들[0];

  const 렌더칸 = (r) => `
    <figure class="유리 잔잔 오브칸">
      <img src="${r.uri}" alt="${esc(r.이름)} 오브">
      <figcaption><b>${esc(r.이름)}</b><code>${esc(이름값[r.이름] || '')}</code></figcaption>
    </figure>`;

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>오브 공방 — 기본 염료 시안</title>
<!-- 브랜드 서체(SUIT)는 «굽기»가 지면 안에 싣는다 — 바깥에서 부르면 아티팩트 CSP 가 조용히 막는다(정본 tools/lib/브랜드폰트.js) -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/오브시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 렌더 = docs/캐릭터/오브공방_0821(Blender Cycles · tools/오브굽기.js) · 지면 = tools/펠트문서.js -->
<!--펠트스킨-->
<style>
/* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
.오브칸{flex:1 1 240px;max-width:300px;padding:0;overflow:hidden;text-align:center;}
.오브칸 img{display:block;width:100%;height:auto;}
.오브칸 figcaption{padding:10px 12px 13px;font-size:.82rem;}
.오브칸 b{display:block;font-size:.92rem;}
.오브칸 code{opacity:.7;font-size:.74rem;}
.오브줄{display:flex;flex-wrap:wrap;gap:14px;margin:1.25em 0;}
.표지짝{display:flex;gap:22px;align-items:center;}
.표지짝 img{width:190px;border-radius:14px;flex:none;}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">오브 공방</p>
  <ol>
    <li><a href="#s1"><span class="n">01</span> 실물 26색</a></li>
    <li><a href="#s2"><span class="n">02</span> 표지 맥락</a></li>
    <li><a href="#s3"><span class="n">03</span> 정할 것</a></li>
  </ol>
</nav>

<div class="글">

<header class="표지">
  <img src="${코랄.uri}" alt="코랄 오브" style="width:150px;border-radius:18px" aria-hidden="true">
  <div>
    <p class="꼭지">SYNK Loom · Blender Cycles 실굽기</p>
    <h1>오브 공방</h1>
    <p class="한줄">CSS 흉내를 걷고 <b>전부 실물로 구웠다</b> — 킷 26색, 같은 몸·같은 받침·같은 조명.
    글자공방(자수·레터프레스·라벨)과 같은 통로(<code>요소굽기.py</code>)라 같은 세계로 선다.
    오브는 지면에 <b>1점</b>뿐이니 이 색은 신호 1점 규율과 맞물리는 판정이다.</p>
    <p class="메타">자동 생성 · <code>node tools/오브굽기.js</code> → <code>node tools/오브시안.js</code> ·
    렌더 ${렌더들.length}장(96샘플 · GPU) · 지면 = Loom L4 · 색 = 디자인_토큰.json(퇴역·KC 제외를 토큰이 판정)</p>
  </div>
</header>

<div class="유리 알림 듦"><b>실굽기가 어두운 색 문제도 풀었다</b> — 사진 재염색은 명도 게인이 곱이라
Ink 에서 결 36.8%·Ink Deep 6.3% 로 죽었는데, 3D 털은 그 색으로 <b>직접</b> 심으므로
아래 Ink·Ink Deep 오브의 섬유가 그대로 살아 있다. 어두운 양모 원료 사진이 더는 선행 조건이 아니다.</div>

<h2 id="s1" class="듦"><span class="번호">01</span><span>실물 26색 — 같은 물건, 다른 염료</span></h2>
<p class="듦">받침 천이 <b>염료 명도로 뒤집힌다</b> — 밝은 염료는 밤천(Ink) 위에, 어두운 염료는
다린천(Oat) 위에 선다. 테두리 실땀(Stitch)은 운용 규칙 ②의 서명이고, 조명은 자수 글자 채택판(결광2)이다.
<b>대비는 재료가 내고 빛은 거든다</b>(명품 렌더 4계 ①).</p>
<div class="오브줄">${렌더들.map(렌더칸).join('')}</div>

<h2 id="s2" class="듦"><span class="번호">02</span><span>표지 맥락 — 유력 ${유력.length}종</span></h2>
<p class="듦">격자는 「예쁜 색」을 고르게 하고 맥락은 「맞는 색」을 고르게 한다 — 실제로 서는 자리에 놓았다.</p>
<div class="수치들">${유력.map((r) => `
  <div class="수치 유리" style="flex:1 1 420px;padding:20px 22px">
    <div class="표지짝">
      <img src="${r.uri}" alt="">
      <div>
        <p class="꼭지">SYNK LAB</p>
        <p class="n" style="font-size:1.14rem;margin-top:2px">몽골에서 한국어를<br>게임처럼 배운다</p>
        <p class="l" style="margin-top:8px">${esc(r.이름)} · ${esc(이름값[r.이름] || '')} —
        이 지면에서 부피를 가진 물건은 이 오브 하나다.</p>
      </div>
    </div>
  </div>`).join('')}
</div>

<h2 id="s3" class="듦"><span class="번호">03</span><span>정할 것 하나</span></h2>
<blockquote class="유리 듦">오브의 <b>기본 염료</b>를 무엇으로 둘까. 정하면
<code>docs/디자인_토큰.json</code> 에 <code>색.기본색</code> 을 세우는 것으로 끝난다 —
<code>loom.js 기본천()</code> 과 지면 스킨이 <b>고칠 것 없이</b> 따라온다(이미 그 키를 먼저 읽는다).</blockquote>
<ul class="듦">
<li><b>다음 이음매</b> — 이 렌더를 지면 <code>.오브</code> 자리에 «부품»으로 꽂는 배선(투명 배경 뽑기 +
구움표 등재)은 별건이다. 지금 판은 «어느 색인가»의 판정 재료다.</li>
<li>퇴역 대기 12색·KC 4색은 <b>아예 굽지 않았다</b> — 못 고르는 것은 선택지에 안 올린다(토큰 직책이 판정).</li>
</ul>

<footer class="메타">렌더 = <code>docs/캐릭터/오브공방_0821/</code>(원본 1800px PNG) ·
굽기 = <code>node tools/오브굽기.js</code>(Blender 5.2 · Cycles · GPU) ·
지면 = <code>tools/펠트문서.js</code>(Loom L4) · 색 = <code>docs/디자인_토큰.json</code>.</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `orb-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  console.log(`■ 오브 시안  ${path.relative(루트, 출력)}  (${Math.round(Buffer.byteLength(html) / 1024)}KB · 실물 렌더 ${렌더들.length}장 · 맥락 ${유력.length}장)`);
  const 밖 = (html.match(/src\s*=\s*"(?!data:)/g) || []).length;
  if (밖) { console.error(`🔴 외부 그림 참조 ${밖}건 — 자립형이 아니다`); process.exit(1); }
  console.log('   ✅ 자립형 — 외부 그림 0');
}

if (require.main === module) main();
