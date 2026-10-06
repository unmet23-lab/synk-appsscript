// The shared play collection's ledger: items, wallet, equipment and the mini-game reward. Every SYNK
// LAB mini-game loads this through play-common/collection.js; racing adds its missions and race reward
// on top (garage.js). It holds no learning data and no racing course data.
// This collection belongs to this browser origin. It is ready for other mini-games
// to share, but is not an account wallet or a server-side purchase system.
export const GARAGE_KEY = 'SYNK_PLAY_COLLECTION_V1';
export const VEHICLES = [
  {id:'coast',kind:'coast',name:'코스트 GT',price:0,description:'첫 바다 여행을 함께하는 스포츠카',color:'#8dc9bc'},
  {id:'open',kind:'open',name:'브리즈 로드스터',price:120,description:'열린 지붕으로 바람을 만나는 로드스터',color:'#e4b79a'},
  {id:'rally',kind:'rally',name:'트레일 랠리',price:220,description:'넓은 펜더와 보조등을 갖춘 랠리카',color:'#aebaca'},
  {id:'finale',kind:'open',name:'마스터 로드스터',price:null,unlockOnly:true,description:'여섯 번째 챕터 결승의 특별 에디션',color:'#d6c6a2'}
];
export const PAINTS = [
  {id:'mint',name:'민트',price:0,color:'#8dc9bc'},
  {id:'coral',name:'코랄',price:35,color:'#d78678'},
  {id:'pearl',name:'진주빛',price:35,color:'#e9e5d9'},
  {id:'midnight',name:'미드나이트',price:50,color:'#333e5c'},
  {id:'aurora',name:'오로라',price:null,unlockOnly:true,color:'#6cced2'},
  {id:'sunset',name:'노을',price:null,unlockOnly:true,color:'#d88b72'}
];
export const WHEELS = [
  {id:'silver',name:'실버',price:0,color:'#c9ced3'},
  {id:'graphite',name:'그래파이트',price:45,color:'#4c515a'},
  {id:'gold',name:'샴페인 골드',price:70,color:'#c9ac72'},
  {id:'blossom',name:'벚꽃',price:null,unlockOnly:true,color:'#efd9cb'}
];
export const TRAILS = [
  {id:'lime',name:'라임 부스터',price:0,color:'#d4ff8a'},
  {id:'ocean',name:'바다 부스터',price:45,color:'#66cae7'},
  {id:'sunset',name:'노을 부스터',price:70,color:'#efa577'},
  {id:'starlight',name:'별빛 부스터',price:null,unlockOnly:true,color:'#ced2ff'}
];
const badge = {id:'badge-coast',kind:'badge',value:'coast',name:'코스트 챔피언',price:null,unlockOnly:true,color:'#d1e6da',description:'네 번째 챕터 결승 기념 배지'};
// Talk Rally's racket face and ball (2026-10-07). Felt colours from the SYNK palette; the free ones keep the
// game's original look. `label` is the short colour name shown under a swatch where the row already says what it is.
export const RACKETS = [
  {id:'coral',name:'코랄 라켓',label:'코랄',price:0,color:'#d63c2a'},
  {id:'butter',name:'버터 라켓',label:'버터',price:40,color:'#f5c445'},
  {id:'blush',name:'연분홍 라켓',label:'연분홍',price:40,color:'#fbd3c6'},
  {id:'lapis',name:'라피스 라켓',label:'라피스',price:50,color:'#3d6bc9'}
];
export const BALLS = [
  {id:'cream',name:'크림 공',label:'크림',price:0,color:'#fff1c9'},
  {id:'butter',name:'버터 공',label:'버터',price:35,color:'#f5c445'},
  {id:'blush',name:'연분홍 공',label:'연분홍',price:35,color:'#fbd3c6'},
  {id:'lapis',name:'라피스 공',label:'라피스',price:45,color:'#3d6bc9'}
];
const catalogue = (kind,items) => items.map(item=>({...item,id:`${kind}-${item.id}`,kind,value:item.id}));
export const SHOP_ITEMS = [
  ...catalogue('vehicle',VEHICLES),...catalogue('paint',PAINTS),
  ...catalogue('wheels',WHEELS).map(item=>item.value==='blossom'?{...item,id:'wheel-blossom'}:item),
  ...catalogue('trail',TRAILS),badge,
  ...catalogue('racket',RACKETS),...catalogue('ball',BALLS)
];
export const FINALE_REWARDS = Object.freeze({1:'paint-aurora',2:'wheel-blossom',3:'trail-starlight',4:'badge-coast',5:'paint-sunset',6:'vehicle-finale'});
const BY_ID = Object.fromEntries(SHOP_ITEMS.map(item=>[item.id,item]));
const itemById = id => typeof id==='string'&&Object.hasOwn(BY_ID,id)?BY_ID[id]:null;
const FREE_ITEMS = SHOP_ITEMS.filter(item=>item.price===0).map(item=>item.id);
// A wallet saved before a kind existed simply gets that kind's free default (normalizeGarage restores field by field).
export const DEFAULT_EQUIPMENT = Object.freeze({vehicle:'coast',paint:'mint',wheels:'silver',trail:'lime',badge:null,racket:'coral',ball:'cream'});
export const REWARDS = Object.freeze({finish:15,correct:2,firstClear:10,correction:5,mission:15,dailyRaceLimit:10,miniGameAccuracy:10});
// Mini-games that share this wallet. Each pays only after its own complete-round condition.
export const MINI_GAMES = Object.freeze(['rhythm','runner','blank-slice','entry-check','story-classroom','talk-rally','order-rush']);
export const integer = (value,fallback=0,max=1_000_000_000) => typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,Math.floor(value))):fallback;
export const object = value => value&&typeof value==='object'&&!Array.isArray(value)?value:{};
export const safeKey = key => typeof key==='string'&&key.length>0&&key.length<=180&&!['__proto__','prototype','constructor'].includes(key);
const boolRecord = value => Object.fromEntries(Object.entries(object(value)).filter(([key,flag])=>safeKey(key)&&flag===true));
const knownItem = (kind,value) => SHOP_ITEMS.find(item=>item.kind===kind&&item.value===value);
export const validTime = now => typeof now==='number'&&Number.isFinite(now)?now:Date.now();
export const seoulDate = (now=Date.now()) => new Date(validTime(now)+9*60*60*1000).toISOString().slice(0,10);

