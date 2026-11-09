// 다국어 판 2(2026-11-09, 기획 docs/마케팅/PULSE_의뢰흐름_20261104/다국어와_고객전용인물_기획_20261108.md 12-2) — 서버 쪽.
// 서버가 만드는 손님 문구(알림 · 단계 · 메일)를 프로젝트 언어로, 담당자 글 번역 지도(보내기 막기 · 손님 보기 치환 · 낡음), 자동 안내 막기, 빈 contactLocale(Fable F1).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {SERVER_DICTIONARIES,serverText,staffDisplayName,createStaffNames} from './pulse-locale.mjs';
import {clientNotificationTitle} from './client-notifications.mjs';
import {groupCustomerNotifications} from './pulse-live.mjs';
import {pulseMailCompose,PULSE_MAIL_MOMENTS} from './pulse-mail.mjs';
import {CLIENT_STAGES} from './client-projects.mjs';
import {applyRequestAction,emptyRequestAnswers} from './pulse-requests.mjs';
import {emptyPulseStudio} from './pulse-studio.mjs';
import {localizeCustomerProject,staffSources,freshTranslation,sourceHash,translationStaffView} from './pulse-translations.mjs';
import {createPulseAutoReplyService} from './pulse-auto-reply.mjs';
import {readPulseFeatures,createPulseFeatures} from './pulse-features.mjs';
import {createCompanyApp} from './server.mjs';

const EN=SERVER_DICTIONARIES.en;
const CUSTOMER_TYPES=['request_asked','model_proposed','direction_proposed','draft_ready','preview_ready','final_ready','staff_reply','auto_reply','strategy_ready','concept_ready','scene_ready','reference_ready','deliverables_ready','feedback_classified','kickoff_updated','scene_review_ready','preview_review_ready'];

test('서버 손님 문구: 한국어는 그대로, 영어는 사전에 빠짐없이, 사전의 키는 모두 서버 코드에 있다',()=>{
  for(const type of CUSTOMER_TYPES){
    const ko=clientNotificationTitle(type,null,'ko');assert.equal(clientNotificationTitle(type),ko,type+' 기본은 한국어');
    assert.ok(Object.hasOwn(EN,ko),type+' 제목 영어: '+ko);assert.notEqual(clientNotificationTitle(type,null,'en'),ko);
  }
  for(const revision of [1,2])for(const type of ['concept_ready','scene_ready'])assert.ok(Object.hasOwn(EN,clientNotificationTitle(type,{cardRevision:revision})));
  for(const label of Object.values(CLIENT_STAGES))assert.ok(Object.hasOwn(EN,label),'단계 '+label);
  const live=readFileSync(new URL('./pulse-live.mjs',import.meta.url),'utf8');
  const bodies=[...live.matchAll(/const customerBodies=\{([^\n]*)\};/g)][0][1];
  for(const [,text]of bodies.matchAll(/:'([^']+)'/g))assert.ok(Object.hasOwn(EN,text),'본문 영어: '+text);
  // 죽은 키 0: 서버 사전의 한국어 문장은 서버 코드 어딘가에 따옴표 문자열로 있다.
  const sources=['pulse-live.mjs','client-notifications.mjs','pulse-mail.mjs','client-projects.mjs'].map(name=>readFileSync(new URL('./'+name,import.meta.url),'utf8')).join('\n');
  // pulse-locale.mjs가 스스로 쓰는 키(담당자 · 다른 직원 표시 이름)는 사전 파일 밖에 따옴표로 없다.
  const SELF=['PULSE 담당자','PULSE 팀'],dead=Object.keys(EN).filter(key=>!SELF.includes(key)&&!sources.includes(`'${key}'`));
  assert.deepEqual(dead,[],'서버 코드에 없는 서버 사전 키');
  assert.equal(serverText('ko','{who}님, SYNK PULSE입니다.',{who:'김하나'}),'김하나님, SYNK PULSE입니다.');
  assert.equal(serverText('ja','접수'),'접수','사전 없는 언어는 원문');
  assert.equal(staffDisplayName('ko',{name:'유호'},'유호'),'유호');assert.equal(staffDisplayName('en',{name:'유호'},'유호'),'Your producer');assert.equal(staffDisplayName('en',{name:'유호',nameEn:'Yuho'},'유호'),'Yuho');
});

