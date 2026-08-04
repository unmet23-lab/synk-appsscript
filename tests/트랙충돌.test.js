/* track-collision 회귀 — 남의 커밋이 내 세션 도중 내 자리에 착지하는 것을 잡는가.
 *
 * 왜 있나 (F070 · 2026-08-04, 하루 두 번째): 같은 트랙이 두 세션에서 병렬로 돌아 같은 가드를
 *   따로 구현했다. 근본 원인은 규약 위반이 아니라 **규약을 다 지켜도 안 보이는 자리**다 —
 *   시작 시 `git log` 는 스냅샷이고, 상대 커밋은 그 25분 뒤에 착지했다.
 *
 * 검사 방식 — **픽스처 저장소** 위에서 돈다(SYNK_TRACK_ROOT 이음매).
 *   실저장소에 커밋을 만들면 탐지력을 재는 대가로 이력을 오염시킨다. 그리고 실저장소의
 *   커밋 이력은 세션마다 달라져 불안정 테스트가 된다(CLAUDE.md — 탐지는 픽스처가 진다).
 *
 * 🔴 이 훅의 최우선 불변식은 「막지 않는다」다. Edit 매처엔 board-guard·memory-index-guard·
 *   doc-propagation 이 함께 걸려 있어, 여기서 permissionDecision 을 내면 그것들의 판정을
 *   덮을 위험이 있다. 그래서 **모든 경로에서** permissionDecision 부재를 검사한다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const HOOK = process.env.SYNK_TEST_TRACK_HOOK
  || path.resolve(__dirname, '..', '.claude', 'hooks', 'track-collision.js');

const 있나 = (() => {
  const r = spawnSync('git', ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
})();

let 임시들 = [];
function 픽스처저장소() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-track-'));
  임시들.push(dir);
  // ⚠ user.name/email 을 명령마다 준다 — CI 는 HOME 이 비어 전역 설정이 없다(F: repo 밖 환경 의존).
  gitIn(dir, ['init', '-q']);
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  return dir;
}
function gitIn(dir, args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
    cwd: dir, encoding: 'utf8',
  });
  return r;
}
/** 파일을 쓰고 커밋한다. sid 를 주면 Session-Id 트레일러를 박는다(주면 그 세션 것이 된다). */
function 커밋(dir, 파일, 내용, 제목, sid) {
  const p = path.join(dir, 파일);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 내용);
  gitIn(dir, ['add', '--', 파일]);
  const msg = sid ? `${제목}\n\nSession-Id: ${sid}` : 제목;
  const r = gitIn(dir, ['commit', '-q', '-F', '-', '--', 파일]);
  if (r.status !== 0) {
    // -F - 는 stdin 이 필요하다. spawnSync 로 다시.
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-F', '-', '--', 파일],
      { cwd: dir, encoding: 'utf8', input: msg });
  }
  return (gitIn(dir, ['rev-parse', 'HEAD']).stdout || '').trim();
}

/** 훅 호출. 세션마다 state 디렉터리를 갈라 서로 간섭하지 않게 한다. */
function 훅(dir, { file, sid = 'sess-A', stateDir, tool = 'Edit' } = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: tool, tool_input: { file_path: file ? path.join(dir, file) : undefined } }),
    encoding: 'utf8',
    env: {
      ...process.env,
      SYNK_TRACK_ROOT: dir,
      SYNK_CTXBUDGET_DIR: stateDir,
      CLAUDE_CODE_HOST_SESSION_ID: sid,
    },
  });
  const out = (r.stdout || '').trim();
  if (!out) return { 조용: true, 본문: '', 판정: undefined, exit: r.status };
  const j = JSON.parse(out);
  return {
    조용: false,
    본문: String(j.hookSpecificOutput?.additionalContext || ''),
    요약: String(j.systemMessage || ''),
    판정: j.hookSpecificOutput?.permissionDecision,
    exit: r.status,
  };
}

function 상태폴더() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-track-state-'));
  임시들.push(d);
  return d;
}

test.after(() => {
  for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 진행 */ } }
});

