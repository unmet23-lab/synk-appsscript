const __ROOT = (() => { let p = decodeURIComponent(new URL('../../../../../..', import.meta.url).pathname); if (p.endsWith('/')) p = p.slice(0, -1); return p.charAt(2) === ':' ? p.slice(1) : p; })();
// Read-only repros against the real atlas/ modules. node repro.mjs <guest|paged|offline|all>
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = __ROOT;
const { createGame, createLearningSync, KEY } = require(ROOT + '/atlas/game-learning');
const { createMap } = require(ROOT + '/strata');
const { topikMap } = require(ROOT + '/strata/topik-i');
const map = createMap(topikMap());
const which = process.argv[2] || 'all';
const DAY = 86400000, T0 = Date.parse('2026-12-01T10:00:00Z');

function disk() {
  const data = new Map(); let order = null;
  return { data, get length() { return data.size; }, key(i) { if (!order) order = [...data.keys()]; return order[i] ?? null; },
    getItem: k => (data.has(k) ? data.get(k) : null), setItem(k, v) { if (!data.has(k)) order = null; data.set(k, String(v)); }, removeItem(k) { data.delete(k); order = null; },
    chars() { let n = 0; for (const [k, v] of data) n += k.length + v.length; return n; } };
}
const skills = map.allNodes().filter(n => n.kind === 'skill');
const item = n => { const s = skills[n % skills.length]; return { id: `item.${n}`, itemKey: `world.item.${String(n).padStart(5, '0')}`, familyKey: `world.family.${String(n).padStart(5, '0')}`,
  skillId: s.id, modality: s.domain, difficulty: 1 + (n % 3), responseFormat: 'single-choice' }; };
function play(coach, it, clock, correct = true) {
  clock.now += 4000; const pid = coach.present(it);
  if (it.modality === 'listening') { clock.now += 3000; coach.delivery(pid, { audio: 'completed' }); }
  clock.now += 4000; return coach.answer(pid, { correct, assessable: true, choice: { selectedId: correct ? 'o1' : 'o2', correctId: 'o1' } });
}

async function guest() {
  console.log('\n=== G. guest practises, folds, then signs up and moves the device record to the account ===');
  const device = disk(), clock = { now: T0 }, now = () => new Date(clock.now).toISOString();
  let coach = createGame({ gameId: 'world-practice', map, storage: device, clock: now, followups: true });
  const X = item(1); // a reading item
  const first = play(coach, X, clock, false);
  console.log('guest day 1: X answered wrong ->', { independent: first.independent, exposure: first.exposure });
  let n = 100;
  for (let day = 1; day <= 6; day++) { clock.now = T0 + day * DAY; coach.dispose(); coach = createGame({ gameId: 'world-practice', map, storage: device, clock: now, followups: true });
    for (let i = 0; i < 30; i++) play(coach, item(n++), clock, true); }
  const stored = JSON.parse(device.getItem(KEY + '.device'));
  const keptX = stored.events.some(e => e.itemKey === X.itemKey);
  console.log(`guest after 6 more days: kept ${stored.events.length} entries, folded ${stored.ledger?.folded || 0}; X still in the kept log: ${keptX}; ledger remembers X: ${!!stored.ledger?.keys?.['item:' + X.itemKey]}; guest exposure(X): ${JSON.stringify(coach.exposure(X))}`);
  coach.dispose();
  const records = await import(pathToFileURL(ROOT + '/experiences/synk-world-app/device-records.mjs').href);
  const moved = records.guestLearningEvents(device, { after: 0 });
  console.log(`guestLearningEvents moves ${moved.events.length} entries (${moved.attempts} first answers); X among them: ${moved.events.some(e => e.itemKey === X.itemKey)}; total guest first answers so far: ${1 + (n - 100)}`);
  // The account store as account/world-learning-host.js opens it for a device-only account (connected:false).
  const account = disk(); clock.now = T0 + 7 * DAY;
  const owned = { map, storage: account, clock: now, learnerKey: 'device', storageScope: 'account', accountKey: 'local:acct', historyComplete: true, fold: true, followups: true };
  const importer = createGame({ gameId: 'world-device-import', ...owned, fold: false });
  const result = importer.syncPort.importEvents(moved.events); importer.dispose();
  const acct = createGame({ gameId: 'world-practice', ...owned });
  console.log(`account import: added ${result.added}; account exposure(X) before showing it again: ${JSON.stringify(acct.exposure(X))}`);
  const again = play(acct, X, clock, true);
  const shown = acct.events().filter(e => e.type === 'practice.presented' && e.itemKey === X.itemKey).at(-1);
  console.log('account: X shown again and answered right ->', { firstExposure: shown.firstExposure, independent: again.independent, exposure: again.exposure, assisted: again.assisted });
  console.log(again.independent ? 'RESULT: an item the learner already answered (wrong) as a guest counts as a NEW independent success on the account.' : 'RESULT: not reproduced');
  const summary = acct.summary(); const skill = summary.skills.find(s => s.id === X.skillId);
  console.log('account profile for that ability/difficulty:', JSON.stringify(skill.levels[X.difficulty].formats['single-choice']).slice(0, 300));
  acct.dispose();
}

