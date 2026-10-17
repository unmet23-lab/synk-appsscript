import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as economy from '../korean-racing/garage-core.js';

const source=await readFile(new URL('./collection-adapter.js',import.meta.url),'utf8');
const now=Date.UTC(2026,9,9,3),date=economy.seoulDate(now);
const chapters=['size','doors','sky'];
const completeMagic={version:1,completed:chapters.flatMap(id=>Array.from({length:6},(_,i)=>`${id}-${i+1}`)),introduced:chapters};
const completeShop={version:1,seed:411,completed:[0,1,2,3],roundId:'order-rush:my-first-story',records:Array.from({length:27},(_,i)=>({stage:Math.min(3,Math.floor(i/6)),voice:'water'}))};
function browser({wallet=economy.emptyGarage(),magic,order,pathname='/word-magic/',blocked=false,account=false,accountPhase='synced',accountNullStore=false}={}){
 const data=new Map([[economy.GARAGE_KEY,JSON.stringify(wallet)]]),local=new Map();let writes=0,restored=!account;
 if(magic)data.set('synk.word-magic.progress.v1',JSON.stringify(magic));if(order)data.set('synk.order-rush.beginner.v1',JSON.stringify(order));
 const store={getItem(key){if(blocked||!restored)throw Error('storage unavailable');return data.get(key)||null;},setItem(){writes++;}};
 class Clock extends Date{constructor(value){super(value===undefined?now:value);}static now(){return now;}}
 const context=vm.createContext({Date:Clock,location:{pathname},SynkCollectionEconomy:economy,localStorage:account?{getItem:k=>local.get(k)||null,setItem(){writes++;}}:store,
   ...(account?{SynkPlayAccount:{ready:async()=>{restored=true;},storage:()=>accountNullStore?null:store,readRecord:key=>store.getItem(key),status:()=>({mode:'account',phase:accountPhase})}}:{})});
 // Economy's default clock is outside the VM, so pass the same fixed date to its date helper.
 context.SynkCollectionEconomy={...economy,seoulDate:()=>date};vm.runInContext(source,context);
 return {route:game=>context.SynkPlayCollection.beginnerRewardRoute(game),data,writes:()=>writes};
}
function claimMagic(wallet){for(const id of chapters)wallet.rewardedRounds[`word-magic:chapter:${id}`]={date,coins:15};return wallet;}

