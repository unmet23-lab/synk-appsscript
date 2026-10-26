import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAY_POLICY,allowedPlays,presentCondition,nextPlay,MOCK_POLICY,mockSlots,selectMock,createMockSession,mockEvidence,freshBySet} from '../world-exam-form.mjs';
import {createTopikBank,bankItems} from '../world-topik-items.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import {selectDiagnostic,createDiagnosticSession,estimateGate,buildPositionMap} from '../world-position.mjs';
import {examForms} from '../../../tools/build-world-topik-items.mjs';

// 시험 형식(10-21 ④): 시험형 재생 규칙 · 시험 형식 연습(미니 모의) · 근거 집계. 실제 WORLD 코치(TOPIK I·II 지도)로 기록한다.
const FORMS=examForms();
test('미니 모의 직접 delivery도 마감 직전·정각·직후를 검사한다',()=>{
 for(const delta of [-1,0,1]){
  const bank=bankOf(topikIBank()),f=coachFixture('world-mock');
  const plan=selectMock({forms:bank.forms,exam:'topik1',pool:bank.items,seen:item=>f.coach.exposure(item).seen});
  let now=Date.parse('2026-10-21T02:00:00Z');
  const session=createMockSession({coach:f.coach,exam:'topik1',sections:[{...plan.sections[0],minutes:1}],clock:()=>now});
  const first=session.start();assert.equal(session.play(),'first');
  now=first.deadline+delta;
  // current/tick을 먼저 읽지 않고 재생기의 완료 콜백을 바로 보낸다.
  assert.equal(session.delivery('completed'),delta<0,`마감 ${delta}ms`);
  const result=session.results()[0];
  assert.equal(result.items[0].plays.completed,delta<0?1:0);
  if(delta>=0){
   assert.equal(result.ended,'time');assert.equal(result.items[0].verdict,'unassessed');
   assert.equal(session.answer(first.item.correctId),null);
  }else assert.equal(session.answer(first.item.correctId).independent,true);
 }
});
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
function coachFixture(gameId='world-home'){
 let now=Date.parse('2026-10-21T01:00:00Z');
 const clock=()=>new Date(now).toISOString(),tick=(ms=1000)=>{now+=ms;};
 const coach=worldLearning.engine.createGame({gameId,storage:memory(),clock:()=>{now+=1000;return clock();}});
 return {coach,now:()=>now,tick,clock};
}
// 공개 은행과 같은 꼴의 합성 문항. 듣기는 소리 파일·허용 재생 수가 있다.
let serial=0;
function row({exam='topik-i',section='reading',type,skillId,difficulty=1,set=null,plays=null}){
 const id=`qa-${exam==='topik-i'?'ti':'tii'}-${section[0]}-${String(++serial).padStart(3,'0')}`;
 return {id,rev:1,family:id,exam,format:'pbt',section,officialType:type,targetGrade:exam==='topik-i'?1:3,skillId,difficulty,responseFormat:'single-choice',set,
  passage:section==='reading'?`${id} 지문입니다.`:null,script:section==='listening'?[{speaker:'여자',text:`${id} 대사예요.`}]:null,question:'알맞은 것을 고르십시오.',
  choices:['가','나','다','라'],answer:1,explanation:{ko:'한국어 해설',en:'English note',mn:'Монгол тайлбар'},choiceNotes:['a','b','c','d'],conceptIds:[],
  audio:section==='listening'?{file:`audio/${id}.mp3`,plays:plays??2,seconds:3}:null};
}
function topikIBank(){
 const L=(type,skillId,extra={})=>row({section:'listening',type,skillId,...extra}),R=(type,skillId,extra={})=>row({type,skillId,...extra});
 const items=[
  L('TI-L-01','ko.listening.response'),L('TI-L-01','ko.listening.response'),L('TI-L-05','ko.listening.response'),L('TI-L-07','ko.listening.detail'),L('TI-L-11','ko.listening.main'),
  L('TI-L-17','ko.listening.negation'),L('TI-L-17','ko.listening.reason'),L('TI-L-17','ko.listening.condition'),L('TI-L-22','ko.listening.main'),
  L('TI-L-25','ko.listening.main',{set:{id:'qa-ls1',order:1,size:2},difficulty:2}),L('TI-L-26','ko.listening.detail',{set:{id:'qa-ls1',order:2,size:2},difficulty:2}),
  R('TI-R-31','ko.reading.main'),R('TI-R-31','ko.reading.main'),R('TI-R-34','ko.reading.vocabulary'),R('TI-R-34','ko.reading.grammar'),R('TI-R-40','ko.reading.condition'),
  R('TI-R-43','ko.reading.sequence'),R('TI-R-46','ko.reading.main'),
  R('TI-R-49','ko.reading.vocabulary',{set:{id:'qa-rs1',order:1,size:2},difficulty:2}),R('TI-R-50','ko.reading.detail',{set:{id:'qa-rs1',order:2,size:2},difficulty:2}),
  R('TI-R-53','ko.reading.grammar',{set:{id:'qa-rs2',order:1,size:2},difficulty:2}),R('TI-R-54','ko.reading.reason',{set:{id:'qa-rs2',order:2,size:2},difficulty:2}),
  // 세트 한쪽만 통과한 세트(시험 형식 연습에는 통째로 못 낸다)
  R('TI-R-55','ko.reading.grammar',{set:{id:'qa-rs3',order:1,size:2},difficulty:2}),
 ];
 return {version:'world-topik-items-1',contentHash:'qa',forms:FORMS,items};
}
const bankOf=raw=>{const bank=createTopikBank();bank.use(raw);return bank;};

