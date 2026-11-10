// Atlas 결함 다섯 공개 후보(적용/공개묶음.cjs)를 묶음 종류마다 실제로 불러 돌린다 — 앵커 대조 · node --check만으로는 끼운 줄이 안 돈다
// (현장 노트 배포 · 공개). 묶음 안의 엔진 · 호스트 모듈 그대로 재고(시험 사본에서만 이름을 꺼낸다, 공개 파일은 그대로),
//   새 판: 정책판 5 · 작은 칸에 안 갇힘 · 한 번 다시(1분 뒤 · 한 번) · 활동 추천의 기다림 · 처음 칸 이유(앞 단계) · 다 모인 페이지 꼴 접기 · 호스트 열거.
//   공개본: 같은 일에서 결함이 재현된다(시험이 결함을 볼 수 있다는 대조).
//   node docs/_ops/qa/atlas-defects5-20261110/적용/공개검사.mjs <check 폴더>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const dir = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(dir, '목록.json'))) throw Error(`check 폴더가 아니다: ${dir}`);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const require = createRequire(import.meta.url);
const { 공용작업본 } = require(path.join(ROOT, 'tools/lib/공용작업본.js'));
const acorn = require(path.join(공용작업본(ROOT), 'node_modules', 'acorn'));
const { createMap } = require(path.join(ROOT, 'strata'));
const map = createMap(require(path.join(ROOT, 'strata/topik-i.js')).topikMap());
const Atlas = require(path.join(ROOT, 'atlas/engine'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, '목록.json'), 'utf8'));
const MIN = 60000, DAY = 86400000, probes = [];
// 앱 묶음(계정 · ID 화면)의 화면 코드가 async 머리에서 문서를 찾다 남기는 거절은 시험 사본의 것만 삼킨다(그 밖은 그대로 실패).
process.on('unhandledRejection', error => { if (/(new|live)__[^\s]*:\d+/.test(String(error?.stack || ''))) return; throw error; });
const isHost = key => /(^|\/)(src\/generated\/world-learning-host\.cjs|account\/world-learning-host\.js)$/.test(key);

