'use strict';
// 재확인 내구성 후속(설계 관문 §7, 11-17) 돌연변이 확인: 고친 줄을 하나씩 망가뜨려 시험이 그 결함을 보는지 잰다.
// 공용 작업본의 원천은 건드리지 않는다 — 임시 폴더에 엔진 · 지도 · 소비 둘 · 시험 셋을 복사해 그 사본만 고쳤다 되돌린다(다른 세션의 시험 · 빌드와 겹치지 않음).
//   node docs/_ops/qa/atlas-world-engine-20261108/재확인후속_돌연변이.cjs [이름 걸러내기]   (부하가 없으면 15분쯤 — 성질 시험이 판마다 돈다)
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..'), only = process.argv[2] || '';
const TEMPER = 'atlas/temper.js', CORE = 'atlas/game-learning.js';
const TESTS = ['tests/atlas-followup-durable.test.mjs', 'tests/atlas-followups.test.js', 'tests/atlas-followup-property.test.mjs'];
const M = [
  // ① 앞 사이클 시작 사슬(pc)
  ['P1 추월 판정: pc를 안 봄(앞 사이클 하나만)', TEMPER, '[...history(cell), ...(lateStarts.get(cell) || []), ...cycles.get(cell).map(when)].some(', '[...history(cell).slice(-1), ...(lateStarts.get(cell) || []), ...cycles.get(cell).map(when)].some('],
  ['P2 접기: pc를 얼리지 않음', TEMPER, ", ...(earlier.has(a) ? { pc: earlier.get(a) } : {}) });", ' });'],
  ['P3 앞날 행의 pc를 묶지 않음', TEMPER, 'if (row.at > now) bounds.set(cell, [...(bounds.get(cell) || []), ...before]);', 'if (row.at > now) bounds.set(cell, [...(bounds.get(cell) || []), ...(Number.isFinite(row.ps) ? [row.ps] : [])]);'],
  // ② 읽기 예외 때의 대체 표
  ['F1 대체 표가 fs를 버림', CORE, "...(ledger.followups?.fs ? { fs: ledger.followups.fs } : {}), ", ''],
  // 성질 시험이 찾은 늦은 앵커의 길
  ['L1 날것 앵커 뒤를 로그 차례로', TEMPER, 'const follows = e => row.ra <= Date.parse(e.recordedAt) && (row.at < stamp(e) || row.at === stamp(e) && (!logged || before(logged, e)));', 'const follows = e => (logged ? before(logged, e) : row.at <= stamp(e) && row.ra <= Date.parse(e.recordedAt));'],
  ['L2 늦은 앵커에 lf를 안 닮', TEMPER, ', ...(stamp(a) <= folded ? { lf: folded } : {}) };', ' };'],
  ['L3 lf 창을 fs와 상관없이 막음', TEMPER, 'const lost = due <= row.lf && Object.values(frozenSight).some(at => at >= row.at && at < expires && at <= row.lf);', 'const lost = due <= row.lf;'],
  ['L4 막힌 창을 판단 보류로 안 둠', TEMPER, 'else if (lost) {', 'else if (false) {'],
  ['L5 늦은 앵커의 접힌 계열을 안 봄', TEMPER, '      if (!frozen(anchor) && stamp(anchor) <= folded && trace(byId.get(anchor.presentationId)).some(foldedKey)) row.l = 1;\n', ''],
  ['L6 접힌 계열 규칙을 늦지 않은 앵커까지', TEMPER, 'if (!frozen(anchor) && stamp(anchor) <= folded && trace(', 'if (!frozen(anchor) && trace('],
  // 씨앗 탐침이 찾은 길(설계 관문 §7-4)
  ['S1 늦은 앵커를 시각 순 읽기와 견주지 않음', TEMPER, '(misread(anchor) || unsure.has(anchor.eventId))', 'unsure.has(anchor.eventId)'],
  ['S2 짝을 시각 순 읽기와 견주지 않음', TEMPER, 'if (JSON.stringify(result(byTime(actual))) !== JSON.stringify(read) || stamp(a) <= folded', 'if (stamp(a) <= folded'],
  ['S3 자격 · 종류가 같아도 표시(넓게)', TEMPER, 'return (t.assisted !== a.assisted || t.exposure !== a.exposure) && standing(t) !== standing(a);', 'return t.assisted !== a.assisted || t.exposure !== a.exposure;'],
  ['E1 새로 고른 짝 앞의 늦은 첫 답을 안 봄', TEMPER, '|| first && stamp(first) < pair.at ||', '|| stored && first && stamp(first) < stored.at ||'],
  ['E2 짝 없는 창의 늦은 첫 답을 안 봄(표시한 짝으로 얼리지 않음)', TEMPER, ': first && !lost && due > floor ? { ...pairOf(first), l: 1 } : null;', ': null;'],
  ['C1 추월한 늦은 답의 시각을 사슬에 안 남김', TEMPER, '{ overtaken.add(running.id); lateStarts.set(cell, [...(lateStarts.get(cell) || []), stamp(a)]); }', 'overtaken.add(running.id);'],
  ['C2 얼린 행이 늦은 시작을 안 받음', TEMPER, '      if (frozen(anchor)) Object.assign(row, withPs(anchor));\n', ''],
  ['N1 늦은 시작 뒤 사이클을 표시하지 않음', TEMPER, '        if (Number.isFinite(lateBy) && when(running) + keep < lateBy) unsure.add(a.eventId);\n', ''],
  ['N2 시작점 행이 lf를 버림', TEMPER, '...withPs(a), ...(Number.isFinite(a.lf) ? { lf: a.lf } : {}) }', '...withPs(a) }'],
  ['A1 시계 너머 행을 표시하지 않음', TEMPER, '.filter(row => row.at > now).map(markAhead),', '.filter(row => row.at > now),'],
  ['A2 시계 너머 짝을 표시하지 않음', TEMPER, '      for (const [window, pair] of Object.entries(out.t)) if (', '      if (false) for (const [window, pair] of Object.entries(out.t)) if ('],
  // 검수 사이에 찾은 길: Trail은 측정 정보 없는 옛 제시에 계열 키를 두지 않는다
  ['K1 도움 · 시도를 Temper 키로 모음(옛 제시의 계열)', TEMPER, 'for (const key of trailKeys(byId.get(e.presentationId))) {', 'for (const key of trace(byId.get(e.presentationId))) {'],
  // 카본 검수(11-17)가 짚은 길
  ['B1 늦은 시작 뒤 얼린 다음 시작을 표시하지 않음', TEMPER, '        if (running && Number.isFinite(running.lf) && when(running) + keep < running.lf) overtaken.add(row.id);\n', ''],
  ['B2 사슬 머리 앞 사이클을 첫 얼린 행에서만', TEMPER, 'const history = cell => { const head = when(cycles.get(cell)[0]); return (known.get(cell) || []).filter(at => at < head); };', 'const history = cell => { const first = cycles.get(cell)[0]; return frozen(first) ? [...(first.pc || []), ...(Number.isFinite(first.ps) ? [first.ps] : [])] : []; };'],
  ['B3 lf 창이 창 앞에 보인 계열을 안 봄', TEMPER, 'some(at => at >= row.at && at < expires && at <= row.lf)', 'some(at => at >= due && at < expires && at <= row.lf)'],
  ['B4 바닥 아래 처음 시각 없는 접힌 계열을 맨 앞으로', TEMPER, 'sight = frozenSight[keys[1]] ?? (Number.isFinite(floor) && foldedShown.has(keys[1]) ? floor : undefined);', 'sight = frozenSight[keys[1]];'],
  ['B5 늦은 짝의 접힌 도움 · 시도를 안 봄', TEMPER, ' || stamp(a) <= folded && trailKeys(p).some(foldedKey)) pair.l = 1; }', ') pair.l = 1; }'],
  ['B6 늦은 앵커가 접힌 제시만 봄(철회한 제시의 비트를 안 봄)', TEMPER, 'trace(byId.get(anchor.presentationId)).some(foldedKey)) row.l = 1;', 'trace(byId.get(anchor.presentationId)).some(key => foldedShown.has(key))) row.l = 1;'],
  // Fable 최종 검수(11-17)
  ['H1 표시한 짝을 cutoff 뒤면 얼리지 않음', TEMPER, 'const held = pair => !!pair.l || pair.at <= cutoff', 'const held = pair => pair.at <= cutoff'],
];
const lf = text => text.replace(/\r\n/g, '\n');
// --앵커: 돌리지 않고 돌연변이마다 고칠 줄이 원천에 꼭 한 번 있는지만 본다.
if (only === '--앵커') {
  for (const [name, file, find] of M) console.log(`${lf(fs.readFileSync(path.join(root, file), 'utf8')).split(find).length - 1}번  ${name}`);
  process.exit(0);
}
const box = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-followup-mutate-'));
const copy = rel => { const from = path.join(root, rel), to = path.join(box, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.cpSync(from, to, { recursive: true }); };
for (const rel of ['atlas', 'strata', 'package.json', 'experiences/synk-world-app/world-learning-followups.mjs', 'experiences/synk-world-app/life-followups.mjs', ...TESTS]) copy(rel);
function run() {
  const out = path.join(box, 'mutate.tap');
  spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-reporter-destination=${out}`, ...TESTS], { cwd: box, env: { ...process.env, CI: '1', ATLAS_FOLLOWUP_SEEDS: '0' }, encoding: 'utf8' });
  const tap = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const count = name => Number((tap.match(new RegExp(`^# ${name} (\\d+)`, 'm')) || [0, 0])[1]);
  return { pass: count('pass'), fail: count('fail'), failed: [...tap.matchAll(/^not ok \d+ - (.*)$/gm)].map(m => m[1]) };
}
const rows = [];
try {
  const base = run();
  console.log(`바탕: 통과 ${base.pass} · 실패 ${base.fail}`);
  if (base.fail) throw new Error('바탕 판이 이미 실패한다 — 돌연변이를 잴 수 없다');
  for (const [name, file, find, replace] of M) {
    if (only && !name.includes(only)) continue;
    const full = path.join(box, file), original = fs.readFileSync(full, 'utf8'), text = lf(original);
    if (text.split(find).length !== 2) { rows.push({ name, result: `앵커가 ${text.split(find).length - 1}번 — 돌연변이를 못 걸었다` }); continue; }
    try {
      fs.writeFileSync(full, text.replace(find, replace));
      const r = run();
      rows.push({ name, result: r.fail ? `잡힘(실패 ${r.fail})` : `살아남음(통과 ${r.pass})`, failed: r.failed.slice(0, 4) });
    } finally { fs.writeFileSync(full, original); }
    const last = rows.at(-1); console.log(`${last.name} → ${last.result}`); for (const f of last.failed || []) console.log(`    · ${f.slice(0, 150)}`);
  }
} finally { fs.rmSync(box, { recursive: true, force: true }); }
console.log(`\n${rows.filter(r => r.result.startsWith('잡힘')).length}/${rows.length} 잡힘`);
