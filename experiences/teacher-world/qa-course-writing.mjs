import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
// Real teacher shell and shared student component, generated classroom runtime, synthetic PGlite identities only.
// Run from either checkout: node experiences/teacher-world/qa-course-writing.mjs. Full WORLD shell is checked separately.
const root=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(import.meta.url),talk=resolve(root,'../SYNK-talk'),out=resolve(process.env.SYNK_COURSE_QA_OUT||resolve(root,'.tmp/qa-course-writing-'+Date.now()));
mkdirSync(out,{recursive:true});
const {createFixture,chromium}=require(talk+'/tools/qa-synk-classroom-fixture.cjs');
const report={at:new Date().toISOString(),synthetic:true,production:false,runtime:'generated',checks:[],errors:[],requests:[]};
let fx,browser;
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);console.log('PASS '+name);writeFileSync(out+'/browser-progress.json',JSON.stringify(report,null,2));};
try{
 fx=await createFixture();const account=await fx.api('learner','/api/student');
 await fx.api('learner','/api/world/sharing',{enabled:true,revision:account.sharing.revision});
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 context.on('page',p=>{p.on('pageerror',e=>report.errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/functions/'))report.requests.push({method:r.method(),path:new URL(r.url()).pathname});});});
 const teacher=await context.newPage(),student=await context.newPage();
 const apiScript=role=>`const call=async(path,body)=>{const u=new URL('/functions/v1/synk-classroom'+path,location.origin);u.searchParams.set('classId',${JSON.stringify(fx.cls.class_id)});const r=await fetch(u,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer synthetic-${role}','X-SYNK-Product':'world','X-SYNK-Contract':'1','X-SYNK-App-Version':'1.0.0',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error?.message||data.code),{code:data.error?.code||data.code,status:r.status});return data;};`;
 await teacher.route('**/fixture/course-teacher',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><meta charset="utf-8"><script>${apiScript('teacher')}window.SYNKClassroomHost={mode:'account-linked',classId:${JSON.stringify(fx.cls.class_id)},request:call};</script><iframe title="교사 수업" style="border:0;width:100%;height:96vh" src="/teacher-world/?account=1"></iframe></html>`}));
 await student.route('**/fixture/course-student',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/teacher-world/style.css"><link rel="stylesheet" href="/teacher-world/signal.css"><main id="course" style="max-width:760px;margin:32px auto;padding:24px"></main><script type="module">import {mountCourseWriting} from '/teacher-world/course-writing-ui.mjs';${apiScript('learner')}window.course=mountCourseWriting({root:document.getElementById('course'),request:call});await course.reload();</script></html>`}));
 await teacher.goto(fx.base+'/fixture/course-teacher',{waitUntil:'domcontentloaded'});await teacher.bringToFront();const frame=teacher.frameLocator('iframe');
 await frame.locator('[data-view=writing]').waitFor({state:'visible'});await frame.locator('[data-view=writing]').click({force:true});await frame.locator('[data-course-assign]').waitFor();
 await frame.locator('[data-course-assign] select').selectOption('1');
 const tomorrow=new Date(Date.now()+86400000);const due=tomorrow.toISOString().slice(0,16);
 await frame.locator('[data-course-assign] input').fill(due);await frame.locator('[data-course-assign] button').click();
 await frame.locator('.course-task').waitFor();check('teacher creates week and deadline through actual teacher shell',await frame.locator('.course-task').count()===1);
 await student.goto(fx.base+'/fixture/course-student',{waitUntil:'domcontentloaded'});await student.locator('[data-course-submit]').waitFor();
 const before=await fx.api('learner','/api/course');check('student receives five questions without answer keys',before.tasks[0].material.reading.length===5&&!JSON.stringify(before).includes('"answer"'));
 for(const field of await student.locator('[data-course-submit] fieldset').all())await field.locator('input[value="1"]').check();
 await student.locator('textarea[name=text]').fill('합성 학습자가 스스로 쓴 첫 문장입니다.');
 await student.locator('[data-course-submit] button').click();await student.getByText('선생님의 첨삭을 기다리고 있어요.').waitFor();
 check('first submission is persisted once with reading results',(await fx.state()).learnerState[fx.users.learner.id].courseWriting[0].versions.length===1);
 await frame.locator('#view-writing > button').click();
 const details=frame.locator('#view-writing details').filter({has:frame.locator('[data-course-feedback]')});await details.locator('summary').first().click();
 const form=frame.locator('[data-course-feedback]');
 await form.locator('[name=good]').fill('글의 뜻을 정확히 적었어요.');
 await form.locator('[name=focus]').fill('문체를 한 가지로 맞춰요.');
 await form.locator('[name=retry]').fill('문장 끝을 -다로 바꿔 보세요.');
 await form.locator('[name=tag][value=체]').check();await form.locator('[name=minutes]').fill('4');
 const courseReadUrl='**/functions/v1/synk-classroom/api/course?*';
 await teacher.route(courseReadUrl,r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"TEMPORARY_FAILURE"}}'}));
 await form.locator('button').click();await frame.getByText(/저장은 확인했지만 최신 과제를 불러오지 못했어요/).waitFor();
 check('acknowledged save and failed reload have distinct truthful status',(await fx.state()).learnerState[fx.users.learner.id].courseWriting[0].versions[0].feedback.length===1);
 await teacher.unroute(courseReadUrl);await frame.locator('#view-writing > button').click();await frame.locator('[data-course-feedback]').waitFor({state:'attached'});
 await student.locator('#course > button').click();await student.locator('[name=reflection]').waitFor();
 check('student sees teacher feedback',await student.getByText('문체를 한 가지로 맞춰요.',{exact:false}).count()>0);
 await student.locator('textarea[name=text]').fill('합성 학습자가 스스로 고쳐 쓴 문장이다.');
 await student.locator('[name=reflection]').fill('선생님이 알려 준 문체를 생각해서 문장 끝을 고쳤다.');
 let releaseSubmit;const submitGate=new Promise(r=>releaseSubmit=r);const submitUrl='**/functions/v1/synk-classroom/api/course/submit?*';
 await student.route(submitUrl,async r=>{await submitGate;await r.continue();});
 await student.locator('[data-course-submit] button').click();await student.getByText('서버에 저장을 확인하고 있어요.').waitFor();
 await student.locator('[data-course-group]').click();
 check('busy group consent control reverts to confirmed server value',!await student.locator('[data-course-group]').isChecked()&&!report.requests.some(r=>r.path.endsWith('/course/group-sharing')));
 releaseSubmit();await student.getByText('선생님의 첨삭을 기다리고 있어요.').waitFor();await student.unroute(submitUrl);
 const saved=(await fx.state()).learnerState[fx.users.learner.id].courseWriting[0];
 check('revision preserves original and correction history',saved.versions.length===2&&saved.versions[0].text==='합성 학습자가 스스로 쓴 첫 문장입니다.'&&saved.versions[0].feedback.length===1&&saved.versions[1].reflection.includes('문체'));
 await student.screenshot({path:out+'/student-revision.png',fullPage:true});
 await frame.locator('#view-writing > button').click();await teacher.screenshot({path:out+'/teacher-revision.png',fullPage:true});
 await student.setViewportSize({width:390,height:844});check('student form fits mobile viewport',await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Exercise separate group-consent withdrawal through the actual teacher poll.
 const {createPgStore}=require(talk+'/lib/synk-store.js'),{randomUUID}=require('node:crypto');
 const ownCourse=await fx.api('learner','/api/course'),task=ownCourse.tasks[0];
 await fx.api('learner','/api/course/group-sharing',{taskId:task.id,sharingRevision:ownCourse.sharing.revision,baseConsentRevision:1,enabled:true});
 for(let i=0;i<4;i++){
  const role='extra'+i,identity={id:randomUUID(),sessionId:randomUUID(),issuedAt:Math.floor(Date.now()/1000)-1,providers:['synthetic']};
  await fx.sql`insert into auth.users values(${identity.id}::uuid)`;
  const [row]=await fx.sql`insert into engine.learners(auth_user_id,student_code,class_id) values(${identity.id}::uuid,${'집계 검증 '+i},${fx.cls.class_id}::uuid) returning learner_id`;
  await createPgStore(fx.sql).withAccount(identity,'world',async tx=>{await tx.setLearning(true);});
  fx.users[role]={identity,id:row.learner_id};
  const current=await fx.api(role,'/api/student');await fx.api(role,'/api/world/sharing',{enabled:true,revision:current.sharing.revision});
  const ready=await fx.api(role,'/api/course'),sharingRevision=ready.sharing.revision;
  await fx.api(role,'/api/course/submit',{taskId:task.id,sharingRevision,baseVersion:0,text:'집계용 별도 합성 원고입니다.',reflection:'',reading:Object.fromEntries(task.material.reading.map(q=>[q.id,1])),idempotencyKey:'aggregate-first-'+i});
  await fx.api('teacher','/api/course/feedback',{taskId:task.id,learnerId:row.learner_id,sharingRevision,version:1,baseFeedback:0,good:'뜻이 보여요.',focus:'문체를 맞춰요.',retry:'끝을 고쳐요.',tags:['체'],rubric:{content:1,structure:1,language:1},minutes:2,idempotencyKey:'aggregate-feedback-'+i});
  await fx.api(role,'/api/course/group-sharing',{taskId:task.id,sharingRevision,baseConsentRevision:1,enabled:true});
 }
 await teacher.bringToFront();await frame.locator('#refresh').click();await frame.locator('[data-course-plan]').waitFor();
 await frame.locator('[data-course-plan]').click();await frame.getByText(/선택한 10분 수업안/).waitFor();
 check('Prism aggregate is consumed by a saved teacher micro-lesson',Boolean((await fx.api('teacher','/api/course')).groups[0].plan));
 const heldForm=frame.locator('[data-course-feedback][data-learner="'+fx.users.learner.id+'"]');
 await heldForm.locator('xpath=..').locator('summary').first().click();await heldForm.locator('[name=good]').fill('보존해야 하는 작성 중인 첨삭');
 const workspaceUrl='**/functions/v1/synk-classroom/api/workspace?*';
 for(const {status,code,minimum} of [{status:503,code:'TEMPORARY_FAILURE',minimum:1},{status:409,code:'CLASSROOM_SNAPSHOT_CHANGED',minimum:2},{status:429,code:'RATE_LIMITED',minimum:1}]){
  let faults=0;await teacher.route(workspaceUrl,r=>{faults++;return r.fulfill({status,contentType:'application/json',body:JSON.stringify({error:{code}})});});
  await frame.getByText(/연결을 확인하는 동안 첨삭 초안을 잠시 숨겼어요/).waitFor({timeout:12000});
  check(status+' workspace failure hides unsent feedback without discarding',faults>=minimum&&!await heldForm.isVisible());
  await teacher.unroute(workspaceUrl);await heldForm.waitFor({state:'visible',timeout:15000});
  check(status+' workspace reconnection restores same feedback draft',await heldForm.locator('[name=good]').inputValue()==='보존해야 하는 작성 중인 첨삭');
 }
 await fx.api('learner','/api/course/group-sharing',{taskId:task.id,sharingRevision:ownCourse.sharing.revision,baseConsentRevision:2,enabled:false});
 await frame.locator('[data-course-plan]').waitFor({state:'detached',timeout:12000});
 await frame.getByText('집계에 따로 동의하고 첫 첨삭이 끝난 학생 다섯 명부터 공통 기호를 보여요. 원문은 집계에 넣지 않아요.').waitFor();
 check('aggregate consent withdrawal clears cached counts and plan via teacher poll',await frame.getByText(/선택한 10분 수업안/).count()===0);
 check('aggregate refresh preserves unsent teacher feedback',await heldForm.locator('[name=good]').inputValue()==='보존해야 하는 작성 중인 첨삭');

 const extra0=await fx.api('extra0','/api/student');await fx.api('extra0','/api/world/sharing',{enabled:false,revision:extra0.sharing.revision});
 const verifiedRoster=(await fx.api('teacher','/api/workspace')).classes[0].learners.map(row=>({id:row.id,revision:row.sharing.revision,enabled:row.sharing.enabled===true,connected:true,revoked:false}));
 const fenced=await frame.locator('body').evaluate((_element,scope)=>({applied:window.SYNKTeacherView.applySharing(scope),removed:!document.querySelector('[data-course-feedback][data-learner="'+scope.withdrawn+'"]')}),{classId:fx.cls.class_id,learners:verifiedRoster,withdrawn:fx.users.extra0.id});
 check('parent sharing fence acknowledges only after revoked course feedback is removed',fenced.applied&&fenced.removed);
 await frame.locator('[data-course-feedback][data-learner="'+fx.users.extra0.id+'"]').waitFor({state:'detached',timeout:12000});
 check('another learner class-sharing withdrawal preserves teacher draft',await heldForm.locator('[name=good]').inputValue()==='보존해야 하는 작성 중인 첨삭');
 const otherForm=frame.locator('[data-course-feedback][data-learner="'+fx.users.extra1.id+'"]');await otherForm.locator('xpath=..').locator('summary').first().click();await otherForm.locator('[name=good]').fill('다른 학생 첨삭 수정');
 const extra1=await fx.api('extra1','/api/course');
 await fx.api('extra1','/api/course/submit',{taskId:task.id,sharingRevision:extra1.sharing.revision,baseVersion:1,text:'새로 제출한 두 번째 합성 원고.',reflection:'새 문체로 수정함',reading:{},idempotencyKey:'extra1-second'});
 await frame.getByText(/이전 1번째 원고에 쓰던 첨삭이에요/).waitFor({timeout:12000});
 check('new student version does not rebind teacher draft',await otherForm.getAttribute('data-version')==='1'&&await otherForm.locator('[name=good]').inputValue()==='다른 학생 첨삭 수정');
 await otherForm.locator('button').click();await frame.getByText('서버에 저장했어요.').waitFor();
 const extra1Saved=(await fx.api('teacher','/api/course')).learners.find(l=>l.id===fx.users.extra1.id).records[0].versions;
 check('old-version feedback is saved only to intended manuscript',extra1Saved[0].feedback.length===2&&extra1Saved[1].feedback.length===0);
 check('saving another feedback preserves unrelated draft',await heldForm.locator('[name=good]').inputValue()==='보존해야 하는 작성 중인 첨삭');
 const uncertain=frame.locator('[data-course-feedback][data-learner="'+fx.users.extra2.id+'"]');await uncertain.locator('xpath=..').locator('summary').first().click();await uncertain.locator('[name=good]').fill('응답이 사라져도 같은 첨삭');
 const feedbackUrl='**/functions/v1/synk-classroom/api/course/feedback?*';await teacher.route(feedbackUrl,async route=>{await route.fetch();await route.abort('failed');});await uncertain.locator('button').click();await frame.getByText(/내용 수정을 잠시 막았어요/).waitFor();
 check('uncertain submission locks edits until idempotent retry',await uncertain.locator('[name=good]').isDisabled());await teacher.unroute(feedbackUrl);await uncertain.locator('button').click();await frame.getByText('서버에 저장했어요.').waitFor();
 check('uncertain retry saves once and preserves unrelated draft', (await fx.api('teacher','/api/course')).learners.find(l=>l.id===fx.users.extra2.id).records[0].versions[0].feedback.length===2&&await heldForm.locator('[name=good]').inputValue()==='보존해야 하는 작성 중인 첨삭');
 await student.locator('#course > button').click();const groupBox=student.locator('[data-course-group]');
 const groupUrl='**/functions/v1/synk-classroom/api/course/group-sharing?*';await student.route(groupUrl,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'TEMPORARY_FAILURE'}})}));await groupBox.click();await student.getByText('서버에 저장된 집계 동의를 다시 표시했어요.').waitFor();
 check('failed aggregate change restores actual unchecked server consent',!await groupBox.isChecked());await student.unroute(groupUrl);
 await student.route(groupUrl,async route=>{await route.fetch();await route.abort('failed');});await groupBox.click();await student.getByText('서버에 저장된 집계 동의를 다시 표시했어요.').waitFor();
 await student.waitForFunction(()=>{const input=document.querySelector('[data-course-group]');return input?.checked&&!input.disabled;});check('lost aggregate response recovers committed server consent',await groupBox.isChecked());await student.unroute(groupUrl);
 for(const status of [403,401]){
  await heldForm.locator('[name=good]').fill('권한 오류 뒤 폐기할 첨삭 '+status);
  await teacher.route(workspaceUrl,r=>r.fulfill({status,contentType:'application/json',body:JSON.stringify({error:{code:status===403?'FORBIDDEN':'AUTH_REQUIRED'}})}));
  await frame.locator('html[data-ready=blocked]').waitFor({timeout:12000});
  check(status+' workspace authorization failure purges unsent feedback',await frame.locator('#view-writing').textContent()===''&&await heldForm.count()===0);
  await teacher.unroute(workspaceUrl);await heldForm.waitFor({state:'attached',timeout:15000});
  await heldForm.locator('xpath=..').locator('summary').first().click();
  check(status+' reauthorization does not restore purged feedback',await heldForm.locator('[name=good]').inputValue()==='');
 }
 const held=await fx.api('learner','/api/student');await fx.api('learner','/api/world/sharing',{enabled:false,revision:held.sharing.revision});
 await frame.locator('#refresh').click();await teacher.waitForTimeout(300);
 check('sharing withdrawal removes cached teacher writing text',!(await frame.locator('#view-writing').textContent()).includes('합성 학습자가'));
 await student.locator('#course > button').click();await student.getByText('계정 설정에서 학습 기록 저장과 이 반 선생님 공유를 켠 뒤 제출할 수 있어요.').waitFor();
 check('sharing withdrawal preserves own originals read-only',(await student.locator('#course').textContent()).includes('합성 학습자가')&&await student.locator('[data-course-submit]').count()===0);
 const off=await fx.api('learner','/api/student');await fx.api('learner','/api/world/sharing',{enabled:true,revision:off.sharing.revision});await student.locator('#course > button').click();await student.locator('[data-course-submit]').waitFor();
 check('share off-on restores old original and feedback as own history',(await student.locator('#course').textContent()).includes('합성 학습자가 스스로 쓴 첫 문장입니다.')&&(await student.locator('#course').textContent()).includes('문체를 한 가지로 맞춰요.'));
 check('no uncaught page errors',report.errors.length===0);check('fixture service no errors',fx.errors.length===0);
}catch(error){report.failure={message:error.message,stack:error.stack,fixtureErrors:fx?.errors,pages:await Promise.all((browser?.contexts()[0]?.pages()||[]).map(async p=>({url:p.url(),frames:await Promise.all(p.frames().map(async f=>({url:f.url(),text:await f.locator("body").innerText().catch(()=>"unavailable")})))})))};throw error;}
finally{writeFileSync(out+'/browser-evidence.json',JSON.stringify(report,null,2));await browser?.close();await fx?.close();}
