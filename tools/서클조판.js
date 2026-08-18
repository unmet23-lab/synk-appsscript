#!/usr/bin/env node
/* 서클조판 — 숙제 서클 인쇄물 A4 1장을 **라이브와 같은 함수로** 구워 낸다.
 *
 * 왜 필요한가: 설계 §10-2 의 인수 조건이 「실물 조판 1장 뽑아 칸 배분 실측」이다.
 *   눈으로 「들어갈 것 같다」는 실측이 아니다 — 59.4mm 칸에 8줄이 실제로 들어가는지는
 *   브라우저가 재야 답이 나온다. 그래서 이 도구는 HTML 을 굽기만 하고 판정은 안 한다(재료만 낸다).
 *
 * 🔑 함수를 **베끼지 않는다** — 엔진 소스에서 서클 절을 그대로 떼어 평가한다.
 *   베끼면 그 순간 두 벌이 되고, 종이와 라이브가 갈라져도 아무 데도 안 빨개진다
 *   (groupBoardRender_ 가 세운 규약과 같은 이유 · 08-01 실측).
 *
 * 쓰는 법:
 *   node tools/서클조판.js                 → 스크래치패드에 1장(12차시 픽스처)
 *   node tools/서클조판.js --차시 7        → 차시 바꿔서(질문 카드가 돈다)
 *   node tools/서클조판.js --out <경로>    → 저장 위치 지정
 *   node tools/서클조판.js --json          → 조판 대신 circle_sheet 페이로드를 찍는다
 *   node tools/서클조판.js --실측          → 헤드리스 크롬으로 칸 넘침을 «잰다»(§10-2 인수 조건)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { findChrome } = require('./브랜드렌더린트.js');   // 크롬 찾기는 한 벌만 산다(두 곳에 적으면 갈라진다)
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const ROOT = path.resolve(__dirname, '..');

/** 소스에서 [시작표식, 끝표식) 구간을 떼어 낸다 — 못 찾으면 조용히 빈 문자열을 내지 않고 죽는다.
 *  (표식이 밀렸는데 빈 구간을 돌려주면 「기능이 사라진 조판」이 초록으로 나온다) */
function 구간(src, 시작, 끝, 이름) {
  const s = src.indexOf(시작);
  if (s < 0) throw new Error(`표식을 못 찾았다: ${이름} 시작 「${시작.slice(0, 40)}…」`);
  const e = 끝 ? src.indexOf(끝, s + 1) : -1;
  if (끝 && e < 0) throw new Error(`표식을 못 찾았다: ${이름} 끝 「${끝.slice(0, 40)}…」`);
  return src.slice(s, 끝 ? e : undefined);
}

function 서클모듈() {
  const 셋업 = fs.readFileSync(path.join(ROOT, '엔진_셋업확장.js'), 'utf8');
  const 코드 = fs.readFileSync(path.join(ROOT, 'Code.js'), 'utf8');
  const 콘텐츠 = fs.readFileSync(path.join(ROOT, 'contents_서클.js'), 'utf8');
  // 서체 정본은 Code.js 에 있다 — 여기서 베끼면 종이만 옛 서체로 남는다(브랜드 폰트 정본 §9)
  const 서체 = 구간(코드, 'const CARD_FONT = ', '\n', 'CARD_FONT') +
    '\n' + 구간(코드, 'const CARD_WEBFONT = ', "'</style>';", 'CARD_WEBFONT') + "'</style>';";
  const 상수 = 구간(셋업, 'const GROUP_COUNT = 4;', 'const ROLE_ICONS', '조 상수');
  const 역할 = 구간(셋업, 'function roleOfSeat_(', 'function roleIconOf_(', 'roleOfSeat_');
  const 서클 = 구간(셋업, '/* ═════════════ 🟨 숙제 서클', '/* ═════════════ [v9.86·D]', '서클 절');
  // Apps Script 전역 중 조판 경로가 실제로 쓰는 것만 최소로 세운다(시트·Drive·메일은 안 탄다).
  const shim = `const Logger = { log: () => {} };
    const HtmlService = { createHtmlOutput: (h) => ({ setTitle: () => h }) };`;
  return new Function(`${shim}\n${서체}\n${콘텐츠}\n${상수}\n${역할}\n${서클}\n` +
    'return { circleSheetFixture_, circleSheetHtml_, circleWarmupOf_, circleMemberCard_, ' +
    'circleKeptPick_, circleShakyPick_, circleTrendOf_, circleTagSay_, circleBandOf_, ' +
    'circleKeepMm_, circleZoneHeights_, circleLineCount_, circleTightOf_, circleFitCard_, ' +
    'CIRCLE_QUESTION_CARDS, CIRCLE_TONE_ORDER, CIRCLE_TAG_SAY, CIRCLE_FRAMES, ' +
    'CIRCLE_START_LINES, CIRCLE_FIT, CIRCLE_LABELS };')();
}

