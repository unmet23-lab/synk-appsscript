// Atlas 재설계 단계 4-1 — 켜진 판(기능 atlasNext)의 짧은 연습 셸(world-learning-ui.mjs runPracticeNext)을 가짜 패널로 돈다.
// 셸이 다음 판에 넘기는 값과 문항 위 힌트의 꼴만 본다 — 판(world-practice-next.mjs)과 엔진은 가짜다(그쪽은 packages/atlas의
// coach/world-practice.test.mjs가 진짜 지도 · 은행으로 돈다). 4-1 화면 Fable 5.2 다시 FA1: 「새 말 더 배우기」로 연 판 뒤의
// 「더 하기」가 more를 이어 넘기는 줄과 듣기 힌트를 고르는 줄을 도는 시험이 없어, 옛 꼴로 돌아가도 시험이 모두 통과했다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// 변형 시험(qa/plan-mutants.mjs)은 깬 셸 사본을 SYNK_LEARNING_UI_MODULE로 넘긴다. 그 밖에는 원본이다.
const {createWorldEducation}=await import(process.env.SYNK_LEARNING_UI_MODULE?pathToFileURL(process.env.SYNK_LEARNING_UI_MODULE).href:'../world-learning-ui.mjs');
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
worldPosition.topik.use(JSON.parse(read('world-topik-items.json')));
const heard=item=>item.audioRequired??item.modality==='listening';

// 판 상자: innerHTML 글을 들고 단추 누르기만 흉내 낸다(atlas-next-off.test.mjs와 같은 방식, 이 저장소에 DOM 도구가 없다).
function stage(){
 const clicks=[];
 const box={html:'',isConnected:true,get innerHTML(){return this.html;},set innerHTML(value){this.html=String(value);},
  addEventListener(type,fn){if(type==='click')clicks.push(fn);},contains:()=>true,closest:()=>null,focus(){},querySelectorAll:()=>[],
  querySelector:()=>({focus(){},addEventListener(){}})};
 box.press=(attr,value='')=>{
  const camel=attr.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  const button={dataset:{[camel]:value},disabled:false,hasAttribute:name=>name===attr};
  for(const fn of [...clicks])fn({target:{closest:selector=>selector==='button'||selector.includes(attr)?button:null}});
 };
 return box;
}

// 가짜 판 — 준 문항 보기(views)를 차례로 내고, 다 내면 끝 까닭(ending)과 남은 처음 보는 문항 수(fresh)로 끝난다.
function fakeSession({views=[],ending={kind:'done'},fresh=3}={}){
 let at=-1;
 return {
  get current(){return views[at]??null;},
  next(){at+=1;return views[at]??null;},
  preHelp(){},answer(){},unknown(){},skip(){},replay:()=>null,delivery(){},stop(){},
  results:()=>[],settled:async()=>[],freshLeft:()=>fresh,
  get ending(){return ending;},
 };
}

// 손님 셸 하나 — 판을 열 때마다 셸이 넘긴 값(opened)을 남기고, 다음 가짜 판(sessions의 앞)을 준다.
// homeNext: 새 길 홈 입구(4-4b 판 기록을 보는 시험만 — 플래너는 없어 홈은 지금 판이다).
function world(sessions,{retired=null,toasts=[],homeNext=null}={}){
 const opened=[];
 let box=null,resource=null;
 const values=new Map();
 const progress={owner:'guest',learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio:'on'}),
  status:()=>({phase:'synced',rejected:false,scoped:false,message:''}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>({answer:'reads'})};
 const home={updateStudy(){},toast:message=>toasts.push(message),closePanel(){},attachPanelResource(value){resource=value;},showPanel:(title,html)=>{if(/data-practice-stage/.test(html))box=stage();}};
 const target={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
  addEventListener(){},removeEventListener(){},setTimeout,document:{querySelector:selector=>/data-practice-stage/.test(selector)?box:null}};
 const atlasNext={practiceCoach:async()=>({}),createPracticeNextSession:options=>{opened.push(options);const next=sessions.shift();return typeof next?.settled==='function'?next:fakeSession(next);},...(retired?{retired}:{})};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:()=>({selected:null,reason:''}),launchGame(){},startLesson(){},startReview(){},position:worldPosition,target,atlasNext,...(homeNext?{homeNext}:{})});
 // close: 홈이 판을 닫는다 — 판 글을 문서에서 떼고 판 자원을 dispose한다(home.mjs disposePanelContent). 떼지 않으면 닫은 뒤 이어 온 판 끝이 그린다.
 return {education,opened,toasts,box:()=>box,close:()=>{if(box)box.isConnected=false;resource?.dispose?.();}};
}

