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

/* 행은 이제 두 곳에 산다 — 동결 아카이브(.md)와 조각 폴더(장부/F0NN.md · F250 후반).
 * 같은 번호는 조각이 이긴다(도구의 read() 와 같은 규칙 — 규칙이 갈리면 여기가 먼저 빨개져야 한다).
 *
 * ⚠ 이 함수가 내주는 것은 **장부 마크다운 표의 한 행**(그것도 도구를 실제로 돌려 나온 산출)이지
 *   JS 원문이 아니다 — 아래 `!행.includes(…)`·`!/--파일/.test(새행)` 부정 단언들을 `코드만()` 으로
 *   감싸지 않는다(갈래 ⓑ 런타임 산출 + ⓒ 비JS · 대기열 #Q72). 감싸면 신고문 속 `//`·`/*` 를 주석으로
 *   읽어 행을 지운다 → 「그 문자열이 없다」가 항상 참이 되어 **영원히 초록**이다. */
const rowsOf = (ledger) => {
  const rows = new Map();
  for (const l of fs.readFileSync(ledger, 'utf8').split('\n')) {
    const m = /^\|\s*(F\d+)\s*\|/.exec(l.trim());
    if (m) rows.set(m[1], l.trim());
  }
  const dir = path.join(path.dirname(ledger), '장부');
  let names = [];
  try { names = fs.readdirSync(dir); } catch (_) { /* 조각 0 — 첫 add 전 */ }
  for (const n of names) {
    const m = /^(F\d+)\.md$/.exec(n);
    if (m) rows.set(m[1], fs.readFileSync(path.join(dir, n), 'utf8').trim());
  }
  return [...rows.entries()]
    .sort((a, b) => parseInt(a[0].slice(1), 10) - parseInt(b[0].slice(1), 10))
    .map((e) => e[1]);
};

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

/* [2026-08-07] 클라우드(폰) 브랜치의 손번호를 못 보던 자리 — 폰은 채번 태그 push 가 막혀 손으로 번호를
 * 매기는데(F196), 훑는 범위가 origin/master + 로컬뿐이라 **양쪽이 서로를 못 봤다.** 실물: 폰이 F195 를
 * 손으로 달았고 PC 도 같은 번호를 다른 사건에 써서 반입 때 재번호(F198)가 필요했다.
 * 🔑 락으로는 안 막힌다 — 락은 「아직 안 쓰인 순간」을 덮고, 이건 **이미 쓰인 번호를 안 본 것**이다. */
test('다음 번호는 `claude/*` 브랜치가 손으로 쓴 번호도 넘어선다', (t) => {
  let repos;
  try { repos = mkFixtureRepos(); }
  catch (e) { return t.skip('픽스처 저장소를 못 만들었다(git 없음?): ' + e.message); }

  // 폰이 claude/* 브랜치에만 F009 를 손으로 달아 두고 push 했다(태그 예약은 못 한다).
  git(repos.A, ['checkout', '-qb', 'claude/폰작업']);
  const 장부 = path.join(repos.A, 'docs', '_ops', '마찰신호.md');
  fs.writeFileSync(장부, fs.readFileSync(장부, 'utf8').trimEnd()
    + '\n| F009 | 2026-08-07 | 마찰 | 폰이 손으로 매긴 번호 | |\n', 'utf8');
  git(repos.A, ['commit', '-am', '폰 신호']);
  git(repos.A, ['push', '-q', 'origin', 'claude/폰작업']);
  git(repos.A, ['checkout', '-q', 'master']);

  const outB = runIn(repos.B, ['add', '실수', 'PC 세션 신호']);
  assert.doesNotMatch(outB, /F00[1-9]\b/,
    '폰이 이미 쓴 번호대(F009 이하)를 다시 내줬다 — 반입 때 충돌한다: ' + outB.trim());
  assert.match(outB, /F010/, 'F009 다음이어야 한다: ' + outB.trim());
});

/* [2026-08-07] F196 — **거절을 한 가지로 단정하면 폰에서 채번이 통째로 죽는다.**
 *
 * 클라우드(폰) 세션의 git 프록시는 지정 `claude/*` 밖 push 를 거부한다(태그 포함). fetch 는 성공하니
 * 「오프라인」 갈래에 안 걸리고, 루프는 거절을 전부 「누가 방금 가져갔다」로 읽어 20회 헛돈 뒤 exit 1 —
 * **신고문이 통째로 버려진다.** 실물: F195 등재가 이렇게 죽어 손으로 번호를 매겼고, 그 손번호는 예고대로
 * PC 번호와 충돌해 F198 로 재등재해야 했다.
 *
 * ⚠ 이 검사의 전부는 **프록시를 진짜로 재현했는지**다 — 서버 훅이 안 돌면 push 가 성공해 버려
 * 검사가 「거절을 안 만들고 통과」하는 거짓 초록이 된다. 그래서 전제(태그 push 가 실제로 거절되는가)를
 * 먼저 실측하고, 재현 못 하면 통과가 아니라 **skip 으로 드러낸다.** */

/** origin 이 태그 push 만 거부하게 만든다 — 클라우드 프록시와 같은 모양(브랜치는 되고 태그는 안 된다). */
function 태그push를거부하게(origin) {
  const hook = path.join(origin, 'hooks', 'pre-receive');
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(hook,
    '#!/bin/sh\n'
    + 'while read old new ref; do\n'
    + '  case "$ref" in refs/tags/*) echo "remote: refusing tag push (claude/* only)" >&2; exit 1;; esac\n'
    + 'done\n'
    + 'exit 0\n', 'utf8');
  try { fs.chmodSync(hook, 0o755); } catch (_) { /* Windows */ }
}

/** 그 origin 이 정말 태그를 거부하는가 — 재현 실패를 통과로 읽지 않기 위한 전제 실측. */
function 태그거부가실제로도나(repo) {
  try { git(repo, ['tag', 'premise-check']); } catch (_) { return false; }
  let 거부됨 = false;
  try { git(repo, ['push', 'origin', 'premise-check']); } catch (_) { 거부됨 = true; }
  try { git(repo, ['tag', '-d', 'premise-check']); } catch (_) {}
  return 거부됨;
}

test('F196 — 태그 push 가 막힌 환경(폰)에서도 신고문은 장부에 실린다', (t) => {
  let repos;
  try { repos = mkFixtureRepos(); }
  catch (e) { return t.skip('픽스처 저장소를 못 만들었다(git 없음?): ' + e.message); }

  태그push를거부하게(repos.origin);
  if (!태그거부가실제로도나(repos.A)) {
    return t.skip('서버 훅이 안 돌아 프록시를 재현하지 못했다 — 통과가 아니라 미실행이다');
  }

  /* 옛 코드는 여기서 20회 헛돌고 process.exit(1) → execFileSync 가 throw 한다.
   * 즉 이 한 줄이 「신고문이 버려진다」를 그대로 잰다. */
  const out = runIn(repos.A, ['add', '마찰', '폰 세션 신호']);
  assert.match(out, /F003/, '번호를 못 내줬다: ' + out.trim());

  const 실린행 = rowsOf(path.join(repos.A, 'docs', '_ops', '마찰신호.md')).find((l) => /^\|\s*F003\s*\|/.test(l));
  assert.ok(실린행 && /폰 세션 신호/.test(실린행),
    '신고문이 장부에 안 실렸다 — 이게 F196 의 실제 피해다(번호를 못 딴 것이 아니라 기록이 사라진 것)');

  // 예약 못 했다고 말했으면 예약 흔적도 없어야 한다 — 남으면 다음 세션이 「예약된 번호」로 읽는다.
  assert.equal(git(repos.A, ['tag', '-l', 'friction-F*']).trim(), '',
    '예약에 실패했는데 로컬 태그가 남았다');
});

/* 거짓양성 축 — 진짜 선점을 「막힌 환경」으로 세탁하면 두 세션이 같은 번호를 쓴다(락이 없는 것과 같다).
 *
 * 🔑 재현이 이 검사의 전부다. **옆 세션이 먼저 채번하게 두는 것만으로는 안 된다** — 도구가 시작할 때
 * `fetch --tags` 를 하므로 그 태그를 보고 애초에 다음 번호로 건너뛰어 **거절 자체가 안 난다**(첫 판이
 * 그래서 변이를 놓쳤다). 그래서 「fetch 는 끝났는데 push 직전에 옆이 가져갔다」 상태를 직접 만든다:
 *   ① A 가 원격에 태그를 올린다  ② B 는 음수 refspec 으로 그 태그를 **못 가져오게** 막는다
 *   ③ B 에만 커밋 하나 — 안 하면 두 태그가 **같은 객체**라 push 가 no-op 으로 성공해 거절이 안 난다.
 * (③은 실측으로 알아냈다. origin 훅으로 만들려던 첫 판은 quarantine 이 ref 갱신을 금지해 죽었다.) */
