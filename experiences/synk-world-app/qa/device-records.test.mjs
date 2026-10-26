// 한글 만나기 기기 기록 옮기기(공개판 설계 §2 「로그인 없이 먼저 해 본다」): 로그인할 때 이 기기의 손님 한글 기록을 계정으로 옮길지 묻는다.
// 옮기는 것은 지금 상태의 스냅샷(글자 진도 · 첫 실행 답)이고, 계정에 이미 기록이 있으면 합치지 않는다. 손님 기록은 지우지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {progressKey} from '../../hangul-stage/learning.mjs';
import {emptyProgress,meet,answer as answerLetter} from '../../hangul-stage/core.mjs';
import {createLifeProgress,LIFE_PROGRESS_KEY} from '../life-progress.mjs';
import {HANGUL_DEVICE_KEY,GUEST_LIFE_KEY,DEVICE_RECORDS_KEY,hangulAccountKey,hangulProgressSummary,deviceHangulAnswer,planDeviceRecords,applyDeviceRecords,
 deviceRecordsDecision,saveDeviceRecordsDecision,describeDeviceRecords,createDeviceRecordsOffer,GUEST_LEARNING_KEY,guestLearningEvents,guestLifeRecords,deviceWatermark,noteDeviceSignOut,noteDeviceAccount,
 DEVICE_RECORDS_TEXT} from '../device-records.mjs';
import {PACKS,LESSONS} from '../life-content.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const learningBrowser=require('../../../atlas/game-browser.js');
function memory(){const values=new Map();return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
const ACCOUNT='11111111-1111-4111-8111-111111111111',AT='2026-10-19T03:00:00.000Z',LATER=Date.parse(AT)+3600000;
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
 // after: 판을 만들 때 건 기준 시각 — 옮기는 순간에 원본을 다시 읽을 때도 같은 기준을 건다(10-21 GPT 재확인).
 assert.deepEqual(plan.hangul,{from:HANGUL_DEVICE_KEY,to:target,summary:{met:3,mastered:0,graduated:false,skipped:false,sessions:0},after:0});
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
  present:({title,html,onClose})=>{shown={title,html,onClose};log.push('present');},close:()=>{log.push('close');shown?.onClose();shown=null;},toast:message=>log.push(`toast:${message}`),now:()=>LATER,defer:fn=>fn()});
 return {storage,log,offer,shown:()=>shown};
}

test('the offer asks once after login, moves on 「이어 가기」 and finishes before closing the sheet',async()=>{
 const f=offerFixture();
 assert.equal(f.offer.offer({owner:'guest'}),null,'a guest is never asked');
 const pending=f.offer.offer({owner:ACCOUNT});
 assert.ok(pending);assert.equal(f.shown().title,'이 기기의 학습 옮기기');assert.match(f.shown().html,/이 기기에서 한 학습을 이 계정으로 옮길까요\?/);
 assert.match(f.shown().html,/>옮기기<\/button><button class="plain-button" data-world="device-records" data-choice="keep">이 기기에만 두기</);
 assert.match(f.shown().html,/글자 3개를 만났어요/);assert.match(f.shown().html,/한글을 아직 못 읽어요/);
 assert.match(f.shown().html,/data-world="device-records" data-choice="move"/);
 assert.equal(f.offer.offer({owner:ACCOUNT}),null,'not twice in one page');
 assert.equal(await f.offer.choose('move',{owner:ACCOUNT}),'moved');
 assert.equal(await pending,'moved','the gate continues with the choice, not with the sheet closing');
 assert.deepEqual(f.log,['present','answer','close','toast:이 기기의 학습을 내 계정으로 옮겼어요.']);
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
 assert.deepEqual(statuses.at(-1),['옮기지 못했어요. 잠시 뒤 「옮기기」를 다시 눌러 주세요.',false]);
 assert.equal(deviceRecordsDecision(f.storage,ACCOUNT),null);assert.ok(f.shown(),'the sheet stays');
 fail=false;assert.equal(await f.offer.choose('move',{owner:ACCOUNT}),'moved');assert.equal(await pending,'moved');
 assert.ok(f.log.includes('toast:이 기기의 학습을 내 계정으로 옮겼어요.'),'the sheet already said the account keeps its own 한글 만나기 progress');
});

