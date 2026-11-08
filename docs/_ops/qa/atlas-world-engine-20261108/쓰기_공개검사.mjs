// 쓰기 연습을 같은 길로(2026-11-09)의 공개 후보를 실제로 돌린다 — 쓰기_공개묶음.cjs가 지은 check/ 폴더(후보 네 파일 + 공개본 파일)를 import한다.
//   node docs/_ops/qa/atlas-world-engine-20261108/쓰기_공개검사.mjs <check 폴더>
// 후보 쓰기 모듈(공개본 10-21 판 + 이 고침)을 공개본 계정 묶음의 코치로 눌러 본다: 게임 뒤(새 코치) · 다른 탭의 새로 시작 · 한 번 던진 답 뒤에도 기록이 남고,
// 공개본 판은 같은 일에서 끊긴다(결함 재현). 후보 앱 셸의 practiceCoach · 배우기 화면 · 알림 기기의 놓기를 공개본 엔진으로 돌리고, 후보에 이 고침 밖의 것이 없는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=path.resolve(process.argv[2]||'');
if(!fs.existsSync(path.join(dir,'world-writing-practice.mjs')))throw Error(`check 폴더가 아니다: ${dir}`);
const load=name=>import(pathToFileURL(path.join(dir,name)).href);
const text=name=>fs.readFileSync(path.join(dir,name),'utf8');
const [candidate,livePractice,{worldLearning,createWorldLearningPlan},{createLifeProgress},{PACKS,LESSONS},{createWorldEducation},{createTrailTimes}]=await Promise.all([
 load('world-writing-practice.mjs'),load('world-writing-practice.live.mjs'),load('world-account.bundle.mjs'),load('life-progress.mjs'),load('life-content.mjs'),load('world-learning-ui.mjs'),load('world-reminder-device.mjs')]);
const BANK=JSON.parse(text('world-writing-items.json'));
const OPEN=BANK.items.filter(item=>item.review?.status==='passed'),first=type=>OPEN.find(item=>item.type===type);
const fetcher=async()=>({ok:true,json:async()=>BANK});
await candidate.loadWritingBank(fetcher);await livePractice.loadWritingBank(fetcher);
const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const clockFrom=()=>{let t=Date.parse('2026-11-09T03:00:00Z');return ()=>new Date(t+=1000).toISOString();};

// 가짜 문서(qa/world-writing-trail.test.mjs와 같은 꼴): 쓰기 시트 뿌리 하나, 입력 · 누름은 붙은 처리기를 직접 부른다.
function sheet(){
 const node=()=>({textContent:'',innerHTML:'',outerHTML:'',hidden:false,disabled:false,dataset:{},style:{setProperty(){}},focus(){},setAttribute(){},removeAttribute(){},remove(){},insertAdjacentHTML(){},
  querySelector:()=>node(),querySelectorAll:()=>[],contains:()=>true,closest:()=>null,previousElementSibling:null,tagName:'DIV'});
 const handlers={},stage=node();let html='';
 const root={...node(),addEventListener:(type,fn)=>{handlers[type]=fn;},removeEventListener(){},get firstElementChild(){return stage;}};
 Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{html=value;}});
 stage.parentElement=root;
 return {doc:{querySelector:selector=>selector==='#panel-content [data-ww-stage]'?stage:null,visibilityState:'visible',defaultView:{confirm:()=>true}},
  type:(blank,value)=>handlers.input?.({target:{dataset:{wwBlank:blank},value,matches:s=>s==='[data-ww-blank]'}}),
  press:(attr,dataset={})=>{const button={...node(),dataset,hasAttribute:name=>name===attr};button.closest=()=>button;handlers.click?.({target:button});}};
}
async function bench(module,coach){
 let tick=Date.parse('2026-11-09T03:00:00Z');const page=sheet(),resources=[];
 const practice=module.createWritingPractice({show(){},home:{attachPanelResource:r=>resources.push(r),toast(){}},getOwner:()=>'acc',storage:memory(),coach,now:()=>tick+=1000,doc:page.doc,fetcher});
 await practice.open('writing');
 return {check:(item,value='저는 주말마다 도서관에서 책을 읽습니다.')=>{page.press('data-ww-open',{wwOpen:item.id});for(const blank of item.blanks)page.type(blank.id,value);page.press('data-ww-check');page.press('data-ww-back');},
  close:()=>{practice.dispose();for(const r of resources.splice(0))r.dispose();}};
}
const writingOf=(events,item)=>{const shown=events.filter(e=>e.type==='practice.presented'&&e.itemKey===`writing.${item.id}`),ids=new Set(shown.map(e=>e.id));
 return {shown:shown.length,attempts:events.filter(e=>e.type==='practice.attempted'&&ids.has(e.presentationId)).map(e=>e.attemptNo)};};
