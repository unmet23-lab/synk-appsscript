'use strict';
const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
// Does a paged account store reclaim superseded pages under the production host (account/world-learning-host.js)?
// The host hands the engine { getItem, setItem, removeItem } only; learning-pages.js collects obsolete pages only when
// the storage can be enumerated (key/length).
const ROOT = __ROOT;
const GameLearning = require(ROOT + '/atlas/game-learning');
const { createWorldLearningHost } = require(ROOT + '/account/world-learning-host.js');
const { KEY } = GameLearning, { SYNC_KEY } = require(ROOT + '/atlas/learning-sync');
const { createMap } = require(ROOT + '/strata');
const { topikMap } = require(ROOT + '/strata/topik-i');
const map = createMap(topikMap());
const DAY = 86400000, T0 = Date.parse('2026-12-01T10:00:00Z');
function disk(limit = Infinity) { const data = new Map(); let order = null, chars = 0;
  return { data, get length() { return data.size; }, key(i) { if (!order) order = [...data.keys()]; return order[i] ?? null; }, getItem: k => (data.has(k) ? data.get(k) : null),
    setItem(k, v) { v = String(v); const next = chars - (data.has(k) ? k.length + data.get(k).length : 0) + k.length + v.length; if (next > limit) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); if (!data.has(k)) order = null; data.set(k, v); chars = next; }, removeItem(k) { if (data.has(k)) { chars -= k.length + data.get(k).length; data.delete(k); order = null; } }, chars() { let n = 0; for (const [k, v] of data) n += k.length + v.length; return n; } }; }
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
  for (let i = 0; i < n; i++) { const it = item(counter.n++); clock.now += 4000; const pid = coach.present(it); if (it.modality === 'listening') { clock.now += 3000; coach.delivery(pid, { audio: 'completed' }); }
    clock.now += 4000; coach.answer(pid, { correct: true, assessable: true, choice: { selectedId: 'o1', correctId: 'o1' } }); await idle(host); }
  coach.disconnect(); }
function audit(storage, label) {
  const referenced = new Set(); let live = 0, orphan = 0, orphanChars = 0, liveChars = 0;
  for (const rootKey of [KEY + '.device', SYNC_KEY + '.account.synthetic']) { const raw = storage.getItem(rootKey); if (!raw) continue; const root = JSON.parse(raw); if (root.paged === 1) for (const pages of Object.values(root.arrays)) for (const p of pages) referenced.add(p.key); }
  for (const [k, v] of storage.data) if (k.includes('.page.')) { if (referenced.has(k)) { live++; liveChars += v.length; } else { orphan++; orphanChars += k.length + v.length; } }
  console.log(`${label}: ${storage.data.size} keys, ${(storage.chars() / 1e6).toFixed(2)}M chars total | pages in use ${live} (${(liveChars / 1e6).toFixed(2)}M) | pages no root points to ${orphan} (${(orphanChars / 1e6).toFixed(2)}M chars)`);
}
(async () => {
  const s = server(), d1 = disk(), clock = { now: T0 }, counter = { n: 0 };
  for (let day = 0; day < 10; day++) { clock.now = T0 + day * DAY; const { host, engine } = hostOn(d1, s, clock); await playDay(host, engine, clock, counter); await idle(host); await host.retry(); await idle(host); host.stop(); }
  console.log(`server has ${s.log.length} entries after 10 days on device 1`);
  const d2 = disk(5*1024*1024);
  for (let day = 10; day < 16; day++) { clock.now = T0 + day * DAY; const { host, engine } = hostOn(d2, s, clock);
    if (day === 10) { host.createGame({ gameId: 'world-home' }, engine.createGame, engine.createLearningSync).disconnect(); await idle(host); audit(d2, 'device 2 right after its first restore'); }
    let err=null; try { await playDay(host, engine, clock, counter); } catch (e) { err = e; } await idle(host); const st = host.status(); let probe = null; try { const c = host.createGame({ gameId: 'world-practice' }, engine.createGame, engine.createLearningSync); probe = c.summary().storage; c.disconnect(); } catch (e) { probe = { threw: e.code || e.message }; } let other = 'ok'; try { d2.setItem('synk.world.other-feature', 'x'.repeat(20000)); } catch (e) { other = e.name; } console.log(`   day ${day + 1}: play error=${err ? (err.code || err.message) : 'none'}, sync ${st.phase}/${st.code}, queued ${st.queued}, storage=${JSON.stringify(probe)}, another feature saving 20k chars on the same origin: ${other}`); host.stop();
    audit(d2, `device 2 after day ${day + 1} (${s.log.length} entries on the server)`); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
