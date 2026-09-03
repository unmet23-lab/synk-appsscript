// 심사 결과 합치기: node _merge_verdicts.js <out.json> <1차.json> <journal1> <journal2> …
// 같은 «절:렌즈» 짝은 먼저 온 것을 남긴다. 집계(축 평균 · 절별 better · 실물 대조)를 같이 낸다.
const fs = require('fs');
const [OUT, FIRST, ...JOURNALS] = process.argv.slice(2);
const seen = new Map();
const add = (r) => { const k = `${r.section}:${r.lens}`; if (!seen.has(k)) seen.set(k, r); };
for (const r of JSON.parse(fs.readFileSync(FIRST, 'utf8'))) add(r);
for (const j of JOURNALS) {
  if (!fs.existsSync(j)) continue;
  for (const l of fs.readFileSync(j, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch (e) { continue; }
    if (o.type === 'result' && o.result && o.result.section && o.result.axes) add(o.result);
  }
}
const v = [...seen.values()].sort((a, b) => (parseInt(a.section.slice(1)) - parseInt(b.section.slice(1))) || a.lens.localeCompare(b.lens));
fs.writeFileSync(OUT, JSON.stringify(v, null, 1));
console.log('합친 심사', v.length, '벌 →', OUT);
const missing = [];
for (let s = 0; s <= 16; s++) for (const l of ['사실정합', '철학깊이', '읽힘결정']) if (!seen.has(`§${s}:${l}`)) missing.push(`§${s}:${l}`);
console.log('빠진 짝', missing.length, missing.join(' · ') || '(없음)');
const ax = {};
for (const r of v) for (const a of r.axes) { const k = a.axis.slice(0, 6); ax[k] = ax[k] || { g: 0, e: 0, n: 0 }; ax[k].g += a.gap; ax[k].e += a.eul; ax[k].n++; }
console.log('\n축 | 갑 | 을 (n)');
for (const k of Object.keys(ax)) console.log(k.padEnd(8), (ax[k].g / ax[k].n).toFixed(2), (ax[k].e / ax[k].n).toFixed(2), `(${ax[k].n})`);
const tally = { 갑: 0, 을: 0, 동점: 0 };
const sec = {};
for (const r of v) { tally[r.better] = (tally[r.better] || 0) + 1; (sec[r.section] = sec[r.section] || []).push(`${r.lens.slice(0, 2)}=${r.better}`); }
console.log('\nbetter 집계:', JSON.stringify(tally));
for (const s of Object.keys(sec).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))) console.log(' ', s.padEnd(4), sec[s].join(' · '));
const fe = { 갑: { 틀림: 0, 맞음: 0, 못: 0 }, 을: { 틀림: 0, 맞음: 0, 못: 0 } };
for (const r of v) for (const f of r.factual_errors) { const k = f.verdict === '틀림' ? '틀림' : f.verdict === '맞음' ? '맞음' : '못'; if (fe[f.doc]) fe[f.doc][k]++; }
console.log('\n실물 대조 합:', JSON.stringify(fe));
// 집계 파일 — 종합 에이전트에 args.aggregates 로 넘긴다(에이전트가 다시 세지 않게)
const axisAvg = {};
for (const k of Object.keys(ax)) axisAvg[k] = { 갑: +(ax[k].g / ax[k].n).toFixed(2), 을: +(ax[k].e / ax[k].n).toFixed(2), n: ax[k].n };
const secBetter = {};
for (const r of v) (secBetter[r.section] = secBetter[r.section] || {})[r.lens] = r.better;
const lensTally = {};
for (const r of v) { lensTally[r.lens] = lensTally[r.lens] || { 갑: 0, 을: 0, 동점: 0 }; lensTally[r.lens][r.better]++; }
const agg = { 심사_수: v.length, 빠진_짝: missing, 축_평균: axisAvg, better_합계: tally, 렌즈별_better: lensTally, 절별_better: secBetter, 실물_대조_합: fe, 자: '절 17 × 렌즈 3 · 1~5점 · 심사 모델 = Fable 5.1(눈가림 · 갑/을 이름만) · 2026-09-03' };
fs.writeFileSync(OUT.replace(/\.json$/, '') + '_집계.json', JSON.stringify(agg, null, 1));
console.log('집계 →', OUT.replace(/\.json$/, '') + '_집계.json');
