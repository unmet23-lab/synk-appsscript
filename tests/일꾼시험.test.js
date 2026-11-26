'use strict';
// 일꾼시험 — 서버를 부르지 않는 부분만 본다: 쓸 수 있나의 판단과 ssh 응답 읽기(11-26).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const 일꾼 = require('../tools/일꾼시험.js');

function 가짜저장소(t, url) {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-일꾼시험-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', '-b', 'master'], { cwd: 폴더 });
  execFileSync('git', ['remote', 'add', 'origin', url], { cwd: 폴더 });
  return 폴더;
}

test('못쓰는까닭 — SYNK_일꾼=끔이거나 origin이 GitHub의 이 저장소가 아니면 쓰지 않는다(다른 호스트의 같은 이름도)', (t) => {
  const 옛 = process.env.SYNK_일꾼;
  t.after(() => { if (옛 === undefined) delete process.env.SYNK_일꾼; else process.env.SYNK_일꾼 = 옛; });
  const 남 = 가짜저장소(t, 'https://example.invalid/other.git');
  process.env.SYNK_일꾼 = '끔';
  assert.equal(일꾼.못쓰는까닭(남), 'SYNK_일꾼=끔');
  delete process.env.SYNK_일꾼;
  assert.match(일꾼.못쓰는까닭(남), /열쇠가 없다|GitHub의 이 저장소가 아니다/);
  for (const url of ['https://github.com/unmet23-lab/synk-appsscript.git', 'https://github.com/unmet23-lab/synk-appsscript', 'git@github.com:unmet23-lab/synk-appsscript.git',
    'ssh://git@github.com/unmet23-lab/synk-appsscript.git']) assert.equal(일꾼.우리저장소인가(url), true, url);
  for (const url of ['https://example.invalid/unmet23-lab/synk-appsscript.git', 'git@example.invalid:unmet23-lab/synk-appsscript.git',
    'https://github.com/someone/synk-appsscript.git', 'https://github.com/unmet23-lab/synk-appsscript-fork.git', 'C:/tmp/unmet23-lab/synk-appsscript.git', '']) assert.equal(일꾼.우리저장소인가(url), false, url);
});

test('응답읽기 — 「@@결과 N」 뒤는 장부 · TAP을 담은 gzip base64 한 줄과 끝 표 「@@끝」뿐이다 · 124만 시간 넘김 · SSH 실패 · 꼴이 다름 · 200번대는 되돌림', () => {
  const 자료 = (값) => zlib.gzipSync(Buffer.from(JSON.stringify(값))).toString('base64');
  const 장부 = '{"몰이판":1,"수":1}\n{"번호":0,"시작":true}\n{"번호":0,"종료":0,"신호":null}\n{"끝":true}\n';
  const taps = { 0: 'TAP version 13\nok 1 - a\n' };
  const 실 = 자료({ 장부, taps });
  const 판 = (stdout, 덧 = {}) => 일꾼.응답읽기({ stdout, stderr: '', status: 0, ...덧 }, 3);
  assert.deepEqual(판(`@@결과 0\n${실}\n@@끝\n`), { 몰이: { status: 0, signal: null }, 장부글: 장부, taps, 환경: null, 초: 3 }, '환경이 없으면 null(못 셈)');
  assert.deepEqual(판(`@@결과 0\n${자료({ 장부, taps, 환경: ['tests/a.test.js'] })}\n@@끝\n`).환경, ['tests/a.test.js']);
  assert.deepEqual(판(`@@결과 1\r\n${실}\r\n@@끝\r\n`).몰이, { status: 1, signal: null });
  assert.equal(판(`@@결과 0\n${자료({ 장부: null, taps: {} })}\n@@끝\n`).장부글, null, '장부가 없으면 null이다 — 몰이판정이 막는다');
  assert.deepEqual(판(`@@결과 124\n${실}\n@@끝\n`).몰이, { status: null, error: { code: 'ETIMEDOUT' } });
  assert.deepEqual(판(`@@결과 137\n${실}\n@@끝\n`).몰이, { status: 137, signal: null }, '137(SIGKILL)은 시간 넘김이 아니다 — 메모리 부족일 수 있어 몰이판정에 맡긴다');
  assert.match(판('@@결과 202\n@@끝\n', { stderr: '[일꾼] 꾸러미 받기 실패\n' }).되돌림, /준비 실패 202 — \[일꾼\] 꾸러미 받기 실패/);
  assert.match(판(`@@결과 0\n${실}\n@@끝\n`, { stderr: 'Connection reset', status: 255 }).되돌림, /끝까지 가지 않았다\(ssh 255\) — Connection reset/,
    '결과 줄이 있어도 SSH가 끊겼으면 되돌린다');
  assert.match(판('ok 1 - 가짜\n', { error: { code: 'ETIMEDOUT' }, status: null }).되돌림, /끝까지 가지 않았다\(ETIMEDOUT\)/);
  assert.match(판(`앞 기록 @@결과 0\n${실}\n@@끝\n`).되돌림, /결과 줄이 없다/, '줄 첫머리의 표만 읽는다');
  for (const [이름, 글] of [['끝 표 없음', `@@결과 0\n${실}\n`], ['자료 줄 없음', '@@결과 0\n@@끝\n'], ['끝 표 뒤에 덧붙은 줄', `@@결과 0\n${실}\n@@끝\n더\n`],
    ['자료 두 줄', `@@결과 0\n${실}\n${실}\n@@끝\n`]]) assert.match(판(글).되돌림, /자료 한 줄과 끝 표로 끝나지 않았다/, 이름);
  assert.match(판('@@결과 0\n!!!\n@@끝\n').되돌림, /자료를 읽지 못했다/);
  assert.match(판(`@@결과 0\n${Buffer.from(JSON.stringify({ 장부, taps })).toString('base64')}\n@@끝\n`).되돌림, /자료를 읽지 못했다/, '압축하지 않은 자료는 받지 않는다');
  for (const 값 of [{ 장부: 3, taps: {} }, { 장부 }, { 장부, taps: null }, null, { 장부, taps, 환경: 'tests/a.test.js' }, { 장부, taps, 환경: [1] }]) assert.match(판(`@@결과 0\n${자료(값)}\n@@끝\n`).되돌림, /꼴이 다르다/, JSON.stringify(값));
});

