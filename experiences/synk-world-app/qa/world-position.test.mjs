import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {POSITION_POLICY,POSITION_CELLS,positionCell,buildPositionMap,DIAGNOSTIC_POLICY,selectDiagnostic,createDiagnosticSession,hangulStageProgress,showsHangulBoard,ESTIMATE_POLICY,estimateGate} from '../world-position.mjs';

// WORLD와 같은 입구(atlas/game-browser.js)의 실제 Core 코치로 상태를 만든다. 상태를 흉내 낸 가짜 요약은 쓰지 않는다.
const require=createRequire(import.meta.url);
const worldLearning=require('../../../atlas/game-browser.js');
const START=Date.parse('2026-10-19T01:00:00Z'),DAY=86400000;
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
function coachFixture({historyComplete=true}={}){
 let now=START,index=0;const storage=memory();
 const coach=worldLearning.engine.createGame({gameId:'world-home',storage,clock:()=>new Date(now).toISOString(),historyComplete});
 const answer=(skillId,correct,{difficulty=1,help=null,family=null,format='single-choice'}={})=>{
  now+=60000;const modality=skillId.split('.')[1],id=`qa.item.${++index}`;
  const pid=coach.present({id,itemKey:id,familyKey:family||id,skillId,modality,difficulty,responseFormat:format});
  if(modality==='listening')coach.delivery(pid,{audio:'completed'});
  if(help)coach.help(pid,help);
  return coach.answer(pid,{correct,assessable:true});
 };
 return {coach,storage,answer,advance:days=>{now+=days*DAY;}};
}
const skillOf=(map,id)=>map.skills.find(skill=>skill.id===id);
const R='ko.reading.grammar',L='ko.listening.detail';

test('Core의 여섯 상태는 세 칸으로만 간다: 혼자 해냄 · 연습 중 · 아직',()=>{
 assert.deepEqual({...POSITION_POLICY.cells},{'recent-independent':'independent',practice:'practicing',checking:'practicing',supported:'practicing',review:'practicing',unseen:'notyet'});
 assert.deepEqual([...POSITION_CELLS],['independent','practicing','notyet']);
 for(const [status,cell] of Object.entries(POSITION_POLICY.cells))assert.equal(positionCell(status),cell);
 for(const bad of ['mastered','grade-1','',null,undefined,'constructor','__proto__'])assert.throws(()=>positionCell(bad),TypeError);
 assert.ok(Object.isFrozen(POSITION_POLICY)&&Object.isFrozen(POSITION_POLICY.cells));
});

test('처음 온 사람은 TOPIK I 15개 항목이 모두 「아직」이고, 약하다고 표시하지 않는다',()=>{
 const {coach}=coachFixture(),map=buildPositionMap({summary:coach.summary(),events:coach.events()});
 assert.equal(map.total,15);
 assert.deepEqual(map.counts,{independent:0,practicing:0,notyet:15});
 assert.equal(map.skills.filter(skill=>skill.domain==='listening').length,7);
 assert.equal(map.skills.filter(skill=>skill.domain==='reading').length,8);
 assert.ok(map.skills.every(skill=>skill.cell==='notyet'&&skill.evidence.length===0));
 assert.equal(map.grade,null);assert.equal(map.abilityClaim,false);assert.equal(map.learningEffectClaim,false);
});

