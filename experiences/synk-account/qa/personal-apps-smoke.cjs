'use strict';
// Synthetic native bridge in isolated browser contexts. No real account or network upload.
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const out = path.join(__dirname, 'personal-apps-20261006');
const report = { at: new Date().toISOString(), checks: [], errors: [], missing: [], screenshots: [] };
const check = (name, value, detail) => { report.checks.push({ name, passed: !!value, detail }); assert.ok(value, `${name}: ${JSON.stringify(detail)}`); };
const loadModule = relative => import(pathToFileURL(path.resolve(__dirname, relative)).href);
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); report.screenshots.push(name);
  const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, images: [...document.images].filter(i => i.offsetWidth && (!i.complete || !i.naturalWidth)).map(i => i.src) }));
  check(`${name}: viewport and images`, metrics.scroll <= metrics.width + 1 && !metrics.images.length, metrics);
}
function fakeAccount({ resource, guest, seed }) {
  const clone = value => structuredClone(value);
  if (guest?.key) localStorage.setItem(guest.key, guest.raw ?? JSON.stringify(guest.state));
  for(const [key,raw] of guest?.entries||[])localStorage.setItem(key,raw);
  let signedIn = false, sessionGeneration = 0, listener, owner = 'synthetic-account-a', serial = 0;
  const records = new Map(), assets = new Map();
  if(seed){records.set(owner,clone(seed.record));for(const [assetId,asset] of seed.assets)assets.set(assetId,{...asset,bytes:Uint8Array.from(asset.bytes)});serial=seed.assets.length;}
  const qa = { log: [], failSave: false, failRead: false, holdRead: false, releaseRead: null, rejectAssetOnce: null,
    remote() { return clone(records.get(owner) || { revision: 0, state: null }); },
    alter(state) { const previous = this.remote(); records.set(owner, { revision: previous.revision + 1, state: clone(state) }); },
    switchAccount(id) { owner = id; signedIn = true; sessionGeneration++; listener?.(status()); },
    signOut() { signedIn = false; sessionGeneration++; listener?.(status()); },
    snapshot() { return {record:this.remote(),assets:[...assets].map(([key,value])=>[key,{...value,bytes:Array.from(value.bytes)}])}; },
    usage() {const own=[...assets.values()].filter(asset=>asset.owner===owner);return {count:own.length,bytes:own.reduce((n,a)=>n+a.ref.size,0)};},
    forgetAsset(assetId) {assets.delete(assetId);},
  };
  const storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(qa.failLocal&&key.startsWith('synk.personal.'))throw new DOMException('synthetic quota','QuotaExceededError');return storageSet.call(this,key,value);};
  const status = () => ({ configured: true, status: signedIn ? 'signed-in' : 'signed-out', signedIn, sessionGeneration, account: signedIn ? { synk_user_id: owner } : null });
  const response = state => ({ ok: true, scope: 'synk-personal', resource, accountId: owner, updatedAt: '2026-10-06T00:00:00.000Z', ...state });
  window.__qa = qa;
  window.synkPersonalAccount = {
    getEnvironment: async () => ({ clientId: resource }), authStatus: async () => status(),
    authSignIn: async () => { signedIn = true; sessionGeneration++; const next = status(); listener?.(next); return next; },
    authSignOut: async () => { qa.signOut(); return { ok: true }; },
    onAuthChanged: callback => { listener = callback; return () => { listener = null; }; },
    accountRequest: async (operation, params = {}) => {
      const startedOwner = owner;
      qa.log.push({ operation, owner, state: operation === 'personalSave' ? clone(params.state) : undefined });
      if (!signedIn) return { ok: false, error: { code: 'AUTH_REQUIRED' } };
      const current = qa.remote();
      if (operation === 'personalLoad') return response(current);
      if (operation === 'personalSave' || operation === 'personalDelete') {
        if (qa.failSave) return { ok: false, error: { code: 'NETWORK' } };
        if (params.expected_revision !== current.revision) return { ok: false, revision: current.revision, error: { code: 'REVISION_CONFLICT' } };
        if(operation==='personalSave'&&resource==='family-album'){
          if(qa.rejectAssetOnce){const code=qa.rejectAssetOnce;qa.rejectAssetOnce=null;const assetId=params.state.pages.flatMap(p=>[p.photo?.mediaRef?.assetId,p.audio?.mediaRef?.assetId]).find(Boolean);return {ok:false,error:{code,assetId}};}
          for(const page of params.state.pages)for(const slot of ['photo','audio'])if(page[slot]&&assets.get(page[slot].mediaRef.assetId)?.owner!==owner)return {ok:false,error:{code:'ASSET_NOT_FOUND',assetId:page[slot].mediaRef.assetId}};
        }
        const next = { revision: current.revision + 1, state: operation === 'personalDelete' ? null : clone(params.state) };
        if(resource==='family-album'){
          const ids=state=>new Set((state?.pages||[]).flatMap(p=>[p.photo?.mediaRef?.assetId,p.audio?.mediaRef?.assetId].filter(Boolean))),keep=ids(next.state);
          if(operation==='personalDelete'){for(const [id,asset] of assets)if(asset.owner===owner)assets.delete(id);}
          else for(const id of ids(current.state))if(!keep.has(id))assets.delete(id);
        }
        records.set(owner, next); return response(next);
      }
      if (operation === 'assetUpload') {
        if(qa.rejectUploadOnce){const code=qa.rejectUploadOnce;qa.rejectUploadOnce=null;return {ok:false,error:{code}};}
        const bytes = new Uint8Array(params.bytes);if(qa.usage().count>=60||qa.usage().bytes+bytes.length>20*1024*1024)return {ok:false,error:{code:'MEDIA_QUOTA_EXCEEDED'}};
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
        const ref = { assetId: `10000000-0000-4000-8000-${String(++serial).padStart(12, '0')}`, sha256, mime: params.mime, kind: params.kind, size: bytes.length };
        assets.set(ref.assetId, { ref, bytes, owner: startedOwner }); return response({ mediaRef: ref });
      }
      if (operation === 'assetRead') {
        if(qa.failRead)return {ok:false,error:{code:'NETWORK',message:'합성 원본 읽기 실패'}};
        if (qa.holdRead) await new Promise(resolve => { qa.releaseRead = resolve; });
        const asset = assets.get(params.assetId);
        if (!asset || asset.owner !== startedOwner) return { ok: false, error: { code: 'ASSET_NOT_FOUND', assetId:params.assetId } };
        return { ...response({ mediaRef: asset.ref, bytes: asset.bytes.buffer }), accountId: startedOwner };
      }
      return { ok: false, error: { code: 'INVALID_REQUEST' } };
    },
  };
}
async function waitSaved(page) { await page.waitForFunction(() => document.querySelector('[data-notebook-status]').textContent === '계정에 저장했어요'); }
async function signIn(page) { await page.locator('[data-notebook=signin]').click(); await waitSaved(page); await page.waitForFunction(() => !document.querySelector('main').inert); }
async function signOut(page) { await page.locator('[data-notebook=signout]').click(); await page.waitForFunction(() => !document.querySelector('[data-notebook=signin]').hidden); }

