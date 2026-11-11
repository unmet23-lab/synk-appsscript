// 작업 소식(운영 조각 4 · 설계 S1, 2026-11-12): 담당자가 제작 중에 올리는 글 한 토막 + 그림 넷까지 — 「작업 중 → 완료 → 수정 요청」이 한 줄기로 보이게 한다.
// (client-progress-update.mjs는 다른 기능이다 — 이름을 나눠 둔다.)
//
// 자리: studio.progress[](30개까지 — 의뢰서가 있는 프로젝트만) — {id, at, by, stage, text(600자), assets[≤4], state:'draft'|'posted'|'withdrawn', updatedAt, postedAt?, postedBy?, withdrawnAt?, withdrawnBy?}.
// 동작은 직원만(pulse-requests.mjs FIELDS · STAFF_ONLY): progress_save(초안 쓰기 · 고치기) · progress_post(공개 — 늘 사람이 누른다) · progress_withdraw(거두기).
// 손님 보기는 posted만 칸 허용 목록으로 내린다(progressCustomerView — requestView가 request.progress 자리에 싣는다). 그림도 posted 소식의 것만 손님에게 보인다(pulse-studio.mjs visibleAssetIds).
// 저장 자리가 studio.request 밖인 까닭(GPT 서버 검수 GA2): 이 판 전 서버는 손님 보기에서 request를 notes · contact · paymentLog만 빼고 통째로 내린다 —
// 서버를 앞 판으로 되돌려도 초안 · 거둔 소식 · 담당자 이름이 새지 않게 request에 두지 않는다(앞 판 손님 보기는 studio를 칸마다 골라 담아 studio.progress를 모른다).
// 소식 그림은 직원 올리기 길에서 purpose:'progress'로 표시해 올린다(server.mjs x-studio-purpose) — 프로젝트당 40장(자산 상한 120을 손님의 「자료 더 보내기」와 나눠 쓴다).
// 거두거나 초안에서 뺀 그림은 「소식 전용(purpose progress)이고 다른 참조가 없을 때만」 자산 기록에서 같은 커밋으로 빼고, 파일은 부른 쪽(server.mjs)이 커밋 뒤에 지운다
// (기록만 남고 파일이 없으면 백업 전체가 멈춘다 — workspace-media.mjs). 다른 참조가 있으면 숨기기만 한다(손님 보기에서 빠질 뿐 파일 · 기록은 그대로).
import {randomUUID} from 'node:crypto';
import {withTranslation,freshTranslation,inlineObject} from './pulse-translations.mjs';

export const PROGRESS_LIMITS=Object.freeze({items:30,text:600,assets:4,images:40,graceMs:3600000});
// 소식이 붙는 단계(고객 방 단계 줄의 id — public/pulse-app/room-view.mjs ROOM_STAGES). 의뢰서 단계는 손님이 쓰는 때라 뺀다. 비우면 단계 이름 없이 선다.
export const PROGRESS_STAGES=Object.freeze(['check','draft','make','review']);
export const PROGRESS_FIELDS=Object.freeze({progress_save:['id','stage','text','assets','translation'],progress_post:['id'],progress_withdraw:['id']});
export const PROGRESS_ACTIONS=Object.freeze(Object.keys(PROGRESS_FIELDS));
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const readableAt=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const LANGUAGE_NAMES={en:'영어',ja:'일본어'};