// 묶음 안 __commonJS 선언(엔진 · 호스트)의 이름과 그 선언문의 끝.
function decls(text, sourceType) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowReturnOutsideFunction: true }), out = {};
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) {
      const key = d.init?.type === 'CallExpression' && /__commonJS/.test(d.init.callee?.name || '') ? d.init.arguments[0]?.properties?.[0]?.key?.value : null;
      if (key === 'atlas/game-learning.js' && !out.core) out.core = { name: d.id.name, end: n.end };
      if (typeof key === 'string' && isHost(key) && !out.host) out.host = { name: d.id.name, end: n.end };
    }
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') walk(v); }
  })(ast);
  return { ...out, ast };
}
const sourceTypeOf = (file, text) => { if (file.endsWith('.mjs')) return 'module'; try { acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true }); return 'script'; } catch { return 'module'; } };
async function load(file) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8'), type = sourceTypeOf(file, text), { core, host, ast } = decls(text, type);
  if (!core && !host) throw Error(`${file}: 엔진 · 호스트 모듈이 없다`);
  if (type === 'module') {
    // 같은 폴더(./) 밖 import는 빈 함수로(엔진 · 호스트는 안 쓴다).
    let out = text;
    for (const node of ast.body.filter(n => n.type === 'ImportDeclaration' && !n.source.value.startsWith('./')).reverse()) {
      const local = node.specifiers.map(s => s.local.name);
      out = out.slice(0, node.start) + (local.length ? `var ${local.map(n => `${n}=__stub`).join(',')};` : '') + out.slice(node.end);
    }
    const probe = path.join(dir, `__probe-${file}`), names = [core && `${core.name} as __core`, host && `${host.name} as __host`].filter(Boolean);
    fs.writeFileSync(probe, `function __stub(){return ''}\n${out}\nexport{${names.join(',')}};\n`); probes.push(probe);
    const lent = !('document' in globalThis);
    if (lent) globalThis.document = { querySelector: () => ({}), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, append() {}, setAttribute() {} }) };
    let mod; try { mod = await import(pathToFileURL(probe).href); } finally { if (lent) delete globalThis.document; }
    return { file, game: core ? mod.__core() : null, host: host ? mod.__host() : null };
  }
  // 스크립트: 선언 바로 뒤에서 이름을 꺼낸다. 앱 묶음의 화면 코드가 뒤에서 던져도 그 앞에서 꺼낸 것은 쓴다.
  const marks = [core && [core.end, `;globalThis.__core=${core.name};`], host && [host.end, `;globalThis.__host=${host.name};`]].filter(Boolean).sort((a, b) => b[0] - a[0]);
  let code = text; for (const [at, add] of marks) code = code.slice(0, at) + add + code.slice(at);
  // 앱 묶음의 화면 코드가 뒤늦게(타이머 · 약속) 문서를 찾다 던지는 것은 삼킨다 — 엔진 · 호스트 검사는 꺼낸 모듈로만 한다.
  const later = fn => (...args) => { try { const out = fn(...args); if (out && typeof out.catch === 'function') out.catch(() => {}); } catch { /* 화면 코드 */ } };
  const timer = (set, fn, ms, ...args) => { const t = set(later(fn), ms, ...args); t?.unref?.(); return t; };
  const sandbox = { console: { log() {}, warn() {}, error() {}, info() {}, debug() {} }, setTimeout: (fn, ms, ...a) => timer(setTimeout, fn, ms, ...a), clearTimeout,
    setInterval: (fn, ms, ...a) => timer(setInterval, fn, ms, ...a), clearInterval, queueMicrotask: fn => queueMicrotask(later(fn)),
    URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, crypto: globalThis.crypto };
  vm.createContext(sandbox);
  try { vm.runInContext(code, sandbox, { filename: file }); } catch (error) { if (!(core ? sandbox.__core : true) || !(host ? sandbox.__host : true)) throw error; }
  return { file, game: core ? sandbox.__core() : null, host: host ? sandbox.__host() : null };
}

// 열거 · 글자 수를 갖춘 저장소(브라우저 localStorage처럼).
const disk = () => { const d = new Map(); return { d, get length() { return d.size; }, key: i => [...d.keys()][i] ?? null, getItem: k => (d.has(k) ? d.get(k) : null), setItem: (k, v) => d.set(k, String(v)), removeItem: k => d.delete(k) }; };
const clockAt = iso => { let t = Date.parse(iso); const c = () => new Date(t).toISOString(); c.advance = ms => { t += ms; }; return c; };
const item = (skillId, difficulty, i, format = 'single-choice') => ({ id: `${skillId}.d${difficulty}.${format}.${i}`, itemKey: `${skillId}.d${difficulty}.${format}.${i}`, familyKey: `${skillId}.d${difficulty}.${format}.${i}`,
  skillId, skillIds: [skillId], modality: skillId.split('.')[1], difficulty, responseFormat: format, audioRequired: false, confounded: false });
const play = (coach, it, correct) => coach.answer(coach.present(it), { correct, assessable: true });
const open = (side, gameId, clock, extra = {}) => side.game.createGame({ gameId, map, storage: disk(), clock, ...extra });
const RETRY = '「낱말 뜻 읽기」에서 놓친 문제를 한 번 더 풀어 봐요.', STEP = '「듣고 세부 정보 찾기」 앞 단계를 최근 혼자 해냈어요. 한 단계 올려 봐요.';

