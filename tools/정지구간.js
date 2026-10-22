#!/usr/bin/env node
'use strict';
/* 영상 마감 점검: 화면이 거의 안 바뀌는 구간을 찾는다 (2026-10-20). 읽기만 한다.
 *
 * 쇼츠·릴스는 화면이 1.5~2초마다 바뀌어야 시청 지속이 버틴다. 프레임끼리의 밝기 차이(tblend difference →
 * signalstats YAVG)를 0.5초 칸으로 평균 내어, 평균이 기준보다 낮은 칸이 이어지는 구간을 「거의 멈춤」으로 본다.
 * 10-20 synkbrief 음식 사진 편 v3는 42초 중 22.5초(가장 긴 정지 6초), LAB 퀴즈 #4는 36초 중 4.5초였다.
 *
 *   node tools/정지구간.js <영상.mp4> [--기준 0.15] [--json]
 *
 * 기준(마감): 거의 멈춘 시간 합계가 길이의 15% 이하, 1.5초 넘는 정지는 끝 화면 말고 없게.
 * 끝 화면(10-21, 올리기 전 검사): 마지막 12초 안에서 화면 전체가 바뀐 마지막 프레임(차이 18 이상 — 컷·지우개 전환)부터
 * 끝까지를 잰다. v2 §2-4 「끝 화면은 4초 안팎」. 서서히 겹치는 전환은 컷으로 못 잡아 길게 잴 수 있다.
 * require('./정지구간.js').analyze(file)는 같은 셈을 돌려준다(tools/올리기전검사.js가 쓴다).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CUT = 18;
const END_WINDOW = 12;

// 프레임마다 [시각, 앞 프레임과의 밝기 차이 평균]을 읽는다. 실패하면 오류.
function frameDiffs(file) {
  // ffmpeg 필터 인자 안의 「C:」 콜론을 피하려고 임시 폴더에서 상대 경로로 쓴다.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '정지구간-'));
  try {
    const out = 'diff.txt';
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path.resolve(file), '-vf',
      `scale=270:-1,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${out}`,
      '-an', '-f', 'null', '-'], { cwd: dir, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error('ffmpeg 실패: ' + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
    const frames = [];
    let t = null;
    for (const line of fs.readFileSync(path.join(dir, out), 'utf8').split('\n')) {
      const m = line.match(/pts_time:([\d.]+)/);
      if (m) t = Number(m[1]);
      const v = line.match(/YAVG=([\d.]+)/);
      if (v && t != null) frames.push([t, Number(v[1])]);
    }
    return frames;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function analyzeFrames(frames, threshold = 0.15) {
  const bins = new Map();
  for (const [t, v] of frames) {
    const b = Math.floor(t * 2) / 2;
    if (!bins.has(b)) bins.set(b, []);
    bins.get(b).push(v);
  }
  const keys = [...bins.keys()].sort((a, b) => a - b);
  const length = keys.length ? keys[keys.length - 1] + 0.5 : 0;
  const runs = [];
  let run = null;
  let still = 0;
  for (const key of keys) {
    const list = bins.get(key);
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    if (avg < threshold) {
      still += 0.5;
      if (run) run.end = key + 0.5; else run = { start: key, end: key + 0.5 };
    } else if (run) { runs.push(run); run = null; }
  }
  if (run) runs.push(run);
  const long = runs.filter((x) => x.end - x.start > 1.5);
  const endCard = (x) => length - x.end < 0.6;
  const pass = still <= length * 0.15 && long.every(endCard);
  // 끝 화면: 마지막 프레임 시각 기준으로 잰다(0.5초 칸 끝이 아니라).
  const last = frames.length ? frames[frames.length - 1][0] : 0;
  const cut = [...frames].reverse().find(([t, v]) => v >= CUT && t >= last - END_WINDOW);
  const end = cut ? { start: cut[0], length: last - cut[0] + (frames.length > 1 ? last - frames[frames.length - 2][0] : 0) } : null;
  return { length, still, ratio: length ? still / length : 0, longest: Math.max(0, ...runs.map((x) => x.end - x.start)),
    runs: long.map((x) => ({ ...x, endCard: endCard(x) })), pass, end };
}

function analyze(file, { threshold = 0.15 } = {}) {
  return { file, ...analyzeFrames(frameDiffs(file), threshold) };
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--기준');
  if (!file || !fs.existsSync(file)) {
    console.error('사용: node tools/정지구간.js <영상.mp4> [--기준 0.15] [--json]');
    process.exitCode = 2;
    return;
  }
  const k = args.indexOf('--기준');
  const threshold = k > -1 ? Number(args[k + 1]) : 0.15;
  let report;
  try { report = analyze(file, { threshold }); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  if (args.includes('--json')) { console.log(JSON.stringify(report, null, 2)); return; }
  console.log(`${path.basename(file)} · ${report.length.toFixed(1)}초 중 거의 멈춘 시간 ${report.still.toFixed(1)}초(${Math.round(report.ratio * 100)}%) · 가장 긴 정지 ${report.longest.toFixed(1)}초 · ${report.pass ? '통과' : '고칠 것 있음'}`);
  for (const x of report.runs) console.log(`  ${x.start.toFixed(1)}~${x.end.toFixed(1)}초 (${(x.end - x.start).toFixed(1)}초)${x.endCard ? ' · 끝 화면' : ''}`);
  console.log(report.end ? `  끝 화면 ${report.end.length.toFixed(1)}초(${report.end.start.toFixed(1)}초 컷부터)` : `  끝 화면: 마지막 ${END_WINDOW}초 안에 화면 전체가 바뀌는 컷이 없어 재지 못함`);
  if (!report.pass) process.exitCode = 3;
}

if (require.main === module) main();

module.exports = { analyze, analyzeFrames, CUT, END_WINDOW };
