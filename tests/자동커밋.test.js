/* 자동커밋(Stop 훅) 회귀 — 픽스처 저장소에서만 잰다. 실저장소에는 아무 것도 하지 않는다.
 *
 * 탐지력은 픽스처가 진다(CLAUDE.md 신뢰성 ②) — 「커밋됐다」와 「안 됐다」 양방향을 다 잰다:
 * 가드·장치의 새는 방향은 언제나 「통과」라서, 커밋이 안 되는 케이스(보드·함께·깨짐·rebase)는
 * HEAD 불변까지 확인한다. 침묵 케이스는 stdout 이 정확히 빈 것으로 잰다(말 많은 장치는 안 읽힌다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');                       // 구문 유효성만 본다(자식 없이 — 훅통로 규약)
const { spawnSync } = require('child_process'); // git 재현용 — 훅은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

const REPO = path.resolve(__dirname, '..');
/* 이음매는 **변이 시험 전용**이다 — 실저장소 훅을 직접 변이하면 그 창에서 옆 세션의 Stop 훅이
 * 깨진 판으로 돌고, 그게 F225 가 난 모양이다. 격리 사본을 물린다(트랙충돌의 SYNK_TEST_TRACK_HOOK 과 같은 패턴). */
const HOOK = process.env.SYNK_TEST_AUTOCOMMIT_HOOK || path.join(REPO, '.claude', 'hooks', 'auto-commit.js');
const store = require(path.join(REPO, '.claude', 'hooks', 'lib', 'handoff-store.js'));
const wt = require(path.join(REPO, '.claude', 'hooks', 'lib', 'worktrees.js'));

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 15000, windowsHide: true });
  assert.strictEqual(r.status, 0, `${cmd} ${args.join(' ')} 실패: ${r.stderr}`);
  return String(r.stdout || '');
}
const git = (args, cwd) => run('git', ['-c', 'core.quotepath=false', ...args], cwd);

/** 픽스처 저장소 + 상태 디렉터리. 시드 커밋 1개로 HEAD 를 세운다. */
function 판(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '자동커밋판-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), '자동커밋상태-'));
  t.after(() => { for (const d of [root, state]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });
  git(['init', '-q'], root);
  git(['config', 'user.email', 't@t'], root);
  git(['config', 'user.name', 't'], root);
  fs.writeFileSync(path.join(root, 'seed.txt'), 's');
  git(['add', '--', 'seed.txt'], root);
  git(['commit', '-qm', 'seed'], root);
  return { root, state };
}

/** track-collision 이 쌓는 것과 같은 좌표의 상태 파일 — 키 식은 세션들()과 동일하게 파생한다. */
function 만짐기록(state, root, sid, touched, { 분전 = 0 } = {}) {
  let 기준 = root;
  try { 기준 = wt.mainWorktree(root) || root; } catch (_) { /* 픽스처는 자기 자신이 메인이다 */ }
  const f = path.join(state, `track-${store.projectKey(기준)}-${store.safeId(sid)}.json`);
  fs.writeFileSync(f, JSON.stringify({ touched }));
  if (분전) { const at = new Date(Date.now() - 분전 * 60000); fs.utimesSync(f, at, at); }
}

const STAMP = path.join(REPO, '.claude', 'hooks', 'edit-stamp.js');

/** 편집 지문을 남긴다 — **edit-stamp 훅을 그대로 띄워서**(F225).
 * 형식을 여기 다시 적으면 쓰는 쪽과 읽는 쪽이 갈라지고, 갈라진 쪽의 증상은 「무기록=안 실림」이다.
 * 좌표는 만짐 기록과 같은 것을 준다 — 형제 좌표(`../이름/…`)도 root 기준으로 풀린다. */
function 지문기록(state, root, sid, touched, extraEnv = {}) {
  for (const 좌표 of touched) {
    훅띄우기(STAMP, {
      cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true,
      input: JSON.stringify({
        session_id: sid, cwd: root, tool_name: 'Edit',
        tool_input: { file_path: path.resolve(root, 좌표) },
      }),
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: root, CLAUDE_CODE_HOST_SESSION_ID: sid,
        SYNK_CTXBUDGET_DIR: state, SYNK_OWNER_ROOT: '', ...extraEnv,
      },
    });
  }
}

function 훅실행(root, state, sid, extraEnv = {}) {
  const r = 훅띄우기(HOOK, {
    cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true,
    input: JSON.stringify({ session_id: sid, cwd: root }),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root, CLAUDE_CODE_HOST_SESSION_ID: sid,
      SYNK_CTXBUDGET_DIR: state, SYNK_OWNER_ROOT: '', SYNK_AUTOCOMMIT_OFF: '',
      ...extraEnv,
    },
  });
  // 0 아닌 종료(편의 장치가 작업을 막는 것)도, 안 뜬 것도 통로가 드러낸다.
  return String(r.stdout || '');
}

