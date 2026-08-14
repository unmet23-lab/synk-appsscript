/* 계약 픽스처 «동봉» 게이트 회귀 (자율주행 판정 0814 #26)
 *
 * 무엇을 지키나 — 계약의 `픽스처_항목필드` 가 늘었는데 `엔진_수집.js` 의 조립부가 따라오지
 *   않은 커밋을 **커밋 전에** 막는다. 안 막으면 `tests/계약.test.js` 가 HEAD 에서 빨개지고,
 *   그 적색은 낸 사람이 아니라 **그 뒤 커밋하는 모든 세션의 배포**를 막는다(v9.173·v9.220).
 *
 * ☠️ 이 가드가 죽는 가장 그럴듯한 방법 — **작업본을 재는 것**. 양쪽을 다 고쳐 놓고 계약만
 *   커밋하면 작업본은 초록인데 HEAD 는 빨갛다(F302). 작업본을 보는 검사는 원리상 그걸 못 보고,
 *   못 보는 모양은 「통과」다. 그래서 이 파일의 본체는 아래 「급소」 시험이다.
 *
 * 🔑 탐지력은 **픽스처가 진다** — 실저장소에는 거짓양성만 묻는다(CLAUDE.md 가드 맹점 ②:
 *   버그가 아직 있을 것을 요구하는 회귀 금지). repo 밖 환경(git 부재)은 fail 아닌 skip 으로 드러낸다(F296).
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
const 수집경로 = '엔진_수집.js';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const 계약을쓴다 = (dir, 필드들) => fs.writeFileSync(path.join(dir, 계약경로),
  JSON.stringify({ 계약: '픽스처 동봉 시험', 픽스처_항목필드: 필드들 }, null, 2) + '\n', 'utf8');

/** 조립부가 만드는 칸을 그대로 반영한 가짜 `엔진_수집.js`. 앵커(`항목.push({`)는 실물과 같다. */
const 조립부를쓴다 = (dir, 칸들) => fs.writeFileSync(path.join(dir, 수집경로),
  'function exportGoldenFixture_() {\n  const 항목 = [];\n  항목.push({\n'
  + 칸들.map((f) => `    ${f}: '',\n`).join('')
  + '  });\n  return 항목;\n}\n', 'utf8');

