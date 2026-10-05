import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldClassroom,submissionAttempt,validateWorldWorkspace} from '../src/world-classroom.mjs';
const content={id:'reading-a',title:'가상 읽기',passage:'지안은 도서관에 갑니다.',questions:[{id:'q1',prompt:'어디에 가나요?',options:[{id:'library',text:'도서관'},{id:'cafe',text:'카페'}]}]};
const workspace=()=>({learner:{id:'learner-A',name:'연결 예시'},sharing:{enabled:true,revision:2},assignments:[{id:'assignment-A',revision:1,title:'읽기 과제',dueAt:'2026-11-01T00:00:00Z',status:'assigned',content:structuredClone(content)}]});
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(done=>setImmediate(done));};
function fixture(t,overrides={}){
  const {launchRun=()=>{},closeGame=()=>{},makeId=()=> 'same-request-key',...clientOverrides}=overrides;
  const listeners={},docListeners={},root={hidden:true,innerHTML:'',contains:el=>!!el,querySelectorAll:()=>[],addEventListener:(type,fn)=>listeners[type]=fn,removeEventListener:type=>delete listeners[type],replaceChildren(){this.innerHTML='';}};
  const documentObject={visibilityState:'hidden',activeElement:null,addEventListener:(type,fn)=>docListeners[type]=fn,removeEventListener:type=>delete docListeners[type]};
  let data=workspace();const calls=[],client={student:async()=>structuredClone(data),practice:async()=>({content:[structuredClone(content)]}),submit:async payload=>{calls.push(payload);return{ok:true,submission:{}};},practiceSubmit:async payload=>{calls.push(payload);return{ok:true,submission:{correct:1,total:1,results:[{questionId:'q1',answer:'library',correct:true,correctAnswer:'library',explanation:'지문에 도서관이라고 나옵니다.'}]}};},...clientOverrides};
  const ui=createWorldClassroom({root,client,learnerId:'learner-A',guard(){},documentObject,makeId,pollMs:20,launchRun,closeGame});t.after(()=>ui.stop());
  const click=(action,kind,id)=>listeners.click({target:{closest:()=>({dataset:{worldAction:action,kind,id}})}});
  const answer=value=>listeners.change({target:{dataset:{worldAnswer:'q1'},value}});
  const submit=()=>listeners.submit({preventDefault(){},target:{matches:()=>true}});
  return{root,ui,client,calls,click,answer,submit,documentObject,docListeners,set data(value){data=value;}};
}
test('workspace validation rejects another learner and submissions contain exactly server-owned assignment identifiers',()=>{
  assert.throws(()=>validateWorldWorkspace(workspace(),'learner-B'),/과제 연결/);
  const row=workspace().assignments[0],answers={q1:'library',ignored:'other'};
  const attempt=submissionAttempt({assignment:row,revision:row.revision,answers,key:'stable'});answers.q1='cafe';
  assert.deepEqual(attempt,{assignmentId:'assignment-A',revision:1,answers:{q1:'library'},idempotencyKey:'stable'});assert.equal(Object.isFrozen(attempt.answers),true);
  assert.throws(()=>submissionAttempt({assignment:row,revision:1,answers:{q1:'not-an-option'},key:'stable'}),/모든 문항/);
});
test('an uncertain submission freezes its first answers and retries the identical key and payload',async t=>{
  const requests=[];const f=fixture(t,{submit:async payload=>{requests.push(payload);if(requests.length===1)throw Error('응답 유실');return{ok:true,submission:{}};}});await f.ui.reload();f.click('open','assignment','assignment-A');f.answer('library');f.submit();await settle();assert.match(f.root.innerHTML,/같은 제출 다시 확인/);
  f.answer('cafe');f.submit();await settle();assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(requests[1].answers.q1,'library');assert.equal(f.ui.status().pending,0);
});
test('free reading practice sends current sharing revision and displays server-scored answers',async t=>{
  const f=fixture(t);await f.ui.reload();f.click('open','practice','reading-a');f.answer('library');f.submit();await settle();
  assert.deepEqual(f.calls[0],{contentId:'reading-a',revision:2,answers:{q1:'library'},idempotencyKey:'same-request-key'});assert.match(f.root.innerHTML,/1 \/ 1문항 · 제출 완료/);assert.match(f.root.innerHTML,/지문에 도서관/);
});

