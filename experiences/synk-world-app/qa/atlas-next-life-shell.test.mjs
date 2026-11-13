// Atlas 단계 4-2 생활 — 셸(app-shell.mjs)의 진짜 문장을 떼어 돈다(셸은 node에서 못 올린다 — tests/lib/source-statements.cjs).
// ① 알림 입력(reminderInputs)의 세 갈래: 판정 없음(지금 판 — 진도의 dueAt) · 확인 중(복습 때 없음) · 엔진(판정의 때).
// ② 생활 배선(mountLifeLearning)을 깃발마다: 입구를 받는 수 · 생활 화면에 넘긴 learning 열쇠 · 홈 계획(createPlan)에 넘긴 due · 알림 입력.
// 입구(lazyAtlasNext) · 판정 감시(watchLifeDue) · 화면 · 학습 화면 · 알림은 가짜이고, 깃발 식(atlasNextOn · atlasNextGuestOn)은 셸 원문 그대로다.
// Fable 5.2 합친 끝 판 넘친 #11(atlas-redesign-stage4-acct-life-final-20261113 — 꺼진 판 갈래는 atlas-next-off.test.mjs도 본다).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sourceStatements} from '../../../tests/lib/source-statements.cjs';

const DAY=86400000,NOW=Date.UTC(2026,10,13,3,0,0);
const statements=sourceStatements(fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8'));
const reminderSource=statements.function('reminderInputs');
// 바깥 이름은 life · studyTimes 둘이다. 이 모듈의 Date(시험의 Date 흉내)로 돈다.
const reminderInputs=(life,studyTimes=()=>[])=>new Function('life','studyTimes',`'use strict';${reminderSource}\nreturn reminderInputs;`)(life,studyTimes)();
const plain=value=>JSON.parse(JSON.stringify(value));

test('셸 알림 입력(원문)의 세 갈래 — 판정 없음은 진도의 dueAt · 확인 중은 복습 때 없음 · 엔진은 판정의 때, 판정이 있으면 돌아올 것은 복습 기록이 있는가(Fable 5.2 합친 끝 판 넘친 #11)',t=>{
 t.mock.timers.enable({apis:['Date'],now:NOW});
 const reviews={'r-1':{dueAt:NOW+60000},'r-2':{dueAt:NOW-DAY},'r-3':{dueAt:null}},calls=[];
 const lifeDue=value=>({judge:(snapshot,now)=>{calls.push([snapshot,now]);return value;}});
 const life=(due,snapshot={reviews},education=null)=>({progress:{exportSnapshot:()=>snapshot},education,lifeDue:due});
 // (가) 판정 없음 — 입구가 없어 lifeDue가 없거나, 이 문서가 지금 판으로 정해져 판정이 null이다.
 for(const due of [null,undefined,lifeDue(null)]){
  const value=reminderInputs(life(due));
  assert.deepEqual([value.reviews,value.hasReturn],[[NOW+60000,NOW-DAY],true],'진도의 dueAt 그대로(수가 아닌 것만 뺀다)');
  assert.equal(reminderInputs(life(due,{reviews:{'r-3':reviews['r-3']}})).hasReturn,false,'때(dueAt)가 있는 복습이 없으면 돌아올 것이 없다');
 }
 // (나) 확인 중 — 복습 알림을 잡지 않는다(엔진이 되면 진도가 다시 부른다). 돌아올 것은 복습 기록이 있는가.
 const checking=reminderInputs(life(lifeDue({state:'checking',ids:[],times:[NOW+5]})));
 assert.deepEqual([checking.reviews,checking.hasReturn],[[],true],'확인 중에는 복습 때가 없다');
 assert.equal(reminderInputs(life(lifeDue({state:'checking'}),{reviews:{}})).hasReturn,false);
 assert.equal(reminderInputs(life(lifeDue({state:'checking'}),{reviews:{'r-3':reviews['r-3']}})).hasReturn,true,'판정이 있으면 복습 기록이 있는 것만으로 돌아올 것이 있다');
 // (다) 엔진 — 판정의 때(돌아온 것 · 앞으로 열릴 것) 그대로 · 진도의 dueAt은 읽지 않는다.
 const times=[NOW+3600000,NOW+2*DAY];
 const engine=reminderInputs(life(lifeDue({state:'engine',ids:['r-1'],times})));
 assert.deepEqual([engine.reviews,engine.hasReturn],[times,true]);
 assert.notEqual(engine.reviews,times,'판정의 배열을 그대로 넘기지 않는다(알림이 고쳐도 판정은 그대로)');
 assert.deepEqual(reminderInputs(life(lifeDue({state:'engine',ids:[],times:[]}),{reviews:{'r-3':reviews['r-3']}})).reviews,[]);
 // 판정은 진도의 지금 기록과 지금 시각으로 한 번 잰다.
 calls.length=0;
 const snapshot={reviews};
 reminderInputs(life(lifeDue({state:'engine',ids:[],times:[]}),snapshot));
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],snapshot);
 assert.equal(calls[0][1],NOW);
 // 시험 날짜(YYYY-MM-DD)는 세 갈래 모두 돌아올 것이다.
 const exam={metrics:()=>({plan:{examPlan:{exam:{date:'2027-01-17'},goals:[]}}})};
 for(const due of [null,lifeDue({state:'checking'}),lifeDue({state:'engine',ids:[],times:[]})]){
  const value=reminderInputs(life(due,{reviews:{}},exam));
  assert.deepEqual([value.hasReturn,value.exam],[true,{date:'2027-01-17'}]);
 }
});

