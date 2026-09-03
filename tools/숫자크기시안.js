#!/usr/bin/env node
'use strict';
/**
 * 히어로 번호 «숫자 크기» 시안 — 두 그릇에 각각 세 단계 (2026-09-03)
 *
 * ══ 왜 있나 ═══════════════════════════════════════════════════════════════
 *   유호 09-03: 「지금판이랑 폼폼판 좋은데 숫자를 조금 키우는건 어떻게 생각해?」
 *   ⇒ 앞선 «결(깊이)» 판정에서 와펜 지금 판과 폼폼이 남았고, 이 판은 그 둘만 대상으로
 *      **숫자 크기 하나**를 묻는다. 축이 다르므로 지면도 따로 세운다
 *      (한 판에 두 축을 섞으면 「같은 자로 견주는 것」처럼 보이는데 사실이 아니다).
 *
 * ══ 왜 키우나 — 재서 말한다 ═══════════════════════════════════════════════
 *   지면에서 이 부품은 **44px** 로 앉는데 숫자는 겉보기 지름의 약 27% 라 «11px 남짓»이다.
 *   본문 글자(17px)보다 작다. 지면당 한 점뿐인 «눈이 되는 자리»인데 두 자리 수가 빡빡하다.
 *   곁: 자수는 클수록 안전하다 — 글자를 복셀(0.018)로 다시 짜서 털을 심으므로 작으면 가는 획을 먹는다.
 *
 * ══ 🔴 이 판의 진짜 자는 «실크기 줄»이다 ══════════════════════════════════
 *   숫자 키우기는 크게 볼 때가 아니라 **작게 앉을 때** 값이 드러난다. 위 큰 그림에서는
 *   셋 다 잘 읽히므로, 그것만 보면 「굳이 왜 키우나」로 읽힌다. 44px 줄에서 갈린다.
 *
 * ══ 한계 둘 — 그릇마다 다르다 ═════════════════════════════════════════════
 *   와펜: 테두리 땀이 도는 자리(r=0.78)를 숫자가 넘으면 겹친다.
 *   폼폼: 숫자를 방울 «앞»에 띄운 구조라(y=-0.98) 너무 키우면 방울을 덮어
 *         「방울 위의 수」가 아니라 그냥 «수»가 된다.
 *   ⇒ 어디까지가 경계인지는 재서 못 알고 굽는다(색·미학 채택은 숫자로 안 한다 · 08-24 확정).
 *
 * 통로: node tools/숫자크기시안.js   →  docs/숫자크기_시안.html
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 공방 = path.resolve(루트, 'docs', '캐릭터', '요소공방_0822');
const 현행방 = path.join(공방, '부품형태');
const 후보방 = path.join(공방, '숫자크기_0903');
const 출력 = path.join(루트, 'docs', '숫자크기_시안.html');
const 실크기 = 44;                       // 히어로수가 지면에서 앉는 크기(loom.js 값을 옮겼다)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 렌더 한 장 → webp data URI. 없으면 null — 호출부가 «못 구웠다»로 그린다. */
function 인라인(파일, 폭) {
  if (!fs.existsSync(파일)) return null;
  const 임시 = path.join(os.tmpdir(), `숫자-${process.pid}-${path.basename(파일, '.png')}-${폭}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '86', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } catch { return null; } finally { try { fs.unlinkSync(임시); } catch { /* */ } }
}

const 줄들 = [
  {
    그릇: '와펜 — 달아 준 패치',
    한계: '테두리 땀이 도는 자리를 숫자가 넘으면 겹친다. 두 판에서 그 선이 보이는지 보시면 된다.',
    칸: [
      { 이름: '지금', 값: '0.62', 파일: path.join(현행방, 'E1_와펜숫자.png') },
      { 이름: '조금', 값: '0.76', 파일: path.join(후보방, 'W76_와펜_숫자0.76.png'), 곁: '23% 큼' },
      { 이름: '많이', 값: '0.88', 파일: path.join(후보방, 'W88_와펜_숫자0.88.png'), 곁: '42% 큼' },
    ],
  },
  {
    그릇: '폼폼 — 털실 방울',
    한계: '숫자가 방울 «앞»에 떠 있는 구조라, 키우면 방울을 덮어 그냥 «수»가 된다. 방울이 아직 배경으로 읽히는지가 자다.',
    칸: [
      { 이름: '지금', 값: '0.66', 파일: path.join(현행방, 'E2_폼폼숫자.png') },
      { 이름: '조금', 값: '0.80', 파일: path.join(후보방, 'P80_폼폼_숫자0.80.png'), 곁: '21% 큼' },
      { 이름: '많이', 값: '0.92', 파일: path.join(후보방, 'P92_폼폼_숫자0.92.png'), 곁: '39% 큼' },
    ],
  },
];
줄들.forEach((r) => r.칸.forEach((c) => { c.uri = 인라인(c.파일, 300); }));

function 칸(c) {
  const 곁 = c.곁 ? `<br><span class="작게 흐린">${esc(c.곁)}</span>` : '';
  if (!c.uri) {
    return `<figure class="유리 잔잔 수칸 없음"><div class="빈판">못 구웠다</div>
      <figcaption><b>${esc(c.이름)}</b> · ${esc(c.값)}${곁}</figcaption></figure>`;
  }
  return `<figure class="유리 잔잔 수칸"><img src="${c.uri}" alt="${esc(c.이름)}" style="max-width:230px">
    <figcaption><b>${esc(c.이름)}</b> · 숫자 ${esc(c.값)}${곁}</figcaption></figure>`;
}

function main() {
  if (!fs.existsSync(현행방)) { console.error(`🔴 현행 렌더 방이 없다 — 대조가 안 선다.\n   ${현행방}`); process.exit(1); }
  let 있음 = 0; let 없음 = 0;
  줄들.forEach((r) => r.칸.forEach((c) => { if (c.uri) 있음 += 1; else 없음 += 1; }));

  const 절 = 줄들.map((r, i) => {
    const 실줄 = r.칸.filter((c) => c.uri).map((c) =>
      `<span class="실칸"><img src="${c.uri}" alt="" style="width:${실크기}px;height:${실크기}px;object-fit:contain">
       <span class="작게 흐린">${esc(c.이름)}</span></span>`).join('');
    const 글줄 = r.칸.filter((c) => c.uri).map((c) =>
      `<p class="글줄본"><img src="${c.uri}" alt="" class="줄알">
        <span>이번 달에 넘긴 장면이 <b>이만큼</b>입니다. 숫자 하나가 문단의 눈이 되는 자리라
        지면당 <b>한 점</b>만 놓습니다. <span class="흐린 작게">(${esc(c.이름)} · ${esc(c.값)})</span></span></p>`).join('\n');
    return `<h2 id="s${i + 1}" class="듦"><span>${esc(r.그릇)}</span></h2>
<div class="유리 알림 듦"><p class="작게" style="margin:0"><b>이 그릇의 한계</b> — ${esc(r.한계)}</p></div>
<div class="수줄">${r.칸.map((c) => 칸(c)).join('')}</div>
<div class="유리 알림 조용 듦"><p class="작게" style="margin:0 0 .7em">
  📏 <b>실크기 ${실크기}px</b> — 지면에서 이만하게 앉는다. <b>이 줄이 이 판의 진짜 자다</b>
  (위 큰 그림에서는 셋 다 잘 읽히므로, 그것만 보면 「굳이 왜 키우나」로 읽힌다).</p>
  <div class="실줄">${실줄}</div></div>
${글줄}`;
  });

  const 표지그림 = (줄들[0].칸.find((c) => c.uri) || {}).uri;

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>히어로 번호 크기</title>
<!-- 브랜드 서체(SUIT)는 «굽기»가 지면 안에 싣는다 — 바깥에서 부르면 아티팩트 CSP 가 조용히 막는다 -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/숫자크기시안.js — 손 편집 금지(재생성이 덮는다) -->
<!--펠트스킨-->
<style>
/* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
.수줄{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--칸);margin:var(--단) 0;}
.수칸{margin:0;padding:var(--참);text-align:center;}
.수칸 img{display:block;width:100%;height:auto;border-radius:12px;}
.수칸 figcaption{margin-top:var(--틈);font-size:.8rem;color:var(--ash);line-height:1.5;}
.수칸.없음 .빈판{display:grid;place-items:center;min-height:130px;border-radius:12px;
  border:1px dashed rgba(var(--coral-rgb),.5);color:var(--coral);font-size:.82rem;font-weight:700;}
.실줄{display:flex;align-items:flex-end;gap:30px;flex-wrap:wrap;}
.실칸{display:inline-grid;place-items:center;gap:.35em;}
.글줄본{display:flex;align-items:flex-start;gap:.7em;margin:var(--칸) 0;max-width:62ch;}
.글줄본 .줄알{width:${실크기}px;height:${실크기}px;object-fit:contain;flex:0 0 auto;}
@media print{ .수칸 img{max-width:150px;} }
</style>

<header class="표지">
  ${표지그림 ? `<div class="오브" aria-hidden="true" style="background-image:url(${표지그림});background-size:cover"></div>`
             : '<div class="오브" aria-hidden="true">16</div>'}
  <div>
    <p class="꼭지">LOOM · 부품 공방</p>
    <h1>숫자를 얼마나 키울까</h1>
    <p class="한줄">앞선 판정에서 남은 두 그릇에 숫자만 두 단계씩 키웠습니다.
       고르실 것은 그릇이 아니라 «숫자 크기» 하나입니다.</p>
    <p class="메타">2026-09-03 · 굽기 = 허깅페이스 클라우드 4잡 · 지면 = node tools/숫자크기시안.js</p>
  </div>
</header>

<div class="유리 알림 듦"><p class="작게" style="margin:0">
  🔴 <b>유호 물음 09-03</b> — 「지금판이랑 폼폼판 좋은데 숫자를 조금 키우는건 어떻게 생각해?」
  <b>재보니 키우는 쪽이 맞습니다</b>: 이 부품은 지면에서 44px 로 앉는데 숫자가 겉보기 지름의
  약 27% 라 <b>11px 남짓</b>입니다. 본문 글자(17px)보다 작은데, 지면당 한 점뿐인 «눈이 되는 자리»라
  두 자리 수가 빡빡합니다. 곁으로, 자수는 클수록 안전하기도 합니다 — 글자를 복셀로 다시 짜서
  털을 심으므로 작으면 그 과정이 가는 획을 먹습니다.</p></div>

${절.join('\n<hr class="실금">\n')}

<hr class="실금">
<h2 id="s9" class="듦"><span>고르신 뒤에 일어나는 일</span></h2>
<ol class="듦">
  <li>고른 그릇과 숫자 크기를 <code>tools/요소굽기.py</code> 의 기본값으로 박습니다(지금은 손잡이만 열려 있습니다).</li>
  <li>그 값으로 한 장 다시 구워 <code>docs/Loom_자산/구움/</code> 에 넣고 자산 창고를 갱신합니다.</li>
  <li><code>tools/lib/loom.js</code> 의 히어로수 자산을 레진구에서 그것으로 바꿉니다 — 그 순간 유리가 마지막 자리에서도 걷힙니다.</li>
  <li>지면 41벌이 함께 갈아입습니다. 낱장으로 안 고칩니다.</li>
</ol>

<footer class="메타">후보 렌더 = <code>docs/캐릭터/요소공방_0822/숫자크기_0903/</code> ·
지금 판 = 같은 공방 <code>부품형태/</code>(다시 굽지 않습니다 — 지금 입은 그 그림이라야 대조가 참입니다) ·
1000px · 128샘플 · 지면 = <code>tools/펠트문서.js</code>(Loom L4).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `숫자크기시안-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  /* 0 은 분모와 함께 쓴다 — 빠진 칸을 «없는 것»이 아니라 «못 구운 것»으로 세어 낸다. */
  console.log(`■ 숫자 크기 시안  ${path.relative(루트, 출력)}  `
    + `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 줄 ${줄들.length} · 그림 ${있음 + 없음} = 있음 ${있음} + 못구움 ${없음})`);
  if (없음) console.log('  🟡 못 구운 칸은 지면에 «못 구웠다»로 그렸다(빈칸으로 두면 판정처럼 보인다).');
}

module.exports = { 줄들, 인라인 };
if (require.main === module) main();