// 앱 셸의 쓰기 코치 함수 — 후보는 practiceCoach, 공개본은 openWriting 안의 옛 함수(한 번 받은 코치를 그대로 돌려준다)를 글 그대로 꺼낸다.
function shellCoach(file,win,learning,owner,storage){
 const shell=text(file),open=shell.slice(shell.indexOf('function openWriting('),shell.indexOf('\n}\n',shell.indexOf('function openWriting(')));
 if(shell.includes('function practiceCoach(')){const from=shell.indexOf('const releaseCoach='),to=shell.indexOf('let writingCoach=null,speakingCoach=null;');
  return new Function('window','worldLearning','writingOwnerId','localStorage',`${shell.slice(from,to)}\nreturn practiceCoach;`)(win,learning,()=>owner,storage)('world-writing',owner);}
 const from=open.indexOf('coach:()=>{')+'coach:'.length,to=open.indexOf('return coach;}})',from)+'return coach;}'.length;
 assert.ok(from>'coach:'.length&&to>from,`${file}: 쓰기 코치 함수를 못 찾았다`);
 return new Function('window','worldLearning','writingOwnerId','owner','localStorage',`let coach=null;return ${open.slice(from,to)};`)(win,learning,()=>owner,owner,storage);
}
// 게임을 연 일: 계정 통로가 새로 열리고 앞 통로의 코치는 끝난다(prepareGame). 가짜 통로는 실제 공개본 엔진 코치를 같은 계정 저장소로 준다.
async function afterGame(module,shellFile){
 const shared=memory(),clock=clockFrom(),win={},learning={engine:worldLearning.engine,createLearningSync(){}};
 const host=()=>{const coaches=[];return {coaches,createGame:(options,factory)=>{const coach=factory({...options,storage:shared,clock,followups:true});coaches.push(coach);return coach;},stop(){for(const c of coaches)c.dispose();}};};
 win.SYNKLearningHost=host();
 const b=await bench(module,shellCoach(shellFile,win,learning,'acc',memory()));
 try{
  const w51=first(51),w52=first(52);
  b.check(w51);win.SYNKLearningHost.stop();win.SYNKLearningHost=host();
  b.check(w52);b.check(w51,'다시 써 보면 문장이 더 자연스럽습니다.');
  const events=worldLearning.engine.createGame({gameId:'world-home',storage:shared,clock,followups:true}).events();
  return {w51:writingOf(events,w51),w52:writingOf(events,w52),measure:events.find(e=>e.type==='practice.presented')?.measure};
 }finally{b.close();}
}

test('후보(앱 셸 + 쓰기 모듈): 게임 뒤 다른 문항 · 앞 문항이 모두 남고 앞 판 번호를 끌지 않는다 — 공개본 판은 같은 일에서 끊긴다(Edge 재현과 같은 숫자), 측정 칸은 두 판이 같다',async()=>{
 const fixed=await afterGame(candidate,'app-shell.mjs'),old=await afterGame(livePractice,'app-shell.live.mjs');
 assert.deepEqual(fixed.w52,{shown:1,attempts:[1]},'후보: 게임 뒤 52번이 남는다');
 assert.deepEqual(fixed.w51,{shown:2,attempts:[1,1]},'후보: 51번은 새 판의 첫 시도');
 assert.deepEqual(old.w52,{shown:0,attempts:[]},'공개본: 게임 뒤 52번이 안 남는다');
 assert.deepEqual(old.w51,{shown:1,attempts:[1]},'공개본: 51번 다시 점검이 안 남는다');
 assert.deepEqual({...fixed.measure},{...old.measure},'측정 칸은 그대로');
});

test('후보 쓰기 모듈: 다른 탭이 기록을 새로 시작한 뒤 · 한 번 던진 답 뒤에도 기록이 이어진다(공개본 판은 던진 뒤 그 판의 시도가 막힌다)',async()=>{
 const run=async module=>{
  const storage=memory(),clock=clockFrom(),coach=worldLearning.engine.createGame({gameId:'world-writing',storage,clock,followups:true});let failNext=false;
  const flaky=Object.freeze({...coach,answer:(pid,result)=>{if(failNext){failNext=false;throw Error('boom');}return coach.answer(pid,result);}});
  const b=await bench(module,()=>flaky),w51=first(51);
  try{
   b.check(w51);failNext=true;b.check(w51,'두 번째 글입니다.');b.check(w51,'세 번째 글입니다.');
   const thrown=writingOf(coach.events(),w51);
   worldLearning.engine.createGame({gameId:'world-home',storage,clock,followups:true}).reset();
   b.check(w51,'네 번째 글입니다.');
   return {thrown,reset:writingOf(coach.events(),w51)};
  }finally{b.close();}
 };
 const fixed=await run(candidate),old=await run(livePractice);
 assert.deepEqual(fixed,{thrown:{shown:2,attempts:[1,1,2]},reset:{shown:1,attempts:[1]}},'후보');
 assert.deepEqual(old.thrown,{shown:1,attempts:[1]},'공개본: 던진 뒤 그 판의 시도가 「번호가 이어지지 않음」으로 막힌다');
 assert.deepEqual(old.reset,{shown:0,attempts:[]},'공개본: 새로 시작한 기록에 안 남는다');
});

