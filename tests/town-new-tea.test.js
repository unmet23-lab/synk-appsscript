'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const load = file => import(`../experiences/synk-town/${file}`);
const LEVELS = ['L1', 'L2', 'L3', 'L4'], MIN = 60000, START = Date.UTC(2026, 9, 23, 2);

test('C4 all authored levels preserve three turns, choices and recipe outcomes', async () => {
  const scene = await load('new-tea.mjs');
  for (const level of LEVELS) for (const first of ['sip', 'smell']) for (const [taste, final, honey] of [['less', 'agree', 1], ['same', 'menu', 2], ['same', 'serve', 2], ['aroma', 'more', 2], ['aroma', 'thanks', 2]]) {
    let state = scene.startNewTea(level);
    for (const [n, choice] of [first, taste, final].entries()) {
      assert.equal(state.turn, n); assert.ok(scene.newTeaView(state).choices.some(c => c.id === choice));
      state = scene.chooseNewTea(state, choice); assert.equal(scene.validNewTea(state), true);
    }
    assert.equal(state.done, true); assert.equal(state.honey, honey); assert.equal(scene.newTeaView(state).choices.length, 0);
  }
});

test('C4 help follows the common dialogue ladder and personal honey choice is not judged', async () => {
  const s = await load('new-tea.mjs'); let state = s.startNewTea('L4');
  state = s.helpNewTea(state, 'meaning'); assert.equal(s.newTeaView(state).level, 'L3');
  state = s.chooseNewTea(state, 'smell'); assert.equal(s.newTeaView(state).level, 'L4');
  state = s.helpNewTea(state, 'meaning'); assert.equal(s.newTeaView(state).level, 'L3');
  state = s.chooseNewTea(state, 'less'); assert.equal(s.newTeaView(state).level, 'L3');
  state = s.chooseNewTea(state, 'pour'); assert.equal(state.done, false);
  for (const honey of [0, 1, 2]) { const final = s.chooseNewTea(state, `honey-${honey}`); assert.equal(final.honey, honey); assert.equal(final.done, true); }
  assert.throws(() => s.chooseNewTea(state, 'honey-3'));
  assert.equal(s.validNewTea({ ...s.startNewTea('L1'), turn: 2 }), false);
  let repeat = s.startNewTea('L3'); repeat = s.helpNewTea(repeat, 'repeat'); assert.equal(s.newTeaView(repeat).level, 'L3');
  repeat = s.helpNewTea(repeat, 'repeat'); assert.equal(s.newTeaView(repeat).level, 'L2');
  const low = s.helpNewTea(s.startNewTea('L1'), 'meaning'); assert.equal(s.newTeaView(low).picture, 'cup');
  // W10: the L1 picture card carries the scene's short line (lines/new-tea.json), not the turn's own line.
  assert.equal(s.newTeaView(low).line, '새 차예요. 마셔 봐요.');
  assert.equal(s.newTeaView(s.startNewTea('L1')).line, '새 차 마셔 볼래요?');
});

test('the next band menu uses the chosen sweetness at every language level and every cup remains ordinary', async () => {
  const tea = await load('town/activities/tea-order.mjs');
  for (const level of LEVELS) for (const sweet of [0, 1, 2]) {
    const slot = tea.initial(), ctx = { villageSeed: 'new-menu', lifeDay: 20749, band: 'day', level, newTea: { sweet } };
    const { guests } = tea.orderGuests(slot, ctx);
    assert.equal(guests[0].request.tea, 'today'); assert.equal(guests[0].request.sweet, sweet);
    assert.match(tea.lineWords(guests[0].frame, level, guests[0].request), /오늘의 차/);
    assert.deepEqual(tea.judge(guests[0].request, { tea: 'today', honey: sweet, vessel: 'warm' }), []);
  }
});

async function openCard() {
  const [{ createStore }, village] = await Promise.all([load('server.mjs'), load('town/village.mjs')]);
  let now = START, sequence = 0, receipt;
  const store = createStore({ now: () => now, tz: 540, villageSeed: 'new-tea', lifeEnabled: true });
  const pulse = () => { receipt = store.pulse({ surfaceId: 'tea-a', surface: 'day', foreground: true, safe: true }).presence; };
  const send = (type, payload = {}) => store.execute({ id: `newtea-${++sequence}`, type, expectedRevision: store.read().state.revision,
    payload: { surfaceId: receipt.surfaceId, fence: receipt.fence, ...payload } });
  pulse();
  for (let n = 0; n < 60; n++) {
    const state = store.read().state, v = state.village, out = village.planOf(v);
    const start = Object.fromEntries(Object.entries(v.band.residents).map(([id, r]) => [id, r.lastSpot]).filter(([, at]) => at));
    const rise = out.log.find(e => e.card === 'C4' && e.atMs >= now);
    if (rise) {
      now = rise.atMs + 20000; pulse();
      const where = village.placeAt(out.segments, rise.npc, now, start);
      if (where && !where.walking) {
        send('DAY_MOVE', { location: where.to }); if (store.read().state.day.home.exitTarget) send('DAY_EXIT');
        send('CARD_OPEN', { card: 'C4', key: rise.key, source: 'direct' });
        return { store, send, pulse, set: time => { now = time; }, get now() { return now; } };
      }
    }
    now += MIN; pulse();
  }
  throw Error('C4 never became playable');
}

