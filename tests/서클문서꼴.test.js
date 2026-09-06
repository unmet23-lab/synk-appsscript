'use strict';
/**
 * 숙제 서클 «문서» 꼴 — 화면 수업(1기)용 구글 문서 (정본 = docs/1기_차시대응표_v1.md §⑤-㉠ ⓐ · 실물 = 엔진_셋업확장.js circleSheetDoc_)
 *
 * ■ 이 시험이 막는 것
 *   ① 스위치 값을 잘못 읽어 종이 반이 조용히 문서로(또는 그 반대로) 나간다.
 *   ② 문서 모델이 종이와 다른 칸을 낸다(같은 조립 모델 `circleSheetOf_` 를 타는데 담는 꼴에서 줄이 빠진다).
 *   ③ 확인 칸(☐)이 「다음에 맞힐 문제」에만 붙는 규약이 깨진다.
 *   ④ 문서 꼴에 종이의 59mm 걷기를 걸어 문장을 뺀다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
// vm 안에서 만든 배열은 이 영역의 Array 와 프로토타입이 달라 strict deepEqual 이 «같은 구조인데 다르다»고 운다 — JSON 왕복으로 견준다
const 같다 = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./_engine-source');

const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
function 떼어오기(소스, 머리) {
  const i = 소스.indexOf(머리);
  assert.ok(i >= 0, '함수를 못 찾았다: ' + 머리);
  const j = 소스.indexOf('\n}', i);
  return 소스.slice(i, j + 2);
}
const 셋업 = 읽기('엔진_셋업확장.js');
const ctx = { console, DocumentApp: { ParagraphHeading: { HEADING2: 'h2', HEADING3: 'h3' } } };
vm.createContext(ctx);
new vm.Script(읽기('contents_서클.js').replace(/^'use strict';/, ''), { filename: 'contents_서클.js' }).runInContext(ctx);
const 라벨줄 = 셋업.split('\n').filter((l) => l.indexOf('const CIRCLE_LABELS = ') === 0)[0];
assert.ok(라벨줄, 'CIRCLE_LABELS 선언을 못 찾았다');
new vm.Script(["const CIRCLE_DOC_CHECK = '☐';", 라벨줄, 떼어오기(셋업, 'function circleDocModeOf_('), 떼어오기(셋업, 'function circleDocModel_('),
  떼어오기(셋업, 'function circleDocFill_(')].join('\n'), { filename: '서클문서' }).runInContext(ctx);
// 톱레벨 const 는 컨텍스트 객체에 안 붙는다 — 같은 컨텍스트의 스크립트끼리는 보이므로 여기서 꺼낸다
vm.runInContext('globalThis.__X = { CIRCLE_FRAMES, CIRCLE_LABELS }', ctx);
Object.assign(ctx, ctx.__X);

const 시트 = {
  class_id: '1기A', session_no: 2, groups: [{
    group_no: 1, warmup_question: { text: '주말에 뭘 했어요?' },
    members: [
      { display_name: '바트', role: '진행', kept: { text: '저는 어제 도서관에서 책을 읽었어요.' },
        shaky: { text: '「에서」와 「에」', trend_line: '지난주보다 줄었어요.' }, next_one: { label: '다음에 맞힐 문제', text: '장소 조사 — 오늘 수업에서 한 번 더 봐요.', check: true },
        frame: ctx.CIRCLE_FRAMES[1] },
      { display_name: '사란', role: '기록', kept: null, shaky: null, next_one: { label: '오늘 볼 것', text: '저는 ___를 잘하고 싶어요.', check: true }, frame: null },
    ],
  }],
};

test('스위치 — 비면 종이 · 「문서」는 전 반 · 「문서:반」은 그 반만 · 모르는 값은 종이', () => {
  assert.equal(ctx.circleDocModeOf_('', '1기A'), '종이');
  assert.equal(ctx.circleDocModeOf_('문서', '평일 A'), '문서');
  assert.equal(ctx.circleDocModeOf_('문서:1기A, 1기B', '1기A'), '문서');
  assert.equal(ctx.circleDocModeOf_('문서:1기A, 1기B', '평일 A'), '종이');
  assert.equal(ctx.circleDocModeOf_('doc', '1기A'), '종이');
});

test('문서 모델 — 머리(역할·순서·질문·기록 빈칸)와 학생 칸(잘 된 문장·한 번 더 볼 자리·다음에 맞힐 문제·문장 틀)이 종이와 같은 순서로 선다', () => {
  const m = ctx.circleDocModel_(시트);
  assert.equal(m.length, 1);
  const p = m[0];
  assert.equal(p.제목, '1조 · 2차시');
  같다(p.머리.map((h) => h.라벨), ['역할', '말하는 순서']);
  assert.ok(p.머리[0].글.indexOf('바트(진행)') > -1 && p.머리[1].글 === '바트 → 사란');
  assert.equal(p.질문, '주말에 뭘 했어요?');
  const 바트 = p.칸[0];
  같다(바트.줄.map((l) => l.라벨), [ctx.CIRCLE_LABELS.kept, ctx.CIRCLE_LABELS.shaky, '', '다음에 맞힐 문제']);
  같다(바트.줄.map((l) => l.체크), [false, false, false, true], '확인 칸은 「다음에 맞힐 문제」에만');
  assert.equal(바트.틀.length, 3);
  const 사란 = p.칸[1];
  assert.equal(사란.줄.length, 1, '이력 0 인 학생은 「오늘 볼 것」 한 줄뿐 — 빈 줄을 안 만든다');
  assert.equal(사란.틀.length, 0);
});

test('문서 채우기 — 조마다 한 쪽 · ☐ 는 확인 칸에만 · 학생 문장은 한 글자도 안 다듬는다', () => {
  const 문단 = [];
  let 쪽 = 0;
  const body = { appendParagraph: (t) => { 문단.push(t); return { setHeading() { return this; }, setItalic() { return this; } }; }, appendPageBreak: () => { 쪽++; } };
  const 시트둘 = { class_id: '1기A', session_no: 2, groups: [시트.groups[0], Object.assign({}, 시트.groups[0], { group_no: 2 })] };
  ctx.circleDocFill_(body, ctx.circleDocModel_(시트둘));
  assert.equal(쪽, 1, '조 둘이면 쪽 나눔 하나');
  const 체크줄 = 문단.filter((t) => t.indexOf('☐') === 0);
  assert.equal(체크줄.length, 4, '조 둘 × 학생 둘 = 확인 칸 넷');
  assert.ok(문단.some((t) => t.indexOf('저는 어제 도서관에서 책을 읽었어요.') > -1), '학생 원문 그대로');
  assert.ok(!문단.some((t) => /<[a-z]+>/.test(t)), 'HTML 태그 0');
});

test('굽는 자리 — 꼴을 먼저 읽고, 문서엔 59mm 걷기를 안 걸며, 문서·종이 갈래가 한 함수(printCircleSheets)에 있다', () => {
  const s = 셋업.indexOf('function printCircleSheets(');
  const 본문 = 셋업.slice(s, 셋업.indexOf('\nfunction circleSheetsAuto_(', s));
  assert.match(본문, /getState\(꼴상태, '서클문서꼴'\)/, 'app_state 「서클문서꼴」을 안 읽는다');
  assert.match(본문, /const 빠듯 = 꼴 === '문서' \? \[\] : circleTightOf_\(sheet\)/, '문서 꼴에 종이 걷기가 걸린다');
  assert.match(본문, /\? circleSheetDoc_\(sheet, folder,/, '문서 갈래가 없다');
  assert.match(본문, /: folder\.createFile\(Utilities\.newBlob\(circleSheetHtml_\(sheet\)/, '종이 갈래가 사라졌다');
  const doc = 떼어오기(셋업, 'function circleSheetDoc_(');
  assert.match(doc, /DocumentApp\.create\(name\)/);
  assert.ok(!/setSharing\(\s*DriveApp\.Access\.ANYONE/.test(doc), '링크 공개를 썼다 — 학생 파일 공개 공유는 08-04 확정으로 폐지됐다(리포트카드공개.test.js 승인 목록 0)');
  assert.match(doc, /addEditor\(/, '조원 계정에 편집자를 안 준다 — 넷이 같이 쓸 길이 없다');
  assert.match(본문, /구움\.못준\.length/, '계정 없는 학생을 보고에 안 싣는다 — 조용히 못 읽는 학생이 생긴다');
});
