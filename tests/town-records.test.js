'use strict';
// 싱크타운 「마을 기록」(세로 조각 설계 §20-5 계정 화면 계약, W6c): 마을 밖 계정 화면(WORLD 「내 계정」·synk.im 계정 포털·PC 회원 화면)이
// 마을 안 수첩과 같은 규칙으로 본다 — 줄과 판정은 town/records.mjs 한 곳(수첩이 부르고, talk records 경로가 accountRecords로 싣는다).
// 수첩 판정(설계 검토 F8): 켠 호스트는 상태·좋아요·그만 쓰기(확인)·자세히, 끈 호스트는 동의한 사람에게 그만 쓰기만, 학원은 안내만.
// 계정 카드는 rights 명령만 단추로 보낸다(그 밖의 줄은 단추 없이).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT } = require('./lib/town.js');

const load = file => import(pathToFileURL(path.join(ROOT, 'experiences', 'synk-town', file)).href);
const TZ = 540, NOON = Date.UTC(2026, 9, 23, 3, 0, 0);   // 2026-10-23 12:00 KST — the day band, every resident up
const cupFor = request => ({ vessel: request.temp ?? 'warm', tea: request.tea ?? 'barley', honey: request.sweet ?? 1 });

/** A real world whose player did the day's tea order with the cafe owner (she knows 「찻집 일」, W8) — commands straight to the reducer. */
async function townWithMemory() {
  const [{ createStore }, core] = await Promise.all([load('server.mjs'), load('core.mjs')]);
  const store = createStore({ now: () => NOON, tz: TZ, villageSeed: 'acct-records', sleeps: true, lifeEnabled: true });
  store.pulse({ surfaceId: 'day-a', surface: 'day', foreground: true, safe: true });
  let state = store.read().state, n = 0;
  state.day.location = 'cafe';
  const host = { enabled: true, surface: 'day', nowMs: NOON, villageSeed: 'acct-records', canRun: true, surfaceId: 'day-a', ownerSurfaceId: 'day-a', elapsedMs: 0 };
  const send = (type, payload = {}) => { state = core.reduceCommand(state, { id: `c-${++n}`, type, payload, expectedRevision: state.revision }, host).state; };
  send('TEA_OPEN');
  const order = state.activities['tea-order'].open;
  for (const g of order.guests) send('TEA_SERVE', { order: order.id, guest: g.slot, cup: cupFor(g.request), mode: 'make' });
  send('TEA_CLOSE', { order: order.id });
  return { core, state };
}

const records = () => load('town/records.mjs');
const notebook = () => load('day-notebook.mjs');
// What the notebook reads from a town answer (core view + the seen ledger + the host's switch).
const snapshotOf = (core, state, { seen = {}, evalSignals = false } = {}) => ({ state, view: core.viewFor(state), seen, capabilities: { evalSignals } });
const section = (card, id) => card.sections.find(s => s.id === id);

test('주민이 아는 나: 계정 카드는 core가 수첩에 주는 knownMe와 같은 기억을 같은 줄로 보이고, 잊은 것은 빠진다', async () => {
  const { core, state } = await townWithMemory();
  const { knownMeOf, accountRecords, RESIDENT_NAMES } = await records(), { notebookModel } = await notebook();
  assert.deepEqual(knownMeOf(state), core.viewFor(state).day.scene.village.knownMe, 'knownMe — core cardsView와 같다');
  const shown = notebookModel(snapshotOf(core, state)).known, card = section(accountRecords(state), 'known');
  assert.ok(shown.length >= 1 && shown.some(k => k.npc === 'cafe-owner' && k.title === '찻집 일'), '찻집 주인이 「찻집 일」을 안다');
  assert.deepEqual(card.rows.map(r => r.text), shown.map(k => `${RESIDENT_NAMES[k.npc]} · ${k.title} — 같이 했어요`), '수첩 줄과 같은 글');
  assert.deepEqual(card.rows.map(r => r.action), shown.map(k => ({ type: 'MEMORY_FORGET', payload: { npc: k.npc, eventId: k.ref }, label: '잊어 주세요' })));
  // 잊으면 두 곳 모두에서 빠진다(같은 forgotten을 읽는다).
  const ref = shown[0].ref, forgot = core.reduceCommand(state, { id: 'forget-1', type: 'MEMORY_FORGET', payload: { npc: shown[0].npc, eventId: ref }, expectedRevision: state.revision },
    { enabled: true, nowMs: NOON, villageSeed: 'acct-records' }).state;
  assert.ok(!notebookModel(snapshotOf(core, forgot)).known.some(k => k.ref === ref));
  assert.ok(!section(accountRecords(forgot), 'known').rows.some(r => r.action.payload.eventId === ref));
  assert.equal(accountRecords(forgot).revision, forgot.revision, '카드는 보낼 판을 같이 준다');
});

