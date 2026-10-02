import { WORDS, STAGES, WORD_BY_ID } from './learning.js';
import { CAMPAIGN, CHALLENGE_BY_ID } from './campaign.js';
import { FINALE_QUESTION_BY_ID } from './finales.js';

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
const catalogue = (kind,items) => items.map(item=>({...item,id:`${kind}-${item.id}`,kind,value:item.id}));
export const SHOP_ITEMS = [
  ...catalogue('vehicle',VEHICLES),...catalogue('paint',PAINTS),
  ...catalogue('wheels',WHEELS).map(item=>item.value==='blossom'?{...item,id:'wheel-blossom'}:item),
  ...catalogue('trail',TRAILS),badge
];
export const FINALE_REWARDS = Object.freeze({1:'paint-aurora',2:'wheel-blossom',3:'trail-starlight',4:'badge-coast',5:'paint-sunset',6:'vehicle-finale'});
const BY_ID = Object.fromEntries(SHOP_ITEMS.map(item=>[item.id,item]));
const itemById = id => typeof id==='string'&&Object.hasOwn(BY_ID,id)?BY_ID[id]:null;
const FREE_ITEMS = SHOP_ITEMS.filter(item=>item.price===0).map(item=>item.id);
const DEFAULT_EQUIPMENT = {vehicle:'coast',paint:'mint',wheels:'silver',trail:'lime',badge:null};
const REWARDS = Object.freeze({finish:15,correct:2,firstClear:10,correction:5,mission:15,dailyRaceLimit:10});
const QUESTION_BY_ID = {...CHALLENGE_BY_ID,...FINALE_QUESTION_BY_ID};
const integer = (value,fallback=0,max=1_000_000_000) => typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,Math.floor(value))):fallback;
const object = value => value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const safeKey = key => typeof key==='string'&&key.length>0&&key.length<=180&&!['__proto__','prototype','constructor'].includes(key);
const boolRecord = value => Object.fromEntries(Object.entries(object(value)).filter(([key,flag])=>safeKey(key)&&flag===true));
const knownItem = (kind,value) => SHOP_ITEMS.find(item=>item.kind===kind&&item.value===value);
const validTime = now => typeof now==='number'&&Number.isFinite(now)?now:Date.now();
export const seoulDate = (now=Date.now()) => new Date(validTime(now)+9*60*60*1000).toISOString().slice(0,10);

export const emptyGarage = () => ({
  version:1,coins:0,totalEarned:0,owned:[...FREE_ITEMS],equipped:{...DEFAULT_EQUIPMENT},
  wish:'open',rewardedRounds:{},firstClears:{},corrections:{},dailyRaceCounts:{},missions:{}
});

function normalizeGarage(saved) {
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
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!m||!['correction','first-clear'].includes(m.kind)||!safeKey(m.target))continue;
    const validTarget=m.kind==='first-clear'?CAMPAIGN.some(stage=>stage.id===m.target):m.collection==='campaign'?!!QUESTION_BY_ID[m.target]:WORDS.some(word=>word.id===m.target);
    if(!validTarget)continue;
    result.missions[day]={...missionFor(day,m.kind,m.target,m.collection),completed:m.completed===true,completedAt:integer(m.completedAt,0,Number.MAX_SAFE_INTEGER)};
  }
  return result;
}

export function loadGarage(storage) {
  try{return normalizeGarage(JSON.parse(storage.getItem(GARAGE_KEY)));}catch{return emptyGarage();}
}

