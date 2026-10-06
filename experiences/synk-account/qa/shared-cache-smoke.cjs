'use strict';
// Real isolated Chrome tabs share origin/localStorage and import the actual
// served document-sync module. Only the document schema and account API are fixtures.
// No existing browser profile, real login, external provider or deployed API is used.
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const base = new URL(process.env.CARE_QA_ORIGIN || 'http://127.0.0.1:4296');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(base.hostname) || base.pathname !== '/') throw Error('Use a loopback QA origin only.');
const label = process.argv[2] || 'result';
if (!/^[a-z][a-z0-9-]{0,40}$/.test(label) || process.argv.length > 3) throw Error('Optional report label must be a simple filename.');
const out = path.join(__dirname, 'shared-cache-20261006');
const runId = randomUUID(), owner = 'synthetic-shared-cache-owner', sourceUrl = new URL('/synk-account/src/document-sync.mjs', base).href;
const report = { synthetic: true, realBrowser: 'isolated Chrome, one context, shared localStorage', actualModule: sourceUrl, startedAt: new Date().toISOString(), checks: [], requests: [], errors: [], screenshots: [], remoteMutation: false, realLogin: false };
function check(name, condition, detail) { report.checks.push({ name, passed: !!condition, ...(detail ? { detail } : {}) }); assert.ok(condition, name); }
const state = text => ({ version: 1, text });
const cases = new Map(); let heldAck, heldLive;
const fixture = id => { if (!cases.has(id)) cases.set(id, { revision: 0, state: state('server initial') }); return cases.get(id); };
const prefix = id => `synthetic.shared-cache.qa.${runId}.${id}.`;
async function until(predicate) { const end = Date.now() + 5000; while (!predicate()) { if (Date.now() > end) throw Error('Fixture synchronization timed out'); await new Promise(resolve => setTimeout(resolve, 15)); } }
const html = '<!doctype html><meta charset="utf-8"><title>Shared cache synthetic QA</title><style>body{font:17px system-ui;margin:36px;background:#f4f0e8;color:#242a3b}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:24px;border-radius:12px}small{color:#566}</style><h1>실제 Chrome 공유 캐시 시험</h1><small>실제 서빙 모듈 · 합성 계정 통로 · 격리된 프로필</small><pre id="view">준비 중</pre>';

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1120, height: 850 }, timezoneId: 'Asia/Seoul' });
  const pages = new Set();
  try {
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== base.origin) return route.abort('blockedbyclient');
      if (url.pathname === '/__shared-cache-qa__') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    });
    const sourceResponse = await context.request.get(sourceUrl);
    assert.equal(sourceResponse.status(), 200);
    const source = await sourceResponse.body(); report.moduleSha256 = createHash('sha256').update(source).digest('hex');
    await context.exposeBinding('__syncTransport', async (_source, id, action, body) => {
      const current = fixture(id); report.requests.push({ case: id, action, expectedRevision: body?.expected_revision ?? null });
      if (action === 'personalSave') {
        if (body.expected_revision !== current.revision) return { ok: false, error: { code: 'REVISION_CONFLICT' }, revision: current.revision };
        current.revision++; current.state = structuredClone(body.state);
      } else if (action === 'personalDelete') {
        if (body.expected_revision !== current.revision) return { ok: false, error: { code: 'REVISION_CONFLICT' }, revision: current.revision };
        current.revision++; current.state = null;
      } else assert.equal(action, 'personalLoad');
      const reply = { ok: true, scope: 'synk-personal', resource: 'family-album', accountId: owner, revision: current.revision, state: structuredClone(current.state) };
      if (id === 'late-ack' && action === 'personalSave' && body.state.text === 'A sent snapshot') return new Promise(resolve => { heldAck = () => resolve(reply); });
      if(id==='single-live'&&action==='personalSave')return new Promise(resolve=>{heldLive=()=>resolve(reply);});
      return reply;
    });
    async function tab(id, name) {
      const page = await context.newPage(); pages.add(page);
      page.on('pageerror', error => report.errors.push({ tab: name, message: error.message }));
      await page.goto(new URL('/__shared-cache-qa__?tab=' + name, base).href);
      await page.evaluate(async ({ id, name, owner, prefix, sourceUrl }) => {
        const { createDocumentSync } = await import(sourceUrl);
        const validate = value => { if (value?.version !== 1 || typeof value.text !== 'string') throw Error('Invalid synthetic state'); return { version: 1, text: value.text }; };
        const qa = window.__qa = { id, name, owner, prefix, states: [], statuses: [], storageEvents: [] };
        const render = () => { document.getElementById('view').textContent = JSON.stringify({ tab: name, state: qa.states.at(-1), status: qa.statuses.at(-1), sharedEntries: qa.entries?.() }, null, 2); };
        qa.entries = () => Object.keys(localStorage).filter(key => key.startsWith(prefix)).sort().map(key => ({ key, raw: localStorage.getItem(key) }));
        addEventListener('storage', event => { if (event.key?.startsWith(prefix)) qa.storageEvents.push({ key: event.key, raw: event.newValue }); });
        qa.sync = createDocumentSync({ transport: (action, body) => window.__syncTransport(id, action, body), storage: localStorage,
          scope: 'synk-personal', resource: 'family-album', cachePrefix: prefix, validateState: validate, emptyState: () => ({ version: 1, text: '' }),
          operations: { load: 'personalLoad', save: 'personalSave', delete: 'personalDelete' },
          onState: value => { qa.states.push(value); render(); }, onStatus: value => { qa.statuses.push(value); render(); } });
        qa.render = render;
      }, { id, name, owner, prefix: prefix(id), sourceUrl });
      return page;
    }
    async function open(page) { return page.evaluate(() => __qa.sync.open(__qa.owner)); }
    async function snapshot(page) { return page.evaluate(() => ({ state: __qa.states.at(-1), status: __qa.statuses.at(-1), entries: __qa.entries(), backup: (()=>{try{return __qa.sync.exportLocalRecords();}catch(error){return {error:error.code};}})() })); }
    async function closeTab(page) { await page.evaluate(() => __qa.sync.close()); await page.close(); pages.delete(page); }
    async function capture(page, name) { await page.evaluate(() => __qa.render()); const file = `${label}-${name}.png`; await page.screenshot({ path: path.join(out, file), fullPage: true }); report.screenshots.push(file); }

    // Reproduces the observed loss: A sends, B edits/closes, A receives late ACK.
    const a = await tab('late-ack', 'A'), b = await tab('late-ack', 'B');
    await open(a); await open(b);
    await a.evaluate(() => { __qa.sync.change({ version: 1, text: 'A sent snapshot' }); __qa.flushTask = __qa.sync.flush(); });
    await until(() => typeof heldAck === 'function');
    await b.evaluate(() => { __qa.sync.change({ version: 1, text: 'B unsent original' }); __qa.sync.close(); });
    await a.waitForFunction(()=>__qa.entries().some(entry=>JSON.parse(entry.raw).state.text==='B unsent original'));
    const beforeAck = await snapshot(a);
    check('a real second tab writes a pending original into shared localStorage', beforeAck.entries.some(entry => JSON.parse(entry.raw).state.text === 'B unsent original'),beforeAck);
    await b.close(); pages.delete(b);
    heldAck(); heldAck = null;
    check('first tab save receives its held acknowledgement', await a.evaluate(() => __qa.flushTask));
    const afterAck = await snapshot(a);
    check('A late ACK never deletes closed B unsent original', afterAck.entries.some(entry => JSON.parse(entry.raw).state.text === 'B unsent original'));
    check('A acknowledgement clears only the sent A snapshot', !afterAck.entries.some(entry => JSON.parse(entry.raw).state.text === 'A sent snapshot'));
    await capture(a, 'late-ack-preserved'); await closeTab(a);
    const recovered = await tab('late-ack', 'C'); await open(recovered);
    check('single pending original waits for explicit recovery choice',await recovered.evaluate(()=>__qa.statuses.at(-1).status==='local-conflict'&&__qa.states.at(-1).text==='A sent snapshot'));
    await recovered.evaluate(()=>__qa.sync.selectLocalDraft(__qa.statuses.at(-1).localDrafts[0].id));
    const recoveredState = await snapshot(recovered);
    check('a newly opened tab recovers B exact pending original', recoveredState.state.text === 'B unsent original' && recoveredState.status.pending === true);
    check('recovered stale revision reports CAS conflict rather than silently overwriting A', recoveredState.status.status === 'conflict' && recoveredState.status.error?.code === 'REVISION_CONFLICT' && fixture('late-ack').state.text === 'A sent snapshot');
    check('explicit local resolution saves the recovered B original', await recovered.evaluate(() => __qa.sync.resolveLocal()) && fixture('late-ack').state.text === 'B unsent original');
    check('successfully resolved recovered draft leaves no completed cache', (await snapshot(recovered)).entries.length === 0);
    await closeTab(recovered);

    // Independent unsent edits must neither overwrite each other nor be chosen implicitly.
    const first = await tab('parallel-drafts', 'A2'), second = await tab('parallel-drafts', 'B2');
    await open(first); await open(second);
    await first.evaluate(() => { __qa.sync.change({ version: 1, text: 'first independent original' }); __qa.sync.close(); });
    await second.evaluate(() => { __qa.sync.change({ version: 1, text: 'second independent original' }); __qa.sync.close(); });
    const both = await snapshot(first);
    check('independent tab edits retain two exact originals instead of overwriting a single key', ['first independent original', 'second independent original'].every(text => both.entries.some(entry => JSON.parse(entry.raw).state.text === text)));
    await closeTab(first); await closeTab(second);
    const chooser = await tab('parallel-drafts', 'C2'); await open(chooser);
    const choice = await snapshot(chooser);
    check('fresh open stops with an explicit local draft conflict', choice.status.status === 'local-conflict' && choice.status.localDrafts?.length === 2);
    check('opening competing drafts makes no implicit save', report.requests.filter(request => request.case === 'parallel-drafts' && request.action === 'personalSave').length === 0 && fixture('parallel-drafts').revision === 0);
    check('recovery export retains both exact original strings', choice.backup.entries.length === 2 && both.entries.every(entry => choice.backup.entries.some(next => next.key === entry.key && next.raw === entry.raw)));
    await capture(chooser, 'local-draft-choice');
    const firstEntry = choice.entries.find(entry => JSON.parse(entry.raw).state.text === 'first independent original');
    const selectedId = choice.status.localDrafts.find(draft => draft.id === firstEntry.key || firstEntry.key.endsWith(draft.id))?.id;
    check('offered draft ID identifies a preserved export entry', typeof selectedId === 'string');
    check('explicit draft selection recovers the requested original', await chooser.evaluate(async id => { const result = await __qa.sync.selectLocalDraft(id); return result !== false && __qa.states.at(-1).text === 'first independent original'; }, selectedId));
    check('selected draft can save with server CAS', await chooser.evaluate(() => __qa.sync.flush()) && fixture('parallel-drafts').state.text === 'first independent original');
    const selectedSaved = await snapshot(chooser);
    check('selected draft ACK preserves the other tab original exactly', selectedSaved.entries.length === 1 && JSON.parse(selectedSaved.entries[0].raw).state.text === 'second independent original' && selectedSaved.entries[0].raw === both.entries.find(entry => JSON.parse(entry.raw).state.text === 'second independent original').raw);
    await closeTab(chooser);
    const final = await tab('parallel-drafts', 'D2'); await open(final);
    await final.evaluate(()=>__qa.sync.selectLocalDraft(__qa.statuses.at(-1).localDrafts[0].id));
    const beforeRemote = await snapshot(final);
    check('the remaining unselected original is recoverable on another fresh open', beforeRemote.state.text === 'second independent original' && beforeRemote.status.pending === true);
    check('explicit remote view succeeds without deleting a preserved draft', await final.evaluate(() => __qa.sync.resolveRemote()));
    const remoteView = await snapshot(final);
    check('remote view displays server state while exact local recovery remains', remoteView.state.text === 'first independent original' && remoteView.backup.entries.some(entry => entry.raw === beforeRemote.entries[0].raw));
    const sentinel = `synthetic.unrelated-product.${runId}`;
    await final.evaluate(key => localStorage.setItem(key, 'keep unrelated original'), sentinel);
    check('authenticated explicit clear removes only this owner after opening server state',await final.evaluate(key=>__qa.sync.clearLocalRecords()===true&&__qa.entries().length===0&&localStorage.getItem(key)==='keep unrelated original',sentinel));
    await final.evaluate(()=>__qa.sync.close());
    check('signed-out export and clearing are rejected',await final.evaluate(()=>{try{__qa.sync.exportLocalRecords();return false;}catch(error){return error.code==='LOCAL_RECOVERY_AUTH_REQUIRED'&&__qa.sync.clearLocalRecords()===false;}}));
    await capture(final,'explicit-clear');await closeTab(final);

    // A live writer owns the only draft. A newly opened tab must not send it.
    const writer=await tab('single-live','live-writer');await open(writer);
    await writer.evaluate(()=>{__qa.sync.change({version:1,text:'live writer final'});__qa.flushTask=__qa.sync.flush();});await until(()=>typeof heldLive==='function');
    const reader=await tab('single-live','new-reader');await open(reader);
    check('new tab offers the active writer single draft without taking it over',await reader.evaluate(()=>__qa.statuses.at(-1).status==='local-conflict'&&__qa.statuses.at(-1).localDrafts.length===1)&&report.requests.filter(r=>r.case==='single-live'&&r.action==='personalSave').length===1);
    heldLive();heldLive=null;await writer.evaluate(()=>__qa.flushTask);
    await reader.waitForFunction(()=>__qa.statuses.at(-1).status==='synced'&&__qa.statuses.at(-1).localDrafts.length===0);
    check('real storage event unlocks the other tab after the last draft ACK with no relogin',await reader.evaluate(()=>__qa.states.at(-1).text==='live writer final'&&__qa.storageEvents.some(event=>event.raw===null))&&report.requests.filter(r=>r.case==='single-live'&&r.action==='personalSave').length===1);
    await closeTab(writer);await closeTab(reader);
    const afterSource = await context.request.get(sourceUrl);
    check('served module did not change during the browser run', createHash('sha256').update(await afterSource.body()).digest('hex') === report.moduleSha256);
    check('browser page execution raised no uncaught errors', report.errors.length === 0);
    report.passed = report.checks.filter(item => item.passed).length;
  } catch (error) { report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    heldAck?.();heldLive?.();
    for (const page of pages) if (!page.isClosed()) await page.evaluate(() => window.__qa?.sync.close()).catch(() => {});
    await context.close(); await browser.close();
    report.finishedAt = new Date().toISOString(); report.passed = report.checks.filter(item => item.passed).length;
    await fs.writeFile(path.join(out, `${label}.json`), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ report: path.join(out, `${label}.json`), passed: report.passed, checks: report.checks.length, failure: report.failure?.message || null, synthetic: true }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