test('마을이 맞춰 둔 것·익숙한 생활: 수첩과 같은 줄 · rights 명령만 단추(먼저 보여 줄 생활·덜 추천·먼저 말 걸지 않기는 단추 없이 안내 한 줄)', async () => {
  const { core, state: base } = await townWithMemory();
  const { accountRecords } = await records(), { notebookModel } = await notebook();
  const { commandScope } = await load('town/scope.mjs');
  const state = { ...base, visitBands: { ring: [], day: null, off: false },
    prefs: { ...base.prefs, preferredFamily: 'cafe-life', observed: 'workshop-life', lessOften: ['card.C2'], approachOptOut: ['tea-order'],
      feedback: [{ completionId: 'E-5', value: 'helpful', canonicalActivityId: 'card.C1', lifeDay: 20749 }] } };
  // C1은 길을 더해 4번, PAIR01은 단계를 더해 4번, C2는 3번(문턱 familiarAfter 3을 넘지 않음).
  const seen = { 'card:C1:self': 3, 'card:C1:player': 1, 'pair:PAIR01:0': 2, 'pair:PAIR01:1': 2, 'card:C2:self': 3 };
  const book = notebookModel(snapshotOf(core, state, { seen })), card = accountRecords(state, { seen });
  const settings = section(card, 'settings');
  assert.deepEqual(settings.rows.map(r => r.text), book.settings.map(s => s.label));
  assert.deepEqual(settings.rows.map(r => r.action && [r.action.type, r.action.payload, r.action.label]),
    book.settings.map(s => commandScope(s.action[0]) === 'rights' ? s.action : null), 'rights 줄은 수첩과 같은 명령, 그 밖은 단추 없음');
  assert.deepEqual(settings.rows.filter(r => r.action).map(r => r.action.type), ['PREF_VISIT_BANDS', 'OBSERVED_CORRECT', 'FEEDBACK_REMOVE']);
  assert.ok(settings.note, '단추 없는 줄이 있으면 안내 한 줄');
  assert.equal(section(accountRecords({ ...state, prefs: { ...state.prefs, preferredFamily: null, lessOften: [], approachOptOut: [] } }), 'settings').note, undefined);
  const familiar = section(card, 'familiar');
  assert.deepEqual(familiar.rows.map(r => r.text), book.familiar.map(f => f.title));
  assert.deepEqual(familiar.rows.map(r => r.text), ['쟁반이 기울어요', '찻집 주인과 공방 주인의 이야기'], '세 번 넘게 겪은 것만');
  assert.deepEqual(familiar.actions, [{ type: 'SEEN_CLEAR', payload: {}, label: '본 것 기록 비우기', confirm: '본 것 기록을 비울까요? 마을의 일과 주민의 기억은 그대로예요.' }]);
  assert.deepEqual(section(card, 'clear').actions, [{ type: 'MEMORY_CLEAR', payload: {}, label: '비우기', confirm: '맞춤 기록을 모두 비울까요?' }]);
  // 계정 카드의 모든 단추는 rights 명령이다(talk records POST가 받는 것만).
  for (const s of card.sections) for (const action of [...(s.rows || []).map(r => r.action), ...(s.actions || [])].filter(Boolean)) assert.equal(commandScope(action.type), 'rights', action.type);
});

