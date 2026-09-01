#!/usr/bin/env node
'use strict';
/**
 * 부품 형태 시안 — «구» 탈피 판정 지면 (2026-09-01 · 인계 = docs/캐릭터/부품형태공방_0901/인계.md)
 *
 * ══ 왜 있나 ═══════════════════════════════════════════════════════════════
 *   유호 확정 09-01 저녁: **유리·레진 구슬은 나간다**(「이 쓰레기같은 오브 유리 싹다 삭제해줘 ·
 *   우리 좋은 털재질 요소들 많은데 왜 이걸 쓰는거야」). 그런데 «무엇으로 바꾸나»는 눈이 정한다
 *   (색·미학 채택은 숫자로 안 한다 — 08-24 확정). 이 지면이 그 눈앞에 놓이는 판이다.
 *
 *   🔑 **굽기와 판정 지면은 한 벌이다**(트랙 §0). 13장이 폴더에만 있으면 아무도 못 고른다 —
 *      유호 지시 09-01 「판정 지면도 밤 굽기 세션에 잘 추가해줘. 밤에 전부 한번에 진행할거야」.
 *
 * ══ 요소_시안.html 과 무엇이 다른가 ═══════════════════════════════════════
 *   저쪽은 **라이브러리 진열장**이다(세트별로 난 것 전량). 여기는 **판정 판**이라 셋이 다르다:
 *     ① **현행 ↔ 후보를 한 줄에** 놓는다 — 대조 없이는 「나은가」가 성립하지 않는다.
 *     ② **실크기 축소줄**이 붙는다 — 불릿은 지면에서 7px 이고, 128px 에서 예쁜 것이 7px 에서
 *        뭉개지면 그 후보는 진 것이다(인계 §3 「굽는 크기 = 쓰는 크기」).
 *     ③ **태그 세 겹은 이어 붙여 보여 준다** — 조각 셋을 따로 보면 이 판의 진짜 질문
 *        («이어 붙인 자리가 보이나»)에 답을 못 한다. CSS 세 겹 배경 그대로 조립해 놓는다.
 *
 * ══ 현행은 다시 굽지 않는다 ═══════════════════════════════════════════════
 *   before 는 `docs/Loom_자산/구운재질.json` 이 이미 쥐고 있다(원판·레진구·레진구_무채·유리구·칩).
 *   **지면이 지금 입고 있는 «그 그림»**이라야 대조가 참이다 — 다시 구우면 기준이 오늘 판으로 갈린다.
 *   그래서 여기서는 그 data URI 를 그대로 싣는다(ffmpeg 도 안 거친다 · 이미 webp 다).
 *
 * ══ 대가 — 이 지면이 틀릴 때의 모습 ═══════════════════════════════════════
 *   **없는 후보를 조용히 빼고 그리는 것.** 그러면 유호님은 「그 후보는 별로였나 보다」로 읽으시는데
 *   사실은 굽기가 실패한 것이다 — 판정이 아니라 사고인데 판정처럼 보인다.
 *   ⇒ 닫은 것 = 빠진 칸을 **이름째 «못 구웠다»로 그린다**(빈칸으로 두지 않는다) + 끝에 분모를 낸다.
 *
 * ══ 후보는 «부품형태» 한 세트뿐이다 ══════════════════════════════════════
 *   09-01 저녁 한때 세트가 둘이었다 — 옆 세션의 `형태후보`(현행 형태 여섯을 같은 자로 다시)와
 *   이 트랙의 `부품형태`(없던 형태 열하나). 그날 저녁 **하나로 접혔고**(`264326b27` ·
 *   「부품형태가 정본 · 형태후보 6장은 그 자리에서 걷었다」) 그 렌더도 함께 지워졌다.
 *   ⇒ 여기서도 그 참조를 걷었다. **안 걷으면 없어진 여섯 칸이 「못 구웠다」로 서고**,
 *      유호님은 그것을 «굽기 사고»로 읽으신다 — 사실은 그냥 접힌 갈래인데(맞는 얼굴로 틀린 값).
 *
 * 통로: node tools/부품형태시안.js   (밤 사슬 ⓪-b · 굽기 ⓪-a 뒤에 돈다)
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 방 = path.resolve(루트, 'docs', '캐릭터', '요소공방_0822');
const 출력 = path.join(루트, 'docs', '부품형태_시안.html');
const 자산길 = path.join(루트, 'docs', 'Loom_자산', '구운재질.json');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 렌더 한 장 → webp data URI(폭 지정). 없으면 null — 호출부가 «못 구웠다»로 그린다. */
function 인라인(파일, 폭) {
  if (!fs.existsSync(파일)) return null;
  const 임시 = path.join(os.tmpdir(), `부품형태-${process.pid}-${path.basename(파일, '.png')}-${폭}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '84', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } catch { return null; } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

/** 현행 부품 — 구운재질.json 의 그 그림 그대로(다시 굽지 않는다). */
function 현행(이름) {
  try {
    const j = JSON.parse(fs.readFileSync(자산길, 'utf8'));
    const v = (j['부품'] || {})[이름];
    return (v && v['몸']) || null;
  } catch { return null; }
}

const 렌더 = (세트, 이름, 폭 = 300) => 인라인(path.join(방, 세트, `${이름}.png`), 폭);

/* ── 판 다섯 — 무엇을 무엇과 견주나 ──────────────────────────────────────────
 * 실크기 = 지면에서 실제로 앉는 픽셀. Loom 이 em 으로 잡으므로 본문 17px 기준으로 환산했다:
 *   절번호 2.05em ≈ 35px · 히어로수 2.6em ≈ 44px · 불릿 7px · 링크점 3px · 태그 높이 ≈ 24px.
 * ⚠이 수를 여기서 «정하지» 않는다 — `tools/lib/loom.js` 가 쓴 값을 옮겨 적은 것이다.
 *   loom 이 바뀌면 이 줄도 바뀌어야 한다(두 곳이 알면 갈린다 — 그래서 근거를 함께 적는다). */
const 판들 = [
  {
    이름: 'A · 불릿',
    자리: '목록의 점 — 지면에서 **가장 많이 반복되는** 부품이다(그래서 갇힌 빛이 무채다 · 철칙 ④).',
    실크기: 7,
    현행: { 이름: '레진구_무채', uri: 현행('레진구_무채') },
    후보: [
      { 이름: '매듭점(세잎 매듭)', uri: 렌더('부품형태', 'A1_매듭점') },
      { 이름: '프렌치노트(감아 만든 점)', uri: 렌더('부품형태', 'A2_프렌치노트') },
    ],
    묻는것: '**7px 에서 실루엣이 사는가.** 128px 에서 예쁜 것이 7px 에서 뭉개지면 진 것이다.',
  },
  {
    이름: 'B · 절번호',
    자리: '절 머리의 번호 — 원고는 번호를 안 적는다(CSS counter 가 센다). 그릇만 갈아 끼우는 자리.',
    실크기: 35,
    현행: { 이름: '원판(유리)', uri: 현행('원판') },
    후보: [
      { 이름: '단추숫자 01(자수)', uri: 렌더('부품형태', 'B1_단추숫자_01') },
      { 이름: '단추숫자 07(자수)', uri: 렌더('부품형태', 'B1_단추숫자_07') },
      { 이름: '라벨숫자 01(자수)', uri: 렌더('부품형태', 'B2_라벨숫자_01') },
      { 이름: '라벨숫자 07(자수)', uri: 렌더('부품형태', 'B2_라벨숫자_07') },
    ],
    묻는것: '**숫자를 굽나, 얹나.** 구우면 자수가 되고(01~12 를 다 구워야 한다), 얹으면 CSS 가 세는 대신 자수가 아니다. '
      + '01·07 을 함께 낸 까닭은 복셀 리메시(0.018)가 «1»과 «7»의 가는 획을 뭉갤 수 있어서다.',
  },
  {
    이름: 'C · 링크점',
    자리: '본문 링크 앞의 점 — 지면에서 **가장 작다**(3px). 밑선·굵기와 겹쳐야 링크로 읽힌다.',
    실크기: 3,
    현행: { 이름: '유리구', uri: 현행('유리구') },
    후보: [{ 이름: '땀점(러닝 스티치 한 땀)', uri: 렌더('부품형태', 'C_땀점') }],
    묻는것: '**3px 에 실 결이 남는가.** 안 남으면 유리구를 뺀 값이 0이다.',
  },
  {
    이름: 'D · 태그(칩)',
    자리: '분류 칩 — `--분모` 의 **유일한 CSS 흉내 1**이 여기다. 실물로 바꾸는 것이 §2-업 ③의 남은 절반.',
    실크기: 24,
    현행: { 이름: '칩', uri: 현행('칩') },
    후보: [
    ],
    세겹: {
      왼: 렌더('부품형태', 'D1_태그왼', 200),
      중: 렌더('부품형태', 'D2_태그중', 200),
      오른: 렌더('부품형태', 'D3_태그오른', 200),
    },
    묻는것: '🔴 **이어 붙인 자리가 보이나.** `border-image` 는 `border-radius` 를 무시하므로(08-16 실측 · 회귀가 그 자리를 진다) '
      + '9분할 대신 **세 겹 배경**으로 간다 — 마구리가 라운드를 «그림으로» 쥔다. 아래 칩은 실제로 그 CSS 로 조립한 것이다.',
  },
  {
    이름: 'E · 히어로수',
    자리: '지면당 **1점** — 가장 무거운 자리라 여기서만 갇힌 빛이 코랄이다. 유호님이 09-01 에 보신 그 구슬.',
    실크기: 44,
    현행: { 이름: '레진구', uri: 현행('레진구') },
    후보: [
      { 이름: '와펜숫자 16(자수)', uri: 렌더('부품형태', 'E1_와펜숫자') },
      { 이름: '폼폼숫자 16(자수)', uri: 렌더('부품형태', 'E2_폼폼숫자') },
      { 이름: '매듭숫자 16(자수)', uri: 렌더('부품형태', 'E3_매듭숫자') },
    ],
    묻는것: '**폼폼 위의 숫자가 털에 먹히나.** 띄우면 스티커처럼 뜨고 붙이면 파묻힌다 — 그 사이가 있는지를 보려고 굽는다. '
      + '없으면 그 후보가 지는 것이고, 그것도 판정이다.',
  },
];

function 칸(x, 폭 = 190) {
  if (!x.uri) {
    return `<figure class="유리 잔잔 형태칸 없음"><div class="빈판">못 구웠다</div>
      <figcaption>${esc(x.이름)}</figcaption></figure>`;
  }
  return `<figure class="유리 잔잔 형태칸"><img src="${x.uri}" alt="${esc(x.이름)}" style="max-width:${폭}px">
    <figcaption>${esc(x.이름)}</figcaption></figure>`;
}

/** 실크기 줄 — 「지면에서 이만하다」. 대조가 아니라 **각성**을 노린 줄이다. */
function 실크기줄(판) {
  const 것들 = [판.현행, ...판.후보].filter((x) => x.uri);
  if (!것들.length) return '';
  const 알 = 것들.map((x) =>
    `<span class="실칸"><img src="${x.uri}" alt="" style="width:${판.실크기}px;height:${판.실크기}px;object-fit:contain">
     </span>`).join('');
  return `<div class="유리 알림 조용 듦"><p class="작게" style="margin:0 0 .6em">
    📏 <b>실크기 ${판.실크기}px</b> — 지면에서 이만하게 앉는다(왼쪽이 현행). 여기서 안 보이면 위에서 예쁜 것은 뜻이 없다.</p>
    <div class="실줄">${알}</div></div>`;
}

/** 태그 세 겹 — **실제 CSS 로 조립해** 보여 준다(그게 이 판의 질문이다). */
function 세겹줄(세겹) {
  const 셋 = ['왼', '중', '오른'].map((k) => 세겹[k]);
  if (셋.some((u) => !u)) {
    return `<div class="유리 알림 듦"><p class="작게" style="margin:0">🔴 세 겹 중 못 구운 조각이 있다 —
      ${['왼', '중', '오른'].filter((k) => !세겹[k]).map(esc).join('·')}. 셋은 한 벌이라 하나가 없으면 이 판정이 안 선다.</p></div>`;
  }
  const 배경 = `background:url(${세겹.왼}) left/auto 100% no-repeat,`
    + `url(${세겹.오른}) right/auto 100% no-repeat,`
    + `url(${세겹.중}) center/auto 100% repeat-x`;
  return `<div class="유리 잔잔 판" style="padding:var(--단)">
    <p class="작게 흐린" style="margin:0 0 .8em">아래는 그림 셋을 <b>실제 CSS 세 겹 배경</b>으로 이어 붙인 것이다 —
      길이가 달라도 마구리는 안 늘어나고 가운데만 반복된다.</p>
    <div class="세겹줄">
      <span class="세겹칩" style="${배경}">펠트</span>
      <span class="세겹칩" style="${배경}">한국어 학원</span>
      <span class="세겹칩" style="${배경}">아주 긴 분류 이름도 마구리가 안 늘어난다</span>
    </div></div>`;
}

function main() {
  if (!fs.existsSync(방)) {
    console.error(`🔴 렌더 방이 없다 — 굽기가 먼저다(밤 사슬 ⑤·⑤-c).\n   ${방}`);
    process.exit(1);
  }
  let 있음 = 0, 없음 = 0;
  const 절들 = 판들.map((판, i) => {
    const 것들 = [판.현행, ...판.후보];
    것들.forEach((x) => { if (x.uri) 있음 += 1; else 없음 += 1; });
    const 후보칸 = 판.후보.map((x) => 칸(x)).join('');
    return `<h2 id="s${i + 1}" class="듦"><span>${esc(판.이름)}</span></h2>
<p class="듦">${판.자리.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>
<div class="유리 알림 듦"><p class="작게" style="margin:0"><b>이 판이 묻는 것</b> —
  ${판.묻는것.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>')}</p></div>
<div class="맞줄">
  <div class="쪽"><p class="꼭지">현행 — before</p><div class="형태줄">${칸(판.현행, 230)}</div></div>
  <div class="쪽"><p class="꼭지">후보 — after</p><div class="형태줄">${후보칸}</div></div>
</div>
${판.세겹 ? 세겹줄(판.세겹) : ''}
${실크기줄(판)}`;
  });

  const 표지그림 = (판들[4].후보.find((x) => x.uri) || 판들[0].후보.find((x) => x.uri) || {}).uri;

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>부품 형태 — «구» 탈피 판정</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/부품형태시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 후보 렌더 = docs/캐릭터/요소공방_0822/{형태후보,부품형태} · 현행 = docs/Loom_자산/구운재질.json -->
<!--펠트스킨-->
<style>
/* 이 블록은 지면 CSS 가 아니라 «렌더 사진»의 액자다 — 부품·율·재질은 전부 Loom 이 진다. */
.맞줄{display:grid;grid-template-columns:1fr;gap:var(--단);margin:var(--단) 0;}
@media (min-width:900px){ .맞줄{grid-template-columns:minmax(0,260px) minmax(0,1fr);align-items:start;} }
.쪽 .꼭지{margin:0 0 var(--참);}
.형태줄{display:flex;flex-wrap:wrap;gap:var(--칸);}
.형태칸{margin:0;padding:var(--참);text-align:center;}
.형태칸 img{display:block;width:100%;height:auto;border-radius:12px;}
.형태칸 figcaption{margin-top:var(--틈);font-size:.78rem;color:var(--ash);line-height:1.4;max-width:22ch;}
.형태칸.없음 .빈판{display:grid;place-items:center;min-height:120px;border-radius:12px;
  border:1px dashed rgba(var(--coral-rgb),.5);color:var(--coral);font-size:.82rem;font-weight:700;}
.실줄{display:flex;align-items:center;gap:18px;flex-wrap:wrap;}
.실칸{display:inline-grid;place-items:center;}
.세겹줄{display:flex;flex-wrap:wrap;gap:var(--칸);align-items:center;}
.세겹칩{display:inline-flex;align-items:center;height:34px;padding:0 16px;
  font-size:.86rem;font-weight:700;color:var(--ink);letter-spacing:-.02em;}
@media print{ .형태칸 img{max-width:150px;} }
</style>

<header class="표지">
  ${표지그림 ? `<div class="오브" aria-hidden="true" style="background-image:url(${표지그림});background-size:cover"></div>`
             : '<div class="오브" aria-hidden="true">형</div>'}
  <div>
    <p class="꼭지">LOOM · 부품 형태 공방</p>
    <h1>«구»를 벗는다</h1>
    <p class="한줄">지면 부품이 아직 유리·레진 구슬이다. 그 자리를 공방 문법으로 바꾸면 어떻게 읽히는지,
       현행과 후보를 나란히 놓고 눈으로 고르는 판이다.</p>
    <p class="메타">2026-09-01 · 설계 = docs/캐릭터/부품형태공방_0901/인계.md ·
       굽기 = node tools/세트굽기.js · 지면 = node tools/부품형태시안.js</p>
  </div>
</header>

<div class="유리 알림 듦"><p class="작게" style="margin:0">
  🔴 <b>유호 확정 09-01</b> — 「이건 유리 재질이잖아 · 이 쓰레기같은 오브 유리 싹다 삭제해줘 ·
  우리 좋은 털재질 요소들 많은데 왜 이걸 쓰는거야」. <b>구 계열은 은퇴 대상</b>이라,
  왼쪽의 현행은 «되돌릴 후보»가 아니라 <b>before</b> 다. 고르실 것은 「바꿀까」가 아니라 «어느 털이냐»다.</p></div>

${절들.join('\n')}

<hr class="실금">
<h2 id="s9" class="듦"><span>고르신 뒤에 일어나는 일</span></h2>
<ol class="듦">
  <li>고른 후보를 <code>tools/lib/loom.js</code> 의 그 부품 자리에 배선한다(구움표 + 재질맵).</li>
  <li><code>node tools/lib/loom.js --분모</code> 가 그 부품을 «구움»으로 세는지 확인한다.</li>
  <li>지면 40벌이 다음 굽기에서 함께 갈아입는다 — 낱장으로 안 고친다.</li>
</ol>
<p class="듦 흐린 작게">⚠ 지금은 히어로수만 지면에서 빼 두었다(대체가 설 때까지). 절번호·불릿·링크점은
   저장소 40벌 공통이라 지금 뜯으면 CSS 흉내로 되돌아가 09-01 아침 확정(「흉내 금지」)을 어긴다.</p>

<footer class="메타">후보 렌더 = <code>docs/캐릭터/요소공방_0822/{형태후보,부품형태}/</code> ·
현행 = <code>docs/Loom_자산/구운재질.json</code>(다시 굽지 않는다 — 지면이 지금 입은 그 그림이라야 대조가 참이다) ·
지면 = <code>tools/펠트문서.js</code>(Loom L4).</footer>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `부품형태-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  /* 0 은 분모와 함께 쓴다 — 빠진 칸을 «없는 것»이 아니라 «못 구운 것»으로 세어 낸다(머리말 「대가」). */
  console.log(`■ 부품 형태 시안  ${path.relative(루트, 출력)}  `
    + `(${Math.round(Buffer.byteLength(html) / 1024)}KB · 판 ${판들.length} · 그림 ${있음 + 없음} = 있음 ${있음} + 못구움 ${없음})`);
  if (없음) {
    console.log('  🟡 못 구운 칸이 있다 — 지면에는 «못 구웠다»로 그렸다(빈칸으로 두면 판정처럼 보인다).');
    console.log('     처방: node tools/세트굽기.js --세트 형태후보,부품형태');
  }
}

module.exports = { 판들, 인라인, 현행 };
if (require.main === module) main();
