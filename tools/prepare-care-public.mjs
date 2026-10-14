import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readConfig } from '../experiences/synk-account/src/core.mjs';
import { signalPublicFiles, signalPublicHtml, SIGNAL_SOURCE, SIGNAL_DIR } from './lib/member-signal-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_FILES = ['index.html', 'style.css', 'app.mjs', 'model.mjs', 'lunar.mjs', 'care-features.mjs', 'care-sync.mjs', 'account.mjs', 'care-account-view.mjs', 'care-focus.mjs', 'care-context.mjs', 'care-push.mjs', 'care-sw.js', 'manifest.webmanifest', 'care-planner.mjs', 'care-personalization.mjs', 'care-support.mjs', 'care-followup.js', 'care-outcomes.mjs', 'memory-card.mjs', 'memory-theme.mjs', 'care-contact-import.mjs', 'care-signal-view.mjs', 'care-upcoming.mjs', 'care-today.mjs', 'care-ledger.mjs', 'care-amount.mjs', 'care-memorial.mjs', 'care-gift.mjs'];
const ASSETS = ['icon192.png', 'icon512.png', 'apple-touch-icon180.png', 'badge-check.webp', 'badge-cream.webp', 'InterTight-Bold.ttf', 'InterTight-LICENSE.txt', 'slab-blush-long.webp', 'slab-coral-long.webp', 'slab-cream-long.webp', 'sticker-check.webp', 'sticker-envelope.webp', 'sticker-person.webp', 'sticker-time.webp', 'SUIT-LICENSE.txt', 'SUIT-Variable.woff2', 'synk-logo.svg', 'thread-shift.webp', ...['letter', 'calendar', 'piggy', 'person', 'bell', 'flower', 'bubble', 'ribbon', 'care-note'].map(name => `art/${name}.webp`)];
const ENGINES = ['domain.js', 'ask.js', 'vellum-expression.js', 'temper-outcomes.js'];
const ACCOUNT_FILES = ['core.mjs', 'platform-entry.mjs', 'product-account.mjs', 'document-sync.mjs'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function versionPublicEntry(files) {
  const imports = Object.fromEntries([...files].filter(([name]) => /\.(?:mjs|js)$/.test(name))
    .map(([name, bytes]) => ['./' + name, './' + name + '?v=' + sha(bytes)]));
  const mapText = JSON.stringify({ imports });
  const mapHash = createHash('sha256').update(mapText).digest('base64');
  let html = files.get('index.html'), entries = 0, styles = 0;
  if (/<script\b[^>]*\btype=["']importmap["']/i.test(html)) throw Error('Unexpected existing public import map.');
  html = html.replace(/<script\b[^>]*>/gi, tag => {
    if (!/\btype=["']module["']/i.test(tag)) return tag;
    return tag.replace(/\bsrc=(["'])([^"']+)\1/i, (_match, quote, value) => {
      const name = value.replace(/^\.\//, ''), versioned = imports['./' + name];
      if (!versioned) throw Error('Unknown public module entry: ' + value);
      entries++; return 'src=' + quote + versioned + quote;
    });
  });
  html = html.replace(/<link\b[^>]*>/gi, tag => {
    if (!/\brel=["']stylesheet["']/i.test(tag)) return tag;
    return tag.replace(/\bhref=(["'])([^"']+)\1/i, (_match, quote, value) => {
      const name = value.replace(/^\.\//, '');
      if (!name.endsWith('.css') || !files.has(name)) throw Error('Unknown public stylesheet: ' + value);
      styles++; return 'href=' + quote + './' + name + '?v=' + sha(files.get(name)) + quote;
    });
  });
  if (!entries || !styles || !html.includes("script-src 'self';")) throw Error('Unexpected public entry or script policy.');
  // Import maps resolve normalized local URLs for both static imports and
  // dynamic import(). Pin dependencies without rewriting their source bytes.
  html = html.replace("script-src 'self';", `script-src 'self' 'sha256-${mapHash}';`)
    .replace(/<script\b(?=[^>]*\btype=["']module["'])[^>]*>/i, tag => `<script type="importmap">${mapText}</script>\n  ${tag}`);
  files.set('index.html', html);
}

async function destination(out, root) {
  const workspace = await fs.realpath(root), target = path.resolve(out), relative = path.relative(path.join(workspace, '.tmp'), target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Use a new output directory inside the workspace .tmp directory.');
  try { await fs.lstat(target); throw Error('Output already exists; use a new directory to preserve the previous build.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let parent = path.dirname(target);
  while (true) { try { parent = await fs.realpath(parent); break; } catch (error) { if (error.code !== 'ENOENT') throw error; parent = path.dirname(parent); } }
  const realRelative = path.relative(workspace, parent);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw Error('Output must not follow a link outside the workspace.');
  return target;
}

export async function prepareCarePublic({ out, config, targetUrl = 'https://synk.im/care/', root = ROOT } = {}) {
  if (!out || !config) throw Error('A new output directory and explicit public account configuration are required.');
  const target = new URL(targetUrl);
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash || !/^\/[a-z0-9][a-z0-9/-]*\/$/.test(target.pathname)) throw Error('The public app needs an exact HTTPS directory URL ending in a slash.');
  const checked = readConfig(config, target.href), client = checked.clients.care;
  if (!checked.configured || !client?.clientId || client.redirectUri !== target.href) throw Error('The care client must be explicitly registered for this exact public callback.');
  const publicConfig = { version: 1, supabaseUrl: checked.supabaseUrl, supabasePublishableKey: checked.supabasePublishableKey,
    accountApiUrl: checked.accountApiUrl, portalUrl: checked.portalUrl, clients: { care: { ...client } },
    authorizationClients: [{ product: 'platform', clientId: client.clientId, redirectUris: [target.href] }] };
  const output = await destination(out, root), appRoot = path.join(root, 'experiences/relationship-care'), files = new Map(), sources = [];
  async function add(relative, source, transform) {
    const bytes = await fs.readFile(path.join(root, source)); sources.push({ file: source.replaceAll('\\', '/'), sha256: sha(bytes) });
    files.set(relative, transform ? transform(bytes.toString('utf8')) : bytes);
  }
  for (const name of APP_FILES) await add(name, path.relative(root, path.join(appRoot, name)), text => {
    if (name === 'index.html') {
      if (!text.includes('<meta charset="utf-8">') || text.includes('synk-care-runtime')) throw Error('Unexpected public HTML entry.');
      // 2026-10-14 시그널 판: 공통 틀은 signal/ 아래 상대 경로로(테마 스크립트는 고전 스크립트로 남긴다).
      text = signalPublicHtml(text, { keepTheme: true });
      const origins = [...new Set([checked.supabaseUrl, checked.accountApiUrl].map(value => new URL(value).origin))].join(' ');
      const policy = `default-src 'self'; script-src 'self'; worker-src 'self'; manifest-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' ${origins}; object-src 'none'; base-uri 'none'; form-action 'self'`;
      text = text.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta name="synk-care-runtime" content="public-web">\n  <meta name="referrer" content="no-referrer">\n  <meta http-equiv="Content-Security-Policy" content="${policy}">`);
    }
    if (['account.mjs', 'care-sync.mjs'].includes(name)) {
      if (text.split("'../synk-account/src/").length !== 2) throw Error('Unexpected account module import: ' + name);
      text = text.replace("'../synk-account/src/", "'./vendor/account/");
    }
    if (['care-planner.mjs', 'care-support.mjs', 'care-outcomes.mjs', 'care-focus.mjs'].includes(name)) text = text.replaceAll("'../../atlas/", "'./vendor/atlas/");
    if (name === 'app.mjs') {
      if (text.split("'/member-signal/signal.mjs'").length !== 2) throw Error('Unexpected member signal import in app.mjs.');
      text = text.replace("'/member-signal/signal.mjs'", `'./${SIGNAL_DIR}/signal.mjs'`);
    }
    return text;
  });
  for (const name of ASSETS) await add('assets/' + name, 'experiences/relationship-care/assets/' + name);
  for (const name of ENGINES) await add('vendor/atlas/' + name, 'atlas/' + name);
  for (const name of ACCOUNT_FILES) await add('vendor/account/' + name, 'experiences/synk-account/src/' + name);
  for (const [name, file] of [...signalPublicFiles({ withTheme: true }), [`${SIGNAL_DIR}/signal.mjs`, `${SIGNAL_SOURCE}/signal.mjs`]]) await add(name, file);
  files.set('config.json', JSON.stringify(publicConfig, null, 2) + '\n');
  versionPublicEntry(files);
  // Only the fixed public graph is copied. No recursive source, user state, local config, server or QA copy.
  const manifest = { version: 1, product: 'care', targetUrl: target.href, sourceFiles: sources,
    files: [...files].map(([name, bytes]) => ({ name, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) })),
    limitations: { transcription: 'PC local app only', pushWhenClosed: 'Requires deployed push service, account opt-in, browser permission and supported device', realLoginVerified: false } };
  files.set('build-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  await destination(output, root); await fs.mkdir(output, { recursive: true });
  for (const [name, bytes] of files) { const file = path.join(output, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes, { flag: 'wx' }); }
  return { output, targetUrl: target.href, fileCount: files.size, totalBytes: [...files.values()].reduce((sum, bytes) => sum + Buffer.byteLength(bytes), 0), manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [out, configPath, targetUrl] = process.argv.slice(2);
  if (!out || !configPath) throw Error('Usage: node tools/prepare-care-public.mjs <new-.tmp-output> <public-config.json> [https://synk.im/care/]');
  const result = await prepareCarePublic({ out, config: JSON.parse(await fs.readFile(configPath, 'utf8')), ...(targetUrl ? { targetUrl } : {}) });
  console.log(JSON.stringify({ output: result.output, targetUrl: result.targetUrl, fileCount: result.fileCount, totalBytes: result.totalBytes }, null, 2));
}