test('an account record that appears while the sheet is open is kept, and the message says only part moved',async()=>{
 const f=offerFixture(),pending=f.offer.offer({owner:ACCOUNT});
 const own=JSON.stringify({...emptyProgress(),skipped:true});f.storage.setItem(`synk.account.${ACCOUNT}.r2.hangul-stage.v1`,own);
 assert.equal(await f.offer.choose('move',{owner:ACCOUNT}),'moved');assert.equal(await pending,'moved');
 assert.equal(f.storage.getItem(`synk.account.${ACCOUNT}.r2.hangul-stage.v1`),own);
 assert.ok(f.log.includes('toast:옮길 수 있는 기록만 내 계정으로 옮겼어요.'));
});

// ── 10-20 손님 기록 옮기기 넓힘: 생활 진도·짧은 진단과 연습의 학습 기록·학습 목표(TOPIK 맞춤 재설계 ④) ──
const OTHER='22222222-2222-4222-8222-222222222222';
const lesson=LESSONS.find(row=>row.id==='greetings-expressions'),second=LESSONS.find(row=>row.id!==lesson.id&&row.questions?.length&&!row.id.startsWith('cafe'));
// 손님이 이 기기에서: 생활 레슨 하나(문제마다 답) + 학습 목표 + 홈 코치의 짧은 진단 두 문항(Trail).
function guestDay(storage,start,which=lesson){
 let tick=start,n=0;
 const life=createLifeProgress({storage,owner:'guest',now:()=>tick,uuid:()=>`guest-${start}-${++n}`});life.summary(PACKS,LESSONS);life.startLesson(which);
 for(const q of which.questions){tick+=1000;life.recordAnswer({lessonId:which.id,questionId:q.id,correct:q===which.questions[0],choiceId:q===which.questions[0]?q.answerId:q.choices.find(c=>c.id!==q.answerId).id});}
 life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{reasons:['exam'],primaryReason:'exam',examType:'topik1',targetGrade:2}});
 const coach=learningBrowser.engine.createGame({gameId:'world-home',storage,clock:()=>new Date(tick+=1000).toISOString()});
 for(const id of ['qa.read.1','qa.read.2']){const pid=coach.present({id,itemKey:id,familyKey:id,skillId:'ko.reading.detail',modality:'reading',difficulty:1,responseFormat:'single-choice'});coach.answer(pid,{correct:id.endsWith('1'),assessable:true});}
 return {life,coach,end:()=>tick};
}
test('only guest records made after the last person on this device are offered (other-student isolation)',()=>{
 const storage=memory(),first=Date.parse(AT);
 const a=guestDay(storage,first);
 // 앞 사람(OTHER)이 이 기기에 로그인해 있었고 로그아웃했다 — 그 앞의 손님 기록은 다음 사람에게 묻지 않는다.
 noteDeviceAccount(storage,OTHER,a.end()+1000);noteDeviceSignOut(storage,a.end()+2000);
 assert.equal(deviceWatermark(storage,ACCOUNT),a.end()+2000);
 assert.equal(planDeviceRecords({storage,learning,accountId:ACCOUNT,life:true,learningLog:true}),null,'nothing after the last sign-out');
 // 로그아웃 뒤 새 손님 연습은 대상이다(앞 사람의 것은 그대로 빠진다).
 const b=guestDay(storage,a.end()+60000,second);
 const plan=planDeviceRecords({storage,learning,accountId:ACCOUNT,life:true,learningLog:true});
 assert.equal(plan.learning.attempts,2,'only the two answers made after the sign-out');
 assert.ok(plan.learning.events.every(event=>Date.parse(event.at)>a.end()+2000));
 assert.equal(plan.life.counts.lessons,1);assert.equal(plan.life.counts.profile,true);
 const {rows}=describeDeviceRecords(plan);
 assert.deepEqual(rows.map(row=>row.label),['생활 한국어','짧은 진단·연습','학습 목표']);assert.match(rows[1].value,/답 2개/);
 // 이 계정이 한 번 고르면 그때까지의 손님 기록은 이 계정에 다시 묻지 않는다.
 saveDeviceRecordsDecision(storage,ACCOUNT,'kept',b.end()+1000,{through:b.end()+1000});
 assert.equal(planDeviceRecords({storage,learning,accountId:ACCOUNT,life:true,learningLog:true}),null);
});
// WORLD 학습자 응답 설계 §4: 손님은 응답을 남기지 않아 지금은 빈 길이지만, 연습 한 판(.set)의 결정이 기준 시각 뒤면 그 마침·응답·응답 빼기가 함께 간다.
// 응답만 따로 가면 계정 기록이 받지 않는다(마침이 먼저 있어야 한다).
test('a finished set moves with its completion, its response and an exclusion of it; a set from before the mark stays',()=>{
 const storage=memory(),day=guestDay(storage,Date.parse(AT));
 const early=day.coach.finishSet({kind:'diagnostic'});
 noteDeviceSignOut(storage,day.end()+1000);
 let tick=day.end()+60000;
 const coach=learningBrowser.engine.createGame({gameId:'world-practice',storage,clock:()=>new Date(tick+=1000).toISOString()});
 const set=coach.finishSet({kind:'short'}),response=coach.feedback(set,'want_more'),exclusion=coach.exclude(response.id);
 const {events}=guestLearningEvents(storage,{after:deviceWatermark(storage,ACCOUNT)});
 const ids=new Set(events.map(event=>event.id));
 for(const id of [set.decisionId,set.completionId,response.id,exclusion.id])assert.ok(ids.has(id),`${id} moves`);
 for(const id of [early.decisionId,early.completionId])assert.ok(!ids.has(id),'a set from before the mark stays on the device');
 // 옮기는 묶음만으로 계정 기록이 받는다(부모 없는 사건이 없다).
 const accountStore=memory(),account=learningBrowser.engine.createGame({gameId:'world-account',storage:accountStore,storageScope:'account',accountKey:ACCOUNT,fold:false});
 account.syncPort.importEvents(events);
 assert.deepEqual(account.syncPort.events().filter(event=>ids.has(event.id)).map(event=>event.id).sort(),[...ids].sort());
});
test('moving keeps every event as it was (same ids), adds only what the account lacks and never overwrites it',async()=>{
 const storage=memory();guestDay(storage,Date.parse(AT));
 const {events}=guestLearningEvents(storage);
 assert.deepEqual(new Set(events.map(event=>event.type)),new Set(['decision.made','practice.presented','practice.attempted','experience.completed']));
 // 계정 기록장: 이미 다른 기록이 있다. 손님 사건을 옮긴 뒤 같은 것을 또 옮겨도 늘지 않는다(사건 ID로 중복 제외).
 const accountStore=memory(),account=learningBrowser.engine.createGame({gameId:'world-account',storage:accountStore,storageScope:'account',accountKey:ACCOUNT,fold:false});
 const pid=account.present({id:'own.1',itemKey:'own.1',familyKey:'own.1',skillId:'ko.reading.main',modality:'reading',difficulty:1,responseFormat:'single-choice'});account.answer(pid,{correct:true,assessable:true});
 const before=account.syncPort.events().length;
 const first=account.syncPort.importEvents(events),again=account.syncPort.importEvents(events);
 assert.equal(first.added,events.length);assert.equal(again.added,0,'importing twice adds nothing');
 assert.equal(account.syncPort.events().length,before+events.length,'the account kept its own entries');
 assert.equal(account.summary().skills.find(skill=>skill.id==='ko.reading.detail').n,2,'the moved first answers count as evidence in the account');
 // 생활 진도: 계정에 같은 레슨이 있으면 계정 것을 두고, 없는 복습·날만 더한다. 학습 목표는 계정이 비었을 때만.
 const records=guestLifeRecords(storage),mine=memory();
 const own=createLifeProgress({storage:mine,owner:ACCOUNT,now:()=>LATER,uuid:()=>'own-attempt'});own.summary(PACKS,LESSONS);own.startLesson(lesson);
 own.recordAnswer({lessonId:lesson.id,questionId:lesson.questions[0].id,correct:true,choiceId:lesson.questions[0].answerId});
 own.updateLearningProfile({consent:true,expectedRevision:0,values:{reasons:['travel'],primaryReason:'travel'}});
 const kept=own.importRecords(records);
 assert.equal(kept.lessons,0,'the account already has this lesson');assert.equal(kept.profile,false,'the account already chose its goals');
 assert.equal(own.exportSnapshot().lessons[lesson.id].attemptId,'own-attempt','the account lesson is not overwritten');
 assert.deepEqual(own.learningProfileValues().reasons,['travel']);
 const fresh=createLifeProgress({storage:memory(),owner:OTHER,now:()=>LATER,uuid:()=>'x'});fresh.summary(PACKS,LESSONS);
 const moved=fresh.importRecords(records);
 assert.equal(moved.lessons,1);assert.ok(moved.reviews>0);assert.equal(moved.profile,true);
 assert.equal(fresh.learningProfileValues().examType,'topik1','an empty account takes the goals and test details as they were');
 const provenance=fresh.exportSnapshot().imports;assert.equal(provenance.length,1);assert.equal(provenance[0].from,'guest-device');
 const again2=fresh.importRecords(records);
 assert.deepEqual([again2.lessons,again2.reviews,again2.days,again2.profile],[0,0,0,false],'moving again adds nothing');
 assert.equal(fresh.exportSnapshot().imports.length,1,'nothing new, no new import record');
 assert.ok(storage.getItem(GUEST_LEARNING_KEY)&&storage.getItem(GUEST_LIFE_KEY),'the guest copies stay on this device');
});
test('the sheet says moved only after the account confirms; an unconfirmed upload keeps the sheet open and records nothing',async()=>{
 const storage=memory();guestDay(storage,Date.parse(AT));
 const imports=[];let confirmed=false;
 const offer=createDeviceRecordsOffer({storage,learningStatus:()=>learning,present:()=>{},close(){},now:()=>LATER,defer:fn=>fn(),toast(){},
  importLife:async records=>{imports.push('life');return {lessons:records.counts.lessons,reviews:records.counts.reviews,days:records.counts.days,profile:records.counts.profile};},
  importLearning:async events=>{imports.push('learning');return {added:events.length,confirmed};}});
 const pending=offer.offer({owner:ACCOUNT}),statuses=[];
 assert.ok(pending);
 assert.equal(await offer.choose('move',{owner:ACCOUNT,status:(text,busy)=>statuses.push([text,busy])}),null,'not confirmed by the server: not moved');
 assert.deepEqual(statuses.at(-1),['옮기지 못했어요. 잠시 뒤 「옮기기」를 다시 눌러 주세요.',false]);
 assert.equal(deviceRecordsDecision(storage,ACCOUNT),null);
 confirmed=true;assert.equal(await offer.choose('move',{owner:ACCOUNT}),'moved');assert.equal(await pending,'moved');
 const entry=JSON.parse(storage.getItem(DEVICE_RECORDS_KEY)).accounts[ACCOUNT];
 assert.equal(entry.decision,'moved');assert.equal(entry.moved.from,'guest-device');assert.ok(entry.moved.events>0);assert.equal(entry.through,LATER,'the records up to this choice are not offered again');
 assert.deepEqual(imports,['life','learning','life','learning']);
});