test('앱 안 알림함의 묶은 제목: 한국어 글자는 판 1과 같고 영어는 복수형',()=>{
  const items=(type,revs)=>revs.map((rev,i)=>({id:'n'+i,type,unread:true,cardRevision:rev,conceptId:'c'+i}));
  assert.equal(groupCustomerNotifications(items('concept_ready',[1,1,1]))[0].title,'새 콘셉트 3개가 도착했어요');
  assert.equal(groupCustomerNotifications(items('concept_ready',[2,2]))[0].title,'콘셉트 2개가 바뀌었어요');
  assert.equal(groupCustomerNotifications(items('concept_ready',[1,2,2]))[0].title,'새 콘셉트 1개 · 바뀐 콘셉트 2개');
  assert.equal(groupCustomerNotifications([{id:'a',type:'reference_ready',unread:true},{id:'b',type:'reference_ready',unread:true}])[0].title,'참고 자료가 바뀌었어요 · 2건');
  assert.equal(groupCustomerNotifications(items('concept_ready',[1,1,1]),'en')[0].title,'3 new concepts are here');
  assert.equal(groupCustomerNotifications(items('concept_ready',[2,2]),'en')[0].title,'2 concepts were updated');
  assert.equal(groupCustomerNotifications(items('concept_ready',[1,2]).map(item=>({...item,type:'scene_ready',sceneId:item.conceptId})),'en')[0].title,'1 new · 1 updated scenes');
});

test('메일: 한국어는 판 1 글자 그대로, 영어 프로젝트는 영어로',()=>{
  const row={studio:{request:{answers:{name:'봄 세럼',contactName:'김하나',package:'s15'}}}};
  const ko=pulseMailCompose(row,'direction_proposed');
  assert.equal(ko.subject,'〔SYNK PULSE〕 봄 세럼 광고, 방향을 골라 주세요');
  assert.equal(ko.body.split('\n')[0],'김하나님, SYNK PULSE입니다.');
  assert.equal(pulseMailCompose({studio:{request:{answers:{package:'photo'}}}},'preview_ready').subject,'〔SYNK PULSE〕 요청하신 광고 사진을 확인해 주세요');
  for(const moment of PULSE_MAIL_MOMENTS){
    const en=pulseMailCompose(row,moment,'en');
    assert.match(en.subject,/^\[SYNK PULSE\] Your 봄 세럼 ad: /,moment);
    assert.doesNotMatch(en.body.replace('봄 세럼','').replace('김하나',''),/[가-힣]/,moment+' 영어 본문에 한글이 남지 않는다');
  }
});

// 합성 studio: 확인 끝 · 사람 없이 · 그림 하나 · 손님에게 보이는 장면 하나.
function studioFixture(){
  const studio=emptyPulseStudio(),image=randomUUID();
  studio.assets=[{id:image,mimeType:'image/png',fileName:'a.png',byteSize:1,author:'staff'}];
  studio.request={schemaVersion:1,number:'P-1',status:'confirmed',confirmedAt:'2026-11-09T00:00:00.000Z',answers:{...emptyRequestAnswers(),modelChoice:'none',contactLocale:'en'},files:[],asks:[],notes:[],rounds:[]};
  studio.scenes=[{id:randomUUID(),title:'첫 컷',description:'캔을 따는 소리',narration:'',screenText:'',visibility:'customer',revision:1,duration:3}];
  return {studio,image};
}
const stamp={author:'staff',authorId:'u1',authorName:'담당자',at:'2026-11-09T01:00:00.000Z'};
const dueDate=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
const directionInput=(image,translation)=>({action:'propose_direction',lead:'두 안이에요',price:390000,dueDate,revisions:2,options:[{name:'맛',sentence:'맛이 다섯 번',flow:[{at:'0:00',text:'캔을 딴다'}],why:'맛이 먼저',assetId:image},{name:'소리',sentence:'따는 소리',flow:[{at:'0:00',text:'소리'}],why:'',assetId:image}],...(translation?{translation}:{})});

