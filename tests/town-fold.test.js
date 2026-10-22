'use strict';
// 싱크타운 접기와 사건 갈래(세로 조각 설계 §14-2·§14-5, W2 계획 D7·D8·F9·F11) — 세계는 로그를 들지 않고, 문턱을 넘은
// 배열은 읽는 쪽이 아직 닿는 것만 남기고 접는다. 접은 세계는 접지 않은 세계와 똑같이 읽혀야 한다: 같은 입력에서 같은 사건
// 줄(같은 id·같은 원인)이 생기고, 같은 반응(Vellum)·먼저 말 걸기·장면·읽기 제안이 나온다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { ROOT, townModule } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);
// 거의 매번 접히는 문턱. 화면이 읽는 몫(삶의 기억 여섯, 추천의 바로 앞 넷)은 접기 함수가 스스로 지킨다.
const TINY = { facts: 6, deliveries: 1, dayHistory: 3, keepDayHistory: 1, dayEmitted: 6, keepDayEmitted: 2,
  lifeHistory: 1, keepLifeHistory: 1, presentations: 4, keepPresentations: 1 };
const DAY_MS = 86400000;

/** 화면이 첫 하루 기록에서 고르는 것 — 지도의 들른 곳과 장소별 기억 표식(day-app.mjs·day-scene.mjs). */
function screenOf(history = []) {
  const visited = [...new Set(history.map(h => h.location))].sort();
  const markers = new Map();
  for (const h of history) if (['planner', 'delegated'].includes(h.role) && !(h.kind === 'help' && h.choice === 'alone')) markers.set(h.location, h.resultId);
  return { visited, markers: [...markers].sort(([a], [b]) => a.localeCompare(b)) };
}
/** 접히는 칸을 뺀, 두 세계가 똑같아야 하는 몫. 덧붙기만 하는 갈래(사건 줄·영수증)는 놀이꾼이 새 줄만 따로 견준다. */
function readable(answer) {
  const without = (object, keys) => object && Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
  const { trail: _trail, lifeFactIds: _ids, events: _events, commands: _commands, day, life, support, ...state } = answer.state;
  return { state: { ...state, day: without(day, ['history', 'roleEvidence', 'emitted', 'folded']), life: without(life, ['history', 'folded']),
    support: without(support, ['presentations', 'attempts', 'folded']) },
  view: { ...answer.view, day: without(answer.view.day, ['history', 'roleEvidence']) }, screen: screenOf(day?.history) };
}

