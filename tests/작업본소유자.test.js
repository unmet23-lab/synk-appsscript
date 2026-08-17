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
/* 부정 단언(「~가 없어야 한다」)의 주어만 이걸로 감싼다 — 주석이 금지 패턴을 «설명»하면 그 검사가
 * 설명을 위반으로 읽는다(「옛 통로를 쓰지 않는다」를 적어 둔 자리가 곧 위반이 된다). (대기열 #Q72) */
const { 코드만 } = require('./lib/소스검사.js');
const os = require('node:os');
const { spawnSync } = require('node:child_process'); // git 재현용 — node 자식은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

/* 변이 이음매 — 탐지력을 재려면 **격리 사본**을 물려야 한다(tests/트랙충돌.test.js 의
 * `SYNK_TEST_TRACK_HOOK` 과 같은 형태). 실저장소 도구를 잠깐 망가뜨리는 방식은 금지다:
 * 그 창에 edit-stamp 가 지문을 쓰고 auto-commit 이 **변이 판을 master 로 싣는다**(F225 실물). */
const TOOL = process.env.SYNK_TEST_OWNER_TOOL || path.resolve(__dirname, '..', 'tools', '작업본소유자.js');
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
 *  `검사시각` = 경로별 「마지막으로 만진 때」(track-collision 의 `dirtyChecked`) — F187·F188 검사의 시계다.
 *  `끝남` = SessionEnd 가 찍은 죽음 도장(F252). **기본은 안 찍힌 상태다** — 실세계의 침묵은
 *  「쉬는 중」과 구별되지 않고, 그 기본값이 곧 이 검사들의 전제다. ⚪를 기대하는 픽스처는
 *  도장을 명시적으로 찍는다(안 찍고 ⚪를 기대하면 F252 가 그대로 재현된다). */
function 세션기록(state, repo, sid, touched, 분전, 검사시각, 끝남 = false) {
  const p = path.join(state, `track-${store.projectKey(repo)}-${store.safeId(sid)}.json`);
  fs.writeFileSync(p, JSON.stringify({
    baseline: 'x', lastHead: 'x', touched, warned: [], ...(검사시각 ? { dirtyChecked: 검사시각 } : {}),
    ...(끝남 ? { 끝남: Date.now() - 분전 * 60000 } : {}),
  }));
  const t = new Date(Date.now() - 분전 * 60000);
  fs.utimesSync(p, t, t);
}
function 돌린다({ repo, state, 나, 인자 = [], 형제, 환경 = {} }) {
  const env = {
    ...process.env, SYNK_OWNER_ROOT: repo, SYNK_CTXBUDGET_DIR: state,
    /* ⏱ [#Q98] 픽스처 origin 은 **로컬 폴더**라 네트워크가 0이다 — 여기서 5초를 넘기는 것은 오직
     *   «옆 세션의 부하»이고, 그건 이 파일이 재려는 대상이 아니다(F296: repo 밖 환경에 기대는
     *   검사는 CI 에서 깨진다 · 실측 08-15: node 40개가 뜬 회차에 `☁ …클라우드 브랜치를 잡는다`
     *   가 「fetch 실패」로 빨개졌고 **단독 재현은 108/108 초록**이었다).
     * 🚫 값을 키우는 것이 #Q98 의 처방이라는 뜻이 **아니다** — 처방은 도구 쪽 «못 쟀다» 갈래다.
     *   이 줄은 회귀가 부하를 측정 대상으로 착각하지 않게 하는 것뿐이고, 실사용 기본값(5초)은
     *   그대로다. 만료 «자체»를 재는 검사는 아래 `환경` 으로 이 값을 덮어쓴다. */
    SYNK_OWNER_FETCH_TIMEOUT_MS: '60000',
    ...환경,
  };
  /* 형제를 안 준 검사는 **기본 경로**(`<ROOT>/../SYNK-talk`)를 그대로 쓴다 — 픽스처 ROOT 는
   * 임시 폴더라 그 형제가 없고, 그래서 이 파일의 옛 검사들은 값이 하나도 안 바뀐다.
   * ⚠ 여기에 실저장소 경로가 새어 들어가면 CI 와 로컬이 다른 세계를 보게 된다(repo 밖 의존). */
  if (형제) env.SYNK_OWNER_SIBLINGS = 형제.join(';');
  if (나 === undefined) delete env.CLAUDE_CODE_HOST_SESSION_ID; else env.CLAUDE_CODE_HOST_SESSION_ID = 나;
  // 비정상 종료도, 안 뜬 것도 통로가 드러낸다 — 둘이 「빈 출력」으로 같아지면 안 된다.
  const r = 훅띄우기([TOOL, ...인자], { encoding: 'utf8', env });
  return String(r.stdout || '');
}

test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

test('🔴 살아있는 남의 작업본을 유물과 갈라 낸다 (F073 실사고 재현)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '엔진_궤적.js', 'live\n');
  더럽힌다(repo, '유물.js', 'orphan\n');
  세션기록(state, repo, 'local_aaaa1111', ['엔진_궤적.js'], 1);    // 살아있음
  세션기록(state, repo, 'local_bbbb2222', ['유물.js'], 400, undefined, true);  // 끝난 지 오래 + 종료 도장
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

test('🔴 내 심장박동이 멎어도 **나는 산다** — 남은 그대로 (F264 실사고 재현)', { skip: !git있나 && 'git 없음' }, () => {
  /* 실사고 2026-08-08: 박동은 `Edit|Write|MultiEdit` 에서만 뛰는데(track-collision 매처)
   *   「살아있나」로 소비된다. 선언만 써 두고 30분 넘게 읽기·조사만 한 세션은 자기 파일이
   *   ❔모름으로 떨어지고 git-scope-guard ⑧ 이 자기 커밋을 막았다(3회차 탈출구로야 통과).
   * 🔑 위의 「내 작업본은 위험으로 세지 않는다」가 이 자리를 원리상 못 본다 — 그 픽스처는
   *   내 박동을 **1분 전**으로 주므로 나이와 무관하게 통과한다. 재료는 나이다.
   * ⚠ 같은 픽스처에 **남의** 낡은 세션을 함께 세워 분모를 만든다. 안 세우면 「전부 내것」으로
   *   접는 변이가 초록으로 통과한다(F253 이 밟은 「아무것도 안 재는 초록」). */
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'docs/_ops/보드/me00.md', 'my board line\n');
  더럽힌다(repo, '남의것.js', 'theirs\n');
  세션기록(state, repo, 'local_me00', ['docs/_ops/보드/me00.md'], 400);   // 나 — 박동 멎음·도장 없음
  세션기록(state, repo, 'local_other1', ['남의것.js'], 400);              // 남 — 같은 나이·도장 없음
  나이먹인다(repo, '남의것.js', 401);

  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.ok(!out.includes('보드/me00.md'),
    `내 파일이 목록에 떴다 — 박동을 안 재도 되는 유일한 세션이 나다(이 코드가 도는 것이 증거):\n${out}`);
  assert.match(out, /❔[\s\S]*남의것\.js/,
    `남의 낡은 세션까지 살려 냈다 — 면제는 나 하나뿐이다:\n${out}`);
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
  세션기록(state, repo, 'local_old0', ['유물.js'], 400, undefined, true);
  나이먹인다(repo, '유물.js', 401);
  assert.strictEqual(돌린다({ repo, state, 나: 'local_me00', 인자: ['--hook'] }).trim(), '',
    '위험이 없는데 훅이 말했다 — 매 세션 울리면 읽히지 않게 된다');
});

/* ── 🔇 이름이 곧 주인인 파일 (2026-08-12 실측) ──────────────────────────────────
 * 실사고가 아니라 **상시 거짓양성**이다. 위 검사가 못박은 「위험 없으면 침묵」 계약이 닷새간
 *   죽어 있었다: 세션이 끝날 때마다 `docs/_ops/인계문/<지문>.md` 가 한 장씩 쌓이므로 🔴 칸이
 *   **구조적으로 0이 안 된다.** 실측 — 🔴 5건이 5건 다 남의 인계문, 진짜 충돌 0, 매 세션 1,114자.
 *   뿌리는 08-07 수리의 부작용이다(인계문을 ❔모름에서 제 주인에게 옮겨 붙였더니 그대로 경보가 됐다).
 * 🔑 고친 것은 **경보층뿐**이다 — 판정은 그대로 `남의살아있는` 이라 git-scope-guard ⑨ ·
 *   track-collision ⑤ 가 보는 값은 한 글자도 안 바뀐다(맹점 ④: 판정을 두 곳에 적으면 갈라진다).
 * ⚠ 이 검사들은 **픽스처에서 탐지력을 재고**, 실저장소는 안 쓴다 — 인계문은 세션마다 달라진다. */

test('🔇 남의 인계문만 있으면 훅은 침묵한다 (상시 거짓양성이 침묵 설계를 죽이고 있었다)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'docs/_ops/인계문/aaaa1111.md', '# 남의 인계문\n');
  세션기록(state, repo, 'local_aaaa1111', [], 1);   // 살아있는 남 — 만진 기록이 없어도 **이름이 주인을 말한다**
  assert.strictEqual(돌린다({ repo, state, 나: 'local_cccc3333', 인자: ['--hook'] }).trim(), '',
    '남의 인계문 하나로 훅이 입을 열었다 — 세션마다 한 장씩 쌓이니 이 자리는 영영 안 조용해진다');
});

test('🔇 남의 보드 파일도 🔴 에 안 싣는다 — F250 이 「내 파일에만 쓴다」로 못박은 1세션 1파일이다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'docs/_ops/보드/aaaa1111.md', '| 2026-08-12 | 트랙 | 파일 | ▶작업중 |\n');
  세션기록(state, repo, 'local_aaaa1111', [], 1);
  const out = 돌린다({ repo, state, 나: 'local_cccc3333', 인자: ['--hook'] });
  // 🧭(보드 선점)는 별개 축이라 울어도 된다 — 여기서 막는 건 **🔴 경보**뿐이다.
  assert.ok(!out.includes('🔴'), `보드 파일이 🔴「편집하지 않는다」로 떴다 — 이름이 곧 주인이다:\n${out}`);
});

test('🔴 남이 **함께** 만진 인계문은 그대로 운다 — 침입자가 주인 뒤에 숨는 방향이 「통과」다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'docs/_ops/인계문/aaaa1111.md', '# 인계문 — 주인 말고 누가 더 만졌다\n');
  세션기록(state, repo, 'local_aaaa1111', [], 1);                                 // 이름이 가리키는 주인
  세션기록(state, repo, 'local_dddd4444', ['docs/_ops/인계문/aaaa1111.md'], 1);   // 침입자(살아있음)
  const out = 돌린다({ repo, state, 나: 'local_cccc3333', 인자: ['--hook'] });
  assert.match(out, /🔴[\s\S]*인계문\/aaaa1111\.md/,
    `주인 아닌 세션이 함께 든 인계문을 조용히 넘겼다 — \`every\` 를 \`some\`·\`includes\` 로 쓰면 이렇게 샌다:\n${out}`);
});

test('🔴 진짜 충돌은 인계문 더미에 묻히지 않는다 (2026-08-12: 인계문 6줄 밑에 깔릴 뻔한 실물 2건)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'Code.js', 'live peer edit\n');
  for (const s of ['aaaa1111', 'bbbb2222', 'eeee5555']) {
    더럽힌다(repo, `docs/_ops/인계문/${s}.md`, '# 인계문\n');
    세션기록(state, repo, `local_${s}`, [], 1);
  }
  세션기록(state, repo, 'local_dddd4444', ['Code.js'], 1);
  const out = 돌린다({ repo, state, 나: 'local_cccc3333', 인자: ['--hook'] });
  assert.match(out, /🔴 살아있는 남의 작업본 1건/, `건수가 인계문까지 세고 있다 — 숫자가 틀리면 사람이 목록을 안 읽는다:\n${out}`);
  assert.ok(!out.includes('인계문/aaaa1111.md'), `훅이 인계문을 경보에 실었다:\n${out}`);
});

test('🔑 공유 선언판 `docs/_ops/인계문.md` 는 빼지 않는다 — 폴더 밑 `<지문>.md` 만이 1세션 1파일이다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'docs/_ops/인계문.md', '# 인계문 목차 — 모두가 같이 쓴다\n');
  세션기록(state, repo, 'local_aaaa1111', ['docs/_ops/인계문.md'], 1);
  const out = 돌린다({ repo, state, 나: 'local_cccc3333', 인자: ['--hook'] });
  assert.match(out, /🔴[\s\S]*인계문\.md/,
    `공유 목차를 세션 전용 파일로 착각해 뺐다 — 여기는 실제로 충돌하는 자리다:\n${out}`);
});

test('🔇 손으로 부르면 **뺀 것을 밝힌다** — 남은 것만 내면 「이게 전부」로 읽힌다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'docs/_ops/인계문/aaaa1111.md', '# 인계문\n');
  세션기록(state, repo, 'local_aaaa1111', [], 1);
  const out = 돌린다({ repo, state, 나: 'local_cccc3333' });   // 훅이 아니라 손 호출
  assert.match(out, /🔇[\s\S]*인계문\/aaaa1111\.md/,
    `손 호출에서도 감췄다 — 전량을 보려고 부르는 통로라 여기서 감추면 판정이 사라진다:\n${out}`);
  assert.ok(!돌린다({ repo, state, 나: 'local_cccc3333', 인자: ['--hook'] }).includes('🔇'),
    '훅에서까지 🔇 절을 냈다 — 그러면 침묵시키려던 자수를 그대로 되돌려 놓는 것이다');
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
  세션기록(state, repo, 'local_dead01', ['Code.js'], 40, undefined, true);   // 40분 전 정상 종료한 세션의 옛 기록
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
  세션기록(state, repo, 'local_dead02', ['진짜유물.js'], 400, undefined, true);
  나이먹인다(repo, '진짜유물.js', 401);                               // 그 세션이 살아 있을 때 쓴 것
  assert.match(돌린다({ repo, state, 나: 'local_me00' }), /⚪[\s\S]*진짜유물\.js/,
    '반증이 과해 진짜 유물까지 모름으로 밀었다 — 이어받을 것이 매번 「확인하라」가 되면 안 읽힌다');
});

test('🔑 여유는 훅 순서를 견딘다 — track-collision 은 PreToolUse 라 상태가 파일보다 먼저 쓰인다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '직후.js', 'x\n');
  세션기록(state, repo, 'local_dead03', ['직후.js'], 400, undefined, true);
  나이먹인다(repo, '직후.js', 399);        // 심장박동보다 1분 **뒤** — 편집이 훅 다음에 일어난 정상 순서
  assert.match(돌린다({ repo, state, 나: 'local_me00' }), /⚪[\s\S]*직후\.js/,
    '정상 훅 순서를 반증으로 읽었다 — 모든 유물이 모름이 되어 구분이 사라진다');
});

