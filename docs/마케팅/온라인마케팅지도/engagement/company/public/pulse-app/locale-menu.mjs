// 손님 화면의 언어 메뉴(다국어 판 2 · 기획 12-2 「언어 결정」). 서버가 허락한 언어가 둘 이상일 때만 보인다 — 스위치가 꺼진 운영에서는 빈 글자다.
// 고른 언어는 이 기기에 기억하고(localStorage 'pulse-locale', 못 써도 동작) 다시 그리기만 한다. 답 · 모델 · 광고 언어는 바뀌지 않는다.
// 다시 그리기: 고른 뒤 window에 LOCALE_EVENT를 보낸다 — app.mjs의 그리기와 열려 있는 의뢰서가 이 소식을 듣고 지금 화면을 새 언어로 다시 그린다.
import {t,locale,setLocale,htmlLang,DICTIONARY_LOCALES} from './i18n.mjs';
import {esc} from './api.mjs';

export const LOCALE_EVENT='pulse-locale';
export const LOCALE_STORAGE='pulse-locale';
// 언어 이름은 그 언어로 쓴다(어느 화면에서든 자기 언어를 찾게 — 번역하지 않는다).
const NAMES=Object.freeze({ko:'한국어',en:'English',ja:'日本語'}); // i18n-skip
const offered=allowed=>(Array.isArray(allowed)?allowed:[]).filter(value=>DICTIONARY_LOCALES.includes(value));
// 지금 화면에서 고를 수 있는 언어(서버 응답의 features.locales). app.mjs가 응답을 받을 때마다 넣고, 화면 모듈은 인자 없이 localeMenu()를 부른다.
let offeredNow=['ko'];
export const setOfferedLocales=list=>{const next=offered(list);offeredNow=next.includes('ko')?next:['ko',...next];return offeredNow;};
export const offeredLocales=()=>[...offeredNow];
export function storedLocale(){try{return localStorage.getItem(LOCALE_STORAGE)||'';}catch{return '';}}
export function localeMenu(allowed=offeredNow,{className=''}={}){
  const list=offered(allowed);if(list.length<2)return '';
  const now=locale();
  return `<div class="locale-menu${className?' '+className:''}" role="group" aria-label="${esc(t('화면 언어'))}">${list.map(value=>`<button type="button" class="locale-option" data-set-locale="${value}" lang="${htmlLang(value)}" aria-pressed="${value===now}">${NAMES[value]}</button>`).join('')}</div>`;
}
// 손님이 메뉴에서 고를 때. 허락 목록 밖이면 아무것도 하지 않는다. 바뀌었으면 true.
export async function chooseLocale(value,allowed=offeredNow){
  if(!offered(allowed).includes(value))return false;
  try{localStorage.setItem(LOCALE_STORAGE,value);}catch{}
  const before=locale(),next=await setLocale(value);
  if(typeof document!=='undefined')document.documentElement.lang=htmlLang(next);
  if(next!==before&&typeof window!=='undefined'&&typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent(LOCALE_EVENT,{detail:{locale:next}}));
  return next!==before;
}
