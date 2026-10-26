'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Flow=require('../atlas/flow');
const now='2026-10-26T00:00:00.000Z';
const logit=p=>Math.log(p/(1-p));
const spec=()=>Flow.defineContent({id:'probe.opening-direction',scale:1,knobs:[
 {id:'level',values:[0,1,2],weight:2,start:0},
 {id:'pace',kind:'pace',values:[0,1,2,3,4,5],start:0},
]});

test('a weight-two prior opening stops after crossing its aim instead of bouncing to the step limit',()=>{
 const run=Flow.start({spec:spec(),now,prior:{content:logit(.75/.9)+1.1}});
 assert.deepEqual(run.intro().opening.map(c=>[c.knob,c.direction]),[['level',1]]);
 assert.equal(run.settings().indices.level,1);
 // The opening rail does not stop evidence from making the next answer easier.
 const response=run.observe({outcome:'fail',pressure:.1});
 assert.equal(response.change?.direction,-1);
});

test('a prior needing three large steps keeps its odd opening instead of returning on the twelfth move',()=>{
 const content=Flow.defineContent({id:'probe.opening-odd',scale:1,knobs:[{id:'level',values:[0,1,2,3,4,5],weight:2,start:0}]});
 const run=Flow.start({spec:content,now,prior:{content:logit(.75)+5.1}});
 const opening=run.intro().opening;
 assert.equal(opening.length,3);
 assert.deepEqual(opening.map(c=>c.direction),[1,1,1]);
 assert.deepEqual(run.settings().indices,{level:3});
});

test('explicit locks and memory opening limits still hold',()=>{
 const content=spec();
 const run=Flow.start({spec:content,now,prior:{content:logit(.75/.9)+1.1},declared:{knobs:{level:0}}});
 assert.equal(run.settings().indices.level,0);
 assert.ok(run.intro().opening.every(c=>c.knob==='pace'));
 const remembered=Flow.start({spec:content,now,memory:run.memory(now)});
 assert.ok(remembered.intro().opening.length<=2);
 assert.ok(remembered.intro().opening.every(c=>c.direction<0));
});
