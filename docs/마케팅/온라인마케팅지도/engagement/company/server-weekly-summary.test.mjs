import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-weekly-api-'));let at='2026-10-12T00:30:00.000Z',external=0;
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,clock:()=>at,collector:async()=>{external++;throw Error('forbidden');},...options});
  await app.start();const base=`http://127.0.0.1:${app.server.address().port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-weekly-api-'));await rm(directory,{recursive:true,force:true});});
  const users={},sessions={},boot={};
  async function api(name,path,method='GET',input){
    const response=await fetch(base+path,{method,headers:{...(name?{Cookie:'synk_company_session='+sessions[name]}:{}),...(input!==undefined?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'weekly-api'}:{})},...(input!==undefined?{body:JSON.stringify(input)}:{})});
    return {status:response.status,headers:response.headers,data:await response.json()};
  }
  for(const name of ['owner','other','viewer']){users[name]=app.store.createUser({name,email:name+'@example.test',role:name==='viewer'?'viewer':'member'});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'weekly-api'},30);boot[name]=(await api(name,'/messenger/api/bootstrap')).data;}
  return {app,users,api,boot,external:()=>external,setClock:value=>at=value};
}
const section=(data,id)=>data.sections.find(row=>row.id===id);

test('weekly HTTP keeps own current permissions, KST windows and no-store; Marin opens same summary',async t=>{
  const f=await fixture(t);
  assert.equal((await f.api(null,'/api/weekly-summary')).status,401);
  for(const query of ['week=2026-10-12','week=2026-10-06','week=','week=2026-02-30','week=2026-10-05&week=2026-09-28','userId=other'])assert.equal((await f.api('owner','/api/weekly-summary?'+query)).status,400,query);
  const first=await f.api('owner','/api/weekly-summary');assert.equal(first.status,200);assert.match(first.headers.get('cache-control'),/no-store/);
  assert.equal(first.data.period.startDate,'2026-10-05');assert.equal(first.data.period.endDate,'2026-10-11');assert.equal(first.data.schedule.enabled,false);
  const room=f.boot.owner.channels.find(row=>row.kind==='self');assert.ok(room);
  const made=await f.api('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'PRIVATE BODY NOT FOR SUMMARY'});assert.equal(made.status,201);
  let task=(await f.api('owner',`/messenger/api/messages/${made.data.message.id}/task`,'POST',{title:'주간 검증 업무',assigneeId:f.boot.owner.user.id,dueDate:'2026-10-14'})).data.task;
  assert.ok(task);
  for(const stage of ['accepted','done'])task=(await f.api('owner',`/messenger/api/messages/${made.data.message.id}/task`,'PATCH',{stage,revision:task.revision})).data.task;
  f.app.messenger.db.prepare("UPDATE productivity_events SET created_at=? WHERE task_id=? AND kind='task_stage'").run('2026-10-11T14:59:59.000Z',task.id);
  let result=(await f.api('owner','/api/weekly-summary')).data;
  assert.equal(section(result,'completed').items.filter(row=>row.kind==='task').length,1);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE BODY/);
  const completed=section(result,'completed').items.find(row=>row.kind==='task');assert.match(completed.href,/channelId=/);assert.match(completed.href,/messageId=/);
  task=(await f.api('owner',`/messenger/api/messages/${made.data.message.id}/task`,'PATCH',{stage:'doing',revision:task.revision})).data.task;
  result=(await f.api('owner','/api/weekly-summary')).data;
  assert.match(section(result,'completed').items.find(row=>row.kind==='task').statusLabel,/완료 후/);
  assert.ok(section(result,'upcoming').items.some(row=>row.kind==='task'));
  assert.doesNotMatch(JSON.stringify((await f.api('other','/api/weekly-summary')).data),/주간 검증 업무/);
  assert.doesNotMatch(JSON.stringify((await f.api('viewer','/api/weekly-summary')).data),/주간 검증 업무/);
  const ask=await f.api('owner','/api/assistant','POST',{message:'지난주 정리해줘'});assert.equal(ask.status,200);assert.equal(ask.data.intent,'weekly-summary');assert.equal(ask.data.actions[0].type,'weekly-summary');assert.equal(ask.data.externalCalls,false);
  f.app.messenger.db.prepare('DELETE FROM messages WHERE id=?').run(Number(made.data.message.id));
  assert.equal(section((await f.api('owner','/api/weekly-summary')).data,'completed').items.filter(row=>row.kind==='task').length,0);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.equal((await f.api('owner','/api/weekly-summary')).status,401);assert.equal(f.external(),0);
});

test('scheduled weekly markers are idempotent and do not copy source text or send messages',async t=>{
  const f=await fixture(t,{weeklySummarySchedule:true});
  const before=Number(f.app.messenger.db.prepare('SELECT count(*) AS n FROM messages').get().n);
  f.app.scanWeeklySummary();const records=f.app.store.all('weeklyWorkSummaries');assert.ok(records.length>=2);
  const original=JSON.stringify(records);f.app.scanWeeklySummary();f.app.scanWeeklySummary();assert.equal(JSON.stringify(f.app.store.all('weeklyWorkSummaries')),original);
  assert.equal(Number(f.app.messenger.db.prepare('SELECT count(*) AS n FROM messages').get().n),before);
  const result=await f.api('owner','/api/weekly-summary');assert.equal(result.data.schedule.enabled,true);
  f.setClock('2026-10-18T14:59:59.000Z');f.app.scanWeeklySummary();assert.equal(f.app.store.all('weeklyWorkSummaries').length,records.length);
  f.setClock('2026-10-18T15:00:00.000Z');f.app.scanWeeklySummary();assert.ok(f.app.store.all('weeklyWorkSummaries').length>records.length);
  assert.equal((await f.api('owner','/api/weekly-summary')).data.period.startDate,'2026-10-12');assert.equal(f.external(),0);
});

test('weekly assets are served and unsafe weekly options are rejected',async t=>{
  const f=await fixture(t);
  for(const file of ['weekly-summary.js','weekly-summary.css']){const response=await fetch(`http://127.0.0.1:${f.app.server.address().port}/`+file);assert.equal(response.status,200);assert.ok((await response.text()).length>50);}
});