// 결함 3: 6계열 칸에서 두 번 틀린 뒤 40문항 — 그 칸 몇 번인가.
function stuck(side) {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = open(side, 'small', clock), skill = 'ko.listening.negation';
  const cell = Array.from({ length: 6 }, (_, i) => item(skill, 2, i, 'cup-compose'));
  const all = [...cell, ...['ko.listening.detail', 'ko.listening.condition'].flatMap(s => Array.from({ length: 6 }, (_, i) => item(s, 1, i)))];
  for (const [i, correct] of [[0, false], [1, false], [2, true]]) { play(coach, cell[i], correct); clock.advance(20000); }
  let inCell = 0;
  for (let step = 0; step < 40; step += 1) { const it = coach.recommend(all, { audioAvailable: true }).selected; if (it.skillIds[0] === skill) inCell += 1; play(coach, it, true); clock.advance(20000); }
  return inCell;
}
// 결함 4(정책판 5): 처음 시도를 놓친 문항 — 10초 뒤 · 1분 뒤 · 그다음.
function retry(side) {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = open(side, 'retry', clock), words = Array.from({ length: 5 }, (_, i) => item('ko.reading.vocabulary', 1, i));
  play(coach, words[0], false); clock.advance(10000);
  const early = coach.recommend(words, { audioAvailable: true }).selected.id === words[0].id;
  clock.advance(MIN); const due = coach.recommend(words, { audioAvailable: true });
  const back = due.selected.id === words[0].id, reason = due.reason;
  if (back) play(coach, words[0], true); clock.advance(MIN);
  const again = coach.recommend(words, { audioAvailable: true }).selected.id === words[0].id;
  return { early, back, reason: back ? reason : null, again };
}
// 활동 추천: 놓친 문항만 든 활동 대 다른 칸 새 문항 활동 — 10초 뒤.
function activityWait(side) {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = open(side, 'act', clock), cat = item('ko.reading.vocabulary', 1, 0), water = item('ko.reading.detail', 1, 0);
  if (typeof coach.recommendActivities !== 'function') return 'API 없음';
  play(coach, cat, false); clock.advance(10000);
  return coach.recommendActivities([{ id: 'game.cat', minutes: 3, targets: [cat] }, { id: 'game.fresh', minutes: 3, targets: [water] }]).selected.id;
}
// 활동 추천(설계 §3-1 v0.3): familyKeys 없는 단일 대상(WORLD 생활 레슨 꼴)은 다 봤어도 다 쓴 활동이 아니다 — 놓친 칸의 다음 레슨이 먼저.
function lessonNotSpent(side) {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = open(side, 'lesson', clock), seen = [0, 1, 2].map(i => item('ko.reading.detail', 1, i));
  if (typeof coach.recommendActivities !== 'function') return 'API 없음';
  for (const [i, it] of seen.entries()) { play(coach, it, i === 2); clock.advance(5 * MIN); }
  const r = coach.recommendActivities([{ id: 'lesson.next', minutes: 5, targets: seen.slice(0, 2) }, { id: 'game.fresh', minutes: 5, targets: [item('ko.reading.main', 1, 0)] }]);
  return JSON.parse(JSON.stringify({ selected: r.selected.id, reasons: r.reasons })); // vm 사본의 배열은 원형이 달라 그대로는 엄격 비교가 안 된다
}
// 순간 맞춤(설계 §3-2 v0.4): 1분 안의 다시는 위 다섯 창에서 빠진다 — 흐름 난도가 맞아도 새 문항, 1분 뒤에는 한 번 다시.
function flowWindow(side) {
  const SPEC = { id: 'test.flow', items: { levels: [1, 2, 3], weight: 2 }, knobs: [{ id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 }] };
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = open(side, 'flow', clock), missed = item('ko.listening.detail', 1, 0, 'cup-compose'), fresh = item('ko.listening.negation', 2, 0, 'cup-compose');
  play(coach, missed, false); clock.advance(10000);
  const live = coach.live(SPEC), early = live.pick([missed, fresh]).selected.id; clock.advance(MIN);
  return { early, due: live.pick([missed, fresh]).selected.id };
}
// 활동 추천(설계 §3-2 v0.4): 연습 칸이어도 1분 안의 다시만 든 활동은 급한 줄에 서지 않는다.
function heldActivity(side) {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = open(side, 'held', clock), [w1, w2, cat] = [1, 2, 0].map(i => item('ko.reading.vocabulary', 1, i)), water = item('ko.reading.detail', 1, 0);
  if (typeof coach.recommendActivities !== 'function') return 'API 없음';
  play(coach, w1, false); clock.advance(20000); play(coach, w2, true); clock.advance(20000); play(coach, cat, false); clock.advance(10000);
  const acts = () => coach.recommendActivities([{ id: 'game.cat', minutes: 3, targets: [cat] }, { id: 'game.fresh', minutes: 3, targets: [water] }]).selected.id;
  const early = acts(); clock.advance(MIN); return { early, due: acts() };
}
// 결함 5: 난도 1을 혼자 네 번 맞힌 뒤 난도 2 첫 칸의 이유.
function stepUp(side) {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = open(side, 'step', clock);
  for (let i = 0; i < 4; i += 1) { play(coach, item('ko.listening.detail', 1, i), true); clock.advance(30000); }
  return coach.recommend([item('ko.listening.detail', 2, 0)], { audioAvailable: true }).reason;
}
// 결함 2: 1,600건 서버 복원(페이지 꼴) — 다 모이고 서버가 돌려보낸 뒤 접히는가.
const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' }, OLD = '2026-08-01T09:00:00.000Z';
const row = (id, type, f = {}) => ({ schema: 1, id, type, scope, at: OLD, recordedAt: OLD, ...f });
const graph = n => [row(`d${n}`, 'decision.made', { experienceId: 'practice', variant: 'standard', policy: Atlas.VERSION, evidence: [] }),
  row(`p${n}`, 'practice.presented', { decisionId: `d${n}`, taskId: `t${n}`, taskVersion: '1', itemKey: `old.i${n}`, conceptIds: ['ko.reading.detail'], firstExposure: true,
    measure: { skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, familyKey: `old.f${n}`, audioRequired: false, confounded: false, responseFormat: 'single-choice' } }),
  row(`a${n}`, 'practice.attempted', { presentationId: `p${n}`, attemptNo: 1, verdict: n % 4 ? 'correct' : 'incorrect', errorTags: [] }),
  row(`c${n}`, 'experience.completed', { decisionId: `d${n}`, experienceId: 'practice', variant: 'standard' })];
