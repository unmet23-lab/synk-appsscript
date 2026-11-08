// 쓰기 연습을 말하기(E)와 같은 길로(2026-11-09, docs/_ops/qa/atlas-world-engine-20261108/쓰기_같은길.md): 점검 시도가 게임을 연 뒤에도 계정 Trail에 남는다
// (앱 셸 practiceCoach · 쓰기 record), 끝난 코치를 놓는다(기기 코치는 dispose), 손님 코치는 재확인을 지키며 접는다, 홈 후보는 문항 열쇠를 달지 않는다(판단).
// 실제 WORLD 코치(world-learning-map.mjs)와 실제 쓰기 화면(world-writing-practice.mjs)을 가짜 문서로 누른다. 게임 뒤의 실제 Edge 동작은 쓰기_브라우저확인.mjs가 잰다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createWritingPractice,loadWritingBank,writingCandidates,readWritingSummary,WRITING_CANDIDATES,WRITING_SKILLS} from '../world-writing-practice.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import {createTrailTimes} from '../world-reminder-device.mjs';
import {planTokens} from '../world-exam-plan.mjs';

const BANK=JSON.parse(fs.readFileSync(new URL('../world-writing-items.json',import.meta.url),'utf8'));
const OPEN=BANK.items.filter(item=>item.review?.status==='passed');
const first=type=>OPEN.find(item=>item.type===type);
const SHELL=fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8');
const DAY=86400000;
// 은행은 모듈 하나에 한 번 읽힌다(loadWritingBank 기억) — 모든 시험이 같은 은행을 쓴다.
const bankReady=loadWritingBank(async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(fileURLToPath(url),'utf8'))}));
const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};

// 가짜 문서: 쓰기 시트의 뿌리 하나. 입력 · 누름은 붙은 처리기를 직접 부른다.
function sheet(){
 const node=()=>({textContent:'',innerHTML:'',outerHTML:'',hidden:false,disabled:false,dataset:{},style:{setProperty(){}},focus(){},setAttribute(){},removeAttribute(){},remove(){},insertAdjacentHTML(){},
  querySelector:()=>node(),querySelectorAll:()=>[],contains:()=>true,closest:()=>null,previousElementSibling:null,tagName:'DIV'});
 const handlers={},stage=node();let html='';
 const root={...node(),addEventListener:(type,fn)=>{handlers[type]=fn;},removeEventListener(){},get firstElementChild(){return stage;}};
 Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{html=value;}});
 stage.parentElement=root;
 const doc={querySelector:selector=>selector==='#panel-content [data-ww-stage]'?stage:null,visibilityState:'visible',defaultView:{confirm:()=>true}};
 const type=(blank,value)=>handlers.input?.({target:{dataset:{wwBlank:blank},value,matches:s=>s==='[data-ww-blank]'}});
 const press=(attr,dataset={})=>{const button={...node(),dataset,hasAttribute:name=>name===attr};button.closest=()=>button;handlers.click?.({target:button});};
 return {doc,type,press,html:()=>html};
}
// 쓰기 화면 하나: coach()는 시험이 정한다(실제 코치 · 앱 셸 practiceCoach · 가짜). 시트는 한 번만 연다(열 때마다 화면 타이머가 걸린다 — 닫을 때 close).
async function bench(coach,{owner='guest',storage=memory()}={}){
 let tick=Date.parse('2026-11-09T03:00:00Z');const now=()=>tick+=1000,page=sheet(),resources=[];
 const practice=createWritingPractice({show(){},home:{attachPanelResource:resource=>resources.push(resource),toast(){}},getOwner:()=>owner,storage,coach,now,doc:page.doc,fetcher:async()=>{throw Error('bank is preloaded');}});
 await practice.open('writing');
 // 51 · 52번 문항 하나를 목록에서 열어 빈칸을 채우고 규칙 점검을 누른 뒤 목록으로 돌아온다. model이면 점검 전에 예시답을 연다(도움 answer).
 const check=(item,text='저는 주말마다 도서관에서 책을 읽습니다.',{model=false}={})=>{page.press('data-ww-open',{wwOpen:item.id});if(model)page.press('data-ww-model');for(const blank of item.blanks)page.type(blank.id,text);page.press('data-ww-check');page.press('data-ww-back');};
 const close=()=>{practice.dispose();for(const r of resources.splice(0))r.dispose();};
 return {practice,page,storage,check,close,log:()=>JSON.parse(storage.getItem(`synk.world.writing.v1:${owner}`)||'{"log":[]}').log};
}
const writingOf=(events,item)=>{const shown=events.filter(e=>e.type==='practice.presented'&&e.itemKey===`writing.${item.id}`),ids=new Set(shown.map(e=>e.id));
 return {shown:shown.length,attempts:events.filter(e=>e.type==='practice.attempted'&&ids.has(e.presentationId)).map(e=>[e.attemptNo,e.verdict])};};
