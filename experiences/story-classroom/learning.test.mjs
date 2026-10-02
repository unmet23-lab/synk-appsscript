import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { StoryGame } from './core.mjs';
import { EPISODE } from './story.mjs';
import { createStoryLearning, missionMetadata, missionCandidates, resolveLearningHost, skillReport } from './learning.mjs';
import { scopedStorage } from '../synk-account/src/core.mjs';
const require = createRequire(import.meta.url);
const Atlas = require('../../atlas/game-browser.js');
const { createWorldLearningHost } = require('../../account/world-learning-host.js');
const snack = EPISODE.acts[0].missions[0], paper = EPISODE.acts[0].missions[1];

function store() {
  const data = new Map();
  return { data, failWrites: false, getItem: k => data.get(k) ?? null,
    setItem(k, v) { if (this.failWrites) throw new Error('Synthetic quota failure'); data.set(k, v); },
    removeItem: k => data.delete(k) };
}
function local(storage = store()) {
  const learning = createStoryLearning({ runtime: {}, storage, createGame: Atlas.createGame });
  learning.beginRun();
  return { learning, storage };
}
const response = (mission, correct = true) => ({ mission, correct, kind: correct ? 'correct' : 'destination' });
const answer = (learning, mission, correct = true, attemptNo = 1) => learning.recordResponse(response(mission, correct), { attemptNo });
const attempts = learning => learning.coach.events().filter(e => e.type === 'practice.attempted');
function bucket(learning, mission) { const m = missionMetadata(mission); return learning.summary().skills.find(s => s.id === m.skillId).levels[m.difficulty].formats.action; }

test('all nine authored missions map to existing reading skills and distinct changed texts', () => {
  const all = [...EPISODE.acts.flatMap(a => a.missions), ...EPISODE.review];
  const metas = all.map(missionMetadata);
  assert.equal(new Set(metas.map(m => m.itemKey)).size, 9);
  assert.equal(new Set(metas.map(m => m.familyKey)).size, 9);
  assert.ok(metas.every(m => m.modality === 'reading' && m.responseFormat === 'action' && !m.audioRequired && !m.confounded));
  assert.equal(missionMetadata(paper).skillId, 'ko.reading.negation');
  assert.equal(missionMetadata(EPISODE.review[2]).skillId, 'ko.reading.sequence');
  assert.notEqual(missionMetadata(snack).familyKey, missionMetadata(EPISODE.review[0]).familyKey);
  assert.throws(() => missionMetadata({ id: 'unreviewed-story' }), /Authored/);
});

test('visible first reading response is independent without requiring audio delivery', () => {
  const { learning } = local();
  assert.equal(learning.present(snack, { visible: false }), null);
  assert.equal(learning.coach.events().filter(e => e.type === 'practice.presented').length, 0);
  const pid = learning.present(snack);
  assert.equal(learning.present(snack), pid);
  const result = answer(learning, snack);
  assert.equal(result.verdict, 'correct'); assert.equal(result.independent, true);
  assert.equal(bucket(learning, snack).n, 1);
  assert.equal(learning.coach.events().filter(e => e.type === 'practice.helped').length, 0);
  assert.equal(learning.summary().grade, null); assert.equal(learning.summary().learningEffectClaim, false);
});

test('duplicate or contradictory UI callbacks preserve one original event', () => {
  const { learning } = local(); learning.present(snack);
  const original = answer(learning, snack);
  original.independent = false;
  const duplicate = answer(learning, snack, false);
  assert.equal(duplicate.eventId, original.eventId); assert.equal(duplicate.verdict, 'correct'); assert.equal(duplicate.independent, true);
  assert.equal(attempts(learning).length, 1);
  assert.equal(learning.recordResponse({ ...response(snack), kind: 'already' }, { attemptNo: 2 }), null);
  assert.equal(attempts(learning).length, 1);
});

test('a wrong first answer and corrected retry remain one independent wrong item', () => {
  const { learning } = local(); learning.present(paper);
  const first = answer(learning, paper, false);
  learning.help(paper.id, { kind: 'text', revealsAnswer: true, requestId: 'shown-explanation' });
  const retry = answer(learning, paper, true, 2);
  assert.equal(first.independent, true); assert.equal(retry.independent, false);
  assert.equal(retry.verdict, 'correct'); assert.equal(attempts(learning).length, 2);
  assert.equal(bucket(learning, paper).n, 1); assert.equal(bucket(learning, paper).incorrect, 1); assert.equal(bucket(learning, paper).correct, 0);
});

