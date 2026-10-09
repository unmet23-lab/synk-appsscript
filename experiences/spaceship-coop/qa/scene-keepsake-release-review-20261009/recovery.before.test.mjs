import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { createServer } from './server.mjs';

const pendingKey='synk-spaceship-pending-entry',sessionKey='synk-spaceship-session';
const source=(await readFile(new URL('./app.mjs',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
async function setup(t,options={}){
  const server=createServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeGame();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`;
  const create=async()=>{const response=await fetch(base+'/api/spaceship/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID().replaceAll('-','')})});assert.equal(response.status,201);return response.json();};
  return{base,create};
}
// Compile the complete actual app, replacing only its import dependencies. This is
// a synthetic DOM/audio harness and real local HTTP, not a human/browser play test.
async function client(base,{store=new Map(),fetcher=fetch,prepare=async()=>{}}={}){
  let overlayOpen=false,overlayCloses=0;
  const navigations=[],location=new URL(base+'/experiences/spaceship-coop/');location.assign=url=>navigations.push(url);
  const node=()=>({hidden:false,dataset:{},innerHTML:'',textContent:'',events:{},addEventListener(type,handler){this.events[type]=handler;},querySelector(){return null;},querySelectorAll(){return[];},insertAdjacentHTML(){},focus(){},close(){},showModal(){}}),nodes=new Map();
  for(const key of ['#main','#leave-top','#world-link','#leave-dialog','#ship-shop','#ship-shop-open','#starbook','#toast','#live'])nodes.set(key,node());
  nodes.set('meta[name="spaceship-api"]',{content:base+'/api/spaceship'});
  const context=vm.createContext({URL,AbortSignal,crypto:globalThis.crypto,fetch:fetcher,TextDecoder,Uint8Array,
    document:{body:{dataset:{}},hidden:false,activeElement:null,querySelector:q=>nodes.get(q)||null,addEventListener(){}},window:{addEventListener(){}},navigator:{},location,history:{replaceState(){}},
    sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},SynkPlayAccount:{ready:async()=>{}},
    VoiceBank:class{async prepare(){await prepare();}stop(){}effect(){}},WORDS:{red:'빨간색',blue:'파란색',up:'위',down:'아래',one:'한 번',two:'두 번',three:'세 번'},
    DEFAULT_OUTFIT:{sky:'first',badge:'sparkle'},BADGE_ART:{sparkle:'sparkle'},loadStarbook:()=>({available:true,entries:[]}),createReturnRecall:()=>({isOpen:()=>overlayOpen,close(){overlayCloses++;overlayOpen=false;},suspend(){}}),createStarbook:()=>({}),createShipShop:()=>({outfit:()=>({sky:'first',badge:'sparkle'})}),
    setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},clearTimeout});
  // SSE is intentionally not started: these cases target the entry POST/GET path.
  const app=await vm.runInContext(`(async()=>{${source}\nstream=()=>{};return {enter,forget,applyState:next=>{const paint=render;render=()=>{};try{update(next);}finally{render=paint;}},inspect:()=>({session,state,entryError})};})()`,context);
  app.overlay=()=>({open:overlayOpen,closes:overlayCloses});app.openSyntheticOverlay=()=>{overlayOpen=true;};
  app.confirmLeave=()=>nodes.get('#leave-dialog').events.click({target:{closest:()=>({dataset:{dialog:'confirm'}})}});
  app.openWorldLeave=destination=>nodes.get('#world-link').events.click({preventDefault(){},currentTarget:{href:destination}});
  app.navigations=navigations;
  return app;
}
function loseFirstPost(calls){let lose=true;return async(url,options)=>{
  const response=await fetch(url,options);
  if(options?.method==='POST'){
    const data=await response.clone().json();calls.push({id:JSON.parse(options.body).id,status:response.status,data});
    if(lose){lose=false;await response.arrayBuffer();throw new TypeError('Response lost after the server accepted the request');}
  }
  return response;
};}

test('normal collaborative state updates close only an open solo recall overlay',async t=>{
  const h=await setup(t),c=await client(h.base);await c.enter('create');const original=c.inspect().state;
  c.applyState({...original,revision:original.revision+1,phase:'playing',signal:null});assert.equal(c.overlay().closes,0);
  c.openSyntheticOverlay();c.applyState({...original,revision:original.revision+2,phase:'playing',signal:null});assert.equal(c.overlay().closes,1);assert.equal(c.overlay().open,false);
  c.applyState({...original,revision:original.revision+3,phase:'playing',signal:null});assert.equal(c.overlay().closes,1);assert.equal(c.inspect().session.code,original.code);
});

test('lost join response retries the same request and restores the original participant',async t=>{
  const h=await setup(t),host=await h.create(),calls=[],store=new Map(),app=await client(h.base,{store,fetcher:loseFirstPost(calls)});
  await app.enter('join',host.code);assert.equal(app.inspect().session,null);assert.ok(store.has(pendingKey));
  await app.enter('join',host.code);assert.equal(calls.length,2);assert.equal(calls[0].status,201);assert.equal(calls[1].status,200);assert.equal(calls[0].id,calls[1].id);
  assert.equal(app.inspect().session.token,calls[0].data.token);assert.equal(app.inspect().session.slot,1);assert.equal(app.inspect().state.phase,'lobby');assert.equal(store.has(pendingKey),false);assert.ok(store.has(sessionKey));
});
test('lost create response recovers one original room instead of creating another',async t=>{
  const h=await setup(t),calls=[],app=await client(h.base,{fetcher:loseFirstPost(calls)});
  await app.enter('create');await app.enter('create');assert.deepEqual(calls.map(x=>x.status),[201,200]);assert.equal(calls[0].id,calls[1].id);assert.equal(calls[0].data.code,calls[1].data.code);assert.equal(app.inspect().session.token,calls[0].data.token);
});
test('reload after lost join response keeps the pending request and original seat',async t=>{
  const h=await setup(t),host=await h.create(),store=new Map(),calls=[],app=await client(h.base,{store,fetcher:loseFirstPost(calls)});
  await app.enter('join',host.code);const reloaded=await client(h.base,{store,fetcher:async(url,options)=>{if(options?.method==='POST')calls.push({id:JSON.parse(options.body).id});return fetch(url,options);}});
  await reloaded.enter('join',host.code);assert.equal(calls[0].id,calls[1].id);assert.equal(reloaded.inspect().session.token,calls[0].data.token);assert.equal(store.has(pendingKey),false);
});
test('choosing a different room never reuses a lost request from another room',async t=>{
  const h=await setup(t),a=await h.create(),b=await h.create(),calls=[],app=await client(h.base,{fetcher:loseFirstPost(calls)});
  await app.enter('join',a.code);await app.enter('join',b.code);assert.notEqual(calls[0].id,calls[1].id);assert.equal(app.inspect().session.code,b.code);
});
test('explicitly forgetting entry information clears the pending request',async t=>{
  const h=await setup(t),calls=[],store=new Map(),app=await client(h.base,{store,fetcher:loseFirstPost(calls)});
  await app.enter('create');assert.ok(store.has(pendingKey));app.forget();assert.equal(store.has(pendingKey),false);assert.equal(store.has(sessionKey),false);
});
test('an explicit server rejection clears pending entry rather than replaying it forever',async t=>{
  const h=await setup(t),host=await h.create(),store=new Map(),calls=[],app=await client(h.base,{store,fetcher:async(url,options)=>{if(options?.method==='POST')calls.push(JSON.parse(options.body).id);return fetch(url,options);}});
  await app.enter('join','AAAAAA');assert.equal(app.inspect().session,null);assert.match(app.inspect().entryError,/만료/);assert.equal(store.has(pendingKey),false);
  await app.enter('join',host.code);assert.equal(app.inspect().session.code,host.code);assert.notEqual(calls[0],calls[1]);assert.equal(store.has(pendingKey),false);
});
test('malformed pending storage is ignored and cannot supply the request ID',async t=>{
  const h=await setup(t),store=new Map([[pendingKey,JSON.stringify({type:'create',code:'',id:'invalid-request'})]]),calls=[];
  const app=await client(h.base,{store,fetcher:async(url,options)=>{if(options?.method==='POST')calls.push(JSON.parse(options.body).id);return fetch(url,options);}});
  await app.enter('create');assert.match(calls[0],/^[a-f0-9]{32}$/);assert.equal(app.inspect().session.slot,0);assert.equal(store.has(pendingKey),false);
});
test('failed sound preparation still creates no request or pending room',async t=>{
  const h=await setup(t),store=new Map();let requests=0;const app=await client(h.base,{store,fetcher:async()=>{requests++;throw new Error('must not fetch');},prepare:async()=>{throw new Error('Synthetic sound preparation failure');}});
  await app.enter('create');assert.equal(requests,0);assert.equal(app.inspect().session,null);assert.equal(store.has(pendingKey),false);
});
test('failed leave request preserves the original session so leaving can be retried',async t=>{
  const h=await setup(t),host=await h.create();let fail=true;
  const app=await client(h.base,{fetcher:async(url,options)=>{if(options?.method==='POST'&&url.endsWith('/commands')&&JSON.parse(options.body).type==='leave'&&fail){fail=false;throw new TypeError('Synthetic offline leave request');}return fetch(url,options);}});
  await app.enter('join',host.code);const original=app.inspect().session;
  await app.confirmLeave();assert.ok(app.inspect().session?.token===original.token,'failed network leave must not discard the participant');assert.equal(app.inspect().state.phase,'lobby');
  const stillOpen=await(await fetch(h.base+`/api/spaceship/rooms/${host.code}/state`,{headers:{Authorization:'Bearer '+host.token}})).json();assert.equal(stillOpen.phase,'lobby');
  await app.confirmLeave();assert.equal(app.inspect().session,null);const closed=await(await fetch(h.base+`/api/spaceship/rooms/${host.code}/state`,{headers:{Authorization:'Bearer '+host.token}})).json();assert.equal(closed.phase,'closed');
});
test('leave confirmation during another pending action keeps the participant and sends no termination',async t=>{
  const h=await setup(t),host=await h.create();let hold=false,release,commands=0;
  const app=await client(h.base,{fetcher:async(url,options)=>{if(url.endsWith('/commands'))commands++;if(hold&&url.endsWith('/state'))await new Promise(resolve=>{release=resolve;});return fetch(url,options);}});
  await app.enter('join',host.code);const original=app.inspect().session;hold=true;const resume=app.enter('resume');
  while(!release)await new Promise(resolve=>setImmediate(resolve));await app.confirmLeave();assert.ok(app.inspect().session?.token===original.token);assert.equal(commands,0);
  hold=false;release();await resume;assert.equal(app.inspect().state.phase,'lobby');
});
test('rate limiting after a lost join response preserves its ID until the original seat recovers',async t=>{
  let now=1000;const h=await setup(t,{now:()=>now}),host=await h.create(),store=new Map(),calls=[],app=await client(h.base,{store,fetcher:loseFirstPost(calls)});
  await app.enter('join',host.code);const pending=store.get(pendingKey);assert.ok(pending);
  for(let i=0;i<29;i++){
    const response=await fetch(h.base+`/api/spaceship/rooms/${host.code}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID().replaceAll('-','')})});assert.equal(response.status,409);
  }
  await app.enter('join',host.code);assert.equal(calls[1].status,429);assert.equal(calls[1].data.error,'RATE_LIMIT');assert.equal(store.get(pendingKey),pending,'temporary throttling must retain the original accepted request');
  now+=60001;await app.enter('join',host.code);assert.equal(calls[2].status,200);assert.equal(calls[2].id,calls[0].id);assert.ok(app.inspect().session?.token===calls[0].data.token);assert.equal(store.has(pendingKey),false);
});
test('lost successful leave response still exits when the next request confirms CLOSED without SSE',async t=>{
  const h=await setup(t),host=await h.create();let lose=true;
  const app=await client(h.base,{fetcher:async(url,options)=>{const response=await fetch(url,options);if(lose&&url.endsWith('/commands')&&JSON.parse(options.body).type==='leave'){lose=false;assert.equal(response.status,200);await response.arrayBuffer();throw new TypeError('Successful leave response lost');}return response;}});
  await app.enter('join',host.code);await app.confirmLeave();assert.ok(app.inspect().session);assert.equal(app.inspect().state.phase,'lobby');
  const closed=await(await fetch(h.base+`/api/spaceship/rooms/${host.code}/state`,{headers:{Authorization:'Bearer '+host.token}})).json();assert.equal(closed.phase,'closed');
  await app.confirmLeave();assert.ok(app.inspect().session===null,'confirmed server closure must permit local departure');assert.equal(app.inspect().state,null);
});
test('temporary server rejections preserve an accepted entry ID rather than losing its participant',async t=>{
  const h=await setup(t);
  for(const code of ['RATE_CAPACITY','INTERNAL','SHUTDOWN','CAPACITY','RATE_LIMIT']){
    const host=await h.create(),store=new Map(),calls=[];let step=0;
    const app=await client(h.base,{store,fetcher:async(url,options)=>{
      if(options?.method==='POST'){
        calls.push(JSON.parse(options.body).id);step++;
        if(step===2)return new Response(JSON.stringify({error:code,message:'Synthetic temporary rejection'}),{status:code==='RATE_LIMIT'?429:code==='INTERNAL'?500:503,headers:{'Content-Type':'application/json'}});
        const response=await fetch(url,options);if(step===1){await response.arrayBuffer();throw new TypeError('Accepted join response lost');}return response;
      }return fetch(url,options);
    }});
    await app.enter('join',host.code);const pending=store.get(pendingKey);await app.enter('join',host.code);assert.equal(store.get(pendingKey),pending,code+' must retain pending ID');
    await app.enter('join',host.code);assert.equal(calls[0],calls[2]);assert.ok(app.inspect().session);assert.equal(store.has(pendingKey),false);
  }
});
test('confirmed missing room permits departure after expiration even without SSE',async t=>{
  let now=1000;const h=await setup(t,{now:()=>now,roomTtl:1000}),host=await h.create(),app=await client(h.base);
  await app.enter('join',host.code);now=2001;await app.confirmLeave();assert.equal(app.inspect().session,null);assert.equal(app.inspect().state,null);
});
test('AUTH or ORIGIN rejection cannot masquerade as confirmed room closure',async t=>{
  const h=await setup(t);
  for(const kind of ['AUTH','ORIGIN']){
    const host=await h.create(),app=await client(h.base,{fetcher:async(url,options)=>fetch(url,kind==='ORIGIN'&&url.endsWith('/commands')?{...options,headers:{...options.headers,Origin:'https://foreign.invalid'}}:options)});
    await app.enter('join',host.code);if(kind==='AUTH')app.inspect().session.token='A'.repeat(32);
    await app.confirmLeave();assert.ok(app.inspect().session,kind+' must retain the participant');assert.equal(app.inspect().state.phase,'lobby');
    const view=await(await fetch(h.base+`/api/spaceship/rooms/${host.code}/state`,{headers:{Authorization:'Bearer '+host.token}})).json();assert.equal(view.phase,'lobby');
  }
});
test('a CLOSED label on an unauthorized response is not a confirmed termination',async t=>{
  const h=await setup(t),host=await h.create(),app=await client(h.base,{fetcher:async(url,options)=>url.endsWith('/commands')?new Response(JSON.stringify({error:'CLOSED',message:'Synthetic mismatched error'}),{status:401,headers:{'Content-Type':'application/json'}}):fetch(url,options)});
  await app.enter('join',host.code);await app.confirmLeave();assert.ok(app.inspect().session);assert.equal(app.inspect().state.phase,'lobby');
});
test('confirming WORLD departure after the room was forgotten still follows the selected destination',async t=>{
  const h=await setup(t),host=await h.create(),app=await client(h.base),destination=h.base+'/learning-hub/#beginner-title';
  await app.enter('join',host.code);app.openWorldLeave(destination);
  // The live stream calls this exact function on expiration/shutdown. The real
  // stream/DOM transition is exercised separately by the isolated browser test.
  app.forget();assert.equal(app.inspect().session,null);assert.equal(app.inspect().state,null);
  await app.confirmLeave();assert.equal(app.navigations.length,1);assert.equal(app.navigations[0],destination);
});
