import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const template = path.join(root, 'outputs/01a10c3d-cfe1-7c40-a1db-eea42c604fd6/shift-evidence-20261007/SHIFT_한업무_실증과_반복공급_20261007.xlsx');
const out = path.join(root, 'outputs/01a10c3d-cfe1-7c40-a1db-eea42c604fd6/shift-internal-pilot-20261007');
const qa = path.join(here, 'qa/workbook');
const inputPath = path.join(here, 'workbook-input.json');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const templateBytes = await fs.readFile(template);
const templateHash = sha(templateBytes);
if (templateHash !== 'a00eac64c7bcd08a5e981981d746fe89f98846ea9ceab900f33a59354ca59156') throw Error('The verified blank template changed.');
const data = JSON.parse(await fs.readFile(inputPath, 'utf8'));
if (data.trials.length !== 2 || data.customer2 !== null) throw Error('Only the two real internal AI runs are allowed.');
for (const trial of data.trials) {
  const duration = (Date.parse(trial.endedAt) - Date.parse(trial.startedAt)) / 60000;
  if (Math.abs(duration - trial.minutes) > 1e-10 || trial.humanHandoff !== null) throw Error('Run timing or unmeasured human handoff is invalid.');
}
await fs.mkdir(out, { recursive: true });
await fs.mkdir(qa, { recursive: true });
if (process.argv.includes('--finalize')) {
  const readJson = async file => JSON.parse((await fs.readFile(path.join(qa, file), 'utf8')).replace(/^\uFEFF/, ''));
  const manifest = await readJson('manifest.json');
  const native = await readJson('native-excel.json');
  const checks = await readJson('checks.json');
  const preserved = await readJson('saved-preservation.json');
  const outputHash = sha(await fs.readFile(manifest.output));
  if (outputHash !== manifest.outputSha256 || outputHash !== native.sourceSha256 || outputHash !== preserved.outputSha256) throw Error('Final workbook hashes disagree.');
  if (checks.some(check => !check.passed) || native.checks.some(check => !check.passed) || preserved.checks !== preserved.passed || native.formulaErrors.length || native.clippedRows.length || !native.readOnly || native.saved) throw Error('Workbook verification did not pass.');
  if (sha(await fs.readFile(inputPath)) !== manifest.inputSha256) throw Error('Observed input data changed during workbook verification.');
  for (const view of manifest.views) if (sha(await fs.readFile(path.join(qa, view.file))) !== view.sha256) throw Error('A reviewed render changed.');
  manifest.nativeExcelPending = false;
  manifest.nativeExcelVerified = true;
  manifest.nativeExcelChecks = native.checks.length;
  manifest.visualReviewPending = false;
  manifest.visualReview = 'All 6 sheets and 14 ranges reviewed at scale 1; changed summary reviewed again after zero-display correction.';
  manifest.savedPreservationChecks = preserved.checks;
  await fs.writeFile(path.join(qa, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const sources = [];
  for (const file of [path.join(here, 'workbook-build.mjs'), inputPath, path.join(qa, 'verify-native.ps1'), path.join(qa, 'verify-preservation.py')]) sources.push({ path: path.relative(root, file).replaceAll('\\', '/'), sha256: sha(await fs.readFile(file)) });
  const report = { status: 'ai-internal-observations-workbook-verified-human-customer-effects-unmeasured', verifiedAt: new Date().toISOString(), output: { path: path.relative(root, manifest.output).replaceAll('\\', '/'), bytes: manifest.outputBytes, sha256: outputHash }, template: { path: path.relative(root, template).replaceAll('\\', '/'), sha256: templateHash, preserved: true }, modelChecks: { passed: checks.length, total: checks.length }, nativeExcel: { passed: native.checks.length, total: native.checks.length, readOnly: true, saved: false, formulaErrors: 0, clippedRows: 0, unmeasuredInputCells: native.unmeasuredInputCells, sourcePreserved: true }, preservation: preserved, visual: { sheets: 6, ranges: 14, scale: 1, complete: true, views: manifest.views }, semantics: { aiRuns: 2, existingSeconds: 99, personalizedSeconds: 77, differenceSeconds: -22, humanTimeMeasured: false, humanHandoffMeasured: false, satisfactionMeasured: false, costsMeasured: false, revenueMeasured: false, customer2Applied: false, causalEffectProven: false }, sources };
  await fs.writeFile(path.join(qa, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, model: checks.length, native: native.checks.length, preservation: preserved.checks, views: manifest.views.length, sha256: outputHash }));
  process.exit(0);
}
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(template));
const names = ['요약', '업무범위', '시행기록', '원가기록', '재사용기록', '판단기록'];
const sheets = Object.fromEntries(names.map(name => [name, wb.worksheets.getItem(name)]));
const before = {};
for (const name of names) before[name] = { values: sheets[name].getRange('A1:U74').values, formulas: sheets[name].getRange('A1:U74').formulas };
const changes = [];
const put = (name, cell, value) => { sheets[name].getRange(cell).values = [[value]]; changes.push({ sheet: name, cell, value: value instanceof Date ? value.toISOString() : value }); };
const read = (name, cell) => sheets[name].getRange(cell).values[0][0];
const date = new Date(`${data.date}T00:00:00Z`);

