// Screen difference of a compressed variant against its WebP-2048 baseline.
//   NODE_PATH=<repo>/desktop/node_modules node diff-shots.cjs <capturesDir> <v20Dir> <baseline> <variant>[,<variant>…] > out.json
// For each view: mean |Δ| (0–255, RGB) over the pixels where the baked district
// is on screen (baseline differs from v20 by more than 6), the share of those
// pixels that moved by more than 10, and PSNR over the same pixels. The UI
// overlays sit in the same place in every shot, so they cancel out.
const fs = require('node:fs'), path = require('node:path');
const sharp = require('sharp');
const [dir, v20Dir, baseline, list] = process.argv.slice(2);
const raw = async file => (await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
(async () => {
  const out = {};
  for (const variant of list.split(',')) {
    out[variant] = {};
    for (const file of fs.readdirSync(path.join(dir, baseline)).filter(f => f.endsWith('.png'))) {
      const view = file.slice(baseline.length + 1, -4);
      const v = path.join(dir, variant, `${variant}-${view}.png`), v20 = path.join(v20Dir, `v20-${view}.png`);
      if (!fs.existsSync(v) || !fs.existsSync(v20)) continue;
      const [a, b, c] = await Promise.all([raw(path.join(dir, baseline, file)), raw(v), raw(v20)]);
      let n = 0, sum = 0, sq = 0, moved = 0;
      for (let i = 0; i < a.data.length; i += 3) {
        const district = Math.abs(a.data[i] - c.data[i]) + Math.abs(a.data[i + 1] - c.data[i + 1]) + Math.abs(a.data[i + 2] - c.data[i + 2]) > 18;
        if (!district) continue;
        n++;
        let d = 0; for (let k = 0; k < 3; k++) { const e = a.data[i + k] - b.data[i + k]; d += Math.abs(e); sq += e * e; }
        sum += d / 3; if (d / 3 > 10) moved++;
      }
      const mse = n ? sq / (n * 3) : 0;
      out[variant][view] = { pixels: n, meanAbs: +(sum / Math.max(1, n)).toFixed(2), movedShare: +(moved / Math.max(1, n)).toFixed(4), psnr: mse ? +(10 * Math.log10(255 * 255 / mse)).toFixed(1) : null };
    }
  }
  console.log(JSON.stringify(out, null, 1));
})();
