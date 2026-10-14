import test from 'node:test';
import assert from 'node:assert/strict';
import {createHomeMemory,homeMemoryExpression} from '../home-memory.mjs';
import {homeDayKey} from '../home-tutor-days.mjs';
import {lifeTutorExpression} from '../life-tutor-lines.mjs';
import {LESSONS} from '../../synk-world-app/life-content.mjs';
import {createWardrobeAlbum,subscribeWardrobeAlbum} from '../../synk-world-home/wardrobe-album.mjs';

const NOW=Date.parse('2026-10-12T15:00:00+09:00');
const lesson=LESSONS.find(l=>l.id==='greetings-expressions'),question=lesson.questions[0];
function input(owner='home-memory-a',at=NOW){
  return {owner,summary:{owner,status:{phase:'ready'}},snapshot:{owner,daily:{days:{[homeDayKey(at)]:{items:{[question.id]:{lessonId:lesson.id,observedAt:at,outcome:'independent',title:'<img src=x onerror=alert(1)>'}}}}}},lessons:LESSONS};
}
const photo=(owner,id,at=NOW)=>({accountId:owner,id,createdAt:at,blob:new Blob(['test-photo'],{type:'image/png'}),localStatus:'device'});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function harness(options={}){
  const changes=[],created=[],revoked=[];
  const memory=createHomeMemory({now:()=>NOW,eventTarget:null,documentTarget:null,subscribeAlbum:()=>()=>{},
    url:{createObjectURL(blob){const value=`blob:memory-${created.length+1}`;created.push({blob,value});return value;},revokeObjectURL(value){revoked.push(value);}},
    onChange:value=>changes.push(value),...options});
  return {memory,changes,created,revoked};
}
test('expression uses today\'s observed canonical wording without mutating stored progress',()=>{
  const data=input(),before=structuredClone(data),value=homeMemoryExpression({...data,now:NOW});
  assert.equal(value.text,lifeTutorExpression(lesson,question));assert.equal(value.date,'2026-10-12');assert.equal(value.status,'ready');
  assert.doesNotMatch(value.text,/<img/);assert.deepEqual(data,before);
  assert.equal(homeMemoryExpression({...data,now:NOW+86400000}).text,'');
  data.snapshot.daily.days['2026-10-12'].items[question.id].outcome='retry';
  assert.equal(homeMemoryExpression({...data,now:NOW}).label,'다시 볼 표현');
});
test('owner mismatch, loading, rejected, unreadable and conflict progress never expose an expression',()=>{
  const data=input();
  for(const patch of [{owner:'other'},{summary:{...data.summary,owner:'other'}},{snapshot:{...data.snapshot,owner:'other'}},
    ...[{phase:'loading'},{phase:'unreadable'},{phase:'conflict'},{rejected:true},{code:'LIFE_PROGRESS_REJECTED'}].map(status=>({summary:{...data.summary,status}}))]){
    assert.equal(homeMemoryExpression({...data,...patch,now:NOW}).text,'');
  }
});
test('stale and unknown observations cannot create a fake today expression',()=>{
  const data=input();data.snapshot.daily.days['2026-10-12'].items[question.id].observedAt=NOW+120000;
  assert.equal(homeMemoryExpression({...data,now:NOW}).text,'');
  data.snapshot.daily.days['2026-10-12'].items={unknown:{lessonId:lesson.id,observedAt:NOW,outcome:'independent'}};
  assert.equal(homeMemoryExpression({...data,now:NOW}).text,'');
});
test('latest valid owner photo is projected and an unchanged photo reuses its Blob URL',async()=>{
  const owner='home-memory-a',records=[photo(owner,'older',NOW-1000),photo('another','foreign',NOW),photo(owner,'newest',NOW)];
  const h=harness({createAlbum:()=>({list:async()=>records,get:async id=>records.find(p=>p.id===id),close(){}})});
  await h.memory.update(input(owner));assert.equal(h.memory.snapshot().photoId,'newest');assert.equal(h.created.length,1);
  await h.memory.refresh();assert.equal(h.created.length,1);assert.equal(h.memory.snapshot().photoDate,'2026-10-12');
  h.memory.dispose();assert.deepEqual(h.revoked,['blob:memory-1']);
});
test('account changes synchronously clear expression and image; late old-account reads are ignored',async()=>{
  const slow=deferred(),a='home-memory-a',b='home-memory-b';let closes=0;
  const h=harness({createAlbum:({accountId})=>({list:()=>accountId===a?slow.promise:Promise.resolve([photo(b,'b-photo')]),get:async id=>photo(accountId,id),close(){closes++;}})});
  const pending=h.memory.update(input(a));await h.memory.update(input(b));
  assert.equal(h.memory.snapshot().photoId,'b-photo');
  slow.resolve([photo(a,'a-photo')]);await pending;
  assert.equal(h.memory.snapshot().photoId,'b-photo');assert.equal(h.created.length,1);
  const switching=h.memory.update({owner:'guest',summary:{owner:'guest',status:{phase:'loading'}}});
  assert.equal(h.memory.snapshot().photoUrl,'');assert.equal(h.memory.snapshot().text,'');assert.ok(closes>=1);
  await switching;assert.deepEqual(h.revoked,['blob:memory-1']);h.memory.dispose();
});
test('dispose during Blob retrieval cancels publication and closes any late-opened album',async()=>{
  const pendingPhoto=deferred();let closes=0;
  const h=harness({createAlbum:()=>({list:async()=>[photo('home-memory-a','late')],get:()=>pendingPhoto.promise,close(){closes++;}})});
  const pending=h.memory.update(input());await Promise.resolve();h.memory.dispose();
  pendingPhoto.resolve(photo('home-memory-a','late'));await pending;
  assert.equal(h.created.length,0);assert.equal(h.memory.snapshot().photoUrl,'');assert.ok(closes>=1);
});
test('overlapping refreshes cannot replace a newer photo with an older result',async()=>{
  const slow=deferred();let calls=0;
  const h=harness({createAlbum:()=>({list:()=>++calls===1?slow.promise:Promise.resolve([photo('home-memory-a','new')]),get:async id=>photo('home-memory-a',id),close(){}})});
  const first=h.memory.update(input());await h.memory.refresh();slow.resolve([photo('home-memory-a','old')]);await first;
  assert.equal(h.memory.snapshot().photoId,'new');assert.equal(h.created.length,1);h.memory.dispose();
});
test('photo read failure clears its URL while preserving the current canonical expression',async()=>{
  let fail=false;
  const h=harness({createAlbum:()=>({list:async()=>{if(fail)throw Error('READ');return [photo('home-memory-a','one')];},get:async()=>photo('home-memory-a','one'),close(){}})});
  await h.memory.update(input());fail=true;await h.memory.refresh();
  assert.equal(h.memory.snapshot().photoUrl,'');assert.equal(h.memory.snapshot().photoStatus,'unavailable');
  assert.equal(h.memory.snapshot().text,lifeTutorExpression(lesson,question));assert.deepEqual(h.revoked,['blob:memory-1']);h.memory.dispose();
});
test('existing album save and delete notify the home; other owners and failed mutations do not',async()=>{
  const owner=`home-memory-session-${Date.now()}`,other=`${owner}-other`,events=[];
  const stop=subscribeWardrobeAlbum(value=>events.push(value));
  const h=harness({subscribeAlbum:subscribeWardrobeAlbum,createAlbum:({accountId})=>createWardrobeAlbum({accountId,indexedDB:null,now:()=>NOW})});
  const album=createWardrobeAlbum({accountId:owner,indexedDB:null,now:()=>NOW});
  await h.memory.update(input(owner));
  const saved=await album.add(new Blob(['photo'],{type:'image/png'}),{createdAt:NOW,preview:true});
  await new Promise(setImmediate);assert.equal(h.memory.snapshot().photoId,saved.photo.id);assert.equal(h.memory.snapshot().photoLabel,'앨범의 입어 본 사진');
  const second=createWardrobeAlbum({accountId:other,indexedDB:null,now:()=>NOW});await second.add(new Blob(['other'],{type:'image/png'}));
  await new Promise(setImmediate);assert.equal(h.memory.snapshot().photoId,saved.photo.id);
  await album.add(new Blob(['bad'],{type:'text/html'}));assert.deepEqual(events,[owner,other]);
  await album.remove(saved.photo.id);await new Promise(setImmediate);assert.equal(h.memory.snapshot().photoUrl,'');assert.deepEqual(events,[owner,other,owner]);
  stop();h.memory.dispose();album.close();second.close();
});
test('returning to the page refreshes data and dispose removes lifecycle listeners',async()=>{
  const target=new EventTarget(),doc=new EventTarget();doc.visibilityState='visible';let reads=0;
  const h=harness({eventTarget:target,documentTarget:doc,createAlbum:()=>({list:async()=>{reads++;return [];},close(){}})});
  await h.memory.update(input());target.dispatchEvent(new Event('focus'));target.dispatchEvent(new Event('pageshow'));doc.dispatchEvent(new Event('visibilitychange'));
  await new Promise(setImmediate);assert.equal(reads,4);h.memory.dispose();target.dispatchEvent(new Event('focus'));doc.dispatchEvent(new Event('visibilitychange'));assert.equal(reads,4);
});