function 선점당한상태로만들기(repos, 태그) {
  git(repos.A, ['tag', 태그]);
  git(repos.A, ['push', '-q', 'origin', 태그]);
  git(repos.B, ['config', '--add', 'remote.origin.fetch', '^refs/tags/' + 태그]);
  fs.writeFileSync(path.join(repos.B, 'b.txt'), 'B 만의 파일');
  git(repos.B, ['add', '-A']);
  git(repos.B, ['commit', '-qm', 'B 만의 커밋']);
}

test('F196 수리가 진짜 선점을 「막힌 환경」으로 세탁하지 않는다 (거짓양성)', (t) => {
  let repos;
  try { repos = mkFixtureRepos(); }
  catch (e) { return t.skip('픽스처 저장소를 못 만들었다(git 없음?): ' + e.message); }

  선점당한상태로만들기(repos, 'friction-F003');

  // 전제 실측: 음수 refspec 이 실제로 먹는가(안 먹으면 B 가 태그를 보고 건너뛰어 거절이 안 난다)
  git(repos.B, ['fetch', 'origin', '--tags', '--quiet']);
  if (git(repos.B, ['tag', '-l', 'friction-F003']).trim()) {
    return t.skip('음수 refspec 이 안 먹어 선점 창을 재현하지 못했다 — 통과가 아니라 미실행이다');
  }

  const outB = runIn(repos.B, ['add', '실수', 'B 세션 신호']);
  assert.match(outB, /F004/, '선점을 「막힌 환경」으로 읽고 옆 세션과 같은 번호로 진행했다: ' + outB.trim());
  assert.doesNotMatch(outB, /예약하지 못했다/,
    '정상 예약인데 미예약 경고를 냈다 — 경고가 늘 뜨면 아무도 안 읽는다: ' + outB.trim());

  const 원격태그 = git(repos.origin, ['tag', '-l', 'friction-F*']).split('\n').map((s) => s.trim()).filter(Boolean);
  assert.ok(원격태그.includes('friction-F004'),
    '재시도한 번호를 원격에 예약하지 않았다 — 실제: ' + 원격태그.join(','));
});

/* [2026-08-07] F201 — 락이 **같은 커밋 위의 두 세션에게는 조용히 안 물었다.**
 *
 * 라이트웨이트 태그는 커밋을 가리키는 이름일 뿐이라, 두 작업본의 HEAD 가 같으면 두 태그가 같은
 * 객체다. 두 번째 push 는 거절이 아니라 「Everything up-to-date」로 **exit 0** 이고 도구는 그걸
 * 「원격이 보증했다 = 내 번호」로 읽는다. 실측(수리 전, 도구로): 둘 다 F003 · 경고 없음.
 * 이 저장소는 세션 다수가 같은 master HEAD 에서 출발하니 드문 경우가 아니다 — F041 이 실제로
 * 났던 그 모양이고, 락이 **유일하게 덮기로 한 자리**가 정확히 여기다.
 *
 * ⚠ 위 「채번 락」 검사가 이걸 못 본 이유: 거기선 B 가 fetch 로 A 의 태그를 보고 애초에 다음 번호로
 * 건너뛴다 — 즉 그 초록은 **락이 아니라 훑기**가 낸 것이었다. 그래서 여기서는 훑기를 막고 락만 잰다. */
test('F201 — 같은 커밋 위의 두 세션도 같은 번호를 못 받는다 (락이 훑기 없이 혼자 서는가)', (t) => {
  let repos;
  try { repos = mkFixtureRepos(); }
  catch (e) { return t.skip('픽스처 저장소를 못 만들었다(git 없음?): ' + e.message); }

  /* 전제 ①: 두 작업본이 **같은 커밋** 위에 있다(다르면 태그 객체가 갈려 이 결함이 재현되지 않는다).
   * ⚠ 재는 자리는 **add 전**이다 — 태그는 add 안에서 allocateId 가 달고, 그건 장부 쓰기·커밋보다
   *   먼저 돈다. add 뒤의 HEAD 를 재면 「장부를 쓴 그 자리에서 커밋한다」(통로 마지막 칸) 때문에
   *   A 만 앞서 있어, 결함은 그대로 재현되는데 전제가 거짓으로 실패한다(측정 자리가 틀린 것이지
   *   조건이 깨진 게 아니다). 태그가 달릴 때 같은 커밋이었는지가 이 검사가 물어야 할 것이다. */
  assert.equal(git(repos.A, ['rev-parse', 'HEAD']).trim(), git(repos.B, ['rev-parse', 'HEAD']).trim(),
    '픽스처가 두 작업본을 다른 커밋에 뒀다 — 그러면 이 검사는 아무것도 안 잰다');

  const outA = runIn(repos.A, ['add', '실수', 'A 세션 신호']);
  assert.match(outA, /F003/, 'A 가 F003 을 못 받았다: ' + outA.trim());
  // 전제 ②: 훑기를 막는다 — 안 막으면 B 가 태그를 보고 건너뛰어 락이 아니라 훑기를 재게 된다
  git(repos.B, ['config', '--add', 'remote.origin.fetch', '^refs/tags/friction-F003']);
  git(repos.B, ['fetch', 'origin', '--tags', '--quiet']);
  if (git(repos.B, ['tag', '-l', 'friction-F003']).trim()) {
    return t.skip('음수 refspec 이 안 먹어 훑기를 못 막았다 — 통과가 아니라 미실행이다');
  }

  const outB = runIn(repos.B, ['add', '실수', 'B 세션 신호']);
  assert.doesNotMatch(outB, /F003\b/,
    '같은 커밋 위라 두 태그가 같은 객체가 됐고 push 가 no-op 으로 성공했다 — A 와 같은 번호다: ' + outB.trim());
  assert.match(outB, /F004/, 'F004 로 밀리지 않았다: ' + outB.trim());
});

/* 🔑 위 F201 검사는 **주인 문자열이 세션마다 다른지**는 못 잰다 — annotated tag 의 SHA 에는 tagger
 * **시각**도 들어가서, 검사가 몇 초에 걸쳐 도는 동안엔 메시지가 같아도 SHA 가 갈려 버린다. 그런데
 * 진짜 경쟁은 **같은 초 안**에서 난다(그게 락이 존재하는 이유다). 즉 시각에 기댄 유일성은 정확히
 * 필요한 순간에 없다 — 실측으로 확인했다(주인을 상수로 바꾼 변이가 위 검사를 그냥 통과했다).
 * 그래서 유일성 자체를 여기서 직접 잰다. */
