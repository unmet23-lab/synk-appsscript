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
const { spawnSync } = require('node:child_process'); // git·도구 재현용 — 훅은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

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

/** 훅 호출. 세션마다 state 디렉터리를 갈라 서로 간섭하지 않게 한다.
 *  `절대파일` = 저장소 **밖** 경로를 그대로 건넬 때(형제 저장소·스크래치패드).
 *  `형제` = 형제 목록 이음매. **읽는 쪽과 같은 이름**을 봐야 한다(갈라지면 계약 검사가 헛돈다). */
function 훅(dir, { file, 절대파일, 형제, sid = 'sess-A', stateDir, tool = 'Edit', dirtyMs = 0, cwd } = {}) {
  const 경로 = 절대파일 || (file ? path.join(dir, file) : undefined);
  const r = 훅띄우기(HOOK, {
    input: JSON.stringify({ tool_name: tool, tool_input: { file_path: 경로 } }),
    encoding: 'utf8',
    // 실행 위치는 기본값(테스트 러너 위치)이 아니라 **줄 수 있어야** 한다 — 경로 해석이
    // process cwd 에 새는지는 cwd 가 ROOT 안일 때만 드러난다(라이브의 실제 모양이 그것이다).
    ...(cwd ? { cwd } : {}),
    env: {
      ...process.env,
      SYNK_TRACK_ROOT: dir,
      SYNK_CTXBUDGET_DIR: stateDir,
      CLAUDE_CODE_HOST_SESSION_ID: sid,
      // 탐지력 검사는 **시계에 묶이면 안 된다** — 기본 0(매번 검사). 스로틀 자체는 아래 전용 검사가 본다.
      SYNK_TRACK_DIRTY_MS: String(dirtyMs),
      ...(형제 ? { SYNK_OWNER_SIBLINGS: 형제.join(';') } : {}),
    },
  });
  const out = (r.stdout || '').trim();
  if (!out) return { 조용: true, 본문: '', 판정: undefined, exit: r.status };
  const j = JSON.parse(out);
  return {
    조용: false,
    /* 🔑 본문은 **두 통로 중 실린 쪽**을 읽는다 — ⑤ 가 막을 때는 additionalContext 가 아니라
     *   permissionDecisionReason 으로 나간다(거절된 도구의 additionalContext 는 안 읽힐 수 있다).
     *   한쪽만 읽으면 차단 검사가 「본문 없음」으로 조용히 통과한다(F239 · 새는 방향은 통과). */
    본문: String(j.hookSpecificOutput?.additionalContext || j.hookSpecificOutput?.permissionDecisionReason || ''),
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

/* ⚠ 2026-08-08(F239) 이후 이 검사는 **①②③④ 에 한정**된다 — ⑤(남의 미커밋)만 deny 를 낸다.
 *   넷은 여전히 차단 근거가 아니다: 남의 커밋이 내 편집을 금지할 이유가 없고, ④ 는 다른 트리라
 *   되돌림이 저쪽 몫이다. 그리고 **allow 는 어떤 축에서도 안 낸다** — 그건 같은 매처의
 *   board-guard·memory-index-guard 판정을 실제로 덮는다(deny 는 안 덮는다: 편집이 아예 안 난다). */
test('🔴 커밋 축(①②③)은 permissionDecision 을 내지 않는다 (같은 매처의 다른 가드를 덮으면 안 된다)', (t) => {
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

test('🔴 allow 는 **어떤 축에서도** 안 낸다 — 그것만이 남의 가드를 덮는다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 공유 = 상태폴더();
  커밋(dir, '가드.js', 'let a = 1;\n', 'seed', 'sess-Z');
  const 본 = [];
  // 조용한 판·커밋 축·⑤ 차단 판을 한 번씩 지난다 — 한 경로만 보면 나머지에서 샌다.
  본.push(훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 }));
  커밋(dir, '가드.js', 'let a = 2;\n', 'fix: 남의 커밋', 'sess-B');
  본.push(훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 }));
  훅(dir, { file: '가드.js', sid: 'sess-B', stateDir: 공유 });
  fs.writeFileSync(path.join(dir, '가드.js'), 'let a = 3;\n');
  본.push(훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 }));
  for (const r of 본) assert.notStrictEqual(r.판정, 'allow', `allow 를 냈다 — 같은 매처의 다른 가드 판정을 덮는다:\n${r.본문}`);
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

/* 🔴 [F203] **번호대를 바꿔가며** 잰다. 옛 픽스처는 전부 F050·F065·F070·F094 였고, 표식
 *   정규식이 `F0\d{2}` 라 F100 이후는 통째로 안 보였는데 스위트는 내내 초록이었다 —
 *   픽스처가 정규식이 이미 아는 번호만 골라 쓰면 회귀는 자기 구멍을 못 본다.
 *   장부는 이 검사를 쓰는 날 F203 이고, 앞으로 자라는 쪽은 여기 없던 쪽이다. */
for (const 번호 of ['F067', 'F123', 'F203']) {
  test(`파일이 안 겹쳐도 같은 표식(${번호})이면 알린다 — 오늘 실사고가 그 경우였다`, (t) => {
    if (!있나) return t.skip('git 없음');
    const dir = 픽스처저장소();
    const st = 상태폴더();
    fs.writeFileSync(path.join(dir, 'docs', '세션보드.md'),
      '| 날짜 | 트랙 | 만지는 파일 | 상태 |\n|---|---|---|---|\n'
      + `| 2026-08-04 | 코드편집 통로 차단 ${번호} | **Code.js** | 진행중 |\n`);
    커밋(dir, 'Code.js', 'a', 'init', 'sess-B');

    훅(dir, { file: 'Code.js', stateDir: st });
    // 상대는 전혀 다른 파일을 만졌다. 겹치는 건 커밋 제목의 F 번호뿐이다.
    커밋(dir, '전혀_다른.js', 'x', `feat: 코드 파일 제자리 수정 차단 (${번호})`, 'sess-B');
    const r = 훅(dir, { file: 'Code.js', stateDir: st });

    assert.equal(r.조용, false, `${번호} 를 표식으로 못 봤다 — 파일이 안 겹치면 트랙 충돌이 통째로 안 보인다`);
    assert.match(r.본문, /표식/, '왜 걸렸는지(표식 겹침)를 안 알려준다');
    assert.match(r.본문, new RegExp(번호), '어떤 표식이 겹쳤는지를 안 알려준다');
  });
}

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

  const r2 = 훅띄우기(HOOK, { input: '이건 JSON이 아니다', encoding: 'utf8' });
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
  /* 🔴 「미실행 = deny」는 여기서 안 잰다 — 2026-08-08(F239) 로 이 훅도 ⑤ 에서 실제로 막게 됐고,
   *   그 불변식은 tests/훅이식성.test.js 가 **전 PreToolUse 가드에 대해** 한 곳에서 진다
   *   (정보성 면제 목록에서 이 훅을 뺀 것이 그 편입이다). 여기 같은 단언을 또 적었더니
   *   실제 등록 표기(`"permissionDecision":"deny"`)가 아니라 이스케이프된 모양을 가정한
   *   정규식이 들어가 **빨간 채로 죽은 세션에 갇혔다** — 같은 판정을 두 곳에 적으면 갈라진다. */
});

