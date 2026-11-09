// 담당자 글 번역 지도(다국어 판 2 · 기획 12-2 「담당자 글」). 칸마다 두 언어를 두지 않고 studio.translations 한 곳에 경로 키로 둔다.
//   studio.translations[key]={sourceHash,sourceLocale:'ko',targetLocale,text,status:'draft'|'reviewed',by,at}
// 원문이 바뀌면 sourceHash가 어긋나 낡은 번역이 되고 손님 보기에는 원문이 나간다. 손님 보기는 reviewed만 쓴다(초안은 직원만 본다).
// 영어 프로젝트에서 손님에게 보이는 직원 글(되묻기 · 모델 메모 · 방향 제안 · 글 콘티 · 장면 설명 · 사용 안내)은 reviewed 번역 없이 보내지 못한다.
// 일지 글 · 프로젝트 머리 칸은 막지 않는다(직원이 영어로 바로 적어도 된다). 번역문은 그 칸 상한의 두 배까지(studio 1.5MB 상한).
import {createHash} from 'node:crypto';
import {DEFAULT_LOCALE,DICTIONARY_LOCALES} from './public/pulse-app/i18n.mjs';

export const TRANSLATION_STATUSES=Object.freeze(['draft','reviewed']);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const LANGUAGE_NAMES={en:'영어',ja:'일본어'};
export const sourceHash=text=>createHash('sha256').update(String(text??''),'utf8').digest('hex').slice(0,16);
const has=text=>typeof text==='string'&&!!text.trim();
const PROJECT_MAX={title:160,summary:3000,nextStep:1000,terms:3000};

