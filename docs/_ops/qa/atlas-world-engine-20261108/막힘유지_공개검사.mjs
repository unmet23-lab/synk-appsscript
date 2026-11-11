// 기억 동기화 막힘 유지 공개 후보(막힘유지_공개묶음.cjs)를 묶음 종류마다 실제로 불러 돌린다. 앵커 대조만으로는 끼운 줄이 도는지 모른다 —
// 끼운 `phase`가 그 자리에 없으면 구독이 ReferenceError로 끊겨 「막힌 채」는 거짓으로 통과하므로, 막히지 않은 흐름도 같이 돌린다.
//   새 판: 동의 · 판 · 로그인으로 막힌 뒤 로컬 저장이 실패해도 막힌 채이고 서버에 다시 묻지 않는다.
//   두 판: 막히지 않은 동기화는 바뀐 설정을 보내고, 저장 실패는 전처럼 offline · STORAGE_ERROR로 알리고, 다음 바뀜에 다시 맞춘다(같은 결과).
//   공개본: 같은 일에서 막힘이 offline · STORAGE_ERROR로 바뀌고 서버에 다시 묻는다(결함 재현 — 검사가 결함을 볼 수 있다는 대조).
//   node docs/_ops/qa/atlas-world-engine-20261108/막힘유지_공개검사.mjs <check 폴더>
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
const map = createMap(worldMapData()), probes = [];
const copy = value => JSON.parse(JSON.stringify(value)), wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// 묶음 안 Core 모듈(엔진 그대로)을 시험 사본에서만 꺼낸다. __commonJS 이름은 묶음마다 꼬리가 달라 파서로 찾는다(인계_공개검사.mjs와 같다).
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
  if (!file.endsWith('.mjs')) return { file, game: script(text, file, { console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, structuredClone, AbortController, crypto: globalThis.crypto }) };
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
  return { file, game: mod.__core() };
}
// 계정 하나 · 서버 하나(설정 기억 끝점). refuse가 있으면 서버는 GET · POST를 그 코드로 거절한다. fail(true) 동안 기기 저장이 꽉 찬다.
function account(engine, refuse = null) {
  let now = Date.parse('2026-12-01T09:00:00.000Z'), full = false;
  const mem = new Map(), rows = new Map(), calls = [], seen = [], key = e => `${e.kind}|${e.key}`;
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => { if (full) throw Error('quota'); mem.set(k, String(v)); }, removeItem: k => mem.delete(k) };
  const transport = {
    get: async () => { calls.push('get'); return refuse ? { ok: false, error: { code: refuse } } : { ok: true, revision: 1, entries: copy([...rows.values()]) }; },
    post: async ({ entries }) => {
      calls.push('post'); if (refuse) return { ok: false, error: { code: refuse } };
      for (const e of copy(entries)) { const old = rows.get(key(e)); if (!old || Date.parse(e.at) > Date.parse(old.at)) rows.set(key(e), e); }
      return { ok: true, revision: 1, entries: copy(entries.map(e => rows.get(key(e)))) };
    },
  };
  const game = engine.createGame({ gameId: 'world-account', map, storage, clock: () => new Date(now += 1000).toISOString(), storageScope: 'account', accountKey: 'acct-1', historyComplete: false, fold: { remote: true } });
  const sync = engine.createMemorySync({ adapter: game, accountKey: 'acct-1', revision: 1, transport, delayMs: 0, onStatus: s => seen.push([s.phase, s.code]) });
  return { game, sync, rows, calls, seen, fail: on => { full = on; } };
}
const pair = s => [s.phase, s.code];
// 막힌 뒤: 기기 저장 실패 → 다음 바뀜(저장 성공) → 보내기.
async function afterStop(side, code) {
  const a = account(side.game, code), started = pair(copy(await a.sync.start()));
  a.fail(true); const failed = a.game.setPresentation({ support: 'step' }); a.fail(false);
  const kept = pair(copy(a.sync.status())), saved = a.game.setPresentation({ support: 'independent' });
  await wait(20); await a.sync.flush(); await wait(5);
  const stop = a.seen.findIndex(([phase]) => phase === 'blocked'), out = { started, failed, kept, saved, calls: [...a.calls], after: copy(a.seen.slice(stop)) };
  a.sync.stop(); return out;
}
// 막히지 않은 흐름: 바뀐 설정을 보내고, 저장 실패는 알리고, 다음 바뀜에 다시 맞춘다.
async function plain(side) {
  const a = account(side.game), started = pair(copy(await a.sync.start()));
  a.game.setPresentation({ support: 'step' }); await wait(20); const sent = pair(copy(a.sync.status()));
  a.fail(true); const failed = a.game.setPresentation({ support: 'independent' }); a.fail(false);
  const noticed = pair(copy(a.sync.status()));
  const saved = a.game.setPresentation({ support: 'independent' }); await wait(20); await a.sync.flush();
  const back = pair(copy(a.sync.status())), chosen = copy(a.rows.get('presentation|chosen')?.value ?? null);
  a.sync.stop();
  return { started, sent, failed, noticed, saved, back, chosen, requests: a.calls.length > 0 };
}
let checks = 0; const ok = (value, expected, label) => { assert.deepEqual(value, expected, label); checks += 1; };
const CODES = ['LEARNING_DISABLED', 'REVISION_CONFLICT', 'SESSION_REVOKED', 'UNAUTHORIZED'];
const normal = { started: ['synced', null], sent: ['synced', null], failed: false, noticed: ['offline', 'STORAGE_ERROR'], saved: true, back: ['synced', null], chosen: { support: 'independent' }, requests: true };
try {
  for (const { name, same } of manifest) {
    const fresh = await load(`new__${name}`), live = await load(`live__${name}`), label = `${name}(${same.length})`;
    for (const code of CODES) {
      // 새 판: 막힌 채 · 더 묻지 않음 · 막힌 뒤 다른 상태를 알리지 않음.
      ok(await afterStop(fresh, code), { started: ['blocked', code], failed: false, kept: ['blocked', code], saved: true, calls: ['get'], after: [['blocked', code]] }, `${label} 새 판 ${code}: 저장 실패 뒤에도 막힌 채`);
      // 공개본(결함 재현): 저장 실패가 막힘을 offline으로 바꾸고, 다음 바뀜이 서버에 다시 묻는다.
      const old = await afterStop(live, code);
      ok([old.kept, old.calls.length > 1], [['offline', 'STORAGE_ERROR'], true], `${label} 공개본 ${code}: 막힘이 풀려 다시 물음`);
    }
    ok(await plain(fresh), normal, `${label} 새 판: 막히지 않은 흐름`);
    ok(await plain(live), normal, `${label} 공개본: 막히지 않은 흐름(같은 결과)`);
    console.log(`ok ${label}`);
  }
} finally { for (const probe of probes) fs.rmSync(probe, { force: true }); }
console.log(`기억 동기화 막힘 유지 공개 후보 통과 — 묶음 ${manifest.length}종 · 검사 ${checks}개`);
