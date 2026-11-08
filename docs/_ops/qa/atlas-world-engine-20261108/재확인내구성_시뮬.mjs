// 재확인이 끊기는 경로를 공개본 바이트로 재는 시뮬레이션(2026-11-08 밤, README §8 「이어서 점검」). 고치기 전 실측이고, 고치는 세션의 대조 기준이다.
//   ① 접기: 교차 지도판 짝이 있는 기기 장부를 옛 판(LAB try/) · 새 판 · 재확인 옵션 없는 게임이 600건 넘겨 접은 뒤 재확인 줄이 어떻게 되는가
//   ② 칸 상한: 앵커 칸이 24를 넘으면 WORLD 공급이 어떻게 되는가 + 실제 문항 데이터의 칸 수
//   node docs/_ops/qa/atlas-world-engine-20261108/재확인내구성_시뮬.mjs <check 폴더>
// check 폴더: A_공개묶음.cjs --판 b가 지은 공용 작업본 .tmp/atlas-world-temper2-pub-20261108-b/check(공개 3cdfb18 계정 묶음과 같은 내용 + 공개본 재확인 투영).
// LAB try/ 묶음(1 판)은 공개 저장소 3cdfb18에서 받는다. 공개 파일은 고치지 않는다 — 내부 이름은 check 폴더 안 임시 사본에서만 내보낸다.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(dir, 'world-account.bundle.mjs'))) throw Error(`check 폴더가 아니다: ${dir}`);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..'), url = f => pathToFileURL(path.join(ROOT, f)).href;
const probe = path.join(dir, '__durability-account.mjs');
fs.writeFileSync(probe, fs.readFileSync(path.join(dir, 'world-account.bundle.mjs'), 'utf8')
  + '\nexport{require_game_learning as __A_core,require_strata as __A_strata,worldMapData as __A_worldMapData};\n');
let acc;
try { acc = await import(pathToFileURL(probe).href); } finally { fs.rmSync(probe, { force: true }); }
const { followupRows } = await import(pathToFileURL(path.join(dir, 'world-learning-followups.mjs')).href);
const core = acc.__A_core(), strata = acc.__A_strata(), data = acc.__A_worldMapData();
const tryBundle = await (await fetch('https://raw.githubusercontent.com/unmet23-lab/synk-policy/3cdfb18/try/order-rush/atlas-learning.js')).text();
const sandbox = { console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, structuredClone, crypto: globalThis.crypto };
vm.createContext(sandbox);
vm.runInContext(`${tryBundle}\nglobalThis.__try = SynkLearning;`, sandbox);
const lab = sandbox.__try;

const copy = v => JSON.parse(JSON.stringify(v));
const grown = d => { const n = copy(d), g = n.nodes.find(x => x.kind === 'grammar_point'); n.nodes.push({ ...copy(g), id: `${g.id}-grown` }); n.map_ver = `${d.map_ver}-grown`; return n; };
const item = (n, difficulty = 1, skillId = 'ko.reading.detail') => ({ id: `i-${n}`, itemKey: `i-${n}.v1`, familyKey: `i-${n}`, skillId, difficulty, responseFormat: 'single-choice', modality: 'reading', audioRequired: false });
const answer = (g, it, correct = true) => g.answer(g.present(it), { correct, assessable: true });
const DAY = 86400000, MIN = 60000, START = Date.parse('2026-11-09T03:00:00Z');
function bench() {
  let t = START; const mem = new Map();
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  const clock = () => new Date(t += 1000).toISOString();
  let last = null; const open = g => { last?.flush?.(); return last = g; };
  return { mem, at: days => { t = START + days * DAY; }, add: ms => { t += ms; },
    world: d => open(core.createGame({ gameId: 'world-practice', map: strata.createMap(d), storage, clock, followups: true })),
    lab: followups => open(lab.engine.createGame({ gameId: 'order-rush', storage, clock, followups })),
    other: (d, followups) => open(core.createGame({ gameId: 'other-game', map: strata.createMap(d), storage, clock, followups })) };
}
const rows = g => { const p = g.followups(); return { complete: p.evidenceComplete, reason: p.coverage?.reason ?? null,
  rows: p.items.filter(r => r.gameId === 'world-practice').map(r => `${r.window}:${r.status}${r.outcome ? `/${r.outcome}` : ''}`).join(' ') }; };

