#!/usr/bin/env node
/**
 * 친구 시트 — `tools/몽글친구굽기.py` 가 구운 표정 다섯을 **한 지면**에 세운다.
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
 * 사용:  node tools/친구시트.js [--방 docs/캐릭터/친구공방_0825] [--폭 340]
 *        → docs/친구_시안.html
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
const 출력 = path.join(루트, 'docs', '친구_시안.html');
const 미리폭 = parseInt(인자['폭'] || '340', 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 표정 다섯 = 마스코트 정본 5종 문법 그대로. 이 목록이 굽기·시트의 공통 자다. */
const 표정들 = [
  ['본체', '정면 · 구슬눈', '평소 눈. 동공이 눈의 70% 라 초록은 얇은 테두리로만 남는다 — 반려 두 번을 거친 값이다.'],
  ['눈감음', '감은 눈 ⌒⌒', '작은 땀 다섯을 얕은 호 위에 늘어놓은 «수놓은 선». 큰 땀 셋이던 옛 판은 눈웃음과 같게 읽혔다.'],
  ['눈웃음', '웃는 눈 ∧∧', '가지 둘이 ±50° 로 꼭짓점에서 만난다. 각을 세워야 «감은 눈»과 갈린다.'],
  ['우34', '오른쪽 34°', '몸만 돌아앉는다 — 무대·카메라·조명은 그대로. 반짝은 회전 뒤에 놓아 키 라이트 쪽에 남는다.'],
  ['좌34', '왼쪽 34°', '우34 의 짝. 꼬리가 몸 오른쪽에 있어 이 판에서는 앞으로 돌아 나온다.'],
];