test('칸마다 Core가 읽은 근거 문항(맞음·틀림·도움 받음, 날짜)이 붙는다',()=>{
 const f=coachFixture();
 for(let i=0;i<4;i++)f.answer(R,true);                    // 처음 보는 문항 넷을 혼자 맞힘 → 최근 혼자 수행
 f.answer(L,true);f.answer(L,false);f.answer(L,false);    // 혼자 셋 중 둘 틀림 → 다시 연습
 f.answer('ko.reading.detail',true,{help:'hint'});         // 도움을 보고 맞힘 → 도움을 받아 수행
 f.answer('ko.listening.word',true);                      // 하나만 혼자 맞힘 → 새 문제로 확인하는 중
 const map=buildPositionMap({summary:f.coach.summary(),events:f.coach.events()});
 const grammar=skillOf(map,R),detail=skillOf(map,L),reading=skillOf(map,'ko.reading.detail'),word=skillOf(map,'ko.listening.word');
 assert.equal(grammar.status,'recent-independent');assert.equal(grammar.cell,'independent');
 assert.equal(grammar.evidence.length,4);assert.ok(grammar.evidence.every(row=>row.verdict==='correct'&&row.assisted===false&&row.independent===true));
 assert.equal(detail.status,'practice');assert.equal(detail.cell,'practicing');
 assert.deepEqual(detail.evidence.map(row=>row.verdict).sort(),['correct','incorrect','incorrect']);
 assert.equal(reading.status,'supported');assert.equal(reading.cell,'practicing');
 assert.equal(reading.evidence.length,1);assert.equal(reading.evidence[0].assisted,true);assert.equal(reading.evidence[0].verdict,'correct');
 assert.equal(word.status,'checking');assert.equal(word.cell,'practicing');
 assert.deepEqual(map.counts,{independent:1,practicing:3,notyet:11});
 // 근거는 최신부터, 날짜·문항 열쇠·난도·응답 형식이 있다.
 for(const skill of [grammar,detail]){
  const times=skill.evidence.map(row=>Date.parse(row.at));
  assert.deepEqual(times,[...times].sort((a,b)=>b-a));
  for(const row of skill.evidence){assert.ok(Number.isFinite(Date.parse(row.at)));assert.match(row.itemKey,/^qa\.item\./);assert.equal(row.difficulty,1);assert.equal(row.responseFormat,'single-choice');}
 }
});

test('오래 쉬면 「다시 확인할 때」도 연습 중 칸이고, 근거로 마지막 첫 답을 남긴다',()=>{
 const f=coachFixture();for(let i=0;i<4;i++)f.answer(R,true);
 f.advance(8);
 const grammar=skillOf(buildPositionMap({summary:f.coach.summary(),events:f.coach.events()}),R);
 assert.equal(grammar.status,'review');assert.equal(grammar.cell,'practicing');assert.ok(grammar.evidence.length>=1);
});

test('지도를 읽기만 해서는 학습 기록이 한 글자도 바뀌지 않는다',()=>{
 const f=coachFixture();f.answer(R,true);f.answer(L,false);
 const before=JSON.stringify([...f.storage.values]),events=f.coach.events().length;
 for(let i=0;i<3;i++)buildPositionMap({summary:f.coach.summary(),events:f.coach.events()});
 assert.equal(JSON.stringify([...f.storage.values]),before);assert.equal(f.coach.events().length,events);
});

test('기록이 불완전하면 지도에 그 사실을 남기고, 진단은 열지 않는다',()=>{
 const {coach}=coachFixture({historyComplete:false}),summary=coach.summary();
 assert.equal(buildPositionMap({summary,events:coach.events()}).evidenceComplete,false);
 const plan=selectDiagnostic({summary,items:pool(),seen:item=>coach.exposure(item).seen});
 assert.equal(plan.status,'unavailable');assert.equal(plan.reason,'history.incomplete');assert.equal(plan.items.length,0);assert.equal(plan.missing.length,15);
});

// 항목마다 문항 두 개(쉬운 것·조금 어려운 것)를 가진 가상 묶음. 실제 WORLD 묶음은 world-diagnostic-items.mjs가 만든다.
function pool({skip=[]}={}){
 const ids=['ko.listening.word','ko.listening.detail','ko.listening.negation','ko.listening.sequence','ko.listening.reason','ko.listening.condition','ko.listening.main',
  'ko.reading.vocabulary','ko.reading.grammar','ko.reading.detail','ko.reading.negation','ko.reading.sequence','ko.reading.reason','ko.reading.condition','ko.reading.main'];
 return ids.filter(id=>!skip.includes(id)).flatMap(skillId=>[1,2].map(difficulty=>{const key=`qa.diag.${skillId.split('.').slice(1).join('-')}.${difficulty}`;
  return {id:key,itemKey:key,familyKey:key,skillId,modality:skillId.split('.')[1],difficulty,responseFormat:'single-choice',audioRequired:skillId.includes('listening')};}));
}

