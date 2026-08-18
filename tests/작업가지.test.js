'use strict';
/**
 * 작업가지 회귀 — PR 층이 «조용히» 망가지는 자리를 잡는다.
 *
 * ■ 이 파일이 지키는 네 문장
 *   ① **모듈을 여는 것만으로 PR 이 열리면 안 된다.** 회귀가 저장소에 PR 을 싸지르는 것은
 *      검사가 아니라 사고다(`require.main` 가드).
 *   ② **머지는 절대 squash·rebase 가 아니다.** squash 는 커밋마다 박힌 `Session-Id`
 *      트레일러를 한 줄로 뭉개고, 이 저장소는 커밋 주인을 그 트레일러로만 가른다(F041).
 *      주인을 못 가르면 F073(남의 미커밋 섞임)이 통째로 되살아난다. rebase 는 SHA 를
 *      바꿔 보드·메모리에 적힌 커밋 참조를 죽인다. **여기서 새면 티가 안 난다** —
 *      머지는 성공하고, 잃은 것은 몇 주 뒤에야 보인다.
 *   ③ **훅은 스로틀한다.** 세션 시작 비용은 세션 수만큼 곱해진다(#Q95 가 잰 자리).
 *   ④ **못 읽음을 0건으로 바꾸지 않는다.** 「열린 PR 0건」과 「못 읽었다」가 같은 모양이면
 *      갇힌 작업이 있는 날에 화면이 조용하다 — 그게 이 층이 막으려던 병 그 자체다(F207).
 *
 * ■ 안 재는 것 (정직하게)
 *   🚫 실제 GitHub 왕복(PR 생성·머지) — 자격·네트워크가 필요해 CI 에서 깨진다(F296).
 *      탐지는 아래 픽스처와 소스 계약이 진다. 왕복은 사람이 한 번 실측하고 보드에 적는다.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 가지 = require('../tools/작업가지.js');
const 소스경로 = path.join(__dirname, '..', 'tools', '작업가지.js');
const 소스 = fs.readFileSync(소스경로, 'utf8');

/** 주석을 벗긴 «실제로 도는 코드»만 본다.
 *  🔑 F490 이 가르친 것: 사고를 적은 주석이 금지 문자열을 인용하는 순간 검사가 빨개지고,
 *     그러면 그 검사는 「사고를 기록하지 마라」를 가르친다. 그래서 벗기고 본다 —
 *     그리고 **벗기기가 죽었는지도 함께 잰다**(아래 ⑧). */
const { 코드만 } = require('./lib/소스검사.js');
const 코드 = 코드만(소스);

// ── ① 부작용 없음 ───────────────────────────────────────────────────────────
test('① 모듈을 여는 것만으로 PR 을 열거나 머지하지 않는다', () => {
  assert.match(소스, /require\.main === module/,
    'CLI 진입이 require.main 으로 안 감싸여 있다 — 테스트가 실제로 PR 을 연다');
  assert.equal(typeof 가지.열린것따기, 'function', '조회를 밖에서 못 부른다');
});

// ── ② 머지 방식 계약 ────────────────────────────────────────────────────────
test('② 머지는 --merge 다 — squash·rebase 는 Session-Id 트레일러/SHA 를 죽인다', () => {
  assert.ok(/'--merge'/.test(코드), '머지 방식이 --merge 로 고정돼 있지 않다');
  assert.ok(!/--squash/.test(코드),
    'squash 가 들어왔다 — 커밋마다의 Session-Id 트레일러가 한 줄로 뭉개져 F041(주인 판별)이 죽는다');
  assert.ok(!/'--rebase'/.test(코드),
    'rebase 가 들어왔다 — SHA 가 바뀌어 보드·메모리에 적힌 커밋 참조가 통째로 죽는다');
});