// ── 상태 파일 계약 (내가 쓰고 **남이 읽는다** · 2026-08-04 세션 조율) ─────────
/* 이 훅이 쌓는 `track-<프로젝트>-<세션>.json` 의 `touched` 를 `tools/작업본소유자.js`(F073)가
 * 읽어 「살아있는 남의 작업본」을 가른다. 이 파일은 이제 혼자 쓰는 캐시가 아니라 **두 도구의
 * 계약**이다. 쓰는 쪽은 여기, 읽는 쪽은 저기 — 판정을 둘로 만들지 않기로 조율했다.
 *
 * 🔴 이 계약이 깨지는 방향은 **조용하다.** 필드명·경로 정규화를 내가 바꾸면
 *   ①위 20건은 전부 초록(경고 동작만 보므로) ②저쪽 회귀도 전부 초록(픽스처가 저쪽의 가정을
 *   스스로 적어 두므로) ③라이브에서만 전부 「❔ 주인 모름」이 된다. 저쪽 표현대로 그건
 *   **있는 것보다 나쁘다 — 있는데 안심시킨다.**
 *   그래서 양쪽 가정을 각자 적지 않는다. **내 진짜 훅이 쓴 파일을 저쪽 진짜 도구로 읽힌다.** */
test('🔑 내가 쓴 상태 파일을 작업본소유자가 읽는다 — 형식이 어긋나면 조용히 「모름」이 된다', (t) => {
  if (!있나) return t.skip('git 없음 — 픽스처를 못 만든다');
  const 도구 = path.resolve(__dirname, '..', 'tools', '작업본소유자.js');
  if (!fs.existsSync(도구)) return t.skip('작업본소유자.js 가 없다 — 읽는 쪽이 아직 없다');

  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  /* 🔑 **하위 폴더 + 한글**로 건넌다. 둘 다 이유가 있다.
   *   · 한글 = 이 저장소 파일은 대부분 한글이고, 경로 이스케이프는 쓰는 쪽·읽는 쪽 어디서
   *     깨져도 결과가 「겹침 0」이라 초록으로 보인다(F052 · 이 훅이 이미 한 번 데였다).
   *   · 하위 폴더 = 최상위 파일은 구분자가 **아예 없어** 윈도 역슬래시 정규화를 지워도
   *     통과한다. 실제로 변이 실험에서 이 한 칸 때문에 그 변이만 안 잡혔다 —
   *     라이브 목록은 crewcard/·tests/ 처럼 대부분 중첩인데 픽스처만 평평했던 것이다. */
  const 시험파일 = 'docs/정본/엔진_시험.js';
  커밋(dir, 시험파일, 'a', 'init', 'sess-B');
  훅(dir, { file: 시험파일, sid: 'sess-B', stateDir: 상태 }); // 남(B)이 만졌다고 기록시킨다
  fs.writeFileSync(path.join(dir, 시험파일), 'b');            // 미커밋으로 남긴다

  const 조회 = (나) => 훅띄우기(도구, {
    encoding: 'utf8',
    env: { ...process.env, SYNK_OWNER_ROOT: dir, SYNK_CTXBUDGET_DIR: 상태, CLAUDE_CODE_HOST_SESSION_ID: 나 },
  });

  const 남이볼때 = 조회('sess-A');
  assert.strictEqual(남이볼때.status, 0, '작업본소유자가 죽었다');
  assert.match(남이볼때.stdout, /살아있는 남의 작업본[\s\S]*docs\/정본\/엔진_시험\.js/,
    '내가 쓴 touched 를 저쪽이 못 읽었다 — 필드명·경로 정규화가 어긋나면 조용히 「❔ 모름」이 된다');

  // 반대 방향도 본다 — 전부 🔴로 칠하는 것도 「잡았다」처럼 보인다.
  assert.ok(!/살아있는 남의 작업본/.test(조회('sess-B').stdout),
    '내가 만진 파일을 남의 것이라 했다 — 세션 id 대조가 어긋났다');
});

/* 🔗 같은 계약, **형제 저장소** (F134·F137 이 남겨 둔 사각 — 「주인 가르기」).
 * F134 는 읽는 쪽이 형제 미커밋을 **세게** 했다. 그런데 이 훅이 ROOT 밖 경로를 버려서 만진
 * 기록이 아예 없었고, 그래서 형제 파일은 세어져도 주인 칸이 **언제나 ❔모름**이었다 —
 * 이 프로젝트 트랙 절반(talk 파일)에 대해 F073 보호가 통째로 없었다는 뜻이다.
 *
 * 🔴 여기서 새는 방향은 조용하다: 좌표(접두)를 한쪽만 바꾸면 ①이 파일의 다른 검사는 전부 초록
 *   ②저쪽 회귀도 초록 ③라이브에서만 「❔모름」으로 되돌아간다. 그래서 픽스처가 아니라
 *   **내 진짜 훅이 쓴 파일을 저쪽 진짜 도구로 읽힌다**(위 검사와 같은 이유·같은 방식). */
