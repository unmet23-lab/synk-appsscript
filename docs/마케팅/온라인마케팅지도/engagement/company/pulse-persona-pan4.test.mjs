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
  refused=await f.personaAct(x.personaId,{action:'delete',note:'고객 요청'});assert.equal(refused.status,409);assert.equal(refused.data.references.drafts,1);
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
  assert.ok(html.includes('브랜드 「가 브랜드」의 다음 광고예요')&&html.includes('2027년 11월 10일')&&html.includes('최대 30일')&&html.includes('기준 얼굴 · 동작 시안 · 이 모델을 다시 만드는 데 필요한 파일'),'서버 terms를 문장으로');
  assert.ok(html.includes('동의하고 보관'));
  await f.keep(a,wa,x.personaId);
  models=(await a.member('/models')).data;html=myModelsView({view:'list',session:{authenticated:true},data:models});
  assert.ok(html.includes('data-mm-do="request"')&&html.includes('새 광고에 쓸 수 있어요')&&html.includes('다시 쓰기 기한'),'보관한 모델은 의뢰 단추 · 상태 · 다시 쓰기 기한');
  for(const word of ['기한 연장','다시 쓰기 끄기','사용 멈추기','삭제 요청'])assert.ok(html.includes(word),'관리자 일: '+word);
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
    assert.deepEqual(hangulLeft(myModelsView({view:'consent',pick:{ws:models.workspaces[0],card}})),[]);
    assert.deepEqual(hangulLeft(myModelsView({view:'ask',pick:{ws:models.workspaces[0],card,kind:'stop'}})),[]);
    assert.deepEqual(hangulLeft(personaCard(personaModel(room.project))),[]);
  }finally{await setLocale('ko');}
});