test('F201 — 예약 태그의 주인은 세션마다 다르다 (시각에 기대면 같은 초의 경쟁에서 SHA 가 겹친다)', () => {
  const real = require(TOOL);
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  try {
    process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_aaaa';
    const a = real.예약자();
    process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_bbbb';
    const b = real.예약자();
    assert.notEqual(a, b, '세션이 달라도 주인 문자열이 같다 — 같은 초에 부딪히면 SHA 가 겹쳐 락이 다시 눕는다');
    assert.match(a, /local_aaaa/, '주인에 세션 id 가 안 들어간다: ' + a);
    assert.match(a, /\/\d+$/, '주인에 pid 가 없다 — 세션 id 가 비는 환경(폰·CI)에서 전부 같은 값이 된다: ' + a);
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
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

// ── F107 — 「고치고 → 신고」를 한 번에 적는 통로 ───────────────────────────────────────
//
// 이 축은 세 번째다(F092 안 고치고 닫음 · F096 고치고 안 닫음 · F107 가드가 있는데 원리상 못 봄).
// CLAUDE.md 신뢰성: 3번째는 **원인을 쓸 수 없게** 만든다 — 탐지를 늘리는 게 아니라 통로를 바꾼다.

test('🔴 F107 — 신고문이 해소를 지목하는데 칸을 비우면 거부한다 (그 조합이 샌 자리다)', () => {
  const led = mkLedger();
  const r = run(led, ['add', '실수', 'push 를 배포 완료로 읽었다. 해소=tools/배포판점검.js + 훅(b7a2a18)'], true);
  assert.ok(r.failed, '해소를 지목한 신고문을 해소 칸 없이 받아들였다 — 그 행은 열린 채 아무도 못 본다');
  assert.match(r.stderr, /해소 칸은 빈 채/);
  assert.equal(rowsOf(led).length, 2, '거부했다면서 행은 이미 써 놨다 (픽스처 2행 그대로여야 한다)');
});

test('🔴 F107 — 차단 사유가 시키는 명령이 그 가드를 실제로 통과한다 (F103: 따를 수 없는 처방은 우회를 만든다)', () => {
  const led = mkLedger();
  const 막힘 = run(led, ['add', '실수', '신고문인데 해소=무언가 를 적었다'], true);
  // 사유문에서 처방 명령을 **읽어내** 그대로 돌린다 — 손으로 옮겨 적으면 처방이 바뀌어도 안 깨진다
  const m = /add (\S+) "신고문" --해소 "([^"]+)"/.exec(막힘.stderr);
  assert.ok(m, `사유문이 --해소 처방을 안 준다:\n${막힘.stderr}`);
  const 통과 = run(led, ['add', m[1], '신고문인데 해소=무언가 를 적었다', '--해소', '무엇이 실제로 막았나']);
  assert.match(String(통과), /해소 →/, '가드가 시킨 그대로 돌렸는데 또 막혔다 — 처방을 따를 수 없으면 우회가 정상 통로가 된다');
  const 행 = rowsOf(led);
  assert.equal(행.length, 3, '픽스처 2행 + 새 행 1개');
  assert.match(행[2].trim(), /\|\s*무엇이 실제로 막았나\s*\|$/, '해소 칸이 채워진 채로 태어나지 않았다');
});

test('🔴 F107 — `--해소` 없이 낸 평범한 신고는 **여전히** 그냥 통과한다 (게이트가 정상 신고를 먹으면 안 된다)', () => {
  const led = mkLedger();
  run(led, ['add', '마찰', '아직 안 고쳤다 — 무엇이 막을지 모른다']);
  const 행 = rowsOf(led);
  assert.equal(행.length, 3, '픽스처 2행 + 새 행 1개');
  assert.ok(행[2].trim().endsWith('| |'), '해소 칸이 비어 있어야 정상 신고다 — 칸 모양도 예전 그대로여야 한다');
});

test('--해소 는 따옴표를 빠뜨려도 말이 안 잘린다 (셸이 둘인 저장소다)', () => {
  const led = mkLedger();
  run(led, ['add', '실수', '설명', '--해소', '훅을', '신설했다', '그리고', '회귀를', '붙였다']);
  assert.match(rowsOf(led)[2], /훅을 신설했다 그리고 회귀를 붙였다/);
});

/* ── F148: 동시 추가가 서로를 먹는 것 ──────────────────────────────────────────
 * 실사고: add() 가 파일을 버퍼에 담고 → allocateId() 가 네트워크(git tag push)를 다녀와 →
 * 낡은 버퍼를 통째로 덮어썼다. 그 창에 옆 세션이 쓴 F145 가 흔적 없이 사라졌다.
 *
 * ⚠ 이 검사를 「프로세스 여럿을 동시에 던지고 다 살아남나 본다」로 짜면 안 된다 —
 *   격리 장부에는 네트워크가 없어 창이 마이크로초라 충돌이 **안 나고**, 그러면 버그를
 *   되돌려도 초록이다(= 탐지력 0인데 초록이라 있는 줄 안다). 그래서 **락을 밖에서 잡아**
 *   창을 결정론적으로 벌린다. 두 방향의 변이를 각각 다른 단언이 잡는다:
 *     · 락을 통째로 없애면      → 「아직 안 썼다」 단언이 깨진다
 *     · 락은 두되 낡은 버퍼를 쓰면 → 「남의 행이 살아남았다」 단언이 깨진다 */
function spawnAdd(ledger, 신호) {
  const { spawn } = require('child_process');
  const p = spawn(process.execPath, [TOOL, 'add', '마찰', 신호], {
    stdio: 'pipe', env: { ...process.env, SYNK_FRICTION_LEDGER: ledger },
  });
  return new Promise((res) => p.on('close', (code) => res(code)));
}
const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

test('F148 — 채번 중에 옆 세션이 쓴 행을 덮어쓰지 않는다 (락 + 락 안에서 재읽기)', async () => {
  const led = mkLedger();
  const lock = led + '.lock';
  const fd = fs.openSync(lock, 'wx');          // 옆 세션이 쓰는 중인 상태를 만든다

  const 끝 = spawnAdd(led, '내 신호');
  await 잠깐(600);

  // ① 락이 실제로 막고 있나 — 락을 없애는 변이는 여기서 죽는다
  assert.equal(rowsOf(led).length, 2,
    '락을 잡고 있는데 add 가 이미 써 버렸다 — 직렬화가 없으면 겹치는 순간 한쪽이 사라진다');

  // 그 사이 옆 세션이 한 줄 넣는다(=사고 당시의 F146)
  fs.writeFileSync(led, fs.readFileSync(led, 'utf8').replace(
    /(\| F002 \|[^\n]*\n)/, '$1| F900 | 2026-08-07 | 실수 | 옆 세션이 방금 쓴 행 | |\n'), 'utf8');

  fs.closeSync(fd);
  fs.unlinkSync(lock);
  assert.equal(await 끝, 0, 'add 가 락 해제 뒤 정상 종료해야 한다');

  const 행 = rowsOf(led);
  // ② 낡은 버퍼로 덮어쓰는 변이는 여기서 죽는다 — 이게 F148 그 자체다
  assert.ok(행.some((l) => /F900/.test(l)),
    '옆 세션이 쓴 행이 사라졌다 — F148 실사고 그대로다(도구는 성공을 출력하고 아무 신호도 안 남긴다)');
  assert.ok(행.some((l) => /내 신호/.test(l)), '내 행도 들어가야 한다');
  assert.equal(행.length, 4, '픽스처 2 + 옆 세션 1 + 내 것 1 — 어느 쪽도 잃지 않는다');
});

test('F148 — 죽은 세션이 남긴 낡은 락은 회수한다 (한 번의 크래시가 장부를 영구히 잠그면 안 된다)', () => {
  const led = mkLedger();
  const lock = led + '.lock';
  fs.closeSync(fs.openSync(lock, 'wx'));
  const 옛날 = (Date.now() - require(TOOL).LOCK_STALE_MS - 60_000) / 1000;
  fs.utimesSync(lock, 옛날, 옛날);

  run(led, ['add', '마찰', '낡은 락 뒤에 도착했다']);
  assert.equal(rowsOf(led).length, 3, '낡은 락 때문에 기록이 멈췄다 — 기록은 도구 사정으로 멈추면 안 된다');
  assert.ok(!fs.existsSync(lock), '락을 회수해 쓰고 나서 다시 풀어야 한다');
});

test('F148 — 실패해도 락을 남기지 않는다 (락 안 process.exit 은 finally 를 건너뛴다)', () => {
  const led = mkLedger();
  const r = run(led, ['resolve', 'F999', '없는 번호'], true);
  assert.ok(r.failed, '없는 번호는 실패해야 한다');
  assert.ok(!fs.existsSync(led + '.lock'),
    '락이 남았다 — 다음 세션이 5초 기다리다 락 없이 진행하게 되고 F148 이 되돌아온다');
});

test('F148 — resolve 도 락 안에서 읽는다 (행 번호는 그 사이 밀린다)', async () => {
  const led = mkLedger();
  const lock = led + '.lock';
  const fd = fs.openSync(lock, 'wx');

  const { spawn } = require('child_process');
  const p = spawn(process.execPath, [TOOL, 'resolve', 'F002', '무엇이 막았나'], {
    stdio: 'pipe', env: { ...process.env, SYNK_FRICTION_LEDGER: led },
  });
  const 끝 = new Promise((res) => p.on('close', res));
  await 잠깐(600);
  assert.match(rowsOf(led)[1], /\| \|$/, '락을 잡고 있는데 resolve 가 이미 썼다');

  /* F002 **위에** 행을 끼운다 — 밖에서 읽은 행 번호를 그대로 쓰면 한 칸 밀려
   * 엉뚱한 행(여기서는 F900)을 내 해소문으로 덮는다. */
  fs.writeFileSync(led, fs.readFileSync(led, 'utf8').replace(
    /(\| F001 \|[^\n]*\n)/, '$1| F900 | 2026-08-07 | 실수 | 밀어내는 행 | |\n'), 'utf8');

  fs.closeSync(fd);
  fs.unlinkSync(lock);
  assert.equal(await 끝, 0);

  const 행 = rowsOf(led);
  assert.match(행.find((l) => /F900/.test(l)), /밀어내는 행 \| \|$/,
    '남의 행이 내 해소문으로 덮였다 — 낡은 행 번호로 쓰면 이렇게 된다');
  assert.match(행.find((l) => /F002/.test(l)), /무엇이 막았나/, 'F002 가 해소돼야 한다');
});

/* 🔴 장부는 add() 만 쓰는 통로가 아니다 — 손편집·폰작업반입 병합으로도 행이 늘어난다.
 * 그래서 쓰는 쪽의 소독에 기대면 안 되고 읽는 쪽이 버텨야 한다.
 * 실측 08-07: 손으로 들어온 F193 행의 `2>&1|docs/세션보드.md` 가 칸을 하나 밀어
 * 살아있는 신호가 「해소됨」으로 읽혔다 — --open 에서 통째로 사라지고 집계는 해소로 셌다. */
const 백틱행 = '| F003 | 2026-08-07 | 마찰 | 회차 키가 `2>&1|docs/보드.md` 를 먹는다 — 뒷문장까지 신고문이다 | |';

test('🔴 read — 백틱 안 파이프는 칸막이가 아니다 (살아있는 신호가 해소로 숨던 자리)', () => {
  const L = mkLedger();
  fs.appendFileSync(L, `${백틱행}\n`, 'utf8');
  const 열린것 = run(L, ['--open']);
  assert.ok(열린것.includes('F003'), '백틱 안 파이프 하나로 살아있는 신호가 --open 에서 통째로 사라졌다');
  assert.ok(열린것.includes('뒷문장까지 신고문이다'), '신고문이 파이프 자리에서 잘렸다');
  assert.ok(run(L, []).includes('살아있음 2'), '집계가 그 행을 해소로 셌다 — 무엇이 작동했나가 거짓말이 된다');
});

test('🔴 resolve — 백틱 파이프가 든 행을 닫아도 신고문이 안 잘린다', () => {
  const L = mkLedger();
  fs.appendFileSync(L, `${백틱행}\n`, 'utf8');
  run(L, ['resolve', 'F003', '무엇이 막았나']);
  const 행 = rowsOf(L).find((l) => /F003/.test(l));
  assert.ok(행.includes('`2>&1|docs/보드.md`'), '되쓸 때 신고문의 코드 조각이 사라졌다');
  assert.ok(행.includes('뒷문장까지 신고문이다'), '되쓸 때 신고문 뒷부분이 조용히 잘렸다 — append-only 장부의 유실이다');
  assert.match(행.trim(), /\| 무엇이 막았나 \|$/, '해소 칸이 안 채워졌다');
});

test('add — 날 파이프만 치환하고 백틱 안은 남긴다', () => {
  const L = mkLedger();
  run(L, ['add', '마찰', '표가 a | b 로 깨진다 — 원인은 `x|y` 표기']);
  const 행 = rowsOf(L)[2];
  assert.ok(!행.includes('a | b'), '날 파이프가 그대로 들어가면 장부가 파싱 불가가 된다');
  assert.ok(행.includes('`x|y`'), '백틱 안까지 삼키면 파이프를 설명하는 신고문 자체를 못 쓴다');
});

test('실장부 — 칸이 밀린 행 0 (탐지력은 위 픽스처가 진다)', () => {
  const real = require(TOOL);
  const 밀림 = fs.readFileSync(path.join(__dirname, '..', 'docs', '_ops', '마찰신호.md'), 'utf8')
    .split('\n')
    .map((l) => /^\|\s*(F\d+)\s*\|(.*)\|\s*$/.exec(l.trim()))
    .filter(Boolean)
    .filter((m) => real.splitCells(m[2]).length > 4)
    .map((m) => m[1]);
  assert.deepEqual(밀림, [], '실장부에 칸이 밀린 행이 있다 — 그 행의 신호는 해소로 읽혀 아무도 못 본다');
});

/* 🔑 게이트가 실제로 쓰는 조건 그대로 잰다 — `주장 && !해소칸`(friction.js add).
 * 옛 판은 `resolved && 주장` 이라 **정반대**를 쟀다: 해소 칸을 제대로 채운 행이라도 신고문에
 * 고친 내용을 적으면(장부 규약이 권하는 서술이다) 걸렸고, 그때마다 예외 목록에 id 를 하나씩
 * 더하는 길밖에 없었다(F107 이 그 첫 줄이었다). 2026-08-08 실측: F258 이 그 두 번째로 걸려
 * master CI 가 10분간 적색 = **모두의 배포 게이트가 막혔다**. 제품이 안 하는 판정을 검사가
 * 혼자 하면, 늘어나는 것은 버그가 아니라 예외 목록이다. */
test('해소주장 판별식 — 실장부에서 거짓양성 0 (탐지력은 위 F107 픽스처 3건이 진다)', () => {
  const real = require(TOOL);
  const 행 = real.read().rows;
  assert.ok(행.length > 0, '실장부를 0행으로 읽었다 — 이 검사는 아무것도 안 재고 통과한다(분모 먼저)');
  // 게이트가 막는 조합 = 신고문은 해소를 지목하는데 해소 칸이 비었다. 그 행은 애초에 못 태어난다.
  const 오지목 = 행.filter((r) => !r.resolved && real.해소주장(r.signal));
  assert.deepEqual(오지목.map((r) => r.id), [],
    '열린 행이 신고문에서 해소를 지목한다 — 게이트를 통과했다면 게이트가 샌 것이고, 거짓양성이면 다음 사람이 게이트를 끈다');
});

/* ── 통로의 마지막 칸 (2026-08-07) ─────────────────────────────────────────────
 * 장부를 **커밋하는 자리가 통로 어디에도 없었다** — 도구는 편집만 하고, close-guard 는 커밋
 * 뒤에 짖고, auto-commit 은 이 파일을 의도적으로 제외한다. 그래서 커밋이 사람 손으로 넘어갔는데
 * 손은 「남의 미커밋은 그대로 둔다」에 막혀, 죽은 세션의 장부 행이 주인 없이 떠 있었다.
 * 실물: cb56e86 은 「메모리 인덱스 압축」 커밋인데 남의 장부 5행이 동승해 나갔다(주인 흐리기).
 * F025·F037·F073 은 셋 다 미커밋으로 떠 있는 **시간**에만 일어난다 — 아래가 그 시간을 잰다. */
const 장부경로 = path.join('docs', '_ops', '마찰신호.md');
/* 미커밋 잔재는 아카이브·조각 폴더 어느 쪽에 남아도 유물이다 — 둘 다 잰다 */
const 장부상태 = (repo) => git(repo, ['status', '--porcelain', '--', 장부경로, path.join('docs', '_ops', '장부')]).trim();

test('통로 마지막 칸 — add 가 장부를 그 자리에서 커밋한다(미커밋으로 안 남는다)', (t) => {
  let repos;
  try { repos = mkFixtureRepos(); }
  catch (e) { return t.skip('픽스처 저장소를 못 만들었다(git 없음?): ' + e.message); }

  const out = runIn(repos.A, ['add', '실수', '신고 하나']);
  assert.match(out, /F003/, 'add 자체가 실패했다: ' + out.trim());
  assert.equal(장부상태(repos.A), '',
    '장부를 쓰고 커밋하지 않았다 — 미커밋으로 뜬 채 남으면 죽은 세션의 유물이 된다: ' + out.trim());

  /* 깨끗한 장부에 혼자 한 줄 넣었으니 동승은 0 이다 — 여기서 「동승」이라 말하면 **거짓 경보**고,
   * 늘 뜨는 경보는 아무도 안 읽어 진짜 동승을 못 보게 만든다(F049 형태). 실측으로도 확인했다:
   * 이 수리의 첫 실사용(F211 신고 · 51eefe0)에서 동승 경보가 안 떴다. */
  assert.doesNotMatch(out, /동승/,
    '동승이 0 인데 동승했다고 말한다 — 거짓 경보가 상시화되면 진짜 동승이 그 소음에 묻힌다: ' + out.trim());

  const 제목 = git(repos.A, ['log', '-1', '--format=%s']).trim();
  /* 번호가 제목에 있어야 friction-close-guard 가 그대로 짖는다 — 「F0NN 을 모르는 통로가
   * 커밋하면 close-guard 를 우회한다」가 auto-commit 에 장부를 안 넣은 이유였다. */
  assert.match(제목, /F003/, 'F0NN 이 없는 커밋 제목 — close-guard 가 이 커밋을 못 읽는다: ' + 제목);
  /* 옛 `[배포]` 접두 검사는 뺐다 — 그 접두를 읽던 `deploy-live` 가 2026-08-12 에 폐지돼
   * 이제 아무 뜻도 없는 글자다. 뜻이 없어진 검사를 남기면 다음 사람이 그 통로가 아직
   * 산 줄로 읽는다(오늘 하루가 정확히 그 병을 고친 날이다 · F374). */
});

test('통로 마지막 칸 — resolve 도 그 자리에서 커밋한다', (t) => {
  let repos;
  try { repos = mkFixtureRepos(); }
  catch (e) { return t.skip('픽스처 저장소를 못 만들었다(git 없음?): ' + e.message); }

  runIn(repos.A, ['add', '실수', '닫을 신호']);
  const out = runIn(repos.A, ['resolve', 'F003', '훅이 막았다']);
  assert.match(out, /F003/, 'resolve 자체가 실패했다: ' + out.trim());
  assert.equal(장부상태(repos.A), '',
    'resolve 가 해소 칸만 채우고 커밋하지 않았다 — add 만 고치면 통로가 반쪽이다: ' + out.trim());
  assert.match(git(repos.A, ['log', '-1', '--format=%s']).trim(), /F003/, '해소 커밋에 번호가 없다');
});

test('통로 마지막 칸 — 남의 미커밋 행(옛 한-파일 잔재)은 싣지 않는다: 조각 커밋은 내 파일 하나다', (t) => {
  let repos;
  try { repos = mkFixtureRepos(); }
  catch (e) { return t.skip('픽스처 저장소를 못 만들었다(git 없음?): ' + e.message); }

  /* 옛 설계는 파일이 하나라 남의 행이 **강제로 동승**했고, 그 수를 세어 밝히는 것이 최선이었다
   * (cb56e86 실물). 조각 설계에선 내 커밋 = 내 조각 파일 하나 — 동승이라는 사건 자체가 없어야 한다.
   * 남의 미커밋은 그대로 남고(F073: 남의 작업본을 커밋하면 사고다), 내 조각만 깨끗이 커밋된다. */
  const 장부 = path.join(repos.A, 장부경로);
  const 원본 = fs.readFileSync(장부, 'utf8');
  fs.writeFileSync(장부, 원본.replace(/\n$/, '') + '\n| F009 | 2026-08-07 | 마찰 | 남의 행 | |\n', 'utf8');

  const out = runIn(repos.A, ['add', '실수', '내 신고']);
  assert.doesNotMatch(out, /동승/, '조각 커밋에 동승이 떴다 — 커밋 범위가 조각 밖으로 샜다: ' + out.trim());
  const 실린 = git(repos.A, ['show', '--name-only', '--format=', 'HEAD']).trim();
  assert.doesNotMatch(실린, /마찰신호/, '내 신고 커밋이 남의 미커밋 .md 편집을 쓸어 담았다: ' + 실린);
  assert.notEqual(git(repos.A, ['status', '--porcelain', '--', 장부경로]).trim(), '',
    '남의 .md 미커밋이 사라졌다 — 커밋됐으면 주인이 내 커밋으로 바뀐 것이다(F073)');
  assert.match(fs.readFileSync(장부, 'utf8'), /남의 행/, '남의 미커밋 행 내용이 사라졌다');
});

test('통로 마지막 칸 — 격리 장부(저장소 밖)는 커밋 층에 들어가지도 않는다', () => {
  const ROOT = path.join(__dirname, '..');
  const 전 = git(ROOT, ['rev-parse', 'HEAD']).trim();
  const out = run(mkLedger(), ['add', '실수', '격리 신고']);

  /* ⚠ 결과(HEAD 불변)만 재면 이 검사는 **아무것도 안 잰다** — 실측(변이): 저장소 밖 판정을 통째로
   *   지워도 git 이 저장소 밖 pathspec 을 거부해 HEAD 는 그대로였다. 즉 초록이 판정층이 아니라
   *   git 의 우연한 두 번째 방어선에서 나온다. 그래서 **판정층을 직접 겨냥한다**: 저장소 밖이면
   *   커밋 층에 발도 들이지 않으므로 커밋에 대해 아무 말도 하지 않는다(들어가면 「건너뜀」을 말한다).
   *   CLAUDE.md 「실패 안전을 외부 명령에 기대지 않는다」가 이 자리의 조항이다. */
  assert.doesNotMatch(String(out), /커밋/,
    '저장소 밖 장부인데 커밋 층까지 들어갔다 — 지금은 git 이 막아 무해하지만 그건 우연이다: ' + String(out).trim());
  assert.equal(git(ROOT, ['rev-parse', 'HEAD']).trim(), 전,
    '회귀가 실저장소를 커밋했다 — 기록을 오염시킨 회귀는 그 기록을 증거로 못 쓰게 만든다');
});

/* ── 조각 설계 (F250 후반 · 2026-08-08) ─────────────────────────────────────────
 * 행은 조각 파일(장부/F0NN.md) 하나로 살고, 옛 한 파일(.md)은 동결 아카이브다.
 * 아래 회귀의 공통 급소: **아카이브 쓰기 0** — 여기가 한 줄이라도 깨지면
 * 「모든 세션이 한 파일을 고친다」(마찰 18건의 뿌리)로 되돌아간다. */

test('🔑 동결 — add 는 아카이브(.md)를 한 바이트도 안 고친다 (행은 조각 파일로 태어난다)', () => {
  const L = mkLedger();
  const 전 = fs.readFileSync(L, 'utf8');
  run(L, ['add', '실수', '조각 신호']);
  assert.strictEqual(fs.readFileSync(L, 'utf8'), 전,
    '아카이브가 바뀌었다 — 「모든 세션이 한 파일을 고친다」로 되돌아간 것이다');
  assert.ok(fs.existsSync(path.join(path.dirname(L), '장부', 'F003.md')),
    '조각 파일이 없다 — 행이 어디에도 안 실렸다(신고문 유실)');
});

test('🔑 그림자 — 아카이브의 열린 행을 닫아도 아카이브는 불변, 같은 번호의 조각이 이긴다', () => {
  const L = mkLedger();
  const 전 = fs.readFileSync(L, 'utf8');
  run(L, ['resolve', 'F002', '훅이 막았다']);
  assert.strictEqual(fs.readFileSync(L, 'utf8'), 전, '동결 아카이브를 고쳤다 — 그림자가 아니라 제자리 수정을 했다');
  assert.match(fs.readFileSync(path.join(path.dirname(L), '장부', 'F002.md'), 'utf8'), /훅이 막았다/,
    '그림자 조각이 안 생겼다');
  const out = run(L, []);
  assert.ok(out.includes('해소 2'), '조각이 아카이브를 못 이겼다 — F002 가 여전히 열린 것으로 집계된다: ' + out);
  assert.ok(out.includes('전체 2건'), '같은 번호가 두 행으로 늘었다(겹침 해소 실패): ' + out);
});

test('선점된 번호는 건너뛴다 — 조각 폴더의 번호도 채번이 본다 (신고문은 버리지 않는다)', () => {
  const L = mkLedger();
  const dir = path.join(path.dirname(L), '장부');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'F003.md'), '| F003 | 2026-08-08 | 마찰 | 선점 조각 | |\n');
  const out = run(L, ['add', '실수', '비켜 실릴 신호']);
  assert.match(out, /F004/, '다음 번호로 안 비켰다: ' + out.trim());
  assert.match(fs.readFileSync(path.join(dir, 'F004.md'), 'utf8'), /비켜 실릴 신호/, '신고문이 버려졌다');
  assert.match(fs.readFileSync(path.join(dir, 'F003.md'), 'utf8'), /선점 조각/, '선점 조각을 덮어썼다');
});