test('mixed catalog reading metadata is hydrated from the public question endpoint before opening',async t=>{
  const f=fixture(t);const data=workspace();data.content=[{id:content.id,title:content.title,kind:'reading'}];f.data=data;await f.ui.reload();f.click('open','practice',content.id);assert.match(f.root.innerHTML,/지안은 도서관에 갑니다/);assert.match(f.root.innerHTML,/data-world-answer="q1"/);f.answer('library');f.submit();await settle();assert.equal(f.calls[0].contentId,content.id);
});
test('read failures remove stale assignment details and a later response after stop cannot restore them',async t=>{
  const f=fixture(t);await f.ui.reload();assert.match(f.root.innerHTML,/읽기 과제/);f.client.student=async()=>{throw Error('연결 실패');};await f.ui.reload();assert.doesNotMatch(f.root.innerHTML,/읽기 과제/);assert.match(f.root.innerHTML,/연결 실패/);
  let resolve;f.client.student=()=>new Promise(done=>resolve=done);const pull=f.ui.reload();f.ui.stop();resolve(workspace());await pull;assert.equal(f.root.innerHTML,'');assert.equal(f.root.hidden,true);
});
test('a new sharing revision clears the old draft and incomplete request',async t=>{
  const f=fixture(t,{submit:async()=>{throw Error('offline');}});await f.ui.reload();f.click('open','assignment','assignment-A');f.answer('library');f.submit();await settle();assert.equal(f.ui.status().pending,1);
  const changed=workspace();changed.sharing={enabled:false,revision:3};changed.assignments=[];f.data=changed;await f.ui.reload();assert.equal(f.ui.status().pending,0);assert.equal(f.ui.status().selected,null);assert.match(f.root.innerHTML,/학습 공유 꺼짐/);assert.doesNotMatch(f.root.innerHTML,/같은 제출/);
});
test('a changed assignment revision invalidates an uncertain old submission and requires new answers',async t=>{
  const f=fixture(t,{submit:async()=>{throw Error('offline');}});await f.ui.reload();f.click('open','assignment','assignment-A');f.answer('library');f.submit();await settle();assert.equal(f.ui.status().pending,1);
  const changed=workspace();changed.assignments[0].revision=2;changed.assignments[0].title='수정된 읽기 과제';f.data=changed;await f.ui.reload();assert.equal(f.ui.status().pending,0);assert.match(f.root.innerHTML,/최신 내용과 답을 다시 확인/);assert.doesNotMatch(f.root.innerHTML,/value="library" checked/);
});

test('revision invalidation also clears a pending task while its list is shown or a read failure hides the workspace',async t=>{
  for(const mode of ['list','read-failure']){
    const f=fixture(t,{submit:async()=>{throw Error('offline');}});await f.ui.reload();f.click('open','assignment','assignment-A');f.answer('library');f.submit();await settle();assert.equal(f.ui.status().pending,1);
    const reader=f.client.student;if(mode==='list')f.click('back');else{f.client.student=async()=>{throw Error('temporary read failure');};await f.ui.reload();f.client.student=reader;}
    const changed=workspace();changed.assignments[0].revision=2;f.data=changed;await f.ui.reload();assert.equal(f.ui.status().pending,0);if(mode==='list')f.click('open','assignment','assignment-A');assert.doesNotMatch(f.root.innerHTML,/value="library" checked|같은 제출 다시 확인/);
  }
});
test('hidden pages do not poll and stopping the classroom cancels scheduled refresh',async t=>{
  let reads=0;const f=fixture(t,{student:async()=>{reads++;return workspace();}});await f.ui.reload();await new Promise(done=>setTimeout(done,35));assert.equal(reads,1);
  f.documentObject.visibilityState='visible';f.docListeners.visibilitychange();await settle();assert.equal(reads,2);f.ui.stop();await new Promise(done=>setTimeout(done,35));assert.equal(reads,2);
});

test('server reading recommendations reorder actual activities and explain selection without inventing weakness',async t=>{
  const next={...structuredClone(content),id:'reading-b',title:'새 안내문'};
  const f=fixture(t,{practice:async()=>({content:[structuredClone(content),next]})});const data=workspace();data.recommendations=[{contentId:'unavailable-game',title:'듣기 게임',reason:'듣기 확인'},{contentId:'reading-b',reason:'아직 읽기 근거가 충분하지 않아 새 문항으로 확인해요.'}];f.data=data;await f.ui.reload();
  assert(f.root.innerHTML.indexOf('data-id="reading-b"')<f.root.innerHTML.indexOf('data-id="reading-a"'));assert.match(f.root.innerHTML,/지금 추천하는 읽기/);assert.match(f.root.innerHTML,/추천 이유: 아직 읽기 근거가 충분하지 않아 새 문항으로 확인해요/);assert.doesNotMatch(f.root.innerHTML,/약점|unavailable-game/);
  f.click('open','practice','reading-b');f.answer('library');f.submit();await settle();assert.equal(f.calls[0].contentId,'reading-b');
  const off=workspace();off.sharing={enabled:false,revision:3};off.recommendations=data.recommendations;f.data=off;await f.ui.reload();assert.doesNotMatch(f.root.innerHTML,/지금 추천하는 읽기|추천 이유:/);
});

