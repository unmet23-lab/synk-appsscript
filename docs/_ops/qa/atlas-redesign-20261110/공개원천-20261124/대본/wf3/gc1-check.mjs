// 선택 공개 2단계 GC1 사본 재료(gc1-copies.cjs)를 사본마다 실제로 불러 돌린다. 앵커 대조 · node --check만으로는 끼운 줄이 안 돈다(현장 노트 배포 · 공개).
// 끼운 unsent()가 그 자리의 이름(stopped · canPersist · state · port)으로 도는지 tests/atlas-learning-sync.test.js의 GC1 시험과 같은 일로 본다.
//   새 판: 서버가 사건을 거절해 막힌 뒤에도 기록부에서 다시 센다 — 막힐 때 대기열 수, 막힌 뒤 낸 답도 센다, 세기는 상태 · 저장소를 바꾸지 않는다,
//          받은 사건은 세지 않는다(0), 멈춘 동기화는 null.
//   공개본: unsent가 없다(결함 재현 — 검사가 차이를 볼 수 있다는 대조). 막히고 다시 세지 않는 흐름은 두 판이 같다.
//   node gc1-check.mjs <재료 폴더>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const dir = path.resolve(process.argv[2] || '');
const list = JSON.parse(fs.readFileSync(path.join(dir, '목록.json'), 'utf8'));
const ROOT = 'D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5';
const require = createRequire(import.meta.url);
const acorn = require('C:/Users/q1212/Documents/SYNK-appsscript/node_modules/acorn');
const { createMap } = require(path.join(ROOT, 'strata'));
const { worldMapData } = require(path.join(ROOT, 'strata/world-map.js'));
const map = createMap(worldMapData()), START = Date.parse('2026-12-01T00:00:00Z');
const copy = value => JSON.parse(JSON.stringify(value));
// 묶음 안 Core 모듈(atlas/game-learning.js — 엔진 그대로)을 시험 사본에서만 꺼낸다(인계_공개검사.mjs와 같다).
function coreOf(text) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true });
  let core = null;
  (function walk(n) {
    if (!n || typeof n !== 'object' || core) return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    const hit = n.type === 'VariableDeclaration' && n.declarations.find(d => d.init?.type === 'CallExpression' && /__commonJS/.test(d.init.callee?.name || '') && d.init.arguments[0]?.properties?.[0]?.key?.value === 'atlas/game-learning.js');
    if (hit) { core = { name: hit.id.name, end: n.end }; return; }
    for (const k of Object.keys(n)) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (v && typeof v === 'object') walk(v); }
  })(ast);
  if (!core) throw Error('Core 모듈을 못 찾았다');
  return core;
}
function engineOf(file) {
  const text = fs.readFileSync(file, 'utf8'), core = coreOf(text);
  const sandbox = { console, setTimeout, clearTimeout, URL, TextEncoder, TextDecoder, structuredClone, AbortController, crypto: globalThis.crypto };
  vm.createContext(sandbox);
  vm.runInContext(`${text.slice(0, core.end)}\n;globalThis.__core=${core.name};\n${text.slice(core.end)}`, sandbox, { filename: file });
  return sandbox.__core();
}
const item = name => ({ id: name, itemKey: `${name}.v1`, familyKey: name, skillId: 'ko.reading.detail', modality: 'reading', difficulty: 1, responseFormat: 'single-choice', audioRequired: false, confounded: false });
// 계정 저장소 하나와 서버 하나. refuse가 참이면 서버가 올리기를 EVENT_CONFLICT로 거절한다(막힘).
function account(engine) {
  let now = START, refuse = false;
  const mem = new Map(), log = [];
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  const transport = {
    get: async ({ after }) => ({ events: copy(log.slice(after)), cursor: log.length, hasMore: false, revision: 1 }),
    post: async ({ events }) => {
      if (refuse) throw Object.assign(new Error('EVENT_CONFLICT'), { code: 'EVENT_CONFLICT', revision: 1 });
      for (const e of events) if (!log.some(x => x.id === e.id)) log.push(copy(e));
      return { accepted: events.map(e => e.id), revision: 1 };
    },
  };
  const game = engine.createGame({ gameId: 'test-game', map, storage, storageScope: 'account', accountKey: 'account.a', historyComplete: false, clock: () => new Date(now).toISOString() });
  const sync = engine.createLearningSync({ adapter: game, accountKey: 'account.a', revision: 1, storage, transport, auto: false, maxAttempts: 1, backoffMs: [0], sleep: async () => {} });
  let n = 0;
  const answer = () => { n++; now += 1000; const pid = game.present(item(`gc1-${n}`)); now += 1000; return game.answer(pid, { correct: true, assessable: true }); };
  return { mem, sync, answer, refuse: on => { refuse = on; } };
}
async function blocked(engine) {
  const a = account(engine);
  await a.sync.start(); a.answer(); a.refuse(true); await a.sync.flush();
  return a;
}
const rows = [];
for (const entry of list.끼움) {
  const fresh = engineOf(path.join(dir, 'new', entry.경로)), live = engineOf(path.join(dir, 'base', entry.경로));
  // 새 판: GC1 시험과 같은 일
  const a = await blocked(fresh);
  assert.equal(a.sync.status().phase, 'blocked', `${entry.경로}: 막히지 않았다`);
  const queued = a.sync.status().queued;
  assert.ok(queued > 0, `${entry.경로}: 막힐 때 대기열이 비었다`);
  assert.equal(a.sync.unsent(), queued, `${entry.경로}: 막힐 때 대기열 수를 세지 않는다`);
  a.answer();
  assert.equal(a.sync.status().queued, queued, `${entry.경로}: 막힌 동기화가 더 모았다`);
  const before = JSON.stringify([a.sync.status(), [...a.mem.entries()]]);
  assert.equal(a.sync.unsent(), queued * 2, `${entry.경로}: 막힌 뒤 낸 답을 세지 않는다`);
  assert.equal(JSON.stringify([a.sync.status(), [...a.mem.entries()]]), before, `${entry.경로}: 세기가 상태나 저장소를 바꿨다`);
  const s = account(fresh);
  await s.sync.start(); s.answer(); await s.sync.flush();
  assert.equal(s.sync.status().phase, 'synced', `${entry.경로}: 받는 서버에서 맞추지 못했다`);
  assert.equal(s.sync.unsent(), 0, `${entry.경로}: 받은 사건을 셌다`);
  a.sync.stop(); s.sync.stop();
  assert.equal(a.sync.unsent(), null, `${entry.경로}: 멈춘 동기화가 셌다`);
  // 공개본: 같은 흐름에서 막히는 것은 같고, 다시 세는 길이 없다(결함 재현)
  const b = await blocked(live);
  assert.equal(b.sync.status().phase, 'blocked', `${entry.경로}: 공개본이 막히지 않았다`);
  assert.equal(b.sync.status().queued, queued, `${entry.경로}: 공개본과 새 판의 대기열 수가 다르다`);
  assert.equal(typeof b.sync.unsent, 'undefined', `${entry.경로}: 공개본에 이미 unsent가 있다`);
  b.sync.stop();
  rows.push(`${entry.경로.padEnd(40)} ${entry.꼴.padEnd(5)} 막힘 대기열 ${queued} → 다시 셈 ${queued} · 막힌 뒤 ${queued * 2} · 받은 뒤 0 · 멈춤 null · 공개본 unsent 없음`);
}
for (const row of rows) console.log(row);
console.log(`GC1 사본 ${rows.length}/${list.끼움.length} 통과 — 그대로 둘 사본 ${list.그대로.length} · 다시 지을 묶음 ${list.다시지음.length} · 나중(드라마) ${list.나중.length}`);
