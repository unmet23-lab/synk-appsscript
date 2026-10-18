import test from 'node:test';
import assert from 'node:assert/strict';
import {collectPractice,practiceStatus} from './practice.mjs';
import {initialProgress,restoreProgress,restoreResume,checkpointRound} from './core.mjs';
test('practice requires heard changes, distinct word/object pairs, two words and two objects',()=>{
 let a=[];const add=x=>a=collectPractice(a,{spell:'grow',objectId:'rabbit',heard:true,changed:true,...x});
 add({heard:false});add({changed:false});assert.equal(a.length,0);add({});add({});assert.equal(a.length,1);
 add({objectId:'book'});add({objectId:'chest'});assert.equal(practiceStatus(a).ready,false);
 add({spell:'shrink'});assert.equal(practiceStatus(a).ready,true);assert.equal(a[0].objectId,'default:rabbit');
 let b=[];for(const spell of ['grow','shrink','up'])b=collectPractice(b,{spell,objectId:'bear',heard:true,changed:true});assert.equal(practiceStatus(b).ready,false);
});
test('sets preserve separate transforms and migrate old default scenes without foreign objects',()=>{
 const old=initialProgress();delete old.labs;old.lab.find(o=>o.id==='rabbit').size=1.55;
 const p=restoreProgress(old);assert.equal(p.labs.default[0].size,1.55);assert.equal(p.labs.picnic[0].asset,'bear');
 p.introduced=['size'];p.labSet='picnic';p.labs.picnic[0].size=.62;p.labs.picnic[1].asset='foreign';p.labs.picnic[1].x=99999;
 const restored=restoreProgress(p),resume=restoreResume({screen:'lab',sceneIndex:0,labSet:'picnic'},restored);
 assert.equal(restored.labs.default[0].size,1.55);assert.equal(resume.objects[0].size,.62);assert.equal(resume.objects[1].asset,'swim-ring');assert.notEqual(resume.objects[1].x,99999);assert.equal(restored.practiceActions,undefined);
});
test('an unfinished adventure remains independent from the lab and never restores heard evidence',()=>{
 const p=initialProgress();p.introduced=['size'];const round=checkpointRound(0,()=>.1),check=round[0];
 p.resume={screen:'lab',sceneIndex:0,labSet:'default'};p.adventureResume={screen:'checkpoint',sceneIndex:0,checkRound:round,checkIndex:0,attempt:1,spell:'grow',heard:true,objects:[{...check.object,size:1.55,asset:'foreign'}]};
 const safe=restoreProgress(p);assert.equal(safe.resume.screen,'lab');assert.equal(safe.adventureResume.screen,'checkpoint');assert.equal(safe.adventureResume.attempt,1);assert.equal(safe.adventureResume.objects[0].asset,check.object.asset);assert.equal(safe.adventureResume.heard,undefined);
 p.adventureResume={screen:'lab',sceneIndex:0};assert.equal(restoreProgress(p).adventureResume,null);
});
