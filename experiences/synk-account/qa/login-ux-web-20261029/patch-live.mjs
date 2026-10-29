// Puts the two web login follow-ups of 10-29 (f25a99cbb) onto the published bundles without rebuilding either.
//   node experiences/synk-account/qa/login-ux-web-20261029/patch-live.mjs <live dir> <out dir> [<portal prior rev> [<library prior rev>]]
// <live dir> holds the published id/dist/app.js and account/dist/platform.js as id__dist__app.js and account__dist__platform.js;
// the candidates go to <out dir> under the same names, with report.json. The pages (id/index.html, account/platform.html) keep
// their bytes; tools/공개.js renews their ?v= tokens. Every module is read from a commit (git show), never from the working tree.
// - ④ id/dist/app.js — the portal is its own scope (../town-records-20261028/patch-live.mjs). That scope must equal <portal prior
//   rev>'s portal built the same way, byte for byte (default cc13114c6, the source of the 10-28 portal publish synk-policy 2285a4d1),
//   before HEAD's portal replaces it, and every scope module changed since must have been changed by f25a99cbb alone.
// - ③ account/dist/platform.js — the account library regions (../library-modules-live-20261022/live-modules.cjs) must equal
//   <library prior rev>'s modules compiled in the published bundle's name environment (default 1beefabc6, the source of the 10-22
//   library publish synk-policy d1bd982), before HEAD's modules replace them (only b3c5668c7's signIn hook may have changed them).
//   platform.mjs's two places of f25a99cbb go in as text, each anchored exactly once, written as HEAD's master build writes them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), portal = path.resolve(here, '../..'), repo = path.resolve(portal, '../..');
const require = createRequire(import.meta.url);
const L = require('../library-modules-live-20261022/live-modules.cjs');
const esbuild = L.esbuild;
const [liveDir, outDir, portalPrior = 'cc13114c6', libraryPrior = '1beefabc6'] = process.argv.slice(2);
if (!liveDir || !outDir) throw new Error('usage: patch-live.mjs <live dir> <out dir> [<portal prior rev> [<library prior rev>]]');
const count = (text, needle) => text.split(needle).length - 1;
const once = (text, needle, label) => { const n = count(text, needle);if (n !== 1) throw new Error(`${label}: expected one match, found ${n}`);return text.indexOf(needle); };
const git = (...args) => execFileSync('git', args, { cwd: repo, maxBuffer: 1 << 28 });
const read = name => fs.readFileSync(path.join(liveDir, name), 'utf8');
const UNPUBLISHED = ['createWardrobeView', 'createClassroomTownHost', 'WORLD_GAMES', 'createWorldLearningHost', '말 랠리'];
const OURS = /^(?:f25a99cbb|b3c5668c7)/;
// Every commit since <rev> that touched these files must be one of ours (no one's unpublished work rides along).
function foreignSince(rev, files) {
  const rows = git('log', '--format=%h %s', `${rev}..HEAD`, '--', ...files).toString().trim().split('\n').filter(Boolean);
  return { rows, foreign: rows.filter(row => !OURS.test(row)) };
}

// --- ④ id/dist/app.js: the portal scope ------------------------------------------------------------------------------
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
      b.onLoad({ filter: /\.(?:mjs|cjs|js)$/ }, a => { const rel = path.relative(repo, a.path).split(path.sep).join('/');inputs.push(rel);
        return { contents: git('show', `${rev}:${rel}`).toString('utf8'), loader: 'js' }; });
    } }] });
  const inner = built.outputFiles[0].text.trim();
  if (!inner.startsWith('var __synkPortal=')) throw new Error('unexpected inner bundle head');
  return { text: `${bridge}${inner}${TAIL}`, inputs };
}
const liveApp = read('id__dist__app.js');
const start = once(liveApp, 'var __synkPortalLive={', 'published portal scope'), end = once(liveApp, TAIL, 'published portal tail') + TAIL.length;
const prior = await portalScope(portalPrior);
if (prior.text !== liveApp.slice(start, end)) throw new Error(`the published portal scope is not ${portalPrior}'s portal`);
const next = await portalScope('HEAD');
const portalSince = foreignSince(portalPrior, [...new Set([...prior.inputs, ...next.inputs])]);
if (portalSince.foreign.length) throw new Error('portal modules changed since the prior publish by ' + portalSince.foreign.join(' | '));
for (const needle of ['let collapsed=false', '$("password-form-toggle").focus?.()', '$("email-form-toggle").focus?.()', '마을 기록', 'createPortalSecurity'])
  if (!next.text.includes(needle)) throw new Error('patched scope lacks ' + needle);
