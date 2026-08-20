/* 미머지 가지에 앉은 보드 선언 — 점유 판정의 «분모» 회귀 (F521 · F524).
 *
 * 이 검사가 지키는 것: **「지금 집을 수 있는 것」이 메인 보드 안에서만 참이 되지 않게.**
 * 2026-08-17 실측(세션 `52393118`) — 대기열이 🟢 「지금 집을 수 있는 것 2건」으로 #Q99·#Q100 을
 * 불렀는데 **둘 다 이미 잡혀 있었다**(`93a2d32e`·`24b6c036`). 초록 2 = 빈 자리 0 + 가려진 것 2.
 * 기전: 08-15 확정 「코드 트랙은 워크트리+PR」의 순서가 ①EnterWorktree ②보드 선언 커밋 이라
 * 선언이 가지 안에 앉는데, `줄들(root)` 은 한 디렉터리만 읽는다. 규약이 바뀌면서 기존 장치의
 * 분모가 조용히 줄어든 자리다(CLAUDE.md 가드 맹점 ④ — 맞는 얼굴로 틀린 값).
 *
 * 탐지력은 **픽스처가 진다** — 파싱은 순수 함수라 git 없이 전부 재고, 실저장소는 계약만 본다
 * (F296: repo 밖 환경에 기대는 검사는 CI 에서 깨진다 · 못 재면 fail 아니라 skip 으로 드러낸다).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 보드 = require(path.join(ROOT, 'tools', 'lib', '보드.js'));

/** 실행층이 내는 모양 그대로 — 모양 정본은 `가지끝줄()` 하나다(손으로 베끼면 파서를 안 잰다). */
const 가지출력 = (가지, 파일, ...줄들) => 줄들.map((l) => 보드.가지끝줄(가지, 파일, l)).join('\n');

const 표줄 = (트랙, 파일칸 = '`tools/x.js`', 상태 = '▶착수') =>
  `| 2026-08-17 | **${트랙}** | ${파일칸} | ${상태} |`;

// ───────────────────────────────── 탐지력 (픽스처 · git 0)

test('🔑 [F521] 가지 안의 선언을 뽑는다 — 이게 0이면 코드 트랙 전부가 「빈 자리」로 불린다', () => {
  const 출력 = 가지출력('worktree-q99-talk-index-reach', '93a2d32e.md',
    '<!-- 세션 보드 정본 조각 -->', '', 표줄('#Q99 시트층 도달 0인 5종 갚기'));
  const r = 보드.가지줄들('.', { 출력 });
  assert.strictEqual(r.모름, false);
  assert.strictEqual(r.줄들.length, 1, `표줄 하나를 못 뽑았다: ${JSON.stringify(r.줄들)}`);
  assert.match(r.줄들[0].줄, /#Q99/);
  assert.strictEqual(r.줄들[0].출처.가지, 'worktree-q99-talk-index-reach');
  assert.strictEqual(r.줄들[0].출처.파일, '93a2d32e.md', '지문(=1차 신원)이 안 실렸다');
});

test('☠️ [F521] 표 머리글·구분선은 안 뽑는다 — `줄들()` 과 **같은 잣대**여야 한다', () => {
  const 출력 = 가지출력('가지A', 'aaaaaaaa.md',
    '| 날짜 | 트랙 | 만질 파일 | 상태/다음 |', '|---|---|---|---|', 표줄('진짜 줄'));
  const 줄들 = 보드.가지줄들('.', { 출력 }).줄들;
  assert.strictEqual(줄들.length, 1, `머리글·구분선이 섞였다: ${줄들.map((r) => r.줄).join(' // ')}`);
  assert.match(줄들[0].줄, /진짜 줄/);
});

test('☠️ [F521] 같은 줄이 여러 가지에 실려 와도 한 번만', () => {
  const 한줄 = 표줄('같은 선언');
  const 출력 = [가지출력('가지A', 'aaaaaaaa.md', 한줄), 가지출력('가지B', 'aaaaaaaa.md', 한줄)].join('\n');
  assert.strictEqual(보드.가지줄들('.', { 출력 }).줄들.length, 1);
});

test('🔑 [F521] 가지 귀속은 **줄마다** 갈린다 — 뭉치면 남의 가지 이름이 붙는다(실측 17줄 중 2줄)', () => {
  const 출력 = [
    가지출력('가지A', 'aaaaaaaa.md', 표줄('A 의 선언')),
    가지출력('가지B', 'bbbbbbbb.md', 표줄('B 의 선언')),
  ].join('\n');
  const 줄들 = 보드.가지줄들('.', { 출력 }).줄들;
  assert.strictEqual(줄들.length, 2);
  const 짝 = Object.fromEntries(줄들.map((r) => [r.출처.파일, r.출처.가지]));
  assert.strictEqual(짝['aaaaaaaa.md'], '가지A');
  assert.strictEqual(짝['bbbbbbbb.md'], '가지B', '두 번째 줄이 첫 가지 이름을 물려받았다');
});

test('☠️ 내용 안의 `:` 가 칸을 밀지 않는다 — 앞 둘만 떼야 한다(보드 줄엔 `http://`·`시각 12:18` 이 흔하다)', () => {
  const 한줄 = 표줄('12:18 에 겹쳤다 — https://example.test/x 참고');
  const 줄들 = 보드.가지줄들('.', { 출력: 가지출력('가지A', 'aaaaaaaa.md', 한줄) }).줄들;
  assert.strictEqual(줄들.length, 1, `내용의 콜론에서 잘렸다: ${JSON.stringify(줄들)}`);
  assert.strictEqual(줄들[0].줄, 한줄, '줄이 잘려 들어왔다 — 파일 칸이 내용 조각을 먹었다');
  assert.strictEqual(줄들[0].출처.가지, '가지A');
});

test('🔑 [F521] 실행층이 못 부르면 `모름: true` — 「없다」로 접으면 분모가 조용히 좁아진다(F207)', () => {
  const r = 보드.가지줄들('.', { 실행: () => null });
  assert.strictEqual(r.모름, true, '🔴 못 본 것을 「가지 선언 0」으로 접었다');
  assert.deepStrictEqual(r.줄들, []);
  const 던짐 = 보드.가지줄들('.', { 실행: () => { throw new Error('git 없음'); } });
  assert.strictEqual(던짐.모름, true, '예외도 「모름」이다 — 삼키고 빈손을 내면 같은 모양이 된다');
});

test('🔑 [F521] `출력` 주입구를 주면 git 을 **안 부른다** — 회귀가 저장소 상태에 안 기댄다', () => {
  let 불렀나 = false;
  const r = 보드.가지줄들('.', { 출력: 가지출력('가지A', 'aaaaaaaa.md', 표줄('X')), 실행: () => { 불렀나 = true; return null; } });
  assert.strictEqual(불렀나, false);
  assert.strictEqual(r.줄들.length, 1);
});

// ─────────────────── 실행층 — 「이력」이 아니라 「순변화」를 재나 (2026-08-17 · 이 함수의 두 번째 판)
//
// 🔴 왜 픽스처 문자열로는 못 잡나: 결함이 **어느 git 명령을 부르나**에 있었다. 첫 판은 `log -p` 로
//    커밋 이력을 훑어, 가지 안에서 `▶착수`→`✅종결` 로 고쳐 쓴 줄의 **두 판을 다 냈다**. 파서는
//    아무 잘못이 없어서 순수 함수 픽스처는 끝까지 초록이었다. 그래서 이 둘만 진짜 저장소를 세운다.
//    실측이 부른 값 — 이 저장소 활성 13줄 = 참 5 + 낡은 판 8(62%가 유령).

const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const g = (인자, cwd) => spawnSync('git', 인자, { cwd, encoding: 'utf8' });
const 보드파일 = (root, 지문) => path.join(root, 'docs', '_ops', '보드', `${지문}.md`);
const 쓰기 = (root, 지문, ...줄들) => {
  const p = 보드파일(root, 지문);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, ['<!-- 세션 보드 정본 조각 -->', '', ...줄들].join('\n'), 'utf8');
};

