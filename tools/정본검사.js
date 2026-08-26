#!/usr/bin/env node
/**
 * 정본검사 — 「촌스러움 여덟 병」과 「낡음」을 **세는** 자.
 *
 * 무엇: docs/정본/ 23벌 + docs/발표물/ 파생을 훑어 리라이팅 전후를 숫자로 가른다.
 *       유호 지시 2026-08-26 「모든 문서를 리라이팅 — 너무 예전이고 촌스럽다」의 전수 진단
 *       (서브에이전트 14벌 · 11,962줄 정독)이 찾은 여덟 병을 기계가 다시 셀 수 있게 옮긴 것.
 *
 * 왜 자가 필요한가: 「고쳤다」는 느낌이고 「◆ 183 → 0」은 사실이다. 23벌을 손으로 훑으면
 *   반드시 몇 벌이 빠지고, 빠진 벌은 다음 판에서 옛 서식을 다시 퍼뜨린다.
 *
 * 🔴 이 자가 «원리상 못 보는 것»을 먼저 적는다(guard-blind-to-its-own-claim 계열 예방):
 *   · 문장이 좋아졌는가 — 못 잰다. 여덟 병 중 ④화법·⑤예고·⑥순서는 사람이 읽어야 안다.
 *     여기서 재는 것은 «세면 알 수 있는» 자리뿐이다(①판번호 ②조판 ③자기언급 ⑦조어 ⑧새 자산).
 *   · 사실이 맞는가 — 못 잰다. 낱말이 있나 없나만 본다. 「몽글」이 있어도 틀리게 썼을 수 있다.
 *   · 발표물 조판의 아름다움 — 못 잰다.
 *   · 🔴 «반례»와 «병»은 갈라서 센다(08-26 수리). 「쓰지 마세요」 표가 그 낱말을 안 적으면 규범이
 *     안 선다 — 그런데 첫 판은 그 표를 병으로 셌다. 실측: 집필 규범 9 · 기업마스터 7 이 전부
 *     금칙표거나 「」 안이었고, 그래서 **규범을 가장 잘 지킨 두 벌이 가장 아파 보였다.**
 *     지금 규칙 = 표 줄(`|`)이거나 「그 낱말」이 낫표 안이면 반례로 옮긴다. 코드 스팬(``) 안의
 *     ◆·괘선·구분선도 마찬가지다 — 그건 조판이 아니라 조판의 «인용»이다.
 *   · 🔴 **HTML 은 «독자에게 보이는 글»만 잰다**(08-26 수리 둘째). 첫 판은 .txt 자를 HTML 에 그대로
 *     대어 병 셋을 통째로 헛짚었다 — ①이력 434자는 <head>·<meta> 였고, ②구분선 44줄은 전부 CSS 절
 *     주석이었고, ③기계표기 79줄은 HTML 주석이라 **독자가 원리상 못 본다.** 그 수를 믿고 「청소」했으면
 *     유지보수용 표식과 절 구획을 지웠을 것이다. 그리고 학부모 안내문(mn)의 ____ 45줄은 «인쇄 기입란»,
 *     즉 종이에 손으로 쓰는 칸이라 병이 아니라 기능이다 — 따로 세고 병에 안 넣는다.
 *
 * 씀:  node tools/정본검사.js            — 요약
 *      node tools/정본검사.js --문서별   — 문서마다 한 줄
 *      node tools/정본검사.js --json     — 기계용
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 뿌리 = path.resolve(__dirname, '..');
const 정본방 = path.join(뿌리, 'docs', '정본');
const 발표방 = path.join(뿌리, 'docs', '발표물');

/* ── 인자 ── */
const args = process.argv.slice(2);
const 아는것 = ['--문서별', '--json'];
const 모르는것 = args.filter((a) => a.startsWith('--') && !아는것.includes(a));
if (모르는것.length) {
  console.error(`모르는 플래그 ${모르는것.join(' ')} — 정본검사 가 아는 것은 ${아는것.join(' ')} 뿐이다.`);
  process.exit(2);
}
const 문서별 = args.includes('--문서별');
const json = args.includes('--json');

