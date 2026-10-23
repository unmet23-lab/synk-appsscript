'use strict';
// 싱크타운 로컬 저장의 갈래 파일(세로 조각 설계 §14-2·§14-6, W2 계획 D9·F17·F21) — 계정 하나가 폴더 하나다. 명령은 사건 줄·영수증을
// 덧붙인 뒤 세계를 바꿔 끼우고(세계가 확정점), 불러올 때 세계 너머의 줄은 잘라낸다. 옛 한 파일 저장은 읽기 전용 원본으로 두고
// 폴더를 한 번 만든다. 임대 파일은 맥박마다 써서 재시작해도 놀던 시간은 남고, 창과 fence는 남지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROOT, townModule } = require('./lib/town.js');

const townFile = name => import(pathToFileURL(path.join(ROOT, 'experiences/synk-town', name)).href);
const NOON = Date.UTC(2026, 9, 22, 3, 0), KST = 540;
const temporary = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-town-save-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const jsonl = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];

/** 같은 시계로 여는 저장소와 명령 손. */
async function opener(options) {
  const { createStore } = await townFile('server.mjs');
  const clock = { at: NOON };
  const open = (extra = {}) => {
    const store = createStore({ now: () => clock.at, tz: KST, ...options, ...extra });
    let n = 0;
    const run = (type, payload = {}, more) => store.execute({ id: `${options.tag || 's'}-${Date.now()}-${++n}`, type, payload, expectedRevision: store.peek().state.revision }, more);
    return { store, run };
  };
  return { clock, open };
}
/** 사건 줄을 쌓는 짧은 놀이: 자리 놓기와 수첩 명령 몇. */
function play({ store, run }, clock) {
  run('CHOOSE', { branch: 'inside' }); run('NEXT'); run('PLACE', { slot: 'eaves-left' });
  const goal = store.peek().state.goals.inside;
  run('FEEDBACK_GIVE', { completionId: goal, value: 'helpful', canonicalActivityId: 'ft10.seat' }, { seen: ['card:C1:self'] });
  run('PREF_LESS_OFTEN', { activity: 'card.C2', on: true });
  const receipt = store.presence({ surfaceId: 'w', surface: 'day', foreground: true, safe: true }).presence;
  for (let i = 0; i < 5; i++) { clock.at += 1000; store.presence({ surfaceId: 'w', surface: 'day', foreground: true, safe: true }); }
  run('DAY_MOVE', { location: 'cafe', surfaceId: receipt.surfaceId, fence: receipt.fence });
  return goal;
}

test('갈래 폴더: 세계는 로그 없이 최근 영수증만, 사건 줄·영수증은 덧붙고, 다시 열면 같은 답', async t => {
  const dir = path.join(temporary(t), 'account');
  const { clock, open } = await opener({ dir, tag: 'dir' });
  const first = open();
  play(first, clock);
  const answer = first.store.read();
  const { branchPaths } = await townFile('save.mjs');
  const paths = branchPaths(dir);
  const world = JSON.parse(fs.readFileSync(paths.world, 'utf8'));
  assert.deepEqual([world.events, world.townEvents], [[], []], '세계는 사건 줄을 들지 않는다');
  assert.ok(world.commands.length <= 32);
  const lines = jsonl(paths.events);
  assert.deepEqual(lines.filter(line => Number.isSafeInteger(line.seq)), answer.state.events, 'Trail 줄');
  assert.deepEqual(lines.filter(line => line.kind), answer.state.townEvents, '마을 사건');
  assert.deepEqual(jsonl(paths.receipts).map(r => r.id), answer.state.commands.map(r => r.id), '영수증은 덧붙는다');
  assert.deepEqual(JSON.parse(fs.readFileSync(paths.seen, 'utf8')), { 'card:C1:self': 1 });
  assert.ok(fs.existsSync(paths.lease), '임대 파일');
  assert.equal(fs.existsSync(paths.eval), false, '평가 줄이 없으면 파일도 없다');
  assert.deepEqual(open().store.read(), answer, '다시 열면 같은 세계·같은 줄·같은 본 것');
});

