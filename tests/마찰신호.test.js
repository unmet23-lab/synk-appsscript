// friction 장부 회귀 테스트. 실제 장부(docs/_ops/마찰신호.md)는 건드리지 않는다.
// 지키려는 성질: ①ID가 겹치지 않는다 ②표를 깨뜨리는 입력이 장부를 파싱 불가로 만들지 못한다
// ③빈 해소·중복 해소를 거부한다(해소 칸이 거짓이면 "무엇이 작동했나" 집계 전체가 거짓말이 된다)
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TOOL = path.join(__dirname, '..', 'tools', 'friction.js');

const HEAD = [
  '# 마찰 신호 장부',
  '',
  '| ID | 날짜 | 종류 | 신호 | 해소 |',
  '|---|---|---|---|---|',
  '| F001 | 2026-07-17 | 교정 | 첫 신호 | memory/x |',
  '| F002 | 2026-08-01 | 실수 | 둘째 신호 | |',
  '',
].join('\n');

function mkLedger() {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'friction-')), '마찰신호.md');
  fs.writeFileSync(f, HEAD, 'utf8');
  return f;
}

function run(ledger, args, expectFail = false) {
  try {
    return execFileSync(process.execPath, [TOOL, ...args], {
      encoding: 'utf8', stdio: 'pipe',
      env: { ...process.env, SYNK_FRICTION_LEDGER: ledger },
    });
  } catch (e) {
    if (expectFail) return { failed: true, stderr: String(e.stderr || '') };
    throw e;
  }
}

const rowsOf = (ledger) =>
  fs.readFileSync(ledger, 'utf8').split('\n').filter((l) => /^\|\s*F\d+\s*\|/.test(l.trim()));

test('add — ID가 이어지고 표 안에 들어간다', () => {
  const L = mkLedger();
  run(L, ['add', '실수', '새 신호']);
  const rows = rowsOf(L);
  assert.strictEqual(rows.length, 3);
  assert.ok(rows[2].includes('F003'), 'F002 다음은 F003이어야 한다');
  assert.ok(rows[2].includes('새 신호'));
  assert.ok(rows[2].trim().endsWith('| |'), '새 신호의 해소 칸은 비어야 한다');
});

test('add — 표를 깨뜨리는 파이프·개행을 삼키지 않고 치환한다', () => {
  const L = mkLedger();
  run(L, ['add', '마찰', 'a | b | c']);
  const rows = rowsOf(L);
  assert.strictEqual(rows.length, 3);
  assert.ok(!rows[2].includes('a | b'), '파이프가 그대로 들어가면 장부가 파싱 불가가 된다');
  // 장부가 여전히 읽힌다
  const out = run(L, []);
  assert.ok(out.includes('전체 3건'));
});

test('add — 모르는 종류는 거부한다', () => {
  const L = mkLedger();
  const r = run(L, ['add', '잡담', '설명'], true);
  assert.ok(r.failed);
  assert.strictEqual(rowsOf(L).length, 2, '거부됐으면 장부가 안 바뀌어야 한다');
});

test('add — 빈 설명은 거부한다', () => {
  const L = mkLedger();
  assert.ok(run(L, ['add', '실수', ''], true).failed);
  assert.strictEqual(rowsOf(L).length, 2);
});

test('add --date — 과거 신호를 소급 기록할 수 있다', () => {
  const L = mkLedger();
  run(L, ['add', '거절', '지난 제안 기각', '--date', '2026-07-20']);
  assert.ok(rowsOf(L)[2].includes('2026-07-20'));
});

test('resolve — 해소 수단을 적고, 빈 해소는 거부한다', () => {
  const L = mkLedger();
  run(L, ['resolve', 'F002', 'tools/무언가.js']);
  assert.ok(rowsOf(L)[1].includes('tools/무언가.js'));
  const L2 = mkLedger();
  assert.ok(run(L2, ['resolve', 'F002', ''], true).failed, '빈 해소가 들어가면 집계가 거짓말을 한다');
});

