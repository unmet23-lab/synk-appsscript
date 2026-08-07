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
/** 파일이 바뀐 시각을 뒤로 민다. ⚪ 판정은 **심장박동과 파일 시각의 선후**로 갈리므로(F090),
 *  시각을 안 정하면 픽스처는 「끝난 지 400분인 세션이 방금 쓴 파일」이라는 실재하지 않는 상태가 된다. */
function 나이먹인다(repo, rel, 분전) {
  const t = new Date(Date.now() - 분전 * 60000);
  fs.utimesSync(path.join(repo, rel), t, t);
}
/** track-collision 이 쌓는 것과 **같은 이름 규칙**으로 상태 파일을 놓는다(safeId 는 lib 것을 쓴다).
 *  `검사시각` = 경로별 「마지막으로 만진 때」(track-collision 의 `dirtyChecked`) — F187·F188 검사의 시계다. */
function 세션기록(state, repo, sid, touched, 분전, 검사시각) {
  const p = path.join(state, `track-${store.projectKey(repo)}-${store.safeId(sid)}.json`);
  fs.writeFileSync(p, JSON.stringify({
    baseline: 'x', lastHead: 'x', touched, warned: [], ...(검사시각 ? { dirtyChecked: 검사시각 } : {}),
  }));
  const t = new Date(Date.now() - 분전 * 60000);
  fs.utimesSync(p, t, t);
}
function 돌린다({ repo, state, 나, 인자 = [], 형제 }) {
  const env = { ...process.env, SYNK_OWNER_ROOT: repo, SYNK_CTXBUDGET_DIR: state };
  /* 형제를 안 준 검사는 **기본 경로**(`<ROOT>/../SYNK-talk`)를 그대로 쓴다 — 픽스처 ROOT 는
   * 임시 폴더라 그 형제가 없고, 그래서 이 파일의 옛 검사들은 값이 하나도 안 바뀐다.
   * ⚠ 여기에 실저장소 경로가 새어 들어가면 CI 와 로컬이 다른 세계를 보게 된다(repo 밖 의존). */
  if (형제) env.SYNK_OWNER_SIBLINGS = 형제.join(';');
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
  나이먹인다(repo, '유물.js', 401);                                 // 그 세션이 살아 있을 때 쓴 것 (F090)

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
  나이먹인다(repo, '유물.js', 401);
  assert.strictEqual(돌린다({ repo, state, 나: 'local_me00', 인자: ['--hook'] }).trim(), '',
    '위험이 없는데 훅이 말했다 — 매 세션 울리면 읽히지 않게 된다');
});

/* ── ⚪ 유물 주장의 반증 (F090 · 이 도구가 이 세션에 낸 실오판) ─────────────────
 * 실사고: `Code.js` 를 ⚪「이어받아도 된다」로 내놨는데 실제로는 **살아있는** 세션이
 *   `node tools/bump-version.js`(Bash)로 방금 고친 것이었다. Bash 가 쓴 파일은 만진 기록이
 *   안 남고(track-collision 은 Edit·Write 만 본다), 40분 전 끝난 세션의 **옛 기록이 이겼다.**
 * 🔑 기록은 「누가 언젠가 만졌다」만 말한다. 그 뒤에 누가 덮어썼는지는 기록에 없다 —
 *   그래서 ⚪(=손대도 된다고 말하는 유일한 칸)는 **시각으로 반증**되어야 한다. */

test('🔴 끝난 세션의 기록이 있어도 **그 뒤에 바뀐** 파일은 ⚪가 아니다 (F090 실오판 재현)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'Code.js', 'bumped by a live session via Bash\n');   // 지금 바뀌었다
  세션기록(state, repo, 'local_dead01', ['Code.js'], 40);             // 40분 전 끝난 세션의 옛 기록
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.ok(!/⚪[\s\S]*Code\.js/.test(out),
    `죽은 세션의 옛 기록만 보고 「이어받아도 된다」고 했다 — 그대로 커밋하면 F073 재현이다:\n${out}`);
  assert.match(out, /❔[\s\S]*Code\.js/, `유물이 아니면 모름이어야 한다:\n${out}`);
  assert.match(out, /Code\.js[^\n]*그 뒤에 바뀌었다/,
    `칸만 바꾸고 이유를 안 적었다 — 이유가 없으면 옛 기록을 믿고 되돌린다:\n${out}`);
});

