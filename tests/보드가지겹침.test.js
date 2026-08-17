// F528 회귀 — board-guard 의 겹침 검사(④)가 **워크트리 가지 안의 선언**까지 분모로 삼는가.
//
// 🔑 왜 별도 파일인가: `tests/board-guard.test.js` 는 상한 셈(①②)을 재는 자리다. 이 검사는
//   ④ 의 분모를 재므로 축이 다르고, 무엇보다 그 파일은 PR #24 가 같은 시각에 고치고 있었다.
// 🔑 탐지력은 **픽스처로** 못박는다 — 실저장소의 가지 상태에 기대면 CI 에서 깨지고(F296),
//   가지가 없는 날엔 「통과」와 「미실행」이 같은 모양이 된다(F207).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, '..', '.claude', 'hooks', 'board-guard.js');
const 보드lib = require(path.join(__dirname, '..', 'tools', 'lib', '보드.js'));

const 머리 = ['| 날짜 | 트랙 | 만지는 파일 | 상태 |', '|---|---|---|---|'];
const 줄 = (트랙, 파일, 상태) => `| 2026-08-17 | ${트랙} | ${파일} | ${상태} |`;

function 뿌리세우기() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f528-'));
  fs.mkdirSync(path.join(root, 'docs', '_ops', '보드'), { recursive: true });
  return root;
}
const 보드경로 = (root, 지문) => path.join(root, 'docs', '_ops', '보드', `${지문}.md`);

/** 가지 훑기가 내는 모양 그대로 — 모양은 정본(`가지끝줄`)에서 가져온다(여기 다시 적으면 두 벌이 된다). */
function 가지로그(가지, 파일, ...줄들) {
  return 줄들.map((l) => 보드lib.가지끝줄(가지, 파일, l)).join('\n');
}

function 판정(payload, env) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...env },
  });
  if (!out.trim()) return { 결정: 'allow', 사유: '', 알림: '' };
  const j = JSON.parse(out);
  const h = j.hookSpecificOutput || {};
  return { 결정: h.permissionDecision || 'allow', 사유: String(h.permissionDecisionReason || ''), 알림: String(j.systemMessage || '') };
}

/** 내 보드 파일에 새 활성 줄 하나를 쓰는 payload. 이것이 «실사용 모양»이다 — 세션은 자기 파일에 쓴다. */
function 내선언(root, 내지문, 파일칸) {
  const p = 보드경로(root, 내지문);
  fs.writeFileSync(p, [...머리].join('\n'), 'utf8');
  return {
    tool_name: 'Write',
    tool_input: { file_path: p, content: [...머리, 줄('**내 새 트랙**', 파일칸, `작업중 (\`local_${내지문}\`)`)].join('\n') },
  };
}
const 환경 = (내지문, 로그) => ({ CLAUDE_CODE_HOST_SESSION_ID: `local_${내지문}`, SYNK_BOARD_BRANCH_LOG: 로그 });

test('탐지력 — 가지 안의 남의 선언이 같은 파일을 잡고 있으면 막는다', () => {
  const root = 뿌리세우기();
  const 로그 = 가지로그('worktree-남의트랙', 'bbbb2222.md',
    줄('**남의 코드 트랙**', '`tools/겹칠것.js`', '작업중 (`local_bbbb2222`)'));
  const r = 판정(내선언(root, 'aaaa1111', '`tools/겹칠것.js`'), 환경('aaaa1111', 로그));
  assert.strictEqual(r.결정, 'deny', '가지 안 선언과 겹치는데 통과했다 — F528 그 자리다');
  assert.match(r.사유, /tools\/겹칠것\.js/);
  assert.match(r.사유, /worktree-남의트랙/, '어느 가지가 잡았는지 안 말하면 처방이 안 선다');
});

test('탐지력 — 막을 때 «가지 전용» 처방을 낸다(board-move 로는 안 치워진다)', () => {
  const root = 뿌리세우기();
  const 로그 = 가지로그('worktree-남의트랙', 'bbbb2222.md',
    줄('**남의 코드 트랙**', '`tools/겹칠것.js`', '작업중 (`local_bbbb2222`)'));
  const r = 판정(내선언(root, 'aaaa1111', '`tools/겹칠것.js`'), 환경('aaaa1111', 로그));
  assert.match(r.사유, /PR/, '가지 줄의 주인은 열린 PR 로 서 있다 — 그 통로를 안 알리면 따를 수 없는 처방이다(F103)');
});

