import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {emptyStrategyData} from './pulse-strategy.mjs';

const require=createRequire(import.meta.url),intakeSync=require('../../../클라이언트_발주서_20260930/receiver/sync.cjs');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

async function fixture(t){
  const fixtureAt=new Date().toISOString(),clock=()=>fixtureAt;
  const directory=await mkdtemp(join(tmpdir(),'synk-project-news-lifecycle-')),inbox=join(directory,'inbox');
  const app=createCompanyApp({dataDir:directory,clientIntakeDir:inbox,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,clock});
  t.after(async()=>{await app.stop();const target=resolve(directory);assert.equal(dirname(target),resolve(tmpdir()));assert.ok(target.startsWith(join(resolve(tmpdir()),'synk-project-news-lifecycle-')));await rm(target,{recursive:true,force:true});});
  const address=await app.start(),base='http://127.0.0.1:'+address.port,users={},tokens={};
  for(const [name,role,teamId]of [['admin','admin',null],['owner','member','a'],['reviewer','member','a']]){users[name]=app.store.createUser({name,email:name+'@lifecycle.example',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'lifecycle-csrf'},60);}
  async function request(path,{body,user='owner',customer,raw=false,headers={}}={}){
    assert.ok(path.startsWith('/')&&!path.startsWith('//'),'the integration test only requests its loopback server');
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(customer?{Cookie:customer.cookie}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'Content-Type':raw?'image/png':'application/json',...(customer?{'X-Pulse-CSRF':customer.csrf}:{'X-CSRF-Token':'lifecycle-csrf'})}),...headers},...(body===undefined?{}:{body:raw?body:JSON.stringify(body)})});
    const bytes=Buffer.from(await response.arrayBuffer());return {status:response.status,headers:response.headers,bytes,data:response.headers.get('content-type')?.startsWith('application/json')&&bytes.length?JSON.parse(bytes):null};
  }
  async function ok(path,options,status=200){const result=await request(path,options);assert.equal(result.status,status,JSON.stringify(result.data));return result;}
  const receiptId='p_'+'7'.repeat(32),folder=join(inbox,receiptId),originals=new Map(),artifacts=[];
  await mkdir(folder,{recursive:true});
  for(const name of intakeSync.ARTIFACTS){const bytes=Buffer.from(name==='03_제작검토_전달서.json'?JSON.stringify({schema:'synk-production-handoff',submissionId:receiptId,clientProvided:{subject:'합성 소식 연계 완주',contact:'합성 고객',responseContact:'synthetic@example.test',message:'고객 요청과 소식 확인 분리 검증',deadline:'2026-11-10'}}):'SYNTHETIC ORIGINAL '+name);await writeFile(join(folder,name),bytes);originals.set(name,bytes);artifacts.push({name,path:name,size:bytes.length,sha256:digest(bytes)});}
  await writeFile(join(folder,'AGENT_NOTES.md'),intakeSync.AGENT_NOTES);await writeFile(join(folder,'manifest.json'),JSON.stringify({schema:'synk-intake-local-import',submission_id:receiptId,received_at:'2026-10-12T00:00:00.000Z',download_verified:true,artifacts,files:[]}));
  const imported=await ok('/api/client-intake/import',{user:'admin',body:{receiptId}},201),id=imported.data.project.id,path='/api/client-projects/'+id,raw=()=>app.store.get('clientProjects',id);
  async function project(){return (await ok('/api/client-projects')).data.projects.find(row=>row.id===id);}
  async function save(extra={},user='owner'){const row=raw();return ok(path,{user,body:{revision:row.revision,title:row.title,customerName:row.customerName,ownerId:row.ownerId,reviewerId:row.reviewerId,summary:row.summary,terms:row.terms,internalNotes:row.internalNotes,dueDate:row.dueDate,stage:row.stage,...extra}});}
  async function unchangedRead(type,user='owner'){
    const before=structuredClone(raw()),workBefore=(await ok('/api/client-workflow',{user})).data,readsBefore=app.store.all('clientNotificationReads');
    const first=(await ok(path+'/news',{user})).data,again=(await ok(path+'/news',{user})).data;
    assert.deepEqual(again,first);assert.deepEqual(raw(),before,'listing news must not change source project');assert.deepEqual(app.store.all('clientNotificationReads'),readsBefore,'listing news is not a read receipt');
    const item=first.items.find(row=>row.type===type);assert.ok(item,'expected unread '+type+' for '+user);assert.equal(item.projectId,id);assert.equal(item.unread,true);
    const read=(await ok(path+'/news/read',{user,body:{id:item.id}})).data;
    assert.equal(read.unreadCount,first.unreadCount-1);assert.ok(!read.items.some(row=>row.id===item.id));assert.deepEqual(raw(),before,'acknowledging news must not approve, resolve, deliver or close source work');
    assert.deepEqual((await ok('/api/client-workflow',{user})).data,workBefore,'acknowledging news must preserve current work');
    const savedReads=app.store.all('clientNotificationReads');assert.equal(savedReads.length,readsBefore.length+1);assert.ok(savedReads.some(row=>row.userId===users[user].id&&row.eventId===item.id&&row.readAt));
    const live=(await ok('/api/pulse-live',{user})).data.notifications.find(row=>row.id===item.id);assert.ok(live?.readAt,'PULSE must share the personal read record');
    await ok(path+'/news/read',{user,body:{id:item.id}});assert.deepEqual(app.store.all('clientNotificationReads'),savedReads,'repeat acknowledgement is idempotent');
    return item;
  }
  async function upload(kind,label,guide=''){
    const response=await ok(path+'/media',{body:png,raw:true,headers:{'X-File-Name':encodeURIComponent(label+'.png'),'X-Version-Label':encodeURIComponent(label),'X-Version-Kind':kind,'X-Version-Guide':encodeURIComponent(guide),'X-Project-Revision':String(raw().revision)}},201);
    return response.data.project.versions.at(-1);
  }
  return {directory,folder,originals,app,users,id,path,raw,request,ok,project,save,unchangedRead,upload};
}