test('⚪ 진짜 유물은 그대로 ⚪다 — 반증이 거짓양성을 만들지 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '진짜유물.js', 'orphan\n');
  세션기록(state, repo, 'local_dead02', ['진짜유물.js'], 400);
  나이먹인다(repo, '진짜유물.js', 401);                               // 그 세션이 살아 있을 때 쓴 것
  assert.match(돌린다({ repo, state, 나: 'local_me00' }), /⚪[\s\S]*진짜유물\.js/,
    '반증이 과해 진짜 유물까지 모름으로 밀었다 — 이어받을 것이 매번 「확인하라」가 되면 안 읽힌다');
});

test('🔑 여유는 훅 순서를 견딘다 — track-collision 은 PreToolUse 라 상태가 파일보다 먼저 쓰인다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '직후.js', 'x\n');
  세션기록(state, repo, 'local_dead03', ['직후.js'], 400);
  나이먹인다(repo, '직후.js', 399);        // 심장박동보다 1분 **뒤** — 편집이 훅 다음에 일어난 정상 순서
  assert.match(돌린다({ repo, state, 나: 'local_me00' }), /⚪[\s\S]*직후\.js/,
    '정상 훅 순서를 반증으로 읽었다 — 모든 유물이 모름이 되어 구분이 사라진다');
});

test('🔴 바뀐 때를 못 재면 ⚪라고 우기지 않는다 (삭제된 파일)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  더럽힌다(repo, '지워진.js', 'x\n');
  g('add', '-A'); g('commit', '-qm', 'add');
  fs.rmSync(path.join(repo, '지워진.js'));                            // 삭제 → statSync 불가
  세션기록(state, repo, 'local_dead04', ['지워진.js'], 400);
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.ok(!/⚪[\s\S]*지워진\.js/.test(out), `못 잰 것을 유물로 단정했다:\n${out}`);
  assert.match(out, /지워진\.js[^\n]*못 쟀다/, `못 쟀다는 사실을 숨겼다 — 통과와 미실행이 같은 모양이면 안 된다:\n${out}`);
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

/* ── 형제 저장소 (F134·F137 · 2026-08-06 세 번째 재현) ────────────────────────
 * 워크트리(위)와 **같은 모양의 사각지대, 다른 원인**이다: 워크트리는 같은 저장소의 다른 체크아웃이고
 * 형제(`../SYNK-talk`)는 아예 다른 저장소라 `git status` 가 애초에 못 본다. 이 프로젝트의 트랙은
 * 두 저장소를 함께 만지므로(보드 줄 절반이 「SYNK-talk: …」) 그 사각은 매 세션 열려 있었다.
 * 실측 3건 전부 새는 방향이 **「0건」**이다 — 08-06 이 세션 시작에서도 talk 미커밋 3건(하나는
 * 45초 전에 쓰인 살아있는 작업본)이 이 도구 출력에 한 줄도 안 나왔다. */
test('🔗 형제 저장소의 미커밋을 센다 — 내 git status 엔 안 뜬다 (F134·F137)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  const 형제 = 픽스처();
  더럽힌다(형제.repo, 'lib/학생계정.js', 'peer\n');
  const out = 돌린다({ repo, state, 나: 'local_me00', 형제: [형제.repo] });
  assert.match(out, /🔗/, `형제 저장소의 미커밋을 통째로 놓쳤다 — 「0건」과 「안전」이 같은 모양이 된다:\n${out}`);
  assert.ok(out.includes('lib/학생계정.js'), `그 파일을 안 짚었다:\n${out}`);
  assert.ok(out.includes(path.basename(형제.repo)),
    `어느 저장소인지 안 밝혔다 — 경로만 보면 내 저장소에서 찾다가 「없네」로 끝난다:\n${out}`);
});

test('⚠ 형제를 못 읽으면 「0건」이 아니라 판정 불가라고 말한다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  // 깨진 gitfile(워크트리 링크가 끊긴 실제 모양) — .git 은 있는데 git 은 실패한다.
  const 깨진 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-broken-'));
  임시들.push(깨진);
  fs.writeFileSync(path.join(깨진, '.git'), 'gitdir: /존재하지않는곳\n');
  const out = 돌린다({ repo, state, 나: 'local_me00', 형제: [깨진] });
  assert.match(out, /못 읽었다/, `못 읽은 형제를 조용히 건너뛰었다 — 침묵이 「깨끗함」으로 읽힌다:\n${out}`);
  assert.match(out, /판정 불가/, '0건이 아니라는 말이 빠졌다');
});

