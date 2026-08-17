/* 고아 index.lock 회귀 — 「곧 풀린다」와 「영영 안 풀린다」를 가르는가 (F493).
 *
 * 왜 있나: 2026-08-16 실측에서 `.git/index.lock` 이 **9시간 8분** 살아 이 저장소의 커밋이
 *   0건이었다(`639ee650` 23:15:12 → `9f4c80bb` 08:24:24). 그동안 수거기들이 낸 말은
 *   「미커밋 그대로, 다음 실행이 다시 시도한다」 — 경합일 때 참이고 고아일 때 거짓인 문장이다.
 *   지침 v9.2 맹점 ④(맞는 얼굴로 틀린 값)의 교과서 자리라, 여기서는 **말하는 쪽**과
 *   **입 다무는 쪽**을 같은 무게로 못박는다. 오경보가 나면 이 장치는 곧 안 읽히게 되고,
 *   그러면 9시간짜리 침묵이 그대로 돌아온다.
 *
 * 🔴 이 스위트가 지키는 계약 셋:
 *   ① 늙은 잠금은 **말한다**(그리고 지우지 않는다 — 삭제는 비가역이고 진짜 도는 git 을 죽인다).
 *   ② 어린 잠금·잠금 없음은 **침묵한다**(재시도가 실제로 통하는 판이다).
 *   ③ 못 쟀으면 **못 쟀다고 말한다** — 「없다」로 접지 않는다(0은 분모와 함께 · F207).
 *
 * 검사 방식 — 픽스처 저장소만. 실저장소의 잠금 상태는 회차마다 달라(세션 10개 동시) 불안정
 *   테스트가 되고, repo 밖 환경에 기댄 검사는 CI 에서 깨진다(F296).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process'); // git 재현용 — node 자식은 훅띄우기로
const { 훅띄우기 } = require('./lib/훅띄우기');

const 잠금lib = require(path.resolve(__dirname, '..', 'tools', 'lib', 'git잠금.js'));
const 수거도구 = path.resolve(__dirname, '..', 'tools', '인계문수거.js');
const store = require(path.resolve(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js'));

const git있나 = (() => { const r = spawnSync('git', ['--version'], { encoding: 'utf8' }); return !r.error && r.status === 0; })();

const 폴더 = 'docs/_ops/인계문';
const 목차 = 'docs/_ops/인계문.md';

const 임시들 = [];
function 픽스처() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lock-repo-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lock-state-'));
  임시들.push(repo, state);
  const g = (...a) => spawnSync('git', ['-c', 'core.quotepath=false', ...a], { cwd: repo, encoding: 'utf8' });
  g('init', '-q');
  g('config', 'user.name', 't'); g('config', 'user.email', 't@t'); g('config', 'commit.gpgsign', 'false');
  fs.mkdirSync(path.join(repo, 폴더), { recursive: true });
  fs.writeFileSync(path.join(repo, 목차), '# 목차 seed\n');
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
  g('add', '-A'); g('commit', '-qm', 'seed');
  return { repo, state, g };
}
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

/** 잠금을 놓고 나이를 먹인다. 나이는 mtime 이므로 그것만 뒤로 민다. */
function 잠금두기(repo, 분전) {
  const p = path.join(repo, '.git', 'index.lock');
  fs.writeFileSync(p, '');
  const t = new Date(Date.now() - 분전 * 60000);
  fs.utimesSync(p, t, t);
  return p;
}
function 심장박동(state, repo, sid, 분전) {
  const p = path.join(state, `track-${store.projectKey(repo)}-${store.safeId(sid)}.json`);
  fs.writeFileSync(p, JSON.stringify({ baseline: 'x', lastHead: 'x', touched: [], warned: [] }));
  const t = new Date(Date.now() - 분전 * 60000);
  fs.utimesSync(p, t, t);
}

/* ── 프로세스 층은 «주입»으로만 잰다 (F562) ────────────────────────────────────────
 * 실기계의 도는 git 은 회차마다 다르고(세션 10개 동시 · 테스트 자신도 git 을 띄운다), repo 밖
 * 환경에 기댄 검사는 CI 에서 깨진다(F296). 그래서 탐지력은 **전부 픽스처**가 지고, 실기계 경로는
 * 어디서도 안 탄다. 주입은 도구 자신의 정규화를 그대로 지나므로 모양이 두 곳에 갈리지 않는다. */

