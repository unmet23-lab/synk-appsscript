#!/usr/bin/env node
/**
 * 까몽 시트 — `tools/몽글친구굽기.py` 가 구운 표정 다섯을 **한 지면**에 세운다.
 *   이름 = 까몽(까맣다 + 몽글의 「몽」 · 유호 확정 2026-08-25).
 *
 * ■ 왜 있나
 *   🔑 **굽기와 «판정 지면»은 한 벌이다**(트랙 §0 · 08-24 에 세 번 값을 치르고 얻은 규율).
 *     굽고 안 그리면 아무도 그 굽기를 못 본다 — 유호님은 폴더가 아니라 지면을 보신다.
 *   그리고 표정 세트는 특히 그렇다: **「표정이 서로 다른가」는 한 장씩으로는 원리상 판정이 안 된다.**
 *     08-25 조율 실측이 그 자리였다 — 눈감음과 눈웃음을 따로 보면 둘 다 멀쩡한데,
 *     나란히 놓자 «거의 같은 그림»이었다(둘 다 두꺼운 ∧ 한 덩이). 그래서 이 지면은 다섯을 반드시
 *     나란히 세우고, 눈 자리를 확대한 줄을 하나 더 붙인다.
 *
 * ■ 시각을 찍는다
 *   🔑 **「지금 보는 것이 지금 것인가」는 수가 아니라 시각이 답한다**(트랙 §0 · 거짓 초록 3회의 뿌리).
 *     칸마다 파일 mtime 을 싣고, 다섯 중 가장 오래된 것과 새 것의 간격을 머리에 띄운다 —
 *     간격이 벌어져 있으면 «옛 컷과 새 컷이 섞인 격자»를 보고 계신 것이다.
 *
 * 사용:  node tools/까몽시트.js [--방 docs/캐릭터/친구공방_0825] [--폭 340]
 *        → docs/까몽_시안.html
 */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 1) {
    if (!v[i].startsWith('--')) continue;
    a[v[i].slice(2)] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[i += 1] : '1';
  }
  return a;
})();
const 방 = path.resolve(루트, 인자['방'] || path.join('docs', '캐릭터', '친구공방_0825'));
const 출력 = path.join(루트, 'docs', '까몽_시안.html');
const 미리폭 = parseInt(인자['폭'] || '340', 10);
const 접두 = '까몽';        // 이름 = 까몽(유호 확정 08-25) · 파일 문법 = <접두>_<표정>.png (마스코트 정본과 같은 자)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 표정 다섯 = 마스코트 정본 5종 문법 그대로. 이 목록이 굽기·시트의 공통 자다. */
const 표정들 = [
  ['본체', '정면 · 구슬눈', '평소 눈. 동공이 눈의 70% 라 초록은 얇은 테두리로만 남는다 — 반려 두 번을 거친 값이다.'],
  ['눈감음', '감은 눈 ⌒⌒', '작은 땀 다섯을 «낮고 넓은» 호에 늘어놓은 수놓은 선(솟음 0.030) · 눈동자와 같은 Meadow 초록실.'],
  ['눈웃음', '웃는 눈 ∧∧', '눈감음과 «같은» 수놓은 호인데 더 높고 좁다(솟음 0.070 대 0.030). 웃는 눈은 각이 아니라 «가늘게 휜 초승달»이다.'],
  ['우34', '오른쪽 34°', '몸만 돌아앉는다 — 무대·카메라·조명은 그대로. 반짝은 회전 뒤에 놓아 키 라이트 쪽에 남는다.'],
  ['좌34', '왼쪽 34°', '우34 의 짝. 꼬리가 몸 오른쪽에 있어 이 판에서는 앞으로 돌아 나온다 — 몸이 돌면 꼬리도 같이 돈다.'],
];

/* 🆕 «판정 대기» 시안 — 감정 어휘 10종의 빈 칸을 까몽부터 채운다(트랙 §2-J · 08-26 신설).
 *   위 다섯과 **한 배열에 섞지 않는다.** 규격이 다르기 때문이다: 이쪽은 조율판(700px·40샘플)이고
 *   저쪽은 정본(1024px·96샘플)이라, 섞으면 이 지면이 스스로 경고하는 «판이 갈린 격자»가 된다.
 *   채택되면 정본 규격으로 다시 굽고 그때 위 배열로 올라간다 — 판정 전 판을 정본 자리에 두지 않는다. */