test('🔗 형제 저장소 파일도 주인이 갈린다 — 좌표가 한쪽만 바뀌면 조용히 「모름」이 된다 (F134·F137)', (t) => {
  if (!있나) return t.skip('git 없음 — 픽스처를 못 만든다');
  const 도구 = path.resolve(__dirname, '..', 'tools', '작업본소유자.js');
  if (!fs.existsSync(도구)) return t.skip('작업본소유자.js 가 없다 — 읽는 쪽이 아직 없다');

  const dir = 픽스처저장소();          // 내 저장소 = 세션이 연 곳
  const sib = 픽스처저장소();          // 형제 저장소 = SYNK-talk 자리
  const 상태 = 상태폴더();
  // ⚠ 내 저장소에 커밋이 하나는 있어야 한다 — 훅은 HEAD 가 없으면 **상태를 쓰기 전에** 끝난다.
  커밋(dir, 'Code.js', 'a', 'init', 'sess-Z');
  /* 하위 폴더 + 한글 — 위 검사와 같은 이유. 형제에서 실제로 만지는 모양이 그렇다
   * (`supabase/migrations/…`·`docs/L0_스키마.sql`). */
  const 형제파일 = 'supabase/migrations/007_인증.sql';
  커밋(sib, 형제파일, 'a', 'seed');
  fs.writeFileSync(path.join(sib, 형제파일), 'b');   // 형제에 미커밋으로 남긴다

  // 남(B)이 **내 저장소에서 세션을 열고** 형제 파일을 편집했다 — 라이브의 거의 전부가 이 모양이다.
  훅(dir, { 절대파일: path.join(sib, 형제파일), 형제: [sib], sid: 'sess-B', stateDir: 상태 });

  const 조회 = (나) => 훅띄우기(도구, {
    encoding: 'utf8',
    env: {
      ...process.env, SYNK_OWNER_ROOT: dir, SYNK_CTXBUDGET_DIR: 상태,
      SYNK_OWNER_SIBLINGS: sib, CLAUDE_CODE_HOST_SESSION_ID: 나,
    },
  });

  const 남이볼때 = 조회('sess-A');
  assert.strictEqual(남이볼때.status, 0, `작업본소유자가 죽었다:\n${남이볼때.stderr}`);
  assert.match(남이볼때.stdout, /살아있는 남의 작업본[\s\S]*007_인증\.sql/,
    `형제 파일의 주인을 못 갈랐다 — 좌표가 어긋나면 이 자리는 「❔모름」으로 조용히 되돌아간다:\n${남이볼때.stdout}`);
  assert.ok(남이볼때.stdout.includes(path.basename(sib)),
    `어느 저장소인지 안 밝혔다 — 경로만 보면 내 저장소에서 찾다가 「없네」로 끝난다:\n${남이볼때.stdout}`);
  assert.ok(!/🔗[\s\S]*007_인증\.sql/.test(남이볼때.stdout),
    `주인이 갈렸는데 「주인 모름」 묶음에 그대로 뒀다 — 처방이 「직접 가서 봐라」로 후퇴한다:\n${남이볼때.stdout}`);

  // 반대 방향 — 전부 🔴로 칠하는 것도 「잡았다」처럼 보인다.
  assert.ok(!/살아있는 남의 작업본/.test(조회('sess-B').stdout),
    `내가 만진 형제 파일을 남의 것이라 했다 — 접두를 벗기는 자리에서 sid 대조가 어긋났다:\n${조회('sess-B').stdout}`);
});

test('🔑 형제 좌표는 내 저장소 경로와 **글자가 겹치지 않는다** — 겹치면 남의 파일이 내 것이 된다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const sib = 픽스처저장소();
  const 상태 = 상태폴더();
  const 같은상대경로 = 'docs/세션보드.md';       // 두 저장소에 **같은 상대 경로**가 있는 흔한 모양
  커밋(dir, 'Code.js', 'a', 'init', 'sess-Z');   // HEAD 가 없으면 훅은 상태를 쓰기 전에 끝난다

  훅(dir, { 절대파일: path.join(sib, 같은상대경로), 형제: [sib], sid: 'sess-B', stateDir: 상태 });

  const 이름 = fs.readdirSync(상태).find((f) => f.startsWith('track-'));
  assert.ok(이름, '훅이 상태 파일을 아예 안 썼다 — 계약의 재료가 없다');
  const j = JSON.parse(fs.readFileSync(path.join(상태, 이름), 'utf8'));
  assert.deepStrictEqual(j.touched, [`../${path.basename(sib)}/${같은상대경로}`],
    `형제 파일을 저장소 상대 경로로 담았다 — 내 저장소의 같은 경로와 구별이 안 되고, `
    + `그 오귀속은 「내것」 쪽으로 새서 남의 작업본을 편집해도 된다는 말이 된다(F073):\n${JSON.stringify(j.touched)}`);
});

test('🔴 file_path 가 없는 호출은 **실행 위치를 만진 것으로 삼지 않는다**', (t) => {
  if (!있나) return t.skip('git 없음');
  /* 좌표 해석을 lib 으로 옮기면서 빈 값을 `path.resolve('')` 에 넘긴 순간 그게 **cwd** 가 된다.
   * cwd 가 ROOT 하위면(라이브에서 흔하다) 만지지도 않은 폴더가 만진 목록에 들어가고, 그 목록은
   * 「내것」 판정의 근거라 ⑧이 남의 변경을 내 것으로 통과시키는 방향으로 샌다.
   * 🔑 cwd 를 ROOT 하위로 주지 않으면 이 자리는 **영원히 초록**이다 — 변이 시험이 그걸 드러냈다. */
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-Z');
  const 하위 = path.join(dir, 'docs');                 // 픽스처저장소가 만들어 두는 폴더

  훅(dir, { sid: 'sess-B', stateDir: 상태, cwd: 하위 });   // file_path 없음
  const 이름 = fs.readdirSync(상태).find((f) => f.startsWith('track-'));
  assert.ok(이름, '훅이 상태 파일을 아예 안 썼다 — 빈 목록과 미실행이 같은 모양이 된다');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(상태, 이름), 'utf8')).touched, [],
    '실행 위치를 만진 파일로 담았다 — 만지지도 않은 것이 「내것」의 근거가 된다');
});

test('저장소 어디에도 없는 경로(스크래치패드)는 여전히 안 담는다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const sib = 픽스처저장소();
  const 상태 = 상태폴더();
  const 밖 = path.join(os.tmpdir(), 'synk-scratch-밖.md');
  커밋(dir, 'Code.js', 'a', 'init', 'sess-Z');

  훅(dir, { 절대파일: 밖, 형제: [sib], sid: 'sess-B', stateDir: 상태 });
  const 이름 = fs.readdirSync(상태).find((f) => f.startsWith('track-'));
  assert.ok(이름, '훅이 상태 파일을 아예 안 썼다 — 빈 목록과 미실행이 같은 모양이 된다');
  const j = JSON.parse(fs.readFileSync(path.join(상태, 이름), 'utf8'));
  assert.deepStrictEqual(j.touched, [],
    `저장소 밖 편집을 만진 목록에 담았다 — 형제를 담으려고 문을 너무 넓게 열었다:\n${JSON.stringify(j.touched)}`);
});

