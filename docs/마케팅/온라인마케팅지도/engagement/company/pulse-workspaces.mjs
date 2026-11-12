// PULSE 고객 브랜드 · 「내 모델」 · 다시 쓰기 · 만료 · 사용 중지 · 삭제(2026-11-10 판 4).
// 설계 docs/마케팅/PULSE_의뢰흐름_20261104/판4_설계_20261110.md(5판 — 10절 끝 D1~D17). 회사 직원 담당자(clientProjects.ownerId)와 따로인
// 고객 브랜드(customerWorkspaces)를 두고, 중앙 SYNK ID 회원만 그 브랜드의 「내 모델」을 본다. 브랜드 연결 · 회원 추가는 직원이 앱 밖에서 확인한 뒤의
// 명시적 행동이고, 이메일 · 회사명이 같아도 저절로 합치지 않는다. 고객 방(초대 세션)과 회원 세션은 쿠키 길이 겹치지 않아, 둘을 잇는 것은
// 5분 · 한 번 · 목적 하나짜리 증표(pulse-proof)뿐이다.
// 이 모듈은 저장소 문서와 studio-media 파일 지우기만 다룬다 — 네트워크 · 생성 · 학습을 부르지 않는다(시험이 import 목록을 지킨다).
import {randomUUID,createHash} from 'node:crypto';
import {unlink,open} from 'node:fs/promises';
import {join} from 'node:path';
import {PERSONA_KINDS,PERSONA_SETTLED,REUSE_MONTHS,BACKUP_MAX_MONTHS,withPersonaRef,reuseStateOf,reuseUntil,reuseDeleteAt,consentAllowsReuse} from './pulse-personas.mjs';
import {personaRefOf} from './public/pulse-app/casting-choice.mjs';
import {withTranslation} from './pulse-translations.mjs';
import {workspaceMediaNames} from './workspace-media.mjs';

const K=PERSONA_KINDS,CLAIMS='pulseWorkspaceClaims',DRAFTS='pulseRequests',PROJECTS='clientProjects',PROOF='pulse-proof';
export const WORKSPACE_KINDS=Object.freeze({workspaces:K.workspaces,claims:CLAIMS});
export const WORKSPACE_LIMITS=Object.freeze({proofMinutes:5,attachHours:24,history:200,members:50,pendingClaims:20});
const fail=(message,status=400,code='')=>Object.assign(new Error(message),{status,...(code?{code}:{})});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SYNK_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// 직원 화면에만 내는 SYNK ID 끝 네 자리(판 4 운영 시험 P2): 프로필에 표시 이름이 없는 계정은 이름이 「고객」뿐이라 담당자가 맞춰 볼 단서가 없었다.
// 손님 쪽 응답(claimView · 회원 경로)에는 싣지 않는다. 고객 신원에는 이메일이 없어 가린 이메일 대신 ID 끝자리다.
const idHint=id=>typeof id==='string'&&SYNK_ID.test(id)?id.slice(-4).toLowerCase():'';
const KEY=/^[A-Za-z0-9_-]{8,80}$/;
const HASH=/^[a-f0-9]{64}$/;
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const HANGUL=/[가-힣]/;
const MEDIA_NAME=/^[0-9a-f-]{36}\.(?:mp4|webm|png|jpg|intake)$/;
const USAGE_TEXT={brand:80,product:120,purpose:200,media:200,regions:120,period:120,fee:120,schedule:120,note:600};
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const SHA256=/^[0-9a-f]{64}$/;
// 파일 본문의 sha256(없는 파일은 null). 인물을 지울 때 이름을 떼기 전에 잰다 — 같은 바이트의 다른 파일이 금고로 가지 않게(판 4 설계 11-2, 11-11 GPT GA1).
async function fileSha(path){
  let handle;try{handle=await open(path,'r');}catch(error){if(['ENOENT','EISDIR'].includes(error?.code))return null;throw error;}
  try{const hash=createHash('sha256'),buffer=Buffer.alloc(1<<20);for(;;){const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;hash.update(buffer.subarray(0,bytesRead));}return hash.digest('hex');}
  catch(error){if(error?.code==='EISDIR')return null;throw error;}finally{await handle.close();}
}

const live=doc=>!!doc&&!doc.deletedAt;
const keys=(input,allowed)=>{if(!object(input)||Object.keys(input).some(key=>!allowed.includes(key)))throw fail('요청 내용을 확인해 주세요.');};
function text(value,max,required=false){
  if(value===undefined||value===null||value===''){if(required)throw fail('근거를 한 줄 적어 주세요.');return '';}
  if(typeof value!=='string'||value.length>max||CONTROL.test(value))throw fail('입력 내용과 길이를 확인해 주세요.');
  const clean=value.trim();if(required&&!clean)throw fail('근거를 한 줄 적어 주세요.');return clean;
}
const notFound=()=>fail('찾지 못했어요.',404);
const byTime=(a,b)=>String(a.createdAt||a.at||'').localeCompare(String(b.createdAt||b.at||''));
// 「끝나지 않은」 프로젝트(설계 5판 D9): 보관 아님, 그리고 「납품했고 손님 수령 확인이나 직원 마감이 있음」이 아닌 것.
export const unfinishedProject=row=>!!row&&row.stage!=='archived'&&!(row.stage==='delivered'&&((row.deliveryReceipts||[]).length||(row.closureHistory||[]).length));