// 10-21 GPT 검수(P0): 레슨에 기준 시각 앞의 활동이 있으면 앞 사람 몫이 섞여 있어, 그 레슨과 그 레슨에서 생긴 복습은 두고 간다
// (10-21 아르곤 검수 때 「지난번에 옮긴 레슨의 복습은 옮긴다」로 했던 것을 되돌림 — 결정 표 「앞 사람 기록이 다음 사람에게 가지 않게」가 앞선다).
// 연습한 날만 있어도 판에 그 줄이 있다.
test('a lesson or review with activity before the mark stays on the device; practice days alone get their own row',()=>{
 const storage=memory(),T0=Date.parse(AT),guest=value=>storage.setItem(GUEST_LIFE_KEY,JSON.stringify({version:1,owner:'guest',...value}));
 guest({lessons:{L1:{startedAt:T0,completedAt:T0,answers:{q1:{at:T0,correct:true}}}},reviews:{R1:{lessonId:'L1',lastAt:T0+3*3600000}},daily:{version:1,days:{}}});
 assert.equal(guestLifeRecords(storage,{after:T0+3600000}),null,'레슨은 기준 앞, 그 레슨의 복습도 두고 간다');
 assert.equal(guestLifeRecords(storage,{after:T0-1}).counts.reviews,1,'레슨이 기준 뒤면 복습도 따라간다');
 guest({lessons:{},reviews:{},daily:{version:1,days:{'2026-10-20':{items:{q1:{lessonId:'L1',observedAt:T0+60000,outcome:'independent'}}}}}});
 const plan=planDeviceRecords({storage,accountId:ACCOUNT,life:true});
 assert.deepEqual(describeDeviceRecords(plan).rows,[{label:'생활 한국어',value:'연습한 날 1일'}]);
});