test('짧은 진단은 항목마다 하나씩, 이 사람이 처음 보는 계열에서만 고른다',()=>{
 const f=coachFixture(),items=pool();
 const plan=selectDiagnostic({summary:f.coach.summary(),items,seen:item=>f.coach.exposure(item).seen});
 assert.equal(plan.status,'ready');assert.equal(plan.policy,DIAGNOSTIC_POLICY.version);
 assert.equal(plan.items.length,15);assert.deepEqual(plan.missing,[]);
 assert.equal(new Set(plan.items.map(row=>row.skillId)).size,15,'항목당 하나');
 assert.equal(new Set(plan.items.map(row=>row.item.familyKey)).size,15,'계열이 겹치지 않음');
 assert.ok(plan.items.every(row=>row.item.skillId===row.skillId&&row.item.difficulty===1&&row.target===1),'처음에는 쉬운 난도부터');
 // 같은 입력이면 늘 같은 문항(시험·재현).
 assert.deepEqual(selectDiagnostic({summary:f.coach.summary(),items,seen:item=>f.coach.exposure(item).seen}).items.map(row=>row.item.id),plan.items.map(row=>row.item.id));
});

test('본 적 있는 계열은 다시 내지 않고, 다음에 다른 문항으로 다시 할 수 있다',()=>{
 const f=coachFixture(),items=pool(),seen=item=>f.coach.exposure(item).seen;
 const first=selectDiagnostic({summary:f.coach.summary(),items,seen});
 // 첫 진단에서 낸 문항을 실제로 제시하고 답한다(혼자 푼 첫 시도).
 for(const {item} of first.items){const pid=f.coach.present(item);if(item.modality==='listening')f.coach.delivery(pid,{audio:'completed'});f.coach.answer(pid,{correct:true,assessable:true});}
 const second=selectDiagnostic({summary:f.coach.summary(),items,seen});
 assert.equal(second.items.length,15);
 const before=new Set(first.items.map(row=>row.item.familyKey));
 assert.ok(second.items.every(row=>!before.has(row.item.familyKey)),'두 번째 진단은 모두 다른 계열');
 assert.ok(second.items.every(row=>row.item.difficulty===2));
 const third=selectDiagnostic({summary:f.coach.summary(),items,seen:item=>{const value=seen(item);return value;}});
 for(const {item} of second.items){const pid=f.coach.present(item);if(item.modality==='listening')f.coach.delivery(pid,{audio:'completed'});f.coach.answer(pid,{correct:false,assessable:true});}
 const spent=selectDiagnostic({summary:f.coach.summary(),items,seen});
 assert.equal(spent.items.length,0);assert.equal(spent.status,'unavailable');
 assert.ok(spent.missing.every(row=>row.reason==='all-seen'));
 assert.equal(third.items.length,15);
});

test('혼자 해낸 난도 다음 난도의 새 문항을 먼저 고른다',()=>{
 const f=coachFixture();for(let i=0;i<4;i++)f.answer(R,true);
 const plan=selectDiagnostic({summary:f.coach.summary(),items:pool(),seen:item=>f.coach.exposure(item).seen});
 const grammar=plan.items.find(row=>row.skillId===R);
 assert.equal(grammar.target,2);assert.equal(grammar.item.difficulty,2);
 assert.ok(plan.items.filter(row=>row.skillId!==R).every(row=>row.item.difficulty===1));
});

