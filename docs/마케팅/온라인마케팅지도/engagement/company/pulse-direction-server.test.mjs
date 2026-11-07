import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {fixtureClip} from './pulse-production-fixture.mjs';

// 영상 전 확인 1/3 「방향과 모델」(2026-11-07, docs/마케팅/PULSE_의뢰흐름_20261104/판1_설계.md 1b): 서버가 지키는 약속.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const answers=(extra={})=>({name:'오미톡 오미자 스파클링',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝나고 목마른 20대',oneThing:'한 캔에 맛이 다섯 번 바뀐다',action:'buy',screenText:'다섯 가지 맛, 톡.',avoid:[],win:'story',refs:[],models:[],modelChoice:'ask',date:'',dateFree:true,approver:'one',contactName:'김합성',company:'합성 음료',email:'buyer@pulse-synthetic.test',phone:'',consent:true,rights:true,slots:{},...extra});
const kstToday=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const dayAfter=days=>{const at=new Date(kstToday()+'T00:00:00Z');at.setUTCDate(at.getUTCDate()+days);return at.toISOString().slice(0,10);};
// 120일 안에 있어야 할 「없는 날」(31일이 없는 달의 31일) — 과거 · 범위 밖 이유로 거절되면 날짜 왕복 검사를 지키지 못한다(GPT GA1 11-07).
const missingDay=()=>{const [y,m]=kstToday().split('-').map(Number);for(let k=0;k<4;k++){const at=new Date(Date.UTC(y,m-1+k,1)),yy=at.getUTCFullYear(),mm=at.getUTCMonth();if(new Date(Date.UTC(yy,mm+1,0)).getUTCDate()<31)return `${yy}-${String(mm+1).padStart(2,'0')}-31`;}throw new Error('없는 날을 못 찾음');};
async function fixture(t,extra={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-direction-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const owner=app.store.createUser({name:'담당자',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},120);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  const remember=response=>{for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}};
  const parse=async response=>{const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:response.status,data,bytes};};
  async function call(path,{body,raw,headers={},csrf=''}={}){const response=await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});remember(response);return parse(response);}
  async function staff(path,{body,raw,headers={}}={}){return parse(await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))}));}
  return {app,call,staff};
}
// 의뢰를 넣고 확인까지 마친 프로젝트 하나와, 직원 · 고객 액션 손잡이.
async function confirmed(t,extra={}){
  const f=await fixture(t);
  const draft=(await f.call('/pulse/api/request/start',{body:{}})).data.draft;
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:answers(extra)},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
  const id=sent.data.projectId;let row=(await f.staff('/api/client-projects/'+id+'/studio')).data.project;
  const staffTry=body=>f.staff('/api/client-projects/'+id+'/studio',{body:{revision:row.revision,...body}}).then(result=>{if(result.status===200)row=result.data.project;return result;});
  const act=async body=>{const result=await staffTry(body);assert.equal(result.status,200,JSON.stringify(result.data));return row;};
  const upload=async(name,type,bytes)=>{const result=await f.staff(`/api/client-projects/${id}/studio/media`,{raw:bytes,headers:{'Content-Type':type,'X-File-Name':encodeURIComponent(name),'X-Project-Revision':String(row.revision)}});assert.equal(result.status,201,JSON.stringify(result.data));row=result.data.project;return result.data.asset.id;};
  let room=null;const croom=async()=>{room=(await f.call('/pulse/api/project')).data;return room;};
  const customerTry=async body=>{await croom();const result=await f.call('/pulse/api/studio',{body:{revision:room.project.revision,...body},csrf:room.csrf});if(result.status===200)room=result.data;return result;};
  const cact=async body=>{const result=await customerTry(body);assert.equal(result.status,200,JSON.stringify(result.data));return room;};
  await act({action:'request_confirm'});
  return {f,id,act,staffTry,upload,croom,cact,customerTry,get row(){return row;},refresh:async()=>{row=(await f.staff('/api/client-projects/'+id+'/studio')).data.project;return row;}};
}
const option=(assetId,extra={})=>({name:'아니, 잠깐',sentence:'맛을 설명하려다 말을 다섯 번 바꿔요.',flow:[{at:'0:00',text:'경기가 끝나고 친구 폰 앞'},{at:'0:03',text:'한 모금마다 말이 바뀌어요'},{at:'0:11',text:'친구가 뺏어 마셔요'}],why:'「다섯 가지 맛」이 대사로 풀려요.',assetId,recommended:true,...extra});
async function proposal(h,extra={}){
  const a=await h.upload('wait.png','image/png',png),b=await h.upload('tok.png','image/png',png);
  return {lead:'저녁 농구장과 한결은 요청하신 대로 두고, 무엇으로 기억에 남길지만 두 방향으로 나눴어요.',options:[option(a),option(b,{name:'톡',sentence:'캔 따는 소리 한 번에 코트 전체가 멈춰요.',recommended:false})],modelId:'M06',price:390000,dueDate:dayAfter(10),revisions:2,...extra,assets:[a,b]};
}
const send=async(h,body)=>{const {assets,...rest}=body;return h.act({action:'propose_direction',...rest});};

