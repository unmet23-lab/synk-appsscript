import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readConfig, isLoopback } from '../experiences/synk-account/src/core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'experiences/path-app';
const ACCOUNT = 'experiences/synk-account/src';
export const PATH_PUBLIC_URL = 'https://synk.im/path/app/';
const LOCAL_URLS = new Set(['http://127.0.0.1:4326/', 'http://localhost:4326/']);
const ACCOUNT_MODULES = new Set(['core.mjs', 'product-account.mjs', 'document-sync.mjs', 'platform-entry.mjs']);
const FONTS = Object.freeze({
  'assets/SUIT-Variable.woff2': 'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2',
  'assets/InterTight.woff2': 'docs/브랜드_폰트/플랫폼_웹/InterTight-Regular.woff2',
  'assets/SUIT-LICENSE.txt': 'docs/브랜드_폰트/SUIT/LICENSE_OFL.txt',
  'assets/InterTight-LICENSE.txt': 'docs/브랜드_폰트/InterTight/OFL.txt',
  'assets/InterTight-Medium.woff2': 'docs/브랜드_폰트/플랫폼_웹/InterTight-Medium.woff2',
  'assets/InterTight-SemiBold.woff2': 'docs/브랜드_폰트/플랫폼_웹/InterTight-SemiBold.woff2',
  'assets/DMMono-Medium.woff2': 'docs/브랜드_폰트/플랫폼_웹/DMMono-Medium.woff2',
  'assets/DMMono-LICENSE.txt': 'docs/브랜드_폰트/DM_Mono/OFL.txt',
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = value => value.replaceAll('\\', '/');
let esbuild;
function builder() {
  if (!esbuild) { const require = createRequire(import.meta.url); esbuild = require(require.resolve('esbuild', { paths: [path.join(ROOT, 'experiences/synk-account')] })); }
  return esbuild;
}

/** Project only canonical browser-safe fields. Never copy the input file verbatim. */
export function validatePathConfig(raw, { targetUrl = PATH_PUBLIC_URL, local = false } = {}) {
  if (local ? !LOCAL_URLS.has(targetUrl) : targetUrl !== PATH_PUBLIC_URL) throw Error('PATH requires its exact registered callback URL.');
  const checked = readConfig(raw, targetUrl), client = checked.clients['path-app'];
  if (!checked.configured || typeof client?.clientId !== 'string' || !/^[a-zA-Z0-9_.-]{1,200}$/.test(client.clientId) || client.redirectUri !== targetUrl)
    throw Error('PATH needs an explicit path-app client for this exact callback.');
  for (const [name, entry] of Object.entries(raw.clients || {})) {
    if (!entry || typeof entry !== 'object' || Object.keys(entry).some(key => !['clientId', 'redirectUri'].includes(key))) throw Error('Only public OAuth client fields are allowed.');
    if (name !== 'path-app' && entry.clientId === client.clientId) throw Error('PATH requires its own client identity.');
  }
  const endpoint = (value, originOnly = false) => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || isLoopback(url.hostname) || url.username || url.password || url.search || url.hash || originOnly && url.pathname !== '/')
      throw Error('Account endpoints must be public HTTPS addresses without credentials or query.');
    return originOnly ? url.origin : url.href;
  };
  const key = checked.supabasePublishableKey;
  if (!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key) && !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(key)) throw Error('A public publishable or anon key is required.');
  return { version: 1, supabaseUrl: endpoint(checked.supabaseUrl, true), supabasePublishableKey: key,
    accountApiUrl: endpoint(checked.accountApiUrl, true), portalUrl: endpoint(checked.portalUrl),
    clients: { 'path-app': { clientId: client.clientId, redirectUri: targetUrl } },
    authorizationClients: [{ product: 'platform', clientId: client.clientId, redirectUris: [targetUrl] }] };
}