// 셸 한 벌 — mountLifeLearning을 그대로 돌린다. keep은 생활 세션처럼 조각을 이름으로 들고(life.lifeDue · life.education이 그것을 읽는다), 붙인 차례를 남긴다.
function shell({features={},owner='acct-1',operating=true}={}){
 const seen={entries:[],watches:[],life:[],education:[],plans:[],reminders:[],kept:[],judges:[],opens:0};
 const judged={state:'engine',ids:['r-1'],nextAt:null,times:[NOW+1],upcoming:[]};
 const progress={owner,exportSnapshot:()=>({reviews:{'r-1':{dueAt:NOW-DAY}}})};
 const parts=new Map(),releases=[];
 const keep=(name,value,dispose=v=>v?.dispose?.())=>{seen.kept.push(name);parts.set(name,value);releases.push(()=>dispose(value));return value;};
 const context={console,Promise,queueMicrotask,
  connection:{mode:operating?'account':'rehearsal',features},
  lazyAtlasNext:who=>{const entry={owner:who,lifeCoach:async()=>{seen.opens+=1;return null;},retired:()=>()=>{},reopened:()=>()=>{},note(){},dispose(){}};seen.entries.push(entry);return entry;},
  worldLearning:{life:{watchLifeDue:options=>{seen.watches.push(options);return {judge:(snapshot,now)=>{seen.judges.push([snapshot,now]);return judged;},state:()=>'engine',coach:()=>'coach',nextAt:id=>`at:${id}`,dispose(){}};}},engine:{createGame(){}},createLearningSync(){}},
  LESSONS:['레슨'],hangulMigrationPort:null,
  createLifeExperience:options=>{seen.life.push(options);return {start(){},reviewStart(){},dispose(){}};},
  home:{connectEducation(){},connectPlayLevel(){},connectReminders(){},toast(){}},
  life:{get progress(){return progress;},get lifeDue(){return parts.get('lifeDue')??null;},get education(){return parts.get('education')??null;},answers:null},
  worldUrl:value=>value,show(){},repaintWritingRow(){},writingRow:()=>'',speakingModule:null,
  createWorldLearningPlan:options=>{seen.plans.push(options);return {selected:null};},
  operating,client:{snapshot:owner==='guest'?null:{accountId:owner}},guestGames:()=>['hangul'],
  createWorldEducation:options=>{seen.education.push(options);return {dispose(){},metrics:()=>({plan:null}),townEvidence:()=>null};},
  worldPosition:{},responsesOn:false,account:{},launchGame(){},classworkThisWeek(){},writingReady:()=>false,writingCandidates:()=>[],
  localStorage:{getItem:()=>null,setItem(){}},writingOwnerId:()=>owner,openWriting(){},readWritingSummary:()=>({times:[]}),openSpeaking(){},prepareLearningHost(){},
  worldTownCheck:{topik2Near:()=>false},town(){},quietTownCheck(){},townEntry:null,window:{},
  createTrailTimes:()=>({read:()=>[],dispose(){}}),
  createWorldReminders:options=>{seen.reminders.push(options);return {schedule(){},dispose(){},askMarkup:()=>''};},
  studyTimes:()=>[],openReminder(){},repaintReminderCard(){},worldPush:null,pushOn:false,close(){},
 };
 vm.createContext(context);
 const run=text=>vm.runInContext(text,context);
 run(statements.declaration('atlasNextOn'));
 run(statements.declaration('atlasNextGuestOn'));
 run(reminderSource);
 run(statements.function('mountLifeLearning'));
 run('mountLifeLearning')({owner,progress,keep});
 return {seen,judged,release:()=>{for(const release of releases.reverse())release();}};
}

