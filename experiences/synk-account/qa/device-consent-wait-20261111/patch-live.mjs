// Puts the 11-11 night change (a SYNK PC app's connect card gives way to the restart card once the app's five-minute wait
// is over) onto the published SYNK ID page (synk.im/id/) without rebuilding its bundle. Made from
// ../login-one-form-20261111/patch-live.mjs: the same portal-scope swap, with only portal.mjs moving.
//   node experiences/synk-account/qa/device-consent-wait-20261111/patch-live.mjs <live dir> <out dir> <prior rev> [<next rev> | WORKTREE]
// <live dir> holds the published id/dist/app.js, id/index.html and id/style.css as id__dist__app.js, id__index.html and
// id__style.css (raw bytes of synk-policy origin/main). Only id__dist__app.js is written to <out dir>, with report.json:
// index.html and style.css must still be <prior rev>'s published pages and stay as they are (tools/공개.js renews the
// ?v= token of the changed app.js itself).
import fs from 'node:fs';
import path from 'node:path';
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
// A file as the commit has it (LF), or this checkout's file read the same way.
const source = (rev, file) => rev === 'WORKTREE' ? lf(fs.readFileSync(path.join(repo, file), 'utf8')) : git('show', `${rev}:${file}`).toString('utf8');
const live = name => fs.readFileSync(path.join(liveDir, name), 'utf8');
const UNPUBLISHED = ['createWardrobeView', 'createClassroomTownHost', 'WORLD_GAMES', 'createWorldLearningHost', '말 랠리'];
const CHANGED = ['experiences/synk-account/src/portal.mjs'];

// --- id/dist/app.js: the portal scope ------------------------------------------------------------------------------------
// The bridge, stubs and tail are the ones the published scope was built with (town-records-20261028/patch-live.mjs).
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
// Only this change's two modules may differ from the published scope's sources.
const inputs = [...new Set([...prior.inputs, ...next.inputs])];
const moved = inputs.filter(file => source(priorRev, file) !== source(nextRev, file));
const foreign = moved.filter(file => !CHANGED.includes(file));
if (foreign.length) throw new Error('scope modules changed since the published page beyond this change: ' + foreign.join(', '));
if (!CHANGED.every(file => moved.includes(file))) throw new Error('the next scope does not carry this change: ' + CHANGED.filter(file => !moved.includes(file)).join(', '));
for (const needle of ['Google로 로그인', 'Google로 가입', '이메일로 로그인', '이메일로 가입', '로그인 방법을 골라 주세요.', '("email-method")', '("email-fields")', '("method-choices")', 'synk.id.recent-login.v1', 'createPortalSecurity'])
  if (!next.text.includes(needle)) throw new Error('patched scope lacks ' + needle);
for (const needle of ['Google로 계속하기', 'email-divider', 'google-signin']) if (next.text.includes(needle)) throw new Error('patched scope still says ' + needle);
for (const needle of ['synk.id.connect-seen.v1', 'SYNK 앱은 로그인을 시작하고 5분 동안만 연결을 기다려요.', 'The SYNK app waits only five minutes'])
  if (!next.text.includes(needle)) throw new Error('patched scope lacks the five-minute part: ' + needle);
// What master gained beside this change (device consent, 11-11) is in the scope whole, not half.
for (const needle of ['function deviceDestination(', 'function destinationProduct(', 'function showConsent(', 'consentTarget', 'window.top!==window.self', '("consent-native")', '("consent-account")'])
  if (!next.text.includes(needle)) throw new Error('patched scope lacks the device-consent part: ' + needle);
// Every commit since the published page that touched what this publish replaces.
const carried = nextRev === 'WORKTREE' || priorRev === 'WORKTREE' ? null
  : git('log', '--format=%h %s', `${priorRev}..${nextRev}`, '--', ...inputs, 'experiences/synk-account/index.html', 'experiences/synk-account/style.css').toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(row => row.slice(0, 140));
for (const needle of UNPUBLISHED) if (next.text.includes(needle)) throw new Error('patched scope carries unpublished ' + needle);
const app = liveApp.slice(0, start) + next.text + liveApp.slice(end);
// Measured, not assumed: the first and last differing characters both fall inside the portal scope.
let head = 0;while (head < app.length && app[head] === liveApp[head]) head++;
let tail = 0;while (tail < app.length - head && tail < liveApp.length - head && app[app.length - 1 - tail] === liveApp[liveApp.length - 1 - tail]) tail++;
if (head < start || tail < liveApp.length - end) throw new Error('app.js: bytes outside the portal scope changed');

// --- id/index.html: the page with prepare-portal's publishing swaps and the published cache tokens ---------------------
const liveHtml = live('id__index.html');
const tokens = Object.fromEntries(['style.css', 'dist/app.js', 'vendor/atlas-learning.js'].map(file => {
  const token = liveHtml.match(new RegExp(`\\./${file.replace(/[./]/g, '\\$&')}\\?v=([A-Za-z0-9_-]+)`))?.[1];
  if (!token) throw new Error('published index.html has no token for ' + file);return [file, token]; }));