test('🔴 바뀐 때를 못 재면 ⚪라고 우기지 않는다 (삭제된 파일)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state, g } = 픽스처();
  더럽힌다(repo, '지워진.js', 'x\n');
  g('add', '-A'); g('commit', '-qm', 'add');
  fs.rmSync(path.join(repo, '지워진.js'));                            // 삭제 → statSync 불가
  세션기록(state, repo, 'local_dead04', ['지워진.js'], 400, undefined, true);
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

/* ── ⚪ 는 죽음을 **증명한** 세션의 것만이다 (F252 · 2026-08-08 실사고) ─────────
 * 실사고: 유호님 답을 기다리며 75분 쉬던 세션 local_15ab8497 의 미커밋 11파일이 ⚪로 떨어졌고,
 *   옆 세션이 그대로 커밋했다(talk 87e7061 · appsscript 1daa329). 심장박동 = 도구 활동량이라
 *   **쉬는 세션과 죽은 세션이 같은 모양**이었다.
 * 🔑 임계값(SYNK_OWNER_ALIVE_MIN)을 늘리는 처방은 반대 방향으로만 틀린다 — 그래서 검사도
 *   시간이 아니라 **도장의 유무**로 가른다. 아래 두 검사는 다른 재료는 전부 같고 도장만 다르다. */

test('🔴 도장 없이 조용하기만 한 세션의 파일은 ⚪가 아니다 (F252 실사고 재현)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '쉬는중.js', 'orphan\n');
  세션기록(state, repo, 'local_rest01', ['쉬는중.js'], 400);   // 400분 침묵 · **종료 도장 없음**
  나이먹인다(repo, '쉬는중.js', 401);                          // 시각 반증(F090)은 통과한다
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.ok(!/⚪[\s\S]*쉬는중\.js/.test(out),
    `침묵만으로 「이어받아도 된다」고 했다 — 유호님 답을 기다리는 세션이 여기로 떨어진다:\n${out}`);
  assert.match(out, /❔[\s\S]*쉬는중\.js/, `⚪가 아니면 ❔여야 한다 — 목록에서 사라지면 그게 더 나쁘다:\n${out}`);
  assert.match(out, /쉬는중\.js[^\n]*끝났다는 도장이 없다/,
    `칸만 바꾸고 이유를 안 적었다 — 「그 뒤에 바뀌었다」와 다음 손이 다르다(여긴 그 세션에 물어본다):\n${out}`);
});

test('⚪ 도장이 찍혔으면 그대로 ⚪다 — 증명 요구가 F111 수거를 멈추지 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '증명된유물.js', 'orphan\n');
  세션기록(state, repo, 'local_end01', ['증명된유물.js'], 400, undefined, true);   // 위와 재료 동일 + 도장
  나이먹인다(repo, '증명된유물.js', 401);
  assert.match(돌린다({ repo, state, 나: 'local_me00' }), /⚪[\s\S]*증명된유물\.js/,
    '증명 요구가 과해 진짜 유물까지 ❔로 밀었다 — 미추적은 무보호 상태다(F025)');
});

/* 되살아남(도장 찍힌 뒤 다시 일한 세션)의 회귀는 도장을 **지우는 쪽**에 있다 —
 * `tests/트랙충돌.test.js` 의 「상태쓰기가 옛 도장을 지운다」. 여기서 또 재면 두 곳이 갈라진다. */

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

/* ── ⏱ #Q95: fetch 스로틀 ───────────────────────────────────────────────────
 * 왜 여기 붙나: `git fetch` 는 이 도구에서 가장 비싼 한 칸이다(실측 8회 — 도구 전체
 * 3.0~9.9초 중 1.4~4.6초 = 어느 회차에서나 약 절반). 그래서 「N분보다 자주는 안 딴다」로 바꿨다.
 *
 * 🔑 **이 네 검사가 스로틀의 유일한 증거다.** 위 옛 검사 4건은 픽스처가 매번 새 저장소라
 *   `FETCH_HEAD` 가 없고(=모름 → 딴다), 그래서 스로틀 코드에 **닿지도 않는다** — 그 상태로
 *   전부 초록이면 「스로틀이 있다」와 「스로틀이 죽었다」가 같은 모양이 된다(안 닿는 가드).
 * 🔑 그리고 값과 대가를 **따로** 잠근다: 건너뛰는가(①) · 비상구로 끌 수 있는가(②) ·
 *   스스로 만료하는가(③ — 이게 「하루짜리 사각으로 안 돌아간다」의 근거다) · 낡음을 말하는가(④). */
/** ⏱ [F488] 「못 쟀다」를 fail 로 내지 않는다 — 재려는 것은 스로틀이고, 부하는 이 파일의 대상이 아니다.
 *
 * 🔴 실사고 08-15: 옆 세션들 CI 로 node 가 40개 넘게 뜬 회차에 아래 검사들이 빨개졌다. 도구 자신은
 *   그 출력에 「실패가 아니다」라고 찍는데 회귀는 `/방금올라온것/` 매치를 요구해 **CI 를 통째로**
 *   세웠다 — 주인 없는 적색은 남의 배포 게이트를 막는다(F296: repo 밖 환경에 기댄 검사는
 *   fail 아니라 **skip** 으로 드러낸다).
 * 🔑 새는 방향(=조용한 초록)을 막는 조건 둘:
 *   ① **도구가 「원격을 못 쟀다」고 «말했을 때만»** 건너뛴다 — 아무 말도 없는 회차는 여전히 fail 이다.
 *      안 그러면 진짜 회귀(=아무것도 안 뜸)까지 이 문으로 초록이 된다.
 *   ② 문구를 `원격을` 로 못박는다 — 같은 「못 쟀다」라도 `git status` 쪽(F489)은 이 검사들의
 *      전제가 아니다. 넓게 잡으면 로컬 예산이 망가진 회차까지 조용히 건너뛴다.
 * ⚠ 건너뛴 회차는 「검사했다」가 아니다 — `skipped N` 이 분모로 남는다(F207: 초록은 분모와 함께). */
function 원격못쟀으면건너뛴다(t, out) {
  if (!/원격을 \*\*못 쟀다\*\*/.test(out)) return false;
  t.skip('원격을 못 쟀다(부하) — 이 검사가 재려는 것은 스로틀이지 노트북 부하가 아니다(F296·F488)');
  return true;
}

function 원격가지추가(원본, 브랜치, 제목) {
  const go = (...a) => spawnSync('git',
    ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: 원본, encoding: 'utf8' });
  go('checkout', '-q', 'master');
  go('checkout', '-qb', 브랜치);
  fs.writeFileSync(path.join(원본, `${브랜치.replace(/\W/g, '_')}.md`), 'x\n');
  go('add', '-A'); go('commit', '-qm', 제목);
}
/** `FETCH_HEAD` 의 수정 시각 = 이 도구가 읽는 「마지막으로 딴 때」. 그걸 뒤로 밀어 나이를 만든다. */
function fetch나이먹인다(repo, 분전) {
  const t = new Date(Date.now() - 분전 * 60000);
  fs.utimesSync(path.join(repo, '.git', 'FETCH_HEAD'), t, t);
}

/* ⚠ 이 검사만 `SYNK_OWNER_FETCH_MIN` 을 **안 넘긴다** — 기본값이 곧 실제로 도는 값이라,
 *   전부 env 로 고정하면 기본값을 0(=끔)으로 돌려놔도 아무 검사도 안 빨개진다. */
test('⏱ [#Q95] 신선하면 fetch 를 건너뛴다(기본값) — 그 대가로 방금 올라온 가지는 이번 회차에 안 뜬다', { skip: !git있나 && 'git 없음' }, (t) => {
  const { repo, state } = 픽스처();
  const 원본 = 원격붙인다(repo, { 브랜치: 'claude/처음부터있던것' });
  const 첫 = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  if (원격못쟀으면건너뛴다(t, 첫)) return;                       // F488
  assert.match(첫, /처음부터있던것/, 'FETCH_HEAD 가 없으면(=모름) 반드시 따야 한다 — 이 회차가 그 전제다');

  원격가지추가(원본, 'claude/방금올라온것', 'docs: 방금');
  const 둘 = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  assert.doesNotMatch(둘, /방금올라온것/, '스로틀이 죽으면 이 줄이 그냥 통과한다 — 여기가 「실제로 건너뛰었나」의 유일한 문이다');
  assert.match(둘, /처음부터있던것/, '건너뛰었다고 이미 받아둔 ref 까지 잃으면 안 된다 — 캐시된 ref 로 판정해야 한다');
});

test('⏱ [#Q95] 비상구 — `SYNK_OWNER_FETCH_MIN=0` 이면 언제나 딴다', { skip: !git있나 && 'git 없음' }, (t) => {
  const { repo, state } = 픽스처();
  const 원본 = 원격붙인다(repo, { 브랜치: 'claude/처음부터있던것' });
  돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'], 환경: { SYNK_OWNER_FETCH_MIN: '0' } });
  원격가지추가(원본, 'claude/방금올라온것', 'docs: 방금');
  const 둘 = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'], 환경: { SYNK_OWNER_FETCH_MIN: '0' } });
  if (원격못쟀으면건너뛴다(t, 둘)) return;                       // F488
  assert.match(둘, /방금올라온것/, '끌 수 없는 스로틀은 「확실히 보고 싶다」는 자리에서 우회를 정상 통로로 만든다(F103)');
});

test('⏱ [#Q95] 스스로 만료한다 — 나이가 간격을 넘으면 다시 딴다(하루짜리 사각으로 안 돌아간다)', { skip: !git있나 && 'git 없음' }, (t) => {
  const { repo, state } = 픽스처();
  const 원본 = 원격붙인다(repo, { 브랜치: 'claude/처음부터있던것' });
  돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'], 환경: { SYNK_OWNER_FETCH_MIN: '10' } });
  원격가지추가(원본, 'claude/방금올라온것', 'docs: 방금');
  fetch나이먹인다(repo, 11);                                    // 간격(10분)을 넘겼다
  const 둘 = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'], 환경: { SYNK_OWNER_FETCH_MIN: '10' } });
  if (원격못쟀으면건너뛴다(t, 둘)) return;                       // F488
  assert.match(둘, /방금올라온것/, '만료가 안 걸리면 스로틀은 「영원히 안 딴다」가 된다 — 그게 옛 주석이 겁낸 그 병이다');
});

test('💸 [#Q95] 건너뛴 회차는 **몇 분 전 기준**인지 말한다 — 방금 잰 값처럼 읽히면 안 된다', { skip: !git있나 && 'git 없음' }, (t) => {
  const { repo, state } = 픽스처();
  원격붙인다(repo, { 브랜치: 'claude/처음부터있던것' });
  const 첫 = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'], 환경: { SYNK_OWNER_FETCH_MIN: '10' } });
  /* F488 — 첫 회차가 못 쟀으면 `FETCH_HEAD` 자체가 없어 아래 `utimesSync` 가 ENOENT 로 터진다.
   * 그 예외는 「스로틀이 깨졌다」가 아니라 「이번엔 못 쟀다」인데, 읽는 사람에겐 같은 적색이다. */
  if (원격못쟀으면건너뛴다(t, 첫)) return;
  fetch나이먹인다(repo, 5);                                     // 아직 간격 안: 건너뛴다
  const 둘 = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'], 환경: { SYNK_OWNER_FETCH_MIN: '10' } });
  assert.match(둘, /5분 전 fetch 기준/, '낡음을 안 적으면 이 절이 「모름을 안전으로 바꾸는」 자리가 된다');
  assert.doesNotMatch(둘, /못 읽었다/, '건너뜀은 **실패가 아니다** — 둘을 같은 문장으로 내면 처방이 뒤바뀐다');
});

/* ⚠ 위 네 검사의 skip 문(F488)은 **스스로는 아무것도 증명하지 않는다** — 부하를 밖에서 만들 수
 *   없으니 평시엔 한 번도 안 탄다(안 도는 가드). 그래서 탐지력을 여기 픽스처로 못박는다:
 *   ①진짜 만료 출력에 **발화하는가** ②정상 회차에 **안 발화하는가**(그게 조용한 초록의 문이다)
 *   ③`git status` 쪽 만료(F489)에는 안 발화하는가 — 세 문장 전부 **도구가 실제로 찍은 것**을 쓴다.
 *   문구를 손으로 베껴 적으면 도구가 말을 바꾼 날 이 검사만 초록으로 남는다(배선이 끊긴 가드). */
test('⏱ [F488] 「못 쟀다 → skip」 문이 실제로 여닫힌다 — 세 문장 전부 도구가 찍은 것으로 잰다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  원격붙인다(repo, { 브랜치: 'claude/부하때문에못본것' });
  더럽힌다(repo, '뭔가.md', 'x');
  세션기록(state, repo, 'local_남', ['뭔가.md'], 0);
  const 가짜t = () => { const 판 = { 건너뜀: null, skip(m) { 판.건너뜀 = m; } }; return 판; };

  const 만료 = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'], 환경: { SYNK_OWNER_FETCH_TIMEOUT_MS: '1' } });
  const t1 = 가짜t();
  assert.strictEqual(원격못쟀으면건너뛴다(t1, 만료), true, '진짜 만료에 안 열리면 이 문은 CI 를 계속 빨갛게 세운다(F488 그 자체)');
  assert.match(String(t1.건너뜀), /F296|F488/, '왜 건너뛰었는지 안 적으면 skip 이 「검사했다」로 읽힌다');

  const 정상 = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  const t2 = 가짜t();
  assert.strictEqual(원격못쟀으면건너뛴다(t2, 정상), false, '정상 회차까지 건너뛰면 진짜 회귀가 조용한 초록으로 덮인다 — 새는 방향은 여기다');
  assert.strictEqual(t2.건너뜀, null, 'skip 을 부르고 false 를 돌려주면 위 검사들이 「돌았다」고 세어진다');

  const 로컬만료 = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'], 환경: { SYNK_OWNER_GIT_TIMEOUT_MS: '1' } });
  assert.match(로컬만료, /못 쟀다/, '전제 — 이 회차도 「못 쟀다」라고 말한다(그래서 넓게 잡으면 걸린다)');
  assert.strictEqual(원격못쟀으면건너뛴다(가짜t(), 로컬만료), false,
    '`git status` 만료(F489)는 이 검사들의 전제가 아니다 — 넓게 잡으면 로컬 예산이 망가진 회차까지 조용히 건너뛴다');
});

/* ── ⏱ #Q98: 만료는 «실패»가 아니다 ─────────────────────────────────────────
 * 🔴 실사고 2026-08-15: 옆 세션들 CI 로 node 가 40개 넘게 떠 있던 회차에 이 도구가
 *   「⚠ 원격을 **못 읽었다**(fetch 실패)」를 냈다 — 그 픽스처의 origin 은 **로컬 폴더**라
 *   네트워크가 아예 없었다. 원인은 `spawnSync` 타임아웃 만료가 진짜 실패와 같은 `null` 로
 *   접힌 것이다. 급소는 회귀가 아니라 실사용이다: 같은 5초가 세션 시작의 진짜 fetch 에도
 *   걸려 있어, 노트북이 바쁘면 훅이 **없는 실패**를 알리고 사람을 원격 확인으로 보낸다.
 *   따를 수 없는 경보가 반복되면 그 절이 통째로 꺼진다(F103).
 * 🚫 처방은 「5초를 늘린다」가 **아니다** — 29초짜리 회차를 실측했다. 값은 조건을 못 이긴다.
 *   그래서 **문장을 갈랐다**(F207 미측정≠실패). 아래 둘이 그 갈림의 유일한 증거다:
 *   ①단위 — 만료가 `못쟀다` 로 찍히는가(그리고 진짜 실패는 여전히 `실패` 인가)
 *   ②끝에서 끝 — 그 갈래가 **화면 문장**까지 내려오는가(단위만 잠그면 배선이 끊겨도 초록이다). */
test('⏱ [#Q98] 만료·실패·성공이 세 갈래로 갈린다 — 둘로 접으면 부하가 곧 거짓 경보다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo } = 픽스처();
  const { git상세 } = require(TOOL);

  /* 1ms 는 프로세스 생성(윈도우 실측 수십 ms)만으로도 넘긴다 — 만료가 결정적으로 난다. */
  assert.equal(git상세(['status', '--porcelain'], repo, 1).상태, '못쟀다',
    '만료를 「실패」로 접으면 부하가 곧 거짓 경보가 된다(#Q98 실사고)');

  /* 같은 통로가 **진짜 실패**를 여전히 실패라고 말하는지 — 안 그러면 이번엔 반대로 샌다.
   * ⚠ 표본을 `rev-parse --없는옵션` 으로 잡았다가 이 검사에 걸렸다: `rev-parse` 는 모르는 인자를
   *   **리비전으로** 받아 exit 0 을 낸다(실측 `상태='됨'`). 「실패할 것 같은 명령」이 아니라
   *   **실패가 증명된 명령**을 쓴다 — 없는 객체 조회는 반드시 128 이다. */
  assert.equal(git상세(['cat-file', '-p', 'deadbeef'.repeat(5)], repo).상태, '실패',
    '만료 갈래를 만들면서 진짜 실패까지 「못 쟀다」로 덮으면 경보가 통째로 죽는다');

  assert.equal(git상세(['rev-parse', '--is-inside-work-tree'], repo).상태, '됨',
    '성공 갈래가 죽으면 이 도구의 모든 판정이 「모름」이 된다');
});