// ── 신호 ④ 다른 작업 트리의 살아있는 미커밋 (F079) ─────────────────────────
/* F079 실사고: 세션 둘이 **같은 시각 같은 파일 두 개**를 각자 고쳤다. 한쪽이 워크트리였고,
 * 감지 장치가 셋이나 있었는데 셋 다 못 봤다 — ①이 훅은 master 착지 커밋만 보고
 * ②작업본소유자는 메인의 `git status` 만 보고 ③상태 폴더 키가 cwd 해시라 **두 세션이
 * 서로의 존재조차 몰랐다.** ③이 가장 깊다: 감지기를 고쳐도 재료가 갈라져 있었다.
 *
 * ⚠ 여기서 새는 방향은 언제나 「조용」이다. 워크트리를 못 읽으면 겹침 0 = 통과로 보인다. */

/** 픽스처 저장소에 워크트리를 붙인다. 커밋이 하나는 있어야 한다. */
function 워크트리붙이기(dir, 이름, 브랜치) {
  const p = path.join(dir, '.wt', 이름);
  const r = gitIn(dir, ['worktree', 'add', '-q', '-b', 브랜치, p]);
  return r.status === 0 ? p : null;
}

test('🔴 다른 작업 트리가 **미커밋으로 들고 있는** 파일을 만지면 알린다 (F079)', (t) => {
  if (!있나) return t.skip('git 없음 — 픽스처를 못 만든다');
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  const 시험파일 = 'docs/정본/엔진_시험.js';   // 하위 폴더 + 한글 (위와 같은 이유)
  커밋(dir, 시험파일, 'a', 'init', 'sess-A');

  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');
  // 옆 트리가 그 파일을 **고쳐서 들고만 있다** — 커밋은 안 했다. 이게 F079 의 실제 모양이다.
  fs.writeFileSync(path.join(wtDir, 시험파일), '옆 트리가 고치는 중');

  const r = 훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태 });
  assert.equal(r.조용, false, '살아있는 남의 편집을 못 봤다 — 커밋이 아니라 안 잡힌다는 게 F079 다');
  assert.match(r.본문, /다른 작업 트리가 지금 미커밋으로 들고 있다/, '무엇 때문에 알리는지가 안 보인다');
  assert.match(r.본문, /옆트리/, '어느 트리인지 안 알려주면 확인하러 갈 데가 없다');
  assert.match(r.본문, /docs\/정본\/엔진_시험\.js/, '한글 경로가 이스케이프돼 깨졌다 — 그러면 대조가 전부 빗나간다');
  assert.strictEqual(r.판정, undefined, '차단했다 — 이 훅은 정보만 준다');
});

test('🔴 새 폴더의 **미추적** 파일도 본다 — `-uall` 없으면 통째로 접혀 사라진다 (F085)', (t) => {
  if (!있나) return t.skip('git 없음');
  /* 58ce9737 실측 지적: `git status --porcelain` 은 새 폴더를 `?? src/` 로 뭉쳐서
   * 그 안의 파일이 목록에서 **사라진다**. 추적 파일의 수정은 멀쩡히 보이므로 라이브에선
   * 정상으로 보이고, 하필 그 사각이 **미추적**이다 — 이력·stash·reflog 어디에도 없다(F025).
   * 그래서 픽스처를 「새 폴더 + 그 안의 새 파일」로 잡는다. 평평한 새 파일은 접히지 않아
   * `-uall` 을 빼도 통과한다(같은 층위: F052 의 평평한 픽스처가 정규화 변이를 가렸던 자리). */
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  커밋(dir, 'docs/정본/엔진_시험.js', 'a', 'init', 'sess-A');
  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');

  const 새파일 = 'src/옆트리것.js';
  fs.mkdirSync(path.join(wtDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(wtDir, 새파일), '옆 트리가 새로 만든 것');

  const r = 훅(dir, { file: 새파일, sid: 'sess-A', stateDir: 상태 });
  assert.equal(r.조용, false,
    '새 폴더 안의 미추적 파일을 놓쳤다 — `?? src/` 로 접혀 파일명이 목록에 없다(-uall 누락)');
  assert.match(r.본문, /src\/옆트리것\.js/, '접힌 폴더 이름만 보고 파일을 못 짚었다');
});

test('아무도 안 들고 있으면 조용하다 (거짓양성이 곧 무시로 이어진다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  커밋(dir, 'docs/정본/엔진_시험.js', 'a', 'init', 'sess-A');
  커밋(dir, 'docs/정본/다른것.js', 'a', 'init2', 'sess-A');
  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');
  fs.writeFileSync(path.join(wtDir, 'docs/정본/다른것.js'), '옆 트리가 고치는 중');

  // 옆 트리가 든 것은 `다른것.js` 다. 내가 만지는 건 `엔진_시험.js` — 겹치지 않는다.
  assert.equal(훅(dir, { file: 'docs/정본/엔진_시험.js', sid: 'sess-A', stateDir: 상태 }).조용, true,
    '겹치지도 않는데 알렸다 — 잔소리하는 장치는 읽히지 않게 된다');
});

test('내 작업 트리가 든 미커밋은 내 것이라 안 알린다 (자기 자신을 남으로 세지 않는다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  const 시험파일 = 'docs/정본/엔진_시험.js';
  커밋(dir, 시험파일, 'a', 'init', 'sess-A');
  워크트리붙이기(dir, '옆트리', 'peer-branch');   // 트리는 있지만 깨끗하다
  fs.writeFileSync(path.join(dir, 시험파일), '내가 고치는 중');   // 더러운 건 **내 트리**다

  assert.equal(훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태 }).조용, true,
    '내 미커밋을 남의 것이라 했다 — 그러면 매 편집마다 나를 경고한다');
});

test('같은 파일로 두 번 알리지 않는다 (안 읽히는 경고는 없는 것과 같다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  const 시험파일 = 'docs/정본/엔진_시험.js';
  커밋(dir, 시험파일, 'a', 'init', 'sess-A');
  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');
  fs.writeFileSync(path.join(wtDir, 시험파일), '옆 트리가 고치는 중');

  assert.equal(훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태 }).조용, false, '1회차가 조용했다');
  assert.equal(훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태 }).조용, true, '2회차도 알렸다 — 잔소리다');
});