/** master 하나에 커밋 한 개가 있는 저장소. 세울 수 없으면 `null` — 통과로 위장하지 않는다. */
function 저장소세우기() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '보드가지-'));
  if (g(['init', '-q', '-b', 'master'], root).status !== 0) return null;
  g(['config', 'user.email', 't@t'], root);
  g(['config', 'user.name', 't'], root);
  쓰기(root, '00000000');
  g(['add', '-A'], root);
  if (g(['commit', '-qm', 'init'], root).status !== 0) return null;
  return root;
}

test('🔴 [핵심] 가지 안에서 고쳐 쓴 줄은 **최종판 하나**다 — 이게 깨지면 끝난 트랙이 자리를 계속 문다', (t) => {
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다 — 통과로 위장하지 않는다');
  g(['checkout', '-q', '-b', 'worktree-어떤트랙'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙', '`tools/x.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '선언'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙', '`tools/x.js`', '✅종결 — 다 했다'));
  g(['add', '-A'], root); g(['commit', '-qm', '종결'], root);

  const r = 보드.가지줄들(root);
  assert.strictEqual(r.모름, false, `git 을 못 불렀다: ${JSON.stringify(r)}`);
  assert.strictEqual(r.줄들.length, 1,
    `🔴 한 줄의 여러 판이 다 나왔다(=이력을 재고 있다): ${r.줄들.map((x) => x.줄).join(' // ')}`);
  assert.match(r.줄들[0].줄, /✅종결/, '낡은 판이 이겼다 — 최종 상태를 재야 한다');
  assert.strictEqual(보드.활성행(r.줄들[0].줄), false, '끝난 줄이 활성으로 세어진다 — 그 자리가 계속 잡혀 있게 된다');
});

test('☠️ master 가 그 사이 아카이브한 **남의 옛 줄**은 안 딸려 온다 — 가지 끝 전문을 읽으면 13→55 로 부푼다', (t) => {
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  // master: 남의 옛 줄이 있는 상태에서 가지를 뗀다
  쓰기(root, 'bbbb2222', 표줄('남의 옛 트랙', '`tools/남.js`', '작업중'));
  g(['add', '-A'], root); g(['commit', '-qm', '남의 줄'], root);
  g(['checkout', '-q', '-b', 'worktree-내트랙'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙', '`tools/x.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '내 선언'], root);
  // master 는 그 사이 남의 줄을 아카이브로 옮겼다(=파일에서 사라졌다)
  g(['checkout', '-q', 'master'], root);
  쓰기(root, 'bbbb2222');
  g(['add', '-A'], root); g(['commit', '-qm', '이관'], root);

  const 줄들 = 보드.가지줄들(root).줄들;
  assert.strictEqual(줄들.length, 1, `아카이브된 남의 옛 줄이 「가지 선언」으로 딸려 왔다: ${줄들.map((x) => x.줄).join(' // ')}`);
  assert.match(줄들[0].줄, /내 트랙/);
});

