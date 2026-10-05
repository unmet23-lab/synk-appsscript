import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQuestionPace, gatePosition, rewardBoost, FIRST_GATE, GATE_SPACING,
  QUESTION_LEAD, MIN_REWARD_RUN, BOOST_SECONDS, COMBO_BOOST_SECONDS
} from '../race-pacing.js';

test('a long reading or listening hold preserves the remaining reward and its entry speed',()=>{
  const pace=createQuestionPace();
  let state={velocity:42,boost:rewardBoost(1)};
  state=pace.step({...state,waiting:false,dt:.05});
  const beforeHold={...state};
  for(let frame=0;frame<1200;frame++){
    state=pace.step({...state,waiting:true,dt:.05});
    // The caller brakes the visible car while the question is open.
    state.velocity*=Math.exp(-.05*2.4);
    assert.equal(state.boost,beforeHold.boost);
  }
  assert(state.velocity<.001);
  assert.deepEqual(pace.snapshot(),{holding:true,heldSpeed:42,lastAnswerAt:null});
  state=pace.step({...state,waiting:false,dt:.05});
  assert.equal(state.velocity,42);
  assert(Math.abs(state.boost-(beforeHold.boost-.05))<1e-10);
  assert.equal(pace.snapshot().holding,false);
  // Once released, normal traffic/edge slowdowns must not resurrect the saved speed.
  assert.equal(pace.step({waiting:false,velocity:21,boost:state.boost,dt:.05}).velocity,21);
});

test('each new hold captures its own speed and never reduces a faster release velocity',()=>{
  const pace=createQuestionPace();
  pace.step({waiting:true,velocity:42,boost:2,dt:.05});
  pace.step({waiting:true,velocity:0,boost:2,dt:.05});
  assert.equal(pace.step({waiting:false,velocity:48,boost:2,dt:.05}).velocity,48);
  pace.step({waiting:true,velocity:26,boost:0,dt:.05});
  assert.equal(pace.snapshot().heldSpeed,26);
  assert.deepEqual(pace.step({waiting:false,velocity:0,boost:0,dt:.05}),{velocity:26,boost:0});
});

test('each answer guarantees four seconds before another question can be announced',()=>{
  const pace=createQuestionPace();
  assert.equal(pace.canAnnounce(2.999),false);
  assert.equal(pace.canAnnounce(3),true);
  for(const answeredAt of [12,38.5,67]){
    pace.answered(answeredAt);
    assert.equal(pace.canAnnounce(answeredAt),false);
    assert.equal(pace.canAnnounce(answeredAt+MIN_REWARD_RUN-.001),false);
    assert.equal(pace.canAnnounce(answeredAt+MIN_REWARD_RUN),true);
  }
});

test('reset clears both a held reward speed and the previous race question cooldown',()=>{
  const pace=createQuestionPace();
  pace.answered(80);
  pace.step({waiting:true,velocity:42,boost:3,dt:.05});
  pace.reset();
  assert.deepEqual(pace.snapshot(),{holding:false,heldSpeed:null,lastAnswerAt:null});
  assert.equal(pace.canAnnounce(3),true);
  assert.deepEqual(pace.step({waiting:false,velocity:26,boost:0,dt:.05}),{velocity:26,boost:0});
});

test('five gates provide the reward run at the fastest authored pace and finish before the coastal loop',()=>{
  const roadEnd=2250,loopStart=roadEnd-100,fastestBoost=42*32/26;
  assert.equal(FIRST_GATE,310);
  assert.equal(QUESTION_LEAD,220);
  assert((GATE_SPACING-QUESTION_LEAD)/fastestBoost>=MIN_REWARD_RUN);
  for(let index=0;index<5;index++){
    const position=gatePosition(index);
    assert(position>75&&position<roadEnd);
    if(index)assert.equal(position-gatePosition(index-1),GATE_SPACING);
  }
  // Completion is now at the final gate + 15m; even one maximum-size frame stays inside.
  assert(gatePosition(4)+15+fastestBoost*.055<loopStart);
  assert(BOOST_SECONDS>MIN_REWARD_RUN);
  assert.equal(rewardBoost(1),BOOST_SECONDS);
  assert.equal(rewardBoost(2),BOOST_SECONDS);
  assert.equal(rewardBoost(3),COMBO_BOOST_SECONDS);
  assert(COMBO_BOOST_SECONDS>BOOST_SECONDS);
});

test('a delayed frame cannot consume the whole boost and a negative delta cannot add charge',()=>{
  const pace=createQuestionPace();
  assert.deepEqual(pace.step({waiting:false,velocity:42,boost:2,dt:60}),{velocity:42,boost:1.945});
  assert.deepEqual(pace.step({waiting:false,velocity:42,boost:2,dt:-1}),{velocity:42,boost:2});
  assert.deepEqual(pace.step({waiting:false,velocity:42,boost:.01,dt:.055}),{velocity:42,boost:0});
  assert.deepEqual(pace.step({waiting:true,velocity:42,boost:2,dt:60}),{velocity:42,boost:2});
});
