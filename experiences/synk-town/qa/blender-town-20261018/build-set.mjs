// Builds one core-town set for Town: per-part PC and phone GLBs plus the manifest.
//   node build-set.mjs <variant> <rawDir> <pngDir> <cafeGlb|-> <cafePngDir|-> [--mode=etc1s] [--pc=2048] [--phone=1024] [--level=high] [--gain=<map name part>:r,g,b]
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
// --name: the set name Town asks for (default town-<variant>); townwide-<v> also brings the outer ring.
const setName = args.name || `town-${variant}`;
const resultsFile = path.join(here, 'results', `build-set-${args.name || variant}.json`);
// The outer ring is seen from afar: --outer-pc / --outer-phone size its maps apart from the core's.
const outerSize = { pc: Number(args['outer-pc'] || pc), phone: Number(args['outer-phone'] || phone) };
const parts = [
  { id: 'ground', src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-ground${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir },
  { id: 'home', placeId: 'home', src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-home${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir },
  // The cafe comes from the 10-17 district GLB (its own ground mesh dropped), or with
  // <cafeGlb> '-' from rawDir like the other parts (the merged version bakes it in the same scene).
  cafeGlb && cafeGlb !== '-'
    ? { id: 'cafe', placeId: 'cafe', src: [cafeGlb], png: cafePng, drop: 'cafe_ground' }
    : { id: 'cafe', placeId: 'cafe', src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-cafe${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir },
  { id: 'workshop', placeId: 'workshop', src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-workshop${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir },
  { id: 'greenhouse', placeId: 'greenhouse', src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-greenhouse${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir, glass: 'thin' },
  // Outer ring parts (merged version, 10-18 step ③), packed only when baked.
  ...['ring', 'neighbours'].map(id => ({ id, outer: true, src: ['raw', 'plain'].map(k => path.join(rawDir, `town-${variant}-${id}${k === 'raw' ? '-raw' : ''}.glb`)), png: pngDir }))
    .filter(part => part.src.some(f => fs.existsSync(f))),
];
const manifest = { name: setName, builtAt: new Date().toISOString(), textures: { mode, pc, phone, ...(args.uastc ? { uastc: args.uastc } : {}) }, geometry: 'meshopt' + (args.level ? '-' + args.level : ''), parts: [] }, log = [];
// --only=<id,...> repacks those parts and keeps the others from the last run (results/build-set-<variant>.json).
const only = args.only ? args.only.split(',') : null;
const previous = only ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')) : null;
for (const part of parts) {
  if (only && !only.includes(part.id)) {
    manifest.parts.push(previous.manifest.parts.find(p => p.id === part.id)); log.push(...previous.log.filter(l => l.part === part.id)); continue;
  }
  const src = part.src.find(f => fs.existsSync(f));
  if (!src) throw new Error(`no GLB for ${part.id}: ${part.src.join(' | ')}`);
  // Outer-ring parts load after the core is in place (day-district.mjs 'defer').
  const entry = { id: part.id, ...(part.placeId ? { placeId: part.placeId } : {}), ...(part.outer ? { defer: true } : {}) };
  for (const [tier, coreSize] of [['pc', pc], ['phone', phone]]) {
    // --size-<part>=<pc>,<phone> sets one part's maps (10-18: neighbours 2048/1024, ring 1024/512).
    const custom = args['size-' + part.id]?.split(',').map(Number);
    const size = custom ? custom[tier === 'pc' ? 0 : 1] : part.outer ? outerSize[tier] : coreSize;
    const file = `${setName}-${part.id}${tier === 'phone' ? '-phone' : ''}.glb`;
    // --uastc=<map name part>[;...]: those maps go UASTC inside the etc1s set (10-18: neighbour plaster).
    const res = execFileSync(process.execPath, [path.join(here, 'compress-glb.mjs'), src, part.png || '-', path.join(out, file), `--mode=${mode}`, `--size=${size}`, '--geo=meshopt', ...(args.level ? [`--level=${args.level}`] : []), ...(args.gain ? [`--gain=${args.gain}`] : []), ...(args.uastc ? [`--uastc=${args.uastc}`] : []), ...(part.drop ? [`--drop=${part.drop}`] : []), ...(part.glass ? [`--glass=${part.glass}`] : [])],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: process.env });
    const line = res.split('\n').find(l => l.startsWith('{')); const r = JSON.parse(line);
    log.push({ part: part.id, tier, file, glbBytes: r.glbBytes, textures: r.textures.map(t => ({ name: t.name, from: t.from, bytes: t.bytes, ...(t.mode ? { mode: t.mode } : {}) })) });
    entry[tier === 'pc' ? 'url' : 'phone'] = file;
    console.log(part.id, tier, r.glbBytes);
  }
  manifest.parts.push(entry);
}
fs.writeFileSync(path.join(out, `${setName}.json`), JSON.stringify(manifest, null, 2) + '\n');
fs.mkdirSync(path.join(here, 'results'), { recursive: true });
fs.writeFileSync(resultsFile, JSON.stringify({ manifest, log }, null, 2) + '\n');
console.log(JSON.stringify({ manifest: `${setName}.json`, pcBytes: log.filter(l => l.tier === 'pc').reduce((n, l) => n + l.glbBytes, 0), phoneBytes: log.filter(l => l.tier === 'phone').reduce((n, l) => n + l.glbBytes, 0) }));