// 10-21 Fable 검수: 첫 「옮기기」가 서버 확인 전에 실패해 다시 고르면, 앞 시도에서 이미 더한 것을 「일부만」으로 말하지 않는다.
// 10-21 GPT 검수(P1): 그 뒤 「두기」를 고르면 서버가 받았다는 확인이 없으니 「옮김」으로 남기지 않는다 — 고른 대로 「두기」이되, 계정에 이미 더한 것이 있다고 알린다.
test('a retry after an unconfirmed save reports what the first try already added; keeping after it keeps, saying some was already added',async()=>{
 for(const second of ['move','keep']){
  const storage=memory();guestDay(storage,Date.parse(AT));const toasts=[];let calls=0;
  const offer=createDeviceRecordsOffer({storage,learningStatus:()=>learning,present:()=>{},close(){},now:()=>LATER,defer:fn=>fn(),toast:message=>toasts.push(message),
   importLife:async records=>{calls+=1;const added={lessons:records.counts.lessons,reviews:records.counts.reviews,days:records.counts.days,profile:records.counts.profile};
    if(calls===1)throw Object.assign(Error('생활 진도가 아직 계정에 저장되지 않았어요.'),{code:'LIFE_NOT_SAVED',added});return {lessons:0,reviews:0,days:0,profile:false};},
   importLearning:null});
  const pending=offer.offer({owner:ACCOUNT});assert.ok(pending);
  assert.equal(await offer.choose('move',{owner:ACCOUNT}),null,'first try: not confirmed');
  const expected=second==='move'?'moved':'kept';
  assert.equal(await offer.choose(second,{owner:ACCOUNT}),expected,second);
  assert.equal(await pending,expected);
  const entry=JSON.parse(storage.getItem(DEVICE_RECORDS_KEY)).accounts[ACCOUNT];
  assert.equal(entry.decision,expected);assert.equal(entry.cloud,undefined,'계정 한글 저장을 하지 않았다');
  if(second==='move')assert.ok(entry.moved.days>0||entry.moved.lessons>0,'the first try’s additions are recorded once the retry confirms them');
  else assert.equal(entry.moved,undefined,'확인 못 한 것은 옮긴 수로 남기지 않는다');
  assert.equal(toasts.at(-1),second==='move'?'이 기기의 학습을 내 계정으로 옮겼어요.':DEVICE_RECORDS_TEXT.pendingKept);
 }
});

