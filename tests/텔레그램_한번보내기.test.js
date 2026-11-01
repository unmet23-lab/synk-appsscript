'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const telegram = require('../tools/lib/텔레그램_한번보내기.js');
const delivery = { botId: '123', target: 'telegram:456', randomId: '9223372036854775806' };

test('Python stdio에 int64 문자열·고정 대상·본문만 넘기고 비밀값은 넘기지 않는다', () => {
  const result = telegram.send('fixture', { ...delivery, mode: 'check', token: 'local-event-id' }, {
    spawn: (exe, args, options) => {
      assert.match(exe, /python(?:\.exe)?$/);
      assert.deepEqual(args.slice(0, 4), ['-I', '-X', 'utf8', '-B']);
      assert.match(args[4], /telegram-mtproto\.py$/);
      assert.deepEqual(JSON.parse(options.input), { mode: 'send', text: 'fixture', ...delivery });
      assert.equal(options.windowsHide, true);
      return { status: 0, stdout: JSON.stringify({ ok: true, ...delivery, messageId: '19' }) };
    },
  });
  assert.equal(result.messageId, '19');
});

test('확인 결과의 계정·대상·ID가 다르면 성공으로 반환하지 않는다', () => {
  for (const change of [{ botId: 'other' }, { target: 'telegram:999' }, { randomId: '1' }, { messageId: '' }]) {
    assert.throws(() => telegram.send('fixture', delivery, { spawn: () => ({ status: 0, stdout: JSON.stringify({ ok: true, ...delivery, messageId: '19', ...change }) }) }), /확인 결과/);
  }
});

test('worker 오류와 시간 초과는 원본 출력 없이 보고하고 서버 대기 시간은 전달한다', () => {
  assert.throws(() => telegram.send('fixture', delivery, { spawn: () => ({ status: 1, stdout: JSON.stringify({ ok: false, code: 'FLOOD_WAIT', retryAfter: 90 }), stderr: 'PRIVATE_SHOULD_NOT_LEAK' }) }), e => e.code === 'FLOOD_WAIT' && e.retryAfter === 90 && !e.message.includes('PRIVATE'));
  assert.throws(() => telegram.send('fixture', delivery, { spawn: () => ({ status: null, error: Error('PRIVATE_SHOULD_NOT_LEAK'), stdout: '' }) }), e => e.code === 'MTPROTO_WORKER_UNAVAILABLE' && !e.message.includes('PRIVATE'));
});

test('기존 봇 토큰은 로컬 파일에서 읽되 외부로는 계정 ID만 제공한다', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telegram-bot-fixture-'));
  const before = process.env.SYNK_HERMES_HOME;
  process.env.SYNK_HERMES_HOME = dir;
  t.after(() => { if (before === undefined) delete process.env.SYNK_HERMES_HOME; else process.env.SYNK_HERMES_HOME = before; fs.rmSync(dir, { recursive: true, force: true }); });
  fs.writeFileSync(path.join(dir, '.env'), 'TELEGRAM_BOT_TOKEN="123:' + 'x'.repeat(30) + '"\n');
  assert.deepEqual(telegram.identity('telegram:456'), { botId: '123', target: 'telegram:456' });
  assert.throws(() => telegram.identity('telegram:@other'), /기존 Telegram/);
});

test('Python 송신기 모의 SDK 시험 — raw ID·수신 끄기·계정 확인·영수증·중복 처리 중 응답', () => {
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const result = spawnSync(python, [path.join(__dirname, 'telegram-mtproto-fixture.py')], { encoding: 'utf8', windowsHide: true, timeout: 15000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /Ran 5 tests/);
});
