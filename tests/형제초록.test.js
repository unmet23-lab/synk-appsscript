/* 형제 저장소 초록 도장 회귀 (F518 ㉡ — 「두 저장소가 초록인지 아무도 모른다」)
 *
 * 무엇을 지키나 — 이 장치의 값은 **「안 쟀다」를 초록과 다른 모양으로 내는 것** 하나다.
 *   그래서 회귀도 거기에 겨눈다: 낡은 도장·없는 도장·형제 없음이 각각 «초록»과 갈라지는가.
 *
 * 🔑 탐지력은 **픽스처가 진다** — 실저장소에는 거짓양성(도장 형식·등재)만 묻는다.
 *   형제 저장소는 repo 밖 환경이라 CI 엔 없다(F296) — 그 자리는 fail 이 아니라 skip 으로 드러낸다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const 도구 = path.join(ROOT, 'tools', '형제초록.js');
const 설정 = path.join(ROOT, '.claude', 'settings.json');

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error(`git ${args.join(' ')} — ${r.error ? r.error.code : r.stderr}`);
  return String(r.stdout || '').trim();
}

/** as 사본 + 그 옆의 형제 사본. 실물 도구를 그대로 싣는다 — 이 시험의 과녁이 그것이다. */
function mkPair(t) {
  let 방;
  try { 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-형제초록-')); } catch (_) { return t.skip('임시 폴더를 못 만든다'), null; }
  try {
    const as = path.join(방, 'SYNK-appsscript');
    const talk = path.join(방, 'SYNK-talk');
    fs.mkdirSync(path.join(as, 'tools'), { recursive: true });
    fs.mkdirSync(path.join(as, 'docs', '_ops'), { recursive: true });
    fs.copyFileSync(도구, path.join(as, 'tools', '형제초록.js'));

    fs.mkdirSync(talk, { recursive: true });
    git(talk, ['init', '-b', 'master']);
    git(talk, ['config', 'user.email', 'test@synk.local']);
    git(talk, ['config', 'user.name', 'test']);
    git(talk, ['config', 'commit.gpgsign', 'false']);
    fs.writeFileSync(path.join(talk, 'a.txt'), '1\n', 'utf8');
    git(talk, ['add', '--', 'a.txt']);
    git(talk, ['commit', '-m', '초기']);
    /* `origin/master` 는 원격이 없어도 만들 수 있다 — 이 도구가 읽는 것은 **ref 하나**다. */
    git(talk, ['update-ref', 'refs/remotes/origin/master', 'HEAD']);
    return { 방, as, talk };
  } catch (_) {
    try { fs.rmSync(방, { recursive: true, force: true }); } catch (__) { /* 청소 실패는 판정이 아니다 */ }
    return t.skip('git 을 못 돌린다'), null;
  }
}

const 방들 = [];
const 쓰고버린다 = (t) => { const p = mkPair(t); if (p) 방들.push(p.방); return p; };
test.after(() => { for (const d of 방들) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 청소 실패는 판정이 아니다 */ } } });

/** 도구를 그 사본 안에서 돌린다. ⚠ 미실행(스폰 실패)을 결과로 번역하지 않는다. */
function 돌린다(as, args = []) {
  const r = spawnSync(process.execPath, [path.join(as, 'tools', '형제초록.js'), ...args], { cwd: as, encoding: 'utf8' });
  if (r.error || r.status === null) throw new Error(`도구를 못 띄웠다 — 미실행은 판정이 아니다: ${r.error ? r.error.code : r.signal}`);
  return String(r.stdout || '') + String(r.stderr || '');
}

const 찍는다 = (as, extra = []) => 돌린다(as, ['--찍기', '--통과', '10', '--실패', '0', '--건너뜀', '0', ...extra]);

/* ── 급소: 「안 쟀다」가 「초록」과 갈라지는가 ─────────────────────────── */

test('🔴 급소 — 도장 뒤로 형제가 움직이면 **초록이라 말하지 않는다** (판정을 이월하지 않는다)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  찍는다(p.as);
  fs.writeFileSync(path.join(p.talk, 'a.txt'), '2\n', 'utf8');
  git(p.talk, ['add', '--', 'a.txt']);
  git(p.talk, ['commit', '-m', '그 뒤 커밋']);
  git(p.talk, ['update-ref', 'refs/remotes/origin/master', 'HEAD']);

  const 말 = 돌린다(p.as);
  assert.match(말, /미측정/, `도장 뒤로 형제가 1커밋 갔는데 미측정이라 안 한다:\n${말}`);
  assert.doesNotMatch(말, /초록/, `낡은 도장을 «초록»으로 읽었다 — 이 장치가 없애려는 바로 그 모양이다:\n${말}`);
  assert.match(말, /1커밋/, `몇 커밋 벌어졌는지 안 말한다 — 분모 없는 「미측정」은 못 읽는다(F207):\n${말}`);
});

