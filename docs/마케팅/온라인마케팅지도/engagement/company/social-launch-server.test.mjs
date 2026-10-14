import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-launch-http-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'http://127.0.0.1:4191',schedule:false,synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({email:'launch-admin@example.test',name:'합성 관리자',role:'admin'}),writer=app.store.createUser({email:'launch-writer@example.test',name:'합성 담당자',role:'member',teamId:'a'}),other=app.store.createUser({email:'launch-other@example.test',name:'다른 팀',role:'member',teamId:'b'}),viewer=app.store.createUser({email:'launch-viewer@example.test',name:'열람자',role:'viewer',teamId:'a'});
  app.store.put('channels','ig',{id:'ig',platform:'instagram',displayName:'합성 SNS',active:true,ownerIds:[writer.id],teamId:'a'});
  app.store.put('socialInbox','inquiry',{id:'inquiry',channelId:'ig',text:'자동 복사되면 안 되는 문의 원문',author:'합성 작성자',kind:'comment',revision:1,status:'open',updatedAt:new Date().toISOString()});
  const tokens=new Map([admin,writer,other,viewer].map(u=>[u.id,app.store.mint('session',u.id,{csrfToken:'launch-csrf'},60)]));await app.start();const base='http://127.0.0.1:'+app.server.address().port;
  async function api(user,path,input,headers={}){const r=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'launch-csrf',...(input===undefined?{}:{'Content-Type':'application/json'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:r.status,data:await r.json()};}
  return {app,admin,writer,other,viewer,api};
}
test('HTTP setup exposes unconfigured local evidence and followup uses one real existing task',async t=>{
  const f=await fixture(t),before=await f.api(f.writer,'/api/social/workspace');assert.equal(before.status,200);assert.equal(before.data.onboarding.server.status,'local');assert.equal(before.data.onboarding.channels[0].steps[0].status,'pending');
  const options=await f.api(f.writer,'/api/social/inbox/inquiry/followup');assert.equal(options.status,200);const room=options.data.targets.find(r=>r.assignees.some(a=>a.id===f.writer.id));assert.ok(room);
  const input={revision:1,roomId:room.id,assigneeId:f.writer.id,nextAction:'확인한 수업 안내를 정리하기',dueDate:'2026-10-20'};
  assert.equal((await f.api(f.writer,'/api/social/inbox/inquiry/followup',input,{'X-CSRF-Token':'invalid'})).status,403);
  const [a,b]=await Promise.all([f.api(f.writer,'/api/social/inbox/inquiry/followup',input),f.api(f.writer,'/api/social/inbox/inquiry/followup',input)]);assert.equal(a.status,200,JSON.stringify(a.data));assert.equal(b.status,200);assert.equal(a.data.followup.taskId,b.data.followup.taskId);
  const messages=f.app.messenger.db.prepare('SELECT body FROM messages WHERE id=?').all(a.data.followup.messageId);assert.equal(messages.length,1);assert.match(messages[0].body,/확인한 수업/);assert.match(messages[0].body,/inboxId=inquiry/);assert.ok(!messages[0].body.includes('자동 복사되면 안 되는 문의 원문'));assert.ok(!messages[0].body.includes('합성 작성자'));
  assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM message_tasks').get().n,1);
  const after=await f.api(f.writer,'/api/social/workspace');assert.equal(after.data.followups.items[0].followup.assigneeId,f.writer.id);assert.equal(after.data.followups.items[0].followup.dueDate,input.dueDate);
  assert.equal((await f.api(f.writer,'/api/social/inbox/inquiry/followup',{...input,nextAction:'다른 업무'})).status,409);
});
test('HTTP source and current write permissions bound followup requests and listing',async t=>{
  const f=await fixture(t);assert.equal((await f.api(f.other,'/api/social/inbox/inquiry/followup')).status,404);
  const visible=await f.api(f.other,'/api/social/workspace');assert.deepEqual(visible.data.followups.items,[]);assert.deepEqual(visible.data.onboarding.channels,[]);
  const o=await f.api(f.admin,'/api/social/inbox/inquiry/followup'),room=o.data.targets[0];assert.ok(room);
  const input={revision:1,roomId:room.id,assigneeId:f.admin.id,nextAction:'답변 검토',dueDate:'2026-10-20'};
  assert.equal((await f.api(f.viewer,'/api/social/inbox/inquiry/followup',input)).status,403);
  f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),active:false});assert.equal((await f.api(f.admin,'/api/social/inbox/inquiry/followup',input)).status,404);assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM message_tasks').get().n,0);
});
