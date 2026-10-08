'use strict';
// Synthetic accounts and shared in-memory CAS only. This does not sign in to or
// prove deployment of the production SYNK ID provider/database.
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { requestSpec } = require('../../../desktop/src/account-requests.cjs');
const base = process.env.CARE_QA_ORIGIN || 'http://127.0.0.1:4296';
const out = path.join(__dirname, 'account-sync-20261006');
const report = { synthetic: true, at: new Date().toISOString(), checks: [], errors: [], requests: [], screenshots: [] };
function check(name, value, detail) { report.checks.push({ name, passed: !!value, ...(detail ? { detail } : {}) }); assert.ok(value, name); }
const store = new Map(), offlineAccounts = new Set();
const record = id => store.get(id) || { revision: 0, state: null };
const names = id => (record(id).state?.people || []).map(person => person.name);

(async () => {
  const { importBackup, emptyState, makePerson, makeEvent, captureSource, recordPreparation } = await import('../model.mjs');
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function device(initialId, initialEntries = []) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' });
    await context.exposeBinding('__careFixtureRequest', async (_source, id, action, params) => {
      if (!id) return { ok: false, error: { code: 'AUTH_REQUIRED' } };
      const spec = requestSpec(action, params || {}, 'synthetic', 'platform');
      assert.equal(spec.path, 'synk-care');
      const current = record(id); report.requests.push({ accountId: id, action, revision: current.revision });
      if (action !== 'careLoad' && offlineAccounts.has(id)) return { ok: false, error: { code: 'NETWORK' } };
      if (action !== 'careLoad') {
        if (spec.body.expected_revision !== current.revision) return { ok: false, error: { code: 'REVISION_CONFLICT', status: 409 }, revision: current.revision };
        store.set(id, { revision: current.revision + 1, state: action === 'careDelete' ? null : importBackup(spec.body.state) });
      }
      const value = record(id);
      return { ok: true, scope: 'synk-care', accountId: id, revision: value.revision, updatedAt: null, state: value.state };
    });
    await context.addInitScript(({ initialId, initialEntries }) => {
      for (const [key, raw] of initialEntries) localStorage.setItem(key, raw);
      let accountId = initialId, generation = 1;
      const listeners = new Set();
      const status = () => ({ configured: true, signedIn: !!accountId, status: accountId ? 'signed-in' : 'signed-out', sessionGeneration: generation, account: accountId ? { synk_user_id: accountId, display_name: '합성 QA 계정' } : null, error: null });
      const change = id => { accountId = id; generation++; for (const listener of listeners) listener(status()); return status(); };
      window.__careFixture = { changeAccount: change, failLocal: false };
      const storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__careFixture.failLocal&&key.startsWith('synk.care.account.v1.'))throw new DOMException('synthetic quota','QuotaExceededError');return storageSet.call(this,key,value);};
      window.synkProduct = Object.freeze({ getEnvironment: async () => ({ clientId: 'care', synthetic: true }), authStatus: async () => status(), onAuthChanged: fn => { listeners.add(fn); return () => listeners.delete(fn); }, authSignIn: async () => change('synthetic-account-a'), authSignOut: async () => { change(null); return { ok: true, serverRevoked: true }; }, accountRequest: (action, body) => window.__careFixtureRequest(accountId, action, body) });
    }, { initialId, initialEntries });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(base); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    return { context, page };
  }
  const count = page => page.locator('[data-person]').count();
  const visibleNames = page => page.locator('[data-person]').allTextContents();
  async function synced(page) { await page.waitForFunction(() => document.getElementById('account-status').textContent.includes('계정에 저장했어요')); }
  async function add(page, name) { await page.locator('#add-person').click(); await page.locator('#new-person-name').fill(name); await page.locator('#person-form button[type=submit]').click(); }
  async function confirm(page) { await page.locator('#confirm-dialog [value=confirm]').click(); }
  async function refresh(page) { await page.locator('#account-refresh').click(); if (await page.locator('#confirm-dialog').isVisible()) await confirm(page); await synced(page); }
  async function capture(page, name) { await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); report.screenshots.push(name + '.png'); }
  try {
    const a = await device(null), b = await device('synthetic-account-a');
    await synced(b.page);
    await add(a.page, '기기에만 있던 사람');
    await a.page.locator('#account-signin').click(); await synced(a.page);
    check('guest notebook is not uploaded or shown in the account implicitly', await count(a.page) === 0 && names('synthetic-account-a').length === 0);
    check('explicit device-import control remains available', await a.page.locator('#account-import-device').isVisible());
    await add(a.page, '같은 계정의 사람'); await synced(a.page);
    check('first device saves with the real narrow native request schema', names('synthetic-account-a').includes('같은 계정의 사람') && record('synthetic-account-a').revision === 1);
    await refresh(b.page);
    check('second isolated browser profile reads the same account notebook', (await visibleNames(b.page)).join(' ').includes('같은 계정의 사람'));
    await add(a.page, '기기 A의 두 번째 기록'); await synced(a.page);
    await add(b.page, '충돌 시 버릴 로컬 기록'); await b.page.locator('#account-conflict').waitFor({ state: 'visible' });
    check('stale second-device save reports a conflict without overwriting the server', !names('synthetic-account-a').includes('충돌 시 버릴 로컬 기록') && names('synthetic-account-a').includes('기기 A의 두 번째 기록'));
    await capture(b.page, 'conflict-desktop');
    await b.page.locator('#account-conflict-load').click(); await confirm(b.page); await synced(b.page);
    check('explicit remote choice replaces the conflicting local notebook', !(await visibleNames(b.page)).join(' ').includes('충돌 시 버릴') && (await visibleNames(b.page)).join(' ').includes('두 번째'));
    await add(a.page, '기기 A의 세 번째 기록'); await synced(a.page);
    await add(b.page, '선택하여 남길 로컬 기록'); await b.page.locator('#account-conflict').waitFor({ state: 'visible' });
    await b.page.locator('#account-conflict-retry').click(); await confirm(b.page); await synced(b.page);
    check('explicit local choice writes against the freshly checked server revision', names('synthetic-account-a').includes('선택하여 남길 로컬 기록') && !names('synthetic-account-a').includes('기기 A의 세 번째 기록') && record('synthetic-account-a').revision === 4);
    await refresh(a.page);
    check('accepted conflict resolution is visible on the other device', (await visibleNames(a.page)).join(' ').includes('선택하여 남길'));
    await a.page.locator('#account-signout').click();
    await a.page.waitForFunction(() => !document.getElementById('account-signin').hidden);
    check('completed account copies are removed on logout', await a.page.evaluate(() => !Object.keys(localStorage).some(key => key.startsWith('synk.care.account.v1.'))));
    check('logout clears account people and restores only the original guest notebook', await count(a.page) === 1 && (await visibleNames(a.page)).join(' ').includes('기기에만 있던 사람'));
    await b.page.evaluate(() => window.__careFixture.changeAccount('synthetic-account-b')); await synced(b.page);
    check('live auth callback switches to a distinct empty account', await count(b.page) === 0 && await b.page.locator('#person-workspace').isHidden());
    await add(b.page, '다른 계정만의 사람'); await synced(b.page);
    check('second account writes cannot enter the first account', names('synthetic-account-b').includes('다른 계정만의 사람') && !names('synthetic-account-a').includes('다른 계정만의 사람'));
    await b.page.evaluate(() => window.__careFixture.changeAccount('synthetic-account-a')); await b.page.waitForFunction(()=>document.getElementById('account-status').textContent.includes('계정에 저장했어요')||!document.getElementById('account-conflict').hidden); if(await b.page.locator('#account-conflict').isVisible()){await b.page.locator('#account-conflict-load').click();await confirm(b.page);} await synced(b.page);
    check('switching back restores the correct account without second-account residue', await count(b.page) === 3 && !(await visibleNames(b.page)).join(' ').includes('다른 계정만의 사람'));
    await a.page.locator('#account-signin').click(); await synced(a.page);
    await a.page.locator('#account-import-device').click(); await confirm(a.page); await a.page.waitForFunction(() => document.querySelectorAll('[data-person]').length === 4); await synced(a.page);
    check('guest notebook is added only after explicit import confirmation', names('synthetic-account-a').includes('기기에만 있던 사람'));
    await refresh(b.page); await b.page.setViewportSize({ width: 390, height: 900 }); await capture(b.page, 'synced-mobile');
    check('account controls fit a narrow viewport', await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await a.page.locator('#delete-data').click(); await confirm(a.page); await a.page.waitForFunction(() => document.querySelectorAll('[data-person]').length === 0); await synced(a.page);
    check('account deletion writes a revisioned tombstone', record('synthetic-account-a').state === null && record('synthetic-account-a').revision === 6);
    await refresh(b.page);
    check('other device receives account deletion while unrelated account remains intact', await count(b.page) === 0 && names('synthetic-account-b').length === 1);
    await a.page.locator('#capture-source').fill('아직 보관하지 않은 새 대화');
    check('care unsubmitted conversation guards reload even after account save',await a.page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}));
    await a.page.locator('#account-signout').click();check('care unsubmitted input requires logout confirmation',await a.page.locator('#confirm-message').innerText().then(text=>text.includes('수첩에 보관하지 않은')));await a.page.locator('#confirm-dialog [value=cancel]').click();
    check('care cancelled input logout keeps unsaved conversation',await a.page.locator('#capture-source').inputValue()==='아직 보관하지 않은 새 대화');await a.page.locator('#capture-source').fill('');
    const quota=await device('synthetic-account-a');await synced(quota.page);offlineAccounts.add('synthetic-account-a');await quota.page.evaluate(()=>{__careFixture.failLocal=true;});
    await add(quota.page,'기기에 저장하지 못한 새 사람');await quota.page.waitForFunction(()=>document.getElementById('account-status').textContent.includes('연결을 기다리는'));
    check('care quota failure has no recoverable device copy',await quota.page.evaluate(()=>!Object.keys(localStorage).some(key=>key.startsWith('synk.care.account.v1.'))));
    check('care pending state guards reload and closing',await quota.page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}));
    await quota.page.locator('#account-signout').click();check('care quota logout warns that device recovery is unavailable',await quota.page.locator('#confirm-message').innerText().then(text=>text.includes('기기 임시보관도 확인하지 못했어요')));
    await quota.page.locator('#confirm-dialog [value=cancel]').click();check('care cancelled quota logout preserves in-memory people',await quota.page.locator('#account-signout').isVisible()&&(await visibleNames(quota.page)).join(' ').includes('기기에 저장하지 못한'));
    offlineAccounts.clear();await quota.page.evaluate(()=>{__careFixture.failLocal=false;});await refresh(quota.page);
    check('care cancelled quota logout can retry latest state',names('synthetic-account-a').includes('기기에 저장하지 못한 새 사람'));
    check('care completed state releases navigation guard',await quota.page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return !event.defaultPrevented;}));
    await quota.page.locator('#delete-data').click();await confirm(quota.page);await quota.page.waitForFunction(()=>document.querySelectorAll('[data-person]').length===0);await synced(quota.page);await quota.context.close();
    const cacheKey='synk.care.account.v1.synthetic-account-a';
    const outboxRaw=JSON.stringify({version:1,accountId:'synthetic-account-a',baseRevision:record('synthetic-account-a').revision,state:record('synthetic-account-b').state,pending:true});
    const pending=await device(null,[[cacheKey,outboxRaw],['other-app-private-key','preserve']]);offlineAccounts.add('synthetic-account-a');
    await pending.page.locator('#account-signin').click();await pending.page.locator('[data-local-draft]').click();await pending.page.waitForFunction(()=>document.getElementById('account-status').textContent.includes('연결을 기다리는'));
    await pending.page.locator('#account-signout').click();await confirm(pending.page);await pending.page.waitForFunction(()=>!document.getElementById('account-signin').hidden);
    check('care logout keeps pending cache and explains device retention',await pending.page.locator('#account-local-note').innerText().then(text=>text.includes('이 기기에 남아'))&&await pending.page.evaluate(key=>localStorage.getItem(key)!==null,cacheKey));
    check('signed-out care cannot export or clear account recovery',await pending.page.locator('#account-export-local').isHidden()&&await pending.page.locator('#account-clear-local').isHidden());
    await pending.page.evaluate(()=>__careFixture.changeAccount('synthetic-account-b'));await synced(pending.page);
    check('another account cannot export or clear the first account recovery',await pending.page.locator('#account-export-local').isHidden()&&await pending.page.locator('#account-clear-local').isHidden());
    await pending.page.evaluate(()=>__careFixture.changeAccount('synthetic-account-a'));await pending.page.locator('[data-local-draft]').waitFor();
    const downloadEvent=pending.page.waitForEvent('download');await pending.page.locator('#account-export-local').click();const downloaded=await downloadEvent,recovery=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));
    check('care recovery export keeps exact own pending raw',recovery.accountId==='synthetic-account-a'&&recovery.entries.some(entry=>entry.key===cacheKey&&entry.raw===outboxRaw)&&recovery.entries.every(entry=>entry.key.startsWith('synk.care.account.v1.synthetic-account-a')));
    await pending.page.locator('#account-clear-local').click();await pending.page.locator('#confirm-dialog [value=cancel]').click();
    check('care cancelled local deletion keeps outbox',await pending.page.evaluate(key=>localStorage.getItem(key)!==null,cacheKey));
    await pending.page.locator('#account-clear-local').click();await confirm(pending.page);await pending.page.waitForFunction(key=>localStorage.getItem(key)===null,cacheKey);
    check('care explicit own-device deletion unlocks editor and preserves server and unrelated storage',await pending.page.evaluate(key=>localStorage.getItem(key)===null&&localStorage.getItem('other-app-private-key')==='preserve'&&!document.querySelector('.main-grid').inert,cacheKey)&&record('synthetic-account-a').state===null);
    await pending.context.close();offlineAccounts.clear();
    const corruptRaw=JSON.stringify({version:1,accountId:'synthetic-account-a',state:{invalid:true}}),corrupt=await device(null,[[cacheKey,corruptRaw]]);
    await corrupt.page.locator('#account-signin').click();await corrupt.page.waitForFunction(()=>document.getElementById('account-detail').textContent.includes('원본을 그대로 보존'));
    check('care owned corrupt cache survives remote read with persistent warning',await corrupt.page.evaluate(({key,raw})=>localStorage.getItem(key)===raw,{key:cacheKey,raw:corruptRaw})&&await corrupt.page.locator('#account-clear-local').isVisible());
    const rawDownload=corrupt.page.waitForEvent('download');await corrupt.page.locator('#account-export-local').click();const rawFile=await rawDownload;
    check('care owned unreadable recovery file preserves exact raw',JSON.parse(await fs.readFile(await rawFile.path(),'utf8')).entries[0].raw===corruptRaw);
    await corrupt.page.setViewportSize({width:375,height:812});await capture(corrupt.page,'recovery-mobile');
    check('care recovery controls fit narrow viewport',await corrupt.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await corrupt.page.locator('#account-clear-local').click();await confirm(corrupt.page);await corrupt.page.waitForFunction(key=>localStorage.getItem(key)===null,cacheKey);
    check('care owned unreadable cache is deleted only after explicit authenticated confirmation',await corrupt.page.evaluate(key=>localStorage.getItem(key)===null,cacheKey));await corrupt.context.close();
    const unknownRaw='{"pending":true,"broken":',unknown=await device('synthetic-account-a',[[cacheKey,unknownRaw]]);await synced(unknown.page);
    check('unknown-owner corrupt original cannot be exposed or removed',await unknown.page.locator('#account-export-local').isHidden()&&await unknown.page.locator('#account-clear-local').isHidden()&&await unknown.page.locator('#account-local-note').innerText().then(text=>text.includes('계정을 확인할 수 없는'))&&await unknown.page.evaluate(({key,raw})=>localStorage.getItem(key)===raw,{key:cacheKey,raw:unknownRaw}));await unknown.context.close();
    const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'],first=structuredClone(record('synthetic-account-b').state),second=structuredClone(first);second.people[0].name='두 번째 미저장 수첩';
    const entries=ids.map((id,index)=>[`synk.care.account.v1.synthetic-account-a:draft:${id}`,JSON.stringify({version:1,accountId:'synthetic-account-a',draftId:id,createdAt:`2026-10-06T0${index+1}:00:00.000Z`,baseRevision:record('synthetic-account-a').revision,state:index?second:first,pending:true})]);
    const choices=await device('synthetic-account-a',entries);await choices.page.waitForFunction(()=>document.querySelectorAll('[data-local-draft]').length===2);
    check('care multiple drafts require explicit choice before editing',await choices.page.locator('.main-grid').evaluate(el=>el.inert));await choices.page.setViewportSize({width:375,height:812});await capture(choices.page,'local-drafts-mobile');
    check('care draft chooser fits narrow viewport and explains preservation',await choices.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await choices.page.locator('#account-local-drafts').innerText().then(text=>text.includes('선택하지 않은 기록은 보존')));
    await choices.page.locator(`[data-local-draft="${ids[1]}"]`).click();await synced(choices.page);check('care selected local notebook saves chosen record',names('synthetic-account-a').includes('두 번째 미저장 수첩'));
    check('care chosen draft ACK preserves remaining raw and its entry point',await choices.page.locator('[data-local-draft]').count()===1&&await choices.page.evaluate(([key,raw])=>localStorage.getItem(key)===raw,entries[0]));await choices.context.close();
    // Dedicated account/context: existing 500 preparation records + one new
    // guest preparation must not prevent importing its person/event/memory.
    const cappedOwner='synthetic-preparation-cap-owner';
    const notebook=(id,label)=>{
      const person=makePerson({id:`${id}_person`,name:label}),event=makeEvent({id:`${id}_event`,personId:person.id,type:'birthday',date:'2026-10-08'});
      let value={...emptyState(),people:[person],events:[event]};
      const quote=`${label}와 함께 산책한 기억`;
      value=captureSource(value,{personId:person.id,title:`${label} 원문`,text:quote,memories:[{kind:'memory',text:quote,sourceQuote:quote}]},'2026-10-05T01:00:00Z');
      return recordPreparation(value,{personId:person.id,eventId:event.id,recommendedAction:'contact'},'2026-10-05T02:00:00Z');
    };
    const remoteCap=notebook('cap_remote','계정에 있던 사람'),guestCap=notebook('cap_guest','기기에서 가져올 사람');
    remoteCap.preparations=Array.from({length:500},(_,index)=>({...remoteCap.preparations[0],id:`cap_preparation_${index}`}));
    store.set(cappedOwner,{revision:0,state:importBackup(remoteCap)});
    const capped=await device(null,[['synk.care.local.v1',JSON.stringify(guestCap)]]);
    await capped.page.evaluate(id=>__careFixture.changeAccount(id),cappedOwner);await synced(capped.page);
    await capped.page.locator('#account-import-device').click();await confirm(capped.page);
    await capped.page.waitForFunction(()=>document.querySelectorAll('[data-person]').length===2);await synced(capped.page);
    const merged=record(cappedOwner).state,unchanged=(key)=>JSON.stringify(merged[key])===JSON.stringify([...remoteCap[key],...guestCap[key]]);
    check('500 account preparations plus one guest preparation import successfully while preserving both people events sources and memories',record(cappedOwner).revision===1&&['people','events','sources','memories'].every(unchanged)&&merged.preparations.length===500&&merged.preparations[0].id==='cap_preparation_1'&&merged.preparations.at(-1).id===guestCap.preparations[0].id&&await capped.page.evaluate(expected=>JSON.stringify(JSON.parse(localStorage.getItem('synk.care.local.v1')).preparations)===JSON.stringify(expected),guestCap.preparations),{people:merged.people.length,events:merged.events.length,memories:merged.memories.length,preparations:merged.preparations.length});
    await capped.context.close();
    check('no uncaught browser errors', report.errors.length === 0, report.errors);
    await a.context.close(); await b.context.close();
  } finally {
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2)); await browser.close();
    console.log(JSON.stringify({ synthetic: true, passed: report.checks.filter(check => check.passed).length, total: report.checks.length, errors: report.errors, output: out }));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
