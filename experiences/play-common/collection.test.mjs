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
  for(const game of ['korean-rhythm','korean-runner','blank-slice','entry-check','story-classroom','talk-rally','order-rush'])assert.equal(await fs.readFile(new URL(`../${game}/collection.js`,import.meta.url),'utf8'),source);
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

test('the daily limit says so, and the badge is named in words',async()=>{
  const b=browser();
  for(let i=0;i<10;i++)await b.api.award(round('rhythm',`cap:${i}`,5));
  const limited=await b.api.award(round('blank-slice','cap:10',5));
  assert.equal(limited.reason,'daily-limit');assert.equal(limited.coins,0);
  assert.equal(b.api.rewardText(limited),'오늘의 완주 코인 10회분을 모두 받았어요.');
  const owned=emptyGarage();owned.owned.push('badge-coast');owned.equipped.badge='coast';assert(await b.api.save(owned));
  await b.api.refreshBadges();assert.equal(b.badges[0].textContent,'코스트 챔피언');
});
