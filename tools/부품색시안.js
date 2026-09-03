#!/usr/bin/env node
'use strict';
/**
 * 부품 색 시안 — 「부품에도 킷 색을 갈라 배정한다」 판정 지면 (2026-09-03)
 *
 * ══ 왜 있나 ═══════════════════════════════════════════════════════════════
 *   유호 지시 09-03: 「우리 엔진에 코랄색만 너무 많아. 이거 너무 물리는데 다, 다양한 색을
 *   구현해봐 앞으로」 → 결정.md 09-03 「엔진·부품·요소에 킷 색을 갈라 배정한다」.
 *   엔진 얼굴 일곱은 그날 갈렸다. **부품은 아직 안 갈렸다** — 이 지면이 그 자리다.
 *
 *   🔑 굽기와 판정 지면은 한 벌이다(트랙 §0). 여섯 장이 폴더에만 있으면 아무도 못 고른다.
 *
 * ══ 🔴 이 판은 «한 질문»이 아니다 — 둘을 갈라 놓았다 ══════════════════════
 *   여섯 장이 한 배치로 구워졌지만 묻는 것이 서로 다르다. 한 판으로 묶으면
 *   유호님이 «같은 자로 견주는 것»으로 읽으시는데 사실은 축이 둘이다.
 *
 *     판 A(불릿) = 「색을 넣을까 말까」 — 🔴 철칙 ④와 정면으로 부딪친다.
 *       요소굽기.py:5113 원문: “불릿은 «반복되는 것»이라 갇힌 빛이 무채다(철칙 ④ —
 *       수십 개가 코랄이면 신호 1점이 죽는다)”. 산호 후보는 그 철칙을 뒤집자는 제안이다.
 *     판 B(절번호) = 「숫자가 읽히나」 — 색 취향이 아니라 **가시성**이다.
 *       유호 교정 09-03: 「단추인데 단추 색을 바꾸든 숫자 색을 바꾸든 가시성을 키우자」.
 *
 * ══ 현행은 다시 굽지 않는다 ═══════════════════════════════════════════════
 *   before 셋은 `docs/캐릭터/요소공방_0822/부품형태/` 의 09-03 판을 그대로 싣는다.
 *   다시 구우면 기준이 오늘 판으로 갈려 대조가 거짓이 된다(부품형태시안.js 와 같은 규율).
 *
 * ══ 대가 — 이 지면이 틀릴 때의 모습 ═══════════════════════════════════════
 *   **없는 후보를 조용히 빼고 그리는 것.** 그러면 「그 색은 별로였나 보다」로 읽히는데
 *   사실은 굽기가 실패한 것이다 — 사고인데 판정처럼 보인다.
 *   ⇒ 빠진 칸은 **이름째 «못 구웠다»로 그리고** 끝에 분모를 낸다.
 *
 * 통로: node tools/부품색시안.js   →  docs/부품색_시안.html
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 공방 = path.resolve(루트, 'docs', '캐릭터', '요소공방_0822');
const 현행방 = path.join(공방, '부품형태');
const 후보방 = path.join(공방, '부품색_0903');
const 출력 = path.join(루트, 'docs', '부품색_시안.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 렌더 한 장 → webp data URI. 없으면 null — 호출부가 «못 구웠다»로 그린다.
 *  🔑 지면 «안»에 싣는다: 발행하면 바깥 자산은 CSP 가 조용히 막는다(memory artifact-csp-blocks-external-css). */
