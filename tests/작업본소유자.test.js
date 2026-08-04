/* 작업본소유자 회귀 — 「전 세션 유물」과 「지금 도는 남의 작업본」을 갈라 보는가 (F073).
 *
 * 왜 있나: 세션 시작의 `git status` 는 둘을 **같은 모양**으로 보여준다. F073 실사고에서
 *   보드의 「진행중」 줄을 유물로 읽고 편집했는데 살아 있는 남의 트랙이었고,
 *   내 편집이 6분 뒤 남의 커밋에 실려 나갔다.
 *
 * 검사 방식 — **픽스처 저장소 + 픽스처 상태 디렉터리** 위에서 돈다
 *   (SYNK_OWNER_ROOT · SYNK_CTXBUDGET_DIR 이음매). 실저장소는 세션마다 달라져 불안정 테스트가 된다.
 *
 * 🔴 최우선 불변식 = **「모름」을 「안전」으로 바꾸지 않는다.** git 을 못 부르거나 만진 기록이
 *   없는 변경을 조용히 0건으로 처리하면, 이 도구는 있는 것보다 나쁘다(있는데 안심시킨다).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const TOOL = path.resolve(__dirname, '..', 'tools', '작업본소유자.js');
const store = require(path.resolve(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js'));

const git있나 = (() => { const r = spawnSync('git', ['--version'], { encoding: 'utf8' }); return !r.error && r.status === 0; })();

const 임시들 = [];
function 픽스처() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-repo-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-state-'));
  임시들.push(repo, state);
  const g = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
    { cwd: repo, encoding: 'utf8' });
  g('init', '-q');
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
  g('add', '-A'); g('commit', '-qm', 'seed');
  return { repo, state, g };
}
function 더럽힌다(repo, rel, 내용) {
  const p = path.join(repo, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 내용);
}
/** track-collision 이 쌓는 것과 **같은 이름 규칙**으로 상태 파일을 놓는다(safeId 는 lib 것을 쓴다). */
function 세션기록(state, repo, sid, touched, 분전) {
  const p = path.join(state, `track-${store.projectKey(repo)}-${store.safeId(sid)}.json`);
  fs.writeFileSync(p, JSON.stringify({ baseline: 'x', lastHead: 'x', touched, warned: [] }));
  const t = new Date(Date.now() - 분전 * 60000);
  fs.utimesSync(p, t, t);
}
function 돌린다({ repo, state, 나, 인자 = [] }) {
  const env = { ...process.env, SYNK_OWNER_ROOT: repo, SYNK_CTXBUDGET_DIR: state };
  if (나 === undefined) delete env.CLAUDE_CODE_HOST_SESSION_ID; else env.CLAUDE_CODE_HOST_SESSION_ID = 나;
  const r = spawnSync(process.execPath, [TOOL, ...인자], { encoding: 'utf8', env });
  assert.strictEqual(r.status, 0, `비정상 종료:\n${r.stderr}`);
  return String(r.stdout || '');
}

test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

test('🔴 살아있는 남의 작업본을 유물과 갈라 낸다 (F073 실사고 재현)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '엔진_궤적.js', 'live\n');
  더럽힌다(repo, '유물.js', 'orphan\n');
  세션기록(state, repo, 'local_aaaa1111', ['엔진_궤적.js'], 1);    // 살아있음
  세션기록(state, repo, 'local_bbbb2222', ['유물.js'], 400);       // 끝난 지 오래

  const out = 돌린다({ repo, state, 나: 'local_cccc3333' });
  assert.match(out, /🔴[\s\S]*엔진_궤적\.js/, '살아있는 남의 작업본을 안 짚었다');
  assert.match(out, /편집하지 않는다/, '처방(편집 금지)을 안 줬다');
  assert.match(out, /⚪[\s\S]*유물\.js/, '끝난 세션 유물을 안 짚었다');
  assert.match(out, /이어받아도 된다/, '유물은 이어받아도 된다고 안 알려줬다');
  // 갈라졌는가 — 같은 구획에 둘이 함께 있으면 F073 을 그대로 재현한다.
  const 위험구간 = out.slice(out.indexOf('🔴'), out.indexOf('⚪'));
  assert.ok(!위험구간.includes('유물.js'), '유물이 위험 구획에 섞였다 — 갈라 보는 것이 이 도구의 존재 이유다');
});

