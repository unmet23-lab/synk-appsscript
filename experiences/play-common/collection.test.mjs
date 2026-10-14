import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { emptyGarage, dailyMission, GARAGE_KEY } from '../korean-racing/garage.js';
import { emptyProgress } from '../korean-racing/learning.js';

const source=await fs.readFile(new URL('./collection.js',import.meta.url),'utf8');
const now=Date.UTC(2026,9,2,4);
function browser({blocked=false,pathname='/play/rhythm/'}={}){
  const data=new Map(),links=[{}],badges=[{hidden:true,setAttribute(){}}],balances=[{}];
  const localStorage={getItem(key){if(blocked)throw Error('blocked');return data.get(key)||null;},setItem(key,value){if(blocked)throw Error('blocked');data.set(key,value);}};
  const context=vm.createContext({localStorage,location:{pathname},console,document:{
    querySelectorAll(selector){return selector==='[data-collection-badge]'?badges:selector==='[data-collection-garage]'?links:selector==='[data-collection-balance]'?balances:[];},
    createElement(){return {};},head:{append(){}}
  },addEventListener(){}});
  vm.runInContext(source,context);
  return {api:context.SynkPlayCollection,data,links,badges,balances};
}
const round=(game,roundId,correct=4)=>({game,roundId,total:5,correct,completed:true,automatic:false,now});

test('the generated browser adapter uses one wallet while preserving racing milestones and missions',async()=>{
  const b=browser(),initial=emptyGarage();initial.coins=7;initial.totalEarned=7;
  initial.firstClears['challenge-01']=true;initial.corrections['campaign:c01q1']=true;
  const mission=dailyMission(emptyProgress(),now,initial);initial.missions[mission.date]={...mission,completed:true,completedAt:now};
  assert(await b.api.save(initial));
  const before=await b.api.load();
  assert.equal((await b.api.award(round('rhythm','rhythm:one'))).coins,23);
  assert.equal((await b.api.award(round('runner','runner:one',3))).coins,21);
  const after=await b.api.load();assert.equal(after.coins,51);
  assert.equal(b.balances[0].textContent,'보유 51코인');
  assert.equal(JSON.stringify(after.firstClears),JSON.stringify(before.firstClears));
  assert.equal(JSON.stringify(after.corrections),JSON.stringify(before.corrections));
  assert.equal(JSON.stringify(after.missions),JSON.stringify(before.missions));
  assert.equal((await b.api.award(round('rhythm','rhythm:one'))).reason,'duplicate-round');
  assert.equal((await b.api.load()).coins,51);assert(b.data.has(GARAGE_KEY));
});

test('demos, incomplete tours and failed storage never show an awarded coin balance',async()=>{
  const b=browser();
  assert.equal((await b.api.award({...round('runner','demo'),automatic:true})).coins,0);
  assert.equal((await b.api.award({...round('runner','failed'),completed:false})).reason,'unfinished');
  assert.equal((await b.api.load()).coins,0);
  const blocked=browser({blocked:true}),result=await blocked.api.award(round('rhythm','blocked'));
  assert.equal(result.saved,false);assert.equal(result.coins,0);assert.equal(result.reason,'storage-unavailable');
  assert(!blocked.api.rewardText(result).includes('+23'));
  await blocked.api.refreshBadges();assert.equal(blocked.balances[0].textContent,'코인저장불가');
});

test('changing games does not reset the common ten-round daily replay limit',async()=>{
  const b=browser();
  for(let i=0;i<10;i++)assert.equal((await b.api.award(round(i%2?'runner':'rhythm',`shared:${i}`,5))).coins,25);
  const limited=await b.api.award(round('runner','shared:11',5));
  assert.equal(limited.coins,0);assert.equal(limited.state.coins,250);
  assert(b.api.rewardText(limited).includes('10회'));
});

test('the coast badge is visible only when owned and equipped and garage links follow the hosting path',async()=>{
  const b=browser();assert.equal(b.badges[0].hidden,true);
  assert.equal((await b.api.equip('badge-coast')).ok,false);
  const owned=emptyGarage();owned.owned.push('badge-coast');assert(await b.api.save(owned));
  assert.equal((await b.api.equip('badge-coast')).ok,true);assert.equal(b.badges[0].hidden,false);
  assert.equal(b.links[0].href,'/?garage=1');
  assert.equal(browser({pathname:'/try/runner/'}).links[0].href,'/try/racing/?garage=1');
  assert.equal(browser({pathname:'/korean-rhythm/'}).links[0].href,'/korean-racing/?garage=1');
  assert.equal(browser({pathname:'/blank-slice/'}).links[0].href,'/korean-racing/?garage=1','a learning-hub game, not the hub root');
  assert.equal(browser({pathname:'/try/entry-check/'}).links[0].href,'/try/racing/?garage=1');
  assert.equal(browser({pathname:'/showcase/play/rhythm/'}).links[0].href,'/showcase/?garage=1');
  assert.equal(browser({pathname:'/try/racing/play/runner/'}).links[0].href,'/try/racing/?garage=1');
  assert((await b.api.catalog()).some(item=>item.id==='badge-coast'));
});