function server() {
  const s = { log: [], ids: new Set(), offline: false };
  s.transport = () => ({
    async get({ after }) { if (s.offline) throw new Error('offline'); const events = s.log.slice(after, after + 200); return { events: JSON.parse(JSON.stringify(events)), cursor: after + events.length, hasMore: after + events.length < s.log.length, revision: 1 }; },
    async post({ events }) { if (s.offline) throw new Error('offline'); for (const e of events) if (!s.ids.has(e.id)) { s.ids.add(e.id); s.log.push(JSON.parse(JSON.stringify(e))); } return { accepted: events.map(e => e.id), revision: 1 }; },
  });
  return s;
}
const ACCOUNT = 'account.synthetic';
const open = (storage, now, s) => {
  const coach = createGame({ gameId: 'world-practice', map, storage, clock: now, storageScope: 'account', accountKey: ACCOUNT, historyComplete: false, fold: { remote: true }, followups: true });
  const sync = createLearningSync({ adapter: coach, accountKey: ACCOUNT, revision: 1, storage, transport: s.transport(), auto: false, maxAttempts: 1, backoffMs: [0], sleep: async () => {}, maxPages: 100000 });
  return { coach, sync };
};
const shape = storage => { const root = JSON.parse(storage.getItem(KEY + '.device')); return root.paged === 1 ? { paged: true, ledger: !!root.data.ledger, pages: root.arrays.events.length } : { paged: false, ledger: !!root.ledger, kept: root.events.length, folded: root.ledger?.folded || 0 }; };

async function days(storage, s, clock, from, to, counter, label, { offlineUntil = -1 } = {}) {
  const now = () => new Date(clock.now).toISOString();
  for (let day = from; day < to; day++) {
    clock.now = T0 + day * DAY; s.offline = day < offlineUntil;
    const { coach, sync } = open(storage, now, s);
    await sync.start();
    for (let i = 0; i < 30; i++) play(coach, item(counter.n++), clock, i % 4 !== 0);
    await sync.flush(); await sync.pull();
    if (day === to - 1 || day === from || (day + 1) % 10 === 0) console.log(`${label} day ${day + 1}: device keeps ${coach.syncPort.ids().length} entries, server ${s.log.length}, ${JSON.stringify(shape(storage))}, stored ${(storage.chars() / 1e6).toFixed(2)}M chars, sync ${sync.status().phase}/${sync.status().code}`);
    sync.stop(); coach.dispose();
  }
}

async function paged() {
  console.log('\n=== H. same learner: device 1 from day 1 (folds) vs device 2 that signs in on day 10 (restore -> paged) ===');
  const s = server(), d1 = disk(), clock = { now: T0 }, counter = { n: 0 };
  await days(d1, s, clock, 0, 10, counter, 'device 1');
  const d2 = disk();
  await days(d2, s, clock, 10, 40, counter, 'device 2');
  // Device 1 comes back after the 30 days on device 2.
  await days(d1, s, clock, 40, 41, counter, 'device 1 (back)');
}

async function offline() {
  console.log('\n=== O. one device, 8 days without a connection, then online again ===');
  const s = server(), d = disk(), clock = { now: T0 }, counter = { n: 0 };
  await days(d, s, clock, 0, 40, counter, 'device', { offlineUntil: 8 });
}

if (which === 'guest' || which === 'all') await guest();
if (which === 'paged' || which === 'all') await paged();
if (which === 'offline' || which === 'all') await offline();
