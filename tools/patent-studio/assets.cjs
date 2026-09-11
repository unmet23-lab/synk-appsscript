'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../..');
const fonts = path.join(repo, 'docs/브랜드_폰트');
const sources = {
  'suit.woff2': path.join(fonts, 'SUIT/SUIT-Variable.woff2'),
  'inter-tight.ttf': path.join(fonts, 'InterTight/InterTight-Medium.ttf'),
  'inter-tight-bold.ttf': path.join(fonts, 'InterTight/InterTight-Bold.ttf'),
  'inter-tight-semibold.ttf': path.join(fonts, 'InterTight/InterTight-SemiBold.ttf'),
  'dm-mono.ttf': path.join(fonts, 'DM_Mono/DMMono-Medium.ttf'),
  'bracket.ttf': path.join(fonts, 'SYNKBracket/SYNKBracket-Regular.ttf'),
  'tokens.css': path.join(repo, 'docs/tools/synk-tokens.css')
};
async function buildAssets() {
  const out = path.join(__dirname, 'public/assets');
  fs.mkdirSync(out, {
    recursive: true
  });
  const manifest = [];
  for (const [name, source] of Object.entries(sources)) {
    fs.copyFileSync(source, path.join(out, name));
    manifest.push({
      name,
      source: path.relative(repo, source),
      sha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')
    });
  }
  const loom = require('../lib/loom.js').css({
    지면: '밝은부품',
    범위: '.loom',
    천: null
  });
  fs.writeFileSync(path.join(out, 'loom.css'), loom);
  manifest.push({
    name: 'loom.css',
    source: 'tools/lib/loom.js',
    sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, 'tools/lib/loom.js'))).digest('hex'),
    sha256: crypto.createHash('sha256').update(loom).digest('hex')
  });
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    const p = path.join(process.env.USERPROFILE ?? '', '\.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
    sharp = require(p);
  }
  const images = {
    'logo.webp': path.join(repo, 'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-LAB-Ink.png'),
    'mascot.webp': require('../lib/마스코트자산.js').절대경로('궁금함')
  };
  for (const [name, source] of Object.entries(images)) {
    await sharp(source).resize({
      width: name === 'logo.webp' ? 640 : 460,
      withoutEnlargement: true
    }).webp({
      quality: 92
    }).toFile(path.join(out, name));
    manifest.push({
      name,
      source: path.relative(repo, source),
      sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),
      sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(out, name))).digest('hex')
    });
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({
    builtAt: new Date().toISOString(),
    manifest
  }, null, 2));
  return manifest;
}
module.exports = {
  buildAssets
};
if (require.main === module) buildAssets().then(x => console.log('승인 자산 준비: ' + x.length)).catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
