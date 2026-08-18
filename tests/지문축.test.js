/* 지문 축 — 「내가 누구인가」의 두 답을 갈라 놓고, 그 갈라짐을 못박는다 (마찰 F634).
 *
 * 왜 이 파일이 있나 (2026-08-18 실측 · 클라우드 컨테이너):
 *   `board-id.지문()` 은 순수 변환 함수인데, 부르는 쪽 26파일·40곳이 **각자** `process.env` 를 읽었다.
 *   그 판정이 전부 `CLAUDE_CODE_HOST_SESSION_ID` 하나만 봤고 클라우드엔 그 변수가 없어서,
 *   여덟 자리가 빈 지문으로 돌았다(`board.js`·`board-move.js`·`대기열.js --집기` 등).
 *   F628 은 커밋 트레일러 층에만 폴백을 넣었고, 그 폴백 값(`cse_…`)은 **hex 가 아니라**
 *   보드 파일명이 될 수 없다. 즉 폴백 사슬로는 못 푸는 문제였다 — 축이 둘이다.
 *
 * 🔑 이 스위트가 지는 것 셋:
 *   ① HOST 가 있으면 **아무것도 안 바뀐다**(노트북의 옛 판정을 그대로 보존한다).
 *   ② 두 축이 각자의 규격을 지킨다 — 연락 축은 「보낼 수 있는 id」, 보드 축은 「hex 8자리」.
 *   ③ 호출부가 `process.env` 를 **다시 직독하지 못하게** 한다(옛 통로 금지 · CLAUDE.md 신뢰성).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const board = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'board-id.js'));

/* 실측에서 그대로 가져온 값의 «모양» — 픽스처가 탐지력을 진다(맹점 ②).
 * 본문은 지어냈고 접두·길이·문자 집합만 실물과 같다. */
const HOST_실물 = 'local_302d8acd-1111-2222-3333-444455556666';
const REMOTE_실물 = 'cse_01Scr7GJ3A6gxPNZDHQbbKxr';          // base62 — hex 아님
const SESSION_실물 = '79415d5c-36d0-528c-a9cc-3d530682f571';  // UUID — 앞 8자리가 hex

const 판 = (o) => ({ CLAUDE_CODE_HOST_SESSION_ID: '', CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '', ...o });

/* ── ① HOST 가 있으면 무변화 — 이게 없으면 「과거 판정이 갈린다」가 대가로 붙는다 ───────── */

test('🔑 HOST 가 있으면 두 축이 같은 값이고, 그 값은 옛 통로와 바이트로 같다', () => {
  const env = 판({ CLAUDE_CODE_HOST_SESSION_ID: HOST_실물, CLAUDE_CODE_REMOTE_SESSION_ID: REMOTE_실물, CLAUDE_CODE_SESSION_ID: SESSION_실물 });
  const 옛통로 = board.지문(env.CLAUDE_CODE_HOST_SESSION_ID || '');
  assert.equal(board.보드지문(env), 옛통로, 'HOST 가 있는데 보드 축이 옛 판정과 갈렸다 — 노트북의 옛 보드 줄 주인이 바뀐다');
  assert.equal(board.연락지문(env), 옛통로, 'HOST 가 있는데 연락 축이 옛 판정과 갈렸다 — 옛 커밋의 주인이 바뀐다');
  assert.equal(옛통로, '302d8acd');
});

test('🔴 HOST 가 있으면 폴백은 «타지 않는다» — 우선순위가 뒤집히면 옛 커밋과 새 커밋의 주인이 갈린다', () => {
  const env = 판({ CLAUDE_CODE_HOST_SESSION_ID: HOST_실물, CLAUDE_CODE_REMOTE_SESSION_ID: REMOTE_실물, CLAUDE_CODE_SESSION_ID: SESSION_실물 });
  assert.notEqual(board.보드지문(env), '79415d5c', 'SESSION 이 HOST 를 이겼다');
  assert.notEqual(board.연락지문(env), '01scr7gj', 'REMOTE 가 HOST 를 이겼다');
});