// 10-21 GPT 검수(P1): 앞 단계(생활 진도)는 서버까지 확인됐고 뒤 단계(학습 기록)만 실패했으면, 그 뒤 「두기」는 옮긴 만큼을 「옮김」으로 남기고
// 다시 「옮기기」를 고르면 첫 시도의 생활 진도 수를 최종 수에 넣는다. 계정 한글 저장을 실제로 하지 않았으면 cloud로 남기지 않는다.
test('an earlier step that was confirmed is remembered when a later step fails, for both keep and a retry',async()=>{
 for(const second of ['move','keep']){
  const storage=memory();guestDay(storage,Date.parse(AT));
  const toasts=[];let learningCalls=0,lifeCalls=0;
  const offer=createDeviceRecordsOffer({storage,learningStatus:()=>learning,present:()=>{},close(){},now:()=>LATER,defer:fn=>fn(),toast:message=>toasts.push(message),
   // 다시 부르면 이미 더해 둔 것이라 0이다(받는 쪽 importRecords와 같다).
   importLife:async records=>++lifeCalls===1?{lessons:records.counts.lessons,reviews:records.counts.reviews,days:records.counts.days,profile:records.counts.profile}:{lessons:0,reviews:0,days:0,profile:false},
   importLearning:async events=>{learningCalls+=1;if(learningCalls===1)throw Object.assign(Error('offline'),{code:'OFFLINE'});return {added:events.length,confirmed:true};}});
  const pending=offer.offer({owner:ACCOUNT});assert.ok(pending);
  assert.equal(await offer.choose('move',{owner:ACCOUNT}),null,'learning failed: choose again');
  assert.equal(await offer.choose(second,{owner:ACCOUNT}),'moved',second);
  const entry=JSON.parse(storage.getItem(DEVICE_RECORDS_KEY)).accounts[ACCOUNT];
  assert.equal(entry.decision,'moved');assert.ok(entry.moved.days>0,'the confirmed life step is counted');
  if(second==='move')assert.ok(entry.moved.events>0,'the retried learning step is counted too');
  else{assert.equal(entry.moved.events,0);assert.equal(toasts.at(-1),'옮길 수 있는 기록만 내 계정으로 옮겼어요.');}
  assert.equal(entry.cloud,undefined);
 }
});

