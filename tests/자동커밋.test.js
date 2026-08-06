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
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const HOOK = path.join(REPO, '.claude', 'hooks', 'auto-commit.js');
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

function 훅실행(root, state, sid, extraEnv = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true,
    input: JSON.stringify({ session_id: sid, cwd: root }),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root, CLAUDE_CODE_HOST_SESSION_ID: sid,
      SYNK_CTXBUDGET_DIR: state, SYNK_OWNER_ROOT: '', SYNK_AUTOCOMMIT_OFF: '',
      ...extraEnv,
    },
  });
  assert.strictEqual(r.status, 0, `훅이 0 아닌 코드로 죽었다(편의 장치는 절대 막지 않는다): ${r.stderr}`);
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

  const out = 훅실행(root, state, 'me-1');
  const msg = JSON.parse(out).systemMessage;
  assert.match(msg, /\[자동커밋\] 2개/, msg);
  assert.match(msg, /shared\.md/, '함께 남긴 파일을 말하지 않았다');

  const 제목 = git(['log', '-1', '--format=%s'], root).trim();
  assert.ok(제목.startsWith('자동커밋: '), `제목이 고정 접두가 아니다(=[배포] 오발 방지 실패 가능): ${제목}`);
  const 실린것 = git(['show', '--name-only', '--format=', 'HEAD'], root).trim().split(/\r?\n/);
  assert.deepStrictEqual(실린것.sort(), ['a.txt', 'sub/b.txt'], '커밋 범위가 내것 2개가 아니다');
  const 남은 = git(['status', '--porcelain'], root);
  assert.match(남은, /shared\.md/, '함께 파일이 커밋에 쓸려 들어갔다(F104 재현)');
});

test('보드는 절대 자동커밋하지 않는다(F102) — 침묵', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'docs/세션보드.md', '| 줄 |');
  만짐기록(state, root, 'me-2', ['docs/세션보드.md']);
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
  const out = 훅실행(root, state, 'me-6');
  assert.match(JSON.parse(out).systemMessage, /\[자동커밋\] 1개/);
  const 실린것 = git(['show', '--name-only', '--format=', 'HEAD'], root).trim().split(/\r?\n/);
  assert.deepStrictEqual(실린것, ['y.txt']);
});

test('SYNK_AUTOCOMMIT_OFF=1 이면 완전 침묵', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'z.txt', '값');
  만짐기록(state, root, 'me-7', ['z.txt']);
  const 전 = 머리해시(root);
  const out = 훅실행(root, state, 'me-7', { SYNK_AUTOCOMMIT_OFF: '1' });
  assert.strictEqual(out, '');
  assert.strictEqual(머리해시(root), 전);
});

test('삭제는 만지지 않는다 — Edit·Write 는 지우지 않으므로 기록 밖의 손이다', (t) => {
  const { root, state } = 판(t);
  쓰기(root, 'del.txt', '지워질 것');
  git(['add', '--', 'del.txt'], root); git(['commit', '-qm', 'del 씨앗'], root);
  fs.rmSync(path.join(root, 'del.txt'));
  만짐기록(state, root, 'me-8', ['del.txt']);
  const 전 = 머리해시(root);
  const out = 훅실행(root, state, 'me-8');
  assert.strictEqual(out, '');
  assert.strictEqual(머리해시(root), 전, '삭제가 커밋됐다');
  assert.match(git(['status', '--porcelain'], root), /del\.txt/);
});
