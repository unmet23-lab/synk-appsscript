// Puts SYNK TOWN's 「마을 기록」 card (W6c) onto the published SYNK ID portal (id/) and WORLD's account sheet
// (account/client.html?product=world) without rebuilding either bundle.
//   node experiences/synk-account/qa/town-records-20261028/patch-live.mjs <live dir> <out dir> [<prior rev>]
// <live dir> holds the published id/dist/app.js, id/style.css, account/dist/client.js and account/style.css as
// id__dist__app.js, id__style.css, account__dist__client.js and account__style.css (and, read only, account/client.html and
// account/assets/scrapbook.css as account__client.html and account__assets__scrapbook.css); the candidates go to <out dir>
// under the same names, with report.json. The pages (id/index.html, account/client.html) keep their bytes; tools/공개.js
// renews their ?v= tokens. The default <prior rev> is the 10-27 portal publish (synk-policy 5271cd6); the next portal patch
// gives the appsscript commit this one was published from.
// - Both bundles: the published account client gains the card's three methods (townExportPage, townRecords, townRights — the
//   lines of this checkout's generated account-client.cjs) and nothing else in it changes.
// - id/dist/app.js: the portal is its own scope (../login-ux-20261027/patch-live.mjs). That scope must equal <prior rev>'s
//   portal built the same way, byte for byte, before this checkout's portal (portal-account with the card) replaces it.
// - account/dist/client.js: the published account view is older than this checkout's, so the card's hunks of 9e3f7045d go
//   into it in place, each found exactly once; the card module (desktop/renderer/town-records-card.mjs) rides as its own scope.
// - id/style.css: this checkout's file in the published line endings; the published one must be where W6c started.
// - account/style.css: the published (older) file plus the card's rules from this checkout's style.css.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), portal = path.resolve(here, '../..'), repo = path.resolve(portal, '../..');
const esbuild = createRequire(path.join(portal, 'package.json'))('esbuild');
const [liveDir, outDir, priorRev = 'd17bbeaad'] = process.argv.slice(2);
if (!liveDir || !outDir) throw new Error('usage: patch-live.mjs <live dir> <out dir> [<prior rev>]');
const count = (text, needle) => text.split(needle).length - 1;
const once = (text, needle, label) => { const n = count(text, needle);if (n !== 1) throw new Error(`${label}: expected one match, found ${n}`);return text.indexOf(needle); };
const replaceOnce = (text, from, to, label) => { once(text, from, label);return text.replace(from, () => to); };
const git = (...args) => execFileSync('git', args, { cwd: repo, maxBuffer: 1 << 26 });
const read = name => fs.readFileSync(path.join(liveDir, name), 'utf8');
const UNPUBLISHED = ['createWardrobeView', 'createClassroomTownHost', 'WORLD_GAMES', 'createWorldLearningHost', '말 랠리'];

// --- the account client: the card's three methods after exportAiPage, in both bundles ------------------------------
const CLIENT_ANCHOR = '${until==null?"":`&until=${encodeURIComponent(until)}`}`),learning:Object.freeze({get:';
const METHODS = 'townExportPage:({afterCommand="",afterEvent="",at=""}={})=>request(`synk-account?view=town-export&afterCommand=${encodeURIComponent(afterCommand)}&afterEvent=${encodeURIComponent(afterEvent)}&at=${encodeURIComponent(at)}`),'
  + 'townRecords:options=>request("synk-town/records",void 0,options),townRights:({id,type,payload={},expectedRevision})=>request("synk-town/records",{id,type,payload,expectedRevision}),';
// The lines are this checkout's generated client, minified the way the bundles are.
const generated = fs.readFileSync(path.join(portal, 'src/generated/account-client.cjs'), 'utf8');
for (const line of ['townExportPage: ({ afterCommand = \'\', afterEvent = \'\', at = \'\' } = {}) => request(`synk-account?view=town-export&afterCommand=${encodeURIComponent(afterCommand)}&afterEvent=${encodeURIComponent(afterEvent)}&at=${encodeURIComponent(at)}`),',
  "townRecords: options => request('synk-town/records', undefined, options),", "townRights: ({ id, type, payload = {}, expectedRevision }) => request('synk-town/records', { id, type, payload, expectedRevision }),"])
  if (!generated.includes(line)) throw new Error('the generated account client no longer has: ' + line.slice(0, 60));
