import test from 'node:test';
import assert from 'node:assert/strict';
import { createListeningSequence, LISTENING_CLIP_IDS, LISTENING_VARIANTS } from '../interview/film/listening-sequence.mjs';
let serial = 0;
const item = id => LISTENING_VARIANTS.find(v => v.id === id);
function answer(s,source,limit,tail) {
 s.reset(source);
 let at=tail;
 let id=s.next({sourceClipId:source,remainingMs:limit*1000,currentRemainingMs:tail*1000});
 const shown=[];
 while (at<limit) {
  const clip=item(id); shown.push({id,at,duration:clip.durationSeconds,note:clip.note});
  s.observe({id,playbackId:++serial});
  id=s.next({sourceClipId:id,remainingMs:(limit-at)*1000,currentRemainingMs:clip.durationSeconds*1000});
  at+=clip.durationSeconds;
 }
 return shown;
}
test('full 30/25-second answers place quiet observation before one distinct added note each',()=>{
 const s=createListeningSequence();
 const first=answer(s,'strict-question',30,6.48);
 const second=answer(s,'strict-followup-experience',25,4.59);
 assert.equal(first[0].note,false); assert.equal(first[1].note,false);
 assert.equal(second[0].note,false); assert.equal(second[1].note,false);
 const firstNotes=first.filter(c=>c.note), secondNotes=second.filter(c=>c.note);
 assert.deepEqual(firstNotes.map(c=>c.id),['strict-listening']);
 assert.deepEqual(secondNotes.map(c=>c.id),['strict-listen-question-tail']);
 assert.ok(firstNotes[0].at>=6.48+4.5);
 assert.ok(!first.some(c=>c.id==='strict-listen-question-tail'));
 for(const [clips,limit] of [[first,30],[second,25]]) {
  for(let i=1;i<clips.length;i++) assert.notEqual(clips[i].id,clips[i-1].id);
  for(const c of clips.filter(c=>c.note)) assert.ok(c.at+c.duration<=limit,'writing finishes within answer budget');
 }
});
test('plan followup also uses different notes and does not immediately replay its silent tail',()=>{
 const s=createListeningSequence(); answer(s,'strict-question',30,6.48);
 const shown=answer(s,'strict-followup-plan',25,5.68);
 assert.equal(shown[0].id,'strict-listen-experience-tail');
 assert.deepEqual(shown.filter(c=>c.note).map(c=>c.id),['strict-listen-question-tail']);
});
test('short or nearly completed answers do not start a ten-second writing action',()=>{
 const s=createListeningSequence(); s.reset('strict-question');
 s.observe({id:'strict-listen-plan-tail',playbackId:++serial});
 s.observe({id:'strict-listen-experience-tail',playbackId:++serial});
 for(const remainingMs of [0,2000,8000,12000]) {
  const id=s.next({sourceClipId:'strict-listen-experience-tail',remainingMs,currentRemainingMs:2250});
  assert.equal(item(id).note,false);
 }
});
test('preloaded or cancelled choices are not counted as observed and duplicate playing events are ignored',()=>{
 const s=createListeningSequence();s.reset('strict-question');
 const id=s.next(); const before=s.snapshot();
 assert.equal(s.next(),id);assert.deepEqual(s.snapshot(),before);
 const record={id,playbackId:++serial};s.observe(record);s.observe(record);
 assert.equal(s.snapshot().history.length,1);
 assert.equal(s.snapshot().quietSeconds,item(id).durationSeconds);
});
test('answer reset retains session note history while a new interview clears it and immutable snapshots stay isolated',()=>{
 const s=createListeningSequence();answer(s,'strict-question',30,6.48);
 const lastNote=s.snapshot().lastNoteId;s.reset('strict-followup-plan');
 assert.equal(s.snapshot().lastNoteId,lastNote);assert.equal(s.snapshot().notePlayed,false);
 assert.throws(()=>s.snapshot().history.pop(),TypeError);
 s.resetSession();assert.equal(s.snapshot().lastNoteId,null);assert.equal(s.snapshot().history.length,0);
});
test('quiet-only, legacy one-clip and unavailable-media manifests remain bounded to real media',()=>{
 for(const ids of [['strict-listen-plan-tail'],['strict-listening'],['strict-listen-plan-tail','strict-listen-experience-tail']]){
  const s=createListeningSequence({availableClipIds:ids});s.reset('strict-question');
  for(let n=0;n<8;n++){const id=s.next();assert.ok(ids.includes(id));s.observe({id,playbackId:++serial});}
 }
 const empty=createListeningSequence({availableClipIds:['unknown']});assert.equal(empty.next(),null);
});
test('invalid availability is rejected and exported lists retain only the four existing assets',()=>{
 assert.throws(()=>createListeningSequence({availableClipIds:null}),TypeError);
 assert.throws(()=>createListeningSequence({availableClipIds:[12]}),TypeError);
 assert.equal(LISTENING_CLIP_IDS.length,4);
});