test('못 읽음 ≠ 없다 — 행 없는 조각 파일은 열린 신호로 서서 소리가 난다', () => {
  const L = mkLedger();
  const dir = path.join(path.dirname(L), '장부');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'F050.md'), '깨진 내용\n');
  const out = run(L, ['--open']);
  assert.ok(out.includes('F050'),
    '깨진 조각이 조용히 사라졌다 — 「없다」로 번역하면 close-guard 가 그 번호에 영원히 침묵한다: ' + out);
});

test('다음 번호는 다른 ref 의 조각 폴더가 쓴 번호도 넘어선다 (아카이브만 훑으면 조각 번호끼리 충돌한다)', (t) => {
  let repos;
  try { repos = mkFixtureRepos(); }
  catch (e) { return t.skip('픽스처 저장소를 못 만들었다(git 없음?): ' + e.message); }
  const dir = path.join(repos.A, 'docs', '_ops', '장부');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'F077.md'), '| F077 | 2026-08-08 | 마찰 | 조각으로만 있는 번호 | |\n');
  git(repos.A, ['add', '--', dir]);
  git(repos.A, ['commit', '-m', '조각 F077']);
  git(repos.A, ['push', '-q', 'origin', 'master']);
  const out = runIn(repos.B, ['add', '실수', 'B 의 신호']);   // B 는 fetch 로 origin/master 의 조각을 본다
  assert.match(out, /F078/, 'origin 의 조각 번호를 못 봤다 — 채번이 아카이브(F250에서 멈춘 판)만 훑고 있다: ' + out.trim());
});