test('③ --delete-branch 를 안 쓴다 — 실패가 머지 성공을 가리는 자리다', () => {
  /* 세션이 아직 그 가지 «위에» 서 있으므로 로컬 가지 삭제는 반드시 실패한다.
     그 실패를 gh 가 비영으로 돌려주면 「머지는 됐는데 도구는 죽었다」가 되고,
     다음 세션은 머지 여부를 모른 채 같은 작업을 다시 집는다. */
  assert.ok(!/--delete-branch/.test(코드),
    '--delete-branch 가 들어왔다 — 로컬 가지 삭제 실패가 머지 성공을 가린다');
  assert.ok(/git\/refs\/heads\//.test(코드), '원격 ref 를 따로 거두는 길이 없다 — 가지가 목록에 계속 남는다');
});

// ── ④ 못 읽음 ≠ 0건 ─────────────────────────────────────────────────────────
test('④ 못 읽으면 null 이지 빈 배열이 아니다 (F207 — 미실행이 통과와 같은 모양이면 안 된다)', () => {
  /* 실제 gh 를 안 부르고 계약만 본다: 실패 갈래가 `return null` 이어야 한다. */
  const 몸통 = 코드.slice(코드.indexOf('function 열린것따기'), 코드.indexOf('function 캐시나이_분'));
  assert.match(몸통, /if \(!r\.성공\) return null/, '조회 실패가 null 로 안 떨어진다');
  assert.match(몸통, /catch[\s\S]{0,40}return null/, '응답 파싱 실패가 null 로 안 떨어진다');
});

test('⑤ 그리기가 null 과 0건을 다르게 말한다', () => {
  const 몸통 = 코드.slice(코드.indexOf('function 그리기'), 코드.indexOf('function 훅'));
  assert.match(몸통, /목록 === null/, 'null 갈래가 없다 — 못 읽은 날이 조용한 날과 같은 모양이 된다');
  assert.match(몸통, /0건이 아니다|못 읽었다/, 'null 일 때 「0건이 아니다」를 말하지 않는다');
});

// ── ⑥ 스로틀 ────────────────────────────────────────────────────────────────
test('⑥ 캐시 나이 — 없으면 null(=모름)이고, 부르는 쪽은 그때 딴다', () => {
  const 없는것 = path.join(os.tmpdir(), `synk-작업가지-없는캐시-${process.pid}.json`);
  fs.rmSync(없는것, { force: true });
  assert.equal(가지.캐시나이_분(없는것), null, '없는 캐시가 null 이 아니다 — 모름이 신선함으로 바뀐다');

  const 있는것 = path.join(os.tmpdir(), `synk-작업가지-시험캐시-${process.pid}.json`);
  fs.writeFileSync(있는것, '[]', 'utf8');
  try {
    const 나이 = 가지.캐시나이_분(있는것);
    /* ⚠ `>= 0` 을 요구하지 않는다 — 방금 쓴 파일의 mtime 이 `Date.now()` 보다 몇 ms **앞설 수**
       있어(윈도우 타임스탬프 반올림) 그 검사는 무작위로 빨개진다. 실제로 변이 통로의 기준선이
       이 플레이크를 먼저 잡았다(2026-08-16). 계약은 부호가 아니라 **「신선하다」**다. */
    assert.ok(나이 !== null && 나이 < 1, `방금 쓴 캐시가 신선하다고 안 나온다: ${나이}`);
  } finally {
    fs.rmSync(있는것, { force: true });
  }
});

test('⑦ 훅이 스로틀을 실제로 «쓴다» — 상수만 두고 안 쓰면 조용히 매번 조회한다', () => {
  const 몸통 = 코드.slice(코드.indexOf('function 훅()'), 코드.indexOf('function 진입'));
  assert.match(몸통, /신선_분/, '훅이 스로틀 상수를 안 읽는다');
  assert.match(몸통, /나이 < 신선_분/, '나이를 간격과 대조하는 자리가 없다');
  assert.match(몸통, /캐시경로/, '훅이 캐시를 안 쓴다 — 매 세션 왕복한다');
  /* 캐시가 저장소 «밖»이어야 한다 — 안이면 그게 네 번째 장부다(㉢Issues 기각 사유 그대로). */
  assert.ok(가지.캐시경로.startsWith(os.tmpdir()), '캐시가 저장소 안에 있다 — 새 장부가 하나 는다');
});

// ── ⑦-b 밀림 경보 (F502) ────────────────────────────────────────────────────
/** 픽스처 저장소 — 실저장소의 그날 상태에 기대면 CI 에서 깨진다(F296). */
function 픽스처저장소() {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-밀림-'));
  const g = (...a) => require('node:child_process').spawnSync('git', a, { cwd: 뿌리, encoding: 'utf8' });
  g('init', '-q', '-b', 'master');
  g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  g('commit', '-q', '--allow-empty', '-m', '바탕');
  /* origin/master 를 «수동으로» 만든다 — 진짜 리모트 없이 ahead 를 만들 수 있다.
     (네트워크·자격에 기대는 검사는 CI 에서 깨진다) */
  g('update-ref', 'refs/remotes/origin/master', 'HEAD');

  /* ⚠ **시각을 명시로 벌린다.** 처음엔 그냥 `n` 개를 연달아 찍었는데, 전부 같은 초에 생겨
     `min`(가장 오래된 것)과 `max`(가장 최근)가 **값이 같았다** — 그래서 둘을 바꿔치기하는
     변이가 통과했다(2026-08-16 변이 ⑦ 이 잡은 구멍). 나이를 재는 검사의 픽스처는
     나이가 실제로 갈려 있어야 한다. */
  const 커밋 = (몇시간전들) => {
    for (const h of 몇시간전들) {
      const iso = new Date(Date.now() - h * 3600000).toISOString();
      require('node:child_process').spawnSync('git',
        ['commit', '-q', '--allow-empty', '-m', `c-${h}h`],
        { cwd: 뿌리, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso } });
    }
  };
  return { 뿌리, 커밋 };
}