if (count(next.text, 'lock(false);if(collapsed&&!closed)$(') !== 2) throw new Error('the scope does not focus the two toggles after unlocking');
for (const needle of UNPUBLISHED) if (next.text.includes(needle)) throw new Error('patched scope carries unpublished ' + needle);
const app = liveApp.slice(0, start) + next.text + liveApp.slice(end);
// Measured, not assumed: the first and last differing characters both fall inside the portal scope.
let head = 0;while (head < app.length && app[head] === liveApp[head]) head++;
let tail = 0;while (tail < app.length - head && tail < liveApp.length - head && app[app.length - 1 - tail] === liveApp[liveApp.length - 1 - tail]) tail++;
if (head < start || tail < liveApp.length - end) throw new Error('app.js: bytes outside the portal scope changed');

// --- ③ account/dist/platform.js: the library regions and platform.mjs's two places ----------------------------------------
// A commit's experiences/synk-account/src, as committed (LF), in a scratch root for live-modules.cjs to compile.
function sourceRoot(rev) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `synk-library-${rev}-`));
  const listed = git('ls-tree', '-r', '-z', rev, '--', 'experiences/synk-account/src').toString('utf8').split('\0').filter(Boolean);
  for (const row of listed) { const [meta, file] = row.split('\t'), [, type, blob] = meta.split(' ');if (type !== 'blob') continue;
    fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });fs.writeFileSync(path.join(root, file), git('cat-file', 'blob', blob)); }
  return root;
}
const livePlatform = read('account__dist__platform.js');
const roots = { prior: sourceRoot(libraryPrior), next: sourceRoot('HEAD') };
const before = await L.build({ srcRoot: roots.prior, live: livePlatform });
const { list, regions: { A: [a0, a1], R: [r0, r1] } } = before;
const A = { start: list[a0].start, end: list[a1].end }, R = { start: list[r0].start, end: list[r1].end };
if (before.A !== livePlatform.slice(A.start, A.end) || before.R !== livePlatform.slice(R.start, R.end)) throw new Error(`the published library regions are not ${libraryPrior}'s modules`);
const after = await L.build({ srcRoot: roots.next, live: livePlatform });
for (const r of [before, after]) if (r.renamedCollide.length || r.stray.length) throw new Error('environment: ' + JSON.stringify({ renamed: r.renamedCollide, stray: r.stray }));
const libraryInputs = [...new Set([...before.Rstatements, ...after.Rstatements].map(st => st.owner).concat('experiences/synk-account/src/platform-library-data.mjs'))];
if (libraryInputs.some(file => !/^experiences\/synk-account\/src\/[\w-]+\.mjs$/.test(file))) throw new Error('library owners: ' + libraryInputs.join(', '));
const librarySince = foreignSince(libraryPrior, libraryInputs);
if (librarySince.foreign.length) throw new Error('library modules changed since the prior publish by ' + librarySince.foreign.join(' | '));
if (after.A !== before.A) throw new Error('the library data module changed (only the view was meant to)');
for (const needle of ['signIn=null', 'function guestSignIn(', 'function labelToggle(', 'authChanged:()=>{if(!disposed)summary()}']) if (!after.R.includes(needle)) throw new Error('library region lacks ' + needle);
fs.rmSync(roots.prior, { recursive: true, force: true });fs.rmSync(roots.next, { recursive: true, force: true });

