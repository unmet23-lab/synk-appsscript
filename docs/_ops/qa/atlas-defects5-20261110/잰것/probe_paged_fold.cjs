'use strict';
// 결함 2 시험: 둘째 기기가 1,024건 넘는 이력을 받아 페이지 꼴이 된 뒤, 날마다 남는 기록 수 · 접힌 장부 · 문항당 시간이 어떻게 되나.
// 첫 인자 = 저장소 뿌리(고치기 전 작업본 / 고친 임시 사본). 실제 계정 호스트(account/world-learning-host.js)를 지난다.
const ROOT = process.argv[2].split(require('node:path').sep).join('/');
const DAYS2 = Number(process.argv[3] || 8);
const GameLearning = require(ROOT + '/atlas/game-learning');
const { createWorldLearningHost } = require(ROOT + '/account/world-learning-host.js');
const { KEY } = GameLearning;
const { createMap } = require(ROOT + '/strata');
const { topikMap } = require(ROOT + '/strata/topik-i');
const map = createMap(topikMap());
const DAY = 86400000, T0 = Date.parse('2026-12-01T10:00:00Z');
// 열거가 되는 저장소(synk-account scopedStorage와 같은 계약). 한도 없음: 크기만 잰다.
function disk() { const data = new Map(); let order = null;
  return { data, get length() { return data.size; }, key(i) { if (!order) order = [...data.keys()]; return order[i] ?? null; }, getItem: k => (data.has(k) ? data.get(k) : null),
    setItem(k, v) { if (!data.has(k)) order = null; data.set(k, String(v)); }, removeItem(k) { if (data.delete(k)) order = null; },
    chars() { let n = 0; for (const [k, v] of data) n += k.length + v.length; return n; } }; }
const skills = map.allNodes().filter(n => n.kind === 'skill');
const item = n => { const s = skills[n % skills.length]; return { id: `item.${n}`, itemKey: `world.item.${String(n).padStart(5, '0')}`, familyKey: `world.family.${String(n).padStart(5, '0')}`, skillId: s.id, modality: s.domain, difficulty: 1 + (n % 3), responseFormat: 'single-choice' }; };
function server() { const s = { log: [], ids: new Set() };
  s.transport = { async get({ after }) { const events = s.log.slice(after, after + 200); return { ok: true, events: JSON.parse(JSON.stringify(events)), cursor: after + events.length, hasMore: after + events.length < s.log.length, revision: 1 }; },
    async post({ events }) { for (const e of events) if (!s.ids.has(e.id)) { s.ids.add(e.id); s.log.push(JSON.parse(JSON.stringify(e))); } return { ok: true, accepted: events.map(e => e.id), revision: 1 }; } };
  return s; }
function hostOn(storage, s, clock) { const now = () => new Date(clock.now).toISOString();
  const engine = { createGame: o => GameLearning.createGame({ ...o, map, clock: now }), createLearningSync: o => GameLearning.createLearningSync({ ...o, maxAttempts: 1, backoffMs: [0], sleep: async () => {}, maxPages: 100000 }) };
  return { host: createWorldLearningHost({ accountKey: 'account.synthetic', revision: 1, storage, transport: s.transport, guard: () => {}, connected: true, engine, clock: () => clock.now }), engine }; }
const idle = async host => { for (let i = 0; i < 3000; i++) { await new Promise(r => setImmediate(r)); const st = host.status(); if (st.phase !== 'syncing' && !st.queued) return st; } return host.status(); };
async function playDay(host, engine, clock, counter, n = 30) { const coach = host.createGame({ gameId: 'world-practice' }, engine.createGame, engine.createLearningSync); await idle(host);
  const started = process.hrtime.bigint();
  for (let i = 0; i < n; i++) { const it = item(counter.n++); clock.now += 4000; const pid = coach.present(it); if (it.modality === 'listening') { clock.now += 3000; coach.delivery(pid, { audio: 'completed' }); }
    clock.now += 4000; coach.answer(pid, { correct: i % 5 !== 0, assessable: true, choice: { selectedId: 'o1', correctId: 'o1' } }); await idle(host); }
  const ms = Number(process.hrtime.bigint() - started) / 1e6 / n;
  const summary = coach.summary(); coach.disconnect(); return { ms, independent: summary.independent }; }
function kept(storage) {
  const raw = storage.getItem(KEY + '.device'); if (!raw) return { events: 0, paged: false, ledger: false };
  const root = JSON.parse(raw);
  if (root.paged === 1) return { events: root.arrays.events.reduce((n, p) => n + p.count, 0), paged: true, ledger: !!root.data.ledger, folded: root.data.ledger?.folded || 0, rootChars: raw.length };
  return { events: root.events.length, paged: false, ledger: !!root.ledger, folded: root.ledger?.folded || 0, rootChars: raw.length };
}
(async () => {
  const s = server(), d1 = disk(), clock = { now: T0 }, counter = { n: 0 };
  for (let day = 0; day < 10; day++) { clock.now = T0 + day * DAY; const { host, engine } = hostOn(d1, s, clock); await playDay(host, engine, clock, counter); await idle(host); await host.retry(); await idle(host); host.stop(); }
  console.log(`server ${s.log.length} entries after 10 days on device 1 | device 1 keeps ${JSON.stringify(kept(d1))}`);
  const d2 = disk();
  for (let day = 10; day < 10 + DAYS2; day++) { clock.now = T0 + day * DAY; const { host, engine } = hostOn(d2, s, clock);
    const r = await playDay(host, engine, clock, counter); await idle(host); const st = host.status();
    console.log(`device 2 day ${day + 1}: ${r.ms.toFixed(1)} ms/item, sync ${st.phase}/${st.code}, kept ${JSON.stringify(kept(d2))}, chars ${(d2.chars() / 1e6).toFixed(2)}M, keys ${d2.data.size}, independent ${r.independent}, server ${s.log.length}`);
    host.stop(); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
