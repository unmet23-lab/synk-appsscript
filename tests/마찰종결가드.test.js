#!/usr/bin/env node
/* 마찰 장부 종결 가드 회귀 — .claude/hooks/friction-close-guard.js
 *
 * 무엇을 지키나 (F096): 마찰 번호를 단 커밋이 들어갔는데 그 장부 행이 아직 열려 있으면 알린다.
 *   장부는 /evolve 의 연료라, 열린 채 남은 행은 다음 세션이 **이미 끝난 일을 다시 집게** 만든다.
 *
 * 탐지 능력은 **픽스처가 진다** — 임시 git 저장소 + 가짜 장부를 만들어 거기서 잰다.
 * 실저장소에는 **거짓양성만** 묻는다(CLAUDE.md 가드 맹점 ②: 버그가 아직 있을 것을 요구하는 회귀 금지).
 *
 * ⚠ 이 스위트는 실장부(docs/_ops/마찰신호.md)를 **쓰지 않는다.** 픽스처 장부를 SYNK_FRICTION_LEDGER 로
 *   갈아끼우고, 세션 상태도 SYNK_FRICTION_GUARD_DIR 로 임시 폴더에 가둔다 — 시험이 기록을 오염시키면
 *   그 기록은 증거가 못 된다(F096 이 정확히 그 사고였다).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, '.claude', 'hooks', 'friction-close-guard.js');

const 장부머리 = '# 마찰 신호\n\n| ID | 날짜 | 종류 | 신호 | 해소 |\n|---|---|---|---|---|\n';
const 열린행 = '| F900 | 2026-08-05 | 실수 | 픽스처 — 아직 안 닫힌 신호 | |\n';
const 닫힌행 = '| F901 | 2026-08-05 | 실수 | 픽스처 — 이미 닫힌 신호 | 무엇이 막았는지 적혀 있다 |\n';

/** 임시 git 저장소 + 픽스처 장부. 실저장소는 안 건드린다. */
function 픽스처() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fcg-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  git('init', '-q');
  git('config', 'user.email', 'f@t.test');
  git('config', 'user.name', 'fixture');
  git('config', 'commit.gpgsign', 'false');
  const 장부 = path.join(dir, 'docs', '_ops', '마찰신호.md');
  fs.mkdirSync(path.dirname(장부), { recursive: true });
  fs.writeFileSync(장부, 장부머리 + 열린행 + 닫힌행);
  fs.writeFileSync(path.join(dir, '아무거나.txt'), '1');
  git('add', '-A');
  git('commit', '-q', '-m', '픽스처 바탕');
  return { dir, 장부, git, 상태: fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fcg-state-')) };
}

/** 커밋 하나 만들고 그 결과로 훅을 돌린다 — 실제 발화 경로 그대로(명령·출력·cwd). */
function 돌려(f, 메시지, opts = {}) {
  fs.appendFileSync(path.join(f.dir, '아무거나.txt'), '\n' + 메시지);
  f.git('add', '-A');
  const out = f.git('commit', '-m', 메시지);
  const 입력 = {
    tool_name: 'Bash',
    tool_input: { command: `git commit -m "${메시지.replace(/"/g, '')}" -- .` },
    tool_response: { stdout: opts.출력 !== undefined ? opts.출력 : out, stderr: '' },
    cwd: f.dir,
  };
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(입력),
    encoding: 'utf8',
    env: {
      ...process.env,
      SYNK_FRICTION_LEDGER: f.장부,
      SYNK_FRICTION_GUARD_DIR: opts.상태 || f.상태,
      CLAUDE_CODE_HOST_SESSION_ID: opts.세션 || 'fixture-session',
    },
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch (_) { /* 침묵이면 stdout 이 비어 있다 */ }
  /* ⚠ status 를 같이 돌려준다 — **침묵과 폭사는 stdout 에서 같은 모양이다.**
   * 변이 시험이 잡아낸 실제 맹점: 착지 검사를 없앴더니 훅이 예외로 죽어 stdout 이 비었고,
   * 「조용하다」만 보던 검사는 그걸 정답으로 읽어 초록이었다(통과와 미실행이 같은 모양이면 안 된다). */
  return { raw: r.stdout, json, status: r.status, 짖었나: !!(json && json.hookSpecificOutput) };
}

