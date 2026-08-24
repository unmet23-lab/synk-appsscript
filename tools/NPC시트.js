#!/usr/bin/env node
/**
 * NPC 시트 — `tools/NPC굽기.js` 가 구운 20장을 **한 지면**에 세운다.
 *
 * ■ 왜 있나
 *   🔑 **굽기와 «판정 지면»은 한 벌이다**(트랙 §0 · 08-24 에 세 번 값을 치르고 얻은 규율).
 *     굽고 안 그리면 아무도 그 굽기를 못 본다 — 유호님은 폴더가 아니라 지면을 보신다.
 *   그리고 이 갈래는 특히 그렇다: 반려문이 「모든 npc가 다 똑같이 생겼고」였다.
 *   **「다 똑같은가」는 한 장씩으로는 원리상 판정이 안 된다** — 넷을 나란히 놓아야만 보인다.
 *
 * ■ 표는 코드에서 읽는다
 *   역형상(크기·비례·각짐)을 `NPC세트굽기.py` 에서 «파싱해» 싣는다. 손으로 옮겨 적으면
 *   형상을 고칠 때마다 지면이 낡고, 그 낡음은 아무도 안 본다(이 저장소가 여러 번 밟은 자리).
 *
 * 사용:  node tools/NPC시트.js [--방 docs/캐릭터/NPC공방_0824] [--폭 300]
 *        → docs/NPC_시안.html
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
const 방 = path.resolve(루트, 인자['방'] || path.join('docs', '캐릭터', 'NPC공방_0824'));
const 출력 = path.join(루트, 'docs', 'NPC_시안.html');
const 미리폭 = parseInt(인자['폭'] || '300', 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const { 무대들, 역들, 상태들 } = require('./NPC굽기.js');

const 역뜻 = {
  boss: ['사장님', '가로 타원 · 넷 중 가장 크다 — 넉넉한 얼굴. 나비넥타이와 수염 두 땀.'],
  prof: ['교수님', '세로 타원 · 길쭉한 얼굴 — 책의 세로결. 동그란 안경테가 눈을 감싼다.'],
  lead: ['실무자', '정원 — 어느 쪽으로도 안 늘어난 몸. 매듭타이 하나.'],
  insp: ['검사관', '각진 가로 블록 · 넷 중 가장 작다 — 도장·서류의 각. 치켜올린 눈썹 두 땀.'],
};
const 상태뜻 = {
  calm: ['평상', '기본 얼굴 — 학생이 아직 아무것도 안 한 자리.'],
  lean: ['듣는다', '몸을 앞으로 −13° · 눈이 조금 올라온다. 학생이 말하는 중.'],
  win: ['흡족', '+5° 로 젖히고 «>< 찡긋» — 유호 문법. 맞혔을 때.'],
  back: ['물러선다', '뒤돌아 등을 보인다 — 압박이 풀렸거나 차례가 끝났다.'],
};
const 무대뜻 = {
  벨: '호출 — 이 게임이 «부름에 답하는» 것임을 머리에서 말한다.',
  책: '수업 — 배운 것을 꺼내 쓰는 자리.',
  클립보드: '점검 — 오늘 무엇을 했는지 적히는 자리.',
  도장: '판정 — 찍히면 끝난다. 인주 자국까지 한 장면에 있다.',
};

/** 역형상 표를 `NPC세트굽기.py` 에서 읽는다 — 손으로 옮겨 적으면 지면이 조용히 낡는다. */
function 역형상읽기() {
  const 원문 = fs.readFileSync(path.join(루트, 'tools', 'NPC세트굽기.py'), 'utf8');
  const 표 = {};
  const 재 = /'(boss|prof|lead|insp)':\s*\('([^']+)',\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/g;
  let m;
  while ((m = 재.exec(원문)) !== null) {
    표[m[1]] = { 형태: m[2], 가로: +m[3], 세로: +m[4], 크기: +m[5], 각짐: +m[6] };
  }
  return 표;
}

