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
// 목표 판은 목표 부탁이 있는 장면만 지나간다(10-03): 사이의 장면과 목표 없는 마지막 복습은 건너뛴다.
const playAct=game=>{while(!['play','review'].includes(game.phase))game.advance();const visited=game.currentAct.id;for(const m of game.missions){game.selectActor(m.actor);game.selectObject(m.object);assert.equal(game.place(m.destination).correct,true);}return visited;};
const finish=game=>{const visited=[];let guard=0;while(game.phase!=='complete'&&guard++<40){if(['play','review'].includes(game.phase))visited.push(playAct(game));else game.advance();}return visited;};
test('an assigned round passes only the scenes that hold its requests',()=>{
 const first=EPISODE.acts[0].missions[0],last=EPISODE.acts[2].missions[0];
 const game=new StoryGame();assert.equal(game.startPractice([first.id,last.id]),true);
 assert.deepEqual(finish(game),[EPISODE.acts[0].id,EPISODE.acts[2].id]);
 assert.equal(game.phase,'complete');assert.equal(game.reviewAhead,false);
 assert.ok(game.records.every(r=>[...EPISODE.acts[0].missions,...EPISODE.acts[2].missions].some(m=>m.id===r.id)),'건너뛴 장면은 기록이 없다');
});
test('an assigned review request keeps the closing review, and a free round keeps every scene',()=>{
 const game=new StoryGame();assert.equal(game.startPractice([EPISODE.acts[1].missions[0].id,EPISODE.review[0].id]),true);
 assert.equal(game.reviewAhead,true);
 assert.deepEqual(finish(game),[EPISODE.acts[1].id,'review']);
 const free=new StoryGame();assert.equal(free.reviewAhead,true);
 assert.deepEqual(finish(free),[...EPISODE.acts.map(a=>a.id),'review']);
});
