'use strict';
/* 저장소 뒤처짐 회귀 — 「내가 보는 판이 origin 보다 낡았다」를 잡는 장치 (F192).
 *
 * 🔑 탐지력은 **전부 픽스처**가 진다. 이 훅이 노리는 상태(다른 기계의 세션이 clone 시점 판으로
 *   일한다)는 실저장소에서 재현할 수 없고, 실저장소를 요구하면 CI 는 origin·네트워크가 없어
 *   **초록**이 된다 — 그게 이 훅이 없애려는 형태(통과와 미실행이 같은 모양)와 똑같다.
 *   그래서 픽스처는 자체 `git init` 으로 origin 까지 만든다. 실저장소에는 아무것도 안 묻는다.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const 훅 = require(path.join(ROOT, '.claude', 'hooks', 'repo-staleness.js'));

/* ⚠ 시각을 심을 땐 `--date`(author) 만으로는 안 된다 — 훅이 읽는 `%ct` 는 **committer** 다.
 *   author 만 바꾸면 픽스처가 **조용히 미적용**되고, 그 상태는 「통과」와 같은 모양이다(첫 판에 실측). */
const git = (cwd, ...args) => {
  let env = process.env;
  if (args[0] && typeof args[0] === 'object') { env = { ...process.env, ...args.shift() }; }
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
    { cwd, encoding: 'utf8', env });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.stderr || r.stdout}`);
  return (r.stdout || '').trim();
};
const 있나 = spawnSync('git', ['--version']).status === 0;

/** origin(bare) + 두 클론(A=미는 쪽, B=뒤처지는 쪽). 실제 ref 거리를 만든다. */
function 판만들기() {
  const 집 = fs.mkdtempSync(path.join(os.tmpdir(), 'staleness-'));
  const origin = path.join(집, 'origin.git');
  git(집, 'init', '--bare', '-b', 'master', origin);
  const A = path.join(집, 'A');
  git(집, 'clone', '--quiet', origin, A);
  fs.writeFileSync(path.join(A, 'seed.txt'), '0');
  git(A, 'add', 'seed.txt');
  git(A, 'commit', '-m', 'seed');
  git(A, 'push', '--quiet', 'origin', 'master');
  const B = path.join(집, 'B');
  git(집, 'clone', '--quiet', origin, B);
  return { 집, origin, A, B };
}

/** A 에서 커밋을 n 개 밀어 B 를 뒤처지게 한다. `파일` 을 주면 그 경로를 건드린다. */
function 밀기(A, n, 파일 = 'seed.txt') {
  for (let i = 0; i < n; i++) {
    const p = path.join(A, 파일);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, `${i}\n`);
    git(A, 'add', '--', 파일);
    git(A, 'commit', '-m', `밀기 ${파일} ${i}`);
  }
  git(A, 'push', '--quiet', 'origin', 'master');
}

// ── ① 탐지력 (픽스처) ───────────────────────────────────────────────────────

test('origin/master 가 없으면 잴 것이 없다 — null (CI·픽스처에서 조용히 통과)', { skip: !있나 }, () => {
  const 집 = fs.mkdtempSync(path.join(os.tmpdir(), 'staleness-solo-'));
  git(집, 'init', '-b', 'master');
  fs.writeFileSync(path.join(집, 'a.txt'), 'x');
  git(집, 'add', 'a.txt');
  git(집, 'commit', '-m', 'a');
  assert.strictEqual(훅.재다(집, { fetch: false }), null);
});

test('최신이면 뒤 0 — 여기서 침묵해야 소음이 안 난다', { skip: !있나 }, () => {
  const { B } = 판만들기();
  assert.deepStrictEqual(훅.재다(B, { fetch: false }), { 뒤: 0 });
});

test('뒤처진 커밋 수를 정확히 센다 (방향이 뒤집히면 0 이 나와 조용해진다)', { skip: !있나 }, () => {
  const { A, B } = 판만들기();
  밀기(A, 5);
  git(B, 'fetch', '--quiet', 'origin', 'master');
  const r = 훅.재다(B, { fetch: false });
  assert.strictEqual(r.뒤, 5, 'HEAD..origin/master 를 뒤집으면 0 이 된다 — 새는 방향은 언제나 「조용함」이다');
});

test('🔑 나이는 **갈라진 지점**부터 잰다 — 내가 방금 커밋해도 내가 보는 판은 낡았다', { skip: !있나 }, () => {
  const { A, B } = 판만들기();
  /* 갈라진 지점의 시각을 과거로 못박는다. HEAD 기준으로 재는 구현이면 이 값이 0 에 가까워진다
   * (폰 세션이 방금 커밋한 상황이 정확히 이 모양이라, 여기서 「0분 전 판」으로 보이면 사고가 조용해진다). */
  const 옛 = '2020-01-01T00:00:00';
  fs.appendFileSync(path.join(A, 'seed.txt'), 'old\n');
  git(A, 'add', 'seed.txt');
  git(A, { GIT_COMMITTER_DATE: 옛 }, 'commit', '--date', 옛, '-m', '갈라짐 기준');
  git(A, 'push', '--quiet', 'origin', 'master');
  git(B, 'pull', '--quiet', '--ff-only', 'origin', 'master');
  밀기(A, 2);                       // origin 이 앞서간다
  git(B, 'fetch', '--quiet', 'origin', 'master');
  fs.writeFileSync(path.join(B, 'mine.txt'), 'now');   // B 는 **방금** 자기 커밋을 만든다
  git(B, 'add', 'mine.txt');
  git(B, 'commit', '-m', '내 최신 커밋');

  const r = 훅.재다(B, { fetch: false });
  assert.strictEqual(r.뒤, 2);
  assert.ok(r.나이분 > 60 * 24 * 365, `갈라진 지점 기준이면 수년치여야 한다 — 받은 값 ${r.나이분}분`);
});

test('세션보드 변경은 따로 센다 — 트랙 선택의 재료가 몇 번 바뀌었나', { skip: !있나 }, () => {
  const { A, B } = 판만들기();
  밀기(A, 3, 'seed.txt');
  밀기(A, 2, 훅.보드);
  git(B, 'fetch', '--quiet', 'origin', 'master');
  const r = 훅.재다(B, { fetch: false });
  assert.strictEqual(r.뒤, 5);
  assert.strictEqual(r.보드변경, 2, '경로 필터를 빼면 전체 커밋 수와 같아져 신호가 죽는다');
});

test('fetch:true 는 원격의 새 커밋을 실제로 끌어온다 (로컬 ref 만 보면 0 으로 조용해진다)', { skip: !있나 }, () => {
  const { A, B } = 판만들기();
  밀기(A, 4);
  // B 는 아직 fetch 를 안 했다 — 로컬 ref 만 보는 구현이면 여기서 0 이다
  assert.deepStrictEqual(훅.재다(B, { fetch: false }), { 뒤: 0 });
  assert.strictEqual(훅.재다(B).뒤, 4, 'fetch 를 안 하면 클라우드 세션에서 이 훅은 영영 침묵한다');
});

// ── ② 알림 본문 — 숫자만으로는 아무도 안 움직인다 ──────────────────────────

test('본문은 다음 한 수를 준다 (fetch 명령 + 클라우드 세션 지침)', () => {
  const 글 = 훅.본문({ 뒤: 34, 나이분: 36, 보드변경: 12 });
  assert.match(글, /34 커밋 뒤/);
  assert.match(글, /36분 전 판/);
  assert.match(글, /세션보드 \*\*12번\*\*/);
  assert.match(글, /git fetch origin master/, '무엇을 할지 없으면 알림이 아니라 소음이다');
  assert.match(글, /claude\/\*/, '클라우드 세션은 master 로 못 미는 것이 판단 재료다');
});

test('곁가지 정보가 없어도 본문은 선다 (부가 측정 실패가 알림을 죽이면 안 된다)', () => {
  const 글 = 훅.본문({ 뒤: 3, 나이분: null, 보드변경: null });
  assert.match(글, /3 커밋 뒤/);
  assert.doesNotMatch(글, /null/, 'null 이 사람 눈에 닿으면 그 알림은 신뢰를 잃는다');
});

test('0분·0번은 아예 안 적는다 — 「0분 전 판인데 8커밋 뒤」는 사람을 멈춰 세운다', () => {
  const 글 = 훅.본문({ 뒤: 8, 나이분: 0, 보드변경: 0 });
  assert.match(글, /8 커밋 뒤/);
  assert.doesNotMatch(글, /0분 전 판/, '커밋 간격 중앙값 1분인 저장소라 0분은 흔하고, 그 표기는 신호를 흐린다');
  assert.doesNotMatch(글, /세션보드 \*\*0번\*\*/);
});

// ── ③ F208 — 진행 중 git 작업 · autostash 잔재 ─────────────────────────────
// 실사고(2026-08-07): 남의 세션이 시작한 rebase 의 autostash 가 진행 중이던 세션의 미커밋
// 3파일을 조용히 HEAD 판으로 되돌렸다. 잔재 stash 는 7파일을 문 채 어느 층에도 안 보였다.

const { 훅띄우기 } = require('./lib/훅띄우기.js');
const 훅파일 = path.join(ROOT, '.claude', 'hooks', 'repo-staleness.js');

/** origin 없는 단독 저장소 — 진행중·스태시 검사는 origin 이 필요 없다. */
function 혼자판() {
  const 집 = fs.mkdtempSync(path.join(os.tmpdir(), 'staleness-op-'));
  git(집, 'init', '-b', 'master');
  fs.writeFileSync(path.join(집, 'a.txt'), 'x\n');
  git(집, 'add', 'a.txt');
  git(집, 'commit', '-m', 'a');
  return 집;
}

test('진행중작업: 상태 파일 네 형태를 각자 이름으로 읽고, 깨끗하면 null', { skip: !있나 }, () => {
  const 집 = 혼자판();
  const 방 = git(집, 'rev-parse', '--absolute-git-dir');
  assert.strictEqual(훅.진행중작업(집), null, '깨끗한 판에서 울리면 매 편집이 소음이 된다');
  for (const [씨앗, 이름] of [
    ['rebase-merge', 'rebase'], ['rebase-apply', 'rebase'],
    ['MERGE_HEAD', 'merge'], ['CHERRY_PICK_HEAD', 'cherry-pick'], ['REVERT_HEAD', 'revert'],
  ]) {
    const p = path.join(방, 씨앗);
    if (씨앗.startsWith('rebase')) fs.mkdirSync(p); else fs.writeFileSync(p, 'deadbeef\n');
    assert.strictEqual(훅.진행중작업(집), 이름, `${씨앗} 를 못 읽으면 그 작업 중의 편집이 조용히 쓸린다(F208)`);
    fs.rmSync(p, { recursive: true, force: true });
  }
});

test('진행중작업: 워크트리는 자기 방만 본다 — 메인의 rebase 로 워크트리를 세우면 거짓 경보다', { skip: !있나 }, () => {
  const 집 = 혼자판();
  const 딴방 = path.join(집, 'wt-checkout');
  git(집, 'worktree', 'add', '--quiet', '-b', 'wt', 딴방);
  fs.mkdirSync(path.join(git(집, 'rev-parse', '--absolute-git-dir'), 'rebase-merge'));
  assert.strictEqual(훅.진행중작업(집), 'rebase');
  assert.strictEqual(훅.진행중작업(딴방), null, '메인의 rebase 는 워크트리 파일을 안 쓸어간다 — 방을 섞으면 늑대소년이 된다');
});

test('갇힌스태시: autostash 잔재만 세고 주인이 일부러 둔 stash 는 안 센다', { skip: !있나 }, () => {
  const 집 = 혼자판();
  assert.deepStrictEqual(훅.갇힌스태시(집), []);
  fs.appendFileSync(path.join(집, 'a.txt'), 'dirty1\n');
  git(집, 'stash', 'push', '-m', '내가 일부러 둔 것');
  fs.appendFileSync(path.join(집, 'a.txt'), 'dirty2\n');
  git(집, 'stash', 'store', '-m', 'On master: autostash', git(집, 'stash', 'create'));
  const r = 훅.갇힌스태시(집);
  assert.strictEqual(r.length, 1, '일반 stash 까지 세면 홍수(거짓 경보)고, 잔재를 못 세면 갇힌 작업이 영영 조용하다');
  assert.match(r[0].ref, /^stash@\{\d+\}$/);
  assert.strictEqual(r[0].해시.length, 40, '해시가 없으면 「세션당 1회」 dedupe 가 설 자리가 없다');
});

// ── ④ F219 — 「갇힌 작업」과 「이미 쓰인 잔재」를 가른다 ─────────────────────
// 실측(2026-08-07 stash@{0}): 7조각 중 고유 작업이 **0** 이었는데도 알림은 「작업이 갇혀 있다」를
// 단정하고 `stash show -p` 를 시켰다 — 세션마다 같은 대조를 처음부터 다시 했다.

test('🔑 잔재조각: 동일·삭제·모름 을 가른다 — 「모름」만이 사람을 부를 이유다', { skip: !있나 }, () => {
  const 집 = 혼자판();
  fs.writeFileSync(path.join(집, 'b.txt'), 'b\n');
  fs.writeFileSync(path.join(집, 'c.txt'), 'c\n');
  git(집, 'add', '--', 'b.txt', 'c.txt');
  git(집, 'commit', '-m', 'bc');

  fs.appendFileSync(path.join(집, 'a.txt'), '주인이 결국 커밋할 것\n');   // → 동일
  fs.appendFileSync(path.join(집, 'b.txt'), '영영 안 커밋될 것\n');        // → 모름
  fs.rmSync(path.join(집, 'c.txt'));                                       // → 삭제
  git(집, 'stash', 'store', '-m', 'On master: autostash', git(집, 'stash', 'create'));

  git(집, 'add', '--', 'a.txt');   // stash create 는 작업본을 안 건드린다 — 같은 내용이 그대로 커밋된다
  git(집, 'commit', '-m', '주인이 결국 커밋했다');

  const m = new Map(훅.잔재조각(집, 'stash@{0}').map((c) => [c.경로, c.상태]));
  assert.strictEqual(m.get('a.txt'), '동일', 'HEAD 와 같은 조각을 「모름」으로 읽으면 F219 가 그대로 산다');
  assert.strictEqual(m.get('b.txt'), '모름');
  assert.strictEqual(m.get('c.txt'), '삭제', '삭제 조각엔 되살릴 내용이 없다');
});

test('🔑 발화: 조각이 전부 「동일·삭제」인 잔재로는 사람을 안 부른다 (F219)', { skip: !있나 }, () => {
  const { B } = 판만들기();
  const 상태집 = fs.mkdtempSync(path.join(os.tmpdir(), 'staleness-state3-'));
  const env = { ...process.env, SYNK_CTXBUDGET_DIR: 상태집, CLAUDE_CODE_HOST_SESSION_ID: 'staleness-f219-spent' };
  const 입력 = { input: JSON.stringify({ cwd: B }), env };

  fs.appendFileSync(path.join(B, 'seed.txt'), 'dirty\n');
  git(B, 'stash', 'store', '-m', 'On master: autostash', git(B, 'stash', 'create'));
  git(B, 'add', '--', 'seed.txt');
  git(B, 'commit', '-m', '주인이 결국 같은 내용을 커밋했다');

  assert.strictEqual(훅띄우기(훅파일, 입력).stdout.trim(), '',
    '잃은 것이 0인 잔재로 부르면 세션마다 같은 대조를 처음부터 다시 한다 — 실측이 정확히 그랬다');

  /* 조용히 넘긴 잔재에도 도장을 찍었나 — HEAD 가 움직여 「동일」이던 조각이 「모름」이 되는 순간
   * 같은 잔재가 **부활한다**. 도장을 알린 것에만 찍으면 여기가 빨개진다. */
  fs.appendFileSync(path.join(B, 'seed.txt'), '그 뒤 남이 더 고쳤다\n');
  git(B, 'add', '--', 'seed.txt');
  git(B, 'commit', '-m', 'HEAD 가 더 움직인다');
  const 도장길 = path.join(상태집, fs.readdirSync(상태집).find((f) => f.startsWith('staleness-')));
  const j = JSON.parse(fs.readFileSync(도장길, 'utf8'));
  fs.writeFileSync(도장길, JSON.stringify({ ...j, at: Date.now() - 6 * 60 * 1000 }));   // 스로틀만 연다
  assert.strictEqual(훅띄우기(훅파일, 입력).stdout.trim(), '',
    '한 번 「잃은 것 없음」으로 넘긴 잔재가 HEAD 가 움직였다고 되살아나면 늑대소년이 된다');
});

test('발화: 진행 중 rebase 는 스로틀 조용 창 **안**이어도, 뒤처짐 0 이어도 알린다', { skip: !있나 }, () => {
  const { B } = 판만들기();
  const 상태집 = fs.mkdtempSync(path.join(os.tmpdir(), 'staleness-state-'));
  const env = { ...process.env, SYNK_CTXBUDGET_DIR: 상태집, CLAUDE_CODE_HOST_SESSION_ID: 'staleness-f208-op' };
  const 입력 = { input: JSON.stringify({ cwd: B }), env };

  // 1차: 깨끗+최신 → 침묵하며 스로틀 도장을 찍는다
  assert.strictEqual(훅띄우기(훅파일, 입력).stdout.trim(), '', '깨끗한 판에서 울리면 소음이라 알림 자체가 죽는다');

  // 2차: rebase 진행 중 — 도장이 5분 안이지만 **울려야 한다** (검사를 스로틀 뒤로 옮기면 여기가 빨개진다)
  fs.mkdirSync(path.join(git(B, 'rev-parse', '--absolute-git-dir'), 'rebase-merge'));
  const out = JSON.parse(훅띄우기(훅파일, 입력).stdout);
  assert.match(out.systemMessage, /rebase 진행 중/);
  assert.match(out.hookSpecificOutput.additionalContext, /F208/);
  assert.match(out.hookSpecificOutput.additionalContext, /--quit/, '다음 한 수(abort 금지·--quit)가 없으면 알림이 아니라 소음이다');
});

test('발화: autostash 잔재는 측정 주기에 실려 알리고, 같은 잔재는 세션당 한 번이다', { skip: !있나 }, () => {
  const { B } = 판만들기();
  const 상태집 = fs.mkdtempSync(path.join(os.tmpdir(), 'staleness-state2-'));
  const env = { ...process.env, SYNK_CTXBUDGET_DIR: 상태집, CLAUDE_CODE_HOST_SESSION_ID: 'staleness-f208-stash' };
  const 입력 = { input: JSON.stringify({ cwd: B }), env };

  fs.appendFileSync(path.join(B, 'seed.txt'), 'dirty\n');
  git(B, 'stash', 'store', '-m', 'On master: autostash', git(B, 'stash', 'create'));

  const out = JSON.parse(훅띄우기(훅파일, 입력).stdout);
  assert.match(out.systemMessage, /autostash 잔재 1건/);
  assert.match(out.hookSpecificOutput.additionalContext, /stash show --stat stash@\{0\}/, '어느 stash 인지 못 짚으면 주인이 못 찾는다');
  assert.match(out.hookSpecificOutput.additionalContext, /seed\.txt/, '어느 조각을 대조해야 하는지 안 주면 전문을 다시 뜬다');

  // 같은 잔재로 2차 — 도장의 시각만 과거로 물려 스로틀을 열어도(측정은 다시 한다) 조용해야 한다
  const 도장 = fs.readdirSync(상태집).find((f) => f.startsWith('staleness-'));
  assert.ok(도장, '도장 파일이 없으면 dedupe 를 검사한 것이 아니다');
  const 도장길 = path.join(상태집, 도장);
  const j = JSON.parse(fs.readFileSync(도장길, 'utf8'));
  fs.writeFileSync(도장길, JSON.stringify({ ...j, at: Date.now() - 6 * 60 * 1000 }));
  assert.strictEqual(훅띄우기(훅파일, 입력).stdout.trim(), '', '한 잔재가 5분마다 다시 울리면 홍수가 되어 아무도 안 읽는다');
});

test('잔재 본문은 조각을 세어 보여주고 `-p` 대신 `--stat` 을 시킨다 (F219)', () => {
  const 조각 = [{ 경로: '동일.js', 상태: '동일' }, { 경로: '삭제.js', 상태: '삭제' }];
  for (let i = 0; i < 12; i++) 조각.push({ 경로: `모름${i}.js`, 상태: '모름' });
  const 글 = 훅.잔재본문([{ ref: 'stash@{0}', 해시: 'a'.repeat(40), 조각 }]);

  assert.match(글, /대조가 필요한 조각 \*\*12개\*\*/);
  assert.match(글, /나머지 2개는 HEAD 와 같거나 삭제/, '안 잃은 조각까지 대조 대상으로 보이면 일이 그만큼 늘어난다');
  assert.match(글, /모름0\.js/);
  assert.doesNotMatch(글, /모름11\.js/, '목록이 길면 안 읽힌다 — 안 읽히는 알림은 없는 것과 같다');
  assert.match(글, /…외 4개/, '자른 사실을 숨기면 「이게 전부」로 읽힌다');
  assert.match(글, /stash show --stat stash@\{0\}/);
  assert.doesNotMatch(글, /stash show -p/, '전문 -p 는 수천 줄이라 세션마다 같은 대조를 다시 시킨다(F219)');
  assert.match(글, /stash drop/, '끝나는 수가 없으면 다음 세션이 같은 대조를 또 한다');
  assert.doesNotMatch(글, /갇혀 있는데/, '단정은 실측에서 틀렸다 — 기계는 「모른다」까지만 안다');
});