test('resolve — 이미 해소된 신호는 덮어쓰지 않는다', () => {
  const L = mkLedger();
  const r = run(L, ['resolve', 'F001', '다른 수단'], true);
  assert.ok(r.failed);
  assert.ok(rowsOf(L)[0].includes('memory/x'), '기존 해소 기록이 보존돼야 한다');
});

test('resolve — 없는 ID는 거부한다', () => {
  const L = mkLedger();
  assert.ok(run(L, ['resolve', 'F999', '수단'], true).failed);
});

test('집계 — 살아있는 신호와 해소를 나눠 센다', () => {
  const L = mkLedger();
  const out = run(L, []);
  assert.ok(out.includes('전체 2건'));
  assert.ok(out.includes('해소 1'));
  assert.ok(out.includes('살아있음 1'));
  assert.ok(out.includes('둘째 신호'), '살아있는 신호는 목록에 나와야 한다');
});

test('--open — 살아있는 신호만 낸다', () => {
  const L = mkLedger();
  const out = run(L, ['--open']);
  assert.ok(out.includes('둘째 신호'));
  assert.ok(!out.includes('첫 신호'));
});

test('실제 장부가 파싱 가능하고 형식이 살아있다', () => {
  const real = require(TOOL);
  const { rows } = real.read();
  assert.ok(rows.length >= 10, `장부 행 ${rows.length}건 — 형식이 깨지면 0건으로 보인다`);
  assert.ok(rows.every((r) => real.KINDS.includes(r.kind)), '모르는 종류가 섞이면 집계에서 조용히 사라진다');
});

/* [2026-08-03] 번호 충돌 방지 — 장부는 append-only **공유 파일**이라, 각 세션이 자기 작업본만 보고
 * 번호를 매기면 같은 번호를 두 개 만든다(그날 F015·F016이 실제로 충돌해 옆 세션이 F017로 재번호했다).
 * 「세션이 각자 base에서 순번을 매기면 충돌한다」는 이 저장소에서 세 번째 형태다
 * (버전 동시 발번 9건 → bump-version 채번 락 · 버전 이력 체인 누락 · 그리고 이것). */

test('다음 번호는 다른 ref가 이미 쓴 번호를 넘어선다 (로컬 작업본만 보지 않는다)', () => {
  const real = require(TOOL);
  const 다른곳 = real.seenElsewhere();
  assert.ok(다른곳 > 0,
    'seenElsewhere()가 0이다 — origin/master·로컬 브랜치에서 장부를 하나도 못 읽었다는 뜻이고, 그러면 이 방어는 없는 것과 같다');
  const { rows } = real.read();
  const 로컬 = rows.reduce((a, r) => Math.max(a, parseInt(r.id.slice(1), 10) || 0), 0);
  const 다음 = parseInt(real.nextId(rows).slice(1), 10);
  assert.equal(다음, Math.max(로컬, 다른곳) + 1,
    '다음 번호가 로컬·원격 최대 중 큰 쪽 +1이 아니다 — 둘 중 하나를 안 보고 있다');
});

test('격리 장부(테스트)에서는 git을 보지 않는다 (실 저장소 이력이 픽스처를 밀어내면 검사가 무의미해진다)', () => {
  const L = mkLedger();
  const out = run(L, ['add', '실수', '격리 픽스처 신호']);
  assert.ok(/F00\d/.test(out), '격리 장부인데 실 저장소 번호대(F0NN 큰 값)를 받았다: ' + out.trim());
});