test('🔑 중첩 경로에서 맞아떨어진다 — 픽스처가 평평하면 이 자리가 통째로 안 시험된다', { skip: !git있나 && 'git 없음' }, () => {
  /* 옆 세션(local_dee95eb9)이 자기 변이 검사에서 먼저 밟은 함정을 넘겨받았다:
   * 시험 파일을 저장소 최상위에 두면 경로에 **구분자가 아예 없어**, 구분자 정규화를 지워도
   * 통과한다. 라이브 목록은 `crewcard/…`·`tests/…`·`docs/크루카드/…` 처럼 거의 전부 중첩이다.
   * 🔑 `path.normalize()` 류를 잘못 끼우면 윈도에서 `docs\정본\…` 이 되어 git 의 슬래시 경로와
   *    영영 안 맞고, 결과는 전부 「❔ 모름」이다 — 있는 것보다 나쁜 상태이면서 조용하다. */
  const { repo, state } = 픽스처();
  const 중첩 = 'docs/정본/엔진_시험.js';          // 하위 폴더 2단 + 한글(quotepath 도 같이 걸린다)
  더럽힌다(repo, 중첩, 'nested\n');
  세션기록(state, repo, 'local_nest01', [중첩], 1);
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.match(out, /🔴/, `중첩 경로를 못 맞췄다 — 라이브 목록은 대부분 중첩이라 이게 어긋나면 전부 「모름」이 된다:\n${out}`);
  assert.ok(out.includes(중첩), `표시가 슬래시 경로 그대로가 아니다:\n${out}`);
});

test('이름이 바뀐 파일은 **새 경로**로 판정한다 (git 의 "옛 -> 새" 형식)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  const g = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
    { cwd: repo, encoding: 'utf8' });
  더럽힌다(repo, 'src/옛이름.js', 'x\n');
  g('add', '-A'); g('commit', '-qm', 'add');
  g('mv', 'src/옛이름.js', 'src/새이름.js');       // 스테이징된 rename → "R  옛 -> 새"
  세션기록(state, repo, 'local_ren01', ['src/새이름.js'], 1);
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.match(out, /🔴[\s\S]*새이름\.js/, `rename 을 새 경로로 안 읽었다 — 옛 경로로 대조하면 주인을 영영 못 찾는다:\n${out}`);
});

test('내 작업본은 위험으로 세지 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '내파일.js', 'mine\n');
  세션기록(state, repo, 'local_me00', ['내파일.js'], 1);
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.ok(!/🔴/.test(out), `내 파일을 남의 것으로 경고했다:\n${out}`);
});

test('🔴 「모름」을 「안전」으로 바꾸지 않는다 — 훅 밖 변경', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '누가고쳤나.txt', 'x\n');   // 아무 세션도 touched 에 안 적음
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.match(out, /❔[\s\S]*누가고쳤나\.txt/, '기록 없는 변경을 조용히 넘겼다');
  assert.match(out, /모름은 안전이 아니다/, '모름을 안전처럼 보이게 뒀다');
});

test('🔴 git 을 못 부르면 「0건」이 아니라 「판정 불가」다', () => {
  const 없는곳 = path.join(os.tmpdir(), 'synk-own-nogit-' + process.pid);
  fs.mkdirSync(없는곳, { recursive: true }); 임시들.push(없는곳);
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-state2-')); 임시들.push(state);
  const out = 돌린다({ repo: 없는곳, state, 나: 'local_me00' });   // git 저장소가 아니다
  assert.match(out, /판정 불가/, '저장소가 아닌 곳에서 조용히 「이상 없음」처럼 보고했다');
  assert.ok(!/미커밋 0건/.test(out), '모름을 0건으로 번역했다 — 이 도구가 있는 것보다 나빠지는 유일한 경로다');
});

test('--hook 은 🔴가 없으면 침묵한다 (잔소리는 안 읽힌다)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '유물.js', 'orphan\n');
  세션기록(state, repo, 'local_old0', ['유물.js'], 400);
  assert.strictEqual(돌린다({ repo, state, 나: 'local_me00', 인자: ['--hook'] }).trim(), '',
    '위험이 없는데 훅이 말했다 — 매 세션 울리면 읽히지 않게 된다');
});

test('--hook 은 🔴가 있으면 반드시 말한다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '남의것.js', 'live\n');
  세션기록(state, repo, 'local_other', ['남의것.js'], 2);
  assert.match(돌린다({ repo, state, 나: 'local_me00', 인자: ['--hook'] }), /🔴[\s\S]*남의것\.js/,
    '위험이 있는데 훅이 침묵했다 — 새는 방향은 언제나 통과다');
});

test('🔑 심장박동 경계는 안전한 쪽으로 틀린다 — 애매하면 「살아있음」', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '경계.js', 'x\n');
  세션기록(state, repo, 'local_edge', ['경계.js'], 29);   // 기본 30분 경계 바로 안쪽
  assert.match(돌린다({ repo, state, 나: 'local_me00' }), /🔴/,
    '경계 안쪽을 죽었다고 판정했다 — 이 방향으로 틀리면 남의 작업본을 편집하게 된다');
});

