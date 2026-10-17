import test from 'node:test';
import assert from 'node:assert/strict';
import { BEGINNER_ITEMS } from '../korean-racing/beginner-catalog.js';
import { emptyGarage,normalizeGarage,setBeginnerGoal,beginnerProgress,buyItem,equipItem,awardBeginnerPractice,awardMiniGame } from '../korean-racing/garage-core.js';

const now=Date.UTC(2026,9,9,4);
const actions=[['grow','bear'],['shrink','bear'],['open','chest']].map(([spell,objectId])=>({spell,objectId,heard:true,changed:true}));
const practice={game:'word-magic',completed:true,actions,now};
const funded=coins=>({...emptyGarage(),coins,totalEarned:coins});

test('goals are opt-in, game-specific and independent from the existing Order Rush goal',()=>{
 const initial=emptyGarage();initial.gameWishes['order-rush']='order-rush-style-mint';
 assert.equal(beginnerProgress(initial,'order-rush').goal,null);
 assert.equal(setBeginnerGoal(initial,'order-rush','magic-toys-picnic').reason,'invalid-item');
 assert.equal(setBeginnerGoal(initial,'order-rush','order-stall-default').reason,'invalid-item');
 assert.equal(setBeginnerGoal(initial,'order-rush','order-rush-style-mint').reason,'invalid-item');
 assert.equal(setBeginnerGoal(initial,'runner','magic-toys-picnic').reason,'unknown-game');
 const chosen=setBeginnerGoal(initial,'order-rush','order-playset-picnic');assert(chosen.ok);
 assert.equal(chosen.state.gameWishes['order-rush'],'order-rush-style-mint');
 assert.equal(beginnerProgress(chosen.state,'order-rush').remaining,15);
 assert.equal(initial.beginnerWishes['order-rush'],undefined,'does not mutate caller state');
 assert.equal(beginnerProgress(setBeginnerGoal(chosen.state,'order-rush',null).state,'order-rush').goal,null);
});

test('goal affordability follows the real shared balance and purchase stays visible as achieved',()=>{
 let state=setBeginnerGoal(funded(20),'word-magic','magic-toys-picnic').state;
 assert.equal(beginnerProgress(state,'word-magic').affordable,true);
 const other=buyItem(state,'order-stall-blush');assert(other.ok);state=other.state;
 assert.equal(beginnerProgress(state,'word-magic').affordable,false);
 assert.equal(beginnerProgress(state,'word-magic').remaining,15);
 state.coins=20;state=buyItem(state,'magic-toys-picnic').state;
 const status=beginnerProgress(normalizeGarage(state),'word-magic');
 assert.equal(status.goal.id,'magic-toys-picnic');assert(status.owned);assert.equal(status.remaining,0);assert.equal(status.affordable,false);
 assert.equal(equipItem(state,'magic-toys-picnic').state.equipped['magic-toys'],'picnic');
 assert.equal(equipItem(state,'magic-toys-default').state.equipped['magic-toys'],'default');
});

test('permanent playsets buy once and never displace existing equipment or learning records',()=>{
 let state=funded(45);const before=structuredClone(state);
 for(const id of ['order-playset-picnic','ship-keepsake-starbook']){
  const purchase=buyItem(state,id);assert(purchase.ok);state=purchase.state;
  assert.equal(buyItem(state,id).reason,'owned');assert.equal(equipItem(state,id).reason,'use-in-game');
 }
 assert.equal(state.coins,0);assert.deepEqual(state.equipped,before.equipped);assert.deepEqual(state.gameStats,before.gameStats);
 assert(BEGINNER_ITEMS.filter(i=>i.price>0).every(i=>i.description&&i.descriptionEn));
});

test('legacy normalization only adds a free toy set and rejects invalid or foreign goals',()=>{
 const old=funded(37);delete old.equipped['magic-toys'];old.owned=old.owned.filter(id=>id!=='magic-toys-default');
 old.beginnerWishes={'word-magic':'ship-keepsake-starbook','order-rush':'order-playset-picnic','spaceship-coop':'unknown','runner':'magic-toys-picnic'};
 const next=normalizeGarage(old);assert.equal(next.coins,37);assert(next.owned.includes('magic-toys-default'));assert.equal(next.equipped['magic-toys'],'default');
 assert.deepEqual(next.beginnerWishes,{'order-rush':'order-playset-picnic'});
 assert.equal(beginnerProgress(next,'unknown').available,false);
});

test('optional word play requires completed audio and three varied, effective changes',()=>{
 for(const input of [
  {...practice,completed:false},{...practice,actions:[]},{...practice,actions:[actions[0],actions[0],actions[0]]},
  {...practice,actions:actions.map(a=>({...a,heard:false}))},{...practice,actions:actions.map(a=>({...a,changed:false}))},
  {...practice,actions:actions.map(a=>({...a,spell:'grow'}))},{...practice,actions:actions.map(a=>({...a,objectId:'bear'}))},
  {...practice,actions:actions.map(a=>({...a,spell:'invalid'}))}
 ]){const result=awardBeginnerPractice(emptyGarage(),input);assert.equal(result.reason,'unfinished');assert.equal(result.coins,0);}
 assert.equal(awardBeginnerPractice(emptyGarage(),{...practice,preview:true}).reason,'automatic');
 assert.equal(awardBeginnerPractice(emptyGarage(),{...practice,game:'order-rush'}).reason,'invalid-round');
 const result=awardBeginnerPractice(emptyGarage(),practice);assert.equal(result.coins,5);assert.equal(result.state.totalEarned,5);
 assert.deepEqual(result.state.gameStats,emptyGarage().gameStats);assert.deepEqual(result.state.achievements,{});
});

test('practice is claimed once per Seoul day and uses the same ten-reward allowance as other games',()=>{
 const beforeMidnight=Date.UTC(2026,9,9,14,59),afterMidnight=beforeMidnight+120000;
 const first=awardBeginnerPractice(emptyGarage(),{...practice,now:beforeMidnight});assert.equal(first.coins,5);
 assert.equal(beginnerProgress(first.state,'word-magic',beforeMidnight).practiceClaimed,true);
 assert.equal(awardBeginnerPractice(first.state,{...practice,now:beforeMidnight+1000}).reason,'duplicate-round');
 assert.equal(beginnerProgress(first.state,'word-magic',afterMidnight).practiceClaimed,false);
 assert.equal(awardBeginnerPractice(first.state,{...practice,now:afterMidnight}).coins,5);
 let state=emptyGarage();for(let i=0;i<10;i++)state=awardMiniGame(state,{game:'rhythm',roundId:`cap:${i}`,total:1,correct:1,completed:true,now}).state;
 assert.equal(awardBeginnerPractice(state,practice).reason,'daily-limit');assert.equal(state.coins,250);
 state=awardBeginnerPractice(emptyGarage(),practice).state;
 for(let i=0;i<9;i++)state=awardMiniGame(state,{game:'order-rush',roundId:`mixed:${i}`,total:3,correct:0,completed:true,now}).state;
 assert.equal(awardMiniGame(state,{game:'spaceship-coop',roundId:'mixed:end',total:18,correct:0,completed:true,now}).reason,'daily-limit');
});
