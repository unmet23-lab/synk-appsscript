// 검수 과녁의 **부모 기준** 회귀 (F578) — 배포 검수 게이트가 「자기가 뽑은 과녁으로 자기를 못 여는」 자리를 지킨다.
//
// 왜 이 자리인가 (2026-08-17 실측 · `local_41cc57e7` 가 5분을 태우고 종료 2 를 받았다):
//   과녁을 **뽑는** 쪽과 그 과녁을 **읽는** 쪽이 서로 다른 부모 기준을 썼다.
//     · 뽑기 `과녁커밋` — `git log -- <배포집합>` 은 **모든 부모**와 대조해 머지 커밋을 잡는다.
//     · 읽기 `커밋읽기` — `git show <머지>` 는 기본이 **combined diff**(`--cc`)라
//       「양 부모 **모두**와 다른」 파일만 낸다. 머지가 한쪽에서 그대로 들여온 변경은 통째로 안 보인다.
//   그래서 게이트가 내민 처방을 그대로 따르면 「배포 파일 0건 = 범위 밖」으로 멈춘다.
//
// 새는 방향이 **「통과」**라 조용하다 — 두 층으로 샌다:
//   ① 검수 기록 없음은 배포에서 **차단이 아니라 알림**이다. 처방이 튕기면 「돌렸는데 안 되네」로
//      접고 배포하는 것이 자연스러운 동선이라, 배포가 검수 없이 나간다.
//   ② 파일 목록이 우연히 통과하는 날에도 **본문**이 접힌다 — 실측 `80b63ca9` 는 283자 대 83,515자다.
//      283자를 던지면 검수자는 빈 판을 보고 통과시킨다.
//
// 탐지력은 **픽스처가 진다.** 실저장소의 과녁이 그날 머지냐 실커밋이냐는 남의 머지 타이밍이 정하므로,
// 거기서의 초록은 「장치가 산다」와 「오늘은 머지가 아니었다」를 못 가른다(초록은 분모와 함께 읽는다 · F207).
// 실저장소에는 **거짓양성만** 묻는다 — 「지금 내미는 처방이 실제로 열리는가」.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
/* 주석 제거는 통로가 하나다 — 지역 사본은 저마다 다르게 틀린다(F401·#Q114). */
const { 코드만 } = require('./lib/소스검사.js');
const { execFileSync } = require('child_process');

const 검수 = require('../tools/codex-review.js');

/* 픽스처 저장소 — `-c` 로 신원·기본가지를 주입한다. 전역 git 설정에 기대면 CI 에서 깨진다(F296). */
function 새저장소() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-과녁-test-'));
  const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
    { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  g('init', '-q', '-b', 'main');

  // ① 배포 파일이 있는 밑판
  fs.writeFileSync(path.join(d, 'Code.js'), '// v1\n');
  fs.writeFileSync(path.join(d, '읽기.md'), 'a\n');
  g('add', '-A'); g('commit', '-qm', '밑판');

  // ② 가지에서 **배포와 무관한** 파일만 바꾼다 — 머지의 첫 부모가 될 쪽
  g('checkout', '-q', '-b', '가지');
  fs.writeFileSync(path.join(d, '읽기.md'), 'a\nb\n');
  g('add', '-A'); g('commit', '-qm', '가지: 문서만');

  // ③ main 에서 **배포 파일**을 바꾼다 — 머지가 들여올 쪽
  g('checkout', '-q', 'main');
  fs.writeFileSync(path.join(d, 'Code.js'), '// v1\n// v2\n');
  g('add', '-A'); g('commit', '-qm', '배포 파일 변경');

  // ④ 가지에서 main 을 받는다 → 첫 부모=가지, 두 번째 부모=main 인 머지
  g('checkout', '-q', '가지');
  g('merge', '-q', '--no-ff', '-m', 'Merge main into 가지', 'main');
  return { d, g, 머지: g('rev-parse', 'HEAD') };
}

// ───────────────────────────── ① 병 재현 — 픽스처가 탐지력을 진다

