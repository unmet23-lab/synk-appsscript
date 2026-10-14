import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readConfig, isLoopback } from '../experiences/synk-account/src/core.mjs';
import { signalPublicFiles, signalPublicHtml, cssUrlTargets, SIGNAL_SOURCE } from './lib/member-signal-public.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const esbuild = require(require.resolve('esbuild', { paths: [path.join(ROOT, 'experiences/synk-account')] }));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const COMMON = ['core', 'platform-entry', 'account-notebook', 'product-account', 'document-sync', 'personal-data', 'personal-media', 'platform-library-data'].map(name => `experiences/synk-account/src/${name}.mjs`);
const TRAVEL_VALIDATOR = [
  ...['planner-account', 'planner-storage', 'planner-feedback', 'planner', 'places-v2', 'real-guide', 'real-places', 'real-conditions'].map(name => `experiences/path-travel/${name}.mjs`),
  ...['domain', 'travel', 'trail-life', 'temper-outcomes'].map(name => `atlas/${name}.js`),
];
const PRODUCTS = {
  fortune: {
    app: 'experiences/daily-fortune', client: 'platform', config: 'account-config.json', target: 'https://synk.im/fortune/',
    modules: ['app', 'core', 'saju-core', 'insights', 'account', 'account-state', 'kit/josa', 'vendor/lunar-javascript-1.7.7/lunar', 'fortune-base', 'daily', 'flow', 'compat', 'tarot', 'year', 'me'],
    // 2026-10-14 시그널 판: 화면마다 다른 펠트 물건(assets/art), 글꼴·로고는 공통 signal/ 묶음.
    assets: ['sun', 'calendar', 'moon', 'heart', 'sparkle', 'firework', 'star', 'crown', 'shooting'].map(name => `art/${name}.webp`),
    media: "'none'",
  },
  rehearsal: {
    app: 'experiences/conversation-rehearsal', client: 'rehearsal', config: 'config.json', target: 'https://synk.im/rehearsal/',
    modules: ['app', 'domain', 'storage', 'book', 'coach', 'voice'],
    assets: ['podium.webp', 'bubble.webp', 'quote.webp', 'trophy.webp', 'thought.webp', 'stamp.webp'],
    // 누르고 말하기: 녹음은 이 창의 blob 주소로만 다시 듣는다.
    media: 'blob:',
  },
  // 2026-10-14 synk.im/album 공개. 계정 열쇠는 기존 family-album 브라우저 클라이언트를 쓴다.
  album: {
    app: 'experiences/family-album', client: 'family-album', config: 'config.json', target: 'https://synk.im/album/',
    modules: ['app', 'model', 'questions', 'timeline', 'storage', 'form-drafts', 'takehome', 'operations', 'media', 'account-media'],
    css: 'style.css',
    assets: ['book', 'camera', 'clock', 'frame', 'house', 'mic', 'person', 'question', 'speaker'].map(name => `art/${name}.webp`),
    // 사진은 앨범 자료 안의 data: 주소, 원래 목소리는 이 창의 blob: 주소로만 보여 준다.
    img: "'self' data:",
    media: 'blob: data:',
  },
};
const TRAVEL_CONFIGURATION = Object.freeze({ client: 'path-travel', config: 'config.json', target: 'https://synk.im/try/travel/' });

function replaceOnce(text, old, replacement, name) {
  if (text.split(old).length !== 2) throw Error('Unexpected public source contract: ' + name);
  return text.replace(old, replacement);
}

