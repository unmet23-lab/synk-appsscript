// 몽골 학습자 시범(docs/드라마말하기_몽골시범_20261103.md §7)의 학습 기록 둘(2026-11-03):
//  ④ 받아 적기가 막힌 동안 새 상황(B, s1e01-t9)을 쓰지 않는다 — 받아 적기까지 간 테이크가 올 때만 보임 · 시도를 남긴다(lazy 'transcribed').
//  ① 테이크마다 규칙 판정의 갈래(choice: pass · note-… · hold · unclear)와 장면 뒤 코치 노트(도움 explanation)를 남긴다 — 장면 · 테이크 2는
//     그대로 판정 없음(unassessed)이고 받아 적은 글 · 빠진 낱말은 넣지 않는다.
// 학습 기록에 새 칸이 생기면 부모 창(WORLD 계정 묶음)의 Atlas가 그 사건을 모를 때 계정 동기화가 STORAGE_ERROR로 막힌다(11-02 공개본 회귀,
// 현장노트 배포_공개 「공개본 WORLD 계정 묶음의 Atlas 판이 원천보다 뒤처져 있으면…」). 그래서 연결 동기화를 WORLD 계정 묶음의 엔진으로 세워
// 드라마가 쓰게 하고, 그 판이 받는지(synced) · 모르는 판이면 막히는지(blocked — 시험이 회귀를 잡는지)를 함께 본다.
// 공개본 묶음으로도 보려면: DRAMA_LIVE_WORLD_BUNDLE=<내려받은 world-account.bundle.mjs> node --test tests/drama-pilot-record.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import PILOT from '../experiences/drama/pilot/content.mjs';
import { planRevisit } from '../experiences/drama/pilot/takes.mjs';

const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Drama = require('../experiences/drama/pilot/learning-entry.cjs');
const Atlas = require('../atlas/engine.js');
const { createWorldLearningHost } = require('../experiences/synk-account/src/generated/world-learning-host.cjs');
const B = { lineId: PILOT.transfer.id, skillId: PILOT.transfer.skill };
const T6 = { lineId: PILOT.delayed.id, skillId: PILOT.delayed.skill };
const SCENE = PILOT.scene.find((x) => x.type === 'student');
const MISSING = '편의점';
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), dump: () => [...m.values()].join('\n') }; };
const settle = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 5)); };
// 테이크 응답(WORLD 통로 settleTake · 시범 서버 /api/take와 같은 꼴).
const ok = (observation, trail = { correct: observation.kind === 'pass' ? true : observation.kind === 'note' ? false : null, assessable: false }) =>
  ({ kind: 'result', data: { status: 'ok', transcript: '선배님 이 근처에 편의점 있어요', observation, trail } });
const PASS = { kind: 'pass', note: null, sure: true };
const NOTE = (kind) => ({ kind: 'note', note: kind === 'missing' ? { kind, word: MISSING } : { kind, want: 'polite', got: 'plain', at: '헤맸어' }, sure: false });
const HOLD = { kind: 'pending', note: null, sure: false };

// 실제 Atlas 게임 + 메모리 저장소 + 밀 수 있는 시계(tests/drama-world.test.mjs delayedRig와 같은 꼴).
function rig() {
  const box = { now: Date.parse('2026-11-09T03:00:00Z') };
  const mem = memory();
  const owner = { createGame: (meta, factory) => factory({ gameId: meta.gameId, clock: () => new Date(box.now).toISOString(), storage: mem }) };
  return { box, recorder: Drama.createRecorder({ owner }), later: (minutes = 1) => { box.now += minutes * 60000; } };
}

test('④ 받아 적기가 막힌 동안(서버 사정 · 꺼짐 · 오늘 횟수 끝) B는 보임 · 시도가 남지 않고, 받아 적기가 돌아온 날 첫 판정이 혼자 해 봄 → 3일째 C', () => {
  const r = rig();
  const scene = r.recorder.open({ lineId: SCENE.id, skillId: SCENE.skill, phase: 'scene' });
  r.later(); scene.take({ kind: 'down' });
  assert.equal(r.recorder.seen(SCENE.id), true, '장면 줄은 본 것');
  const b = r.recorder.open({ ...B, phase: 'transfer', lazy: 'transcribed' });
  for (const outcome of [{ kind: 'down' }, { kind: 'off' }, { kind: 'down', limit: true }, { kind: 'off', limit: true }]) { r.later(); assert.equal(b.take(outcome), null); }
  assert.equal(b.recorded, false);
  assert.equal(r.recorder.seen(B.lineId), false, 'B는 안 본 것 — 첫 화면에 「남겨 둔 새 상황」 카드');
  // 이틀 뒤 다시 열어 받아 적기가 된 첫 테이크(편의점 — 판정 확신) → 시도 1 · 혼자 해 봄.
  r.box.now += 2 * 86400000;
  const again = r.recorder.open({ ...B, phase: 'transfer', lazy: 'transcribed' });
  const first = again.take(ok(PASS, { correct: true, assessable: true }));
  assert.equal(first.attemptNo, 1); assert.equal(first.verdict, 'correct'); assert.equal(first.independent, true);
  assert.equal(r.recorder.seen(B.lineId), true);
  r.box.now += 3.5 * 86400000;
  const plan = planRevisit(r.recorder.review({ lineIds: [SCENE.id], transferId: B.lineId, delayedId: T6.lineId }), { now: r.box.now });
  assert.equal(plan.delayed, true, 'B를 미뤘어도 C(3일째부터, 설계 §18-2)가 이어진다');
});