test('⑦-b 밀림 — 안 밀린 커밋을 «센다», 그리고 못 세면 0 이 아니라 null 이다', () => {
  const { 뿌리, 커밋 } = 픽스처저장소();
  try {
    assert.equal(가지.안밀린것(뿌리).수, 0, '갓 만든 저장소가 0 이 아니다');
    커밋([5, 1]);                                   // 5시간 전 · 1시간 전
    assert.equal(가지.안밀린것(뿌리).수, 2, 'ahead 를 못 센다');

    /* 🔑 보고해야 하는 것은 **가장 오래된 것**이다 — 「제일 최근 커밋이 1시간 전」은
       위험을 축소해 읽게 만든다. 5 와 1 을 벌려 두었으니 둘을 바꾸면 여기서 깨진다. */
    const { 최고령_시간 } = 가지.안밀린것(뿌리);
    assert.ok(최고령_시간 !== null && Math.abs(최고령_시간 - 5) < 0.5,
      `최고령이 «가장 오래된 것»(≈5시간)이 아니다: ${최고령_시간}`);

    /* 저장소가 아닌 곳 = **못 잰 것**이다. 여기서 0 을 주면 사고가 난 날에 조용해진다. */
    const 빈곳 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-비저장소-'));
    try {
      assert.equal(가지.안밀린것(빈곳).수, null, '저장소가 아닌데 «0건»이라고 답한다 — 모름을 안전으로 바꿨다');
    } finally { fs.rmSync(빈곳, { recursive: true, force: true }); }
  } finally {
    fs.rmSync(뿌리, { recursive: true, force: true });
  }
});