test('explicit text explanation prevents a supported answer becoming independent', () => {
  const { learning } = local(); learning.present(snack);
  learning.help(snack.id, { kind: 'text', revealsAnswer: true, requestId: 'hint-on-screen' });
  learning.help(snack.id, { kind: 'text', revealsAnswer: true, requestId: 'hint-on-screen' });
  assert.equal(answer(learning, snack).independent, false);
  assert.equal(learning.coach.events().filter(e => e.type === 'practice.helped').length, 1);
  assert.equal(bucket(learning, snack).n, 0); assert.equal(bucket(learning, snack).assisted, 1);
});

test('actual semantic audio is assistance; a failed click or irrelevant dialogue is not', () => {
  const audio = local().learning; audio.present(paper);
  audio.help([paper.id, paper.id], { kind: 'audio', source: 'mission', requestId: 'mission-started' });
  assert.equal(answer(audio, paper).independent, false); assert.equal(bucket(audio, paper).assisted, 1);
  const failedClick = local().learning; failedClick.present(paper);
  // Root does not call help when playback never starts. Empty clue IDs also do nothing.
  assert.deepEqual(failedClick.help([], { kind: 'audio', source: 'dialogue' }), []);
  assert.equal(answer(failedClick, paper).independent, true);
});

test('intro audio assistance waits for visible mission presentation', () => {
  const { learning } = local();
  learning.help([paper.id], { kind: 'audio', source: 'dialogue', requestId: 'intro-negative-clue' });
  assert.equal(learning.coach.events().filter(e => e.type === 'practice.presented').length, 0);
  learning.present(paper);
  assert.equal(answer(learning, paper).independent, false);
  assert.equal(learning.coach.events().filter(e => e.type === 'practice.helped').length, 1);
});

test('audio help after a response never retroactively erases its first independence', () => {
  const { learning } = local(); learning.present(snack); answer(learning, snack);
  learning.help(snack.id, { kind: 'audio', source: 'feedback', requestId: 'later-reaction' });
  assert.equal(bucket(learning, snack).n, 1); assert.equal(bucket(learning, snack).correct, 1);
});

test('same family replay is repeated while changed review wording remains new', () => {
  const { learning } = local(); learning.present(snack); answer(learning, snack);
  learning.resetRun(); learning.present(snack);
  assert.equal(answer(learning, snack).independent, false);
  const changed = EPISODE.review[0]; learning.present(changed);
  assert.equal(answer(learning, changed).independent, true);
  assert.equal(bucket(learning, snack).n, 2);
});

test('restored answered game state cannot manufacture a new independent first answer', () => {
  const { learning } = local(); learning.beginRun({ restored: true });
  learning.present(snack, { record: { attempts: 2, helpUsed: false, audioHelpUsed: false } });
  const result = answer(learning, snack, true, 3);
  assert.equal(result.gameAttemptNo, 3); assert.equal(result.attemptNo, 1);
  assert.equal(result.historical, true); assert.equal(result.verdict, 'unassessed'); assert.equal(result.independent, false);
  assert.equal(bucket(learning, snack).n, 0);
});

test('restored zero-answer audio aid remains supported rather than independent', () => {
  const { learning } = local(); learning.beginRun({ restored: true });
  learning.present(paper, { record: { attempts: 0, audioHelpUsed: true, audioHelps: [{ source: 'mission' }] } });
  assert.equal(answer(learning, paper).independent, false); assert.equal(bucket(learning, paper).assisted, 1);
});

test('real StoryGame undo and retry preserve first semantic evidence', () => {
  const { learning } = local(); const game = new StoryGame();
  while (game.phase !== 'play') game.advance();
  for (const m of game.missions) learning.present(m);
  game.selectActor(snack.actor); game.selectObject(snack.object);
  let result = game.place(snack.destination);
  const first = learning.recordResponse(result, { attemptNo: game.records.find(r => r.id === snack.id).attempts });
  game.undo(); game.selectActor(snack.actor); game.selectObject(snack.object); result = game.place(snack.destination);
  const retry = learning.recordResponse(result, { attemptNo: game.records.find(r => r.id === snack.id).attempts });
  assert.equal(first.independent, true); assert.equal(retry.independent, false);
  assert.equal(game.records.find(r => r.id === snack.id).firstCorrect, true); assert.equal(bucket(learning, snack).n, 1);
});

