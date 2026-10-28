'use strict';
// W9 끝 기준 「town-adapter」(세로 §13, 다리 §3·§4-3·§10): 들어오는 쪽(어느 판으로 보일까)과 나가는 쪽(찻집 학습 사실)이
// 다리 설계 값과 같은지. 어댑터는 한 파일이 아니라 town/language-ladder.mjs · dialogue.mjs · tea-order.mjs의 학습 사실 ·
// talk lib/town-learning.js로 나뉜다(결정 10-28 W9 판단). Atlas가 쓴 시험 셋도 여기서 루트 안전 CI에 든다.
require('../experiences/synk-town/language-ladder.test.mjs');
require('../experiences/synk-town/tea-learning.test.mjs');
require('../experiences/synk-town/tea-review.test.mjs');
const test = require('node:test'), assert = require('node:assert/strict');
const load = file => import(`../experiences/synk-town/${file}`);
const DAY = 86400000;
const scene = { versions: ['L1', 'L2', 'L3', 'L4'] };

test('다리 §3-1·§3-2 — 사다리 넷, L1 판 난도 1·L2~L4 판 난도 2, 규칙 이름 town-ladder-r1', async () => {
  const l = await load('town/language-ladder.mjs');
  assert.deepEqual([...l.LEVELS], ['L1', 'L2', 'L3', 'L4']); assert.deepEqual([...l.CHANNELS], ['reading', 'listening']);
  assert.equal(l.RULE, 'town-ladder-r1');
  assert.deepEqual(['L1', 'L2', 'L3', 'L4'].map(l.basicReadingDifficulty), [1, 2, 2, 2], '찻집 주문은 TOPIK I 안에서만');
  assert.equal(l.lowerLevel('L1'), 'L1', 'L1 아래로는 없다');
});

test('다리 §3-3 — 내린 장면 둘이면 한 단계 내림(알림 없음), 막힘 없는 장면 다섯이면 제안만, 같은 자리끼리만 센다', async () => {
  const l = await load('town/language-ladder.mjs');
  let ladder = l.initialLadder({ reading: 'L3', listening: 'L2' }, 1);
  ladder = l.closeScene({ ladder, channel: 'reading', level: 'L3', outcome: 'eased', now: 2 });
  ladder = l.closeScene({ ladder, channel: 'listening', level: 'L2', outcome: 'smooth', now: 3 });
  assert.equal(ladder.reading.easedStreak, 1, '다른 자리 장면은 이 자리 이어짐을 건드리지 않는다');
  ladder = l.closeScene({ ladder, channel: 'reading', level: 'L3', outcome: 'eased', now: 4 });
  assert.deepEqual([ladder.reading.stable, ladder.reading.source, ladder.reading.easedStreak, ladder.reading.smoothStreak], ['L2', 'eased', 0, 0]);
  for (let n = 0; n < 4; n++) ladder = l.closeScene({ ladder, channel: 'reading', level: 'L2', outcome: 'smooth', now: 10 + n });
  assert.equal(l.pickSceneLevel({ ladder, scene, now: 20 }).offer, null, '넷은 아직');
  ladder = l.closeScene({ ladder, channel: 'reading', level: 'L2', outcome: 'smooth', now: 20 });
  assert.deepEqual(l.pickSceneLevel({ ladder, scene, now: 30 }).offer, { to: 'L3', basis: 'town' });
  assert.equal(l.pickSceneLevel({ ladder, scene, now: 30 }).level, 'L2', '제안은 수준을 바꾸지 않는다');
  ladder = l.closeScene({ ladder, channel: 'reading', level: 'L2', outcome: 'helped-once', now: 40 });
  assert.deepEqual([ladder.reading.smoothStreak, ladder.reading.easedStreak], [0, 0], '도움 한 번이면 둘 다 0');
});

