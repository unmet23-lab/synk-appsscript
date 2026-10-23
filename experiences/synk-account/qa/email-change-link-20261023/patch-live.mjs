// Puts the e-mail-change token-hash link onto the published SYNK ID bundle (id/dist/app.js) without rebuilding it.
//   node experiences/synk-account/qa/email-change-link-20261023/patch-live.mjs <live dir> <out dir> [<prior rev>]
// <live dir> holds the published id/dist/app.js as id__dist__app.js; the patched file goes to <out dir> under the
// same name, with report.json. Only portal.mjs changed, and 10-22 already put the portal into the published bundle
// as its own scope (../account-security-20261022/patch-live.mjs). So the published portal scope must equal
// <prior rev>'s portal built the same way, byte for byte, before this checkout's portal replaces it — anything else
// someone published there since stops the patch. Every other module stays byte for byte the published one.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), portal = path.resolve(here, '../..'), repo = path.resolve(portal, '../..');
const esbuild = createRequire(path.join(portal, 'package.json'))('esbuild');
const [liveDir, outDir, priorRev = 'e3b0fdd37'] = process.argv.slice(2);
if (!liveDir || !outDir) throw new Error('usage: patch-live.mjs <live dir> <out dir> [<prior rev>]');
const once = (text, needle, label) => { const n = text.split(needle).length - 1;if (n !== 1) throw new Error(`${label}: expected one match, found ${n}`);return text.indexOf(needle); };

// The same scope as 10-22: the portal's imports read the published bundle's own names lazily.
const LIVE = { createAccountClient: 'import_account_client.createAccountClient', PRODUCTS: 'PRODUCTS', firstPartyAuthorization: 'firstPartyAuthorization', trustedConsentRedirect: 'trustedConsentRedirect',
  createAccountView: 'createAccountView', createGoogleAccess: 'createGoogleAccess', createSignupConversion: 'createSignupConversion' };
const bridge = `var __synkPortalLive={${Object.entries(LIVE).map(([key, value]) => `get ${key}(){return ${value}}`).join(',')}};`;
const stubs = {
  'account-client.cjs': 'export function createAccountClient(...a){return __synkPortalLive.createAccountClient(...a)}',
  'core.mjs': 'export const PRODUCTS=__synkPortalLive.PRODUCTS;export function firstPartyAuthorization(...a){return __synkPortalLive.firstPartyAuthorization(...a)}export function trustedConsentRedirect(...a){return __synkPortalLive.trustedConsentRedirect(...a)}',
  'account-view.mjs': 'export function createAccountView(...a){return __synkPortalLive.createAccountView(...a)}',
  'google-auth.mjs': 'export function createGoogleAccess(...a){return __synkPortalLive.createGoogleAccess(...a)}',
  'social-signup-conversion.mjs': 'export function createSignupConversion(...a){return __synkPortalLive.createSignupConversion(...a)}',
};
const TAIL = 'var{mountPortal,authErrorMessage,authRateLimit,cleanAuthCallbackUrl}=__synkPortal;';
async function scope(srcDir) {
  const built = await esbuild.build({ stdin: { contents: 'export { mountPortal, authErrorMessage, authRateLimit, cleanAuthCallbackUrl } from "./portal.mjs";', resolveDir: srcDir, loader: 'js' },
    bundle: true, write: false, format: 'iife', globalName: '__synkPortal', target: ['es2022'], charset: 'utf8', minifyWhitespace: true,
    plugins: [{ name: 'published-modules', setup(b) {
      b.onResolve({ filter: /.*/ }, a => stubs[path.basename(a.path)] !== undefined ? { path: path.basename(a.path), namespace: 'published' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'published' }, a => ({ contents: stubs[a.path], loader: 'js' }));
    } }] });
  const inner = built.outputFiles[0].text.trim();
  if (!inner.startsWith('var __synkPortal=')) throw new Error('unexpected inner bundle head');
  return `${bridge}${inner}${TAIL}`;
}

const live = fs.readFileSync(path.join(liveDir, 'id__dist__app.js'), 'utf8');
const start = once(live, 'var __synkPortalLive={', 'published portal scope'), end = once(live, TAIL, 'published portal tail') + TAIL.length;
for (const name of Object.values(LIVE).map(value => value.split('.')[0])) if (!new RegExp(`(?:var|let|const|function)\\s+${name}\\b`).test(live.slice(0, start))) throw new Error('published bundle does not declare ' + name + ' before the portal');
// <prior rev>'s portal sources, built the 10-22 way, must be exactly what is published now.
const priorDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-portal-prior-'));
try {
  for (const file of ['portal.mjs', 'portal-security.mjs']) fs.writeFileSync(path.join(priorDir, file), execFileSync('git', ['show', `${priorRev}:experiences/synk-account/src/${file}`], { cwd: repo, maxBuffer: 1 << 26 }));
  if (await scope(priorDir) !== live.slice(start, end)) throw new Error(`the published portal scope is not ${priorRev}'s portal`);
} finally { fs.rmSync(priorDir, { recursive: true, force: true }); }
const next = await scope(path.join(portal, 'src'));
const app = live.slice(0, start) + next + live.slice(end);
for (const needle of ['type:"email_change"', 'email-change', '이메일 변경 확인하기', 'type:"recovery"', 'createPortalSecurity']) if (!app.includes(needle)) throw new Error('patched bundle lacks ' + needle);
if (app.slice(0, start) !== live.slice(0, start) || app.slice(start + next.length) !== live.slice(end)) throw new Error('bytes outside the portal scope changed');
const report = { priorRev, files: { 'id/dist/app.js': { liveBytes: Buffer.byteLength(live), outBytes: Buffer.byteLength(app), scopeReplaced: [start, end], priorScopeMatched: true, nextScopeBytes: Buffer.byteLength(next) } } };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'id__dist__app.js'), app);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
