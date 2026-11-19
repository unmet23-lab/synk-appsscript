'use strict';

// ㉒ LAB 맞는 말 · 틀린 말 색(tools/lib/맞음틀림관문.js) — 걸려야 할 경우와 지나가야 할 경우.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rightWrongFindings, planRows, stripComments, normalColors, signOfCode, signOfText, OK, NG, FROM, MAX_BYTES } = require('../tools/lib/맞음틀림관문.js');
const { FIX, LOOK } = require('../tools/lib/게시글규칙.js');

// 시험이 만든 임시 폴더는 끝에 모두 지운다
const 만든폴더 = [];
test.after(() => { for (const d of 만든폴더) fs.rmSync(d, { recursive: true, force: true }); });

function 편({ name = 'LAB_시험편_mn_20261120', 칸 = null, 칸줄 = null, 코드 = null, 글 = null, 더 = null, 브랜드 = 'LAB', 기획 = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '맞음틀림-'));
  만든폴더.push(root);
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  if (기획) {
    const rows = ['| 칸 | 값 |', '|---|---|', '| 한 문장 | 붕어빵은 사고 사진은 찍는다 |'];
    if (칸줄 !== null) rows.push(칸줄);
    else if (칸 !== null) rows.push(`| 맞음틀림 | ${칸} |`);
    fs.writeFileSync(path.join(dir, '기획.md'), `# 기획\n\n${rows.join('\n')}\n`);
  }
  if (코드 !== null) {
    fs.mkdirSync(path.join(dir, 'remotion', 'src', 'film', '판본'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'remotion', 'src', 'film', 'Film.tsx'), 코드);
    if (글 !== null) fs.writeFileSync(path.join(dir, 'remotion', 'src', 'film', '판본', 'MN.json'), 글);
    for (const [파일, 내용] of Object.entries(더 || {})) fs.writeFileSync(path.join(dir, 'remotion', 'src', 파일), 내용);
  }
  return { name, dir, prep: { 브랜드 } };
}
const 두색 = `const OK = '${OK}';\nconst NG = '${NG.toLowerCase()}';\nconst cells = [{ ko: '사진도 사자!', mark: 'ng' }];\n`;
const 산호만 = "const CORAL = '#E8503D';\nconst cells = [{ ko: '사진도 사자!', mark: 'ng' }];\n";
const 표시없음 = "const CORAL = '#E8503D';\nexport const TOTAL = 20;\n";
const 코드of = (found) => found.map((f) => `${f.level}:${f.code}`);

test('있음 + 두 색이 화면 코드에 있으면 지나간다(색 값의 대소문자는 가리지 않는다)', () => {
  assert.deepEqual(rightWrongFindings(편({ 칸: '있음(사진도 사자!)', 코드: 두색 })), []);
});

test('있음 + 같은 색을 rgb( ) 꼴로 써도 지나간다', () => {
  const rgb = "const OK = 'rgb(10, 154, 102)';\nconst NG = 'rgba(217,45,32,0.9)';\n";
  assert.deepEqual(rightWrongFindings(편({ 칸: '있음', 코드: rgb })), []);
});

test('있음인데 초록이나 빨강이 없으면 고칠 것이고 빠진 색을 말한다', () => {
  const found = rightWrongFindings(편({ 칸: '있음(사진도 사자!)', 코드: 산호만 }));
  assert.deepEqual(코드of(found), [`${FIX}:right-wrong-color`]);
  assert.match(found[0].message, new RegExp(OK));
  assert.match(found[0].message, new RegExp(NG));
  const 하나 = rightWrongFindings(편({ 칸: '있음', 코드: `const OK = '${OK}';\n` }));
  assert.match(하나[0].message, new RegExp(NG));
  assert.doesNotMatch(하나[0].message, new RegExp(OK));
});

test('있음인데 두 색이 주석에만 있으면 고칠 것', () => {
  const 주석만 = `// 맞는 말 ${OK} · 틀린 말 ${NG}\n/* ${OK} ${NG} */\nconst CORAL = '#E8503D';\n`;
  assert.deepEqual(코드of(rightWrongFindings(편({ 칸: '있음', 코드: 주석만 }))), [`${FIX}:right-wrong-color`]);
});

test('있음인데 화면 코드가 없으면 확인할 것(영상에서 본다)', () => {
  assert.deepEqual(코드of(rightWrongFindings(편({ 칸: '있음(반말)' }))), [`${LOOK}:right-wrong-color`]);
});