/* ── 무엇을 세나 ──────────────────────────────────────────────
 * 병 ①②③⑦⑧만 기계가 본다(위 「못 보는 것」 참조). */

/** ⑧ 새 자산 — 08-10 이후 확정된 것 중 대외 문서가 모르면 안 되는 이름들 */
const 새자산 = [
  '몽글', '까몽', '마린', '이름 없는 땅', 'Atlas',
  'Loom', 'Vellum', 'Prism', 'Temper', 'Trail', 'Reed',
];

/** ⑧ 죽은 것 — 폐기됐는데 아직 살아 있으면 거짓이 되는 이름들 */
const 죽은것 = [
  { 말: 'Glide', 왜: '2026-08-05 폐기 — 앱은 네이티브 Expo' },
  { 말: '몬스터', 왜: '2026-08-20 유호 지시 「몬스터는 캐릭터로」' },
  { 말: '필살기', 왜: '2026-08-20 — 「다음에 맞힐 문제」로' },
  { 말: 'Stage K', 왜: '2026-07-10 전면 폐기' },
  { 말: 'TOPIK 6급', 왜: '커리큘럼 상한은 5급 — 6급 반은 열지 않는다' },
];

/** 🔑 «살아 있으니 지우면 안 되는» 것 — 이 자의 존재 이유 절반이 여기다.
 *  7단계 캐릭터 진화는 Code.js 에서 «지금도 돈다». 낱말 「몬스터」만 죽었다.
 *  이걸 안 적어 두면 다음 세션이 낡음 정리 중에 멀쩡한 기능을 문서에서 지운다. */
const 지키는것 = ['뉴로', '싱크마스터', '7단계'];

/** ⑦ 만든 사람만 아는 낱말 — 풀이 없이 서면 독자가 해독을 한 겹 더 해야 한다 */
const 조어 = ['콕핏', '리텐션 레이더', '케어 사각', '격파 찬스', '기회 밸런스', '알림 다이어트', '위성 클래스'];

const 세기 = (본문, 말) => {
  let n = 0, i = 0;
  for (;;) { const j = 본문.indexOf(말, i); if (j < 0) break; n++; i = j + 말.length; }
  return n;
};

/* ── 한 벌 재기 ── */
/** HTML 에서 «독자에게 보이는 글»만 남긴다 — 주석·style·script·태그를 벗긴다.
 *  이걸 안 하면 .txt 자가 마크업을 병으로 읽는다(머리말 참조). */