test('머지 커밋에서 combined diff 는 배포 파일을 0건으로 낸다 — 이 회귀가 막는 그 병', () => {
  const { d, g, 머지 } = 새저장소();
  try {
    // 과녁 뽑기는 배포 파일을 근거로 **그 머지를 잡는다**
    const 뽑힌 = g('log', '-n', '1', '--first-parent', '--format=%H', '--', 'Code.js');
    assert.strictEqual(뽑힌, 머지, '과녁 뽑기가 머지를 잡는 상황이어야 이 회귀가 의미를 가진다');

    const combined = g('show', '--name-only', '--format=', 머지).split('\n').filter(Boolean);
    const 첫부모 = g('show', '--name-only', '--format=', '--first-parent', 머지).split('\n').filter(Boolean);

    assert.ok(!combined.includes('Code.js'),
      `병 재현 실패 — combined 가 Code.js 를 냈다(${combined.join(',')}). git 동작이 바뀌었으면 이 회귀의 전제를 다시 세워야 한다`);
    assert.ok(첫부모.includes('Code.js'),
      `처방 무효 — --first-parent 인데 Code.js 가 없다(${첫부모.join(',')})`);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('실커밋에서는 두 방식이 바이트까지 같다 — 그래서 이 플래그는 머지에서만 일한다', () => {
  const { d, g } = 새저장소();
  try {
    const 실커밋 = g('rev-parse', 'main');   // 부모 하나짜리 배포 파일 변경
    assert.strictEqual(g('log', '-1', '--format=%p', 실커밋).split(/\s+/).filter(Boolean).length, 1, '실커밋이어야 한다');
    assert.strictEqual(g('show', 실커밋), g('show', '--first-parent', 실커밋),
      '실커밋에서 출력이 갈리면 이 수리는 기존 동작을 바꾼 것이다 — 회귀 위험 0 이라는 전제가 깨진다');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

// ───────────────────────────── ② 두 축이 **같은 기준**인가 (가드 맹점 ④)

test('과녁을 뽑는 쪽과 읽는 쪽이 같은 부모 기준을 쓴다 — 갈리면 갈린 쪽이 새는 쪽이 된다', () => {
  const 소스 = fs.readFileSync(path.join(__dirname, '..', 'tools', 'codex-review.js'), 'utf8');
  assert.strictEqual(검수.머지기준, '--first-parent', '기준 상수가 바뀌었다 — 두 축을 함께 옮겼는지 확인하라');

  /* 상수 하나에서 파생되는지를 본다. 두 곳에 문자열을 각각 적으면 한쪽만 고쳐도 초록이라,
   * 이 검사가 잡으려는 것은 「값이 같다」가 아니라 「출처가 하나다」이다. */
  const 리터럴 = (소스.match(/'--first-parent'/g) || []).length;
  assert.strictEqual(리터럴, 1,
    `'--first-parent' 리터럴이 ${리터럴}곳 — 상수 \`머지기준\` 한 곳에서만 적고 나머지는 그것을 참조해야 한다(맹점 ④)`);

  /* 🔑 리터럴 개수만 세면 「상수는 하나인데 **쓰는 자리가 그걸 안 쓴다**」를 못 잡는다.
   * 이 저장소의 `git()` 은 `cwd: ROOT` 고정이라 뽑기 쪽을 픽스처로 재는 길이 없다 —
   * 그래서 이 계약을 소스에서 잰다. 두 함수 중 **한쪽만** 기준을 잃는 것이 F578 이 난 모양이다. */
  /* ⚠ **주석을 걷어내고 센다.** 이 검사를 처음 짰을 때 주석까지 세어, 코드가 `머지기준` 을 잃어도
   * 바로 위 설명 주석이 그 낱말을 들고 있어서 초록이 났다(변이 ②가 잡았다 — 맹점 ④ 「맞는 얼굴로
   * 틀린 값」의 실물이다). 재려는 것은 **호출 인자**이지 그 자리에 무슨 말이 적혔는지가 아니다. */
  const 본문 = (fn) => {
    const s = 소스.indexOf(`function ${fn}(`);
    assert.ok(s !== -1, `${fn} 이 사라졌다 — 이름이 바뀌었으면 이 계약도 함께 옮겨야 한다`);
    const e = 소스.indexOf('\n}', s);
    return 코드만(소스.slice(s, e === -1 ? undefined : e));
  };
  for (const fn of ['과녁커밋', '커밋읽기']) {
    assert.ok(본문(fn).includes('머지기준'),
      `${fn} 이 \`머지기준\` 을 안 쓴다 — 뽑는 축과 읽는 축이 갈리면 게이트가 자기 과녁으로 자기를 못 연다(F578)`);
  }
  assert.ok(본문('과녁판정').includes('열림 !== false'),
    '과녁판정이 `열림` 을 조건에 안 쓴다 — 자기검사를 해 놓고 결과를 안 보면 못 열 과녁을 그대로 내민다');
});

test('과녁이열리나 — 못 잰 것은 null 이다 (「안 열린다」로 접으면 멀쩡한 과녁을 버린다 · F207)', () => {
  const ROOT = path.join(__dirname, '..');
  assert.strictEqual(검수.과녁이열리나('deadbeef1234', ROOT, ROOT), null,
    '읽을 수 없는 sha 는 `null`(못 쟀다)이다 — `false`(배포 파일 0건)와 뭉치면 처방이 조용히 범위로 새고, 그 sha 가 멀쩡한 날에도 그렇다');
});

// ───────────────────────────── ③ 실저장소 — 거짓양성만 묻는다

test('과녁이열리나 — 배포 파일을 «안» 만진 커밋에는 false 를 낸다 (음성도 잰다)', (t) => {
  /* 양성만 재면 「늘 true 를 내는」 장치도 초록이다 — 그건 못 열 과녁을 그대로 내밀게 한다.
   * 그래서 반대쪽을 함께 잰다. 대상은 실저장소에서 찾되, 못 찾으면 skip 이다(미실행 ≠ 통과). */
  const ROOT = path.join(__dirname, '..');
  let 배포집합;
  try { 배포집합 = new Set(require('../tools/배포판점검.js').배포집합(ROOT, ROOT)); } catch (_) { 배포집합 = null; }
  if (!배포집합 || !배포집합.size) return t.skip('배포집합을 못 읽었다 — 미실행이지 통과가 아니다');

  let 음성 = null;
  try {
    const 후보 = execFileSync('git', ['log', '-n', '40', '--first-parent', '--format=%H'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').filter(Boolean);
    for (const c of 후보) {
      if (!검수.커밋파일들(c).some((f) => 배포집합.has(f))) { 음성 = c; break; }
    }
  } catch (_) { /* git 이력을 못 읽는 판(shallow clone 등) — 아래에서 skip */ }
  if (!음성) return t.skip('배포 파일을 안 만진 커밋을 최근 40개에서 못 찾았다 — 미실행이지 통과가 아니다');

  assert.strictEqual(검수.과녁이열리나(음성, ROOT, ROOT), false,
    `${음성.slice(0, 8)} 은 배포 파일을 안 만졌는데 「열린다」고 했다 — 이 판정이 늘 true 면 못 열 과녁을 그대로 내민다`);
  assert.strictEqual(검수.과녁이열리나('', ROOT, ROOT), null, '과녁이 없으면 null 이다 — false(안 열림)와 뭉치지 않는다');
});

test('실저장소: 지금 내미는 과녁이 실제로 게이트를 연다 (되먹임 · 맹점 ③)', (t) => {
  let 프로젝트들;
  try { 프로젝트들 = require('../tools/배포판점검.js').claspProjects(); } catch (_) { 프로젝트들 = []; }
  if (!프로젝트들.length) return t.skip('clasp 프로젝트를 못 읽었다 — 미실행이지 통과가 아니다');

  let 잰것 = 0;
  for (const p of 프로젝트들) {
    /* 주입 `[]` = 「배포 파일 미커밋 0건」. 실저장소의 더러움에 기대면 옆 세션이 배포 파일을
     * 들고 있는 날 거짓 적색이 된다 — 축을 고정해서 이 검사가 재려는 것만 잰다. */
    const { sha, 열림, 과녁 } = 검수.과녁판정(p, path.join(__dirname, '..'), []);
    if (!sha) continue;                       // 과녁을 못 뽑았다 — 이 검사의 대상이 아니다
    if (열림 === null) continue;              // 못 쟀다 ≠ 안 열린다(F207)
    잰것++;
    assert.ok(열림 === true,
      `과녁 ${sha} 를 읽었더니 배포 파일이 0건이다 — 따라도 종료 2 로 끝날 처방을 내밀고 있다(F578)`);
    assert.ok(과녁.includes(sha), '열리는 과녁인데 처방에 안 실렸다');
  }
  if (!잰것) t.skip('과녁을 댈 수 있는 프로젝트가 0건 — 미실행이지 통과가 아니다');
});
