// Real administrator navigation over disposable synthetic employees.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {createAdminBrowserFixture} from './admin-workspace-fixture.mjs';
import {launchOwnedBrowser,closeOwnedBrowser} from './owned-browser.mjs';
import {크롬환경} from '../../../../../../tools/lib/크롬조종.js';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),{화면시험}=require('../../../../../../tools/lib/화면시험.cjs');
const paths=['public/app.js','public/admin-workspace.js','public/workspace.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')])));
await 화면시험({분:6},async()=>{
 const output=resolve(process.env.ADMIN_STOPPED_QA_OUT||'.tmp/admin-stopped-analysis-browser');await mkdir(output,{recursive:true});
 const report={synthetic:true,production:false,checks:[],views:[],errors:[],assets:[]};let fixture,browser,page,failure;
 const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);};
 try{
  report.sourceBefore=await hashes();fixture=await createAdminBrowserFixture();
  browser=await launchOwnedBrowser(chromium,{headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',env:크롬환경()});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'synk_company_session',value:fixture.cookieFor(fixture.admin),url:fixture.base}]);
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400&&['image','font','script','stylesheet'].includes(response.request().resourceType()))report.assets.push({url:new URL(response.url()).pathname,status:response.status()});});
  for(const [width,height] of [[1440,1000],[390,844]]){
   await page.setViewportSize({width,height});await page.goto(fixture.base+'/?tab=admin');
   await page.waitForFunction(()=>!adminState.loading&&!!adminState.data);
   await page.locator('[data-admin-status]').selectOption('inactive');
   await page.locator('.admin-name-btn[data-admin-member="'+fixture.stopped.id+'"]').click();
   await page.locator('.admin-metrics-table').waitFor();
   const request=page.waitForRequest(req=>new URL(req.url()).pathname==='/api/analytics');
   await page.locator('[data-admin-action="member-analysis"]').first().click();
   const query=new URL((await request).url()).searchParams;
   await page.locator('.analysis-filters [data-filter="ownerId"]').waitFor();
   await page.waitForFunction(()=>!!state.report&&state.tab==='analysis');
   const select=page.locator('.analysis-filters [data-filter="ownerId"]');
   const shown=await select.evaluate(el=>({value:el.value,text:el.selectedOptions[0]?.textContent,stateOwner:state.ownerId}));
   report.views.push({width,height,shown,requestOwner:query.get('ownerId')});
   await page.screenshot({path:join(output,'stopped-analysis-'+width+'.png'),fullPage:false});
   check(width+' detail request retains the stopped employee and date window',query.get('ownerId')===fixture.stopped.id&&query.get('start')===fixture.start&&query.get('end')===fixture.end);
   check(width+' selected owner matches the numbers being displayed',shown.value===fixture.stopped.id&&shown.stateOwner===fixture.stopped.id);
   check(width+' stopped employee remains named and marked',shown.text.includes(fixture.stopped.name)&&/중지/.test(shown.text)&&!shown.text.includes('모든 담당자'));
   const unfiltered=page.waitForRequest(req=>new URL(req.url()).pathname==='/api/analytics'&&!new URL(req.url()).searchParams.get('ownerId'));
   await select.selectOption('');await unfiltered;await page.waitForFunction(()=>state.ownerId===''&&state.tab==='analysis');
   check(width+' selecting all owners clears the actual report filter',await select.inputValue()===''&&await select.locator('option:checked').textContent()==='모든 담당자');
   check(width+' analysis has no horizontal document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:join(output,'all-analysis-'+width+'.png'),fullPage:false});
  }
  report.sourceAfter=await hashes();assert.deepEqual(report.sourceAfter,report.sourceBefore);assert.deepEqual(report.errors,[]);assert.deepEqual(report.assets,[]);report.ok=true;
 }catch(error){failure=error;report.ok=false;report.error=error.message;if(page)await page.screenshot({path:join(output,'failure.png')}).catch(()=>{});}
 finally{
  if(browser)try{report.cleanup=await closeOwnedBrowser(browser);}catch(error){failure||=error;report.cleanupError=error.message;report.ok=false;}
  if(fixture)await fixture.close();
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
 }
 if(failure)throw failure;
 console.log(JSON.stringify({ok:true,checks:report.checks.length,output}));
});