test('셸 생활 배선(원문 mountLifeLearning) — 입구는 atlasNext가 켜지고 계정이거나 손님 깃발이 켜졌을 때만 받고, 그때만 생활 화면에 next · 홈 계획에 due를 넘기며 알림이 판정을 읽는다(Fable 5.2 합친 끝 판 넘친 #11)',()=>{
 const OFF=['hangulMigration','ui','education','trail','reminders'],ON=['atlasNext','lifeDue',...OFF];
 for(const [label,options,on] of [
  ['꺼짐 · 계정',{features:{},owner:'acct-1'},false],
  ['꺼짐 · 손님',{features:{},owner:'guest'},false],
  ['손님 깃발만(atlasNext 없음 — 뜻 없음) · 손님',{features:{atlasNextGuest:true},owner:'guest'},false],
  ['atlasNext가 참(true)이 아닌 값 · 계정',{features:{atlasNext:'true',atlasNextGuest:true},owner:'acct-1'},false],
  ['켬 · 손님 깃발 끔 · 손님',{features:{atlasNext:true},owner:'guest'},false],
  ['켬 · 손님 깃발 끔 · 계정',{features:{atlasNext:true},owner:'acct-1'},true],
  ['켬 · 손님 깃발 켬 · 손님',{features:{atlasNext:true,atlasNextGuest:true},owner:'guest'},true],
  ['켬 · 손님 깃발 켬 · 계정(리허설)',{features:{atlasNext:true,atlasNextGuest:true},owner:'acct-1',operating:false},true],
 ]){
  const {seen,judged,release}=shell(options);
  try{
   // 입구 받기 · 판정 감시
   assert.deepEqual(seen.entries.map(entry=>entry.owner),on?[options.owner]:[],`${label}: 입구를 받는 수`);
   assert.equal(seen.watches.length,on?1:0,`${label}: 판정 감시`);
   assert.deepEqual(seen.kept,on?ON:OFF,`${label}: 붙인 조각과 차례(입구가 생활 화면보다 먼저)`);
   if(on){
    const [watch]=seen.watches;
    assert.deepEqual(watch.lessons,['레슨']);
    void watch.open();assert.equal(seen.opens,1,`${label}: 판정 감시가 여는 코치는 그 입구의 생활 코치`);
   }
   // 생활 화면에 넘긴 learning — 꺼진 판은 { coach · prepare · life } 그대로(4-2 앞), 켜진 판만 판 겉 입구(next)를 더한다.
   const learning=seen.life[0].learning;
   assert.deepEqual(Object.keys(learning),on?['coach','prepare','life','next']:['coach','prepare','life'],`${label}: learning 열쇠`);
   if(on)assert.deepEqual([learning.next.state(),learning.next.nextAt('r-1'),learning.next.coach()],['engine','at:r-1','coach'],`${label}: next는 그 판정 감시를 읽는다`);
   // 학습 화면의 입구 · 홈 계획의 판정(due)
   assert.equal(seen.education[0].atlasNext,on?seen.entries[0]:null,`${label}: 학습 화면의 입구`);
   const snapshot={reviews:{}};
   seen.education[0].createPlan({progress:snapshot,now:1234,settings:{}});
   assert.equal(Object.hasOwn(seen.plans[0],'due'),on,`${label}: 홈 계획에 due를 넘기는가`);
   if(on){
    assert.equal(seen.plans[0].due,judged,`${label}: due는 판정 감시가 잰 판정`);
    assert.deepEqual(seen.judges.at(-1),[snapshot,1234],`${label}: 계획이 준 진도 · 시각으로 잰다`);
    const before=Date.now();seen.education[0].createPlan({progress:snapshot,settings:{}});
    assert.ok(seen.judges.at(-1)[1]>=before&&seen.judges.at(-1)[1]<=Date.now(),`${label}: 시각이 없으면 지금`);
   }
   // 알림 입력은 같은 판정을 읽는다(켜진 판 — 엔진의 때) · 꺼진 판은 진도의 dueAt.
   assert.deepEqual(plain(seen.reminders[0].read()).reviews,on?[NOW+1]:[NOW-DAY],`${label}: 알림 입력의 복습 때`);
  }finally{release();}
 }
});

