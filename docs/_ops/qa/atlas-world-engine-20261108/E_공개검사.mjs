// Atlas × WORLD 2단계 E(2026-11-08) — 공개본 계정 묶음에 끼운 줄과 합친 날것 모듈을 실제로 돌린다(현장 노트 배포 · 공개: node --check와 앵커 대조만으로는 끼운 줄이 안 돈다).
// E_공개묶음.cjs가 만든 check/ 폴더(후보 묶음 · E 엔진 판 · 합친 말하기 · 배우기 모듈 + 공개본의 원천 · 묶음)에서 import해 본다. 다르면 멈춘다(종료 코드 1).
//   ① 지도: 공개본 코치 지도 + 말하기 6마디만(생활 과제 층 없음 — D의 남은 일), 지도판 = 기본판 + 층 지문 · 120자 안
//   ② 합친 말하기 화면 + 후보 묶음: 열기만 하면 사건 0 · 센 시도는 「채점 안 함」 · 이 기기 기록과 사건 id로 이음 · 잘못 들음은 Trail 0 · 역할극
//   ③ 섞임: 합친 화면 + 공개본 묶음(조회 없음) → 기기 기록만 · 옛 앱 셸(사건 없음) → 이 기기만 센다
//   ④ 합친 배우기 화면 + 후보 묶음: 홈 후보의 열쇠 · 다른 기기의 말하기를 이번 주 한 번으로 · 말하기 안 고른 학생은 후보 없음
//   ⑤ 추천: 방금 한 유형이 뒤로 · 여섯 주에 여섯 유형, 「내 위치」 판 그대로
//   ⑥ 재확인: 공개본이 적은 재확인이 자란 지도(후보)에서 이어짐 — 공급은 그 화면이 쓰는 소비자로(계정 길은 따로 공개된 world-learning-followups.mjs)
//   ⑦ 혼자 여는 홈의 생활 묶음: 공개본은 말하기 사건(spoken)이 섞인 기기 기록을 통째로 못 읽고(결함 재현), 고친 판은 지금처럼 읽으며 그 재확인도 묶음 안의 공급으로 이어짐
//   ⑧ 후보 · 공개본 · LAB try/(temper-followup-1)가 같은 기기 장부를 접을 때 world-practice 재확인이 어찌 되는지 잰다(단계 README §8 남은 확인 — 지도를 키우는 첫 공개)
//   node docs/_ops/qa/atlas-world-engine-20261108/E_공개검사.mjs <check 폴더>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const dir=path.resolve(process.argv[2]||'');
if(!fs.existsSync(path.join(dir,'world-speaking-engine.mjs')))throw Error(`check 폴더가 아니다: ${dir}`);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const require=createRequire(import.meta.url);
const {공용작업본}=require(path.join(ROOT,'tools/lib/공용작업본.js'));
const acorn=require(path.join(공용작업본(ROOT),'node_modules','acorn'));
const at=file=>pathToFileURL(path.join(dir,file)).href;
// 마이크 알림(world-sound.mjs)이 여는 BroadcastChannel은 Node에서 프로세스를 붙잡는다 — 가짜로.
globalThis.BroadcastChannel=class{postMessage(){}close(){}addEventListener(){}removeEventListener(){}};
globalThis.cancelAnimationFrame??=()=>{};
globalThis.FileReader??=class{readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:audio/webm;base64,${Buffer.from(buffer).toString('base64')}`;this.onload?.();},error=>{this.error=error;this.onerror?.();});}};
const DAY=86400000;
const flush=(ms=0)=>new Promise(resolve=>setTimeout(resolve,ms));
const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const checks=[];
const check=async(name,fn)=>{await fn();checks.push(name);};
const probes=[];

try{
 const fresh=await import(at('world-account.bundle.mjs'));
 const before=await import(at('live-account.bundle.mjs'));
 const engineFile=await import(at('world-speaking-engine.mjs'));
 const {followupRows}=await import(at('world-learning-followups.mjs'));
 const speakingModule=await import(at('world-speaking-practice.mjs'));
 const BANK=JSON.parse(fs.readFileSync(path.join(dir,'world-speaking-items.json'),'utf8'));
 await speakingModule.loadSpeakingBank(async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(fileURLToPath(url),'utf8'))}));
 const version=side=>side.worldLearning.engine.createGame({gameId:'e-pub-map',storage:memory(),clock:()=>'2026-11-09T03:00:00.000Z'}).mapVersion;
 const SPEAK=['ko.speaking.answer','ko.speaking.roleplay','ko.speaking.narrate','ko.speaking.respond','ko.speaking.interpret','ko.speaking.opinion'];

 // ① 지도.
 await check('공개본 코치 지도 + 말하기 6마디만 — 지도판은 기본판 + 층 지문, 120자 안',()=>{
  const v=version(fresh),base=version(before);
  assert.equal(v,`${base}:layers-${engineFile.fingerprint(engineFile.layerVersion)}`);
  assert.ok(v.length<=120,`${v.length}자`);
  const ids=fresh.worldLearning.SKILLS.map(node=>node.id),old=before.worldLearning.SKILLS.map(node=>node.id);
  assert.deepEqual(ids,[...old,...SPEAK],'공개본 마디 뒤에 말하기 여섯만');
  assert.ok(!ids.some(id=>String(id).startsWith('life.task.')),'생활 과제 층은 없다(D의 남은 일)');
  for(const id of SPEAK)assert.equal(fresh.worldLearning.SKILLS.find(node=>node.id===id).domain,'speaking');
 });
 await check('측정 조회: 유형 · 역할극 → 그 능력 · 난도 1 · spoken, 모르면 null',()=>{
  const {measure,version:layer}=fresh.worldLearning.speaking;
  for(let type=1;type<=6;type++)assert.deepEqual(measure({type}),{skillId:SPEAK[type-1],modality:'speaking',difficulty:1,responseFormat:'spoken',audioRequired:false});
  assert.equal(measure({roleplay:'rp-cafe-tea'}).skillId,'ko.speaking.roleplay');
  assert.equal(measure({type:7}),null);assert.equal(measure({roleplay:'nope'}),null);
  assert.equal(layer(),engineFile.layerVersion);
  assert.equal(before.worldLearning.speaking,undefined,'공개본에는 조회가 없다');
 });

 // ② 합친 말하기 화면 + 후보 묶음.
 function sheet(){
  const node=()=>({textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},style:{setProperty(){}},focus(){},setAttribute(){},removeAttribute(){},querySelector:()=>node(),querySelectorAll:()=>[],contains:()=>true,closest:()=>null,previousElementSibling:null,tagName:'DIV'});
  let handler=null,html='';const stage=node();
  const root={...node(),addEventListener:(type,fn)=>{if(type==='click')handler=fn;},removeEventListener(){},closest:()=>null,get firstElementChild(){return stage;}};
  Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{html=value;}});stage.parentElement=root;
  return {doc:{querySelector:selector=>selector==='#panel-content [data-wsp-stage]'?stage:null,activeElement:null,body:{}},press:(attr,dataset={})=>{const button={...node(),dataset,hasAttribute:name=>name===attr,closest:()=>button};handler?.({target:button});}};
 }
 class FakeRecorder{constructor(){this.state='inactive';this.mimeType='audio/webm';}static isTypeSupported(){return true;}start(){this.state='recording';}stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob(['소리'])});queueMicrotask(()=>this.onstop?.());}}
 class FakeAudio{constructor(){this.on={};this.volume=1;}addEventListener(type,fn){this.on[type]=fn;}play(){setTimeout(()=>this.on.ended?.(),0);return Promise.resolve();}pause(){}}
 const FEEDBACK={status:'ok',covered:[0],heard:{transcript:'주말에 공원에 가요.'},elements:{task:{good:'과제를 했어요.'},language:{good:'잘 말했어요.'},delivery:{good:'잘 들려요.'}}};
 function practiceBench({side=fresh,feedback=null}={}){
  let tick=Date.parse('2026-11-09T03:00:00Z');const clock=()=>new Date(tick+=1).toISOString(),storage=memory(),coachStorage=memory(),page=sheet();
  storage.setItem('synk.world.speaking.v1:guest',JSON.stringify({consent:{at:'2026-11-01T00:00:00.000Z',version:1},log:[]}));
  const coach=side.worldLearning.engine.createGame({gameId:'world-speaking',storage:coachStorage,clock});
  const win={navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},MediaRecorder:FakeRecorder,Audio:FakeAudio};
  const practice=speakingModule.createSpeakingPractice({show(){},home:{attachPanelResource(){},toast(){}},getOwner:()=>'guest',storage,feedback,coach:()=>coach,measure:side.worldLearning.speaking?.measure,now:()=>tick,doc:page.doc,win});
  return {practice,page,coach,events:type=>coach.events().filter(e=>!type||e.type===type),log:()=>JSON.parse(storage.getItem('synk.world.speaking.v1:guest')).log};
 }
 const speak=async b=>{b.page.press('data-wsp-start');await flush();b.page.press('data-wsp-skip');b.page.press('data-wsp-stop');await flush();await flush();};
 const status={enabled:true,itemsVersion:BANK.contentHash,dailyLimit:4,remaining:3,turnEnabled:false},feedback={status:async()=>status,request:async()=>({status:'ok',remaining:2,feedback:FEEDBACK})};
 await check('합친 말하기 + 후보 묶음: 열기만 하면 사건 0, 스스로 확인은 「채점 안 함」 하나(spoken · 난도 1), 이 기기 기록과 사건 id로 이음',async()=>{
  const b=practiceBench();await b.practice.open('speaking:1');assert.deepEqual(b.events(),[]);
  await speak(b);b.page.press('data-wsp-self-save');
  const [shown]=b.events('practice.presented'),[attempt]=b.events('practice.attempted');
  assert.equal(shown.itemKey,'speaking.s1-weekend');assert.equal(shown.taskVersion,version(fresh));
  assert.deepEqual([shown.measure.skillId,shown.measure.difficulty,shown.measure.responseFormat,shown.measure.modality],[SPEAK[0],1,'spoken','speaking']);
  assert.equal(attempt.verdict,'unassessed');assert.equal(b.log().at(-1).trail,attempt.id);
  assert.equal(b.events('decision.made')[0].experienceId,'world-speaking');
 });
 await check('합친 말하기 + 후보 묶음: 자동 피드백 시도는 떠날 때 남고 다음 시도에 hint 도움, 잘못 들음만 하고 떠나면 Trail 사건 0',async()=>{
  const b=practiceBench({feedback});await b.practice.open('speaking:1');await flush();await speak(b);b.page.press('data-wsp-send');await flush(5);await flush();
  assert.deepEqual(b.events(),[],'떠나기 전에는 Trail에 없다');
  b.page.press('data-wsp-retry');const [first]=b.events('practice.attempted');assert.equal(b.log().at(-1).trail,first.id);
  await speak(b);b.page.press('data-wsp-self-save');assert.equal(b.events('practice.helped').length,1,'hint 도움 하나');
  const c=practiceBench({feedback});await c.practice.open('speaking:2');await flush();await speak(c);c.page.press('data-wsp-send');await flush(5);await flush();
  c.page.press('data-wsp-misheard');c.page.press('data-wsp-back');assert.deepEqual(c.events(),[]);
  assert.deepEqual([c.log().at(-1).counted,c.log().at(-1).status],[false,'misheard']);
 });
 await check('합친 말하기 + 후보 묶음: 역할극 끝에 시도 하나 · 기기 기록과 이음',async()=>{
  const b=practiceBench();await b.practice.open('speaking:rp-cafe-tea');assert.deepEqual(b.events(),[]);
  b.page.press('data-wsp-rp-start');await flush(5);
  for(let turn=0;turn<3;turn++){b.page.press('data-wsp-rp-speak');await flush();b.page.press('data-wsp-rp-stop');await flush();await flush();b.page.press('data-wsp-rp-next');await flush(5);}
  const [attempt]=b.events('practice.attempted');assert.equal(attempt?.verdict,'unassessed');
  assert.equal(b.events('practice.presented')[0].measure.skillId,'ko.speaking.roleplay');
  assert.equal(b.log().find(e=>e.mode==='roleplay').trail,attempt.id);
 });

 // ③ 공개 직후 섞임: 합친 화면 + 공개본 묶음(캐시에 남은 옛 묶음).
 await check('합친 말하기 + 공개본 묶음(조회 없음): 기기 기록만 남고 화면은 그대로',async()=>{
  const b=practiceBench({side:before});await b.practice.open('speaking:3');await speak(b);b.page.press('data-wsp-self-save');
  assert.deepEqual(b.events(),[]);assert.deepEqual(b.log().map(e=>[e.itemId,e.counted,e.trail]),[['s3-birthday',true,undefined]]);
 });
 await check('말하기 후보: 조회가 있으면 유형이 여는 문항의 열쇠, 없으면 지금 꼴(옛 묶음)',()=>{
  const keyed=speakingModule.speakingCandidates({measure:fresh.worldLearning.speaking.measure});
  assert.equal(keyed.length,6);
  for(const row of keyed){const type=Number(row.route.split(':')[1]),it=BANK.items.find(i=>i.type===type);assert.equal(row.coreTargets[0].itemKey,`speaking.${it.id}`);assert.ok(!('familyKeys' in row.coreTargets[0]));}
  assert.ok(speakingModule.speakingCandidates({measure:before.worldLearning.speaking?.measure}).every(row=>!row.coreTargets));
 });

 // ④ 합친 배우기 화면 + 후보 묶음 + 공개본 생활 진도.
 const {createWorldEducation}=await import(at('world-learning-ui.mjs'));
 const {createLifeProgress}=await import(at('life-progress.mjs')),{PACKS,LESSONS}=await import(at('life-content.mjs'));
 function education({chosen=true,side=fresh,keys=true}={}){
  const storage=memory(),life=createLifeProgress({storage,owner:'guest'});life.summary(PACKS,LESSONS);
  life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{reasons:['exam'],primaryReason:'exam',examType:'topik1',targetGrade:2,examDate:'2027-04',weeklyMinutes:120},today:{audio:'available'}});
  speakingModule.writeSpeakingExam({storage,owner:'guest',on:chosen});
  const speakingPractice={available:()=>true,candidates:()=>keys?speakingModule.speakingCandidates({measure:side.worldLearning.speaking?.measure}):speakingModule.SPEAKING_CANDIDATES.filter(row=>row.exam==='speaking'),
   chosen:owner=>speakingModule.readSpeakingExam({storage,owner}),choose:(owner,on)=>speakingModule.writeSpeakingExam({storage,owner,on}),week:(owner,week,events)=>speakingModule.speakingWeek({storage,owner,week,events}),open(){}};
  const app=createWorldEducation({home:{updateStudy(){},toast(){},showPanel(){},closePanel(){}},getProgress:()=>life,engine:side.worldLearning,createPlan:side.createWorldLearningPlan,launchGame(){},startLesson(){},startReview(){},position:side.worldPosition,speakingPractice,
   target:{localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector:()=>null}}});
  return {storage,app};
 }
 const doType=(coach,type)=>{const it=BANK.items.find(i=>i.type===type),m=coach.__measure({type}),p=coach.present({id:`speaking-${it.id}`,itemKey:`speaking.${it.id}`,familyKey:`speaking.${it.id}`,...m});coach.answer(p,{correct:null,assessable:false});};
 await check('합친 배우기 + 후보 묶음: 말하기를 고른 학생의 홈 후보에 열쇠, 다른 기기의 말하기를 이번 주 한 번으로, 해 본 유형은 빠짐',()=>{
  const f=education(),offered=f.app.refresh().candidates.filter(c=>c.route==='speaking');
  assert.equal(offered.length,6);assert.ok(offered.every(c=>c.targets.length===1&&c.targets[0].itemKey.startsWith('speaking.s')));
  const coach=fresh.worldLearning.engine.createGame({gameId:'world-speaking',storage:f.storage});coach.__measure=fresh.worldLearning.speaking.measure;doType(coach,2);coach.flush?.();
  const plan=f.app.refresh();
  assert.equal(plan.examPlan.areas.find(row=>row.area==='speaking').done,1);assert.deepEqual(plan.examPlan.speaking,{untried:5,total:6});
  assert.ok(!plan.candidates.some(c=>c.routeId==='speaking:2'));
  const none=education({chosen:false}).app.refresh();assert.ok(!none.candidates.some(c=>c.route==='speaking'));assert.ok(!none.examPlan.areas.some(row=>row.area==='speaking'));
 });
 await check('합친 배우기 + 공개본 묶음(옛 묶음이 캐시에 남은 동안): 후보에 열쇠 없이 지금처럼 돈다',()=>{
  const plan=education({side:before}).app.refresh();
  assert.ok(plan.candidates.filter(c=>c.route==='speaking').every(c=>c.targets.length===0));
  assert.equal(plan.examPlan.speaking.total,6);
 });

 // ⑤ 추천 · 내 위치.
 await check('추천: 방금 한 유형이 뒤로 · 여섯 주에 여섯 유형 · 다시 볼 읽기 칸이 먼저 · 이유는 근거를 지어내지 않음',()=>{
  let t=Date.parse('2026-11-09T03:00:00Z');const mem=memory(),clock=()=>new Date(t+=1000).toISOString();
  const speak=fresh.worldLearning.engine.createGame({gameId:'world-speaking',storage:mem,clock}),home=fresh.worldLearning.engine.createGame({gameId:'world-home',storage:mem,clock});speak.__measure=fresh.worldLearning.speaking.measure;
  const rows=speakingModule.speakingCandidates({measure:fresh.worldLearning.speaking.measure}).map(c=>({id:c.id,minutes:c.minutes,targets:c.coreTargets.map(x=>({...x,skillIds:[...x.skillIds],conceptIds:[]})),goals:['exam','prepare','speaking'],audioRequired:true}));
  const order=()=>home.recommendActivities(rows,{settings:{goals:['exam']},at:clock()}).assessments.map(a=>Number(a.id.split('-').pop()));
  assert.deepEqual(order(),[1,2,3,4,5,6]);doType(speak,1);assert.notEqual(order()[0],1);
  const picks=[1];for(let w=0;w<5;w++){t+=7*DAY;const first=order()[0];picks.push(first);doType(speak,first);}
  assert.deepEqual([...picks].sort(),[1,2,3,4,5,6],picks.join('→'));
  const reading=fresh.worldLearning.engine.createGame({gameId:'world-practice',storage:mem,clock});
  for(const n of [1,2]){const p=reading.present({id:`r${n}`,itemKey:`qa.reading.${n}`,familyKey:`qa.reading.${n}`,skillId:'ko.reading.detail',modality:'reading',difficulty:1,responseFormat:'single-choice'});reading.answer(p,{correct:true,assessable:true});}
  t+=9*DAY;
  const withReading=[...rows,{id:'read-detail',minutes:5,targets:[{id:'tr',skillIds:['ko.reading.detail'],difficulty:1,modality:'reading',responseFormat:'single-choice',itemKey:'qa.reading.9',familyKey:'qa.reading.9',conceptIds:[]}],goals:['exam']}];
  const r=home.recommendActivities(withReading,{settings:{goals:['exam']},at:clock()});
  assert.equal(r.selected.id,'read-detail');
  for(const row of r.assessments.filter(a=>a.id.startsWith('topik-speaking-')))assert.deepEqual([row.state,row.reasons],['unseen',['goal.declared']]);
 });
 await check('「내 위치」 판은 말하기 시도가 쌓여도 그대로(채점 안 함은 능력 칸이 아니다) · 말하기 재확인 줄 없음',()=>{
  let t=Date.parse('2026-11-09T03:00:00Z');const mem=memory(),clock=()=>new Date(t+=1000).toISOString();
  const reading=fresh.worldLearning.engine.createGame({gameId:'world-practice',storage:mem,clock});
  for(const n of [1,2,3]){const p=reading.present({id:`r${n}`,itemKey:`qa.reading.${n}`,familyKey:`qa.reading.${n}`,skillId:'ko.reading.detail',modality:'reading',difficulty:1,responseFormat:'single-choice'});reading.answer(p,{correct:n!==2,assessable:true});}
  const home=fresh.worldLearning.engine.createGame({gameId:'world-home',storage:mem,clock});
  const map=()=>{const m=fresh.worldPosition.buildPositionMap({summary:home.summary(),events:home.events(),exam:'topik1'});return JSON.stringify({...m,asOf:null});};
  const a=map();const speak=fresh.worldLearning.engine.createGame({gameId:'world-speaking',storage:mem,clock});speak.__measure=fresh.worldLearning.speaking.measure;
  for(let type=1;type<=6;type++)doType(speak,type);
  assert.equal(map(),a);
  assert.ok(home.summary().skills.filter(s=>s.domain==='speaking').every(s=>s.status==='unseen'&&s.n===0));
  assert.deepEqual(home.followups().items.filter(row=>row.gameId==='world-speaking'),[]);
 });

 // ⑥ 재확인 이음(같은 기기 장부 · 앞 화면을 떠나며 기록을 내린 뒤 다음 판을 연다).
 function bench(start=Date.parse('2026-11-09T03:00:00Z')){
  let t=start,last=null;const mem=memory(),clock=()=>new Date(t+=1000).toISOString();
  const open=game=>{last?.flush?.();return last=game;};
  return {storage:mem,clock,open,api:(side,gameId='world-practice')=>open(side.worldLearning.engine.createGame({gameId,storage:mem,clock,followups:true})),raw:(side,data,gameId='world-practice')=>open(side.core.createGame({gameId,map:side.strata.createMap(data),storage:mem,clock,followups:true})),wait:days=>{t+=days*DAY;},close:()=>last?.flush?.()};
 }
 const item=(n,difficulty=1)=>({id:`e-${n}`,itemKey:`e-${n}.v1`,familyKey:`e-${n}`,skillId:'ko.reading.detail',difficulty,responseFormat:'single-choice',modality:'reading',audioRequired:false});
 const d1=(coach,gameId='world-practice')=>coach.followups().items.find(r=>r.gameId===gameId&&r.window==='d1');
 const answer=(coach,it,correct=true)=>coach.answer(coach.present(it),{correct,assessable:true});
 await check('재확인: 공개본이 적은 재확인이 후보(자란 지도)에서 남고 공급되며 새 문항이 짝이 된다',()=>{
  const b=bench();let coach=b.api(before);answer(coach,item(1));const recorded=coach.mapVersion;b.wait(2);
  coach=b.api(fresh);assert.notEqual(coach.mapVersion,recorded);
  const projection=coach.followups(),row=d1(coach);
  assert.deepEqual([projection.policy,row.status,row.current,row.measure.taskVersion],['temper-followup-2','due',true,recorded]);
  assert.equal(followupRows({projection,pool:[item(2)],seen:()=>false,taskVersion:coach.mapVersion}).rows.find(r=>r.window==='d1').available,true);
  answer(coach,item(2));assert.deepEqual([d1(coach).status,d1(coach).outcome],['observed','independent-correct']);
 });
 await check('재확인: 후보가 적은 재확인을 공개본(옛 탭)이 읽어도 짝이 끊기지 않는다',()=>{
  const b=bench();let coach=b.api(fresh);answer(coach,item(3));b.wait(2);
  coach=b.api(before);const row=d1(coach);assert.deepEqual([row.status,row.current],['due',true]);
  answer(coach,item(4));assert.deepEqual([d1(coach).status,d1(coach).outcome],['observed','independent-correct']);
 });

 // ⑦ 혼자 여는 홈의 생활 묶음 — 묶음 안의 Core · Strata · 공급으로(A_공개검사.mjs와 같은 길). 화면 모듈 import는 빈 함수로 바꾼 시험 사본에서.
 const EXPORT='\nexport{require_game_learning as __E_core,require_strata as __E_strata,worldMapData as __E_worldMapData,followupRows as __E_followupRows};\n';
 function stubImports(text){
  const ast=acorn.parse(text,{ecmaVersion:'latest',sourceType:'module'});let out=text;
  for(const node of ast.body.filter(n=>n.type==='ImportDeclaration'&&!n.source.value.startsWith('./')).reverse()){
   const names=node.specifiers.map(s=>s.local.name);
   out=out.slice(0,node.start)+(names.length?`var ${names.map(n=>`${n}=__E_stub`).join(',')};`:'')+out.slice(node.end);
  }
  return out===text?text:`function __E_stub(){return ''}\n${out}`;
 }
 async function loadLife(file){
  const probe=path.join(dir,`__e-${file}`);fs.writeFileSync(probe,stubImports(fs.readFileSync(path.join(dir,file),'utf8'))+EXPORT);probes.push(probe);
  const lent=!('document' in globalThis);if(lent)globalThis.document={querySelector:()=>({}),querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
  let mod;try{mod=await import(pathToFileURL(probe).href);}finally{if(lent)delete globalThis.document;}
  return {core:mod.__E_core(),strata:mod.__E_strata(),data:mod.__E_worldMapData(),rows:mod.__E_followupRows};
 }
 const newLife=await loadLife('new-life-standalone.mjs'),liveLife=await loadLife('live-life-standalone.mjs');
 // 같은 기기 기록: 후보 묶음이 읽기 앵커 + 말하기 여섯(spoken)을 적은 뒤 생활 묶음을 연다.
 function mixed(){
  const b=bench();let coach=b.api(fresh);answer(coach,item(5));
  const speak=b.api(fresh,'world-speaking');speak.__measure=fresh.worldLearning.speaking.measure;for(let type=1;type<=6;type++)doType(speak,type);
  b.wait(2);return b;
 }
 await check('공개본 생활 묶음은 말하기 사건이 섞인 기기 기록을 통째로 못 읽는다(결함 재현 — 지우지는 않는다)',()=>{
  const b=mixed(),life=b.raw(liveLife,liveLife.data),stored=b.storage.getItem('synk.atlas.learning.v1.device'),summary=life.summary();
  assert.deepEqual([summary.evidenceComplete,summary.storage?.available],[false,false]);
  assert.deepEqual(life.followups().items,[]);
  assert.equal(life.answer(life.present(item(6)),{correct:true,assessable:true}).verdict,'unassessed','새 답도 근거가 못 된다');
  life.flush?.();
  assert.equal(b.storage.getItem('synk.atlas.learning.v1.device'),stored,'기록은 그대로');
 });
 await check('고친 생활 묶음: 말하기 사건이 섞인 같은 기기 기록을 읽고(말하기 능력은 지도에 없음), 재확인도 묶음 안의 공급으로 이어지며, 후보 묶음으로 돌아와도 기록이 그대로',()=>{
  const b=mixed(),life=b.raw(newLife,newLife.data),summary=life.summary();
  assert.deepEqual([summary.evidenceComplete,summary.storage?.available],[true,true]);
  assert.ok(!summary.skills.some(s=>String(s.id).startsWith('ko.speaking.')),'생활 묶음 지도에는 말하기가 없다');
  assert.equal(summary.skills.find(s=>s.id==='ko.reading.detail').n,1,'읽기 근거는 그대로');
  const projection=life.followups(),row=d1(life);
  assert.deepEqual([projection.policy,row.status,row.current],['temper-followup-2','due',true]);
  assert.equal(newLife.rows({projection,pool:[item(6)],seen:()=>false,taskVersion:newLife.data.map_ver}).rows.find(r=>r.window==='d1').available,true,'묶음 안 공급');
  answer(life,item(6));assert.deepEqual([d1(life).status,d1(life).outcome],['observed','independent-correct']);
  const back=b.api(fresh);assert.equal(back.summary().skills.find(s=>s.id==='ko.speaking.answer').levels[1].formats.spoken.unassessed,1,'후보 묶음으로 돌아오면 말하기 기록이 그대로');
  assert.deepEqual([d1(back).status,d1(back).outcome],['observed','independent-correct']);
 });
 await check('고친 생활 묶음: 지도판 · 마디가 공개본과 같다(응답 꼴 두 줄만 바뀌었다)',()=>{
  assert.equal(newLife.data.map_ver,liveLife.data.map_ver);
  const ids=side=>side.data.nodes.map(node=>node.id);assert.deepEqual(ids(newLife),ids(liveLife));
  const a=fs.readFileSync(path.join(dir,'new-life-standalone.mjs'),'utf8'),b=fs.readFileSync(path.join(dir,'live-life-standalone.mjs'),'utf8');
  assert.equal(a.length-b.length,'"spoken",'.length+'"spoken", '.length,'바뀐 것은 응답 꼴 두 줄뿐(글자 수)');
  assert.equal(a.split('"cup-compose","action","spoken","unknown"]').length-1,1);
  assert.equal(a.split('"cup-compose", "action", "spoken", "unknown"]').length-1,1);
 });

 // ⑧ 옛 판이 같은 기기 장부를 접을 때 — 단계 README §8 남은 확인(Fable F2 · 지도를 키우는 첫 공개). 앵커는 공개본(자라기 전 지도), 1 · 7일 짝은 후보(자란 지도).
 // 접는 쪽이 직접 많이 써서 600건을 넘겨 접는다(접는 규칙은 그 판의 것). LAB try/의 재확인 쓰는 게임(rhythm · order-rush)은 아직 temper-followup-1이다.
 // 후보 · 공개본의 측정은 늘 돈다. LAB 사본은 공개본에 있을 때만 잰다(LAB 공개로 없어지면 그 칸만 빠진다).
 const tryFile=path.join(dir,'live-try-atlas-learning.js'),fold={},hasLab=fs.existsSync(tryFile),tryText=hasLab?fs.readFileSync(tryFile,'utf8'):'';
 const box={console,TextEncoder,TextDecoder,URL,crypto:globalThis.crypto,setTimeout,clearTimeout};
 if(hasLab){vm.createContext(box);vm.runInContext(tryText,box);}
 {
  function foldBy(folder){
   const b=bench();let coach=b.api(before);answer(coach,item(100));b.wait(2);
   coach=b.api(fresh);answer(coach,item(101));b.wait(6);answer(coach,item(102));coach.flush?.();b.wait(1);
   const writer=b.open(folder==='LAB try/'?box.SynkLearning.createGame({gameId:'korean-rhythm',storage:b.storage,clock:b.clock,followups:true}):(folder==='공개본'?before:fresh).worldLearning.engine.createGame({gameId:'world-practice',storage:b.storage,clock:b.clock,followups:true}));
   for(let n=0;n<170;n++){const p=writer.present({id:`f${n}`,itemKey:`qa.fill.${n}`,familyKey:`qa.fill.${n}`,skillId:'ko.reading.vocabulary',modality:'reading',difficulty:1,responseFormat:'single-choice'});writer.answer(p,{correct:true,assessable:true});if(n%10===9)b.wait(11/1440);}
   writer.flush?.();
   const stored=JSON.parse(b.storage.getItem('synk.atlas.learning.v1.device')),after=b.api(fresh),rows=after.followups().items.filter(r=>r.gameId==='world-practice'&&r.measure?.skillId==='ko.reading.detail');
   return {folded:stored.ledger?.folded||0,preserved:stored.ledger?.followupsPreserved??null,d1:rows.find(r=>r.window==='d1')?.status,d7:rows.find(r=>r.window==='d7')?.status};
  }
  await check('옛 판 장부 접기(측정): 후보 · 공개본이 접으면 앵커 · 1 · 7일 짝이 모두 남고, LAB try/(followup-1)가 접으면 앵커 · 1일 짝은 남고 7일 짝만 다시 확인으로 돌아간다',()=>{
   for(const folder of ['후보','공개본',...(hasLab?['LAB try/']:[])])fold[folder]=foldBy(folder);
   assert.ok(fold['후보'].folded>0&&fold['공개본'].folded>0&&(!hasLab||fold['LAB try/'].folded>0),'접기가 실제로 일어났다');
   assert.deepEqual([fold['후보'].preserved,fold['후보'].d1,fold['후보'].d7],[true,'observed','observed']);
   assert.deepEqual([fold['공개본'].preserved,fold['공개본'].d1,fold['공개본'].d7],[true,'observed','observed']);
   if(hasLab){
    assert.deepEqual([fold['LAB try/'].preserved,fold['LAB try/'].d1],[true,'observed']);
    // LAB 묶음이 옛 판인 동안의 알려진 차이(7일 짝만 다시 확인으로 돌아간다) — LAB 공개로 판이 오르면 후보 · 공개본과 같아져야 한다(README §11).
    assert.equal(fold['LAB try/'].d7,/temper-followup-1/.test(tryText)?'due':'observed');
   }
  });
 }
 console.log(checks.map(name=>`ok · ${name}`).join('\n'));
 if(Object.keys(fold).length)console.log(`옛 판 장부 접기 측정: ${JSON.stringify(fold)}`);
 console.log(`E 공개 검사 ${checks.length}개 통과`);
}finally{
 for(const probe of probes)fs.rmSync(probe,{force:true});
}
process.exit(0);