test('훅 파일이 있고, 무관한 도구에는 반응하지 않는다', () => {
  assert.ok(fs.existsSync(HOOK), 'track-collision.js 가 없다');
  const dir = 있나 ? 픽스처저장소() : os.tmpdir();
  assert.equal(훅(dir, { tool: 'Bash', stateDir: 상태폴더() }).조용, true, 'Edit 계열이 아닌 도구에 반응했다');
});

test('첫 호출은 조용하다 — 기준점을 잡을 뿐 비교 대상이 없다', (t) => {
  if (!있나) return t.skip('git 없음 — 픽스처를 못 만든다');
  const dir = 픽스처저장소();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
  assert.equal(훅(dir, { file: 'Code.js', stateDir: 상태폴더() }).조용, true,
    '기준점도 없는데 경고했다 — 세션 시작마다 잔소리가 된다');
});

test('🔴 내가 만진 파일에 남의 커밋이 착지하면 알린다 (F070 그대로)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');

  훅(dir, { file: 'Code.js', stateDir: st });              // ① 기준점 + 내가 Code.js 를 만졌다
  커밋(dir, 'Code.js', 'b', 'fix: 남이 같은 파일을 고쳤다', 'sess-B'); // ② 남의 커밋 착지
  const r = 훅(dir, { file: 'Code.js', stateDir: st });    // ③ 다시 만지려는 순간

  assert.equal(r.조용, false, '남의 커밋이 내가 만진 파일에 착지했는데 조용했다 — 이게 F070 이다');
  assert.match(r.본문, /Code\.js/, '어느 파일이 겹쳤는지를 안 알려준다');
  assert.match(r.본문, /남이 같은 파일을 고쳤다/, '무슨 커밋인지를 안 알려준다 — 읽으러 갈 수가 없다');
  assert.match(r.본문, /git show/, '다음 행동(그 커밋을 먼저 읽는다)을 안 알려준다');
});

test('🔴 어떤 경우에도 permissionDecision 을 내지 않는다 (같은 매처의 다른 가드를 덮으면 안 된다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
  훅(dir, { file: 'Code.js', stateDir: st });
  커밋(dir, 'Code.js', 'b', 'fix: 충돌', 'sess-B');
  const r = 훅(dir, { file: 'Code.js', stateDir: st });
  assert.equal(r.조용, false, '전제가 깨졌다 — 경고가 안 났으면 이 검사가 무의미하다');
  assert.strictEqual(r.판정, undefined,
    'permissionDecision 을 냈다 — board-guard·memory-index-guard 의 판정을 덮을 수 있다');
  assert.strictEqual(r.exit, 0, '0이 아닌 종료코드는 작업을 세운다');
});

test('내 커밋은 알리지 않는다 (Session-Id 가 나와 같다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-A');
  훅(dir, { file: 'Code.js', sid: 'sess-A', stateDir: st });
  커밋(dir, 'Code.js', 'b', 'feat: 내가 한 커밋', 'sess-A');
  assert.equal(훅(dir, { file: 'Code.js', sid: 'sess-A', stateDir: st }).조용, true,
    '내 커밋에 나를 경고했다 — 매 커밋마다 울리면 아무도 안 읽는다');
});

test('트레일러가 없는 커밋은 「주인 미상」으로 알린다 (아는 척하지 않는다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-A');
  훅(dir, { file: 'Code.js', sid: 'sess-A', stateDir: st });
  커밋(dir, 'Code.js', 'b', 'chore: 손커밋', null);
  const r = 훅(dir, { file: 'Code.js', sid: 'sess-A', stateDir: st });
  assert.equal(r.조용, false, '주인을 모르면 그냥 넘겼다 — 미탐 방향이다(유호님 손커밋도 여기 온다)');
  assert.match(r.본문, /주인 미상/, '모른다고 말하지 않고 아는 척했다');
});

test('같은 커밋을 두 번 알리지 않는다 (잔소리하는 장치는 안 읽힌다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
  훅(dir, { file: 'Code.js', stateDir: st });
  커밋(dir, 'Code.js', 'b', 'fix: 한 번만 알려야 한다', 'sess-B');
  assert.equal(훅(dir, { file: 'Code.js', stateDir: st }).조용, false, '첫 알림이 안 났다');
  assert.equal(훅(dir, { file: 'Code.js', stateDir: st }).조용, true, '같은 커밋을 두 번 알렸다');
});

