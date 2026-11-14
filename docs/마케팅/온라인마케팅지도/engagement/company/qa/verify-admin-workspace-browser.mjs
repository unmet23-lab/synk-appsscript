import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {createAdminBrowserFixture} from './admin-workspace-fixture.mjs';
import {크롬환경} from '../../../../../../tools/lib/크롬조종.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {화면시험,닫기}=require('../../../../../../tools/lib/화면시험.cjs');
const sourceFiles=['admin-workspace.mjs','server.mjs','public/admin-workspace.js','public/admin-workspace.css','public/app.js','public/index.html','public/workspace.js','public/workspace.css','public/workspace-access.js','public/marin-home.js','public/style.css','public/signal.css'];
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex')])));

await 화면시험({분:12},async()=>{
  const output=resolve(process.env.ADMIN_WORKSPACE_QA_OUT||'.tmp/admin-workspace-browser');
  await mkdir(output,{recursive:true});
  const report={synthetic:true,production:false,checks:[],errors:[],assets:[],screenshots:[],requests:[]};
  let fixture,browser,failure,lastPage;
  const contexts=[],releases=[];
  const check=(label,value=true)=>{assert.ok(value,label);report.checks.push(label);};
  async function ready(page){await page.locator('.admin-workspace h1').waitFor();await page.waitForFunction(()=>!adminState.loading&&!!adminState.data);}
  async function refresh(page){const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin-workspace');await page.locator('[data-admin-action="refresh"]').click();await response;await ready(page);}
  const root=page=>page.locator('.admin-workspace');
  async function tab(page,value){await page.locator(`[data-admin-tab="${value}"]`).click();}
  async function resetFilters(page){await page.locator('[data-admin-search]').fill('');await page.locator('[data-admin-company]').selectOption('all');await page.locator('[data-admin-status]').selectOption('all');}
  async function session(user){
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'tr-TR'});contexts.push(context);
    if(user)await context.addCookies([{name:'synk_company_session',value:fixture.cookieFor(user),url:fixture.base}]);
    const page=await context.newPage();lastPage=page;page.setDefaultTimeout(15000);
    page.on('pageerror',error=>report.errors.push(error.message));
    page.on('dialog',async dialog=>{report.errors.push('Unexpected dialog: '+dialog.message());await dialog.dismiss();});
    page.on('request',request=>{if(new URL(request.url()).pathname==='/api/admin-workspace')report.requests.push({page:contexts.indexOf(context),url:request.url()});});
    page.on('response',response=>{if(response.status()>=400&&['image','font','script','stylesheet'].includes(response.request().resourceType()))report.assets.push({path:new URL(response.url()).pathname,status:response.status()});});
    await page.addInitScript(()=>{window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied.push(text);}}});});
    return {page,context};
  }
  async function capture(page,name){await page.screenshot({path:join(output,name),fullPage:page.viewportSize().height<=390});report.screenshots.push(name);}
  try{
    report.sourceBefore=await sourceHashes();
    fixture=await createAdminBrowserFixture();
    browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',env:크롬환경()});
    const {page}=await session(fixture.admin);
    await page.goto(fixture.base+'/?tab=admin');await ready(page);
    check('direct administrator entry has the named heading',await root(page).locator('h1').textContent()==='관리자');
    check('the three administrator views are available',await root(page).locator('[data-admin-tab]').count()===3);
    check('concurrent company assignments do not duplicate employees',await page.locator(`.admin-name-btn[data-admin-member="${fixture.dual.id}"]`).count()===1);
    check('employee names cannot create markup',await root(page).locator('img[src="x"]').count()===0);
    const memberRows=()=>page.locator('.admin-table tbody tr').filter({has:page.locator('.admin-name-btn')});
    check('the complete member list is present once per person',await memberRows().count()===12);
    await page.locator('[data-admin-company]').selectOption('SHIFT');
    check('SHIFT includes its instructor, team lead and concurrent employee',await memberRows().count()===3&&await page.locator(`.admin-name-btn[data-admin-member="${fixture.dual.id}"]`).count()===1);
    await page.locator('[data-admin-company]').selectOption('PULSE');
    check('PULSE includes stored memberships of stopped employees',await memberRows().count()===3&&await page.locator(`.admin-name-btn[data-admin-member="${fixture.stopped.id}"]`).count()===1);
    await page.locator('[data-admin-status]').selectOption('inactive');check('stopped staff can be found without losing their company',await memberRows().count()===1&&/PULSE/.test(await memberRows().textContent()));
    await resetFilters(page);await page.locator('[data-admin-company]').selectOption('legacy');check('legacy unassigned accounts have a separate filter',await memberRows().count()===1);
    await page.locator('[data-admin-company]').selectOption('admin');check('full-access administrators have a separate filter',await memberRows().count()===2);
    await resetFilters(page);await page.locator('[data-admin-search]').fill('검증 겸임 직원');check('same names remain separate accounts',await memberRows().count()===2);
    const input=page.locator('[data-admin-search]');await input.focus();
    const inputHandle=await input.elementHandle(),beforeQuiet=report.requests.length;
    const changed=fixture.app.store.get('users',fixture.escaped.id);fixture.app.store.put('users',changed.id,{...changed,name:changed.name+' 변경'});
    await page.evaluate(()=>loadState({quiet:true}));
    check('changed quiet polling does not reload administrator aggregates',report.requests.length===beforeQuiet);
    check('quiet polling preserves the search node, input and focus',await inputHandle.evaluate(el=>el.isConnected&&document.activeElement===el&&el.value==='검증 겸임 직원'));
    await input.dispatchEvent('compositionstart');await page.evaluate(()=>loadState({quiet:true}));
    check('IME composition retains the live input',await inputHandle.evaluate(el=>el.isConnected&&document.activeElement===el));await input.dispatchEvent('compositionend');await inputHandle.dispose();
    await resetFilters(page);await page.locator(`.admin-name-btn[data-admin-member="${fixture.dual.id}"]`).click();
    await page.locator('.admin-metrics-table').waitFor();
    const metric=label=>page.locator('.admin-metrics-table tbody tr').filter({hasText:label});
    check('all seven performance metrics are displayed',await page.locator('.admin-metrics-table tbody tr').count()===7);
    check('cumulative views and period growth remain distinct',(await metric('조회수').locator('[data-label="최신 누적값"]').textContent()).trim()==='150'&&/\+50/.test(await metric('조회수').locator('[data-label="선택 기간 증감"]').textContent()));
    check('a measured zero is not shown as missing',(await metric('좋아요').locator('[data-label="최신 누적값"]').textContent()).trim()==='0');
    check('an unobserved value is not invented as zero',(await metric('도달').locator('[data-label="최신 누적값"]').textContent()).trim()==='미확인');
    check('shared channel and work measurement bases are explained',/공동/.test(await root(page).textContent())&&/누적/.test(await root(page).textContent()));
    const analytics=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/analytics');
    await page.locator('[data-admin-action="member-analysis"]').first().click();const query=new URL((await analytics).url()).searchParams;
    check('analysis receives the selected employee and exact date range',query.get('ownerId')===fixture.dual.id&&query.get('start')===fixture.start&&query.get('end')===fixture.end);
    await page.goto(fixture.base+'/?tab=admin');await ready(page);
    await page.locator(`[data-admin-action="member-detail"][data-id="${fixture.dual.id}"]`).click();
    await page.locator('[data-org-form] [name="jobTitle"]').fill('강의와 영상 제작');
    const saved=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/members/${fixture.dual.id}/organization`);
    await page.locator('[data-org-form] [type="submit"]').click();assert.equal((await saved).status(),200);await page.locator('[data-org-form]').waitFor({state:'hidden'});await ready(page);
    check('existing employee editing refreshes the administrator directory',await memberRows().filter({hasText:'강의와 영상 제작'}).count()===1);
    await page.locator(`[data-action="wa-member"][data-id="${fixture.shift.id}"]`).click();
    const profile=page.locator('[data-form="wa-member"]');await profile.locator('[name="waCompany"][value="PULSE"]').check();await profile.locator('[name="waRole_PULSE"]').selectOption('producer');
    await profile.locator('[type="submit"]').click();await profile.waitFor({state:'hidden'});await ready(page);
    check('the existing assignment editor saves concurrent companies',fixture.app.store.get('users',fixture.shift.id).workspaceProfile.memberships.some(row=>row.company==='PULSE'));
    await page.locator(`[data-action="member-status"][data-id="${fixture.path.id}"]`).click();
    check('stopping access requires the existing impact confirmation',await page.locator('[data-action="member-status-confirm"]').count()===1&&fixture.app.store.get('users',fixture.path.id).active===true);
    await page.locator('[data-action="member-status-confirm"]').click();await page.locator('[data-action="member-status-confirm"]').waitFor({state:'hidden'});await ready(page);
    check('confirmed stop persists to the server',fixture.app.store.get('users',fixture.path.id).active===false);
    await page.locator(`[data-action="member-status"][data-id="${fixture.path.id}"]`).click();await page.locator('[data-action="member-status-confirm"]').click();await page.locator('[data-action="member-status-confirm"]').waitFor({state:'hidden'});await ready(page);
    check('access can be restored from the same administrator screen',fixture.app.store.get('users',fixture.path.id).active===true);
    check('other administrator privilege controls remain unavailable',await page.locator(`[data-action="member-status"][data-id="${fixture.otherAdmin.id}"],[data-action="wa-member"][data-id="${fixture.otherAdmin.id}"]`).count()===0);
    for(const view of ['members','invitations','performance']){
      await tab(page,view);
      if(view==='performance')await page.locator(`[data-admin-member="${fixture.dual.id}"]`).first().click();
      await page.waitForFunction(()=>!document.querySelector('#toast')?.classList.contains('show'));
      for(const [width,height] of [[1440,1000],[390,844],[844,390],[320,740]]){
        await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
        check(`${view} has no document overflow at ${width}x${height}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await capture(page,`${view}-${width}x${height}.png`);
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    report.tabContrast=[];
    for(const key of ['members','invitations','performance']){
      const button=page.locator(`[data-admin-tab="${key}"]`);
      for(const mode of ['normal','hover','focus']){
        await page.mouse.move(0,0);await button.evaluate(el=>el.blur());
        if(mode==='hover')await button.hover();if(mode==='focus')await button.focus();await page.waitForTimeout(250);
        const colors=await button.evaluate(el=>{
          const rgba=value=>(value.match(/[\d.]+/g)||[]).map(Number),style=getComputedStyle(el);let parent=el,bg;
          while(parent){bg=rgba(getComputedStyle(parent).backgroundColor);if(bg.length===3||bg[3]===1)break;parent=parent.parentElement;}
          const fg=rgba(style.color),luminance=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0),a=luminance(fg),b=luminance(bg);
          return {foreground:style.color,background:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
        });report.tabContrast.push({key,mode,...colors});check(`${key} ${mode} tab text contrast meets 4.5:1`,colors.ratio>=4.5);
      }
    }
    for(const who of [fixture.shift,fixture.manager]){
      const denied=await session(who),before=report.requests.length;
      await denied.page.goto(fixture.base+'/?tab=admin');await denied.page.locator('#ws-tools-toggle').waitFor();
      check(`${who.role} direct entry does not reveal administrator UI`,await denied.page.locator('.admin-workspace,[data-tab="admin"]').count()===0);
      check(`${who.role} direct entry does not request administrator data`,report.requests.length===before);
      assert.equal((await denied.context.request.get(fixture.base+'/api/admin-workspace')).status(),403);
    }
    check('no runtime errors',report.errors.length===0);check('all referenced static assets load',report.assets.length===0);
    report.sourceAfter=await sourceHashes();check('administrator source bytes remain fixed throughout acceptance',JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter));
    report.ok=true;
  }catch(error){failure=error;report.ok=false;report.failure=error.stack;if(lastPage)try{await capture(lastPage,'failure.png');report.failureText=await lastPage.locator('body').innerText();}catch{}}
  finally{
    for(const release of releases)release();
    for(const context of contexts)try{await 닫기(context);}catch(error){failure||=error;}
    if(browser)try{assert.ok(await 닫기(browser,{초:45}),'Browser cleanup must complete');}catch(error){failure||=error;}
    if(fixture)try{await fixture.close();}catch(error){failure||=error;}
    if(failure){report.ok=false;report.failure||=failure.stack;}
    await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output,failure:failure?.message}));if(failure)throw failure;
});
