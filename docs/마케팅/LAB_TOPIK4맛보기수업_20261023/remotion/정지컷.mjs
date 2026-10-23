// 이미지 콘티 정지컷: node 정지컷.mjs [--밖 out/stills] [--만 01a,06a]
// 번들을 한 번 만들고 장면마다 그 순간의 한 장을 PNG로 뽑는다. 순간은 time.ts와 같은 셈(대사 음절 수 어림)으로 고른다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = path.resolve(HERE, opt('--밖', 'out/stills'));
const ONLY = opt('--만', '')?.split(',').filter(Boolean);

// time.ts와 같은 셈 — 바꾸면 둘 다 바꾼다.
const vo = JSON.parse(fs.readFileSync(path.join(HERE, '..', '자막', '대사.json'), 'utf8'));
const SPECS = [
  ['01', 0, 12, 0.5, { a1: 1.5 }], ['02', 12, 21, 0.7], ['03', 21, 41, 0.8], ['04', 41, 69, 0.8], ['05', 69, 95, 0.6],
  ['06', 95, 143, 0.6, { f2: 2, f3: 3 }], ['07', 143, 174, 0.6], ['08', 174, 196, 0.6], ['09', 196, 244, 0.8], ['10', 244, 255, 0.8], ['11', 255, 279, 0.6],
];
const FPS = 30;
const fr = (s) => Math.round(s * FPS);
const syl = (s) => [...s].filter((c) => /[가-힣]/.test(c)).length;
const T = {};
const S = {};
for (const [id, start, stop, lead, pause = {}] of SPECS) {
  S[id] = { from: fr(start), to: fr(stop) };
  let t = start + lead;
  for (const l of vo.lines.filter((x) => x.scene === id)) {
    const d = syl(l.say) / 5.5;
    T[l.id] = { from: fr(t), to: fr(t + d) };
    t += d + 0.35 + (pause[l.id] ?? 0);
  }
}
const end = (id, plus = 0) => T[id].to + plus;
// 자막이 보이게 줄 끝보다 조금 앞(그 줄의 펜 표시는 이미 그어진 자리)을 고른다.
const SHOTS = {
  '01a': end('a1', 22), '01b': end('a2', -4), '02': S['02'].from + 70,
  '03a': end('c1', -6), '03b': end('c2', -6), '04a': end('d2', -6), '04b': end('d3', -4),
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
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(list, null, 2));