/* ⚠ lib 은 **훅 옆에서** 가져온다. `__dirname/../.claude/hooks/lib` 로 고정하면 변이 실험이
 *   사본 훅을 갈아끼워도 여기는 늘 실 lib 을 본다 — 그러면 무엇을 변이시켜도 초록이라,
 *   「지킨다고 주장만 하는 회귀」가 된다. 실제로 처음엔 그렇게 짰고 변이 3건이 통과했다. */
const libIn = (이름) => require(path.join(path.dirname(HOOK), 'lib', 이름));

test('🔑 워크트리에서 실행해도 **같은 상태 파일**에 쓴다 — 이게 가장 깊은 구멍이었다 (F079)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  커밋(dir, 'docs/정본/엔진_시험.js', 'a', 'init', 'sess-A');
  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');

  /* 🔑 **결과로 검사한다.** 키 함수를 직접 부르면 훅이 그 키를 실제로 쓰는지는 안 보인다 —
   *   훅 안에서 옛 계산으로 되돌려도 통과해 버린다(변이 J 가 정확히 그렇게 빠져나갔다).
   *   같은 세션 id 로 메인과 워크트리에서 각각 훅을 돌려, **파일이 하나로 모이는지**를 본다. */
  훅(dir, { file: 'docs/정본/엔진_시험.js', sid: 'sess-A', stateDir: 상태 });
  훅(wtDir, { file: 'docs/정본/엔진_시험.js', sid: 'sess-A', stateDir: 상태 });

  const 상태파일 = fs.readdirSync(상태).filter((f) => f.startsWith('track-'));
  assert.strictEqual(상태파일.length, 1,
    `메인과 워크트리가 상태 파일을 ${상태파일.length}개로 갈랐다 — 그러면 두 세션은 서로의 존재조차 모른다(실측 cec367f48f vs 1fc2df68ae): ${상태파일.join(', ')}`);

  /* 🔑 하위 호환도 같은 무게로 못 박는다. 메인에서의 키가 **옛 값 그대로**여야
   *   `tools/작업본소유자.js` 가 이 훅의 상태 파일을 계속 읽는다(오늘 조율한 계약). */
  const store = libIn('handoff-store.js');
  assert.strictEqual(상태파일[0], `track-${store.projectKey(dir)}-sess-A.json`,
    '메인 키가 바뀌었다 — 작업본소유자가 이 훅의 상태 파일을 못 찾게 된다(계약 파기)');
});

test('🔑 공통 `.git` 을 **git 없이** 푼다 — 매 편집마다 도는 자리라 spawn 이 곧 비용이다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  커밋(dir, 'docs/정본/엔진_시험.js', 'a', 'init', 'sess-A');
  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');

  /* git 을 못 찾는 자식에서 물어본다. fs 분기가 죽어 있으면 폴백(spawn)도 실패해 null 이 나온다.
   * 실측: git 한 번이 68ms 였고 fs 로는 0.01ms 다 — 편집 100번이면 7초 대 1ms. */
  const 코드 = `const wt=require(${JSON.stringify(path.join(path.dirname(HOOK), 'lib', 'worktrees.js').replace(/\\/g, '/'))});`
    + `process.stdout.write(JSON.stringify([wt.gitCommonDir(process.argv[1]),wt.gitCommonDir(process.argv[2]),wt.anyOthers(process.argv[2])]));`;
  const r = 훅띄우기(['-e', 코드, dir, wtDir], {   // 자식이 죽으면 통로가 던진다
    encoding: 'utf8', env: { PATH: '', SystemRoot: process.env.SystemRoot || '' },
  });
  const [메인공통, 워크공통, 있나others] = JSON.parse(r.stdout);
  assert.ok(메인공통, 'git 없이 메인의 공통 .git 을 못 풀었다');
  assert.strictEqual(워크공통, 메인공통,
    'git 없이 워크트리의 `.git` **파일**(gitdir: …)을 못 풀었다 — 워크트리 세션만 조용히 눈이 먼다');
  assert.strictEqual(있나others, true, 'git 없이 워크트리 존재를 못 봤다');
});

test('커밋 충돌과 워크트리 충돌이 같이 있으면 **둘 다** 낸다 (하나를 삼키면 그게 사각지대다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  const 내파일 = 'docs/정본/엔진_시험.js';
  const 남파일 = 'docs/정본/다른것.js';
  커밋(dir, 내파일, 'a', 'init', 'sess-A');
  커밋(dir, 남파일, 'a', 'init2', 'sess-A');
  훅(dir, { file: 내파일, sid: 'sess-A', stateDir: 상태 });   // 기준점 + 내가 만졌다고 기록
  훅(dir, { file: 남파일, sid: 'sess-A', stateDir: 상태 });
  커밋(dir, 남파일, 'b', '남의 커밋', 'sess-B');               // ① 커밋 충돌 재료

  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');
  fs.writeFileSync(path.join(wtDir, 내파일), '옆 트리가 고치는 중'); // ② 워크트리 충돌 재료

  const r = 훅(dir, { file: 내파일, sid: 'sess-A', stateDir: 상태 });
  assert.equal(r.조용, false, '둘 다 있는데 조용했다');
  assert.match(r.본문, /남의 커밋 \D*\d+건\D*이 내 자리에 착지했다/, '커밋 신호가 사라졌다');
  assert.match(r.본문, /다른 작업 트리가 지금 미커밋으로 들고 있다/, '워크트리 신호가 사라졌다');
  assert.match(r.요약, /착지했다[\s\S]*미커밋으로 들고 있다/, '요약 한 줄이 둘 중 하나만 말한다');
});

test('🔴 **내가 먼저 만진 뒤** 남이 잡아도 알린다 — 이 순서가 F079 의 실제 모양이었다', (t) => {
  if (!있나) return t.skip('git 없음');
  /* 처음엔 스로틀을 「처음 만지는 파일일 때만 검사」 하나로 뒀는데, 그러면 이 순서를 통째로 놓친다.
   * 양쪽이 각자 먼저 손대고 **나중에** 겹치는 게 실제 사고 모양이라, 놓치는 방향이 곧 사각지대다.
   * 그래서 스로틀을 둘로 갈랐다 — 검사는 시간으로, 알림은 파일당 1회. */
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  const 시험파일 = 'docs/정본/엔진_시험.js';
  커밋(dir, 시험파일, 'a', 'init', 'sess-A');

  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');

  // ① 내가 먼저 만진다 — 이때 옆 트리는 아직 깨끗하다
  assert.equal(훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태 }).조용, true, '아직 아무도 안 잡았는데 알렸다');
  // ② 그 **뒤에** 옆 트리가 같은 파일을 잡는다
  fs.writeFileSync(path.join(wtDir, 시험파일), '옆 트리가 나중에 고치기 시작');
  // ③ 내가 다시 만진다 — 여기서 알려야 한다(검사 스로틀은 시간이지 「처음」이 아니다)
  const r = 훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태 });
  assert.equal(r.조용, false, '먼저 만졌다는 이유로 영영 안 보게 됐다 — F079 를 그대로 놓치는 자리다');
  assert.match(r.본문, /다른 작업 트리가 지금 미커밋으로 들고 있다/);
});