// clientProjects: createClientProjectsService(세션 · 권한 · 기록). features: pulseFeatures(read — myModels). localeOf(row): 프로젝트 소통 언어.
export function createWorkspaceService({store,clientProjects,features=null,localeOf=()=>'ko',clock=()=>new Date().toISOString()}){
  const enabled=()=>{try{return features?.read?.()?.myModels===true;}catch{return false;}};
  // ── 사람 ──
  const staffOf=user=>{const found=store.get('users',user?.id);if(!found?.active)throw fail('먼저 로그인해 주세요.',401);return found;};
  const writer=user=>{const found=staffOf(user);if(found.role==='viewer')throw fail('읽기만 할 수 있는 계정이에요.',403);return found;};
  const adminOf=user=>{const found=writer(user);if(found.role!=='admin')throw fail('관리자만 할 수 있어요.',403);return found;};
  const canManage=(staff,workspace)=>staff.role==='admin'||!!workspace&&workspace.staffOwnerId===staff.id;
  const manage=(staff,workspace)=>{if(!canManage(staff,workspace))throw fail('이 브랜드의 담당자나 관리자만 할 수 있어요.',403);};
  const readable=(staff,projectId)=>{try{clientProjects.project(staff,projectId);return true;}catch{return false;}};
  const synkIdOf=user=>{const id=user?.synkUserId;if(typeof id!=='string'||!SYNK_ID.test(id))throw fail('SYNK ID로 로그인해 주세요.',401);return id;};
  const nameOf=user=>typeof user?.name==='string'?user.name.trim().slice(0,100):'';
  // ── 문서 ──
  const workspaceOf=id=>{const found=typeof id==='string'&&UUID.test(id)?store.get(K.workspaces,id):null;if(!found)throw fail('그 브랜드를 찾지 못했어요.',404);return found;};
  const activeWorkspace=id=>{const found=typeof id==='string'&&UUID.test(id)?store.get(K.workspaces,id):null;return found?.status==='active'?found:null;};
  const memberOf=(workspace,synkUserId)=>(workspace?.members||[]).find(member=>member.synkUserId===synkUserId)||null;
  const personaOf=id=>{const found=typeof id==='string'&&UUID.test(id)?store.get(K.personas,id):null;if(!live(found))throw notFound();return found;};
  const currentRevision=persona=>{const found=persona?.currentRevisionId?store.get(K.revisions,persona.currentRevisionId):null;return live(found)&&found.personaId===persona.id&&found.status==='published'?found:null;};
  const assetUrl=id=>`/api/customer/pulse/asset/${id}`;
  function putWorkspace(workspace,{action,actorKind,actor,note='',subject=''}){
    const at=clock(),next={...workspace,revision:(workspace.revision||0)+1,updatedAt:at};
    next.history=[...(workspace.history||[]),{id:randomUUID(),at,action,actorKind,actor:String(actor||''),...(subject?{subject}:{}),...(note?{note}:{})}].slice(-WORKSPACE_LIMITS.history);
    store.put(K.workspaces,next.id,next);return next;
  }
  function putPersona(persona,patch,{action,actorKind,actor}){
    const at=clock(),next={...persona,...patch,revision:(persona.revision||0)+1,updatedAt:at};
    next.history=[...(persona.history||[]),{id:randomUUID(),at,action,actorKind,actor:String(actor||''),from:persona.status,to:next.status}].slice(-200);
    store.put(K.personas,next.id,next);return next;
  }
  // 프로젝트에 기록 한 줄과 함께 칸을 바꾼다(드롭할 칸은 undefined로 넘긴다).
  function touchProject(row,patch,action,actor){
    const at=clock(),next={...row,...patch,revision:row.revision+1,updatedAt:at,history:[...(row.history||[]),{id:randomUUID(),action,actor,at}].slice(-300)};
    for(const [key,value]of Object.entries(patch))if(value===undefined)delete next[key];
    return clientProjects.commitWorkflow(next);
  }

  // ── 증표(설계 4-1 · 5판 D11) ──
  // 5분 · 한 번 · 목적 하나. 세션 토큰을 담지 않고 그 해시만 담는다. 기한은 저장소 기한(실제 시각)과 몸통 issuedAt(서버 시계) 둘로 잰다.
  function mintProof(body){
    store.db.prepare('DELETE FROM tokens WHERE purpose=? AND expiresAt<?').run(PROOF,new Date().toISOString());
    return {proof:store.mint(PROOF,null,{...body,issuedAt:clock()},WORKSPACE_LIMITS.proofMinutes),expiresInSeconds:WORKSPACE_LIMITS.proofMinutes*60};
  }
  // 고객 방(초대 세션 + 고객 화면 CSRF)이 받는 증표: 연결 상태 읽기 · 연결 요청.
  function projectProof(token,csrf,input){
    keys(input,['purpose']);
    if(!['workspace-state','workspace-claim'].includes(input.purpose))throw fail('요청 내용을 확인해 주세요.');
    const {auth,row}=clientProjects.session(token);
    if(typeof csrf!=='string'||csrf!==auth.body.csrf)throw fail('고객 화면을 다시 열어 주세요.',403);
    return mintProof({purpose:input.purpose,projectId:row.id,inviteRevision:row.inviteRevision,sessionHash:auth.hash});
  }
  // 공개 의뢰서 초안(초안 쿠키 + 초안 CSRF, 아직 보내지 않음)이 받는 증표: 다시 쓰기 붙이기.
  function draftProof(raw,csrf,input){
    keys(input,[]);
    const auth=store.readToken(raw,'pulse-request'),row=auth&&store.get(DRAFTS,auth.body.requestId);
    if(!row)throw fail('이어 쓸 의뢰서를 찾지 못했어요. 처음부터 시작해 주세요.',401);
    if(typeof csrf!=='string'||csrf!==auth.body.csrf)throw fail('화면을 새로 고친 뒤 다시 시도해 주세요.',403);
    if(row.status!=='draft')throw fail('이미 보낸 의뢰서예요.',409);
    return mintProof({purpose:'persona-attach',requestId:row.id,sessionHash:auth.hash});
  }
  const proofFail=()=>fail('확인 시간이 지났거나 맞지 않아요. 화면에서 다시 시도해 주세요.',409,'SYNK_PULSE_PROOF');
  // 증표 쓰기는 부르는 쪽의 동기 트랜잭션 안에서만: 읽고 바로 지운다(store.consume은 스스로 트랜잭션을 열어 쓰지 않는다 — 중첩).
  function takeProof(raw,purpose,now){
    const row=typeof raw==='string'&&raw.length<=200?store.readToken(raw,PROOF):null;
    if(row)store.db.prepare('DELETE FROM tokens WHERE hash=?').run(row.hash);
    const body=row?.body,issued=Date.parse(body?.issuedAt);
    if(!object(body)||body.purpose!==purpose||!Number.isFinite(issued)||issued+WORKSPACE_LIMITS.proofMinutes*60000<=Date.parse(now))throw proofFail();
    return body;
  }
  // 증표를 쓰는 일 하나: check(proof,now)는 검사만 하고 쓰기 함수를 돌려준다. 검사가 4xx로 거절하면 증표를 지운 것만 커밋하고 거절을 돌려준다(되감기로 증표가 되살아나지 않게).
  function withProof(raw,purpose,check){
    const now=clock();
    const outcome=store.transaction(()=>{
      let apply;
      try{apply=check(takeProof(raw,purpose,now),now);}catch(error){if(Number.isInteger(error.status)&&error.status>=400&&error.status<500)return {error};throw error;}
      return {value:apply()};
    });
    if(outcome.error)throw outcome.error;
    return outcome.value;
  }
  // 발급한 초대 세션이 아직 살아 있고(초대 세션 검사와 같은 규칙) 같은 프로젝트 · 같은 초대 판인지.
  // 발급 세션이 끝났으면 증표 거절(409)로 돌려준다 — 회원 경로의 401은 「SYNK ID로 다시 로그인」 뜻이라 겹치지 않게(Fable P3-3).
  function projectOfProof(proof){
    let session;try{session=clientProjects.sessionByHash(proof.sessionHash);}catch(error){if(error.status===401)throw proofFail();throw error;}
    const {row}=session;
    if(row.id!==proof.projectId||row.inviteRevision!==proof.inviteRevision)throw proofFail();
    return row;
  }
  // 발급한 초안 토큰이 아직 살아 있고 그 초안이 아직 보내지 않은 초안인지.
  function draftOfProof(proof){
    const token=typeof proof.sessionHash==='string'&&HASH.test(proof.sessionHash)?store.db.prepare("SELECT body FROM tokens WHERE hash=? AND purpose='pulse-request' AND expiresAt>?").get(proof.sessionHash,new Date().toISOString()):null;
    let body=null;try{body=token?JSON.parse(token.body):null;}catch{body=null;}
    const draft=body?.requestId===proof.requestId?store.get(DRAFTS,proof.requestId):null;
    if(!draft||draft.status!=='draft')throw fail('이미 보냈거나 끝난 의뢰서예요. 의뢰서를 새로 열어 주세요.',409);
    return draft;
  }

  // ── 다시 쓰기 동의의 조건(설계 3-4 · 5-2) ──
  // 승인 카드에 보인 조건 그대로를 해시에 묶는다(브랜드 이름 · 보관 자료 · 목적 · 다시 쓰기 기한 · 지우는 날 · 철회 방법 · 백업 잔존 · 금고 제외).
  // v2(11-11 결정 표 ① · ④ · ⑥, 판 4 설계 11-4): 기한(12개월) 뒤 30일에 지우고, 지운 뒤 백업 사본은 최대 13개월, 오래 두는 보관 사본(금고)에는 넣지 않는다.
  function reuseTerms(revision,workspace,now){
    const until=reuseUntil(now);
    return {v:2,workspaceId:workspace.id,workspaceName:workspace.name,materials:['reference',...(revision.motion?.assetIds?.length?['motion']:[]),'model-files'],purpose:'next-ads',until,deleteAt:reuseDeleteAt(until),months:REUSE_MONTHS,withdraw:'my-models',backup:{maxMonths:BACKUP_MAX_MONTHS,vault:false}};
  }
  const reuseHash=(persona,revision,workspace,terms)=>sha({v:1,kind:'reuse',personaId:persona.id,revisionId:revision.id,workspaceId:workspace.id,workspaceName:workspace.name,assets:[...(revision.reference?.assetIds||[])].sort(),termsHash:sha(terms)});
  // 지금 이 브랜드 admin이 새 다시 쓰기 동의(처음 · 연장 · 재개)를 할 수 있으면 그 조건 · 해시. 처음이면 원 프로젝트가 이 브랜드에 연결된 보관 대기 인물만.
  function consentOffer(persona,workspace,now){
    if(!live(persona)||persona.status!=='ready'||workspace?.status!=='active')return null;
    if(persona.workspaceId?persona.workspaceId!==workspace.id:store.get(PROJECTS,persona.originProjectId)?.customerWorkspaceId!==workspace.id)return null;
    const revision=currentRevision(persona);if(!revision||!consentAllowsReuse(store,persona))return null;
    const terms=reuseTerms(revision,workspace,now);
    return {revisionId:revision.id,terms,viewedHash:reuseHash(persona,revision,workspace,terms)};
  }
  // 회원에게 보이는 승인 이력은 이 브랜드 몫만: 다시 쓰기 동의는 이 브랜드에 묶인 것, 그 밖의 승인은 원 프로젝트(인물을 만든 이력) · 이 브랜드에 연결된 프로젝트의 것(Fable P3-1 — 귀속 취소 뒤 다른 브랜드 시절 사용 이력을 싣지 않는다).
  const brandApproval=(approval,persona,workspace)=>approval.kind==='reuse'?approval.workspaceId===workspace.id:approval.projectId===persona.originProjectId||store.get(PROJECTS,approval.projectId)?.customerWorkspaceId===workspace.id;
  const lastUsedAt=(persona,workspace)=>store.all(K.approvals).filter(approval=>approval.personaId===persona.id&&approval.kind==='usage'&&approval.decision==='approve'&&brandApproval(approval,persona,workspace)).map(approval=>approval.at).sort().at(-1)||null;
  function modelCard(persona,workspace,now,admin){
    const state=reuseStateOf(store,persona,{workspaceId:workspace.id,now}),revision=currentRevision(persona),image=revision?.reference?.assetIds?.[0];
    return {id:persona.id,name:persona.displayName||'',kind:persona.kind,status:state.status,usable:state.usable,reason:state.reason,
      revisionId:revision?.id||null,image:image?assetUrl(image):null,reuse:persona.retention?.scope==='reuse',until:persona.retention?.scope==='reuse'?persona.retention.until:null,
      deleteAt:brandDeleteAt(persona),lastUsedAt:lastUsedAt(persona,workspace),deletionRequested:!!persona.deletionRequest,...(admin?{consent:consentOffer(persona,workspace,now)}:{})};
  }
  // 보관 대기(설계 4-2): 원 프로젝트가 이 브랜드에 연결됐고 ready인데 아직 브랜드에 귀속되지 않은 인물. 실제 인물은 당사자 동의가 다시 쓰기를 허락할 때만.
  const pendingPersonas=workspace=>store.all(K.personas).filter(persona=>live(persona)&&!persona.workspaceId&&persona.status==='ready'&&store.get(PROJECTS,persona.originProjectId)?.customerWorkspaceId===workspace.id&&currentRevision(persona)&&consentAllowsReuse(store,persona)).sort(byTime);
  function workspaceModels(workspace,member,now){
    const admin=member.role==='admin';
    const owned=store.all(K.personas).filter(persona=>live(persona)&&persona.workspaceId===workspace.id&&persona.status!=='deleting').sort(byTime);
    return {id:workspace.id,name:workspace.name,role:member.role,models:owned.map(persona=>modelCard(persona,workspace,now,admin)),
      pending:admin?pendingPersonas(workspace).map(persona=>{const revision=currentRevision(persona),image=revision.reference?.assetIds?.[0];return {id:persona.id,name:persona.displayName||'',kind:persona.kind,revisionId:revision.id,image:image?assetUrl(image):null,consent:consentOffer(persona,workspace,now)};}):[]};
  }

  // ── 고객 SYNK ID 회원 경로(/api/customer/pulse/*, 설계 4-2) ── 요청마다 회원 목록 · 역할 · 브랜드 상태를 다시 읽는다(캐시 없음).
  function projectState(user,input){
    keys(input,['proof']);const synkUserId=synkIdOf(user);
    return withProof(input.proof,'workspace-state',proof=>{
      const row=projectOfProof(proof),workspace=activeWorkspace(row.customerWorkspaceId),me=memberOf(workspace,synkUserId);
      const pending=store.all(CLAIMS).some(claim=>claim.status==='pending'&&claim.projectId===row.id&&claim.synkUserId===synkUserId);
      return ()=>({inWorkspace:!!workspace,member:!!me,pending,...(me?{workspace:{id:workspace.id,name:workspace.name,role:me.role}}:{})});
    });
  }
  const claimView=claim=>({id:claim.id,status:claim.status,createdAt:claim.createdAt,decidedAt:claim.decidedAt||null});
  // 연결 · 합류 요청: 같은 프로젝트 · 같은 사람의 기다리는 요청은 하나(두 번 눌러도 같은 줄). 연결인지 합류인지는 직원이 정할 때 계산한다.
  function claim(user,input){
    keys(input,['proof']);const synkUserId=synkIdOf(user),displayName=nameOf(user);
    return withProof(input.proof,'workspace-claim',(proof,now)=>{
      const row=projectOfProof(proof),workspace=activeWorkspace(row.customerWorkspaceId);
      if(memberOf(workspace,synkUserId))throw fail('이미 이 브랜드의 회원이에요. 내 모델에서 이 브랜드의 모델을 보실 수 있어요.',409);
      const mine=store.all(CLAIMS).filter(item=>item.status==='pending'&&item.synkUserId===synkUserId),same=mine.find(item=>item.projectId===row.id);
      // 초대 링크를 새로 만든 뒤 손님이 새 링크로 다시 요청하면 같은 줄을 지금 초대 판으로 다시 적는다(서버가 저절로 바꾸는 전이가 아니라 손님의 다시 요청 — 줄은 하나).
      if(same&&same.inviteRevision!==row.inviteRevision)return ()=>{const renewed={...same,inviteRevision:row.inviteRevision,displayName:displayName||same.displayName,renewedAt:now};store.put(CLAIMS,renewed.id,renewed);return {claim:claimView(renewed),renewed:true};};
      if(same)return ()=>({claim:claimView(same),duplicate:true});
      if(mine.length>=WORKSPACE_LIMITS.pendingClaims)throw fail('기다리는 연결 요청이 많아요. 담당자에게 알려 주세요.',429);
      return ()=>{const made={id:randomUUID(),projectId:row.id,inviteRevision:row.inviteRevision,synkUserId,displayName,status:'pending',createdAt:now,decidedAt:null,decidedBy:null,workspaceId:null,note:''};store.put(CLAIMS,made.id,made);return {claim:claimView(made)};};
    });
  }
  function withdrawClaim(user,input){
    keys(input,['claimId']);const synkUserId=synkIdOf(user);
    return store.transaction(()=>{
      const found=typeof input.claimId==='string'&&UUID.test(input.claimId)?store.get(CLAIMS,input.claimId):null;
      if(!found||found.synkUserId!==synkUserId)throw notFound();
      if(found.status!=='pending')throw fail('이미 정해진 요청이에요.',409);
      const next={...found,status:'withdrawn',decidedAt:clock(),decidedBy:'customer'};store.put(CLAIMS,next.id,next);
      return {claim:claimView(next)};
    });
  }
  function models(user){
    const synkUserId=synkIdOf(user),now=clock();
    return store.readScope(()=>({workspaces:store.all(K.workspaces).filter(workspace=>workspace.status==='active'&&memberOf(workspace,synkUserId)).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(workspace=>workspaceModels(workspace,memberOf(workspace,synkUserId),now))}));
  }
  // 상세(설계 2절 만드는 차례의 뒤쪽): 승인 이력(종류 · 판 · 날짜 · 승인 방식), 이 브랜드에 연결된 사용 프로젝트, 판의 기준 얼굴 · 동작 시안.
  function model(user,personaId){
    const synkUserId=synkIdOf(user),now=clock();
    return store.readScope(()=>{
      const persona=personaOf(personaId),workspace=activeWorkspace(persona.workspaceId),me=memberOf(workspace,synkUserId);
      if(!me||persona.status==='deleting')throw notFound();
      const revision=currentRevision(persona),numbers=new Map(store.all(K.revisions).filter(item=>item.personaId===persona.id).map(item=>[item.id,item.number]));
      const assets=part=>(revision?.[part]?.assetIds||[]).map(id=>revision.assets.find(item=>item.id===id)).filter(Boolean).map(item=>({id:item.id,mimeType:item.mimeType,url:assetUrl(item.id)}));
      const approvals=store.all(K.approvals).filter(approval=>approval.personaId===persona.id&&brandApproval(approval,persona,workspace)).sort(byTime).map(approval=>({kind:approval.kind,decision:approval.decision,at:approval.at,number:numbers.get(approval.revisionId)||null,method:approval.authMethod||''}));
      const projects=store.all(PROJECTS).filter(row=>row.customerWorkspaceId===workspace.id&&(row.id===persona.originProjectId||row.workspaceRequest?.personaId===persona.id||personaRefOf(row.studio?.strategy?.data?.castingSelection?.personaRef)?.personaId===persona.id)).map(row=>({title:row.title,stage:row.stage,updatedAt:row.updatedAt}));
      return {model:{...modelCard(persona,workspace,now,me.role==='admin'),reference:assets('reference'),motion:assets('motion'),approvals,projects},workspace:{id:workspace.id,name:workspace.name,role:me.role}};
    });
  }
  // 그림(설계 4-2 사슬): 자산 → 그 자산을 가진 공개 판(묘비 아님, 보낸 묶음 안) → 그 판의 인물(묘비 · 삭제 중 아님, 지금 판) →
  // 인물이 요청자가 회원인 활성 브랜드에 귀속, 또는 (보관 대기) 귀속 전이고 원 프로젝트가 요청자가 admin인 활성 브랜드에 연결됐고 ready. 하나라도 어긋나면 404.
  // 출처 사진(pulsePersonaSources)은 이 길로 나가지 않는다 — 판 문서의 자산만 찾는다.
  function asset(user,assetId){
    const synkUserId=synkIdOf(user);
    if(typeof assetId!=='string'||!UUID.test(assetId))throw notFound();
    const revision=store.all(K.revisions).find(item=>live(item)&&item.status==='published'&&(item.assets||[]).some(entry=>entry.id===assetId));
    if(!revision||![...(revision.reference?.assetIds||[]),...(revision.motion?.assetIds||[])].includes(assetId))throw notFound();
    const persona=store.get(K.personas,revision.personaId);
    if(!live(persona)||persona.status==='deleting'||persona.currentRevisionId!==revision.id)throw notFound();
    if(persona.workspaceId){if(!memberOf(activeWorkspace(persona.workspaceId),synkUserId))throw notFound();}
    else{const workspace=activeWorkspace(store.get(PROJECTS,persona.originProjectId)?.customerWorkspaceId);if(memberOf(workspace,synkUserId)?.role!=='admin'||!pendingPersonas(workspace).some(item=>item.id===persona.id))throw notFound();}
    return revision.assets.find(entry=>entry.id===assetId);
  }
  // 다시 쓰기 붙이기(설계 4-1 · 5-4 · 5판 D8): 증표(persona-attach) + 그 브랜드 회원 + 그 브랜드에서 「다시 쓸 수 있음」. 붙임은 24시간.
  function attach(user,input){
    keys(input,['proof','workspaceId','personaId','revisionId']);const synkUserId=synkIdOf(user);
    return withProof(input.proof,'persona-attach',(proof,now)=>{
      const draft=draftOfProof(proof),workspace=activeWorkspace(input.workspaceId);
      if(!memberOf(workspace,synkUserId))throw notFound();
      const persona=personaOf(input.personaId);
      if(persona.workspaceId!==workspace.id)throw notFound();
      if(typeof input.revisionId!=='string'||!UUID.test(input.revisionId))throw fail('요청 내용을 확인해 주세요.');
      const state=reuseStateOf(store,persona,{workspaceId:workspace.id,revisionId:input.revisionId,now});
      if(!state.usable||input.revisionId!==persona.currentRevisionId)throw fail('지금은 이 모델로 의뢰할 수 없어요. 내 모델에서 상태를 확인해 주세요.',409,'SYNK_PULSE_MODEL_UNUSABLE');
      const expiresAt=new Date(Date.parse(now)+WORKSPACE_LIMITS.attachHours*3600000).toISOString();
      const personaAttach={workspaceId:workspace.id,personaId:persona.id,revisionId:input.revisionId,attachedBy:synkUserId,attachedAt:now,expiresAt};
      return ()=>{
        const answers={...(draft.answers||{}),modelChoice:'persona',models:[],hair:'',personaRequest:{kind:'',look:'',use:'',keep:'',relation:'',consentWay:''}};
        store.put(DRAFTS,draft.id,{...draft,answers,personaAttach,updatedAt:now});
        return {attached:{workspaceId:workspace.id,personaId:persona.id,revisionId:input.revisionId,expiresAt},answers};
      };
    });
  }
  // 브랜드 admin 확인: 회원 · 역할 · 활성 브랜드를 지금 읽는다.
  function adminMember(user,workspaceId){
    const synkUserId=synkIdOf(user),workspace=activeWorkspace(workspaceId),me=memberOf(workspace,synkUserId);
    if(!me)throw notFound();
    if(me.role!=='admin')throw fail('브랜드 관리자만 할 수 있어요.',403);
    return {synkUserId,workspace,me};
  }
  // 다시 쓰기 동의(처음 · 연장 · 재개). 받는 순간 동기 트랜잭션 안에서 귀속(workspaceId가 비었거나 같은 브랜드)을 보고, 앞선 유효한 동의는 supersedes로 대신한다.
  function reuse(user,input){
    keys(input,['workspaceId','personaId','revisionId','viewedHash','idempotencyKey']);
    if(typeof input.idempotencyKey!=='string'||!KEY.test(input.idempotencyKey)||typeof input.viewedHash!=='string'||!HASH.test(input.viewedHash))throw fail('화면을 새로 고친 뒤 다시 시도해 주세요.');
    return store.transaction(()=>{
      const now=clock(),{synkUserId,workspace}=adminMember(user,input.workspaceId),persona=personaOf(input.personaId);
      const prior=store.all(K.approvals).find(approval=>approval.kind==='reuse'&&approval.personaId===persona.id&&approval.by===synkUserId&&approval.idempotencyKey===input.idempotencyKey);
      if(prior){if(prior.decision!=='approve'||prior.workspaceId!==workspace.id||prior.revisionId!==input.revisionId||prior.viewedHash!==input.viewedHash)throw fail('이미 다른 답이 기록됐어요. 화면을 새로 고쳐 주세요.',409);return {duplicate:true};}
      // 다른 브랜드의 인물 · 이 브랜드에 연결되지 않은 보관 대기 인물은 있는지조차 알리지 않는다.
      if(persona.workspaceId?persona.workspaceId!==workspace.id:store.get(PROJECTS,persona.originProjectId)?.customerWorkspaceId!==workspace.id)throw notFound();
      if(persona.status==='paused')throw fail('사용 중지된 모델이에요. 담당자가 중지를 먼저 풀고, 그 뒤 보관 동의를 새로 하셔야 다시 써요.',409,'SYNK_PULSE_MODEL_PAUSED');
      const offer=consentOffer(persona,workspace,now);
      if(!offer)throw fail('지금은 이 모델의 보관을 정할 수 없어요. 내 모델을 새로 불러와 주세요.',409,'SYNK_PULSE_REUSE_UNAVAILABLE');
      if(offer.revisionId!==input.revisionId||offer.viewedHash!==input.viewedHash)throw Object.assign(fail('보관 조건이 바뀌었어요. 새 조건을 보고 다시 확인해 주세요.',409,'SYNK_PULSE_REUSE_STALE'),{offer});
      const revision=store.get(K.revisions,offer.revisionId);
      const approval={id:randomUUID(),personaId:persona.id,projectId:null,revisionId:revision.id,kind:'reuse',decision:'approve',workspaceId:workspace.id,terms:offer.terms,termsHash:sha(offer.terms),viewedHash:offer.viewedHash,shown:{assetIds:[...(revision.reference?.assetIds||[])]},
        by:synkUserId,actorKind:'member',actorName:nameOf(user),authMethod:'synk-member',locale:'',idempotencyKey:input.idempotencyKey,supersedes:persona.retention?.reuseApprovalId||null,note:'',at:now};
      store.put(K.approvals,approval.id,approval);
      const first=!persona.workspaceId;
      putPersona(persona,{workspaceId:workspace.id,retention:{scope:'reuse',until:offer.terms.until,reuseApprovalId:approval.id}},{action:first?'reuse_approved':'reuse_renewed',actorKind:'member',actor:synkUserId});
      putWorkspace(workspace,{action:first?'model_kept':'model_renewed',actorKind:'member',actor:synkUserId,subject:persona.id});
      return {approval:approval.id,until:offer.terms.until};
    });
  }
  // 다시 쓰기 철회(브랜드 admin): 보관 범위를 프로젝트로 돌린다. 인물은 내 모델에 「다시 쓰기 꺼짐」으로 남는다(삭제 요청은 계속 된다).
  function withdrawReuse(user,input){
    keys(input,['workspaceId','personaId','note']);const note=text(input.note,300);
    return store.transaction(()=>{
      const now=clock(),{synkUserId,workspace}=adminMember(user,input.workspaceId),persona=personaOf(input.personaId);
      if(persona.workspaceId!==workspace.id||persona.status==='deleting')throw notFound();
      if(persona.retention?.scope!=='reuse')throw fail('이미 다시 쓰기가 꺼져 있어요.',409);
      recordWithdrawal(persona,workspace,{by:synkUserId,actorKind:'member',actorName:nameOf(user),authMethod:'synk-member',note,now});
      putPersona(persona,{retention:{scope:'project',until:null,reuseApprovalId:null}},{action:'reuse_withdrawn',actorKind:'member',actor:synkUserId});
      putWorkspace(workspace,{action:'model_reuse_off',actorKind:'member',actor:synkUserId,subject:persona.id,note});
      return {ok:true};
    });
  }
  function recordWithdrawal(persona,workspace,{by,actorKind,actorName,authMethod,note,now}){
    const approval={id:randomUUID(),personaId:persona.id,projectId:null,revisionId:persona.currentRevisionId||null,kind:'reuse',decision:'withdraw',workspaceId:workspace.id,terms:null,termsHash:'',viewedHash:'',shown:{assetIds:[]},
      by,actorKind,actorName,authMethod,locale:'',idempotencyKey:'',supersedes:persona.retention?.reuseApprovalId||null,note,at:now};
    store.put(K.approvals,approval.id,approval);return approval;
  }
  // 사용 중지 요청(브랜드 admin): 즉시 paused. 진행 중 프로젝트는 직원 할 일로 넘기고, 이미 집행 중인 광고를 앱이 취소했다고 말하지 않는다.
  function stop(user,input){
    keys(input,['workspaceId','personaId','note']);const note=text(input.note,300);
    return store.transaction(()=>{
      const now=clock(),{synkUserId,workspace}=adminMember(user,input.workspaceId),persona=personaOf(input.personaId);
      if(persona.workspaceId!==workspace.id||persona.status==='deleting')throw notFound();
      if(persona.status==='paused')return {ok:true,duplicate:true};
      if(persona.status!=='ready')throw fail('지금 상태에서는 사용을 멈출 수 없어요.',409);
      putPersona(persona,{status:'paused',paused:{at:now,byKind:'member',by:synkUserId,note}},{action:'paused',actorKind:'member',actor:synkUserId});
      putWorkspace(workspace,{action:'model_paused',actorKind:'member',actor:synkUserId,subject:persona.id,note});
      return {ok:true};
    });
  }
  // 삭제 요청(브랜드 admin): 직원 할 일만 만든다. 지우는 것은 관리자가 확인한 뒤 deletePersona.
  function deleteRequest(user,input){
    keys(input,['workspaceId','personaId','note']);const note=text(input.note,300);
    return store.transaction(()=>{
      const now=clock(),{synkUserId,workspace}=adminMember(user,input.workspaceId),persona=personaOf(input.personaId);
      if(persona.workspaceId!==workspace.id||persona.status==='deleting')throw notFound();
      if(persona.deletionRequest)return {ok:true,duplicate:true};
      putPersona(persona,{deletionRequest:{at:now,by:synkUserId,name:nameOf(user),workspaceId:workspace.id,note}},{action:'deletion_requested',actorKind:'member',actor:synkUserId});
      putWorkspace(workspace,{action:'model_deletion_requested',actorKind:'member',actor:synkUserId,subject:persona.id,note});
      return {ok:true};
    });
  }

  // ── 공개 의뢰서 보내기가 부르는 것(pulse-requests.mjs submit의 동기 트랜잭션 안) ──
  // 다시 쓰기 의뢰 프로젝트의 담당자(설계 3-3): 브랜드가 활성이고 staffOwnerId가 일하는 직원이면 그 사람, 아니면 null(지금처럼 requestOwner).
  function ownerFor(workspace){const owner=workspace?.status==='active'?store.get('users',workspace.staffOwnerId):null;return owner?.active&&owner.role!=='viewer'?owner.id:null;}
  // 보내기 검사(설계 5-4): 붙임이 24시간 안 · attachedBy가 그 브랜드의 지금 회원 · 브랜드 활성 · 「다시 쓸 수 있음」. 하나라도 어긋나면 409(내 모델에서 다시 골라 주세요).
  function attachedRequest(draft,now=clock()){
    const attachment=draft?.personaAttach,again=()=>fail('내 모델에서 다시 골라 주세요. 로그인이 필요할 수 있어요.',409,'SYNK_PULSE_ATTACH_STALE');
    if(!enabled()||!object(attachment)||!(Date.parse(attachment.expiresAt)>Date.parse(now)))throw again();
    const workspace=activeWorkspace(attachment.workspaceId);if(!workspace||!memberOf(workspace,attachment.attachedBy))throw again();
    const persona=store.get(K.personas,attachment.personaId);if(!live(persona)||persona.workspaceId!==workspace.id)throw again();
    if(!reuseStateOf(store,persona,{workspaceId:workspace.id,revisionId:attachment.revisionId,now}).usable)throw again();
    return {workspaceRequest:{workspaceId:workspace.id,personaId:persona.id,revisionId:attachment.revisionId,attachedBy:attachment.attachedBy,attachedAt:attachment.attachedAt},ownerId:ownerFor(workspace)};
  }

  // ── 삭제 참조(설계 5-6 · 5판 D9) ── 끝나지 않은 프로젝트 가운데 원 프로젝트 · 다시 쓰기 의뢰(확인 여부와 상관없이) · 인물 참조, 그리고 24시간 안의 초안 붙임.
  function personaReferences(persona,now=clock(),{reuseOnly=false,workspaceId=null}={}){
    const projects=store.all(PROJECTS).filter(row=>unfinishedProject(row)&&(!workspaceId||row.customerWorkspaceId===workspaceId||row.workspaceRequest?.workspaceId===workspaceId)&&(
      !reuseOnly&&row.id===persona.originProjectId||row.workspaceRequest?.personaId===persona.id||personaRefOf(row.studio?.strategy?.data?.castingSelection?.personaRef)?.personaId===persona.id&&row.id!==persona.originProjectId));
    const drafts=store.all(DRAFTS).filter(draft=>['draft','sending'].includes(draft.status)&&draft.personaAttach?.personaId===persona.id&&Date.parse(draft.personaAttach.expiresAt)>Date.parse(now));
    return {projects:projects.map(row=>({id:row.id,title:row.title,stage:row.stage,origin:row.id===persona.originProjectId})),drafts:drafts.length};
  }
  const referenced=refs=>refs.projects.length>0||refs.drafts>0;

  // ── 직원 경로(/api/customer-workspaces/*, 설계 4-4 · 5판 D15) ──
  function claimStaffView(found,staff){
    const row=store.get(PROJECTS,found.projectId),linked=row?.customerWorkspaceId?store.get(K.workspaces,row.customerWorkspaceId):null;
    return {id:found.id,projectId:found.projectId,projectTitle:row?.title||'',displayName:found.displayName||'',idHint:idHint(found.synkUserId),status:found.status,createdAt:found.createdAt,decidedAt:found.decidedAt||null,decidedBy:found.decidedBy?store.get('users',found.decidedBy)?.name||found.decidedBy:null,note:found.note||'',
      workspaceId:found.workspaceId||null,mode:linked?'join':'link',linkedWorkspace:linked?{id:linked.id,name:linked.name,status:linked.status,canManage:canManage(staff,linked)}:null,
      stale:!row||row.stage==='archived'||!row.inviteHash||row.inviteRevision!==found.inviteRevision};
  }
  // 직원 화면에 싣는 참조: 그 직원이 읽을 수 있는 프로젝트만 제목을 싣고, 나머지는 수만(Fable P2-1). 삭제 · 귀속 취소의 409 목록은 관리자 전용이라 그대로.
  const staffReferences=(staff,refs)=>{const shown=refs.projects.filter(item=>readable(staff,item.id));return {projects:shown,hidden:refs.projects.length-shown.length,drafts:refs.drafts};};
  function todosOf(workspace,now,staff){
    const out=[];
    for(const persona of store.all(K.personas).filter(item=>live(item)&&item.workspaceId===workspace.id)){
      const status=reuseStateOf(store,persona,{workspaceId:workspace.id,now});
      // 보관 기간이 끝났는데 참조가 남아 지우지 못한 인물이 먼저다(참조를 정리하면 다음 쓸기가 지운다).
      const why=persona.deletionRequest?'deletion_requested':persona.status==='deleting'?'deleting':retentionDue(persona,now)?'retention_due':workspace.status!=='active'?'closed':!status.usable&&['expired','paused','reuse_off'].includes(status.reason)?status.reason:null;
      if(!why)continue;
      const whole=['deletion_requested','deleting','retention_due'].includes(why),refs=staffReferences(staff,personaReferences(persona,now,{reuseOnly:!whole}));
      if(why==='deletion_requested'||why==='deleting'||refs.projects.length||refs.hidden)out.push({personaId:persona.id,name:persona.displayName||'',why,projects:refs.projects,hidden:refs.hidden,drafts:refs.drafts||0});
    }
    return out;
  }
  function workspaceSummary(workspace,staff,now){
    return {id:workspace.id,name:workspace.name,status:workspace.status,revision:workspace.revision,staffOwnerName:store.get('users',workspace.staffOwnerId)?.name||'',memberCount:(workspace.members||[]).length,
      modelCount:store.all(K.personas).filter(persona=>live(persona)&&persona.workspaceId===workspace.id).length,todoCount:todosOf(workspace,now,staff).length,canManage:canManage(staff,workspace)};
  }
  const visibleWorkspace=(staff,workspace)=>staff.role==='admin'||workspace.staffOwnerId===staff.id||store.all(PROJECTS).some(row=>row.customerWorkspaceId===workspace.id&&readable(staff,row.id));
  function staffList(user){
    const staff=staffOf(user),now=clock();
    return store.readScope(()=>({
      claims:store.all(CLAIMS).filter(found=>readable(staff,found.projectId)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,100).map(found=>claimStaffView(found,staff)),
      workspaces:store.all(K.workspaces).filter(workspace=>visibleWorkspace(staff,workspace)).sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(workspace=>workspaceSummary(workspace,staff,now)),
      reuseRequests:store.all(PROJECTS).filter(row=>object(row.workspaceRequest)&&!row.workspaceRequest.confirmedAt&&row.stage!=='archived'&&readable(staff,row.id)).map(row=>reuseRequestView(row,staff,now)),
      canWrite:staff.role!=='viewer',isAdmin:staff.role==='admin'}));
  }
  // 다시 쓰기 의뢰 연결 확인 줄: 인물 상태 · 실제 인물이면 당사자 동의가 다시 쓰기 · 광고를 허락하는지(세부 대조는 직원이 동의 기록 화면에서 본다).
  function reuseRequestView(row,staff,now){
    const request=row.workspaceRequest,workspace=store.get(K.workspaces,request.workspaceId),persona=store.get(K.personas,request.personaId);
    const state=live(persona)?reuseStateOf(store,persona,{workspaceId:request.workspaceId,revisionId:request.revisionId,now}):{usable:false,reason:'deleted'};
    return {projectId:row.id,projectRevision:row.revision,title:row.title,stage:row.stage,ownerName:store.get('users',row.ownerId)?.name||'',workspaceId:request.workspaceId,workspaceName:workspace?.name||'',personaId:request.personaId,personaName:persona?.displayName||'',personaKind:persona?.kind||'',
      revisionId:request.revisionId,attachedAt:request.attachedAt,confirmedAt:request.confirmedAt||null,usable:state.usable,reason:state.reason,consentAllows:live(persona)?consentAllowsReuse(store,persona):false,
      canConfirm:!request.confirmedAt&&!!workspace&&canManage(staff,workspace)&&staff.role!=='viewer'};
  }
  function staffRead(user,id){
    const staff=staffOf(user),now=clock();
    return store.readScope(()=>{
      const workspace=workspaceOf(id);if(!visibleWorkspace(staff,workspace))throw fail('그 브랜드를 찾지 못했어요.',404);
      const personas=store.all(K.personas).filter(persona=>persona.workspaceId===workspace.id&&(live(persona)||persona.status==='deleting')).sort(byTime).map(persona=>{
        const state=reuseStateOf(store,persona,{workspaceId:workspace.id,now});
        return {id:persona.id,revision:persona.revision,name:persona.displayName||'',kind:persona.kind,status:persona.status,effective:state.status,usable:state.usable,reason:state.reason,retention:persona.retention||null,deleteAt:brandDeleteAt(persona),
          deletionRequest:persona.deletionRequest||null,paused:persona.paused||null,originProjectId:persona.originProjectId,references:staffReferences(staff,personaReferences(persona,now))};
      });
      const projects=store.all(PROJECTS).filter(row=>(row.customerWorkspaceId===workspace.id||row.workspaceRequest?.workspaceId===workspace.id)&&readable(staff,row.id)).map(row=>({id:row.id,revision:row.revision,title:row.title,stage:row.stage,linked:row.customerWorkspaceId===workspace.id,
        workspaceRequest:object(row.workspaceRequest)?{personaId:row.workspaceRequest.personaId,confirmedAt:row.workspaceRequest.confirmedAt||null}:null}));
      return {workspace:{id:workspace.id,name:workspace.name,status:workspace.status,revision:workspace.revision,staffOwnerId:workspace.staffOwnerId,staffOwnerName:store.get('users',workspace.staffOwnerId)?.name||'',createdAt:workspace.createdAt,closedAt:workspace.closedAt||null,
        members:(workspace.members||[]).map(member=>({id:member.id,displayName:member.displayName||'',idHint:idHint(member.synkUserId),role:member.role,addedAt:member.addedAt,via:member.via?.claimId?'claim':'staff'})),
        personas,pending:pendingPersonas(workspace).map(persona=>({id:persona.id,name:persona.displayName||'',originProjectId:persona.originProjectId})),projects,todos:todosOf(workspace,now,staff),
        history:(workspace.history||[]).slice(-50),canManage:canManage(staff,workspace)&&staff.role!=='viewer',isAdmin:staff.role==='admin'}};
    });
  }
  // 연결 · 합류 요청 결정(설계 3-2 · 4-4): 요청 프로젝트를 읽을 수 있어야 하고, 기존 브랜드면 그 브랜드 담당이나 관리자. 근거 한 줄을 꼭 받는다.
  // 결정 때 프로젝트가 보관됐거나 초대 판이 요청 때와 다르면 승인을 막는다(손님이 새 링크로 다시 요청). 연결인지 합류인지는 지금 프로젝트에 브랜드가 있는지로 계산한다.
  function decideClaim(user,claimId,input){
    keys(input,['action','note','mode','workspaceId','name','role']);
    const staff=writer(user),note=text(input.note,300,true);
    if(!['approve','reject'].includes(input.action))throw fail('승인인지 거절인지 골라 주세요.');
    return store.transaction(()=>{
      const now=clock(),found=typeof claimId==='string'&&UUID.test(claimId)?store.get(CLAIMS,claimId):null;
      if(!found)throw fail('그 요청을 찾지 못했어요.',404);
      const row=clientProjects.project(staff,found.projectId);
      if(found.status!=='pending')throw fail('이미 정한 요청이에요. 새로 불러와 주세요.',409);
      if(input.action==='reject'){if(row.customerWorkspaceId){const linked=store.get(K.workspaces,row.customerWorkspaceId);if(linked)manage(staff,linked);}const next={...found,status:'rejected',decidedAt:now,decidedBy:staff.id,note};store.put(CLAIMS,next.id,next);return {claim:claimStaffView(next,staff)};}
      if(row.stage==='archived'||!row.inviteHash||row.inviteRevision!==found.inviteRevision)throw fail('손님이 다시 요청해야 해요. 초대 링크가 바뀌었거나 닫힌 프로젝트예요.',409,'SYNK_PULSE_CLAIM_STALE');
      const role=input.role===undefined?'admin':input.role;if(!['admin','member'].includes(role))throw fail('역할을 골라 주세요.');
      let workspace,created=false;
      if(row.customerWorkspaceId){
        workspace=workspaceOf(row.customerWorkspaceId);
        if(input.mode==='new'||input.workspaceId!==undefined&&input.workspaceId!==workspace.id)throw fail('이 프로젝트는 이미 브랜드에 연결돼 있어요. 그 브랜드에 합류시켜 주세요.',409);
      }else if(input.mode==='existing')workspace=workspaceOf(input.workspaceId);
      else if(input.mode==='new'){
        const name=text(input.name,80);if(!name)throw fail('브랜드 이름을 적어 주세요.');
        workspace={id:randomUUID(),name,status:'active',closedAt:null,closedBy:null,staffOwnerId:staff.id,members:[],revision:0,createdAt:now,createdBy:staff.id,history:[]};created=true;
      }else throw fail('새 브랜드인지 기존 브랜드인지 골라 주세요.');
      if(!created){manage(staff,workspace);if(workspace.status!=='active')throw fail('닫힌 브랜드예요. 관리자가 다시 연 뒤에 연결해 주세요.',409);}
      const already=memberOf(workspace,found.synkUserId);
      if(!already&&(workspace.members||[]).length>=WORKSPACE_LIMITS.members)throw fail('브랜드 회원이 너무 많아요.',409);
      const members=already?workspace.members:[...(workspace.members||[]),{id:randomUUID(),synkUserId:found.synkUserId,displayName:found.displayName||'',role,addedAt:now,addedBy:staff.id,via:{claimId:found.id}}];
      const join=!!row.customerWorkspaceId;
      let next=created?putWorkspace({...workspace,members},{action:'created',actorKind:'staff',actor:staff.id,note,subject:row.id}):putWorkspace({...workspace,members},{action:join?'member_joined':'project_linked',actorKind:'staff',actor:staff.id,note,subject:row.id});
      if(!join){touchProject(row,{customerWorkspaceId:workspace.id},'고객 브랜드 연결(연결 요청 승인)',staff.id);if(created)next=putWorkspace(next,{action:'project_linked',actorKind:'staff',actor:staff.id,note,subject:row.id});}
      const decided={...found,status:'approved',decidedAt:now,decidedBy:staff.id,workspaceId:workspace.id,note};store.put(CLAIMS,decided.id,decided);
      return {claim:claimStaffView(decided,staff),workspace:{id:next.id,name:next.name}};
    });
  }
  // 브랜드 일: 회원 역할 · 빼기 · 닫기(담당이나 관리자), 다시 열기(관리자). 모두 그 즉시 회원 경로의 다음 요청부터 반영된다(캐시 없음).
  function workspaceAction(user,id,input){
    keys(input,['action','revision','memberId','role','note']);
    const staff=writer(user),note=text(input.note,300,true);
    return store.transaction(()=>{
      const workspace=workspaceOf(id);
      if(input.revision!==workspace.revision)throw fail('그사이 브랜드 내용이 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',409);
      const member=()=>{const found=(workspace.members||[]).find(item=>item.id===input.memberId);if(!found)throw fail('그 회원을 찾지 못했어요.',404);return found;};
      let next;
      if(input.action==='set_role'){manage(staff,workspace);const found=member();if(!['admin','member'].includes(input.role))throw fail('역할을 골라 주세요.');next=putWorkspace({...workspace,members:workspace.members.map(item=>item.id===found.id?{...item,role:input.role}:item)},{action:'member_role',actorKind:'staff',actor:staff.id,note,subject:found.id});}
      else if(input.action==='remove_member'){manage(staff,workspace);const found=member();next=putWorkspace({...workspace,members:workspace.members.filter(item=>item.id!==found.id)},{action:'member_removed',actorKind:'staff',actor:staff.id,note,subject:found.id});}
      else if(input.action==='close'){manage(staff,workspace);if(workspace.status!=='active')throw fail('이미 닫힌 브랜드예요.',409);next=putWorkspace({...workspace,status:'closed',closedAt:clock(),closedBy:staff.id},{action:'closed',actorKind:'staff',actor:staff.id,note});}
      else if(input.action==='reopen'){adminOf(user);if(workspace.status!=='closed')throw fail('닫힌 브랜드가 아니에요.',409);next=putWorkspace({...workspace,status:'active',closedAt:null,closedBy:null},{action:'reopened',actorKind:'staff',actor:staff.id,note});}
      else throw fail('브랜드 작업을 확인해 주세요.');
      return {workspace:{id:next.id,status:next.status,revision:next.revision}};
    });
  }
  const usageInput=(input,locale,stamp,studio,personaId)=>{
    if(!object(input.usage)||Object.keys(input.usage).some(key=>!Object.hasOwn(USAGE_TEXT,key)))throw fail('이번 광고의 사용 범위를 확인해 주세요.');
    const usage={personaId};for(const [key,max]of Object.entries(USAGE_TEXT))usage[key]=text(input.usage[key],max);
    if(!usage.purpose||!usage.media||!usage.period)throw fail('광고 목적 · 매체 · 기간은 꼭 적어 주세요.');
    if(input.translation!==undefined&&(!object(input.translation)||Object.keys(input.translation).some(key=>!Object.hasOwn(USAGE_TEXT,key))))throw fail('번역 칸을 확인해 주세요.');
    // 영어 프로젝트: 손님에게 보일 사용 범위 글은 번역을 함께 받아야 보낸다(판 3 set_usage와 같은 규칙 · 같은 번역 키).
    if(locale&&locale!=='ko'){let map=studio.translations;for(const [key,max]of Object.entries(USAGE_TEXT)){const source=usage[key];if(!source||!HANGUL.test(source))continue;const said=typeof input.translation?.[key]==='string'?input.translation[key].trim():'';if(!said)throw fail('영어 프로젝트예요. 손님에게 보일 영어 문장을 칸마다 함께 적어 주세요.',409);map=withTranslation(map,{key:`usage:${personaId}:${key}`,source,max,text:said,status:'reviewed',locale,by:stamp.by,at:stamp.at});}studio.translations=map;}
    return usage;
  };
  // 프로젝트 일(설계 4-4): 연결 · 끊기 · 다시 쓰기 의뢰 확인 · 사용 범위. 그 프로젝트 권한과 브랜드 담당(또는 관리자) 둘 다.
  function projectAction(user,projectId,input){
    keys(input,['action','revision','workspaceId','note','usage','translation']);
    const staff=writer(user),note=text(input.note,300,true);
    return store.transaction(()=>{
      const now=clock(),action=input.action;
      const row=action==='set_usage'?clientProjects.project(staff,projectId,true):clientProjects.project(staff,projectId);
      if(input.revision!==row.revision)throw fail('그사이 프로젝트가 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',409);
      if(row.stage==='archived')throw fail('보관한 프로젝트예요.',409);
      if(action==='link'){
        if(row.customerWorkspaceId)throw fail('이미 브랜드에 연결된 프로젝트예요. 먼저 연결을 끊어 주세요.',409);
        const workspace=workspaceOf(input.workspaceId);manage(staff,workspace);if(workspace.status!=='active')throw fail('닫힌 브랜드예요.',409);
        touchProject(row,{customerWorkspaceId:workspace.id},'고객 브랜드 연결',staff.id);putWorkspace(workspace,{action:'project_linked',actorKind:'staff',actor:staff.id,note,subject:row.id});
        return {project:{id:row.id,customerWorkspaceId:workspace.id}};
      }
      if(action==='unlink'){
        if(!row.customerWorkspaceId)throw fail('브랜드에 연결되지 않은 프로젝트예요.',409);
        const workspace=store.get(K.workspaces,row.customerWorkspaceId);if(workspace)manage(staff,workspace);else adminOf(user);
        touchProject(row,{customerWorkspaceId:undefined},'고객 브랜드 연결 끊음',staff.id);if(workspace)putWorkspace(workspace,{action:'project_unlinked',actorKind:'staff',actor:staff.id,note,subject:row.id});
        return {project:{id:row.id,customerWorkspaceId:null}};
      }
      if(action==='confirm_request'||action==='set_usage'){
        const request=row.workspaceRequest;if(!object(request))throw fail('다시 쓰기 의뢰가 아니에요.',409);
        if(action==='confirm_request'&&request.confirmedAt)throw fail('이미 연결을 확인했어요.',409);
        if(action==='set_usage'&&!request.confirmedAt)throw fail('연결을 먼저 확인해 주세요.',409);
        const workspace=workspaceOf(request.workspaceId);manage(staff,workspace);
        if(row.customerWorkspaceId&&row.customerWorkspaceId!==workspace.id)throw fail('다른 브랜드에 연결된 프로젝트예요.',409);
        if(action==='set_usage'&&row.customerWorkspaceId!==workspace.id)throw fail('브랜드 연결이 끊긴 프로젝트예요.',409);
        const persona=personaOf(request.personaId),state=reuseStateOf(store,persona,{workspaceId:workspace.id,revisionId:request.revisionId,now});
        if(!state.usable)throw fail('지금은 이 인물을 다시 쓸 수 없어요(사용 중지 · 기간 끝 · 다시 쓰기 꺼짐 · 닫힌 브랜드). 브랜드 화면을 확인해 주세요.',409,'SYNK_PULSE_MODEL_UNUSABLE');
        // 실제 인물: 당사자 동의의 기계 칸(ads · reuse)이 허락하지 않으면 막는다 — 세부 범위는 직원이 동의 기록과 나란히 보고 근거로 남긴다(설계 5판 D7).
        if(!consentAllowsReuse(store,persona))throw fail('당사자 동의 범위 밖이에요. 새 당사자 동의를 받은 뒤 확인해 주세요.',409,'SYNK_PULSE_CONSENT_SCOPE');
        if(!row.studio?.request)throw fail('의뢰서가 있는 프로젝트에서만 정할 수 있어요.',409);
        const studio=structuredClone(row.studio),stamp={by:staff.id,at:now},usage=usageInput(input,localeOf(row),stamp,studio,persona.id);
        studio.request={...studio.request,personaUsage:{...usage,setAt:now,setBy:staff.id,approvalId:'',approvedAt:''}};
        // 사용 범위를 고치면 붙은 인물 참조를 뗀다 — 손님이 새 범위를 다시 확인해야 제작을 시작한다(판 3 set_usage와 같다).
        if(personaRefOf(studio.strategy?.data?.castingSelection?.personaRef))studio.strategy=withPersonaRef(studio.strategy,null,{at:now,author:'staff',authorId:staff.id,authorName:staff.name||'담당자'});
        if(Buffer.byteLength(JSON.stringify(studio),'utf8')>1500000)throw fail('이 프로젝트의 기록이 가득 찼어요. 새 프로젝트로 이어 가 주세요.',409);
        if(action==='confirm_request'){
          touchProject(row,{customerWorkspaceId:workspace.id,workspaceRequest:{...request,confirmedAt:now,confirmedBy:staff.id,confirmNote:note},studio},'다시 쓰기 의뢰 연결 확인',staff.id);
          putWorkspace(workspace,{action:'reuse_confirmed',actorKind:'staff',actor:staff.id,note,subject:row.id});
        }else touchProject(row,{studio},'다시 쓰기 사용 범위 바꿈',staff.id);
        return {project:{id:row.id,customerWorkspaceId:workspace.id,confirmedAt:action==='confirm_request'?now:request.confirmedAt}};
      }
      throw fail('프로젝트 작업을 확인해 주세요.');
    });
  }
  // 인물 일(설계 4-4 · 5-6): 사용 중지(브랜드 담당 · 관리자), 중지 풀기 · 삭제 · 삭제 이어 하기 · 귀속 취소(관리자).
  async function personaAction(user,personaId,input){
    keys(input,['action','revision','note']);
    const action=input.action;
    if(action==='delete')return deletePersona(user,personaId,input);
    if(action==='delete_continue'){adminOf(user);const persona=typeof personaId==='string'&&UUID.test(personaId)?store.get(K.personas,personaId):null;if(!persona||persona.status!=='deleting')throw fail('지우는 중인 인물이 아니에요.',409);return settleDeletion(persona.id);}
    const staff=writer(user),note=text(input.note,300,true);
    return store.transaction(()=>{
      const now=clock(),persona=personaOf(personaId);
      if(input.revision!==persona.revision)throw fail('그사이 인물 내용이 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',409);
      if(action==='pause'){
        const workspace=workspaceOf(persona.workspaceId);manage(staff,workspace);
        if(persona.status!=='ready')throw fail('쓸 수 있는 인물만 사용 중지할 수 있어요.',409);
        const next=putPersona(persona,{status:'paused',paused:{at:now,byKind:'staff',by:staff.id,note}},{action:'paused',actorKind:'staff',actor:staff.id});
        putWorkspace(workspace,{action:'model_paused',actorKind:'staff',actor:staff.id,note,subject:persona.id});
        return {persona:{id:next.id,status:next.status,revision:next.revision}};
      }
      if(action==='unpause'){
        adminOf(user);if(persona.status!=='paused')throw fail('사용 중지된 인물이 아니에요.',409);
        // 재개는 중지 풀기 + 새 다시 쓰기 동의(설계 5-6 · 5판 D12): 보관 범위를 프로젝트로 두고 브랜드 admin이 새로 동의해야 다시 쓴다.
        const next=putPersona(persona,{status:'ready',paused:null,retention:{scope:'project',until:null,reuseApprovalId:null}},{action:'unpaused',actorKind:'staff',actor:staff.id});
        const workspace=persona.workspaceId?store.get(K.workspaces,persona.workspaceId):null;if(workspace)putWorkspace(workspace,{action:'model_unpaused',actorKind:'staff',actor:staff.id,note,subject:persona.id});
        return {persona:{id:next.id,status:next.status,revision:next.revision}};
      }
      if(action==='unassign'){
        adminOf(user);if(!persona.workspaceId)throw fail('브랜드에 귀속되지 않은 인물이에요.',409);
        const workspace=workspaceOf(persona.workspaceId),refs=personaReferences(persona,now,{reuseOnly:true,workspaceId:workspace.id});
        if(referenced(refs))throw Object.assign(fail('이 브랜드에서 이 인물을 쓰는 끝나지 않은 다시 쓰기 의뢰가 있어요. 그 의뢰를 먼저 정리해 주세요.',409,'SYNK_PULSE_PERSONA_REFERENCED'),{references:refs});
        if(persona.retention?.scope==='reuse')recordWithdrawal(persona,workspace,{by:staff.id,actorKind:'staff',actorName:staff.name||'',authMethod:'staff',note,now});
        const next=putPersona(persona,{workspaceId:null,retention:{scope:'project',until:null,reuseApprovalId:null}},{action:'unassigned',actorKind:'staff',actor:staff.id});
        putWorkspace(workspace,{action:'model_unassigned',actorKind:'staff',actor:staff.id,note,subject:persona.id});
        return {persona:{id:next.id,status:next.status,revision:next.revision,workspaceId:null}};
      }
      throw fail('인물 작업을 확인해 주세요.');
    });
  }

  // ── 삭제(설계 5-6 · 5판 D10): 문서 먼저, 파일 나중 ──
  // ① 동기 트랜잭션: 참조 확인 → 출처 · 판 묘비, 동의 암호문 지움, 지울 이름은 백업 목록이 읽지 않는 칸(pendingUnlink)에, 상태 deleting.
  // ② 커밋 뒤 파일 지우기(없는 파일은 건너뜀, 다른 소유 목록에 같은 이름이 있으면 지우지 않음). ③ 트랜잭션으로 pendingUnlink를 비우고 묘비(deleted).
  // 도중에 멈추면 deleting + pendingUnlink가 남고, 서버 시작 때(resumeDeletions) · 직원의 「삭제 이어 하기」가 같은 일을 이어 한다.
  async function deletePersona(user,personaId,input){
    const staff=adminOf(user),note=text(input.note,300,true);
    const hashes=await personaHashes(personaOf(personaId));
    store.transaction(()=>{
      const now=clock(),persona=personaOf(personaId);
      if(input.revision!==persona.revision)throw fail('그사이 인물 내용이 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',409);
      if(persona.status==='deleting')throw fail('이미 지우는 중이에요. 삭제 이어 하기를 눌러 주세요.',409);
      const refs=personaReferences(persona,now);
      if(referenced(refs))throw Object.assign(fail('이 인물을 쓰는 끝나지 않은 프로젝트나 의뢰가 있어요. 그 일을 먼저 끝내거나 정리해 주세요.',409,'SYNK_PULSE_PERSONA_REFERENCED'),{references:refs});
      beginDeletion(persona,{actorKind:'staff',actor:staff.id,note,now,hashes});
    });
    return settleDeletion(personaId);
  }
  // 지울 인물 파일(살아 있는 출처 · 판 자산)의 이름 → 본문 sha256. 출처는 받을 때 잰 값, 판 자산은 지금 잰다(없는 파일은 null — 지킬 바이트가 없다).
  async function personaHashes(persona){
    const out=new Map();
    for(const source of store.all(K.sources).filter(item=>item.personaId===persona.id&&live(item)&&typeof item.diskName==='string'))
      out.set(source.diskName,SHA256.test(source.sha256||'')?source.sha256:await fileSha(join(store.directory,'studio-media',source.diskName)));
    for(const revision of store.all(K.revisions).filter(item=>item.personaId===persona.id&&live(item)))
      for(const entry of revision.assets||[])if(typeof entry?.diskName==='string'&&!out.has(entry.diskName))out.set(entry.diskName,SHA256.test(entry.sha256||'')?entry.sha256:await fileSha(join(store.directory,'studio-media',entry.diskName)));
    return out;
  }
  // ① 트랜잭션의 몸통(부르는 쪽 트랜잭션 안 · 참조 확인 뒤): 관리자 삭제와 보관 기간 뒤 지우기(sweepRetention)가 함께 쓴다.
  // 출처 · 판을 묘비로, 동의 암호문 지움, 지울 이름은 pendingUnlink에. 판 3 승인 기록(보낸 파일 id · shown · viewedHash)은 지우지 않는다(5판 D10).
  // hashes: personaHashes의 결과(트랜잭션 밖에서 미리 잰 것). 그사이 새로 붙은 파일이 있으면 멈춘다(다시 하면 그 파일도 잰다) — 이름을 떼는 이 트랜잭션에서
  // 모든 본문 sha256을 묘비 기록(deletion.noVault)에 함께 남겨, 백업이 어느 순간에 찍혀도 「인물이 가진 이름」이나 「묘비 해시」 둘 중 하나로 그 바이트를 뺀다.
  function beginDeletion(persona,{actorKind,actor,note,reason='',now,hashes}){
    const names=[];
    for(const source of store.all(K.sources).filter(item=>item.personaId===persona.id&&live(item))){if(typeof source.diskName==='string')names.push(source.diskName);store.put(K.sources,source.id,{id:source.id,personaId:source.personaId,projectId:source.projectId,purpose:source.purpose,diskName:null,deletedAt:now});}
    for(const revision of store.all(K.revisions).filter(item=>item.personaId===persona.id&&live(item))){for(const entry of revision.assets||[])if(typeof entry?.diskName==='string')names.push(entry.diskName);store.put(K.revisions,revision.id,{...revision,assets:[],reference:null,motion:null,method:null,deletedAt:now});}
    if(names.some(name=>!hashes?.has(name)))throw fail('그사이 인물 파일이 바뀌었어요. 다시 해 주세요.',409);
    // 앞서 판 파일만 뺄 때 남긴 해시(removedNoVault)도 묘비로 옮긴다 — 묘비는 정해진 칸만 남기므로 여기서 합친다.
    const noVault=[...new Set([...(persona.deletion?.noVault||[]),...(Array.isArray(persona.removedNoVault)?persona.removedNoVault:[]),...names.map(name=>hashes.get(name))])].filter(hash=>typeof hash==='string'&&SHA256.test(hash)).sort();
    store.remove(K.consents,persona.id);
    const system=actorKind==='system';
    putPersona(persona,{status:'deleting',pendingUnlink:[...new Set(names)],deletion:{confirmedAt:now,confirmedBy:system?'system':actor,note,requested:persona.deletionRequest||null,...(reason?{reason}:{}),noVault}},{action:system?'retention_deleting':'deleting',actorKind,actor:system?'':actor});
    const workspace=persona.workspaceId?store.get(K.workspaces,persona.workspaceId):null;if(workspace)putWorkspace(workspace,{action:system?'model_retention_deleting':'model_deleting',actorKind,actor:system?'':actor,note,subject:persona.id});
  }

  // ── 보관 기간 뒤 지우기(11-11 결정 표 ① · ④ · ⑤, 판 4 설계 11-3) ── 시계 하나: 브랜드 인물은 그 브랜드에 묶인 가장 최근 reuse 동의의 지우는 날
  // (다시 쓰기 기한 + 30일 — 쓰는 중 · 기한 지남 · 철회 · 중지 모두 같다, 연장이 옮긴다), 브랜드 없는 인물은 원 프로젝트가 90일 정리로 「지운 의뢰」가 된 때.
  // 끝나지 않은 참조가 있으면 그 일이 끝날 때까지 미룬다. 브랜드 인물은 원 프로젝트 정리와 상관없다(시나리오 10).
  function brandDeleteAt(persona){
    if(!persona?.workspaceId)return null;
    const last=store.all(K.approvals).filter(approval=>approval.kind==='reuse'&&approval.decision==='approve'&&approval.personaId===persona.id&&approval.workspaceId===persona.workspaceId).sort(byTime).at(-1);
    return last?last.terms?.deleteAt||reuseDeleteAt(last.terms?.until):null;
  }
  const originRetired=persona=>store.get(PROJECTS,persona.originProjectId)?.studio?.request?.status==='retired';
  function retentionDue(persona,now){
    if(!live(persona)||persona.status==='deleting')return null;
    if(persona.workspaceId){const at=brandDeleteAt(persona);return at&&Date.parse(at)<=Date.parse(now)?{reason:'reuse_ended',deleteAt:at}:null;}
    return PERSONA_SETTLED.includes(persona.status)&&originRetired(persona)?{reason:'origin_retired',deleteAt:null}:null;
  }
  // 6시간마다 · 서버 시작 때(pulse-requests retireUnconfirmed 끝). 인물마다 트랜잭션 하나로 다시 읽어 판정하고, 커밋 뒤 파일을 지운다(멈추면 resumeDeletions가 잇는다).
  async function sweepRetention(){
    const result={deleted:0,held:0,failed:0};
    for(const {id} of store.all(K.personas).filter(persona=>retentionDue(persona,clock()))){
      let started=false,hashes;
      try{hashes=await personaHashes(store.get(K.personas,id));}catch{result.failed++;continue;}
      try{
        store.transaction(()=>{
          const now=clock(),persona=store.get(K.personas,id),due=retentionDue(persona,now);
          if(!due)return;
          if(referenced(personaReferences(persona,now))){result.held++;return;}
          beginDeletion(persona,{actorKind:'system',actor:'',note:due.reason==='origin_retired'?'원 프로젝트를 정리해 함께 지움':'다시 쓰기 기한이 끝나 지움',reason:due.reason,now,hashes});
          started=true;
        });
      }catch{result.failed++;continue;}
      if(!started)continue;
      try{await finishDeletion(id);result.deleted++;}catch{result.failed++;}
    }
    return result;
  }
  // 문서는 이미 지웠다: 파일 지우기가 막히면(Windows에서 읽는 중인 파일의 EPERM · EBUSY 등) 오류 대신 「지우는 중」과 남은 파일 수를 돌려준다(Fable P2-2).
  async function settleDeletion(personaId){
    try{await finishDeletion(personaId);}catch{const current=store.get(K.personas,personaId);return {persona:{id:personaId,status:current?.status||'deleting'},pendingUnlink:(current?.pendingUnlink||[]).length,retry:true};}
    return {persona:{id:personaId,status:store.get(K.personas,personaId)?.status||'deleted'}};
  }
  async function finishDeletion(personaId){
    const persona=store.get(K.personas,personaId);if(!persona||persona.status!=='deleting')return;
    const owned=new Set(workspaceMediaNames(store.db)),pending=Array.isArray(persona.pendingUnlink)?persona.pendingUnlink:[];
    for(const name of pending){
      if(typeof name!=='string'||!MEDIA_NAME.test(name)||owned.has(name))continue;
      try{await unlink(join(store.directory,'studio-media',name));}catch(error){if(error?.code!=='ENOENT')throw error;}
    }
    store.transaction(()=>{
      const current=store.get(K.personas,personaId);if(!current||current.status!=='deleting')return;
      const at=clock(),revisionIds=store.all(K.revisions).filter(item=>item.personaId===personaId).map(item=>item.id);
      // 묘비: 이름 · 종류 · 브랜드 · 원 프로젝트 · 판 id · 이력 · 삭제 기록만 남긴다(손님 요청 글 · 견적 · 메모 · 보관 칸은 지운다).
      const tomb={id:current.id,schemaVersion:current.schemaVersion||1,workspaceId:current.workspaceId??null,originProjectId:current.originProjectId,kind:current.kind,displayName:current.displayName||'',status:'deleted',revision:(current.revision||0)+1,
        currentRevisionId:current.currentRevisionId||null,revisionIds,createdAt:current.createdAt,updatedAt:at,deletedAt:at,deletion:{...(current.deletion||{}),finishedAt:at},pendingUnlink:[],
        history:[...(current.history||[]),{id:randomUUID(),at,action:'deleted',actorKind:'system',actor:'',from:'deleting',to:'deleted'}].slice(-200)};
      store.put(K.personas,tomb.id,tomb);
    });
  }
  async function resumeDeletions(){
    for(const persona of store.all(K.personas).filter(item=>item.status==='deleting'&&!item.deletedAt)){try{await finishDeletion(persona.id);}catch{/* 다음 시작 · 직원 「삭제 이어 하기」가 잇는다 */}}
  }

  // 작업실 파일 하나의 본문 sha256(없는 파일은 null). 인물 판 파일 하나를 빼기 전에 server가 잰다(pulse-personas는 파일을 읽지 않는다).
  const mediaSha=diskName=>{if(typeof diskName!=='string'||!MEDIA_NAME.test(diskName))throw fail('파일 이름을 확인해 주세요.');return fileSha(join(store.directory,'studio-media',diskName));};
  return {mediaSha,enabled,projectProof,draftProof,projectState,claim,withdrawClaim,models,model,asset,attach,reuse,withdrawReuse,stop,deleteRequest,
    attachedRequest,ownerFor,personaReferences,staffList,staffRead,decideClaim,workspaceAction,projectAction,personaAction,deletePersona,finishDeletion,resumeDeletions,
    retentionDue,sweepRetention};
}
