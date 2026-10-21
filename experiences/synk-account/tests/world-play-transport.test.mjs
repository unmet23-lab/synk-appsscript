import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createDesktopAccountClient} from '../src/desktop-account.mjs';
import {rememberWorldPlayEntry,peekWorldPlayEntry,takeWorldPlayEntry,worldGameHref} from '../src/world-play-entry.mjs';
const {createAccountClient}=createRequire(import.meta.url)('../src/generated/account-client.cjs');
const envelope=()=>({ok:true,scope:'synk-play',accountId:'synthetic-world',revision:4,state:{wallet:{},records:{},imported:false}});
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
const config={url:'https://account.example.test',anonKey:'public-synthetic',product:'world',getAccessToken:()=> 'synthetic-current',guard(){}};

test('web play uses a fixed authenticated endpoint and only exposes its envelope',async()=>{
  const calls=[],client=createAccountClient({...config,fetch:async(...args)=>{calls.push(args);return response({...envelope(),access_token:'synthetic-redaction',result:{ok:true},duplicate:true});}});
  const read=await client.play.load(),body={action:'wallet',id:'00000000-0000-4000-8000-000000000001',method:'buyItem',args:['ship-keepsake-starbook']};await client.play.mutate(body);
  assert.equal(read.access_token,undefined);assert.equal(read.duplicate,true);assert.equal(read.result.ok,true);assert.equal(client.getAccessToken,undefined);
  assert.deepEqual(calls.map(([url,options])=>[url,options.method]),[['https://account.example.test/functions/v1/synk-play','GET'],['https://account.example.test/functions/v1/synk-play','POST']]);
  assert.equal(calls[0][1].headers.Authorization,'Bearer synthetic-current');assert.deepEqual(JSON.parse(calls[1][1].body),body);
  await assert.rejects(client.play.mutate(),{code:'INVALID_REQUEST'});
  await assert.rejects(createAccountClient({...config,product:'platform'}).play.load(),{code:'PRODUCT_FORBIDDEN'});
});

test('web play preserves refresh, conflict revision, malformed and late-session protections',async()=>{
  let count=0,refreshes=0,live=true,release;
  const client=createAccountClient({...config,guard(){if(!live)throw Object.assign(Error('changed'),{code:'ACCOUNT_CHANGED'});},refresh:async()=>{refreshes++;return 'synthetic-renewed';},fetch:async(_url,options)=>{
    count++;if(count===1)return response({ok:false,error:{code:'AUTH_REQUIRED'}},401);
    if(count===2){assert.equal(options.headers.Authorization,'Bearer synthetic-renewed');return response(envelope());}
    if(count===3)return response({ok:false,error:{code:'REVISION_CONFLICT'},revision:9},409);
    if(count===4)return response({...envelope(),scope:'wrong'});
    await new Promise(resolve=>{release=resolve;});return response(envelope());
  }});
  await client.play.load();assert.equal(refreshes,1);await assert.rejects(client.play.load(),{code:'REVISION_CONFLICT',revision:9});await assert.rejects(client.play.load(),{code:'INVALID_RESPONSE'});
  const pending=client.play.load();await Promise.resolve();live=false;release();await assert.rejects(pending,{code:'ACCOUNT_CHANGED'});
});

test('desktop play delegates only fixed IPC operations and fences late results',async()=>{
  const calls=[];let live=true,release;
  const client=createDesktopAccountClient({product:'world',guard(){if(!live)throw Object.assign(Error('changed'),{code:'ACCOUNT_CHANGED'});},bridge:{accountRequest:async(...args)=>{calls.push(args);if(args[0]==='playLoad')return envelope();return new Promise(resolve=>{release=resolve;});}}});
  await client.play.load();const body={action:'wallet',id:'id',method:'buyItem',args:['x']},waiting=client.play.mutate(body);live=false;release(envelope());await assert.rejects(waiting,{code:'ACCOUNT_CHANGED'});
  assert.deepEqual(calls,[['playLoad',{}],['playMutate',body]]);assert.equal(client.getAccessToken,undefined);
});

test('the OAuth handoff accepts only the fixed WORLD hub and expires after ten minutes',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},url='https://world.example.test/account/client.html?product=world&play=learning-hub',replaced=[];
  rememberWorldPlayEntry({url,storage,now:100});assert.equal(takeWorldPlayEntry({url:url.split('&play')[0],storage,now:200}),'learning-hub');assert.equal(takeWorldPlayEntry({url:'https://world.example.test/',storage,now:200}),null);
  rememberWorldPlayEntry({url,storage,now:100});assert.equal(takeWorldPlayEntry({url:'https://world.example.test/',storage,now:600101}),null);
  for(const bad of ['https://example.test/?product=world&play=https://evil.invalid','https://example.test/?product=platform&play=learning-hub']){rememberWorldPlayEntry({url:bad,storage});assert.equal(takeWorldPlayEntry({url:bad,storage}),null);}
  assert.equal(takeWorldPlayEntry({url,storage,replace:value=>replaced.push(value)}),'learning-hub');assert.equal(replaced[0],'https://world.example.test/account/client.html?product=world');
});

test('WORLD game destinations preserve native/local paths and public try slugs',()=>{
  assert.equal(worldGameHref('learning-hub','http://127.0.0.1:4340/synk-account/client.html?product=world'),'http://127.0.0.1:4340/learning-hub/');
  assert.equal(worldGameHref('korean-racing','https://synk.im/account/client.html?product=world'),'https://synk.im/try/racing/');
  assert.equal(worldGameHref('learning-hub','https://synk.im/account/client.html?product=world'),'https://synk.im/try/learning-hub/');
  assert.throws(()=>worldGameHref('https://evil.invalid','https://synk.im/account/client.html'));
});

test('named WORLD game choice survives OAuth once and rejects arbitrary or ambiguous destinations',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 for(const path of ['korean-runner','korean-rhythm']){rememberWorldPlayEntry({url:'https://synk.im/account/client.html?product=world&play='+path,storage,now:100});assert.equal(takeWorldPlayEntry({url:'https://synk.im/account/client.html?product=world&code=fixture',storage,now:101}),path);assert.equal(takeWorldPlayEntry({url:'https://synk.im/account/client.html?product=world',storage,now:102}),null);}
 for(const play of ['https://evil.invalid','../private','korean-runner&play=korean-rhythm']){rememberWorldPlayEntry({url:'https://synk.im/account/client.html?product=world&play=learning-hub',storage,now:100});assert.equal(takeWorldPlayEntry({url:'https://synk.im/account/client.html?product=world&play='+play,storage,now:101,replace(){}}),null);assert.equal(values.size,0);}
});

test('class selection can inspect a personal play intent without consuming the OAuth handoff',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const url='https://synk.im/account/client.html?product=world';rememberWorldPlayEntry({url:url+'&play=korean-runner',storage,now:100});
 assert.equal(peekWorldPlayEntry({url,storage,now:101}),'korean-runner');assert.equal(peekWorldPlayEntry({url,storage,now:102}),'korean-runner');assert.equal(values.size,1);
 assert.equal(takeWorldPlayEntry({url,storage,now:103}),'korean-runner');assert.equal(values.size,0);
});
