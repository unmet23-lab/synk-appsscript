/* 이해대장 «동봉» 게이트 — **배선** 회귀 (인계 `6ca71005` 의 남은 검증 1 · 2026-08-14)
 *
 * 무엇이 비어 있었나 — 옆 파일 `tests/대장동봉.test.js` 는 **판정층**(`tools/이해대장.js --검사`)을
 *   이음매(`SYNK_대장_정본`·`SYNK_대장_산출`)에 직접 대고 재고, 등재는 훅 파일을 `grep` 해서 잰다.
 *   그 둘 사이의 **배선** — 진짜 `git commit` 이 진짜 pre-commit 을 타고 이 게이트에 닿아 실제로
 *   막히는가 — 은 어느 층도 안 쟀다. 등재 grep 은 「이름이 적혀 있다」까지고, 이음매 시험은
 *   「불렀을 때 옳게 답한다」까지다. 둘 다 초록인데 커밋이 안 막히는 상태가 성립한다.
 *
 * ☠️ 이 게이트가 죽는 가장 그럴듯한 방법은 **작업본을 재는 것**이다(F302). 양쪽을 다 고쳐 놓고
 *   정본만 커밋하면 작업본은 초록인데 HEAD 는 빨갛다. 옆 파일은 임시 사본을 손으로 만들어
 *   먹이므로 원리상 그 자리를 못 본다 — 인덱스/HEAD 를 실제로 고르는 것은 여기서만 재진다.
 *
 * 🔑 판정기는 **대역**이다(실물이 아니다) — 실물 `--검사` 는 형제 저장소 실측이 서야 답하므로
 *   1회용 저장소에 실으면 이 시험 전체가 환경 탓으로 skip 된다(F296). 대신 대역을 예스맨으로
 *   두지 않고 **같은 이음매를 읽어 내용으로 판정**하게 했다: 그래야 「불렸나」가 아니라
 *   «무엇을 먹였나»가 재진다 — 이 파일이 지는 것이 바로 그 「무엇을」이다.
 *
 * 🔑 대역이 **정본의 첫 줄에만** 반응하는 것도 실물을 따른 것이다 — 실물 화면은 정본 전문이
 *   아니라 판·대장 칸에서 나오므로, 정본을 고쳐도 화면이 그대로인 개정이 실재한다. 그 갈래가
 *   있어야 「거짓 차단」과 「삭제를 놓친다」를 가려 잴 수 있다.
 *
 * 🔑 탐지력은 픽스처가 진다 — 실저장소에는 아무것도 묻지 않는다(옆 파일이 거짓양성을 맡는다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const 훅원본 = path.join(ROOT, 'tools', 'githooks', 'pre-commit');
const 게이트원본 = path.join(ROOT, 'tools', '대장동봉검사.js');
const 정본경로 = 'docs/SYNK_철학.md';
const 산출경로 = 'docs/이해대장.html';

/* 🔑 [F520] 화면의 부모는 **둘**이다 — 정본(무엇을 그리나 = 첫 줄)과 생성기(어떻게 그리나 = 판형).
 *   실물도 그렇다: `tools/이해대장.js` 를 고치면 **같은 정본에서 다른 HTML** 이 나온다. 대역이 이
 *   둘째 부모를 안 지면 「생성기만 담은 커밋」을 원리상 못 재고, 그 자리가 F520 이 샌 자리다. */
const 그린다 = (정본내용, 판형 = 'v1') => `<!-- ${String(정본내용).split('\n')[0].trim()} · ${판형} -->\n`;

/* 판정층 대역 — 실물과 같은 이음매를 읽고, 산출이 **두 부모**의 파생인지 내용으로 답한다.
 * 실물의 처방(다시 그리기 · 같은 커밋에 담기)도 그대로 낸다: 차단문이 그대로 칠 수 있는
 * 명령을 안 내밀면 다음 수는 BYPASS 다(F103). 처방의 «경로»는 이음매(`SYNK_대장_방아쇠`)로
 * 받는다 — 실물이 그러하고, 그래야 「무엇을 먹였나」가 여기서 재진다. */
