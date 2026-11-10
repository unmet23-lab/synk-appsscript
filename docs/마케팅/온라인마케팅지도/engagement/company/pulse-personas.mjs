// 고객 전용 인물(2026-11-09 판 1 → 2026-11-10 판 3 접수 · 직원 검토 · 승인).
// 기획 docs/마케팅/PULSE_의뢰흐름_20261104/다국어와_고객전용인물_기획_20261108.md 12-2, 설계 같은 폴더 인물판3_설계_20261110.md.
// 인물은 처음에 그 요청을 낸 프로젝트(originProjectId)에 묶이고(workspaceId는 판 4), 파일은 studio-media에 같은 이름 규칙으로 두되 인물 문서가 갖는다.
// 이 모듈은 저장소 문서만 다룬다 — 생성 · 학습 · 외부 처리를 부르지 않는다(네트워크 · 생성 도구를 import하지 않고, 시험이 그것을 지킨다).
// 업로드와 승인은 「제작 가능성 검토 요청」과 그 기록일 뿐이고, 기준 얼굴 · 동작 시안은 제작팀이 만든 판을 직원이 올린다.
import {randomUUID,createHash} from 'node:crypto';
import {personaRefOf} from './public/pulse-app/casting-choice.mjs';
import {DEFAULT_LOCALE} from './public/pulse-app/i18n.mjs';
import {withTranslation,freshTranslation} from './pulse-translations.mjs';

export const PERSONA_KINDS=Object.freeze({
  workspaces:'customerWorkspaces',personas:'pulsePersonas',revisions:'pulsePersonaRevisions',
  sources:'pulsePersonaSources',consents:'pulsePersonaConsents',approvals:'pulsePersonaApprovals',
});
const K=PERSONA_KINDS;
// 더 검토 · 승인할 것이 없는 인물. 그 밖의 상태(모르는 값 포함)는 열린 요청으로 보고, 90일 정리가 그 프로젝트를 건너뛴다(자료를 남기는 쪽).
export const PERSONA_SETTLED=Object.freeze(['ready','retired','expired','withdrawn']);
// 의뢰서 초안의 인물 사진 칸(같은 사람 재현용 · 분위기 참고용). 이 칸의 파일은 프로젝트 자료(studio.assets · intake)로 가지 않는다 — 초대 링크로 열리면 안 된다.
export const PERSONA_SLOTS=Object.freeze(['persona-identity','persona-mood']);
export const PERSONA_PURPOSE=Object.freeze({'persona-identity':'identity','persona-mood':'mood'});

// ── 상태와 전이(순수 함수 표 하나) ──
// 일곱 걸음: 자료 제출 → 권한 · 제작 가능성 검토 → 견적 · 범위 확인 → 기준 얼굴 승인 → 제작 준비 → 동작 시안 승인 → 이번 광고 사용 확인.
export const PERSONA_STATES=Object.freeze(['submitted','needs_materials','rights_pending','reviewing','quote_review','reference_making','reference_review','building','motion_review','ready','withdrawn','retired']);
export const PERSONA_FINAL=Object.freeze(['withdrawn','retired']);
const OPEN=PERSONA_STATES.filter(state=>!PERSONA_FINAL.includes(state));
export const PERSONA_STEPS=Object.freeze({submitted:1,needs_materials:1,rights_pending:2,reviewing:2,quote_review:3,reference_making:4,reference_review:4,building:5,motion_review:6,ready:7});
// 직원 전이. real: 실제 인물만.
export const PERSONA_FLOW=Object.freeze({
  request_materials:Object.freeze({from:Object.freeze(['submitted','reviewing','rights_pending','needs_materials']),to:'needs_materials'}),
  ask_rights:Object.freeze({from:Object.freeze(['submitted','reviewing','needs_materials']),to:'rights_pending',real:true}),
  start_review:Object.freeze({from:Object.freeze(['submitted','needs_materials','rights_pending']),to:'reviewing'}),
  send_quote:Object.freeze({from:Object.freeze(['reviewing','quote_review']),to:'quote_review'}),
  publish_reference:Object.freeze({from:Object.freeze(['reference_making','reference_review','building','motion_review']),to:'reference_review'}),
  publish_motion:Object.freeze({from:Object.freeze(['building','motion_review']),to:'motion_review'}),
  withdraw:Object.freeze({from:Object.freeze(OPEN),to:'withdrawn'}),
  retire:Object.freeze({from:Object.freeze(['ready']),to:'retired'}),
});
// 손님 차례의 승인. 서로 대신하지 않는다(동의 · 품질 · 사용 · 최종 영상). usage는 고칠 점이 없다(물음은 일지로).
// materials는 승인이 아니라 「자료를 더 보냈다」 — 자료 보완 차례를 저희 차례로 돌린다.
export const PERSONA_APPROVAL_FLOW=Object.freeze({
  scope:Object.freeze({on:'quote_review',approve:'reference_making',changes:'reviewing'}),
  reference:Object.freeze({on:'reference_review',approve:'building',changes:'reference_making'}),
  motion:Object.freeze({on:'motion_review',approve:'ready',changes:'building'}),
  usage:Object.freeze({on:'ready',approve:'ready',changes:null}),
});
export function personaNext(persona,move){
  const status=persona?.status;
  if(move?.by==='staff'){const rule=PERSONA_FLOW[move.action];if(!rule||!rule.from.includes(status)||rule.real&&persona.kind!=='real')return null;return rule.to;}
  if(move?.by==='customer'){
    if(move.kind==='materials')return status==='needs_materials'?'submitted':null;
    const rule=PERSONA_APPROVAL_FLOW[move.kind];if(!rule||rule.on!==status)return null;
    return move.decision==='approve'?rule.approve:move.decision==='changes'?rule.changes:null;
  }
  return null;
}

const fail=(message,status=400,code='')=>Object.assign(new Error(message),{status,...(code?{code}:{})});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const HANGUL=/[가-힣]/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY=/^[A-Za-z0-9_-]{8,80}$/;
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function text(value,max,required=false){if(value===undefined||value===null){if(required)throw fail('필요한 내용을 적어 주세요.');return '';}if(typeof value!=='string'||value.length>max||CONTROL.test(value))throw fail('입력 내용과 길이를 확인해 주세요.');const clean=value.trim();if(required&&!clean)throw fail('필요한 내용을 적어 주세요.');return clean;}
const int=(value,min,max,message)=>{if(!Number.isSafeInteger(value)||value<min||value>max)throw fail(message);return value;};
const live=doc=>!!doc&&!doc.deletedAt;
const byTime=(a,b)=>String(a.createdAt||a.at||'').localeCompare(String(b.createdAt||b.at||''));

