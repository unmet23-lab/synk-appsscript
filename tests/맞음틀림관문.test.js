'use strict';

// ㉒ LAB 맞는 말 · 틀린 말 색(tools/lib/맞음틀림관문.js) — 걸려야 할 경우와 지나가야 할 경우.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rightWrongFindings, planRows, stripComments, normalColors, signOfCode, glyphOfCode, signOfText, signOfJson, OK, NG, FROM, MAX_BYTES } = require('../tools/lib/맞음틀림관문.js');
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

test('새 편 — 기획.md가 없으면 틀림 표시가 있든 없든 고칠 것(짐작으로 못 찾는 꼴이어도 같다)', () => {
  assert.deepEqual(코드of(rightWrongFindings(편({ 기획: false, 코드: 산호만 }))), [`${FIX}:right-wrong-row`]);
  assert.deepEqual(코드of(rightWrongFindings(편({ 기획: false, 코드: 표시없음 }))), [`${FIX}:right-wrong-row`]);
  assert.deepEqual(코드of(rightWrongFindings(편({ 기획: false }))), [`${FIX}:right-wrong-row`]);
  // HTML 엔티티로 적은 ❌는 글 검사가 못 찾지만, 기획.md가 없으니 그대로 막힌다
  const 엔티티 = 'export const A = () => <span>&#x274C; 반말</span>;\n';
  assert.equal(signOfCode(엔티티), null);
  assert.deepEqual(코드of(rightWrongFindings(편({ 기획: false, 코드: 엔티티 }))), [`${FIX}:right-wrong-row`]);
});

test('칸 값이 없음 · 있음으로 시작하지 않으면 고칠 것', () => {
  assert.deepEqual(코드of(rightWrongFindings(편({ 칸: '색으로 가름', 코드: 두색 }))), [`${FIX}:right-wrong-row`]);
});

test('굵게 쓴 값과 끝 막대가 없는 줄도 읽는다', () => {
  assert.deepEqual(rightWrongFindings(편({ 칸: '**있음** — 사장님께 반말', 코드: 두색 })), []);
  assert.deepEqual(rightWrongFindings(편({ 칸줄: '| 맞음틀림 | 있음(사진도 사자!)', 코드: 두색 })), []);
  assert.deepEqual(rightWrongFindings(편({ 칸줄: '| **맞음틀림** | 없음', 코드: 표시없음 })), []);
});

test('보지 않는 편 — LAB이 아니거나, 노래 · 퀴즈 틀이다(옛 날짜여도 같다)', () => {
  assert.ok(FROM > '20261119');
  assert.deepEqual(rightWrongFindings(편({ 브랜드: 'synkbrief', 코드: 산호만 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 'synkbrief_시험편_20261116', 브랜드: 'synkbrief', 코드: 산호만 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 'LAB_노래_가나다_20261120', 코드: 산호만 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 'LAB_퀴즈_관용구_mn_20261120', 코드: 산호만 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 'LAB_노래_가나다_20261111', 코드: 산호만 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 'LAB_퀴즈_관용구_mn_20261110', 코드: 산호만 })), []);
});

// ── 옛 편(편 폴더 날짜가 11-20 앞 · 이름에 날짜 없음) — 11-20 유호님 「네, 넓혀 줘」 ──
const 옛 = 'LAB_성함_mn_20261116';
// 옛 편의 방아쇠는 틀림 글자다 — 표시 값 쓰임(mark: 'ng')만 있는 「산호만」 · 「두색」은 옛 편에서 걸리지 않는다
const 글자코드 = "const CORAL = '#E8503D';\nconst rows = [{ ko: '눈치가 없다', mark: '✗' }];\n";
const 글자두색 = `const OK = '${OK}';\nconst NG = '${NG.toLowerCase()}';\nconst rows = [{ ko: '눈치가 없다', mark: '✗' }];\n`;

