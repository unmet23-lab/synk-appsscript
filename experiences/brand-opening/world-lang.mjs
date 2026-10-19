// SYNK WORLD 화면 언어(2026-10-19 확정 — docs/공개판_설계.md §6, 결정 표 10-19 「WORLD 화면 언어」).
// 한 자리에 한 언어: 기능 글과 안내·설명은 고른 화면 언어, 학습 내용(표현·보기·이야기 대사·포스터의 큰 한글)은 늘 한국어다.
// 1판은 영어·몽골어. 글은 world-strings.mjs의 표(키 → ko 원문 · en · mn)에 있고, 빠진 말은 한국어로 보이며 missingStrings()에 남는다.
// 고른 언어는 이 기기(localStorage)에 두고, 계정이면 생활 기록의 display.language에도 둔다(app-shell이 맞춘다).
// 고르기 전에는 한국어 원문 그대로다. 기기 언어(navigator.languages)는 언어 고르기에서 미리 고르는 데만 쓰고,
// 지원하지 않는 언어를 조용히 영어로 간주하지 않는다.
// hangul-stage/lang.mjs는 게임이 혼자 열려도 돌도록 같은 저장 키·언어 목록을 따로 들고 있다(시험이 둘을 대조한다).
import STRINGS from './world-strings.mjs';

export const LANGS=Object.freeze(['en','mn','ko']);
// 언어 이름은 그 언어 글자로 쓴다(언어 고르기·설정).
export const LANG_NAMES=Object.freeze({en:'English',mn:'Монгол',ko:'한국어'});
export const LANG_KEY='synk.world.lang';
// 날짜·숫자 표기용(Intl). 몽골어는 키릴 문자 몽골어(몽골국)다.
export const LANG_LOCALES=Object.freeze({en:'en-US',mn:'mn-MN',ko:'ko-KR'});
const listeners=new Set(),missing=new Map();
let current=null;