/** 렌더 한 장 → webp data URI. 실패는 던진다 — 빈 값으로 물러서면 그림 없는 칸이 조용히 나간다. */
function 인라인(파일, 폭) {
  const 임시 = path.join(os.tmpdir(), `친구시트-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '86', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

/** 눈 자리만 잘라 크게 — 「표정이 갈리나」는 얼굴 크기로는 안 보인다. */
function 눈확대(파일, 폭) {
  const 임시 = path.join(os.tmpdir(), `친구눈-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    /* 눈은 화면 가로 24~76% · 세로 20~44% 자리에 선다(카메라 고정이라 판마다 같다). */
    execFileSync('ffmpeg', ['-y', '-i', 파일,
      '-vf', `crop=iw*0.52:ih*0.24:iw*0.24:ih*0.20,scale=${폭}:-1`, '-quality', '88', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }
}

const 시각 = (ms) => new Date(ms).toLocaleString('ko-KR', { hour12: false });

function main() {
  if (!fs.existsSync(방)) {
    console.error(`🔴 렌더 방이 없다 — 굽기부터.\n   ${방}`);
    process.exit(1);
  }
  const 파일 = (이름) => path.join(방, `친구_${이름}.png`);
  const 있나 = (이름) => fs.existsSync(파일(이름));
  const 없는것 = 표정들.map(([n]) => n).filter((n) => !있나(n));
  /* 「합계 = 있다 + 없다」로 찍는다 — 조용한 0 을 막는다(유호 지시 「합계 = 갈래+갈래」). */
  console.log(`■ 친구 시트 — 합계 ${표정들.length} = 있다 ${표정들.length - 없는것.length} + 없다 ${없는것.length}`
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

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>몽글 친구 — 표정 다섯</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/친구시트.js — 손 편집 금지(재생성이 덮는다) -->
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
  <p class="꼭지">몽글 친구</p>
  <ol>
    <li><a href="#s1"><span class="n">01</span> 표정 다섯</a></li>
    <li><a href="#s2"><span class="n">02</span> 눈만 크게 — 갈리나</a></li>
    <li><a href="#s3"><span class="n">03</span> 이 친구의 문법</a></li>
    <li><a href="#s4"><span class="n">04</span> 유호님 판정 자리</a></li>
  </ol>
</nav>

<div class="글">

<header class="표지">
  <img src="${인라인(파일(첫이름), 160)}" alt="" style="width:150px;border-radius:18px" aria-hidden="true">
  <div>
    <p class="꼭지">SYNK Loom · Blender Cycles 실굽기</p>
    <h1>몽글 친구 — 표정 다섯</h1>
    <p class="한줄">몽글이 곁의 <b>밤빛 친구</b>. 꼬리 지느러미 한쪽은 <b>몽글이가 코랄 펠트로 기워 준 것</b>이다 —
    「부족한 반쪽을 친구가 채운다」를 공방 문법(바느질)으로 말한다.</p>
    <p class="메타">자동 생성 · <code>node tools/친구시트.js</code> ·
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

<h2 id="s3" class="듦"><span class="번호">03</span><span>이 친구의 문법</span></h2>
<ul class="듦">
  <li><b>몸</b> — Ink 펠트. 어두운 몸이라 받침은 밝은 Oat 천이다(오브 명품판 ③ 「어두운 염료 → 다린천」).
      Ink Deep 은 몸색으로 안 쓴다 — 알베도 0.002 라 결이 통째로 죽는다.</li>
  <li><b>눈</b> — Meadow 구슬. 동공이 눈의 70%(초록은 얇은 테두리) · 반짝 한 점 · 평소 크기.
      <b>반려를 두 번 거친 값이다</b>: 1판 「조금 무섭게 생겼다」(동공이 절반이라 노려보였다) ·
      2판 「너무 크다 — 놀란 표정의 크기」.</li>
  <li><b>꼬리 지느러미</b> — 왼쪽은 제 것(몸색), 오른쪽은 <b>몽글이가 기워 준 Coral 시트 + Stitch 실땀 넷</b>.
      퍼가 아니라 «재단한 펠트 면»이다 — 털 몸 사이에 면이 있어야 갈리고, «기워 붙인 패치» 서사와도 맞는다.</li>
  <li><b>표정 실</b> — Stitch(밝은 실). 몽글이는 짙은 실이지만 이 친구는 몸이 잉크라 짙은 실이 죽는다.</li>
  <li><b>발이 없다</b> — 몽글이도 없다. 미니멀이 세계관 문법이다(검정 속 검정이라 식별도 0이었다).</li>
</ul>

<h2 id="s4" class="듦"><span class="번호">04</span><span>유호님 판정 자리</span></h2>
<ol class="듦">
  <li><b>이름</b> — 아직 없다. 후보: <b>몽돌</b>(몽글의 «몽» 을 물려받은 실제 낱말 · 검고 둥근 갯돌) ·
      <b>까몽</b>(까맣다 + 몽) · 밤이 · 먹물이 · 까뭉이.</li>
  <li><b>꼬리가 안 보인다</b> — 마디 다섯이 몸 털에 묻혀, 지느러미 둘만 «천 위에 놓인 두 조각»으로 읽힌다.
      서사의 핵(기워 준 지느러미)이 꼬리에 안 붙어 있다. 고치려면 꼬리를 몸 밖으로 빼거나 올려야 하는데,
      그건 유호님이 「이대로」 하신 실루엣을 건드리는 일이라 <b>손대지 않고 여쭙는다</b>.</li>
  <li><b>누끼판</b> — 아직 없다(<code>투명=1</code>). 앱 지면에 얹는 단계의 재료다.</li>
</ol>

<footer class="메타">렌더 = <code>${esc(path.relative(루트, 방).replace(/\\/g, '/'))}/</code> ·
굽기 = <code>tools/몽글친구굽기.py</code>(Blender · Cycles · 요소굽기 앵커 치환) ·
지면 = <code>tools/펠트문서.js</code>(Loom L4).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `친구-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  console.log(`■ 친구 시안  ${path.relative(루트, 출력)}  `
    + `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 렌더 ${표정들.length - 없는것.length}/${표정들.length})`);
}

if (require.main === module) main();