test('⏱ [#Q98] 만료 회차는 「fetch 실패」가 아니라 「못 쟀다」로 말한다 — 처방이 정반대다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  원격붙인다(repo, { 브랜치: 'claude/부하때문에못본것' });   // origin 은 **로컬 폴더** — 실패할 이유가 없다
  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'],
    환경: { SYNK_OWNER_FETCH_TIMEOUT_MS: '1' } });          // 부하를 흉내 내는 유일한 손잡이

  assert.match(out, /못 쟀다/, '만료를 말하지 않으면 「대기 0건」과 구별이 안 된다(모름을 안전으로 바꾸지 않는다)');
  assert.doesNotMatch(out, /fetch 실패/,
    '없는 실패를 알리면 사람이 원격을 확인하러 간다 — 그 헛걸음이 반복되면 이 절이 꺼진다(F103)');
  assert.match(out, /다시 돌린다/, '따를 수 있는 처방이 없으면 「못 쟀다」도 그냥 잔소리다');
});

/* ── ⏱ F489: #Q98 의 **이웃 자리** — `git status` 만료는 훅에서 «침묵»이었다 ────────────
 * 🔴 #Q98 은 `git fetch` 한 칸만 갈랐고 `미커밋들()`(=`git status`)은 옛 통로에 남아 있었다.
 *   그쪽 만료는 진짜 실패와 같은 `null` 로 접혀 훅에서 **빈 문자열**이 됐는데, 이 도구의
 *   규약상 훅의 침묵은 「위험 없음」이다(아래 ② 가 그 계약이다) — 즉 **못 잰 회차와 깨끗한
 *   회차가 글자 그대로 같은 출력**이었다. 하필 세션이 여럿 도는 그때가 미커밋 충돌이 가장 잦다.
 * 📏 실측 08-15(F489): `git status --porcelain -uall` 3회 = 499·259·490ms(예산 5,000ms 의 10%).
 *   #Q98 이 잰 부하 배율(약 12배)을 곱하면 ≈6초 ⇒ **예산에 닿는다.**
 * 🔑 ①과 ②는 **한 쌍으로만 증거가 된다.** ① 만 잠그면 다음 사람이 「어차피 다 말하면 되지」로
 *   ② 를 지우고, 그러면 git 이 없는 사람에게 매 세션 같은 잔소리가 나가 그 절이 통째로 꺼진다(F103).
 *   ② 만 잠그면 지금 이 사고 그대로다. */
test('⏱ [F489] `git status` 만료는 훅에서도 말한다 — 침묵은 「미커밋 0건」과 구별되지 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  /* 진짜로 **위험이 있는** 회차를 만든다 — 만료가 침묵으로 접히면 이걸 통째로 삼킨다는 뜻이다. */
  더럽힌다(repo, '남의것.md', 'x');
  세션기록(state, repo, 'local_남', ['남의것.md'], 0);

  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'],
    환경: { SYNK_OWNER_GIT_TIMEOUT_MS: '1' } });   // 부하를 흉내 내는 유일한 손잡이(1ms 는 프로세스 생성만으로 넘긴다)

  assert.notStrictEqual(out.trim(), '', '훅이 침묵하면 이 회차는 「깨끗함」으로 읽힌다 — 그게 F489 그 자체다');
  assert.match(out, /못 쟀다/, '만료를 말하지 않으면 「미커밋 0건」과 같은 모양이다(모름을 안전으로 바꾸지 않는다)');
  assert.match(out, /안 재봤다/, '「0건이 아니다」를 안 적으면 읽는 사람이 이 줄을 그냥 잡음으로 넘긴다');
  assert.match(out, /다시 돌린다/, '따를 수 있는 처방이 없으면 「못 쟀다」도 그냥 잔소리다(F103)');
  assert.doesNotMatch(out, /못 불렀다/,
    'git 미설치 문장으로 나가면 처방이 정반대다 — 그쪽은 「git 을 깔아라」이고 이쪽은 「조용할 때 다시」다');
});

test('⏱ [F489] git 자체를 못 부른 회차의 훅 침묵은 **그대로 둔다** — 이쪽은 결함이 아니라 설계다', { skip: !git있나 && 'git 없음' }, () => {
  const { state } = 픽스처();
  const 빈폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-nogit-'));
  임시들.push(빈폴더);
  /* 전제부터 못박는다 — 이 폴더가 어쩌다 저장소 «안»이면 이 검사는 아무것도 안 잰다. */
  const 확인 = spawnSync('git', ['status', '--porcelain'], { cwd: 빈폴더, encoding: 'utf8' });
  assert.notStrictEqual(확인.status, 0, '픽스처가 git 저장소면 「못 부름」 갈래에 애초에 안 들어간다');

  const 훅 = 돌린다({ repo: 빈폴더, state, 나: 'local_me', 인자: ['--hook'] });
  assert.strictEqual(훅.trim(), '', 'git 이 없는 사람에게 매 세션 같은 잔소리를 내면 그 절이 통째로 꺼진다(F103)');

  /* 침묵이 「그 갈래에 실제로 들어갔다」의 증거가 되려면 **말하는 통로 하나**가 필요하다 —
   * 안 그러면 도구가 엉뚱한 이유로 아무 말도 안 한 회차와 구별이 안 된다(초록은 분모와 함께). */
  const 손 = 돌린다({ repo: 빈폴더, state, 나: 'local_me' });
  assert.match(손, /못 불렀다/, '손으로 부르면 말해야 한다 — 이 줄이 위 침묵의 분모다');
});

/* ── F195: 얕은 클론(=클라우드 세션의 모양)에서의 원격 대기 판정 ─────────────────
 * `--no-merged` 는 잘린 이력 너머를 못 걸어, 이미 master 에 들어간 브랜치도 「대기」로 나온다.
 * 실사고: 전부 반입된 브랜치를 매 세션 「안 들어왔다」로 알렸고, 처방(삭제)은 프록시가 막아
 * 따를 수 없었다. 로컬 경로 클론은 depth 를 무시하므로 얕은 클론은 file:// 로 만든다. */
function 원본G(원본) {
  return (...a) => spawnSync('git',
    ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: 원본, encoding: 'utf8' });
}
function 새원본() {
  const 원본 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-o192-'));
  임시들.push(원본);
  const go = 원본G(원본);
  go('init', '-q', '-b', 'master');
  fs.writeFileSync(path.join(원본, 'seed.txt'), 'seed\n');
  go('add', '-A'); go('commit', '-qm', 'seed');
  return { 원본, go };
}
function 얕은클론(원본) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-shallow-'));
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-state-'));
  임시들.push(repo, state);
  const r = spawnSync('git', ['clone', '--quiet', '--depth', '1', '--no-single-branch',
    'file://' + 원본, repo], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `얕은 클론 실패:\n${r.stderr}`);
  const 얕나 = spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: repo, encoding: 'utf8' });
  assert.strictEqual(String(얕나.stdout).trim(), 'true', '픽스처가 얕지 않으면 이 검사들은 아무것도 안 잰다');
  return { repo, state };
}

test('🔴 F195: 이미 master 에 들어간 브랜치는 얕은 클론에서도 말하지 않는다 — 깊여서 실측한다', { skip: !git있나 && 'git 없음' }, () => {
  const { 원본, go } = 새원본();
  go('checkout', '-qb', 'claude/전부반입됨');
  fs.writeFileSync(path.join(원본, '폰작업.md'), '폰에서 고친 것\n');
  go('add', '-A'); go('commit', '-qm', 'docs: 폰 작업');
  go('checkout', '-q', 'master');
  go('merge', '-q', '--no-ff', '-m', 'merge', 'claude/전부반입됨');
  fs.writeFileSync(path.join(원본, '뒤.txt'), '병합 뒤 커밋\n');
  go('add', '-A'); go('commit', '-qm', '뒤'); // 브랜치 팁을 얕은 창 밖으로 민다
  const { repo, state } = 얕은클론(원본);
  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  assert.doesNotMatch(out, /전부반입됨/,
    '반입 완료 브랜치를 「대기」로 알렸다 — 실사고 그대로: 매 세션 헛조사를 시키고 처방(삭제)은 따를 수도 없다');
});

test('F195: 이력을 깊여도 못 이으면 「모름」이지 「안 들어왔다」가 아니다', { skip: !git있나 && 'git 없음' }, () => {
  const { 원본, go } = 새원본();
  go('checkout', '-q', '--orphan', 'claude/딴뿌리');
  fs.writeFileSync(path.join(원본, '딴뿌리.md'), '이력이 안 이어지는 브랜치\n');
  go('add', '-A'); go('commit', '-qm', '딴뿌리');
  go('checkout', '-q', 'master');
  const { repo, state } = 얕은클론(원본);
  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  assert.match(out, /딴뿌리/, '모름을 침묵으로 접으면 「깨끗함」과 같은 모양이 된다');
  assert.match(out, /모름/, '못 가른 것을 단정 문장으로 내면 오진단이 실측의 모습을 하고 나온다');
  assert.doesNotMatch(out, /아직 안 들어왔다|브랜치를 지운다/, '모름에 단정·삭제 처방을 붙이면 안 된다');
});

test('F195: 진짜 미병합은 얕은 클론에서도 알리되, 삭제는 처방하지 않는다(따를 수 없는 처방 · F103)', { skip: !git있나 && 'git 없음' }, () => {
  const { 원본, go } = 새원본();
  fs.writeFileSync(path.join(원본, '둘.txt'), '둘\n');
  go('add', '-A'); go('commit', '-qm', '둘');
  go('checkout', '-qb', 'claude/진짜대기중');
  fs.writeFileSync(path.join(원본, '폰작업.md'), '아직 안 들어간 폰 작업\n');
  go('add', '-A'); go('commit', '-qm', 'docs: 아직 대기');
  go('checkout', '-q', 'master');
  const { repo, state } = 얕은클론(원본);
  const out = 돌린다({ repo, state, 나: 'local_me', 인자: ['--hook'] });
  assert.match(out, /진짜대기중/, '진짜 대기를 걸러 버리면 이 장치가 생긴 이유(폰 작업 사각)가 되살아난다');
  assert.match(out, /아직 안 들어왔다/, '진짜 미병합은 실측으로 갈랐으니 단정 문장이 맞다');
  assert.doesNotMatch(out, /볼 게 없으면 브랜치를 지운다/, '얕은 클론(=클라우드)에서 삭제 처방은 따를 수 없다 — 로컬 몫으로 넘겨야 한다');
  assert.match(out, /로컬 세션 몫|삭제 대기/, '삭제를 못 하는 환경엔 대체 통로(로컬 몫)를 줘야 방치가 정상이 되지 않는다');
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
 *   칸에서도 한 세션이 착수 직후 양보했다. 파일명(`보드 ← 남`)은 매 세션 뜨는
 *   배경 소음이라 그 자리를 못 메운다 — 필요한 건 **그 줄에 무엇이 적혔나**다.
 *
 * 🔴 좌표가 **정본이어야 한다**(F253 실측). 이 픽스처는 F250 이주 뒤에도 옛 스텁
 *   `docs/세션보드.md` 를 쓰고 있었고, 그래서 도구가 그 스텁을 보는 동안 내내 초록이었다 —
 *   정작 실저장소의 선언은 `docs/_ops/보드/<지문>.md` 라 상시 0건이었는데도. 픽스처가
 *   **아무도 안 쓰는 자리를 재면** 초록은 탐지력이 아니라 좌표 오류를 증명한다. */
const 보드머리 = ['| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |', '|---|---|---|---|'].join('\n');
const 남의보드 = 'docs/_ops/보드/peer0001.md';
function 보드픽스처(줄들) {
  const f = 픽스처();
  더럽힌다(f.repo, 남의보드, `${보드머리}\n| 2026-08-07 | **옛 트랙** | a.js | ✅종결 |\n`);
  f.g('add', '-A'); f.g('commit', '-qm', 'board');
  if (줄들) 더럽힌다(f.repo, 남의보드, `${보드머리}\n| 2026-08-07 | **옛 트랙** | a.js | ✅종결 |\n${줄들}\n`);
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
  const f = 픽스처();                          // 보드가 아예 없는 저장소
  더럽힌다(f.repo, 남의보드, `${보드머리}\n`);   // 머리줄+구분선만 새로 생긴다
  /* 🔴 스테이지해서 **diff 갈래**로 넣는다. (옛 판에서는 add 가 없으면 미추적이라 `git diff` 가
   *   통째로 못 봐서, 통과의 이유가 「필터가 걸렀다」가 아니라 「볼 게 없었다」였다 — 변이 실측
   *   1차에서 필터를 지워도 초록이라 드러났다. 지금은 미추적도 읽으므로 그 사각은 없어졌고,
   *   미추적 갈래는 아래 F253 절이 따로 잰다. 여기 add 는 diff 갈래를 고르는 뜻이다.) */
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

/* ── 인계문은 **파일 이름이 곧 주인이다** (2026-08-07 실측) ──────────────────────
 * 실측: 세션 시작 출력에서 그때 **살아있던 세션 5개**의 `docs/_ops/인계문/<지문>.md` 가 전부
 *   ❔모름으로 떴다. session-report 가 쓰는 파일인데 그 쓰기는 Edit·Write 를 안 거쳐
 *   `touched` 에 한 줄도 안 남기 때문이다.
 * 🔴 ❔가 무해한 칸이 아니다 — 그 안내는 「유물인지 `git log` 와 보드로 확인하라」인데 이 파일은
 *   미추적이라 git log 에도 없고 보드에도 없다. 안내를 끝까지 따르면 **산 세션의 인계문을 유물로
 *   읽고 커밋**하게 된다(F073). 탐지력은 이 묶음이 진다.
 * ⚠ 그러면서 반대로 넘치면 안 된다 — 죽은 세션의 인계문을 ⚪에서 빼면 F111 수거가 통째로 멈춘다. */

const 인계문 = (지문) => `docs/_ops/인계문/${지문}.md`;

/* ⚠ 이 검사의 계약은 **「❔가 아니다」**이지 「🔴로 뜬다」가 아니다 — 08-07 엔 그 둘이 같은 말이었다.
 *   2026-08-12 에 갈렸다: 판정은 그대로 `남의살아있는` 인데 **경보에서만** 빠져 🔇 로 간다
 *   (위 「이름이 곧 주인」 묶음 — 이 파일들이 🔴 를 상시 채워 침묵 설계를 죽이고 있었다).
 *   그래서 관찰 창구를 옮기되, 원래 막으려던 것(❔로 떨어져 「확인 후 커밋」 안내를 받는 것)은
 *   **여기서 더 세게** 못박는다: 🔇 에 있을 것 + ❔ 구획에 없을 것, 둘 다 본다. */
test('🔑 살아있는 세션의 인계문은 **이름만으로** 주인이 잡힌다 — ❔로 떨어지지 않는다 (만진 기록 0)', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 인계문('ab12cd34'), '# 인계문\n');
  세션기록(state, repo, 'local_ab12cd34-1111-2222-3333-444455556666', [], 1);  // touched 비었다 — 그게 실측 조건이다
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.match(out, /🔇[\s\S]*인계문\/ab12cd34\.md/,
    `산 세션의 인계문에 주인을 못 붙였다 — 판정층이 무너지면 커밋 가드도 같이 무너진다:\n${out}`);
  const 모름구간 = out.slice(out.indexOf('❔'));
  assert.ok(!(out.includes('❔') && 모름구간.includes('인계문/ab12cd34.md')),
    `산 세션의 인계문을 ❔로 뒀다 — 그 안내(git log·보드 확인)를 따르면 남의 것을 커밋한다:\n${out}`);
});

test('⚪ 죽은 세션의 인계문은 그대로 유물이다 — 이름이 수거(F111)를 막지 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 인계문('dead0001'), '# 인계문\n');
  세션기록(state, repo, 'local_dead0001-1111-2222-3333-444455556666', [], 400, undefined, true);
  나이먹인다(repo, 인계문('dead0001'), 401);
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.match(out, /⚪[\s\S]*인계문\/dead0001\.md/,
    `죽은 세션의 인계문까지 잡아 뒀다 — 수거가 멈추면 미추적 인계문이 영원히 쌓인다:\n${out}`);
});

