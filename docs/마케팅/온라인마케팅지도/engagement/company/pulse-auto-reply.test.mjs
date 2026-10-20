import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';
import {createPulseAutoReplyService,pulseAutoReplyFacts,PULSE_AUTO_REPLY_KIND,PULSE_AUTO_REPLY_FALLBACK,PULSE_AUTO_REPLY_MODEL} from './pulse-auto-reply.mjs';

const KEY='sk-ant-api03-'+'x'.repeat(40);
const rejects=(run,status)=>assert.throws(run,error=>error.status===status);
const reply=(decision,text,reason='none')=>({status:200,body:{model:PULSE_AUTO_REPLY_MODEL,stop_reason:'end_turn',content:[{type:'thinking',thinking:''},{type:'text',text:JSON.stringify({decision,reply:text,handoffReason:reason})}],usage:{input_tokens:3000,output_tokens:500}}});

async function fixture(t,{responses=[]}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-auto-reply-'));let store=new Store(directory);
  t.after(async()=>{await service?.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role]of [['owner','member'],['admin','admin'],['viewer','viewer']])users[name]=store.createUser({name,email:name+'@auto-reply.example',role,teamId:'a'});
  let now='2026-10-19T03:00:00.000Z',projects,studio,service;const calls=[];const queue=[...responses];
  const fetchImpl=async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});const next=queue.shift();if(!next)throw new Error('NO_FAKE_RESPONSE');if(next.throw)throw next.throw;return {ok:next.status>=200&&next.status<300,status:next.status,text:async()=>typeof next.body==='string'?next.body:JSON.stringify(next.body)};};
  function services(){projects=createClientProjectsService({store,clock:()=>now});studio=createPulseStudioService({store,clientProjects:projects,clock:()=>now});service=createPulseAutoReplyService({store,clientProjects:projects,snapshot:id=>studio.customerSnapshot(id),clock:()=>now,fetchImpl});}
  services();
  const row=projects.save(users.owner,{title:'봄 신메뉴 15초 광고',customerName:'합성 카페',contact:'PRIVATE-CONTACT 010-0000-0000',summary:'신메뉴 세 가지를 15초 세로 영상 한 편으로',terms:'수정은 두 번까지 포함',internalNotes:'PRIVATE-NOTE 원가 메모',nextStep:'첫 시안을 보고 의견을 남겨 주세요.',dueDate:'2026-10-24',stage:'producing'}).project;
  const customer=projects.open(projects.invite(users.owner,row.id,{revision:row.revision}).invite);
  const read=()=>projects.project(users.owner,row.id);
  const tick=minutes=>{now=new Date(Date.parse(now)+minutes*60000).toISOString();};
  const ask=text=>{tick(1);return projects.customerAction(customer.session,customer.csrf,{revision:read().revision,action:'support',text}).project.messages.at(-1);};
  const enable=()=>{service.configure(users.admin,{apiKey:KEY});return service.configure(users.admin,{enabled:true});};
  return {users,customer,read,ask,tick,enable,calls,queue,row,get store(){return store},get projects(){return projects},get service(){return service},restart(){store.close();store=new Store(directory);services();}};
}

