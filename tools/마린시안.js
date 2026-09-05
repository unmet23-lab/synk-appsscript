#!/usr/bin/env node
/**
 * 마린시안 — 「바깥 에셋을 들여와 우리 것으로」 판정 재료를 실물 렌더 + Loom 지면으로 굽는다.
 *
 * 왜 이 지면이 생겼나 (유호 확정 08-27 · memory `marine-figure-track`):
 *   코드 조립(`tools/마린굽기.py`)은 천장을 쳤다 — 큐브+서브디비전은 «부풀리는» 연산이라
 *   갑옷의 형태 언어(평평한 면·날카로운 모서리·얇은 판·파낸 홈) 넷을 원리상 못 낸다.
 *   ⇒ 조형 밀도는 바깥에서 들이고, 우리는 **색·표식·프린팅용 재출력**을 한다.
 *   이 지면은 그 실물을 유호님 눈 앞에 세워 넷을 «고르시게» 한다(맨 아래 §07).
 *   비례·몸·색·세기와 각 — 전부 숫자로는 못 가르는 것들이라 지면이 판정 자리다.
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
/* ⚠ 09-05 밤 — 이 도구가 읽던 `docs/캐릭터/마린공방_0827`(블렌더 렌더 42장)을 걷었다.
 *   마린이 제미나이 4K 정본으로 서서(`docs/캐릭터/정본_4K/마린_*.png` 16컷) 그 렌더는
 *   «대체된 옛 판»이 됐다. 유호 확정 09-05 「대체된 최신화된것들이 있으면 예전꺼 다 버려야지」.
 *   ⇒ 지금 이 도구는 «돌지 않는다». 되살리려면 렌더를 다시 뽑거나 정본_4K 를 읽게 고친다.
 *   그림은 git 이력이 쥔다(42장 다 추적돼 있었다). */
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
  const 헬 = 집기((f) => /^hell_우리색_z\d+\.png$/.test(f))[0];
  // 미니어처 비례 — 유호 08-27 「둘 다 미니어처 버전으로」
  const 미니P = 집기((f) => /^primey_미니_우리색_z\d+\.png$/.test(f));
  const 미니H = 집기((f) => /^hell_미니_우리색_z\d+\.png$/.test(f));
  const 미니회색 = 집기((f) => /^(primey|hell)_미니_프라이머_z\d+\.png$/.test(f));
  const 세기들 = 집기((f) => /^primey_미니_세기_\d+\.png$/.test(f));
  const 정면들 = 집기((f) => /^(primey|hell)_미니_정면\.png$/.test(f));
  const 해석들 = 집기((f) => /^primey_해석_(몽글|까몽)\.png$/.test(f));   // 뒷태는 유호 폐지 08-28
  const 우주복들 = 집기((f) => /^primey_해석_우주복(몽글|까몽)\.png$/.test(f));
  const 전부 = [...턴, ...회색, ...(얼굴 ? [얼굴] : []), ...(헬 ? [헬] : []),
    ...미니P, ...미니H, ...미니회색, ...세기들, ...정면들, ...해석들, ...우주복들];
  if (턴.length < 4) { console.error(`🔴 턴테이블 렌더가 ${턴.length}장뿐이다 — 굽기부터.`); process.exit(1); }

  console.log(`렌더 ${전부.length}장 인라인 중…`);
  for (const r of 전부) r.uri = 인라인(r.파일, 620);
  const 각 = (r) => (r.이름.match(/z(\d+)$/) || [, '—'])[1].replace(/^0+(?=\d)/, '');
  const 표지 = 미니P.find((r) => 각(r) === '45') || 턴.find((r) => 각(r) === '45') || 턴[0];
  const 세기값 = (r) => (r.이름.match(/세기_(\d)(\d\d)$/) || [, '0', '70']).slice(1).join('.');

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
<!-- 브랜드 서체(SUIT)는 «굽기»가 지면 안에 싣는다 — 바깥에서 부르면 아티팩트 CSP 가 조용히 막는다(정본 tools/lib/브랜드폰트.js) -->
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
    <li><a href="#s0"><span class="n">01</span> 미니어처 — 둘 다</a></li>
    <li><a href="#s0b"><span class="n">02</span> 얼마나 앙증맞게</a></li>
    <li><a href="#s0c"><span class="n">03</span> 몽글·까몽 해석</a></li>
    <li><a href="#s0d"><span class="n">04</span> 우주복판</a></li>
    <li><a href="#s1"><span class="n">05</span> 원본 비례 여덟 각</a></li>
    <li><a href="#s2"><span class="n">06</span> 색 갈래 둘</a></li>
    <li><a href="#s3"><span class="n">07</span> 얼굴</a></li>
    <li><a href="#s4"><span class="n">08</span> 서전트 둘</a></li>
    <li><a href="#s5"><span class="n">09</span> 정할 것 넷</a></li>
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

