#!/usr/bin/env node
// Prepare only the central SYNK ID page. Build first with tools/build-synk-account.js.
// --current is a fresh published config snapshot; --config adds verified consent
// registrations only. Existing fields and published callbacks remain unchanged.
// The destination must be new or empty. Existing output is never deleted or replaced.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { LEGACY_CLIENT_IDS: CLIENTS, TOOL_REDIRECTS, SERVICES } = require('./registry.cjs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TALK_ROOT = process.env.SYNK_TALK_ROOT || path.resolve(ROOT, '../SYNK-talk');
export const TARGETS = Object.freeze({
  production: { portal: 'https://synk.im/id/', profile: 'production', ref: 'qiwxeddwwnzkwalpsuty', title: '' },
  rehearsal: { portal: 'https://synk.im/id-rehearsal/', profile: 'preview', ref: 'baasvefzinrxaryksayl', title: ' · 리허설' },
});
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
const comparePath = value => process.platform === 'win32' ? value.toLowerCase() : value;
const samePath = (a, b) => comparePath(path.resolve(a)) === comparePath(path.resolve(b));
const inside = (parent, candidate) => { const relative = path.relative(comparePath(path.resolve(parent)), comparePath(path.resolve(candidate))); return !relative || relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };

function checkDestination(out, root) {
  if (typeof out !== 'string' || !out.trim()) fail('A new or empty output directory is required.');
  const target = path.resolve(out), source = path.join(root, 'experiences/synk-account');
  if (inside(target, root) || inside(target, source) || inside(source, target) || inside(path.join(root, '.git'), target)) fail('Output cannot be a repository root, source directory or their ancestor.');
  // Reject junctions/symlinks at every existing component, not only the leaf.
  for (let current = target;; current = path.dirname(current)) {
    try { const stat = fs.lstatSync(current); if (stat.isSymbolicLink()) fail('Output cannot pass through a symbolic link or junction.'); if (!stat.isDirectory()) fail('Output must be a directory.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (samePath(current, path.dirname(current))) break;
  }
  if (fs.existsSync(target) && fs.readdirSync(target).length) fail('Output already contains files. Choose a new or empty directory; nothing was deleted.');
  return target;
}

function legacyConfig(targetName, environment) {
  const target = TARGETS[targetName], clients = CLIENTS[targetName];
  return { version: 1, supabaseUrl: environment.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: environment.EXPO_PUBLIC_SUPABASE_ANON_KEY, portalUrl: target.portal, learningUrl: 'https://synk.im/',
    authorizationClients: [{ product: 'world', clientId: clients.world, redirectUris: ['synktalk://oauth/callback'] },
      ...(clients.tools ? [{ product: 'platform', clientId: clients.tools, redirectUris: [...TOOL_REDIRECTS] }] : [])],
    clients: { platform: { clientId: '', redirectUri: '' }, world: { clientId: '', redirectUri: '' }, messenger: { clientId: '', redirectUri: '' } } };
}

export async function validatePortalConfig(value, { targetName, environment, sourceRoot = ROOT }) {
  const target = TARGETS[targetName], clients = CLIENTS[targetName];
  if (!target || !object(environment)) fail('Unknown portal environment.');
  const expectedOrigin = `https://${target.ref}.supabase.co`;
  if (environment.EXPO_PUBLIC_SUPABASE_URL !== expectedOrigin || environment.EXPO_PUBLIC_SYNK_WORLD_OAUTH_CLIENT_ID !== clients.world
    || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(environment.EXPO_PUBLIC_SUPABASE_ANON_KEY || '')) fail('Committed public environment does not match the selected portal.');
  if (!object(value) || value.supabaseUrl !== expectedOrigin || (value.accountApiUrl || expectedOrigin) !== expectedOrigin
    || value.portalUrl !== target.portal || value.supabasePublishableKey !== environment.EXPO_PUBLIC_SUPABASE_ANON_KEY) fail('Public configuration origin, key or portal does not match the selected environment.');
  const { readConfig } = await import(pathToFileURL(path.join(sourceRoot, 'experiences/synk-account/src/core.mjs')).href);
  const checked = readConfig(value, target.portal);
  if (!checked.configured || !object(value.clients) || Object.keys(value.clients).some(product => !Object.hasOwn(checked.clients, product)) || !Array.isArray(value.authorizationClients)) fail('Portal public configuration is incomplete.');
  const registrations = new Map();
  for (const client of value.authorizationClients) {
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(client.clientId) || !client.redirectUris.length || new Set(client.redirectUris).size !== client.redirectUris.length || registrations.has(client.clientId)) fail('Consent registrations require unique client IDs and callback lists.');
    registrations.set(client.clientId, client);
  }
  for (const [product, client] of Object.entries(value.clients)) {
    if (!client.clientId && !client.redirectUri) continue;
    const registered = registrations.get(client.clientId);
    const apiProduct = SERVICES.find(service => service.id === product)?.product || product;
    if (!registered || registered.product !== apiProduct || !registered.redirectUris.includes(client.redirectUri)) fail('Browser client must match its consent registration and product.');
  }
  for (const legacy of legacyConfig(targetName, environment).authorizationClients) {
    const registered = registrations.get(legacy.clientId);
    if (!registered || registered.product !== legacy.product || legacy.redirectUris.some(uri => !registered.redirectUris.includes(uri))) fail('Existing legacy consent registrations must be preserved.');
  }
  return structuredClone(value);
}

const publicEnvironment = (targetName, talkRoot) => {
  const eas = JSON.parse(execFileSync('git', ['show', 'HEAD:eas.json'], { cwd: talkRoot, encoding: 'utf8' }));
  return eas.build[TARGETS[targetName].profile].env;
};

export async function mergePortalConfig(current, candidate, options) {
  const preserved = await validatePortalConfig(current, options), proposed = await validatePortalConfig(candidate, options);
  const merged = structuredClone(preserved), byId = new Map(merged.authorizationClients.map(client => [client.clientId, client]));
  for (const client of proposed.authorizationClients) {
    const existing = byId.get(client.clientId);
    if (existing) {
      if (existing.product !== client.product) fail('Existing consent product cannot be changed.');
      existing.redirectUris = [...new Set([...existing.redirectUris, ...client.redirectUris])];
    } else { const added = structuredClone(client); merged.authorizationClients.push(added); byId.set(added.clientId, added); }
  }
  // Never adopt browser settings, keys, links or other fields from the candidate.
  return validatePortalConfig(merged, options);
}

// Compatibility of the existing published id/id-rehearsal bundles at c544810.
// New source capabilities cannot silently enter a config-only deployment.
function validatePublishedContract(config) {
  const products = new Set(['platform', 'world', 'messenger']);
  const schemes = new Set(['https:', 'http:', 'synktalk:', 'im.synk.platform:', 'im.synk.world:', 'im.synk.messenger:']);
  if (Object.keys(config.clients).some(product => !products.has(product))
    || config.authorizationClients.some(client => !products.has(client.product) || client.redirectUris.some(uri => !schemes.has(new URL(uri).protocol)))) fail('Config-only output exceeds the existing published portal contract. Review and release the matching portal bundle separately.');
}

export async function preparePortal({ targetName, out, configPath, currentPath, configOnly = false, root = ROOT, talkRoot = TALK_ROOT, loadPublicEnvironment = publicEnvironment }) {
  const target = TARGETS[targetName];
  if (!target || !configPath || !currentPath) fail('usage: prepare-portal.mjs production|rehearsal <new-output> --current=published-config.json --config=public-config.json [--config-only]');
  const workspace = fs.realpathSync(root), destination = checkDestination(out, workspace), source = path.join(workspace, 'experiences/synk-account');
  const environment = loadPublicEnvironment(targetName, talkRoot);
  const config = await mergePortalConfig(JSON.parse(fs.readFileSync(path.resolve(currentPath), 'utf8')), JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf8')), { targetName, environment, sourceRoot: workspace });
  if (configOnly) validatePublishedContract(config);
  // Assemble and validate all inputs before creating any output.
  const files = new Map();
  if (!configOnly) {
  for (const file of ['scrapbook.css', 'InterTight-700.woff2', 'SUIT-Variable.woff2', 'badge-check.webp', 'badge-cream.webp', 'slab-coral-long.webp', 'slab-cream-long.webp', 'sticker-book.webp', 'thread-shift.webp']) files.set(`assets/${file}`, fs.readFileSync(path.join(source, 'assets', file)));
  const style = fs.readFileSync(path.join(source, 'style.css'), 'utf8');
  if (!style.includes(".sb-stitch{border-image-source:url('./assets/thread-shift.webp')}")) fail('style.css lacks the thread path fix.');
  files.set('style.css', style);files.set('dist/app.js', fs.readFileSync(path.join(source, 'dist/app.js')));
  files.set('vendor/atlas-learning.js', fs.readFileSync(path.join(workspace, 'experiences/learning-hub/atlas-learning.js')));
  let html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
  const swap = (from, to, count) => { const actual = html.split(from).length - 1;if (actual !== count) fail(`expected ${count}x ${from}, found ${actual}`);html = html.split(from).join(to); };
  const icons = [16, 32, 48].map(size => `<link rel="icon" type="image/png" sizes="${size}x${size}" href="/assets/favicon-synk-20260919-${size}.png">`).join('\n')
    + '\n<link rel="icon" type="image/svg+xml" sizes="any" media="(prefers-color-scheme: dark)" href="/assets/favicon-synk-dark-20260919.svg">';
  swap('<meta name="referrer" content="no-referrer">', `<meta name="referrer" content="no-referrer">\n<meta name="robots" content="noindex,nofollow">\n${icons}`, 1);
  swap('src="../learning-hub/atlas-learning.js"', 'src="./vendor/atlas-learning.js"', 1);
  swap('<nav><a href="./platform.html">플랫폼</a><a href="./client.html?product=world">WORLD</a></nav>', '<nav><a href="https://synk.im/">synk.im</a></nav>', 1);
  swap('<a class="brand" href="./platform.html">', '<a class="brand" href="./">', 1);
  swap('href="../learning-hub/"', 'href="https://synk.im/"', html.split('href="../learning-hub/"').length - 1);
  if (target.title) html = html.replace(/<title>([^<]*)<\/title>/, (_, title) => `<title>${title}${target.title}</title>`);
  if (!html.includes('id="signup-choices"') || !html.includes('https://synk.im/privacy/#synk-id')) fail('The sign-up choices are missing from this build.');
  files.set('index.html', html);
  }
  files.set('config.json', JSON.stringify(config, null, 2) + '\n');
  checkDestination(destination, workspace);
  fs.mkdirSync(destination, { recursive: true });
  for (const [relative, content] of files) {
    const file = path.join(destination, relative);fs.mkdirSync(path.dirname(file), { recursive: true });fs.writeFileSync(file, content, { flag: 'wx' });
  }
  return { target: targetName, output: destination, files: [...files.keys()], portal: config.portalUrl, clients: config.authorizationClients.length };
}

export function parseArguments(args) {
  const [targetName, out, ...options] = args;
  const values = {};
  for (const option of options) {
    const key = option.startsWith('--config=') ? 'configPath' : option.startsWith('--current=') ? 'currentPath' : option === '--config-only' ? 'configOnly' : '';
    if (!key || Object.hasOwn(values, key)) fail('usage: require one --current and one --config; optional --config-only');
    values[key] = key === 'configOnly' ? true : option.slice(option.indexOf('=') + 1);
  }
  if (!TARGETS[targetName] || !out || out.startsWith('--') || !values.configPath || !values.currentPath) fail('usage: prepare-portal.mjs production|rehearsal <new-output> --current=published-config.json --config=public-config.json [--config-only]');
  return { targetName, out, ...values };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const result = await preparePortal(parseArguments(process.argv.slice(2)));console.log(`${result.target}: prepared ${result.files.length} files in ${result.output}`);console.log(`config ok: portal=${result.portal}, clients=${result.clients}`); }
  catch (error) { console.error(error.message);process.exitCode = 1; }
}