test('HEAD 가 계속 움직여도 이미 알린 커밋은 다시 안 알린다', (t) => {
  if (!있나) return t.skip('git 없음');
  /* 변이 실험이 드러낸 빈틈이다 — 중복 억제(`알린것`)를 통째로 없애도 전부 초록이었다.
   * 위 dedupe 검사는 HEAD 가 안 움직여 **조기 종료 경로**로 통과하고 있어서, 진짜 억제 로직이
   * 한 번도 안 돌았다. 실제 상황은 커밋이 계속 떨어지는 쪽이다(세션 셋이 동시에 민다). */
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
  훅(dir, { file: 'Code.js', stateDir: st });

  커밋(dir, 'Code.js', 'b', 'fix: 이건 한 번만 알려야 한다', 'sess-B');
  assert.equal(훅(dir, { file: 'Code.js', stateDir: st }).조용, false, '첫 알림이 안 났다');

  // HEAD 가 움직인다. 새 커밋은 나와 무관하다 → 조기 종료 경로가 열리지 않는다.
  커밋(dir, 'docs/무관.md', 'x', 'docs: 무관한 트랙', 'sess-B');
  const r = 훅(dir, { file: 'Code.js', stateDir: st });
  assert.equal(r.조용, true,
    `HEAD 가 움직였다고 옛 커밋을 다시 알렸다 — 매 커밋마다 같은 경고가 쌓인다: ${r.요약}`);
});

test('보드에 선언만 하고 아직 안 만진 파일도 내 자리다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const st = 상태폴더();
  fs.writeFileSync(path.join(dir, 'docs', '세션보드.md'),
    '| 날짜 | 트랙 | 만지는 파일 | 상태 |\n|---|---|---|---|\n'
    + '| 2026-08-04 | 내 트랙 | **Code.js·엔진_수집.js** | 진행중 |\n');
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');

  훅(dir, { file: 'Code.js', stateDir: st });   // 보드 줄을 Code.js 로 찾아낸다
  커밋(dir, '엔진_수집.js', 'x', 'feat: 선언만 한 파일을 남이 만졌다', 'sess-B');
  const r = 훅(dir, { file: 'Code.js', stateDir: st });

  assert.equal(r.조용, false, '선언한 파일은 아직 안 만졌다고 남의 차지가 되지 않는다');
  assert.match(r.본문, /선언한/, '왜 걸렸는지(선언 겹침)를 안 알려준다');
});

test('🔴 한글 파일명도 잡는다 — 이 저장소 파일은 대부분 한글이다', (t) => {
  if (!있나) return t.skip('git 없음');
  /* 신설 당일 이 검사가 실결함을 잡았다: git 은 기본값으로 비ASCII 경로를 `"\354…"` 로
   * 이스케이프해 내놓는다. `core.quotepath=false` 가 없으면 경로 대조가 전부 빗나가고
   * 결과는 「겹치는 것 없음 = 조용」이다 — 훅이 도는데 아무것도 못 잡는 상태가 초록으로 보인다. */
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, '엔진_수집.js', 'a', 'init', 'sess-B');
  훅(dir, { file: '엔진_수집.js', stateDir: st });
  커밋(dir, '엔진_수집.js', 'b', 'fix: 남이 한글 파일을 고쳤다', 'sess-B');
  const r = 훅(dir, { file: '엔진_수집.js', stateDir: st });
  assert.equal(r.조용, false, '한글 파일명을 못 봤다 — 이 저장소에선 사실상 전부를 못 보는 것이다');
  assert.match(r.본문, /엔진_수집\.js/, '이스케이프된 경로가 그대로 새어 나왔다');
});

