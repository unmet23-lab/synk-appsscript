#!/usr/bin/env node
// Prepares the SYNK ID central page for synk.im from this repository's portal build.
//   node tools/synk-id/prepare-portal.mjs production <out>   → https://synk.im/id/          (Synk Core)
//   node tools/synk-id/prepare-portal.mjs rehearsal  <out>   → https://synk.im/id-rehearsal/ (synk-core-rehearsal)
// Build first: node tools/build-synk-account.js. Only the files the page uses go out, with the shared
// learning bundle beside it (vendor/), the site's icons, noindex, and a config.json of public values
// (project address and publishable key from talk's committed eas.json, the public OAuth clients of lib.js).
// Then copy <out> into synk-policy's id/ (or id-rehearsal/) from origin/main and compare bytes after pushing.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { TALK_ROOT, CLIENTS, TOOL_REDIRECTS } = require('./lib.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'experiences', 'synk-account');
const [TARGET, OUT] = process.argv.slice(2);
const TARGETS = {
  production: { portal: 'https://synk.im/id/', profile: 'production', ref: 'qiwxeddwwnzkwalpsuty', title: '' },
  rehearsal: { portal: 'https://synk.im/id-rehearsal/', profile: 'preview', ref: 'baasvefzinrxaryksayl', title: ' · 리허설' },
};
const target = TARGETS[TARGET];
if (!target || !OUT) throw new Error('usage: prepare-portal.mjs production|rehearsal <out>');
fs.rmSync(OUT, { recursive: true, force: true });
for (const dir of ['assets', 'dist', 'vendor']) fs.mkdirSync(path.join(OUT, dir), { recursive: true });

for (const file of ['scrapbook.css', 'InterTight-700.woff2', 'SUIT-Variable.woff2', 'badge-check.webp', 'badge-cream.webp',
  'slab-coral-long.webp', 'slab-cream-long.webp', 'sticker-book.webp', 'thread-shift.webp']) fs.copyFileSync(path.join(SRC, 'assets', file), path.join(OUT, 'assets', file));
const style = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');
if (!style.includes(".sb-stitch{border-image-source:url('./assets/thread-shift.webp')}")) throw new Error('style.css lacks the thread path fix (5b85df9b2)');
fs.writeFileSync(path.join(OUT, 'style.css'), style);
fs.copyFileSync(path.join(SRC, 'dist', 'app.js'), path.join(OUT, 'dist', 'app.js'));
fs.copyFileSync(path.join(ROOT, 'experiences', 'learning-hub', 'atlas-learning.js'), path.join(OUT, 'vendor', 'atlas-learning.js'));

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const swap = (from, to, count) => { const n = html.split(from).length - 1; if (n !== count) throw new Error(`expected ${count}x ${from}, found ${n}`); html = html.split(from).join(to); };
// The site's own icons (SYNK-website favicon-links.mjs), so the browser does not ask for a missing one.
const icons = [16, 32, 48].map(size => `<link rel="icon" type="image/png" sizes="${size}x${size}" href="/assets/favicon-synk-20260919-${size}.png">`).join('\n')
  + '\n<link rel="icon" type="image/svg+xml" sizes="any" media="(prefers-color-scheme: dark)" href="/assets/favicon-synk-dark-20260919.svg">';
swap('<meta name="referrer" content="no-referrer">', `<meta name="referrer" content="no-referrer">\n<meta name="robots" content="noindex,nofollow">\n${icons}`, 1);
swap('src="../learning-hub/atlas-learning.js"', 'src="./vendor/atlas-learning.js"', 1);
// The platform and WORLD web pages are not published here; the header leads back to the company site.
swap('<nav><a href="./platform.html">플랫폼</a><a href="./client.html?product=world">WORLD</a></nav>', '<nav><a href="https://synk.im/">synk.im</a></nav>', 1);
swap('<a class="brand" href="./platform.html">', '<a class="brand" href="./">', 1);
swap('href="../learning-hub/"', 'href="https://synk.im/"', html.split('href="../learning-hub/"').length - 1);
if (target.title) html = html.replace(/<title>([^<]*)<\/title>/, (_, t) => `<title>${t}${target.title}</title>`);
if (!html.includes('id="signup-choices"') || !html.includes('https://synk.im/privacy/#synk-id')) throw new Error('the sign-up choices are missing from this build');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

const eas = JSON.parse(execFileSync('git', ['show', 'HEAD:eas.json'], { cwd: TALK_ROOT, encoding: 'utf8' }));
const env = eas.build[target.profile].env, clients = CLIENTS[TARGET];
if (env.EXPO_PUBLIC_SYNK_WORLD_OAUTH_CLIENT_ID !== clients.world) throw new Error(`the ${TARGET} app is built with another WORLD client than lib.js`);
const config = {
  version: 1,
  supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  portalUrl: target.portal,
  learningUrl: 'https://synk.im/',
  authorizationClients: [{ product: 'world', clientId: clients.world, redirectUris: ['synktalk://oauth/callback'] },
    ...(clients.tools ? [{ product: 'platform', clientId: clients.tools, redirectUris: [...TOOL_REDIRECTS] }] : [])],
  clients: { platform: { clientId: '', redirectUri: '' }, world: { clientId: '', redirectUri: '' }, messenger: { clientId: '', redirectUri: '' } },
};
if (!config.supabaseUrl.includes(target.ref) || !config.supabasePublishableKey.startsWith('sb_publishable_')) throw new Error(`not the ${TARGET} public values`);
const { readConfig } = await import(pathToFileURL(path.join(SRC, 'src', 'core.mjs')).href);
const checked = readConfig(config, target.portal);
if (!checked.configured) throw new Error('config not complete');
fs.writeFileSync(path.join(OUT, 'config.json'), JSON.stringify(config, null, 2) + '\n');
const files = [];
const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(OUT, p).split(path.sep).join('/')); } };
walk(OUT);
console.log(`${TARGET}: prepared ${files.length} files in ${OUT}`);
console.log(`config ok: portal=${checked.portalUrl}, clients=${checked.authorizationClients.length}`);
