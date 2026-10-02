'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { 초읽기, 검증, 찾기 } = require('../bots/오버레이/현재곡');
const list = 검증({ duration: 30.25, tracks: [{ start: 0, title: '첫 곡' }, { start: 10.125, title: '둘째 곡' }] });
test('실제 출력 시각, 소수점 경계와 반복 첫 곡', () => {
  assert.equal(초읽기('?'), null);
  assert.equal(초읽기('26:01:02.125'), 93662.125);
  assert.equal(찾기(list, 10.124).title, '첫 곡');
  assert.equal(찾기(list, 10.125).title, '둘째 곡');
  assert.equal(찾기(list, 30.25).title, '첫 곡');
  assert.equal(찾기(list, 60.5 + 10.125).cycle, 2);
  assert.equal(찾기(list, 60.5 + 10.125).title, '둘째 곡');
});
test('불완전한 시간표는 표시 전에 거절', () => {
  assert.throws(() => 검증({ duration: 10, tracks: [{ start: 1, title: '곡' }] }));
  assert.throws(() => 검증({ duration: 10, tracks: [{ start: 0, title: '' }] }));
  assert.throws(() => 검증({ duration: 10, tracks: [{ start: 0, title: '곡' }, { start: 0, title: '중복' }] }));
  for (const duration of [Infinity, '30', NaN]) assert.throws(() => 검증({ duration, tracks: [{ start: 0, title: '곡' }] }));
  assert.throws(() => 검증(null), /곡 시간표/);
  assert.throws(() => 검증({ duration: 10, tracks: [null] }), /곡 시간표/);
});

test('불가능한 출력 시각은 현재 곡을 바꾸지 않는다', () => {
  for (const time of ['00:60:00', '00:00:60', '00:00:99.5', '9'.repeat(400) + ':00:00']) {
    assert.equal(초읽기(time), null);
  }
});

test('브라우저 실행 실패는 성공으로 기억하지 않고 재시도한다', async () => {
  const playlist = 'file track.flac\n';
  const manifest = { ...list, playlistSha256: crypto.createHash('sha256').update(playlist).digest('hex') };
  let tick, attempts = 0;
  const logs = [], context = vm.createContext({ module: { exports: {} },
    require: name => name === 'node:fs' ? {
      existsSync: () => true,
      readFileSync: file => file.endsWith('now-playing.json') ? JSON.stringify(manifest) : playlist,
    } : require(name),
    setInterval: callback => { tick = callback; return { unref() {} }; },
  });
  vm.runInContext(fs.readFileSync(require.resolve('../bots/오버레이/현재곡.js'), 'utf8'), context);
  const progress = { out_time: '00:00:00.000' };
  context.module.exports.시작({ playlist: '/fixture/playlist.txt', progress,
    send: async () => ++attempts === 1 ? { exceptionDetails: { text: 'Uncaught' } } : { result: { type: 'undefined' } },
    log: line => logs.push(line) });
  await tick();
  assert.equal(attempts, 1);
  assert.match(logs[0], /재시도/);
  await tick();
  assert.equal(attempts, 2);
  await tick();
  assert.equal(attempts, 2);
  progress.out_time = '00:00:10.125';
  await tick();
  assert.equal(attempts, 3);
});