const 대역판정기 = (판형 = 'v1') => `#!/usr/bin/env node
'use strict';
const fs = require('fs');
if (!process.argv.includes('--검사')) process.exit(0);
const 정본 = process.env.SYNK_대장_정본;
const 산출 = process.env.SYNK_대장_산출;
if (!정본) {
  console.error('[이해대장] 이음매(SYNK_대장_정본)가 안 왔다 — 동기 대조를 **못 했다**.');
  process.exit(0);
}
const 판 = fs.readFileSync(정본, 'utf8').split('\\n')[0].trim();
const 그려야할것 = '<!-- ' + 판 + ' · ${판형} -->\\n';
const 지금 = fs.existsSync(산출) ? fs.readFileSync(산출, 'utf8') : null;
if (지금 === 그려야할것) {
  console.log('[이해대장] 커밋될 화면이 정본 ' + 판 + ' 와 같다 — 통과.');
  process.exit(0);
}
const 방아쇠 = (process.env.SYNK_대장_방아쇠 || 'docs/SYNK_철학.md').split('\\n').filter(Boolean);
console.error('[이해대장] 차단 — 화면(docs/이해대장.html)이 ' + (지금 === null ? '**없다**' : '**안 따라온다**') + '.');
console.error('  → node tools/이해대장.js  &&  git add -- docs/이해대장.html');
console.error('     git commit -m "…" -- ' + 방아쇠.join(' ') + ' docs/이해대장.html');
process.exit(1);
`;

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new Error(`git ${args.join(' ')} 실패 — ${r.error ? r.error.code : r.status}\n${r.stderr || ''}`);
  }
  return r.stdout;
}

/** 실 훅·실 게이트를 그대로 실은 1회용 저장소. HEAD = 정본과 화면이 서로 맞는 상태. */
function mkRepo(정본내용 = '판 v1\n본문 한 줄') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-대장E2E-'));
  git(dir, ['init', '-b', 'master']);
  git(dir, ['config', 'user.email', 'test@synk.local']);
  git(dir, ['config', 'user.name', 'test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);

  const hooks = path.join(dir, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const dst = path.join(hooks, 'pre-commit');
  fs.copyFileSync(훅원본, dst);
  try { fs.chmodSync(dst, 0o755); } catch (_) { /* Windows */ }

  /* 게이트는 실물을 그대로 싣는다 — 이 시험의 과녁이 그것이다. 옆 게이트들(계약동봉·옛글자·
   * 인용검사)은 **일부러 안 싣는다**: 훅이 「없으면 막지 않고 말한다」로 넘어가는 규약이라
   * 픽스처에서 0을 내는 자리지기가 되고, 그 자리가 규약대로 도는지도 같이 드러난다. */
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  fs.copyFileSync(게이트원본, path.join(dir, 'tools', '대장동봉검사.js'));
  fs.writeFileSync(path.join(dir, 'tools', '이해대장.js'), 대역판정기(), 'utf8');

  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 정본경로), 정본내용, 'utf8');
  fs.writeFileSync(path.join(dir, 산출경로), 그린다(정본내용), 'utf8');
  git(dir, ['add', '--', 'docs', 'tools']);
  git(dir, ['commit', '-m', '초기']);
  return dir;
}

/** `git commit -m … -- 경로들` — 범위를 못 박는 실제 통로 그대로.
 *  ⚠ 못 띄운 것을 「막혔다」로 번역하지 않는다(status null 은 결과가 아니다 · `tests/lib/훅띄우기` 축).
 *  ⚠ `execFileSync` 가 아니라 `spawnSync` 인 이유: 훅의 말은 전부 stderr 인데 성공 갈래에서
 *     그것을 못 돌려주면 「말했나」를 묻는 단언이 빈 문자열에 대고 통과한다. */
