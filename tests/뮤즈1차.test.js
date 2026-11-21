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
  const permissionFile = path.join(cache, 'consent.json');
  let calls = 0;
  const run = (_, args, options) => {
    calls++;
    assert.equal(args[args.indexOf('--model') + 1], 'muse-spark-1.3');
    assert.equal(Object.keys(options.env).some(key => key.toUpperCase() === 'META_API_KEY'), false);
    const prompt = fs.readFileSync(args.at(-1), 'utf8');
    assert.ok(prompt.includes('[메일]'));
    assert.ok(!prompt.includes('secret-suffix-fixture'));
    assert.ok(prompt.includes('MAX_OUTPUT_TOKENS=2048'));
    assert.ok(!prompt.includes('02-0000-0000'));
    assert.ok(prompt.includes('02 [전화]'));
    for (const value of sensitive) assert.ok(!prompt.includes(value));
    assert.ok(!prompt.includes('example.test'));
    assert.equal(fs.readFileSync(args[args.indexOf('--image') + 1], 'utf8'), 'image fixture');
    return {status: 0, stdout: '숫자 불일치', stderr: ''};
  };
  const sensitive = ['AKIA' + 'A'.repeat(16), 'AIza' + 'b'.repeat(34) + '-', 'xoxb-' + '1234',
    'eyJ' + 'abc.ewogabc.sig', 'demo-password-value', '02' + '12345678', '+82-2-' + '1234-5678', '(02) 0000-0000', 'demoTokenSuffix'];
  const input = ['3일 / 30일. 02-0000-0000 sample' + '@example.test', ...sensitive.slice(0, 4),
    'TEST_SECRET_KEY=' + sensitive[4], 'SECRET_KEY_BASE=secret-suffix-fixture', 'MAX_OUTPUT_TOKENS=2048', '02 010-0000-1234', ...sensitive.slice(5, 8), 'Authorization: Bearer 02-0000-0000-' + sensitive[8]].join('\n');
  assert.equal(review('화면', input, [image], {cache, run, permissionFile}), null);
  assert.equal(calls, 0);
  fs.writeFileSync(permissionFile, JSON.stringify({permission:'spark-1.3:first-review:text-and-images'}));
  const report = review('화면', input, [image], {cache, run, permissionFile});
  assert.ok(report);
  assert.equal(fs.readFileSync(report, 'utf8').trim(), '숫자 불일치');
  assert.equal(review('화면', input, [image], {cache, run, permissionFile}), report);
  assert.equal(calls, 1);
  assert.equal(review('코드', '+OAUTH_SECRET="first\n+second', [], {cache, run, permissionFile}), null);
  assert.equal(calls, 1);
  assert.equal(review('코드', '다른 자료', [], {cache, permissionFile, run: () => ({status: 1, stderr: 'timeout'})}), null);
  assert.equal(fs.readdirSync(cache).filter(f => f.endsWith('.txt')).length, 1);
});
