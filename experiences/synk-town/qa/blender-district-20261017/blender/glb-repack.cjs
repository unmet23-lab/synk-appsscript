// Replace the baked images inside a Blender-exported GLB with WebP encodes of
// the original PNGs. Blender's glTF WebP export does not keep RGB under
// alpha 0, and in a bake alpha is the sun share, so alpha 0 is full shade whose
// colour matters (bake_ground mean G there 8.0 -> 28.7; check with
// alpha-check.cjs). sharp's `exact` keeps it. Also marks bake_* materials OPAQUE.
//   NODE_PATH=desktop/node_modules node glb-repack.cjs <in.glb> <pngDir> <out.glb> [quality]
const fs = require('node:fs'), path = require('node:path');
const sharp = require('sharp');
const [input, pngDir, output, q = '88'] = process.argv.slice(2);
(async () => {
  const glb = fs.readFileSync(input);
  if (glb.readUInt32LE(0) !== 0x46546C67) throw Error('not a GLB');
  const jsonLength = glb.readUInt32LE(12), json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 20 + jsonLength + 8, bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLength));
  const replacements = new Map();
  for (const image of json.images || []) {
    const png = path.join(pngDir, image.name + '.png');
    if (!/^bake_/.test(image.name) || !fs.existsSync(png)) continue;
    const webp = await sharp(png).webp({ quality: +q, alphaQuality: 100, exact: true, effort: 6, smartSubsample: true }).toBuffer();
    replacements.set(image.bufferView, webp);
    image.mimeType = 'image/webp';
  }
  const chunks = []; let offset = 0;
  json.bufferViews = json.bufferViews.map((view, i) => {
    const bytes = replacements.get(i) || bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const pad = (4 - bytes.length % 4) % 4, next = { ...view, byteOffset: offset, byteLength: bytes.length };
    chunks.push(bytes, Buffer.alloc(pad)); offset += bytes.length + pad; return next;
  });
  json.buffers[0].byteLength = offset;
  for (const m of json.materials || []) if (/^bake_/.test(m.name)) { delete m.alphaMode; delete m.alphaCutoff; }
  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8'), jsonPad = (4 - jsonBytes.length % 4) % 4;
  const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + offset, out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546C67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBytes.length + jsonPad, 12); out.writeUInt32LE(0x4E4F534A, 16); jsonBytes.copy(out, 20); out.fill(0x20, 20 + jsonBytes.length, 20 + jsonBytes.length + jsonPad);
  let at = 20 + jsonBytes.length + jsonPad; out.writeUInt32LE(offset, at); out.writeUInt32LE(0x004E4942, at + 4); at += 8;
  for (const c of chunks) { c.copy(out, at); at += c.length; }
  fs.writeFileSync(output, out);
  console.log(JSON.stringify({ output, bytes: total, replaced: [...replacements.values()].map(b => b.length) }));
})().catch(e => { console.error(e); process.exitCode = 1; });
