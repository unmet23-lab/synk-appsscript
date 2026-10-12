#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2), check = args.includes('--check');
const option = (name, fallback) => { const i = args.indexOf(name);return i < 0 ? fallback : path.resolve(args[i + 1]); };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--check') continue;
  if (!['--talk-root', '--source-root'].includes(args[i]) || !args[++i]) throw new Error('Usage: build-synk-account.js [--check] [--talk-root path] [--source-root path]');
}
const sourceRoot = option('--source-root', root), talkRoot = option('--talk-root', path.resolve(root, '../SYNK-talk'));
const dir = path.join(root, 'experiences/synk-account'), hashes = {};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
// Text (code, styles, markup, the manifest) is written, compared and hashed with LF line ends, so a
// checkout that turns them into CRLF builds and verifies the same as one that does not.
const TEXT = /\.(cjs|js|css|svg|html|json)$/;
const bytesOf = (relative, content) => (TEXT.test(relative) ? Buffer.from(Buffer.from(content).toString('utf8').replace(/\r\n/g, '\n')) : Buffer.from(content));
function output(relative, content) {
  const bytes = bytesOf(relative, content), target = path.join(dir, relative);
  const same = () => fs.existsSync(target) && bytesOf(relative, fs.readFileSync(target)).equals(bytes);
  if (check) { if (!same()) throw new Error(`Stale portal artifact: ${relative}`); }
  else if (!same()) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Replace complete output rather than truncating a file a running preview may
    // have open. An interrupted build retains the previous complete artifact.
    const temporary = `${target}.build-${process.pid}-${crypto.randomUUID()}.tmp`;
    try { fs.writeFileSync(temporary, bytes, { flag: 'wx' });fs.renameSync(temporary, target); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  hashes[relative] = sha(bytes);
}
output('src/generated/account-client.cjs', fs.readFileSync(path.join(talkRoot, 'lib/synk-account-client.js')));
output('src/generated/world-learning-host.cjs', fs.readFileSync(path.join(sourceRoot, 'account/world-learning-host.js')));
for (const file of ['SUIT-Variable.woff2', 'InterTight-700.woff2', 'scrapbook.css', 'sticker-book.webp', 'thread-shift.webp']) output(`assets/${file}`, fs.readFileSync(path.join(sourceRoot, 'experiences/learning-hub/assets', file)));
for (const file of ['slab-coral-long.webp', 'slab-cream-long.webp', 'chip-blush-long.webp', 'badge-cream.webp', 'badge-check.webp']) output(`assets/${file}`, fs.readFileSync(path.join(sourceRoot, 'docs/디자인/펠트부품/assets/ui', file)));
output('assets/tex-blush.webp', fs.readFileSync(path.join(sourceRoot, 'docs/디자인/펠트부품/assets/ui/tex-blush.webp')));
// 플랫폼 글꼴: SUIT를 화면 글자·나머지 두 조각(SYNK Sans), 화살표 네 글자 조각, TTF의 WOFF2(tools/build-platform-fonts.py).
for (const file of ['SYNKSans-ui.woff2', 'SYNKSans-rest.woff2', 'SYNKArrow.woff2', 'InterTight-Regular.woff2', 'InterTight-Medium.woff2', 'DMMono-Medium.woff2']) output(`assets/${file}`, fs.readFileSync(path.join(sourceRoot, 'docs/브랜드_폰트/플랫폼_웹', file)));
// 플랫폼 카드(235px)·상세(453px)에는 800px 사본이면 고해상도 화면에서도 같아 보인다(168KB→99KB).
output('assets/path-vr-felt.webp', fs.readFileSync(path.join(sourceRoot, 'experiences/path-vr/assets/path-vr-felt-800.webp')));
for (const file of ['studio-camera.webp', 'wide-lapis.webp', 'wide-butter.webp']) output(`assets/member/${file}`, fs.readFileSync(path.join(sourceRoot, 'desktop/assets/launcher', file)));
// 회원 혜택 그림 세 장은 웹에서 보이는 크기에 맞춘 판이다(이름·형식 그대로, 데스크톱 앱은 원본을 쓴다).
for (const file of ['care-note.webp', 'fortune-star.avif', 'teacher-cover.png']) output(`assets/member/${file}`, fs.readFileSync(path.join(sourceRoot, 'docs/디자인/플랫폼_시그널/웹그림', file)));
for (const file of ['laptop-felt.webp', 'sticker-search.webp', 'sticker-person.webp']) output(`assets/${file}`, fs.readFileSync(path.join(sourceRoot, 'docs/마케팅/맞춤도구/assets', file)));
output('assets/synk-logo.svg', fs.readFileSync(path.join(sourceRoot, 'docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg')));
for (const id of ['platform', 'world']) output(`assets/app-${id}.png`, fs.readFileSync(path.join(sourceRoot, `desktop/assets/${id}.png`)));
for (const [source, name] of [['InterTight/InterTight-Regular.ttf', 'InterTight-Regular.ttf'], ['InterTight/InterTight-Medium.ttf', 'InterTight-Medium.ttf'], ['DM_Mono/DMMono-Medium.ttf', 'DMMono-Medium.ttf']]) output(`assets/${name}`, fs.readFileSync(path.join(sourceRoot, 'docs/브랜드_폰트', source)));
const esbuild = require(require.resolve('esbuild', { paths: [dir] }));
const entries = ['app', 'client', 'preview', 'platform', 'local-world', 'teacher'];
for (const name of entries) { const entry = name;
  const built = esbuild.buildSync({ absWorkingDir: dir, entryPoints: [`src/${entry}.mjs`], bundle: true, write: false, platform: 'browser', format: 'iife', target: ['es2022'], charset: 'utf8', minifyWhitespace: true,
    banner: { js: '// Generated by tools/build-synk-account.js. Public configuration is fetched at runtime; no environment files are read.' } });
  output(`dist/${name}.js`, built.outputFiles[0].contents);
}
const preview = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace('./dist/app.js', './dist/preview.js').replace('<title>SYNK ID', '<title>합성 화면 예시 · SYNK ID');
output('preview.html', preview);
output('build-manifest.json', JSON.stringify({ version: 1, sdk: JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).dependencies['@supabase/supabase-js'], sha256: hashes }, null, 2) + '\n');
console.log(`${check ? 'Verified' : 'Built'} SYNK account portal: ${entries.length} bundles, public assets, source copies, preview and manifest.`);
