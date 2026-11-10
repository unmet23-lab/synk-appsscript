// 블프 두 편 글자 시안 정지 장(2026-11-10, Claude) — Remotion을 한 번 묶고 여러 장(편 · 장 · 시안 props)을 찍는다.
// `npx remotion still`은 장마다 다시 묶어 느리다.
//   node 스틸.mjs <작업.json>   작업: [{ "comp": "s3-15", "frame": 46, "props": { "len": 15, "glyph": "A" }, "out": "<png>" }, …]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RM = path.join(HERE, '..', '자막시안_20261103', 'remotion');
const require = createRequire(path.join(RM, 'package.json'));
const { bundle } = require('@remotion/bundler');
const { renderStill, selectComposition } = require('@remotion/renderer');

const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const serveUrl = await bundle({ entryPoint: path.join(RM, 'src', 'index.ts'), publicDir: path.join(RM, 'public'), webpackOverride: (c) => c });
const comps = new Map();
for (const j of jobs) {
  const key = `${j.comp}|${JSON.stringify(j.props || {})}`;
  if (!comps.has(key)) comps.set(key, await selectComposition({ serveUrl, id: j.comp, inputProps: j.props || {} }));
  fs.mkdirSync(path.dirname(j.out), { recursive: true });
  await renderStill({ serveUrl, composition: comps.get(key), frame: j.frame, inputProps: j.props || {}, output: j.out, imageFormat: 'png', chromiumOptions: { gl: 'angle' } });
  console.log('ok', j.comp, j.frame, JSON.stringify(j.props || {}), '→', j.out);
}