// 손님에게 보이는 직원 글 칸: key → {text,max}. 비어 있는 칸은 없다.
export function staffSources(studio,row=null){
  const out=new Map(),put=(key,text,max)=>{if(has(text))out.set(key,{text,max});};
  const request=studio?.request;
  for(const ask of request?.asks||[]){put(`ask:${ask.id}:label`,ask.label,120);put(`ask:${ask.id}:why`,ask.why,300);}
  if(request?.modelProposal)put('model:note',request.modelProposal.note,300);
  const direction=request?.directionProposal;
  if(direction){
    put(`direction:${direction.round}:lead`,direction.lead,200);
    for(const option of direction.options||[]){
      put(`option:${option.id}:name`,option.name,40);put(`option:${option.id}:sentence`,option.sentence,160);put(`option:${option.id}:why`,option.why,300);put(`option:${option.id}:filmNote`,option.filmNote,80);
      (option.flow||[]).forEach((line,index)=>put(`option:${option.id}:flow:${index}`,line?.text,200));
    }
  }
  for(const round of request?.rounds||[]){put(`round:${round.round}:oneLine`,round.oneLine,300);put(`round:${round.round}:note`,round.note,600);}
  for(const scene of studio?.scenes||[])if(scene.visibility==='customer'){put(`scene:${scene.id}:title`,scene.title,160);put(`scene:${scene.id}:description`,scene.description,3000);}
  if(row){
    for(const field of Object.keys(PROJECT_MAX))put(`project:${field}`,row[field],PROJECT_MAX[field]);
    for(const message of row.messages||[])if(message.author==='staff'&&message.visibility==='customer'&&!message.automated)put(`message:${message.id}:text`,message.text,3000);
    for(const version of row.versions||[]){put(`version:${version.id}:label`,version.label,120);put(`version:${version.id}:guide`,version.guide,3000);}
  }
  return out;
}
const targetLocale=locale=>{if(!DICTIONARY_LOCALES.includes(locale)||locale===DEFAULT_LOCALE)throw fail('번역할 언어를 확인해 주세요.');return locale;};
function clean(text,max){
  if(text===undefined||text===null)return '';
  if(typeof text!=='string'||text.length>max*2||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw fail('번역이 너무 길거나 쓸 수 없는 글자가 있어요. 원문 칸의 두 배까지 적어 주세요.');
  return text.trim();
}
// 번역 하나를 넣는다(빈 글자면 지운다). map은 고친 새 객체를 돌려준다 — 호출하는 쪽이 studio.translations에 넣는다.
export function withTranslation(map,{key,source,max,text,status='reviewed',locale,by='',at=''}){
  if(!TRANSLATION_STATUSES.includes(status))throw fail('번역 상태를 확인해 주세요.');
  const value=clean(text,max),next={...(object(map)?map:{})};
  if(!value){delete next[key];return next;}
  next[key]={sourceHash:sourceHash(source),sourceLocale:DEFAULT_LOCALE,targetLocale:targetLocale(locale),text:value,status,by:String(by||''),at:String(at||'')};
  return next;
}
// 손님 보기에 쓸 번역: 같은 언어 · reviewed · 원문이 그대로일 때만.
export function freshTranslation(map,key,source,locale){
  const entry=object(map)?map[key]:null;
  return entry&&entry.targetLocale===locale&&entry.status==='reviewed'&&entry.sourceHash===sourceHash(source)&&has(entry.text)?entry.text:null;
}
// 보내는 액션에 함께 온 번역(직원이 적은 것 → reviewed). 한국어 프로젝트면 받은 번역을 쓰지 않는다.
// pairs: [{key,source,max,text}] — 원문이 있는 칸마다 번역이 있어야 한다.
export function applyInlineTranslations(studio,pairs,{locale,stamp}){
  if(!locale||locale===DEFAULT_LOCALE)return;
  const needed=pairs.filter(pair=>has(pair.source));
  if(needed.some(pair=>!has(typeof pair.text==='string'?pair.text:'')))throw fail(`${LANGUAGE_NAMES[locale]||locale} 프로젝트예요. 손님에게 보일 ${LANGUAGE_NAMES[locale]||locale} 문장을 칸마다 함께 적어 주세요.`,409);
  let map=studio.translations;
  for(const pair of needed)map=withTranslation(map,{...pair,status:'reviewed',locale,by:stamp?.authorId,at:stamp?.at});
  studio.translations=map;
}
// 이미 있는 칸에 reviewed 번역이 다 있는지(글 콘티 보내기 때 장면 설명 같은 것). 빠진 칸 키 목록을 돌려준다.
export function missingTranslations(studio,row,locale,keys){
  if(!locale||locale===DEFAULT_LOCALE)return [];
  const sources=staffSources(studio,row);
  return keys.filter(key=>sources.has(key)&&!freshTranslation(studio.translations,key,sources.get(key).text,locale));
}
// 번역 칸을 받아 확인한다: 문자열이거나 없음. 객체 안의 칸 이름은 allowed만.
export function inlineText(value,max){return clean(value,max);}
export function inlineObject(value,allowed){
  if(value===undefined||value===null)return {};
  if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('번역 칸을 확인해 주세요.');
  return value;
}
// 직원 보기: 이 프로젝트 언어의 칸마다 지금 번역 상태(손님 언어가 한국어면 싣지 않는다).
export function translationStaffView(studio,row,locale){
  if(!locale||locale===DEFAULT_LOCALE)return null;
  const map=object(studio?.translations)?studio.translations:{},entries={};
  for(const [key,{text,max}]of staffSources(studio,row)){
    const entry=map[key],fresh=!!entry&&entry.targetLocale===locale&&entry.sourceHash===sourceHash(text);
    entries[key]={source:text,max:max*2,text:entry?.text||'',status:entry?.status||'',fresh};
  }
  return {locale,entries};
}
// 손님 보기: 직원 글을 번역으로 바꾸고 담당자 이름을 영문 표시 이름으로. 한국어면 그대로 돌려준다.
// producer는 프로젝트 머리의 담당자 이름, staffName은 직원 글마다 저장된 작성자 이름을 옮기는 함수(없으면 모두 producer — 옛 부르는 쪽).
export function localizeCustomerProject(project,{map,locale,text:tx,producer,staffName=()=>producer}){
  if(!locale||locale===DEFAULT_LOCALE||!object(project))return project;
  const pick=(key,value)=>typeof value==='string'?freshTranslation(map,key,value,locale)??value:value;
  const out={...project};
  if(typeof project.stageLabel==='string')out.stageLabel=tx(project.stageLabel);
  for(const field of Object.keys(PROJECT_MAX))if(typeof project[field]==='string')out[field]=pick(`project:${field}`,project[field]);
  // 서버가 저장하는 기본 다음 할 일(승인 감사 · 최종본 보냄 등)은 번역이 따로 없으면 서버 사전으로.
  if(typeof project.nextStep==='string'&&out.nextStep===project.nextStep)out.nextStep=tx(project.nextStep);
  if(typeof project.ownerName==='string')out.ownerName=producer;
  if(Array.isArray(project.messages))out.messages=project.messages.map(message=>message.author==='staff'&&!message.automated?{...message,text:pick(`message:${message.id}:text`,message.text),...(message.authorName!==undefined?{authorName:staffName(message.authorName)}:{})}:message);
  if(Array.isArray(project.versions))out.versions=project.versions.map(version=>({...version,label:pick(`version:${version.id}:label`,version.label),...(typeof version.guide==='string'?{guide:pick(`version:${version.id}:guide`,version.guide)}:{})}));
  // 수령 확인 창의 파일 이름: 최종본 판 이름의 번역을 그대로 쓴다.
  if(Array.isArray(project.closeout?.files))out.closeout={...project.closeout,files:project.closeout.files.map(file=>({...file,label:pick(`version:${file.id}:label`,file.label)}))};
  const studio=project.studio;
  if(object(studio)){
    const next={...studio},request=studio.request;
    if(Array.isArray(studio.scenes))next.scenes=studio.scenes.map(scene=>({...scene,title:pick(`scene:${scene.id}:title`,scene.title),description:pick(`scene:${scene.id}:description`,scene.description),...(scene.authorName!==undefined&&scene.author==='staff'?{authorName:staffName(scene.authorName)}:{})}));
    if(object(request)){
      const by=value=>value===undefined?{}:{by:staffName(value)};
      const r={...request};
      if(Array.isArray(request.asks))r.asks=request.asks.map(ask=>({...ask,label:pick(`ask:${ask.id}:label`,ask.label),why:pick(`ask:${ask.id}:why`,ask.why)}));
      if(object(request.modelProposal))r.modelProposal={...request.modelProposal,note:pick('model:note',request.modelProposal.note),...by(request.modelProposal.by)};
      if(object(request.directionProposal)){
        const d=request.directionProposal;
        r.directionProposal={...d,lead:pick(`direction:${d.round}:lead`,d.lead),...by(d.by),
          options:(d.options||[]).map(option=>({...option,name:pick(`option:${option.id}:name`,option.name),sentence:pick(`option:${option.id}:sentence`,option.sentence),why:pick(`option:${option.id}:why`,option.why),...(option.filmNote!==undefined?{filmNote:pick(`option:${option.id}:filmNote`,option.filmNote)}:{}),flow:(option.flow||[]).map((line,index)=>({...line,text:pick(`option:${option.id}:flow:${index}`,line.text)}))})),
          ...(object(d.prior)?{prior:{...d.prior,names:(d.prior.names||[]).map((name,index)=>Array.isArray(d.prior.ids)&&d.prior.ids[index]?pick(`option:${d.prior.ids[index]}:name`,name):name),...(d.prior.by!==undefined?{by:staffName(d.prior.by)}:{})}}:{})};
      }
      if(Array.isArray(request.rounds))r.rounds=request.rounds.map(round=>({...round,oneLine:pick(`round:${round.round}:oneLine`,round.oneLine),note:pick(`round:${round.round}:note`,round.note),...by(round.by)}));
      if(request.confirmedBy!==undefined)r.confirmedBy=staffName(request.confirmedBy);
      next.request=r;
    }
    out.studio=next;
  }
  return out;
}
