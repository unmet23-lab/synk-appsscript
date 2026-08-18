/* 환경눈 — 「이 환경에서 못 재는 층」 한 줄의 회귀 (유호 지시 2026-08-18 「한 수 더」).
 *
 * 이 스위트가 지는 것 셋:
 *   ① 층 표가 **낡지 않는다** — 각 칸이 이름 댄 도구·훅 파일이 실재해야 한다.
 *      (표가 낡으면 이 줄은 「다 보인다」고 말하는데 그 층은 실제로 눈이 먼다 — 새는 방향이 통과다.)
 *   ② 판정이 **환경에 따라 갈린다** — 픽스처로 보임/안 보임을 양방향으로 만든다.
 *      한 방향만 검사하면 「언제나 눈멀었다」를 찍는 판도 초록으로 통과한다(F207).
 *   ③ **등록층** — settings.json 에 실제로 걸려 있어야 한다. 가드는 로직보다 등록층에서 샌다
 *      (F044·F053). 스스로 발화하지 않는 장치는 안 돈다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const 도구 = path.join(ROOT, 'tools', '환경눈.js');

const 돌리기 = (args, env) => spawnSync(process.execPath, [도구, ...(args || [])], {
  cwd: ROOT, encoding: 'utf8',
  env: { ...process.env, ...(env || {}) },
});

/* ── ① 층 표가 낡지 않는다 ─────────────────────────────────────────────── */