test('a new inquiry gets one automatic guide from customer-visible facts and stays on the staff task list',async t=>{
  const f=await fixture(t,{responses:[reply('answer','합의한 전달일은 10월 24일이에요. 첫 시안이 올라오면 의견을 남겨 주세요.')]});
  f.enable();const question=f.ask('언제쯤 받을 수 있을까요?');
  assert.deepEqual(await f.service.tick(),{handled:1});
  assert.equal(f.calls.length,1);const call=f.calls[0];
  assert.equal(call.url,'https://api.anthropic.com/v1/messages');assert.equal(call.init.headers['x-api-key'],KEY);assert.equal(call.init.redirect,'error');
  assert.equal(call.body.model,'claude-opus-5-5');assert.equal(call.body.output_config.format.type,'json_schema');assert.equal(call.body.output_config.effort,'medium');assert.equal(call.body.thinking,undefined);
  const sent=JSON.stringify(call.body);assert.match(sent,/봄 신메뉴 15초 광고/);assert.match(sent,/2026-10-24/);assert.match(sent,/언제쯤 받을 수 있을까요/);
  assert.doesNotMatch(sent,/PRIVATE-NOTE|PRIVATE-CONTACT|010-0000-0000/,'internal notes and contacts never reach the model');
  const messages=f.read().messages,answer=messages.at(-1);
  assert.equal(answer.author,'staff');assert.equal(answer.automated,true);assert.equal(answer.automatedKind,'ai');assert.equal(answer.authorName,'자동 안내');assert.equal(answer.replyTo,question.id);assert.equal(answer.visibility,'customer');
  assert.equal(messages.find(m=>m.id===question.id).resolved,false,'the inquiry stays open for the owner');
  const customerView=f.projects.read(f.customer.session).project;assert.equal(customerView.messages.at(-1).automated,true);assert.equal(customerView.messages.at(-1).text,answer.text);
  const event=f.store.get('clientProjects',f.row.id).notificationEvents.findLast(e=>e.messageId===answer.id);assert.equal(event.type,'auto_reply');assert.deepEqual(event.audiences,['customer']);assert.equal(event.tab,'review');
  const record=f.store.get(PULSE_AUTO_REPLY_KIND,`${f.row.id}:${question.id}`);assert.equal(record.status,'answered');assert.equal(record.decision,'answer');assert.equal(record.costUsd,0.022);
  assert.deepEqual(await f.service.tick(),{handled:0});assert.equal(f.calls.length,1,'one inquiry is answered at most once');
});

test('decisions that need a person are handed off without promises and always mention the owner',async t=>{
  const f=await fixture(t,{responses:[reply('handoff','추가 비용은 확인이 필요해요.','price')]});
  f.enable();f.ask('한 편 더 만들면 얼마예요?');await f.service.tick();
  const answer=f.read().messages.at(-1);assert.equal(answer.automated,true);assert.match(answer.text,/^추가 비용은 확인이 필요해요\. 담당자에게도 바로 전달해 두었어요\.$/);
  const record=f.store.all(PULSE_AUTO_REPLY_KIND)[0];assert.equal(record.decision,'handoff');assert.equal(record.handoffReason,'price');
});

test('failures leave a fixed note without AI and an uncertain call is never sent twice',async t=>{
  const f=await fixture(t,{responses:[{status:500,body:{type:'error',error:{type:'api_error',message:'boom'}}},{throw:Object.assign(new Error('aborted'),{name:'AbortError'})},{status:200,body:'not json'},reply('answer','주문 번호 0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b 로 확인돼요.'),{status:200,body:{stop_reason:'refusal',content:[],usage:{input_tokens:10,output_tokens:0}}},reply('answer','자세한 안내는 https://evil.example/x 에서 보세요.')]});
  f.enable();
  for(const text of ['첫 문의','둘째 문의','셋째 문의','넷째 문의','다섯째 문의','여섯째 문의']){f.ask(text);await f.service.tick();}
  const notes=f.read().messages.filter(m=>m.automated);assert.equal(notes.length,6);for(const note of notes){assert.equal(note.text,PULSE_AUTO_REPLY_FALLBACK);assert.equal(note.automatedKind,'fallback');}
  const records=f.store.all(PULSE_AUTO_REPLY_KIND).sort((a,b)=>a.claimedAt.localeCompare(b.claimedAt));
  assert.deepEqual(records.map(r=>r.reason),['api','api','invalid-response','invalid-output','stop-refusal','invalid-output']);
  assert.deepEqual(records.slice(0,2).map(r=>[r.error,r.charged]),[['api_error','unknown'],['timeout','unknown']]);
  assert.equal(await f.service.tick().then(()=>f.calls.length),6,'no retry for any failed or uncertain call');
});

test('a credit-low key stops further calls until the admin saves a key again',async t=>{
  const f=await fixture(t,{responses:[{status:400,body:{type:'error',error:{type:'invalid_request_error',message:'Your credit balance is too low to access the Anthropic API.'}}},reply('answer','다시 답해요.')]});
  f.enable();f.ask('첫 문의');await f.service.tick();f.ask('둘째 문의');await f.service.tick();
  assert.equal(f.calls.length,1);const records=f.store.all(PULSE_AUTO_REPLY_KIND);assert.deepEqual(records.map(r=>r.reason).sort(),['api','credit-low']);
  assert.equal(records.find(r=>r.reason==='api').charged,'no');assert.equal(records.find(r=>r.reason==='api').costUsd,0);
  assert.equal(f.service.settings(f.users.admin).keyState,'credit-low');
  f.service.configure(f.users.admin,{apiKey:KEY});assert.equal(f.service.settings(f.users.admin).keyState,null);f.ask('셋째 문의');await f.service.tick();assert.equal(f.calls.length,2);
});