test('④ B: 받아 적기까지 간 첫 테이크(안 들림 · 판정 보류 포함)는 B를 쓰고(11-02 규칙 그대로), 모범을 보면 그 자리에서 쓴다', () => {
  const r = rig();
  const b = r.recorder.open({ ...B, phase: 'transfer', lazy: 'transcribed' });
  r.later(); assert.equal(b.take({ kind: 'down' }), null);
  r.later(); const unheard = b.take({ kind: 'result', data: { status: 'no_speech', transcript: '', trail: { correct: null, assessable: false, reason: 'unanswered' } } });
  assert.deepEqual([unheard.attemptNo, unheard.verdict], [1, 'unassessed']);
  r.later(); const judged = b.take(ok(PASS, { correct: true, assessable: true }));
  assert.deepEqual([judged.attemptNo, judged.verdict, judged.independent], [2, 'unassessed', false], '앞 시도가 있으면 혼자 해 봄이 아니다');

  const h = rig();
  const hb = h.recorder.open({ ...B, phase: 'transfer', lazy: 'transcribed' });
  hb.take({ kind: 'down' }); hb.help('answer');
  assert.equal(hb.recorded, true, '모범을 본 B는 쓴 것(다른 날 혼자 해 봄으로 잡히지 않게)');

  // 화면 밖 꼴의 안 들림(kind 'unheard')도 받아 적기까지 간 테이크다(아르곤 B2).
  const u = rig();
  const ub = u.recorder.open({ ...B, phase: 'transfer', lazy: 'transcribed' });
  assert.equal(ub.take({ kind: 'unheard' }).reason, 'unanswered'); assert.equal(ub.recorded, true);
});

test('④ 기록이 덜 모였으면 「본 적 있나」는 모름(null) — 첫 화면은 카드를 내지 않는다', () => {
  const owner = { createGame: (meta, factory) => factory({ gameId: meta.gameId }) };
  assert.equal(Drama.createRecorder({ owner }).seen(B.lineId), null);
  assert.equal(rig().recorder.seen('not a line id'), null);
});

test('① 판정 갈래는 choice로: pass · note-ending/length/missing · hold · unclear, 안 들림 · 꺼짐 · 서버 사정은 없음 — 받아 적은 글 · 빠진 낱말은 없다', () => {
  assert.equal(Drama.judgedAs(ok(PASS).data), 'pass');
  for (const k of ['ending', 'length', 'missing']) assert.equal(Drama.judgedAs(ok(NOTE(k)).data), `note-${k}`);
  assert.equal(Drama.judgedAs(ok(HOLD).data), 'hold');
  assert.equal(Drama.judgedAs(ok({ kind: 'note', note: { kind: 'tone' } }).data), 'hold', '모르는 노트 종류는 보류로');
  assert.equal(Drama.judgedAs({ status: 'unclear', transcript: '뭐라고' }), 'unclear');
  for (const d of [{ status: 'unclear', transcript: ' ' }, { status: 'no_speech', transcript: '' }, null]) assert.equal(Drama.judgedAs(d), null);
  assert.deepEqual(Drama.answerOf(ok(NOTE('missing'))), { correct: false, assessable: false, choice: { selectedId: 'note-missing', correctId: 'pass' } });
  assert.deepEqual(Drama.answerOf({ kind: 'down' }), { correct: null, assessable: false });
  assert.ok(!JSON.stringify(Drama.answerOf(ok(NOTE('missing')))).includes(MISSING));
});

