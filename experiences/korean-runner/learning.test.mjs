import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerModel} from './core.mjs';
import {INSTRUCTIONS} from './instructions.mjs';
import {instructionMetadata,chooseInstruction,actionEvidence} from './learning.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createGame}=require('../../atlas/game-learning.js'),{createMap}=require('../../strata/index.js');
const map=createMap(require('../../strata/maps/topik-i.json'));

test('a selected negation instruction changes course generation without replacing action gameplay',()=>{
 const coach={recommend:candidates=>({selected:candidates.find(c=>c.skillIds.includes('ko.listening.negation'))||candidates[0]})};
 const model=new RunnerModel({seed:1,chooseInstruction:items=>chooseInstruction(coach,items).selected});
 assert.equal(model.missions[0].id,'no-jump');
 assert.ok(model.missions[0].steps.every(s=>s.action==='stay'));
 assert.equal(new Set(model.missions.map(m=>m.id)).size,model.missions.length);
});

test('visual success and a correctly intended action with bad timing are both unassessed',()=>{
 assert.deepEqual(actionEvidence({steps:[{status:'done'}]},true),{correct:true,assessable:false,reason:'visual'});
 assert.deepEqual(actionEvidence({steps:[{status:'timing'}]},false),{correct:false,assessable:false,reason:'motor'});
});

test('all sixteen instructions carry stable listening content IDs and confounding flags',()=>{
 const metadata=INSTRUCTIONS.map(instructionMetadata);
 assert.equal(new Set(metadata.map(m=>m.itemKey)).size,INSTRUCTIONS.length);
 assert.ok(metadata.every(m=>m.confounded&&m.audioRequired&&m.modality==='listening'&&m.responseFormat==='action'));
 assert.equal(instructionMetadata(INSTRUCTIONS.find(i=>i.id==='left-jump')).skillId,'ko.listening.sequence');
});

test('the real shared engine keeps an executed visual action out of language scores',()=>{
 const data=new Map(),coach=createGame({gameId:'korean-runner',map,storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
 const pid=coach.present(instructionMetadata(INSTRUCTIONS[0]));coach.delivery(pid,{audio:'completed'});
 const result=coach.answer(pid,actionEvidence({steps:[{status:'done'}]},true));
 assert.equal(result.verdict,'unassessed');assert.equal(result.independent,false);assert.equal(coach.summary().independent,0);
});