put('요약', 'A2', 'SHIFT 내부 시범 · 소개 원고 검수');
put('요약', 'A3', 'AI 과업 2건의 관찰 기록. 완료율·시간은 AI 수행 기준이며 사람 업무·고객 효과는 미측정입니다.');
put('요약', 'D6', '내부 시범 기존');
put('요약', 'E6', '내부 시범 개인화');
put('요약', 'D24', 'SYNK 내부 시범');
put('요약', 'A10', 'AI 경과시간 (분)');
put('요약', 'A12', '사람 전환 비율 · 미측정');
put('요약', 'D52', '고정 원고 5구간을 AI 작업자 2명이 각각 1회 검수했습니다. 대표 인수와 사람 사용성은 미확인입니다.');
put('요약', 'D56', '시간·오류는 각 1건 측정. 사람 전환은 대상이 없어 공란입니다. 만족도·사람 시간·고객 효과는 미측정입니다.');
put('요약', 'D58', 'AI 경과시간 99초·77초의 관찰 차이 22초. 개인화 인과효과·사람 시간 절감·성능 우위로 해석하지 않습니다.');
put('요약', 'D60', '청구액·대표 준비/검증 시간·시간단가가 미측정입니다. 원가·매출·수익 잔액은 공란입니다.');
put('요약', 'D62', '고객2와 실제 고객 업무는 미정입니다. 이번 내부 시범을 두 고객 간 반복 공급 증거로 쓰지 않습니다.');
sheets['요약'].getRange('D10:F10').setNumberFormat('0.000');
sheets['요약'].getRange('F9').setNumberFormat('0.0%');
sheets['요약'].getRange('D11:F11').setNumberFormat('0.0%');

put('업무범위', 'A2', 'SYNK 내부 시범의 한 업무');
put('업무범위', 'A3', '고객1은 내부 시범의 구분 라벨입니다. 외부 고객·실운영·사람 효과는 확인하지 않았습니다.');
put('업무범위', 'B6', '내부 시범 (고객1)');
const scope = {
  7: data.customer1, 8: data.workflow, 9: data.completedOutput, 10: data.group, 11: data.version,
  12: '현재 로컬 소개 원고 5구간. 독립 AI 검수 2건만 포함. 고객/학생 자료·인간 과업·공개 상태는 제외.',
  13: date, 14: date, 15: data.comparison, 16: data.conditions,
  17: '5구간 전체에 판정·정본 근거·필수 수정 여부를 기록하면 완료. 누락/형식 오류는 실패, 도움 요청으로 종료는 중단.',
  18: data.timing, 19: data.errorDefinition, 20: data.scopeAcceptance, 21: data.support,
  22: data.rights, 23: data.owner, 24: data.stop, 27: data.costStatus,
  28: '고객2 미정. 고객 간 공급·재사용 비교는 미실행.',
  29: data.reuseConclusion, 30: data.evidenceMap,
};
for (const [row, value] of Object.entries(scope)) put('업무범위', `B${row}`, value);
for (const row of [15, 16, 17, 18, 19, 20, 22, 29, 30]) sheets['업무범위'].getRange(`A${row}:E${row}`).format.rowHeight = 112;

