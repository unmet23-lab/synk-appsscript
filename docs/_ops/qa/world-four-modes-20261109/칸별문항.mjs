// 실제 연습 은행(화면이 쓰는 practice pool)과 후보 게임의 문항을 능력 칸(능력 · 난도 · 응답 꼴)별로 센다.
// Core가 「최근 혼자 해냄」으로 보려면 한 칸에서 서로 다른 계열 4개 이상이 필요하다(atlas/learning.js POLICY.sample).
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const ROOT = process.argv[2];
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const {worldPosition: position} = await imp('experiences/synk-world-app/world-position-kit.mjs');
globalThis.fetch = async url => new Response(fs.readFileSync(path.join(ROOT, 'experiences/synk-world-app', path.basename(String(url)))));
await position.topik.load('world-topik-items.json');
const {LISTENING_CHECKS, checkMetadata} = await imp('experiences/korean-runner/listening-check.mjs');
const {RHYTHM_CANDIDATES} = await imp('experiences/korean-rhythm/personalization.mjs');
const {PLAN_ITEMS} = await imp('experiences/subway-rush/plan-items.mjs');
const {decisionMeta} = await imp('experiences/subway-rush/learning.mjs');
const {LESSONS} = await imp('experiences/synk-world-app/life-content.mjs');
const {lifeItem} = await imp('experiences/synk-world-app/life-items.mjs');
const cells = new Map();
const add = (src, skill, difficulty, format, family) => {
  const k = `${skill}|${difficulty}|${format || 'unknown'}`;
  if (!cells.has(k)) cells.set(k, {fam: new Set(), src: new Set()});
  cells.get(k).fam.add(family); cells.get(k).src.add(src);
};
for (const i of position.practice.pool) add('연습', i.skillId, i.difficulty, i.responseFormat, i.familyKey || i.itemKey || i.id);
for (const t of LISTENING_CHECKS.map(checkMetadata)) add('바람길', t.skillId, t.difficulty, t.responseFormat, t.familyKey || t.itemKey);
for (const t of RHYTHM_CANDIDATES) add('리듬', t.skillIds?.[0] || t.skillId, t.difficulty, t.responseFormat, t.familyKey || t.familyKeys?.[0] || t.itemKey);
for (const t of PLAN_ITEMS.map(decisionMeta)) add('환승', t.skillId, t.difficulty, t.responseFormat, t.familyKey || t.itemKey);
for (const l of LESSONS) for (const q of l.questions) { const it = lifeItem({lesson: l, question: q}); if (it && !it.confounded) add('생활', it.skillId, it.difficulty, it.responseFormat, it.familyKey || it.itemKey); }
const rows = [...cells.entries()].map(([k, v]) => ({k, n: v.fam.size, src: [...v.src].join('+')})).sort((a, b) => a.k.localeCompare(b.k));
const group = re => rows.filter(r => re.test(r.k));
for (const [name, re] of [['TOPIK I 듣기 · 읽기', /^ko\.(listening|reading)\./], ['TOPIK II 듣기 · 읽기', /^ko2\.(listening|reading)\./]]) {
  const g = group(re);
  const lo = g.filter(r => r.n < 4), mid = g.filter(r => r.n >= 4 && r.n < 7);
  console.log(`\n${name}: 칸 ${g.length} · 합계 계열 ${g.reduce((a, b) => a + b.n, 0)} · 4 미만 ${lo.length}칸 · 4~6 ${mid.length}칸 · 7 이상 ${g.length - lo.length - mid.length}칸`);
  for (const r of lo) console.log(`  ${r.k} → ${r.n} (${r.src})`);
}
console.log('\n그 밖의 칸:', rows.filter(r => !/^ko2?\.(listening|reading)\./.test(r.k)).map(r => `${r.k}=${r.n}`).join(' · '));
const pool = position.practice.pool;
console.log('\n연습 은행 합계', pool.length, '· TOPIK I', pool.filter(i => !/^ko2\./.test(i.skillId)).length, '· TOPIK II', pool.filter(i => /^ko2\./.test(i.skillId)).length);