export function supportedLang(value){return LANGS.includes(value)?value:null;}
// 기기 언어 목록에서 처음 나오는 지원 언어. 몽골 전통 문자(mn-Mong)·중국 내몽골(mn-CN)은 키릴 몽골어로 보지 않는다.
export function deviceLang(languages=globalThis.navigator?.languages||[globalThis.navigator?.language].filter(Boolean)){
 for(const tag of languages||[]){
  const parts=String(tag||'').toLowerCase().split(/[-_]/),primary=parts[0];
  if(primary==='en'||primary==='ko')return primary;
  if((primary==='mn'||primary==='khk')&&!parts.includes('mong')&&!parts.includes('cn'))return 'mn';
 }
 return null;
}
export function savedLang(){try{return supportedLang(globalThis.localStorage?.getItem(LANG_KEY));}catch{return null;}}
// 주소의 ?lang=en은 이번 화면에서만 쓰는 미리 보기다(저장하지 않는다).
export function urlLang(){try{return supportedLang(new URLSearchParams(globalThis.location?.search||'').get('lang'));}catch{return null;}}
export function currentLang(){if(!current)current=urlLang()||savedLang()||'ko';return current;}
export function hasChosenLang(){return savedLang()!==null;}
// 언어 고르기에서 처음 눌러 둘 언어: 주소 → 기기 언어. 없으면 아무것도 고르지 않는다.
export function suggestedLang(){return urlLang()||savedLang()||deviceLang();}
function applyDocument(){try{if(globalThis.document?.documentElement)document.documentElement.lang=currentLang();}catch{}}
export function setLang(value,{save=true}={}){
 const next=supportedLang(value);if(!next)throw TypeError('Unsupported WORLD language');
 if(save)try{globalThis.localStorage?.setItem(LANG_KEY,next);}catch{}
 const changed=next!==currentLang();current=next;applyDocument();
 if(changed)for(const listener of [...listeners])try{listener(next);}catch(error){console.warn('WORLD language listener failed',error);}
 return changed;
}
export function onLang(listener){listeners.add(listener);return()=>listeners.delete(listener);}
// 표에 그 키가 있는지만 본다(없어도 빠진 말로 남기지 않는다). 1판 범위의 문장만 표에 있는 곳(예: 인사 팩 레슨 목표)에서 쓴다.
export function hasString(key){return Object.hasOwn(STRINGS,key);}
function note(key,lang){
 const id=`${lang}:${key}`;if(missing.has(id))return;
 missing.set(id,{key,lang});console.warn(`[WORLD lang] ${lang==='*'?'unknown key':`no ${lang} text`}: ${key}`);
}
export function missingStrings(){return [...missing.values()];}
function fill(text,vars,lang){
 if(text&&typeof text==='object')text=vars?.n===1&&text.one!=null?text.one:text.other;
 return String(text??'').replace(/\{(\w+)\}/g,(_,name)=>vars&&vars[name]!=null?String(vars[name]):'');
}
// t('home.loading') · t('tutor.with',{name}) · t(key,vars,'mn')(그 언어로 미리 보기). 영어 복수는 {one,other}와 vars.n.
export function t(key,vars,lang=currentLang()){
 const entry=Object.hasOwn(STRINGS,key)?STRINGS[key]:null;
 if(!entry){note(key,'*');return fill(key,vars,lang);}
 let text=entry[lang];
 if(text==null||text===''){if(lang!=='ko')note(key,lang);text=entry.ko;}
 return fill(text,vars,lang);
}
// 다른 모듈(진도·계정·튜터 저장)이 한국어로 만든 상태·오류 문장을 화면에 보일 때 바꾼다. 표의 msg.* 줄과 글자가 같아야 하고,
// 모르는 문장은 그대로(한국어) 보이며 빠진 말로 남는다. 한국어 화면에서는 아무것도 바꾸지 않는다.
let messageIndex=null;
export function tMessage(text,lang=currentLang()){
 if(typeof text!=='string'||!text||lang==='ko')return text;
 if(!messageIndex){messageIndex=new Map();for(const [key,entry]of Object.entries(STRINGS))if(key.startsWith('msg.')&&!messageIndex.has(entry.ko))messageIndex.set(entry.ko,key);}
 const key=messageIndex.get(text);if(key)return t(key,undefined,lang);
 if(/[가-힣]/.test(text))note(`msg:${text.slice(0,60)}`,lang);
 return text;
}
// 정적 HTML의 data-i18n(글자) · data-i18n-html(표의 줄바꿈 표시까지, 표 글만 넣는다) · data-i18n-label(aria-label) ·
// data-i18n-title(title) · data-i18n-alt(alt)을 지금 언어로 채운다. JS가 따로 고치는 글자 자리에는 이 고리를 달지 않는다.
export function translateTree(root=globalThis.document){
 if(!root?.querySelectorAll)return;
 for(const node of root.querySelectorAll('[data-i18n]'))node.textContent=t(node.dataset.i18n);
 for(const node of root.querySelectorAll('[data-i18n-html]'))node.innerHTML=t(node.dataset.i18nHtml);
 for(const node of root.querySelectorAll('[data-i18n-label]'))node.setAttribute('aria-label',t(node.dataset.i18nLabel));
 for(const node of root.querySelectorAll('[data-i18n-title]'))node.setAttribute('title',t(node.dataset.i18nTitle));
 for(const node of root.querySelectorAll('[data-i18n-alt]'))node.setAttribute('alt',t(node.dataset.i18nAlt));
}
export function formatDate(at,options,lang=currentLang()){
 if(!Number.isFinite(at))return '';
 try{return new Intl.DateTimeFormat(LANG_LOCALES[lang]||'ko-KR',{timeZone:'Asia/Seoul',...options}).format(new Date(at));}
 catch{return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',...options}).format(new Date(at));}
}
applyDocument();
if(globalThis.window)window.__synkWorldLang={current:currentLang,set:setLang,missing:missingStrings,langs:LANGS};
export default {LANGS,LANG_NAMES,LANG_KEY,t,tMessage,currentLang,setLang,onLang,deviceLang,savedLang,urlLang,suggestedLang,hasChosenLang,supportedLang,missingStrings,translateTree,formatDate};