/** 렌더 한 장 → webp data URI. 실패는 던진다 — 빈 값으로 물러서면 그림 없는 칸이 조용히 나간다. */
function 인라인(파일, 폭) {
  const 임시 = path.join(os.tmpdir(), `NPC시트-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '84', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

function main() {
  if (!fs.existsSync(방)) {
    console.error(`🔴 렌더 방이 없다 — \`node tools/NPC굽기.js\` 를 먼저 돌린다.\n   ${방}`);
    process.exit(1);
  }
  const 있나 = (이름) => fs.existsSync(path.join(방, `${이름}.png`));
  const 없는것 = [...무대들.map((s) => `무대_${s}`), ...역들.flatMap((r) => 상태들.map((s) => `${r}-${s}`))]
    .filter((n) => !있나(n));
  /* 「합계 = 있다 + 없다」로 찍는다 — 조용한 0 을 막는다(유호 지시 「합계 = 갈래+갈래」). */
  console.log(`■ NPC 시트 — 합계 20 = 있다 ${20 - 없는것.length} + 없다 ${없는것.length}`
    + (없는것.length ? ` (${없는것.join(', ')})` : ''));
  if (없는것.length === 20) { console.error('🔴 한 장도 없다 — 굽기부터.'); process.exit(1); }

  const 형상 = 역형상읽기();
  const 칸 = (이름, 딱지) => (있나(이름)
    ? `<figure class="유리 잔잔 NPC칸"><img src="${인라인(path.join(방, `${이름}.png`), 미리폭)}" alt="${esc(이름)}">
       <figcaption>${esc(딱지)}</figcaption></figure>`
    : `<figure class="유리 잔잔 NPC칸 빈칸"><div class="빔">아직 안 구웠다</div>
       <figcaption>${esc(딱지)}</figcaption></figure>`);

  process.stdout.write('  무대 인라인… ');
  const 무대줄 = 무대들.map((s) => 칸(`무대_${s}`, s)).join('');
  console.log('됐다');

  const 배지줄들 = 역들.map((r) => {
    process.stdout.write(`  ${r} 인라인… `);
    const 줄 = 상태들.map((s) => 칸(`${r}-${s}`, `${r} · ${상태뜻[s][0]}`)).join('');
    console.log('됐다');
    const f = 형상[r] || {};
    return `<h3 class="듦">${esc(역뜻[r][0])} <code>${r}</code>
        <span class="메타">— ${esc(f.형태 || '?')} · 가로 ${f.가로} · 세로 ${f.세로} · 크기 ${f.크기}${f.각짐 ? ` · 각짐 ${f.각짐}` : ''}</span></h3>
      <p class="듦">${esc(역뜻[r][1])}</p>
      <div class="NPC줄">${줄}</div>`;
  });

  const 첫 = 있나('무대_벨') ? 인라인(path.join(방, '무대_벨.png'), 320)
    : 인라인(path.join(방, `${[...무대들.map((s) => `무대_${s}`), ...역들.flatMap((r) => 상태들.map((s) => `${r}-${s}`))].find(있나)}.png`), 320);

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NPC 배지 — 무대와 배우</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/NPC시트.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 렌더 = ${path.relative(루트, 방).replace(/\\/g, '/')} (Blender Cycles · tools/NPC굽기.js) · 지면 = tools/펠트문서.js -->
<!--펠트스킨-->
<style>
.NPC칸{flex:0 1 200px;padding:0;overflow:hidden;text-align:center;}
.NPC칸 img{display:block;width:100%;height:auto;}
.NPC칸 figcaption{padding:8px 8px 11px;font-size:.78rem;}
.NPC칸 .빔{aspect-ratio:900/738;display:grid;place-items:center;font-size:.78rem;opacity:.5;}
.NPC줄{display:flex;flex-wrap:wrap;gap:12px;margin:1.15em 0;}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">NPC 배지</p>
  <ol>
    <li><a href="#s1"><span class="n">01</span> 무대 — 이 게임이 뭔지</a></li>
    <li><a href="#s2"><span class="n">02</span> 배우 — 네 역 × 네 상태</a></li>
    <li><a href="#s3"><span class="n">03</span> 왜 이 형상인가</a></li>
  </ol>
</nav>

<div class="글">

<header class="표지">
  <img src="${첫}" alt="" style="width:150px;border-radius:18px" aria-hidden="true">
  <div>
    <p class="꼭지">SYNK Loom · Blender Cycles 실굽기</p>
    <h1>NPC 배지 — 무대와 배우</h1>
    <p class="한줄">무대 넷이 <b>이 게임이 뭔지</b>를 말하고, 배우 열여섯이 <b>학생 답에 반응한다.</b>
    재질·조명·무대는 <code>요소굽기.py</code> 정본을 런타임으로 빌린다 — 요소 156장과 <b>같은 세계의 물건</b>이다.</p>
    <p class="메타">자동 생성 · <code>node tools/NPC굽기.js</code> → <code>node tools/NPC시트.js</code> ·
    렌더 ${20 - 없는것.length}장 · 지면 = Loom L4 · 색 = 디자인_토큰.json</p>
  </div>