export function saveGarage(state,storage) {
  try{storage.setItem(GARAGE_KEY,JSON.stringify(normalizeGarage(state)));return true;}catch{return false;}
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

function missionFor(date,kind,target,collection='campaign') {
  if(kind==='correction'){
    const item=collection==='campaign'?QUESTION_BY_ID[target]:WORD_BY_ID[target];
    return {id:`${date}:correction:${collection}:${target}`,date,kind,target,collection,
      title:'놓친 힌트를 다시 잡아요',description:collection==='campaign'?`놓쳤던 “${item.prompt}”를 다시 맞혀요.`:`놓쳤던 “${item.word}”를 다시 맞혀요.`,reward:REWARDS.mission,completed:false,completedAt:0};
  }
  const stage=CAMPAIGN.find(s=>s.id===target);
  return {id:`${date}:first-clear:${target}`,date,kind,target,collection:'campaign',
    title:'새로운 길을 열어요',description:`“${stage.title}”에서 5문제 중 4문제 이상 맞혀 첫 통과해요.`,reward:REWARDS.mission,completed:false,completedAt:0};
}

export function dailyMission(progress={},now=Date.now(),garage) {
  const date=seoulDate(now),record=garage?.missions?.[date];
  if(record)return {...record};
  const errors=[
    ...Object.entries(object(progress.challenges)).filter(([id,p])=>QUESTION_BY_ID[id]&&p?.lastCorrect===false&&p.wrong>0).map(([id,p])=>({id,collection:'campaign',lastAt:integer(p.lastAt,0,Number.MAX_SAFE_INTEGER)})),
    ...Object.entries(object(progress.words)).filter(([id,p])=>WORDS.some(w=>w.id===id)&&p?.lastCorrect===false&&p.wrong>0).map(([id,p])=>({id,collection:'words',lastAt:integer(p.lastAt,0,Number.MAX_SAFE_INTEGER)}))
  ].sort((a,b)=>b.lastAt-a.lastAt||a.id.localeCompare(b.id));
  if(errors.length)return missionFor(date,'correction',errors[0].id,errors[0].collection);
  const next=CAMPAIGN.find(stage=>progress.stages?.[stage.id]?.cleared!==true);
  if(next)return missionFor(date,'first-clear',next.id);
  // A complete campaign still has a useful daily retrieval goal. Use a real
  // previously studied item rather than inventing another first-clear reward.
  const practiced=CAMPAIGN.flatMap(stage=>stage.items).sort((a,b)=>(progress.challenges?.[a.id]?.lastAt||0)-(progress.challenges?.[b.id]?.lastAt||0));
  return missionFor(date,'correction',practiced[0].id,'campaign');
}

function completeAnswers(stage,answers) {
  if(!stage||!safeKey(stage.id)||!Array.isArray(answers))return false;
  const expected=stage.campaign?stage.items?.map(q=>q.id):stage.words;
  if(!Array.isArray(expected)||expected.length===0||answers.length!==expected.length)return false;
  const ids=answers.map(a=>stage.campaign?a?.id:a?.answer);
  return ids.every((id,i)=>expected.includes(id)&&typeof answers[i]?.correct==='boolean')&&new Set(ids).size===expected.length;
}

export function awardRace(state,stage,answers,{automatic=false,beforeProgress={},now=Date.now(),roundId}={}) {
  const next=normalizeGarage(state),date=seoulDate(now),breakdown=[],newUnlocks=[];
  const noReward=reason=>({state:next,coins:0,breakdown,missionCompleted:false,newUnlocks,reason});
  // Keep this flag sticky for demos where a player takes over mid-race.
  if(automatic)return noReward('automatic');
  if(!completeAnswers(stage,answers))return noReward('unfinished');
  const token=roundId??`${date}:${stage.id}:${integer(beforeProgress.rounds)}`;
  if(!safeKey(token))return noReward('invalid-round');
  if(Object.hasOwn(next.rewardedRounds,token))return noReward('duplicate-round');
  const add=(id,label,coins)=>{if(coins>0)breakdown.push({id,label,coins});};
  const correct=answers.filter(a=>a.correct).length,total=answers.length,cleared=correct>=Math.ceil(total*.8);
  const dailyCount=next.dailyRaceCounts[date]||0;
  if(dailyCount<REWARDS.dailyRaceLimit){
    add('finish','레이스 완주',REWARDS.finish);add('correct','정답 보상',correct*REWARDS.correct);
  }
  next.dailyRaceCounts[date]=dailyCount+1;
  const wasCleared=beforeProgress.stages?.[stage.id]?.cleared===true||next.firstClears[stage.id]===true;
  if(cleared&&!stage.review){
    if(!wasCleared)add('first-clear','새 코스 첫 통과',REWARDS.firstClear);
    next.firstClears[stage.id]=true;
  }
  let recovered=0;
  for(const answer of answers){
    const id=stage.campaign?answer.id:answer.answer,kind=stage.campaign?'campaign':'words';
    const previous=beforeProgress[kind==='campaign'?'challenges':'words']?.[id],key=`${kind}:${id}`;
    if(answer.correct&&previous?.lastCorrect===false&&previous.wrong>0&&!next.corrections[key]){
      next.corrections[key]=true;recovered++;
    }
  }
  add('correction','놓친 표현 다시 맞히기',recovered*REWARDS.correction);
  const mission=next.missions[date]||dailyMission(beforeProgress,now);
  next.missions[date]={...mission};
  const fulfillsMission=mission.kind==='first-clear'
    ?mission.target===stage.id&&cleared&&!wasCleared
    :answers.some(a=>a.correct&&(stage.campaign?'campaign':'words')===mission.collection&&(stage.campaign?a.id:a.answer)===mission.target);
  const missionCompleted=!mission.completed&&fulfillsMission;
  if(missionCompleted){
    next.missions[date].completed=true;next.missions[date].completedAt=integer(validTime(now),0,Number.MAX_SAFE_INTEGER);
    add('mission','오늘의 미션',REWARDS.mission);
  }
  if(stage.finale&&cleared){
    const itemId=FINALE_REWARDS[stage.chapter];
    if(itemId&&!next.owned.includes(itemId)){next.owned.push(itemId);newUnlocks.push(itemId);}
  }
  const coins=breakdown.reduce((sum,line)=>sum+line.coins,0);
  next.coins=Math.min(1_000_000_000,next.coins+coins);next.totalEarned=Math.min(1_000_000_000,next.totalEarned+coins);
  next.rewardedRounds[token]={date,coins};
  return {state:next,coins,breakdown,missionCompleted,newUnlocks,mission:{...next.missions[date]},reason:null};
}

// Other mini-games call this only after their own complete-round condition.
// Sharing one ledger prevents switching games to bypass the daily replay limit.
export function awardMiniGame(state,{game,total,correct,completed=false,automatic=false,now=Date.now(),roundId}={}) {
  const next=normalizeGarage(state),date=seoulDate(now),breakdown=[];
  const noReward=reason=>({state:next,coins:0,breakdown,reason});
  if(automatic)return noReward('automatic');
  if(completed!==true||!Number.isInteger(total)||total<1||total>10000||!Number.isInteger(correct)||correct<0||correct>total)return noReward('unfinished');
  if(!['rhythm','runner'].includes(game)||!safeKey(roundId))return noReward('invalid-round');
  if(Object.hasOwn(next.rewardedRounds,roundId))return noReward('duplicate-round');
  const count=next.dailyRaceCounts[date]||0;
  if(count<REWARDS.dailyRaceLimit){
    breakdown.push({id:'finish',label:'미니게임 완주',coins:REWARDS.finish});
    if(correct>0)breakdown.push({id:'correct',label:'정답 보상',coins:correct*REWARDS.correct});
  }
  next.dailyRaceCounts[date]=count+1;
  const coins=breakdown.reduce((sum,line)=>sum+line.coins,0);
  next.coins=Math.min(1_000_000_000,next.coins+coins);next.totalEarned=Math.min(1_000_000_000,next.totalEarned+coins);
  next.rewardedRounds[roundId]={date,coins};
  return {state:next,coins,breakdown,reason:null};
}
