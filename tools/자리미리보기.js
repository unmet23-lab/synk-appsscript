#!/usr/bin/env node
/*
 * 자리 미리보기 — 구운 «자리 배경» 위에 마스코트를 실제로 세워 본다 (2026-09-08).
 *
 * ■ 왜 있나 — 트랙 §0-공방 「가장 큰 빈칸 = 구운 것이 화면에 없다」
 *   09-08 실측: 구운 이름 1,028가지 중 사람이 보는 지면·앱이 파일 이름으로 부르는 것이 «약 10가지»다.
 *   자리 배경 15장도 목록 지면에만 있었다. 그런데 이 그림들의 본디 자리는 목록이 아니라
 *   **마스코트가 서는 앱 화면**이다(`docs/살아있는자리_설계_v1.md` §72 — 「내 방」이 앱의 홈).
 *   ⇒ 배경과 마스코트를 «같은 화면»에 얹어, 자산이 실제 쓰임에서 어떻게 보이는지 낸다.
 *
 * ■ 🔴 이것이 «앱 구현»은 아니다
 *   유호 확정 09-04 「구현은 최대한 늦추고 홍보를 먼저」와 §0-재설계(착수 시점 = 유호 자리)는 그대로다.
 *   여기서 짓는 것은 «자산이 쓰임에서 어떻게 보이나»를 재는 지면 하나다. 앱 코드는 한 줄도 안 건드린다.
 *
 * ■ 왜 손 HTML 이 아니라 생성기인가
 *   손으로 적은 지면은 자산이 바뀌어도 안 따라온다(`tools/지면얹기.js` 머리말 F630).
 *   자리 목록·파일 이름은 `docs/공방/계획.json` 이 쥐므로 여기서 손으로 적지 않는다.
 *
 * ■ 자가 못 재는 것 — 밝혀 둔다
 *   마스코트가 서는 «자리와 크기»는 여기서 눈으로 고른 값이다(설계의 「아래 3분의 1」을 따랐다).
 *   진짜 앱에서는 그 값이 코드에 서고, 그때 이 지면이 아니라 앱이 정본이 된다.
 *
 * 쓰기: node tools/자리미리보기.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 계획경로 = path.join(루트, 'docs/공방/계획.json');
const 낼곳 = path.join(루트, 'docs/공방/자리_미리보기.html');
const 마스코트방 = path.join(루트, 'docs/캐릭터/화면_1024');

/* 자리마다 누가 서나 — 눈으로 고른 값이다(설계가 자리별 마스코트를 못 박지 않는다.
 * 「내 방」은 학생이 고른 마스코트가 서므로 셋 다 맞다). 시간대·결에 맞춰 표정을 골랐다. */
const 세울것 = {
  '내 방 낮': ['몽글', '본체'],
  '내 방 밤': ['몽글', '졸림'],
  '옷 가게 안': ['몽글', '궁금함'],
  '교실': ['까몽', '집중'],
  '복도': ['몽글', '본체'],
  '운동장': ['마린', '응원'],
  '우편함 앞': ['몽글', '감동'],
  '창가 책상': ['까몽', '집중'],
  '눈 오는 창': ['몽글', '눈웃음'],
  '봄 들판': ['몽글', '별눈'],
  '여름 바다': ['마린', '감탄'],
  '가을 언덕': ['까몽', '감동'],
  '차강사르 게르': ['마린', '인사'],
  '별 보는 지붕': ['몽글', '눈감음'],
  '카페 안': ['까몽', '안도'],   // 「몰래기쁨」은 까몽에 없다(마린만) — 자가 09-08 에 잡았다
};

function 자리들() {
  const 계획 = JSON.parse(fs.readFileSync(계획경로, 'utf8'));
  const 묶 = (계획.제미나이?.묶음 || []).find((m) => m.이름 === '자리 배경 — 학생');
  if (!묶) throw new Error('계획.json 에 「자리 배경 — 학생」 묶음이 없다');
  return 묶.것들 || [];
}

/* 🔑 «있는 파일»만 세운다 — 없는 것을 조용히 건너뛰면 지면이 반만 서고도 초록으로 보인다. */
function 고른다() {
  const 선것 = [], 빠진것 = [];
  for (const 것 of 자리들()) {
    const 배경 = path.join(루트, 'docs/Loom_자산/구움', 것.파일 || '');
    const [누구, 표정] = 세울것[것.이름] || [];
    const 마 = 누구 ? path.join(마스코트방, `${누구}_${표정}.webp`) : null;
    if (!것.파일 || !fs.existsSync(배경)) { 빠진것.push(`${것.이름} — 배경 없다(${것.파일})`); continue; }
    if (!누구) { 빠진것.push(`${것.이름} — 누가 설지 안 적혔다`); continue; }
    if (!fs.existsSync(마)) { 빠진것.push(`${것.이름} — 마스코트 없다(${누구}_${표정}.webp)`); continue; }
    선것.push({ 이름: 것.이름, 규격: 것.규격, 배경: `../Loom_자산/구움/${것.파일}`,
                마스코트: `../캐릭터/화면_1024/${누구}_${표정}.webp`, 누구, 표정 });
  }
  return { 선것, 빠진것 };
}

const { 선것, 빠진것 } = 고른다();

/* 🔴 셋의 몸이 그림 안에서 차지하는 자리가 다르다 — 캔버스로 맞추면 마린만 작아진다.
 *   그 값을 여기 손으로 적지 않고 «재서» 쓴다(기억 constant-known-in-two-places). */
