// Puts the A 한 칸 redesign (2026-11-11 — sign-in and 「내 SYNK 계정」) onto the published SYNK ID page (synk.im/id/)
// without rebuilding its bundle.
//   node experiences/synk-account/qa/sid-a-20261111/patch-live.mjs <live dir> <out dir> <prior rev> [<next rev> | WORKTREE]
// <live dir> holds the published id/dist/app.js, id/index.html and id/style.css as id__dist__app.js, id__index.html and
// id__style.css (raw bytes of synk-policy origin/main). <prior rev> is the commit the published page was made from (all three
// files); <next rev> the commit to publish (default HEAD). WORKTREE reads this checkout's files, for a candidate to review
// before the commit exists — its bytes must come out the same from the commit afterwards.
// Writes to <out dir>, in the publishing tool's naming (/ → __): id__dist__app.js · id__index.html · id__id.css (new) ·
// id__assets__SYNKSans-rest.woff2 · id__assets__SYNKSans-ui.woff2 (new, the platform's two font pieces) and report.json.
// - id/dist/app.js: the portal is its own scope in the published bundle (../login-ux-web-20261029/patch-live.mjs). That scope
//   must equal <prior rev>'s portal built the same way, byte for byte; the scope's modules may have changed since then only in
//   portal.mjs · google-auth.mjs · portal-account.mjs · portal-security.mjs. Every byte outside the scope stays. The report lists every commit since
//   <prior rev> that touched what this publish replaces (what rides along from master is named, not hidden).
// - id/index.html: the published page must be <prior rev>'s page made with the publishing swaps of that time; the next page is
//   made with tools/synk-id/prepare-portal.mjs's swaps of now (the page has no top navigation any more) and cache tokens that are
//   the first 12 hex of each file's sha256 (the publishing tool keeps them, since they already name the bytes).
// - id/style.css is no longer used by the page and stays published as it is (an old cached page still finds it).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), portal = path.resolve(here, '../..'), repo = path.resolve(portal, '../..');
const esbuild = createRequire(path.join(portal, 'package.json'))('esbuild');
const [liveDir, outDir, priorRev, nextRev = 'HEAD'] = process.argv.slice(2);
if (!liveDir || !outDir || !priorRev) throw new Error('usage: patch-live.mjs <live dir> <out dir> <prior rev> [<next rev> | WORKTREE]');
const count = (text, needle) => text.split(needle).length - 1;
const once = (text, needle, label) => { const n = count(text, needle);if (n !== 1) throw new Error(`${label}: expected one match, found ${n}`);return text.indexOf(needle); };
const git = (...args) => execFileSync('git', args, { cwd: repo, maxBuffer: 1 << 28 });
const lf = text => text.replace(/\r\n/g, '\n'), crlf = text => lf(text).replace(/\n/g, '\r\n');
const source = (rev, file) => rev === 'WORKTREE' ? lf(fs.readFileSync(path.join(repo, file), 'utf8')) : git('show', `${rev}:${file}`).toString('utf8');
const binary = (rev, file) => rev === 'WORKTREE' ? fs.readFileSync(path.join(repo, file)) : git('show', `${rev}:${file}`);
const live = name => fs.readFileSync(path.join(liveDir, name), 'utf8');
const token = bytes => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const UNPUBLISHED = ['createWardrobeView', 'createClassroomTownHost', 'WORLD_GAMES', 'createWorldLearningHost', '말 랠리'];
const CHANGED = ['experiences/synk-account/src/portal.mjs', 'experiences/synk-account/src/google-auth.mjs', 'experiences/synk-account/src/portal-account.mjs', 'experiences/synk-account/src/portal-security.mjs'];

// --- id/dist/app.js: the portal scope (bridge, stubs and tail as the published scope was built — town-records-20261028) --------
const LIVE = { createAccountClient: 'import_account_client.createAccountClient', PRODUCTS: 'PRODUCTS', firstPartyAuthorization: 'firstPartyAuthorization', trustedConsentRedirect: 'trustedConsentRedirect',
  createAccountView: 'createAccountView', createGoogleAccess: 'createGoogleAccess', createSignupConversion: 'createSignupConversion' };
