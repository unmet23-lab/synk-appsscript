'use strict';
// 계정 호스트(account/world-learning-host.js)를 지나 페이지 꼴로 쓰는 시험(2026-11-10 — Fable 5.2 검수 결함 1 · 2,
// docs/_ops/qa/atlas-defects5-20261110/설계.md §1 · §2). 실제 계정 화면처럼 synk-account scopedStorage를 거친다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const GameLearning = require('../atlas/game-learning');
const Atlas = require('../atlas/engine');
const { createWorldLearningHost } = require('../account/world-learning-host.js');
const { createMap } = require('../strata');
const map = createMap(require('../strata/topik-i').topikMap());
const { KEY } = GameLearning, ROOT_KEY = `${KEY}.device`;
const DAY = 86400000, T0 = Date.parse('2026-12-01T10:00:00Z'), ACCOUNT = 'account.synthetic';
// 브라우저 localStorage처럼 열거 · 5MiB 글자 한도가 있는 저장소.
function disk(limit = 5 * 1024 * 1024) {
  const data = new Map(); let chars = 0;
  return { data, get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, getItem: k => (data.has(k) ? data.get(k) : null),
    setItem(k, v) { v = String(v); const next = chars - (data.has(k) ? k.length + data.get(k).length : 0) + k.length + v.length;
      if (next > limit) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); data.set(k, v); chars = next; },
    removeItem(k) { if (data.has(k)) { chars -= k.length + data.get(k).length; data.delete(k); } }, chars: () => chars };
}
// 서버: 앞 기기가 남긴 기록(1,200건 — 페이지 꼴이 되는 1,024건보다 많다)으로 시작한다.
const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' }, OLD = '2026-11-01T09:00:00.000Z';
const row = (id, type, fields = {}) => ({ schema: 1, id, type, scope, at: OLD, recordedAt: OLD, ...fields });
const graph = n => [row(`d${n}`, 'decision.made', { experienceId: 'practice', variant: 'standard', policy: Atlas.VERSION, evidence: [] }),
  row(`p${n}`, 'practice.presented', { decisionId: `d${n}`, taskId: `t${n}`, taskVersion: '1', itemKey: `old.i${n}`, conceptIds: ['ko.reading.detail'], firstExposure: true,
    measure: { skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, familyKey: `old.f${n}`, audioRequired: false, confounded: false, responseFormat: 'single-choice' } }),
  row(`a${n}`, 'practice.attempted', { presentationId: `p${n}`, attemptNo: 1, verdict: n % 4 ? 'correct' : 'incorrect', errorTags: [] }),
  row(`c${n}`, 'experience.completed', { decisionId: `d${n}`, experienceId: 'practice', variant: 'standard' })];
function server(seed) {
  const s = { log: seed.map(e => JSON.parse(JSON.stringify(e))), ids: new Set(seed.map(e => e.id)) };
  s.transport = { async get({ after }) { const events = s.log.slice(after, after + 200); return { ok: true, events: JSON.parse(JSON.stringify(events)), cursor: after + events.length, hasMore: after + events.length < s.log.length, revision: 1 }; },
    async post({ events }) { for (const e of events) if (!s.ids.has(e.id)) { s.ids.add(e.id); s.log.push(JSON.parse(JSON.stringify(e))); } return { ok: true, accepted: events.map(e => e.id), revision: 1 }; } };
  return s;
}
const skills = map.allNodes().filter(n => n.kind === 'skill' && n.domain === 'reading');
const item = n => ({ id: `item.${n}`, itemKey: `new.i${n}`, familyKey: `new.f${n}`, skillId: skills[n % skills.length].id, modality: 'reading', difficulty: 1, responseFormat: 'single-choice' });
const idle = async host => { for (let i = 0; i < 3000; i += 1) { await new Promise(r => setImmediate(r)); const st = host.status(); if (st.phase !== 'syncing' && !st.queued) return st; } return host.status(); };
// 루트가 가리키지 않고, 진행 중인 쓰기 울타리에도 없는 페이지.
function orphans(storage, prefix) {
  const raw = storage.getItem(prefix + ROOT_KEY), root = raw && JSON.parse(raw), used = new Set();
  if (root?.paged === 1) for (const pages of Object.values(root.arrays)) for (const page of pages) used.add(prefix + page.key);
  return [...storage.data.keys()].filter(k => k.startsWith(`${prefix}${ROOT_KEY}.page.`) && !used.has(k));
}

