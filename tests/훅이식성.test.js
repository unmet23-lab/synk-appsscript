/**
 * 훅 이식성 회귀 (F044)
 *
 * 왜 있나 — 2026-08-04 실측: `.claude/settings.json`의 훅 등록 6건이 전부
 * 로컬 절대경로(`C:/Users/…`·`/c/Program Files/nodejs/node.exe`)를 박고 있어서
 * 클라우드 세션(claude.ai/code · 리눅스 샌드박스)에서는 가드 5종이 **전부 안 돌았다.**
 * 게다가 훅 파일 자체는 저장소에 있어 따라가므로 **있는 것처럼 보였고**,
 * 경로 부재는 비차단 오류라 **실패 방향이 「통과」**였다 — 통과와 미실행이 같은 모양.
 *
 * 이 파일이 지키는 것 3가지:
 *  ① 등록 명령에 로컬 절대경로가 다시 들어오지 않는다 (이식성)
 *  ② 가드를 실행할 수 없으면 **통과가 아니라 차단**한다 (실패 방향)
 *  ③ 가드가 가리키는 파일이 실제로 존재한다 (죽은 참조 금지)
 *
 * ⚠ ②의 탐지력은 「PATH를 비운 환경에서 정말 차단되는가」로 못박는다 —
 *    문구만 보는 검사는 표현이 바뀌면 같이 눈이 먼다.
 * ⚠ bash가 없는 환경에서는 행동 검사를 **skip으로 드러낸다**(조용한 통과 금지).
 *
 * 🔴 CI가 잡은 실결함(2026-08-04 · 이 파일의 존재 이유를 스스로 증명한 건):
 *    최초 수리본은 `IN=$(cat)`으로 stdin을 읽었는데 **`cat`은 외부 명령**이라
 *    PATH가 없는 환경에서는 가드 로직에 닿기도 전에 죽고, IN이 비어 `case`가 안 걸려
 *    **조용히 통과**했다 — 막으려던 실패 모드가 가드 첫 줄에 있었다.
 *    로컬(Git Bash)에서는 통과하고 **우분투 CI에서만 빨개졌다.**
 *    2차 시도 `$(</dev/stdin)`은 반대로 리눅스만 되고 **MSYS에 /dev/stdin이 없어** 윈도우가 깨졌다.
 *    최종 = `IFS= read -r -d '' IN || true` — 순수 빌트인이라 외부 명령 0.
 *    🔑 교훈: 가드의 실패 안전은 **외부 명령에 기대면 안 된다**(그게 없는 상황을 막으려는 것이므로).
 *
 * 🔬 변이 실측(2026-08-04) — 수리 이전 형태(로컬 절대경로·실패 절 없음)로 되돌린 사본에서
 *    9건 중 **6건이 빨개졌다**. 나머지 3건이 통과한 이유는 정직하게 적어 둔다:
 *      · 「범위 과잉 차단」·「저장소 경로 못 찾음」·「리눅스식 환경」은 **이 기계에 윈도우 경로가
 *        실제로 있어서** 옛 형태도 여기서는 돌기 때문이다. 즉 이 세 건은 **가드 동작**을 지키지
 *        **이식성**을 지키지 않는다 — 이식성의 탐지력은 위 3건(①②③)이 진다.
 *      · 리눅스 샌드박스를 이 기계에서 완전히 흉내낼 수는 없다. 진짜 증명은 폰 세션 실사용 1회다.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process'); // bash·셸 재현용 — 훅은 아래 통로로 띄운다
const { 훅띄우기 } = require('./lib/훅띄우기');

const ROOT = path.resolve(__dirname, '..');
// SYNK_TEST_SETTINGS = 변이 실험용 이음매. 평소엔 실저장소 설정을 본다.
// (탐지력은 「옛 형태로 되돌린 사본에서 빨개지는가」로 못박는다 — 실저장소를 흔들지 않고.)
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');

const settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
const allHooks = Object.entries(settings.hooks).flatMap(([event, groups]) =>
  groups.flatMap((g) => g.hooks.map((h) => ({ event, matcher: g.matcher || '-', command: h.command })))
);
const preToolUse = allHooks.filter((h) => h.event === 'PreToolUse');
const 훅이름 = (h) => (String(h.command).match(/hooks\/([a-z-]+)\.js/) || [])[1] || '';

/* ── 등록 명령에서 «실행되는 저장소 경로»를 뽑는 공용 통로 ──────────────
 * 두 검사(③ 죽은 참조 · ④ 스캔 범위)가 각자 정규식을 들고 있었고, 둘 다 같은 자리에서 샜다.
 * 판정을 두 곳에 적으면 갈라진다(CLAUDE.md) — 여기 하나에서 파생한다.
 *
 * 🔴 실측(2026-08-19 · `가드강등.js` 를 처음 실제로 켠 자리):
 *   그 도구는 훅 명령 **앞**에 존재 검사 한 조각을 끼운다 —
 *   `[ -f "${CLAUDE_PROJECT_DIR:-$PWD}/.claude/개원.json" ] || exit 0;`
 *   그런데 이 절이 가리키는 것은 **실행되는 스크립트가 아니라 플래그 파일**이고,
 *   미개원 동안 **없는 것이 정상**이다. 걷어내지 않으면 두 검사가 이것을 훅 스크립트로 오인한다.
 *   ③은 첫 매치 하나만 뽑던 탓에 **원래 보던 스크립트를 대신 잃었고**, ④는 `개원.json` 의
 *   `.js` 를 물어 `.claude/개원.js` 라는 있지도 않은 경로를 만들어냈다.
 *   ⚠ 새는 방향이 더 나쁘다 — 지금은 fail 로 드러나지만, 개원해서 그 파일이 **생기면**
 *     ③은 초록인 채 **훅 스크립트를 한 건도 안 본다**(맹점 ④ · 맞는 얼굴로 틀린 값).
 *
 * 파일명이 아니라 **형태**로 건다 — `|| exit 0` 으로 끝나는 존재 검사만 걷어내므로
 * 스위치가 다른 파일을 보도록 바뀌어도 따라온다. 가드 자신의 실패 안전 절
 * (`|| { … exit 2; }`)은 형태가 달라 걸리지 않는다. */
