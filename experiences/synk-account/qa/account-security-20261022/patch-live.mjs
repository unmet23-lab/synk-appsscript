// Puts this change onto the published SYNK ID files without rebuilding them from master (the published bundles
// differ from a master build — docs/현장노트/배포_공개.md, 「공개본 계정 묶음이 기준 빌드와 이름·기능이 달라」).
//   node experiences/synk-account/qa/account-security-20261022/patch-live.mjs <live dir> <out dir> [<base rev>]
// <live dir> holds the published id/dist/app.js, id/index.html, id/style.css and account/dist/client.js as
// id__dist__app.js, id__index.html, id__style.css, account__dist__client.js; the patched files go to <out dir>
// under the same names, with report.json.
// 1. id/dist/app.js — the portal module (src/portal.mjs) is replaced whole by this checkout's portal.mjs and the
//    new portal-security.mjs, compiled in their own scope. The published region must equal <base rev>'s portal
//    region plus the ?view=signup patch (synk-policy d530261) up to esbuild's numbered renames, so nothing that
//    only the published file had is lost. The modules it imports stay the published ones, reached lazily by name.
//    account-view gets one getter (sessions) by an exact one-place insertion.
// 2. id/index.html — the confirm-password field and the 「로그인과 보안」 section, inserted at exact anchors.
// 3. id/style.css — this checkout's 「로그인과 보안」 rules appended.
// 4. account/dist/client.js — the PC/WORLD desktop adapter gains cancelDeletion (delete-cancel), one insertion.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), portal = path.resolve(here, '../..'), repo = path.resolve(portal, '../..');
const esbuild = createRequire(path.join(portal, 'package.json'))('esbuild');
const [liveDir, outDir, baseRev = 'c90cff9e1'] = process.argv.slice(2);
if (!liveDir || !outDir) throw new Error('usage: patch-live.mjs <live dir> <out dir> [<base rev>]');
const read = name => fs.readFileSync(path.join(liveDir, name), 'utf8');
const once = (text, needle, label) => { const n = text.split(needle).length - 1;if (n !== 1) throw new Error(`${label}: expected one match, found ${n}`);return text.indexOf(needle); };
const report = { baseRev, files: {} };

// --- 1. id/dist/app.js ------------------------------------------------------------------------------
const live = read('id__dist__app.js');
const regionOf = text => { const labels = once(text, 'var AUTH_LABELS=', 'AUTH_LABELS'), start = text.lastIndexOf('var $=id=>document.getElementById(id);', labels), end = once(text, 'async function start(', 'start()');
  if (start < 0 || labels - start > 60) throw new Error('portal $ declaration not right before AUTH_LABELS');return { start, end, text: text.slice(start, end) }; };
const liveRegion = regionOf(live);
const baseBuild = execFileSync('git', ['show', `${baseRev}:experiences/synk-account/dist/app.js`], { cwd: repo, maxBuffer: 1 << 28 }).toString('utf8');
const baseRegion = regionOf(baseBuild).text.replace('let mode=new URL(location.href).searchParams.get("view")==="reset"?"reset":"login"',
  'const requestedView=new URL(location.href).searchParams.get("view");let mode=requestedView==="reset"?"reset":requestedView==="signup"?"signup":"login"');
const numbered = text => text.replace(/\b([A-Za-z_$][\w$]*?)\d+\b/g, '$1');
if (numbered(baseRegion) !== numbered(liveRegion.text)) throw new Error('the published portal region is not the base portal plus the signup patch');
// Imports of portal.mjs, read lazily from the published bundle's own (earlier, already initialised) names.
const LIVE = { createAccountClient: 'import_account_client.createAccountClient', PRODUCTS: 'PRODUCTS', firstPartyAuthorization: 'firstPartyAuthorization', trustedConsentRedirect: 'trustedConsentRedirect',
  createAccountView: 'createAccountView', createGoogleAccess: 'createGoogleAccess', createSignupConversion: 'createSignupConversion' };
for (const name of Object.values(LIVE)) if (!liveRegion.text.includes(name)) throw new Error('published portal does not reference ' + name);
const bridge = `var __synkPortalLive={${Object.entries(LIVE).map(([key, value]) => `get ${key}(){return ${value}}`).join(',')}};`;
const stubs = {
  'account-client.cjs': 'export function createAccountClient(...a){return __synkPortalLive.createAccountClient(...a)}',
  'core.mjs': 'export const PRODUCTS=__synkPortalLive.PRODUCTS;export function firstPartyAuthorization(...a){return __synkPortalLive.firstPartyAuthorization(...a)}export function trustedConsentRedirect(...a){return __synkPortalLive.trustedConsentRedirect(...a)}',
  'account-view.mjs': 'export function createAccountView(...a){return __synkPortalLive.createAccountView(...a)}',
  'google-auth.mjs': 'export function createGoogleAccess(...a){return __synkPortalLive.createGoogleAccess(...a)}',
  'social-signup-conversion.mjs': 'export function createSignupConversion(...a){return __synkPortalLive.createSignupConversion(...a)}',
};
const built = await esbuild.build({ stdin: { contents: 'export { mountPortal, authErrorMessage, authRateLimit, cleanAuthCallbackUrl } from "./portal.mjs";', resolveDir: path.join(portal, 'src'), loader: 'js' },
  bundle: true, write: false, format: 'iife', globalName: '__synkPortal', target: ['es2022'], charset: 'utf8', minifyWhitespace: true,
  plugins: [{ name: 'published-modules', setup(b) {
    b.onResolve({ filter: /.*/ }, a => stubs[path.basename(a.path)] !== undefined ? { path: path.basename(a.path), namespace: 'published' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'published' }, a => ({ contents: stubs[a.path], loader: 'js' }));
  } }] });
