const __ROOT = require('node:path').resolve(__dirname, '../../../../../..').split(require('node:path').sep).join('/');
const ROOT = __ROOT;
const { createMap } = require(ROOT + '/strata');
const curriculum = require(ROOT + '/strata/topik-i').topikMap();
const map = createMap(curriculum);
const GL = require(ROOT + '/atlas/game-learning');
const Atlas = require(ROOT + '/atlas/engine');
const Trail = require(ROOT + '/atlas/trail');
const Learning = require(ROOT + '/atlas/learning');
const Flow = require(ROOT + '/atlas/flow');
const memoryStorage = () => { const m = new Map(); let writes = 0, bytes = 0; return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { writes += 1; bytes += v.length; m.set(k, String(v)); }, removeItem: k => m.delete(k), stats: () => ({ writes, bytes, keys: [...m.keys()], sizes: Object.fromEntries([...m].map(([k, v]) => [k, v.length])) }) }; };
const makeClock = (startIso = '2026-11-01T00:00:00.000Z') => { let t = Date.parse(startIso); const c = () => new Date(t).toISOString(); c.advance = ms => { t += ms; }; c.set = iso => { t = Date.parse(iso); }; c.now = () => t; return c; };
const skills = map.allNodes().filter(n => n.kind === 'skill');
// Build an item bank: per skill × difficulty, `per` distinct families, single-choice.
function bank(per = 6, formats = ['single-choice']) {
  const items = [];
  for (const s of skills) for (const d of [1, 2, 3]) for (let i = 0; i < per; i += 1) for (const f of formats)
    items.push({ id: `${s.id.replace(/^ko\./, '')}.d${d}.${f}.${String(i).padStart(3, '0')}`, itemKey: `${s.id}.d${d}.${f}.${i}`, familyKey: `${s.id}.d${d}.${f}.${i}`,
      skillId: s.id, skillIds: [s.id], modality: s.domain, difficulty: d, responseFormat: f, audioRequired: false });
  return items;
}
// One practised item through the public coach API.
function play(coach, item, correct, { help = null } = {}) {
  const pid = coach.present(item);
  if (help) coach.help(pid, help);
  return coach.answer(pid, { correct, assessable: true });
}
module.exports = { ROOT, map, GL, Atlas, Trail, Learning, Flow, memoryStorage, makeClock, skills, bank, play };
