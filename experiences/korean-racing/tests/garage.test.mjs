import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN} from '../campaign.js';
import {FINALES} from '../finales.js';
import {STAGES,WORDS,emptyProgress,makeQuestions,recordRound} from '../learning.js';
import {josa} from '../kit/josa.mjs';
import {GARAGE_KEY,SHOP_ITEMS,VEHICLES,RACKETS,BALLS,FINALE_REWARDS,emptyGarage,loadGarage,saveGarage,buyItem,equipItem,setWish,awardRace,awardMiniGame,dailyMission,seoulDate} from '../garage.js';

const now=Date.parse('2026-10-02T04:00:00Z');
const answers=(stage,score=stage.campaign?stage.items.length:stage.words.length)=>makeQuestions(stage,()=>.4).map((q,i)=>({...q,correct:i<score}));
const award=(state,stage,options={})=>awardRace(state,stage,answers(stage),{now,beforeProgress:emptyProgress(),roundId:'round-a',...options});

test('shared collection starts with only free equipment; purchasing and equipping cannot invent coins',()=>{
  const garage=emptyGarage();assert.equal(garage.coins,0);assert.equal(GARAGE_KEY,'SYNK_PLAY_COLLECTION_V1');
  assert.equal(VEHICLES.filter(v=>!v.unlockOnly).length,3);
  assert.equal(buyItem(garage,'vehicle-open').reason,'insufficient');
  assert.equal(buyItem(garage,'missing').reason,'unknown');
  assert.equal(buyItem(garage,'constructor').reason,'unknown');
  assert.equal(equipItem(garage,'toString').reason,'unknown');
  assert.equal(buyItem(garage,'paint-aurora').reason,'unlock-only');
  assert.equal(equipItem(garage,'vehicle-rally').reason,'unowned');
  const funded={...garage,coins:135,totalEarned:135};
  const bought=buyItem(funded,'vehicle-open');assert(bought.ok);assert.equal(bought.state.coins,15);assert.equal(bought.state.wish,null);
  assert.equal(funded.coins,135,'functions do not mutate the input');
  const twice=buyItem(bought.state,'vehicle-open');assert.equal(twice.reason,'owned');assert.equal(twice.state.coins,15);
  assert.equal(equipItem(bought.state,'vehicle-open').state.equipped.vehicle,'open');
  assert.equal(setWish(bought.state,'rally').wish,'rally');assert.equal(setWish(bought.state,'unknown').wish,null);
});

test('field-by-field restoration keeps valid balance while rejecting unknown or unowned equipment',()=>{
  const saved={...emptyGarage(),version:'broken',coins:87,totalEarned:120,owned:['vehicle-open','bad'],equipped:{vehicle:'open',paint:'midnight',wheels:'hacked'},wish:'hacked',missions:{'2026-10-02':{kind:'correction',target:'unknown'}}};
  const restored=loadGarage({getItem:key=>{assert.equal(key,GARAGE_KEY);return JSON.stringify(saved);}});
  assert.equal(restored.coins,87);assert.equal(restored.totalEarned,120);assert.equal(restored.equipped.vehicle,'open');
  assert.equal(restored.equipped.paint,'mint');assert.equal(restored.equipped.wheels,'silver');assert(!restored.owned.includes('bad'));
  assert.deepEqual(restored.missions,{});
  const badCoins=loadGarage({getItem:()=>JSON.stringify({...saved,coins:-55})});assert.equal(badCoins.coins,0);assert(badCoins.owned.includes('vehicle-open'));
  assert.deepEqual(loadGarage({getItem:()=>'{bad'}),emptyGarage());
  let stored;assert(saveGarage(restored,{setItem:(key,value)=>{assert.equal(key,GARAGE_KEY);stored=value;}}));
  assert.deepEqual(loadGarage({getItem:()=>stored}),restored);
  assert.equal(saveGarage(restored,{setItem:()=>{throw new Error('quota exceeded');}}),false);
});