const { spawnSync } = require('child_process');
const 잰것 = (() => {
  if (!선것.length) return {};
  const 파일 = 선것.map((x) => path.join(마스코트방, path.basename(x.마스코트)));
  const r = spawnSync('python', [path.join(__dirname, '마스코트몸재기.py'), ...파일],
    { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
  if (r.status !== 0) {
    console.error(`🔴 몸 재기가 ${r.status} 로 끝났다 — ${String(r.stderr).slice(0, 200)}`);
    process.exit(1);
  }
  return JSON.parse(r.stdout);
})();

const 몸높이몫 = 0.24;   // 몸 높이가 화면 높이에서 차지할 몫 — 자리에 «서 있는» 크기
const 발선몫 = 0.07;     // 발이 화면 바닥에서 뜨는 몫

const 칸 = 선것.map((x) => {
  const 잼 = 잰것[path.basename(x.마스코트)];
  if (!잼) { 빠진것.push(`${x.이름} — 몸을 못 쟀다`); return ''; }
  /* 그림 표시 높이 = 원하는 «몸» 높이 ÷ 그림 안에서 몸이 차지하는 몫 */
  const 그림높이 = 몸높이몫 / 잼.몸높이비;
  /* 발선 = 바닥에서 띄울 몫 − 그림 아래쪽 빈 자리(그만큼 더 내려야 발이 그 자리에 온다) */
  const 아래 = 발선몫 - 그림높이 * 잼.아래여백비;
  return { ...x, 그림높이: (그림높이 * 100).toFixed(1), 아래: (아래 * 100).toFixed(1) };
}).filter(Boolean).map((x) => `
    <figure class="자리">
      <div class="폰" style="--bg:url('${x.배경}')">
        <img class="마" src="${x.마스코트}" alt="${x.누구}" loading="lazy"
             style="height:${x.그림높이}%; bottom:${x.아래}%">
      </div>
      <figcaption>
        <b>${x.이름}</b>
        <span>${x.누구} · ${x.표정} <i>${x.규격}</i></span>
      </figcaption>
    </figure>`).join('');

const 글 = `<!doctype html>
<meta charset="utf-8">
<title>자리 미리보기 — 배경 위에 마스코트를 세운다</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- 🔴 손으로 고치지 마라 — node tools/자리미리보기.js 가 다시 뽑는다. -->
<style>
  :root { --paper:#FAF9F6; --ink:#26262A; --흐림:#78766F; --선:#E1DED8; }
  * { box-sizing:border-box }
  body { margin:0; background:var(--paper); color:var(--ink);
         font:16px/1.6 "Malgun Gothic","맑은 고딕",system-ui,sans-serif; }
  header { padding:32px 28px 8px; }
  h1 { margin:0 0 6px; font-size:28px; letter-spacing:-.2px }
  .왜 { margin:0; color:var(--흐림); max-width:70ch }
  .판 { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
        gap:26px 22px; padding:24px 28px 60px; }
  .자리 { margin:0 }
  /* 폰 화면 꼴 — 배경은 채우고 아래쪽(바닥)이 보이게 앉힌다.
     설계 「아래 3분의 1을 비운다」가 그 자리를 마스코트에게 준다. */
  .폰 { position:relative; aspect-ratio:9/16; border-radius:18px; overflow:hidden;
        border:1px solid var(--선); background-image:var(--bg);
        background-size:cover; background-position:center 62%; }
  /* 🔴 크기는 «폭»이 아니라 «몸 높이»로 맞춘다 — 셋의 실루엣이 다르다(치수 정본 §1 ·
     마린은 몸 폭이 캔버스의 0.49 라 폭으로 맞추면 혼자 절반이 된다).
     높이·발선 값은 tools/마스코트몸재기.py 가 재서 칸마다 박는다. */
  .마 { position:absolute; left:50%; transform:translateX(-50%); width:auto;
        filter:drop-shadow(0 5px 7px rgba(40,34,28,.30)) drop-shadow(0 1px 2px rgba(40,34,28,.22)); }
  figcaption { padding-top:9px; display:flex; flex-direction:column; gap:1px }
  figcaption b { font-size:15px }
  figcaption span { font-size:13px; color:var(--흐림) }
  figcaption i { font-style:normal; color:#A8A49C }
  .빠짐 { margin:0 28px 40px; padding:12px 16px; border-left:3px solid #D64541;
          background:#FDF3F2; color:#8A2F2C; font-size:14px; white-space:pre-line }
</style>
<header>
  <h1>자리 미리보기</h1>
  <p class="왜">구운 자리 배경 위에 마스코트를 실제로 세운 화면입니다. 목록이 아니라 «쓰임»을 봅니다.
     배경 ${선것.length}장 · 다시 뽑기 <code>node tools/자리미리보기.js</code> · ${new Date().toISOString().slice(0, 10)}</p>
</header>
${빠진것.length ? `<p class="빠짐">못 세운 것 ${빠진것.length} —\n${빠진것.join('\n')}</p>` : ''}
<div class="판">${칸}
</div>
`;

fs.writeFileSync(낼곳, 글, 'utf8');
console.log(`✅ ${path.relative(루트, 낼곳)} — 세운 것 ${선것.length} · 못 세운 것 ${빠진것.length}`);
for (const 줄 of 빠진것) console.log(`   ⚠ ${줄}`);
/* 🔴 한 장이라도 못 세우면 실패로 끝낸다 — 반만 선 지면이 초록으로 보이지 않게. */
if (빠진것.length) process.exitCode = 1;