test('비용 스로틀이 실제로 억제한다 — 주기 안에서는 다시 묻지 않는다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  const 시험파일 = 'docs/정본/엔진_시험.js';
  커밋(dir, 시험파일, 'a', 'init', 'sess-A');
  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');

  훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태, dirtyMs: 600000 });  // 1회차: 깨끗
  fs.writeFileSync(path.join(wtDir, 시험파일), '이제 잡았다');                   // 그 뒤 더러워짐
  assert.equal(훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태, dirtyMs: 600000 }).조용, true,
    '주기 안인데 다시 물었다 — 스로틀이 안 걸리면 편집마다 327ms 를 태운다');
});

test('🔑 워크트리가 없으면 비싼 검사를 아예 안 한다 (fs 로 먼저 거른다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const wt = libIn('worktrees.js');
  const dir = 픽스처저장소();
  커밋(dir, 'docs/정본/엔진_시험.js', 'a', 'init', 'sess-A');
  assert.strictEqual(wt.anyOthers(dir), false, '워크트리가 없는데 있다고 했다 — 그러면 매번 git 을 부른다');
  assert.deepStrictEqual(wt.othersDirty(dir), [], '빠른 경로가 빈 배열을 안 냈다');

  const wtDir = 워크트리붙이기(dir, '옆트리', 'peer-branch');
  if (!wtDir) return t.skip('git worktree 를 못 만들었다');
  assert.strictEqual(wt.anyOthers(dir), true, '워크트리가 생겼는데 못 봤다 — 여기서 놓치면 전부 놓친다');
  /* 🔑 **워크트리 쪽에서 물어도** 같은 답이어야 한다. `.git` 이 디렉터리가 아니라
   *   `gitdir: …` 한 줄짜리 파일이라, 그 분기를 안 다루면 워크트리 세션만 조용히 눈이 먼다. */
  assert.strictEqual(wt.anyOthers(wtDir), true, '워크트리 안에서 물었더니 못 봤다(.git 파일 분기)');
  assert.strictEqual(wt.gitCommonDir(wtDir), wt.gitCommonDir(dir), '같은 저장소인데 공통 .git 이 갈렸다');
});

test('검사 시각을 저장한다 — 안 쓰면 스로틀이 조용히 죽어 매 편집마다 git 을 부른다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 상태 = 상태폴더();
  const 시험파일 = 'docs/정본/엔진_시험.js';
  커밋(dir, 시험파일, 'a', 'init', 'sess-A');
  워크트리붙이기(dir, '옆트리', 'peer-branch');   // 깨끗한 트리 — 경고는 안 나온다
  훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태 });
  훅(dir, { file: 시험파일, sid: 'sess-A', stateDir: 상태 });

  const 파일들 = fs.readdirSync(상태).filter((f) => f.startsWith('track-'));
  assert.ok(파일들.length, '상태 파일이 없다');
  const j = JSON.parse(fs.readFileSync(path.join(상태, 파일들[0]), 'utf8'));
  assert.ok(j.dirtyChecked && Number(j.dirtyChecked[시험파일]) > 0,
    '검사 시각이 상태에 안 남았다 — 경고가 안 나온 경우에도 남겨야 스로틀이 산다');
});

/* ─────────────────────────────────────────────────────────────────────────────
 * 형제 저장소의 **커밋** 축 (F187·F188 이 조용했던 자리)
 *
 * 쓰는 쪽은 `../SYNK-talk/…` 를 담는데(위 검사들) 읽는 쪽(`git show --name-only`)은 ROOT 에서만
 * 돌아 저장소 상대 경로를 준다 — 교집합이 **원리적으로 0**이라 이 훅은 형제 작업에 대해
 * 한 번도 운 적이 없었다. 실측 2026-08-07: 만진 파일 127개 중 91개(72%)가 형제다.
 * ⚠ 탐지력은 픽스처가 진다 — 실저장소·git 이력에 기대면 CI 에서 깨진다.
 * ───────────────────────────────────────────────────────────────────────────── */

test('🔴 형제 저장소에 남이 내 파일을 커밋하면 운다 — **내 저장소 HEAD 는 안 움직인다**(F187·F188)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const sib = 픽스처저장소();
  const 상태 = 상태폴더();
  const 형제파일 = 'tools/왕복시험.js';            // 사고가 실제로 난 파일 모양(하위 폴더 + 한글)
  커밋(dir, 'Code.js', 'a', 'init', 'sess-Z');     // HEAD 가 없으면 훅은 상태를 쓰기 전에 끝난다
  커밋(sib, 형제파일, 'a', 'seed', 'sess-Z');

  // ① 내가 형제 파일을 만진다 — 첫 호출은 기준점만 잡고 조용하다.
  const 첫 = 훅(dir, { 절대파일: path.join(sib, 형제파일), 형제: [sib], sid: 'sess-A', stateDir: 상태 });
  assert.ok(첫.조용, `첫 호출은 기준점만 잡아야 한다:\n${첫.본문}`);

  // ② 남이 **형제에서** 그 파일을 커밋한다. 내 저장소 HEAD 는 그대로다.
  const 남sha = 커밋(sib, 형제파일, 'b', '같은 파일을 남이 고쳤다', 'sess-B');
  const 내HEAD전 = (gitIn(dir, ['rev-parse', 'HEAD']).stdout || '').trim();

  const r = 훅(dir, { 절대파일: path.join(sib, 형제파일), 형제: [sib], sid: 'sess-A', stateDir: 상태 });
  const 내HEAD후 = (gitIn(dir, ['rev-parse', 'HEAD']).stdout || '').trim();
  assert.strictEqual(내HEAD전, 내HEAD후,
    '검사 전제가 깨졌다 — 내 저장소 HEAD 가 움직이면 이 자리를 안 재는 것이다');

  assert.ok(!r.조용,
    '형제 커밋이 내 자리에 착지했는데 조용했다 — 이게 F187·F188 이 난 모양이다. '
    + '내 저장소 HEAD 가 그대로라, `lastHead === HEAD` 빠른길이 형제 조회보다 먼저 나가면 여기는 영원히 조용하다.');
  assert.ok(r.본문.includes(`../${path.basename(sib)}/${형제파일}`),
    `겹친 파일을 형제 좌표로 안 보여줬다 — 좌표가 어긋나면 대조가 전부 빗나가고 결과는 「0건」이다:\n${r.본문}`);
  assert.ok(r.본문.includes(`[${path.basename(sib)}]`),
    `어느 저장소의 커밋인지 안 밝혔다 — \`git show <sha>\` 를 내 저장소에서 돌리고 「없는 커밋」으로 끝난다:\n${r.본문}`);
  assert.ok(r.본문.includes(남sha.slice(0, 7)), `그 커밋 sha 가 없다:\n${r.본문}`);
});

