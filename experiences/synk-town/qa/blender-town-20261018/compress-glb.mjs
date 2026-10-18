// Re-encode the baked maps inside a GLB from their source PNGs (or the embedded
// image when no PNG is given) and write a variant GLB.
//   NODE_PATH=<tools>/node_modules;<repo>/desktop/node_modules node compress-glb.mjs <in.glb> <pngDir|-> <out.glb> --mode=webp|etc1s|uastc [--size=2048] [--q=…]
// webp:  sharp WebP (exact: keeps RGB under alpha 0, which is full shade in a bake)
// etc1s: KTX2 Basis ETC1S, mipmaps, sRGB (small files, ~1 B/px on the GPU)
// uastc: KTX2 Basis UASTC + RDO + Zstandard, mipmaps, sRGB (better quality, bigger files)
// Every map is resized to --size (Lanczos) first. Alpha (the sun share) is data and kept as is.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tools = process.env.KTX_TOOLS || path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../../../.tmp/tools/ktx/node_modules');
const { NodeIO } = require(path.join(tools, '@gltf-transform/core'));
const { ALL_EXTENSIONS, KHRTextureBasisu, EXTTextureWebP } = require(path.join(tools, '@gltf-transform/extensions'));
const { encodeToKTX2 } = await import('file:///' + path.join(tools, 'ktx2-encoder/dist/node/index.js').replace(/\\/g, '/'));
const sharp = require('sharp');