const clockFrom=()=>{let t=Date.parse('2026-11-09T03:00:00Z');return ()=>new Date(t+=1000).toISOString();};

// 앱 셸의 practiceCoach(쓰기 · 말하기가 같이 쓰는 코치 함수)를 글 그대로 꺼내 돌린다 — app-shell.mjs는 문서 없이 import되지 않는다(말하기 시험과 같은 꼴).
function shellPracticeCoach({win,learning,ownerNow,storage={}}){
 const from=SHELL.indexOf('const releaseCoach='),to=SHELL.indexOf('let writingCoach=null,speakingCoach=null;');
 assert.ok(from>0&&to>from,'앱 셸에 practiceCoach가 있다');
 return new Function('window','worldLearning','writingOwnerId','localStorage',`${SHELL.slice(from,to)}\nreturn practiceCoach;`)(win,learning,ownerNow,storage);
}
// 가짜 계정 통로: createGame은 실제 엔진 코치(같은 계정 저장소)를 주고, stop()은 그 통로의 코치를 모두 끝낸다(새 통로가 열릴 때 prepareGame이 앞 통로를 끝내는 것과 같다).
function fakeHost(storage,clock){
 const coaches=[];
 return {coaches,createGame:(options,factory)=>{const coach=factory({...options,storage,clock,followups:true});coaches.push(coach);return coach;},stop(){for(const c of coaches)c.dispose();}};
}

test('쓰기 점검 시도는 「채점 안 함」으로 남고, 같은 판의 다음 점검은 그 판의 다음 시도다 — 기기 기록 꼴은 그대로',async()=>{
 await bankReady;const storage=memory(),coach=worldLearning.engine.createGame({gameId:'world-writing',storage,clock:clockFrom(),followups:true}),b=await bench(()=>coach);
 try{
  const w51=first(51);b.check(w51);b.check(w51,'다시 써 보면 문장이 더 자연스럽습니다.');
  assert.deepEqual(writingOf(coach.events(),w51),{shown:1,attempts:[[1,'unassessed'],[2,'unassessed']]});
  const shown=coach.events().find(e=>e.type==='practice.presented');
  assert.deepEqual({...shown.measure},{skillId:WRITING_SKILLS[51],modality:'writing',difficulty:2,familyKey:`writing.${w51.id}`,audioRequired:false,confounded:false,responseFormat:'unknown'},'측정 칸은 그대로');
  assert.deepEqual(b.log().map(e=>[e.source,e.itemId]),[['rule-check',w51.id],['rule-check',w51.id]],'기기 기록 꼴은 그대로(칸이 늘지 않는다)');
 }finally{b.close();}
});

