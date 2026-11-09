const __ROOT = (() => { let p = decodeURIComponent(new URL('../../../../../..', import.meta.url).pathname); if (p.endsWith('/')) p = p.slice(0, -1); return p.charAt(2) === ':' ? p.slice(1) : p; })();
// 재현: (1) 낱말 태그 없는 낱말 게임에서 「틀린 낱말」이 앞서는가  (2) 문형 태그가 있는 게임에서는 어떤가  (3) 계열 3개뿐인 칸의 상태
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = process.argv[2] || __ROOT;
const require = createRequire(import.meta.url);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { createMap } = require(path.join(root, 'strata/index.js'));
const { createGame } = require(path.join(root, 'atlas/game-learning.js'));
const topikI = require(path.join(root, 'strata/topik-i.js')).topikMap();
const world = require(path.join(root, 'strata/world-map.js')).worldMapData();
function bench(mapData) {
  let t = Date.parse('2026-11-10T03:00:00Z');
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  const clock = () => new Date(t += 1000).toISOString(), map = createMap(mapData);
  return { on: gameId => createGame({ gameId, map, storage, clock, followups: true }), wait: d => { t += d * 86400000; } };
}
const cand = m => ({ id: m.id, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality, responseFormat: m.responseFormat, itemKey: m.itemKey, familyKey: m.familyKey, conceptIds: m.conceptIds || [] });

// (1) snap-words
{
  const w = await imp('experiences/snap-words/words.mjs'), l = await imp('experiences/snap-words/learning.mjs');
  const b = bench(topikI), coach = b.on('snap-words');
  const ids = Object.keys(w.WORDS).filter(id => l.difficultyOf(id) === 1).slice(0, 12);
  const metas = ids.map(id => l.itemMetadata('meaning', id));
  const wrong = new Set([ids[1], ids[4]]);            // 두 낱말을 틀린다
  for (const [i, m] of metas.slice(0, 8).entries()) { const p = coach.present(m); coach.answer(p, { correct: !wrong.has(ids[i]), assessable: true }); }
  b.wait(1);
  const r = coach.recommend(metas.map(cand), { audioAvailable: true });
  const order = [r.selected, ...r.alternatives].map(c => c.id.split('.').pop());
  console.log('(1) snap-words — 본 낱말 8(그중 틀림 2:', [...wrong].join(', '), '), 안 본 낱말 4');
  console.log('    추천 순서:', order.join(' > '));
  console.log('    틀린 두 낱말의 순위:', [...wrong].map(x => order.indexOf(x) + 1).join(', '), '/ 12  | focus state:', r.state, '| reason:', r.reason);
  const cell = coach.summary().skills.find(s => s.id === 'ko.reading.vocabulary').levels[1].formats['single-choice'];
  console.log('    칸 상태:', cell.status, 'n', cell.n, 'correct', cell.correct, '| concepts 추적:', coach.summary().concepts.length);
}
// (2) blank-slice (문형 · 낱말 태그 있음)
{
  const c = await imp('experiences/blank-slice/content.mjs'), l = await imp('experiences/blank-slice/learning.mjs');
  const b = bench(topikI), coach = b.on('blank-slice');
  const gram = c.ITEMS.filter(x => x.skill === 'ko.reading.grammar' && x.difficulty === 1);
  const metas = gram.map(l.itemMetadata);
  const missIdx = [0, 2];                                   // 두 문항을 틀린다
  for (const [i, m] of metas.slice(0, 6).entries()) { const p = coach.present(m); coach.answer(p, { correct: !missIdx.includes(i), assessable: true }); }
  b.wait(1);
  const r = coach.recommend(l.candidates(gram), { audioAvailable: true });
  const order = [r.selected, ...r.alternatives];
  console.log('\n(2) blank-slice — 문형 난도1', metas.length, '문항 중 6개 풀고 2개 틀림:', missIdx.map(i => `${gram[i].id}(${metas[i].conceptIds})`).join(', '));
  console.log('    추천 순서:', order.map(o => `${o.itemId}[${(o.conceptIds || []).join('+')}]`).join(' > '));
  console.log('    concepts:', coach.summary().concepts.map(x => `${x.id}:${x.status}`).join(', '));
  console.log('    틀린 문항과 같은 문형을 가진 「새」 문항 수:', gram.slice(6).filter(x => missIdx.some(i => metas[i].conceptIds.some(id => l.itemMetadata(x).conceptIds.includes(id)))).length);
}
// (3) 계열 3개뿐인 칸: 셋 다 혼자 맞혀도 recent-independent가 되는가
{
  const bank = await imp('experiences/topik-items/bank.mjs');
  const b = bench(world), coach = b.on('world-practice');
  const cellItems = bank.PUBLISHED.filter(i => i.skillId === 'ko2.reading.context' && i.difficulty === 1).map(bank.itemMeta);
  for (const m of cellItems) { const p = coach.present(m); coach.answer(p, { correct: true, assessable: true }); }
  const s = coach.summary().skills.find(x => x.id === 'ko2.reading.context');
  console.log('\n(3) ko2.reading.context 난도1 — 발행 문항', cellItems.length, '개를 모두 처음에 혼자 맞힘 → 칸 상태:', s.levels[1].formats['single-choice'].status, `(n=${s.levels[1].formats['single-choice'].n})`);
  const d2 = bank.PUBLISHED.filter(i => i.skillId === 'ko2.reading.context' && i.difficulty === 2).map(bank.itemMeta);
  const other = bank.PUBLISHED.filter(i => i.skillId === 'ko2.reading.detail' && i.difficulty === 1).map(bank.itemMeta);
  const r = coach.recommend([...d2, ...other].map(cand), {});
  const ranked = [r.selected, ...r.alternatives];
  console.log('    다음 추천에서 난도2(같은 능력) 첫 순위:', ranked.findIndex(c => c.difficulty === 2) + 1, '/', ranked.length, '— 아래 칸이 「혼자 해냄」이 될 수 없어 난도2는 늘 −0.25');
}