// ───────────────────────────────── 기준이 «신선한 쪽»인가 (F565)
//
// 🔴 왜 순수 픽스처로는 못 잡나: 결함이 **어느 ref 를 기준으로 부르나**에 있었다. 파서는 멀쩡하고,
//    낡은 기준으로 잰 값과 신선한 기준으로 잰 값이 **같은 모양**으로 나온다(새는 방향 = 「통과」).
//    그래서 이 절만 진짜 저장소를 세운다 — `update-ref` 로 origin 을 흉내내 네트워크는 0이다.

/** 로컬 master 가 뒤처진 트리를 그대로 만든다 — F565 가 실측한 그 배치.
 *  `origin/master`(=B) 는 남의 줄을 이미 받았고, 로컬 `master`(=A) 는 아직 못 받았다.
 *  내 가지는 `EnterWorktree` 처럼 **origin/master 에서** 떴다. 세울 수 없으면 `null`. */
function 뒤처진트리() {
  const root = 저장소세우기();
  if (!root) return null;
  const A = g(['rev-parse', 'HEAD'], root).stdout.trim();
  // origin 이 이미 받은 남의 줄(B)
  쓰기(root, 'bbbb2222', 표줄('남의 트랙 — 이미 머지됐다', '`tools/남.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '남의 줄'], root);
  const B = g(['rev-parse', 'HEAD'], root).stdout.trim();
  if (g(['update-ref', 'refs/remotes/origin/master', B], root).status !== 0) return null;
  // 내 가지는 origin/master(=B) 에서 뜬다
  g(['checkout', '-q', '-b', 'worktree-내트랙'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙', '`tools/x.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '내 선언'], root);
  // 로컬 master 만 뒤로 — 이게 「57 커밋 뒤」의 축소판이다
  g(['checkout', '-q', 'master'], root);
  if (g(['reset', '--hard', '-q', A], root).status !== 0) return null;
  return root;
}

test('🔴 [F565] 뒤처진 로컬 master 를 기준으로 삼으면 **이미 머지된 남의 줄**이 내 가지 선언으로 딸려 온다', (t) => {
  const root = 뒤처진트리();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다 — 통과로 위장하지 않는다');

  // 대조군 — 옛 순서(로컬 우선). 픽스처가 실제로 갈라내는지 먼저 못박는다(안 그러면 아래 초록이 공짜다).
  const 낡음 = 보드.가지줄들(root, { 기준: ['master', 'origin/master'] });
  assert.strictEqual(낡음.기준, 'master');
  assert.strictEqual(낡음.줄들.length, 2,
    `픽스처가 결함을 재현 못 했다 — 이 대조군이 2줄이 아니면 아래 검사는 아무것도 안 잰다: ${낡음.줄들.map((x) => x.줄).join(' // ')}`);
  assert.ok(낡음.줄들.some((x) => /남의 트랙/.test(x.줄)), '유령의 정체가 「남의 줄」이 아니다 — 다른 것을 재고 있다');

  // 본검사 — 지금 순서(origin 우선). 이때는 **조용해야** 한다(아래 assert).
  const 원래 = process.stderr.write.bind(process.stderr);
  let 말한것 = '';
  process.stderr.write = (s) => { 말한것 += String(s); return true; };
  let r;
  try { r = 보드.가지줄들(root); } finally { process.stderr.write = 원래; }
  assert.ok(!/F565/.test(말한것),
    `🔴 1순위로 쟀는데도 폴백 경고가 떴다 — 상시로 우는 경보는 사람이 무시하는 법을 배워 장치가 꺼진다: ${말한것.trim()}`);
  assert.strictEqual(r.모름, false, `git 을 못 불렀다: ${JSON.stringify(r)}`);
  assert.strictEqual(r.기준, 'origin/master', '기준이 신선한 쪽이 아니다 — 순서가 되돌아갔다');
  assert.strictEqual(r.줄들.length, 1,
    `🔴 이미 머지된 남의 줄이 「안 머지된 가지의 선언」으로 딸려 왔다(소비자 셋이 이 분모를 먹는다): ${r.줄들.map((x) => x.줄).join(' // ')}`);
  assert.match(r.줄들[0].줄, /내 트랙/);
});

test('☠️ [F565] `origin/master` 가 없으면 `master` 로 내려가되 **말한다** — 조용한 폴백이 그 대가다', (t) => {
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  g(['checkout', '-q', '-b', 'worktree-내트랙'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙', '`tools/x.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '내 선언'], root);
  g(['checkout', '-q', 'master'], root);

  const 원래 = process.stderr.write.bind(process.stderr);
  let 말한것 = '';
  process.stderr.write = (s) => { 말한것 += String(s); return true; };
  let r;
  try { r = 보드.가지줄들(root); } finally { process.stderr.write = 원래; }

  assert.strictEqual(r.모름, false, '원격이 없다고 판정 자체가 죽으면 새 클론에서 이 층이 통째로 꺼진다');
  assert.strictEqual(r.기준, 'master', '폴백이 안 걸렸다 — 이 픽스처엔 origin/master 가 없다');
  assert.strictEqual(r.줄들.length, 1, '폴백 경로에서 줄을 못 뽑았다');
  assert.match(말한것, /F565/, '🔴 폴백이 조용하다 — 낡은 기준으로 잰 값이 신선한 값과 같은 모양으로 나간다(맹점 ④)');
});

test('🔑 [F565] 주입구로 들어온 출력엔 기준이 `null` 이다 — 「안 쟀다」를 「1순위로 쟀다」로 접지 않는다', () => {
  const r = 보드.가지줄들('.', { 출력: 가지출력('가지A', 'aaaaaaaa.md', 표줄('내 선언')) });
  assert.strictEqual(r.기준, null);
  assert.strictEqual(r.모름, false, '주입구는 「못 봤다」가 아니다');
});

test('🔑 [F565] 기준 순서의 정본은 하나다 — 신선한 쪽이 먼저', () => {
  assert.strictEqual(보드.가지기준[0], 'origin/master',
    '순서가 되돌아갔다 — `EnterWorktree` 가 origin/master 에서 가지를 떼므로 로컬이 먼저면 늘 낡은 기준으로 잰다');
  assert.ok(보드.가지기준.includes('master'), '폴백이 사라졌다 — 원격 없는 클론에서 이 층이 통째로 꺼진다');
});

// ────────────────── 앞선 로컬 master 가 «가지»로 세어지는가 (①배포 검수 P1 · 2026-08-17)
//
// 🔴 F565 픽스처는 로컬 master 가 **뒤처진** 배치라 이 결함을 원리상 못 본다 — 방향이 반대다.
//    `git branch --no-merged origin/master` 는 로컬이 origin 보다 **앞설 때** master 자신을 싣고,
//    이 저장소는 「단발 편집은 master 직접」이 정본 동선이라 그 상태가 예외가 아니라 상시다.
//    그러면 master 의 평범한 보드 변경이 「미머지 가지의 선언」으로 둔갑하고, 소비자 셋
//    (대기열·board-guard·인계문)이 **이미 master 에 있는 일**에 「그 가지로 가라 · PR 을 닫아라」를 낸다.
//    새는 방향이 «없는 일을 만든다» 라 아무 화면도 안 빨개진다.

/** 로컬 master 가 origin 보다 **앞선** 트리 — 위 결함의 축소판. 세울 수 없으면 `null`. */
function 앞선트리() {
  const root = 저장소세우기();
  if (!root) return null;
  const A = g(['rev-parse', 'HEAD'], root).stdout.trim();
  if (g(['update-ref', 'refs/remotes/origin/master', A], root).status !== 0) return null;
  // 진짜 워크트리 가지 — origin/master 에서 뜬다
  g(['checkout', '-q', '-b', 'worktree-내트랙'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙 — 진짜 가지', '`tools/x.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '내 선언'], root);
  // master 직접 커밋 — 아직 안 밀었다(=origin 보다 앞섬)
  g(['checkout', '-q', 'master'], root);
  쓰기(root, 'bbbb2222', 표줄('master 직접 편집 — 가지가 아니다', '`docs/x.md`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', 'master 직접'], root);
  return root;
}

test('🔴 [P1] 앞선 로컬 `master` 는 «가지»가 아니다 — master 직접 편집이 미머지 가지 선언으로 딸려 오던 자리', (t) => {
  const root = 앞선트리();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다 — 통과로 위장하지 않는다');

  // 🔑 픽스처가 전제를 실제로 재현했나 — 이걸 안 못박으면 아래 초록이 공짜다(맹점 ②).
  const 목록 = g(['branch', '--no-merged', 'origin/master', '--format=%(refname:short)'], root)
    .stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  assert.ok(목록.includes('master'),
    `픽스처가 전제를 재현 못 했다 — git 이 master 를 안 실으면 이 검사는 아무것도 안 잰다: ${목록.join(' · ')}`);

  const r = 보드.가지줄들(root);
  assert.strictEqual(r.모름, false, `git 을 못 불렀다: ${JSON.stringify(r)}`);
  assert.strictEqual(r.기준, 'origin/master');
  assert.ok(!r.줄들.some((x) => /master 직접 편집/.test(x.줄)),
    `🔴 master 직접 편집이 가지 선언으로 실렸다 — 소비자가 없는 가지·PR 을 지시한다: ${r.줄들.map((x) => x.줄).join(' // ')}`);
  assert.strictEqual(r.줄들.length, 1, '진짜 가지 하나만 남아야 한다');
  assert.match(r.줄들[0].줄, /진짜 가지/);
});

test('🔑 [P1] 거름은 «기준에 대응하는 그 가지»만 — 이름이 비슷한 가지는 안 지운다', (t) => {
  const root = 앞선트리();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  g(['checkout', '-q', '-b', 'master-백업'], root);
  쓰기(root, 'cccc3333', 표줄('이름만 비슷한 가지', '`tools/y.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '비슷한 이름'], root);
  g(['checkout', '-q', 'master'], root);

  const r = 보드.가지줄들(root);
  assert.ok(r.줄들.some((x) => /이름만 비슷한 가지/.test(x.줄)),
    `🔴 거름이 너무 넓다 — master 로 시작하는 진짜 가지까지 지웠다: ${r.줄들.map((x) => x.줄).join(' // ')}`);
});