async function destination(out, root) {
  const workspace = await fs.realpath(root), target = path.resolve(out), temporary = path.join(workspace, '.tmp');
  const relative = path.relative(temporary, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Use a new output directory inside the workspace .tmp directory.');
  try { await fs.lstat(target); throw Error('Output already exists; use a new directory.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (let parent = path.dirname(target); parent !== workspace; parent = path.dirname(parent)) {
    try { if ((await fs.lstat(parent)).isSymbolicLink()) throw Error('Output must not follow a directory link.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}

function publicConfiguration(config, targetUrl, definition) {
  const target = new URL(targetUrl);
  if (target.href !== targetUrl || target.protocol !== 'https:' || isLoopback(target.hostname) || target.username || target.password || target.search || target.hash
    || !/^\/(?:[a-z0-9][a-z0-9-]*\/)+$/.test(target.pathname)) throw Error('The public app needs an exact HTTPS directory URL ending in a slash.');
  const checked = readConfig(config, target.href), client = checked.clients[definition.client];
  if (!checked.configured || typeof client?.clientId !== 'string' || !/^[a-zA-Z0-9_.-]{1,200}$/.test(client.clientId) || client.redirectUri !== target.href)
    throw Error('The product client must be explicitly registered for this exact public callback.');
  const normalize = (value, originOnly = false) => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || isLoopback(url.hostname) || url.username || url.password || url.search || url.hash || originOnly && url.pathname !== '/')
      throw Error('Public account endpoints must use HTTPS and contain no credentials, query or fragment.');
    return originOnly ? url.origin : url.href;
  };
  const key = checked.supabasePublishableKey;
  if (!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key) && !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(key)) throw Error('A public publishable or anon key is required.');
  return { target, config: { version: 1, supabaseUrl: normalize(checked.supabaseUrl, true), supabasePublishableKey: key,
    accountApiUrl: normalize(checked.accountApiUrl, true), portalUrl: normalize(checked.portalUrl),
    clients: { [definition.client]: { ...client } },
    authorizationClients: [{ product: 'platform', clientId: client.clientId, redirectUris: [target.href] }] } };
}

function localFile(value, files, name) {
  if (!value.startsWith('./') || /[?#\\%]/.test(value) || value.split('/').includes('..') || !files.has(value.slice(2)))
    throw Error('Unknown or non-local public asset in ' + name + ': ' + value);
  return value.slice(2);
}

function publicEntry(html, files, config, product, media = "'none'", img = "'self'") {
  if (!html.includes('<meta charset="utf-8">') || /<(?:base|style|iframe|object)\b|\b(?:style|on[a-z]+)\s*=|http-equiv=["']Content-Security-Policy/i.test(html))
    throw Error('Unexpected inline content or public HTML policy.');
  for (const [, value] of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) if (!value.startsWith('#')) localFile(value, files, 'index.html');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  if (scripts.length !== 1 || scripts[0][2].trim() || !/\btype="module"/.test(scripts[0][1]) || !/\bsrc="\.\/app.mjs"/.test(scripts[0][1])) throw Error('Unexpected public script entry.');
  const origins = [...new Set([config.supabaseUrl, config.accountApiUrl])].join(' ');
  const policy = `default-src 'none'; script-src 'self'; style-src 'self'; img-src ${img}; font-src 'self'; connect-src 'self' ${origins}; media-src ${media}; object-src 'none'; base-uri 'none'; form-action 'none'`;
  html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta name="synk-${product}-runtime" content="public-web">\n  <meta name="referrer" content="no-referrer">\n  <meta http-equiv="Content-Security-Policy" content="${policy}">`);
  return html.replace(/\b(src|href)="(\.\/[^"?#]+\.(?:mjs|css))"/g, (_, attribute, value) => `${attribute}="${value}?v=${sha(files.get(value.slice(2)))}"`);
}

/** Prepare an isolated static candidate. No registration, account access or deployment. */
export async function preparePersonalPublic({ product, out, config, targetUrl, root = ROOT } = {}) {
  if (product === 'path-travel') return prepareTravelPublicConfig({ out, config, targetUrl, root });
  if (!Object.hasOwn(PRODUCTS, product) || !out || !config) throw Error('Choose fortune, rehearsal or album, a new output directory and explicit public account configuration.');
  const definition = PRODUCTS[product], checked = publicConfiguration(config, targetUrl ?? definition.target, definition);
  const workspace = await fs.realpath(root), output = await destination(out, workspace), files = new Map(), sources = new Map();
  const allowedModules = new Set([...definition.modules.map(name => `${definition.app}/${name}.mjs`), `${SIGNAL_SOURCE}/signal.mjs`]);
  if (product === 'fortune') for (const file of ['core', 'platform-entry']) allowedModules.add(`experiences/synk-account/src/${file}.mjs`);
  else for (const file of [...COMMON, ...TRAVEL_VALIDATOR, 'atlas/ask.js', 'experiences/member-book-assets.mjs', 'experiences/path-vr/model.mjs', 'experiences/family-album/model.mjs']) allowedModules.add(file);
  // personal-data.mjs는 계정 문서 종류마다 검사기를 둔다. 앨범 공개본에도 리허설 문서 검사기가 함께 실린다.
  if (product === 'album') allowedModules.add('experiences/conversation-rehearsal/domain.mjs');
  async function source(file) {
    const absolute = path.join(workspace, file), resolved = await fs.realpath(absolute);
    if (resolved !== absolute) throw Error('Source must not follow a file or directory link: ' + file);
    const bytes = await fs.readFile(absolute), hash = sha(bytes);
    if (sources.has(file) && sources.get(file) !== hash) throw Error('Source changed during build: ' + file);
    sources.set(file, hash); return bytes;
  }
  const copy = async (name, file) => files.set(name, await source(file));
  const compiled = await esbuild.build({ absWorkingDir: workspace, entryPoints: [`${definition.app}/app.mjs`], bundle: true, write: false,
    outfile: 'app.mjs', format: 'esm', platform: 'browser', target: 'es2022', charset: 'utf8', legalComments: 'eof', metafile: true, logLevel: 'silent',
    plugins: [{ name: 'fixed-personal-public-sources', setup(build) {
      build.onResolve({ filter: /^\/member-signal\// }, args => {
        if (args.path !== '/member-signal/signal.mjs' || slash(path.relative(workspace, args.importer)) !== definition.app + '/app.mjs') throw Error('Unexpected member signal import.');
        return { path: path.join(workspace, SIGNAL_SOURCE, 'signal.mjs') };
      });
      build.onResolve({ filter: /^\/synk-account\/src\// }, args => {
        const absolute = product === 'album' ? ['/synk-account/src/account-notebook.mjs', '/synk-account/src/personal-data.mjs'] : ['/synk-account/src/account-notebook.mjs'];
        if (!absolute.includes(args.path) || slash(path.relative(workspace, args.importer)) !== definition.app + '/app.mjs') throw Error('Unexpected absolute public import.');
        return { path: path.join(workspace, 'experiences' + args.path) };
      });
      build.onLoad({ filter: /.*/ }, async args => {
        const file = slash(path.relative(workspace, args.path));
        if (!allowedModules.has(file)) throw Error('Module outside the public source allowlist: ' + file);
        let text = (await source(file)).toString('utf8');
        if (product === 'rehearsal' && file === definition.app + '/app.mjs')
          text = replaceOnce(text, "import './core/ask.js';", "import SynkAsk from '../../atlas/ask.js';\nglobalThis.SynkAsk = SynkAsk;", 'Core Ask browser bridge');
        // 앨범은 Core 두 원본을 고전 스크립트로 읽는다. 공개본은 같은 원본을 묶음에 넣고 같은 전역 이름으로 둔다.
        if (product === 'album' && file === definition.app + '/app.mjs')
          text = "import SynkAsk from '../../atlas/ask.js';\nimport SynkAtlasDomain from '../../atlas/domain.js';\nglobalThis.SynkAsk = SynkAsk;\nglobalThis.SynkAtlasDomain = SynkAtlasDomain;\n" + text;
        if (product !== 'fortune' && file === 'experiences/synk-account/src/product-account.mjs')
          text = replaceOnce(text, "configUrl = '/api/account-config'", "configUrl = './config.json'", 'public account config URL');
        return { contents: text, loader: 'js' };
      });
    } }],
  });
  if (compiled.outputFiles.length !== 1 || Object.values(compiled.metafile.outputs).some(value => value.imports.length)) throw Error('The public entry must contain its whole module graph.');
  files.set('app.mjs', compiled.outputFiles[0].contents);
  const css = definition.css || 'app.css';
  await copy(css, definition.app + '/' + css);
  for (const name of definition.assets) await copy('assets/' + name, definition.app + '/assets/' + name);
  for (const [name, file] of signalPublicFiles()) await copy(name, file);
  let html = signalPublicHtml((await source(definition.app + '/index.html')).toString('utf8'));
  if (product === 'album') {
    // 로컬 서버가 내주던 Core 고전 스크립트 두 개는 앱 묶음 안으로 들어갔다. 나머지 상대 참조는 ./ 로 고정한다.
    for (const name of ['core/domain.js', 'core/ask.js']) html = replaceOnce(html, `  <script src="${name}" defer></script>\n`, '', 'album core script ' + name);
    for (const [old, next] of [['href="assets/art/camera.webp"', 'href="./assets/art/camera.webp"'], ['href="style.css"', 'href="./style.css"'], ['href="takehome.css"', 'href="./takehome.css"'], ['src="app.mjs"', 'src="./app.mjs"']])
      html = replaceOnce(html, old, next, 'album relative reference ' + old);
    const takehome = (await source(definition.app + '/takehome.mjs')).toString('utf8');
    const style = takehome.match(/export const BOOK_CSS = `([\s\S]*?)`;/)?.[1];
    if (!style || /\$\{|\\/.test(style)) throw Error('Unexpected album book stylesheet contract.');
    files.set('takehome.css', style.replace(/\r\n?/g, '\n'));
  } else if (product === 'fortune') {
    await copy('licenses/lunar-javascript-LICENSE.txt', definition.app + '/vendor/lunar-javascript-1.7.7/LICENSE');
    await copy('licenses/lunar-javascript-provenance.json', definition.app + '/vendor/lunar-javascript-1.7.7/provenance.json');
  } else {
    // 계정 수첩 모양은 공통 signal.css가 맡는다(옛 account-notebook.css·펠트 판 그림은 싣지 않는다).
    const book = (await source(definition.app + '/book.mjs')).toString('utf8');
    const style = book.match(/export const BOOK_STYLES = `([\s\S]*?)`;/)?.[1];
    if (!style || /\$\{|\\/.test(style)) throw Error('Unexpected standalone book stylesheet contract.');
    // JavaScript template literals normalize CRLF to LF at evaluation time.
    files.set('book.css', style.replace(/\r\n?/g, '\n'));
  }
  for (const [name, bytes] of files) if (name.endsWith('.css')) {
    const text = bytes.toString();
    if (/@import\b/i.test(text)) throw Error('Unexpected external stylesheet import: ' + name);
    for (const { value, file } of cssUrlTargets(name, text)) if (file && !files.has(file)) throw Error('Unknown or non-local public asset in ' + name + ': ' + value);
  }
  files.set(definition.config, JSON.stringify(checked.config, null, 2) + '\n');
  files.set('index.html', publicEntry(html, files, checked.config, product, definition.media, definition.img));
  // A shared worktree can change while esbuild reads dependencies. Refuse to label a mixed candidate as one source snapshot.
  for (const [file, hash] of sources) if (sha(await fs.readFile(path.join(workspace, file))) !== hash) throw Error('Source changed during build: ' + file);
  const manifest = { version: 1, product, targetUrl: checked.target.href, configFile: definition.config, builder: { file: 'tools/prepare-personal-public.mjs', sha256: sha(await fs.readFile(fileURLToPath(import.meta.url))), esbuildVersion: esbuild.version },
    sourceFiles: [...sources].sort(([a], [b]) => a.localeCompare(b)).map(([file, sha256]) => ({ file, sha256 })),
    files: [...files].map(([name, bytes]) => ({ name, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) })),
    transformations: [...(product === 'rehearsal' ? ['bundle canonical modules and preserve Core Ask browser global', 'product-account default configUrl=./config.json in bundle only', 'external BOOK_STYLES']
      : product === 'album' ? ['bundle canonical modules with Core Ask and Atlas domain browser globals', 'product-account default configUrl=./config.json in bundle only', 'external BOOK_CSS as takehome.css', 'data: photos and blob:/data: audio in CSP'] : ['bundle canonical modules']), 'member signal kit under signal/ (theme applied by the app module)'],
    limitations: { registrationVerified: false, realLoginVerified: false, browserVerified: false, deployed: false } };
  files.set('build-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  await destination(output, workspace); await fs.mkdir(path.dirname(output), { recursive: true });
  await destination(output, workspace); await fs.mkdir(output);
  for (const [name, bytes] of files) { const file = path.join(output, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes, { flag: 'wx' }); }
  return { output, product, targetUrl: checked.target.href, fileCount: files.size, totalBytes: [...files.values()].reduce((sum, bytes) => sum + Buffer.byteLength(bytes), 0), manifest };
}

/** Travel keeps its existing website builder. Prepare only its isolated account
 * config; this never enables the notebook, copies app files or verifies a registration. */
export async function prepareTravelPublicConfig({ out, config, targetUrl = TRAVEL_CONFIGURATION.target, root = ROOT } = {}) {
  if (!out || !config || targetUrl !== TRAVEL_CONFIGURATION.target) throw Error('Travel requires its exact public callback https://synk.im/try/travel/ and explicit configuration.');
  const checked = publicConfiguration(config, targetUrl, TRAVEL_CONFIGURATION), workspace = await fs.realpath(root), output = await destination(out, workspace);
  const travelId = checked.config.clients['path-travel'].clientId;
  if (Object.entries(config.clients ?? {}).some(([key, value]) => key !== 'path-travel' && value?.clientId === travelId)) throw Error('Travel requires its own client identity; PATH VR and other products cannot share it.');
  const bytes = JSON.stringify(checked.config, null, 2) + '\n';
  const manifest = { version: 1, product: 'path-travel', artifact: 'account-config-only', targetUrl,
    configFile: TRAVEL_CONFIGURATION.config, builder: { file: 'tools/prepare-personal-public.mjs', sha256: sha(await fs.readFile(fileURLToPath(import.meta.url))) },
    files: [{ name: TRAVEL_CONFIGURATION.config, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) }],
    limitations: { registrationVerified: false, realLoginVerified: false, browserVerified: false, deployed: false, appBuilt: false } };
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
  await fs.mkdir(path.dirname(output), { recursive: true }); await destination(output, workspace); await fs.mkdir(output);
  await fs.writeFile(path.join(output, TRAVEL_CONFIGURATION.config), bytes, { flag: 'wx' });
  await fs.writeFile(path.join(output, 'build-manifest.json'), manifestBytes, { flag: 'wx' });
  return { output, product: 'path-travel', targetUrl, fileCount: 2, totalBytes: Buffer.byteLength(bytes) + Buffer.byteLength(manifestBytes), manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [product, out, configPath, targetUrl, ...extra] = process.argv.slice(2);
  if (!product || !out || !configPath || extra.length) throw Error('Usage: node tools/prepare-personal-public.mjs <fortune|rehearsal|album|path-travel><new-.tmp-output> <public-config.json> [exact-https-directory-url]; path-travel prepares account config only.');
  const { manifest, ...result } = await preparePersonalPublic({ product, out, config: JSON.parse(await fs.readFile(configPath, 'utf8')), targetUrl });
  console.log(JSON.stringify(result, null, 2));
}