test('시험.sh 결과 싸기 — 장부 · TAP · 환경을 gzip해 응답읽기가 읽는 한 줄로 · 상한 없이 큰 판도 보낸다(일꾼몰이-8 GA3 · -9 GA1)', (t) => {
  // 시험.sh의 finish 안 node 글을 그대로 꺼내 돈다(서버를 부르지 않고 같은 코드를 본다)
  const 글 = fs.readFileSync(path.join(__dirname, '..', 'tools', '일꾼', '시험.sh'), 'utf8').replace(/\r\n/g, '\n');
  const m = /finish\(\) \{[\s\S]*?node -e '\n([\s\S]*?)\n    ' "\$jd" "\$ntests" "\$d"/.exec(글);
  assert.ok(m, 'finish의 node 글을 찾는다');
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-일꾼싸기-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  const 자리 = '/home/runner/slot/1';
  const 장부 = '{"몰이판":1,"수":2}\n{"끝":true}\n';
  fs.writeFileSync(path.join(폴더, '장부.jsonl'), 장부);
  fs.writeFileSync(path.join(폴더, '0.tap'), `TAP version 13\nok 1 - a # ${자리}/tests/a.test.js\n`);
  fs.writeFileSync(path.join(폴더, '환경.json'), JSON.stringify(['tests/b.test.js']));
  const 싸기 = () => spawnSync(process.execPath, ['-e', m[1], 폴더, '2', 자리], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const p = 싸기();
  assert.equal(p.status, 0, p.stderr);
  const r = 일꾼.응답읽기({ stdout: `@@결과 0\n${p.stdout}@@끝\n`, stderr: '', status: 0 }, 1);
  assert.deepEqual(r, { 몰이: { status: 0, signal: null }, 장부글: 장부, taps: { 0: 'TAP version 13\nok 1 - a # tests/a.test.js\n' }, 환경: ['tests/b.test.js'], 초: 1 }, '서버 자리 경로는 지운다 · 없는 TAP(1번)은 빠진다');
  // 압축이 안 되는 큰 TAP도 버리지 않고 보낸다 — 서버에서 본 실패를 잃지 않게(일꾼몰이-9 GA1)
  const 큰글 = `TAP version 13
not ok 1 - 깨짐
# ${crypto.randomBytes(5 << 20).toString('base64')}
`;
  fs.writeFileSync(path.join(폴더, '1.tap'), 큰글);
  const 큰 = 싸기();
  assert.equal(큰.status, 0, 큰.stderr);
  assert.equal(일꾼.응답읽기({ stdout: `@@결과 1
${큰.stdout}@@끝
`, stderr: '', status: 0 }, 1).taps[1], 큰글);
});
