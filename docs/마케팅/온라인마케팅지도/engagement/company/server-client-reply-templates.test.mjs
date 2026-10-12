import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {request} from 'node:http';
import {createCompanyApp} from './server.mjs';

const csrf='synthetic-reply-template';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-reply-template-http-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});
  await app.start();const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-reply-template-http-'));await rm(directory,{recursive:true,force:true});});
  for(const [name,role,teamId]of [['owner','member','a'],['manager','manager','a'],['viewer','viewer','a'],['peer','member','a'],['other','member','b'],['admin','admin',null]]){users[name]=app.store.createUser({name,email:name+'@reply-template-http.test',role,teamId});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);}
  const project=app.clientProjects.save(users.owner,{title:'합성 답변 프로젝트',customerName:'합성 고객',contact:'SOURCE-CONTACT',internalNotes:'SOURCE-NOTE',dueDate:'2026-11-02'}).project,id=project.id,path='/api/client-projects/'+id+'/reply-templates',row=()=>app.store.get('clientProjects',id);
  const input=(extra={})=>({action:'save',revision:row().revision,templateId:null,expectedRevision:0,label:'PRIVATE-HTTP-LABEL',body:'PRIVATE-HTTP-BODY {{고객명}} {{프로젝트명}} {{합의한 전달일}}',...extra});
  async function api({user='owner',url=path,input,method=input===undefined?'GET':'POST',headers={}}={}){const response=await fetch(base+url,{method,headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json(),headers:response.headers};}
  const preview=(template,extra={})=>({action:'preview',revision:row().revision,templateId:template?.id||null,expectedRevision:template?.revision||0,target:'message',...extra});
  async function slow(payload,mutate){const body=JSON.stringify(payload),arrived=new Promise(resolve=>app.server.once('request',()=>queueMicrotask(resolve)));let req;const done=new Promise((resolve,reject)=>{req=request(base+path,{method:'POST',headers:{Cookie:'synk_company_session='+sessions.owner,Origin:app.origin,'X-CSRF-Token':csrf,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{let data='';response.setEncoding('utf8');response.on('data',chunk=>data+=chunk);response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(data)}));});req.on('error',reject);});req.write(body.slice(0,10));await arrived;mutate();req.end(body.slice(10));return done;}
  const sources=()=>app.store.db.prepare("SELECT kind,id,body FROM documents WHERE kind!='clientReplyTemplates' ORDER BY kind,id").all();
  return {app,users,sessions,base,api,slow,id,path,row,input,preview,sources};
}

test('HTTP private template CRUD and preview leave every business document unchanged and do not log reusable text',async t=>{
  const f=await fixture(t),before=f.sources(),saved=await f.api({input:f.input()});assert.equal(saved.status,200);const template=saved.data.template;assert.equal(template.revision,1);const listed=await f.api();assert.deepEqual(listed.data.templates,[template]);assert.match(listed.headers.get('cache-control'),/no-store/);assert.deepEqual(listed.data.tokens,['{{고객명}}','{{프로젝트명}}','{{합의한 전달일}}']);
  const view=await f.api({input:f.preview(template)});assert.equal(view.status,200);assert.equal(view.data.preview.ready,true);assert.equal(view.data.preview.body,'PRIVATE-HTTP-BODY 합성 고객 합성 답변 프로젝트 2026-11-02');assert.equal(view.data.revision,f.row().revision);assert.doesNotMatch(JSON.stringify(f.app.store.all('clientReplyTemplates')),/PRIVATE-HTTP-|합의한 전달일|합성 고객/);
  const deleted=await f.api({input:{action:'delete',revision:f.row().revision,templateId:template.id,expectedRevision:1}});assert.equal(deleted.status,200);assert.equal(deleted.data.template.body,null);assert.deepEqual((await f.api()).data.templates,[]);assert.deepEqual(f.sources(),before);
});

test('HTTP auth project write ACL CSRF origin and personal ownership protect every template operation',async t=>{
  const f=await fixture(t);for(const [user,code]of [[null,401],['viewer',403],['peer',404],['other',404]]){assert.equal((await f.api({user})).status,code);assert.equal((await f.api({user,input:f.input()})).status,code);assert.equal((await f.api({user,input:f.preview(null,{body:'안내'})})).status,code);}
  for(const headers of [{'X-CSRF-Token':'invalid'},{Origin:'https://unrelated.example'}])assert.equal((await f.api({input:f.input(),headers})).status,403);
  const template=(await f.api({input:f.input()})).data.template;for(const user of ['manager','admin']){assert.deepEqual((await f.api({user})).data.templates,[]);assert.equal((await f.api({user,input:f.preview(template)})).status,404);assert.equal((await f.api({user,input:f.input({templateId:template.id,expectedRevision:1})})).status,404);assert.equal((await f.api({user,input:{action:'delete',revision:f.row().revision,templateId:template.id,expectedRevision:1}})).status,404);}
  const customer=f.app.clientProjects.open(f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.row().revision}).invite);assert.equal((await f.api({user:null,headers:{Cookie:'synk_pulse_session='+customer.session}})).status,401);
});