test('시험형 재생 규칙: 문항 묶음의 듣기만 허용 횟수가 있고, 그 수는 공식 유형의 재생 수(PBT)다',()=>{
 const bank=bankOf(topikIBank());
 const listening=bank.items.filter(item=>item.modality==='listening');
 assert.ok(listening.length>5);
 for(const item of listening)assert.equal(allowedPlays(item),2,item.id);
 assert.equal(allowedPlays(bank.items.find(item=>item.modality==='reading')),null);
 assert.equal(allowedPlays({source:'korean-runner',modality:'listening',plays:2}),null,'게임 원고 문항은 그 게임 규칙');
 // 공식 유형표: TOPIK I 듣기는 모두 두 번, TOPIK II는 1~20번 한 번·21~50번 두 번.
 for(const type of FORMS['topik-i'].types.filter(row=>row.section==='listening'))assert.equal(type.plays,2,type.id);
 for(const type of FORMS['topik-ii'].types.filter(row=>row.section==='listening'))assert.equal(type.plays,type.to<=20?1:2,type.id);
 assert.equal(PLAY_POLICY.mode,'pbt');assert.ok(!('ibt' in FORMS['topik-i']),'IBT 판은 싣지 않는다');
 assert.equal(nextPlay({allowed:2,completed:0},{heard:false}),'first');
 assert.equal(nextPlay({allowed:2,completed:1},{heard:true}),'allowed');
 assert.equal(nextPlay({allowed:2,completed:2},{heard:true}),'extra');
 assert.equal(nextPlay({allowed:2,completed:2},{heard:true,exam:true}),'closed');
 assert.equal(nextPlay({allowed:null,completed:1},{heard:true}),'extra','게임 규칙: 다 들은 뒤 다시 듣기는 도움');
 assert.equal(presentCondition(bank.items.find(item=>item.modality==='reading')),undefined);
 assert.deepEqual(presentCondition(listening[0],{content:'world-diagnostic'}).flow.values,{plays:2});
});

