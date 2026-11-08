// 다국어 · 고객 전용 인물 판 1(2026-11-09, 기획 docs/마케팅/PULSE_의뢰흐름_20261104/다국어와_고객전용인물_기획_20261108.md 12절) — 서버를 띄워서 본다.
// 스위치(관리자 · CSRF · 감사, 응답에 실리는 값), 새 답 칸(옛 화면 · 새 화면), 90일 정리가 전용 인물 요청 프로젝트를 건너뛰고 인물 파일을 지우지 않는 것.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const answers=(extra={})=>({name:'합성 탄산수',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝난 20대',oneThing:'한 캔에 맛이 다섯 번',action:'buy',contactName:'김합성',email:'buyer@pulse-synthetic.test',consent:true,rights:true,...extra});
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-i18n-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const owner=app.store.createUser({name:'담당자',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},120);
  const member=app.store.createUser({name:'크루',email:'crew@pulse-synthetic.test',role:'member'}),memberToken=app.store.mint('session',member.id,{csrfToken:'crew-csrf'},120);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  function remember(response){for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}}
  const parse=async response=>{const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:response.status,data};};
  async function call(path,{body,raw,headers={},csrf=''}={}){
    const method=body===undefined&&raw===undefined?'GET':'POST';
    const response=await fetch(base+path,{method,headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});
    remember(response);return parse(response);
  }
  async function staff(path,{body,session=token,csrf='staff-csrf'}={}){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+session,...(csrf?{'X-CSRF-Token':csrf}:{}),Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    return parse(response);
  }
  const start=async()=>{const result=await call('/pulse/api/request/start',{body:{}});assert.equal(result.status,201,JSON.stringify(result.data));return result.data.draft;};
  const send=async(extra={})=>{jar.clear();const draft=await start();await call('/pulse/api/request/media',{raw:png,csrf:draft.csrf,headers:{'Content-Type':'image/png','X-File-Name':'front.png','X-Request-Slot':'front'}});const sent=await call('/pulse/api/request/submit',{body:{answers:answers(extra)},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));return sent.data;};
  return {app,options,call,staff,start,send,owner,memberToken,jar};
}

test('스위치는 기본이 끔이고, 손님 응답은 그 값을 싣는다(공개 의뢰서 · 프로젝트)',async t=>{
  const f=await fixture(t);
  const open=await f.call('/pulse/api/request');
  assert.equal(open.status,200);assert.deepEqual(open.data.features,{locales:['ko'],personaRequest:false,personaReal:false});
  const sent=await f.send({contactLocale:'en'});
  const room=await f.call('/pulse/api/project');
  assert.equal(room.status,200);
  assert.deepEqual(room.data.features,{locales:['ko'],locale:'ko',personaRequest:false,personaReal:false,myModels:false},'영어를 골랐어도 허락 전에는 한국어로 그린다');
  assert.equal(room.data.project.studio.request.answers.contactLocale,'en','고른 값은 그대로 남는다');
  // 초대 링크로 처음 열 때도 같은 값이 온다.
  f.jar.clear();const reopened=await f.call('/pulse/api/open',{body:{invite:sent.invite}});
  assert.equal(reopened.status,200,JSON.stringify(reopened.data));assert.equal(reopened.data.features.locale,'ko');
});

