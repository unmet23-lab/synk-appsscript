import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudy} from '../src/app.mjs';
import {readState,recordDecision,storeKey} from '../src/tutor.mjs';
import {progressSnapshot} from '../src/progress-sync.mjs';
import {memoryStore,ACCOUNT} from './semantic-fixture.mjs';
const now=1793113200000,owner='user-'+ACCOUNT;
const items=JSON.parse(fs.readFileSync(new URL('../../synk-world-app/world-writing-items.json',import.meta.url),'utf8'));
const content=JSON.parse(fs.readFileSync(new URL('../content/ending-53.json',import.meta.url),'utf8'));
const settle=()=>new Promise(resolve=>setTimeout(resolve,500));
const oldDocument=globalThis.document;
function harness({remote=null,enabled=true,get,post,storage=memoryStore()}={}){
 const listeners={},panel={innerHTML:''},calls=[];let identity=owner,version=remote?1:0,saved=remote;
 const root={innerHTML:'',addEventListener:(type,fn)=>{listeners[type]=fn;},contains:()=>true,querySelector:selector=>selector==='[data-study-sync]'?panel:{focus(){},innerHTML:''}};
 const feedback={init:async()=>{},owner:()=>identity,status:()=>({connected:!!identity,enabled:false}),cancel(){},disconnect(){identity=null;},
  learningSession:async()=>identity?{accountId:ACCOUNT,enabled,revision:2}:null,
  studyProgress:async body=>{calls.push(body);if(body.method==='GET')return get?get():{version,study:saved};if(post)return post(body);assert.equal(body.baseVersion,version);saved=body.study;return {version:++version,study:saved};}};
 globalThis.document={title:''};
 const app=createStudy({root,storage,session:memoryStore(),feedback,now:()=>now,confirm:()=>true,base:'https://test.synk.invalid/study/',
  fetcher:async url=>Response.json(String(url).includes('/items.json')?{...items,sourceHash:items.contentHash}:{items:content.items})});
 const click=attr=>{const button={disabled:false,dataset:{},hasAttribute:key=>key===attr,closest(){return this;}};listeners.click({target:button});};
 return {app,root,panel,calls,storage,click,remote:()=>saved,expire:()=>{identity=null;}};
}
const history=()=>recordDecision(readState(null),{scene:'write',why:'start',itemId:'w53-resale',support:0,mode:'new'},{now}).state;
test('account progress is restored before next decision even while AI is unavailable',async()=>{
 const remote=progressSnapshot(history()),h=harness({remote});await h.app.start();
 assert.equal(h.app.state().seq,2);assert.equal(h.app.state().trail[0].id,remote.trail[0].id);
 await settle();assert.ok(h.calls.some(c=>c.method==='POST'));assert.equal(h.remote().drafts,undefined);assert.equal(h.remote().scene,undefined);
 assert.match(h.panel.innerHTML,/계정에 진도를 저장했어요/);h.click('data-st-disconnect');globalThis.document=oldDocument;
});
test('no consent and failed account reads never upload a guessed empty baseline',async()=>{
 const disabled=harness({enabled:false});await disabled.app.start();await settle();assert.equal(disabled.calls.length,0);assert.match(disabled.root.innerHTML,/동의하면/);
 const failed=harness({get:async()=>{throw Error('offline');}});await failed.app.start();await settle();assert.equal(failed.calls.filter(c=>c.method==='POST').length,0);assert.match(failed.panel.innerHTML,/저장하지 못했어요/);
 failed.click('data-st-disconnect');globalThis.document=oldDocument;
});
test('fresh account slot remains device-only and returning retains the separate state',async()=>{
 const storage=memoryStore(),local=history();local.obs=[{kind:'cycle',at:new Date(now).toISOString(),n:local.seq}];storage.setItem(storeKey(owner),JSON.stringify(local));
 const h=harness({storage,remote:progressSnapshot(local)});await h.app.start();await settle();h.click('data-st-fresh');await settle();
 const freshOwner=storage.getItem('synk.study.slot.'+owner),before=h.calls.length;assert.ok(freshOwner.startsWith(owner+'-'));assert.match(h.root.innerHTML,/이 기기에만 남아요/);
 await settle();assert.equal(h.calls.length,before);assert.ok(storage.getItem(storeKey(owner)));assert.ok(storage.getItem(storeKey(freshOwner)));
 h.click('data-sync-account');await settle();assert.equal(storage.getItem('synk.study.slot.'+owner),null);assert.ok(storage.getItem(storeKey(freshOwner)));
 h.click('data-st-disconnect');globalThis.document=oldDocument;
});
test('pending remote restore after disconnect cannot replace guest history',async()=>{
 let release;const h=harness({get:()=>new Promise(resolve=>{release=resolve;})});const start=h.app.start();
 while(!release)await new Promise(resolve=>setImmediate(resolve));h.click('data-st-disconnect');release({version:1,study:progressSnapshot(history())});await start;await settle();
 assert.equal(h.calls.filter(c=>c.method==='POST').length,0);assert.equal(h.storage.getItem(storeKey(owner)),null);assert.ok(h.storage.getItem(storeKey('guest')));globalThis.document=oldDocument;
});
test('automatic sync authentication expiry immediately leaves the previous account draft',async()=>{
 const storage=memoryStore(),local=readState(null);local.drafts.private={text:'synthetic private draft A',updatedAt:new Date(now).toISOString(),checkedAt:null};storage.setItem(storeKey(owner),JSON.stringify(local));
 const h=harness({storage,post:async()=>{h.expire();throw Object.assign(Error('SESSION_REVOKED'),{code:'SESSION_REVOKED'});}});
 await h.app.start();await settle();assert.deepEqual(h.app.state().drafts,{});assert.ok(storage.getItem(storeKey('guest')));assert.match(storage.getItem(storeKey(owner)),/synthetic private draft A/);assert.match(h.root.innerHTML,/연결이 끊겼어요/);globalThis.document=oldDocument;
});