test('진단의 시험형 듣기: 두 번까지는 혼자 들은 것, 세 번째부터 도움 — 허용 횟수와 실제 재생이 기록에 남는다',()=>{
 const bank=bankOf(topikIBank()),item=bank.items.find(row=>row.officialType==='TI-L-07');
 const other=bank.items.find(row=>row.officialType==='TI-L-11');
 const f=coachFixture(),session=createDiagnosticSession({coach:f.coach,items:[item,other]});
 session.next();
 assert.equal(session.replay(),'first');assert.equal(session.delivery('completed'),true);
 assert.equal(session.current.next,'allowed');assert.equal(session.replay(),'allowed','두 번째 듣기는 허용 안');
 assert.equal(session.delivery('completed'),true);
 const alone=session.answer(item.correctId);
 assert.equal(alone.independent,true,'두 번 들은 답은 혼자 낸 첫 답');assert.deepEqual(alone.plays,{allowed:2,completed:2,extra:0});
 session.next();session.replay();session.delivery('completed');session.replay();session.delivery('completed');
 assert.equal(session.current.next,'extra');assert.equal(session.replay(),'extra');session.delivery('completed');
 const helped=session.answer(other.correctId);
 assert.equal(helped.independent,false);assert.equal(helped.assisted,true,'허용을 넘겨 더 들으면 도움을 받은 답');
 assert.deepEqual(helped.plays,{allowed:2,completed:3,extra:1});
 const events=f.coach.events(),decisions=events.filter(event=>event.type==='decision.made');
 assert.deepEqual(decisions.map(event=>event.candidateSnapshot[0].flow?.values),[{plays:2},{plays:2}],'허용 횟수는 결정 기록에');
 const presentations=events.filter(event=>event.type==='practice.presented');
 assert.deepEqual(presentations.map(p=>events.filter(event=>event.type==='practice.delivery'&&event.presentationId===p.id&&event.audio==='completed').length),[2,3],'끝까지 들은 재생마다 소리 전달');
 assert.equal(events.filter(event=>event.type==='practice.helped').length,1,'도움은 허용을 넘긴 한 번만');
});

test('TOPIK II 1~20번형은 한 번만 혼자: 다시 들으면 도움이다',()=>{
 const raw={version:'world-topik-items-1',forms:FORMS,items:[row({exam:'topik-ii',section:'listening',type:'TII-L-13',skillId:'ko2.listening.detail',plays:1}),
  row({exam:'topik-ii',section:'listening',type:'TII-L-21',skillId:'ko2.listening.main',plays:2,set:{id:'qa-t2s',order:1,size:2},difficulty:2})]};
 const [one,two]=bankOf(raw).items;
 assert.equal(allowedPlays(one),1);assert.equal(allowedPlays(two),2);
 const f=coachFixture(),session=createDiagnosticSession({coach:f.coach,items:[one]});
 session.next();session.replay();session.delivery('completed');
 assert.equal(session.replay(),'extra');session.delivery('completed');
 assert.equal(session.answer(one.correctId).independent,false);
 assert.equal(buildPositionMap({summary:f.coach.summary(),events:f.coach.events(),exam:'topik2'}).skills.find(s=>s.id==='ko2.listening.detail').helped.length,1,'TOPIK II 판에서도 도움과 함께 한 시도로 보인다');
});

test('세트 문항: 한 문항을 보면 같은 세트의 다른 문항은 처음 보는 문항이 아니다(진단은 한 세트에서 하나만)',()=>{
 const bank=bankOf(topikIBank()),items=bank.items;
 const set=items.filter(item=>item.setId==='qa-rs1');
 assert.equal(freshBySet(items,item=>item.id===set[0].id).some(item=>item.setId==='qa-rs1'),false);
 const f=coachFixture();
 const plan=selectDiagnostic({summary:f.coach.summary(),items,seen:item=>f.coach.exposure(item).seen});
 const sets=plan.items.map(row=>row.item.setId).filter(Boolean);
 assert.equal(new Set(sets).size,sets.length,'한 진단에 같은 세트 둘은 없다');
});

test('짧은 진단은 TOPIK II 판에서 ko2 항목만 고르고, 문항이 없으면 그 항목을 비워 둔다',()=>{
 const raw={version:'world-topik-items-1',forms:FORMS,items:[row({exam:'topik-ii',type:'TII-R-05',skillId:'ko2.reading.main'}),row({exam:'topik-ii',type:'TII-R-09',skillId:'ko2.reading.detail'}),
  ...topikIBank().items]};
 const items=bankOf(raw).items,f=coachFixture();
 const plan=selectDiagnostic({summary:f.coach.summary(),items,seen:item=>f.coach.exposure(item).seen,exam:'topik2'});
 assert.equal(plan.exam,'topik2');assert.equal(plan.total,12);
 assert.deepEqual(plan.items.map(row=>row.skillId).sort(),['ko2.reading.detail','ko2.reading.main']);
 assert.equal(plan.missing.length,10);assert.ok(plan.missing.every(row=>row.reason==='no-item'));
 const one=selectDiagnostic({summary:f.coach.summary(),items,seen:item=>f.coach.exposure(item).seen});
 assert.equal(one.total,16);assert.ok(one.items.every(row=>row.skillId.startsWith('ko.')));
});

