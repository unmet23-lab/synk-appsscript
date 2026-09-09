// PDF 원본은 보존하고 독립 검수 폴더의 렌더 페이지로 접촉시트만 만든다.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async () => {
  const list = fs.readdirSync(__dirname).filter(n => /-[0-9]+\.png$/.test(n));
  const groups = new Map();
  for (const file of list) {
    const key = file.replace(/-[0-9]+\.png$/, '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  for (const [name, files] of groups) {
    files.sort((a, b) => Number(a.match(/-(\d+)\.png$/)[1]) - Number(b.match(/-(\d+)\.png$/)[1]));
    const width = 620, height = 878, gap = 12;
    const composites = [];
    for (let i = 0; i < files.length; i++) composites.push({ input: await sharp(path.join(__dirname, files[i])).resize({ width, height, fit: 'contain', background: '#FBF7F0' }).png().toBuffer(), left: (i % 2) * (width + gap), top: Math.floor(i / 2) * (height + gap) });
    const out = path.join(__dirname, `${name}__contact.png`);
    await sharp({ create: { width: width * 2 + gap, height: Math.ceil(files.length / 2) * (height + gap) - gap, channels: 3, background: '#C7BFB2' } }).composite(composites).png().toFile(out);
    console.log(JSON.stringify({ file: out, pages: files.length }));
  }
})();
