'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const pause=()=>new Promise(resolve=>setImmediate(resolve));
test('PC alert toggle submits the chosen value before pending rendering restores controls',async t=>{
  const {mountCareNotifications}=await import('../renderer/care-notifications.mjs');
  const names=['[data-care-enabled]','[data-care-hour]','[data-care-status]','[data-care-test]','button[type="submit"]','form'],nodes=new Map(names.map(name=>[name,{checked:false,disabled:false,value:'',textContent:''}]));
  const section={querySelector:name=>nodes.get(name)},previous=globalThis.document;
  globalThis.document={createElement:()=>section};t.after(()=>{globalThis.document=previous;});
  const calls=[];let state={ok:true,available:true,signedIn:true,enabled:false,hour:9,minute:0};
  mountCareNotifications({container:{prepend:()=>{}},bridge:{careNotifications:{status:async()=>({...state}),configure:async patch=>{calls.push(patch);state={...state,...patch};return state;},test:async()=>({ok:true,test:true}),onChanged:()=>{}},onAuthChanged:()=>{}}});
  await pause();const input=nodes.get('[data-care-enabled]');input.checked=true;input.onchange();await pause();assert.deepEqual(calls,[{enabled:true}]);assert.equal(input.checked,true);
  input.checked=false;input.onchange();await pause();assert.deepEqual(calls,[{enabled:true},{enabled:false}]);assert.equal(input.checked,false);assert.equal(state.hour,9);
});