test('a new learner is sent to a reachable first chapter without changing any stored state',async()=>{
 const b=browser(),before=JSON.stringify([...b.data]);const result=await b.route('word-magic');
 assert.equal(result.kind,'magic-chapter');assert.equal(result.chapterIndex,0);assert.equal(result.href,'/word-magic/?chapter=0');assert.equal(result.potentialCoins,15);
 assert.equal(JSON.stringify([...b.data]),before);assert.equal(b.writes(),0);
});
test('an unfinished listening checkpoint is eligible even when all six discoveries are already saved',async()=>{
 const b=browser({magic:{version:1,completed:completeMagic.completed.slice(0,6),introduced:['size'],checks:[]}});
 const result=await b.route('word-magic');assert.equal(result.chapterIndex,0);assert.match(result.description,/소리/);
});
test('a received chapter reward is never offered again and later locked chapters are not skipped',async()=>{
 const wallet=economy.emptyGarage();wallet.rewardedRounds['word-magic:chapter:size']={date,coins:15};
 assert.equal((await browser({wallet}).route('word-magic')).kind,'first-shop');
 const result=await browser({wallet,magic:{version:1,completed:completeMagic.completed.slice(0,6)}}).route('word-magic');assert.equal(result.chapterIndex,1);
});
test('daily practice requires a introduced pair and its unpaid daily receipt',async()=>{
 const wallet=claimMagic(economy.emptyGarage());
 assert.equal((await browser({wallet,magic:{version:1,introduced:['not-a-chapter']}}).route('word-magic')).kind,'first-shop');
 let result=await browser({wallet,magic:completeMagic}).route('word-magic');assert.equal(result.kind,'magic-practice');assert.equal(result.potentialCoins,5);
 wallet.rewardedRounds[`beginner-practice:word-magic:${date}`]={date,coins:5};result=await browser({wallet,magic:completeMagic}).route('word-magic');assert.equal(result.kind,'first-shop');
});
test('paid first-shop repetition never promises another completion reward',async()=>{
 const wallet=claimMagic(economy.emptyGarage());wallet.rewardedRounds[completeShop.roundId]={date,coins:25};wallet.rewardedRounds[`beginner-practice:word-magic:${date}`]={date,coins:5};
 const result=await browser({wallet,magic:completeMagic,order:completeShop}).route('order-rush');assert.equal(result.reason,'no-route');assert.equal(result.available,false);assert.equal(result.potentialCoins,0);
});
test('finished first-shop reward retry needs its complete record and round identity',async()=>{
 let result=await browser({order:completeShop}).route('order-rush');assert.equal(result.kind,'first-shop');assert.match(result.label,/다시/);
 for(const order of [{...completeShop,roundId:null},{...completeShop,roundId:''},{...completeShop,records:completeShop.records.slice(0,26)},{...completeShop,records:completeShop.records.map(r=>({...r,voice:'missing-audio'}))}])assert.equal((await browser({order}).route('order-rush')).kind,'magic-chapter');
});
test('the shared ten-reward cap offers free play without a payout promise',async()=>{
 const wallet=economy.emptyGarage();wallet.dailyRaceCounts[date]=10;const result=await browser({wallet}).route('spaceship-coop');
 assert.equal(result.reason,'daily-limit');assert.equal(result.potentialCoins,0);assert.equal(result.href,'/learning-hub/#beginner-title');
});
test('restored account progress guides the next task instead of empty guest storage',async()=>{
 const wallet=claimMagic(economy.emptyGarage());const b=browser({account:true,wallet,magic:completeMagic});assert.equal((await b.route('word-magic')).kind,'magic-practice');assert.equal(b.writes(),0);
});
test('offline, unresolved and ended account snapshots do not promise another payout',async()=>{
 for(const accountPhase of ['loading','offline','conflict','stopped']){const result=await browser({account:true,accountPhase}).route('word-magic');assert.equal(result.reason,'storage-unavailable');assert.equal(result.potentialCoins,0);}
});
test('a missing account storage handle never falls back to a guest reward route',async()=>{
 const result=await browser({account:true,accountNullStore:true}).route('word-magic');assert.equal(result.available,false);assert.equal(result.reason,'storage-unavailable');assert.equal(result.potentialCoins,0);
});
test('storage failure and unknown games never claim eligible coins',async()=>{
 const result=await browser({blocked:true}).route('order-rush');assert.equal(result.reason,'storage-unavailable');assert.equal(result.available,false);assert.equal(result.potentialCoins,0);
 const unknown=await browser().route('unknown');assert.equal(unknown.reason,'unknown-game');assert.equal(unknown.href,null);
});
test('public, nested and local guidance uses the same hosting prefix',async()=>{
 assert.equal((await browser({pathname:'/try/spaceship-coop/'}).route('spaceship-coop')).href,'/try/word-magic/?chapter=0');
 assert.equal((await browser({pathname:'/experiences/learning-hub/collection.html'}).route('word-magic')).href,'/experiences/word-magic/?chapter=0');
 assert.equal((await browser({pathname:'/try/racing/play/rhythm/'}).route('word-magic')).href,'/try/word-magic/?chapter=0');
});
test('invalid saved versions and malformed chapter fields fall back to a playable first task',async()=>{
 const result=await browser({magic:{version:99,completed:completeMagic.completed},order:{version:1,seed:411,completed:{includes:true}}}).route('word-magic');assert.equal(result.chapterIndex,0);
});