const 머리해시 = (root) => git(['rev-parse', 'HEAD'], root).trim();
const 쓰기 = (root, rel, 내용) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 내용);
};

test('내것만 커밋한다 — 함께 만진 파일은 남기고 알린다(F104)', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'a.txt', '수정');            // 추적 + 수정
  git(['add', '--', 'a.txt'], root); git(['commit', '-qm', 'a'], root);
  쓰기(root, 'a.txt', '수정2');
  쓰기(root, 'sub/b.txt', '새것');        // 새 폴더의 미추적(-uall 접힘 회귀)
  쓰기(root, 'shared.md', '둘이 만짐');
  만짐기록(state, root, 'me-1', ['a.txt', 'sub/b.txt', 'shared.md']);
  만짐기록(state, root, 'peer-1', ['shared.md']);   // 살아있는 남
  지문기록(state, root, 'me-1', ['a.txt', 'sub/b.txt', 'shared.md']);

  const out = 훅실행(root, state, 'me-1');
  const msg = JSON.parse(out).systemMessage;
  assert.match(msg, /\[자동커밋\] 2개/, msg);
  assert.match(msg, /shared\.md/, '함께 남긴 파일을 말하지 않았다');

  const 제목 = git(['log', '-1', '--format=%s'], root).trim();
  assert.ok(제목.startsWith('자동커밋: '), `제목이 고정 접두가 아니다 — 이 훅이 낸 커밋을 나중에 골라낼 수 없다: ${제목}`);
  const 실린것 = git(['show', '--name-only', '--format=', 'HEAD'], root).trim().split(/\r?\n/);
  assert.deepStrictEqual(실린것.sort(), ['a.txt', 'sub/b.txt'], '커밋 범위가 내것 2개가 아니다');
  const 남은 = git(['status', '--porcelain'], root);
  assert.match(남은, /shared\.md/, '함께 파일이 커밋에 쓸려 들어갔다(F104 재현)');
});

test('보드는 절대 자동커밋하지 않는다(F102) — 침묵', (t) => {
  const { root, state } = 판(t);
  /* 옛 좌표와 **새 정본**(F250 이주 · `docs/_ops/보드/<지문>.md`)을 함께 건다.
   * 이 회귀가 옛 이름만 들고 있어서 이주가 초록인 채로 통과했고, 그 뒤 08-08 17:06 에
   * 자동커밋이 `docs/_ops/보드/6da8da21.md` 를 실제로 실었다 — 회귀는 정본을 따라가야 한다.
   *
   * ⚠ **이 회귀를 지우려는 다음 세션에게**(F367 · 2026-08-12): 제외의 옛 근거(F248 「중간 판이
   *   실린다」)는 죽었다 — board-move 는 `fs.writeFileSync` 라 도장이 없어 훅이 원리상 못 본다.
   *   하지만 결론은 그대로다. 실측: 오늘 481커밋 중 이 훅이 낸 것은 3건뿐이라 제외를 떼도
   *   **흡수될 커밋이 없고**(보드 손커밋 184건은 그대로), `docs: 보드 …` 서술 메시지만 익명으로
   *   바뀐다 — 그 메시지가 인계문의 재료다. 근거는 갈렸어도 **막는 방향은 같다.** */
  const 보드들 = ['docs/세션보드.md', 'docs/_ops/보드/33b4bf84.md'];
  for (const f of 보드들) 쓰기(root, f, '| 줄 |');
  만짐기록(state, root, 'me-2', 보드들);
  지문기록(state, root, 'me-2', 보드들);   // 지문이 있어도 보드는 안 실린다
  const 전 = 머리해시(root);
  const out = 훅실행(root, state, 'me-2');
  assert.strictEqual(out, '', '후보 0건인데 입을 열었다');
  assert.strictEqual(머리해시(root), 전, '보드가 커밋됐다');
});