test('⑦-c 밀림 문턱은 실측값이고, 경보가 스로틀 «밖»에 있다', () => {
  /* 문턱을 발명하면 아무도 안 믿는다 — reflog 실측 p99=29 에서 왔다는 근거가 소스에 남아야 한다. */
  assert.equal(가지.안밀린_문턱, 30, '문턱이 실측값(30)에서 벗어났다 — 바꾸려면 다시 재고 근거를 갱신한다');
  assert.match(소스, /p99 \*\*29\*\*|p99 29/, '문턱의 근거(실측 분포)가 소스에서 사라졌다');

  /* 🔴 경보가 스로틀 안으로 들어가면 **사고가 난 그 세션에서 조용해진다** — 캐시가 신선한
     동안 return 해 버리기 때문이다. 네트워크 0 이라 아낄 것도 없다. */
  const 훅몸통 = 코드.slice(코드.indexOf('function 훅()'), 코드.indexOf('function 진입'));
  const 경보위치 = 훅몸통.indexOf('밀림경보()');
  const 스로틀위치 = 훅몸통.indexOf('나이 < 신선_분');
  assert.ok(경보위치 >= 0, '훅이 밀림 경보를 안 부른다');
  assert.ok(경보위치 < 스로틀위치, '밀림 경보가 스로틀 뒤에 있다 — 캐시가 신선한 세션에서 조용해진다');

  /* gh 가 죽어도 경보는 살아야 한다 — 가드가 서로를 끌어내리면 안 된다. */
  const 진입몸통 = 코드.slice(코드.indexOf('function 진입'));
  assert.match(진입몸통, /gh\(\['--version'\]\)\.성공\) \{ 밀림경보\(\); return; \}/,
    'gh 가 없을 때 밀림 경보까지 같이 꺼진다');
});

test('⑦-d 밀림 경보가 원격 기준의 «나이»를 자기가 다시 구현하지 않는다 (신뢰성 ④)', () => {
  const 몸통 = 코드.slice(코드.indexOf('function 밀림경보'), 코드.indexOf('function 나이_시간'));
  assert.match(몸통, /작업본소유자.*fetch나이_분/s, 'fetch 나이 판정을 공용 통로에서 안 가져온다');
  assert.ok(!/FETCH_HEAD/.test(코드), 'FETCH_HEAD 를 여기서 직접 읽는다 — 같은 판정이 두 곳에 앉는다');
  /* 그 통로가 실제로 그 이름을 내주는지도 본다 — 안 내주면 위 require 가 런타임에 죽는다. */
  assert.equal(typeof require('../tools/작업본소유자.js').fetch나이_분, 'function',
    '작업본소유자가 fetch나이_분 을 export 하지 않는다 — 경보가 조용히 기준을 못 적는다');
});

// ── ⑧ 검사 자신의 눈 ────────────────────────────────────────────────────────
test('⑧ 주석 벗기기가 살아 있다 — 죽으면 위 검사들이 통째로 눈이 먼다', () => {
  /* 벗기기가 조용히 «아무것도 안 벗기게» 되면 ②③ 이 주석 속 인용까지 읽어 거짓양성을 내고,
     반대로 «전부 벗기게» 되면 진짜 코드를 못 봐서 거짓음성을 낸다. 양쪽을 다 못박는다. */
  assert.equal(코드만('a /* --squash */ b').trim().replace(/\s+/g, ' '), 'a b', '블록 주석을 못 벗긴다');
  assert.equal(코드만('const x = 1; // --squash').trim(), 'const x = 1;', '줄 주석을 못 벗긴다');
  assert.match(코드만("gh(['pr','merge','--merge'])"), /--merge/, '코드까지 벗겨 버린다 — 거짓음성이 난다');
  assert.ok(코드.length > 500, `벗긴 코드가 너무 짧다(${코드.length}자) — 전부 날아갔다`);
});