test('관리자만 스위치를 바꾸고, 바꿀 때마다 감사 기록이 남는다',async t=>{
  const f=await fixture(t);
  const read=await f.staff('/api/settings/pulse-features');
  assert.equal(read.status,200);assert.deepEqual({...read.data,updatedAt:null},{publicLocales:['ko'],projectLocales:['ko'],personaRequest:false,personaReal:false,myModels:false,updatedAt:null,updatedBy:null});
  assert.equal((await f.staff('/api/settings/pulse-features',{session:f.memberToken,csrf:'crew-csrf'})).status,403,'크루는 읽지도 못한다');
  assert.equal((await f.staff('/api/settings/pulse-features',{body:{projectLocales:['ko','en']},session:f.memberToken,csrf:'crew-csrf'})).status,403);
  assert.equal((await f.staff('/api/settings/pulse-features',{body:{projectLocales:['ko','en']},csrf:''})).status,403,'CSRF 없이는 못 바꾼다');
  for(const body of [{projectLocales:['ko','ja']},{projectLocales:['en']},{publicLocales:['ko','en']},{personaReal:true},{personaRequest:'yes'},{extra:true},{projectLocales:'ko'}]){
    const result=await f.staff('/api/settings/pulse-features',{body});assert.equal(result.status,400,JSON.stringify(body)+' '+JSON.stringify(result.data));
  }
  assert.equal(f.app.store.all('audit').filter(row=>row.action==='pulse-features-settings').length,0,'거절된 변경은 기록하지 않는다');
  const changed=await f.staff('/api/settings/pulse-features',{body:{projectLocales:['en','ko','en']}});
  assert.equal(changed.status,200,JSON.stringify(changed.data));assert.deepEqual(changed.data.projectLocales,['ko','en'],'겹친 값은 하나로, 한국어가 맨 앞');
  assert.equal(changed.data.updatedBy,f.owner.id);
  const audit=f.app.store.all('audit').filter(row=>row.action==='pulse-features-settings');
  assert.equal(audit.length,1);assert.deepEqual(audit[0].projectLocales,['ko','en']);assert.equal(audit[0].userId,f.owner.id);
  // 영어 시험 길: 공개 메뉴는 그대로 한국어, 영어로 고른 프로젝트만 영어로 그린다.
  await f.send({contactLocale:'en'});
  const room=await f.call('/pulse/api/project');
  assert.deepEqual(room.data.features,{locales:['ko','en'],locale:'en',personaRequest:false,personaReal:false,myModels:false});
  assert.deepEqual((await f.call('/pulse/api/request')).data.features.locales,['ko']);
  assert.equal((await f.staff('/api/settings/pulse-features',{body:{publicLocales:['ko','en'],personaRequest:true,personaReal:true}})).status,200);
  assert.deepEqual((await f.call('/pulse/api/request')).data.features,{locales:['ko','en'],personaRequest:true,personaReal:true});
});

test('저장된 스위치 문서가 이상하면 끈 쪽으로 읽는다',async t=>{
  const f=await fixture(t);
  f.app.store.put('pulseFeatureSettings','main',{publicLocales:['ko','en'],projectLocales:['ko'],personaRequest:'true',personaReal:true,myModels:1});
  assert.deepEqual((await f.call('/pulse/api/request')).data.features,{locales:['ko'],personaRequest:false,personaReal:false},'공개 메뉴가 프로젝트 언어 밖이면 한국어만, 참 · 거짓이 아니면 끔');
  f.app.store.put('pulseFeatureSettings','main',{projectLocales:['ja','ko']});
  assert.deepEqual((await f.staff('/api/settings/pulse-features')).data.projectLocales,['ko']);
});

test('새 답 칸: 옛 화면은 안 보내도 되고, 새 화면의 값은 접수까지 그대로 가며, 틀린 값은 저장부터 막는다',async t=>{
  const f=await fixture(t);
  const draft=await f.start();
  assert.deepEqual([draft.answers.hair,draft.answers.contactLocale,draft.answers.outputLocales,draft.answers.targetMarket,draft.answers.quoteCurrency],['',  '',[],[],''],'새 초안의 빈 값');
  const old={...answers()};
  const saved=await f.call('/pulse/api/request/save',{body:{answers:old,step:'what'},csrf:draft.csrf});
  assert.equal(saved.status,200,'옛 화면(새 칸 없음)');
  const fresh=await f.call('/pulse/api/request/save',{body:{answers:{...old,models:['F02'],hair:'look-2',contactLocale:'en',outputLocales:['en','ko'],targetMarket:['US','JP'],quoteCurrency:'USD',modelChoice:''},step:'model'},csrf:draft.csrf});
  assert.equal(fresh.status,200,JSON.stringify(fresh.data));
  assert.deepEqual(fresh.data.draft.answers.outputLocales,['en','ko']);
  for(const bad of [{contactLocale:'fr'},{outputLocales:['de']},{targetMarket:['kor']},{targetMarket:['us']},{quoteCurrency:'GBP'},{hair:'look-4'},{modelChoice:'추천'}]){
    const result=await f.call('/pulse/api/request/save',{body:{answers:{...old,...bad},step:'model'},csrf:draft.csrf});
    assert.equal(result.status,400,JSON.stringify(bad));
  }
  for(const modelChoice of ['custom','persona'])assert.equal((await f.call('/pulse/api/request/save',{body:{answers:{...old,modelChoice},step:'model'},csrf:draft.csrf})).status,200,modelChoice);
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:{...old,models:['F02'],hair:'look-2',contactLocale:'en',targetMarket:['US']}},csrf:draft.csrf});
  assert.equal(sent.status,201,JSON.stringify(sent.data));
  const request=f.app.store.get('clientProjects',sent.data.projectId).studio.request;
  assert.equal(request.answers.hair,'look-2');assert.equal(request.answers.contactLocale,'en');assert.deepEqual(request.answers.targetMarket,['US']);
});