function 커밋(dir, 경로들, env) {
  const r = spawnSync('git', ['commit', '-m', '시도', '--', ...경로들],
    { cwd: dir, encoding: 'utf8', env: env || process.env });
  if (r.error || r.status === null) {
    throw new Error(`git 을 못 띄웠다 — 미실행은 차단이 아니다: ${r.error ? r.error.code : r.signal}`);
  }
  return { 막혔나: r.status !== 0, 출력: String(r.stderr || '') + String(r.stdout || '') };
}

/** 경로를 안 대는 커밋 — 이때만 **인덱스**가 커밋 내용이다.
 *  ⚠ `git commit -- 경로들` 은 그 경로에 대해 **작업본**을 담으므로 인덱스와 작업본이
 *  갈린 상태를 원리상 못 만든다. 그 갈림을 재려면 이 통로여야 한다. */
function 커밋전체(dir) {
  const r = spawnSync('git', ['commit', '-m', '시도'], { cwd: dir, encoding: 'utf8' });
  if (r.error || r.status === null) {
    throw new Error(`git 을 못 띄웠다 — 미실행은 차단이 아니다: ${r.error ? r.error.code : r.signal}`);
  }
  return { 막혔나: r.status !== 0, 출력: String(r.stderr || '') + String(r.stdout || '') };
}

/** 생성기를 다른 «판형»으로 갈아 스테이징한다 — 같은 정본에서 다른 화면이 나오는 실제 모양. */
function 생성기를간다(dir, 판형, { 담을까 = true } = {}) {
  fs.writeFileSync(path.join(dir, 'tools', '이해대장.js'), 대역판정기(판형), 'utf8');
  if (담을까) git(dir, ['add', '--', 'tools/이해대장.js']);
}

const 준비 = (t, ...a) => { try { return mkRepo(...a); } catch (_) { return t.skip('git 을 못 돌린다'), null; } };
const 방들 = [];
const 쓰고버린다 = (t, ...a) => { const d = 준비(t, ...a); if (d) 방들.push(d); return d; };
test.after(() => { for (const d of 방들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 판정이 아니다 */ } } });

/* ── 배선이 실제로 닿는가 ────────────────────────────────────────────── */

test('🔴 급소 — 정본만 담은 커밋이 **진짜로** 막힌다 (등재 grep 도 이음매 시험도 여기를 못 본다)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, 정본경로), '판 v2\n본문 한 줄', 'utf8');
  const r = 커밋(dir, [정본경로]);
  assert.ok(r.막혔나, '정본만 담은 커밋이 그대로 나갔다 — 그 뒤 커밋하는 모든 세션의 배포가 막힌다');
  assert.match(r.출력, /이해대장\.html/, '막히긴 했는데 어느 파일인지 안 말한다 — 처방이 없으면 다음 수는 BYPASS 다');
});

test('🔴 급소 — 작업본에선 양쪽을 고쳤어도 정본만 커밋하면 막는다 (작업본을 재면 여기서 샌다 · F302)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, 정본경로), '판 v2\n본문 한 줄', 'utf8');
  fs.writeFileSync(path.join(dir, 산출경로), 그린다('판 v2'), 'utf8');   // 작업본은 초록이다
  const r = 커밋(dir, [정본경로]);                                        // 그런데 범위엔 정본만 있다
  assert.ok(r.막혔나, '작업본이 초록이라 통과시켰다 — 이 커밋이 만드는 HEAD 는 빨갛다(F302)');
});

test('🔑 차단문이 시키는 대로 둘 다 담으면 그대로 통과한다 (따를 수 없는 처방은 우회를 정상 통로로 만든다)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, 정본경로), '판 v2\n본문 한 줄', 'utf8');
  fs.writeFileSync(path.join(dir, 산출경로), 그린다('판 v2'), 'utf8');
  const r = 커밋(dir, [정본경로, 산출경로]);
  assert.strictEqual(r.막혔나, false, `처방대로 했는데 또 막혔다 — 그러면 남는 문은 BYPASS 뿐이다:\n${r.출력}`);
});

