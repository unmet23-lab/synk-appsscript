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
  assert.equal(browser({pathname:'/showcase/play/rhythm/'}).links[0].href,'/showcase/?garage=1');
  assert.equal(browser({pathname:'/try/racing/play/runner/'}).links[0].href,'/try/racing/?garage=1');
  assert((await b.api.catalog()).some(item=>item.id==='badge-coast'));
});

test('rhythm and runner ship byte-identical copies of the generated canonical rules',async()=>{
  for(const game of ['korean-rhythm','korean-runner'])assert.equal(await fs.readFile(new URL(`../${game}/collection.js`,import.meta.url),'utf8'),source);
});