test('주소 오류는 칸마다 고정 문장이고, 손님 파일 이름이 끼는 오류만 코드가 붙어 내려간다',async t=>{
  const f=await fixture(t);
  const draft=await f.start();
  const bad=await f.call('/pulse/api/request/submit',{body:{answers:answers({pageUrl:'javascript:alert(1)'})},csrf:draft.csrf});
  assert.equal(bad.status,400);assert.equal(bad.data.error,'제품 페이지 주소를 확인해 주세요.');assert.equal(bad.data.code,undefined);
  const drive=await f.call('/pulse/api/request/submit',{body:{answers:answers({driveUrl:'http://user:pw@example.com'})},csrf:draft.csrf});
  assert.equal(drive.data.error,'드라이브 주소를 확인해 주세요.');
  // 올린 파일이 두 폴더 어디에도 없으면 파일 이름이 든 문장 + 코드.
  const up=await f.call('/pulse/api/request/media',{raw:png,csrf:draft.csrf,headers:{'Content-Type':'image/png','X-File-Name':'front.png','X-Request-Slot':'front'}});
  assert.equal(up.status,201);
  for(const folder of ['pulse-request-media','studio-media'])for(const name of await readdir(join(f.options.dataDir,folder)).catch(()=>[]))await rm(join(f.options.dataDir,folder,name),{force:true});
  const missing=await f.call('/pulse/api/request/submit',{body:{answers:answers()},csrf:draft.csrf});
  assert.equal(missing.status,409);assert.equal(missing.data.error,'「front.png」 파일을 찾지 못했어요. 지우고 다시 올려 주세요.');assert.equal(missing.data.code,'SYNK_PULSE_FILE_MISSING');
});

test('90일 정리는 전용 인물 검토가 열린 프로젝트를 건너뛰고, 인물 문서가 가진 파일은 지우지 않는다',async t=>{
  const f=await fixture(t),{store}=f.app,old=new Date(Date.now()-91*86400000).toISOString();
  const open=(await f.send()).projectId,done=(await f.send()).projectId;
  for(const id of [open,done])store.put('clientProjects',id,{...store.get('clientProjects',id),updatedAt:old});
  // 검토 중 인물 하나(열림), 쓸 수 있게 된 인물 하나(끝남 — 그 프로젝트는 정리된다). 끝난 쪽 판의 파일은 프로젝트 자산과 이름이 같다.
  const doneRow=store.get('clientProjects',done),shared=doneRow.studio.assets[0].diskName;
  const personaOpen=randomUUID(),personaDone=randomUUID(),revision=randomUUID();
  store.put('pulsePersonas',personaOpen,{id:personaOpen,originProjectId:open,workspaceId:null,kind:'virtual',status:'reviewing'});
  store.put('pulsePersonas',personaDone,{id:personaDone,originProjectId:done,workspaceId:null,kind:'virtual',status:'ready'});
  store.put('pulsePersonaRevisions',revision,{id:revision,personaId:personaDone,revision:1,status:'published',assets:[{id:randomUUID(),diskName:shared,mimeType:'image/png'}]});
  const before=(await readdir(join(f.options.dataDir,'studio-media'))).length;
  f.jar.clear();await f.start();
  assert.deepEqual(await f.app.pulseRequests.retireUnconfirmed(),{retired:1});
  assert.equal(store.get('clientProjects',open).stage,'received','열린 인물 검토가 있는 프로젝트는 그대로');
  const gone=store.get('clientProjects',done);
  assert.equal(gone.stage,'archived');assert.equal(gone.studio.request.status,'retired');
  const after=await readdir(join(f.options.dataDir,'studio-media'));
  assert.equal(after.length,before,'인물 판이 가진 파일은 프로젝트가 정리돼도 남는다');assert.ok(after.includes(shared));
});
