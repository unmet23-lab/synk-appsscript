// 시험: 찰칵 낱말 문항에 낱말 태그(ko.word.*)를 붙이면 Core 순위와 낱말 요약이 어떻게 바뀌나.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = process.argv[2];
const require = createRequire(import.meta.url);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { createMap } = require(path.join(root, 'strata/index.js'));
const { createGame } = require(path.join(root, 'atlas/game-learning.js'));
const map = createMap(require(path.join(root, 'strata/topik-i.js')).topikMap());
const words = map.allNodes().filter(n => n.kind === 'word');
const byKo = new Map(); for (const n of words) { if (!byKo.has(n.label_ko)) byKo.set(n.label_ko, []); byKo.get(n.label_ko).push(n.id); }
let t = Date.parse('2026-11-10T03:00:00Z');
const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
const clock = () => new Date(t += 1000).toISOString();
const coach = createGame({ gameId: 'snap-words', map, storage, clock, followups: true });
const w = await imp('experiences/snap-words/words.mjs'), l = await imp('experiences/snap-words/learning.mjs');
const ids = Object.keys(w.WORDS).filter(id => l.difficultyOf(id) === 1).slice(0, 12);
const tag = id => byKo.get(w.WORDS[id].ko) || [];
const metas = ids.map(id => ({ ...l.itemMetadata('meaning', id), conceptIds: tag(id).length === 1 ? tag(id) : [] }));
console.log('tags', ids.map(id => `${id}:${tag(id).join('|') || '-'}`).join(' '));
const wrong = new Set([ids[1], ids[4]]);
for (const [i, m] of metas.slice(0, 8).entries()) { const p = coach.present(m); coach.answer(p, { correct: !wrong.has(ids[i]), assessable: true }); }
t += 86400000;
const cand = m => ({ id: m.id, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality, responseFormat: m.responseFormat, itemKey: m.itemKey, familyKey: m.familyKey, conceptIds: m.conceptIds });
const r = coach.recommend(metas.map(cand), { audioAvailable: true });
const order = [r.selected, ...r.alternatives].map(c => c.id.split('.').pop());
console.log('wrong', [...wrong].join(','), '| order', order.join(' > '));
console.log('wrong ranks', [...wrong].map(id => order.indexOf(id) + 1).join(','), '/', order.length, '| reason', r.reason);
const s = coach.summary();
console.log('concepts', (s.concepts || []).map(c => `${c.label}:${c.status}(${c.priority})`).join(' '));