test('🟢 형제 커밋이 **내 것**이면 안 운다 — 내 커밋마다 나를 경고하면 그 순간부터 안 읽힌다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const sib = 픽스처저장소();
  const 상태 = 상태폴더();
  const 형제파일 = 'lib/이벤트검증.js';
  커밋(dir, 'Code.js', 'a', 'init', 'sess-Z');
  커밋(sib, 형제파일, 'a', 'seed', 'sess-Z');

  훅(dir, { 절대파일: path.join(sib, 형제파일), 형제: [sib], sid: 'sess-A', stateDir: 상태 });
  커밋(sib, 형제파일, 'b', '내가 고쳤다', 'sess-A');            // 트레일러가 **나**다

  const r = 훅(dir, { 절대파일: path.join(sib, 형제파일), 형제: [sib], sid: 'sess-A', stateDir: 상태 });
  assert.ok(r.조용 || !r.본문.includes(형제파일),
    `내 형제 커밋을 남의 것이라 했다 — 트레일러 대조가 형제 쪽에서만 빠지면 이렇게 샌다:\n${r.본문}`);
});

test('🟢 형제를 **안 만진** 세션은 형제 커밋으로 울지 않는다 — 겹칠 수 없는 자리다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const sib = 픽스처저장소();
  const 상태 = 상태폴더();
  커밋(dir, 'Code.js', 'a', 'init', 'sess-Z');
  커밋(sib, 'tools/남의것.js', 'a', 'seed', 'sess-Z');

  훅(dir, { file: 'Code.js', 형제: [sib], sid: 'sess-A', stateDir: 상태 });   // 내 저장소 파일만 만진다
  커밋(sib, 'tools/남의것.js', 'b', '형제에서 남이 커밋', 'sess-B');

  const r = 훅(dir, { file: 'Code.js', 형제: [sib], sid: 'sess-A', stateDir: 상태 });
  assert.ok(r.조용 || !r.본문.includes('남의것.js'),
    `안 만진 형제 파일로 울었다 — 겹침 판정이 만진목록을 안 거쳤다는 뜻이다:\n${r.본문}`);
});

/* ── ⑤ **같은 트리**의 남의 살아있는 편집 (F221) ─────────────────────────────
 * 위 검사들은 전부 남의 **커밋**(①②③)이나 다른 **워크트리**(④)를 재고 있다. 그런데 이
 * 저장소의 세션은 대부분 작업 트리 **하나**를 공유하므로, 「남이 선언만 하고 아직 커밋 안 한」
 * 자리는 네 축을 다 지나간다 — 그리고 새는 방향은 「조용함」이다.
 *   실측 2026-08-08(F221 두 번째): F229 를 조사하고 `.claude/hooks/git-scope-guard.js` 를
 *   편집할 때까지 훅이 내내 조용했고, 1분 전 같은 파일을 잡은 세션은 눈으로 발견했다.
 * 🔑 탐지는 **픽스처**가 진다 — 실저장소에 기대면 CI 엔 산 세션이 없어 미실행이 초록이 된다. */
test('🔴 ⑤ 같은 트리의 남이 지금 들고 있는 파일을 만지면 알린다 (F221)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  /* 🔑 state 폴더를 **공유**한다. 세션마다 갈라 두면 서로의 track-*.json 을 못 봐서
   *   이 신호는 원리상 못 서고, 그 초록은 통과가 아니라 미실행이다. */
  const 공유 = 상태폴더();
  커밋(dir, '가드.js', 'let a = 1;\n', 'seed', 'sess-Z');

  훅(dir, { file: '가드.js', sid: 'sess-B', stateDir: 공유 });   // 남이 먼저 잡는다 — **커밋은 안 한다**
  const r = 훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 });

  assert.equal(r.조용, false,
    '남이 방금 잡은 파일을 만지는데 조용하다 — 커밋 축 셋과 워크트리 축 하나가 모두 비켜가는 자리다(F221)');
  assert.match(r.본문, /같은 트리의 다른 세션이 지금 들고 있다/);
  assert.match(r.본문, /sess-B/, '누가 들고 있는지를 안 주면 보드에서 그 트랙 줄을 찾을 수 없다');
  /* 🔑 이 픽스처의 파일은 **커밋된 그대로**다(디스크에 남의 바이트가 없다) — 그래서 알리기만 한다.
   *   F239 이후 차단 근거는 「누가 만졌나」가 아니라 「지금 미커밋인가」다(바로 아래 검사). */
  assert.equal(r.판정, undefined, '만지기만 하고 커밋을 마친 자리를 막았다 — 오차단이다');
});

/* ── F239 (2026-08-08 실사고): 신호는 정확했는데 **알림이라 편집을 못 세웠다** ────────
 * additionalContext 는 Edit **결과와 함께** 도착한다. 읽는 시점엔 내 바이트가 이미 남의 작업본에
 * 앉아 있었고, 그 파일은 `let` 이중 선언 SyntaxError 상태가 됐다 — 그 창에서 auto-commit 이
 * 돌았으면 훅이 죽은 판이 master 로 나간다. edit-stamp 도 못 막는다(그 지문은 진짜 내 것이다).
 * 그래서 고칠 자리는 탐지가 아니라 **출력**이었다. */
