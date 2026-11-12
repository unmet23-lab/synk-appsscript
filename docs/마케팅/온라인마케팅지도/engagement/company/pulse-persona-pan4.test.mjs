// 고객 전용 인물 판 4(2026-11-10, 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판4_설계_20261110.md 5판) — 고객 브랜드 연결 · 내 모델 · 다시 쓰기 · 만료 · 사용 중지 · 삭제.
// 서버를 띄우고 가짜 중앙 SYNK ID(고객 로그인)와 판 3 흐름으로 만든 실제 인물 문서 위에서 7절 시나리오 5 · 8 · 9 · 10과 증표 · 스위치 · 로그인 돌아오기를 본다.
// 실제 학습 · 생성 · 결제 · 고객 연락은 부르지 않는다(합성 프로젝트 · 합성 계정만).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {createPersonaGuard,openPersonaProjectIds,kstDayEnd,reuseUntil,effectivePersonaStatus,personaUsability,PERSONA_SETTLED} from './pulse-personas.mjs';
import {applyRequestAction} from './pulse-requests.mjs';
import {workspaceMediaNames} from './workspace-media.mjs';

const origin='https://company.example.test',issuer='https://identity.example.test';
const ids={a:'11111111-1111-4111-8111-111111111111',a2:'55555555-5555-4555-8555-555555555555',b:'22222222-2222-4222-8222-222222222222',c:'33333333-3333-4333-8333-333333333333'};
const NAMES={[ids.a]:'가 대표',[ids.a2]:'가 직원',[ids.b]:'나 대표',[ids.c]:'다 손님'};
const sessionId='44444444-4444-4444-8444-444444444444';
const config={accountApiUrl:issuer+'/functions/v1/synk-account',publishableKey:'sb_publishable_synthetic_fixture',issuer,clientId:'customer-browser-fixture',redirectUri:origin+'/api/customer/synk-id/callback'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.from([0,0,2,0]),Buffer.from('isomiso2'),Buffer.alloc(64)]);
const answers=(extra={})=>({name:'합성 탄산수',kind:'food',channels:['shorts'],package:'s15',audience:'운동 끝난 20대',oneThing:'한 캔에 맛이 다섯 번',action:'buy',contactName:'김합성',email:'buyer@pulse-synthetic.test',consent:true,rights:true,...extra});
const custom={modelChoice:'custom',personaRequest:{kind:'virtual',look:'20대 후반, 짧은 머리, 웃는 얼굴',use:'매장 진열대 앞 장면',keep:'reuse'}};
const USAGE={brand:'가 브랜드',product:'새 탄산수',purpose:'출시 광고',media:'인스타그램',regions:'한국',period:'2027-01-01 ~ 2027-03-31',fee:'',schedule:'1월 첫 주',note:''};

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-pan4-'));
  const f={directory,stamp:Date.parse('2026-11-10T03:00:00Z'),refreshCount:0};
  const token=id=>'synthetic.'+Buffer.from(JSON.stringify({iss:issuer+'/auth/v1',sub:id,session_id:sessionId,client_id:config.clientId,iat:Math.floor(f.stamp/1000)-1,exp:Math.floor((f.stamp+3600_000)/1000)})).toString('base64url')+'.fixture';
  async function identityFetch(url,init){
    if(String(url).endsWith('/oauth/token')){const body=new URLSearchParams(init.body),refresh=body.get('grant_type')==='refresh_token';if(refresh)f.refreshCount++;const id=refresh?body.get('refresh_token').split(':')[1]:body.get('code');return Response.json({access_token:token(id),refresh_token:'synthetic-refresh:'+id+':'+f.refreshCount,token_type:'bearer'});}
    if(String(url).includes('/logout?scope=local'))return new Response(null,{status:204});
    if(init.method==='POST')return Response.json({ok:true,current:true});
    const claims=JSON.parse(Buffer.from(init.headers.Authorization.split('.')[1],'base64url'));
    return Response.json({ok:true,account:{synk_user_id:claims.sub,status:'active',profile:{display_name:NAMES[claims.sub]||'고객'}},sessions:[{id:sessionId,current:true,revoked:false,product:'platform'}]});
  }
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin,allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,
    synkCustomerIdentityConfig:config,synkCustomerIdentityFetch:identityFetch,synkCustomerIdentityNow:()=>f.stamp,clock:()=>new Date(f.stamp).toISOString(),pulseRequestFreeBytes:async()=>100*1024**3,
    messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}};
  f.start=async()=>{f.app=createCompanyApp(options);const address=await f.app.start();f.base='http://127.0.0.1:'+address.port;};
  await f.start();
  const store=()=>f.app.store;
  f.owner=store().createUser({name:'관리자',email:'owner@pulse-synthetic.test',role:'admin'});
  f.intake=store().createUser({name:'접수 담당',email:'intake@pulse-synthetic.test',role:'member'});
  f.crew=store().createUser({name:'남의 크루',email:'crew@pulse-synthetic.test',role:'member',teamId:'other'});
  f.viewer=store().createUser({name:'보기만',email:'viewer@pulse-synthetic.test',role:'viewer'});
  // 공개 의뢰서 담당자를 관리자가 아닌 접수 담당으로 둔다 — 다시 쓰기 의뢰의 담당자가 브랜드 담당(관리자)으로 바뀌는지 가르려고.
  store().put('pulseRequestSettings','main',{ownerId:f.intake.id});
  f.tokens={};
  f.mintStaff=()=>{for(const user of [f.owner,f.intake,f.crew,f.viewer])f.tokens[user.id]=store().mint('session',user.id,{csrfToken:'csrf-'+user.id},600);};f.mintStaff();
  f.restart=async()=>{await f.app.stop();await f.start();f.mintStaff();};
  t.after(async()=>{await f.app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const parse=async response=>{const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}return {status:response.status,data,bytes,headers:response.headers};};
  f.staff=async(path,{body,as=f.owner}={})=>parse(await fetch(f.base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+f.tokens[as.id],'X-CSRF-Token':'csrf-'+as.id,Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}));
  f.features=async body=>{const result=await f.staff('/api/settings/pulse-features',{body});assert.equal(result.status,200,JSON.stringify(result.data));};
  f.browser=()=>{
    const jar=new Map(),b={jar,customerCsrf:'',roomCsrf:''};
    b.call=async(path,{body,raw,headers={},csrf='',customer=false,method}={})=>{
      const m=method||(body===undefined&&raw===undefined?'GET':'POST');
      const response=await fetch(f.base+path,{method:m,redirect:'manual',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),...(['GET','HEAD'].includes(m)?{}:{Origin:origin}),...(csrf?{'X-Pulse-CSRF':csrf}:{}),...(customer?{'X-CSRF-Token':b.customerCsrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:raw??(body===undefined?undefined:JSON.stringify(body))});
      for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),index=pair.indexOf('='),name=pair.slice(0,index),value=pair.slice(index+1);if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}
      return parse(response);
    };
    b.login=async id=>{
      const start=await b.call('/api/customer/pulse/login',{body:{}});assert.equal(start.status,200,JSON.stringify(start.data));
      const state=new URL(start.data.authorizationUrl).searchParams.get('state');
      const back=await b.call('/api/customer/synk-id/callback?'+new URLSearchParams({state,code:id}));
      assert.equal(back.status,302);assert.equal(back.headers.get('location'),'/pulse-app/','로그인 뒤 PULSE 앱으로 돌아온다');
      const session=await b.call('/api/customer/pulse/session');assert.equal(session.data.authenticated,true);b.customerCsrf=session.data.csrfToken;return session.data;
    };
    b.room=async()=>{const r=await b.call('/pulse/api/project');assert.equal(r.status,200,JSON.stringify(r.data));b.roomCsrf=r.data.csrf;return r.data;};
    b.member=(path,body)=>b.call('/api/customer/pulse'+path,body===undefined?{}:{body,customer:true});
    b.proof=async purpose=>{await b.room();const r=await b.call('/pulse/api/project/workspace-proof',{body:{purpose},csrf:b.roomCsrf});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.proof;};
    b.open=async invite=>{const r=await b.call('/pulse/api/open',{body:{invite}});assert.equal(r.status,200,JSON.stringify(r.data));b.roomCsrf=r.data.csrf;return r.data;};
    b.approve=async(view,key=randomUUID())=>{const r=await b.room();return b.call('/pulse/api/persona/approve',{body:{personaId:view.id,kind:view.awaiting.kind,revisionId:view.awaiting.revisionId,viewedHash:view.awaiting.viewedHash,idempotencyKey:key,decision:'approve'},csrf:r.csrf});};
    return b;
  };
  f.act=async(personaId,body)=>{const current=store().get('pulsePersonas',personaId);const r=await f.staff('/api/personas/'+personaId,{body:{revision:current.revision,...body}});assert.equal(r.status,200,body.action+' '+JSON.stringify(r.data));return r.data;};
  f.asset=async(personaId,revisionId,role,bytes,name,type)=>{const current=store().get('pulsePersonas',personaId);const response=await fetch(`${f.base}/api/personas/${personaId}/revisions/${revisionId}/media`,{method:'POST',headers:{Cookie:'synk_company_session='+f.tokens[f.owner.id],'X-CSRF-Token':'csrf-'+f.owner.id,Origin:origin,'Content-Type':type,'X-File-Name':encodeURIComponent(name),'X-Persona-Role':role,'X-Persona-Revision':String(current.revision)},body:bytes});assert.equal(response.status,201,await response.text());};
  // 판 3 흐름으로 쓸 수 있는(ready) 가상 인물 하나: 맞춤 의뢰 → 검토 → 견적 확인 → 기준 얼굴 확인 → 동작 시안 확인.
  f.readyPersona=async b=>{
    b.jar.delete('synk_pulse_request');
    const draft=(await b.call('/pulse/api/request/start',{body:{}})).data.draft;
    const face=await b.call('/pulse/api/request/media',{raw:png,csrf:draft.csrf,headers:{'Content-Type':'image/png','X-File-Name':encodeURIComponent('face.png'),'X-Request-Slot':'persona-identity'}});assert.equal(face.status,201,JSON.stringify(face.data));
    const sent=await b.call('/pulse/api/request/submit',{body:{answers:answers(custom)},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
    const projectId=sent.data.projectId,personaId=store().all('pulsePersonas').find(item=>item.originProjectId===projectId).id;
    await f.act(personaId,{action:'start_review'});
    await f.act(personaId,{action:'send_quote',price:300000,days:7,revisions:2,scope:'기준 얼굴 1판 · 동작 시안 1편'});
    assert.equal((await b.approve((await b.room()).project.persona)).status,200);
    await f.act(personaId,{action:'open_revision'});
    const revisionId=store().all('pulsePersonaRevisions').find(item=>item.personaId===personaId&&item.status==='draft').id;
    await f.asset(personaId,revisionId,'reference',png,'front.png','image/png');
    await f.act(personaId,{action:'publish_reference',revisionId,note:'정면 기준이에요'});
    assert.equal((await b.approve((await b.room()).project.persona)).status,200);
    await f.asset(personaId,revisionId,'motion',mp4,'walk.mp4','video/mp4');
    await f.act(personaId,{action:'publish_motion',revisionId,note:'걷기'});
    assert.equal((await b.approve((await b.room()).project.persona)).status,200);
    assert.equal(store().get('pulsePersonas',personaId).status,'ready');
    const sourceId=store().all('pulsePersonaSources').find(item=>item.personaId===personaId).id;
    return {projectId,personaId,revisionId,sourceId,invite:sent.data.invite};
  };
  // 고객 방에서 「내 모델로 모아 두기」 → 직원 승인(새 브랜드) → 브랜드 id.
  f.linkNewBrand=async(b,name)=>{
    const claim=await b.member('/claim',{proof:await b.proof('workspace-claim')});assert.equal(claim.status,200,JSON.stringify(claim.data));
    const decided=await f.staff('/api/customer-workspaces/claims/'+claim.data.claim.id,{body:{action:'approve',mode:'new',name,note:'지정 승인자 본인이 메일 회신으로 확인'}});
    assert.equal(decided.status,200,JSON.stringify(decided.data));return decided.data.workspace.id;
  };
  // 브랜드 admin이 보관 대기(또는 연장 · 재개) 카드의 조건으로 다시 쓰기 동의.
  f.keep=async(b,workspaceId,personaId)=>{
    const list=(await b.member('/models')).data,space=list.workspaces.find(item=>item.id===workspaceId);
    const card=[...space.pending,...space.models].find(item=>item.id===personaId);assert.ok(card?.consent,'동의할 조건이 보인다');
    const result=await b.member('/reuse',{workspaceId,personaId,revisionId:card.consent.revisionId,viewedHash:card.consent.viewedHash,idempotencyKey:randomUUID()});
    assert.equal(result.status,200,JSON.stringify(result.data));return result.data;
  };
  // 「이 모델로 의뢰」: 초안(쿠키 없으면 새로) → 증표 → 붙이기 → 보내기. 새 프로젝트 id와 초대.
  f.reuseRequest=async(b,workspaceId,personaId,revisionId,{submit=true}={})=>{
    b.jar.delete('synk_pulse_request');
    const draft=(await b.call('/pulse/api/request/start',{body:{}})).data.draft;
    const proof=await b.call('/pulse/api/request/persona-proof',{body:{},csrf:draft.csrf});assert.equal(proof.status,200,JSON.stringify(proof.data));
    const attached=await b.member('/draft-persona',{proof:proof.data.proof,workspaceId,personaId,revisionId});assert.equal(attached.status,200,JSON.stringify(attached.data));
    if(!submit)return {draft};
    const sent=await b.call('/pulse/api/request/submit',{body:{answers:answers({modelChoice:'persona',name:'새 광고'})},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
    return {draft,projectId:sent.data.projectId,invite:sent.data.invite};
  };
  f.confirm=async(projectId,{as=f.owner,usage=USAGE}={})=>{const row=store().get('clientProjects',projectId);return f.staff('/api/customer-workspaces/projects/'+projectId,{as,body:{action:'confirm_request',revision:row.revision,note:'새 광고 범위 확인',usage}});};
  f.personaAct=async(personaId,body,as=f.owner)=>{const current=store().get('pulsePersonas',personaId);return f.staff('/api/customer-workspaces/personas/'+personaId,{as,body:{revision:current.revision,...body}});};
  f.store=store;
  return f;
}
const advance=(f,ms)=>{f.stamp+=ms;};
// 90일 시계의 지우는 날은 그 한국 날짜의 끝(23:59:59.999)으로 올린 순간이다(화면 Fable 5.2 최종 P1) — 기대값과 「그날이 끝난 뒤」 시각.
const endOf=ms=>kstDayEnd(new Date(ms+9*3600000).toISOString().slice(0,10)),afterDay=ms=>Date.parse(endOf(ms))+1000;

test('보관 계산(설계 3-4 · 5판 D13): 한국 날짜 끝 · 12개월(달 끝) · 만료는 ready인 다시 쓰기 인물에만',()=>{
  assert.equal(kstDayEnd('2027-11-10'),'2027-11-10T14:59:59.999Z');
  assert.throws(()=>kstDayEnd('2027-02-30'));
  assert.equal(reuseUntil('2026-11-10T03:00:00Z'),'2027-11-10T14:59:59.999Z');
  assert.equal(reuseUntil('2026-11-09T16:00:00Z'),'2027-11-10T14:59:59.999Z','UTC 16시는 한국 다음 날');
  assert.equal(reuseUntil('2027-02-28T03:00:00Z',12),'2028-02-28T14:59:59.999Z');
  assert.equal(reuseUntil('2028-02-29T03:00:00Z',12),'2029-02-28T14:59:59.999Z','없는 날은 그 달 끝');
  const persona={status:'ready',retention:{scope:'reuse',until:'2027-11-10T14:59:59.999Z',reuseApprovalId:'x'}};
  assert.equal(effectivePersonaStatus(persona,'2027-11-10T14:59:59.998Z'),'ready','그날 한국 시각 끝 직전까지는 쓸 수 있다');
  assert.equal(effectivePersonaStatus(persona,'2027-11-10T14:59:59.999Z'),'expired');
  assert.equal(effectivePersonaStatus({...persona,status:'paused'},'2030-01-01T00:00:00Z'),'paused','중지는 시계가 가리지 않는다');
  assert.equal(effectivePersonaStatus({...persona,retention:{scope:'project'}},'2030-01-01T00:00:00Z'),'ready','프로젝트 전용 인물에는 시계가 없다');
  assert.equal(effectivePersonaStatus({...persona,retention:{scope:'reuse',until:'날짜 아님'}},'2026-01-01T00:00:00Z'),'expired','기한을 읽을 수 없으면 끝난 것으로');
  const workspace={id:'w',status:'active'},approval={id:'x',kind:'reuse',decision:'approve',personaId:'p',workspaceId:'w'},revision={personaId:'p',status:'published'};
  const usable=extra=>personaUsability({persona:{id:'p',workspaceId:'w',...persona,...extra},workspace,approval,revision,now:'2027-01-01T00:00:00Z'});
  assert.equal(usable({}).usable,true);
  assert.equal(usable({workspaceId:'v'}).reason,'workspace');
  assert.equal(personaUsability({persona:{id:'p',workspaceId:'w',...persona},workspace:{...workspace,status:'closed'},approval,revision,now:'2027-01-01T00:00:00Z'}).reason,'closed');
  assert.equal(usable({retention:{scope:'project'}}).reason,'reuse_off');
  assert.equal(usable({retention:{...persona.retention,reuseApprovalId:'y'}}).reason,'reuse_off','다른 동의를 가리키면 아니다');
  assert.equal(usable({status:'deleting'}).reason,'deleting');
  assert.equal(personaUsability({persona:{id:'p',workspaceId:'w',...persona},workspace,approval,revision:{...revision,status:'superseded'},now:'2027-01-01T00:00:00Z'}).reason,'revision');
  for(const status of ['paused','deleted'])assert.ok(PERSONA_SETTLED.includes(status));
  assert.ok(!PERSONA_SETTLED.includes('deleting'),'삭제 진행은 열린 것으로 둔다');
});

test('스위치 끔(설계 4-5): 새 손님 길이 모두 없는 주소이고, 붙임 없는 persona는 저장 · 방 안 의뢰서 모두 거절, 첫 화면 값은 myModels:false',async t=>{
  const f=await fixture(t),b=f.browser();
  for(const [path,body] of [['/api/customer/pulse/models'],['/api/customer/pulse/session'],['/api/customer/pulse/login',{}],['/api/customer/pulse/claim',{proof:'x'}],['/api/customer/pulse/asset/'+randomUUID()]]){
    const result=await b.call(path,body===undefined?{}:{body});assert.equal(result.status,404,path);
  }
  assert.deepEqual((await b.call('/pulse/api/request')).data.features,{locales:['ko'],personaRequest:false,personaReal:false,myModels:false});
  const draft=(await b.call('/pulse/api/request/start',{body:{}})).data.draft;
  assert.equal((await b.call('/pulse/api/request/persona-proof',{body:{},csrf:draft.csrf})).status,404,'초안 증표 길이 없다');
  assert.equal((await b.call('/pulse/api/request/save',{body:{answers:answers({modelChoice:'persona'}),step:'model'},csrf:draft.csrf})).status,409,'붙임 없는 persona 저장');
  const sent=await b.call('/pulse/api/request/submit',{body:{answers:answers()},csrf:draft.csrf});assert.equal(sent.status,201);
  const room=await b.room();
  assert.equal((await b.call('/pulse/api/project/workspace-proof',{body:{purpose:'workspace-claim'},csrf:room.csrf})).status,404,'고객 방 증표 길이 없다');
  const save=await b.call('/pulse/api/studio',{body:{action:'request_save',revision:room.project.revision,answers:answers({modelChoice:'persona'})},csrf:room.csrf});
  assert.equal(save.status,409,'방 안 의뢰서는 persona를 시작하지 않는다');
  // 직원 경로는 스위치와 상관없이 열린다(끈 동안에도 중지 · 삭제 · 정리).
  assert.equal((await f.staff('/api/customer-workspaces')).status,200);
});

test('연결 요청과 증표(설계 4-1 · 3-2 · 5판 D11): 한 번 · 목적 하나 · 5분 · 발급 세션, 같은 사람의 요청은 한 줄, 결정은 직원이 근거와 함께',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);await a.login(ids.a);
  const state=await a.member('/project-state',{proof:await a.proof('workspace-state')});
  assert.equal(state.status,200);assert.deepEqual(state.data,{inWorkspace:false,member:false,pending:false});
  // 다른 목적의 증표는 거절되고, 거절돼도 지워진다(되감기로 되살아나지 않는다).
  const wrong=await a.proof('workspace-state');
  assert.equal((await a.member('/claim',{proof:wrong})).status,409);
  assert.equal((await a.member('/project-state',{proof:wrong})).status,409,'한 번 쓴(거절된) 증표는 다시 못 쓴다');
  const first=await a.member('/claim',{proof:await a.proof('workspace-claim')});assert.equal(first.status,200,JSON.stringify(first.data));
  const used=await a.proof('workspace-claim');
  const again=await a.member('/claim',{proof:used});assert.equal(again.status,200);assert.equal(again.data.claim.id,first.data.claim.id,'같은 프로젝트 · 같은 사람 → 같은 줄');assert.equal(again.data.duplicate,true);
  assert.equal((await a.member('/claim',{proof:used})).status,409,'두 번째 쓰기');
  const late=await a.proof('workspace-claim');advance(f,5*60_000);
  assert.equal((await a.member('/claim',{proof:late})).status,409,'5분 뒤');
  // 발급한 초대 세션이 끝나면 거절.
  const ended=await a.proof('workspace-claim');const roomNow=await a.room();
  assert.equal((await a.call('/pulse/api/logout',{body:{},csrf:roomNow.csrf})).status,200);
  const endedResult=await a.member('/claim',{proof:ended});
  assert.equal(endedResult.status,409,'발급 세션이 끝난 뒤(회원 로그인의 401과 겹치지 않게 증표 거절)');assert.equal(endedResult.data.code,'SYNK_PULSE_PROOF');
  await a.open(x.invite);
  assert.equal(f.store().all('pulseWorkspaceClaims').length,1);
  // 직원 권한: 프로젝트를 못 읽는 크루 · 보기 전용은 결정 못 한다. 근거 한 줄은 필수.
  const claimId=first.data.claim.id;
  assert.equal((await f.staff('/api/customer-workspaces/claims/'+claimId,{as:f.crew,body:{action:'approve',mode:'new',name:'가',note:'확인'}})).status,404);
  assert.equal((await f.staff('/api/customer-workspaces/claims/'+claimId,{as:f.viewer,body:{action:'approve',mode:'new',name:'가',note:'확인'}})).status,403);
  assert.equal((await f.staff('/api/customer-workspaces/claims/'+claimId,{body:{action:'approve',mode:'new',name:'가'}})).status,400,'근거 없이는 못 정한다');
  // 초대 링크를 새로 만든 뒤의 요청은 「다시 요청」.
  const project=f.store().get('clientProjects',x.projectId),reinvite=await f.staff(`/api/client-projects/${x.projectId}/invite`,{body:{revision:project.revision}});assert.equal(reinvite.status,200);
  const list=await f.staff('/api/customer-workspaces');assert.equal(list.data.claims.find(item=>item.id===claimId).stale,true);
  const stale=await f.staff('/api/customer-workspaces/claims/'+claimId,{body:{action:'approve',mode:'new',name:'가 브랜드',note:'확인'}});
  assert.equal(stale.status,409);assert.equal(stale.data.code,'SYNK_PULSE_CLAIM_STALE');
  await a.open(reinvite.data.invite);
  const fresh=await a.member('/claim',{proof:await a.proof('workspace-claim')});assert.equal(fresh.status,200);
  assert.equal(fresh.data.claim.id,claimId,'새 링크로 다시 요청하면 같은 줄을 지금 초대 판으로 다시 적는다(줄은 하나)');assert.equal(fresh.data.renewed,true);
  assert.equal((await f.staff('/api/customer-workspaces')).data.claims.find(item=>item.id===claimId).stale,false);
  // 판 4 운영 시험 P2(11-11): 직원 목록에는 SYNK ID 끝 네 자리(idHint — 프로필 이름이 없으면 「고객」뿐이라 맞춰 볼 단서), 손님이 받는 claim 응답에는 없다.
  const staffClaim=(await f.staff('/api/customer-workspaces')).data.claims.find(item=>item.id===claimId),ownClaim=f.store().get('pulseWorkspaceClaims',claimId);
  assert.equal(staffClaim.idHint,ownClaim.synkUserId.slice(-4).toLowerCase());assert.equal(staffClaim.idHint.length,4);
  assert.ok(!('idHint' in fresh.data.claim)&&!('synkUserId' in fresh.data.claim),'손님 응답에는 ID 단서가 없다');
  assert.equal(f.store().all('pulseWorkspaceClaims').filter(item=>item.status==='pending').length,1);
  const approved=await f.staff('/api/customer-workspaces/claims/'+fresh.data.claim.id,{body:{action:'approve',mode:'new',name:'가 브랜드',note:'지정 승인자 본인이 메일 회신으로 확인'}});
  assert.equal(approved.status,200,JSON.stringify(approved.data));
  const workspace=f.store().get('customerWorkspaces',approved.data.workspace.id);
  assert.equal(workspace.members[0].role,'admin','판매 전 기본은 admin');assert.equal(workspace.staffOwnerId,f.owner.id);
  assert.equal(f.store().get('clientProjects',x.projectId).customerWorkspaceId,workspace.id);
  assert.equal(f.store().get('clientProjects',x.projectId).ownerId,f.intake.id,'ownerId(직원 담당자)는 그대로');
  assert.ok(f.store().all('audit').some(row=>row.action==='pulse-workspace-claim'),'결정은 감사 기록에 남는다');
  assert.deepEqual((await a.member('/project-state',{proof:await a.proof('workspace-state')})).data,{inWorkspace:true,member:true,pending:false,workspace:{id:workspace.id,name:'가 브랜드',role:'admin'}});
  // 같은 프로젝트에 다른 사람이 합류 요청 → 합류(새 브랜드를 만들지 않음).
  const a2=f.browser();
  const project2=f.store().get('clientProjects',x.projectId),invite2=await f.staff(`/api/client-projects/${x.projectId}/invite`,{body:{revision:project2.revision}});
  await a2.open(invite2.data.invite);await a2.login(ids.a2);
  const join=await a2.member('/claim',{proof:await a2.proof('workspace-claim')});assert.equal(join.status,200);
  assert.equal((await f.staff('/api/customer-workspaces/claims/'+join.data.claim.id,{body:{action:'approve',mode:'new',name:'또 다른 브랜드',note:'확인'}})).status,409,'이미 연결된 프로젝트는 합류만');
  const joined=await f.staff('/api/customer-workspaces/claims/'+join.data.claim.id,{body:{action:'approve',role:'member',note:'담당자가 통화로 확인'}});
  assert.equal(joined.status,200,JSON.stringify(joined.data));assert.equal(joined.data.workspace.id,workspace.id);
  assert.equal(f.store().get('customerWorkspaces',workspace.id).members.length,2);
});

test('시나리오 5 · 동의 주체 · 경합: 보관 대기는 그 브랜드 admin만 보고 동의하고, 고객 사이 인물 · 그림 · 출처 사진이 섞이지 않는다',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);await a.login(ids.a);const wa=await f.linkNewBrand(a,'가 브랜드');
  const b=f.browser(),y=await f.readyPersona(b);await b.login(ids.b);const wb=await f.linkNewBrand(b,'나 브랜드');
  const c=f.browser();await c.login(ids.c);
  assert.deepEqual((await c.member('/models')).data,{workspaces:[]},'회원이 아닌 SYNK ID는 빈 목록');
  let list=(await a.member('/models')).data;assert.equal(list.workspaces.length,1);
  const pending=list.workspaces[0].pending;assert.deepEqual(pending.map(item=>item.id),[x.personaId],'A에게는 A의 보관 대기만');
  const image=pending[0].image.split('/').at(-1);
  assert.equal((await a.call(pending[0].image)).status,200,'보관 대기 그림은 그 브랜드 admin에게 열린다');
  assert.equal((await b.call(pending[0].image)).status,404,'B 회원은 A 인물의 공개 판 그림을 직접 불러도 404');
  assert.equal((await c.call(pending[0].image)).status,404);
  for(const source of [x.sourceId,y.sourceId])for(const who of [a,b])assert.equal((await who.call('/api/customer/pulse/asset/'+source)).status,404,'출처 사진은 어느 고객 길로도 0');
  assert.equal((await a.call('/pulse/api/persona/media/'+x.sourceId)).status,404);
  const response=await a.call(pending[0].image);assert.equal(response.headers.get('cache-control'),'private, no-store');
  // 동의: 바뀐 해시는 409 + 새 조건, 다른 브랜드 admin은 없는 것처럼, 회원(member)은 403.
  const consent=pending[0].consent;
  const stale=await a.member('/reuse',{workspaceId:wa,personaId:x.personaId,revisionId:consent.revisionId,viewedHash:'0'.repeat(64),idempotencyKey:randomUUID()});
  assert.equal(stale.status,409);assert.equal(stale.data.code,'SYNK_PULSE_REUSE_STALE');assert.equal(stale.data.offer.viewedHash,consent.viewedHash);
  assert.equal((await b.member('/reuse',{workspaceId:wb,personaId:x.personaId,revisionId:consent.revisionId,viewedHash:consent.viewedHash,idempotencyKey:randomUUID()})).status,404,'다른 브랜드 admin');
  assert.equal((await b.member('/reuse',{workspaceId:wa,personaId:x.personaId,revisionId:consent.revisionId,viewedHash:consent.viewedHash,idempotencyKey:randomUUID()})).status,404,'회원이 아닌 브랜드');
  const workspace=f.store().get('customerWorkspaces',wa),member=workspace.members[0];
  assert.equal((await f.staff('/api/customer-workspaces/'+wa)).data.workspace.members[0].idHint,member.synkUserId.slice(-4).toLowerCase(),'브랜드 회원 줄에도 ID 끝 네 자리(직원 화면)');
  assert.equal((await f.staff('/api/customer-workspaces/'+wa,{body:{action:'set_role',revision:workspace.revision,memberId:member.id,role:'member',note:'역할 시험'}})).status,200);
  assert.equal((await a.member('/reuse',{workspaceId:wa,personaId:x.personaId,revisionId:consent.revisionId,viewedHash:consent.viewedHash,idempotencyKey:randomUUID()})).status,403,'member는 보관을 정하지 못한다');
  assert.equal((await a.member('/models')).data.workspaces[0].pending.length,0,'member에게는 보관 대기가 없다');
  assert.equal((await a.call(pending[0].image)).status,404,'보관 대기 그림은 admin에게만');
  const back=f.store().get('customerWorkspaces',wa);await f.staff('/api/customer-workspaces/'+wa,{body:{action:'set_role',revision:back.revision,memberId:member.id,role:'admin',note:'되돌림'}});
  // 동시에 둘: 둘 다 같은 조건이면 차례로 들어가고, 유효한 동의는 뒤의 하나다(앞의 것을 supersedes로 대신).
  const key1=randomUUID(),key2=randomUUID();
  const [one,two]=await Promise.all([key1,key2].map(key=>a.member('/reuse',{workspaceId:wa,personaId:x.personaId,revisionId:consent.revisionId,viewedHash:consent.viewedHash,idempotencyKey:key})));
  assert.equal(one.status,200);assert.equal(two.status,200);
  const persona=f.store().get('pulsePersonas',x.personaId),reuse=f.store().all('pulsePersonaApprovals').filter(item=>item.kind==='reuse');
  assert.equal(persona.workspaceId,wa);assert.equal(persona.retention.scope,'reuse');assert.equal(persona.retention.until,reuseUntil(new Date(f.stamp).toISOString()));
  assert.equal(reuse.length,2);const latest=reuse.find(item=>item.id===persona.retention.reuseApprovalId);
  assert.equal(latest.supersedes,reuse.find(item=>item.id!==latest.id).id);assert.equal(latest.authMethod,'synk-member');assert.equal(latest.projectId,null);
  assert.equal((await a.member('/reuse',{workspaceId:wa,personaId:x.personaId,revisionId:consent.revisionId,viewedHash:consent.viewedHash,idempotencyKey:key1})).data.duplicate,true,'같은 키는 한 번');
  // 귀속 뒤에는 원 프로젝트 방의 승인 목록에 다시 쓰기 동의가 섞이지 않는다.
  assert.ok(!(await a.room()).project.persona.approvals.some(item=>item.kind==='reuse'));
  list=(await a.member('/models')).data;assert.equal(list.workspaces[0].models[0].usable,true);assert.equal(list.workspaces[0].pending.length,0);
  // B는 A의 인물을 붙이지 못한다(남의 personaId → 404).
  b.jar.delete('synk_pulse_request');const draft=(await b.call('/pulse/api/request/start',{body:{}})).data.draft;
  const proof=(await b.call('/pulse/api/request/persona-proof',{body:{},csrf:draft.csrf})).data.proof;
  assert.equal((await b.member('/draft-persona',{proof,workspaceId:wb,personaId:x.personaId,revisionId:x.revisionId})).status,404);
});