/* ── 🔴 F296 — 신고문을 **셸에 맡길 수 없는데** 파일 통로가 없었다 (2026-08-09 실측) ────────
 * 지침은 「여러 줄이거나 코드·정규식을 인용하는 문자열은 셸에 맡기지 말고 파일로 준다」인데
 * 이 도구엔 그 통로가 없었다. 그래서 `--파일` 을 넘겨 봤고, 파서는 **모르는 토큰을 신고문으로
 * 접어** 옵션 이름과 경로를 그대로 장부에 실은 뒤 커밋까지 했다. 증상이 없다 — 도구는 성공을
 * 찍고 행은 태어난다. 두 구멍이 한 사건이다: ①따를 수 없는 처방(F103) ②모르면 통과. */
test('🔴 [F296] 모르는 옵션은 **신고문으로 접히지 않는다** — 막고 말한다', () => {
  const ledger = mkLedger();
  const r = run(ledger, ['add', '마찰', '--없는옵션', '값', '진짜 신고문'], true);
  assert.ok(r.failed, '🔴 모르는 옵션을 삼켰다 — 그 토큰이 그대로 장부 본문이 된다(F296 그 사고)');
  assert.match(r.stderr, /--없는옵션/, '무엇이 모르는 옵션인지 안 말하면 고칠 자리를 못 찾는다');
  assert.strictEqual(rowsOf(ledger).length, 2, '🔴 막았다면서 행은 태어났다 — 쓰레기 행이 남는다');
});

