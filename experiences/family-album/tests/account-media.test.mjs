import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createFamilyAccountMedia } from '../account-media.mjs';

const MIB=1024*1024, png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBv8AAAAASUVORK5CYII=','base64');
const image=(marker,size=80)=>{const bytes=Buffer.alloc(size);png.copy(bytes);bytes[bytes.length-1]=marker;return {name:`synthetic-${marker}.png`,type:'image/png',data:`data:image/png;base64,${bytes.toString('base64')}`};};
const page=(id,photo)=>({id,title:id,date:'',person:'가족',author:'나',story:'합성 기록',photo,audio:null,details:{},skipped:[],contributions:[],createdAt:'2026-10-06T00:00:00.000Z',updatedAt:'2026-10-06T00:00:00.000Z'});
const album=pages=>({format:'synk-family-album',version:1,pages});
const refs=state=>(state?.pages||[]).flatMap(p=>[p.photo?.mediaRef,p.audio?.mediaRef].filter(Boolean));
function fixture(){
 const assets=new Map(),cache=createFamilyAccountMedia(),calls=[];let state=null;
 const fault=(code,assetId)=>Object.assign(new Error(code),{code,assetId});
 const account={async request(operation,values){
  calls.push({operation,assetId:values.assetId});
  if(operation==='assetUpload'){
   const bytes=Buffer.from(values.bytes),used=[...assets.values()].reduce((n,a)=>n+a.ref.size,0);
   if(assets.size>=60||used+bytes.length>20*MIB)throw fault('MEDIA_QUOTA_EXCEEDED');
   const ref={assetId:randomUUID(),kind:values.kind,mime:values.mime,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};assets.set(ref.assetId,{ref,bytes});return {mediaRef:ref};
  }
  const asset=assets.get(values.assetId);if(!asset)throw fault('ASSET_NOT_FOUND',values.assetId);return {bytes:asset.bytes};
 }};
 function save(next){
  for(const ref of refs(next))if(!assets.has(ref.assetId))throw fault('ASSET_NOT_FOUND',ref.assetId);
  const keep=new Set(refs(next).map(r=>r.assetId));for(const ref of refs(state))if(!keep.has(ref.assetId))assets.delete(ref.assetId);
  state=structuredClone(next);cache.didSave(next);
 }
 return {cache,account,assets,calls,save,async commit(value){const doc=await cache.toDocument(value,account);save(doc);return doc;},remove(){assets.clear();state=null;cache.clear();},used:()=>[...assets.values()].reduce((n,a)=>n+a.ref.size,0),uploads:()=>calls.filter(c=>c.operation==='assetUpload').length};
}

test('15MiB album: acknowledged deletion then undo uploads only the deleted 5MiB original',async()=>{
 const f=fixture(),original=album([page('one',image(1,5*MIB)),page('two',image(2,5*MIB)),page('three',image(3,5*MIB))]);
 const first=await f.commit(original);assert.equal(f.used(),15*MIB);
 await f.commit(album(original.pages.slice(0,2)));assert.equal(f.used(),10*MIB);assert.equal(f.assets.has(first.pages[2].photo.mediaRef.assetId),false);
 const restored=await f.commit(original);assert.equal(f.uploads(),4);assert.equal(f.used(),15*MIB);
 assert.equal(restored.pages[0].photo.mediaRef.assetId,first.pages[0].photo.mediaRef.assetId);assert.notEqual(restored.pages[2].photo.mediaRef.assetId,first.pages[2].photo.mediaRef.assetId);
});

test('an unacknowledged delete retains healthy refs and undo never uploads their copies',async()=>{
 const f=fixture(),original=album([page('one',image(1)),page('two',image(2))]);const first=await f.commit(original);
 await f.cache.toDocument(album(original.pages.slice(0,1)),f.account); // Failed or cancelled save: no commit.
 assert.deepEqual(await f.cache.toDocument(original,f.account),first);assert.equal(f.uploads(),2);
});

test('undo already converted before a late delete ACK retries only the server-identified missing original',async()=>{
 const f=fixture(),original=album([page('one',image(1,5*MIB)),page('two',image(2,5*MIB)),page('three',image(3,5*MIB))]);await f.commit(original);
 const deleting=await f.cache.toDocument(album(original.pages.slice(0,2)),f.account),earlyUndo=await f.cache.toDocument(original,f.account);
 f.save(deleting);let missing;try{f.save(earlyUndo);}catch(error){missing=error;}
 assert.equal(missing.code,'ASSET_NOT_FOUND');
 // The ACK already evicted this id; explicit retry still rebuilds from the live album.
 assert.equal(f.cache.prepareRetry({error:missing}),true);const restored=await f.commit(original);
 assert.equal(f.uploads(),4);assert.equal(f.used(),15*MIB);assert.equal(restored.pages.length,3);
});

test('targeted retry preserves every healthy ref and refuses an unqualified or unrelated failure',async()=>{
 const f=fixture(),original=album([page('one',image(1,5*MIB)),page('two',image(2,5*MIB)),page('three',image(3,5*MIB))]);const first=await f.commit(original),lost=first.pages[1].photo.mediaRef.assetId;
 assert.equal(f.cache.prepareRetry({error:{code:'ASSET_NOT_FOUND'}}),false);assert.equal(f.cache.prepareRetry({error:{code:'NETWORK',assetId:lost}}),false);
 f.assets.delete(lost);assert.equal(f.cache.prepareRetry({error:{code:'ASSET_NOT_FOUND',assetId:lost}}),true);
 const next=await f.commit(original);assert.equal(f.uploads(),4);assert.equal(f.used(),15*MIB);assert.equal(next.pages[0].photo.mediaRef.assetId,first.pages[0].photo.mediaRef.assetId);assert.equal(next.pages[2].photo.mediaRef.assetId,first.pages[2].photo.mediaRef.assetId);
});

test('whole-album deletion invalidates original cache before the same album is saved again',async()=>{
 const f=fixture(),original=album([page('one',image(1))]);const before=await f.commit(original);f.remove();
 const after=await f.commit(original);assert.equal(f.uploads(),2);assert.notEqual(after.pages[0].photo.mediaRef.assetId,before.pages[0].photo.mediaRef.assetId);
});

test('shared original stays cached until its last acknowledged page reference is removed',async()=>{
 const f=fixture(),photo=image(1),original=album([page('one',photo),page('two',photo)]);const before=await f.commit(original);assert.equal(f.uploads(),1);
 await f.commit(album(original.pages.slice(0,1)));const after=await f.commit(original);assert.equal(f.uploads(),1);assert.deepEqual(after,before);
});

test('account change fences an old upload and concurrent conversions share one upload',async()=>{
 const f=fixture(),original=album([page('one',image(1))]);let release,started;
 const gate=new Promise(resolve=>{release=resolve;}),entered=new Promise(resolve=>{started=resolve;});
 const slow={async request(...args){started();await gate;return f.account.request(...args);}};
 const old=f.cache.toDocument(original,slow);await entered;f.cache.clear();release();await assert.rejects(old,{code:'ACCOUNT_CHANGED'});
 await Promise.all([f.cache.toDocument(original,f.account),f.cache.toDocument(original,f.account)]);assert.equal(f.uploads(),2);
});