test('이관: 옛 한 파일 저장은 읽기 전용 원본 — 폴더를 한 번 만들고 다시는 쓰지 않는다 · 도중에 끊기면 원본에서 다시', async t => {
  const { CONSENT_VER } = await townModule('consent');
  const base = temporary(t), file = path.join(base, 'old.json'), dir = path.join(base, 'old');
  const old = await opener({ file, tag: 'one' });
  const one = old.open();
  play(one, old.clock);
  one.run('EVAL_CONSENT', { state: 'granted', ver: CONSENT_VER });
  one.store.writeVisit({ id: 'V-1', lifeDay: 20748, band: 'day', lengthBucket: '10-30m', paramsVer: 'town-params-1', arm: 'adapted', consentVer: CONSENT_VER });
  const before = one.store.read(), bytes = fs.readFileSync(file, 'utf8');
  const { clock, open } = await opener({ dir, file, tag: 'mig' });
  clock.at = old.clock.at;
  const moved = open();
  assert.deepEqual(moved.store.read(), before, '옮긴 폴더는 옛 저장과 같은 답');
  assert.equal(moved.store.stats().evalLines, 1);
  moved.run('PREF_LESS_OFTEN', { activity: 'card.C4', on: true });
  assert.equal(fs.readFileSync(file, 'utf8'), bytes, '옛 파일은 지우지도 덮지도 않는다');
  const later = moved.store.read();
  assert.deepEqual(open({ file: undefined }).store.read(), later, '폴더만으로도 같은 답');
  // 세계를 쓰기 전에 끊긴 이관(world.json 없음)은 원본에서 다시 한다.
  const { branchPaths } = await townFile('save.mjs');
  const paths = branchPaths(path.join(base, 'cut'));
  fs.mkdirSync(path.dirname(paths.world), { recursive: true });
  fs.writeFileSync(paths.events, '{"seq":999999,"half"');
  fs.writeFileSync(paths.seen, '{"card:C9:self":1}');
  const again = await opener({ dir: path.dirname(paths.world), file, tag: 'cut' });
  again.clock.at = old.clock.at;
  assert.deepEqual(again.open().store.read(), before, '남은 조각은 버리고 원본에서 다시');
});

test('세계 너머의 줄은 불러올 때 잘라낸다 — 끊긴 덧붙이기·확정 전 줄·영수증(F21) · 그 뒤 덧붙이기도 한 번씩', async t => {
  const dir = path.join(temporary(t), 'account');
  const { clock, open } = await opener({ dir, tag: 'cut' });
  const first = open();
  play(first, clock);
  const answer = first.store.read();
  const { branchPaths } = await townFile('save.mjs');
  const paths = branchPaths(dir);
  const committed = { events: fs.statSync(paths.events).size, receipts: fs.statSync(paths.receipts).size };
  const { trail, townSeq, revision } = JSON.parse(fs.readFileSync(paths.world, 'utf8'));
  fs.appendFileSync(paths.events, `${JSON.stringify({ seq: trail.seq + 1, type: 'life.fact', id: `life:${trail.seq + 1}` })}\n${JSON.stringify({ id: `E-${townSeq + 1}`, kind: 'feedback.removed', completionId: 'life:1' })}\n{"seq":`);
  fs.appendFileSync(paths.receipts, `${JSON.stringify({ id: 'never', signature: '{}', revision: revision + 1 })}\n`);
  const reopened = open();
  assert.deepEqual(reopened.store.read(), answer, '확정된 것만');
  assert.deepEqual([fs.statSync(paths.events).size, fs.statSync(paths.receipts).size], [committed.events, committed.receipts], '잘라냈다');
  reopened.run('PREF_APPROACH', { activity: 'card.C1', optOut: true });
  reopened.run('FEEDBACK_REMOVE', { eventId: answer.state.prefs.feedback[0].completionId });
  const seqs = jsonl(paths.events).map(line => line.seq ?? line.id);
  assert.equal(new Set(seqs).size, seqs.length, '같은 줄이 두 번 없다');
  assert.deepEqual(open().store.read(), reopened.store.read());
});