/** 같은 시계·같은 입력을 접지 않는 저장소와 거의 매번 접는 저장소에 똑같이 보내는 놀이꾼. */
async function monkey(seed, steps) {
  const { createStore } = await townFile('server.mjs');
  const { reactionFor } = await townFile('core.mjs');
  const { createRng } = await townModule('rng');
  const rng = createRng('town-fold', seed);
  let at = 100000, n = 0, receipt = null, seen, lines = 0;
  const plain = createStore({ now: () => at, fold: false }), folded = createStore({ now: () => at, fold: TINY });
  const both = (label, operate) => {
    const outcome = store => { try { return { value: operate(store) }; } catch (error) { if (!error.code) throw error; return { code: error.code }; } };
    const a = outcome(plain), b = outcome(folded);
    assert.equal(b.code, a.code, `${label}: 같은 거절`);
    const p = seen = plain.peek(), f = folded.peek(), left = readable(p), right = readable(f);
    const reactions = state => ['cafe-owner', 'workshop-owner', 'guest'].map(npc => reactionFor(state, npc).selected);
    if (JSON.stringify([right, reactions(f.state)]) !== JSON.stringify([left, reactions(p.state)])) {
      assert.deepEqual(right, left, `${label}: 같은 세계`);
      assert.deepEqual(reactions(f.state), reactions(p.state), `${label}: 같은 반응`);
    }
    // The branches only grow (a reset starts the event lines again): compare what is new.
    if (p.state.events.length < lines) lines = 0;
    assert.equal(f.state.events.length, p.state.events.length, `${label}: 같은 사건 수`);
    assert.deepEqual(f.state.events.slice(lines), p.state.events.slice(lines), `${label}: 같은 사건 줄`);
    assert.deepEqual(f.state.commands.slice(-2), p.state.commands.slice(-2), `${label}: 같은 영수증`);
    lines = p.state.events.length;
    return a.value;
  };
  const presence = (ms, safe) => { at += ms; const out = both(`맥박 ${ms}`, s => s.presence({ surfaceId: 'monkey', surface: 'day', foreground: true, safe })); receipt = out?.presence || receipt; };
  const pulse = ms => { at += ms; const out = both(`임대 ${ms}`, s => s.pulse({ surfaceId: 'monkey', surface: 'day', foreground: true, safe: true })); receipt = out?.presence || receipt; };
  const send = (type, payload = {}) => {
    const { state } = seen, id = `fold-${seed}-${++n}`;
    const scoped = /^(LIFE_|DAY_|BAZAAR_|SUPPORT_)/.test(type) && receipt ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {};
    return both(`${type} ${JSON.stringify(payload)}`, s => s.execute({ id, type, payload: { ...scoped, ...payload }, expectedRevision: state.revision }));
  };
  const options = () => {
    const { state, view } = seen, list = [], add = (type, payload = {}) => list.push([type, payload]);
    for (const a of view.actions || []) add(a.type, a.payload);
    if (view.reaction) add('ACK', { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey, worldRevision: state.worldRevision,
      activity: state.activity, mode: 'static', visible: true, assetsReady: true, appliedStepIds: view.committedStepIds });
    for (const a of view.day?.actions || []) add(a.type, a.payload);
    // One way out per turn, so the player stays long enough for a place's scenes to run.
    if (view.day?.locations) add('DAY_MOVE', { location: rng.pick(view.day.locations).id });
    for (const a of view.life?.interaction?.actions || []) add(a.type, a.payload);
    if (view.life?.interaction?.stage === 'result') add('LIFE_ACK', { resultId: view.life.interaction.resultId, visible: true });
    if (view.life?.contact) { add('LIFE_OPEN', { source: 'contact', contactId: view.life.contact.id }); add('LIFE_ACK', { contactId: view.life.contact.id, visible: true }); }
    add('LIFE_OPEN', { source: 'direct' });
    for (const a of view.bazaar?.actions || []) add(a.type, a.payload);
    const reading = view.support?.reading;
    if (!reading?.open) add('SUPPORT_OPEN');
    else if (!reading.answered) {
      for (let k = 0; k < 3; k++) add('SUPPORT_ANSWER', { presentationId: reading.presentationId, choice: rng.below(reading.item.choices.length) });
      add('SUPPORT_HINT', { presentationId: reading.presentationId });
    } else { add('SUPPORT_NEXT'); add('SUPPORT_NEXT'); add('SUPPORT_CLOSE'); }
    if (view.support?.proposal) add('SUPPORT_ACCEPT', { proposalId: view.support.proposal.id, kind: view.support.proposal.kind });
    return list;
  };
  const wait = seconds => { for (let i = 0; i < seconds; i++) presence(1000, true); };
  const ack = () => { const { state, view } = seen; if (view.reaction) send('ACK', { reactionId: view.reaction.id, semanticKey: view.reaction.semanticKey,
    worldRevision: state.worldRevision, activity: state.activity, mode: 'static', visible: true, assetsReady: true, appliedStepIds: view.committedStepIds }); };
  // Short runs of purposeful play, so the rarer arrays (deliveries, the cafe owner's recollections) grow too.
  const runs = {
    seat() {
      send('DAY_MOVE', { location: 'cafe' }); if (seen.state.day.home.exitTarget) send('DAY_EXIT');
      if (seen.state.phase === 'ready') send('REARRANGE');
      const branch = rng.pick(['inside', 'outside']); send('CHOOSE', { branch }); send('NEXT');
      if (seen.state.phase === 'color') { send('COLOR', { color: rng.pick(['green', 'yellow']) }); send('CRAFT'); }
      send('PLACE', { slot: rng.pick(branch === 'inside' ? ['eaves-left', 'eaves-right'] : ['garden', 'garden-right']) });
      wait(5); ack();
    },
    revisit() { send('LEAVE'); send('VISIT'); wait(5); ack(); },
    sign() { send('SIGN_START'); send('SIGN_NEXT'); send('SIGN_PICTURE', { picture: rng.pick(['chair', 'tea']) });
      send('SIGN_PLACE', { slot: rng.pick(['entrance-left', 'entrance-right']) }); wait(5); ack(); },
    day() {
      const place = rng.pick(['cafe', 'greenhouse', 'workshop']), kind = place === 'workshop' ? 'help' : 'coordination';
      send('DAY_MOVE', { location: place }); if (seen.state.day.home.exitTarget) send('DAY_EXIT');
      send('DAY_START', { kind }); send('DAY_GUIDE_NEXT'); send('DAY_GUIDE_NEXT');
      if (kind === 'help') send('DAY_CHOICE', { choice: rng.pick(['hold', 'prepare', 'alone']) });
      else { const role = rng.pick(['planner', 'observer', 'delegated']); send('DAY_ROLE', { role });
        if (role === 'planner') send('DAY_CHOICE', { choice: rng.pick(['rest', 'separate', 'silent']) }); }
      wait(3); send('DAY_CONTINUE'); send('DAY_CONFIRM'); wait(5);
      if (kind === 'help') { send('DAY_HELP_DIRECTION', { direction: rng.pick(['near', 'clear']) }); send('DAY_HELP_FINISH'); }
      const episode = seen.view.day?.episode;
      if (episode?.resultId) send('DAY_OBSERVED', { resultId: episode.resultId, visible: true });
      send('DAY_CLOSE');
    },
    life() {
      const { state } = seen;
      if (state.phase !== 'ready' || state.pendingUse || !(state.activity === 'sign' ? state.sign.delivered : state.delivered)) runs.seat();
      send('DAY_MOVE', { location: 'cafe' }); if (seen.state.day.home.exitTarget) send('DAY_EXIT');
      send('DAY_WAKE'); send('LIFE_RESUME'); wait(16);
      for (let round = 0; round < 2; round++) {
        send('LIFE_OPEN', { source: 'direct' });
        const role = rng.pick(['planner', 'observer', 'delegated']); send('LIFE_ROLE', { role });
        if (role === 'planner') send('LIFE_DIRECTION', { direction: rng.pick(['near', 'clear']) });
        send('LIFE_CONFIRM'); wait(7);
        const interaction = seen.view.life?.interaction;
        if (interaction?.resultId) send('LIFE_ACK', { resultId: interaction.resultId, visible: true });
        send('LIFE_CLOSE');
      }
    },
  };
  seen = plain.peek(); presence(0, true);
  for (let step = 0; step < steps; step++) {
    const roll = rng.below(1000), { state } = seen;
    // Steer toward play that writes: come back from away, and keep going to the cafe, where most scenes are.
    if (state.phase === 'away' && rng.chance(900)) send('VISIT');
    else if (state.day.location === 'home' && state.day.home.exitTarget && rng.chance(800)) send('DAY_EXIT');
    else if (state.day.location !== 'cafe' && rng.chance(150)) send('DAY_MOVE', { location: 'cafe' });
    else if (rng.chance(70)) runs[rng.pick(['seat', 'revisit', 'revisit', 'sign', 'day', 'day', 'life', 'life'])]();
    else if (roll < 220) presence(1000, rng.chance(800));
    else if (roll < 290) pulse(rng.pick([1000, 1000, 3000]));
    else if (roll < 320) both('경계 신호', s => receipt && s.boundary({ surfaceId: receipt.surfaceId, fence: receipt.fence }));
    else if (roll < 335) both('읽기', s => s.read());
    else if (roll < 345) presence(rng.pick([20000, 45000, 31 * 60000]), true);
    else if (roll < 347) presence(31 * DAY_MS, true);
    else if (roll < 349) send('SUPPORT_SET', { mode: rng.pick(['plain', 'stepwise']) });
    else if (roll < 350) send(rng.chance(300) ? 'RESET' : 'SUPPORT_CLEAR');
    else { const [type, payload] = rng.pick(options()); send(type, payload); }
  }
  return { plain, folded };
}