test('missed attempt callbacks fail closed instead of skipping to a new first success', () => {
  const { learning } = local(); learning.present(snack);
  assert.equal(answer(learning, snack, true, 2), null);
  assert.equal(attempts(learning).length, 0); assert.equal(learning.status().code, 'INCOMPLETE_GAME_ATTEMPTS');
  assert.equal(learning.progressScope().key, null);
});

test('local storage failure is surfaced and excludes independent evidence', () => {
  const { learning, storage } = local(); const preserved = storage.getItem(Atlas.KEY + '.device');
  storage.failWrites = true; learning.present(snack); const result = answer(learning, snack);
  assert.equal(result.verdict, 'unassessed'); assert.equal(result.independent, false);
  assert.equal(learning.status().available, false); assert.match(learning.status().warning, /저장/);
  assert.equal(storage.getItem(Atlas.KEY + '.device'), preserved);
  assert.equal(bucket(learning, snack).n, 0);
});

test('recommendation consumes real Atlas reading/action evidence and keeps source candidates', () => {
  const { learning } = local();
  for (let i = 0; i < 3; i++) {
    const meta = { ...missionMetadata(snack), id: `synthetic.detail.${i}`, itemKey: `synthetic.detail.${i}`, familyKey: `synthetic.detail.${i}` };
    const pid = learning.coach.present(meta); learning.coach.answer(pid, { correct: false, assessable: true });
  }
  const plan = learning.recommend();
  assert.equal(plan.status, 'ready'); assert.equal(plan.focusSkillId, 'ko.reading.detail'); assert.equal(plan.state, 'practice');
  assert.equal(plan.selected.missionId, 'review-snacks');
  assert.ok(missionCandidates(EPISODE.review).some(c => c.id === plan.selected.id));
  const report = skillReport(learning.summary()); assert.equal(report.find(s => s.id === 'ko.reading.detail').independent, 3);
});

function syntheticWorld({ connected = true, offline = false } = {}) {
  const raw = store(), uploaded = new Map(); let revoked = false, unavailable = offline, posts = 0;
  const guard = () => { if (revoked) throw Object.assign(new Error('Synthetic ended session'), { code: 'SESSION_REVOKED' }); };
  const transport = {
    async get({ after }) { if (unavailable) throw Object.assign(new Error('Synthetic offline'), { code: 'NETWORK_ERROR' }); const events = [...uploaded.values()]; return { ok: true, revision: 1, cursor: events.length, hasMore: false, events: events.slice(after) }; },
    async post({ events }) { posts++; for (const e of events) uploaded.set(e.id, e); return { ok: true, revision: 1, accepted: events.map(e => e.id) }; },
  };
  const host = createWorldLearningHost({ accountKey: 'synthetic-story-account', revision: 1, connected, guard,
    storage: scopedStorage(raw, 'synthetic-story-account', 1, guard), transport });
  const learning = createStoryLearning({ runtime: {}, host, storage: { getItem() { throw new Error('Guest store must never be read'); } },
    createGame: options => host.createGame(options, Atlas.createGame, (config) => Atlas.createLearningSync({ ...config, maxAttempts: 1, auto: false })) });
  learning.beginRun();
  return { learning, host, raw, uploaded, posts: () => posts, revoke: () => { revoked = true; }, reconnect: () => { unavailable = false; } };
}

test('synthetic WORLD host preserves account/guest isolation and deduplicates transport events', async () => {
  const world = syntheticWorld();
  try {
    await world.learning.retry(); assert.equal(world.learning.status().scope, 'account');
    assert.equal(world.learning.status().phase, 'synced'); assert.equal(world.learning.status().evidenceComplete, true);
    world.learning.present(snack); const result = answer(world.learning, snack);
    assert.equal(result.independent, true); answer(world.learning, snack); await world.learning.retry();
    assert.equal([...world.uploaded.values()].filter(e => e.type === 'practice.attempted').length, 1);
    const progress = world.learning.progressScope(); assert.equal(progress.scope, 'account'); assert.equal(progress.persistent, true);
    assert.notEqual(progress.key, local().learning.progressScope().key);
    assert.ok([...world.raw.data.keys()].every(k => k.startsWith('synk.account.synthetic-story-account.r1.')));
    assert.equal(world.learning.summary().storage.scope, 'account');
  } finally { world.learning.dispose(); world.host.stop(); }
});

