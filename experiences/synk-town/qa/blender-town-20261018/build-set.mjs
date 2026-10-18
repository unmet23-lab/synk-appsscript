// Builds one core-town set for Town: per-part PC and phone GLBs plus the manifest.
//   node build-set.mjs <variant> <rawDir> <pngDir> <cafeGlb> <cafePngDir|-> [--mode=etc1s] [--pc=2048] [--phone=1024]
// rawDir holds town-<variant>-<part>-raw.glb (or town-<variant>-<part>.glb) for
// ground, home, workshop, greenhouse; pngDir the source atlases named after the
// GLB images. Output: experiences/synk-town/assets/district/town-<variant>-<part>[-phone].glb
// and town-<variant>.json. Every GLB gets KTX2 maps and meshopt geometry.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const [variant, rawDir, pngDir, cafeGlb, cafePng] = process.argv.slice(2);
const args = Object.fromEntries(process.argv.slice(7).map(a => a.replace(/^--/, '').split('=')));
const mode = args.mode || 'etc1s', pc = Number(args.pc || 2048), phone = Number(args.phone || 1024);
const out = path.resolve(here, '../../assets/district');
const parts = [
  { id: 'ground', src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-ground${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir },
  { id: 'home', placeId: 'home', src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-home${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir },
  { id: 'cafe', placeId: 'cafe', src: [cafeGlb], png: cafePng, drop: 'cafe_ground' },
  { id: 'workshop', placeId: 'workshop', src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-workshop${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir },
  { id: 'greenhouse', placeId: 'greenhouse', src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-greenhouse${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir, glass: 'thin' },
];
const manifest = { name: `town-${variant}`, builtAt: new Date().toISOString(), textures: { mode, pc, phone }, geometry: 'meshopt', parts: [] }, log = [];
for (const part of parts) {
  const src = part.src.find(f => fs.existsSync(f));
  if (!src) throw new Error(`no GLB for ${part.id}: ${part.src.join(' | ')}`);
  const entry = { id: part.id, ...(part.placeId ? { placeId: part.placeId } : {}) };
  for (const [tier, size] of [['pc', pc], ['phone', phone]]) {
    const file = `town-${variant}-${part.id}${tier === 'phone' ? '-phone' : ''}.glb`;
    const res = execFileSync(process.execPath, [path.join(here, 'compress-glb.mjs'), src, part.png || '-', path.join(out, file), `--mode=${mode}`, `--size=${size}`, '--geo=meshopt', ...(part.drop ? [`--drop=${part.drop}`] : []), ...(part.glass ? [`--glass=${part.glass}`] : [])],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: process.env });
    const line = res.split('\n').find(l => l.startsWith('{')); const r = JSON.parse(line);
    log.push({ part: part.id, tier, file, glbBytes: r.glbBytes, textures: r.textures.map(t => ({ name: t.name, from: t.from, bytes: t.bytes })) });
    entry[tier === 'pc' ? 'url' : 'phone'] = file;
    console.log(part.id, tier, r.glbBytes);
  }
  manifest.parts.push(entry);
}
fs.writeFileSync(path.join(out, `town-${variant}.json`), JSON.stringify(manifest, null, 2) + '\n');
fs.mkdirSync(path.join(here, 'results'), { recursive: true });
fs.writeFileSync(path.join(here, 'results', `build-set-${variant}.json`), JSON.stringify({ manifest, log }, null, 2) + '\n');
console.log(JSON.stringify({ manifest: `town-${variant}.json`, pcBytes: log.filter(l => l.tier === 'pc').reduce((n, l) => n + l.glbBytes, 0), phoneBytes: log.filter(l => l.tier === 'phone').reduce((n, l) => n + l.glbBytes, 0) }));