test('접은 세계는 접지 않은 세계와 똑같이 읽힌다 — 같은 사건 줄·반응·먼저 말 걸기·장면·읽기 제안(놀이꾼 셋)', async () => {
  const reached = new Set();
  for (const seed of ['a', 'b', 'c']) {
    const { plain, folded } = await monkey(seed, 600);
    const big = plain.peek().state, small = folded.peek().state;
    assert.ok(big.trail.seq > 150, `${seed}: 사건이 쌓였다(${big.trail.seq})`);
    assert.ok(Object.keys(small.trail.facts).length < Object.keys(big.trail.facts).length, `${seed}: 색인이 작다`);
    assert.ok(folded.stats().worldBytes < plain.stats().worldBytes, `${seed}: 세계가 작다 ${folded.stats().worldBytes} < ${plain.stats().worldBytes}`);
    for (const [kind, n] of [['facts', Object.entries(small.trail.folded).filter(([type]) => type !== 'life.delivered').length],
      ['deliveries', small.trail.folded['life.delivered'] || 0], ['day.history', Object.keys(small.day.folded?.history || {}).length],
      ['day.emitted', small.day.folded?.emitted || 0], ['life.history', Object.keys(small.life.folded?.history || {}).length],
      ['support', Object.keys(small.support.folded?.presented || {}).length]]) if (n) reached.add(kind);
  }
  assert.deepEqual([...reached].sort(), ['day.emitted', 'day.history', 'deliveries', 'facts', 'life.history', 'support'], '접기 갈래를 모두 지났다');
});