/* ── ② 두 축이 각자의 규격을 지킨다 ──────────────────────────────────────────── */

test('🔴 클라우드 실측 판 — 연락 축과 보드 축이 «서로 다른 값»이 된다 (이 갈라짐이 F634 의 실체다)', () => {
  const env = 판({ CLAUDE_CODE_REMOTE_SESSION_ID: REMOTE_실물, CLAUDE_CODE_SESSION_ID: SESSION_실물 });
  assert.equal(board.연락지문(env), '01scr7gj', '연락 축이 REMOTE 를 못 집었다 — 클라우드 커밋이 다시 주인 없이 쌓인다');
  assert.equal(board.보드지문(env), '79415d5c', '보드 축이 SESSION 을 못 집었다 — 클라우드 세션이 자기 보드 줄을 못 쓴다');
  assert.notEqual(board.연락지문(env), board.보드지문(env),
    '두 축이 같은 값이 됐다 — 그러면 이 갈래를 나눈 이유가 사라지고, 부르는 쪽이 둘을 섞어 쓰기 시작한다');
});

test('🔴 보드 축은 REMOTE 로 «안» 내려간다 — base62 는 보드 파일명이 될 수 없다', () => {
  const env = 판({ CLAUDE_CODE_REMOTE_SESSION_ID: REMOTE_실물 });
  assert.equal(board.보드지문(env), '',
    '보드 축이 hex 아닌 값을 통과시켰다 — 그 세션은 파일을 만들 수는 있는데 아무도 주인을 못 읽는 고아가 된다');
});

test('🔴 연락 축은 SESSION 으로 «안» 내려간다 — F628 이 정한 트레일러의 뜻을 지킨다', () => {
  const env = 판({ CLAUDE_CODE_SESSION_ID: SESSION_실물 });
  assert.equal(board.연락지문(env), '',
    '내부 에이전트 id 까지 폴백했다 — 그 값으로는 세션에 메시지를 못 보낸다(F628 회귀와 같은 선)');
});

test('🔑 보드 축의 불변식 — 언제나 hex 8자리이거나 빈 문자열이다', () => {
  const 판들 = [
    판({}),
    판({ CLAUDE_CODE_SESSION_ID: 'zzzzzzzz-0000-0000-0000-000000000000' }),  // hex 아님
    판({ CLAUDE_CODE_SESSION_ID: 'abc' }),                                    // 너무 짧다
    판({ CLAUDE_CODE_SESSION_ID: SESSION_실물 }),
    판({ CLAUDE_CODE_HOST_SESSION_ID: HOST_실물 }),
    판({ CLAUDE_CODE_REMOTE_SESSION_ID: REMOTE_실물 }),
  ];
  for (const env of 판들) {
    const f = board.보드지문(env);
    assert.ok(f === '' || /^[0-9a-f]{8}$/.test(f), `보드 축이 규격 밖 값을 냈다: ${JSON.stringify(f)}`);
    if (f) assert.equal(board.파일지문(`${f}.md`), f, '보드 축이 낸 값으로 만든 파일명을 파일지문() 이 못 읽는다 — 짝이 깨졌다');
  }
});

test('🔑 아무 변수도 없으면 «빈 문자열» 이다 — 「주인 없음」이지 「내 것」이 아니다', () => {
  assert.equal(board.보드지문(판({})), '');
  assert.equal(board.연락지문(판({})), '');
});