test('미니 모의의 판: 공식 유형을 번호 순서·비율대로 줄이고, 시간은 실제 시험의 문항당 시간이다',()=>{
 const listening=mockSlots({forms:FORMS,exam:'topik-i',section:'listening'}),reading=mockSlots({forms:FORMS,exam:'topik-i',section:'reading'});
 assert.equal(listening.official.items,30);assert.equal(listening.official.minutes,40);
 assert.equal(listening.setCount,1,'듣기 세트(25~30번 6문항)는 10문항 판에서 세트 하나');
 assert.equal(listening.singles.reduce((n,row)=>n+row.count,0)+2,10);
 assert.deepEqual(listening.singles.map(row=>row.type),['TI-L-01','TI-L-05','TI-L-07','TI-L-11','TI-L-15','TI-L-17','TI-L-22']);
 assert.equal(listening.singles.find(row=>row.type==='TI-L-17').count,2,'17~21번(5문항)은 두 자리');
 assert.equal(reading.setCount,2);assert.equal(reading.singles.reduce((n,row)=>n+row.count,0)+4,10);
 assert.equal(reading.singles.find(row=>row.type==='TI-R-34').count,2,'34~39번(6문항)은 두 자리');
 for(const section of ['listening','reading']){
  const two=mockSlots({forms:FORMS,exam:'topik-ii',section});
  assert.equal(two.official.items,50);assert.equal(two.singles.reduce((n,row)=>n+row.count,0)+two.setCount*2,10);
 }
 assert.equal(mockSlots({forms:FORMS,exam:'topik-ii',section:'writing'}),null,'쓰기는 미니 모의 영역이 아니다(쓰기 50분 한 벌은 쓰기 연습 ③에)');
 assert.deepEqual([...MOCK_POLICY.sections],['listening','reading']);
});

test('미니 모의 고르기: 처음 보는 문항만, 세트는 통째로, 못 채운 유형은 알린다',()=>{
 const bank=bankOf(topikIBank()),f=coachFixture('world-mock'),seen=item=>f.coach.exposure(item).seen;
 const plan=selectMock({forms:bank.forms,exam:'topik1',pool:bank.items,seen});
 assert.equal(plan.status,'ready');assert.equal(plan.mode,'pbt');assert.equal(plan.composition,'mini-blueprint');assert.equal(plan.grade,null);assert.equal(plan.passClaim,false);
 const [listening,reading]=plan.sections;
 assert.equal(listening.status,'ready');assert.deepEqual(listening.items.map(item=>item.officialType),['TI-L-01','TI-L-05','TI-L-07','TI-L-11','TI-L-17','TI-L-17','TI-L-22','TI-L-25','TI-L-26']);
 assert.deepEqual(listening.missing,[{type:'TI-L-15',from:15,to:16,count:1}],'그림 고르기 유형은 문항이 없어 빠진다');
assert.deepEqual(plan.numbers['TI-L-17'],[17,21]);
 assert.equal(listening.minutes,12,'9문항 × 40분/30문항');
 assert.equal(new Set(listening.items.filter(item=>item.officialType==='TI-L-17').map(item=>item.skillId)).size,2,'한 유형의 두 자리는 서로 다른 항목부터');
 assert.equal(reading.status,'ready');
 assert.ok(!reading.items.some(item=>item.setId==='qa-rs3'),'한쪽만 통과한 세트는 통째로 못 내 빠진다');
 assert.deepEqual(reading.items.filter(item=>item.setId).map(item=>`${item.setId}:${item.setOrder}`),['qa-rs1:1','qa-rs1:2','qa-rs2:1','qa-rs2:2']);
 assert.equal(plan.minutes,listening.minutes+reading.minutes);
 const quiet=selectMock({forms:bank.forms,exam:'topik1',pool:bank.items,seen,audioAvailable:false});
 assert.equal(quiet.sections[0].status,'audio-off');assert.equal(quiet.sections[1].status,'ready');
 // 본 문항은 다시 나오지 않는다: 읽기를 모두 보면 읽기 영역은 문항이 모자라다.
 const all=selectMock({forms:bank.forms,exam:'topik1',pool:bank.items,seen:item=>item.modality==='reading'?true:seen(item)});
 assert.equal(all.sections[1].status,'none');
});