test('접기는 배열마다 읽는 쪽이 닿는 줄을 남긴다 — 가리키는 줄·장소별 마지막·기억 표식·추천의 바로 앞 넷', async () => {
  const { foldDay } = await townFile('day.mjs');
  const { foldLife } = await townFile('life.mjs');
  const row = (i, extra = {}) => ({ resultId: `DAY:${i}:tea:result`, kind: 'tea', role: 'planner', choice: 'sequence', support: 'demo',
    target: { kind: 'base', placement: null, seatRevision: 0 }, location: 'cafe', completedU: i, observedU: null, visit: 1,
    knownBy: ['cafe-owner', 'researcher'], contribution: false, ...extra });
  const day = { visit: 2, episode: { id: 'DAY:3:help', resultId: 'DAY:3:help:result' }, job: null, agreement: { resultId: 'DAY:5:tea:result' },
    history: [row(1, { location: 'greenhouse', kind: 'coordination', choice: 'rest', knownBy: ['workshop-owner', 'researcher'] }),
      row(2, { location: 'workshop', kind: 'help', choice: 'hold', role: 'planner', knownBy: ['workshop-owner'], direction: 'near' }),
      row(3, { resultId: 'DAY:3:help:result', kind: 'help', choice: 'alone', location: 'workshop', knownBy: ['workshop-owner'], direction: 'clear' }),
      row(4, { role: 'observer' }), row(5), ...Array.from({ length: 30 }, (_, i) => row(10 + i, { role: 'observer' }))],
    roleEvidence: [{ resultId: 'DAY:5:tea:result', kind: 'tea', role: 'planner' }, { resultId: 'DAY:2:tea:result', kind: 'help', role: 'planner' }],
    emitted: ['DAY:routine:1:cafe-tidied', 'DAY:routine:2:cafe-tidied', 'DAY:3:help:acted', ...Array.from({ length: 300 }, (_, i) => `DAY:${100 + i}:move:cafe`)] };
  const before = structuredClone(day);
  foldDay(day, { dayHistory: 8, keepDayHistory: 2, dayEmitted: 8, keepDayEmitted: 2 });
  const ids = day.history.map(h => h.resultId);
  for (const id of ['DAY:5:tea:result', 'DAY:3:help:result', 'DAY:1:tea:result', 'DAY:2:tea:result', 'DAY:39:tea:result', 'DAY:38:tea:result']) assert.ok(ids.includes(id), id);
  assert.deepEqual(screenOf(day.history), screenOf(before.history), '지도·기억 표식이 같다');
  assert.deepEqual(day.roleEvidence.map(e => e.resultId), ['DAY:5:tea:result', 'DAY:2:tea:result'].filter(id => ids.includes(id)));
  assert.deepEqual(day.emitted, ['DAY:routine:2:cafe-tidied', 'DAY:3:help:acted', 'DAY:398:move:cafe', 'DAY:399:move:cafe']);
  assert.equal(day.folded.emitted, before.emitted.length - day.emitted.length);
  assert.equal(Object.values(day.folded.history).reduce((a, b) => a + b, 0) + day.history.length, before.history.length);
  const life = { episode: { resultId: 'C1:episode:1:result' }, currentAgreement: { resultId: 'C1:episode:2:result' },
    history: Array.from({ length: 40 }, (_, i) => ({ resultId: `C1:episode:${i + 1}:result`, role: 'observer' })) };
  foldLife(life, { lifeHistory: 4, keepLifeHistory: 1 });
  assert.deepEqual(life.history.map(r => r.resultId), ['C1:episode:1:result', 'C1:episode:2:result', ...Array.from({ length: 6 }, (_, i) => `C1:episode:${35 + i}:result`)],
    '삶의 기억은 화면이 읽는 여섯과 가리키는 줄');
});

