// 고객 전용 인물 판 3(2026-11-10, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/인물판3_설계_20261110.md) — 접수 · 직원 검토 · 승인을 서버를 띄워 끝까지 본다.
// 전이 표 · 스위치 · 인물 사진이 초대 링크에 열리지 않음 · 시나리오 6(분위기 참고 · 실존 재현이 각자 절차로) · 7(옛 판 승인 → 409 + 새 판, 같은 키 한 번, 동시 수정) ·
// 사용 승인 → 인물 참조 · 가드, 직원 권한, 동의 암호문 · 당사자 확인 토큰, 유료 생성 · 학습 연결 없음.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {PERSONA_FLOW,PERSONA_APPROVAL_FLOW,PERSONA_STATES,personaNext,createPersonaGuard,openPersonaProjectIds} from './pulse-personas.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.from([0,0,2,0]),Buffer.from('isomiso2'),Buffer.alloc(64)]);
const heic=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypheic'),Buffer.from([0,0,0,0]),Buffer.from('mif1heic'),Buffer.alloc(64)]);
const answers=(extra={})=>({name:'합성 탄산수',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝난 20대',oneThing:'한 캔에 맛이 다섯 번',action:'buy',contactName:'김합성',email:'buyer@pulse-synthetic.test',consent:true,rights:true,...extra});
const custom=(request={})=>({modelChoice:'custom',personaRequest:{kind:'virtual',look:'20대 후반, 짧은 머리, 웃는 얼굴',use:'매장 진열대 앞 장면',keep:'once',...request}});

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-persona3-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  const owner=app.store.createUser({name:'담당자',email:'owner@pulse-synthetic.test',role:'admin'}),token=app.store.mint('session',owner.id,{csrfToken:'staff-csrf'},120);
  const member=app.store.createUser({name:'남의 크루',email:'crew@pulse-synthetic.test',role:'member'}),memberToken=app.store.mint('session',member.id,{csrfToken:'crew-csrf'},120);
  const viewer=app.store.createUser({name:'보기만',email:'viewer@pulse-synthetic.test',role:'viewer'}),viewerToken=app.store.mint('session',viewer.id,{csrfToken:'viewer-csrf'},120);
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const jar=new Map();
  const remember=response=>{for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}};
  const parse=async response=>{const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:response.status,data,bytes};};
  async function call(path,{body,raw,headers={},csrf=''}={}){
    const response=await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});
    remember(response);return parse(response);
  }
  async function staff(path,{body,raw,headers={},session=token,csrf='staff-csrf'}={}){
    const response=await fetch(base+path,{method:body===undefined&&raw===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+session,...(csrf?{'X-CSRF-Token':csrf}:{}),Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});
    return parse(response);
  }
  const features=async body=>{const result=await staff('/api/settings/pulse-features',{body});assert.equal(result.status,200,JSON.stringify(result.data));};
  const start=async()=>{const result=await call('/pulse/api/request/start',{body:{}});assert.equal(result.status,201,JSON.stringify(result.data));return result.data.draft;};
  const upload=(draft,slot,bytes=png,name='front.png',type='image/png')=>call('/pulse/api/request/media',{raw:bytes,csrf:draft.csrf,headers:{'Content-Type':type,'X-File-Name':encodeURIComponent(name),'X-Request-Slot':slot}});
  // 맞춤 인물 의뢰를 보내고 고객 방 세션을 연다.
  async function send(extra={},photos=[['front','front.png'],['persona-identity','face-1.png'],['persona-mood','mood.png']]){
    jar.clear();const draft=await start();
    for(const [slot,name] of photos){const result=await upload(draft,slot,png,name);assert.equal(result.status,201,slot+' '+JSON.stringify(result.data));}
    const sent=await call('/pulse/api/request/submit',{body:{answers:answers(extra)},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
    const room=await call('/pulse/api/project');assert.equal(room.status,200);
    return {sent,room:room.data,projectId:sent.data.projectId};
  }
  const room=async()=>{const result=await call('/pulse/api/project');assert.equal(result.status,200,JSON.stringify(result.data));return result.data;};
  const personaOf=projectId=>app.store.all('pulsePersonas').find(item=>item.originProjectId===projectId);
  async function act(personaId,body,{session,csrf}={}){const current=app.store.get('pulsePersonas',personaId);return staff('/api/personas/'+personaId,{body:{revision:current.revision,...body},...(session?{session,csrf}:{})});}
  async function asset(personaId,revisionId,role,bytes,name,type){const current=app.store.get('pulsePersonas',personaId);return staff(`/api/personas/${personaId}/revisions/${revisionId}/media`,{raw:bytes,headers:{'Content-Type':type,'X-File-Name':encodeURIComponent(name),'X-Persona-Role':role,'X-Persona-Revision':String(current.revision)}});}
  async function approve(view,decision='approve',note='',key=randomUUID()){const r=await room();return call('/pulse/api/persona/approve',{body:{personaId:view.id,kind:view.awaiting.kind,revisionId:view.awaiting.revisionId,viewedHash:view.awaiting.viewedHash,idempotencyKey:key,decision,...(note?{note}:{})},csrf:r.csrf});}
  return {app,base,call,staff,features,start,upload,send,room,personaOf,act,asset,approve,owner,memberToken,viewerToken,jar};
}
// 기준 얼굴까지: 검토 → 견적 → 손님 범위 확인 → 새 판 → 그림 → 기준 얼굴 보냄.
async function toReference(f,personaId){
  assert.equal((await f.act(personaId,{action:'start_review'})).status,200);
  assert.equal((await f.act(personaId,{action:'send_quote',price:300000,days:7,revisions:2,scope:'기준 얼굴 1판 · 동작 시안 1편 · 이번 광고 사용'})).status,200);
  let r=await f.room();assert.equal(r.project.persona.awaiting.kind,'scope');
  assert.equal((await f.approve(r.project.persona)).status,200);
  assert.equal((await f.act(personaId,{action:'open_revision'})).status,200);
  const revision=f.app.store.all('pulsePersonaRevisions').find(item=>item.personaId===personaId&&item.status==='draft');
  assert.equal((await f.asset(personaId,revision.id,'reference',png,'front.png','image/png')).status,201);
  assert.equal((await f.asset(personaId,revision.id,'reference',png,'side.png','image/png')).status,201);
  assert.equal((await f.act(personaId,{action:'publish_reference',revisionId:revision.id,note:'정면 · 옆모습 기준이에요'})).status,200);
  return revision.id;
}

test('전이 표: 직원 전이와 손님 승인은 정해진 상태에서만 넘어가고, 서로 대신하지 않는다',()=>{
  for(const [action,rule] of Object.entries(PERSONA_FLOW))for(const status of PERSONA_STATES){
    const next=personaNext({status,kind:'virtual'},{by:'staff',action});
    assert.equal(next,rule.from.includes(status)&&!rule.real?rule.to:null,`${action} @ ${status}`);
  }
  assert.equal(personaNext({status:'reviewing',kind:'real'},{by:'staff',action:'ask_rights'}),'rights_pending','실제 인물만 동의 확인으로');
  for(const [kind,rule] of Object.entries(PERSONA_APPROVAL_FLOW))for(const status of PERSONA_STATES){
    assert.equal(personaNext({status},{by:'customer',kind,decision:'approve'}),status===rule.on?rule.approve:null,`${kind} @ ${status}`);
    assert.equal(personaNext({status},{by:'customer',kind,decision:'changes'}),status===rule.on?rule.changes:null);
  }
  assert.equal(personaNext({status:'needs_materials'},{by:'customer',kind:'materials'}),'submitted');
  assert.equal(personaNext({status:'reviewing'},{by:'customer',kind:'materials'}),null);
  assert.equal(personaNext({status:'ready'},{by:'customer',kind:'consent',decision:'approve'}),null,'동의는 초대 세션 승인으로 받지 않는다');
  assert.equal(personaNext({status:'withdrawn'},{by:'staff',action:'withdraw'}),null,'끝난 요청은 다시 거둘 수 없다');
});

test('스위치를 끄면: 인물 사진 칸 · 맞춤 보내기 · 실제 인물이 막히고, 인물 문서는 생기지 않는다',async t=>{
  const f=await fixture(t);
  const draft=await f.start();
  assert.equal((await f.upload(draft,'persona-identity')).status,409,'끈 스위치에서는 인물 사진을 받지 않는다');
  assert.equal((await f.call('/pulse/api/request/save',{body:{answers:answers(custom()),step:'model'},csrf:draft.csrf})).status,200,'저장은 막지 않는다(판 1 그대로)');
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:answers(custom())},csrf:draft.csrf});
  assert.equal(sent.status,409);assert.match(sent.data.error,/맞춤 인물 요청은 아직 받지 않아요/);
  await f.features({personaRequest:true});
  const real=await f.call('/pulse/api/request/submit',{body:{answers:answers(custom({kind:'real',relation:'self',consentWay:'link'}))},csrf:draft.csrf});
  assert.equal(real.status,409);assert.match(real.data.error,/실제 인물 출연 요청은 아직 받지 않아요/);
  assert.equal(f.app.store.all('pulsePersonas').length,0);
  // 인물이 없으면 손님 보기 · 직원 보기에 인물 키가 없다(판 3 전과 같은 모양).
  const plain=await f.send({},[['front','front.png']]);
  assert.equal(Object.hasOwn(plain.room.project,'persona'),false);
  const desk=await f.staff(`/api/client-projects/${plain.projectId}/studio`);
  assert.equal(desk.status,200);assert.equal(Object.hasOwn(desk.data.project,'personas'),false);
});