test('번역 지도: 영어 프로젝트의 직원 글은 영어 없이 못 보내고, 손님 보기는 reviewed 번역으로, 원문이 바뀌면 원문으로',()=>{
  const {studio,image}=studioFixture(),row={id:'p1',studio,messages:[],versions:[],title:'합성',summary:'',terms:'',nextStep:''};
  // 되묻기
  assert.throws(()=>applyRequestAction({studio,row,input:{action:'request_ask',items:[{label:'색은요?',why:'병 색'}]},staff:true,stamp,locale:'en'}),err=>err.status===409&&/영어 프로젝트/.test(err.message));
  applyRequestAction({studio,row,input:{action:'request_ask',items:[{label:'색은요?',why:'병 색',translation:{label:'What color?',why:'For the bottle'}}]},staff:true,stamp,locale:'en'});
  const ask=studio.request.asks.at(-1);
  assert.equal(studio.translations[`ask:${ask.id}:label`].text,'What color?');assert.equal(studio.translations[`ask:${ask.id}:label`].status,'reviewed');
  // 방향 제안: 안마다 이름 · 한 문장 · 흐름 · 이유(빈 이유는 묻지 않는다)
  assert.throws(()=>applyRequestAction({studio,row,input:directionInput(image,{lead:'Two options',options:[{name:'Taste',sentence:'Five tastes',flow:['Open the can'],why:'Taste first'}]}),staff:true,stamp,locale:'en'}),err=>err.status===409,'둘째 안 번역이 빠짐');
  applyRequestAction({studio,row,input:directionInput(image,{lead:'Two options',options:[{name:'Taste',sentence:'Five tastes',flow:['Open the can'],why:'Taste first'},{name:'Sound',sentence:'The pop',flow:['The pop']}]}),staff:true,stamp,locale:'en'});
  const proposal=studio.request.directionProposal;
  // 글 콘티: 장면 제목 · 설명 번역이 없으면 못 보낸다
  studio.request.directionProposal={...proposal,status:'chosen',chosenId:proposal.options[0].id};
  assert.throws(()=>applyRequestAction({studio,row,input:{action:'send_draft',oneLine:'한 문장',translation:{oneLine:'One line'}},staff:true,stamp,locale:'en'}),err=>err.status===409&&/장면/.test(err.message));
  const scene=studio.scenes[0];
  studio.translations={...studio.translations,[`scene:${scene.id}:title`]:{sourceHash:sourceHash(scene.title),sourceLocale:'ko',targetLocale:'en',text:'First cut',status:'reviewed'},[`scene:${scene.id}:description`]:{sourceHash:sourceHash(scene.description),sourceLocale:'ko',targetLocale:'en',text:'The can pops',status:'draft'}};
  assert.throws(()=>applyRequestAction({studio,row,input:{action:'send_draft',oneLine:'한 문장',translation:{oneLine:'One line'}},staff:true,stamp,locale:'en'}),err=>err.status===409,'초안(draft) 번역으로는 못 보낸다');
  studio.translations[`scene:${scene.id}:description`].status='reviewed';
  applyRequestAction({studio,row,input:{action:'send_draft',oneLine:'한 문장',translation:{oneLine:'One line'}},staff:true,stamp,locale:'en'});
  // 손님 보기
  const view=localizeCustomerProject({stageLabel:'접수',ownerName:'담당자',nextStep:'새 시안을 보시고 의견이나 승인을 남겨 주세요.',title:'합성',studio:{request:studio.request,scenes:studio.scenes}},{map:studio.translations,locale:'en',text:value=>serverText('en',value),producer:'Your producer'});
  assert.equal(view.stageLabel,'Received');assert.equal(view.ownerName,'Your producer');assert.equal(view.nextStep,'Take a look at the new preview and leave notes or approve it.');
  assert.equal(view.studio.request.asks.at(-1).label,'What color?');
  assert.equal(view.studio.request.directionProposal.options[1].sentence,'The pop');assert.equal(view.studio.request.directionProposal.options[1].why,'','빈 이유는 빈 채로');
  assert.equal(view.studio.request.directionProposal.by,'Your producer');
  assert.equal(view.studio.request.rounds.at(-1).oneLine,'One line');assert.equal(view.studio.scenes[0].description,'The can pops');
  // 원문이 바뀌면 낡은 번역 → 원문
  const edited={...studio,scenes:[{...scene,description:'캔을 따는 큰 소리'}]};
  assert.equal(localizeCustomerProject({studio:{scenes:edited.scenes}},{map:studio.translations,locale:'en',text:v=>v,producer:'P'}).studio.scenes[0].description,'캔을 따는 큰 소리');
  assert.equal(translationStaffView(edited,row,'en').entries[`scene:${scene.id}:description`].fresh,false,'직원 보기는 낡음을 보인다');
  assert.equal(freshTranslation(studio.translations,`scene:${scene.id}:title`,scene.title,'ja'),null,'다른 언어 번역은 쓰지 않는다');
  // 한국어는 그대로 돌려준다(같은 객체)
  const same={stageLabel:'접수'};assert.equal(localizeCustomerProject(same,{map:studio.translations,locale:'ko',text:v=>v,producer:'P'}),same);
});

