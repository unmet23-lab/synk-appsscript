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
  const world = (lastOffer = null, open) => ({ townVisit: { lifeDay: 20749, band: 'day' }, policy: { visitId: 'V-1', paramsVer: 'town-params-1', arm: 'adapted' },
    life: { uMs: 60000, visitStartU: 0 }, languageLadder: { rule: 'town-ladder-r1', reading: { lastOffer }, listening: { lastOffer: null } },
    asks: { lastLifeDay: null, asked: {}, ...(open ? { open } : {}) } });
  let line = null;
  const step = (command, before = world(), after = before) => { line = ev.visitSummary(line, { before, after, command }); return line; };
  step({ type: 'CARD_HELP', payload: { kind: 'meaning' } });
  step({ type: 'TEA_HELP', payload: { kind: 'reopen' } });
  step({ type: 'TEA_HELP', payload: { kind: 'repeat' } });
  step({ type: 'TEA_CLOSE', payload: { asks: { repeat: 0, slower: 2, meaning: 0, reopen: 3 } } });
  assert.deepEqual(line.help, { meaning: 1, repeat: 1, slower: 2 });
  assert.equal(line.ladderOffer, undefined, '제안이 없던 방문에는 칸이 없다');
  // W9 (Fable 설계 검토 5): 넓히기는 마스코트 물음이라 그린 때 none — 세운 때가 아니다.
  const offered = { at: 5, answer: null, evidence: 5 }, open = { kind: 'widen', key: 'widen:reading:L3', lifeDay: 20749, delivered: false };
  step({ type: 'LANGUAGE_OFFER', payload: { channel: 'reading' } }, world(), world(offered, open));
  assert.equal(line.ladderOffer, undefined, '서기만 하고 그리지 않은 물음은 세지 않는다');
  step(null, world(offered, open), world(offered, { ...open, delivered: true }));
  assert.equal(line.ladderOffer, 'none', '경계 옆 그린 보고에서 none');
  step({ type: 'LANGUAGE_ANSWER', payload: { channel: 'reading', choice: 'declined' } }, world(offered, { ...open, delivered: true }), world({ ...offered, answer: 'declined' }));
  assert.equal(line.ladderOffer, 'declined');
  step(null, world({ ...offered, answer: 'declined' }));
  assert.equal(line.ladderOffer, 'declined', '경계에서도 답이 남는다');
  assert.doesNotThrow(() => ev.visitLine(line));
  // 답 없이 닫은 물음(ASK_CLOSE)은 본 것으로 세어 none, 그리기 전에 온 답은 바로 그 값이다.
  const closed = ev.visitSummary(null, { before: world(offered, open), after: world(offered), command: { type: 'ASK_CLOSE', payload: { key: open.key } } });
  assert.equal(closed.ladderOffer, 'none');
  const early = ev.visitSummary(null, { before: world(offered, open), after: world({ ...offered, answer: 'accepted' }), command: { type: 'LANGUAGE_ANSWER', payload: { channel: 'reading', choice: 'accepted' } } });
  assert.equal(early.ladderOffer, 'accepted');
  assert.equal(ev.visitSummary(null, { before: world(null, { kind: 'taste', key: 'taste:cafe-life', family: 'cafe-life', lifeDay: 20749, delivered: false }),
    after: world(), command: { type: 'ASK_CLOSE', payload: { key: 'taste:cafe-life' } } }).ladderOffer, undefined, '다른 물음은 넓히기 칸에 들지 않는다');
});

// W9 둘째(다리 §4-3·세로 §20-3, Fable 설계 검토 1·2·3·4·15): 배치는 사다리가 스스로 움직이기 전이면 서버 값을 따르고,
// 넓히기 제안은 마스코트 묻기 예산 안의 첫 물음이다.
test('다리 §4-3 — 배치는 사다리가 스스로 움직이기 전(placement · 고정 아님)이면 서버 값을 따르고, 쌓인 장면 수와 상관없다', async () => {
  const l = await load('town/language-ladder.mjs');
  const ladder = l.initialLadder({ reading: 'L1', listening: 'L1' }, 10);
  Object.assign(ladder.reading, { evidence: 4, smoothStreak: 3, lastOffer: { at: 9, answer: null, evidence: 4, day: 1 } });
  const moved = l.followPlacement(ladder, { rule: 'town-placement-r1', reading: 'L3', listening: 'L2', suggested: null, at: '…' }, 20);
  assert.deepEqual(moved.reading, { stable: 'L3', source: 'placement', easedStreak: 0, smoothStreak: 0, fixed: false, lastOffer: null, evidence: 4, at: 20 },
    '장면을 이미 센 운영 세계에도 닿는다(Fable P1) — 옛 배치에서 센 이어짐과 제안은 넘기지 않는다');
  assert.equal(moved.listening.stable, 'L2');
  assert.equal(l.followPlacement(moved, { reading: 'L3', listening: 'L2' }, 30), moved, '같으면 그대로(같은 객체)');
  assert.equal(l.followPlacement(ladder, { reading: 'L5' }, 30), ladder, '모르는 값은 따르지 않는다');
  for (const [why, edit] of [['넓히기 수락', r => { r.source = 'offer'; }], ['내림', r => { r.source = 'eased'; }], ['본인 선택', r => { r.source = 'self'; r.fixed = true; }],
    ['고정', r => { r.fixed = true; }]]) {
    const own = structuredClone(ladder); edit(own.reading);
    assert.equal(l.followPlacement(own, { reading: 'L3', listening: 'L1' }, 30).reading.stable, 'L1', why);
  }
});