// 셸의 일(판 열기 · 판 끝)은 비동기다 — 조건이 설 때까지 틱을 넘긴다(한도 안에서).
async function until(ready){
 for(let tick=0;tick<400&&!ready();tick+=1)await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(ready(),'셸이 한도 안에 그 화면에 닿았다');
}
const done=w=>Boolean(w.box()?.html.includes('data-practice-done'));

test('「새 말 더 배우기」로 연 판 뒤의 「더 하기」는 more를 이어 넘기고, 보통 판 뒤의 「더 하기」는 넘기지 않는다(FA1)',async()=>{
 const skillId=worldPosition.practice.pool.find(item=>/^ko\.reading\./.test(item.skillId)).skillId;
 const chain=world([{ending:{kind:'limited'}},{ending:{kind:'done'},fresh:3},{ending:{kind:'done'},fresh:2}]);
 await chain.education.practice(skillId);
 await until(()=>done(chain));
 assert.match(chain.box().html,/data-practice-more/,'새 말이 판 한도에 걸린 판은 「새 말 더 배우기」');
 chain.box().press('data-practice-more');
 await until(()=>chain.opened.length===2&&done(chain));
 assert.match(chain.box().html,/data-practice-again/);
 chain.box().press('data-practice-again');
 await until(()=>chain.opened.length===3&&done(chain));
 chain.box().press('data-practice-again');
 await until(()=>chain.opened.length===4);
 assert.deepEqual(chain.opened.map(row=>row.more),[false,true,true,true],'더 배우기로 연 뒤의 더 하기는 같은 방문 안에서 more를 잇는다');
 const plain=world([{ending:{kind:'done'},fresh:3}]);
 await plain.education.practice(skillId);
 await until(()=>done(plain));
 plain.box().press('data-practice-again');
 await until(()=>plain.opened.length===2);
 assert.deepEqual(plain.opened.map(row=>row.more),[false,false],'보통 판의 더 하기는 보통 판');
});

test('끈질긴 단위 힌트는 듣기 문항이면 듣기 꼴(「들으면서」), 읽기 문항이면 읽기 꼴로 그린다(FA1 · 앞 F2)',async()=>{
 const pool=worldPosition.practice.pool;
 const listen=pool.find(heard),reading=pool.find(item=>!heard(item));
 assert.ok(listen&&reading,'은행에 듣기 · 읽기 문항이 있다');
 const view=item=>({item,index:0,total:5,upTo:true,heard:false,why:null,stubborn:true,targetLabel:'시계'});
 for(const [item,form,other] of [[listen,/들으면서 먼저 찾아보세요/,/문제 속에서/],[reading,/문제 속에서 먼저 찾아보세요/,/들으면서/]]){
  const w=world([{views:[view(item)]}]);
  await w.education.practice(item.skillId);
  await until(()=>Boolean(w.box()?.html.includes('data-practice-cue')));
  assert.match(w.box().html,form);
  assert.doesNotMatch(w.box().html,other);
  assert.match(w.box().html,/「시계」/);
 }
});

test('판 끝이 답 저장을 기다리는 사이 판이 바뀌면 끝 화면 대신 안내 한 줄과 함께 닫는다 — 닫힌 코치의 남은 수를 못 세도 끝 화면이 서고 거절이 새지 않는다(넘친 #10)',async()=>{
 const skillId=worldPosition.practice.pool.find(item=>/^ko.reading./.test(item.skillId)).skillId;
 let release=null,watcher=null;
 const held={...fakeSession(),settled:()=>new Promise(resolve=>{release=resolve;}),freshLeft:()=>{throw Object.assign(Error('DISPOSED'),{code:'DISPOSED'});}};
 const toasts=[];
 const w=world([held],{toasts,retired:(_coach,fn)=>{watcher=fn;return()=>{watcher=null;};}});
 await w.education.practice(skillId);
 await until(()=>typeof release==='function');
 assert.equal(typeof watcher,'function','판이 바뀌면 부를 함수를 건다');
 watcher({reason:'account'});
 release([]);
 await until(()=>toasts.length>0);
 assert.equal(done(w),false,'끝 화면을 그리지 않는다');
 assert.equal(toasts.length,1,'안내 한 줄');
 const plain=world([{...fakeSession(),freshLeft:()=>{throw Object.assign(Error('DISPOSED'),{code:'DISPOSED'});}}]);
 await plain.education.practice(skillId);
 await until(()=>done(plain)); // freshLeft가 던져도(닫힌 코치) 끝 화면이 선다 — 남은 수는 모름(null)으로 그린다
});