test('미니 모의 한 번: 시간 제한·한 번 고른 답·열어 본 문항만 기록 — 끝나면 근거 줄이 된다',()=>{
 const bank=bankOf(topikIBank()),f=coachFixture('world-mock'),seen=item=>f.coach.exposure(item).seen;
 const plan=selectMock({forms:bank.forms,exam:'topik1',pool:bank.items,seen});
 let now=Date.parse('2026-10-21T02:00:00Z');
 const session=createMockSession({coach:f.coach,exam:'topik1',sections:plan.sections.filter(row=>row.status==='ready'),clock:()=>now});
 // 듣기: 허용 두 번까지만 들을 수 있다(시험처럼 더 듣기는 없다).
 let view=session.start();assert.equal(view.section,'listening');assert.equal(view.remainingMs,plan.sections[0].minutes*60000);
 assert.equal(session.answer(view.item.correctId),null,'듣기 전에는 답을 받지 않는다');
 assert.equal(session.play(),'first');session.delivery('completed');
 assert.equal(session.play(),'allowed');session.delivery('completed');
 assert.equal(session.play(),false,'허용을 넘긴 재생은 없다');
 assert.equal(session.answer(view.item.correctId).independent,true);
 assert.equal(session.answer(view.item.choices[0].id),null,'고른 답은 바꾸지 않는다');
 view=session.go(2);session.play();session.delivery('completed');session.answer(view.item.choices[0].id);
 view=session.go(1);// 열어만 본 문항(듣지 않음)
 view=session.finishSection();assert.equal(view.section,'reading');assert.equal(view.started,false);
 view=session.start();
 session.answer(view.item.correctId);
 // 시간이 다 되면 그 영역은 닫힌다.
 now+=plan.sections[1].minutes*60000+1;
 assert.equal(session.current.between,true);assert.equal(session.current.ended,'time');
 assert.equal(session.answer(view.item.correctId),null);
 session.finishSection();assert.equal(session.finished,true);
 const [listening,reading]=session.results();
 assert.deepEqual(listening.items.filter(row=>row.opened).map(row=>row.verdict),['correct','unassessed','incorrect']);
 assert.equal(listening.items.filter(row=>!row.opened).every(row=>row.verdict===null),true,'열어 보지 않은 문항은 기록하지 않는다');
 assert.equal(reading.ended,'time');
 const unopened=listening.items.find(row=>!row.opened);
 assert.equal(f.coach.exposure(bank.items.find(item=>item.id===unopened.itemId)).seen,false,'열어 보지 않은 문항은 다음에 처음 보는 문항');
 const evidence=mockEvidence({events:f.coach.events(),asOf:new Date(now).toISOString()});
 assert.deepEqual(evidence.map(row=>[row.domain,row.verdict,row.independent,row.timed,row.form,row.composition,row.mode]),[
  ['listening','correct',true,true,'topik-i','mini-blueprint','pbt'],['listening','incorrect',true,true,'topik-i','mini-blueprint','pbt'],
  ['listening','unassessed',false,true,'topik-i','mini-blueprint','pbt'],['reading','correct',true,true,'topik-i','mini-blueprint','pbt']],'기록 순서대로 — 열어만 본 문항은 영역이 닫힐 때 「답하지 않음」');
 const decision=f.coach.events().find(event=>event.type==='decision.made');
 assert.deepEqual(decision.candidateSnapshot[0].flow.values,{plays:2,form:'topik-i',composition:'mini-blueprint',section:'listening',minutes:plan.sections[0].minutes,timed:true});
});

