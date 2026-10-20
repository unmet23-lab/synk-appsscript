import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

const csrf='pulse-auto-reply-test-csrf',KEY='sk-ant-api03-'+'k'.repeat(40);

test('an admin key switches on automatic guides that reach the customer app and its notifications',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-server-pulse-auto-reply-'));let at='2026-10-19T03:00:00.000Z';const calls=[];
  const fakeFetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return {ok:true,status:200,text:async()=>JSON.stringify({model:'claude-opus-5-5',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({decision:'answer',reply:'첫 시안은 제작 중이에요. 올라오면 이 화면에서 바로 알려 드릴게요.',handoffReason:'none'})}],usage:{input_tokens:2000,output_tokens:300}})};};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:'0',clock:()=>at,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,pulseAutoReplyFetch:fakeFetch});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  const admin=app.store.createUser({name:'Admin',email:'admin@auto-reply.test',role:'admin',teamId:'a'}),owner=app.store.createUser({name:'Maker',email:'maker@auto-reply.test',role:'member',teamId:'a'});
  const cookies=new Map([admin,owner].map(user=>[user.id,'synk_company_session='+app.store.mint('session',user.id,{csrfToken:csrf},10)]));
  async function call(path,input,{user=owner,cookie,headers={}}={}){
    const method=input===undefined?'GET':'POST';
    const response=await fetch(base+path,{method,headers:{...(cookie||user?{Cookie:cookie||cookies.get(user.id)}:{}),...(method==='GET'?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':csrf}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  assert.equal((await call('/api/settings/pulse-auto-reply',{apiKey:KEY,enabled:true})).status,403,'only an admin can store the key');
  assert.equal((await call('/api/settings/pulse-auto-reply')).status,403);
  const saved=await call('/api/settings/pulse-auto-reply',{apiKey:KEY,enabled:true},{user:admin});assert.equal(saved.status,200);assert.equal(saved.data.enabled,true);assert.doesNotMatch(JSON.stringify(saved.data),new RegExp(KEY));
  assert.equal((await call('/api/state',undefined,{user:admin})).data.pulseAutoReply.configured,true);assert.equal((await call('/api/state')).data.pulseAutoReply,null,'members never see the key settings');

  const created=await call('/api/client-projects',{title:'AUTO REPLY TEST',customerName:'Client',internalNotes:'PRIVATE-MAKER-NOTES',dueDate:'2026-10-24'});assert.equal(created.status,201);
  const projectId=created.data.project.id,row=()=>app.store.get('clientProjects',projectId);
  const invited=await call(`/api/client-projects/${projectId}/invite`,{revision:row().revision});const opened=await call('/pulse/api/open',{invite:invited.data.invite},{user:null});assert.equal(opened.status,200);
  const customer=(path,input)=>call('/pulse/api/'+path,input,{user:null,cookie:opened.cookie,headers:{'X-Pulse-CSRF':opened.data.csrf}});
  at='2026-10-19T03:05:00.000Z';
  const asked=await customer('action',{revision:row().revision,action:'support',text:'첫 시안은 언제 볼 수 있나요?'});assert.equal(asked.status,200);
  assert.deepEqual(await app.pulseAutoReply.tick(),{handled:1});assert.equal(calls.length,1);
  assert.doesNotMatch(JSON.stringify(calls[0].body),/PRIVATE-MAKER-NOTES/);assert.match(JSON.stringify(calls[0].body),/AUTO REPLY TEST/);
  const project=(await customer('project')).data.project,last=project.messages.at(-1);
  assert.equal(last.automated,true);assert.equal(last.authorName,'자동 안내');assert.match(last.text,/첫 시안은 제작 중이에요/);
  const live=(await customer('live')).data,note=live.notifications.find(item=>item.messageId===last.id);
  assert.equal(note.type,'auto_reply');assert.equal(note.title,'문의에 자동 안내가 왔어요');assert.equal(note.tab,'review');
  const staff=row().messages.find(m=>m.action==='support');assert.equal(staff.resolved,false,'the owner still answers or closes the inquiry');
  const settings=(await call('/api/settings/pulse-auto-reply',undefined,{user:admin})).data;assert.equal(settings.usage.todayCount,1);assert.equal(settings.recent[0].status,'answered');
  assert.ok(app.store.all('audit').some(row=>row.action==='pulse-auto-reply-settings'&&!JSON.stringify(row).includes(KEY)),'settings changes are audited without the key');
});

// 운영 노드는 배경 작업 0 + 업무실 예약 1이다. 그 조합에서 자동 안내 주기가 뜨고, 업무실 예약이 꺼지면 뜨지 않는다.
for(const [workroom,expected] of [['1',true],['0',false]])test(`the auto-reply schedule follows the workroom switch on a background=0 node (workroom=${workroom})`,async t=>{
  const keys=['SYNK_COMPANY_BACKGROUND_JOBS_ENABLED','SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED','SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED'],before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  process.env[keys[0]]='0';process.env[keys[1]]=workroom;process.env[keys[2]]='0';
  const original=globalThis.setInterval,started=[];globalThis.setInterval=(callback,ms,...rest)=>{started.push({name:callback.name,ms});return original(callback,ms,...rest);};
  const directory=await mkdtemp(join(tmpdir(),'synk-server-pulse-auto-reply-schedule-'));const deny=async()=>{throw Error('Unexpected external call');};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,collector:deny,dailyTrendsCollector:deny,contentFetch:deny,pulseAutoReplyFetch:deny,socialSchedule:false,webPushEnabled:false});
  t.after(async()=>{globalThis.setInterval=original;await app.stop();for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];await rm(directory,{recursive:true,force:true});});
  await app.start();
  assert.equal(started.some(row=>row.name==='scanPulseAutoReplies'&&row.ms===15000),expected);
});
