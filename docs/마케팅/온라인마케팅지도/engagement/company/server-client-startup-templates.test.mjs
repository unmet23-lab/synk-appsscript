import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {request} from 'node:http';
import {createCompanyApp} from './server.mjs';

const csrf='synthetic-startup-template';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-startup-template-http-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});
  await app.start();const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-startup-template-http-'));await rm(directory,{recursive:true,force:true});});
  for(const [name,role,teamId]of [['owner','member','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]]){users[name]=app.store.createUser({name,email:name+'@startup-template-http.test',role,teamId});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);}
  const project=app.clientProjects.save(users.owner,{title:'합성 양식 HTTP 프로젝트',customerName:'PRIVATE-CUSTOMER',contact:'PRIVATE-CONTACT',internalNotes:'PRIVATE-SOURCE-NOTE'}).project,id=project.id,path='/api/client-projects/'+id+'/startup-templates',startupPath='/api/client-projects/'+id+'/startup',row=()=>app.store.get('clientProjects',id);
  const configuration={calendar:'weekdays',sections:{kickoff:{dueOffset:-1,requirements:[{label:'직접 작성한 자료 항목',required:true}]} }},input=(extra={})=>({action:'save',revision:row().revision,templateId:null,expectedRevision:0,label:'PRIVATE-HTTP-TEMPLATE',configuration:structuredClone(configuration),...extra});
  async function api({user='owner',url=path,input,method=input===undefined?'GET':'POST',headers={}}={}){const response=await fetch(base+url,{method,headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json(),headers:response.headers};}
  const preview=template=>({action:'preview',revision:row().revision,presetId:'template:'+template.id,templateRevision:template.revision,referenceDate:'2026-11-02',calendar:'weekdays'});
  const apply=view=>({action:'apply',revision:view.revision,presetId:view.presetId,templateRevision:view.templateRevision,referenceDate:view.referenceDate,calendar:view.calendar,sections:['kickoff'],draft:{kickoff:view.draft.kickoff}});
  async function slow(payload,mutate,url=path){const body=JSON.stringify(payload),arrived=new Promise(resolve=>app.server.once('request',()=>queueMicrotask(resolve)));let req;const done=new Promise((resolve,reject)=>{req=request(base+url,{method:'POST',headers:{Cookie:'synk_company_session='+sessions.owner,Origin:app.origin,'X-CSRF-Token':csrf,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{let data='';response.setEncoding('utf8');response.on('data',chunk=>data+=chunk);response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(data)}));});req.on('error',reject);});req.write(body.slice(0,10));await arrived;mutate();req.end(body.slice(10));return done;}
  return {app,users,api,slow,id,path,startupPath,row,input,preview,apply};
}

test('HTTP captures an explicit edited draft and saves a private template without writing the project',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),draft={kickoff:{enabled:true,dueDate:'2026-10-09',requirements:[{label:'개인 양식 항목',required:false}]}};
  const captured=await f.api({input:{action:'capture',revision:f.row().revision,source:'draft',referenceDate:'2026-10-12',calendar:'weekdays',sections:['kickoff'],draft}});assert.equal(captured.status,200);assert.equal(captured.data.source,'draft');assert.equal(captured.data.configuration.sections.kickoff.dueOffset,-1);
  const saved=await f.api({input:f.input({configuration:captured.data.configuration})});assert.equal(saved.status,200);assert.equal(saved.data.template.revision,1);const listed=await f.api();assert.equal(listed.data.templates[0].id,saved.data.template.id);assert.match(listed.headers.get('cache-control'),/no-store/);assert.equal(JSON.stringify(f.row()),before);assert.doesNotMatch(JSON.stringify(f.app.store.all('clientStartupTemplates')),/PRIVATE-HTTP-TEMPLATE|개인 양식 항목|PRIVATE-CUSTOMER/);
  const catalog=await f.api({url:f.startupPath});assert.deepEqual(catalog.data.presets.slice(0,3).map(row=>row.id),['short_ad','product_intro','interview']);assert.deepEqual(catalog.data.presets[3].templateSections,['kickoff']);
});

test('HTTP personal template preview uses new dates and applies fresh incomplete material requirements only',async t=>{
  const f=await fixture(t),template=(await f.api({input:f.input()})).data.template,before=JSON.stringify(f.row()),view=(await f.api({url:f.startupPath,input:f.preview(template)})).data;assert.equal(view.draft.kickoff.dueDate,'2026-10-30');assert.equal(view.sections.schedule.available,false);assert.equal(view.sections.deliverables.available,false);assert.equal(JSON.stringify(f.row()),before);
  const applied=await f.api({url:f.startupPath,input:f.apply(view)});assert.equal(applied.status,200);assert.equal(f.row().revision,view.revision+1);assert.equal(f.row().schedulePlan,undefined);assert.equal(f.row().studio,undefined);assert.ok(f.row().kickoffPlan.requirements.every(row=>!row.sourceKey&&!row.review&&!row.waiver));assert.deepEqual(f.row().versions,[]);assert.deepEqual(f.row().messages,[]);assert.equal(f.row().customerName,'PRIVATE-CUSTOMER');assert.equal((await f.api({url:f.startupPath,input:f.apply(view)})).status,409);
});