const 시안들 = [
  ['놀람', '놀란 눈 ●●', '구슬·동공을 **통째로 1.28배**. 비율 0.70 은 그대로다 — 구슬만 키우면 1판에서 반려된 «노려보는 눈»이 되살아난다.'],
  ['윙크', '한쪽만 ∧ ●', '감는 쪽은 «눈감음»이 아니라 **«눈웃음» 호**(솟음 0.070)다 — 윙크는 장난이지 졸음이 아니다. 화면 왼쪽 눈만 감는다.'],
  ['졸림', '거의 평평 ⌒⌒', '눈감음과 «솟음·높이» **두 축**으로 가른다(솟음 0.030→0.013 · 자리 1.348→1.326). 한 축만 다르면 또 헷갈린다.'],
];

/** 렌더 한 장 → webp data URI. 실패는 던진다 — 빈 값으로 물러서면 그림 없는 칸이 조용히 나간다. */
function 인라인(파일, 폭) {
  const 임시 = path.join(os.tmpdir(), `까몽시트-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '86', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

/** 눈 자리만 잘라 크게 — 「표정이 갈리나」는 얼굴 크기로는 안 보인다. */
function 눈확대(파일, 폭) {
  const 임시 = path.join(os.tmpdir(), `까몽눈-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    /* 눈은 화면 가로 20~72% · 세로 20~44% 자리에 선다(카메라 고정이라 판마다 같다).
     * ⚠꼬리 자리를 내려고 카메라를 0.12 오른쪽으로 옮기면서 몸이 화면 왼쪽으로 **4.1%** 밀렸다 —
     *   자르는 자리도 같이 옮긴다. 굽기 쪽 구도를 바꾸면 «보는 자리»도 따라와야 한다. */
    execFileSync('ffmpeg', ['-y', '-i', 파일,
      '-vf', `crop=iw*0.52:ih*0.24:iw*0.20:ih*0.20,scale=${폭}:-1`, '-quality', '88', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }
}

const 시각 = (ms) => new Date(ms).toLocaleString('ko-KR', { hour12: false });

function main() {
  if (!fs.existsSync(방)) {
    console.error(`🔴 렌더 방이 없다 — 굽기부터.\n   ${방}`);
    process.exit(1);
  }
  const 파일 = (이름) => path.join(방, `${접두}_${이름}.png`);
  const 있나 = (이름) => fs.existsSync(파일(이름));
  const 없는것 = 표정들.map(([n]) => n).filter((n) => !있나(n));
  /* 「합계 = 있다 + 없다」로 찍는다 — 조용한 0 을 막는다(유호 지시 「합계 = 갈래+갈래」). */
  console.log(`■ 까몽 시트 — 합계 ${표정들.length} = 있다 ${표정들.length - 없는것.length} + 없다 ${없는것.length}`
    + (없는것.length ? ` (${없는것.join(', ')})` : ''));
  if (없는것.length === 표정들.length) { console.error('🔴 한 장도 없다 — 굽기부터.'); process.exit(1); }

  const 때들 = 표정들.filter(([n]) => 있나(n)).map(([n]) => fs.statSync(파일(n)).mtimeMs);
  const 벌어짐분 = Math.round((Math.max(...때들) - Math.min(...때들)) / 60000);

  const 칸 = ([이름, 딱지, 뜻]) => (있나(이름)
    ? `<figure class="유리 잔잔 친구칸"><img src="${인라인(파일(이름), 미리폭)}" alt="${esc(이름)}">
       <figcaption><b>${esc(이름)}</b> — ${esc(딱지)}<br><span class="메타">${esc(시각(fs.statSync(파일(이름)).mtimeMs))}</span>
       <br>${esc(뜻)}</figcaption></figure>`
    : `<figure class="유리 잔잔 친구칸 빈칸"><div class="빔">아직 안 구웠다</div>
       <figcaption><b>${esc(이름)}</b> — ${esc(딱지)}</figcaption></figure>`);

  process.stdout.write('  다섯 인라인… ');
  const 다섯줄 = 표정들.map(칸).join('');
  console.log('됐다');

  process.stdout.write('  눈 확대… ');
  const 눈줄 = 표정들.filter(([n]) => 있나(n)).map(([이름]) =>
    `<figure class="유리 잔잔 눈칸"><img src="${눈확대(파일(이름), 320)}" alt="${esc(이름)} 눈">
     <figcaption>${esc(이름)}</figcaption></figure>`).join('');
  console.log('됐다');

  const 첫이름 = 표정들.map(([n]) => n).find(있나);

  /* 🆕 시안 줄 — 있는 것만 싣는다(아직 안 구운 감정은 이 지면에 «빈 칸»으로도 안 세운다:
   *   확정 다섯의 빈 칸은 「구워야 할 것」이지만, 시안의 빈 칸은 「아직 시작도 안 한 것」이라
   *   같은 얼굴로 세우면 판정 자리가 흐려진다). 눈 확대도 같이 준다 — 이 셋의 판정 축이 «눈»이다. */
  const 시안있 = 시안들.filter(([n]) => 있나(n));
  const 시안줄 = 시안있.map(칸).join('');
  const 시안눈줄 = 시안있.map(([이름]) =>
    `<figure class="유리 잔잔 눈칸"><img src="${눈확대(파일(이름), 320)}" alt="${esc(이름)} 눈">
     <figcaption>${esc(이름)}</figcaption></figure>`).join('');

  /* 누끼 세트 — «있다고 적지 말고 센다»(트랙 §2-J 「세어지지 않는 목록은 관리되지 않는다」).
   *   여기 손으로 「아직 없다」를 적어 두었더니 굽고 난 아침에도 지면이 그대로 「없다」라고 말했다.
   *   폴더 규약은 소비자(`tools/워프시연.js`·`tools/lib/마스코트자산.js`)와 같은 자리다. */
  const 누끼방 = path.join(방, '누끼');
  const 누끼셋 = ['본체', '눈감음', '눈웃음'];
  const 누끼있 = 누끼셋.filter((n) => fs.existsSync(path.join(누끼방, `${접두}_${n}.png`)));
  const 누끼줄 = 누끼있.length === 누끼셋.length
    ? `✅ <b>셋 다 섰다</b> — <code>누끼/${접두}_{${누끼셋.join(',')}}.png</code> ·
       가장 새것 ${esc(시각(Math.max(...누끼있.map((n) => fs.statSync(path.join(누끼방, `${접두}_${n}.png`)).mtimeMs))))}`
    : `합계 ${누끼셋.length} = 있다 ${누끼있.length} + 없다 ${누끼셋.length - 누끼있.length}` +
      (누끼있.length ? ` (없는 것: ${esc(누끼셋.filter((n) => !누끼있.includes(n)).join(', '))})` : ' — 아직 한 장도 없다');

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>까몽 — 표정 다섯</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/까몽시트.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 렌더 = ${path.relative(루트, 방).replace(/\\/g, '/')} (Blender Cycles · tools/몽글친구굽기.py) · 지면 = tools/펠트문서.js -->
<!--펠트스킨-->
<style>
.친구칸{flex:0 1 300px;padding:0;overflow:hidden;text-align:center;}
.친구칸 img{display:block;width:100%;height:auto;}
.친구칸 figcaption{padding:9px 10px 13px;font-size:.78rem;line-height:1.5;}
.친구칸 .빔{aspect-ratio:1/1;display:grid;place-items:center;font-size:.78rem;opacity:.5;}
.친구줄{display:flex;flex-wrap:wrap;gap:14px;margin:1.15em 0;}
.눈칸{flex:0 1 260px;padding:0;overflow:hidden;text-align:center;}
.눈칸 img{display:block;width:100%;height:auto;}
.눈칸 figcaption{padding:7px 8px 10px;font-size:.76rem;}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">까몽</p>
  <ol>
    <li><a href="#s1"><span class="n">01</span> 표정 다섯</a></li>
    <li><a href="#s2"><span class="n">02</span> 눈만 크게 — 갈리나</a></li>
    ${시안있.length ? '<li><a href="#s2b"><span class="n">02½</span> 🆕 새 감정 시안 — 판정 대기</a></li>' : ''}
    <li><a href="#s3"><span class="n">03</span> 이 친구의 문법</a></li>
    <li><a href="#s4"><span class="n">04</span> 유호님 판정 자리</a></li>
  </ol>
</nav>

<div class="글">

<header class="표지">
  <img src="${인라인(파일(첫이름), 160)}" alt="" style="width:150px;border-radius:18px" aria-hidden="true">
  <div>
    <p class="꼭지">SYNK Loom · Blender Cycles 실굽기</p>
    <h1>까몽 — 몽글이의 밤빛 친구</h1>
    <p class="한줄">몽글이 곁의 <b>밤빛 친구 까몽</b>. 꼬리 지느러미 한쪽은 <b>몽글이가 코랄 펠트로 기워 준 것</b>이다 —
    「부족한 반쪽을 친구가 채운다」를 공방 문법(바느질)으로 말한다.</p>
    <p class="메타">자동 생성 · <code>node tools/까몽시트.js</code> ·
    렌더 ${표정들.length - 없는것.length}/${표정들.length}장 · 재질·조명·무대는 <code>요소굽기.py</code> 정본을 런타임으로 빌린다</p>
  </div>
</header>

${벌어짐분 > 90 ? `<div class="유리 알림 듦"><b>⚠ 이 격자는 «섞여» 있다.</b> 가장 오래된 컷과 새 컷이
<b>${벌어짐분}분</b> 벌어져 있다 — 그 사이에 굽기 자가 바뀌었다면 옛 컷과 새 컷을 나란히 보고 계신 것이다.
칸마다 찍힌 시각을 확인하시고, 어긋나면 전량을 다시 구운 뒤 이 지면을 다시 만든다.</div>`
    : `<div class="유리 알림 듦"><b>다섯 컷은 한 판에서 났다</b> — 가장 오래된 것과 새 것의 간격 <b>${벌어짐분}분</b>.
    옛 컷이 섞여 있지 않다는 뜻이다.</div>`}

<h2 id="s1" class="듦"><span class="번호">01</span><span>표정 다섯</span></h2>
<p class="듦">마스코트 정본 5종 문법 그대로다 — <b>본체 · 눈감음 · 눈웃음 · 우34 · 좌34</b>.
34판은 <b>몸만</b> 돌아앉는다: 무대·카메라·조명이 그대로여야 다섯 장이 «한 세트»로 읽힌다.</p>
<div class="친구줄">${다섯줄}</div>

<h2 id="s2" class="듦"><span class="번호">02</span><span>눈만 크게 — 표정이 갈리나</span></h2>
<div class="유리 알림 듦"><b>이 줄이 이 지면의 본론이다.</b> 08-25 조율 실측에서 눈감음과 눈웃음이
<b>거의 같은 그림</b>으로 나왔다(둘 다 두꺼운 ∧ 한 덩이). 한 장씩 보면 둘 다 멀쩡해서 안 보인다 —
<b>나란히 놓아야만</b> 보인다.</div>
<div class="친구줄">${눈줄}</div>
${시안있.length ? `
<h2 id="s2b" class="듦"><span class="번호">02½</span><span>🆕 새 감정 시안 ${시안있.length} — 판정 대기</span></h2>
<div class="유리 알림 듦"><b>이 줄은 «아직 정본이 아니다».</b> 조율판(700px·40샘플)이라 위 다섯(1024px·96샘플)과
<b>규격이 다르다</b> — 털의 또렷함으로 비교하지 마시고 <b>«눈의 모양»만</b> 보시면 된다.
까닭 = 감정 어휘는 설계에 <b>열 가지</b>인데 실물이 셋뿐이었고(트랙 §2-J), 몽글이 쪽은 정본이 «사진 투영»이라
블렌더로 못 굽지만 <b>까몽은 표정이 코드라 진짜 렌더로 낼 수 있다</b>. 채울 수 있는 쪽부터 채운다.
<br><b>유호님이 하실 것</b> — 셋을 각각 «쓴다 / 고친다 / 버린다». 쓰기로 하신 것만 정본 규격(1024px·96샘플)으로
다시 굽고, 그때 위 «표정 다섯» 자리로 올라간다. 다시 굽는 값은 장당 1.1분이다.</div>
<div class="친구줄">${시안줄}</div>
<p class="듦">눈만 크게 — 이 셋의 판정 축은 <b>눈 하나</b>다:</p>
<div class="친구줄">${시안눈줄}</div>` : ''}

<h2 id="s3" class="듦"><span class="번호">03</span><span>이 친구의 문법</span></h2>
<ul class="듦">
  <li><b>몸</b> — Ink 펠트. 어두운 몸이라 받침은 밝은 Oat 천이다(오브 명품판 ③ 「어두운 염료 → 다린천」).
      Ink Deep 은 몸색으로 안 쓴다 — 알베도 0.002 라 결이 통째로 죽는다.</li>
  <li><b>눈</b> — Meadow 구슬. 동공이 눈의 70%(초록은 얇은 테두리) · 반짝 한 점 · 평소 크기.
      <b>반려를 두 번 거친 값이다</b>: 1판 「조금 무섭게 생겼다」(동공이 절반이라 노려보였다) ·
      2판 「너무 크다 — 놀란 표정의 크기」.</li>
  <li><b>꼬리</b> — 몸 오른쪽 허리에서 나와 밖으로 돌아 내려간다. 몸 털의 40% 길이라 <b>보송한 몸에서 «결»로 갈린다.</b>
      길은 3차원이 아니라 <b>화면 좌표</b>로 적혀 있다 — 깊이로 가는 호는 카메라가 못 보기 때문이다(v6~v10 이 그것으로 헤맸다).</li>
  <li><b>꼬리 등의 시침 여덟</b> — 이 지면에서 가장 중요한 여덟 땀이다. 어두운 몸에 어두운 꼬리는 형태로 안 갈리는데,
      조명은 <code>요소굽기.py</code> 정본이 쥐고 몸색은 Ink 하나뿐이라 <b>남는 손잡이가 실 하나</b>였다. 실이 그리는 선이
      곧 꼬리의 «길»이고, 동시에 <b>이 아이 자체가 꿰매어 만들어진 것</b>이 된다.</li>
  <li><b>꼬리 지느러미</b> — <b>잎사귀로 재단</b>한 펠트 두 장이 꼬리 «끝을 물고» 위·아래로 116° 벌어진다(상어 꼬리의 두 엽).
      위가 <b>몽글이가 기워 준 Coral</b>(+ Stitch 실땀 넷), 아래가 제 것. 아래가 조금 작다 — <b>짝이 안 맞아야 «기운» 것이 읽힌다.</b>
      네모로 재단했더니 «꼬리표»로, 꼬리 옆에 나란히 눕혔더니 «천 위의 두 조각»으로 읽혔다.</li>
  <li><b>실이 둘이다</b> — <b>표정 실 = Meadow(눈동자와 같은 초록)</b> · <b>바느질 실 = Stitch(크림)</b>.
      가르는 까닭: 표정은 «눈»이라 눈동자와 같은 색이어야 「같은 눈이 감겼다」로 읽히고,
      꼬리 등 시침·지느러미 기운 자국은 «바느질»이라 공방 실이 맞다.
      <b>유호 반려 08-26</b> 「눈동자가 초록색인데 눈 감을 때 하얀색 눈꺼풀이 맞아?」 — 몽글이는 뜬 눈도 실 자수라
      감아도 같은 실인데, 까몽은 뜬 눈이 «구슬»이라 감을 때 재질과 색이 둘 다 바뀌어 «흰 눈꺼풀»로 읽혔다.</li>
  <li><b>발이 없다</b> — 몽글이도 없다. 미니멀이 세계관 문법이다(검정 속 검정이라 식별도 0이었다).</li>
</ul>

<h2 id="s4" class="듦"><span class="번호">04</span><span>유호님 판정 자리</span></h2>
<ol class="듦">
  <li><b>이름</b> — ✅ <b>까몽</b>으로 정해졌다(유호 확정 08-25). 까맣다 + 몽글의 «몽» —
      형제 이름이면서 몽골 학생이 발음하기 쉽다. 파일·코드 접두는 <code>까몽_</code>.</li>
  <li><b>꼬리</b> — ✅ 다시 만들었다(유호 지시 08-25 「꼬리까지 제대로 만들어주고」 · 조율판 여덟 판).
      옛 판은 마디 다섯이 몸 털에 묻혀 지느러미 둘만 «천 위의 두 조각»이었다. 지금은 <b>길·굵기·털 길이·시침</b> 넷을
      한꺼번에 걸었다 — 하나만 걸면 상쇄된다(NPC 3판에서 두 판을 그렇게 버렸다).</li>
  <li><b>누끼판</b>(<code>투명=1</code>) — ${누끼줄}.
      «있으면 좋은 것»이 아니라 <b>입장권</b>이다: 2D live·4D 워프(<code>tools/워프시연.js</code>)는
      알파 실루엣에서 깊이를 역산하니, 배경천이 박힌 컷은 실루엣이 프레임 전체가 되어 깊이가 통째로 거짓이 된다.
      받침천을 걷은 캐릭터 판은 <b>한 장</b>으로 낸다(받이가 0이라 접지 패스는 빈 그림이다 — 08-26 수리).</li>
</ol>

<footer class="메타">렌더 = <code>${esc(path.relative(루트, 방).replace(/\\/g, '/'))}/</code> ·
굽기 = <code>tools/몽글친구굽기.py</code>(Blender · Cycles · 요소굽기 앵커 치환) ·
지면 = <code>tools/펠트문서.js</code>(Loom L4).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `까몽-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  console.log(`■ 까몽 시안  ${path.relative(루트, 출력)}  `
    + `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 렌더 ${표정들.length - 없는것.length}/${표정들.length})`);
}

if (require.main === module) main();
