#!/usr/bin/env node
'use strict';
/**
 * 와펜 결 시안 — 「패치가 얼마나 깊어야 명품으로 읽히나」 판정 지면 (2026-09-03)
 *
 * ══ 왜 있나 ═══════════════════════════════════════════════════════════════
 *   유호 09-03: 「와펜숫자로 할게. 근데 폼폼숫자가 훨씬 더 명품화작업처럼보여.
 *   명도가 와펜숫자 털뭉치랑 아예 달라. 다시 제대로 구워야할것같은데?」
 *
 *   ⇒ 실측이 그 말을 뒷받침했다. 밝은 쪽(털 하이라이트) 밝기가 **와펜 167.1 · 폼폼 147.2**
 *      로 20 갈린다. 그런데 까닭이 굽기가 아니라 **레시피**라, 같은 조건으로 다시 구우면
 *      똑같이 나온다: 폼폼은 털 0.32 라 빛이 털 사이로 흩어져 «깊이»가 나는데,
 *      와펜은 0.08 이라 납작한 면이 정면으로 빛을 받아 뜬다.
 *
 * ══ 🔴 이 판의 맞바꿈 — 깊이를 얻으면 «패치»를 잃는다 ══════════════════════
 *   털을 늘릴수록 폼폼에 가까워진다. 그런데 와펜의 정체는 「달아 준 **패치**」이고,
 *   패치는 납작해야 패치다. 0.32 까지 가면 그냥 폼폼이 하나 더 생기는 것이지 와펜이 아니다.
 *   ⇒ 그래서 굽는 축이 «어느 것이 예쁜가»가 아니라 **「어디까지가 아직 패치인가」** 다.
 *      맨 오른쪽에 폼폼을 놓아 «넘어가면 어떻게 되는지»를 눈앞에 둔다.
 *
 * ══ 잰 것과 안 잰 것 ══════════════════════════════════════════════════════
 *   잰다: 밝은 쪽 10% 평균 밝기(털 하이라이트) · 가운데 몸 밝기. 숫자는 «보조»다 —
 *         색·미학 채택은 숫자로 안 한다(08-24 확정). 눈이 자고, 숫자는 눈이 본 것을 확인한다.
 *   안 잰다: 44px 로 줄였을 때의 인상. 그건 아래 실크기 줄이 «보여» 준다(재지 않는다).
 *
 * 통로: node tools/와펜시안.js   →  docs/와펜_시안.html
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 공방 = path.resolve(루트, 'docs', '캐릭터', '요소공방_0822');
const 현행방 = path.join(공방, '부품형태');
const 후보방 = path.join(공방, '와펜결_0903');
const 출력 = path.join(루트, 'docs', '와펜_시안.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 렌더 한 장 → webp data URI. 없으면 null — 호출부가 «못 구웠다»로 그린다.
 *  🔑 지면 «안»에 싣는다: 발행하면 바깥 자산은 CSP 가 조용히 막는다. */
