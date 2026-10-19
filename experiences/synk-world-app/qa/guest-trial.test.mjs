// WORLD 손님 한 판 체험(10-19 결정 「WORLD 손님」 · 공개판 설계 §2): 바람길·말의 리듬은 손님이 한 판씩 해 볼 수 있고 기록·코인 저장만 로그인 뒤다.
// 체험 호스트(guest-trial.mjs)를 실제 게임의 공통 코인·계정 다리(collection.js)에 물려 돌리고, 추천은 실제 Core로 고른다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {GUEST_TRIAL_GAMES,GUEST_TRIAL_KEY,createGuestTrials,createGuestTrialPlayHost} from '../guest-trial.mjs';
import {createWorldLearningPlan} from '../world-learning-plan.mjs';
import {createLifeProgress} from '../life-progress.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
const require=createRequire(import.meta.url);
const Learning=require('../../../atlas/learning.js');
function memory({failWrites=false}={}){const values=new Map();return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(failWrites)throw Error('synthetic quota');values.set(key,String(value));},removeItem:key=>values.delete(key)};}
const round=(game,extra={})=>({game,total:5,correct:4,completed:true,automatic:false,roundId:`${game}:trial-1`,...extra});

test('each trial game is open once per device; a finished trial is remembered on this device',()=>{
 const storage=memory();let at=1000;const trials=createGuestTrials({storage,now:()=>at});
 assert.deepEqual(GUEST_TRIAL_GAMES,['runner','rhythm']);
 assert.deepEqual(trials.open(),['runner','rhythm']);
 assert.equal(trials.finish('runner'),true);assert.equal(trials.finish('runner'),false,'a second finish is a no-op');
 assert.deepEqual(trials.open(),['rhythm']);assert.equal(trials.used('runner'),true);
 assert.deepEqual(JSON.parse(storage.getItem(GUEST_TRIAL_KEY)),{version:1,games:{runner:{finishedAt:1000}}});
 at=2000;trials.finish('rhythm');
 assert.deepEqual(createGuestTrials({storage}).open(),[],'a fresh page on the same device still sees both trials used');
 assert.throws(()=>trials.finish('hangul'),/Unknown guest trial game/,'한글 만나기 is open to guests without a trial');
});

test('unreadable or blocked storage never blocks the trial; the page still remembers a finished round',()=>{
 const broken=memory();broken.setItem(GUEST_TRIAL_KEY,'{not json');
 assert.deepEqual(createGuestTrials({storage:broken}).open(),['runner','rhythm']);
 const full=memory({failWrites:true}),trials=createGuestTrials({storage:full});
 assert.equal(trials.finish('rhythm'),true);assert.deepEqual(trials.open(),['runner'],'remembered for this page');
 assert.equal(full.values.size,0);
 assert.deepEqual(createGuestTrials({storage:null}).open(),['runner','rhythm']);
});

test('the trial host keeps play records in memory only and never pays coins',async()=>{
 const rounds=[],signed=[],statuses=[];
 const host=createGuestTrialPlayHost({game:'runner',onRound:value=>rounds.push(value),signIn:game=>signed.push(game)});
 host.subscribe(value=>statuses.push(value));
 assert.deepEqual({trial:host.status().trial,phase:host.status().phase,accountId:host.status().accountId,used:host.status().used},{trial:true,phase:'guest',accountId:null,used:false});
 await host.ready();
 const storage=host.storage();
 storage.setItem('synk.windrun.best','321');assert.equal(storage.getItem('synk.windrun.best'),'321');
 assert.equal(JSON.parse(storage.getItem('SYNK_PLAY_COLLECTION_V1')).coins,0);
 assert.throws(()=>storage.setItem('synk.unknown.key','1'),{code:'INVALID_PLAY_KEY'});
 assert.throws(()=>storage.setItem('SYNK_PLAY_COLLECTION_V1','{"coins":999}'),{code:'INVALID_PLAY_KEY'},'the wallet cannot be written from a game');
 assert.equal(host.snapshot().state.records['synk.windrun.best'],'321');
 // Another game's round and an automatic demonstration do not use this trial.
 await host.wallet('awardMiniGame',[round('rhythm')]);await host.wallet('awardMiniGame',[round('runner',{automatic:true})]);
 assert.equal(rounds.length,0);
 const award=await host.wallet('awardMiniGame',[round('runner')]);
 assert.deepEqual({coins:award.coins,reason:award.reason,saved:award.saved,state:award.state.coins},{coins:0,reason:'guest-trial',saved:false,state:0});
 assert.deepEqual(rounds,[{game:'runner',round:round('runner')}]);
 await host.wallet('awardMiniGame',[round('runner',{roundId:'runner:trial-2'})]);
 assert.equal(rounds.length,1,'one finished round closes the trial');
 assert.equal(statuses.at(-1).used,true);assert.match(statuses.at(-1).message,/로그인한 뒤부터 저장돼요/);
 const buy=await host.wallet('buyItem',['badge-coast']);assert.deepEqual({ok:buy.ok,reason:buy.reason},{ok:false,reason:'guest-trial'});
 await assert.rejects(host.importLegacy(),{code:'PLAY_GUEST_TRIAL'});
 host.signIn();assert.deepEqual(signed,['runner']);
 host.stop();assert.equal(host.status().phase,'stopped');
 assert.throws(()=>storage.getItem('synk.windrun.best'),{code:'PLAY_SESSION_ENDED'});
 host.signIn();assert.deepEqual(signed,['runner'],'a closed trial cannot open sign-in');
});

