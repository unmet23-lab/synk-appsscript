#!/usr/bin/env node
/**
 * 이해대장 — 철학 정본 부록 A 를 **가리킬 수 있는 한 장**으로 그린다.
 *
 * 왜 있나 (2026-08-12 · 유호님 아이디어 「옵시디언 화면처럼 색상을 지정해 한눈에 파악」):
 *   부록 A 는 표 두 개라 「무엇이 있다」는 읽히는데 **「어디가 비었다」가 안 읽힌다.**
 *   특히 A-1 의 ㉡(사람 이해) 「돈다」 칸이 빈 것 — 우리 회사가 존재하는 이유인데 다른 칸과
 *   똑같은 무게로 지나간다. 색은 장식이 아니라 **진단**이다.
 *
 * 🔑 v2 (같은 날 2차 지시) — 유호님: 「이 대장을 보고 검토·발전 지시를 자주 내릴 거다.
 *   내가 특정 칸을 말하면 그 부분만 철학 정본에 비추어 다시 검토할 수 있게 해달라.」
 *   → 읽는 화면에서 **가리키는 화면**으로 바꾼다. 칸마다 **주소**(㉡2 · 앱1)를 박고,
 *     누르면 지시문이 통째로 복사된다. 그 지시문이 그대로 `/대장검토` 스킬의 입력이 된다.
 *     주소가 없으면 유호님이 매번 「사람 이해의 짓고 있다 칸」을 말로 풀어야 하고,
 *     그 순간 세션마다 다른 칸을 짚는다 — 주소는 편의가 아니라 **정확도 장치**다.
 *
 * 설계 넷:
 *   ① **정본에서 «파싱»한다 — 사본을 두지 않는다.** 데이터를 베끼면 정본 개정 때 화면만 낡아,
 *      이미 채운 칸을 계속 「비었다」고 하거나(가짜 빨강) 아직 빈 칸을 「찼다」고 한다(가짜 초록).
 *   ② **색은 브랜드 킷에서만**(유호 확정) · DESIGN.md 대비 규칙 준수(KC Sun 은 면으로만).
 *   ③ **못 읽으면 조용히 넘어가지 않는다** — 「비었다」와 「못 읽었다」가 같은 모양이면 안 된다(F207).
 *   ④ **주소는 «내용»이 아니라 «자리»에 붙는다** — 층 이름·열 이름이 바뀌어도 주소가 흔들리면
 *      유호님이 어제 적어 둔 「㉡2 보류」가 오늘 딴 칸을 가리킨다. 그래서 주소는 층 기호 + 열 순번이다.
 *
 * 쓰기: node tools/이해대장.js            → docs/이해대장.html 생성
 *      node tools/이해대장.js --바로가기  → 생성 + 바탕화면 「SYNK 코어」에 .lnk
 */
'use strict';

const fs = require('node:fs');

/* ── Loom — 이 지면이 부품을 «입는» 통로 (2026-08-18 · ④ 지면 배선) ──────────────
 * 판정(훅 게이트·얹을 자리·멱등·범위진단)은 전부 `tools/lib/loom얹기.js` 하나가 진다.
 * 여기서 고르는 것은 프리셋 하나뿐 — `부품만` = 지면이 자기 디자인을 지고 부품만 얹는 판.
 * 🔴 훅이 0 이면 통로가 «안 얹는다». 그래야 「마커만 켜진 초록」이 안 생긴다(F517②). */
const loom얹기모듈 = require('./lib/loom얹기.js');
function loom태우기(html) {
  const r = loom얹기모듈.얹기(html, { 지면: '부품만' });
  if (!r.얹힘 && r.범위흠) console.error('   ⚠ Loom 미적용 — ' + r.범위흠);
  else if (r.얹힘) console.error(`   ✅ Loom 부품 ${r.훅.length}종 — ${r.훅.join('·')}`);
  return r.html;
}

const path = require('node:path');
const { 칸나누기 } = require('./lib/표.js');
const 시트도달 = require('./lib/시트도달.js');

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..');
/* ⚠ 두 경로는 갈아끼울 수 있다 — `--검사` 가 **작업본이 아니라 커밋될 내용**을 재야 하기 때문이다.
 *   작업본을 재는 검사는 「양쪽 다 고쳐 놓고 정본만 커밋」을 원리상 못 본다(F302 · 계약동봉 게이트가
 *   같은 이유로 같은 규약을 쓴다). 갈아끼우는 것은 게이트뿐이고 평소 생성은 기본값 그대로다. */
const 정본경로 = process.env.SYNK_대장_정본 || path.join(ROOT, 'docs', 'SYNK_철학.md');
const 산출경로 = process.env.SYNK_대장_산출 || path.join(ROOT, 'docs', '이해대장.html');

/* 「함께 볼 것」 — 이해 대장 «옆»에 두는 판정·설계 화면들 (유호 지시 2026-08-18 「이해대장 옆에 파일을 만들어줘」).
 * 왜 여기냐: 바탕화면 「SYNK 코어」에 화면마다 바로가기를 늘리면 그때마다 유호님 손이 든다
 *   (철학 ㉡ — 사람 손을 늘리는 해법을 쓰지 않는다). 이미 있는 바로가기 «하나»가 나머지로 가는
 *   입구가 되면 새 화면이 늘어도 유호님이 할 일은 0 이다.
 * 🔑 목록은 여기 **한 곳**에만 산다 — 화면과 상수 두 벌로 두면 반드시 갈린다.
 * ⚠ 실재를 검사한다(설계 ③): 파일이 없으면 조용히 빼지 않고 **빨갛게 드러낸다.** 링크만 지우면
 *   유호님은 그 화면이 «원래 없다»고 읽지, 목록이 낡았다고 읽지 않는다. */
const 함께볼것 = [
  { 파일: '앱_방향설계_2026-08-18.html', 제목: 'AI를 껐을 때 남는 한국어',
    한줄: '앱이 가는 한 방향 — TOPIK 급수와 회화는 같은 능력의 앞뒤다' },
  { 파일: '오답이_못보는것_2026-08-18.html', 제목: '오답이 못 보는 것',
    한줄: '엔진 축 여섯 — 데이터에 있는데 아무도 안 읽는 자리 (대기열 #Q116~#Q121)' },
  { 파일: '경쟁판정_2026-08-18.html', 제목: '이길 수 있는 자리',
    한줄: '경쟁 지형과, 그들이 구조적으로 못 들어오는 세 자리' },
  { 파일: '설계대조_2026-08-18.html', 제목: '바뀐 것과 그대로인 것',
    한줄: '전 설계 대비 무엇이 바뀌었나 — 그리고 정본과 어긋난 자리 둘' },
];

function 함께볼것구역() {
  /* 🔴 [2026-08-20] 카드 실재 검사는 **docs/ 고정**이다 — `path.dirname(산출경로)` 로 잡으면
   *   `--검사` 모드(산출경로 = 게이트의 임시방)에서 카드 4장이 언제나 「없다」로 그려져,
   *   생성기를 만진 모든 커밋이 «스테이징 화면과 다르다»로 거짓 차단된다(실측: 게이트가 선 뒤
   *   생성기+검사기를 함께 담은 첫 커밋에서 발화 — 임시방에 카드가 있을 리 없다).
   *   카드가 실제로 사는 자리는 화면이 배포되는 자리(docs/)이지 산출 파일의 옆이 아니다. */
  const 폴더 = path.join(ROOT, 'docs');
  const 줄 = 함께볼것.map((d) => {
    if (!fs.existsSync(path.join(폴더, d.파일))) {
      return `  <div style="padding:11px 14px;border:2px dashed ${킷.coral3};border-radius:10px;color:${킷.coral3};font-size:12.5px;line-height:1.6">`
        + `🔴 <b>${d.제목}</b> — 파일이 없다(<code>${d.파일}</code>). 이 목록이 낡았다는 뜻이다 — <code>tools/이해대장.js</code> 의 <code>함께볼것</code> 을 고친다.</div>`;
    }
    return `  <a href="${encodeURI(d.파일)}" style="display:block;padding:11px 14px;border:1px solid ${킷.cream3};border-radius:10px;text-decoration:none;background:${킷.paper}">`
      + `<div style="font-weight:800;font-size:13.5px;color:${킷.ink};letter-spacing:-.02em">${d.제목}</div>`
      + `<div style="margin-top:3px;font-size:12px;color:${킷.slate2};line-height:1.55">${d.한줄}</div></a>`;
  }).join('\n');
  return `<div style="margin-top:22px">
  <div style="font-size:12.5px;font-weight:800;color:${킷.slate2};letter-spacing:.04em;margin-bottom:9px">📎 함께 볼 것 — 판정·설계 화면</div>
  <div style="display:grid;gap:8px">
${줄}
  </div>
</div>`;
}