test('둘째 기기가 계정 호스트로 페이지 꼴 기록을 받아도 헌 페이지가 쌓이지 않고, 이력이 다 모이면 접는다', async () => {
  const { scopedStorage } = await import('../experiences/synk-account/src/core.mjs');
  const s = server(Array.from({ length: 300 }, (_, n) => graph(n)).flat()), raw = disk(), clock = { now: T0 }, counter = { n: 0 };
  const prefix = `synk.account.${ACCOUNT}.r1.`;
  for (let day = 0; day < 3; day += 1) {
    clock.now = T0 + day * DAY;
    const now = () => new Date(clock.now).toISOString();
    const engine = { createGame: o => GameLearning.createGame({ ...o, map, clock: now }), createLearningSync: o => GameLearning.createLearningSync({ ...o, maxAttempts: 1, backoffMs: [0], sleep: async () => {}, maxPages: 100000 }) };
    const host = createWorldLearningHost({ accountKey: ACCOUNT, revision: 1, storage: scopedStorage(raw, ACCOUNT, 1, () => {}), transport: s.transport, guard: () => {}, connected: true, engine, clock: () => clock.now });
    const coach = host.createGame({ gameId: 'world-practice' }, engine.createGame, engine.createLearningSync); await idle(host);
    const before = s.log.length;
    for (let i = 0; i < 30; i += 1) { const it = item(counter.n++); clock.now += 8000; coach.answer(coach.present(it), { correct: i % 3 !== 0, assessable: true }); await idle(host); }
    const st = await idle(host), root = JSON.parse(raw.getItem(prefix + ROOT_KEY));
    assert.equal(st.phase, 'synced', `${day + 1}일째 동기화`); assert.equal(st.queued, 0, `${day + 1}일째 못 보낸 기록`);
    assert.ok(s.log.length >= before + 30 * 3, `${day + 1}일째 서버가 받은 건수 ${s.log.length - before}`);
    assert.deepEqual(orphans(raw, prefix), [], `${day + 1}일째 주인 없는 페이지`);
    assert.equal(root.paged, 1, '페이지 꼴은 그대로');
    assert.ok(root.data.ledger?.folded > 0, `${day + 1}일째 이력이 다 모인 뒤 접는다`);
    assert.ok(root.arrays.events.reduce((n, page) => n + page.count, 0) <= 600, '남는 기록은 접기 한도 안');
    coach.disconnect(); host.stop();
  }
  assert.ok(raw.chars() < 1024 * 1024, `저장 ${raw.chars()}자`);
});

test('호스트는 저장소 열거가 있을 때만 넘기고, 세션이 끝나면 열거도 막는다', () => {
  const plain = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const seen = [], factory = o => { seen.push(o.storage); return GameLearning.createGame({ ...o, map }); };
  const probe = storage => createWorldLearningHost({ accountKey: ACCOUNT, revision: 1, storage, connected: false, guard: () => {} });
  const enumerable = disk(), host = probe(enumerable);
  enumerable.setItem('x', '1');
  host.createGame({ gameId: 'probe' }, factory, () => null).disconnect();
  const given = seen.at(-1);
  assert.equal(typeof given.key, 'function'); assert.ok(given.length >= 1); assert.equal(given.key(0), 'x');
  host.stop();
  assert.throws(() => given.length, { code: 'MEMORY_SESSION_ENDED' }); assert.throws(() => given.key(0), { code: 'MEMORY_SESSION_ENDED' });
  const other = probe(plain); other.createGame({ gameId: 'probe' }, factory, () => null).disconnect();
  assert.equal(seen.at(-1).key, undefined); assert.equal('length' in seen.at(-1), false);
  other.stop();
});
