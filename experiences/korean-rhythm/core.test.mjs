import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,LEVELS,RoundState,buildChart,timeAtBeat} from './core.mjs';
test('recording-derived beat times cover the full song and interpolate half beats',()=>{
 for(const track of TRACKS){
  assert.ok(track.audioUrl.endsWith('.mp3'));assert.ok(track.sourceId);
  assert.ok(track.beatTimes.every((t,i)=>t>=0&&t<track.duration&&(i===0||t>track.beatTimes[i-1])));
  assert.equal(timeAtBeat(track,20.5),(track.beatTimes[20]+track.beatTimes[21])/2);
  const chart=buildChart(track);assert.equal(chart.duration,track.duration);
  assert.ok(chart.notes.at(-1).endTime>track.duration-10,'notes must continue through the full recording');
 }
});
test('all nine charts reserve complete narration and two-button answer windows',()=>{
  for(const track of TRACKS)for(const level of Object.keys(LEVELS)){
    const chart=buildChart(track,level,1234);assert.equal(chart.questions.length,5);assert.ok(chart.notes.length>30);assert.ok(chart.notes.some(n=>n.duration>0));
    for(const q of chart.questions){assert.deepEqual(q.options,['O','X']);assert.ok(q.voice.duration>0);assert.ok(q.voiceEnd<q.answerOpen-.3);assert.ok(q.time-q.answerOpen>=2);assert.ok(q.options.includes(q.answer));assert.ok(q.time-q.showTime>=4.5);for(const note of chart.notes)assert.ok(note.endTime<q.showTime||note.time>q.time+.65,'ordinary notes must not overlap listening or answer gates');}
    for(const n of chart.notes){assert.ok(n.time>=0&&n.endTime<chart.duration);assert.ok(n.lane>=0&&n.lane<2);}
  }
});
test('accurate language choice before the beat does not award rhythm points',()=>{
  const r=new RoundState(TRACKS[0],'easy',5),q=r.questions[0],lane=q.options.indexOf(q.answer);assert.equal(r.input(lane,q.answerOpen+.3).type,'intent');assert.equal(r.score,0);r.update(q.closeTime+.01);assert.equal(r.correctCount,1);assert.equal(q.quality,0);assert.equal(r.earned,0);
});
test('an on-beat incorrect meaning gets rhythm credit but no language credit',()=>{
  const r=new RoundState(TRACKS[0],'normal',7),q=r.questions[0],lane=q.options.findIndex(o=>o!==q.answer);const e=r.input(lane,q.time);assert.equal(e.quality,1);assert.equal(e.correct,false);assert.equal(r.score,1000);assert.equal(r.correctCount,0);
});
test('a two-key chord submits only one language answer',()=>{
  const r=new RoundState(TRACKS[0],'easy',2),q=r.questions[0],wrong=q.options.findIndex(o=>o!==q.answer);r.input(wrong,q.time);assert.equal(r.input(q.options.indexOf(q.answer),q.time),null);assert.equal(q.response,wrong);assert.equal(r.processed,1);
});
test('late language input is understood independently from a timing miss',()=>{
  const r=new RoundState(TRACKS[0],'hard',15),q=r.questions[0];r.input(q.options.indexOf(q.answer),q.time+.5);assert.equal(r.correctCount,1);assert.equal(r.earned,0);assert.equal(r.processed,1);
});
test('no input is unanswered rather than a fabricated wrong choice',()=>{
  const r=new RoundState(TRACKS[0]),q=r.questions[0];r.update(q.closeTime+.01);assert.equal(q.state,'unanswered');assert.equal(q.response,null);assert.equal(r.answeredCount,0);
});
test('long notes require a sustained key, early release loses only the tail',()=>{
  const r=new RoundState(TRACKS[0],'normal',1),n=r.notes.find(n=>n.duration>0);r.input(n.lane,n.time);assert.equal(n.state,'holding');const event=r.release(n.lane,n.time+.1);assert.equal(event.type,'hold-break');assert.equal(n.state,'broken');assert.equal(r.earned,1);assert.equal(r.processed,2);
});
test('holding through the end completes a long note exactly once',()=>{
  const r=new RoundState(TRACKS[0],'normal',1),n=r.notes.find(n=>n.duration>0);r.input(n.lane,n.time);r.update(n.endTime,new Set([n.lane]));assert.equal(n.state,'hit');const earned=r.earned;assert.equal(r.release(n.lane,n.endTime+.2),null);assert.equal(r.earned,earned);
});
test('different rounds vary spoken claims and note patterns while preserving O/X positions',()=>{
  const a=buildChart(TRACKS[0],'easy',1),b=buildChart(TRACKS[0],'easy',5678);assert.notDeepEqual(a.questions.map(q=>q.question),b.questions.map(q=>q.question));assert.notDeepEqual(a.notes.map(n=>n.lane),b.notes.map(n=>n.lane));
});
test('a perfect simulated round has full rhythm credit and separate language accuracy',()=>{
  const r=new RoundState(TRACKS[1],'hard',19);const events=[...r.notes.map(n=>({t:n.time,lane:n.lane})),...r.notes.filter(n=>n.duration).map(n=>({t:n.endTime,lane:n.lane,release:true})),...r.questions.map(q=>({t:q.time,lane:q.options.indexOf(q.answer)}))].sort((a,b)=>a.t-b.t);for(const e of events)e.release?r.release(e.lane,e.t):r.input(e.lane,e.t);r.update(r.duration+2);assert.equal(r.earned,r.possible);assert.equal(r.correctCount,5);assert.equal(r.accuracy,1);
});
test('all unanswered events finish at zero and cannot exceed their rhythm denominator',()=>{
  for(const t of TRACKS)for(const l of Object.keys(LEVELS)){const r=new RoundState(t,l,9);r.update(r.duration+5);assert.equal(r.earned,0);assert.equal(r.processed,r.possible);assert.equal(r.correctCount,0);}
});
test('all transfer checks use a new sentence and exactly one matching answer',()=>{
  for(const t of TRACKS)for(const q of t.questions){assert.notEqual(q.recall.prompt,q.prompt);assert.ok(['O','X'].includes(q.recall.answer));}
});

test('input during narration is ignored and cannot predetermine an answer',()=>{
 const r=new RoundState(TRACKS[0]),q=r.questions[0];const event=r.input(q.options.indexOf(q.answer),q.showTime+.5);assert.equal(event.type,'listening');assert.equal(q.intent,null);assert.equal(r.score,0);r.update(q.closeTime+.01);assert.equal(q.state,'unanswered');assert.equal(r.correctCount,0);
});
test('removed lanes cannot submit hidden answers or score points',()=>{const r=new RoundState(TRACKS[0]);assert.equal(r.input(2,r.questions[0].time),null);assert.equal(r.input(3,r.questions[0].time),null);assert.equal(r.processed,0);});