test('🔴 [F296] `--파일` 로 준 신고문이 그대로 행이 된다 (백틱·따옴표가 들어도)', () => {
  const ledger = mkLedger();
  const 본문 = '훅이 `assert.match(사유, /첫 선언 1줄/)` 에서 깨진다 — "따옴표"와 백틱이 든 글이다';
  const p = path.join(path.dirname(ledger), '신고문.txt');
  fs.writeFileSync(p, `${본문}\n`, 'utf8');
  run(ledger, ['add', '마찰', '--파일', p]);
  const 새행 = rowsOf(ledger).at(-1);
  assert.match(새행, /assert\.match/, `🔴 파일 내용이 행에 안 실렸다:\n${새행}`);
  assert.match(새행, /따옴표/, '따옴표가 든 조각이 잘렸다 — 셸을 피하려고 만든 통로가 같은 손실을 낸다');
  assert.ok(!/--파일/.test(새행), '🔴 옵션 이름이 본문에 남았다 — F296 그대로다');
});

test('🔴 [F296] 인자와 `--파일` 을 **둘 다** 주면 막는다 — 어느 쪽이 정본인지 갈린다', () => {
  const ledger = mkLedger();
  const p = path.join(path.dirname(ledger), '신고문2.txt');
  fs.writeFileSync(p, '파일 쪽 본문\n', 'utf8');
  const r = run(ledger, ['add', '마찰', '인자 쪽 본문', '--파일', p], true);
  assert.ok(r.failed, '🔴 둘 다 받고 하나를 조용히 버렸다 — 버린 쪽은 아무도 못 본다');
  assert.strictEqual(rowsOf(ledger).length, 2, '막았다면서 행은 태어났다');
});

test('🔴 [F296] `--파일` 을 못 읽으면 **빈 행을 만들지 않는다**', () => {
  const ledger = mkLedger();
  const r = run(ledger, ['add', '마찰', '--파일', path.join(path.dirname(ledger), '없는파일.txt')], true);
  assert.ok(r.failed, '🔴 못 읽었는데 계속 갔다 — 빈 신고문 행이 장부에 남는다');
  assert.strictEqual(rowsOf(ledger).length, 2, '못 읽었는데 행이 태어났다');
});

/* ── 🔴 F301 — 위 수리가 `add` 만 고쳐서 **옆자리에서 그대로 재발했다** (2026-08-09 실측) ────
 * `resolve` 는 `args.slice(2).join(' ')` 이라 모르는 플래그도 해소문으로 접었다. 실제로
 * `resolve F300 --파일 <경로>` 를 줬더니 해소 칸이 통째로 「--파일 C:/…/해소.txt」가 되어
 * 커밋까지 갔다(5fd6800a). 같은 도구·같은 파서 결함·다른 서브명령 — 세 번째를 막으려면
 * 호출부마다 고치는 게 아니라 **한 곳에서 파생시킨다**(CLAUDE.md 신뢰성: 3번째 = 원인을
 * 쓸 수 없게 만든다). 그래서 아래 넷은 `add` 쪽 넷과 **짝**이다: 한쪽만 초록이면 갈라진 것이다. */
function 해소용장부() {
  const ledger = mkLedger();
  run(ledger, ['add', '마찰', '닫을 신호']);
  const id = (rowsOf(ledger).at(-1).match(/F\d{3}/) || [])[0];
  return { ledger, id };
}
/* `rowsOf` 의 ⚠ 를 그대로 상속한다 — 이건 장부 표의 한 «칸»이라 `코드만()` 대상이 아니다(ⓑ+ⓒ · #Q72). */
const 해소칸 = (ledger, id) => (rowsOf(ledger).find((r) => r.includes(id)) || '').split('|').at(-2) || '';

test('🔴 [F301] resolve: 모르는 옵션은 **해소문으로 접히지 않는다** — 막고 말한다', () => {
  const { ledger, id } = 해소용장부();
  const r = run(ledger, ['resolve', id, '--없는옵션', '값', '진짜 해소문'], true);
  assert.ok(r.failed, '🔴 모르는 옵션을 삼켰다 — 그 토큰이 그대로 해소 칸이 된다(F301 그 사고)');
  assert.match(r.stderr, /--없는옵션/, '무엇이 모르는 옵션인지 안 말하면 고칠 자리를 못 찾는다');
  assert.ok(!/없는옵션/.test(해소칸(ledger, id)), '🔴 막았다면서 해소 칸이 오염됐다');
});

test('🔴 [F301] resolve: `--파일` 로 준 해소문이 그대로 칸이 된다 (백틱·따옴표가 들어도)', () => {
  const { ledger, id } = 해소용장부();
  const 본문 = '`--if-exists "$MODE"` 로 바꿨다 — "따옴표"와 백틱이 든 글이다';
  const p = path.join(path.dirname(ledger), '해소문.txt');
  fs.writeFileSync(p, `${본문}\n`, 'utf8');
  run(ledger, ['resolve', id, '--파일', p]);
  const 칸 = 해소칸(ledger, id);
  assert.match(칸, /if-exists/, `🔴 파일 내용이 해소 칸에 안 실렸다:\n${칸}`);
  assert.ok(!/--파일/.test(칸), '🔴 옵션 이름이 해소문에 남았다 — F301 그대로다');
});

