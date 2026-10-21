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
  ['v02', 'price', 3, '요금 세 줄이 「플러스」·「프로」·「클로드」에'],
  ['v03', 'free', 3, ''],
  ['v04', 'mid', 3, ''],
  ['v05', 'bundle', 3, '조용한 구간'],
  ['v06', 'sale', 3, '64박 드롭 착지 뒤'],
  ['v07', 'sum', 3, '80박 드롭 착지 뒤'],
  ['v08', 'end', 3, '끝 질문 위에서 96박 곡 끝맺음'],
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