const gameContent={id:'racing-listening',kind:'game',gameId:'korean-racing',href:'/korean-racing/',title:'레이싱 듣기',requiredAttempts:3,questions:[]};
const runFor=(extra={})=>({id:'run-A',assignmentId:'assignment-A',assignmentRevision:1,contentId:gameContent.id,gameId:gameContent.gameId,href:gameContent.href,requiredAttempts:3,status:'active',progress:{total:0,correct:0,assisted:0,independent:0,excluded:0},...extra});
function gameWorkspace(){const data=workspace();data.content=[structuredClone(content),structuredClone(gameContent)];data.assignments[0].content=structuredClone(gameContent);return data;}

test('mixed catalog and coaching open actual game assignments, preserve a lost start key, and display server progress',async t=>{
  const calls=[],launched=[],order=[];const f=fixture(t,{closeGame:()=>order.push('closed'),launchRun:run=>{order.push('launched');launched.push(run);},startRun:async payload=>{calls.push(payload);order.push('requested');if(calls.length===1)throw Error('lost start response');return{run:runFor()};},stopRun:async()=>({ok:true})});
  const data=gameWorkspace();data.coaching={summary:'읽기와 듣기 기록을 함께 확인해요.',next:[{contentId:gameContent.id,title:'듣기 이어 하기',reason:'세부 정보 응답 확인'}],basedOn:['evidence-1']};f.data=data;await f.ui.reload();assert.match(f.root.innerHTML,/오늘의 학습 안내|듣기 이어 하기|게임 연습하기/);
  f.click('open','assignment','assignment-A');f.click('start-game');await settle();assert.match(f.root.innerHTML,/같은 시작 요청 다시 확인/);f.click('start-game');await settle();assert.deepEqual(calls[0],calls[1]);assert.deepEqual(calls[1],{assignmentId:'assignment-A',revision:1,idempotencyKey:'same-request-key'});assert.equal(launched.length,1);assert(order.indexOf('closed')<order.indexOf('requested'));assert.equal(f.ui.status().gameVisible,true);
  const completed=gameWorkspace();completed.assignments[0].run=runFor({status:'completed',progress:{total:3,correct:2,assisted:1,independent:2,excluded:2}});completed.assignments[0].completed=true;f.data=completed;await f.ui.reload();assert.match(f.root.innerHTML,/3 \/ 3응답 · 혼자 2 · 도움 1 · 평가 제외 2/);assert.match(f.root.innerHTML,/학습 완료/);assert.doesNotMatch(f.root.innerHTML,/data-world-action="start-game"/);
});

test('assignment changes and consent changes close the iframe and cannot launch a late start response',async t=>{
  let resolve,closed=0,launched=0;const f=fixture(t,{closeGame:()=>closed++,launchRun:()=>launched++,startRun:()=>new Promise(r=>resolve=r)});f.data=gameWorkspace();await f.ui.reload();f.click('open','assignment','assignment-A');f.click('start-game');await settle();
  const changed=gameWorkspace();changed.assignments[0].revision=2;f.data=changed;await f.ui.reload();resolve({run:runFor()});await settle();assert.equal(launched,0);
  f.client.startRun=async()=>({run:runFor({assignmentRevision:2})});f.click('start-game');await settle();assert.equal(launched,1);const before=closed;const off=gameWorkspace();off.sharing={enabled:false,revision:3};off.assignments=[];f.data=off;await f.ui.reload();assert(closed>before);assert.equal(f.ui.status().gameVisible,false);assert.equal(f.ui.status().run,null);
});

test('transient network loss preserves an active game, while permission failures still close it',async t=>{
 let closed=0;const f=fixture(t,{closeGame:()=>closed++,startRun:async()=>({run:runFor()})});
 f.data=gameWorkspace();await f.ui.reload();f.click('open','assignment','assignment-A');f.click('start-game');await settle();
 const before=closed;const student=f.client.student;
 f.client.student=async()=>{throw Object.assign(Error('connection waiting'),{code:'NETWORK_ERROR'});};await f.ui.reload();
 assert.equal(closed,before);assert.equal(f.ui.status().gameVisible,true);assert.equal(f.ui.status().run.id,runFor().id);assert.match(f.root.innerHTML,/connection waiting/);
 f.client.student=async()=>{throw Object.assign(Error('native connection waiting'),{code:'NETWORK',retryable:true});};await f.ui.reload();assert.equal(closed,before);assert.equal(f.ui.status().gameVisible,true);
 f.client.student=student;await f.ui.reload();assert.doesNotMatch(f.root.innerHTML,/connection waiting/);
 f.client.student=async()=>{throw Object.assign(Error('permission revoked'),{code:'FORBIDDEN',status:403});};await f.ui.reload();
 assert(closed>before);assert.equal(f.ui.status().gameVisible,false);assert.equal(f.ui.status().loaded,false);
});

