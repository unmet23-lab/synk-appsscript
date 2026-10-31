#!/usr/bin/env node
'use strict';
/* 소리 빈자리 — 말 사이가 완전히 빈 자리를 잰다(2026-10-31). 읽기만 한다.
 *
 * 음량(LUFS)은 게이트 밖의 빈자리를 세지 않고, 클리핑 · 딸깍은 소리가 있는 곳만 본다. 그래서 18초 배경음을 더 긴 편에 그대로 깐
 * M19 · E17이 말 사이 완전 무음인 채 올리기 전 검사를 넘겨 예약까지 갔다(10-31 게시 검수, 현장노트 영상 「18초 배경음」).
 * 여기서는 ffmpeg silencedetect로 잰 자리에서 처음 · 끝 0.4초를 떼고, −62 dB 아래가 0.25초 넘게 이어지는 자리만 센다.
 *
 *   node tools/소리빈자리.js <영상.mp4> [--json]
 *
 * 기준(합계와 가장 긴 자리를 같이 본다): 둘 다 넘으면 고칠 것, 하나만 넘으면 확인할 것. 10-28 이후 게시 판 실측(합 · 최장, 초):
 *   고칠 것  화날때 옛 판 10.2 · 2.4(배경음 없음) / M19 옛 판 7.6 · 3.3(18초 배경음)
 *   확인할 것  와요 한 낱말 1.6 · 1.6(18초 배경음이 끝 화면 앞에서 끊김)
 *   통과  내 말투로 2.9 · 0.9 / 미안 세 단계 2.3 · 0.6 / 4층 F 0.7 · 0.4 / 잠도 와요 0.4 · 0.4(말 사이 짧은 쉼) · 나머지 0
 * require('./소리빈자리.js').analyze(file)는 같은 셈을 돌려준다(tools/올리기전검사.js가 쓴다).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const NOISE_DB = -62;
const MIN_GAP = 0.25; // 이보다 짧은 쉼은 세지 않는다
const EDGE = 0.4; // 처음 · 끝에서 뗄 초
const TOTAL_LIMIT = 4;
const LONGEST_LIMIT = 1;

// ffmpeg 출력 → { duration, runs: [{start, end}] }. 파일 끝까지 이어진 무음은 silence_end가 없을 수 있어 길이로 닫는다.
function parse(stderr) {
  const text = String(stderr);
  const d = text.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const duration = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : null;
  const runs = [];
  let start = null;
  for (const line of text.split(/\r?\n/)) {
    const a = line.match(/silence_start: (-?[\d.]+)/);
    if (a) start = Number(a[1]);
    const b = line.match(/silence_end: (-?[\d.]+)/);
    if (b && start !== null) { runs.push({ start, end: Number(b[1]) }); start = null; }
  }
  if (start !== null && duration !== null) runs.push({ start, end: duration });
  return { duration, runs };
}

// 처음 · 끝을 떼고 min 넘게 남는 자리 → [{start, end, length}]
function gaps(runs, duration, { edge = EDGE, min = MIN_GAP } = {}) {
  return runs.map((r) => {
    const start = Math.max(r.start, edge), end = Math.min(r.end, duration - edge);
    return { start, end, length: end - start };
  }).filter((g) => g.length > min);
}

function judge(list, { totalLimit = TOTAL_LIMIT, longestLimit = LONGEST_LIMIT } = {}) {
  const total = list.reduce((n, g) => n + g.length, 0);
  const longest = Math.max(0, ...list.map((g) => g.length));
  const overTotal = total > totalLimit, overLongest = longest > longestLimit;
  return { gaps: list, total, longest, fix: overTotal && overLongest, look: overTotal !== overLongest, pass: !overTotal && !overLongest };
}

function analyze(file, opts = {}) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-nostdin', '-i', path.resolve(file), '-map', '0:a:0', '-vn', '-af', `silencedetect=noise=${NOISE_DB}dB:d=${MIN_GAP}`, '-f', 'null', '-'],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('ffmpeg 실패: ' + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
  const { duration, runs } = parse(r.stderr);
  if (duration === null) throw new Error('영상 길이를 읽지 못했다');
  return { file, duration, ...judge(gaps(runs, duration), opts) };
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file || !fs.existsSync(file)) {
    console.error('사용: node tools/소리빈자리.js <영상.mp4> [--json]');
    process.exitCode = 2;
    return;
  }
  let report;
  try { report = analyze(file); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${path.basename(file)} · 빈자리 ${report.gaps.length}곳 · 합 ${report.total.toFixed(2)}초 · 최장 ${report.longest.toFixed(2)}초 · ${report.fix ? '고칠 것 있음' : report.look ? '확인할 것' : '통과'}`);
    for (const g of report.gaps) console.log(`  ${g.start.toFixed(2)}~${g.end.toFixed(2)}초 (${g.length.toFixed(2)}초)`);
  }
  if (report.fix) process.exitCode = 3;
}

if (require.main === module) main();

module.exports = { analyze, parse, gaps, judge, NOISE_DB, MIN_GAP, EDGE, TOTAL_LIMIT, LONGEST_LIMIT };