export const emptyGarage = () => ({
  version:1,coins:0,totalEarned:0,owned:[...FREE_ITEMS],equipped:{...DEFAULT_EQUIPMENT},
  wish:'open',rewardedRounds:{},firstClears:{},corrections:{},dailyRaceCounts:{},missions:{}
});

// Racing's daily missions are stored in the same record. Without racing's courses a mini-game cannot
// rebuild them, so it keeps each well-formed one as stored; racing's own load rebuilds and checks them.
const text=(value,max)=>typeof value==='string'&&value.length<=max?value:'';
export function keepMission(day,m) {
  return {id:text(m.id,240),date:day,kind:m.kind,target:m.target,collection:m.collection==='words'?'words':'campaign',
    title:text(m.title,120),description:text(m.description,400),reward:integer(m.reward,0,1000),
    completed:m.completed===true,completedAt:integer(m.completedAt,0,Number.MAX_SAFE_INTEGER)};
}

export function normalizeGarage(saved,mission=keepMission) {
  const result=emptyGarage();
  if(!saved||typeof saved!=='object')return result;
  // Restore each field separately: a broken cosmetic must not erase valid coins.
  result.coins=integer(saved.coins);result.totalEarned=Math.max(result.coins,integer(saved.totalEarned));
  result.owned=[...new Set([...FREE_ITEMS,...(Array.isArray(saved.owned)?saved.owned:[]).filter(id=>itemById(id))])];
  const equipment=object(saved.equipped);
  for(const kind of Object.keys(DEFAULT_EQUIPMENT)){
    const item=knownItem(kind,equipment[kind]);
    if(item&&result.owned.includes(item.id))result.equipped[kind]=item.value;
  }
  result.wish=VEHICLES.some(v=>v.id===saved.wish&&!v.unlockOnly)?saved.wish:saved.wish===null?null:'open';
  result.firstClears=boolRecord(saved.firstClears);result.corrections=boolRecord(saved.corrections);
  result.rewardedRounds=Object.fromEntries(Object.entries(object(saved.rewardedRounds)).filter(([key])=>safeKey(key)).map(([key,r])=>[key,{
    date:/^\d{4}-\d{2}-\d{2}$/.test(r?.date)?r.date:'',coins:integer(r?.coins)
  }]));
  result.dailyRaceCounts=Object.fromEntries(Object.entries(object(saved.dailyRaceCounts)).filter(([day])=>/^\d{4}-\d{2}-\d{2}$/.test(day)).map(([day,count])=>[day,integer(count,0,1_000_000)]));
  for(const [day,m] of Object.entries(object(saved.missions))){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!m||typeof m!=='object'||!['correction','first-clear'].includes(m.kind)||!safeKey(m.target))continue;
    const kept=mission(day,m);
    if(kept)result.missions[day]=kept;
  }
  return result;
}