test('시나리오 8: 다시 쓰기 의뢰는 사진 · 학습 없이 붙이기 → 보내기 → 직원 연결 확인 → 사용 확인 → 제작 시작까지 간다(담당자는 브랜드 담당)',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);await a.login(ids.a);const wa=await f.linkNewBrand(a,'가 브랜드');await f.keep(a,wa,x.personaId);
  const sourcesBefore=f.store().all('pulsePersonaSources').length,revisionsBefore=f.store().all('pulsePersonaRevisions').length;
  // 붙임과 모델 선택: 붙인 뒤 카탈로그로 바꿔 저장하면 붙임이 지워지고, 붙임 없이 persona 저장은 409.
  const {draft}=await f.reuseRequest(a,wa,x.personaId,x.revisionId,{submit:false});
  let row=f.store().get('pulseRequests',draft.id);assert.equal(row.answers.modelChoice,'persona');assert.deepEqual(row.answers.models,[]);assert.equal(row.personaAttach.personaId,x.personaId);
  assert.equal((await a.call('/pulse/api/request/save',{body:{answers:answers({modelChoice:'persona',models:['F02']}),step:'model'},csrf:draft.csrf})).status,200);
  assert.deepEqual(f.store().get('pulseRequests',draft.id).answers.models,[],'persona면 카탈로그 모델을 비운다');
  assert.equal((await a.call('/pulse/api/request/save',{body:{answers:answers({modelChoice:'ask'}),step:'model'},csrf:draft.csrf})).status,200);
  assert.equal(f.store().get('pulseRequests',draft.id).personaAttach,undefined,'다른 선택으로 바꾸면 붙임을 지운다');
  assert.equal((await a.call('/pulse/api/request/save',{body:{answers:answers({modelChoice:'persona'}),step:'model'},csrf:draft.csrf})).status,409);
  assert.equal((await a.call('/pulse/api/request/submit',{body:{answers:answers({modelChoice:'persona'})},csrf:draft.csrf})).status,409,'붙임 없이 persona 보내기');
  const proof=(await a.call('/pulse/api/request/persona-proof',{body:{},csrf:draft.csrf})).data.proof;
  assert.equal((await a.member('/draft-persona',{proof,workspaceId:wa,personaId:x.personaId,revisionId:x.revisionId})).status,200);
  // 저장 뒤 화면에서 선택을 바꿔 바로 보내도 몸통 기준으로 간다(카탈로그로).
  const catalog=await a.call('/pulse/api/request/submit',{body:{answers:answers({modelChoice:'',models:['F02']})},csrf:draft.csrf});assert.equal(catalog.status,201);
  assert.equal(f.store().get('clientProjects',catalog.data.projectId).workspaceRequest,undefined);
  // 초안 쿠키 없이 「이 모델로 의뢰」 → 초안 생성 → 증표 → 붙임 → 보내기.
  const sent=await f.reuseRequest(a,wa,x.personaId,x.revisionId);
  const p=f.store().get('clientProjects',sent.projectId);
  assert.deepEqual({...p.workspaceRequest,attachedAt:undefined},{workspaceId:wa,personaId:x.personaId,revisionId:x.revisionId,attachedBy:ids.a,attachedAt:undefined});
  assert.equal(p.ownerId,f.owner.id,'담당자는 브랜드 담당(공개 의뢰서 담당은 접수 담당)');assert.equal(p.customerWorkspaceId,undefined,'연결은 직원이 확인할 때');
  assert.equal(p.studio.request.answers.modelChoice,'persona');
  // 확인 전에는 초대 세션에 인물 자산이 열리지 않는다.
  let room=await a.room();assert.equal(Object.hasOwn(room.project,'persona'),false);
  const asset=f.store().get('pulsePersonaRevisions',x.revisionId).reference.assetIds[0];
  assert.equal((await a.call('/pulse/api/persona/media/'+asset)).status,404);
  // 직원 연결 확인: 브랜드를 맡지 않은 크루는 못 하고, 사용 범위(목적 · 매체 · 기간)는 필수.
  assert.equal((await f.confirm(sent.projectId,{as:f.intake})).status,404,'그 프로젝트를 못 읽는 직원');
  assert.equal((await f.confirm(sent.projectId,{usage:{...USAGE,media:''}})).status,400);
  const confirmed=await f.confirm(sent.projectId);assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));
  assert.equal(f.store().get('clientProjects',sent.projectId).customerWorkspaceId,wa);
  room=await a.room();const view=room.project.persona;
  assert.equal(view.mode,'reuse');assert.equal(view.awaiting.kind,'usage');assert.equal(view.sources.files.length,0);assert.equal(view.quote,null);assert.deepEqual(view.events,[]);
  assert.equal((await a.call('/pulse/api/persona/media/'+asset)).status,200,'참조한 판의 공개 자산만 열린다');
  assert.equal((await a.call('/pulse/api/persona/media/'+x.sourceId)).status,404);
  // 이 방에서는 사용 확인(usage)만 — 다른 종류는 최신 판 안내(409).
  const wrongKind=await a.call('/pulse/api/persona/approve',{body:{personaId:view.id,kind:'reference',revisionId:view.awaiting.revisionId,viewedHash:view.awaiting.viewedHash,idempotencyKey:randomUUID(),decision:'approve'},csrf:room.csrf});
  assert.equal(wrongKind.status,409);
  assert.equal((await a.approve(view)).status,200);
  const project=f.store().get('clientProjects',sent.projectId);
  assert.deepEqual(project.studio.strategy.data.castingSelection.personaRef,{personaId:x.personaId,revisionId:x.revisionId});
  // 제작 시작(이미지 판 확인)까지: 실제 가드로 다시 본다.
  const at=new Date(f.stamp).toISOString(),clock=()=>new Date(f.stamp).toISOString(),guard=createPersonaGuard(f.store(),{clock});
  const start=()=>{const row=structuredClone(f.store().get('clientProjects',sent.projectId));const studio=row.studio;studio.request={...studio.request,status:'confirmed',confirmedAt:at,payment:{status:'confirmed',confirmedAt:at},rounds:[{round:1,kind:'images',oneLine:'한 문장',sentAt:at,scenes:[]}]};applyRequestAction({studio,row,input:{action:'approve_draft',round:1,terms:true},staff:false,stamp:{author:'customer',authorId:'customer',authorName:'손님',at},personas:guard});return row;};
  assert.equal(start().stage,'producing');
  assert.equal(f.store().all('pulsePersonaSources').length,sourcesBefore,'사진 업로드 0');assert.equal(f.store().all('pulsePersonaRevisions').length,revisionsBefore,'새 판(학습) 0');
  // 방 안 의뢰서: 다시 쓰기 프로젝트는 고른 persona를 그대로 둘 수 있다.
  room=await a.room();
  const keep=await a.call('/pulse/api/studio',{body:{action:'request_save',revision:room.project.revision,answers:answers({modelChoice:'persona',models:['F02']})},csrf:room.csrf});
  assert.equal(keep.status,200,JSON.stringify(keep.data));assert.deepEqual(f.store().get('clientProjects',sent.projectId).studio.request.answers.models,[]);
  // 연결을 끊은 직후 그 프로젝트에서는 제작 시작 · 사용 확인이 막힌다.
  const linked=f.store().get('clientProjects',sent.projectId);
  assert.equal((await f.staff('/api/customer-workspaces/projects/'+sent.projectId,{body:{action:'unlink',revision:linked.revision,note:'잘못 연결 시험'}})).status,200);
  assert.throws(()=>start(),error=>error.status===409);
  assert.equal(Object.hasOwn((await a.room()).project,'persona'),false);
});