/** 실 도구·실 판정층·실 훅을 그대로 실은 1회용 저장소. HEAD = 계약·조립부가 서로 맞는 상태. */
function mkRepo(초기칸 = ['id', '종류', '출처']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enclose-'));
  git(dir, ['init', '-b', 'master']);
  git(dir, ['config', 'user.email', 'test@synk.local']);
  git(dir, ['config', 'user.name', 'test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);

  const hooks = path.join(dir, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const dst = path.join(hooks, 'pre-commit');
  fs.copyFileSync(HOOK_SRC, dst);
  try { fs.chmodSync(dst, 0o755); } catch (_) { /* Windows */ }

  /* 실 도구를 그대로 싣는다 — 가짜를 두면 「불렸나」만 재고 **판정을 안 재게** 된다.
   * 옆 게이트(계약동기화)는 이 시험의 대상이 아니라 0을 내는 자리지기로 둔다. */
  fs.mkdirSync(path.join(dir, 'tools', 'lib'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'tools', '계약동봉검사.js'), path.join(dir, 'tools', '계약동봉검사.js'));
  fs.copyFileSync(path.join(ROOT, 'tools', 'lib', '계약동봉.js'), path.join(dir, 'tools', 'lib', '계약동봉.js'));
  fs.writeFileSync(path.join(dir, 'tools', '계약동기화.js'), 'process.exit(0);\n', 'utf8');

  fs.mkdirSync(path.join(dir, '계약'), { recursive: true });
  계약을쓴다(dir, 초기칸);
  조립부를쓴다(dir, 초기칸);
  git(dir, ['add', '--', 계약경로, 수집경로, 'tools']);
  git(dir, ['commit', '-m', '초기']);
  return dir;
}

/** `git commit -- 경로들` — 범위를 못 박는 실제 통로 그대로(작업본의 나머지는 안 담긴다).
 *  ⚠ `spawnSync` 인 이유: `execFileSync` 는 **성공했을 때 stderr 를 안 돌려준다**. 훅의 말은
 *  전부 stderr 로 나가므로, 성공 갈래를 `''` 로 두면 「말했나」를 묻는 시험이 빈 문자열에
 *  대고 통과한다 — 실측으로 그렇게 됐다(내 시험이 곧 「맞는 얼굴로 틀린 값」이었다 · 맹점 ④). */
function 커밋(dir, 경로들) {
  const r = require('child_process').spawnSync('git', ['commit', '-m', '시도', '--', ...경로들],
    { cwd: dir, encoding: 'utf8' });
  return { 막혔나: r.status !== 0, 출력: String(r.stderr || '') + String(r.stdout || '') };
}

const 준비 = (t) => { try { return mkRepo(); } catch (_) { return t.skip('git 을 못 돌린다'), null; } };

/* ── 탐지력 ──────────────────────────────────────────────────────────── */

test('🔴 급소 — 작업본에선 양쪽을 고쳤어도 계약만 커밋하면 막는다 (작업본을 재면 여기서 샌다 · F302)', (t) => {
  const dir = 준비(t); if (!dir) return;
  계약을쓴다(dir, ['id', '종류', '출처', '불변']);
  조립부를쓴다(dir, ['id', '종류', '출처', '불변']);   // 작업본은 초록이다
  const r = 커밋(dir, [계약경로]);                       // 그런데 범위엔 계약만 있다
  assert.ok(r.막혔나, '작업본이 초록이라 통과시켰다 — 이 커밋이 만드는 HEAD 는 빨갛다(F302)');
  assert.match(r.출력, /불변/, '막히긴 했는데 어느 칸인지 안 말한다 — 처방이 없으면 다음 수는 BYPASS 다');
});

test('계약이 칸을 늘렸는데 조립부가 커밋에 없다 → 막는다', (t) => {
  const dir = 준비(t); if (!dir) return;
  계약을쓴다(dir, ['id', '종류', '출처', '대안태그']);
  const r = 커밋(dir, [계약경로]);
  assert.ok(r.막혔나, '계약만 늘어난 커밋이 그대로 나갔다 — 그 뒤 모든 세션의 배포가 막힌다');
  assert.match(r.출력, /대안태그/);
});

test('반대 방향 — 조립부에서 칸을 지우는 커밋도 같은 적색을 낳는다 → 막는다', (t) => {
  const dir = 준비(t); if (!dir) return;
  조립부를쓴다(dir, ['id', '종류']);                     // 「출처」를 지웠다
  const r = 커밋(dir, [수집경로]);
  assert.ok(r.막혔나, '조립부에서 칸이 사라진 커밋이 통과했다 — HEAD 적색은 방향과 무관하게 같다');
  assert.match(r.출력, /출처/);
});

/* ── 자기 처방이 실제로 통하는가 (맹점 ③ — 따를 수 없는 처방은 우회를 정상 통로로 만든다) ── */

test('🔑 차단문이 시키는 대로 동봉하면 그대로 통과한다', (t) => {
  const dir = 준비(t); if (!dir) return;
  계약을쓴다(dir, ['id', '종류', '출처', '불변']);
  조립부를쓴다(dir, ['id', '종류', '출처', '불변']);
  const r = 커밋(dir, [계약경로, 수집경로]);            // 차단문의 처방 = 같은 커밋에 담는다
  assert.strictEqual(r.막혔나, false, `처방대로 했는데 또 막혔다 — 그러면 남는 문은 BYPASS 뿐이다:\n${r.출력}`);
});

/* ── 거짓양성 (거짓 차단은 곧 꺼지는 가드다) ─────────────────────────── */

test('배열이 안 바뀐 계약 개정(설명만)은 안 막는다', (t) => {
  const dir = 준비(t); if (!dir) return;
  const p = path.join(dir, 계약경로);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.왜 = '설명을 덧붙였을 뿐 칸은 그대로다';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  const r = 커밋(dir, [계약경로]);
  assert.strictEqual(r.막혔나, false, `칸이 안 바뀐 개정을 막았다 — 과잉 차단은 BYPASS 습관을 만든다:\n${r.출력}`);
});

test('계약·조립부와 무관한 커밋은 판정 자체를 안 세운다', (t) => {
  const dir = 준비(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, '아무거나.md'), '내용\n', 'utf8');
  git(dir, ['add', '--', '아무거나.md']);
  const r = 커밋(dir, ['아무거나.md']);
  assert.strictEqual(r.막혔나, false, r.출력);
  assert.doesNotMatch(r.출력, /계약동봉/, '무관한 커밋에서 이 게이트가 말을 했다 — 매 커밋 소음이 된다');
});

test('HEAD 가 이미 깨져 있으면 막지 않고 말한다 (남의 옛 구멍으로 내 커밋을 막지 않는다)', (t) => {
  const dir = 준비(t); if (!dir) return;
  // 게이트를 우회해 깨진 HEAD 를 만든다 — 「이미 깨진 상태」가 이 시험의 전제다.
  계약을쓴다(dir, ['id', '종류', '출처', '옛구멍']);
  git(dir, ['commit', '--no-verify', '-m', '깨뜨림', '--', 계약경로]);

  const p = path.join(dir, 계약경로);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.왜 = '내 커밋은 이 구멍과 무관하다';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  const r = 커밋(dir, [계약경로]);
  assert.strictEqual(r.막혔나, false, `남이 낸 옛 구멍으로 내 커밋이 막혔다 — 이 가드가 없애려는 피해 그 자체다:\n${r.출력}`);
  assert.match(r.출력, /옛구멍/, '통과시키면서 아무 말도 안 했다 — 그러면 그 구멍의 주인을 아무도 못 찾는다');
});

/* ── 통과와 미실행이 같은 모양이면 안 된다 (F207) ────────────────────── */

/* ⚠ 단언을 `[계약동봉]` 에 **못 박는다**. 그냥 `/못 했다/` 로 두면 같은 훅의 옆 게이트
 *   (픽스처엔 옛글자·인용 검사기가 없어 「…못 했다」를 찍는다)에 걸려 **이 게이트가 입을 다물어도
 *   초록**이다 — 실측으로 그랬다(변이 ④가 살아남았다). 남의 말로 내 탐지를 증명하면 안 된다. */
const 이게이트가 = (출력, 무엇) => new RegExp(`\\[계약동봉\\][^\\n]*${무엇}`).test(출력);

test('앵커가 죽으면 「못 쟀다」를 찍고 통과한다 — 조용한 통과가 아니다', (t) => {
  const dir = 준비(t); if (!dir) return;
  fs.writeFileSync(path.join(dir, 수집경로), 'function 조립부가_다른_모양이_됐다() { return []; }\n', 'utf8');
  const r = 커밋(dir, [수집경로]);
  assert.strictEqual(r.막혔나, false, '못 재는 자리를 차단으로 바꾸면 그 세션은 아무것도 커밋 못 한다(F103)');
  assert.ok(이게이트가(r.출력, '못 했다'),
    `못 쟀는데 이 게이트가 조용했다 — 통과와 미실행이 같은 모양이 됐다(F207):\n${r.출력}`);
});

test('앵커 시작은 있고 **끝이 없어도** 「못 쟀다」다 — 빈 블록을 0칸으로 읽으면 전건 차단이 된다', (t) => {
  const dir = 준비(t); if (!dir) return;
  // 조립부를 편집하다 만 상태. 블록을 「빈 것」으로 접으면 계약 전 칸이 «새 구멍»으로 셰인다.
  fs.writeFileSync(path.join(dir, 수집경로), 'const 항목 = [];\n항목.push({\n  id: \'\',\n', 'utf8');
  const r = 커밋(dir, [수집경로]);
  assert.strictEqual(r.막혔나, false,
    `끝을 못 찾은 것을 「칸이 하나도 없다」로 읽어 전건 차단했다 — 못 잰 것과 깨끗한 것은 다르다:\n${r.출력}`);
  assert.ok(이게이트가(r.출력, '못 했다'), `조용히 지나갔다:\n${r.출력}`);
});

test('통과할 때도 몇 칸을 쟀는지 말한다 (분모 없는 초록은 못 읽는다)', (t) => {
  const dir = 준비(t); if (!dir) return;
  계약을쓴다(dir, ['id', '종류', '출처', '불변']);
  조립부를쓴다(dir, ['id', '종류', '출처', '불변']);
  const r = 커밋(dir, [계약경로, 수집경로]);
  assert.match(r.출력, /4칸/, '통과 보고에 분모가 없다 — 0건 실행과 구분이 안 된다(F207)');
});

/* ── 실저장소: 거짓양성만 묻는다 ─────────────────────────────────────── */

test('실저장소: 지금 HEAD 는 동봉이 맞다 (거짓양성 검사 — 탐지력은 위 픽스처가 진다)', (t) => {
  let 계약; let 수집;
  try {
    계약 = JSON.parse(fs.readFileSync(path.join(ROOT, 계약경로), 'utf8'));
    수집 = fs.readFileSync(path.join(ROOT, 수집경로), 'utf8');
  } catch (_) { return t.skip('부분 체크아웃 — 실물이 없다'); }
  const 판정 = require('../tools/lib/계약동봉').없는항목필드(계약, 수집);
  assert.ok(판정.잼, `실저장소에서 못 쟀다 — ${판정.왜}`);
  assert.deepEqual(판정.없는칸, [], '실저장소가 이미 깨져 있다');
});

test('실저장소: 훅에 이 게이트가 등재돼 있다 (도구만 두고 안 부르면 장치는 안 돈다)', () => {
  const 훅 = fs.readFileSync(HOOK_SRC, 'utf8');
  assert.match(훅, /계약동봉검사\.js/,
    'pre-commit 이 이 게이트를 안 부른다 — 스스로 발화하지 않는 장치는 안 돈다(장치와 발동 조건은 같은 커밋에)');
});