test('current reviewer sees the exact review action without taking credit for another assignee completion',async t=>{
  const f=await fixture(t),room=f.boot.owner.channels.find(row=>row.systemKey==='social');assert.ok(room);
  const message=(await f.api('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'주간 검토 합성 요청'})).data.message;
  let task=(await f.api('owner',`/messenger/api/messages/${message.id}/task`,'POST',{title:'내가 검토할 주간 결과',assigneeId:f.boot.owner.user.id,reviewerId:f.boot.other.user.id,dueDate:'2026-10-14'})).data.task;
  for(const stage of ['accepted','doing'])task=(await f.api('owner',`/messenger/api/messages/${message.id}/task`,'PATCH',{stage,revision:task.revision})).data.task;
  const result=(await f.api('owner',`/messenger/api/channels/${room.id}/messages`,'POST',{body:'합성 결과물'})).data.message;
  task=(await f.api('owner',`/messenger/api/messages/${message.id}/task`,'PATCH',{stage:'review',resultMessageId:result.id,revision:task.revision})).data.task;
  assert.ok(task);
  const review=(await f.api('other','/api/weekly-summary')).data;
  assert.ok(section(review,'attention').items.some(row=>row.title==='내가 검토할 주간 결과'));
  assert.ok(!section((await f.api('owner','/api/weekly-summary')).data,'attention').items.some(row=>row.title==='내가 검토할 주간 결과'));
  assert.ok(!section(review,'upcoming').items.some(row=>row.title==='내가 검토할 주간 결과'));
  f.app.messenger.db.prepare('DELETE FROM memberships WHERE channel_id=? AND user_id=?').run(room.id,f.boot.other.user.id);
  assert.doesNotMatch(JSON.stringify((await f.api('other','/api/weekly-summary')).data),/내가 검토할 주간 결과/);
});
