import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoastDrive} from '../coast-drive.js';

test('completion commits once and result visits return to driving without completing again',()=>{
 const d=createCoastDrive();assert.equal(d.complete(4,5),false);assert.equal(d.complete(0,0),false);
 assert.equal(d.complete(5,5),true);assert.equal(d.driving,true);assert.equal(d.complete(5,5),false);
 for(let i=0;i<5;i++){assert(d.openResults());assert.equal(d.driving,false);assert.equal(d.openResults(),false);assert(d.resume());assert.equal(d.complete(5,5),false);}
 d.reset();assert.equal(d.active,false);assert(d.complete(5,5));
});
test('ten minutes of boost-speed driving remain on the authored road and never create a new race',()=>{
 const d=createCoastDrive();d.complete(5,5);let position=1375,wraps=0;
 for(let t=0;t<600;t+=.05){const step=d.advance(position,42,.05,2250);position=step.position;assert(position>=75&&position<2150);assert(step.fade>=0&&step.fade<=1);if(step.wrapped){wraps++;assert(step.fade>.98);}}
 assert(wraps>10);assert.equal(d.snapshot().laps,wraps);assert.equal(d.snapshot().phase,'drive');
});
test('results do not advance, oversized frame deltas are bounded, and reset removes loop state',()=>{
 const d=createCoastDrive();d.complete(5,5);assert(Math.abs(d.advance(1500,42,60,2250).position-1502.31)<1e-8);
 d.openResults();assert.equal(d.advance(1500,42,.05,2250).position,1500);
 d.resume();d.advance(2149,42,.05,2250);d.reset();assert.deepEqual(d.snapshot(),{phase:'race',laps:0});
});
