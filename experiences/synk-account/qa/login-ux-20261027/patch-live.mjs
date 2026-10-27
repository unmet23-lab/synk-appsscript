// Puts the 10-27 sign-in and 「내 계정」 pass onto the published SYNK ID page (id/) without rebuilding its bundle.
//   node experiences/synk-account/qa/login-ux-20261027/patch-live.mjs <live dir> <out dir> [<prior rev>]
// <live dir> holds the published id/dist/app.js, id/index.html and id/style.css as id__dist__app.js, id__index.html and
// id__style.css; the candidates go to <out dir> under the same names, with report.json.
// - app.js: since 10-22 the portal is its own scope in the published bundle (../account-security-20261022/patch-live.mjs).
//   That scope must equal <prior rev>'s portal built the same way, byte for byte, before this checkout's portal replaces
//   it. The new scope also carries its own sign-in helpers (google-auth, recent-login), the portal's 「내 계정」
//   (portal-account, with the PC app's pure helpers) and the two word lists it shows; the account client, core and
//   sign-up tracking stay the published bundle's own (read lazily by name). Every byte outside the scope stays.
// - index.html: this checkout's page with the publishing swaps of tools/synk-id/prepare-portal.mjs (the page is new here).
// - style.css: this checkout's file; the published one must still be the one this checkout started from.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), portal = path.resolve(here, '../..'), repo = path.resolve(portal, '../..');
const esbuild = createRequire(path.join(portal, 'package.json'))('esbuild');
const [liveDir, outDir, priorRev = '2e23d30e8'] = process.argv.slice(2);
if (!liveDir || !outDir) throw new Error('usage: patch-live.mjs <live dir> <out dir> [<prior rev>]');
const once = (text, needle, label) => { const n = text.split(needle).length - 1;if (n !== 1) throw new Error(`${label}: expected one match, found ${n}`);return text.indexOf(needle); };
const git = (...args) => execFileSync('git', args, { cwd: repo, maxBuffer: 1 << 26 });

// The bridge text stays the 10-22 one, so the next patch finds the scope by the same head.
const LIVE = { createAccountClient: 'import_account_client.createAccountClient', PRODUCTS: 'PRODUCTS', firstPartyAuthorization: 'firstPartyAuthorization', trustedConsentRedirect: 'trustedConsentRedirect',
  createAccountView: 'createAccountView', createGoogleAccess: 'createGoogleAccess', createSignupConversion: 'createSignupConversion' };
const bridge = `var __synkPortalLive={${Object.entries(LIVE).map(([key, value]) => `get ${key}(){return ${value}}`).join(',')}};`;
const STUBS = {
  'account-client.cjs': 'export function createAccountClient(...a){return __synkPortalLive.createAccountClient(...a)}',
  'core.mjs': 'export const PRODUCTS=__synkPortalLive.PRODUCTS;export function firstPartyAuthorization(...a){return __synkPortalLive.firstPartyAuthorization(...a)}export function trustedConsentRedirect(...a){return __synkPortalLive.trustedConsentRedirect(...a)}',
  'account-view.mjs': 'export function createAccountView(...a){return __synkPortalLive.createAccountView(...a)}',
  'google-auth.mjs': 'export function createGoogleAccess(...a){return __synkPortalLive.createGoogleAccess(...a)}',
  'social-signup-conversion.mjs': 'export function createSignupConversion(...a){return __synkPortalLive.createSignupConversion(...a)}',
};
const TAIL = 'var{mountPortal,authErrorMessage,authRateLimit,cleanAuthCallbackUrl}=__synkPortal;';
async function scope(srcDir, stubbed) {
  const built = await esbuild.build({ stdin: { contents: 'export { mountPortal, authErrorMessage, authRateLimit, cleanAuthCallbackUrl } from "./portal.mjs";', resolveDir: srcDir, loader: 'js' },
    bundle: true, write: false, format: 'iife', globalName: '__synkPortal', target: ['es2022'], charset: 'utf8', minifyWhitespace: true,
    plugins: [{ name: 'published-modules', setup(b) {
      b.onResolve({ filter: /.*/ }, a => stubbed.includes(path.basename(a.path)) ? { path: path.basename(a.path), namespace: 'published' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'published' }, a => ({ contents: STUBS[a.path], loader: 'js' }));
    } }] });
  const inner = built.outputFiles[0].text.trim();
  if (!inner.startsWith('var __synkPortal=')) throw new Error('unexpected inner bundle head');
  return `${bridge}${inner}${TAIL}`;
}

