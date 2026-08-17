/* 인계문 생성기가 **origin/master 에만 있는 보드 선언**을 보는가 (F542 · F529 의 세 번째 얼굴).
 *
 * 이 검사가 지키는 것: **「트랙 없이 끝난 세션이다 — 다시 열 필요 없다」가 거짓으로 안 나가게.**
 * 앞의 둘과 층이 다르다 — F529 는 「아직 안 머지된 가지」였고 이건 **「이미 머지됐는데 이 트리가
 * 아직 안 받은 것」**이다. 「워크트리+PR」 규약의 마지막 두 걸음이 그 자리를 정확히 만든다:
 * `--닫기` 가 머지·push 하고 `ExitWorktree(remove)` 가 가지를 지우면, 그 트랙의 보드 줄은
 * **디스크에도 없고 가지에도 없고** origin/master 에만 산다.
 *
 * 🔴 실측 2건 (둘 다 「보드를 다시 열 필요 없다」로 나갔고 둘 다 줄은 멀쩡히 있었다):
 *   · `b20caad9` — PR #39 머지 + ExitWorktree 직후 · 로컬 master 가 **10 커밋 뒤**
 *   · `a0a573fb` — 이 트랙 · 첫 인계문을 받은 시점에 로컬 master 가 **11 커밋 뒤**
 *
 * 🔑 처방이 가지 층과 **정반대**라 이름표를 갈라 둔다 — 가지는 「열어 봐라(`gh pr list`)」,
 *   원격은 「받아라(`git merge --ff-only origin/master`)」다. 뭉치면 받은 세션이 없는 가지를 뒤진다.
 *
 * 탐지력은 **픽스처가 진다** — 원격 훑기는 주입구(`{원격:{출력}}`·`{원격:{실행}}`)로 넣고 git 을
 * 안 부른다(F296: repo 밖 환경에 기대는 검사는 CI 에서 깨진다). 실저장소는 여기서 안 본다.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const 보드 = require(path.join(ROOT, 'tools', 'lib', '보드.js'));
const report = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'session-report.js'));

/** 실행층 출력을 **진짜 모양으로** 짓는다 — 모양 정본은 `보드.가지끝줄()` 하나뿐이다.
 *  원격 층도 같은 「순diff 의 `+` 줄」이라 파서를 공유한다(`보드.원격표` 가 이름표만 갈아 단다).
 *  여기서 모양을 손으로 베끼면 정본이 바뀐 날 픽스처만 조용히 낡는다(맹점 ④ · F529 가 그렇게 죽었다). */
const 커밋 = (rev, 파일, ...줄들) =>
  줄들.map((l) => 보드.가지끝줄(rev, 파일, l)).join('\n');

const 표줄 = (트랙, 파일칸 = '`tools/x.js`', 상태 = '▶착수') =>
  `| 2026-08-17 | **${트랙}** | ${파일칸} | ${상태} |`;

const 지문 = 'b20caad9';
const SID = `local_${지문}-1111-2222-3333-444444444444`;

/* 🔴 **환경을 못박는다** — `hostSessionId` 는 `CLAUDE_CODE_HOST_SESSION_ID` 를 fallback 보다
 *   먼저 본다. 안 박으면 이 검사가 **돌리는 세션의 지문**으로 돌아 로컬에선 빨갛고 CI 에선 초록인
 *   «환경 의존» 검사가 된다(F296 · F529 회귀가 첫 판에서 정확히 그 모양으로 실패했다). */
process.env.CLAUDE_CODE_HOST_SESSION_ID = SID;

/** 보드 폴더가 **읽히되 비어 있는** 뿌리 — 「못 읽음(null)」과 「없음([])」을 가르는 재료.
 *  ⚠ git 저장소가 **아니다** — 그래서 원격 층이 「원리상 0개」인 쪽이다. */
function 빈뿌리() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'f542-'));
  fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
  return d;
}

/** 같은 뿌리인데 **저장소이기는 하다**(`.git` 이 있다) — 여기서 훑기가 실패하면 그건 「모름」이다. */
function 빈저장소() {
  const d = 빈뿌리();
  fs.mkdirSync(path.join(d, '.git'));
  return d;
}