export function pathContentSecurityPolicy(config) {
  const connections = config ? `'self' ${[...new Set([new URL(config.supabaseUrl).origin, new URL(config.accountApiUrl).origin])].join(' ')}` : "'none'";
  return `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src ${connections}; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
}

async function readCanonical(file, workspace, sources) {
  const resolved = await fs.realpath(file);
  if (resolved !== path.resolve(file)) throw Error('Source must not follow a file or directory link.');
  const bytes = await fs.readFile(resolved), name = slash(path.relative(workspace, resolved)), digest = sha(bytes);
  if (sources.has(name) && sources.get(name) !== digest) throw Error('Source changed during build: ' + name);
  sources.set(name, digest);
  return bytes;
}

/** Both preview and public artifacts use this fully bundled dependency graph. */
export async function bundlePathApp({ root = ROOT, appRoot = path.join(root, APP) } = {}) {
  const workspace = await fs.realpath(root), application = await fs.realpath(appRoot), sources = new Map();
  const compiler = builder();
  const compiled = await compiler.build({ absWorkingDir: workspace, entryPoints: [path.join(application, 'app.mjs')], outfile: 'app.mjs',
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', charset: 'utf8', legalComments: 'eof', metafile: true, logLevel: 'silent',
    plugins: [{ name: 'path-public-module-boundary', setup(build) {
      build.onLoad({ filter: /.*/ }, async args => {
        const appName = path.relative(application, args.path), accountName = path.relative(path.join(workspace, ACCOUNT), args.path);
        const ownModule = /^[a-z][a-z0-9_-]*\.mjs$/i.test(appName) && !/^(?:server|.*\.test)\.mjs$/i.test(appName);
        if (!ownModule && !ACCOUNT_MODULES.has(accountName)) throw Error('Module outside the PATH source allowlist: ' + slash(path.relative(workspace, args.path)));
        return { contents: (await readCanonical(args.path, workspace, sources)).toString('utf8'), loader: 'js' };
      });
    } }],
  });
  if (compiled.outputFiles.length !== 1 || Object.values(compiled.metafile.outputs).some(output => output.imports.length)
      || /\bimport\s*\(/.test(compiled.outputFiles[0].text)) throw Error('PATH entry must bundle its complete module graph.');
  for (const [name, hash] of sources) if (sha(await fs.readFile(path.join(workspace, name))) !== hash) throw Error('Source changed during build: ' + name);
  return { bytes: compiled.outputFiles[0].contents, sources, esbuildVersion: compiler.version };
}

async function destination(out, workspace) {
  if (!out) throw Error('Choose a new output directory inside the workspace .tmp directory.');
  const target = path.resolve(out), relative = path.relative(path.join(workspace, '.tmp'), target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Use a new output directory inside the workspace .tmp directory.');
  try { await fs.lstat(target); throw Error('Output already exists; choose a new directory.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (let parent = path.dirname(target); parent !== workspace; parent = path.dirname(parent)) {
    try { if ((await fs.lstat(parent)).isSymbolicLink()) throw Error('Output must not follow a directory link.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}

function assetName(value, files) {
  const name = value.startsWith('./') ? value.slice(2) : value;
  if (!name || /^[/.]/.test(name) || /[?#\\%]/.test(name) || name.split('/').includes('..') || !files.has(name)) throw Error('Unknown or non-local PATH asset: ' + value);
  return name;
}

function publicCss(css, files) {
  if (/@import\b/i.test(css)) throw Error('External stylesheets are not allowed.');
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi;
  css = css.replace(/@font-face\s*\{[^}]*\}/gi, block => block.replace(urlPattern, (match, a, b, c) => {
    const value = a ?? b ?? c;
    const name = assetName(value.startsWith('/assets/') ? value.slice(1) : value, files);
    if (!name.endsWith('.woff2')) throw Error('Only approved bundled fonts may appear in @font-face.');
    return `url('./${name}')`;
  }));
  for (const match of css.matchAll(urlPattern)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value.startsWith('data:image/svg+xml,')) continue;
    assetName(value, files);
  }
  return css;
}

function publicHtml(html, files, config) {
  if (!html.includes('<meta charset="utf-8">') || /<(?:base|style|iframe|object)\b|\b(?:style|on[a-z]+)\s*=|http-equiv=["']Content-Security-Policy/i.test(html)) throw Error('Unexpected inline HTML or public policy.');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  if (scripts.length !== 1 || scripts[0][2].trim() || !/\btype="module"/.test(scripts[0][1]) || !/\bsrc="(?:\.\/)?app\.mjs"/.test(scripts[0][1])) throw Error('PATH must have one app.mjs module entry.');
  html = html.replace(/<([a-z][a-z0-9:-]*)\b([^>]*)>/gi, (tag, tagName, attrs) => {
    return tag.replace(/\b(src|href)=(['"])(.*?)\2/gi, (attribute, name, quote, value) => {
      if (value.startsWith('#')) return attribute;
      if (tagName.toLowerCase() === 'link' && /\brel=['"]icon['"]/i.test(attrs) && value.startsWith('data:image/svg+xml,')) return attribute;
      const file = assetName(value, files), token = /\.(?:mjs|css)$/.test(file) ? '?v=' + sha(files.get(file)) : '';
      return `${name}="./${file}${token}"`;
    });
  });
  return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta name="synk-path-runtime" content="public-web">\n<meta name="referrer" content="no-referrer">\n<meta http-equiv="Content-Security-Policy" content="${pathContentSecurityPolicy(config)}">`);
}