test('시나리오 9: 만료 · 중지 · 철회 · 닫힌 브랜드는 붙이기 · 보내기 · 연결 확인 · 제작 시작을 막고, 연장 · 재개는 새 동의로만 — 제작 중인 프로젝트는 그대로',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);await a.login(ids.a);const wa=await f.linkNewBrand(a,'가 브랜드');await f.keep(a,wa,x.personaId);
  // 제작 중인 다시 쓰기 프로젝트 하나와, 보내기만 한 프로젝트 하나.
  const running=await f.reuseRequest(a,wa,x.personaId,x.revisionId);assert.equal((await f.confirm(running.projectId)).status,200);
  assert.equal((await a.approve((await a.room()).project.persona)).status,200);
  const runningRow=f.store().get('clientProjects',running.projectId);f.store().put('clientProjects',runningRow.id,{...runningRow,stage:'producing'});
  const waiting=await f.reuseRequest(a,wa,x.personaId,x.revisionId);
  // 끝 날짜를 한 시간 뒤로 둔 동의(보관 칸만 — 한국 날짜 경계 자체는 순수 함수 시험이 본다): 직전은 쓸 수 있고, 끝 순간부터 기간 끝.
  const near=new Date(f.stamp+3600_000).toISOString(),held=f.store().get('pulsePersonas',x.personaId);
  f.store().put('pulsePersonas',held.id,{...held,retention:{...held.retention,until:near}});
  f.stamp=Date.parse(near)-1;let card=(await a.member('/models')).data.workspaces[0].models[0];assert.equal(card.status,'ready');
  f.stamp=Date.parse(near);card=(await a.member('/models')).data.workspaces[0].models[0];assert.equal(card.status,'expired');assert.equal(card.usable,false);assert.equal(card.reason,'expired');
  const until=near;
  const blocked=async label=>{
    const draftTry=await f.reuseRequest(a,wa,x.personaId,x.revisionId,{submit:false}).catch(error=>error);
    assert.ok(draftTry instanceof Error,label+': 붙이기');
    assert.equal((await f.confirm(waiting.projectId)).status,409,label+': 연결 확인');
  };
  await blocked('만료');
  assert.equal(f.store().get('clientProjects',running.projectId).stage,'producing','이미 제작 중인 프로젝트는 그대로');
  assert.ok(f.store().all('pulsePersonaApprovals').some(item=>item.kind==='usage'&&item.projectId===running.projectId),'이전 확인 이력은 그대로');
  // 연장은 새 동의뿐 → 다시 쓸 수 있음.
  await f.keep(a,wa,x.personaId);card=(await a.member('/models')).data.workspaces[0].models[0];assert.equal(card.usable,true);
  assert.ok(Date.parse(f.store().get('pulsePersonas',x.personaId).retention.until)>Date.parse(until));
  // 사용 중지(브랜드 admin 요청) → 즉시 paused, 보관 날짜가 지나도 paused로 보인다.
  assert.equal((await a.member('/stop',{workspaceId:wa,personaId:x.personaId,note:'광고 중단'})).status,200);
  await blocked('중지');
  const pausedDoc=f.store().get('pulsePersonas',x.personaId);
  f.store().put('pulsePersonas',pausedDoc.id,{...pausedDoc,retention:{...pausedDoc.retention,until:new Date(f.stamp-1).toISOString()}});
  card=(await a.member('/models')).data.workspaces[0].models[0];assert.equal(card.status,'paused','보관 날짜가 지나도 중지로 보인다');
  const keepPaused=(await a.member('/models')).data.workspaces[0].models[0].consent;assert.equal(keepPaused,null,'중지 중에는 새 동의를 받지 않는다');
  // 재개 = 관리자 중지 풀기 + 새 동의. 풀기만 하면 다시 쓰기는 꺼져 있다.
  assert.equal((await f.personaAct(x.personaId,{action:'unpause',note:'고객 요청으로 재개'},f.intake)).status,403,'풀기는 관리자만');
  assert.equal((await f.personaAct(x.personaId,{action:'unpause',note:'고객 요청으로 재개'})).status,200);
  card=(await a.member('/models')).data.workspaces[0].models[0];assert.equal(card.reason,'reuse_off');
  await f.keep(a,wa,x.personaId);assert.equal((await a.member('/models')).data.workspaces[0].models[0].usable,true);
  // 철회 → 다시 쓰기 꺼짐(내 모델에는 남음).
  assert.equal((await a.member('/reuse/withdraw',{workspaceId:wa,personaId:x.personaId,note:''})).status,200);
  card=(await a.member('/models')).data.workspaces[0].models[0];assert.equal(card.reason,'reuse_off');assert.equal(card.reuse,false);
  await blocked('철회');
  await f.keep(a,wa,x.personaId);
  // 닫힌 브랜드: 회원 길에서 없는 것처럼 → 다시 열면 돌아온다.
  let workspace=f.store().get('customerWorkspaces',wa);
  assert.equal((await f.staff('/api/customer-workspaces/'+wa,{body:{action:'close',revision:workspace.revision,note:'계약 종료'}})).status,200);
  assert.deepEqual((await a.member('/models')).data,{workspaces:[]});
  assert.equal((await f.confirm(waiting.projectId)).status,409,'닫힘: 연결 확인');
  const desk=await f.staff('/api/customer-workspaces/'+wa);assert.ok(desk.data.workspace.todos.some(item=>item.why==='closed'&&item.projects.some(project=>project.id===running.projectId)),'진행 중 프로젝트는 직원 할 일로');
  workspace=f.store().get('customerWorkspaces',wa);
  assert.equal((await f.staff('/api/customer-workspaces/'+wa,{body:{action:'reopen',revision:workspace.revision,note:'재계약'},as:f.intake})).status,403);
  assert.equal((await f.staff('/api/customer-workspaces/'+wa,{body:{action:'reopen',revision:workspace.revision,note:'재계약'}})).status,200);
  assert.equal((await a.member('/models')).data.workspaces[0].models[0].usable,true,'다시 열면 회원 접근이 돌아온다');
  // 회원을 뺀 직후 models · draft-persona · 보내기가 막힌다(캐시 없음).
  const {draft}=await f.reuseRequest(a,wa,x.personaId,x.revisionId,{submit:false});
  workspace=f.store().get('customerWorkspaces',wa);
  assert.equal((await f.staff('/api/customer-workspaces/'+wa,{body:{action:'remove_member',revision:workspace.revision,memberId:workspace.members[0].id,note:'퇴사'}})).status,200);
  assert.deepEqual((await a.member('/models')).data,{workspaces:[]});
  const late=await a.call('/pulse/api/request/submit',{body:{answers:answers({modelChoice:'persona'})},csrf:draft.csrf});
  assert.equal(late.status,409);assert.equal(late.data.code,'SYNK_PULSE_ATTACH_STALE');
});