test('옛 편 — 칸이 없는데 틀림 글자가 적혀 있고 두 색이 없으면 고칠 것이고, 빠진 색과 「없음」 적는 길을 말한다', () => {
  const found = rightWrongFindings(편({ name: 옛, 코드: 글자코드 }));
  assert.deepEqual(코드of(found), [`${FIX}:right-wrong-old`]);
  assert.match(found[0].message, new RegExp(OK));
  assert.match(found[0].message, new RegExp(NG));
  assert.match(found[0].message, /맞음틀림 \| 없음/);
  const 초록만 = rightWrongFindings(편({ name: 옛, 코드: `const OK = '${OK}';\nconst rows = [{ ko: '야!', mark: '✗' }];\n` }));
  assert.deepEqual(코드of(초록만), [`${FIX}:right-wrong-old`]);
  assert.match(초록만[0].message, new RegExp(NG));
  assert.doesNotMatch(초록만[0].message, new RegExp(OK));
});

test('옛 편 — 기획.md가 없어도, 판본 글의 ❌뿐이어도, 이름에 날짜가 없어도 같은 고칠 것', () => {
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 옛, 기획: false, 코드: 글자코드 }))), [`${FIX}:right-wrong-old`]);
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 옛, 코드: 표시없음, 글: '{"pills": ["❌ нэр + «야»"]}' }))), [`${FIX}:right-wrong-old`]);
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 'LAB_날짜없는편', 코드: 글자코드 }))), [`${FIX}:right-wrong-old`]);
});

test('옛 편 — 틀림 글자가 적혀 있어도 두 색이 다 있으면 지나간다(칸을 적지 않아도 된다)', () => {
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 코드: 글자두색 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 기획: false, 코드: 글자두색 })), []);
});

test('옛 편 — 틀림 글자가 없으면 칸이 없어도, 기획.md가 없어도, 화면 코드가 없어도 지나간다', () => {
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 코드: 표시없음 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 기획: false, 코드: 표시없음 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 옛 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 기획: false })), []);
});

test('옛 편 — 두 색이 주석에만 있으면 고칠 것', () => {
  const 주석만 = `// 맞는 말 ${OK} · 틀린 말 ${NG}\nconst rows = [{ ko: '야!', mark: '✗' }];\n`;
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 옛, 코드: 주석만 }))), [`${FIX}:right-wrong-old`]);
});

test('옛 편 — 색을 쓴 파일이 너무 커서 못 읽었으면 고칠 것이 아니라 확인할 것', () => {
  const 큰 = `${두색}// ${'가'.repeat(MAX_BYTES)}\n`;
  const found = rightWrongFindings(편({ name: 옛, 코드: 큰, 더: { 'Root.tsx': 글자코드 } }));
  assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-old`]);
  assert.match(found[0].message, /Film\.tsx/);
});

test('옛 편 — 판본 글의 작업 메모 칸(_설명 · _원문 · _한도)에만 틀림 글자가 있으면 지나간다', () => {
  const 메모만 = JSON.stringify({ _설명: { level: '단계 알약 — 1 · 2 · 3 · ✓ · 0 ❌' }, _원문: { 'tags.6': '❌ 이름 + 「야」' }, 안: { _한도: '✗ 줄' }, tags: ['감사합니다'] });
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 코드: 표시없음, 글: 메모만 })), []);
  assert.equal(signOfJson(메모만), null);
});

test('옛 편 — 판본 글의 화면 값에 틀림 글자가 있으면(\\u274c 꼴로 적어도) 고칠 것', () => {
  const 풀어쓴 = '{"_설명": {"tags": "꼬리표"}, "tags": ["감사합니다", "\\u274c нэр + «야»"]}';
  assert.equal(풀어쓴.includes('❌'), false);
  assert.equal(signOfJson(풀어쓴), '❌');
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 옛, 코드: 표시없음, 글: 풀어쓴 }))), [`${FIX}:right-wrong-old`]);
});

test('옛 편 — 판본 글을 JSON으로 못 풀면 막지 않고 확인할 것', () => {
  assert.equal(signOfJson('{"tags": ["❌ 반말"'), undefined);
  const found = rightWrongFindings(편({ name: 옛, 코드: 표시없음, 글: '{"tags": ["❌ 반말"' }));
  assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-old`]);
  assert.match(found[0].message, /MN\.json/);
});

test('옛 편 — 표시 값 쓰임(mark: ng)과 형 선언은 방아쇠가 아니다(틀림 글자만 본다)', () => {
  const 형선언 = "const CORAL = '#E8503D';\nconst m: { mark: 'ng' | 'ok' } = { mark: 'ok' };\nexport const line = '감사합니다';\n";
  assert.equal(signOfCode(형선언), null);
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 코드: 형선언 })), []);
  const 하나뿐 = "type WrongMark = { mark: 'ng' };\nexport const label = '감사합니다';\n";
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 코드: 하나뿐 })), []);
  assert.equal(glyphOfCode(산호만), null);
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 코드: 산호만 })), []);
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 기획: false, 코드: 산호만 })), []);
});