test('번역 지도: 한국어 프로젝트는 번역을 받지 않고 지도도 만들지 않는다',()=>{
  const {studio}=studioFixture();studio.request.answers.contactLocale='';
  applyRequestAction({studio,row:{id:'p'},input:{action:'request_ask',items:[{label:'색은요?',translation:{label:'What color?'}}]},staff:true,stamp,locale:'ko'});
  assert.equal(studio.translations,undefined);
  assert.ok(staffSources(studio).has(`ask:${studio.request.asks[0].id}:label`));
  assert.throws(()=>applyRequestAction({studio,row:{id:'p'},input:{action:'request_ask',items:[{label:'a',translation:'What'}]},staff:true,stamp,locale:'en'}),/번역 칸/);
});

test('자동 안내: 한국어가 아닌 프로젝트는 문의를 집지 않고, 고정 안내도 붙이지 않는다',async()=>{
  const docs=new Map(),key=(kind,id)=>kind+'|'+id;
  const store={get:(kind,id)=>docs.get(key(kind,id))||null,all:kind=>[...docs].filter(([k])=>k.startsWith(kind+'|')).map(([,v])=>v),put:(kind,id,value)=>{docs.set(key(kind,id),value);return value;},transaction:fn=>fn(),secret:()=>({apiKey:'synthetic'})};
  store.put('pulseAutoReplySettings','main',{enabled:true,enabledAt:'2026-11-01T00:00:00.000Z'});
  const message={id:'m1',author:'customer',action:'support',text:'언제 되나요?',at:'2026-11-09T00:00:00.000Z',resolved:false};
  store.put('clientProjects','p-en',{id:'p-en',stage:'received',messages:[message],studio:{request:{answers:{contactLocale:'en'}}}});
  let posted=0,called=0;
  const service=createPulseAutoReplyService({store,clientProjects:{postAutoReply:()=>{posted++;return {posted:true,messageId:'x'};}},snapshot:()=>({}),clock:()=>'2026-11-09T00:05:00.000Z',fetchImpl:async()=>{called++;throw new Error('no network');},localeOf:row=>row?.studio?.request?.answers?.contactLocale==='en'?'en':'ko'});
  await service.tick();
  assert.equal(posted,0);assert.equal(called,0);
  assert.equal(store.all('pulseAutoReplies').length,0,'기록도 만들지 않는다');
});

test('빈 contactLocale은 화면이 링크 · 브라우저로 정하게 locale을 비운다(Fable F1)',()=>{
  const docs=new Map(),store={get:(kind,id)=>docs.get(kind+id)||null,put:(kind,id,value)=>docs.set(kind+id,value)};
  store.put('pulseFeatureSettings','main',{publicLocales:['ko'],projectLocales:['ko','en']});
  const features=createPulseFeatures({store});
  assert.equal(features.projectView({contactLocale:''}).locale,'');
  assert.equal(features.projectView({}).locale,'');
  assert.equal(features.projectView({contactLocale:'en'}).locale,'en');
  assert.equal(features.projectView({contactLocale:'ja'}).locale,'ko','허락 밖은 한국어');
  assert.deepEqual(readPulseFeatures(null).projectLocales,['ko']);
});