test('🔴 열린 행을 단 커밋이면 짖는다 (F096 그 상황)', () => {
  const f = 픽스처();
  const r = 돌려(f, 'fix: 무언가를 고쳤다 (F900)');
  assert.ok(r.짖었나, '열린 행 F900 을 단 커밋인데 조용했다 — 이 훅이 존재하는 이유가 그것이다');
  assert.match(r.json.hookSpecificOutput.additionalContext, /F900/);
  assert.match(r.json.systemMessage, /장부 미종결/);
});

test('이미 닫힌 행이면 조용하다 (거짓양성이면 사람이 가드를 끈다)', () => {
  const f = 픽스처();
  assert.equal(돌려(f, 'fix: 이미 닫힌 것을 인용했다 (F901)').짖었나, false);
});

test('장부에 없는 번호는 조용하다', () => {
  const f = 픽스처();
  assert.equal(돌려(f, 'fix: 남의 저장소 번호 (F777)').짖었나, false);
});

test('🔴 신고 커밋(그 행을 만든 커밋)은 조용하다 — 정상 작업을 벌주면 가드가 꺼진다', () => {
  const f = 픽스처();
  // 새 행을 장부에 추가하면서 그 번호를 제목에 다는 커밋 = friction.js add 직후의 실제 모양
  fs.appendFileSync(f.장부, '| F902 | 2026-08-05 | 마찰 | 방금 신고한 신호 | |\n');
  f.git('add', '-A');
  const out = f.git('commit', '-m', 'docs: 마찰 F902 — 방금 신고했다');
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git commit -F msg.txt -- docs/_ops/마찰신호.md' },
      tool_response: { stdout: out, stderr: '' },
      cwd: f.dir,
    }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_FRICTION_LEDGER: f.장부, SYNK_FRICTION_GUARD_DIR: f.상태, CLAUDE_CODE_HOST_SESSION_ID: 'fixture-session' },
  });
  assert.equal(spawnSync ? r.stdout.trim() : '', '',
    '신고 커밋에 짖었다 — 신호를 기록할 때마다 경고가 뜨면 사람이 훅을 끈다(F049 실측)');
});

test('🔴 커밋이 안 들어갔으면(no-op) **정상 종료로** 조용하다 — 그건 commit-noop-guard 몫이다', () => {
  const f = 픽스처();
  const r = 돌려(f, 'fix: 고쳤다 (F900)', { 출력: 'nothing to commit, working tree clean' });
  assert.equal(r.짖었나, false, '[sha] 착지 줄이 없는데 짖었다 — 안 들어간 커밋을 벌준다');
  assert.equal(r.status, 0, '조용하긴 한데 훅이 죽어서 조용했다 — 침묵과 폭사를 가른다');
});

test('🔴 같은 세션에서 같은 번호는 한 번만 말한다 (소음은 가드를 끄게 만든다)', () => {
  const f = 픽스처();
  assert.equal(돌려(f, 'fix: 1차 (F900)').짖었나, true);
  assert.equal(돌려(f, 'fix: 2차 같은 트랙 (F900)').짖었나, false, '같은 세션·같은 번호로 두 번 짖었다');
  // 다른 세션이면 다시 말해야 한다 — 인계받은 세션은 그 사실을 모른다
  assert.equal(돌려(f, 'fix: 3차 (F900)', { 세션: '다른-세션' }).짖었나, true,
    '세션이 바뀌었는데 조용하다 — 이어받은 세션은 열린 행을 모른 채 끝낸다');
});