test('🔴 ⑤ 남의 미커밋이 디스크에 올라와 있으면 **막는다** — 알림은 편집을 못 세운다 (F239)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 공유 = 상태폴더();
  커밋(dir, '가드.js', 'let a = 1;\n', 'seed', 'sess-Z');

  훅(dir, { file: '가드.js', sid: 'sess-B', stateDir: 공유 });        // 남이 잡고
  fs.writeFileSync(path.join(dir, '가드.js'), 'let a = 1;\nlet a = 2;\n'); // 커밋 없이 디스크에 남겼다
  const r = 훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 });

  assert.strictEqual(r.판정, 'deny',
    '알리기만 했다 — 알림은 Edit **결과와 함께** 도착해 그때는 이미 내 바이트가 남의 작업본에 앉아 있다(F239)');
  assert.match(r.본문, /막았다/, '막았다는 사실을 본문이 안 말한다');
  assert.match(r.본문, /sess-B/, '누가 들고 있는지를 안 주면 보드에서 그 트랙 줄을 찾을 수 없다');
  /* 🔑 거절된 도구의 additionalContext 는 읽히지 않을 수 있다 — 사유 통로로 나가야 한다. */
  assert.match(r.요약, /막았다/, 'systemMessage 가 차단을 안 말한다 — 유호님 눈에는 이것만 보인다');
  assert.strictEqual(r.exit, 0, 'deny 는 종료코드가 아니라 JSON 으로 낸다');
});

/* 🔴 이 저장소에서 「만졌다」는 커밋을 마친 자리도 포함한다 — 라이브가 이 수정을 하는 편집에서
 *   바로 증명했다(방금 닫힌 앞 세션이 같은 파일을 커밋까지 끝냈는데 「지금 들고 있다」로 떴다).
 *   막는 축으로 바꾸면서 이 구분을 안 넣었으면 **모든 세션이 서로를 영구히 막았을 것**이다. */
test('🟢 ⑤ 만졌지만 커밋을 마친 자리는 **안 막는다** — 이 구분이 없으면 통째로 오차단이다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 공유 = 상태폴더();
  커밋(dir, '가드.js', 'let a = 1;\n', 'seed', 'sess-Z');

  훅(dir, { file: '가드.js', sid: 'sess-B', stateDir: 공유 });
  커밋(dir, '가드.js', 'let a = 2;\n', 'fix: 저쪽이 마쳤다', 'sess-B');   // 디스크가 깨끗해진다
  const r = 훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 });

  assert.notStrictEqual(r.판정, 'deny',
    `커밋을 마친 남의 자리를 막았다 — 되돌림 비용이 없는 자리다:\n${r.본문}`);
});

/* ⚠ 처방은 **따를 수 있어야** 한다(F103). 영구 차단이면 남는 탈출구가 BYPASS 뿐이고,
 *   그 손버릇은 진짜 사고도 통과시킨다. 그래서 파일당 1회만 막는다 — 다시 요청하는 것이
 *   「보드를 읽었고 다른 트랙임을 확인했다」는 의식적 확인이다. */
test('🔑 ⑤ 차단은 **파일당 1회** — 다시 요청하면 지나간다 (못 따를 처방은 우회를 가르친다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 공유 = 상태폴더();
  커밋(dir, '가드.js', 'let a = 1;\n', 'seed', 'sess-Z');

  훅(dir, { file: '가드.js', sid: 'sess-B', stateDir: 공유 });
  fs.writeFileSync(path.join(dir, '가드.js'), 'let a = 1;\nlet a = 2;\n');

  assert.strictEqual(훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 }).판정, 'deny', '전제가 깨졌다 — 첫 요청이 안 막혔다');
  assert.notStrictEqual(훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 }).판정, 'deny',
    '두 번째도 막았다 — 출구가 없으면 남는 건 BYPASS 뿐이고 그 손버릇이 진짜 사고를 통과시킨다(F103)');
});

test('⑤ 나 혼자면 조용하고, 알림은 파일당 1회다 (잔소리하는 장치는 안 읽힌다)', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 공유 = 상태폴더();
  커밋(dir, '가드.js', 'let a = 1;\n', 'seed', 'sess-Z');

  /* 🔑 **두 번** 부른다. 첫 호출엔 내 상태 파일이 아직 없어서 세션 목록이 비고, 그러면
   *   자기제외(`s.sid !== 내세션`)가 **한 번도 안 걸린 채** 초록이 된다 — 변이 시험이 그걸
   *   잡았다(제외를 지워도 통과했다). 두 번째 호출에서야 내 기록이 목록에 들어온다.
   *   이게 새면 증상은 「모든 세션이 두 번째 편집부터 자기 자신을 경고한다」이고, 그 순간
   *   이 훅은 통째로 안 읽히게 된다. */
  assert.equal(훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 }).조용, true,
    '나 혼자 만졌는데 울었다 — 내 세션을 남으로 셌다');
  assert.equal(훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 }).조용, true,
    '두 번째 편집에서 **나 자신**을 남으로 세어 울었다 — 자기제외가 빠진 자리다');

  훅(dir, { file: '가드.js', sid: 'sess-B', stateDir: 공유 });
  assert.match(훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 }).본문, /sess-B/);
  assert.equal(훅(dir, { file: '가드.js', sid: 'sess-A', stateDir: 공유 }).조용, true,
    '같은 파일을 두 번 울었다 — 알림 스로틀이 상태에 안 실렸다(`...s` 가 옛 값으로 덮어쓰는 자리)');
});

/* 🔴 라이브가 신설 직후 즉시 드러냈다: 첫 판은 보드 한 번 만지는데 **6줄**을 울었다(산 세션 수만큼).
 *   커밋 축은 이미 `장부` 면제를 갖고 있었는데 ⑤ 가 그걸 안 탄 것이고, 원인은 로직이 아니라
 *   **선언 위치**였다(그 const 가 ⑤ 아래라 TDZ). 목록을 두 벌로 만들지 않고 위로 올려 공유한다. */
test('🔴 ⑤ 공용 장부(보드)는 안 운다 — 모든 세션이 규약상 만지는 파일이다', (t) => {
  if (!있나) return t.skip('git 없음');
  const dir = 픽스처저장소();
  const 공유 = 상태폴더();
  커밋(dir, 'docs/세션보드.md', '| 줄 |\n', 'seed', 'sess-Z');

  훅(dir, { file: 'docs/세션보드.md', sid: 'sess-B', stateDir: 공유 });
  const r = 훅(dir, { file: 'docs/세션보드.md', sid: 'sess-A', stateDir: 공유 });

  assert.ok(r.조용 || !r.본문.includes('같은 트리의 다른 세션이 지금 들고 있다'),
    `보드 겹침으로 울었다 — 모든 세션이 종료 선언을 여기 쓰므로 산 세션 수만큼 울고, 그 순간 이 훅은 안 읽히게 된다:\n${r.본문}`);
});
