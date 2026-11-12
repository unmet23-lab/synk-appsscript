// 시안 빌드 — node experiences/solo-backup-rust/ui-mockups/_src/build.mjs [a] [b]
// 원고(a.mjs · b.mjs + 공용 copy.mjs)를 자립형 HTML 한 장씩으로 굽는다. 글꼴은 쓰인 글자만큼 줄여 심는다(fonts.py).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { page } from './shell.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..');
const BUILDS = { a: { mod: 'a.mjs', file: 'a-확인서.html' }, b: { mod: 'b.mjs', file: 'b-눈금.html' } };

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
function textOf(html) {
  const attrs = [...html.matchAll(/\s(?:aria-label|title|placeholder|data-title|data-name)="([^"]*)"/g)].map((m) => m[1]);
  const body = html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return (body + ' ' + attrs.join(' ')).replace(/&(#?\w+);/g, (m, k) => ENT[k] ?? m);
}

const want = process.argv.slice(2).filter((k) => BUILDS[k]);
for (const key of want.length ? want : Object.keys(BUILDS)) {
  const m = await import(pathToFileURL(path.join(here, BUILDS[key].mod)).href + `?t=${Date.now()}`);
  let html = page({ name: m.name, css: m.css, screens: m.screens, bodyClass: m.bodyClass || '' });
  const tmp = path.join(os.tmpdir(), `synk-ui-mock-${key}-${process.pid}.txt`);
  fs.writeFileSync(tmp, textOf(html) + ' ' + m.name, 'utf8');
  let fonts;
  try {
    fonts = JSON.parse(execFileSync('python', ['-X', 'utf8', path.join(here, 'fonts.py'), tmp], { maxBuffer: 64 * 1024 * 1024 }).toString());
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  const faces = `@font-face{font-family:"SYNK Sans";src:url(data:font/woff2;base64,${fonts.sans}) format("woff2");font-weight:100 900;font-display:block}`
    + Object.entries(fonts.inter).map(([w, b]) => `@font-face{font-family:"Inter Tight";src:url(data:font/woff2;base64,${b}) format("woff2");font-weight:${w};font-display:block}`).join('');
  html = html.replace('/*FONTS*/', faces);
  fs.writeFileSync(path.join(out, BUILDS[key].file), html, 'utf8');
  console.log(`${BUILDS[key].file} · ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB · 화면 ${m.screens.length}`);
}