test('🔴 git commit 이 아닌 명령엔 발화하지 않는다 — 명령 판정이 실제로 일하는지 본다', () => {
  const f = 픽스처();
  /* ⚠ 여기 쓰는 sha 는 **픽스처에 실재하는 커밋**이어야 한다.
   * 변이 시험이 잡아낸 맹점: 가짜 sha(abc1234)를 주면 git log 가 실패해 훅이 어차피 조용해져,
   * 명령 판정을 통째로 없애도 초록이었다 — 검사가 엉뚱한 이유로 통과하던 자리다. */
  fs.appendFileSync(path.join(f.dir, '아무거나.txt'), '\n실재 커밋');
  f.git('add', '-A');
  const 착지출력 = f.git('commit', '-m', 'fix: 실재하는 커밋이고 열린 행을 단다 (F900)');
  assert.match(착지출력, /\[[^\]]*[0-9a-f]{7}\]/, '픽스처가 착지 줄을 안 냈다 — 이 검사의 전제가 깨졌다');

  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git log --oneline -5' },   // 커밋이 아니다
      tool_response: { stdout: 착지출력, stderr: '' },
      cwd: f.dir,
    }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_FRICTION_LEDGER: f.장부, SYNK_FRICTION_GUARD_DIR: f.상태, CLAUDE_CODE_HOST_SESSION_ID: 'fixture-session' },
  });
  assert.equal(r.stdout.trim(), '', 'commit 이 아닌데 발화했다 — 조회 명령마다 짖으면 가드가 꺼진다');
  assert.equal(r.status, 0, '조용한 게 아니라 죽었다');
});

test('🔴 처방-실행층 결속 — 훅이 시키는 `friction.js resolve` 가 실재한다', () => {
  const 본문 = fs.readFileSync(HOOK, 'utf8');
  const m = /friction\.js\s+resolve/.exec(본문);
  assert.ok(m, '훅이 resolve 명령을 안 가리킨다 — 처방이 없으면 알림은 잔소리로 끝난다');
  const friction = fs.readFileSync(path.join(ROOT, 'tools', 'friction.js'), 'utf8');
  assert.match(friction, /cmd === 'resolve'/,
    "훅은 `friction.js resolve` 를 시키는데 도구에 그 명령이 없다 — 지시한 자리가 비어 있다(F096 그 형태)");
});

test('실저장소 — 거짓양성만 본다: 이미 닫힌 번호를 단 커밋에 짖지 않는다', () => {
  // 탐지력은 위 픽스처가 졌다. 여기서는 실장부·실훅 조합이 **정상 커밋을 벌주지 않는지**만 본다.
  const 장부 = require(path.join(ROOT, 'tools', 'friction.js'));
  const 닫힌 = 장부.read().rows.filter((r) => r.resolved);
  if (!닫힌.length) { assert.ok(true, '(실장부에 닫힌 행이 없어 건너뛴다 — 통과와 미실행이 같은 모양이면 안 된다)'); return; }
  const id = 닫힌[닫힌.length - 1].id;
  const 상태 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-fcg-real-'));
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "..." -- .' },
      // 실저장소 HEAD 를 착지시킨 것처럼 준다. HEAD 메시지에 그 번호가 없으면 애초에 조용한 게 정상.
      tool_response: { stdout: '[master 0000000] 실저장소 거짓양성 검사', stderr: '' },
      cwd: ROOT,
    }),
    encoding: 'utf8',
    env: { ...process.env, SYNK_FRICTION_GUARD_DIR: 상태, CLAUDE_CODE_HOST_SESSION_ID: 'false-positive-probe' },
  });
  assert.equal(r.status, 0, '실저장소에서 훅이 비정상 종료했다');
  assert.ok(!/장부 미종결/.test(r.stdout) || !new RegExp(id).test(r.stdout),
    `이미 닫힌 ${id} 에 짖었다 — 거짓양성`);
});

// ── F107 — 「고치고 → 신고」 순서에서 가드가 **원리상** 못 짖던 자리 ────────────────────
//
// 이 저장소의 정상 순서는 고치고 나서 신고다. 그러면 수리 커밋에는 아직 없는 번호가 못 들어가고
// (행이 없으니까), 번호를 다는 유일한 커밋이 신고 커밋이 된다 — 그런데 신고 커밋은 면제다.
// 즉 **번호를 단 커밋과 행을 안 건드린 커밋이 영원히 겹치지 않아** 가드가 한 번도 못 짖었다.
// 실물: 92b3925 는 제목에 「해소 장치 동반: b7a2a18·fff91f0」이라 적고도 해소 칸이 빈 채 남았다.

