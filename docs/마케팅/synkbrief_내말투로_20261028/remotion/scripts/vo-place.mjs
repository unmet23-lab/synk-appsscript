// 나레이션 자리: 장면이 착지하는 박(src/full/time.ts B)에서 몇 프레임 뒤에 줄을 놓을지 한 곳에서 정한다.
//   node scripts/vo-place.mjs   → src/full/vo-place.json(영상이 읽음) · public/vo/place.json(초)
// 박 격자는 src/lib/beat.ts, 줄 길이는 src/full/vo.ts(scripts/vo-ts.mjs가 만든 표)에서 읽는다. 줄끼리 6프레임보다 붙으면 멈춘다.
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
const B = Object.fromEntries([...read('src/full/time.ts').match(/export const B = \{([\s\S]*?)\}/)[1].matchAll(/(\w+): (\d+)/g)].map((m) => [m[1], Number(m[2])]));
const VO = Object.fromEntries([...read('src/full/vo.ts').matchAll(/^\s+(\w+): \{ dur: ([\d.]+), speech: ([\d.]+)/gm)].map((m) => [m[1], { dur: Number(m[2]), speech: Number(m[3]) }]));

// [줄, 장면, 착지 박에서 몇 프레임 뒤]
// B15 v1: 훅 v01 · 한 줄 v02 · 견줌 v03(빨간 테가 다 찬 뒤) · 정리 v04 · 끝 v05.
const PLAN = [
  ['v01', 'hook', 2],
  ['v02', 'line', 4],
  ['v03', 'cnt', 16],
  ['v04', 'recap', 4],
  ['v07', 'end', 4], // v2: 끝 말에 「댓글로 알려 주세요」(이해 시험 v1)
];

const clips = PLAN.map(([id, k, off]) => {
  const at = beat(B[k]) + off;
  const v = VO[id];
  if (!v) throw Error('vo.ts에 없는 줄: ' + id);
  return { id, at, speechEnd: at + Math.ceil(v.speech * FPS), end: at + Math.ceil(v.dur * FPS) };
});
clips.forEach((c, i) => {
  const next = clips[i + 1];
  if (next && next.at - c.speechEnd < 6) throw Error(`${c.id} → ${next.id} 사이 ${next.at - c.speechEnd}프레임(6프레임보다 붙음)`);
  if (next && c.end > next.at) throw Error(`${c.id} 파일 끝이 ${next.id} 시작을 넘는다`);
});
const last = clips[clips.length - 1];
if (last.speechEnd > beat(B.cut) + 20) throw Error(`끝 줄이 cut박(${beat(B.cut)})을 ${last.speechEnd - beat(B.cut)}프레임 넘는다`);
const out = { A: clips, B: clips };
fs.writeFileSync(path.join(ROOT, 'src/full/vo-place.json'), JSON.stringify(out, null, 1) + '\n');
const sec = (f) => +(f / FPS).toFixed(3);
fs.writeFileSync(path.join(ROOT, 'public/vo/place.json'), JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, cs]) => [k, cs.map((c) => ({ id: c.id, start: sec(c.at), end: sec(c.speechEnd) }))])), null, 1) + '\n');
for (const c of clips) console.log(c.id.padEnd(4), `${sec(c.at).toFixed(2)}~${sec(c.speechEnd).toFixed(2)}초 · 다음 장면까지 여유 ${(() => { const i = clips.indexOf(c); const n = clips[i + 1]; return n ? n.at - c.speechEnd : beat(B.cut) - c.speechEnd; })()}프레임`);