/** F562 실사고 그 모양 — pre-commit 22행이 띄운 자식, 부모는 죽었고 CPU 는 멎었다. */
const 고아판 = { git: [{ pid: 24364, ppid: 30384, cmd: 'git diff --cached --name-only -z --diff-filter=ACMR', cpu: 0 }], pids: [1, 2, 3] };
/** 진짜 일하는 git — 부모가 살아있다(pid 2 가 목록에 있다). */
const 산판 = { git: [{ pid: 500, ppid: 2, cmd: 'git gc --auto', cpu: 0 }], pids: [1, 2, 3] };
/** 부모는 죽었는데 CPU 가 오른다 = 살아있다(㉡ 재료 단독 검증용). */
const 태우는판 = { a: { git: [{ pid: 777, ppid: 999, cmd: 'git clone https://…', cpu: 0 }] },
  b: { git: [{ pid: 777, ppid: 999, cmd: 'git clone https://…', cpu: 850 }] }, pids: [1, 2, 3] };
const 빈판 = { git: [], pids: [1, 2, 3] };

/** 주입을 걸고 본문을 돌린다. 표본 간격은 **호출부가** 0을 준다(기본값은 모듈 적재 때 굳는다). */
function 프로세스판(픽스처, 본문) {
  const 옛 = process.env.SYNK_GIT_LOCK_PROC;
  process.env.SYNK_GIT_LOCK_PROC = typeof 픽스처 === 'string' ? 픽스처 : JSON.stringify(픽스처);
  try { return 본문(); } finally {
    if (옛 === undefined) delete process.env.SYNK_GIT_LOCK_PROC; else process.env.SYNK_GIT_LOCK_PROC = 옛;
  }
}
/** 하위 프로세스(훅·도구)에 같은 주입을 넘기는 env 조각. */
function 주입env(픽스처) {
  return { SYNK_GIT_LOCK_PROC: JSON.stringify(픽스처), SYNK_GIT_LOCK_SAMPLE_MS: '0' };
}

/* ── ① 상태 셋이 실제로 셋인가 ───────────────────────────────────────────────── */

test('🔑 잠금이 없으면 「없음」이다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  assert.equal(잠금lib.잠금상태(repo).상태, '없음');
});

test('🔑 잠금이 있으면 나이를 분으로 낸다 — mtime 기준', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  잠금두기(repo, 137);
  const s = 잠금lib.잠금상태(repo);
  assert.equal(s.상태, '있음');
  assert.ok(Math.abs(s.나이분 - 137) < 1, `137분을 기대했는데 ${s.나이분}`);
});

test('🔴 못 쟀으면 「없음」이 아니라 「못쟀다」다 — 모름을 0으로 접지 않는다(F207)', () => {
  const 빈곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lock-nogit-'));
  임시들.push(빈곳);
  const s = 잠금lib.잠금상태(빈곳);
  assert.equal(s.상태, '못쟀다', 'git 저장소가 아닌 곳에서 「없음」을 내면 그 침묵이 «깨끗함»으로 읽힌다');
});

/* ── ② 말하는 쪽 ─────────────────────────────────────────────────────────────── */

test('🔑 탐지 — 문턱을 넘은 잠금은 말한다(F493 그 모양: 9시간)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  잠금두기(repo, 548);                                    // 9시간 8분 = 실사고와 같은 나이
  const 줄 = 프로세스판(고아판, () => 잠금lib.고아잠금줄(repo, { 표본간격ms: 0 }));
  assert.match(줄, /고아/, '이 한 줄이 없으면 「다음 실행이 다시 시도한다」가 9시간짜리 거짓말이 된다');
  assert.match(줄, /9시간 8분째/, '나이를 안 적으면 사람이 경합과 못 가른다 — 숫자가 곧 판정 재료다');
});

test('🔴 말만 한다 — 잠금 파일을 지우지 않는다(도는 git 을 죽이면 비가역이다)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  const p = 잠금두기(repo, 600);
  프로세스판(고아판, () => 잠금lib.고아잠금줄(repo, { 표본간격ms: 0 }));
  assert.ok(fs.existsSync(p), '이 장치가 지우기 시작하면 대형 checkout·gc 를 죽이는 사고가 된다');
});