test('🔴 [F301] resolve: 인자와 `--파일` 을 둘 다 주면 막는다', () => {
  const { ledger, id } = 해소용장부();
  const p = path.join(path.dirname(ledger), '해소문2.txt');
  fs.writeFileSync(p, '파일 쪽 해소문\n', 'utf8');
  const r = run(ledger, ['resolve', id, '인자 쪽 해소문', '--파일', p], true);
  assert.ok(r.failed, '🔴 둘 다 받고 하나를 조용히 버렸다 — 버린 쪽은 아무도 못 본다');
});

test('🔴 [F301] resolve: `--파일` 을 못 읽으면 **행을 닫지 않는다**', () => {
  const { ledger, id } = 해소용장부();
  const r = run(ledger, ['resolve', id, '--파일', path.join(path.dirname(ledger), '없는파일.txt')], true);
  assert.ok(r.failed, '🔴 못 읽었는데 계속 갔다 — 빈 해소문으로 행이 닫힌다(안 고쳤는데 닫음 = F092)');
  assert.strictEqual(해소칸(ledger, id).trim(), '', '못 읽었는데 행이 닫혔다');
});

/* ── [F371] 셸이 «말을 바꿔치기한» 흔적 — F297·F301 과 같은 계열의 세 번째 (2026-08-12 실측)
 * Git Bash(MSYS)는 `/close` 처럼 슬래시로 시작하는 토큰을 경로로 자동 변환한다. 따옴표로도
 * 안 막히고, 도구는 **성공을 찍는다** — 스킬 이름이 `C:/Program Files/Git/close` 로 앉은 줄은
 * 사람만 안다. 앞의 둘과 새는 방향이 같다: 「통과」. 실제로 F371 해소문이 그렇게 저장됐다. */

test('☠️ [F371] 셸이 바꾼 경로가 든 **해소문**을 거부한다 — 통과시키면 스킬 이름이 경로로 앉고 증상이 없다', () => {
  const L = mkLedger();
  const r = run(L, ['add', '마찰', '신고문', '--해소', 'C:/Program Files/Git/close 3-b 신설'], true);
  assert.ok(r.failed, '🔴 셸이 바꾼 말을 그대로 실었다 — 이게 F371 이 난 경로다');
  assert.match(r.stderr, /바꿔치기|셸이/, '왜 막혔는지 안 알려주면 다음 사람이 같은 자리에서 막힌다');
  assert.match(r.stderr, /해소파일|PowerShell/, '처방이 없다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103)');
  assert.strictEqual(rowsOf(L).length, 2, '거부했는데 행이 태어났다 — 막기 전에 이미 쓴 것이다');
});

test('☠️ [F371] **신고문** 쪽도 같이 막는다 — 한쪽만 고치는 것이 정확히 F301 이었다', () => {
  const L = mkLedger();
  const r = run(L, ['add', '실수', 'C:/Program Files/Git/deploy 를 돌렸더니'], true);
  assert.ok(r.failed, '🔴 해소문만 막고 신고문은 뚫려 있다 — 옆자리를 안 고친 그 실패다');
  assert.strictEqual(rowsOf(L).length, 2, '거부했는데 행이 태어났다');
});

test('🔑 [F371] 거짓양성 0 — 진짜 경로 인용과 스킬 이름 원문은 «그대로» 지난다', () => {
  const L = mkLedger();
  /* 이 셋이 막히면 가드가 장부를 못 쓰게 만든다 — 탐지력보다 이쪽이 먼저 저장소를 죽인다. */
  run(L, ['add', '마찰', '`/close` 3-b 신설 · tests/종결배포결속.test.js 5건']);
  run(L, ['add', '실수', 'C:/Users/q1212/Documents/SYNK-talk 에서 돌렸다']);
  run(L, ['add', '교정', 'C:/Program Files/nodejs/node.exe 로 실행된다']);
  assert.strictEqual(rowsOf(L).length, 5, '정상문 3건이 다 들어가야 한다(거짓양성이면 여기서 죽는다)');
});

test('🔑 [F371] `--해소파일` 통로가 실제로 «닿는다» — 막기만 하고 길을 안 내면 처방이 거짓이 된다', () => {
  const L = mkLedger();
  const p = path.join(path.dirname(L), '해소문F371.txt');
  fs.writeFileSync(p, '`/close` 3-b 신설 = 배포대조의 발동\n', 'utf8');
  run(L, ['add', '마찰', '신고문', '--해소파일', p]);
  const rows = rowsOf(L);
  assert.strictEqual(rows.length, 3, '파일 통로로 준 해소문이 행을 못 만들었다');
  assert.ok(rows[2].includes('/close') && rows[2].includes('배포대조의 발동'),
    '해소문이 안 실렸다 — 에러 메시지가 가리킨 처방이 실제로는 안 되는 상태다(F103)');
});

/* ── [F386] 세 번째 상태 「보류」 ────────────────────────────────────────────
 * 장부는 두 상태뿐이었다(해소 / 열림). 그런데 가장 흔한 제3의 결론은 **「판정했다.
 * 지금은 안 닫는다」** 다 — `/evolve` v8.7 이 12건을 그렇게 판정하고 이유까지 적었는데
 * 장부엔 그걸 적을 칸이 없어 판정이 장부 밖에만 남았고, 08-12 하루에 두 세션이 같은
 * 12건을 「미측정」으로 다시 쟀다. 지키려는 성질 넷:
 *   ①보류는 열림에서 빠지되 **살아있음에는 남는다**(결함은 서 있다 — 해소로 새면 F092 다)
 *   ②보류 → 해소 전이가 «된다»(영구 봉인이면 고친 세션이 닫을 통로를 잃는다)
 *   ③해소 → 보류 역행은 «안 된다»(닫힌 판정을 되무르는 통로를 열지 않는다)
 *   ④새 통로도 옛 관문(빈 값·중복·모르는 플래그·파일 통로)을 그대로 지난다 — 통로를 옆에
 *     내면서 관문을 안 태우는 것이 정확히 F297→F301 의 형태다(옆자리를 안 고쳤다). */

test('🔑 [F386] defer — 보류는 열림에서 빠지고 살아있음에는 남는다', () => {
  const L = mkLedger();
  run(L, ['defer', 'F002', '/evolve v8.7 판정=안 닫음 · 근거 docs/지침_이력.md:492']);
  const out = run(L, []);
  assert.ok(out.includes('살아있음 1'), '보류가 살아있음에서 빠졌다 — 결함은 아직 서 있는데 해소로 샌 것이다(F092)');
  assert.ok(out.includes('열림 0'), `보류가 열림으로 세어졌다 — /evolve 알림 포화가 그대로다:\n${out}`);
  assert.ok(out.includes('보류 1'), '보류 칸이 안 보인다');
  const open = run(L, ['--open']);
  assert.ok(!open.includes('둘째 신호'), '--open 이 보류를 낸다 — 다음 세션이 판정된 것을 다시 잰다');
  assert.ok(run(L, ['--보류']).includes('지침_이력'), '--보류 가 판정 사유(어디서 판정했나)를 안 낸다');
});

test('🔑 [F386] 보류 → 해소 전이는 되고, 해소 → 보류 역행은 막힌다', () => {
  const L = mkLedger();
  run(L, ['defer', 'F002', '아직 기계가 없다 · v8.7 판정']);
  const r = run(L, ['resolve', 'F002', 'tools/새가드.js + 회귀 3건']);
  assert.ok(r.includes('보류였다'), '보류→해소 전이인데 그 사실을 안 알렸다');
  assert.ok(rowsOf(L)[1].includes('tools/새가드.js'), '보류가 영구 봉인이 됐다 — 고친 세션이 닫을 통로를 잃는다');
  assert.ok(!rowsOf(L)[1].includes('⏸'), '해소로 올렸는데 보류 표식이 남았다 — 집계가 갈린다');
  assert.ok(run(L, ['defer', 'F001', '되무르기'], true).failed, '이미 해소된 행을 보류로 되돌렸다');
  assert.ok(rowsOf(L)[0].includes('memory/x'), '기존 해소 기록이 보존돼야 한다');
});