// ── ⑨ 자기 처방을 막지 않는가 (F103) ────────────────────────────────────────
test('⑨ 차단 사유가 «따를 수 있는» 처방을 준다', () => {
  /* 차단만 하고 나갈 길을 안 주면 우회가 정상 통로가 된다(F103).
     🔑 **거절마다 따로 본다.** 처음엔 `열기` 함수를 통째로 슬라이스해 EnterWorktree 를 찾았는데,
        같은 함수의 detached 거절이 그 낱말을 이미 물고 있어서 **master 거절의 처방을 통째로
        지워도 초록이었다**(2026-08-16 변이 ⑦ 이 잡은 구멍). 넓게 자르면 그만큼 눈이 먼다. */
  const 자르기 = (from, to) => {
    const a = 코드.indexOf(from);
    const b = 코드.indexOf(to, a + 1);
    assert.ok(a >= 0 && b > a, `소스에서 «${from}» ~ «${to}» 구간을 못 찾았다 — 검사가 눈이 멀었다`);
    return 코드.slice(a, b);
  };

  assert.match(자르기('if (가지 === 기본가지)', 'if (!제목)'), /EnterWorktree/,
    'master 거절이 「그럼 뭘 하라」를 안 말한다');
  assert.match(자르기('detached HEAD', '기본가지'), /EnterWorktree/,
    'detached 거절이 처방을 안 준다');
  assert.match(자르기("앞선.출력 === '0'", 'const 밀기'), /git add --/,
    '커밋 0 거절이 실제 명령을 안 준다');
});

// ── ⑩ 두 곳에 안 적는다 ────────────────────────────────────────────────────
test('⑩ 워크트리 생성·clasp 차단을 여기서 다시 구현하지 않는다 (신뢰성 ④)', () => {
  /* ⚠ **이 저장소가 실제로 쓰는 표기로 검사한다**(맹점 ①). 처음엔 `/worktree\s+add/` 로 찾았는데
     여기서 git 은 «배열 인자»로 부르므로 실제 코드는 `['worktree', 'add', …]` 다 — 셸 문자열이
     아니라서 그 정규식은 한 글자도 안 맞았고, 워크트리 생성을 심어도 초록이었다
     (2026-08-16 변이 ⑧ 이 잡은 구멍). 그래서 낱말 하나로 좁힌다. */
  assert.ok(!/'worktree'/.test(코드),
    '워크트리를 직접 만든다 — 하네스 EnterWorktree 와 같은 판정이 두 곳에 앉아 갈라진다');
  assert.ok(!/clasp/.test(코드),
    'clasp 판정이 들어왔다 — 그건 clasp-guard 0번 검사가 이미 진다(08-01 실측)');
});

// ── ⑪~⑬ 실패 사유 (F580) ───────────────────────────────────────────────────
/** 화면으로 나간 것을 그대로 받는다 — 「말했나」를 재는 검사는 말을 실제로 잡아야 한다. */
function 찍힌것(fn) {
  const 원래 = console.log;
  const 줄 = [];
  console.log = (...a) => 줄.push(a.map(String).join(' '));
  try { fn(); } finally { console.log = 원래; }
  return 줄.join('\n');
}