/* ── 워크트리 (F079 · 옆 세션 local_dee95eb9 이 실사고로 잡아 넘겼다) ──────────
 * 두 겹의 사각지대였고 **둘 다 「0건」으로 조용히 새는** 방향이다:
 *   ⓐ `git status` 는 자기 트리만 본다 ⓑ 상태 파일 접두의 projectKey 가 트리마다 다르다.
 * 실측 당시: 옆 트리가 2건을 들고 있는데 이 도구는 그것을 세지 않았다. */
function 워크트리픽스처() {
  const { repo, state } = 픽스처();
  const g = (dir, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
    { cwd: dir, encoding: 'utf8' });
  const wtDir = path.join(repo, '.wt', 'branch-a');
  const r = g(repo, 'worktree', 'add', '-b', 'wt-a', wtDir);
  if (r.status !== 0) return null;                       // 워크트리를 못 만들면 이 검사는 의미 없다
  /* 🔑 **추적 파일을 고친** 모양으로 만든다 — 라이브에서 실제로 본 형태가 그것이다
   *   (옆 트리가 `.claude/hooks/code-edit-guard.js` 를 수정 중이었다).
   *   ⚠ 새 폴더의 **미추적** 파일로 만들면 이 검사가 통과하지 못한다 — 공용 통로
   *   `lib/worktrees.js` 가 `git status --porcelain` 을 `-uall` 없이 불러 `src/` 로 접기 때문이다
   *   (이 도구가 같은 자리에서 이미 한 번 당했고, 그 통로는 다른 세션 소유라 여기서 안 고쳤다). */
  더럽힌다(wtDir, 'src/옆트리것.js', 'theirs\n');
  g(wtDir, 'add', '-A'); g(wtDir, 'commit', '-qm', 'wt seed');
  더럽힌다(wtDir, 'src/옆트리것.js', 'theirs modified\n');
  return { repo, state, wtDir };
}

test('🔴 다른 작업 트리의 미커밋을 센다 — 메인 status 엔 안 뜬다', { skip: !git있나 && 'git 없음' }, (t) => {
  const f = 워크트리픽스처();
  if (!f) return t.skip('git worktree 를 못 만들었다 — 탐지력을 못 잰다(통과로 위장하지 않는다)');
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me00' });
  assert.match(out, /🌿/, `다른 트리의 미커밋을 통째로 놓쳤다 — 「0건」과 「안전」이 같은 모양이 된다:\n${out}`);
  assert.ok(out.includes('옆트리것.js'), `그 파일을 안 짚었다:\n${out}`);
  assert.match(out, /branch-a/, '어느 트리인지 안 알려줬다 — 어디로 가서 봐야 할지 모른다');
});

test('🔑 다른 트리의 파일은 경로가 겹쳐도 「내 것」이 되지 않는다', { skip: !git있나 && 'git 없음' }, (t) => {
  const f = 워크트리픽스처();
  if (!f) return t.skip('git worktree 를 못 만들었다');
  // 내가 메인에서 같은 상대 경로를 만진 것으로 기록해 둔다 — 글자만 겹치는 상황을 만든다.
  세션기록(f.state, f.repo, 'local_me00', ['src/옆트리것.js'], 1);
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me00' });
  assert.match(out, /🌿[\s\S]*옆트리것\.js/,
    `경로가 겹친다고 내 것으로 삼켰다 — 남의 트리 변경이 조용히 사라지는 방향이다:\n${out}`);
});

test('--hook 은 다른 트리 미커밋만 있어도 말한다 (침묵이 안전으로 읽히지 않게)', { skip: !git있나 && 'git 없음' }, (t) => {
  const f = 워크트리픽스처();
  if (!f) return t.skip('git worktree 를 못 만들었다');
  assert.match(돌린다({ repo: f.repo, state: f.state, 나: 'local_me00', 인자: ['--hook'] }), /🌿/,
    '다른 트리에 미커밋이 있는데 훅이 침묵했다');
});

test('🔴 SessionStart 에 등록돼 있고, 실행 불가가 조용한 통과가 아니다', () => {
  const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '.claude', 'settings.json'), 'utf8'));
  const cmd = (j.hooks?.SessionStart || []).flatMap((g) => g.hooks || [])
    .map((h) => h.command || '').filter((c) => c.includes('작업본소유자.js')).join('\n');
  assert.ok(cmd, 'SessionStart 등록이 없다 — 스스로 발화하지 않는 장치는 안 돈다(CLAUDE.md)');
  assert.match(cmd, /--hook/, '훅 모드로 안 부른다 — 매 세션 전문을 쏟으면 읽히지 않는다');
  assert.match(cmd, /CLAUDE_PROJECT_DIR/, '로컬 절대경로면 다른 기계에서 통째로 죽는다(F044)');
  assert.match(cmd, /미실행/, 'node·파일이 없을 때 조용히 지나간다 — 실행 불가는 드러나야 한다');
});