test('🔑 [F386] defer 도 옛 관문을 그대로 지난다 — 빈 사유·중복·모르는 플래그', () => {
  const L = mkLedger();
  assert.ok(run(L, ['defer', 'F002', ''], true).failed, '빈 보류 사유가 들어가면 「어디서 판정했나」가 사라진다');
  assert.ok(run(L, ['defer', 'F999', '사유'], true).failed, '없는 ID를 보류했다');
  assert.ok(run(L, ['defer', 'F002', '--모르는것', '사유'], true).failed,
    '모르는 플래그를 사유로 접었다 — F297 이 새 통로에서 그대로 재발한다');
  run(L, ['defer', 'F002', '첫 판정']);
  assert.ok(run(L, ['defer', 'F002', '둘째 판정'], true).failed, '이미 보류인 행을 덮어썼다 — 앞 판정이 소리 없이 사라진다');
  assert.ok(rowsOf(L)[1].includes('첫 판정'), '앞 판정이 보존돼야 한다');
});

test('🔑 [F386] defer --파일 통로가 실제로 «닿는다» (처방이 거짓이면 우회가 정상 통로가 된다 · F103)', () => {
  const L = mkLedger();
  const p = path.join(path.dirname(L), '보류사유.txt');
  fs.writeFileSync(p, '/evolve v8.7 판정 — `docs/지침_이력.md:492` 에 이유가 있다\n', 'utf8');
  run(L, ['defer', 'F002', '--파일', p]);
  assert.ok(rowsOf(L)[1].includes('지침_이력.md:492'), '파일 통로로 준 보류 사유가 안 실렸다');
});

test('🔑 [F386] 실제 장부 — 세 상태가 겹치지 않고 합이 전체다 (거짓양성만 검사)', () => {
  const real = require(TOOL);
  const { rows } = real.read();
  const 열림 = rows.filter(real.열렸나).length;
  const 보류 = rows.filter(real.보류인가).length;
  const 해소 = rows.filter(real.해소됐나).length;
  assert.strictEqual(열림 + 보류 + 해소, rows.length,
    `상태 판정이 겹치거나 빠졌다 — 열림 ${열림} + 보류 ${보류} + 해소 ${해소} ≠ 전체 ${rows.length}`);
  assert.strictEqual(rows.filter(real.살아있나).length, 열림 + 보류,
    '살아있음이 열림+보류와 갈렸다 — 두 곳에서 세면 갈라진다');
});

// ── F596 「남이 고쳐 놓고 안 닫은 행」 표식 ──────────────────────────────────
// 지키려는 성질: ①고침 커밋만 센다 ②못 쟀다 ≠ 0건 ③origin/master 에 담긴 것만
// ④번호 접두 오탐 금지 ⑤**자동으로 안 닫는다**(표식이지 판정이 아니다 · F092)

test('🔑 [F596] 고침 제목만 센다 — 신고·보류·보드 커밋은 번호를 달아도 «안 고친 것»이다', () => {
  const { 고침제목 } = require(TOOL);
  for (const s of ['fix: 무엇을 고쳤다 (F544)', 'feat: 무엇을 지었다', 'perf: 빠르게', 'refactor: 통로 하나로',
    'fix(가드): 괄호 범위형도 고침이다']) {
    assert.ok(고침제목(s), `고침인데 안 센다: ${s}`);
  }
  /* 🔴 거짓양성 방향이 급소다 — 이 셋이 걸리면 살아있는 행 «전부»가 매번 표식을 달아
     신호가 소음이 된다(신고·보류·보드 커밋은 모든 행에 딸려 들어간다). */
  for (const s of ['docs: 마찰 F544 신고 — 무엇이 샜다', 'docs: 마찰 F544 보류 — 왜 지금 안 닫나',
    'docs: 보드 61375a0b — F544 를 집었다', 'test: F544 회귀 추가', 'chore: F544 정리',
    '  이 문장 안에 fix: 가 들어 있다']) {
    assert.ok(!고침제목(s), `고침이 아닌데 센다: ${s}`);
  }
});

test('🔑 [F596] 못 쟀다는 0건이 아니다 — git 이 죽으면 null 이다 (F207)', () => {
  const { 착지한고침 } = require(TOOL);
  assert.strictEqual(착지한고침(['F001'], { 실행: () => null }), null,
    'git 실패를 «표식 0건»으로 접었다 — 못 잰 판이 「고쳐진 게 없다」와 같은 모양이 된다');
  /* 빈 목록은 물어볼 것이 없다 — git 을 부르지도 않는다(0건이 맞는 침묵). */
  let 불렀나 = false;
  const 빈 = 착지한고침([], { 실행: () => { 불렀나 = true; return ''; } });
  assert.strictEqual(빈.size, 0);
  assert.ok(!불렀나, '물어볼 행이 0인데 git 을 불렀다');
});

test('🔑 [F596] «origin/master 에 담긴 것»만 본다 — 남이 지금 도는 트랙을 「착지」로 읽으면 안 된다', () => {
  const { 착지한고침 } = require(TOOL);
  let 받은인자 = null;
  착지한고침(['F001'], { 실행: (args) => { 받은인자 = args; return ''; } });
  assert.ok(받은인자 && 받은인자.includes('origin/master'),
    'origin/master 를 안 지정했다 — 로컬 가지·남의 워크트리 커밋이 「이미 착지」로 읽힌다');
});

test('🔑 [F596] 번호 접두 오탐 금지 — F54 가 F549 에 걸리면 표식이 통째로 거짓이다', () => {
  const { 착지한고침 } = require(TOOL);
  const 로그 = ['aaa1111\x1ffix: 무엇을 고쳤다 (F549)'].join('\n');
  const m = 착지한고침(['F54', 'F549'], { 실행: () => 로그 });
  assert.ok(m.has('F549'), 'F549 를 못 잡는다');
  assert.ok(!m.has('F54'), 'F54 가 F549 의 앞자리에 걸렸다 — 엉뚱한 행에 「닫혔을 수 있다」가 붙는다');
});

test('🔑 [F596] 고침이 아닌 커밋은 표식을 못 만든다 (분모가 아니라 갈래가 틀리면 전부 걸린다)', () => {
  const { 착지한고침 } = require(TOOL);
  const 로그 = [
    'bbb2222\x1fdocs: 마찰 F001 신고 — 무엇이 샜다',
    'ccc3333\x1fdocs: 보드 abcd1234 — F001 착수',
  ].join('\n');
  assert.strictEqual(착지한고침(['F001'], { 실행: () => 로그 }).size, 0,
    '기록 커밋이 「이미 닫혔을 수 있다」를 만든다 — 모든 행이 매번 걸려 신호가 죽는다');
});

test('🔴 [F596] --open 은 «표식»이지 판정이 아니다 — 장부 바이트를 한 글자도 안 바꾼다 (F092)', () => {
  /* 실측 반례가 같은 판에 있었다: F544 는 `fix:…(F544)` 가 착지했는데도 그 커밋이 처방 셋 중
     하나만 넣어 **정당하게 열려 있었다**. 자동으로 닫았으면 살아 있는 결함을 지웠을 것이다. */
  const L = mkLedger();
  const 전 = fs.readFileSync(L, 'utf8');
  run(L, ['--open']);
  assert.strictEqual(fs.readFileSync(L, 'utf8'), 전,
    '--open 이 장부를 고쳤다 — 표식이 자동 닫기로 넘어갔다');

  const 소스 = fs.readFileSync(TOOL, 'utf8');
  const a = 소스.indexOf('function report(mode)');
  const b = 소스.indexOf('function 언급된파일', a + 1);
  assert.ok(a >= 0 && b > a, 'report 구간을 못 찾았다 — 이 검사가 눈이 멀었다');
  assert.ok(!/resolve\s*\(|withLock\s*\(|writeFileSync/.test(소스.slice(a, b)),
    'report 가 장부를 쓰는 통로를 들었다 — 표식은 읽기만 해야 한다');
});

test('🔑 [F596] --open 이 대조를 실제로 «부른다» — 함수만 두고 안 부르면 조용히 옛 목록이다', () => {
  const 소스 = fs.readFileSync(TOOL, 'utf8');
  const a = 소스.indexOf('function report(mode)');
  const b = 소스.indexOf('function 언급된파일', a + 1);
  const 몸통 = 소스.slice(a, b);
  assert.match(몸통, /착지한고침\(/, 'report 가 착지 대조를 안 부른다');
  assert.match(몸통, /착지 === null/, '못 쟀다 갈래를 화면에서 안 가른다(0건과 같은 모양이 된다 · F207)');
  assert.match(몸통, /착지 표식 \$\{[^}]*\}\/\$\{/, '표식 수를 분모 없이 낸다(유호 확정 08-14)');
});
