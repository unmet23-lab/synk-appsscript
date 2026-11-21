'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { review } = require('../tools/lib/뮤즈1차.js');

test('뮤즈는 지정 모델로 가린 글과 그림을 보내고 같은 입력에서는 답을 재사용한다', t => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'muse-cache-'));
  t.after(() => fs.rmSync(cache, {recursive: true, force: true}));
  const image = path.join(cache, '캡처.png');
  fs.writeFileSync(image, 'image fixture');
  let calls = 0;
  const run = (_, args, options) => {
    calls++;
    assert.equal(args[args.indexOf('--model') + 1], 'muse-spark-1.3');
    assert.equal(Object.keys(options.env).some(key => key.toUpperCase() === 'META_API_KEY'), false);
    const prompt = fs.readFileSync(args.at(-1), 'utf8');
    assert.ok(prompt.includes('[메일]'));
    assert.ok(!prompt.includes('example.test'));
    assert.equal(fs.readFileSync(args[args.indexOf('--image') + 1], 'utf8'), 'image fixture');
    return {status: 0, stdout: '숫자 불일치', stderr: ''};
  };
  const input = '3일 / 30일. sample' + '@example.test';
  const report = review('화면', input, [image], {cache, run});
  assert.ok(report);
  assert.equal(fs.readFileSync(report, 'utf8').trim(), '숫자 불일치');
  assert.equal(review('화면', input, [image], {cache, run}), report);
  assert.equal(calls, 1);
  assert.equal(review('코드', '다른 자료', [], {cache, run: () => ({status: 1, stderr: 'timeout'})}), null);
  assert.equal(fs.readdirSync(cache).filter(f => f.endsWith('.txt')).length, 1);
});