// 장면 한 줄(안 들림 → 끝맺음 노트 → 끝맺음 노트) → 코치 노트 → 테이크 2(길이 노트 → 통과, 「제가 한 말과 달라요」) → B(서버 사정 → 빠진 말 노트).
function playScene(recorder) {
  const line = recorder.open({ lineId: SCENE.id, skillId: SCENE.skill, phase: 'scene' });
  line.help('text');
  line.take({ kind: 'result', data: { status: 'no_speech', transcript: '', trail: { correct: null, assessable: false, reason: 'unanswered' } } });
  line.take(ok(NOTE('ending')));
  line.take({ kind: 'result', data: { status: 'unclear', transcript: '헤맸', trail: { correct: null, assessable: false } } });
  line.take(ok(NOTE('ending')));
  line.help('explanation');
  const retake = recorder.open({ lineId: SCENE.id, skillId: SCENE.skill, phase: 'retake' });
  retake.help('answer');
  retake.take(ok(NOTE('length')));
  retake.take(ok(PASS));
  retake.excludeLast();
  const b = recorder.open({ ...B, phase: 'transfer', lazy: 'transcribed' });
  b.take({ kind: 'down' });
  b.take(ok(NOTE('missing'), { correct: false, assessable: true }));
}
function checkPosts(posts) {
  const attempts = posts.filter((e) => e.type === 'practice.attempted');
  assert.deepEqual(attempts.map((e) => [e.attemptNo, e.verdict, e.reason ?? null, e.choice?.selectedId ?? null]), [
    [1, 'unassessed', 'unanswered', null], [2, 'unassessed', null, 'note-ending'], [3, 'unassessed', null, 'unclear'], [4, 'unassessed', null, 'note-ending'],
    [1, 'unassessed', null, 'note-length'], [2, 'unassessed', null, 'pass'],
    [1, 'incorrect', null, 'note-missing']]);
  assert.ok(attempts.every((e) => !e.choice || e.choice.correctId === 'pass'));
  const presented = posts.filter((e) => e.type === 'practice.presented');
  assert.deepEqual(presented.map((e) => e.taskId), [`drama-s1.scene.${SCENE.id}`, `drama-s1.retake.${SCENE.id}`, `drama-s1.transfer.${B.lineId}`], 'B는 서버 사정 테이크로 보이지 않고 판정 테이크에서 보임');
  const helped = posts.filter((e) => e.type === 'practice.helped');
  assert.deepEqual(helped.map((e) => [e.presentationId === presented[0].id ? 'scene' : 'retake', e.level, e.contentRef]),
    [['scene', 'cue', 'drama-s1.text'], ['scene', 'explanation', 'drama-s1.explanation'], ['retake', 'answer', 'drama-s1.answer']]);
  const excluded = posts.filter((e) => e.type === 'record.excluded');
  assert.deepEqual(excluded.map((e) => e.targetId), [attempts[5].id]);
  const sent = JSON.stringify(posts);
  assert.ok(!sent.includes(MISSING) && !sent.includes('헤맸') && !sent.includes(SCENE.text), '받아 적은 글 · 빠진 낱말 · 대사 글은 사건에 없다');
}

test('① 장면 한 바퀴의 사건: 갈래 · 노트 · 테이크 2 · 뺌이 남고, 서버 Trail 검증기를 통과한다(리허설 호스트)', async () => {
  const posts = [], storage = memory(), win = {};
  const transport = { get: async ({ revision }) => ({ ok: true, events: [], cursor: 0, hasMore: false, revision }), post: async ({ revision, events }) => { posts.push(...events); return { ok: true, revision, accepted: events.map((e) => e.id) }; } };
  Drama.createRehearsalHost({ accountKey: 'synthetic-record-1', revision: 1, connected: true, transport, storage, win });
  playScene(Drama.createRecorder({ win }));
  await settle();
  checkPosts(posts);
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  assert.deepEqual(Atlas.validateIncrement({ scope, events: posts }).map((e) => e.id), posts.map((e) => e.id));
  assert.doesNotThrow(() => Atlas.createSession({ scope, events: posts }));
  assert.ok(!storage.dump().includes(MISSING), '기기 저장에도 빠진 낱말이 없다');
});