test('맞춤 인물 접수: 인물 사진은 인물 문서로만 가고 초대 링크로 열리지 않는다 — 맞춤이 아니면 접수 뒤 지운다',async t=>{
  const f=await fixture(t);
  await f.features({personaRequest:true});
  const {room,projectId}=await f.send(custom());
  const persona=f.personaOf(projectId);
  assert.equal(persona.status,'submitted');assert.equal(persona.kind,'virtual');assert.equal(persona.workspaceId,null);
  const sources=f.app.store.all('pulsePersonaSources').filter(item=>item.personaId===persona.id);
  assert.deepEqual(sources.map(item=>item.purpose).sort(),['identity','mood']);
  const project=f.app.store.get('clientProjects',projectId);
  assert.deepEqual(project.studio.request.files.map(file=>file.slot),['front'],'의뢰서 파일 목록에는 제품 사진만');
  assert.ok(!project.studio.assets.some(item=>sources.some(source=>source.id===item.id)),'프로젝트 자료에 인물 사진이 없다');
  assert.equal(room.project.persona.status,'submitted');assert.equal(room.project.persona.sources.identity,1);assert.equal(room.project.persona.awaiting,null);
  for(const source of sources){
    assert.equal((await f.call('/pulse/api/studio/media/'+source.id)).status,404,'초대 세션의 자료 길로 원본이 열리지 않는다');
    assert.equal((await f.call('/pulse/api/persona/media/'+source.id)).status,404,'인물 길로도 원본은 열리지 않는다');
    assert.equal((await f.staff(`/api/personas/${persona.id}/media/${source.id}`)).status,200,'직원은 원본을 본다');
  }
  assert.equal(JSON.stringify(room).includes(sources[0].diskName),false,'손님 응답에 저장 이름이 없다');
  // 사진을 올렸다가 다른 모델로 보내면 인물 사진은 남지 않는다.
  f.jar.clear();const draft=await f.start();
  const face=await f.upload(draft,'persona-identity',png,'face.png');assert.equal(face.status,201);
  const diskDir=join(f.app.store.directory,'studio-media');
  const sent=await f.call('/pulse/api/request/submit',{body:{answers:answers({modelChoice:'ask'})},csrf:draft.csrf});assert.equal(sent.status,201);
  const other=f.app.store.get('clientProjects',sent.data.projectId);
  assert.equal(other.studio.request.files.length,0);assert.equal(other.studio.assets.length,0);
  await assert.rejects(stat(join(diskDir,face.data.file.id+'.png')),'버린 인물 사진은 디스크에서 지운다');
  assert.equal(f.personaOf(sent.data.projectId),undefined);
  // 프로젝트 길 파일 업로드는 인물 칸을 받지 않는다.
  const leak=await f.call('/pulse/api/studio/request-file',{raw:png,csrf:(await f.room()).csrf,headers:{'Content-Type':'image/png','X-File-Name':'face.png','X-Request-Slot':'persona-identity'}});
  assert.equal(leak.status,400,'프로젝트 자료 길은 인물 사진 칸을 거절한다');
});