test('--hook 은 형제 미커밋만 있어도 말하되, 내 저장소 ❔ 까지 쏟지는 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '내미상.js', 'x\n');                     // 주인 기록 없음 → ❔
  const 형제 = 픽스처();
  더럽힌다(형제.repo, 'supabase/migrations/003.sql', 'peer\n');
  const out = 돌린다({ repo, state, 나: 'local_me00', 형제: [형제.repo], 인자: ['--hook'] });
  assert.match(out, /🔗/, `형제에 미커밋이 있는데 훅이 침묵했다 — F137 이 난 자리가 바로 세션 시작이다:\n${out}`);
  assert.ok(!out.includes('내미상.js'),
    `형제 때문에 연 입으로 내 저장소 ❔ 까지 쏟았다 — 매 세션 그러면 아무도 안 읽는다:\n${out}`);
});

/* ── 형제 파일의 **주인** (F134 가 「안 보임 → 모름」까지만 올려 둔 그 위 칸) ──────
 * 기록이 두 군데에 남는다: ⓐ 그 저장소를 프로젝트로 연 세션 ⓑ 이 저장소를 연 세션이
 * `../SYNK-talk/…` 를 편집. 라이브의 거의 전부가 ⓑ고, ⓑ 를 안 보면 형제 파일은 영원히
 * ❔모름이다 — 그건 이 프로젝트 트랙 **절반**에 F073 보호가 없다는 뜻이다. */
test('🔗 형제 파일의 주인을 가른다 — 기록은 **내 저장소 상태**에 형제 접두로 남는다 (ⓑ)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  const 형제 = 픽스처();
  더럽힌다(형제.repo, 'supabase/migrations/007_인증.sql', 'peer\n');
  // 남이 **내 저장소에서 세션을 열고** 형제 파일을 만졌다 → 내 키 + `../<형제>/` 접두
  세션기록(state, repo, 'local_peer01', [`../${path.basename(형제.repo)}/supabase/migrations/007_인증.sql`], 1);

  const out = 돌린다({ repo, state, 나: 'local_me00', 형제: [형제.repo] });
  assert.match(out, /🔴[\s\S]*007_인증\.sql/,
    `형제 파일의 주인을 못 갈랐다 — 형제 트랙 절반이 매 세션 ❔모름으로 떨어진다:\n${out}`);
  assert.match(out, /peer01/, `누구 것인지 안 밝혔다 — 「모름」과 구별이 안 된다:\n${out}`);
  assert.ok(!/🔗[\s\S]*007_인증\.sql/.test(out),
    `주인이 갈렸는데 「주인 모름」 묶음에도 남겼다 — 같은 파일이 두 처방을 받는다:\n${out}`);
});

test('🔴 접두 없는 기록은 형제 파일을 주장하지 못한다 — 두 저장소에 같은 상대 경로가 흔하다', { skip: !git있나 && 'git 없음' }, () => {
  /* 이 방향이 사고다: `docs/세션보드.md` 는 두 저장소에 다 있다. 접두를 안 요구하면 내가 만진
   * 내 저장소 파일이 **형제의 같은 이름 파일까지** 「내것」으로 삼키고, 그러면 남이 지금 들고
   * 있는 형제 작업본을 편집해도 된다고 말하게 된다(F073 의 정확한 재현 경로). */
  const { repo, state } = 픽스처();
  const 형제 = 픽스처();
  더럽힌다(형제.repo, 'docs/세션보드.md', 'peer edit\n');
  세션기록(state, repo, 'local_me00', ['docs/세션보드.md'], 1);   // 내가 만진 것은 **내 저장소** 것

  const out = 돌린다({ repo, state, 나: 'local_me00', 형제: [형제.repo] });
  assert.match(out, /🔗[\s\S]*세션보드\.md/,
    `내 저장소 기록이 형제의 같은 경로를 삼켰다 — 남의 형제 작업본이 조용히 「내것」이 된다:\n${out}`);
});

