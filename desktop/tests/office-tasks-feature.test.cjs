'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {randomUUID} = require('node:crypto');
const {setTimeout: delay} = require('node:timers/promises');
const {createOfficeTasks} = require('../src/office-tasks.cjs');
const {createTaskStore} = require('../src/office-task-store.cjs');
const {supportsSchema} = require('../src/office-task-runtime.cjs');

const member = {synk_user_id:'member_office_a',sessionGeneration:1};
const REF = '20261123T050000Z-'+'0f8e2b44-1c5d-4c5e-9d7b-1a2b3c4d5e6f';

async function eventually(read, why) {
  const end = Date.now()+4000;
  do { const r = await read(); if (r) return r; await delay(8); } while (Date.now()<end);
  assert.fail(why);
}
const roots=new Set();
test.after(async()=>{for(const r of roots)await fs.rm(r,{recursive:true,force:true}).catch(()=>{});});
async function setup(t, root=null) {
  root ??= await fs.mkdtemp(path.join(os.tmpdir(),'solio-office-feature-'));
  roots.add(root);
  const state = {account:member,cap:2,toolCaps:{claude:2,codex:2}};
  const calls = [], contexts = [];
  const service = createOfficeTasks({
    userData:root,store:createTaskStore(root),current:()=>state.account,authorized:()=>true,
    context:async (a,id,opts)=>{
      contexts.push({id,opts});
      if (opts?.folder===false) return id==='plan01'?{ok:true,cwd:'',name:'기획부',role:'',cap:state.cap,toolCaps:state.toolCaps}:{ok:false,code:'FOLDER'};
      return {ok:true,cwd:path.join(root,'work',id||'office'),name:id||'사무실',role:'',cap:state.cap,toolCaps:state.toolCaps};
    },
    run(spec,hooks){return new Promise((resolve,reject)=>{calls.push({spec,hooks,resolve,reject});});},
  });
  const snap = async ()=>{const r=await service.snapshot(state.account);assert.equal(r.ok,true,JSON.stringify(r));return r.tasks;};
  const row = (id,wanted)=>eventually(async()=>{const j=(await snap()).find(x=>x.id===id);return j?.status===wanted&&j;},'Missing '+id+' '+wanted);
  const call = id=>eventually(()=>calls.find(c=>c.spec.id===id),'Missing call '+id);
  t.after(async()=>{service.close();for(const c of calls)c.resolve({});await service.snapshot(member).catch(()=>{});});
  return {root,state,calls,contexts,service,snap,row,call};
}
const feature = (o={}) => ({id:randomUUID(),feature:'bizplan',departmentId:'plan01',provider:'codex',...o});

test('기능 업무: 폴더 없는 문맥으로 서고, 영수증의 한 문장이 답이 되며, 세션을 남기지 않는다', async t=>{
  const f=await setup(t);
  const job=feature();
  assert.deepEqual(await f.service.submitFeature(member,job),{ok:true,id:job.id});
  const c=await f.call(job.id);
  assert.deepEqual(c.spec,{id:job.id,provider:'codex',feature:'bizplan',trigger:'manual',departmentId:'plan01',member:member.synk_user_id,cwd:''});
  assert.equal(typeof c.hooks.changed,'function');
  assert.ok(f.contexts.every(x=>x.opts?.folder===false));
  c.resolve({summary:'사업계획서에서 고칠 곳 3곳을 찾았습니다.',ref:REF,alert:true});
  const done=await f.row(job.id,'completed');
  assert.equal(done.answer,'사업계획서에서 고칠 곳 3곳을 찾았습니다.');
  assert.equal(done.feature,'bizplan');assert.equal(done.featureRef,REF);assert.equal(done.featureAlert,true);
  assert.equal(done.mailSearch,false);
  const ledger=JSON.parse(await fs.readFile(path.join(f.root,'Office',member.synk_user_id,'tasks.json'),'utf8'));
  const saved=ledger.tasks.find(x=>x.id===job.id);
  assert.equal(saved.cwd,'');assert.equal(saved.sessionId,null);
  for(const action of ['resume','terminal'])assert.equal((await f.service.action(member,job.id,action)).code,'SESSION');
});

test('기능 업무: 한 부서에 하나씩, 모르는 기능과 폴더 없는 부서는 받지 않는다', async t=>{
  const f=await setup(t);
  const first=feature();
  await f.service.submitFeature(member,first);
  assert.equal((await f.service.submitFeature(member,feature())).code,'BUSY');
  assert.equal((await f.service.submitFeature(member,feature({feature:'nope'}))).code,'VALUE');
  assert.equal((await f.service.submitFeature(member,feature({departmentId:'nodept'}))).code,'FOLDER');
  assert.equal((await f.service.submitFeature(member,feature({provider:'gemini'}))).code,'VALUE');
  assert.deepEqual(await f.service.submitFeature(member,first),{ok:true,id:first.id},'같은 번호는 한 번만 선다');
});

test('기능 업무는 수용 인원을 같이 따르고, 실패 코드는 REASONS 안의 것만 쓴다', async t=>{
  const f=await setup(t);
  f.state.cap=1;
  const ordinary={id:randomUUID(),provider:'claude',prompt:'평소 일'};
  await f.service.submit(member,ordinary);
  const o=await f.call(ordinary.id);
  const job=feature();
  await f.service.submitFeature(member,job);
  await delay(60);
  assert.equal(f.calls.some(c=>c.spec.id===job.id),false,'앞 일이 끝나기 전에는 시작하지 않는다');
  o.resolve({answer:'끝'});
  const c=await f.call(job.id);
  c.reject(Object.assign(new Error('x'),{code:'FEATURE_AI'}));
  assert.equal((await f.row(job.id,'failed')).reason,'PROVIDER');
  const second=feature();
  await f.service.submitFeature(member,second);
  (await f.call(second.id)).reject(Object.assign(new Error('x'),{code:'LIMIT'}));
  assert.equal((await f.row(second.id,'failed')).reason,'LIMIT');
  const third=feature();
  await f.service.submitFeature(member,third);
  (await f.call(third.id)).resolve({summary:''});
  assert.equal((await f.row(third.id,'failed')).reason,'NO_ANSWER');
});

test('다시 켜면 기다리던 기능 줄도 interrupted이고, 끝난 기능 줄은 여섯만 남는다', async t=>{
  const f=await setup(t);
  for(let i=0;i<7;i++){
    const job=feature();
    await f.service.submitFeature(member,job);
    (await f.call(job.id)).resolve({summary:'끝 '+i,ref:REF});
    await f.row(job.id,'completed');
  }
  assert.equal((await f.snap()).filter(x=>x.feature).length,6);
  f.state.cap=0;
  const waiting=feature();
  await f.service.submitFeature(member,waiting);
  f.service.close();
  const g=await setup(t,f.root);
  const after=(await g.snap()).find(x=>x.id===waiting.id);
  assert.equal(after.status,'interrupted');assert.equal(after.reason,'RESTART');
});

test('Claude 무인 실행 판: 2.1.323부터', () => {
  assert.equal(supportsSchema('2.1.323 (Claude Code)'),true);
  assert.equal(supportsSchema('2.2.0'),true);
  assert.equal(supportsSchema('2.1.322'),false);
  assert.equal(supportsSchema('nope'),false);
});