function 인라인(파일, 폭) {
  if (!fs.existsSync(파일)) return null;
  const 임시 = path.join(os.tmpdir(), `부품색-${process.pid}-${path.basename(파일, '.png')}-${폭}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '84', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } catch { return null; } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

const 현행렌더 = (이름, 폭 = 300) => 인라인(path.join(현행방, `${이름}.png`), 폭);
const 후보렌더 = (이름, 폭 = 300) => 인라인(path.join(후보방, `${이름}.png`), 폭);

/* ── 판 둘 ───────────────────────────────────────────────────────────────────
 * 실크기 = 지면에서 실제로 앉는 픽셀. 본문 17px 기준 환산(불릿 7px · 절번호 2.05em ≈ 35px).
 * ⚠이 수를 여기서 «정하지» 않는다 — `tools/lib/loom.js` 가 쓴 값을 옮겨 적었다.
 *   loom 이 바뀌면 이 줄도 바뀌어야 한다(한 값을 두 곳이 알면 갈린다). */
const 판들 = [
  {
    이름: 'A · 불릿 — 색을 넣을까',
    자리: '목록의 점. 지면에서 **가장 많이 반복되는** 부품이라, 한 지면에 수십 개가 앉는다.',
    실크기: 7,
    경고: '🔴 **이 판은 철칙 ④를 뒤집자는 제안이다.** 지금 도구에 적힌 근거 원문: '
      + '「불릿은 «반복되는 것»이라 갇힌 빛이 무채다 — 수십 개가 코랄이면 신호 1점이 죽는다」'
      + '(<code>tools/요소굽기.py:5113</code>). 산호를 고르시면 그 철칙이 함께 걷힙니다. '
      + '**색을 고르는 것이 아니라 규칙을 고르는 자리**라 여기만 따로 뗐다.',
    줄들: [
      {
        형태: '매듭점(세잎 매듭)',
        현행: { 이름: '무채 — Ash Wool(지금 쓰는 것)', uri: 현행렌더('A1_매듭점') },
        후보: [
          { 이름: '짙은무채 — Deep Wool', uri: 후보렌더('A1b_매듭점_짙은무채') },
          { 이름: '산호 — Coral', uri: 후보렌더('A1c_매듭점_산호') },
        ],
      },
      {
        형태: '프렌치노트(감아 만든 점)',
        현행: { 이름: '무채 — Ash Wool(지금 쓰는 것)', uri: 현행렌더('A2_프렌치노트') },
        후보: [
          { 이름: '짙은무채 — Deep Wool', uri: 후보렌더('A2b_프렌치노트_짙은무채') },
          { 이름: '산호 — Coral', uri: 후보렌더('A2c_프렌치노트_산호') },
        ],
      },
    ],
    묻는것: '**7px 에서도 색이 색으로 남는가.** 그리고 그 색이 수십 개 반복돼도 지면이 안 시끄러운가. '
      + '아래 «한 지면 흉내» 줄이 그 답을 낸다 — 한 알만 보면 답이 안 나온다.',
  },
  {
    이름: 'B · 절번호 — 숫자가 읽히나',
    자리: '절 머리의 번호. 지면당 여러 개지만 **글자를 읽어야 하는** 부품이라 축이 위와 다르다.',
    실크기: 35,
    경고: '이 판은 취향이 아니라 **가시성**이다. 유호 교정 09-03: '
      + '「단추인데 단추 색을 바꾸든 숫자 색을 바꾸든 가시성을 키우자」. '
      + '지금 숫자색 Oat 는 단추 몸(Stone)과 밝기가 붙어 번호가 잘 안 읽힌다.',
    줄들: [
      {
        형태: '단추숫자 01(4구 단추 + 자수 숫자)',
        현행: { 이름: '숫자 Oat(지금 쓰는 것)', uri: 현행렌더('B1_단추숫자_01') },
        후보: [
          { 이름: '숫자 산호 — Coral', uri: 후보렌더('B1b_단추숫자_코랄글자') },
          { 이름: '숫자 잉크 — Ink', uri: 후보렌더('B1c_단추숫자_잉크글자') },
        ],
      },
    ],
    묻는것: '**35px 에서 「01」이 한눈에 읽히는가.** 크게 보면 셋 다 읽힌다 — '
      + '아래 실크기 줄에서 갈린다. 그게 이 판의 유일한 질문이다.',
  },
];

function 칸(x, 폭 = 190) {
  if (!x.uri) {
    return `<figure class="유리 잔잔 색칸 없음"><div class="빈판">못 구웠다</div>
      <figcaption>${esc(x.이름)}</figcaption></figure>`;
  }
  return `<figure class="유리 잔잔 색칸"><img src="${x.uri}" alt="${esc(x.이름)}" style="max-width:${폭}px">
    <figcaption>${esc(x.이름)}</figcaption></figure>`;
}

/** 실크기 줄 — 「지면에서 이만하다」. 대조가 아니라 각성을 노린 줄이다. */
function 실크기줄(줄, 크기) {
  const 것들 = [줄.현행, ...줄.후보].filter((x) => x.uri);
  if (!것들.length) return '';
  const 알 = 것들.map((x) =>
    `<span class="실칸"><img src="${x.uri}" alt="" style="width:${크기}px;height:${크기}px;object-fit:contain"></span>`)
    .join('');
  return `<div class="실줄">${알}</div>`;
}

/** 🔑 한 지면 흉내 — 불릿의 진짜 질문은 «한 알»이 아니라 «스물네 알»에서 나온다.
 *  철칙 ④가 말하는 「수십 개가 코랄이면 신호 1점이 죽는다」를 눈으로 재는 유일한 방법이다. */
function 반복줄(줄, 크기) {
  const 것들 = [줄.현행, ...줄.후보].filter((x) => x.uri);
  if (!것들.length) return '';
  const 칸들 = 것들.map((x) => {
    const 알 = Array.from({ length: 24 }, () =>
      `<img src="${x.uri}" alt="" style="width:${크기}px;height:${크기}px;object-fit:contain">`).join('');
    return `<div class="반복칸"><p class="작게 흐린" style="margin:0 0 .4em">${esc(x.이름.split(' — ')[0])}</p>
      <div class="반복알">${알}</div></div>`;
  }).join('');
  return `<div class="유리 알림 조용 듦"><p class="작게" style="margin:0 0 .8em">
    👁 <b>한 지면 흉내</b> — 목록 스물네 줄에 이 점이 앉으면 이렇게 보인다.
    <b>이 줄이 판 A 의 진짜 자다</b>(한 알만 크게 보면 산호가 늘 이긴다).</p>
    <div class="반복줄">${칸들}</div></div>`;
}

function main() {
  if (!fs.existsSync(현행방)) {
    console.error(`🔴 현행 렌더 방이 없다 — 대조가 안 선다.\n   ${현행방}`);
    process.exit(1);
  }
  let 있음 = 0, 없음 = 0;
  const 빠진것 = [];

  const 절들 = 판들.map((판, i) => {
    const 줄HTML = 판.줄들.map((줄) => {
      [줄.현행, ...줄.후보].forEach((x) => {
        if (x.uri) 있음 += 1; else { 없음 += 1; 빠진것.push(`${줄.형태} / ${x.이름}`); }
      });
      return `<h3 class="듦">${esc(줄.형태)}</h3>
<div class="맞줄">
  <div class="쪽"><p class="꼭지">현행 — before</p><div class="색줄">${칸(줄.현행, 230)}</div></div>
  <div class="쪽"><p class="꼭지">후보 — after</p><div class="색줄">${줄.후보.map((x) => 칸(x)).join('')}</div></div>
</div>
<div class="유리 알림 조용 듦"><p class="작게" style="margin:0 0 .6em">
  📏 <b>실크기 ${판.실크기}px</b> — 지면에서 이만하게 앉는다(왼쪽이 현행).
  여기서 안 갈리면 위에서 갈린 것은 뜻이 없다.</p>${실크기줄(줄, 판.실크기)}</div>
${판.실크기 <= 10 ? 반복줄(줄, 판.실크기) : ''}`;
    }).join('\n');

    return `<h2 id="s${i + 1}" class="듦"><span>${esc(판.이름)}</span></h2>
<p class="듦">${판.자리.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>
<div class="유리 알림 듦"><p class="작게" style="margin:0">${판.경고.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p></div>
<div class="유리 알림 조용 듦"><p class="작게" style="margin:0"><b>이 판이 묻는 것</b> —
  ${판.묻는것.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>')}</p></div>
${줄HTML}`;
  });

  const 표지그림 = (판들[0].줄들[0].후보.find((x) => x.uri) ||판들[0].줄들[0].현행 || {}).uri;

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>부품 색 판정</title>
<!-- 브랜드 서체(SUIT)는 «굽기»가 지면 안에 싣는다 — 바깥에서 부르면 아티팩트 CSP 가 조용히 막는다(정본 tools/lib/브랜드폰트.js) -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/부품색시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 후보 렌더 = docs/캐릭터/요소공방_0822/부품색_0903/ · 현행 = 같은 공방 부품형태/ -->
<!--펠트스킨-->
<style>
/* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
.맞줄{display:grid;grid-template-columns:1fr;gap:var(--단);margin:var(--단) 0;}
@media (min-width:900px){ .맞줄{grid-template-columns:minmax(0,260px) minmax(0,1fr);align-items:start;} }
.쪽 .꼭지{margin:0 0 var(--참);}
.색줄{display:flex;flex-wrap:wrap;gap:var(--칸);}
.색칸{margin:0;padding:var(--참);text-align:center;}
.색칸 img{display:block;width:100%;height:auto;border-radius:12px;}
.색칸 figcaption{margin-top:var(--틈);font-size:.78rem;color:var(--ash);line-height:1.4;max-width:22ch;}
.색칸.없음 .빈판{display:grid;place-items:center;min-height:120px;border-radius:12px;
  border:1px dashed rgba(var(--coral-rgb),.5);color:var(--coral);font-size:.82rem;font-weight:700;}
.실줄{display:flex;align-items:center;gap:22px;flex-wrap:wrap;}
.실칸{display:inline-grid;place-items:center;}
.반복줄{display:grid;grid-template-columns:1fr;gap:var(--칸);}
@media (min-width:760px){ .반복줄{grid-template-columns:repeat(3,minmax(0,1fr));} }
.반복알{display:flex;flex-direction:column;gap:.62em;}
.반복알 img{display:block;}
@media print{ .색칸 img{max-width:150px;} }
</style>

<header class="표지">
  ${표지그림 ? `<div class="오브" aria-hidden="true" style="background-image:url(${표지그림});background-size:cover"></div>`
             : '<div class="오브" aria-hidden="true">색</div>'}
  <div>
    <p class="꼭지">LOOM · 부품 공방</p>
    <h1>부품에도 색을 나눈다</h1>
    <p class="한줄">엔진 일곱의 얼굴은 09-03 에 색이 갈렸다. 부품은 아직 안 갈렸다.
       여섯 장을 구워 현행과 나란히 놓았으니, 눈으로 고르시는 판이다.</p>
    <p class="메타">2026-09-03 · 근거 = 결정.md 09-03(코랄 몰아쓰기를 끝낸다) ·
       굽기 = 허깅페이스 클라우드 6잡 · 지면 = node tools/부품색시안.js</p>
  </div>
</header>

<div class="유리 알림 듦"><p class="작게" style="margin:0">
  🔴 <b>유호 지시 09-03</b> — 「그리고 지금 우리 엔진에 코랄색만 너무 많아. 이거 너무 물리는데 다,
  다양한 색을 구현해봐 앞으로」. 그날 <b>엔진 일곱의 얼굴은 갈렸다</b>. 여기는 그 다음 자리 —
  <b>지면 부품</b>이다. 다만 아래 두 판은 <b>묻는 것이 서로 다르니</b> 따로 고르셔야 한다.</p></div>

${절들.join('\n')}

<hr class="실금">
<h2 id="s9" class="듦"><span>고르신 뒤에 일어나는 일</span></h2>
<ol class="듦">
  <li>고른 색을 <code>tools/lib/loom.js</code> 의 그 부품 자리에 배선한다(구움표 + 재질맵).</li>
  <li>판 A 에서 산호를 고르시면 <b>철칙 ④를 함께 걷는다</b> —
      <code>tools/요소굽기.py</code> 의 그 주석과 기본 염료를 같이 고쳐야 도구와 지면이 안 어긋난다.</li>
  <li>판 B 는 <code>숫자색=</code> 손잡이가 이미 서 있다(09-03 신설). 고른 값을 굽기 통로의 기본값으로 박는다.</li>
  <li>지면 40벌이 다음 굽기에서 함께 갈아입는다 — 낱장으로 안 고친다.</li>
</ol>

<footer class="메타">후보 렌더 = <code>docs/캐릭터/요소공방_0822/부품색_0903/</code> ·
현행 = <code>docs/캐릭터/요소공방_0822/부품형태/</code>(다시 굽지 않는다 — 지금 입은 그 그림이라야 대조가 참이다) ·
1000px · 128샘플 · 지면 = <code>tools/펠트문서.js</code>(Loom L4).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `부품색-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  /* 0 은 분모와 함께 쓴다 — 빠진 칸을 «없는 것»이 아니라 «못 구운 것»으로 세어 낸다(머리말 「대가」). */
  console.log(`■ 부품 색 시안  ${path.relative(루트, 출력)}  `
    + `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 판 ${판들.length} · 그림 ${있음 + 없음} = 있음 ${있음} + 못구움 ${없음})`);
  if (없음) {
    console.log('  🟡 못 구운 칸 — 지면에는 «못 구웠다»로 그렸다(빈칸으로 두면 판정처럼 보인다):');
    빠진것.forEach((n) => console.log(`     · ${n}`));
  }
}

module.exports = { 판들, 인라인 };
if (require.main === module) main();
