const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRestorationState, applyRestorationAction, restorationReady, traceCircuit, buildEnding } = require('./story.cjs');
const turn = (s,index,rotation) => applyRestorationAction(s,'restore',{kind:'power',index,rotation},{role:'signal'});
const tune = (s,frequency) => applyRestorationAction(s,'restore',{kind:'radio',frequency},{role:'archive'});
test('회로는 실제 연속된 경로 하나에서만 통전된다',()=>{
  const solutions=[];for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let c=0;c<4;c++)if(traceCircuit([a,b,c]).solved)solutions.push([a,b,c]);
  assert.deepEqual(solutions,[[3,1,2]]);assert.equal(traceCircuit([3,0,0]).blockedAt,1);assert.deepEqual(traceCircuit([3,1,0]).trace,[0,1]);
});
test('양쪽 복원을 임의 순서로 마치며 공유 버튼 수집은 필요 없다',()=>{
  for(const radioFirst of [false,true]){const s=createRestorationState();if(radioFirst)tune(s,96.4);turn(s,2,2);turn(s,0,3);assert.equal(restorationReady(s),false);turn(s,1,1);if(!radioFirst)tune(s,96.4);assert.equal(restorationReady(s),true);assert.deepEqual(s.order.map(e=>e.kind),radioFirst?['radio','power']:['power','radio']);}
});
test('수신 성공 전에는 실제 방송을 누설하지 않는다',()=>{
  const s=createRestorationState();tune(s,96.3);assert.equal(s.radio.solved,false);assert.equal(s.radio.broadcast,undefined);assert(s.radio.signal>90);tune(s,96.4);assert(s.radio.broadcast.includes('승객은 모두 안전'));tune(s,99);assert.equal(s.radio.frequency,96.4);assert.equal(s.order.length,1);
});
test('동시 연결부 수정과 재시도는 완료 기록을 중복하지 않는다',()=>{
  const s=createRestorationState();turn(s,1,1);turn(s,2,2);turn(s,0,3);turn(s,0,0);assert.deepEqual(s.power.rotations,[3,1,2]);assert.equal(s.order.length,1);
});
test('잘못된 장비 입력과 빈 문장은 상태를 바꾸지 않는다',()=>{
  const s=createRestorationState(),before=JSON.stringify(s);for(const payload of [{kind:'power',index:-1,rotation:2},{kind:'power',index:0,rotation:4},{kind:'radio',frequency:96.41},{kind:'radio',frequency:Infinity}])assert.throws(()=>applyRestorationAction(s,'restore',payload),e=>e.status===400);assert.equal(JSON.stringify(s),before);assert.throws(()=>applyRestorationAction(s,'mark',{text:' '},{role:'signal'}));
});
test('결말은 복원 순서를 보존하고 각 역할의 문장은 수정 가능하다',()=>{
  const s=createRestorationState();tune(s,96.4);turn(s,0,3);turn(s,1,1);turn(s,2,2);applyRestorationAction(s,'mark',{text:'먼저 길을 열자.'},{role:'signal'});applyRestorationAction(s,'mark',{text:'아침에는 남은 창을 찾아가자.'},{role:'signal'});assert.equal(s.marks.length,1);for(const id of ['lighthouse','station','homes']){const e=buildEnding(id,s);assert.equal(e.chronicle[0].role,'archive');assert.equal(e.choiceId,id);assert(e.body.length>100);}
});
