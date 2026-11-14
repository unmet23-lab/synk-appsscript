// Delayed real HTTP responses over disposable synthetic records; no messages are sent.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createAdminBrowserFixture} from './admin-workspace-fixture.mjs';
import {launchOwnedBrowser,closeOwnedBrowser} from './owned-browser.mjs';
import {크롬환경} from '../../../../../../tools/lib/크롬조종.js';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{화면시험}=require('../../../../../../tools/lib/화면시험.cjs');
const defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
await 화면시험({분:8},async()=>{
 const output=resolve(process.env.WORKSPACE_RACES_QA_OUT||'.tmp/workspace-request-races-browser');await mkdir(output,{recursive:true});
 let fixture,browser,page,failure;const releases=[],report={synthetic:true,production:false,checks:[],errors:[]};
 async function hold(url,method){
  const seen=defer(),gate=defer(),finished=defer();let used=false;releases.push(gate.resolve);
  const handler=async route=>{
   if(used||route.request().method()!==method)return route.continue();used=true;
   try{const response=await route.fetch();seen.resolve();await gate.promise;await route.fulfill({response});}
   catch(error){if(!/aborted|canceled|closed|Invalid InterceptionId/i.test(error.message))throw error;}
   finally{finished.resolve();}
  };
  await page.route(url,handler);return{started:seen.promise,async release(){gate.resolve();await finished.promise;await page.unroute(url,handler);}};
 }
 try{
  fixture=await createAdminBrowserFixture();browser=await launchOwnedBrowser(chromium,{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',env:크롬환경()});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addCookies([{name:'synk_company_session',value:fixture.cookieFor(fixture.admin),url:fixture.base}]);
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(fixture.base+'/?tab=path');await page.waitForFunction(()=>!!wa.work&&!wa.workLoading);
  await page.locator('.wa-work [data-action="wa-work-edit"]').first().click();
  await page.locator('[data-form="wa-work"] [name="title"]').fill('Delayed PATH save');
  const save=await hold('**/api/company-work/PATH','POST');
  await page.locator('[data-form="wa-work"] [type="submit"]').click();await save.started;
  await page.locator('.modal-close[data-action="close-modal"]').click();
  const list=await hold('**/api/company-work/SHIFT','GET');
  await page.locator('#ws-tools-toggle').click();await page.locator('#ws-tools-drawer [data-tab="lectures"]').first().click();await list.started;
  await save.release();await list.release();
  await page.waitForFunction(()=>wa.workKey?.endsWith(':SHIFT')&&!wa.workLoading&&wa.work?.items?.length>0);
  assert.ok(await page.locator('.wa-work-item').count()>0);report.checks.push('PATH save response preserves the in-flight SHIFT list');
  await page.screenshot({path:join(output,'shift-after-path-save-1440.png')});

  await page.goto(fixture.base+'/?tab=admin');await page.waitForFunction(()=>!!adminState.data&&!adminState.loading);
  const old=await hold('**/api/admin-workspace?*','GET');
  await page.locator('[data-admin-preset="7"]').click();await old.started;
  await page.locator('.admin-head [data-action="invite"]').click();const form=page.locator('[data-form="invite"]');
  await form.locator('[name="name"]').fill('Delayed read invite');await form.locator('[name="email"]').fill('delayed-read@example.test');
  await form.locator('[name="waCompany"][value="SHIFT"]').check();await form.locator('[name="waRole_SHIFT"]').selectOption('instructor');
  const unavailable=route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic reload failure after saving'})});
  await page.route('**/api/state*',unavailable);
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/members/invite');
  await form.locator('[type="submit"]').click();assert.equal((await response).status(),201);
  await page.waitForFunction(()=>adminState.needsStateReload&&!!adminState.error);
  await old.release();
  const snapshot=await page.evaluate(()=>({empty:adminState.data===null,error:adminState.error}));
  assert.equal(snapshot.empty,true);assert.match(snapshot.error,/Synthetic reload failure/);
  report.checks.push('old admin response cannot erase the failed post-write refresh or restore old metrics');
  await page.unroute('**/api/state*',unavailable);
  await page.locator('.modal-close[data-action="close-modal"]').click();
  await page.locator('[data-admin-action="retry"]').first().click();await page.waitForFunction(()=>!!adminState.data&&!adminState.loading&&!adminState.error);
  assert.equal(fixture.app.store.all('workspaceInvites').filter(row=>row.email==='delayed-read@example.test').length,1);
  report.checks.push('retry shows current real records and the invitation was issued once');
  assert.deepEqual(report.errors,[]);report.ok=true;
 }catch(error){failure=error;report.ok=false;report.failure=error.stack;if(page)try{await page.screenshot({path:join(output,'failure.png')});}catch{}}
 finally{
  for(const release of releases)release();
  try{if(browser)report.browserCleanup=await closeOwnedBrowser(browser);}catch(e){failure||=e;report.ok=false;}
  try{await fixture?.close();}catch(e){failure||=e;report.ok=false;}
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
 }
 console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,failure:failure?.message}));if(failure)throw failure;
});