test('daily budget and per-project limits send the fixed note instead of calling the API',async t=>{
  const f=await fixture(t,{responses:[reply('answer','첫 답이에요.'),reply('answer','둘째 답이에요.')]});
  f.enable();f.service.configure(f.users.admin,{perProjectDaily:1});
  f.ask('첫 문의');await f.service.tick();f.ask('둘째 문의');await f.service.tick();
  assert.equal(f.calls.length,1);assert.equal(f.store.all(PULSE_AUTO_REPLY_KIND).find(r=>r.reason).reason,'project-daily-limit');
  f.service.configure(f.users.admin,{perProjectDaily:10,dailyUsd:0.1});f.ask('셋째 문의');await f.service.tick();
  assert.equal(f.calls.length,1,'a call whose worst case exceeds the daily budget is not sent');assert.ok(f.store.all(PULSE_AUTO_REPLY_KIND).some(r=>r.reason==='budget'));
});

test('older, resolved, staff-answered and archived inquiries are left alone',async t=>{
  const f=await fixture(t,{responses:[]});
  const before=f.ask('켜기 전에 남긴 문의');f.enable();
  assert.deepEqual(await f.service.tick(),{handled:0});assert.equal(f.calls.length,0,'switching on does not answer the backlog');
  const answered=f.ask('담당자가 먼저 답할 문의');f.tick(1);f.projects.message(f.users.owner,f.row.id,{revision:f.read().revision,text:'제가 바로 답해 드릴게요.'});
  const resolved=f.ask('처리된 문의');f.tick(1);f.projects.resolveMessage(f.users.owner,f.row.id,resolved.id,{revision:f.read().revision});
  assert.deepEqual(await f.service.tick(),{handled:0});assert.equal(f.calls.length,0);
  assert.equal(f.read().messages.filter(m=>m.automated).length,0);assert.ok(before&&answered);
  f.ask('보관 직전 문의');f.tick(1);const raw=f.store.get('clientProjects',f.row.id);f.store.put('clientProjects',f.row.id,{...raw,stage:'archived'});
  assert.deepEqual(await f.service.tick(),{handled:0});assert.equal(f.calls.length,0);
});

test('a call left in flight by a stopped server ends with the fixed note and is not resent',async t=>{
  const f=await fixture(t,{responses:[]});f.enable();const question=f.ask('서버가 꺼지기 직전 문의');
  const id=`${f.row.id}:${question.id}`;f.store.put(PULSE_AUTO_REPLY_KIND,id,{id,projectId:f.row.id,messageId:question.id,status:'sending',kind:'ai',claimToken:'t',claimedAt:'2026-10-19T03:01:00.000Z',attempts:1,reservedUsd:0.09});
  f.restart();f.tick(5);assert.deepEqual(await f.service.tick(),{handled:0});assert.equal(f.read().messages.filter(m=>m.automated).length,0,'not stale yet');
  f.tick(10);await f.service.tick();assert.equal(f.calls.length,0);
  const record=f.store.get(PULSE_AUTO_REPLY_KIND,id);assert.equal(record.status,'fallback');assert.equal(record.reason,'stale-sending');assert.equal(record.charged,'unknown');assert.equal(record.costUsd,0.09);
  assert.equal(f.read().messages.at(-1).text,PULSE_AUTO_REPLY_FALLBACK);
});