test('HTTP preview flags missing agreed dates and message length while allowing explicit unsaved edits without writes',async t=>{
  const f=await fixture(t),row=f.row();row.dueDate='';row.intake={requestedDeadline:'2026-12-30'};f.app.store.put('clientProjects',row.id,row);const before=f.sources(),view=await f.api({input:f.preview(null,{body:'{{고객명}}님, {{합의한 전달일}}입니다.'})});assert.equal(view.status,200);assert.deepEqual(view.data.preview.missing,['{{합의한 전달일}}']);assert.equal(view.data.preview.ready,false);assert.doesNotMatch(view.data.preview.body,/2026-12-30/);
  const edited=await f.api({input:f.preview(null,{body:'{{고객명}}님, 전달일은 다시 협의하겠습니다.'})});assert.equal(edited.data.preview.ready,true);const long=await f.api({input:f.preview(null,{body:'가'.repeat(3001)})});assert.equal(long.status,200);assert.equal(long.data.preview.ready,false);assert.equal(long.data.preview.tooLong,true);assert.equal((await f.api({input:f.preview(null,{body:'가'.repeat(3001),target:'progress'})})).data.preview.ready,true);assert.equal(f.app.store.all('clientReplyTemplates').length,0);assert.deepEqual(f.sources(),before);
});

test('HTTP concurrent template updates accept one revision and deleted templates cannot be restored by stale clients',async t=>{
  const f=await fixture(t),template=(await f.api({input:f.input()})).data.template,before=f.sources(),results=await Promise.all(['first','second'].map(label=>f.api({input:f.input({templateId:template.id,expectedRevision:1,label})})));assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);assert.equal((await f.api({input:f.preview(template)})).status,409);const updated=results.find(row=>row.status===200).data.template;assert.equal((await f.api({input:f.preview(updated)})).status,200);
  const deleted=await f.api({input:{action:'delete',revision:f.row().revision,templateId:template.id,expectedRevision:2}});assert.equal(deleted.data.template.revision,3);assert.equal((await f.api({input:f.preview(updated)})).status,409);assert.equal((await f.api({input:f.input({templateId:template.id,expectedRevision:3})})).status,409);assert.deepEqual(f.sources(),before);
});

test('HTTP malformed oversized unsupported and URL-carried inputs fail without saving or searching private templates',async t=>{
  const f=await fixture(t),before=f.sources();for(const input of [f.input({body:'{{contact}}'}),f.input({body:'x'.repeat(6001)}),f.input({label:'x'.repeat(81)}),f.input({ownerId:f.users.admin.id}),f.input({action:'send'}),f.preview(null,{body:'안내',target:'customer'})])assert.equal((await f.api({input})).status,400);
  assert.equal((await f.api({input:f.input({revision:0})})).status,409);assert.equal((await f.api({input:f.input({body:'x'.repeat(50000)})})).status,413);assert.equal((await f.api({method:'PUT'})).status,405);assert.equal((await f.api({url:f.path+'?body=PRIVATE'})).status,400);assert.deepEqual(f.sources(),before);assert.equal(f.app.store.all('clientReplyTemplates').length,0);
  const escaped=await f.api({input:f.input({body:'"'.repeat(6000)})});assert.equal(escaped.status,200);assert.equal(escaped.data.template.body.length,6000);
  await f.api({input:f.input({body:'검색비공개문구 {{고객명}}'})});const search=await f.api({url:'/api/client-search',input:{query:'검색비공개문구'}});assert.equal(search.status,200);assert.equal(search.data.total,0);
});

test('HTTP save rechecks account role after receiving a partial body before storing any personal content',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),result=await f.slow(f.input(),()=>f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'}));assert.equal(result.status,403);assert.equal(f.app.store.all('clientReplyTemplates').length,0);assert.equal(JSON.stringify(f.row()),before);
});

test('HTTP preview rechecks revoked sessions after receiving its body without returning saved text',async t=>{
  const f=await fixture(t),template=(await f.api({input:f.input()})).data.template,before=f.sources(),result=await f.slow(f.preview(template),()=>f.app.store.revokeUser(f.users.owner.id));assert.equal(result.status,401);assert.doesNotMatch(JSON.stringify(result.data),/PRIVATE-HTTP-BODY/);assert.deepEqual(f.sources(),before);
});

test('HTTP project reassignment or source revision change invalidates a pending template preview',async t=>{
  const f=await fixture(t),template=(await f.api({input:f.input()})).data.template,original=f.row(),stored=JSON.stringify(f.app.store.all('clientReplyTemplates')),moved=await f.slow(f.preview(template),()=>f.app.store.put('clientProjects',f.id,{...original,ownerId:f.users.other.id,teamId:'b'}));assert.equal(moved.status,404);assert.equal((await f.api()).status,404);
  f.app.store.put('clientProjects',f.id,original);const changed=await f.slow(f.preview(template),()=>f.app.store.put('clientProjects',f.id,{...original,revision:original.revision+1,dueDate:'2026-11-03'}));assert.equal(changed.status,409);assert.equal((await f.api({input:f.preview(template)})).data.preview.body.endsWith('2026-11-03'),true);assert.equal(JSON.stringify(f.app.store.all('clientReplyTemplates')),stored);
});