test('거짓양성 없음 — 자리가 다르면 안 막는다', () => {
  const root = 뿌리세우기();
  const 로그 = 가지로그('worktree-남의트랙', 'bbbb2222.md',
    줄('**남의 코드 트랙**', '`tools/딴것.js`', '작업중 (`local_bbbb2222`)'));
  const r = 판정(내선언(root, 'aaaa1111', '`tools/겹칠것.js`'), 환경('aaaa1111', 로그));
  assert.strictEqual(r.결정, 'allow', `자리가 다른데 막았다 — 거짓 차단은 관습을 죽인다:\n${r.사유}`);
});

test('거짓양성 없음 — 가지에 있는 것이 «내 파일»이면 내 줄이다', () => {
  const root = 뿌리세우기();
  /* 내 보드 파일의 가지판(내가 워크트리에서 먼저 선언한 판)이 나를 막으면 안 된다 — F291 과 같은 축.
   * 🔑 상태 칸에 **지문을 안 적는다**: 적으면 아래 결과가 「파일이 내 것이라」가 아니라
   *   「지문이 내 것이라」 통과한 것이 되고, 그러면 이 검사는 파일 필터를 안 재는 셈이다.
   *   실측(변이 ㉣): 지문을 적어 뒀더니 파일 필터를 통째로 지워도 7건이 전부 초록이었다. */
  const 로그 = 가지로그('worktree-내트랙', 'aaaa1111.md',
    줄('**내 옛 트랙**', '`tools/겹칠것.js`', '작업중'));
  const r = 판정(내선언(root, 'aaaa1111', '`tools/겹칠것.js`'), 환경('aaaa1111', 로그));
  assert.strictEqual(r.결정, 'allow', `내 파일의 가지판이 나를 막았다:\n${r.사유}`);
});

test('거짓양성 없음 — 같은 지문이 적힌 가지 줄은 이번 세션 것이다', () => {
  const root = 뿌리세우기();
  const 로그 = 가지로그('worktree-내트랙', 'cccc3333.md',
    줄('**내가 아까 적은 줄**', '`tools/겹칠것.js`', '작업중 (`local_aaaa1111`)'));
  const r = 판정(내선언(root, 'aaaa1111', '`tools/겹칠것.js`'), 환경('aaaa1111', 로그));
  assert.strictEqual(r.결정, 'allow', `내 지문이 적힌 줄이 나를 막았다:\n${r.사유}`);
});

test('완료·대기 줄은 자리를 안 잡는다 — 활성만 분모다', () => {
  const root = 뿌리세우기();
  const 로그 = 가지로그('worktree-끝난트랙', 'bbbb2222.md',
    줄('**끝난 트랙**', '`tools/겹칠것.js`', '✅완료 (`local_bbbb2222`)'));
  const r = 판정(내선언(root, 'aaaa1111', '`tools/겹칠것.js`'), 환경('aaaa1111', 로그));
  assert.strictEqual(r.결정, 'allow', `완료 줄이 자리를 잡았다:\n${r.사유}`);
});

test('모름은 0건이 아니다 — 못 훑으면 그렇게 말한다(F207)', () => {
  const root = 뿌리세우기();
  /* 주입 없이 임시 뿌리에서 돌면 `git log --branches` 가 진다 = 모름. 그때 조용하면
     「가지에 선언 0」과 구별이 안 되고, 그 침묵이 정확히 F528 의 얼굴이다. */
  const env = { CLAUDE_CODE_HOST_SESSION_ID: 'local_aaaa1111' };
  delete env.SYNK_BOARD_BRANCH_LOG;
  const r = 판정(내선언(root, 'aaaa1111', '`tools/겹칠것.js`'), env);
  assert.strictEqual(r.결정, 'allow', '못 훑었다고 막으면 안 된다 — 모름은 차단 사유가 아니다');
  assert.match(`${r.알림}${r.사유}`, /모름|못 훑/, '못 훑은 것을 조용히 0으로 읽었다(F207)');
});
