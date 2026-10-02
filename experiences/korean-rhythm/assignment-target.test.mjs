import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,RoundState} from './core.mjs';
import {rhythmItem,assignmentTracks,assignmentTrack} from './personalization.mjs';
test('each rhythm family routes to its authored song and authorized O/X claim',()=>{
 for(const track of TRACKS)for(let i=0;i<track.questions.length;i++)for(const variant of [0,1]){
  const m=rhythmItem(track.id,{sourceIndex:i,variant}),target={...m,familyKeys:[m.familyKey],itemKeys:[m.itemKey],requiredAttempts:1};
  assert.deepEqual(assignmentTracks(target).map(c=>c.trackId),[track.id]);
  for(let seed=1;seed<8;seed++){
   const round=new RoundState(assignmentTrack(track,target),'easy',seed);
   assert.equal(round.questions.length,5);
   assert.equal(rhythmItem(track.id,round.questions[i]).itemKey,m.itemKey);
   assert.ok(round.questions[i].voiceEnd<round.questions[i].answerOpen);
  }
  assert.equal(assignmentTrack(TRACKS[(track.id+1)%TRACKS.length],target),null);
 }
});
test('rhythm rejects a family with another skill or unsupported format',()=>{
 const m=rhythmItem(0,{sourceIndex:0}),target={...m,familyKeys:[m.familyKey],requiredAttempts:1};
 assert.equal(assignmentTracks({...target,skillId:'ko.listening.condition'}).length,0);
 assert.equal(assignmentTracks({...target,responseFormat:'single-choice'}).length,0);
});