test('게임을 연 뒤(새 계정 통로) 같은 페이지의 쓰기 점검도 계정 기록에 남는다 — 다른 문항 · 앞에서 한 문항 모두, 옛 판의 시도 번호를 끌고 가지 않는다(Edge 재현의 Node 판)',async()=>{
 await bankReady;const shared=memory(),clock=clockFrom(),win={},learning={engine:worldLearning.engine,createLearningSync(){}};
 const coachOf=shellPracticeCoach({win,learning,ownerNow:()=>'acc',storage:memory()})('world-writing','acc');
 win.SYNKLearningHost=fakeHost(shared,clock);const b=await bench(coachOf,{owner:'acc'});
 try{
  const w51=first(51),w52=first(52);
  b.check(w51,undefined,{model:true});
  const a=win.SYNKLearningHost;
  // 게임을 연다: 새 통로가 열리고 앞 통로의 코치는 끝난다.
  a.stop();win.SYNKLearningHost=fakeHost(shared,clock);
  b.check(w52);b.check(w51,'다시 써 보면 문장이 더 자연스럽습니다.');b.check(w51,'한 번 더 고쳐 씁니다.');
  const events=win.SYNKLearningHost.coaches.at(-1).events();
  assert.deepEqual(writingOf(events,w52),{shown:1,attempts:[[1,'unassessed']]},'게임 뒤 52번 점검이 남는다');
  assert.deepEqual(writingOf(events,w51),{shown:2,attempts:[[1,'unassessed'],[1,'unassessed'],[2,'unassessed']]},'51번은 새 판의 1 · 2번째 시도로 남는다(옛 판 번호 3이 아니다)');
  // 예시답을 본 51번은 새 판에서도 도움(answer)을 먼저 남기고 시도를 남긴다 — 「혼자」로 세지 않는다(기기에 남은 도움 기록).
  const fresh=events.filter(e=>e.type==='practice.presented'&&e.itemKey===`writing.${w51.id}`).at(-1);
  assert.deepEqual(events.filter(e=>e.presentationId===fresh.id).map(e=>e.type).slice(0,2),['practice.helped','practice.attempted']);
  assert.equal(win.SYNKLearningHost.coaches.length,1,'새 통로에서 코치 하나를 받아 계속 쓴다');
  assert.equal(b.log().filter(e=>e.source==='rule-check').length,4,'기기 기록에는 점검 넷이 다 있다');
 }finally{b.close();}
});

test('판이 코치에서 끝나면(다른 탭이 기록을 새로 시작) 새 판으로 한 번 더 남기고, 던진 시도로 번호가 비지 않는다',async()=>{
 await bankReady;const storage=memory(),clock=clockFrom();
 const coach=worldLearning.engine.createGame({gameId:'world-writing',storage,clock,followups:true});
 let failNext=false;
 // 답 하나가 한 번 던지는 코치(저장 실패 같은 일) — 앞 판에서는 번호가 먼저 올라 그 판의 뒤 시도가 모두 막혔다.
 const flaky=Object.freeze({...coach,answer:(pid,result)=>{if(failNext){failNext=false;throw Error('boom');}return coach.answer(pid,result);}});
 const b=await bench(()=>flaky);
 try{
  const w51=first(51);
  b.check(w51);failNext=true;b.check(w51,'두 번째 글입니다.');b.check(w51,'세 번째 글입니다.');
  assert.deepEqual(writingOf(coach.events(),w51),{shown:2,attempts:[[1,'unassessed'],[1,'unassessed'],[2,'unassessed']]},
   '던진 시도는 그 판을 버리고 새 판으로 다시 남기고, 다음 시도는 새 판의 둘째 시도다(번호가 비지 않는다)');
  // 다른 탭이 이 기기 기록을 새로 시작한다(reset): 이 탭의 판이 끝난다.
  worldLearning.engine.createGame({gameId:'world-home',storage,clock,followups:true}).reset();
  b.check(w51,'네 번째 글입니다.');
  assert.deepEqual(writingOf(coach.events(),w51),{shown:1,attempts:[[1,'unassessed']]},'새로 시작한 기록에 새 판의 첫 시도로 남는다');
 }finally{b.close();}
});

