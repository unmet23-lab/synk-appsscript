/* `[vNEXT]` 자리표 커밋 게이트 — 회귀 (F450 처방 · 2026-08-15)
 *
 * 무엇이 비어 있었나 — 자리표가 **커밋되는 것**을 막는 층이 통째로 없었다. `tests/버전채번.test.js`
 *   의 「실저장소에 [vNEXT] 자리표가 남아 있지 않다」는 **사후** 검사라, 발동할 때는 이미 그 커밋이
 *   master 에 있고 적색은 낸 사람이 아니라 **그 뒤 커밋하는 모든 세션의 배포**를 막는다.
 *   실측 `694497ad` 가 정확히 그것이었다 — 그 세션은 규칙을 어긴 게 아니라 `tools/bump-version.js`
 *   와 `.claude/hooks/auto-commit.js` 에 적혀 있던 낡은 「커밋해도 안전」을 **읽고 그대로 했다.**
 *   (그 두 문장은 이 커밋에서 함께 고쳤다 — 줄 번호를 안 다는 것은 의도다: 주석은 밀린다.)
 *
 * 🔑 탐지력은 전부 여기(픽스처)가 진다 — 실저장소에는 아무것도 묻지 않는다. 실저장소에 자리표를
 *   심어 놓고 재는 순간 그게 사고이고(`bump-version.js` 가 같은 자리에 같은 말을 적어 두었다),
 *   「버그가 아직 있을 것을 요구하는 회귀」는 지침이 금지한다. 실저장소의 거짓양성 축은
 *   `tests/버전채번.test.js` 의 잔존 0 검사가 그대로 맡는다.
 *
 * ☠️ 이 게이트가 죽는 가장 그럴듯한 방법은 **작업본을 재는 것**이다(F302). `git add` 뒤에 채번하면
 *   작업본은 깨끗한데 인덱스엔 자리표가 남아, 작업본을 보는 게이트는 그 커밋을 통과시킨다.
 *   그래서 아래 ㉠㉡ 를 **양방향으로** 잰다 — 한쪽만 재면 「인덱스를 본다」와 「아무거나 본다」가
 *   같은 초록이 된다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 훅띄우기 } = require('./lib/훅띄우기.js');

const ROOT = path.join(__dirname, '..');
const 검사기 = path.join(ROOT, 'tools', '자리표검사.js');
const 훅원본 = path.join(ROOT, 'tools', 'githooks', 'pre-commit');

const 임시들 = [];
test.after(() => { for (const d of 임시들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new Error(`git ${args.join(' ')} 실패 — ${r.error ? r.error.code : r.status}\n${r.stderr || ''}`);
  }
  return r.stdout;
}

/** 1회용 git 저장소. `담을것` 은 `git add` 까지, `안담을것` 은 작업본에만 쓴다. */
function mkRepo(담을것 = {}, 안담을것 = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-자리표-'));
  임시들.push(dir);
  git(dir, ['init', '-b', 'master']);
  git(dir, ['config', 'user.email', 'test@synk.local']);
  git(dir, ['config', 'user.name', 'test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  for (const [f, s] of Object.entries(담을것)) {
    const p = path.join(dir, f);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, s, 'utf8');
    git(dir, ['add', '--', f]);
  }
  // add **뒤에** 덮어쓴다 — 인덱스와 작업본을 갈라 놓는 유일한 방법이다(F302 축)
  for (const [f, s] of Object.entries(안담을것)) {
    const p = path.join(dir, f);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, s, 'utf8');
  }
  return dir;
}

/** 실물 검사기를 그 저장소에 대고 돌린다 — 대역이 아니다.
 *
 *  🔑 `spawnSync` 를 직접 안 쓴다 — `tests/훅통로.test.js` 가 저장소를 훑어 그 형태를 금지한다.
 *    이유가 이 파일에 그대로 걸린다: 검사기가 못 뜨거나 예외로 죽으면 종료코드가 1 이고, 그건
 *    아래 탐지 검사들이 기대하는 「잡았다」와 **같은 값**이다 — 미실행이 통과로 번역된다.
 *  ⚠ 그래서 통과코드를 0·1·2 로 못박고(이 게이트의 정상 종료는 그 셋뿐), 그 밖으로 끝나면
 *    통로가 던진다. 1 안에서 「잡았다」와 「죽었다」를 마저 가르는 것은 **차단문 대조**다 —
 *    아래 검사들이 코드만 보지 않고 무엇을 말했는지까지 재는 이유가 그것이다. */
