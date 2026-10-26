'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { srtToLines, buildPrompt, parseCuts, 시청자 } = require('../tools/낯선이시험.js');

test('srt를 「초s  말」 줄로 바꾸고 빈 블록은 건너뛴다', () => {
  const srt = '1\r\n00:00:00,100 --> 00:00:04,000\r\n제가 나눠 드린 도구가,\r\n디스크를 썼어요.\r\n\r\n2\r\n00:01:04,500 --> 00:01:06,000\r\n둘째 줄\r\n\r\n3\r\n00:01:07,000 --> 00:01:08,000\r\n';
  assert.deepEqual(srtToLines(srt), ['0.1s  제가 나눠 드린 도구가, 디스크를 썼어요.', '64.5s  둘째 줄']);
});

test('질문에 두 파일 경로 · 시청자 · 다섯 물음이 들어간다', () => {
  const prompt = buildPrompt({ brand: 'synkbrief', sheet: 'C:/a/정지컷_2초마다.jpg', speech: 'C:/a/말.txt' });
  assert.match(prompt, /AI 도구를 가끔 쓰는 30대 한국인 직장인/);
  assert.match(prompt, /C:\/a\/정지컷_2초마다\.jpg/);
  assert.match(prompt, /C:\/a\/말\.txt/);
  for (const n of [1, 2, 3, 4, 5]) assert.match(prompt, new RegExp(`^${n}\\. `, 'm'));
  assert.match(prompt, /다른 파일·폴더·인터넷은 보지 마라/);
});

test('브랜드마다 시청자가 있고, 모르는 브랜드는 멈춘다', () => {
  for (const brand of ['lab-en', 'lab-mn', 'lab-cn', 'lab-mm', 'synkbrief', 'yuhobuilds', 'pulse']) assert.ok(시청자[brand]);
  assert.throws(() => buildPrompt({ brand: 'shift', sheet: 'a', speech: 'b' }), /브랜드는/);
});

test('컷마다 찍을 때는 질문이 컷이 시작하는 초라고 말하고, 컷 초는 커지는 순서여야 한다', () => {
  const prompt = buildPrompt({ brand: 'pulse', sheet: 'C:/a/정지컷_컷마다.jpg', speech: 'C:/a/말.txt', cuts: true });
  assert.match(prompt, /컷이 바뀔 때마다 한 장/);
  assert.match(prompt, /시작-끝/);
  assert.doesNotMatch(prompt, /2초마다/);
  assert.deepEqual(parseCuts('0, 3.56,4.52', 60), [0, 3.56, 4.52]);
  assert.throws(() => parseCuts('0,4.52,3.56', 60), /커지는 초/);
  assert.throws(() => parseCuts('0,61', 60), /커지는 초/);
});