const inner = built.outputFiles[0].text.trim();
if (!inner.startsWith('var __synkPortal=')) throw new Error('unexpected inner bundle head');
const replacement = `${bridge}${inner}var{mountPortal,authErrorMessage,authRateLimit,cleanAuthCallbackUrl}=__synkPortal;`;
let app = live.slice(0, liveRegion.start) + replacement + live.slice(liveRegion.end);
// account-view: the SYNK ID page tidies 「로그인한 곳」 after a password change ends the other sessions.
const viewReturn = 'return{load,applyAccount,launchRun,closeGame,stop(){';
once(app, viewReturn, 'account-view return');
app = app.replace(viewReturn, 'return{load,applyAccount,launchRun,closeGame,sessions:()=>(data?.sessions||[]).map(session=>({...session})),stop(){');
for (const needle of ['view?.sessions?.()', 'createPortalSecurity', 'token_hash', '로그인과 보안']) if (!app.includes(needle)) throw new Error('patched bundle lacks ' + needle);
report.files['id/dist/app.js'] = { liveBytes: Buffer.byteLength(live), outBytes: Buffer.byteLength(app), regionReplaced: [liveRegion.start, liveRegion.end], innerBytes: Buffer.byteLength(inner) };

// --- 2. id/index.html -------------------------------------------------------------------------------
const source = fs.readFileSync(path.join(portal, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const pick = (start, end) => { const i = once(source, start, 'source ' + start.slice(0, 30)), j = source.indexOf(end, i);if (j < 0) throw new Error('source end ' + end);return source.slice(i, j); };
const confirmField = pick('    <label id="password-confirm-label"', '\n') + '\n';
const securitySection = pick('<section id="account-security"', '<section id="google-linking"');
let html = read('id__index.html').replace(/\r\n/g, '\n');
if (html.includes('account-security') || html.includes('password-confirm')) throw new Error('published index.html already has these sections');
const passwordLabel = html.indexOf('\n', once(html, '<label id="password-label">', 'password label')) + 1;
html = html.slice(0, passwordLabel) + confirmField + html.slice(passwordLabel);
const firstCard = Math.min(...['<section id="account-next"', '<section id="google-linking"'].map(anchor => html.indexOf(anchor)).filter(at => at >= 0));
if (!Number.isFinite(firstCard)) throw new Error('no account card anchor');once(html, '<section id="google-linking"', 'google-linking');
html = html.slice(0, firstCard) + securitySection + html.slice(firstCard);
report.files['id/index.html'] = { inserted: ['password-confirm-label', 'account-security'] };

// --- 3. id/style.css --------------------------------------------------------------------------------
const css = fs.readFileSync(path.join(portal, 'style.css'), 'utf8').replace(/\r\n/g, '\n'), mark = '/* 로그인과 보안 (2026-10-22)';
let liveCss = read('id__style.css').replace(/\r\n/g, '\n');
if (liveCss.includes(mark)) throw new Error('published style.css already has the rules');
liveCss = liveCss.replace(/\n*$/, '\n') + css.slice(once(css, mark, 'css block'));
report.files['id/style.css'] = { appendedBytes: Buffer.byteLength(css.slice(css.indexOf(mark))) };

// --- 4. account/dist/client.js ----------------------------------------------------------------------
let client = read('account__dist__client.js');
const desktop = /requestDeletion:request_id=>(request\d*)\("requestDeletion",\{request_id\}\),/g, found = [...client.matchAll(desktop)];
if (found.length !== 1) throw new Error('desktop adapter requestDeletion found ' + found.length);
client = client.replace(desktop, (all, fn) => `${all}cancelDeletion:request_id=>${fn}("cancelDeletion",{request_id}),`);
report.files['account/dist/client.js'] = { inserted: 'cancelDeletion' };

fs.mkdirSync(outDir, { recursive: true });
for (const [name, text] of [['id__dist__app.js', app], ['id__index.html', html], ['id__style.css', liveCss], ['account__dist__client.js', client]]) fs.writeFileSync(path.join(outDir, name), text);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