/* 페이지 «안»에서 도는 측정기 — 문자열로 주입한다. 저장소의 어떤 것도 참조할 수 없다.
 * 재는 것: 칸의 실제 높이 / 내용의 실제 바닥 / 남는 여백 / 넘쳤는가 / 몇 줄이 그려졌는가.
 *
 * 🔴 `scrollHeight` 로 재지 않는다 — 08-13 실측에서 그 층이 값을 깨뜨렸다:
 *    scrollHeight 는 clientHeight 아래로 안 내려가서, 「딱 맞다」와 「한참 남는다」가
 *    **같은 숫자**로 나왔다(전 칸 「여백 0mm」). 넘친 칸조차 그 바닥에 붙어 안 보였다.
 *    그래서 마지막 블록의 **실제 바닥**을 칸 상단 기준으로 재고, 아래 padding 을 더한다 —
 *    이건 내용이 짧으면 작아지고 넘치면 칸을 넘어서는, 방향이 있는 값이다. */
const 측정기 = `(() => {
  try {
    const mm = 25.4 / 96;
    const zs = Array.prototype.slice.call(document.querySelectorAll('.z'));
    const 잰것 = zs.map(function (z, i) {
      const 블록 = Array.prototype.slice.call(z.querySelectorAll('p, .qcard, .blank'));
      const zcs = getComputedStyle(z);
      const padB = parseFloat(zcs.paddingBottom) || 0;
      const borderB = parseFloat(zcs.borderBottomWidth) || 0;
      const top = z.getBoundingClientRect().top;
      let 바닥 = parseFloat(zcs.paddingTop) || 0, 줄 = 0;
      블록.forEach(function (b) {
        const r = b.getBoundingClientRect();
        if (r.bottom - top > 바닥) 바닥 = r.bottom - top;
        const cs = getComputedStyle(b);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        줄 += Math.max(1, Math.round(r.height / lh));
      });
      const 담기는높이 = z.getBoundingClientRect().height - borderB;
      const 내용 = 바닥 + padB;
      // 잘림의 순서를 따로 잰다 — 학생 줄(.keep)이 잘리는 것과 강사 틀(.frames)이 잘리는 것은
      // 같은 「넘침」이 아니다. 앞은 규약 위반이고, 뒤는 설계가 허용한 degradation 이다.
      const keep = z.querySelector('.keep'), fr = z.querySelector('.frames');
      const 안쪽바닥 = z.getBoundingClientRect().top + 담기는높이 - padB;
      // 머리 칸은 **쪽마다** 하나씩 있다 — 문서 첫 칸 하나만 머리로 치면(옛 i===0) 조가 둘 이상인
      // 시트에서 둘째 쪽 머리가 학생 칸으로 섞여 카드 수와 어긋난다(검수 P2 6f1bcc3f).
      const 머리 = !!z.parentElement && z.parentElement.querySelector('.z') === z;
      return {
        칸: 머리 ? '머리' : '학생' + i, 머리: 머리,
        칸높이mm: +(z.getBoundingClientRect().height * mm).toFixed(1),
        내용높이mm: +(내용 * mm).toFixed(1),
        여백mm: +((담기는높이 - 내용) * mm).toFixed(1),
        넘침: 내용 > 담기는높이 + 0.5,
        // 엔진의 «굽기 전» 예측(circleKeepMm_)이 실물과 어긋나는지 대조하는 축
        keep높이mm: keep ? +(keep.getBoundingClientRect().height * mm).toFixed(2) : 0,
        담기는높이mm: +((담기는높이 - (parseFloat(zcs.paddingTop) || 0) - padB) * mm).toFixed(2),
        학생줄넘침: !!keep && keep.getBoundingClientRect().bottom > 안쪽바닥 + 0.5,
        틀잘림: !!fr && fr.scrollHeight > fr.clientHeight + 1,
        블록: 블록.length,
        줄: 줄
      };
    });
    const pg = document.querySelector('.pg');
    const out = {
      쪽수: document.querySelectorAll('.pg').length,
      쪽높이mm: pg ? +(pg.getBoundingClientRect().height * mm).toFixed(1) : 0,
      잰것: 잰것
    };
    document.body.insertAdjacentHTML('beforeend', '<pre id="SYNK_' + 'CIRCLE_OUT">' + JSON.stringify(out) + '</pre>');
  } catch (e) {
    document.body.insertAdjacentHTML('beforeend', '<pre id="SYNK_' + 'CIRCLE_OUT">' + JSON.stringify({ 오류: String(e) }) + '</pre>');
  }
})();`;