test('every coin-paying mini-game ships byte-identical copies of the generated canonical rules',async()=>{
  for(const game of ['korean-rhythm','korean-runner','blank-slice','entry-check','story-classroom','talk-rally','order-rush','word-magic','spaceship-coop','learning-hub'])assert.equal(await fs.readFile(new URL(`../${game}/collection.js`,import.meta.url),'utf8'),source);
});

test('the three reading games pay from the same wallet, by accuracy rather than round length',async()=>{
  const b=browser({pathname:'/blank-slice/'});
  // blank-slice plays twelve sentences, entry-check six guests, rhythm five lines: a perfect round pays 25 in each.
  assert.equal((await b.api.award({...round('blank-slice','blank:one'),total:12,correct:12})).coins,25);
  assert.equal((await b.api.award({...round('entry-check','entry:one'),total:6,correct:3})).coins,20);
  assert.equal((await b.api.award({...round('story-classroom','story:one'),total:9,correct:0})).coins,15,'finishing still counts');
  assert.equal((await b.api.award(round('letter','letter:one'))).reason,'invalid-round','a game outside the list pays nothing');
  assert.equal((await b.api.load()).coins,60);
  assert.equal(b.api.rewardText({reason:'unfinished'}),'한 판을 끝까지 마치면 공통 코인이 모여요.');
});

test('Talk Rally pays from the same wallet once a round of twelve exchanges is finished',async()=>{
  const b=browser({pathname:'/try/talk-rally/'});
  assert.equal(b.links[0].href,'/try/racing/?garage=1');
  assert.equal(browser({pathname:'/talk-rally/'}).links[0].href,'/korean-racing/?garage=1','beside racing on a learning hub');
  assert.equal((await b.api.award({...round('talk-rally','rally:one'),total:12,correct:11})).coins,24);
  assert.equal((await b.api.award({...round('talk-rally','rally:two'),total:12,correct:12})).coins,25);
  assert.equal((await b.api.award({...round('talk-rally','rally:quit'),total:12,correct:3,completed:false})).reason,'unfinished','leaving mid-round pays nothing');
  assert.equal((await b.api.award({...round('talk-rally','rally:one'),total:12,correct:12})).reason,'duplicate-round');
  assert.equal((await b.api.load()).coins,49);assert.equal(b.balances[0].textContent,'보유 49코인');
});

test('Order Rush pays from the same wallet once the cafe shift is finished',async()=>{
  const b=browser({pathname:'/try/order-rush/'});
  assert.equal(b.links[0].href,'/try/racing/?garage=1');
  assert.equal((await b.api.award({...round('order-rush','rush:one'),total:8,correct:8})).coins,25);
  assert.equal((await b.api.award({...round('order-rush','rush:two'),total:8,correct:6})).coins,23,'15 + round(10 × 6/8)');
  assert.equal((await b.api.award({...round('order-rush','rush:quit'),total:8,correct:2,completed:false})).reason,'unfinished','closing the cafe early pays nothing');
  assert.equal((await b.api.award({...round('order-rush','rush:one'),total:8,correct:8})).reason,'duplicate-round');
  assert.equal((await b.api.load()).coins,48);
});

test('buy() spends coins with the garage rule, saves only a valid purchase, and the bought racket or ball can then be equipped',async()=>{
  const b=browser({pathname:'/try/talk-rally/'});
  const start=emptyGarage();start.coins=70;start.totalEarned=70;assert(await b.api.save(start));
  assert.equal((await b.api.buy('ball-lapis')).ok,true);
  let now=await b.api.load();assert.equal(now.coins,25);assert(now.owned.includes('ball-lapis'));assert.equal(now.equipped.ball,'cream','buying alone does not equip');
  assert.equal(b.balances[0].textContent,'보유 25코인','the coin line updates after a purchase');
  assert.equal((await b.api.buy('racket-lapis')).reason,'insufficient');assert.equal((await b.api.load()).coins,25,'a refused purchase spends nothing');
  assert.equal((await b.api.buy('ball-lapis')).reason,'owned');assert.equal((await b.api.buy('racket-nope')).reason,'unknown');
  assert.equal((await b.api.equip('ball-lapis')).ok,true);now=await b.api.load();assert.equal(now.equipped.ball,'lapis');assert.equal(now.equipped.racket,'coral');
  const kinds=(await b.api.catalog()).filter(item=>item.kind==='racket'||item.kind==='ball');
  assert.equal(JSON.stringify(kinds.filter(item=>item.price===0).map(item=>item.id).sort()),JSON.stringify(['ball-cream','racket-coral']));
  const blocked=browser({blocked:true});assert.equal((await blocked.api.buy('ball-lapis')).reason,'storage-unavailable');
});

