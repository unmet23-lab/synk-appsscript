import { validateTravelMemory, TRAVEL_STORAGE_KEY } from './planner-storage.mjs';
import { SEMANTIC_KEYS } from './planner.mjs';

export const TRAVEL_LOGIN_DRAFT_KEY = 'synk.path-travel.login-draft.v1';
export const TRAVEL_LOGIN_DRAFT_TTL = 30 * 60 * 1000;
export const TRAVEL_LOGIN_FIELDS = Object.freeze(['trip-date','start-time','end-time','origin','adults','children','budget','walking','stop-count','max-leg-walk','rest-every','rest-duration','require-food','require-indoor','require-vegetarian','require-stepfree','meal-mode','meal-start','meal-end','destination', ...[0,1,2].flatMap(i=>['appointment-place-'+i,'appointment-time-'+i])]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key=>Object.hasOwn(value,key));
const text = (value, max=200) => typeof value === 'string' && value.length <= max && !value.includes('\0');
const fail = () => { throw new TypeError('로그인 전 여행을 임시 보관하지 못했어요. 현재 여행을 파일로 저장한 뒤 다시 시도해 주세요.'); };
const boolMap = value => object(value) && Object.keys(value).every(key=>SEMANTIC_KEYS.includes(key)&&typeof value[key]==='boolean');
const point = value => value === null || exact(value,['id','name','lat','lon']) && text(value.id,120) && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value.id) && text(value.name,160) && value.name.trim().length && Number.isFinite(value.lat) && Number.isFinite(value.lon) && Math.abs(value.lat)<=90 && Math.abs(value.lon)<=180;
const allowedControl = key => TRAVEL_LOGIN_FIELDS.includes(key) || /^(?:preference|avoid|taste):/.test(key) && SEMANTIC_KEYS.includes(key.split(':')[1]) && key.split(':').length===2;

/** Incomplete form values are retained as plain values, never executable markup. */
export function validateTravelLoginDraft(value) {
  if (value === null) return null;
  if (!exact(value,['controls','companions','preferences','requiredFeatures','requiredCategories','origin','destination','formDirty','panels'])
    || !object(value.controls) || Object.keys(value.controls).length>100 || Object.entries(value.controls).some(([key,row])=>!allowedControl(key)||!exact(row,['value','checked'])||!text(row.value)||typeof row.checked!=='boolean')
    || !Array.isArray(value.companions) || value.companions.length>6 || !boolMap(value.preferences) || !boolMap(value.requiredFeatures)
    || !Array.isArray(value.requiredCategories) || value.requiredCategories.length>3 || new Set(value.requiredCategories).size!==value.requiredCategories.length || value.requiredCategories.some(key=>!['food','tea','culture'].includes(key))
    || !point(value.origin) || !point(value.destination) || typeof value.formDirty!=='boolean'
    || !exact(value.panels,['conditions','companions','schedule']) || Object.values(value.panels).some(v=>typeof v!=='boolean')) fail();
  const ids=new Set();
  for(const row of value.companions){
    if(!exact(row,['id','label','preferences','requiredFeatures'])||!text(row.id,120)||!/^[a-zA-Z0-9_.:-]+$/.test(row.id)||ids.has(row.id)||!text(row.label,24)||!boolMap(row.preferences)||!boolMap(row.requiredFeatures))fail();
    ids.add(row.id);
  }
  return structuredClone(value);
}

// This detects another tab's guest edits, not an authenticity claim. The record
// contains guest-only data and is never trusted as credentials or consent authority.
function stamp(value) { if(value===null)return null;let a=2166136261,b=5381;for(let i=0;i<value.length;i++){a=Math.imul(a^value.charCodeAt(i),16777619);b=Math.imul(b,33)^value.charCodeAt(i);}return `${value.length}:${a>>>0}:${b>>>0}`; }
export function createTravelLoginHandoff({ storage=globalThis.sessionStorage, guestStorage=globalThis.localStorage, getUrl=()=>globalThis.location.href, now=Date.now }={}) {
  const binding=()=>{const url=new URL('.',getUrl());if(!['http:','https:'].includes(url.protocol)||url.username||url.password)fail();return url.origin+url.pathname;};
  const guestStamp=()=>{try{return stamp(guestStorage?.getItem(TRAVEL_STORAGE_KEY)??null);}catch{return 'unavailable';}};
  const clear=()=>{try{storage?.removeItem(TRAVEL_LOGIN_DRAFT_KEY);}catch{}};
  function read(){
    try{
      const raw=storage?.getItem(TRAVEL_LOGIN_DRAFT_KEY);if(!raw)return null;
      if(raw.length>640*1024)fail();const row=JSON.parse(raw),at=now();
      if(!exact(row,['version','binding','createdAt','expiresAt','guestStamp','memory','draft'])||row.version!==1||row.binding!==binding()||!Number.isSafeInteger(row.createdAt)||!Number.isSafeInteger(row.expiresAt)||row.expiresAt-row.createdAt!==TRAVEL_LOGIN_DRAFT_TTL||at<row.createdAt||at>=row.expiresAt||row.guestStamp!==null&&!text(row.guestStamp,100))fail();
      row.memory=validateTravelMemory(row.memory,{now:new Date(at).toISOString()});row.draft=validateTravelLoginDraft(row.draft);
      // A newer/removed guest record must not be overwritten by returning from OAuth.
      if(row.guestStamp==='unavailable'||row.guestStamp!==guestStamp())row.memory.consent=false;
      return {memory:row.memory,draft:row.draft};
    }catch{clear();return null;}
  }
  function save({memory,draft=null}){
    const at=now(),row={version:1,binding:binding(),createdAt:at,expiresAt:at+TRAVEL_LOGIN_DRAFT_TTL,guestStamp:guestStamp(),memory:validateTravelMemory(memory,{now:new Date(at).toISOString()}),draft:validateTravelLoginDraft(draft)};
    const raw=JSON.stringify(row);if(new TextEncoder().encode(raw).byteLength>640*1024)fail();
    try{storage.setItem(TRAVEL_LOGIN_DRAFT_KEY,raw);if(storage.getItem(TRAVEL_LOGIN_DRAFT_KEY)!==raw)fail();}catch{fail();}
  }
  function revokeConsent(){
    try{const raw=storage?.getItem(TRAVEL_LOGIN_DRAFT_KEY);if(!raw)return;const row=JSON.parse(raw);if(row.memory)row.memory.consent=false;storage.setItem(TRAVEL_LOGIN_DRAFT_KEY,JSON.stringify(row));}catch{clear();}
  }
  return {read,save,clear,revokeConsent};
}