/* 자수 측정기 — 엔진이 «굽기 전에» 칸을 재려면 자수·줄높이가 필요한데, Apps Script 안엔 브라우저가
 * 없다. 그 숫자를 코드에 지어 박으면 그게 곧 F045 가 말한 「안 재고 자료로 대신했다」다.
 * 그래서 여기서 **실물 CSS 아래서** 재고, 엔진 상수(CIRCLE_FIT)가 그 값과 어긋나면 회귀가 빨개진다.
 * 탐침은 실제 `.keep` 안에 넣는다 — 폭을 상수로 적는 순간 그 폭이 또 하나의 지어낸 값이 된다. */
const 자수측정기 = `(() => {
  try {
    const mm = 25.4 / 96;
    const z = document.querySelectorAll('.z')[1];        // 첫 학생 칸
    const keep = z.querySelector('.keep');
    const zcs = getComputedStyle(z);
    const 칸여백 = (parseFloat(zcs.paddingTop) || 0) + (parseFloat(zcs.paddingBottom) || 0) +
      (parseFloat(zcs.borderBottomWidth) || 0);
    const nm = z.querySelector('.nm');
    const nm원문 = nm.innerHTML;
    const nm한줄 = nm.getBoundingClientRect().height;
    const nm아래 = parseFloat(getComputedStyle(nm).marginBottom) || 0;   // 이름줄도 여백은 «한 번»이다(P2 f9a9f133)
    const p = document.createElement('p');
    p.className = 'ln';
    p.textContent = '가';
    keep.appendChild(p);
    const 아래 = parseFloat(getComputedStyle(p).marginBottom) || 0;
    const 한줄 = p.getBoundingClientRect().height;
    // 두 줄이 되는 문턱을 이분 탐색으로 — 「몇 자까지 한 줄인가」가 곧 자수다
    const 문턱 = function (만들기) {
      let lo = 1, hi = 400;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        p.innerHTML = 만들기(mid);
        if (p.getBoundingClientRect().height <= 한줄 + 1) lo = mid; else hi = mid - 1;
      }
      return lo;
    };
    const 글 = function (n) { return new Array(n + 1).join('가'); };
    const 자수 = 문턱(function (n) { return 글(n); });
    const 굵은자수 = 문턱(function (n) { return '<span class="lb">' + 글(n) + '</span>'; });
    // 공백·라틴은 한글보다 좁다 — 전부 한글 폭으로 세면 실제 문장을 통째로 과대예측하고,
    // 그 과대예측은 「안 들어간다」는 **거짓 경고**가 되어 진짜 경고까지 같이 죽인다.
    const 폭 = function (s) {
      const sp = document.createElement('span');
      sp.style.whiteSpace = 'pre';
      sp.textContent = s;
      p.innerHTML = '';
      p.appendChild(sp);
      const w = sp.getBoundingClientRect().width;
      p.innerHTML = '';
      return w;
    };
    const 한글폭 = 폭(글(20)) / 20;
    const 공백비 = +((폭('가 가 가 가 가') - 한글폭 * 5) / 4 / 한글폭).toFixed(3);
    // 라틴은 «가장 넓은 글리프»로 잰다 — 소문자 평균으로 재면 대문자 W 가 섞인 날 좁게 세고,
    // 좁게 센 예측은 곧 조용한 잘림이다. 안전은 언제나 과대예측 쪽이다(검수 P2 27ac35ca).
    const 라틴비 = +(Math.max(폭('abcdefghijklmnopqrst') / 20, 폭('WWWWWWWWWWWWWWWWWWWW') / 20) / 한글폭).toFixed(3);
    // 키릴은 몽골 학생 이름의 기본 문자다 — 라틴 비율로 갈음하지 말고 «잰다»
    const 키릴비 = +(폭('абвгдеёжзийклмнопрст') / 20 / 한글폭).toFixed(3);
    // 이름줄도 «잰다» — 고정 상수로 두면 긴 몽골 이름이 두 줄로 접히는 날 예측이 실물보다 낮아지고,
    // 낮게 본 예측은 곧 조용한 잘림이다(검수 P3 e2c3037f).
    const nm문턱 = function (만들기) {
      let lo = 1, hi = 200;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        nm.innerHTML = 만들기(mid);
        if (nm.getBoundingClientRect().height <= nm한줄 + 1) lo = mid; else hi = mid - 1;
      }
      return lo;
    };
    const 이름자수 = nm문턱(function (n) { return 글(n); });
    const 역할자수 = nm문턱(function (n) { return '가<span>' + 글(n) + '</span>'; }) - 1;
    nm.innerHTML = nm원문;
    p.innerHTML = '가<span class="ck"></span>';          // 「오늘 볼 것」 줄은 동그라미 때문에 더 높다
    const 체크줄 = p.getBoundingClientRect().height + 아래;
    // 동그라미는 «폭»도 먹는다 — 높이만 세면 그 줄이 한 줄 더 접히는 날을 못 본다(검수 P2 cee4b75f)
    const ck = p.querySelector('.ck');
    const 체크비 = +((ck.getBoundingClientRect().width +
      (parseFloat(getComputedStyle(ck).marginLeft) || 0)) / 한글폭).toFixed(3);
    p.parentNode.removeChild(p);
    const out = {
      자수: 자수, 굵은자수: 굵은자수, 공백비: 공백비, 라틴비: 라틴비, 키릴비: 키릴비,
      이름자수: 이름자수, 역할자수: 역할자수,
      // 문단 여백은 «문단마다 한 번»이다 — 접힌 줄마다 곱하면 긴 카드를 과대예측해
      // 실제로는 들어가는 줄까지 걷어낸다(검수 P2 382f53fa). 그래서 줄과 여백을 따로 낸다.
      줄mm: +(한줄 * mm).toFixed(2), 여백mm: +(아래 * mm).toFixed(2),
      체크줄mm: +((체크줄 - 아래) * mm).toFixed(2), 체크비: 체크비,
      이름줄mm: +(nm한줄 * mm).toFixed(2), 이름여백mm: +(nm아래 * mm).toFixed(2),
      칸여백mm: +(칸여백 * mm).toFixed(2)
    };
    document.body.insertAdjacentHTML('beforeend', '<pre id="SYNK_' + 'CIRCLE_OUT">' + JSON.stringify(out) + '</pre>');
  } catch (e) {
    document.body.insertAdjacentHTML('beforeend', '<pre id="SYNK_' + 'CIRCLE_OUT">' + JSON.stringify({ 오류: String(e) }) + '</pre>');
  }
})();`;