/** 신고 커밋의 실제 모양 — 장부에 행을 더하면서 그 번호를 제목에 단다. */
function 신고커밋(f, 행, 제목, 동반 = {}) {
  fs.appendFileSync(f.장부, 행);
  /* 동반 = 같은 커밋에 함께 들어가는 장부 밖 파일들(수리·회귀·보드…). F132 예외가 읽는 것이 이것이다. */
  for (const [rel, 내용] of Object.entries(동반)) {
    const p = path.join(f.dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 내용);
  }
  f.git('add', '-A');
  const out = f.git('commit', '-m', 제목);
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git commit -F msg.txt -- docs/_ops/마찰신호.md' },
      tool_response: { stdout: out, stderr: '' },
      cwd: f.dir,
    }),
    encoding: 'utf8',
    env: {
      ...process.env,
      SYNK_FRICTION_LEDGER: f.장부,
      SYNK_FRICTION_GUARD_DIR: f.상태,
      CLAUDE_CODE_HOST_SESSION_ID: 'fixture-session',
    },
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch (_) { /* 침묵 */ }
  return { raw: r.stdout, json, status: r.status, 짖었나: !!(json && json.hookSpecificOutput) };
}

test('🔴 F107 — 신설 행이 **스스로 해소를 지목**하면 신고 커밋이라도 짖는다', () => {
  const f = 픽스처();
  const r = 신고커밋(f,
    '| F903 | 2026-08-05 | 실수 | 무언가를 잘못 읽었다. 해소=tools/무언가.js + 훅(abc1234) | |\n',
    'docs: 마찰 F903 — 신고하면서 해소를 적었다 (해소 장치 동반: abc1234)');
  assert.equal(r.status, 0, '조용한 게 아니라 죽었다');
  assert.ok(r.짖었나,
    '해소를 스스로 지목한 신설 행에 조용했다 — 이 순서에서는 이 커밋 말고 짖을 기회가 영영 없다(F107)');
  assert.match(r.json.hookSpecificOutput.additionalContext, /F903/);
  assert.match(r.json.hookSpecificOutput.additionalContext, /스스로 해소를 지목/);
});

test('🔴 해소를 안 지목한 평범한 신고 커밋은 **여전히** 조용하다 (예외가 면제를 통째로 먹으면 안 된다)', () => {
  const f = 픽스처();
  const r = 신고커밋(f,
    '| F904 | 2026-08-05 | 마찰 | 그냥 신고만 한다 — 아직 안 고쳤다 | |\n',
    'docs: 마찰 F904 — 방금 신고했다');
  assert.equal(r.짖었나, false,
    '평범한 신고에 짖으면 신호를 기록할 때마다 경고가 뜬다 — 사람은 그런 가드를 끈다(F049)');
});

test('🔴 행 **갱신**(-/+ 둘 다)은 해소 문구가 있어도 면제 — 예외는 신설에만 붙는다', () => {
  const f = 픽스처();
  // F900 을 고쳐 쓴다(신설이 아니라 갱신). 해소 칸은 아직 빈 채, 신호문에만 해소 얘기를 붙인다.
  const 원본 = fs.readFileSync(f.장부, 'utf8');
  fs.writeFileSync(f.장부, 원본.replace(
    '| F900 | 2026-08-05 | 실수 | 픽스처 — 아직 안 닫힌 신호 | |',
    '| F900 | 2026-08-05 | 실수 | 픽스처 — 조사해 보니 해소=아직 검증 중인 후보 | |'));
  f.git('add', '-A');
  const out = f.git('commit', '-m', 'docs: 마찰 F900 — 신호문에 조사 결과를 덧붙인다');
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git commit -F msg.txt -- docs/_ops/마찰신호.md' },
      tool_response: { stdout: out, stderr: '' },
      cwd: f.dir,
    }),
    encoding: 'utf8',
    env: {
      ...process.env,
      SYNK_FRICTION_LEDGER: f.장부,
      SYNK_FRICTION_GUARD_DIR: f.상태,
      CLAUDE_CODE_HOST_SESSION_ID: 'fixture-session',
    },
  });
  assert.equal(r.stdout.trim(), '',
    '갱신 커밋에 짖었다 — 신호문을 다듬을 때마다 경고가 뜨면 그것도 소음이다');
});