function 검사(dir, 인자 = ['--cached']) {
  const r = 훅띄우기([검사기, ...인자], {
    cwd: dir, encoding: 'utf8', 통과코드: [0, 1, 2],
    env: { ...process.env, SYNK_BUMP_ROOT: dir, SYNK_SKIP_GUARD: '' },
  });
  return { code: r.status, 말 : (r.stderr || '') + (r.stdout || '') };
}

const 자리표 = '/* [vNEXT] 새 기능 */\n';
const 라벨자리표 = '/* [vNEXT·검수 c59f24d9] 원인 지문을 앞쪽에 */\n';
const 확정 = "/* [v9.9·검수 c59f24d9] 원인 지문을 앞쪽에 */\n";
const 엔진 = (본문) => `const SYNK_VERSION = 'v9.9';\n${본문}function f() {}\n`;

test('🔴 스테이징된 배포 파일의 자리표를 잡는다 — 파일:줄까지 말한다', () => {
  const dir = mkRepo({ 'Code.js': 엔진(자리표) });
  const { code, 말 } = 검사(dir);
  assert.equal(code, 1, '자리표를 실은 커밋을 통과시켰다 — 이 게이트의 존재 이유가 사라진다');
  assert.match(말, /Code\.js:2/, '어느 줄인지 안 말한다 — 2,000줄짜리 엔진 파일에서 자리를 다시 찾게 만든다');
  assert.match(말, /bump-version\.js --desc/, '처방(채번)을 안 내민다 — 다음 수가 우회가 된다(F103)');
  assert.match(말, /git add -- Code\.js/,
    '채번이 **작업본**을 고친다는 것을 안 말한다 — 다시 담지 않으면 인덱스엔 자리표가 그대로다');
});

test('🔑 라벨 붙은 자리표도 잡는다 — F339 가 통째로 놓쳤던 자리', () => {
  const dir = mkRepo({ 'Code.js': 엔진(라벨자리표) });
  const { code, 말 } = 검사(dir);
  assert.equal(code, 1, '`[vNEXT·라벨]` 을 놓쳤다 — 실물 694497ad 가 바로 이 모양이었다');
  assert.match(말, /vNEXT·검수 c59f24d9/, '무엇을 잡았는지 원문을 안 보여 준다');
});

test('☠️ 인덱스를 본다 — 작업본이 아니다 ㉠ add 뒤 채번해도 막는다 (F302)', () => {
  /* `git add` 로 자리표를 담은 뒤 작업본만 채번한 상태. 작업본을 보는 게이트는 여기서 초록이 되고,
   * 그 커밋은 자리표를 그대로 싣는다 — 커밋되는 바이트가 아닌 것을 검사하면 이렇게 샌다. */
  const dir = mkRepo({ 'Code.js': 엔진(라벨자리표) }, { 'Code.js': 엔진(확정) });
  const { code, 말 } = 검사(dir);
  assert.equal(code, 1, '작업본을 봤다 — 인덱스의 자리표가 그대로 커밋된다(이 게이트가 죽는 첫째 방법)');
  // 코드만 보면 「잡았다(1)」와 「죽었다(1)」가 같은 값이다 — 무엇을 말했는지까지 재야 갈린다
  assert.match(말, /Code\.js:2/, '1 로 끝나긴 했는데 자리표를 지목하지 않았다 — 크래시를 탐지로 셀 뻔했다');
});

