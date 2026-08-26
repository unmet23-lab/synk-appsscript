#!/usr/bin/env node
/**
 * 마린시안 — 「바깥 에셋을 들여와 우리 것으로」 판정 재료를 실물 렌더 + Loom 지면으로 굽는다.
 *
 * 왜 이 지면이 생겼나 (유호 확정 08-27 · memory `marine-figure-track`):
 *   코드 조립(`tools/마린굽기.py`)은 천장을 쳤다 — 큐브+서브디비전은 «부풀리는» 연산이라
 *   갑옷의 형태 언어(평평한 면·날카로운 모서리·얇은 판·파낸 홈) 넷을 원리상 못 낸다.
 *   ⇒ 조형 밀도는 바깥에서 들이고, 우리는 **색·표식·프린팅용 재출력**을 한다.
 *   이 지면은 그 첫 실물을 유호님 눈 앞에 세워 세 가지를 «고르시게» 한다(맨 아래 §05).
 *
 * 🔴 08-27 오진 하나를 이 지면이 대체한다 — 「서전트 STL 이 누워 있다」는 **틀린 진단**이었다.
 *   x 축 회전 열넷을 태운 뒤 「x 로는 안 풀린다 · 자동 세움을 지어라」로 남겼는데,
 *   정점을 재보니 둘 다 **처음부터 서 있었다**(발→머리 축이 수직에서 10.5°·12.2° ·
 *   위 향한 면 18% : 아래 18% 로 균형). 기울어 보인 것은 조형(고개 숙인 전진 자세·거대한
 *   어깨판)과 **손으로 맞춘 카메라** 탓이었다. 지금은 도구가 둘 다 잰다(`세움=자동`·`자동틀=1`).
 *
 * 구조: 원고(HTML)만 짓고 `<!--펠트스킨-->` 에 `tools/펠트문서.js`(Loom L4)가 지면을 주입한다.
 *   렌더는 ffmpeg 로 webp 축소해 data URI 인라인 — 자립형 1파일(첨부 단독으로 열린다).
 *
 * 사용법:  node tools/마린시안.js         → docs/마린_시안.html
 *   렌더 먼저: 굽기 통로는 `tools/마린에셋들이기.py`(파일=… 돌리기=z045 …).
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 렌더방 = path.join(루트, 'docs', '캐릭터', '마린공방_0827');
const 출력 = path.join(루트, 'docs', '마린_시안.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 렌더 한 장 → webp data URI. 실패는 던진다(빈 값으로 물러서면 그림 없는 칸이 조용히 나간다). */
function 인라인(파일, 폭) {
  const 임시 = path.join(os.tmpdir(), `마린시안-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '82', 임시],
      { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

/** 파일 시각 — 「보여드리는 것이 지금 것인가」를 지면이 스스로 말한다(08-24 실측: 네 시간 반 어긋난 적 있다). */
const 시각 = (f) => new Date(fs.statSync(f).mtimeMs).toLocaleString('ko-KR', { hour12: false });

function main() {
  if (!fs.existsSync(렌더방)) {
    console.error('🔴 렌더방이 없다 — tools/마린에셋들이기.py 로 먼저 굽는다.');
    process.exit(1);
  }
  const 집기 = (조건) => fs.readdirSync(렌더방).filter((f) => f.endsWith('.png') && 조건(f)).sort()
    .map((f) => ({ 이름: f.replace(/\.png$/, ''), 파일: path.join(렌더방, f) }));

  const 턴 = 집기((f) => /^primey_우리색_z\d+\.png$/.test(f));
  const 회색 = 집기((f) => /^primey_프라이머_z\d+\.png$/.test(f));
  const 얼굴 = 집기((f) => f === 'primey_우리색_얼굴.png')[0];
  const 헬 = 집기((f) => f.startsWith('hell_'))[0];
  const 전부 = [...턴, ...회색, ...(얼굴 ? [얼굴] : []), ...(헬 ? [헬] : [])];
  if (턴.length < 4) { console.error(`🔴 턴테이블 렌더가 ${턴.length}장뿐이다 — 굽기부터.`); process.exit(1); }

  console.log(`렌더 ${전부.length}장 인라인 중…`);
  for (const r of 전부) r.uri = 인라인(r.파일, 620);
  const 각 = (r) => (r.이름.match(/z(\d+)$/) || [, '—'])[1].replace(/^0+(?=\d)/, '');
  const 표지 = 턴.find((r) => 각(r) === '45') || 턴[0];

  const 칸 = (r, 딸림) => `
    <figure class="유리 잔잔 마린칸">
      <img src="${r.uri}" alt="${esc(r.이름)}" loading="lazy">
      <figcaption><b>${esc(딸림 || (각(r) + '°'))}</b></figcaption>
    </figure>`;

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>마린 공방 — 들여온 미니어처를 우리 것으로</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/마린시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 렌더 = docs/캐릭터/마린공방_0827(Blender Cycles · tools/마린에셋들이기.py) · 지면 = tools/펠트문서.js -->
<!--펠트스킨-->
<style>
/* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
.마린칸{flex:1 1 250px;max-width:330px;padding:0;overflow:hidden;text-align:center;}
.마린칸 img{display:block;width:100%;height:auto;}
.마린칸 figcaption{padding:9px 12px 12px;font-size:.84rem;}
.마린칸 b{font-size:.95rem;}
.마린줄{display:flex;flex-wrap:wrap;gap:14px;margin:1.25em 0;}
.짝{display:flex;flex-wrap:wrap;gap:16px;margin:1.1em 0;}
.짝 figure{flex:1 1 300px;max-width:390px;}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">마린 공방</p>
  <ol>
    <li><a href="#s1"><span class="n">01</span> 여덟 각</a></li>
    <li><a href="#s2"><span class="n">02</span> 색 갈래 둘</a></li>
    <li><a href="#s3"><span class="n">03</span> 얼굴</a></li>
    <li><a href="#s4"><span class="n">04</span> 서전트 둘</a></li>
    <li><a href="#s5"><span class="n">05</span> 정할 것 셋</a></li>
  </ol>
</nav>

<div class="글">

<header class="표지">
  <img src="${표지.uri}" alt="우리 색 서전트" style="width:190px;border-radius:18px" aria-hidden="true">
  <div>
    <p class="꼭지">SYNK · 들여온 미니어처 · Blender Cycles 실굽기</p>
    <h1>마린 공방</h1>
    <p class="한줄">조형은 <b>바깥에서 왔고</b>, 색·무대·조명은 <b>우리 킷</b>이다.
    몽글·까몽은 화면 안에 살지만 이건 <b>손에 잡히는 물건</b>이 된다 — 같은 파일이 그대로
    프린팅용 STL 로 나간다.</p>
    <p class="메타">자동 생성 · <code>node tools/마린시안.js</code> ·
    렌더 ${전부.length}장(96샘플 · GPU · 900px) · 굽기 = <code>tools/마린에셋들이기.py</code> ·
    가장 최근 렌더 ${시각(표지.파일)}</p>
  </div>
</header>

<div class="유리 알림 듦"><b>08-27 진단 하나를 여기서 뒤집는다</b> — 「서전트 STL 이 누워 있어
못 세운다」는 <b>틀린 진단</b>이었다. x 축 회전 열넷을 태운 뒤 「자동 세움을 지어야 한다」로 남겼는데,
정점을 재보니 둘 다 <b>처음부터 서 있었다</b>(발→머리 축이 수직에서 10.5°·12.2° · 위 향한 면 18% :
아래 18%). 기울어 보인 것은 조형(고개 숙이고 전진하는 자세 · 거대한 어깨판)과 <b>손으로 맞춘
카메라</b> 탓이었다. 지금은 도구가 둘 다 잰다 — 몸축을 재서 필요할 때만 돌리고(<code>세움=자동</code>),
화각과 실제 크기로 거리를 계산한다(<code>자동틀=1</code>). <b>값을 바꾸기 전에 자를 댄다.</b></div>

<h2 id="s1" class="듦"><span class="번호">01</span><span>여덟 각 — 이 피규어의 «얼굴»은 어디인가</span></h2>
<p class="듦">같은 물건·같은 거리·같은 눈높이로 <b>제자리에서 돌렸다</b>. 미니어처는 각마다 다른 물건처럼
보인다 — 정면(0°)은 뻗은 팔이 앞을 가리고, 옆(90°)은 총과 등짐이 실루엣을 만든다.
<b>대외물에 쓸 한 각</b>을 여기서 고른다.</p>
<div class="마린줄">${턴.map((r) => 칸(r)).join('')}</div>

<h2 id="s2" class="듦"><span class="번호">02</span><span>색 갈래 둘 — 우리 색과 프라이머 회색</span></h2>
<p class="듦"><b>우리 색</b>(Lapis Deep · 금속 0.18)은 브랜드를 입힌 판이고,
<b>프라이머 회색</b>(Stone · 금속 0)은 도색 전 «진짜 미니어처»로 읽히는 판이다.
08-27 실측 — <b>광택 금속은 장난감이 된다.</b> 금속기를 죽인 회색이 「50만원짜리」 쪽에 가깝다.</p>
<div class="짝">${회색.map((r) => {
  const 짝 = 턴.find((t) => 각(t) === 각(r));
  return [짝 && 칸(짝, `우리 색 · ${각(r)}°`), 칸(r, `프라이머 · ${각(r)}°`)].filter(Boolean).join('');
}).join('')}</div>

${얼굴 ? `<h2 id="s3" class="듦"><span class="번호">03</span><span>얼굴 — 인상을 지는 둘</span></h2>
<p class="듦">울트라맨과 마린을 가르는 것은 <b>면의 개수</b>다(08-27 실측). 인상을 지는 둘은
렌즈 위 <b>차양</b>(그 그림자가 「노려봄」)과 앞으로 나온 <b>턱 그릴</b>.
들여온 조형은 그 둘을 이미 갖고 있다 — 코드로는 하루를 태우고도 못 냈던 자리다.</p>
<div class="마린줄">${칸(얼굴, '얼굴 클로즈업')}</div>` : ''}

${헬 ? `<h2 id="s4" class="듦"><span class="번호">04</span><span>서전트 둘 — 어느 몸으로 갈까</span></h2>
<p class="듦">받아 둔 후보는 둘이다. <b>오프라이미</b>(26.7k 내려받음 · ★4.9)는 흉갑 독수리·해골·순결 인장이
유호님 참조 사진과 거의 같고, <b>오헬</b>(★5.0)은 서 있는 자세지만 헬블래스터가 커서 실루엣이 총으로 쏠린다.</p>
<div class="짝">${칸(표지, '오프라이미 · 45°')}${칸(헬, '오헬 · 45°')}</div>` : ''}

<h2 id="s5" class="듦"><span class="번호">05</span><span>정할 것 셋</span></h2>
<blockquote class="유리 듦"><b>①어느 몸</b> — 오프라이미 / 오헬 ·
<b>②어느 색</b> — 우리 색(Lapis Deep) / 프라이머 회색 / 둘 다(용도를 갈라서) ·
<b>③어느 각</b> — 대외물 표준이 될 한 각.</blockquote>
<ul class="듦">
<li><b>고르시면 그 자리에서 나가는 것</b> — 같은 인자로 프린팅용 STL 재출력(<code>내보내기=…stl</code>)까지
한 벌이라, 색·각이 정해지면 실물 출력 파일이 바로 선다.</li>
<li><b>아직 못 하는 것 = 어깨 문장</b>. 굽은 어깨판에 로고를 얹으려면 UV 나 슈링크랩 한 벌이 더 든다.
등가방(<code>가방=1</code>)은 되지만 서전트 둘은 <b>이미 제 등짐을 지고 있어</b> 기본은 꺼 뒀다.</li>
<li>이 지면의 렌더는 전부 <b>같은 굽기 한 판</b>에서 났다 — 컷 하나를 다시 구우면 이 지면도 다시 짓는다
(옛 그림으로 새 판을 판정하는 사고를 이 저장소가 여러 번 밟았다).</li>
</ul>

<footer class="메타">렌더 = <code>docs/캐릭터/마린공방_0827/</code>(원본 900px PNG) ·
굽기 = <code>tools/마린에셋들이기.py</code>(Blender 5.2 · Cycles · GPU) ·
지면 = <code>tools/펠트문서.js</code>(Loom L4) · 색 = <code>docs/디자인_토큰.json</code> ·
원본 에셋 = Cults3D(유호님 계정 · zip 은 저장소 밖 Downloads).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `marine-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  console.log(`■ 마린 시안  ${path.relative(루트, 출력)}  (${Math.round(Buffer.byteLength(html) / 1024)}KB · 렌더 ${전부.length}장)`);
  const 밖 = (html.match(/src\s*=\s*"(?!data:)/g) || []).length;
  if (밖) { console.error(`🔴 외부 그림 참조 ${밖}건 — 자립형이 아니다`); process.exit(1); }
  console.log('   ✅ 자립형 — 외부 그림 0');
}

if (require.main === module) main();