function 보이는글만(원문) {
  return 원문
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<style[^]*?<\/style>/gi, '')
    .replace(/<script[^]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function 재기(경로) {
  const 원문 = fs.readFileSync(경로, 'utf8');
  const html = 경로.endsWith('.html');
  const 본문 = html ? 보이는글만(원문) : 원문;
  const 원문줄들 = 원문.split(/\r?\n/);
  /* 인쇄 기입란은 병이 아니라 기능이다 — 종이에 손으로 쓰는 칸. 따로 센다. */
  const 기입란 = html ? 원문줄들.filter((l) => /_{4,}/.test(l)).length : 0;
  const 줄들 = 본문.split(/\r?\n/);

  /* ① 판번호 딱지 — 머리 6줄 안의 판 표기 + 본문 첫 문장까지의 «개정이력 두께» */
  const 머리 = 줄들.slice(0, 6).join('\n');
  const 판딱지 = /v\d+(\.\d+)?\s*[·|,]?\s*20\d\d-\d\d-\d\d|^\s*v\d+(\.\d+)?\s/m.test(머리) ? 1 : 0;
  let 이력글자 = 0;
  for (let i = 2; !html && i < 줄들.length; i++) {
    if (!줄들[i].trim()) { if (이력글자) break; continue; }
    이력글자 += 줄들[i].length;
    if (i > 24) break;              // 머리 블록만 — 본문까지 세지 않는다
  }

  /* ② 메모장 조판 — 코드 스팬(``) 안은 조판이 아니라 조판의 «인용»이라 벗기고 잰다 */
  const 벗긴줄들 = 줄들.map((l) => l.replace(/`[^`]*`/g, ''));
  const 구분선 = 벗긴줄들.filter((l) => /[─═]{10,}/.test(l)).length;
  const 머리기호 = 벗긴줄들.reduce((a, l) => a + 세기(l, '◆'), 0);
  const 밑줄칸 = html ? 0 : 벗긴줄들.filter((l) => /_{4,}/.test(l)).length;
  const 괘선 = 벗긴줄들.filter((l) => /[┌┬┐├┼┤└┴┘│]/.test(l)).length;

  /* ③ 문서가 자기 이야기를 한다 */
  const 기계표기 = 줄들.filter((l) => /<!--|-->|doc-graph|파생:\s*docs\//.test(l)).length;

  /* ⑦ 조어 */
  const 조어수 = 조어.reduce((a, w) => a + 세기(본문, w), 0);

  /* ⑧ 새 자산 · 죽은 것 · 지키는 것 */
  const 새것 = 새자산.filter((w) => 세기(본문, w) > 0);
  /* ⑧ 죽은 것 — «쓰고 있다»와 «금칙으로 싣고 있다»를 가른다(위 머리말 참조).
   *   반례 = 표 줄이거나 그 낱말이 낫표 안. 그 줄은 지우면 규범이 되레 무너진다. */
  const 죽음 = 죽은것.map((d) => {
    let 병 = 0, 반례 = 0;
    for (const l of 줄들) {
      const n = 세기(l, d.말);
      if (!n) continue;
      if (l.includes('|') || l.includes('「' + d.말 + '」')) 반례 += n; else 병 += n;
    }
    return { ...d, 수: 병, 반례 };
  }).filter((d) => d.수 > 0 || d.반례 > 0);
  const 지킴 = 지키는것.filter((w) => 세기(본문, w) > 0);

  return {
    경로: path.relative(뿌리, 경로).replace(/\\/g, '/'),
    종류: html ? 'html' : 'txt',
    줄수: 원문줄들.length,
    기입란,
    판딱지, 이력글자,
    구분선, 머리기호, 밑줄칸, 괘선,
    기계표기, 조어수,
    새것, 죽음, 지킴,
  };
}

function 훑기(방, 확장) {
  const 나온것 = [];
  (function 걷기(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '_archive') 걷기(p); }
      else if (확장.some((x) => e.name.endsWith(x))) 나온것.push(p);
    }
  })(방);
  return 나온것.sort();
}

const 정본들 = fs.existsSync(정본방) ? 훑기(정본방, ['.txt']).map(재기) : [];
const 발표들 = fs.existsSync(발표방) ? 훑기(발표방, ['.html']).filter((p) => path.basename(p).startsWith('_src_')).map(재기) : [];
const 전부 = [...정본들, ...발표들];

const 합 = (키) => 전부.reduce((a, d) => a + (d[키] || 0), 0);
const 벌 = (조건) => 전부.filter(조건).length;

const 요약 = {
  문서수: 전부.length,
  정본수: 정본들.length,
  발표수: 발표들.length,
  총줄수: 합('줄수'),
  병1_판딱지벌: 벌((d) => d.판딱지 > 0),
  병1_이력글자: 합('이력글자'),
  병2_구분선: 합('구분선'),
  병2_머리기호: 합('머리기호'),
  병2_밑줄칸: 합('밑줄칸'),
  병2_괘선: 합('괘선'),
  인쇄기입란: 합('기입란'),
  병3_기계표기: 합('기계표기'),
  병7_조어: 합('조어수'),
  병8_새자산실린벌: 벌((d) => d.새것.length > 0),
  병8_죽은것남은벌: 벌((d) => d.죽음.some((x) => x.수 > 0)),
  병8_죽은것총수: 전부.reduce((a, d) => a + d.죽음.reduce((b, x) => b + x.수, 0), 0),
  병8_반례총수: 전부.reduce((a, d) => a + d.죽음.reduce((b, x) => b + x.반례, 0), 0),
  지킴_살아있는벌: 벌((d) => d.지킴.length > 0),
};

if (json) { console.log(JSON.stringify({ 요약, 문서: 전부 }, null, 1)); process.exit(0); }

const 줄 = (k, v, 분모) => console.log(`   ${String(k).padEnd(30)} ${String(v).padStart(7)}${분모 ? ` / ${분모}` : ''}`);

console.log('■ 정본검사 — 촌스러움 여덟 병 중 «셀 수 있는» 것만');
console.log(`   과녁 = docs/정본/ ${요약.정본수}벌(.txt) + docs/발표물/_src_*.html ${요약.발표수}벌 · 총 ${요약.총줄수.toLocaleString()}줄\n`);

console.log('① 판번호 딱지 — 첫 화면을 결재 서류로 만든다');
줄('판 표기가 머리에 있는 문서', 요약.병1_판딱지벌, 요약.문서수);
줄('머리 개정이력 글자 수', 요약.병1_이력글자.toLocaleString());

console.log('\n② 메모장 조판 — 2000년대 텍스트 매뉴얼의 옷');
줄('구분선(─ ═ 10자 이상) 줄', 요약.병2_구분선);
줄('머리기호 ◆', 요약.병2_머리기호);
줄('밑줄 기입란(____) 줄', 요약.병2_밑줄칸);
줄('괘선 문자표 줄', 요약.병2_괘선);
줄('인쇄 기입란 (HTML · 병 아님)', 요약.인쇄기입란);
console.log('   ⚠ ①②③ 은 HTML 에서 «보이는 글»만 잰다 — 주석·CSS·태그는 독자가 못 본다.');

console.log('\n③ 문서가 자기 이야기를 한다 — 독자 아닌 우리에게 하는 말');
줄('기계 표기·주석 줄', 요약.병3_기계표기);

console.log('\n⑦ 만든 사람만 아는 낱말');
줄('풀이 없는 조어', 요약.병7_조어);

console.log('\n⑧ 08-26 의 SYNK 가 서가에 있나');
줄('새 자산이 실린 문서', 요약.병8_새자산실린벌, 요약.문서수);
줄('죽은 것을 «쓰고 있는» 문서', 요약.병8_죽은것남은벌, 요약.문서수);
줄('그 총 등장', 요약.병8_죽은것총수);
줄('금칙표·낫표 안 (반례 — 병 아님)', 요약.병8_반례총수);
console.log('   ⚠ 반례를 지우면 규범이 되레 무너진다 — 「쓰지 마세요」는 그 낱말을 적어야 선다.');

console.log('\n🔑 지우면 안 되는 것 (살아 있다 — Code.js 에서 지금도 돈다)');
줄('7단계 캐릭터가 남아 있는 문서', 요약.지킴_살아있는벌, 요약.문서수);
console.log('   ⚠ 이 수가 «줄면» 낡음 정리 중에 멀쩡한 기능을 지운 것이다.');

if (문서별) {
  console.log('\n■ 문서별');
  const w = Math.max(...전부.map((d) => d.경로.length));
  console.log(`   ${'문서'.padEnd(w)}  줄수  ①이력  ②선 ◆  ③기계 ⑦조어  ⑧새것 죽은것`);
  for (const d of 전부) {
    console.log(`   ${d.경로.padEnd(w)} ${String(d.줄수).padStart(5)} ${String(d.이력글자).padStart(6)} ${String(d.구분선).padStart(4)}${String(d.머리기호).padStart(3)} ${String(d.기계표기).padStart(5)}${String(d.조어수).padStart(6)} ${String(d.새것.length).padStart(6)}${String(d.죽음.reduce((a, x) => a + x.수, 0)).padStart(7)}`);
  }
}

console.log('\n🚫 이 자가 못 보는 것 — 사람이 읽어야 아는 자리');
console.log('   ④ 전단 화법(형용사가 사실을 되돌린다) · ⑤ 예고·겸양(한 음으로 평평한 목소리) · ⑥ 결론이 뒤에 있다');
console.log('   그리고 «사실이 맞는가»도 못 잰다 — 낱말이 있나 없나만 본다.');