// 열린 인물 요청이 걸린 프로젝트. 묘비(지운 인물)는 건너뛴다(아르곤 판 1 A1).
export function openPersonaProjectIds(store){
  return new Set(store.all(K.personas).filter(persona=>live(persona)&&!PERSONA_SETTLED.includes(persona?.status)).map(persona=>persona?.originProjectId).filter(id=>typeof id==='string'&&id));
}
// 이 프로젝트 · 인물 · 판의 사용 승인(사용 범위를 고치면 approvalId가 비어 다시 받아야 한다).
function usageApproval(store,row,persona,revisionId){
  const usage=row?.studio?.request?.personaUsage,approval=usage?.personaId===persona.id&&usage.approvalId?store.get(K.approvals,usage.approvalId):null;
  return approval&&approval.kind==='usage'&&approval.decision==='approve'&&approval.personaId===persona.id&&approval.projectId===row.id&&approval.revisionId===revisionId?approval:null;
}
// 방향 제안 · 제작 시작 때 붙은 전용 인물을 다시 본다: 그 인물이 이 프로젝트에서 시작됐고(고객 브랜드로 넓히는 것은 판 4), 쓸 수 있는 상태(ready)이며,
// 참조한 판이 그 인물의 지금 공개 판이고, 이 프로젝트의 그 판 사용 승인이 사용 범위의 승인과 같은지. 하나라도 어긋나면 409로 최신 내용을 읽게 한다.
export function createPersonaGuard(store){
  return function assertPersonaUsable(ref,row){
    const valid=personaRefOf(ref),changed=()=>fail('전용 인물 판이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
    if(!valid)throw changed();
    const persona=store.get(K.personas,valid.personaId),revision=store.get(K.revisions,valid.revisionId);
    if(!persona||persona.status!=='ready'||persona.deletedAt||persona.originProjectId!==row?.id)throw changed();
    if(!revision||revision.personaId!==persona.id||revision.status!=='published'||revision.deletedAt||persona.currentRevisionId!==revision.id)throw changed();
    if(!usageApproval(store,row,persona,revision.id))throw changed();
    return {persona,revision};
  };
}

// 손님 보기의 일(일지 한 줄). 내부 일(이름 · 메모 · 판 열기 · 자산 · 방식)은 싣지 않는다.
const EVENT={created:'sent',source_added:'files',request_materials:'materials',ask_rights:'rights',start_review:'review',send_quote:'quote',publish_reference:'reference',publish_motion:'motion',set_usage:'usage',withdraw:'withdrawn',retire:'retired','approve:scope':'scope_ok','changes:scope':'scope_changes','approve:reference':'reference_ok','changes:reference':'reference_changes','approve:motion':'motion_ok','changes:motion':'motion_changes','approve:usage':'usage_ok'};
const SOURCE_OPEN=['submitted','needs_materials','rights_pending','reviewing'];
const REVISION_OPEN=['reviewing','quote_review','reference_making','reference_review','building','motion_review'];
export const PERSONA_LIMITS=Object.freeze({sources:30,assets:40,history:200,revisions:20});
const STAFF_FIELDS={
  request_materials:['why','translation'],ask_rights:['why','translation'],start_review:[],send_quote:['price','days','revisions','scope','translation'],
  publish_reference:['revisionId','assetIds','note','translation'],publish_motion:['revisionId','assetIds','note','translation'],withdraw:['why','translation'],retire:[],
  open_revision:[],remove_asset:['revisionId','assetId'],set_method:['revisionId','kind','base','note'],set_name:['displayName','translation'],note:['text'],
  set_usage:['brand','product','purpose','media','regions','period','fee','schedule','note','translation'],
};
const USAGE_TEXT={brand:80,product:120,purpose:200,media:200,regions:120,period:120,fee:120,schedule:120,note:600};
const NEXT_LINE={submitted:'손님 사진과 글을 보고 검토를 시작하거나 자료를 더 요청해요',needs_materials:'손님이 자료를 더 보내기를 기다려요',rights_pending:'당사자 동의를 확인해요(실제 인물)',reviewing:'만들 수 있는지 보고 견적 · 범위를 보내요',quote_review:'손님이 견적 · 범위를 확인하기를 기다려요',reference_making:'기준 얼굴 판을 올려 손님에게 보내요',reference_review:'손님이 기준 얼굴을 확인하기를 기다려요',building:'학습 · 검증을 하고 동작 시안을 올려 보내요',motion_review:'손님이 동작 시안을 확인하기를 기다려요',withdrawn:'거둔 요청이에요',retired:'사용을 마친 인물이에요'};

// features: pulseFeatures 서비스(read). localeOf(row): 프로젝트 소통 언어. 이 서비스는 고객 세션 · 직원 권한을 clientProjects로만 확인한다.
export function createPersonaService({store,clientProjects,features=null,localeOf=()=>DEFAULT_LOCALE,clock=()=>new Date().toISOString()}){
  const flags=()=>{try{const f=features?.read?.();return {personaRequest:f?.personaRequest===true,personaReal:f?.personaRequest===true&&f?.personaReal===true};}catch{return {personaRequest:false,personaReal:false};}};
  const personasOf=projectId=>store.all(K.personas).filter(persona=>live(persona)&&persona.originProjectId===projectId).sort(byTime);
  const latestOf=projectId=>personasOf(projectId).at(-1)||null;
  const openOf=projectId=>personasOf(projectId).filter(persona=>!PERSONA_FINAL.includes(persona.status)).at(-1)||null;
  const sourcesOf=personaId=>store.all(K.sources).filter(source=>live(source)&&source.personaId===personaId).sort(byTime);
  const revisionsOf=personaId=>store.all(K.revisions).filter(revision=>live(revision)&&revision.personaId===personaId).sort((a,b)=>a.number-b.number);
  const approvalsOf=personaId=>store.all(K.approvals).filter(approval=>approval.personaId===personaId).sort(byTime);
  const currentOf=persona=>{const revision=persona.currentRevisionId?store.get(K.revisions,persona.currentRevisionId):null;return live(revision)&&revision.personaId===persona.id&&revision.status==='published'?revision:null;};
  const approved=(persona,kind,revisionId)=>approvalsOf(persona.id).some(approval=>approval.kind===kind&&approval.decision==='approve'&&approval.revisionId===revisionId);
  // 손님에게 한 번이라도 보낸 판 파일: 보낼 때마다 쌓는 sent · 지금 보낸 묶음 · 확인 기록이 본 것(shown). 확인 기록이 가리키는 그림이 사라지지 않게 지우지 않는다(GPT GA1).
  const sentOf=(persona,revision)=>[...new Set([...(revision.sent||[]),...(revision.reference?.assetIds||[]),...(revision.motion?.assetIds||[]),...approvalsOf(persona.id).filter(approval=>approval.revisionId===revision.id).flatMap(approval=>approval.shown?.assetIds||[])])];
  const withSent=(revision,picked)=>[...new Set([...(revision.sent||[]),...picked])];
  const usageOf=(row,persona)=>{const usage=row?.studio?.request?.personaUsage;return object(usage)&&usage.personaId===persona.id?usage:null;};
  function getPersona(id){const persona=typeof id==='string'&&UUID.test(id)?store.get(K.personas,id):null;if(!live(persona))throw fail('그 인물을 찾지 못했어요.',404);return persona;}

  function putPersona(persona,{action,actorKind,actor,from}){
    const at=clock(),next={...persona,revision:(persona.revision||0)+1,updatedAt:at};
    next.history=[...(persona.history||[]),{id:randomUUID(),at,action,actorKind,actor:String(actor||''),from:from??persona.status,to:next.status}].slice(-PERSONA_LIMITS.history);
    store.put(K.personas,next.id,next);return next;
  }
  // 원 프로젝트에 기록 한 줄(90일 시계 · 직원 · 손님 화면 새로 읽기). studio를 넘기면 그것도 함께 쓴다.
  function touch(row,action,actor,studio=null){
    const at=clock();
    clientProjects.commitWorkflow({...row,...(studio?{studio}:{}),revision:row.revision+1,updatedAt:at,history:[...(row.history||[]),{id:randomUUID(),action,actor,at}].slice(-300)});
  }
  // 영어 프로젝트에서 손님에게 보이는 직원 글: 한글이 있으면 그 언어 번역을 함께 받아야 보낸다(직원이 처음부터 손님 언어로 적었으면 그대로 보인다).
  function translate(studio,pairs,locale,stamp){
    if(!locale||locale===DEFAULT_LOCALE)return false;
    let map=studio.translations,changed=false;
    for(const pair of pairs){
      if(!pair.source){continue;}
      if(!HANGUL.test(pair.source))continue;
      const said=typeof pair.text==='string'?pair.text.trim():'';
      if(!said)throw fail('영어 프로젝트예요. 손님에게 보일 영어 문장을 칸마다 함께 적어 주세요.',409);
      map=withTranslation(map,{key:pair.key,source:pair.source,max:pair.max,text:said,status:'reviewed',locale,by:stamp.by,at:stamp.at});changed=true;
    }
    if(changed)studio.translations=map;
    return changed;
  }
  const said=(input,field)=>object(input.translation)&&typeof input.translation[field]==='string'?input.translation[field]:undefined;
  function translationInput(input,allowed){if(input.translation===undefined)return;if(!object(input.translation)||Object.keys(input.translation).some(key=>!allowed.includes(key)))throw fail('번역 칸을 확인해 주세요.');}

  // ── 손님 보기 ──
  const quoteTerms=quote=>({price:quote.price,days:quote.days,revisions:quote.revisions,scope:quote.scope,at:quote.at});
  const usageTerms=usage=>Object.fromEntries([...Object.keys(USAGE_TEXT),'setAt'].map(key=>[key,usage[key]||'']));
  const hashOf=(kind,persona,revision,assetIds,terms)=>sha({v:1,kind,personaId:persona.id,revisionId:revision?.id||null,assets:[...assetIds].sort(),terms});
  // 지금 손님 차례인 승인 하나와 그 viewedHash(서버가 계산한다 — 화면이 만든 해시를 믿지 않는다).
  function awaiting(persona,row){
    const current=currentOf(persona),want=(kind,revision,assetIds,terms)=>({kind,revision,assetIds,viewedHash:hashOf(kind,persona,revision,assetIds,terms)});
    if(persona.status==='quote_review'&&persona.quote)return want('scope',null,[],quoteTerms(persona.quote));
    if(persona.status==='reference_review'&&current?.reference)return want('reference',current,current.reference.assetIds,{note:current.reference.note||'',at:current.reference.publishedAt});
    if(persona.status==='motion_review'&&current?.motion)return want('motion',current,current.motion.assetIds,{note:current.motion.note||'',at:current.motion.publishedAt});
    if(persona.status==='ready'&&current){const usage=usageOf(row,persona);if(usage&&!usageApproval(store,row,persona,current.id))return want('usage',current,current.reference?.assetIds||[],{...usageTerms(usage),number:current.number});}
    return null;
  }
  function customerView(row,locale=localeOf(row)){
    const persona=latestOf(row.id);if(!persona)return null;
    const map=row.studio?.translations,tr=(key,value)=>locale!==DEFAULT_LOCALE&&typeof value==='string'&&value?freshTranslation(map,key,value,locale)??value:value||'';
    const current=persona.status==='withdrawn'?null:currentOf(persona),want=awaiting(persona,row),usage=usageOf(row,persona),sources=sourcesOf(persona.id);
    const asset=id=>{const found=current.assets.find(item=>item.id===id);return found?{id:found.id,mimeType:found.mimeType,url:`/pulse/api/persona/media/${found.id}`}:null;};
    const set=(part,key)=>current?.[part]?{assets:current[part].assetIds.map(asset).filter(Boolean),note:tr(`persona:${current.id}:${key}`,current[part].note),at:current[part].publishedAt}:null;
    const usageDone=!!(current&&usage&&usageApproval(store,row,persona,current.id));
    const turn=PERSONA_FINAL.includes(persona.status)?'end':want||persona.status==='needs_materials'?'customer':persona.status==='ready'&&usageDone?'done':'staff';
    const numbers=new Map(revisionsOf(persona.id).map(revision=>[revision.id,revision.number]));
    return {id:persona.id,kind:persona.kind,status:persona.status,step:PERSONA_STEPS[persona.status]||null,turn,
      name:tr(`persona:${persona.id}:name`,persona.displayName),why:tr(`persona:${persona.id}:why`,persona.why),
      request:{look:persona.request?.look||'',use:persona.request?.use||'',keep:persona.request?.keep||''},
      sources:{identity:sources.filter(source=>source.purpose==='identity').length,mood:sources.filter(source=>source.purpose==='mood').length,files:sources.map(source=>({id:source.id,fileName:source.fileName,purpose:source.purpose,at:source.at}))},
      canAddSources:SOURCE_OPEN.includes(persona.status),
      quote:persona.quote?{price:persona.quote.price,days:persona.quote.days,revisions:persona.quote.revisions,scope:tr(`persona:${persona.id}:scope`,persona.quote.scope),at:persona.quote.at}:null,
      revision:current?{id:current.id,number:current.number,reference:set('reference','referenceNote'),motion:set('motion','motionNote')}:null,
      usage:usage?{...Object.fromEntries(Object.keys(USAGE_TEXT).map(key=>[key,tr(`usage:${persona.id}:${key}`,usage[key])])),setAt:usage.setAt||'',approved:usageDone,approvedAt:usageDone?usage.approvedAt||'':''}:null,
      awaiting:want?{kind:want.kind,revisionId:want.revision?.id||null,viewedHash:want.viewedHash}:null,
      events:(persona.history||[]).map(entry=>({entry,code:EVENT[entry.action]})).filter(item=>item.code).map(({entry,code})=>({id:entry.id,at:entry.at,code,who:entry.actorKind==='customer'?'me':'staff'})),
      approvals:approvalsOf(persona.id).filter(approval=>approval.projectId===row.id).map(approval=>({kind:approval.kind,decision:approval.decision,at:approval.at,number:numbers.get(approval.revisionId)||null}))};
  }

  // ── 초안 · 의뢰서에서 인물 만들기(부르는 쪽의 트랜잭션 안) ──
  // 스위치는 서버가 강제한다: 접수를 끄면 새 인물을 만들지 않고, 실제 인물은 실제 인물 접수를 켰을 때만.
  function assertRequest(request){
    const f=flags();
    if(!f.personaRequest)throw fail('맞춤 인물 요청은 아직 받지 않아요. 다른 모델 선택으로 보내 주세요.',409);
    if(request?.kind==='real'&&!f.personaReal)throw fail('실제 인물 출연 요청은 아직 받지 않아요. 새 가상 인물로 요청해 주세요.',409);
  }
  // 손님이 보낸 인물 요청을 인물 문서 꼴로(만들 때 · 다시 보낼 때 같은 규칙 — 관계 · 동의 방법은 실제 인물만).
  const askedOf=request=>{const real=request?.kind==='real';return {kind:real?'real':'virtual',request:{look:request?.look||'',use:request?.use||'',keep:request?.keep||'',relation:real?request?.relation||'':'',consentWay:real?request?.consentWay||'':''}};};
  const sameAsk=(persona,asked)=>asked.kind===persona.kind&&Object.keys(asked.request).every(key=>asked.request[key]===(persona.request?.[key]||''));
  function create({projectId,request,files=[],at=clock()}){
    assertRequest(request);
    if(openOf(projectId))throw fail('이 의뢰에는 이미 맞춤 인물 요청이 있어요.',409);
    const asked=askedOf(request);
    const persona={id:randomUUID(),schemaVersion:1,workspaceId:null,originProjectId:projectId,kind:asked.kind,status:'submitted',revision:1,
      request:asked.request,
      displayName:'',why:'',quote:null,currentRevisionId:null,staffNote:'',createdAt:at,updatedAt:at,history:[{id:randomUUID(),at,action:'created',actorKind:'customer',actor:'customer',from:'',to:'submitted'}]};
    store.put(K.personas,persona.id,persona);
    for(const file of files.slice(0,PERSONA_LIMITS.sources))store.put(K.sources,file.id,{id:file.id,personaId:persona.id,projectId,purpose:PERSONA_PURPOSE[file.slot]||'mood',diskName:file.diskName,fileName:file.fileName,mimeType:file.mimeType,byteSize:file.byteSize,sha256:file.sha256,inline:!!file.inline,at:file.at||at,by:'customer'});
    return persona;
  }
  // 프로젝트 길 의뢰서(request_submit): 맞춤이면 열린 인물이 없을 때 만들고(사진은 고객 방에서), 맞춤이 아니게 바뀌었으면 아직 손님 차례 · 접수 단계인 인물을 거둔다.
  // 열린 인물이 있는데 다시 보낸 인물 요청이 다르면: 접수 단계(검토 전)는 인물 문서를 새 요청으로 고치고(스위치 다시 확인), 검토가 시작된 뒤에는
  // 다른 요청 · 맞춤 빼기를 받지 않는다(409 — 다시 보내기가 통째로 되돌아가 직원 검토 · 동의 분류와 어긋나지 않는다, GPT GA2).
  function afterProjectSubmit(row,answers){
    const open=openOf(row.id),early=open&&['submitted','needs_materials'].includes(open.status);
    const late=()=>fail('맞춤 인물 검토가 이미 시작돼 의뢰서에서 인물 요청을 바꿀 수 없어요. 바꿀 내용은 담당자에게 남겨 주세요.',409);
    if(answers?.modelChoice==='custom'){
      if(!open){create({projectId:row.id,request:answers.personaRequest});return;}
      const asked=askedOf(answers.personaRequest);
      if(sameAsk(open,asked))return;
      if(!early)throw late();
      assertRequest(answers.personaRequest);
      putPersona({...open,kind:asked.kind,request:asked.request},{action:'request_update',actorKind:'customer',actor:'customer'});
      return;
    }
    if(!open)return;
    if(!early)throw late();
    putPersona({...open,status:'withdrawn',why:''},{action:'withdraw',actorKind:'customer',actor:'customer'});
  }

  // ── 손님(초대 세션) ──
  function session(token,csrf){const context=clientProjects.session(token);if(typeof csrf!=='string'||context.auth.body.csrf!==csrf)throw fail('고객 화면을 다시 열어 주세요.',403);return context;}
  const stale=(persona,row)=>Object.assign(fail('새 판이 도착했어요. 새 판을 보고 다시 확인해 주세요.',409,'SYNK_PULSE_PERSONA_STALE'),{persona:customerView(row)});
  function approve(token,csrf,input){
    if(!object(input)||Object.keys(input).some(key=>!['personaId','kind','revisionId','viewedHash','idempotencyKey','decision','note'].includes(key)))throw fail('확인 요청을 확인해 주세요.');
    if(!Object.hasOwn(PERSONA_APPROVAL_FLOW,input.kind)||!['approve','changes'].includes(input.decision))throw fail('확인 요청을 확인해 주세요.');
    if(typeof input.idempotencyKey!=='string'||!KEY.test(input.idempotencyKey)||typeof input.viewedHash!=='string'||!/^[a-f0-9]{64}$/.test(input.viewedHash))throw fail('화면을 새로 고친 뒤 다시 시도해 주세요.');
    const revisionId=input.revisionId===undefined||input.revisionId===null?null:input.revisionId;
    if(revisionId!==null&&(typeof revisionId!=='string'||!UUID.test(revisionId)))throw fail('확인 요청을 확인해 주세요.');
    const note=text(input.note,1000);
    return store.transaction(()=>{
      const {row}=session(token,csrf);
      if(row.stage==='archived')throw fail('보관된 프로젝트예요.',409);
      const persona=typeof input.personaId==='string'&&UUID.test(input.personaId)?store.get(K.personas,input.personaId):null;
      if(!live(persona)||persona.originProjectId!==row.id)throw fail('그 인물을 찾지 못했어요.',404);
      // 같은 요청 키는 한 번만: 이미 남은 승인이면 새로 쓰지 않고 지금 상태를 돌려준다(본문이 다르면 409).
      const prior=approvalsOf(persona.id).find(approval=>approval.idempotencyKey===input.idempotencyKey&&approval.projectId===row.id);
      // 본문은 종류 · 결정 · 판 · 고칠 점 글 · 본 화면(viewedHash)까지 견준다 — 하나라도 다르면 새 확인을 버리고 성공으로 돌려주지 않는다(GPT GA3).
      if(prior){if(prior.kind!==input.kind||prior.decision!==input.decision||prior.revisionId!==revisionId||prior.viewedHash!==input.viewedHash||(prior.note||'')!==note)throw fail('같은 요청으로 다른 확인이 왔어요. 화면을 새로 고쳐 주세요.',409);return {duplicate:true};}
      const want=awaiting(persona,row);
      if(!want||want.kind!==input.kind||(want.revision?.id||null)!==revisionId||want.viewedHash!==input.viewedHash)throw stale(persona,row);
      if(input.decision==='changes'&&!PERSONA_APPROVAL_FLOW[input.kind].changes)throw fail('이 확인은 고칠 점을 받지 않아요. 물으실 것은 담당자에게 남겨 주세요.');
      if(input.decision==='changes'&&!note)throw fail('고칠 점을 한 줄 적어 주세요.');
      const at=clock(),locale=localeOf(row);
      const approval={id:randomUUID(),personaId:persona.id,projectId:row.id,revisionId,kind:input.kind,decision:input.decision,note,viewedHash:want.viewedHash,shown:{assetIds:[...want.assetIds]},at,actorKind:'invite',actorName:String(row.customerName||''),authMethod:'invite-link',locale,idempotencyKey:input.idempotencyKey};
      store.put(K.approvals,approval.id,approval);
      const label=`${input.decision}:${input.kind}`;
      if(input.kind==='usage'){
        // 이번 광고 사용 확인 → 서버가 제작 설계에 인물 참조를 붙인다(판 1 규칙 — 손님 · 직원 화면은 이 칸을 쓰지 못한다).
        const studio=structuredClone(row.studio),usage=studio.request.personaUsage;
        studio.request={...studio.request,personaUsage:{...usage,approvalId:approval.id,approvedAt:at}};
        studio.strategy=withPersonaRef(studio.strategy,{personaId:persona.id,revisionId},{at,author:'customer',authorId:'customer',authorName:row.customerName});
        putPersona(persona,{action:label,actorKind:'customer',actor:'customer'});
        touch(row,'전용 인물 이번 광고 사용 확인','customer',studio);
        return {approval:approval.id};
      }
      putPersona({...persona,status:personaNext(persona,{by:'customer',kind:input.kind,decision:input.decision}),why:''},{action:label,actorKind:'customer',actor:'customer'});
      touch(row,input.decision==='approve'?'전용 인물 확인':'전용 인물 고칠 점','customer');
      return {approval:approval.id};
    });
  }
  // 고객 방에서 사진을 더 보낼 때(파일은 부른 쪽이 studio-media에 이미 썼다). 자료 보완 차례였으면 저희 차례로 돌린다.
  function addSource(token,csrf,file,purpose){
    if(!['identity','mood'].includes(purpose))throw fail('사진의 쓰임(같은 사람 재현용 · 분위기 참고용)을 골라 주세요.');
    return store.transaction(()=>{
      const {row}=session(token,csrf);
      if(row.stage==='archived')throw fail('보관된 프로젝트예요.',409);
      const persona=openOf(row.id);
      if(!persona||!SOURCE_OPEN.includes(persona.status))throw fail('지금은 인물 사진을 더 받지 않아요. 담당자에게 알려 주세요.',409);
      if(sourcesOf(persona.id).length>=PERSONA_LIMITS.sources)throw fail('인물 사진은 30장까지 보낼 수 있어요.',413);
      store.put(K.sources,file.id,{id:file.id,personaId:persona.id,projectId:row.id,purpose,diskName:file.diskName,fileName:file.fileName,mimeType:file.mimeType,byteSize:file.byteSize,sha256:file.sha256,inline:!!file.inline,at:file.at||clock(),by:'customer'});
      const next=personaNext(persona,{by:'customer',kind:'materials'});
      putPersona({...persona,...(next?{status:next,why:''}:{})},{action:'source_added',actorKind:'customer',actor:'customer'});
      touch(row,'전용 인물 사진 더 받음','customer');
      return {source:file.id};
    });
  }
  // 손님이 볼 수 있는 자산: 이 프로젝트가 원 프로젝트인 인물의 지금 공개 판에서 보여 준 묶음(기준 얼굴 · 동작 시안)만. 원본 사진 · 동의 · 다른 판은 열리지 않는다.
  function customerMedia(token,assetId){
    const {row}=clientProjects.session(token),persona=latestOf(row.id),current=persona&&persona.status!=='withdrawn'?currentOf(persona):null;
    const shown=new Set([...(current?.reference?.assetIds||[]),...(current?.motion?.assetIds||[])]);
    const found=typeof assetId==='string'&&shown.has(assetId)?current.assets.find(item=>item.id===assetId):null;
    if(!found)throw fail('자료를 찾지 못했어요.',404);
    return found;
  }

  // ── 직원 ──
  function staffView(user,persona,row,canEdit){
    const mediaUrl=id=>`/api/personas/${persona.id}/media/${id}`,approvals=approvalsOf(persona.id),current=currentOf(persona),usage=usageOf(row,persona);
    const usageDone=!!(current&&usage&&usageApproval(store,row,persona,current.id));
    const next=persona.status==='ready'?(usage?(usageDone?'이번 광고에 쓸 준비가 끝났어요':'손님이 이번 광고 사용을 확인하기를 기다려요'):'이번 광고의 사용 범위를 적어 손님에게 보내요'):NEXT_LINE[persona.status]||'상태를 확인해 주세요';
    return {id:persona.id,kind:persona.kind,status:persona.status,step:PERSONA_STEPS[persona.status]||null,revision:persona.revision,workspaceId:persona.workspaceId??null,originProjectId:persona.originProjectId,
      request:persona.request||{},displayName:persona.displayName||'',why:persona.why||'',quote:persona.quote||null,staffNote:persona.staffNote||'',currentRevisionId:persona.currentRevisionId||null,createdAt:persona.createdAt,updatedAt:persona.updatedAt,history:persona.history||[],
      next,usageDone,locale:localeOf(row),canEdit,
      actions:canEdit?Object.keys(PERSONA_FLOW).filter(action=>personaNext(persona,{by:'staff',action})):[],
      canOpenRevision:canEdit&&REVISION_OPEN.includes(persona.status)&&!revisionsOf(persona.id).some(revision=>revision.status==='draft'),
      sources:sourcesOf(persona.id).map(source=>({id:source.id,purpose:source.purpose,fileName:source.fileName,mimeType:source.mimeType,byteSize:source.byteSize,inline:!!source.inline,at:source.at,url:mediaUrl(source.id)})),
      revisions:revisionsOf(persona.id).map(revision=>({id:revision.id,number:revision.number,status:revision.status,method:revision.method||null,reference:revision.reference||null,motion:revision.motion||null,createdAt:revision.createdAt,referenceApproved:approved(persona,'reference',revision.id),
        sent:sentOf(persona,revision),assets:revision.assets.map(item=>({id:item.id,role:item.role,fileName:item.fileName,mimeType:item.mimeType,byteSize:item.byteSize,at:item.at,url:mediaUrl(item.id)}))})),
      approvals:approvals.map(({idempotencyKey,...rest})=>rest),usage,
      consent:persona.kind==='real'?{available:canEdit}:null};
  }
  const canWrite=(user,row)=>{try{clientProjects.project(user,row.id,true);return true;}catch{return false;}};
  function staffList(user,projectId){
    const row=clientProjects.project(user,projectId),editable=canWrite(user,row);
    return {projectId:row.id,projectRevision:row.revision,personas:store.all(K.personas).filter(persona=>live(persona)&&persona.originProjectId===row.id).sort(byTime).map(persona=>staffView(user,persona,row,editable))};
  }
  function staffRead(user,personaId){const persona=getPersona(personaId),row=clientProjects.project(user,persona.originProjectId);return staffView(user,persona,row,canWrite(user,row));}
  // 직원 쓰기: 원 프로젝트의 쓰기 권한(담당자 · 관리자 · 같은 팀 매니저, 보관 아님)과 인물 문서 판(revision)이 맞아야 한다. 지울 파일 이름을 함께 돌려준다(트랜잭션 밖에서 지운다).
  function staffAction(user,personaId,input){
    if(!object(input)||!Object.hasOwn(STAFF_FIELDS,input.action)||Object.keys(input).some(key=>!['action','revision',...STAFF_FIELDS[input.action]].includes(key)))throw fail('인물 작업 요청을 확인해 주세요.');
    const action=input.action;
    return store.transaction(()=>{
      const persona=getPersona(personaId),row=clientProjects.project(user,persona.originProjectId,true);
      if(input.revision!==persona.revision)throw fail('그사이 인물 내용이 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',409);
      const at=clock(),locale=localeOf(row),stamp={by:user.id,at},studio=structuredClone(row.studio||{}),discard=[];
      let next={...persona},studioChanged=false,label='';
      const move=()=>{const to=personaNext(persona,{by:'staff',action});if(!to)throw fail('지금 상태에서는 할 수 없는 일이에요. 새로 불러와 주세요.',409);next.status=to;};
      const revisionOf=id=>{const revision=typeof id==='string'&&UUID.test(id)?store.get(K.revisions,id):null;if(!live(revision)||revision.personaId!==persona.id)throw fail('그 판을 찾지 못했어요.',404);return revision;};
      const detach=()=>{const ref=personaRefOf(studio.strategy?.data?.castingSelection?.personaRef);if(ref&&ref.personaId===persona.id){studio.strategy=withPersonaRef(studio.strategy,null,{at,author:'staff',authorId:user.id,authorName:user.name||'담당자'});studioChanged=true;}};
      if(action==='request_materials'||action==='ask_rights'){
        translationInput(input,['why']);move();next.why=text(input.why,300,true);
        studioChanged=translate(studio,[{key:`persona:${persona.id}:why`,source:next.why,max:300,text:said(input,'why')}],locale,stamp)||studioChanged;
        label=action==='ask_rights'?'전용 인물 당사자 동의 확인':'전용 인물 자료 요청';
      }else if(action==='start_review'){move();next.why='';label='전용 인물 검토 시작';}
      else if(action==='send_quote'){
        translationInput(input,['scope']);move();
        next.quote={price:int(input.price,0,100000000,'인물 제작 값은 원 단위로 0원에서 1억 원 사이로 적어 주세요.'),days:int(input.days,1,120,'기간은 1일에서 120일 사이로 적어 주세요.'),revisions:int(input.revisions,0,9,'수정 횟수를 확인해 주세요.'),scope:text(input.scope,600,true),at,by:user.id};
        next.why='';studioChanged=translate(studio,[{key:`persona:${persona.id}:scope`,source:next.quote.scope,max:600,text:said(input,'scope')}],locale,stamp)||studioChanged;label='전용 인물 견적 보냄';
      }else if(action==='publish_reference'){
        translationInput(input,['note']);move();
        const revision=revisionOf(input.revisionId);
        if(revision.status==='superseded')throw fail('지난 판은 다시 보낼 수 없어요. 새 판을 열어 주세요.',409);
        if(approved(persona,'reference',revision.id))throw fail('손님이 확인한 얼굴이에요. 얼굴이 바뀌면 새 판으로 올려 주세요.',409);
        const pool=revision.assets.filter(item=>item.role==='reference'&&item.mimeType?.startsWith('image/')).map(item=>item.id);
        const picked=input.assetIds===undefined?pool:Array.isArray(input.assetIds)&&input.assetIds.length<=12&&input.assetIds.every(id=>pool.includes(id))?[...new Set(input.assetIds)]:null;
        if(!picked)throw fail('보낼 기준 얼굴 그림을 이 판에서 골라 주세요.');
        if(!picked.length)throw fail('기준 얼굴 그림을 먼저 올려 주세요.',409);
        const note=text(input.note,600);
        const previous=currentOf(persona);
        // 얼굴이 바뀌는 새 판이면 옛 판에 묶인 이번 광고 사용(인물 참조)도 뗀다 — 새 판을 확인한 뒤 다시 붙는다.
        if(previous&&previous.id!==revision.id){store.put(K.revisions,previous.id,{...previous,status:'superseded',supersededAt:at});detach();}
        store.put(K.revisions,revision.id,{...revision,status:'published',reference:{assetIds:picked,note,publishedAt:at,publishedBy:user.id},motion:null,sent:withSent(revision,picked)});
        next.currentRevisionId=revision.id;next.why='';
        studioChanged=translate(studio,[{key:`persona:${revision.id}:referenceNote`,source:note,max:600,text:said(input,'note')}],locale,stamp)||studioChanged;
        label=`전용 인물 기준 얼굴 ${revision.number}판 보냄`;
      }else if(action==='publish_motion'){
        translationInput(input,['note']);move();
        const revision=revisionOf(input.revisionId);
        if(revision.id!==persona.currentRevisionId||revision.status!=='published')throw fail('지금 판에만 동작 시안을 보낼 수 있어요.',409);
        if(!approved(persona,'reference',revision.id))throw fail('손님이 기준 얼굴을 확인한 뒤에 동작 시안을 보낼 수 있어요.',409);
        const pool=revision.assets.filter(item=>item.role==='motion').map(item=>item.id);
        const picked=input.assetIds===undefined?pool:Array.isArray(input.assetIds)&&input.assetIds.length<=6&&input.assetIds.every(id=>pool.includes(id))?[...new Set(input.assetIds)]:null;
        if(!picked)throw fail('보낼 동작 시안을 이 판에서 골라 주세요.');
        if(!picked.length)throw fail('동작 시안 영상을 먼저 올려 주세요.',409);
        const note=text(input.note,600);
        store.put(K.revisions,revision.id,{...revision,motion:{assetIds:picked,note,publishedAt:at,publishedBy:user.id},sent:withSent(revision,picked)});
        next.why='';studioChanged=translate(studio,[{key:`persona:${revision.id}:motionNote`,source:note,max:600,text:said(input,'note')}],locale,stamp)||studioChanged;
        label=`전용 인물 동작 시안(${revision.number}판) 보냄`;
      }else if(action==='withdraw'){
        translationInput(input,['why']);move();next.why=text(input.why,300,true);detach();
        studioChanged=translate(studio,[{key:`persona:${persona.id}:why`,source:next.why,max:300,text:said(input,'why')}],locale,stamp)||studioChanged;label='전용 인물 요청 거둠';
      }else if(action==='retire'){move();detach();label='전용 인물 사용 마침';}
      else if(action==='open_revision'){
        if(!REVISION_OPEN.includes(persona.status))throw fail('지금 상태에서는 새 판을 열 수 없어요.',409);
        const revisions=revisionsOf(persona.id);
        if(revisions.some(revision=>revision.status==='draft'))throw fail('이미 만드는 중인 판이 있어요.',409);
        if(revisions.length>=PERSONA_LIMITS.revisions)throw fail('판이 너무 많아요. 담당자에게 알려 주세요.',409);
        const id=randomUUID(),number=Math.max(0,...revisions.map(revision=>revision.number))+1;
        store.put(K.revisions,id,{id,personaId:persona.id,number,status:'draft',assets:[],reference:null,motion:null,method:null,createdAt:at,createdBy:user.id});
        label=`전용 인물 ${number}판 열기`;
      }else if(action==='remove_asset'){
        const revision=revisionOf(input.revisionId),found=revision.assets.find(item=>item.id===input.assetId);
        if(!found)throw fail('그 파일을 찾지 못했어요.',404);
        if(sentOf(persona,revision).includes(found.id))throw fail('손님에게 보낸 적 있는 파일은 지울 수 없어요(확인 기록으로 남겨요).',409);
        store.put(K.revisions,revision.id,{...revision,assets:revision.assets.filter(item=>item.id!==found.id)});discard.push(found.diskName);label='전용 인물 판 파일 지움';
      }else if(action==='set_method'){
        const revision=revisionOf(input.revisionId);
        if(!['reference','lora','other'].includes(input.kind))throw fail('만드는 방식을 골라 주세요.');
        store.put(K.revisions,revision.id,{...revision,method:{kind:input.kind,base:text(input.base,120),note:text(input.note,600),at,by:user.id}});label='전용 인물 만드는 방식 적음';
      }else if(action==='set_name'){
        translationInput(input,['displayName']);next.displayName=text(input.displayName,40);
        studioChanged=translate(studio,[{key:`persona:${persona.id}:name`,source:next.displayName,max:40,text:said(input,'displayName')}],locale,stamp)||studioChanged;label='전용 인물 이름 적음';
      }else if(action==='note'){next.staffNote=text(input.text,1000);label='전용 인물 내부 메모';}
      else if(action==='set_usage'){
        if(PERSONA_FINAL.includes(persona.status)||PERSONA_STEPS[persona.status]<3)throw fail('견적을 보낸 뒤에 사용 범위를 정해 주세요.',409);
        if(!studio.request)throw fail('의뢰서가 있는 프로젝트에서만 정할 수 있어요.',409);
        translationInput(input,Object.keys(USAGE_TEXT));
        const usage={personaId:persona.id};for(const [key,max]of Object.entries(USAGE_TEXT))usage[key]=text(input[key],max);
        if(!usage.purpose||!usage.media||!usage.period)throw fail('광고 목적 · 매체 · 기간은 꼭 적어 주세요.');
        studio.request={...studio.request,personaUsage:{...usage,setAt:at,setBy:user.id,approvalId:'',approvedAt:''}};studioChanged=true;detach();
        translate(studio,Object.entries(USAGE_TEXT).map(([key,max])=>({key:`usage:${persona.id}:${key}`,source:usage[key],max,text:said(input,key)})),locale,stamp);
        label='전용 인물 이번 광고 사용 범위 보냄';
      }
      const customerSide=!['open_revision','remove_asset','set_method','note'].includes(action);
      next=putPersona(next,{action,actorKind:'staff',actor:user.id,from:persona.status});
      if(studioChanged&&Buffer.byteLength(JSON.stringify(studio),'utf8')>1500000)throw fail('이 프로젝트의 기록이 가득 찼어요. 새 프로젝트로 이어 가 주세요.',409);
      if(customerSide||studioChanged)touch(row,label,user.id,studioChanged?studio:null);
      return {persona:staffView(user,next,store.get('clientProjects',row.id),true),discard};
    });
  }
  // 판 파일 올리기: 새 판(draft)에는 기준 얼굴 그림, 손님이 기준 얼굴을 확인한 지금 판에는 동작 시안(영상). 두 번 본다(받기 전 · 받은 뒤).
  function assertAssetUpload(user,personaId,revisionId,docRevision,role,mimeType){
    const persona=getPersona(personaId);clientProjects.project(user,persona.originProjectId,true);
    if(docRevision!==persona.revision)throw fail('그사이 인물 내용이 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',409);
    const revision=typeof revisionId==='string'&&UUID.test(revisionId)?store.get(K.revisions,revisionId):null;
    if(!live(revision)||revision.personaId!==persona.id)throw fail('그 판을 찾지 못했어요.',404);
    if(role==='reference'){if(revision.status!=='draft'&&!(revision.status==='published'&&!approved(persona,'reference',revision.id)&&['reference_review','reference_making'].includes(persona.status)))throw fail('기준 얼굴은 새 판(또는 손님 확인 전 판)에 올려 주세요.',409);if(mimeType&&!mimeType.startsWith('image/'))throw fail('기준 얼굴은 PNG · JPEG 그림으로 올려 주세요.',415);}
    else if(role==='motion'){if(revision.id!==persona.currentRevisionId||!approved(persona,'reference',revision.id)||!['building','motion_review'].includes(persona.status))throw fail('동작 시안은 손님이 기준 얼굴을 확인한 지금 판에 올려 주세요.',409);if(mimeType&&!mimeType.startsWith('video/'))throw fail('동작 시안은 MP4 · WebM 영상으로 올려 주세요.',415);}
    else throw fail('기준 얼굴인지 동작 시안인지 골라 주세요.');
    if(revision.assets.length>=PERSONA_LIMITS.assets)throw fail('한 판에 파일은 40개까지예요.',409);
    return {persona,revision};
  }
  function addAsset(user,personaId,revisionId,docRevision,role,metadata){
    return store.transaction(()=>{
      const {persona,revision}=assertAssetUpload(user,personaId,revisionId,docRevision,role,metadata.mimeType),at=clock();
      store.put(K.revisions,revision.id,{...revision,assets:[...revision.assets,{id:metadata.id,diskName:metadata.diskName,fileName:metadata.fileName,mimeType:metadata.mimeType,byteSize:metadata.byteSize,role,at,by:user.id}]});
      const next=putPersona(persona,{action:'asset_added',actorKind:'staff',actor:user.id});
      const row=clientProjects.project(user,persona.originProjectId,true);
      return {persona:staffView(user,next,row,true)};
    });
  }
  // 직원이 보는 파일: 그 인물의 손님 사진 원본(내려받기 전용 포함)과 판 파일. 원 프로젝트를 읽을 수 있어야 한다.
  function staffMedia(user,personaId,id){
    const persona=getPersona(personaId);clientProjects.project(user,persona.originProjectId);
    const source=sourcesOf(persona.id).find(item=>item.id===id);if(source)return {...source,kind:'source'};
    for(const revision of revisionsOf(persona.id)){const found=revision.assets.find(item=>item.id===id);if(found)return {...found,inline:true,kind:'asset'};}
    throw fail('자료를 찾지 못했어요.',404);
  }

  // ── 실제 인물 동의(구조만 — 쪽은 실제 인물을 켤 때) ──
  // 동의 증빙은 인물마다 암호문 하나(client-rights와 같은 틀, 기록 수 = revision). 고객 보기에 싣지 않고 직원 편집 권한으로만 읽고 적는다.
  const CONSENT_SCOPE=['training','external','ads','reuse'];
  function consentRead(user,personaId){
    const persona=getPersona(personaId);if(persona.kind!=='real')throw fail('실제 인물 요청에만 동의 기록이 있어요.',409);
    clientProjects.project(user,persona.originProjectId,true);
    const row=store.get(K.consents,persona.id);if(!row)return {personaId:persona.id,revision:0,records:[]};
    try{const body=store.decrypt(row.ciphertext);if(row.schema!==1||row.personaId!==persona.id||body.personaId!==persona.id||body.revision!==row.revision||!Array.isArray(body.records)||body.records.length!==row.revision)throw new Error();return {personaId:persona.id,revision:row.revision,records:body.records};}
    catch{throw fail('동의 기록을 읽지 못했어요.',500);}
  }
  function consentRecord(user,personaId,input){
    if(!object(input)||Object.keys(input).some(key=>!['expectedRevision','subject','method','scope','evidence','termsVersion','revisionId'].includes(key)))throw fail('동의 기록 항목을 확인해 주세요.');
    if(!['self','agency','other'].includes(input.subject)||!['link','document'].includes(input.method)||!object(input.scope)||Object.keys(input.scope).some(key=>!CONSENT_SCOPE.includes(key)||typeof input.scope[key]!=='boolean'))throw fail('동의한 사람 · 방법 · 범위를 골라 주세요.');
    const evidence=text(input.evidence,2000,true),termsVersion=text(input.termsVersion,40,true);
    return store.transaction(()=>{
      const saved=consentRead(user,personaId);
      if(input.expectedRevision!==saved.revision)throw fail('그사이 동의 기록이 바뀌었어요. 새로 불러와 주세요.',409);
      if(saved.records.length>=200)throw fail('동의 기록이 가득 찼어요.',409);
      let revisionId=null;
      if(input.revisionId!==undefined&&input.revisionId!==null){const found=typeof input.revisionId==='string'&&UUID.test(input.revisionId)?store.get(K.revisions,input.revisionId):null;if(!live(found)||found.personaId!==saved.personaId)throw fail('그 판을 찾지 못했어요.',404);revisionId=found.id;}
      const record={id:randomUUID(),subject:input.subject,method:input.method,scope:Object.fromEntries(CONSENT_SCOPE.map(key=>[key,input.scope[key]===true])),evidence,termsVersion,revisionId,recordedAt:clock(),actorId:user.id,actorName:store.get('users',user.id)?.name||'담당자'};
      const revision=saved.revision+1,records=[...saved.records,record];
      store.put(K.consents,saved.personaId,{schema:1,personaId:saved.personaId,revision,ciphertext:store.encrypt({personaId:saved.personaId,revision,records})});
      return {personaId:saved.personaId,revision,records};
    });
  }
  // 당사자 확인 토큰: 목적이 하나뿐이고 인물 id만 담는다 — 이 토큰으로 프로젝트 · 고객의 인물 목록을 열 수 없다.
  const CONSENT_PURPOSE='pulse-persona-consent';
  function mintConsentToken(personaId,{minutes=4320}={}){const persona=getPersona(personaId);if(persona.kind!=='real'||PERSONA_FINAL.includes(persona.status))throw fail('실제 인물 요청에만 당사자 확인을 보낼 수 있어요.',409);return store.mint(CONSENT_PURPOSE,null,{purpose:'persona-consent',personaId:persona.id,personaRevision:persona.revision},minutes);}
  function readConsentToken(raw){const token=store.readToken(raw,CONSENT_PURPOSE);if(!token||token.body?.purpose!=='persona-consent')return null;const persona=store.get(K.personas,token.body.personaId);if(!live(persona)||persona.kind!=='real'||PERSONA_FINAL.includes(persona.status))return null;return {personaId:persona.id};}

  return {customerView,create,afterProjectSubmit,approve,addSource,customerMedia,staffList,staffRead,staffAction,assertAssetUpload,addAsset,staffMedia,consentRead,consentRecord,mintConsentToken,readConsentToken,openOf,flags};
}
// 제작 설계의 인물 참조를 붙이거나(ref) 뗀다(null). 판 1 규칙: 이 칸은 서버만 쓴다. 바뀐 칸이 없으면 그대로 돌려준다.
export function withPersonaRef(strategy,ref,stamp){
  const base=object(strategy)?strategy:{revision:0,data:{},history:[]},data=object(base.data)?base.data:{},{personaRef,...casting}=object(data.castingSelection)?data.castingSelection:{};
  const nextCasting=ref?{...casting,personaRef:{personaId:ref.personaId,revisionId:ref.revisionId},modelId:''}:casting;
  const nextData={...data,castingSelection:nextCasting};
  if(JSON.stringify(nextData)===JSON.stringify(data))return base;
  const history=base.revision>0?[...(base.history||[]),{revision:base.revision,data,request:base.request,confirmation:base.confirmation,updatedAt:base.updatedAt,author:base.author,authorName:base.authorName}].slice(-20):(base.history||[]);
  return {...base,revision:(base.revision||0)+1,data:nextData,history,updatedAt:stamp.at,author:stamp.author,authorName:stamp.authorName,authorId:stamp.authorId};
}