test('시나리오 6: 분위기 참고 사진으로 온 가상 인물은 검토로, 실존 재현은 당사자 동의 확인으로 간다',async t=>{
  const f=await fixture(t);
  await f.features({personaRequest:true,personaReal:true});
  const mood=await f.send(custom(),[['persona-mood','mood-1.png'],['persona-mood','mood-2.png']]);
  const virtual=f.personaOf(mood.projectId);
  assert.equal((await f.act(virtual.id,{action:'ask_rights',why:'동의 확인'})).status,409,'가상 인물은 당사자 동의 단계가 없다');
  assert.equal((await f.act(virtual.id,{action:'request_materials',why:'같은 사람 재현용 정면 사진이 있으면 좋아요'})).status,200);
  let r=await f.room();assert.equal(r.project.persona.status,'needs_materials');assert.equal(r.project.persona.turn,'customer');assert.match(r.project.persona.why,/정면 사진/);
  const more=await f.call('/pulse/api/persona/source',{raw:heic,csrf:r.csrf,headers:{'Content-Type':'image/heic','X-File-Name':'face.heic','X-Persona-Purpose':'identity'}});
  assert.equal(more.status,201,JSON.stringify(more.data));assert.equal(more.data.project.persona.status,'submitted','자료를 보내면 저희 차례');
  const heicSource=f.app.store.all('pulsePersonaSources').find(item=>item.fileName==='face.heic');
  assert.equal(heicSource.inline,false);
  const download=await f.staff(`/api/personas/${virtual.id}/media/${heicSource.id}`);assert.equal(download.status,200);assert.ok(download.bytes.equals(heic),'휴대폰 사진은 직원이 내려받는다');
  assert.equal((await f.call('/pulse/api/persona/source',{raw:mp4,csrf:r.csrf,headers:{'Content-Type':'video/mp4','X-File-Name':'clip.mp4','X-Persona-Purpose':'identity'}})).status,415,'인물 사진 칸은 영상을 받지 않는다');
  // 실존 인물: 관계 · 동의 방법을 받고, 당사자 동의 확인으로 간다. 확인 토큰은 목적 하나 · 인물 id만 담는다.
  const real=await f.send(custom({kind:'real',relation:'self',consentWay:'link'}),[['persona-identity','me.png']]);
  const person=f.personaOf(real.projectId);
  assert.equal(person.kind,'real');assert.deepEqual([person.request.relation,person.request.consentWay],['self','link']);
  assert.equal((await f.act(person.id,{action:'ask_rights',why:'본인 확인 링크를 보내 드려요'})).status,200);
  assert.equal(f.app.store.get('pulsePersonas',person.id).status,'rights_pending');
  r=await f.room();assert.equal(r.project.persona.awaiting,null,'동의는 초대 링크로 받지 않는다');
  const {createPersonaService}=await import('./pulse-personas.mjs');
  const service=createPersonaService({store:f.app.store,clientProjects:{session(){throw new Error('no');}}});
  const consentToken=service.mintConsentToken(person.id);
  assert.deepEqual(service.readConsentToken(consentToken),{personaId:person.id});
  assert.equal(f.app.store.readToken(consentToken,'pulse-session'),null,'동의 토큰은 고객 세션이 아니다');
  assert.throws(()=>service.mintConsentToken(virtual.id),/실제 인물/);
  // 동의 기록: 인물마다 암호문 하나, 편집 권한만.
  const empty=await f.staff(`/api/personas/${person.id}/consent`);assert.equal(empty.status,200);assert.equal(empty.data.revision,0);
  const wrote=await f.staff(`/api/personas/${person.id}/consent`,{body:{expectedRevision:0,subject:'self',method:'link',scope:{training:true,external:false,ads:true,reuse:false},evidence:'본인 확인 링크로 동의(합성)',termsVersion:'draft-1'}});
  assert.equal(wrote.status,200,JSON.stringify(wrote.data));assert.equal(wrote.data.revision,1);
  const stored=f.app.store.get('pulsePersonaConsents',person.id);assert.equal(JSON.stringify(stored).includes('본인 확인'),false,'증빙은 암호문');
  assert.equal((await f.staff(`/api/personas/${person.id}/consent`,{session:f.viewerToken,csrf:'viewer-csrf'})).status,403,'보기 전용 계정은 동의를 읽지 못한다(편집 권한)');
  assert.equal((await f.staff(`/api/personas/${person.id}/consent`,{session:f.memberToken,csrf:'crew-csrf'})).status,404,'남의 프로젝트 사람은 못 읽는다');
  assert.equal((await f.staff(`/api/personas/${person.id}/consent`,{body:{expectedRevision:0,subject:'self',method:'link',scope:{},evidence:'x',termsVersion:'x'}})).status,409,'옛 판 번호면 거절');
  assert.equal(JSON.stringify(await f.room()).includes('본인 확인 링크로'),false,'손님 보기에 동의 내용이 없다');
});