test('an older saved wallet keeps every field through the shared adapter and only gains new free defaults',async()=>{
  const b=browser({pathname:'/try/talk-rally/'}),legacy={version:1,coins:33,totalEarned:58,owned:['vehicle-coast','paint-mint','wheels-silver','trail-lime','paint-pearl'],
    equipped:{vehicle:'coast',paint:'pearl',wheels:'silver',trail:'lime',badge:null},wish:'open',rewardedRounds:{'rhythm:x':{date:'2026-10-04',coins:25}},firstClears:{},corrections:{},dailyRaceCounts:{'2026-10-04':1},missions:{}};
  b.data.set(GARAGE_KEY,JSON.stringify(legacy));
  const loaded=await b.api.load();
  assert.equal(loaded.coins,33);assert.equal(loaded.equipped.paint,'pearl');assert.equal(JSON.stringify(loaded.rewardedRounds),JSON.stringify(legacy.rewardedRounds));
  assert.equal(loaded.equipped.racket,'coral');assert.equal(loaded.equipped.ball,'cream');
  for(const id of legacy.owned)assert(loaded.owned.includes(id));
  const items=await b.api.catalog();assert(loaded.owned.filter(id=>!legacy.owned.includes(id)).every(id=>items.find(i=>i.id===id)?.price===0));
});

test('beginner shops preserve existing hub cosmetics, titles, wishes and Talk Rally equipment through purchase and reload',async()=>{
  const b=browser({pathname:'/word-magic/'}),state=emptyGarage();state.coins=140;state.totalEarned=200;
  state.owned.push('order-rush-style-mint','order-rush-title-first','ball-lapis');
  state.equipped.ball='lapis';state.gameEquipment['order-rush']={style:'mint',title:'first'};
  state.gameStats['order-rush']={rounds:2,total:16,correct:15,perfectRounds:1,bestCombo:6};state.achievements['order-rush-first']=true;state.gameWishes['rhythm']='rhythm-style-aurora';
  await b.api.save(state);const before=await b.api.load();
  for(const [id,kind,value] of [['magic-scene-sunset','magic-scene','sunset'],['order-tray-butter','order-tray','butter'],['ship-badge-ring','ship-badge','ring']]){assert.equal((await b.api.buy(id)).ok,true);assert.equal((await b.api.equip(id)).ok,true);assert.equal((await b.api.load()).equipped[kind],value);}
  const after=await b.api.load();assert.equal(after.coins,85);assert.equal(after.equipped.ball,'lapis');assert.equal(after.gameWishes.rhythm,'rhythm-style-aurora');
  assert.equal(JSON.stringify(after.gameEquipment),JSON.stringify(before.gameEquipment));assert.equal(JSON.stringify(after.gameStats),JSON.stringify(before.gameStats));assert.equal(JSON.stringify(after.achievements),JSON.stringify(before.achievements));assert.equal(JSON.stringify(after.gameWishes),JSON.stringify(before.gameWishes));
  const progress=await b.api.progress('order-rush');assert(progress.achievements.find(a=>a.key==='first').unlocked);assert.equal(progress.equipment.style,'mint');
  assert.equal((await b.api.buy('ship-badge-ring')).reason,'owned');assert.equal((await b.api.load()).coins,85);
  assert.equal((await b.api.equip('magic-scene-default')).ok,true);assert.equal((await b.api.load()).equipped['magic-scene'],'default');
  assert.equal(b.links[0].href,'/korean-racing/?garage=1');
});

test('new games share the same reward cap and cannot mint coins through duplicate endings or previews',async()=>{
  const b=browser();const chapter={game:'word-magic',roundId:'word-magic:chapter:size',total:6,correct:0,completed:true,now};
  assert.equal((await b.api.award({...chapter,automatic:true})).coins,0);assert.equal((await b.api.award(chapter)).coins,15);
  assert.equal((await b.api.award(chapter)).reason,'duplicate-round');
  assert.equal((await b.api.award({...chapter,game:'spaceship-coop',roundId:'spaceship-coop:unique-room',total:18})).coins,15);
  assert.equal((await b.api.load()).coins,30);
  for(let i=0;i<8;i++)await b.api.award(round('order-rush',`shop-limit:${i}`));
  assert.equal((await b.api.award({...chapter,roundId:'word-magic:chapter:doors'})).reason,'daily-limit');
});