test('삭제(설계 5-6 · 5판 D10): 끝나지 않은 참조가 있으면 막고, 문서 먼저 · 파일 나중 — 백업 목록이 커밋 순간부터 맞고, 멈춘 삭제는 서버 시작 때 묘비까지 끝난다',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);await a.login(ids.a);const wa=await f.linkNewBrand(a,'가 브랜드');await f.keep(a,wa,x.personaId);
  const reuse=await f.reuseRequest(a,wa,x.personaId,x.revisionId);assert.equal((await f.confirm(reuse.projectId)).status,200);
  // 고객 삭제 요청은 직원 할 일만 만든다.
  assert.equal((await a.member('/delete-request',{workspaceId:wa,personaId:x.personaId,note:'더 안 써요'})).status,200);
  assert.equal(f.store().get('pulsePersonas',x.personaId).status,'ready');
  assert.ok((await f.staff('/api/customer-workspaces/'+wa)).data.workspace.todos.some(item=>item.why==='deletion_requested'));
  assert.equal((await f.personaAct(x.personaId,{action:'delete',note:'고객 요청'},f.intake)).status,403,'삭제는 관리자만');
  let refused=await f.personaAct(x.personaId,{action:'delete',note:'고객 요청'});
  assert.equal(refused.status,409);assert.deepEqual(refused.data.references.projects.map(item=>item.id).sort(),[x.projectId,reuse.projectId].sort(),'연결 확인 뒤 · 사용 확인 전 다시 쓰기 프로젝트와 진행 중 원 프로젝트');
  // 두 프로젝트를 끝내면(보관) 24시간 안 초안 붙임이 남아 막는다 — 삭제와 붙이기는 하나만 이긴다.
  for(const id of [x.projectId,reuse.projectId]){const row=f.store().get('clientProjects',id);f.store().put('clientProjects',id,{...row,stage:'archived'});}
  const {draft}=await f.reuseRequest(a,wa,x.personaId,x.revisionId,{submit:false});
  refused=await f.personaAct(x.personaId,{action:'delete',note:'고객 요청'});assert.equal(refused.status,409);assert.equal(refused.data.references.drafts,1);assert.deepEqual((await f.staff('/api/customer-workspaces/'+wa)).data.workspace.todos.filter(item=>item.why==='deletion_requested').map(item=>[item.projects.length,item.hidden,item.drafts]),[[0,0,1]],'할 일도 초안 붙임을 센다(최종 검수 P2 — 「정리 끝」으로 읽지 않게)');
  assert.equal((await a.call('/pulse/api/request/save',{body:{answers:answers({modelChoice:'ask'}),step:'model'},csrf:draft.csrf})).status,200);
  // 지울 파일 이름 · 백업 목록.
  const names=[...f.store().all('pulsePersonaSources').filter(item=>item.personaId===x.personaId).map(item=>item.diskName),...f.store().get('pulsePersonaRevisions',x.revisionId).assets.map(item=>item.diskName)];
  const media=name=>join(f.store().directory,'studio-media',name);
  for(const name of names)assert.ok(await stat(media(name)));
  const deleted=await f.personaAct(x.personaId,{action:'delete',note:'고객 요청 · 관리자 확인'});assert.equal(deleted.status,200,JSON.stringify(deleted.data));
  const tomb=f.store().get('pulsePersonas',x.personaId);
  assert.equal(tomb.status,'deleted');assert.ok(tomb.deletedAt);assert.deepEqual(tomb.pendingUnlink,[]);assert.equal(tomb.request,undefined,'손님 요청 글은 지운다');assert.equal(tomb.displayName,'');
  assert.deepEqual(tomb.revisionIds,[x.revisionId]);
  for(const name of names)await assert.rejects(stat(media(name)),'파일을 지웠다');
  const source=f.store().all('pulsePersonaSources').find(item=>item.personaId===x.personaId);assert.equal(source.diskName,null);assert.ok(source.deletedAt);assert.equal(source.fileName,undefined);
  const revision=f.store().get('pulsePersonaRevisions',x.revisionId);assert.deepEqual(revision.assets,[]);assert.equal(revision.reference,null);assert.ok(revision.deletedAt);assert.ok(revision.sent.length>0,'보낸 id 목록은 둔다');
  assert.ok(f.store().all('pulsePersonaApprovals').some(item=>item.personaId===x.personaId&&item.kind==='reference'&&item.shown.assetIds.length),'승인 기록(무엇을 언제 확인했는지)은 남긴다');
  for(const name of workspaceMediaNames(f.store().db))assert.ok(await stat(media(name)),'백업 목록의 파일은 모두 있다');
  assert.ok(!openPersonaProjectIds(f.store()).has(x.projectId),'묘비 뒤 원 프로젝트는 다시 90일 정리 대상');
  assert.ok(f.store().all('audit').some(row=>row.action==='pulse-workspace-persona'));
  // 도중에 멈춘 삭제: 커밋 뒤 · 파일 지우기 전(deleting + pendingUnlink)에도 백업 목록이 맞고, 서버를 다시 띄우면 이어서 묘비까지.
  const b=f.browser(),y=await f.readyPersona(b);
  const ynames=[...f.store().all('pulsePersonaSources').filter(item=>item.personaId===y.personaId).map(item=>item.diskName),...f.store().get('pulsePersonaRevisions',y.revisionId).assets.map(item=>item.diskName)];
  const yrow=f.store().get('clientProjects',y.projectId);f.store().put('clientProjects',y.projectId,{...yrow,stage:'archived'});
  const at=new Date(f.stamp).toISOString(),persona=f.store().get('pulsePersonas',y.personaId);
  f.store().transaction(()=>{
    for(const item of f.store().all('pulsePersonaSources').filter(entry=>entry.personaId===y.personaId))f.store().put('pulsePersonaSources',item.id,{id:item.id,personaId:item.personaId,projectId:item.projectId,purpose:item.purpose,diskName:null,deletedAt:at});
    const rev=f.store().get('pulsePersonaRevisions',y.revisionId);f.store().put('pulsePersonaRevisions',rev.id,{...rev,assets:[],reference:null,motion:null,method:null,deletedAt:at});
    f.store().put('pulsePersonas',persona.id,{...persona,status:'deleting',pendingUnlink:ynames});
  });
  const listed=new Set(workspaceMediaNames(f.store().db));for(const name of ynames)assert.ok(!listed.has(name),'커밋 순간부터 백업 목록에서 빠진다');
  for(const name of listed)assert.ok(await stat(media(name)),'백업이 도는 중이어도 목록의 파일은 다 있다');
  await f.restart();
  assert.equal(f.store().get('pulsePersonas',y.personaId).status,'deleted','서버 시작 때 이어서 묘비까지');
  for(const name of ynames)await assert.rejects(stat(media(name)));
  // 파일 지우기가 막혀도(여기서는 같은 이름의 폴더) 500이 아니라 「지우는 중」과 남은 수를 돌려주고 감사 기록이 남는다 → 막힌 것을 치우면 이어 하기로 묘비까지.
  const c=f.browser(),z=await f.readyPersona(c),zrow=f.store().get('clientProjects',z.projectId);f.store().put('clientProjects',z.projectId,{...zrow,stage:'archived'});
  const stuck=f.store().get('pulsePersonaRevisions',z.revisionId).assets[0].diskName;
  const {mkdir,rm:remove,writeFile}=await import('node:fs/promises');
  await remove(media(stuck));await mkdir(media(stuck));
  const auditsBefore=f.store().all('audit').filter(row=>row.action==='pulse-workspace-persona').length;
  const blockedDelete=await f.personaAct(z.personaId,{action:'delete',note:'관리자 확인'});
  assert.equal(blockedDelete.status,200,JSON.stringify(blockedDelete.data));assert.equal(blockedDelete.data.persona.status,'deleting');assert.equal(blockedDelete.data.retry,true);assert.ok(blockedDelete.data.pendingUnlink>=1);
  assert.equal(f.store().all('audit').filter(row=>row.action==='pulse-workspace-persona').length,auditsBefore+1,'감사 기록이 남는다');
  await remove(media(stuck),{recursive:true});await writeFile(media(stuck),'x');
  const continued=await f.staff('/api/customer-workspaces/personas/'+z.personaId,{body:{action:'delete_continue'}});
  assert.equal(continued.status,200,JSON.stringify(continued.data));assert.equal(continued.data.persona.status,'deleted');await assert.rejects(stat(media(stuck)));
});

test('직원 브랜드 화면은 그 직원이 못 읽는 프로젝트 제목을 싣지 않는다(Fable P2-1) — 수만',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);await a.login(ids.a);const wa=await f.linkNewBrand(a,'가 브랜드');await f.keep(a,wa,x.personaId);
  // 다른 팀 크루가 맡은 프로젝트를 같은 브랜드에 연결한다 — 크루는 브랜드를 보지만 원 프로젝트(접수 담당 몫)는 못 읽는다.
  const made=await f.staff('/api/client-projects',{as:f.crew,body:{title:'크루 프로젝트',customerName:'가 손님'}});assert.equal(made.status,201,JSON.stringify(made.data));
  const crewProject=f.store().get('clientProjects',made.data.project.id);
  assert.equal((await f.staff('/api/customer-workspaces/projects/'+crewProject.id,{body:{action:'link',workspaceId:wa,revision:crewProject.revision,note:'같은 손님'}})).status,200);
  assert.equal((await f.staff('/api/client-projects/'+x.projectId+'/studio',{as:f.crew})).status,404,'크루는 원 프로젝트를 못 읽는다');
  const view=await f.staff('/api/customer-workspaces/'+wa,{as:f.crew});assert.equal(view.status,200,JSON.stringify(view.data));
  const persona=view.data.workspace.personas.find(item=>item.id===x.personaId);
  assert.ok(!persona.references.projects.some(item=>item.id===x.projectId),'못 읽는 프로젝트 제목은 없다');assert.equal(persona.references.hidden,1);
  assert.equal(JSON.stringify(view.data).includes('합성 탄산수'),false,'원 프로젝트 이름이 새지 않는다');
  const admin=await f.staff('/api/customer-workspaces/'+wa);assert.ok(admin.data.workspace.personas.find(item=>item.id===x.personaId).references.projects.some(item=>item.id===x.projectId),'관리자는 본다');
});

test('귀속 · 교정(설계 3-4 · 5-7): 한 번 귀속되면 원 프로젝트를 끊고 다른 브랜드에 이어도 그대로, 관리자 귀속 취소는 다시 쓰기 참조가 0일 때만',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);await a.login(ids.a);const wa=await f.linkNewBrand(a,'가 브랜드');await f.keep(a,wa,x.personaId);
  // 원 프로젝트를 끊고 다른 브랜드 B에 이어도 귀속은 A 그대로, B 목록 · 보관 대기에 없다.
  let row=f.store().get('clientProjects',x.projectId);
  assert.equal((await f.staff('/api/customer-workspaces/projects/'+x.projectId,{body:{action:'unlink',revision:row.revision,note:'잘못 연결'}})).status,200);
  const other=f.browser(),z=await f.readyPersona(other);await other.login(ids.b);const wb=await f.linkNewBrand(other,'나 브랜드');
  row=f.store().get('clientProjects',x.projectId);
  assert.equal((await f.staff('/api/customer-workspaces/projects/'+x.projectId,{body:{action:'link',workspaceId:wb,revision:row.revision,note:'옮겨 연결'}})).status,200);
  assert.equal(f.store().get('pulsePersonas',x.personaId).workspaceId,wa);
  let bview=(await other.member('/models')).data.workspaces[0];assert.ok(![...bview.models,...bview.pending].some(item=>item.id===x.personaId));
  assert.equal((await a.member('/models')).data.workspaces[0].models[0].id,x.personaId,'원 프로젝트가 끊겨도 A의 내 모델에 남는다');
  // 끝나지 않은 다시 쓰기 의뢰가 있으면 귀속 취소가 막힌다.
  const reuse=await f.reuseRequest(a,wa,x.personaId,x.revisionId);
  let refused=await f.personaAct(x.personaId,{action:'unassign',note:'잘못 귀속'});assert.equal(refused.status,409);assert.deepEqual(refused.data.references.projects.map(item=>item.id),[reuse.projectId]);
  assert.equal((await f.personaAct(x.personaId,{action:'unassign',note:'잘못 귀속'},f.intake)).status,403);
  const done=f.store().get('clientProjects',reuse.projectId);f.store().put('clientProjects',done.id,{...done,stage:'archived'});
  assert.equal((await f.personaAct(x.personaId,{action:'unassign',note:'잘못 귀속 — 관리자 교정'})).status,200);
  const persona=f.store().get('pulsePersonas',x.personaId);assert.equal(persona.workspaceId,null);assert.equal(persona.retention.scope,'project');
  assert.ok(f.store().all('pulsePersonaApprovals').some(item=>item.kind==='reuse'&&item.decision==='withdraw'&&item.personaId===x.personaId),'동의는 철회 줄로 남는다');
  bview=(await other.member('/models')).data.workspaces[0];assert.ok(bview.pending.some(item=>item.id===x.personaId),'그 뒤 B에 연결된 원 프로젝트로 B의 보관 대기에 나타난다');
  assert.deepEqual((await a.member('/models')).data.workspaces[0].models,[]);
  assert.ok(z);
});

test('로그인 돌아오기(5판 D1): PULSE 로그인은 /pulse-app/으로, 실패도 PULSE로(?login=failed), 흐름을 못 찾으면 상담 화면 — synk-id/start는 빈 몸통만',async t=>{
  const f=await fixture(t);await f.features({myModels:true});
  const b=f.browser();
  const start=await b.call('/api/customer/pulse/login',{body:{}});assert.equal(start.status,200);
  assert.equal((await b.call('/api/customer/pulse/login',{body:{returnTo:'https://attacker.example/'}})).status,400);
  const state=new URL(start.data.authorizationUrl).searchParams.get('state');
  const denied=await b.call('/api/customer/synk-id/callback?'+new URLSearchParams({state,error:'access_denied'}));
  assert.equal(denied.status,302);assert.equal(denied.headers.get('location'),'/pulse-app/?login=failed');
  const lost=await b.call('/api/customer/synk-id/callback?'+new URLSearchParams({state:'A'.repeat(43),code:ids.a}));
  assert.equal(lost.headers.get('location'),'/consultation/?login=failed','흐름을 못 찾은 실패');
  assert.equal((await b.call('/api/customer/synk-id/start',{body:{returnTo:'/pulse-app/'}})).status,400,'상담 로그인 시작은 빈 몸통만');
  await b.login(ids.a);
  assert.equal((await b.call('/api/customer/pulse/models?x=1')).status,400,'질의 금지');
  // CSRF 없는 쓰기는 거절.
  assert.equal((await b.call('/api/customer/pulse/claim',{body:{proof:'x'}})).status,403);
});

