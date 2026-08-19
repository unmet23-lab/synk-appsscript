/**
 * 인계문 압축 회귀 — F661 ㈎(빈 인계문은 안 남긴다) · ㈏(훅과 겹치는 문구는 안 싣는다)
 *
 * 왜 있나 (유호 픽 2026-08-19 「㈎랑 ㈏ 진행해」 · 실측 = git 이력 전량 47건):
 *   인계문은 `initialUserMessage` 로 들어가 **유호님의 첫 발화 자리**를 쓴다. 그런데 47건 중
 *     ㉣ 이어갈 것이 있다   7건 15%
 *     ㉢ 트랙 종결          27건 57%
 *     ㉡ 커밋만              9건 19%
 *     ㉠ 커밋 0 + 트랙 0     4건  9%  ← 실을 것이 **아무것도 없다**
 *   ㉠ 은 정보량 0인데 첫 발화 자리를 쓰고 「새 트랙을 잡아라」를 시킨다. 실제로 2026-08-19 에
 *   유호님이 용건을 갖고 연 창이 그 지시부터 출발했고, 유호님은 진짜 용건을 그 위에 끼워야 했다.
 *
 * 탐지 능력은 **픽스처가 진다** — 실저장소에는 거짓양성만 묻는다(CLAUDE.md 가드 맹점 ②).
 *
 * ⚠ **이 장치가 틀릴 때의 모습**(맹점 ④ — 새 장치엔 대가를 함께 적는다):
 *   ㈎ 가 잘못 참이 되면 **실을 것이 있는 인계문이 조용히 사라진다.** 새는 방향이 「무기록」이라
 *   화면에 아무 표도 안 난다 — 그래서 판정을 «커밋 0 그리고 트랙 0 그리고 보드를 읽을 수 있었다»
 *   셋의 곱으로 좁히고, 아래 ②③④ 가 세 갈래를 각각 못박는다. 「모름」이 «없음»으로 새는 자리가
 *   정확히 ④ 다.
 *   ㈏ 가 잘못되면 **처방이 통째로 사라진다** — 문구를 뺀 근거가 「훅이 대신 낸다」이므로, 그 훅이
 *   등록에서 빠지면 인계문에도 없고 훅에도 없는 상태가 된다. 그 자리가 아래 ⑦ 이다(자기 처방
 *   검사 · 맹점 ③): **뺀 문구마다 대신 내는 자리가 살아 있는지**를 기계가 본다.
 *   닫을 것: 없다 — 새 도구·훅을 안 만들고 이미 도는 통로(`buildHandoff` → `drop`)에 게이트
 *   하나를 얹었다. 그래서 물러날 자리도 그 한 줄뿐이다.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOKS = path.join(ROOT, '.claude', 'hooks');
const SETTINGS = process.env.SYNK_TEST_SETTINGS || path.join(ROOT, '.claude', 'settings.json');

/* 🔴 이 두 줄의 **순서가 규약이다** (`tests/lib/상태격리.js` · `tests/상태격리.test.js` 가 강제).
 *   `handoff-store` 의 STATE_DIR 은 모듈 최상위 const 라 require 시점에 굳는다. 격리 없이 쓰면
 *   픽스처가 **이 머신의 모든 세션이 공유하는 폴더**에 박동을 쓰고, 두 방향으로 샌다(둘 다 「통과」로
 *   보인다): 남의 sweep 이 내 픽스처를 지워 «못 믿는 적색»이 되거나, 내 가짜 세션이 옆 세션의
 *   board-guard·작업본소유자를 비켜나게 한다.
 * ⚠ 그래서 `report` 보다 **먼저** 부른다 — session-report 가 handoff-store 를 물기 때문이다.
 *   (손으로 env+require.cache 를 다뤘다가 이 회귀에 잡혔다. 공용 통로가 이미 있었다.) */
const { 격리된store } = require('./lib/상태격리');
const store = 격리된store(__filename);
const report = require(path.join(HOOKS, 'lib', 'session-report.js'));

const 머리 = '| 날짜 | 트랙/작업 | 파일 | 상태 |\n|---|---|---|---|\n';