test('끝까지: 견적 → 기준 얼굴 → 동작 시안 → 이번 광고 사용 확인 → 인물 참조 · 가드(사용 범위를 고치면 다시 막힘)',async t=>{
  const f=await fixture(t);
  await f.features({personaRequest:true});
  const {projectId}=await f.send(custom());
  const personaId=f.personaOf(projectId).id;
  const revisionId=await toReference(f,personaId);
  let r=await f.room(),view=r.project.persona;
  assert.equal(view.awaiting.kind,'reference');assert.equal(view.revision.reference.assets.length,2);
  const shown=await f.call(view.revision.reference.assets[0].url);assert.equal(shown.status,200);assert.ok(shown.bytes.equals(png));
  const changesKey=randomUUID();
  assert.equal((await f.approve(view,'changes','눈매를 조금 더 부드럽게',changesKey)).status,200);
  assert.equal(f.app.store.get('pulsePersonas',personaId).status,'reference_making');
  // 같은 요청 키는 본문(종류 · 결정 · 판 · 고칠 점 · 본 화면)이 같을 때만 「이미 받음」 — 글이나 본 화면이 다르면 409(GPT GA3).
  const again=await f.approve(view,'changes','눈매를 조금 더 부드럽게',changesKey);assert.equal(again.status,200);assert.equal(again.data.duplicate,true);
  assert.equal((await f.approve(view,'changes','머리를 더 짧게',changesKey)).status,409,'고칠 점 글이 다르면 새 글을 버리지 않고 409');
  assert.equal((await f.act(personaId,{action:'publish_reference',revisionId,note:'눈매를 부드럽게 고쳤어요'})).status,200,'확인 전 판은 다시 보낼 수 있다');
  assert.equal((await f.approve((await f.room()).project.persona,'changes','눈매를 조금 더 부드럽게',changesKey)).status,409,'다시 보낸 판(새 viewedHash)에 옛 키를 쓰면 409');
  assert.equal(f.app.store.all('pulsePersonaApprovals').filter(item=>item.personaId===personaId&&item.kind==='reference').length,1);
  r=await f.room();assert.equal((await f.approve(r.project.persona)).status,200);
  assert.equal(f.app.store.get('pulsePersonas',personaId).status,'building');
  assert.equal((await f.act(personaId,{action:'publish_reference',revisionId,note:'x'})).status,409,'확인한 얼굴은 같은 판으로 바꾸지 못한다');
  assert.equal((await f.asset(personaId,revisionId,'motion',png,'still.png','image/png')).status,415,'동작 시안은 영상');
  assert.equal((await f.asset(personaId,revisionId,'motion',mp4,'walk.mp4','video/mp4')).status,201);
  assert.equal((await f.act(personaId,{action:'publish_motion',revisionId,note:'걷기 · 웃기는 자연스러워요. 빠른 말은 입이 어긋날 수 있어요'})).status,200);
  r=await f.room();view=r.project.persona;assert.equal(view.awaiting.kind,'motion');assert.equal(view.revision.motion.assets[0].mimeType,'video/mp4');
  assert.equal((await f.approve(view)).status,200);
  assert.equal(f.app.store.get('pulsePersonas',personaId).status,'ready');
  r=await f.room();assert.equal(r.project.persona.awaiting,null,'사용 범위가 오기 전에는 손님 차례가 아니다');
  assert.equal((await f.act(personaId,{action:'set_usage',brand:'합성 브랜드',product:'합성 탄산수',purpose:'출시 광고',media:'인스타그램 · 유튜브 쇼츠',regions:'한국',period:'2026-12-01 ~ 2027-05-31',fee:'인물 제작 30만원(별도)',schedule:'12월 첫 주'})).status,200);
  r=await f.room();view=r.project.persona;assert.equal(view.awaiting.kind,'usage');
  assert.equal((await f.approve(view,'changes','기간을 늘려 주세요')).status,400,'사용 확인에는 고칠 점이 없다(물음은 일지)');
  assert.equal((await f.approve(view)).status,200);
  let project=f.app.store.get('clientProjects',projectId);
  assert.deepEqual(project.studio.strategy.data.castingSelection.personaRef,{personaId,revisionId});
  const guard=createPersonaGuard(f.app.store);
  assert.doesNotThrow(()=>guard({personaId,revisionId},project));
  assert.equal((await f.room()).project.persona.turn,'done');
  // 사용 범위를 고치면 승인이 비고 참조가 떨어져 가드가 막는다 → 다시 확인하면 붙는다.
  assert.equal((await f.act(personaId,{action:'set_usage',brand:'합성 브랜드',product:'합성 탄산수',purpose:'출시 광고',media:'인스타그램',regions:'한국',period:'2026-12-01 ~ 2027-11-30',fee:'',schedule:''})).status,200);
  project=f.app.store.get('clientProjects',projectId);
  assert.equal(project.studio.strategy.data.castingSelection.personaRef,undefined);
  assert.throws(()=>guard({personaId,revisionId},project),error=>error.status===409);
  r=await f.room();
  // 옛 사용 승인의 요청 키로 새 범위를 확인하면 「이미 받음」이 아니라 409 — 승인 없이 성공으로 보이면 가드가 계속 막는다(GPT GA3).
  const usedKey=f.app.store.all('pulsePersonaApprovals').find(item=>item.personaId===personaId&&item.kind==='usage').idempotencyKey;
  const reused=await f.approve(r.project.persona,'approve','',usedKey);assert.equal(reused.status,409,JSON.stringify(reused.data));
  assert.throws(()=>guard({personaId,revisionId},f.app.store.get('clientProjects',projectId)),error=>error.status===409);
  assert.equal((await f.approve(r.project.persona)).status,200);
  assert.doesNotThrow(()=>guard({personaId,revisionId},f.app.store.get('clientProjects',projectId)));
  // 기록: 인물 쪽 움직임은 프로젝트 기록에 한 줄씩 남아 90일 시계를 돌린다. 승인은 덧붙이기만.
  project=f.app.store.get('clientProjects',projectId);
  assert.ok(project.history.filter(entry=>entry.action.startsWith('전용 인물')).length>=10);
  const approvals=f.app.store.all('pulsePersonaApprovals').filter(item=>item.personaId===personaId);
  assert.deepEqual(approvals.map(item=>`${item.kind}:${item.decision}`),['scope:approve','reference:changes','reference:approve','motion:approve','usage:approve','usage:approve']);
  assert.ok(approvals.every(item=>item.authMethod==='invite-link'&&item.actorKind==='invite'),'초대 링크 승인을 신원 확인으로 적지 않는다');
});