test('🔴 급소 — 도장이 없으면 «안 쟀다»라고 말한다 (침묵은 초록과 같은 모양이다)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  const 말 = 돌린다(p.as);
  assert.match(말, /안 쟀다|도장 0/, `도장이 없는데 조용하다 — 「안 쟀다」와 「초록」이 같은 모양이 됐다:\n${말}`);
  assert.doesNotMatch(말, /초록 —/, `잰 적이 없는데 초록이라 했다:\n${말}`);
});

test('🔑 도장이 형제 현재 판과 같으면 초록이라 말한다 (전건 「미측정」은 계기를 끈다)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  찍는다(p.as);
  const 말 = 돌린다(p.as);
  assert.match(말, /초록/, `도장이 최신인데 초록이라 안 한다 — 늘 빨간 계기는 곧 꺼진다:\n${말}`);
  assert.match(말, /통과 10 \+ 실패 0 \+ 건너뜀 0/, `분모를 안 낸다 — 초록은 분모와 함께만 읽는다(F207):\n${말}`);
});

test('🔴 급소 — 실패가 든 도장은 **빨갛다고** 말한다 (초록과 같은 통로로 새면 안 된다)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  돌린다(p.as, ['--찍기', '--통과', '9', '--실패', '3', '--건너뜀', '0']);
  const 말 = 돌린다(p.as);
  assert.match(말, /빨갛다/, `실패 3건인 도장을 초록 통로로 냈다:\n${말}`);
  assert.match(말, /3건/, `몇 건인지 안 말한다:\n${말}`);
});

/* ── 자기 처방·거짓 도장 (맹점 ③·④) ────────────────────────────────── */

test('🔑 `--실패` 없이는 도장을 안 찍는다 (안 재고 찍은 도장은 초록과 모양이 같다)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  const 말 = 돌린다(p.as, ['--찍기', '--통과', '10']);
  assert.doesNotMatch(말, /도장 —/, `실패 수 없이 도장이 찍혔다:\n${말}`);
  assert.match(말, /--실패/, `무엇이 없어서 안 찍혔는지 안 말한다 — 따를 수 없는 처방이 된다(F103):\n${말}`);
});

test('🔑 차단문이 시키는 대로 하면 실제로 찍힌다 (자기 처방이 통해야 우회가 안 생긴다)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  돌린다(p.as, ['--찍기', '--통과', '10']);                 // 처방을 받고
  const 말 = 찍는다(p.as);                                   // 그대로 따른다
  assert.match(말, /도장 —/, `처방대로 했는데 또 안 찍힌다 — 남는 문은 우회뿐이다:\n${말}`);
});

test('🔴 형제 저장소가 없으면 **못 쟀다**라고 말한다 — 없는 것과 빨간 것은 다르다(F296)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  fs.rmSync(p.talk, { recursive: true, force: true });
  const 말 = 돌린다(p.as);
  assert.match(말, /못 쟀다/, `형제가 없는데 그 사실을 안 말한다:\n${말}`);
  /* ⚠ 낱말 `초록` 으로 재면 안 된다 — 이 문장 자신이 「초록인지 못 쟀다」라 늘 걸린다.
   *   재는 것은 **초록 판정의 형태**다(`master 초록 — 통과 …`). 낱말이 아니라 판정을 재라. */
  assert.doesNotMatch(말, /master 초록 —/, `형제가 없는데 초록 판정을 냈다 — 「빚 0」과 「안 재봤다」가 같아진다(F207):\n${말}`);
});

/* ── 못 읽은 숫자를 0 으로 접지 않는다 (①배포 검수 P1 · 2026-08-17) ────────
 *
 * 옛 통로는 `Number(값) || 0` 이라 `--실패 nope` 이 **실패 0** 으로 앉았다. 바로 위
 * 「`--실패` 필수」 문이 지키려던 것이 그 자리에서 그대로 샜다 — 새는 방향은 「초록」이다.
 */

test('🔑 탐지력 — 개수()가 못 읽는 값을 0 으로 접지 않는다 (픽스처가 진다)', () => {
  const { 개수 } = require('../tools/형제초록.js');
  for (const 나쁨 of ['nope', '--건너뜀', '', '  ', '-1', '1.5', 'NaN', '3건']) {
    const r = 개수(나쁨);
    assert.ok(r.오류 !== undefined, `«${나쁨}» 을 숫자로 받았다 — 0 으로 접히면 안 쟀다가 초록이 된다: ${JSON.stringify(r)}`);
  }
  for (const [원, 값] of [['0', 0], ['2321', 2321], [undefined, null]]) {
    assert.deepStrictEqual(개수(원), { 값 }, `«${원}» 을 거부했다 — 정상 입력을 막으면 우회가 정상 통로가 된다`);
  }
});

