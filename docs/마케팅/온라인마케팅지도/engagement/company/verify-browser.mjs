// Isolated local UI verification. Never writes sample values to the real company data.
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname,join } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { createCompanyApp } from './server.mjs';
import { today } from './store.mjs';
import { shiftDate } from '../analytics.mjs';

if(!process.env.SYNK_PLAYWRIGHT_MODULE||!process.env.SYNK_BROWSER_EXE)throw new Error('SYNK_PLAYWRIGHT_MODULE과 SYNK_BROWSER_EXE를 지정하세요.');
const {chromium}=await import(pathToFileURL(process.env.SYNK_PLAYWRIGHT_MODULE));
const here=dirname(fileURLToPath(import.meta.url)),directory=await mkdtemp(join(tmpdir(),'synk-company-browser-'));
const app=createCompanyApp({dataDir:directory,port:4192,schedule:false});
let browser;
try{
 await app.start();
 const admin=app.store.createUser({name:'검증 관리자',email:'admin@example.test',role:'admin',password:'browser-test-password'});
 for(const [id,platform,title] of [['qa-one','youtube','검증용 유튜브'],['qa-two','instagram','검증용 인스타그램']]){
  app.store.put('channels',id,{id,platform,canonicalUrl:platform==='youtube'?'https://youtube.com/@qaone':'https://instagram.com/qatwo/',displayName:title,ownerIds:[admin.id],active:true,status:'not-connected'});
  app.store.put('posts',id,{id,channelId:id,title:'검증용 콘텐츠 '+id,url:platform==='youtube'?'https://youtube.com/watch?v=test':'https://instagram.com/p/test/',publishedDate:shiftDate(today(),-90)});
  for(let day=-35;day<=0;day++){
   const date=shiftDate(today(),day),variation=[0,0,18,-12,35,8,0][(day+35)%7],value=1000+(day+35)*20+variation+(id==='qa-two'?100:0);
   app.store.put('snapshots',id+date,{id:id+date,postId:id,date,views:value,likes:100+day,comments:30+Math.floor(day/2),shares:platform==='youtube'?null:20+Math.floor(day/3),saves:null,reach:null});
   app.store.put('channelSnapshots',id+date,{id:id+date,channelId:id,date,followers:500+day});
  }
 }
 browser=await chromium.launch({headless:true,executablePath:process.env.SYNK_BROWSER_EXE});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
 await page.goto(app.origin);
 await page.locator('[name="email"]').fill('admin@example.test');await page.locator('[name="password"]').fill('browser-test-password');await page.locator('[data-form="auth"] button[type="submit"]').click();
 await page.getByRole('heading',{name:'우리 팀의 성장을 한눈에.',exact:true}).waitFor();
 await page.locator('.metric-value').first().filter({hasText:'3,500'}).waitFor();
 await page.locator('.nav-item[data-action="tab"][data-tab="analysis"]').first().click();
 await Promise.all([page.waitForResponse(r=>r.url().includes('/api/analytics')&&r.status()===200),page.locator('[data-filter="platform"]').selectOption('youtube')]);
 await page.locator('.nav-item[data-action="tab"][data-tab="overview"]').first().click();
 await page.locator('.metric-value').first().filter({hasText:'3,500'}).waitFor();
 await page.locator('[data-action="metric-focus"][data-metric="views"]').click();assert.equal(await page.locator('[data-filter="platform"]').inputValue(),'','company metric clears stale analysis filters');
 await Promise.all([page.waitForResponse(r=>r.url().includes('/api/analytics')&&r.status()===200),page.locator('[data-filter="platform"]').selectOption('')]);
 await page.locator(`.row-date[data-date="${today()}"]:visible`).click();
 await page.getByRole('heading',{name:'콘텐츠별 상세',exact:true}).waitFor();
 assert.equal(await page.locator('.post-title:visible').count(),2);
 assert.match(await page.locator('.modal-body').innerText(),/\+40/);
 await mkdir(join(here,'verification'),{recursive:true});
 await page.screenshot({path:join(here,'verification','day-detail-fixture.png'),fullPage:false,animations:'disabled'});
 await page.getByRole('button',{name:'닫기',exact:true}).click();
 for(const range of ['month','quarter','week']){await Promise.all([page.waitForResponse(r=>r.url().includes('/api/analytics')&&r.status()===200),page.locator(`[data-range="${range}"]`).click()]);}
 await page.locator('.nav-item[data-action="tab"][data-tab="overview"]').first().click();await page.locator('.metric-value').first().filter({hasText:'3,500'}).waitFor();
 assert.equal(await page.locator('.metric-card').count(),6);
 await page.locator('[data-chart-point]').last().focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'콘텐츠별 상세',exact:true}).waitFor();assert.match(await page.locator('.modal-body').innerText(),/\+40/);await page.keyboard.press('Escape');
 await page.keyboard.press('Control+k');await page.locator('[data-command-search]').fill('검증용 유튜브');assert.equal(await page.locator('.command-item').count(),1);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.getByRole('heading',{name:'채널의 담당 이력',exact:true}).waitFor();await page.keyboard.press('Escape');
 await page.locator('.nav-item[data-action="tab"][data-tab="overview"]').first().click();await page.locator('.metric-value').first().filter({hasText:'3,500'}).waitFor();await page.locator('[data-action="platform-focus"][data-platform="youtube"]').click();assert.equal(await page.locator('[data-filter="platform"]').inputValue(),'youtube');
 await page.locator('.nav-item[data-action="tab"][data-tab="overview"]').first().click();await page.locator('.metric-value').first().filter({hasText:'3,500'}).waitFor();await page.getByRole('heading',{name:'우리 팀의 성장을 한눈에.',exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:join(here,'verification','overview-fixture.png'),fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});
 await page.locator('.mobile-search').click();await page.locator('[data-command-search]').fill('조회 불가능한 채널');await page.locator('.command-empty').waitFor();assert.equal(await page.locator('.mobile-logout').isVisible(),true);await page.getByRole('button',{name:'닫기',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'mobile page must not overflow');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(here,'verification','mobile-fixture.png'),fullPage:true,animations:'disabled'});
 await page.locator('.nav-item[data-action="tab"][data-tab="analysis"]').first().click();await page.locator('[data-filter="platform"]').selectOption('');await page.locator(`.daily-card[data-date="${today()}"]:visible`).click();await page.locator('.day-post-card').first().waitFor();assert.equal(await page.locator('.day-post-card:visible').count(),2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);await page.screenshot({path:join(here,'verification','day-mobile-fixture.png'),fullPage:false,animations:'disabled'});await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.nav-item[data-action="tab"][data-tab="members"]').click();await page.locator('[data-action="invite"]').click();
 await page.locator('[data-form="invite"] [name="name"]').fill('검증 직원');await page.locator('[data-form="invite"] [name="email"]').fill('employee@example.test');await page.locator('[data-form="invite"] button[type="submit"]').click();
 const invite=page.getByRole('textbox',{name:'팀원 초대 링크'});await invite.waitFor();
 const staffContext=await browser.newContext(),staff=await staffContext.newPage();await staff.goto(await invite.inputValue());
 await staff.locator('[name="name"]').fill('검증 직원');await staff.locator('[name="password"]').fill('employee-test-password');await staff.locator('[data-form="auth"] button[type="submit"]').click();
 await staff.getByRole('heading',{name:'우리 팀의 성장을 한눈에.',exact:true}).waitFor();
 assert.equal(await staff.locator('[data-tab="members"]').count(),0);
 assert.equal(await staff.locator('.metric-value').first().textContent(),'—');
 await staff.locator('[data-action="add-channel"]').first().click();await staff.locator('[name="urls"]').fill('https://youtube.com/@qastaff\nhttps://www.tiktok.com/@qastaff');await staff.locator('[data-form="add-channels"] button[type="submit"]').click();
 await staff.getByText('새 채널 2개 등록',{exact:false}).waitFor();
 await staff.locator('[data-action="registration-done"]').click();assert.equal(await staff.locator('.channel-card').count(),2);
 await staff.locator('[data-action="connect"]').first().click();await staff.getByText('관리자의 첫 연결 준비가 필요해요.',{exact:true}).waitFor();assert.equal(await staff.locator('[data-form="connection"]').count(),0);
 await page.reload();await page.locator('.nav-item[data-action="tab"][data-tab="members"]').click();
 await page.locator('[data-action="team-edit"]').first().click();await page.locator('[data-form="team"] [name="name"]').fill('검증 콘텐츠팀');await page.locator('[data-form="team"] button[type="submit"]').click();
 await page.locator('.team-card h3').filter({hasText:'검증 콘텐츠팀'}).waitFor();
 const team=app.store.all('teams').find(row=>row.name==='검증 콘텐츠팀'),employee=app.store.all('users').find(row=>row.email==='employee@example.test');
 await page.locator(`[data-action="member-assignment"][data-id="${employee.id}"]`).click();await page.locator('[data-form="assignment"] [name="teamId"]').selectOption(team.id);await page.locator('[data-form="assignment"] [name="role"]').selectOption('manager');await page.locator('[data-form="assignment"] button[type="submit"]').click();await page.locator('[data-form="assignment"]').waitFor({state:'detached'});
 assert.equal(app.store.get('users',employee.id).role,'manager');
 await page.locator('.nav-item[data-action="tab"][data-tab="channels"]').click();await page.locator('[data-action="owners"][data-id="qa-one"]').click();
 await page.locator('[data-form="owners"] [name="teamId"]').selectOption(team.id);await page.locator(`[name="userIds"][value="${employee.id}"]`).check();await page.locator(`[name="userIds"][value="${admin.id}"]`).uncheck();await page.locator('[data-form="owners"] [name="reason"]').fill('검증 담당 이관');await page.locator('[data-form="owners"] button[type="submit"]').click();await page.locator('[data-form="owners"]').waitFor({state:'detached'});
 await page.locator('[data-action="channel-history"][data-id="qa-one"]').click();await page.getByText('검증 담당 이관',{exact:true}).waitFor();await page.screenshot({path:join(here,'verification','ownership-fixture.png'),fullPage:false,animations:'disabled'});await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.locator('.nav-item[data-action="tab"][data-tab="overview"]').first().click();await page.locator('[data-action="scope"][data-scope="team"]').click();await page.locator('.metric-value').first().filter({hasText:'1,700'}).waitFor();
 await page.locator('.nav-item[data-action="tab"][data-tab="collection"]').first().click();assert.equal(await page.locator('[data-collection-channel]').count(),1);await page.screenshot({path:join(here,'verification','collection-fixture.png'),fullPage:true,animations:'disabled'});
 await page.locator('.nav-item[data-action="tab"][data-tab="members"]').click();await page.locator(`[data-action="member-assignment"][data-id="${employee.id}"]`).click();await page.locator('[data-form="assignment"] [name="role"]').selectOption('viewer');await page.locator('[data-form="assignment"] button[type="submit"]').click();await page.locator('[data-form="assignment"]').waitFor({state:'detached'});
 await staff.reload();await staff.locator('[name="email"]').fill('employee@example.test');await staff.locator('[name="password"]').fill('employee-test-password');await staff.locator('[data-form="auth"] button[type="submit"]').click();await staff.getByRole('heading',{name:'우리 팀의 성장을 한눈에.',exact:true}).waitFor();
 assert.equal(await staff.locator('[data-action="add-channel"]').count(),0);assert.equal(await staff.locator('[data-action="collect-all"]').count(),0);
 await staff.locator('.nav-item[data-action="tab"][data-tab="channels"]').click();assert.equal(await staff.locator('.channel-card').count(),3);assert.equal(await staff.locator('[data-action="owners"], [data-action="connect"], [data-action="channel-settings"]').count(),0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});
  for(const tab of ['overview','analysis','channels','collection','members','settings']){
   await page.locator(`.nav-item[data-tab="${tab}"]`).click();await page.waitForFunction(()=>document.querySelector('#main')?.getAttribute('aria-busy')==='false');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,`${tab} must fit ${width}px`);
   await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:join(here,'verification',`redesign-${tab}-${width}-fixture.png`),fullPage:true,animations:'disabled'});
  }
 }
 await page.setViewportSize({width:320,height:740});await page.locator('.nav-item[data-tab="overview"]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'320px overview overflow');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.nav-item[data-tab="channels"]').click();const moving=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);assert.equal(moving,0,'reduced motion disables running animations');
 const loadedFonts=await page.evaluate(async()=>Promise.all(['SUIT','Inter Tight','DM Mono'].map(async family=>(await document.fonts.load(`14px "${family}"`)).some(face=>face.status==='loaded'))));assert.deepEqual(loadedFonts,[true,true,true]);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,checks:['admin-login','totals-independent-of-filters','day-content-details','weekly-monthly-quarterly-ranges','mobile-no-overflow','staff-invitation-and-isolation','multiple-url-registration','connection-readiness','team-create','role-assignment','handover-history','team-filtered-totals','collection-center-scope','viewer-readonly','command-search-keyboard','chart-keyboard-details','platform-drilldown','all-six-views-desktop-mobile','320px-overview','reduced-motion','three-brand-fonts'],consoleErrors:errors.length,screenshots:'company/verification (test fixture only)'}));
}finally{await browser?.close();await app.stop();if(!directory.startsWith(join(tmpdir(),'synk-company-browser-')))throw new Error('Unexpected temporary path');await rm(directory,{recursive:true,force:true});}