test('⑪ 실패 사유는 «절대» 빈 문자열이 아니다 (F580 — 사유 칸이 비면 화면에 단서가 0이다)', () => {
  /* 🔑 spawnSync 의 timeout 은 자식을 죽여서 끝낸다 — status=null 이고 stderr 가 0바이트일 수 있다.
     옛 코드는 그 자리를 stderr 하나로만 채워 `🔴 못 밀었다 — ` 를 냈다(실측 2026-08-17 · 15분 소모). */
  const 빈판 = 가지.실패사유({ stdout: '', stderr: '', status: null, signal: 'SIGTERM' }, 30000);
  assert.ok(빈판.trim(), 'stderr 0바이트 + status null 인데 사유가 비었다 — 그게 정확히 F580 이다');
  assert.match(빈판, /SIGTERM/, '무엇이 죽였는지를 안 적는다');

  const 시간초과 = 가지.실패사유(
    { stdout: '', stderr: '', status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT', message: 'timed out' } }, 30000);
  assert.match(시간초과, /ETIMEDOUT/, '타임아웃 코드를 안 적는다');
  assert.match(시간초과, /매달린/, '「막힌 것」과 「매달린 것」을 안 가른다 — 둘은 처방이 다르다');
  assert.match(시간초과, /30초/, '몇 초 제한에 걸렸는지를 안 적는다 — 다음 사람이 제한을 못 고른다');

  /* stderr 도 error 도 signal 도 없는 판(=순수 비영 종료)에서도 비면 안 된다. */
  const 코드만 = 가지.실패사유({ stdout: '', stderr: '', status: 128 }, 30000);
  assert.match(코드만, /128/, '종료코드조차 안 적는다');
});

test('⑫ 자격증명 자리를 지목하고, 우회는 «빈 헬퍼 먼저»다 (F580·F581)', () => {
  /* 실측된 stderr 원문 그대로 넣는다 — 사람이 실제로 보는 표기로 검사한다(맹점 ①). */
  for (const 원문 of [
    "fatal: could not read Username for 'https://github.com'",
    'fatal: User cancelled dialog.',
    'bash: line 1: /dev/tty: No such device or address',
    'error: failed to execute prompt script',
  ]) {
    assert.ok(가지.자격증명_흔적.test(원문), `실측된 자격증명 실패 원문을 못 알아본다: ${원문}`);
  }
  /* 거짓양성 방향도 본다 — 아무 실패나 자격증명으로 몰면 진짜 사유가 가려진다. */
  assert.ok(!가지.자격증명_흔적.test('! [rejected] master -> master (non-fast-forward)'),
    '갈라짐 실패를 자격증명으로 오진한다 — 처방이 통째로 빗나간다');

  const 처방 = 가지.밀기처방({ 오류: "fatal: could not read Username for 'https://github.com'" }, '내가지');
  assert.match(처방, /gh auth git-credential/, '살아 있는 통로(gh 헬퍼)를 안 준다');
  assert.match(처방, /credential\.helper=\s/, '빈 헬퍼로 GCM 을 먼저 지우는 수가 빠졌다 — 물려받은 헬퍼가 그대로 다시 매달린다');

  /* 시간초과만 있고 문구가 없는 판도 같은 자리로 보내야 한다 — 매달림은 아무 말도 안 남긴다. */
  assert.match(가지.밀기처방({ 오류: '종료코드 없음 · stderr 0바이트', 시간초과: true }, '내가지'),
    /gh auth git-credential/, '매달림(사유 문구 0)을 자격증명 자리로 안 보낸다');

  /* 그 외 실패는 일반 처방이되 **비어 있지 않아야** 한다. */
  const 일반 = 가지.밀기처방({ 오류: '! [rejected] (non-fast-forward)' }, '내가지');
  assert.ok(일반.trim() && !/gh auth git-credential/.test(일반), '일반 실패에까지 자격증명 처방을 낸다');

  /* 우회 인자의 **순서가 규약이다** — 빈 값이 뒤에 오면 gh 헬퍼를 도로 지운다. */
  const 빈칸 = 가지.우회_인자.indexOf('credential.helper=');
  const gh칸 = 가지.우회_인자.indexOf('credential.helper=!gh auth git-credential');
  assert.ok(빈칸 >= 0 && gh칸 > 빈칸, '우회 인자 순서가 틀렸다 — 빈 헬퍼가 gh 헬퍼보다 뒤에 있다');
});

test('⑬ push 는 전부 «한 통로»를 지난다 — 옛 통로가 남으면 그 자리만 조용히 빈 사유를 낸다', () => {
  const 자르기 = (from, to) => {
    const a = 코드.indexOf(from);
    const b = 코드.indexOf(to, a + 1);
    assert.ok(a >= 0 && b > a, `소스에서 «${from}» ~ «${to}» 구간을 못 찾았다 — 검사가 눈이 멀었다`);
    return 코드.slice(a, b);
  };
  const 열기몸통 = 자르기('function 열기', 'function 닫기');
  const 닫기몸통 = 자르기('function 닫기', 'function 워크트리거두기처방');

  for (const [이름, 몸통] of [['열기', 열기몸통], ['닫기', 닫기몸통]]) {
    assert.match(몸통, /가지밀기\(/, `${이름} 가 공용 push 통로를 안 쓴다`);
    assert.ok(!/git\(\['push'/.test(몸통),
      `${이름} 에 직접 push 가 남아 있다 — 그 자리만 우회도 사유도 없이 조용히 죽는다`);
    assert.match(몸통, /밀기처방\(/, `${이름} 의 push 실패가 처방 없이 죽는다(F103)`);
  }

  /* 우회는 **한 번뿐**이다 — 매달리는 통로에서 재시도를 늘리면 벽시계가 배로 는다. */
  const 밀기몸통 = 자르기('function 가지밀기', 'function 밀기처방');
  assert.equal((밀기몸통.match(/우회_인자/g) || []).length, 1,
    '우회를 두 번 이상 시도한다 — 매달림이면 벽시계가 그만큼 곱해진다');
});

// ── ⑭~⑯ 갈라진 master (F577) ───────────────────────────────────────────────
/** 앞 1 · 뒤 1 = **못 미는** 상태. 네트워크 0 으로 만든다(F296 — repo 밖에 기대면 CI 에서 깨진다). */
function 갈라진픽스처() {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-갈라짐-'));
  const g = (...a) => require('node:child_process').spawnSync('git', a, { cwd: 뿌리, encoding: 'utf8' });
  g('init', '-q', '-b', 'master');
  g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  g('commit', '-q', '--allow-empty', '-m', '바탕');
  g('checkout', '-q', '-b', '원격판');
  g('commit', '-q', '--allow-empty', '-m', '원격만 가진 것');
  g('update-ref', 'refs/remotes/origin/master', 'HEAD');   // 진짜 리모트 없이 origin/master 를 세운다
  g('checkout', '-q', 'master');
  g('commit', '-q', '--allow-empty', '-m', '나만 가진 것');
  return 뿌리;
}

test('⑭ 갈라진 master 는 «문턱과 무관하게» 운다 (F577 — 실측 앞 7·뒤 57 인데 두 눈금 다 초록이었다)', () => {
  const 뿌리 = 갈라진픽스처();
  try {
    const { 수 } = 가지.안밀린것(뿌리);
    assert.equal(수, 1, '픽스처가 «앞 1» 이 아니다 — 재려던 상태가 아니다');
    assert.ok(수 < 가지.안밀린_문턱,
      '픽스처의 앞선 수가 문턱을 넘었다 — 그러면 옛 경보로도 울어 이 검사가 눈이 먼다');

    const 화면 = 찍힌것(() => 가지.밀림경보(뿌리));
    assert.ok(화면.trim(), '갈라졌는데 조용하다 — 이게 F577 의 얼굴이다(문턱 아래에 그대로 앉는다)');
    assert.match(화면, /갈라졌다/, '갈라짐이라고 말하지 않는다');
    assert.match(화면, /뒤 1/, '뒤처진 수를 안 낸다 — 「못 민다」의 크기를 못 읽는다');
  } finally { fs.rmSync(뿌리, { recursive: true, force: true }); }
});

test('⑮ 갈라짐 경보가 «따를 수 없는» 처방을 안 낸다 (F103 — 그 처방이 우회를 정상 통로로 만든다)', () => {
  const 뿌리 = 갈라진픽스처();
  try {
    const 화면 = 찍힌것(() => 가지.밀림경보(뿌리));
    assert.ok(!/^\s*→ git push origin master\s*$/m.test(화면),
      '`git push origin master` 를 처방으로 낸다 — 이 상태에서 그 명령은 rejected 로 죽는다');
    assert.match(화면, /detached/, '갈라짐 처방이 detached 우회를 안 준다');
    assert.match(화면, /merge origin\/master/, '반입 수를 안 준다 — 「갈라졌다」만 말하고 끝난다');
  } finally { fs.rmSync(뿌리, { recursive: true, force: true }); }
});

test('⑯ 안 갈라졌으면 갈라짐 경보를 안 낸다 (거짓양성 — 매번 울면 한 주 만에 꺼진다)', () => {
  const { 뿌리, 커밋 } = 픽스처저장소();
  try {
    커밋([2]);                                    // 앞 1 · 뒤 0 = 밀 수 있다
    const 화면 = 찍힌것(() => 가지.밀림경보(뿌리));
    assert.ok(!/갈라졌다/.test(화면), '밀 수 있는 판을 「갈라졌다」로 읽는다');
  } finally { fs.rmSync(뿌리, { recursive: true, force: true }); }
});

test('⑯-b 갈라짐 처방 문장을 여기서 다시 적지 않는다 (신뢰성 ④ — 두 곳에 앉으면 하나만 낡는다)', () => {
  const 몸통 = 코드.slice(코드.indexOf('function 밀림경보'), 코드.indexOf('function 나이_시간'));
  assert.match(몸통, /동기\.갈라짐처방\(/, '갈라짐 처방을 공용 통로에서 안 가져온다');
  assert.ok(!/worktree add --detach/.test(코드),
    '갈라짐 처방 문장을 이 파일에 다시 적었다 — master동기 와 갈라져 하나만 낡는다');
  assert.equal(typeof require('../tools/lib/master동기.js').갈라짐처방, 'function',
    'master동기 가 갈라짐처방 을 export 하지 않는다 — 경보가 런타임에 죽는다');
});

// ── ⑰ 이어받은 워크트리 거두기 (F567) ──────────────────────────────────────
test('⑰ 머지 뒤에 «이 워크트리를 거두는 명령»을 손에 쥐여 준다 (F567 — 갇힘 처방의 마지막 한 칸)', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-거두기-'));
  const g = (...a) => require('node:child_process').spawnSync('git', a, { cwd: 뿌리, encoding: 'utf8' });
  g('init', '-q', '-b', 'master');
  g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  g('commit', '-q', '--allow-empty', '-m', '바탕');
  const 곁 = path.join(뿌리, '곁트리');
  const r = g('worktree', 'add', '-q', '-b', '일감', 곁);
  if (r.status !== 0) { fs.rmSync(뿌리, { recursive: true, force: true }); return; }   // git 이 못 하면 잰 게 없다

  try {
    const 화면 = 찍힌것(() => 가지.워크트리거두기처방(곁, '일감'));
    /* 🔑 「ExitWorktree 를 불러라」만으로는 못 닫는다 — 이어받은 워크트리에서는 그 도구가
       「주인이 아니다」로 거절하고, 거기서 길이 끊긴다(실측 2026-08-17 `local_950d2850`). */
    assert.match(화면, /ExitWorktree/, '먼저 부를 정규 통로를 안 말한다');
    assert.match(화면, /거절/, '이어받은 워크트리에서 그 도구가 거절한다는 사실을 안 말한다');
    assert.match(화면, /worktree remove/, '거절당했을 때 칠 실제 명령이 없다 — 여기서 길이 끊긴다');
    assert.ok(화면.includes(곁), '지울 대상 경로를 안 적는다 — 사람이 다시 찾아야 한다');
    assert.match(화면, /branch -D 일감/, '남는 가지를 거두는 수를 안 준다');

    /* 워크트리가 아니면 이 말을 안 해야 한다 — 아무 데서나 지우라고 하면 그 경보가 꺼진다. */
    const 본체화면 = 찍힌것(() => 가지.워크트리거두기처방(뿌리, 'master'));
    assert.ok(!/worktree remove/.test(본체화면), '메인 트리에서도 워크트리를 지우라고 한다');
  } finally { fs.rmSync(뿌리, { recursive: true, force: true }); }
});