// ── F132 (2026-08-07) — 신설 면제의 **두 번째** 예외 ───────────────────────────────────
// 실물: 3199240 이 F132 행을 신설하면서 **같은 커밋에** 수리(tools/codex-review.js)와 회귀를 실었다.
// 신호문은 해소를 안 지목해 F107 예외(①)에도 안 걸렸고 — 두 면제 사이로 새서 08-06 부터 열린 채였다.
// ① 은 **신호문**을 읽고 ② 는 **커밋이 무엇을 고쳤는지**를 읽는다. 축이 달라 하나가 다른 하나를 못 덮는다.

test('🔴 F132 — 신설 커밋이 장부 밖 파일도 고쳤으면 짖는다 (「고치고 신고」는 그냥 신고가 아니다)', () => {
  const f = 픽스처();
  const r = 신고커밋(f,
    '| F905 | 2026-08-07 | 실수 | 잠금이 검증된 적이 없다 — 기본값과 같은 값이라 미실행과 통과가 같은 모양 | |\n',
    '검수 잠금: 진짜 근거는 하나였다 (F905 실측 + 회귀)',
    { 'tools/무언가.js': 'module.exports = 1;\n' });
  assert.equal(r.status, 0, '조용한 게 아니라 죽었다');
  assert.ok(r.짖었나,
    '수리를 같은 커밋에 싣고 신고한 행에 조용했다 — 이 순서에서는 짖을 기회가 영영 없다(F132 가 샌 자리)');
  assert.match(r.json.hookSpecificOutput.additionalContext, /F905/);
  assert.match(r.json.hookSpecificOutput.additionalContext, /같은 커밋에 수리를 실었다/);
});

test('🔴 신설 + **보드만** 동반은 여전히 조용하다 — 기록물은 수리가 아니다 (실측 78bd7c8)', () => {
  const f = 픽스처();
  const r = 신고커밋(f,
    '| F906 | 2026-08-07 | 마찰 | 신고하면서 보드 줄도 같이 고쳤다 | |\n',
    '보드에 커밋 해시를 박고 마찰 F906 을 장부에 올린다',
    { 'docs/세션보드.md': '| 2026-08-07 | 트랙 | 파일 | 상태 |\n' });
  assert.equal(r.짖었나, false,
    '보드를 동반한 신고에 짖었다 — 이 저장소의 신고 커밋 상당수가 이 모양이라 소음이 되고, 소음은 가드를 끈다(F049).\n'
    + '🔑 여기서 초록이 되려면 파일 목록을 **-z 로** 받아야 한다 — core.quotepath 기본값(true)이 한글 경로를\n'
    + '   `"docs/\\354\\204\\270..."` 로 이스케이프해서, 그대로 비교하면 장부도 보드도 「장부 밖」으로 읽힌다\n'
    + '   (재는 층이 값을 깨뜨리는 형태 · CLAUDE.md 원인 판정 전제 ②).');
});

test('🔴 판별식은 friction.js 하나에서 온다 — 훅이 자기 사본을 들고 있으면 갈라진다 (맹점 ④)', () => {
  const 본문 = fs.readFileSync(HOOK, 'utf8');
  assert.match(본문, /장부\.해소주장/,
    '훅이 friction.js 의 해소주장을 안 쓴다 — 같은 판정을 두 곳에 적으면 갈라지고, 갈라지는 방향은 언제나 「통과」다');
  const 장부 = require(path.join(ROOT, 'tools', 'friction.js'));
  assert.equal(typeof 장부.해소주장, 'function', 'friction.js 가 해소주장을 export 하지 않는다');
});
