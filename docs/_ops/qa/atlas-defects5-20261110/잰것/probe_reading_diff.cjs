'use strict';
// 2만 건 복원 뒤 접힌 저장소와 접지 않은 저장소의 Core 읽기가 어디서 다른가.
const ROOT = process.argv[2].split(require('node:path').sep).join('/');
const N = Number(process.argv[3] || 5001), LATE = process.argv[4] !== 'nolate';
const { createGame, createLearningSync, KEY } = require(ROOT + '/atlas/game-learning');
const Atlas = require(ROOT + '/atlas/engine');
const { createMap } = require(ROOT + '/strata');
const map = createMap(require(ROOT + '/strata/maps/topik-i.json'));
const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' }, at = '2026-08-01T00:00:00.000Z';
const row = (id, type, fields = {}) => ({ schema: 1, id, type, scope, at, recordedAt: at, ...fields });
function graph(n) {
  const d = row('d' + n, 'decision.made', { experienceId: 'practice', variant: 'standard', policy: Atlas.VERSION, evidence: [] });
  const p = row('p' + n, 'practice.presented', { decisionId: d.id, taskId: 'task', taskVersion: '1', itemKey: 'i' + n, conceptIds: ['ko.reading.detail'], firstExposure: true,
    measure: { skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, familyKey: 'f' + n, audioRequired: false, confounded: false, responseFormat: 'single-choice' } });
  const a = row('a' + n, 'practice.attempted', { presentationId: p.id, attemptNo: 1, verdict: 'correct', errorTags: [] });
  const c = row('c' + n, 'experience.completed', { decisionId: d.id, experienceId: 'practice', variant: 'standard' }); return [d, p, a, c];
}
const disk = () => { const data = new Map(); return { data, get length() { return data.size; }, key: i => [...data.keys()][i] ?? null, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; };
const network = events => ({ calls: { post: 0 }, get: async ({ after }) => ({ revision: 1, events: events.slice(after, after + 200), cursor: Math.min(events.length, after + 200), hasMore: after + 200 < events.length }), post: async ({ events }) => ({ revision: 1, accepted: events.map(e => e.id) }) });
const clock = () => '2026-08-10T00:00:00.000Z';
const game = (storage, fold = { remote: true }, historyComplete = false) => createGame({ gameId: 'pages', map, storage, storageScope: 'account', accountKey: 'synthetic', historyComplete, clock, fold });
const reading = coach => { const { skills, concepts, independent } = coach.summary(); return { skills, concepts, independent }; };
function diff(a, b, at = '', out = []) {
  if (out.length > 25) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${at}.${k}`, out); return out; }
  out.push(`${at}: folded=${JSON.stringify(a)?.slice(0, 160)} whole=${JSON.stringify(b)?.slice(0, 160)}`); return out;
}
(async () => {
  const events = Array.from({ length: N }, (_, n) => graph(n)).flat();
  if (LATE) events.push(row('late-a', 'practice.attempted', { presentationId: 'p0', attemptNo: 2, verdict: 'incorrect', errorTags: [] }),
    row('late-f', 'feedback.given', { completionId: 'c0', value: 'helpful' }), row('late-x', 'record.excluded', { targetId: 'a0' }));
  const storage = disk(), adapter = game(storage), sync = createLearningSync({ adapter, storage, transport: network(events), accountKey: 'synthetic', revision: 1, auto: false, maxAttempts: 1 });
  await sync.start();
  const whole = game(disk(), false, true); whole.syncPort.importEvents(events);
  const root = JSON.parse(storage.getItem(KEY + '.device'));
  console.log('events', events.length, 'kept', adapter.syncPort.events().length, 'folded', root.data.ledger?.folded, 'adjusted', root.data.ledger?.adjusted || 0);
  for (const line of diff(reading(adapter), reading(whole))) console.log(line);
  sync.stop();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
