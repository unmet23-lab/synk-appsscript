'use strict';
// 싱크타운 수첩 「마을이 기억하는 것」의 엔진 몫(세로 조각 설계 §20-5·§20-3·§20-4, 시험 §20-10 town-notebook, W2 계획 5b) —
// 본인 권리 명령 여섯과 피드백·제안 메뉴 다섯은 타운 저장의 명령 한 길로만 들어가 영수증·판·사건을 남긴다. 잊어 주세요는
// 그 주민의 반응 고르기에서만 빠지고 세계 결과는 그대로이며, 맞춤 기록 비우기는 본인이 정한 설정을 남긴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, townModule } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);
const KST = 540, NOON = Date.UTC(2026, 9, 22, 3, 0); // 2026-10-22 12:00 한국 시각
const RIGHTS = ['MEMORY_FORGET', 'FEEDBACK_REMOVE', 'OBSERVED_CORRECT', 'SEEN_CLEAR', 'MEMORY_CLEAR', 'EVAL_CONSENT'];
const BASE = ['FEEDBACK_GIVE', 'PREF_LESS_OFTEN', 'PREF_TODAY_OTHER', 'PREF_APPROACH', 'PREF_FAMILY'];

/** 시계를 손에 쥔 저장소와, 직전 판으로 명령을 보내는 손. */
async function town(options = {}) {
  const { createStore } = await townFile('server.mjs');
  const clock = { at: NOON };
  const store = createStore({ now: () => clock.at, tz: KST, ...options });
  let n = 0;
  const run = (type, payload = {}, extra) => store.execute({ id: `nb-${++n}`, type, payload, expectedRevision: store.peek().state.revision }, extra);
  const seat = () => { run('CHOOSE', { branch: 'inside' }); run('NEXT'); return run('PLACE', { slot: 'eaves-left' }); };
  return { store, clock, run, seat };
}
const temporary = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-town-notebook-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };

test('본인 권리 여섯과 설정 다섯은 명령 한 길 — 판이 하나씩 오르고, 영수증이 같은 답을 주고, 사건은 E-번호로 남는다', async () => {
  const { commandScope } = await townModule('scope');
  const { eventProblem } = await townModule('events');
  const { CONSENT_VER } = await townModule('consent');
  const { lifeDayAt } = await townModule('clock');
  for (const type of RIGHTS) assert.equal(commandScope(type), 'rights', type);
  for (const type of BASE) assert.equal(commandScope(type), 'base', type);
  const { store, run, seat } = await town();
  const goal = seat().state.goals.inside;
  const steps = [
    ['FEEDBACK_GIVE', { completionId: goal, value: 'helpful', canonicalActivityId: 'ft10.seat' }],
    ['PREF_LESS_OFTEN', { activity: 'card.C2', on: true }],
    ['PREF_APPROACH', { activity: 'card.C1', optOut: true }],
    ['PREF_TODAY_OTHER', { activity: 'tea-order' }],
    ['PREF_FAMILY', { family: 'cafe-life', answer: 'yes' }],
    ['FEEDBACK_REMOVE', { eventId: goal }],
    ['MEMORY_FORGET', { npc: 'cafe-owner', eventId: goal }],
    ['OBSERVED_CORRECT', { family: 'workshop-life' }],
    ['SEEN_CLEAR', {}],
    ['MEMORY_CLEAR', {}],
    ['EVAL_CONSENT', { state: 'granted', ver: CONSENT_VER }],
  ];
  for (const [type, payload] of steps) {
    const before = store.peek().state.revision, receipts = store.stats().receipts;
    const after = run(type, payload).state;
    assert.equal(after.revision, before + 1, `${type}: 판 하나`);
    assert.equal(store.stats().receipts, receipts + 1, `${type}: 영수증 하나`);
  }
  const { state } = store.peek();
  assert.equal(state.prefs.feedback.length, 0, '응답 지우기');
  assert.deepEqual([state.prefs.lessOften, state.prefs.approachOptOut, state.prefs.preferredFamily], [['card.C2'], ['card.C1'], 'cafe-life']);
  assert.equal(state.prefs.todayOther.visitId, state.policy.visitId, '「오늘은 다른 일」은 이 방문의 것');
  assert.deepEqual(state.consents.evalSignals, { state: 'granted', ver: CONSENT_VER });
  assert.deepEqual(state.townEvents.map(e => e.kind), ['feedback.given', 'feedback.removed', 'memory.forgotten', 'consent.changed']);
  assert.deepEqual(state.townEvents.map(e => e.id), ['E-1', 'E-2', 'E-3', 'E-4']);
  assert.ok(state.townEvents.every(e => eventProblem(e) === null && Number.isSafeInteger(e.cmdRev)), '사건 꼴');
  assert.deepEqual(state.townEvents[0], { id: 'E-1', kind: 'feedback.given', cmdRev: 4, completionId: goal, value: 'helpful', canonicalActivityId: 'ft10.seat' });
  assert.equal(state.events.filter(e => e.type === 'life.fact').length, store.peek().state.trail.seq, 'Trail 줄은 따로(state.events)');
  // 응답의 생활일은 host 시계가 정한다(서버 시각 + 계정 시간대).
  const given = store.peek().state;
  assert.ok(lifeDayAt(KST, NOON) > 20000 && given.townEvents.length === 4);
  // 같은 명령은 같은 답, 내용이 다르면 거절.
  const command = { id: 'nb-again', type: 'PREF_LESS_OFTEN', payload: { activity: 'card.C3', on: true }, expectedRevision: given.revision };
  store.execute(command);
  assert.equal(store.execute(command).duplicate, true);
  assert.throws(() => store.execute({ ...command, payload: { activity: 'card.C4', on: true } }), error => error.code === 'conflicting-command');
});