${미니P.length ? `<h2 id="s0" class="듦"><span class="번호">01</span><span>미니어처 비례 — 둘 다</span></h2>
<p class="듦">유호님 말씀 그대로다 — <b>머리가 크고 · 다리가 짧고 굵고 · 발과 손이 크고 · 모서리가 둥글다.</b>
조형을 깎은 게 아니다(그건 이 통로가 생긴 까닭을 되돌리는 일이다). <b>높이에 따라 몸을 다시 매핑</b>했다 —
다리 구간의 키를 눌러 짧게, 목 위를 목 기준으로 균등 확대, 몸통과 발을 굵게, 그리고
<b>뻗은 팔은 몸 쪽으로 당겼다</b>. 홈·판·모서리 같은 조형 밀도는 그대로 살아 있다.</p>
${정면들.length ? `<p class="듦"><b>정면판</b>(유호 지시 08-27 「아예 정면을 보고있는 버전으로」) —
자세가 몸에 구워져 있어 정면 각은 몸마다 다르다: 오프라이미 z30 · 오헬 z0. 그리고 몸을
<b>8° 뒤로 젖혀</b> 고개 숙인 얼굴을 카메라로 들어 올렸다(카메라를 낮추는 것으로는 안 됐다 —
이 거리에서는 원근이 약해 시선이 안 바뀐다).</p>
<div class="짝">${정면들.map((r) => 칸(r, r.이름.startsWith('hell') ? '오헬 · 정면' : '오프라이미 · 정면')).join('')}</div>` : ''}
<p class="듦"><b>오프라이미</b> — 여덟 각</p>
<div class="마린줄">${미니P.map((r) => 칸(r)).join('')}</div>
${미니H.length ? `<p class="듦"><b>오헬</b> — 같은 여덟 각</p>
<div class="마린줄">${미니H.map((r) => 칸(r)).join('')}</div>` : ''}
${미니회색.length ? `<p class="듦">프라이머 회색으로 보면 «도색 전 진짜 미니어처»에 가깝다.</p>
<div class="짝">${미니회색.map((r) => 칸(r, (r.이름.startsWith('hell') ? '오헬' : '오프라이미') + ' · 프라이머')).join('')}</div>` : ''}` : ''}

${세기들.length ? `<h2 id="s0b" class="듦"><span class="번호">02</span><span>얼마나 앙증맞게 — 세기 셋</span></h2>
<p class="듦">같은 몸·같은 각·같은 색으로 세기만 갈랐다. 세기가 오를수록 다리가 짧아지고 머리가 커진다.
<b>숫자로는 못 고른다</b> — 어느 쪽이 몽글·까몽 옆에 섰을 때 한 식구로 보이는지가 판정 축이다.
⚠ 세게 갈수록 팔이 몸에 붙어 «곰인형» 쪽으로 간다(그 선을 넘기 직전이 1.00 이다).</p>
<div class="마린줄">${세기들.map((r) => 칸(r, '세기 ' + 세기값(r))).join('')}</div>` : ''}

