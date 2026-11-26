// 반 출결 · TOPIK(학원 운영 최소판) 실제 화면 확인: 실제 Chromium + 버리는 회사 SQLite + 메모리 PostgreSQL(PGlite)의 정본 교실.
// verify-workspace-care-browser.mjs와 같은 고정 자료 · 가짜 로그인을 쓰고, 교실 함수는 index.ts처럼 지금 운영 묶음을 SYNK-talk lib/synk-classroom-records.js로 감싸 띄운다.
// 학생 · 교사는 모두 지어낸 이름이다. 운영 계정 · 외부 로그인 · 배포 · 공개 없음.
// 쓰기: SYNK_TALK_ROOT=<SYNK-talk 작업본> node docs/마케팅/온라인마케팅지도/engagement/company/qa/verify-workspace-records-browser.mjs
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
const runtime=require(join(talk,'supabase/functions/_shared/synk-classroom-runtime.js')),{model}=runtime;
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=resolve(process.env.SYNK_WORKSPACE_RECORDS_QA_OUT||join(root,'docs/_ops/qa/workspace-records-20261127'));
const dataDir=await mkdtemp(join(tmpdir(),'synk-workspace-records-ui-')),previousJobs=process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;
process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='0';
const issuer='https://identity.example.test',clientId='teacher-browser';
const report={checkedAt:new Date().toISOString(),synthetic:true,production:false,talk,scope:'real Chromium + disposable company SQLite + memory-only canonical PostgreSQL; operating classroom runtime wrapped by SYNK-talk class records with the switch on; invented learners only',checks:[],errors:[],consoleErrors:[],assetErrors:[],httpErrors:[],unexpectedRequests:[],expectedConflicts:[],screenshots:[]};
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
async function seedStudent(classId,name,{registered=true,share=true}={}){
  if(!registered){const [row]=await fx.sql`insert into engine.learners(student_code,class_id) values(${name},${classId}::uuid) returning learner_id`;return {id:row.learner_id,classId,name};}
  const key='learner-'+randomUUID(),identity={id:randomUUID(),sessionId:randomUUID(),issuedAt:Math.floor(Date.now()/1000)-1,providers:['synthetic']};
  await fx.sql`insert into auth.users values(${identity.id}::uuid)`;
  const [row]=await fx.sql`insert into engine.learners(auth_user_id,student_code,class_id) values(${identity.id}::uuid,${name},${classId}::uuid) returning learner_id`;
  await createPgStore(fx.sql).withAccount(identity,'world',tx=>tx.setLearning(true));fx.users[key]={identity,id:row.learner_id};
  if(share){const before=await api(key,classId,'/api/world/account');await api(key,classId,'/api/world/sharing',{enabled:true,revision:before.sharing.revision});}
  return {id:row.learner_id,classId,name,key};
}
async function capture(name,{full=false}={}){const path=join(out,name);await page.screenshot({path,fullPage:full});report.screenshots.push(path);}
async function fits(width){const result=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));check('no horizontal overflow at '+width,result.width===result.scroll,result);}
async function openClass(name){await page.locator('.overview-class',{hasText:name}).locator('[data-overview-class]').click();await page.locator('.class-records .att-row').first().waitFor();}
const pressed=async learnerId=>page.locator(`.class-records [data-att-row="${learnerId}"] [data-att-status][aria-pressed="true"]`).getAttribute('data-att-status').catch(()=>null);
try{
  await mkdir(out,{recursive:true});fx=await createFixture();
  // 운영과 같게 과제 표도 둔다(없으면 반 화면 안의 과제 칸이 404를 받아 숨는다).
  for(const file of ['20261009230000_synk_teaching_care_towns_c16.sql','20261020150000_synk_classroom_homework_c18.sql','20261127100000_synk_class_attendance_topik_c18.sql'])await fx.db.exec(await readFile(join(talk,'supabase/migrations',file),'utf8'));
  const verify=rememberIdentity(async request=>{const role=request.headers.get('authorization')?.replace('Bearer synthetic-','');if(!fx.users[role])throw Object.assign(Error('AUTH_REQUIRED'),{status:401,code:'AUTH_REQUIRED'});return fx.users[role].identity;});
  handler=withClassRecords({handler:runtime.createClassroomService({store:runtime.createClassroomStore(fx.sql,model),model,enabled:()=>true,verify}),records:createClassroomRecords({sql:fx.sql,enabled:()=>true}),verify,classroomEnabled:()=>true});
  await fx.sql`update engine.classes set display_name='합성 A반' where class_id=${fx.cls.class_id}::uuid`;
  const [second]=await fx.sql`insert into engine.classes(class_key,display_name) values('RECORDS-B','합성 B반') returning class_id`;await fx.sql`insert into engine.staff_classes values(${fx.users.teacher.id}::uuid,${second.class_id}::uuid)`;
  // 기존 고정 학생 한 명은 공유하지 않은 채 둔다(명부에는 있지만 출결 · TOPIK을 남기지 않는 줄).
  await fx.sql`update engine.learners set student_code='사랑 · 합성' where learner_id=${fx.users.learner.id}::uuid`;
  const A={};for(const name of ['가온','나래','다솜','라온','마루','바다'])A[name]=await seedStudent(fx.cls.class_id,name+' · 합성');
  A.아라=await seedStudent(fx.cls.class_id,'아라 · 합성',{registered:false});
  const B={};for(const name of ['자람','차오름','카이','타라'])B[name]=await seedStudent(second.class_id,name+' · 합성');
  const d=seoulToday(),saveDay=(classId,date,rows)=>api('teacher',classId,'/api/teacher/attendance',{action:'save',sessionDate:date,idempotencyKey:randomUUID(),rows});
  const everyone=Object.values(A).filter(s=>s.key);
  for(const [offset,absent] of [[-7,[]],[-3,['마루']],[-2,['마루','라온']],[-1,['마루']]])await saveDay(fx.cls.class_id,addDays(d,offset),everyone.map(s=>({learnerId:s.id,status:absent.some(n=>A[n].id===s.id)?'absent':'present',revision:0})));
  await saveDay(second.class_id,d,[{learnerId:B.자람.id,status:'late',note:'버스 지연',revision:0},{learnerId:B.차오름.id,status:'present',revision:0}]);
  const topik=(classId,learnerId,kind,round,level,ago)=>api('teacher',classId,'/api/teacher/topik',{action:'save',learnerId,kind,round,level,announcedOn:addDays(d,-ago),idempotencyKey:randomUUID()});
  // 가온: 더 최근 3급이 대표 성적이 되어도 만료 판정은 유효한 4급(level4)으로 한다(학생 줄 배지와 담당 반 요약이 같은 기준).
  await topik(fx.cls.class_id,A.가온.id,'II',95,4,710);await topik(fx.cls.class_id,A.가온.id,'II',102,3,20);await topik(fx.cls.class_id,A.나래.id,'II',96,5,660);await topik(fx.cls.class_id,A.다솜.id,'II',101,3,100);
  await topik(fx.cls.class_id,A.라온.id,'II',91,4,760);await topik(fx.cls.class_id,A.바다.id,'I',100,2,40);await topik(second.class_id,B.카이.id,'II',99,6,200);
  const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  company=createCompanyApp({dataDir,port,schedule:false,webPushEnabled:false,teachingConfig:{issuer,accountApiUrl:issuer+'/functions/v1/synk-account',publishableKey:'sb_publishable_fixture_2026',clientId},teachingFetch,synkIdentityConfig:null,synkCustomerIdentityConfig:null,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});await company.start();base=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'ko-KR',timezoneId:'Asia/Seoul'});page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});page.on('response',response=>{if(response.status()>=400){const row={url:response.url(),status:response.status(),type:response.request().resourceType(),body:(response.request().postData()||'').slice(0,160)};(['script','stylesheet','image','font'].includes(row.type)?report.assetErrors:report.httpErrors).push(row);}});
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===base||['blob:','data:'].includes(url.protocol))return route.continue();if(url.origin===issuer&&url.pathname==='/auth/v1/oauth/authorize'){const callback=new URL(url.searchParams.get('redirect_uri'));callback.search=new URLSearchParams({state:url.searchParams.get('state'),code:'synthetic-records-code'}).toString();return route.fulfill({status:302,headers:{Location:callback.href},body:''});}report.unexpectedRequests.push(url.href);return route.abort();});
  await page.goto(base+'/?tab=teaching');await page.locator('#connect').click();await page.locator('.class-summary').waitFor();
  // ── 담당 반 요약 ──
  const summary=page.locator('.class-summary');
  check('summary shows the Seoul basis date',(await summary.locator('.ovs-basis').textContent()).includes(d));
  const block=title=>summary.locator('.ovs-block',{has:page.locator('h4',{hasText:title})});
  check('today late learner of class B appears with the reason',(await block('오늘 결석').textContent()).includes('자람 · 합성')&&(await block('오늘 결석').textContent()).includes('버스 지연'));
  check('three straight absences lists only 마루',(await block('3회 연속').locator('button').allTextContents()).length===1&&(await block('3회 연속').textContent()).includes('마루 · 합성'));
  const expiry=await block('TOPIK 만료').textContent();check('TOPIK 90-day list has within-30, within-90 and expired learners',expiry.includes('가온 · 합성')&&expiry.includes('30일 안 만료')&&expiry.includes('나래 · 합성')&&expiry.includes('90일 안 만료')&&expiry.includes('라온 · 합성')&&expiry.includes('만료'));
  const noLevel4=await block('유효한 4급 이상 없음').textContent();check('no valid level 4 lists below-4, expired and no-record learners but not valid level 4+',['다솜','라온','마루','바다','자람','차오름','타라'].every(n=>noLevel4.includes(n+' · 합성'))&&!['가온','나래','카이'].some(n=>noLevel4.includes(n+' · 합성')),noLevel4);
  check('unshared and unconnected learners are not counted in the summary',!(await summary.textContent()).includes('사랑 · 합성')&&!(await summary.textContent()).includes('아라 · 합성'));
  await summary.evaluate(element=>element.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(100);await capture('summary-1440.png');await fits(1440);
  // ── 반 화면의 「오늘 출결」 띠 ──
  await openClass('합성 A반');const band=page.locator('.class-records');
  check('band lists the whole roster with unshared rows muted',await band.locator('.att-row').count()===8&&await band.locator('.att-row.is-off').count()===2);
  const counts=async()=>(await band.locator('.att-counts b').allTextContents()).join(' ');
  check('band starts from today and has no rows recorded yet',(await band.locator('h3').textContent())==='오늘 출결'&&await counts()==='0 0 0 0 6',await counts());
  check('row badge judges expiry by the valid level 4 even when a newer level 3 is the representative',(await band.locator(`[data-att-row="${A.가온.id}"] .att-topik-name`).textContent())==='TOPIK II 4급');
  check('row shows the four TOPIK badge states',(await band.locator(`[data-att-row="${A.다솜.id}"] .status-badge`).textContent())==='유효'&&(await band.locator(`[data-att-row="${A.나래.id}"] .status-badge`).textContent())==='90일 안 만료'&&(await band.locator(`[data-att-row="${A.가온.id}"] .status-badge`).textContent())==='30일 안 만료'&&(await band.locator(`[data-att-row="${A.라온.id}"] .status-badge`).first().textContent())==='만료');
  check('streak badge shows on the learner with three straight absences',(await band.locator(`[data-att-row="${A.마루.id}"] .att-streak`).textContent()).includes('3회'));
  // 상태 없이 메모만 쓴 줄: 「출결 저장」이 켜지고, 누르면 보내지 않고 상태를 먼저 고르라고 알린다.
  await band.locator(`[data-att-note="${A.가온.id}"]`).fill('병원 들렀다 옴');
  check('a note without a status enables 「출결 저장」',await band.locator('[data-att-save]').isEnabled());
  await band.locator('[data-att-save]').click();await band.locator('.att-message',{hasText:'출결 상태를 먼저 골라 주세요'}).waitFor();
  const [{n:noteOnly}]=await fx.sql`select count(*)::int as n from engine.synk_class_attendance where class_id=${fx.cls.class_id}::uuid and session_date=${d}::date`;
  check('note-only save sends nothing and moves focus to the status of that learner',noteOnly===0&&await page.evaluate(id=>document.activeElement?.dataset?.learner===id&&document.activeElement?.dataset?.attStatus==='present',A.가온.id),noteOnly);
  await band.locator(`[data-att-note="${A.가온.id}"]`).fill('');
  check('clearing that note lifts the row mark and the status-first notice with the save button',await band.locator('[data-att-message]').count()===0&&!(await band.locator(`[data-att-row="${A.가온.id}"] .att-name small`).textContent()).includes('상태를 골라')&&await band.locator('[data-att-save]').isDisabled());
  await band.locator('[data-att-all]').click();await band.locator(`[data-att-row="${A.마루.id}"] [data-att-status="absent"]`).click();await band.locator(`[data-att-row="${A.다솜.id}"] [data-att-status="late"]`).click();
  await band.locator(`[data-att-note="${A.다솜.id}"]`).fill('버스 지연 10분');
  check('「모두 출석」 fills every shared learner and the exceptions change only those rows',await counts()==='4 1 1 0 0',await counts());
  await band.evaluate(element=>element.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(100);await capture('band-before-save-1440.png');
  await band.locator('[data-att-save]').click();await band.locator('.att-message',{hasText:'출결을 저장했어요'}).waitFor();
  const rows=await fx.sql`select learner_id,status,note,revision,recorded_by from engine.synk_class_attendance where class_id=${fx.cls.class_id}::uuid and session_date=${d}::date`;
  check('one batch saved six rows with the teacher as recorder and table-wide revisions',rows.length===6&&rows.every(r=>r.recorded_by===fx.users.teacher.id&&Number.isSafeInteger(r.revision)&&r.revision>0)&&new Set(rows.map(r=>r.revision)).size===6&&rows.find(r=>r.learner_id===A.다솜.id)?.note==='버스 지연 10분',rows);
  check('after saving, keyboard focus lands on the result line instead of dropping to the page',await page.evaluate(()=>document.activeElement?.dataset?.attMessage==='1'));
  check('saved rows show who recorded them',(await band.locator(`[data-att-row="${A.마루.id}"] .att-name small`).textContent()).includes('저장'));
  await band.locator(`[data-att-row="${A.마루.id}"] .att-streak`,{hasText:'4회'}).waitFor();
  check('after saving, the streak badge in the band follows the new result without reload, and rows stay recordable',(await band.locator(`[data-att-row="${A.마루.id}"] .att-streak`).textContent()).includes('연속 결석 4회')&&await pressed(A.마루.id)==='absent'&&await band.locator('.att-row.is-off').count()===2);
  check('「모두 출석」 is disabled once every shared learner has a status',await band.locator('[data-att-all]').isDisabled());
  await page.reload();await page.locator('.class-summary').waitFor();await openClass('합성 A반');
  check('after reload the saved statuses are pressed again',await pressed(A.마루.id)==='absent'&&await pressed(A.다솜.id)==='late'&&await pressed(A.가온.id)==='present'&&(await page.locator(`[data-att-note="${A.다솜.id}"]`).inputValue())==='버스 지연 10분');
  check('summary now lists today absence and the four-session streak',(await page.locator('.class-summary .ovs-block',{has:page.locator('h4',{hasText:'오늘 결석'})}).textContent()).includes('마루 · 합성')&&(await page.locator('.class-summary').textContent()).includes('4회 연속'));
  // 받은 판(표 전체 순번)을 그대로 돌려보내면 다시 저장된다: 다솜의 메모만 고친다.
  const before=new Map(rows.map(r=>[r.learner_id,r.revision]));
  await page.locator(`[data-att-note="${A.다솜.id}"]`).fill('버스 지연 15분');await page.locator('.class-records [data-att-save]').click();await page.locator('.class-records .att-message',{hasText:'출결을 저장했어요'}).waitFor();
  const again=await fx.sql`select learner_id,note,revision from engine.synk_class_attendance where class_id=${fx.cls.class_id}::uuid and session_date=${d}::date`;
  check('a second save sends back the received revisions: only the changed row gets a newer revision',again.length===6&&again.every(r=>r.learner_id===A.다솜.id?r.note==='버스 지연 15분'&&r.revision>before.get(r.learner_id):r.revision===before.get(r.learner_id)),again);
  // ── TOPIK 칸: 마루에게 성적 넣기 ──
  await page.locator(`[data-att-topik-open="${A.마루.id}"]`).click();const form=page.locator(`[data-att-topik-form="${A.마루.id}"]`);
  await form.locator('select[name=kind]').selectOption('II');await form.locator('input[name=round]').fill('105');await form.locator('select[name=level]').selectOption('4');
  // 발표일을 비운 채 저장하면 그 패널 안에 알리고 발표일 칸으로 초점을 옮긴다.
  await form.locator('button[type=submit]').click();await form.locator('[role=alert]',{hasText:'성적 발표일을 골라 주세요'}).waitFor();
  check('a TOPIK form error shows inside the panel and focuses the wrong field',await page.evaluate(()=>document.activeElement?.name==='announcedOn'&&document.activeElement.getAttribute('aria-invalid')==='true'));
  await form.locator('input[name=announcedOn]').fill(addDays(d,-30));
  await page.locator(`[data-att-row="${A.마루.id}"]`).scrollIntoViewIfNeeded();await capture('topik-form-1440.png');
  await form.locator('button[type=submit]').click();await page.locator('.class-records .att-message',{hasText:'제105회'}).waitFor();
  const [stored]=await fx.sql`select kind,round,level,announced_on::text as a,expires_on::text as e,(announced_on+interval '2 years')::date::text as expected from engine.synk_learner_topik where learner_id=${A.마루.id}::uuid`;
  check('TOPIK save stores kind, integer round and server-made expiry',stored.kind==='II'&&stored.round===105&&stored.level===4&&stored.a===addDays(d,-30)&&stored.e===stored.expected,stored);
  check('row badge turns 유효 for the new record',(await page.locator(`[data-att-row="${A.마루.id}"] .att-topik .status-badge`).textContent())==='유효');
  // 고치는 사이 다른 화면이 같은 성적을 고치면(판 충돌) 그 학생 성적을 다시 받고, 적던 값을 남긴 채 새 판으로 다시 저장된다.
  await page.locator(`[data-att-topik-edit][data-learner="${A.마루.id}"]`).click();
  const [mine]=await fx.sql`select topik_id,revision,announced_on::text as a from engine.synk_learner_topik where learner_id=${A.마루.id}::uuid`;
  await api('teacher',fx.cls.class_id,'/api/teacher/topik',{action:'save',learnerId:A.마루.id,id:mine.topik_id,revision:mine.revision,kind:'II',round:105,level:5,announcedOn:mine.a});
  const httpBefore=report.httpErrors.length,consoleBefore=report.consoleErrors.length;
  await form.locator('select[name=level]').selectOption('3');await form.locator('button[type=submit]').click();
  await page.locator('.class-records .att-message',{hasText:'다른 화면에서 이 성적이 먼저 바뀌었어요'}).waitFor();
  // 일부러 낸 409 한 번은 아래 「오류 없음」 검사에서 따로 센다(그 밖의 실패 응답 · 콘솔 오류는 그대로 걸린다).
  for(const row of report.httpErrors.splice(httpBefore))(row.status===409&&row.url.endsWith('/api/teaching/request')?report.expectedConflicts:report.httpErrors).push(row);
  report.consoleErrors.push(...report.consoleErrors.splice(consoleBefore).filter(text=>!/status of 409/.test(text)));
  check('the TOPIK conflict is exactly one 409 from the teaching relay',report.expectedConflicts.length===1,report.expectedConflicts);
  check('a TOPIK edit conflict reloads that learner and keeps the typed level',(await page.locator(`#att-topik-${A.마루.id} .att-topik-table`).textContent()).includes('5급')&&await form.locator('select[name=level]').inputValue()==='3'&&(await form.locator('legend').textContent())==='TOPIK II 제105회 고치기');
  await form.locator('button[type=submit]').click();await page.locator('.class-records .att-message',{hasText:'제105회 성적을 저장했어요'}).waitFor();
  const [fixed]=await fx.sql`select level from engine.synk_learner_topik where learner_id=${A.마루.id}::uuid`;
  check('the second save goes through with the reloaded revision',fixed.level===3,fixed);
  // ── 390 폭 ──
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await fits(390);
  const top=async selector=>{await page.locator(selector).first().evaluate(element=>element.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(100);};
  await top('.class-records');await capture('band-390.png');
  await top(`[data-att-row="${A.마루.id}"]`);await capture('topik-panel-390.png');
  await page.locator('[data-overview-all]').click();await top('.class-summary');await fits(390);await capture('summary-390.png');
  const tiny=await page.evaluate(()=>[...document.querySelectorAll('.class-summary *,.class-records *')].filter(el=>el.getClientRects().length&&el.childElementCount===0&&el.textContent.trim()&&parseFloat(getComputedStyle(el).fontSize)<12).map(el=>el.textContent.trim().slice(0,20)));check('records text stays 12px or larger at 390',tiny.length===0,tiny);
  // 요약의 학생 이름을 누르면 그 반을 열고 그 학생 줄로 간다.
  await page.setViewportSize({width:1440,height:900});await page.locator('.class-summary button',{hasText:'자람 · 합성'}).first().click();await page.locator(`.class-records [data-att-row="${B.자람.id}"].is-focused`).waitFor();
  check('summary name opens class B and focuses that learner row',(await page.locator('.class-records .att-kicker').textContent()).includes('합성 B반')&&await pressed(B.자람.id)==='late');
  await page.locator(`.class-records [data-att-row="${B.자람.id}"]`).scrollIntoViewIfNeeded();await capture('band-focus-1440.png');
  check('browser has no page errors',report.errors.length===0,report.errors);check('browser has no console errors',report.consoleErrors.length===0,report.consoleErrors);check('all assets load',report.assetErrors.length===0,report.assetErrors);check('no failed API or document responses',report.httpErrors.length===0,report.httpErrors);check('no unexpected external requests',report.unexpectedRequests.length===0,report.unexpectedRequests);check('fixture service has no errors',fx.errors.length===0,fx.errors);
  report.ok=true;
}catch(error){report.ok=false;report.failure=error.stack;process.exitCode=1;if(page)try{await capture('failure-viewport.png');report.failureText=(await page.locator('body').innerText()).slice(0,8000);}catch{}}
finally{if(browser)await browser.close();if(company)await company.stop();if(fx)await fx.close();const safe=resolve(dataDir);assert.ok(safe.startsWith(resolve(tmpdir())+sep)&&safe.split(sep).at(-1).startsWith('synk-workspace-records-ui-'));await rm(safe,{recursive:true,force:true});if(previousJobs===undefined)delete process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED;else process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED=previousJobs;await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,passed:report.checks.filter(c=>c.ok).length,total:report.checks.length,failure:report.failure?.split('\n').slice(0,4).join(' | '),out}));}
