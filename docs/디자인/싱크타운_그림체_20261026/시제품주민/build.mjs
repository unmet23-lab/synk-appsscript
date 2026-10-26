// 3D 주민 시험 판을 굽는다: main.mjs(+ Town 주민 · WORLD 몽글 코드)를 한 묶음으로 묶어 index.html.tmpl에 심고(SUIT도 심음),
// 빈 무대 낮 · 비 사진, 앞 물건 가림 겹, 몽글 펠트 · 옷감을 옆 파일로 모은다. 아티팩트로 올릴 files 목록도 쓴다.
//   node docs/디자인/싱크타운_그림체_20261026/시제품주민/build.mjs <나올 폴더> [블렌더 주민 GLB 폴더]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const repo = path.resolve(here, '../../../..'), home = path.join(repo, 'experiences/synk-world-home');
const out = path.resolve(process.argv[2] || path.join(repo, '.tmp/townstyle-20261026/proto-residents'));
const esbuild = require('esbuild'), 브랜드폰트 = require(path.join(repo, 'tools/lib/브랜드폰트.js'));
fs.mkdirSync(out, { recursive: true });

// The Town modules import by server paths (experiences/synk-town/server.mjs maps them): map the same ones here.
const SERVER_PATHS = { '/scene-assets/three.module.js': path.join(home, 'scene-assets/three.module.js'), '/avatar-textiles.mjs': path.join(home, 'avatar-textiles.mjs') };
const serverPaths = { name: 'town-server-paths', setup(b) { b.onResolve({ filter: /^\/(scene-assets\/three\.module\.js|avatar-textiles\.mjs)$/ }, a => ({ path: SERVER_PATHS[a.path] })); } };

// Cut-out layers first: main.mjs imports their list.
const day = path.join(here, '빈무대_낮.jpg'), rain = path.join(here, '빈무대_비.jpg');
execFileSync('python', ['-I', path.join(here, 'occluders.py'), day, rain, out], { stdio: ['ignore', 'ignore', 'inherit'] });
fs.copyFileSync(path.join(out, 'occluders.json'), path.join(here, 'occluders.json'));
const bundle = await esbuild.build({ entryPoints: [path.join(here, 'main.mjs')], bundle: true, format: 'esm', minify: true, write: false, target: 'es2020', legalComments: 'eof', plugins: [serverPaths] });
const code = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\/script');
const page = 브랜드폰트.심기(fs.readFileSync(path.join(here, 'index.html.tmpl'), 'utf8').replace('/*APP*/', () => code)).html;
fs.writeFileSync(path.join(out, 'index.html'), page);

const files = {};
const add = to => { files[to] = path.join(out, to); };
const copy = (from, to) => { const dst = path.join(out, to); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(from, dst); add(to); };
execFileSync('python', ['-I', '-c', 'import sys\nfrom PIL import Image\nfor a,b in zip(sys.argv[1::2],sys.argv[2::2]): Image.open(a).convert("RGB").save(b,quality=88,optimize=True,progressive=True)', day, path.join(out, 'bg-day.jpg'), rain, path.join(out, 'bg-rain.jpg')]);
add('bg-day.jpg'); add('bg-rain.jpg');
for (const f of fs.readdirSync(out)) if (/^occ-.*\.png$/.test(f)) add(f);
copy(path.join(home, 'assets/felt-coral.webp'), 'assets/felt-coral.webp');
for (const f of fs.readdirSync(path.join(home, 'assets/avatar-textiles-v1'))) if (f.endsWith('.png')) copy(path.join(home, 'assets/avatar-textiles-v1', f), `assets/avatar-textiles-v1/${f}`);
// The Blender residents' GLBs live outside git (*.glb is ignored): pass their folder as the second argument.
const glbDir = process.argv[3];
// Artifacts do not serve .glb, so each one rides as base64 inside a small JSON file.
if (glbDir) for (const f of fs.readdirSync(glbDir)) if (f.endsWith('.glb')) {
  const to = `residents-glb/${f.replace(/\.glb$/, '.json')}`, dst = path.join(out, to);
  fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, JSON.stringify({ glb: fs.readFileSync(path.join(glbDir, f)).toString('base64') })); add(to);
}
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 1));
console.log(`${path.join(out, 'index.html')} · 묶음 ${(code.length / 1e6).toFixed(2)}MB · 옆 파일 ${Object.keys(files).length}개`);