test('🔴[거짓양성] 인계문 **자리 밖**의 같은 이름은 지문으로 안 읽는다', { skip: !git있나 && 'git 없음' }, () => {
  /* 이름 8자리는 흔한 모양이다(해시·날짜·id). 자리를 안 보면 엉뚱한 파일에 주인이 붙고,
   * 그 주인이 살아 있으면 **아무도 못 만지는 파일**이 생긴다 — 거짓 차단이 곧 우회다. */
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'docs/인계문/ab12cd34.md', 'x\n');      // `_ops` 가 없다 = 다른 자리
  세션기록(state, repo, 'local_ab12cd34-1111-2222-3333-444455556666', [], 1);
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.ok(!/🔴[\s\S]*docs\/인계문\/ab12cd34\.md/.test(out),
    `인계문 자리가 아닌 파일에 이름만 보고 주인을 붙였다:\n${out}`);
});

test('🔴[거짓양성] 어느 세션과도 안 맞는 지문은 **주인을 지어내지 않는다**', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 인계문('99999999'), 'x\n');             // 그런 세션은 없다
  세션기록(state, repo, 'local_other001-1111-2222-3333-444455556666', [], 1);
  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.match(out, /❔[\s\S]*인계문\/99999999\.md/,
    `이름을 근거로 없는 주인을 만들어 붙였다 — 모름은 모름으로 남아야 한다:\n${out}`);
});

/* ── F192 — 대기 중인 폰 브랜치가 「반입하면 붙는가」 (2026-08-08) ────────────────────────
 *
 * 실사고: `hftriw` 가 갈래점에서 317 커밋 뒤처진 채 공유 선언판(보드·인계문·장부)을 고쳐 두고
 *   16시간 대기했는데, 도구는 존재만 알리고 「내용부터 봐라」로 끝났다. 결정을 가르는 값은
 *   내용이 아니라 **붙는가**다 — 충돌을 손으로 푸는 자리가 곧 남의 줄이 되돌아가는 자리다(F187).
 *
 * 판정은 git 의 3-way 병합 그 자체다(손 근사 금지). 그래서 여기서 잠그는 것은 셋:
 *   ① 충돌을 **답으로** 읽는가 — `merge-tree` 는 충돌을 status 1 로 알린다. 실패로 접으면 모름이 된다.
 *   ② 깨끗한 병합을 충돌로 만들지 않는가(거짓양성이 쌓이면 이 줄이 배경 소음이 된다).
 *   ③ **못 잰 것을 0건으로 바꾸지 않는가** — 이 파일의 최우선 불변식.
 */
const 소유자 = require(TOOL);          // `require.main` 가드가 있어 require 만으로는 안 돈다
const { 반입충돌 } = 소유자;

/** master 와 브랜치가 같은 파일의 같은 줄을 서로 다르게 고친 픽스처(=반드시 충돌). */
function 갈라진픽스처(공유파일) {
  const { repo, g } = 픽스처();
  fs.mkdirSync(path.join(repo, path.dirname(공유파일)), { recursive: true });
  fs.writeFileSync(path.join(repo, 공유파일), '한 줄\n');
  g('add', '-A'); g('commit', '-qm', '갈래점');
  g('branch', '-q', '폰');
  fs.writeFileSync(path.join(repo, 공유파일), 'master 가 고친 줄\n');   // master 쪽
  g('add', '-A'); g('commit', '-qm', 'master');
  g('checkout', '-q', '폰');
  fs.writeFileSync(path.join(repo, 공유파일), '폰이 고친 줄\n');        // 브랜치 쪽 — 같은 줄
  g('add', '-A'); g('commit', '-qm', '폰');
  g('checkout', '-q', 'master');
  return { repo, g };
}

test('🔴 폰 브랜치가 공유 선언판에서 부딪히면 **그 파일을 이름으로** 집는다 (F192)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo } = 갈라진픽스처('docs/세션보드.md');
    const 충돌 = 반입충돌('폰', repo);
    assert.ok(Array.isArray(충돌), `충돌을 실패로 접었다(모름이 됐다): ${충돌}`);
    assert.deepEqual(충돌, ['docs/세션보드.md'],
      `merge-tree 의 답을 못 읽었다 — 충돌 목록이 어긋난다: ${JSON.stringify(충돌)}`);
  });

test('[거짓양성] 서로 다른 파일만 고친 브랜치는 **충돌 0** 이다 — 뒤처짐 자체는 충돌이 아니다',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, g } = 갈라진픽스처('docs/세션보드.md');
    g('checkout', '-q', '-b', '딴데', 'HEAD~1');           // 갈래점에서 새로 뻗어
    fs.writeFileSync(path.join(repo, '딴파일.txt'), '안 겹친다\n');
    g('add', '-A'); g('commit', '-qm', '딴 파일만');
    g('checkout', '-q', 'master');
    assert.deepEqual(반입충돌('딴데', repo), [],
      '안 겹치는 브랜치를 충돌로 읽었다 — 거짓양성이 쌓이면 이 줄이 배경 소음이 된다');
  });

test('🔴 못 잰 것을 **0건으로 바꾸지 않는다** — 없는 브랜치는 `null`(모름)이다',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo } = 픽스처();
    assert.equal(반입충돌('그런브랜치없음', repo), null,
      '못 잰 것을 빈 배열로 돌려줬다 — 그러면 화면에 「깨끗이 붙는다」로 나간다(모름≠안전)');
  });

/* 🔑 배선 — 판정(반입충돌)과 표시(보고)를 따로 잠가도 **둘을 잇는 자리**는 아무도 안 잰다.
 *   변이 실측: 주석 붙이는 한 줄을 지우자 위 검사 넷이 전부 초록이었다(`충돌`이 undefined 가 되고
 *   화면에서는 그 줄이 통째로 사라지거나 죽는다 — 새는 방향이 「조용함」이다). 그래서 원격까지
 *   갖춘 픽스처로 도구를 실제로 띄운다. */
test('🔴 배선: 원격 브랜치가 실제로 화면까지 「충돌」을 들고 나온다 (F192)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, g } = 갈라진픽스처('docs/세션보드.md');
    const state = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-state-'));
    임시들.push(state);
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-origin-'));
    임시들.push(bare);
    spawnSync('git', ['init', '-q', '--bare', bare], { encoding: 'utf8' });
    g('remote', 'add', 'origin', bare);
    g('branch', '-M', 'master');                       // 도구·git 둘 다 `master` 를 본다
    g('push', '-q', 'origin', 'master');
    g('push', '-q', 'origin', '폰:refs/heads/claude/continue-work-폰');

    const out = 돌린다({ repo, state, 나: 'local_me00' });
    assert.match(out, /claude\/continue-work-폰/, `대기 브랜치를 아예 안 알렸다:\n${out}`);
    assert.match(out, /충돌/, `브랜치는 알리면서 **붙는지**는 안 알렸다 — 그게 F192 의 원문이다:\n${out}`);
    assert.match(out, /공유 선언판/, '보드에서 부딪히는데 되돌림 위험(F187)을 안 짚었다');
  });

test('표시층: 충돌·깨끗·모름이 **서로 다른 문장**으로 나간다 (F192)', () => {
  const 뼈대 = { git못부름: false, 나: 'local_me00', 항목: [], 세션수: 1, 못본형제: [], 보드: [], 뒤늦음: { 항목: [], 못잼: 0 } };
  const 한줄 = (충돌) => 소유자.보고({ ...뼈대, 원격: [{ 이름: 'origin/claude/x', 언제: '1 hour ago', 제목: 't', 충돌 }] }, { 훅: false });

  const 충돌판 = 한줄(['docs/세션보드.md', 'tools/a.js']);
  assert.match(충돌판, /2개 파일이 충돌/, `충돌을 안 알렸다:\n${충돌판}`);
  assert.match(충돌판, /공유 선언판[\s\S]*F187/, '공유 선언판이 섞였는데 되돌림 위험을 안 짚었다');

  assert.match(한줄([]), /충돌 \*\*0\*\*/, '깨끗이 붙는 브랜치를 안 알렸다 — 지울지 판단할 재료가 없다');
  assert.match(한줄(null), /못 쟀다/, '못 잰 것이 「깨끗하다」와 같은 문장으로 나갔다');
  assert.ok(!/충돌 \*\*0\*\*/.test(한줄(null)), '모름을 0건으로 표시했다 — 이 파일의 최우선 불변식 위반');
});

test('🔑 「이름→지문」 변환은 **한 곳**이다 — 인계문수거가 자기 사본을 들면 갈라진다', () => {
  /* 갈라졌을 때의 증상이 조용하다: 한쪽만 고치면 수거는 산 세션의 인계문을 거둬 가고,
   * 소유자 도구는 그걸 ❔로 두어 아무도 안 짖는다. 그래서 사본 자체를 금지한다. */
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'tools', '인계문수거.js'), 'utf8');
  const src코드 = 코드만(src); // 부정 단언의 주어만 — 위 긍정 단언(`assert.match(src, …)`)은 원문 그대로
  assert.match(src, /소유자\.인계문지문\(/, '수거가 공용 변환을 안 쓴다 — 어디서 오는지 알 수 없다');
  assert.ok(!/\(\[A-Za-z0-9_-\]\+\)\\\.md/.test(src코드),
    '옛 통로(파일명 정규식 사본)가 돌아왔다 — 자리 판정이 빠져 폴더 밖 파일까지 세션 파일로 읽는다');
  assert.ok(!/['"`]docs\/_ops\/인계문/.test(src코드),
    '인계문 자리를 한 벌 더 적었다 — 자리가 바뀌면 두 도구가 다른 폴더를 본다');
});

/* ── 배포 뒤처짐 — 「저장소가 마지막 배포 커밋보다 앞섰다」 (F240) ─────────────
 *
 * 🔑 탐지력은 **전부 픽스처**가 진다. 실저장소는 배포 직후엔 깨끗해서, 거기서만 재면
 *   「안 뜬다」와 「안 돈다」가 같은 모양이다(F207). 실저장소에는 거짓양성만 묻는다.
 *
 * 판정은 배포판점검 소유고 이 파일은 **발화 자리**를 진다 — 그래서 마지막 검사가 판정과
 *   표시를 잇는 배선이다. F192 가 정확히 그 자리에서 샜다(판정 넷이 초록인데 화면은 침묵).
 */
const 배포점검 = require(path.resolve(__dirname, '..', 'tools', '배포판점검.js'));

/** 채번 커밋(`Code.js` 의 `const SYNK_VERSION` 줄) 하나 + 그 뒤 커밋 한 개.
 *  `.claspignore` 가 없어 폴백 패턴(`*.js`)이 선다.
 *
 *  ⚠ 뒤 커밋이 `Code.js` 를 고칠 때도 **채번 줄은 그대로 둔다** — 실제 트랙이 그렇게 움직인다
 *    (기능 편집은 버전을 안 올린다). 여기서 채번 줄까지 갈아치우면 기준선이 뒤 커밋으로 옮겨가
 *    픽스처가 늘 「드리프트 0」을 내고, 그러면 이 아래 탐지력 검사가 통째로 무의미해진다 —
 *    그런데 그 고장은 **초록의 모습**으로 온다(맹점 ④).
 *  🔑 제목을 인자로 연 이유는 #Q75 다: 옛 판이 제목 `^\[v` 로 기준선을 골라서, 태그를 **꼬리**에
 *    단 실제 커밋(`015b9fd4 … [v9.231]`)을 통째로 못 봤다. 표기는 사람이 정해서 갈리므로
 *    픽스처도 **갈리는 표기**를 재야 한다(맹점 ① — 사람이 실제로 쓰는 표기로 검사한다). */
const 채번줄 = "const SYNK_VERSION = 'v9.100';\n";
function 배포픽스처(뒤에고칠파일, { 제목 = '[v9.100] 배포 커밋' } = {}) {
  const { repo, g } = 픽스처();
  fs.writeFileSync(path.join(repo, 'Code.js'), 채번줄 + 'ㄱ\n');
  fs.writeFileSync(path.join(repo, '문서.md'), 'ㄱ\n');
  g('add', 'Code.js', '문서.md'); g('commit', '-qm', 제목);
  if (뒤에고칠파일) {
    /* 채번 줄을 살린 채 «내용만» 바꾼다 — 위 ⚠ 그대로. */
    fs.writeFileSync(path.join(repo, 뒤에고칠파일), 뒤에고칠파일 === 'Code.js' ? 채번줄 + 'ㄴ\n' : 'ㄴ\n');
    g('add', 뒤에고칠파일); g('commit', '-qm', '그 뒤에 난 커밋');
  }
  return repo;
}

test('🔴 배포 커밋 뒤에 배포집합이 바뀌면 잡는다 — 그게 「라이브에 아직 안 나간 것」이다 (F240)',
  { skip: !git있나 && 'git 없음' }, () => {
    const repo = 배포픽스처('Code.js');
    const r = 배포점검.안나간변경(repo, [repo]);
    assert.strictEqual(r.커밋수, 1, `배포 커밋 이후 커밋 수가 어긋난다: ${JSON.stringify(r)}`);
    assert.deepEqual(r.프로젝트들.flatMap((p) => p.파일들), ['Code.js']);
  });

test('[거짓양성] 배포집합 밖(문서)만 바뀌면 0건 — 문서 커밋마다 짖으면 이 줄은 배경 소음이 된다',
  { skip: !git있나 && 'git 없음' }, () => {
    const repo = 배포픽스처('문서.md');
    assert.deepEqual(배포점검.안나간변경(repo, [repo]).프로젝트들, []);
  });

/* 태그로 재던 첫 판이 여기서 죽었다(2026-08-08 실측): bump-version 이 origin 에 원자 채번해
 * 태그가 배포와 무관한 커밋에 붙으므로, 태그 기준이면 **마지막 배포 자신**이 늘 「안 나간 것」
 * 으로 잡혀 상시 거짓양성이 된다. 재료가 커밋 제목이라는 것을 이 검사가 못박는다. */
test('🔑 기준은 태그가 아니라 채번 줄이다 — 엉뚱한 커밋에 붙은 태그에 안 속는다',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, g } = 픽스처();
    fs.writeFileSync(path.join(repo, 'Code.js'), 채번줄 + 'ㄱ\n');
    g('add', 'Code.js'); g('commit', '-qm', '[v9.100] 배포 커밋');
    fs.writeFileSync(path.join(repo, '문서.md'), 'ㄱ\n');
    g('add', '문서.md'); g('commit', '-qm', 'docs: 배포와 무관한 커밋');
    g('tag', 'synk-v9.100');                       // 태그가 배포 커밋이 **아닌** 곳에 붙었다
    assert.deepEqual(배포점검.안나간변경(repo, [repo]).프로젝트들, [],
      '태그를 기준으로 재고 있다 — 배포 커밋 자신이 「안 나간 것」으로 잡혀 상시 거짓양성이 된다');
  });