test('문항이 없거나 소리를 못 쓰거나 노출을 모르면 채운 척하지 않고 모자란 항목으로 돌려준다',()=>{
 const f=coachFixture(),seen=item=>f.coach.exposure(item).seen;
 const lacking=selectDiagnostic({summary:f.coach.summary(),items:pool({skip:['ko.reading.main','ko.listening.reason']}),seen});
 assert.equal(lacking.items.length,13);
 assert.deepEqual(lacking.missing,[{skillId:'ko.listening.reason',reason:'no-item'},{skillId:'ko.reading.main',reason:'no-item'}]);
 const quiet=selectDiagnostic({summary:f.coach.summary(),items:pool(),seen,audioAvailable:false});
 assert.equal(quiet.items.length,8);assert.ok(quiet.items.every(row=>row.item.modality==='reading'));
 assert.ok(quiet.missing.every(row=>row.reason==='audio'&&row.skillId.startsWith('ko.listening.')));assert.equal(quiet.missing.length,7);
 const unknown=selectDiagnostic({summary:f.coach.summary(),items:pool(),seen:()=>null});
 assert.equal(unknown.items.length,0);assert.ok(unknown.missing.every(row=>row.reason==='unknown'));
 const broken=selectDiagnostic({summary:f.coach.summary(),items:pool(),seen:()=>{throw Error('storage');}});
 assert.equal(broken.items.length,0);
});

test('같은 형식이면 TOPIK 보기 고르기에 가까운 형식을 먼저, 잘못된 문항은 받지 않는다',()=>{
 const f=coachFixture(),seen=item=>f.coach.exposure(item).seen;
 const base={skillId:L,modality:'listening',difficulty:1,audioRequired:true};
 const items=[{...base,id:'qa.b',itemKey:'qa.b',familyKey:'qa.b',responseFormat:'binary-choice'},{...base,id:'qa.a',itemKey:'qa.a',familyKey:'qa.a',responseFormat:'action'},
  {...base,id:'qa.c',itemKey:'qa.c',familyKey:'qa.c',responseFormat:'single-choice'}];
 assert.equal(selectDiagnostic({summary:f.coach.summary(),items,seen}).items[0].item.id,'qa.c');
 assert.throws(()=>selectDiagnostic({summary:f.coach.summary(),items:[{...items[0],skillId:'ko.reading.detail'}],seen}),TypeError,'영역이 다른 문항');
 assert.throws(()=>selectDiagnostic({summary:f.coach.summary(),items:[items[0],items[0]],seen}),TypeError,'같은 id 두 번');
 assert.throws(()=>selectDiagnostic({summary:f.coach.summary(),items:[{...items[0],difficulty:4}],seen}),TypeError);
 assert.throws(()=>selectDiagnostic({summary:{skills:[]},items,seen}),TypeError,'Core 요약이 아님');
});

// 진단 한 바퀴: 보기와 정답이 있는 문항으로 실제 코치에 남긴다.
const playable=(row,extra={})=>({...row,choices:[{id:`${row.id}.a`,label:'첫째'},{id:`${row.id}.b`,label:'둘째'},{id:`${row.id}.c`,label:'셋째'}],correctId:`${row.id}.b`,...extra});
const readingItem=pool().find(item=>item.skillId==='ko.reading.grammar'&&item.difficulty===1),listeningItem=pool().find(item=>item.skillId==='ko.listening.detail'&&item.difficulty===1);