test('only full manual races earn rewards; sticky demo status excludes a later takeover and duplicate finish callbacks',()=>{
  const state=emptyGarage(),stage=CAMPAIGN[0];
  assert.deepEqual(award(state,stage,{automatic:true}).state,state);
  assert.equal(awardRace(state,stage,answers(stage).slice(0,4),{now,roundId:'short'}).reason,'unfinished');
  const duplicateAnswers=answers(stage);duplicateAnswers[4]=duplicateAnswers[0];
  assert.equal(awardRace(state,stage,duplicateAnswers,{now,roundId:'bad'}).reason,'unfinished');
  const earned=award(state,stage);assert.equal(earned.coins,50);assert(earned.missionCompleted);
  assert.equal(award(earned.state,stage).reason,'duplicate-round');assert.equal(award(earned.state,stage).state.coins,50);
  const progress=recordRound(emptyProgress(),stage,answers(stage),{now});
  const again=award(earned.state,stage,{roundId:'round-b',beforeProgress:progress});assert.equal(again.coins,25);assert(!again.missionCompleted);
  assert.equal(again.state.missions[seoulDate(now)].target,stage.id,'daily goal stays fixed after completion');
  assert.equal(dailyMission(progress,now,again.state).completed,true);
});

test('first new vehicle takes three new good rounds; already-cleared legacy stages do not grant fictional first-clear coins',()=>{
  let state=emptyGarage(),progress=emptyProgress();
  for(let i=0;i<3;i++){
    const stage=CAMPAIGN[i],result=award(state,stage,{roundId:`new-${i}`,beforeProgress:progress});state=result.state;
    progress=recordRound(progress,stage,answers(stage),{now});
  }
  assert.equal(state.coins,120);assert(buyItem(state,'vehicle-open').ok);
  const legacy=award(emptyGarage(),CAMPAIGN[0],{beforeProgress:progress,roundId:'legacy'});
  assert.equal(legacy.breakdown.find(line=>line.id==='first-clear'),undefined);assert.equal(legacy.coins,25);
});

test('today’s single mission chooses the most recent real mistake and correction bonus cannot be farmed',()=>{
  const stage=CAMPAIGN[0],word=STAGES[0].words[0];
  const progress=recordRound(emptyProgress(),stage,answers(stage,4),{now:now-2000});
  progress.words[word]={seen:1,correct:0,wrong:1,lastAt:now-1000,lastCorrect:false};
  const mission=dailyMission(progress,now);assert.equal(mission.kind,'correction');assert.equal(mission.target,word);assert.equal(mission.collection,'words');
  const review={id:'review',review:true,mode:'listen',words:[word]};
  const recovered=award(emptyGarage(),review,{beforeProgress:progress,roundId:'recover'});
  assert.equal(recovered.coins,37);assert(recovered.missionCompleted);assert.equal(recovered.breakdown.find(line=>line.id==='correction').coins,5);
  const repeated=award(recovered.state,review,{beforeProgress:progress,roundId:'recover-again'});
  assert.equal(repeated.coins,17,'replaying stale mistake progress cannot repeat the one-off or daily bonus');
  assert.equal(repeated.state.corrections[`words:${word}`],true);
});

test('the correction mission and the wish notice put the particle the last syllable needs',()=>{
  const id=word=>WORDS.find(w=>w.word===word).id;
  const missed=word=>dailyMission({words:{[id(word)]:{seen:1,correct:0,wrong:1,lastAt:now-1000,lastCorrect:false}}},now);
  assert.equal(missed('병원').description,'놓쳤던 “병원”을 다시 맞혀요.');
  assert.equal(missed('우유').description,'놓쳤던 “우유”를 다시 맞혀요.');
  // 문장 코스 문항은 물음표로 끝나도 마지막 음절(요)을 따른다
  const asked=CAMPAIGN.flatMap(s=>s.items).find(q=>q.prompt.endsWith('?'));
  assert.equal(dailyMission({challenges:{[asked.id]:{seen:1,correct:0,wrong:1,lastAt:now-1000,lastCorrect:false}}},now).description,`놓쳤던 “${asked.prompt}”를 다시 맞혀요.`);
  // 찜 알림(garage-ui.js)이 차고 이름에 붙이는 조사: 받침 있는 이름·없는 이름·영문으로 끝나는 이름
  const names=new Set(SHOP_ITEMS.map(item=>item.name));
  for(const [name,particle] of [['코랄','을'],['라피스 공','을'],['코스트 챔피언','을'],['민트','를'],['브리즈 로드스터','를'],['코스트 GT','를']]){
    assert.ok(names.has(name),name);assert.equal(josa(name,'을','를'),particle,name);
  }
});

