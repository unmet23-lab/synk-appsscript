/* 보드 껍데기 정리 회귀 — 2026-08-12.
 *
 * 실측: `board-move` 가 완료 줄만 빼고 파일을 남겨 `docs/_ops/보드/` 262개 중 데이터행이 있는 건
 * 18개뿐이었다(0바이트 189 · 표 머리글만 55). 껍데기는 `board-guard` 가 **파일을 쓸 때마다**
 * 훑는 폴더에 쌓이므로 세션 수만큼 곱해지는 값이다.
 *
 * 이 도구는 **지우는** 도구라, 회귀가 지키는 성질은 「지운다」가 아니라 **「안 지운다」**쪽이다:
 *   ① 줄이 하나라도 남으면 안 지운다 — **유령까지** 센다(F322·F330·F331).
 *   ② 사람이 쓴 글이 남으면 안 지운다.
 *   ③ 미추적·미커밋·산 주인은 안 지운다.
 *   ④ 기본은 dry — `--실행` 없이는 파일이 사라지지 않는다.
 * 그리고 「몇 개를 봤고 몇 개를 건너뛰었나」를 낸다 — 0건과 미실행이 같은 모양이면 안 된다(F207).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 훅띄우기 } = require('./lib/훅띄우기');

const TOOL = path.join(__dirname, '..', 'tools', '보드껍데기정리.js');
/* 🔴 박동을 디스크에 쓰는 픽스처다 — 공유 폴더면 남의 sweep 이 지우고 내 가짜 세션이 남의
 *   판정에 섞인다. 사유 전문 = tests/lib/상태격리.js */
const { 격리된store } = require('./lib/상태격리');
const store = 격리된store(__filename);
const 보드id = require('../.claude/hooks/lib/board-id.js');

const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

const 머리 = ['# 보드 — x', '', '| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|'];
const 행 = (트랙) => `| 2026-08-11 | **${트랙}** | a.js | 작업중 |`;

/** 보드 폴더가 있는 진짜 git 저장소. `파일들` = { 이름: 내용 } — 전부 커밋된 상태로 만든다. */
function mk(파일들) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'husk-'));
  const 폴더 = path.join(dir, 'docs', '_ops', '보드');
  fs.mkdirSync(폴더, { recursive: true });
  for (const [이름, 내용] of Object.entries(파일들)) fs.writeFileSync(path.join(폴더, 이름), 내용, 'utf8');
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@synk.local');
  git(dir, 'config', 'user.name', 'husk-test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'fixture');
  return { dir, 폴더 };
}
const 있나 = (fx, 이름) => fs.existsSync(path.join(fx.폴더, 이름));
function run(fx, args = [], 덧env = {}) {
  return 훅띄우기([TOOL, ...args], {
    encoding: 'utf8', 통과코드: [0, 1],
    env: { ...process.env, SYNK_BOARD_ROOT: fx.dir, ...덧env },
  });
}

test('기본은 dry — 껍데기를 찾아내지만 **지우지 않는다**', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ 'aaaaaaaa.md': 머리.join('\n') + '\n' });
  const r = run(fx);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(있나(fx, 'aaaaaaaa.md'), '--실행 없이 지웠다 — 지우는 도구의 기본이 파괴적이면 안 된다');
  assert.match(String(r.stdout), /보기만 했다/, 'dry 였다는 사실을 안 알렸다');
});

test('--실행 이면 지우고 **한 커밋**으로 담는다', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ 'aaaaaaaa.md': 머리.join('\n') + '\n', 'bbbbbbbb.md': '' });
  const before = Number(git(fx.dir, 'rev-list', '--count', 'HEAD').stdout.trim());
  const r = run(fx, ['--실행']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!있나(fx, 'aaaaaaaa.md'), '머리글뿐인 껍데기가 안 지워졌다');
  assert.ok(!있나(fx, 'bbbbbbbb.md'), '0바이트 껍데기가 안 지워졌다');
  const after = Number(git(fx.dir, 'rev-list', '--count', 'HEAD').stdout.trim());
  assert.equal(after - before, 1, `커밋이 ${after - before}개 나갔다 — 정리가 새 장부값을 만들면 안 된다`);
  assert.equal(git(fx.dir, 'status', '--porcelain').stdout.trim(), '',
    '삭제가 커밋에 안 담겼다 — 작업본만 지우면 다음 체크아웃에서 되살아난다');
});