// 10-21 아르곤 검수 반영: 세트 문항마다 재생 셈을 따로 두면 세트 대본을 네 번 듣고, 둘째 문항은 다시 들어야 답할 수 있었다.
test('시험 형식 연습의 세트 듣기: 대본 하나를 세트 문항이 함께 쓴다 — 재생 셈은 세트에 하나, 다 들은 뒤 연 세트 문항도 혼자 낸 답이 된다',()=>{
 const bank=bankOf(topikIBank());
 const open=()=>{
  const f=coachFixture('world-mock'),plan=selectMock({forms:bank.forms,exam:'topik1',pool:bank.items,seen:item=>f.coach.exposure(item).seen});
  const listening=plan.sections.find(row=>row.section==='listening'),first=listening.items.findIndex(item=>item.setId==='qa-ls1');
  const session=createMockSession({coach:f.coach,exam:'topik1',sections:[listening],clock:()=>Date.parse('2026-10-21T02:00:00Z')});
  session.start();return {f,listening,first,second:first+1,session};
 };
 const deliveries=(f,itemId)=>{const events=f.coach.events(),p=events.filter(event=>event.type==='practice.presented'&&event.measure?.familyKey===`topik-items.${itemId}`).map(event=>event.id);
  return events.filter(event=>event.type==='practice.delivery'&&p.includes(event.presentationId)&&event.audio==='completed').length;};
 // (1) 첫 문항에서 두 번 다 듣고 둘째 문항으로: 이미 들은 대본이라 바로 답하고, 더 듣지 못한다.
 const a=open();
 assert.equal(a.listening.items[a.second].setId,'qa-ls1');
 let view=a.session.go(a.first);
 assert.deepEqual(view.set,{first:a.first+1,last:a.second+1});
 assert.equal(a.session.play(),'first');a.session.delivery('completed');
 assert.equal(a.session.play(),'allowed');a.session.delivery('completed');
 assert.equal(a.session.play(),false,'세트 대본도 허용 두 번까지');
 view=a.session.go(a.second);
 assert.equal(view.heard,true,'같은 세트의 둘째 문항은 이미 들은 대본으로 푼다');assert.deepEqual(view.plays,{allowed:2,completed:2});
 assert.equal(a.session.play(),false,'세트 안에서 옮겨도 재생 셈은 그대로(네 번이 되지 않는다)');
 assert.equal(a.session.answer(view.item.correctId).independent,true,'다 들은 뒤 연 세트 문항의 답도 혼자 낸 첫 답');
 a.session.go(a.first);assert.equal(a.session.answer(a.listening.items[a.first].correctId).independent,true);
 assert.deepEqual([deliveries(a.f,a.listening.items[a.first].id),deliveries(a.f,a.listening.items[a.second].id)],[2,1],'첫 문항은 끝까지 들은 두 번, 둘째 문항은 열 때 이미 들은 대본 한 번');
 // (2) 두 문항을 열어 두고 한 번 들으면 그 재생이 두 문항 모두에 남는다.
 const b=open();
 b.session.go(b.first);b.session.go(b.second);
 assert.equal(b.session.play(),'first');b.session.delivery('completed');
 view=b.session.go(b.first);assert.equal(view.heard,true);assert.deepEqual(view.plays,{allowed:2,completed:1});
 assert.equal(b.session.answer(view.item.correctId).independent,true);
 assert.deepEqual([deliveries(b.f,b.listening.items[b.first].id),deliveries(b.f,b.listening.items[b.second].id)],[1,1]);
 // (3) 세트가 아닌 문항은 문항마다 따로 센다.
 const c=open();
 c.session.go(0);c.session.play();c.session.delivery('completed');
 view=c.session.go(1);assert.equal(view.heard,false);assert.deepEqual(view.plays,{allowed:2,completed:0});assert.equal(view.set,null);
 // (4) Fable 검수 반영: 재생은 시작한 문항의 대본에 남는다 — 듣는 동안 같은 세트의 다른 문항에 답해도(그 문항에서 끝나도) 셈에서 빠지지 않아
 //     세 번째 재생이 「허용 안」으로 열리지 않는다.
 const d=open();
 d.session.go(d.first);d.session.play();d.session.delivery('completed');
 d.session.go(d.second);assert.equal(d.session.play(),'allowed');
 d.session.go(d.first);assert.equal(d.session.answer(d.listening.items[d.first].correctId).independent,true);
 assert.equal(d.session.delivery('completed'),true,'답한 문항을 보고 있을 때 끝난 재생도 센다');
 view=d.session.go(d.second);assert.deepEqual(view.plays,{allowed:2,completed:2});assert.equal(d.session.play(),false,'두 번 들었으면 닫힌다');
 // (5) 다른 문항으로 옮긴 뒤 끝난 첫 재생은 시작한 문항의 대본 셈이다(화면은 영역 안 이동에서 소리를 끊지 않는다 — 처음부터 다시 듣는 길이 없다).
 const e=open();
 e.session.go(0);assert.equal(e.session.play(),'first');e.session.go(1);e.session.delivery('completed');
 assert.equal(e.session.current.heard,false,'보고 있는 다른 문항은 아직 듣지 않았다');
 view=e.session.go(0);assert.equal(view.heard,true);assert.deepEqual(view.plays,{allowed:2,completed:1});
 assert.equal(e.session.play(),'allowed');
});