// 역슬래시 u 꼴(유니코드 이스케이프) — 시험 글에는 역슬래시를 글자 번호로 짓는다(파일에 그 꼴을 그대로 적지 않으려고)
const 역 = String.fromCharCode(92);
const 역u = `${역}u274c`; // 역슬래시 하나 + u274c — 글자열 안에서는 ❌

test('코드에 역슬래시 u 꼴로 적은 글자는 어느 자리든 세지 않는다(계약의 놓치는 쪽) — 따옴표 문맥을 짐작하지 않는다', () => {
  const 꼴들 = [
    `const CORAL = '#E8503D';\nconst pill = '0 ${역u}';\n`, // 글자열 안
    'const t = `' + 역 + 'u{2717} 반말`;\n', // 백틱 · 중괄호 꼴
    `const label = '${역}u{0000274c}';\n`, // 앞에 0을 채운 중괄호 꼴
    `export const A = () => <span>Don't {'${역u} 반말'}</span>;\n`, // JSX 글의 홑따옴표 뒤 글자열
    `export const A = () => <span>"${역u}"</span>;\n`, // JSX 맨글의 따옴표 안
    `const label = "감사합니다".replace(/"${역u}"/g, "");\n`, // 정규식 안의 따옴표
    `const label = "감사합니다".replace(new RegExp("${역}${역u}", "g"), "");\n`, // 역슬래시를 적은 글
    `export const A = () => <span>${역u} 그대로 보이는 글</span>;\n`, // JSX 맨글
  ];
  for (const 코드 of 꼴들) {
    assert.equal(코드.includes('❌') || 코드.includes('✗'), false);
    assert.equal(glyphOfCode(코드), null, 코드);
    assert.equal(signOfCode(코드), null, 코드);
    assert.deepEqual(rightWrongFindings(편({ name: 옛, 코드 })), [], 코드);
  }
});

test('판본 글은 「판본」 폴더의 JSON만이다 — 그 밖의 JSON(설정 · 제작 메모)에 든 틀림 글자는 보지 않는다', () => {
  const 메모 = { 'film/build-notes.json': '{"todo": ["❌ 확인 전"]}', 'episode.json': '{"title": "✗ 임시"}' };
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 코드: 표시없음, 더: 메모 })), []);
  assert.deepEqual(rightWrongFindings(편({ 칸: '없음', 코드: 표시없음, 더: 메모 })), []);
  // 깨진 JSON이어도 판본 폴더 밖이면 못 읽은 것으로 세지 않는다
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 코드: 표시없음, 더: { 'film/build-notes.json': '{"todo": ["❌"' } })), []);
  // 판본 폴더 안이면 본다(편 도우미의 「글」은 film/판본/MN.json에 쓴다)
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 옛, 코드: 표시없음, 글: '{"tags": ["❌ 반말"]}' }))), [`${FIX}:right-wrong-old`]);
});

