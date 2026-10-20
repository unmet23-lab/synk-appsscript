#!/usr/bin/env node
// TOPIK 연습 문항 묶음(experiences/topik-items) 검사·목록·재고.
//   node tools/topik-items.mjs            문항 파일 검사 + bank-files.mjs가 지금 파일 목록과 같은지
//   node tools/topik-items.mjs --묶기     bank-files.mjs를 다시 만든다(items/*.json 전부)
//   node tools/topik-items.mjs --재고     Core 칸(시험·능력·난도·응답 형식)마다 새 문항·기존 통과 문항 수와 목표
//   node tools/topik-items.mjs --소리     듣기 문항의 음성 파일 상태(파일 존재는 이 명령에서만 본다 — CI는 미디어를 받지 않는다)
//   --json을 붙이면 결과를 JSON으로 낸다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateBank, answerSpread, reviewOutcome, contentHash, itemKeyOf } from '../experiences/topik-items/validate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankDir = path.join(root, 'experiences/topik-items');
const itemsDir = path.join(bankDir, 'items');
const registry = path.join(bankDir, 'bank-files.mjs');
// 한 칸(능력 × 난도 × 응답 형식)이 「확인 → 보충 → 다시 확인」을 끝내려면 새 계열이 이만큼 있어야 한다:
// Core는 최근 30일 고유 계열 12개 창에서 4개 이상·80% 이상을 「혼자 해냄」으로 본다(atlas/learning.js POLICY).
// 첫 세 문항에서 둘을 놓친 학생은 새 문항 일곱을 더 맞혀야 8/10이 되고, 7일 뒤 다시 확인에 한두 개가 더 든다.
export const CELL_TARGET = 12;

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
export function loadFiles() {
  if (!fs.existsSync(itemsDir)) return [];
  return fs.readdirSync(itemsDir).filter(name => name.endsWith('.json')).sort()
    .map(name => ({ name: `items/${name}`, data: readJson(path.join(itemsDir, name)) }));
}
export function loadContext() {
  const types = readJson(path.join(root, 'strata/topik-types.json'));
  const ids = rel => new Set(readJson(path.join(root, rel)).nodes.filter(node => node.kind === 'skill').map(node => node.id));
  return { types: types.types, typeDoc: types, skillIds: { 'topik-i': ids('strata/maps/topik-i.json'), 'topik-ii': ids('strata/maps/topik-ii.json') },
    pending: new Set(Object.keys(types.pending || {})) };
}

export function registrySource(files) {
  const lines = ['// 만든 파일 — tools/topik-items.mjs --묶기. 손으로 고치지 않는다(items/*.json을 고친 뒤 다시 만든다).'];
  files.forEach(({ name }, index) => lines.push(`import f${index} from './${name}' with { type: 'json' };`));
  lines.push(`export const ITEM_FILES = Object.freeze([${files.map((_, index) => `f${index}`).join(', ')}]);`, '');
  return lines.join('\n');
}

function checkAll() {
  const files = loadFiles(), context = loadContext();
  const problems = validateBank(files, context);
  const expected = registrySource(files);
  const current = fs.existsSync(registry) ? fs.readFileSync(registry, 'utf8').replace(/\r\n/g, '\n') : null;
  if (current !== expected) problems.push('bank-files.mjs가 items/ 목록과 다르다 — node tools/topik-items.mjs --묶기');
  const items = files.flatMap(file => file.data.items || []);
  for (const exam of ['topik-i', 'topik-ii']) for (const section of ['listening', 'reading']) {
    const spread = answerSpread(items.filter(item => item.exam === exam && item.section === section));
    if (spread.skewed) problems.push(`${exam} ${section}: 정답 자리가 한쪽에 쏠렸다 ${spread.counts.join('/')}`);
  }
  return { files, items, problems };
}

async function existingRows() {
  // WORLD 진단에 실린 기존 게임 문항(판정 전후를 함께 센다). 원고를 바꾸지 않고 읽기만 한다.
  const diag = await import(pathToFileURL(path.join(root, 'experiences/synk-world-app/world-diagnostic-items.mjs')));
  const verdicts = readJson(path.join(bankDir, 'review/existing-verdicts.json'));
  const pass = new Map((verdicts.items || []).filter(row => row.verdict === 'pass').map(row => [row.itemKey, row]));
  const judged = new Map((verdicts.items || []).map(row => [row.itemKey, row]));
  return diag.DIAGNOSTIC_ITEMS.map(item => ({ itemKey: item.itemKey, source: item.source, skillId: item.skillId, difficulty: item.difficulty,
    responseFormat: item.responseFormat, judged: judged.has(item.itemKey), pass: pass.has(item.itemKey) }));
}