test('🔴 급소 — 정본을 고치면서 화면을 **지우는** 커밋도 막는다 (스테이징된 삭제는 ACMR 에 안 잡힌다)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  // 화면이 안 바뀌는 개정(본문만 손댐)이라 HEAD 판본을 재면 「같다」가 나온다 — 그런데 이
  // 커밋이 끝나면 화면은 **없다.** 삭제를 못 보는 게이트는 여기서 조용히 통과한다.
  fs.writeFileSync(path.join(dir, 정본경로), '판 v1\n본문 두 줄', 'utf8');
  fs.rmSync(path.join(dir, 산출경로));
  git(dir, ['add', '--', 산출경로]);
  const r = 커밋(dir, [정본경로, 산출경로]);
  assert.ok(r.막혔나, '화면을 지우는 커밋이 통과했다 — 커밋 뒤 화면이 없는데 게이트는 HEAD 사본을 봤다');
  assert.match(r.출력, /없다/, `막히긴 했는데 「없다」가 아니라 다른 이유를 댔다 — 처방이 어긋난다:\n${r.출력}`);
});

/* ── 둘째 부모: 생성기 (F520 — 게이트가 이 축을 원리상 못 보던 자리) ─────
 * 실측 2026-08-17: `tools/이해대장.js` 를 만진 커밋 **합계 12 = 동봉 0 + 두고감 12**.
 * 그중 `d17c95ed`(Stop 훅 자동커밋)는 화면을 낡은 채 HEAD 에 세웠고, 다음 커밋이 사람 손으로
 * 맞출 때까지 남아 있었다 — 즉 **아무도 안 맞췄으면 그대로 남았다**. 게이트는 그때 「통과」였다:
 * 판정층이 틀린 게 아니라 **발동 조건이 정본 하나만 봤다**(신고문의 후보 ㉡이 참 · ㉠은 기각 —
 * 훅은 그 커밋에서 실제로 돌았다). */

test('🔴 급소 — 생성기만 담은 커밋이 화면을 두고 가면 막힌다 (F520 · 여기가 12/12 로 새던 자리)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  생성기를간다(dir, 'v2');                                    // 같은 정본인데 다른 화면이 나온다
  const r = 커밋(dir, ['tools/이해대장.js']);
  assert.ok(r.막혔나,
    `생성기만 담은 커밋이 그대로 나갔다 — 화면이 «도구보다 낡은» 채 HEAD 에 선다(F520):\n${r.출력}`);
  assert.match(r.출력, /이해대장\.html/, '막히긴 했는데 어느 파일인지 안 말한다 — 처방이 없으면 다음 수는 BYPASS 다');
});

test('🔴 급소 — 차단문이 **생성기 경로**를 처방에 댄다 (정본을 대면 따를수록 트랙이 갈린다 · F302)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  생성기를간다(dir, 'v2');
  const r = 커밋(dir, ['tools/이해대장.js']);
  assert.ok(r.막혔나, r.출력);
  assert.match(r.출력, /git commit[^\n]*tools\/이해대장\.js/,
    `처방이 «담아야 할 경로»로 생성기를 안 댄다 — 그대로 따르면 생성기가 그 커밋에서 빠져\n`
    + `트랙이 두 커밋으로 갈리고, 그 틈에 남이 배포하면 첫 커밋만 담긴 배포본이 남는다(F302):\n${r.출력}`);
  assert.doesNotMatch(r.출력, /git commit[^\n]*SYNK_철학\.md/,
    `생성기 커밋인데 처방이 정본을 담으라고 한다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103):\n${r.출력}`);
});