function withClient(bundle, label) {
  if (bundle.includes('townRecords')) throw new Error(label + ' already has the town methods');
  if (!/atlasSummary:options=>request\("synk-account\?view=atlas",void 0,options\)/.test(bundle)) throw new Error(label + ': the account client request no longer takes options third');
  const at = once(bundle, CLIENT_ANCHOR, label + ' account client') + CLIENT_ANCHOR.indexOf('learning:Object.freeze');
  return { text: bundle.slice(0, at) + METHODS + bundle.slice(at), at };
}

// --- id/dist/app.js: the portal scope ---------------------------------------------------------------------------------
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
// rev: build from that commit's files (read through git) instead of this checkout's.
async function portalScope(rev) {
  const inputs = [];
  const built = await esbuild.build({ stdin: { contents: 'export { mountPortal, authErrorMessage, authRateLimit, cleanAuthCallbackUrl } from "./portal.mjs";', resolveDir: path.join(portal, 'src'), loader: 'js' },
    bundle: true, write: false, format: 'iife', globalName: '__synkPortal', target: ['es2022'], charset: 'utf8', minifyWhitespace: true,
    plugins: [{ name: 'published-modules', setup(b) {
      b.onResolve({ filter: /.*/ }, a => Object.keys(STUBS).includes(path.basename(a.path)) ? { path: path.basename(a.path), namespace: 'published' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'published' }, a => ({ contents: STUBS[a.path], loader: 'js' }));
      b.onLoad({ filter: /\.(?:mjs|cjs|js)$/ }, a => { const rel = path.relative(repo, a.path).split(path.sep).join('/');inputs.push(rel);
        return rev ? { contents: git('show', `${rev}:${rel}`).toString('utf8'), loader: 'js' } : undefined; });
    } }] });
  const inner = built.outputFiles[0].text.trim();
  if (!inner.startsWith('var __synkPortal=')) throw new Error('unexpected inner bundle head');
  return { text: `${bridge}${inner}${TAIL}`, inputs };
}
const live = read('id__dist__app.js');
const start = once(live, 'var __synkPortalLive={', 'published portal scope'), end = once(live, TAIL, 'published portal tail') + TAIL.length;
for (const name of Object.values(LIVE).map(value => value.split('.')[0])) if (!new RegExp(`(?:var|let|const|function)\\s+${name}\\b`).test(live.slice(0, start))) throw new Error('published bundle does not declare ' + name + ' before the portal');
const prior = await portalScope(priorRev);
if (prior.text !== live.slice(start, end)) throw new Error(`the published portal scope is not ${priorRev}'s portal`);
const next = await portalScope(null);
// Every module in the new scope is either unchanged since <prior rev> or changed by W6c alone (no one's unpublished work).
const since = git('log', '--format=%h', `${priorRev}..HEAD`, '--', ...next.inputs).toString().trim().split('\n').filter(Boolean);
const W6C = ['9e3f7045d'], foreign = since.filter(hash => !W6C.some(own => own.startsWith(hash) || hash.startsWith(own)));
if (foreign.length) throw new Error('portal modules changed since the prior publish by ' + foreign.join(' '));
for (const needle of ['마을 기록', 'town-block', 'town-heading', 'townExport', '연습 기록과 내 정보, 마을 기록', 'createPortalSecurity', 'synk.id.recent-login.v1']) if (!next.text.includes(needle)) throw new Error('patched scope lacks ' + needle);
for (const needle of UNPUBLISHED) if (next.text.includes(needle)) throw new Error('patched scope carries unpublished ' + needle);
const appClient = withClient(live.slice(0, start), 'id/dist/app.js');
const app = appClient.text + next.text + live.slice(end);
if (appClient.text.slice(0, appClient.at) + appClient.text.slice(appClient.at + METHODS.length) !== live.slice(0, start) || app.slice(appClient.text.length + next.text.length) !== live.slice(end)) throw new Error('app.js: bytes outside the client lines and the portal scope changed');

// --- account/dist/client.js: the card into the published account view --------------------------------------------------
const liveClient = read('account__dist__client.js');
for (const name of ['__synkTownRecords', 'createTownRecords', 'attachTownRecords', 'townExport', 'TOWN_CLASSES', 'confirmTown', 'drawTown', 'townFor', 'townCard', 'townData', 'myInfo'])
  if (new RegExp(`\\b${name}\\b`).test(liveClient)) throw new Error('account/dist/client.js already uses the name ' + name);
const card = (await esbuild.build({ stdin: { contents: 'export { createTownRecords, attachTownRecords, townExport } from "./town-records-card.mjs";', resolveDir: path.join(repo, 'desktop/renderer'), loader: 'js' },
  bundle: true, write: false, format: 'iife', globalName: '__synkTownRecords', target: ['es2022'], charset: 'utf8', minifyWhitespace: true, metafile: true }));