/** 브랜드 킷 — DESIGN.md §1 이 정본. 여기 있는 것은 «인용»이고, 새 색을 만들지 않는다. */
const 킷 = {
  paper: '#FAFAF9', ink: '#1B1B1A', navy: '#262626', navy2: '#08090C', navy3: '#373737',
  cream: '#E4E4E7', cream3: '#D1D2D4', slate2: '#666666',
  coral: '#FF6B5C', coral3: '#E8543F', coralWash: '#FFE9E4',
  sun: '#FFD447', emerald: '#13724A',
};

/** 상태 칸 → 색. 「비었다」가 가장 눈에 띄어야 한다 — 그게 이 화면의 목적이다. */
const 상태색 = {
  돈다:        { 면: 킷.emerald, 글자: 킷.cream },
  '짓고 있다': { 면: 킷.sun,     글자: 킷.ink },
  '아직 없다': { 면: 킷.coral,   글자: 킷.navy2 },
  '개원과 함께 연다': { 면: 킷.slate2, 글자: 킷.cream },
};

/** 조직 층 → 왼쪽 띠 색 + A-2 주소 접두. 유호님 요청 = 조직 층을 색으로 가른다. */
const 층정보 = {
  '학습·앱': { 색: 킷.coral3, 주소: '앱' },
  '데이터·엔진': { 색: 킷.emerald, 주소: '엔진' },
  운영: { 색: 킷.navy3, 주소: '운영' },
  브랜드: { 색: 킷.sun, 주소: '브랜드' },
  '수업·현장': { 색: 킷.slate2, 주소: '수업' },
};

/** 마크다운 표식만 걷는다 — 뜻은 안 건드린다(평문화). */
function 평문(s) {
  return String(s)
    .replace(/\*\*/g, '').replace(/`/g, '')
    .replace(/\*\(([^)]*)\)\*/g, '($1)')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 표 한 벌을 뽑는다 — 제목 줄 다음의 첫 `|` 블록. 구분선(|---|)은 버린다. */
function 표뽑기(md, 제목정규식) {
  const lines = md.split(/\r?\n/);
  const i = lines.findIndex((l) => 제목정규식.test(l));
  if (i < 0) return null;
  const 행 = [];
  let 봤나 = false;
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j].trim();
    if (!l.startsWith('|')) { if (봤나) break; continue; }   // 표 시작 전 설명문은 건너뛴다
    봤나 = true;
    if (/^\|[\s:|-]+\|$/.test(l)) continue;                  // 구분선
    /* 날 split 금지 — 백틱 안 파이프까지 칸막이로 세면 뒤 칸이 통째로 밀리고,
     * 밀린 뒤에도 오류는 안 나 「비었나()」가 엉뚱한 칸을 읽는다(tools/lib/표.js 머리 · 회귀 tests/표칸.test.js). */
    행.push(칸나누기(l).map(평문));
  }
  return 행.length >= 2 ? 행 : null;                          // 머리 + 최소 1행
}

/** 칸이 실질적으로 비었는가 — 「—」·「없다」는 «내용»이 아니라 «빈 것»이다.
 *  ⚠ **원문 표기 그대로 들어와도 판정한다**: 표뽑기() 는 평문()을 거치지만 이 함수를 따로 부르는
 *  자리(회귀·다른 도구)는 굵게 표식이 살아 있는 원문을 준다. 표식에 눈이 멀면 `**없다.**` 를
 *  「내용 있음」으로 세고, 그 순간 이 화면은 **빈 칸을 찬 칸으로 보고한다** — 가장 비싼 실패다. */
function 비었나(칸) {
  const s = String(칸).replace(/[*`_~]/g, '').replace(/[🔴⚠✅·\s]/g, '');
  return !s || s === '—' || s === '-' || /^없다/.test(s);
}

/** 층 이름에서 기호만 — 「㉠ 실력 — 무엇을 틀리는가」 → 「㉠」. 주소의 앞자리다. */
function 층기호(이름) {
  const m = String(이름).match(/[㉠㉡㉢]/);
  return m ? m[0] : null;
}