test('🔴 층 표가 이름 댄 도구·훅 파일이 전부 실재한다 (이름이 낡으면 이 줄이 거짓말을 한다)', () => {
  const src = fs.readFileSync(도구, 'utf8');
  const 도구칸 = [...src.matchAll(/도구:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(도구칸.length >= 5, `층 표에서 도구 칸을 ${도구칸.length}개밖에 못 읽었다 — 표 모양이 바뀌었다`);

  const 없는것 = [];
  for (const 칸 of 도구칸) {
    for (const 조각 of 칸.split('·').map((s) => s.trim())) {
      const 경로 = 조각.split(/\s/)[0];                       // `tools/작업가지.js --훅` → 경로만
      if (!/[/\\]/.test(경로)) continue;                      // 「엔진 도달 실측」 같은 설명 칸은 건너뛴다
      if (!fs.existsSync(path.join(ROOT, 경로))) 없는것.push(경로);
    }
  }
  assert.deepEqual(없는것, [],
    '층 표가 없는 파일을 가리킨다 — 그 층은 이제 다른 곳에서 재거나 사라졌다.\n'
    + '  표를 고치지 않으면 이 줄은 「보인다/안 보인다」를 엉뚱한 재료로 말한다.');
});

/* ── ② 판정이 양방향으로 갈린다 ─────────────────────────────────────────── */

test('🔴 세션 지문 층 — HOST 가 있으면 보이고, 셋 다 없으면 눈먼다 (양방향)', () => {
  const 빈판 = { CLAUDE_CODE_HOST_SESSION_ID: '', CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '' };

  const 보임 = 돌리기([], { ...빈판, CLAUDE_CODE_HOST_SESSION_ID: 'local_302d8acd-1111-2222-3333-444455556666' });
  assert.match(보임.stdout, /✅ 세션 지문/, '지문이 있는데 눈먼 것으로 셌다:\n' + 보임.stdout);

  const 눈멈 = 돌리기([], 빈판);
  assert.match(눈멈.stdout, /· 세션 지문 —/, '지문이 없는데 보이는 것으로 셌다:\n' + 눈멈.stdout);
});

test('🔑 분모가 실제로 움직인다 — 한 층을 살리면 「눈먼 층」 수가 하나 줄어든다', () => {
  const 빈판 = { CLAUDE_CODE_HOST_SESSION_ID: '', CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '' };
  const 센다 = (out) => {
    const m = /눈먼 층 (\d+)\/(\d+)/.exec(out);
    assert.ok(m, '분모 줄을 못 읽었다:\n' + out);
    return { 눈먼: Number(m[1]), 전체: Number(m[2]) };
  };
  const a = 센다(돌리기([], 빈판).stdout);
  const b = 센다(돌리기([], { ...빈판, CLAUDE_CODE_HOST_SESSION_ID: 'local_302d8acd' }).stdout);
  assert.equal(a.전체, b.전체, '전체 층 수가 환경에 따라 흔들린다 — 분모가 안 고정이면 비교가 뜻을 잃는다');
  assert.equal(b.눈먼, a.눈먼 - 1,
    `한 층을 살렸는데 눈먼 수가 ${a.눈먼}→${b.눈먼} 이다 — 판정이 환경을 안 읽거나 층이 서로 얽혀 있다`);
});

/* ── ③ 조용함·게이트·등록층 ─────────────────────────────────────────────── */

test('🔑 `--훅` 은 눈먼 층이 있을 때만 말한다 (없으면 조용한 것이 정상이다)', () => {
  // 이 저장소에선 최소 한 층은 눈먼 상태라(형제 저장소 등) 「말한다」쪽만 확정으로 잰다.
  const r = 돌리기(['--훅'], { CLAUDE_CODE_HOST_SESSION_ID: '', CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '' });
  assert.equal(r.status, 0, '훅이 비0 으로 죽으면 세션 시작이 시끄러워진다');
  assert.match(r.stdout, /눈먼 층 \d+\/\d+/);
  // 그리고 --훅 은 ✅ 목록을 안 찍는다(시동 화면은 짧아야 한다).
  assert.ok(!/✅/.test(r.stdout), '`--훅` 이 보이는 층까지 나열한다 — 시동 출력이 길어진다:\n' + r.stdout);
});

test('🔴 모르는 플래그는 조용히 안 삼킨다 (인자 게이트 · F400 계열)', () => {
  const r = 돌리기(['--엉뚱한것']);
  assert.notEqual(r.status, 0, '모르는 플래그인데 종료코드가 0 이다 — 「딴 과녁을 재고 초록」이 된다');
});

test('🔴 등록층 — 환경눈과 install-githooks 가 SessionStart 에 실제로 걸려 있다', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const 명령들 = (s.hooks.SessionStart || []).flatMap((g) => g.hooks.map((h) => String(h.command || '')));
  assert.ok(명령들.some((c) => c.includes('환경눈.js')),
    '환경눈이 SessionStart 에 없다 — 스스로 발화하지 않는 장치는 안 돈다(CLAUDE.md 신뢰성)');
  assert.ok(명령들.some((c) => c.includes('install-githooks.js')),
    'install-githooks 가 SessionStart 에 없다 — 클라우드 컨테이너는 훅이 안 깔린 채로 커밋한다(F634 ■2)');
});

test('🔑 등록 명령이 F044 폴백 형태를 지킨다 — 클라우드에선 그 폴백이 «실제로 일한다»', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const 새것 = (s.hooks.SessionStart || [])
    .flatMap((g) => g.hooks.map((h) => String(h.command || '')))
    .filter((c) => c.includes('환경눈.js') || c.includes('install-githooks.js'));
  assert.equal(새것.length, 2);
  for (const c of 새것) {
    assert.ok(c.includes('${CLAUDE_PROJECT_DIR:-$PWD}'),
      '경로를 `${CLAUDE_PROJECT_DIR:-$PWD}` 로 안 잡았다 — 클라우드에선 그 변수가 비어 폴백이 일한다(F044)');
    assert.ok(/command -v node/.test(c),
      'node 존재 확인이 없다 — 없는 기계에서 조용히 안 도는 대신 드러나야 한다(F044)');
  }
});

test('🔑 `--훅` 이 저장소를 안 바꾼다 — 시동 훅이 상태를 건드리면 남의 커밋에 섞인다', () => {
  const 전 = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  if (전.status !== 0) return;                       // git 이 없는 기계 — 이 축은 안 재졌다
  돌리기(['--훅']);
  const 후 = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(후.stdout, 전.stdout, '환경눈을 돌렸더니 작업 트리가 바뀌었다 — 읽기 전용이어야 한다');
});