if (Object.keys(card.metafile.inputs).filter(input => !input.startsWith('<stdin>')).length !== 1) throw new Error('the card module now imports others');
const cardScope = card.outputFiles[0].text.trim() + ';';
if (!cardScope.startsWith('var __synkTownRecords=')) throw new Error('unexpected card scope head');
// The hunks of 9e3f7045d in account-view.mjs, minified as the master bundle has them (the published view names its element
// helper element2 and its sessions card sessions, as master's build does apart from that card).
const HUNKS = [
  ['module head', '})}var memberLabel=', '})}' + cardScope + 'var{createTownRecords,attachTownRecords,townExport}=__synkTownRecords;'
    + 'var TOWN_CLASSES=Object.freeze({button:"plain",note:"small",link:"plain link",retry:"plain"});'
    + 'function confirmTown({title,ok}){return new Promise(resolve=>{const dialog=element2("dialog");if(typeof dialog.showModal!=="function"){resolve(false);return}const form=element2("form",null,"actions");form.method="dialog";const yes=element2("button",ok,"plain");yes.value="ok";const no=element2("button","취소","plain");no.value="cancel";no.autofocus=true;form.append(yes,no);dialog.append(element2("h2",title),form);dialog.addEventListener("close",()=>{resolve(dialog.returnValue==="ok");dialog.remove()},{once:true});document.body.append(dialog);dialog.showModal()})}'
    + 'var memberLabel='],
  ['view state', 'learningPending=false,learningUnconfirmed=false,playEntryUsed=false;const closeGame=()=>{',
    'learningPending=false,learningUnconfirmed=false,playEntryUsed=false;let drawTown=null,townFor=null;const town=createTownRecords({load:async()=>{const reply=await client.townRecords();guard();if(ended)throw Object.assign(new Error("closed"),{code:"ACCOUNT_CHANGED"});return reply},send:async command=>{const reply=await client.townRights(command);guard();if(ended)throw Object.assign(new Error("closed"),{code:"ACCOUNT_CHANGED"});return reply},confirm:confirmTown,onChange:()=>drawTown?.()});const closeGame=()=>{'],
  ['first read', 'learningUnconfirmed=false;data=result;render()}function applyAccount(',
    'learningUnconfirmed=false;data=result;render();if(!localConnection&&typeof client.townRecords==="function"&&townFor!==data.account?.synk_user_id){townFor=data.account?.synk_user_id??null;void town.refresh()}}function applyAccount('],
  ['card', 'void atlas(memory);const rights=card("이용 권한");',
    'void atlas(memory);let townCard=null;if(!localConnection&&typeof client.townRecords==="function"){townCard=card("마을 기록");townCard.classList.add("town-card");const body=element2("div");townCard.append(body);drawTown=attachTownRecords(town,body,{classes:TOWN_CLASSES,headingLevel:4})}const rights=card("이용 권한");'],
  ['grid', 'grid.append(identity,learning,memory,rights,sessions);root.append(grid);', 'grid.append(identity,learning,memory,...townCard?[townCard]:[],rights,sessions);root.append(grid);'],
  ['export state', 'const events=[],metadata=[];let after=0,until,atlasMemory;', 'const events=[],metadata=[];let after=0,until,atlasMemory,myInfo,townData;'],
  ['export pages', 'if(after===0&&Array.isArray(result.atlasMemory))atlasMemory=result.atlasMemory;if(!Array.isArray(result.events)',
    'if(after===0&&Array.isArray(result.atlasMemory))atlasMemory=result.atlasMemory;if(after===0&&Object.hasOwn(result,"town"))townData=await townExport(result.town,async page2=>{const reply=await client.townExportPage(page2);guard();return reply});if(Object.hasOwn(result,"myInfo"))myInfo=result.myInfo;if(!Array.isArray(result.events)'],
  ['export file', 'account:result.account||data.account,...atlasMemory?{atlasMemory}:{},until,events,eventMeta:metadata}',
    'account:result.account||data.account,...myInfo!==void 0?{myInfo}:{},...atlasMemory?{atlasMemory}:{},...townData!==void 0?{town:townData}:{},until,events,eventMeta:metadata}'],
  ['stop', 'return{load,applyAccount,launchRun,closeGame,stop(){ended=true;loadVersion++;document.body.classList.remove("account-open");',
    'return{load,applyAccount,launchRun,closeGame,stop(){ended=true;loadVersion++;town.reset();drawTown=null;townFor=null;document.body.classList.remove("account-open");'],
];
// The hunks land inside the one account view (between its head and the next module).
const viewStart = once(liveClient, 'function createAccountView({client,product,guard,notice:notice2,logout,preview=false,localConnection=false,onGameRequest=null,classConnection=null}){', 'published account view');
const viewEnd = once(liveClient, '}}}function createDesktopAccountClient(', 'published account view end');
const clientWithMethods = withClient(liveClient, 'account/dist/client.js');
let client = clientWithMethods.text;
for (const [label, from] of HUNKS.slice(1)) { const at = once(liveClient, from, label);if (at < viewStart || at > viewEnd) throw new Error(label + ' is outside the account view'); }
for (const [label, from, to] of HUNKS) client = replaceOnce(client, from, to, label);
const addedClient = Buffer.byteLength(client) - Buffer.byteLength(liveClient);
const expectedAdded = Buffer.byteLength(METHODS) + HUNKS.reduce((sum, [, from, to]) => sum + Buffer.byteLength(to) - Buffer.byteLength(from), 0);
if (addedClient !== expectedAdded) throw new Error('client.js grew by an unexpected amount');
for (const needle of UNPUBLISHED) if (count(client, needle) !== count(liveClient, needle)) throw new Error('client.js changed how often it says ' + needle);