/* ── 탐지력 — 픽스처가 진다 ───────────────────────────────────────────────── */

test('🔴 탐지력 — origin/master 에만 있는 내 선언을 찾는다 (옛 판은 디스크·가지만 읽어 못 찾았다)', () => {
  const 뿌리 = 빈뿌리();
  const 출력 = 커밋('origin/master', `${지문}.md`, 표줄('#Q99 exit_log 도달 3/5'));
  const t = report.boardTrack(뿌리, [], SID, { 가지: { 출력: '' }, 원격: { 출력 } });
  assert.ok(t, 'origin/master 에만 있는 선언을 못 찾았다 — F542 가 신고한 그 자리다');
  assert.match(t.track, /#Q99 exit_log 도달 3\/5/);
});

test('🔴 거짓 단정 금지 — 원격 층을 **못 훑으면** 「트랙 없이 끝난 세션이다」를 안 쓴다', () => {
  const 뿌리 = 빈저장소();
  // 실행이 null 을 돌려주면 `원격줄들` 은 `{줄들:[], 모름:true}` — 「없다」가 아니라 「못 봤다」다.
  const 글 = report.buildHandoff(뿌리, SID, {
    dirty: 0, 가지: { 출력: '' }, 원격: { 실행: () => null },
  });
  assert.ok(!글.includes('트랙 없이 끝난 세션이다'),
    '못 훑은 것을 「없다는 것이 실측이다」로 번역했다 (F542)');
  assert.ok(!글.includes('보드를 다시 열 필요 없다'),
    '확인을 금지하는 문장이 모름 위에 나갔다 — 못 보는 것을 넘어 안 보게 만든다');
  assert.match(글, /못 훑었다/, '분모가 좁아진 사실 자체를 안 적으면 읽는 쪽은 쟀다고 읽는다(F207)');
  assert.match(글, /merge --ff-only origin\/master/,
    '모름만 적으면 읽는 세션이 「없다」로 반올림한다 — 받아 올 명령을 함께 준다');
});

test('🔴 두 층을 다 못 재면 **둘 다** 밝힌다 — 한 층만 적으면 나머지가 조용히 통과한다', () => {
  const 뿌리 = 빈저장소();
  const 글 = report.buildHandoff(뿌리, SID, {
    dirty: 0, 가지: { 실행: () => null }, 원격: { 실행: () => null },
  });
  assert.match(글, /머지 안 된 가지/, '가지 층을 못 잰 사실이 빠졌다');
  assert.match(글, /origin\/master/, '원격 층을 못 잰 사실이 빠졌다');
  assert.ok(!글.includes('트랙 없이 끝난 세션이다'));
});

test('음성(과교정 금지) — 세 층을 다 훑었고 정말 없으면 그 단정은 그대로 나간다', () => {
  const 뿌리 = 빈뿌리();
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 출력: '' }, 원격: { 출력: '' } });
  assert.ok(글.includes('트랙 없이 끝난 세션이다'),
    '고치면서 참인 단정까지 죽였다 — 그러면 다음 세션이 없는 줄을 매번 뒤진다(F170)');
});

/* 🔴 과교정을 막는 두 번째 축 — 「훑기 실패」와 「훑을 원격이 없다」는 다르다.
 *   구분 없이 가면 임시 폴더에서 buildHandoff 를 부르는 픽스처(`트랙경계`·`컨텍스트예산`)가
 *   전건 「모름」이 되어 **참인 단정까지 죽는다.** 저장소가 아니면 원격 층은 원리상 0개다. */
test('🔴 저장소가 아닌 뿌리에선 「모름」이 아니다 — 참인 단정을 죽이지 않는다', () => {
  const 뿌리 = 빈뿌리();   // `.git` 없음
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 출력: '' }, 원격: { 실행: () => null } });
  assert.ok(글.includes('트랙 없이 끝난 세션이다'),
    '저장소가 아닌 곳에서 「못 훑었다」로 내렸다 — 잴 것이 없는 것과 못 잰 것을 뭉갰다');
});