test('앱 셸 practiceCoach: 통로가 바뀌거나 코치가 끝나면 새로 받고 끝난 코치는 놓는다(disconnect · 없으면 dispose) · 손님 코치는 재확인을 지키며 접는다 · 쓰기 · 말하기가 같은 함수를 쓰고 쓰기를 열 때 통로를 준비한다',()=>{
 const fake=(label,options,{withDisconnect=true}={})=>{const c={label,options,dead:false,released:0,events(){if(c.dead)throw Error('RUN_ENDED');return [];},dispose(){c.released++;}};if(withDisconnect)c.disconnect=()=>{c.released++;};return c;};
 let deviceDisconnect=false;
 const learning={engine:{createGame:options=>fake('device',options,{withDisconnect:deviceDisconnect})},createLearningSync(){}},host=label=>({createGame:options=>fake(label,options)}),win={};
 const make=(ownerNow,storage={})=>shellPracticeCoach({win,learning,ownerNow,storage});
 const coachOf=make(()=>'acc')('world-writing','acc');
 assert.equal(coachOf(),null,'계정인데 통로가 아직 없으면 코치 없음(기기 기록만)');
 win.SYNKLearningHost=host('a');const a=coachOf();
 assert.deepEqual([a.label,a.options],['a',{gameId:'world-writing'}]);assert.equal(coachOf(),a,'같은 통로 · 산 코치는 그대로');
 a.dead=true;const a2=coachOf();
 assert.notEqual(a2,a,'같은 통로라도 코치가 끝났으면 새로');assert.equal(a.released,1,'끝난 코치를 놓는다');
 win.SYNKLearningHost=host('b');const b=coachOf();
 assert.equal(b.label,'b','통로가 바뀌면 새로');assert.equal(a2.released,1);
 coachOf.release();assert.equal(b.released,1,'연습 화면을 새로 만들 때 옛 코치를 놓는다');
 win.SYNKLearningHost={createGame(){throw Error('MEMORY_SESSION_ENDED');}};
 assert.throws(()=>coachOf(),/MEMORY_SESSION_ENDED/,'동의를 거둬 통로가 막히면 코치를 못 받는다(쓰기 화면이 삼켜 기기 기록만 남는다)');
 assert.equal(make(()=>'other')('world-writing','acc')(),null,'다른 계정이면 코치 없음');
 delete win.SYNKLearningHost;
 for(const gameId of ['world-writing','world-speaking']){
  const guest=make(()=>'guest',{marker:true})(gameId,'guest'),device=guest();
  assert.deepEqual([device.label,device.options.gameId,device.options.storage.marker,device.options.followups],['device',gameId,true,true],`손님 ${gameId}: 기기 코치 · 재확인을 지키며 접는다`);
  // 기기 코치(엔진 api)에는 disconnect가 없다 — 끝났으면 dispose로 놓는다(3번).
  device.dead=true;const next=guest();assert.notEqual(next,device);assert.equal(device.released,1,`손님 ${gameId}: 끝난 기기 코치를 dispose로 놓는다`);
 }
 deviceDisconnect=true;
 const both=make(()=>'guest')('world-writing','guest'),d=both();d.dead=true;both();assert.equal(d.released,1,'disconnect가 있으면 그것 하나만 부른다');
 // 쓰기 · 말하기 화면이 이 함수를 쓰고, 쓰기를 열 때 계정 통로를 준비한다.
 const body=name=>SHELL.slice(SHELL.indexOf(`function ${name}(`),SHELL.indexOf('\n}\n',SHELL.indexOf(`function ${name}(`)));
 assert.match(body('openWriting'),/prepareLearningHost\(\)/,'쓰기를 열 때 통로를 준비한다(말하기와 같다)');
 assert.match(body('openWriting'),/writingCoach\?\.release\(\);writingOwner=owner;writingCoach=practiceCoach\('world-writing',owner\)/);
 assert.match(body('openWriting'),/coach:writingCoach\}/);
 assert.match(body('openSpeaking'),/speakingCoach\?\.release\(\);speakingOwner=owner;speakingCoach=practiceCoach\('world-speaking',owner\)/);
 assert.doesNotMatch(SHELL,/if\(coach\)return coach;/,'한 번 받은 코치를 그대로 돌려주는 옛 꼴이 없다');
});