/* ── ③ 옛 통로 금지 — 「원인을 쓸 수 없게 만든다」(CLAUDE.md 신뢰성 · 3번째) ───────────
 *
 * ⚠ 이 검사는 **실저장소**를 본다 — 그래서 픽스처가 아니라 «거짓양성만» 잡는 몫이다(F296).
 *   탐지력은 위 픽스처들이 이미 졌다. 여기서 재는 것은 「호출부가 다시 갈라지지 않는가」뿐이다.
 * ⚠ 허용 목록은 «아직 안 옮긴 곳»이다 — 줄이는 방향으로만 고친다. 여기에 이름을 더하려면
 *   그 파일이 왜 두 축 어느 쪽도 아닌지를 함께 적어야 한다. */
/* 과녁은 **생산 코드**다(`tools/` · `.claude/`).
 *   `tests/` 는 뺀다 — 픽스처가 이 변수를 «일부러 세우고 지우는» 자리라, 여기 넣으면
 *   탐지력을 만드는 코드를 탐지가 금지하는 모양이 된다(따를 수 없는 처방 · F103).
 *   `docs/` 도 뺀다 — 장부·신고문이 낱말을 인용할 뿐이다.
 * ⚠ 이 좁힘이 틀릴 때의 모습: 누군가 판정 로직을 `tests/` 안에 두면 이 검사가 못 본다.
 *   그건 그 자체로 다른 결함이고, `tests/트랙경계.test.js` 계열이 지는 몫이다. */
const 직독_허용 = new Set([
  '.claude/hooks/lib/board-id.js',        // 여기가 그 «한 곳» 이다 — 통로의 정의
]);

test('🔴 `process.env.CLAUDE_CODE_HOST_SESSION_ID` 직독은 board-id 통로 밖에서 늘지 않는다', (t) => {
  let 출력;
  try {
    출력 = execFileSync('git', ['grep', '-l', '-F', 'process.env.CLAUDE_CODE_HOST_SESSION_ID', '--', 'tools/', '.claude/'],
      { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    // 매치 0건이면 git grep 은 종료코드 1 이다 — 그건 fail 이 아니라 «전부 옮겼다» 다.
    if (e.status === 1) 출력 = '';
    else return t.skip('git grep 을 못 돌렸다(환경) — 이 축은 «안 재졌다»: ' + e.message);
  }
  const 파일들 = 출력.split('\n').map((s) => s.trim()).filter(Boolean);
  const 새는것 = 파일들.filter((f) => !직독_허용.has(f));
  assert.deepEqual(새는것, [],
    '생산 코드가 세션 id 를 직접 읽는다 — 그러면 판정이 또 갈리고, 갈린 쪽의 증상은 언제나 「통과」다.\n'
    + '  → 셋 중 하나를 쓴다: `보드지문()`(주인 판정) · `연락지문()`(트레일러·연락) · `세션id()`(락·상태 파일 이름).\n'
    + `  샌 파일: ${새는것.join(' · ')}`);
});

test('🔑 분모를 밝힌다 — 통로를 실제로 «쓰는» 생산 파일이 몇 개인가 (0이면 이관이 안 된 것이다)', (t) => {
  let 출력;
  try {
    출력 = execFileSync('git', ['grep', '-l', '-E', '보드id\\.(보드지문|연락지문|세션id|보드id)\\(', '--', 'tools/', '.claude/'],
      { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    if (e.status === 1) 출력 = '';
    else return t.skip('git grep 을 못 돌렸다(환경): ' + e.message);
  }
  const n = 출력.split('\n').filter((s) => s.trim()).length;
  assert.ok(n >= 20,
    `통로를 쓰는 생산 파일이 ${n}개뿐이다 — 이관이 되돌려졌거나 통로 이름이 바뀌었다.\n`
    + '  「직독 0건」은 이 분모와 «함께» 읽어야 참이다(F207): 둘 다 0 이면 그냥 코드가 사라진 것이다.');
});

test('🔑 허용 목록의 파일이 실제로 존재한다 — 낡은 이름이 검사를 조용히 넓히지 않게', () => {
  for (const f of 직독_허용) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `허용 목록에 없는 파일이 적혀 있다: ${f}`);
  }
});
