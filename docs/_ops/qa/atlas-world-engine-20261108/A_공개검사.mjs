// Atlas × WORLD 1단계 A를 공개본 덧댄 묶음 둘에 끼운 판(A_공개묶음.cjs, 2026-11-08)을 실제로 돌린다.
// node --check와 앵커 대조만으로는 끼운 줄이 안 돈다(현장 노트 배포 · 공개) — check/ 폴더의 고친 묶음 · 공개본 묶음을 import해, 묶음 안의 Core · Strata ·
// Temper(묶인 모듈 그대로)로 tests/atlas-followup-map-growth.test.mjs와 같은 일을 하고, 그 화면이 실제로 쓰는 재확인 공급(followupRows — 계정 길은
// 따로 공개된 world-learning-followups.mjs, 혼자 여는 홈은 생활 묶음 안의 사본)으로 공급을 본다.
//   고친 판: 지도가 자라도 재확인이 「확인할 때」로 남고 공급되며 새 문항이 짝이 된다 · 옛 판이 적은 기록도 이어진다 · 능력이 지도에서 빠지면 공급하지 않는다.
//   공개본(고치기 전): 같은 일에서 끊긴다(결함 재현 — 시험이 결함을 볼 수 있다는 대조).
//   지도가 그대로면 두 판의 재확인 투영이 같다 — 지금 학생 화면의 동작은 바뀌지 않는다.
//   node docs/_ops/qa/atlas-world-engine-20261108/A_공개검사.mjs <check 폴더>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const dir = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(dir, 'world-account.bundle.mjs'))) throw Error(`check 폴더가 아니다: ${dir}`);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(import.meta.url);
const { 공용작업본 } = require(path.join(ROOT, 'tools/lib/공용작업본.js'));
const acorn = require(path.join(공용작업본(ROOT), 'node_modules', 'acorn'));
const { followupRows } = await import(pathToFileURL(path.join(dir, 'world-learning-followups.mjs')).href);
// 묶음 안의 이름을 시험용 사본에서만 내보낸다(공개 파일은 그대로 둔다). 이름은 두 묶음 모두 묶는 도구가 정한 그대로다.
// 화면이 쓰는 재확인 공급(followupRows)은 계정 길이면 따로 공개된 world-learning-followups.mjs, 혼자 여는 홈이면 생활 묶음 안에 품은 사본이다 —
// 생활 묶음은 그 사본을 내보내 화면이 실제로 쓰는 소비자로 잰다(끝 판 검수 Fable F1: 따로 공개된 파일로 재면 홈의 옛 공급 줄을 못 본다).
const EXPORT = '\nexport{require_game_learning as __A_core,require_strata as __A_strata,worldMapData as __A_worldMapData,worldLearning as __A_worldLearning};\n';
const LIFE_EXPORT = '\nexport{followupRows as __A_followupRows};\n';
// 생활 묶음은 화면 모듈(../world-sound · world-motion · world-lang)을 부른다 — 시험 사본에서는 그 import를 빈 함수로 바꿔 엔진만 돌린다
// (Core · Temper · Strata는 그 모듈을 쓰지 않는다. 혼자 여는 홈 화면 자체는 공개 전 점검 · 배포 점검의 몫이다). 같은 폴더의 ./ import는 그대로 둔다.
function stubImports(text) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  let out = text;
  for (const node of ast.body.filter(n => n.type === 'ImportDeclaration' && !n.source.value.startsWith('./')).reverse()) {
    const names = node.specifiers.map(s => s.local.name);
    out = out.slice(0, node.start) + (names.length ? `var ${names.map(n => `${n}=__A_stub`).join(',')};` : '') + out.slice(node.end);
  }
  return out === text ? text : `function __A_stub(){return ''}\n${out}`;
}
// 생활 묶음 머리가 문서에 제 스타일이 있는지 한 번 묻는다 — 불러오는 동안만 「있다」고 답하는 문서를 두고 바로 거둔다
// (문서가 남아 있으면 장부가 브라우저로 보고 쓰기를 모았다가 화면을 떠날 때 내려, 이 동기 시험에서 다음 판이 빈 장부를 읽는다). window는 두지 않는다.
const probes = [];
async function load(file, { life = false } = {}) {
  const probe = path.join(dir, `__a-${file}`);
  fs.writeFileSync(probe, stubImports(fs.readFileSync(path.join(dir, file), 'utf8')) + EXPORT + (life ? LIFE_EXPORT : '')); probes.push(probe);
  const lent = !('document' in globalThis);
  if (lent) globalThis.document = { querySelector: () => ({}), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
  let mod;
  try { mod = await import(pathToFileURL(probe).href); } finally { if (lent) delete globalThis.document; }
  const rows = life ? mod.__A_followupRows : followupRows;
  assert.equal(typeof rows, 'function', `${file} 재확인 공급`);
  return { file, core: mod.__A_core(), strata: mod.__A_strata(), data: mod.__A_worldMapData(), api: mod.__A_worldLearning, rows };
}
const copy = value => JSON.parse(JSON.stringify(value));
// 앱이 새 판으로 바뀌어 지도에 무관한 문법 마디가 하나 늘었다(지도판 문자열도 바뀐다) — 시험 grown()과 같다.
function grown(data, suffix = 'grown') {
  const next = copy(data), node = next.nodes.find(n => n.kind === 'grammar_point');
  next.nodes.push({ ...copy(node), id: `${node.id}-${suffix}`, label_ko: `${node.label_ko}(${suffix})` });
  next.map_ver = `${data.map_ver}-${suffix}`;
  return next;
}
function bench(start = Date.parse('2026-11-09T03:00:00Z')) {
  let t = start; const mem = new Map();
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  const clock = () => new Date(t += 1000).toISOString();
  // 앞 화면을 떠날 때처럼(pagehide) 앞 게임의 기록을 장부에 내린 뒤 다음 판을 연다 — 묶음의 장부는 쓰기를 모았다가 내린다.
  let last = null;
  const open = game => { last?.flush?.(); return last = game; };
  return {
    on: (side, data, gameId = 'world-practice') => open(side.core.createGame({ gameId, map: side.strata.createMap(data), storage, clock, followups: true })),
    api: (side, gameId = 'world-practice') => open(side.api.engine.createGame({ gameId, storage, clock, followups: true })),
    wait: days => { t += days * 86400000; },
  };
}
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
try {
  const sides = { newAccount: await load('world-account.bundle.mjs'), liveAccount: await load('live-account.bundle.mjs'),
    newLife: await load('new-life-standalone.mjs', { life: true }), liveLife: await load('live-life-standalone.mjs', { life: true }) };
  assert.notEqual(sides.newLife.rows, followupRows, '생활 묶음은 묶음 안의 공급으로 잰다');
  const data = sides.newAccount.data;
  const skill = data.nodes.find(n => n.id === 'ko.reading.detail' && n.kind === 'skill' && n.domain === 'reading');
  assert.ok(skill, 'WORLD 지도에 ko.reading.detail 읽기 능력');
  for (const side of Object.values(sides)) assert.equal(side.data.map_ver, data.map_ver, `${side.file} 지도판`);
  const item = (n, difficulty = 1) => ({ id: `a-${n}`, itemKey: `a-${n}.v1`, familyKey: `a-${n}`, skillId: skill.id, difficulty, responseFormat: 'single-choice', modality: 'reading', audioRequired: false });
  const d1 = (coach, gameId = 'world-practice') => coach.followups().items.find(r => r.gameId === gameId && r.window === 'd1');
  const answer = (coach, it, correct = true) => coach.answer(coach.present(it), { correct, assessable: true });

  // ① 지도가 자란 뒤 — 같은 기기 장부, 앞 판이 잡은 1일 재확인. 공급은 그 화면이 쓰는 소비자(side.rows)로 잰다.
  // reverse: 자란 지도가 적은 기록을 옛 지도를 품은 판이 읽는다(계정 길이 지도를 키운 뒤 혼자 여는 홈을 여는 경우 — 끝 판 검수 Fable F1 재현의 둘째 방향).
  function growth(side, anchorSide = side, { reverse = false } = {}) {
    const b = bench(), grownData = grown(side.data), [first, then] = reverse ? [grownData, side.data] : [anchorSide.data, grownData];
    let coach = b.on(anchorSide, first);
    answer(coach, item(1)); b.wait(2);
    coach = b.on(side, then);
    const projection = coach.followups(), row = d1(coach);
    const offered = side.rows({ projection, pool: [item(2)], seen: () => false, taskVersion: then.map_ver }).rows.find(r => r.window === 'd1')?.available;
    answer(coach, item(2));
    const after = d1(coach);
    return { policy: projection.policy, status: row.status, current: row.current, recorded: row.measure.taskVersion === first.map_ver, offered, after: [after.status, after.outcome] };
  }
  for (const [name, side, live] of [['계정 묶음', sides.newAccount, sides.liveAccount], ['생활 묶음', sides.newLife, sides.liveLife]]) {
    check(`${name}: 지도가 자라도 재확인이 남고 공급되며 새 문항이 짝이 된다`, () => {
      assert.deepEqual(growth(side), { policy: 'temper-followup-2', status: 'due', current: true, recorded: true, offered: true, after: ['observed', 'independent-correct'] });
    });
    check(`${name}: 공개본(고치기 전)은 같은 일에서 끊긴다 — 결함 재현`, () => {
      assert.deepEqual(growth(live), { policy: 'temper-followup-1', status: 'due', current: undefined, recorded: true, offered: false, after: ['due', null] });
    });
    check(`${name}: 공개본이 적은 기록을 고친 판이 자란 지도에서 잇는다`, () => {
      assert.deepEqual(growth(side, live), { policy: 'temper-followup-2', status: 'due', current: true, recorded: true, offered: true, after: ['observed', 'independent-correct'] });
    });
    check(`${name}: 자란 지도가 적은 기록을 옛 지도를 품은 판이 읽어도 공급하고 짝을 맺는다(공개본은 못 함)`, () => {
      assert.deepEqual(growth(side, side, { reverse: true }), { policy: 'temper-followup-2', status: 'due', current: true, recorded: true, offered: true, after: ['observed', 'independent-correct'] });
      assert.deepEqual(growth(live, live, { reverse: true }), { policy: 'temper-followup-1', status: 'due', current: undefined, recorded: true, offered: false, after: ['due', null] });
    });
    check(`${name}: Core 「고친 뒤 다른 문항」이 지도판이 아니라 능력 칸을 견준다`, () => {
      const run = s => { const b = bench(); const a = answer(b.on(s, s.data, 'world-recheck'), item(11), false);
        const later = b.on(s, grown(s.data), 'world-recheck'); const t = answer(later, item(12)); return later.recheck(a.eventId, t.eventId); };
      const fixed = run(side), old = run(live);
      assert.equal(fixed.status, 'independent-correct'); assert.notEqual(fixed.reason, 'different-measurement');
      assert.equal(old.reason, 'different-measurement');
    });
    check(`${name}: 능력이 다른 영역으로 옮겨진 지도에서는 공급하지 않는다`, () => {
      const b = bench(); let coach = b.on(side, side.data); answer(coach, item(5)); b.wait(2);
      const moved = copy(side.data); moved.nodes.find(n => n.id === skill.id).domain = 'listening'; moved.map_ver += '-moved';
      coach = b.on(side, moved);
      const projection = coach.followups(), row = d1(coach);
      assert.equal(row.current, false);
      assert.equal(side.rows({ projection, pool: [item(6)], seen: () => false, taskVersion: moved.map_ver }).rows.find(r => r.window === 'd1').available, false);
    });
    // ② 지도가 그대로면(지금 공개본의 상태) 두 판의 투영이 같다 — 칸 둘 · 1 · 7 · 30일 창 · 맞음 · 틀림 · 놓침을 함께.
    check(`${name}: 지도가 그대로면 고친 판과 공개본의 재확인 투영이 같다`, () => {
      const run = s => {
        const b = bench(), coach = b.on(s, s.data);
        answer(coach, item(21)); answer(coach, item(31, 2), false);
        b.wait(2); answer(coach, item(22)); answer(coach, item(32, 2), false);
        b.wait(6); answer(coach, item(23));
        b.wait(4);
        const p = coach.followups();
        return { complete: p.evidenceComplete, rows: p.items.map(r => [r.gameId, r.window, r.kind, r.status, r.outcome, r.measure.skillId, r.measure.difficulty, r.measure.taskVersion]) };
      };
      const fixed = run(side), old = run(live);
      assert.deepEqual(fixed, old);
      assert.ok(fixed.rows.some(r => r[3] === 'observed') && fixed.rows.some(r => r[3] === 'missed') && fixed.rows.some(r => r[3] === 'not_due'), '관찰 · 놓침 · 아직 섞임');
    });
    check(`${name}: 공개 API(worldLearning.engine)가 고친 Core를 쓴다`, () => {
      const run = s => { const b = bench(), coach = b.api(s); answer(coach, item(51)); b.wait(2); const row = d1(coach); return [coach.followups().policy, row.status, row.current]; };
      assert.deepEqual(run(side), ['temper-followup-2', 'due', true]);
      assert.deepEqual(run(live), ['temper-followup-1', 'due', undefined]);
    });
  }
  console.log(checks.map(name => `ok · ${name}`).join('\n'));
  console.log(`A 공개 검사 ${checks.length}개 통과`);
} finally {
  for (const probe of probes) fs.rmSync(probe, { force: true });
}