test('HTTP current identities, project ACL, CSRF, origin and private owner namespaces guard template access',async t=>{
  const f=await fixture(t);for(const [user,status]of [[null,401],['viewer',403],['other',404]]){assert.equal((await f.api({user})).status,status);assert.equal((await f.api({user,input:f.input()})).status,status);}
  for(const headers of [{'X-CSRF-Token':'bad'},{Origin:'https://unrelated.example'}])assert.equal((await f.api({input:f.input(),headers})).status,403);assert.equal((await f.api({url:f.path+'?userId='+f.users.owner.id})).status,400);
  const customer=f.app.clientProjects.open(f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.row().revision}).invite);assert.equal((await f.api({user:null,headers:{Cookie:'synk_pulse_session='+customer.session}})).status,401);
  const template=(await f.api({input:f.input()})).data.template;assert.deepEqual((await f.api({user:'admin'})).data.templates,[]);for(const action of ['save','delete'])assert.equal((await f.api({user:'admin',input:action==='save'?f.input({templateId:template.id,expectedRevision:1}):{action,revision:f.row().revision,templateId:template.id,expectedRevision:1}})).status,404);
  assert.equal((await f.api({user:'admin',url:f.startupPath,input:f.preview(template)})).status,404);
});

test('HTTP template CAS and tombstones prevent concurrent replacement and stale template application',async t=>{
  const f=await fixture(t),template=(await f.api({input:f.input()})).data.template,view=(await f.api({url:f.startupPath,input:f.preview(template)})).data,before=JSON.stringify(f.row());
  const outcomes=await Promise.all(['left','right'].map(label=>f.api({input:f.input({templateId:template.id,expectedRevision:1,label})})));assert.deepEqual(outcomes.map(row=>row.status).sort(),[200,409]);assert.equal((await f.api({url:f.startupPath,input:f.apply(view)})).status,409);
  const updated=outcomes.find(row=>row.status===200).data.template,newView=(await f.api({url:f.startupPath,input:f.preview(updated)})).data,deleted=await f.api({input:{action:'delete',revision:f.row().revision,templateId:template.id,expectedRevision:2}});assert.equal(deleted.status,200);assert.equal(deleted.data.template.revision,3);assert.equal(deleted.data.template.configuration,null);assert.equal((await f.api({url:f.startupPath,input:f.apply(newView)})).status,409);assert.equal((await f.api({input:f.input({templateId:template.id,expectedRevision:2})})).status,409);assert.deepEqual((await f.api()).data.templates,[]);assert.equal(JSON.stringify(f.row()),before);
});

test('HTTP malformed and oversized configuration, stale project revision and unsupported actions never write',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row());for(const input of [f.input({userId:f.users.admin.id}),f.input({configuration:{...f.input().configuration,ownerId:f.users.owner.id}}),f.input({configuration:{calendar:'calendar',sections:{kickoff:{dueOffset:366,requirements:[]}}}}),f.input({action:'clone'}),f.input({expectedRevision:-1})])assert.equal((await f.api({input})).status,400);
  assert.equal((await f.api({input:f.input({revision:0})})).status,409);assert.equal((await f.api({input:f.input({label:'x'.repeat(230000)})})).status,413);assert.equal((await f.api({method:'PUT'})).status,405);assert.equal(f.app.store.all('clientStartupTemplates').length,0);assert.equal(JSON.stringify(f.row()),before);
});

test('HTTP save rechecks role after a partial request body before any private write',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),result=await f.slow(f.input(),()=>f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'}));assert.equal(result.status,403);assert.equal(f.app.store.all('clientStartupTemplates').length,0);assert.equal(JSON.stringify(f.row()),before);
});

test('HTTP apply rejects a session revoked while receiving its request body',async t=>{
  const f=await fixture(t),template=(await f.api({input:f.input()})).data.template,view=(await f.api({url:f.startupPath,input:f.preview(template)})).data,before=JSON.stringify(f.row()),result=await f.slow(f.apply(view),()=>f.app.store.revokeUser(f.users.owner.id),f.startupPath);assert.equal(result.status,401);assert.equal(JSON.stringify(f.row()),before);
});

test('HTTP project reassignment during save removes access without changing existing private template',async t=>{
  const f=await fixture(t),template=(await f.api({input:f.input()})).data.template,before=JSON.stringify(f.app.store.all('clientStartupTemplates')),result=await f.slow(f.input({templateId:template.id,expectedRevision:1}),()=>{const row=f.row();f.app.store.put('clientProjects',row.id,{...row,ownerId:f.users.other.id,teamId:'b'});});assert.equal(result.status,404);assert.equal((await f.api()).status,404);assert.equal(JSON.stringify(f.app.store.all('clientStartupTemplates')),before);assert.deepEqual((await f.api({user:'other'})).data.templates,[]);
});
