/* 이해대장 «동봉» 게이트 회귀 (유호 지시 2026-08-14 「정본 고칠 때 이해대장 재생성 자동으로」)
 *
 * 무엇을 지키나 — `docs/SYNK_철학.md` 를 고치면서 그 파생인 `docs/이해대장.html` 을 두고 가는 커밋을
 *   **커밋 전에** 막는다. 안 막으면 `tests/이해대장.test.js` 가 HEAD 에서 빨개지고, 그 적색은 낸
 *   사람이 아니라 **그 뒤 커밋하는 모든 세션의 배포**를 막는다(08-14 하루에 회수 커밋 넷).
 *
 * 🔑 탐지력은 **픽스처가 진다** — 실저장소에는 거짓양성만 묻는다(가드 맹점 ②: 버그가 아직 있을 것을
 *   요구하는 회귀 금지). 형제 저장소가 없는 기계는 fail 이 아니라 skip 으로 드러낸다(F296·F207).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const 도구 = path.join(ROOT, 'tools', '이해대장.js');
const 정본실물 = path.join(ROOT, 'docs', 'SYNK_철학.md');
const 산출실물 = path.join(ROOT, 'docs', '이해대장.html');
const 훅원본 = path.join(ROOT, 'tools', 'githooks', 'pre-commit');

/** `--검사` 를 사본 두 벌에 대고 돌린다 — 저장소 파일은 읽기만 한다(옆 세션의 작업본을 흔들지 않는다). */
function 검사(화면내용) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-대장시험-'));
  try {
    const 정본 = path.join(방, 'a.md');
    const 산출 = path.join(방, 'b.html');
    fs.copyFileSync(정본실물, 정본);
    if (화면내용 !== null) fs.writeFileSync(산출, 화면내용, 'utf8');
    const r = spawnSync(process.execPath, [도구, '--검사'], {
      cwd: ROOT, encoding: 'utf8',
      env: { ...process.env, SYNK_대장_정본: 정본, SYNK_대장_산출: 산출 },
    });
    return { 막혔나: r.status !== 0, 출력: String(r.stderr || '') + String(r.stdout || '') };
  } finally { try { fs.rmSync(방, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 판정이 아니다 */ } }
}

/* 형제 저장소가 없는 기계에서는 판정층이 「못 쟀다」로 접는다(그게 옳다 · F103) — 그 환경에서
 * 탐지력을 단언하면 **환경 탓 적색**이 되므로, 미실행을 fail 아닌 skip 으로 드러낸다(F296). */
const 잴수있나 = () => !/못 했다/.test(검사(fs.readFileSync(산출실물, 'utf8')).출력);

/* ── 탐지력 ──────────────────────────────────────────────────────────── */

test('🔴 급소 — 화면이 정본을 안 따라오면 막는다 (이 커밋이 만드는 HEAD 가 빨갛다)', (t) => {
  if (!fs.existsSync(산출실물)) return t.skip('산출물이 없다 — 이 환경에선 못 잰다');
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(fs.readFileSync(산출실물, 'utf8') + '<!-- 낡음 -->');
  assert.ok(r.막혔나, '낡은 화면을 실은 커밋이 그대로 나갔다 — 그 뒤 모든 세션의 배포가 막힌다');
  assert.match(r.출력, /이해대장\.html/, '막히긴 했는데 어느 파일인지 안 말한다 — 처방이 없으면 다음 수는 BYPASS 다');
});

test('🔴 화면이 아예 없어도 막는다 — 「없다」와 「같다」가 같은 모양이면 안 된다', (t) => {
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(null);
  assert.ok(r.막혔나, '화면이 없는데 통과시켰다');
  assert.match(r.출력, /없다/, '없다는 사실을 안 말한다');
});

/* ── 자기 처방이 실제로 통하는가 (맹점 ③ — 따를 수 없는 처방은 우회를 정상 통로로 만든다) ── */

test('🔑 차단문이 시키는 대로 다시 그리면 그대로 통과한다', (t) => {
  if (!fs.existsSync(산출실물)) return t.skip('산출물이 없다 — 이 환경에선 못 잰다');
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(fs.readFileSync(산출실물, 'utf8'));
  assert.strictEqual(r.막혔나, false, `처방대로 했는데 또 막혔다 — 그러면 남는 문은 BYPASS 뿐이다:\n${r.출력}`);
});

test('🔑 차단문이 **그대로 칠 수 있는 명령**을 내민다 (손으로 옮겨 적게 하면 안 따른다 · F103)', (t) => {
  if (!잴수있나()) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  const r = 검사(null);
  assert.match(r.출력, /node tools\/이해대장\.js/, '다시 그리는 명령이 없다');
  assert.match(r.출력, /git add -- docs\/이해대장\.html/, '같은 커밋에 담는 방법을 안 준다(F302 가 이 가드의 이유다)');
});

/* ── 등재 — 도구만 두고 안 부르면 장치는 안 돈다 ─────────────────────── */

test('실저장소: pre-commit 이 이 게이트를 부른다 (스스로 발화하지 않는 장치는 안 돈다)', () => {
  assert.match(fs.readFileSync(훅원본, 'utf8'), /대장동봉검사\.js/,
    '훅이 이 게이트를 안 부른다 — 장치와 발동 조건은 같은 커밋에서 정한다');
});

test('실저장소: 설치본(.git/hooks)도 최신이라 실제로 돈다', (t) => {
  const 설치본 = path.join(ROOT, '.git', 'hooks', 'pre-commit');
  if (!fs.existsSync(설치본)) return t.skip('훅이 이 기계에 안 깔렸다 — node tools/install-githooks.js');
  assert.match(fs.readFileSync(설치본, 'utf8'), /대장동봉검사\.js/,
    '설치본이 낡았다(원본만 고쳤다) — node tools/install-githooks.js 로 다시 깐다');
});

/* ── 실저장소: 거짓양성만 묻는다 ─────────────────────────────────────── */

test('실저장소: 지금 커밋된 화면은 정본과 같다 (거짓양성 검사 — 탐지력은 위 픽스처가 진다)', (t) => {
  if (!fs.existsSync(산출실물)) return t.skip('산출물이 없다 — 이 환경에선 못 잰다');
  const r = 검사(fs.readFileSync(산출실물, 'utf8'));
  if (/못 했다/.test(r.출력)) return t.skip('형제 저장소를 못 읽어 판정층이 접혔다(F296)');
  assert.strictEqual(r.막혔나, false, `실저장소가 이미 갈라져 있다 — node tools/이해대장.js:\n${r.출력}`);
});