function 인라인(파일, 폭) {
  if (!fs.existsSync(파일)) return null;
  const 임시 = path.join(os.tmpdir(), `와펜-${process.pid}-${path.basename(파일, '.png')}-${폭}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '86', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } catch { return null; } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

/** 밝기 — 「눈이 본 것」을 확인하는 보조 숫자. 자는 ffmpeg 한 통로다(파이썬을 안 부른다). */
function 밝기(파일) {
  if (!fs.existsSync(파일)) return null;
  try {
    /* 알파가 있는 화소만 남기고 1×1 로 줄여 평균색을 읽는다 — 배경(투명)이 평균을 안 끌어내린다.
     * 🔴 2026-09-04 — 알파를 읽는 함수 이름이 틀려 이 통로가 통째로 죽어 있었다.
     *   `a(X,Y)` 는 geq 에 없는 이름이라 ffmpeg 가 「Unknown function in 'a(X,Y)'」로 즉사했고,
     *   아래 catch 가 null 을 삼켜 **지면에 밝기 숫자가 한 번도 안 나왔다**(codex P1 `7acc4885a361`).
     *   실측(ffmpeg 8.1.2): a(X,Y) ❌ · alpha(X,Y) ✅. 알파 평면의 이름은 `alpha` 다.
     * ⚠ 「투명 화소가 평균을 끌어내리나」는 **안 재봤다** — 이 줄이 고친 것은 «죽은 통로»뿐이다. */
    const 임시 = path.join(os.tmpdir(), `와펜밝기-${process.pid}-${path.basename(파일, '.png')}.txt`);
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf',
      'format=rgba,geq=r=r(X\\,Y):g=g(X\\,Y):b=b(X\\,Y):a=alpha(X\\,Y),scale=1:1,format=rgb24',
      '-f', 'rawvideo', 임시], { stdio: 'ignore' });
    const b = fs.readFileSync(임시); try { fs.unlinkSync(임시); } catch { /* */ }
    if (b.length < 3) return null;
    return { rgb: [b[0], b[1], b[2]], L: 0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2] };
  } catch { return null; }
}

const 현행 = (이름, 폭 = 300) => 인라인(path.join(현행방, `${이름}.png`), 폭);
const 후보 = (이름, 폭 = 300) => 인라인(path.join(후보방, `${이름}.png`), 폭);

/* ── 다섯 판 — 왼쪽부터 «얕음 → 깊음», 맨 끝이 폼폼(넘어간 자리) ──────────────
 * 실크기 44px = 히어로수가 지면에서 앉는 크기(본문 17px 기준 2.6em). loom.js 가 쓴 값을 옮겼다. */
const 실크기 = 44;
const 줄 = [
  { 이름: '지금 판', 털: '0.08', 파일: path.join(현행방, 'E1_와펜숫자.png'), uri: 현행('E1_와펜숫자'), 곁: '유호님이 「떠 보인다」고 하신 그 판' },
  { 이름: 'a', 털: '0.16', 파일: path.join(후보방, 'E1a_와펜_털0.16.png'), uri: 후보('E1a_와펜_털0.16'), 곁: '두 배 — 패치를 지키면서 결만 세운다' },
  { 이름: 'b', 털: '0.24', 파일: path.join(후보방, 'E1b_와펜_털0.24.png'), uri: 후보('E1b_와펜_털0.24'), 곁: '세 배 — 여기부터 «방울»로 기울기 시작한다' },
  { 이름: 'c', 털: '0.16 · 밀도 22,000', 파일: path.join(후보방, 'E1c_와펜_털0.16_밀도22000.png'), uri: 후보('E1c_와펜_털0.16_밀도22000'), 곁: '길이 대신 «밀도»로 깊이를 낸 판' },
  { 이름: 'd', 털: '0.32', 파일: path.join(후보방, 'E1d_와펜_털0.32.png'), uri: 후보('E1d_와펜_털0.32'), 곁: '폼폼과 «같은» 길이 — 넘어간 자리' },
  /* ── 2차(09-03) — 털이 아니라 «납작함»을 만진 판 ────────────────────────────
     1차가 낸 답이 이 셋을 낳았다: 털을 폼폼과 같은 0.32 까지 늘려도 밝은 쪽이 160.1 에 그쳐
     폼폼(147.2)까지 12.9 가 남았다(처음 19.9 중 털이 메운 몫은 7뿐). 남은 것은 형태다 —
     납작한 원판은 정면 면적이 넓어 빛을 통째로 받고, 구는 가장자리로 빛이 흘러 떨어진다.
     기본 납작함은 0.3(아주 눌린 판)이고, 폼폼은 사실상 1.0(구)이다. 그 사이를 두 곳 찍었다. */
  { 이름: 'e', 털: '0.16 · 납작 0.45', 파일: path.join(후보방, 'E1e_와펜_납작0.45_털0.16.png'), uri: 후보('E1e_와펜_납작0.45_털0.16'), 곁: '살짝 부풀렸다 — 패치의 «옆면»이 처음으로 보이는 자리' },
  { 이름: 'f', 털: '0.16 · 납작 0.60', 파일: path.join(후보방, 'E1f_와펜_납작0.60_털0.16.png'), uri: 후보('E1f_와펜_납작0.60_털0.16'), 곁: '더 부풀렸다 — 여기서 «패치인가 방울인가»가 흔들린다' },
  { 이름: 'g', 털: '0.24 · 납작 0.45', 파일: path.join(후보방, 'E1g_와펜_납작0.45_털0.24.png'), uri: 후보('E1g_와펜_납작0.45_털0.24'), 곁: '부풀림에 털까지 — 둘을 함께 올린 판' },
  { 이름: '폼폼', 털: '0.32 · 구(1.0)', 파일: path.join(현행방, 'E2_폼폼숫자.png'), uri: 현행('E2_폼폼숫자'), 곁: '🔑 유호님이 「명품 같다」고 하신 판 — 이건 «후보가 아니라 자»다', 자 : true },
];

function 칸(x, 폭 = 210) {
  const m = 밝기(x.파일);
  const 수 = m ? `<span class="수">밝기 ${m.L.toFixed(0)}</span>` : '';
  if (!x.uri) {
    return `<figure class="유리 잔잔 결칸 없음${x.자 ? ' 자' : ''}"><div class="빈판">못 구웠다</div>
      <figcaption><b>${esc(x.이름)}</b><br>털 ${esc(x.털)}<br><span class="작게 흐린">${esc(x.곁)}</span></figcaption></figure>`;
  }
  return `<figure class="유리 잔잔 결칸${x.자 ? ' 자' : ''}"><img src="${x.uri}" alt="${esc(x.이름)}" style="max-width:${폭}px">
    <figcaption><b>${esc(x.이름)}</b> ${수}<br>털 ${esc(x.털)}<br><span class="작게 흐린">${esc(x.곁)}</span></figcaption></figure>`;
}

function main() {
  if (!fs.existsSync(현행방)) { console.error(`🔴 현행 렌더 방이 없다 — 대조가 안 선다.\n   ${현행방}`); process.exit(1); }
  const 있음 = 줄.filter((x) => x.uri).length;
  const 없음 = 줄.length - 있음;

  const 실줄 = 줄.filter((x) => x.uri).map((x) =>
    `<span class="실칸"><img src="${x.uri}" alt="" style="width:${실크기}px;height:${실크기}px;object-fit:contain">
     <span class="작게 흐린">${esc(x.이름)}</span></span>`).join('');

  /* 본문 흉내 — 히어로수는 «글줄 안»에 앉는 부품이다. 홀로 보면 늘 예쁘고, 글 옆에서 갈린다. */
  const 글줄 = 줄.filter((x) => x.uri).map((x) =>
    `<p class="글줄본"><img src="${x.uri}" alt="" class="줄알">
      <span>학생이 이번 달에 넘긴 장면이 <b>이만큼</b>입니다. 숫자 하나가 문단의 눈이 되는 자리라,
      지면당 <b>한 점</b>만 놓습니다.</span></p>`).join('\n');

  const 표지그림 = (줄.find((x) => x.uri && !x.자) || {}).uri;

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>와펜 결 판정</title>
<!-- 브랜드 서체(SUIT)는 «굽기»가 지면 안에 싣는다 — 바깥에서 부르면 아티팩트 CSP 가 조용히 막는다 -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/와펜시안.js — 손 편집 금지(재생성이 덮는다) -->
<!--펠트스킨-->
<style>
/* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
.결줄{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:var(--칸);margin:var(--단) 0;}
.결칸{margin:0;padding:var(--참);text-align:center;}
.결칸 img{display:block;width:100%;height:auto;border-radius:12px;}
.결칸 figcaption{margin-top:var(--틈);font-size:.8rem;color:var(--ash);line-height:1.5;}
.결칸 .수{font-variant-numeric:tabular-nums;font-size:.74rem;color:var(--ash2);}
.결칸.자{outline:1px dashed rgba(var(--coral-rgb),.45);outline-offset:4px;}
.결칸.없음 .빈판{display:grid;place-items:center;min-height:130px;border-radius:12px;
  border:1px dashed rgba(var(--coral-rgb),.5);color:var(--coral);font-size:.82rem;font-weight:700;}
.실줄{display:flex;align-items:flex-end;gap:26px;flex-wrap:wrap;}
.실칸{display:inline-grid;place-items:center;gap:.35em;}
.글줄본{display:flex;align-items:flex-start;gap:.7em;margin:var(--칸) 0;max-width:62ch;}
.글줄본 .줄알{width:${실크기}px;height:${실크기}px;object-fit:contain;flex:0 0 auto;}
@media print{ .결칸 img{max-width:150px;} }
</style>

<header class="표지">
  ${표지그림 ? `<div class="오브" aria-hidden="true" style="background-image:url(${표지그림});background-size:cover"></div>`
             : '<div class="오브" aria-hidden="true">결</div>'}
  <div>
    <p class="꼭지">LOOM · 부품 공방</p>
    <h1>패치는 어디까지 깊어질 수 있나</h1>
    <p class="한줄">와펜의 털을 늘리면 결이 깊어집니다. 그런데 너무 늘리면 패치가 아니라 방울이 됩니다.
       그 경계를 눈으로 고르는 판입니다.</p>
    <p class="메타">2026-09-03 · 굽기 = 허깅페이스 클라우드 4잡 · 지면 = node tools/와펜시안.js</p>
  </div>
</header>

<div class="유리 알림 듦"><p class="작게" style="margin:0">
  🔴 <b>유호 지적 09-03</b> — 「폼폼숫자가 훨씬 더 명품화작업처럼보여. 명도가 와펜숫자 털뭉치랑
  아예 달라. 다시 제대로 구워야할것같은데?」 <b>재보니 맞습니다</b>(밝은 쪽 밝기 와펜 167 · 폼폼 147).
  다만 까닭이 굽기가 아니라 <b>레시피</b>라, 같은 조건으로 다시 구우면 똑같이 나옵니다 —
  폼폼은 털이 네 배 길어 빛이 털 사이로 흩어지고, 와펜은 납작한 면이 정면으로 빛을 받습니다.</p></div>

<h2 id="s1" class="듦"><span>맞바꿈 — 깊이를 얻으면 «패치»를 잃는다</span></h2>
<p class="듦">와펜의 정체는 <b>「달아 준 패치」</b>입니다. 패치는 납작해야 패치입니다.
   털을 폼폼만큼 늘리면 결은 살지만 그건 방울이 하나 더 생기는 것이지 와펜이 아닙니다.
   그래서 고르실 것은 «어느 것이 예쁜가»가 아니라 <b>「어디까지가 아직 패치인가」</b> 입니다.</p>
<div class="유리 알림 조용 듦"><p class="작게" style="margin:0">
  맨 오른쪽 <b>폼폼</b>은 후보가 아니라 <b>자</b>입니다(점선으로 표시). 넘어가면 어떻게 되는지를
  눈앞에 두려고 나란히 놓았습니다. 밝기 숫자는 보조입니다 — 고르는 것은 눈입니다.</p></div>

<div class="결줄">${줄.map((x) => 칸(x)).join('')}</div>

<h2 id="s2" class="듦"><span>지면에서는 이만합니다</span></h2>
<p class="듦">히어로 번호는 지면에 <b>딱 하나</b> 앉고, 크기는 <b>${실크기}px</b> 입니다.
   위에서 갈린 것이 이 크기에서도 갈리는지 보시면 됩니다.</p>
<div class="유리 알림 조용 듦"><div class="실줄">${실줄}</div></div>

<h2 id="s3" class="듦"><span>글줄 옆에서</span></h2>
<p class="듦">이 부품은 홀로 서지 않고 <b>문단 옆</b>에 앉습니다. 홀로 보면 다 예쁘고, 글 옆에서 갈립니다.</p>
${글줄}

<hr class="실금">
<h2 id="s9" class="듦"><span>고르신 뒤에 일어나는 일</span></h2>
<ol class="듦">
  <li>고른 값을 <code>tools/요소굽기.py</code> 의 <code>와펜숫자()</code> 기본값으로 박습니다(지금은 손잡이만 열려 있습니다).</li>
  <li>그 값으로 한 장 다시 구워 <code>docs/Loom_자산/구움/</code> 에 넣고, 자산 창고를 갱신합니다.</li>
  <li><code>tools/lib/loom.js</code> 의 히어로수 자산을 레진구에서 와펜으로 바꿉니다 — 그 순간 유리가 이 자리에서도 걷힙니다.</li>
  <li>지면 41벌이 함께 갈아입습니다. 낱장으로 안 고칩니다.</li>
</ol>

<footer class="메타">후보 렌더 = <code>docs/캐릭터/요소공방_0822/와펜결_0903/</code> ·
현행·폼폼 = 같은 공방 <code>부품형태/</code>(다시 굽지 않습니다 — 지금 입은 그 그림이라야 대조가 참입니다) ·
1000px · 128샘플 · 지면 = <code>tools/펠트문서.js</code>(Loom L4).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `와펜시안-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  /* 0 은 분모와 함께 쓴다 — 빠진 칸을 «없는 것»이 아니라 «못 구운 것»으로 세어 낸다. */
  console.log(`■ 와펜 결 시안  ${path.relative(루트, 출력)}  `
    + `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 그림 ${줄.length} = 있음 ${있음} + 못구움 ${없음})`);
  if (없음) console.log('  🟡 못 구운 칸은 지면에 «못 구웠다»로 그렸다(빈칸으로 두면 판정처럼 보인다).');
}

module.exports = { 줄, 인라인, 밝기 };
if (require.main === module) main();