test('예상 급수 문턱: 시험 형식 연습의 혼자 낸 첫 답만 세고, 30개를 넘어도 범위는 만들지 않는다 · IBT는 따로',()=>{
 const asOf='2026-10-21T09:00:00.000Z';
 const rows=(n,domain,extra={})=>Array.from({length:n},(_,i)=>({eventId:`qa.${domain}.${i}`,at:'2026-10-20T09:00:00.000Z',domain,firstExposure:true,independent:true,timed:true,
  verdict:i%3?'correct':'incorrect',form:'topik-i',composition:'mini-blueprint',mode:'pbt',...extra}));
 const enough=estimateGate({evidence:[...rows(15,'listening'),...rows(15,'reading')],asOf});
 assert.equal(enough.status,'no-estimator');assert.equal(enough.visible,false);assert.equal(enough.range,null);assert.equal(enough.grade,null);assert.equal(enough.passClaim,false);
 assert.equal(enough.evidence,30);
 assert.equal(estimateGate({evidence:[...rows(15,'listening',{form:'topik-ii'}),...rows(15,'reading')],asOf}).evidence,15,'다른 시험의 답은 세지 않는다');
 assert.equal(estimateGate({evidence:rows(15,'reading',{form:'topik-ii'}),asOf,form:'topik-ii'}).evidence,15);
 assert.equal(estimateGate({evidence:rows(10,'reading',{independent:false}),asOf}).evidence,0,'도움·반복은 세지 않는다');
 assert.equal(estimateGate({evidence:rows(10,'reading',{mode:'ibt'}),asOf}).evidence,0,'PBT 판만');
 const ibt=estimateGate({evidence:[...rows(15,'listening'),...rows(15,'reading')],asOf,mode:'ibt'});
 assert.equal(ibt.status,'mode-unsupported');assert.equal(ibt.visible,false);assert.equal(ibt.range,null);
});

test('공개 TOPIK 은행은 문항 묶음의 검수 통과 문항과 같고, 검수 기록·목소리 이름·초안은 싣지 않는다',async()=>{
 const build=await import('../../../tools/build-world-topik-items.mjs');
 assert.ok(build.bankCurrent(),'world-topik-items.json이 낡았다 — node tools/build-world-topik-items.mjs --write');
 const text=readFileSync(new URL('../world-topik-items.json',import.meta.url),'utf8'),bank=JSON.parse(text);
 assert.doesNotMatch(text,/"review"|"reviewStatus"|"voices"|claude|opus|argon|gemini|"draft"|"held"/i);
 const {PUBLISHED}=await import('../../topik-items/bank.mjs');
 const ready=PUBLISHED.filter(item=>item.section!=='listening'||item.audio?.status==='ready');
 assert.deepEqual(bank.items.map(row=>row.id).sort(),ready.map(item=>item.id).sort(),'통과 문항만(듣기는 소리가 준비된 것)');
 assert.ok(bank.items.filter(row=>row.section==='listening').every(row=>row.audio.plays===FORMS[row.exam].types.find(type=>type.id===row.officialType).plays),'허용 재생 수는 공식 유형과 같다');
});
