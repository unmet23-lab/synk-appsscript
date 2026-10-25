'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { srtToLines, buildPrompt, 시청자 } = require('../tools/낯선이시험.js');

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
  for (const brand of ['lab-en', 'lab-mn', 'lab-cn', 'lab-mm', 'synkbrief', 'yuhobuilds']) assert.ok(시청자[brand]);
  assert.throws(() => buildPrompt({ brand: 'shift', sheet: 'a', speech: 'b' }), /브랜드는/);
});
