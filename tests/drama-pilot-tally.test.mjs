// 몽골 시범 읽기 전용 집계(tools/드라마시범집계.mjs, 설계 docs/드라마말하기_몽골시범_20261103.md §1 · §7 ⑤)를 합성 자료로 본다.
// 사건은 실제 기록기(learning-entry.cjs)가 리허설 호스트로 서버에 보내는 꼴 그대로 만든다 — 운영 DB는 읽지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import PILOT from '../experiences/drama/pilot/content.mjs';
import { aggregate, report, readParticipants, readDatabase, dramaOnly, personOf } from '../tools/드라마시범집계.mjs';

const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Drama = require('../experiences/drama/pilot/learning-entry.cjs');
const LINES = PILOT.scene.filter((x) => x.type === 'student');
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 5)); };
const ok = (kind, noteKind, trail) => ({ kind: 'result', data: { status: 'ok', transcript: '받아 적은 글', observation: kind === 'pass' ? { kind: 'pass', sure: true } : kind === 'note' ? { kind: 'note', note: { kind: noteKind, word: '도서관' } } : { kind: 'pending' },
  trail: trail || { correct: kind === 'pass' ? true : kind === 'note' ? false : null, assessable: false } } });
const UNHEARD = { kind: 'result', data: { status: 'no_speech', transcript: '', trail: { correct: null, assessable: false, reason: 'unanswered' } } };

// 한 사람의 화면 흐름을 기록기로 돌려 서버로 간 사건을 돌려준다. plan: { scene: [[테이크…]…], note, retake: [테이크…] | undefined, b: [동작…], c: [동작…] }
async function play(plan) {
  const posts = [], win = {};
  const transport = { get: async ({ revision }) => ({ ok: true, events: [], cursor: 0, hasMore: false, revision }), post: async ({ revision, events }) => { posts.push(...events); return { ok: true, revision, accepted: events.map((e) => e.id) }; } };
  Drama.createRehearsalHost({ accountKey: `synthetic-${Math.random().toString(36).slice(2)}`, revision: 1, connected: true, transport, storage: memory(), win });
  const rec = Drama.createRecorder({ win });
  const lines = {};
  plan.scene.forEach((takes, i) => { const L = rec.open({ lineId: LINES[i].id, skillId: LINES[i].skill, phase: 'scene' }); L.help('text'); for (const t of takes) L.take(t); lines[LINES[i].id] = L; });
  if (plan.note) lines[plan.note].help('explanation');
  if (plan.retake) { const line = LINES.find((x) => x.id === (plan.note || LINES[0].id)); const R = rec.open({ lineId: line.id, skillId: line.skill, phase: 'retake' }); R.help('answer'); for (const t of plan.retake) t === 'exclude' ? R.excludeLast() : R.take(t); }
  for (const [key, steps] of [['b', PILOT.transfer], ['c', PILOT.delayed]].map(([k, item]) => [k, plan[k] && { item, steps: plan[k] }]).filter(([, v]) => v).map(([k, v]) => [k, v])) {
    const T = rec.open({ lineId: steps.item.id, skillId: steps.item.skill, phase: 'transfer', lazy: key === 'c' ? true : 'transcribed' });
    for (const s of steps.steps) s === 'hint' ? T.help('answer') : s === 'exclude' ? T.excludeLast() : T.take(s);
  }
  await settle();
  return posts;
}
function memory() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
const B_OK = ok('pass', null, { correct: true, assessable: true }), B_NOTE = ok('note', 'missing', { correct: false, assessable: true });
const ON = { found: true, learningEnabled: true };

async function cohort() {
  return [
    // M01: 끝맺음 노트 → 테이크 2 첫 판정을 「제가 한 말과 달라요」로 뺀 뒤 통과(고침) · B 혼자 해 봄 맞음 · C 맞음
    { no: 'M01', account: ON, events: await play({ scene: [[ok('note', 'ending'), ok('note', 'ending')], [ok('pass')], [ok('pass')]], note: LINES[0].id,
      retake: [ok('note', 'ending'), 'exclude', ok('pass')], b: [{ kind: 'down' }, B_OK], c: [{ kind: 'down' }, ok('pass', null, { correct: true, assessable: true })] }) },
    // M02: 노트 없음(첫 시도 통과) · B 서버 사정 뒤 판정(고칠 점) — C는 아직
    { no: 'M02', account: ON, events: await play({ scene: [[ok('pass')], [ok('pass')], [ok('pass')]], b: [{ kind: 'down' }, { kind: 'off', limit: true }, B_NOTE] }) },
    // M03: 길이 노트 → 테이크 2에서 또 길이 노트 · B 첫 테이크 안 들림 → 판정 없이 지나감
    { no: 'M03', account: ON, events: await play({ scene: [[ok('pass')], [UNHEARD, ok('note', 'length')], [ok('pass')]], note: LINES[1].id, retake: [ok('note', 'length')], b: [UNHEARD, B_OK] }) },
    // M04: 빠진 말 노트 · 테이크 2 건너뜀 · B 모범 먼저
    { no: 'M04', account: ON, events: await play({ scene: [[ok('pass')], [ok('pass')], [ok('hold'), ok('note', 'missing')]], note: LINES[2].id, b: ['hint', B_OK] }) },
    // M05: 끝맺음 노트 → 테이크 2 판정 보류만 · B 판정을 「제가 한 말과 달라요」로 뺌
    { no: 'M05', account: ON, events: await play({ scene: [[ok('note', 'ending')], [ok('pass')], [ok('pass')]], note: LINES[0].id, retake: [ok('hold')], b: [B_OK, 'exclude'] }) },
    // M06: 장면 중간에 멈춤
    { no: 'M06', account: ON, events: await play({ scene: [[ok('pass')]] }) },
    // M07: 계정은 있는데 학습 기록 동의를 안 켬(서버 기록 0)
    { no: 'M07', account: { found: true, learningEnabled: false }, events: [] },
    // M08: 계정 없음(이메일을 다르게 적음)
    { no: 'M08', account: { found: false }, events: [] },
  ];
}

