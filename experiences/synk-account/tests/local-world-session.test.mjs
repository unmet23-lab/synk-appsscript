import test from 'node:test';
import assert from 'node:assert/strict';
import {mountLocalWorld} from '../src/local-world.mjs';
import {createLocalWorldClient} from '../src/local-world-client.mjs';
const KEY='synk.local-world.connection.v1';
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(t,{saved=true,failPath='/api/world/account',unauthorized=false}={}){
  const nodes=new Map(),values=new Map(saved?[[KEY,JSON.stringify({token:'local-test-token'})]]:[]),calls=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,value:'CODE',checked:true,handlers:new Map(),addEventListener(name,fn){this.handlers.set(name,fn);},removeEventListener(name){this.handlers.delete(name);}});return nodes.get(id);};
  const windowHandlers=new Map();
  const documentObject={documentElement:{dataset:{}},getElementById:node},windowObject={addEventListener(name,fn){windowHandlers.set(name,fn);},removeEventListener(name){windowHandlers.delete(name);}};
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  let failing=true,views=0,stopped=0,classrooms=0;const deferred=new Map();
  const fetcher=async(path,options)=>{calls.push([path,options.headers.Authorization]);const waiting=deferred.get(path);if(waiting){deferred.delete(path);await waiting;}if(path===failPath&&failing){if(!unauthorized)throw new TypeError('temporary offline');return{ok:false,status:401,json:async()=>({code:'AUTH_REQUIRED',message:'expired'})};}return{ok:true,status:200,json:async()=>path==='/api/join'?{token:'local-test-token'}:path==='/api/student'?{learner:{id:'synthetic-learner'}}:{}};};
  const runtime=mountLocalWorld({documentObject,windowObject,storage,clientFactory:options=>createLocalWorldClient({...options,fetcher}),createView:({client})=>{views++;return{load:()=>client.load(),stop(){stopped++;}};},createClassroom:()=>{classrooms++;return{reload:async()=>{},stop(){}};}});
  t.after(()=>runtime.stop());return{runtime,node,values,calls,documentObject,windowHandlers,recover(){failing=false;},fail(){failing=true;},deferNext(path){let release;deferred.set(path,new Promise(resolve=>{release=resolve;}));return release;},counts:()=>({views,stopped,classrooms})};
}
test('restored connection survives temporary account failure and explicit retry reuses the same token',async t=>{
  const f=fixture(t);await settle();assert.equal(f.documentObject.documentElement.dataset.localWorld,'retry');assert(f.values.has(KEY));assert.equal(f.node('local-join').hidden,true);assert.equal(f.node('local-reconnect').hidden,false);assert.equal(f.counts().stopped,1);
  f.recover();f.node('local-retry-button').handlers.get('click')();await settle();assert.equal(f.documentObject.documentElement.dataset.localWorld,'connected');assert.equal(f.counts().classrooms,1);assert(f.calls.filter(([path])=>path==='/api/world/account').every(([,token])=>token==='Bearer local-test-token'));assert.equal(f.calls.filter(([path])=>path==='/api/join').length,0);
});
test('successful one-time join retains token when the later classroom request fails',async t=>{
  const f=fixture(t,{saved:false,failPath:'/api/student'});await f.node('local-join-form').handlers.get('submit')({preventDefault(){}});await settle();assert.equal(f.documentObject.documentElement.dataset.localWorld,'retry');assert(f.values.has(KEY));assert.equal(f.node('connection-code').value,'');
  f.recover();f.node('local-retry-button').handlers.get('click')();await settle();assert.equal(f.documentObject.documentElement.dataset.localWorld,'connected');assert.equal(f.calls.filter(([path])=>path==='/api/join').length,1);
});
test('confirmed unauthorized clears connection and does not offer retry with a revoked token',async t=>{
  const f=fixture(t,{unauthorized:true});await settle();assert.equal(f.documentObject.documentElement.dataset.localWorld,'disconnected');assert.equal(f.values.has(KEY),false);assert.equal(f.node('local-reconnect').hidden,true);assert.equal(f.node('local-join').hidden,false);assert.equal(f.counts().classrooms,0);
});

test('back-forward cache return rechecks the saved session and recreates the stopped learning host',async t=>{
  const f=fixture(t,{failPath:null});await settle();
  assert.equal(f.counts().classrooms,1);
  f.windowHandlers.get('pagehide')({persisted:true});
  assert.equal(f.counts().stopped,1);
  f.windowHandlers.get('pageshow')?.({persisted:true});await settle();
  assert.equal(f.counts().classrooms,2);
  assert.equal(f.documentObject.documentElement.dataset.localWorld,'connected');
  assert.equal(f.calls.filter(([path])=>path==='/api/world/account').length,2);
  assert.equal(f.calls.filter(([path])=>path==='/api/join').length,0);
  assert(f.values.has(KEY));
});

test('normal pageshow never duplicates a mount and disposing removes the resume listener',async t=>{
  const f=fixture(t,{failPath:null});await settle();
  f.windowHandlers.get('pageshow')?.({persisted:false});await settle();
  assert.equal(f.counts().classrooms,1);
  f.runtime.stop();assert.equal(f.windowHandlers.size,0);
});

test('an expired session on history return clears the old learning account',async t=>{
  const f=fixture(t,{unauthorized:true});await settle();f.recover();
  await f.node('local-join-form').handlers.get('submit')({preventDefault(){}});await settle();
  assert.equal(f.counts().classrooms,1);f.fail();
  f.windowHandlers.get('pagehide')({persisted:true});f.windowHandlers.get('pageshow')({persisted:true});await settle();
  assert.equal(f.documentObject.documentElement.dataset.localWorld,'disconnected');
  assert.equal(f.values.has(KEY),false);assert.equal(f.counts().classrooms,1);
});

test('a previous suspended request cannot block or tear down a newer history return',async t=>{
  const f=fixture(t,{failPath:null});await settle();
  const release=f.deferNext('/api/world/account');
  f.windowHandlers.get('pagehide')({persisted:true});f.windowHandlers.get('pageshow')({persisted:true});await settle();
  f.windowHandlers.get('pagehide')({persisted:true});f.windowHandlers.get('pageshow')({persisted:true});await settle();
  assert.equal(f.documentObject.documentElement.dataset.localWorld,'connected');assert.equal(f.counts().classrooms,2);
  release();await settle();
  assert.equal(f.counts().classrooms,2);assert.equal(f.documentObject.documentElement.dataset.localWorld,'connected');
  assert.equal(f.node('local-retry-button').disabled,false);
});