test('🔴 «고아라고 판정한» 회차에도 안 지운다 — 가름이 늘어도 삭제는 사람 몫이다(🚫자동 삭제)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  const p = 잠금두기(repo, 600);
  const 줄 = 프로세스판(고아판, () => 잠금lib.고아잠금줄(repo, { 표본간격ms: 0 }));
  assert.match(줄, /가름 = 고아다/, '이 회차는 실제로 고아 판정이어야 한다 — 아니면 아래 검사가 무의미하다');
  assert.ok(fs.existsSync(p), 'F562 수리는 «가르기»의 자동화지 «지우기»의 자동화가 아니다');
});

test('🔑 처방이 실행 가능한 모양인가 — 확인 명령과 치울 경로를 함께 준다(F103)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  const p = 잠금두기(repo, 600);
  const 줄 = 프로세스판(고아판, () => 잠금lib.고아잠금줄(repo, { 표본간격ms: 0 }));
  assert.match(줄, /Remove-Item/, '「확인해라」만 있고 실행할 명령이 없으면 우회가 정상 통로가 된다');
  assert.ok(줄.includes(p), '치울 대상의 실제 경로가 없으면 사람이 워크트리에서 엉뚱한 파일을 지운다');
});

/* ── ③ 입 다무는 쪽 — 같은 무게로 건다(가드 맹점 ②) ──────────────────────────── */

test('🔑 거짓양성 — 어린 잠금(경합)엔 한 글자도 안 낸다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  잠금두기(repo, 0);
  assert.equal(잠금lib.고아잠금줄(repo), '', '경합일 때 「고아일 수 있다」고 말하면 매 세션 오경보가 되고, 그 장치는 곧 안 읽힌다');
});

test('🔑 거짓양성 — 문턱 바로 아래는 아직 경합이다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  잠금두기(repo, 9);
  assert.equal(잠금lib.고아잠금줄(repo, { 문턱분: 10 }), '');
});

test('🔑 실패문은 잠금을 말하는데 지금은 없다 = 그 사이 풀렸다 — 조용히 둔다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  const 줄 = 잠금lib.고아잠금줄(repo, { 실패문: "Unable to create '.../index.lock': File exists" });
  assert.equal(줄, '', '재시도가 실제로 통하는 판이라 여기서 떠들면 그 역시 거짓 경보다');
});

/* ── ④ 못 쟀을 때 — 셋째 칸이 실제로 서는가 ────────────────────────────────── */

test('🔴 잠금이 걸린 건 아는데 나이를 못 쟀으면 «안 가려졌다»고 말한다', () => {
  const 빈곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lock-nogit2-'));
  임시들.push(빈곳);
  const 줄 = 잠금lib.고아잠금줄(빈곳, { 실패문: "Unable to create 'index.lock': File exists" });
  assert.match(줄, /안 가려졌다/, '못 잰 회차와 「경합이다」가 같은 모양이면 이 장치는 F489 를 새로 만든다');
});

test('🔑 거짓양성 — 잠금과 무관한 실패엔 못 쟀어도 침묵한다', () => {
  const 빈곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lock-nogit3-'));
  임시들.push(빈곳);
  assert.equal(잠금lib.고아잠금줄(빈곳, { 실패문: 'pathspec did not match any files' }), '',
    '모든 실패에 잠금 얘기를 얹으면 진짜 잠금 사고 때 그 줄이 안 읽힌다');
});

/* ── ⑤ 실사용 통로 — 세션 시작에서 실제로 그 줄이 나오는가 ──────────────────── */

