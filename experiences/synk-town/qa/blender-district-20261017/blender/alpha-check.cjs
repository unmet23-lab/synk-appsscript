// Compare the images inside a GLB with the baked PNGs they came from, over
// texels whose PNG alpha lies in [AMIN, AMAX] (default 0..255). Prints the mean
// green of both and the share of texels whose green is identical.
//   AMIN=0 AMAX=0 NODE_PATH=<repo>/desktop/node_modules node alpha-check.cjs <in.glb> <pngDir>
// With AMIN=AMAX=0 this shows whether the WebP encode kept RGB under alpha 0
// (Blender's glTF WebP export did not: bake_ground mean G 8.0 -> 28.7 on 10-17;
// glb-repack.cjs output 8.1).
const fs = require('node:fs'), path = require('node:path');
const sharp = require('sharp');
const [glbPath, pngDir] = process.argv.slice(2);
const lo = +(process.env.AMIN || 0), hi = +(process.env.AMAX || 255);
(async () => {
  const glb = fs.readFileSync(glbPath);
  const jl = glb.readUInt32LE(12), json = JSON.parse(glb.subarray(20, 20 + jl).toString('utf8'));
  const binStart = 20 + jl + 8;
  for (const image of json.images || []) {
    const png = path.join(pngDir, image.name + '.png');
    if (!fs.existsSync(png)) continue;
    const bv = json.bufferViews[image.bufferView];
    const buf = glb.subarray(binStart + (bv.byteOffset || 0), binStart + (bv.byteOffset || 0) + bv.byteLength);
    const a = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (a.info.width !== b.info.width || a.info.height !== b.info.height) { console.log(image.name, 'size differs'); continue; }
    let n = 0, sumA = 0, sumB = 0, same = 0;
    for (let i = 0; i < b.data.length; i += 4) {
      const alpha = b.data[i + 3];
      if (alpha < lo || alpha > hi) continue;
      n++; sumA += a.data[i + 1]; sumB += b.data[i + 1];
      if (a.data[i + 1] === b.data[i + 1]) same++;
    }
    console.log(JSON.stringify({ image: image.name, texels: n, meanGreenPng: +(sumB / n).toFixed(1), meanGreenGlb: +(sumA / n).toFixed(1), sameShare: +(same / n).toFixed(3) }));
  }
})();
