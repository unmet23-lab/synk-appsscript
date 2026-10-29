import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {worldLearning} from '../world-learning-map.mjs';
import {bankItems} from '../world-topik-items.mjs';
import {createDiagnosticSession} from '../world-position.mjs';
import * as town from '../world-town-check.mjs';

// 싱크타운 「마을 준비 확인」의 화면 쪽 계산(world-town-check.mjs) — 학습·개인화 다리 설계 §4-2·§4-3.
const bank=bankItems(JSON.parse(fs.readFileSync(new URL('../world-topik-items.json',import.meta.url),'utf8')));
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
let tick=Date.parse('2026-10-22T01:00:00Z');
const coach=()=>worldLearning.engine.createGame({gameId:'world-home',storage:memory(),clock:()=>new Date(tick+=1000).toISOString()});
const seenBy=c=>item=>{try{return c.exposure(item).seen;}catch{return null;}};
const byKey=new Map(bank.map(item=>[item.itemKey,item]));
// 진단과 같은 판으로 문항을 풀어 실제 Trail 사건을 남긴다. answers: 맞음(true)·틀림(false)을 문항 차례대로.
function solve(c,items,answers){
 const session=createDiagnosticSession({coach:c,items});
 for(const correct of answers){const now=session.next();if(!now)break;if(now.item.modality==='listening')session.delivery('completed');
  session.answer(correct?now.item.correctId:now.item.choices.find(choice=>choice.id!==now.item.correctId).id);}
 return session.results();
}
const pick=(exam,modality,count,offset=0)=>bank.filter(item=>item.exam===exam&&item.modality===modality).slice(offset,offset+count);

test('전송 한도는 답과 철회를 한 묶음으로 다뤄 제외된 답으로 수준을 올리지 않는다',()=>{
 const c=coach(),items=bank.filter(i=>i.exam==='topik-i'&&i.modality==='reading'&&i.difficulty>=2).slice(0,3);
 assert.equal(items.length,3);solve(c,items,[true,true,true]);
 const events=c.events(),presented=events.filter(e=>e.type==='practice.presented'),first=events.find(e=>e.type==='practice.attempted'&&e.presentationId===presented[2].id);
 for(let attemptNo=2;attemptNo<=195;attemptNo++)events.push({...first,id:`synthetic-repeat-${attemptNo}`,attemptNo});
 events.push({schema:first.schema,id:'synthetic-withdrawal',type:'record.excluded',scope:first.scope,at:first.at,recordedAt:first.recordedAt,targetId:first.id});
 assert.equal(town.placeTownLevels({events,evidenceComplete:true,now:tick+1000}).reading,'L1','the complete withdrawn history is the reference');
 const sent=town.townCheckAnswers({events,items:byKey,now:tick+1000});
 assert.ok(sent.length<=town.TOWN_CHECK_POLICY.maxEvents);
 assert.ok(!sent.some(e=>e.id===first.id)||sent.some(e=>e.type==='record.excluded'&&e.targetId===first.id));
 assert.equal(town.placeTownLevels({events:sent,evidenceComplete:true,now:tick+1000}).reading,'L1');
});

test('준비 확인 문항: 모자란 영역만, 보기 넷 TOPIK I 은행 문항에서, 능력마다 처음 보는 계열 하나씩(읽기 6·듣기 4)',()=>{
 const c=coach(),summary=c.summary(),seen=seenBy(c);
 const both=town.selectTownCheck({summary,items:bank,seen,audioAvailable:true,missing:['reading','listening']});
 assert.equal(both.status,'ready');
 const reading=both.items.filter(item=>item.modality==='reading'),listening=both.items.filter(item=>item.modality==='listening');
 assert.equal(reading.length,6);assert.equal(listening.length,4);
 assert.ok(both.items.every(item=>item.exam==='topik-i'&&item.choices.length>=4));
 assert.equal(new Set(reading.map(item=>item.skillId)).size,6,'one fresh family per reading ability');
 assert.equal(new Set(listening.map(item=>item.skillId)).size,4);
 assert.equal(new Set(both.items.map(item=>item.familyKey)).size,10);
 const only=town.selectTownCheck({summary,items:bank,seen,audioAvailable:true,missing:['listening']});
 assert.deepEqual(only.items.map(item=>item.modality),['listening','listening','listening','listening']);
 // 은행 밖 문항(보기 셋 타운 읽기 확인처럼 시험 꼴이 아닌 것)은 내지 않는다.
 const three={...reading[0],id:'x',itemKey:'synk-town.reading-check.x.v1',familyKey:'synk-town.reading-check.x.v1',exam:undefined,choices:reading[0].choices.slice(0,3)};
 assert.ok(!town.selectTownCheck({summary,items:[three,...bank],seen,missing:['reading']}).items.includes(three));
});