test('데이터행이 남아 있으면 **안 지운다**', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ 'aaaaaaaa.md': [...머리, 행('살아있는 트랙'), ''].join('\n') });
  assert.equal(run(fx, ['--실행']).status, 0);
  assert.ok(있나(fx, 'aaaaaaaa.md'), '선언이 든 파일을 지웠다 — 그 세션은 다음 턴에 트랙을 잃는다');
});

/* 🔑 `표줄` 은 넓은 판정이라 유령까지 센다. 유령을 「데이터행이 아니니 빈 파일」로 읽어
 * 조용히 지우면 유령보다 나쁘다 — 유령은 적어도 파일에 남아 `board.js` 가 stderr 로 드러낸다. */
test('**유령**이 남아 있으면 안 지운다 (규격 밖 줄을 조용히 버리지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const 유령 = '| 08-11 | **유령 트랙** | a.js | 완료 |';        // 날짜가 두 자리 = 조립기가 못 읽는다
  const fx = mk({ 'aaaaaaaa.md': [...머리, 유령, ''].join('\n') });
  assert.equal(run(fx, ['--실행']).status, 0);
  assert.ok(있나(fx, 'aaaaaaaa.md'), '유령만 남은 파일을 지웠다 — 그 줄은 어디에도 안 남는다');
  assert.ok(fs.readFileSync(path.join(fx.폴더, 'aaaaaaaa.md'), 'utf8').includes(유령));
});

test('**사람이 쓴 글**이 남아 있으면 안 지운다', { skip: !hasGit && 'git 없음' }, () => {
  const 메모 = '메모: 개원 뒤 다시 본다';
  const fx = mk({ 'aaaaaaaa.md': [...머리, 메모, ''].join('\n') });
  assert.equal(run(fx, ['--실행']).status, 0);
  assert.ok(있나(fx, 'aaaaaaaa.md'), '내 것이 아닌 글이 있는데 지웠다');
});

test('**미추적** 파일은 안 지운다 (git 이 모르면 되돌릴 길도 없다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ 'aaaaaaaa.md': 머리.join('\n') + '\n' });
  fs.writeFileSync(path.join(fx.폴더, 'cccccccc.md'), '', 'utf8');   // 커밋 안 된 새 파일
  const r = run(fx, ['--실행']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(있나(fx, 'cccccccc.md'), '미추적 파일을 지웠다 — 이력·stash·reflog 어디에도 없다(F025)');
  assert.ok(!있나(fx, 'aaaaaaaa.md'), '추적된 껍데기는 지웠어야 한다');
  assert.match(String(r.stdout), /미추적/, '건너뛴 사유를 안 냈다');
});

test('**미커밋 변경**이 있으면 안 지운다', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ 'aaaaaaaa.md': 머리.join('\n') + '\n' });
  fs.writeFileSync(path.join(fx.폴더, 'aaaaaaaa.md'), 머리.join('\n') + '\n\n', 'utf8');  // 손 안 댄 척 변경
  const r = run(fx, ['--실행']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(있나(fx, 'aaaaaaaa.md'), '남의 미커밋이 있는 파일을 지웠다(F073)');
});

/* 빈 파일이라 잃을 내용은 없지만, 그 세션이 지금 선언을 쓰는 중이면 `Edit` 이 「파일이 없다」로
 * 죽는다. 새는 방향을 「건너뛴다」로 둔다 — board-move 원칙 ⑥ 과 같은 축(F146·F304). */