const 스위치절 = /\[\s+-f\s+"\$\{CLAUDE_PROJECT_DIR:-\$PWD\}\/[^"]*"\s+\]\s+\|\|\s+exit\s+0;\s*/g;
const 실행부 = (cmd) => String(cmd).replace(스위치절, '');

/* 명령이 실제로 실행하는 경로를 **전부** 뽑는다.
 * ⚠ 첫 매치만 뽑으면 명령이 두 경로를 참조할 때 나머지가 조용히 안 보인다 — 위 실측이 그 사례다. */
const 참조경로 = (cmd) =>
  [...실행부(cmd).matchAll(/\$\{CLAUDE_PROJECT_DIR:-\$PWD\}\/([^"'\s]+)/g)].map((m) => m[1]);

/* 정보성 훅 — **가드가 아니다.** 막는 게 목적이 아니라 알리는 게 목적이다.
 * 이런 훅에 「못 돌면 deny」를 걸면, 편의 기능 하나가 고장났다고 **모든 Edit/Write 가 막힌다.**
 * 그건 F044 가 막으려던 것(가드의 조용한 통과)과 다른 방향의 사고다.
 *
 * ⚠ 이 예외는 **선언만으로는 못 얻는다.** 바로 아래 검사가 「그 훅이 정말 판정을 안 내는지」를
 *   행동으로 확인한다 — 진짜 가드를 이 목록에 적어 넣으면 그 자리에서 빨간불이 난다.
 *   경고 경로까지 포함한 전체 증명은 tests/트랙충돌.test.js 가 진다.
 *
 * 🔴 track-collision 은 2026-08-08(F239)에 이 목록에서 **빠졌다** — ⑤ 축에서 실제로 deny 를
 *   내기 시작해 더는 정보성이 아니다. 되돌리면 그 훅 하나만 「실행 불가 = 통과」로 새고,
 *   새는 방향은 조용하다. 되돌림은 아래 두 검사가 **양쪽에서** 잡는다: 목록에 다시 넣으면
 *   「정보성인데 deny 절이 있다」로, 등록에서 deny 를 빼면 「deny 절이 없다」로 빨개진다. */
const 정보성 = new Set(['repo-staleness']);

// ── bash 탐색: 없으면 행동 검사를 skip으로 드러낸다 ─────────────────
// ⚠ 절대경로를 먼저 시도한다 — PATH를 비운 채 돌리는 검사가 있어서
//    `bash`(PATH 의존)로는 그 검사가 「셸을 못 찾음」으로 죽는다(실측 1회).
function findBash() {
  const candidates = [
    process.env.SYNK_TEST_BASH,
    'C:/Program Files/Git/bin/bash.exe',
    '/bin/bash',
    '/usr/bin/bash',
    'bash',
  ].filter(Boolean);
  for (const c of candidates) {
    const r = spawnSync(c, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return c;
  }
  return null;
}
const BASH = findBash();

function runHook(command, payload, env) {
  return spawnSync(BASH, ['-c', command], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env,
  });
}

// ── ① 이식성 ────────────────────────────────────────────────────────
test('훅 등록에 로컬 절대경로가 없다 (다른 기계·클라우드에서도 돈다)', () => {
  const offenders = allHooks.filter((h) => /C:\/Users\/|\/c\/Program Files\//i.test(h.command));
  assert.deepStrictEqual(
    offenders.map((o) => `${o.event}:${o.command.slice(0, 60)}`),
    [],
    '훅 명령에 로컬 절대경로가 박혔다 — 그 기계 밖에서는 가드가 통째로 죽는다(F044)'
  );
});

test('훅은 저장소 위치를 CLAUDE_PROJECT_DIR로 찾는다 (폴백은 cwd)', () => {
  for (const h of allHooks) {
    assert.match(
      h.command,
      /\$\{CLAUDE_PROJECT_DIR:-\$PWD\}/,
      `${h.event} 훅이 저장소 경로를 하드코딩했다: ${h.command.slice(0, 80)}`
    );
  }
});

test('node는 PATH에서 찾는다 (node.exe 하드코딩 금지)', () => {
  for (const h of allHooks) {
    assert.doesNotMatch(h.command, /node\.exe/, `${h.event} 훅이 node.exe를 하드코딩했다`);
    assert.match(h.command, /command -v node/, `${h.event} 훅이 node 존재를 확인하지 않는다`);
  }
});

// ── ② 실패 방향 ─────────────────────────────────────────────────────
test('PreToolUse 가드는 실행 불가 시 차단한다 (조용한 통과 금지)', () => {
  const 가드들 = preToolUse.filter((h) => !정보성.has(훅이름(h)));
  assert.ok(가드들.length >= 4, `가드가 ${가드들.length}건뿐 — 정보성 목록이 가드를 삼키고 있다`);
  for (const h of 가드들) {
    // 🔑 차단은 exit 2가 아니라 stdout JSON(permissionDecision:deny)이 실제 통로다 —
    //    2026-08-04 실측으로 확인했다(가드 본체도 이 방식으로 막는다). exit 2는 이중 안전.
    assert.match(
      h.command,
      /"permissionDecision":\\?"deny\\?"/,
      `${h.matcher} 가드에 「실행 불가 = deny」 절이 없다 — 통과와 미실행이 같은 모양이 된다`
    );
    assert.match(h.command, /exit 2/, `${h.matcher} 가드에 exit 2 이중 안전이 없다`);
  }
});

test('정보성 훅은 반대로 **차단하면 안 된다** — 그 예외를 행동으로 증명한다', () => {
  const 대상 = preToolUse.filter((h) => 정보성.has(훅이름(h)));
  assert.strictEqual(대상.length, 정보성.size,
    '정보성으로 선언했는데 PreToolUse 등록이 없다 — 목록이 낡았다(안 도는 훅을 면제하고 있다)');

  for (const h of 대상) {
    const 이름 = 훅이름(h);
    assert.ok(!/"permissionDecision":\\?"deny\\?"/.test(h.command),
      `${이름} 은 정보성인데 등록에 「실행 불가 = deny」 절이 있다 — 편의 기능이 작업을 세운다`);

    // 행동 확인 — 상태 폴더만 격리한다(저장소는 진짜를 봐야 판정 경로가 실제로 돈다).
    const 격리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-hookkind-'));
    // 통과코드를 넓게 둔다 — 「0 아닌 코드」는 **이 검사가 직접 말해야 할 결과**라 아래에서 잰다.
    //   통로는 그보다 앞의 「아예 안 떴다」만 걷어낸다(둘이 같은 모양이면 미실행이 초록이 된다).
    const r = 훅띄우기(path.join(ROOT, '.claude', 'hooks', `${이름}.js`), {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: path.join(ROOT, 'Code.js') } }),
      encoding: 'utf8',
      env: { ...process.env, SYNK_CTXBUDGET_DIR: 격리, CLAUDE_CODE_HOST_SESSION_ID: `hookkind-${process.pid}` },
      통과코드: [0, 1, 2],
    });
    try { fs.rmSync(격리, { recursive: true, force: true }); } catch (_) { /* 진행 */ }

    assert.strictEqual(r.status, 0, `${이름} 이 0 아닌 코드로 끝났다 — 정보성 훅이 작업을 세운다`);
    const out = (r.stdout || '').trim();
    if (out) {
      const d = JSON.parse(out).hookSpecificOutput?.permissionDecision;
      assert.strictEqual(d, undefined,
        `${이름} 이 permissionDecision(${d})을 냈다 — 정보성 예외를 쓸 자격이 없다`);
    }
  }
});

// ── ③ 죽은 참조 금지 ────────────────────────────────────────────────
test('훅이 가리키는 파일이 실제로 존재한다', () => {
  for (const h of allHooks) {
    const 경로들 = 참조경로(h.command);
    assert.ok(경로들.length, `${h.event} 훅에서 대상 파일 경로를 못 읽었다`);
    for (const p of 경로들) {
      assert.ok(fs.existsSync(path.join(ROOT, p)), `훅이 없는 파일을 가리킨다: ${p}`);
    }
  }
});

// ── 행동 검사 (탐지력) ──────────────────────────────────────────────
const SKIP = BASH ? false : 'bash 없음 — 이 환경에서는 행동 검사를 돌리지 않는다';
const SCOPE_CMD = () => preToolUse.find((h) => h.command.includes('git-scope-guard')).command;
const mk = (c) => ({ tool_name: 'Bash', tool_input: { command: c } });
// 차단 판정 = stdout에 permissionDecision:"deny" JSON이 나오는가(가드 본체와 같은 통로).
function decision(r) {
  const out = (r.stdout || '').trim();
  if (!out) return 'allow';
  return JSON.parse(out).hookSpecificOutput.permissionDecision;
}

test('행동: 범위 과잉 명령은 차단되고, 경로 지정 명령은 통과한다', { skip: SKIP }, () => {
  const cmd = SCOPE_CMD();
  const env = { ...process.env, CLAUDE_PROJECT_DIR: ROOT.replace(/\\/g, '/') };

  // 범위 과잉(F015 실사고의 그 명령) — 차단되어야 한다
  assert.strictEqual(
    decision(runHook(cmd, mk('git ' + 'add' + ' -A'), env)),
    'deny',
    '범위 과잉 명령이 차단되지 않았다 — 가드가 안 돈다'
  );

  // 경로 지정 — 통과해야 한다 (거짓양성 금지)
  assert.strictEqual(decision(runHook(cmd, mk('git ' + 'add' + ' docs/세션보드.md'), env)), 'allow', '정상 명령이 막혔다 — 거짓양성');

  // 무관한 명령 — 통과
  assert.strictEqual(decision(runHook(cmd, mk('ls -la'), env)), 'allow', '무관한 명령이 막혔다');
});

test('행동: node를 못 찾으면 통과가 아니라 차단이다 (F044의 핵심)', { skip: SKIP }, () => {
  // PATH를 비워 node를 못 찾게 만든다. command -v 는 셸 빌트인이라 PATH 없이도 동작한다.
  const r = runHook(SCOPE_CMD(), mk('git ' + 'add' + ' -A'), { PATH: '', CLAUDE_PROJECT_DIR: ROOT.replace(/\\/g, '/') });
  assert.strictEqual(decision(r), 'deny', 'node가 없을 때 가드가 조용히 통과했다 — 고치기 전 F044의 증상 그대로');
  assert.strictEqual(r.status, 2, 'exit 2 이중 안전이 안 걸렸다');
  assert.match(r.stderr || '', /가드 미실행/, '차단 사유가 사람에게 안 보인다');
});

test('행동: 저장소 경로를 못 찾으면 차단이다', { skip: SKIP }, () => {
  const r = runHook(SCOPE_CMD(), mk('git ' + 'add' + ' -A'), { ...process.env, CLAUDE_PROJECT_DIR: '/존재하지-않는-경로' });
  assert.strictEqual(decision(r), 'deny', '훅 파일을 못 찾을 때 조용히 통과했다');
});

test('행동: 리눅스식 환경(CLAUDE_PROJECT_DIR만·윈도우 경로 없음)에서도 가드가 산다', { skip: SKIP }, () => {
  // 클라우드 세션의 조건 모사 — 윈도우 절대경로가 존재하지 않아도 돌아야 한다.
  const env = { PATH: process.env.PATH, CLAUDE_PROJECT_DIR: ROOT.replace(/\\/g, '/') };
  assert.strictEqual(decision(runHook(SCOPE_CMD(), mk('git ' + 'add' + ' -A'), env)), 'deny', '최소 환경에서 가드가 죽었다');
});

/* ─── ④ 날문자(보이지 않는 제어문자) 금지 ──────────────────────────────────────
 * 왜 있나 — 2026-08-04 실측: 훅 두 곳이 구분자 상수를 **날문자 그대로** 들고 있었다.
 *   · code-edit-guard.js `공백표` = 0x01 · track-collision.js `SEP` = 0x1F
 *   둘 다 **바로 위 주석이 「반드시 이스케이프로 적는다」고 금지한** 형태다. 규칙은 있었고
 *   지키는 눈이 없었다.
 * 지워지면 어떻게 되나 — 새는 방향이 서로 다른데 둘 다 나쁘다:
 *   · 공백표가 빈 문자열 → `length !== 1` 방어가 걸려 **모든 Bash 명령이 막힌다**(전면 마비)
 *   · SEP 가 빈 문자열 → 커밋 제목이 글자 단위로 쪼개진다(**조용히** 틀린다)
 * 🔴 이 검사가 프로즈로 안 되는 증거 — 이 결함을 고치는 편집이 주석 안에 날문자를 **한 번 더**
 *    심었다. 편집 통로가 이스케이프 표기를 날문자로 바꿔 놨고 화면에는 아무 표시도 없었다.
 *    사람이 볼 수 없는 것을 사람에게 맡길 수 없다.
 * 탐지력은 픽스처로 못박고 실저장소에는 거짓양성만 검사한다(F023 — 회귀가 「버그가 아직
 * 있을 것」을 요구하면 고치는 순간 빨간불이 된다).
 */
const 허용제어 = new Set([9, 10, 13]); // 탭·LF·CR 만 정상

function 날문자들(원문) {
  const 결과 = [];
  원문.split(/\r?\n/).forEach((줄, i) => {
    for (const c of 줄) {
      const p = c.codePointAt(0);
      if (p < 32 && !허용제어.has(p)) 결과.push({ 줄: i + 1, 코드: p });
    }
  });
  return 결과;
}

/* 🔴 스캔 범위는 훅 디렉터리보다 넓어야 한다 (F158).
 *   SessionStart 훅으로 등록돼 **훅처럼 도는** 스크립트가 tools/ 에 산다
 *   (작업본소유자·rot-check·인계문수거·session-decisions 가 부르는 것들).
 *   실측: tools/작업본소유자.js 에 0x1F 를 심었을 때 이 검사가 조용히 통과시켰고,
 *   범위를 넓혀 재보니 tools/decision-queue.js 에 NUL 이 이미 하나 들어 있었다.
 *   「훅 폴더 밖」이라는 이유로 눈이 멀면 새는 방향은 언제나 통과다.
 *
 * 🔴 그래서 **폴더를 적지 않는다**(2026-08-07 2차 · cc51710).
 *   「.claude/hooks + tools」로 넓힌 판을 저장소 전량과 대조해 보니 실물 6자리 중 **5자리가
 *   그 밖**이었다 — `엔진_두뇌.js` 의 복합키 구분자 2건(**라이브 Apps Script 코드**)과
 *   `tests/브리지방.test.js` 픽스처 3건. 폴더를 손으로 적는 한 목록이 곧 다음 구멍이라,
 *   범위를 **git 이 아는 파일 전량**으로 둔다. 이러면 node_modules·.git·gitignore 된
 *   `.claude/worktrees`(이 저장소의 임시 사본)가 규칙 하나로 빠지고, 새 폴더가 생겨도
 *   커밋되는 순간 자동으로 대상이 된다.
 *   · `-z` 로 받는다 — core.quotepath 기본값이 한글 경로를 이스케이프해서 그대로 쓰면
 *     `tools/작업본소유자.js` 가 **없는 파일**이 되고, 없으면 조용히 통과다(F157 과 같은 함정).
 *   · git 이 없으면 **skip 으로 드러낸다** — 통과와 미실행이 같은 모양이면 안 된다. */
const 날문자스캔대상 = () => {
  const r = spawnSync('git', ['-C', ROOT, 'ls-files', '-z', '--', '*.js', '*.mjs', '*.cjs'],
    { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split('\u0000').filter(Boolean)
    .filter((상대) => fs.existsSync(path.join(ROOT, 상대)));   // 지웠지만 아직 스테이지 안 된 것
};

test('④ 추적되는 JS 소스에 날문자가 없다 (구분자 상수는 이스케이프 표기로)', (t) => {
  const 목록 = 날문자스캔대상();
  if (!목록) return t.skip('git ls-files 를 못 돌렸다 — 검사를 **안 돌렸다**(통과 아님)');

  const 위반 = [];
  for (const 상대 of 목록) {
    for (const v of 날문자들(fs.readFileSync(path.join(ROOT, 상대), 'utf8'))) {
      위반.push(`${상대}:${v.줄} = 0x${v.코드.toString(16).padStart(2, '0')}`);
    }
  }
  assert.deepStrictEqual(위반, [],
    'JS 소스에 날문자가 있다 — 이스케이프 표기(백슬래시 u 형태)로 바꾼다:\n  ' + 위반.join('\n  '));
});

/* 위 검사는 「위반 0건」과 「아무것도 안 봤다」가 같은 모양이다 — 범위를 따로 못박는다.
 * 탐지력(아래 양방향 검사)은 판정 함수를 재고, 이건 그 함수가 **어디에 닿는지**를 잰다. */
test('④ 스캔 범위 — 훅·도구·**라이브 엔진**·테스트에 다 닿는다 (F158)', (t) => {
  const 목록 = 날문자스캔대상();
  if (!목록) return t.skip('git ls-files 를 못 돌렸다 — 검사를 **안 돌렸다**(통과 아님)');
  const 대상 = new Set(목록);

  const 닿아야 = [
    ['tools/작업본소유자.js', 'SessionStart 훅으로 등록된 스크립트가 스캔 밖이다 — 여기가 F158 로 처음 샌 자리다'],
    ['.claude/hooks/track-collision.js', '넓히면서 원래 보던 곳을 잃었다 — 라우팅은 넓히되 버리지 않는다'],
    // 🔴 실물이 여기 있었다 — 복합키 구분자 2건. 라이브에 올라가는 코드다(.claspignore 가 엔진_*.js 를 허용한다).
    ['엔진_두뇌.js', '라이브 Apps Script 코드가 스캔 밖이다 — 실제 위반 2건이 나온 자리다(cc51710)'],
    // 픽스처가 날문자면 그 테스트는 자기가 무엇을 재는지 모른 채 초록이 된다.
    ['tests/브리지방.test.js', '테스트 픽스처가 스캔 밖이다 — 위반 3건이 나온 자리다(cc51710)'],
  ];
  for (const [경로, 사유] of 닿아야) assert.ok(대상.has(경로), `${사유}: ${경로}`);

  // 훅으로 등록된 스크립트는 **전부** 대상이어야 한다 — 목록을 손으로 적지 않으므로 자동으로 따라온다.
  const 등록된 = new Set();
  for (const h of allHooks) {
    // `\.js` 를 앵커 없이 걸면 `개원.json` 이 `개원.js` 로 잘려 **없는 경로가 만들어진다**(위 실측).
    for (const 경로 of 참조경로(h.command)) if (/\.js$/.test(경로)) 등록된.add(경로);
  }
  assert.ok(등록된.size >= 20,
    `등록 명령에서 스크립트 경로를 못 뽑았다(${등록된.size}건) — 표기가 바뀌었으면 이 검사부터 고친다`);
  /* 「범위 밖」의 사유는 둘인데 처방이 정반대다 — 갈라서 말한다.
   * F591 실측(2026-08-17): 새로 지은 훅이 **아직 미추적**이라 이 검사가 빨개졌는데 문구는
   * 「날문자 스캔 밖」이었다. 진짜 처방은 `git add` 인데 날문자를 찾으러 가게 만든다 —
   * 맞는 얼굴로 다른 것을 가리키는 자리다(CLAUDE.md 맹점 ④). 한쪽은 **미측정**이고
   * (파일은 멀쩡한데 아직 안 봤다 · F207) 다른 한쪽은 **죽은 등록**이다(파일이 없다 · F044). */
  const 밖 = [...등록된].filter((p) => !대상.has(p));
  const 미추적 = 밖.filter((p) => fs.existsSync(path.join(ROOT, p)));
  const 없는파일 = 밖.filter((p) => !fs.existsSync(path.join(ROOT, p)));

  assert.deepStrictEqual(없는파일, [],
    '훅으로 등록된 스크립트가 **저장소에 없다** — 등록이 죽은 경로를 가리킨다.\n'
    + '  그 훅은 매번 미실행이고, 미실행이 새는 방향은 언제나 「통과」다(F044·F053):\n  ');
  assert.deepStrictEqual(미추적, [],
    '훅으로 등록된 스크립트가 **아직 git 에 안 올라갔다** — 날문자 검사가 이 파일을 «안 본다».\n'
    + '  위반이 아니라 **미측정**이다(F207·F591) — 고칠 것은 파일 내용이 아니라 추적 상태다.\n'
    + '  → `git add -- <경로>` 하면 그 자리에서 대상이 된다:\n  ');
});

test('④ 탐지력 — 날문자는 잡고, 이스케이프 표기는 안 잡는다(양방향)', () => {
  const 날 = String.fromCharCode(1);
  const 백슬래시 = String.fromCharCode(92);
  const 따옴표 = String.fromCharCode(39);

  // 잡아야 하는 쪽 — 고치기 전의 그 형태 그대로
  const 깨진판 = `const 공백표 = ${따옴표}${날}${따옴표};`;
  assert.strictEqual(날문자들(깨진판).length, 1, '날문자를 못 잡는다 — 검사가 장식이다');

  // 잡으면 안 되는 쪽 — 고친 뒤의 형태(거짓양성이면 다음 사람이 검사를 끈다)
  const 고친판 = `const 공백표 = ${따옴표}${백슬래시}u0001${따옴표};`;
  assert.deepStrictEqual(날문자들(고친판), [], '이스케이프 표기를 위반으로 셌다 — 거짓양성');

  // 탭·개행은 소스에 정상적으로 있다
  const 평범 = 'a' + String.fromCharCode(9) + 'b' + String.fromCharCode(10) + 'c';
  assert.deepStrictEqual(날문자들(평범), [], '탭·개행을 위반으로 셌다 — 저장소 전체가 빨개진다');
});

/* ── 위 두 검사의 «탐지력» — 픽스처로 못박는다 ──────────────────────────
 * 실저장소만 보면 「위반 0건」과 「아무것도 못 뽑았다」가 같은 초록이다(F207).
 * 여기서는 **뽑아야 할 것을 뽑는지**와 **죽은 경로를 여전히 잡는지**를 양쪽으로 잰다.
 *
 * 대가(CLAUDE.md — 새 장치엔 함께 적는다):
 *  · 틀릴 때의 모습 = 스위치 표기가 바뀌면 `실행부` 가 못 걷어내고 ③이 다시 플래그 파일을
 *    스크립트로 오인한다. 그 순간 아래 ⑥이 fail 로 먼저 운다 — 조용히 새지 않는다.
 *  · 닫은 것 = ③·④가 각자 들고 있던 경로 정규식 2개를 `참조경로` 하나로 합쳤다(갈라짐 제거).
 */
test('🔑 참조경로 — 스위치가 껴도 진짜 스크립트를 계속 본다 (2026-08-19 실측 회귀)', () => {
  const P = '${CLAUDE_PROJECT_DIR:-$PWD}/';
  const 스위치 = '[ -f "' + P + '.claude/개원.json" ] || exit 0; ';
  const 본체 = 'H="' + P + '.claude/hooks/board-guard.js"; node "$H"';

  // ① 스위치가 껴도 본체 경로를 잃지 않는다 — 이게 깨지면 검사가 초록인 채 0건을 본다.
  assert.deepStrictEqual(참조경로(스위치 + 본체), ['.claude/hooks/board-guard.js']);

  // ② 스위치 유무가 판정을 바꾸지 않는다.
  assert.deepStrictEqual(참조경로(스위치 + 본체), 참조경로(본체));

  // ③ 명령이 두 경로를 참조하면 **둘 다** 뽑는다 (첫 매치만 보던 결함).
  assert.deepStrictEqual(
    참조경로('A="' + P + 'tools/가.js"; B="' + P + 'tools/나.js"'),
    ['tools/가.js', 'tools/나.js']);

  // ④ 탐지력이 줄지 않았다 — 죽은 경로는 그대로 뽑혀 나온다(그래야 ③ 검사가 fail 을 낸다).
  assert.deepStrictEqual(참조경로('node "' + P + '.claude/hooks/없는훅.js"'),
    ['.claude/hooks/없는훅.js']);

  // ⑤ 가드 자신의 실패 안전 절(`|| { … exit 2; }`)은 걷어내지 않는다 — 형태가 다르다.
  const 실패안전 = '{ command -v node >/dev/null && [ -f "$H" ]; } || { exit 2; }; ';
  assert.deepStrictEqual(참조경로(실패안전 + 본체), ['.claude/hooks/board-guard.js']);

  // ⑥ 스위치 절이 실제로 걷혔는지 — 표기가 바뀌면 여기가 먼저 운다.
  assert.ok(!실행부(스위치 + 본체).includes('개원'),
    '스위치 절이 안 걷혔다 — 등록 표기가 바뀌었으면 `스위치절` 정규식부터 고친다');

  // ⑦ `.json` 이 `.js` 로 둔갑하지 않는다 — ④ 스캔 범위가 없는 경로를 지어내던 결함.
  assert.deepStrictEqual(참조경로(스위치).filter((p) => /\.js$/.test(p)), []);
});
