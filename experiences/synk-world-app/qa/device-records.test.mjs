// 한글 만나기 기기 기록 옮기기(공개판 설계 §2 「로그인 없이 먼저 해 본다」): 로그인할 때 이 기기의 손님 한글 기록을 계정으로 옮길지 묻는다.
// 옮기는 것은 지금 상태의 스냅샷(글자 진도 · 첫 실행 답)이고, 계정에 이미 기록이 있으면 합치지 않는다. 손님 기록은 지우지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {progressKey} from '../../hangul-stage/learning.mjs';
import {emptyProgress,meet,answer as answerLetter} from '../../hangul-stage/core.mjs';
import {createLifeProgress} from '../life-progress.mjs';
import {HANGUL_DEVICE_KEY,GUEST_LIFE_KEY,DEVICE_RECORDS_KEY,hangulAccountKey,hangulProgressSummary,deviceHangulAnswer,planDeviceRecords,applyDeviceRecords,
 deviceRecordsDecision,saveDeviceRecordsDecision,describeDeviceRecords,createDeviceRecordsOffer} from '../device-records.mjs';
function memory(){const values=new Map();return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
const ACCOUNT='11111111-1111-4111-8111-111111111111',AT='2026-10-19T03:00:00.000Z';
const learning={accountKey:ACCOUNT,revision:2},target=`synk.account.${ACCOUNT}.r2.hangul-stage.v1`;
// The real hangul-stage judgement writes the progress a guest leaves behind.
function guestHangul(){let p=meet(emptyProgress(),['g-giyeok','v-a','v-o'],AT);p=answerLetter(p,{focus:['v-a'],correct:true,at:AT,sessionId:'s1'});return p;}
function guestAnswer(storage,answer='new',via='question'){
 const life=createLifeProgress({storage,owner:'guest',now:()=>Date.parse(AT),uuid:()=>'device-life'});life.setHangulReading(answer,{via});return life;
}

test('the account key is the same one 한글 만나기 uses inside WORLD',()=>{
 const host={status:()=>learning},win={SYNKLearningHost:host,parent:null,location:{origin:'http://world.test'}};win.parent=win;
 assert.equal(hangulAccountKey(learning),progressKey(win,{assignment(){}}));
 assert.equal(hangulAccountKey({accountKey:`local:${ACCOUNT}`,revision:1}),`synk.account.local:${ACCOUNT}.r1.hangul-stage.v1`);
 assert.equal(progressKey(win,null),HANGUL_DEVICE_KEY,'a guest (no host) stays on the device key');
 for(const bad of [null,{},{accountKey:'a b',revision:1},{accountKey:ACCOUNT,revision:'1'}])assert.equal(hangulAccountKey(bad),null);
});

test('only progress that holds something is offered; the first-run answer is read from the guest record',()=>{
 assert.equal(hangulProgressSummary(emptyProgress()),null,'opening the stage without meeting a letter is nothing to move');
 assert.deepEqual(hangulProgressSummary(guestHangul()),{met:3,mastered:0,graduated:false,skipped:false,sessions:0});
 assert.deepEqual(hangulProgressSummary({...emptyProgress(),skipped:true}),{met:0,mastered:0,graduated:false,skipped:true,sessions:0});
 assert.equal(hangulProgressSummary({v:2,letters:{a:{state:'met'}}}),null);
 const storage=memory();assert.equal(deviceHangulAnswer(storage),null);
 guestAnswer(storage);assert.deepEqual(deviceHangulAnswer(storage),{answer:'new',via:'question'});
 storage.setItem(GUEST_LIFE_KEY,JSON.stringify({owner:'someone',hangul:{version:1,answer:'new',at:1,via:'question'}}));assert.equal(deviceHangulAnswer(storage),null);
 storage.setItem(GUEST_LIFE_KEY,'{broken');assert.equal(deviceHangulAnswer(storage),null);
});

test('a plan moves what the account lacks and never merges into an existing account record',()=>{
 const storage=memory();
 assert.equal(planDeviceRecords({storage,learning}),null,'nothing on this device');
 storage.setItem(HANGUL_DEVICE_KEY,JSON.stringify(guestHangul()));
 const plan=planDeviceRecords({storage,learning});
 assert.deepEqual(plan.hangul,{from:HANGUL_DEVICE_KEY,to:target,summary:{met:3,mastered:0,graduated:false,skipped:false,sessions:0}});
 assert.equal(plan.answer,null);
 assert.equal(planDeviceRecords({storage,learning:null}),null,'without the account place this login does not ask (it asks next time)');
 storage.setItem(target,JSON.stringify({...emptyProgress(),skipped:true}));
 assert.equal(planDeviceRecords({storage,learning}),null,'the account already has 한글 만나기 progress: keep it, do not merge');
 guestAnswer(storage,'reads');
 const answerOnly=planDeviceRecords({storage,learning});
 assert.equal(answerOnly.hangul,null);assert.deepEqual(answerOnly.answer,{answer:'reads',via:'question'});assert.deepEqual(answerOnly.kept,{hangul:true,answer:false});
 assert.deepEqual(describeDeviceRecords(answerOnly),{rows:[{label:'처음 고른 답',value:'한글을 읽을 수 있어요'}],notes:['한글 만나기는 계정에 이미 진도가 있어 계정 진도로 이어 가요.']});
 assert.equal(planDeviceRecords({storage,learning,accountAnswer:{version:1,answer:'new',at:1,via:'question'}}),null,'the account already chose: keep it');
});

test('applying copies the snapshot bytes, keeps the guest copy and re-checks the account at that moment',async()=>{
 const storage=memory(),raw=JSON.stringify(guestHangul());storage.setItem(HANGUL_DEVICE_KEY,raw);guestAnswer(storage);
 const plan=planDeviceRecords({storage,learning}),answers=[];
 const result=await applyDeviceRecords(plan,{storage,accountAnswer:()=>null,setAccountAnswer:async(answer,options)=>answers.push([answer,options])});
 assert.deepEqual({hangul:result.hangul,answer:result.answer,errors:result.errors.length},{hangul:'moved',answer:'moved',errors:0});
 assert.equal(storage.getItem(target),raw,'a snapshot of the current state, byte for byte');
 assert.equal(storage.getItem(HANGUL_DEVICE_KEY),raw,'the guest record on this device is not deleted');
 assert.deepEqual(answers,[['new',{via:'question'}]]);
 // The account gained its own record after the question was shown: nothing is overwritten or merged.
 const late=memory();late.setItem(HANGUL_DEVICE_KEY,raw);guestAnswer(late);
 const pending=planDeviceRecords({storage:late,learning});
 const own=JSON.stringify({...emptyProgress(),skipped:true});late.setItem(target,own);
 const kept=await applyDeviceRecords(pending,{storage:late,accountAnswer:()=>({answer:'reads'}),setAccountAnswer:async()=>assert.fail('must not overwrite')});
 assert.deepEqual({hangul:kept.hangul,answer:kept.answer},{hangul:'exists',answer:'exists'});
 assert.equal(late.getItem(target),own);
 const failing=await applyDeviceRecords({hangul:null,answer:{answer:'new',via:'question'}},{storage:memory(),setAccountAnswer:async()=>{throw Object.assign(Error('offline'),{code:'NETWORK_UNAVAILABLE'});}});
 assert.equal(failing.answer,null);assert.equal(failing.errors[0].code,'NETWORK_UNAVAILABLE');
});

test('the choice is remembered once per account on this device',()=>{
 const storage=memory();
 assert.equal(deviceRecordsDecision(storage,ACCOUNT),null);
 assert.equal(saveDeviceRecordsDecision(storage,ACCOUNT,'kept',5),true);saveDeviceRecordsDecision(storage,'other','moved',6);
 assert.equal(deviceRecordsDecision(storage,ACCOUNT),'kept');assert.equal(deviceRecordsDecision(storage,'other'),'moved');
 assert.deepEqual(JSON.parse(storage.getItem(DEVICE_RECORDS_KEY)).accounts[ACCOUNT],{decision:'kept',at:5});
 assert.equal(deviceRecordsDecision(storage,'constructor'),null);
 assert.throws(()=>saveDeviceRecordsDecision(storage,ACCOUNT,'merged'),/Invalid device records decision/);
});

function offerFixture({accountAnswer=null,setAccountAnswer}={}){
 const storage=memory(),log=[];let shown=null,account=accountAnswer;
 storage.setItem(HANGUL_DEVICE_KEY,JSON.stringify(guestHangul()));guestAnswer(storage);
 const offer=createDeviceRecordsOffer({storage,learningStatus:()=>learning,accountAnswer:()=>account,
  setAccountAnswer:setAccountAnswer||(async(answer,options)=>{account={version:1,answer,at:1,via:options.via};log.push('answer');}),
  present:({title,html,onClose})=>{shown={title,html,onClose};log.push('present');},close:()=>{log.push('close');shown?.onClose();shown=null;},toast:message=>log.push(`toast:${message}`),now:()=>9,defer:fn=>fn()});
 return {storage,log,offer,shown:()=>shown};
}

test('the offer asks once after login, moves on 「이어 가기」 and finishes before closing the sheet',async()=>{
 const f=offerFixture();
 assert.equal(f.offer.offer({owner:'guest'}),null,'a guest is never asked');
 const pending=f.offer.offer({owner:ACCOUNT});
 assert.ok(pending);assert.equal(f.shown().title,'한글 기록 이어 가기');
 assert.match(f.shown().html,/글자 3개를 만났어요/);assert.match(f.shown().html,/한글을 아직 못 읽어요/);
 assert.match(f.shown().html,/data-world="device-records" data-choice="move"/);
 assert.equal(f.offer.offer({owner:ACCOUNT}),null,'not twice in one page');
 assert.equal(await f.offer.choose('move',{owner:ACCOUNT}),'moved');
 assert.equal(await pending,'moved','the gate continues with the choice, not with the sheet closing');
 assert.deepEqual(f.log,['present','answer','close','toast:한글 기록을 내 계정으로 옮겼어요.']);
 assert.equal(f.storage.getItem(`synk.account.${ACCOUNT}.r2.hangul-stage.v1`),f.storage.getItem(HANGUL_DEVICE_KEY));
 assert.equal(deviceRecordsDecision(f.storage,ACCOUNT),'moved');
 assert.equal(createDeviceRecordsOffer({storage:f.storage,learningStatus:()=>learning,present:()=>assert.fail('asked again'),close(){}}).offer({owner:ACCOUNT}),null,'a later visit does not ask again');
});

test('「처음부터 하기」 keeps the account empty; closing the sheet asks again on a later visit; a changed account moves nothing',async()=>{
 const keep=offerFixture(),kept=keep.offer.offer({owner:ACCOUNT});
 assert.equal(await keep.offer.choose('keep',{owner:ACCOUNT}),'kept');assert.equal(await kept,'kept');
 assert.equal(keep.storage.getItem(`synk.account.${ACCOUNT}.r2.hangul-stage.v1`),null);assert.equal(deviceRecordsDecision(keep.storage,ACCOUNT),'kept');
 const close=offerFixture(),closed=close.offer.offer({owner:ACCOUNT});
 close.shown().onClose();assert.equal(await closed,'dismissed');
 assert.equal(deviceRecordsDecision(close.storage,ACCOUNT),null,'closing is not a choice');
 assert.equal(await close.offer.choose('move',{owner:ACCOUNT}),null,'a closed sheet cannot move anything');
 const swap=offerFixture(),swapped=swap.offer.offer({owner:ACCOUNT});
 assert.equal(await swap.offer.choose('move',{owner:'22222222-2222-4222-8222-222222222222'}),null);assert.equal(await swapped,'dismissed');
 assert.equal(swap.storage.getItem(`synk.account.${ACCOUNT}.r2.hangul-stage.v1`),null);
});

test('a failed move keeps the sheet open to retry and records nothing',async()=>{
 let fail=true;
 const f=offerFixture({setAccountAnswer:async()=>{if(fail)throw Error('offline');}});
 // Only the answer is movable, so its failure moves nothing.
 f.storage.setItem(`synk.account.${ACCOUNT}.r2.hangul-stage.v1`,JSON.stringify({...emptyProgress(),skipped:true}));
 const pending=f.offer.offer({owner:ACCOUNT}),statuses=[];
 assert.equal(await f.offer.choose('move',{owner:ACCOUNT,status:(text,busy)=>statuses.push([text,busy])}),null);
 assert.deepEqual(statuses.at(-1),['옮기지 못했어요. 연결을 확인한 뒤 다시 골라 주세요.',false]);
 assert.equal(deviceRecordsDecision(f.storage,ACCOUNT),null);assert.ok(f.shown(),'the sheet stays');
 fail=false;assert.equal(await f.offer.choose('move',{owner:ACCOUNT}),'moved');assert.equal(await pending,'moved');
 assert.ok(f.log.includes('toast:한글 기록을 내 계정으로 옮겼어요.'),'the sheet already said the account keeps its own 한글 만나기 progress');
});

test('an account record that appears while the sheet is open is kept, and the message says only part moved',async()=>{
 const f=offerFixture(),pending=f.offer.offer({owner:ACCOUNT});
 const own=JSON.stringify({...emptyProgress(),skipped:true});f.storage.setItem(`synk.account.${ACCOUNT}.r2.hangul-stage.v1`,own);
 assert.equal(await f.offer.choose('move',{owner:ACCOUNT}),'moved');assert.equal(await pending,'moved');
 assert.equal(f.storage.getItem(`synk.account.${ACCOUNT}.r2.hangul-stage.v1`),own);
 assert.ok(f.log.includes('toast:옮길 수 있는 한글 기록만 내 계정으로 옮겼어요.'));
});