test('유료 생성 · 학습 · 네트워크를 부르지 않는다: 브랜드 모듈 · 회원 경로의 import 목록',async()=>{
  const source=await readFile(new URL('./pulse-workspaces.mjs',import.meta.url),'utf8');
  const imports=[...source.matchAll(/^import\s.+?from\s+'([^']+)';/gm)].map(match=>match[1]).sort();
  assert.deepEqual(imports,['./public/pulse-app/casting-choice.mjs','./pulse-personas.mjs','./pulse-translations.mjs','./workspace-media.mjs','node:crypto','node:fs/promises','node:path']);
  assert.doesNotMatch(source,/\bfetch\s*\(|child_process|spawn\(|exec\(|https?:\/\/|import\(/);
  const routes=await readFile(new URL('./pulse-workspace-routes.mjs',import.meta.url),'utf8');
  assert.deepEqual([...routes.matchAll(/^import\s.+?from\s+'([^']+)';/gm)].map(match=>match[1]),['./request-security.mjs']);
  assert.doesNotMatch(routes,/\bfetch\s*\(|child_process|https?:\/\//);
});

// 화면 단계(판 4): 서버 응답을 그대로 화면 함수에 넣어 본다 — 고객 방 「내 모델로 모아 두기」 · 내 모델 목록 · 보관 동의 · 다시 쓰기 방 인물 카드 · 직원 브랜드 데스크, 영어 화면.
test('화면(판 4): 서버 응답 그대로 — 모아 두기 · 보관 대기 → 동의 → 목록 · 다시 쓰기 방 카드 · 직원 브랜드 데스크가 차례마다 맞게 그려진다(영어 포함)',async t=>{
  globalThis.location??=new URL('http://localhost/pulse-app/');
  const {myModelsView}=await import('./public/pulse-app/my-models.mjs');
  const {roomModel}=await import('./public/pulse-app/room-view.mjs');
  const {roomView}=await import('./public/pulse-app/film-views.mjs');
  const {personaModel,personaCard}=await import('./public/pulse-app/persona-view.mjs');
  const {brandDesk}=await import('./public/pulse-app/brand-desk-view.mjs');
  const {setLocale}=await import('./public/pulse-app/i18n.mjs');
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);
  // 고객 방(원 프로젝트): 앱이 회원 상태(keep)를 넘길 때만 「모아 두기」 칸이 선다 — 넘기지 않으면(스위치 끔) 판 4 전과 같은 글.
  let room=await a.room();const origin=roomModel(room.project);
  assert.equal(roomView(origin).includes('sx-persona-keep'),false,'keep이 없으면 칸도 없다');
  const before=roomView({...origin,keep:{state:'login'}});
  assert.ok(before.includes('data-room-do="keep"')&&before.includes('브랜드 관리자가 내 모델에서 보관을 정할 수 있고'),'누가 보게 되는지 한 줄과 단추');
  // 로그인 전 「내 모델」은 로그인 칸, 로그인 실패로 돌아오면 그 알림.
  assert.ok(myModelsView({view:'login',session:{authenticated:false,loginAvailable:true},failed:true}).includes('로그인을 마치지 못했어요'));
  await a.login(ids.a);
  assert.ok(myModelsView({view:'list',session:{authenticated:true},data:(await a.member('/models')).data}).includes('아직 연결된 브랜드가 없어요'),'회원이 아니면 빈 목록 안내');
  const wa=await f.linkNewBrand(a,'가 브랜드');
  // 보관 대기: 관리자에게만, 동의 단추만(의뢰 단추 없음).
  let models=(await a.member('/models')).data,html=myModelsView({view:'list',session:{authenticated:true},data:models});
  assert.ok(html.includes('보관 동의를 기다리는 모델')&&html.includes('data-pending="1"')&&!html.includes('data-mm-do="request"'));
  const ws=models.workspaces[0],pending=ws.pending[0];
  html=myModelsView({view:'consent',pick:{ws,card:pending}});
  assert.ok(html.includes('브랜드 「가 브랜드」의 다음 광고예요')&&html.includes('2027년 11월 10일')&&html.includes('기준 얼굴 · 동작 시안 · 이 모델을 다시 만드는 데 필요한 파일'),'서버 terms를 문장으로');
  // 11-11 결정 표 ① · ④ · ⑥(설계 11-4): 12개월 · 기한 뒤 30일에 지우는 날 · 백업 최대 13개월 · 오래 두는 보관용 사본 제외가 동의 칸에 보인다.
  assert.ok(html.includes('오늘부터 12개월, 2027년 11월 10일')&&/기한 30일 뒤인 2027년 12월 10일[^에]*에 보내 주신 사진을 포함해 이 모델의 그림과 파일을 지워요/.test(html)&&html.includes('이미 받으신 광고 영상은 지우지 않아요')&&html.includes('최대 13개월')&&html.includes('오래 두는 별도 보관 사본에는 처음부터 넣지 않아요')&&!html.includes('최대 30일'),'보관 기간 · 지우는 날 · 백업 · 금고 제외');
  assert.ok(html.includes('동의하고 보관'));
  await f.keep(a,wa,x.personaId);
  models=(await a.member('/models')).data;html=myModelsView({view:'list',session:{authenticated:true},data:models});
  assert.ok(html.includes('data-mm-do="request"')&&html.includes('새 광고에 쓸 수 있어요')&&html.includes('다시 쓰기 기한'),'보관한 모델은 의뢰 단추 · 상태 · 다시 쓰기 기한');
  for(const word of ['기한 연장','다시 쓰기 끄기','사용 멈추기','삭제 요청'])assert.ok(html.includes(word),'관리자 일: '+word);
  assert.ok(!html.includes('지우는 날'),'쓸 수 있는 모델에는 지우는 날을 따로 보이지 않는다');
  const offCard={...models.workspaces[0].models[0],usable:false,reason:'expired',status:'expired'};
  assert.ok(myModelsView({view:'list',session:{authenticated:true},data:{workspaces:[{...models.workspaces[0],models:[offCard]}]}}).includes('지우는 날'),'기한이 지난 모델에는 지우는 날');
  // 고객 방은 회원이 된 뒤 「내 모델 열기」.
  const state=(await a.member('/project-state',{proof:await a.proof('workspace-state')})).data;assert.equal(state.member,true);
  room=await a.room();assert.ok(roomView({...roomModel(room.project),keep:{state:'member',name:state.workspace.name}}).includes('data-room-do="my-models"'));
  // 다시 쓰기 의뢰 → 직원 데스크의 다음 행동 → 연결 확인 → 다시 쓰기 방.
  const sent=await f.reuseRequest(a,wa,x.personaId,x.revisionId);
  let desk=brandDesk({list:(await f.staff('/api/customer-workspaces')).data,pick:{kind:'reuse',id:sent.projectId}});
  assert.ok(desk.includes('연결을 확인하고 이번 광고 사용 범위를 손님에게 보내요')&&desk.includes('data-action-name="confirm_request"'));
  assert.equal((await f.confirm(sent.projectId)).status,200);
  room=await a.room();const reuse=roomModel(room.project),reuseHtml=roomView(reuse);
  assert.equal(reuse.persona.mode,'reuse');assert.equal(reuse.persona.card,'usage');
  assert.ok(reuseHtml.includes('내 모델')&&reuseHtml.includes('이번 광고에 쓸지 확인해 주세요'),'다시 쓰기 방은 이번 광고 사용 확인 하나');
  assert.ok(!reuseHtml.includes('맞춤 인물 확인')&&!/<span class="sx-no">\d\/7<\/span>/.test(reuseHtml)&&!reuseHtml.includes('sx-persona-keep'),'일곱 걸음 · 확인 번호 · 모아 두기 없음');
  // 직원 브랜드 데스크: 인물 · 회원 · 프로젝트 · 기록, 관리자 단추.
  desk=brandDesk({list:(await f.staff('/api/customer-workspaces')).data,pick:{kind:'workspace',id:wa},detail:(await f.staff('/api/customer-workspaces/'+wa)).data},{projects:[]});
  for(const part of ['가 브랜드','data-action-name="pause"','data-action-name="delete"','data-action-name="unassign"','data-action-name="set_role"','보관 동의를 받았어요'])assert.ok(desk.includes(part),'브랜드 데스크: '+part);
  // 영어 화면: 내 모델 동의 · 다시 쓰기 방 카드에 남는 한글은 손님 · 직원이 적은 글(브랜드 이름 · 사용 범위)뿐이다.
  const written=['가 브랜드',...Object.values(USAGE).filter(Boolean)];
  const hangulLeft=text=>written.reduce((rest,word)=>rest.split(word).join(' '),text.replace(/<[^>]+>/g,' ')).match(/[가-힣]+/g)||[];
  await setLocale('en');
  try{
    const card=models.workspaces[0].models[0];
    assert.deepEqual(hangulLeft(myModelsView({view:'list',session:{authenticated:true},data:models})),[]);
    assert.deepEqual(hangulLeft(myModelsView({view:'list',session:{authenticated:true},data:{workspaces:[{...models.workspaces[0],models:[{...models.workspaces[0].models[0],usable:false,reason:'expired',status:'expired'}]}]}})),[]);
    assert.deepEqual(hangulLeft(myModelsView({view:'consent',pick:{ws:models.workspaces[0],card}})),[]);
    assert.deepEqual(hangulLeft(myModelsView({view:'ask',pick:{ws:models.workspaces[0],card,kind:'stop'}})),[]);
    assert.deepEqual(hangulLeft(personaCard(personaModel(room.project))),[]);
  }finally{await setLocale('ko');}
});

// ── 보관 기간 뒤 지우기(11-11 유호님 「추천대로」 — 결정 표 11-11 ① · ④ · ⑤, 판 4 설계 11-3) ──
const filesOf=(f,personaId)=>[...f.store().all('pulsePersonaSources').filter(item=>item.personaId===personaId).map(item=>item.diskName),
  ...f.store().all('pulsePersonaRevisions').filter(item=>item.personaId===personaId).flatMap(item=>(item.assets||[]).map(asset=>asset.diskName))].filter(Boolean);
const mediaPath=(f,name)=>join(f.store().directory,'studio-media',name);
const touch=(f,projectId)=>{const row=f.store().get('clientProjects',projectId);f.store().put('clientProjects',projectId,{...row,updatedAt:new Date(f.stamp).toISOString()});};

test('시나리오 10 · 프로젝트 정리 때 삭제(결정 표 11-11 ⑤): 원 프로젝트 90일 정리는 브랜드 없는 인물만 함께 지우고, 브랜드 인물 · 다시 쓰기 프로젝트 · 다른 프로젝트 인물 · 초대 폐기는 그대로',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);                                   // 브랜드 없는 인물 — 원 프로젝트가 정리된다
  const b=f.browser(),y=await f.readyPersona(b);await b.login(ids.b);const wb=await f.linkNewBrand(b,'나 브랜드');await f.keep(b,wb,y.personaId);
  const reuse=await f.reuseRequest(b,wb,y.personaId,y.revisionId);assert.equal((await f.confirm(reuse.projectId)).status,200);
  const c=f.browser(),z=await f.readyPersona(c);                                   // 다른 프로젝트의 브랜드 없는 인물 — 그 프로젝트는 살아 있다
  // 초대 폐기: 브랜드 인물의 원 프로젝트 초대를 닫아도 인물 · 다시 쓰기 · 내 모델은 그대로다.
  f.app.clientProjects.revoke(f.owner,y.projectId,{revision:f.store().get('clientProjects',y.projectId).revision});
  assert.equal(f.store().get('pulsePersonas',y.personaId).status,'ready');
  assert.equal((await b.member('/models')).data.workspaces[0].models[0].usable,true,'초대를 닫아도 내 모델에서 쓸 수 있다');
  const [xf,yf,zf]=[filesOf(f,x.personaId),filesOf(f,y.personaId),filesOf(f,z.personaId)];
  assert.ok(xf.length>=3&&yf.length>=3&&zf.length>=3,'사진 · 기준 얼굴 · 동작 시안');
  const {createHash}=await import('node:crypto');
  const xsha=[...new Set(await Promise.all(xf.map(async name=>createHash('sha256').update(await readFile(mediaPath(f,name))).digest('hex'))))].sort();
  // 앞서 판 파일 하나만 뺄 때 남긴 해시(removedNoVault)는 인물을 지울 때 묘비로 함께 옮겨진다(묘비는 정해진 칸만 남긴다).
  const earlier='e'.repeat(64);f.store().put('pulsePersonas',x.personaId,{...f.store().get('pulsePersonas',x.personaId),removedNoVault:[earlier]});
  advance(f,91*86400000);
  for(const id of [z.projectId,reuse.projectId])touch(f,id);                        // 이 둘은 방금 움직였다
  // 판 4 설계 11-6 「한 길」(11-12): 브랜드 없는 인물이 살아 있는 의뢰는 정리하지 않고, 인물은 90일 시계로 예고 → 14일 → 지운 뒤 같은 회차에 그 의뢰를 정리한다.
  let result=await f.app.pulseRequests.retireUnconfirmed();
  assert.deepEqual(result,{retired:1,retention:{deleted:0,held:0,failed:0,noticed:1}},'y의 원 프로젝트(브랜드 인물)만 정리, x는 예고');
  assert.notEqual(f.store().get('clientProjects',x.projectId).studio.request.status,'retired','브랜드 없는 인물이 살아 있는 의뢰는 정리하지 않는다');
  f.stamp=afterDay(f.stamp+14*86400000);for(const id of [z.projectId,reuse.projectId])touch(f,id);
  result=await f.app.pulseRequests.retireUnconfirmed();
  assert.deepEqual(result,{retired:1,retention:{deleted:1,held:0,failed:0}},'예고 14일 뒤 x를 지우고 같은 회차에 그 의뢰도 정리');
  assert.equal(f.store().get('clientProjects',x.projectId).studio.request.status,'retired');
  const tomb=f.store().get('pulsePersonas',x.personaId);
  assert.equal(tomb.status,'deleted');assert.ok(tomb.deletedAt);assert.equal(tomb.deletion.reason,'origin_stopped');assert.equal(tomb.deletion.confirmedBy,'system');
  assert.ok(tomb.history.some(row=>row.action==='retention_deleting'&&row.actorKind==='system'));
  assert.deepEqual(tomb.deletion.noVault,[...xsha,earlier].sort(),'이름을 떼는 트랜잭션에서 지운 본문의 sha256을 묘비에 남긴다(GPT GA1) — 앞서 뺀 판 파일의 해시도 함께');
  assert.equal(tomb.removedNoVault,undefined);
  for(const name of xf)await assert.rejects(stat(mediaPath(f,name)),'브랜드 없는 인물의 사진 · 판 파일을 지웠다');
  assert.ok(f.store().all('pulsePersonaApprovals').some(item=>item.personaId===x.personaId&&item.kind==='reference'&&item.shown.assetIds.length),'판 3 승인 기록(무엇을 언제 확인했는지)은 남긴다');
  assert.ok(f.store().all('pulsePersonaRevisions').filter(item=>item.personaId===x.personaId).every(item=>item.deletedAt&&item.sent.length),'보낸 id 목록도 남긴다(D10)');
  // 브랜드 인물 · 다른 프로젝트 인물 · 다시 쓰기 프로젝트는 그대로.
  assert.equal(f.store().get('clientProjects',y.projectId).studio.request.status,'retired','브랜드 인물의 원 프로젝트도 정리됐지만');
  assert.equal(f.store().get('pulsePersonas',y.personaId).status,'ready','브랜드 인물은 원 프로젝트 정리와 상관없다');
  assert.equal(f.store().get('pulsePersonas',z.personaId).status,'ready');
  for(const name of [...yf,...zf])assert.ok(await stat(mediaPath(f,name)),'다른 인물의 파일은 그대로');
  for(const name of workspaceMediaNames(f.store().db))assert.ok(await stat(mediaPath(f,name)),'백업 목록의 파일은 모두 있다');
  assert.ok(!workspaceMediaNames(f.store().db).some(name=>xf.includes(name)),'지운 인물의 파일은 백업 목록에서 빠진다');
  await b.login(ids.b);
  const card=(await b.member('/models')).data.workspaces[0].models[0];assert.equal(card.id,y.personaId);assert.equal(card.usable,true,'내 모델에 남는다');
  assert.equal(f.store().get('clientProjects',reuse.projectId).workspaceRequest.personaId,y.personaId,'다시 쓰기 프로젝트의 참조도 그대로');
  // 같은 쓸기를 다시 돌려도 더 지우는 것이 없다(멱등).
  assert.deepEqual(await f.app.pulseRequests.retireUnconfirmed(),{retired:0});
});

test('다시 쓰기 보관 12개월 뒤 지우기(결정 표 11-11 ④ · ①): 기한 + 30일에 지우고, 철회한 인물도 같은 시계 · 연장은 시계를 옮기고 · 쓰는 중인 의뢰가 있으면 그 일이 끝날 때까지 미룬다',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const make=async(id,name)=>{const b=f.browser(),p=await f.readyPersona(b);await b.login(id);const w=await f.linkNewBrand(b,name);await f.keep(b,w,p.personaId);return {b,p,w};};
  const kept=await make(ids.a,'가 브랜드'),off=await make(ids.a,'나 브랜드'),renew=await make(ids.a,'다 브랜드'),busy=await make(ids.b,'라 브랜드');
  // 동의 조건(v2)에 기한 · 지우는 날 · 12개월 · 백업 13개월 · 금고 제외가 묶인다.
  const approval=f.store().all('pulsePersonaApprovals').find(item=>item.kind==='reuse'&&item.personaId===kept.p.personaId);
  const until=approval.terms.until,deleteAt=approval.terms.deleteAt;
  assert.equal(approval.terms.v,2);assert.equal(until,reuseUntil(new Date(f.stamp).toISOString()));assert.equal(Date.parse(deleteAt)-Date.parse(until),30*86400000);
  assert.equal(approval.terms.months,12);assert.deepEqual(approval.terms.backup,{maxMonths:13,vault:false});assert.equal('backupDays' in approval.terms,false);
  assert.equal(f.store().get('pulsePersonas',kept.p.personaId).retention.until,until);
  // 철회해도 내 모델에 「다시 쓰기 꺼짐」으로 남고, 지우는 날은 그대로 보인다.
  assert.equal((await off.b.member('/reuse/withdraw',{workspaceId:off.w,personaId:off.p.personaId,note:''})).status,200);
  let card=(await off.b.member('/models')).data.workspaces.find(item=>item.id===off.w).models[0];
  assert.equal(card.reason,'reuse_off');assert.equal(card.deleteAt,deleteAt,'철회해도 동의한 보관 기간 뒤에 지운다');
  // 쓰는 중인 다시 쓰기 의뢰(연결 확인 뒤 · 끝나지 않음).
  const running=await f.reuseRequest(busy.b,busy.w,busy.p.personaId,busy.p.revisionId);assert.equal((await f.confirm(running.projectId)).status,200);
  // 반년 뒤 연장 → 지우는 날이 그 연장의 기한 + 30일로 옮겨 간다.
  advance(f,183*86400000);await renew.b.login(ids.a);await f.keep(renew.b,renew.w,renew.p.personaId);
  const renewed=f.store().all('pulsePersonaApprovals').filter(item=>item.kind==='reuse'&&item.personaId===renew.p.personaId&&item.decision==='approve').at(-1).terms.deleteAt;
  assert.ok(Date.parse(renewed)>Date.parse(deleteAt)+150*86400000);
  // 지우는 날 1분 전: 아무것도 지우지 않는다(원 프로젝트들은 90일 정리로 이미 「지운 의뢰」 — 브랜드 인물과 상관없다).
  f.stamp=Date.parse(deleteAt)-60000;
  for(const id of [running.projectId])touch(f,id);
  const before=await f.app.pulseRequests.retireUnconfirmed();
  assert.equal(before.retention,undefined,'지우는 날 전에는 쓸기가 할 일이 없다');
  for(const x of [kept,off,renew,busy])assert.equal(f.store().get('pulsePersonas',x.p.personaId).deletedAt,undefined);
  await kept.b.login(ids.a);card=(await kept.b.member('/models')).data.workspaces.find(item=>item.id===kept.w).models[0];
  assert.equal(card.status,'expired');assert.equal(card.deleteAt,deleteAt,'기한이 지나도 30일 안에는 지우는 날과 함께 보인다');assert.ok(card.consent,'그 사이에는 연장할 수 있다');
  // 지우는 날이 지나면: 그냥 둔 인물 · 철회한 인물은 지우고, 연장한 인물은 두고, 쓰는 중인 의뢰가 있는 인물은 미룬다(직원 할 일).
  f.stamp=Date.parse(deleteAt)+60000;touch(f,running.projectId);
  const kf=filesOf(f,kept.p.personaId),of=filesOf(f,off.p.personaId);
  const swept=await f.app.pulseRequests.retireUnconfirmed();
  assert.deepEqual(swept.retention,{deleted:2,held:1,failed:0});
  for(const x of [kept,off]){const tomb=f.store().get('pulsePersonas',x.p.personaId);assert.equal(tomb.status,'deleted');assert.equal(tomb.deletion.reason,'reuse_ended');assert.equal(tomb.workspaceId,x.w,'묘비는 브랜드를 기록으로 남긴다');}
  for(const name of [...kf,...of])await assert.rejects(stat(mediaPath(f,name)));
  assert.ok(f.store().get('customerWorkspaces',kept.w).history.some(row=>row.action==='model_retention_deleting'&&row.subject===kept.p.personaId));
  assert.equal(f.store().get('pulsePersonas',renew.p.personaId).status,'ready','연장한 인물은 그대로');
  assert.equal(f.store().get('pulsePersonas',busy.p.personaId).status,'ready','쓰는 중인 의뢰가 있으면 미룬다');
  const desk=await f.staff('/api/customer-workspaces/'+busy.w);
  assert.ok(desk.data.workspace.todos.some(item=>item.why==='retention_due'&&item.projects.some(project=>project.id===running.projectId)),'직원 할 일: 보관 기한이 끝났어요');
  assert.equal(desk.data.workspace.personas[0].deleteAt,f.store().all('pulsePersonaApprovals').find(item=>item.kind==='reuse'&&item.personaId===busy.p.personaId).terms.deleteAt);
  // 그 의뢰가 끝나면(보관) 다음 쓸기가 지운다.
  const row=f.store().get('clientProjects',running.projectId);f.store().put('clientProjects',row.id,{...row,stage:'archived'});
  assert.deepEqual((await f.app.pulseRequests.retireUnconfirmed()).retention,{deleted:1,held:0,failed:0});
  assert.equal(f.store().get('pulsePersonas',busy.p.personaId).status,'deleted');
  for(const name of workspaceMediaNames(f.store().db))assert.ok(await stat(mediaPath(f,name)),'백업 목록의 파일은 모두 있다');
});

test('지우는 시계의 경계: 열린 인물 · 브랜드 없는 인물의 살아 있는 원 프로젝트는 정리하지 않고(90일 시계가 예고), 도중에 멈춘 시스템 삭제는 시작 직후 회차가 아니라 보통 회차가 이어 끝낸다',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const service=f.app.pulseRequests;
  const a=f.browser(),x=await f.readyPersona(a),xf=filesOf(f,x.personaId);
  // 열린 인물(검토 중) — 원 프로젝트가 정리되지 않으니 지우지 않는다(정리 자체가 건너뛴다).
  const b=f.browser();b.jar.delete('synk_pulse_request');
  const draft=(await b.call('/pulse/api/request/start',{body:{}})).data.draft;
  const sent=await b.call('/pulse/api/request/submit',{body:{answers:answers(custom)},csrf:draft.csrf});assert.equal(sent.status,201);
  const open=f.store().all('pulsePersonas').find(item=>item.originProjectId===sent.data.projectId);
  // 도중에 멈춘 시스템 삭제: 문서는 deleting + pendingUnlink, 파일은 그대로.
  const c=f.browser(),y=await f.readyPersona(c),yf=filesOf(f,y.personaId);
  const row=f.store().get('clientProjects',y.projectId);
  f.store().put('clientProjects',row.id,{...row,stage:'archived',studio:{...row.studio,request:{...row.studio.request,status:'retired'}}});
  const persona=f.store().get('pulsePersonas',y.personaId),at=new Date(f.stamp).toISOString();
  f.store().transaction(()=>{
    for(const item of f.store().all('pulsePersonaSources').filter(entry=>entry.personaId===y.personaId))f.store().put('pulsePersonaSources',item.id,{id:item.id,personaId:item.personaId,projectId:item.projectId,purpose:item.purpose,diskName:null,deletedAt:at});
    const rev=f.store().get('pulsePersonaRevisions',y.revisionId);f.store().put('pulsePersonaRevisions',rev.id,{...rev,assets:[],reference:null,motion:null,method:null,deletedAt:at});
    f.store().put('pulsePersonas',persona.id,{...persona,status:'deleting',pendingUnlink:yf,deletion:{confirmedAt:at,confirmedBy:'system',reason:'origin_retired',note:''}});
  });
  // 서버 시작 직후 회차(startup)는 예고만 낸다 — 멈춘 지우기 · 정리 · 지우기는 다음 회차부터(Fable 5.2 설계 검토 P3 · 서버 시작의 resumeDeletions는 따로 돈다).
  assert.deepEqual(await service.retireUnconfirmed({startup:true}),{retired:0},'시작 직후 회차는 예고만');
  assert.equal(f.store().get('pulsePersonas',y.personaId).status,'deleting');for(const name of yf)assert.ok(await stat(mediaPath(f,name)));
  // 보통 회차는 지우는 중에 멈춘 인물을 이어 끝낸다(Fable 5.2 설계 검토 P2 — 브랜드 없는 인물에는 「삭제 이어 하기」 단추가 없고, 그 인물이 의뢰 정리를 붙잡는다).
  assert.deepEqual(await service.retireUnconfirmed(),{retired:0,retention:{deleted:0,held:0,failed:0,resumed:1}});
  assert.equal(f.store().get('pulsePersonas',y.personaId).status,'deleted');for(const name of yf)await assert.rejects(stat(mediaPath(f,name)));
  assert.equal(f.store().get('pulsePersonas',y.personaId).deletion.reason,'origin_retired','옛 묘비의 까닭은 그대로 남는다');
  for(const name of xf)assert.ok(await stat(mediaPath(f,name)));
  advance(f,91*86400000);
  // 90일: 브랜드 없는 인물(ready x · 열린 인물)이 살아 있는 의뢰는 정리하지 않고, 인물 시계가 예고만 낸다(지우기는 예고 14일 뒤 — 아래 90일 시계 시험).
  assert.deepEqual(await service.retireUnconfirmed(),{retired:0,retention:{deleted:0,held:0,failed:0,noticed:2}});
  assert.equal(f.store().get('pulsePersonas',x.personaId).status,'ready');assert.notEqual(f.store().get('clientProjects',x.projectId).studio.request.status,'retired');
  assert.equal(f.store().get('clientProjects',sent.data.projectId).stage,'received','열린 인물이 있는 프로젝트는 그대로');
  assert.equal(f.store().get('pulsePersonas',open.id).status,'submitted');assert.ok(f.store().get('pulsePersonas',open.id).retentionNotice,'예고만 나갔다');
});

// ── 멈춘 프로젝트의 브랜드 없는 인물 — 90일 시계(판 4 설계 11-6, 11-12 유호님 「약속대로」 · Fable 5.2 설계 검토 반영) ──
const DAY=86400000,isoOf=ms=>new Date(ms).toISOString();
const sweep=f=>f.app.pulseRequests.retireUnconfirmed();
const personaOf=(f,id)=>f.store().get('pulsePersonas',id),projectOf=(f,id)=>f.store().get('clientProjects',id);
// 공개 의뢰서 줄을 지운다 — 담당자가 만든 프로젝트 · 확인 뒤 멈춘 의뢰처럼 90일 정리(retireUnconfirmed)가 다시 보지 않는 프로젝트(이 쓰기는 updatedAt을 옮기지 않는다).
const unlisted=(f,projectId,patch=()=>({}))=>{for(const row of f.store().all('pulseRequests').filter(item=>item.projectId===projectId))f.store().remove('pulseRequests',row.id);const row=projectOf(f,projectId);f.store().put('clientProjects',projectId,{...row,...patch(row)});};
const stoppedView=async(f,personaId,projectId)=>(await f.staff('/api/personas/project/'+projectId)).data.personas.find(item=>item.id===personaId)?.stopped;

test('90일 시계 계산(설계 11-6): 제작 신호는 넓게 · 결제는 지금 확인 상태만, 마지막 움직임 = max(프로젝트, 인물), 예고 전이면 지우는 날 = max(90일, 지금 + 14일)',async()=>{
  const {projectInProduction,stoppedClock,stoppedNoticeDue,stoppedDeleteDue}=await import('./pulse-personas.mjs');
  const request=extra=>({studio:{request:{status:'confirmed',...extra}},versions:[]});
  assert.equal(projectInProduction(request({})),false);
  assert.equal(projectInProduction({...request({}),stage:'producing'}),false,'단계는 보지 않는다(보관을 풀면 received로 돌아간다)');
  assert.equal(projectInProduction(request({approvedAt:'2026-11-10T00:00:00Z'})),true,'제작 시작 승인');
  assert.equal(projectInProduction(request({payment:{status:'confirmed'}})),true,'지금 확인 상태인 결제');
  assert.equal(projectInProduction(request({payment:{status:'cancelled',confirmedAt:'2026-11-10T00:00:00Z'}})),false,'취소(전액 환불)로 끝난 결제는 제작이 아니다');
  assert.equal(projectInProduction(request({payment:{status:'requested'}})),false);
  assert.equal(projectInProduction({...request({}),versions:[{id:'v',kind:'preview'}]}),true,'시안');
  assert.equal(projectInProduction({...request({}),deliveryReceipts:[{id:'r'}]}),true,'납품 수령');
  assert.equal(projectInProduction({...request({}),closureHistory:[{id:'c'}]}),true,'마감');
  const rows=new Map(),store={get:(kind,id)=>kind==='clientProjects'?rows.get(id)||null:null};
  const t0=Date.parse('2026-11-10T03:00:00Z');
  rows.set('p',{id:'p',updatedAt:isoOf(t0),studio:{request:{status:'confirmed'}},versions:[]});
  const persona={id:'x',originProjectId:'p',workspaceId:null,status:'ready',updatedAt:isoOf(t0+10*DAY)};
  let clock=stoppedClock(store,persona,isoOf(t0+20*DAY));
  assert.deepEqual(clock,{lastAt:isoOf(t0+10*DAY),clockAt:isoOf(t0+100*DAY),noticeFrom:isoOf(t0+86*DAY),noticed:false,noticeAt:null,deleteAt:endOf(t0+100*DAY)},'인물 쪽 움직임(판 파일 · 메모 · 귀속 취소)도 시계를 옮긴다');
  assert.equal(stoppedNoticeDue(clock,isoOf(t0+20*DAY)),false);assert.equal(stoppedNoticeDue(clock,isoOf(t0+86*DAY)),true);
  assert.equal(stoppedDeleteDue(clock,isoOf(t0+200*DAY)),false,'예고 전에는 지우지 않는다');
  // 배포 · 복원 직후(옛 날짜, 예고 없음): 지우는 날은 지금 + 14일.
  clock=stoppedClock(store,persona,isoOf(t0+300*DAY));assert.equal(clock.deleteAt,endOf(t0+314*DAY));assert.equal(stoppedNoticeDue(clock,isoOf(t0+300*DAY)),true);
  // 예고가 나갔으면 max(90일, 예고 + 14일). 예고 뒤에 다시 움직이면 그 예고는 풀린다.
  const noticed={...persona,retentionNotice:{at:isoOf(t0+300*DAY),deleteAt:isoOf(t0+314*DAY),reason:'origin_stopped'}};
  clock=stoppedClock(store,noticed,isoOf(t0+313*DAY));assert.equal(clock.noticed,true);assert.equal(clock.deleteAt,endOf(t0+314*DAY));assert.equal(stoppedDeleteDue(clock,isoOf(t0+313*DAY)),false);
  // 지우는 순간이 한낮(t0 = 한국 12시)이어도 그 한국 날짜가 끝날 때까지는 지우지 않는다 — 화면의 「{날짜}까지」 안에는 지우지 않게(Fable 5.2 최종 P1).
  assert.equal(stoppedDeleteDue(stoppedClock(store,noticed,isoOf(t0+314*DAY)),isoOf(t0+314*DAY)),false);
  assert.equal(stoppedDeleteDue(stoppedClock(store,noticed,endOf(t0+314*DAY)),endOf(t0+314*DAY)),true);
  assert.equal(stoppedClock(store,{...noticed,updatedAt:isoOf(t0+305*DAY)},isoOf(t0+320*DAY)).noticed,false,'예고 뒤 움직임 — 예고가 풀리고 다시 90일');
  assert.equal(stoppedClock(store,{...noticed,updatedAt:noticed.retentionNotice.at},isoOf(t0+320*DAY)).noticed,false,'예고와 같은 밀리초의 움직임도 예고를 푼다(카본 A2)');
  // 시계가 없는 경우 · 읽을 수 없는 경우.
  assert.equal(stoppedClock(store,{...persona,workspaceId:'w'},isoOf(t0)),null,'브랜드 인물은 브랜드 시계');
  assert.equal(stoppedClock(store,{...persona,status:'deleting'},isoOf(t0)),null);
  rows.set('r',{id:'r',updatedAt:isoOf(t0+10*DAY),studio:{request:{status:'retired',retiredAt:isoOf(t0+10*DAY)}}});
  // 지운 의뢰의 인물도 시계 하나(한 길 — Fable 5.2 설계 검토): clockAt = max(retiredAt, 인물 updatedAt + 90일), 예고 없이 바로 지우지 않는다.
  let retired=stoppedClock(store,{...persona,originProjectId:'r',updatedAt:isoOf(t0-200*DAY)},isoOf(t0+20*DAY));
  assert.equal(retired.clockAt,isoOf(t0+10*DAY),'정리 때 이미 90일을 채웠다');assert.equal(retired.deleteAt,endOf(t0+34*DAY),'예고 전이면 지금 + 14일');assert.equal(retired.retired,true);
  assert.equal(stoppedNoticeDue(retired,isoOf(t0+20*DAY)),true);assert.equal(stoppedDeleteDue(retired,isoOf(t0+20*DAY)),false,'옛 잔여 인물도 예고 없이 지우지 않는다');
  assert.equal(stoppedClock(store,{...persona,originProjectId:'r',updatedAt:isoOf(t0)},isoOf(t0+20*DAY)).clockAt,isoOf(t0+90*DAY));
  // 정리 뒤에 그 프로젝트가 움직였으면(보관 풀기 · 기록) 그 움직임이 날을 옮긴다 — 예고 알림의 「보관을 풀고 기록을 남기면」(카본 서버 끝 판 A1).
  rows.set('r2',{id:'r2',updatedAt:isoOf(t0+50*DAY),studio:{request:{status:'retired',retiredAt:isoOf(t0+10*DAY)}}});
  assert.equal(stoppedClock(store,{...persona,originProjectId:'r2',updatedAt:isoOf(t0-200*DAY)},isoOf(t0+60*DAY)).clockAt,isoOf(t0+140*DAY));
  assert.equal(stoppedClock(store,{...persona,originProjectId:'r',updatedAt:isoOf(t0+30*DAY)},isoOf(t0+40*DAY)).deleteAt,endOf(t0+120*DAY),'정리 뒤에 움직인 인물(귀속 취소 등)은 90일 시계(카본 A1)');
  rows.set('m',{id:'m',updatedAt:isoOf(t0),studio:{request:{status:'confirmed',approvedAt:isoOf(t0)}}});assert.equal(stoppedClock(store,{...persona,originProjectId:'m'},isoOf(t0)),null,'제작한 프로젝트');
  assert.deepEqual(stoppedClock(store,{...persona,originProjectId:'gone'},isoOf(t0)),{unclear:'origin'},'원 프로젝트가 없으면 지우지 않는다');
  rows.set('bad',{id:'bad',updatedAt:'언젠가',studio:{}});assert.deepEqual(stoppedClock(store,{...persona,originProjectId:'bad'},isoOf(t0)),{unclear:'date'},'날짜를 읽을 수 없으면 지우지 않는다');
  rows.set('badRetired',{id:'badRetired',updatedAt:'언젠가',studio:{request:{status:'retired',retiredAt:isoOf(t0-200*DAY)}}});
  assert.deepEqual(stoppedClock(store,{...persona,originProjectId:'badRetired',updatedAt:isoOf(t0-300*DAY),retentionNotice:{at:isoOf(t0-100*DAY)}},isoOf(t0)),{unclear:'date'},'지운 의뢰에서도 프로젝트 날짜를 못 읽으면 지우지 않는다(GPT 끝 판 GA2)');
  for(const value of [{unclear:'date'},null])assert.equal(stoppedDeleteDue(value,isoOf(t0+999*DAY)),false);
});

test('90일 시계(설계 11-6): 확인 뒤 멈춘 · 담당자가 만든 · 보관한 프로젝트 — 76일째 예고(시계를 옮기지 않음 · 보관한 프로젝트도 담당자 알림) → 90일에 지움 · 묘비, 사이에 기록 한 줄이나 인물 쪽 일이면 다시 90일, 지운 뒤 원 프로젝트의 인물 참조 · 사용 범위를 뗀다',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);           // 확인 뒤 멈춘 의뢰
  const b=f.browser(),y=await f.readyPersona(b);           // 담당자가 만든 프로젝트처럼(공개 의뢰서 줄 없음) — 이번 광고 사용 확인까지 간 인물
  const c=f.browser(),z=await f.readyPersona(c);           // 보관한 프로젝트
  await f.act(y.personaId,{action:'set_usage',...USAGE});
  assert.equal((await b.approve((await b.room()).project.persona)).status,200);
  assert.equal(projectOf(f,y.projectId).studio.strategy.data.castingSelection.personaRef.personaId,y.personaId,'제작 설계에 인물 참조가 붙었다(제작 시작 전)');
  const start=f.stamp,ymedia=filesOf(f,y.personaId),zmedia=filesOf(f,z.personaId);
  unlisted(f,x.projectId,row=>({studio:{...row.studio,request:{...row.studio.request,status:'confirmed',confirmedAt:isoOf(start)}}}));
  unlisted(f,y.projectId);
  f.store().put('clientProjects',z.projectId,{...projectOf(f,z.projectId),stage:'archived'});
  assert.deepEqual(await stoppedView(f,x.personaId,x.projectId),{deleteAt:endOf(start+90*DAY),noticed:false,noticeAt:null,lastAt:isoOf(start)},'직원 인물 칸에 지우는 날');
  // 예고 1분 전 → 할 일 없음. 1분 뒤 → 셋 모두 예고(인물 · 프로젝트 시계는 그대로).
  f.stamp=start+76*DAY-60000;assert.equal((await sweep(f)).retention,undefined);
  f.stamp=start+76*DAY+60000;
  assert.deepEqual((await sweep(f)).retention,{deleted:0,held:0,failed:0,noticed:3});
  for(const id of [x.personaId,y.personaId,z.personaId]){
    // 예고가 76일 1분에 나갔으니 지우는 날은 예고 + 14일(90일 1분) — 예고 뒤 14일을 다 채운다.
    const p=personaOf(f,id);assert.equal(p.retentionNotice.reason,'origin_stopped');assert.equal(p.retentionNotice.deleteAt,endOf(start+90*DAY+60000));
    assert.equal(p.updatedAt,isoOf(start),'예고 기록은 인물 시계를 옮기지 않는다');assert.ok(p.history.some(row=>row.action==='retention_notice'&&row.actorKind==='system'));
  }
  for(const id of [x.projectId,y.projectId,z.projectId]){const row=projectOf(f,id);assert.equal(row.updatedAt,isoOf(start),'프로젝트 시계도 그대로');assert.equal(row.history.at(-1).notice,'persona_retention');}
  const news=await f.staff('/api/client-projects/'+z.projectId+'/news',{as:f.intake});assert.equal(news.status,200,JSON.stringify(news.data));
  const item=news.data.items.find(entry=>entry.type==='persona_retention_notice');
  assert.ok(item,'보관한 프로젝트에서도 담당자에게 예고 알림');assert.ok(item.text.includes(endOf(start+90*DAY+60000).slice(0,10)),item.text);assert.match(item.href,/mode=staff.*tab=desk/);
  assert.deepEqual(await stoppedView(f,z.personaId,z.projectId),{deleteAt:endOf(start+90*DAY+60000),noticed:true,noticeAt:isoOf(start+76*DAY+60000),lastAt:isoOf(start)});
  assert.equal((await sweep(f)).retention,undefined,'예고는 한 번만');
  // 89일째: x는 프로젝트에 기록 한 줄(내부 메모), y는 인물 쪽 직원 일(내부 메모 — 프로젝트를 건드리지 않음) → 둘 다 다시 90일, 예고도 풀린다.
  f.stamp=start+89*DAY;
  const memo=await f.staff('/api/client-projects/'+x.projectId+'/messages',{as:f.intake,body:{revision:projectOf(f,x.projectId).revision,text:'손님과 일정 다시 잡는 중',visibility:'internal'}});assert.equal(memo.status,200,JSON.stringify(memo.data));
  await f.act(y.personaId,{action:'note',text:'촬영 일정 다시 잡는 중'});
  assert.equal(projectOf(f,y.projectId).updatedAt,isoOf(start),'인물 쪽 직원 일은 프로젝트를 건드리지 않는다');
  for(const [id,projectId]of [[x.personaId,x.projectId],[y.personaId,y.projectId]])assert.deepEqual(await stoppedView(f,id,projectId),{deleteAt:endOf(start+179*DAY),noticed:false,noticeAt:null,lastAt:isoOf(start+89*DAY)});
  // 90일(그 한국 날짜가 끝난 뒤): 보관한 z만 지운다(묘비 · 파일 · 프로젝트 시계 그대로). 90일 한낮에는 아직 그대로.
  f.stamp=start+90*DAY+60000;assert.equal((await sweep(f)).retention,undefined,'보인 날짜가 끝나기 전에는 지우지 않는다');
  f.stamp=afterDay(start+90*DAY+60000);
  assert.deepEqual((await sweep(f)).retention,{deleted:1,held:0,failed:0});
  const tomb=personaOf(f,z.personaId);
  assert.equal(tomb.status,'deleted');assert.equal(tomb.deletion.reason,'origin_stopped');assert.equal(tomb.deletion.confirmedBy,'system');assert.ok(tomb.deletion.noVault.length>=2,'지운 본문의 해시(금고 제외 — 같은 바이트는 하나)');
  for(const name of zmedia)await assert.rejects(stat(mediaPath(f,name)));
  assert.equal(projectOf(f,z.projectId).updatedAt,isoOf(start),'지운 기록도 프로젝트 시계를 옮기지 않는다');
  for(const id of [x.personaId,y.personaId])assert.equal(personaOf(f,id).status,'ready');
  // 165일째 x · y 예고 → 179일에 지운다. y의 원 프로젝트에서 인물 참조 · 사용 범위를 떼고, 손님 방 · 직원 칸은 묘비 날짜를 읽는다.
  f.stamp=start+165*DAY+60000;assert.equal((await sweep(f)).retention.noticed,2);
  f.stamp=afterDay(start+179*DAY+60000);
  const yRevision=projectOf(f,y.projectId).revision;
  assert.deepEqual((await sweep(f)).retention,{deleted:2,held:0,failed:0});
  const row=projectOf(f,y.projectId);
  assert.equal(row.studio.strategy.data.castingSelection.personaRef,undefined,'제작 설계의 인물 참조를 뗐다');assert.equal(row.studio.request.personaUsage,undefined,'이번 광고 사용 범위도 뗐다');
  assert.equal(row.updatedAt,isoOf(start),'시스템 쓰기는 시계를 옮기지 않는다');assert.ok(row.revision>yRevision);assert.ok(row.history.some(entry=>entry.actor==='system'&&entry.personaId===y.personaId&&/지움/.test(entry.action)));
  for(const name of ymedia)await assert.rejects(stat(mediaPath(f,name)));
  const removedAt=personaOf(f,y.personaId).deletion.confirmedAt;
  const desk=await f.staff('/api/personas/project/'+y.projectId);assert.deepEqual(desk.data.personas,[]);assert.equal(desk.data.removed.at,removedAt);assert.equal(desk.data.removed.personaId,y.personaId);
  const studio=await f.staff('/api/client-projects/'+y.projectId+'/studio');assert.equal(studio.status,200,JSON.stringify(studio.data));assert.equal(studio.data.project.personaRemoved.at,removedAt,'직원 프로젝트 응답의 묘비');
  for(const name of workspaceMediaNames(f.store().db))assert.ok(await stat(mediaPath(f,name)),'백업 목록의 파일은 모두 있다');
});