/** 엔진의 `CIRCLE_FIT` 을 실물 CSS 아래서 다시 잰다 — 회귀가 부르는 통로(크롬 없으면 throw). */
function 자수실측() {
  const M = 서클모듈();
  return 실측(M.circleSheetHtml_(M.circleSheetFixture_(12)), 자수측정기);
}

/** 엔진의 «굽기 전 예측»(circleKeepMm_)이 실물과 얼마나 어긋나는가 — 모델이 실물보다
 *  작게 나오면 그건 곧 조용한 잘림이 돌아온 것이다. 회귀가 부르는 통로. */
function 적합실측(M, sheet) {
  const r = 실측(M.circleSheetHtml_(sheet));
  const 칸 = r.잰것.filter(z => !z.머리);            // 머리 칸은 쪽마다 하나씩 있다(slice(1) 로는 첫 쪽만 빠진다)
  // 조가 여럿인 sheet 도 «전부» 편다 — groups[0] 만 보면 칸 수가 어긋나거나 첫 조와 잘못 짝지어진다(P3 cdf07b2e)
  const 카드 = (sheet.groups || []).reduce((a, g) => a.concat(g.members), []);
  // 학생 칸을 하나도 못 쟀는데 «빈 비교»가 성공으로 끝나는 자리를 막는다 — Math.min([]) 은 Infinity 라
  // 「가장 빠듯한 여유 Infinity」가 초록으로 나온다(검수 P2 21aad152 · 거짓초록).
  // 둘 다 0 이면 「같다」로 통과해 Math.min([])=Infinity 가 «가장 빠듯한 여유»로 찍힌다(검수 P1 d8d1f6c5)
  if (!카드.length) throw new Error('견줄 카드가 0장이다 — 빈 비교를 안전한 결과처럼 낼 뻔했다');
  if (칸.length !== 카드.length) {
    throw new Error(`학생 칸을 ${칸.length}개 쟀는데 카드는 ${카드.length}개다 — 로드·선택자 실패이거나, ` +
      `조가 둘 이상이라 쪽마다 머리 칸이 하나씩 더 있는 것이다(둘 다 «짝을 잘못 맞춘 비교»보다 낫다)`);
  }
  // 렌더러가 실제로 그린 카드와 견준다 — 넘쳐서 보조 줄을 걷은 날엔 원본 카드로 견주면
  // 「예측이 실물보다 한참 크다」가 나와 대조가 뜻을 잃는다(걷힌 만큼 실물이 작아진 것뿐이다).
  // 칸 높이는 **조마다** 나뉜다 — 평탄화한 뒤 한 번에 계산하면 4인×2조가 29.7mm 로 모델링돼
  // 멀쩡한 시트에서 거짓 실패가 난다(검수 P2 f11ea221). 조별로 계산해 DOM 순서로 잇는다.
  const 담기는 = (sheet.groups || []).reduce((a, g) =>
    a.concat(M.circleZoneHeights_(g.members).map(h => h - M.CIRCLE_FIT.칸여백mm)), []);
  return 칸.map((z, i) => {
    const 그린것 = M.circleFitCard_(카드[i], 담기는[i]).card;
    return {
      이름: 카드[i].display_name,
      예측mm: +M.circleKeepMm_(그린것).toFixed(2),
      실물mm: z.keep높이mm,
      어긋남mm: +(M.circleKeepMm_(그린것) - z.keep높이mm).toFixed(2),
      담기는mm: z.담기는높이mm
    };
  });
}

