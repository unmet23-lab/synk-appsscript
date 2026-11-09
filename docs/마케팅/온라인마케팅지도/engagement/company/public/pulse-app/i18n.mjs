// 손님 화면 글의 번역 틀. 한국어 문장이 곧 키다 — 한국어 화면은 받은 문장을 그대로 돌려주므로 바이트가 그대로다.
// 지킬 것: 자리표는 이름 있는 {name}만 쓴다(값을 조각으로 잇지 않는다). 이스케이프는 늘 번역 뒤 — esc(t('…')).
// 문맥이 갈리는 낱말(확인 · 모델 · 보내기 · 열기 · 다음)은 ctx를 붙여 따로 번역한다. 표 상수는 한국어로 두고 그리는 자리에서 번역한다.
// 사전은 언어마다 i18n/<언어>.mjs 하나이고 처음 그 언어를 쓸 때 불러온다. 서버도 이 모듈을 가져오므로 DOM · 저장소를 만지지 않는다.
export const LOCALES=Object.freeze(['ko','en','ja']);
// 사전이 있는 언어. 일본어는 구조만 있고 사전이 없다(공개 전 현지어 검수 뒤에 더한다).
export const DICTIONARY_LOCALES=Object.freeze(['ko','en']);
export const DEFAULT_LOCALE='ko';
const dicts=new Map([['ko',null]]);
let current=DEFAULT_LOCALE;
export const isLocale=value=>LOCALES.includes(value);
export const locale=()=>current;
const keyOf=(text,ctx)=>ctx?`${ctx}\u0004${text}`:text;
const fill=(text,vars)=>vars?String(text).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g,(match,name)=>Object.prototype.hasOwnProperty.call(vars,name)?String(vars[name]??''):match):String(text);
// 지금 언어로. 사전에 없는 문장은 한국어 원문 그대로(시험이 빠진 문장을 잡는다). 빈 값(null · undefined)은 빈 글자다(판 1 화면 검수 F3).
export const t=(text,vars,ctx)=>tl(current,text,vars,ctx);
// 표 · 변수에 담아 두었다가 그리는 자리에서 t(값)으로 옮길 문장 표시(판 2). 값은 그대로 돌려준다 — 사전 대조 시험이 k('…')도 키로 센다.
export const k=text=>text;
// 복수형(판 0 「1 files」): 사전 값이 {one,other,…}이면 vars.count로 그 언어의 꼴을 고른다. 한국어 문장은 수와 상관없이 하나다.
const rules=new Map();
function plural(loc,forms,count,fallback){
  const n=Number(count);let rule='other';
  if(Number.isFinite(n)){if(!rules.has(loc))rules.set(loc,new Intl.PluralRules(intlLocale(loc)));rule=rules.get(loc).select(n);}
  return typeof forms[rule]==='string'?forms[rule]:typeof forms.other==='string'?forms.other:fallback;
}
// 언어를 정해서. 한국어 문장 키가 사전에 없으면 원문.
export const tl=(loc,text,vars,ctx)=>translateWith(dicts.get(loc),loc,text,vars,ctx);
// 사전을 직접 넘겨서(서버가 만드는 손님 문구 — 서버 사전 pulse-locale.mjs는 화면 사전과 따로 둔다).
export function translateWith(dict,loc,text,vars,ctx){
  if(text===null||text===undefined)return '';
  const key=keyOf(text,ctx);
  let found=dict&&Object.prototype.hasOwnProperty.call(dict,key)?dict[key]:text;
  if(found&&typeof found==='object')found=plural(loc,found,vars?.count,text);
  return fill(found,vars);
}
export const hasDictionary=loc=>dicts.get(loc)!==undefined;
// 사전을 직접 넣는다(서버 · 시험이 정적으로 가져온 사전).
export function registerLocale(loc,dict){if(isLocale(loc)&&loc!=='ko')dicts.set(loc,Object.freeze({...dict}));}
export async function loadLocale(loc){
  if(!DICTIONARY_LOCALES.includes(loc))return false;
  if(dicts.has(loc))return true;
  const mod=await import(`./i18n/${loc}.mjs`);
  registerLocale(loc,mod.default);
  return true;
}
// 언어를 바꾼다. 사전을 못 불러오면 한국어로 둔다(화면이 멈추지 않게).
export async function setLocale(loc){
  let next=DICTIONARY_LOCALES.includes(loc)?loc:DEFAULT_LOCALE;
  if(next!==DEFAULT_LOCALE)try{await loadLocale(next);}catch{next=DEFAULT_LOCALE;}
  current=next;
  return current;
}
// 언어 고르기: 손님이 고른 것 → 프로젝트 소통 언어 · 링크 언어 → 브라우저 언어 → (브라우저 목록에 한국어가 없고 영어가 허락돼 있으면) 영어 → 한국어.
// 서버가 허락한 목록(allowed — 응답의 features.locales) 밖은 건너뛴다. 한국어는 늘 고를 수 있다.
export function pickLocale({chosen='',project='',link='',browser=[],allowed=[DEFAULT_LOCALE]}={}){
  const ok=new Set([DEFAULT_LOCALE,...(Array.isArray(allowed)?allowed:[]).filter(value=>DICTIONARY_LOCALES.includes(value))]);
  const tags=(Array.isArray(browser)?browser:[]).map(tag=>String(tag||'').toLowerCase().split('-')[0]).filter(Boolean);
  for(const value of [chosen,project,link,...tags])if(value&&ok.has(value))return value;
  // 판 0 벤치마킹(Filestage 방식): 한국어를 못 읽는 손님에게 한국어를 먼저 내밀지 않는다.
  if(tags.length&&!tags.includes(DEFAULT_LOCALE)&&ok.has('en'))return 'en';
  return DEFAULT_LOCALE;
}
// 화면에 쓰는 언어 꼬리표(html lang · Intl).
export const htmlLang=loc=>loc==='en'?'en':loc==='ja'?'ja':'ko';
export const intlLocale=loc=>loc==='en'?'en-US':loc==='ja'?'ja-JP':'ko-KR';
