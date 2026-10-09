import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldClient} from '../world-client.mjs';
import {connectTownWorld} from '../world-town-client.mjs';

const TAB_A='11111111-1111-4111-8111-111111111111';
const TAB_B='22222222-2222-4222-8222-222222222222';
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(value)});
const snapshot=(revision=1)=>({ok:true,accountId:'account-a',revision,
  avatar:{characterId:'mongle',slots:{body:'mongle-apron-starter',neck:'mongle-scarf-first-steps'}},
  inventory:[{itemId:'mongle-apron-starter'},{itemId:'mongle-scarf-first-steps'}]});

// The actual WorldClient remains in use. Only browser event surfaces and HTTP
// response timing are controlled, so its generation and identity checks run.
async function fixture(t){
  const originalDocument=globalThis.document,originalChannel=globalThis.BroadcastChannel;
  const channels=new Set(),listeners=new Set();
  globalThis.document={hidden:false,addEventListener:(name,fn)=>{assert.equal(name,'visibilitychange');listeners.add(fn);},removeEventListener:(name,fn)=>listeners.delete(fn)};
  globalThis.BroadcastChannel=class {
    constructor(name){assert.equal(name,'synk-world-appearance-v1');channels.add(this);}
    close(){channels.delete(this);}
  };
  let world=snapshot(),bootstrapGate=null,townGate=null,townResult={body:{state:{revision:1}},status:200};
  const tab=storage(),calls=[],appearances=[],errors=[];
  tab.setItem('synk-world-v1-tab',TAB_A);
  const client=new WorldClient({storage:storage(),tabStorage:tab,broadcastAppearance:false,fetcher:async(url,options)=>{
    calls.push({url,tab:options.headers['X-Synk-Rehearsal-Tab'],authorization:options.headers.Authorization});
    if(url.endsWith('/bootstrap')){
      const captured=structuredClone(world),gate=bootstrapGate;bootstrapGate=null;
      if(gate){gate.entered.resolve();await gate.release.promise;}
      return response(captured);
    }
    if(url.includes('/town/')){
      const captured=structuredClone(townResult),gate=townGate;townGate=null;
      if(gate){gate.entered.resolve();await gate.release.promise;}
      return response(captured.body,captured.status);
    }
    throw Error('Unexpected test request: '+url);
  }});
  client.snapshot=snapshot();client.accessToken='synthetic-bridge-token';
  let bridge;
  t.after(()=>{
    bridge?.dispose();
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
    globalThis.BroadcastChannel=originalChannel;
  });
  bridge=await connectTownWorld({client,onAppearance:value=>appearances.push(value),onError:error=>errors.push(error)});
  const hold=()=>({entered:deferred(),release:deferred()});
  return {bridge,client,tab,calls,appearances,errors,channels,listeners,
    broadcast(){for(const channel of channels)channel.onmessage?.({data:{type:'refresh'}});},
    setRevision(revision){world=snapshot(revision);},
    holdBootstrap(){bootstrapGate=hold();return bootstrapGate;},
    holdTown(){townGate=hold();return townGate;},
    setTownReply(body,status){townResult={body,status};}};
}

test('logout during a delayed appearance refresh immediately clears the published avatar and rejects late state',async t=>{
  const f=await fixture(t),gate=f.holdBootstrap(),pending=f.bridge.refresh();
  await gate.entered.promise;
  f.tab.setItem('synk-world-v1-signed-out','1');f.broadcast();
  assert.equal(f.appearances.at(-1).verified,false);assert.equal(f.appearances.at(-1).outfit,'none');
  gate.release.resolve();await pending;
  assert.equal(f.client.snapshot,null);assert.equal(f.bridge.appearance().verified,false);
  const sent=f.calls.length;
  await assert.rejects(f.bridge.request('command',{id:'after-logout'}),{code:'AUTH_REQUIRED'});
  assert.equal(f.calls.length,sent,'signed-out command must not enter the transport');
  assert.equal(f.errors.at(-1).code,'AUTH_REQUIRED');
});

test('A to B account switch during a refresh ends the old visit before any command can reach either account',async t=>{
  const f=await fixture(t),gate=f.holdBootstrap(),pending=f.bridge.refresh();
  await gate.entered.promise;
  f.tab.setItem('synk-world-v1-tab',TAB_B);f.broadcast();
  assert.equal(f.appearances.at(-1).verified,false);
  gate.release.resolve();await pending;
  assert.equal(f.client.accessToken,null);assert.equal(f.client.snapshot,null);
  const sent=f.calls.length;
  await assert.rejects(f.bridge.request('presence',{foreground:true}),{code:'AUTH_REQUIRED'});
  await assert.rejects(f.bridge.request('command',{id:'not-b'}),{code:'AUTH_REQUIRED'});
  assert.equal(f.calls.length,sent);assert.ok(f.calls.every(call=>call.tab===TAB_A));
});

test('a second same-account revision notice during a refresh triggers a trailing authoritative read',async t=>{
  const f=await fixture(t);f.setRevision(2);
  const gate=f.holdBootstrap(),pending=f.bridge.refresh();await gate.entered.promise;
  f.setRevision(3);f.broadcast();gate.release.resolve();await pending;
  assert.equal(f.bridge.appearance().revision,3);assert.equal(f.appearances.at(-1).revision,3);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/bootstrap')).length,3,'initial, delayed and trailing reads');
  assert.equal(f.errors.length,0);
});

test('Town API 401 clears and publishes the avatar immediately',async t=>{
  const f=await fixture(t);f.setTownReply({ok:false,error:{code:'AUTH_REQUIRED'}},401);
  await assert.rejects(f.bridge.request('presence',{foreground:true}),{code:'AUTH_REQUIRED',status:401});
  assert.equal(f.client.snapshot,null);assert.equal(f.bridge.appearance().verified,false);
  assert.equal(f.appearances.at(-1).verified,false);assert.equal(f.appearances.at(-1).outfit,'none');
  assert.equal(f.errors.length,1);assert.equal(f.errors[0].code,'AUTH_REQUIRED');
});

test('Town 409 preserves its string error code and Korean recovery message without ending the account',async t=>{
  const f=await fixture(t),message='다른 창에서 자리가 바뀌었어요. 다시 확인해 주세요.';
  f.setTownReply({error:'stale-command',message,state:{revision:4}},409);
  await assert.rejects(f.bridge.request('command',{id:'stale',expectedRevision:1}),{code:'stale-command',status:409,message});
  assert.equal(f.bridge.appearance().verified,true);assert.equal(f.errors.length,0);
});

test('a namespace change while a Town response is pending cannot publish or return the old visit result',async t=>{
  const f=await fixture(t),gate=f.holdTown(),pending=f.bridge.request('state');
  await gate.entered.promise;f.tab.setItem('synk-world-v1-tab',TAB_B);
  const rejected=assert.rejects(pending,{code:'AUTH_REQUIRED'});
  gate.release.resolve();await rejected;
  assert.equal(f.appearances.at(-1).verified,false);assert.equal(f.client.snapshot,null);
});

test('disposing a bridge removes event resources and suppresses delayed appearance results',async t=>{
  const f=await fixture(t),gate=f.holdBootstrap(),pending=f.bridge.refresh();await gate.entered.promise;
  const published=f.appearances.length;f.bridge.dispose();gate.release.resolve();await pending;
  assert.equal(f.channels.size,0);assert.equal(f.listeners.size,0);
  assert.equal(f.appearances.length,published);assert.equal(f.errors.length,0);
  assert.equal(f.bridge.appearance().verified,false);
});