// ───────────────────────────────── 머리형 비켜남 (F524)

test('🔴 [F524] `무접촉=#Q99` 는 점유가 아니다 — 비켜난 쪽이 그 줄의 주인으로 적혔다(실측)', () => {
  const 파일칸 = 'talk `lib/이벤트검증.js` (⛔시트층 무접촉=#Q99 PR #23 남의 트랙 · 운영 DB 0)';
  const 텍스트 = 보드.만지는텍스트(파일칸);
  assert.ok(!보드.큐표식(텍스트).has('#Q99'), `비켜남 선언이 점유로 읽혔다: ${텍스트}`);
  assert.ok(보드.파일자리(텍스트).has('lib/이벤트검증.js'), '진짜 만지는 파일까지 같이 지웠다 — 반대로 샌 것이다');
});

test('🔴 [F524] 머리형은 **구절 경계를 넘는다** — `읽기만=A·B` 의 B 도 읽기만이다(실측 4건 중 2건이 이 모양)', () => {
  const 자리 = 보드.파일자리(보드.만지는텍스트('읽기만=엔진_셋업확장.js·Code.js'));
  assert.strictEqual(자리.size, 0, `구절에서 멈춰 절반만 닫혔다: ${[...자리].join(' · ')}`);
});

test('☠️ [F524] 부정어가 없으면 그대로 산다 — 넓히다 반대로 새면 겹침이 통째로 안 잡힌다', () => {
  const 자리 = 보드.파일자리(보드.만지는텍스트('`tools/a.js`·`tools/b.js` (회귀 신설)'));
  assert.ok(자리.has('tools/a.js') && 자리.has('tools/b.js'), `만지는 파일이 사라졌다: ${[...자리].join(' · ')}`);
});