function 임시(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** 보드 폴더가 있는 임시 저장소. `줄들`이 null 이면 **보드 폴더 자체를 안 만든다**(못 읽음 갈래). */
function 저장소(prefix, 줄들) {
  const d = 임시(prefix);
  if (줄들) {
    fs.mkdirSync(path.join(d, 'docs', '_ops', '보드'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', '_ops', '보드', 'sess.md'), 머리 + 줄들.join(''));
  }
  return d;
}

/* 가지·원격 층을 「다 쟀고 비었다」로 고정한다 — 안 그러면 회차마다 git 스폰 결과가 달라져
 * 대조가 판정을 못 낸다(CLAUDE.md 원인 판정 ③ 「여러 회차 대조는 그 사이 입력을 얼린다」). */
const 다쟀다 = { dirty: 0, 가지: { 줄들: [], 모름: false }, 원격: { 줄들: [], 모름: false } };

function 메타뽑기(cwd, opts) {
  const 메타 = {};
  const msg = report.buildHandoff(cwd, null, { ...다쟀다, ...(opts || {}), 메타 });
  return { 메타, msg };
}

/* ── ㈎ 「실을 것이 없다」 판정 ─────────────────────────────────────────────── */

test('㈎① 커밋 0 + 보드 줄 0 이면 «실을 것 없음» 이다 (그 47건 중 4건)', () => {
  const d = 저장소('synk-f661-a-', ['| 2026-08-19 | 남의 트랙 | a.js | ▶작업중 (`local_11112222`) — 남이 하는 일 |\n']);
  const { 메타, msg } = 메타뽑기(d);
  assert.equal(메타.커밋수, 0, '픽스처가 커밋 0 이 아니다 — 이 저장소엔 커밋이 없어야 한다');
  assert.equal(메타.트랙있음, false, '남의 줄만 있는 보드인데 「내 트랙」으로 읽혔다');
  assert.equal(메타.실을것없음, true, `커밋도 보드 줄도 없는데 «실을 것 있음» 으로 읽혔다:\n${msg}`);
});

test('㈎② 커밋이 있으면 트랙이 없어도 남긴다 — 「직전 세션이 무엇을 했나」는 실을 것이다 (㉡ 19%)', () => {
  /* ⚠ 판정식을 손으로 다시 적어 검사하면 **아무것도 안 재는 초록**이 된다(맹점 ④ — 맞는 얼굴로
   *   틀린 값). `myCommits` 는 `--grep=Session-Id:` 로 진짜 git 이력을 읽으므로, 커밋 축은
   *   **실제 트레일러가 박힌 커밋**으로만 잴 수 있다. */
  const sid = 'local_cccc1111-2222-3333-4444-555566667777';
  const d = 저장소('synk-f661-b-', ['| 2026-08-19 | 남의 트랙 | a.js | ▶작업중 (`local_11112222`) — 남 |\n']);
  const g = (...a) => spawnSync('git', a, { cwd: d, encoding: 'utf8' });
  g('init', '-q');
  g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.writeFileSync(path.join(d, 'a.js'), '// 무엇인가 했다\n');
  g('add', '-A');
  const c = g('commit', '-m', `fix: 무엇인가 했다\n\nSession-Id: ${sid}`);
  if (c.status !== 0) { test.skip(`git 을 못 썼다: ${c.stderr}`); return; }

  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = sid;
  try {
    const { 메타, msg } = 메타뽑기(d);
    assert.ok(메타.커밋수 >= 1, `트레일러가 박힌 커밋을 못 찾았다(픽스처가 안 섰다):\n${msg}`);
    assert.equal(메타.트랙있음, false, '보드엔 남의 줄뿐인데 「내 트랙」으로 읽혔다');
    assert.equal(메타.실을것없음, false,
      `커밋이 있는데 «실을 것 없음» 으로 떨어졌다 — ㉡ 9건(19%)이 통째로 사라진다:\n${msg}`);
    assert.match(msg, /무엇인가 했다/, '커밋이 본문에 안 실렸다 — 실을 것이 있다고 판정해 놓고 안 싣는다');
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

test('㈎③ 보드 줄이 있으면 커밋 0 이어도 남긴다 — 이어갈 자리가 실을 것이다', () => {
  const d = 저장소('synk-f661-c-', ['| 2026-08-19 | 내 트랙 | c.js | 🔵진행 (`local_ba86eeb2`) — 다음=회귀 |\n']);
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_ba86eeb2-565d-438b-85c1-6d98aeb187a7';
  try {
    const { 메타, msg } = 메타뽑기(d);
    assert.equal(메타.트랙있음, true, `내 지문의 보드 줄이 있는데 못 찾았다:\n${msg}`);
    assert.equal(메타.실을것없음, false, '이어갈 트랙이 있는데 인계문을 버린다 — ㉣ 15%가 사라지는 자리다');
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

test('㈎④ 🔴 보드를 «못 읽으면» «없음» 이 아니다 — 모름은 안전이 아니다', () => {
  const d = 저장소('synk-f661-d-', null); // 보드 폴더 자체가 없다
  const { 메타, msg } = 메타뽑기(d);
  assert.equal(메타.보드못읽음, true, `보드 폴더가 없는데 「다 읽었다」로 읽혔다:\n${msg}`);
  assert.equal(메타.실을것없음, false,
    '보드를 못 읽은 회차에서 인계문을 버렸다 — 트랙이 있는데 못 본 것일 수 있다. '
    + '새는 방향은 「남긴다」여야 한다(못 남기는 손해가 하나 더 남기는 손해보다 크다)');
});

/* ── ㈎ 게이트가 실제로 «쓰는 층» 에서 막는가 ─────────────────────────────── */

test('㈎⑤ drop 은 «실을 것 없음» 바통을 안 쓴다 — 그리고 안 쓴 것은 청소할 것도 없다', () => {
  const dir = store.stateDir();
  // ⚠ 「몇 개 늘었나」로 센다 — 이 폴더는 이 시험 전용이지만 한 파일 안의 다른 회차와는 공유한다.
  const 바통수 = () => fs.readdirSync(dir).filter((f) => f.startsWith('handoff-')).length;
  const 전 = 바통수();

  const 빈 = store.drop('/tmp/proj-f661', 'sid-empty', '실을 것 없는 글', { 실을것없음: true });
  const 참 = store.drop('/tmp/proj-f661', 'sid-real', '실을 것 있는 글', { 실을것없음: false });
  const 옛 = store.drop('/tmp/proj-f661', 'sid-old', '메타 없는 옛 호출부', undefined);

  assert.equal(빈, false, '«실을 것 없음» 인데 바통을 썼다 — ㈎ 가 안 걸렸다');
  assert.equal(참, true, '실을 것이 있는 바통까지 막혔다 — 인계가 통째로 끊긴다');
  assert.equal(옛, true,
    '메타를 안 넘기는 옛 호출부가 막혔다 — 새는 방향은 「남긴다」여야 하고, '
    + '이 값이 false 가 되면 아직 안 고친 호출부의 인계문이 조용히 사라진다');

  assert.equal(바통수() - 전, 2,
    `바통이 ${바통수() - 전}개 늘었다 — 셋을 떨궜지만 «실을 것 없음» 하나는 만들어지지 않아야 한다`);
});

test('㈎⑥ 바통을 떨구는 «두 자리» 가 모두 메타를 넘긴다 — 한쪽만 고치면 그쪽으로 되돌아온다', () => {
  for (const 훅 of ['session-end-handoff.js', 'context-budget.js']) {
    const 본문 = fs.readFileSync(path.join(HOOKS, 훅), 'utf8');
    assert.match(본문, /buildHandoff\([^)]*메타/s,
      `${훅} 가 buildHandoff 에 메타를 안 넘긴다 — 판정 근원과 연결이 끊겼다`);
    assert.match(본문, /store\.drop\([^;]*메타|메타\.실을것없음/s,
      `${훅} 가 판정을 안 쓴다 — 이 자리로 빈 인계문이 그대로 나간다`);
  }
});

/* ── ㈏ 훅과 겹치는 문구를 뺐다 · 그리고 대신 내는 자리가 살아 있다 ─────────── */

test('㈏⑦ 🔑 자기 처방 검사 — 뺀 문구를 «대신 내는» 훅이 인계문과 같은 매처에 등록돼 있다', () => {
  const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const 매처들 = (이름) => {
    const 나온것 = [];
    for (const g of (s.hooks && s.hooks.SessionStart) || []) {
      for (const k of g.hooks || []) if (String(k.command || '').includes(이름)) 나온것.push(String(g.matcher || ''));
    }
    return 나온것;
  };
  // 인계문이 배달되는 매처가 기준선이다 — 대신 내는 훅은 **그 매처를 덮어야** 한다.
  const 인계매처 = 매처들('session-handoff.js');
  assert.ok(인계매처.length, '인계문 배달 훅이 SessionStart 에 없다 — 기준선을 못 잡는다');

  for (const [이름, 뭘대신] of [
    ['작업본소유자.js', '미커밋 N건 + 주인 가르기(F073)'],
    ['대기열.js', '「새 트랙을 잡아라」의 후보 목록'],
  ]) {
    const m = 매처들(이름);
    assert.ok(m.length, `🔴 ${이름} 가 SessionStart 에 등록돼 있지 않다 — 인계문에서 뺀 「${뭘대신}」이 `
      + '이제 **어디에도 없다**(F661 ㈏ 의 전제가 무너졌다)');
    for (const 기준 of 인계매처) {
      assert.ok(m.includes(기준),
        `🔴 ${이름} 의 매처(${m.join('|')})가 인계문 매처(${기준})를 안 덮는다 — `
        + `인계문은 나가는데 「${뭘대신}」은 안 나가는 회차가 생긴다`);
    }
  }
});

test('㈏⑧ 본문에서 뺀 것은 정말 빠졌다 — 얼어붙어 낡는 값과 훅이 내는 목록', () => {
  const d = 저장소('synk-f661-e-', ['| 2026-08-19 | 남의 트랙 | a.js | ▶작업중 (`local_11112222`) — 남 |\n']);
  const { msg } = 메타뽑기(d, { dirty: 7 });
  assert.doesNotMatch(msg, /미커밋/,
    `미커밋 줄이 본문에 남아 있다 — 이 값은 마감 시점에 얼어붙어 반드시 낡는다`
    + `(실측 2026-08-19: 인계문 1건 vs 새 창이 연 실제 2건):\n${msg}`);
  assert.doesNotMatch(msg, /작업본소유자/, '작업본소유자 호출 지시가 본문에 남아 있다 — SessionStart 훅이 지금 값으로 낸다');
  assert.doesNotMatch(msg, /장부 미해소·보드 ⏳·결정 큐/,
    '후보 출처 열거가 남아 있다 — `대기열.js` 가 같은 매처에서 실물 목록으로 낸다');
});

test('㈏⑨ 🔴 압축이 실사고 처방까지 깎지 않았다 — 훅이 «대신 못 내는» 세 조각은 그대로다', () => {
  const 없음 = 저장소('synk-f661-f-', ['| 2026-08-19 | 남의 트랙 | a.js | ▶작업중 (`local_11112222`) — 남 |\n']);
  const 종결 = 저장소('synk-f661-g-', ['| 2026-08-19 | 내 트랙 | b.js | ✅**종결**(`local_ba86eeb2`) — 끝 |\n']);
  const 원래 = process.env.CLAUDE_CODE_HOST_SESSION_ID;
  process.env.CLAUDE_CODE_HOST_SESSION_ID = 'local_ba86eeb2-565d-438b-85c1-6d98aeb187a7';
  try {
    for (const [이름, d] of [['트랙 없음', 없음], ['트랙 종결', 종결]]) {
      const { msg } = 메타뽑기(d);
      assert.match(msg, /이어받지는 않는다\(F073 · F165 · F170\)/,
        `🔴 ${이름}: 이어받기 금지가 사라졌다 — 남의 종결 줄을 이어받아 세션 하나를 태운 실사고의 처방이다:\n${msg}`);
      assert.match(msg, /🎫/, `🔴 ${이름}: 🎫 예외가 사라졌다 — 유일하게 이어받아도 되는 갈래를 못 가른다`);
      assert.match(msg, /docs\/_ops\/보드\/<네 지문>\.md/,
        `🔴 ${이름}: 새 선언의 **자리**가 사라졌다 — 받은 세션이 죽은 세션의 파일에 제 줄을 쓴다(F250·F332). `
        + '대기열 훅은 「무엇을 집을까」만 알지 「어디에 선언하나」는 말하지 않는다');
    }
  } finally {
    if (원래 === undefined) delete process.env.CLAUDE_CODE_HOST_SESSION_ID;
    else process.env.CLAUDE_CODE_HOST_SESSION_ID = 원래;
  }
});

test('㈏⑩ 지문 출처는 «두 축 다» 싣는다 — 한 축만 대면 클라우드 세션에서 빈 지문이 나온다 (F634)', () => {
  const d = 저장소('synk-f661-h-', ['| 2026-08-19 | 남의 트랙 | a.js | ▶작업중 (`local_11112222`) — 남 |\n']);
  const 첫줄 = 메타뽑기(d).msg.split('\n')[0];
  assert.match(첫줄, /CLAUDE_CODE_HOST_SESSION_ID/, '주 축이 빠졌다');
  assert.match(첫줄, /CLAUDE_CODE_SESSION_ID/,
    '폴백 축이 빠졌다 — HOST 가 없는 환경(실측: 이 저장소를 도는 원격 세션)에서 '
    + '시키는 대로 따르면 **빈 지문**이 나온다. 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103)');
  // `보드지문()` 의 실제 폴백 순서와 글자가 어긋나면 안내가 또 틀린다 — 규격을 왕복으로 못박는다.
  const 보드id = require(path.join(HOOKS, 'lib', 'board-id.js'));
  assert.equal(보드id.지문(보드id.보드지문({ CLAUDE_CODE_SESSION_ID: 'dacbb47c-9756-57b9-ac77-bc8978d37e37' })), 'dacbb47c',
    'HOST 가 없을 때 보드 축이 CLAUDE_CODE_SESSION_ID 로 폴백하지 않는다 — 이음매의 안내와 구현이 갈라졌다');
});

/* ── ㈐ 유호님의 첫 발화 자리를 돌려준다 ────────────────────────────────────
 * 옛 판은 인계문을 `initialUserMessage` 로 냈다 — 유호님이 쓰지도 읽지도 않은 글이 «유호님의
 * 첫 메시지»로 대화에 박히고, 세션은 그것을 유호님 지시로 읽고 출발했다.
 * 이제는 **plain-text stdout** 으로 낸다: 공식 문서가 SessionStart 를 「plain-text stdout 을
 * 컨텍스트로 넣는」 세 이벤트 중 하나로 정해 뒀고, 이 저장소의 SessionStart 훅 대부분이 이미
 * 그 통로를 쓴다(작업본소유자·대기열·philosophy-card — 매 세션 실제로 도는 것을 본다). */

/** SessionStart 훅을 실제로 띄운다 — 형식 판정은 «진짜 출력»으로만 할 수 있다. */
function 인계띄우기(cwd, stateDir, source) {
  const { 훅띄우기 } = require('./lib/훅띄우기');
  const r = 훅띄우기(path.join(HOOKS, 'session-handoff.js'), {
    input: JSON.stringify({ session_id: 'NEW', hook_event_name: 'SessionStart', cwd, source: source || 'startup' }),
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, SYNK_CTXBUDGET_DIR: stateDir },
  });
  return String(r.stdout || '');
}

test('㈐ 🔴 인계문은 «유호님의 첫 발화 자리»를 쓰지 않는다 — plain-text 컨텍스트로 나간다', () => {
  const cwd = 저장소('synk-f661-p-', ['| 2026-08-19 | 남 | a.js | ▶작업중 (`local_11112222`) — 남 |\n']);
  const 인계 = 'SYNK 이어서 작업한다 — 표식:㈐검사\n· (커밋 없음)';
  assert.equal(store.drop(cwd, 'SID-P', 인계, { 실을것없음: false }), true, '픽스처 바통이 안 떨어졌다');

  const out = 인계띄우기(cwd, store.stateDir());
  assert.ok(out.trim(), '바통이 있는데 훅이 아무것도 안 냈다 — 인계가 통째로 끊겼다');
  assert.match(out, /표식:㈐검사/, '인계문 본문이 안 실렸다');

  /* 🔑 **이 단언이 ㈐ 의 봉인이다.** stdout 이 JSON 이면 Claude Code 가 그것을 «구조화 제어»로
   *   파싱한다 — 그러면 plain-text 컨텍스트 통로를 못 타고, `initialUserMessage` 를 담았다면
   *   그 순간 유호님의 첫 발화 자리로 되돌아간다. 두 방향을 한꺼번에 막는다. */
  let 파싱됨 = null;
  try { 파싱됨 = JSON.parse(out.trim()); } catch (_) { /* plain text 가 정답이다 */ }
  assert.equal(파싱됨, null,
    `stdout 이 JSON 이다 — SessionStart 의 plain-text 컨텍스트 통로를 못 탄다:\n${out.slice(0, 300)}`);
  assert.doesNotMatch(out, /initialUserMessage/,
    '🔴 인계문이 유호님의 첫 발화 자리로 돌아갔다 — 유호님이 쓰지 않은 글이 유호님의 첫 수가 된다(F661 ㈐)');
});

test('㈐ 머리말이 «누구 글인지»와 «옛 동작을 얻는 한 마디»를 준다 — 따를 수 없는 처방은 우회를 만든다(F103)', () => {
  const cwd = 저장소('synk-f661-q-', ['| 2026-08-19 | 남 | a.js | ▶작업중 (`local_11112222`) — 남 |\n']);
  store.drop(cwd, 'SID-Q', 'SYNK 이어서 작업한다 — 표식:㈐머리말', { 실을것없음: false });
  const out = 인계띄우기(cwd, store.stateDir());

  assert.match(out, /유호님이 쓰신 것이 아닙니다|유호님이 쓰신 글이 아니/,
    '이 글이 유호님 것이 아니라는 말이 없다 — 그러면 컨텍스트로 옮겨도 세션은 지시로 읽는다');
  assert.match(out, /용건이 이 세션의 출발점/,
    '유호님 용건이 우선이라는 말이 없다 — ㈐ 의 본문이 빠졌다');
  assert.match(out, /「이어서」|「계속」/,
    '옛 동작(창만 열면 이어감)을 얻는 **한 마디**를 안 줬다 — 자동 출발을 없앤 대가를 유호님이 '
    + '치르는데 무엇을 말해야 하는지 모르면 그건 처방이 아니다(F103)');
  // 본문은 머리말 «뒤»에 온다 — 순서가 뒤집히면 세션이 인계문을 먼저 읽고 지시로 삼는다.
  assert.ok(out.indexOf('용건이 이 세션의 출발점') < out.indexOf('표식:㈐머리말'),
    '머리말이 인계문 본문보다 뒤에 있다 — 가르는 문장은 갈라야 할 것보다 먼저 읽혀야 한다');
});

test('㈐ resume·compact 는 그대로 조용하다 — 컨텍스트가 살아 있어 중복이 된다', () => {
  const cwd = 저장소('synk-f661-r-', ['| 2026-08-19 | 남 | a.js | ▶작업중 (`local_11112222`) — 남 |\n']);
  store.drop(cwd, 'SID-R', 'SYNK 이어서 작업한다 — 표식:㈐조용', { 실을것없음: false });
  for (const src of ['resume', 'compact']) {
    assert.equal(인계띄우기(cwd, store.stateDir(), src).trim(), '',
      `${src} 에서 인계문이 나갔다 — 이어지는 세션에 중복 지시가 된다`);
  }
  // 그리고 바통은 **안 소비돼야** 한다 — 소비했으면 진짜 새 창이 빈손이 된다.
  assert.match(인계띄우기(cwd, store.stateDir(), 'startup'), /표식:㈐조용/,
    'resume·compact 가 바통을 먹어치웠다 — 다음 새 창이 이어받을 것을 잃는다');
});

/* ── 실저장소: 거짓양성만 본다 (탐지력은 위 픽스처가 진다 · 맹점 ②) ─────────── */

test('㈏⑪ 실저장소 — 지금 이 저장소에서 만든 인계문이 위 규격을 지킨다', () => {
  const 메타 = {};
  let msg;
  try {
    msg = report.buildHandoff(ROOT, null, { dirty: 0, 메타 });
  } catch (e) {
    // repo 밖 환경(git 없음·권한)에 기대는 검사는 CI 에서 fail 아니라 skip 으로 드러낸다(F296)
    test.skip(`실저장소에서 인계문을 못 만들었다: ${e.message}`);
    return;
  }
  assert.doesNotMatch(msg, /미커밋/, `실저장소 인계문에 미커밋 줄이 돌아왔다:\n${msg}`);
  assert.ok(typeof 메타.실을것없음 === 'boolean', '메타가 안 채워졌다 — 호출부가 판정을 못 읽는다');
  assert.ok(msg.split('\n')[0].includes('너는 다른 세션이다'), '이음매가 첫 줄에 없다');
});
