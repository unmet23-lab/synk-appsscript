'use strict';
/* tools/test-ci.js 의 두 겹 한도 (2026-11-10) — 남은 자식 때문에 안 끝나는 시험 파일을 진짜로 만들어 잰다.
 * 11-10 전체 런 두 벌이 글자검사에서 5시간 넘게 멈췄다: 시험 본문은 20초에 실패로 끝났는데, 남은 크롬이 stderr 통로를 붙잡아
 * 파일 프로세스가 끝나지 못했다. 시험마다의 --test-timeout 으로는 이 꼴을 못 잡는다(본문은 이미 끝났다) — 런 전체 한도가 잡는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 시험파일뽑기, 돌리기, 넘김줄들 } = require('../tools/test-ci.js');

const 살았나 = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const 기다림 = (ms) => new Promise((r) => setTimeout(r, ms));

function 픽스처(파일들) {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-test-ci한도-'));
  fs.mkdirSync(path.join(방, 'tests'));
  for (const [이름, 글] of Object.entries(파일들)) fs.writeFileSync(path.join(방, 'tests', 이름), 글, 'utf8');
  return 방;
}
const 치우기 = (방) => { try { fs.rmSync(방, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* 청소 실패는 판정과 무관 */ } };

test('시험파일뽑기 — 윈도우 · 리눅스 명령 줄에서 tests/…test.js 만, 겹치면 한 번', () => {
  const 글 = [
    '"C:\\Program Files\\nodejs\\node.exe" --test-timeout=600000 D:\\SYNK\\tests\\글자검사.test.js',
    '/usr/bin/node --test-timeout=600000 /repo/tests/공개전점검.test.js',
    'node tests/글자검사.test.js',
    'node tools/test-ci.js',
    'node tests/lib/소스검사.js',
    'node tests/atlas.test.mjs',
  ].join('\n');
  assert.deepEqual(시험파일뽑기(글), ['tests/글자검사.test.js', 'tests/공개전점검.test.js', 'tests/atlas.test.mjs']);
  assert.deepEqual(시험파일뽑기(''), []);
});

test('넘김줄들 — 넘기지 않았으면 빈 목록, 넘겼으면 한도 · 안 끝난 파일 · 다음 할 일', () => {
  assert.deepEqual(넘김줄들(null), []);
  const 줄 = 넘김줄들({ 파일: ['tests/글자검사.test.js'] }, 60 * 60e3).join('\n');
  assert.match(줄, /60분을 넘겨 node --test 를 나무째 껐다/);
  assert.match(줄, /tests\/글자검사\.test\.js/);
  assert.match(줄, /--test-timeout=1200000/);
  assert.match(넘김줄들({ 파일: [] }).join('\n'), /명령 줄에서 못 읽음/);
});

test('돌리기 — 끝나는 런은 넘김 없이 상태를 그대로, 시험 하나의 한도(--test-timeout)는 본문을 취소한다', async () => {
  const 방 = 픽스처({
    '보통.test.js': "require('node:test')('보통', () => {});\n",
    '늦음.test.js': "const t = setTimeout(() => {}, 3000);\nrequire('node:test')('본문이 안 끝남', () => new Promise(() => {}));\n",
  });
  try {
    const 좋음 = await 돌리기(['tests/보통.test.js'], process.env, { cwd: 방, 전체ms: 60000, stdio: 'ignore' });
    assert.equal(좋음.넘김, null);
    assert.equal(좋음.status, 0);
    const 시작 = Date.now();
    const 늦음 = await 돌리기(['tests/늦음.test.js'], process.env, { cwd: 방, 시험ms: 500, 전체ms: 60000, stdio: 'ignore' });
    assert.equal(늦음.넘김, null, '타이머가 3초 뒤 풀리면 파일은 스스로 끝난다');
    assert.equal(늦음.status, 1, '취소된 시험은 실패로 센다');
    assert.ok(Date.now() - 시작 < 30000);
  } finally { 치우기(방); }
});

test('돌리기 — 남은 자식이 통로를 붙잡아 안 끝나는 파일은 전체 한도에서 이름을 대고 나무째 끈다', async () => {
  const 방 = 픽스처({
    '보통.test.js': "require('node:test')('보통', () => {});\n",
    // 11-10 그날의 꼴: 본문은 곧 끝나지만 띄운 아이가 stderr 통로를 쥐고 살아 있다
    '멈춤.test.js': [
      "const { spawn } = require('node:child_process');",
      "require('node:test')('본문은 끝남', () => {",
      "  const c = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: ['ignore', 'ignore', 'pipe'] });",
      "  require('node:fs').writeFileSync(require('node:path').join(__dirname, 'pid'), String(c.pid));",
      '});',
      '',
    ].join('\n'),
  });
  try {
    const 시작 = Date.now();
    const r = await 돌리기(['tests/보통.test.js', 'tests/멈춤.test.js'], process.env, { cwd: 방, 전체ms: 8000, stdio: 'ignore' });
    const 걸림 = Date.now() - 시작;
    assert.ok(r.넘김, `전체 한도에서 껐어야 한다 (status=${r.status})`);
    assert.deepEqual(r.넘김.파일, ['tests/멈춤.test.js'], '끝난 파일은 빼고 안 끝난 파일만 이름을 댄다');
    assert.ok(걸림 >= 7500 && 걸림 < 60000, `한도 8초 근처에서 끝나야 한다 (${걸림}ms)`);
    const 손자 = Number(fs.readFileSync(path.join(방, 'tests', 'pid'), 'utf8'));
    for (let i = 0; i < 50 && 살았나(손자); i += 1) await 기다림(100);
    assert.equal(살았나(손자), false, `통로를 쥔 손자 프로세스(${손자})까지 꺼야 한다`);
  } finally { 치우기(방); }
});
