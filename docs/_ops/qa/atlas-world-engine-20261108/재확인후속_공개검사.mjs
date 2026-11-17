// 재확인 내구성 후속 공개 후보(재확인후속_공개묶음.cjs)를 묶음 종류마다 실제로 불러 돌린다. 앵커 대조 · node --check만으로는 끼운 줄이 안 돈다(현장 노트 배포 · 공개).
//   새 판: 설계 관문 §7의 길마다 고친 동작(회귀 시험 tests/atlas-followup-durable.test.mjs의 같은 장면) · 정상 흐름에 판단 보류 없음 · C4(접는 장부 = 통째 장부) ·
//          공개본이 쓴 저장소를 새 판이 잇고 그 반대도 된다.
//   공개본: 같은 장면에서 결함이 보인다(검사가 결함을 볼 수 있다는 대조).
//   대체 표(읽기가 예외를 낸 접기)는 검사 사본의 Temper 읽기만 예외를 내게 고친 판으로 돌린다 — 후보 파일은 건드리지 않는다.
//   node docs/_ops/qa/atlas-world-engine-20261108/재확인후속_공개검사.mjs <check 폴더>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const dir = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(dir, '목록.json'))) throw Error(`check 폴더가 아니다: ${dir}`);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(import.meta.url);
const { 공용작업본 } = require(path.join(ROOT, 'tools/lib/공용작업본.js'));
const acorn = require(path.join(공용작업본(ROOT), 'node_modules', 'acorn'));
const { createMap } = require(path.join(ROOT, 'strata'));
const map = createMap(require(path.join(ROOT, 'strata/maps/topik-i.json')));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, '목록.json'), 'utf8'));
const DAY = 86400000, MIN = 60000, START = Date.parse('2026-12-01T00:00:00Z'), probes = [];
const copy = value => JSON.parse(JSON.stringify(value));
// 묶음 안 __commonJS 모듈의 자리(이름 · 끝 · 함수 몸 범위). 이름 꼬리는 묶음마다 달라 파서로 찾는다.
function modulesOf(text, sourceType) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowReturnOutsideFunction: true }), found = new Map();
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) {
      const key = d.init?.type === 'CallExpression' && /__commonJS/.test(d.init.callee?.name || '') && d.init.arguments[0]?.properties?.[0]?.key?.value;
      if (key && !found.has(key)) found.set(key, { name: d.id.name, end: n.end, body: d.init.arguments[0].properties[0].value });
    }
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') walk(v); }
  })(ast);
  if (!found.has('atlas/game-learning.js')) throw Error('Core 모듈을 못 찾았다');
  return { found, ast };
}
// 검사 사본만: Temper 모듈 안의 followups 선언 하나를 예외를 내는 함수로 바꾼다(재확인 읽기 실패 — Core compact의 대체 표 길).
function breakReading(text, sourceType) {
  const temper = modulesOf(text, sourceType).found.get('atlas/temper.js'); if (!temper) throw Error('Temper 모듈을 못 찾았다');
  const body = text.slice(temper.body.start, temper.body.end), hits = body.split('function followups(').length - 1;
  if (hits !== 1) throw Error(`Temper 안 followups 선언이 하나가 아니다(${hits})`);
  return text.slice(0, temper.body.start) + body.replace('function followups(', 'function followups(){throw new Error("broken reading")}function __followups(') + text.slice(temper.body.end);
}
const script = (text, file, sandbox) => { const core = modulesOf(text, 'script').found.get('atlas/game-learning.js'); vm.createContext(sandbox); vm.runInContext(`${text.slice(0, core.end)}\n;globalThis.__core=${core.name};\n${text.slice(core.end)}`, sandbox, { filename: file }); return sandbox.__core(); };
async function load(file, { broken = false } = {}) {
  let text = fs.readFileSync(path.join(dir, file), 'utf8');
  if (!file.endsWith('.mjs')) { if (broken) text = breakReading(text, 'script'); return { file, game: script(text, file, { console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, structuredClone, AbortController, crypto: globalThis.crypto }) }; }
  // 화면 모듈 import는 빈 함수로(엔진은 안 쓴다). 같은 폴더의 ./ import는 둔다. 머리의 document는 불러오는 동안만 빌려 준다.
  if (broken) text = breakReading(text, 'module');
  const { found, ast } = modulesOf(text, 'module'), core = found.get('atlas/game-learning.js'); let out = text;
  for (const node of ast.body.filter(n => n.type === 'ImportDeclaration' && !n.source.value.startsWith('./')).reverse()) {
    const local = node.specifiers.map(s => s.local.name);
    out = out.slice(0, node.start) + (local.length ? `var ${local.map(n => `${n}=__stub`).join(',')};` : '') + out.slice(node.end);
  }
  const probe = path.join(dir, `__probe-${broken ? 'broken-' : ''}${file}`);
  fs.writeFileSync(probe, `function __stub(){return ''}\n${out}\nexport{${core.name} as __core};\n`); probes.push(probe);
  const lent = !('document' in globalThis);
  if (lent) globalThis.document = { querySelector: () => ({}), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
  let mod; try { mod = await import(pathToFileURL(probe).href); } finally { if (lent) delete globalThis.document; }
  return { file, game: mod.__core() };
}

// ── 장면(회귀 시험과 같은 꼴 — tests/atlas-followup-durable.test.mjs) ─────────────
const item = (name, { family = name, skill = 'ko.reading.detail', difficulty = 1 } = {}) => ({ id: name, itemKey: `${name}.v1`, familyKey: family, skillId: skill, modality: skill.includes('listening') ? 'listening' : 'reading', difficulty, responseFormat: 'single-choice', audioRequired: skill.includes('listening'), confounded: false });
const CELL = { skill: 'ko.reading.detail' }, FOLD = { max: 40, keep: 20, ageMs: 1 }, REMOTE = { remote: true, max: 40, keep: 20, ageMs: 1 };
function bench(E, { fold = FOLD, account = false } = {}) {
  let now = START; const mem = new Map(), key = `${E.KEY}.device`;
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }, clock = () => new Date(now).toISOString();
  const open = (gameId = 'world-practice', engine = E) => {
    const coach = engine.createGame({ gameId, map, storage, clock, followups: true, fold, ...(account ? { learnerKey: 'device', storageScope: 'account', accountKey: 'acct', historyComplete: false } : {}) });
    if (account) coach.syncPort.markComplete(true);
    return coach;
  };
  return { mem, open, at: days => { now = START + days * DAY; }, step: ms => { now += ms; }, get now() { return now; }, stored: () => JSON.parse(mem.get(key)), key };
}
const play = (coach, it, { correct = true, step } = {}) => { const pid = coach.present(it); if (it.audioRequired) coach.delivery(pid, { audio: 'completed' }); step?.(1000); return { pid, answer: copy(coach.answer(pid, { correct, assessable: true })) }; };
const fill = (b, coach, from, count) => { for (let n = 0; n < count; n++) { b.step(1000); play(coach, item(`filler-${from}-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); } };
const rowsOf = (report, id) => copy(report.items).filter(r => r.sourceAttemptId === id);
const windowOf = (report, id, window) => rowsOf(report, id).find(r => r.window === window);
function twoDevices(E) {
  const a = bench(E, { fold: REMOTE, account: true }), b = bench(E, { fold: false, account: true });
  return { a, b, coachA: a.open(), coachB: b.open(), settle: coach => coach.syncPort.settle(coach.events().map(e => e.id)) };
}
const importLate = (coach, events) => coach.syncPort.importEvents(events);
const backPlays = (b, coach, count = 45) => { for (let n = 0; n < count; n++) { b.step(61000); play(coach, item(`back-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); } };
// ① 서버가 돌려주지 않는 0일 답 — 네 사이클 뒤에도 제 사이클 안(접는 판 = 통째 판).
function heldAnswer(E) {
  const run = fold => {
    const b = bench(E, { fold, account: true }), coach = b.open(), reads = [];
    b.at(0); const first = play(coach, item('first', CELL));
    const hold = new Set([first.pid, coach.events().find(e => e.id === first.pid).decisionId]);
    const settle = () => coach.syncPort.settle(coach.events().filter(e => !hold.has(e.id) && !hold.has(e.presentationId) && !hold.has(e.decisionId)).map(e => e.id));
    for (let k = 1; k <= 4; k++) {
      b.at(46 * k); const anchor = play(coach, item(`c-${k}`, CELL));
      b.at(46 * k + 2); fill(b, coach, `f-${k}`, 25); settle(); fill(b, coach, `g-${k}`, 25); settle();
      b.at(46 * k + 3); reads.push(rowsOf(coach.followups(), anchor.answer.eventId).map(r => [r.window, r.status, r.reason]));
    }
    return reads;
  };
  return { whole: run(false), folded: run(REMOTE) };
}
// ② 읽기가 예외를 낸 접기도 앞 표의 계열 처음 시각(fs)을 지닌다.
function brokenFold(E, Broken) {
  const { a, coachA, settle } = twoDevices(E);
  a.at(0); play(coachA, item('a-first', CELL)); a.at(1.5); play(coachA, item('a-pair', { ...CELL, family: 'fp' })); a.at(2); play(coachA, item('a-fx', { ...CELL, family: 'fx' }));
  a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA); fill(a, coachA, 'z', 20); settle(coachA);
  const sight = a.stored().ledger.followups.fs?.['family:fx']; coachA.flush(); coachA.dispose();
  const coach = a.open('world-practice', Broken), before = a.stored().ledger.folded;
  a.at(6); fill(a, coach, 'w', 40); settle(coach); fill(a, coach, 'v', 40); settle(coach); coach.flush(); coach.dispose();
  const { ledger } = a.stored();
  return { sight: Number.isFinite(sight), folded: ledger.folded > before, floor: ledger.followups.floor === ledger.cutoff, kept: ledger.followups.fs?.['family:fx'] === sight };
}
// 로그 차례로만 다시 본 문항이 되는 늦은 앵커(shared) · 다른 계열(other) · 시각으로도 다시 본 문항(already) · 틀린 답(wrong).
function lateAnchor(E, mode) {
  const { a, b, coachA, coachB } = twoDevices(E);
  if (mode === 'already') { a.at(-1); play(coachA, item('a-before', { skill: 'ko.reading.reason', family: 'F' })); }
  b.at(0); const anchor = play(coachB, item('b-anchor', { ...CELL, family: 'F' }), { correct: mode !== 'wrong' });
  a.at(0.5); play(coachA, item('a-after', { skill: 'ko.reading.reason', family: mode === 'other' ? 'G' : 'F' }));
  a.at(0.6); importLate(coachA, coachB.events());
  return rowsOf(coachA.followups(), anchor.answer.eventId).map(r => [r.status, r.reason, r.kind]);
}
// 로그 차례로만 도움 받은 답이 되는 늦은 짝.
function latePair(E, shared) {
  const { a, b, coachA, coachB } = twoDevices(E);
  a.at(0); const mine = play(coachA, item('a-anchor', CELL));
  b.at(1.5); play(coachB, item('b-pair', { ...CELL, family: 'P' }));
  a.at(1.6); const open = coachA.present(item('a-open', { skill: 'ko.reading.reason', family: shared ? 'P' : 'Q' })); a.step(1000); coachA.help(open, 'hint');
  a.at(1.7); importLate(coachA, coachB.events());
  const d1 = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
  return [d1.status, d1.reason, d1.outcome];
}
// 창의 첫 답이 늦게 왔는데 그 계열을 이 기기가 접었다 — 뒤 답이 대신하지 않고, 뒤 답이 없어도 판단 보류.
function lateFirst(E, later) {
  const { a, b, coachA, coachB, settle } = twoDevices(E);
  a.at(0); const mine = play(coachA, item('a-anchor', CELL));
  b.at(1.5); const first = play(coachB, item('b-first', { ...CELL, family: 'Q' }));
  a.at(1.6); play(coachA, item('a-sight', { skill: 'ko.reading.reason', family: 'Q' })); fill(a, coachA, 'x', 20); settle(coachA); fill(a, coachA, 'y', 20); settle(coachA);
  if (later) { a.at(1.8); play(coachA, item('a-later', CELL)); }
  a.at(1.9); importLate(coachA, coachB.events());
  const d1 = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
  return [d1.status, d1.reason, d1.targetAttemptId === first.answer.eventId];
}
// 얼린 행을 추월한 늦은 답의 사이클 — 그 안으로 시계를 되돌려 푼 답은 앵커가 아니다.
function overtakeCycle(E) {
  const { a, b, coachA, coachB, settle } = twoDevices(E);
  a.at(50); const row = play(coachA, item('a-row', CELL)); a.at(51); fill(a, coachA, 'x', 20); settle(coachA); fill(a, coachA, 'y', 20); settle(coachA);
  b.at(20); play(coachB, item('b-late', CELL)); importLate(coachA, coachB.events());
  a.at(52); fill(a, coachA, 'z', 20); settle(coachA); fill(a, coachA, 'w', 20); settle(coachA);
  const stored = a.stored().ledger.followups.rows.find(r => r.id === row.answer.eventId); coachA.flush(); coachA.dispose();
  a.at(30); const back = a.open(), answer = play(back, item('a-back', CELL)), during = rowsOf(back.followups(), answer.answer.eventId).length; back.flush(); back.dispose();
  a.at(53); const report = a.open().followups();
  return { stored: [stored.l ?? null, stored.ps ?? null], during, after: rowsOf(report, answer.answer.eventId).length, row: rowsOf(report, row.answer.eventId).map(r => r.reason) };
}
// 시계 너머 행의 앞 사이클들(pc)도 막는다.
function earlierCycles(E, fold) {
  const b = bench(E, { fold }); let coach = b.open();
  for (const day of [0, 46, 92]) { b.at(day); play(coach, item(`c-${day}`, CELL)); fill(b, coach, `f-${day}`, 45); }
  coach.flush(); coach.dispose();
  const row = fold && b.stored().ledger.followups.rows.find(r => r.s === CELL.skill);
  b.at(30); coach = b.open(); const back = play(coach, item('c-back', CELL)), during = rowsOf(coach.followups(), back.answer.eventId).length;
  backPlays(b, coach); coach.flush(); coach.dispose();
  b.at(93.5); const after = rowsOf(b.open().followups(), back.answer.eventId).length;
  return { during, after, chain: row ? [row.at, row.ps ?? null, row.pc ?? null] : null };
}
// 늦은 시작의 사이클이 그 접힘 앞에서 끝나면 다음 시작을 판단 보류로 — 시작점만 남은 행도 lf를 지닌다.
function nextAfterLate(E, fold) {
  const b = bench(E, { fold }); let coach = b.open();
  b.at(10); play(coach, item('c-10', CELL)); fill(b, coach, 'a', 45);
  b.at(50); play(coach, item('c-50', CELL)); fill(b, coach, 'b', 45); coach.flush(); coach.dispose();
  b.at(1); coach = b.open(); play(coach, item('c-1', CELL)); backPlays(b, coach); coach.flush(); coach.dispose();
  b.at(51); coach = b.open(); fill(b, coach, 'c', 45); coach.flush(); coach.dispose();
  const start = fold && b.stored().ledger.followups.rows.find(r => r.at === START + DAY);
  b.at(60); coach = b.open(); const next = play(coach, item('c-60', CELL));
  return { rows: rowsOf(coach.followups(), next.answer.eventId).map(r => r.reason), start: start ? [Number.isFinite(start.lf), 'p' in start] : null };
}
// 되돌린 동안 접힌 같은 계열 기록 — 시계 너머의 행(retention) · 짝에 표시해 둔다.
function aheadRow(E, fold, shared) {
  const b = bench(E, { fold }); let coach = b.open();
  b.at(10); const row = play(coach, item('r', { ...CELL, family: 'F' })); fill(b, coach, 'a', 45); coach.flush(); coach.dispose();
  b.at(5); coach = b.open(); const back = play(coach, item('f-back', { skill: 'ko.reading.reason', family: shared ? 'F' : 'G' })); backPlays(b, coach); coach.flush(); coach.dispose();
  const folded = !b.stored().events.some(e => e.id === back.answer.eventId);
  b.at(10.5); return { folded, rows: rowsOf(b.open().followups(), row.answer.eventId).map(r => [r.status, r.reason, r.kind]) };
}
function aheadPair(E, fold, shared) {
  const b = bench(E, { fold }); let coach = b.open();
  b.at(10); const row = play(coach, item('r', CELL)); b.at(11.5); const pair = play(coach, item('p', { ...CELL, family: 'P' })); fill(b, coach, 'a', 45); coach.flush(); coach.dispose();
  b.at(5); coach = b.open(); const back = play(coach, item('p-back', { skill: 'ko.reading.reason', family: shared ? 'P' : 'Q' })); backPlays(b, coach); coach.flush(); coach.dispose();
  const folded = !b.stored().events.some(e => e.id === back.pid);
  b.at(12); const d1 = windowOf(b.open().followups(), row.answer.eventId, 'd1');
  return { folded, d1: [d1.status, d1.reason, d1.targetAttemptId === pair.answer.eventId] };
}
// 정상 흐름: 한 기기가 접으며 풀어도 판단 보류가 붙지 않는다.
function plain(E) {
  const { a, coachA, settle } = twoDevices(E);
  a.at(0); const first = play(coachA, item('p-first', CELL)); a.at(1.5); const pair = play(coachA, item('p-pair', CELL));
  for (const day of [3, 5, 8]) { a.at(day); fill(a, coachA, `d${day}`, 20); settle(coachA); }
  const report = coachA.followups(), rows = rowsOf(report, first.answer.eventId);
  return { folded: report.coverage.folded > 0, held: copy(report.items).filter(r => r.reason === 'adjusted-history').length, d1: [rows[0]?.kind, rows[0]?.status, rows[0]?.targetAttemptId === pair.answer.eventId] };
}
// 판 섞임 — 정상 기록: 한 판이 쓴 표를 다른 판이 읽고 그 위에 접고, 처음 판이 다시 읽는다(0~9일이라 pc · lf는 생기지 않는다 — 아래 둘이 본다).
function mixed(W, R) {
  const b = bench(W), coach = b.open();
  b.at(0); const first = play(coach, item('m-first', CELL)); b.at(1.5); const pair = play(coach, item('m-pair', CELL));
  for (const day of [3, 5, 8]) { b.at(day); fill(b, coach, `d${day}`, 20); }
  coach.flush(); coach.dispose();
  const reader = b.open('world-practice', R), rows = rowsOf(reader.followups(), first.answer.eventId);
  b.at(9); fill(b, reader, 'r', 40); reader.flush(); reader.dispose();
  const back = rowsOf(b.open('world-practice', W).followups(), first.answer.eventId);
  return { read: [rows[0]?.status, rows[0]?.targetAttemptId === pair.answer.eventId], back: [back[0]?.status, back[0]?.targetAttemptId === pair.answer.eventId] };
}
// 판 섞임 — 여러 사이클(pc): W가 0 · 46 · 92일 사슬을 쓰고(접힘), R이 열어 읽고 더 접은 뒤, P가 30일로 되돌려 그 칸에 답한다.
function mixedCycles(W, R, P = W) {
  const b = bench(W); let coach = b.open();
  for (const day of [0, 46, 92]) { b.at(day); play(coach, item(`c-${day}`, CELL)); fill(b, coach, `f-${day}`, 45); }
  coach.flush(); coach.dispose();
  b.at(93); coach = b.open('world-practice', R); coach.followups(); fill(b, coach, 'r', 45); coach.flush(); coach.dispose();
  const row = b.stored().ledger.followups.rows.find(r => r.s === CELL.skill);
  b.at(30); coach = b.open('world-practice', P); const back = play(coach, item('c-back', CELL)), during = rowsOf(coach.followups(), back.answer.eventId).length;
  backPlays(b, coach); coach.flush(); coach.dispose();
  b.at(93.5); const after = rowsOf(b.open('world-practice', P).followups(), back.answer.eventId).length;
  return { during, after, pc: row.pc ?? null };
}
// 판 섞임 — 시작점 행의 lf: W가 늦은 시작(1일)의 시작점 행을 lf로 얼린 뒤 R이 열어 더 접고, W가 60일 다음 시작을 읽는다.
function mixedLate(W, R) {
  const b = bench(W); let coach = b.open();
  b.at(10); play(coach, item('c-10', CELL)); fill(b, coach, 'a', 45);
  b.at(50); play(coach, item('c-50', CELL)); fill(b, coach, 'b', 45); coach.flush(); coach.dispose();
  b.at(1); coach = b.open(); play(coach, item('c-1', CELL)); backPlays(b, coach); coach.flush(); coach.dispose();
  b.at(51); coach = b.open(); fill(b, coach, 'c', 45); coach.flush(); coach.dispose();
  const lf = () => Number.isFinite(b.stored().ledger.followups.rows.find(r => r.at === START + DAY)?.lf), written = lf();
  b.at(52); coach = b.open('world-practice', R); coach.followups(); fill(b, coach, 'r', 45); coach.flush(); coach.dispose();
  const kept = lf();
  b.at(60); coach = b.open('world-practice', W); const next = play(coach, item('c-60', CELL));
  return { written, kept, rows: rowsOf(coach.followups(), next.answer.eventId).map(r => r.reason) };
}
// C4: 같은 대본을 접는 장부와 접지 않는 장부에(시험 파일의 makeScript · replay와 같은 꼴).
function makeScript(seed, days) {
  let s = seed >>> 0; const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const skills = ['ko.reading.detail', 'ko.reading.main', 'ko.listening.detail'], games = ['world-practice', 'korean-rhythm', 'order-rush', 'blank-slice'], actions = [];
  let n = 0;
  for (let day = 0; day < days; day++) {
    let t = START + day * DAY + 9 * 3600000;
    if (rand() < 0.08 || (day > 30 && day < 36)) continue;
    for (let session = 1 + Math.floor(rand() * 2); session > 0; session--) {
      const game = games[Math.floor(rand() * games.length)];
      actions.push({ t, kind: 'open', game });
      for (let i = 3 + Math.floor(rand() * 6); i > 0; i--) {
        t += 20000; n += 1;
        const repeat = game !== 'world-practice' && rand() < 0.6, family = repeat ? `${game}.r${Math.floor(rand() * 4)}` : `${game}.f${n}`;
        actions.push({ t, kind: 'play', it: item(family, { family, skill: skills[Math.floor(rand() * skills.length)], difficulty: 1 + Math.floor(rand() * 2) }),
          help: rand() < 0.12, correct: rand() < 0.7, after: rand() < 0.2 ? (rand() < 0.5 ? 'explanation' : 'answer') : null, unanswered: rand() < 0.03, excludeNow: rand() < 0.02 });
      }
      t += 15 * MIN + Math.floor(rand() * 40 * MIN);
    }
    actions.push({ t: t + MIN, kind: 'read', day });
  }
  return actions;
}
function replay(E, actions, mode) {
  const b = bench(E, { fold: mode === 'whole' ? false : { max: 60, keep: 30, ageMs: 10 * MIN } });
  let coach = null; const reads = [];
  const close = () => { if (!coach) return; coach.flush(); coach.dispose(); coach = null; };
  const line = r => [r.gameId, r.measure.skillId, r.measure.difficulty, r.window, r.status, r.outcome, r.reason, r.kind, r.sourceAt, r.targetAt, r.correctionEventIds.length].join('|');
  for (const a of actions) {
    b.step(a.t - b.now);
    if (a.kind === 'open') { close(); coach = b.open(a.game); }
    else if (a.kind === 'play') {
      const pid = coach.present(a.it);
      if (a.it.audioRequired) coach.delivery(pid, { audio: 'completed' });
      if (a.help) coach.help(pid, 'hint');
      b.step(5000);
      const res = coach.answer(pid, a.unanswered ? { correct: null, assessable: false, reason: 'unanswered' } : { correct: a.correct, assessable: true });
      b.step(1000);
      if (a.after) coach.help(pid, a.after);
      if (a.excludeNow) coach.exclude(res.eventId);
    } else { close(); coach = b.open(); reads.push({ day: a.day, rows: copy(coach.followups().items).map(line).sort() }); close(); }
  }
  close();
  return { reads, folded: b.stored().ledger?.folded || 0 };
}