${해석들.length ? `<h2 id="s0c" class="듦"><span class="번호">03</span><span>몽글·까몽 해석 — 재질이 세계를 바꾼다</span></h2>
<p class="듦">유호님 지시 그대로 «몽글·까몽의 재질»로 다시 읽었다 — 쇠를 걷고 <b>양모 펠트</b>를 입혔다
(결은 약하게 · 속살은 얕게 · 벨벳 시인). 조형 밀도는 그대로 산다. <b>얼굴과 위엄은 눈이 진다</b>:
통짜 메시의 바이저를 기하로 갈라 — <b>몽글판</b>은 코랄 펠트에 <b>버터 등불 눈</b>(따뜻한 지휘관),
<b>까몽판</b>은 먹 펠트에 <b>코랄 발광 눈</b>(밤의 감시자). 무대도 명도로 갈랐다(밝은 몸 = 밤천 · 어두운 몸 = 다린천).</p>
<p class="듦"><b>명품화 한 벌</b>(유호 08-27 「명품처럼」) — <b>플러시 방석</b>(킷의 스쿼클 · 엔진 짧은퍼
털이 사는 유일한 자리 = 평면)과 <b>오브 배지 코인</b>(코랄+버터 두 겹 · 방석 위 발 앞 — 명품 제품샷의
문법대로 브랜드 마크는 몸이 아니라 «대»가 진다). 눈으로 걸러 죽인 것들: <b>목도리</b>(마린은 목이
없어 튜브가 된다) · <b>어깨 털</b>(안개가 되어 총·주먹까지 감쌌다 — 「갑옷에 털 = 안개」 실측 그대로) ·
<b>몸 위 배지</b>(자동 추적이 안 어깨·든 주먹을 두 번 잡았다). 방석·배지는 프린팅 STL 에도 같이 나간다.</p>
<p class="듦"><b>군장 → 학용품</b>(유호 08-27 「엉뚱해도 좋아」) — 가방에 꽂힌 <b>큰 연필 둘</b>(배낭 굴뚝을
실좌표로 재서 덮었다) · 허리 수류탄 파우치 자리엔 <b>작은 책</b> · 총은 지울 수 없어 총의 축을 재서
같은 축의 <b>거대 연필</b>로 안겼다(지휘봉 해석). 얼굴은 그대로 — 위엄은 얼굴이, 귀여움은 학용품이 진다.</p>
<div class="짝">${해석들.map((r) => 칸(r, r.이름.includes('몽글') ? '몽글 해석 · 코랄 펠트 + 버터 눈' : '까몽 해석 · 먹 펠트(민얼굴)')).join('')}</div>` : ''}

${우주복들.length ? `<h2 id="s0d" class="듦"><span class="번호">04</span><span>우주복판 — 갑옷을 전부 벗은 스파르타 선생님</span></h2>
<p class="듦">유호님 물음 「갑옷을 전부 벗겨주고 우주복을 입힐 수는 없나?」의 답이다. 갑옷은 녹이지도
베지도 않았다(녹이면 마시멜로 · 베면 파편 — 열두 판 실측). 이 조형은 부품이 서로 관통하는 별개 셸이라,
<b>헬멧 «통짜 조각»만</b>(175조각 중 3벌) 통째로 남기고 몸은 우리 형태 언어로 처음부터 지었다 —
베개몸 우주복 · 골반·허벅지 이음 · 실땀 솔기 · 가슴 생명유지 패널(단추 셋) · 등의 학생 책가방.
우주복의 형태 언어가 정확히 «통통한 봉제 볼륨»이라, 갑옷에선 코스프레였던 그 문법이 여기선 정답이 된다.</p>
<p class="듦"><b>스파르타 선생님</b>(유호 08-28) — 얼굴은 <b>정면</b>(z50 · 스윕 눈 판정)에 고개를 살짝
숙였고(-8° · 내려다보는 선생님), 왼팔에 <b>방패</b>(테두리 실땀 — 오브 배지의 문법), 오른손의 거대
연필이 창을 진다. 어깨엔 서전트식 <b>어깨 방어구</b>(장갑색 돔 + 버터 트림 · 머리보다 넓게).
반려로 걷어낸 것들 — 버터 목 링(입 밑 노란 줄) · 가로 볏·솜털 방울·투구 홀더 홈판(「그래프 같다 ·
짜치는 느낌」) · 가슴 어깨끈. 이마 «해골»은 헬멧색 민무늬 패드가 조용히 지운다.</p>
<p class="듦"><b>까몽 명품화판</b>(유호 08-28 「흰 배경 하나만 · 감각적이고 트렌디하게」 · 2패스) —
디자이너 토이 문법. ①<b>절제 = 모노 팔레트</b>: 검은 연필·검은 방패·먹 결 260 — 색은 코랄 점 몇 개만
튄다 ②<b>단호함 = 민얼굴의 어둠</b>: 눈빛 발광·볼터치는 1패스에서 시도했으나 유호 반려(「지금 바뀐
얼굴 별로」) — 빈 헬멧의 어둠이 단호함을 진다 ③<b>몸의 봉제 언어(퀼팅)</b>: 검은 무릎 패치 둘이
부츠·장갑의 검정을 다리로 잇고, 허벅지 솔기 링·허리 솔기가 «재봉된 물건»의 서명을 더한다(「몸통·
다리가 밋밋해」의 답). 받침 위 배지 코인은 «스위치 같다»로 반려 — 무대는 방석과 실땀만 남는다.</p>
<div class="짝">${우주복들.map((r) => 칸(r, r.이름.includes('몽글') ? '우주복 몽글 · 스파르타 선생님(방패·연필 창)' : '우주복 까몽 · 명품화판(모노·퀼팅)')).join('')}</div>` : ''}

