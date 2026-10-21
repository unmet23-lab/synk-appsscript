// Synthetic browser acceptance only: disposable SQLite + memory-only PostgreSQL.
// No external authentication, operating accounts, publication, streaming or AI calls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {createCompanyApp} from '../server.mjs';

const require=createRequire(import.meta.url),here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../../../../..');
const {createFixture}=require(join(root,'../SYNK-talk/tools/qa-synk-classroom-fixture.cjs'));
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=resolve(process.env.SYNK_TEACHING_QA_OUT||join(root,'docs/_ops/qa/messenger-teaching-20261009/browser'));
const dataDir=await mkdtemp(join(tmpdir(),'synk-messenger-teaching-ui-'));
const previousBackground=process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;
process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='0';
const report={checkedAt:new Date().toISOString(),synthetic:true,production:false,scope:'real Chromium UI + disposable company SQLite + memory-only PostgreSQL classroom service; fake OAuth provider, no external login or broadcasting',checks:[],errors:[],consoleErrors:[],assetErrors:[],unexpectedRequests:[],upstream:[],screenshots:[]};
const check=(name,value=true,detail)=>{report.checks.push({name,ok:Boolean(value),...(detail===undefined?{}:{detail})});assert.ok(value,name);};
let classroom,company,browser,page,base;
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const issuer='https://identity.example.test',clientId='teacher-browser';
const password='teaching-ui-fixture-password-2026';
const sourcePaths=['server.mjs','teaching-service.mjs','public/app.js','public/synk-id.js','public/workspace.js','public/teaching.js','public/teaching.css','public/teaching-host.js','public/index.html'].map(file=>resolve(here,'..',file));
async function sourceHashes(){return Promise.all(sourcePaths.map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));}
const token=()=>[Buffer.from('{"alg":"none"}').toString('base64url'),Buffer.from(JSON.stringify({iss:issuer+'/auth/v1',client_id:clientId,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-only'].join('.');
async function teachingFetch(value,options={}){
  const url=new URL(value);assert.equal(url.origin,issuer,'Only the fake provider may be addressed');
  report.upstream.push({path:url.pathname,method:options.method||'GET',product:options.headers?.['X-SYNK-Product']||null});
  if(url.pathname==='/auth/v1/oauth/token')return Response.json({token_type:'bearer',access_token:token(),refresh_token:'synthetic-teacher-refresh-'+randomUUID(),expires_in:3600});
  if(url.pathname==='/auth/v1/logout')return new Response(null,{status:204});
  if(url.pathname==='/functions/v1/synk-account')return Response.json(options.method==='POST'?{ok:true}:{ok:true,account:{status:'active',synk_user_id:classroom.users.teacher.identity.id},sessions:[{id:classroom.users.teacher.identity.sessionId,current:true,revoked:false,product:'world'}]});
  if(url.pathname.startsWith('/functions/v1/synk-classroom/'))return fetch(classroom.base+url.pathname+url.search,{...options,headers:{...options.headers,Authorization:'Bearer synthetic-teacher'}});
  throw Error('Unexpected synthetic upstream route: '+url.pathname);
}
async function screenshot(name){const path=join(out,name);await page.screenshot({path,fullPage:true});report.screenshots.push(path);}
async function fit(width,frame,label){await page.setViewportSize({width,height:960});await page.waitForTimeout(120);const outer=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));const child=frame?await frame.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})):null;check(label+' fits '+width,outer.scroll<=outer.width&&(!child||child.scroll<=child.width),{outer,child});}
async function teacherFrame(){const handle=page.locator('#teacher-workspace iframe');await handle.waitFor();const frame=await handle.elementHandle().then(e=>e.contentFrame());await frame.waitForFunction(()=>document.documentElement.dataset.ready==='true');return frame;}
async function chooseClass(classId){await page.locator('.teacher-class-controls select').selectOption(classId);return teacherFrame();}
async function refreshTeacher(frame){await frame.locator('#refresh').click();await frame.waitForFunction(()=>document.documentElement.dataset.ready==='true');}
async function currentState(){return classroom.state();}
async function localCompanyLink(user){
  const result=await page.evaluate(async({user,password,id})=>{
    const response=await fetch('/api/me'),me=await response.json();
    const begin=await fetch('/api/synk-id/challenge',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:JSON.stringify({action:'link',currentPassword:password,confirm:true})});const challenge=await begin.json();
    const next=await fetch('/api/synk-id/exchange',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-company-fixture-token','X-CSRF-Token':me.csrfToken},body:JSON.stringify({challenge:challenge.challenge,confirm:true})});const value=await next.json();return {status:next.status,value,user,id};
  },{user:user.id,password,id:classroom.users.teacher.identity.id});
  check('explicit synthetic company link retains the existing company user',result.status===200&&result.value.user?.id===user.id);
}