/* ── #Q75 — 기준선을 «제목»에서 고르던 판이 매 SessionStart 마다 거짓으로 울었다 ────────
 *
 * 실사고 2026-08-14: 옛 판은 `--grep '^\[v'` 로 제목 **머리**의 버전 태그만 봤다. 그런데
 *   `015b9fd4`(「fix: 「골든셋」 → 「강사 정답 모음」 개명 — 뜻이 안 서는 낱말 **[v9.231]**」)는
 *   태그를 **꼬리**에 달았고, 그래서 기준선이 한 칸 낡은 `e61ef44`([v9.230])로 잡혀
 *   **드리프트가 0인** 저장소가 「커밋 203개 · 배포 파일 4개」로 매 세션 울었다.
 *   이력 전체로는 버전 태그를 단 커밋 290 중 머리 255 · **그 밖 35** — 드문 형태가 아니다.
 *   지금 판은 제목이 아니라 `bump-version` 이 **기계로 쓰는** 채번 줄에서 기준선을 고른다.
 *
 * 🔑 탐지력을 여기(픽스처)가 지는 이유(맹점 ②): 실저장소는 이 수리로 깨끗해져서, 거기서만 재면
 *   「안 뜬다」와 「안 돈다」가 같은 모양이다(F207).
 */
test('[탐지력] 버전 태그가 제목 «꼬리»에 있어도 기준선으로 잡는다 — 표기는 사람이 정해서 갈린다 (#Q75)',
  { skip: !git있나 && 'git 없음' }, () => {
    const repo = 배포픽스처('Code.js',
      { 제목: 'fix: 「골든셋」 → 「강사 정답 모음」 개명 — 뜻이 안 서는 낱말 [v9.100]' });
    const r = 배포점검.안나간변경(repo, [repo]);
    assert.notDeepStrictEqual(r, { 배포커밋: null },
      '제목 «머리»만 보고 있다 — 꼬리에 태그를 단 채번 커밋을 「잴 기준이 없다」로 떨어뜨렸다(#Q75 실사고 그대로)');
    assert.strictEqual(r.커밋수, 1, `기준선이 어긋난다: ${JSON.stringify(r)}`);
    assert.deepEqual(r.프로젝트들.flatMap((p) => p.파일들), ['Code.js']);
  });

/* 🚫 처방은 「정규식을 아무 데나 매칭하도록 넓히기」가 **아니다** — 그러면 반대 방향으로 샌다.
 *   그 「그 밖 35」의 다수는 버전을 **언급만** 하는 문서 커밋이고, 그것이 기준선이 되면 그 앞의
 *   진짜 드리프트가 통째로 덮인다. 새는 방향은 언제나 「통과」다(맹점 ④). */
test('🔑 버전을 «언급만» 한 커밋은 기준선이 아니다 — 넓힌 정규식은 진짜 드리프트를 조용히 덮는다 (#Q75)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, g } = 픽스처();
    fs.writeFileSync(path.join(repo, 'Code.js'), 채번줄 + 'ㄱ\n');
    g('add', 'Code.js'); g('commit', '-qm', '[v9.100] 배포 커밋');            // c1 = 기준선이어야 한다
    fs.writeFileSync(path.join(repo, 'Code.js'), 채번줄 + 'ㄴ\n');            // 채번 줄은 그대로
    g('add', 'Code.js'); g('commit', '-qm', '엔진 수리');                     // c2 = 진짜 드리프트
    fs.writeFileSync(path.join(repo, '문서.md'), 'ㄱ\n');
    g('add', '문서.md'); g('commit', '-qm', 'docs: 보드 — 트랙 종결 ([v9.101] dbfa38d)'); // c3 = 언급만
    assert.deepEqual(배포점검.안나간변경(repo, [repo]).프로젝트들.flatMap((p) => p.파일들), ['Code.js'],
      '버전을 «언급만» 한 문서 커밋이 기준선이 됐다 — 그 앞의 진짜 드리프트가 통째로 덮인다');
  });

/* ⚠ **이 재료의 대가**(맹점 ④ — 새 장치엔 틀릴 때의 모습을 함께 적는다): 기준선이 `Code.js` 의
 *   그 줄 하나에 걸려 있다. 상수를 다른 파일로 옮기거나 파일을 개명하면 기준선이 `null` 이 되고,
 *   호출부는 「배포 커밋이 없다」를 **말하지 않도록** 되어 있어서(`작업본소유자.js` 침묵 조건)
 *   이 층이 **조용히 죽는다** — 그 고장은 «깨끗함»과 글자 하나 다르지 않다. 그래서 여기서 못박는다.
 *   (실저장소 파일 하나만 읽는다 — repo 밖 환경에 안 기대므로 CI 에서 깨지지 않는다 · F296.) */
test('⚠ 대가 — 채번 상수가 `Code.js` 에 살아 있어야 이 층이 돈다(옮기면 조용히 죽는다 · #Q75)', () => {
  const code = fs.readFileSync(path.resolve(__dirname, '..', 'Code.js'), 'utf8');
  assert.match(code, /^const SYNK_VERSION = '/m,
    '`Code.js` 에 채번 줄이 없다 — 배포 뒤처짐 기준선이 null 로 떨어지는데, 그 침묵은 「깨끗함」과 같은 모양이다');
});

test('🔑 배포 커밋이 아예 없으면 「0건」이 아니라 **잴 기준이 없다** 로 답한다',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo } = 픽스처();                     // seed 커밋만 있고 `[vN]` 이 없다
    assert.deepEqual(배포점검.안나간변경(repo, [repo]), { 배포커밋: null });
  });

test('🔑 git 을 못 부르면 null(=모름) — 실패를 「변경 0」으로 접지 않는다', () => {
  const 빈곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-nogit-'));
  임시들.push(빈곳);
  assert.strictEqual(배포점검.안나간변경(빈곳, [빈곳]), null);
});

/* ── 라이브 실측 도장이 이 층의 거짓양성을 재운다 (2026-08-10 · F244 후속) ──────────
 *
 * 실측이 낳은 검사다: 같은 시각에 `안나간변경()` 은 「엔진_셋업확장.js 가 안 나갔다」를,
 * `라이브대조()` 는 「배포집합 15개 바이트 동일」을 냈다. 이 층은 **매 SessionStart** 발화라
 * 거짓 🔴 도 매번이고, 매번 틀리는 경고는 진짜 드리프트가 왔을 때 이미 무시당하고 있다.
 *
 * 🔑 재우는 방향보다 **깨우는 방향**이 급소다 — 도장이 낡았는데도 계속 재우면 거짓양성을 지운
 *   대가로 **거짓음성**이 되고, 그건 이 도구가 존재하는 이유(소급 불가 데이터의 하루 손실)를
 *   정면으로 깬다. 그래서 「지문이 달라졌다」와 「초록이 아니었다」를 각각 못박는다.
 */
const 부패 = require(path.resolve(__dirname, '..', 'tools', 'rot-check.js'));

/** 도장을 **쓰는 쪽(rot-check)** 을 통해 만들고, 읽는 쪽이 실제로 쓰는 키로 조회시킨다.
 *  도장 모양을 이 파일이 손으로 적으면 두 모듈이 갈려도 이 검사는 계속 초록이다 — 가드가
 *  자기 전처리에 눈머는 것과 같은 형태라, 왕복으로 재야 키 규칙의 어긋남이 드러난다. */
function 도장왕복(repo, { 초록 = true, 지문바꿔 = false } = {}) {
  const 이름 = 배포점검.안나간변경(repo, [repo], { 도장: false }).프로젝트들[0].이름;
  const 조각 = 부패.배포도장(1786334722806, {
    결과: [{ 이름, 실측: { 지문: 지문바꿔 ? 'deadbeef' : 배포점검.지문(repo, repo), 초록 } }],
  });
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-stamp-'));
  임시들.push(d);
  const f = path.join(d, 'rot-check.json');
  fs.writeFileSync(f, JSON.stringify(조각));
  const 옛 = process.env.SYNK_ROT_STATE;
  process.env.SYNK_ROT_STATE = f;
  try { return 배포점검.안나간변경(repo, [repo]); } finally {
    if (옛 === undefined) delete process.env.SYNK_ROT_STATE; else process.env.SYNK_ROT_STATE = 옛;
  }
}

test('🔑 라이브 실측이 초록이었고 그 뒤 배포집합이 안 바뀌었으면 재운다 — 이 층은 매 세션 발화라 거짓 🔴 도 매번이다',
  { skip: !git있나 && 'git 없음' }, () => {
    const r = 도장왕복(배포픽스처('Code.js'));
    assert.deepEqual(r.프로젝트들, [], `재우지 못했다 — 도장 키가 갈렸거나 배선이 안 돈다: ${JSON.stringify(r)}`);
    assert.deepEqual(r.가라앉힘.map((p) => p.파일들), [['Code.js']],
      '뺀 것을 구조로 안 돌려준다 — 호출부가 「이게 전부」로 읽는다(조용한 절단)');
  });

test('🔴 도장의 지문이 지금과 다르면 **다시 깨운다** — 재우기만 하면 거짓양성 대신 거짓음성이 된다',
  { skip: !git있나 && 'git 없음' }, () => {
    const r = 도장왕복(배포픽스처('Code.js'), { 지문바꿔: true });
    assert.deepEqual(r.프로젝트들.flatMap((p) => p.파일들), ['Code.js'],
      '실측 뒤에 배포 파일이 바뀌었는데 침묵한다 — 시각만 보고 지문을 안 보는 배선이다');
    assert.deepEqual(r.가라앉힘, []);
  });

test('🔴 마지막 실측이 초록이 아니었으면 재우지 않는다 — 🔴 였던 판을 침묵으로 덮으면 안 된다',
  { skip: !git있나 && 'git 없음' }, () => {
    const r = 도장왕복(배포픽스처('Code.js'), { 초록: false });
    assert.deepEqual(r.프로젝트들.flatMap((p) => p.파일들), ['Code.js']);
  });

test('🔑 도장이 없으면 옛 동작 그대로 — 이 배선이 깨져도 퇴화 방향은 「말한다」다',
  { skip: !git있나 && 'git 없음' }, () => {
    const repo = 배포픽스처('Code.js');
    const 옛 = process.env.SYNK_ROT_STATE;
    process.env.SYNK_ROT_STATE = path.join(os.tmpdir(), 'synk-없는도장-XXXX.json');
    try {
      assert.deepEqual(배포점검.안나간변경(repo, [repo]).프로젝트들.flatMap((p) => p.파일들), ['Code.js']);
    } finally {
      if (옛 === undefined) delete process.env.SYNK_ROT_STATE; else process.env.SYNK_ROT_STATE = 옛;
    }
  });

test('🔑 도장은 **잰 것만** 담는다 — 지문을 못 잰 프로젝트가 초록으로 새면 그 자리는 영원히 침묵한다', () => {
  const 조각 = 부패.배포도장(1, { 결과: [
    { 이름: '(루트)', 실측: { 지문: null, 초록: true } },      // 지문을 못 쟀다
    { 이름: 'crewcard', 실측: { 지문: 'aaaaaaaa', 초록: true } },
  ] });
  const 키 = 배포점검.도장키;
  assert.deepEqual(Object.keys(조각[키].프로젝트들), ['crewcard']);
  assert.deepEqual(부패.배포도장(1, { 결과: [] }), {}, '담을 게 없으면 키 자체를 안 만든다 — 빈 도장이 남으면 다음 판정이 그것을 읽는다');
});

test('🔴 배선: 뒤처지면 **훅이 입을 연다** — 판정만 서고 화면엔 영영 안 나오는 자리를 막는다 (F240)', () => {
  const 뼈대 = { git못부름: false, 나: 'local_me00', 항목: [], 세션수: 1, 못본형제: [],
    원격: [], 보드: [], 뒤늦음: { 항목: [], 못잼: 0 } };
  const 보고 = (배포뒤처짐) => 소유자.보고({ ...뼈대, 배포뒤처짐 }, { 훅: true });

  assert.strictEqual(보고({ 배포커밋: 'abc1234', 제목: '[v9.100] x', 커밋수: 3, 프로젝트들: [] }), '',
    '뒤처짐 0인데 훅이 짖었다 — 소음은 알림을 죽인다');
  assert.strictEqual(보고({ 배포커밋: null }), '',
    '배포 커밋이 없는 저장소에서 짖었다 — 그건 사고가 아니라 픽스처·새 저장소다');

  const 소리 = 보고({ 배포커밋: 'abc1234', 제목: '[v9.100] 배포', 커밋수: 3,
    프로젝트들: [{ 이름: '(루트)', 경로: '.', 파일들: ['Code.js', '상담AI.js'] }] });
  assert.ok(소리, '뒤처졌는데 훅이 조용했다 — 침묵 조건에 안 넣으면 절만 쓰고 화면엔 안 나온다');
  assert.match(소리, /Code\.js[\s\S]*상담AI\.js/, '어느 파일인지 안 불렀다 — 개수만으로는 아무도 안 움직인다');
  assert.match(소리, /라이브를 읽어서 하는 말이 아니다/,
    '간접 증거를 단정으로 냈다 — 이 재료는 git 이지 라이브가 아니다(F030)');

  assert.match(보고(null), /못 쟀다/, '판정 도구를 못 불렀는데 조용했다 — 모름이 안전으로 접혔다');
});

/* ── F247 · 유물을 **이어받기 전에 칠 명령** (2026-08-08 실측) ────────────────────
 * ⚪ 는 「이어받아도 된다」까지만 말하고 **초록인지 빨강인지는 안 쟀다.** 실물: 죽은 세션 둘이
 * 남긴 305줄에 회귀 2건이 적색인 채 1시간 넘게 있었다. 미커밋이라 CI 는 원리상 못 보고,
 * auto-commit 의 구문검사도 못 본다(둘 다 **구문은 멀쩡했다**). 발견 경로는 장치가 아니라
 * 이어받은 세션이 우연히 그 테스트를 돌린 것이었다.
 * 🔑 여기서 **돌리지는 않는다** — 그 회귀 3개가 74초다. 대신 그 세션이 실제로 칠 명령을 준다. */
test('🔴 [F247] 유물에 테스트가 섞였으면 그 파일을 넣은 실행 명령을 준다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  for (const f of ['tests/트랙충돌.test.js', '.claude/hooks/track-collision.js']) {
    더럽힌다(repo, f, 'x\n');
    나이먹인다(repo, f, 401);
  }
  세션기록(state, repo, 'local_dead0001', ['tests/트랙충돌.test.js', '.claude/hooks/track-collision.js'], 400, undefined, true);

  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.match(out, /이어받기 전에 초록인지 먼저 잰다/,
    `유물을 「이어받아도 된다」로만 넘겼다 — 빨간 판이 그대로 실린다:\n${out}`);
  /* 🔑 명령은 **그 파일을 담아야** 한다. 「테스트를 돌려라」는 프로즈고, 프로즈는 실행되지 않는다
   *   (F235 가 같은 자리에서 채택한 형태: 알림은 실행할 명령과 함께 나간다). */
  assert.match(out, /node --test [^\n]*"tests\/트랙충돌\.test\.js"/,
    `돌릴 테스트를 명령으로 안 줬다 — 다음 세션이 어느 파일인지 다시 찾아야 한다:\n${out}`);
  assert.match(out, /node --check [^\n]*"\.claude\/hooks\/track-collision\.js"/,
    `테스트가 아닌 코드의 구문검사를 안 줬다:\n${out}`);
  assert.match(out, /커밋하지 않는다/, '빨강일 때 무엇을 하지 말아야 하는지가 없다');
});

