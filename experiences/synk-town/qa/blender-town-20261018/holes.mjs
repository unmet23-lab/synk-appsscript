// node holes.mjs <ground.glb> [step] — grid points of the core rectangle that no ground triangle covers
// (building footprints excluded: decks cover them). Prints a coarse ASCII map and hole cells.
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tools = path.resolve('.tmp/tools/ktx/node_modules');
const { NodeIO } = require(path.join(tools, '@gltf-transform/core'));
const { ALL_EXTENSIONS } = require(path.join(tools, '@gltf-transform/extensions'));
const { MeshoptDecoder } = await import('file:///' + path.join(tools, 'meshoptimizer/index.module.js').replace(/\\/g, '/'));
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [file, stepArg] = process.argv.slice(2), step = Number(stepArg || .25);
const R = { minX: -13.6, maxX: 13.6, minZ: -12.2, maxZ: 8.7 };
const W = Math.floor((R.maxX - R.minX) / step), H = Math.floor((R.maxZ - R.minZ) / step);
const covered = new Uint8Array(W * H);
const doc = await io.read(file);
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue; const m = node.getWorldMatrix();
  const tf = v => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[13] + m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), n = idx ? idx.getCount() : pos.getCount();
    const get = i => tf(pos.getElement(idx ? idx.getScalar(i) : i, []));
    for (let i = 0; i < n; i += 3) {
      const a = get(i), b = get(i + 1), c = get(i + 2);
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - R.minX) / step)), x1 = Math.min(W - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - R.minX) / step));
      const z0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - R.minZ) / step)), z1 = Math.min(H - 1, Math.ceil((Math.max(a[2], b[2], c[2]) - R.minZ) / step));
      for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
        const x = R.minX + (gx + .5) * step, z = R.minZ + (gz + .5) * step;
        const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
        if (l1 >= -1e-6 && l2 >= -1e-6 && 1 - l1 - l2 >= -1e-6) covered[gz * W + gx] = 1;
      }
    }
  }
}
const deck = (x, z) => [[-6, 0], [0, 0], [6, 0]].some(([px]) => Math.abs(x - px) < 2.4 && z > -3.0 && z < 1.35) || (Math.abs(x) < 2.4 && z > -9.0 && z < -4.65);
let holes = 0; const rows = [];
for (let gz = 0; gz < H; gz += 2) {
  let row = '';
  for (let gx = 0; gx < W; gx += 1) {
    const x = R.minX + (gx + .5) * step, z = R.minZ + (gz + .5) * step;
    row += deck(x, z) ? '#' : covered[gz * W + gx] ? '.' : 'X';
  }
  rows.push(row);
}
for (let i = 0; i < W * H; i++) { const gx = i % W, gz = Math.floor(i / W); const x = R.minX + (gx + .5) * step, z = R.minZ + (gz + .5) * step; if (!covered[i] && !deck(x, z)) holes++; }
console.log('holes', holes, 'of', W * H, `(${(holes / (W * H) * 100).toFixed(2)}%)`);
console.log(rows.join('\n'));