// 10-21 GPT 검수(P0): 기준 시각 앞의 몫이 섞인 기록(레슨 답·학습 목표·한글 진도)은 통째로 두고 간다 — 앞 사람 기록이 다음 사람 계정에 가지 않게.
test('records that mix work from before the mark stay on the device: a continued lesson, a partly changed goal, same-day hangul',()=>{
 const T0=Date.parse(AT),mark=T0+3600000;
 // 레슨: 기준 앞의 답 하나 + 뒤의 답 하나 → 두고 간다. 기준 뒤에만 답한 레슨은 옮긴다.
 const mixed=memory();mixed.setItem(GUEST_LIFE_KEY,JSON.stringify({version:1,owner:'guest',lessons:{L1:{startedAt:T0,completedAt:null,answers:{q1:{at:T0,correct:true},q2:{at:mark+60000,correct:false}}},
  L2:{startedAt:mark+1000,completedAt:mark+9000,answers:{q1:{at:mark+2000,correct:true}}}},reviews:{},daily:{version:1,days:{}}}));
 assert.deepEqual(Object.keys(guestLifeRecords(mixed,{after:mark}).lessons),['L2']);
 // 학습 목표: 앞 사람이 정한 시험 목표가 남은 판에서 뒤에 한 칸만 바꿨으면 두고 간다. 모든 칸을 뒤에 다시 정했으면 옮긴다.
 let tick=T0;const goal=memory(),life=createLifeProgress({storage:goal,owner:'guest',now:()=>tick,uuid:()=>'g'});life.summary(PACKS,LESSONS);
 life.updateLearningProfile({consent:true,expectedRevision:0,values:{reasons:['exam'],primaryReason:'exam',examType:'topik1',targetGrade:2}});
 tick=mark+60000;life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{support:'step'}});
 assert.equal(guestLifeRecords(goal,{after:mark}),null,'only one field was declared after the mark');
 tick=mark+120000;life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{reasons:['travel'],primaryReason:'travel',support:'choose'}});
 const redeclared=guestLifeRecords(goal,{after:mark});
 assert.deepEqual(redeclared.profile.values,{reasons:['travel'],primaryReason:'travel',support:'choose'},'every field is now declared after the mark (changing the reason forgot the test details)');
 // 옛 판처럼 시험 이유 없이 시험 칸이 남은 목표는 그 칸을 떼고 넘긴다(받는 쪽 저장 규칙이 거절하지 않게).
 const legacy=memory(),at=new Date(mark+1000).toISOString(),source={source:'self-declared',confidence:'declared',at,revision:1};
 legacy.setItem(GUEST_LIFE_KEY,JSON.stringify({version:1,owner:'guest',lessons:{},reviews:{},daily:{version:1,days:{}},learningProfile:{profile:{status:'active',consent:true,
  values:{reasons:['travel'],examType:'topik1',targetGrade:2},provenance:{reasons:source,examType:source,targetGrade:source},createdAt:at,updatedAt:at}}}));
 assert.deepEqual(guestLifeRecords(legacy,{after:mark}).profile.values,{reasons:['travel']});
 // 한글: 같은 날 앞 사람이 한 진도(회차는 날짜만 있다)는 그날 늦은 시각으로 치지 않는다 — 로그아웃 뒤 새 활동이 없으면 묻지 않는다.
 const hangul=memory();hangul.setItem(HANGUL_DEVICE_KEY,JSON.stringify(guestHangul()));noteDeviceSignOut(hangul,mark);
 assert.equal(planDeviceRecords({storage:hangul,learning,accountId:ACCOUNT}),null,'same-day progress from before the sign-out is not offered');
 const earlier=memory();earlier.setItem(HANGUL_DEVICE_KEY,JSON.stringify(guestHangul()));noteDeviceSignOut(earlier,Date.parse('2026-10-18T14:00:00.000Z'));
 assert.ok(planDeviceRecords({storage:earlier,learning,accountId:ACCOUNT})?.hangul,'progress made entirely after the sign-out is offered');
});

// 10-21 GPT 검수(P2): 계정에 이미 있는 날에 그 날 없던 문항을 더하면 그 날도 더한 날로 센다(옮긴 결과가 「이미 있음」으로 보이지 않게).
test('adding new questions to a day the account already has counts as an added day',()=>{
 const first=memory(),second=memory();
 guestDay(first,Date.parse(AT));guestDay(second,Date.parse(AT)+600000,LESSONS.find(row=>row.id!==lesson.id&&row.questions?.length&&!row.id.startsWith('cafe')));
 const account=createLifeProgress({storage:memory(),owner:ACCOUNT,now:()=>LATER,uuid:()=>'acct'});account.summary(PACKS,LESSONS);
 const a=guestLifeRecords(first),b=guestLifeRecords(second);
 assert.deepEqual(Object.keys(a.days),Object.keys(b.days),'the same practice day');
 assert.equal(account.importRecords({days:a.days}).days,1);
 assert.equal(account.importRecords({days:b.days}).days,1,'the existing day got new questions');
 assert.equal(account.importRecords({days:b.days}).days,0,'nothing new the third time');
});

