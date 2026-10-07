import { WORDS, STAGES, WORD_BY_ID, josa } from './learning.js';
import { CAMPAIGN, CHALLENGE_BY_ID } from './campaign.js';
import { FINALE_QUESTION_BY_ID } from './finales.js';
import {FINALE_REWARDS,REWARDS,integer,object,safeKey,validTime,seoulDate,normalizeGarage,loadGarage as loadLedger,saveGarage as saveLedger} from './garage-core.js';

// Racing's part of the shared collection: daily missions and the race reward. The ledger itself
// (items, wallet, equipment, the mini-game reward) is garage-core.js, which mini-games load alone.
export {GARAGE_KEY,VEHICLES,PAINTS,WHEELS,TRAILS,RACKETS,BALLS,SHOP_ITEMS,FINALE_REWARDS,MINI_GAMES,seoulDate,emptyGarage,buyItem,equipItem,setWish,awardMiniGame} from './garage-core.js';
const QUESTION_BY_ID = {...CHALLENGE_BY_ID,...FINALE_QUESTION_BY_ID};

// A stored mission is kept only if its course or word still exists, and is rebuilt from racing's data.
function racingMission(day,m) {
  const validTarget=m.kind==='first-clear'?CAMPAIGN.some(stage=>stage.id===m.target):m.collection==='campaign'?!!QUESTION_BY_ID[m.target]:WORDS.some(word=>word.id===m.target);
  if(!validTarget)return null;
  return {...missionFor(day,m.kind,m.target,m.collection),completed:m.completed===true,completedAt:integer(m.completedAt,0,Number.MAX_SAFE_INTEGER)};
}

export function loadGarage(storage) { return loadLedger(storage,racingMission); }

export function saveGarage(state,storage) { return saveLedger(state,storage,racingMission); }

function missionFor(date,kind,target,collection='campaign') {
  if(kind==='correction'){
    const item=collection==='campaign'?QUESTION_BY_ID[target]:WORD_BY_ID[target],label=collection==='campaign'?item.prompt:item.word;
    return {id:`${date}:correction:${collection}:${target}`,date,kind,target,collection,
      title:'놓친 힌트를 다시 잡아요',description:`놓쳤던 “${label}”${josa(label,'을','를')} 다시 맞혀요.`,reward:REWARDS.mission,completed:false,completedAt:0};
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
  const next=normalizeGarage(state,racingMission),date=seoulDate(now),breakdown=[],newUnlocks=[];
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
