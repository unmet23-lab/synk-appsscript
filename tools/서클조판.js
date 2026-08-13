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
    'CIRCLE_QUESTION_CARDS, CIRCLE_TONE_ORDER, CIRCLE_TAG_SAY, CIRCLE_FRAMES };')();
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
      return {
        칸: i === 0 ? '머리' : '학생' + i,
        칸높이mm: +(z.getBoundingClientRect().height * mm).toFixed(1),
        내용높이mm: +(내용 * mm).toFixed(1),
        여백mm: +((담기는높이 - 내용) * mm).toFixed(1),
        넘침: 내용 > 담기는높이 + 0.5,
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

function 실측(html) {
  const chrome = findChrome();
  if (!chrome) throw new Error('크롬을 못 찾았다 — CHROME_PATH 로 지정하라(실측 없이 「통과」라고 쓰지 않는다)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-서클-'));
  const tmp = path.join(dir, 'page.html');
  try {
    fs.writeFileSync(tmp, html.replace('</body>', '<script>' + 측정기 + '</script></body>'), 'utf8');
    // ⚠ 한글 경로 → encodeURI. 안 하면 빈 문서가 뜨고 「넘침 0건」으로 통과한다(브랜드렌더린트가 밟은 함정).
    const url = 'file:///' + encodeURI(tmp.replace(/\\/g, '/'));
    const out = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/<pre id="SYNK_CIRCLE_OUT">([\s\S]*?)<\/pre>/);
    if (!m) throw new Error('측정기가 결과를 못 냈다 — 로드 실패이거나 페이지 스크립트 오류');
    const r = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    if (r.오류) throw new Error('측정기 예외: ' + r.오류);
    if (!r.잰것 || !r.잰것.length) throw new Error('칸을 하나도 못 쟀다 — 로드 실패를 통과로 읽을 뻔했다');
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
  const 값 = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const M = 서클모듈();
  const 차시 = Number(값('--차시', '12')) || 12;
  const sheet = argv.includes('--최악') ? 최악픽스처(M, 차시) : M.circleSheetFixture_(차시);

  if (argv.includes('--넘침시험')) {   // 측정기가 «눈이 멀지 않았나» — 일부러 넘치게 만들어 잡히는지 본다
    const s = 최악픽스처(M, 차시);
    // 학생 줄«만»으로 칸을 확실히 넘긴다 — 애매하게 걸치면 「측정기가 눈멀었나」와
    // 「픽스처가 안 넘쳤나」가 같은 빨강으로 나와 아무것도 못 가른다.
    s.groups[0].members.forEach(m => { m.kept = { text: new Array(80).join('아주 긴 문장이 이어집니다 ') }; });
    const r = 실측(M.circleSheetHtml_(s));
    const 학생칸 = r.잰것.slice(1);
    const 잡힘 = 학생칸.filter(z => z.학생줄넘침).length;
    console.log(`[넘침시험] 학생 줄만으로 칸을 넘치게 한 칸 ${학생칸.length}개 중 ${잡힘}개를 잡았다`);
    console.log(잡힘 === 학생칸.length
      ? '  ✅ 측정기가 «학생 줄 잘림»을 본다 — 위 「들어감」·「틀만잘림」 판정을 믿어도 된다.'
      : '  🔴 측정기가 눈이 멀었다 — 학생 문장이 잘려도 그 판정이 안 뜬다. 조판 판정을 쓰지 마라.');
    process.exitCode = (잡힘 === 학생칸.length) ? 0 : 1;
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
  console.log('  ▶ 실측은 브라우저가 한다 — 이 파일을 열어 각 .z 의 scrollHeight 와 clientHeight 를 대조하라.');
  console.log('     (scrollHeight > clientHeight 인 칸 = 8줄이 안 들어간 칸)');
}

if (require.main === module) main();
module.exports = { 서클모듈 };