// 10-21 GPT 재확인(P0 잔여): 판을 띄운 뒤 옮기는 순간에 다시 읽는 한글 원본에도 판을 만들 때의 기준 시각을 다시 건다.
test('the hangul copy is checked against the mark again when it is moved (it may have changed while the sheet was open)',async()=>{
 const storage=memory();storage.setItem(HANGUL_DEVICE_KEY,JSON.stringify(guestHangul()));
 noteDeviceSignOut(storage,Date.parse('2026-10-18T14:00:00.000Z'));
 const plan=planDeviceRecords({storage,learning,accountId:ACCOUNT});assert.ok(plan?.hangul,'made after the mark: offered');
 storage.setItem(HANGUL_DEVICE_KEY,JSON.stringify(meet(emptyProgress(),['g-giyeok'],'2026-10-18T05:00:00.000Z')));
 const result=await applyDeviceRecords(plan,{storage});
 assert.equal(result.hangul,'gone');assert.equal(storage.getItem(target),null,'nothing reached the account');
});

// 10-21 GPT 재확인(새 P2): 계정 한글 저장이 있는 상태에서 일부만 옮기고 「두기」를 골랐으면, 다음에 열 때 그 한글을 다시 묻지 않는다
// (cloud는 「계정 한글 저장이 있는 상태에서 고른 결정」 — 옛 기기 안 이전만 계정 저장으로 다시 묻는다).
test('keeping after a partial move with the account hangul store does not ask about the same hangul again',async()=>{
 const storage=memory();guestDay(storage,Date.parse(AT));storage.setItem(HANGUL_DEVICE_KEY,JSON.stringify(guestHangul()));
 const port={accountId:ACCOUNT,read:()=>null,importSnapshot:async()=>{throw Object.assign(Error('한글 진도 계정 저장을 확인하지 못했어요.'),{code:'HANGUL_NOT_SAVED'});}};
 const make=()=>createDeviceRecordsOffer({storage,learningStatus:()=>learning,present:()=>{},close(){},now:()=>LATER,defer:fn=>fn(),toast(){},hangulPort:()=>port,
  importLife:async records=>({lessons:records.counts.lessons,reviews:records.counts.reviews,days:records.counts.days,profile:records.counts.profile}),importLearning:null});
 const offer=make(),pending=offer.offer({owner:ACCOUNT});assert.ok(pending);
 assert.equal(offer.pending().plan.hangul?.cloud,true);
 assert.equal(await offer.choose('move',{owner:ACCOUNT}),null,'the hangul step was not confirmed');
 assert.equal(await offer.choose('keep',{owner:ACCOUNT}),'moved','the confirmed life step counts as moved');
 const entry=JSON.parse(storage.getItem(DEVICE_RECORDS_KEY)).accounts[ACCOUNT];
 assert.equal(entry.cloud,true,'decided with the account hangul store');
 assert.equal(make().offer({owner:ACCOUNT}),null,'a fresh page does not ask about the kept hangul again');
});

// 10-21 GPT 마지막 확인(P0 잔여): 검사한 원본과 옮기는 원본이 같아야 한다 — 옮길 때 읽은 그 글 하나를 기준 시각으로 보고 그대로 옮긴다.
test('the hangul text that is checked is the very text that is moved (no second read)',async()=>{
 const storage=memory(),fresh=JSON.stringify(guestHangul()),stale=JSON.stringify(meet(emptyProgress(),['g-giyeok'],'2026-10-18T05:00:00.000Z'));
 storage.setItem(HANGUL_DEVICE_KEY,fresh);noteDeviceSignOut(storage,Date.parse('2026-10-18T14:00:00.000Z'));
 const plan=planDeviceRecords({storage,learning,accountId:ACCOUNT});assert.ok(plan?.hangul);
 // 옮기는 순간: 첫 읽기는 앞 사람 몫이 섞인 글, 그 뒤 읽기는 이 사람의 글을 주는 저장소.
 let reads=0;const flipping={...storage,getItem:key=>key===HANGUL_DEVICE_KEY?(reads++===0?stale:fresh):storage.getItem(key),setItem:(key,value)=>storage.setItem(key,value)};
 const result=await applyDeviceRecords(plan,{storage:flipping});
 assert.equal(result.hangul,'gone');assert.equal(storage.getItem(target),null,'the stale text never reaches the account');
});