export const progressOf=studio=>Array.isArray(studio?.progress)?studio.progress.filter(item=>object(item)&&typeof item.id==='string'&&UUID.test(item.id)):[];
export const progressPurpose=asset=>asset?.purpose==='progress';
export const progressImage=asset=>!!asset&&typeof asset.mimeType==='string'&&/^image\/(?:png|jpeg)$/.test(asset.mimeType);
// 번역 지도 키(pulse-translations.mjs staffSources · localizeCustomerProject와 같은 꼴).
export const progressKey=id=>`progress:${id}:text`;
// 손님에게 보이는 소식 그림(posted만). visibleAssetIds가 이것을 더한다.
export const postedProgressAssetIds=studio=>progressOf(studio).filter(item=>item.state==='posted').flatMap(item=>Array.isArray(item.assets)?item.assets.filter(id=>typeof id==='string'):[]);
// 직원 올리기 길의 상한(소식 전용 그림 40장). 의뢰서가 없는 프로젝트에는 소식이 없다.
// 한 시간 넘게 어느 소식에도 안 붙은 그림은 세지 않는다 — 다음 소식 동작이 지우므로 그 자리 탓에 새 그림을 막지 않는다(끝 판 카본 검수 A1).
export function assertProgressUpload(studio,{now=''}={}){
  if(!studio?.request)throw fail('의뢰서가 있는 프로젝트에만 작업 소식을 올릴 수 있어요.',409);
  if((studio.assets||[]).filter(asset=>progressPurpose(asset)&&!staleUnattached(studio,asset,Date.parse(now))).length>=PROGRESS_LIMITS.images)throw fail('작업 소식 그림은 프로젝트당 40장까지예요. 지난 소식을 거두면 자리가 생겨요.',409);
}

function id(value){if(typeof value!=='string'||!UUID.test(value))throw fail('소식을 골라 주세요.');return value;}
function body(value){
  if(typeof value!=='string'||value.length>PROGRESS_LIMITS.text||CONTROL.test(value))throw fail('소식 글은 600자까지 적어 주세요.');
  const clean=value.trim();if(!clean)throw fail('손님에게 보일 소식 글을 적어 주세요.');return clean;
}
function stageOf(value){if(value===undefined||value===null||value==='')return '';if(!PROGRESS_STAGES.includes(value))throw fail('소식의 단계를 골라 주세요.');return value;}
function assetIds(value,studio){
  if(value===undefined||value===null)return [];
  if(!Array.isArray(value)||value.length>PROGRESS_LIMITS.assets)throw fail('소식 그림은 넷까지 붙일 수 있어요.');
  if(new Set(value).size!==value.length)throw fail('같은 그림을 두 번 붙였어요.');
  for(const item of value){
    if(typeof item!=='string'||!UUID.test(item))throw fail('소식 그림을 확인해 주세요.');
    if(!progressImage((studio.assets||[]).find(asset=>asset.id===item)))throw fail('이 프로젝트의 PNG · JPG 그림만 붙일 수 있어요.',404);
  }
  return [...value];
}

