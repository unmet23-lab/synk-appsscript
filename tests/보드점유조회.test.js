/* `board.js --점유` 회귀 — **선언하기 전에** 묻는 자리 (마찰 F585 · 2026-08-17~18 실측 4회).
 *
 * 사고의 모양: 점유 판정이 `board-guard` 의 **Write 시점 게이트**에만 살아서, 「이 트랙이
 * 비었나」를 묻는 값이 **조사 한 벌**이었다 — 재고 대조하고 처방까지 세운 뒤 선언에서 차단된다.
 * 비켜나면 남는 게 조사분뿐이라 다음 세션이 같은 자리를 또 판다(실측: 판 자리 둘 다 앞 세션이
 * 이미 팠을 자리였다). 가드는 내내 **옳게** 막았다 — 새는 것은 판정이 아니라 순서다.
 *
 * 여기서 못박는 것 넷:
 *   ① **판정이 하나다** — 조회가 초록인 자리에서 가드가 막으면 이 도구는 존재 이유가 없다.
 *      아래 「가드와 대조」가 그 계약이고, 규칙을 베끼면 그 검사가 곧 빨개진다.
 *   ② **탐지력은 픽스처가 진다**(맹점 ②) — 실저장소는 안 쓴다(세션마다 달라져 불안정하다).
 *   ③ **모름을 초록으로 접지 않는다**(F207) — 자리를 못 뽑았으면 「비었다」가 아니라 exit 2 다.
 *   ④ **거짓 🔴 를 안 만든다** — 🎫(F285)·내 줄(F291 축)·완료 줄은 점유가 아니다.
 *      이 도구는 선언 «뒤에도» 계속 불리므로 그 거짓양성은 상시가 된다(F221: 거짓 차단은 관습을 죽인다).
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BOARDJS = path.join(__dirname, '..', 'tools', 'board.js');
const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'board-guard.js');

const 남지문 = 'deadbeef';
const 내지문 = 'cafe1234';

function 저장소(파일들) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-occupy-'));
  const 폴더 = path.join(dir, 'docs', '_ops', '보드');
  fs.mkdirSync(폴더, { recursive: true });
  for (const [이름, 내용] of Object.entries(파일들 || {})) {
    fs.writeFileSync(path.join(폴더, `${이름}.md`), 내용, 'utf8');
  }
  return dir;
}

const 줄 = (트랙, 파일칸, 상태 = '작업중') =>
  `| 2026-08-18 | ${트랙} | ${파일칸} | ${상태} (\`local_${남지문}\`) |`;

/** 조회를 돌린다 — **exit 코드와 글을 함께** 돌려준다(판정의 권위는 exit 이다 · 변이 통로와 같은 축). */
function 점유(root, 경로들, env) {
  const r = spawnSync(process.execPath, [BOARDJS, '--점유', ...경로들], {
    encoding: 'utf8',
    env: { ...process.env, SYNK_BOARD_ROOT: root, CLAUDE_CODE_HOST_SESSION_ID: `local_${내지문}-x`, ...(env || {}) },
  });
  return { 코드: r.status, 글: String(r.stdout || '') + String(r.stderr || '') };
}

test('🔑 탐지 — 남이 선언한 자리를 물으면 🔴 로 답한다(그리고 exit 1)', () => {
  const root = 저장소({ [남지문]: 줄('남의 트랙', 'tools/board.js · tests/board-guard.test.js') });
  const { 코드, 글 } = 점유(root, ['tools/board.js']);
  assert.match(글, /🔴[\s\S]*이미 잡혔다 1건/, '잡힌 자리를 못 봤다 — 그러면 이 도구는 조사분을 그대로 버리게 둔다');
  assert.match(글, new RegExp(`local_${남지문}`), '주인을 안 밝혔다 — 「누구에게 비켜나나」를 모르면 다음 손이 안 정해진다');
  assert.strictEqual(코드, 1, 'exit 이 0이면 스크립트가 초록으로 읽는다 — 판정의 권위는 exit 이다');
});

test('🟢 거짓양성 0 — 안 겹치는 경로는 초록이고 exit 0 이다', () => {
  const root = 저장소({ [남지문]: 줄('남의 트랙', 'tools/board.js') });
  const { 코드, 글 } = 점유(root, ['tools/전혀다른것.js']);
  assert.match(글, /🟢[\s\S]*잡힌 줄 0건/, '빈 자리를 잡혔다고 했다 — 거짓 차단은 관습을 죽인다(F221)');
  assert.strictEqual(코드, 0, '빈 자리인데 exit 0 이 아니다');
});