test('내가 만진 형제 파일은 위험으로 세지 않는다 — 전부 🔴로 칠하는 것도 「잡았다」처럼 보인다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  const 형제 = 픽스처();
  더럽힌다(형제.repo, 'lib/이벤트검증.js', 'mine\n');
  세션기록(state, repo, 'local_me00', [`../${path.basename(형제.repo)}/lib/이벤트검증.js`], 1);
  const out = 돌린다({ repo, state, 나: 'local_me00', 형제: [형제.repo] });
  assert.ok(!/🔴/.test(out), `내 형제 편집을 남의 것으로 경고했다:\n${out}`);
});

test('형제가 깨끗하면 훅은 침묵한다 — 상시 잔소리는 장치를 죽인다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  const 형제 = 픽스처();                                   // 씨앗만 커밋된 깨끗한 저장소
  assert.strictEqual(돌린다({ repo, state, 나: 'local_me00', 형제: [형제.repo], 인자: ['--hook'] }).trim(), '',
    '깨끗한 형제를 두고 입을 열었다');
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

/* ── 원격 대기 브랜치 (폰=클라우드 세션) ──────────────────────────────────────
 * 왜 여기 붙나: 이 저장소의 충돌 감지는 전부 로컬 HEAD 기준인데, 클라우드 세션은
 * `claude/*` 브랜치로 push 한다 — fetch 전엔 로컬에 없으므로 **PC 세션에 통째로 안 보인다.**
 * 픽스처의 origin 은 로컬 폴더라 네트워크에 의존하지 않는다(CI 에서 깨지지 않는다). */
function 원격붙인다(repo, { 브랜치, 병합 = false }) {
  const 원본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-origin-'));
  임시들.push(원본);
  const G = (cwd) => (...a) => spawnSync('git',
    ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8' });
  const go = G(원본);
  go('init', '-q', '-b', 'master');
  fs.writeFileSync(path.join(원본, 'seed.txt'), 'seed\n');
  go('add', '-A'); go('commit', '-qm', 'seed');
  go('checkout', '-qb', 브랜치);
  fs.writeFileSync(path.join(원본, '폰작업.md'), '폰에서 고친 것\n');
  go('add', '-A'); go('commit', '-qm', 'docs: 인쇄본 PDF 16종 (유호님 지시)');
  if (병합) { go('checkout', '-q', 'master'); go('merge', '-q', '--no-ff', '-m', 'merge', 브랜치); }
  const g = G(repo);
  g('remote', 'add', 'origin', 원본);
  return 원본;
}

test('☁ 원격에 대기 중인 클라우드(폰) 브랜치를 잡는다 — 로컬 HEAD 만 보면 안 보이는 자리', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  원격붙인다(repo, { 브랜치: 'claude/synk-docs-update-xg7oka' });
  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  assert.match(out, /claude\/synk-docs-update-xg7oka/, '대기 중인 폰 브랜치를 이름으로 말해야 한다');
  assert.match(out, /인쇄본 PDF 16종/, '무슨 작업인지(커밋 제목)까지 줘야 열어볼지 판단할 수 있다');
});

test('🔴 이미 master 에 들어간 브랜치는 말하지 않는다 — 상시 잔소리는 장치를 죽인다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  원격붙인다(repo, { 브랜치: 'claude/이미병합됨', 병합: true });
  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  assert.doesNotMatch(out, /이미병합됨/, '병합된 브랜치까지 세면 매 세션 뜨고, 그러면 진짜 대기도 안 읽힌다');
});

test('🔴 원격을 못 읽은 것과 「0건」은 같은 모양이면 안 된다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  spawnSync('git', ['remote', 'add', 'origin', path.join(os.tmpdir(), '없는-원격-' + process.pid)],
    { cwd: repo, encoding: 'utf8' });
  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  assert.match(out, /못 읽었다/, 'fetch 실패를 침묵으로 처리하면 「대기 0건」과 구별이 안 된다');
});

test('리모트가 없으면 침묵한다 — 대기가 원리적으로 없는 저장소다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  assert.doesNotMatch(out, /못 읽었다|대기 중인 클라우드/, 'origin 이 없는 저장소에서 경고를 내면 거짓양성이다');
});