<h2 id="s1" class="듦"><span class="번호">05</span><span>원본 비례 여덟 각 — 이 피규어의 «얼굴»은 어디인가</span></h2>
<p class="듦">같은 물건·같은 거리·같은 눈높이로 <b>제자리에서 돌렸다</b>. 미니어처는 각마다 다른 물건처럼
보인다 — 정면(0°)은 뻗은 팔이 앞을 가리고, 옆(90°)은 총과 등짐이 실루엣을 만든다.
<b>대외물에 쓸 한 각</b>을 여기서 고른다.</p>
<div class="마린줄">${턴.map((r) => 칸(r)).join('')}</div>

<h2 id="s2" class="듦"><span class="번호">06</span><span>색 갈래 둘 — 우리 색과 프라이머 회색</span></h2>
<p class="듦"><b>우리 색</b>(Lapis Deep · 금속 0.18)은 브랜드를 입힌 판이고,
<b>프라이머 회색</b>(Stone · 금속 0)은 도색 전 «진짜 미니어처»로 읽히는 판이다.
08-27 실측 — <b>광택 금속은 장난감이 된다.</b> 금속기를 죽인 회색이 「50만원짜리」 쪽에 가깝다.</p>
<div class="짝">${회색.map((r) => {
  const 짝 = 턴.find((t) => 각(t) === 각(r));
  return [짝 && 칸(짝, `우리 색 · ${각(r)}°`), 칸(r, `프라이머 · ${각(r)}°`)].filter(Boolean).join('');
}).join('')}</div>

${얼굴 ? `<h2 id="s3" class="듦"><span class="번호">07</span><span>얼굴 — 인상을 지는 둘</span></h2>
<p class="듦">울트라맨과 마린을 가르는 것은 <b>면의 개수</b>다(08-27 실측). 인상을 지는 둘은
렌즈 위 <b>차양</b>(그 그림자가 「노려봄」)과 앞으로 나온 <b>턱 그릴</b>.
들여온 조형은 그 둘을 이미 갖고 있다 — 코드로는 하루를 태우고도 못 냈던 자리다.</p>
<div class="마린줄">${칸(얼굴, '얼굴 클로즈업')}</div>` : ''}

${헬 ? `<h2 id="s4" class="듦"><span class="번호">08</span><span>서전트 둘 — 어느 몸으로 갈까</span></h2>
<p class="듦">받아 둔 후보는 둘이다. <b>오프라이미</b>(26.7k 내려받음 · ★4.9)는 흉갑 독수리·해골·순결 인장이
유호님 참조 사진과 거의 같고, <b>오헬</b>(★5.0)은 서 있는 자세지만 헬블래스터가 커서 실루엣이 총으로 쏠린다.</p>
<div class="짝">${칸(표지, '오프라이미 · 45°')}${칸(헬, '오헬 · 45°')}</div>` : ''}

<h2 id="s5" class="듦"><span class="번호">09</span><span>정할 것 넷</span></h2>
<blockquote class="유리 듦"><b>①어느 비례</b> — 미니어처(앙증맞음) / 원본(사실적) / 둘 다 ·
<b>②어느 몸</b> — 오프라이미 / 오헬 / 둘 다 ·
<b>③어느 색</b> — 우리 색(Lapis Deep) / 프라이머 회색 / 둘 다(용도를 갈라서) ·
<b>④어느 세기·각</b> — 미니어처로 가시면 세기 하나, 그리고 대외물 표준이 될 한 각.</blockquote>
<ul class="듦">
<li><b>고르시면 그 자리에서 나가는 것</b> — 같은 인자로 프린팅용 STL 재출력(<code>내보내기=…stl</code>)까지
한 벌이라, 비례·색·각이 정해지면 실물 출력 파일이 바로 선다. <b>미니어처 비례도 그대로 나간다</b> —
정점을 옮긴 것이라 출력물에도 같은 몸이 뽑힌다(실측: 내보낸 STL 이 <b>실물 키 40.0mm</b> ·
머리폭/몸통폭이 원본 0.96 → 미니 <b>1.00</b> · 삼각형 수는 원본과 같다 = 무대 소품이 안 섞였다).</li>
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