function 실측(html, script) {
  const chrome = findChrome();
  if (!chrome) throw new Error('크롬을 못 찾았다 — CHROME_PATH 로 지정하라(실측 없이 「통과」라고 쓰지 않는다)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-서클-'));
  const tmp = path.join(dir, 'page.html');
  try {
    fs.writeFileSync(tmp, html.replace('</body>', '<script>' + (script || 측정기) + '</script></body>'), 'utf8');
    // ⚠ 한글 경로 → encodeURI. 안 하면 빈 문서가 뜨고 「넘침 0건」으로 통과한다(브랜드렌더린트가 밟은 함정).
    const url = 'file:///' + encodeURI(tmp.replace(/\\/g, '/'));
    const out = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/<pre id="SYNK_CIRCLE_OUT">([\s\S]*?)<\/pre>/);
    if (!m) throw new Error('측정기가 결과를 못 냈다 — 로드 실패이거나 페이지 스크립트 오류');
    const r = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    if (r.오류) throw new Error('측정기 예외: ' + r.오류);
    // 빈 결과를 통과로 읽지 않는다 — 로드 실패도 「넘침 0건」과 같은 모양으로 나온다.
    // 주입 스크립트가 무엇이든 이 검사는 «그대로» 건다(script 일 때 느슨하게 두면 그 자리가 곧 거짓초록이다).
    if (!Object.keys(r).length) throw new Error('아무것도 못 쟀다 — 로드 실패를 통과로 읽을 뻔했다');
    if ('잰것' in r && !r.잰것.length) throw new Error('칸을 하나도 못 쟀다 — 로드 실패를 통과로 읽을 뻔했다');
    return r;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 정리 실패는 결과를 안 바꾼다 */ }
  }
}