test('90일 시계 · 열린 검토(설계 검토 P1): 손님 차례 카드에 지우는 날, 인물 · 프로젝트 모두 90일 멈추면 닫는 기록(withdrawn) 뒤 지우고, 같은 회차에 그 공개 의뢰도 정리된다',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const b=f.browser();b.jar.delete('synk_pulse_request');
  const draft=(await b.call('/pulse/api/request/start',{body:{}})).data.draft;
  const face=await b.call('/pulse/api/request/media',{raw:png,csrf:draft.csrf,headers:{'Content-Type':'image/png','X-File-Name':encodeURIComponent('face.png'),'X-Request-Slot':'persona-identity'}});assert.equal(face.status,201);
  const sent=await b.call('/pulse/api/request/submit',{body:{answers:answers(custom)},csrf:draft.csrf});assert.equal(sent.status,201,JSON.stringify(sent.data));
  const projectId=sent.data.projectId,personaId=f.store().all('pulsePersonas').find(item=>item.originProjectId===projectId).id;
  await f.act(personaId,{action:'start_review'});
  await f.act(personaId,{action:'send_quote',price:300000,days:7,revisions:2,scope:'기준 얼굴 1판 · 동작 시안 1편'});
  const start=f.stamp,media=filesOf(f,personaId);
  const card=(await b.room()).project.persona;assert.equal(card.turn,'customer');assert.equal(card.deleteAt,endOf(start+90*DAY),'손님 차례에서 멈춘 카드에 지우는 날');
  // 76일: 정리는 열린 인물 때문에 건너뛰고(그대로), 인물 시계가 예고를 낸다.
  f.stamp=start+76*DAY+60000;assert.deepEqual(await sweep(f),{retired:0,retention:{deleted:0,held:0,failed:0,noticed:1}});
  // 90일: 열린 검토를 닫고(시스템 · 까닭 origin_stopped) 지운 뒤, 같은 회차에 그 공개 의뢰를 정리한다(차례 쓸기 → 정리 — Fable 5.2 설계 검토 P2).
  f.stamp=afterDay(start+90*DAY+60000);
  assert.deepEqual(await sweep(f),{retired:1,retention:{deleted:1,held:0,failed:0}});
  const tomb=personaOf(f,personaId);
  assert.equal(tomb.status,'deleted');assert.equal(tomb.deletion.reason,'origin_stopped');
  const closed=tomb.history.find(entry=>entry.action==='retention_withdraw');assert.ok(closed,'닫는 기록');assert.equal(closed.actorKind,'system');assert.equal(closed.from,'quote_review');assert.equal(closed.to,'withdrawn');
  assert.ok(tomb.history.findIndex(entry=>entry.action==='retention_withdraw')<tomb.history.findIndex(entry=>entry.action==='retention_deleting'),'닫은 뒤 지운다');
  for(const name of media)await assert.rejects(stat(mediaPath(f,name)));
  // 지운 기록(참조 떼기 · 기록 줄)이 프로젝트 시계를 옮기지 않았으니 같은 회차의 정리가 그 의뢰를 정리했다(정리 때 updatedAt은 정리가 옮긴다).
  assert.equal(projectOf(f,projectId).studio.request.status,'retired');assert.equal(projectOf(f,projectId).studio.request.retiredAt,isoOf(afterDay(start+90*DAY+60000)));
  assert.deepEqual(await sweep(f),{retired:0},'다음 회차는 할 일 없음');
});

