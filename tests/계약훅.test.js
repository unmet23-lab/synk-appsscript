/* pre-commit 계약 갈라짐 가드 회귀 (유호님 확정 ㉮ · 2026-08-07)
 *
 * 무엇을 지키나 — 계약 파일(`계약/수집_교정_계약.json`)이 스테이징되면 커밋 전에
 *   `tools/계약동기화.js --check` 가 돈다. 그게 갈라짐을 잡던 유일한 장치인
 *   `tests/계약.test.js` 가 **형제 저장소가 없으면 skip** 이고 Actions 는 자기 저장소만
 *   checkout 하기 때문이다 — 그래서 계약이 갈라져도 양쪽 CI 가 다 초록이었다.
 *
 * ☠️ 이 가드가 죽는 가장 그럴듯한 방법은 로직이 아니라 **경로 대조**다. `git diff --cached
 *   --name-only` 는 기본값이 비ASCII 를 `"\352\263\204..."` 로 이스케이프해서, 한글 경로는
 *   영원히 안 맞는다 — 그리고 그 모양은 「검사가 통과했다」와 똑같다. 그래서 이 회귀의
 *   본체는 **한글 경로가 실제로 걸리는가**이고, 픽스처 저장소가 그 탐지력을 진다.
 *   (실저장소는 「설치돼 있고 원본과 같은가」만 본다 — 진짜 커밋을 만들지 않는다.)
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOOK_SRC = path.join(ROOT, 'tools', 'githooks', 'pre-commit');
const 계약경로 = '계약/수집_교정_계약.json';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** 훅이 설치된 1회용 저장소. `종료코드` = 가짜 계약동기화.js 가 낼 값(1이면 갈라진 상태). */
function mkRepo(종료코드) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contracthook-'));
  git(dir, ['init', '-b', 'master']);
  git(dir, ['config', 'user.email', 'test@synk.local']);
  git(dir, ['config', 'user.name', 'test']);
  const hooks = path.join(dir, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const dst = path.join(hooks, 'pre-commit');
  fs.copyFileSync(HOOK_SRC, dst);
  try { fs.chmodSync(dst, 0o755); } catch (_) { /* Windows */ }

  // 판정은 도구가 진다 — 여기서는 그 자리에 **부르면 티가 나는** 가짜를 둔다.
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'tools', '계약동기화.js'),
    `console.error('불렸다'); process.exit(${종료코드});\n`, 'utf8');
  return dir;
}

function 커밋시도(dir, 상대경로) {
  const 절대 = path.join(dir, 상대경로);
  fs.mkdirSync(path.dirname(절대), { recursive: true });
  fs.writeFileSync(절대, '{}\n', 'utf8');
  git(dir, ['add', '--', 상대경로]);
  try {
    git(dir, ['commit', '-m', '시도']);
    return { 막혔나: false, 출력: '' };
  } catch (e) {
    return { 막혔나: true, 출력: String(e.stderr || '') + String(e.stdout || '') };
  }
}

test('🔴 계약 파일이 스테이징되면 검사가 돈다 — 한글 경로가 이스케이프되면 여기가 조용히 통과한다', (t) => {
  let dir;
  try { dir = mkRepo(1); } catch (_) { return t.skip('git 을 못 돌린다'); }
  const r = 커밋시도(dir, 계약경로);
  assert.ok(r.막혔나, '계약이 갈라졌는데 커밋이 그대로 됐다 — 훅이 이 경로를 못 걸렀다');
  assert.match(r.출력, /불렸다/, '막히긴 했는데 계약동기화를 부른 흔적이 없다 — 다른 이유로 실패했다');
});

test('계약이 같으면 막지 않는다 (거짓 차단은 곧 꺼지는 가드다)', (t) => {
  let dir;
  try { dir = mkRepo(0); } catch (_) { return t.skip('git 을 못 돌린다'); }
  assert.strictEqual(커밋시도(dir, 계약경로).막혔나, false, '도구가 0을 냈는데 커밋이 막혔다');
});

test('계약과 무관한 파일은 검사를 아예 안 돌린다 (매 커밋 세금이 되면 안 된다)', (t) => {
  let dir;
  try { dir = mkRepo(1); } catch (_) { return t.skip('git 을 못 돌린다'); }
  // 도구는 1을 내도록 두되 **부르지 말아야** 한다 — 부르면 이 커밋이 막힌다.
  assert.strictEqual(커밋시도(dir, 'docs/아무거나.md').막혔나, false,
    '계약과 무관한 커밋에서 계약 검사가 돌았다');
});

test('실저장소: 훅이 설치돼 있고 원본과 같다 (원본만 고치고 설치를 잊으면 안 돈다)', (t) => {
  const 설치 = path.join(ROOT, '.git', 'hooks', 'pre-commit');
  if (!fs.existsSync(설치)) {
    return t.skip('이 기계에 pre-commit 이 설치돼 있지 않다 — `node tools/install-githooks.js`');
  }
  assert.strictEqual(
    fs.readFileSync(설치, 'utf8').replace(/\r\n/g, '\n'),
    fs.readFileSync(HOOK_SRC, 'utf8').replace(/\r\n/g, '\n'),
    '설치된 훅이 원본과 다르다 — 고친 쪽이 안 돌고 있다');
});