// --- style sheets -----------------------------------------------------------------------------------------------------
const lf = text => text.replace(/\r\n/g, '\n');
const styleLines = lf(fs.readFileSync(path.join(portal, 'style.css'), 'utf8'));
const startedFrom = git('show', '9e3f7045d^:experiences/synk-account/style.css').toString('utf8');
const liveStyle = read('id__style.css');
if (lf(liveStyle) !== startedFrom) throw new Error('the published id/style.css is not the one W6c started from');
if (lf(git('show', 'HEAD:experiences/synk-account/style.css').toString('utf8')) !== styleLines) throw new Error('style.css has uncommitted changes');
const idStyle = liveStyle.includes('\r\n') ? styleLines.replace(/\n/g, '\r\n') : styleLines;
const cardRules = styleLines.split('\n').filter(line => /^\.town-records|^\/\* 「마을 기록」/.test(line));
const narrowRule = styleLines.split('\n').find(line => line.trim().startsWith('.town-records-row{grid-template-columns:minmax(0,1fr)}'));
if (cardRules.length !== 8 || !narrowRule) throw new Error('style.css card rules are not where they were');
const liveAccountStyle = read('account__style.css');
if (/town-records/.test(liveAccountStyle)) throw new Error('account/style.css already has the card rules');
// The sheet's colours come from the scrap book sheet the page links before it (account__assets__scrapbook.css, account__client.html).
if (!/href="\.\/assets\/scrapbook\.css"[^]*href="\.\/style\.css"/.test(read('account__client.html'))) throw new Error('account/client.html no longer links scrapbook.css before style.css');
for (const token of ['--muted', '--brand-wash', '--ink']) if (!(read('account__assets__scrapbook.css') + liveAccountStyle).includes(token + ':')) throw new Error('the WORLD sheet does not define ' + token);
const eol = liveAccountStyle.includes('\r\n') ? '\r\n' : '\n';
const accountStyle = liveAccountStyle.replace(/\s*$/, '') + eol + [...cardRules, `@media(max-width:700px){${narrowRule.trim()}}`].join(eol) + eol;

const report = { priorRev, liveDir: path.resolve(liveDir), files: {
  'id/dist/app.js': { liveBytes: Buffer.byteLength(live), outBytes: Buffer.byteLength(app), clientLinesAt: appClient.at, scopeReplaced: [start, end], priorScopeMatched: true, nextScopeBytes: Buffer.byteLength(next.text), scopeInputs: next.inputs },
  'account/dist/client.js': { liveBytes: Buffer.byteLength(liveClient), outBytes: Buffer.byteLength(client), clientLinesAt: clientWithMethods.at, hunks: HUNKS.map(([label]) => label), cardScopeBytes: Buffer.byteLength(cardScope) },
  'id/style.css': { liveBytes: Buffer.byteLength(liveStyle), outBytes: Buffer.byteLength(idStyle) },
  'account/style.css': { liveBytes: Buffer.byteLength(liveAccountStyle), outBytes: Buffer.byteLength(accountStyle), addedRules: cardRules.length + 1 } } };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'id__dist__app.js'), app);
fs.writeFileSync(path.join(outDir, 'account__dist__client.js'), client);
fs.writeFileSync(path.join(outDir, 'id__style.css'), idStyle);
fs.writeFileSync(path.join(outDir, 'account__style.css'), accountStyle);
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, files: Object.fromEntries(Object.entries(report.files).map(([key, value]) => [key, { ...value, scopeInputs: value.scopeInputs?.length }])) }));