test('Seoul midnight rolls the daily goal and base-reward allowance, while unique learning bonuses survive the generous replay limit',()=>{
  const before=Date.parse('2026-10-02T14:59:59Z'),after=Date.parse('2026-10-02T15:00:00Z');
  assert.equal(seoulDate(before),'2026-10-02');assert.equal(seoulDate(after),'2026-10-03');
  let state=emptyGarage(),progress=emptyProgress();
  for(let i=0;i<10;i++){
    state=award(state,CAMPAIGN[0],{now:before,roundId:`limit-${i}`,beforeProgress:progress}).state;
    progress=recordRound(progress,CAMPAIGN[0],answers(CAMPAIGN[0]),{now:before});
  }
  const capped=award(state,CAMPAIGN[0],{now:before,roundId:'capped',beforeProgress:progress});assert.equal(capped.coins,0);
  const newCourse=award(capped.state,CAMPAIGN[1],{now:before,roundId:'new-after-cap',beforeProgress:progress});assert.equal(newCourse.coins,10);
  const nextDay=award(newCourse.state,CAMPAIGN[0],{now:after,roundId:'tomorrow',beforeProgress:progress});assert.equal(nextDay.coins,25);
  assert.equal(nextDay.state.dailyRaceCounts['2026-10-03'],1);assert.equal(dailyMission(progress,after,nextDay.state).date,'2026-10-03');
});

test('chapter finales award each matching exclusive cosmetic once; poor results and demo races cannot unlock them',()=>{
  let state=emptyGarage();
  for(let chapter=1;chapter<=6;chapter++){
    const stage={...CAMPAIGN[(chapter-1)*2],id:`finale-${chapter}`,finale:true,chapter};
    const poor=awardRace(state,stage,answers(stage,3),{now,roundId:`poor-${chapter}`});assert.deepEqual(poor.newUnlocks,[]);
    assert.deepEqual(award(state,stage,{automatic:true,roundId:`demo-${chapter}`}).newUnlocks,[]);
    const result=award(state,stage,{roundId:`final-${chapter}`});assert.deepEqual(result.newUnlocks,[FINALE_REWARDS[chapter]]);state=result.state;
    assert(SHOP_ITEMS.find(item=>item.id===FINALE_REWARDS[chapter]).unlockOnly);
    assert.equal(buyItem(emptyGarage(),FINALE_REWARDS[chapter]).reason,'unlock-only');
    assert(equipItem(state,FINALE_REWARDS[chapter]).ok);
    assert.deepEqual(award(state,stage,{roundId:`final-again-${chapter}`}).newUnlocks,[]);
  }
  const restored=loadGarage({getItem:()=>JSON.stringify(state)});assert.deepEqual(restored,state);
  assert(state.owned.includes('vehicle-finale'));assert.equal(equipItem(state,'badge-coast').state.equipped.badge,'coast');
});

test('runner and rhythm use the same wallet and replay cap without changing racing missions or learning records',()=>{
  let state=award(emptyGarage(),CAMPAIGN[0]).state;
  const mission=structuredClone(state.missions);
  const round={game:'runner',total:5,correct:4,completed:true,now,roundId:'runner-1'};
  const runner=awardMiniGame(state,round);assert.equal(runner.coins,23);assert.deepEqual(runner.state.missions,mission);
  assert.equal(awardMiniGame(runner.state,round).reason,'duplicate-round');
  assert.equal(awardMiniGame(state,{...round,roundId:'runner-demo',automatic:true}).coins,0);
  assert.equal(awardMiniGame(state,{...round,roundId:'runner-short',completed:false}).coins,0);
  assert.equal(awardMiniGame(state,{...round,roundId:'bad-count',correct:8}).coins,0);
  state=runner.state;
  for(let i=0;i<8;i++)state=awardMiniGame(state,{...round,game:'rhythm',roundId:`rhythm-${i}`}).state;
  assert.equal(state.dailyRaceCounts[seoulDate(now)],10);
  assert.equal(awardMiniGame(state,{...round,roundId:'runner-cap'}).coins,0);
  assert.equal(award(state,CAMPAIGN[0],{roundId:'racing-cap'}).coins,0);
  assert.deepEqual(state.missions,mission);
});

test('a finale mistake is a real daily retrieval target and survives shared-wallet restore',()=>{
  const stage=FINALES[0],progress=recordRound(emptyProgress(),stage,answers(stage,4),{now:now-1000});
  const mission=dailyMission(progress,now);assert.equal(mission.target,stage.items[4].id);assert.equal(mission.collection,'campaign');
  const earned=award(emptyGarage(),stage,{roundId:'finale-retrieval',beforeProgress:progress});
  assert(earned.missionCompleted);assert.equal(earned.state.missions[seoulDate(now)].target,stage.items[4].id);
  const restored=loadGarage({getItem:()=>JSON.stringify(earned.state)});assert.deepEqual(restored.missions,earned.state.missions);
});