test('후보 앱 셸 practiceCoach를 공개본 엔진으로: 손님 기기 코치는 재확인을 지키며 접고, 끝나면 dispose로 놓는다(기기 코치에는 disconnect가 없다) · 쓰기 · 말하기가 이 함수를 쓴다',()=>{
 const shell=text('app-shell.mjs'),from=shell.indexOf('const releaseCoach='),to=shell.indexOf('let writingCoach=null,speakingCoach=null;');
 assert.ok(from>0&&to>from);
 const storage=memory(),made=[];
 const learning={engine:{createGame:options=>{const coach=worldLearning.engine.createGame(options);made.push({options,coach});return coach;}},createLearningSync(){}};
 const coachOf=new Function('window','worldLearning','writingOwnerId','localStorage',`${shell.slice(from,to)}\nreturn practiceCoach;`)({},learning,()=>'guest',storage)('world-writing','guest');
 const device=coachOf();
 assert.equal(typeof device.dispose,'function');assert.equal(device.disconnect,undefined,'공개본 엔진의 기기 코치에는 disconnect가 없다(3번의 전제)');
 assert.deepEqual([made[0].options.gameId,made[0].options.followups,made[0].options.storage===storage],['world-writing',true,true]);
 assert.equal(coachOf(),device,'산 코치는 그대로');
 coachOf.release();assert.throws(()=>device.events(),/game closed/,'놓으면 실제로 닫힌다');
 assert.notEqual(coachOf(),device,'놓은 뒤에는 새로 받는다');
 for(const [fn,id] of [['openWriting','world-writing'],['openSpeaking','world-speaking']]){const body=shell.slice(shell.indexOf(`function ${fn}(`),shell.indexOf('\n}\n',shell.indexOf(`function ${fn}(`)));assert.ok(body.includes(`practiceCoach('${id}',owner)`),fn);}
 assert.ok(shell.slice(shell.indexOf('function openWriting('),shell.indexOf('\n}\n',shell.indexOf('function openWriting('))).includes('prepareLearningHost()'),'쓰기를 열 때 통로를 준비한다');
 assert.ok(!shell.includes('if(coach)return coach;'),'옛 꼴이 없다');
 assert.ok(shell.includes("worldLearning.engine.createGame({gameId:'world-reminders',storage:localStorage,followups:true})"),'손님 공부 시각 코치도 재확인을 지키며 접는다');
});

test('후보 배우기 화면 · 알림 기기의 놓기를 공개본 엔진으로: 손님 기기 코치가 실제로 닫힌다',()=>{
 const storage=memory(),life=createLifeProgress({storage,owner:'guest'});life.summary(PACKS,LESSONS);
 const education=createWorldEducation({home:{updateStudy(){},toast(){},showPanel(){},closePanel(){}},getProgress:()=>life,engine:worldLearning,createPlan:createWorldLearningPlan,launchGame(){},startLesson(){},startReview(){},
  target:{localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector:()=>null}}});
 const coach=education.lifeLearning.coach();assert.ok(coach);assert.deepEqual(coach.events(),[]);
 education.dispose();assert.throws(()=>coach.events(),/game closed/,'배우기 화면을 치우면 기기 코치를 닫는다');
 const device=worldLearning.engine.createGame({gameId:'world-reminders',storage,followups:true});
 const trail=createTrailTimes({host:()=>null,make:()=>device});assert.deepEqual(trail.read(),[]);trail.dispose();
 assert.throws(()=>device.events(),/game closed/,'공부 시각 코치도 닫는다');
});

test('후보에는 이 고침만 있다 — 「한 가지 고치기」 · master의 미공개 앱 셸 변경이 없고, 공개본에 없던 이름을 부르지 않는다',()=>{
 const writing=text('world-writing-practice.mjs'),live=text('world-writing-practice.live.mjs');
 assert.ok(!writing.includes('world-writing-focus'),'쓰기 모듈에 「한 가지 고치기」가 실리지 않는다');
 assert.ok(writing.includes('function record(it,{assisted},retry=true){')&&live.includes('function record(it,{assisted}){'));
 const shell=text('app-shell.mjs'),liveShell=text('app-shell.live.mjs');
 for(const unpublished of ['mountCourseWritingEntry','hangulMigration','writingCandidates'])assert.equal(shell.includes(unpublished),liveShell.includes(unpublished),`앱 셸: ${unpublished}는 공개본 그대로`);
 // 후보가 부르는 이름(import)은 공개본과 같다 — 옛 판이 캐시에 남은 10분 동안 깨지지 않는다.
 const imports=source=>[...source.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)'/gm)].map(m=>`${m[2]}:${m[1].replace(/\s+/g,'')}`).sort();
 for(const name of ['app-shell','world-learning-ui','world-reminder-device','world-writing-practice'])assert.deepEqual(imports(text(`${name}.mjs`)),imports(text(`${name}.live.mjs`)),`${name}: import 줄이 공개본과 같다`);
 assert.ok(!text('world-learning-ui.mjs').includes('.disconnect?.()')&&!text('world-reminder-device.mjs').includes('coach?.disconnect?.();'),'놓기가 dispose까지 본다');
});