/* ── 🟡 내것인데 남도 함께 (F164) ──────────────────────────────────────
 * 판정이 `내것` 이면 목록에서 통째로 빠진다 — 그런데 만진 기록은 **과거**라, 지금 작업본에
 * 들어 있는 내용이 내 것이라는 보장이 아니다. 실측: 한 세션이 이 도구를 커밋한 뒤 다른 세션이
 * 같은 파일에 기능을 얹었는데 커밋한 쪽 화면엔 그 사실이 아예 안 떴다.
 * ⚠ 차단은 손대지 않는다 — git-scope-guard 는 `내것 ∧ 함께 없음` 일 때만 통과시키고
 *   2026-08-07 세션에서 실제로 세 번 막았다. 비어 있던 것은 **보는 층**뿐이다. */
test('🟡 내가 만진 파일이라도 남이 함께 만졌으면 목록에 남는다 (F164)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '공유.js', 'x');
  세션기록(state, repo, 'local_me', ['공유.js'], 1);
  세션기록(state, repo, 'local_peer', ['공유.js'], 1);
  const out = 돌린다({ repo, state, 나: 'local_me' });
  assert.match(out, /남도 함께 만진/, '내것으로 접히면서 남의 동시 편집이 화면에서 사라진다 — 그게 F164 다');
  assert.match(out, /공유\.js/, '어느 파일인지 안 적으면 알아도 손을 못 쓴다');
  assert.match(out, /peer/, '누가 함께 만졌는지가 빠지면 조율할 상대를 모른다');
});

test('🟡 나만 만진 파일은 조용하다 — 거짓양성이면 「내것」 칸이 무의미해진다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '내것.js', 'x');
  세션기록(state, repo, 'local_me', ['내것.js'], 1);
  const out = 돌린다({ repo, state, 나: 'local_me' });
  assert.doesNotMatch(out, /남도 함께 만진/, '나 혼자 만진 파일까지 띄우면 매 세션 내 작업이 전부 경고로 뜬다');
});

test('🟡 는 훅 침묵을 깨지 않는다 — 사고를 막는 것은 이미 가드다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '공유.js', 'x');
  세션기록(state, repo, 'local_me', ['공유.js'], 1);
  세션기록(state, repo, 'local_peer', ['공유.js'], 1);
  assert.strictEqual(돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] }).trim(), '',
    '공유 파일(보드·장부)은 늘 이 조건에 걸려서, 매 세션 울리면 그 순간부터 아무도 안 읽는다');
});

/* ── 🧭 보드 선점 (F161) ────────────────────────────────────────────────
 * 왜 있나 — 선점은 커밋이 아니라 **미커밋 보드 줄**로만 드러나서 `git log` 로는 안 보인다.
 *   2026-08-07 실측: 한 칸(`GET /v1/corrections`)에 세 세션이 몰렸고, 같은 날 `progress`
 *   칸에서도 한 세션이 착수 직후 양보했다. 파일명(`docs/세션보드.md ← 남`)은 매 세션 뜨는
 *   배경 소음이라 그 자리를 못 메운다 — 필요한 건 **그 줄에 무엇이 적혔나**다. */
const 보드머리 = ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|'].join('\n');
function 보드픽스처(줄들) {
  const f = 픽스처();
  더럽힌다(f.repo, 'docs/세션보드.md', `${보드머리}\n| 2026-08-07 | **옛 트랙** | a.js | ✅종결 |\n`);
  f.g('add', '-A'); f.g('commit', '-qm', 'board');
  if (줄들) 더럽힌다(f.repo, 'docs/세션보드.md', `${보드머리}\n| 2026-08-07 | **옛 트랙** | a.js | ✅종결 |\n${줄들}\n`);
  return f;
}

test('🧭 아직 커밋 안 된 보드 선언을 **줄 내용으로** 띄운다 (F161)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 보드픽스처('| 2026-08-07 | **남의 새 트랙 — GET /v1/corrections** | fn/corrections | 작업중 |');
  const out = 돌린다({ repo, state, 나: 'local_me' });
  assert.match(out, /커밋 안 된 보드 선언\*\* 1건/, '선점 줄을 못 셌다 — F161 이 그대로다');
  assert.match(out, /남의 새 트랙 — GET \/v1\/corrections/, '파일명만 띄우면 무엇을 선점했는지 모른다');
  assert.match(out, /작업중/, '상태 칸을 버리면 「작업중」과 「✅종결」이 같은 무게로 보인다');
});