// 서버를 띄워서: 공개 언어 주소, 영어 프로젝트의 손님 보기 · 알림 · 되묻기 번역, 한국어 프로젝트는 그대로.
test('서버: 영어 시험 프로젝트는 손님 보기 · 알림이 영어이고, 되묻기는 영어 없이 못 보낸다',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-i18n2-'));
  const app=createCompanyApp({dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null});
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const owner=app.store.createUser({name:'담당자',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},120);
  const jar=new Map();
  const call=async(path,{body,raw,headers={},csrf=''}={})=>{const response=await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});for(const line of response.headers.getSetCookie?.()||[]){const [pair]=line.split(';'),[name,value]=pair.split('=');if(value)jar.set(name,value);else jar.delete(name);}let data=null;try{data=await response.json();}catch{}return {status:response.status,data};};
  const staff=async(path,body)=>{const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});let data=null;try{data=await response.json();}catch{}return {status:response.status,data};};
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const send=async extra=>{jar.clear();const started=await call('/pulse/api/request/start',{body:{}});assert.equal(started.status,201);const draft=started.data.draft;await call('/pulse/api/request/media',{raw:png,csrf:draft.csrf,headers:{'Content-Type':'image/png','X-File-Name':'front.png','X-Request-Slot':'front'}});const sent=await call('/pulse/api/request/submit',{body:{answers:{name:'합성 탄산수',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝난 20대',oneThing:'한 캔에 맛이 다섯 번',action:'buy',contactName:'김합성',email:'buyer@pulse-synthetic.test',consent:true,rights:true,...extra}},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));return (await call('/pulse/api/project')).data;};
  // 공개 첫 화면 언어: 스위치가 꺼져 있으면 한국어 하나
  const features=await call('/pulse/api/features');
  assert.equal(features.status,200);assert.deepEqual(features.data,{features:{locales:['ko'],personaRequest:false,personaReal:false}});
  assert.equal((await call('/pulse/api/features?x=1')).status,400);
  assert.equal((await staff('/api/settings/pulse-features',{projectLocales:['ko','en']})).status,200);
  const ko=await send({});
  assert.equal(ko.features.locale,'','고르지 않은 프로젝트는 화면이 정한다');
  assert.equal(ko.project.stageLabel,'접수');assert.equal(ko.project.ownerName,'담당자');
  const en=await send({contactLocale:'en'}),projectId=en.project.id;
  assert.equal(en.features.locale,'en');assert.equal(en.project.stageLabel,'Received');assert.equal(en.project.ownerName,'Your producer');
  const studio=await staff('/api/client-projects/'+projectId+'/studio');
  assert.equal(studio.status,200);assert.equal(studio.data.project.translation.locale,'en');
  const blocked=await staff('/api/client-projects/'+projectId+'/studio',{action:'request_ask',revision:studio.data.project.revision,items:[{label:'병 색은요?'}]});
  assert.equal(blocked.status,409,JSON.stringify(blocked.data));
  const asked=await staff('/api/client-projects/'+projectId+'/studio',{action:'request_ask',revision:studio.data.project.revision,items:[{label:'병 색은요?',translation:{label:'What color is the bottle?'}}]});
  assert.equal(asked.status,200,JSON.stringify(asked.data));
  const room=await call('/pulse/api/project');
  assert.equal(room.data.project.studio.request.asks.at(-1).label,'What color is the bottle?');
  const live=await call('/pulse/api/live');
  assert.equal(live.status,200);assert.ok(live.data.notifications.some(item=>item.title==='A few quick questions'),JSON.stringify(live.data.notifications.map(item=>item.title)));
  // 번역 하나 고치기(save_translation) — 직원만, 지금 보이는 칸만
  const latest=await staff('/api/client-projects/'+projectId+'/studio'),askId=latest.data.project.studio.request.asks.at(-1).id;
  assert.equal((await staff('/api/client-projects/'+projectId+'/studio',{action:'save_translation',revision:latest.data.project.revision,key:'ask:nope:label',text:'x'})).status,404);
  const fixed=await staff('/api/client-projects/'+projectId+'/studio',{action:'save_translation',revision:latest.data.project.revision,key:`ask:${askId}:label`,text:'Which bottle color?'});
  assert.equal(fixed.status,200,JSON.stringify(fixed.data));
  assert.equal((await call('/pulse/api/project')).data.project.studio.request.asks.at(-1).label,'Which bottle color?');
  const now=(await call('/pulse/api/project')).data;
  assert.equal((await call('/pulse/api/studio',{body:{action:'save_translation',revision:now.project.revision,key:`ask:${askId}:label`,text:'x'},csrf:now.csrf})).status,403,'손님은 번역을 못 바꾼다');
});

// 직원 화면 영어 칸이 쓰는 서버 길(판 2 마무리): 장면 번역은 보낸 칸만 바꾸고, 파일로 올린 시안 · 최종본은 번역 머리글을 받고, 납품은 영어 안내가 있어야 보일 수 있다.
test('서버: 장면 번역은 보낸 칸만 · 파일 시안의 번역 머리글 · 납품 영어 안내 점검(한국어 프로젝트는 그대로)',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-i18n2-staff-'));
  const app=createCompanyApp({dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null});
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const owner=app.store.createUser({name:'담당자',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},120);
  const jar=new Map();
  const call=async(path,{body,raw,headers={},csrf=''}={})=>{const response=await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});for(const line of response.headers.getSetCookie?.()||[]){const [pair]=line.split(';'),[name,value]=pair.split('=');if(value)jar.set(name,value);else jar.delete(name);}let data=null;try{data=await response.json();}catch{}return {status:response.status,data};};
  const staff=async(path,body,{raw,headers={}}={})=>{const response=await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+token,'X-CSRF-Token':'staff-csrf',Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});let data=null;try{data=await response.json();}catch{}return {status:response.status,data};};
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const send=async extra=>{jar.clear();const started=await call('/pulse/api/request/start',{body:{}});assert.equal(started.status,201);const draft=started.data.draft;await call('/pulse/api/request/media',{raw:png,csrf:draft.csrf,headers:{'Content-Type':'image/png','X-File-Name':'front.png','X-Request-Slot':'front'}});const sent=await call('/pulse/api/request/submit',{body:{answers:{name:'합성 탄산수',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝난 20대',oneThing:'한 캔에 맛이 다섯 번',action:'buy',contactName:'김합성',email:'buyer@pulse-synthetic.test',consent:true,rights:true,...extra}},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));return (await call('/pulse/api/project')).data;};
  assert.equal((await staff('/api/settings/pulse-features',{projectLocales:['ko','en']})).status,200);
  // 한국어 프로젝트: 납품 보기에 손님 언어 · 영어 안내 점검이 없다.
  const ko=await send({});
  const koDelivery=await staff('/api/client-projects/'+ko.project.id+'/delivery');
  assert.equal(koDelivery.status,200,JSON.stringify(koDelivery.data));
  assert.equal(koDelivery.data.customerLocale,undefined);assert.ok(!koDelivery.data.checks.some(check=>check.id==='guideTranslation'));
  const en=await send({contactLocale:'en'}),id=en.project.id,studioPath='/api/client-projects/'+id+'/studio';
  let state=(await staff(studioPath)).data.project;
  const act=async body=>{const result=await staff(studioPath,{revision:state.revision,...body});assert.equal(result.status,200,JSON.stringify(result.data));state=result.data.project;return state;};
  // 장면: 제목 번역만 보내면 설명 번역은 건드리지 않는다(빠진 칸은 그대로, 빈 글자만 지움).
  await act({action:'save_scene',title:'캔을 딴다',description:'큰 소리',duration:3,visibility:'customer',translation:{title:'Open the can',description:'A loud pop'}});
  const sceneId=state.studio.scenes.at(-1).id,entry=key=>state.translation.entries[`scene:${sceneId}:${key}`];
  assert.equal(entry('title').text,'Open the can');assert.equal(entry('description').text,'A loud pop');
  await act({action:'save_scene',id:sceneId,title:'캔을 딴다',description:'아주 큰 소리',duration:3,visibility:'customer',translation:{title:'Pop the can'}});
  assert.equal(entry('title').text,'Pop the can');assert.equal(entry('title').fresh,true);
  assert.equal(entry('description').text,'A loud pop','보내지 않은 칸의 번역은 남는다');assert.equal(entry('description').fresh,false,'한국어가 바뀌어 낡음');
  await act({action:'save_scene',id:sceneId,title:'캔을 딴다',description:'아주 큰 소리',duration:3,visibility:'customer',translation:{description:''}});
  assert.equal(entry('description').text,'','빈 글자를 보내면 지운다(직원 보기는 원문이 있는 칸을 늘 싣는다)');assert.equal(entry('title').text,'Pop the can');
  // 파일로 올린 시안: 번역 머리글(이름) — 손님 보기에 영어 이름. 머리글이 깨지면 400.
  const upload=extra=>staff('/api/client-projects/'+id+'/media',undefined,{raw:png,headers:{'Content-Type':'image/png','X-File-Name':'cut.png','X-Version-Label':encodeURIComponent('1차 시안'),'X-Version-Kind':'preview','X-Version-Guide':'','X-Project-Revision':String(state.revision),...extra}});
  assert.equal((await upload({'X-Version-Translation':'%E0%A4%A'})).status,400);
  const uploaded=await upload({'X-Version-Translation':encodeURIComponent(JSON.stringify({label:'First cut'}))});
  assert.equal(uploaded.status,201,JSON.stringify(uploaded.data));
  state=(await staff(studioPath)).data.project;
  const preview=state.versions.at(-1);
  assert.equal(state.translation.entries[`version:${preview.id}:label`].text,'First cut');
  const room=(await call('/pulse/api/project')).data;
  assert.equal(room.project.versions.at(-1).label,'First cut');
  // 손님이 승인 → 납품: 영어 안내가 없으면 점검이 막고, 저장하면 열리고, 한국어 안내를 고치면 다시 막힌다.
  assert.equal((await call('/pulse/api/action',{body:{action:'approve',versionId:preview.id,revision:room.project.revision},csrf:room.csrf})).status,200);
  let delivery=(await staff('/api/client-projects/'+id+'/delivery')).data;
  const check=()=>delivery.checks.find(item=>item.id==='guideTranslation');
  assert.equal(delivery.customerLocale,'en');assert.equal(check().status,'missing');
  const save=async body=>{const result=await staff('/api/client-projects/'+id+'/delivery',{projectRevision:delivery.projectRevision,draftRevision:delivery.draftRevision,approvedPreviewId:delivery.approvedPreview.id,...body});assert.equal(result.status,200,JSON.stringify(result.data));delivery=result.data;};
  await save({action:'save_guide',guide:'파일을 받아 재생해 보세요.',translation:'Download the file and play it once.'});
  assert.equal(check().status,'ready');assert.equal(delivery.guideTranslation.fresh,true);
  await save({action:'save_guide',guide:'파일을 받아 두 번 재생해 보세요.'});
  assert.equal(check().status,'missing');assert.equal(delivery.guideTranslation.fresh,false);assert.match(check().text,/다시 저장/);
  // 작성자 이름(GPT GA1): 담당자에게 영문 이름이 있어도 다른 직원(관리자)의 답은 그 사람으로 — 영문 이름이 없으면 PULSE team, 담당자 본인은 영문 이름.
  app.store.put('users',owner.id,{...app.store.get('users',owner.id),nameEn:'Alice Kim'});
  const manager=app.store.createUser({name:'이관리',email:'manager@pulse-synthetic.test',role:'admin'}),managerToken=app.store.mint('session',manager.id,{csrfToken:'manager-csrf'},120);
  const post=async(cookie,csrf,text)=>{const now=(await staff(studioPath)).data.project;const response=await fetch(base+'/api/client-projects/'+id+'/messages',{method:'POST',headers:{Cookie:'synk_company_session='+cookie,'X-CSRF-Token':csrf,Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify({revision:now.revision,text,visibility:'customer'})});assert.equal(response.status,200,await response.text());};
  await post(managerToken,'manager-csrf','관리자가 대신 답해요.');await post(token,'staff-csrf','담당자가 답해요.');
  const names=Object.fromEntries((await call('/pulse/api/project')).data.project.messages.filter(message=>message.author==='staff').map(message=>[message.text,message.authorName]));
  assert.equal(names['관리자가 대신 답해요.'],'PULSE team','담당자 이름을 남의 글에 붙이지 않는다');
  assert.equal(names['담당자가 답해요.'],'Alice Kim');
});

test('작성자 이름(GPT GA1): 저장된 이름마다 그 직원의 표시 이름 — 담당자 · 영문 이름 있는 직원 · 없거나 이름이 겹치면 팀, 한국어는 그대로',()=>{
  const owner={name:'김하늘',nameEn:'Alice Kim'},users=[owner,{name:'이관리'},{name:'박영문',nameEn:'Jay Park'},{name:'동명',nameEn:'A'},{name:'동명',nameEn:'B'}];
  const en=createStaffNames('en',{owner,users});
  assert.deepEqual(['김하늘','이관리','박영문','동명','없는 사람'].map(en),['Alice Kim','PULSE team','Jay Park','PULSE team','PULSE team']);
  assert.equal(createStaffNames('en',{owner:{id:'k',name:'김하늘'},users:[{id:'k',name:'김하늘'},{id:'m',name:'이관리'}]})('김하늘'),'Your producer','담당자에게 영문 이름이 없으면 Your producer');
  assert.equal(createStaffNames('ko',{owner,users})('이관리'),'이관리');
  // 담당자와 다른 직원의 한국어 이름이 같으면 어느 쪽 글인지 모른다 — 담당자 이름도 붙이지 않는다(GPT 다시 검수 GA1).
  const same={id:'o',name:'김민수',nameEn:'Alice Kim'};
  assert.equal(createStaffNames('en',{owner:same,users:[{...same},{id:'x',name:'김민수',nameEn:'Jay Park'}]})('김민수'),'PULSE team');
  assert.equal(createStaffNames('en',{owner:same,users:[{...same},{id:'x',name:'박영문',nameEn:'Jay Park'}]})('김민수'),'Alice Kim','같은 사람(id)은 한 번만 센다');
  const view=localizeCustomerProject({ownerName:'김하늘',messages:[{id:'m1',author:'staff',authorName:'이관리',text:'a'},{id:'m2',author:'staff',authorName:'김하늘',text:'b'},{id:'m3',author:'customer',authorName:'손님',text:'c'}],studio:{request:{modelProposal:{note:'',by:'이관리'},confirmedBy:'김하늘'}}},{map:{},locale:'en',text:v=>v,producer:'Alice Kim',staffName:en});
  assert.deepEqual(view.messages.map(m=>m.authorName),['PULSE team','Alice Kim','손님']);
  assert.equal(view.ownerName,'Alice Kim');assert.equal(view.studio.request.modelProposal.by,'PULSE team');assert.equal(view.studio.request.confirmedBy,'Alice Kim');
  // 수령 확인 창의 파일 이름도 판 이름 번역을 지난다(캡처에서 찾음).
  const map={'version:v1:label':{sourceHash:sourceHash('최종 영상'),sourceLocale:'ko',targetLocale:'en',text:'Final film',status:'reviewed'}};
  const closed=localizeCustomerProject({closeout:{files:[{id:'v1',label:'최종 영상'},{id:'v2',label:'번역 없는 이름'}],status:'waiting_receipt'}},{map,locale:'en',text:v=>v,producer:'P'});
  assert.deepEqual(closed.closeout.files.map(file=>file.label),['Final film','번역 없는 이름']);assert.equal(closed.closeout.status,'waiting_receipt');
});
