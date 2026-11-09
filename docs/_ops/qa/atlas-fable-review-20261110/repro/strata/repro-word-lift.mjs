const __ROOT = (() => { let p = decodeURIComponent(new URL('../../../../../..', import.meta.url).pathname); if (p.endsWith('/')) p = p.slice(0, -1); return p.charAt(2) === ':' ? p.slice(1) : p; })();
// 재현: 낱말 하나 = 문항 하나인 게임(레이싱 낱말 관문)에서, 한 번 틀린 낱말과 한 번 맞힌 낱말 중 8일 뒤 누가 앞서는가
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = process.argv[2] || __ROOT;
const require = createRequire(import.meta.url);
const { createMap } = require(path.join(root, 'strata/index.js'));
const { createGame } = require(path.join(root, 'atlas/game-learning.js'));
const { racingItem } = await import(pathToFileURL(path.join(root, 'experiences/korean-racing/personalization.js')).href);
let t = Date.parse('2026-11-10T03:00:00Z');
const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
const clock = () => new Date(t += 1000).toISOString();
const coach = createGame({ gameId: 'korean-racing', map: createMap(require(path.join(root, 'strata/topik-i.js')).topikMap()), storage, clock, followups: true });
const words = ['w0001', 'w0002', 'w0003', 'w0004', 'w0005', 'w0006'].map(answer => racingItem({ answer, mode: 'listening' }));
console.log('문항 꼴:', JSON.stringify(words[0]));
const play = (item, correct) => { const p = coach.present(item); coach.delivery(p, { audio: 'completed' }); return coach.answer(p, { correct, assessable: true }); };
const a = play(words[0], false), b = play(words[1], true);       // w0001 틀림 · w0002 맞음
console.log('첫 답: w0001 independent', a.independent, '· w0002 independent', b.independent);
const cand = m => ({ id: m.id, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality, responseFormat: m.responseFormat, itemKey: m.itemKey, familyKey: m.familyKey, conceptIds: m.conceptIds });
const show = label => { const s = coach.summary(), r = coach.recommend(words.map(cand), { audioAvailable: true });
  console.log(label, '| concepts:', s.concepts.map(c => `${c.id.slice(8)}:${c.status}(${c.priority})`).join(' '), '| 순서:', [r.selected, ...r.alternatives].map(c => c.id).join(' > ')); };
show('당일   ');
t += 8 * 86400000; show('8일 뒤 ');
t += 30 * 86400000; show('38일 뒤');