test('옛 편 — 못 읽은 파일이 하나라도 있으면(코드든 판본 글이든) 고칠 것 대신 확인할 것, 읽는 차례와 상관없다', () => {
  const 끝쉼표 = '{"tags": ["감사합니다",]}';
  assert.equal(signOfJson(끝쉼표), undefined);
  // 코드에 글자가 있고 두 색이 없는데 판본 글 하나를 못 풂
  const found = rightWrongFindings(편({ name: 옛, 코드: 글자코드, 글: 끝쉼표 }));
  assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-old`]);
  assert.match(found[0].message, /MN\.json/);
  // 글자가 판본 글에 있고, 다른 판본 글을 못 풂 — 어느 것이 먼저 읽혀도 같다
  for (const [앞, 뒤] of [['AA.json', 'ZZ.json'], ['ZZ.json', 'AA.json']]) {
    const b = 편({ name: 옛, 코드: 표시없음, 글: '{"tags": ["감사합니다"]}' });
    fs.writeFileSync(path.join(b.dir, 'remotion', 'src', 'film', '판본', 앞), '{"tags": ["❌ 반말"]}');
    fs.writeFileSync(path.join(b.dir, 'remotion', 'src', 'film', '판본', 뒤), 끝쉼표);
    assert.deepEqual(코드of(rightWrongFindings(b)), [`${LOOK}:right-wrong-old`], `${앞} → ${뒤}`);
  }
  // 다 읽히면 고칠 것
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 옛, 코드: 글자코드, 글: '{"tags": ["감사합니다"]}' }))), [`${FIX}:right-wrong-old`]);
});

test('「없음」인데 표시를 못 찾았어도 못 읽은 파일이 있으면 확인할 것 — 못 푼 판본 글의 틀림 글자(새 편 · 옛 편)', () => {
  const 깨진글 = '{"tags": ["❌ 반말",]}';
  for (const b of [편({ 칸: '없음', 코드: 표시없음, 글: 깨진글 }), 편({ name: 옛, 칸: '없음', 코드: 표시없음, 글: 깨진글 })]) {
    const found = rightWrongFindings(b);
    assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-sign`]);
    assert.match(found[0].message, /MN\.json/);
  }
});

test('「있음」인데 화면 코드 폴더를 못 읽으면 「코드가 없다」가 아니라 「못 읽었다」고 알린다', () => {
  const b = 편({ 칸: '있음(반말)', 코드: 두색 });
  assert.deepEqual(rightWrongFindings(b), []);
  const 뿌리 = path.join(b.dir, 'remotion', 'src');
  const 원래 = fs.readdirSync;
  fs.readdirSync = (at, ...rest) => {
    if (path.resolve(String(at)) === path.resolve(뿌리)) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    return 원래(at, ...rest);
  };
  try {
    const found = rightWrongFindings(b);
    assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-color`]);
    assert.match(found[0].message, /폴더 읽기 실패/);
    assert.doesNotMatch(found[0].message, /화면 코드가 없어/);
  } finally { fs.readdirSync = 원래; }
});

test('기획.md를 못 읽으면(없는 것이 아니라 읽기 실패) 막지 않고 확인할 것 — 새 편 · 옛 편', () => {
  const 새편 = 편({ 칸: '없음', 코드: 표시없음 });
  const 옛편 = 편({ name: 옛, 칸: '없음(✗는 뜻풀이 카드)', 코드: 글자코드 });
  const 원래 = fs.readFileSync;
  fs.readFileSync = (at, ...rest) => {
    if (path.basename(String(at)) === '기획.md') throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    return 원래(at, ...rest);
  };
  try {
    for (const b of [새편, 옛편]) {
      const found = rightWrongFindings(b);
      assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-error`]);
      assert.match(found[0].message, /EACCES/);
    }
  } finally { fs.readFileSync = 원래; }
  // 읽히면 새 편은 지나가고, 옛 편은 「없음」 칸 + 글자라 확인할 것
  assert.deepEqual(rightWrongFindings(새편), []);
  assert.deepEqual(코드of(rightWrongFindings(옛편)), [`${LOOK}:right-wrong-sign`]);
});