// 부모 창(WORLD)의 연결 동기화를 그 묶음의 엔진으로 세우고 드라마가 쓰게 한다 — 11-02 회귀가 난 길.
async function parentSync(bundleFile) {
  const W = await import(pathToFileURL(bundleFile).href);
  const posts = [], statuses = [];
  const transport = { get: async ({ revision }) => ({ ok: true, events: [], cursor: 0, hasMore: false, revision }), post: async ({ revision, events }) => { posts.push(...events); return { ok: true, revision, accepted: events.map((e) => e.id) }; } };
  const host = createWorldLearningHost({ accountKey: 'synthetic-parent-1', revision: 1, connected: true, guard: () => {}, storage: memory(), transport,
    engine: { createGame: W.worldLearning.engine.createGame, createLearningSync: W.worldLearning.createLearningSync }, onStatus: (s) => statuses.push(s) });
  await host.ready?.(); await settle();
  const recorder = Drama.createRecorder({ owner: host });
  playScene(recorder); recorder.flush();
  await settle();
  return { status: host.status(), posts };
}
// 같은 묶음에서 한 낱말 목록만 옛 판처럼 뺀 사본(옆 모듈 life-content.mjs를 함께 둔다).
function olderCopy(t, from, to) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-parent-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const src = path.join(REPO, 'experiences/synk-world-app');
  const text = fs.readFileSync(path.join(src, 'world-account.bundle.mjs'), 'utf8');
  assert.ok(text.includes(from), `묶음에 ${from}가 있다`);
  fs.writeFileSync(path.join(dir, 'world-account.bundle.mjs'), text.split(from).join(to));
  fs.copyFileSync(path.join(src, 'life-content.mjs'), path.join(dir, 'life-content.mjs'));
  return path.join(dir, 'world-account.bundle.mjs');
}

test('① 부모 창 WORLD 계정 묶음(원천)의 Atlas가 새 사건을 받는다 — 동기화 synced, 드라마 사건이 모두 올라간다', async () => {
  const { status, posts } = await parentSync(path.join(REPO, 'experiences/synk-world-app/world-account.bundle.mjs'));
  assert.deepEqual([status.phase, status.code, status.queued, status.durable], ['synced', null, 0, true]);
  checkPosts(posts);
});

test('① 시험이 회귀를 잡는다: 응답 꼴 spoken · 도움 explanation을 모르는 판이면 동기화가 STORAGE_ERROR로 막힌다', async (t) => {
  for (const [from, to] of [['"action","spoken","unknown"', '"action","unknown"'], ['"cue","explanation","answer"', '"cue","answer"']]) {
    const { status } = await parentSync(olderCopy(t, from, to));
    assert.deepEqual([status.phase, status.code], ['blocked', 'STORAGE_ERROR'], from);
  }
});

test('① 공개본 WORLD 계정 묶음으로도 동기화가 막히지 않는다(내려받은 파일이 있을 때만)', { skip: !process.env.DRAMA_LIVE_WORLD_BUNDLE }, async () => {
  const { status, posts } = await parentSync(path.resolve(process.env.DRAMA_LIVE_WORLD_BUNDLE));
  assert.deepEqual([status.phase, status.code], ['synced', null]);
  checkPosts(posts);
});

test('화면: B는 받아 적기까지 간 테이크로만 열고, 받아쓰기를 못 쓰면 남겨 두며, 코치 노트를 그 줄의 도움으로 남긴다', () => {
  const pilot = fs.readFileSync(path.join(REPO, 'experiences/drama/pilot/pilot.mjs'), 'utf8');
  assert.match(pilot, /phase: 'transfer', lazy: delayed \? true : 'transcribed' \}/);
  assert.match(pilot, /while \(!delayed && inWorld\(\) && T\.trail && !T\.trail\.recorded && !analysisCapable\(\)\)/);
  assert.match(pilot, /if \(cand\) S\.lines\.get\(cand\.item\.id\)\?\.trail\?\.help\('explanation'\)/);
  assert.match(pilot, /if \(ctx\.phase === 'scene'\) L\.trail = P;/);
  // 남겨 둔 B에서는 모범 보기를 숨긴다(B를 쓰지 않는 길만 남긴다).
  assert.match(pilot, /!T\.revealed && !held \? h\('button'/);
  // 같은 장면 줄을 다시 그려도 보임을 새로 열지 않고(아르곤 A2), 첫 화면에서 연 B를 떠나면 그 판 상태를 비운다(아르곤 A1).
  assert.match(pilot, /if \(ctx\.phase === 'scene' && L\.trail !== undefined\) P = L\.trail;/);
  // 첫 화면 B 카드는 장면 학생 줄을 모두 본 계정에만(Fable F1).
  assert.match(pilot, /return lines\.every\(\(v\) => v === true\) \? true :/);
  assert.match(pilot, /function backToIntro\(kind\) \{\r?\n if \(kind === 'held'\) S\.transfer = null;/);
  assert.doesNotMatch(pilot.slice(pilot.indexOf('async function runTransfer'), pilot.indexOf('function heldPanel')), /return intro\(\)/, '첫 화면으로는 backToIntro로만');
});
