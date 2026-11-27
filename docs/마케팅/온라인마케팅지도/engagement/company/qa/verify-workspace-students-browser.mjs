// 학생 관리 실제 화면 확인: 실제 Chromium + 버리는 회사 SQLite + 메모리 PostgreSQL(PGlite)의 정본 교실.
// verify-workspace-records-browser.mjs(출결 · TOPIK)와 같은 가짜 SYNK ID 로그인을 쓰고, 교실 함수는 index.ts처럼 운영 묶음을 출결 · TOPIK과 학생 관리 두 겹으로 감싸 띄운다.
// 학생 · 교사 · 대학은 모두 지어낸 이름이다. 운영 계정 · 외부 로그인 · 배포 · 공개 없음.
// 쓰기: SYNK_TALK_ROOT=<학생 관리가 든 SYNK-talk 작업본> node docs/마케팅/온라인마케팅지도/engagement/company/qa/verify-workspace-students-browser.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {createCompanyApp} from '../server.mjs';
const require=createRequire(import.meta.url),here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../../..'),talk=resolve(process.env.SYNK_TALK_ROOT||resolve(root,'../SYNK-talk'));
const {createFixture}=require(join(talk,'tools/qa-synk-classroom-fixture.cjs'));
const {createPgStore}=require(join(talk,'lib/synk-store.js'));
const {createClassroomRecords,withClassRecords,rememberIdentity}=require(join(talk,'lib/synk-classroom-records.js'));
const {createStudentRecords,withStudentRecords}=require(join(talk,'lib/synk-classroom-students.js'));
const runtime=require(join(talk,'supabase/functions/_shared/synk-classroom-runtime.js')),{model}=runtime;
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=resolve(process.env.SYNK_WORKSPACE_STUDENTS_QA_OUT||join(root,'docs/_ops/qa/workspace-students-20261127'));
const dataDir=await mkdtemp(join(tmpdir(),'synk-workspace-students-ui-')),previousJobs=process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;
process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='0';
const issuer='https://identity.example.test',clientId='teacher-browser',password='workspace-students-browser-only';
const report={checkedAt:new Date().toISOString(),synthetic:true,production:false,talk,scope:'real Chromium + disposable company SQLite + memory-only canonical PostgreSQL; operating classroom runtime wrapped by class records and student records with the switch on; invented learners only',checks:[],errors:[],consoleErrors:[],assetErrors:[],httpErrors:[],unexpectedRequests:[],screenshots:[]};
const check=(name,value=true,detail)=>{report.checks.push({name,ok:!!value,...(detail===undefined?{}:{detail})});assert.ok(value,name+(detail===undefined?'':' '+JSON.stringify(detail)));};
let fx,company,browser,page,base,handler;
const jwt=()=>['synthetic',Buffer.from(JSON.stringify({iss:issuer+'/auth/v1',client_id:clientId,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
const seoulToday=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const addDays=(value,days)=>{const [y,m,d]=value.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)+days*86400000).toISOString().slice(0,10);};
async function teachingFetch(value,options={}){
  const url=new URL(value);assert.equal(url.origin,issuer);
  if(url.pathname==='/auth/v1/oauth/token')return Response.json({token_type:'bearer',access_token:jwt(),refresh_token:'synthetic-refresh-'+randomUUID(),expires_in:3600});
  if(url.pathname==='/auth/v1/logout')return new Response(null,{status:204});
  if(url.pathname==='/functions/v1/synk-account')return Response.json(options.method==='POST'?{ok:true}:{ok:true,account:{status:'active',synk_user_id:fx.users.teacher.identity.id},sessions:[{id:fx.users.teacher.identity.sessionId,current:true,revoked:false,product:'world'}]});
  if(url.pathname.startsWith('/functions/v1/synk-classroom/'))return handler(new Request('http://127.0.0.1'+url.pathname+url.search,{method:options.method||'GET',headers:{...options.headers,Authorization:'Bearer synthetic-teacher'},...(options.body?{body:options.body}:{})}));
  throw Error('Unexpected synthetic upstream route');
}
async function api(role,classId,route,body){
  const url=new URL('http://127.0.0.1/functions/v1/synk-classroom'+route);if(classId)url.searchParams.set('classId',classId);
  const response=await handler(new Request(url,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer synthetic-'+role,'X-SYNK-Product':'world','X-SYNK-Contract':'1','X-SYNK-App-Version':'1.0.0',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  const result=await response.json();if(!response.ok)throw Object.assign(Error(route+' '+JSON.stringify(result)),{status:response.status});return result;
}
async function seedStudent(classId,name,{share=true}={}){
  const key='learner-'+randomUUID(),identity={id:randomUUID(),sessionId:randomUUID(),issuedAt:Math.floor(Date.now()/1000)-1,providers:['synthetic']};
  await fx.sql`insert into auth.users values(${identity.id}::uuid)`;
  const [row]=await fx.sql`insert into engine.learners(auth_user_id,student_code,class_id) values(${identity.id}::uuid,${name},${classId}::uuid) returning learner_id`;
  await createPgStore(fx.sql).withAccount(identity,'world',tx=>tx.setLearning(true));fx.users[key]={identity,id:row.learner_id};
  if(share){const before=await api(key,classId,'/api/world/account');await api(key,classId,'/api/world/sharing',{enabled:true,revision:before.sharing.revision});}
  return {id:row.learner_id,classId,name,key};
}
async function capture(name,{full=false}={}){const path=join(out,name);await page.screenshot({path,fullPage:full});report.screenshots.push(path);}
async function fits(width){const result=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));check('no horizontal overflow at '+width,result.width===result.scroll,result);}
try{
  await mkdir(out,{recursive:true});fx=await createFixture();
  for(const file of ['20261009230000_synk_teaching_care_towns_c16.sql','20261020150000_synk_classroom_homework_c18.sql','20261127100000_synk_class_attendance_topik_c18.sql','20261127200000_synk_branches_stay_c18.sql'])await fx.db.exec(await readFile(join(talk,'supabase/migrations',file),'utf8'));
  const verify=rememberIdentity(async request=>{const role=request.headers.get('authorization')?.replace('Bearer synthetic-','');if(!fx.users[role])throw Object.assign(Error('AUTH_REQUIRED'),{status:401,code:'AUTH_REQUIRED'});return fx.users[role].identity;});
  const inner=withClassRecords({handler:runtime.createClassroomService({store:runtime.createClassroomStore(fx.sql,model),model,enabled:()=>true,verify}),records:createClassroomRecords({sql:fx.sql,enabled:()=>true}),verify,classroomEnabled:()=>true});
  handler=withStudentRecords({handler:inner,students:createStudentRecords({sql:fx.sql,enabled:()=>true}),verify,classroomEnabled:()=>true});
  await fx.sql`update engine.classes set display_name='합성 평일 TOPIK 4급' where class_id=${fx.cls.class_id}::uuid`;
  const [korea]=await fx.sql`insert into engine.classes(class_key,display_name) values('STUDENTS-KR','합성 한국 기수 2028 봄') returning class_id`;
  const [weekend]=await fx.sql`insert into engine.classes(class_key,display_name) values('STUDENTS-WE','합성 주말 K-드라마 회화') returning class_id`;
  for(const id of [korea.class_id,weekend.class_id])await fx.sql`insert into engine.staff_classes values(${fx.users.teacher.id}::uuid,${id}::uuid)`;
  await fx.sql`update engine.learners set student_code='사랑 · 합성' where learner_id=${fx.users.learner.id}::uuid`;
  const A={};for(const name of ['볼드','나랑','토야','오기'])A[name]=await seedStudent(fx.cls.class_id,name+' · 합성');
  const K={};for(const name of ['간바','오유나','바트','엥흐'])K[name]=await seedStudent(korea.class_id,name+' · 합성');
  const W={};for(const name of ['솔롱고','아리나'])W[name]=await seedStudent(weekend.class_id,name+' · 합성');
  const d=seoulToday(),branches=new Map((await fx.sql`select branch_key,branch_id from engine.synk_branches`).map(r=>[r.branch_key,r.branch_id]));
  await api('teacher',fx.cls.class_id,'/api/teacher/class-branch',{action:'set',branchId:branches.get('ulaanbaatar'),revision:0});
  await api('teacher',korea.class_id,'/api/teacher/class-branch',{action:'set',branchId:branches.get('korea'),revision:0});
  const saveDay=(classId,date,rows)=>api('teacher',classId,'/api/teacher/attendance',{action:'save',sessionDate:date,idempotencyKey:randomUUID(),rows});
  const everyone=Object.values(A);
  for(const [offset,absent] of [[-4,['오기']],[-3,['오기']],[-2,['오기']],[-1,['오기']],[0,['오기','토야']]])await saveDay(fx.cls.class_id,addDays(d,offset),everyone.map(s=>({learnerId:s.id,status:absent.includes(s.name.split(' ')[0])?'absent':'present',revision:0})));
  await saveDay(korea.class_id,d,[{learnerId:K.간바.id,status:'present',revision:0},{learnerId:K.오유나.id,status:'late',note:'수업 겹침',revision:0},{learnerId:K.바트.id,status:'present',revision:0}]);
  const topik=(classId,learnerId,level,ago,round)=>api('teacher',classId,'/api/teacher/topik',{action:'save',learnerId,kind:'II',round,level,announcedOn:addDays(d,-ago),idempotencyKey:randomUUID()});
  await topik(korea.class_id,K.간바.id,4,690,95);await topik(korea.class_id,K.바트.id,4,400,99);await topik(fx.cls.class_id,A.볼드.id,3,60,103);
  // 첫 저장은 화면이 읽은 공유 판을 함께 보낸다(중앙 GPT 2회차 GA2).
  const stay=async(classId,learnerId,body)=>{const [share]=await fx.sql`select revision from engine.synk_classroom_sharing where class_id=${classId}::uuid and learner_id=${learnerId}::uuid`;
    return api('teacher',classId,'/api/teacher/stay',{action:'save',learnerId,idempotencyKey:randomUUID(),sharingRevision:share.revision,...body});};
  await stay(korea.class_id,K.간바.id,{stage:'enrolled',university:'합성대학교',program:'학부 1학년',visaKind:'D-2-2',stayExpiresOn:addDays(d,212),enteredOn:addDays(d,-300),mentorStaffId:fx.users.teacher.id});
  await stay(korea.class_id,K.오유나.id,{stage:'enrolled',university:'합성대학교 어학당',program:'어학당 2학기',visaKind:'D-4-1',stayExpiresOn:addDays(d,58),universityAttendance:64,universityAttendanceOn:addDays(d,-3)});
  await stay(korea.class_id,K.바트.id,{stage:'arrived',university:'합성대학교',visaKind:'D-2-2',stayExpiresOn:addDays(d,-2)});
  const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  company=createCompanyApp({dataDir,port,schedule:false,webPushEnabled:false,teachingConfig:{issuer,accountApiUrl:issuer+'/functions/v1/synk-account',publishableKey:'sb_publishable_fixture_2026',clientId},teachingFetch,synkIdentityConfig:null,synkCustomerIdentityConfig:null,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});await company.start();base=`http://127.0.0.1:${port}`;
  const admin=company.store.createUser({email:'students-admin@example.test',name:'합성 관리자',role:'admin',password});
  browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'ko-KR',timezoneId:'Asia/Seoul'});page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});page.on('response',response=>{if(response.status()>=400){const row={url:response.url(),status:response.status(),type:response.request().resourceType(),body:(response.request().postData()||'').slice(0,160)};(['script','stylesheet','image','font'].includes(row.type)?report.assetErrors:report.httpErrors).push(row);}});
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===base||['blob:','data:'].includes(url.protocol))return route.continue();if(url.origin===issuer&&url.pathname==='/auth/v1/oauth/authorize'){const callback=new URL(url.searchParams.get('redirect_uri'));callback.search=new URLSearchParams({state:url.searchParams.get('state'),code:'synthetic-students-code'}).toString();return route.fulfill({status:302,headers:{Location:callback.href},body:''});}report.unexpectedRequests.push(url.href);return route.abort();});
  // ── 회사 로그인 → 왼쪽 메뉴 「학생 관리」 → SYNK ID 로그인 → 이 화면으로 돌아옴 ──
  await page.goto(base+'/');await page.locator('#auth-form [name="email"]').fill(admin.email);await page.locator('#auth-form [name="password"]').fill(password);
  await page.locator('#auth-form [type="submit"]').click();await page.locator('#ws-office').waitFor();
  const navRow=page.locator('.ws-side [data-tab="students"]');check('company menu shows 학생 관리 under 회사',await navRow.count()===1&&(await navRow.textContent()).includes('학생 관리'));
  await navRow.click();await page.locator('.st-signin').waitFor();await capture('signin-1440.png');
  await page.locator('[data-st-action="sign-in"]').click();await page.waitForURL(/tab=students/);await page.locator('.st-wrap').waitFor();
  check('after SYNK ID sign-in the page returns to 학생 관리, not LAB 수업',new URL(page.url()).searchParams.get('tab')==='students'&&!new URL(page.url()).searchParams.has('teachingConnected'));
  const root=page.locator('#students-root'),chip=root.locator('[data-st-jelly="branch"]>button'),pressedChip=root.locator('[data-st-jelly="branch"]>button[aria-pressed="true"]');
  check('branch pills show 전체 지점, the two open branches and 지점 미정 only',JSON.stringify(await chip.allTextContents())===JSON.stringify(['전체 지점','울란바토르 직영','한국 · 정착','지점 미정']),await chip.allTextContents());
  check('basis line names the three assigned classes',(await root.locator('.st-basis').textContent()).includes('배정된 반 3개 기준'));
  // 문장 요약: 찍은 반의 출석, 챙길 학생 수, 가장 급한 한 명만(시안 3).
  const say=(await root.locator('.st-say').textContent()).replace(/\s+/g,' ');
  check('the sentence counts 5 present of 7 recorded (71%), 4 students to look after, and names 오기 first',say.includes('찍은 반에서 5명이 왔어요')&&say.includes('71%예요')&&say.includes('챙길 학생은 4명이에요')&&say.includes('가장 급한 일은 오기 · 합성의 5회 연속 결석이에요'),say);
  const row=(name,anchor)=>root.locator(`.st-ag[data-anchor="${anchor}"]`,{hasText:name});
  const text=async locator=>(await locator.textContent()).replace(/\s+/g,' ');
  check('agenda counts: two stay rows (58 days, expired), one TOPIK row (40 days), one streak row',await root.locator('.st-agenda .st-ag[data-anchor="stay"]').count()===2&&await root.locator('.st-agenda .st-ag[data-anchor="topik"]').count()===1&&await root.locator('.st-agenda .st-ag[data-anchor="streak"]').count()===1);
  check('오유나 has a D-4-1 stay row at D-58 and a university attendance row under 70%',(await text(row('오유나','stay'))).includes('비자 D-4-1')&&(await text(row('오유나','stay'))).includes('D-58')&&(await text(row('오유나','attendance-university'))).includes('대학 출석 64%'));
  check('간바 has the TOPIK II 4급 row at D-40 with the mentor',/TOPIK 만료.*TOPIK II 4급.*멘토.*D-40/.test(await text(row('간바','topik'))),await text(row('간바','topik')));
  check('the agenda starts with 지금: 오기 streak first, 바트 expired stay inside 지금',(await root.locator('.st-ag-h').first().textContent())==='지금'&&(await text(root.locator('.st-agenda .st-ag').first())).includes('오기')&&(await root.locator('.st-agenda .st-ag').first().getAttribute('data-anchor'))==='streak'&&(await text(row('바트','stay'))).includes('2일 지남')&&(await text(row('바트','stay'))).includes('만료'));
  check('오기 shows the five-session streak and low class attendance',(await text(row('오기','streak'))).includes('5회 이어서 결석')&&(await text(row('오기','attendance'))).includes('출석 0%'));
  check('unshared learner is named as not recorded',(await root.locator('.st-off').textContent()).includes('사랑')&&(await root.locator('.st-off').textContent()).includes('기록하지 않아요'));
  const stage=async label=>(await root.locator('[data-st-jelly="stage"]>button',{hasText:label}).locator('em').textContent()).trim();
  check('journey pills: 모두 10 · 어학원 6 · 유학 수속 0 · 입국 · 정착 2 · 한국 재학 2',await stage('모두')==='10'&&await stage('어학원 재원')==='6'&&await stage('유학 수속')==='0'&&await stage('입국 · 정착')==='2'&&await stage('한국 재학')==='2',[await stage('모두'),await stage('어학원 재원'),await stage('입국 · 정착'),await stage('한국 재학')]);
  check('only the first class still to mark gets the dark button',await root.locator('.st-go').count()===1&&(await root.locator('.st-cl').filter({has:page.locator('.st-go')}).locator('.st-cl-name').textContent())==='합성 한국 기수 2028 봄');
  await capture('overview-1440.png');await fits(1440);
  // 검수자가 그림 밖에서도 화면 글을 읽게 보이는 글을 남긴다(카본 B1).
  const saveText=async(name,locator=root)=>{const path=join(out,name);await writeFile(path,await locator.innerText());report.screenshots.push(path);};
  await saveText('text-overview-1440.txt');
  // ── 지점 거르기 · 지점 정하기 ──
  await chip.filter({hasText:'한국 · 정착'}).click();
  check('choosing a branch pill slides a jelly pill to it',await root.locator('[data-st-jelly="branch"]>.st-jelly').count()===1&&(await pressedChip.textContent())==='한국 · 정착');
  check('Korea filter keeps only the Korea cohort class',JSON.stringify(await root.locator('.st-cl-name').allTextContents())===JSON.stringify(['합성 한국 기수 2028 봄']));
  const settled=await page.waitForFunction(()=>!document.querySelector('.st-jelly'),null,{timeout:3000}).then(()=>true,()=>false);check('the moving pill is removed when it arrives',settled,await page.evaluate(()=>[...document.querySelectorAll('.st-jelly')].map(el=>[el.getAnimations().map(a=>a.playState+':'+a.currentTime),el.isConnected])));
  await chip.filter({hasText:'지점 미정'}).click();
  await root.locator(`[data-st-branch-for="${weekend.class_id}"]`).selectOption(String(branches.get('ulaanbaatar')));
  await root.locator('.st-notice',{hasText:'반의 지점을 정했어요'}).waitFor();
  const [mapped]=await fx.sql`select b.branch_key from engine.synk_class_branches c join engine.synk_branches b using(branch_id) where c.class_id=${weekend.class_id}::uuid`;
  check('choosing a branch stores it and 지점 미정 disappears',mapped?.branch_key==='ulaanbaatar'&&!(await chip.allTextContents()).includes('지점 미정'),mapped);
  // 정해진 반에도 지점 고르기가 남고, 바꿀 때는 한 번 묻는다. 물음을 거절하면 그대로다(Fable 최종 F7).
  const weekendPick=root.locator(`[data-st-branch-for="${weekend.class_id}"]`);
  check('an assigned class keeps a branch picker showing its branch',await weekendPick.inputValue()===String(branches.get('ulaanbaatar')));
  let asked='';page.once('dialog',dialog=>{asked=dialog.message();dialog.dismiss();});await weekendPick.selectOption(String(branches.get('korea')));await page.waitForTimeout(300);
  const [kept]=await fx.sql`select b.branch_key from engine.synk_class_branches c join engine.synk_branches b using(branch_id) where c.class_id=${weekend.class_id}::uuid`;
  check('changing a set branch asks first; declining keeps it',asked.includes('바꿀까요')&&kept?.branch_key==='ulaanbaatar'&&await root.locator(`[data-st-branch-for="${weekend.class_id}"]`).inputValue()===String(branches.get('ulaanbaatar')),{asked,kept});
  // 반이 닫힌 지점에 매달려 있으면 그 지점이 「닫힌 지점」으로 골라진 채 보인다(Fable 다시 검수 FA1).
  await fx.sql`update engine.synk_branches set active=false where branch_key='ulaanbaatar'`;
  await root.locator('.st-basis [data-st-action="reload"]').click();await page.waitForFunction(()=>!students.loading);
  check('a class on a closed branch shows that branch as closed, not another branch',(await root.locator(`[data-st-branch-for="${fx.cls.class_id}"] option:checked`).textContent()).includes('울란바토르 직영 (닫힌 지점)'));
  await fx.sql`update engine.synk_branches set active=true where branch_key='ulaanbaatar'`;
  await root.locator('.st-basis [data-st-action="reload"]').click();await page.waitForFunction(()=>!students.loading);
  check('with 지점 미정 gone the filter falls back to 전체 지점 and shows every class (카본 A4)',await pressedChip.textContent()==='전체 지점'&&await root.locator('.st-cl').count()===3,await pressedChip.allTextContents());
  // ── 학생 카드: 엥흐(기록 없음)는 「알림 없는 학생」에서 연다. 카드는 그 줄 아래에 펼쳐진다 ──
  await root.locator('[data-st-action="others"]').click();
  await row('엥흐','other').click();const card=root.locator('#st-card');await card.waitFor();
  check('the card opens under the row that opened it',await row('엥흐','other').getAttribute('aria-expanded')==='true'&&await page.evaluate(()=>document.querySelector('.st-ag[aria-expanded="true"]').nextElementSibling?.id)==='st-card');
  await card.locator('[name=stage]').selectOption('enrolled');await card.locator('[name=visaKind]').selectOption('D-2-2');await card.locator('[name=university]').fill('합성대학교');
  await card.locator('[name=program]').fill('학부 1학년');await card.locator('[name=stayExpiresOn]').fill(addDays(d,100));await card.locator('[name=mentorStaffId]').selectOption(String(fx.users.teacher.id));
  await card.scrollIntoViewIfNeeded();await capture('card-1440.png');await saveText('text-card-1440.txt',root.locator('.st-side'));
  // 출석률 칸이 0~100을 넘으면 브라우저 칸 검사가 저장을 막는다(카본 A1).
  await card.locator('[name=universityAttendance]').fill('150');await card.locator('[data-st-action="stay-save"]').click();await page.waitForTimeout(300);
  check('an out-of-range university attendance is stopped before saving',(await fx.sql`select 1 from engine.synk_learner_stay where learner_id=${K.엥흐.id}::uuid`).length===0&&await card.locator('[name=universityAttendance]').evaluate(el=>!el.validity.valid)&&await card.locator('[name=university]').inputValue()==='합성대학교');
  await card.locator('[name=universityAttendance]').fill('');
  // 칸에서 Enter를 누르면 닫히지 않고 저장된다(카본 A2).
  await card.locator('[name=program]').press('Enter');await root.locator('.st-notice',{hasText:'재학 기록을 저장했어요'}).waitFor();
  const [saved]=await fx.sql`select stage,visa_kind,university,stay_expires_on::text as e,mentor_staff_id,revision from engine.synk_learner_stay where learner_id=${K.엥흐.id}::uuid`;
  check('card save stores the stay record with the class teacher as mentor',saved?.stage==='enrolled'&&saved.visa_kind==='D-2-2'&&saved.e===addDays(d,100)&&saved.mentor_staff_id===fx.users.teacher.id&&saved.revision===1,saved);
  check('pressing Enter saved the record and kept the card open',await card.count()===1&&await card.isVisible());
  check('the open card itself says the record was saved (Fable 최종 F4)',(await card.locator('.st-done').textContent()).includes('재학 기록을 저장했어요'));
  check('the new 100-day stay row appears without reload and the card follows 엥흐 there',(await text(row('엥흐','stay'))).includes('D-100')&&(await text(row('엥흐','stay'))).includes('비자 D-2-2')&&await root.locator('.st-agenda .st-ag[data-anchor="stay"]').count()===3&&await row('엥흐','stay').getAttribute('aria-expanded')==='true');
  check('focus stays in the field that was being typed in',await page.evaluate(()=>document.activeElement?.name)==='program');
  // 다른 곳에서 먼저 고쳤으면(판 충돌) 안내가 뜨고 쓰던 칸은 그대로 남는다(카본 A1). 다시 저장하면 새 판 위에 저장된다.
  await fx.sql`update engine.synk_learner_stay set revision=revision+1,note='다른 화면' where learner_id=${K.엥흐.id}::uuid`;
  await card.locator('[name=program]').fill('학부 2학년');await card.locator('[data-st-action="stay-save"]').click();
  await card.locator('.st-error').waitFor();
  // 이 409 하나는 일부러 낸 판 충돌이다. 오류 목록에서 덜고 꼭 하나였는지 본다.
  const conflictHttp=report.httpErrors.filter(r=>r.status===409),conflictConsole=report.consoleErrors.filter(t=>t.includes('409 (Conflict)'));
  check('the deliberate conflict made exactly one 409 response',conflictHttp.length===1&&conflictConsole.length===1,{conflictHttp,conflictConsole});
  report.httpErrors=report.httpErrors.filter(r=>r.status!==409);report.consoleErrors=report.consoleErrors.filter(t=>!t.includes('409 (Conflict)'));
  check('a revision conflict keeps what was typed and says so',await card.locator('[name=program]').inputValue()==='학부 2학년'&&(await card.locator('.st-error').textContent()).includes('쓰신 칸은 그대로'),await card.locator('.st-error').textContent());
  await card.locator('[data-st-action="stay-save"]:not([disabled])').click();
  let again;for(let i=0;i<50;i++){[again]=await fx.sql`select program,revision from engine.synk_learner_stay where learner_id=${K.엥흐.id}::uuid`;if(again?.revision===3)break;await page.waitForTimeout(100);}
  await card.locator('[data-st-action="stay-save"]:not([disabled])').waitFor();check('saving again after the conflict lands on the newer revision',again.program==='학부 2학년'&&again.revision===3,again);
  // 카드가 다른 줄로 옮겨 간 뒤에도 펼친 그 줄을 다시 누르면 접힌다(카본 A1).
  await row('엥흐','stay').click();
  check('after the card followed 엥흐 to the stay row, pressing that row folds it',await card.count()===0&&await row('엥흐','stay').getAttribute('aria-expanded')==='false');
  await row('엥흐','stay').click();await card.waitFor();
  await card.locator('.st-close').click();
  check('closing the card returns focus to that student row',await page.evaluate(()=>[document.activeElement?.dataset?.learner,document.activeElement?.getAttribute('aria-expanded')])+''===[K.엥흐.id,'false']+'');
  // 카드를 연 채 다른 곳에서 고치고 「새로 고침」하면 손대지 않은 칸은 새 값으로 바뀌고, 저장해도 남의 고침이 되돌아가지 않는다(Fable 최종 F1).
  await row('간바','topik').click();await card.waitFor();
  await fx.sql`update engine.synk_learner_stay set revision=revision+1,note='다른 담당 메모',stay_expires_on=${addDays(d,230)}::date where learner_id=${K.간바.id}::uuid`;
  await root.locator('.st-basis [data-st-action="reload"]').click();await page.waitForFunction(()=>!students.loading);
  check('after a reload the untouched card fields show the newer record',await card.locator('[name=note]').inputValue()==='다른 담당 메모'&&await card.locator('[name=stayExpiresOn]').inputValue()===addDays(d,230));
  const [ganbaBefore]=await fx.sql`select revision from engine.synk_learner_stay where learner_id=${K.간바.id}::uuid`;
  await card.locator('[name=program]').fill('학부 2학년');await card.locator('[data-st-action="stay-save"]').click();
  await card.locator('.st-done',{hasText:'재학 기록을 저장했어요'}).waitFor();
  const [ganba]=await fx.sql`select program,note,stay_expires_on::text as e,revision from engine.synk_learner_stay where learner_id=${K.간바.id}::uuid`;
  check('saving only the changed field keeps the other person\'s newer note and date',ganba.program==='학부 2학년'&&ganba.note==='다른 담당 메모'&&ganba.e===addDays(d,230)&&ganba.revision===ganbaBefore.revision+1,ganba);
  await card.locator('.st-close').click();await page.waitForFunction(()=>!students.card);
  // 카드는 목록 안에 있으므로 다른 줄을 누르면 닫힌다. 쓰던 칸이 있으면 먼저 묻고, 거절하면 쓰던 그대로 남는다.
  await row('간바','topik').click();await card.waitFor();await card.locator('[name=note]').fill('비자 연장 서류 확인');
  asked='';page.once('dialog',dialog=>{asked=dialog.message();dialog.dismiss();});await row('바트','stay').click();await page.waitForTimeout(200);
  check('opening another row with typed fields asks first; declining keeps the card and the typing',asked.includes('저장하지 않고')&&await row('간바','topik').getAttribute('aria-expanded')==='true'&&await card.locator('[name=note]').inputValue()==='비자 연장 서류 확인',asked);
  // 쓰던 칸을 두고 「반에서 찍기」로 떠나려 해도 먼저 묻고, 거절하면 이 화면과 쓰던 칸이 남는다(Fable 최종 F2).
  asked='';page.once('dialog',dialog=>{asked=dialog.message();dialog.dismiss();});await root.locator('.st-go, .st-go-quiet').first().click();await page.waitForTimeout(200);
  check('leaving for a class with typed fields asks first; declining stays here',asked.includes('떠날까요')&&await page.evaluate(()=>state.tab)==='students'&&await card.locator('[name=note]').inputValue()==='비자 연장 서류 확인',asked);
  asked='';page.once('dialog',dialog=>{asked=dialog.message();dialog.accept();});await card.locator('[name=note]').press('Escape');await page.waitForTimeout(200);
  check('Esc asks the same, then folds the card and returns focus to its row',asked.includes('저장하지 않고')&&await card.count()===0&&await page.evaluate(()=>document.activeElement?.dataset?.anchor)==='topik');
  // 문장 속 이름을 누르면 「챙길 차례」의 그 줄이 펼쳐지고 초점이 그리로 간다.
  await root.locator('.st-say .st-name').click();await card.waitFor();
  check('the name in the sentence opens that row and moves focus there',await row('오기','streak').getAttribute('aria-expanded')==='true'&&await page.evaluate(()=>document.activeElement?.dataset?.anchor)==='streak');
  await page.keyboard.press('Escape');
  check('Esc with focus on the open row folds the card (카본 A3)',await card.count()===0&&await page.evaluate(()=>document.activeElement?.dataset?.anchor)==='streak');
  await row('오기','streak').click();await card.waitFor();await row('오기','streak').click();check('pressing the open row again folds it',await card.count()===0);
  // 카드를 연 채 다른 탭으로 가면 카드가 닫히고, 돌아오면 화면이 다시 선다(카본 A5).
  await row('간바','topik').click();await card.waitFor();
  await page.evaluate(()=>{state.tab='home';render();});await page.waitForTimeout(200);
  check('leaving the tab closes the open student card',await page.evaluate(()=>students.card===null&&!document.querySelector('[data-st-form]')));
  await page.evaluate(()=>{state.tab='students';render();});await page.locator('#students-root .st-wrap').waitFor();
  await page.reload();await page.locator('.st-wrap').waitFor();
  check('after reload the saved record and alerts are still there',(await text(page.locator('#students-root .st-ag[data-anchor="stay"]',{hasText:'엥흐'}))).includes('학부 2학년'));
  // 단계를 거르면 문장의 챙길 학생 수도 그 단계 기준이라고 말한다(카본 A2).
  await root.locator('[data-st-jelly="stage"]>button',{hasText:'입국 · 정착'}).click();
  const sayStage=(await root.locator('.st-say').textContent()).replace(/\s+/g,' ');
  check('with a stage pill the sentence says the count is for that stage',sayStage.includes('입국 · 정착 학생 가운데 챙길 학생은 1명이에요')&&sayStage.includes('가장 급한 일은 바트 · 합성의'),sayStage);
  await root.locator('[data-st-jelly="stage"]>button',{hasText:'모두'}).click();
  // 공결만 찍힌 날은 「아직 찍은 반이 없어요」가 아니라 모두 공결이라고 말한다(카본 A5).
  const excusedOnly=await page.evaluate(()=>{const keep=students.data;students.data={...keep,classes:keep.classes.map(c=>({...c,branchToday:c.branchToday&&{...c.branchToday,counts:{present:0,late:0,absent:0,excused:1,unrecorded:0}}}))};const vm=studentsModel();students.data=keep;const div=document.createElement('div');div.innerHTML=StudentsView.inner(vm);return div.querySelector('.st-say').textContent;});
  check('a day with only excused marks says so, not that nothing was marked',excusedOnly.includes('모두 공결')&&!excusedOnly.includes('아직'),excusedOnly);
  const tinyWide=await page.evaluate(()=>[...document.querySelectorAll('#students-root *')].filter(el=>el.getClientRects().length&&el.childElementCount===0&&el.textContent.trim()&&parseFloat(getComputedStyle(el).fontSize)<12).map(el=>el.textContent.trim().slice(0,20)));check('text stays 12px or larger at 1440',tinyWide.length===0,tinyWide);
  // ── 밤 바탕 · 390 폭 ──
  await page.evaluate(()=>document.documentElement.setAttribute('data-lobby-theme','night'));await page.waitForTimeout(150);await capture('overview-night-1440.png');
  await page.evaluate(()=>document.documentElement.removeAttribute('data-lobby-theme'));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await fits(390);await capture('overview-390.png');
  // 첫 화면만이 아니라 쪽 전체도 찍는다(카본 B3).
  await capture('overview-390-full.png',{full:true});await saveText('text-overview-390.txt');
  await page.locator('#students-root .st-side').evaluate(element=>element.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(100);await capture('alerts-390.png');
  const tiny=await page.evaluate(()=>[...document.querySelectorAll('#students-root *')].filter(el=>el.getClientRects().length&&el.childElementCount===0&&el.textContent.trim()&&parseFloat(getComputedStyle(el).fontSize)<12).map(el=>el.textContent.trim().slice(0,20)));check('text stays 12px or larger at 390',tiny.length===0,tiny);
  await page.locator('#students-root .st-ag[data-anchor="stay"]',{hasText:'오유나'}).click();await page.locator('#st-card').waitFor();await page.locator('#st-card').scrollIntoViewIfNeeded();await fits(390);await capture('card-390.png');
  // 재학 기록을 지우면 지우기 단추가 사라져도 초점은 열린 카드에 남는다(카본 A4).
  page.once('dialog',dialog=>dialog.accept());await page.locator('#st-card [data-st-action="stay-delete"]').click();
  await page.locator('#st-card .st-done',{hasText:'재학 기록을 지웠어요'}).waitFor();
  check('deleting a record keeps focus inside the open card',(await fx.sql`select 1 from engine.synk_learner_stay where learner_id=${K.오유나.id}::uuid`).length===0&&await page.evaluate(()=>Boolean(document.activeElement?.closest?.('#st-card'))));
  // 수업 서버가 학생 기록을 붙이지 못한 응답은 「아직 열리지 않았어요」가 아니라 「불러오지 못했어요」와 다시 불러오기다(Fable 최종 F3).
  const skipped=await page.evaluate(()=>{const keep=students.data;students.data={...keep,students:undefined,studentsUnavailable:true};const vm=studentsModel();students.data=keep;return vm;});
  check('a response without student records is shown as not loaded, not as closed',skipped.phase==='closed'&&skipped.closed.unavailable===true&&(await page.evaluate(vm=>{const div=document.createElement('div');div.innerHTML=StudentsView.inner(vm);return div.textContent;},skipped)).includes('불러오지 못했어요'),skipped);
  const busy=await page.evaluate(()=>{const div=document.createElement('div');div.innerHTML=StudentsView.inner({phase:'closed',notice:null,closed:{classCount:3,unavailable:true,loading:true}});return div.querySelector('[data-st-action="reload"]').outerHTML;});
  check('the reload button in that state shows it is working (Fable 다시 검수 FA3)',busy.includes('다시 확인하는 중이에요')&&busy.includes('disabled'),busy);
  // 회사 세션이 끝나면(401 → 로그인 화면) 열린 학생 카드와 학생 자료가 바로 지워진다(Fable 최종 F1).
  await page.evaluate(()=>{state.user=null;state.csrf='';state.data=null;renderAuth();});await page.waitForTimeout(200);
  check('a company session ending closes and empties the student card and drops student data',await page.evaluate(()=>!document.querySelector('[data-st-form]')&&students.card===null&&students.data===null));
  check('browser has no page errors',report.errors.length===0,report.errors);check('browser has no console errors',report.consoleErrors.length===0,report.consoleErrors);check('all assets load',report.assetErrors.length===0,report.assetErrors);check('no failed API or document responses',report.httpErrors.length===0,report.httpErrors);check('no unexpected external requests',report.unexpectedRequests.length===0,report.unexpectedRequests);
  report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;if(page)try{await capture('failure-viewport.png');report.failureText=(await page.locator('body').innerText()).slice(0,8000);}catch{}}
finally{if(browser)await browser.close();if(company)await company.stop();if(fx)await fx.close();const safe=resolve(dataDir);assert.ok(safe.startsWith(resolve(tmpdir())+sep)&&safe.split(sep).at(-1).startsWith('synk-workspace-students-ui-'));await rm(safe,{recursive:true,force:true});if(previousJobs===undefined)delete process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;else process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED=previousJobs;await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,passed:report.checks.filter(c=>c.ok).length,total:report.checks.length,failure:report.failure?.split('\n').slice(0,4).join(' | '),out}));}