test('옛 편 — 틀림 표시가 든 파일을 못 읽었으면 지나가지 않고 확인할 것', () => {
  const 큰 = `${산호만}// ${'가'.repeat(MAX_BYTES)}\n`;
  const found = rightWrongFindings(편({ name: 옛, 코드: 큰, 더: { 'Root.tsx': 표시없음 } }));
  assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-old`]);
  assert.match(found[0].message, /Film\.tsx/);
});

test('아래 폴더를 못 읽으면 색이 없다고 막지 않고 확인할 것(옛 편 · 새 편)', () => {
  const 옛편 = 편({ name: 옛, 코드: 글자코드 });
  const 새편 = 편({ 칸: '있음(반말)', 코드: 산호만 });
  for (const b of [옛편, 새편]) {
    fs.mkdirSync(path.join(b.dir, 'remotion', 'src', 'theme'));
    fs.writeFileSync(path.join(b.dir, 'remotion', 'src', 'theme', 'colors.ts'), 두색);
  }
  // 색을 다 읽으면 둘 다 지나간다
  assert.deepEqual(rightWrongFindings(옛편), []);
  assert.deepEqual(rightWrongFindings(새편), []);
  const 원래 = fs.readdirSync;
  fs.readdirSync = (at, ...rest) => {
    if (path.basename(String(at)) === 'theme') throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    return 원래(at, ...rest);
  };
  try {
    const 옛결과 = rightWrongFindings(옛편);
    assert.deepEqual(코드of(옛결과), [`${LOOK}:right-wrong-old`]);
    assert.match(옛결과[0].message, /theme/);
    assert.deepEqual(코드of(rightWrongFindings(새편)), [`${LOOK}:right-wrong-color`]);
  } finally { fs.readdirSync = 원래; }
});

test('옛 편 — 칸을 적었으면 새 편과 똑같이 본다', () => {
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 옛, 칸: '없음(✗는 틀린 뜻풀이 카드)', 코드: 산호만 }))), [`${LOOK}:right-wrong-sign`]);
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 칸: '없음', 코드: 표시없음 })), []);
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 옛, 칸: '있음(반말)', 코드: 산호만 }))), [`${FIX}:right-wrong-color`]);
  assert.deepEqual(rightWrongFindings(편({ name: 옛, 칸: '있음(반말)', 코드: 두색 })), []);
  assert.deepEqual(코드of(rightWrongFindings(편({ name: 옛, 칸: '색으로 가름', 코드: 두색 }))), [`${FIX}:right-wrong-row`]);
});

test('검사하다 오류가 나도 던지지 않고 확인할 것으로 남긴다', () => {
  const found = rightWrongFindings({ name: 'LAB_시험편_mn_20261120', dir: null, prep: { 브랜드: 'LAB' } });
  assert.deepEqual(코드of(found), [`${LOOK}:right-wrong-error`]);
});

test('틀림 표시 찾기 — 글자와 mark 값 쓰임을 센다(주석 · 낱말 wrong · 역슬래시 u 꼴은 세지 않는다)', () => {
  assert.equal(signOfCode("const line = \"What's wrong?\"; const n = text.length;"), null);
  assert.equal(signOfCode("type Mark = 'ok' | 'ng';\nconst m: { mark?: 'ok' | 'ng' } = {};"), null);
  assert.equal(signOfCode('// 여동생의 「형!」에 빨간 ✗ — 틀린 말\nconst a = 1;'), null);
  assert.equal(signOfCode("{ ko: '자, 사!', mark: 'ng' }"), "mark: 'ng'");
  assert.equal(signOfCode('<Bubble mark="ng" />'), 'mark="ng"');
  assert.equal(signOfCode("<span>{levelText(L, 0)} ❌</span>"), '❌');
  assert.equal(signOfCode("const m: { mark: 'ng' | 'ok' } = { mark: 'ok' };"), null);
  assert.equal(signOfCode("const m: { mark: 'ng' | 'ok' } = { mark: 'ng' };"), "mark: 'ng'");
  assert.equal(glyphOfCode("{ ko: '자, 사!', mark: 'ng' }"), null);
  assert.equal(glyphOfCode("<span>{levelText(L, 0)} ❌</span>"), '❌');
  assert.equal(glyphOfCode('// 여동생의 「형!」에 빨간 ✗ — 틀린 말\nconst a = 1;'), null);
  assert.equal(signOfText('{"pills": ["✕ 반말"]}'), '✕');
  assert.equal(signOfJson('{"pills": ["✕ 반말"]}'), '✕');
  assert.equal(signOfJson(String.fromCharCode(0xFEFF) + '{"a": {"b": ["감사합니다"]}}'), null);
});

test('도우미 — 칸표 읽기 · 주석 빼기 · 색 꼴 맞추기', () => {
  const rows = planRows('| 칸 | 값 |\n|---|---|\n| **꼴** | 한 가지 |\n| 맞음틀림 | 있음 | 덧붙임 |\n| 맞음틀림 | 없음 |\n');
  assert.equal(rows.get('꼴'), '한 가지');
  assert.equal(rows.get('맞음틀림'), '있음 | 덧붙임');
  assert.equal(stripComments("const u = 'http://a/b'; // 주석\n/* 덩이 */ const v = 1;").includes('주석'), false);
  assert.equal(stripComments("const u = 'http://a/b'; // 주석").includes('http://a/b'), true);
  assert.equal(normalColors('RGB(10, 154, 102) #0A9A66'), '#0a9a66 #0a9a66');
});