test('진단의 답은 처음 본 문항에 혼자 낸 첫 시도로 Trail에 남고, 지도 칸을 움직인다',()=>{
 const f=coachFixture(),session=createDiagnosticSession({coach:f.coach,items:[{skillId:readingItem.skillId,item:playable(readingItem)}]});
 assert.equal(f.coach.exposure(readingItem).seen,false);
 const shown=session.next();assert.equal(shown.index,0);assert.equal(shown.heard,true,'읽기는 들을 것이 없다');
 assert.throws(()=>session.next(),/answer or skip/);
 const result=session.answer(`${readingItem.id}.b`);
 assert.equal(result.verdict,'correct');assert.equal(result.independent,true);assert.equal(result.assisted,false);assert.equal(result.skipped,false);
 assert.equal(session.answer(`${readingItem.id}.a`),null,'첫 답 뒤 다른 답은 받지 않는다');
 assert.equal(session.next(),null);
 const grammar=skillOf(buildPositionMap({summary:f.coach.summary(),events:f.coach.events()}),'ko.reading.grammar');
 assert.equal(grammar.status,'checking');assert.equal(grammar.cell,'practicing');
 assert.equal(grammar.evidence[0].eventId,result.eventId);assert.equal(grammar.evidence[0].verdict,'correct');assert.equal(grammar.evidence[0].itemKey,readingItem.itemKey);
 assert.equal(f.coach.exposure(readingItem).seen,true);
 const attempt=f.coach.events().find(event=>event.type==='practice.attempted');
 assert.deepEqual(attempt.choice,{selectedId:`${readingItem.id}.b`,correctId:`${readingItem.id}.b`});
 const presented=f.coach.events().find(event=>event.type==='practice.presented');
 assert.equal(presented.firstExposure,true);assert.equal(presented.measure.familyKey,readingItem.familyKey);assert.equal(presented.measure.responseFormat,'single-choice');
});

test('듣기 문항은 끝까지 들은 뒤에만 답을 받고, 다 들은 뒤 다시 듣기는 도움으로 남는다',()=>{
 const f=coachFixture(),session=createDiagnosticSession({coach:f.coach,items:[playable(listeningItem),playable({...listeningItem,id:'qa.diag.extra',itemKey:'qa.diag.extra',familyKey:'qa.diag.extra'})]});
 session.next();
 assert.equal(session.answer(`${listeningItem.id}.b`),null,'듣기 전');
 assert.equal(session.delivery('failed'),true);assert.equal(session.answer(`${listeningItem.id}.b`),null,'재생 실패');
 assert.equal(session.replay(),true);assert.equal(session.delivery('completed'),true);
 const heard=session.answer(`${listeningItem.id}.a`);
 assert.equal(heard.verdict,'incorrect');assert.equal(heard.independent,true,'실패 뒤 처음 끝까지 들은 것은 아직 도움이 아니다');
 session.next();session.delivery('completed');assert.equal(session.replay(),true);
 const helped=session.answer('qa.diag.extra.b');
 assert.equal(helped.verdict,'correct');assert.equal(helped.independent,false);assert.equal(helped.assisted,true);
 assert.deepEqual(session.results().map(row=>[row.verdict,row.independent]),[['incorrect',true],['correct',false]]);
});

test('건너뛴 문항은 평가할 수 없는 답으로 남고, 그만두면 안 보인 문항은 기록하지 않는다',()=>{
 const f=coachFixture(),items=pool().filter(item=>item.difficulty===1).slice(6,10).map(item=>playable(item));
 const session=createDiagnosticSession({coach:f.coach,items});
 session.next();const skipped=session.skip();
 assert.equal(skipped.skipped,true);assert.equal(skipped.independent,false);assert.equal(skipped.verdict,'unassessed');
 session.next();if(items[1].audioRequired)session.delivery('completed');session.answer(items[1].correctId);
 session.next();session.stop();
 assert.equal(session.next(),null,'그만둔 뒤에는 더 내지 않는다');
 assert.deepEqual(session.results().map(row=>row.skipped),[true,false,true]);
 assert.equal(f.coach.exposure(items[0]).seen,true,'건너뛴 문항도 본 문항');
 assert.equal(f.coach.exposure(items[3]).seen,false,'보이지 않은 문항은 다음 진단에 다시 나올 수 있다');
 const attempts=f.coach.events().filter(event=>event.type==='practice.attempted');
 assert.equal(attempts.length,3);assert.deepEqual(attempts.map(event=>event.reason??null),[items[0].audioRequired?'audio':'unanswered',null,items[2].audioRequired?'audio':'unanswered']);
 const map=buildPositionMap({summary:f.coach.summary(),events:f.coach.events()});
 assert.equal(skillOf(map,items[0].skillId).cell,'notyet','건너뛴 답으로 칸이 움직이지 않는다');
});