/** Produce a new isolated candidate only. Registration and deployment are separate. */
export async function preparePathAppPublic({ out, config, targetUrl = PATH_PUBLIC_URL, root = ROOT } = {}) {
  const publicConfig = validatePathConfig(config, { targetUrl });
  const workspace = await fs.realpath(root), output = await destination(out, workspace);
  const compiled = await bundlePathApp({ root: workspace }), sources = compiled.sources, files = new Map([['app.mjs', compiled.bytes]]);
  for (const [name, source] of Object.entries(FONTS)) files.set(name, await readCanonical(path.join(workspace, source), workspace, sources));
  const css = (await readCanonical(path.join(workspace, APP, 'styles.css'), workspace, sources)).toString('utf8');
  files.set('styles.css', publicCss(css, files));
  files.set('config.json', JSON.stringify(publicConfig, null, 2) + '\n');
  const html = (await readCanonical(path.join(workspace, APP, 'index.html'), workspace, sources)).toString('utf8');
  files.set('index.html', publicHtml(html, files, publicConfig));
  for (const [name, hash] of sources) if (sha(await fs.readFile(path.join(workspace, name))) !== hash) throw Error('Source changed during build: ' + name);
  const manifest = { version: 1, product: 'path-app', targetUrl, configFile: 'config.json',
    builder: { file: 'tools/prepare-path-app-public.mjs', sha256: sha(await fs.readFile(fileURLToPath(import.meta.url))), esbuildVersion: compiled.esbuildVersion },
    sourceFiles: [...sources].sort(([a], [b]) => a.localeCompare(b)).map(([file, sha256]) => ({ file, sha256 })),
    files: [...files].map(([name, bytes]) => ({ name, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) })),
    transformations: ['bundle complete PATH and canonical account module graph', 'relative approved font assets', 'self-only script and style CSP, configured account origins', 'entry cache tokens'],
    limitations: { registrationVerified: false, realLoginVerified: false, browserVerified: false, deployed: false } };
  files.set('build-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  await destination(output, workspace); await fs.mkdir(path.dirname(output), { recursive: true });
  await destination(output, workspace); await fs.mkdir(output);
  for (const [name, bytes] of files) { const file = path.join(output, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes, { flag: 'wx' }); }
  return { output, product: 'path-app', targetUrl, fileCount: files.size, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [out, configFile, ...extra] = process.argv.slice(2);
  if (!out || !configFile || extra.length) throw Error('Usage: node tools/prepare-path-app-public.mjs <new-workspace-.tmp-output> <explicit-public-config.json>');
  const { manifest, ...result } = await preparePathAppPublic({ out, config: JSON.parse(await fs.readFile(configFile, 'utf8')) });
  console.log(JSON.stringify(result, null, 2));
}
