// 몽글 대조 판 두 벌(지금 avatar-v3 · 비교 커밋의 avatar-v3)을 시제품 출력 폴더에 묶는다(사진 · 옷감 그림을 같이 쓴다).
//   node docs/디자인/싱크타운_그림체_20261026/시제품주민/펠트대조/build-mongle.mjs <시제품 출력 폴더> [커밋, 기본 HEAD]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const repo = path.resolve(here, '../../../../..'), home = path.join(repo, 'experiences/synk-world-home');
const out = path.resolve(process.argv[2]), base = process.argv[3] || 'HEAD';
const esbuild = require(path.join(repo, 'node_modules/esbuild'));
// The old avatar-v3 is written next to the live one so its relative imports resolve, and removed right after bundling.
const baseFile = path.join(home, `avatar-v3.__compare_${process.pid}.mjs`);
fs.writeFileSync(baseFile, execFileSync('git', ['show', `${base}:experiences/synk-world-home/avatar-v3.mjs`], { cwd: repo }));
const page = tag => `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#222}
#stage{position:relative;overflow:hidden}#bg{position:absolute;inset:0;background-repeat:no-repeat}canvas{position:relative;display:block}</style></head><body><div id="stage"><div id="bg"></div><canvas id="gl"></canvas></div>
<script>{const q=new URLSearchParams(location.search),W=+q.get('w')||900,H=+q.get('h')||520,x=+(q.get('bx')??330),y=+(q.get('by')??420),z=+q.get('zoom')||1.6;
const s=document.getElementById('stage'),b=document.getElementById('bg'),c=document.getElementById('gl');s.style.width=W+'px';s.style.height=H+'px';c.style.width=W+'px';c.style.height=H+'px';
b.style.backgroundImage='url(bg-day.jpg)';b.style.backgroundSize=(1536*z)+'px '+(1024*z)+'px';b.style.backgroundPosition=(-x*z)+'px '+(-y*z)+'px';}</script>
<script type="module" src="mongle-${tag}.js"></script></body></html>`;
try {
  for (const [tag, file] of [['cur', path.join(home, 'avatar-v3.mjs')], ['head', baseFile]]) {
    const plugin = { name: 'paths', setup(b) { b.onResolve({ filter: /^mongle-avatar$/ }, () => ({ path: file })); } };
    const r = await esbuild.build({ entryPoints: [path.join(here, 'mongle.mjs')], bundle: true, format: 'esm', write: false, target: 'es2022', plugins: [plugin] });
    fs.writeFileSync(path.join(out, `mongle-${tag}.js`), r.outputFiles[0].text);
    fs.writeFileSync(path.join(out, `mongle-${tag}.html`), page(tag));
  }
} finally { fs.rmSync(baseFile, { force: true }); }
console.log('몽글 대조 판 두 벌:', out);