test('다리 §3-3 — 묻지 않는 때: 고정 · 늘 쉬운 말로 · 낮은 컨디션 · 그날 이미 물음 · 거절 7일 · L4', async () => {
  const l = await load('town/language-ladder.mjs');
  let ladder = l.initialLadder({ reading: 'L2', listening: 'L1' }, 0);
  for (let n = 0; n < 5; n++) ladder = l.closeScene({ ladder, channel: 'reading', level: 'L2', outcome: 'smooth', now: 1 + n });
  const now = 3 * DAY;
  assert.ok(l.pickSceneLevel({ ladder, scene, now }).offer);
  assert.equal(l.pickSceneLevel({ ladder, scene, now, settings: { easyLanguage: true } }).level, 'L1');
  assert.equal(l.pickSceneLevel({ ladder, scene, now, settings: { easyLanguage: true } }).offer, null);
  assert.equal(l.pickSceneLevel({ ladder, scene, now, today: { condition: 'tired' } }).offer, null);
  // core.mjs LANGUAGE_OFFER처럼 제안 때의 근거 수(이 자리 장면 수 + 학습 요약 판)를 함께 남긴다.
  const asked = l.markOffer(ladder, 'reading', now, ladder.reading.evidence, 7);
  assert.equal(l.pickSceneLevel({ ladder: asked, scene, now: now + 1000, day: 7 }).offer, null, '그날은 한 번');
  const declined = l.answerOffer(asked, 'reading', 'declined', now + 1000);
  assert.equal(l.pickSceneLevel({ ladder: declined, scene, now: now + 6 * DAY, day: 13 }).offer, null, '거절 7일 안');
  assert.equal(l.pickSceneLevel({ ladder: declined, scene, now: now + 8 * DAY, day: 15 }).offer, null, '7일이 지나도 새 근거가 없으면');
  const later = l.closeScene({ ladder: declined, channel: 'reading', level: 'L2', outcome: 'smooth', now: now + 8 * DAY });
  assert.deepEqual(l.pickSceneLevel({ ladder: later, scene, now: now + 8 * DAY + 1, day: 15 }).offer, { to: 'L3', basis: 'town' }, '7일 뒤 새 근거');
  const fixed = l.chooseLevel(ladder, 'reading', 'broader', now);
  assert.deepEqual([fixed.reading.stable, fixed.reading.fixed, fixed.reading.source], ['L3', true, 'self']);
  assert.equal(l.pickSceneLevel({ ladder: fixed, scene, now }).offer, null);
  const top = l.chooseLevel(l.chooseLevel(fixed, 'reading', 'broader', now), 'reading', 'auto', now);
  assert.equal(top.reading.stable, 'L4'); assert.equal(l.pickSceneLevel({ ladder: top, scene, now }).offer, null, '이미 L4');
});

test('다리 §3-3 (가) — 메인 근거는 기록이 다 읽혔을 때만, 같은 응답 꼴, 찻집 주문 꼴은 L3부터 쓰지 않는다', async () => {
  const l = await load('town/language-ladder.mjs');
  const cell = status => ({ formats: { 'cup-compose': { status }, 'single-choice': { status } } });
  const summary = (complete, ids) => ({ evidenceComplete: complete, skills: ids.map(id => ({ id, levels: { 1: cell('recent-independent'), 2: cell('recent-independent') } })) });
  assert.equal(l.mainEvidence(summary(true, ['ko.reading.detail', 'ko.reading.main']), { channel: 'reading', level: 'L2', responseFormat: 'cup-compose' }), true);
  assert.equal(l.mainEvidence(summary(false, ['ko.reading.detail', 'ko.reading.main']), { channel: 'reading', level: 'L2', responseFormat: 'cup-compose' }), false);
  assert.equal(l.mainEvidence(summary(true, ['ko2.reading.detail', 'ko2.reading.main']), { channel: 'reading', level: 'L3', responseFormat: 'cup-compose' }), false);
  assert.equal(l.mainEvidence(summary(true, ['ko2.reading.detail', 'ko2.reading.main']), { channel: 'reading', level: 'L3', responseFormat: 'single-choice' }), true);
  assert.equal(l.mainEvidence(summary(true, ['ko.listening.detail', 'ko.listening.main']), { channel: 'reading', level: 'L2', responseFormat: 'cup-compose' }), false, '다른 자리');
});