test('구문 깨진 js·json 은 대기, 나머지는 실린다', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'ok.md', '멀쩡');
  쓰기(root, 'bad.js', 'function ( {');   // 구문 오류
  쓰기(root, 'bad.json', '{ "반쪽": ');   // 깨진 JSON — settings.json 이 이 꼴로 실리면 훅 전체가 죽는다
  만짐기록(state, root, 'me-3', ['ok.md', 'bad.js', 'bad.json']);
  지문기록(state, root, 'me-3', ['ok.md', 'bad.js', 'bad.json']);   // 내가 쓴 판이 맞다 — 막는 건 구문이다
  const out = 훅실행(root, state, 'me-3');
  const msg = JSON.parse(out).systemMessage;
  assert.match(msg, /구문 깨짐 2건 대기: bad\.js, bad\.json/);
  const 실린것 = git(['show', '--name-only', '--format=', 'HEAD'], root).trim().split(/\r?\n/);
  assert.deepStrictEqual(실린것, ['ok.md']);
  assert.match(git(['status', '--porcelain'], root), /bad\.js/, '깨진 파일이 커밋됐다 — push 되면 CI 적색(F078 계열)');
  assert.match(git(['status', '--porcelain'], root), /bad\.json/, '깨진 JSON 이 커밋됐다');
});

test('rebase 진행 중엔 아무것도 하지 않는다(F035·F038)', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'x.txt', '값');
  만짐기록(state, root, 'me-4', ['x.txt']);
  지문기록(state, root, 'me-4', ['x.txt']);
  fs.mkdirSync(path.join(root, '.git', 'rebase-merge'), { recursive: true });
  const 전 = 머리해시(root);
  const out = 훅실행(root, state, 'me-4');
  assert.strictEqual(out, '');
  assert.strictEqual(머리해시(root), 전);
});

test('남의 스테이징은 쓸리지 않는다 — 경로 못 박은 커밋(범위 규약)', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'other.txt', '남의 것');
  git(['add', '--', 'other.txt'], root);   // 남이 스테이지만 해 둔 상태(만짐 기록 없음)
  쓰기(root, 'mine.txt', '내 것');
  만짐기록(state, root, 'me-5', ['mine.txt']);
  지문기록(state, root, 'me-5', ['mine.txt']);
  훅실행(root, state, 'me-5');
  const 실린것 = git(['show', '--name-only', '--format=', 'HEAD'], root).trim().split(/\r?\n/);
  assert.deepStrictEqual(실린것, ['mine.txt'], '남의 스테이징이 커밋에 실렸다');
  assert.match(git(['diff', '--cached', '--name-only'], root), /other\.txt/, '남의 스테이지 항목이 사라졌다');
});

test('죽은 세션의 만짐 기록은 「함께」가 아니다 — 유물 위 내 편집은 실린다', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'y.txt', '이어받아 고침');
  만짐기록(state, root, 'me-6', ['y.txt']);
  만짐기록(state, root, 'dead-1', ['y.txt'], { 분전: 40 });   // 심장박동 멎음(기본 30분)
  지문기록(state, root, 'me-6', ['y.txt']);
  const out = 훅실행(root, state, 'me-6');
  assert.match(JSON.parse(out).systemMessage, /\[자동커밋\] 1개/);
  const 실린것 = git(['show', '--name-only', '--format=', 'HEAD'], root).trim().split(/\r?\n/);
  assert.deepStrictEqual(실린것, ['y.txt']);
});

test('SYNK_AUTOCOMMIT_OFF=1 이면 완전 침묵', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'z.txt', '값');
  만짐기록(state, root, 'me-7', ['z.txt']);
  지문기록(state, root, 'me-7', ['z.txt']);
  const 전 = 머리해시(root);
  const out = 훅실행(root, state, 'me-7', { SYNK_AUTOCOMMIT_OFF: '1' });
  assert.strictEqual(out, '');
  assert.strictEqual(머리해시(root), 전);
});

/* ── 형제 저장소(SYNK-talk) ─────────────────────────────────────────────────
 * 보드 18줄 중 5줄이 talk 를 만진다 — 여기가 첫 판에서 통째로 빠졌던 자리다.
 * 트랙은 appsscript 를 열고 `../SYNK-talk/…` 를 편집하므로 만짐 기록은 **내 키에 형제 접두**로
 * 남는다(touchKey ⓑ). 그 좌표를 형제 상대 경로로 되돌리는 것은 작업본소유자.형제세션들 몫이고,
 * 이 검사는 그 통로가 실제로 커밋까지 닿는지를 잰다. */
function 형제판(t) {
  const sib = fs.mkdtempSync(path.join(os.tmpdir(), '자동커밋형제-'));
  t.after(() => { try { fs.rmSync(sib, { recursive: true, force: true }); } catch (_) {} });
  git(['init', '-q'], sib);
  git(['config', 'user.email', 't@t'], sib);
  git(['config', 'user.name', 't'], sib);
  fs.writeFileSync(path.join(sib, 'seed.txt'), 's');
  git(['add', '--', 'seed.txt'], sib);
  git(['commit', '-qm', 'seed'], sib);
  return { 뿌리: sib, 이름: path.basename(sib) };
}

