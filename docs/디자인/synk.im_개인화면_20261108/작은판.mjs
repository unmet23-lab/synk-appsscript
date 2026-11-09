// 다시 찍은 조각의 작은 판만 만든다(2026-11-09). 규칙은 SYNK-website site-v10/make-variants.mjs 그대로(폭 320 · 480 · 800 · 1200 중 원본의 90% 밑,
// WebP q80, 원본 폭 다시 굽기는 25% 넘게 줄 때만)이고, 주는 그림만 건드린다 — 그 도구를 통째로 돌리면 그날 쪽에 없는 그림의 판을 지우고 다른 판을 다시 굽는다.
// 쓰기: node 작은판.mjs <SYNK-website 폴더> learner/ko/piece-tutor.webp learner/en/piece-back.webp …   (경로는 site-v10/assets 아래. sharp 위치는 SHARP_MODULE)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [site, ...items] = process.argv.slice(2);
if (!site || !items.length) throw Error('쓰기: node 작은판.mjs <SYNK-website 폴더> <site-v10/assets 아래 경로…>');
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'C:/Users/q1212/Documents/SYNK-appsscript/desktop/node_modules/sharp');
const ASSETS = path.join(site, 'site-v10', 'assets'), OUT = path.join(ASSETS, 'r'), LIST = path.join(site, 'site-v10', 'image-variants.json');
const WIDTHS = [320, 480, 800, 1200];
const list = JSON.parse(fs.readFileSync(LIST, 'utf8'));
const name = (src, w) => src.replace(/^\/assets\//, '').replace(/\.[a-z]+$/i, '').replace(/\//g, '-') + `-w${w}.webp`;
const enc = img => img.webp({ quality: 80, effort: 6, smartSubsample: true, alphaQuality: 90 });
for (const item of items) {
  const file = path.join(ASSETS, item), src = `/assets/v10/${item.replaceAll('\\', '/')}`;
  if (!fs.existsSync(file)) throw Error(`없는 그림: ${file}`);
  const meta = await sharp(file).metadata(), orig = fs.statSync(file).size, old = list[src];
  const made = WIDTHS.filter(w => w < meta.width * 0.9);
  for (const w of made) await enc(sharp(file).resize({ width: w })).toFile(path.join(OUT, name(src, w)));
  const full = path.join(OUT, name(src, meta.width));
  await enc(sharp(file)).toFile(full);
  const keepFull = fs.statSync(full).size < orig * 0.75;
  if (!keepFull) fs.unlinkSync(full);
  const now = new Set([...made, ...(keepFull ? [meta.width] : [])]);
  // 크기가 바뀌어 안 쓰게 된 앞 판만 지운다.
  if (old) for (const w of [...old.widths, ...(old.full ? [old.w] : [])]) if (!now.has(w)) fs.rmSync(path.join(OUT, name(src, w)), { force: true });
  if (!now.size) { delete list[src]; console.log(`${src} — 판 없음`); continue; }
  list[src] = { w: meta.width, h: meta.height, widths: made, full: keepFull };
  console.log(`${src} (${meta.width}×${meta.height}, ${Math.round(orig / 1024)}KB) → ${[...now].join(' · ')}${old && (old.w !== meta.width || old.h !== meta.height) ? ` · 앞 판 ${old.w}×${old.h}` : ''}`);
}
fs.writeFileSync(LIST, JSON.stringify(list, null, 1) + '\n');