test('capacity-limited life imports report partial progress, retain device originals and can be offered again to the same account',async()=>{
 for(const count of [99,100]){
  const storage=memory(),accountStorage=memory(),day='2026-10-19',item={lessonId:'lesson',observedAt:Date.parse(AT),outcome:'independent'};
  const record=(owner,items)=>({version:1,owner,revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{},daily:{version:1,days:{[day]:{items}}}});
  const own=record(ACCOUNT,Object.fromEntries(Array.from({length:count},(_,i)=>['q'+i,{...item}])));
  accountStorage.setItem(LIFE_PROGRESS_KEY,JSON.stringify(own));
  storage.setItem(GUEST_LIFE_KEY,JSON.stringify(record('guest',{q0:{...item},qa:{...item},qb:{...item}})));
  const original=storage.getItem(GUEST_LIFE_KEY),progress=createLifeProgress({storage:accountStorage,owner:ACCOUNT,mode:'account',now:()=>LATER,getSaveStatus:()=>({phase:'synced',pending:0})});
  const toasts=[],responses=[];
  const make=()=>createDeviceRecordsOffer({storage,learningStatus:()=>learning,present(){},close(){},now:()=>LATER,defer:fn=>fn(),toast:value=>toasts.push(value),
   importLife:async records=>{const result=progress.importRecords(records);await progress.flush();responses.push(result);return result;}});
  const offer=make(),pending=offer.offer({owner:ACCOUNT});assert.ok(pending);
  assert.equal(await offer.choose('move',{owner:ACCOUNT}),'moved');assert.equal(await pending,'moved');
  assert.equal(responses[0].capacitySkipped.questions,count===99?1:2);
  assert.equal(toasts.at(-1),`${count===99?DEVICE_RECORDS_TEXT.partly:DEVICE_RECORDS_TEXT.snapshot} ${DEVICE_RECORDS_TEXT.snapshotBody}`);
  assert.equal(storage.getItem(GUEST_LIFE_KEY),original,'the guest source remains byte-identical');
  const saved=progress.exportSnapshot();assert.equal(Object.keys(saved.daily.days[day].items).length,100);
  for(const [id,value]of Object.entries(own.daily.days[day].items))assert.deepEqual(saved.daily.days[day].items[id],value);
  const entry=JSON.parse(storage.getItem(DEVICE_RECORDS_KEY)).accounts[ACCOUNT];assert.equal(entry.through,0,'the zero cutoff must not become the decision timestamp');
  const again=make(),againPending=again.offer({owner:ACCOUNT});assert.ok(againPending,'remaining source can be offered on a fresh page');
  assert.equal(make().offer({owner:OTHER}),null,'the prior account presence still protects its records from another account');
  await again.choose('keep',{owner:ACCOUNT});await againPending;
 }
});

test('capacity retry preserves a previous account cutoff and cannot bypass a later sign-out',async()=>{
 const storage=memory(),old=Date.parse(AT)-1000,item={lessonId:'lesson',observedAt:Date.parse(AT),outcome:'independent'};
 storage.setItem(GUEST_LIFE_KEY,JSON.stringify({version:1,owner:'guest',lessons:{},reviews:{},daily:{version:1,days:{'2026-10-19':{items:{old:{...item,observedAt:old-1000},recent:item}}}}}));
 saveDeviceRecordsDecision(storage,ACCOUNT,'moved',old,{through:old});
 const make=()=>createDeviceRecordsOffer({storage,learningStatus:()=>learning,present(){},close(){},now:()=>LATER,defer:fn=>fn(),toast(){},
  importLife:async records=>{assert.deepEqual(Object.keys(records.days['2026-10-19'].items),['recent']);return {lessons:0,reviews:0,days:0,profile:false,capacitySkipped:{questions:1}};}});
 const offer=make(),pending=offer.offer({owner:ACCOUNT});assert.ok(pending);await offer.choose('move',{owner:ACCOUNT});await pending;
 assert.equal(JSON.parse(storage.getItem(DEVICE_RECORDS_KEY)).accounts[ACCOUNT].through,old);
 noteDeviceSignOut(storage,LATER+1);assert.equal(make().offer({owner:ACCOUNT}),null,'sign-out remains the privacy boundary');
});