// 이 그림들 가운데 아직 쓰이는 것: 거두지 않은 소식이 붙인 것 + 소식 밖 어디라도(장면 · 방향 안 · 참고 자료 · 콘셉트 · 지난 카드 · 시안 · 되묻기 · 프로젝트 칸 …) 그 id가 적힌 것.
// visibleAssetIds가 훑는 칸을 하나씩 세지 않고 자산 목록과 소식 목록을 뺀 프로젝트 문서 전체에서 찾는다 — 새 칸이 생겨도 빠뜨리지 않는 쪽(잘못 남기기는 해도 잘못 지우지는 않는다).
function stillUsed(row,studio,ids){
  const used=new Set();
  for(const item of progressOf(studio))if(item.state!=='withdrawn')for(const value of Array.isArray(item.assets)?item.assets:[])used.add(value);
  const {assets,progress,...rest}=studio,{studio:old,...outside}=object(row)?row:{};
  const blob=JSON.stringify([outside,rest]);
  for(const value of ids)if(blob.includes(value))used.add(value);
  return used;
}
// 거두지 않은 어느 소식에도 붙지 않은 채 한 시간이 지난 그림인가(올리고 소식에 붙이지 못한 그림). 지금 때를 못 읽으면 아니다.
function staleUnattached(studio,asset,nowMs){
  if(!Number.isFinite(nowMs)||!readableAt(asset.at)||nowMs-Date.parse(asset.at)<PROGRESS_LIMITS.graceMs)return false;
  return !progressOf(studio).some(item=>item.state!=='withdrawn'&&Array.isArray(item.assets)&&item.assets.includes(asset.id));
}
// 지울 소식 그림: 이번에 소식에서 떨어진 것(detached) + 거두지 않은 어느 소식에도 붙지 않은 채 한 시간이 지난 것(올리고 소식에 붙이지 못한 그림 — 40장 자리를 먹지 않게).
// 그 가운데 소식 전용이고 다른 참조가 없는 것만 자산 기록에서 뺀다. 빼낸 파일 이름을 돌려준다 — 파일은 부른 쪽이 커밋 뒤에 지운다.
function sweep(row,studio,{detached=[],now}){
  const nowMs=Date.parse(now),attached=new Set(progressOf(studio).filter(item=>item.state!=='withdrawn').flatMap(item=>Array.isArray(item.assets)?item.assets:[]));
  const stale=asset=>!attached.has(asset.id)&&readableAt(asset.at)&&Number.isFinite(nowMs)&&nowMs-Date.parse(asset.at)>=PROGRESS_LIMITS.graceMs;
  const candidates=(studio.assets||[]).filter(asset=>progressPurpose(asset)&&(detached.includes(asset.id)||stale(asset)));
  if(!candidates.length)return {removed:[]};
  const used=stillUsed(row,studio,candidates.map(asset=>asset.id)),removed=candidates.filter(asset=>!used.has(asset.id));
  if(!removed.length)return {removed:[]};
  const gone=new Set(removed.map(asset=>asset.id));
  studio.assets=studio.assets.filter(asset=>!gone.has(asset.id));
  // 거둔 소식에 남은 그 그림 id도 지운다(기록 안에 없는 자산을 가리키지 않게).
  studio.progress=progressOf(studio).map(item=>Array.isArray(item.assets)&&item.assets.some(value=>gone.has(value))?{...item,assets:item.assets.filter(value=>!gone.has(value))}:item);
  return {removed:removed.map(asset=>({id:asset.id,diskName:asset.diskName}))};
}
function dropTranslation(studio,itemId){if(object(studio.translations)&&Object.hasOwn(studio.translations,progressKey(itemId))){const next={...studio.translations};delete next[progressKey(itemId)];studio.translations=next;}}