test('보기·정답이 없는 문항이나 코치가 아닌 것은 받지 않는다',()=>{
 const f=coachFixture();
 assert.throws(()=>createDiagnosticSession({coach:f.coach,items:[readingItem]}),TypeError);
 assert.throws(()=>createDiagnosticSession({coach:f.coach,items:[playable(readingItem,{correctId:'qa.none'})]}),TypeError);
 assert.throws(()=>createDiagnosticSession({coach:{},items:[]}),TypeError);
 assert.throws(()=>{const s=createDiagnosticSession({coach:f.coach,items:[playable(readingItem)]});s.next();s.answer('qa.unknown');},TypeError);
});

// 예상 급수의 문턱: TOPIK 형식(처음 보는 문항·실제 구성·시간 제한)의 첫 답만 센다.
const asOf='2026-10-19T09:00:00.000Z';
const topikRow=(index,domain,extra={})=>({eventId:`qa.topik.${domain}.${index}`,at:new Date(Date.parse(asOf)-index*3600000).toISOString(),domain,verdict:index%3?'correct':'incorrect',
 independent:true,firstExposure:true,timed:true,form:'topik-i',composition:'official-blueprint',...extra});
const rows=(listening,reading,extra)=>[...Array.from({length:listening},(_,i)=>topikRow(i,'listening',extra)),...Array.from({length:reading},(_,i)=>topikRow(i,'reading',extra))];

test('게임 기록과 정답률은 아무리 많아도 예상 급수의 근거가 아니다',()=>{
 const game=Array.from({length:200},(_,i)=>({eventId:`qa.game.${i}`,at:asOf,domain:i%2?'listening':'reading',verdict:'correct',independent:true,firstExposure:true}));
 const gate=estimateGate({evidence:game,asOf});
 assert.equal(gate.status,'too-early');assert.equal(gate.evidence,0);assert.equal(gate.visible,false);assert.equal(gate.grade,null);assert.equal(gate.range,null);assert.equal(gate.passClaim,false);
 assert.equal(estimateGate({asOf}).status,'too-early');
});

test('기준 수 미만이면 「아직 판단하기 일러요」, 두 영역이 다 차야 문턱을 넘는다',()=>{
 assert.equal(ESTIMATE_POLICY.minEvidence,30);assert.ok(Object.isFrozen(ESTIMATE_POLICY));assert.match(ESTIMATE_POLICY.version,/^world-topik-estimate-\d+$/);
 const short=estimateGate({evidence:rows(15,14),asOf});
 assert.equal(short.status,'too-early');assert.equal(short.evidence,29);assert.equal(short.needed,30);
 const oneSided=estimateGate({evidence:rows(30,0),asOf});
 assert.equal(oneSided.status,'too-early');assert.deepEqual(oneSided.perDomain,{listening:30,reading:0});
 const enough=estimateGate({evidence:rows(15,15),asOf});
 // 문턱을 넘어도 범위를 읽는 검수된 방법이 없어 급수는 만들지 않고 보이지도 않는다.
 assert.equal(enough.status,'no-estimator');assert.equal(enough.evidence,30);assert.equal(enough.grade,null);assert.equal(enough.range,null);assert.equal(enough.visible,false);
 assert.equal(enough.updatedAt,rows(15,15).map(row=>row.at).sort().at(-1));
});

