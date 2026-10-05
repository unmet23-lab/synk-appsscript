'use strict';
// tools/교원검수시트.js: one sheet for teacher review, made from the sources (the eight games' items
// and story text, the situation examples, the game↔situation draft, the grammar→ability draft), and
// read back against the sources as they are when the reviewed sheet returns.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildRows, toCsv, parseCsv, review, applyConfirmedExamples, COLUMNS, KINDS, SHEET } = require('../tools/교원검수시트.js');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');
const { situationExamples } = require('../strata/topik-i-examples');

const rowsPromise = buildRows();
const count = (rows, kind) => rows.filter(row => row.갈래 === kind).length;

test('the sheet lists every kind of thing a teacher reviews, each row once under a stable number', async () => {
  const rows = await rowsPromise;
  assert.equal(new Set(rows.map(row => row.번호)).size, rows.length);
  assert.deepEqual([...new Set(rows.map(row => row.갈래))], KINDS);
  assert.equal(count(rows, '상황 예문'), 78);
  assert.equal(count(rows, '문형→능력'), 87);
  assert.equal(count(rows, '게임↔상황'), 8, 'seven WORLD games, the runner in two situations');
  for (const game of ['blank-slice', 'entry-check', 'story-classroom', 'order-rush', 'korean-runner', 'korean-rhythm', 'korean-racing', 'talk-rally']) {
    assert.ok(rows.some(row => row.번호.startsWith(`문항/${game}/`)), game);
  }
  assert.ok(rows.every(row => row.내용 && row.자리 && !/[\r\n]/.test(Object.values(row).join(''))), 'no empty or multi-line cell');
  const order = rows.find(row => row.번호 === '예문/ex-travel-order-2');
  assert.deepEqual([order.자리, order.내용, order['정답·보기'], order['읽힌 문형']], ['한국 여행 · 주문 — 주문할 때 쓰는 말', '설탕은 빼 주세요.', '게임 문항 글 그대로(order-rush/o03)', '-아/어 주세요']);
  assert.equal(rows.find(row => row.번호 === '문항/blank-slice/p01').내용, '저는 아침에 빵[을] 먹어요.');
  assert.equal(rows.find(row => row.번호 === '게임상황/order-rush/sit-travel-order').내용, '주문 폭주의 연습 = 「주문」 — 주문할 때 쓰는 말 (한국 여행)');
});

test('the sheet is a CSV a spreadsheet opens, and reads back cell for cell', async () => {
  const rows = await rowsPromise, csv = toCsv(rows);
  assert.ok(csv.startsWith('﻿"번호","갈래"'), 'UTF-8 with a byte order mark for Excel');
  const back = parseCsv(csv);
  assert.equal(back.length, rows.length);
  for (const [i, row] of rows.entries()) for (const column of COLUMNS) assert.equal(back[i][column], row[column] ?? '', `${row.번호} ${column}`);
  const tricky = parseCsv(toCsv([{ 번호: 'x', 갈래: '게임 문항', 자리: '가, 나', 내용: '“네”라고 "말해요", 그리고', 확인: '' }]));
  assert.equal(tricky[0].내용, '“네”라고 "말해요", 그리고');
  assert.equal(tricky[0].자리, '가, 나');
  assert.throws(() => parseCsv('"이름","값"\n"a","b"'), /머리 줄/);
});

test('the sheet in the repository is the blank form, in the same columns', () => {
  const committed = parseCsv(fs.readFileSync(path.join(__dirname, '..', SHEET), 'utf8'));
  assert.ok(committed.length > 400);
  assert.deepEqual(Object.keys(committed[0]), COLUMNS);
  assert.ok(committed.every(row => !row.확인 && !row['고친 내용'] && !row.검수자), 'nothing is marked before a teacher has it');
});

test('a reviewed sheet is counted against the sources as they are now', async () => {
  const rows = await rowsPromise;
  const reviewed = rows.map(row => ({ ...row, 확인: '', '고친 내용': '', 메모: '' }));
  const mark = (id, values) => Object.assign(reviewed.find(row => row.번호 === id), values);
  mark('예문/ex-travel-order-1', { 확인: '맞음' });
  mark('예문/ex-people-greeting-2', { 확인: 'O' });
  mark('예문/ex-culture-emotion-1', { 확인: '고침', '고친 내용': '정말 좋아요!', 메모: '너무는 부정적인 느낌' });
  mark('문항/order-rush/o07', { 확인: '빼기', 메모: '초급에 어려움' });
  mark('문항/blank-slice/p02', { 확인: '맞음', 내용: '옛 문장이에요.' });
  mark('문형능력/G209', { 확인: '글쎄요' });
  reviewed.push({ 번호: '', 갈래: '상황 예문', 자리: '한국 여행 · 쇼핑', 내용: '영수증 주세요.', 확인: '' });
  reviewed.push({ 번호: '문항/nowhere/x1', 갈래: '게임 문항', 내용: '없는 줄', 확인: '맞음' });
  const report = review(reviewed, rows);
  assert.deepEqual(report.counts['상황 예문'], { 모두: 78, 맞음: 2, 고침: 1, 빼기: 0, 아직: 75 });
  assert.equal(report.counts['게임 문항'].빼기, 1);
  assert.deepEqual(report.confirmedExamples, ['ex-travel-order-1', 'ex-people-greeting-2']);
  assert.deepEqual(report.fixes, [{ 번호: '예문/ex-culture-emotion-1', 지금: '너무 좋아요!', 고친: '정말 좋아요!', 메모: '너무는 부정적인 느낌' }]);
  assert.deepEqual(report.drops.map(d => d.번호), ['문항/order-rush/o07']);
  assert.deepEqual(report.added.map(a => a.내용), ['영수증 주세요.']);
  assert.deepEqual(report.changed.map(c => c.번호), ['문항/blank-slice/p02'], 'a verdict on words the source no longer has is not counted');
  assert.deepEqual(report.unclear, [{ 번호: '문형능력/G209', 확인: '글쎄요' }]);
  assert.deepEqual(report.unknown, ['문항/nowhere/x1']);
});

test('confirmed examples are written into the example layer in its own order, and nothing else moves', () => {
  const source = path.join(__dirname, '..', 'strata/topik-i.situation-examples.json');
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'review-sheet-')), 'examples.json');
  fs.copyFileSync(source, copy);
  assert.deepEqual(applyConfirmedExamples(['ex-people-greeting-2', 'ex-travel-order-1'], copy), { reviewed: 2, added: 2 });
  const before = fs.readFileSync(source, 'utf8').split(/\r?\n/), after = fs.readFileSync(copy, 'utf8').split(/\r?\n/);
  assert.equal(after.length, before.length);
  assert.deepEqual(after.filter((line, i) => line !== before[i]), ['  "review": { "confidence": "ai_draft", "reviewed": ["ex-travel-order-1", "ex-people-greeting-2"] },']);
  const layer = situationExamples(createMap(topikMap({ includeWords: false })), { data: JSON.parse(fs.readFileSync(copy, 'utf8')) });
  assert.deepEqual(layer.examplesFor('sit-travel-order').map(e => e.reviewed), [true, false, false]);
  assert.deepEqual(applyConfirmedExamples(['ex-travel-order-1'], copy), { reviewed: 2, added: 0 }, 'confirming again changes nothing');
  assert.throws(() => applyConfirmedExamples(['ex-nowhere-1'], copy), /예문이 아닌 번호/);
  fs.rmSync(path.dirname(copy), { recursive: true, force: true });
});