</header>

<div class="유리 알림 듦"><b>「다 똑같이 생겼다」는 한 장씩으로는 판정이 안 된다.</b>
유호님 반려문이 그것이었고(08-24), 자로 재니 정확했다 — 네 역이 <b>98.5~99.4% 같은 그림</b>이었다.
그래서 이 지면은 <b>넷을 반드시 나란히</b> 세운다. 한 칸씩 예쁜지가 아니라 <b>옆칸과 다른지</b>를 보는 지면이다.</div>

<h2 id="s1" class="듦"><span class="번호">01</span><span>무대 — 이 게임이 뭔지 (${무대들.length}장)</span></h2>
<p class="듦">미션 카드 «머리»에 놓인다. 학생이 안내 없이 「뭘 하는 자리인지」 알아야 기능이 완성이다(자기설명 축).</p>
<ul class="듦">${무대들.map((s) => `<li><b>${esc(s)}</b> — ${esc(무대뜻[s] || '')}</li>`).join('')}</ul>
<div class="NPC줄">${무대줄}</div>

<h2 id="s2" class="듦"><span class="번호">02</span><span>배우 — ${역들.length}역 × ${상태들.length}상태 (${역들.length * 상태들.length}장)</span></h2>
<p class="듦">상태 넷은 «압박 3단 + 물러섬»이다:
${상태들.map((s) => `<b>${esc(s)}</b> ${esc(상태뜻[s][1])}`).join(' · ')}</p>
${배지줄들.join('\n')}

<h2 id="s3" class="듦"><span class="번호">03</span><span>왜 이 형상인가 — 세 판의 기록</span></h2>
<p class="듦"><b>1판(반려)</b> — 넷의 몸이 같았다: 같은 반지름 0.74 · 같은 Oat · 같은 털 19000 · 같은 22땀 ·
같은 눈 자리. <b>다른 것은 소품 하나뿐</b>(나비넥타이/안경/넥타이/모자챙)이었다.
자로 재니 역끼리 다른 화소가 <b>0.6~1.5%</b>, 즉 넷이 98.5~99.4% 같은 그림이었다.</p>
<p class="듦"><b>2판(처방 ② 착수)</b> — 크기·비례를 갈랐다. 「다른 화소」는 5.8배로 좋아졌는데,
<b>실루엣만 떼어 재니 lead 와 insp 가 1.003배 — 같은 크기였다.</b>
🔑 <b>정원이 버리는 네 귀를 둥근사각이 도로 채운다.</b> 크기배 하나로는 원과 사각을 못 가른다.
그리고 이 상쇄는 「다른 화소 %」로는 <b>원리상 안 보인다</b> — 주인공이 화면의 31%뿐이라 배경이 희석한다.</p>
<p class="듦"><b>3판(지금 · 유호 지시 「lead 랑 insp 더 갈라서 굽자」)</b> — 손잡이 <b>셋을 한꺼번에</b> 건다.
하나만 걸면 또 상쇄된다.</p>
<table class="듦"><thead><tr><th>역</th><th>형태</th><th>가로</th><th>세로</th><th>크기</th><th>각짐</th></tr></thead><tbody>
${역들.map((r) => {
    const f = 형상[r] || {};
    return `<tr><td><b>${r}</b> ${esc(역뜻[r][0])}</td><td>${esc(f.형태 || '?')}</td>` +
      `<td>${f.가로}</td><td>${f.세로}</td><td>${f.크기}</td><td>${f.각짐 || '—'}</td></tr>`;
  }).join('\n')}
</tbody></table>
<p class="듦">판정은 눈이 아니라 자로 한다 — <code>node tools/NPC형상대조.py --방 ${esc(path.relative(루트, 방).replace(/\\/g, '/'))}</code>
가 역끼리 다른 화소 · <b>실루엣 겹침</b> · 실루엣 크기비 · 몸 채도를 한 번에 낸다.</p>

<footer class="메타">렌더 = <code>${esc(path.relative(루트, 방).replace(/\\/g, '/'))}/</code> ·
굽기 = <code>node tools/NPC굽기.js</code>(Blender · Cycles · 색관리 PBR 중립) ·
장면 = <code>tools/NPC세트굽기.py</code> · 지면 = <code>tools/펠트문서.js</code>(Loom L4).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `NPC-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  console.log(`■ NPC 시안  ${path.relative(루트, 출력)}  `
    + `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 렌더 ${20 - 없는것.length}/20)`);
}

if (require.main === module) main();