test('§1 분모 줄: (가) 노트 · 고침, (나) B 판정 있음 · 맞음, (다) C 자격 · 창 · 시도 · 맞음, 인식 불명 · 보류', async () => {
  const people = await cohort();
  const bAt = Math.max(...people.flatMap((p) => p.events).map((e) => Date.parse(e.at)));
  const a = aggregate(people, bAt + 8 * 86400000);
  assert.equal(a.participants, 8);
  assert.deepEqual(a.accounts, { found: 7, learningEnabled: 6, withDramaRecord: 6 });
  assert.deepEqual(a.ga, { sceneDone: 5, noNote: 1, noted: 4, fixed: 1, sameAgain: 1, take2Unjudged: 1, take2None: 1, kinds: { ending: 2, length: 1, missing: 1 } });
  assert.deepEqual(a.na, { sceneDone: 5, bSeen: 5, bJudged: 2, bCorrect: 1, bHintFirst: 1, bUnjudged: 1, bExcluded: 1, sceneDoneNoB: 0 });
  assert.deepEqual(a.da, { eligible: 2, beforeWindow: 0, openNotTried: 1, missed: 0, cSeen: 1, cJudged: 1, cCorrect: 1, cHintFirst: 0, cUnjudged: 0, cExcluded: 0 });
  assert.deepEqual(a.recognition, { unheardTakes: 2, unclearTakes: 0, holdTakes: 2, people: 3 });
  assert.equal(a.firstTakeSeconds.people, 6);
  assert.deepEqual(a.rows.map((r) => [r.no, r.account, r.note, r.take2, r.b, r.c]), [
    ['M01', 'on', 'ending', 'fixed', 'correct', 'correct'], ['M02', 'on', null, null, 'incorrect', 'open'], ['M03', 'on', 'length', 'same', 'unjudged', null],
    ['M04', 'on', 'missing', 'none', 'hint', null], ['M05', 'on', 'ending', 'unjudged', 'unjudged', null], ['M06', 'on', null, null, null, null],
    ['M07', 'off', null, null, null, null], ['M08', 'none', null, null, null, null]]);
  // C 창: B 판정 하루 뒤는 창 전, 열하루 뒤는 놓침(0으로 채우지 않고 따로 센다).
  assert.equal(aggregate(people, bAt + 86400000).da.beforeWindow, 1);
  assert.equal(aggregate(people, bAt + 11 * 86400000).da.missed, 1);
});

test('보고: 「N명 중 n명」 꼴, %가 없고 이메일 · 계정 id · 받아 적은 글이 없다', async () => {
  const people = await cohort();
  const text = report(aggregate(people));
  assert.match(text, /노트를 받은 사람 5명 중 4명/);
  assert.match(text, /고친 사람 4명 중 1명/);
  assert.match(text, /B 첫 판정 테이크가 있는 사람 5명 중 2명/);
  assert.ok(!text.includes('%') && !text.includes('@') && !text.includes('받아 적은 글') && !text.includes('도서관'));
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(text));
});

test('노트 종류는 explanation 앞 마지막 판정 시도의 갈래 — 화면 pickNote와 같은 시도(안 들림 · 인식 불명 시도는 건너뜀)', async () => {
  const events = await play({ scene: [[ok('note', 'length'), ok('note', 'ending'), { kind: 'result', data: { status: 'unclear', transcript: '음', trail: { correct: null, assessable: false } } }], [ok('pass')], [ok('pass')]], note: LINES[0].id });
  assert.deepEqual(personOf(events).note, { line: LINES[0].id, kind: 'ending' });
  assert.equal(personOf(events).unclear, 1);
});

