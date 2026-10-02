// Reproducible engine strategies, not observed players or evidence of learning.
// This script writes only a QA report and settles every hypothetical run in memory.
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {RunnerModel,driveDemo} from '../core.mjs';
import {ShopStore,CATALOG,GOALS,WELCOME_STARS,COMPLETION_STARS} from '../shop.mjs';

class MemoryStorage{
  data=new Map();
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){this.data.set(key,String(value));}
}
function missEveryThirdRequest(model){
  const step=model.currentStep,mission=model.currentMission;
  if(!step||!mission||(mission.index+1)%3!==0){driveDemo(model);return;}
  // Force a missed action so a coincidentally correct standing lane cannot hide the omission.
  if(step.action==='lane'){
    const wrongLane=step.target===1?0:1;
    while(model.lane!==wrongLane)model.input(model.lane<wrongLane?'right':'left');
  }else if(step.action==='stay'){
    const remaining=step.d-model.distance;
    if(remaining>0&&remaining<model.speed*.32&&model.y===0)model.input('jump');
  }
  // For jump/slide requests, stay on the ground without the required action.
}
const profiles=[
  {id:'no-input',name:'아무 조작 없음',description:'입력을 하지 않고 가운데 길로 계속 달리는 하한 전략.',drive:()=>{}},
  {id:'every-third-request-missed',name:'매 세 번째 부탁 동작 놓침',description:'나머지 부탁·일반 장애물은 driveDemo로 처리하고, 매 세 번째 부탁의 모든 동작을 의도적으로 놓치는 전략.',drive:missEveryThirdRequest},
  {id:'ideal-drive-demo',name:'모든 동작을 아는 이상적 전략',description:'driveDemo가 지시·표시선·장애물을 알고 조작하는 이상적 상한 전략.',drive:driveDemo}
];
const startingItem=CATALOG.find(item=>item.id==='trail:petals'),sparrow=CATALOG.find(item=>item.id==='companion:sparrow');
const DT=.01,ROUNDS=3,SEEDS=10;
const rounded=value=>Number(value.toFixed(3));
function range(values){return{min:rounded(Math.min(...values)),max:rounded(Math.max(...values)),mean:rounded(values.reduce((sum,value)=>sum+value,0)/values.length)};}
function run(profile,seed){
  const model=new RunnerModel({mode:'tour',learning:'listen',seed});
  for(let tick=0;tick<10000&&!model.finished;tick++){profile.drive(model);model.step(DT);model.drain();}
  assert.equal(model.finished,true,'each strategy must finish by collision or the 90-second limit');
  return model;
}
function simulate(profile,baseSeed){
  const shop=new ShopStore({storage:new MemoryStorage()});
  assert.equal(shop.buy(startingItem.id).ok,true);assert.equal(shop.state.wallet,WELCOME_STARS-startingItem.price);
  let v5Wallet=shop.state.wallet,firstSparrowRound=null,v5FirstSparrowRound=null;
  const rounds=[];
  for(let round=1;round<=ROUNDS;round++){
    const seed=baseSeed+(round-1)*1000,model=run(profile,seed),completed=model.reason==='tour';
    // Counterfactual manual-play accounting: real in-game automatic demos still receive zero.
    const reward=shop.settleRun({roundId:`balance:${profile.id}:${baseSeed}:${round}`,coins:model.coins,distance:model.distance,completed,automatic:false});
    assert.equal(reward.ok,true);assert.equal(reward.earned,reward.coins+reward.completionBonus+reward.goalBonus);
    v5Wallet+=model.coins+(completed?COMPLETION_STARS:0);
    if(firstSparrowRound===null&&shop.state.wallet>=sparrow.price)firstSparrowRound=round;
    if(v5FirstSparrowRound===null&&v5Wallet>=sparrow.price)v5FirstSparrowRound=round;
    rounds.push({round,seed,durationSeconds:rounded(model.elapsed),distanceMeters:rounded(model.distance),reason:model.reason,
      collectedStars:model.coins,completionBonus:reward.completionBonus,goalBonus:reward.goalBonus,earnedStars:reward.earned,
      walletAfter:shop.state.wallet,v5WalletAfter:v5Wallet,goalsUnlocked:reward.goalsUnlocked,
      requestsResolved:model.answers.length,requestsPerformed:model.correct,lanterns:model.lanterns,heartsRemaining:model.hearts});
  }
  return{baseSeed,firstSparrowRound,v5FirstSparrowRound,rounds,finalWallet:shop.state.wallet,v5FinalWallet:v5Wallet,progress:shop.state.progress};
}
function firstPurchaseSummary(samples,key){
  const reached=samples.map(sample=>sample[key]).filter(value=>value!==null);
  return{round1:samples.filter(sample=>sample[key]===1).length,round2:samples.filter(sample=>sample[key]===2).length,
    round3:samples.filter(sample=>sample[key]===3).length,notWithinThree:samples.filter(sample=>sample[key]===null).length,
    reachedRoundRange:reached.length?{min:Math.min(...reached),max:Math.max(...reached)}:null,
    unreachedSeeds:samples.filter(sample=>sample[key]===null).map(sample=>sample.baseSeed)};
}
const results=profiles.map(profile=>{
  const samples=Array.from({length:SEEDS},(_,i)=>simulate(profile,i+1)),allRounds=samples.flatMap(sample=>sample.rounds);
  const goalCounts=GOALS.map(goal=>({id:goal.id,name:goal.name,reward:goal.reward,seedsUnlocked:samples.filter(sample=>sample.progress.claimed.includes(goal.id)).length}));
  return{id:profile.id,name:profile.name,description:profile.description,summary:{
    roundDurationSeconds:range(allRounds.map(round=>round.durationSeconds)),
    collectedStarsAcrossThree:range(samples.map(sample=>sample.rounds.reduce((sum,round)=>sum+round.collectedStars,0))),
    completionBonusAcrossThree:range(samples.map(sample=>sample.rounds.reduce((sum,round)=>sum+round.completionBonus,0))),
    goalBonusAcrossThree:range(samples.map(sample=>sample.rounds.reduce((sum,round)=>sum+round.goalBonus,0))),
    earnedStarsAcrossThree:range(samples.map(sample=>sample.rounds.reduce((sum,round)=>sum+round.earnedStars,0))),
    finalWallet:range(samples.map(sample=>sample.finalWallet)),v5FinalWallet:range(samples.map(sample=>sample.v5FinalWallet)),
    totalDurationSeconds:range(samples.map(sample=>sample.rounds.reduce((sum,round)=>sum+round.durationSeconds,0))),
    completedRoundsAcrossThirty:allRounds.filter(round=>round.reason==='tour').length,
    sparrow:firstPurchaseSummary(samples,'firstSparrowRound'),v5Sparrow:firstPurchaseSummary(samples,'v5FirstSparrowRound'),goalCounts,
    perRound:Array.from({length:ROUNDS},(_,index)=>{const rounds=samples.map(sample=>sample.rounds[index]);return{round:index+1,
      durationSeconds:range(rounds.map(round=>round.durationSeconds)),collectedStars:range(rounds.map(round=>round.collectedStars)),
      goalBonus:range(rounds.map(round=>round.goalBonus)),earnedStars:range(rounds.map(round=>round.earnedStars)),
      walletAfter:range(rounds.map(round=>round.walletAfter)),v5WalletAfter:range(rounds.map(round=>round.v5WalletAfter))};})
  },samples};
});
const sourceHashes={};
for(const name of ['core.mjs','shop.mjs','instructions.mjs'])sourceHashes[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
const report={date:'2026-10-02',kind:'engine-strategy-simulation',humanPlayEvidence:false,learningEffectEvidence:false,
  method:{seeds:SEEDS,roundsPerSeed:ROUNDS,profiles:profiles.length,totalRuns:SEEDS*ROUNDS*profiles.length,dtSeconds:DT,nodeVersion:process.version,
    seedSchedule:'baseSeed 1..10; round seed = baseSeed + (round - 1) * 1000',mode:'tour',instructions:'RunnerModel default order; no Atlas learner record injected',
    storage:'MemoryStorage only; browser storage, actual game saves, prices and physics unchanged',
    settlement:'Hypothetical direct-play rules (automatic:false); actual in-game automatic demonstrations remain unrewarded',
    baseline:'Same collected stars and +20 completion bonus; v5 without cumulative goal rewards',sourceHashes},
  initial:{welcomeStars:WELCOME_STARS,purchasedItem:startingItem.id,spentStars:startingItem.price,walletAfterPurchase:WELCOME_STARS-startingItem.price,
    targetItem:sparrow.id,targetPrice:sparrow.price,starsStillNeeded:sparrow.price-(WELCOME_STARS-startingItem.price)},
  limitations:[
    'These are deterministic code strategies, not people, novice observations or a player population estimate.',
    'The ideal strategy reads model instructions and obstacles; the middle strategy forces omissions. Neither measures Korean listening skill.',
    'Audio perception, reaction delays, real-device controls, frame performance and personalized Atlas scheduling are not simulated.',
    'Results describe only the first three hypothetical manual runs after one flower-trail purchase; no real-money conversion or learning outcome is claimed.'
  ],profiles:results};
await writeFile(new URL('./v6-balance.json',import.meta.url),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({report:'qa/v6-balance.json',totalRuns:report.method.totalRuns,profiles:results.map(profile=>({id:profile.id,
  finalWallet:profile.summary.finalWallet,v5FinalWallet:profile.summary.v5FinalWallet,goalBonus:profile.summary.goalBonusAcrossThree,
  sparrow:profile.summary.sparrow,v5Sparrow:profile.summary.v5Sparrow}))},null,2));