// studio.request가 있을 때만 부른다(pulse-requests.mjs applyRequestAction). 돌려주는 removed는 커밋 뒤에 지울 파일이다(pulse-studio.mjs staffMutate → server.mjs).
export function applyProgressAction({studio,row,input,stamp,locale='ko'}){
  const action=input.action,now=stamp.at,list=progressOf(studio);
  if(action==='progress_save'){
    const wanted=input.id===undefined||input.id===null||input.id===''?null:id(input.id),found=wanted?list.find(item=>item.id===wanted):null;
    if(wanted&&!found)throw fail('소식을 찾지 못했어요. 최신 내용을 불러와 주세요.',404);
    if(found&&found.state!=='draft')throw fail(found.state==='posted'?'올린 소식은 고칠 수 없어요. 거두고 새로 올려 주세요.':'거둔 소식이에요. 새 소식으로 써 주세요.',409);
    const text=body(input.text),stage=stageOf(input.stage),assets=assetIds(input.assets,studio),said=inlineObject(input.translation,['text']);
    if(said.text!==undefined&&typeof said.text!=='string')throw fail('번역 칸을 확인해 주세요.');
    let next=list;
    if(!found&&next.length>=PROGRESS_LIMITS.items){
      // 가득 찼으면 가장 먼저 거둔 소식 기록 하나를 비운다(손님에게 보이지 않고 그림은 거둘 때 정리했다). 거둔 소식이 없으면 막는다.
      const withdrawnAt=item=>readableAt(item.withdrawnAt)?Date.parse(item.withdrawnAt):-Infinity;
      const oldest=next.filter(item=>item.state==='withdrawn').sort((a,b)=>withdrawnAt(a)-withdrawnAt(b))[0];
      if(!oldest)throw fail('작업 소식이 30개로 가득 찼어요. 지난 소식을 거둔 뒤 다시 써 주세요.',409);
      next=next.filter(item=>item!==oldest);dropTranslation(studio,oldest.id);
    }
    const item={...(found||{id:randomUUID(),at:now,by:stamp.authorName,state:'draft'}),stage,text,assets,updatedAt:now};
    studio.progress=found?next.map(value=>value.id===found.id?item:value):[...next,item];
    // 영어 · 일본어 프로젝트: 손님에게 보일 문장을 함께 받으면 확인한 번역으로 둔다. 공개(progress_post)는 그 번역이 원문과 맞아야 열린다.
    if(locale&&locale!=='ko'&&typeof said.text==='string'&&said.text.trim())studio.translations=withTranslation(studio.translations,{key:progressKey(item.id),source:text,max:PROGRESS_LIMITS.text,text:said.text,status:'reviewed',locale,by:stamp.authorId,at:now});
    return sweep(row,studio,{detached:(found?.assets||[]).filter(value=>!assets.includes(value)),now});
  }
  const found=list.find(item=>item.id===id(input.id));
  if(!found)throw fail('소식을 찾지 못했어요. 최신 내용을 불러와 주세요.',404);
  if(action==='progress_post'){
    if(found.state!=='draft')throw fail(found.state==='posted'?'이미 올린 소식이에요.':'거둔 소식은 다시 올릴 수 없어요. 새 소식으로 써 주세요.',409);
    if(typeof found.text!=='string'||!found.text.trim())throw fail('손님에게 보일 소식 글을 적어 주세요.',409);
    if(locale&&locale!=='ko'&&!freshTranslation(studio.translations,progressKey(found.id),found.text,locale))throw fail(`${LANGUAGE_NAMES[locale]||locale} 프로젝트예요. 손님에게 보일 ${LANGUAGE_NAMES[locale]||locale} 문장을 함께 저장한 뒤 올려 주세요.`,409);
    // 붙인 그림이 그사이 사라졌으면 남은 것만 올린다.
    const assets=(found.assets||[]).filter(value=>progressImage((studio.assets||[]).find(asset=>asset.id===value)));
    studio.progress=list.map(item=>item.id===found.id?{...found,assets,state:'posted',postedAt:now,postedBy:stamp.authorName,updatedAt:now}:item);
    return {removed:[]};
  }
  if(found.state==='withdrawn')throw fail('이미 거둔 소식이에요.',409);
  studio.progress=list.map(item=>item.id===found.id?{...found,state:'withdrawn',withdrawnAt:now,withdrawnBy:stamp.authorName,updatedAt:now}:item);
  return sweep(row,studio,{detached:Array.isArray(found.assets)?found.assets:[],now});
}

// 손님 보기(requestView 손님 갈래): 올린 소식만, 칸 허용 목록 {id, at(올린 때), stage?, text, assets}. 담당자 이름 · 초안 · 거둔 소식 · 쓴 때는 내리지 않는다.
// 때를 읽을 수 없는 줄은 뺀다. 그림 id는 손님 보기 자산 목록(visibleAssetIds)으로 주소를 찾는다.
export function progressCustomerView(studio){
  return progressOf(studio).filter(item=>item.state==='posted'&&readableAt(item.postedAt)&&typeof item.text==='string'&&item.text.trim()).map(item=>({id:item.id,at:item.postedAt,...(PROGRESS_STAGES.includes(item.stage)?{stage:item.stage}:{}),text:item.text,assets:(Array.isArray(item.assets)?item.assets:[]).filter(value=>typeof value==='string'&&UUID.test(value)).slice(0,PROGRESS_LIMITS.assets)}));
}
