// 재확인 내구성 공개 후보(재확인_공개묶음.cjs)를 묶음 종류마다 실제로 불러 돌린다. 앵커 대조 · node --check만으로는 끼운 줄이 안 돈다(현장 노트 배포 · 공개).
// 묶음 안의 Core(엔진 그대로)로 재고, 공급은 그 화면이 쓰는 소비자로 잰다(혼자 여는 홈은 묶음 안 사본, 나머지는 따로 공개되는 모듈).
//   새 판: 25 · 40칸에도 공급 · 옵션 없는 게임이 접어도 줄 · 되풀이가 쌓여도 줄 · 접은 판 = 접지 않은 판 · 옛 판과 왕복.
//   공개본: 같은 일에서 끊긴다(결함 재현 — 시험이 결함을 볼 수 있다는 대조).
//   node docs/_ops/qa/atlas-world-engine-20261108/재확인_공개검사.mjs <check 폴더>
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
const { worldMapData } = require(path.join(ROOT, 'strata/world-map.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, '목록.json'), 'utf8'));
const consumer = await (async () => ({ new: await import(pathToFileURL(path.join(dir, 'new__world-learning-followups.mjs')).href), live: await import(pathToFileURL(path.join(dir, 'live__world-learning-followups.mjs')).href) }))();
const data = worldMapData(), map = createMap(data), DAY = 86400000, MIN = 60000, START = Date.parse('2026-12-01T00:00:00Z');
const probes = [];
// 묶음 안 이름을 시험 사본에서만 꺼낸다(공개 파일은 그대로). __commonJS 모듈 이름은 묶음마다 꼬리가 다를 수 있어 파서로 찾는다.
function names(text, sourceType) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowReturnOutsideFunction: true }); let core = null;
  (function walk(n) {
    if (!n || typeof n !== 'object' || core) return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'VariableDeclaration' && n.declarations.some(d => d.init?.type === 'CallExpression' && /__commonJS/.test(d.init.callee?.name || '') && d.init.arguments[0]?.properties?.[0]?.key?.value === 'atlas/game-learning.js')) {
      core = { name: n.declarations.find(d => d.init?.arguments?.[0]?.properties?.[0]?.key?.value === 'atlas/game-learning.js').id.name, end: n.end }; return;
    }
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') walk(v); }
  })(ast);
  if (!core) throw Error('Core 모듈을 못 찾았다');
  return { core, ast };
}
async function load(file) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  if (file.endsWith('.mjs')) {
    const { core, ast } = names(text, 'module'), life = text.includes('function followupRows(');
    // 화면 모듈 import는 빈 함수로(엔진은 안 쓴다). 같은 폴더의 ./ import는 둔다.
    let out = text;
    for (const node of ast.body.filter(n => n.type === 'ImportDeclaration' && !n.source.value.startsWith('./')).reverse()) {
      const local = node.specifiers.map(s => s.local.name);
      out = out.slice(0, node.start) + (local.length ? `var ${local.map(n => `${n}=__stub`).join(',')};` : '') + out.slice(node.end);
    }
    const probe = path.join(dir, `__probe-${file}`);
    fs.writeFileSync(probe, `function __stub(){return ''}\n${out}\nexport{${core.name} as __core${life ? ',followupRows as __rows' : ''}};\n`); probes.push(probe);
    const lent = !('document' in globalThis);
    if (lent) globalThis.document = { querySelector: () => ({}), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
    let mod; try { mod = await import(pathToFileURL(probe).href); } finally { if (lent) delete globalThis.document; }
    return { file, game: mod.__core(), rows: mod.__rows || null };
  }
  const { core } = names(text, 'script');
  const sandbox = { console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, structuredClone, crypto: globalThis.crypto };
  vm.createContext(sandbox);
  vm.runInContext(`${text.slice(0, core.end)}\n;globalThis.__core=${core.name};\n${text.slice(core.end)}`, sandbox, { filename: file });
  return { file, game: sandbox.__core(), rows: null };
}
const item = (name, { family = name, skill = 'ko.reading.detail', difficulty = 1, format = 'single-choice' } = {}) => ({ id: name, itemKey: `${name}.v1`, familyKey: family, skillId: skill, modality: skill.includes('listening') ? 'listening' : 'reading', difficulty, responseFormat: format, audioRequired: skill.includes('listening'), confounded: false });
function bench() {
  let now = START; const mem = new Map();
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  const clock = () => new Date(now).toISOString();
  return { mem, at: days => { now = START + days * DAY; }, step: ms => { now += ms; }, get now() { return now; },
    open: (side, gameId = 'world-practice', extra = {}) => side.game.createGame({ gameId, map, storage, clock, followups: true, ...extra }),
    stored: () => JSON.parse([...mem.entries()].find(([k]) => k.endsWith('.device'))[1]) };
}
const copy = v => JSON.parse(JSON.stringify(v));
const play = (b, coach, it, { correct = true } = {}) => { b.step(1000); const pid = coach.present(it); if (it.audioRequired) coach.delivery(pid, { audio: 'completed' }); const answer = coach.answer(pid, { correct, assessable: true }); return copy(answer); };
const fill = (b, coach, tag, count) => { for (let n = 0; n < count; n++) play(b, coach, item(`${tag}-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); };
const report = coach => copy(coach.followups());
const rowsFor = (r, id) => r.items.filter(x => x.sourceAttemptId === id);
const skills = data.nodes.filter(n => n.kind === 'skill' && !n.id.startsWith('ko2.')).map(n => n.id);
const cells = count => Array.from({ length: count }, (_, i) => item(`c${i}`, { skill: skills[i % skills.length], difficulty: 1 + Math.floor(i / skills.length) % 3, format: ['single-choice', 'binary-choice'][Math.floor(i / (skills.length * 3))] }));
const supply = (side, kind, count) => {
  const b = bench(), coach = b.open(side), its = cells(count);
  for (const it of its) play(b, coach, it);
  b.at(2);
  const projection = report(coach), pool = its.map(it => ({ ...it, id: `n-${it.id}`, itemKey: `n-${it.itemKey}`, familyKey: `n-${it.familyKey}` }));
  const rows = (side.rows || consumer[kind].followupRows)({ projection, pool, seen: () => false, taskVersion: map.map_ver });
  return { limited: rows.limited, offered: rows.rows.filter(r => r.available).length };
};
// 옵션 없는 게임이 기기 장부를 600건 넘겨 접는다(LAB · 손님 길).
const noOption = side => {
  const b = bench(), mine = b.open(side), first = play(b, mine, item('source'));
  b.at(1); const pair = play(b, mine, item('pair')); mine.flush(); mine.dispose();
  b.at(2); const other = b.open(side, 'other-game', { followups: false });
  for (let n = 0; n < 150; n++) play(b, other, item(`o-${n}`, { skill: 'ko.reading.reason' }));
  b.step(11 * MIN); for (let n = 150; n < 200; n++) play(b, other, item(`o-${n}`, { skill: 'ko.reading.reason' }));
  other.flush(); other.dispose();
  const again = b.open(side), r = report(again), rows = rowsFor(r, first.eventId), kept = b.stored();
  assert.ok((kept.ledger?.folded || 0) > 0, `${side.file} 접힘`);
  return { complete: r.evidenceComplete, rows: rows.length, d1: rows.find(x => x.window === 'd1')?.targetAttemptId === pair.eventId };
};
// 되풀이: 곡 게임처럼 같은 문항이 계속 돌아와도 앵커 · 짝이 남고 날것을 붙잡지 않는다.
const repeated = side => {
  const b = bench(), coach = b.open(side), song = item('song', { skill: 'ko.listening.detail' }), first = play(b, coach, song);
  b.at(1); const pair = play(b, coach, item('new-1', { skill: 'ko.listening.detail' }));
  for (let day = 2; day < 12; day++) { b.at(day); for (let n = 0; n < 30; n++) play(b, coach, song); b.step(11 * MIN); coach.flush(); }
  const r = report(coach), d1 = rowsFor(r, first.eventId).find(x => x.window === 'd1');
  return { status: d1?.status, pair: d1?.targetAttemptId === pair.eventId, kind: d1?.kind, events: b.stored().events.length };
};
// 접은 판 = 접지 않은 판.
function c4(side) {
  let s = 12345 >>> 0; const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296, script = [], games = ['world-practice', 'korean-rhythm', 'blank-slice'], sk = ['ko.reading.detail', 'ko.reading.main', 'ko.listening.detail'];
  let n = 0;
  for (let day = 0; day < 75; day++) { if (rand() < 0.1) continue; const game = games[Math.floor(rand() * games.length)], its = []; for (let i = 4 + Math.floor(rand() * 8); i > 0; i--) { n += 1; const repeat = game !== 'world-practice' && rand() < 0.6, fam = repeat ? `${game}.r${Math.floor(rand() * 4)}` : `${game}.f${n}`; its.push({ it: item(fam, { family: fam, skill: sk[Math.floor(rand() * 3)], difficulty: 1 + Math.floor(rand() * 2) }), correct: rand() < 0.7, help: rand() < 0.1 }); } script.push({ day, game, its }); }
  const run = fold => {
    const b = bench(), out = [];
    for (const { day, game, its } of script) {
      b.at(day + 0.4);
      const coach = b.open(side, game, { fold });
      for (const { it, correct, help } of its) { b.step(30000); const pid = coach.present(it); if (it.audioRequired) coach.delivery(pid, { audio: 'completed' }); if (help) coach.help(pid, 'hint'); coach.answer(pid, { correct, assessable: true }); }
      coach.flush(); coach.dispose(); b.step(15 * MIN);
      const read = b.open(side, 'world-practice', { fold });
      out.push([day, report(read).items.map(r => [r.gameId, r.measure.skillId, r.measure.difficulty, r.window, r.status, r.outcome, r.sourceAt, r.targetAt].join('|')).sort()]);
      read.flush(); read.dispose();
    }
    return { out, folded: b.stored().ledger?.folded || 0 };
  };
  const whole = run(false), folded = run({ max: 60, keep: 30, ageMs: 10 * MIN });
  assert.ok(folded.folded > 100, `${side.file} 접힘 ${folded.folded}`);
  for (let i = 0; i < whole.out.length; i++) assert.deepEqual(folded.out[i], whole.out[i], `${side.file} ${whole.out[i][0]}일`);
  return { 줄: whole.out.reduce((a, [, rows]) => a + rows.length, 0), 접힘: folded.folded };
}
// 옛 판과 왕복: 같은 장부를 번갈아 쓴다.
function mix(side, old) {
  const b = bench(); let coach = b.open(old);
  const first = play(b, coach, item('source')); coach.flush(); coach.dispose();
  // 옛 판이 적은 기록을 새 판이 읽는다.
  b.at(1); coach = b.open(side); const pair = play(b, coach, item('pair'));
  let r = report(coach), rows = rowsFor(r, first.eventId);
  assert.equal(rows.length, 3, `${side.file}: 옛 판 기록을 새 판이 읽음`); assert.equal(rows.find(x => x.window === 'd1').targetAttemptId, pair.eventId);
  // 새 판이 접고 표를 쓴다.
  b.at(2); for (let n = 0; n < 150; n++) play(b, coach, item(`m-${n}`, { skill: 'ko.reading.reason' })); b.step(11 * MIN); for (let n = 150; n < 200; n++) play(b, coach, item(`m-${n}`, { skill: 'ko.reading.reason' })); coach.flush(); coach.dispose();
  const led = b.stored().ledger; assert.ok(led.folded > 0, '새 판 접힘'); assert.equal(led.followups?.v, 1); assert.equal(led.followupsPreserved, false);
  // 옛 판이 새 장부를 읽는다: 저장을 거절하지 않고, 줄은 내지 않고, 학습은 이어진다.
  b.at(3); coach = b.open(old); r = report(coach); assert.deepEqual(r.items, [], `${side.file}: 옛 판은 줄을 내지 않는다`); assert.equal(r.evidenceComplete, false);
  assert.equal(copy(coach.summary()).storage.available, true, '옛 판이 새 장부를 읽어도 저장 가능');
  play(b, coach, item('old-after'));
  // 옛 판이 새 장부를 접는다(옵션 없는 게임): 표는 옮겨지고 folded가 어긋난다.
  coach.flush(); coach.dispose(); coach = b.open(old, 'old-game', { followups: false });
  for (let n = 0; n < 200; n++) play(b, coach, item(`l-${n}`, { skill: 'ko.reading.condition' })); b.step(11 * MIN); for (let n = 200; n < 300; n++) play(b, coach, item(`l-${n}`, { skill: 'ko.reading.condition' })); coach.flush(); coach.dispose();
  const after = b.stored().ledger; assert.notEqual(after.followups?.folded, after.folded, `${side.file}: 옛 판 접기로 어긋남`);
  // 새 판이 알아채 바닥을 두고, 얼린 행은 그대로이며, 다음 답이 앵커가 된다.
  b.at(4); coach = b.open(side); r = report(coach);
  assert.equal(Date.parse(r.coverage.floor), after.cutoff, '바닥 = 옛 판이 접은 자리'); assert.equal(r.evidenceComplete, true);
  assert.equal(rowsFor(r, first.eventId).find(x => x.window === 'd1').targetAttemptId, pair.eventId, '얼린 짝은 그대로');
  const next = play(b, coach, item('next', { skill: 'ko.reading.vocabulary' }));
  assert.equal(rowsFor(report(coach), next.eventId).length, 3, '바닥 뒤 답은 앵커');
  coach.flush(); coach.dispose();
}
// 서버에만 남는 늦은 도움(그 제시가 여기서 접혀 건너뜀)이 그 제시의 얼린 짝을 표시한다 — 계정 장부 둘(셋째 사슬 GPT GA2: 생활 묶음 Core에 안 실렸다).
const strayHelp = (side, { tab = false } = {}) => {
  const account = { learnerKey: 'device', storageScope: 'account', accountKey: 'acct', historyComplete: false }, folding = { remote: true, max: 40, keep: 20, ageMs: 1 };
  const a = bench(), b = bench(), cell = { skill: 'ko.reading.detail' };
  const open = (gameId = 'world-practice') => { const coach = a.open(side, gameId, { ...account, fold: folding }); coach.syncPort.markComplete(true); return coach; };
  const A = open(), B = b.open(side, 'world-practice', { ...account, fold: false }); B.syncPort.markComplete(true);
  const settle = () => A.syncPort.settle(A.events().map(e => e.id));
  a.at(0); const mine = copy(A.answer(A.present(item('a-first', cell)), { correct: true, assessable: true }));
  b.at(1.5); const pid = B.present(item('b-pair', cell)); b.at(1.53); B.help(pid, 'hint'); b.at(1.55); B.answer(pid, { correct: true, assessable: true });
  const help = B.events().find(e => e.type === 'practice.helped');
  a.at(2); A.syncPort.importEvents(B.events().filter(e => e.id !== help.id));
  a.at(3); fill(a, A, 'x', 20); settle(); a.at(5); fill(a, A, 'y', 20); settle();
  assert.equal(A.events().some(e => e.id === pid), false, '짝 제시가 접힘');
  // 그 표시를 단 탭이 닫힌 뒤, 옛 장부를 든 다른 게임 코치가 같은 접힘으로 합쳐 저장해도 표시가 남는다(셋째 사슬 아르곤 A2).
  const other = tab ? open('other-game') : null;
  const skipped = A.syncPort.importEvents([help]).skipped.length;
  if (!other) { const d1 = rowsFor(report(A), mine.eventId).find(x => x.window === 'd1'); return { skipped, status: d1.status, reason: d1.reason }; }
  A.flush(); A.dispose(); a.step(1000);
  const g = other.present(item('g-1', { skill: 'ko.reading.reason' })); other.answer(g, { correct: true, assessable: true }); other.flush(); other.dispose();
  a.at(18); const d1 = rowsFor(report(open()), mine.eventId).find(x => x.window === 'd1');
  return { skipped, status: d1.status, reason: d1.reason };
};
const checks = [];
const check = (name, fn) => {
  let result; try { result = fn(); } catch (error) { console.error(`실패 · ${name}`); throw error; }
  checks.push(result === undefined ? name : `${name} ${JSON.stringify(result)}`);
};
try {
  for (const { pub, name, same } of manifest) {
    const fresh = await load(`new__${name}`), old = await load(`live__${name}`), tag = `${pub}(같은 바이트 ${same.length})`, policy = text => /temper-followup-(\d)/.exec(text)?.[0];
    const oldPolicy = policy(fs.readFileSync(path.join(dir, `live__${name}`), 'utf8'));
    check(`${tag}: 판`, () => { const c = bench().open(fresh); assert.equal(report(c).policy, 'temper-followup-3'); const o = bench().open(old); assert.equal(report(o).policy, oldPolicy); return oldPolicy; });
    for (const n of [25, 40]) check(`${tag}: ${n}칸에도 공급`, () => { const r = supply(fresh, 'new', n); assert.deepEqual(r, { limited: false, offered: 12 }); });
    check(`${tag}: 공개본은 25칸에서 공급이 멈춘다 — 결함 재현`, () => { const r = supply(old, 'live', 25); assert.deepEqual(r, { limited: true, offered: 0 }); });
    check(`${tag}: 옵션 없는 게임이 접어도 줄이 남는다`, () => { const r = noOption(fresh); assert.deepEqual(r, { complete: true, rows: 3, d1: true }); });
    check(`${tag}: 공개본은 줄이 사라진다 — 결함 재현`, () => { const r = noOption(old); assert.deepEqual(r, { complete: false, rows: 0, d1: false }); });
    check(`${tag}: 되풀이가 쌓여도 줄 · 짝이 남고 로그가 작다`, () => { const r = repeated(fresh); assert.equal(r.status, 'observed'); assert.equal(r.pair, true); assert.ok(r.events <= 800, `로그 ${r.events}`); return r.events; });
    check(`${tag}: 접은 판 = 접지 않은 판`, () => c4(fresh));
    check(`${tag}: 서버에만 남은 늦은 도움이 얼린 짝을 표시`, () => { const r = strayHelp(fresh); assert.deepEqual(r, { skipped: 1, status: 'unavailable', reason: 'adjusted-history' }); });
    check(`${tag}: 그 표시는 다른 탭이 같은 접힘으로 저장해도 남는다`, () => { const r = strayHelp(fresh, { tab: true }); assert.deepEqual(r, { skipped: 1, status: 'unavailable', reason: 'adjusted-history' }); });
    check(`${tag}: 옛 판과 왕복(옛 기록 읽기 · 옛 판이 새 장부 읽기 · 옛 판이 접기 → 바닥)`, () => mix(fresh, old));
  }
  console.log(checks.map(c => `ok · ${c}`).join('\n'));
  console.log(`재확인 공개 검사 ${checks.length}개 통과 · 묶음 종류 ${manifest.length}개`);
} finally { for (const probe of probes) fs.rmSync(probe, { force: true }); }