test('🔑 통합 — 고아 잠금에 막힌 인계문수거는 「다시 시도한다」 옆에 고아를 함께 말한다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  // 죽은 세션의 인계문 = 거둘 것이 실제로 있는 상태(없으면 도구가 커밋 자체를 안 한다)
  fs.writeFileSync(path.join(repo, 폴더, 'deadbeef.md'), '<!-- at:1 -->\n## 세션 deadbeef\n');
  심장박동(state, repo, 'local_deadbeef-1111-2222-3333-444444444444', 999);
  잠금두기(repo, 548);

  const r = 훅띄우기([수거도구, '--실행'], {
    encoding: 'utf8', 통과코드: [0, 2],
    env: { ...process.env, SYNK_OWNER_ROOT: repo, SYNK_CTXBUDGET_DIR: state, CLAUDE_CODE_HOST_SESSION_ID: 'local_aaaaaaaa', ...주입env(고아판) },
  });
  const out = String(r.stdout || '') + String(r.stderr || '');
  assert.match(out, /거두지 못했다/, '이 회차는 실제로 막혀야 한다 — 안 막히면 아래 검사가 무의미하다');
  assert.match(out, /고아/, '세션 시작에서 이 줄이 안 나오면 사람은 9시간 뒤에도 아무것도 모른다');
  assert.match(out, /가름 = 고아다/, '나이만 말하고 가름을 안 하면 처방 ②가 영영 안 켜진다(F562)');
});

/* ── ⑤-2 Stop 훅(auto-commit) — 결과가 가장 나쁜 자리다.
 *    수거기가 못 거두면 다음 세션이 다시 본다. 그런데 Stop 훅이 매 턴 「이번 턴은 물러난다」만
 *    하고 세션이 끝나면, 남는 것은 **무보호 미커밋**이다(F025 · F493 실측 68건).
 *    ⚠ 이 훅이 못 뜨면 모든 세션의 미커밋 보호가 함께 꺼진다 — 그래서 곁가지는 실패 안전이다. */

const 자동커밋훅 = path.resolve(__dirname, '..', '.claude', 'hooks', 'auto-commit.js');
const 지문훅 = path.resolve(__dirname, '..', '.claude', 'hooks', 'edit-stamp.js');