test('**산 주인**의 파일은 안 지운다 (선언을 쓰는 중일 수 있다)', { skip: !hasGit && 'git 없음' }, () => {
  /* ⚠ 가짜 sid 도 **hex** 여야 한다 — 보드 파일 이름은 hex 8자리고, 이 시험이 처음에 `husk1234`
   * 를 써서 이름 파싱이 조용히 실패했다. 그 실패는 「검사를 건너뛰고 지웠다」로 나왔다 — 즉
   * 시험이 자기 전제를 못 세우면 초록이 아니라 **엉뚱한 초록**이 된다. */
  const sid = 'local_a17c1234-1111-2222-3333-444455556666';
  const 지문 = 보드id.지문(sid);
  assert.match(지문, /^[0-9a-f]{8}$/, '픽스처 지문이 hex 가 아니다 — 이름 파싱이 조용히 빗나간다');
  const fx = mk({ [`${지문}.md`]: 머리.join('\n') + '\n', 'aaaaaaaa.md': '' });
  const 최상위 = git(fx.dir, 'rev-parse', '--show-toplevel').stdout.trim();
  const 박동 = path.join(store.stateDir(), `track-${store.projectKey(최상위)}-${store.safeId(sid)}.json`);
  fs.mkdirSync(store.stateDir(), { recursive: true });
  fs.writeFileSync(박동, JSON.stringify({ touched: [] }), 'utf8');
  try {
    const r = run(fx, ['--실행']);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(있나(fx, `${지문}.md`), '살아있는 세션의 보드 파일을 지웠다');
    assert.ok(!있나(fx, 'aaaaaaaa.md'), '주인 없는 껍데기는 지웠어야 한다(과잉 보호로 아무것도 안 하면 안 된다)');
  } finally { try { fs.unlinkSync(박동); } catch (_) { /* 이미 없으면 됐다 */ } }
});

/* 이름에서 지문을 못 읽으면 주인을 못 가른다 → 건너뛴다. `보드id.지문` 의 익명 폴백은 일부러
 * hex 가 아니라(F288) 이런 이름이 실제로 생긴다. 「지문 없음 = 검사 통과」로 두면 산 세션의
 * 파일이 조용히 지워진다 — 새는 방향이라 **모르면 막는다**. */
test('**지문을 못 읽는 이름**은 안 지운다 (모르면 막는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ '유물-익명.md': 머리.join('\n') + '\n', 'aaaaaaaa.md': '' });
  const r = run(fx, ['--실행']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(있나(fx, '유물-익명.md'), '주인을 못 가르는 파일을 지웠다');
  assert.ok(!있나(fx, 'aaaaaaaa.md'), '가를 수 있는 껍데기는 지웠어야 한다');
  assert.match(String(r.stdout), /지문을 못 읽었다/, '건너뛴 사유를 안 냈다');
});

/* 「0건」과 「안 돌았다」가 같은 모양이면 안 된다 — 분모를 낸다(F207). */
test('분모를 낸다 — 몇 개를 보고 몇 개를 건너뛰었나', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ 'aaaaaaaa.md': '', 'bbbbbbbb.md': [...머리, 행('산 트랙'), ''].join('\n') });
  const r = run(fx);
  assert.match(String(r.stdout), /보드 파일 2개/, '본 개수를 안 냈다');
  assert.match(String(r.stdout), /지울 껍데기 1개/, '지울 개수를 안 냈다');
  assert.match(String(r.stdout), /건너뜀 1개/, '건너뛴 개수를 안 냈다');
});

test('지울 게 없으면 조용히 0으로 끝난다 (없음과 실패를 안 섞는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ 'bbbbbbbb.md': [...머리, 행('산 트랙'), ''].join('\n') });
  const r = run(fx, ['--실행']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(String(r.stdout), /지울 것이 없다/);
});

