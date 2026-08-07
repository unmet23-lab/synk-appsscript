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