// 2026-10-07 말 랠리의 라켓·공(같은 지갑). 그전에 저장한 지갑은 새 종류만 무료 기본값을 받고 나머지는 그대로다.
const legacyWallet=()=>({version:1,coins:87,totalEarned:140,owned:['vehicle-coast','paint-mint','wheels-silver','trail-lime','vehicle-open','paint-coral'],
  equipped:{vehicle:'open',paint:'coral',wheels:'silver',trail:'lime',badge:null},wish:'rally',rewardedRounds:{'talk-rally:a':{date:'2026-10-05',coins:24}},
  firstClears:{'challenge-01':true},corrections:{'campaign:c01q1':true},dailyRaceCounts:{'2026-10-05':3},missions:{}});

test('a wallet saved before the Talk Rally kinds loads unchanged; the racket and ball start as the free defaults',()=>{
  const saved=legacyWallet(),restored=loadGarage({getItem:()=>JSON.stringify(saved)});
  assert.equal(restored.coins,87);assert.equal(restored.totalEarned,140);assert.equal(restored.wish,'rally');
  for(const kind of ['vehicle','paint','wheels','trail','badge'])assert.equal(restored.equipped[kind],saved.equipped[kind],kind);
  assert.equal(restored.equipped.racket,'coral');assert.equal(restored.equipped.ball,'cream');
  for(const id of saved.owned)assert(restored.owned.includes(id),id);
  assert(restored.owned.includes('racket-coral')&&restored.owned.includes('ball-cream'),'free defaults are owned');
  assert(!restored.owned.some(id=>/^(racket|ball)-/.test(id)&&!['racket-coral','ball-cream'].includes(id)),'no paid racket or ball appears from nowhere');
  assert.deepEqual(restored.rewardedRounds,saved.rewardedRounds);assert.deepEqual(restored.firstClears,saved.firstClears);
  assert.deepEqual(restored.corrections,saved.corrections);assert.deepEqual(restored.dailyRaceCounts,saved.dailyRaceCounts);
  // An unknown or unowned racket/ball in a saved record falls back to the free one instead of breaking the load.
  const odd=loadGarage({getItem:()=>JSON.stringify({...saved,equipped:{...saved.equipped,racket:'lapis',ball:'gold'}})});
  assert.equal(odd.equipped.racket,'coral');assert.equal(odd.equipped.ball,'cream');assert.equal(odd.coins,87);
});

test('Talk Rally rackets and balls are bought and equipped like any other cosmetic, with palette colours and fair prices',()=>{
  assert.equal(RACKETS.filter(x=>x.price===0).length,1);assert.equal(BALLS.filter(x=>x.price===0).length,1);
  for(const item of SHOP_ITEMS.filter(x=>x.kind==='racket'||x.kind==='ball')){
    assert.match(item.color,/^#[0-9a-f]{6}$/);assert.ok(item.label&&item.name.startsWith(item.label),item.id);
    assert.ok(item.price===0||(item.price>=30&&item.price<=60),`${item.id} price ${item.price} sits with paints (35~50), about two finished rounds`);
  }
  const garage={...emptyGarage(),coins:60,totalEarned:60};
  assert.equal(buyItem(garage,'racket-lapis').state.coins,10);
  assert.equal(buyItem(garage,'racket-coral').reason,'owned','the free racket is already owned');
  assert.equal(buyItem({...garage,coins:20},'ball-lapis').reason,'insufficient');
  assert.equal(equipItem(garage,'ball-butter').reason,'unowned');
  assert.equal(buyItem(garage,'racket-gold').reason,'unknown');
  const bought=buyItem(garage,'ball-butter');assert(bought.ok);
  const equipped=equipItem(bought.state,'ball-butter');assert(equipped.ok);assert.equal(equipped.state.equipped.ball,'butter');
  assert.equal(equipped.state.equipped.vehicle,'coast','equipping a ball leaves the car alone');
  let stored;assert(saveGarage(equipped.state,{setItem:(key,value)=>{stored=value;}}));
  const again=loadGarage({getItem:()=>stored});assert.equal(again.equipped.ball,'butter');assert.equal(again.coins,25);
});
