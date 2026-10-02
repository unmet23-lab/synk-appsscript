// Local cosmetic collection. It changes appearance, never course physics or listening evidence.
export const SHOP_STORAGE_KEY='synk.windrun.shop.v1';
export const WELCOME_STARS=60;
export const COMPLETION_STARS=20;
const MAX_WALLET=1_000_000,MAX_ROUND_COINS=10_000,MAX_ROUND_DISTANCE=10_000_000,MAX_ROUND_HISTORY=1024;
const MAX_TOTAL=1_000_000_000,MAX_RUNS=1_000_000;
// These milestones reward travelling and collecting, not Korean proficiency.
export const GOALS=Object.freeze([
  {id:'distance-150',name:'첫 발걸음',metric:'distance',target:150,unit:'m',reward:10},
  {id:'stars-10',name:'작은 별 모으기',metric:'stars',target:10,unit:'별',reward:10},
  {id:'complete-1',name:'첫 등불 여행',metric:'completions',target:1,unit:'회',reward:15},
  {id:'distance-1500',name:'마을 한 바퀴',metric:'distance',target:1500,unit:'m',reward:15},
  {id:'stars-30',name:'반짝이는 주머니',metric:'stars',target:30,unit:'별',reward:15},
  {id:'complete-3',name:'세 번의 등불 여행',metric:'completions',target:3,unit:'회',reward:20}
].map(Object.freeze));
const GOAL_IDS=new Set(GOALS.map(goal=>goal.id));
export const CATEGORIES=Object.freeze([
  {id:'trail',name:'달리기 자취'},
  {id:'lantern',name:'등불 꾸미기'},
  {id:'companion',name:'동행 친구'},
  {id:'scenery',name:'코스 풍경'},
  {id:'finish',name:'완주 연출'}
].map(Object.freeze));
const goods=(category,style,name,description,price)=>Object.freeze({id:category+':'+style,category,style,name,description,price});
export const CATALOG=Object.freeze([
  goods('trail','none','자취 없이','몽글의 가벼운 발걸음 그대로.',0),
  goods('trail','petals','꽃잎 자취','발걸음 뒤로 작은 꽃잎이 흩날려요.',35),
  goods('trail','starlight','별빛 자취','뒤따라오는 은은한 별빛을 남겨요.',55),
  goods('trail','footprints','폭신 발자국','길 위에 포근한 발자국을 남겨요.',40),
  goods('lantern','paper','한지 등불','부탁을 해내면 따뜻한 등불이 켜져요.',0),
  goods('lantern','flower','꽃등','성공한 부탁을 작은 꽃등으로 밝혀요.',40),
  goods('lantern','firefly','반딧불 등불','등불 속 반딧불이 반짝여요.',60),
  goods('companion','none','혼자 달리기','몽글과 바람길을 가볍게 여행해요.',0),
  goods('companion','sparrow','작은 참새','옆에서 종종 날아오는 작은 친구예요.',70),
  goods('companion','cloud','아기 구름','폭신한 구름 친구가 함께 달려요.',85),
  goods('scenery','village','바람 마을','한옥과 강이 있는 익숙한 바람길이에요.',0),
  goods('scenery','blossom','벚꽃길','연분홍 봄빛으로 마을을 바꿔요.',80),
  goods('scenery','snow','눈꽃 마을','하얀 눈과 맑은 겨울빛을 만나 보세요.',95),
  goods('scenery','moonlight','달빛 축제','은은한 달빛과 축제의 밤을 달려요.',120),
  goods('finish','simple','몽글 인사','여행을 마치고 몽글이 인사해요.',0),
  goods('finish','flowers','꽃비 인사','마지막 인사 위로 꽃잎이 내려요.',45),
  goods('finish','stars','별빛 포즈','반짝이는 별과 완주를 기념해요.',60),
  goods('finish','festival','축제의 밤','따뜻한 축제의 빛으로 여행을 마무리해요.',90)
]);
const BY_ID=new Map(CATALOG.map(item=>[item.id,item]));
const DEFAULTS=Object.freeze(Object.fromEntries(CATALOG.filter(item=>item.price===0).map(item=>[item.category,item.style])));
const FREE_IDS=CATALOG.filter(item=>item.price===0).map(item=>item.id);
const bounded=(value,max)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,Math.floor(value))):0;
const distanceValue=(value,max=MAX_TOTAL)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,value)):0;
const validRound=id=>typeof id==='string'&&id.length>0&&id.length<=96&&/^[a-zA-Z0-9._:-]+$/.test(id);
const clone=value=>({version:1,wallet:value.wallet,owned:[...value.owned],equipped:{...value.equipped},settled:[...value.settled],wishlist:value.wishlist,progress:{...value.progress,claimed:[...value.progress.claimed]}});
function freshProgress(){return{distance:0,stars:0,runs:0,completions:0,claimed:[]};}
function normalizedProgress(value){return{
  distance:distanceValue(value?.distance),stars:bounded(value?.stars,MAX_TOTAL),runs:bounded(value?.runs,MAX_RUNS),completions:bounded(value?.completions,MAX_RUNS),
  claimed:[...new Set((Array.isArray(value?.claimed)?value.claimed:[]).filter(id=>GOAL_IDS.has(id)))]
};}
export function goalProgress(state){
  const stats=normalizedProgress(state?.progress);
  return GOALS.map(goal=>{const total=stats[goal.metric];return{...goal,current:Math.min(goal.target,Math.floor(total)),claimed:stats.claimed.includes(goal.id),complete:total>=goal.target,progress:Math.min(1,total/goal.target)};});
}
function fresh(wallet=WELCOME_STARS){return{version:1,wallet,owned:[...FREE_IDS],equipped:{...DEFAULTS},settled:[],wishlist:null,progress:freshProgress()};}
function sanitize(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)return fresh(0);
  const state=fresh(bounded(value.wallet,MAX_WALLET));
  for(const id of Array.isArray(value.owned)?value.owned:[])if(BY_ID.has(id)&&!state.owned.includes(id))state.owned.push(id);
  for(const category of CATEGORIES){
    const style=value.equipped?.[category.id],id=category.id+':'+style;
    if(BY_ID.has(id)&&state.owned.includes(id))state.equipped[category.id]=style;
  }
  state.settled=[...new Set((Array.isArray(value.settled)?value.settled:[]).filter(validRound))].slice(-MAX_ROUND_HISTORY);
  const wish=BY_ID.get(value.wishlist);
  if(wish&&wish.price>0&&!state.owned.includes(wish.id))state.wishlist=wish.id;
  state.progress=normalizedProgress(value.progress);
  return state;
}
function defaultStorage(){try{return globalThis.localStorage||null;}catch{return null;}}
export class ShopStore{
  constructor({storage=defaultStorage(),storageKey=SHOP_STORAGE_KEY}={}){
    this.storage=storage;this.storageKey=storageKey;this.available=false;this._state=fresh(0);
    try{
      if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')return;
      const raw=storage.getItem(storageKey);
      this._state=raw===null?fresh():this._decode(raw);
      // Save welcome stars and repaired data before any transaction is allowed.
      storage.setItem(storageKey,JSON.stringify(this._state));this.available=true;
    }catch{this.available=false;}
  }
  _decode(raw){try{return sanitize(JSON.parse(raw));}catch{return fresh(0);}}
  snapshot(){return{...clone(this._state),available:this.available};}
  get state(){return this.snapshot();}
  _refresh(){
    try{
      if(!this.storage||typeof this.storage.getItem!=='function'||typeof this.storage.setItem!=='function')throw new Error('storage');
      const raw=this.storage.getItem(this.storageKey);
      // A record removed while this instance is alive does not award a second welcome grant.
      if(raw!==null)this._state=this._decode(raw);
      this.available=true;return true;
    }catch{this.available=false;return false;}
  }
  _commit(next,details={}){
    try{
      this.storage.setItem(this.storageKey,JSON.stringify(next));this._state=next;this.available=true;
      return{ok:true,...details,state:this.snapshot()};
    }catch{this.available=false;return{ok:false,reason:'storage-unavailable',state:this.snapshot()};}
  }
  _fail(reason,details={}){return{ok:false,reason,...details,state:this.snapshot()};}
  buy(itemId){
    const item=BY_ID.get(itemId);if(!item)return this._fail('unknown-item');
    if(!this._refresh())return this._fail('storage-unavailable');
    if(this._state.owned.includes(item.id))return this._fail('already-owned');
    if(this._state.wallet<item.price)return this._fail('insufficient-stars',{missing:item.price-this._state.wallet});
    const next=clone(this._state);next.wallet-=item.price;next.owned.push(item.id);next.equipped[item.category]=item.style;
    if(next.wishlist===item.id)next.wishlist=null;
    return this._commit(next,{itemId:item.id,spent:item.price});
  }
  setWishlist(itemId){
    const item=itemId===null?null:BY_ID.get(itemId);
    if(itemId!==null&&!item)return this._fail('unknown-item');
    if(!this._refresh())return this._fail('storage-unavailable');
    if(item&&item.price===0)return this._fail('not-purchasable');
    if(item&&this._state.owned.includes(item.id))return this._fail('already-owned');
    if(this._state.wishlist===itemId)return{ok:true,changed:false,state:this.snapshot()};
    const next=clone(this._state);next.wishlist=itemId;
    return this._commit(next,{changed:true});
  }
  equip(itemId){
    const item=BY_ID.get(itemId);if(!item)return this._fail('unknown-item');
    if(!this._refresh())return this._fail('storage-unavailable');
    if(!this._state.owned.includes(item.id))return this._fail('not-owned');
    if(this._state.equipped[item.category]===item.style)return{ok:true,changed:false,state:this.snapshot()};
    const next=clone(this._state);next.equipped[item.category]=item.style;
    return this._commit(next,{itemId:item.id,changed:true});
  }
  settleRun({roundId,coins=0,distance=0,completed=false,automatic=false}={}){
    const noReward={earned:0,coins:0,bonus:0,completionBonus:0,goalBonus:0,goalsUnlocked:[]};
    if(automatic===true)return{ok:true,...noReward,automatic:true,state:this.snapshot()};
    if(!validRound(roundId))return this._fail('invalid-round');
    if(!this._refresh())return this._fail('storage-unavailable');
    if(this._state.settled.includes(roundId))return{ok:true,...noReward,duplicate:true,state:this.snapshot()};
    const collected=bounded(coins,MAX_ROUND_COINS),travelled=distanceValue(distance,MAX_ROUND_DISTANCE),next=clone(this._state);
    next.progress.distance=Math.min(MAX_TOTAL,next.progress.distance+travelled);
    next.progress.stars=Math.min(MAX_TOTAL,next.progress.stars+collected);
    next.progress.runs=Math.min(MAX_RUNS,next.progress.runs+1);
    next.progress.completions=Math.min(MAX_RUNS,next.progress.completions+(completed===true?1:0));
    let remaining=MAX_WALLET-next.wallet;
    const paidCoins=Math.min(collected,remaining);remaining-=paidCoins;
    const completionBonus=Math.min(completed===true?COMPLETION_STARS:0,remaining);remaining-=completionBonus;
    const goalsUnlocked=[];
    for(const goal of GOALS){
      if(next.progress.claimed.includes(goal.id)||next.progress[goal.metric]<goal.target||remaining<goal.reward)continue;
      next.progress.claimed.push(goal.id);goalsUnlocked.push({id:goal.id,name:goal.name,reward:goal.reward});remaining-=goal.reward;
    }
    const goalBonus=goalsUnlocked.reduce((sum,goal)=>sum+goal.reward,0),earned=paidCoins+completionBonus+goalBonus;
    next.wallet+=earned;next.settled.push(roundId);next.settled=next.settled.slice(-MAX_ROUND_HISTORY);
    return this._commit(next,{earned,coins:paidCoins,collected,distance:travelled,bonus:completionBonus,completionBonus,goalBonus,goalsUnlocked,completed:completed===true});
  }
}
