'use strict';
/* 가져가는 것 — 걸음 2 회귀 (2026-09-03) · 설계 = docs/가져가는것_설계_v1.md §6 걸음2 · §10-b · §10-c · §11-a
 *
 * 무엇을 지키나 — **「받았다」가 시스템에 도착하는가**:
 *   A. 물리 칸 — `jacket_grants` 에 「지급일」 칸이 있고, 정의를 늘려도 안 늘어나는 라이브 시트를 치유가 잡는다.
 *      (명문 ≠ 물리: `ensureSheet` 은 시트가 «없을 때만» 헤더를 쓴다)
 *   B. 스탬프 멱등 — 「지급완료」인데 날짜가 빈 행에만 찍고, 이미 찍힌 행·대기 행은 안 건드린다.
 *   C. 소비자 둘이 «같은 커밋에» 서 있다 — 목표 카드가 「받았다」로 갈리고, 굿즈 태그가 굽힌다.
 *      🔴 하나만 있으면 물건은 생기는데 화면은 계속 거짓말한다(설계 §10-c 가 못박은 실측 결함).
 *   D. 학생이 읽는 말은 `contents_증서.js` 에서만 온다 — 엔진에 태그 문구 0.
 *   E. 인쇄 규격을 «코드»가 진다 — 전에는 메일 문구가 「A4 가로 + 배경 그래픽 켜기」라고 말로만 안내했다.
 *   F. 메뉴에 있다 — 함수는 v9 초부터 있었는데 메뉴에 없어 Apps Script 편집기에서만 돌았다.
 *
 * ⚠ 재는 것은 **순수 코어**(스탬프 함수)와 **소스 형상**이다 — Drive·Sheets 래퍼는 회귀가 못 잡는다(안 재봤다).
 *   스탬프만은 시트를 흉내내 실제로 태운다 — 「받았다」가 한 번만 찍히는 것이 이 걸음의 첫 줄이라서.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { engineSource } = require('./_engine-source');
const { 코드만 } = require('./lib/소스검사.js');

const ROOT = path.resolve(__dirname, '..');
const code = engineSource();
const 코드정제 = 코드만(code);
const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

/* ── A. 물리 칸 ─────────────────────────────────────────────────────────────── */

