// 워크플로 저널 → 재료 파일. 용법: node 분배2.js <journal.jsonl> <단계: A|B>
const fs = require('fs');
const [J, STAGE] = process.argv.slice(2);
const NAMES = ['Core', 'Loom', 'Vellum', 'Trail', 'Prism', 'Temper', 'Reed'];
const eng = (s) => NAMES.find((n) => String(s || '').includes(n));
const L = J.split(',').flatMap((j) => fs.readFileSync(j, 'utf8').split('\n')).filter(Boolean).map((l) => JSON.parse(l)).filter((l) => l.type === 'result' && l.result && typeof l.result === 'object');
if (STAGE === 'A') {
  const synth = {}, designs = {}, judges = {};
  for (const l of L) {
    const v = l.result;
    if (v.scores && v.winner) { const e = eng(v.engine); (judges[e] ||= []).push(v); continue; }
    if (v.upgrades && v.lens) { const e = eng(v.engine); if (String(v.lens).startsWith('종합')) synth[e] = v; else (designs[e] ||= []).push(v); continue; }
  }
  for (const e of NAMES) {
    if (synth[e]) fs.writeFileSync(`재료/종합_${e}.json`, JSON.stringify(synth[e], null, 1));
    if (designs[e]) fs.writeFileSync(`재료/설계_${e}.json`, JSON.stringify(designs[e], null, 1));
    if (judges[e]) fs.writeFileSync(`재료/심사_${e}.json`, JSON.stringify(judges[e], null, 1));
    console.log(e, '종합', synth[e] ? JSON.stringify(synth[e]).length : 0, '설계', (designs[e] || []).length, '심사', (judges[e] || []).length);
  }
} else if (STAGE === 'B1') {
  const systems = [], verdicts = {};
  for (const l of L) { const v = l.result; if (v.vertical_line_v2) systems.push(v); else if (v.refuted && v.target) { const e = eng(v.target) || '통합'; (verdicts[e] ||= []).push(v); } }
  if (systems.length) fs.writeFileSync('재료/통합_수리전.json', JSON.stringify(systems[systems.length - 1], null, 1));
  for (const e of NAMES) { if (verdicts[e]) fs.writeFileSync(`재료/반박_${e}.json`, JSON.stringify(verdicts[e], null, 1)); console.log(e, '반박', (verdicts[e] || []).length); }
  console.log('통합_수리전', systems.length);
} else if (STAGE === 'B2') {
  const systems = [], repairs = {}, verdicts = {};
  for (const l of L) { const v = l.result; if (v.vertical_line_v2) systems.push(v); else if (v.design && v.change_log) { const e = eng(v.engine) || eng(v.design && v.design.engine); (repairs[e] ||= []).push(v); } else if (v.refuted && v.target) { const e = eng(v.target) || '통합'; (verdicts[e] ||= []).push(v); } }
  if (systems.length) fs.writeFileSync('재료/통합.json', JSON.stringify(systems[systems.length - 1], null, 1));
  for (const e of NAMES) { const rs = repairs[e] || []; if (rs.length) fs.writeFileSync(`재료/수리_${e}.json`, JSON.stringify(rs[rs.length - 1], null, 1)); if (verdicts[e]) fs.writeFileSync(`재료/재반박_${e}.json`, JSON.stringify(verdicts[e], null, 1)); console.log(e, '수리', rs.length, '재반박', (verdicts[e] || []).length); }
  if (verdicts['통합']) fs.writeFileSync('재료/반박_통합.json', JSON.stringify(verdicts['통합'], null, 1));
  console.log('통합(수리후)', systems.length, '반박_통합', (verdicts['통합'] || []).length);
} else if (STAGE === 'B') {
  // 통합(SYSTEM) = thesis+vertical_line_v2 · 수리(REPAIR) = design+change_log · 반박(VERDICT) = target+refuted
  const systems = [], repairs = {}, verdicts = {};
  for (const l of L) {
    const v = l.result;
    if (v.vertical_line_v2) { systems.push(v); continue; }
    if (v.design && v.change_log) { const e = eng(v.engine) || eng(v.design.engine); (repairs[e] ||= []).push(v); continue; }
    if (v.refuted && v.target) { const e = eng(v.target) || '통합'; (verdicts[e] ||= []).push(v); continue; }
  }
  if (systems.length) fs.writeFileSync('재료/통합.json', JSON.stringify(systems[systems.length - 1], null, 1));
  if (systems.length > 1) fs.writeFileSync('재료/통합_수리전.json', JSON.stringify(systems[0], null, 1));
  for (const e of NAMES) {
    const rs = repairs[e] || [];
    if (rs.length) fs.writeFileSync(`재료/수리_${e}.json`, JSON.stringify(rs[rs.length - 1], null, 1));
    if (verdicts[e]) fs.writeFileSync(`재료/반박_${e}.json`, JSON.stringify(verdicts[e], null, 1));
    console.log(e, '수리', rs.length, '반박', (verdicts[e] || []).length);
  }
  if (verdicts['통합']) fs.writeFileSync('재료/반박_통합.json', JSON.stringify(verdicts['통합'], null, 1));
  console.log('통합', systems.length, '반박_통합', (verdicts['통합'] || []).length);
}