test('🔑 **가드와 같은 판정** — 조회가 초록인 자리를 가드가 막으면 안 된다 (이 트랙의 계약)', () => {
  /* 규칙을 베껴 두 벌이 되면 여기가 빨개진다. 같은 픽스처를 둘에게 먹여 결론을 대조한다. */
  const 파일칸 = 'tools/lib/보드.js · clasp push · #Q77';
  const root = 저장소({ [남지문]: 줄('남의 트랙', 파일칸) });
  const 보드파일 = path.join(root, 'docs', '_ops', '보드', `${내지문}.md`);
  for (const [물음, 새줄] of [
    ['tools/lib/보드.js', 줄('내 트랙', 'tools/lib/보드.js')],
    ['clasp push', 줄('내 트랙', 'clasp push')],
    ['#Q77', 줄('내 트랙', 'docs/아무거나.md · #Q77')],
    ['tools/안겹치는것.js', 줄('내 트랙', 'tools/안겹치는것.js')],
  ]) {
    const 조회 = 점유(root, [물음]);
    const out = execFileSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 보드파일, content: 새줄 } }),
      encoding: 'utf8',
      env: { ...process.env, SYNK_BOARD_ROOT: root, CLAUDE_CODE_HOST_SESSION_ID: `local_${내지문}-x` },
    });
    const 막았나 = out.trim()
      ? ((JSON.parse(out).hookSpecificOutput || {}).permissionDecision === 'deny') : false;
    assert.strictEqual(조회.코드 === 1, 막았나,
      `🔴 「${물음}」에서 조회와 가드가 갈렸다 — 조회 ${조회.코드 === 1 ? '🔴' : '🟢'} / 가드 ${막았나 ? 'deny' : 'allow'}.`
      + ' 갈라지면 조회가 초록이라 판 자리에서 가드가 막는다 = F585 를 고치는 척하며 그대로 두는 것이다');
  }
});

test('🎫 놓은 자리는 점유가 아니다 — 이어받으라고 내건 것이 이어받기를 막으면 안 된다 (F285)', () => {
  const root = 저장소({ [남지문]: 줄('남의 트랙', 'tools/board.js', '🎫 다음=누가 이어받아라') });
  const { 코드, 글 } = 점유(root, ['tools/board.js']);
  assert.match(글, /🎫[\s\S]*놓은 자리 1건/, '🎫 를 선점으로 셌다 — 뜻이 정확히 뒤집힌다');
  assert.doesNotMatch(글, /이미 잡혔다/, '🎫 줄을 🔴 로 냈다 — 그러면 아무도 그 일감을 못 집는다');
  assert.strictEqual(코드, 0, '🎫 인데 exit 1 이다 — 스크립트가 「막혔다」로 읽는다');
});

test('🙋 내 줄은 점유가 아니다 — 선언 뒤에도 계속 불리는 도구라 그 거짓 🔴 는 상시가 된다', () => {
  const root = 저장소({ [내지문]: `| 2026-08-18 | 내 트랙 | tools/board.js | 작업중 (\`local_${내지문}\`) |` });
  const { 코드, 글 } = 점유(root, ['tools/board.js']);
  assert.match(글, /🙋[\s\S]*내 줄 1건/, '내 선언을 남의 것으로 읽었다 — 자기 트랙을 물을 때마다 거짓 🔴 다');
  assert.doesNotMatch(글, /이미 잡혔다/, '내 줄을 점유로 셌다');
  assert.strictEqual(코드, 0, '내 줄인데 exit 1 이다');
});

test('완료 줄은 자리를 안 잡는다 — 치우기를 기다리는 것이지 점유가 아니다', () => {
  const root = 저장소({ [남지문]: 줄('남의 트랙', 'tools/board.js', '✅완료') });
  assert.strictEqual(점유(root, ['tools/board.js']).코드, 0, '끝난 줄이 자리를 계속 먹는다');
});

test('🔴 F207 — 자리를 하나도 못 뽑으면 「비었다」가 아니다(exit 2 · 초록과 갈라 말한다)', () => {
  const root = 저장소({ [남지문]: 줄('남의 트랙', 'tools/board.js') });
  const { 코드, 글 } = 점유(root, ['Code.js']);   // 홑 이름은 규약상 병행 가능이라 자리가 아니다
  assert.strictEqual(코드, 2, '🔴 못 뽑은 것을 초록(0)으로 접었다 — 「안 재봤다」가 「비었다」와 같은 모양이 된다');
  assert.match(글, /자리를 하나도 못 뽑았다/, '왜 답을 못 냈는지를 안 적었다 — 따를 수 없는 처방이 된다');
  assert.match(글, /2단 이상 경로/, '무엇이 자리로 세어지는지를 안 알려줬다');
});

test('🔑 repo 밖 공유 자원도 자리다 — `clasp push` 축이 이관 뒤에도 산다 (F343)', () => {
  const root = 저장소({ [남지문]: 줄('남의 배포 트랙', 'clasp push (배포집합 전량)') });
  assert.strictEqual(점유(root, ['clasp push']).코드, 1,
    '라이브 Apps Script 는 경로가 없어 원래 안 잡혔다 — F343 이 닫은 축이 이관에서 새면 안 된다');
});

test('🔴 보드 폴더를 못 읽으면 「비었다」가 아니다 (exit 2)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-occupy-none-'));
  assert.strictEqual(점유(dir, ['tools/board.js']).코드, 2, '폴더가 없는데 초록을 냈다 — 모름을 안전으로 바꿨다');
});