test('☠️ [F524] 꼬리형은 그대로 산다 — 머리형을 넣느라 옛 규칙을 깨면 F384 가 되돌아온다', () => {
  const 텍스트 = 보드.만지는텍스트('`tools/a.js` · 남의 산 작업본 `tools/b.js` 무접촉');
  const 자리 = 보드.파일자리(텍스트);
  assert.ok(자리.has('tools/a.js'));
  assert.ok(!자리.has('tools/b.js'), `꼬리형 비켜남이 죽었다: ${텍스트}`);
});

test('🔑 [F384·F524] 안내문이 머리형을 **말한다** — 말 안 하는 표기는 없는 표기다', () => {
  const 안내 = 보드.비켜남표기안내();
  assert.match(안내, /읽기만=/, '가드가 자기가 읽는 형태를 안 말한다 — 세션에게 남는 길은 정보를 지우는 것뿐이다');
  for (const w of 보드.부정어휘) {
    assert.ok(안내.includes(w.보기), `목록에 있는데 안내문에 없다: ${w.보기}`);
  }
});

// ───────────────────────────────── 실저장소 (계약만 · 못 재면 skip)

test('🔑 [F521] 실저장소 — `가지줄들` 계약: 줄들은 배열이고 모름은 boolean', (t) => {
  let r;
  try { r = 보드.가지줄들(ROOT); } catch (e) { return t.skip(`git 을 못 불렀다: ${e.message}`); }
  assert.ok(Array.isArray(r.줄들), '줄들이 배열이 아니다');
  assert.strictEqual(typeof r.모름, 'boolean');
  if (r.모름) return t.skip('이 환경에선 git 이 안 돈다 — 탐지력은 위 픽스처가 진다');
  for (const 행 of r.줄들) {
    assert.ok(보드.표줄(행.줄), `표줄이 아닌 것이 섞였다: ${행.줄.slice(0, 60)}`);
    assert.strictEqual(typeof 행.출처.가지, 'string');
  }
});

/* ── ⑥ 원격 전용 가지 (마찰 F619 · 2026-08-18) ─────────────────────────────────
 *
 * ■ 무엇이 샜나 — 「재서 얻은 0」이 **안 본 0** 이었다
 *   `가지끝()` 이 후보를 `git branch --no-merged` 로 뽑았다. `-a` 가 없으니 **로컬 가지만** 본다.
 *   노트북에서는 안 샌다 — 「워크트리+PR」 규약이 트랙마다 로컬 가지를 만드니 미머지 가지가 전부
 *   로컬에 있다. 그런데 **새 클론·클라우드 세션**에는 남의 가지가 `origin/<이름>` 으로만 산다.
 *   그 판에서 이 함수는 후보 0을 받고 「가지가 없으면 재서 얻은 0」 줄을 그대로 지나
 *   `모름: false` 로 **「전부 봤다」를 단언**했다.
 *   실측 2026-08-18(`cloud_ddd2c370`): 로컬 미머지 가지 **2** vs 원격 **14** · 그 원격 가지에
 *   활성 보드 줄 **10**. 소비자 셋(`board-guard` 겹침 분모 · `대기열` 점유 · `friction --open`
 *   점유)에게 그 0 은 「빈 자리다 · 집어라」로 읽힌다 — 새는 방향이 **「통과」**다. 실제로 그
 *   거짓 0 을 믿고 착수해 같은 F608 을 두 세션이 지었다(F615 계열).
 *
 * 🔑 여기서 못박는 것 = **「0 을 냈으면 두 층을 다 세고 낸 것이다」**. 문구가 아니라 그 전제다.
 *   그래서 픽스처는 **로컬 가지가 0인 트리**를 만든다 — 옛 판이 초록일 수 없는 유일한 모양이다.
 */

/** 남의 가지가 `origin/<이름>` 으로만 사는 트리 = 새 클론·클라우드 세션의 상시 상태.
 *  로컬 가지는 **0개**다 — 옛 판(`--no-merged` 로컬만)은 여기서 반드시 0을 낸다. */