test('형제 저장소(talk) 파일도 커밋한다 — 두 저장소가 각자 한 줄', (t) => {
  const { root, state } = 판(t);
  const 형제 = 형제판(t);
  쓰기(root, 'here.md', '이쪽');
  쓰기(형제.뿌리, 'src/제출API.ts', '저쪽');
  만짐기록(state, root, 'me-9', ['here.md', `../${형제.이름}/src/제출API.ts`]);
  지문기록(state, root, 'me-9', ['here.md', `../${형제.이름}/src/제출API.ts`], { SYNK_OWNER_SIBLINGS: 형제.뿌리 });

  const out = 훅실행(root, state, 'me-9', { SYNK_OWNER_SIBLINGS: 형제.뿌리 });
  const msg = JSON.parse(out).systemMessage;
  assert.match(msg, /\[자동커밋\] 1개/, msg);
  assert.match(msg, new RegExp(`\\[자동커밋\\] ${형제.이름} 1개`), `형제 저장소 줄이 없다: ${msg}`);

  assert.deepStrictEqual(git(['show', '--name-only', '--format=', 'HEAD'], root).trim().split(/\r?\n/), ['here.md']);
  assert.deepStrictEqual(git(['show', '--name-only', '--format=', 'HEAD'], 형제.뿌리).trim().split(/\r?\n/), ['src/제출API.ts']);
  assert.match(git(['log', '-1', '--format=%s'], 형제.뿌리).trim(), /^자동커밋: /, '형제 커밋 제목이 고정 접두가 아니다');
});

test('형제에서 남이 함께 만진 파일은 남긴다(F104) — 좌표가 달라도 판정은 같다', (t) => {
  const { root, state } = 판(t);
  const 형제 = 형제판(t);
  쓰기(형제.뿌리, '내것.ts', 'a');
  쓰기(형제.뿌리, '함께.ts', 'b');
  만짐기록(state, root, 'me-10', [`../${형제.이름}/내것.ts`, `../${형제.이름}/함께.ts`]);
  만짐기록(state, root, 'peer-2', [`../${형제.이름}/함께.ts`]);   // 살아있는 남도 ⓑ 좌표로 만졌다
  지문기록(state, root, 'me-10', [`../${형제.이름}/내것.ts`, `../${형제.이름}/함께.ts`], { SYNK_OWNER_SIBLINGS: 형제.뿌리 });

  const msg = JSON.parse(훅실행(root, state, 'me-10', { SYNK_OWNER_SIBLINGS: 형제.뿌리 })).systemMessage;
  assert.match(msg, /함께\.ts/, '함께 남긴 파일을 말하지 않았다');
  assert.deepStrictEqual(git(['show', '--name-only', '--format=', 'HEAD'], 형제.뿌리).trim().split(/\r?\n/), ['내것.ts']);
  assert.match(git(['status', '--porcelain'], 형제.뿌리), /함께\.ts/, '함께 파일이 형제 커밋에 쓸려 들어갔다');
});

test('형제가 rebase 중이어도 이 저장소는 커밋한다 — 저장소마다 독립', (t) => {
  const { root, state } = 판(t);
  const 형제 = 형제판(t);
  쓰기(root, '내쪽.md', '값');
  쓰기(형제.뿌리, '저쪽.ts', '값');
  만짐기록(state, root, 'me-11', ['내쪽.md', `../${형제.이름}/저쪽.ts`]);
  지문기록(state, root, 'me-11', ['내쪽.md', `../${형제.이름}/저쪽.ts`], { SYNK_OWNER_SIBLINGS: 형제.뿌리 });
  fs.mkdirSync(path.join(형제.뿌리, '.git', 'rebase-merge'), { recursive: true });
  const 형제전 = git(['rev-parse', 'HEAD'], 형제.뿌리).trim();

  const msg = JSON.parse(훅실행(root, state, 'me-11', { SYNK_OWNER_SIBLINGS: 형제.뿌리 })).systemMessage;
  assert.match(msg, /\[자동커밋\] 1개/, msg);
  assert.ok(!new RegExp(형제.이름).test(msg), `형제가 rebase 중인데 건드렸다: ${msg}`);
  assert.deepStrictEqual(git(['show', '--name-only', '--format=', 'HEAD'], root).trim().split(/\r?\n/), ['내쪽.md']);
  assert.strictEqual(git(['rev-parse', 'HEAD'], 형제.뿌리).trim(), 형제전, 'rebase 중인 형제가 커밋됐다');
});

/* ── 편집 지문 (F225) ───────────────────────────────────────────────────────
 * 실사고: 변이 시험이 놓아 둔 깨진 판을 이 훅이 「자동커밋: 미커밋 노출 차단」이라는 얼굴로
 * master 에 실었다(c3c8d98). 만진 기록은 PreToolUse 라 편집 의도까지고, 구문검사는 못 잡는다 —
 * 변이는 문법이 멀쩡한 채로 의미만 죽인다. 그래서 「내가 쓴 그 바이트인가」를 따로 잰다. */