test('🧭 보드가 그대로면 침묵한다 — 거짓양성이면 다음 사람이 이 절을 끈다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 보드픽스처(null);
  더럽힌다(repo, '다른.js', 'x');
  const out = 돌린다({ repo, state, 나: 'local_me' });
  assert.doesNotMatch(out, /커밋 안 된 보드 선언/, '보드를 안 건드렸는데 선점이 있다고 한다');
});

test('🧭 표 머리줄·구분선은 선언이 아니다 — 보드를 새로 만든 커밋에서 짖지 않게', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();                                   // 보드가 아예 없는 저장소
  더럽힌다(f.repo, 'docs/세션보드.md', `${보드머리}\n`);   // 머리줄+구분선만 새로 생긴다
  /* 🔴 스테이지까지 해야 이 검사가 **실제로 필터를 돌린다.** 미추적 파일은 `git diff` 에 아예
   *   안 나와서, add 를 빼면 통과하지만 통과의 이유가 「필터가 걸렀다」가 아니라 「볼 게 없었다」다
   *   (변이 실측 1차에서 필터를 지워도 초록이라 드러났다 — 초록인데 아무것도 안 잰 검사였다). */
  f.g('add', '-A');
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me' });
  assert.doesNotMatch(out, /커밋 안 된 보드 선언/, '머리줄을 선언으로 세면 보드 신설마다 거짓 경보다');
});

test('🧭 --hook 은 보드 선점만 있어도 말한다 — 침묵이 안전으로 읽히면 안 된다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 보드픽스처('| 2026-08-07 | **남의 새 트랙** | b.js | 작업중 |');
  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  assert.match(out, /커밋 안 된 보드 선언/, '훅이 침묵하면 세션 시작에 아무 데서도 안 보인다 — 그게 F161 이다');
});

/* ── 🔶 내가 만진 뒤에 남이 커밋했다 (F187·F188) ────────────────────────────────
 * 두 실사고는 **같은 사건의 양쪽 좌석**이라 검사도 한 쌍으로 둔다:
 *   더러움 → F187(내 커밋이 남의 줄을 삭제로 싣는다) · 깨끗함 → F188(내 수정이 이미 덮였다).
 * 탐지력은 전부 이 픽스처가 진다 — 실저장소는 세션마다 달라 「초록인데 아무것도 안 잰」 검사가 된다.
 * ⚠ `%ct` 는 **커밋 시각**이라 시계를 뒤로 미는 검사는 GIT_COMMITTER_DATE 를 함께 준다
 *   (`--date` 는 author 만 바꿔서, 그것만 쓰면 「전」 검사가 통과의 이유를 잃는다). */
function 커밋한다(f, rel, 내용, { sid, 초전 = 0 } = {}) {
  더럽힌다(f.repo, rel, 내용);
  const 때 = new Date(Date.now() - 초전 * 1000).toISOString();
  f.g('add', '--', rel);
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false',
    'commit', '-q', '-m', sid ? `수정\n\nSession-Id: ${sid}` : '수정'],
  { cwd: f.repo, encoding: 'utf8', env: { ...process.env, GIT_COMMITTER_DATE: 때, GIT_AUTHOR_DATE: 때 } });
  assert.strictEqual(r.status, 0, `픽스처 커밋 실패: ${r.stderr}`);
}
const 아까 = (초) => Date.now() - 초 * 1000;

test('🔶 F187 — 내가 만진 뒤 남이 커밋했고 내 작업본은 **더럽다**', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();
  커밋한다(f, 'lib/공유.js', '남이 방금 넣은 줄\n', { sid: 'local_peer' });
  더럽힌다(f.repo, 'lib/공유.js', '내 옛 판\n');            // 남의 줄이 없는 스테일 작업본
  세션기록(f.state, f.repo, 'local_me', ['lib/공유.js'], 0, { 'lib/공유.js': 아까(120) });
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me' });
  assert.match(out, /뒤에\*\* 남이 커밋한 경로 1건/, '이 자리가 통째로 안 보이던 것이 F187 이다');
  assert.match(out, /lib\/공유\.js/);
  assert.match(out, /내 작업본 \*\*더러움\*\*/);
  assert.match(out, /F187/, '더러운 쪽엔 「삭제로 실린다」 처방이 붙어야 한다');
  assert.match(out, /peer/, '누가 커밋했는지가 없으면 대조를 못 한다');
});