function published(rev) {
  let html = source(rev, 'experiences/synk-account/index.html');
  const swap = (from, to, n) => { const actual = count(html, from);if (actual !== n) throw new Error(`index.html (${rev}): expected ${n}x ${from}, found ${actual}`);html = html.split(from).join(to); };
  const icons = [16, 32, 48].map(size => `<link rel="icon" type="image/png" sizes="${size}x${size}" href="/assets/favicon-synk-20260919-${size}.png">`).join('\n')
    + '\n<link rel="icon" type="image/svg+xml" sizes="any" media="(prefers-color-scheme: dark)" href="/assets/favicon-synk-dark-20260919.svg">';
  swap('<meta name="referrer" content="no-referrer">', `<meta name="referrer" content="no-referrer">\n<meta name="robots" content="noindex,nofollow">\n${icons}`, 1);
  swap('src="../learning-hub/atlas-learning.js?v=atlas-learning"', 'src="./vendor/atlas-learning.js?v=atlas-learning"', 1);
  swap('<nav><a href="./platform.html">플랫폼</a><a href="./client.html?product=world">WORLD</a></nav>', '<nav><a href="https://synk.im/">synk.im</a></nav>', 1);
  swap('<a class="brand" href="./platform.html">', '<a class="brand" href="./">', 1);
  swap('href="../learning-hub/"', 'href="https://synk.im/"', count(html, 'href="../learning-hub/"'));
  for (const [file, from] of [['style.css', 'google-only-20261009'], ['dist/app.js', 'google-only-20261009'], ['vendor/atlas-learning.js', 'atlas-learning']]) swap(`./${file}?v=${from}`, `./${file}?v=${tokens[file]}`, 1);
  if (/learning-hub|platform\.html"|client\.html/.test(html.replace('https://synk.im/account/platform.html#home', ''))) throw new Error(`index.html (${rev}) still points into the development tree`);
  return html;
}
if (lf(liveHtml) !== published(priorRev)) throw new Error(`the published index.html is not ${priorRev}'s page`);
// The published page's own line ends, line by line: what stays keeps its bytes.
const liveLines = liveHtml.split('\n'), ending = liveLines.filter(line => line.endsWith('\r')).length * 2 >= liveLines.length - 1 ? crlf : lf;
const html = liveHtml;if (lf(published(nextRev)) !== lf(liveHtml)) throw new Error('index.html changed since the published page — this tool does not carry it');
for (const needle of ['id="method-choices"', 'id="email-method"', 'id="email-fields"', 'id="google-login"', 'id="google-privacy-note"', 'https://synk.im/privacy/#synk-id', 'id="account-profile"', 'id="recent-login"', 'id="connection-restart"', 'id="consent-account"', 'id="consent-native"'])
  if (!html.includes(needle)) throw new Error('index.html lacks ' + needle);
for (const needle of ['id="google-signin"', 'id="email-divider"', '계속하기']) if (html.includes(needle)) throw new Error('index.html still has ' + needle);

// --- id/style.css: the published one must be where this change started ------------------------------------------------------
const liveStyle = live('id__style.css'), styleFile = 'experiences/synk-account/style.css';
if (lf(liveStyle) !== source(priorRev, styleFile)) throw new Error(`the published style.css is not ${priorRev}'s`);
const style = liveStyle;if (source(nextRev, styleFile) !== lf(liveStyle)) throw new Error('style.css changed since the published page — this tool does not carry it');
for (const needle of ['.method-btn{', '.method-choices{', '.email-mark{', ".sb-stitch{border-image-source:url('./assets/thread-shift.webp')}"]) if (!style.includes(needle)) throw new Error('style.css lacks ' + needle);

const report = { priorRev: priorRev === 'WORKTREE' ? priorRev : git('rev-parse', priorRev).toString().trim(), nextRev: nextRev === 'WORKTREE' ? nextRev : git('rev-parse', nextRev).toString().trim(), liveDir: path.resolve(liveDir), files: {
  'id/dist/app.js': { liveBytes: Buffer.byteLength(liveApp), outBytes: Buffer.byteLength(app), scopeReplaced: [start, end], priorScopeMatched: true, nextScopeBytes: Buffer.byteLength(next.text), scopeInputs: next.inputs.length, changedInputs: moved, firstDifference: head, sameTail: tail },
  carriedCommits: carried,
  'id/index.html': { liveBytes: Buffer.byteLength(liveHtml), outBytes: Buffer.byteLength(html), priorPageMatched: true, tokens },
  'id/style.css': { liveBytes: Buffer.byteLength(liveStyle), outBytes: Buffer.byteLength(style), priorStyleMatched: true } } };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'id__dist__app.js'), app);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 1));