test('내가 쓴 뒤 밖에서 바뀐 판은 안 싣는다 — 다시 저장하면 실린다(F225)', (t) => {
  const { root, state } = 판(t);
  const 판정 = path.join(root, '가드.js');
  쓰기(root, '가드.js', "module.exports = (a, b) => (a === b ? '동일' : '모름');\n");
  만짐기록(state, root, 'me-12', ['가드.js']);
  지문기록(state, root, 'me-12', ['가드.js']);

  // 변이 ① — 판정을 '모름' 고정으로 죽인다. **문법은 멀쩡하다**(옛 층인 구문검사로는 못 잡는다).
  쓰기(root, '가드.js', "module.exports = () => '모름';\n");
  // 파서는 `node --check` 와 같은 것을 **자식 없이** 쓴다 — 훅 회귀에서 node 를 직접 띄우면
  // 그 자리부터 미실행이 「통과」로 번역된다(tests/훅통로.test.js 가 저장소를 훑어 금지한다).
  assert.doesNotThrow(
    () => new vm.Script(fs.readFileSync(판정, 'utf8')),
    '변이가 구문 오류라 이 검사가 옛 층(구문검사)으로도 통과한다 — 탐지력이 없다',
  );

  const 전 = 머리해시(root);
  const msg = JSON.parse(훅실행(root, state, 'me-12')).systemMessage;
  assert.match(msg, /밖에서 바뀐\*\* 1건/, msg);
  assert.match(msg, /가드\.js/, msg);
  assert.strictEqual(머리해시(root), 전, '변이가 얹힌 판이 커밋됐다 — c3c8d98 재현');
  assert.match(git(['status', '--porcelain'], root), /가드\.js/, '깨진 판이 커밋에 실려 사라졌다');

  // 처방이 실제로 통하는가 — 「내 판이 맞으면 다시 저장하면 다음 턴에 실린다」(F103 축)
  지문기록(state, root, 'me-12', ['가드.js']);
  assert.match(JSON.parse(훅실행(root, state, 'me-12')).systemMessage, /\[자동커밋\] 1개/);
  assert.deepStrictEqual(git(['show', '--name-only', '--format=', 'HEAD'], root).trim().split(/\r?\n/), ['가드.js']);
});

test('편집 지문이 없으면 안 싣는다 — 거절된 편집도 만진 기록은 남는다', (t) => {
  const { root, state } = 판(t);
  쓰기(root, '내가안쓴것.txt', '남의 손이 놓은 내용');
  만짐기록(state, root, 'me-13', ['내가안쓴것.txt']);   // PreToolUse 는 거절돼도 기록을 남긴다
  const 전 = 머리해시(root);
  const msg = JSON.parse(훅실행(root, state, 'me-13')).systemMessage;
  assert.match(msg, /편집 지문이 없는 1건/, msg);
  assert.strictEqual(머리해시(root), 전, '지문 없는 파일이 커밋됐다 — 모름을 커밋한 것이다');
});

test('지문 훅 라우팅이 만진 기록보다 좁지 않다 — 좁으면 그 파일은 영영 안 실린다', () => {
  const s = JSON.parse(fs.readFileSync(path.join(REPO, '.claude', 'settings.json'), 'utf8'));
  const 도구들 = (이름) => {
    const 묶음 = [...(s.hooks.PreToolUse || []), ...(s.hooks.PostToolUse || [])]
      .filter((g) => (g.hooks || []).some((h) => String(h.command || '').includes(`${이름}.js`)));
    assert.ok(묶음.length, `${이름} 등록이 없다 — 미실행은 통과와 같은 모양이다(F044)`);
    return new Set(묶음.flatMap((g) => String(g.matcher || '').split('|')).map((x) => x.trim()).filter(Boolean));
  };
  const 만짐 = 도구들('track-collision');   // 후보를 만드는 쪽
  const 지문 = 도구들('edit-stamp');        // 그 후보를 통과시키는 쪽
  for (const 도구 of 만짐) {
    assert.ok(지문.has(도구), `만진 기록은 ${도구} 를 담는데 지문은 안 담는다 — 그 도구로 고친 파일은 무기록이라 영영 안 실린다(맹점 ③)`);
  }
});