test('🔶 F188 — 같은 사건, 내 작업본이 **깨끗하다**(내 수정이 이미 덮였다)', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();
  커밋한다(f, 'lib/공유.js', '남의 판이 이겼다\n', { sid: 'local_peer' });   // 커밋 뒤 작업본은 clean
  세션기록(f.state, f.repo, 'local_me', ['lib/공유.js'], 0, { 'lib/공유.js': 아까(120) });
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me' });
  assert.match(out, /내 작업본 깨끗함/);
  assert.match(out, /F188/, '깨끗한 쪽은 「이미 내 손을 떠났다」여야 한다 — 조용하면 그게 F188 이다');
  /* 🔴 이 한 줄이 이 검사의 존재 이유다: 깨끗한 파일은 `git status` 에 안 떠서
   *   기존 판정(🔴·🟡·⚪·❔)으로는 **원리적으로** 못 본다. */
  assert.doesNotMatch(out, /🔴 살아있는 남의 작업본/, '깨끗한데 미커밋 칸에 뜨면 픽스처가 잘못된 것이다');
});

test('🔶 **내** 커밋은 안 센다 — 내가 커밋한 것을 위험이라 하면 매 커밋마다 짖는다', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();
  커밋한다(f, 'lib/공유.js', '내가 커밋했다\n', { sid: 'local_me' });
  세션기록(f.state, f.repo, 'local_me', ['lib/공유.js'], 0, { 'lib/공유.js': 아까(120) });
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me' });
  assert.doesNotMatch(out, /뒤에\*\* 남이 커밋한 경로/, 'Session-Id 로 내 것을 못 가르면 거짓 경보로 장치가 꺼진다');
});

test('🔶 내가 만지기 **전** 커밋은 안 센다 — 시계가 없으면 저장소 이력 전체가 경보가 된다', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();
  커밋한다(f, 'lib/공유.js', '한참 전 남의 커밋\n', { sid: 'local_peer', 초전: 600 });
  더럽힌다(f.repo, 'lib/공유.js', '내 편집\n');
  세션기록(f.state, f.repo, 'local_me', ['lib/공유.js'], 0, { 'lib/공유.js': 아까(60) });  // 내 스탬프가 더 최근
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me' });
  assert.doesNotMatch(out, /뒤에\*\* 남이 커밋한 경로/, '「뒤」를 안 가리면 옛 커밋이 전부 뒤늦은 커밋이 된다');
});

/* 🔴 위 검사만 있으면 **`--since` 가 혼자 다 막아** 경로별 시각 대조가 통째로 안 시험된다
 *   (변이 실측: 그 비교를 지워도 초록이었다). `--since` 는 저장소당 **가장 이른** 스탬프 하나로
 *   창을 잡으므로, 경로마다 스탬프가 다르면 남의 경로 커밋이 그 창 안에 들어온다 —
 *   경로별로 다시 안 거르면 **먼저 만진 파일 때문에 나중 파일이 거짓 경보**를 맞는다. */
test('🔶 같은 저장소에서 **경로마다** 시계가 다르다 — 창 하나로 뭉뚱그리면 거짓 경보다', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();
  커밋한다(f, 'lib/늦게.js', '남의 커밋 — 5분 전\n', { sid: 'local_peer', 초전: 300 });
  더럽힌다(f.repo, 'lib/일찍.js', '내 편집\n');
  세션기록(f.state, f.repo, 'local_me', ['lib/일찍.js', 'lib/늦게.js'], 0, {
    'lib/일찍.js': 아까(600),   // 창(--since)은 여기서 열린다 → 남의 커밋이 창 안이다
    'lib/늦게.js': 아까(10),    // 그런데 이 경로는 그 커밋 **뒤에** 만졌다
  });
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me' });
  assert.doesNotMatch(out, /뒤에\*\* 남이 커밋한 경로/,
    '창 안이라는 이유로 세면, 오래 산 세션일수록 만진 파일 전부가 경보가 된다');
});

