const __ROOT = (() => { let p = decodeURIComponent(new URL('../../../../../..', import.meta.url).pathname); if (p.endsWith('/')) p = p.slice(0, -1); return p.charAt(2) === ':' ? p.slice(1) : p; })();
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = process.argv[2] || __ROOT;
const require = createRequire(import.meta.url);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const rows = [];
const add = (game, i) => rows.push({ game, skillId: i.skillId || (i.skillIds || [])[0], difficulty: i.difficulty, responseFormat: i.responseFormat, family: i.familyKey || i.itemKey });
const bank = await imp('experiences/topik-items/bank.mjs');
for (const it of bank.PUBLISHED) add('topik-items(published)', bank.itemMeta(it));
console.log('topik-items ALL', bank.ALL_ITEMS.length, 'REVIEWED', bank.REVIEWED_ITEMS.length, 'PUBLISHED', bank.PUBLISHED.length, '(held out', bank.REVIEWED_ITEMS.length - bank.PUBLISHED.length + ')');
const games = {
  'blank-slice': async () => { const c = await imp('experiences/blank-slice/content.mjs'), l = await imp('experiences/blank-slice/learning.mjs'); return [...c.ITEMS, ...(Array.isArray(c.PRACTICE) ? c.PRACTICE : [])].map(l.itemMetadata); },
  'talk-rally': async () => { const c = await imp('experiences/talk-rally/content.mjs'), l = await imp('experiences/talk-rally/learning.mjs'); return [...c.ITEMS, ...(Array.isArray(c.PRACTICE) ? c.PRACTICE : [])].map(l.itemMetadata); },
  'order-rush': async () => { const c = await imp('experiences/order-rush/core.mjs'), l = await imp('experiences/order-rush/learning.mjs'); const all = new Map(); for (const o of [...c.ORDERS, ...c.REVIEW, ...c.DELAYED_ORDERS, ...c.ADDITIONAL_ORDERS]) all.set(o.id, o); return [...all.values()].map(l.orderMetadata); },
  'korean-rhythm(song)': async () => { const c = await imp('experiences/korean-rhythm/core.mjs'), p = await imp('experiences/korean-rhythm/personalization.mjs'); return c.TRACKS.flatMap(t => t.questions.map((q, i) => p.rhythmItem(t.id, { ...q, id: q.id || `q${i}`, sourceIndex: i }))); },
  'korean-rhythm(supplemental)': async () => { const s = await imp('experiences/korean-rhythm/supplemental.mjs'); return [...s.supplementalItems(), ...s.supplementalItems({ purpose: 'delayed', seen: () => false })]; },
  'entry-check': async () => { const c = await imp('experiences/entry-check/content.mjs'), l = await imp('experiences/entry-check/learning.mjs'); return c.VENUES.flatMap(v => v.cases).map(l.caseMetadata); },
  'story-classroom': async () => { const s = await imp('experiences/story-classroom/story.mjs'), l = await imp('experiences/story-classroom/learning.mjs'); return [...s.EPISODE.acts.flatMap(a => a.missions), ...s.EPISODE.review].map(l.missionMetadata); },
  'korean-runner(check)': async () => { const l = await imp('experiences/korean-runner/listening-check.mjs'); return l.LISTENING_CHECKS.map(l.checkMetadata); },
  'korean-racing': async () => { const p = await imp('experiences/korean-racing/personalization.js'); return p.RACING_CANDIDATES.map(c => ({ ...c, skillId: c.skillIds[0], familyKey: c.familyKey || c.itemKey })); },
  'subway-rush': async () => { const j = await imp('experiences/subway-rush/journeys.mjs'), l = await imp('experiences/subway-rush/learning.mjs'); const out = new Map(); for (const level of ['basic', 'busy']) for (const [id, s] of j.practiceStarts(level)) out.set(id, l.decisionMeta(s.decision)); return [...out.values()]; },
  'snap-words': async () => { const w = await imp('experiences/snap-words/words.mjs'), l = await imp('experiences/snap-words/learning.mjs'); const words = Array.isArray(w.WORDS) ? w.WORDS : Object.values(w.WORDS); return words.flatMap(x => ['meaning', 'recall-word', 'recall-meaning'].map(f => l.itemMetadata(f, x.id || x.key || x))); },
};
for (const [name, load] of Object.entries(games)) { try { for (const i of await load()) add(name, i); } catch (e) { console.log('FAILED', name, e.message); } }
const strata = require(path.join(root, 'strata/index.js'));
const wm = strata.createMap(require(path.join(root, 'strata/world-map.js')).worldMapData());
const skills = wm.allNodes().filter(n => n.kind === 'skill').map(n => n.id);
const FORMATS = ['binary-choice', 'single-choice', 'cup-compose', 'action', 'spoken', 'unknown'];
const cells = new Map();
for (const r of rows) { const k = `${r.skillId}|${r.difficulty}|${r.responseFormat}`; if (!cells.has(k)) cells.set(k, { fam: new Set(), games: new Set() }); cells.get(k).fam.add(r.family); cells.get(k).games.add(r.game.replace(/\(.*/, '')); }
const possible = skills.length * 3 * FORMATS.length;
const sizes = [...cells.values()].map(c => c.fam.size);
console.log('total rows', rows.length, '| possible Core cells (31 skills×3 difficulties×6 formats):', possible, '| cells with ≥1 item:', cells.size);
console.log('cells with <3 families (never "practice"):', sizes.filter(n => n < 3).length, '| <4 families (never "recent-independent"):', sizes.filter(n => n < 4).length, '| ≥4:', sizes.filter(n => n >= 4).length, '| ≥12:', sizes.filter(n => n >= 12).length);
console.log('\nper-cell (families | games):');
for (const [k, c] of [...cells].sort()) console.log('  ', k.padEnd(48), String(c.fam.size).padStart(4), [...c.games].join(','));
const emptySkills = skills.filter(s => ![...cells.keys()].some(k => k.startsWith(s + '|')));
console.log('\nskills with 0 items anywhere (these sources):', emptySkills.join(', '));
// harder-level gating: cells at d2/d3 whose (d-1) cell in the same format has <4 families → readyForHarder can never be true
let blocked = 0; const list = [];
for (const [k] of cells) { const [s, d, f] = k.split('|'); if (+d > 1) { const lower = cells.get(`${s}|${+d - 1}|${f}`); if (!lower || lower.fam.size < 4) { blocked++; list.push(`${k} (lower: ${lower ? lower.fam.size : 0})`); } } }
console.log('\nd2/d3 cells whose lower cell (same skill·format) has <4 families → "readyForHarder" unreachable →  permanent −0.25×(d−1) penalty:', blocked, '/', [...cells.keys()].filter(k => +k.split('|')[1] > 1).length);
for (const l of list) console.log('   ', l);