test('🔑 [F247] 테스트가 없으면 `node --test` 를 지어내지 않는다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, 'tools/도구.js', 'x\n');
  나이먹인다(repo, 'tools/도구.js', 401);
  세션기록(state, repo, 'local_dead0002', ['tools/도구.js'], 400, undefined, true);

  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.match(out, /node --check [^\n]*"tools\/도구\.js"/, `구문검사를 안 줬다:\n${out}`);
  // 빈 `node --test` 는 **저장소 전체**를 돌린다 — 74초를 세우고, 그 값은 유물과 무관하다.
  assert.ok(!/node --test/.test(out), `돌릴 테스트가 없는데 명령을 냈다 — 빈 --test 는 전량 실행이다:\n${out}`);
});

test('🔗 [F247] 형제 저장소 유물은 **그 저장소에서** 재라고 말한다', { skip: !git있나 && 'git 없음' }, () => {
  /* 한 줄에 섞으면 그 명령이 **여기서 안 돈다**(형제는 `-C` 가 필요하다). 오늘 실물 유물의
   * 절반이 SYNK-talk 것이었으므로 이 갈래를 안 내면 처방이 실측의 절반을 덮는다. */
  const { repo, state } = 픽스처();
  const 형제 = 픽스처();
  const 이름 = path.basename(형제.repo);
  더럽힌다(형제.repo, 'lib/이벤트검증.js', 'peer\n');
  나이먹인다(형제.repo, 'lib/이벤트검증.js', 401);
  세션기록(state, repo, 'local_dead0003', [`../${이름}/lib/이벤트검증.js`], 400, undefined, true);

  const out = 돌린다({ repo, state, 나: 'local_me00', 형제: [형제.repo] });
  assert.match(out, /⚪[\s\S]*이벤트검증\.js/, `형제 유물을 ⚪ 로 안 냈다 — 전제가 깨졌다:\n${out}`);
  assert.ok(out.includes(`형제 ${이름} 의 유물은`),
    `어느 저장소에서 재야 하는지 안 밝혔다 — 여기서 돌리면 그 파일을 못 찾는다:\n${out}`);
});

test('🟢 [F247] 유물이 없으면 한 줄도 안 낸다 — 거짓양성이 곧 무시다', { skip: !git있나 && 'git 없음' }, () => {
  const { repo, state } = 픽스처();
  더럽힌다(repo, '산것.js', 'x\n');
  세션기록(state, repo, 'local_alive001', ['산것.js'], 1);   // 살아있음 → 🔴 이지 ⚪ 가 아니다

  const out = 돌린다({ repo, state, 나: 'local_me00' });
  assert.match(out, /🔴/, '전제가 깨졌다 — 살아있는 남의 작업본이 안 잡혔다');
  assert.ok(!/이어받기 전에 초록인지/.test(out),
    `유물이 0건인데 검증 처방이 나왔다 — 매번 뜨는 줄은 그 순간부터 안 읽힌다:\n${out}`);
});

// ── 🧭 보드 선점 (F161 · F250 이주 뒤 죽어 있던 자리 · F253) ───────────────
/* 이 절이 지키는 성질 셋. 새는 방향은 셋 다 **「0건」= 조용함**이라, 「선점이 없다」와
 * 「탐지가 죽었다」가 화면에서 같은 모양이 된다 — 실제로 F250 이주 뒤 그렇게 죽어 있었다. */
const 보드줄 = (트랙, 상태) => `| 2026-08-08 | ${트랙} | tools/x.js | ${상태} |\n`;

test('🔴 [F253] 세션의 **첫 선언**(미추적 새 파일)을 잡는다 — diff 로는 원리상 안 보인다',
  { skip: !git있나 && 'git 없음' }, () => {
    /* F250 이후 보드는 세션당 파일 하나다. 그래서 「막 선언하고 아직 커밋 전」이 곧
     * **새 파일 = 미추적**이고, `git diff HEAD` 는 미추적을 안 담는다. 선점 경고가 가장
     * 필요한 창이 정확히 거기라, 이 갈래가 없으면 장치가 있으나 마나다. */
    const { repo, state } = 픽스처();
    더럽힌다(repo, 'docs/_ops/보드/bbbbbbbb.md', 보드줄('**교정 통로 GET /v1/corrections**', '🔵착수'));

    const out = 돌린다({ repo, state, 나: 'local_me000000' });
    assert.match(out, /🧭[\s\S]*커밋 안 된 보드 선언/, `선점을 한 줄도 안 냈다:\n${out}`);
    const 선점줄 = out.split('\n').find((l) => l.includes('교정 통로 GET /v1/corrections'));
    assert.ok(선점줄, `선언 **내용**이 안 나왔다 — 파일명만으로는 겹치는지 모른다:\n${out}`);
    /* 🔴 `out.includes('bbbbbbbb')` 로 재면 **아무것도 안 잰다** — 같은 이름이 위쪽 미커밋
     *   파일 목록에도 뜨기 때문이다(변이 실측: 주인 표시를 통째로 지워도 초록이었다).
     *   주인은 **그 선언 줄 안에** 있어야 조율할 상대를 안다. */
    assert.ok(선점줄.includes('bbbbbbbb'), `주인을 그 줄에 안 밝혔다 — 조율할 상대를 모른다:\n${out}`);
  });

test('🔴 [F253] 추적 파일의 미커밋 줄도 잡고, 백틱 안 파이프에서 칸이 안 밀린다',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state, g } = 픽스처();
    더럽힌다(repo, 'docs/_ops/보드/cccccccc.md', 보드줄('머리', '옛줄'));
    g('add', '-A'); g('commit', '-qm', '보드');
    /* 트랙 칸이 `2>&1|docs/…` 를 인용한다 — 날 split 이면 여기서 칸이 밀려 상태 칸 자리에
     * 트랙 조각이 온다. 오류는 안 난다(조용한 오독). */
    더럽힌다(repo, 'docs/_ops/보드/cccccccc.md',
      보드줄('머리', '옛줄') + 보드줄('**장부가 `2>&1|docs/x.md` 를 센다**', '🔵착수함'));

    const out = 돌린다({ repo, state, 나: 'local_me000000' });
    assert.ok(out.includes('장부가 `2>&1|docs/x.md` 를 센다'), `트랙 칸이 밀렸다:\n${out}`);
    assert.ok(out.includes('🔵착수함'), `상태 칸 자리에 딴 칸이 왔다:\n${out}`);
  });

test('🔑 [F253] 내 파일은 선점이 아니다 — 안 빼면 내가 나를 남으로 읽는다',
  { skip: !git있나 && 'git 없음' }, () => {
    /* 세션 중반엔 내 선언도 미커밋이다. 지문 규칙(`local_` 접두 떼기)은 board-id 한 곳에서만
     * 파생시킨다 — 여기 손으로 다시 적었다가 접두를 안 떼서 내 줄이 그대로 떴다(실측). */
    const { repo, state } = 픽스처();
    더럽힌다(repo, 'docs/_ops/보드/dddddddd.md', 보드줄('**내가 방금 선언한 트랙**', '🔵착수'));

    const out = 돌린다({ repo, state, 나: 'local_dddddddd-1111-2222-3333-444455556666' });
    assert.ok(!out.includes('내가 방금 선언한 트랙'),
      `내 선언을 남의 선점으로 냈다 — 매 세션 자기 줄이 떠서 그 순간부터 안 읽힌다:\n${out}`);
  });

  /* ── ⏹ 주인이 죽은 「착수」 줄 (F270 · 2026-08-08) ─────────────────────────────
   * 실측: talk 회귀 트랙이 형제 `c906960`·`e00aa36` 으로 **끝났는데** 선언한 세션이 그 전에 죽어,
   * 보드에는 26시간째 🔵착수 로 남았다. 읽은 세션은 그 줄을 두 번 오독했다 — ①그 일이 안 됐다
   * ②그 자리는 남이 잡고 있다. 아카이브에 「자리가 비었다」까지 적혔고 코드 grep 이 뒤늦게 잡았다.
   *
   * 🔑 탐지력은 **이 픽스처가 진다** — 실저장소의 죽은 줄은 그때그때 달라서, 있으면 초록이고
   *   없으면 조용하다. 그 초록은 검사가 돌았는지조차 말하지 않는다(CLAUDE.md 가드 맹점 ②). */
  test('죽은 세션의 🔵착수 줄을 짚는다 — 산 세션·✅종결은 안 짚는다 (F270)', { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state, g } = 픽스처();
    더럽힌다(repo, 'docs/_ops/보드/eeeeeeee.md', 보드줄('**죽은 세션의 착수**', '🔵착수'));
    더럽힌다(repo, 'docs/_ops/보드/aaaa1111.md', 보드줄('**산 세션의 착수**', '🔵착수'));
    더럽힌다(repo, 'docs/_ops/보드/bbbb2222.md', 보드줄('**죽은 세션의 종결**', '✅종결'));
    // 커밋된 줄이어야 🧭(미커밋 선점 축)와 안 겹친다 — 두 축이 같은 줄을 집으면 처방이 둘이 된다.
    g('add', '-A'); g('commit', '-qm', '보드 선언들');
    세션기록(state, repo, 'local_eeeeeeee', [], 400, undefined, true);
    세션기록(state, repo, 'local_aaaa1111', [], 1);

    const out = 돌린다({ repo, state, 나: 'local_cccc3333' });
    assert.ok(out.includes('죽은 세션의 착수'), `죽은 주인의 착수 줄을 안 짚었다:\n${out}`);
    /* 산 세션의 착수는 **반대 축**이다(🧭 = 「남이 잡았으니 비켜라」) — 섞으면 처방이 뒤집힌다. */
    assert.ok(!out.includes('산 세션의 착수'), `살아있는 세션의 줄을 죽은 것으로 냈다:\n${out}`);
    /* ✅종결이 낡는 것은 F256 축이고 처방은 이관이다 — 여기 넣으면 매 세션 종결 줄이 전부 뜬다. */
    assert.ok(!out.includes('죽은 세션의 종결'), `종결 줄까지 짚어 이 절이 소음이 된다:\n${out}`);
  });

  /* ── ❔ 생사 모름 (F315 · 2026-08-10) ────────────────────────────────────────
   * 실사고: 심장박동은 **파일 접촉**으로 찍혀서, codex-review(12분)·CI 같은 긴 외부 프로세스를
   * 부른 세션은 멀쩡히 도는 중에도 박동이 식는다. `f542de4f` 를 그렇게 죽은 것으로 읽고 트랙을
   * 이어받아 같은 codex-review 를 두 번째로 태우기 시작했다 — 그쪽은 그 사이 P1 2건을 잡아
   * 앞서 있었으니 이어받았으면 지적받은 판을 라이브로 밀 뻔했다.
   *
   * 🔑 급소는 **마지막 assert** 다: 도장 없는 주인이 ⏹(죽음 단정) 절에 들어가면 그게 F315 그
   *   자체다. 「❔ 절이 떴다」만 검사하면 두 절에 동시에 실려도 초록이 된다. */
  test('박동이 식어도 도장이 없으면 ❔모름이다 — 죽음으로 단정하지 않는다 (F315)', { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state, g } = 픽스처();
    더럽힌다(repo, 'docs/_ops/보드/dddd4444.md', 보드줄('**도장 없는 주인의 착수**', '🔵착수'));
    더럽힌다(repo, 'docs/_ops/보드/eeeeeeee.md', 보드줄('**도장 찍힌 주인의 착수**', '🔵착수'));
    더럽힌다(repo, 'docs/_ops/보드/ffff5555.md', 보드줄('**기록조차 없는 주인의 착수**', '🔵착수'));
    g('add', '-A'); g('commit', '-qm', '보드 선언들');
    세션기록(state, repo, 'local_dddd4444', [], 400);                    // 박동 식음 · 도장 **없음**
    세션기록(state, repo, 'local_eeeeeeee', [], 400, undefined, true);   // 박동 식음 · 도장 있음
    // ffff5555 는 기록 자체를 안 만든다 — 「못 봤다」를 「죽었다」로 번역하는지 본다.

    const out = 돌린다({ repo, state, 나: 'local_cccc3333' });
    const 조각 = out.split('❔ **주인의 생사를 모르는');
    assert.strictEqual(조각.length, 2, `❔ 절이 안 떴다(또는 두 번 떴다):\n${out}`);
    const [죽음절, 모름절] = 조각;

    assert.ok(모름절.includes('도장 없는 주인의 착수'), `도장 없는 주인이 ❔ 절에 없다:\n${out}`);
    assert.ok(모름절.includes('기록조차 없는 주인의 착수'), `기록이 없는 주인을 ❔ 로 안 냈다 — 못 본 것과 죽은 것이 같아졌다:\n${out}`);
    assert.ok(죽음절.includes('도장 찍힌 주인의 착수'), `증명된 죽음이 ⏹ 절에서 사라졌다:\n${out}`);

    assert.ok(!모름절.includes('도장 찍힌 주인의 착수'), `증명된 죽음이 ❔ 절로 샜다 — 두 갈래의 처방이 정반대다:\n${out}`);
    assert.ok(!죽음절.includes('도장 없는 주인의 착수'),
      `도장 없는 주인을 ⏹(죽음)으로 단정했다 — 이게 F315 그 자체다(이어받기가 열린다):\n${out}`);
  });

/* ── F304 — 「승계 자리에서 원리상 잠긴 문」: 선언 주인 판정은 도장까지 본다 ──────────────
 *
 * 🔴 실사고 2026-08-12: board-guard 가 겹침을 막으며 내주는 처방은 「죽은 세션의 줄이면
 *   `board-move` 로 치운다」인데, board-move 원칙⑥ 은 `살았나`(심장박동 30분 창)를 썼다.
 *   인계는 앞 세션이 끊긴 «직후»에 일어나므로 승계 세션이 그 문을 두드리는 시각은
 *   **원리상 늘 창 안**이다 — 처방이 가리키는 문이 30분간 항상 잠겨 있었다(F103 축:
 *   따를 수 없는 처방은 우회를 정상 통로로 만든다).
 *   그날 실측: 도장이 찍혔는데 「살았다」로 세는 세션 **4건** · 그 줄들이 안 치워져 보드가
 *   상한 18 을 넘겨 20줄이 되었고 **새 세션의 선언 자체가 막혔다.**
 *
 * 여기서 재는 축은 하나다 — **죽음 쪽으로만 움직이는가.** 도장이 없으면 옛 판정 그대로여야
 * 한다. 그 방향이 뒤집히면 새는 곳이 「남의 «산» 줄을 아카이브로 옮김」이 되고, 그게 F146
 * 실사고다(여기서 새면 조용하다 — 옮겨진 세션은 다음 턴에 자기 트랙을 잃는다). */

test('🔴 방금 끊긴 세션은 심장박동이 뛰어도 **선언 주인이 아니다** (F304 — 승계 자리의 잠긴 문)', () => {
  const owner = require('../tools/작업본소유자.js');
  const 방금끊김 = { sid: 'local_f304aaaa', 분: 3, 끝남: Date.now() - 3 * 60000 };
  assert.ok(owner.살았나(방금끊김),
    '전제가 깨졌다 — 심장박동이 「살았다」로 나와야 이 회귀에 뜻이 있다(30분 창이 사라졌으면 이 테스트를 다시 짜라)');
  assert.ok(owner.마감했나(방금끊김), 'SessionEnd 죽음 도장(`끝남`)을 못 읽는다');
  assert.ok(!owner.선언살았나(방금끊김),
    '도장이 찍혔는데 선언 주인으로 센다 — board-move 가 30분간 그 줄을 거절하고 보드가 상한을 넘어 부푼다(F304)');
});

