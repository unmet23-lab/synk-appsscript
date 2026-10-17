import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAPTERS,PUZZLES,SPELLS} from './content.mjs';
import {initialProgress,chapterProgress,nextAwaitingCheck,unlockedChapter,restoreProgress} from './core.mjs';
import {recallRound,recallView} from './recall.mjs';

test('discoveries do not claim listening confirmation or change existing unlocks',()=>{
 const p=initialProgress();p.introduced=['size'];p.completed=PUZZLES.slice(0,6).map(p=>p.id);
 assert.deepEqual(chapterProgress(p,0),{discoveries:6,confirmed:0,missing:['grow','shrink'],finished:false});assert.equal(nextAwaitingCheck(p),0);assert.equal(unlockedChapter(p),1);
 p.checks=[{spell:'grow',correct:false,assessable:true},{spell:'grow',correct:true,assessable:false}];assert.equal(chapterProgress(p,0).confirmed,1);assert.deepEqual(chapterProgress(p,0).missing,['shrink']);
 p.checks.push({spell:'shrink',correct:true,version:1});assert.equal(chapterProgress(restoreProgress(p),0).finished,true);assert.equal(nextAwaitingCheck(p),-1);
});
test('optional recall uses only introduced meanings, never writes the source progress',()=>{
 const p=initialProgress(),before=structuredClone(p);assert.deepEqual(recallRound(p),[]);assert.deepEqual(p,before);
 p.introduced=['size'];const saved=structuredClone(p),round=recallRound(p,()=>.3);assert.equal(round.length,2);assert.deepEqual(round.map(q=>q.spell).sort(),['grow','shrink']);assert.ok(round.every(q=>q.object.asset==='bear'));assert.deepEqual(p,saved);
});
test('recall prefers a previous miss but cannot introduce an unknown chapter',()=>{
 const p=initialProgress();p.introduced=['size','doors'];p.checks=[{spell:'close',correct:false},{spell:'up',correct:false}];let n=0;const round=recallRound(p,()=>++n/20);
 assert.equal(round.length,3);assert.equal(round[0].spell,'close');assert.ok(round.every(q=>['grow','shrink','open','close'].includes(q.spell)));assert.ok(!round.some(q=>q.spell==='up'));
});
test('two alternative pictures contain no target, spelling or meaning cue before first answer',()=>{
 const p=initialProgress();p.introduced=CHAPTERS.map(c=>c.id);const all=[];for(let i=0;i<12;i++)all.push(...recallRound(p,()=>i/12));
 for(const q of all){const before=recallView(q),opposite={...q,spell:CHAPTERS[q.chapter].pair.find(s=>s!==q.spell)};assert.deepEqual(before,recallView(opposite));assert.deepEqual(before.objects,[]);assert.ok(before.choices.every(c=>c.korean===null&&c.meaning===null));assert.ok(before.choices.every(c=>c.objects[0].asset===q.object.asset));assert.notDeepEqual(before.choices[0].objects,before.choices[1].objects);const after=recallView(q,{answered:true,objects:before.choices.find(c=>c.id===q.spell).objects});assert.equal(after.reveal,true);assert.ok(after.choices.every(c=>c.korean===SPELLS[c.id].ko&&c.meaning===SPELLS[c.id].en));}
});
test('recall choices remain fixed across replays and use fresh objects for each chapter',()=>{
 for(const [i,c]of CHAPTERS.entries()){const p=initialProgress();p.introduced=[c.id];const round=recallRound(p,()=>.1);assert.equal(round.length,2);assert.ok(round.every(q=>q.object.asset===['bear','book','camera'][i]));for(const q of round)assert.deepEqual(recallView(q),recallView(q));}
});
