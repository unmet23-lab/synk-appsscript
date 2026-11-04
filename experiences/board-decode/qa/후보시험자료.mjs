// 후보시험.cjs가 쓰는 사건: 해금 시험(synk-world-app/qa/town-check.test.mjs)과 같은 길로 실제 Trail 사건을 만들고, 원천 topik2Near의 답을 기대값으로 적는다.
//   node experiences/board-decode/qa/후보시험자료.mjs <나갈 JSON>
import fs from 'node:fs';
import { worldLearning } from '../../synk-world-app/world-learning-map.mjs';
import { bankItems } from '../../synk-world-app/world-topik-items.mjs';
import { createDiagnosticSession } from '../../synk-world-app/world-position.mjs';
import * as town from '../../synk-world-app/world-town-check.mjs';

const bank = bankItems(JSON.parse(fs.readFileSync(new URL('../../synk-world-app/world-topik-items.json', import.meta.url), 'utf8')));
const memory = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) }; };
let tick = Date.parse('2026-10-22T01:00:00Z');
const coach = () => worldLearning.engine.createGame({ gameId: 'world-home', storage: memory(), clock: () => new Date(tick += 1000).toISOString() });
function solve(c, items, answers) {
  const session = createDiagnosticSession({ coach: c, items });
  for (const correct of answers) { const now = session.next(); if (!now) break; if (now.item.modality === 'listening') session.delivery('completed'); session.answer(correct ? now.item.correctId : now.item.choices.find((choice) => choice.id !== now.item.correctId).id); }
}
const seen = new Set(), fresh = bank.filter((item) => item.exam === 'topik-ii' && item.modality === 'reading' && !seen.has(item.familyKey) && seen.add(item.familyKey));
const cases = [];
const add = (name, c, complete = true) => { const input = { events: c.events(), evidenceComplete: complete, now: tick + 1000 }; cases.push({ name, input, expected: town.topik2Near(input) }); };
const a = coach(); solve(a, fresh.slice(0, 5), [true, true, true, true, true]); add('다섯 개', a);
solve(a, fresh.slice(5, 6), [false]); add('여섯 가운데 다섯', a); add('기록이 다 안 읽힘', a, false);
const b = coach(); solve(b, fresh.slice(0, 6), [true, true, true, false, false, false]); add('여섯 가운데 셋', b);
const c = coach(); solve(c, fresh.slice(0, 6), [true, true, true, true, false, false]); add('여섯 가운데 넷', c);
fs.writeFileSync(process.argv[2], JSON.stringify(cases));
console.log(cases.map((x) => `${x.name}=${x.expected}`).join(' · '));