test('끝난 코치를 놓는다(3번): 배우기 화면 dispose · coachFor · 공부 시각 코치가 기기 코치도 dispose로 놓고, 놓는 기기 코치는 모두 재확인을 지키며 접는다',async()=>{
 const [{createWorldEducation},{createWorldLearningPlan},{createLifeProgress},{PACKS,LESSONS}]=await Promise.all(['../world-learning-ui.mjs','../world-learning-plan.mjs','../life-progress.mjs','../life-content.mjs'].map(file=>import(file)));
 const storage=memory(),life=createLifeProgress({storage,owner:'guest'});life.summary(PACKS,LESSONS);
 const target={localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector:()=>null}};
 const education=createWorldEducation({home:{updateStudy(){},toast(){},showPanel(){},closePanel(){}},getProgress:()=>life,engine:worldLearning,createPlan:createWorldLearningPlan,launchGame(){},startLesson(){},startReview(){},target});
 const coach=education.lifeLearning.coach();assert.ok(coach,'손님 생활 거울 코치(기기 코치)');
 assert.deepEqual(coach.events(),[]);
 education.dispose();
 assert.throws(()=>coach.events(),/game closed/,'배우기 화면을 치우면 기기 코치를 놓는다(앞 판은 disconnect만 불러 아무것도 안 했다)');
 // coachFor: 끝난 기기 코치를 놓고 새로 받는다.
 const made=[];
 const fakeEngine={...worldLearning,engine:{...worldLearning.engine,createGame:options=>{if(options.gameId==='world-home-empty')return worldLearning.engine.createGame(options);
  const c={options,dead:false,disposed:0,summary(){if(c.dead)throw Error('closed');return {};},dispose(){c.disposed++;}};made.push(c);return c;}}};
 const second=createWorldEducation({home:{updateStudy(){},toast(){}},getProgress:()=>life,engine:fakeEngine,createPlan:createWorldLearningPlan,launchGame(){},startLesson(){},startReview(){},target});
 const c1=second.lifeLearning.coach();c1.dead=true;const c2=second.lifeLearning.coach();
 assert.notEqual(c2,c1);assert.equal(c1.disposed,1,'끝난 기기 코치를 dispose로 놓는다');
 assert.ok(made.every(c=>c.options.followups===true),'놓는 기기 코치는 모두 재확인을 지키며 접는다');
 second.dispose();assert.equal(c2.disposed,1);
 // 공부 시각 코치(world-reminder-device.mjs): 던지면 끊고 다시 만든다 — 기기 코치는 dispose로 놓는다.
 let readFails=true;const devices=[];
 const trail=createTrailTimes({host:()=>null,make:()=>{const c={dispose(){c.disposed=(c.disposed||0)+1;},events(){if(readFails){readFails=false;throw Error('closed');}return [{type:'practice.attempted',at:'2026-11-09T03:00:00.000Z'}];}};devices.push(c);return c;}});
 assert.deepEqual(trail.read(),[Date.parse('2026-11-09T03:00:00.000Z')]);
 assert.equal(devices[0].disposed,1,'던진 기기 코치를 놓는다');
 trail.dispose();assert.equal(devices[1].disposed,1,'치울 때도 놓는다');
 // 앱 셸의 손님 공부 시각 코치도 재확인을 지키며 접는다(놓을 때의 마지막 저장이 장부를 접을 수 있다).
 assert.match(SHELL,/worldLearning\.engine\.createGame\(\{gameId:'world-reminders',storage:localStorage,followups:true\}\)/);
});