const bridge = `var __synkPortalLive={${Object.entries(LIVE).map(([key, value]) => `get ${key}(){return ${value}}`).join(',')}};`;
const STUBS = {
  'account-client.cjs': 'export function createAccountClient(...a){return __synkPortalLive.createAccountClient(...a)}',
  'core.mjs': 'export const PRODUCTS=__synkPortalLive.PRODUCTS;export function firstPartyAuthorization(...a){return __synkPortalLive.firstPartyAuthorization(...a)}export function trustedConsentRedirect(...a){return __synkPortalLive.trustedConsentRedirect(...a)}',
  'account-view.mjs': 'export function createAccountView(...a){return __synkPortalLive.createAccountView(...a)}',
  'social-signup-conversion.mjs': 'export function createSignupConversion(...a){return __synkPortalLive.createSignupConversion(...a)}',
};
const TAIL = 'var{mountPortal,authErrorMessage,authRateLimit,cleanAuthCallbackUrl}=__synkPortal;';
async function portalScope(rev) {
  const inputs = [];
  const built = await esbuild.build({ stdin: { contents: 'export { mountPortal, authErrorMessage, authRateLimit, cleanAuthCallbackUrl } from "./portal.mjs";', resolveDir: path.join(portal, 'src'), loader: 'js' },
    bundle: true, write: false, format: 'iife', globalName: '__synkPortal', target: ['es2022'], charset: 'utf8', minifyWhitespace: true,
    plugins: [{ name: 'published-modules', setup(b) {
      b.onResolve({ filter: /.*/ }, a => Object.keys(STUBS).includes(path.basename(a.path)) ? { path: path.basename(a.path), namespace: 'published' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'published' }, a => ({ contents: STUBS[a.path], loader: 'js' }));
      b.onLoad({ filter: /\.(?:mjs|cjs|js)$/ }, a => { const rel = path.relative(repo, a.path).split(path.sep).join('/');inputs.push(rel);return { contents: source(rev, rel), loader: 'js' }; });
    } }] });
  const inner = built.outputFiles[0].text.trim();
  if (!inner.startsWith('var __synkPortal=')) throw new Error('unexpected inner bundle head');
  return { text: `${bridge}${inner}${TAIL}`, inputs };
}
const liveApp = live('id__dist__app.js');
const start = once(liveApp, 'var __synkPortalLive={', 'published portal scope'), end = once(liveApp, TAIL, 'published portal tail') + TAIL.length;
const prior = await portalScope(priorRev);
if (prior.text !== liveApp.slice(start, end)) throw new Error(`the published portal scope is not ${priorRev}'s portal`);
const next = await portalScope(nextRev);
const inputs = [...new Set([...prior.inputs, ...next.inputs])];
const moved = inputs.filter(file => { try { return source(priorRev, file) !== source(nextRev, file); } catch { return true; } });
const foreign = moved.filter(file => !CHANGED.includes(file));
if (foreign.length) throw new Error('scope modules changed since the published page beyond this change: ' + foreign.join(', '));
if (!CHANGED.every(file => moved.includes(file))) throw new Error('the next scope does not carry this change: ' + CHANGED.filter(file => !moved.includes(file)).join(', '));
for (const needle of ['data-folded', '"rl-say"', '"rl-who"', 'data-off', '"account-hero"', '"profile-name"', '내 SYNK 계정', 'sb-btn soft compact', '("google-availability")', 'createPortalSecurity', 'synk.id.recent-login.v1'])
  if (!next.text.includes(needle)) throw new Error('patched scope lacks ' + needle);
for (const needle of ['MY SYNK ID', '"hero-title"', 'profile-avatar']) if (next.text.includes(needle)) throw new Error('patched scope still has ' + needle);
// The device-consent parts already published stay whole.
for (const needle of ['function deviceDestination(', 'function showConsent(', 'consentTarget', 'window.top!==window.self', '("consent-native")', 'function armDeviceWait('])
  if (!next.text.includes(needle)) throw new Error('patched scope lacks the published device-consent part: ' + needle);