/* ── F239 · 훅 파일이 깨지면 그 가드가 **조용히 열린다** (2026-08-08 실측) ──────────
 * 등록층(settings.json)의 F044 방어는 `command -v node` 와 `[ -f "$H" ]` 둘뿐이라, 파일이
 * **있는데** 깨진 경우를 그대로 통과시킨다. 이어지는 `node "$H"` 는 exit 1 + **빈 stdout** 으로
 * 죽고, 하네스는 빈 출력을 「통과」로 읽는다 — 즉 그 훅이 막던 것이 그동안 전부 통과한다.
 * 실물: 남과 같은 자리를 고치다 board-guard.js 에 `let 이전` 이 두 번 선언된 3분이 있었다.
 * 이 자리의 몫은 차단이 아니라 **드러내기**다 — 깨진 훅을 되돌리는 통로가 Edit 이라
 * 여기서 막으면 자기 처방을 막는다(F103). 안 싣는 쪽은 자동커밋이 이미 진다. */
function 지문훅출력(state, root, sid, 좌표) {
  const r = 훅띄우기(STAMP, {
    cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true,
    input: JSON.stringify({ session_id: sid, cwd: root, tool_name: 'Edit', tool_input: { file_path: path.resolve(root, 좌표) } }),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root, CLAUDE_CODE_HOST_SESSION_ID: sid,
      SYNK_CTXBUDGET_DIR: state, SYNK_OWNER_ROOT: '',
    },
  });
  return String(r.stdout || '');
}

test('[F239] 훅 파일을 실행 불가로 만들면 그 자리에서 말한다', (t) => {
  const { root, state } = 판(t);
  쓰기(root, '.claude/hooks/깨진훅.js', 'let 이전 = null;\nlet 이전 = null;\n');
  const out = 지문훅출력(state, root, 'me-f239', '.claude/hooks/깨진훅.js');
  assert.match(out, /실행 불가/, `깨진 훅을 조용히 넘겼다 — 그동안 그 가드는 열려 있다: ${out}`);
  assert.match(out, /깨진훅\.js/, '어느 파일인지 말하지 않으면 처방을 실행할 수 없다');
  /* 알림이 **인덱스를 대신하지 않는다** — 지문을 못 쓰면 자동커밋이 「무기록=모름」으로
   * 떨어져 그 파일은 고친 뒤에도 영영 안 실린다(조용한 쪽으로 새는 것이 더 나쁘다). */
  assert.ok(fs.readdirSync(state).some((f) => f.startsWith('editstamp-')), '알림을 내느라 편집 지문을 못 썼다');
});

test('[F239] 멀쩡한 훅 파일은 조용하다 — 거짓양성이 곧 무시다', (t) => {
  const { root, state } = 판(t);
  쓰기(root, '.claude/hooks/성한훅.js', 'process.exit(0);\n');
  assert.strictEqual(지문훅출력(state, root, 'me-f239b', '.claude/hooks/성한훅.js'), '');
});

test('[F239] 훅 밖의 깨진 js 는 이 알림 대상이 아니다 — 안 싣는 쪽은 자동커밋이 진다', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'tools/깨진도구.js', 'function ( {');
  assert.strictEqual(지문훅출력(state, root, 'me-f239c', 'tools/깨진도구.js'), '');
});

test('삭제는 만지지 않는다 — Edit·Write 는 지우지 않으므로 기록 밖의 손이다', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'del.txt', '지워질 것');
  git(['add', '--', 'del.txt'], root); git(['commit', '-qm', 'del 씨앗'], root);
  지문기록(state, root, 'me-8', ['del.txt']);   // 내가 쓴 뒤 밖의 손이 지웠다
  fs.rmSync(path.join(root, 'del.txt'));
  만짐기록(state, root, 'me-8', ['del.txt']);
  const 전 = 머리해시(root);
  const out = 훅실행(root, state, 'me-8');
  assert.strictEqual(out, '');
  assert.strictEqual(머리해시(root), 전, '삭제가 커밋됐다');
  assert.match(git(['status', '--porcelain'], root), /del\.txt/);
});

/* ── 반쪽 착지 (마찰 F248 · 2026-08-08 실사고) ───────────────────────────────
 * 구문검사는 「깨졌나」까지고 「이 커밋 하나로 판이 서는가」는 안 봤다. 실물 `fb0bbce` 가
 * `tests/safety.test.js` 의 새 `[vNEXT]` 케이스 129줄만 실었고 구현은 어디에도 없었다 —
 * run 31239587806 이 4건 실패하며 master 가 **60분간** 적색이었고, 그 상태는 남의 `/deploy`
 * 게이트를 그대로 막는다. 새는 방향이 침묵이 아니라 **남에게 전가된 적색**이다.
 * 🔑 여기서 재는 것은 양방향이다 — 적색을 떨어뜨리는가(탐지력) **그리고** 초록은 그대로
 *   싣는가(거짓양성). 뒤쪽이 무너지면 이 훅이 테스트를 영영 안 실어 F025 보호가 꺼진다. */