test('마을을 낫게 하는 데 쓰는 기록: 수첩 판정 그대로 — 켬·끔·학원·동의 상태 조합', async () => {
  const { core, state: base } = await townWithMemory();
  const { accountRecords, DETAIL_ROWS } = await records(), { evalRecordOf } = await notebook();
  const { EVAL_CONSENT } = await load('town/data.gen.mjs');
  const withConsent = consent => ({ ...base, consents: { evalSignals: { state: consent, ver: EVAL_CONSENT.ver } } });
  const stop = { type: 'EVAL_CONSENT', payload: { state: 'withdrawn' }, label: '그만 쓰기', confirm: '그만 쓸까요? 지금까지 모은 기록을 지워요.' };
  const yes = { type: 'EVAL_CONSENT', payload: { state: 'granted', ver: EVAL_CONSENT.ver }, label: '좋아요' };
  for (const consent of ['unasked', 'granted', 'declined', 'withdrawn']) for (const evalSignals of [true, false]) for (const academy of [false, true]) {
    const state = withConsent(consent), record = evalRecordOf({ ...snapshotOf(core, state, { evalSignals }), state: { ...state, scope: { subject: academy ? 'linked-class-1' : 'acct-1' } } });
    const shown = section(accountRecords(state, { evalSignals, academy }), 'eval'), label = `${consent}·${evalSignals ? '켬' : '끔'}·${academy ? '학원' : '개인'}`;
    if (!record) { assert.equal(shown, undefined, label);continue; }
    if (record.academy) { assert.deepEqual(shown.lines, ['학원 소속 계정에는 묻지 않아요.'], label);assert.equal(shown.actions, undefined, label);continue; }
    assert.deepEqual(shown.lines, [record.on ? `쓰고 있어요. ${EVAL_CONSENT.easy.keep}` : '쓰지 않고 있어요. 안 써도 마을은 똑같아요.'], label);
    assert.deepEqual(shown.actions, record.on ? [stop] : record.stopOnly ? [] : [yes], label);
    if (record.detail) assert.deepEqual(shown.detail, { title: EVAL_CONSENT.detail.title, rows: DETAIL_ROWS.filter(([key]) => EVAL_CONSENT.detail[key]).map(([key, label]) => ({ label, text: EVAL_CONSENT.detail[key] })) }, label);
    else assert.equal(shown.detail, undefined, label);
  }
  // F8: 끈 호스트에서 이미 동의했으면 그만 쓰기만 / 켠 호스트 동의 전이면 좋아요와 자세히 / 동의 칸이 없는 옛 세계는 줄 없음.
  assert.deepEqual(section(accountRecords(withConsent('granted'), { evalSignals: false }), 'eval').actions, [stop]);
  assert.deepEqual(section(accountRecords(withConsent('unasked'), { evalSignals: true }), 'eval').actions, [yes]);
  assert.equal(section(accountRecords(withConsent('unasked'), { evalSignals: false }), 'eval'), undefined);
  assert.equal(section(accountRecords({ ...base, consents: undefined }, { evalSignals: true }), 'eval'), undefined);
  // 보관 문구는 동의 계약 생성물에서만 온다(날짜를 박지 않는다).
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'experiences/synk-town/town/records.mjs'), 'utf8'), /\d+일이 지나면/);
});

test('세계가 비어도(마을 칸 없음) 카드는 빈 줄로 서고, 이름표·피드백 말은 화면(day-cards)과 같다', async () => {
  const { accountRecords, RESIDENT_NAMES, FEEDBACK_WORDS } = await records(), { NAMES, FEEDBACK } = await load('day-cards.mjs');
  assert.deepEqual(RESIDENT_NAMES, NAMES);
  assert.deepEqual(FEEDBACK_WORDS, FEEDBACK);
  const card = accountRecords({ revision: 3 });
  assert.deepEqual(card.sections.map(s => s.id), ['known', 'settings', 'familiar', 'clear']);
  assert.deepEqual(card.sections.filter(s => s.rows).map(s => s.rows.length), [0, 0, 0]);
  assert.equal(card.revision, 3);
});

test('G11: records.mjs는 평가 갈래(eval.mjs)를 부르지 않는다 — 동의 상태와 계약 생성물만 읽는다', () => {
  const source = fs.readFileSync(path.join(ROOT, 'experiences/synk-town/town/records.mjs'), 'utf8');
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.deepEqual(imports.sort(), ['./data.gen.mjs', './knowledge.mjs', './scope.mjs']);
});