test('☠️ 인덱스를 본다 — 작업본이 아니다 ㉡ 작업본에만 자리표면 막지 않는다 (거짓양성 0)', () => {
  /* 반대 방향을 안 재면 「인덱스를 본다」와 「아무거나 본다」가 같은 초록이 된다.
   * 짜는 중(미커밋)의 자리표는 **정상**이다 — 그걸 막으면 자리표 설계 자체가 못 쓰이게 된다. */
  const dir = mkRepo({ 'Code.js': 엔진(확정) }, { 'Code.js': 엔진(자리표) });
  const { code } = 검사(dir);
  assert.equal(code, 0, '짜는 동안의 자리표를 막았다 — 자리표를 아무도 안 쓰게 되고 F078 이 되돌아온다');
});

test('🔑 배포 집합 밖의 자리표는 안 본다 — 이 저장소 자신이 그 문자열을 설명한다', () => {
  /* `CLAUDE.md`·`deploy/SKILL.md`·`tests/버전채번.test.js`·검사기 자신이 자리표를 **설명하려고** 그
   * 문자열을 적는다. 범위를 넓히면 그 문서들을 고치는 커밋이 전부 막히고, 따를 수 없는 처방은
   * 우회를 정상 통로로 만든다(F103). 범위 판정은 여기 손으로 안 적고 `배포파일들()` 을 그대로 받는다. */
  const dir = mkRepo({
    'Code.js': 엔진(''),
    'docs/설명.md': '자리표는 [vNEXT] 라고 적는다\n',
    'tools/무엇.js': '// [vNEXT·E2] 설명\n',
  });
  const { code } = 검사(dir);
  assert.equal(code, 0, '배포 집합 밖까지 막았다 — 자리표를 설명하는 문서를 아무도 못 고치게 된다');
});

test('🔑 그 커밋에 배포 파일이 없으면 조용히 통과한다', () => {
  const dir = mkRepo({ 'Code.js': 엔진('') , 'docs/딴것.md': '아무거나\n' });
  git(dir, ['commit', '-m', '초기', '--no-verify']);
  fs.writeFileSync(path.join(dir, 'docs', '딴것.md'), '고쳤다\n', 'utf8');
  git(dir, ['add', '--', 'docs/딴것.md']);
  const { code } = 검사(dir);
  assert.equal(code, 0, '배포 파일이 안 든 커밋을 막았다 — 남의 트랙이 통째로 멈춘다');
});

test('🔴 배포 집합이 비면 「통과」가 아니라 「못 봤다」다 — 미실행과 초록이 같은 모양이면 안 된다', () => {
  /* 빈 목록은 「자리표 0건」과 **같은 모양**이다(F207). bump-version 이 clasp 정본을 못 읽는 날이
   * 실재하고, 그날 이 게이트가 조용히 초록이면 자리표가 그대로 나간다. */
  const dir = mkRepo({ 'docs/딴것.md': '엔진 파일이 하나도 없다\n' });
  const { code, 말 } = 검사(dir);
  assert.equal(code, 2, '배포 집합이 빈 것을 「깨끗하다」로 읽었다 — 미실행이 통과로 위장된다');
    assert.match(말, /배포 집합이 비었다/, '왜 못 봤는지를 안 말한다');
});

test('🔑 차단문이 시키는 대로 하면 실제로 통과한다 — 자기 처방 검사 (가드 맹점 ③)', () => {
  /* 차단 사유가 내미는 명령을 그 가드에 되먹여 통과하는지 본다. 안 통과하면 다음 수는 BYPASS 다. */
  const dir = mkRepo({ 'Code.js': 엔진(라벨자리표) });
  assert.equal(검사(dir).code, 1, '전제가 무너졌다 — 막히지도 않았다');

  // 처방 그대로: 채번(= 라벨은 두고 번호만 확정) → `git add` 로 다시 담기
  fs.writeFileSync(path.join(dir, 'Code.js'), 엔진(확정), 'utf8');
  git(dir, ['add', '--', 'Code.js']);
  const { code, 말 } = 검사(dir);
  assert.equal(code, 0, `처방을 그대로 따랐는데도 막혔다 — 따를 수 없는 처방이다(F103):\n${말}`);
});