test('아직 혼자 해내지 않은 능력이 먼저 — 혼자 해낸 읽기 능력은 여섯에서 뒤로 빠진다',()=>{
 const c=coach(),real=c.summary(),first=real.skills.find(skill=>/^ko\.reading\./.test(skill.id));
 const summary={...real,skills:real.skills.map(skill=>skill.id===first.id?{...skill,status:'recent-independent'}:skill)};
 const plan=town.selectTownCheck({summary,items:bank,seen:seenBy(c),missing:['reading']});
 assert.equal(plan.items.length,6);assert.ok(!plan.items.some(item=>item.skillId===first.id));
});

test('소리를 쓰지 않으면 읽기 10문항 — 모자란 둘은 능력 지도 순서대로 둘째 계열(같은 계열·세트 없이)',()=>{
 const c=coach(),summary=c.summary();
 const plan=town.selectTownCheck({summary,items:bank,seen:seenBy(c),audioAvailable:false,missing:['reading']});
 assert.equal(plan.items.length,10);assert.ok(plan.items.every(item=>item.modality==='reading'));
 assert.equal(new Set(plan.items.map(item=>item.familyKey)).size,10);
 const sets=plan.items.map(item=>item.setId).filter(Boolean);assert.equal(new Set(sets).size,sets.length);
 const order=summary.skills.filter(skill=>/^ko\.reading\./.test(skill.id)).map(skill=>skill.id);
 const twice=order.filter(id=>plan.items.filter(item=>item.skillId===id).length===2);
 assert.equal(twice.length,2);
 const withSecond=order.filter(id=>bank.filter(item=>item.skillId===id&&item.exam==='topik-i').length>=2);
 assert.deepEqual(twice,withSecond.slice(0,2),'the second families follow the ability map order');
 assert.equal(town.selectTownCheck({summary,items:bank,seen:seenBy(c),audioAvailable:false,missing:['reading']}).items.map(item=>item.id).join(),plan.items.map(item=>item.id).join(),'the same input picks the same items');
});

test('기록이 덜 왔으면 열지 않는다(처음 보는 문항을 약속할 수 없다)',()=>{
 const c=coach(),summary={...c.summary(),evidenceComplete:false};
 const plan=town.selectTownCheck({summary,items:bank,seen:seenBy(c)});
 assert.equal(plan.status,'unavailable');assert.equal(plan.reason,'history.incomplete');assert.deepEqual(plan.items,[]);
});

test('그때 한 번 보내는 답: 아는 보기 넷 문항의 첫 답과 그 제시·소리·빼기 사건만, 결정 기록·글 없이, 영역별 상한까지',()=>{
 const c=coach();
 solve(c,[...pick('topik-i','reading',3),...pick('topik-i','listening',2)],[true,false,true,true,true]);
 const events=c.events(),sent=town.townCheckAnswers({events,items:byKey,now:tick+1000});
 const types=new Set(sent.map(event=>event.type));
 assert.ok(!types.has('decision.made')&&!types.has('experience.completed'),'no decision records travel');
 assert.equal(sent.filter(event=>event.type==='practice.attempted').length,5);
 assert.equal(sent.filter(event=>event.type==='practice.delivery').length,2,'listening deliveries travel with their answers');
 assert.ok(sent.every(event=>event.scope.subject==='device'&&event.scope.workspace==='learning'));
 assert.ok(sent.filter(event=>event.type==='practice.attempted').every(event=>event.choice?.selectedId&&event.choice?.correctId));
 // 모르는 문항(사본에 없는 문항)은 보내지 않는다.
 assert.equal(town.townCheckAnswers({events,items:new Map(),now:tick+1000}).length,0);
 // 90일 지난 답은 보내지 않는다.
 assert.equal(town.townCheckAnswers({events,items:byKey,now:tick+91*86400000}).length,0);
 // 상한: TOPIK I 읽기는 가장 최근 14개까지.
 const heavy=coach();solve(heavy,pick('topik-i','reading',20,10),Array(20).fill(true));
 const many=town.townCheckAnswers({events:heavy.events(),items:byKey,now:tick+1000});
 assert.equal(many.filter(event=>event.type==='practice.attempted').length,town.TOWN_CHECK_POLICY.send.reading);
 assert.ok(JSON.stringify(many).length<96000,'the body stays under the server limit');
});