test('failed storage writes never claim ownership, equipment or spent coins',async()=>{
  const data=new Map([[GARAGE_KEY,JSON.stringify({...emptyGarage(),coins:80,totalEarned:80})]]);
  const context=vm.createContext({localStorage:{getItem:k=>data.get(k)||null,setItem(){throw Error('quota');}},location:{pathname:'/spaceship-coop/'},addEventListener(){}});vm.runInContext(source,context);
  const api=context.SynkPlayCollection;assert.equal((await api.buy('ship-sky-night')).reason,'storage-unavailable');
  assert.equal((await api.load()).coins,80);assert(!(await api.load()).owned.includes('ship-sky-night'));
  const blocked=browser({blocked:true});assert.equal((await blocked.api.equip('magic-scene-default')).reason,'storage-unavailable');
});

test('the daily limit says so, and the badge is named in words',async()=>{
  const b=browser();
  for(let i=0;i<10;i++)await b.api.award(round('rhythm',`cap:${i}`,5));
  const limited=await b.api.award(round('blank-slice','cap:10',5));
  assert.equal(limited.reason,'daily-limit');assert.equal(limited.coins,0);
  assert.equal(b.api.rewardText(limited),'오늘의 공통 코인 보상 10회분을 모두 받았어요.');
  const owned=emptyGarage();owned.owned.push('badge-coast');owned.equipped.badge='coast';assert(await b.api.save(owned));
  await b.api.refreshBadges();assert.equal(b.badges[0].textContent,'코스트 챔피언');
});

test('beginner goals and optional practice survive generated-adapter reload without changing legacy goals',async()=>{
 const b=browser(),initial=emptyGarage();initial.gameWishes['order-rush']='order-rush-style-mint';await b.api.save(initial);
 assert.equal((await b.api.beginnerProgress('order-rush')).goal,null);
 assert.equal((await b.api.setBeginnerGoal('order-rush','order-playset-picnic')).ok,true);
 assert.equal((await b.api.beginnerProgress('order-rush')).remaining,15);
 const actions=[['grow','bear'],['shrink','bear'],['open','chest']].map(([spell,objectId])=>({spell,objectId,heard:true,changed:true}));
 const first=await b.api.awardPractice({game:'word-magic',completed:true,actions,now});assert(first.saved);assert.equal(first.coins,5);
 assert.equal((await b.api.awardPractice({game:'word-magic',completed:true,actions,now})).reason,'duplicate-round');
 assert.equal((await b.api.beginnerProgress('order-rush')).remaining,10);
 assert.equal((await b.api.load()).gameWishes['order-rush'],'order-rush-style-mint');
 assert.equal((await b.api.setBeginnerGoal('order-rush',null)).ok,true);
 assert.equal((await b.api.beginnerProgress('order-rush')).goal,null);
});

test('failed writes cannot claim a goal, playset or practice reward',async()=>{
 const initial={...emptyGarage(),coins:30,totalEarned:30},data=new Map([[GARAGE_KEY,JSON.stringify(initial)]]);
 const context=vm.createContext({localStorage:{getItem:k=>data.get(k)||null,setItem(){throw Error('quota');}},location:{pathname:'/word-magic/'},addEventListener(){}});vm.runInContext(source,context);
 const api=context.SynkPlayCollection;
 assert.equal((await api.setBeginnerGoal('word-magic','magic-toys-picnic')).reason,'storage-unavailable');
 assert.equal((await api.beginnerProgress('word-magic')).goal,null);
 assert.equal((await api.buy('order-playset-picnic')).reason,'storage-unavailable');
 const actions=[['grow','bear'],['shrink','bear'],['open','chest']].map(([spell,objectId])=>({spell,objectId,heard:true,changed:true}));
 const reward=await api.awardPractice({game:'word-magic',completed:true,actions,now});assert.equal(reward.coins,0);assert.equal(reward.saved,false);
 assert.equal((await api.load()).coins,30);assert.equal(data.get(GARAGE_KEY),JSON.stringify(initial));
 const blocked=browser({blocked:true});assert.equal((await blocked.api.beginnerProgress('word-magic')).available,false);
 assert.equal((await blocked.api.setBeginnerGoal('word-magic','magic-toys-picnic')).reason,'storage-unavailable');
});