// platform.mjs's two places, the way HEAD's master build has them (and f25a99cbb^'s build has not).
const masterBuild = git('show', 'HEAD:experiences/synk-account/dist/platform.js').toString('utf8'), masterBefore = git('show', 'f25a99cbb^:experiences/synk-account/dist/platform.js').toString('utf8');
const GUEST = 'var browserGuest=()=>{const id2=browserAccount?.identity();return!!id2&&id2.configured===true&&id2.status==="signed-out"};';
const SIGN_IN = 'signIn:{guest:browserGuest,open:()=>location.assign("./client.html?product=platform")},';
const PLACES = [
  ['status', 'entry.setAttribute("aria-label",state.status==="signed-in"?"SYNK ID 계정 관리":"SYNK ID로 로그인");render();continuity?.render?.()}function quickCard(',
    'entry.setAttribute("aria-label",state.status==="signed-in"?"SYNK ID 계정 관리":"SYNK ID로 로그인");render();continuity?.render?.();continuity?.authChanged?.()}' + GUEST + 'function quickCard(',
    'continuity?.render?.();continuity?.authChanged?.()}' + GUEST + 'function quickCard('],
  ['mount', 'continuity=mountPlatformLibrary(continuityRoot,{getHost:()=>browserAccount,ensureReady:', 'continuity=mountPlatformLibrary(continuityRoot,{getHost:()=>browserAccount,' + SIGN_IN + 'ensureReady:',
    'continuity=mountPlatformLibrary(continuityRoot,{getHost:()=>browserAccount,' + SIGN_IN + 'ensureReady:'],
];
for (const [label, , , master] of PLACES) { once(masterBuild, master, 'master build ' + label);if (masterBefore.includes(master)) throw new Error(label + ' is older than f25a99cbb'); }
for (const name of ['browserGuest', 'authChanged', 'signIn:']) if (livePlatform.includes(name)) throw new Error('the published bundle already says ' + name);
// The places sit in the platform code outside the library regions.
const inside = (at, length) => at < A.end && at + length > A.start || at < R.end && at + length > R.start;
for (const [label, from] of PLACES) if (inside(once(livePlatform, from, label), from.length)) throw new Error(label + ' touches the library regions');
const swapped = livePlatform.slice(0, A.start) + after.A + livePlatform.slice(A.end, R.start) + after.R + livePlatform.slice(R.end);
let platform = swapped;
for (const [label, from, to] of PLACES) { once(platform, from, label);platform = platform.replace(from, () => to); }
// Undoing the two insertions gives back the published bundle with only the regions swapped: nothing else moved.
let undone = platform;
for (const [label, from, to] of PLACES) { once(undone, to, 'undo ' + label);undone = undone.replace(to, () => from); }
if (undone !== swapped) throw new Error('platform.js: bytes outside the library regions and the two places changed');
for (const needle of UNPUBLISHED) if (count(platform, needle) !== count(livePlatform, needle)) throw new Error('platform.js changed how often it says ' + needle);
// The browser account the hook reads is the published one: identity() gives configured and status (signed-out).
if (!/const identity2=\(\)=>\(\{configured:!!config2\?\.configured,signedIn:snapshot\.status==="signed-in",status:snapshot\.status==="loading"\?"restoring":snapshot\.status/.test(livePlatform) || !livePlatform.includes('return Object.freeze({status:status2,identity:identity2,'))
  throw new Error('the published browser account no longer gives identity() with configured and status');
// No new top-level clashes and no new free names (eslint-scope), as the 10-22 tool checks.
const declared = new Map();for (const st of L.statements(platform)) for (const name of st.declared) declared.set(name, (declared.get(name) || 0) + 1);
const clashes = [...declared].filter(([, n]) => n > 1).map(([name]) => name);
const liveGlobals = L.globalsOf(livePlatform), candidateGlobals = L.globalsOf(platform);
const onlyCandidate = [...candidateGlobals].filter(name => !liveGlobals.has(name)), onlyLive = [...liveGlobals].filter(name => !candidateGlobals.has(name));
if (clashes.length || onlyCandidate.length) throw new Error('platform.js names: ' + JSON.stringify({ clashes, onlyCandidate }));

const report = { portalPrior, libraryPrior, head: git('rev-parse', 'HEAD').toString().trim(), liveDir: path.resolve(liveDir), files: {
  'id/dist/app.js': { liveBytes: Buffer.byteLength(liveApp), outBytes: Buffer.byteLength(app), scopeReplaced: [start, end], priorScopeMatched: true, nextScopeBytes: Buffer.byteLength(next.text), scopeInputs: next.inputs.length, commitsSincePrior: portalSince.rows },
  'account/dist/platform.js': { liveBytes: Buffer.byteLength(livePlatform), outBytes: Buffer.byteLength(platform), regions: { A: [a0, a1], R: [r0, r1] }, priorRegionsMatched: true,
    regionBytes: { A: [before.A.length, after.A.length], R: [before.R.length, after.R.length] }, places: PLACES.map(([label]) => label), libraryInputs, commitsSincePrior: librarySince.rows,
    globals: { live: liveGlobals.size, candidate: candidateGlobals.size, onlyLive } } } };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'id__dist__app.js'), app);
fs.writeFileSync(path.join(outDir, 'account__dist__platform.js'), platform);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 1));