test('원격 선언이 있으면 그 트랙이 인계문 본문에 실린다 (찾고도 안 싣는 자리가 없게)', () => {
  const 뿌리 = 빈뿌리();
  const 출력 = 커밋('origin/master', `${지문}.md`, 표줄('#Q102 재심 과녁을 둘로'));
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 출력: '' }, 원격: { 출력 } });
  assert.match(글, /#Q102 재심 과녁을 둘로/);
  assert.ok(!글.includes('트랙 없이 끝난 세션이다'));
});

/* ── 처방이 갈린다 — 가지는 「열어 봐라」, 원격은 「받아라」 ────────────────── */

test('🔴 원격 줄은 «가지» 로 안 말한다 — 없는 가지를 뒤지게 만드는 처방이 나가면 안 된다', () => {
  const 뿌리 = 빈뿌리();
  const 출력 = 커밋('origin/master', `${지문}.md`, 표줄('머지되고 워크트리는 거둔 트랙'));
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 출력: '' }, 원격: { 출력 } });
  assert.match(글, /merge --ff-only origin\/master/,
    '원격 줄인데 받아 올 명령을 안 줬다 — 다음 세션의 board.js·git log 가 계속 낡은 판을 읽는다');
  assert.ok(!글.includes('아직 머지 안 된 가지'),
    '이미 머지된 줄을 「안 머지됐다」로 말했다 — 받은 세션이 지워진 가지를 뒤진다(처방이 정반대다)');
});

/* 🔴 실측 재현 (bare origin + `origin/master` 에서 뗀 열린 가지 · 2026-08-17):
 *   `EnterWorktree` 가 origin/master 에서 가지를 떼므로 그 가지는 로컬 master 가 안 받은 커밋을
 *   **이미 들고 있다.** `가지끝` 의 기준은 늘 로컬 master 라, 순diff 에 **이미 머지된 남의 줄**이
 *   딸려 온다 → 인계문이 「아직 머지 안 된 가지 X · `gh pr list`」로 나가고 그 PR 은 이미 닫혔다. */
test('🔴 이미 머지된 줄이 가지 층에 딸려 와도 «가지» 로 말하지 않는다', () => {
  const 뿌리 = 빈뿌리();
  const 줄 = 표줄('머지됐는데 열린 가지가 아직 들고 있다');
  const 글 = report.buildHandoff(뿌리, SID, {
    dirty: 0,
    가지: { 출력: 커밋('worktree-남의트랙', `${지문}.md`, 줄) },
    원격: { 출력: 커밋('origin/master', `${지문}.md`, 줄) },   // ← 바이트 그대로 = 이미 머지된 판
  });
  assert.match(글, /merge --ff-only origin\/master/,
    '이미 머지된 줄인데 「받아라」를 안 줬다 — 로컬은 계속 뒤처진 채 다음 세션으로 간다');
  assert.ok(!글.includes('아직 머지 안 된 가지'),
    '이미 닫힌 PR 을 열어 보라고 시켰다 — 따라가면 빈손이다(F103 무늬)');
});

test('음성 — 가지가 «더 새 판»을 들고 있으면 그건 그대로 가지다 (바이트가 다르다)', () => {
  const 뿌리 = 빈뿌리();
  const 글 = report.buildHandoff(뿌리, SID, {
    dirty: 0,
    가지: { 출력: 커밋('worktree-내트랙', `${지문}.md`, 표줄('한 트랙', '`tools/x.js`', '▶착수 — ②부터')) },
    원격: { 출력: 커밋('origin/master', `${지문}.md`, 표줄('한 트랙', '`tools/x.js`', '▶착수')) },
  });
  assert.match(글, /아직 머지 안 된 가지/,
    '가지에 더 새 판이 있는데 「이미 머지됐다」로 접었다 — 낡은 상태 칸이 인계된다');
  assert.match(글, /②부터/, '넘긴 상태 칸이 가지의 새 판이 아니다');
});