test('새 길 짧은 연습이 끝나면 이 기기의 판 기록에 그 영역(읽기 · 듣기)을 적는다 — 채점된 첫 답이 있을 때만, 한 판에 한 번(4-4b 단계4_계획 §21-6 가)',async()=>{
 const pool=worldPosition.practice.pool;
 const reading=pool.find(item=>item.skillId.startsWith('ko.reading.')).skillId,listening=pool.find(item=>item.skillId.startsWith('ko.listening.')).skillId;
 const graded=[{verdict:'correct',skipped:false},{verdict:'incorrect',skipped:false}],skipped=[{verdict:null,skipped:true}];
 const ended=rows=>({...fakeSession(),results:()=>rows,settled:async()=>rows});
 for(const [skillId,rows,expected] of [[reading,graded,['reading']],[listening,graded,['listening']],[reading,skipped,[]],[reading,[],[]]]){
  const logged=[],coaches=[];
  const homeNext={planner:async()=>null,life:()=>'old',ask:async()=>{},judge:()=>null,answers:()=>null,openGames:()=>null,coach:async()=>null,retired:()=>()=>{},painted(){},
   planLog:made=>{coaches.push(made);return {record:area=>{logged.push(area);return true;}};}};
  const w=world([ended(rows)],{homeNext});
  await w.education.practice(skillId);
  await until(()=>done(w));
  await new Promise(resolve=>setTimeout(resolve,0));
  w.close(); // 끝 화면 뒤에 판을 닫아도(판 자원의 dispose) 같은 판을 다시 세지 않는다
  assert.deepEqual(logged,expected,`${skillId} · ${rows.length ? (rows[0].skipped ? '건너뜀만' : '채점된 답') : '답 없음'}`);
  if(expected.length)assert.equal(coaches.length,1,'판 기록은 그 판의 코치(입구가 연 짧은 연습 코치)로 연다');
 }
});

test('새 길 짧은 연습을 도중에 닫아도(판 자원의 dispose) 채점된 첫 답이 있으면 한 판으로 적는다 — 닫기를 두 번 받아도 한 번(4-4b)',async()=>{
 const pool=worldPosition.practice.pool,item=pool.find(row=>row.skillId.startsWith('ko.reading.'));
 const view={item,index:0,total:5,upTo:true,heard:false,why:null,stubborn:false,targetLabel:null};
 for(const [rows,expected] of [[[{verdict:'incorrect',skipped:false}],['reading']],[[],[]]]){
  const logged=[];
  const homeNext={planner:async()=>null,life:()=>'old',ask:async()=>{},judge:()=>null,answers:()=>null,openGames:()=>null,coach:async()=>null,retired:()=>()=>{},painted(){},
   planLog:()=>({record:area=>{logged.push(area);return true;}})};
  // 가짜 판을 펼쳐 복사하지 않는다 — 지금 문항(current) 게터가 복사 때의 빈 값으로 굳어 셸이 바로 판 끝으로 간다.
  const running=Object.assign(fakeSession({views:[view]}),{results:()=>rows,settled:async()=>rows});
  const w=world([running],{homeNext});
  await w.education.practice(item.skillId);
  await until(()=>Boolean(w.box()?.html.includes('data-practice-run')));
  assert.doesNotMatch(w.box().html,/data-practice-done/,'문항이 떠 있다(판이 아직 끝나지 않았다)');
  w.close();
  w.close();
  assert.deepEqual(logged,expected,rows.length?'답이 있는 판':'답 없이 닫은 판은 세지 않는다');
 }
});