// ① 까다로운 시점: 자란 뒤 첫 시도가 d7 창 바로 앞이라, 옛 판 눈에는 그 다음 시도(새 판의 짝)가 앵커도 짝도 아니다.
function pair(b, tricky) {
  const G = grown(data); let c = b.world(data);
  b.at(0); answer(c, item(1));
  if (tricky) { b.at(6.9); c = b.world(G); answer(c, item(2)); b.at(7.1); answer(c, item(3)); }
  else { b.at(2); c = b.world(G); answer(c, item(2)); }
  return { G, coach: c };
}
const ledgerOf = b => { const j = JSON.parse([...b.mem.values()][0]); return { kept: j.events?.length, folded: j.ledger?.folded ?? 0, preserved: j.ledger?.followupsPreserved ?? null, lost: Boolean(j.ledger?.followupsLost) }; };
console.log('① 접기 — 600건 넘게 쌓아 접은 뒤 world-practice 재확인 줄');
for (const [label, tricky, who] of [
  ['보통 시점 · 옛 판 재확인 게임', false, 'lab-on'], ['까다로운 시점 · 옛 판 재확인 게임', true, 'lab-on'], ['까다로운 시점 · 새 판 재확인 게임(대조)', true, 'new-on'],
  ['보통 시점 · 새 판 옵션 없는 게임', false, 'new-off'], ['보통 시점 · 옛 판 옵션 없는 게임', false, 'lab-off'],
]) {
  const b = bench(), { G, coach } = pair(b, tricky), before = rows(coach);
  b.at(tricky ? 7.2 : 2.1);
  const g = who === 'lab-on' ? b.lab(true) : who === 'lab-off' ? b.lab(false) : b.other(data, who === 'new-on');
  for (let i = 0; i < 180; i++) { answer(g, item(1000 + i, 2)); b.add(MIN); }
  g.flush?.();
  const ledger = ledgerOf(b), after = rows(b.world(G));
  console.log(`  ${label}\n    전: ${before.rows}\n    뒤: ${after.rows || '(줄 없음)'} · 완전 ${after.complete} · ${after.reason ?? ''} · 접힘 ${ledger.folded} · 보존표시 ${ledger.preserved}`);
}

// ② 칸 상한: 칸을 하루에 처음 풀고 이틀 뒤 공급을 본다.
const skills = data.nodes.filter(n => n.kind === 'skill' && n.domain === 'reading').map(n => n.id);
function cap(cellCount) {
  const b = bench(), g = b.world(data), its = [];
  for (let i = 0; i < cellCount; i++) its.push(item(`c${i}`, 1 + Math.floor(i / skills.length), skills[i % skills.length]));
  for (const it of its) answer(g, it);
  b.at(2);
  const p = g.followups(), pool = its.map(it => ({ ...it, id: `n-${it.id}`, itemKey: `n-${it.itemKey}`, familyKey: `n-${it.familyKey}` }));
  const r = followupRows({ projection: p, pool, seen: () => false, taskVersion: data.map_ver });
  return { 칸: cellCount, 확인할때줄: p.items.filter(x => x.status === 'due').length, 상한초과: p.coverage.limited, 빠진칸: p.coverage.excludedAnchors, 공급중단: r.limited, 공급가능줄: r.rows.filter(x => x.available).length };
}
console.log('② 칸 상한 — WORLD 연습 공급(화면은 앞 12줄만)');
for (const n of [24, 25, 40]) console.log(`  ${JSON.stringify(cap(n))}`);
const cell = i => JSON.stringify([i.skillId, i.difficulty, i.responseFormat, i.modality, i.audioRequired ?? i.modality === 'listening']);
const counts = {};
const count = async (name, fn) => { try { const items = await fn(); counts[name] = new Set(items.filter(i => i?.skillId).map(cell)).size; } catch (e) { counts[name] = `못 셈: ${String(e.message).slice(0, 60)}`; } };
await count('말의 리듬 보충', async () => (await import(url('experiences/korean-rhythm/supplemental.mjs'))).supplementalItems());
await count('주문 폭주', async () => { const { BASE_ORDERS, ADDITIONAL_ORDERS } = await import(url('experiences/order-rush/core.mjs')); const { orderMetadata } = await import(url('experiences/order-rush/learning.mjs')); return [...BASE_ORDERS, ...ADDITIONAL_ORDERS].map(orderMetadata); });
await count('생활 한국어', async () => { const c = await import(url('experiences/synk-world-app/life-content.mjs')); const li = await import(url('experiences/synk-world-app/life-items.mjs')); const items = li.lifeItems(c.LESSONS); return Array.isArray(items) ? items : [...items.values()]; });
await count('WORLD 재확인 은행', async () => { const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'experiences/synk-world-app/world-followup-items.json'), 'utf8')); return b.items || b; });
console.log(`  실제 칸 수(이 넷만): ${JSON.stringify(counts)}`);
