// 읽기 전용 검증: 놀이 7게임의 문항 메타를 지금 WORLD 코치 지도 + Core(recommendActivities)에 후보 targets로 넘기면 받아들이나.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const ROOT = process.argv[2];
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const {worldLearning} = await imp('experiences/synk-world-app/world-learning-map.mjs');
const store = () => { const m = new Map(); return {getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v)}; };
const NOW = '2026-11-09T03:00:00.000Z';
const coach = worldLearning.engine.createGame({gameId: 'world-probe', storage: store(), clock: () => NOW});
const summary = coach.summary();
const known = new Map(summary.skills.map(s => [s.id, s.domain]));
console.log('지도 능력 수', known.size, '· listening', [...known].filter(([, d]) => d === 'listening').length, '· reading', [...known].filter(([, d]) => d === 'reading').length, '· 그 밖', [...new Set([...known.values()])].join(','));
const toTarget = m => ({id: String(m.id).replace(/[^a-zA-Z0-9_.:-]/g, '_'), skillIds: m.skillIds || [m.skillId], difficulty: m.difficulty, modality: m.modality, responseFormat: m.responseFormat, familyKeys: [m.familyKey || m.itemKey], itemKey: m.itemKey, conceptIds: m.conceptIds || []});
const games = {};
try { const L = await imp('experiences/order-rush/learning.mjs'), C = await imp('experiences/order-rush/core.mjs'); games.order = L.orderCandidates(C.ORDERS).map(toTarget); } catch (e) { games.order = e; }
try { const L = await imp('experiences/entry-check/learning.mjs'), C = await imp('experiences/entry-check/content.mjs');
  const cases = []; const walk = v => { if (!v || typeof v !== 'object') return; if (Array.isArray(v)) return v.forEach(walk); if (typeof v.skill === 'string' && typeof v.id === 'string') cases.push(v); Object.values(v).forEach(walk); };
  walk(C.VENUES); games.entry = cases.map(c => toTarget(L.caseMetadata(c))); } catch (e) { games.entry = e; }
try { const L = await imp('experiences/snap-words/learning.mjs'), P = await imp('experiences/snap-words/places.mjs'); games.snap = Object.values(P.PLACES).flatMap(place => L.missionCandidates(place)).map(toTarget); } catch (e) { games.snap = e; }
try { const L = await imp('experiences/talk-rally/learning.mjs'), C = await imp('experiences/talk-rally/content.mjs'); games.rally = L.candidates(C.ITEMS).map(toTarget); } catch (e) { games.rally = e; }
try { const L = await imp('experiences/blank-slice/learning.mjs'), C = await imp('experiences/blank-slice/content.mjs'); games.blank = L.candidates(C.ITEMS).map(toTarget); } catch (e) { games.blank = e; }
try { const R = await imp('experiences/board-decode/review-items.mjs'); const items = R.reviewItems(); games.board = (Array.isArray(items) ? items : items.items || []).map(toTarget); } catch (e) { games.board = e; }
try { const P = await imp('experiences/korean-racing/personalization.js'); games.racing = P.RACING_CANDIDATES.map(toTarget); } catch (e) { games.racing = e; }
for (const [id, raw] of Object.entries(games)) {
  if (raw instanceof Error) { console.log(`\n■ ${id}: 메타 모듈 못 읽음 — ${raw.message.slice(0, 160)}`); continue; }
  const seenIds = new Set(), targets = raw.filter(t => seenIds.has(t.id) ? false : (seenIds.add(t.id), true));
  if (targets.length !== raw.length) console.log(`\n(${id}: 같은 id 중복 ${raw.length - targets.length}건은 하나로)`);
  const skills = [...new Set(targets.flatMap(t => t.skillIds))];
  const missing = skills.filter(s => !known.has(s));
  const mismatch = targets.filter(t => t.skillIds.some(s => known.has(s) && known.get(s) !== t.modality)).length;
  const formats = [...new Set(targets.map(t => t.responseFormat))], mods = [...new Set(targets.map(t => t.modality))], diffs = [...new Set(targets.map(t => t.difficulty))];
  console.log(`\n■ ${id}: 문항 ${targets.length} · 능력 ${skills.join(', ')} · 꼴 ${formats.join('/')} · 양식 ${mods.join('/')} · 난도 ${diffs.join('/')}`);
  if (missing.length) console.log(`  지도 밖 능력: ${missing.join(', ')}`);
  if (mismatch) console.log(`  능력 domain ≠ 후보 modality: ${mismatch}건`);
  const cand = {id: `world.play.${id}`, label: id, route: 'game', gameId: id, minutes: 3, targets, goals: [], audioRequired: mods.includes('listening'), modality: mods[0]};
  try { const r = coach.recommendActivities([cand], {audioAvailable: true, at: NOW}); console.log(`  Core 전체 문항: 통과 · status ${r.status} · reasons ${r.reasons.join(',')}`); }
  catch (e) { console.log(`  Core 전체 문항: 던짐 — ${e.message.slice(0, 120)}`);
    const ok = targets.filter(t => t.skillIds.every(s => known.has(s) && known.get(s) === t.modality) && [1, 2, 3].includes(t.difficulty));
    try { const r = coach.recommendActivities([{...cand, targets: ok}], {audioAvailable: true, at: NOW}); console.log(`  지도 안 문항만(${ok.length}): 통과 · ${r.status}`); } catch (e2) { console.log(`  지도 안 문항만(${ok.length}): 던짐 — ${e2.message.slice(0, 120)}`); } }
}
