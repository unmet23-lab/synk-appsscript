// Local editing aids. Inventory, equipped outfits and saved looks remain server authoritative.
import {WARDROBE_ITEMS,slotsForOutfit} from './wardrobe-catalog.mjs';

export const WORKBENCH_SCHEMA=3;
const ids=new Set(WARDROBE_ITEMS.map(item=>item.id));
const slotNames=['body','neck'];
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const number=(value,min,max,fallback=0)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const text=(value,max=64)=>typeof value==='string'?value.trim().slice(0,max):'';
const shortcut=(value,fallback)=>typeof value==='string'&&/^[a-z0-9]$/i.test(value)?value.toLowerCase():fallback;
const fontScale=value=>[1,1.15,1.3].reduce((best,scale)=>Math.abs(scale-number(value,1,1.3,1))<Math.abs(best-number(value,1,1.3,1))?scale:best,1);
const list=(value,limit=64,validate=id=>ids.has(id))=>[...new Set((Array.isArray(value)?value:[]).filter(id=>typeof id==='string'&&validate(id)))].slice(0,limit);
const lookId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id);
const timestamp=value=>number(value,0,8640000000000000);
const timeMap=value=>Object.fromEntries(Object.entries(plain(value)).filter(([id])=>ids.has(id)).map(([id,time])=>[id,timestamp(time)]));
const clone=value=>JSON.parse(JSON.stringify(value));

/** Each dyed slot has two sRGB HEX colours; absent slots keep the original textile. */
export function normalizeDyes(value={}){
  const result={};for(const slot of slotNames){const colors=value?.[slot];if(Array.isArray(colors)&&colors.length===2&&colors.every(color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color)))result[slot]=colors.map(color=>color.toLowerCase());}return result;
}
/** Pass owned to remove no-longer-owned items from a restored editing draft. */
export function normalizeEditState(value={},options={}){
  const source=plain(value),slots=slotsForOutfit(source.slots||source),dyes=normalizeDyes(source.dyes);
  const owned=options.owned?new Set(options.owned):null;
  for(const slot of slotNames){if(owned&&!owned.has(slots[slot]))slots[slot]='';if(!slots[slot])delete dyes[slot];}
  return {slots,dyes};
}

/** A bounded, branch-aware undo history containing both item and dye changes. */
export class DraftHistory{
  constructor(initial={},options={}){this.limit=Math.round(number(options.limit,2,200,80));this.entries=[normalizeEditState(initial)];this.index=0;}
  get current(){return clone(this.entries[this.index]);}
  get canUndo(){return this.index>0;}
  get canRedo(){return this.index<this.entries.length-1;}
  record(value){const next=normalizeEditState(value);if(JSON.stringify(next)===JSON.stringify(this.entries[this.index]))return this.current;this.entries.splice(this.index+1);this.entries.push(next);if(this.entries.length>this.limit)this.entries.shift();this.index=this.entries.length-1;return this.current;}
  undo(){if(this.canUndo)this.index--;return this.current;}
  redo(){if(this.canRedo)this.index++;return this.current;}
  reset(value){this.entries=[normalizeEditState(value)];this.index=0;return this.current;}
}