function 원격전용트리() {
  const root = 저장소세우기();
  if (!root) return null;
  const A = g(['rev-parse', 'HEAD'], root).stdout.trim();
  if (g(['update-ref', 'refs/remotes/origin/master', A], root).status !== 0) return null;
  g(['checkout', '-q', '-b', 'worktree-남트랙'], root);
  쓰기(root, 'bbbb2222', 표줄('**남의 트랙 — 원격 가지에만 산다**', '`tools/lib/보드.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '남의 선언'], root);
  const B = g(['rev-parse', 'HEAD'], root).stdout.trim();
  if (g(['update-ref', 'refs/remotes/origin/worktree-남트랙', B], root).status !== 0) return null;
  g(['checkout', '-q', 'master'], root);
  if (g(['branch', '-qD', 'worktree-남트랙'], root).status !== 0) return null;   // 클론에는 없던 것
  return root;
}

test('🔴 [F619 급소] 가지가 `origin/<이름>` 으로만 있어도 본다 — 클라우드 세션엔 그게 상시다', (t) => {
  const root = 원격전용트리();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다 — 통과로 위장하지 않는다');

  /* 대조군 — 픽스처가 결함을 실제로 재현하는지 먼저 못박는다(안 그러면 아래 초록이 공짜다).
   * 로컬 미머지 가지가 0이어야 옛 판이 0을 냈다는 말이 성립한다. */
  const 로컬만 = g(['branch', '--no-merged', 'origin/master', '--format=%(refname:short)'], root).stdout.trim();
  assert.strictEqual(로컬만, '',
    `픽스처가 「로컬 가지 0」을 못 만들었다 — 이 검사는 아무것도 안 잰다: ${JSON.stringify(로컬만)}`);

  const r = 보드.가지줄들(root);
  assert.strictEqual(r.모름, false, `git 을 못 불렀다: ${JSON.stringify(r)}`);
  assert.strictEqual(r.줄들.length, 1,
    '🔴 원격 전용 가지의 선언이 안 보인다 — 그 0 이 「빈 자리다·집어라」로 읽혀 같은 트랙을 두 벌 짓는다(F619)');
  assert.match(r.줄들[0].줄, /남의 트랙/);
  assert.strictEqual(r.줄들[0].출처.가지, 'origin/worktree-남트랙',
    '어느 가지인지 안 적으면 처방이 「어디를 보라」를 못 말한다');
});

test('🔴 [F619] 0 을 낼 때 **분모를 함께** 낸다 — 「가지가 없다」와 「가지를 못 봤다」가 갈리는 자리', (t) => {
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  g(['update-ref', 'refs/remotes/origin/master', g(['rev-parse', 'HEAD'], root).stdout.trim()], root);

  const 빈판 = 보드.가지줄들(root);
  assert.strictEqual(빈판.모름, false);
  assert.deepStrictEqual(빈판.분모, { 로컬: 0, 원격: 0, 훑음: 0 },
    '🔴 진짜 0 인데 분모가 없다 — 분모 없는 0 은 F619 의 거짓 0 과 글자 하나 다르지 않다(F207)');

  const 있는판 = 보드.가지줄들(원격전용트리() || root);
  assert.ok(있는판.분모 && 있는판.분모.원격 >= 1,
    `🔴 원격 층을 셌다는 증거가 반환에 없다: ${JSON.stringify(있는판.분모)}`);
});

test('🔑 [F619] 주입구로 들어온 출력엔 분모가 `null` 이다 — 「안 쟀다」를 「0개 훑었다」로 접지 않는다', () => {
  const r = 보드.가지줄들('.', { 출력: 가지출력('worktree-x', 'aaaa1111.md', 표줄('내 트랙')) });
  assert.strictEqual(r.분모, null, '주입구는 아무 가지도 안 훑는다 — 0 을 적으면 그게 거짓 분모다');
  assert.strictEqual(r.줄들.length, 1, '주입구 자체는 그대로 돌아야 한다');
});

test('☠️ [F619] 로컬 `X` 와 `origin/X` 가 **같은 판**이면 한 번만 훑는다 — 안 그러면 스폰이 두 배다', (t) => {
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  g(['update-ref', 'refs/remotes/origin/master', g(['rev-parse', 'HEAD'], root).stdout.trim()], root);
  g(['checkout', '-q', '-b', 'worktree-내트랙'], root);
  쓰기(root, 'aaaa1111', 표줄('내 트랙'));
  g(['add', '-A'], root); g(['commit', '-qm', '내 선언'], root);
  const H = g(['rev-parse', 'HEAD'], root).stdout.trim();
  g(['update-ref', 'refs/remotes/origin/worktree-내트랙', H], root);   // push 해 둔 상태 = 노트북 상시
  g(['checkout', '-q', 'master'], root);

  const r = 보드.가지줄들(root);
  assert.strictEqual(r.분모.로컬, 1);
  assert.strictEqual(r.분모.원격, 1, '픽스처가 로컬·원격 쌍을 못 만들었다');
  assert.strictEqual(r.분모.훑음, 1,
    `🔴 같은 판을 두 번 훑는다 — 노트북의 상시 상태라 스폰 값이 그대로 두 배가 된다: ${JSON.stringify(r.분모)}`);
  assert.strictEqual(r.줄들.length, 1);
  assert.strictEqual(r.줄들[0].출처.가지, 'worktree-내트랙',
    '🔴 이름이 원격판으로 남았다 — 사람이 따르는 처방(「그 가지로 가라」)은 짧은 쪽이라야 따를 수 있다');
});

test('☠️ [F619] 로컬이 원격보다 **앞서면** 둘 다 훑는다 — 접으면 안 민 커밋의 선언이 사라진다', (t) => {
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  g(['update-ref', 'refs/remotes/origin/master', g(['rev-parse', 'HEAD'], root).stdout.trim()], root);
  g(['checkout', '-q', '-b', 'worktree-내트랙'], root);
  쓰기(root, 'aaaa1111', 표줄('민 선언'));
  g(['add', '-A'], root); g(['commit', '-qm', '민 것'], root);
  g(['update-ref', 'refs/remotes/origin/worktree-내트랙', g(['rev-parse', 'HEAD'], root).stdout.trim()], root);
  쓰기(root, 'aaaa1111', 표줄('민 선언'), 표줄('**아직 안 민 선언**', '`tools/y.js`'));
  g(['add', '-A'], root); g(['commit', '-qm', '안 민 것'], root);
  g(['checkout', '-q', 'master'], root);

  const r = 보드.가지줄들(root);
  assert.strictEqual(r.분모.훑음, 2,
    `🔴 sha 가 다른데 접었다 — 안 민 커밋의 선언이 통째로 사라진다: ${JSON.stringify(r.분모)}`);
  assert.ok(r.줄들.some((x) => /아직 안 민 선언/.test(x.줄)),
    '🔴 로컬에만 있는 선언이 빠졌다 — 그 트랙이 「빈 자리」로 불린다');
});

test('🔴 [F619·F565] `origin/master` 는 «가지»가 아니다 — 뒤처진 로컬에서 그게 가지로 잡히면 F565 가 되돌아온다', (t) => {
  /* `-a` 로 넓히면서 새로 생긴 구멍이다: 로컬 master 가 뒤처진 판에서 `origin/master` 자신이
   * 「미머지 가지」로 잡힌다. 그 줄들은 「이미 머지된 남의 줄」이고, 그 층은 `원격줄들()` 이 진다.
   * 넓히면서 옛 계약을 흘리지 않았는지 여기서 판다. */
  const root = 뒤처진트리();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  const r = 보드.가지줄들(root);
  assert.strictEqual(r.모름, false);
  assert.ok(!r.줄들.some((x) => /남의 트랙/.test(x.줄)),
    `🔴 이미 머지된 남의 줄이 「안 머지된 가지의 선언」으로 딸려 왔다(F565 재발): ${r.줄들.map((x) => x.줄).join(' // ')}`);
  assert.strictEqual(r.줄들.length, 1, '내 가지의 선언 하나만 남아야 한다');
  assert.match(r.줄들[0].줄, /내 트랙/);
});

test('🔑 [F619] `활성줄전량` 이 가지 분모를 **그대로 올려 보낸다** — 층을 지나며 사라지면 아무도 못 읽는다', (t) => {
  /* 픽스처는 **가지 1개 · 선언 2줄**이다 — 「줄 수」와 「가지 수」가 갈려야 두 칸이 안 섞였음을
   * 증명한다(같은 수면 이 검사는 아무것도 안 잰다). */
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  g(['update-ref', 'refs/remotes/origin/master', g(['rev-parse', 'HEAD'], root).stdout.trim()], root);
  g(['checkout', '-q', '-b', 'worktree-남트랙'], root);
  쓰기(root, 'bbbb2222', 표줄('**남의 트랙 ①**'), 표줄('**남의 트랙 ②**', '`tools/y.js`'));
  g(['add', '-A'], root); g(['commit', '-qm', '선언 둘'], root);
  g(['update-ref', 'refs/remotes/origin/worktree-남트랙', g(['rev-parse', 'HEAD'], root).stdout.trim()], root);
  g(['checkout', '-q', 'master'], root);
  g(['branch', '-qD', 'worktree-남트랙'], root);        // 원격에만 남긴다 = 새 클론

  const a = 보드.활성줄전량(root);
  assert.ok(a.분모 && a.분모.가지분모, `🔴 가지 분모가 위층에서 사라졌다: ${JSON.stringify(a.분모)}`);
  assert.strictEqual(a.분모.가지분모.원격, 1, '원격 층을 셌다는 증거가 안 올라왔다');
  assert.strictEqual(a.분모.가지분모.훑음, 1, '훑은 가지는 하나다');
  assert.strictEqual(a.분모.가지, 2,
    `🔴 「가지 줄 수」 칸이 가지 «개수» 로 덮였다 — 두 칸이 섞이면 분모가 거짓이 된다: ${JSON.stringify(a.분모)}`);
});

test('🔴 [F619·F565] 폴백으로 `master` 를 기준 삼으면 **`origin/master` 가 가지로 잡힌다** — 거기서 F565 가 되살아난다', (t) => {
  /* `-a` 로 넓히면서 새로 생긴 자리다. 기준이 `origin/master` 일 때는 git 이 그 ref 자신을
   * `--no-merged` 에서 빼 주므로 안 뜬다 — 그래서 **폴백(`master`) 판에서만** 드러난다.
   * 그 판에서 `origin/master` 를 안 거르면, 이미 머지돼 origin 에 올라간 남의 줄이
   * 「아직 안 머지된 가지의 선언」으로 딸려 온다. 그 층은 `원격줄들()` 이 따로 지고,
   * 처방이 정반대다(앞은 `gh pr list`, 뒤는 `git merge --ff-only`). */
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다');
  const A = g(['rev-parse', 'HEAD'], root).stdout.trim();
  쓰기(root, 'bbbb2222', 표줄('**남의 트랙 — 이미 머지됐다**', '`tools/남.js`'));
  g(['add', '-A'], root); g(['commit', '-qm', '남의 줄'], root);
  g(['update-ref', 'refs/remotes/origin/master', g(['rev-parse', 'HEAD'], root).stdout.trim()], root);
  g(['reset', '--hard', '-q', A], root);               // 로컬 master 만 뒤로

  // 대조군 — 이 픽스처에서 `origin/master` 가 실제로 「미머지 가지」로 뜨는지 먼저 못박는다
  const 날것 = g(['branch', '-a', '--no-merged', 'master', '--format=%(refname:short)'], root).stdout;
  assert.match(날것, /origin\/master/,
    `픽스처가 결함을 재현 못 했다 — 이 대조군이 없으면 아래 초록은 공짜다: ${JSON.stringify(날것)}`);

  const r = 보드.가지줄들(root, { 기준: ['master'] });
  assert.strictEqual(r.모름, false);
  assert.ok(!r.줄들.some((x) => /남의 트랙/.test(x.줄)),
    `🔴 \`origin/master\` 가 가지로 잡혀 이미 머지된 남의 줄이 딸려 왔다(F565 재발): ${r.줄들.map((x) => x.줄).join(' // ')}`);
  assert.strictEqual(r.분모.원격, 0, `🔴 원격 후보로 세어졌다 — 거른 게 아니라 담은 것이다: ${JSON.stringify(r.분모)}`);
});

test('🔑 [F619] `실행` 주입구로 들어온 출력에도 분모는 `null` 이다 — 아무 가지도 안 훑었다', () => {
  /* `출력` 주입구는 위에서 판다. 여기는 **`실행` 주입구** — 실행층을 갈아 끼우면 그쪽은
   * `메모.분모` 를 안 적으므로, 그 빈칸을 `{0,0,0}` 으로 메우면 「안 쟀다」가 「0개 훑었다」가 된다.
   * 새는 방향은 「통과」다(0 을 좋은 0 으로 읽는다 · F207). */
  const r = 보드.가지줄들('.', { 실행: () => 가지출력('worktree-x', 'aaaa1111.md', 표줄('내 트랙')) });
  assert.strictEqual(r.모름, false, '주입구는 정상 경로다 — 모름이 아니다');
  assert.strictEqual(r.줄들.length, 1, '주입한 출력 자체는 그대로 파싱돼야 한다');
  assert.strictEqual(r.분모, null,
    `🔴 안 훑고 분모를 지어냈다 — 그 0 은 「가지가 없다」와 글자 하나 다르지 않다: ${JSON.stringify(r.분모)}`);
});

test('☠️ [F619 델타] `origin/HEAD` 는 **별칭이지 가지가 아니다** — 이름으로 거르면 안 걸린다', (t) => {
  /* 🔴 2026-08-18 실측(변이가 판 자리): 첫 판은 `버릴이름` 에 `'origin/HEAD'` 를 넣어 걸렀는데,
   *   그 ref 의 `%(refname:short)` 는 `origin/HEAD` 가 아니라 그냥 **`origin`** 이다. 그래서
   *   ①안 걸리고 ②같은 줄의 `!n.startsWith('origin/')` 가 그것을 **로컬 가지로** 센다.
   *   필터가 「맞는 얼굴로 안 도는」 자리라(맹점 ④) 코드를 읽는 사람은 막혔다고 믿는다.
   *   ⚠ 평소엔 `origin/HEAD` 가 `origin/master` 를 가리켜 `--no-merged` 가 알아서 뺀다 — 뜨는 것은
   *     기본 가지가 master 가 아니거나 그 ref 가 낡았을 때다. 이 픽스처가 그 판을 연출한다. */
  const root = 저장소세우기();
  if (!root) return t.skip('이 환경에선 git 저장소를 못 세운다 — 통과로 위장하지 않는다');
  const A = g(['rev-parse', 'HEAD'], root).stdout.trim();
  g(['update-ref', 'refs/remotes/origin/master', A], root);
  g(['checkout', '-q', '-b', '옮길가지'], root);
  쓰기(root, 'aaaa1111', 표줄('원격 전용 트랙', '`tools/x.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '선언'], root);
  const B = g(['rev-parse', 'HEAD'], root).stdout.trim();
  g(['checkout', '-q', 'master'], root);
  g(['update-ref', 'refs/remotes/origin/w1', B], root);
  g(['update-ref', 'refs/remotes/origin/HEAD', B], root);   // 별칭이 미머지 커밋을 가리킨다
  g(['branch', '-qD', '옮길가지'], root);

  // 🔑 픽스처가 전제를 재현했나 — 안 못박으면 아래 초록이 공짜다(맹점 ②).
  const 날것 = g(['branch', '-a', '--no-merged', 'origin/master', '--format=%(refname:short)'], root)
    .stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  assert.ok(날것.includes('origin'),
    `픽스처가 전제를 재현 못 했다 — git 이 별칭을 «origin» 으로 안 실으면 이 검사는 아무것도 안 잰다: ${날것.join(' · ')}`);

  /* 원격이 `origin` 하나라는 보장은 없다 — 이름으로 가르면 `upstream/x` 가 **로컬**로 세어진다.
   * 별칭이 걸러진 뒤엔 그 축이 안 드러나므로(변이가 구멍으로 잡았다) 여기서 함께 못박는다. */
  쓰기(root, 'bbbb2222', 표줄('다른 원격의 트랙', '`tools/y.js`', '▶착수'));
  g(['add', '-A'], root); g(['commit', '-qm', '업스트림 선언'], root);
  const C = g(['rev-parse', 'HEAD'], root).stdout.trim();
  g(['reset', '-q', '--hard', 'HEAD~1'], root);
  g(['update-ref', 'refs/remotes/upstream/w2', C], root);

  const r = 보드.가지줄들(root);
  assert.strictEqual(r.분모.로컬, 0,
    '🔴 원격 별칭·다른 원격을 **로컬 가지**로 셌다 — 분모가 조용히 틀리고, 그 분모가 「몇 개를 훑었나」의 정본이다');
  assert.strictEqual(r.분모.원격, 2, '별칭을 원격으로 세거나 다른 원격을 빠뜨리면 분모가 틀린다');
  assert.strictEqual(r.분모.훑음, 2, '같은 sha 를 두 번 훑거나 한 가지를 빠뜨렸다');
  assert.ok(!r.줄들.some((x) => x.출처 && x.출처.가지 === 'origin'),
    '🔴 가지 이름이 `origin` 으로 나간다 — 사람이 「그 가지로 가라」를 따를 수 없다');
});
