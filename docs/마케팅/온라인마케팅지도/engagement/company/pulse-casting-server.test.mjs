import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCompanyApp} from './server.mjs';
import {emptyCastingSelection} from './pulse-strategy.mjs';

const companyDir=dirname(fileURLToPath(import.meta.url));
const projectDraft={title:'합성 모델 선택 시험',customerName:'합성 고객',contact:'SYNTHETIC-PRIVATE-CONTACT',summary:'캐스팅 API 시험',terms:'합성 합의',internalNotes:'SYNTHETIC-PRIVATE-STAFF',nextStep:'모델 선택',dueDate:'2026-12-01',nextContactDate:''};
const strategyDraft={objective:'brand',product:'합성 제품',audience:'합성 고객',channels:['instagram'],primaryPromise:'오래 쓰는 제품',value1:'편안함',evidence1:'합성 내구성 시험 장면',value2:'튼튼함',memoryHook:'제품 이름',desiredAction:'자세히 보기'};
const selection={modelId:'F01',hair:'wave',makeup:'natural',jacket:'blazer',top:'shirt',bottom:'trousers',voice:'B',earrings:'stud',ring:'simple',notes:'밝은 분위기'};

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-casting-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null};
  let app,base;
  async function start(){app=createCompanyApp(options);const address=await app.start();base='http://127.0.0.1:'+address.port;}
  t.after(async()=>{if(app)await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.match(directory,/synk-pulse-casting-/);await rm(directory,{recursive:true,force:true});});
  await start();
  const owner=app.store.createUser({name:'합성 담당자',email:'owner@pulse-casting-synthetic.test',role:'member',teamId:'a'});
  const token=app.store.mint('session',owner.id,{csrfToken:'casting-staff-csrf'},10);
  async function request(path,{body,customer=null,anonymous=false}={}){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(customer?{Cookie:customer.cookie}:anonymous?{}:{Cookie:'synk_company_session='+token}),...(body===undefined?{}:{Origin:app.origin,'Content-Type':'application/json',...(customer?{'X-Pulse-CSRF':customer.csrf}:{'X-CSRF-Token':'casting-staff-csrf'})})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const bytes=Buffer.from(await response.arrayBuffer()),text=bytes.toString('utf8');return {status:response.status,headers:response.headers,bytes,text,data:response.headers.get('content-type')?.startsWith('application/json')&&text?JSON.parse(text):null};
  }
  async function create(){const result=await request('/api/client-projects',{body:projectDraft});assert.equal(result.status,201,result.text);return result.data.project;}
  async function invite(row){
    const issued=await request('/api/client-projects/'+row.id+'/invite',{body:{revision:row.revision}});assert.equal(issued.status,200,issued.text);
    const opened=await request('/pulse/api/open',{anonymous:true,body:{invite:issued.data.invite}});assert.equal(opened.status,200,opened.text);
    return {cookie:opened.headers.get('set-cookie').split(';')[0],csrf:opened.data.csrf,project:opened.data.project};
  }
  const studio=(row,body)=>request('/api/client-projects/'+row.id+'/studio',{body:{revision:row.revision,...body}});
  const customerStudio=(customer,row,body)=>request('/pulse/api/studio',{customer,body:{revision:row.revision,...body}});
  return {get app(){return app;},request,create,invite,studio,customerStudio,async restart(){await app.stop();await start();}};
}