test('a direction proposal goes out only after the request is confirmed, with two or three options, one recommendation and pictures from this project',async t=>{
  const f=await fixture(t),draft=(await f.call('/pulse/api/request/start',{body:{}})).data.draft;
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:answers()},csrf:draft.csrf}),id=sent.data.projectId;
  let row=(await f.staff('/api/client-projects/'+id+'/studio')).data.project;
  const early=await f.staff('/api/client-projects/'+id+'/studio',{body:{revision:row.revision,action:'propose_direction',options:[],modelId:'M06',price:390000,dueDate:dayAfter(10),revisions:2}});
  assert.equal(early.status,409,'not before the request is confirmed');
  const h=await confirmed(t),body=await proposal(h),{assets,...base}=body;
  const bad=async(patch,status=400)=>{const result=await h.staffTry({action:'propose_direction',...base,...patch});assert.equal(result.status,status,JSON.stringify(patch).slice(0,80)+' '+JSON.stringify(result.data));};
  await bad({options:[base.options[0]]});
  await bad({options:[...base.options,{...base.options[1],name:'셋'},{...base.options[1],name:'넷'}]});
  await bad({options:[base.options[0],{...base.options[1],recommended:true}]});
  await bad({options:[base.options[0],{...base.options[1],name:'아니, 잠깐'}]});
  await bad({options:[base.options[0],{...base.options[1],assetId:'nope'}]});
  await bad({options:[base.options[0],{...base.options[1],flow:[{at:'처음',text:'틀린 시각'}]}]});
  await bad({modelId:'Z99'});await bad({modelId:''});
  await bad({price:5000});await bad({price:'390000'});await bad({revisions:12});
  await bad({dueDate:dayAfter(-1)});await bad({dueDate:dayAfter(121)});assert.ok(missingDay()>kstToday()&&missingDay()<dayAfter(121));await bad({dueDate:missingDay()});
  const clip=await h.upload('taste.mp4','video/mp4',fixtureClip());
  await bad({options:[base.options[0],{...base.options[1],filmAssetId:assets[0]}]});
  await send(h,{...base,options:[base.options[0],{...base.options[1],filmAssetId:clip,filmNote:'멈춘 코트에서 도망치기까지 · 8초',workId:'maejin-imbak'}]});
  const d=h.row.studio.request.directionProposal;
  assert.equal(d.status,'open');assert.equal(d.round,1);assert.equal(d.options.length,2);assert.equal(d.options[1].filmAssetId,clip);assert.equal(d.options[1].workId,'maejin-imbak');
  assert.equal(h.row.stage,'received');
  // 고객은 답할 수만 있고, 직원 액션은 못 한다.
  const room=await h.croom();assert.equal(room.project.studio.request.directionProposal.options.length,2);
  assert.equal((await h.customerTry({action:'propose_direction',...base})).status,403);
  assert.equal((await h.staffTry({action:'answer_direction',optionId:d.options[0].id})).status,403);
});
test('the customer sees only the pictures and samples of the proposal on the table, through the customer media path',async t=>{
  const h=await confirmed(t),body=await proposal(h),{assets,...base}=body;
  const hidden=await h.upload('draft-work.png','image/png',png);
  const room0=await h.croom();assert.equal(room0.project.studio.assets.some(asset=>assets.includes(asset.id)),false,'before sending, staff pictures stay hidden');
  assert.equal((await h.f.call('/pulse/api/studio/media/'+assets[0])).status,404);
  const clip=await h.upload('taste.mp4','video/mp4',fixtureClip());
  await send(h,{...base,options:[base.options[0],{...base.options[1],filmAssetId:clip}]});
  const room=await h.croom(),ids=room.project.studio.assets.map(asset=>asset.id);
  for(const id of [...assets,clip])assert.ok(ids.includes(id),id);
  assert.equal(ids.includes(hidden),false);
  assert.equal((await h.f.call('/pulse/api/studio/media/'+assets[1])).status,200);
  assert.equal((await h.f.call('/pulse/api/studio/media/'+clip)).status,200);
  // 고치기 전 판(열린 제안)을 갈아 끼우면 새 안 id가 나오고, 빠진 그림은 다시 숨는다.
  const fresh=await h.upload('tok-2.png','image/png',png),old=h.row.studio.request.directionProposal.options.map(item=>item.id);
  await send(h,{...base,options:[base.options[0],{...base.options[1],assetId:fresh}]});
  const swapped=h.row.studio.request.directionProposal;
  assert.equal(swapped.round,1,'fixing an open proposal keeps the round');
  assert.equal(swapped.options.some(item=>old.includes(item.id)),false,'option ids are new each time');
  assert.equal((await h.f.call('/pulse/api/studio/media/'+assets[1])).status,404,'the replaced picture is hidden again');
  assert.equal((await h.customerTry({action:'answer_direction',optionId:old[0]})).status,409,'a stale screen cannot pick an option that is gone');
});
test('picking moves the model into the request and the production plan, can change until the script arrives, and opens the first draft',async t=>{
  const h=await confirmed(t),body=await proposal(h),{assets,...base}=body;
  await send(h,base);
  const d=h.row.studio.request.directionProposal;
  await h.act({action:'save_scene',title:'컷 1',description:'벤치 위 캔',narration:'',screenText:'',duration:3,visibility:'customer'});
  assert.equal((await h.staffTry({action:'send_draft',oneLine:'맛을 설명하려다 말을 다섯 번 바꿔요.',note:''})).status,409,'no script before a direction is picked');
  await h.cact({action:'answer_direction',optionId:d.options[1].id,note:'「쌉쌀」은 빼 주세요'});
  let r=(await h.refresh()).studio.request;
  assert.equal(r.directionProposal.status,'chosen');assert.equal(r.directionProposal.chosenId,d.options[1].id);assert.equal(r.directionProposal.answer,'「쌉쌀」은 빼 주세요');
  assert.deepEqual(r.answers.models,['M06']);assert.equal(r.answers.modelChoice,'');
  assert.equal(h.row.studio.strategy.data.castingSelection.modelId,'M06');
  await h.cact({action:'answer_direction',optionId:d.options[0].id,modelId:'F02'});
  r=(await h.refresh()).studio.request;
  assert.equal(r.directionProposal.chosenId,d.options[0].id,'the customer can pick again before the script');
  assert.deepEqual(r.answers.models,['F02']);assert.equal(h.row.studio.strategy.data.castingSelection.modelId,'F02');
  assert.equal((await h.staffTry({action:'propose_direction',...base})).status,409,'a picked direction is not re-proposed');
  await h.act({action:'send_draft',oneLine:'맛을 설명하려다 말을 다섯 번 바꿔요.',note:''});
  assert.equal((await h.customerTry({action:'answer_direction',optionId:d.options[1].id})).status,409,'after the script the direction is fixed');
  assert.equal((await h.staffTry({action:'propose_direction',...base})).status,409);
});
test('「neither」 asks for one line, allows one more round, and after the second no the desk settles what was agreed in person',async t=>{
  const h=await confirmed(t),body=await proposal(h),{assets,...base}=body;
  await send(h,base);
  assert.equal((await h.customerTry({action:'answer_direction',neither:true,note:''})).status,400);
  await h.cact({action:'answer_direction',neither:true,note:'더 고급스러웠으면 좋겠어요'});
  let d=(await h.refresh()).studio.request.directionProposal;
  assert.equal(d.status,'declined');assert.equal(d.answer,'더 고급스러웠으면 좋겠어요');
  assert.equal((await h.staffTry({action:'settle_direction',optionId:d.options[0].id,note:'x'})).status,409,'settling is only after the second no');
  await send(h,base);
  d=h.row.studio.request.directionProposal;
  assert.equal(d.round,2);assert.deepEqual(d.prior,{round:1,names:['아니, 잠깐','톡'],answer:'더 고급스러웠으면 좋겠어요'});
  await h.cact({action:'answer_direction',neither:true,note:'둘 다 아직이에요'});
  assert.equal((await h.staffTry({action:'propose_direction',...base})).status,409,'only one more proposal');
  d=(await h.refresh()).studio.request.directionProposal;
  await h.act({action:'save_scene',title:'컷 1',description:'벤치 위 캔',narration:'',screenText:'',duration:3,visibility:'customer'});
  assert.equal((await h.staffTry({action:'send_draft',oneLine:'한 줄',note:''})).status,409,'still blocked until settled');
  assert.equal((await h.staffTry({action:'settle_direction',optionId:d.options[1].id,note:''})).status,400);
  await h.act({action:'settle_direction',optionId:d.options[1].id,note:'통화로 「톡」에서 도망 장면을 빼기로'});
  const r=h.row.studio.request;
  assert.equal(r.directionProposal.status,'settled');assert.equal(r.directionProposal.settledBy,'담당자');assert.deepEqual(r.answers.models,['M06']);
  await h.act({action:'send_draft',oneLine:'캔 따는 소리 한 번에 코트 전체가 멈춰요.',note:''});
  assert.equal(h.row.studio.request.rounds.length,1);
});
test('requests without a person skip the model, photo orders take no direction, and an open model proposal is closed by the direction',async t=>{
  const none=await confirmed(t,{modelChoice:'none'}),body=await proposal(none),{assets,modelId,...base}=body;
  await send(none,base);
  assert.equal(none.row.studio.request.directionProposal.modelId,undefined);
  const d=none.row.studio.request.directionProposal;
  await none.cact({action:'answer_direction',optionId:d.options[0].id});
  const r=(await none.refresh()).studio.request;
  assert.equal(r.answers.modelChoice,'none','a no-person request stays that way');assert.deepEqual(r.answers.models,[]);
  const photo=await confirmed(t,{package:'photo'}),photoBody=await proposal(photo),{assets:photoAssets,...photoBase}=photoBody;
  assert.equal((await photo.staffTry({action:'propose_direction',...photoBase})).status,409);
  const old=await confirmed(t),oldBody=await proposal(old),{assets:oldAssets,...oldBase}=oldBody;
  await old.act({action:'propose_model',modelId:'M06',note:''});
  await send(old,oldBase);
  assert.equal(old.row.studio.request.modelProposal.status,'replaced');
});
test('old projects with an open model proposal keep the old path',async t=>{
  const h=await confirmed(t);
  await h.act({action:'propose_model',modelId:'M06',note:'농구장에 어울려요'});
  await h.cact({action:'answer_model',accept:true});
  await h.refresh();
  await h.act({action:'save_scene',title:'컷 1',description:'벤치 위 캔',narration:'',screenText:'',duration:3,visibility:'customer'});
  await h.act({action:'send_draft',oneLine:'한 줄',note:''});
  assert.equal(h.row.studio.request.rounds.length,1);
  assert.equal(h.row.studio.request.directionProposal,undefined);
});