try{
  await mkdir(out,{recursive:true});
  report.sourceBefore=await sourceHashes();
  classroom=await createFixture();
  const student=await classroom.api('learner','/api/student');await classroom.api('learner','/api/world/sharing',{enabled:true,revision:student.sharing.revision});
  const sharedStudent=await classroom.api('learner','/api/student');
  await classroom.api('learner','/api/world/practice',{revision:sharedStudent.sharing.revision,contentId:'reading-detail',answers:{'detail-open':'b','detail-books':'b','detail-return':'c'},idempotencyKey:randomUUID()});
  const [secondClass]=await classroom.sql`insert into engine.classes(class_key,display_name) values('QA2','합성 두 번째 수업') returning class_id`;
  await classroom.sql`insert into engine.staff_classes values(${classroom.users.teacher.id}::uuid,${secondClass.class_id}::uuid)`;
  company=createCompanyApp({dataDir,port,schedule:false,webPushEnabled:false,teachingConfig:{issuer,accountApiUrl:issuer+'/functions/v1/synk-account',publishableKey:'sb_publishable_fixture_2026',clientId},teachingFetch,synkIdentityConfig:{accountApiUrl:issuer+'/functions/v1/synk-account',publishableKey:'sb_publishable_fixture_2026',issuer:null,clientId:null},synkIdentityVerifier:async()=>({synkUserId:classroom.users.teacher.identity.id,expiresAt:Date.now()+3600_000}),synkCustomerIdentityConfig:null,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})},collector:async()=>{throw Error('Collection is prohibited in this fixture');}});
  const staff=company.store.createUser({name:'합성 교사 크루',email:'teaching-ui@example.test',role:'member',password});
  await company.start();base=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:960}});page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400&&['script','stylesheet','image','font'].includes(response.request().resourceType()))report.assetErrors.push({url:response.url(),status:response.status()});});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===base||['data:','blob:'].includes(url.protocol))return route.continue();
    if(url.origin===issuer&&url.pathname==='/auth/v1/oauth/authorize'){
      check('browser starts the distinct teacher OAuth client',url.searchParams.get('client_id')===clientId&&url.searchParams.get('code_challenge_method')==='S256');
      const callback=new URL(url.searchParams.get('redirect_uri'));check('teacher OAuth callback stays in the disposable company server',callback.origin===base&&callback.pathname==='/api/teaching/callback');
      callback.search=new URLSearchParams({state:url.searchParams.get('state'),code:'synthetic-browser-code'}).toString();return route.fulfill({status:302,headers:{Location:callback.href},body:''});
    }
    report.unexpectedRequests.push(url.href);return route.abort();
  });
  await page.goto(base+'/?tab=teaching');await page.locator('#connect').waitFor({state:'visible'});
  check('teacher-only entry offers SYNK ID without a company password form',await page.locator('[data-form=auth]').count()===0);
  check('teacher-only entry exposes no company menu',await page.locator('.workspace-rail').count()===0&&await page.locator('[data-action=tab]').count()===0);
  await page.locator('#connect').click();await page.waitForURL(base+'/?tab=teaching');await page.locator('.teacher-class-controls select').waitFor();
  check('teacher-only login leaves company account authority absent',await page.evaluate(async()=>(await fetch('/api/me').then(r=>r.json())).user===null));
  check('assigned class picker uses the real classroom service',await page.locator('.teacher-class-controls select option').count()===3);
  let frame=await chooseClass(classroom.cls.class_id);
  check('teacher sees shared learner evidence from actual fixture responses',(await frame.locator('#student-detail').textContent()).includes('학습 근거')&&(await frame.locator('.skill-number').allTextContents()).some(value=>value.includes('3 / 3')));
  check('teacher iframe has scoped classroom methods and no native bridge or tokens',await frame.evaluate(()=>typeof synkDesktop==='undefined'&&typeof synkTeacher==='undefined'&&Object.keys(parent.SYNKClassroomHost).every(key=>!/(token|auth|learning|memory)/i.test(key))));
  for(const width of [1440,390,320]){await fit(width,frame,'teacher-only student detail');await screenshot('teacher-only-students-'+width+'.png');}
  await page.setViewportSize({width:1440,height:960});
  await frame.locator('#assign').click();await frame.locator('#content-select').selectOption('reading-condition');await frame.locator('#assignment-title').fill('합성 UI 과제');await frame.locator('textarea[name=instructions]').fill('합성 검증용 조건 안내를 직접 읽고 확인하세요.');
  for(const width of [390,320]){await fit(width,frame,'teacher assignment dialog');await screenshot('teacher-only-assignment-dialog-'+width+'.png');}
  await page.setViewportSize({width:1440,height:960});await frame.locator('#assignment-form button[type=submit]').click();await frame.locator('#assignment-dialog').waitFor({state:'hidden'});
  const state=await currentState(),assignment=state.assignments.find(a=>a.title==='합성 UI 과제');check('teacher UI creates a canonical PostgreSQL assignment',assignment?.contentId==='reading-condition');
  await frame.locator(`[data-edit="${assignment.id}"]`).click();await frame.locator('#assignment-title').fill('합성 UI 수정 과제');await frame.locator('textarea[name=instructions]').fill('합성 수정 안내: 신청 조건 두 가지를 확인하세요.');await frame.locator('#assignment-form button[type=submit]').click();await frame.locator('#assignment-dialog').waitFor({state:'hidden'});
  check('teacher UI revision updates the existing assignment',(await currentState()).assignments.find(a=>a.id===assignment.id)?.title==='합성 UI 수정 과제');
  await frame.locator(`[data-cancel="${assignment.id}"]`).click();await frame.locator('#assignments .status').filter({hasText:/^취소$/}).waitFor();
  check('teacher UI cancellation retains canonical assignment history',(await currentState()).assignments.find(a=>a.id===assignment.id)?.status==='cancelled');
  await frame.locator('[data-view=students]').click();await frame.locator('#add-note').click();await frame.locator('#note-form textarea[name=text]').fill('합성 관찰: 조건을 소리 내어 다시 읽고 장소를 찾았어요.');await frame.locator('#note-form button[type=submit]').click();await frame.locator('#note-dialog').waitFor({state:'hidden'});await frame.locator('[data-view=review]').click();
  check('teacher UI observation is retained separately from scored evidence',(await frame.locator('#observations').textContent()).includes('합성 관찰')&&(await currentState()).observations.length===1);
  const second=await chooseClass(secondClass.class_id);check('changing the assigned class removes prior learner and assignment context',await second.locator('.student-row').count()===0&&!(await second.locator('#assignments').textContent()).includes('합성 UI 수정 과제'));
  frame=await chooseClass(classroom.cls.class_id);check('returning to the original class restores canonical history',(await frame.locator('#assignments').textContent()).includes('합성 UI 수정 과제'));
  await page.goto(base+'/');await page.locator('[name=email]').fill(staff.email);await page.locator('[name=password]').fill(password);await page.locator('[data-form=auth] button[type=submit]').click();await page.locator('.workspace-rail').waitFor();await localCompanyLink(staff);
  await page.goto(base+'/?tab=teaching');await page.locator('.teacher-class-controls select').waitFor();frame=await chooseClass(classroom.cls.class_id);
  check('company teacher uses the same integrated shell and classroom',await page.locator('.workspace-rail [data-tab=teaching]').count()===1&&(await frame.locator('#class-title').textContent()).includes('합성 검증 수업'));
  await frame.locator('#assign').click();await frame.locator('textarea[name=instructions]').fill('왕복해도 남아야 하는 교사 과제 초안');const beforeFrame=frame;await frame.evaluate(()=>window.__qaDraftIdentity='persisted-draft');
  await page.locator('.workspace-rail [data-tab=messenger]').click();const messengerHandle=page.locator('#workspace-messenger iframe');await messengerHandle.waitFor();const messenger=await messengerHandle.elementHandle().then(e=>e.contentFrame());await messenger.locator('#composer-input').waitFor();
  const composer=messenger.locator('#composer-input');await composer.fill('왕복해도 남아야 하는 메신저 초안');
  await page.locator('.workspace-rail [data-tab=teaching]').click();frame=await teacherFrame();check('teaching tab round trip retains the same loaded iframe and unsent assignment draft',frame===beforeFrame&&await frame.evaluate(()=>window.__qaDraftIdentity)==='persisted-draft'&&await frame.locator('textarea[name=instructions]').inputValue()==='왕복해도 남아야 하는 교사 과제 초안');
  await frame.locator('#assignment-dialog .close-dialog').click();await page.locator('.workspace-rail [data-tab=messenger]').click();check('messenger draft survives the classroom round trip',await composer.inputValue()==='왕복해도 남아야 하는 메신저 초안');
  await page.locator('.workspace-rail [data-tab=teaching]').click();frame=await teacherFrame();
  for(const width of [1440,390,320]){await fit(width,frame,'company teacher integrated shell');await screenshot('company-teacher-students-'+width+'.png');}
  await page.evaluate(()=>window.__oldTeachingHost=window.SYNKClassroomHost);
  await classroom.sql`delete from engine.staff_classes where staff_id=${classroom.users.teacher.id}::uuid`;
  await page.locator('.teacher-class-controls button').click();await page.waitForFunction(()=>!document.querySelector('#teacher-workspace iframe')&&!window.SYNKClassroomHost);
  check('company staff without assigned teacher membership sees no student or assignment iframe',await page.locator('#teacher-workspace iframe').count()===0&&(await page.locator('#teacher-workspace').textContent()).includes('등록된 담당 수업이 없어요'));
  check('removed teaching membership invalidates the previously captured class host',await page.evaluate(()=>{try{window.__oldTeachingHost.request('/api/workspace');return false;}catch(error){return error.code==='ACCOUNT_CHANGED';}}));
  await screenshot('company-staff-no-classes-320.png');
  await page.locator('#sign-out').click();await page.locator('#connect').waitFor({state:'visible'});
  check('teaching logout removes the scoped classroom and preserves the company account',await page.locator('#teacher-workspace iframe').count()===0&&await page.evaluate(async expected=>(await fetch('/api/me').then(r=>r.json())).user?.id===expected,staff.id));
  check('teaching browser session is signed out after logout',await page.evaluate(async()=>(await fetch('/api/teaching/status').then(r=>r.json())).signedIn===false));
  await classroom.sql`insert into engine.staff_classes values(${classroom.users.teacher.id}::uuid,${classroom.cls.class_id}::uuid)`;
  await page.locator('#connect').click();await page.waitForURL(base+'/?tab=teaching');frame=await teacherFrame();
  await page.evaluate(()=>window.__generalLogoutTeacherHost=window.SYNKClassroomHost);
  await page.locator('[data-action=marin-account]').click();await page.locator('[data-action=logout]').click();await page.locator('[data-form=auth]').waitFor({state:'visible'});
  check('general company logout closes the existing company session',await page.evaluate(async()=>(await fetch('/api/me').then(r=>r.json())).user===null));
  check('general company logout also signs out the browser teaching session',await page.evaluate(async()=>(await fetch('/api/teaching/status').then(r=>r.json())).signedIn===false));
  check('general company logout removes the teaching host and rejects its captured scoped methods',await page.locator('#workspace-teaching').count()===0&&await page.evaluate(()=>{if(window.SYNKClassroomHost)return false;try{window.__generalLogoutTeacherHost.request('/api/workspace');return false;}catch(error){return error.code==='ACCOUNT_CHANGED';}}));
  await screenshot('company-general-logout-320.png');
  check('all upstream classroom and account requests preserve WORLD product',report.upstream.filter(row=>row.path.startsWith('/functions/')).every(row=>row.product==='world'));
  check('fixture browser has no uncaught page errors',report.errors.length===0);check('all teacher assets load',report.assetErrors.length===0);check('no unexpected external browser requests',report.unexpectedRequests.length===0);check('no fixture service errors',classroom.errors.length===0);
  check('fixture browser has no console errors',report.consoleErrors.length===0);
  report.sourceAfter=await sourceHashes();check('verified integration sources stay stable during the browser run',JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter));
  report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;if(page)try{await screenshot('failure.png');report.failurePage=await page.locator('body').innerText();}catch{}}
finally{
  if(browser)await browser.close();if(company)await company.stop();if(classroom)await classroom.close();
  const resolved=resolve(dataDir);assert.ok(resolved.startsWith(resolve(tmpdir())+sep)&&resolved.split(sep).at(-1).startsWith('synk-messenger-teaching-ui-'),'Only the disposable QA folder may be removed');await rm(resolved,{recursive:true,force:true});
  if(previousBackground===undefined)delete process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;else process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED=previousBackground;
  await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,passed:report.checks.filter(c=>c.ok).length,total:report.checks.length,failure:report.failure,out}));
}