test('다른 WORLD 게임 사건 · 다른 문항 뺌은 셈에 넣지 않는다', async () => {
  const events = await play({ scene: [[ok('pass')], [ok('pass')], [ok('pass')]] });
  const other = [{ type: 'practice.presented', id: 'x1', taskId: 'world-speaking.cafe.1', at: events[0].at }, { type: 'practice.attempted', id: 'x2', presentationId: 'x1', attemptNo: 1, verdict: 'correct', at: events[0].at },
    { type: 'record.excluded', id: 'x3', targetId: 'x2', at: events[0].at }, { type: 'decision.made', id: 'x4', at: events[0].at }];
  const kept = dramaOnly([...events, ...other]);
  assert.ok(kept.every((e) => !String(e.id).startsWith('x')));
  assert.equal(kept.filter((e) => e.type === 'practice.attempted').length, 3);
});

test('참가 목록: CSV(머리줄 있음 · 없음) · JSON, 이메일은 소문자로, 같은 번호 · 이메일 · 꼴이 틀린 줄은 멈춤', () => {
  assert.deepEqual(readParticipants('참가번호,이메일\nM01, A@Example.com\nM02,b@example.mn\n'), [{ no: 'M01', email: 'a@example.com' }, { no: 'M02', email: 'b@example.mn' }]);
  assert.deepEqual(readParticipants('[{"번호":"M01","이메일":"a@example.com"}]'), [{ no: 'M01', email: 'a@example.com' }]);
  assert.throws(() => readParticipants('M01,a@example.com\nM01,b@example.com'), /같은 번호/);
  assert.throws(() => readParticipants('M01,a@example.com\nM02,a@example.com'), /같은 이메일/);
  assert.throws(() => readParticipants('M 1,a@example.com'), /꼴이 아니다/);
  assert.throws(() => readParticipants(''), /비었다/);
});

test('DB 읽기: read only 거래 하나에서 SELECT · SET LOCAL만, 연결표의 계정만, 이메일은 결과에 남지 않는다', async () => {
  const people = await cohort();
  const queries = [];
  let mode = null;
  const ids = { 'a@example.com': '00000000-0000-4000-8000-000000000001', 'b@example.com': '00000000-0000-4000-8000-000000000002' };
  const tx = (strings, ...values) => {
    const text = strings.join('?'); queries.push({ text, values });
    if (/from auth\.users/.test(text)) return Promise.resolve(Object.entries(ids).filter(([e]) => values[0].includes(e)).map(([email, id], i) => ({ email, id, learning_enabled: i === 0, status: 'active' })));
    if (/from engine\.synk_learning_events/.test(text)) return Promise.resolve([...people[0].events.map((payload) => ({ id: ids['a@example.com'], payload })), { id: ids['b@example.com'], payload: JSON.stringify({ type: 'practice.presented', id: 'w1', taskId: 'world-speaking.x', at: people[0].events[0].at }) }]);
    return Promise.resolve([]);
  };
  const sql = { begin: async (m, fn) => { mode = m; return fn(tx); } };
  const out = await readDatabase(sql, [{ no: 'M01', email: 'a@example.com' }, { no: 'M02', email: 'b@example.com' }, { no: 'M03', email: 'c@example.com' }]);
  assert.equal(mode, 'read only');
  assert.ok(queries.every((q) => /^\s*(select|set local)/i.test(q.text)), '쓰기 문장 없음');
  assert.ok(queries.some((q) => /statement_timeout/.test(q.text)));
  assert.deepEqual(out.map((p) => [p.no, p.account.found, p.account.learningEnabled ?? null, p.events.length]), [['M01', true, true, people[0].events.filter((e) => e.type !== 'decision.made' && e.type !== 'experience.completed').length], ['M02', true, false, 0], ['M03', false, null, 0]]);
  assert.ok(!JSON.stringify(out).includes('@'));
});

test('명령: --사건 파일로 돌리면 숫자만 찍고, 모르는 인자 · DB 주소 없음은 멈춘다(운영 DB는 읽지 않는다)', async (t) => {
  const people = await cohort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-tally-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'p.csv'), people.map((p, i) => `${p.no},m${i}@example.com`).join('\n'));
  fs.writeFileSync(path.join(dir, 'e.json'), JSON.stringify(Object.fromEntries(people.filter((p) => p.account.found).map((p) => [p.no, { learningEnabled: p.account.learningEnabled, events: p.events }]))));
  const run = (args, env = {}) => spawnSync(process.execPath, ['tools/드라마시범집계.mjs', ...args], { cwd: REPO, encoding: 'utf8', env: { ...process.env, DRAMA_PILOT_READ_DATABASE_URL: '', ...env } });
  const r = run(['--참가', path.join(dir, 'p.csv'), '--사건', path.join(dir, 'e.json')]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /노트를 받은 사람 5명 중 4명/);
  assert.ok(!r.stdout.includes('@'));
  const j = run(['--참가', path.join(dir, 'p.csv'), '--사건', path.join(dir, 'e.json'), '--json']);
  assert.equal(JSON.parse(j.stdout).ga.fixed, 1);
  assert.match(run(['--참가', path.join(dir, 'p.csv'), '--운영']).stderr, /모르는 인자 --운영/);
  assert.match(run(['--참가', path.join(dir, 'p.csv')]).stderr, /DRAMA_PILOT_READ_DATABASE_URL이 없다/);
});