/* 최악 픽스처 — 조판이 «가장 빠듯해지는» 조합. 인수 판정은 평시가 아니라 여기서 난다.
 * 조립 로직은 라이브 함수를 그대로 타고, 다른 것은 **재료뿐**이다(로직 복제 0):
 *   가장 긴 이름 · 가장 긴 제출문 · 가장 긴 태그 표현 · 긴 쪽 이력 문형 · Lv5~6 문장 틀(최장).
 * 이 픽스처는 측정기의 «탐지력»도 겸해 못박는다 — 여기서도 넘침 0 이면 검사가 눈먼 것 아닌지
 * `--넘침시험` 으로 되물어야 한다(가드가 자기 눈을 검사하는 자리). */
function 최악픽스처(M, 차시) {
  const 긴이름 = ['어트건바야르', '엥흐자르갈', '뭉흐토야', '체첵마'];
  /* 제출문은 학생이 쓴 만큼 길다 — 「한 문장」이라는 상한이 hw_feedback 어디에도 없다.
   * A4 폭(본문 194mm)이라 40~50자는 한 줄에 들어가 버리고, 그러면 최악을 안 잰 채 초록이 난다.
   * 그래서 넉넉히 세 줄로 접히는 길이로 잡는다 — 이게 실제로 오는 날의 모양이다. */
  const 긴문장 = '지난 주말에 친구들하고 같이 시내에 있는 큰 서점에 갔는데, 거기에서 한국어 책을 두 권 샀고 ' +
    '집에 와서 저녁까지 읽었어요. 그런데 모르는 낱말이 너무 많아서 사전을 계속 찾아봐야 했고, ' +
    '다음에는 조금 더 쉬운 책부터 시작하는 게 좋겠다고 생각했어요.';
  const 긴태그 = '어휘:유의어혼동';           // 학생 표현이 가장 긴 태그
  const 어제 = '2026-03-10', 지난주 = '2026-03-03';
  return {
    class_id: '평일 A', session_no: 차시, week: Math.ceil(차시 / 5), season: '2026-02-25', focus_group: 1,
    groups: [{
      group_no: 1,
      warmup_question: M.circleWarmupOf_(차시, 2),
      members: 긴이름.map((nm, i) => M.circleMemberCard_(
        { name: nm, role: ['진행', '기록', '발표', '질문'][i] },
        [{ day: 어제, 제출문: 긴문장, 태그: [긴태그], 숙제ID: 'HW' + i, 재작성: false },
         { day: 지난주, 제출문: 긴문장, 태그: [긴태그, 긴태그], 숙제ID: 'HW' + i, 재작성: false }],
        2, 어제))     // 밴드 2 = Lv5~6 = 문장 틀이 가장 길다
    }],
    보고: { 출석확정: true, 레벨미확정: [], 어휘표: true }
  };
}