/** 편집 지문은 **edit-stamp 를 그대로 띄워** 남긴다 — 형식을 여기 다시 적으면 갈라진다(F225). */
function 훅판(잠금분) {
  const { repo, g } = 픽스처();
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lock-hook-')); 임시들.push(state);
  const sid = 'local_cafebabe-1111-2222-3333-444444444444';
  fs.writeFileSync(path.join(repo, '일감.txt'), '내가 쓴 것\n');
  fs.writeFileSync(path.join(state, `track-${store.projectKey(repo)}-${store.safeId(sid)}.json`),
    JSON.stringify({ touched: ['일감.txt'] }));
  훅띄우기(지문훅, {
    cwd: repo, encoding: 'utf8', timeout: 15000, windowsHide: true,
    input: JSON.stringify({ session_id: sid, cwd: repo, tool_name: 'Edit', tool_input: { file_path: path.join(repo, '일감.txt') } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo, CLAUDE_CODE_HOST_SESSION_ID: sid, SYNK_CTXBUDGET_DIR: state, SYNK_OWNER_ROOT: '' },
  });
  if (잠금분 !== null) 잠금두기(repo, 잠금분);
  void g;
  return { repo, state, sid };
}
function 훅돌린다({ repo, state, sid }, 픽스처 = 고아판) {
  const r = 훅띄우기(자동커밋훅, {
    cwd: repo, encoding: 'utf8', timeout: 30000, windowsHide: true,
    input: JSON.stringify({ session_id: sid, cwd: repo }),
    env: {
      ...process.env, CLAUDE_PROJECT_DIR: repo, CLAUDE_CODE_HOST_SESSION_ID: sid,
      SYNK_CTXBUDGET_DIR: state, SYNK_OWNER_ROOT: '', SYNK_AUTOCOMMIT_OFF: '', ...주입env(픽스처),
    },
  });
  return String(r.stdout || '') + String(r.stderr || '');
}

test('🔑 Stop 훅 — 고아 잠금에 막히면 「이번 턴은 물러난다」 옆에 고아를 말한다', { skip: !git있나 && 'git 없음' }, () => {
  const 판 = 훅판(548);
  const out = 훅돌린다(판);
  assert.match(out, /커밋 실패/, '이 회차는 실제로 막혀야 한다 — 안 막히면 아래 검사가 무의미하다');
  assert.match(out, /고아/, '세션이 여기서 끝나면 그 미커밋은 무보호로 남는다 — 물러난 이유를 이름 대야 한다');
});

test('🔴 Stop 훅 거짓양성 — 잠금 없이 정상 커밋된 턴엔 고아 줄이 없다', { skip: !git있나 && 'git 없음' }, () => {
  const 판 = 훅판(null);
  const out = 훅돌린다(판);
  assert.doesNotMatch(out, /고아/, 'Stop 훅은 매 턴 돈다 — 여기서 오경보가 나면 그 절은 곧 안 읽힌다');
});

/* ── ⑤-3 friction — 네 번째 자리이자 **가장 조용했던** 자리다.
 *    실측(F493): 고아 잠금 아래서 `git add` 가 조용히 지고 → `diff HEAD` 가 빈손 →
 *    「커밋 건너뜀 — 커밋할 변경이 없다(**장부는 저장됐다**)」. 맞는 얼굴인데 값이 틀렸다:
 *    갓 태어난 장부 조각이 **미추적**으로 남는다(F025 — 이력 어디에도 없는 유일한 무보호 상태).
 *    그리고 이 자리의 옛 처방(「손으로 커밋한다」)은 고아 잠금에서 **그것도 막힌다**(F103). */

const 장부도구 = path.resolve(__dirname, '..', 'tools', 'friction.js');

function 장부판(잠금분) {
  const { repo, g } = 픽스처();
  fs.mkdirSync(path.join(repo, 'docs', '_ops', '장부'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs', '_ops', '마찰신호.md'), '# 장부\n');
  g('add', '--', 'docs/_ops/마찰신호.md'); g('commit', '-qm', 'ledger');
  if (잠금분 !== null) 잠금두기(repo, 잠금분);
  return repo;
}
function 장부돌린다(repo, 설명) {
  const r = 훅띄우기([장부도구, 'add', '마찰', 설명], {
    cwd: repo, encoding: 'utf8', timeout: 60000, windowsHide: true, 통과코드: [0, 1],
    env: { ...process.env, SYNK_FRICTION_ROOT: repo, SYNK_FRICTION_LEDGER: path.join(repo, 'docs', '_ops', '마찰신호.md'), ...주입env(고아판) },
  });
  return String(r.stdout || '') + String(r.stderr || '');
}

test('🔴 friction — 고아 잠금에 `add` 가 지면 「변경 없음」이 아니라 «미추적»이라고 말한다', { skip: !git있나 && 'git 없음' }, () => {
  const repo = 장부판(548);
  const out = 장부돌린다(repo, '잠금 아래 신고');
  assert.doesNotMatch(out, /커밋할 변경이 없다/, '「장부는 저장됐다」로 읽히면 그 조각은 무보호인 채 잊힌다 — 맞는 얼굴로 틀린 값');
  assert.match(out, /미추적/, '무엇이 남았는지 이름을 대야 손이 간다');
  assert.match(out, /고아/, '옛 처방(손 커밋)은 이 상태에서 똑같이 막힌다 — 원인을 안 대면 따를 수 없는 처방이다(F103)');
});

test('🔑 friction 거짓양성 — 잠금이 없으면 평소대로 커밋하고 아무 경보도 안 낸다', { skip: !git있나 && 'git 없음' }, () => {
  const repo = 장부판(null);
  const out = 장부돌린다(repo, '평소 신고');
  assert.match(out, /✔ 커밋/, '이 회차는 실제로 커밋돼야 한다 — 안 그러면 위 검사가 무의미하다');
  assert.doesNotMatch(out, /미추적|고아/, '평소 회차에 경보가 붙으면 진짜 사고 때 그 줄이 안 읽힌다');
});

/* ── ⑥ 보드수거 — 이 도구는 board-move 의 «사유»를 안 들고 있어 「실패 N건」까지만 말한다.
 *    그 사유 중 재시도로 영영 안 풀리는 하나(잠금)를 여기서 이름 댈 수 있는지 본다.
 *    ⚠ 거절(원칙⑥)은 정상 판정이라 분모에서 빠져야 한다 — 안 가르면 멀쩡한 회차마다 경보다. */

const 보드수거JS = path.resolve(__dirname, '..', 'tools', '보드수거.js');
const 보드머리 = '# 보드\n\n| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |\n|---|---|---|---|\n';
const 보드완료줄 = '| 2026-08-12 | **반쪽 게이트 착지** | tools/codex-review.js | ✅**종결** `e9f62bc2` — 초록 재고 착지 |';

/** 주인 없는 완료 줄 하나 + board-move 스텁(종료 코드로 실패/거절을 고른다) + 늙은 잠금. */
function 보드픽스처(코드, 잠금분) {
  const { repo, g } = 픽스처();
  fs.mkdirSync(path.join(repo, 'docs', '_ops', '보드'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs', '_ops', '보드', '0badc0de.md'), 보드머리 + 보드완료줄 + '\n', 'utf8');
  fs.writeFileSync(path.join(repo, 'docs', '세션보드_아카이브.md'), '# 아카이브\n\n---\n\n', 'utf8');
  const 스텁 = path.join(repo, `stub-${코드}.js`);
  fs.writeFileSync(스텁, `process.exit(${코드});\n`, 'utf8');
  g('add', '-A'); g('commit', '-qm', 'board');
  잠금두기(repo, 잠금분);
  return { repo, 스텁 };
}
function 보드수거돌린다({ repo, 스텁, state }) {
  const r = 훅띄우기([보드수거JS, '--실행'], {
    encoding: 'utf8', 통과코드: [0, 2],
    env: {
      ...process.env, SYNK_BOARD_ROOT: repo, SYNK_OWNER_ROOT: repo, SYNK_CTXBUDGET_DIR: state,
      SYNK_BOARD_MOVE_BIN: 스텁, CLAUDE_CODE_HOST_SESSION_ID: 'local_aaaaaaaa', ...주입env(고아판),
    },
  });
  return String(r.stdout || '') + String(r.stderr || '');
}

test('🔑 보드수거 — 실패가 났고 잠금이 늙었으면 「실패 N건」 옆에 고아를 말한다', { skip: !git있나 && 'git 없음' }, () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lock-state2-')); 임시들.push(state);
  const { repo, 스텁 } = 보드픽스처(1, 548);            // 1 = board-move 가 못 옮겼다
  const out = 보드수거돌린다({ repo, 스텁, state });
  assert.match(out, /실패 1건/, '이 회차는 실제로 실패해야 한다 — 안 그러면 아래 검사가 무의미하다');
  assert.match(out, /고아/, '사유를 안 들고 있는 도구라, 이 한 줄이 없으면 원인이 영영 안 보인다');
});

test('🔴 보드수거 거짓양성 — 거절(원칙⑥)뿐이면 잠금이 늙어도 침묵한다', { skip: !git있나 && 'git 없음' }, () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-lock-state3-')); 임시들.push(state);
  const { repo, 스텁 } = 보드픽스처(6, 548);            // 6 = 주인이 되살아났다 = 정상 판정
  const out = 보드수거돌린다({ repo, 스텁, state });
  assert.match(out, /거절 1건/, '이 회차는 거절이어야 한다');
  assert.doesNotMatch(out, /고아/, '정상 판정 회차에 잠금 경보를 얹으면 진짜 잠금 사고 때 그 줄이 안 읽힌다');
});

test('🔑 거짓양성 — 잠금이 없어 정상 수거된 회차엔 고아 줄이 없다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  fs.writeFileSync(path.join(repo, 폴더, 'deadbeef.md'), '<!-- at:1 -->\n## 세션 deadbeef\n');
  심장박동(state, repo, 'local_deadbeef-1111-2222-3333-444444444444', 999);

  const r = 훅띄우기([수거도구, '--실행'], {
    encoding: 'utf8', 통과코드: [0, 2],
    env: { ...process.env, SYNK_OWNER_ROOT: repo, SYNK_CTXBUDGET_DIR: state, CLAUDE_CODE_HOST_SESSION_ID: 'local_aaaaaaaa' },
  });
  const out = String(r.stdout || '') + String(r.stderr || '');
  assert.doesNotMatch(out, /고아/, '성공한 회차에 경보가 붙으면 그 경보는 신호가 아니라 배경 소음이 된다');
});

/* ── ⑦ 가름 층 — 나이를 잰 «다음» (F562) ─────────────────────────────────────────
 * 옛 판은 여기서 끝났다: 「도는 git 이 없나 보고, 없으면 치워라」. 그런데 잠금을 만드는 주체가
 *   `git commit` 이고 그 pre-commit 훅이 자식 git 을 띄우므로, 고아 잠금 사건에서는 도는 git 이
 *   거의 언제나 하나 이상 남는다 — ②의 조건이 **영영 안 켜진다**(F103).
 * 그래서 이 절이 지키는 계약은 하나다: **처방이 어느 갈래에서도 끝까지 간다.**
 *   ㉠ 부모 생사 · ㉡ CPU 증가분 — **둘 다** 고아를 가리킬 때만 「치워도 된다」로 내려간다.
 *   하나라도 어긋나면 「기다려라」 = 이 장치가 생기기 전의 기본값이라, 새 위험을 만들지 않는다.
 * ⚠ 전부 픽스처다 — 실기계의 도는 git 은 회차마다 다르고 CI 에서 깨진다(F296). */

const 잠금세움 = (분 = 600) => { const { repo } = 픽스처(); const p = 잠금두기(repo, 분); return { repo, p }; };
const 판정 = (픽) => 프로세스판(픽, () => 잠금lib.프로세스판정({ 표본간격ms: 0 }));
const 처방 = (repo, 픽) => 프로세스판(픽, () => 잠금lib.고아잠금줄(repo, { 표본간격ms: 0 }));

test('🔴 F562 그 모양 — 도는 git 이 «있는데» 고아다(옛 처방이 영영 못 켜던 칸)', () => {
  const r = 판정(고아판);
  assert.equal(r.상태, '고아', '이 한 칸이 없으면 「git 이 하나 있다」에서 판단이 멈춘다 — 실사고가 정확히 그랬다');
  assert.equal(r.고아.length, 1);
  assert.equal(r.고아[0].pid, 24364);
});

test('🔑 ㉠ 단독으로는 못 정한다 — 부모가 살아있으면 CPU 가 0이어도 «살아있다»', () => {
  const r = 판정(산판);
  assert.equal(r.상태, '살아있다', 'CPU 0 은 「대기 중」일 수도 있다 — 부모가 살아있으면 주인이 있는 작업이다');
});

test('🔑 ㉡ 단독으로는 못 정한다 — 부모가 죽었어도 CPU 가 오르면 «살아있다»', () => {
  const r = 판정(태우는판);
  assert.equal(r.상태, '살아있다', 'detach 된 진짜 작업(clone·gc)을 고아로 읽으면 사람이 그걸 죽인다 — 비가역이다');
});

test('🔴 섞이면 «살아있다» — 산 놈이 하나라도 있으면 안 치운다(보수적 쪽으로 샌다)', () => {
  const 섞임 = { git: [산판.git[0], 고아판.git[0]], pids: [1, 2, 3] };
  const r = 판정(섞임);
  assert.equal(r.상태, '살아있다', '고아가 섞여 있다고 치우게 하면 그 옆의 산 git 을 함께 죽인다');
  assert.equal(r.고아.length, 1, '그래도 멎은 놈이 몇인지는 세어서 보여준다 — 사람의 판단 재료다');
});

test('🔑 도는 git 이 0개면 «없음» — 옛 처방 ②가 유일하게 참이던 칸은 그대로 산다', () => {
  assert.equal(판정(빈판).상태, '없음');
});

test('🔴 못 가렸으면 «못가렸다»다 — 「고아가 아니다」로도 「고아다」로도 안 접는다(F207)', () => {
  assert.equal(판정('{망가진 JSON').상태, '못가렸다', '주입을 못 읽은 회차를 조용히 넘기면 그 침묵이 판정으로 읽힌다');
  const r = 잠금lib.프로세스판정({ 쌍내기: () => { throw new Error('darwin 에서는 통로가 없다'); }, 표본간격ms: 0 });
  assert.equal(r.상태, '못가렸다');
  assert.match(r.왜, /darwin/, '왜 못 쟀는지를 안 적으면 다음 사람이 같은 자리에서 또 막힌다');
});

test('🔴 pid 목록이 비면 «전건 고아»가 된다 — 새는 방향이 가장 나쁜 자리를 막는다', () => {
  const r = 판정({ git: [고아판.git[0]], pids: [] });
  assert.equal(r.상태, '못가렸다', 'pid 목록이 비면 모든 부모가 죽은 것으로 읽혀 「치워도 된다」가 나온다 — 그게 최악이다');
});

/* ── ⑦-2 처방이 어느 갈래에서도 끝까지 가는가 = F562 의 본체 ─────────────────── */

test('🔴 고아 갈래 — 치울 명령과 끝낼 대상을 «둘 다» 준다(여기서 막히면 F562 재발이다)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, p } = 잠금세움();
  const 줄 = 처방(repo, 고아판);
  assert.match(줄, /가름 = 고아다/);
  assert.ok(줄.includes(p), '치울 경로가 없으면 사람이 엉뚱한 워크트리의 잠금을 지운다');
  assert.match(줄, /Stop-Process -Id 24364/, '고아 자식을 안 끝내면 그놈이 다음 잠금을 또 문다 — 치우기만으론 반쪽이다');
  assert.match(줄, /git diff --cached/, '명령줄이 오진의 «유일한» 안전장치다 — 사람이 읽고 fetch·gc 면 멈춘다');
});

test('🔴 살아있다 갈래 — 「치우지 마라」가 결론이고 삭제 명령을 주지 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const 줄 = 처방(잠금세움().repo, 산판);
  assert.match(줄, /가름 = 살아있다/);
  assert.match(줄, /치우지 마라/, '이 갈래에서 삭제를 권하면 도는 git 을 죽이는 비가역 사고가 난다');
  assert.doesNotMatch(줄, /Remove-Item|Stop-Process/, '결론이 「기다려라」인데 명령을 함께 주면 사람은 명령을 따른다');
  assert.match(줄, /git gc --auto/, '무엇을 기다리는지 이름을 안 대면 「언제까지」를 판단할 수 없다');
});

