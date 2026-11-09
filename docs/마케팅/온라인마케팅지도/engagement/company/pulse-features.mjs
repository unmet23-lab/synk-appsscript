// PULSE 손님 기능 스위치(2026-11-09 다국어 · 고객 전용 인물 판 1, 기획 docs/마케팅/PULSE_의뢰흐름_20261104/다국어와_고객전용인물_기획_20261108.md 12-2 「스위치」).
// 구조는 다 심고, 손님에게 켜는 것은 이 문서 하나로 나눈다. 기본은 모두 끔(한국어만)이고 서버가 강제한다 — 화면은 응답에 실린 값만 믿는다.
// 바꾸기는 관리자만 하고 server.mjs가 CSRF · 감사 기록을 붙인다(자동 안내 설정과 같은 꼴). 저장한 문서가 이상하면 끈 쪽(기본값)으로 읽는다.
//   publicLocales  — 공개 의뢰서(초대 없는 손님)의 언어 메뉴
//   projectLocales — 프로젝트의 소통 언어(contactLocale)로 허락하는 언어. 영어 시험은 공개 메뉴 없이 여기에만 en을 더해 초대 링크로 본다.
//   personaRequest · personaReal · myModels — 전용 인물 접수(가상) · 실제 인물 접수 · 내 모델(판 3 · 4)
import {DEFAULT_LOCALE,DICTIONARY_LOCALES} from './public/pulse-app/i18n.mjs';

export const PULSE_FEATURES_KIND='pulseFeatureSettings';
const ID='main';
const FLAGS=['personaRequest','personaReal','myModels'],LISTS=['publicLocales','projectLocales'];
export const PULSE_FEATURE_DEFAULTS=Object.freeze({publicLocales:Object.freeze([DEFAULT_LOCALE]),projectLocales:Object.freeze([DEFAULT_LOCALE]),personaRequest:false,personaReal:false,myModels:false});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
// 언어 목록: 사전이 있는 언어만, 한국어는 늘 들어 있고 맨 앞이다. 겹치면 하나로.
function localeList(value,strict){
  if(!Array.isArray(value)||value.length>8||value.some(item=>typeof item!=='string')){if(strict)throw fail('언어 목록을 확인해 주세요.');return null;}
  if(value.some(item=>!DICTIONARY_LOCALES.includes(item))){if(strict)throw fail('사전이 있는 언어(한국어 · 영어)만 켤 수 있어요.');return null;}
  if(!value.includes(DEFAULT_LOCALE)){if(strict)throw fail('한국어는 끌 수 없어요.');return null;}
  return DICTIONARY_LOCALES.filter(item=>value.includes(item));
}
// 저장된 값을 읽을 때: 알 수 없거나 어긋난 값은 기본(끔)으로. 쓰는 쪽(configure)은 같은 규칙을 엄격히 본다.
export function readPulseFeatures(stored){
  const out={publicLocales:[...PULSE_FEATURE_DEFAULTS.publicLocales],projectLocales:[...PULSE_FEATURE_DEFAULTS.projectLocales],personaRequest:false,personaReal:false,myModels:false};
  if(!object(stored))return out;
  const project=localeList(stored.projectLocales,false);if(project)out.projectLocales=project;
  const open=localeList(stored.publicLocales,false);if(open&&open.every(item=>out.projectLocales.includes(item)))out.publicLocales=open;
  for(const key of FLAGS)out[key]=stored[key]===true;
  if(!out.personaRequest)out.personaReal=false;
  return out;
}
// 프로젝트의 화면 언어: 손님이 의뢰서에 고른 소통 언어가 허락 목록에 있으면 그것, 아니면 한국어.
export function projectLocaleOf(features,answers){
  const wanted=typeof answers?.contactLocale==='string'?answers.contactLocale:'';
  return features.projectLocales.includes(wanted)?wanted:DEFAULT_LOCALE;
}
export function createPulseFeatures({store,clock=()=>new Date().toISOString()}){
  if(!store)throw new TypeError('기능 스위치 설정이 이상해요.');
  const stored=()=>store.get(PULSE_FEATURES_KIND,ID)||null;
  const read=()=>readPulseFeatures(stored());
  const admin=user=>{const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(live.role!=='admin')throw fail('관리자만 PULSE 기능을 켜고 끌 수 있어요.',403);return live;};
  function settings(user){admin(user);const row=stored();return {...read(),updatedAt:row?.updatedAt||null,updatedBy:row?.updatedBy||null};}
  function configure(user,input){
    const live=admin(user);
    if(!object(input)||Object.keys(input).some(key=>![...LISTS,...FLAGS].includes(key)))throw fail('바꿀 기능을 확인해 주세요.');
    const next=read();
    for(const key of LISTS)if(input[key]!==undefined)next[key]=localeList(input[key],true);
    for(const key of FLAGS)if(input[key]!==undefined){if(typeof input[key]!=='boolean')throw fail('켜기 · 끄기를 다시 골라 주세요.');next[key]=input[key];}
    if(!next.publicLocales.every(item=>next.projectLocales.includes(item)))throw fail('공개 메뉴의 언어는 프로젝트 언어에도 켜 주세요.');
    if(next.personaReal&&!next.personaRequest)throw fail('실제 인물 접수는 전용 인물 접수를 켠 뒤에만 켤 수 있어요.');
    store.put(PULSE_FEATURES_KIND,ID,{...next,updatedAt:clock(),updatedBy:live.id});
    return settings(user);
  }
  // 손님 응답에 싣는 값. 공개 의뢰서는 공개 메뉴만, 프로젝트는 그 프로젝트의 언어까지.
  const publicView=()=>{const f=read();return {locales:f.publicLocales,personaRequest:f.personaRequest,personaReal:f.personaReal};};
  // locale: 손님이 고른 소통 언어가 허락돼 있으면 그것, 비었으면 ''(화면이 링크 · 브라우저 언어로 정한다 — 판 1 Fable F1). 허락 밖이면 한국어.
  const projectView=answers=>{const f=read(),wanted=typeof answers?.contactLocale==='string'?answers.contactLocale:'';return {locales:f.projectLocales,locale:wanted?projectLocaleOf(f,answers):'',personaRequest:f.personaRequest,personaReal:f.personaReal,myModels:f.myModels};};
  return {read,settings,configure,publicView,projectView};
}