test('저장이 실패하면 아무것도 바뀌지 않고, 다시 하면 줄이 한 번씩만 남는다', async t => {
  const dir = path.join(temporary(t), 'account');
  const { clock, open } = await opener({ dir, tag: 'fail' });
  const { store, run } = open();
  play({ store, run }, clock);
  const before = store.peek();
  const blocker = path.join(dir, `world.json.${process.pid}.tmp`);
  fs.mkdirSync(blocker);
  // 사건 줄과 영수증을 남기는 명령 — 앱은 실패하면 같은 id로 다시 보낸다.
  const command = { id: 'retry-feedback', type: 'FEEDBACK_GIVE', expectedRevision: before.state.revision,
    payload: { completionId: before.state.goals.inside, value: 'want_more', canonicalActivityId: 'ft10.seat' } };
  assert.throws(() => store.execute(command), error => error.code === 'save-failed');
  assert.deepEqual(store.peek(), before, '진행은 그대로');
  fs.rmSync(blocker, { recursive: true });
  assert.equal(store.execute(command).duplicate, false, '처음 확정');
  run('PREF_FAMILY', { family: 'cafe-life', answer: 'yes' });
  const { branchPaths } = await townFile('save.mjs');
  const paths = branchPaths(dir);
  const ids = jsonl(paths.events).map(line => line.id), receipts = jsonl(paths.receipts).map(line => line.id);
  assert.equal(new Set(ids).size, ids.length, '사건 줄 한 번씩');
  assert.equal(new Set(receipts).size, receipts.length, '영수증 한 번씩');
  assert.deepEqual(open().store.read(), store.read());
});

test('임대 파일: 재시작해도 놀던 시간은 남고, 창은 남지 않아 fence가 바뀌며, 꺼져 있던 시간은 놀던 시간이 되지 않는다', async t => {
  const dir = path.join(temporary(t), 'account');
  const { clock, open } = await opener({ dir, tag: 'lease' });
  const { store, run } = open();
  run('CHOOSE', { branch: 'inside' }); run('NEXT'); run('PLACE', { slot: 'eaves-left' });
  const pulse = (s, id = 'w') => s.pulse({ surfaceId: id, surface: 'day', foreground: true, safe: true }).presence;
  const firstReceipt = pulse(store);
  for (let i = 0; i < 8; i++) { clock.at += 1000; pulse(store); }
  assert.equal(store.peek().state.settledU, 0, '맥박은 세계를 쓰지 않는다');
  clock.at += 3600000;
  const restarted = open();
  const settled = restarted.store.read().state;
  assert.equal(settled.settledU, 8000, '재시작 전에 논 8초는 결산된다 · 꺼져 있던 한 시간은 아니다');
  const receipt = pulse(restarted.store, 'w2');
  assert.notEqual(receipt.fence, firstReceipt.fence, '재시작 뒤 첫 창은 새 fence');
  assert.throws(() => restarted.store.boundary({ surfaceId: 'w', fence: firstReceipt.fence }), error => error.code === 'stale-surface', '옛 창은 경계를 열 수 없다');
});

test('동의가 풀린 계정의 평가 줄은 불러올 때도 지운다 · 오래 걸은 영수증 파일은 줄인다', async t => {
  const { CONSENT_VER } = await townModule('consent');
  const { branchPaths } = await townFile('save.mjs');
  const dir = path.join(temporary(t), 'account'), paths = branchPaths(dir);
  const { open } = await opener({ dir, tag: 'eval' });
  const { store, run } = open();
  run('EVAL_CONSENT', { state: 'granted', ver: CONSENT_VER });
  store.writeVisit({ id: 'V-1', lifeDay: 20748, band: 'day', lengthBucket: '10-30m', paramsVer: 'town-params-1', arm: 'adapted', consentVer: CONSENT_VER });
  assert.equal(jsonl(paths.eval).length, 1);
  // 철회가 세계에 들어갔는데 평가 줄 지우기 전에 끊긴 경우.
  const world = JSON.parse(fs.readFileSync(paths.world, 'utf8'));
  world.consents.evalSignals.state = 'withdrawn';
  fs.writeFileSync(paths.world, JSON.stringify(world));
  assert.equal(open().store.stats().evalLines, 0);
  assert.equal(fs.existsSync(paths.eval), false, '파일도 지웠다');
  // 걷기 영수증 2천 줄(512개만 산다) — 불러올 때 파일을 산 영수증만으로 줄인다.
  const walks = Array.from({ length: 2000 }, (_, i) => JSON.stringify({ id: `walk-${i}`, signature: `{"type":"DAY_WALK","n":${i}}`, revision: 1 }));
  fs.appendFileSync(paths.receipts, `${walks.join('\n')}\n`);
  const reopened = open().store, alive = reopened.stats().receipts;
  assert.ok(alive < 600, `산 영수증 ${alive}`);
  assert.equal(jsonl(paths.receipts).length, alive, '파일도 산 것만');
  assert.equal(open().store.stats().receipts, alive);
});