test('🔒 pre-commit 정본이 이 검사기를 실제로 부른다 — 가드는 등록층에서 샌다 (F044)', () => {
  const 훅 = fs.readFileSync(훅원본, 'utf8');
  assert.match(훅, /자리표검사\.js/, '검사기를 만들어 놓고 훅에 안 달았다 — 스스로 발화하지 않는 장치는 안 돈다');
  assert.match(훅, /자리표검사\.js["'\s]+--cached/,
    '`--cached` 없이 부른다 — 작업본을 재게 되어 F302 로 통째로 샌다');
  assert.match(훅, /\[자리표\][^\n]*못 했다/,
    '검사기가 없을 때 침묵한다 — 「통과」와 「미실행」이 같은 모양이면 초록이 거짓말을 한다');
});

test('🔒 배선 — 실 훅을 태운 진짜 `git commit` 이 실제로 막힌다', () => {
  /* 위 결합 검사는 「훅에 이름이 적혀 있다」까지다. 등재 grep 이 초록인데 커밋이 안 막히는 상태가
   * 성립한다(가드는 로직보다 등록층에서 샌다 · F044·F053). 여기서만 그 사이가 재진다.
   * 🔑 옆 게이트들(계약·이해대장·옛글자·인용)은 **일부러 안 싣는다** — 훅의 「없으면 막지 않고
   *   말한다」 규약이 그대로 도는지도 같이 드러난다(안 돌면 이 커밋이 딴 이유로 막힌다). */
  const dir = mkRepo({ 'Code.js': 엔진(라벨자리표) });
  const hooks = path.join(dir, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const dst = path.join(hooks, 'pre-commit');
  fs.copyFileSync(훅원본, dst);
  try { fs.chmodSync(dst, 0o755); } catch (_) { /* Windows */ }
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  fs.copyFileSync(검사기, path.join(dir, 'tools', '자리표검사.js'));
  fs.copyFileSync(path.join(ROOT, 'tools', 'bump-version.js'), path.join(dir, 'tools', 'bump-version.js'));

  const 막힘 = spawnSync('git', ['commit', '-m', '자리표를 실은 커밋'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(막힘.status, 0,
    `실 훅을 태웠는데 자리표가 든 커밋이 그대로 들어갔다 — 등재는 됐는데 안 도는 상태다:\n${막힘.stdout}${막힘.stderr}`);
  assert.match((막힘.stderr || '') + (막힘.stdout || ''), /\[자리표\]/,
    '막히긴 했는데 이 게이트가 막은 게 아니다 — 다른 이유로 실패한 것을 통과로 셀 뻔했다');

  // 처방을 따르면 같은 훅 아래서 실제로 커밋된다 — 막기만 하는 가드는 우회를 부른다(F103)
  fs.writeFileSync(path.join(dir, 'Code.js'), 엔진(확정), 'utf8');
  git(dir, ['add', '--', 'Code.js']);
  const 통과 = spawnSync('git', ['commit', '-m', '채번 뒤 커밋'], { cwd: dir, encoding: 'utf8' });
  assert.equal(통과.status, 0,
    `처방대로 채번했는데도 훅이 계속 막는다 — 따를 수 없는 처방이다:\n${통과.stdout}${통과.stderr}`);
});

test('🔑 판정은 한 곳이다 — 검사기가 자기 정규식을 다시 적지 않는다 (F339 재발 방지)', () => {
  const src = fs.readFileSync(검사기, 'utf8');
  assert.match(src, /bump\.자리표자리\(/, '판정자를 안 쓴다 — 같은 판정이 두 곳에 적히면 갈라진다');
  assert.ok(!/\\\[vNEXT/.test(src),
    '검사기가 자리표 패턴을 손으로 적었다 — 넓힐 때 갈라지고, 갈라지는 방향은 언제나 「통과」다');
  assert.ok(!/배포파일들\s*=\s*\[/.test(src),
    '배포 집합 목록을 손으로 적었다 — 목록은 하나에서 파생돼야 한다');
});