test('Ⓐ jacket_grants 헤더 정본이 「지급일」을 품고, 쓰는 자가 전부 그 폭으로 쓴다', () => {
  const m = code.match(/const JACKET_HEADERS = (\[[^\]]*\]);/);
  assert.ok(m, 'JACKET_HEADERS 정본을 못 찾았다 — 헤더를 손으로 베낀 자리가 다시 생겼는지 본다');
  const 헤더 = new Function(`return ${m[1]};`)();
  assert.equal(헤더.length, 7, '지급일까지 일곱 칸이어야 한다');
  assert.equal(헤더[5], '지급상태');
  assert.equal(헤더[6], '지급일', '마지막 칸이 지급일이어야 한다 — 「받은 날」을 담을 물리 칸');

  // 손 사본 0 — 헤더 배열을 다시 적은 자리가 있으면 언젠가 한쪽만 늘어난다.
  // ⚠ 정본 «정의» 한 줄은 분모 밖이다(그게 사본이면 정본이 없다는 뜻이 된다).
  const 전부 = (코드정제.match(/\['student_id',\s*'이름',\s*'자격도달일'/g) || []).length;
  const 정의 = (코드정제.match(/const JACKET_HEADERS = \['student_id'/g) || []).length;
  assert.equal(정의, 1, 'JACKET_HEADERS 정의가 하나가 아니다');
  assert.equal(전부 - 정의, 0,
    'jacket_grants 헤더를 손으로 다시 적은 자리가 있다 — 정본은 JACKET_HEADERS 하나다(「지급일」이 한쪽만 안 늘던 자리)');

  // 적재도 그 폭으로 — 6 으로 굳어 있으면 지급일 칸이 영영 안 찍힌다
  assert.ok(/getRange\(gr\.getLastRow\(\) \+ 1, 1, out\.length, JACKET_HEADERS\.length\)/.test(코드정제),
    '신규 적재가 JACKET_HEADERS.length 로 안 쓴다 — 폭이 굳으면 새 칸이 죽는다');
});

test('Ⓐ 이미 있는 시트의 헤더를 치유가 잡는다 — ensureSheet 은 «없을 때만» 쓴다', () => {
  assert.ok(/function jacketEnsureHeaders_/.test(코드정제), '헤더 치유 함수가 없다');
  // 워처가 실제로 부른다 — 함수만 있고 안 부르면 라이브 시트는 영영 여섯 칸이다
  const 워처 = 코드정제.slice(코드정제.indexOf('function jacketWatch_'));
  assert.ok(/jacketEnsureHeaders_\(gr\)/.test(워처.slice(0, 4000)),
    'jacketWatch_ 가 헤더 치유를 안 부른다 — 정의를 늘려도 라이브 칸은 안 는다');
});

/* ── B. 스탬프 멱등 ──────────────────────────────────────────────────────────── */

/** 시트를 흉내낸다 — getRange(행,열).setValue 와 getRange(행,열,행수,열수).getValues 둘만 쓴다. */
function 가짜시트(행들) {
  const rows = 행들.map((r) => r.slice());
  return {
    쓴것: [],
    getLastRow() { return rows.length + 1; },
    getRange(r, c, nr, nc) {
      const self = this;
      if (nr === undefined) {
        return {
          setValue(v) { rows[r - 2][c - 1] = v; self.쓴것.push({ 행: r, 열: c, 값: v }); }
        };
      }
      return { getValues() { return rows.slice(r - 2, r - 2 + nr).map((x) => x.slice(c - 1, c - 1 + nc)); } };
    },
    행들() { return rows; }
  };
}

const 스탬프 = (() => {
  const s = code.indexOf('function jacketStampGiven_');
  assert.notEqual(s, -1, 'jacketStampGiven_ 를 못 찾았다');
  const e = code.indexOf('\n}', s);
  const src = code.slice(s, e + 2);
  return new Function(`const JACKET_HEADERS = ${code.match(/const JACKET_HEADERS = (\[[^\]]*\]);/)[1]};\n${src}\nreturn jacketStampGiven_;`)();
})();

test('Ⓑ 「지급완료」인데 날짜가 빈 행에만 찍는다 — 대기 행은 안 건드린다', () => {
  const sh = 가짜시트([
    ['S1', '뭉흐토야', '2027-06-12', 12, 3400, '지급완료', ''],
    ['S2', '체첵마', '2027-06-12', 12, 3100, '지급대기', ''],
  ]);
  const 받음 = 스탬프(sh, '2027-06-20');
  assert.equal(받음.length, 1, '지급완료 한 명만 잡혀야 한다');
  assert.equal(받음[0].sid, 'S1');
  assert.equal(sh.행들()[0][6], '2027-06-20', '받은 날이 찍혀야 한다');
  assert.equal(sh.행들()[1][6], '', '대기 행에는 아무것도 안 찍혀야 한다');
});

test('Ⓑ 멱등 — 두 번 돌려도 두 번째는 아무것도 안 찍고 아무도 안 잡는다', () => {
  const sh = 가짜시트([['S1', '뭉흐토야', '2027-06-12', 12, 3400, '지급완료', '']]);
  스탬프(sh, '2027-06-20');
  const 두번째 = 스탬프(sh, '2027-06-21');
  assert.equal(두번째.length, 0, '두 번째 실행이 같은 사람을 다시 잡았다 — 태그가 매일 다시 굽히고 알림이 매일 뜬다');
  assert.equal(sh.행들()[0][6], '2027-06-20', '날짜가 덮어써졌다 — 받은 날이 매일 오늘로 밀린다');
});

test('Ⓑ 빈 시트는 조용히 빈 배열 — 학생 0명인 지금이 그 상태다', () => {
  const sh = { getLastRow: () => 1 };
  assert.deepEqual(스탬프(sh, '2027-06-20'), []);
});

/* ── C. 소비자 둘 ───────────────────────────────────────────────────────────── */

test('Ⓒ 소비자 ① 목표 카드 — 「받았다」로 갈린다(전엔 자격 도달 뒤 영구히 「곧 전달해 드려요」였다)', () => {
  const c = 읽기('Code.js');
  assert.ok(/const jacketGot = \{\}/.test(c), 'Code.js 가 jacket_grants 를 안 읽는다');
  assert.ok(/getSheetByName\('jacket_grants'\)/.test(c), 'jacket_grants 시트를 여는 자리가 없다');
  assert.ok(/'지급완료'/.test(c), '지급상태를 판정하는 자리가 없다');

  // 세 갈래여야 한다 — 받았다 / 자격은 됐고 아직 / 걷는 중
  const i = c.indexOf('const 받은날 = jacketGot[id]');
  assert.notEqual(i, -1, '목표 카드가 「받았나」를 안 본다');
  const 토막 = c.slice(i, i + 900);
  assert.ok(/이 옷을 받았어요/.test(토막), '받은 뒤의 문장이 없다');
  assert.ok(/else if \(tenureDone && needP <= 0\)/.test(토막), '「자격 도달」 갈래가 사라졌다 — 아직 안 받은 학생의 자리다');

  // 킷 밖 색이 되살아나지 않았나 — 이 카드는 학생이 보는 면이다
  assert.equal(/#12B76A/.test(토막), false, '킷 밖 초록(#12B76A)이 남아 있다 — 자람 글자는 Meadow Deep(#3F6B2E)');
});

test('Ⓒ 소비자 ① 오늘의 알림 — 받은 날 하루만, 사슬 맨 앞에서', () => {
  const c = 읽기('Code.js');
  const i = c.indexOf('alertOut.push([');
  assert.notEqual(i, -1);
  const 토막 = c.slice(i, i + 400);
  assert.ok(/jacketGot\[id\] === todayYmd0/.test(토막), '받은 날 판정이 알림 사슬에 없다');
  assert.ok(토막.indexOf('jacketGot') < 토막.indexOf('crownToday2'),
    '과잠이 도전·성장보다 뒤에 있다 — 열두 달에 한 번뿐인 날이 매일 올 수 있는 것에 밀린다');
});

test('Ⓒ 소비자 ② 굿즈 태그 — 굽는 함수가 있고 워처가 실제로 부른다', () => {
  assert.ok(/function jacketPrintTags_/.test(코드정제), '태그 굽는 함수가 없다');
  const 워처 = 코드정제.slice(코드정제.indexOf('function jacketWatch_'));
  assert.ok(/jacketPrintTags_\(오늘받음, tzJ\)/.test(워처.slice(0, 4000)),
    'jacketWatch_ 가 태그를 안 굽는다 — 함수만 있고 아무도 안 부르면 없는 기능이다');
  // 판형은 설계 §11-a #14 — 55×85mm + 구멍 1
  const 태그 = 코드정제.slice(코드정제.indexOf('function jacketPrintTags_'));
  assert.ok(/width:55mm;height:85mm/.test(태그.slice(0, 3000)), '태그 판형이 55×85mm 가 아니다');
});

/* ── D. 학생이 읽는 말 ───────────────────────────────────────────────────────── */

test('Ⓓ 태그 문구는 contents_증서.js 에서만 온다 — 엔진에 문구 0 · mn 은 빈칸', () => {
  const 뱅크 = 읽기('contents_증서.js');
  assert.ok(/const GOODS_TAG_SAY = \{/.test(뱅크), '태그 말 뱅크가 없다');
  const say = new Function(`${뱅크}\nreturn GOODS_TAG_SAY;`)();
  assert.ok(say['과잠'] && say['과잠'].본문.includes('{이름}'), '과잠 태그 문안이 없거나 이름 자리가 없다');
  assert.equal(say['과잠'].mn.본문, '', '몽골어를 지어냈다 — 검수자 0명이면 빈칸이 정직값이다(설계 §11-e)');

  // 엔진은 그 뱅크를 «부르기»만 한다 — 문장을 직접 들고 있으면 두 벌이 된다
  const 태그 = 코드정제.slice(코드정제.indexOf('function jacketPrintTags_'), 코드정제.indexOf('function jacketPrintTags_') + 3000);
  assert.ok(/GOODS_TAG_SAY/.test(태그), '엔진이 뱅크를 안 읽는다');
  assert.equal(/함께한 열두 달|함께한 \{개월\}/.test(태그), false, '엔진 안에 태그 문장이 박혀 있다 — 말은 뱅크가 쥔다');
  // 반쪽 배포에도 안 죽는다
  assert.ok(/typeof GOODS_TAG_SAY === 'undefined'/.test(태그), '미배포 가드가 없다 — 반쪽 배포에서 배치가 죽는다');
});

test('Ⓓ 배포 표면 — contents_증서.js 가 filePushOrder 에 있고 라이브 허용목록에 잡힌다', () => {
  const clasp = JSON.parse(읽기('.clasp.json'));
  assert.ok(clasp.filePushOrder.includes('contents_증서.js'), 'filePushOrder 에 없다');
  const ignore = 읽기('.claspignore');
  const 허용 = ignore.split('\n').filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim());
  const 잡힘 = 허용.some((p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
    .test('contents_증서.js'));
  assert.ok(잡힘, '.claspignore 허용목록이 안 잡는다 — 라이브에 안 올라가 반쪽이 된다');
});

/* ── E. 인쇄 규격을 코드가 진다 ──────────────────────────────────────────────── */

test('Ⓔ 이달의 카드 인쇄 판 — 용지·여백·배경을 파일이 정한다(말로 안내하지 않는다)', () => {
  const i = 코드정제.indexOf('function printMonthlyCards');
  assert.notEqual(i, -1);
  const 토막 = 코드정제.slice(i, i + 3000);
  assert.ok(/@page\{size:A4 landscape;margin:0;\}/.test(토막), '@page 로 용지·여백을 안 잠근다');
  assert.ok(/print-color-adjust:exact/.test(토막), '배경색이 인쇄에 안 살아난다 — 「배경 그래픽」 체크를 대신하는 선언이다');
  assert.ok(/border:1px dashed/.test(토막), '절취선이 없다 — 재단 0 이 이 설계의 규칙이다(§10-b ②)');
  assert.equal(/background:#fff[;"]/.test(토막), false, '순백이 남아 있다 — 킷 철칙 ①(라이트 하한 = Paper)');
});

test('Ⓔ 이달의 카드 본체 — 종이로 나가는 유일한 카드라 킷 밖 색이 0이다', () => {
  const i = 코드정제.indexOf('const monMapC = monsterImgMap_');
  assert.notEqual(i, -1, '이달의 카드 만드는 자리를 못 찾았다');
  const 토막 = 코드정제.slice(i, i + 2500);
  [['#fff', '순백 — Paper 로'], ['#E5E7EB', '킷 밖 회색 — Stitch 로'],
   ['#6B7280', '킷 밖 회색 — Ash Wool 로'], ['#1D1D1C', '퇴역 대기 — Ink 로']].forEach(([hex, 왜]) => {
    assert.equal(토막.includes(hex), false, `${hex} 가 남아 있다(${왜})`);
  });
  assert.ok(/#FBF7F0/.test(토막) && /#F0E3C8/.test(토막), '킷 색(Paper·Stitch)이 안 들어갔다');
});

/* ── F. 메뉴 ────────────────────────────────────────────────────────────────── */

test('Ⓕ 메뉴에 있다 — 원장이 못 부르는 기능은 없는 기능이다', () => {
  const 셋업 = 읽기('엔진_셋업확장.js');
  assert.ok(/addItem\('🖨 이달의 카드 인쇄 파일 만들기', 'menuPrintMonthlyCards'\)/.test(셋업),
    '메뉴에 이달의 카드가 없다 — 함수는 있는데 Apps Script 편집기에서만 돌던 상태로 되돌아갔다');
  assert.ok(/function menuPrintMonthlyCards/.test(코드정제), '메뉴가 부르는 함수가 없다 — 누르면 오류가 난다');
  // 결과를 화면으로 돌려준다 — 아무 일도 안 일어나 보이면 원장은 두 번 세 번 누른다
  const i = 코드정제.indexOf('function menuPrintMonthlyCards');
  assert.ok(/ui\.alert/.test(코드정제.slice(i, i + 1200)), '결과를 화면에 안 돌려준다');
});
