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
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
  // ffmpeg 필터 인자 안의 「C:」 콜론을 피하려고 임시 폴더에서 상대 경로로 쓴다.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '정지구간-'));
  const out = 'diff.txt';
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path.resolve(file), '-vf',
    `scale=270:-1,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${out}`,
    '-an', '-f', 'null', '-'], { cwd: dir, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error('ffmpeg 실패: ' + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
    process.exitCode = 1;
    return;
  }
  const lines = fs.readFileSync(path.join(dir, out), 'utf8').split('\n');
  fs.rmSync(dir, { recursive: true, force: true });
  const bins = new Map();
  let t = null;
  for (const line of lines) {
    const m = line.match(/pts_time:([\d.]+)/);
    if (m) t = Number(m[1]);
    const v = line.match(/YAVG=([\d.]+)/);
    if (v && t != null) {
      const b = Math.floor(t * 2) / 2;
      if (!bins.has(b)) bins.set(b, []);
      bins.get(b).push(Number(v[1]));
    }
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
  const report = { file, length, still, ratio: length ? still / length : 0, longest: Math.max(0, ...runs.map((x) => x.end - x.start)), runs: long, pass };
  if (args.includes('--json')) { console.log(JSON.stringify(report, null, 2)); return; }
  console.log(`${path.basename(file)} · ${length.toFixed(1)}초 중 거의 멈춘 시간 ${still.toFixed(1)}초(${Math.round(report.ratio * 100)}%) · 가장 긴 정지 ${report.longest.toFixed(1)}초 · ${pass ? '통과' : '고칠 것 있음'}`);
  for (const x of long) console.log(`  ${x.start.toFixed(1)}~${x.end.toFixed(1)}초 (${(x.end - x.start).toFixed(1)}초)${endCard(x) ? ' · 끝 화면' : ''}`);
  if (!pass) process.exitCode = 3;
}

main();