test('있음인데 색을 쓴 파일이 너무 커서 못 읽었으면 고칠 것이 아니라 확인할 것', () => {
  const 큰 = `${두색}// ${'가'.repeat(MAX_BYTES)}\n`;
  const found = rightWrongFindings(편({ 칸: '있음', 코드: 큰, 더: { 'Root.tsx': 표시없음 } }));
  assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-color`]);
  assert.match(found[0].message, /Film\.tsx/);
});

test('없음 + 틀림 표시가 없으면 지나가고, 틀림 표시가 있으면 확인할 것', () => {
  assert.deepEqual(rightWrongFindings(편({ 칸: '없음', 코드: 표시없음 })), []);
  assert.deepEqual(코드of(rightWrongFindings(편({ 칸: '없음(✗는 틀린 풀이 카드)', 코드: 산호만 }))), [`${LOOK}:right-wrong-sign`]);
});

test('판본 글의 ❌도 틀림 표시로 본다', () => {
  const found = rightWrongFindings(편({ 칸: '없음', 코드: 표시없음, 글: '{"pills": ["❌ «사!» = «Худалдаж ав!»"]}' }));
  assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-sign`]);
});

test('칸이 없으면 틀림 표시가 있든 없든 고칠 것(모든 LAB 편이 칸을 적는다)', () => {
  assert.deepEqual(코드of(rightWrongFindings(편({ 코드: 산호만 }))), [`${FIX}:right-wrong-row`]);
  assert.deepEqual(코드of(rightWrongFindings(편({ 코드: 표시없음 }))), [`${FIX}:right-wrong-row`]);
});

test('기획.md가 없으면 틀림 표시가 있을 때 고칠 것, 없을 때 확인할 것', () => {
  assert.deepEqual(코드of(rightWrongFindings(편({ 기획: false, 코드: 산호만 }))), [`${FIX}:right-wrong-row`]);
  assert.deepEqual(코드of(rightWrongFindings(편({ 기획: false, 코드: 표시없음 }))), [`${LOOK}:right-wrong-row`]);
});

test('칸 값이 없음 · 있음으로 시작하지 않으면 고칠 것', () => {
  assert.deepEqual(코드of(rightWrongFindings(편({ 칸: '색으로 가름', 코드: 두색 }))), [`${FIX}:right-wrong-row`]);
});

test('굵게 쓴 값과 끝 막대가 없는 줄도 읽는다', () => {
  assert.deepEqual(rightWrongFindings(편({ 칸: '**있음** — 사장님께 반말', 코드: 두색 })), []);
  assert.deepEqual(rightWrongFindings(편({ 칸줄: '| 맞음틀림 | 있음(사진도 사자!)', 코드: 두색 })), []);
  assert.deepEqual(rightWrongFindings(편({ 칸줄: '| **맞음틀림** | 없음', 코드: 표시없음 })), []);
});

test('보지 않는 편 — 날짜가 앞이거나, LAB이 아니거나, 노래 · 퀴즈 틀이다', () => {
  assert.ok(FROM > '20261119');
  assert.deepEqual(rightWrongFindings(편({ name: 'LAB_사요찍어요_mn_20261116', 코드: 산호만 })), []);
  assert.deepEqual(rightWrongFindings(편({ 브랜드: 'synkbrief', 코드: 산호만 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 'LAB_노래_가나다_20261120', 코드: 산호만 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 'LAB_퀴즈_관용구_mn_20261120', 코드: 산호만 })), []);
});

test('검사하다 오류가 나도 던지지 않고 확인할 것으로 남긴다', () => {
  const found = rightWrongFindings({ name: 'LAB_시험편_mn_20261120', dir: null, prep: { 브랜드: 'LAB' } });
  assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-error`]);
});

test('틀림 표시 찾기 — 화면에 나가는 글자와 mark 값 쓰임만 센다', () => {
  assert.equal(signOfCode("const line = \"What's wrong?\"; const n = text.length;"), null);
  assert.equal(signOfCode("type Mark = 'ok' | 'ng';\nconst m: { mark?: 'ok' | 'ng' } = {};"), null);
  assert.equal(signOfCode('// 여동생의 「형!」에 빨간 ✗ — 틀린 말\nconst a = 1;'), null);
  assert.equal(signOfCode("{ ko: '자, 사!', mark: 'ng' }"), "mark: 'ng'");
  assert.equal(signOfCode('<Bubble mark="ng" />'), 'mark="ng"');
  assert.equal(signOfCode("<span>{levelText(L, 0)} ❌</span>"), '❌');
  assert.equal(signOfText('{"pills": ["✕ 반말"]}'), '✕');
});

test('도우미 — 칸표 읽기 · 주석 빼기 · 색 꼴 맞추기', () => {
  const rows = planRows('| 칸 | 값 |\n|---|---|\n| **꼴** | 한 가지 |\n| 맞음틀림 | 있음 | 덧붙임 |\n| 맞음틀림 | 없음 |\n');
  assert.equal(rows.get('꼴'), '한 가지');
  assert.equal(rows.get('맞음틀림'), '있음 | 덧붙임');
  assert.equal(stripComments("const u = 'http://a/b'; // 주석\n/* 덩이 */ const v = 1;").includes('주석'), false);
  assert.equal(stripComments("const u = 'http://a/b'; // 주석").includes('http://a/b'), true);
  assert.equal(normalColors('RGB(10, 154, 102) #0A9A66'), '#0a9a66 #0a9a66');
});