// 셸 입구 겉(lazyAtlasNext) 원문 — 동적 import 자리만 시험의 받기(loadEntry)로 바꿔 끼운다.
const lazySource=statements.function('lazyAtlasNext').replace("import('./world-atlas-next.mjs')",'loadEntry()');
function lazyShell({operating=true,loadEntry,client={generation:1,snapshot:{accountId:'acct-1'},accessToken:'tok',tabId:'tab',expire(){}},account={prepareAtlasTrail:()=>({})}}={}){
 return new Function('operating','account','client','currentLang','hasString','t','loadEntry',`'use strict';${lazySource}\nreturn lazyAtlasNext;`)(operating,account,client,()=>'ko',()=>false,key=>key,loadEntry);
}
function fakeEntry(){
 const seen={notes:[],options:null,trail:null,disposed:false};
 const entry={reopened(){},practiceCoach:async()=>'practice-coach',lifeCoach:async()=>'life-coach',note:(kind,outcome)=>seen.notes.push([kind,outcome?.code??null]),retired:()=>()=>{},guestMove:async()=>null,noteLogout:async()=>false,redecide(){},health:()=>null,dispose(){seen.disposed=true;}};
 return {seen,module:{createAtlasNext:options=>{seen.options=options;return entry;},rehearsalTrail:options=>{seen.trail=options;return {};}}};
}

test('셸 입구 겉(원문 lazyAtlasNext) — 입구 모듈을 한 번 못 받아 면에 지금 판을 준 뒤 다음에 받으면 판이 풀렸다고 한 번 알리고, 받기 전의 계기는 모았다가 흘려보낸다(Fable 5.2 합친 끝 판 F9)',async()=>{
 assert.ok(lazySource.includes('loadEntry()'),'입구 받기 자리를 바꿔 끼웠다');
 const {seen,module}=fakeEntry();let tries=0;
 const lazy=lazyShell({loadEntry:()=>++tries===1?Promise.reject(Error('모듈')):Promise.resolve(module)})('acct-1');
 const reopened=[];lazy.reopened(detail=>reopened.push(detail));
 lazy.note('save',{ok:false,code:'LIFE_NO_COACH'});
 await assert.rejects(lazy.lifeCoach(),/모듈/,'첫 받기 실패 — 생활 판정은 지금 판');
 assert.deepEqual(reopened,[]);
 assert.equal(await lazy.practiceCoach([]),'practice-coach','다음에 받으면 짧은 연습은 새 길');
 assert.deepEqual(reopened,[{reason:'loaded'}],'받기 실패로 지금 판을 준 뒤 받았으니 한 번 알린다(생활 판정이 다시 묻는다)');
 assert.deepEqual(seen.notes,[['save','LIFE_NO_COACH']],'받기 전의 계기를 흘려보낸다');
 assert.equal(await lazy.lifeCoach(),'life-coach');
 assert.equal(reopened.length,1,'한 번만');
 lazy.note('load',{ok:true});
 assert.equal(seen.notes.length,2,'받은 뒤에는 바로 넘긴다');
 lazy.dispose();lazy.note('save',{ok:false,code:'AFTER'});
 assert.equal(seen.notes.length,2,'닫은 뒤의 계기는 버린다');
 // 처음부터 받으면 알리지 않는다
 const fine=fakeEntry(),quiet=lazyShell({loadEntry:()=>Promise.resolve(fine.module)})('acct-1'),heard=[];quiet.reopened(d=>heard.push(d));
 await quiet.lifeCoach();assert.deepEqual(heard,[],'받기 실패가 없었으면 알림도 없다');
 // 받기 전 계기는 50개까지만 모은다
 const many=fakeEntry(),lots=lazyShell({loadEntry:()=>Promise.resolve(many.module)})('acct-1');
 for(let i=0;i<60;i+=1)lots.note('save',{ok:false,code:'EARLY'});
 await lots.lifeCoach();assert.equal(many.seen.notes.length,50);
});

