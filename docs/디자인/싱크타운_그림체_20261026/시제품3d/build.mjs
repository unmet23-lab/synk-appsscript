// 3D 몽글 시험 판을 굽는다: main.mjs를 한 묶음으로 묶어 index.html.tmpl에 심고(SUIT도 심음),
// 사진 · 몽글 펠트 · 옷감 · 옷 썸네일을 옆 파일로 모은다. 아티팩트로 올릴 files 목록도 쓴다.
//   node docs/디자인/싱크타운_그림체_20261026/시제품3d/build.mjs <나올 폴더>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), require = createRequire(import.meta.url);
const repo = path.resolve(here, '../../../..'), home = path.join(repo, 'experiences/synk-world-home');
const out = path.resolve(process.argv[2] || path.join(repo, '.tmp/townstyle-20261026/proto3d'));
const esbuild = require('esbuild'), 브랜드폰트 = require(path.join(repo, 'tools/lib/브랜드폰트.js'));

const bundle = await esbuild.build({ entryPoints: [path.join(here, 'main.mjs')], bundle: true, format: 'esm', minify: true, write: false, target: 'es2020', legalComments: 'eof' });
const code = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = 브랜드폰트.심기(fs.readFileSync(path.join(here, 'index.html.tmpl'), 'utf8').replace('/*APP*/', () => code)).html;
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'index.html'), page);

const files = {};
const copy = (from, to) => { const dst = path.join(out, to); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(from, dst); files[to] = dst; };
copy(path.join(here, '../시제품/bg.jpg'), 'bg.jpg');
copy(path.join(home, 'assets/felt-coral.webp'), 'assets/felt-coral.webp');
for (const f of fs.readdirSync(path.join(home, 'assets/avatar-textiles-v1'))) if (f.endsWith('.png')) copy(path.join(home, 'assets/avatar-textiles-v1', f), `assets/avatar-textiles-v1/${f}`);
for (const f of fs.readdirSync(path.join(home, 'assets/wardrobe-thumbnails-v8'))) if (f.endsWith('.png')) copy(path.join(home, 'assets/wardrobe-thumbnails-v8', f), `assets/wardrobe-thumbnails-v8/${f}`);
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 1));
console.log(`${path.join(out, 'index.html')} · 묶음 ${(code.length / 1e6).toFixed(2)}MB · 쪽 ${(page.length / 1e6).toFixed(2)}MB · 옆 파일 ${Object.keys(files).length}개`);