/* [2026-08-04] 채번 락 — 위 「훑기」 방어가 실제로 뚫린 뒤 추가됐다(F041이 두 개: 이 세션 것과 옆 세션 것).
 * 훑기는 **이미 기록된** 번호만 본다 → 두 세션이 같은 순간에 훑으면 같은 답을 본다. 범위의 문제가 아니라
 * 고르는 행위가 원자적이지 않다는 문제다. 그래서 bump-version과 같은 방식(태그 push 원자성)으로 예약한다.
 *
 * 이 검사는 **격리된 픽스처 저장소**(bare origin + 클론 2개)에서 돈다 — 실 저장소·네트워크에 기대면
 * CI에서 반드시 깨지고, 무엇보다 회귀가 실 장부에 태그를 남기게 된다. git이 없으면 조용히 통과시키지 않고
 * skip으로 드러낸다(통과와 미실행이 같은 모양이면 안 된다). */

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** bare origin 하나를 공유하는 작업본 2개를 만든다 — 두 세션이 같은 base에서 출발한 상황 그대로. */
function mkFixtureRepos() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'friction-lock-'));
  const origin = path.join(base, 'origin.git');
  git(base, ['init', '--bare', '-b', 'master', 'origin.git']);

  const A = path.join(base, 'A');
  fs.mkdirSync(A);
  git(A, ['init', '-b', 'master']);
  git(A, ['config', 'user.email', 'test@synk.local']);
  git(A, ['config', 'user.name', 'test']);
  const led = path.join(A, 'docs', '_ops');
  fs.mkdirSync(led, { recursive: true });
  fs.writeFileSync(path.join(led, '마찰신호.md'), HEAD, 'utf8');
  git(A, ['add', '-A']);
  git(A, ['commit', '-m', 'fixture']);
  git(A, ['remote', 'add', 'origin', origin]);
  git(A, ['push', '-u', 'origin', 'master']);

  const B = path.join(base, 'B');
  git(base, ['clone', origin, 'B']);
  git(B, ['config', 'user.email', 'test@synk.local']);
  git(B, ['config', 'user.name', 'test']);
  return { origin, A, B };
}

/** 그 저장소를 루트로 삼아 도구를 돌린다 — SYNK_FRICTION_ROOT를 주면 락이 실제로 걸린다. */
function runIn(repo, args) {
  return execFileSync(process.execPath, [TOOL, ...args], {
    encoding: 'utf8', stdio: 'pipe',
    env: {
      ...process.env,
      SYNK_FRICTION_ROOT: repo,
      SYNK_FRICTION_LEDGER: path.join(repo, 'docs', '_ops', '마찰신호.md'),
    },
  });
}

test('채번 락: 같은 base를 보는 두 작업본이 같은 번호를 받지 않는다 (F041 실물 충돌의 회귀)', (t) => {
  let repos;
  try { repos = mkFixtureRepos(); }
  catch (e) { return t.skip('픽스처 저장소를 못 만들었다(git 없음?): ' + e.message); }

  // A가 먼저 채번 → F003을 예약(origin에 태그가 올라간다)
  const outA = runIn(repos.A, ['add', '실수', 'A 세션 신호']);
  assert.match(outA, /F003/, 'A가 F003을 못 받았다: ' + outA.trim());

  /* B는 A의 **장부 커밋을 보지 못한다**(A는 아직 커밋·push를 안 했다) — 훑기만으로는 F003이 그대로 나온다.
   * 예약 태그가 있어야만 B가 F004로 밀린다. 이게 이 락이 막는 유일한 자리다. */
  const outB = runIn(repos.B, ['add', '실수', 'B 세션 신호']);
  assert.doesNotMatch(outB, /F003/, '충돌 재현 — B가 A와 같은 F003을 받았다(락이 안 걸렸다): ' + outB.trim());
  assert.match(outB, /F004/, 'B가 F004를 못 받았다: ' + outB.trim());

  const tags = git(repos.origin, ['tag', '-l']).split('\n').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(tags.sort(), ['friction-F003', 'friction-F004'],
    'origin에 예약 태그 2개가 남아야 한다(예약이 원격에 보증된 증거) — 실제: ' + tags.join(','));
});

test('채번 락은 실 저장소를 오염시키지 않는다 (격리 장부만 준 호출은 태그를 만들지 않는다)', () => {
  const real = require(TOOL);
  const before = execFileSync('git', ['tag', '-l', real.TAG_PREFIX + 'F*'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim();
  run(mkLedger(), ['add', '실수', '격리 호출']);
  const after = execFileSync('git', ['tag', '-l', real.TAG_PREFIX + 'F*'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim();
  assert.equal(after, before, '격리 장부 호출이 실 저장소에 예약 태그를 남겼다 — 테스트가 기록을 오염시킨다');
});