export function loadGarage(storage,mission) {
  try{return normalizeGarage(JSON.parse(storage.getItem(GARAGE_KEY)),mission);}catch{return emptyGarage();}
}

export function saveGarage(state,storage,mission) {
  try{storage.setItem(GARAGE_KEY,JSON.stringify(normalizeGarage(state,mission)));return true;}catch{return false;}
}

export function buyItem(state,itemId) {
  const next=normalizeGarage(state),item=itemById(itemId);
  if(!item)return {state:next,ok:false,reason:'unknown'};
  if(next.owned.includes(itemId))return {state:next,ok:false,reason:'owned'};
  if(item.unlockOnly||item.price===null)return {state:next,ok:false,reason:'unlock-only'};
  if(next.coins<item.price)return {state:next,ok:false,reason:'insufficient'};
  next.coins-=item.price;next.owned.push(itemId);
  if(item.kind==='vehicle'&&next.wish===item.value)next.wish=null;
  return {state:next,ok:true,reason:null};
}

export function equipItem(state,itemId) {
  const next=normalizeGarage(state),item=itemById(itemId);
  if(!item)return {state:next,ok:false,reason:'unknown'};
  if(!next.owned.includes(itemId))return {state:next,ok:false,reason:'unowned'};
  next.equipped[item.kind]=item.value;
  return {state:next,ok:true,reason:null};
}

export function setWish(state,vehicleId) {
  const next=normalizeGarage(state),vehicle=VEHICLES.find(item=>item.id===vehicleId&&!item.unlockOnly);
  if(vehicleId===null)next.wish=null;
  else if(vehicle)next.wish=next.owned.includes(`vehicle-${vehicleId}`)?null:vehicleId;
  return next;
}

// Other mini-games call this only after their own complete-round condition.
// Sharing one ledger prevents switching games to bypass the daily replay limit. The answer bonus
// follows accuracy, not round length, so a perfect round pays the same in every game (15 + 10).
export function awardMiniGame(state,{game,total,correct,completed=false,automatic=false,now=Date.now(),roundId}={}) {
  const next=normalizeGarage(state),date=seoulDate(now),breakdown=[];
  const noReward=reason=>({state:next,coins:0,breakdown,reason});
  if(automatic)return noReward('automatic');
  if(completed!==true||!Number.isInteger(total)||total<1||total>10000||!Number.isInteger(correct)||correct<0||correct>total)return noReward('unfinished');
  if(!MINI_GAMES.includes(game)||!safeKey(roundId))return noReward('invalid-round');
  if(Object.hasOwn(next.rewardedRounds,roundId))return noReward('duplicate-round');
  const count=next.dailyRaceCounts[date]||0,open=count<REWARDS.dailyRaceLimit;
  if(open){
    breakdown.push({id:'finish',label:'미니게임 완주',coins:REWARDS.finish});
    const bonus=Math.round(REWARDS.miniGameAccuracy*correct/total);
    if(bonus>0)breakdown.push({id:'correct',label:'정답 보상',coins:bonus});
  }
  next.dailyRaceCounts[date]=count+1;
  const coins=breakdown.reduce((sum,line)=>sum+line.coins,0);
  next.coins=Math.min(1_000_000_000,next.coins+coins);next.totalEarned=Math.min(1_000_000_000,next.totalEarned+coins);
  next.rewardedRounds[roundId]={date,coins};
  return {state:next,coins,breakdown,reason:open?null:'daily-limit'};
}