test('🔑 도장이 없으면 옛 판정 그대로다 — 「조용한 세션」을 죽음으로 올리지 않는다 (F252 방향 보존)', () => {
  const owner = require('../tools/작업본소유자.js');
  assert.ok(owner.선언살았나({ sid: 'local_f304bbbb', 분: 3, 끝남: null }),
    '도장 없는 세션을 죽었다고 했다 — 새는 방향이 「남의 산 줄을 옮김」으로 뒤집힌다(F146 실사고)');
  assert.ok(!owner.선언살았나({ sid: 'local_f304bbbb', 분: 999, 끝남: null }),
    '30분 창이 안 돈다 — 이 판정은 `살았나` 위에 얹히는 것이지 그것을 대체하지 않는다');
});

test('🔑 나 자신은 옛 도장이 남아 있어도 선언 주인이다 — 이 코드가 도는 것이 증거다 (F264 축)', () => {
  const 경로 = require.resolve('../tools/작업본소유자.js');
  const 옛 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_f304cccc-1111-2222-3333-444455556666';
  delete require.cache[경로];
  try {
    const owner = require(경로);
    const store = require('../.claude/hooks/lib/handoff-store.js');
    const 나 = { sid: store.safeId(process.env.CLAUDE_CODE_HOST_SESSION_ID), 분: 999, 끝남: Date.now() };
    assert.ok(owner.선언살았나(나),
      '내가 도는 중인데 내 줄을 남이 옮길 수 있게 열었다 — 옛 도장은 지금 이 프로세스보다 약한 증거다');
  } finally {
    if (옛 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 옛;
    delete require.cache[경로];   // 다음 테스트가 내 env 조작을 물려받지 않게 되돌린다
  }
});

/* ── 워크트리에 갇힌 커밋 (F403 · 2026-08-13 실사고) ─────────────────────────
 * 세션 `d546c7d7` 이 워크트리에서 유호님 신고 결함을 고치고 ✅완료 보드 줄까지 쓴 뒤,
 * 그 커밋을 master 에 못 올린 채 죽었다. 수리 163줄·회귀 245줄이 가지에만 남았다.
 * 🔑 미커밋 0 · 회귀 초록 · 보드는 완료 — **미완으로 보이는 자리가 한 곳도 없었다.**
 * 위 ☁ 절은 **원격** claude/* 만 봐서("로컬엔 없던 것이다") 여기가 그 사각의 반대편이었다.
 *
 * 탐지력은 아래 픽스처가 진다 — 실저장소는 세션마다 달라져 불안정 검사가 된다.
 */
/* ⚠ 이름을 `워크트리픽스처` 로 짓지 않는다 — 위 352줄에 이미 그 이름이 있고, 함수 선언은
 * 호이스팅돼 **뒤엣것이 이긴다.** 처음에 그렇게 지었다가 기존 검사 3건이 조용히 깨졌다:
 * 저쪽은 「미커밋이 있는 옆 트리」를 만들고 이쪽은 「커밋만 있는 옆 트리」를 만들어, 저쪽
 * 검사들이 내 픽스처를 받아 🌿 를 영영 못 봤다. 깨진 이유가 이름이라 진단이 오래 걸린다. */
function 갇힘픽스처({ 나이분 = 600, 반입 = false, 점유 = null, 머지 = null } = {}) {
  const { repo, state, g } = 픽스처();
  const 트리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-own-wt-'));
  임시들.push(트리);
  fs.rmSync(트리, { recursive: true, force: true });      // worktree add 는 빈 경로를 요구한다
  /* 충돌 갈래는 **두 쪽이 같은 파일을 다르게 고쳐야** 성립한다 — 씨앗을 먼저 심는다.
   * `머지:'evil'`(F583)도 같은 씨앗이 필요하다 — 손으로 해결할 자리가 있어야 evil merge 가 된다. */
  const 겹침 = 점유 === '충돌' || 머지 === 'evil';
  if (겹침) {
    fs.writeFileSync(path.join(repo, '겹치는파일.txt'), '원본\n');
    g('add', '-A'); g('commit', '-qm', '씨앗');
  }
  g('worktree', 'add', '-q', '--detach', 트리, 'HEAD');
  fs.writeFileSync(path.join(트리, '수리.js'), '// 유호님 신고 결함 수리\n');
  if (겹침) fs.writeFileSync(path.join(트리, '겹치는파일.txt'), '가지 쪽 수정\n');
  /* 커밋 **시각**으로 나이를 심는다 — 도구도 같은 것을 잰다(폴더 mtime 은 체크아웃·청소로도
   * 움직여 「언제 멈췄나」를 안 말한다). 안 심으면 「방금 커밋」이라 갇힘여유에 그대로 걸러진다. */
  const 때 = new Date(Date.now() - 나이분 * 60000).toISOString();
  const wg = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t',
    '-c', 'commit.gpgsign=false', ...a],
  { cwd: 트리, encoding: 'utf8', env: { ...process.env, GIT_COMMITTER_DATE: 때, GIT_AUTHOR_DATE: 때 } });
  wg('add', '-A');
  wg('commit', '-qm', '수리 — 워크트리에서 완주');
  if (반입) {                                              // master 가 그 커밋을 이미 담은 상태
    g('merge', '-q', '--ff-only', String(wg('rev-parse', 'HEAD').stdout || '').trim());
  }
  /* 🫧 F583 — **머지 노드만 남은 트리**(reconcile 류). 실사고 `6df8320b` 의 그 모양을 그대로 짓는다:
   *   ① 트리가 제 커밋을 하나 쌓고 ② master 는 따로 나아가고(→ ff 가 아니라 진짜 머지 노드가 된다)
   *   ③ 트리가 master 를 되받아 «화해만» 하고 멈추고 ④ 그 사이 트리의 커밋은 master 에도 담긴다.
   *   결과: `master..HEAD` 에 커밋 1개(머지 노드)뿐이고 `--no-merges` 는 0이다.
   * 🔴 `evil` 갈래는 **새는 방향**을 잰다 — 손으로 제3의 값을 골라 해결하면 그 줄은 어느 부모에도
   *   없으므로 `--cc` 가 비지 않는다. 그건 「볼 것 없음」이 아니라 유실 후보다. */
  if (머지) {
    const 트리커밋 = String(wg('rev-parse', 'HEAD').stdout || '').trim();
    if (머지 === 'evil') fs.writeFileSync(path.join(repo, '겹치는파일.txt'), 'master 쪽 수정\n');
    else fs.writeFileSync(path.join(repo, 'master쪽.txt'), 'master 쪽 진행\n');
    g('add', '-A'); g('commit', '-qm', 'master 쪽 진행');
    wg('merge', '--no-edit', 'master');                    // evil 갈래에선 실패해야 정상(UU 로 멈춘다)
    if (머지 === 'evil') {
      fs.writeFileSync(path.join(트리, '겹치는파일.txt'), '손으로 고른 제3의 값\n');
      wg('add', '-A');
      wg('commit', '-qm', '머지 — 손으로 해결한 자리가 있다');
    }
    /* master 가 트리의 커밋을 담는다 → 이제 머지 노드의 **두 부모가 전부 master 안**이다.
     * `-X ours` 는 evil 갈래의 재충돌을 사람 손 없이 넘기려는 것뿐이다(master 쪽 값은 무관). */
    g('merge', '--no-edit', '-q', '-X', 'ours', 트리커밋);
  }
  /* 🔑 F553 — 점유는 **진짜로 만든다.** 손으로 `UU` 글자를 심으면 사람이 실제로 만나는 상태를
   *   한 번도 안 재게 된다(가드 맹점 ①). 아래는 git 이 스스로 낸 충돌이고, 나이는 그 사이에도
   *   **늘기만 한다** — 실사고의 그 모양이다(붙어 있는 세션이 가장 오래 버려져 보인다). */
  if (점유 === '충돌') {
    fs.writeFileSync(path.join(repo, '겹치는파일.txt'), 'master 쪽 수정\n');
    g('add', '-A'); g('commit', '-qm', 'master 쪽 변경');
    /* `--no-edit` 은 **충돌이 안 났을 때의 보험**이다 — 그때 git 은 머지 커밋 메시지 에디터를
     * 열고, spawnSync 는 그 자리에서 영영 멈춘다(검사가 죽는 게 아니라 매달린다). */
    wg('merge', '--no-edit', 'master');                    // 실패해야 정상 — UU 로 멈춘다
  } else if (점유 === '미커밋') {
    fs.writeFileSync(path.join(트리, '아직_안_커밋.js'), '// 손이 붙어 있다\n');
  } else if (점유 === '못잼') {
    /* 워크트리의 `.git` 은 **파일**이다(디렉터리가 아니다 — 메인 저장소의 gitdir 을 가리키는 한 줄).
     * 지우면 `git -C <경로> status` 가 실패하지만 `git worktree list` 에는 그대로 남는다:
     * 「목록엔 있는데 못 재는」 그 상태가 여기서 재려는 것이다. */
    fs.rmSync(path.join(트리, '.git'), { force: true });
  }
  return { repo, state, 트리 };
}

test('🔑 탐지 — 워크트리에 master 미포함 커밋이 갇히면 잡는다 (F403 실사고 그 모양)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state } = 갇힘픽스처();
    const out = 돌린다({ repo, state, 나: 'local_f399aaaa' });
    assert.match(out, /🧊[\s\S]*워크트리에 갇힌 커밋 1건/,
      '갇힌 커밋을 못 잡았다 — 이걸 놓치면 완주한 트랙이 통째로 사라진다');
    assert.match(out, /수리 — 워크트리에서 완주/,
      '무엇이 갇혔는지(커밋 제목)를 안 보여줬다 — 개수만으로는 아무도 안 움직인다');
    assert.match(out, /worktree remove/,
      '닫는 길을 안 줬다 — 따를 수 없는 처방은 방치를 정상으로 만든다(F103)');
    assert.match(out, /커밋 수는 판정이 아니다/,
      '「미포함 = 유실」로 단정했다 — 같은 날 실측 3건 중 2건은 낡은 사본이었다(master 가 오히려 앞섰다)');
  });

test('거짓양성 — master 가 이미 담은 워크트리는 안 잡는다 (반입하면 스스로 조용해져야 한다)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state } = 갇힘픽스처({ 반입: true });
    assert.doesNotMatch(돌린다({ repo, state, 나: 'local_f399bbbb' }), /🧊/,
      '반입이 끝났는데도 계속 짚는다 — 무시해야만 사라지는 경고는 그 순간부터 아무도 안 읽는다');
  });

test('🔑 거짓양성 — 방금 커밋한 워크트리는 안 잡는다 (살아있는 에이전트를 매번 짚으면 배경 소음이 된다)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state } = 갇힘픽스처({ 나이분: 1 });
    assert.doesNotMatch(돌린다({ repo, state, 나: 'local_f399cccc' }), /🧊/,
      '일하는 중인 워크트리를 갇혔다고 했다 — 에이전트가 돌 때마다 뜨면 진짜가 섞여도 안 읽힌다');
  });

test('🔴 모름을 0건으로 바꾸지 않는다 — master 가 없으면 「못 쟀다」라고 말한다',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state, g } = 픽스처();
    g('branch', '-m', 'master', '옛가지');                 // master 라는 이름이 없는 저장소
    assert.match(돌린다({ repo, state, 나: 'local_f399dddd' }), /갇힌 커밋을 \*\*못 쟀다\*\*/,
      '못 잰 것을 0건으로 접었다 — 이 도구의 최우선 불변식은 「모름을 안전으로 바꾸지 않는다」다');
  });

test('🔑 침묵 계약 — 갇힘 0이면 --hook 은 이 절을 한 줄도 안 낸다',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state } = 갇힘픽스처({ 반입: true });
    assert.doesNotMatch(돌린다({ repo, state, 나: 'local_f399eeee', 인자: ['--hook'] }), /🧊|갇힌 커밋/,
      '깨끗한데 세션 시작에 줄을 얹었다 — 경량 원칙(유호 08-13)과 정면으로 어긋난다');
  });

/* ── 🧑 손이 붙어 있는 트리 (F553 · 2026-08-17 실사고) ────────────────────────
 * 세션 `7f3c49db` 이 「329분째 멈춤」을 주인 사망으로 읽고 남의 PR 을 닫았다. 주인은 살아서
 * 머지 충돌을 풀고 있었다 — **커밋을 안 하는 동안** 살아 있었으므로 나이가 되레 늘었다.
 * 🔑 이 절이 지키는 것: 나이가 아무리 커도, 작업본에 손자국이 있으면 처분 처방을 **안 낸다.**
 */
/* ⏱ 점유는 그 트리에서 `git status` 를 한 번 부르는데, 기본 예산이 5초다. 옆 검사들과 함께
 *   돌면(전체 스위트 116건) 그 5초를 부하로 넘겨 **「못 쟀다」로 떨어진다** — 그러면 「충돌 N건」
 *   문구가 안 나가 이 검사가 빨개진다. 실측: 단독 2.4초 → 전체 스위트 4.9초.
 *   🔴 이건 «부하»를 재는 것이지 이 검사가 재려는 것이 아니다(F296·F489 · 위 `돌린다` 의 fetch
 *   예산이 같은 이유로 이미 늘어나 있다). 실사용 기본값 5초는 그대로다. */
const 점유예산 = { SYNK_OWNER_GIT_TIMEOUT_MS: '60000' };

test('🔑 탐지 — 충돌로 멈춘 트리는 🧑 로 내고 `worktree remove` 를 **안** 준다 (F553)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state } = 갇힘픽스처({ 점유: '충돌' });
    const out = 돌린다({ repo, state, 나: 'local_f553aaaa', 환경: 점유예산 });
    assert.match(out, /🧑[\s\S]*손이 붙어 있는 작업 트리 1건/,
      '충돌로 멈춘 트리를 못 갈랐다 — 그 처방을 그대로 따르면 남의 작업이 사라진다');
    assert.match(out, /충돌 \d+건 미해결/,
      '무엇 때문에 붙어 있는지를 안 보여줬다 — 「손대지 마라」만으로는 다음 판단을 못 한다');
    assert.doesNotMatch(out, /worktree remove/,
      '🔴 사람이 붙어 있는 트리에 지우라고 했다 — F553 이 신고한 사고 그 자체다');
    assert.match(out, /나이는 주인 생사를 안 말한다/,
      '왜 나이를 못 믿는지를 안 적었다 — 근거 없는 금지는 다음 세션이 그냥 뛰어넘는다');
  });

test('탐지 — 충돌이 없어도 미커밋이 있으면 붙어 있는 자리로 낸다 (F553 · 손자국은 하나면 족하다)',
  { skip: !git있나 && 'git 없음' }, () => {
    const out = 돌린다({ ...갇힘픽스처({ 점유: '미커밋' }), 나: 'local_f553bbbb', 환경: 점유예산 });
    assert.match(out, /🧑[\s\S]*손이 붙어 있는 작업 트리 1건/,
      '미커밋을 남긴 트리를 처분 대상으로 냈다 — 미추적은 git 이력에 없는 유일한 무보호 상태다(F025)');
    assert.doesNotMatch(out, /worktree remove/, '지우라고 했다 — 그 파일은 어디에도 안 남는다');
  });

test('🔴 F553 — 작업본을 **못 쟀으면** 깨끗한 쪽으로 안 기운다 (모름을 안전으로 바꾸지 않는다)',
  { skip: !git있나 && 'git 없음' }, () => {
    const out = 돌린다({ ...갇힘픽스처({ 점유: '못잼' }), 나: 'local_f553dddd' });
    assert.match(out, /🧑[\s\S]*손이 붙어 있는 작업 트리 1건/,
      '🔴 못 잰 것을 「깨끗하다」로 접었다 — 이 도구의 최우선 불변식이 뒤집혔다(처분 처방이 그대로 나간다)');
    assert.match(out, /작업본 \*\*못 쟀다\*\*/,
      '못 쟀다는 사실을 안 적었다 — 「미커밋 0」과 「안 재봤다」가 같은 모양이 된다(F207)');
    assert.doesNotMatch(out, /worktree remove/,
      '못 재놓고 지우라고 했다 — 되돌림 비용이 가장 큰 방향으로 기운 것이다');
  });