test('셸 입구 겉(원문) — 리허설 나르개의 401은 그 나르개를 만든 로그인의 세대 · 주인일 때만 로그인으로 보낸다(Fable 5.2 합친 끝 판 넘친 #26 · #27 배선)',async()=>{
 const {seen,module}=fakeEntry();
 const client={generation:4,snapshot:{accountId:'acct-1'},accessToken:'tok',tabId:'tab',expired:0,expire(){this.expired+=1;}};
 const lazy=lazyShell({operating:false,client,loadEntry:()=>Promise.resolve(module)})('acct-1');
 await lazy.practiceCoach([]);
 const trail=seen.trail;assert.equal(typeof trail?.onAuth,'function','리허설은 나르개를 만든다');
 assert.deepEqual(trail.headers(),{Authorization:'Bearer tok','X-Synk-Rehearsal-Tab':'tab'});
 assert.equal(trail.owner(),'acct-1');
 trail.onAuth();assert.equal(client.expired,1,'같은 로그인의 401은 로그인으로(client.expire)');
 client.generation=5; // 로그아웃 뒤 같은 합성 계정으로 다시 들어온 새 로그인
 trail.onAuth();assert.equal(client.expired,1,'앞 로그인의 늦은 401은 새 로그인을 건드리지 않는다');
 client.generation=4;client.snapshot={accountId:'acct-2'};
 trail.onAuth();assert.equal(client.expired,1,'다른 계정이면 버린다');
 // 운영은 계정 길(prepareAtlasTrail), 손님은 나르개 없음
 const op=fakeEntry(),calls=[];
 const operated=lazyShell({operating:true,account:{prepareAtlasTrail:()=>calls.push('trail')},loadEntry:()=>Promise.resolve(op.module)})('acct-1');
 await operated.practiceCoach([]);op.seen.options.trail();assert.deepEqual(calls,['trail']);
 const guest=fakeEntry(),visitor=lazyShell({operating:false,loadEntry:()=>Promise.resolve(guest.module)})('guest');
 await visitor.practiceCoach([]);assert.equal(guest.seen.options.trail,null);
});

// 학습 기록 토글(원문 change 듣개) — 저장이 실패하면 계정을 한 번 다시 읽고, 다시 읽기가 끝날 때까지 토글을 잠근다(먼저 풀면 옛 체크 · 판 번호로
// 다시 눌러 또 실패했다 — 카본 Fable 처리 다시 검수 A1). 다시 읽기가 끝나면 프로필을 다시 그린다(넘친 #12).
test('학습 기록 토글 실패 — 계정 다시 읽기가 끝날 때까지 토글을 잠그고, 끝나면 풀고 프로필을 다시 그린다(셸 원문 change 듣개 · 카본 A1 · 넘친 #12)',async()=>{
 const shell=fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8');
 const head="document.addEventListener('change',";
 const start=shell.indexOf(head);
 assert.ok(start>0,'change 듣개');
 const end=shell.indexOf('\n',shell.indexOf("control.disabled=false;});});",start));
 const body=shell.slice(start+head.length,shell.lastIndexOf(');',end));
 let release;
 const refreshed=new Promise(resolve=>{release=resolve;});
 const calls=[];
 const account={
  setLearning:async()=>{throw Object.assign(new Error('뒤 확인 실패'),{code:'NETWORK'});},
  refreshLearning:()=>{calls.push('refresh');return refreshed;},
 };
 const control={checked:true,disabled:false,dataset:{revision:'3'},matches:selector=>selector==='[data-world-learning]'};
 const listen=new Function('account','life','client','home','errorText','profile','town','screen',`'use strict';return (${body});`)(
  account,{owner:'acct-1',atlasNext:{redecide:()=>calls.push('redecide')}},{snapshot:{accountId:'acct-1'}},
  {toast:()=>calls.push('toast')},error=>error.message,()=>calls.push('profile'),()=>{},'world-profile');
 listen({target:control});
 assert.equal(control.disabled,true,'누르면 잠근다');
 for(let i=0;i<5;i+=1)await Promise.resolve();
 assert.deepEqual(calls,['toast','redecide','refresh'],'실패를 알리고 판을 다시 정하고 계정을 다시 읽는다');
 assert.equal(control.checked,false,'되돌린 값');
 assert.equal(control.disabled,true,'다시 읽기가 끝나기 전에는 잠근 채');
 release({enabled:false,revision:4});
 for(let i=0;i<5;i+=1)await Promise.resolve();
 assert.equal(control.disabled,false,'다시 읽은 뒤 푼다');
 assert.deepEqual(calls.slice(3),['profile'],'서버 값으로 프로필을 다시 그린다');
});