/* ── 미추적 처방 (실측 2026-08-14) ─────────────────────────────────────────────
 * 08-10 에 생긴 0바이트 4개가 나흘을 앉아 있었다. 차단은 옳았는데(미추적 삭제는 비가역)
 * **사유만 있고 다음 손이 없어서**, 부른 사람이 매번 「지울 것이 없다」만 읽고 돌아섰다.
 * 그래서 이 두 시험은 방향이 다르다 — 위쪽 시험들이 「안 지운다」를 지킨다면, 이 둘은
 * 「막고 나서 길을 낸다」를 지킨다. 둘 다 없으면 가드가 조용한 막다른 골목이 된다.  */
test('미추적 껍데기가 있으면 **처방을 낸다** (사유만 내고 끝내지 않는다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ 'bbbbbbbb.md': [...머리, 행('산 트랙'), ''].join('\n') });
  fs.writeFileSync(path.join(fx.폴더, 'cccccccc.md'), '', 'utf8');   // 미추적 껍데기
  const r = run(fx);
  assert.equal(r.status, 0, r.stderr);
  /* 지울 것이 0개라 조기 종료로 빠지는 자리다 — 처방이 그 위에 있어야 실제로 보인다. */
  assert.match(String(r.stdout), /지울 것이 없다/, '이 픽스처는 「지울 것 0」이어야 처방 자리를 시험한다');
  assert.match(String(r.stdout), /미추적 껍데기 1개/, '미추적 개수를 안 냈다');
  assert.match(String(r.stdout), /git add --/, '따라 할 명령이 없다 — 사유만 있는 차단은 아무도 안 따른다(F103)');
  assert.match(String(r.stdout), /보드\/cccccccc\.md/, '처방이 어느 파일인지 안 짚었다');
});

/* 🔑 맹점 ③ — 차단 사유가 시키는 명령을 **그 가드에 되먹여** 통과하는지 본다.
 *   따를 수 없는 처방은 우회를 정상 통로로 만든다. 그래서 출력에서 경로를 뽑아 실제로
 *   실행하고, 그 뒤 같은 도구가 지우는 데까지 간다.
 * ⚠ 셸에 안 맡긴다 — 명령 문자열을 그대로 태우면 Windows 코드페이지가 한글 커밋 메시지를
 *   깨뜨려, 처방이 멀쩡한데도 빨개진다(F296: repo 밖 환경에 기댄 검사는 CI에서 깨진다).
 *   시험하는 알맹이는 「이 경로들을 담으면 통과하는가」라 메시지 글자는 재는 대상이 아니다. */
test('그 처방을 **되먹이면 실제로 통과한다** (막다른 골목이 아니다)', { skip: !hasGit && 'git 없음' }, () => {
  const fx = mk({ 'bbbbbbbb.md': [...머리, 행('산 트랙'), ''].join('\n') });
  fs.writeFileSync(path.join(fx.폴더, 'cccccccc.md'), '', 'utf8');

  const 처방 = String(run(fx).stdout).split('\n').find((l) => l.includes('git add --'));
  assert.ok(처방, '처방 줄을 못 찾았다');
  const 경로들 = [...처방.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(경로들, ['docs/_ops/보드/cccccccc.md'], '처방이 짚은 경로가 그 파일이 아니다');

  assert.equal(git(fx.dir, 'add', '--', ...경로들).status, 0, '처방의 add 가 실패했다');
  assert.equal(git(fx.dir, 'commit', '-q', '-m', 'protect', '--', ...경로들).status, 0, '처방의 commit 이 실패했다');

  const r2 = run(fx, ['--실행']);
  assert.equal(r2.status, 0, r2.stderr);
  assert.ok(!있나(fx, 'cccccccc.md'), '처방을 그대로 따랐는데도 여전히 안 지운다 — 따를 수 없는 처방이다');
  assert.ok(있나(fx, 'bbbbbbbb.md'), '처방을 따르자 산 트랙까지 지웠다');
});