test('synthetic offline WORLD exposes retry and incomplete history, then recovers', async () => {
  const world = syntheticWorld({ offline: true });
  try {
    await world.learning.retry(); assert.equal(world.learning.status().phase, 'offline'); assert.equal(world.learning.status().canRetry, true);
    world.learning.present(paper); assert.equal(answer(world.learning, paper).independent, false);
    world.reconnect(); await world.learning.retry();
    assert.equal(world.learning.status().phase, 'synced'); assert.equal(world.learning.status().canRetry, false);
    assert.equal([...world.uploaded.values()].filter(e => e.type === 'practice.attempted').length, 1);
  } finally { world.learning.dispose(); world.host.stop(); }
});

test('sharing-off synthetic account remains account-local without guest progress or transport', async () => {
  const world = syntheticWorld({ connected: false });
  try {
    world.learning.present(snack); answer(world.learning, snack); await world.learning.retry();
    assert.equal(world.learning.status().scope, 'account'); assert.equal(world.learning.status().phase, 'local');
    // The host now exposes its stable account partition even in local-only mode.
    // Sharing off may keep this account's progress, but never guest progress or uploads.
    assert.equal(world.learning.progressScope().key, 'synk.story-classroom.progress.v3.account.synthetic-story-account.r1'); assert.equal(world.posts(), 0); assert.equal(world.uploaded.size, 0);
  } finally { world.learning.dispose(); world.host.stop(); }
});

test('revoked or changed WORLD owner fails closed and never falls back to guest records', async () => {
  const world = syntheticWorld();
  try {
    await world.learning.retry(); world.learning.present(snack); world.revoke();
    assert.equal(answer(world.learning, snack), null); assert.equal(world.learning.progressScope().key, null);
    assert.equal(world.learning.status().code, 'SESSION_REVOKED');
  } finally { world.host.stop(); }
  const runtime = {}; const localRun = createStoryLearning({ runtime, storage: store(), createGame: Atlas.createGame });
  localRun.beginRun(); runtime.SYNKLearningHost = { status: () => ({ phase: 'local' }) };
  assert.equal(localRun.present(snack), null); assert.equal(localRun.status().phase, 'ended'); assert.equal(localRun.progressScope().key, null);
});

test('same-origin parent host is accepted while unrelated origins have no implicit account access', () => {
  const host = {}; const runtime = { location: { origin: 'http://127.0.0.1:4280' }, parent: { location: { origin: 'http://127.0.0.1:4280' }, SYNKLearningHost: host } };
  assert.equal(resolveLearningHost(runtime), host);
  runtime.parent.location.origin = 'http://127.0.0.1:5213'; assert.equal(resolveLearningHost(runtime), null);
  const locked = { location: { origin: 'x' }, parent: { get location() { throw new Error('Cross origin'); } } };
  assert.equal(resolveLearningHost(locked), null);
});

test('missing learning bundle leaves game practice available without inventing login or storage', () => {
  const learning = createStoryLearning({ runtime: {} }); learning.beginRun();
  assert.equal(learning.present(snack), null); assert.equal(learning.summary(), null); assert.equal(learning.recommend(), null);
  assert.equal(learning.status().available, false); assert.equal(learning.status().scope, 'device');
  learning.dispose(); learning.dispose(); assert.equal(learning.progressScope().key, null);
});

test('the help style chosen at the hub sets automatic reading at the start, through Core’s own mapping', () => {
  const runtime = { SynkLearning: { Flow: Atlas.Flow } };
  const withChoice = presentation => createStoryLearning({ runtime, coach: { presentation: () => presentation } }).voiceDefault();
  assert.equal(withChoice({ support: 'independent' }), false, 'working alone: the request is read only when asked');
  assert.equal(withChoice({ support: 'step' }), true, 'step by step: read aloud by itself');
  assert.equal(withChoice({ support: 'choose' }), true);
  assert.equal(withChoice(null), true, 'nothing chosen keeps today’s default');
  assert.equal(createStoryLearning({ runtime, coach: { presentation: () => { throw new Error('storage'); } } }).voiceDefault(), true);
  assert.equal(createStoryLearning({ runtime: {}, coach: { presentation: () => ({ support: 'independent' }) } }).voiceDefault(), true, 'no engine, no change');
  // The whole chain: the hub stores the choice on this device, the story reads it back.
  const storage = store(), hub = Atlas.createGame({ gameId: 'learning-hub', storage });
  hub.setPresentation({ support: 'independent' });
  assert.equal(createStoryLearning({ runtime: { SynkLearning: Atlas }, storage }).voiceDefault(), false);
});