test('처음 보는 문항·혼자·시간 제한·실제 구성·기간을 하나라도 어기면 세지 않는다',()=>{
 for(const extra of [{firstExposure:false},{firstExposure:null},{independent:false},{timed:false},{timed:undefined},{form:'game'},{composition:'game-mix'},{verdict:'skipped'},{verdict:'unassessed'}]){
  assert.equal(estimateGate({evidence:rows(20,20,extra),asOf}).evidence,0,JSON.stringify(extra));
 }
 const old=rows(20,20).map(row=>({...row,at:new Date(Date.parse(asOf)-91*DAY).toISOString()}));
 assert.equal(estimateGate({evidence:old,asOf}).evidence,0,'90일보다 오래된 근거');
 const future=rows(20,20).map(row=>({...row,at:new Date(Date.parse(asOf)+DAY).toISOString()}));
 assert.equal(estimateGate({evidence:future,asOf}).evidence,0,'기준 시각 뒤의 근거');
 const twice=[...rows(15,15),...rows(15,15)];
 assert.equal(estimateGate({evidence:twice,asOf}).evidence,30,'같은 답을 두 번 보내도 한 번');
 const stricter={...ESTIMATE_POLICY,version:'world-topik-estimate-qa',minEvidence:40};
 assert.equal(estimateGate({evidence:rows(15,15),asOf,policy:stricter}).status,'too-early','정책 판이 기준 수를 바꾼다');
 assert.throws(()=>estimateGate({evidence:[],asOf:'not a time'}),TypeError);
});

// 한글 만나기 진도: 그 게임의 실제 판단 함수로 만든 진도에서 숫자만 꺼낸다.
test('한글 진도는 만난 글자·다 익힌 핵심 단원·졸업을 그 게임의 진도 그대로 읽는다',async()=>{
 const fs=await import('node:fs');
 const layer=JSON.parse(fs.readFileSync(new URL('../../../strata/hangul.json',import.meta.url),'utf8'));
 const core=await import('../../hangul-stage/core.mjs');
 const empty=hangulStageProgress(null,layer);
 assert.deepEqual(empty,{started:false,met:0,total:49,mastered:0,units:7,unitsDone:0,graduated:false,skipped:false});
 const first=layer.units[0].letters,at='2026-10-19T01:00:00.000Z';
 const progress=core.meet(core.emptyProgress(),[...first,layer.units[1].letters[0]],at);
 for(const id of first)progress.letters[id]={...progress.letters[id],state:'mastered',best:'mastered'};
 const read=hangulStageProgress(JSON.parse(JSON.stringify(progress)),layer);
 assert.equal(read.started,true);assert.equal(read.met,first.length+1);assert.equal(read.mastered,first.length);assert.equal(read.unitsDone,1);
 assert.equal(hangulStageProgress(core.graduate(progress,at),layer).graduated,true);
 assert.equal(hangulStageProgress({...progress,skipped:true},layer).skipped,true);
 assert.deepEqual(hangulStageProgress({v:2,letters:{}},layer),empty,'모르는 판의 진도는 빈 진도');
 assert.throws(()=>hangulStageProgress(progress,{}),TypeError);
});

test('한글 판은 「아직 못 읽어요」를 고르고 아직 졸업하지 않은 사람에게만',()=>{
 const stage={graduated:false,skipped:false};
 assert.equal(showsHangulBoard({reading:{version:1,answer:'new',at:1,via:'question'},stage}),true);
 assert.equal(showsHangulBoard({reading:{version:1,answer:'reads',at:1,via:'question'},stage}),false);
 assert.equal(showsHangulBoard({reading:null,stage}),false,'답이 없으면 항목 지도');
 assert.equal(showsHangulBoard({reading:{answer:'new'},stage:{graduated:true}}),false,'졸업 뒤에는 항목 지도');
 assert.equal(showsHangulBoard({reading:{answer:'new'},stage:{skipped:true}}),false,'한글을 이미 읽는다고 건너뛰면 항목 지도');
 assert.equal(showsHangulBoard({reading:{answer:'new'}}),true,'한글 진도를 못 읽어도 고른 답을 따른다');
});
