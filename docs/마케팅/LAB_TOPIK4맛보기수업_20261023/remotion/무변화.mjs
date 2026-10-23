// 본편 정지 검사(Fable 10-23 「의도한 멈춤 말고 4초 넘는 무변화 구간 없음」): 판(수업 칠판) 안만 잰다 — 자막 띠·위 띠는 뺀다.
// node 무변화.mjs <렌더.mp4> [--scale 0.5] [--시작 <본편 프레임>] [--길이 4] [--json]
//   렌더는 `npx remotion render src/index.ts lesson out/check/full-half.mp4 --scale=0.5 --muted --props='{"shot":"shots/world-homework.png"}'`.
//   --시작 = 부분 렌더(--frames=a-b)의 첫 프레임 a. 종료코드 0 = 걸린 곳 없음, 2 = ✗ 있음.
// 셈: 0.5초 앞 프레임과 견준다. 화소마다 앞 프레임의 ±1px 이웃 가운데 가장 가까운 값과의 차이(느린 당기기의 1px 안 어긋남은 변화가 아님)에서
//   압축 잡음 몫(바닥 16)을 빼고, 8×8 칸 평균이 기준(18) 이상인 칸이 하나라도 있으면 「바뀜」. 기준값은 원본의 절반 해상도에서 맞췄다.
// 못 보는 것: 글자 몇 개 색만 바뀜·옅은 점선처럼 작고 흐린 변화는 놓친다(10-23 09 「다」 색, 빈 칸 다섯) — ✗·○ 가까운 곳은 그 초를 뽑아 눈으로 본다.
// 의도한 멈춤: timeline.js의 pause(01·06)와 장면 꼬리(03 「자료에 있는 것만」, 11 끝 화면)는 길이에서 빼고 본다.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildTimeline, SCENE_SPECS } from './src/lesson/timeline.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error('쓰는 법: node 무변화.mjs <렌더.mp4> [--scale 0.5] [--시작 프레임] [--길이 4] [--json]');
  process.exit(1);
}
const opt = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const SCALE = opt('--scale', 0.5);
const T = opt('--기준', 18);
const FLOOR = opt('--바닥', 16);
const LONG = opt('--길이', 4);
const OFF = opt('--시작', 0);
const FPS_S = 10;
const LAG = 5; // 0.5초

const vo = JSON.parse(fs.readFileSync(path.join(HERE, '..', '자막', '대사.json'), 'utf8'));
const voGen = JSON.parse(fs.readFileSync(path.join(HERE, 'src', 'lesson', 'vo.generated.json'), 'utf8'));
const TL = buildTimeline(vo.lines, voGen, 30);

// 판 자리(1920 기준 x150 y92 w1620 h756)에서 둥근 모서리를 피해 안쪽으로
const s = (v) => Math.round(v * SCALE);
const even = (v) => v - (v % 2);
const cx = s(156), cy = s(98), cw = even(s(1608)), ch = even(s(744));
const DOWN = opt('--줄임', SCALE >= 1 ? 2 : 1);
const W = even(Math.round(cw / DOWN)), H = even(Math.round(ch / DOWN));
const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-i', path.resolve(file), '-vf', `fps=${FPS_S},crop=${cw}:${ch}:${cx}:${cy},scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 2 * 1024 * 1024 * 1024 });
if (r.status !== 0) throw new Error(String(r.stderr));
const buf = r.stdout;
const N = Math.floor(buf.length / (W * H));
const frame = (i) => buf.subarray(i * W * H, (i + 1) * W * H);

const B = 8;
const bw = Math.floor(W / B), bh = Math.floor(H / B);
const changed = new Array(N).fill(true);
const where = new Array(N).fill(null);
for (let i = LAG; i < N; i++) {
  const a = frame(i), p = frame(i - LAG);
  let best = 0, bx = -1, by = -1;
  for (let yb = 0; yb < bh; yb++) {
    for (let xb = 0; xb < bw; xb++) {
      let sum = 0;
      for (let y = yb * B; y < yb * B + B; y++) {
        for (let x = xb * B; x < xb * B + B; x++) {
          const v = a[y * W + x];
          let m = 255;
          for (let dy = -1; dy <= 1 && m > 0; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= W) continue;
              const d = Math.abs(v - p[yy * W + xx]);
              if (d < m) m = d;
            }
          }
          sum += m > FLOOR ? m - FLOOR : 0;
        }
      }
      const mean = sum / (B * B);
      if (mean > best) { best = mean; bx = xb; by = yb; }
    }
  }
  changed[i] = best >= T;
  where[i] = [+best.toFixed(1), Math.round(((bx + 0.5) * B * DOWN) / SCALE + 156), Math.round(((by + 0.5) * B * DOWN) / SCALE + 98)];
}

const sceneAt = (f) => Object.keys(TL.scenes).find((k) => f >= TL.scenes[k].from && f < TL.scenes[k].to) ?? '끝';
const linesIn = (f0, f1) => Object.entries(TL.lineTime).filter(([, v]) => v.to > f0 && v.from < f1).map(([k]) => k);
const holds = SCENE_SPECS.flatMap((sp) => Object.entries(sp.pause ?? {}).map(([id, sec]) => ({ id: `${id} 멈춤`, from: TL.lineTime[id].to, to: TL.lineTime[id].to + sec * 30 })));
for (const id of ['03', '11']) {
  const sp = SCENE_SPECS.find((x) => x.id === id);
  holds.push({ id: `${id} 꼬리`, from: TL.scenes[id].to - sp.tail * 30, to: TL.scenes[id].to });
}

const runs = [];
let st = null;
for (let i = LAG; i <= N; i++) {
  const still = i < N && !changed[i];
  if (still && st == null) st = i;
  if (!still && st != null) {
    runs.push({ from: (st - LAG) / FPS_S, to: i / FPS_S, sec: (i - st + LAG) / FPS_S }); // 비교 간격만큼 앞에서부터 멈춰 있었다
    st = null;
  }
}
console.log(`길이 ${(N / FPS_S).toFixed(1)}초 · ✗ 의도한 멈춤을 빼고도 ${LONG}초 넘음 · ○ 멈춤을 빼면 ${LONG}초 안 · · ${LONG - 1}초 넘음(판 ${W}×${H}, 기준 ${T})`);
let bad = 0;
for (const x of runs.filter((x) => x.sec > LONG - 1)) {
  const f0 = x.from * 30 + OFF, f1 = x.to * 30 + OFF;
  const over = holds.filter((h) => h.to > f0 && h.from < f1).map((h) => ({ id: h.id, sec: (Math.min(h.to, f1) - Math.max(h.from, f0)) / 30 }));
  const held = over.reduce((t, h) => t + h.sec, 0);
  const mark = x.sec - held > LONG ? '✗' : x.sec > LONG ? '○' : '·';
  if (mark === '✗') bad++;
  console.log(`${mark} ${(f0 / 30).toFixed(1)}–${(f1 / 30).toFixed(1)}초 (${x.sec.toFixed(1)}초) 장면 ${sceneAt(f0)} · 줄 ${linesIn(f0, f1).join(',') || '없음'}${over.length ? ' · ' + over.map((h) => `${h.id} ${h.sec.toFixed(1)}초`).join(', ') : ''}`);
}
if (args.includes('--json')) fs.writeFileSync(path.join(path.dirname(path.resolve(file)), 'change.json'), JSON.stringify({ runs, where }));
console.log(bad ? `✗ ${bad}곳` : '걸린 곳 없음');
process.exit(bad ? 2 : 0);