/** 층 이름의 짧은 이름 — 「㉠ 실력 — 무엇을 틀리는가」 → 「㉠ 실력」 */
function 짧은이름(이름) {
  return String(이름).split('—')[0].trim();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 엔진 도달 실측 — **손으로 적지 않는다.** 실값 정본은 형제 저장소의 래칫 «세 개»다.
 *   `도달0상한`             = 도달이 0인 사건 수
 *   `생산자섰는데도달0상한` = 생산자는 섰는데 도달이 0인 사건 수 (이쪽이 더 아프다 — 모으고 안 쓴다는 뜻)
 *   `행동안바뀜상한`         = 자동으로 도는데 그 파생이 «다음에 줄 것»을 못 바꾸는 **부품** 수
 *                              (⚠축이 «부품»이다 — 사건 수로 되돌리지 않는다 · 근거 = 행동층 장부)
 * 래칫이라 **내려가는 것은 언제나 통과하고 올라가면 빨개진다** — 그래서 이 숫자는 «지금의 빚»이다.
 *
 * ⚠ 형제 저장소는 **repo 밖 환경**이다(CI·워크트리엔 없다). 없을 때 0 으로 적으면
 *   「빚이 0」과 「못 쟀다」가 같은 모양이 된다(F207) — 그래서 null 을 돌려주고 화면이 그렇게 말한다.
 *   셋째 래칫만 없는 옛 판도 마찬가지다 — 그 칸만 null 로 갈라 「못 읽었다」를 따로 말한다.
 */
/* 🔴 워크트리에서 형제를 **조용히 못 찾던 것**을 고친다(2026-08-16 실측).
 *   이 저장소의 코드 트랙은 규약상 워크트리에서 짓는다(CLAUDE.md 「워크트리 + PR」). 그런데
 *   워크트리 경로는 `<본체>/.claude/worktrees/<이름>` 이라 `..` 이 `worktrees/` 를 가리키고,
 *   거기엔 형제가 없다 — 그래서 **모든 코드 트랙에서 이 줄이 「⚠ 못 쟀다」로 열화**했고,
 *   그 판을 그대로 커밋하면 master 의 화면이 실측을 잃는다(이 파일의 회귀가 경고한 그 자리).
 *   후보를 순서대로 본다: ①옆(평소) ②워크트리면 본체의 옆. 둘 다 없으면 null 그대로다
 *   — 「못 읽었다」와 「빚이 0」을 같은 모양으로 두지 않는 규칙은 안 건드린다. */
function 형제경로들(root) {
  const 후보 = [path.resolve(root, '..', 'SYNK-talk')];
  const m = /^(.*)[\\/]\.claude[\\/]worktrees[\\/][^\\/]+$/.exec(path.resolve(root));
  if (m) 후보.push(path.resolve(m[1], '..', 'SYNK-talk'));
  return 후보;
}

function 도달실측(root) {
  const p = 형제경로들(root)
    .map((d) => path.join(d, 'lib', '이벤트검증.js'))
    .find((f) => fs.existsSync(f));
  if (!p) return null;
  const src = fs.readFileSync(p, 'utf8');
  const 집기 = (이름) => {
    const m = src.match(new RegExp(`^const\\s+${이름}\\s*=\\s*(\\d+)`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const 도달0 = 집기('도달0상한');
  const 생산자만 = 집기('생산자섰는데도달0상한');
  const 행동안바뀜 = 집기('행동안바뀜상한');
  return (도달0 === null && 생산자만 === null && 행동안바뀜 === null)
    ? null : { 도달0, 생산자만, 행동안바뀜, 어디: p, 성격: 도달0성격(p) };
}

/**
 * 도달 0 인 사건의 «성격» — 숫자 하나로는 «지금 할 일»과 «이유가 이미 밝혀진 것»이 같은 얼굴을 한다.
 *   유호 확정 08-14 「0은 분모와 함께 쓴다」의 집행이다: 「3종」이 아니라 «사유가 적힌 3 + 미판정 0».
 *   실측 2026-08-16 기준 셋은 전부 사유가 적혀 있다(제어 사건 둘 · 생산자 0 인 `exam.result`) —
 *   그런데 화면은 분모 없이 빨간 3 만 내고 있어서 **급한 일처럼 보였다**.
 *
 * 🔑 성격을 여기서 **분류하지 않는다** — 왜 0 인지는 형제 저장소의 `엔진도달` 맵에 이미 문장으로
 *   적혀 있다(`{사유: …}`). 이쪽에서 갈래를 다시 지으면 같은 판정이 두 곳에 살고, 갈리는 날
 *   화면이 코드보다 오래된 말을 한다. 여기서는 **있는 것을 옮길 뿐**이다.
 * ⚠ 판정 축은 `도달` 배열의 유무다(부품·소비자가 실재하는 칸). **사유 문장을 매칭하지 않는다** —
 *   문장은 개서되고, 그날 화면이 조용히 빈다.
 * ⚠ 못 읽으면 `null` — 「사유 0」과 「안 읽었다」를 같은 모양으로 두지 않는다(F207).
 */
function 도달0성격(모듈경로) {
  let V;
  try { V = require(모듈경로); } catch { return null; }
  if (!Array.isArray(V.앱사건) || !Array.isArray(V.서버사건) || !V.엔진도달) return null;
  return [...V.앱사건, ...V.서버사건]
    .filter((e) => {
      const 칸 = V.엔진도달[e];
      return !(칸 && Array.isArray(칸.도달) && 칸.도달.length);
    })
    .map((e) => ({ 사건: e, 사유: (V.엔진도달[e] || {}).사유 || null, 차단자: (V.엔진도달[e] || {}).차단자 || null }));
}

/**
 * 빨간 칸 전량 — 두 장부(엔진도달·행동층)의 빈 칸을 **한 목록으로** 모아 차단자별로 센다.
 *   유호 지시 2026-08-16 「대장의 빨간 칸을 «지금 할 수 있음 / 학생이 와야 함»으로 가른다」.
 *
 * ■ 왜 두 장부를 합치나 — 화면에서 둘은 이미 같은 빨강이었고, 세션이 착수를 고를 때 보는 것도
 *   「오늘 집을 게 있나」 하나다. 층이 다르다고 따로 세면 그 질문에 두 숫자로 답하게 된다.
 *   층은 버리지 않고 각 줄에 남긴다(어디를 고쳐야 하는지는 층이 답한다).
 *
 * 🔑 갈래 이름을 **여기서 짓지 않는다** — 형제 저장소의 `차단자갈래` 를 그대로 쓴다. 같은 목록을
 *   두 곳에 적으면 갈리고, 갈린 쪽의 증상은 언제나 「통과」다(빈 갈래가 조용히 안 그려진다).
 * ⚠ 못 읽으면 `null` — 「빨강 0」과 「안 읽었다」를 같은 모양으로 두지 않는다(F207).
 */
function 빨간칸(모듈경로) {
  let V;
  try { V = require(모듈경로); } catch { return null; }
  if (!V.엔진도달 || !V.행동층 || !V.차단자갈래) return null;
  const 칸들 = [
    ...Object.entries(V.엔진도달)
      .filter(([, v]) => !(v && Array.isArray(v.도달) && v.도달.length))
      .map(([이름, v]) => ({ 층: '사건', 이름, 차단자: v.차단자 || null, 사유: v.사유 || null })),
    ...Object.entries(V.행동층)
      .filter(([, v]) => !(v && v.파일))
      .map(([이름, v]) => ({ 층: '부품', 이름, 차단자: v.차단자 || null, 사유: v.사유 || null })),
  ];
  const 갈래 = Object.keys(V.차단자갈래);
  const 셈 = Object.fromEntries(갈래.map((g) => [g, 칸들.filter((c) => c.차단자 === g).length]));
  // 어휘 밖·미기재는 **따로 센다** — 0 으로 접으면 화면이 「전부 분류됐다」고 거짓말한다.
  const 미분류 = 칸들.filter((c) => !갈래.includes(c.차단자));
  return { 칸들, 갈래, 뜻: V.차단자갈래, 셈, 미분류 };
}

/**
 * 엔진 점수 — 대장의 «범위» 축 옆에 서는 «성능» 축이다(v1.6 신설).
 *   범위 = 그 학생의 어떤 면을 볼 수 있나(이해 12칸 · 게이트 ④의 「늘었나」가 이쪽이다)
 *   성능 = 본 것을 얼마나 정확히 처리하나(시험지 102문항)
 *   둘은 갈린다 — 성향을 아무리 정확히 처리해도 성향을 «안 보고 있으면» 개인화는 안 된다.
 *
 * 🔑 **형제 저장소의 `evals/결과.md` 를 파싱하지 않는다.** 그 파일엔 회차별 표가 여럿이고
 *   (첫 판독 · 채점 정직화 후 · 파서 수리 후 · v2 …) 지금도 개서 중이라, 정규식으로 집으면
 *   «아무 표나» 집는다. 대신 이 저장소에 한 줄씩 쌓는다 — 「지난번 대비」를 내려면 어차피
 *   이력이 필요한데 결과.md 에는 최신값만 남는다.
 * ⚠ **판이 다르면 대조하지 않는다.** v1 과 v2 는 프롬프트가 달라서 점수 차가 「나아졌다」를
 *   뜻하지 않는다 — 조건을 둘 바꾸면 그건 대조가 아니다(F045). 같은 판의 직전 회차가
 *   있을 때만 ↑↓ 를 낸다.
 * ⚠ 파일이 없거나 비었으면 0 이 아니라 **null** — 「점수 0」과 「안 재봤다」는 다른 상태다(F207).
 */
function 엔진점수(root) {
  const p = path.join(root, 'docs', '_ops', '엔진점수.jsonl');
  if (!fs.existsSync(p)) return null;
  const 회차 = [];
  for (const s of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = s.trim();
    if (!t) continue;
    // 깨진 줄은 «세지 않되» 조용히 0 으로 만들지도 않는다 — 아래 회차수로 몇 줄이 살았는지 드러난다.
    try { 회차.push(JSON.parse(t)); } catch (_) { /* 무시 */ }
  }
  if (!회차.length) return null;
  const 현재 = 회차[회차.length - 1];
  const 직전 = [...회차.slice(0, -1)].reverse().find((r) => r.판 === 현재.판) || null;
  return { 현재, 직전, 변화: 직전 ? 현재.전체 - 직전.전체 : null, 회차수: 회차.length, 어디: p };
}

/** 「엔진에 닿는가」 열만 «내용»으로 색을 정한다 — 이 열은 상태 이름이 아니라 판정이 값이다.
 *
 * 🔴 **부정을 먼저 묻는다.** 이 열의 이름이 「엔진에 닿는가」라 **부정 판정도 「닿는다」를 품는다** —
 *   「못 닿는다」·「스탬프까지만 닿는다」가 그 모양이다. 긍정을 먼저 물으면 그 전부가 초록이 되고,
 *   화면은 «닿지 않는 층»을 «닿는다»로 보고한다. `비었나()` 가 막는 것과 **같은 종류의 가장 비싼
 *   실패**인데 이 열만 열려 있었다(실측 08-12 — 그때까지 부정 갈래는 「닿는다」라는 낱말을 피해서
 *   쓴 덕에 우연히 맞고 있었다 · 우연은 규칙이 아니다).
 * 🔑 「물을 수 없다」(cream3)는 «끊겼다»와 **다른 값**이라 부정 목록에 안 넣는다 — 배선이 끊긴 것과
 *   재료가 0이라 판정 자체가 불가한 것은 다음에 할 일이 다르다. */
function 도달색(내용) {
  if (/끊겼|미뤄|못 닿|안 닿|까지만/.test(내용)) return { 면: 킷.coral, 글자: 킷.navy2, 표: '끊겼다' };
  if (/닿는다/.test(내용)) return { 면: 킷.emerald, 글자: 킷.cream, 표: '닿는다' };
  return { 면: 킷.cream3, 글자: 킷.navy, 표: '물을 수 없다' };
}

/** A-1 한 «행»의 도달 판정 — 도달 열은 항상 마지막 칸이다. 색·요약·「먼저 볼 곳」이 **이 한 함수**를
 *  지나게 해서 세 자리가 갈리지 않게 한다(회귀가 사본 0 을 소스로 잰다). */
const 도달판정 = (행) => 도달색(행[행.length - 1]).표;

/** 긴 한 줄을 「·」 기준으로 끊어 목록으로 — 셀 안에서 눈이 미끄러지지 않게. */
function 조각들(내용) {
  return 내용.split(/\s+·\s+/).map((s) => s.trim()).filter(Boolean);
}

/** 지시문 — 누르면 이게 복사된다. 그대로 `/대장검토` 의 입력이 된다. */
function 지시문(주소, 층, 열) {
  return `${주소} 다시 검토해줘 — 「${층}」의 「${열}」 칸을 철학 정본에 비추어 발전시킬 부분이 있는지 봐줘.`;
}

function 복사버튼(주소, 층, 열) {
  return `<button class="복사" data-말="${esc(지시문(주소, 층, 열))}" title="지시문 복사">${esc(주소)}</button>`;
}

/* ── A-1: 층별 카드 ───────────────────────────────────────────────
 * 표가 아니라 카드로 그린다 — 표는 열이 넷이 되는 순간 폰에서 깨지고, 무엇보다
 * **한 층을 통째로 보는 눈**을 못 준다. 유호님이 판단하는 단위는 칸이 아니라 «층»이다. */
function 카드들(행들) {
  const [머리, ...몸] = 행들;
  const 열이름 = 머리.slice(1);
  return 몸.map((행) => {
    const 층 = 짧은이름(행[0]);
    const 기호 = 층기호(행[0]) || '?';
    const 설명 = (행[0].split('—')[1] || '').trim();
    const 도달 = 도달색(행[행.length - 1]);
    const 블록 = 행.slice(1).map((칸, i) => {
      const 열 = 열이름[i];
      const 주소 = `${기호}${i + 1}`;
      const 빔 = 비었나(칸);
      const 마지막 = i === 행.length - 2;
      const c = 마지막 ? 도달 : (상태색[열] || { 면: 킷.slate2, 글자: 킷.cream });
      const 배경 = 빔 ? 'transparent' : c.면;
      const 글자 = 빔 ? 킷.coral3 : c.글자;
      const 테 = 빔 ? `2px dashed ${킷.coral3}` : '1px solid rgba(0,0,0,.07)';
      const 본문 = 빔
        ? '<div class="빔">비었다</div>'
        : `<ul>${조각들(칸).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
      return `<div class="블록${마지막 ? ' 결론' : ''}" style="background:${배경};color:${글자};border:${테}">
        <div class="블록머리"><span class="열이름">${esc(열)}</span>${복사버튼(주소, 층, 열)}</div>
        ${본문}</div>`;
    }).join('');
    return `<section class="카드" id="층-${esc(기호)}">
      <header class="카드머리">
        <h3>${esc(층)}</h3><p>${esc(설명)}</p>
        <span class="도달칩" style="background:${도달.면};color:${도달.글자}">엔진 ${esc(도달.표)}</span>
      </header>
      <div class="블록들">${블록}</div>
    </section>`;
  }).join('');
}

/* ── A-2: 표(층 × 시제) — 여기는 열이 셋이라 표가 맞다 ────────────── */
function 실물표(행들) {
  const [머리, ...몸] = 행들;
  const th = 머리.slice(1).map((h) => `<th>${esc(h)}</th>`).join('');
  const tr = 몸.map((행) => {
    const 이름 = 짧은이름(행[0]);
    const 키 = Object.keys(층정보).find((k) => 이름.includes(k));
    const { 색, 주소: 접두 } = 층정보[키] || { 색: 킷.slate2, 주소: '기타' };
    const tds = 행.slice(1).map((칸, i) => {
      const 열 = 머리[i + 1];
      const 주소 = `${접두}${i + 1}`;
      const 빔 = 비었나(칸);
      const c = 상태색[열] || { 면: 킷.slate2, 글자: 킷.cream };
      const 본문 = 빔 ? '<span class="빔">비었다</span>'
        : `<ul>${조각들(칸).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
      return `<td style="background:${빔 ? 'transparent' : c.면};color:${빔 ? 킷.coral3 : c.글자};`
        + `border:${빔 ? `2px dashed ${킷.coral3}` : '1px solid rgba(0,0,0,.07)'}">`
        + `<div class="칸머리">${복사버튼(주소, 이름, 열)}</div>${본문}</td>`;
    }).join('');
    return `<tr><th class="행이름" style="border-left:8px solid ${색}">${esc(이름)}</th>${tds}</tr>`;
  }).join('');
  return `<table><thead><tr><th></th>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/** 「먼저 볼 곳」 — 화면이 유호님께 **다음 질문을 제안한다.** 빈 칸과 끊긴 도달을 급한 순서로. */
function 먼저볼곳(이해) {
  const [머리, ...몸] = 이해;
  const 후보 = [];
  for (const 행 of 몸) {
    const 기호 = 층기호(행[0]) || '?';
    const 층 = 짧은이름(행[0]);
    /* 판정은 `도달색` 하나에서만 온다 — 같은 물음을 여기 다시 적으면 갈라지고, 갈라진 날
     * 색과 「먼저 볼 곳」이 서로 다른 말을 한다(실측 08-12: 세 곳에 적혀 있었고 둘이 틀렸다). */
    if (도달판정(행) === '끊겼다') {
      후보.push({ 주소: `${기호}${행.length - 1}`, 층, 열: 머리[행.length - 1], 왜: '엔진에 안 닿는다 — 모으고 안 쓰면 미완성이다', 급: 0 });
    }
    if (비었나(행[1])) 후보.push({ 주소: `${기호}1`, 층, 열: 머리[1], 왜: '「돈다」가 0이다 — 이 층은 아직 아무것도 모으지 않는다', 급: 1 });
  }
  return 후보.sort((a, b) => a.급 - b.급).slice(0, 3);
}

function main() {
  const 바로가기 = process.argv.includes('--바로가기');
  if (!fs.existsSync(정본경로)) {
    console.error(`[이해대장] 판단 정본이 없다: ${정본경로} — 그릴 재료가 없다(워크트리면 정상).`);
    process.exit(1);
  }
  const md = fs.readFileSync(정본경로, 'utf8');
  const ver = (md.match(/<!--\s*정본:\s*(v[\d.]+)\s*-->/) || [, '(판 미상)'])[1];

  const 이해 = 표뽑기(md, /^###\s*A-1\./);
  const 실물 = 표뽑기(md, /^###\s*A-2\./);
  if (!이해 || !실물) {
    console.error('[이해대장] 부록 A 의 표를 못 읽었다 — 절 구조가 바뀌었다.'
      + `\n  · A-1 이해 대장: ${이해 ? `OK(${이해.length - 1}행)` : '못 찾음(앵커 ### A-1.)'}`
      + `\n  · A-2 실물 대장: ${실물 ? `OK(${실물.length - 1}행)` : '못 찾음(앵커 ### A-2.)'}`
      + '\n  → 빈 화면을 내지 않는다(「비었다」와 「못 읽었다」가 같은 모양이면 안 된다). 정본을 열어라: docs/SYNK_철학.md');
    process.exit(1);
  }

  const 칸전체 = 이해.slice(1).flatMap((r) => r.slice(1));
  const 빈칸 = 칸전체.filter(비었나).length;
  const 닿는층 = 이해.slice(1).filter((r) => 도달판정(r) === '닿는다').length;
  const 층수 = 이해.length - 1;
  const 실측 = 도달실측(ROOT);
  const 점수 = 엔진점수(ROOT);
  const 성격 = 실측 ? 실측.성격 : null;
  const 미판정 = 성격 ? 성격.filter((s) => !s.사유).length : null;
  /* 「3종」이 분모 없이 빨갛게 서서 **급한 일처럼 보이던** 자리다 — 유호 확정 08-14 「0은 분모와
   * 함께 쓴다」를 여기에 건다. 셋 중 손댈 것이 몇인지가 이 한 줄에서 갈린다.
   * ⚠ 래칫값과 실측 목록이 갈리면 그걸 말한다 — 조용히 둘 중 하나를 고르면 화면이 거짓을 낸다. */
  const 도달분모 = 성격 === null
    ? '<span class="잔글"> (성격은 못 읽었다 — 「사유 0」이 아니다)</span>'
    : `<span class="잔글"> = 왜 0인지 코드가 답하는 것 ${성격.length - 미판정}</span> + <b>손댈 것 ${미판정}</b>`
      + (성격.length === 실측.도달0 ? ''
        : ` <b>⚠ 래칫 ${실측.도달0}과 실측 ${성격.length}이 갈렸다</b>`);
  const 도달줄 = 실측
    ? `<b>도달이 0인 사건 ${실측.도달0}종</b>${도달분모} · 생산자는 섰는데 도달이 0인 사건 <b>${실측.생산자만}종</b>`
      + (실측.행동안바뀜 === null
        ? ' · 행동층 래칫은 <b>못 읽었다</b>(형제 저장소가 옛 판 — 「빚 0」이 아니다)'
        : ` · 자동으로 도는데 «다음에 줄 것»을 안 바꾸는 부품 <b>${실측.행동안바뀜}개</b>`)
      + '<span class="잔글"> — 래칫이라 내려가면 통과, 올라가면 빨개진다 · 실값 정본 = SYNK-talk/lib/이벤트검증.js</span>'
    : '<b>⚠ 못 쟀다</b><span class="잔글"> — 형제 저장소(SYNK-talk)를 못 읽었다. '
      + '「빚이 0」이 아니라 「안 재봤다」이다 — 이 둘을 같은 모양으로 두지 않는다.</span>';

  /* 🔴 빨간 칸 갈래 — 유호 지시 2026-08-16 「빨간 칸을 «지금 할 수 있음 / 학생이 와야 함»으로 가른다」.
   *
   *   위 두 줄은 **몇 칸이 비었나**를 답한다. 그런데 그것만 보고 착수하면 F513 이 난다: 다섯 칸이
   *   같은 빨강이라 「대기열이 막혔으니 이걸 줄이자」로 들어갔다가, 표본 0 짜리 되먹임을 박기
   *   직전에 되돌아왔다. 화면이 답해야 할 질문은 하나 더 있었다 — **오늘 집을 수 있는 게 있나.**
   *
   * 🔑 이 줄은 앞 두 줄과 **분모가 다르다**(사건 층 + 부품 층을 합친다). 합치는 이유는 착수를 고르는
   *   사람이 층으로 안 보고 「일감이 있나」로 보기 때문이다 — 층은 각 줄에 그대로 남긴다.
   * ⚠ 갈래 이름·뜻은 형제 저장소가 정본이다. 여기서 다시 짓지 않는다. */
  const 빨강 = 실측 ? 빨간칸(실측.어디) : null;
  const 빨강줄 = 빨강 === null
    ? '<b>⚠ 못 쟀다</b><span class="잔글"> — 차단자 장부를 못 읽었다(형제 저장소가 없거나 옛 판이다). '
      + '「빨강 0」이 아니라 「안 재봤다」이다.</span>'
    : `<b>빨간 칸 ${빨강.칸들.length}</b> = `
      + 빨강.갈래.map((g) => `${g === '지금' ? '<b>' : ''}${esc(g)} ${빨강.셈[g]}${g === '지금' ? '</b>' : ''}`).join(' · ')
      + (빨강.미분류.length ? ` · <b>⚠ 미분류 ${빨강.미분류.length}</b>` : '')
      + `<br><span class="잔글">오늘 손댈 수 있는 칸은 <b>${빨강.셈['지금'] ?? 0}개</b>다 — 나머지는 `
      + '기다리는 것이지 밀린 것이 아니다(그 둘을 같은 빨강으로 두면 착수가 헛돈다 · F513).</span>';

  /* 갈래별로 묶어 이름을 대게 한다 — 「지금 2」는 셀 수 없고 `exam.result` 는 셀 수 있다(F055). */
  const 빨강사유 = 빨강 && 빨강.칸들.length
    ? `<details class="사유"><summary>빨간 칸 ${빨강.칸들.length} — 누가 열 수 있나</summary>`
      + 빨강.갈래.filter((g) => 빨강.셈[g] > 0).map((g) => `<p><b>${esc(g)}</b> <span class="잔글">${esc(빨강.뜻[g])}</span></p><ul>`
        + 빨강.칸들.filter((c) => c.차단자 === g).map((c) => `<li><code>${esc(c.이름)}</code> `
          + `<span class="잔글">(${esc(c.층)})</span> — ${c.사유 ? esc(c.사유) : '<b>사유가 안 적혔다</b>'}</li>`).join('')
        + '</ul>').join('')
      + (빨강.미분류.length
        ? '<p><b>⚠ 미분류</b> <span class="잔글">차단자가 없거나 어휘 밖이다 — 이게 진짜 손댈 자리다.</span></p><ul>'
          + 빨강.미분류.map((c) => `<li><code>${esc(c.이름)}</code> <span class="잔글">(${esc(c.층)})</span></li>`).join('')
          + '</ul>'
        : '')
      + '</details>'
    : '';

  /* [v9.243] 시트층 줄 — 위 세 래칫이 **원리상 못 보는 층**이다.
   *   위는 전부 앱 사건 14종을 센다. 그런데 오늘 실제로 데이터가 쌓이는 곳은 시트층이고
   *   (설계 §2-1 「지금 실제로 데이터가 쌓이는 유일한 곳」), 그 층의 도달 0 은 여기 서기 전까지
   *   **어느 화면에도 없었다.** 「보이는 것」과 「읽히는 것」을 가르는 자리가 하나 더 필요했다.
   *   0 은 분모와 함께 쓴다 — 합계 = 제품 + 자산 + 도달0 으로 쪼갠다(유호 확정 08-14). */
  /* 🔴 클래스가 `실측` 이 아니라 `실측 시트층` 인 것은 **의도다** — 회귀
   *   `tests/이해대장.test.js` 의 「실측 블록이 1개가 아니다」가 이 자리를 지킨다.
   *   위 앱층 줄은 형제 저장소가 있어야 재므로 CI 에서 글자가 갈리고, 그래서 드리프트 검사가
   *   그 블록 «하나»를 마스킹한다. 마스킹은 첫 블록만 접으니 `실측` 이 둘이면 뒤엣것이 조용히
   *   샌다. 이 줄은 **이 저장소만 읽어 어디서나 같은 글자**라 접을 이유가 없고, 접으면 오히려
   *   숫자가 변해도 화면이 낡은 채 초록이 된다. (설명을 산출물에 `<!-- -->` 로 싣지 않는다 —
   *   개발자 주석은 유호님 화면에 나갈 이유가 없고, 템플릿 리터럴 안이라 백틱도 못 쓴다.) */
  const 시트층클래스 = '실측 시트층';
  let 시트셈 = null;
  const 시트줄 = (() => {
    let r;
    try { r = 시트도달.읽다(ROOT); } catch (e) { return `<b>⚠ 못 쟀다</b><span class="잔글"> — 시트층 도달 장부를 못 읽었다(${esc(String(e.message).slice(0, 80))}). 「빚이 0」이 아니라 「안 재봤다」이다.</span>`; }
    const s = (시트셈 = r.셈);
    /* [v9.245] 「그중」의 과녁을 못박는다 — 이 절이 «도달 0» 바로 뒤에 붙어 있어서, 손 게이트 1종이
     *   **도달 0 넷 중 하나**로 읽혔다(실제로는 `teacher_gold` = 자산층 «도달»이다). 장부가 래칫을
     *   일부러 갈라 세는 이유가 바로 이 둘이 다른 병이기 때문인데(도달0=안 읽는다 / 손=읽는데
     *   저절로 안 돈다) 화면이 그 둘을 도로 뭉치고 있었다. 이름을 대서 되돌아갈 자리를 없앤다. */
    return `수집 <b>${s.전체}종</b> = 제품층 ${s.제품} + 자산층 ${s.자산} + <b>도달 0 이 ${s.도달0}종</b>`
      + (s.손 ? ` <span class="잔글">· 도달 ${s.제품 + s.자산}종 중 ${s.손}종(${s.손목록.map(esc).join('·')})은 «사람이 눌러야만» 돈다 — 도달 0 과 다른 병이다(저쪽은 「안 읽는다」, 이쪽은 「읽는데 저절로 안 돈다」)</span>` : '')
      + (r.위반.length ? ` · <b>장부 위반 ${r.위반.length}건</b>` : '')
      + `<br><span class="잔글">도달 0: ${s.도달0목록.map(esc).join(' · ') || '없다'}`
      + ' — 「읽는 코드가 있다」가 아니라 「읽어서 «다음에 줄 것»이 바뀐다」가 도달이다'
      + '(주간 리포트 꼬리처럼 <b>끝이 사람 화면</b>이면 도달이 아니다) · 실값 정본 = 엔진_셋업확장.js `수집도달_()`</span>';
  })();

  const 제안 = 먼저볼곳(이해).map((c) =>
    `<li><button class="복사 큰" data-말="${esc(지시문(c.주소, c.층, c.열))}">${esc(c.주소)}</button>`
    + `<span class="제안글"><b>${esc(c.층)}</b>의 「${esc(c.열)}」 — ${esc(c.왜)}</span></li>`).join('');

  const html = `<!doctype html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SYNK 이해 대장 — 어디가 비었나 (${ver})</title>
<style>
  :root{color-scheme:light;
    --paper:${킷.paper};--ink:${킷.ink};--navy:${킷.navy};--navy2:${킷.navy2};--navy3:${킷.navy3};
    --cream:${킷.cream};--cream3:${킷.cream3};--slate2:${킷.slate2};
    --coral:${킷.coral};--coral3:${킷.coral3};--wash:${킷.coralWash};--sun:${킷.sun};--emerald:${킷.emerald}}
  *{box-sizing:border-box}
  body{margin:0;padding:clamp(20px,4vw,44px);background:var(--paper);color:var(--ink);
       font-family:"SUIT","Pretendard",system-ui,-apple-system,sans-serif;
       font-size:15px;line-height:1.62;-webkit-font-smoothing:antialiased}
  .판{max-width:1180px;margin:0 auto}
  h1{font-size:clamp(24px,3.4vw,32px);margin:0 0 6px;color:var(--navy);letter-spacing:-.01em}
  .부제{color:var(--slate2);margin:0 0 22px;font-size:13.5px}
  .요약{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:26px}
  .수치{background:var(--cream);border:1px solid var(--cream3);border-radius:10px;
        padding:10px 16px;font-size:13px;color:var(--navy)}
  .수치 b{font-size:19px;display:block;line-height:1.25;letter-spacing:-.01em}
  .수치.경고{background:var(--wash);border-color:var(--coral);color:var(--coral3)}

  .먼저{background:var(--cream);border:1px solid var(--cream3);border-left:6px solid var(--coral);
        border-radius:10px;padding:16px 20px;margin-bottom:30px}
  .먼저 h2{margin:0 0 4px;font-size:15px;color:var(--navy)}
  .먼저 p{margin:0 0 10px;font-size:12.5px;color:var(--slate2)}
  .먼저 ol{margin:0;padding-left:0;list-style:none;display:grid;gap:8px}
  .먼저 li{display:flex;align-items:flex-start;gap:10px;font-size:13.5px}
  .제안글{padding-top:2px}

  h2.절{font-size:19px;margin:34px 0 4px;color:var(--navy);letter-spacing:-.01em}
  .설명{color:var(--slate2);font-size:13px;margin:0 0 16px;max-width:80ch}
  .설명 b{color:var(--navy)}

  .카드들{display:grid;gap:14px}
  .카드{background:#fff;border:1px solid var(--cream3);border-radius:14px;overflow:hidden;
        box-shadow:0 1px 2px rgba(27,27,26,.04)}
  .카드머리{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
            padding:14px 18px;background:var(--cream);border-bottom:1px solid var(--cream3)}
  .카드머리 h3{margin:0;font-size:17px;color:var(--navy);letter-spacing:-.01em}
  .카드머리 p{margin:0;font-size:12.5px;color:var(--slate2);flex:1}
  .도달칩{border-radius:999px;padding:3px 12px;font-size:11.5px;font-weight:700;white-space:nowrap}
  .블록들{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;padding:12px}
  .블록{border-radius:10px;padding:10px 12px;min-height:104px;font-size:12.5px}
  .블록.결론{outline:2px solid var(--navy3);outline-offset:1px}
  .블록머리{display:flex;align-items:center;justify-content:space-between;gap:8px;
            margin-bottom:6px;opacity:.92}
  .열이름{font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:none}
  .블록 ul,td ul{margin:0;padding-left:14px}
  .블록 li,td li{margin:2px 0}
  .빔{font-weight:700;letter-spacing:.05em;padding:12px 0;text-align:center;font-size:13px}

  table{width:100%;border-collapse:separate;border-spacing:6px;table-layout:fixed;margin-top:4px}
  th{font-size:12.5px;font-weight:700;text-align:left;padding:8px 10px;color:var(--navy)}
  thead th{background:var(--cream3);border-radius:8px}
  .행이름{background:var(--cream);border-radius:8px;vertical-align:top;width:16%;font-size:13px}
  td{padding:10px 12px;border-radius:8px;vertical-align:top;font-size:12.5px}
  .칸머리{margin-bottom:6px}

  .복사{font-family:"DM Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
        font-size:11px;font-weight:700;letter-spacing:.02em;
        background:rgba(255,255,255,.82);color:var(--navy);border:1px solid rgba(27,27,26,.14);
        border-radius:6px;padding:2px 8px;cursor:pointer;transition:transform .08s ease,background .12s ease}
  .복사:hover{background:#fff;transform:translateY(-1px)}
  .복사:active{transform:translateY(0)}
  .복사.큰{font-size:12.5px;padding:4px 11px;background:#fff}
  .복사.됨{background:var(--emerald);color:var(--cream);border-color:var(--emerald)}

  .실측{margin-top:12px;padding:12px 16px;background:var(--cream);border-left:6px solid var(--emerald);
        border-radius:8px;font-size:12.5px}
  .잔글{color:var(--slate2);font-size:11.5px}
  .사유{margin:6px 0 0;padding:8px 16px;background:var(--paper);border:1px solid var(--cream3);
        border-radius:8px;font-size:12px;color:var(--slate2)}
  .사유 summary{cursor:pointer;color:var(--navy);font-weight:700}
  .사유 ul{margin:8px 0 2px;padding-left:20px}
  .사유 li{margin:0 0 6px;line-height:1.55}
  .사유 code{background:var(--cream);border-radius:4px;padding:1px 6px;color:var(--navy)}
  .범례{margin-top:36px;padding-top:16px;border-top:1px solid var(--cream3);color:var(--slate2);font-size:12px}
  .칩{display:inline-block;border-radius:999px;padding:2px 12px;margin:0 8px 6px 0;font-weight:700;font-size:11.5px}
  footer{margin-top:24px;color:var(--slate2);font-size:11.5px;line-height:1.7}
  @media print{.복사{display:none}.카드{break-inside:avoid}}
</style>
<div class="판 룸">
<h1>이해 대장</h1>
<p class="부제">SYNK 철학 정본 ${ver} · 부록 A 에서 자동으로 그린다 — <b>이 화면은 손으로 고치지 않는다.</b> 고칠 것이 있으면 아래 코드를 눌러 복사해 말하면 된다.</p>

<div class="요약">
  <div class="수치${빈칸 ? ' 경고' : ''}"><b>${빈칸} / ${칸전체.length}</b>칸이 비었다</div>
  <div class="수치${닿는층 < 층수 ? ' 경고' : ''}"><b>${닿는층} / ${층수}</b>층만 엔진에 닿는다</div>
  <div class="수치"><b>${층수}</b>개 이해 층</div>
  ${점수
    ? `<div class="수치"><b>${점수.현재.전체} / ${점수.현재.분모}</b>엔진 점수 · ${esc(점수.현재.판)} (${esc(점수.현재.날짜)})${점수.변화 === null ? ' · 같은 판 첫 회차' : ` · 같은 판 대비 ${점수.변화 > 0 ? '▲' : 점수.변화 < 0 ? '▼' : '='}${Math.abs(점수.변화)}`}</div>`
    : '<div class="수치 경고"><b>?</b>엔진 점수 — 아직 안 쟀다</div>'}
</div>

<div class="먼저">
  <h2>🔎 먼저 볼 곳</h2>
  <p>코드를 누르면 <b>검토 지시문이 통째로 복사된다</b> — 그대로 붙여 넣으면 그 칸만 정본에 비추어 다시 본다.</p>
  <ol>${제안 || '<li>지금 급한 칸이 없다 — 전부 채워졌다.</li>'}</ol>
</div>

<h2 class="절">A-1. 이해 대장 — 그 학생을 얼마나 알게 됐나</h2>
<p class="설명">㉠은 어느 학원이든 오답노트로 흉내 낸다. <b>㉡이 우리만 가질 수 있는 자리</b>이고, 새 기능은 여기서 가장 비어 있는 칸부터 채운다.<br>
🔗 <b>테두리 쳐진 마지막 블록이 이 표의 결론이다</b> — 모으는 것만으로는 아무것도 안 자란다. <b>「돈다」가 초록인데 그 블록이 빨간 층이 가장 위험하다</b>(다 된 것처럼 보이는 미완성). 도달의 정의는 <b>「읽힌 것」</b>이지 「보이는 것」이 아니다.</p>
<div class="카드들">${카드들(이해)}</div>
<div class="실측">📏 엔진 도달 실측 <span class="잔글">(앱 사건 층)</span> — ${도달줄}
<p>🔴 ${빨강줄}</p>
${빨강사유}</div>
<div class="${시트층클래스}">🗂 시트층 도달 실측 <span class="잔글">(오늘 실제로 쌓이는 곳 — 위 래칫이 원리상 못 보는 층)</span> — ${시트줄}</div>

<h2 class="절">A-2. 실물 대장 — 무엇을 만들었나 <span style="font-weight:400;color:${킷.slate2};font-size:14px">(왼쪽 띠 = 조직 층)</span></h2>
<p class="설명">시제는 이 표가 정한다 — <b>「이미 돌아간다」 칸에 없는 것을 현재형으로 쓰지 않는다</b>(정본 §0).</p>
${실물표(실물)}

<div class="범례">
  <span class="칩" style="background:${킷.emerald};color:${킷.cream}">돈다 · 닿는다</span>
  <span class="칩" style="background:${킷.sun};color:${킷.ink}">짓고 있다</span>
  <span class="칩" style="background:${킷.slate2};color:${킷.cream}">개원과 함께</span>
  <span class="칩" style="background:${킷.coral};color:${킷.navy2}">아직 없다 · 끊겼다</span>
  <span class="칩" style="background:transparent;color:${킷.coral3};border:2px dashed ${킷.coral3}">비었다</span>
  <div style="margin-top:10px">색은 브랜드 킷 23색에서만 뽑는다(유호님 확정) · KC Sun 은 면으로만 쓰고 글자로 쓰지 않는다.</div>
</div>
${함께볼것구역()}
<footer>
  생성: <code>node tools/이해대장.js</code> — 정본이 바뀌면 다시 돌린다(사본을 두지 않는다).<br>
  검토를 부르는 말: <b>「㉡2 다시 검토해줘」</b> 처럼 코드만 말해도 된다 — 그 칸만 철학 정본에 비추어 다시 본다.
</footer>
</div>
<script>
document.addEventListener('click', function (e) {
  var b = e.target.closest('.복사');
  if (!b) return;
  var 말 = b.getAttribute('data-말');
  var 끝 = function () {
    var 옛 = b.textContent; b.classList.add('됨'); b.textContent = '복사됨';
    setTimeout(function () { b.classList.remove('됨'); b.textContent = 옛; }, 1100);
  };
  // file:// 에서는 clipboard API 가 막히는 브라우저가 있다 — 폴백을 «조용히» 두지 않고 둘 다 시도한다.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(말).then(끝, function () { 폴백(말, 끝); });
  } else { 폴백(말, 끝); }
});
function 폴백(말, 끝) {
  var t = document.createElement('textarea');
  t.value = 말; t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); 끝(); } catch (_) { window.prompt('아래를 복사하세요', 말); }
  document.body.removeChild(t);
}
</script>
</html>`;

  /* ── `--검사` — 쓰지 않고 «갈라졌나»만 답한다 (유호 지시 08-14 「정본 고칠 때 자동으로」) ──
   * 왜 여기인가: 화면은 정본의 파생이라 정본만 커밋되면 **커밋된 화면이 낡는다.** 그 적색은 낸
   *   사람이 아니라 그 뒤 커밋하는 모든 세션의 배포를 막는다(`/deploy` 2단계 게이트) — 08-14
   *   하루에만 회수 커밋이 넷이다. 사후 회귀는 탐지지 예방이 아니라, 커밋 전으로 앞당긴다.
   * 🔑 판정은 여기 하나가 진다 — 훅도 회귀도 이 모드를 부른다(같은 판정을 두 곳에 적으면 갈라지고,
   *   갈라지는 방향은 언제나 「통과」다).
   * ⚠ **형제 저장소가 없으면 「갈라졌다」가 아니라 「못 쟀다」다**(F296·F207). 그 기계에서 그린 판은
   *   실측 칸이 빠져 커밋된 판과 늘 다르므로, 막으면 그 세션은 정본을 한 글자도 못 고친다(F103).
   *   회귀 `tests/이해대장.test.js` 가 이미 같은 축을 못박고 있다(열화판을 커밋에 싣지 않는다). */
  if (process.argv.includes('--검사')) {
    if (!실측) {
      console.error('[이해대장] 형제 저장소를 못 읽어 동기 대조를 **못 했다** — 막지 않는다.');
      return 0;
    }
    /* 🔑 줄끝은 판정 대상이 아니다 — 이 저장소는 `core.autocrlf=true` 이고 이 경로엔 `.gitattributes`
     *   지정이 없어 **체크아웃이 CRLF 로 내려준다.** 바이트 대조를 그대로 쓰면 새 클론·`git checkout`
     *   직후의 첫 검사가 «내용이 같은데» 「안 따라온다」로 막고, 그 적색은 `/deploy` 2단계 게이트라
     *   곧 **모든 세션의 배포 정지**다 — 08-14 실측: 같은 내용 LF 통과 · CRLF 차단(exit 1).
     *   막으려던 사고를 장치 자신이 내는 자리라 여기서 접는다(CLAUDE.md 가드 맹점 ④).
     * ⚠ 대가: 줄끝«만» 다른 판을 「같다」로 읽는다 — 이 화면은 브라우저가 여는 HTML 이라 줄끝을
     *   요구하는 소비자가 없다. 내용 차이는 그대로 잡힌다(회귀 `tests/대장동봉.test.js` 가 양쪽을 못박는다). */
    const 줄끝접기 = (s) => s.replace(/\r\n/g, '\n');
    const 지금 = fs.existsSync(산출경로) ? 줄끝접기(fs.readFileSync(산출경로, 'utf8')) : null;
    /* Loom CSS 주입(loom태우기)은 정상 쓰기 경로(아래 681행)에서만 걸리므로, 디스크의 완성본과
     * 비교하려면 여기서도 같은 처리를 거쳐야 한다 — 안 그러면 매 정상 갱신이 「안 따라왔다」로 오판된다. */
    if (지금 === 줄끝접기(loom태우기(html))) {
      console.log(`[이해대장] 커밋될 화면이 정본 ${ver} 와 같다 — 통과.`);
      return 0;
    }
    /* 🔑 [F520] «무엇이 방아쇠였나»는 게이트가 안다(발동 조건은 그쪽 몫) — 처방 문장은 여기 한 곳에서만
     *   찍고 **경로만** 받아 끼운다. 화면의 부모는 둘(정본·생성기)이라, 생성기 커밋에 대고
     *   「정본을 담아라」고 시키면 그대로 따를 때 생성기가 그 커밋에서 빠져 트랙이 두 커밋으로
     *   갈린다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103 · F302).
     * ⚠ 이음매가 안 오는 자리(회귀가 판정층만 직접 부를 때)는 옛 기본값 그대로 정본이다. */
    const 방아쇠 = (process.env.SYNK_대장_방아쇠 || 'docs/SYNK_철학.md').split('\n').filter(Boolean);
    console.error(`[이해대장] 차단 — 이 커밋이 화면의 부모(${방아쇠.join(' · ')})를 고치는데 화면(\`docs/이해대장.html\`)이 ${지금 === null ? '**없다**' : '**안 따라온다**'}.`);
    console.error('');
    console.error('  이대로 커밋하면 `tests/이해대장.test.js` 가 **HEAD 에서** 빨개진다. 그 적색은 고친 사람이 아니라');
    console.error('  그 뒤 커밋하는 **모든 세션의 배포**를 막는다 — 08-14 하루에만 회수 커밋이 넷이었다.');
    console.error('');
    console.error('  → 다시 그려 **같은 커밋에** 담는다:');
    console.error('     node tools/이해대장.js  &&  git add -- docs/이해대장.html');
    console.error(`     git commit -m "…" -- ${방아쇠.join(' ')} docs/이해대장.html   (경로에 전부 넣는다)`);
    console.error('  ⚠ 작업본은 이미 맞을 수 있다 — 재는 것은 **커밋될 내용**이다(F302).');
    return 1;
  }

  fs.writeFileSync(산출경로, loom태우기(html), 'utf8');
  console.log(`[이해대장] ${path.relative(ROOT, 산출경로)} — 정본 ${ver} · 이해 ${칸전체.length}칸 중 ${빈칸}칸이 비었다`
    + ` · 엔진에 닿는 층 ${닿는층}/${층수}`
    + (실측
      ? ` · 도달 0인 사건 ${실측.도달0}종(${실측.성격 === null ? '성격 못 읽음'
        : `사유 적힌 것 ${실측.성격.filter((s) => s.사유).length} · 손댈 것 ${실측.성격.filter((s) => !s.사유).length}`}`
        + ` · 생산자만 선 것 ${실측.생산자만}종`
        + ` · 행동 안 바뀌는 부품 ${실측.행동안바뀜 === null ? '못 읽음' : `${실측.행동안바뀜}개`})`
      /* 빨강 갈래는 **분모와 함께** 낸다 — 「빨강 5」만 서면 오늘 일감이 다섯인 것처럼 읽힌다(F513). */
      + (빨강 === null ? ' · 빨강 갈래 못 읽음'
        : ` · 빨간 칸 ${빨강.칸들.length} = ${빨강.갈래.map((g) => `${g} ${빨강.셈[g]}`).join(' + ')}`
          + (빨강.미분류.length ? ` + 미분류 ${빨강.미분류.length}` : ''))
      : ' · 도달 실측 못 함(형제 저장소 없음)')
    /* 시트층은 이 저장소 안에 살아서 워크트리·CI 에서도 늘 잰다 — 위 앱층과 달리 「못 읽음」이 드물다. */
    + (시트셈 ? ` · 시트층 수집 ${시트셈.전체}종 = 제품 ${시트셈.제품}+자산 ${시트셈.자산}+도달0 ${시트셈.도달0}` : ' · 시트층 도달 못 쟀다')
    + (점수 ? ` · 엔진 점수 ${점수.현재.전체}/${점수.현재.분모}(${점수.현재.판} · 회차 ${점수.회차수})` : ' · 엔진 점수 아직 안 쟀다'));

  if (바로가기) {
    const { execFileSync } = require('node:child_process');
    /* 운영자료 폴더 통로는 하나뿐이다(유호 상시 08-09) — 손 경로 금지.
     * 갈래 = **코어**(유호 지시 2026-08-17 재편에서 이해 대장을 「SYNK 코어」의 예시로 직접 들었다).
     * ⚠ 옛 `--링크` 는 운영자료가 모르는 플래그였다 — 조용히 무시되고 기본 갈래로 떨어졌다. */
    execFileSync(process.execPath,
      [path.join(ROOT, 'tools', '운영자료.js'), 산출경로, '--갈래', '방향'], { stdio: 'inherit' });
  }
}

if (require.main === module) process.exit(main() || 0);
module.exports = { 표뽑기, 비었나, 평문, 도달색, 도달판정, 도달실측, 빨간칸, 형제경로들, 엔진점수, 층기호, 지시문, 먼저볼곳, 킷 };