test('🔑 처방대로 생성기와 화면을 함께 담으면 그대로 통과한다 (자기 처방이 실제로 통하는가 · 맹점 ③)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  생성기를간다(dir, 'v2');
  fs.writeFileSync(path.join(dir, 산출경로), 그린다('판 v1', 'v2'), 'utf8');
  const r = 커밋(dir, ['tools/이해대장.js', 산출경로]);
  assert.strictEqual(r.막혔나, false, `처방대로 했는데 또 막혔다 — 그러면 남는 문은 BYPASS 뿐이다:\n${r.출력}`);
});

test('생성기를 고쳐도 화면이 그대로면 통과한다 (전건 차단은 BYPASS 습관을 만든다 · 주석·리팩터가 대부분이다)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, 'tools', '이해대장.js'), 대역판정기() + '// 주석만 더했다\n', 'utf8');
  git(dir, ['add', '--', 'tools/이해대장.js']);
  const r = 커밋(dir, ['tools/이해대장.js']);
  assert.strictEqual(r.막혔나, false,
    `화면이 안 바뀌는 생성기 수정을 막았다 — 그러면 그 파일을 한 글자도 못 고친다:\n${r.출력}`);
});

/* ── 통과와 미실행이 같은 모양이면 안 된다 — 생성기 축 (F207 · F302) ───── */

test('🔴 생성기의 스테이징분과 작업본이 갈리면 **막지 않고 말한다** — 그리는 몸이 커밋될 내용이 아니다', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  생성기를간다(dir, 'v2');                                     // 인덱스 = v2
  생성기를간다(dir, 'v3', { 담을까: false });                   // 작업본 = v3 (안 담았다)
  const r = 커밋전체(dir);                                     // 경로를 안 대야 인덱스가 커밋 내용이다
  assert.strictEqual(r.막혔나, false,
    `못 쟀는데 막았다 — 판정 못 하는 상태를 차단으로 바꾸면 그 세션은 생성기를 못 고친다(F103):\n${r.출력}`);
  assert.match(r.출력, /\[이해대장\][^\n]*못 했다/,
    `못 쟀는데 이 게이트가 조용했다 — 통과와 미실행이 같은 모양이 됐다(F207):\n${r.출력}`);
});

/* ⚠ 이 시험이 없으면 위 대조의 «줄끝접기»가 통째로 안 재진다 — 변이로 실측했다(구멍 1건).
 * 인덱스 블롭은 LF 인데 작업본은 CRLF 로 체크아웃되므로(core.autocrlf=true), 안 접으면 이 게이트가
 * **윈도우에서 언제나 「못 했다」**가 된다. 그 모양은 통과와 같아서 아무도 못 본다 —
 * 08-14 에 옆 판정층이 같은 줄끝 축에서 저장소 전체 배포를 멈춘 그 자리다. */
test('🔴 줄끝만 다른 생성기는 «갈렸다»가 아니다 — 안 접으면 이 게이트가 윈도우에서 영영 「못 했다」다', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  생성기를간다(dir, 'v2');                                     // 인덱스 = v2 (LF)
  const 몸 = fs.readFileSync(path.join(dir, 'tools', '이해대장.js'), 'utf8');
  fs.writeFileSync(path.join(dir, 'tools', '이해대장.js'), 몸.replace(/\r?\n/g, '\r\n'), 'utf8'); // 작업본 = 같은 v2 (CRLF)
  const r = 커밋전체(dir);
  assert.doesNotMatch(r.출력, /스테이징분과 작업본이 달라/,
    `줄끝만 다른 같은 생성기를 «갈렸다»로 읽었다 — 이 게이트가 윈도우에서 한 번도 안 서게 된다:\n${r.출력}`);
  assert.ok(r.막혔나,
    `못 쟀다고 접고 통과시켰다 — 줄끝을 접었으면 판정까지 가서 낡은 화면을 막았어야 한다:\n${r.출력}`);
});

/* ── 거짓 차단 (거짓 차단은 곧 꺼지는 가드다) ───────────────────────── */