test('손님 쓰기 코치의 재확인 옵션(4번): 쓰기 코치가 기기 장부를 접어도 앞서 잡힌 재확인이 남는다',async()=>{
 await bankReady;
 let t=Date.parse('2026-11-09T03:00:00Z');const storage=memory(),clock=()=>new Date(t+=1000).toISOString();
 let last=null;const hold=g=>{last?.flush?.();return last=g;};
 const practice=()=>hold(worldLearning.engine.createGame({gameId:'world-practice',storage,clock,followups:true}));
 const reading=practice(),p=reading.present({id:'e-100',itemKey:'e-100.v1',familyKey:'e-100',skillId:'ko.reading.detail',difficulty:1,responseFormat:'single-choice',modality:'reading',audioRequired:false});
 reading.answer(p,{correct:true,assessable:true});t+=2*DAY;
 // 앱 셸이 손님에게 주는 쓰기 코치 그대로(practiceCoach — 기기 코치 · followups:true).
 const coachOf=shellPracticeCoach({win:{},learning:{engine:{createGame:options=>hold(worldLearning.engine.createGame({...options,clock}))},createLearningSync(){}},ownerNow:()=>'guest',storage})('world-writing','guest');
 const writer=coachOf();
 for(let n=0;n<170;n++){const q=writer.present({id:`f${n}`,itemKey:`writing.fill-${n}`,familyKey:`writing.fill-${n}`,skillId:WRITING_SKILLS[51],modality:'writing',difficulty:2,responseFormat:'unknown',audioRequired:false});writer.answer(q,{correct:null,assessable:false,attemptNo:1});if(n%10===9)t+=11*60000;}
 writer.flush?.();
 const stored=JSON.parse(storage.getItem('synk.atlas.learning.v1.device')),read=practice().followups();
 assert.ok((stored.ledger?.folded||0)>0,'접기가 실제로 일어났다');
 // 남는 줄만 본다 — 장부 칸(followupsPreserved · coverage.reason)은 재확인 내구성 엔진 판(temper-followup-3)에서 뜻이 바뀐다. 옵션 없이 접으면 줄이 0이 되는 대조는
 // qa/world-speaking-trail.test.mjs가 지금 엔진으로 묶는다.
 assert.ok(read.items.some(r=>r.gameId==='world-practice'&&r.measure?.skillId==='ko.reading.detail'),'쓰기 코치가 접어도 읽기 재확인이 남는다');
});