let checks = 0; const ok = (value, expected, label) => { assert.deepEqual(value, expected, label); checks += 1; };
const cycleRows = [['d1', 'missed', null], ['d7', 'not_due', null], ['d30', 'not_due', null]], held3 = Array(3).fill('adjusted-history');
const c4Script = makeScript(3 * 7919, 100);
try {
  for (const { name, same } of manifest) {
    const fresh = await load(`new__${name}`), live = await load(`live__${name}`), freshBroken = await load(`new__${name}`, { broken: true }), liveBroken = await load(`live__${name}`, { broken: true });
    const N = fresh.game, L = live.game, label = `${name}(${same.length})`;
    // 새 판
    const held = heldAnswer(N);
    ok(held.whole, Array(4).fill(cycleRows), `${label} 새 판: 통째 장부의 네 사이클`); ok(held.folded, held.whole, `${label} 새 판: 돌려주지 않는 답이 남아도 접는 장부 = 통째 장부`);
    ok(brokenFold(N, freshBroken.game), { sight: true, folded: true, floor: true, kept: true }, `${label} 새 판: 읽기가 예외를 낸 접기도 fs를 지님`);
    ok(lateAnchor(N, 'shared'), Array(3).fill(['unavailable', 'adjusted-history', 'recovery']), `${label} 새 판: 로그 차례로만 다시 본 늦은 앵커는 판단 보류`);
    ok(lateAnchor(N, 'other'), Array(3).fill(['not_due', null, 'retention']), `${label} 새 판: 다른 계열이면 그대로`);
    ok(lateAnchor(N, 'already'), Array(3).fill(['not_due', null, 'recovery']), `${label} 새 판: 시각으로도 다시 본 문항이면 표시 없음`);
    ok(lateAnchor(N, 'wrong'), Array(3).fill(['not_due', null, 'recovery']), `${label} 새 판: 틀린 답은 표시 없음`);
    ok(latePair(N, true), ['unavailable', 'adjusted-history', null], `${label} 새 판: 로그 차례로만 도움 받은 늦은 짝은 판단 보류`);
    ok(latePair(N, false), ['observed', null, 'independent-correct'], `${label} 새 판: 다른 계열 도움이면 그대로`);
    ok(lateFirst(N, true), ['unavailable', 'adjusted-history', false], `${label} 새 판: 늦은 첫 답 — 뒤 답이 대신하지 않음`);
    ok(lateFirst(N, false), ['unavailable', 'adjusted-history', true], `${label} 새 판: 늦은 첫 답 — 짝 없는 창은 그 답을 표시한 짝으로 얼려 판단 보류`);
    const over = overtakeCycle(N);
    ok(over, { stored: [1, START + 20 * DAY], during: 0, after: 0, row: held3 }, `${label} 새 판: 추월한 늦은 답의 사이클이 남아 되돌린 답은 앵커가 아님`);
    ok(earlierCycles(N, FOLD), { during: 0, after: 0, chain: [START + 92 * DAY, START + 46 * DAY, [START]] }, `${label} 새 판: 시계 너머 행의 pc 사이클 안 답은 앵커가 아님`);
    ok(earlierCycles(N, false), { during: 0, after: 0, chain: null }, `${label} 새 판: 통째 장부도 같음`);
    ok(nextAfterLate(N, FOLD), { rows: held3, start: [true, false] }, `${label} 새 판: 늦은 시작 뒤 다음 시작은 판단 보류(시작점 행이 lf를 지님)`);
    ok(nextAfterLate(N, false).rows, [], `${label} 새 판: 통째 장부에는 그 앵커가 없음`);
    ok(aheadRow(N, FOLD, true), { folded: true, rows: Array(3).fill(['unavailable', 'adjusted-history', 'retention']) }, `${label} 새 판: 되돌린 동안 접힌 시도가 시계 너머 행을 표시`);
    ok(aheadRow(N, FOLD, false).rows, Array(3).fill(['not_due', null, 'retention']), `${label} 새 판: 다른 계열은 그대로`);
    ok(aheadPair(N, FOLD, true), { folded: true, d1: ['unavailable', 'adjusted-history', true] }, `${label} 새 판: 되돌린 동안 접힌 제시가 시계 너머 짝을 표시`);
    ok(aheadPair(N, FOLD, false).d1, ['observed', null, true], `${label} 새 판: 다른 계열은 그대로`);
    ok(plain(N), { folded: true, held: 0, d1: ['retention', 'observed', true] }, `${label} 새 판: 정상 흐름에 판단 보류 없음`);
    const whole = replay(N, c4Script, 'whole'), folding = replay(N, c4Script, 'device');
    assert.ok(folding.folded > 500, `${label} C4 대본이 접힘: ${folding.folded}`);
    ok(folding.reads, whole.reads, `${label} 새 판: C4 — 접는 장부 = 통째 장부(100일, 읽기 ${whole.reads.length}회)`);
    ok(mixed(L, N), { read: ['observed', true], back: ['observed', true] }, `${label} 판 섞임(정상 기록): 공개본이 쓴 표를 새 판이 잇고 공개본이 다시 읽음`);
    ok(mixed(N, L), { read: ['observed', true], back: ['observed', true] }, `${label} 판 섞임(정상 기록): 새 판이 쓴 표를 공개본이 잇고 새 판이 다시 읽음`);
    ok(mixedCycles(N, L), { during: 0, after: 0, pc: [START] }, `${label} 판 섞임: 새 판이 쓴 pc를 공개본이 접어도 지녀, 새 판이 앞 사이클 안 답을 앵커로 세우지 않음`);
    ok(mixedCycles(L, N, N), { during: 3, after: 0, pc: null }, `${label} 판 섞임: 공개본이 쓴 표(pc 없음)를 새 판이 이으면 공개본과 같음`);
    const lateLive = nextAfterLate(L, FOLD).rows;
    ok(mixedLate(N, L), { written: true, kept: false, rows: lateLive }, `${label} 판 섞임: 공개본이 접으면 시작점 행의 lf를 버려 그 칸은 공개본과 같아짐(더 나빠지지 않음)`);
    // 공개본(결함 재현)
    ok(heldAnswer(L).folded.flat().some(r => r[1] === 'unavailable'), true, `${label} 공개본: 돌려주지 않는 답이 늦은 기록으로 읽힘`);
    ok(brokenFold(L, liveBroken.game).kept, false, `${label} 공개본: 읽기가 예외를 낸 접기가 fs를 버림`);
    ok(lateAnchor(L, 'shared'), Array(3).fill(['not_due', null, 'recovery']), `${label} 공개본: 로그 차례로만 다시 본 늦은 앵커에 표시 없음`);
    ok(latePair(L, true), ['observed', null, 'assisted-correct'], `${label} 공개본: 로그 차례로만 도움 받은 늦은 짝이 관측으로 남음`);
    ok(lateFirst(L, true)[0], 'observed', `${label} 공개본: 늦은 첫 답 대신 뒤 답이 짝`);
    ok(overtakeCycle(L).during, 3, `${label} 공개본: 추월한 늦은 답이 접힌 뒤 되돌린 답이 새 사이클`);
    ok(earlierCycles(L, FOLD).during, 3, `${label} 공개본: pc가 없어 앞 사이클 안 답이 새 사이클`);
    ok(nextAfterLate(L, FOLD).rows.includes('adjusted-history'), false, `${label} 공개본: 늦은 시작 뒤 다음 시작에 표시 없음`);
    ok(aheadRow(L, FOLD, true).rows, Array(3).fill(['not_due', null, 'retention']), `${label} 공개본: 되돌린 동안 접힌 시도를 못 봄`);
    ok(aheadPair(L, FOLD, true).d1, ['observed', null, true], `${label} 공개본: 되돌린 동안 접힌 제시를 못 봄`);
    console.log(`ok ${label}`);
  }
} finally { for (const probe of probes) fs.rmSync(probe, { force: true }); }
console.log(`재확인 후속 공개 후보 통과 — 묶음 ${manifest.length}종 · 검사 ${checks}개`);