test('부모가 **둘 다** 안 담긴 커밋에서는 게이트가 아예 안 선다 (매 커밋 소음 0)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, 'docs', '아무거나.md'), '내용\n', 'utf8');
  git(dir, ['add', '--', 'docs/아무거나.md']);
  const r = 커밋(dir, ['docs/아무거나.md']);
  assert.strictEqual(r.막혔나, false, r.출력);
  assert.doesNotMatch(r.출력, /\[이해대장\]/, '무관한 커밋에서 이 게이트가 말을 했다 — 매 커밋 소음이 된다');
});

test('화면이 안 바뀌는 정본 개정은 정본만 담아도 통과한다 (전건 차단은 BYPASS 습관을 만든다)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, 정본경로), '판 v1\n본문 두 줄', 'utf8');
  const r = 커밋(dir, [정본경로]);
  assert.strictEqual(r.막혔나, false, `화면이 그대로인 개정을 막았다 — 정본을 한 글자도 못 고치게 된다:\n${r.출력}`);
});

test('화면만 다시 그려 담는 커밋(정본 무변경)은 안 막는다 — 회수 커밋 자체를 막으면 통로가 사라진다', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, 산출경로), 그린다('판 v1') + '<!-- 다시 그림 -->\n', 'utf8');
  const r = 커밋(dir, [산출경로]);
  assert.strictEqual(r.막혔나, false, `화면만 담은 커밋을 막았다 — 그러면 낡은 화면을 고칠 방법이 없다:\n${r.출력}`);
});

/* ── 통과와 미실행이 같은 모양이면 안 된다 (F207 · F103) ─────────────── */

test('판정기가 통째로 없으면 **막지 않고 말한다** — 없는 것과 갈라진 것은 다르다(F103)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.rmSync(path.join(dir, 'tools', '이해대장.js'));                    // 부분 체크아웃·낡은 워크트리
  fs.writeFileSync(path.join(dir, 정본경로), '판 v2\n본문 한 줄', 'utf8');
  const r = 커밋(dir, [정본경로]);
  assert.strictEqual(r.막혔나, false,
    `판정기가 없다는 이유로 커밋을 막았다 — 그 세션은 정본을 한 글자도 못 고친다(F103):\n${r.출력}`);
  assert.match(r.출력, /\[이해대장\][^\n]*못 했다/,
    `못 쟀는데 이 게이트가 조용했다 — 통과와 미실행이 같은 모양이 됐다(F207):\n${r.출력}`);
});

test('통과할 때도 이 게이트가 무엇을 쟀는지 말한다 (분모 없는 초록은 못 읽는다 · F207)', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, 정본경로), '판 v2\n본문 한 줄', 'utf8');
  fs.writeFileSync(path.join(dir, 산출경로), 그린다('판 v2'), 'utf8');
  const r = 커밋(dir, [정본경로, 산출경로]);
  assert.match(r.출력, /\[이해대장\]/, '통과 보고가 없다 — 0건 실행(게이트가 안 선 것)과 구분이 안 된다');
});

/* ── 워크트리 층 (F403 이 남긴 자리 — 「어디에도 없다」는 층을 먼저 열거한다) ── */

test('🔴 다른 저장소를 가리키는 `CLAUDE_PROJECT_DIR` 이 있어도 **커밋되는 저장소**를 잰다', (t) => {
  const dir = 쓰고버린다(t); if (!dir) return;
  const 남 = 쓰고버린다(t, '남의 판\n남의 본문'); if (!남) return;     // 정본이 안 담긴 깨끗한 저장소
  fs.writeFileSync(path.join(dir, 정본경로), '판 v2\n본문 한 줄', 'utf8');
  const r = 커밋(dir, [정본경로], { ...process.env, CLAUDE_PROJECT_DIR: 남 });
  assert.ok(r.막혔나,
    '옆 저장소의 인덱스를 재고 통과시켰다 — 워크트리에서 커밋하면 이 게이트가 통째로 눈이 먼다(F403)');
});
