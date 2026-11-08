// Atlas × WORLD 2단계 E(2026-11-08): 말하기 연습의 Trail 「채점 안 함」 기록 · 홈 후보의 문항 열쇠 · 계정을 따라가는 이번 주 셈
// (docs/_ops/qa/atlas-world-engine-20261108/E_말하기.md §4-3~4-5). 실제 WORLD 코치(world-learning-map.mjs)와 실제 말하기 화면(world-speaking-practice.mjs)을
// 가짜 문서 · 가짜 마이크로 눌러 본다 — 화면 글 · 판정 · 기기 기록 꼴은 바꾸지 않았고, 기록 자리만 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createSpeakingPractice,loadSpeakingBank,speakingCandidates,speakingWeek,speakingTrailAttempts,SPEAKING_CANDIDATES,SPEAKING_SKILLS,writeSpeakingExam} from '../world-speaking-practice.mjs';
import {worldLearning,worldMap} from '../world-learning-map.mjs';
import {followupRows} from '../world-learning-followups.mjs';
import {buildPositionMap} from '../world-position.mjs';
const require=createRequire(import.meta.url);
const strata=require('../../../strata/index.js');
const worldLife=require('../../../strata/world-life.js');
const {worldMapData}=require('../../../strata/world-map.js');
const BANK=JSON.parse(fs.readFileSync(new URL('../world-speaking-items.json',import.meta.url),'utf8'));
const DAY=86400000;
const flush=(ms=0)=>new Promise(resolve=>setTimeout(resolve,ms));
// 은행은 모듈 하나에 한 번 읽힌다(loadSpeakingBank 기억) — 모든 시험이 같은 은행을 쓴다.
const bankReady=loadSpeakingBank(async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(fileURLToPath(url),'utf8'))}));
globalThis.cancelAnimationFrame??=()=>{};
// 마이크 알림(Reed — world-sound.mjs)은 BroadcastChannel이 있으면 연다 — Node의 진짜 채널은 프로세스를 붙잡으므로 가짜로(다른 WORLD 시험과 같다).
globalThis.BroadcastChannel=class{postMessage(){}close(){}addEventListener(){}removeEventListener(){}};
globalThis.FileReader??=class{readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:audio/webm;base64,${Buffer.from(buffer).toString('base64')}`;this.onload?.();},error=>{this.error=error;this.onerror?.();});}};

const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
// 가짜 문서: 말하기 시트의 뿌리 하나 · 누름은 붙은 click 처리기를 직접 부른다.
function sheet(){
 const node=()=>({textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},style:{setProperty(){}},focus(){},setAttribute(){},removeAttribute(){},
  querySelector:()=>node(),querySelectorAll:()=>[],contains:()=>true,closest:()=>null,previousElementSibling:null,tagName:'DIV'});
 let handler=null,html='';const stage=node();
 const root={...node(),addEventListener:(type,fn)=>{if(type==='click')handler=fn;},removeEventListener(){},closest:()=>null,get firstElementChild(){return stage;}};
 Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{html=value;}});
 stage.parentElement=root;
 const doc={querySelector:selector=>selector==='#panel-content [data-wsp-stage]'?stage:null,activeElement:null,body:{}};
 const press=(attr,dataset={})=>{const button={...node(),dataset,hasAttribute:name=>name===attr,closest:()=>button};handler?.({target:button});};
 return {doc,press,html:()=>html,dispose:[]};
}
class FakeRecorder{constructor(){this.state='inactive';this.mimeType='audio/webm';}static isTypeSupported(){return true;}start(){this.state='recording';}
 stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob(['소리'])});queueMicrotask(()=>this.onstop?.());}}
class FakeAudio{constructor(src){this.src=src;this.on={};this.volume=1;}addEventListener(type,fn){this.on[type]=fn;}play(){setTimeout(()=>this.on.ended?.(),0);return Promise.resolve();}pause(){}}
const FEEDBACK={status:'ok',covered:[0],heard:{transcript:'주말에 공원에 가요.'},elements:{task:{good:'과제를 했어요.'},language:{good:'잘 말했어요.'},delivery:{good:'잘 들려요.'}}};

// 말하기 화면 하나: 실제 WORLD 코치(기기 기록) · 측정 조회 · 가짜 문서 · 가짜 마이크. measure:false면 옛 계정 묶음(조회 없음).
function practiceBench({measure=true,feedback=null,owner='guest',coachOn=()=>true}={}){
 let tick=Date.parse('2026-11-09T03:00:00Z');const clock=()=>new Date(tick+=1000).toISOString(),now=()=>tick;
 const storage=memory(),coachStorage=memory(),page=sheet();
 storage.setItem(`synk.world.speaking.v1:${owner}`,JSON.stringify({consent:{at:'2026-11-01T00:00:00.000Z',version:1},log:[]}));
 const coach=worldLearning.engine.createGame({gameId:'world-speaking',storage:coachStorage,clock});
 const win={navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},MediaRecorder:FakeRecorder,Audio:FakeAudio};
 const practice=createSpeakingPractice({show(){},home:{attachPanelResource:resource=>page.dispose.push(resource),toast(){}},getOwner:()=>owner,storage,feedback,
  coach:()=>coachOn()?coach:null,measure:measure?worldLearning.speaking.measure:null,now,doc:page.doc,win,fetcher:async()=>{throw Error('bank is preloaded');}});
 const events=type=>coach.events().filter(e=>!type||e.type===type);
 const log=()=>JSON.parse(storage.getItem(`synk.world.speaking.v1:${owner}`)).log;
 return {practice,page,coach,coachStorage,storage,events,log,clock,advance:ms=>{tick+=ms;},now};
}
// 시험 형식 한 판: 준비 시작 → 바로 말하기 → 다 말했어요 → 다시 듣기 단계.
async function speak(b){b.page.press('data-wsp-start');await flush();b.page.press('data-wsp-skip');b.page.press('data-wsp-stop');await flush();await flush();}

test('문항을 열기만 하면 남지 않고, 스스로 확인한 시도는 「채점 안 함」 하나로 남는다 — 측정은 Strata 조회(spoken · 난도 1)',async()=>{
 await bankReady;const b=practiceBench();
 await b.practice.open('speaking:1');
 assert.deepEqual(b.events(),[],'열기만 하면 코치 사건이 없다');
 await speak(b);b.page.press('data-wsp-self-save');
 const [shown]=b.events('practice.presented'),attempts=b.events('practice.attempted');
 assert.equal(shown.itemKey,'speaking.s1-weekend');assert.equal(shown.taskId,'speaking-s1-weekend');
 assert.deepEqual({...shown.measure},{skillId:SPEAKING_SKILLS[1],modality:'speaking',difficulty:1,familyKey:'speaking.s1-weekend',audioRequired:false,confounded:false,responseFormat:'spoken'});
 assert.equal(shown.taskVersion,worldMap.map_ver);assert.ok(shown.taskVersion.length<=120);
 assert.deepEqual(attempts.map(a=>[a.verdict,a.attemptNo]),[['unassessed',1]]);
 assert.equal(b.events('decision.made')[0].experienceId,'world-speaking');
 assert.deepEqual(b.log().map(e=>[e.mode,e.itemId,e.source,e.counted]),[['exam','s1-weekend','self',true]],'기기 기록 꼴은 그대로');
 assert.equal(b.log()[0].trail,attempts[0].id,'이 기기 기록이 그 Trail 시도의 사건 id를 갖는다(이번 주 셈이 사건 id로 잇는다)');
 // 같은 판의 다시 하기 → 같은 제시의 둘째 시도, 다시 열어 또 하면 새 판.
 b.page.press('data-wsp-retry');await speak(b);b.page.press('data-wsp-self-save');
 assert.equal(b.events('practice.presented').length,1);assert.deepEqual(b.events('practice.attempted').map(a=>a.attemptNo),[1,2]);
 b.page.press('data-wsp-back');await b.practice.open('speaking:1');
 assert.equal(b.events('practice.presented').length,1,'다시 열기만 하면 그대로');
 await speak(b);b.page.press('data-wsp-self-save');
 assert.equal(b.events('practice.presented').length,2,'다시 열어 한 것은 새 판');assert.deepEqual(b.events('practice.attempted').map(a=>a.attemptNo),[1,2,1]);
});

const helpKinds=b=>b.events('practice.helped').map(h=>JSON.stringify(h).match(/world-speaking\.(\w+)/)?.[1]);
test('예시 답을 본 뒤의 시도는 answer 도움, 자동 피드백 시도는 그 녹음을 떠날 때 남고(사건 id로 이 기기 기록과 이음) 다음 시도 직전에 hint 도움',async()=>{
 await bankReady;
 const status={enabled:true,itemsVersion:BANK.contentHash,dailyLimit:4,remaining:3,turnEnabled:false};
 const b=practiceBench({feedback:{status:async()=>status,request:async()=>({status:'ok',remaining:2,feedback:FEEDBACK})}});
 await b.practice.open('speaking:1');await flush();
 b.page.press('data-wsp-model');await speak(b);
 b.page.press('data-wsp-send');await flush(5);await flush();
 const device=b.log().at(-1);assert.deepEqual([device.source,device.counted],['ai-reference',true]);
 assert.deepEqual(b.events(),[],'「제가 한 말과 달라요」를 누를 틈 — 아직 Trail에 없다');
 b.page.press('data-wsp-retry');// 이 녹음을 떠남
 const [first]=b.events('practice.attempted');
 assert.ok(first,'떠날 때 시도 하나');assert.equal(b.log().at(-1).trail,first.id,'이 기기 기록에 그 사건 id');
 assert.deepEqual(helpKinds(b),['answer'],'예시 답 = answer 도움(1판의 hint가 아니다) · 자동 피드백 자체는 아직 도움이 아니다');
 await speak(b);b.page.press('data-wsp-self-save');
 assert.deepEqual(helpKinds(b),['answer','hint'],'자동 피드백을 본 뒤의 다음 시도 직전에 hint');
 assert.deepEqual(b.events('practice.attempted').map(a=>a.attemptNo),[1,2]);
 assert.equal(b.log().at(-1).trail,b.events('practice.attempted')[1].id);
 // 새 판에서 잘못 들은 피드백: 기기 기록은 세지 않음, Trail에는 판도 시도도 없다(이력 · 셈이 같은 「한 것」을 센다).
 const c=practiceBench({feedback:{status:async()=>status,request:async()=>({status:'ok',remaining:2,feedback:FEEDBACK})}});
 await c.practice.open('speaking:2');await flush();await speak(c);c.page.press('data-wsp-send');await flush(5);await flush();
 c.page.press('data-wsp-misheard');
 assert.deepEqual([c.log().at(-1).counted,c.log().at(-1).status,c.log().at(-1).trail],[false,'misheard',undefined]);
 c.page.press('data-wsp-self-save');
 assert.deepEqual(helpKinds(c),[],'잘못 들은 피드백은 도움이 아니다');
 assert.equal(speakingTrailAttempts(c.coach.events()).length,1,'스스로 확인한 것만 남는다');
 c.page.press('data-wsp-back');
 assert.equal(c.events('practice.presented').length,1,'떠나도 잘못 들은 시도는 남지 않는다(판은 스스로 확인 하나)');
 const d=practiceBench({feedback:{status:async()=>status,request:async()=>({status:'ok',remaining:2,feedback:FEEDBACK})}});
 await d.practice.open('speaking:3');await flush();await speak(d);d.page.press('data-wsp-send');await flush(5);await flush();
 d.page.press('data-wsp-misheard');d.page.press('data-wsp-back');
 assert.deepEqual(d.events(),[],'잘못 들음만 하고 떠나면 Trail에 아무것도 없다');
});

test('역할극(따라 말하기 길) 끝에 시도 하나 — 글로 보기 · 다시 듣기 · 예시 문장 도움, 열기만 하면 남지 않는다',async()=>{
 await bankReady;const b=practiceBench();
 await b.practice.open('speaking:rp-cafe-tea');
 assert.deepEqual(b.events(),[]);
 b.page.press('data-wsp-rp-start');await flush(5);
 b.page.press('data-wsp-rp-text');b.page.press('data-wsp-rp-listen');await flush(5);
 for(let turn=0;turn<3;turn++){
  b.page.press('data-wsp-rp-speak');await flush();b.page.press('data-wsp-rp-stop');await flush();await flush();
  b.page.press('data-wsp-rp-next');await flush(5);
 }
 const [shown]=b.events('practice.presented'),attempts=b.events('practice.attempted');
 assert.equal(shown?.itemKey,'speaking.rp-cafe-tea');assert.equal(shown.measure.skillId,'ko.speaking.roleplay');
 assert.deepEqual(attempts.map(a=>a.verdict),['unassessed']);
 assert.deepEqual(helpKinds(b).sort(),['answer','replay','text']);
 const done=b.log().find(e=>e.mode==='roleplay'&&e.done&&e.source==='self');
 assert.ok(done,'기기 기록은 그대로');assert.equal(done.trail,attempts[0].id);
});

test('조회가 없거나(옛 계정 묶음) 코치가 없으면 기기 기록만 남고 화면은 그대로 간다',async()=>{
 await bankReady;
 for(const options of [{measure:false},{coachOn:()=>false}]){
  const b=practiceBench(options);await b.practice.open('speaking:3');await speak(b);b.page.press('data-wsp-self-save');
  assert.deepEqual(b.events(),[],JSON.stringify(options));
  assert.deepEqual(b.log().map(e=>[e.itemId,e.counted]),[['s3-birthday',true]]);
 }
});

test('판이 코치에서 끝난 뒤(다른 탭이 기기 기록을 새로 시작) 두 번째 시도도 새 판으로 남는다',async()=>{
 await bankReady;const b=practiceBench();
 await b.practice.open('speaking:4');await speak(b);b.page.press('data-wsp-self-save');
 assert.equal(b.events('practice.attempted').length,1);
 const other=worldLearning.engine.createGame({gameId:'world-home',storage:b.coachStorage,clock:b.clock});other.reset();
 b.page.press('data-wsp-retry');await speak(b);b.page.press('data-wsp-self-save');
 const attempts=b.events('practice.attempted');
 assert.equal(attempts.length,1,'새 기록에는 둘째 시도가 남는다(앞 판은 끝났다)');
 assert.equal(b.events('practice.presented').length,1,'새 판으로 다시 보였다');
 b.page.press('data-wsp-retry');await speak(b);b.page.press('data-wsp-self-save');
 assert.deepEqual(b.events('practice.attempted').map(a=>a.attemptNo),[1,2],'그 뒤로는 그 판의 다음 시도');
});

test('이번 주 셈: 기기 기록 ∪ Trail을 사건 id로 잇는다 — 다른 기기의 시도는 세고, 같은 시도는 한 번, 역할극은 유형으로 안 센다',async()=>{
 await bankReady;
 const {weekActivity}=await import('../world-exam-plan.mjs');
 const week={start:Date.parse('2026-11-08T15:00:00Z'),end:Date.parse('2026-11-15T15:00:00Z')},next={start:week.end,end:week.end+7*DAY};
 let t=week.start+DAY;const mem=memory(),clock=()=>new Date(t+=1000).toISOString();
 const coach=worldLearning.engine.createGame({gameId:'world-speaking',storage:mem,clock});
 const tryItem=(id,input)=>{const p=coach.present({id:`speaking-${id}`,itemKey:`speaking.${id}`,familyKey:`speaking.${id}`,...worldLearning.speaking.measure(input)});return coach.answer(p,{correct:null,assessable:false});};
 tryItem('s3-birthday',{type:3});tryItem('rp-cafe-tea',{roleplay:'rp-cafe-tea'});
 const storage=memory();
 const other=speakingWeek({storage,owner:'acc',week,events:coach.events()});
 assert.deepEqual(other.tried,[3],'다른 기기의 Trail 시도: 3번 해 봄, 역할극은 유형이 아니다');
 assert.equal(other.times.length,2,'시각은 둘 다(이 기기 기록이 역할극도 세는 것과 같다)');
 assert.equal(weekActivity({events:coach.events(),week,extra:[{area:'speaking',times:other.times}]}).speaking,1,'다른 기기 시도만 있어도 이번 주 말하기 한 번');
 assert.equal(weekActivity({events:coach.events(),week,extra:[]}).speaking,0,'Trail 말하기 시도는 「처음 낸 답」 칸에 들지 않는다(두 번 세지 않는다)');
 assert.deepEqual(speakingWeek({storage,owner:'acc',week}),{times:[],tried:[]},'사건이 없으면(옛 앱 셸) 이 기기만 — 지금과 같다');
 // 주 경계(그 주 끝 30초 전): 이 기기에서 5번(기기 기록이 그 Trail 사건 id를 가짐), 1분 뒤 다른 기기에서 같은 5번(다른 시도, 다음 주).
 t=week.end-30000;const mine=tryItem('s5-bike',{type:5});t=week.end+30000;const theirs=tryItem('s5-bike',{type:5});
 storage.setItem('synk.world.speaking.v1:acc',JSON.stringify({consent:null,log:[{at:new Date(week.end-30000).toISOString(),mode:'exam',type:5,itemId:'s5-bike',source:'self',counted:true,trail:mine.eventId}]}));
 const thisWeek=speakingWeek({storage,owner:'acc',week,events:coach.events()}),nextWeek=speakingWeek({storage,owner:'acc',week:next,events:coach.events()});
 const at=id=>coach.events().find(e=>e.id===id).at;
 assert.ok(thisWeek.times.includes(at(mine.eventId)),'같은 시도(사건 id로 이음)는 Trail 시각으로 센다 — 기기마다 같은 시각');
 assert.ok(!thisWeek.times.includes(new Date(week.end-30000).toISOString()),'이 기기 시각으로 한 번 더 세지 않는다');
 assert.ok(thisWeek.times.includes(at(theirs.eventId)),'다른 기기의 다른 시도는 남는다(그 주는 계획이 거른다)');
 assert.equal(weekActivity({events:[],week,extra:[{area:'speaking',times:thisWeek.times}]}).speaking,2,'이 주의 연습한 자리 둘: 첫날(3번 · 역할극) · 마지막 날(5번)');
 assert.deepEqual(thisWeek.tried,[3,5]);
 assert.deepEqual(nextWeek.tried,[5],'다른 기기의 다른 시도는 지우지 않는다(설계 검토 GPT -b GA1)');
 assert.equal(weekActivity({events:[],week:next,extra:[{area:'speaking',times:nextWeek.times}]}).speaking,1);
 assert.ok(theirs.eventId!==mine.eventId);
 // 주 경계에 걸린 자동 피드백 시도: 기기 기록은 받은 때(그 주 끝 10초 전), Trail은 떠난 때(다음 주 5초 뒤) — 이은 기기도 안 이은 기기도 같은 주로 센다(끝 판 검수).
 const mem2=memory();let t2=week.end+5000;const clock2=()=>new Date(t2+=1000).toISOString(),coach2=worldLearning.engine.createGame({gameId:'world-speaking',storage:mem2,clock:clock2});
 const p2=coach2.present({id:'speaking-s6-phone',itemKey:'speaking.s6-phone',familyKey:'speaking.s6-phone',...worldLearning.speaking.measure({type:6})}),crossing=coach2.answer(p2,{correct:null,assessable:false});
 const here=memory();here.setItem('synk.world.speaking.v1:acc',JSON.stringify({consent:null,log:[{at:new Date(week.end-10000).toISOString(),mode:'exam',type:6,itemId:'s6-phone',source:'ai-reference',counted:true,trail:crossing.eventId}]}));
 const look=(box,w)=>speakingWeek({storage:box,owner:'acc',week:w,events:coach2.events()}).tried;
 assert.deepEqual([look(here,week),look(here,next)],[[],[6]],'이 기기: 다음 주의 시도');
 assert.deepEqual([look(memory(),week),look(memory(),next)],[[],[6]],'다른 기기: 같은 주');
 assert.deepEqual(speakingWeek({storage:here,owner:'acc',week}).tried,[6],'사건이 없으면(옛 앱 셸) 이 기기 시각 그대로');
 // 뺀 시도(record.excluded): 이 기기 기록에 이어져 있어도 어느 쪽에서도 세지 않는다.
 coach2.exclude(crossing.eventId);
 assert.deepEqual(speakingWeek({storage:here,owner:'acc',week:next,events:coach2.events()}),{times:[],tried:[]},'이 기기');
 assert.deepEqual(speakingWeek({storage:memory(),owner:'acc',week:next,events:coach2.events()}),{times:[],tried:[]},'다른 기기');
});

test('앱 셸의 말하기 코치 함수: 통로가 바뀌었거나 코치가 끝났으면 새로 받고, 손님 코치는 재확인을 지키며 접는다(게임을 연 뒤의 실제 동작은 E_브라우저확인.mjs ②-1이 Edge에서 잰다)',()=>{
 const shell=fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8');
 const open=shell.slice(shell.indexOf('function openSpeaking('),shell.indexOf('// 생활 진도 통로가 저장 충돌'));
 const from=open.indexOf('coach:()=>{')+'coach:'.length,to=open.indexOf('return coach;}})',from)+'return coach;}'.length;
 const make=new Function('window','worldLearning','writingOwnerId','owner','localStorage',`let coach=null,coachHost=null;return ${open.slice(from,to)};`);
 const fake=(label,options)=>{const c={label,options,dead:false,gone:false,events(){if(c.dead)throw Error('RUN_ENDED');return [];},disconnect(){c.gone=true;}};return c;};
 const learning={engine:{createGame:options=>fake('device',options)},createLearningSync(){}},host=label=>({createGame:options=>fake(label,options)}),win={};
 const coachOf=make(win,learning,()=>'acc','acc',{});
 assert.equal(coachOf(),null,'계정인데 통로가 아직 없으면 코치 없음(기기 기록만)');
 win.SYNKLearningHost=host('a');const a=coachOf();
 assert.equal(a.label,'a');assert.equal(coachOf(),a,'같은 통로 · 산 코치는 그대로');
 a.dead=true;const a2=coachOf();
 assert.notEqual(a2,a,'같은 통로라도 코치가 끝났으면 새로');assert.equal(a.gone,true,'끝난 코치는 놓는다');assert.equal(a2.label,'a');
 win.SYNKLearningHost=host('b');const b=coachOf();
 assert.equal(b.label,'b','통로가 바뀌면 새로');assert.equal(a2.gone,true);
 win.SYNKLearningHost={createGame(){throw Error('MEMORY_SESSION_ENDED');}};
 assert.throws(()=>coachOf(),/MEMORY_SESSION_ENDED/,'동의를 거둬 통로가 막히면 코치를 못 받는다(말하기 화면이 삼켜 기기 기록만 남는다)');
 assert.equal(make(win,learning,()=>'other','acc',{})(),null,'다른 계정이면 코치 없음');
 const device=make({},learning,()=>'guest','guest',{marker:true})();
 assert.deepEqual([device.label,device.options.gameId,device.options.storage.marker,device.options.followups],['device','world-speaking',true,true],'손님: 기기 코치 · 재확인을 지키며 접는다');
});

test('손님 코치의 옵션이 지키는 것: 말하기 코치가 기기 장부를 접어도 재확인이 남는다 — 옵션 없이 접으면 그 기기의 재확인이 통째로 사라진다(E 전에는 이 코치가 쓴 적이 없다)',()=>{
 const run=followups=>{
  let t=Date.parse('2026-11-09T03:00:00Z'),last=null;const storage=memory(),clock=()=>new Date(t+=1000).toISOString(),hold=g=>{last?.flush?.();return last=g;};
  const practice=()=>hold(worldLearning.engine.createGame({gameId:'world-practice',storage,clock,followups:true}));
  const reading=practice(),p=reading.present({id:'e-100',itemKey:'e-100.v1',familyKey:'e-100',skillId:'ko.reading.detail',difficulty:1,responseFormat:'single-choice',modality:'reading',audioRequired:false});
  reading.answer(p,{correct:true,assessable:true});t+=2*DAY;
  const writer=hold(worldLearning.engine.createGame({gameId:'world-speaking',storage,clock,...(followups?{followups:true}:{})}));
  for(let n=0;n<170;n++){const q=writer.present({id:`f${n}`,itemKey:`speaking.fill-${n}`,familyKey:`speaking.fill-${n}`,...worldLearning.speaking.measure({type:1})});writer.answer(q,{correct:null,assessable:false});if(n%10===9)t+=11*60000;}
  writer.flush?.();
  const stored=JSON.parse(storage.getItem('synk.atlas.learning.v1.device')),read=practice().followups();
  return {folded:stored.ledger?.folded||0,preserved:stored.ledger?.followupsPreserved,rows:read.items.filter(r=>r.gameId==='world-practice'&&r.measure?.skillId==='ko.reading.detail').length,reason:read.coverage?.reason||null};
 };
 const kept=run(true),lost=run(false);
 assert.ok(kept.folded>0&&lost.folded>0,'접기가 실제로 일어났다');
 assert.deepEqual([kept.preserved,kept.rows>0],[true,true],'옵션을 주면 앵커가 남는다');
 assert.deepEqual([lost.preserved,lost.rows,lost.reason],[false,0,'older-source-unavailable'],'옵션 없이 접으면 사라진다(대조)');
});

test('떠날 때 기록은 다른 탭이 그사이 저장한 기기 기록 · 동의를 덮지 않는다 · 자동 피드백 표시는 그 판까지다(끝 판 검수)',async()=>{
 await bankReady;
 const status={enabled:true,itemsVersion:BANK.contentHash,dailyLimit:4,remaining:3,turnEnabled:false};
 const b=practiceBench({feedback:{status:async()=>status,request:async()=>({status:'ok',remaining:2,feedback:FEEDBACK})}});
 await b.practice.open('speaking:1');await flush();await speak(b);b.page.press('data-wsp-send');await flush(5);await flush();
 // 다른 탭: 같은 계정의 기기 기록에 다른 시도를 더하고 동의를 거둔다.
 const key='synk.world.speaking.v1:guest',other=JSON.parse(b.storage.getItem(key));
 other.log.push({at:'2026-11-09T03:00:30.000Z',mode:'exam',type:2,itemId:'s2-cafe',source:'self',status:'self',counted:true});other.consent=null;
 b.storage.setItem(key,JSON.stringify(other));
 b.page.press('data-wsp-back');// 이 탭이 그 녹음을 떠남
 const stored=JSON.parse(b.storage.getItem(key)),[attempt]=b.events('practice.attempted');
 assert.deepEqual(stored.log.map(e=>e.itemId),['s1-weekend','s2-cafe'],'다른 탭의 시도가 남는다');
 assert.equal(stored.consent,null,'다른 탭이 거둔 동의를 되살리지 않는다');
 assert.equal(stored.log[0].trail,attempt.id,'이 시도의 칸만 고친다');
 assert.equal(stored.log[1].trail,undefined);
 // 나갔다 다시 연 새 판: 앞 판의 자동 피드백은 이 판의 도움이 아니다(그 판 안의 다시 하기만 hint).
 await b.practice.open('speaking:1');await flush();await speak(b);b.page.press('data-wsp-self-save');
 assert.equal(b.events('practice.presented').length,2,'새 판');
 assert.deepEqual(helpKinds(b),[],'새 판의 첫 시도에는 hint 도움이 없다');
});

test('홈 후보: 유형이 여는 문항의 Core target — 방금 한 유형은 뒤로, 열쇠 없는 지금 판은 같은 유형을 계속 앞세운다',async()=>{
 await bankReady;
 const withKeys=speakingCandidates({measure:worldLearning.speaking.measure});
 assert.deepEqual(withKeys.map(c=>c.route),SPEAKING_CANDIDATES.filter(c=>c.exam==='speaking').map(c=>c.route));
 for(const c of withKeys){
  const type=Number(c.route.split(':')[1]),it=BANK.items.find(i=>i.type===type);
  assert.deepEqual(c.coreTargets.map(t=>({...t,skillIds:[...t.skillIds],conceptIds:[...t.conceptIds]})),[{id:`speaking-${it.id}`,skillIds:[SPEAKING_SKILLS[type]],difficulty:1,modality:'speaking',responseFormat:'spoken',itemKey:`speaking.${it.id}`,familyKey:`speaking.${it.id}`,audioRequired:false,conceptIds:[]}]);
  assert.ok(!('familyKeys' in c.coreTargets[0]),'다 씀(spent)으로 밀지 않는다');
 }
 assert.ok(speakingCandidates({}).every(c=>!c.coreTargets),'조회가 없으면 지금 꼴 그대로');
 // 같은 기기 장부: 홈 코치가 말하기 제시를 이력으로 읽는다.
 let t=Date.parse('2026-11-09T03:00:00Z');const mem=memory(),clock=()=>new Date(t+=1000).toISOString();
 const speakCoach=worldLearning.engine.createGame({gameId:'world-speaking',storage:mem,clock}),home=worldLearning.engine.createGame({gameId:'world-home',storage:mem,clock});
 const rows=keys=>keys.map(c=>({id:c.id,minutes:c.minutes,targets:(c.coreTargets||[]).map(x=>({...x,skillIds:[...x.skillIds],conceptIds:[]})),goals:['exam','prepare','speaking'],audioRequired:true}));
 const order=keys=>home.recommendActivities(rows(keys),{settings:{goals:['exam']},at:clock()}).assessments.map(a=>Number(a.id.split('-').pop()));
 const doType=type=>{const it=BANK.items.find(i=>i.type===type),p=speakCoach.present({id:`speaking-${it.id}`,itemKey:`speaking.${it.id}`,familyKey:`speaking.${it.id}`,...worldLearning.speaking.measure({type})});speakCoach.answer(p,{correct:null,assessable:false});};
 const plain=SPEAKING_CANDIDATES.filter(c=>c.exam==='speaking');
 assert.deepEqual(order(withKeys),[1,2,3,4,5,6]);
 doType(1);
 assert.notEqual(order(withKeys)[0],1,'열쇠가 있으면 방금 한 1번이 맨 앞이 아니다');
 assert.equal(order(plain)[0],1,'열쇠 없는 지금 판은 방금 한 1번을 또 맨 앞에 둔다(같은 유형 연달아)');
 // 역할극 시도는 2번 유형의 이력이 아니다(문항 열쇠가 다르다) — 2번이 3번보다 앞 그대로.
 const rp=speakCoach.present({id:'speaking-rp-cafe-tea',itemKey:'speaking.rp-cafe-tea',familyKey:'speaking.rp-cafe-tea',...worldLearning.speaking.measure({roleplay:'rp-cafe-tea'})});speakCoach.answer(rp,{correct:null,assessable:false});
 const after=order(withKeys);assert.ok(after.indexOf(2)<after.indexOf(3),after.join(','));
 // 여섯을 매주 하나씩(홈이 고른 것): 여섯 주에 여섯 유형이 한 번씩.
 const picks=[];for(let w=0;w<6;w++){const first=order(withKeys)[0];picks.push(first);doType(first);t+=7*DAY;}
 assert.deepEqual([...picks].sort(),[1,2,3,4,5,6],picks.join('→'));
});

test('말하기를 고른 학생의 홈: 후보에 열쇠가 실리고, 다른 기기의 말하기도 이번 주 한 번으로 센다(옛 셸 · 조회 없음이면 지금 판 그대로)',async()=>{
 await bankReady;
 const [{createWorldEducation},{createWorldLearningPlan},{worldPosition},{createLifeProgress},{PACKS,LESSONS}]=await Promise.all(['../world-learning-ui.mjs','../world-learning-plan.mjs','../world-position-kit.mjs','../life-progress.mjs','../life-content.mjs'].map(file=>import(file)));
 function fixture({keys=true,events=true}={}){
  const storage=memory(),life=createLifeProgress({storage,owner:'guest'});life.summary(PACKS,LESSONS);
  life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{reasons:['exam'],primaryReason:'exam',examType:'topik1',targetGrade:2,examDate:'2027-04',weeklyMinutes:120},today:{audio:'available'}});
  writeSpeakingExam({storage,owner:'guest',on:true});
  const speakingPractice={available:()=>true,candidates:()=>keys?speakingCandidates({measure:worldLearning.speaking.measure}):SPEAKING_CANDIDATES.filter(row=>row.exam==='speaking'),chosen:()=>true,choose:()=>true,
   week:(owner,week,list)=>speakingWeek({storage,owner,week,...(events?{events:list}:{})}),open(){}};
  const education=createWorldEducation({home:{updateStudy(){},toast(){},showPanel(){},closePanel(){}},getProgress:()=>life,engine:worldLearning,createPlan:createWorldLearningPlan,
   launchGame(){},startLesson(){},startReview(){},position:worldPosition,speakingPractice,target:{localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector:()=>null}}});
  return {storage,education};
 }
 const f=fixture();
 const offered=f.education.refresh().candidates.filter(c=>c.route==='speaking');
 assert.equal(offered.length,6);
 assert.ok(offered.every(c=>c.targets.length===1&&c.targets[0].itemKey.startsWith('speaking.s')&&c.targets[0].modality==='speaking'),'홈 후보에 문항 열쇠가 실린다');
 // 다른 기기에서 한 말하기(계정 기록이 이 기기 장부로 들어온 것과 같다): 홈 코치 장부에 Trail 시도 하나.
 const coach=worldLearning.engine.createGame({gameId:'world-speaking',storage:f.storage});
 const it=BANK.items.find(i=>i.type===2),p=coach.present({id:`speaking-${it.id}`,itemKey:`speaking.${it.id}`,familyKey:`speaking.${it.id}`,...worldLearning.speaking.measure({type:2})});coach.answer(p,{correct:null,assessable:false});
 const plan=f.education.refresh();
 assert.equal(plan.examPlan.areas.find(row=>row.area==='speaking').done,1,'다른 기기의 말하기도 이번 주 한 번');
 assert.deepEqual(plan.examPlan.speaking,{untried:5,total:6});
 assert.ok(!plan.candidates.some(c=>c.route==='speaking'&&c.routeId==='speaking:2'),'해 본 유형은 이번 주 후보에서 빠진다');
 // 옛 앱 셸(사건 없음) · 조회 없음: 지금 판 그대로(기기 기록만, targets 없음).
 const old=fixture({keys:false,events:false});
 const oldPlan=old.education.refresh();
 assert.ok(oldPlan.candidates.filter(c=>c.route==='speaking').every(c=>c.targets.length===0));
 assert.equal(oldPlan.examPlan.areas.find(row=>row.area==='speaking').done,0);
});

test('「내 위치」 판 · 영역 셈은 말하기 시도가 쌓여도 그대로다(채점 안 함은 능력 칸이 아니다)',async()=>{
 await bankReady;
 let t=Date.parse('2026-11-09T03:00:00Z');const mem=memory(),clock=()=>new Date(t+=1000).toISOString();
 const reading=worldLearning.engine.createGame({gameId:'world-practice',storage:mem,clock});
 for(const n of [1,2,3]){const p=reading.present({id:`r${n}`,itemKey:`qa.reading.${n}`,familyKey:`qa.reading.${n}`,skillId:'ko.reading.detail',modality:'reading',difficulty:1,responseFormat:'single-choice'});reading.answer(p,{correct:n!==2,assessable:true});}
 const home=worldLearning.engine.createGame({gameId:'world-home',storage:mem,clock});
 const before=buildPositionMap({summary:home.summary(),events:home.events(),exam:'topik1'});
 const speak=worldLearning.engine.createGame({gameId:'world-speaking',storage:mem,clock});
 for(const type of [1,2,3,4,5,6]){const it=BANK.items.find(i=>i.type===type),p=speak.present({id:`speaking-${it.id}`,itemKey:`speaking.${it.id}`,familyKey:`speaking.${it.id}`,...worldLearning.speaking.measure({type})});for(const n of [1,2])speak.answer(p,{correct:null,assessable:false,attemptNo:n});}
 const summary=home.summary(),after=buildPositionMap({summary,events:home.events(),exam:'topik1'});
 const strip=map=>JSON.stringify({...map,asOf:null});
 assert.equal(strip(after),strip(before));
 assert.ok(!after.skills.some(s=>s.domain==='speaking'));
 assert.ok(summary.skills.filter(s=>s.domain==='speaking').every(s=>s.status==='unseen'&&s.n===0));
 assert.deepEqual(home.followups().items.filter(row=>row.gameId==='world-speaking'),[],'말하기 재확인 줄 없음');
});

test('재확인: 옛 지도(공개본 · E 전 master)에 잡힌 읽기 재확인이 말하기 층이 붙은 E 지도에서 이어진다',()=>{
 const olds=[strata.createMap(worldMapData()),strata.createMap(worldLife.withLifeLayer(worldMapData()))];
 for(const oldMap of olds){
  let t=Date.parse('2026-11-09T03:00:00Z');const mem=memory(),clock=()=>new Date(t+=1000).toISOString();
  const item=n=>({id:`p${n}`,itemKey:`qa.detail.${n}`,familyKey:`qa.detail.${n}`,skillId:'ko.reading.detail',modality:'reading',difficulty:1,responseFormat:'single-choice',audioRequired:false});
  const before=require('../../../atlas/game-learning.js').createGame({gameId:'world-practice',map:oldMap,storage:mem,clock,followups:true});
  before.answer(before.present(item(1)),{correct:true,assessable:true});
  t+=2*DAY;
  const after=worldLearning.engine.createGame({gameId:'world-practice',storage:mem,clock,followups:true});
  assert.notEqual(after.mapVersion,oldMap.map_ver);
  const projection=after.followups(),row=projection.items.find(r=>r.gameId==='world-practice'&&r.window==='d1');
  assert.deepEqual([row.status,row.current],['due',true],oldMap.map_ver);
  const pool=[{...item(2)}];
  assert.equal(followupRows({projection,pool,seen:()=>false,taskVersion:after.mapVersion}).rows[0].available,true,'새 지도에서도 공급된다');
  after.answer(after.present(item(2)),{correct:true,assessable:true});
  const paired=after.followups().items.find(r=>r.gameId==='world-practice'&&r.window==='d1');
  assert.deepEqual([paired.status,paired.outcome],['observed','independent-correct']);
 }
});