test('잊어 주세요: 그 주민의 반응 고르기에서 빠지고, 목표·물건은 그대로 · 다시 열어도 같다 · 지금 장면이 쓰는 사실은 대상이 아니다', async t => {
  const { reactionFor } = await townFile('core.mjs');
  const { memoriesOf } = await townModule('memory');
  const { projection } = await townModule('trail-index');
  const file = path.join(temporary(t), 'save.json');
  const { store, clock, run, seat } = await town({ file });
  const placed = seat().state;
  const goal = placed.goals.inside;
  assert.equal(reactionFor(placed, 'cafe-owner').selected.contentRef, 'FT10.06B', '처음엔 함께 옮긴 의자를 기억한다');
  assert.deepEqual(memoriesOf(placed.trail, [], 'cafe-owner').map(m => m.id), [goal], '주민이 아는 나 = 함께한 일');
  const forgot = run('MEMORY_FORGET', { npc: 'cafe-owner', eventId: goal }).state;
  assert.deepEqual(forgot.forgotten, [{ npc: 'cafe-owner', target: goal }]);
  assert.equal(reactionFor(forgot, 'cafe-owner').selected.contentRef, 'FT10.revisit', '기억에서 뺀 일은 회상하지 않는다');
  assert.equal(reactionFor(forgot, 'cafe-owner').rejected.find(r => r.reason === 'npc-unaware')?.id.endsWith('.first'), true);
  assert.deepEqual(memoriesOf(forgot.trail, forgot.forgotten, 'cafe-owner'), [], '수첩 목록에서도 빠진다');
  const knows = (state, npc) => projection(state.trail, { version: 'x', scope: state.scope, npcId: npc, sourceIds: [goal],
    forgotten: new Set(state.forgotten.filter(f => f.npc === npc).map(f => f.target)) }).knowledge[npc];
  assert.deepEqual(knows(forgot, 'cafe-owner'), []);
  assert.deepEqual(knows(forgot, 'guest'), [goal], '다른 주민의 기억은 그대로');
  for (const key of ['goals', 'achievements', 'inventory', 'placement', 'canopyOwned', 'ledger']) assert.deepEqual(forgot[key], placed[key], `${key} 그대로`);
  // 반응은 하루 이용 줄로 이어지므로 장면이 멈추지 않는다.
  const { view } = store.peek();
  run('ACK', { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey, worldRevision: forgot.worldRevision, activity: 'seat',
    mode: 'static', visible: true, assetsReady: true, appliedStepIds: view.committedStepIds });
  assert.equal(store.peek().state.delivered, true);
  // 다시 열어도·다른 기기에서 읽어도 그대로.
  const { createStore } = await townFile('server.mjs');
  const reopened = createStore({ file, now: () => clock.at + 60000, tz: KST }).read().state;
  assert.deepEqual(reopened.forgotten, forgot.forgotten);
  assert.equal(reactionFor({ ...reopened, delivered: false }, 'cafe-owner').selected?.contentRef ?? null, 'FT10.revisit');
  // 같은 것을 또 잊어도 사건은 하나, 지금 장면이 쓰는 사실·모르는 사실은 거절.
  const events = store.peek().state.townEvents.length;
  run('MEMORY_FORGET', { npc: 'cafe-owner', eventId: goal });
  assert.equal(store.peek().state.townEvents.length, events);
  for (const eventId of [placed.currentUseId, 'life:9999', placed.trail.lastSeatPlaced]) assert.throws(() => run('MEMORY_FORGET', { npc: 'cafe-owner', eventId }), error => error.code === 'memory-unavailable', eventId);
  assert.throws(() => run('MEMORY_FORGET', { npc: 'workshop-owner', eventId: goal }), error => error.code === 'memory-unavailable', '그 주민이 모르는 일');
});

