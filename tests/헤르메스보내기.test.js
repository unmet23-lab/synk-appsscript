'use strict';
// 헤르메스 보내기 판정(10-22) — 보낸 글을 실패로 쳐서 30분마다 다시 보내지 않게, 종료 코드가 아니라 결과로 본다. 실제 헤르메스는 부르지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 헤르메스 = require('../tools/lib/헤르메스보내기.js');

test('보냈다는 결과면 끊겼거나 0이 아닌 코드로 끝나도 보낸 것 — 까닭은 note로', () => {
  const 끊김 = 헤르메스.결과({ status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT', message: 'spawnSync hermes.exe ETIMEDOUT' }, stdout: '{"success": true, "message_id": "41"}\n', stderr: '' });
  assert.equal(끊김.ok, true);
  assert.match(끊김.note, /ETIMEDOUT/);
  assert.deepEqual(헤르메스.결과({ status: 1, stdout: '{"success":true,"message_id":7}', stderr: '' }), { ok: true, note: '헤르메스가 보냈다고 했지만 종료 1 — 보낸 것으로 친다' });
  assert.deepEqual(헤르메스.결과({ status: 0, stdout: '로그 한 줄\n{"success":true,"message_id":8}', stderr: '' }), { ok: true, note: '' });
  assert.equal(헤르메스.결과({ status: null, error: { code: 'ETIMEDOUT' }, stdout: 'sent\n', stderr: '' }).ok, true, '10-22 첫 정기 실행의 꼴');
});

test('보내지 못했으면 실패 — 헤르메스가 준 까닭을 그대로', () => {
  assert.deepEqual(헤르메스.결과({ status: 1, stdout: '{"success":false,"error":"chat not found"}', stderr: '' }), { ok: false, error: 'chat not found' });
  assert.deepEqual(헤르메스.결과({ status: 2, stdout: '', stderr: 'usage: hermes send ...\n' }), { ok: false, error: 'usage: hermes send ...' });
  assert.equal(헤르메스.결과({ status: null, error: { code: 'ENOENT', message: 'spawnSync hermes.exe ENOENT' }, stdout: '', stderr: '' }).error, 'spawnSync hermes.exe ENOENT');
  assert.equal(헤르메스.결과({ status: 0, stdout: 'not sent: no token', stderr: '' }).ok, false, '「sent」로 시작하지 않는 사람용 글은 보낸 것이 아니다');
});

test('보내기 — --json으로 부르고 3분 한도, 임시 파일은 부르는 동안만 있다', () => {
  let 본 = null;
  const r = 헤르메스.보내기('hermes.exe', 'telegram:1', '비축 알림 본문', {
    spawn: (exe, args, opts) => {
      본 = { exe, args, timeout: opts.timeout, 글: fs.readFileSync(args[args.indexOf('-f') + 1], 'utf8'), 파일: args[args.indexOf('-f') + 1] };
      return { status: 0, stdout: '{"success":true,"message_id":"9"}', stderr: '' };
    },
  });
  assert.deepEqual(r, { ok: true, note: '' });
  assert.deepEqual(본.args.slice(0, 4), ['send', '--json', '-t', 'telegram:1']);
  assert.equal(본.timeout, 180000);
  assert.equal(본.글, '비축 알림 본문');
  assert.equal(fs.existsSync(본.파일), false);
});

test('프로세스 시작 실패만 안전한 재시도 — 시간 초과와 CLI 실패는 전송 여부 미확인', () => {
  for (const code of ['ENOENT', 'EACCES']) {
    assert.equal(헤르메스.결과({ pid: 0, status: null, error: { code, message: code }, stdout: '', stderr: '' }).delivery, 'not-started');
  }
  for (const r of [
    { pid: 20, status: null, error: { code: 'ETIMEDOUT' } },
    { pid: 20, status: 1, stdout: '{"success":false,"error":"response lost"}' },
    { pid: 20, status: null, error: { code: 'ENOENT' } },
    { pid: 0, status: null, error: { code: 'ENOENT' }, stdout: '{"success":false}' },
  ]) assert.equal(헤르메스.결과(r).delivery, undefined);
  assert.equal(헤르메스.보내기(path.join(os.tmpdir(), `synk-missing-hermes-${process.pid}-${Date.now()}.exe`), 'telegram:1', 'fixture').delivery, 'not-started', '실제 spawnSync의 실행 파일 없음도 안전한 실패로 읽는다');
});

test('임시 글 파일을 쓰지 못하면 외부 프로세스를 시작하지 않은 실패로 돌려준다', t => {
  const write = fs.writeFileSync;
  fs.writeFileSync = () => { throw Object.assign(Error('temporary file denied'), { code: 'EACCES' }); };
  t.after(() => { fs.writeFileSync = write; });
  assert.deepEqual(헤르메스.보내기('hermes.exe', 'telegram:1', 'fixture', { spawn: () => assert.fail('파일 생성 실패 뒤에는 실행하지 않는다') }),
    { ok: false, error: 'temporary file denied', delivery: 'not-started' });
});
