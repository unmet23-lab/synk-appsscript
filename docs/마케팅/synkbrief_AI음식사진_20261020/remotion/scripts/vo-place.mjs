// 나레이션 자리: 장면이 착지하는 박(src/full/time.ts B)에서 몇 프레임 뒤에 줄을 놓을지 한 곳에서 정한다.
//   node scripts/vo-place.mjs   → src/full/vo-place.json(영상이 읽음) · public/vo/place.json(초, 소리/받아쓰기.py --믹스가 읽음)
// 박 격자는 src/lib/beat.ts, 줄 길이는 src/full/vo.ts(소리/vo표.py가 만든 표)에서 읽는다. 줄끼리 6프레임보다 붙으면 멈춘다.
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

// [줄(hook은 변형마다 a01·b01), 장면, 착지 박에서 몇 프레임 뒤, 왜]
const PLAN = [
  ['hook', 'hook', 2, '훅 제목이 첫 프레임부터 보인다(0박 = 2프레임)'],
  ['v02', 'fact', 3, ''],
  ['v03', 'guest', 3, '「손님은」 밑줄(18박) 앞에 말머리'],
  ['v04', 'turn', 2, '6박 장면이라 바로'],
  ['v05', 'prompt', 3, '「음식은 그대로」 밑칠(32박)에 그 말'],
  ['v06', 'after', 3, ''],
  ['v07', 'check', 3, '양·재료·색 줄이 낱말에 맞춰 뜬다(scenes.tsx checkT)'],
  ['v08', 'fix', 2, '4.3초 줄이라 착지 바로 뒤'],
  ['v09', 'end', 2, '끝 장면 74박 착지 뒤, 마지막 2초 멈춤 전에 끝난다'],
];

const place = (hookId) => {
  const clips = PLAN.map(([id, k, off]) => {
    const line = id === 'hook' ? hookId : id;
    const at = beat(B[k]) + off;
    const v = VO[line];
    if (!v) throw Error('vo.ts에 없는 줄: ' + line);
    return { id: line, at, speechEnd: at + Math.ceil(v.speech * FPS), end: at + Math.ceil(v.dur * FPS) };
  });
  clips.forEach((c, i) => {
    const next = clips[i + 1];
    if (next && next.at - c.speechEnd < 6) throw Error(`${c.id} → ${next.id} 사이 ${next.at - c.speechEnd}프레임(6프레임보다 붙음)`);
    if (next && c.end > next.at) throw Error(`${c.id} 파일 끝이 ${next.id} 시작을 넘는다`);
  });
  return clips;
};

const out = { A: place('a01'), B: place('b01') };
fs.writeFileSync(path.join(ROOT, 'src/full/vo-place.json'), JSON.stringify(out, null, 1) + '\n');
const sec = (f) => +(f / FPS).toFixed(3);
fs.writeFileSync(path.join(ROOT, 'public/vo/place.json'), JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, cs]) => [k, cs.map((c) => ({ id: c.id, start: sec(c.at), end: sec(c.speechEnd) }))])), null, 1) + '\n');
for (const c of out.A) console.log(c.id.padEnd(4), `${sec(c.at).toFixed(2)}~${sec(c.speechEnd).toFixed(2)}초`);