test('판 파일 하나만 빼도 그 본문의 해시가 인물 문서에 남는다 — 백업이 같은 바이트를 계속 오래 두는 보관 사본에서 뺀다(판 4 설계 11-2)',async t=>{
  const f=await fixture(t);
  await f.features({personaRequest:true});
  const {projectId}=await f.send(custom());
  const personaId=f.personaOf(projectId).id;
  assert.equal((await f.act(personaId,{action:'start_review'})).status,200);
  assert.equal((await f.act(personaId,{action:'send_quote',price:300000,days:7,revisions:2,scope:'기준 얼굴 1판'})).status,200);
  assert.equal((await f.approve((await f.room()).project.persona)).status,200);
  assert.equal((await f.act(personaId,{action:'open_revision'})).status,200);
  const revisionId=f.app.store.all('pulsePersonaRevisions').find(item=>item.personaId===personaId&&item.status==='draft').id;
  const other=Buffer.concat([png,Buffer.from('other draft')]);
  assert.equal((await f.asset(personaId,revisionId,'reference',png,'front.png','image/png')).status,201);
  assert.equal((await f.asset(personaId,revisionId,'reference',other,'side.png','image/png')).status,201);
  const [a,b]=f.app.store.get('pulsePersonaRevisions',revisionId).assets;
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  // 보낸 적 없는 초안 파일 A를 뺀다: 이름을 떼는 같은 트랜잭션에서 인물 문서에 A 본문의 sha256이 남고, 파일은 지워진다.
  const removed=await f.act(personaId,{action:'remove_asset',revisionId,assetId:a.id});assert.equal(removed.status,200,JSON.stringify(removed.data));
  assert.deepEqual(f.app.store.get('pulsePersonas',personaId).removedNoVault,[hash(png)]);
  assert.deepEqual(f.app.store.get('pulsePersonaRevisions',revisionId).assets.map(item=>item.id),[b.id]);
  await assert.rejects(stat(join(f.app.store.directory,'studio-media',a.diskName)),{code:'ENOENT'});
  // 둘째 파일도 빼면 해시가 쌓인다(같은 해시는 한 번만).
  assert.equal((await f.act(personaId,{action:'remove_asset',revisionId,assetId:b.id})).status,200);
  assert.deepEqual(f.app.store.get('pulsePersonas',personaId).removedNoVault,[hash(png),hash(other)].sort());
  // 없는 파일은 예전처럼 404, 손님 · 직원 보기에는 이 칸이 실리지 않는다.
  assert.equal((await f.act(personaId,{action:'remove_asset',revisionId,assetId:a.id})).status,404);
  assert.equal(JSON.stringify((await f.staff('/api/personas/'+personaId)).data).includes('removedNoVault'),false);
  assert.equal(JSON.stringify((await f.room()).project).includes('removedNoVault'),false);
  // 미리 잰 그 파일의 해시가 있어야 이름을 뗀다 — 해시 없이 · 다른 파일의 것으로 · 틀린 꼴로 부르면 멈추고 아무것도 바뀌지 않는다.
  assert.equal((await f.asset(personaId,revisionId,'reference',png,'again.png','image/png')).status,201);
  const c=f.app.store.get('pulsePersonaRevisions',revisionId).assets[0],owner=f.app.store.all('users').find(user=>user.role==='admin');
  const {createPersonaService}=await import('./pulse-personas.mjs'),personas=createPersonaService({store:f.app.store,clientProjects:f.app.clientProjects});
  const input=()=>({action:'remove_asset',revision:f.app.store.get('pulsePersonas',personaId).revision,revisionId,assetId:c.id});
  const target=personas.removalTarget(owner,personaId,input());
  assert.deepEqual(target,{assetId:c.id,diskName:c.diskName});
  assert.equal(personas.removalTarget(owner,personaId,{action:'note',text:'x'}),null,'다른 일에는 잴 파일이 없다');
  for(const prepared of [null,{...target},{...target,sha256:'짧음'},{...target,diskName:randomUUID()+'.png',sha256:hash(png)},{assetId:randomUUID(),diskName:target.diskName,sha256:hash(png)}])
    assert.throws(()=>personas.staffAction(owner,personaId,input(),prepared),/그사이 인물 파일이 바뀌었어요/);
  assert.deepEqual(f.app.store.get('pulsePersonaRevisions',revisionId).assets.map(item=>item.id),[c.id],'멈추면 이름을 떼지 않는다');
  assert.deepEqual(f.app.store.get('pulsePersonas',personaId).removedNoVault,[hash(png),hash(other)].sort());
  // 파일이 이미 없으면(null) 지킬 바이트가 없다 — 이름은 떼고 해시는 더하지 않는다.
  assert.equal(personas.staffAction(owner,personaId,input(),{...target,sha256:null}).discard[0],c.diskName);
  assert.deepEqual(f.app.store.get('pulsePersonas',personaId).removedNoVault,[hash(png),hash(other)].sort());
});