test('쓰기 홈 후보는 문항 열쇠(targets)를 달지 않는다(2번 판단) — 지금 측정(난도 2)대로 달면 Core가 열쇠 없는 55분 모의를 늘 먼저 고르고, 「한 가지 고치기」의 53번은 열쇠 없이 급한 줄이다',async()=>{
 const [{createWorldEducation},{createWorldLearningPlan},{worldPosition},{createLifeProgress},{PACKS,LESSONS},{FOCUS_ID}]=await Promise.all(['../world-learning-ui.mjs','../world-learning-plan.mjs','../world-position-kit.mjs','../life-progress.mjs','../life-content.mjs','../world-writing-focus.mjs'].map(file=>import(file)));
 await bankReady;
 const fixture=focus=>{
  const storage=memory(),life=createLifeProgress({storage,owner:'guest'});life.summary(PACKS,LESSONS);
  life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{reasons:['exam'],primaryReason:'exam',examType:'topik2',targetGrade:4,examDate:'2027-04',weeklyMinutes:120},today:{audio:'available'}});
  if(focus)storage.setItem('synk.world.writing.v1:guest',JSON.stringify({drafts:{},log:[],mock:null,helped:{},focus:{id:FOCUS_ID,events:focus,drill:null}}));
  const writingPractice={candidates:()=>writingCandidates({storage,owner:'guest'}),open(){},attempts:()=>readWritingSummary({storage,owner:'guest'}).times};
  return createWorldEducation({home:{updateStudy(){},toast(){},showPanel(){},closePanel(){}},getProgress:()=>life,engine:worldLearning,createPlan:createWorldLearningPlan,
   launchGame(){},startLesson(){},startReview(){},position:worldPosition,writingPractice,target:{localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector:()=>null}}});
 };
 const plan=fixture(null).refresh(),writing=plan.candidates.filter(c=>c.route==='writing');
 assert.deepEqual(writing.map(c=>c.routeId),WRITING_CANDIDATES.map(c=>c.route));
 assert.ok(writing.every(c=>c.targets.length===0),'Core에 넘기는 쓰기 후보는 열쇠가 없다');
 assert.ok(writing.every(c=>!c.goals.some(g=>g.startsWith('plan.skill.'))),'항목 토큰도 없다(쓰기 항목은 늘 「모름」이라 숙제가 되지 않는다)');
 // 왜 달지 않나 ①: 쓰기 측정은 난도 2이고 「채점 안 함」만 쌓이는 능력은 한 단계 아래를 혼자 해낼 일이 없어 Core가 늘 −.25를 뺀다 — 문항 열쇠를 단 51~54가
 // 열쇠 없는 모의(55분, .65)보다 낮아져 홈이 매번 모의를 고른다(11-09 실측 24판 모두 모의).
 const home=worldLearning.engine.createGame({gameId:'world-home',storage:memory(),clock:clockFrom(),followups:true});
 const keyed=WRITING_CANDIDATES.map(row=>{const type=Number(row.route.split(':')[1]),it=Number.isInteger(type)?first(type):null;
  const c={id:row.id,label:row.route,route:'writing',routeId:row.route,minutes:row.minutes,minutesEstimated:true,goals:['exam','prepare','writing'],audioRequired:false,modality:'writing',
   targets:it?[{id:`writing-${it.id}`,skillIds:[WRITING_SKILLS[type]],difficulty:2,modality:'writing',responseFormat:'unknown',itemKey:`writing.${it.id}`,familyKey:`writing.${it.id}`,audioRequired:false,conceptIds:[]}]:[]};
  return {...c,goals:[...new Set([...c.goals,...planTokens(c)])]};});
 const at=new Date().toISOString(),settings={goals:['exam','prepare','plan.area.writing']};
 assert.equal(home.recommendActivities(keyed,{settings,at}).selected.routeId,'writing:mock','지금 측정대로 열쇠를 달면 모의가 이긴다');
 assert.equal(home.recommendActivities(keyed.map(c=>({...c,targets:[]})),{settings,at}).selected.routeId,'writing:51','지금 판(열쇠 없음)은 51번');
 // 왜 달지 않나 ②: 「한 가지 고치기」가 열리면 53번은 호스트 사실(practiceNeed)로 급한 줄에 서고, 그 길이 여는 것은 문항이 아니라 연습 화면이다.
 const recent=new Date(Date.now()-3600000).toISOString();
 const focused=fixture([{at:recent,itemId:'w53-resale',kind:'found',plain:0,off:3,total:3}]).refresh();
 assert.equal(focused.selected.routeId,'writing:53');assert.ok(focused.reasons.includes('activity.retry'));
 assert.equal(focused.candidates.find(c=>c.routeId==='writing:53').targets.length,0,'53번은 열쇠 없이 급한 줄');
});

// 남은 일(후속): 홈이 쓰기를 권할 때 유형이 돌지 않는다 — 열쇠가 없어 모든 쓰기 후보가 Core에서 같은 점수라 분 · 이름 차례로 51번이 늘 먼저다(11-09 실측 24판 모두 51번 —
// 다섯 문항을 돈 뒤 w51-recycle만 되풀이). Core 열쇠로는 못 푼다(위 시험 — 유형마다 문항이 다섯이라 다 쓴 뒤에야 돈다) — 제품 쪽(이번 주에 안 한 유형 먼저 같은 길)의 일이다.
test.todo('홈의 쓰기 추천이 51 · 52 · 53 · 54번 유형을 돈다(제품 쪽 유형 돌리기 — 후속)');