async function inventory() {
  const { items } = checkAll(), context = loadContext(), existing = await existingRows();
  const cells = new Map();
  const cell = (exam, skillId, difficulty, responseFormat) => {
    const key = `${exam}|${skillId}|${difficulty}|${responseFormat}`;
    if (!cells.has(key)) cells.set(key, { exam, skillId, difficulty, responseFormat, draft: 0, reviewed: 0, held: 0, existingPass: 0, existingOpen: 0, families: new Set() });
    return cells.get(key);
  };
  for (const exam of ['topik-i', 'topik-ii']) for (const skillId of [...context.skillIds[exam], ...(exam === 'topik-i' ? context.pending : [])]) {
    if (skillId.split('.')[1] === 'writing') continue;
    for (const difficulty of [1, 2]) cell(exam, skillId, difficulty, 'single-choice');
  }
  for (const item of items) {
    const row = cell(item.exam, item.skillId, item.difficulty, item.responseFormat);
    if (item.reviewStatus === 'ai-reviewed') { row.reviewed += 1; row.families.add(item.family); }
    else if (item.reviewStatus === 'draft') row.draft += 1; else row.held += 1;
  }
  for (const item of existing) {
    const row = cell('topik-i', item.skillId, item.difficulty, item.responseFormat);
    if (item.pass) row.existingPass += 1; else if (!item.judged) row.existingOpen += 1;
  }
  return [...cells.values()].sort((a, b) => a.exam.localeCompare(b.exam) || a.skillId.localeCompare(b.skillId) || a.difficulty - b.difficulty
    || a.responseFormat.localeCompare(b.responseFormat)).map(({ families, ...row }) => ({ ...row, usable: row.reviewed + row.existingPass,
    target: row.responseFormat === 'single-choice' ? CELL_TARGET : null,
    short: row.responseFormat === 'single-choice' ? Math.max(0, CELL_TARGET - (row.reviewed + row.existingPass + row.draft + row.existingOpen)) : null }));
}

function audioState() {
  const { items } = checkAll();
  return items.filter(item => item.section === 'listening').map(item => {
    const file = path.join(bankDir, item.audio?.file || '');
    return { id: item.id, file: item.audio?.file, status: item.audio?.status, exists: !!item.audio?.file && fs.existsSync(file) };
  });
}

async function main(argv) {
  const json = argv.includes('--json');
  if (argv.includes('--묶기')) {
    const files = loadFiles();
    fs.writeFileSync(registry, registrySource(files));
    console.log(`bank-files.mjs: 파일 ${files.length}`);
    return 0;
  }
  const fileArg = argv.indexOf('--파일');
  if (fileArg >= 0) {
    // 한 파일만 검사(목록 파일은 보지 않는다) — 여러 사람이 동시에 쓰는 동안 bank-files.mjs를 건드리지 않게.
    const target = path.resolve(argv[fileArg + 1] || '');
    const name = path.relative(bankDir, target).replace(/\\/g, '/');
    const problems = validateBank([{ name, data: readJson(target) }], loadContext());
    const items = readJson(target).items || [];
    const spread = answerSpread(items);
    if (spread.skewed) problems.push(`정답 자리가 한쪽에 쏠렸다 ${spread.counts.join('/')}`);
    console.log(`${name}: 문항 ${items.length} · 정답 자리 ${spread.counts.join('/')}`);
    for (const problem of problems) console.log(`  ✗ ${problem}`);
    if (!problems.length) console.log('  검사 통과');
    return problems.length ? 1 : 0;
  }
  if (argv.includes('--재고')) {
    const rows = await inventory();
    if (json) { console.log(JSON.stringify(rows, null, 2)); return 0; }
    console.log('시험\t능력\t난도\t형식\t통과(새)\t통과(기존)\t초안\t보류\t기존 판정 전\t목표\t모자람');
    for (const row of rows) console.log([row.exam, row.skillId, row.difficulty, row.responseFormat, row.reviewed, row.existingPass, row.draft, row.held, row.existingOpen, row.target ?? '-', row.short ?? '-'].join('\t'));
    return 0;
  }
  if (argv.includes('--소리')) {
    const rows = audioState();
    if (json) { console.log(JSON.stringify(rows, null, 2)); return 0; }
    const broken = rows.filter(row => row.status === 'ready' && !row.exists);
    console.log(`듣기 ${rows.length} · 준비됨 ${rows.filter(row => row.status === 'ready').length} · 굽기 전 ${rows.filter(row => row.status === 'pending').length} · 준비됨인데 파일 없음 ${broken.length}`);
    for (const row of broken) console.log(`  ${row.id} ${row.file}`);
    return broken.length ? 1 : 0;
  }
  const { files, items, problems } = checkAll();
  const summary = { files: files.length, items: items.length,
    byStatus: Object.fromEntries(['draft', 'ai-reviewed', 'held', 'rejected'].map(status => [status, items.filter(item => item.reviewStatus === status).length])),
    outcomes: Object.fromEntries(['pass', 'fix', 'drop', 'split', 'incomplete'].map(outcome => [outcome, items.filter(item => reviewOutcome(item) === outcome).length])),
    problems };
  if (json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`문항 파일 ${summary.files} · 문항 ${summary.items} · ${Object.entries(summary.byStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    for (const problem of problems) console.log(`  ✗ ${problem}`);
    if (!problems.length) console.log('  검사 통과');
  }
  return problems.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(error.stack || error.message); process.exitCode = 2; });
}
export { checkAll, inventory, contentHash, itemKeyOf };