// The game frame's real account bridge + common coin adapter (generated collection.js, the same bytes in every game).
function gameFrame(game,host){
 const deviceStorage=memory(),events=[];
 const parent={SYNKPlayHost:host};parent.parent=parent;
 const context={location:{pathname:`/world/korean-${game}/`},localStorage:deviceStorage,parent,console,setTimeout,clearTimeout,
  crypto:{randomUUID:()=>'00000000-0000-4000-8000-000000000000'},dispatchEvent:event=>events.push(event),addEventListener(){},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}}};
 context.globalThis=context;context.window=context;
 vm.runInNewContext(fs.readFileSync(new URL(`../../korean-${game}/collection.js`,import.meta.url),'utf8'),context,{filename:`korean-${game}/collection.js`});
 return {context,deviceStorage,events};
}

for(const game of ['runner','rhythm'])test(`the actual ${game} frame sees the trial, gets no coins and writes nothing to this device`,async()=>{
 const rounds=[];const host=createGuestTrialPlayHost({game,onRound:value=>rounds.push(value.game)});
 const {context,deviceStorage}=gameFrame(game,host);
 const account=context.SynkPlayAccount,collection=context.SynkPlayCollection;
 await account.ready();
 assert.equal(account.status().trial,true);assert.equal(account.status().mode,'account','the bridge routes the wallet to the trial host, not to device coins');
 assert.equal(account.storage(),host.storage());
 const award=await collection.award({game,total:5,correct:5,completed:true,automatic:false,roundId:collection.roundId(game)});
 assert.deepEqual({coins:award.coins,saved:award.saved,reason:award.reason},{coins:0,saved:false,reason:'guest-trial'});
 assert.deepEqual(rounds,[game]);
 if(game==='runner')account.storage().setItem('synk.windrun.best','400');
 assert.equal(deviceStorage.values.size,0,'no coin, record or best distance reaches the device storage');
 assert.equal((await collection.load()).coins,0);
});

// 추천은 같은 목록(openGames)을 쓴다: 체험이 남은 게임은 손님에게도 추천되고, 체험을 마치면 빠져 로그인 창으로 보내지 않는다.
test('recommendations open a trial while it lasts and drop it once that round is over',()=>{
 const storage=memory(),trials=createGuestTrials({storage}),progress=createLifeProgress({storage:memory(),owner:'guest',now:()=>Date.UTC(2026,9,19),uuid:()=>'trial-plan'});
 progress.summary(PACKS,LESSONS);
 const plan=()=>createWorldLearningPlan({progress:progress.exportSnapshot(),settings:{reasons:['exam'],primaryReason:'exam'},now:Date.UTC(2026,9,19),recommendActivities:Learning.recommendActivities,openGames:['hangul',...trials.open()]});
 const first=plan();
 assert.equal(first.selected.gameId,'runner','a TOPIK guest may start with the 바람길 trial');
 assert.equal(first.excluded.find(row=>row.id==='world.play.runner'),undefined);
 trials.finish('runner');
 const second=plan();
 assert.deepEqual(second.excluded.find(row=>row.id==='world.play.runner')?.reasons,['activity.unavailable'],'the finished trial is never recommended again');
 assert.equal(second.selected.gameId,'rhythm');
 trials.finish('rhythm');
 const third=plan();
 assert.notEqual(third.selected.route,'game');
 assert.equal(third.selected.lessonId,'greetings-expressions');
 assert.ok(third.candidates.filter(c=>['runner','rhythm'].includes(c.gameId)).every(c=>c.available===false&&c.accountRequired===true));
});