function pagedFold(side) {
  const events = Array.from({ length: 400 }, (_, n) => graph(n)).flat(), storage = disk();
  const g = side.game.createGame({ gameId: 'pages', map, storage, storageScope: 'account', accountKey: 'synthetic', historyComplete: false, clock: () => '2026-08-10T00:00:00.000Z', fold: { remote: true } });
  g.syncPort.importEvents(events); g.syncPort.markComplete(true); g.syncPort.settle(events.map(e => e.id));
  const root = JSON.parse(storage.getItem(`${side.game.KEY}.device`));
  return { paged: root.paged, folded: root.data?.ledger?.folded || 0, kept: g.syncPort.events().length };
}
// 결함 1: 호스트가 엔진에 넘기는 저장소에 열거(key · length)가 있는가, 세션이 끝나면 막히는가.
function hostEnum(side) {
  const { createWorldLearningHost } = side.host, storage = disk(), seen = [];
  storage.setItem('x', '1');
  const host = createWorldLearningHost({ accountKey: 'account.synthetic', revision: 1, storage, connected: false, guard: () => {} });
  const factory = o => { seen.push(o.storage); return { syncPort: { markComplete() {} }, dispose() {} }; };
  try { host.createGame({ gameId: 'probe' }, factory, () => null); } catch { /* 가짜 코치를 감싸다 던져도 넘긴 저장소는 잡혔다 */ }
  const given = seen.at(-1); if (!given) throw Error(`${side.file}: 호스트가 엔진을 부르지 않았다`);
  const result = { key: typeof given.key === 'function' ? given.key(0) : null, length: 'length' in given ? given.length : null };
  host.stop();
  let blocked = null; if (result.key) { try { void given.length; blocked = false; } catch (error) { blocked = error.code; } }
  return { ...result, blocked };
}

