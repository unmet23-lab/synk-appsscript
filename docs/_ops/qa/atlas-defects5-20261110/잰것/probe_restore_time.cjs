'use strict';
// 2만 건 복원 시험(tests/atlas-learning-pages.test.js)과 같은 꼴로, 복원 · 접기의 어느 단계가 오래 걸리는지 잰다.
const ROOT = process.argv[2].split(require('node:path').sep).join('/');
const N = Number(process.argv[3] || 5001);
const { createGame, createLearningSync } = require(ROOT + '/atlas/game-learning');
const Ledger = require(ROOT + '/atlas/learning-ledger');
const Temper = require(ROOT + '/atlas/temper');
const { createMap } = require(ROOT + '/strata');
const map = createMap(require(ROOT + '/strata/maps/topik-i.json'));
const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' }, at = '2026-08-01T00:00:00.000Z';
const row = (id, type, fields = {}) => ({ schema: 1, id, type, scope, at, recordedAt: at, ...fields });
// 시험 파일의 graph()와 같은 꼴: 결정 · 제시 · 답 · 마침.
const Atlas = require(ROOT + '/atlas/engine');
const graph = n => [row('d' + n, 'decision.made', { experienceId: 'practice', variant: 'standard', policy: Atlas.VERSION, evidence: [] }),
  row('p' + n, 'practice.presented', { decisionId: 'd' + n, taskId: 'task', taskVersion: '1', itemKey: 'i' + n, conceptIds: ['ko.reading.detail'], firstExposure: true,
    measure: { skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, familyKey: 'f' + n, audioRequired: false, confounded: false, responseFormat: 'single-choice' } }),
  row('a' + n, 'practice.attempted', { presentationId: 'p' + n, attemptNo: 1, verdict: 'correct', errorTags: [] }),
  row('c' + n, 'experience.completed', { decisionId: 'd' + n, experienceId: 'practice', variant: 'standard' })];
const disk = () => { const data = new Map(); return { data, get length() { return data.size; }, key: i => [...data.keys()][i] ?? null, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; };
const network = events => ({ calls: { get: 0, post: 0 }, async get({ after }) { this.calls.get++; const page = events.slice(after, after + 200); return { ok: true, events: page, cursor: after + page.length, hasMore: after + page.length < events.length, revision: 1 }; }, async post() { this.calls.post++; return { ok: true, accepted: [], revision: 1 }; } });
const t = () => Number(process.hrtime.bigint() / 1000000n);
// 단계별 시간: Ledger.plan · Ledger.fold · Temper.sealFollowups를 감싸 잰다.
const spent = { plan: 0, fold: 0, seal: 0, calls: { plan: 0, fold: 0, seal: 0 } };
for (const [mod, name, slot] of [[Ledger, 'plan', 'plan'], [Ledger, 'fold', 'fold'], [Temper, 'sealFollowups', 'seal']]) {
  const original = mod[name]; if (typeof original !== 'function') continue;
  try { mod[name] = (...args) => { const s = t(); try { return original(...args); } finally { spent[slot] += t() - s; spent.calls[slot] += 1; } }; } catch { /* frozen module */ }
}
(async () => {
  const events = Array.from({ length: N }, (_, n) => graph(n)).flat();
  const storage = disk(), game = createGame({ gameId: 'pages', map, storage, storageScope: 'account', accountKey: 'synthetic', historyComplete: false, clock: () => '2026-10-18T00:00:00.000Z', fold: { remote: true } });
  const sync = createLearningSync({ adapter: game, accountKey: 'synthetic', revision: 1, storage, transport: network(events), maxAttempts: 1, backoffMs: [0], sleep: async () => {}, maxPages: 100000 });
  const s0 = t(); const status = await sync.start(); const s1 = t();
  console.log(`events ${events.length} restore ${s1 - s0} ms, phase ${status.phase} complete ${status.complete}, kept ${game.syncPort.events().length}`);
  console.log(`plan ${spent.plan} ms (${spent.calls.plan}) · fold ${spent.fold} ms (${spent.calls.fold}) · seal ${spent.seal} ms (${spent.calls.seal})`);
  const s2 = t(); const summary = game.summary(); console.log(`summary ${t() - s2} ms independent ${summary.independent}`);
  sync.stop();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
