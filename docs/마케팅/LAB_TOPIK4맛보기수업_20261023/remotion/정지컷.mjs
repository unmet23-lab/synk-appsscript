// 이미지 콘티 정지컷: node 정지컷.mjs [--밖 out/stills] [--만 01a,06a]
// 번들을 한 번 만들고 장면마다 그 순간의 한 장을 PNG로 뽑는다. 순간은 time.ts와 같은 셈(대사 음절 수 어림)으로 고른다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { buildTimeline } from './src/lesson/timeline.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = path.resolve(HERE, opt('--밖', 'out/stills'));
const ONLY = opt('--만', '')?.split(',').filter(Boolean);

// 영상과 같은 셈(src/lesson/timeline.js) — 구운 줄은 vo.generated.json의 실제 길이.
const vo = JSON.parse(fs.readFileSync(path.join(HERE, '..', '자막', '대사.json'), 'utf8'));
const voGen = JSON.parse(fs.readFileSync(path.join(HERE, 'src', 'lesson', 'vo.generated.json'), 'utf8'));
const FPS = 30;
const TL = buildTimeline(vo.lines, voGen, FPS);
const T = TL.lineTime;
const S = TL.scenes;
const end = (id, plus = 0) => T[id].to + plus;
if (args.includes('--장면')) { console.log(JSON.stringify({ scenes: S, total: TL.total })); process.exit(0); }
// 자막이 보이게 줄 끝보다 조금 앞(그 줄의 펜 표시는 이미 그어진 자리)을 고른다.
const SHOTS = {
  '01a': end('a1', 22), '01b': end('a2', 12), '02': end('b1', -4),
  '03a': end('c1', -6), '03b': end('c2', -6), '04a': end('d1', -4), '04b': end('d3', -4),
  '05': end('e3', -8), '06a': end('f3', 40), '06b': end('f5', -6), '07': end('g3', -6), '08': end('h3', -6),
  '09a': end('i6', -4), '09b': end('i9', -6), '10': end('j1', -8), '11a': end('k1', -6), '11b': end('k3', 30),
};

const serveUrl = await bundle({ entryPoint: path.join(HERE, 'src', 'index.ts'), publicDir: path.join(HERE, 'public') });
const shot = fs.existsSync(path.join(HERE, 'public', 'shots', 'world-homework.png')) ? 'shots/world-homework.png' : undefined;
const composition = await selectComposition({ serveUrl, id: 'lesson', inputProps: { shot } });
fs.mkdirSync(OUT, { recursive: true });
const list = [];
for (const [name, frame] of Object.entries(SHOTS)) {
  if (ONLY?.length && !ONLY.includes(name)) continue;
  const output = path.join(OUT, `${name}.png`);
  await renderStill({ composition, serveUrl, output, frame, inputProps: { shot }, chromiumOptions: { gl: 'angle' } });
  list.push({ name, frame, sec: +(frame / FPS).toFixed(2) });
  console.log(name, frame, `${(frame / FPS).toFixed(1)}s`);
}
// 일부만 다시 구워도 목록은 합쳐 둔다(검토 페이지가 17장 순간을 읽는다).
const FRAMES = path.join(OUT, 'frames.json');
const old = fs.existsSync(FRAMES) ? JSON.parse(fs.readFileSync(FRAMES, 'utf8')) : [];
const merged = Object.keys(SHOTS).map((n) => list.find((x) => x.name === n) ?? old.find((x) => x.name === n)).filter(Boolean);
fs.writeFileSync(FRAMES, JSON.stringify(merged, null, 2));