test('가지 줄은 그대로 «가지» 로 말한다 — 이 수리가 F529 문구를 안 갈아엎었다', () => {
  const 뿌리 = 빈뿌리();
  const 출력 = 커밋('worktree-q100', `${지문}.md`, 표줄('#Q100 수집 표식 범위 판정'));
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 출력 }, 원격: { 출력: '' } });
  assert.match(글, /아직 머지 안 된 가지/, 'F529 의 가지 문구가 이 수리로 죽었다');
  assert.ok(!글.includes('merge --ff-only'), '가지 줄에 원격 처방이 섞였다');
});

/* ── 「모름」과 「0개」를 가르는 계약 (F207) ──────────────────────────────── */

test('🔑 원격몫 — 저장소인데 훑기가 실패하면 「모름」을 유지한다', () => {
  const r = report.원격몫(빈저장소(), { 원격: { 실행: () => null } });
  assert.equal(r.모름, true, '저장소에서 못 부른 것을 「0개」로 접었다 — F542 가 신고한 병 그 자체다');
  assert.deepEqual(r.줄들, []);
});

test('🔑 원격몫 — 저장소가 아니면 「모름」이 아니라 「0개」다', () => {
  const r = report.원격몫(빈뿌리(), { 원격: { 실행: () => null } });
  assert.equal(r.모름, false, '잴 것이 없는 것을 못 잰 것으로 올렸다 — 참인 단정이 통째로 죽는다');
});

test('🔑 원격줄들 — ref 가 아예 없으면 「모름」이 아니라 재서 얻은 0 이다', () => {
  const r = 보드.원격줄들(빈뿌리(), { 실행: () => '' });
  assert.equal(r.모름, false);
  assert.deepEqual(r.줄들, []);
});

/* 🔑 분모는 `boardTrack` 이 **실제로 훑는 범위**와 같아야 한다 — 저쪽이 원격까지 보는데 여기서
 *   안 세면 두 통로가 갈라지고, 갈라진 쪽은 「모호 0 = 실측된 없음」으로 기운다. 즉 **더 센
 *   단정**이 나간다(맹점 ④ · F529 가 가지 층에서 같은 값을 이미 치렀다). */
test('🔑 무주줄 — 원격 층의 «주인 못 가리는 줄»도 같은 분모에 든다', () => {
  const 뿌리 = 빈뿌리();
  const 모호 = 커밋('origin/master', '유물-옛.md', 표줄('주인을 안 밝힌 옛 줄'));
  const 글 = report.buildHandoff(뿌리, SID, { dirty: 0, 가지: { 출력: '' }, 원격: { 출력: 모호 } });
  /* ⚠ 여기서 `includes('트랙 없이 끝난 세션이다')` 로 재면 **안 된다** — 「모호 N개」 갈래의
   *   문장도 그 말로 «끝난다»(…그 세션 것이 아니면 트랙 없이 끝난 세션이다). 첫 판이 그렇게 재서
   *   빨개졌고, 재 보니 회귀가 아니라 내 잣대가 틀렸다. 단정만의 말로 못박는다. */
  assert.ok(!글.includes('보드를 다시 열 필요 없다'),
    '원격 층의 모호한 줄을 분모에서 뺐다 — 더 센 단정이 나간다(F529 와 같은 자리)');
  assert.match(글, /못 가리는 줄이 \*\*1개\*\*/, '모호 수를 안 세면 읽는 쪽이 「쟀다」로 읽는다');
});

/* ── 실행층 — 세 점(`HEAD...ref`)이라야 «내가 안 받은 것»만 남는다 ────────── */

/* ⚠ 이 하나만 **진짜 git** 을 부른다(위는 전부 픽스처다). git 이 없거나 실패하면 **fail 이 아니라
 *   skip** 이다 — repo 밖 환경에 기대는 검사는 CI 에서 깨진다(F296). 대신 여기가 아니면
 *   `원격끝()` 의 세 점 결정을 아무도 안 재고, 두 점으로 바뀌면 **내가 앞선 줄까지 섞여** 들어온다. */