const 초록테스트 = "const t=require('node:test');const a=require('node:assert');\nt('초록',()=>{a.ok(true)});\n";
const 적색테스트 = "const t=require('node:test');const a=require('node:assert');\nt('적색',()=>{a.ok(false,'짝(구현)이 아직 없다')});\n";

test('🔴 지금 적색인 테스트는 안 싣는다 — 반쪽 착지가 master 를 빨갛게 만든다 (F248)', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'tests/맛보기.test.js', 적색테스트);
  쓰기(root, '구현.js', 'module.exports = 1;\n');
  만짐기록(state, root, 'me-248a', ['tests/맛보기.test.js', '구현.js']);
  지문기록(state, root, 'me-248a', ['tests/맛보기.test.js', '구현.js']);

  const msg = 훅실행(root, state, 'me-248a');
  assert.match(msg, /적색인\*{0,2} 테스트 1건/, `적색을 말하지 않았다 — 조용한 배제는 배제 안 한 것과 같다:\n${msg}`);
  const 실린것 = git(['show', '--name-only', '--format=', 'HEAD'], root);
  assert.ok(!/맛보기\.test\.js/.test(실린것),
    `적색 테스트가 실렸다 — 이 커밋이 그대로 master 를 빨갛게 만들고 남의 배포를 막는다:\n${실린것}`);
  /* 🔑 **떨어뜨리기지 보류가 아니다.** 적색을 만드는 건 그 테스트 파일 하나이므로 나머지는 싣는다 —
   *   통째로 보류하면 F025(미커밋 무보호) 쪽으로 사고가 옮겨갈 뿐이다. */
  assert.match(실린것, /구현\.js/,
    '적색 하나 때문에 나머지까지 보류했다 — 보호를 통째로 끄는 방향이다');
});

test('🟢 초록 테스트는 그대로 싣는다 — 여기서 거짓양성이 나면 테스트가 영영 안 실린다', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'tests/맛보기.test.js', 초록테스트);
  만짐기록(state, root, 'me-248b', ['tests/맛보기.test.js']);
  지문기록(state, root, 'me-248b', ['tests/맛보기.test.js']);

  const 전 = 머리해시(root);
  const msg = 훅실행(root, state, 'me-248b');
  assert.notStrictEqual(머리해시(root), 전,
    `초록 테스트를 안 실었다 — 이 훅의 존재 이유(F025 미커밋 노출 차단)가 통째로 꺼진다:\n${msg}`);
  assert.match(git(['show', '--name-only', '--format=', 'HEAD'], root), /맛보기\.test\.js/);
});

/* ── 그 초록은 무엇을 잰 초록인가 (F248+F444 한 트랙 처분 · 2026-08-15) ──────────────
 * 위 게이트는 실을 테스트를 **작업본**으로 돌린다. 커밋에 실리는 것은 후보뿐이라, 작업본에는
 * 있는데 이 커밋에서 빠지는 내용이 있으면 그 초록은 「커밋 뒤 HEAD 가 서는가」의 증거가 아니다.
 * 실측 재현 08-15: 짝을 무기록으로 빼면 작업본 초록 → 테스트만 착지 → **커밋 뒤 HEAD 적색**
 * (F248 08-08 master 60분 적색 · F444 2번째 08-15 `bea5da2f` 가 남의 /deploy 게이트를 막은 통로).
 * 🔑 여기서도 양방향을 잰다 — 보류하는가(탐지력) **그리고** 애먼 것까지 보류하진 않는가(거짓양성). */
const 짝의존테스트 = "const t=require('node:test');const a=require('node:assert');\n"
  + "t('짝이 선다',()=>{a.strictEqual(require('../구현.js'),2,'구현이 옛 판이다')});\n";