function main() {
  const argv = process.argv.slice(2);
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다. */
  const 아는플래그 = ['--json', '--out', '--넘침시험', '--실측', '--자수', '--적합', '--차시', '--최악'];
  const 플래그오류 = 인자게이트('서클조판', argv, 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const 값 = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const M = 서클모듈();
  const 차시 = Number(값('--차시', '12')) || 12;
  const sheet = argv.includes('--최악') ? 최악픽스처(M, 차시) : M.circleSheetFixture_(차시);

  if (argv.includes('--넘침시험')) {   // 측정기가 «눈이 멀지 않았나» — 일부러 넘치게 만들어 잡히는지 본다
    const s = 최악픽스처(M, 차시);
    /* 🔴 부풀리기는 **브라우저 안에서** 한다(08-14 수리 · 검수 P1 30e26a7d).
     *   전에는 카드의 kept 를 길게 만들어 `circleSheetHtml_` 에 넣었는데, 그 사이에
     *   `circleFitCard_` 가 생겨 그 긴 줄을 **먼저 걷어 버린다** — DOM 엔 넘치는 줄이 없어
     *   0/4 가 나오고, 그게 「측정기가 눈멀었다」와 똑같은 빨강이 된다(실측 0/4).
     *   이 시험이 묻는 것은 조판 로직이 아니라 «측정기의 눈»이므로, 렌더가 끝난 뒤
     *   DOM 에 직접 긴 줄을 넣고 재는 것이 과녁에 맞다(제품 코드에 시험용 우회 0). */
    const 부풀리기 = `(() => {
      Array.prototype.slice.call(document.querySelectorAll('.z')).forEach(function (z) {
        // 머리 칸은 «쪽마다» 있다 — slice(1) 로 문서 첫 칸만 건너뛰면 둘째 조의 머리를 학생 칸처럼
        // 부풀려 시험이 엉뚱한 것을 잰다(검수 P1 69d2304d · 재는 쪽은 고쳤는데 «넣는 쪽»에 잔재가 남아 있었다).
        if (z.parentElement && z.parentElement.querySelector('.z') === z) return;
        const keep = z.querySelector('.keep');
        if (!keep) return;
        const p = document.createElement('p');
        p.className = 'ln';
        p.textContent = new Array(80).join('아주 긴 문장이 이어집니다 ');
        keep.appendChild(p);
      });
    })();`;
    const r = 실측(M.circleSheetHtml_(s), 부풀리기 + 측정기);
    const 학생칸 = r.잰것.filter(z => !z.머리);
    const 잡힘 = 학생칸.filter(z => z.학생줄넘침).length;
    console.log(`[넘침시험] 학생 줄만으로 칸을 넘치게 한 칸 ${학생칸.length}개 중 ${잡힘}개를 잡았다`);
    console.log(잡힘 === 학생칸.length
      ? '  ✅ 측정기가 «학생 줄 잘림»을 본다 — 위 「들어감」·「틀만잘림」 판정을 믿어도 된다.'
      : '  🔴 측정기가 눈이 멀었다 — 학생 문장이 잘려도 그 판정이 안 뜬다. 조판 판정을 쓰지 마라.');
    process.exitCode = (잡힘 === 학생칸.length) ? 0 : 1;
    return;
  }

  if (argv.includes('--자수')) {     // 엔진 CIRCLE_FIT 의 출처 — 여기서 «재서» 쓴다(지어 박지 않는다)
    const r = 자수실측();
    console.log('[자수 실측] 실물 CSS 아래서 잰 값 — 엔진 `CIRCLE_FIT` 이 이것과 같아야 한다');
    Object.keys(r).forEach(k => console.log(`  ${k.padEnd(8)} ${r[k]}`));
    console.log('\n  ▶ 엔진에 옮길 모양:\n  const CIRCLE_FIT = ' +
      JSON.stringify(r).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ') + ';');
    return;
  }
  if (argv.includes('--적합')) {     // 예측 vs 실물 — 모델이 실물보다 «작으면» 조용한 잘림이 돌아온 것이다
    const 표 = 적합실측(M, sheet);
    console.log(`[적합 실측] ${차시}차시 · ${argv.includes('--최악') ? '최악' : '평시'} 픽스처 — 학생 줄(.keep) 예측 vs 실물`);
    표.forEach(t => console.log(`  ${t.어긋남mm < 0 ? '🔴 낮게봄' : '✅ 안전'} ${String(t.이름).padEnd(7)} ` +
      `예측 ${t.예측mm}mm · 실물 ${t.실물mm}mm · 어긋남 ${t.어긋남mm > 0 ? '+' : ''}${t.어긋남mm}mm · 담기는 칸 ${t.담기는mm}mm`));
    const 낮게 = 표.filter(t => t.어긋남mm < 0);
    console.log(낮게.length
      ? `\n  🔴 판정: ${낮게.length}칸에서 예측이 실물보다 작다 — 이 모델로는 잘림을 못 잡는다.`
      : `\n  ✅ 판정: 전 칸에서 예측 ≥ 실물(가장 빠듯한 여유 ${Math.min.apply(null, 표.map(t => t.어긋남mm))}mm) — 안전한 쪽으로 틀린다.`);
    process.exitCode = 낮게.length ? 1 : 0;
    return;
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(sheet, null, 2));
    return;
  }
  if (argv.includes('--실측')) {
    const r = 실측(M.circleSheetHtml_(sheet));
    console.log(`[서클조판 실측] ${차시}차시 · ${r.쪽수}쪽 · 쪽높이 ${r.쪽높이mm}mm (A4 297mm)`);
    r.잰것.forEach(z => {
      const 표 = z.학생줄넘침 ? '🔴 학생줄잘림' : z.틀잘림 ? '⚠ 틀만잘림' : '✅ 들어감';
      console.log(`  ${표.padEnd(9)} ${z.칸.padEnd(5)} 칸 ${z.칸높이mm}mm ` +
        `· 내용 ${z.내용높이mm}mm · 남는 여백 ${z.여백mm}mm · ${z.블록}블록 ${z.줄}줄`);
    });
    const 규약위반 = r.잰것.filter(z => z.학생줄넘침);
    const 틀잘림 = r.잰것.filter(z => z.틀잘림);
    const 최소여백 = Math.min.apply(null, r.잰것.map(z => z.여백mm));
    if (규약위반.length) {
      console.log(`\n  🔴 판정: ${규약위반.length}칸에서 **학생의 문장이 잘렸다** — §3 「학생 원문 그대로」 위반이고,` +
        `\n     overflow:hidden 이라 종이 위에서는 잘린 줄이 «없는 줄»과 똑같이 보인다.`);
    } else if (틀잘림.length) {
      console.log(`\n  ⚠ 판정: 학생 문장은 전부 살아 있고, ${틀잘림.length}칸에서 **강사 틀**이 잘렸다(설계가 허용한 degradation).`);
    } else {
      console.log(`\n  ✅ 판정: 전 칸이 들어간다(가장 빠듯한 칸의 남는 여백 ${최소여백}mm).`);
    }
    process.exitCode = 규약위반.length ? 1 : 0;
    return;
  }
  const 기본 = path.join(os.tmpdir(), 'synk-서클조판');
  const out = path.resolve(값('--out', path.join(기본, `서클_${차시}차시.html`)));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, M.circleSheetHtml_(sheet), 'utf8');

  const 조 = sheet.groups[0];
  console.log(`[서클조판] ${out}`);
  console.log(`  ${차시}차시 · ${sheet.groups.length}조 · ${조.members.length}명 · ` +
    `질문 결 「${조.warmup_question.tone}」`);
  console.log(`  칸: 머리 1 + 학생 ${조.members.length} = ${1 + 조.members.length}구역 / A4 297mm`);
  // ⚠ 옛 안내는 scrollHeight 대조였다 — 측정기 주석이 바로 그 층을 «값을 깨뜨린다»고 금지했는데
  //   기본 출력만 옛말로 남아 있었다(검수 P3 8e74768f). 안내는 실제로 도는 통로를 가리킨다.
  console.log('  ▶ 실측은 헤드리스 크롬이 한다 — `node tools/서클조판.js --실측`(넘치는 칸을 이름으로 낸다).');
  console.log('     scrollHeight 로 대조하지 마라: clientHeight 아래로 안 내려가서 「딱 맞다」와 「한참 남는다」가 같은 값이 된다.');
}

if (require.main === module) main();
/** 크롬이 이 기계에 있나 — 「없다」와 「있는데 실측이 깨졌다」를 가르는 유일한 축이다.
 *  회귀가 이걸 안 부르고 예외를 통째로 skip 하면, 측정기 회귀가 CI 에서 조용히 사라진다(검수 P2 5c774a0d). */
function 크롬있나() { return !!findChrome(); }

module.exports = { 서클모듈, 자수실측, 적합실측, 최악픽스처, 크롬있나 };