test('🔑 거짓양성 — 작업본이 깨끗한 갇힘은 **여전히** 🧊 로 나가고 처분 처방을 받는다 (F403 무력화 금지)',
  { skip: !git있나 && 'git 없음' }, () => {
    const out = 돌린다({ ...갇힘픽스처(), 나: 'local_f553cccc', 환경: 점유예산 });
    assert.match(out, /🧊[\s\S]*워크트리에 갇힌 커밋 1건/,
      '🔴 F553 수리가 F403 을 통째로 껐다 — 완주한 트랙이 사라지는 그 사각이 되돌아온다');
    assert.match(out, /worktree remove/, '닫는 길을 뺏었다 — 스스로 조용해질 수 없는 경고가 된다');
    assert.doesNotMatch(out, /🧑/, '깨끗한 트리를 「손이 붙어 있다」고 했다 — 반대 방향으로 새는 문장이다');
  });

/* ── 🫧 볼 것이 없는 트리 (F583 · 2026-08-17) ─────────────────────────────────
 * 시작 훅이 세션 `90a98dcc` 에게 낸 제 경보를 재서 발굴했다. 대상 `6df8320b` 실측:
 *   `rev-list --count master..HEAD` = 1 · `--no-merges` = **0** · `diff-tree --cc` = **빈 출력**
 * ⇒ 새로 쓴 줄이 한 줄도 없는데 화면은 F403 실사고(수리 163줄·회귀 245줄 유실)와 같은 문구였다.
 * 🔑 이 절이 지키는 것은 **두 방향이다**: ①잃을 것 0 인 트리에 유실 경보를 안 낸다(소음)
 *   ②그 완화가 **한 줄이라도 새로 쓴 트리**로 새지 않는다(유실). ②가 없으면 이 수리가 F403 을 끈다.
 */
test('🔑 탐지 — 머지 노드만 남은 트리는 🫧 로 내고 🧊 최고 경보를 안 낸다 (F583)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state } = 갇힘픽스처({ 머지: 'trivial' });
    const out = 돌린다({ repo, state, 나: 'local_f583aaaa', 환경: 점유예산 });
    assert.match(out, /🫧[\s\S]*볼 것이 없는 작업 트리 1건/,
      '머지 노드뿐인 트리를 못 갈랐다 — DAG 로 결정되는 자리를 안 재면 이 경보는 영영 안 조용해진다');
    assert.doesNotMatch(out, /완주한 트랙이 여기서 사라진다/,
      '🔴 잃을 것이 0인 트리에 유실 경보를 냈다 — 그 문구가 진짜 유실에서도 안 읽히게 된다(F583 그 자체)');
    assert.match(out, /worktree remove/,
      '닫는 길을 안 줬다 — 조용해졌는데 치울 수 없으면 그 트리는 영영 목록에 남는다');
    assert.match(out, /고른 조합/,
      '대가를 안 적었다 — 안 잰 것이 있는데 「볼 것 없음」만 말하면 그 단정이 다음 오독의 씨앗이 된다');
  });

test('🔴 새는 방향 — 손으로 해결한 머지(evil)는 🫧 로 안 내린다 (`--cc` 가 비지 않는다)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state } = 갇힘픽스처({ 머지: 'evil' });
    const out = 돌린다({ repo, state, 나: 'local_f583bbbb', 환경: 점유예산 });
    assert.match(out, /🧊[\s\S]*워크트리에 갇힌 커밋 1건/,
      '🔴 손으로 고른 값이 든 머지를 「볼 것 없음」으로 접었다 — 그 줄은 어느 부모에도 없다(유실)');
    assert.doesNotMatch(out, /🫧/,
      '🔴 evil merge 가 조용한 칸으로 샜다 — 이 수리가 F403 을 끈 것이다');
  });

test('🔑 F403 무력화 금지 — 진짜 내용 커밋이 있으면 🫧 가 아니라 🧊 다',
  { skip: !git있나 && 'git 없음' }, () => {
    const out = 돌린다({ ...갇힘픽스처(), 나: 'local_f583cccc', 환경: 점유예산 });
    assert.match(out, /🧊[\s\S]*워크트리에 갇힌 커밋 1건/, '완주한 트랙이 조용한 칸으로 내려갔다');
    assert.doesNotMatch(out, /🫧/, '내용 커밋이 있는데 「볼 것 없음」이라 했다 — 반대 방향으로 새는 문장이다');
  });

test('🔑 침묵 계약 — 볼 것 없는 트리 **하나만** 있으면 --hook 은 세션을 안 깨운다 (F583)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state } = 갇힘픽스처({ 머지: 'trivial' });
    assert.strictEqual(돌린다({ repo, state, 나: 'local_f583dddd', 인자: ['--hook'], 환경: 점유예산 }), '',
      '잃을 것이 0인 트리 하나 때문에 매 세션을 깨웠다 — 그 소음이 옆의 진짜 유실까지 안 읽히게 만든다');
  });

test('🔴 세 칸 — 「못 쟀다」는 「볼 것 없음」이 아니다 (F207 · 이 칸이 새면 유실 방향이다)', () => {
  const { 내용없나 } = require(TOOL);
  /* 못 쟀는데 값이 0으로 «보이는» 모양 — `rev-list` 를 그 트리에만 실패시킬 손잡이가 없어
   * 픽스처로는 못 만든다. 순수 함수라 값으로 직접 잰다. */
  assert.strictEqual(내용없나({ 고유: { 잼: false, 내용커밋: 0, 손해결: 0 } }), false,
    '🔴 못 잰 것을 「볼 것 없음」으로 접었다 — 시끄러운 쪽에 남겨야 유실이 안 샌다');
  assert.strictEqual(내용없나({}), false, '고유 자체가 없는데 조용한 칸으로 내렸다');
  assert.strictEqual(내용없나({ 고유: { 잼: true, 내용커밋: 1, 손해결: null } }), false,
    '내용 커밋이 있는데 「볼 것 없음」이라 했다 — F403 이 그대로 꺼진다');
  assert.strictEqual(내용없나({ 고유: { 잼: true, 내용커밋: 0, 손해결: 2 } }), false,
    '손으로 해결한 머지가 있는데 접었다 — 그 줄은 어느 부모에도 없다');
  assert.strictEqual(내용없나({ 고유: { 잼: true, 내용커밋: 0, 손해결: 0 } }), true,
    '셋을 다 재고 0인데도 시끄러운 칸에 뒀다 — 그러면 이 수리가 아무것도 안 한 것이다');
});

test('🔴 손이 붙어 있으면 내용이 0이어도 🫧 가 아니다 — 점유 판정이 먼저다 (F553 ↔ F583 순서)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state, 트리 } = 갇힘픽스처({ 머지: 'trivial' });
    fs.writeFileSync(path.join(트리, '아직_안_커밋.js'), '// 손이 붙어 있다\n');
    const out = 돌린다({ repo, state, 나: 'local_f583eeee', 환경: 점유예산 });
    assert.match(out, /🧑[\s\S]*손이 붙어 있는 작업 트리 1건/,
      '🔴 내용이 0이라는 이유로 사람이 붙어 있는 트리를 처분 칸에 넣었다 — F553 실사고 그 자체다');
    assert.doesNotMatch(out, /worktree remove/, '지우라고 했다 — 그 미커밋은 어디에도 안 남는다(F025)');
  });

/* ── 🔗 형제 저장소의 «배포빚» (대기열 #Q87 · 2026-08-15) ──────────────────────
 *
 * 왜: 이 도구의 🚀 절은 `claspProjects()`(이 저장소의 Apps Script 판)만 돌아, 형제의 Supabase
 *   함수는 **한 건도 안 센다.** 그래서 talk 을 안 건드리는 세션에게 그쪽 배포빚은 어느 화면에도
 *   안 떴다 — 실측 08-15: 리허설 낡음 5 · 운영 낡음 4 가 며칠째 서 있었고 `deliver` 는 그 상태로
 *   매일 두 번 cron 에 불렸다.
 *
 * 탐지력은 **전부 픽스처**가 진다 — 실저장소 빚은 세션마다 바뀌고, 갚아 버리면 이 검사들이
 *   조용히 0건이 된다(맹점 ② · 「버그가 아직 있을 것을 요구하는 회귀」 금지).
 * 판정은 형제 소유라 여기서 **다시 계산하지 않는다** — 아래 스텁은 그 통로의 계약(`--json` 한 줄)만
 *   흉내 낸다. 계약이 갈리면 talk 쪽 `tests/배포빚.test.js ⑥` 이 빨개진다. */
const 빚JSON = (판) => `process.stdout.write(${JSON.stringify(JSON.stringify({ 도구: '배포빚', 판, head: 'abc', 장부깨진: 0 }))});\n`;
/** 스텁 도구를 형제에 세우고 **커밋까지 한다.**
 *  🔴 커밋을 빼면 그 파일이 형제의 미커밋으로 잡혀 🔗 절이 대신 입을 열고, 그러면 「빚 때문에
 *     말했나」를 이 검사가 원리적으로 못 가른다 — 변이 실측 08-15: 발화 조건에서 `형제빚낡음` 을
 *     빼도 검사가 **그대로 초록**이었다(다른 이유로 초록인 회귀 · 맹점 ④). */
function 빚도구세운다(형제, 본문) {
  더럽힌다(형제.repo, 'tools/배포빚.js', 본문);
  형제.g('add', '-A'); 형제.g('commit', '-qm', '배포빚 스텁');
}

test('🔗 형제 배포빚 — 낡음이 있으면 세션 시작에서 말한다 (여기가 「안 보이던」 자리다)',
  { skip: !git있나 && 'git 없음' }, () => {
    const { repo, state } = 픽스처();
    const 형제 = 픽스처();
    빚도구세운다(형제, 빚JSON({
      리허설: { 전체: 16, 낡음: ['auth', 'deliver'], 최신: 13, 모름: ['radio-round'] },
      운영: { 전체: 16, 낡음: [], 최신: 14, 모름: ['companion', 'radio-round'] },
    }));
    const out = 돌린다({ repo, state, 나: 'local_q87a0001', 형제: [형제.repo], 인자: ['--hook'] });
    assert.match(out, /형제 저장소의 배포본이 소스보다 낡았다/,
      `형제 배포빚을 통째로 놓쳤다 — 이 저장소의 🚀 는 clasp 판만 봐서 원리적으로 못 보는 축이다:\n${out}`);
    assert.match(out, /auth · deliver/, `무엇이 낡았는지 이름을 안 댔다 — 개수만으로는 아무도 안 움직인다:\n${out}`);
    assert.match(out, /낡음 2 \+ 최신 13 \+ 모름 1/,
      `분모를 갈래 합으로 안 냈다 — 좋은 0과 「안 재봤다」가 같은 모양이 된다(유호 확정 08-14):\n${out}`);
    assert.match(out, /모름은 최신이 아니다/, `모름을 최신 쪽으로 읽히게 뒀다:\n${out}`);
  });

test('🔑 침묵 계약 — 낡음 0이면 --hook 은 한 줄도 안 얹는다 (모름만으로는 안 운다)',
  { skip: !git있나 && 'git 없음' }, () => {
    /* 🔴 이 계약이 없으면 새 함수 하나가 도장 전이라는 이유로 매 세션 울고(실측 `radio-round`),
     *   그 순간부터 이 절 전체가 안 읽힌다. 모름은 접는 게 아니라 **손 호출에서** 분모로 낸다. */
    const { repo, state } = 픽스처();
    const 형제 = 픽스처();
    빚도구세운다(형제, 빚JSON({ 운영: { 전체: 3, 낡음: [], 최신: 2, 모름: ['radio-round'] } }));
    const out = 돌린다({ repo, state, 나: 'local_q87b0002', 형제: [형제.repo], 인자: ['--hook'] });
    assert.doesNotMatch(out, /배포본이 소스보다 낡았다/,
      `빚이 0인데 세션 시작에 줄을 얹었다 — 경량 원칙(유호 08-13)과 정면으로 어긋난다:\n${out}`);
    const 손 = 돌린다({ repo, state, 나: 'local_q87b0002', 형제: [형제.repo] });
    assert.match(손, /낡음 0 \+ 최신 2 \+ 모름 1/,
      `손 호출에서도 분모를 감췄다 — 남은 것만 보이면 「이게 전부」로 읽힌다:\n${손}`);
  });

test('⚠ 도구는 있는데 못 읽으면 「빚 0」이 아니라 판정 불가다 (옛 체크아웃은 사람글을 낸다)',
  { skip: !git있나 && 'git 없음' }, () => {
    /* `--json` 을 모르는 옛 형제는 **성공(exit 0)** 으로 사람글을 낸다 — 모양을 안 보면
     *   그게 조용히 「빚 없음」이 된다. 새는 방향은 언제나 「통과」다. */
    const { repo, state } = 픽스처();
    const 형제 = 픽스처();
    빚도구세운다(형제,
      "process.stdout.write('[배포빚] 운영 — 전체 16 = 낡음 4 + 최신 10 + 모름 2\\n');\n");
    const out = 돌린다({ repo, state, 나: 'local_q87c0003', 형제: [형제.repo], 인자: ['--hook'] });
    assert.match(out, /배포빚을 \*\*못 쟀다\*\*/,
      `사람글을 받고 조용히 넘어갔다 — 못 읽은 것과 빚 0건이 같은 모양이 됐다:\n${out}`);
  });

test('⚠ 모양이 다른 JSON 도 판정 불가다 — 파싱은 통과하고 «낡음 0» 으로 조용해지는 자리',
  { skip: !git있나 && 'git 없음' }, () => {
    /* 🔴 이 검사가 없으면 모양 검사는 **탐지력 0인 채로** 선다 — 변이 실측 08-15: 그 줄을 지워도
     *   바로 위 「사람글」 검사는 그대로 초록이었다(사람글은 `JSON.parse` 가 먼저 던져 여기 안 닿는다).
     *   계약이 바뀐 형제·다른 도구가 이 자리로 들어오면 새는 방향은 언제나 「빚 없음」이다. */
    const { repo, state } = 픽스처();
    const 형제 = 픽스처();
    빚도구세운다(형제,
      "process.stdout.write(JSON.stringify({ 도구: '배포빚', 요약: '낡음 4' }));\n");
    const out = 돌린다({ repo, state, 나: 'local_q87e0005', 형제: [형제.repo], 인자: ['--hook'] });
    assert.match(out, /배포빚을 \*\*못 쟀다\*\*/,
      `모양이 다른 JSON 을 받고 조용히 넘어갔다 — 계약이 갈린 형제가 「빚 0」으로 읽힌다:\n${out}`);
  });

test('🔑 거짓양성 — 형제에 그 도구가 없으면 «해당 없음» 이다 (모름으로 세면 CI 가 영구 경보다)',
  { skip: !git있나 && 'git 없음' }, () => {
    /* F296·F103: 형제 없는 클론·CI 에서 매 세션 「못 쟀다」가 뜨면 따를 수 없는 경보가 되고,
     *   따를 수 없는 경보는 그 통로를 통째로 끈다. 없는 빚은 «모름» 이 아니다. */
    const { repo, state } = 픽스처();
    const 형제 = 픽스처();
    더럽힌다(형제.repo, 'lib/무관.js', 'x\n');           // 형제는 살아 있되 배포빚 도구가 없다
    const out = 돌린다({ repo, state, 나: 'local_q87d0004', 형제: [형제.repo] });
    assert.doesNotMatch(out, /배포빚을 \*\*못 쟀다\*\*|배포본이 소스보다 낡았다/,
      `없는 도구를 「못 쟀다」로 세웠다 — 형제 없는 사본에서 영구 경보가 된다:\n${out}`);
  });
