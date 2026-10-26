// 줄 세우기 판 두 벌(지금 주민 코드 · 비교할 커밋의 주민 코드)을 시제품 출력 폴더에 묶어 넣는다.
// 시제품주민/build.mjs를 먼저 돌린 폴더여야 한다(사진 · 옷감 그림을 같이 쓴다).
//   node docs/디자인/싱크타운_그림체_20261026/시제품주민/펠트대조/build.mjs <시제품 출력 폴더> [비교할 커밋, 기본 HEAD]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const repo = path.resolve(here, '../../../../..'), home = path.join(repo, 'experiences/synk-world-home'), town = path.join(repo, 'experiences/synk-town');
const out = path.resolve(process.argv[2]), base = process.argv[3] || 'HEAD';
const baseFile = path.join(out, 'day-residents.base.mjs');
fs.writeFileSync(baseFile, execFileSync('git', ['show', `${base}:experiences/synk-town/day-residents.mjs`], { cwd: repo }));
const esbuild = require(path.join(repo, 'node_modules/esbuild'));
const MAP = { '/scene-assets/three.module.js': path.join(home, 'scene-assets/three.module.js'), '/avatar-textiles.mjs': path.join(home, 'avatar-textiles.mjs') };
for (const [tag, file] of [['cur', path.join(town, 'day-residents.mjs')], ['head', baseFile]]) {
  const plugin = { name: 'paths', setup(b) {
    b.onResolve({ filter: /^\/(scene-assets\/three\.module\.js|avatar-textiles\.mjs)$/ }, a => ({ path: MAP[a.path] }));
    b.onResolve({ filter: /^town-residents$/ }, () => ({ path: file }));
    b.onResolve({ filter: /^\.\/day-materials\.mjs$/ }, () => ({ path: path.join(town, 'day-materials.mjs') }));
  } };
  const r = await esbuild.build({ entryPoints: [path.join(here, 'lineup.mjs')], bundle: true, format: 'esm', write: false, target: 'es2020', plugins: [plugin] });
  fs.writeFileSync(path.join(out, `lineup-${tag}.js`), r.outputFiles[0].text);
  fs.writeFileSync(path.join(out, `lineup-${tag}.html`), `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#222}
#stage{position:relative;overflow:hidden}#bg{position:absolute;inset:0;background-repeat:no-repeat}canvas{position:relative;display:block}</style></head><body><div id="stage"><div id="bg"></div><canvas id="gl"></canvas></div>
<script>{const q=new URLSearchParams(location.search),z=+q.get('zoom')||1,W=+q.get('w')||1380,H=+q.get('h')||330,x=+(q.get('bx')??78),y=+(q.get('by')??600);
const s=document.getElementById('stage'),b=document.getElementById('bg'),c=document.getElementById('gl');s.style.width=W+'px';s.style.height=H+'px';c.style.width=W+'px';c.style.height=H+'px';
b.style.backgroundImage='url(bg-day.jpg)';b.style.backgroundSize=(1536*z)+'px '+(1024*z)+'px';b.style.backgroundPosition=(-x*z)+'px '+(-y*z)+'px';}</script>
<script type="module" src="lineup-${tag}.js"></script></body></html>`);
}
console.log('줄 세우기 판 두 벌:', out);