test('🔴 안 실리는 내용이 남으면 초록 테스트도 보류한다 — 작업본 초록은 HEAD 의 증거가 아니다 (F248·F444)', (t) => {
  const { root, state } = 판(t);
  // HEAD 에 «옛» 구현을 심는다 — 이 판이 커밋 뒤에 남는 짝이다.
  쓰기(root, '구현.js', 'module.exports = 1;\n');
  git(['add', '--', '구현.js'], root);
  git(['commit', '-qm', '옛 구현'], root);

  쓰기(root, '구현.js', 'module.exports = 2;\n');   // 작업본은 새 판 — 그래서 테스트가 초록이다
  쓰기(root, 'tests/맛보기.test.js', 짝의존테스트);
  쓰기(root, '딴것.txt', '이건 실려야 한다');
  만짐기록(state, root, 'me-444a', ['구현.js', 'tests/맛보기.test.js', '딴것.txt']);
  // 🔑 지문은 **짝만 빼고** 남긴다 → 구현.js 는 무기록으로 커밋에서 빠진다(F444 실측과 같은 모양)
  지문기록(state, root, 'me-444a', ['tests/맛보기.test.js', '딴것.txt']);

  const msg = 훅실행(root, state, 'me-444a');
  const 실린것 = git(['show', '--name-only', '--format=', 'HEAD'], root);
  assert.ok(!/맛보기\.test\.js/.test(실린것),
    `짝이 빠졌는데 테스트가 실렸다 — 커밋 뒤 HEAD 가 적색이 되고 남의 /deploy 가 막힌다:\n${실린것}`);
  assert.match(msg, /초록이지만 안 실었다/,
    `보류를 말하지 않았다 — 조용한 배제는 배제 안 한 것과 같다:\n${msg}`);
  /* 🔑 **떨어뜨리기지 보류가 아니다** — 통째로 멈추면 F025(미커밋 무보호) 쪽으로 사고가 옮겨간다. */
  assert.match(실린것, /딴것\.txt/,
    '테스트 하나 때문에 무관한 파일까지 보류했다 — 보호를 통째로 끄는 방향이다');
});

test('🟢 적색만 있는 판에서 새 게이트는 조용하다 — 방아쇠는 «안 실리는 내용»뿐(거짓양성 방어)', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'tests/적색.test.js', 적색테스트);
  쓰기(root, '딴것.txt', '이건 실려야 한다');
  만짐기록(state, root, 'me-444b', ['tests/적색.test.js', '딴것.txt']);
  지문기록(state, root, 'me-444b', ['tests/적색.test.js', '딴것.txt']);

  const msg = 훅실행(root, state, 'me-444b');
  const 실린것 = git(['show', '--name-only', '--format=', 'HEAD'], root);
  assert.match(실린것, /딴것\.txt/, `적색 하나가 나머지까지 보류했다:\n${msg}`);
  /* 🔑 떨어진 적색은 **그 자신**이라 다른 파일의 초록 근거를 흔들지 않는다 — 방아쇠에 넣지 않았다.
   *   넣으면 테스트 하나가 빨간 동안 나머지 테스트가 영영 안 실린다(거짓양성이 곧 무시다). */
  assert.ok(!/초록이지만 안 실었다/.test(msg),
    `적색뿐인 판에서 새 게이트가 발화했다 — 방아쇠를 «안 실리는 내용» 밖으로 넓힌 것이다:\n${msg}`);

  /* ⚠ **여기서 잰 것의 한계를 적어 둔다**(안 재고 넘어가지 않는다): 위 F248 게이트는 실을 테스트를
   *   **한 배치**로 돌려 하나가 빨가면 그 배치의 테스트를 전부 떨어뜨린다(파일 단위가 아니다).
   *   그래서 「적색 옆의 초록 테스트」는 이 게이트가 아니라 그 배치 성질 때문에 함께 보류된다 —
   *   보수적이라 새는 방향은 아니지만, 훅 주석의 「떨어뜨리기지 보류가 아니다」보다는 거칠다.
   *   이 트랙에서 안 고친다: F444 가 지목한 구멍이 아니고, 파일 단위로 쪼개면 Stop 예산이 파일 수만큼
   *   곱해진다(되돌림 비용이 모든 세션의 Stop 에 닿는다). 대기열 #Q96 에 한계로 적었다. */
});

test('🔑 못 잰 테스트는 **통과가 아니다** — 예산을 넘기면 안 싣고 말한다 (F207)', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'tests/느림.test.js',
    "const t=require('node:test');\nt('느림',async()=>{await new Promise((r)=>setTimeout(r,10000))});\n");
  만짐기록(state, root, 'me-248c', ['tests/느림.test.js']);
  지문기록(state, root, 'me-248c', ['tests/느림.test.js']);

  const 전 = 머리해시(root);
  // 이음매로 예산을 줄인다 — 45초를 실제로 기다려야만 재는 갈래는 결국 안 재게 된다.
  const msg = 훅실행(root, state, 'me-248c', { SYNK_AUTOCOMMIT_TEST_MS: '1500' });
  assert.match(msg, /못 쟀다/, `미측정을 말하지 않았다 — 조용한 미측정은 통과와 같은 모양이다:\n${msg}`);
  assert.strictEqual(머리해시(root), 전,
    '못 잰 판을 실었다 — 미실행을 통과로 읽은 것이다(F207 · 이 훅의 「모름은 커밋하지 않는다」와도 어긋난다)');
});
