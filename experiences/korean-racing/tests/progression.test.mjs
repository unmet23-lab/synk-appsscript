import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CAMPAIGN,CHAPTERS,campaignUnlocked,recommendedStage,medalFor} from '../campaign.js';
import {makeQuestions,emptyProgress,recordRound,loadProgress,reviewStage,STAGES} from '../learning.js';
import {resolveContact,CAR_HALF_WIDTH,CAR_HALF_LENGTH} from '../driving.js';
const answers=(s,score=5)=>makeQuestions(s,()=>.43).map((q,i)=>({...q,correct:i<score}));
test('six levels progress from short sentences to two-condition reading, with complete spoken feedback',async()=>{
 assert.equal(CHAPTERS.length,6);assert.equal(CAMPAIGN.length,12);
 const manifest=JSON.parse(await fs.readFile(new URL('../assets/narration/challenge-manifest.json',import.meta.url),'utf8'));
 const clips=Object.fromEntries(manifest.clips.map(c=>[c.id,c]));const ids=new Set();
 for(const s of CAMPAIGN){assert.equal(s.items.length,5);for(const q of makeQuestions(s)){
   assert(!ids.has(q.id));ids.add(q.id);assert(q.passage&&q.explanation);assert.equal(q.options.length,3);assert.equal(new Set(q.choices.map(c=>c.word)).size,3);assert(q.options.includes(q.answer));
   for(const id of [...q.audio,...q.answerAudio]){assert(clips[id].duration>.1);assert(clips[id].rms>50);assert.equal((await fs.stat(new URL(`../assets/narration/${id}.mp3`,import.meta.url))).size,clips[id].bytes);}
 }}assert.equal(ids.size,60);assert(CAMPAIGN.at(-1).items[0].passage.length>CAMPAIGN[0].items[0].passage.length);
});
test('unlock uses learning accuracy and never racing rank or collisions; demos cannot earn medals',()=>{
 const p=emptyProgress(),s=CAMPAIGN[0];assert(campaignUnlocked(p,s));assert(!campaignUnlocked(p,CAMPAIGN[1]));
 const weak=recordRound(p,s,answers(s,3));assert(!campaignUnlocked(weak,CAMPAIGN[1]));
 const cleared=recordRound(p,s,answers(s,4),{collisions:12});assert(campaignUnlocked(cleared,CAMPAIGN[1]));assert.equal(cleared.cleanRuns,0);assert.equal(recommendedStage(cleared).id,CAMPAIGN[1].id);
 assert.deepEqual(recordRound(p,s,answers(s),{automatic:true}),p);assert.equal(medalFor(5),3);assert.equal(medalFor(4),2);
 assert.equal(recordRound(p,s,answers(s).slice(0,4)).stages[s.id],undefined,'an unfinished round cannot unlock a course');
});
test('word progress survives expansion; challenge errors can be reviewed without inventing course completion',()=>{
 const old=recordRound(emptyProgress(),STAGES[0],answers(STAGES[0]));delete old.challenges;delete old.cleanRuns;
 const migrated=loadProgress({getItem:()=>JSON.stringify(old)});assert(migrated.stages[STAGES[0].id].cleared);assert.deepEqual(migrated.challenges,{});
 const p=recordRound(migrated,CAMPAIGN[0],answers(CAMPAIGN[0],4),{now:123});
 const restored=loadProgress({getItem:()=>JSON.stringify(p)});assert.deepEqual(restored,p);
 const review=reviewStage(restored,'campaign');assert(review.campaign);assert.equal(review.items[0].id,CAMPAIGN[0].items[4].id);
 const after=recordRound(p,review,answers(review));assert.equal(after.stages['challenge-review'],undefined);assert.equal(after.challenges[review.items[0].id].lastCorrect,true);
});
test('cars separate on side and rear contact and cannot pass through an occupied lane',()=>{
 for(const [dx,dz] of [[.4,0],[0,-2],[0,2],[.1,.1],[1.4,2]]){
   const player={offset:dx,s:100+dz,velocity:40},rival={offset:0,s:100,speed:26};assert(resolveContact(player,rival));
   assert(Math.abs(player.offset-rival.offset)>=2*CAR_HALF_WIDTH||Math.abs(player.s-rival.s)>=2*CAR_HALF_LENGTH);
 }
 const adjacent={offset:3.45,s:100,velocity:26};assert.equal(resolveContact(adjacent,{offset:0,s:100,speed:26}),null);
 const edge={offset:5,s:100,velocity:30},r={offset:4.2,s:100,speed:26};resolveContact(edge,r);assert(edge.offset<=5.05);assert(Math.abs(edge.offset-r.offset)>=2*CAR_HALF_WIDTH);
});