test('90일 시계 · 예고 전에는 지우지 않는다(배포 · 복원 직후의 옛 날짜) · 보관 대기 카드의 날짜 · 귀속 취소는 그날부터 · 확인 전 공개 의뢰서도 인물이 살아 있으면 정리하지 않고 예고부터',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  // 손님 흐름(방 · 로그인)은 모두 시작 시각에 만든다(시험 픽스처의 방 세션은 시계를 옮기면 끝난다).
  const a=f.browser(),x=await f.readyPersona(a);unlisted(f,x.projectId);
  const b=f.browser(),y=await f.readyPersona(b);await b.login(ids.b);const wb=await f.linkNewBrand(b,'나 브랜드');await f.keep(b,wb,y.personaId);unlisted(f,y.projectId);
  const c=f.browser(),z=await f.readyPersona(c);await c.login(ids.c);const wc=await f.linkNewBrand(c,'다 브랜드');
  const d=f.browser(),w=await f.readyPersona(d);
  const t0=f.stamp;
  // 보관 대기(브랜드에 연결된 원 프로젝트의 브랜드 없는 인물): 브랜드 관리자 카드 · 직원 브랜드 화면에 지우는 날(「{날짜}까지 보관에 동의하지 않으면 지워요」).
  const pending=(await c.member('/models')).data.workspaces.find(item=>item.id===wc).pending.find(item=>item.id===z.personaId);
  assert.equal(pending.deleteAt,(await stoppedView(f,z.personaId,z.projectId)).deleteAt);assert.equal(pending.deleteAt,endOf(t0+90*DAY));
  const brand=await f.staff('/api/customer-workspaces/'+wc);assert.equal(brand.data.workspace.pending[0].deleteAt,pending.deleteAt,'직원 브랜드 화면의 보관 대기에도');
  assert.equal((await b.member('/models')).data.workspaces.find(item=>item.id===wb).models[0].deleteAt===pending.deleteAt,false,'브랜드 인물은 브랜드 시계');
  // ① 옛 날짜(복원으로 300일 전 움직임만 남음), 예고 없음 → 첫 쓸기는 예고만, 지우는 날은 지금 + 14일 — 서버를 다시 띄워도 그 전에는 그대로.
  const old=isoOf(t0-300*DAY);f.store().put('clientProjects',x.projectId,{...projectOf(f,x.projectId),updatedAt:old});f.store().put('pulsePersonas',x.personaId,{...personaOf(f,x.personaId),updatedAt:old});
  assert.deepEqual((await sweep(f)).retention,{deleted:0,held:0,failed:0,noticed:1},'옛 날짜여도 예고 없이 지우지 않는다');
  assert.equal((await stoppedView(f,x.personaId,x.projectId)).deleteAt,endOf(t0+14*DAY));
  await f.restart();f.stamp=t0+14*DAY-60000;assert.equal((await sweep(f)).retention,undefined,'예고 + 14일 전에는 그대로');
  f.stamp=afterDay(t0+14*DAY);assert.deepEqual((await sweep(f)).retention,{deleted:1,held:0,failed:0});
  assert.equal(personaOf(f,x.personaId).deletion.reason,'origin_stopped');
  // ② 100일 뒤 브랜드 인물을 귀속 취소하면 그날부터 90일(원 프로젝트가 오래 멈춰 있어도 바로 지우지 않는다).
  f.stamp=t0+100*DAY;touch(f,z.projectId);
  const unassigned=await f.personaAct(y.personaId,{action:'unassign',note:'잘못 묶은 것을 바로잡음'});assert.equal(unassigned.status,200,JSON.stringify(unassigned.data));
  assert.equal(personaOf(f,y.personaId).workspaceId,null);
  assert.deepEqual(await stoppedView(f,y.personaId,y.projectId),{deleteAt:endOf(f.stamp+90*DAY),noticed:false,noticeAt:null,lastAt:isoOf(f.stamp)});
  // ③ 확인 전 공개 의뢰서 w(첫 쓸기가 100일째): 예고 없이 정리 회차에 함께 지우지 않는다 — 인물이 살아 있으니 정리를 건너뛰고 예고부터(한 길).
  const result=await sweep(f);
  assert.deepEqual(result,{retired:0,retention:{deleted:0,held:0,failed:0,noticed:1}});
  assert.equal(personaOf(f,w.personaId).status,'ready');assert.equal(personaOf(f,w.personaId).retentionNotice.deleteAt,endOf(f.stamp+14*DAY));assert.notEqual(projectOf(f,w.projectId).studio.request.status,'retired');
  for(const id of [y.personaId,z.personaId])assert.equal(personaOf(f,id).status,'ready');
});