// --- app.js ---------------------------------------------------------------------------------------
const live = fs.readFileSync(path.join(liveDir, 'id__dist__app.js'), 'utf8');
const start = once(live, 'var __synkPortalLive={', 'published portal scope'), end = once(live, TAIL, 'published portal tail') + TAIL.length;
for (const name of Object.values(LIVE).map(value => value.split('.')[0])) if (!new RegExp(`(?:var|let|const|function)\\s+${name}\\b`).test(live.slice(0, start))) throw new Error('published bundle does not declare ' + name + ' before the portal');
const priorDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-portal-prior-'));
try {
  for (const file of ['portal.mjs', 'portal-security.mjs']) fs.writeFileSync(path.join(priorDir, file), git('show', `${priorRev}:experiences/synk-account/src/${file}`));
  if (await scope(priorDir, Object.keys(STUBS)) !== live.slice(start, end)) throw new Error(`the published portal scope is not ${priorRev}'s portal`);
} finally { fs.rmSync(priorDir, { recursive: true, force: true }); }
// The new scope: google-auth is this checkout's (published copy unchanged since 10-22 apart from these lines), the rest as before.
const next = await scope(path.join(portal, 'src'), ['account-client.cjs', 'core.mjs', 'account-view.mjs', 'social-signup-conversion.mjs']);
const app = live.slice(0, start) + next + live.slice(end);
for (const needle of ['synk.id.recent-login.v1', 'createPortalSecurity', '이 브라우저만 남기고 로그아웃', 'takeSignedIn', 'type:"email_change"', 'type:"recovery"', '비밀번호를 잊었어요']) if (!next.includes(needle)) throw new Error('patched scope lacks ' + needle);
// Nothing that is not published yet may ride along (WORLD games list, classroom town, wardrobe).
for (const needle of ['말 랠리', 'createClassroomTownHost', 'createWardrobeView', 'WORLD_GAMES', 'createWorldLearningHost']) if (next.includes(needle)) throw new Error('patched scope carries unpublished ' + needle);
if (app.slice(0, start) !== live.slice(0, start) || app.slice(start + next.length) !== live.slice(end)) throw new Error('bytes outside the portal scope changed');

// --- index.html: the checkout's page with prepare-portal's publishing swaps ----------------------
let html = fs.readFileSync(path.join(portal, 'index.html'), 'utf8');
const swap = (from, to, count) => { const actual = html.split(from).length - 1;if (actual !== count) throw new Error(`index.html: expected ${count}x ${from}, found ${actual}`);html = html.split(from).join(to); };
const icons = [16, 32, 48].map(size => `<link rel="icon" type="image/png" sizes="${size}x${size}" href="/assets/favicon-synk-20260919-${size}.png">`).join('\n')
  + '\n<link rel="icon" type="image/svg+xml" sizes="any" media="(prefers-color-scheme: dark)" href="/assets/favicon-synk-dark-20260919.svg">';
swap('<meta name="referrer" content="no-referrer">', `<meta name="referrer" content="no-referrer">\n<meta name="robots" content="noindex,nofollow">\n${icons}`, 1);
swap('src="../learning-hub/atlas-learning.js?v=atlas-learning"', 'src="./vendor/atlas-learning.js?v=atlas-learning"', 1);
swap('<nav><a href="./platform.html">플랫폼</a><a href="./client.html?product=world">WORLD</a></nav>', '<nav><a href="https://synk.im/">synk.im</a></nav>', 1);
swap('<a class="brand" href="./platform.html">', '<a class="brand" href="./">', 1);
swap('href="../learning-hub/"', 'href="https://synk.im/"', html.split('href="../learning-hub/"').length - 1);
// The published page's cache tokens stay until the publishing tool renews them for the new bytes.
const liveHtml = fs.readFileSync(path.join(liveDir, 'id__index.html'), 'utf8');
for (const [file, from] of [['style.css', 'google-only-20261009'], ['dist/app.js', 'google-only-20261009'], ['vendor/atlas-learning.js', 'atlas-learning']]) {
  const token = liveHtml.match(new RegExp(`\\./${file.replace(/[./]/g, '\\$&')}\\?v=([A-Za-z0-9_-]+)`))?.[1];
  if (!token) throw new Error('published index.html has no token for ' + file);
  swap(`./${file}?v=${from}`, `./${file}?v=${token}`, 1);
}
for (const needle of ['id="signup-choices"', 'https://synk.im/privacy/#synk-id', 'id="account-profile"', 'id="recent-login"', 'id="password-toggle"', 'id="email-form-toggle"']) if (!html.includes(needle)) throw new Error('index.html lacks ' + needle);
if (/learning-hub|platform\.html"|client\.html/.test(html.replace('https://synk.im/account/platform.html#home', ''))) throw new Error('index.html still points into the development tree');

// --- style.css: the published one must be where this checkout started -------------------------
const style = fs.readFileSync(path.join(portal, 'style.css'), 'utf8'), liveStyle = fs.readFileSync(path.join(liveDir, 'id__style.css'), 'utf8');
if (git('show', 'HEAD:experiences/synk-account/style.css').toString('utf8') !== liveStyle) throw new Error('the published style.css is not the one this checkout started from');
if (!style.includes(".sb-stitch{border-image-source:url('./assets/thread-shift.webp')}")) throw new Error('style.css lacks the thread path fix');

const report = { priorRev, liveDir: path.resolve(liveDir), files: {
  'id/dist/app.js': { liveBytes: Buffer.byteLength(live), outBytes: Buffer.byteLength(app), scopeReplaced: [start, end], priorScopeMatched: true, nextScopeBytes: Buffer.byteLength(next) },
  'id/index.html': { liveBytes: Buffer.byteLength(liveHtml), outBytes: Buffer.byteLength(html) },
  'id/style.css': { liveBytes: Buffer.byteLength(liveStyle), outBytes: Buffer.byteLength(style) } } };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'id__dist__app.js'), app);
fs.writeFileSync(path.join(outDir, 'id__index.html'), html);
fs.writeFileSync(path.join(outDir, 'id__style.css'), style);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