test('맞춤 기록 모두 비우기는 관측·응답·본 것을 비우고 본인이 정한 설정은 남긴다 · 본 것 비우기는 본 것만', async t => {
  const { createStore } = await townFile('server.mjs');
  const { initialState } = await townFile('core.mjs');
  const file = path.join(temporary(t), 'save.json');
  // 관측 후보·최근 이용은 W6이 쓴다 — 여기서는 그 칸이 든 저장에서 시작한다.
  const world = { ...initialState({ lifeEnabled: true }),
    recentLifeUse: [{ useId: 'U-1', canonicalActivityId: 'tea-order', storyFamily: 'cafe-life', direct: true }],
    prefs: { preferredFamily: 'workshop-life', lessOften: ['card.C2'], approachOptOut: ['card.C1'], todayOther: { visitId: null, items: [] },
      observed: 'cafe-life', denied: ['greenhouse-life'], feedback: [{ completionId: 'life:3', value: 'not_fit', canonicalActivityId: 'tea-order', lifeDay: 20748 }] } };
  fs.writeFileSync(file, JSON.stringify({ ...world, seen: { 'card:C1:self': 2, 'gather:mint': 1 } }));
  const store = createStore({ file, now: () => NOON, tz: KST });
  assert.deepEqual(store.peek().seen, { 'card:C1:self': 2, 'gather:mint': 1 }, '본 것 갈래를 읽었다');
  let n = 0;
  const run = (type, payload = {}, extra) => store.execute({ id: `clear-${++n}`, type, payload, expectedRevision: store.peek().state.revision }, extra);
  run('SEEN_CLEAR', {}, { seen: ['card:C2:pair'] });
  assert.deepEqual(store.peek().seen, {}, '비우는 명령에 실린 키는 세지 않는다');
  assert.equal(store.peek().state.prefs.observed, 'cafe-life', '본 것 비우기는 본 것만');
  run('PREF_LESS_OFTEN', { activity: 'card.C3', on: true }, { seen: ['card:C4:player'] });
  const cleared = run('MEMORY_CLEAR');
  assert.deepEqual(cleared.seen, {});
  assert.deepEqual([cleared.state.prefs.observed, cleared.state.prefs.feedback, cleared.state.recentLifeUse], [null, [], []]);
  assert.deepEqual([cleared.state.prefs.preferredFamily, cleared.state.prefs.lessOften, cleared.state.prefs.approachOptOut, cleared.state.prefs.denied],
    ['workshop-life', ['card.C2', 'card.C3'], ['card.C1'], ['greenhouse-life']], '본인이 정한 설정은 그대로');
  assert.deepEqual(createStore({ file, now: () => NOON, tz: KST }).peek().seen, {}, '비운 것도 저장된다');
});

