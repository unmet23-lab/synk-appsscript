#!/usr/bin/env node
// 쓰기 채점 일치 시험의 분석 — README 「시험 ①」의 기준 1~4를 결과.jsonl에서 센다. 표는 마크다운으로 찍는다.
//   node 분석.mjs [--out <결과 폴더>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const outDir = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(here, '결과'));
const { ESSAYS } = await import(pathToFileURL(path.join(here, 'essays24.mjs')).href);

const rows = fs.readFileSync(path.join(outDir, '결과.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
const CATS = ['content', 'structure', 'language'];
const CAT_KO = { content: '내용', structure: '전개', language: '언어' };
const TARGET = { language: 'language', content: 'content', structure: 'structure' };
const WEIGHT = { 53: { content: 7, structure: 7, language: 16 }, 54: { content: 12, structure: 12, language: 26 } };
const VALUE = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const type = (essay) => Number(essay.item.slice(1, 3));

// 채점(run)마다 글 → 범주 → { high, low, m }. 같은 쌍이 여러 줄이면 마지막 성공을 쓴다.
const byRun = {};
for (const row of rows) {
  if (!row.ok) continue;
  const cats = {};
  for (const c of row.parsed.categories) cats[c.id] = { high: c.high, low: c.low, m: (VALUE[c.high] + VALUE[c.low]) / 2 };
  (byRun[row.run] ||= {})[row.essayId] = cats;
}
const runs = Object.keys(byRun);
const pct = (n, d) => (d ? `${n}/${d} (${Math.round((n / d) * 100)}%)` : '0/0');
const rate = (n, d) => (d ? n / d : 0);

function cellDiffs(a, b) {
  const out = [];
  for (const essay of ESSAYS) for (const cat of CATS) {
    const x = byRun[a]?.[essay.id]?.[cat], y = byRun[b]?.[essay.id]?.[cat];
    if (x && y) out.push(Math.abs(x.m - y.m));
  }
  return out;
}
const points = (essay, cats) => CATS.reduce((sum, cat) => sum + WEIGHT[type(essay)][cat] * (cats[cat].m / 5), 0);

const summary = { runs, counts: Object.fromEntries(runs.map((r) => [r, Object.keys(byRun[r]).length])) };
const lines = [];
lines.push(`채점별 성공 글 수: ${runs.map((r) => `${r} ${summary.counts[r]}`).join(' · ')} · 실패 줄 ${rows.filter((r) => !r.ok).length}`);
const spent = rows.reduce((sum, r) => sum + (r.estUSD || 0), 0);
lines.push(`추정 비용 합 $${spent.toFixed(3)}(실패 · 재시도 포함)`);
summary.spentUSD = spent;

// 기준 1 · 2
const d12 = cellDiffs('S1', 'S2'), d1o = cellDiffs('S1', 'O'), d2o = cellDiffs('S2', 'O');
const within = (arr, lim) => arr.filter((d) => d <= lim + 1e-9).length;
summary.c1 = { within05: rate(within(d12, 0.5), d12.length), n: d12.length };
summary.c2 = { within10: rate(within(d1o, 1.0), d1o.length), within05: rate(within(d1o, 0.5), d1o.length), n: d1o.length };
summary.c2b = { within10: rate(within(d2o, 1.0), d2o.length), within05: rate(within(d2o, 0.5), d2o.length), n: d2o.length };
lines.push('', '| 기준 | 잰 값 | 선 | 넘음 |', '|---|---|---|---|');
lines.push(`| 1 재현 S1 대 S2 · 차이 ≤ 0.5 | ${pct(within(d12, 0.5), d12.length)} | 90% | ${summary.c1.within05 >= 0.9 ? '예' : '아니오'} |`);
lines.push(`| 2 모델 사이 S1 대 O · 차이 ≤ 1.0 | ${pct(within(d1o, 1.0), d1o.length)} | 90% | ${summary.c2.within10 >= 0.9 ? '예' : '아니오'} |`);
lines.push(`| 2 모델 사이 S1 대 O · 차이 ≤ 0.5 | ${pct(within(d1o, 0.5), d1o.length)} | 60% | ${summary.c2.within05 >= 0.6 ? '예' : '아니오'} |`);
lines.push(`| (참고) S2 대 O · ≤ 1.0 / ≤ 0.5 | ${pct(within(d2o, 1.0), d2o.length)} / ${pct(within(d2o, 0.5), d2o.length)} | — | — |`);

// 기준 3
let c3ok = 0, c3n = 0;
const pointRows = [];
for (const essay of ESSAYS) {
  const s = byRun.S1?.[essay.id], o = byRun.O?.[essay.id];
  if (!s || !o) continue;
  const ps = points(essay, s), po = points(essay, o), lim = type(essay) === 53 ? 3 : 5;
  c3n++; if (Math.abs(ps - po) <= lim + 1e-9) c3ok++;
  pointRows.push({ id: essay.id, S1: ps, O: po, diff: ps - po, lim });
}
summary.c3 = { within: rate(c3ok, c3n), n: c3n, rows: pointRows };
lines.push(`| 3 총점 차이 S1 대 O(53 ≤ 3점 · 54 ≤ 5점, 우리 가정 환산) | ${pct(c3ok, c3n)} | 80% | ${summary.c3.within >= 0.8 ? '예' : '아니오'} |`);

// 기준 4 — 채점마다
summary.c4 = {};
for (const run of runs) {
  let hit = 0, n = 0, targetDrop = 0, otherDrop = 0;
  for (const essay of ESSAYS.filter((e) => e.version !== 'L1')) {
    const base = byRun[run]?.[`${essay.item}.L1`], weak = byRun[run]?.[essay.id];
    if (!base || !weak) continue;
    const t = TARGET[essay.target];
    const drop = base[t].m - weak[t].m;
    const others = CATS.filter((c) => c !== t).map((c) => base[c].m - weak[c].m);
    n++; if (drop >= 1.0 - 1e-9) hit++;
    targetDrop += drop; otherDrop += others.reduce((a, b) => a + b, 0) / others.length;
  }
  summary.c4[run] = { hit: rate(hit, n), n, meanTargetDrop: n ? targetDrop / n : 0, meanOtherDrop: n ? otherDrop / n : 0 };
  lines.push(`| 4 겨냥한 범주 1.0 이상 내림 · ${run} | ${pct(hit, n)} · 평균 내림 겨냥 ${(targetDrop / (n || 1)).toFixed(2)} / 나머지 ${(otherDrop / (n || 1)).toFixed(2)} | 80% · 겨냥 > 나머지 | ${rate(hit, n) >= 0.8 && targetDrop > otherDrop ? '예' : '아니오'} |`);
}

// 글마다 범위 표
lines.push('', '| 글 | 겨냥 | ' + runs.map((r) => `${r} 내용·전개·언어`).join(' | ') + ' | 총점 S1 / O |', '|---|---|' + runs.map(() => '---|').join('') + '---|');
for (const essay of ESSAYS) {
  const cells = runs.map((r) => { const c = byRun[r]?.[essay.id]; return c ? CATS.map((k) => `${c[k].high}${c[k].low}`).join(' · ') : '—'; });
  const pr = pointRows.find((p) => p.id === essay.id);
  lines.push(`| ${essay.id} | ${essay.target === 'strong' ? '잘 쓴 글' : CAT_KO[essay.target]} | ${cells.join(' | ')} | ${pr ? `${pr.S1.toFixed(1)} / ${pr.O.toFixed(1)}` : '—'} |`);
}
summary.essays = ESSAYS.map((essay) => ({ id: essay.id, item: essay.item, version: essay.version, target: essay.target,
  bands: Object.fromEntries(runs.map((r) => [r, byRun[r]?.[essay.id] ? Object.fromEntries(CATS.map((k) => [k, `${byRun[r][essay.id][k].high}${byRun[r][essay.id][k].low}`])) : null])),
  points: pointRows.find((p) => p.id === essay.id) || null }));
fs.writeFileSync(path.join(outDir, '분석.json'), JSON.stringify(summary, null, 1));
console.log(lines.join('\n'));