test('GA1: 손님에게 한 번이라도 보낸 판 파일은 그 판을 다시 보낸 뒤에도 지울 수 없다 — 확인 기록이 가리키는 그림이 남는다',async t=>{
  const f=await fixture(t);
  await f.features({personaRequest:true});
  const {projectId}=await f.send(custom());
  const personaId=f.personaOf(projectId).id;
  const revisionId=await toReference(f,personaId);
  const [a,b]=f.app.store.get('pulsePersonaRevisions',revisionId).assets.map(item=>item.id);
  assert.equal((await f.approve((await f.room()).project.persona,'changes','눈매를 조금 더 부드럽게')).status,200);
  const again=await f.act(personaId,{action:'publish_reference',revisionId,assetIds:[b],note:'옆모습만 다시 보내요'});assert.equal(again.status,200,JSON.stringify(again.data));
  assert.deepEqual(f.app.store.get('pulsePersonaRevisions',revisionId).reference.assetIds,[b],'지금 보낸 묶음에는 A가 없다');
  const removed=await f.act(personaId,{action:'remove_asset',revisionId,assetId:a});
  assert.equal(removed.status,409,'손님이 본 A는 지울 수 없다');
  const approval=f.app.store.all('pulsePersonaApprovals').find(item=>item.personaId===personaId&&item.kind==='reference'&&item.decision==='changes');
  assert.deepEqual([...approval.shown.assetIds].sort(),[a,b].sort());
  assert.equal((await f.staff(`/api/personas/${personaId}/media/${a}`)).status,200,'확인 기록의 A 그림은 직원에게 그대로 열린다');
  assert.equal(f.app.store.get('pulsePersonaRevisions',revisionId).assets.length,2);
  // 직원 보기는 판마다 보낸 적 있는 파일을 알려, 데스크가 그 파일의 지우기 단추를 그리지 않는다.
  const desk=(await f.staff('/api/personas/'+personaId)).data.persona.revisions.find(item=>item.id===revisionId);
  assert.deepEqual([...desk.sent].sort(),[a,b].sort());
});