(async () => {
  await fs.mkdir(out, { recursive: true });
  const servers = [], browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const configs = [['path', '../../path-vr/server.mjs'], ['rehearsal', '../../conversation-rehearsal/server.mjs'], ['family-album', '../../family-album/server.mjs']];
    const origins = {};
    for (const [resource, file] of configs) { const mod = await loadModule(file), server = mod.createServer({ port: 0 }); if (server.start) await server.start(); else await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server); origins[resource] = `http://127.0.0.1:${server.address().port}`; }
    async function open(resource, guest, seed) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } }), page = await context.newPage();
      await page.addInitScript(fakeAccount, { resource, guest, seed });
      page.on('pageerror', error => report.errors.push(`${resource}: ${error.message}`));
      page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) report.missing.push(`${response.status()}: ${response.url()}`); });
      page.on('dialog', dialog => dialog.accept()); await page.goto(origins[resource]); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      await page.waitForFunction(() => !document.querySelector('[data-notebook=signin]').disabled); return { context, page };
    }
    const pathModel = await loadModule('../../path-vr/model.mjs'), personal = await loadModule('../src/personal-data.mjs');
    const pathGuest = pathModel.recordAnswer({ ...pathModel.initialState(), consent: true }, 'welcome', 0, 2, false, '2026-10-06T00:00:00.000Z');
    {
      const { page, context } = await open('path', { key: pathModel.STORAGE_KEY, state: pathGuest });
      await signIn(page);
      check('PATH login never uploads guest', await page.evaluate(() => !__qa.log.some(x => x.operation === 'personalSave')));
      check('PATH account initially empty', (await page.locator('#checklist').innerText()).includes('0 / 2'));
      await page.locator('[data-choice="0"]').click(); await waitSaved(page);
      check('PATH save ACK preserves chosen answer', await page.locator('[data-choice="0"]').getAttribute('aria-pressed') === 'true');
      check('PATH successful save has no account copy on device', await page.evaluate(() => !Object.keys(localStorage).some(key => key.startsWith('synk.personal.path.v1.'))));
      check('PATH state omits device consent', await page.evaluate(() => !Object.hasOwn(__qa.remote().state, 'consent')));
      await page.evaluate(() => { __qa.failSave = true; }); await page.locator('#next-button').click();
      await page.waitForFunction(() => document.querySelector('[data-notebook-status]').textContent === '연결을 기다리고 있어요');
      check('PATH offline retains local next step', (await page.locator('#step-label').innerText()).includes('상황 2'));
      await page.evaluate(() => { __qa.failSave = false; }); await page.locator('[data-notebook=retry]').click(); await waitSaved(page);
      await page.evaluate(() => { const value = __qa.remote().state; value.zone = 'career'; __qa.alter(value); });
      await page.locator('[data-choice="1"]').click(); await page.waitForFunction(() => !document.querySelector('.notebook-conflict').hidden);
      check('PATH cross-device conflict exposed', await page.locator('.notebook-conflict').isVisible());
      await page.locator('[data-notebook=remote]').click(); await waitSaved(page);
      check('PATH explicit remote choice loads remote zone', await page.locator('#zone-title').innerText() === '진로 상담실');
      await screenshot(page, 'path-account-375'); await signOut(page);
      check('PATH signout restores original guest', (await page.locator('#checklist').innerText()).includes('이해하지 못한') || await page.evaluate(() => JSON.parse(localStorage.getItem('synk.path.rehearsal.v1')).answers[0].choice === 2));
      await page.setViewportSize({ width: 1440, height: 960 }); await screenshot(page, 'path-guest-1440'); await context.close();
    }
    {
      const key='synk.personal.path.v1.synthetic-account-a',state=personal.pathAccountState(pathGuest),raw=JSON.stringify({version:1,accountId:'synthetic-account-a',baseRevision:0,state,pending:true});
      const {page,context}=await open('path',{key,raw});await page.evaluate(()=>{__qa.failSave=true;localStorage.setItem('other-app-private-key','leave untouched');});
      await page.locator('[data-notebook=signin]').click();await page.locator('[data-notebook=select-draft]').click();await page.waitForFunction(()=>document.querySelector('[data-notebook-status]').textContent==='연결을 기다리고 있어요');await signOut(page);
      check('pending outbox remains after logout with explicit device notice',await page.evaluate(key=>localStorage.getItem(key)!==null,key)&&await page.locator('[data-notebook-local]').innerText().then(text=>text.includes('이 기기에 남아')));
      check('signed-out visitor cannot export or clear another account draft',await page.locator('[data-notebook=export-local]').isHidden()&&await page.locator('[data-notebook=clear-local]').isHidden());
      await page.locator('[data-notebook=signin]').click();await page.locator('[data-notebook=select-draft]').waitFor();
      const downloadEvent=page.waitForEvent('download');await page.locator('[data-notebook=export-local]').click();const download=await downloadEvent,recovery=JSON.parse(await fs.readFile(await download.path(),'utf8'));
      check('pending recovery file contains exact raw only for this app',recovery.entries.some(entry=>entry.key===key&&entry.raw===raw)&&recovery.entries.every(entry=>entry.key.startsWith('synk.personal.path.v1.')));
      page.removeAllListeners('dialog');page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-notebook=clear-local]').click();
      check('cancelling device clear preserves outbox',await page.evaluate(key=>localStorage.getItem(key)!==null,key));
      page.once('dialog',dialog=>dialog.accept());await page.locator('[data-notebook=clear-local]').click();
      check('confirmed device clear leaves remote and other app untouched',await page.evaluate(key=>localStorage.getItem(key)===null&&localStorage.getItem('other-app-private-key')==='leave untouched'&&__qa.remote().state===null,key));await context.close();
    }
    {
      const key='synk.personal.path.v1.synthetic-account-a',raw=JSON.stringify({version:1,accountId:'synthetic-account-a',state:{invalid:true}});
      const {page,context}=await open('path',{key,raw},{record:{revision:1,state:personal.pathAccountState(pathGuest)},assets:[]});
      await page.locator('[data-notebook=signin]').click();await page.waitForFunction(()=>document.querySelector('[data-notebook-status]').textContent==='계정 기록 확인 필요');
      check('corrupt cache warning remains after remote load and raw is unchanged',await page.locator('[data-notebook-detail]').innerText().then(text=>text.includes('원본을 그대로 보존'))&&await page.evaluate(({key,raw})=>localStorage.getItem(key)===raw,{key,raw}));
      check('verified account can explicitly clear its own corrupt recovery when not editing',await page.locator('[data-notebook=clear-local]').isEnabled());
      const downloaded=page.waitForEvent('download');await page.locator('[data-notebook=export-local]').click();const file=await downloaded;
      check('corrupt recovery export preserves unreadable bytes',JSON.parse(await fs.readFile(await file.path(),'utf8')).entries[0].raw===raw);
      await page.evaluate(()=>{__qa.failSave=true;__qa.failLocal=true;});await page.locator('[data-choice="0"]').click();await page.waitForFunction(()=>document.querySelector('[data-notebook-status]').textContent==='연결을 기다리고 있어요');
      page.removeAllListeners('dialog');let corruptPrompt='';page.once('dialog',async dialog=>{corruptPrompt=dialog.message();await dialog.dismiss();});await page.locator('[data-notebook=signout]').click();
      check('corrupt cache new edits warn before logout and cancel keeps editor',corruptPrompt.includes('기기 임시보관도 확인하지 못했어요')&&await page.locator('[data-notebook=signout]').isVisible()&&await page.locator('[data-choice="0"]').getAttribute('aria-pressed')==='true'&&await page.evaluate(({key,raw})=>localStorage.getItem(key)===raw,{key,raw}));
      page.on('dialog',dialog=>dialog.accept());await signOut(page);check('signed-out notice shows only local record presence and preserves corrupt raw',await page.locator('[data-notebook-local]').innerText().then(text=>text.includes('임시기록'))&&await page.evaluate(({key,raw})=>localStorage.getItem(key)===raw,{key,raw}));
      check('signed-out corrupt recovery cannot be exported or cleared',await page.locator('[data-notebook=export-local]').isHidden()&&await page.locator('[data-notebook=clear-local]').isHidden());
      await page.evaluate(()=>{__qa.failSave=false;__qa.failLocal=false;});await page.locator('[data-notebook=signin]').click();await page.locator('[data-notebook=clear-local]').click();check('corrupt raw is deleted only by its verified owner action',await page.evaluate(key=>localStorage.getItem(key)===null,key));await context.close();
    }
    {
      const {page,context}=await open('path');await signIn(page);await page.evaluate(()=>{__qa.failSave=true;__qa.failLocal=true;});
      await page.locator('[data-choice="0"]').click();await page.waitForFunction(()=>document.querySelector('[data-notebook-status]').textContent==='연결을 기다리고 있어요');
      check('quota refusal leaves latest PATH answer only in memory',await page.locator('[data-choice="0"]').getAttribute('aria-pressed')==='true'&&await page.evaluate(()=>!Object.keys(localStorage).some(key=>key.startsWith('synk.personal.path.v1.'))&&__qa.remote().state===null));
      page.removeAllListeners('dialog');let prompt='';page.once('dialog',async dialog=>{prompt=dialog.message();await dialog.dismiss();});await page.locator('[data-notebook=signout]').click();
      check('quota failure signout requires explicit loss warning and cancel preserves editor',prompt.includes('기기 임시보관도 확인하지 못했어요')&&await page.locator('[data-notebook=signout]').isVisible()&&await page.locator('[data-choice="0"]').getAttribute('aria-pressed')==='true');
      await page.evaluate(()=>{__qa.failLocal=false;__qa.failSave=false;});await page.locator('[data-notebook=retry]').click();await waitSaved(page);
      check('cancelled quota logout can retry latest in-memory state',await page.evaluate(()=>__qa.remote().state.answers[0].choice===0));await context.close();
    }
    {
      const state=personal.pathAccountState(pathGuest),other={...state,zone:'career'},ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
      const entries=ids.map((id,index)=>[`synk.personal.path.v1.synthetic-account-a:draft:${id}`,JSON.stringify({version:1,accountId:'synthetic-account-a',draftId:id,createdAt:`2026-10-06T0${index+1}:00:00.000Z`,baseRevision:0,state:index?other:state,pending:true})]);
      const {page,context}=await open('path',{entries});await page.locator('[data-notebook=signin]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-notebook=select-draft]').length===2);
      check('multiple pending drafts block implicit selection and editing',await page.locator('main').evaluate(el=>el.inert)&&await page.evaluate(()=>!__qa.log.some(item=>item.operation==='personalSave')));
      check('draft chooser shows creation times and preserves alternatives',await page.locator('[data-notebook-drafts]').innerText().then(text=>text.includes('2026.')&&text.includes('선택하지 않은 기록은 보존')));
      await screenshot(page,'local-drafts-375');await page.locator(`[data-notebook=select-draft][data-draft-id="${ids[1]}"]`).click();await waitSaved(page);
      check('explicit pending draft selection opens chosen content',await page.locator('#zone-title').innerText()==='진로 상담실');
      check('saving chosen draft keeps the other draft selectable and exact',await page.locator('[data-notebook=select-draft]').count()===1&&await page.evaluate(([key,raw])=>localStorage.getItem(key)===raw,entries[0]));
      await page.locator('[data-notebook=select-draft]').click();await page.waitForFunction(()=>!document.querySelector('.notebook-conflict').hidden);
      check('remaining draft selection obeys server revision conflict',await page.locator('#zone-title').innerText()==='안내 데스크'&&await page.locator('.notebook-conflict').isVisible());await context.close();
    }
    const rehearsalModel = await loadModule('../../conversation-rehearsal/domain.mjs');
    let session = rehearsalModel.createSession({ scenario: 'interview', counterpart: '가상 면접관', goal: '내 경험 말하기', id: 'guest-session', at: '2026-10-06T00:00:00.000Z' });
    for(let i=0;i<3;i++)session=rehearsalModel.appendTurn(session,{answer:`기기에서 쓴 말 ${i}`,focus:'specific',review:'easy'});
    const guestArchive=rehearsalModel.archive([session]);
    {
      const { page, context } = await open('rehearsal', { key: 'synk-rehearsal-v1', state: guestArchive }); await signIn(page);
      check('rehearsal login never uploads guest', await page.evaluate(() => !__qa.log.some(x => x.operation === 'personalSave')));
      await page.locator('[data-notebook=import]').click(); await waitSaved(page);
      check('rehearsal explicit guest import', await page.evaluate(() => __qa.remote().state.sessions[0].id === 'guest-session'));
      await page.locator('.memory>summary').click();await page.locator('[data-action=history]').click(); await page.locator('[name=firstSentence]').fill('지금 적는 계정 문장'); await page.locator('#takeaway [type=submit]').click(); await waitSaved(page);
      check('rehearsal save ACK preserves editor', await page.locator('[name=firstSentence]').inputValue() === '지금 적는 계정 문장');
      await screenshot(page, 'rehearsal-account-375');
      await page.evaluate(()=>__qa.switchAccount('synthetic-account-b'));await waitSaved(page);
      check('rehearsal account switch does not carry prior account records',await page.evaluate(()=>__qa.remote().state===null));
      await signOut(page);
      check('rehearsal guest storage preserved', await page.evaluate(() => JSON.parse(localStorage.getItem('synk-rehearsal-v1')).sessions[0].firstSentence === ''));
      check('rehearsal switching accounts preserves original guest save preference',await page.locator('[name=save]').isChecked());
      await page.setViewportSize({ width: 1440, height: 960 }); await screenshot(page, 'rehearsal-guest-1440'); await context.close();
    }
    {
      const { page, context } = await open('family-album');
      await page.locator('[data-action=sample]').click(); await page.waitForFunction(() => location.hash.startsWith('#page/'));
      await signIn(page); check('family login never uploads guest', await page.evaluate(() => !__qa.log.some(x => x.operation === 'personalSave')));
      await page.locator('[data-notebook=import]').click(); await waitSaved(page);
      check('family explicit text album import', await page.evaluate(() => __qa.remote().state.pages.length === 1));
      await page.locator('[data-action=open]').click(); await page.locator('[data-action=edit]').click();
      await page.locator('#photo-file').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBv8AAAAASUVORK5CYII=', 'base64') });
      await page.waitForFunction(() => document.querySelector('#photo-preview img'));
      await page.locator('#story-form [type=submit]').click(); await waitSaved(page);
      check('family original stored as confirmed reference', await page.evaluate(() => { const p=__qa.remote().state.pages[0];return p.photo.mediaRef.kind==='image'&&!JSON.stringify(p).includes('base64'); }));
      await page.evaluate(()=>{const value=__qa.remote().state;value.pages[0].title+=' · 원본 확인';__qa.alter(value);});
      await page.locator('[data-notebook=refresh]').click(); await waitSaved(page);
      check('family original hydrated into gallery', await page.locator('.page-card .cover').getAttribute('src').then(src => src.startsWith('data:image/png;base64,')));
      await page.evaluate(()=>{__qa.failRead=true;const value=__qa.remote().state;value.pages[0].title+=' · 다시 읽기';__qa.alter(value);});
      await page.locator('[data-notebook=refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-notebook-status]').textContent==='기록을 다시 불러와 주세요');
      check('family failed original hydration prevents editing incomplete account data',await page.locator('#main').evaluate(el=>el.inert));
      await page.evaluate(()=>{__qa.failRead=false;});await page.locator('[data-notebook=refresh]').click();await waitSaved(page);
      check('family same revision original read can recover explicitly',await page.locator('.page-card h3').innerText().then(text=>text.includes('다시 읽기')));
      for(const code of ['ASSET_NOT_FOUND','ASSET_NOT_CONFIRMED']){
        const before=await page.evaluate(()=>({assetId:__qa.remote().state.pages[0].photo.mediaRef.assetId,uploads:__qa.log.filter(x=>x.operation==='assetUpload').length}));
        await page.locator('[data-action=open]').click();await page.locator('[data-action=edit]').click();await page.locator('#title').fill(`원본 복구 ${code}`);
        await page.evaluate(code=>{__qa.rejectAssetOnce=code;},code);await page.locator('#story-form [type=submit]').click();
        await page.waitForFunction(()=>document.querySelector('[data-notebook-status]').textContent==='계정 기록 확인 필요');
        check(`family ${code} shows pending original retention accurately`,await page.locator('[data-notebook-pending]').innerText().then(text=>text.includes('7일')&&text.includes('정상 저장된 앨범 원본은 이 기한으로 삭제되지')));
        await page.locator('[data-notebook=retry]').click();await waitSaved(page);
        check(`family ${code} retry reuploads current original and replaces ref`,await page.evaluate(before=>__qa.remote().state.pages[0].photo.mediaRef.assetId!==before.assetId&&__qa.log.filter(x=>x.operation==='assetUpload').length===before.uploads+1,before));
        await page.locator('.brand[data-action=home]').click();
      }
      await page.locator('[data-action=open]').click();await page.locator('[data-action=edit]').click();await page.locator('#title').fill('보관 공간 확인');
      await page.locator('#photo-file').setInputFiles({name:'quota-retry.png',mimeType:'image/png',buffer:Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBv8AAAAASUVORK5CYII=','base64'),Buffer.from([0])])});await page.waitForFunction(()=>document.querySelector('#photo-preview img'));
      await page.evaluate(()=>{__qa.rejectUploadOnce='MEDIA_QUOTA_EXCEEDED';});await page.locator('#story-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-notebook-status]').textContent==='계정 기록 확인 필요');
      check('family upload quota refusal is an error with concrete removal-first guidance',await page.locator('[data-notebook-detail]').innerText().then(text=>text.includes('20MiB')&&text.includes('제거하고 저장을 마친 뒤')));
      check('family unuploaded original prevents silent navigation loss',await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}));
      await page.locator('[data-notebook=retry]').click();await waitSaved(page);await page.locator('.brand[data-action=home]').click();
      check('family rejected original remains available for explicit retry',await page.evaluate(()=>__qa.remote().state.pages[0].title==='보관 공간 확인'));
      const firstSource=await page.locator('.page-card .cover').getAttribute('src'),snapshot=await page.evaluate(()=>__qa.snapshot());
      const second=await open('family-album',null,snapshot);await signIn(second.page);
      check('family new browser context restores exact original bytes',await second.page.locator('.page-card .cover').getAttribute('src')===firstSource);
      check('family second context only reads account state',await second.page.evaluate(()=>!__qa.log.some(x=>x.operation==='personalSave'||x.operation==='assetUpload')));
      second.page.removeAllListeners('dialog');second.page.once('dialog',dialog=>dialog.dismiss());await second.page.locator('[data-notebook=delete]').click();
      check('family whole album deletion requires confirmation',await second.page.evaluate(()=>__qa.remote().state.pages.length===1));
      second.page.once('dialog',dialog=>dialog.accept());await second.page.locator('[data-notebook=delete]').click();await waitSaved(second.page);
      check('family whole account album delete reaches CAS operation',await second.page.evaluate(()=>__qa.remote().state===null&&__qa.log.some(item=>item.operation==='personalDelete')));
      check('family whole album deletion removes completed device cache',await second.page.evaluate(()=>!Object.keys(localStorage).some(key=>key.startsWith('synk.personal.family-album.v1.'))));
      await second.context.close();
      const stale=structuredClone(snapshot.record.state);stale.pages[0].title='미저장 변경';stale.pages[0].photo.mediaRef.assetId='90000000-0000-4000-8000-000000000001';
      const cacheKey='synk.personal.family-album.v1.synthetic-account-a';
      const lost=await open('family-album',{key:cacheKey,state:{version:1,accountId:'synthetic-account-a',baseRevision:snapshot.record.revision,state:stale,pending:true}},snapshot);
      await lost.page.locator('[data-notebook=signin]').click();await lost.page.locator('[data-notebook=select-draft]').click();await lost.page.waitForFunction(()=>!document.querySelector('[data-notebook=recover]').hidden);
      const remoteTitle=await lost.page.evaluate(()=>__qa.remote().state.pages[0].title);
      await lost.page.locator('[data-notebook=refresh]').click();await lost.page.waitForFunction(()=>!document.querySelector('[data-notebook=recover]').hidden);
      check('family missing pending original refresh retains unsaved manifest',await lost.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).pending,cacheKey));
      lost.page.removeAllListeners('dialog');let discardPrompt='';lost.page.once('dialog',async dialog=>{discardPrompt=dialog.message();await dialog.dismiss();});
      await lost.page.locator('[data-notebook=recover]').click();
      check('family recovery confirms switching screen while preserving unsaved recovery',discardPrompt.includes('복구용으로 이 기기에 남겨 두고')&&discardPrompt.includes('현재 화면은 저장본으로'));
      check('family cancelled recovery preserves pending state',await lost.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).pending,cacheKey));
      lost.page.once('dialog',dialog=>dialog.accept());await lost.page.locator('[data-notebook=recover]').click();await waitSaved(lost.page);
      check('family confirmed recovery restores last committed album and preserves outbox',await lost.page.locator('.page-card h3').innerText()===remoteTitle&&await lost.page.evaluate(key=>localStorage.getItem(key)!==null,cacheKey));
      await lost.context.close();
      await screenshot(page, 'family-account-375');
      await page.evaluate(() => { __qa.holdRead=true;const value=__qa.remote().state;value.pages[0].title+=' · 늦은 변경';__qa.alter(value); }); await page.locator('[data-notebook=refresh]').click();
      await page.waitForFunction(() => !!__qa.releaseRead); await page.evaluate(() => { __qa.signOut();__qa.releaseRead(); });
      await page.waitForFunction(() => !document.querySelector('[data-notebook=signin]').hidden);
      check('family late hydration cannot replace guest', await page.locator('.page-card .cover').getAttribute('src').then(src => !src.startsWith('data:')));
      check('family signout restores guest page', await page.locator('.page-card').count() === 1);
      await page.setViewportSize({ width:1440,height:960 });await screenshot(page,'family-guest-1440');await context.close();
    }
    {
      const {page,context}=await open('family-album');await signIn(page);
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBv8AAAAASUVORK5CYII=','base64'),media=[];
      for(let i=0;i<3;i++){const bytes=Buffer.alloc(5*1024*1024);png.copy(bytes);bytes[bytes.length-1]=i+1;media.push(bytes);}
      const large={format:'synk-family-album',version:1,pages:media.map((bytes,i)=>({id:`quota-page-${i}`,title:`용량 회귀 ${i+1}`,date:'',person:'합성 가족',author:'나',story:'원본을 지운 뒤 되돌리기를 확인하는 합성 기록',photo:{name:`synthetic-${i}.png`,type:'image/png',data:`data:image/png;base64,${bytes.toString('base64')}`},audio:null,details:{},skipped:[],contributions:[],createdAt:'2026-10-06T00:00:00.000Z',updatedAt:'2026-10-06T00:00:00.000Z'}))};
      const file={name:'synk-family-album.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(large))};
      const importLarge=async()=>{await page.locator('#import-file').setInputFiles(file);await page.locator('#confirm-import').click();await waitSaved(page);};
      await importLarge();
      const initial=await page.evaluate(()=>({ids:__qa.remote().state.pages.map(p=>p.photo.mediaRef.assetId),uploads:__qa.log.filter(x=>x.operation==='assetUpload').length}));
      check('family quota fixture stores three real 5MiB originals under 20MiB cap',await page.evaluate(()=>__qa.usage().bytes===15*1024*1024&&__qa.usage().count===3));
      await page.locator('.page-card').nth(2).click();await page.locator('[data-action=delete]').click();await waitSaved(page);
      check('family acknowledged page removal immediately releases its server original',await page.evaluate(()=>__qa.usage().bytes===10*1024*1024&&__qa.usage().count===2));
      await page.locator('#undo-action').click();await waitSaved(page);
      check('family delete undo only reuploads removed original and avoids orphan quota growth',await page.evaluate(before=>__qa.remote().state.pages.length===3&&__qa.usage().bytes===15*1024*1024&&__qa.usage().count===3&&__qa.log.filter(x=>x.operation==='assetUpload').length===before.uploads+1&&__qa.remote().state.pages.slice(0,2).every((p,i)=>p.photo.mediaRef.assetId===before.ids[i]),initial));
      await page.locator('.page-card').nth(2).click();await page.locator('[data-action=edit]').click();await page.locator('[data-action=remove-media][data-kind=photo]').click();await page.locator('#story-form [type=submit]').click();await waitSaved(page);
      check('family saving a removed photo immediately releases quota',await page.evaluate(()=>__qa.usage().bytes===10*1024*1024));
      await page.locator('[data-action=edit]').click();await page.locator('#photo-file').setInputFiles({name:'same-original.png',mimeType:'image/png',buffer:media[2]});await page.waitForFunction(()=>document.querySelector('#photo-preview img'));await page.locator('#story-form [type=submit]').click();await waitSaved(page);
      check('family reinserting the same photo never reuses its deleted server ref',await page.evaluate(before=>__qa.usage().bytes===15*1024*1024&&__qa.usage().count===3&&__qa.log.filter(x=>x.operation==='assetUpload').length===before.uploads+2,initial));
      const beforeRetry=await page.evaluate(()=>{const ids=__qa.remote().state.pages.map(p=>p.photo.mediaRef.assetId);__qa.forgetAsset(ids[2]);return {ids,uploads:__qa.log.filter(x=>x.operation==='assetUpload').length};});
      await page.locator('[data-action=edit]').click();await page.locator('#title').fill('사라진 원본 하나만 복구');await page.locator('#story-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-notebook-status]').textContent==='계정 기록 확인 필요');
      await page.locator('[data-notebook=retry]').click();await waitSaved(page);
      check('family missing-original retry uploads exactly one file and preserves healthy refs',await page.evaluate(before=>__qa.usage().bytes===15*1024*1024&&__qa.usage().count===3&&__qa.log.filter(x=>x.operation==='assetUpload').length===before.uploads+1&&__qa.remote().state.pages.slice(0,2).every((p,i)=>p.photo.mediaRef.assetId===before.ids[i]),beforeRetry));
      await page.locator('[data-notebook=delete]').click();await waitSaved(page);
      check('family whole-album delete releases all originals',await page.evaluate(()=>__qa.remote().state===null&&__qa.usage().count===0));
      await importLarge();
      check('family whole-album delete clears cache before the same originals are imported again',await page.evaluate(()=>__qa.remote().state.pages.length===3&&__qa.usage().bytes===15*1024*1024&&__qa.usage().count===3));
      await context.close();
    }
    check('no uncaught page exceptions', report.errors.length === 0, report.errors);check('no missing application resources', report.missing.length === 0, report.missing);
    report.ok=true;
  } catch(error) { report.ok=false;report.failure=error.stack;process.exitCode=1; }
  finally { await browser.close(); for(const server of servers){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2)); }
})();