put('시행기록', 'A2', 'AI 검수 시행별 결과');
put('시행기록', 'A3', '실제 내부 AI 실행 2건입니다. AI 경과시간과 결과 오류만 관측했고 사람 전환은 공란으로 둡니다.');
put('시행기록', 'I6', 'AI 경과시간 (분)');
put('시행기록', 'P6', 'AI 시간 (분)');
for (const [i, trial] of data.trials.entries()) {
  const row = 7 + i;
  const values = [trial.id, '고객1', data.group, trial.method, date, trial.subject, data.version, trial.result, trial.minutes, trial.errorCount, null, null, trial.evidence];
  sheets['시행기록'].getRange(`A${row}:M${row}`).values = [values];
  values.forEach((value, col) => changes.push({ sheet: '시행기록', cell: `${String.fromCharCode(65 + col)}${row}`, value: value instanceof Date ? value.toISOString() : value }));
}
sheets['시행기록'].getRange('A7:M8').format = { wrapText: true, verticalAlignment: 'top', rowHeight: 90 };
sheets['시행기록'].getRange('I7:I8').setNumberFormat('0.000');
sheets['시행기록'].getRange('P7:P8').setNumberFormat('0.000');

put('원가기록', 'A3', '청구액·대표 준비/검증 시간·단가를 측정하지 않았습니다. AI 경과시간은 노동 원가로 전환하지 않습니다.');
put('재사용기록', 'A3', '고객2 적용은 미실행입니다. 이번 Core.domain 재사용을 고객2의 재사용율로 기록하지 않습니다.');
put('판단기록', 'A2', '내부 검수 결과와 후속 판단');
put('판단기록', 'A3', 'AI 수행 기록의 검수 결과입니다. 대표 인수·고객 효과·가격·API 출시 판단은 미확정입니다.');
put('판단기록', 'B6', '내부 시범 (고객1)');
const judgments = {
  7: data.conditions, 8: `${data.qualityConclusion} ${data.timeConclusion}`,
  9: data.scopeAcceptance, 10: '두 AI 검수 결과의 실질 오류 0. 사용자 불편·사람 전환·만족도는 미측정.',
  11: data.rights, 12: data.costConclusion, 13: '내부 시범 1업무이며 두 외부 고객 간 공급 비교는 미실행.',
  14: data.reuseConclusion, 15: data.nextDecision, 16: '실고객 반복 공급·수요·품질·경제적 효과 미확인으로 확대 판단 보류.',
  17: `${data.date} Codex의 AI 결과 검수. 대표의 인수 확인은 미완료.`, 18: data.evidenceMap,
};
for (const [row, value] of Object.entries(judgments)) put('판단기록', `B${row}`, value);
for (const row of [7, 8, 12, 14, 15, 18]) sheets['판단기록'].getRange(`A${row}:E${row}`).format.rowHeight = 118;
wb.recalculate();

