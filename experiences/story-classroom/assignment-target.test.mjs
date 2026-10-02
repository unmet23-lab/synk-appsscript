import test from 'node:test';
import assert from 'node:assert/strict';
import {EPISODE} from './story.mjs';
import {StoryGame} from './core.mjs';
import {missionMetadata,assignmentMissions} from './learning.mjs';
const all=[...EPISODE.acts.flatMap(a=>a.missions),...EPISODE.review];
test('each assigned story mission begins at its scene without credit for skipped narrative',()=>{
 for(const mission of all){
  const m=missionMetadata(mission),target={...m,familyKeys:[m.familyKey],itemKeys:[m.itemKey],requiredAttempts:1};
  const selected=assignmentMissions(all,target),game=new StoryGame();
  assert.deepEqual(selected.map(m=>m.id),[mission.id]);
  assert.equal(game.startPractice(selected.map(m=>m.id)),true);
  assert.ok(game.missions.some(m=>m.id===mission.id));assert.deepEqual(game.records,[]);assert.deepEqual(game.completedIds,[]);
  while(!['play','review'].includes(game.phase))game.advance();
  for(const id of mission.requires||[]){
   game.selectActor(mission.actor);game.selectObject(mission.object);const premature=game.place(mission.destination);assert.equal(premature.correct,false);
   const preceding=game.missions.find(m=>m.id===id);game.selectActor(preceding.actor);game.selectObject(preceding.object);assert.equal(game.place(preceding.destination).correct,true);
  }
  game.selectActor(mission.actor);game.selectObject(mission.object);assert.equal(game.place(mission.destination).correct,true);
 }
});
test('story refuses missing families and never begins a fabricated scene',()=>{
 const game=new StoryGame();assert.equal(game.startPractice(['foreign']),false);assert.equal(game.phase,'opening');
 const m=missionMetadata(all[0]);assert.deepEqual(assignmentMissions(all,{...m,familyKeys:[m.familyKey],difficulty:3}),[]);
});
