import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,LEVELS,RoundState} from './core.mjs?v=20261002-flow';
import {FLOW_RHYTHM,timingObservation,timingSummary} from './personalization.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createGame}=require('../../atlas/game-learning.js'),{createMap}=require('../../strata/index.js');
const map=createMap(require('../../strata/maps/topik-i.json'));
const coach=()=>{const data=new Map();let t=Date.parse('2026-10-02T09:00:00.000Z');return createGame({gameId:'korean-rhythm',map,storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},clock:()=>new Date(t+=500).toISOString()});};

test('timing windows scale for one round without touching the shared level table',()=>{
 const before=JSON.stringify(LEVELS),round=new RoundState(TRACKS[0],'normal',1);
 round.scaleTiming(1.35);
 assert.ok(Math.abs(round.level.window-LEVELS.normal.window*1.35)<1e-9);
 assert.equal(JSON.stringify(LEVELS),before);
 assert.equal(round.scaleTiming(9),1.5,'bounded');
});

test('beats become challenge observations; listening answers do not',()=>{
 assert.deepEqual(timingObservation({type:'miss'}),{outcome:'timeout'});
 assert.equal(timingObservation({type:'hold-break',quality:0}),null,'a held note let go early is not about the window');
 assert.equal(timingObservation({type:'tap',quality:1}).pressure,.3);
 assert.equal(timingObservation({type:'tap',quality:.5}).pressure,.9);
 assert.equal(timingObservation({type:'question',quality:1}),null);
 assert.equal(timingObservation(null),null);
});

test('missed beats widen the window; clean perfect beats narrow it; fixed keeps the level',()=>{
 const missing=coach().live(FLOW_RHYTHM),clean=coach().live(FLOW_RHYTHM),fixed=coach().live(FLOW_RHYTHM,{declared:{mode:'fixed'}});
 for(let i=0;i<12;i++){missing.observe(i%2?{outcome:'timeout'}:{outcome:'success',pressure:.9});clean.observe({outcome:'success',pressure:.3});fixed.observe({outcome:'timeout'});}
 assert.ok(missing.settings().values.window>1,'more forgiving for the person who misses beats');
 assert.ok(clean.settings().values.window<1,'tighter for the person who is always on the beat');
 assert.equal(fixed.settings().values.window,1);
 assert.match(timingSummary(1,missing.settings().values.window),/넓혀/);
 assert.match(timingSummary(1,1),/바꾸지 않았어요/);
});