test('customer casting saves reach staff, persist after restart, invalidate confirmation and preserve reviewed history',async t=>{
  const f=await fixture(t);const created=await f.create(),customer=await f.invite(created);let row=customer.project;
  assert.deepEqual(row.studio.strategy.data.castingSelection,emptyCastingSelection());
  let result=await f.customerStudio(customer,row,{action:'save_strategy',strategy:{...strategyDraft,castingSelection:selection}});
  assert.equal(result.status,200,result.text);row=result.data.project;
  assert.equal(row.studio.strategy.revision,1);assert.equal(row.studio.strategy.author,'customer');assert.deepEqual(row.studio.strategy.data.castingSelection,selection);
  let staff=await f.request('/api/client-projects/'+row.id+'/studio');assert.equal(staff.status,200,staff.text);assert.deepEqual(staff.data.project.studio.strategy,row.studio.strategy);
  result=await f.studio(row,{action:'request_strategy_review'});assert.equal(result.status,200,result.text);row=result.data.project;
  result=await f.customerStudio(customer,row,{action:'confirm_strategy',strategyRevision:1});assert.equal(result.status,200,result.text);row=result.data.project;
  assert.equal(row.studio.strategy.confirmation.strategyRevision,1);
  await f.restart();
  result=await f.request('/pulse/api/project',{customer});assert.equal(result.status,200,result.text);assert.deepEqual(result.data.project.studio.strategy,row.studio.strategy);row=result.data.project;
  const changed={...selection,modelId:'M02',voice:'C',hair:'short',earrings:'none',notes:'두 번째 선택'};
  result=await f.customerStudio(customer,row,{action:'save_strategy',strategy:{...strategyDraft,castingSelection:changed}});assert.equal(result.status,200,result.text);row=result.data.project;
  const strategy=row.studio.strategy;
  assert.equal(strategy.revision,2);assert.equal(strategy.request,null);assert.equal(strategy.confirmation,null);assert.deepEqual(strategy.data.castingSelection,changed);
  assert.deepEqual(strategy.history[0].data.castingSelection,selection);assert.equal(strategy.history[0].confirmation.strategyRevision,1);
  staff=await f.request('/api/client-projects/'+row.id+'/studio');assert.equal(staff.status,200,staff.text);assert.deepEqual(staff.data.project.studio.strategy,strategy);
  result=await f.studio(row,{action:'request_strategy_review'});assert.equal(result.status,200,result.text);row=result.data.project;
  assert.equal((await f.customerStudio(customer,row,{action:'confirm_strategy',strategyRevision:1})).status,409);
  result=await f.customerStudio(customer,row,{action:'confirm_strategy',strategyRevision:2});assert.equal(result.status,200,result.text);row=result.data.project;
  const beforeInvalid=structuredClone(row);
  for(const castingSelection of [{...changed,modelId:'UNKNOWN'},{...changed,voice:'D'},{...changed,modelId:''},{...changed,privateUrl:'https://example.test/private'},{...changed,notes:{private:'hidden'}}]){
    result=await f.customerStudio(customer,row,{action:'save_strategy',strategy:{...strategyDraft,castingSelection}});assert.equal(result.status,400,result.text);
  }
  result=await f.request('/pulse/api/project',{customer});assert.equal(result.status,200,result.text);assert.deepEqual(result.data.project,beforeInvalid,'invalid nested payloads never partially write');
  result=await f.studio(row,{action:'save_strategy',strategy:{...strategyDraft,product:'이전 클라이언트 저장'}});assert.equal(result.status,200,result.text);row=result.data.project;
  assert.deepEqual(row.studio.strategy.data.castingSelection,changed,'old forms preserve casting');assert.equal(row.studio.strategy.confirmation,null);
  assert.equal(row.studio.strategy.history.at(-1).confirmation.strategyRevision,2);
  result=await f.customerStudio(customer,row,{action:'save_strategy',strategy:{...strategyDraft,castingSelection:emptyCastingSelection()}});assert.equal(result.status,200,result.text);row=result.data.project;
  assert.deepEqual(row.studio.strategy.data.castingSelection,emptyCastingSelection());assert.deepEqual(row.studio.strategy.history.at(-1).data.castingSelection,changed);
  assert.doesNotMatch(JSON.stringify(row),/SYNTHETIC-PRIVATE|authorId|inviteHash|privateUrl|diskName/);
});

test('server serves casting modules, stylesheet and all six prepared portraits without authentication',async t=>{
  const f=await fixture(t);
  const files=[['casting-view.mjs','text/javascript'],['casting-catalog.mjs','text/javascript'],['casting.css','text/css'],...['m01','f01','f02','f03','m02','m03'].map(id=>['assets/casting/'+id+'.webp','image/webp'])];
  for(const [file,type]of files){
    const result=await f.request('/pulse-app/'+file,{anonymous:true});
    assert.equal(result.status,200,file+': '+result.status);assert.ok(result.headers.get('content-type')?.startsWith(type),file+' content type');
    const source=await readFile(join(companyDir,'public','pulse-app',file));assert.deepEqual(result.bytes,source,file+' exact served contents');assert.ok(result.bytes.length>0,file+' is not empty');
    if(type==='image/webp'){assert.equal(result.bytes.subarray(0,4).toString(),'RIFF');assert.equal(result.bytes.subarray(8,12).toString(),'WEBP');}
  }
});