test('🔑 원격끝 — 두 점이 아니라 세 점이다 (로컬에만 있는 줄은 안 섞인다)', (t) => {
  const { spawnSync } = require('node:child_process');
  const d = 빈뿌리();
  const git = (...a) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
  const 준비 = [
    ['init', '-q'], ['config', 'user.email', 'x@x'], ['config', 'user.name', 'x'],
    ['config', 'commit.gpgsign', 'false'],
  ];
  for (const a of 준비) { const r = git(...a); if (!r || r.error || r.status !== 0) return t.skip('git 을 못 불렀다'); }
  const 보드파일 = path.join(d, 'docs', '_ops', '보드', `${지문}.md`);
  const 쓰기 = (...줄들) => fs.writeFileSync(보드파일, `| 날짜 | 트랙 | 파일 | 상태 |\n|---|---|---|---|\n${줄들.join('\n')}\n`);

  쓰기(표줄('공통 조상'));
  if (git('add', '-A').status !== 0 || git('commit', '-qm', 'base').status !== 0) return t.skip('git 커밋 실패');
  if (git('branch', 'origin/master').status !== 0) return t.skip('ref 생성 실패');

  // 원격만 더한 줄 ↓
  쓰기(표줄('공통 조상'), 표줄('원격이 더한 줄'));
  git('add', '-A'); git('commit', '-qm', 'remote');
  if (git('branch', '-f', 'origin/master', 'HEAD').status !== 0) return t.skip('ref 이동 실패');

  /* 🔑 로컬이 **조상의 줄을 치웠다** — `board-move` 가 완료 줄을 아카이브로 옮기는 그 동작이고,
   *   이 저장소에서 매일 난다. 두 점(`HEAD..ref`)이면 원격에 그대로 남아 있는 그 줄이 `+` 로
   *   뒤집혀 와 **「내가 안 받은 선언」**으로 세어진다 — 세 점이라야 «원격이 더한 것»만 남는다.
   *   ⚠ 로컬이 «더하기만» 하는 픽스처로는 이 차이가 안 드러난다(첫 판이 그 모양이라 변이가 구멍을 냈다). */
  git('reset', '-q', '--hard', 'HEAD~1');
  쓰기(표줄('로컬만 더한 줄'));                    // ← 「공통 조상」을 치웠다(아카이브 이관 모양)
  git('add', '-A'); git('commit', '-qm', 'local');

  const r = 보드.원격줄들(d);
  assert.equal(r.모름, false, `ref 가 있는데 「모름」이 나왔다: ${JSON.stringify(r)}`);
  const 글자 = r.줄들.map((x) => x.줄).join('\n');
  assert.match(글자, /원격이 더한 줄/, '원격이 더한 줄을 못 봤다 — 이 층의 존재 이유다');
  assert.ok(!글자.includes('로컬만 더한 줄'), '내가 앞선 줄이 섞여 들어왔다');
  assert.ok(!글자.includes('공통 조상'),
    '내가 치운 줄이 「안 받은 선언」으로 뒤집혀 왔다 — 두 점(`..`)으로 바뀌면 나는 모양이다');
});

/* 🔑 ④의 자리 — 진 이유를 안 가르면 **원격이 없는 저장소 전부**가 영영 「모름」이 되어 참인
 *   단정이 통째로 죽는다(`가지몫` 이 F529 에서 이미 치른 값). ref 가 없는 것은 못 잰 게 아니다. */
test('🔑 원격끝 — ref 가 아예 없는 저장소는 「모름」이 아니라 재서 얻은 0 이다', (t) => {
  const { spawnSync } = require('node:child_process');
  const d = 빈뿌리();
  const git = (...a) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
  const r0 = git('init', '-q');
  if (!r0 || r0.error || r0.status !== 0) return t.skip('git 을 못 불렀다');
  // `origin/master` 를 안 만든다 — 새 클론·픽스처의 모양 그대로다.
  const r = 보드.원격줄들(d);
  assert.equal(r.모름, false,
    'ref 가 없는 것을 「못 훑었다」로 올렸다 — 원격 없는 저장소에서 참인 단정이 영영 죽는다');
  assert.deepEqual(r.줄들, []);
});

/* ── 읽는 자리 — 사본 대조가 살아 있는 과녁을 「지워졌다」로 버리지 않는다 (F343 축) ── */

