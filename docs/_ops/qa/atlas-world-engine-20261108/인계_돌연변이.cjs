'use strict';
// 동기화 인계 · 재확인의 늦은 도움(인계와_늦은도움_설계.md) 돌연변이 확인: 고친 줄을 하나씩 망가뜨려 새 시험이 그 결함을 보는지 잰다.
// 원천(atlas/learning-sync.js · atlas/temper.js)을 잠깐 고쳤다 되돌리므로 도는 동안 그 두 파일을 읽는 다른 일(시험 · 검수 · 빌드)을 같이 돌리지 않는다.
//   node docs/_ops/qa/atlas-world-engine-20261108/인계_돌연변이.cjs [이름 걸러내기]   (10분쯤, S11은 결과가 같은 판이라 살아남는다)
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..'), only = process.argv[2] || '';
const SYNC = 'atlas/learning-sync.js', TEMPER = 'atlas/temper.js';
const syncTests = ['tests/atlas-history-writer.test.cjs', 'tests/atlas-ledger-sync.test.js', 'tests/atlas-learning-sync.test.js'];
const temperTests = ['tests/atlas-followup-durable.test.mjs', 'tests/atlas-followups.test.js'];
const M = [
  // learning-sync
  ['S1 collect가 저장된 outbox를 다시 읽지 않음', SYNC, '  const collect = () => {\n    adopt();\n', '  const collect = () => {\n', syncTests],
  ['S2 pull: 다시 읽되 그 답을 그대로 적음', SYNC, "      if (adopt() || asked !== era) continue;\n      let result;\n      try { result = port.importEvents(response.events); }", "      adopt();\n      let result;\n      try { result = port.importEvents(response.events); }", syncTests],
  ['S3 pull: 다시 읽지 않음', SYNC, "      if (adopt() || asked !== era) continue;\n      let result;\n      try { result = port.importEvents(response.events); }", "      let result;\n      try { result = port.importEvents(response.events); }", syncTests],
  ['S4 flush: 다시 읽지 않음', SYNC, "      if (adopt() || asked !== era) continue;\n      if (!response.accepted.length) {", "      if (!response.accepted.length) {", syncTests],
  ['S5 flush: 다시 읽되 그 답을 그대로 적음', SYNC, "      if (adopt() || asked !== era) continue;\n      if (!response.accepted.length) {", "      adopt();\n      if (!response.accepted.length) {", syncTests],
  ['S6 recover: 다시 읽지 않음', SYNC, "      if (adopt() || asked !== era) { after = state.recoveryCursor || 0; continue; }\n", "", syncTests],
  // 응답은 물은 저장 판 위에만(era): 제 collect()가 요청 중에 바뀐 outbox를 읽었으면 돌아온 자리의 adopt()는 거짓이다.
  ['S12 pull: 요청 중 제 collect가 읽은 것을 안 봄', SYNC, "      if (adopt() || asked !== era) continue;\n      let result;", "      if (adopt()) continue;\n      let result;", syncTests],
  ['S13 flush: 요청 중 제 collect가 읽은 것을 안 봄', SYNC, "      if (adopt() || asked !== era) continue;\n      if (!response.accepted.length) {", "      if (adopt()) continue;\n      if (!response.accepted.length) {", syncTests],
  // 되찾기는 돌아온 뒤 missing을 다시 읽어 결과가 같다(살아남는다) — 세 자리를 같은 꼴로 둔다.
  ['S14 recover: 요청 중 제 collect가 읽은 것을 안 봄', SYNC, "      if (adopt() || asked !== era) { after = state.recoveryCursor || 0; continue; }", "      if (adopt()) { after = state.recoveryCursor || 0; continue; }", syncTests],
  ['S7 save: 읽지 않은 outbox도 덮어씀', SYNC, "      if (storage.getItem(key) !== lastStoredRaw) throw failure('STORAGE_ERROR', 'Atlas sync: the outbox was removed or changed outside this context');\n", "", syncTests],
  ['S8 adopt: 읽지 못한 outbox의 오류를 감싸지 않음', SYNC, "    } catch (error) { throw error?.code ? error : failure('STORAGE_ERROR', 'Atlas sync: unreadable outbox; preserved without replacement'); }\n    port.markComplete(whole()); era += 1; return true;", "    } catch (error) { throw error; }\n    port.markComplete(whole()); era += 1; return true;", syncTests],
  ['S9 adopt: 장부에 온전함을 알리지 않음', SYNC, "    port.markComplete(whole()); era += 1; return true;", "    era += 1; return true;", syncTests],
  ['S10 adopt: 늘 안 바뀐 것으로 답함', SYNC, "    port.markComplete(whole()); era += 1; return true;", "    port.markComplete(whole()); return false;", syncTests],
  ['S11 adopt: outbox가 없을 때도 읽으려 함(같은 판과 견줌만)', SYNC, "      if (current == null || current === lastStoredRaw) return false;", "      if (current === lastStoredRaw) return false;", syncTests],
  // temper
  ['T1 읽기: 얼린 retention 행의 늦은 도움 · 시도를 안 봄', TEMPER, "      if (overtaken.has(row.id) || row.k === 'retention' && metLate(row, row.at)) row.l = 1;", "      if (overtaken.has(row.id)) row.l = 1;", temperTests],
  ['T2 읽기: recovery 행까지 표시', TEMPER, "      if (overtaken.has(row.id) || row.k === 'retention' && metLate(row, row.at)) row.l = 1;", "      if (overtaken.has(row.id) || metLate(row, row.at)) row.l = 1;", temperTests],
  ['T3 읽기: 시도는 안 봄(도움만)', TEMPER, "if (['practice.helped', 'practice.attempted'].includes(e.type) && byId.get(e.presentationId)", "if (['practice.helped'].includes(e.type) && byId.get(e.presentationId)", temperTests],
  ['T4 읽기: 도움은 안 봄(시도만)', TEMPER, "if (['practice.helped', 'practice.attempted'].includes(e.type) && byId.get(e.presentationId)", "if (['practice.attempted'].includes(e.type) && byId.get(e.presentationId)", temperTests],
  ['T5 읽기: 같은 시각까지 앞선 것으로', TEMPER, "some(e => stamp(e) < at && !(answer.pf || []).includes(e.id))", "some(e => stamp(e) <= at && !(answer.pf || []).includes(e.id))", temperTests],
  ['T6 읽기: 문항 키만 봄(계열 안 봄)', TEMPER, "const metLate = (answer, at) => [`item:${answer.i}`, `family:${answer.fa}`].some(", "const metLate = (answer, at) => [`item:${answer.i}`].some(", temperTests],
  ['T7 읽기: 짝의 늦은 도움 · 시도를 안 봄', TEMPER, " || /^independent/.test(pair.o) && metLate(pair, pair.at))) pair.l = 1;", ")) pair.l = 1;", temperTests],
  ['T8 읽기: 혼자 한 답이 아닌 짝까지 표시', TEMPER, " || /^independent/.test(pair.o) && metLate(pair, pair.at))) pair.l = 1;", " || metLate(pair, pair.at))) pair.l = 1;", temperTests],
  ['T9 lateHelp: 앵커 행을 안 봄', TEMPER, "anchored = row => row.k === 'retention' && came(row.p, row.at);", "anchored = () => false;", temperTests],
  ['T10 lateHelp: recovery 행까지 표시', TEMPER, "anchored = row => row.k === 'retention' && came(row.p, row.at);", "anchored = row => came(row.p, row.at);", temperTests],
  ['T11 lateHelp: 답 뒤의 도움까지 표시', TEMPER, "h.presentationId === p && Date.parse(h.at) < at);", "h.presentationId === p);", temperTests],
  ['T12 lateHelp: 짝을 안 봄', TEMPER, "const hit = pair => /^independent/.test(pair.o) && came(pair.p, pair.at),", "const hit = () => false,", temperTests],
  ['T13 carryMarks: 행 표시를 안 옮김', TEMPER, "      if (row.l) marks.add(row.id);\n", "", temperTests],
];
const lf = text => text.replace(/\r\n/g, '\n');
function run(tests) {
  const out = path.join(require('node:os').tmpdir(), `mutate-${process.pid}.tap`);
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-reporter-destination=${out}`, ...tests], { cwd: root, env: { ...process.env, CI: '1' }, encoding: 'utf8' });
  const tap = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const count = name => Number((tap.match(new RegExp(`^# ${name} (\\d+)`, 'm')) || [0, 0])[1]);
  const failed = [...tap.matchAll(/^not ok \d+ - (.*)$/gm)].map(m => m[1]);
  return { pass: count('pass'), fail: count('fail'), failed, status: r.status };
}
const rows = [];
for (const [name, file, find, replace, tests] of M) {
  if (only && !name.includes(only)) continue;
  const full = path.join(root, file), original = fs.readFileSync(full, 'utf8'), text = lf(original);
  if (text.split(find).length !== 2) { rows.push({ name, result: `앵커가 ${text.split(find).length - 1}번 — 돌연변이를 못 걸었다` }); continue; }
  try {
    fs.writeFileSync(full, text.replace(find, replace));
    const r = run(tests);
    rows.push({ name, result: r.fail ? `잡힘(실패 ${r.fail})` : `살아남음(통과 ${r.pass})`, failed: r.failed.slice(0, 4) });
  } finally { fs.writeFileSync(full, original); }
}
for (const row of rows) { console.log(`${row.name} → ${row.result}`); for (const f of row.failed || []) console.log(`    · ${f.slice(0, 150)}`); }
console.log(`\n${rows.filter(r => r.result.startsWith('잡힘')).length}/${rows.length} 잡힘`);