test('GA2: 확인 전 의뢰서를 다시 보내면 — 접수 단계 인물은 새 요청으로 바뀌고, 검토가 시작된 인물은 다른 요청을 409로 돌려보낸다',async t=>{
  const f=await fixture(t);
  await f.features({personaRequest:true,personaReal:true});
  const resubmit=async(extra)=>{const r=await f.room();return f.call('/pulse/api/studio',{body:{revision:r.project.revision,action:'request_submit',answers:answers(extra)},csrf:r.csrf});};
  const {projectId}=await f.send(custom());
  const personaId=f.personaOf(projectId).id;
  const real={kind:'real',look:'창업자 얼굴 그대로',keep:'reuse',relation:'self',consentWay:'document'};
  const changed=await resubmit(custom(real));assert.equal(changed.status,200,JSON.stringify(changed.data));
  let persona=f.app.store.get('pulsePersonas',personaId);
  assert.equal(persona.kind,'real');assert.equal(persona.status,'submitted');
  assert.deepEqual(persona.request,{look:'창업자 얼굴 그대로',use:'매장 진열대 앞 장면',keep:'reuse',relation:'self',consentWay:'document'});
  assert.equal(persona.history.at(-1).action,'request_update');assert.equal(persona.history.at(-1).actorKind,'customer');
  const before=persona.revision;
  assert.equal((await resubmit(custom(real))).status,200,'같은 요청을 다시 보내면 인물은 그대로');
  assert.equal(f.app.store.get('pulsePersonas',personaId).revision,before);
  // 실제 인물 접수를 끄면 접수 단계 인물도 실제 인물로 바꿀 수 없다(스위치는 서버가 강제).
  await f.features({personaRequest:true,personaReal:false});
  assert.equal((await resubmit(custom({...real,look:'창업자 얼굴, 안경'}))).status,409);
  await f.features({personaRequest:true,personaReal:true});
  // 검토가 시작되면 다른 요청 · 맞춤 빼기는 409, 인물과 의뢰서는 그대로다.
  assert.equal((await f.act(personaId,{action:'start_review'})).status,200);
  const answersBefore=JSON.stringify(f.app.store.get('clientProjects',projectId).studio.request.answers);
  const late=await resubmit(custom({...real,keep:'once'}));
  assert.equal(late.status,409);assert.match(late.data.error||late.data.message||JSON.stringify(late.data),/검토가 이미 시작돼/);
  assert.equal((await resubmit({modelChoice:'ask'})).status,409,'검토가 시작된 인물을 의뢰서에서 말없이 떼지 않는다');
  assert.equal(JSON.stringify(f.app.store.get('clientProjects',projectId).studio.request.answers),answersBefore,'다시 보내기가 통째로 되돌아간다');
  persona=f.app.store.get('pulsePersonas',personaId);assert.equal(persona.status,'reviewing');assert.equal(persona.request.keep,'reuse');
  assert.equal((await resubmit(custom(real))).status,200,'요청이 같으면 검토 중에도 다시 보낼 수 있다');
});

test('시나리오 7: 새 기준 얼굴 판 뒤 옛 판 승인은 409 + 새 판, 같은 요청 키는 한 번, 직원 동시 수정은 409 · 이력 온전',async t=>{
  const f=await fixture(t);
  await f.features({personaRequest:true});
  const {projectId}=await f.send(custom());
  const personaId=f.personaOf(projectId).id;
  const first=await toReference(f,personaId);
  const old=(await f.room()).project.persona;
  // 직원이 새 판(2판)을 열어 새 얼굴을 보낸다.
  assert.equal((await f.act(personaId,{action:'open_revision'})).status,200);
  const second=f.app.store.all('pulsePersonaRevisions').find(item=>item.personaId===personaId&&item.status==='draft').id;
  assert.equal((await f.asset(personaId,second,'reference',png,'front-2.png','image/png')).status,201);
  assert.equal((await f.act(personaId,{action:'publish_reference',revisionId:second,note:'2판 — 더 어린 인상'})).status,200);
  assert.equal(f.app.store.get('pulsePersonaRevisions',first).status,'superseded');
  const stale=await f.approve(old);
  assert.equal(stale.status,409);assert.equal(stale.data.code,'SYNK_PULSE_PERSONA_STALE');
  assert.equal(stale.data.persona.revision.id,second,'409 응답에 새 판이 온다');assert.equal(stale.data.persona.revision.number,2);
  assert.equal((await f.call(old.revision.reference.assets[0].url)).status,404,'지난 판 그림은 더 열리지 않는다');
  // 같은 요청 키로 두 번 눌러도 승인은 하나, 다른 본문이면 409.
  const fresh=(await f.room()).project.persona,key=randomUUID();
  const once=await f.approve(fresh,'approve','',key),twice=await f.approve(fresh,'approve','',key);
  assert.equal(once.status,200);assert.equal(twice.status,200);assert.equal(twice.data.duplicate,true);
  assert.equal(f.app.store.all('pulsePersonaApprovals').filter(item=>item.kind==='reference').length,1);
  assert.equal((await f.call('/pulse/api/persona/approve',{body:{personaId,kind:'reference',revisionId:second,viewedHash:fresh.awaiting.viewedHash,idempotencyKey:key,decision:'changes',note:'x'},csrf:(await f.room()).csrf})).status,409);
  // 직원 둘이 같은 판 번호로 고치면 뒤의 것은 409, 이력은 한 줄씩만.
  const persona=f.app.store.get('pulsePersonas',personaId),before=persona.history.length;
  const [a,b]=await Promise.all([f.staff('/api/personas/'+personaId,{body:{action:'note',revision:persona.revision,text:'첫 메모'}}),f.staff('/api/personas/'+personaId,{body:{action:'note',revision:persona.revision,text:'둘째 메모'}})]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);
  const after=f.app.store.get('pulsePersonas',personaId);
  assert.equal(after.history.length,before+1);assert.equal(after.revision,persona.revision+1);
  // 손님 이야기: 직원 메모 · 내부 방식은 손님 보기에 없다.
  const view=JSON.stringify((await f.room()).project.persona);assert.equal(view.includes('메모'),false);
});

