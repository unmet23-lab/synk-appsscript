#!/usr/bin/env node
'use strict';
/* 한 구성 구간 — 같은 화면 구성이 몇 초 이어지는지 잰다(2026-10-28). 읽기만 한다.
 *
 * 정지 구간(tools/정지구간.js)은 앞 프레임과의 밝기 차이로 「거의 멈춤」을 잰다. 그래서 같은 카드 위에서 글 강조만 옮겨 가거나
 * 테(테두리) · 밝기만 바뀌는 구간은 「움직임」으로 쳐서 통과했다 — LAB E8 「밥 한번 먹어요」 7.6~18.6초(45%) 흑백 멈춘 글 카드는
 * 정지 0%로 나왔고, yuhobuilds Y19 0~9초 한 구성(테 · 밝기만 바뀜)도 그랬다(10-28 점검). 여기서는 장면 모양을 견준다:
 * 0.25초마다 작은 회색 그림(72×128, 가장자리 8%를 잘라 테를 뺀다)을 밝기 · 대비를 맞춘 뒤(평균 0 · 표준편차 1) 구간 첫 장면과의
 * 상관을 본다. 상관이 기준(0.8) 이상이면 같은 구성이다. 거의 한 색인 화면(어두운 빈 화면 등)끼리는 밝기와 상관없이 같은 구성이다.
 * 구성이 바뀌는 컷 · 큰 움직임(인물이 움직임, 다른 그림)은 상관이 떨어져 새 구간이 된다.
 *
 *   node tools/한구성.js <영상.mp4> [--상한 4] [--json]
 *
 * 기준(10-28 유호님 「반영해」): 끝 화면 말고 한 구성이 4초를 넘지 않는다. 끝 화면(마지막 구간)은 6초까지 둔다(v2 §2-4 「4초 안팎」).
 * require('./한구성.js').analyze(file)는 같은 셈을 돌려준다(tools/올리기전검사.js가 쓴다).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const W = 72, H = 128, STEP = 0.25;
const SAME = 0.8; // 구간 첫 장면과 이 상관 이상이면 같은 구성
const FLAT = 6; // 표준편차(0~255)가 이보다 작으면 거의 한 색인 화면
const LIMIT = 4;
const END_LIMIT = 6;
const MARGIN = 0.08;

// 0.25초마다 작은 회색 프레임 → [Float64Array(가운데 칸)] · 실패하면 오류
function readFrames(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.resolve(file), '-vf', `fps=${1 / STEP},scale=${W}:${H},format=gray`,
    '-f', 'rawvideo', '-'], { windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('ffmpeg 실패: ' + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
  const buf = r.stdout;
  const x0 = Math.round(W * MARGIN), x1 = W - x0, y0 = Math.round(H * MARGIN), y1 = H - y0;
  const frames = [];
  for (let off = 0; off + W * H <= buf.length; off += W * H) {
    const v = new Float64Array((x1 - x0) * (y1 - y0));
    let k = 0;
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) v[k++] = buf[off + y * W + x];
    frames.push(v);
  }
  return frames;
}

// 밝기 · 대비를 맞춘 장면 → { z, flat }
function norm(v) {
  let m = 0;
  for (const a of v) m += a;
  m /= v.length;
  let s = 0;
  for (const a of v) s += (a - m) ** 2;
  s = Math.sqrt(s / v.length);
  const z = new Float64Array(v.length);
  if (s >= FLAT) for (let i = 0; i < v.length; i += 1) z[i] = (v[i] - m) / s;
  return { z, flat: s < FLAT };
}

function same(a, b) {
  if (a.flat || b.flat) return a.flat && b.flat;
  let c = 0;
  for (let i = 0; i < a.z.length; i += 1) c += a.z[i] * b.z[i];
  return c / a.z.length >= SAME;
}

// 장면들 → 구간 [{start, end, length}] (초)
function segment(normed, step = STEP) {
  const out = [];
  let start = 0;
  for (let i = 1; i <= normed.length; i += 1) {
    if (i < normed.length && same(normed[start], normed[i])) continue;
    out.push({ start: start * step, end: i * step, length: (i - start) * step });
    start = i;
  }
  return out;
}

// 끝 화면(마지막 구간)은 END_LIMIT까지, 그 밖은 limit까지 — 넘는 구간이 「길다」. 0.25초 칸으로 재니 꼭 4초인 구성이 앞뒤
// 전환 칸을 물어 4.25초로 잡힌다(관용구 퀴즈 #5 · #6 예문 칸) — 한 칸은 봐준다.
function judge(segments, { limit = LIMIT, endLimit = END_LIMIT } = {}) {
  const long = segments.filter((s, i) => s.length > (i === segments.length - 1 ? endLimit : limit) + STEP + 1e-9)
    .map((s) => ({ ...s, endCard: s === segments[segments.length - 1] }));
  return { segments, long, longest: Math.max(0, ...segments.map((s) => s.length)), pass: !long.length };
}

function analyze(file, opts = {}) {
  const normed = readFrames(file).map(norm);
  return { file, ...judge(segment(normed), opts) };
}

function main() {
  const args = process.argv.slice(2);
  const k = args.indexOf('--상한');
  const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--상한');
  if (!file || !fs.existsSync(file)) {
    console.error('사용: node tools/한구성.js <영상.mp4> [--상한 4] [--json]');
    process.exitCode = 2;
    return;
  }
  let report;
  try { report = analyze(file, k > -1 ? { limit: Number(args[k + 1]) } : {}); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  if (args.includes('--json')) { console.log(JSON.stringify(report, null, 2)); return; }
  console.log(`${path.basename(file)} · 구성 ${report.segments.length}개 · 가장 긴 구성 ${report.longest.toFixed(2)}초 · ${report.pass ? '통과' : '고칠 것 있음'}`);
  for (const s of report.long) console.log(`  ${s.start.toFixed(2)}~${s.end.toFixed(2)}초 (${s.length.toFixed(2)}초)${s.endCard ? ' · 끝 화면' : ''}`);
  if (!report.pass) process.exitCode = 3;
}

if (require.main === module) main();

module.exports = { analyze, segment, judge, norm, same, LIMIT, END_LIMIT, STEP };
