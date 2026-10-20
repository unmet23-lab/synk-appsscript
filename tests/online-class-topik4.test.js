'use strict';
// TOPIK 4급 온라인 반 자료(docs/온라인반_TOPIK4급)의 검산: 쓰기 예시답의 글자 수와 분량, 읽기 문항의 보기·정답,
// 차시표가 가리키는 과제·문항이 실제로 있는지. 글자 수는 NFC 정규화 뒤 공백·문장부호를 넣고 줄바꿈을 뺀 Unicode 문자 수다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'docs', '온라인반_TOPIK4급');
const read = name => fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n');
const count = text => [...text.normalize('NFC').replace(/\n/g, '')].length;

// 「**…예시답 — 본문 N자**」 바로 뒤 인용 묶음이 예시답이다. 분량은 그 앞에서 마지막으로 나온 「a~b자」.
function modelAnswers(md) {
  const lines = md.split('\n'), found = [];
  let range = null, section = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const anchor = line.match(/^<a id="(w\d)"><\/a>$/);
    if (anchor) section = anchor[1];
    if (!line.startsWith('>')) for (const m of line.matchAll(/(\d+)~(\d+)자/g)) range = [Number(m[1]), Number(m[2])];
    const head = line.match(/^\*\*(?:서론 )?예시답 — 본문 (\d+)자\*\*$/);
    if (!head) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    const body = [];
    for (; j < lines.length && lines[j].startsWith('>'); j++) body.push(lines[j].replace(/^> ?/, ''));
    found.push({ section, line: i + 1, stated: Number(head[1]), range, text: body.join('\n') });
  }
  return found;
}

function readingItems(md) {
  const parts = md.split(/\n(?=### R\d-\d)/).slice(1);
  return parts.map(part => {
    const id = part.match(/^### (R\d-\d)/)[1];
    const answerAt = part.indexOf('**정답:**');
    const before = answerAt < 0 ? part : part.slice(0, answerAt);
    const answer = (part.match(/\*\*정답:\*\*\s*([①②③④])\s*$/m) || [])[1];
    const optionLines = before.split('\n').filter(l => /^[①②③④]/.test(l.trim()));
    const marks = optionLines.join(' ').match(/[①②③④]/g) || [];
    return { id, answer, marks, hasAnchor: md.includes(`<a id="${id.toLowerCase()}"></a>`) };
  });
}

test('쓰기 예시답의 글자 수가 적어 둔 값과 같고 문제의 분량 안에 든다', () => {
  const answers = modelAnswers(read('쓰기과제.md'));
  assert.ok(answers.length >= 6, `예시답이 ${answers.length}개뿐이다`);
  for (const a of answers) {
    const n = count(a.text);
    assert.equal(a.stated, n, `${a.section} ${a.line}행: 적어 둔 ${a.stated}자, 실제 ${n}자`);
    assert.ok(a.range, `${a.section} ${a.line}행: 앞에 분량(a~b자)이 없다`);
    assert.ok(n >= a.range[0] && n <= a.range[1], `${a.section} ${a.line}행: ${n}자가 ${a.range.join('~')}자 밖이다`);
  }
  const sections = new Set(answers.map(a => a.section));
  for (const s of ['w3', 'w4', 'w5', 'w6', 'w7']) assert.ok(sections.has(s), `${s}에 글자 수를 잰 예시답이 없다`);
});

test('쓰기 과제 여덟 개와 53번 자료의 합이 맞다', () => {
  const md = read('쓰기과제.md');
  for (let w = 1; w <= 8; w++) assert.ok(md.includes(`<a id="w${w}"></a>`), `W${w} 자리표가 없다`);
  // W3 질문 2의 비율 합, W3 질문 1의 두 해 합.
  assert.equal(52 + 27 + 15 + 6, 100);
  assert.match(md, /\| 예 \| 48% \| 63% \|\n\| 아니요 \| 52% \| 37% \|/);
  assert.match(md, /2026년, 「예」라고 답한 252명/);
  assert.equal(Math.round(400 * 0.63), 252);
});

test('읽기 연습은 40문항이고 문항마다 보기 넷·정답 하나·자리표가 있다', () => {
  const md = read('읽기연습.md');
  const items = readingItems(md);
  assert.equal(items.length, 40, `문항이 ${items.length}개다`);
  const ids = new Set();
  for (const it of items) {
    assert.ok(!ids.has(it.id), `${it.id}가 두 번 나온다`);
    ids.add(it.id);
    assert.ok(it.hasAnchor, `${it.id} 자리표가 없다`);
    assert.ok(it.answer, `${it.id} 정답 줄이 없다`);
    assert.deepEqual([...it.marks].sort(), ['①', '②', '③', '④'], `${it.id} 보기 번호: ${it.marks.join('')}`);
  }
  for (let w = 1; w <= 8; w++) assert.equal(items.filter(it => it.id.startsWith(`R${w}-`)).length, 5, `R${w}이 다섯 문항이 아니다`);
  const spread = {};
  for (const it of items) spread[it.answer] = (spread[it.answer] || 0) + 1;
  for (const mark of ['①', '②', '③', '④']) assert.ok((spread[mark] || 0) >= 6 && (spread[mark] || 0) <= 14, `정답 ${mark}가 ${spread[mark] || 0}번이다`);
});

test('차시표와 첨삭 기준이 가리키는 과제·문항·문서가 있다', () => {
  const readme = read('README.md');
  const writing = read('쓰기과제.md'), reading = read('읽기연습.md');
  for (const m of readme.matchAll(/쓰기과제\.md#(w\d)/g)) assert.ok(writing.includes(`<a id="${m[1]}"></a>`), `README가 없는 ${m[1]}을 가리킨다`);
  for (const m of readme.matchAll(/읽기연습\.md#(r\d-\d|r\d)/g)) assert.ok(reading.includes(`<a id="${m[1]}"></a>`), `README가 없는 ${m[1]}을 가리킨다`);
  for (const name of ['쓰기과제.md', '읽기연습.md', '첨삭기준.md']) assert.ok(readme.includes(`(${name}`), `README에 ${name} 연결이 없다`);
  const guide = read('첨삭기준.md');
  for (const code of ['〔체〕', '〔조〕', '〔낱〕', '〔자〕', '〔어〕', '〔연〕', '〔빠〕', '〔띄〕']) {
    assert.ok(guide.includes(code), `첨삭 기준에 ${code} 기호 설명이 없다`);
  }
  // 쓰기 과제의 첨삭 시범이 쓰는 기호는 모두 첨삭 기준에 있다.
  for (const m of writing.matchAll(/〔[^〕]+〕/g)) assert.ok(guide.includes(m[0]), `${m[0]}이 첨삭 기준에 없다`);
});