const checks = [];
const check = (name, sheet, cell, expected) => {
  const actual = read(sheet, cell);
  const ok = typeof expected === 'number' ? typeof actual === 'number' && Math.abs(actual - expected) < 1e-9 : expected === null ? actual === null || actual === '' : actual === expected;
  checks.push({ name, sheet, cell, expected, actual, passed: ok });
  if (!ok) throw Error(`${name} failed at ${sheet}!${cell}.`);
};
check('기존 실제 AI 시행 집계', '요약', 'D8', 1);
check('개인화 실제 AI 시행 집계', '요약', 'E8', 1);
check('기존 과업 완료', '요약', 'D9', 1);
check('개인화 과업 완료', '요약', 'E9', 1);
check('기존 실제 경과시간', '요약', 'D10', 99 / 60);
check('개인화 실제 경과시간', '요약', 'E10', 77 / 60);
check('관찰 시간 차이 정확히 22초', '요약', 'F10', -22 / 60);
for (const cell of ['D11', 'E11', 'D17', 'E17']) check('검수 오류 또는 입력확인 없음', '요약', cell, 0);
for (const cell of ['D12', 'E12', 'H8', 'I8', 'D35', 'D36', 'D40', 'E40', 'D41', 'D42', 'E45', 'E48']) check('미측정 값을 0으로 바꾸지 않음', '요약', cell, null);
check('원가 미완료 표시', '요약', 'D38', '미완료');
for (const row of [7, 8]) { check('실제 시행 집계 상태', '시행기록', `N${row}`, '집계'); check('사람 전환 원자료 공란', '시행기록', `K${row}`, null); }
const allowed = new Set(changes.map(change => `${change.sheet}!${change.cell}`));
const preservation = [];
for (const name of names) {
  const afterValues = sheets[name].getRange('A1:U74').values;
  const afterFormulas = sheets[name].getRange('A1:U74').formulas;
  let formulaMismatches = 0, unexpectedValueChanges = 0;
  for (let r = 0; r < 74; r++) for (let c = 0; c < 21; c++) {
    if (before[name].formulas[r][c] !== afterFormulas[r][c]) formulaMismatches++;
    const key = `${name}!${String.fromCharCode(65 + c)}${r + 1}`;
    if (!before[name].formulas[r][c] && !allowed.has(key) && before[name].values[r][c] !== afterValues[r][c]) unexpectedValueChanges++;
  }
  preservation.push({ sheet: name, formulaMismatches, unexpectedValueChanges });
  if (formulaMismatches || unexpectedValueChanges) throw Error(`Preservation failed for ${name}.`);
}
await fs.writeFile(path.join(qa, 'checks.json'), JSON.stringify(checks, null, 2));
await fs.writeFile(path.join(qa, 'changes.json'), JSON.stringify(changes, null, 2));
await fs.writeFile(path.join(qa, 'preservation.json'), JSON.stringify(preservation, null, 2));
const inspect = await wb.inspect({ kind: 'table', range: '요약!A6:J20', include: 'values,formulas', tableMaxRows: 15, tableMaxCols: 10, maxChars: 5000 });
await fs.writeFile(path.join(qa, 'summary-inspect.ndjson'), inspect.ndjson);
const errors = await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 100 }, summary: 'Formula error scan' });
await fs.writeFile(path.join(qa, 'errors.ndjson'), errors.ndjson);
const output = path.join(out, 'SHIFT_내부시범_소개원고검수_20261007.xlsx');
await (await SpreadsheetFile.exportXlsx(wb)).save(output);
const views = {
  요약: ['A1:J21', 'A23:F49', 'A52:J65'],
  업무범위: ['A1:E15', 'A16:E30'],
  시행기록: ['A1:F13', 'G6:N13', 'N6:U13'],
  원가기록: ['A1:F13', 'G6:P13'],
  재사용기록: ['A1:E11', 'F6:J11'],
  판단기록: ['A1:E12', 'A13:E19'],
};
const renders = [];
for (const [sheet, ranges] of Object.entries(views)) for (const [index, range] of ranges.entries()) {
  const file = `${sheet}-${index + 1}.png`;
  let bytes;
  if (process.argv.includes('--render-summary-only') && !(sheet === '요약' && index === 0)) {
    bytes = await fs.readFile(path.join(qa, file));
  } else {
    const image = await wb.render({ sheetName: sheet, range, scale: 1, format: 'png' });
    bytes = new Uint8Array(await image.arrayBuffer());
    await fs.writeFile(path.join(qa, file), bytes);
  }
  renders.push({ sheet, range, file, scale: 1, sha256: sha(bytes) });
}
const outputBytes = await fs.readFile(output);
if (sha(await fs.readFile(template)) !== templateHash) throw Error('Source template was modified.');
const report = { status: 'actual-ai-internal-runs-recorded-human-customer-effects-unmeasured', output, outputBytes: outputBytes.length, outputSha256: sha(outputBytes), template, templateSha256: templateHash, templatePreserved: true, input: inputPath, inputSha256: sha(await fs.readFile(inputPath)), sheets: names, checks: checks.length, preservation, views: renders, paidProviderCalls: 0, humanTrialRun: false, realCustomerTrialRun: false, nativeExcelPending: true, visualReviewPending: true };
await fs.writeFile(path.join(qa, 'manifest.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output, checks: checks.length, views: renders.length, sha256: report.outputSha256, templatePreserved: true }));