async function cafeWorld() {
  const [{ createStore }, core, tea] = await Promise.all([load('server.mjs'), load('core.mjs'), load('town/activities/tea-order.mjs')]);
  let now = Date.UTC(2026, 9, 23, 3, 0, 0), sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: 540, villageSeed: 'acct-w9' });
  const pulse = () => { now += 1000; receipt = store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true }).presence; };
  const send = (type, payload = {}) => store.execute({ id: `w9-${++sequence}`, type, expectedRevision: store.read().state.revision,
    payload: { ...(/^(DAY_|CARD_)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
  pulse(); send('DAY_MOVE', { location: 'cafe' }); if (store.read().state.day.home.exitTarget) send('DAY_EXIT');
  send('CHOOSE', { branch: 'inside' }); send('NEXT'); send('PLACE', { slot: 'eaves-left' });
  for (let i = 0; i < 3; i++) pulse();
  store.read();
  const base = structuredClone(store.peek().state), lifeDay = base.village.band.lifeDay;
  // 첫 생활일이 지났고 방문 45초가 지났으며 손님 자리 쓰기는 끝났다 — 같은 L에서 막힘 없는 장면 다섯(타운 근거).
  const ready = (edit = w => w) => { const w = structuredClone(base); w.townVisit = { ...w.townVisit, firstDay: lifeDay - 1 };
    w.life.uMs = w.life.visitStartU + 60000; w.pendingUse = null; w.recentLifeUse = []; w.languageLadder.reading.smoothStreak = 5; return edit(w); };
  let n = 0;
  const run = (w, type, payload = {}, host = {}) => core.reduceCommand(w, { id: `w9-${type}-${++n}`, type, payload, expectedRevision: w.revision },
    { enabled: true, nowMs: now, villageSeed: 'acct-w9', ...host }).state;
  const teaOpen = w => { w.activities = { ...w.activities, 'tea-order': tea.apply(tea.initial(), { type: 'TEA_OPEN', payload: {} },
    { id: 'T-1', nowMs: now, villageSeed: 'acct-w9', lifeDay, band: base.village.band.band, level: 'L2', raining: false, playerSeat: null, busy: () => false }).slot }; return w; };
  return { core, base, lifeDay, ready, run, teaOpen, get now() { return now; } };
}
const refused = code => error => error.code === code;

test('세로 §20-3 — 넓히기는 마스코트 묻기 예산 안의 첫 물음: 맞춤 회차·그리는 화면의 장면 끝·첫 생활일과 처음 45초 뒤·생활일에 한 번', async () => {
  const t = await cafeWorld(), { core, lifeDay, ready, run } = t;
  assert.equal(ready().languageLadder.reading.stable, 'L2', '로컬 미리 보기는 배치가 없어 L2에서 선다');
  assert.equal(core.snapshot(core.assertState(ready())).view.language.askReady, true, '오늘 물을 수 있으면 화면이 호스트에 묻는다');
  const offered = run(ready(), 'LANGUAGE_OFFER', { channel: 'reading', format: 'single-choice' });
  assert.deepEqual(offered.asks.open, { kind: 'widen', key: 'widen:reading:L3', lifeDay, delivered: false }, '열쇠에 자리와 넓힐 판 — Fable 2');
  assert.deepEqual([offered.languageLadder.reading.lastOffer.answer, offered.languageLadder.reading.lastOffer.day], [null, lifeDay], '생활일은 마을 구간의 것 — Fable 10');
  assert.equal(offered.asks.lastLifeDay, null, '세우기만 하면 아직 그날 물음으로 세지 않는다');
  assert.equal(core.snapshot(offered).view.ask.kind, 'widen');
  assert.equal(core.snapshot(offered).view.language.askReady, false);
  // 묻지 않는 때(§20-3·§20-6) — 모두 「지금 말로 이어 가요」(화면은 조용히 넘긴다).
  for (const [why, edit] of [['기본 회차', w => { w.policy = { ...w.policy, arm: 'baseline' }; return w; }],
    ['첫 방문 생활일', w => { w.townVisit.firstDay = lifeDay; return w; }], ['방문 처음 45초', w => { w.life.uMs = w.life.visitStartU + 30000; return w; }],
    ['그날 이미 물음', w => { w.asks.lastLifeDay = lifeDay; return w; }],
    ['그린 물음이 서 있음', w => { w.asks.open = { kind: 'taste', key: 'taste:cafe-life', family: 'cafe-life', lifeDay, delivered: true }; return w; }],
    ['쉬는 중', w => { w.day.rest = true; return w; }], ['근거 없음', w => { w.languageLadder.reading.smoothStreak = 4; return w; }]]) {
    assert.throws(() => run(ready(edit), 'LANGUAGE_OFFER', { channel: 'reading' }), refused('language-no-offer'), why);
  }
  assert.equal(core.snapshot(core.assertState(ready(w => { w.policy = { ...w.policy, arm: 'baseline' }; return w; }))).view.language.askReady, false, '기본 회차 화면은 묻지 않는다');
  assert.throws(() => run(t.teaOpen(ready()), 'LANGUAGE_OFFER', { channel: 'reading' }), refused('language-busy'), '장면 중');
  assert.throws(() => run(ready(), 'LANGUAGE_OFFER', { channel: 'reading', format: 'make' }), refused('language-choice'));
  // 아직 그리지 않은 취향 물음은 넓히기에 자리를 내준다(ASK_ORDER).
  const taste = run(ready(w => { w.asks.open = { kind: 'taste', key: 'taste:cafe-life', family: 'cafe-life', lifeDay, delivered: false }; return w; }), 'LANGUAGE_OFFER', { channel: 'reading' });
  assert.equal(taste.asks.open.kind, 'widen');
  // 묻기 칸이 없던 옛 세계도 그 명령에서 칸을 얻는다(TypeError 아님 — Fable 3).
  assert.equal(run(ready(w => { delete w.asks; return w; }), 'LANGUAGE_OFFER', { channel: 'reading' }).asks.open.kind, 'widen');
});

test('세로 §13-1 (가) — 끝난 장면의 응답 꼴로 메인 근거를 본다(대화 single-choice · 찻집 cup-compose, 꼴이 없으면 cup-compose)', async () => {
  const { ready, run } = await cafeWorld();
  const cell = { formats: { 'single-choice': { status: 'recent-independent' } } };
  const learningSummary = { evidenceComplete: true, evidenceRevision: 9, skills: ['ko.reading.detail', 'ko.reading.main'].map(id => ({ id, levels: { 2: cell } })) };
  const quiet = () => ready(w => { w.languageLadder.reading.smoothStreak = 0; return w; });
  const offered = run(quiet(), 'LANGUAGE_OFFER', { channel: 'reading', format: 'single-choice' }, { learningSummary });
  assert.equal(offered.asks.open.key, 'widen:reading:L3');
  assert.equal(offered.languageLadder.reading.lastOffer.evidence, 9, '제안 때의 근거 수(이 자리 장면 + 요약 판)');
  for (const format of ['cup-compose', undefined])
    assert.throws(() => run(quiet(), 'LANGUAGE_OFFER', { channel: 'reading', ...(format ? { format } : {}) }, { learningSummary }), refused('language-no-offer'), String(format));
});

test('세로 §20-3 — 넓히기 답·닫기·방문 끝: 답이 물음을 닫고, 닫기는 본 것으로 세며, 방문이 끝난 물음은 답할 수 없다', async () => {
  const t = await cafeWorld(), { core, lifeDay, ready, run } = t;
  const offered = () => run(ready(), 'LANGUAGE_OFFER', { channel: 'reading', format: 'single-choice' });
  const accepted = run(offered(), 'LANGUAGE_ANSWER', { channel: 'reading', choice: 'accepted' });
  assert.deepEqual([accepted.languageLadder.reading.stable, accepted.languageLadder.reading.source], ['L3', 'offer']);
  assert.equal(accepted.asks.open, undefined);
  assert.deepEqual([accepted.asks.lastLifeDay, accepted.asks.asked['widen:reading:L3']], [lifeDay, lifeDay], '그리기 전에 온 답도 그날 물음으로 센다');
  const declined = run(offered(), 'LANGUAGE_ANSWER', { channel: 'reading', choice: 'declined' });
  assert.deepEqual([declined.languageLadder.reading.stable, declined.languageLadder.reading.lastOffer.answer], ['L2', 'declined']);
  // 답 없이 닫기(「나중에」): 그날 물음으로 세고 거절은 아니다.
  const closed = run(offered(), 'ASK_CLOSE', { key: 'widen:reading:L3' });
  assert.equal(closed.asks.open, undefined); assert.equal(closed.asks.lastLifeDay, lifeDay);
  assert.equal(closed.languageLadder.reading.lastOffer.answer, null, '닫기는 거절이 아니다');
  assert.throws(() => run(closed, 'LANGUAGE_OFFER', { channel: 'reading' }), refused('language-no-offer'), '그날 다시 묻지 않는다');
  // 경계 옆 그린 보고(명령 판 없음).
  const drawn = structuredClone(offered());
  assert.equal(core.askDrawn(drawn, 'widen:reading:L3'), true); assert.equal(drawn.asks.open.delivered, true); assert.equal(drawn.asks.lastLifeDay, lifeDay);
  // 방문이 끝나면 물음이 사라지고, 다음 방문에서 그 답은 받지 않는다(409 — 화면은 다시 읽는다, Fable 4).
  const ended = core.closeLiving(offered(), t.now, { seed: 'acct-w9', offsetMin: 540, visitEnd: t.now });
  assert.equal(ended.asks.open, undefined);
  assert.throws(() => run(ended, 'LANGUAGE_ANSWER', { channel: 'reading', choice: 'accepted' }), e => e.code === 'language-no-offer' && e.status === 409);
  assert.throws(() => run(ready(), 'LANGUAGE_ANSWER', { channel: 'reading', choice: 'accepted' }), e => e.code === 'language-no-offer' && e.status === 409, '선 물음이 없으면');
  // 받아들인 다음 날 한 단계 위 제안은 열쇠가 달라 7생활일 쉼에 걸리지 않는다(Fable 2) — 같은 물음은 쉰다.
  const nextDay = ready(w => { Object.assign(w.languageLadder.reading, { stable: 'L3', source: 'offer', lastOffer: { at: 1, answer: 'accepted', evidence: 5, day: lifeDay - 1 } });
    w.asks = { lastLifeDay: lifeDay - 1, asked: { 'widen:reading:L3': lifeDay - 1 } }; return w; });
  assert.equal(run(nextDay, 'LANGUAGE_OFFER', { channel: 'reading' }).asks.open.key, 'widen:reading:L4');
  const again = ready(w => { w.asks = { lastLifeDay: lifeDay - 1, asked: { 'widen:reading:L3': lifeDay - 1 } }; return w; });
  assert.throws(() => run(again, 'LANGUAGE_OFFER', { channel: 'reading' }), refused('language-no-offer'), '닫은 같은 물음은 7생활일 쉰다');
});

test('다리 §4-3 — 명령마다 호스트 배치를 따르되 장면 중에는 미루고, 움직인 자리의 넓히기 물음은 함께 닫는다', async () => {
  const t = await cafeWorld(), { ready, run } = t;
  const placed = { rule: 'town-placement-r1', reading: 'L4', listening: 'L1', suggested: { reading: 'L4', listening: 'L1' }, at: '…' };
  const moved = run(ready(), 'SEEN_CLEAR', {}, { languagePlacement: placed });
  assert.deepEqual([moved.languageLadder.reading.stable, moved.languageLadder.listening.stable], ['L4', 'L1']);
  assert.equal(run(moved, 'SEEN_CLEAR', {}, {}).languageLadder.reading.stable, 'L4', '배치를 넘기지 않는 호스트는 사다리를 건드리지 않는다');
  const busy = run(t.teaOpen(ready()), 'SEEN_CLEAR', {}, { languagePlacement: placed });
  assert.equal(busy.languageLadder.reading.stable, 'L2', '찻집 주문 중에는 미룬다(그 장면은 시작 판 그대로)');
  const offered = run(ready(), 'LANGUAGE_OFFER', { channel: 'reading' });
  const followed = run(offered, 'SEEN_CLEAR', {}, { languagePlacement: placed });
  assert.equal(followed.asks.open, undefined, '배치가 바꾼 자리의 넓히기 물음은 함께 닫힌다');
  assert.equal(followed.languageLadder.reading.lastOffer, null);
  const self = run(ready(), 'LANGUAGE_SET', { channel: 'reading', choice: 'easier' });
  assert.equal(run(self, 'SEEN_CLEAR', {}, { languagePlacement: placed }).languageLadder.reading.stable, 'L1', '본인이 고른 말은 배치가 덮지 않는다');
});