test('one isolated customer project completes intake, kickoff, revision, approval, delivery and closeout while news reads never complete work',async t=>{
  const f=await fixture(t);assert.equal(f.raw().stage,'received');assert.equal(f.raw().intake.source,'verified-local-intake');
  await f.save({ownerId:f.users.owner.id,reviewerId:f.users.reviewer.id,dueDate:'2026-11-10',terms:'표지 이미지 한 장과 수정 한 차례',internalNotes:'PRIVATE-LIFECYCLE-NOTE'},'admin');
  await f.unchangedRead('assigned');

  const preview=(await f.ok(f.path+'/startup',{body:{action:'preview',revision:f.raw().revision,presetId:'short_ad',referenceDate:'2026-10-12',calendar:'weekdays'}})).data;
  preview.draft.kickoff.requirements=[{label:'확정 화면 문구',required:true}];
  await f.ok(f.path+'/startup',{body:{action:'apply',revision:preview.revision,presetId:preview.presetId,referenceDate:preview.referenceDate,calendar:preview.calendar,sections:['kickoff','schedule'],draft:{kickoff:preview.draft.kickoff,schedule:preview.draft.schedule}}});
  assert.equal((await f.project()).kickoff.enabled,true);assert.equal((await f.project()).schedule.enabled,true);
  await f.save({stage:'planning'});
  const strategy={...emptyStrategyData(),objective:'brand',product:'합성 제품',audience:'합성 대상',primaryPromise:'핵심 약속',evidence1:'직접 확인할 수 있는 장면',memoryHook:'기억할 표지',desiredAction:'직접 확인',value1:'이해',value2:'재미',channels:['youtube'],screenCopy:'확정 화면 문구'};
  await f.ok(f.path+'/studio',{body:{action:'save_strategy',revision:f.raw().revision,strategy}});
  await f.ok(f.path+'/studio',{body:{action:'request_strategy_review',revision:f.raw().revision}});
  const invitation=(await f.ok(f.path+'/invite',{body:{revision:f.raw().revision}})).data;
  const opened=await f.ok('/pulse/api/open',{user:null,body:{invite:invitation.invite}}),customer={cookie:opened.headers.get('set-cookie').split(';')[0],csrf:opened.data.csrf};
  await f.ok('/pulse/api/studio',{customer,body:{action:'confirm_strategy',revision:f.raw().revision,strategyRevision:f.raw().studio.strategy.revision}});
  const confirmation=await f.unchangedRead('customer_strategy_confirmed');assert.ok(confirmation.href.includes('/pulse-app/?mode=staff'));
  let requirement=(await f.project()).kickoff.requirements[0];
  await f.ok('/pulse/api/action',{customer,body:{action:'submit_kickoff_source',revision:f.raw().revision,requirementId:requirement.id,sourceKey:'strategy:screenCopy'}});
  requirement=(await f.project()).kickoff.requirements[0];assert.equal(requirement.status,'received');
  await f.ok(f.path+'/kickoff',{body:{action:'review',revision:f.raw().revision,requirementId:requirement.id,sourceFingerprint:requirement.sourceFingerprint,confirmed:true}});
  assert.equal((await f.project()).kickoff.status,'ready');await f.save({stage:'producing'});

  const first=await f.upload('preview','첫 시안');assert.equal(f.raw().stage,'review');
  await f.ok('/pulse/api/action',{customer,body:{action:'feedback',revision:f.raw().revision,versionId:first.id,text:'표지 자막을 수정해 주세요.',seconds:0}});
  const feedback=f.raw().messages.findLast(row=>row.action==='feedback'),notice=await f.unchangedRead('customer_feedback');
  assert.equal(notice.messageId,feedback.id);assert.equal(f.raw().messages.find(row=>row.id===feedback.id).resolved,false);
  await f.ok('/api/client-workflow',{body:{projectId:f.id,messageId:feedback.id,revision:f.raw().revision,action:'start'}});
  const second=await f.upload('preview','수정 시안');
  await f.ok('/api/client-workflow',{body:{projectId:f.id,messageId:feedback.id,revision:f.raw().revision,action:'submit_review',versionId:second.id}});
  await f.unchangedRead('review_requested','reviewer');assert.equal(f.raw().messages.find(row=>row.id===feedback.id).workflow.status,'review');
  await f.ok('/api/client-workflow',{user:'reviewer',body:{projectId:f.id,messageId:feedback.id,revision:f.raw().revision,action:'accept'}});
  await f.unchangedRead('review_accepted');assert.equal(f.raw().messages.find(row=>row.id===feedback.id).workflow.status,'waiting_customer');assert.equal(f.raw().versions.at(-1).approvedAt,null);
  await f.ok('/pulse/api/action',{customer,body:{action:'approve',revision:f.raw().revision,versionId:second.id}});
  await f.unchangedRead('customer_approval');assert.equal(f.raw().messages.find(row=>row.id===feedback.id).resolved,true);assert.ok(f.raw().versions.at(-1).approvedAt);
  const reviewerApproval=(await f.ok(f.path+'/news',{user:'reviewer'})).data.items.find(row=>row.type==='customer_approval');assert.ok(reviewerApproval?.unread,'owner acknowledgement does not mark reviewer news read');

  const final=await f.upload('final','최종 표지','PNG 표지 이미지로 사용하세요.');assert.equal(f.raw().stage,'delivered');
  const beforeDownload=structuredClone(f.raw()),download=await f.ok('/pulse/api/media/'+final.media.id,{customer});assert.deepEqual(download.bytes,png);assert.deepEqual(f.raw(),beforeDownload);assert.equal((await f.project()).closeout.receipt,null);
  const customerProject=(await f.ok('/pulse/api/project',{customer})).data.project;
  await f.ok('/pulse/api/action',{customer,body:{action:'confirm_delivery',revision:customerProject.revision,deliveryKey:customerProject.closeout.deliveryKey,confirmed:true}});
  const receipt=await f.unchangedRead('customer_delivery_receipt');assert.ok(receipt.href.includes('closeout=1'));
  let project=await f.project();assert.equal(project.closeout.status,'ready');assert.equal(project.closeout.closure,null,'news acknowledgement is not project closure');
  const closed=await f.ok(f.path+'/closeout',{body:{action:'close',revision:project.revision,deliveryKey:project.closeout.deliveryKey,confirmed:true}});assert.equal(closed.data.project.closeout.status,'closed');
  project=(await f.ok('/pulse/api/project',{customer})).data.project;assert.ok(project.closeout.receipt.confirmedAt);assert.doesNotMatch(JSON.stringify(project),/PRIVATE-LIFECYCLE|clientNotificationReads|notificationEvents/);
  assert.deepEqual((await f.ok('/pulse/api/media/'+final.media.id,{customer})).bytes,png);
  for(const version of f.raw().versions)assert.equal(digest(await readFile(join(f.directory,'studio-media',version.media.diskName))),digest(png),'every original preview and final keeps its bytes');
  for(const [name,bytes]of f.originals)assert.deepEqual(await readFile(join(f.folder,name)),bytes,'original intake preserved: '+name);
  assert.equal(f.raw().intake.files.length,intakeSync.ARTIFACTS.length);
  for(const item of f.raw().intake.files){const result=await f.ok(f.path+'/intake-files/'+item.id);assert.deepEqual(result.bytes,f.originals.get(item.fileName),'imported original download stays exact');}
});
