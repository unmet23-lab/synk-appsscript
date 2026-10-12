import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {backupWorkspace} from './workspace-backup.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=','base64');
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-closeout-http-'));
  let app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false}),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const users={},tokens={};
  for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['other','member','b'],['viewer','viewer','a'],['manager','manager','a']]){users[name]=app.store.createUser({name,email:name+'@closeout.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'test-csrf'},60);}
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-closeout-http-')));await rm(directory,{recursive:true,force:true});});
  async function request(path,{body,user='owner',customer,headers={},method=body===undefined?'GET':'POST'}={}){
    const response=await fetch(base+path,{method,headers:{...(customer?{Cookie:'synk_pulse_session='+customer.session}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'X-CSRF-Token':'test-csrf',...(customer?{'X-Pulse-CSRF':customer.csrf}:{}),'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const bytes=Buffer.from(await response.arrayBuffer());return {status:response.status,bytes,text:bytes.toString(),data:response.headers.get('content-type')?.startsWith('application/json')&&bytes.length?JSON.parse(bytes):null};
  }
  let row=app.clientProjects.save(users.owner,{title:'합성 수령·마감 검증',customerName:'합성 고객',reviewerId:users.reviewer.id,internalNotes:'PRIVATE-CLOSEOUT-NOTES',contact:'PRIVATE-CLOSEOUT-CONTACT'}).project;
  row=app.clientProjects.addVersion(users.owner,row.id,{revision:row.revision,kind:'preview',label:'승인 시안',url:'https://example.test/approved.mp4'}).project;
  const invite=app.clientProjects.invite(users.owner,row.id,{revision:row.revision}),customer=app.clientProjects.open(invite.invite);
  app.clientProjects.customerAction(customer.session,customer.csrf,{revision:customer.project.revision,action:'approve',versionId:customer.project.versions.at(-1).id});
  const mediaId=randomUUID(),media={id:mediaId,diskName:mediaId+'.png',fileName:'최종 표지.png',mimeType:'image/png',byteSize:png.length,sha256:createHash('sha256').update(png).digest('hex')};
  await mkdir(join(directory,'studio-media'));await writeFile(join(directory,'studio-media',media.diskName),png);
  row=app.clientProjects.project(users.owner,row.id);
  row=app.clientProjects.addVersion(users.owner,row.id,{revision:row.revision,kind:'final',label:'최종 표지',guide:'표지 이미지 사용 안내입니다.'},media).project;
  const id=row.id,path='/api/client-projects/'+id+'/closeout';
  const current=()=>app.clientProjects.project(users.owner,id);
  async function staff(){const result=await request('/api/client-projects');assert.equal(result.status,200,result.text);const project=result.data.projects.find(project=>project.id===id);assert.ok(project.closeout,'Staff project must include the closeout projection');return project;}
  const mutate=(project,input,options={})=>request(path,{body:{revision:project.revision,deliveryKey:project.closeout.deliveryKey,...input},...options});
  async function confirm(input={},options={}){const response=await request('/pulse/api/project',{customer});if(response.status!==200)return response;const project=response.data.project;return request('/pulse/api/action',{customer,body:{action:'confirm_delivery',revision:project.revision,deliveryKey:project.closeout.deliveryKey,confirmed:true,...input},...options});}
  async function restart(dataDir=directory){await app.stop();app=createCompanyApp({dataDir,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false});address=await app.start();base='http://127.0.0.1:'+address.port;}
  return {directory,users,tokens,customer,id,path,media,request,current,staff,mutate,confirm,restart,get app(){return app;}};
}

test('closeout changes require current staff permission, company origin and CSRF',async t=>{
  const f=await fixture(t),project=await f.staff(),input={action:'set_reminder',remindAfterDays:5};
  assert.equal((await f.mutate(project,input,{user:null})).status,403);
  assert.equal((await f.mutate(project,input,{customer:f.customer})).status,403);
  assert.equal((await f.mutate(project,input,{user:'other'})).status,404);
  for(const user of ['reviewer','viewer'])assert.equal((await f.mutate(project,input,{user})).status,403,user);
  for(const headers of [{Origin:'https://evil.test'},{'X-CSRF-Token':'bad'}])assert.equal((await f.mutate(project,input,{headers})).status,403);
  const saved=await f.mutate(project,input,{user:'manager'});assert.equal(saved.status,200,saved.text);assert.equal(saved.data.project.closeout.remindAfterDays,5);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});
  assert.equal((await f.mutate(saved.data.project,{action:'set_reminder',remindAfterDays:3})).status,403);
});

test('viewing and downloading never confirm receipt; only the authenticated customer can confirm the current bundle',async t=>{
  const f=await fixture(t),before=await f.staff();assert.equal(before.closeout.status,'waiting_receipt');assert.equal(before.closeout.receipt,null);
  const view=await f.request('/pulse/api/project',{customer:f.customer}),download=await f.request('/pulse/api/media/'+f.media.id,{customer:f.customer});assert.equal(view.status,200);assert.equal(download.status,200);assert.deepEqual(download.bytes,png);assert.equal((await f.staff()).closeout.receipt,null);
  assert.equal((await f.mutate(before,{action:'confirm_delivery',confirmed:true})).status,400);
  assert.equal((await f.request('/pulse/api/action',{body:{action:'confirm_delivery',revision:before.revision,deliveryKey:before.closeout.deliveryKey,confirmed:true}})).status,401);
  assert.equal((await f.confirm({confirmed:false})).status,400);
  assert.equal((await f.confirm({}, {headers:{'X-Pulse-CSRF':'bad'}})).status,403);
  assert.equal((await f.confirm({}, {headers:{Origin:'https://evil.test'}})).status,403);
  assert.equal((await f.confirm({deliveryKey:'stale-bundle'})).status,409);
  const result=await f.confirm();assert.equal(result.status,200,result.text);assert.ok(result.data.project.closeout.receipt.confirmedAt);assert.equal(result.data.project.closeout.canConfirm,false);
  assert.equal((await f.confirm()).status,409);assert.equal((await f.staff()).closeout.status,'ready');
});

test('customer receipt notifies the owner and reviewer once and never exposes internal closeout material',async t=>{
  const f=await fixture(t);let project=await f.staff();project=(await f.mutate(project,{action:'set_reminder',remindAfterDays:9})).data.project;
  const result=await f.confirm();assert.equal(result.status,200,result.text);
  for(const user of ['owner','reviewer']){const state=await f.request('/api/pulse-live',{user}),notices=state.data.notifications.filter(value=>value.type==='customer_delivery_receipt');assert.equal(notices.length,1,user);assert.equal(notices[0].projectId,f.id);assert.equal(notices[0].tab,'history');}
  assert.equal((await f.request('/api/pulse-live',{user:'other'})).data.notifications.some(value=>value.type==='customer_delivery_receipt'),false);
  const customer=await f.request('/pulse/api/project',{customer:f.customer});assert.doesNotMatch(customer.text,/PRIVATE-CLOSEOUT|summaryText|requestText|remindAfterDays|pendingRequests|lastClosure|internalNotes|nextContactDate|followUpHistory/);assert.ok(customer.data.project.closeout.receipt.confirmedAt);
  assert.equal((await f.confirm()).status,409);assert.equal((await f.request('/api/pulse-live')).data.notifications.filter(value=>value.type==='customer_delivery_receipt').length,1);
});

test('closure is explicit and retains the customer session, delivered files, invite and original records',async t=>{
  const f=await fixture(t);let project=await f.staff();assert.equal((await f.mutate(project,{action:'close',confirmed:true})).status,409);
  assert.equal((await f.confirm()).status,200);project=await f.staff();assert.equal(project.closeout.canClose,true);
  assert.equal((await f.mutate(project,{action:'close',confirmed:false})).status,400);
  const before=structuredClone(f.current()),result=await f.mutate(project,{action:'close',confirmed:true});assert.equal(result.status,200,result.text);assert.equal(result.data.project.closeout.status,'closed');assert.ok(result.data.project.closeout.closure);assert.equal(result.data.project.stage,'delivered');
  const after=f.current();assert.equal(after.inviteHash,before.inviteHash);assert.equal(after.inviteRevision,before.inviteRevision);assert.deepEqual(after.versions,before.versions);assert.deepEqual(after.messages,before.messages);
  const customer=await f.request('/pulse/api/project',{customer:f.customer});assert.equal(customer.status,200);assert.deepEqual((await f.request('/pulse/api/media/'+f.media.id,{customer:f.customer})).bytes,png);assert.doesNotMatch(customer.text,/PRIVATE-CLOSEOUT|summaryText|requestText|lastClosure/);
  assert.equal((await f.mutate(result.data.project,{action:'close',confirmed:true})).status,409);
});

test('new final files and a new preview cannot inherit receipt or closure from an older delivery',async t=>{
  const f=await fixture(t);assert.equal((await f.confirm()).status,200);let project=await f.staff();project=(await f.mutate(project,{action:'close',confirmed:true})).data.project;
  const oldKey=project.closeout.deliveryKey,oldReceipt=project.closeout.receipt;
  f.app.clientProjects.addVersion(f.users.owner,f.id,{revision:project.revision,kind:'final',label:'추가 자막',guide:'추가 파일 사용 안내',url:'https://example.test/final.srt'});
  let fresh=await f.staff();assert.notEqual(fresh.closeout.deliveryKey,oldKey);assert.equal(fresh.closeout.receipt,null);assert.equal(fresh.closeout.closure,null);assert.ok(fresh.closeout.lastClosure);assert.equal((await f.confirm({deliveryKey:oldKey})).status,409);assert.equal((await f.mutate(project,{action:'close',confirmed:true})).status,409);
  assert.equal((await f.confirm()).status,200);fresh=await f.staff();assert.ok(fresh.closeout.receipt.confirmedAt);assert.ok(oldReceipt.confirmedAt);
  f.app.clientProjects.addVersion(f.users.owner,f.id,{revision:fresh.revision,kind:'preview',label:'새 검토 시안',url:'https://example.test/new.mp4'});
  fresh=await f.staff();assert.equal(fresh.closeout.status,'no_delivery');assert.equal(fresh.closeout.receipt,null);assert.equal(fresh.closeout.closure,null);assert.equal((await f.confirm()).status,409);
});

test('a later customer question reopens the closeout checks and closure waits for resolution',async t=>{
  const f=await fixture(t);assert.equal((await f.confirm()).status,200);let project=await f.staff();project=(await f.mutate(project,{action:'close',confirmed:true})).data.project;
  let result=await f.request('/pulse/api/action',{customer:f.customer,body:{action:'support',revision:project.revision,text:'이 파일은 세로 화면에 사용해도 되나요?'}});assert.equal(result.status,200,result.text);
  project=await f.staff();assert.equal(project.closeout.status,'follow_up');assert.equal(project.closeout.pendingRequests,1);assert.equal(project.closeout.closure,null);assert.ok(project.closeout.lastClosure);assert.equal(project.closeout.canClose,false);assert.equal((await f.mutate(project,{action:'close',confirmed:true})).status,409);
  const question=f.current().messages.findLast(message=>message.action==='support');f.app.clientProjects.resolveMessage(f.users.owner,f.id,question.id,{revision:project.revision});project=await f.staff();assert.equal(project.closeout.pendingRequests,0);assert.equal(project.closeout.canClose,true);assert.equal(project.closeout.closure,null);assert.equal((await f.mutate(project,{action:'close',confirmed:true})).status,200);
});

test('reminder input and stale revisions are checked without manufacturing receipt or customer messages',async t=>{
  const f=await fixture(t);let project=await f.staff();const before=structuredClone(f.current());
  for(const remindAfterDays of [-1,31,1.5,'3',null])assert.equal((await f.mutate(project,{action:'set_reminder',remindAfterDays})).status,400,String(remindAfterDays));
  const saved=await f.mutate(project,{action:'set_reminder',remindAfterDays:0});assert.equal(saved.status,200,saved.text);assert.equal(saved.data.project.closeout.remindAfterDays,0);assert.equal(saved.data.project.closeout.overdue,false);
  assert.equal((await f.mutate(project,{action:'set_reminder',remindAfterDays:3})).status,409);project=await f.staff();assert.equal(project.closeout.receipt,null);assert.deepEqual(f.current().messages,before.messages);assert.deepEqual(f.current().notificationEvents,before.notificationEvents);
  f.app.clientProjects.revoke(f.users.owner,f.id,{revision:project.revision});assert.equal((await f.confirm()).status,401);
});

test('receipt and closure survive server restart and a complete workspace backup while customer files remain accessible',async t=>{
  const f=await fixture(t);assert.equal((await f.confirm()).status,200);let project=await f.staff();project=(await f.mutate(project,{action:'set_reminder',remindAfterDays:7})).data.project;project=(await f.mutate(project,{action:'close',confirmed:true})).data.project;
  const before=structuredClone(project.closeout);await f.restart();assert.deepEqual((await f.staff()).closeout,before);assert.equal((await f.request('/pulse/api/project',{customer:f.customer})).status,200);
  const backupRoot=await mkdtemp(join(tmpdir(),'synk-closeout-backup-'));t.after(async()=>{assert.equal(dirname(resolve(backupRoot)),resolve(tmpdir()));await rm(backupRoot,{recursive:true,force:true});});
  await f.app.stop();const baseline=await backupWorkspace({destination:backupRoot,companyDataDir:f.directory,messengerDataDir:join(f.directory,'messenger')});assert.equal((await readFile(join(baseline,'COMPLETE'),'utf8')).length>0,true);assert.deepEqual(await readFile(join(baseline,'company','studio-media',f.media.diskName)),png);
  await f.restart(join(baseline,'company'));assert.deepEqual((await f.staff()).closeout,before);assert.deepEqual((await f.request('/pulse/api/media/'+f.media.id,{customer:f.customer})).bytes,png);
});