for (const needle of UNPUBLISHED) if (next.text.includes(needle)) throw new Error('patched scope carries unpublished ' + needle);
const app = liveApp.slice(0, start) + next.text + liveApp.slice(end);
let head = 0;while (head < app.length && app[head] === liveApp[head]) head++;
let tail = 0;while (tail < app.length - head && tail < liveApp.length - head && app[app.length - 1 - tail] === liveApp[liveApp.length - 1 - tail]) tail++;
if (head < start || tail < liveApp.length - end) throw new Error('app.js: bytes outside the portal scope changed');

// --- id/index.html ---------------------------------------------------------------------------------------------------------
const liveHtml = live('id__index.html');
const liveTokens = Object.fromEntries(['style.css', 'dist/app.js', 'vendor/atlas-learning.js'].map(file => {
  const value = liveHtml.match(new RegExp(`\\./${file.replace(/[./]/g, '\\$&')}\\?v=([A-Za-z0-9_-]+)`))?.[1];
  if (!value) throw new Error('published index.html has no token for ' + file);return [file, value]; }));
const ICONS = [16, 32, 48].map(size => `<link rel="icon" type="image/png" sizes="${size}x${size}" href="/assets/favicon-synk-20260919-${size}.png">`).join('\n')
  + '\n<link rel="icon" type="image/svg+xml" sizes="any" media="(prefers-color-scheme: dark)" href="/assets/favicon-synk-dark-20260919.svg">';