test('real C4 commands survive close/reload, keep learning untouched, and persist a menu for the next band', async () => {
  const h = await openCard(), take = () => h.store.read().state.village.takes.find(t => t.card === 'C4');
  const choose = value => { h.send('CARD_CHOOSE', { choice: value }); h.send('CARD_CONFIRM'); };
  const originalTrail = h.store.read().state.events.length;
  h.send('CARD_HELP', { kind: 'meaning' }); choose('smell');
  h.send('CARD_CLOSE'); assert.equal(take().status, 'paused'); assert.equal(take().newTea.turn, 1);
  h.send('CARD_OPEN', { card: 'C4', key: take().key, source: 'direct' });
  assert.equal(take().newTea.turn, 1); assert.equal(take().newTea.dialogue.stopped, false);
  choose('less'); choose('pour'); choose('honey-0');
  const state = h.store.read().state;
  assert.equal(take().status, 'resolved'); assert.equal(state.village.newTea.sweet, 0);
  assert.equal(state.events.length, originalTrail, 'preference choices never create Atlas practice evidence');
  const events = state.townEvents.filter(e => e.kind === 'dialogue.closed');
  assert.ok(events.some(e => e.outcome === 'stopped')); assert.ok(events.some(e => e.outcome !== 'stopped'));
  assert.ok(events.every(e => e.paramsVer === state.policy.paramsVer && e.arm === state.policy.arm), '장면 닫힘은 방문의 판과 회차를 단다(§20-6, W9)');
  h.send('CARD_CLOSE'); h.set(state.village.band.endMs + MIN); h.pulse();
  h.send('DAY_MOVE', { location: 'cafe' }); if (h.store.read().state.day.home.exitTarget) h.send('DAY_EXIT');
  h.send('TEA_OPEN');
  const a = h.store.read().state.activities['tea-order'].open.guests[0];
  assert.deepEqual(a.request, { tea: 'today', sweet: 0 });
});

test('W10 공개 직후 캐시 — new-tea는 생성물의 SCENES를 이름 공간으로 읽고, 작별 줄을 네 판으로 낸다', async () => {
  const code = require('node:fs').readFileSync(require('node:path').join(__dirname, '../experiences/synk-town/new-tea.mjs'), 'utf8');
  assert.match(code, /import \* as generated from '\.\/town\/data\.gen\.mjs'/, '옛 생성물이 10분 캐시에 남아도 모듈 연결이 깨지지 않게');
  assert.doesNotMatch(code, /import \{[^}]*\} from '\.\/town\/data\.gen\.mjs'/);
  const scene = await load('new-tea.mjs');
  assert.deepEqual(Object.keys(scene.GOODBYE_LINE.levels), LEVELS);
  for (const level of LEVELS) assert.equal(scene.GOODBYE_LINE.levels[level], scene.goodbye(level));
  assert.equal(scene.GOODBYE_LINE.npc, 'cafe-owner');
});

test('W10 그림 카드는 L1에서 누른 「무슨 뜻이에요?」에만 — 위 판에서는 먼저 한 단계 아래 줄, 그 차례 동안 다시 듣기에도 남고 다음 차례에 사라진다(화면 검수)', async () => {
  const s = await load('new-tea.mjs');
  const fromL2 = s.helpNewTea(s.chooseNewTea(s.startNewTea('L2'), 'sip'), 'meaning');
  assert.equal(s.newTeaView(fromL2).level, 'L1'); assert.equal(s.newTeaView(fromL2).picture, null, 'L2에서 누르면 L1 줄이 먼저');
  const again = s.helpNewTea(fromL2, 'meaning'); assert.ok(s.newTeaView(again).picture, 'L1에서 다시 누르면 그림 카드');
  const repeated = s.helpNewTea(again, 'repeat'); assert.ok(s.newTeaView(repeated).picture, '다시 말해 주세요에도 그림은 남는다'); assert.equal(s.validNewTea(repeated), true);
  const next = s.chooseNewTea(repeated, s.newTeaView(repeated).choices[0].id); assert.equal(s.newTeaView(next).picture, null, '다음 차례엔 없다');
  const saved = s.startNewTea('L2'); delete saved.picture; assert.equal(s.validNewTea(saved), true, '그림 칸이 없는 옛 저장도 유효');
});