test('첫 장면 수준 제안 — TOPIK II 3개 이상 2/3이면 L3, 난도 2까지면 L4, TOPIK I 난도 2 또는 6개 중 5면 L2, 나머지 L1',()=>{
 const flat=coach();
 assert.deepEqual(town.placeTownLevels({events:flat.events(),evidenceComplete:true,now:tick}),{reading:'L1',listening:'L1',basis:'first-answers'});
 assert.equal(town.placeTownLevels({events:flat.events(),evidenceComplete:false}).basis,'history.incomplete');
 const two=coach(),lower=bank.filter(item=>item.exam==='topik-ii'&&item.modality==='reading'&&item.difficulty===1).slice(0,3);
 solve(two,lower,[true,true,false]);
 assert.equal(town.placeTownLevels({events:two.events(),evidenceComplete:true,now:tick+1000}).reading,'L3');
 const higher=bank.filter(item=>item.exam==='topik-ii'&&item.modality==='reading'&&item.difficulty>=2).slice(0,3);
 solve(two,higher,[true,true,true]);
 const four=town.placeTownLevels({events:two.events(),evidenceComplete:true,now:tick+1000});
 assert.equal(four.reading,'L4');assert.equal(four.listening,'L1','each channel is placed on its own answers');
 const one=coach();solve(one,pick('topik-i','reading',6,30),[true,true,true,true,true,false]);
 assert.equal(town.placeTownLevels({events:one.events(),evidenceComplete:true,now:tick+1000}).reading,'L2');
 // 난도 1만 6개 중 4개 맞힘(5/6 미만) → L1. 난도 2 이상 3개 중 2개 맞힘 → L2.
 const easy=bank.filter(item=>item.exam==='topik-i'&&item.modality==='reading'&&item.difficulty===1),hard=bank.filter(item=>item.exam==='topik-i'&&item.modality==='reading'&&item.difficulty>=2);
 assert.ok(easy.length>=46&&hard.length>=3);
 const weak=coach();solve(weak,easy.slice(40,46),[true,true,true,true,false,false]);
 assert.equal(town.placeTownLevels({events:weak.events(),evidenceComplete:true,now:tick+1000}).reading,'L1');
 const step=coach();solve(step,hard.slice(0,3),[true,true,false]);
 assert.equal(town.placeTownLevels({events:step.events(),evidenceComplete:true,now:tick+1000}).reading,'L2');
});

test('마스코트 질문: 고른 값이 없고 L1보다 높은 자리가 있을 때만 묻고, 「더 쉬운 말로」는 두 자리 모두 한 단계 아래(L1 아래 없음)',()=>{
 assert.equal(town.placementAsk({suggested:{reading:'L1',listening:'L1'},chosen:null}),false);
 assert.equal(town.placementAsk({suggested:{reading:'L3',listening:'L1'},chosen:null}),true);
 assert.equal(town.placementAsk({suggested:{reading:'L3',listening:'L1'},chosen:{reading:'L2',listening:'L1'}}),false);
 assert.deepEqual(town.placementChoice({reading:'L3',listening:'L1'},'keep'),{reading:'L3',listening:'L1'});
 assert.deepEqual(town.placementChoice({reading:'L3',listening:'L1'},'easier'),{reading:'L2',listening:'L1'});
 assert.throws(()=>town.placementChoice({reading:'L3',listening:'L1'},'harder'),TypeError);
 assert.deepEqual(town.PLACEMENT_COPY,{ask:'처음 이야기는 이 말로 해 볼까요?',keep:'이대로',easier:'더 쉬운 말로'});
});

test('끝 화면 갈래: 이용권만 없으면 미통과가 아니고(access), 보류·미룸·끊김은 제 갈래로 모자람보다 먼저, 새 문항이 모자랐으면 아직 대신 short',()=>{
 const o=(result,short=false)=>town.townOutcome({result,short});
 assert.equal(o({allowed:true,outcome:'passed'}),'passed');
 assert.equal(o({allowed:false,reason:'access',outcome:'passed',missing:[]}),'access','passed the check but no trial or pass');
 assert.equal(o({allowed:false,reason:'access',outcome:'passed'},true),'access');
 for(const outcome of ['deferred','held','later'])assert.equal(o({allowed:false,reason:'learning-check',outcome},true),outcome,'held and deferred are not a network hiccup (Fable F4)');
 assert.equal(o({allowed:false,reason:'learning-check',outcome:'not-yet',missing:['reading']}),'not-yet');
 assert.equal(o({allowed:false,reason:'learning-check',outcome:'not-yet',missing:['reading']},true),'short','fewer fresh items than the window and still not yet');
 assert.equal(o(null),'not-yet');
});
