import test from 'node:test';
import assert from 'node:assert/strict';
import {mountLocalWorld} from '../src/local-world.mjs';
import {createLocalWorldClient} from '../src/local-world-client.mjs';
const KEY='synk.local-world.connection.v1';
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(t,{saved=true,failPath='/api/world/account',unauthorized=false}={}){
  const nodes=new Map(),values=new Map(saved?[[KEY,JSON.stringify({token:'local-test-token'})]]:[]),calls=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,value:'CODE',checked:true,handlers:new Map(),addEventListener(name,fn){this.handlers.set(name,fn);},removeEventListener(name){this.handlers.delete(name);}});return nodes.get(id);};
  const documentObject={documentElement:{dataset:{}},getElementById:node},windowObject={addEventListener(){},removeEventListener(){}};
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  let failing=true,views=0,stopped=0,classrooms=0;
  const fetcher=async(path,options)=>{calls.push([path,options.headers.Authorization]);if(path===failPath&&failing){if(!unauthorized)throw new TypeError('temporary offline');return{ok:false,status:401,json:async()=>({code:'AUTH_REQUIRED',message:'expired'})};}return{ok:true,status:200,json:async()=>path==='/api/join'?{token:'local-test-token'}:path==='/api/student'?{learner:{id:'synthetic-learner'}}:{}};};
  const runtime=mountLocalWorld({documentObject,windowObject,storage,clientFactory:options=>createLocalWorldClient({...options,fetcher}),createView:({client})=>{views++;return{load:()=>client.load(),stop(){stopped++;}};},createClassroom:()=>{classrooms++;return{reload:async()=>{},stop(){}};}});
  t.after(()=>runtime.stop());return{runtime,node,values,calls,documentObject,recover(){failing=false;},counts:()=>({views,stopped,classrooms})};
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