test('평가 신호 동의: 학원 소속은 켤 수 없고 철회는 늘 받는다 · 동의가 풀리면 그 계정 줄을 바로 지운다', async () => {
  const { CONSENT_VER } = await townModule('consent');
  const { reduceCommand, initialState } = await townFile('core.mjs');
  const line = { id: 'V-9', lifeDay: 20748, band: 'day', lengthBucket: '10-30m', paramsVer: 'town-params-1', arm: 'adapted', consentVer: CONSENT_VER };
  const academy = await town({ academy: true });
  assert.throws(() => academy.run('EVAL_CONSENT', { state: 'granted', ver: CONSENT_VER }), error => error.code === 'eval-consent-academy' && error.status === 403);
  assert.equal(academy.run('EVAL_CONSENT', { state: 'withdrawn' }).state.consents.evalSignals.state, 'withdrawn');
  const linked = initialState({ scope: { domain: 'LAB', workspace: 'synk-town', subject: 'linked-learner-a' } });
  assert.throws(() => reduceCommand(linked, { id: 'c', type: 'EVAL_CONSENT', payload: { state: 'granted' }, expectedRevision: 0 }), error => error.code === 'eval-consent-academy', '학급 연결판도 학원 소속');
  const person = await town();
  assert.equal(person.store.writeVisit(line), 0, '동의 전 쓰기 0');
  assert.throws(() => person.run('EVAL_CONSENT', { state: 'granted', ver: 'town-eval-signals-0' }), error => error.code === 'eval-consent-version');
  person.run('EVAL_CONSENT', { state: 'granted', ver: CONSENT_VER });
  assert.equal(person.store.writeVisit(line), 1);
  assert.equal(person.store.writeVisit({ ...line, lengthBucket: '30m-1h' }), 1, '방문 id로 덮어쓴다');
  const withdrawn = person.run('EVAL_CONSENT', { state: 'withdrawn' });
  assert.equal(person.store.stats().evalLines, 0, '철회하면 그 자리에서 지운다');
  assert.equal(person.store.writeVisit(line), 0, '철회 뒤 쓰기 0');
  assert.deepEqual(withdrawn.state.townEvents.filter(e => e.kind === 'consent.changed').map(e => e.state), ['granted', 'withdrawn']);
});

test('본 것 보고는 서명 밖에 실려 다시 보내도 두 번 세지 않는다 · 아는 키만 · 요청당 50 · 경계 신호가 이르면 기록만', async () => {
  const { CARD_IDS } = await townModule('seen');
  const { store, clock, run } = await town();
  const first = run('PREF_LESS_OFTEN', { activity: 'card.C1', on: true }, { seen: ['card:C1:self', 'card:C9:self', 'line:not-in-content', 'gather:mint'] });
  assert.deepEqual(first.seen, { 'card:C1:self': 1, 'gather:mint': 1 }, '콘텐츠에 있는 키만');
  const command = { id: 'retry-1', type: 'PREF_LESS_OFTEN', payload: { activity: 'card.C2', on: true }, expectedRevision: first.state.revision };
  store.execute(command, { seen: ['card:C2:pair'] });
  assert.equal(store.execute(command, { seen: ['card:C2:pair'] }).duplicate, true);
  assert.equal(store.peek().seen['card:C2:pair'], 1, '다시 보낸 같은 명령은 세지 않는다');
  assert.throws(() => run('PREF_LESS_OFTEN', { activity: 'card.C5', on: true }, { seen: 'card:C1:self' }), error => error.code === 'invalid-seen');
  const pulse = () => store.presence({ surfaceId: 'w', surface: 'day', foreground: true, safe: true }).presence;
  let receipt = pulse();
  const many = CARD_IDS.flatMap(card => ['self', 'pair', 'player'].map(path => `card:${card}:${path}`));
  assert.ok(many.length > 50);
  assert.equal(store.boundary({ ...receipt, seen: many }).throttled, undefined);
  // 앞의 50개만 — 그 가운데 card:C1:self·card:C2:pair는 이미 있던 키라 새 키는 48개.
  const ledger = store.peek().seen;
  assert.equal(Object.keys(ledger).length, 3 + 48, '요청당 50');
  assert.equal(ledger['card:C1:self'], 2);
  assert.equal(ledger[many[50]], undefined, '51번째 키는 세지 않는다');
  clock.at += 1000; receipt = pulse();
  const throttled = store.boundary({ ...receipt, seen: ['gather:leaf-young'] });
  assert.equal(throttled.throttled, true);
  assert.equal(store.peek().seen['gather:leaf-young'], 1, '이른 경계 신호도 본 것은 남긴다');
});

