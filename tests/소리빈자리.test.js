'use strict';
// 소리 빈자리(tools/소리빈자리.js) — 네트워크 · ffmpeg 없이 출력 읽기와 판정만 본다. 자리 표는 10-31 게시 판을 잰 값이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, gaps, judge, EDGE, MIN_GAP } = require('../tools/소리빈자리.js');

const 자리 = (...쌍) => 쌍.map(([start, end]) => ({ start, end }));
const 판정 = (runs, duration) => judge(gaps(runs, duration));

test('ffmpeg 출력에서 길이와 무음 자리를 읽고, 끝까지 이어진 무음은 길이로 닫는다', () => {
  const 출력 = [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'video.mp4':",
    '  Duration: 00:00:28.61, start: 0.000000, bitrate: 10132 kb/s',
    '[silencedetect @ 0000020b] silence_start: 5.85',
    '[silencedetect @ 0000020b] silence_end: 6.5 | silence_duration: 0.65',
    '[silencedetect @ 0000020b] silence_start: 27.91',
  ].join('\r\n');
  assert.deepEqual(parse(출력), { duration: 28.61, runs: 자리([5.85, 6.5], [27.91, 28.61]) });
  assert.deepEqual(parse('Duration: 00:01:02.50, start: 0').duration, 62.5);
  assert.equal(parse('길이 없는 출력').duration, null);
});

test('처음 · 끝 0.4초를 떼고 0.25초 넘게 남는 자리만 센다', () => {
  assert.equal(EDGE, 0.4);
  assert.equal(MIN_GAP, 0.25);
  const 남은 = gaps(자리([0, 0.5], [0.2, 0.8], [5, 5.25], [5, 5.3], [19, 20]), 20);
  assert.deepEqual(남은.map((g) => [g.start, g.end]), [[0.4, 0.8], [5, 5.3], [19, 19.6]], '0~0.5초는 0.1초만 남아 빠지고, 꼭 0.25초인 자리는 넘지 않았다');
  assert.ok(Math.abs(남은[1].length - 0.3) < 1e-9);
});

test('10-31 실측 — 배경음이 빈 판은 걸리고, 말 사이 쉼을 둔 판은 통과한다', () => {
  // 화날때 옛 판(배경음 없음)
  const 화날때 = 판정(자리([5.85, 6.5], [7.22, 8.6], [8.67, 9.6], [12.05, 12.6], [12.68, 14.41], [17.19, 17.5], [17.9, 19.55], [22.23, 22.5], [25.07, 27.5], [27.91, 28.61]), 28.61);
  assert.equal(화날때.fix, true);
  assert.ok(Math.abs(화날때.total - 10.2) < 0.02);
  assert.ok(Math.abs(화날때.longest - 2.43) < 0.01);
  // M19 옛 판(18초 배경음 · 27.4초)
  assert.equal(판정(자리([18.26, 19.3], [20.01, 22.2], [22.28, 25.6], [25.96, 27.41]), 27.41).fix, true);
  // 와요 한 낱말(18초 배경음이 끝 화면 앞에서 끊김) — 한 자리만 길면 듣고 판단한다
  const 와요 = 판정(자리([17.97, 19.61]), 20.01);
  assert.deepEqual([와요.fix, 와요.look], [false, true]);
  // 말 사이 쉼: 내 말투로 2.9 · 0.91 / 미안 세 단계 2.27 · 0.64 / 4층 F 0.74 · 0.41
  assert.equal(판정(자리([1.16, 1.92], [7.48, 7.84], [13.86, 14.74], [15.39, 16.3]), 19.9).pass, true);
  assert.equal(판정(자리([1.24, 1.53], [3.94, 4.33], [6.11, 6.4], [8.67, 9.31], [11.24, 11.63], [12.8, 13.07], [18.31, 18.5]), 18.9).pass, true);
  assert.equal(판정(자리([13.8, 14.13], [16.7, 17.51]), 17.51).pass, true);
});

test('판정 — 합계와 최장을 같이 본다', () => {
  const 칸 = (...길이) => { let at = 1; return 길이.map((l) => { const g = { start: at, end: at + l, length: l }; at += l + 1; return g; }); };
  assert.equal(judge(칸(0.9, 0.9, 0.9, 0.9, 0.9)).look, true, '합만 넘음(짧은 쉼이 많음) = 확인할 것');
  assert.equal(judge(칸(0.9, 0.9, 0.9, 0.9, 0.9)).fix, false);
  assert.equal(judge(칸(1.5)).look, true, '최장만 넘음 = 확인할 것');
  assert.equal(judge(칸(1.5, 1.5, 1.5)).fix, true, '둘 다 넘음 = 고칠 것');
  assert.equal(judge(칸(1.5, 1.5, 1.5)).look, false);
  assert.equal(judge(칸(1, 1, 1, 1)).pass, true, '꼭 문턱이면 넘지 않았다');
  assert.equal(judge([]).pass, true);
  assert.equal(judge([]).longest, 0);
});
