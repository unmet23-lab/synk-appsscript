#!/usr/bin/env node
'use strict';
/**
 * 엔진 히어로 시안 — 소개서 «표지 얼굴» 일곱을 한 지면에 세운다 (2026-09-03 신설)
 *
 * ══ 왜 있나 ═══════════════════════════════════════════════════════════════
 *   유호 교정 09-01 「명품화」로 표지 얼굴을 **부품 확대가 아니라 «사진»으로** 굽기로 했다
 *   ([[loom-baked-assets-only-for-ui]] 「부품 확대 히어로 탈락」). 그 일곱 장이 09-03 에 났는데,
 *   `docs/Loom_자산/구움/` 에만 있으면 아무도 못 고른다 — **굽기와 판정 지면은 한 벌이다**(트랙 §0).
 *
 * ══ 요소_시안 과 무엇이 다른가 ═══════════════════════════════════════════
 *   `tools/요소시안.js` 는 `요소공방_0822` 폴더를 훑는 **진열장**이라 히어로를 원리상 못 담는다
 *   (히어로는 그 폴더 밖 `Loom_자산/구움/` 에 난다). 여기는 **판정 판**이고 질문이 셋이다:
 *     ① 이 얼굴이 그 엔진을 «말하나» (배정 근거를 그림 옆에 붙인다)
 *     ② 표지에 앉는 크기에서 버티나 (큰 판과 작은 판을 같이 낸다)
 *     ③ 일곱이 «한 세트로» 보이나 (따로 보면 알 수 없다 — 그래서 한 줄에 늘어놓는다)
 *
 * ══ 대가 — 이 지면이 틀릴 때의 모습 ═══════════════════════════════════════
 *   못 구운 칸을 조용히 빼고 그리는 것. 그러면 「그 엔진은 후보가 없었나」로 읽히는데 사실은
 *   굽기 사고다. ⇒ 빠진 칸은 **이름째 «못 구웠다»로 그리고** 끝에 분모를 낸다(부품형태시안 규율).
 *
 * ══ 구웠다 ≠ 입었다 ══════════════════════════════════════════════════════
 *   이 지면은 «고르는» 자리다. 채택 뒤 소개서에 입히는 것은 따로다 —
 *   `python tools/룸자산화.py` → `node tools/펠트문서.js --전량`.
 *
 * 통로: node tools/히어로시안.js  → docs/히어로_시안.html
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 방 = path.join(루트, 'docs', 'Loom_자산', '구움');
const 출력 = path.join(루트, 'docs', '히어로_시안.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 렌더 한 장 → webp data URI(폭 지정). 없으면 null — 호출부가 «못 구웠다»로 그린다. */
function 인라인(파일, 폭) {
  if (!fs.existsSync(파일)) return null;
  const 임시 = path.join(os.tmpdir(), `히어로-${process.pid}-${path.basename(파일, '.png')}-${폭}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '84', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } catch { return null; } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

/* 배정 정본 = tools/엔진히어로굽기.js 의 목록. 여기 것은 «까닭»을 사람 말로 옮긴 벌이다.
 * ⚠ 저쪽이 바뀌면 여기도 바뀌어야 한다 — 그래서 형태 이름을 함께 적어 어긋나면 눈에 걸리게 둔다. */
const 엔진들 = [
  { 이름: 'Core', 형태: '게이지고리', 하는일: '학생의 이해가 어디까지 찼는지 센다',
    까닭: '차오르는 고리 — 두뇌가 하는 일이 «채우는» 일이라서.' },
  { 이름: 'Loom', 형태: '폼폼', 하는일: '앱의 모든 화면을 펠트 실물로 짓는다',
    까닭: '털공 그 자체 — 이 엔진은 «재질»이 하는 말이라 다른 물건을 빌릴 필요가 없다.' },
  { 이름: 'Vellum', 형태: '말풍선', 하는일: '학생과 말이 오가는 자리를 만든다',
    까닭: '말풍선 — 닿는 면이 곧 말이 오가는 자리다.' },
  { 이름: 'Trail', 형태: '매듭', 하는일: '학생이 지나온 길을 남긴다',
    까닭: '매듭 — 떠난 뒤에도 이어져 있다는 뜻을 실로 맺었다.' },
  { 이름: 'Prism', 형태: '차트', 하는일: '학생이 어디쯤 서 있는지 갈라 보여준다',
    까닭: '차트 — 하나로 뭉친 것을 갈라 보여주는 물건.' },
  { 이름: 'Temper', 형태: '도장', 하는일: '맞았는지 틀렸는지 판정한다',
    까닭: '도장 — 판정은 «찍는» 일이고, 담금질도 같은 낱말이다.' },
  { 이름: 'Reed', 형태: '녹음', 하는일: '학생의 목소리를 듣고 발음을 잰다',
    까닭: '파형 자수 — 소리를 눈에 보이는 물건으로 만든 것.' },
];

function main() {
  let 있음 = 0; let 없음 = 0;
  const 카드 = [];

  for (const e of 엔진들) {
    const 파일 = path.join(방, `히어로_${e.이름}.png`);
    const 큰 = 인라인(파일, 460);
    const 작은 = 인라인(파일, 150);
    if (큰) 있음 += 1; else 없음 += 1;
    const 그림 = 큰
      ? `<img src="${큰}" alt="${esc(e.이름)} 표지 얼굴" width="460">`
      : `<div class="못구움">못 구웠다<br><span class="작게">히어로_${esc(e.이름)}.png</span></div>`;
    const 작은칸 = 작은
      ? `<img src="${작은}" alt="${esc(e.이름)} 작은 판" width="150">`
      : '<div class="못구움 작은못">—</div>';
    카드.push(`<section class="엔진칸">
  <h3>${esc(e.이름)} <span class="형태">${esc(e.형태)}</span></h3>
  <p class="하는일">${esc(e.하는일)}</p>
  <div class="그림줄">
    <div class="큰">${그림}</div>
    <div class="작은">
      ${작은칸}
      <p class="작게 흐린">소개서 목차에 앉는 크기</p>
    </div>
  </div>
  <p class="까닭">${esc(e.까닭)}</p>
  <p class="작게 흐린">지금 이 엔진의 소개서 → <code>docs/엔진/SYNK_${esc(e.이름)}_소개서.html</code></p>
</section>`);
  }

  const 원고 = `<!doctype html>
<html lang="ko"><meta charset="utf-8">
<title>엔진 얼굴 일곱</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/히어로시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 렌더 = docs/Loom_자산/구움/히어로_*.png · 레시피 정본 = tools/엔진히어로굽기.js -->
<!--펠트스킨-->
<style>
  /* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
  .엔진칸 { margin: 2.2em 0; padding-bottom: 1.6em; border-bottom: 1px solid var(--선, #0001); }
  .엔진칸 h3 { margin-bottom: .15em; }
  .엔진칸 .형태 { font-size: .62em; opacity: .55; font-weight: 400; margin-left: .5em; }
  .엔진칸 .하는일 { margin: 0 0 .9em; opacity: .75; }
  .그림줄 { display: flex; gap: 1.6em; align-items: flex-end; flex-wrap: wrap; }
  .그림줄 img { display: block; max-width: 100%; height: auto; border-radius: 6px; }
  .그림줄 .작은 { text-align: center; }
  .그림줄 .작은 p { margin: .4em 0 0; }
  .까닭 { margin: .9em 0 .3em; }
  .못구움 { width: 460px; max-width: 100%; aspect-ratio: 1/1; display: grid; place-content: center;
            text-align: center; border: 2px dashed #c0392b66; border-radius: 6px; color: #c0392b; }
  .못구움.작은못 { width: 150px; aspect-ratio: 1/1; }
</style>
<div class="판"><div class="글">

<h1>엔진 얼굴 일곱</h1>
<p class="리드">소개서 일곱 벌의 <strong>표지에 앉을 얼굴</strong>입니다. 지금까지는 작은 부품을 확대해 썼고,
이번에는 무대·조명·얕은 심도를 걸어 <strong>사진처럼</strong> 구웠습니다(유호 교정 09-01 「명품화」).</p>

<h2>무엇을 보고 고르시나</h2>
<ol class="듦">
  <li><strong>이 얼굴이 그 엔진을 말하나.</strong> 그림 아래에 왜 그 형태를 골랐는지 적어 두었습니다.</li>
  <li><strong>작아져도 버티나.</strong> 표지에서는 크게 앉지만 목차에서는 작게 앉습니다. 두 크기를 같이 냈습니다.</li>
  <li><strong>일곱이 한 세트로 보이나.</strong> 따로 보면 알 수 없어서 한 줄로 늘어놓았습니다.</li>
</ol>

<h2>일곱</h2>
${카드.join('\n')}

<h2>고르신 뒤에 일어나는 일</h2>
<ol class="듦">
  <li>고른 얼굴이 <code>docs/Loom_자산/구운재질.json</code> 에 실립니다(<code>python tools/룸자산화.py</code>).</li>
  <li>소개서 일곱 벌이 다음 굽기에서 그 얼굴로 갈아입습니다(<code>node tools/펠트문서.js --전량</code>).</li>
  <li>🔑 <strong>구웠다는 것과 입었다는 것은 다릅니다.</strong> 이 지면은 «고르는» 자리까지입니다.</li>
</ol>

<footer class="메타">렌더 = <code>docs/Loom_자산/구움/히어로_*.png</code>(1800px · 320샘플 · 결 조명 · 심도 f/1.4) ·
레시피 정본 = <code>tools/엔진히어로굽기.js</code> · 지면 = <code>tools/펠트문서.js</code>(Loom L4).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `히어로시안-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  /* 0 은 분모와 함께 쓴다 — 빠진 칸을 «없는 것»이 아니라 «못 구운 것»으로 세어 낸다. */
  console.log(`■ 엔진 히어로 시안  ${path.relative(루트, 출력)}  `
    + `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 엔진 ${엔진들.length} = 있음 ${있음} + 못구움 ${없음})`);
  if (없음) {
    console.log('  🟡 못 구운 칸이 있다 — 지면에는 «못 구웠다»로 그렸다(빈칸으로 두면 판정처럼 보인다).');
    console.log('     처방: node tools/엔진히어로굽기.js  (또는 클라우드 통로 — 트랙 §2 밤 사슬)');
  }
}

module.exports = { 엔진들, 인라인 };
if (require.main === module) main();
