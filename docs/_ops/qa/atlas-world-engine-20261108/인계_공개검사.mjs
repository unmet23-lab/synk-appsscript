// 동기화 인계 · 재확인의 늦은 도움 공개 후보(인계_공개묶음.cjs)를 묶음 종류마다 실제로 불러 돌린다. 앵커 대조 · node --check만으로는 끼운 줄이 안 돈다(현장 노트 배포 · 공개).
//   새 판: 낡은 outbox 사본이 막히지 않고 이어 간다(잠금 없는 두 사본 · 스크립트 묶음은 실제 Web Locks 두 탭) · 늦게 온 승인을 적지 않는다 ·
//          서버에만 남은 기준 답의 도움이 그 행을 판단 보류로 돌린다 · 정상 흐름은 그대로 · 공개본이 쓴 저장소를 새 판이 잇고 그 반대도 된다.
//   공개본: 같은 일에서 막히거나 retention 그대로다(결함 재현 — 검사가 결함을 볼 수 있다는 대조).
//   node docs/_ops/qa/atlas-world-engine-20261108/인계_공개검사.mjs <check 폴더>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { locks } from 'node:worker_threads';
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
const map = createMap(worldMapData()), DAY = 86400000, START = Date.parse('2026-12-01T00:00:00Z'), probes = [];
const copy = value => JSON.parse(JSON.stringify(value)), tick = () => new Promise(resolve => setImmediate(resolve));
// 묶음 안 Core 모듈(엔진 그대로)을 시험 사본에서만 꺼낸다. __commonJS 이름은 묶음마다 꼬리가 달라 파서로 찾는다.
function coreOf(text, sourceType) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowReturnOutsideFunction: true }); let core = null;
  (function walk(n) {
    if (!n || typeof n !== 'object' || core) return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    const hit = n.type === 'VariableDeclaration' && n.declarations.find(d => d.init?.type === 'CallExpression' && /__commonJS/.test(d.init.callee?.name || '') && d.init.arguments[0]?.properties?.[0]?.key?.value === 'atlas/game-learning.js');
    if (hit) { core = { name: hit.id.name, end: n.end }; return; }
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') walk(v); }
  })(ast);
  if (!core) throw Error('Core 모듈을 못 찾았다');
  return { core, ast };
}
const script = (text, file, sandbox) => { const { core } = coreOf(text, 'script'); vm.createContext(sandbox); vm.runInContext(`${text.slice(0, core.end)}\n;globalThis.__core=${core.name};\n${text.slice(core.end)}`, sandbox, { filename: file }); return sandbox.__core(); };
async function load(file) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  if (!file.endsWith('.mjs')) return { file, text, game: script(text, file, { console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, structuredClone, AbortController, crypto: globalThis.crypto }) };
  // 화면 모듈 import는 빈 함수로(엔진은 안 쓴다). 같은 폴더의 ./ import는 둔다. 머리의 document는 불러오는 동안만 빌려 준다.
  const { core, ast } = coreOf(text, 'module'); let out = text;
  for (const node of ast.body.filter(n => n.type === 'ImportDeclaration' && !n.source.value.startsWith('./')).reverse()) {
    const local = node.specifiers.map(s => s.local.name);
    out = out.slice(0, node.start) + (local.length ? `var ${local.map(n => `${n}=__stub`).join(',')};` : '') + out.slice(node.end);
  }
  const probe = path.join(dir, `__probe-${file}`);
  fs.writeFileSync(probe, `function __stub(){return ''}\n${out}\nexport{${core.name} as __core};\n`); probes.push(probe);
  const lent = !('document' in globalThis);
  if (lent) globalThis.document = { querySelector: () => ({}), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
  let mod; try { mod = await import(pathToFileURL(probe).href); } finally { if (lent) delete globalThis.document; }
  return { file, text: null, game: mod.__core() };
}
// 실제 Web Locks를 쥐는 탭 하나(스크립트 묶음만): 같은 묶음 글을 새 문맥에서 돌린다.
function tab(side) {
  const listeners = new Map();
  const game = script(side.text, side.file, { console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, structuredClone, AbortController, crypto: globalThis.crypto,
    document: {}, location: { protocol: 'https:', origin: 'https://synk.im' }, navigator: { locks },
    addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); }, removeEventListener: (name, fn) => listeners.set(name, (listeners.get(name) || []).filter(f => f !== fn)) });
  return { game, hide: () => { for (const fn of listeners.get('pagehide') || []) fn(); } };
}
const item = (name, { family = name, skill = 'ko.reading.detail', difficulty = 1 } = {}) => ({ id: name, itemKey: `${name}.v1`, familyKey: family, skillId: skill, modality: 'reading', difficulty, responseFormat: 'single-choice', audioRequired: false, confounded: false });
// 계정 저장소 하나와 서버 하나. copy(side)는 그 저장소 위의 게임 + 동기화기(작은 한도라 답한 항목은 다음 완전한 pull에서 접힌다).
function account(name) {
  let now = START; const mem = new Map(), log = [];
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }, clock = () => new Date(now).toISOString();
  const transport = { get: async ({ after }) => ({ events: copy(log.slice(after)), cursor: log.length, hasMore: false, revision: 1 }), post: async ({ events }) => { for (const e of events) if (!log.some(x => x.id === e.id)) log.push(copy(e)); return { accepted: events.map(e => e.id), revision: 1 }; } };
  const open = (engine, gameId, hold = null) => {
    const game = engine.createGame({ gameId, map, storage, storageScope: 'account', accountKey: name, historyComplete: false, clock, fold: { remote: true, max: 2, keep: 0, ageMs: 0 } });
    const through = method => async args => { if (hold?.method === method) { const gate = hold; hold = null; gate.arrived(); await gate.released; } return transport[method](args); };
    const sync = engine.createLearningSync({ adapter: game, accountKey: name, revision: 1, storage, transport: { get: through('get'), post: through('post') }, auto: false, maxAttempts: 1, backoffMs: [0], sleep: async () => {} });
    return { game, sync, held: method => { let arrived, release; const reached = new Promise(done => { arrived = done; }), released = new Promise(done => { release = done; }); hold = { method, arrived, released }; return { reached, release }; } };
  };
  const answer = (game, id) => { now += 1000; const pid = game.present(item(id)); now += 1000; return game.answer(pid, { correct: true, assessable: true }); };
  const sendAndFold = async sync => { now += 1000; await sync.flush(); now += 1000; await sync.flush(); };
  return { log, open, answer, sendAndFold, step: ms => { now += ms; }, outbox: () => JSON.parse(mem.get(`synk.atlas.learning-sync.v1.${name}`)), history: () => JSON.parse(mem.get('synk.atlas.learning.v1.device')) };
}
// GA1(잠금 없는 두 사본): x가 대기열에 든 기록을 y가 올리고 · 접고 · 잊은 뒤, x가 새 답으로 다시 모은다.
async function staleCopy(side) {
  const acct = account('stale'), x = acct.open(side.game, 'copy-x'), y = acct.open(side.game, 'copy-y');
  await x.sync.start(); await y.sync.start();
  acct.answer(x.game, 'first');
  await acct.sendAndFold(y.sync);
  x.game.summary(); acct.answer(y.game, 'second'); await y.sync.flush(); x.game.summary();
  acct.answer(x.game, 'third');
  const taken = x.sync.status(); acct.step(1000);
  const done = taken.phase === 'blocked' ? taken : await x.sync.flush();
  x.sync.stop(); y.sync.stop();
  return { taken: [taken.phase, taken.code], done: [done.phase, done.queued], adjusted: acct.history().ledger?.adjusted || 0, missing: acct.outbox().missing, once: new Set(acct.log.map(e => e.id)).size === acct.log.length };
}
// GA1(실제 두 탭): 기다리던 탭이 낡은 대기열을 든 채 잠금을 넘겨받는다.
async function handover(side) {
  const acct = account('handover'), a = tab(side), b = tab(side), owns = async game => { for (let i = 0; i < 60 && !game.syncPort.canPersist(); i++) await tick(); assert.equal(game.syncPort.canPersist(), true, `${side.file} 잠금`); };
  const first = acct.open(a.game, 'world-account'); await owns(first.game); await first.sync.start();
  acct.answer(first.game, 'first');
  const second = acct.open(b.game, 'world-account');
  assert.deepEqual([second.game.syncPort.canPersist(), second.sync.status().queued], [false, 4], `${side.file} 기다리는 탭이 대기열 넷을 읽음`);
  await acct.sendAndFold(first.sync);
  second.game.summary(); acct.answer(first.game, 'second'); await first.sync.flush(); second.game.summary();
  a.hide(); await owns(second.game);
  const taken = second.sync.status(); acct.step(1000);
  const done = taken.phase === 'blocked' ? taken : await second.sync.flush();
  first.sync.stop(); second.sync.stop(); first.game.dispose(); second.game.dispose(); b.hide(); await tick(); await tick();
  return { taken: [taken.phase, taken.code, taken.queued, taken.cursor], done: [done.phase, done.queued] };
}
// 요청 사이: x의 올리기가 가는 동안 y가 같은 기록을 올리고 · 접고 · 잊는다.
async function lateAck(side) {
  const acct = account('late-ack'), x = acct.open(side.game, 'copy-x'), y = acct.open(side.game, 'copy-y');
  await x.sync.start(); await y.sync.start();
  acct.answer(x.game, 'first');
  const upload = x.held('post'), flushing = x.sync.flush(); await upload.reached;
  await acct.sendAndFold(y.sync);
  x.game.summary(); acct.answer(y.game, 'second'); await y.sync.flush(); x.game.summary();
  upload.release(); const done = await flushing;
  x.sync.stop(); y.sync.stop();
  return { done: [done.phase, done.queued], adjusted: acct.history().ledger?.adjusted || 0, missing: acct.outbox().missing };
}
// 두 기기(저장소 둘): 계정 장부 a는 서버가 돌려준 것만 접고, b는 접지 않는다.
function bench(engine, fold) {
  let now = START; const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  const coach = engine.createGame({ gameId: 'world-practice', map, storage, clock: () => new Date(now).toISOString(), fold, learnerKey: 'device', storageScope: 'account', accountKey: 'acct', historyComplete: false });
  coach.syncPort.markComplete(true);
  const play = (it, { correct = true } = {}) => { const pid = coach.present(it); now += 1000; return { pid, answer: copy(coach.answer(pid, { correct, assessable: true })) }; };
  return { coach, play, at: days => { now = START + days * DAY; }, step: ms => { now += ms; },
    fill: (tag, count) => { for (let n = 0; n < count; n++) { now += 1000; play(item(`${tag}-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); } },
    settle: () => coach.syncPort.settle(coach.events().map(e => e.id)) };
}
// GA2: 기준 답의 제시가 접힌 뒤 그 제시의 도움만 늦게 온다. correct=false면 이미 recovery라 그대로여야 한다.
function anchorHelp(side, correct = true) {
  const a = bench(side.game, { remote: true, max: 40, keep: 20, ageMs: 1 }), b = bench(side.game, false), cell = { skill: 'ko.reading.detail' };
  b.at(0); const pid = b.coach.present(item('b-anchor', cell)); b.at(0.01); b.coach.help(pid, 'hint'); b.at(0.02); const anchor = b.coach.answer(pid, { correct, assessable: true });
  const help = b.coach.events().find(e => e.type === 'practice.helped');
  a.at(0.5); a.coach.syncPort.importEvents(b.coach.events().filter(e => e.id !== help.id));
  a.at(1.5); const pair = a.play(item('a-pair', cell));
  a.at(3); a.fill('x', 20); a.settle(); a.at(5); a.fill('y', 20); a.settle();
  assert.equal(a.coach.events().some(e => e.id === pid), false, `${side.file} 기준 답의 제시가 접힘`);
  // 묶음은 다른 문맥에서 돌아 배열의 원형이 다르다 — 견줄 값은 이쪽 문맥의 것으로 옮긴다.
  const rows = () => copy(a.coach.followups().items.filter(r => r.sourceAttemptId === anchor.eventId).map(r => [r.kind, r.status, r.reason, r.targetAttemptId === pair.answer.eventId]));
  const before = rows(), skipped = a.coach.syncPort.importEvents([help]).skipped;
  return { before, skipped: skipped.length, after: rows() };
}
// 정상 흐름: 한 기기가 접으며 풀어도 판단 보류가 붙지 않는다.
function plain(side) {
  const a = bench(side.game, { remote: true, max: 40, keep: 20, ageMs: 1 }), cell = { skill: 'ko.reading.detail' };
  a.at(0); const first = a.play(item('p-first', cell)); a.at(1.5); const pair = a.play(item('p-pair', cell));
  for (const day of [3, 5, 8]) { a.at(day); a.fill(`d${day}`, 20); a.settle(); }
  const report = a.coach.followups(), rows = report.items.filter(r => r.sourceAttemptId === first.answer.eventId);
  return { folded: report.coverage.folded > 0, held: report.items.filter(r => r.reason === 'adjusted-history').length, d1: [rows[0]?.kind, rows[0]?.status, rows[0]?.targetAttemptId === pair.answer.eventId] };
}
// 판 섞임: 한 판이 쓴 저장소(장부 · outbox)를 다른 판이 이어 쓴다. 꼴은 그대로다.
async function mixed(first, second) {
  const acct = account('mixed'), a = acct.open(first.game, 'tab-a');
  await a.sync.start(); acct.answer(a.game, 'one'); await acct.sendAndFold(a.sync); acct.answer(a.game, 'two'); await a.sync.flush(); a.sync.stop();
  const b = acct.open(second.game, 'tab-b'), opened = await b.sync.start();
  acct.answer(b.game, 'three'); acct.step(1000); const done = await b.sync.flush(); b.sync.stop();
  return { opened: [opened.phase, opened.queued], done: [done.phase, done.queued], server: acct.log.length, once: new Set(acct.log.map(e => e.id)).size === acct.log.length };
}
let checks = 0; const ok = (value, expected, label) => { assert.deepEqual(value, expected, label); checks += 1; };
const held = [true, false, false].map(paired => ['retention', 'unavailable', 'adjusted-history', paired]), observed = [['retention', 'observed', null, true], ['retention', 'not_due', null, false], ['retention', 'not_due', null, false]];
try {
  for (const { name, same } of manifest) {
    const fresh = await load(`new__${name}`), live = await load(`live__${name}`), label = `${name}(${same.length})`;
    // 새 판
    const stale = await staleCopy(fresh);
    ok(stale.taken[0] === 'blocked', false, `${label} 새 판: 낡은 사본이 막히지 않음`); ok(stale.done, ['synced', 0], `${label} 새 판: 이어서 동기화`);
    ok([stale.adjusted, stale.missing, stale.once], [0, [], true], `${label} 새 판: 다시 받거나 두 번 세지 않음`);
    const late = await lateAck(fresh);
    ok([late.done, late.adjusted, late.missing], [['synced', 0], 0, []], `${label} 새 판: 늦게 온 승인을 적지 않음`);
    const help = anchorHelp(fresh);
    ok(help.before, observed, `${label} 새 판: 도움이 오기 전`); ok(help.skipped, 1, `${label} 새 판: 도움은 서버에만 남음`); ok(help.after, held, `${label} 새 판: 기준 답 행 판단 보류`);
    const wrong = anchorHelp(fresh, false);
    ok(wrong.after, wrong.before, `${label} 새 판: 틀린 기준 답(recovery)은 그대로`);
    ok(plain(fresh), { folded: true, held: 0, d1: ['retention', 'observed', true] }, `${label} 새 판: 정상 흐름에 판단 보류 없음`);
    ok(await mixed(live, fresh), { opened: ['synced', 0], done: ['synced', 0], server: 12, once: true }, `${label} 공개본이 쓴 저장소를 새 판이 이음`);
    ok(await mixed(fresh, live), { opened: ['synced', 0], done: ['synced', 0], server: 12, once: true }, `${label} 새 판이 쓴 저장소를 공개본이 이음`);
    // 공개본(결함 재현)
    ok((await staleCopy(live)).taken, ['blocked', 'STORAGE_ERROR'], `${label} 공개본: 낡은 사본이 막힘`);
    ok(anchorHelp(live).after, observed, `${label} 공개본: 늦은 도움이 와도 retention · observed`);
    if (fresh.text) {
      ok(await handover(fresh), { taken: ['idle', null, 0, 4], done: ['synced', 0] }, `${label} 새 판: 실제 두 탭 인계`);
      ok((await handover(live)).taken, ['blocked', 'STORAGE_ERROR', 4, 0], `${label} 공개본: 실제 두 탭 인계가 막힘`);
    }
    console.log(`ok ${label}`);
  }
} finally { for (const probe of probes) fs.rmSync(probe, { force: true }); }
console.log(`인계 · 늦은 도움 공개 후보 통과 — 묶음 ${manifest.length}종 · 검사 ${checks}개`);
