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
  ['v02', 'before', 3, '「사용량」이 사용량 카드(12박)가 뜬 바로 뒤에 온다'],
  ['v03', 'benefit', 3, ''],
  ['v04', 'check', 3, '「확인」 끝에 「지금 확인」이 눌린다(23박)'],
  ['v05', 'attention', 6, '「모자란」 첫소리를 34박 쿵 뒤로 둔다(현장 노트: 효과음이 말머리를 묻는다)'],
  ['v06', 'spare', 3, '「여유 있는」에 추천 동그라미(42박)'],
  ['v07', 'reset', 0, '「알려 주고,」에서 이어지는 말이라 바로 잇는다'],
  ['v08', 'week', -6, '줄이 장면보다 길어(3.0초 > 2.9초) 밀기 전환 중에 시작한다'],
  ['v09', 'official', 6, '「공식 프로그램」이 블록 머리가 켜지는 64·65박에 온다'],
  ['v10', 'guide', 3, '「피씨에선」 뒤에 「이 PC의 기존 로그인 쓰기」 동그라미(76박)'],
  ['v11', 'end', -2, '「싱크」 첫소리를 전환 쓱(끝 장면 시작 +2) 뒤, 80박 드롭 앞에 둔다'],
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