test('사건 갈래: 세계는 로그를 들지 않고 응답은 이번 판의 줄을 보여 준다 · 다시 열면 같은 세계 · RESET은 갈래를 새로 연다', async t => {
  const { createStore } = await townFile('server.mjs');
  const { restoreState } = await townFile('core.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-town-fold-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'save.json');
  let at = 100000, n = 0, receipt;
  const store = createStore({ file, now: () => at, fold: TINY });
  const run = (type, payload = {}) => store.execute({ id: `branch-${++n}`, type, expectedRevision: store.peek().state.revision,
    payload: { ...(/^(DAY_|LIFE_)/.test(type) ? { surfaceId: receipt.surfaceId, fence: receipt.fence } : {}), ...payload } });
  receipt = store.presence({ surfaceId: 'a', surface: 'day', foreground: true, safe: true }).presence;
  run('DAY_MOVE', { location: 'cafe' }); if (store.peek().state.day.home.exitTarget) run('DAY_EXIT');
  run('CHOOSE', { branch: 'inside' }); run('NEXT'); run('PLACE', { slot: 'eaves-left' });
  for (let i = 0; i < 12; i++) { at += 1000; receipt = store.presence({ surfaceId: 'a', surface: 'day', foreground: true, safe: true }).presence; }
  for (const location of ['workshop', 'greenhouse', 'cafe', 'workshop', 'cafe']) run('DAY_MOVE', { location });
  const answer = store.read(), saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(answer.state.events.length > TINY.facts, '응답은 이번 판의 사건 줄을 모두 보여 준다');
  assert.deepEqual(saved.events, answer.state.events, '저장(한 파일 꼴)에도 같은 줄');
  assert.ok(Object.keys(saved.trail.facts).length < saved.events.filter(e => e.type === 'life.fact').length, '세계의 색인은 접혔다');
  assert.deepEqual(createStore({ file, now: () => at, fold: TINY }).read(), answer, '다시 열면 같은 세계·같은 줄');
  // 로그를 들지 않은 세계는 색인을 믿고, 모양이 깨진 색인은 거절한다.
  const world = { ...saved, events: [] };
  assert.deepEqual(restoreState(world, { lifeEnabled: true }).trail, saved.trail);
  assert.throws(() => restoreState({ ...world, trail: { ...saved.trail, facts: { 'life:999999': ['seat.placed', []] } } }, { lifeEnabled: true }), /체험 기록/);
  assert.throws(() => restoreState({ ...world, trail: { ...saved.trail, lastSeatPlaced: 'life:1' } }, { lifeEnabled: true }), /체험 기록/);
  const seq = answer.state.trail.seq;
  const reset = run('RESET');
  assert.equal(reset.state.events.length, 0, 'RESET 뒤 응답의 줄은 비었다');
  assert.equal(reset.state.trail.archivedBelow, seq);
  run('CHOOSE', { branch: 'outside' }); run('NEXT');
  const after = store.read();
  assert.ok(after.state.events.length > 0 && after.state.events.every(e => e.seq > seq), '새 판의 줄만');
  assert.deepEqual(createStore({ file, now: () => at }).read().state.events, after.state.events);
});

test('사건이 수천 개 쌓여도 세계는 내용 수에 묶이고(64KB 안) 한 바퀴 비용은 늘지 않는다 — 1만 개는 tools/town-bench.mjs', async () => {
  const { createStore } = await townFile('server.mjs');
  let at = 100000, n = 0, last;
  const store = createStore({ now: () => at });
  const run = (type, payload = {}) => (last = { ...store.execute({ id: `grow-${++n}`, type, expectedRevision: last.state.revision,
    payload: { ...(/^(DAY_|LIFE_)/.test(type) ? { surfaceId: last.presence.surfaceId, fence: last.presence.fence } : {}), ...payload } }), presence: last.presence });
  const pulse = ms => { at += ms; last = store.presence({ surfaceId: 'grow', surface: 'day', foreground: true, safe: true }); };
  const go = location => { run('DAY_MOVE', { location }); if (last.state.day.home.exitTarget) run('DAY_EXIT'); };
  const lap = () => { const started = process.hrtime.bigint(); for (let i = 0; i < 20; i++) { pulse(100); go(i % 2 ? 'home' : 'cafe'); } return Number(process.hrtime.bigint() - started) / 1e6 / 20; };
  pulse(0);
  let cycle = 0, largest = 0, early;
  while (store.stats().lines < 2500) {
    pulse(200); go(cycle % 2 ? 'home' : 'cafe');
    if (cycle % 10 === 0) for (let i = 0; i < 15; i++) pulse(1000);
    largest = Math.max(largest, store.stats().worldBytes);
    if (++cycle === 100) early = lap();
  }
  const { state } = store.peek(), stats = store.stats();
  assert.equal(state.events.length, state.trail.seq, '응답은 쌓인 줄을 다 보여 준다');
  assert.equal(state.commands.length, stats.receipts, '응답은 영수증을 다 보여 준다');
  assert.ok(Object.keys(state.trail.facts).length <= 256 && state.day.emitted.length <= 256 && Object.keys(state.lifeFactIds).length <= 256);
  assert.ok(largest < 64 * 1024, `세계 ${largest}B`);
  const late = lap();
  assert.ok(late < Math.max(5, early * 3), `한 바퀴(맥박 + 명령 한둘) 처음 ${early.toFixed(2)}ms · 나중 ${late.toFixed(2)}ms`);
});

test('세계 창 밖의 오래된 명령도 영수증으로 같은 답을 받고, 내용이 다르면 거절된다', async () => {
  const { createStore, COMMAND_WINDOW } = await townFile('server.mjs');
  const store = createStore();
  const first = { id: 'old-1', type: 'CHOOSE', payload: { branch: 'inside' }, expectedRevision: 0 };
  store.execute(first);
  for (let i = 0; i < COMMAND_WINDOW + 4; i++) store.execute({ id: `fill-${i}`, type: i % 2 ? 'CHOOSE' : 'CANCEL', payload: i % 2 ? { branch: 'inside' } : {}, expectedRevision: store.peek().state.revision });
  const before = store.peek();
  assert.equal(store.execute(first).duplicate, true, '창 밖이어도 같은 요청');
  assert.deepEqual(store.peek(), before, '아무것도 바뀌지 않는다');
  assert.throws(() => store.execute({ ...first, payload: { branch: 'outside' } }), error => error.code === 'conflicting-command');
  assert.equal(store.stats().receipts, COMMAND_WINDOW + 5);
});
