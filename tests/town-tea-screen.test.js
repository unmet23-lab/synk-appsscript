'use strict';
// 싱크타운 찻집 주문 판의 화면 쪽 순수 함수(세로 조각 W8, 설계 §11-4·§22): 손님을 서 있는 자리로 부르고(숫자 없음, 검토 F8),
// 판의 잔을 한 줄로 읽어 주고(낭독), 「천천히」는 어절 둘씩, 「다시 말해 주세요」는 축 낱말에 밑줄, 장면에는 기다리는 손님과
// 앉은 손님을 생김새 하나에 한 몸씩만(검토 F2). 화면 글에 숫자·시간 말이 없다(G2). DOM은 qa-tea-ui.cjs가 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const load = file => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', file)).href);
const NUMBERS = /[0-9０-９]|번째|일째|연속|시간|분 /;

test('손님은 서 있는 자리로 부른다 — 앞 손님 · 뒤 손님 · 단골손님 · 연구원, 숫자 없이(검토 F8)', async () => {
  const { guestName } = await load('day-tea.mjs');
  const order = { kind: 'order' };
  assert.deepEqual([guestName(order, { slot: 'a', regular: false }), guestName(order, { slot: 'b', regular: false }), guestName(order, { slot: 'a', regular: true }), guestName({ kind: 'one-cup' }, { slot: 'r' })],
    ['앞 손님', '뒤 손님', '단골손님', '연구원']);
});

test('판의 잔을 한 줄로 — 잔·차·꿀(숟가락)을 이름으로 읽고 숫자를 쓰지 않는다', async () => {
  const { boardWords, cupWords } = await load('day-tea.mjs');
  assert.equal(boardWords({ vessel: null, tea: null, honey: 0 }), '빈 판이에요');
  assert.equal(boardWords({ vessel: 'warm', tea: 'yuzu', honey: 1 }), '따뜻한 잔에 유자차, 꿀 한 숟가락');
  assert.equal(boardWords({ vessel: null, tea: 'barley', honey: 0 }), '잔 없이, 보리차, 꿀 없이');
  assert.equal(cupWords({ vessel: 'cold', tea: 'today', honey: 2 }), '차가운 오늘의 차 · 꿀 두 숟가락');
  for (const vessel of ['warm', 'cold']) for (const tea of ['barley', 'yuzu', 'today']) for (const honey of [0, 1, 2])
    assert.doesNotMatch(boardWords({ vessel, tea, honey }) + cupWords({ vessel, tea, honey }), NUMBERS);
});

test('「천천히 말해 주세요」는 어절 둘씩, 「다시 말해 주세요」는 축 낱말에 밑줄 — 원고의 모든 요청 틀에서', async () => {
  const { chunks, marked } = await load('day-tea.mjs'), { lineWords, TEA_LINES } = await load('town/activities/tea-order.mjs');
  assert.deepEqual(chunks('손이 차가우니까 따뜻한 보리차 주세요.'), ['손이 차가우니까', '따뜻한 보리차', '주세요.']);
  assert.deepEqual(marked('손이 차가우니까 따뜻한 보리차 주세요.').filter(p => p.key).map(p => p.text), ['따뜻한', '보리차']);
  for (const line of TEA_LINES.filter(l => l.when.part === 'request')) for (const level of ['L1', 'L2', 'L3', 'L4']) {
    const values = { tea: line.when.fixed?.tea ?? 'yuzu', temp: line.when.fixed?.temp ?? 'warm', sweet: line.when.fixed?.sweet ?? 1 }, words = lineWords(line.id, level, values);
    assert.ok(words && !/[{}]/.test(words), `${line.id} ${level} 빈칸이 다 채워진다`);
    assert.equal(chunks(words).join(' '), words.replace(/\s+/g, ' ').trim(), `${line.id} ${level} 묶음을 이으면 원래 글`);
    assert.equal(marked(words).map(p => p.text).join(''), words, `${line.id} ${level} 밑줄을 걷으면 원래 글`);
    assert.ok(marked(words).some(p => p.key) || !line.when.axes.length, `${line.id} ${level} 축 낱말이 하나는 밑줄`);
  }
});

test('장면의 손님 — 기다리는 둘은 서는 자리에, 앉은 손님은 그 자리에, 생김새 하나에 한 몸씩(검토 F2)', async () => {
  const { teaGuests } = await load('day-tea.mjs'), { SPOT_BY_ID } = await load('town/places.mjs');
  const open = { kind: 'order', guests: [{ slot: 'a', who: 'visitor-tea-reader', done: null }, { slot: 'b', who: 'book-guest', done: null }] };
  const seated = [{ who: 'book-guest', spot: 'cafe.garden' }, { who: 'companion', spot: 'cafe.eaves-left' }];
  const drawn = teaGuests({ open, seated });
  assert.deepEqual(drawn.map(g => g.id).sort(), ['book-guest', 'companion', 'visitor-tea-reader'], '앉은 책 손님은 기다리는 책 손님에게 몸을 내준다');
  const companion = drawn.find(g => g.id === 'companion');
  assert.deepEqual([companion.x, companion.z], [SPOT_BY_ID['cafe.eaves-left'].at.x, SPOT_BY_ID['cafe.eaves-left'].at.z]);
  assert.deepEqual(teaGuests({ open: null, seated: [] }), []);
  assert.deepEqual(teaGuests(null), []);
  // The one-cup board has no guests at the cafe (the researcher stays where the plan has her).
  assert.deepEqual(teaGuests({ open: { kind: 'one-cup', guests: [{ slot: 'r', who: 'researcher', done: null }] }, seated: [] }), []);
});