test('🔴 급소 — `--실패 nope` 로는 도장을 안 찍는다 (0 으로 접으면 「실패 0」 초록이 된다)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  const 도장 = path.join(p.as, 'docs', '_ops', '형제초록.json');
  const 말 = 돌린다(p.as, ['--찍기', '--통과', '10', '--실패', 'nope', '--건너뜀', '0']);
  assert.doesNotMatch(말, /도장 —/, `못 읽는 실패 수로 도장이 찍혔다:\n${말}`);
  assert.strictEqual(fs.existsSync(도장), false, '도장 파일이 실제로 쓰였다 — 출력만 조용한 게 아니라 바이트가 앉았다');
  assert.match(말, /--실패 nope/, `무엇을 못 읽었는지 안 말한다 — 따를 수 없는 처방이 된다(F103):\n${말}`);
  /* 그리고 그 뒤 상태는 「초록」이 아니라 「안 쟀다」여야 한다 — 거부의 값이 여기서 확인된다 */
  const 뒤 = 돌린다(p.as);
  assert.doesNotMatch(뒤, /master 초록 —/, `거부했는데 초록 판정이 남았다:\n${뒤}`);
});

test('🔴 급소 — 값 자리에 다음 플래그가 오면 거부한다 (`--실패 --건너뜀 1`)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  /* `--실패` 는 «있고» 값만 밀린 모양이다 — 필수 검사(undefined)는 이걸 못 잡는다. */
  const 말 = 돌린다(p.as, ['--찍기', '--통과', '10', '--실패', '--건너뜀', '1']);
  assert.doesNotMatch(말, /도장 —/, `실패 수가 밀렸는데 도장이 찍혔다:\n${말}`);
  assert.strictEqual(fs.existsSync(path.join(p.as, 'docs', '_ops', '형제초록.json')), false, '도장 파일이 쓰였다');
});

test('🔑 차단문이 시키는 대로 하면 찍힌다 — 거부가 우회를 낳지 않는다 (맹점 ③)', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  돌린다(p.as, ['--찍기', '--통과', '10', '--실패', 'nope', '--건너뜀', '0']);   // 막히고
  const 말 = 돌린다(p.as, ['--찍기', '--통과', '2321', '--실패', '0', '--건너뜀', '1']);  // 처방 그대로
  assert.match(말, /도장 —/, `처방대로 했는데 또 안 찍힌다 — 남는 문은 우회뿐이다:\n${말}`);
});

test('🔑 안 준 칸은 `0` 이 아니라 `?` 다 — 「0건 쟀다」와 「안 적었다」는 다르다', (t) => {
  const p = 쓰고버린다(t); if (!p) return;
  const 말 = 돌린다(p.as, ['--찍기', '--실패', '0']);
  assert.match(말, /도장 —/, `필수 칸은 다 줬는데 안 찍혔다:\n${말}`);
  assert.match(말, /통과 \? \+ 실패 0 \+ 건너뜀 \?/, `안 준 칸이 0 으로 메워졌다 — 분모 0 이 초록으로 읽힌다(F207):\n${말}`);
  const 뒤 = 돌린다(p.as);
  assert.match(뒤, /통과 \? \+ 실패 0 \+ 건너뜀 \?/, `판정 화면에서도 안 적힌 칸이 0 으로 보인다:\n${뒤}`);
});

/* ── 등재 — 스스로 발화하지 않는 장치는 안 돈다 ───────────────────────── */

test('실저장소: SessionStart 가 이 도구를 부른다 (장치와 발동 조건은 같은 커밋에서 정한다)', () => {
  const s = JSON.parse(fs.readFileSync(설정, 'utf8'));
  const 줄 = ((s.hooks || {}).SessionStart || [])
    .flatMap((g) => (g.hooks || []).map((h) => String(h.command || '')))
    .filter((c) => c.includes('형제초록.js'));
  assert.strictEqual(줄.length, 1, '형제초록 이 SessionStart 에 정확히 한 번 등재돼 있어야 한다 — 0이면 안 돌고, 2면 두 번 말한다');
  assert.match(줄[0], /CLAUDE_PROJECT_DIR:-\$PWD/,
    '뿌리를 `${CLAUDE_PROJECT_DIR:-$PWD}` 로 안 잡았다 — 클라우드에선 변수가 비어 폴백이 실제로 일한다(F044·F053)');
  assert.match(줄[0], /미실행/, '못 띄웠을 때 조용하다 — 미실행이 통과와 같은 모양이 된다(F207)');
});