const checks = [];
const check = (name, fn) => {
  let result; try { result = fn(); } catch (error) { console.error(`실패 · ${name}`); throw error; }
  checks.push(result === undefined ? name : `${name} ${JSON.stringify(result)}`);
};
try {
  for (const { pub, name, way, same } of manifest) {
    const fresh = await load(`new__${name}`), old = await load(`live__${name}`), tag = `${pub}(${way} · 같은 바이트 ${same.length})`;
    if (fresh.game) {
      check(`${tag}: 정책판`, () => { assert.equal(open(fresh, 'v', clockAt('2026-11-01T00:00:00Z')).summary().policy, 'learning-priority-5'); return open(old, 'v', clockAt('2026-11-01T00:00:00Z')).summary().policy; });
      check(`${tag}: 작은 칸에 안 갇힌다(공개본 그 칸 수와 함께)`, () => { const n = stuck(fresh), o = stuck(old); assert.ok(n <= 16, `새 판 ${n}`); assert.ok(o >= 30, `공개본 ${o} — 결함 재현`); return { 새: n, 공개본: o }; });
      check(`${tag}: 놓친 문항은 1분 뒤 한 번만 다시`, () => { const n = retry(fresh), o = retry(old); assert.deepEqual(n, { early: false, back: true, reason: RETRY, again: false }); assert.equal(o.back, false, '공개본은 새 문항이 남는 동안 안 돌아온다 — 결함 재현'); return o; });
      check(`${tag}: 활동 추천은 1분 안의 다시만 든 활동을 고르지 않는다`, () => { const n = activityWait(fresh); if (n !== 'API 없음') assert.equal(n, 'game.fresh'); return n; });
      check(`${tag}: 순간 맞춤 창은 1분 안의 다시를 고르지 않는다`, () => { const n = flowWindow(fresh), o = flowWindow(old); assert.deepEqual(n, { early: 'ko.listening.negation.d2.cup-compose.0', due: 'ko.listening.detail.d1.cup-compose.0' }); return { 공개본: o }; });
      check(`${tag}: 연습 칸이어도 1분 안의 다시만 든 활동은 기다린다`, () => { const n = heldActivity(fresh); if (n !== 'API 없음') assert.deepEqual(JSON.parse(JSON.stringify(n)), { early: 'game.fresh', due: 'game.cat' }); return n; });
      check(`${tag}: 다 본 단일 대상 레슨은 다 쓴 활동이 아니다`, () => { const n = lessonNotSpent(fresh); if (n !== 'API 없음') assert.deepEqual(n, { selected: 'lesson.next', reasons: ['practice.practice'] }); return n; });
      check(`${tag}: 앞 단계를 해낸 처음 칸의 이유`, () => { const n = stepUp(fresh), o = stepUp(old); assert.equal(n, STEP); assert.match(o, /기록이 적어요/, '공개본 — 결함 재현'); });
      check(`${tag}: 다 모인 페이지 꼴은 접는다`, () => { const n = pagedFold(fresh), o = pagedFold(old); assert.equal(n.paged, 1); assert.ok(n.folded > 0 && n.kept <= 600, JSON.stringify(n)); assert.equal(o.folded, 0, '공개본은 안 접는다 — 결함 재현'); return { 새: n, 공개본: o }; });
    }
    if (fresh.host) check(`${tag}: 호스트가 저장소 열거를 넘기고 세션 끝에 막는다`, () => {
      const n = hostEnum(fresh), o = hostEnum(old);
      assert.deepEqual(n, { key: 'x', length: 1, blocked: 'MEMORY_SESSION_ENDED' }); assert.deepEqual(o, { key: null, length: null, blocked: null }, '공개본은 열거를 버린다 — 결함 재현');
    });
  }
  console.log(checks.map(c => `ok · ${c}`).join('\n'));
  console.log(`결함 다섯 공개 검사 ${checks.length}개 통과 · 묶음 종류 ${manifest.length}개`);
} finally { for (const probe of probes) fs.rmSync(probe, { force: true }); }