test('free game launch uses catalog content and sharing revision, and a failed old stop blocks the next game',async t=>{
  const requests=[],launches=[];const next={...gameContent,id:'rhythm-listening',gameId:'korean-rhythm',href:'/korean-rhythm/'};
  const f=fixture(t,{launchRun:r=>launches.push(r.id),startRun:async payload=>{requests.push(payload);return{run:runFor({assignmentId:null,contentId:payload.contentId,gameId:payload.contentId===next.id?next.gameId:gameContent.gameId,id:payload.contentId})};},stopRun:async()=>{throw Error('stop offline');}});const data=gameWorkspace();data.content.push(next);f.data=data;await f.ui.reload();await f.ui.openGame('korean-racing');assert.deepEqual(requests[0],{contentId:'racing-listening',revision:2,idempotencyKey:'same-request-key'});
  await f.ui.openGame('korean-rhythm');assert.equal(requests.length,1);assert.deepEqual(launches,['racing-listening']);assert.equal(f.ui.status().gameVisible,false);assert.match(f.root.innerHTML,/stop offline/);
});

test('a confirmed ended run clears the old retry key while an uncertain start keeps it',async t=>{
  let sequence=0;const requests=[];
  const f=fixture(t,{makeId:()=>`request-${++sequence}`,startRun:async payload=>{requests.push(payload);if(requests.length===1)throw Error('response lost');if(requests.length===2)throw Object.assign(Error('run ended'),{code:'RUN_ENDED'});return{run:runFor({assignmentId:null})};}});
  f.data=gameWorkspace();await f.ui.reload();await f.ui.openGame(gameContent.gameId);assert.match(f.root.innerHTML,/같은 시작 요청 다시 확인/);
  f.click('start-game');await settle();assert.equal(requests[0].idempotencyKey,requests[1].idempotencyKey);assert.doesNotMatch(f.root.innerHTML,/같은 시작 요청 다시 확인/);
  f.click('start-game');await settle();assert.notEqual(requests[1].idempotencyKey,requests[2].idempotencyKey);assert.equal(f.ui.status().gameVisible,true);
});

test('a completed free run is refreshed by id and cannot complete a separate assignment using the same game',async t=>{
  const f=fixture(t,{startRun:async()=>({run:runFor({assignmentId:null})})});const data=gameWorkspace();f.data=data;await f.ui.reload();await f.ui.openGame(gameContent.gameId);
  data.runs=[runFor({assignmentId:null,status:'completed',progress:{total:3,correct:2,independent:2,assisted:1,excluded:0}})];data.activeRun=null;f.data=data;await f.ui.reload();assert.match(f.root.innerHTML,/학습 완료/);assert.match(f.root.innerHTML,/3 \/ 3응답/);
  f.click('open','assignment','assignment-A');assert.doesNotMatch(f.root.innerHTML,/학습 완료/);assert.match(f.root.innerHTML,/data-world-action="start-game"/);
});

test('a game remains connecting until its personal settings arrive and a late launch cannot restore an invalidated activity',async t=>{
  for(const invalidate of [false,true]){
    let finish;const f=fixture(t,{launchRun:()=>new Promise(resolve=>{finish=resolve;}),startRun:async()=>({run:runFor()})});
    f.data=gameWorkspace();await f.ui.reload();f.click('open','assignment','assignment-A');f.click('start-game');await settle();
    assert.equal(f.ui.status().gameVisible,false);assert.match(f.root.innerHTML,/게임 연결 중/);
    if(invalidate){const changed=gameWorkspace();changed.assignments[0].revision=2;f.data=changed;await f.ui.reload();}
    finish();await settle();assert.equal(f.ui.status().gameVisible,!invalidate);
  }
});

test('another game request during personal memory loading keeps the current launch usable',async t=>{
  let finish;const f=fixture(t,{launchRun:()=>new Promise(resolve=>{finish=resolve;}),startRun:async()=>({run:runFor({assignmentId:null})})});
  const data=gameWorkspace();data.content.push({...gameContent,id:'rhythm-listening',gameId:'korean-rhythm',href:'/korean-rhythm/'});f.data=data;await f.ui.reload();
  const opening=f.ui.openGame(gameContent.gameId);await settle();await assert.rejects(f.ui.openGame('korean-rhythm'),/게임을 연결하고 있어요/);
  assert.equal(f.ui.status().selected.id,gameContent.id);finish();await opening;assert.equal(f.ui.status().gameVisible,true);assert.doesNotMatch(f.root.innerHTML,/게임 연결 중/);
});