test('직원 권한 · 영어 프로젝트의 직원 글 번역 · 거둔 인물',async t=>{
  const f=await fixture(t);
  await f.features({personaRequest:true,projectLocales:['ko','en']});
  const {projectId}=await f.send({...custom(),contactLocale:'en'});
  const personaId=f.personaOf(projectId).id;
  assert.equal((await f.staff('/api/personas/'+personaId,{session:f.memberToken,csrf:'crew-csrf'})).status,404,'원 프로젝트를 못 읽는 직원에게는 없는 인물');
  assert.equal((await f.staff('/api/personas/project/'+projectId,{session:f.memberToken,csrf:'crew-csrf'})).status,404);
  assert.equal((await f.act(personaId,{action:'start_review'},{session:f.viewerToken,csrf:'viewer-csrf'})).status,403,'보기 전용 계정은 바꾸지 못한다');
  assert.equal((await f.act(personaId,{action:'start_review'},{session:f.memberToken,csrf:'crew-csrf'})).status,404);
  assert.equal((await f.staff('/api/personas/'+personaId,{body:{action:'start_review',revision:1},csrf:''})).status,403,'CSRF 없이는 못 바꾼다');
  assert.equal((await f.act(personaId,{action:'start_review'})).status,200);
  const missing=await f.act(personaId,{action:'send_quote',price:300000,days:7,revisions:2,scope:'기준 얼굴과 동작 시안'});
  assert.equal(missing.status,409,'영어 프로젝트에 한글 글은 번역 없이 못 보낸다');
  assert.equal((await f.act(personaId,{action:'send_quote',price:300000,days:7,revisions:2,scope:'기준 얼굴과 동작 시안',translation:{scope:'One reference look and one motion test'}})).status,200);
  let r=await f.room();assert.equal(r.project.persona.quote.scope,'One reference look and one motion test');
  assert.equal(r.features.locale,'en');
  assert.equal((await f.act(personaId,{action:'set_name',displayName:'Hana'})).status,200,'처음부터 영어로 적으면 번역이 필요 없다');
  r=await f.room();assert.equal(r.project.persona.name,'Hana');
  // 거둔 인물: 손님 차례가 끝나고, 사진은 그대로 인물 문서에 남는다(90일 정리 · 보관과 별개).
  assert.equal((await f.act(personaId,{action:'withdraw',why:'Model changed',translation:{}})).status,200);
  r=await f.room();assert.equal(r.project.persona.status,'withdrawn');assert.equal(r.project.persona.turn,'end');assert.equal(r.project.persona.awaiting,null);
  assert.ok(f.app.store.all('pulsePersonaSources').some(item=>item.personaId===personaId));
  assert.equal(openPersonaProjectIds(f.app.store).has(projectId),false);
});

test('90일 정리 · 묘비: 지운 인물은 열린 요청으로 세지 않는다(판 1 아르곤 A1)',()=>{
  const docs=new Map(),store={all:kind=>[...(docs.get(kind)||new Map()).values()]};
  const put=(kind,doc)=>{if(!docs.has(kind))docs.set(kind,new Map());docs.get(kind).set(doc.id,doc);};
  put('pulsePersonas',{id:'a',originProjectId:'p1',status:'reviewing'});
  put('pulsePersonas',{id:'b',originProjectId:'p2',status:'reviewing',deletedAt:'2026-11-10T00:00:00Z'});
  put('pulsePersonas',{id:'c',originProjectId:'p3',status:'ready'});
  assert.deepEqual([...openPersonaProjectIds(store)],['p1']);
});

test('유료 생성 · 학습을 부르는 연결이 없다: 인물 모듈은 네트워크 · 생성 도구를 가져오지 않는다',async()=>{
  const source=await readFile(new URL('./pulse-personas.mjs',import.meta.url),'utf8');
  const imports=[...source.matchAll(/^import\s.+?from\s+'([^']+)';/gm)].map(match=>match[1]).sort();
  assert.deepEqual(imports,['./public/pulse-app/casting-choice.mjs','./public/pulse-app/i18n.mjs','./pulse-translations.mjs','node:crypto']);
  assert.doesNotMatch(source,/\bfetch\s*\(|child_process|spawn\(|exec\(|https?:\/\/|import\(/);
  const server=await readFile(new URL('./server.mjs',import.meta.url),'utf8');
  const lines=server.split('\n').filter(line=>/pulsePersonas\./.test(line));
  assert.ok(lines.length>=8);
  for(const line of lines)assert.doesNotMatch(line,/fetch|Higgsfield|gpu|train|generate/i,'인물 경로에 생성 · 학습 호출이 없다');
});