function page(rev, swaps) {
  let html = source(rev, 'experiences/synk-account/index.html');
  const swap = (from, to, n) => { const actual = count(html, from);if (actual !== n) throw new Error(`index.html (${rev}): expected ${n}x ${from}, found ${actual}`);html = html.split(from).join(to); };
  swap('<meta name="referrer" content="no-referrer">', `<meta name="referrer" content="no-referrer">\n<meta name="robots" content="noindex,nofollow">\n${ICONS}`, 1);
  swap('src="../learning-hub/atlas-learning.js?v=atlas-learning"', 'src="./vendor/atlas-learning.js?v=atlas-learning"', 1);
  swaps(swap, html);
  swap('href="../learning-hub/"', 'href="https://synk.im/"', count(html, 'href="../learning-hub/"'));
  if (/learning-hub|platform\.html"|client\.html/.test(html.replace('https://synk.im/account/platform.html#home', ''))) throw new Error(`index.html (${rev}) still points into the development tree`);
  return { html, swap };
}
// The page as published before: the old swaps (top navigation) and the published tokens. Nothing published since is dropped.
function publishedBefore() {
  let h = page(priorRev, swap => {
    swap('<nav><a href="./platform.html">플랫폼</a><a href="./client.html?product=world">WORLD</a></nav>', '<nav><a href="https://synk.im/">synk.im</a></nav>', 1);
    swap('<a class="brand" href="./platform.html">', '<a class="brand" href="./">', 1);
  }).html;
  for (const [file, from] of [['style.css', 'google-only-20261009'], ['dist/app.js', 'google-only-20261009'], ['vendor/atlas-learning.js', 'atlas-learning']]) {
    const needle = `./${file}?v=${from}`;if (count(h, needle) !== 1) throw new Error(`index.html (${priorRev}): expected one ${needle}`);h = h.replace(needle, `./${file}?v=${liveTokens[file]}`);
  }
  return h;
}
if (lf(liveHtml) !== publishedBefore()) throw new Error(`the published index.html is not ${priorRev}'s page`);
// The next page: prepare-portal's swaps of now, and tokens that name the next bytes.
const css = source(nextRev, 'experiences/synk-account/id.css');
let html = page(nextRev, () => {}).html;
const replaceToken = (file, from, to) => { const needle = `./${file}?v=${from}`;if (count(html, needle) !== 1) throw new Error('index.html: expected one ' + needle);html = html.replace(needle, `./${file}?v=${to}`); };
replaceToken('id.css', 'sid-a-20261111', token(Buffer.from(css)));
replaceToken('dist/app.js', 'sid-a-20261111', token(Buffer.from(app)));
replaceToken('vendor/atlas-learning.js', 'atlas-learning', liveTokens['vendor/atlas-learning.js']);
const liveLines = liveHtml.split('\n'), ending = liveLines.filter(line => line.endsWith('\r')).length * 2 >= liveLines.length - 1 ? crlf : lf;
html = ending(html);
for (const needle of ['id="method-choices"', 'id="email-method"', 'id="email-fields"', 'id="google-login"', 'id="google-privacy-note"', 'id="account-profile"', 'id="recent-login"', 'id="connection-restart"', 'id="consent-account"', 'id="consent-native"', 'class="sid"', 'href="./id.css?v=', 'https://synk.im/privacy/#synk-id'])
  if (!html.includes(needle)) throw new Error('index.html lacks ' + needle);
for (const needle of ['style.css', 'scrapbook.css', 'sb-eyebrow', 'hero-title', 'sticker-book', '<nav>']) if (html.includes(needle)) throw new Error('index.html still has ' + needle);
// The method pair keeps its order: Google note right under the pair, the e-mail fields its sibling (contracts ① ⑤ — README 5절).
if (!(html.indexOf('id="method-choices"') < html.indexOf('id="google-privacy-note"') && html.indexOf('id="google-privacy-note"') < html.indexOf('id="email-fields"'))) throw new Error('index.html: pair · note · fields out of order');

// --- the new files ---------------------------------------------------------------------------------------------------------
for (const needle of ["url('./assets/SYNKSans-ui.woff2')", "url('./assets/SYNKSans-rest.woff2')", '.sid .method-btn{', '.sid #notice[data-folded="true"]', '.sid .town-block']) if (!css.includes(needle)) throw new Error('id.css lacks ' + needle);
const fonts = Object.fromEntries(['SYNKSans-rest.woff2', 'SYNKSans-ui.woff2'].map(name => [name, binary(nextRev, `experiences/synk-account/assets/${name}`)]));

const carried = nextRev === 'WORKTREE' || priorRev === 'WORKTREE' ? null
  : git('log', '--format=%h %s', `${priorRev}..${nextRev}`, '--', ...inputs, 'experiences/synk-account/index.html', 'experiences/synk-account/id.css', 'experiences/synk-account/assets/SYNKSans-rest.woff2', 'experiences/synk-account/assets/SYNKSans-ui.woff2')
    .toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(row => row.slice(0, 140));
const report = { priorRev: priorRev === 'WORKTREE' ? priorRev : git('rev-parse', priorRev).toString().trim(), nextRev: nextRev === 'WORKTREE' ? nextRev : git('rev-parse', nextRev).toString().trim(), liveDir: path.resolve(liveDir), carriedCommits: carried, files: {
  'id/dist/app.js': { liveBytes: Buffer.byteLength(liveApp), outBytes: Buffer.byteLength(app), scopeReplaced: [start, end], priorScopeMatched: true, nextScopeBytes: Buffer.byteLength(next.text), scopeInputs: next.inputs.length, changedInputs: moved, firstDifference: head, sameTail: tail, token: token(Buffer.from(app)) },
  'id/index.html': { liveBytes: Buffer.byteLength(liveHtml), outBytes: Buffer.byteLength(html), priorPageMatched: true, liveTokens },
  'id/id.css': { new: true, bytes: Buffer.byteLength(css), token: token(Buffer.from(css)) },
  ...Object.fromEntries(Object.entries(fonts).map(([name, bytes]) => [`id/assets/${name}`, { new: true, bytes: bytes.length }])) } };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'id__dist__app.js'), app);
fs.writeFileSync(path.join(outDir, 'id__index.html'), html);
fs.writeFileSync(path.join(outDir, 'id__id.css'), css);
for (const [name, bytes] of Object.entries(fonts)) fs.writeFileSync(path.join(outDir, `id__assets__${name}`), bytes);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 1));
