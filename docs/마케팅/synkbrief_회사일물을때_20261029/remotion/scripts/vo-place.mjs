// 나레이션 자리: 장면이 착지하는 박(src/time.ts B)에서 몇 프레임 뒤에 줄을 놓을지 한 곳에서 정한다.
//   node scripts/vo-place.mjs   → src/vo-place.json(영상이 읽음) · public/vo/place.json(초)
// 박 격자는 src/lib/beat.ts, 줄 길이는 src/vo.ts(scripts/vo-ts.mjs). 줄끼리 6프레임보다 붙으면 멈춘다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const num = (src, name) => Number(new RegExp(`${name} = ([\\d.]+)`).exec(src)[1]);
const beatTs = read('src/lib/beat.ts');
const FPS = num(beatTs, 'FPS');
const BPM = num(beatTs, 'BPM');
const FIRST = num(beatTs, 'FIRST_BEAT_SEC');
const beat = (k) => Math.round((FIRST + k * (60 / BPM)) * FPS);
const B = Object.fromEntries([...read('src/time.ts').match(/export const B = \{([\s\S]*?)\}/)[1].matchAll(/(\w+): (\d+)/g)].map((m) => [m[1], Number(m[2])]));
const VO = Object.fromEntries([...read('src/vo.ts').matchAll(/^\s+(\w+): \{ dur: ([\d.]+), speech: ([\d.]+)/gm)].map((m) => [m[1], { dur: Number(m[2]), speech: Number(m[3]) }]));

// [줄, 장면, 착지 박에서 몇 프레임 뒤]
const PLAN = [
  ['v01', 'hook', 2],
  ['v02', 'myth', 3],
  ['v03', 'q1', 3],
  ['v04', 'q2', 3],
  ['v05', 'q3', 3],
  ['v06', 'extra', 3],
  ['v07', 'sum', 3],
  ['v08', 'end', 3],
];

const clips = PLAN.map(([id, k, off]) => {
  const at = k === 'hook' ? off : beat(B[k]) + off; // 훅은 곡 첫 박(0.55초)보다 앞, 0프레임부터 말한다
  const v = VO[id];
  if (!v) throw Error('vo.ts에 없는 줄: ' + id);
  return { id, at, speechEnd: at + Math.ceil(v.speech * FPS), end: at + Math.ceil(v.dur * FPS) };
});
clips.forEach((c, i) => {
  const next = clips[i + 1];
  if (next && next.at - c.speechEnd < 6) throw Error(`${c.id} → ${next.id} 사이 ${next.at - c.speechEnd}프레임(6프레임보다 붙음)`);
  if (next && c.end > next.at) throw Error(`${c.id} 파일 끝이 ${next.id} 시작을 넘는다`);
});
fs.writeFileSync(path.join(ROOT, 'src/vo-place.json'), JSON.stringify(clips, null, 1) + '\n');
const sec = (f) => +(f / FPS).toFixed(3);
fs.writeFileSync(path.join(ROOT, 'public/vo/place.json'), JSON.stringify(clips.map((c) => ({ id: c.id, start: sec(c.at), end: sec(c.speechEnd) })), null, 1) + '\n');
for (const c of clips) console.log(c.id.padEnd(4), `${sec(c.at).toFixed(2)}~${sec(c.speechEnd).toFixed(2)}초`);