test('90일 시계 · 지운 뒤 원 프로젝트(설계 검토 P2): 손님 방은 지운 날 한 줄만 받고(인물 · 그림 없음), 같은 방에서 맞춤 인물을 새로 요청할 수 있다',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  // 손님 방 세션은 실제 시각으로 끝나므로 시계를 옮기지 않고 날짜를 옛날로 돌려 「예고 뒤 14일이 지난」 상태를 만든다.
  const b=f.browser(),y=await f.readyPersona(b);unlisted(f,y.projectId);
  const now=f.stamp,old=isoOf(now-200*DAY);
  f.store().put('clientProjects',y.projectId,{...projectOf(f,y.projectId),updatedAt:old});
  f.store().put('pulsePersonas',y.personaId,{...personaOf(f,y.personaId),updatedAt:old,retentionNotice:{at:isoOf(now-20*DAY),deleteAt:isoOf(now-6*DAY),reason:'origin_stopped'}});
  assert.deepEqual((await sweep(f)).retention,{deleted:1,held:0,failed:0});
  const removedAt=personaOf(f,y.personaId).deletion.confirmedAt;assert.equal(removedAt,isoOf(now));
  const room=(await b.room()).project;
  assert.equal(room.persona,undefined,'지운 인물은 손님 보기에 없다');assert.deepEqual(room.personaRemoved,{at:removedAt},'손님 방은 지운 날만 안다');
  assert.ok(!JSON.stringify(room).includes(y.personaId),'인물 id도 싣지 않는다');
  // 같은 방의 의뢰서로 맞춤 인물을 다시 요청하면 새 인물이 생기고, 묘비 한 줄은 내려간다.
  const r=await b.room(),sent=await b.call('/pulse/api/studio',{body:{revision:r.project.revision,action:'request_submit',answers:answers(custom)},csrf:r.csrf});
  assert.equal(sent.status,200,JSON.stringify(sent.data));
  const fresh=f.store().all('pulsePersonas').filter(item=>item.originProjectId===y.projectId&&!item.deletedAt);assert.equal(fresh.length,1,'새 맞춤 인물 요청');
  const after=(await b.room()).project;assert.equal(after.personaRemoved,undefined);assert.equal(after.persona.id,fresh[0].id);
});

test('90일 시계 · 카본 서버 검수 A1 두 회차(한 길): 공개 의뢰서 정리는 브랜드 없는 인물이 지워질 때까지 기다리고(직원 화면 날짜보다 먼저 지우지 않음), 정리 뒤에 귀속을 취소한 인물도 90일 시계(예고 뒤)를 탄다',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  // ② 확인 전 공개 의뢰서의 브랜드 없는 인물: 89일째 인물 쪽 일(내부 메모)만 → 정리는 인물 시계와 같은 날(179일)까지 기다린다.
  const a=f.browser(),x=await f.readyPersona(a);
  // ① 공개 의뢰서로 만든 인물을 브랜드에 보관 → 원 의뢰는 90일 정리 → 그 뒤 관리자가 귀속을 취소.
  const b=f.browser(),y=await f.readyPersona(b);await b.login(ids.b);const wb=await f.linkNewBrand(b,'나 브랜드');await f.keep(b,wb,y.personaId);
  const start=f.stamp;
  f.stamp=start+89*DAY;await f.act(x.personaId,{action:'note',text:'손님 사진 다시 보는 중'});
  assert.equal(projectOf(f,x.projectId).updatedAt,isoOf(start),'인물 쪽 일은 프로젝트를 건드리지 않는다');
  f.stamp=start+91*DAY;
  assert.deepEqual(await sweep(f),{retired:1},'y의 원 의뢰만 정리(브랜드 인물은 그대로), x의 의뢰는 브랜드 없는 인물이 살아 있어 건너뛴다');
  assert.equal(projectOf(f,y.projectId).studio.request.status,'retired');assert.equal(personaOf(f,y.personaId).status,'ready');
  assert.notEqual(projectOf(f,x.projectId).studio.request.status,'retired');
  assert.equal((await stoppedView(f,x.personaId,x.projectId)).deleteAt,endOf(start+179*DAY),'직원 화면의 날짜');
  // ①: 정리된 뒤 귀속 취소 → 다음 쓸기가 바로 지우지 않는다(그날부터 90일). 고정 시계라 정리와 같은 밀리초가 되지 않게 1분 뒤에.
  f.stamp+=60000;
  const unassigned=await f.personaAct(y.personaId,{action:'unassign',note:'잘못 묶은 것을 바로잡음'});assert.equal(unassigned.status,200,JSON.stringify(unassigned.data));
  const unassignedAt=f.stamp;
  assert.equal((await sweep(f)).retention,undefined,'정리된 의뢰의 인물이어도 귀속 취소 직후 지우지 않는다');
  assert.equal(personaOf(f,y.personaId).status,'ready');
  assert.deepEqual(await stoppedView(f,y.personaId,y.projectId),{deleteAt:endOf(unassignedAt+90*DAY),noticed:false,noticeAt:null,lastAt:isoOf(unassignedAt),retired:true});
  // 165일: x 예고(정리는 아직 — 인물 움직임 76일). 179일 1분: x의 의뢰 정리와 함께 지움(예고가 먼저 나갔다).
  f.stamp=start+165*DAY+60000;assert.deepEqual(await sweep(f),{retired:0,retention:{deleted:0,held:0,failed:0,noticed:1}});
  f.stamp=afterDay(start+179*DAY+60000);
  assert.deepEqual(await sweep(f),{retired:1,retention:{deleted:1,held:0,failed:0,noticed:1}},'x 정리와 지움 · y는 76일이 차 예고');
  assert.equal(personaOf(f,x.personaId).deletion.reason,'origin_stopped');assert.ok(personaOf(f,x.personaId).history.some(entry=>entry.action==='retention_notice'),'예고 뒤에 지웠다');
  assert.equal(projectOf(f,x.projectId).studio.request.status,'retired','인물을 지운 같은 회차에 그 의뢰도 정리');
  assert.equal(personaOf(f,y.personaId).retentionNotice.reason,'origin_stopped');
  // 정리 때와 정리 기록의 때는 같다(시계가 「정리 뒤 움직임」을 정리 기록과 헷갈리지 않게).
  assert.equal(projectOf(f,y.projectId).studio.request.retiredAt,projectOf(f,y.projectId).updatedAt);
  // y: 예고가 179일 1분에 나갔으니(76일이 지난 뒤 첫 쓸기) 지우는 날은 귀속 취소 + 90일이 아니라 예고 + 14일 — 예고 뒤 14일을 다 채운다.
  const noticeAt=Date.parse(personaOf(f,y.personaId).retentionNotice.at);
  assert.equal((await stoppedView(f,y.personaId,y.projectId)).deleteAt,endOf(noticeAt+14*DAY));
  f.stamp=unassignedAt+90*DAY+120000;assert.equal((await sweep(f)).retention,undefined,'귀속 취소 + 90일이어도 예고 + 14일 전에는 그대로');
  f.stamp=afterDay(noticeAt+14*DAY);
  assert.deepEqual((await sweep(f)).retention,{deleted:1,held:0,failed:0});
  assert.equal(personaOf(f,y.personaId).deletion.reason,'origin_stopped');
});

test('90일 시계 · 한 길의 남은 자리(Fable 5.2 설계 검토): 이미 지운 의뢰에 남은 브랜드 없는 인물도 예고 → 14일 → 지움, 날짜를 못 읽는 인물은 지우지 않고 쓸기 결과에 센다',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  // 62에서 남은 꼴: 원 의뢰는 「지운 의뢰」인데 브랜드 없는 인물이 살아 있다(정리 뒤 움직이지 않음).
  const a=f.browser(),x=await f.readyPersona(a);
  const row=projectOf(f,x.projectId),now=f.stamp;
  for(const item of f.store().all('pulseRequests').filter(entry=>entry.projectId===x.projectId))f.store().remove('pulseRequests',item.id);
  f.store().put('clientProjects',row.id,{...row,stage:'archived',updatedAt:isoOf(now-DAY),studio:{...row.studio,request:{...row.studio.request,status:'retired',retiredAt:isoOf(now-DAY)}}});
  f.store().put('pulsePersonas',x.personaId,{...personaOf(f,x.personaId),updatedAt:isoOf(now-100*DAY)});
  // 날짜를 못 읽는 인물(옛 자료): 지우지 않고 결과에 센다.
  const b=f.browser(),y=await f.readyPersona(b);unlisted(f,y.projectId);
  f.store().put('pulsePersonas',y.personaId,{...personaOf(f,y.personaId),updatedAt:'언젠가'});
  assert.deepEqual((await sweep(f)).retention,{deleted:0,held:0,failed:0,noticed:1,unclear:1},'지운 의뢰의 인물도 예고 없이 지우지 않는다');
  assert.equal(personaOf(f,x.personaId).status,'ready');
  assert.deepEqual(await stoppedView(f,y.personaId,y.projectId),{unclear:true});
  f.stamp=afterDay(now+14*DAY);
  assert.deepEqual((await sweep(f)).retention,{deleted:1,held:0,failed:0,unclear:1});
  const tomb=personaOf(f,x.personaId);assert.equal(tomb.deletion.reason,'origin_stopped');assert.match(tomb.deletion.note,/정리한 뒤 예고하고 지움/);
  assert.equal(personaOf(f,y.personaId).status,'ready','날짜를 못 읽는 인물은 남는다');
  // 인물 검토 중 보관한 확인 전 의뢰: 붙잡는 인물이 있는 동안 정리 대기 줄을 지우지 않는다 — 보관을 풀면 뒤에 정리된다(GPT 서버 다시 검수 GA1).
  const c=f.browser();c.jar.delete('synk_pulse_request');
  const draft=(await c.call('/pulse/api/request/start',{body:{}})).data.draft;
  const sent=await c.call('/pulse/api/request/submit',{body:{answers:answers(custom)},csrf:draft.csrf});assert.equal(sent.status,201);
  const held=sent.data.projectId;f.store().put('clientProjects',held,{...projectOf(f,held),stage:'archived'});
  f.stamp+=91*DAY;
  await sweep(f);
  assert.equal(f.store().all('pulseRequests').filter(item=>item.projectId===held).length,1,'정리 대기 줄이 남는다');
  // 인물을 지운 뒤에도 보관한 확인 전 의뢰의 대기 줄은 남고, 보관을 풀면 그때부터 다시 90일 뒤 정리된다(GPT 서버 끝 판 GA1).
  f.stamp=afterDay(f.stamp+14*DAY);await sweep(f);
  assert.equal(f.store().all('pulsePersonas').find(item=>item.originProjectId===held).status,'deleted');
  assert.equal(f.store().all('pulseRequests').filter(item=>item.projectId===held).length,1,'인물을 지운 뒤에도 대기 줄이 남는다');
  touch(f,held);f.store().put('clientProjects',held,{...projectOf(f,held),stage:'received'});
  f.stamp+=91*DAY;
  assert.equal((await sweep(f)).retired,1,'보관을 푼 뒤 90일 — 의뢰 기록 정리');assert.equal(projectOf(f,held).studio.request.status,'retired');
});

test('90일 시계 · 카본 서버 끝 판 A1: 정리된 의뢰에 남은 인물도 예고 알림대로 그 프로젝트의 보관을 풀고 기록을 남기면 예고가 풀리고 그날부터 다시 90일',async t=>{
  const f=await fixture(t);await f.features({personaRequest:true,myModels:true});
  const a=f.browser(),x=await f.readyPersona(a);
  // 정리된 의뢰(정리 때 = 정리 기록의 때)에 남은 브랜드 없는 인물(정리 뒤 귀속 취소와 같은 꼴 — 인물 updatedAt이 정리 뒤).
  const now=f.stamp,retiredAt=isoOf(now-DAY);
  for(const item of f.store().all('pulseRequests').filter(entry=>entry.projectId===x.projectId))f.store().remove('pulseRequests',item.id);
  f.store().put('clientProjects',x.projectId,{...projectOf(f,x.projectId),stage:'archived',updatedAt:retiredAt,studio:{...projectOf(f,x.projectId).studio,request:{...projectOf(f,x.projectId).studio.request,status:'retired',retiredAt}}});
  f.store().put('pulsePersonas',x.personaId,{...personaOf(f,x.personaId),updatedAt:isoOf(now-80*DAY+3600000)});
  f.stamp=now+DAY;assert.equal((await sweep(f)).retention?.noticed,1,'정리된 의뢰의 인물도 예고부터');
  assert.equal((await stoppedView(f,x.personaId,x.projectId)).retired,true);
  // 담당자가 보관을 풀고(쓰기) 기록을 남긴다 — 프로젝트 updatedAt이 정리 때보다 뒤로 → 예고가 풀리고 그날부터 90일.
  f.stamp+=DAY;
  const row=projectOf(f,x.projectId),saved=await f.staff('/api/client-projects/'+x.projectId,{body:{revision:row.revision,title:row.title,customerName:row.customerName||'손님',stage:'received'}});assert.equal(saved.status,200,JSON.stringify(saved.data));
  const view=await stoppedView(f,x.personaId,x.projectId);
  assert.equal(view.noticed,false,'예고가 풀린다');assert.equal(view.deleteAt,endOf(f.stamp+90*DAY),'그날부터 다시 90일');
  f.stamp=afterDay(now+15*DAY);assert.equal((await sweep(f)).retention,undefined,'옛 예고의 날에도 지우지 않는다');
  assert.equal(personaOf(f,x.personaId).status,'ready');
});