test('RESET은 사람의 동의·설정·묻기 예산을 남기고, 세계의 물건·방문·잊은 일을 새로 연다 · 사건 번호는 이어 간다', async () => {
  const { CONSENT_VER } = await townModule('consent');
  const { store, run, seat } = await town();
  const goal = seat().state.goals.inside;
  run('EVAL_CONSENT', { state: 'granted', ver: CONSENT_VER });
  run('PREF_LESS_OFTEN', { activity: 'card.C2', on: true });
  run('PREF_TODAY_OTHER', { activity: 'tea-order' });
  run('MEMORY_FORGET', { npc: 'cafe-owner', eventId: goal });
  const before = store.peek().state;
  const reset = run('RESET').state;
  assert.deepEqual([reset.consents, reset.prefs, reset.asks, reset.recentLifeUse], [before.consents, before.prefs, before.asks, before.recentLifeUse]);
  assert.deepEqual([reset.policy, reset.forgotten, reset.ledger.inventory], [null, [], []]);
  assert.equal(reset.townSeq, before.townSeq);
  run('EVAL_CONSENT', { state: 'withdrawn' });
  assert.equal(store.peek().state.townEvents.at(-1).id, `E-${before.townSeq + 1}`, '사건 id는 RESET을 넘어 이어진다');
});

test('방문이 바뀌면 「오늘은 다른 일」이 풀린다 — 나가기·다시 오기, 30분 쉼', async () => {
  const { todayOther } = await townModule('prefs');
  const { store, clock, run } = await town();
  const first = run('PREF_TODAY_OTHER', { activity: 'tea-order' }).state;
  assert.match(first.policy.visitId, /^V-\d+$/);
  assert.deepEqual([first.policy.paramsVer, first.policy.arm], ['town-params-1', 'adapted']);
  assert.equal(run('PREF_TODAY_OTHER', { activity: 'card.C1' }).state.policy.visitId, first.policy.visitId, '방문 안에서는 같은 판과 회차');
  assert.equal(run('LEAVE').state.policy, null);
  run('VISIT');
  const second = run('PREF_TODAY_OTHER', { activity: 'card.C3' }).state;
  assert.notEqual(second.policy.visitId, first.policy.visitId);
  assert.equal(todayOther(second.prefs, second.policy.visitId, 'tea-order'), false, '지난 방문의 「오늘은 다른 일」은 풀렸다');
  assert.deepEqual(second.prefs.todayOther.items, ['card.C3']);
  const pulse = () => store.presence({ surfaceId: 'w', surface: 'day', foreground: true, safe: true });
  pulse(); clock.at += 1000;
  assert.equal(pulse().state.policy.visitId, second.policy.visitId, '맥박은 방문을 그대로 둔다');
  clock.at += 31 * 60000;
  assert.equal(pulse().state.policy, null, '30분 쉼이 방문을 닫는다');
});

test('옛 저장(§20 칸 없음)은 빈 값으로 열리고, 칸이 깨진 저장은 거절한다', async () => {
  const { restoreState, initialState } = await townFile('core.mjs');
  const fresh = initialState({ lifeEnabled: true });
  const old = { ...fresh };
  for (const key of ['ledger', 'prefs', 'asks', 'recentLifeUse', 'consents', 'policy', 'forgotten', 'townSeq', 'townEvents']) delete old[key];
  const restored = restoreState(old, { lifeEnabled: true });
  for (const key of ['ledger', 'prefs', 'asks', 'recentLifeUse', 'consents', 'policy', 'forgotten', 'townSeq', 'townEvents']) assert.deepEqual(restored[key], fresh[key], key);
  for (const broken of [{ prefs: { ...fresh.prefs, feedback: [{ completionId: 'x' }] } }, { consents: { evalSignals: { state: 'maybe', ver: 'v' } } },
    { forgotten: [{ npc: 'cafe-owner' }] }, { townEvents: [{ id: 'E-1', kind: 'memory.forgotten', npc: 'a' }], townSeq: 1 },
    { townEvents: [{ id: 'E-2', kind: 'feedback.removed', completionId: 'life:1' }], townSeq: 1 }, { policy: { visitId: 'V-1', paramsVer: 'town-params-9', arm: 'adapted' } }])
    assert.throws(() => restoreState({ ...fresh, ...broken }, { lifeEnabled: true }), /마을 기록/, JSON.stringify(broken));
});