const [input, pngDir, output] = process.argv.slice(2);
const args = Object.fromEntries(process.argv.slice(5).map(a => a.replace(/^--/, '').split('=')));
const mode = args.mode || 'etc1s', size = Number(args.size || 2048);
// Push-pull hole fill on RGBA8 in place: holes are texels with RGB and alpha all
// 0. Pull: masked 2x2 averages up to 1x1. Push: each hole takes its parent's
// value from the next coarser level, so a hole gets the mean of its nearest
// island texels at the scale where they first appear.
function pushPullFill(data, w, h) {
  const levels = [];
  let cw = w, ch = h, col = new Float32Array(w * h * 4), wt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const hole = !data[i * 4] && !data[i * 4 + 1] && !data[i * 4 + 2] && !data[i * 4 + 3];
    if (!hole) { wt[i] = 1; for (let k = 0; k < 4; k++) col[i * 4 + k] = data[i * 4 + k]; }
  }
  levels.push({ w: cw, h: ch, col, wt });
  while (cw > 1 || ch > 1) {
    const nw = Math.max(1, cw >> 1), nh = Math.max(1, ch >> 1), ncol = new Float32Array(nw * nh * 4), nwt = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let s = 0; const acc = [0, 0, 0, 0];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = Math.min(cw - 1, x * 2 + dx), sy = Math.min(ch - 1, y * 2 + dy), j = sy * cw + sx;
        if (wt[j] > 0) { s += wt[j]; for (let k = 0; k < 4; k++) acc[k] += col[j * 4 + k] * wt[j]; }
      }
      const o = y * nw + x;
      if (s > 0) { nwt[o] = Math.min(1, s); for (let k = 0; k < 4; k++) ncol[o * 4 + k] = acc[k] / s; }
    }
    cw = nw; ch = nh; col = ncol; wt = nwt; levels.push({ w: cw, h: ch, col, wt });
  }
  for (let l = levels.length - 2; l >= 0; l--) {
    const f = levels[l], c = levels[l + 1];
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const i = y * f.w + x; if (f.wt[i] > 0) continue;
      const p = Math.min(c.h - 1, y >> 1) * c.w + Math.min(c.w - 1, x >> 1);
      for (let k = 0; k < 4; k++) f.col[i * 4 + k] = c.col[p * 4 + k]; f.wt[i] = 1e-6;
    }
  }
  const top = levels[0];
  for (let i = 0; i < w * h; i++) if (!data[i * 4] && !data[i * 4 + 1] && !data[i * 4 + 2] && !data[i * 4 + 3])
    for (let k = 0; k < 4; k++) data[i * 4 + k] = Math.round(top.col[i * 4 + k]);
}
const imageDecoder = async buffer => { const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; };
const { MeshoptEncoder, MeshoptDecoder } = await import('file:///' + path.join(tools, 'meshoptimizer/index.module.js').replace(/\\/g, '/'));
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(input);
const report = { input: path.basename(input), mode, size, textures: [] };
const t0 = Date.now();
// Glass materials: Blender suffixes repeated names (live_glass.001, …) and Town
// only knows live_glass / live_glass_thin. --glass=thin marks the greenhouse's
// thinner panes (v20 opacity .16, no depth write).
for (const material of doc.getRoot().listMaterials()) if (/^live_glass/.test(material.getName())) material.setName(args.glass === 'thin' ? 'live_glass_thin' : 'live_glass');
// --drop=<prefix>[,<prefix>]: remove nodes by name (the 10-17 cafe GLBs carry
// their own court; the town set's shared ground replaces it) and prune what
// only they used (meshes, accessors, a ground-only texture).
if (args.drop) {
  const { prune } = require(path.join(tools, '@gltf-transform/functions'));
  const prefixes = args.drop.split(',');
  for (const node of doc.getRoot().listNodes()) if (prefixes.some(p => node.getName().startsWith(p))) { node.getMesh()?.dispose(); node.dispose(); }
  await doc.transform(prune());
  report.dropped = prefixes;
}
for (const texture of mode === 'keep' ? [] : doc.getRoot().listTextures()) {
  const name = texture.getName() || texture.getURI() || 'texture';
  const png = pngDir !== '-' ? path.join(pngDir, name + '.png') : null;
  const source = png && fs.existsSync(png) ? fs.readFileSync(png) : Buffer.from(texture.getImage());
  const meta = await sharp(source).metadata();
  // RGB and alpha are resized apart, from raw pixels: sharp premultiplies by
  // alpha when it resizes RGBA, and alpha here is the sun share, so full shade
  // (alpha 0) lost its colour (10-18: 36–53% of the cafe's pixels moved at
  // 1024). removeAlpha() does not help: sharp resizes before it drops alpha.
  // Empty atlas space (RGB 0 and alpha 0) is filled push-pull from the islands
  // around it: small mip levels, used at grazing angles, otherwise averaged the
  // black background into the island edges (10-18: dark notches along the paths,
  // light/dark wedges on lawn slivers packed at the atlas border).
  // --gain=<name part>:r,g,b multiplies the baked radiance (linear) of matching
  // maps: the lawn atlas is tone-matched to v20's live lawn at the slab border,
  // measured in Town at the same pose (10-18, ../blender-merged-20261018/진행.md).
  const gains = (args.gain || '').split(';').filter(Boolean).map(g => { const [k, v] = g.split(':'); return { k, v: v.split(',').map(Number) }; });
  const gain = gains.find(g => name.includes(g.k))?.v;
  const filled = await (async () => {
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (gain) {
      const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
      const enc = l => { l = Math.min(1, Math.max(0, l)); return Math.round(255 * (l <= .0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - .055)); };
      for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = enc(lin(data[i + c]) * gain[c]);
      report.gain = { [name]: gain };
    }
    pushPullFill(data, info.width, info.height);
    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  })();
  let resized;
  if (meta.width === size) resized = filled;
  else {
    const { data, info } = await sharp(filled).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = info.width * info.height, rgb = Buffer.alloc(px * 3), alpha = Buffer.alloc(px);
    for (let i = 0; i < px; i++) { rgb[i * 3] = data[i * 4]; rgb[i * 3 + 1] = data[i * 4 + 1]; rgb[i * 3 + 2] = data[i * 4 + 2]; alpha[i] = data[i * 4 + 3]; }
    const shrink = (buf, channels) => sharp(buf, { raw: { width: info.width, height: info.height, channels } }).resize(size, size, { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer();
    // The sun share takes the minimum over each source footprint: a Lanczos
    // overshoot leaks alpha into baked shade, where live shadows then show the
    // shadow-map grain as comb stripes (10-18, 1024 cafe close-up).
    const minShrink = () => {
      const a = Buffer.alloc(size * size), sx = info.width / size, sy = info.height / size;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        let m = 255;
        for (let v = Math.floor(y * sy); v < Math.ceil((y + 1) * sy); v++) for (let u = Math.floor(x * sx); u < Math.ceil((x + 1) * sx); u++) m = Math.min(m, alpha[v * info.width + u]);
        a[y * size + x] = m;
      }
      return a;
    };
    const [r, a] = await Promise.all([shrink(rgb, 3), args.alpha === 'lanczos' ? shrink(alpha, 1) : minShrink()]);
    const joined = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) { joined[i * 4] = r[i * 3]; joined[i * 4 + 1] = r[i * 3 + 1]; joined[i * 4 + 2] = r[i * 3 + 2]; joined[i * 4 + 3] = a[i]; }
    resized = await sharp(joined, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
  }
  let bytes, mime;
  if (mode === 'webp') { bytes = await sharp(resized).webp({ quality: Number(args.q || 88), alphaQuality: 100, exact: true, effort: 6, smartSubsample: true }).toBuffer(); mime = 'image/webp'; }
  else {
    const common = { isKTX2File: true, generateMipmap: true, isPerceptual: true, isSetKTX2SRGBTransferFunc: true, imageDecoder };
    const options = mode === 'uastc' ? { ...common, isUASTC: true, uastcLDRQualityLevel: Number(args.q || 2), enableRDO: true, rdoQualityLevel: Number(args.rdo || 1), needSupercompression: true }
      : { ...common, isUASTC: false, qualityLevel: Number(args.q || 160), compressionLevel: Number(args.c || 3) };
    bytes = Buffer.from(await encodeToKTX2(new Uint8Array(resized), options)); mime = 'image/ktx2';
  }
  texture.setImage(new Uint8Array(bytes)).setMimeType(mime);
  report.textures.push({ name, from: png && fs.existsSync(png) ? 'png' : 'embedded', sourceWidth: meta.width, width: size, bytes: bytes.length });
}
// --geo=meshopt: quantize + EXT_meshopt_compression (Town loads MeshoptDecoder).
// Bake UVs keep 14 bits (a 2048 atlas needs better than half-texel placement).
// --level=high adds meshopt's filters (octahedral normals, quaternion/exponential
// encodings), --nbits / --uvbits lower the normal / UV quantization (the merged
// version uses them to fit the budget, 10-18).
if (args.geo === 'meshopt') {
  const { meshopt } = require(path.join(tools, '@gltf-transform/functions'));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: args.level || 'medium', quantizeTexcoord: Number(args.uvbits || 14), quantizeNormal: Number(args.nbits || 10) }));
  report.geometry = 'meshopt' + (args.level ? '-' + args.level : '');
}
const ktx = doc.getRoot().listTextures().some(t => t.getMimeType() === 'image/ktx2'), webp = doc.getRoot().listTextures().some(t => t.getMimeType() === 'image/webp');
if (ktx) doc.createExtension(KHRTextureBasisu).setRequired(true);
const webpExt = doc.getRoot().listExtensionsUsed().find(e => e.extensionName === 'EXT_texture_webp');
if (!webp && webpExt) webpExt.dispose(); else if (webp) doc.createExtension(EXTTextureWebP).setRequired(true);
await io.write(output, doc);
report.glbBytes = fs.statSync(output).size; report.seconds = Math.round((Date.now() - t0) / 100) / 10;
console.log(JSON.stringify(report));