export const WARDROBE_TAGS=Object.freeze({
  'mongle-apron-starter':{aliases:['apron','cotton','앞치마','녹색','초록','green'],colors:['green'],materials:['cotton'],styles:['workshop','daily']},
  'mongle-knit-butter':{aliases:['knit','butter','yellow','노랑','베이지','조끼','vest','뜨개'],colors:['yellow','beige'],materials:['knit'],styles:['warm','daily']},
  'mongle-denim-workshop':{aliases:['denim','blue','파랑','청','앞치마','apron'],colors:['blue'],materials:['denim'],styles:['workshop','daily']},
  'mongle-rain-cape':{aliases:['cape','rain','케이프','비','민트','청록','mint'],colors:['mint','blue'],materials:['cotton'],styles:['walk','rain']},
  'mongle-hanbok-vest':{aliases:['hanbok','vest','한복','배자','보라','purple'],colors:['purple'],materials:['woven'],styles:['traditional']},
  'mongle-scarf-first-steps':{aliases:['scarf','cream','white','목도리','머플러','크림','흰색','베이지','뜨개'],colors:['cream','beige'],materials:['knit'],styles:['warm','walk']},
  'mongle-scarf-lapis':{aliases:['scarf','lapis','blue','목도리','머플러','파랑','청','뜨개'],colors:['blue'],materials:['knit'],styles:['warm','daily']},
  'mongle-bandana-meadow':{aliases:['bandana','scarf','green','초록','녹색','삼각','스카프','면'],colors:['green'],materials:['cotton'],styles:['walk','daily']},
});
const tagLabels={green:'초록 녹색',yellow:'노랑 버터',beige:'베이지',blue:'파랑 청',mint:'민트 청록',purple:'보라',cream:'크림 흰색',cotton:'면 코튼',knit:'니트 뜨개',denim:'데님 청',woven:'직물',workshop:'공방 작업',daily:'일상',warm:'포근 따뜻',walk:'산책',rain:'비',traditional:'한복 전통'};
const initials=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const chosung=value=>[...value].map(char=>{const code=char.charCodeAt(0)-44032;return code>=0&&code<11172?initials[Math.floor(code/588)]:char;}).join('');
const folded=value=>String(value||'').normalize('NFC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export const itemTags=item=>WARDROBE_TAGS[item?.id]||{aliases:[],colors:[],materials:[],styles:[]};
export const FILTER_OPTIONS=Object.freeze(Object.fromEntries(['colors','materials','styles'].map(kind=>[kind,[...new Set(Object.values(WARDROBE_TAGS).flatMap(tags=>tags[kind]))].map(id=>({id,label:tagLabels[id]?.split(' ')[0]||id}))])));

export function normalizeWorkbenchState(value={}){
  const source=plain(value),filter=plain(source.filter),view=plain(source.view),prefs=plain(source.preferences),scroll=plain(source.scroll);
  const groups=(Array.isArray(source.groups)?source.groups:[]).slice(0,16).map((group,index)=>({id:text(group?.id,40)||`group-${index+1}`,name:text(group?.name,24)||'내 모음',icon:text(group?.icon,8)||'★',itemIds:list(group?.itemIds,64)})).filter((group,index,array)=>array.findIndex(g=>g.id===group.id)===index);
  return {
    schema:WORKBENCH_SCHEMA,tab:['fitting','looks','photo'].includes(source.tab)?source.tab:'fitting',category:['all','body','neck'].includes(source.category)?source.category:'all',query:text(source.query,100),ownedOnly:source.ownedOnly!==false,viewFilter:['owned','all','favorites','recent','new'].includes(source.viewFilter)?source.viewFilter:source.ownedOnly===false?'all':'owned',sort:['catalog','name','equipped','favorite','recent','new'].includes(source.sort)?source.sort:'equipped',
    filter:Object.fromEntries(['colors','materials','styles'].map(kind=>[kind,list(filter[kind],16,id=>FILTER_OPTIONS[kind].some(tag=>tag.id===id))])),showHidden:source.showHidden===true,favorites:list(source.favorites),hidden:list(source.hidden),recent:timeMap(source.recent),unseen:list(source.unseen),knownOwned:source.knownOwned===null||!own(source,'knownOwned')?null:list(source.knownOwned),acquiredAt:timeMap(source.acquiredAt),
    groups,groupId:groups.some(group=>group.id===source.groupId)?source.groupId:'',lookFavorites:list(source.lookFavorites,12,lookId),lookOrder:list(source.lookOrder,12,lookId),locks:{body:source.locks?.body===true,neck:source.locks?.neck===true},
    view:{angle:number(view.angle,-Math.PI*100,Math.PI*100,0),zoom:number(view.zoom,0,1,0),detail:view.detail===true},scroll:{itemsLeft:number(scroll.itemsLeft,0,100000),itemsTop:number(scroll.itemsTop,0,100000),looksTop:number(scroll.looksTop,0,100000),panelTop:number(scroll.panelTop,0,100000)},
    light:['daylight','sunset','studio'].includes(source.light)?source.light:'daylight',format:['portrait','square','landscape'].includes(source.format)?source.format:'portrait',pose:['neutral','wave','tilt'].includes(source.pose)?source.pose:'neutral',background:['room','warm','garden'].includes(source.background)?source.background:'room',
    draft:source.draft?normalizeEditState(source.draft):null,updatedAt:timestamp(source.updatedAt),preferences:{fontScale:fontScale(prefs.fontScale),reducedMotion:prefs.reducedMotion===true,highContrast:prefs.highContrast===true,gamepad:prefs.gamepad!==false,shortcutsEnabled:prefs.shortcutsEnabled!==false&&prefs.shortcuts!==false,shortcuts:Object.fromEntries(['undo','redo','capture','reset'].map(action=>[action,shortcut(prefs.shortcuts?.[action],{undo:'z',redo:'y',capture:'p',reset:'0'}[action])]))},
  };
}

const storageSessions=new Map();
/** Device-local, per-account preferences. A failed/quota-limited write keeps an explicit session copy. */
export function createWorkbenchStorage({accountId,storage,now=Date.now}={}){
  if(!text(accountId,200))throw new TypeError('accountId is required');
  const key=`synk-wardrobe-workbench-v${WORKBENCH_SCHEMA}:${encodeURIComponent(String(accountId))}`;
  let status={mode:'device',message:'이 기기에 편집 설정을 저장해요.'};
  if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
  function load(){let raw=storageSessions.get(key);try{const saved=storage?.getItem(key);if(saved){const disk=JSON.parse(saved);if(!raw||timestamp(disk?.updatedAt)>timestamp(raw?.updatedAt))raw=disk;}}catch(error){status={mode:'session',message:'기기 저장을 읽지 못해 이번 화면에서만 이어가요.',error:String(error?.name||'STORAGE_READ')};}return normalizeWorkbenchState(raw);}
  function save(value){const state=normalizeWorkbenchState({...value,updatedAt:now()});storageSessions.set(key,state);try{if(!storage)throw new Error('STORAGE_UNAVAILABLE');storage.setItem(key,JSON.stringify(state));status={mode:'device',message:'이 기기에 편집 설정을 저장했어요.'};return {ok:true,...status};}catch(error){status={mode:'session',message:'기기 저장 공간을 사용할 수 없어 이번 실행에서만 설정을 유지해요.',error:String(error?.name||'STORAGE_WRITE')};return {ok:false,...status};}}
  function reconcileInventory(owned,{acquiredAt={}}={}){const state=load(),current=list(owned),previous=state.knownOwned===null?null:new Set(state.knownOwned),currentSet=new Set(current);state.unseen=state.unseen.filter(id=>currentSet.has(id));for(const id of current){if(previous&&!previous.has(id)&&!state.unseen.includes(id))state.unseen.push(id);if(!state.acquiredAt[id])state.acquiredAt[id]=timestamp(acquiredAt[id]||now());}state.knownOwned=current;save(state);return state;}
  return {key,load,save,reconcileInventory,get status(){return {...status};}};
}

/** Text terms and filter dimensions are ANDed. Multiple tags within one dimension are alternatives. */
export function filterItems(items,state={},context={}){
  const normalized=normalizeWorkbenchState(state),owned=new Set(context.owned||[]),favorites=new Set(normalized.favorites),group=normalized.groups.find(g=>g.id===normalized.groupId),terms=folded(normalized.query).split(' ').filter(Boolean);
  return sortItems(items.filter(item=>{const tags=itemTags(item);if(normalized.category!=='all'&&item.slot!==normalized.category)return false;if(normalized.ownedOnly&&!owned.has(item.id))return false;if(normalized.viewFilter==='owned'&&!owned.has(item.id))return false;if(normalized.viewFilter==='favorites'&&!favorites.has(item.id))return false;if(normalized.viewFilter==='recent'&&!normalized.recent[item.id])return false;if(normalized.viewFilter==='new'&&!normalized.unseen.includes(item.id))return false;if(!normalized.showHidden&&normalized.hidden.includes(item.id))return false;if(group&&!group.itemIds.includes(item.id))return false;if(context.favoritesOnly&&!favorites.has(item.id))return false;for(const kind of ['colors','materials','styles'])if(normalized.filter[kind].length&&!normalized.filter[kind].some(tag=>tags[kind].includes(tag)))return false;const haystack=folded([item.name,item.material,item.collection,item.detail,...tags.aliases,...['colors','materials','styles'].flatMap(kind=>tags[kind].map(tag=>tagLabels[tag]))].join(' '));return terms.every(term=>haystack.includes(term)||(/^[ㄱ-ㅎ]+$/.test(term)&&chosung(haystack).includes(term)));}),normalized,context);
}
export function sortItems(items,state={},context={}){
  const sort=state.sort||'equipped',owned=new Set(context.owned||[]),equipped=new Set(Object.values(context.equipped||{})),favorites=new Set(state.favorites||[]),unseen=new Set(state.unseen||[]),catalog=new Map(WARDROBE_ITEMS.map((item,index)=>[item.id,index]));
  const score=item=>sort==='favorite'?Number(favorites.has(item.id)):sort==='recent'?Number(state.recent?.[item.id]||0):sort==='new'?Number(unseen.has(item.id))*1e16+Number(state.acquiredAt?.[item.id]||0):sort==='equipped'?Number(equipped.has(item.id)):0;
  return [...items].sort((a,b)=>Number(owned.has(b.id))-Number(owned.has(a.id))||score(b)-score(a)||(sort==='name'?a.name.localeCompare(b.name,'ko'):0)||(catalog.get(a.id)??999)-(catalog.get(b.id)??999));
}
/** Picks only owned pieces; locked slots and their dyes are kept. Empty inventories stay empty. */
export function randomSlots({slots={},dyes={},owned=[],locks={},rng=Math.random,allowEmpty=false}={}){
  const next=normalizeEditState({slots,dyes}),ownedSet=new Set(owned);
  for(const slot of slotNames){if(locks[slot])continue;const candidates=WARDROBE_ITEMS.filter(item=>item.slot===slot&&ownedSet.has(item.id)).map(item=>item.id);if(allowEmpty)candidates.push('');if(candidates.length>1){const alternatives=candidates.filter(id=>id!==next.slots[slot]);next.slots[slot]=alternatives[Math.min(alternatives.length-1,Math.floor(number(rng(),0,.999999999,0)*alternatives.length))];}else next.slots[slot]=candidates[0]||'';delete next.dyes[slot];}return next;
}

export function thumbnailKey({accountId='',revision='studio6',slots={},dyes={},view='front',light='daylight',pose='neutral',background='room'}={}){const edit=normalizeEditState({slots,dyes});return JSON.stringify([String(accountId),String(revision),edit.slots.body,edit.slots.neck,edit.dyes.body||[],edit.dyes.neck||[],view,light,pose,background]);}
export class BoundedThumbnailCache{
  constructor({maxEntries=96,maxBytes=16*1024*1024,onEvict}={}){this.maxEntries=Math.floor(number(maxEntries,1,256,96));this.maxBytes=Math.floor(number(maxBytes,1,64*1024*1024,16*1024*1024));this.onEvict=onEvict;this.entries=new Map();this.bytes=0;}
  get(key){const entry=this.entries.get(key);if(!entry)return undefined;this.entries.delete(key);this.entries.set(key,entry);return entry.value;}
  set(key,value,{bytes=typeof value==='string'?value.length*2:(value?.size||0)}={}){this.delete(key);bytes=number(bytes,0,Number.MAX_SAFE_INTEGER,this.maxBytes+1);if(bytes>this.maxBytes)return false;this.entries.set(key,{value,bytes});this.bytes+=bytes;while(this.entries.size>this.maxEntries||this.bytes>this.maxBytes)this.delete(this.entries.keys().next().value);return true;}
  delete(key){const entry=this.entries.get(key);if(!entry)return false;this.bytes-=entry.bytes;this.entries.delete(key);this.onEvict?.(entry.value,key);return true;}
  clear(){for(const key of [...this.entries.keys()])this.delete(key);}
  get size(){return this.entries.size;}
}
export const wardrobeThumbnailCache=new BoundedThumbnailCache();
