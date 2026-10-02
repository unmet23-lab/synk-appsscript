import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerModel,LANES,obstacleHit,driveDemo} from './core.mjs';
import {INSTRUCTIONS} from './instructions.mjs';
import {VOICE_SECONDS} from './voice-timing.mjs';
const tick=(m,s)=>{for(let i=0;i<Math.ceil(s/.01);i++)m.step(.01);};
function isolated(){const m=new RunnerModel({seed:1});m.events=[];m.missions=[];m.generated=10000;m.nextMission=m.nextWave=m.nextCoin=10000;return m;}
function runMission(item){const m=isolated();m.makeMission(40,item);for(let i=0;i<1000&&!m.answers.length;i++){driveDemo(m);m.step(.01);}return m;}
test('physical jumping, crouching and side dodging retain their different collision rules',()=>{
  assert.equal(obstacleHit('barrier',0,1,1.1,false),false);assert.equal(obstacleHit('barrier',0,1,0,true),true);
  assert.equal(obstacleHit('arch',0,1,0,true),false);assert.equal(obstacleHit('arch',0,1,1.2,false),true);
  assert.equal(obstacleHit('tram',0,1,2,false),true);assert.equal(obstacleHit('tram',LANES[0],1,0,false),false);
});
test('all sixteen directions, negations and ordered instructions are physically executable',()=>{
  assert.equal(new Set(INSTRUCTIONS.map(i=>i.id)).size,16);
  for(const item of INSTRUCTIONS){const m=runMission(item);assert.equal(m.correct,1,item.id);assert.equal(m.hearts,3,item.id);assert.equal(m.lanterns,item.steps.length,item.id);assert.ok(m.answers[0].steps.every(s=>s.status==='done'));}
});
test('a request for a specific path is not solved by choosing a written word or an arbitrary path',()=>{
  const m=isolated();m.makeMission(20,INSTRUCTIONS[0]);tick(m,2);assert.equal(m.correct,0);assert.equal(m.hearts,3);
  assert.equal(m.answers[0].steps[0].status,'missed');assert.ok(!('choices' in m.answers[0]));assert.equal(m.reviewQueue.length,1);
});
test('a correctly chosen jump too early is recorded as timing, not an inferred language failure',()=>{
  const m=isolated();m.makeMission(25,INSTRUCTIONS[1]);m.step(.01);m.input('jump');tick(m,2);
  assert.equal(m.answers[0].steps[0].status,'timing');assert.equal(m.answers[0].steps[0].inputMatched,true);assert.equal(m.hearts,2);
});
test('do not jump fails if a jump was made and already landed before the marker',()=>{
  const m=isolated();m.makeMission(25,INSTRUCTIONS[5]);m.step(.01);m.input('jump');tick(m,2);
  assert.equal(m.y,0);assert.equal(m.correct,0);assert.equal(m.answers[0].steps[0].status,'different');assert.equal(m.hearts,3);
});
test('a sequence records each marker separately, and a missing second action cannot clear it',()=>{
  const m=isolated();m.makeMission(20,INSTRUCTIONS[6]);m.input('left');tick(m,4);
  assert.equal(m.answers[0].steps[0].status,'done');assert.equal(m.answers[0].steps[1].status,'missed');assert.equal(m.correct,0);assert.equal(m.lanterns,1);
});
test('three performed requests award wind protection without a speed boost',()=>{
  const m=isolated();for(const d of [10,30,50])m.makeMission(d,INSTRUCTIONS[4]);tick(m,5);
  assert.equal(m.combo,3);assert.equal(m.shield,1);assert.equal(m.speed,13+m.elapsed*.055);assert.ok(!('boost' in m));
});
test('ordinary collisions change survival protection without creating a language record',()=>{
  const m=isolated();m.shield=1;m.events=[{kind:'obstacle',type:'tram',lane:1,d:5,resolved:false}];tick(m,.5);
  assert.equal(m.hearts,3);assert.equal(m.shield,0);assert.equal(m.answers.length,0);
});
test('generated ordinary obstacles do not intrude on instruction response or sequence corridors',()=>{
  for(let seed=1;seed<=100;seed++){
    const m=new RunnerModel({seed});for(let d=0;d<2500;d+=100){m.distance=d;m.generate();}
    for(const e of m.events.filter(e=>e.kind==='obstacle'&&!e.mission))assert.ok(m.missions.every(s=>e.d<=s.d-s.cueDistance||e.d>=s.end+23));
    assert.ok(m.events.every(e=>e.kind!=='gate'));assert.ok(m.events.filter(e=>e.kind==='coin').every(e=>e.lane>=0&&e.lane<=2));
  }
});
test('even at maximum speed, a complete spoken instruction ends before its first action',()=>{
  const m=isolated();
  for(const item of INSTRUCTIONS){const mission=m.makeMission(200,item);assert.ok(mission.cueDistance/19>VOICE_SECONDS[item.id]+1.2,item.id);}
  assert.ok(125/19>Math.max(...Object.values(VOICE_SECONDS))+1.2);
});
test('full ninety-second demonstrations perform sequences without collision on varied courses',()=>{
  for(let seed=1;seed<=10;seed++){const m=new RunnerModel({seed});for(let i=0;i<9100&&!m.finished;i++){driveDemo(m);m.step(.01);}assert.equal(m.reason,'tour');assert.equal(m.hearts,3);assert.equal(m.correct,m.answers.length);assert.ok(m.answers.some(a=>a.steps.length===2));}
});
test('landing, lane bounds and frame spikes remain safe, and endless mode continues',()=>{
  const m=isolated();m.mode='endless';m.step(10);assert.ok(m.distance<1);for(let i=0;i<10;i++)m.input('left');assert.equal(m.lane,0);
  m.input('jump');tick(m,1);assert.equal(m.y,0);for(let i=0;i<10;i++)m.input('right');tick(m,.5);assert.equal(m.lane,2);assert.ok(Math.abs(m.x-LANES[2])<.01);tick(m,92);assert.equal(m.finished,false);
});