/* 🔴 `--닫기`(머지·push) + `ExitWorktree(remove)` 뒤의 그 틈이 여기서도 열린다: 보드 파일이
 *   디스크에 **없다**. 옛 판은 그것을 곧장 「사라짐」으로 냈고, 그 경고는 「사본을 지시로 읽지
 *   말고 새 트랙을 잡아라」다 — 방금 착지한 살아 있는 과녁을 버리게 만든다. */
test('🔴 낡음 — origin/master 에만 있는 원본을 「사라짐」으로 단정하지 않는다', () => {
  const 뿌리 = 빈뿌리();                       // 보드 폴더는 있고 그 파일만 없다
  const 상태 = '▶착수 — 다음은 ②부터';
  const 줄 = 표줄('머지되고 워크트리는 거둔 트랙', '`tools/x.js`', 상태);
  const 글 = [
    '   상태/다음: ' + 상태,
    '▶ 그 세션의 보드 줄 (원본 `docs/_ops/보드/' + 지문 + '.md` — 마감 뒤 바뀌었을 수 있다): x',
  ].join('\n');
  const v = report.낡음(뿌리, 글, { 가지: { 출력: '' }, 원격: { 출력: 커밋('origin/master', `${지문}.md`, 줄) } });
  assert.strictEqual(v.판정, '원격',
    `🔴 원격에 멀쩡히 있는 원본을 「${v.판정}」으로 냈다 — 받은 세션이 산 과녁을 버린다(F542)`);
  const 경고 = report.낡음경고(v);
  assert.match(경고, /merge --ff-only origin\/master/, '버리지 말고 받으라는 명령이 빠졌다');
  assert.ok(!경고.includes('새 트랙을 잡는다'), '살아 있는 과녁에 「버려라」가 나갔다');
});

test('음성 — 원격에도 없으면 「사라짐」 그대로다 (이 수리는 순증이지 판정 갈아엎기가 아니다)', () => {
  const 뿌리 = 빈뿌리();
  const 글 = [
    '   상태/다음: ▶착수 — 아무 데도 없는 줄',
    '▶ 그 세션의 보드 줄 (원본 `docs/_ops/보드/' + 지문 + '.md` — 마감 뒤 바뀌었을 수 있다): x',
  ].join('\n');
  const v = report.낡음(뿌리, 글, { 가지: { 출력: '' }, 원격: { 출력: '' } });
  assert.strictEqual(v.판정, '사라짐', 'F343 의 참인 「사라짐」까지 죽였다');
});

/* ── 파서 계약 — 이름표만 다르고 판정은 한 벌 ───────────────────────────── */

test('🔑 원격줄들의 출처는 «원격» 이다 — `출처.가지` 에 들어가면 인계문이 정반대로 말한다', () => {
  const 출력 = 커밋('origin/master', `${지문}.md`, 표줄('출처 이름표 검사'));
  const r = 보드.원격줄들('.', { 출력 });
  assert.equal(r.줄들.length, 1);
  assert.equal(r.줄들[0].출처.원격, 'origin/master');
  assert.equal(r.줄들[0].출처.가지, undefined,
    '원격 줄이 가지로 이름표를 달았다 — 인계문이 「아직 안 머지됐다」로 말하게 된다');
  assert.equal(r.줄들[0].파일, `${지문}.md`, '파일 이름(=지문)이 안 실리면 주인 판정이 통째로 죽는다');
});

test('🔑 원격 층도 `줄들()` 과 같은 잣대로 머리말·규격 밖을 뗀다', () => {
  const 출력 = [
    보드.가지끝줄('origin/master', `${지문}.md`, '| 날짜 | 트랙 | 파일 | 상태 |'),
    보드.가지끝줄('origin/master', `${지문}.md`, 표줄('진짜 줄')),
  ].join('\n');
  const r = 보드.원격줄들('.', { 출력 });
  assert.equal(r.줄들.length, 1, '머리글 줄이 선언으로 세어졌다 — 분모가 거짓으로 부푼다');
  assert.match(r.줄들[0].줄, /진짜 줄/);
});