test('🔶 공용 장부는 뺀다 — 보드까지 세면 매 세션 울려서 아무도 안 읽는다', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();
  커밋한다(f, 'docs/세션보드.md', '| 남의 줄 |\n', { sid: 'local_peer' });
  세션기록(f.state, f.repo, 'local_me', ['docs/세션보드.md'], 0, { 'docs/세션보드.md': 아까(120) });
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me' });
  assert.doesNotMatch(out, /뒤에\*\* 남이 커밋한 경로/, '보드 겹침은 규약상 정상이다 — 경보로 만들면 신호가 묻힌다');
});

test('🔶 주인 표시 없는 커밋은 **남이라고 단정하지 않는다**(F144: 형제엔 스탬퍼가 늦게 붙었다)', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();
  커밋한다(f, 'lib/공유.js', '트레일러 없는 커밋\n', {});
  세션기록(f.state, f.repo, 'local_me', ['lib/공유.js'], 0, { 'lib/공유.js': 아까(120) });
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me' });
  assert.match(out, /뒤에\*\* 남이 커밋한 경로 1건/, '모름을 버리면 그게 「0건」이 되고 0 은 안전과 구별되지 않는다');
  assert.match(out, /주인표시 없음/, '단정과 모름을 같은 모양으로 적으면 안 된다');
});

test('🔶 스탬프가 없는 경로는 **못 쟀다고 말한다** — 안 잰 것과 0건이 같은 모양이면 안 된다', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();
  커밋한다(f, 'lib/공유.js', '남의 커밋\n', { sid: 'local_peer' });
  세션기록(f.state, f.repo, 'local_me', ['lib/공유.js'], 0, {});   // touched 는 있는데 시계가 없다
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me' });
  assert.match(out, /1건은 \*\*언제 만졌는지를 못 쟀다\*\*/);
  assert.doesNotMatch(out, /뒤에\*\* 남이 커밋한 경로/, '시계 없이 「뒤」를 주장하면 그건 추측이다');
});

test('🔶 **형제 저장소**도 같은 판정을 거친다 — F187·F188 은 둘 다 talk 파일에서 났다', { skip: !git있나 && 'git 없음' }, () => {
  const 나의 = 픽스처();
  const 형제 = 픽스처();
  const 이름 = path.basename(형제.repo);
  커밋한다(형제, 'tools/왕복시험.js', '남이 방금 커밋\n', { sid: 'local_peer' });
  const 좌표 = `${store.siblingPrefix(이름)}tools/왕복시험.js`;
  세션기록(나의.state, 나의.repo, 'local_me', [좌표], 0, { [좌표]: 아까(120) });
  const out = 돌린다({ repo: 나의.repo, state: 나의.state, 나: 'local_me', 형제: [형제.repo] });
  assert.match(out, /뒤에\*\* 남이 커밋한 경로 1건/, '형제를 빼면 등재된 실사고 두 건을 다 놓친다');
  assert.match(out, new RegExp(`${이름}/tools/왕복시험\\.js`), '어느 저장소인지 안 붙이면 내 저장소에서 찾으러 간다');
});

test('🔶 --hook 은 이것만 있어도 말한다 — 손으로 불러야만 보이면 두 실사고 그대로다', { skip: !git있나 && 'git 없음' }, () => {
  const f = 픽스처();
  커밋한다(f, 'lib/공유.js', '남의 커밋\n', { sid: 'local_peer' });
  세션기록(f.state, f.repo, 'local_me', ['lib/공유.js'], 0, { 'lib/공유.js': 아까(120) });
  const out = 돌린다({ repo: f.repo, state: f.state, 나: 'local_me', 인자: ['--hook'] });
  assert.match(out, /뒤에\*\* 남이 커밋한 경로/, '침묵하면 F188 은 아무 데서도 안 보인다');
});

test('🔑 공용 장부 목록은 **한 곳**에서 파생시킨다 — track-collision 이 자기 사본을 들면 갈라진다', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', '.claude', 'hooks', 'track-collision.js'), 'utf8');
  const m = src.match(/const\s+장부\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!m) {                                   // 사본이 없다 = 목표 상태. 대신 lib 을 쓰는지 확인한다.
    assert.match(src, /store\.공용장부/, '장부 목록이 사라졌는데 lib 도 안 쓴다 — 어디서 오는지 알 수 없다');
    return;
  }
  const 사본 = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.deepStrictEqual(사본, [...store.공용장부],
    '두 장치가 같은 목록을 각자 적고 있다 — 갈라지면 한쪽은 경고 홍수, 다른 쪽은 침묵이다');
});