test('다리 §10-2 — 두 기기는 자리마다 나중 시각, 같은 시각이면 낮은 쪽', async () => {
  const l = await load('town/language-ladder.mjs');
  const a = l.chooseLevel(l.initialLadder({ reading: 'L2', listening: 'L2' }, 0), 'reading', 'broader', 10);
  const b = l.chooseLevel(l.initialLadder({ reading: 'L2', listening: 'L2' }, 0), 'listening', 'easier', 20);
  const merged = l.mergeLadders(a, b);
  assert.equal(merged.reading.stable, 'L3'); assert.equal(merged.listening.stable, 'L1');
  const same = l.mergeLadders(l.chooseLevel(a, 'reading', 'auto', 30), l.chooseLevel(a, 'reading', 'easier', 30));
  assert.equal(same.reading.stable, 'L2');
});

test('세로 §13-2 — 찻집 itemKey 꼴은 운영 원장 그대로이고 요청 칸은 늘 tea · temp · sweet 차례다', async () => {
  const tea = await load('town/activities/tea-order.mjs');
  assert.equal(tea.itemKeyOf('guest.tea.req-warm-tea.1', { tea: 'today', temp: 'warm' }), 'synk-town.tea.guest.tea.req-warm-tea.1...tea...today...temp...warm..');
  // 키의 칸 차례는 틀의 when.axes 선언(requestOf)을 따른다 — 열두 틀 모두 tea · temp · sweet 차례로 선언됐는지(Fable 설계 검토 14).
  const frames = tea.TEA_LINES.filter(line => line.when?.part === 'request');
  assert.equal(frames.length, 12);
  for (const f of frames) assert.deepEqual(f.when.axes, ['tea', 'temp', 'sweet'].filter(k => f.when.axes.includes(k)), f.id);
  for (const level of ['L1', 'L2', 'L3', 'L4']) for (let d = 0; d < 40; d++) for (const newTea of [null, { sweet: 1 }]) {
    for (const g of tea.orderGuests(tea.initial(), { villageSeed: `k${d}`, lifeDay: 20749 + d, band: 'day', level, newTea }).guests) {
      const keys = Object.keys(g.request);
      assert.deepEqual(keys, ['tea', 'temp', 'sweet'].filter(k => keys.includes(k)), `${g.frame} ${keys}`);
    }
  }
});

test('세로 §20-4 — 평가 줄은 되묻기 셋을 종류별로 세고(다시 열기는 빼고) 넓히기 제안에 한 답을 남긴다', async () => {
  const ev = await load('town/eval.mjs');
  const world = (lastOffer = null) => ({ townVisit: { lifeDay: 20749, band: 'day' }, policy: { visitId: 'V-1', paramsVer: 'town-params-1', arm: 'adapted' },
    life: { uMs: 60000, visitStartU: 0 }, languageLadder: { rule: 'town-ladder-r1', reading: { lastOffer }, listening: { lastOffer: null } } });
  let line = null;
  const step = (command, before = world(), after = before) => { line = ev.visitSummary(line, { before, after, command }); return line; };
  step({ type: 'CARD_HELP', payload: { kind: 'meaning' } });
  step({ type: 'TEA_HELP', payload: { kind: 'reopen' } });
  step({ type: 'TEA_HELP', payload: { kind: 'repeat' } });
  step({ type: 'TEA_CLOSE', payload: { asks: { repeat: 0, slower: 2, meaning: 0, reopen: 3 } } });
  assert.deepEqual(line.help, { meaning: 1, repeat: 1, slower: 2 });
  assert.equal(line.ladderOffer, undefined, '제안이 없던 방문에는 칸이 없다');
  const offered = { at: 5, answer: null, evidence: 5 };
  step({ type: 'LANGUAGE_OFFER', payload: { channel: 'reading' } }, world(), world(offered));
  assert.equal(line.ladderOffer, 'none');
  step({ type: 'LANGUAGE_ANSWER', payload: { channel: 'reading', choice: 'declined' } }, world(offered), world({ ...offered, answer: 'declined' }));
  assert.equal(line.ladderOffer, 'declined');
  step(null, world({ ...offered, answer: 'declined' }));
  assert.equal(line.ladderOffer, 'declined', '경계에서도 답이 남는다');
  assert.doesNotThrow(() => ev.visitLine(line));
});