test('🔴 보드 줄이 동점이면 **아무 줄도 안 집는다** — 어느 쪽으로도 추측하지 않는다', (t) => {
  if (!있나) return t.skip('git 없음');
  /* 신설 당일 같은 자리에서 두 번 틀렸다: `>`(앞줄=오래된 남의 트랙이 이김) 로 오탐 →
   * `>=`(뒤줄이 이김) 으로 고쳤더니 그 사이 남이 줄을 더 붙여 **남의 줄**이 이겼다.
   * 두 방향 다 틀리는 건 가를 정보가 없어서다 — 그래서 침묵이 정답이다.
   * ⚠ 이 검사는 **양쪽 순서를 다 본다**. 한 순서만 검사하면 반대 방향 heuristic 이 통과한다. */
  for (const [먼저, 나중] of [['남의', '내'], ['내', '남의']]) {
    const dir = 픽스처저장소();
    const st = 상태폴더();
    fs.writeFileSync(path.join(dir, 'docs', '세션보드.md'),
      '| 날짜 | 트랙 | 만지는 파일 | 상태 |\n|---|---|---|---|\n'
      + `| 2026-08-04 | ${먼저} 트랙 | **Code.js·${먼저}전용.js** | 진행중 |\n`
      + `| 2026-08-04 | ${나중} 트랙 | **Code.js·${나중}전용.js** | 진행중 |\n`);
    커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
    훅(dir, { file: 'Code.js', stateDir: st });   // 두 줄 다 Code.js 로 1점 — 동점이다

    커밋(dir, '남의전용.js', 'x', 'feat: 남의 트랙 파일', 'sess-B');
    const r = 훅(dir, { file: 'Code.js', stateDir: st });
    assert.equal(r.조용, true,
      `동점인데 한 줄을 골라 남의 선언을 내 것이라 보고했다(순서: ${먼저}→${나중}): ${r.요약}`);
  }
});

test('🔑 보드가 애매해도 **내 커밋 제목**의 표식은 산다 (Session-Id 로 확실히 내 것)', (t) => {
  if (!있나) return t.skip('git 없음');
  /* 동점이면 보드 줄을 버리는데, 그때 표식 신호까지 같이 죽으면 트랙 충돌을 못 본다.
   * 내 커밋 제목은 Session-Id 로 확실히 내 것이라 보드와 무관하게 쓸 수 있다. */
  const dir = 픽스처저장소();
  const st = 상태폴더();
  fs.writeFileSync(path.join(dir, 'docs', '세션보드.md'),
    '| 날짜 | 트랙 | 만지는 파일 | 상태 |\n|---|---|---|---|\n'
    + '| 2026-08-04 | 남의 트랙 | **Code.js·A.js** | 진행중 |\n'
    + '| 2026-08-04 | 다른 트랙 | **Code.js·B.js** | 진행중 |\n');   // 동점 → 보드 줄 없음
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
  훅(dir, { file: 'Code.js', stateDir: st });

  커밋(dir, 'Code.js', 'b', 'feat: 내 트랙 작업 (F099)', 'sess-A');        // 내 커밋 = 표식 F099
  커밋(dir, '전혀_다른.js', 'x', 'fix: 같은 자리 손봄 (F099)', 'sess-B');  // 남이 같은 표식
  const r = 훅(dir, { file: 'Code.js', stateDir: st });

  assert.equal(r.조용, false, '보드가 애매하다고 표식 신호까지 버렸다 — 트랙 충돌을 못 본다');
  assert.match(r.본문, /F099/, '어떤 표식이 겹쳤는지를 안 알려준다');
});

test('파일이 안 겹쳐도 같은 표식(F0NN)이면 알린다 — 오늘 실사고가 그 경우였다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const st = 상태폴더();
  fs.writeFileSync(path.join(dir, 'docs', '세션보드.md'),
    '| 날짜 | 트랙 | 만지는 파일 | 상태 |\n|---|---|---|---|\n'
    + '| 2026-08-04 | 코드편집 통로 차단 F050·F065·F067 | **Code.js** | 진행중 |\n');
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');

  훅(dir, { file: 'Code.js', stateDir: st });
  // 상대는 전혀 다른 파일을 만졌다. 겹치는 건 커밋 제목의 F 번호뿐이다.
  커밋(dir, '전혀_다른.js', 'x', 'feat: 코드 파일 제자리 수정 차단 (F050·F065·F067)', 'sess-B');
  const r = 훅(dir, { file: 'Code.js', stateDir: st });

  assert.equal(r.조용, false, '파일이 안 겹치면 못 본다 — 오늘 두 세션이 만진 파일이 서로 달랐다');
  assert.match(r.본문, /표식/, '왜 걸렸는지(표식 겹침)를 안 알려준다');
});