test('settings are admin only, never reveal the key, validate limits and need a key before switching on',async t=>{
  const f=await fixture(t);
  rejects(()=>f.service.settings(f.users.owner),403);rejects(()=>f.service.configure(f.users.viewer,{enabled:true}),403);
  rejects(()=>f.service.configure(f.users.admin,{enabled:true}),409);
  rejects(()=>f.service.configure(f.users.admin,{apiKey:'not-a-key'}),400);rejects(()=>f.service.configure(f.users.admin,{dailyUsd:0}),400);rejects(()=>f.service.configure(f.users.admin,{monthlyUsd:900}),400);
  const saved=f.service.configure(f.users.admin,{apiKey:KEY});assert.equal(saved.configured,true);assert.equal(saved.enabled,false);assert.equal(saved.keyHint,'…xxxx');
  assert.doesNotMatch(JSON.stringify(f.service.settings(f.users.admin)),new RegExp(KEY));
  const on=f.service.configure(f.users.admin,{enabled:true});assert.equal(on.enabled,true);assert.equal(on.enabledAt,'2026-10-19T03:00:00.000Z');
  f.tick(5);assert.equal(f.service.configure(f.users.admin,{enabled:true}).enabledAt,'2026-10-19T03:00:00.000Z','turning on again keeps the original start');
  const off=f.service.configure(f.users.admin,{apiKey:''});assert.equal(off.configured,false);assert.equal(off.enabled,false);
});

test('model facts keep customer wording but drop file links and internal identifiers',()=>{
  const facts=JSON.parse(pulseAutoReplyFacts({title:'제목',customerName:'고객',ownerName:'담당',stageLabel:'제작',dueDate:'2026-10-24',nextStep:'확인',summary:'요약',terms:'조건',
    versions:[{id:'v1',label:'시안 1',kind:'preview',url:'https://files.example/a',media:{url:'/pulse/api/media/x'},createdAt:'2026-10-19T01:00:00.000Z'}],
    messages:[{id:'m1',author:'customer',action:'support',text:'질문',at:'2026-10-19T02:00:00.000Z'},{id:'m2',author:'staff',automated:true,text:'자동',at:'2026-10-19T02:01:00.000Z'},{id:'m3',author:'customer',action:'support',text:'지금 질문',at:'2026-10-19T02:02:00.000Z'}],
    studio:{deliverables:{items:[{id:'d1',label:'세로 15초',assetId:'a1',url:'https://x.example/y'}]}}},'m3'));
  assert.equal(facts.프로젝트.합의한전달일,'2026-10-24');assert.equal(facts.시안[0].이름,'시안 1');assert.equal(facts.시안[0].url,undefined);
  assert.deepEqual(facts.최근대화.map(m=>m.who),['고객','자동 안내'],'the inquiry being answered is not repeated as history');
  assert.doesNotMatch(JSON.stringify(facts),/files\.example|x\.example|"d1"|"a1"|"v1"/);
});

test('a rejected key stops further calls, a cut-off answer is not posted, and two ticks never call twice',async t=>{
  const cutOff={status:200,body:{stop_reason:'max_tokens',content:[{type:'text',text:'{"decision":"answer","reply":"중간에 끊긴'}],usage:{input_tokens:3000,output_tokens:12000}}};
  const f=await fixture(t,{responses:[cutOff,{status:401,body:{type:'error',error:{type:'authentication_error',message:'invalid x-api-key'}}},reply('answer','다시 답해요.')]});
  f.enable();f.ask('첫 문의');await Promise.all([f.service.tick(),f.service.tick()]);
  assert.equal(f.calls.length,1,'concurrent ticks share one pass');
  assert.equal(f.read().messages.at(-1).text,PULSE_AUTO_REPLY_FALLBACK);assert.equal(f.store.all(PULSE_AUTO_REPLY_KIND)[0].reason,'stop-max_tokens');
  f.ask('둘째 문의');await f.service.tick();f.ask('셋째 문의');await f.service.tick();
  assert.equal(f.calls.length,2,'after a 401 the key is not used again');
  const settings=f.service.settings(f.users.admin);assert.equal(settings.keyState,'key-invalid');assert.equal(settings.usage.todayCount,0);assert.equal(settings.usage.todayFallbacks,3);
  assert.deepEqual(settings.recent.map(row=>row.reason),['key-invalid','api','stop-max_tokens']);
  f.service.configure(f.users.admin,{apiKey:KEY});f.ask('넷째 문의');await f.service.tick();assert.equal(f.calls.length,3);assert.equal(f.service.settings(f.users.admin).usage.todayCount,1);
  const call=f.calls[2].body;assert.equal(call.max_tokens,12000);assert.equal(call.messages[0].content.length,2,'facts and the inquiry travel as separate blocks');assert.match(call.messages[0].content[1].text,/^고객이 방금 남긴 문의:\n넷째 문의$/);
});