test('🔴 머리글이 모든 갈래에 「영영 안 통한다」를 달지 않는다 — 산 git 회차엔 그게 거짓이다', { skip: !git있나 && 'git 없음' }, () => {
  const 산줄 = 처방(잠금세움().repo, 산판);
  assert.doesNotMatch(산줄, /영영 안 통한다/, '기다리면 풀리는 회차에 「영영」이라고 쓰면 그게 맞는 얼굴로 틀린 값이다(맹점 ④)');
  const 고아줄 = 처방(잠금세움().repo, 고아판);
  assert.match(고아줄, /영영 안 통한다/, '참인 갈래에서까지 빼면 이번엔 급한 회차가 안 급해 보인다');
});

test('🔴 못가렸다 갈래도 처방이 끝까지 간다 — 손으로 가르는 절차를 준다(F103)', { skip: !git있나 && 'git 없음' }, () => {
  const 줄 = 처방(잠금세움().repo, '{망가진 JSON');
  assert.match(줄, /가르지 못했다/, '못 가린 회차를 「고아다」로 접으면 진짜 도는 git 을 죽이게 된다');
  assert.match(줄, /Win32_Process/, '자동 가름이 실패했으면 손으로 가를 명령을 줘야 한다 — 안 그러면 옛 막다른 골목 그대로다');
  assert.match(줄, /부모가 살아있나[\s\S]*CPU 가 오르나/, '재료 «둘»을 다 대야 사람이 같은 판정을 재현한다');
});

test('🔑 거짓양성 — 어린 잠금은 가름 자체를 안 돈다(비용도 경보도 0)', { skip: !git있나 && 'git 없음' }, () => {
  let 불렸나 = false;
  const { repo } = 픽스처();
  잠금두기(repo, 1);
  const 줄 = 잠금lib.고아잠금줄(repo, { 쌍내기: () => { 불렸나 = true; return { 첫: { git: [], 산pid: new Set([1]) }, 둘: { git: [], 산pid: new Set([1]) } }; }, 표본간격ms: 0 });
  assert.equal(줄, '');
  assert.equal(불렸나, false, '경합 회차마다 PowerShell 을 띄우면 Stop 훅이 매 턴 그 값을 문다 — 그러면 이 장치가 꺼진다');
});