test('🔴 공용 장부(세션보드 등) 겹침은 충돌이 아니다 — 모든 세션이 규약상 만진다', (t) => {
  if (!있나) return t.skip('git 없음');
  /* 신설 당일 라이브 프로브가 이걸 드러냈다: 기준점을 세션 시작으로 놓자 13건이 걸렸는데
   * **11건이 세션보드**(각 세션의 종료 선언)였고, 진짜 신호 2건이 그 밑에 묻혔다.
   * 장부를 신호로 세면 이 훅은 하루 만에 안 읽히는 장치가 된다. */
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'docs/세션보드.md', 'a', 'init', 'sess-B');
  훅(dir, { file: 'docs/세션보드.md', stateDir: st });   // 나도 보드를 만졌다(모두가 만진다)
  커밋(dir, 'docs/세션보드.md', 'b', 'docs: 보드 — 남의 트랙 종결', 'sess-B');
  const r = 훅(dir, { file: 'docs/세션보드.md', stateDir: st });
  assert.equal(r.조용, true,
    `보드 갱신을 충돌로 셌다 — 매 세션 종료마다 울려 진짜 신호를 묻는다: ${r.요약}`);
});

test('장부라도 표식이 겹치면 알린다 — 파일 신호만 죽이지 신호를 통째로 버리지 않는다', (t) => {
  if (!있나) return t.skip('git 없음');
  /* ⚠ 이 검사를 처음 짤 땐 남의 커밋이 세션보드 자체를 덮게 해서, 내 보드 줄이 사라져
   *   표식을 못 찾았다 — 픽스처가 자기 전제를 지운 것이다. 그래서 장부는 마찰신호.md 를 쓴다. */
  const dir = 픽스처저장소();
  const st = 상태폴더();
  fs.mkdirSync(path.join(dir, 'docs', '_ops'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', '세션보드.md'),
    '| 날짜 | 트랙 | 만지는 파일 | 상태 |\n|---|---|---|---|\n'
    + '| 2026-08-04 | 내 트랙 F070 | **Code.js·마찰신호.md** | 진행중 |\n');
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
  훅(dir, { file: 'Code.js', stateDir: st });                    // 보드 줄을 찾는다
  훅(dir, { file: 'docs/_ops/마찰신호.md', stateDir: st });      // 장부도 내가 만졌다

  커밋(dir, 'docs/_ops/마찰신호.md', 'b', 'docs: 마찰 F070 기록', 'sess-B');
  const r = 훅(dir, { file: 'Code.js', stateDir: st });

  assert.equal(r.조용, false, '장부를 통째로 버려서 트랙 표식까지 못 봤다 — 신호를 같이 버렸다');
  assert.match(r.본문, /표식/, '표식 겹침으로 걸렸다는 걸 안 알려준다');
  assert.ok(!/내가 만진 docs\/_ops/.test(r.본문), '장부를 파일 겹침으로도 셌다 — 억제가 안 됐다');
});

test('많이 쌓이면 잘라 보여주되 **몇 건 잘랐는지 밝힌다** (조용한 절단은 「이게 전부」로 읽힌다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
  훅(dir, { file: 'Code.js', stateDir: st });
  for (let i = 0; i < 7; i++) 커밋(dir, 'Code.js', `v${i}`, `fix: 남의 커밋 ${i}`, 'sess-B');

  const r = 훅(dir, { file: 'Code.js', stateDir: st });
  assert.equal(r.조용, false, '경고가 안 났다');
  const 항목수 = (r.본문.match(/^ {2}· /gm) || []).length;
  assert.equal(항목수, 5, `표시를 5건으로 안 줄였다(${항목수}건) — 길면 안 읽힌다`);
  assert.match(r.본문, /그리고 2건 더/, '자른 건수를 안 밝혔다 — 잘린 목록은 「전부」로 읽힌다');
  assert.match(r.본문, /git log .*\.\.HEAD/, '전부 보는 방법을 안 알려준다');
});

test('겹치지 않는 남의 커밋은 조용히 흘려보낸다 (거짓양성이 곧 무시로 이어진다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
  훅(dir, { file: 'Code.js', stateDir: st });
  커밋(dir, 'docs/무관.md', 'x', 'docs: 상관없는 트랙', 'sess-B');
  assert.equal(훅(dir, { file: 'Code.js', stateDir: st }).조용, true,
    '무관한 커밋에 경고했다 — 매 턴 울리면 진짜 충돌을 못 본다');
});

test('제목에 구분자처럼 생긴 글자가 있어도 파싱이 안 깨진다', (t) => {
  if (!있나) return t.skip('git 없음');
  /* 이 훅은 git log 를 **보이지 않는 0x1F** 로 쪼갠다. 그 글자가 편집 중 사라지면
   * split('') 이 되어 제목이 글자 단위로 쪼개진다 — 조용히 틀리는 쪽이다.
   * 그래서 한글·`|`·`·` 가 든 제목으로 파싱을 못박는다(커밋 제목의 일상 표기다). */
  const dir = 픽스처저장소();
  const st = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-B');
  훅(dir, { file: 'Code.js', stateDir: st });
  const 제목 = 'fix: 표|기·이 섞인 제목 — 그대로 나와야 한다';
  커밋(dir, 'Code.js', 'b', 제목, 'sess-B');
  const r = 훅(dir, { file: 'Code.js', stateDir: st });
  assert.equal(r.조용, false, '경고가 안 났다');
  assert.match(r.본문, /표\|기·이 섞인 제목 — 그대로 나와야 한다/,
    '제목이 깨졌다 — 구분자가 사라졌거나 잘못 쪼갰다');
});

test('git 이 없는 곳·망가진 입력에서도 작업을 막지 않는다', () => {
  const 빈곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-track-nogit-'));
  임시들.push(빈곳);
  const r1 = 훅(빈곳, { file: 'Code.js', stateDir: 상태폴더() });
  assert.equal(r1.조용, true, 'git 저장소가 아닌데 무언가를 냈다');
  assert.strictEqual(r1.exit, 0);

  const r2 = spawnSync(process.execPath, [HOOK], { input: '이건 JSON이 아니다', encoding: 'utf8' });
  assert.strictEqual(r2.status, 0);
  assert.strictEqual((r2.stdout || '').trim(), '', '입력을 못 읽었는데 무언가를 냈다');
});

// ── 등록층 (훅이 정확해도 안 불리면 아무 일도 안 일어난다 · F053) ───────────

test('settings.json 라우팅이 이 훅보다 넓다', () => {
  const p = path.resolve(__dirname, '..', '.claude', 'settings.json');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const entry = (cfg.hooks?.PreToolUse || []).find((e) =>
    (e.hooks || []).some((h) => String(h.command || '').includes('track-collision.js')));
  assert.ok(entry, 'track-collision 이 settings.json 에 등록돼 있지 않다 — 파일만 있으면 안 돈다');
  for (const t of ['Edit', 'Write', 'MultiEdit']) {
    assert.ok(new RegExp(entry.matcher).test(t), `매처가 ${t} 를 안 잡는다`);
  }
  const cmd = String((entry.hooks || []).find((h) =>
    String(h.command || '').includes('track-collision.js')).command);
  assert.ok(!/case "\$IN" in/.test(cmd),
    '앞단 case 필터가 있다 — 이 훅은 파일 경로가 아니라 저장소 상태를 보므로 어떤 필터도 훅보다 좁다');
  /* ⚠ 이 훅은 **가드가 아니다** — 못 돌면 exit 1(경고)이지 deny 가 아니어야 한다.
   *   편의 장치가 작업을 세우면 그게 더 큰 사고다(context-budget·session-handoff 와 같은 급). */
  assert.ok(!/permissionDecision..:..deny/.test(cmd),
    '미실행 시 deny 를 낸다 — 정보성 훅이 작업을 세우면 안 된다');
});
