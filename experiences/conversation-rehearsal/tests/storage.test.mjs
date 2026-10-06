import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSaved, saveSessions, removeSaved, STORAGE_KEY, createImportController } from '../storage.mjs';
import { createSession, appendTurn, archive } from '../domain.mjs';
const store = () => {const data=new Map();return {data,getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const session = () => {let s=createSession({scenario:'refusal',counterpart:'지인',goal:'거절',id:'one'});for(let i=0;i<3;i++)s=appendTurn(s,{answer:'거절하는 말',review:'stuck',focus:'pressure'});return s;};
test('device memory starts off, explicit save survives reload, deletion disables it',()=>{
  const storage=store();assert.deepEqual(loadSaved(storage),{enabled:false,sessions:[],error:''});
  assert.equal(storage.data.size,0);
  assert.equal(saveSessions(storage,[session()]).ok,true);
  assert.equal(loadSaved(storage).sessions[0].scenario,'refusal');assert.equal(loadSaved(storage).enabled,true);
  removeSaved(storage);assert.equal(loadSaved(storage).enabled,false);assert.equal(storage.data.size,0);
});
test('corruption/quota/denied deletion never reports saved success',()=>{
  const storage=store();storage.setItem(STORAGE_KEY,'bad json');const load=loadSaved(storage);assert.equal(load.enabled,false);assert.ok(load.error);
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('quota');},removeItem(){throw Error('denied');}};
  assert.ok(loadSaved(denied).error);assert.equal(saveSessions(denied,[session()]).ok,false);assert.equal(removeSaved(denied).ok,false);
});
test('late import reads cannot commit after route changes or newer selections',async()=>{
  const controller=createImportController();
  let complete;
  const pending=controller.read({size:100,text:()=>new Promise(resolve=>{complete=resolve;})});
  controller.invalidate();
  complete('not even valid JSON');
  assert.deepEqual(await pending,{status:'cancelled'});
  let first;
  const older=controller.read({size:100,text:()=>new Promise(resolve=>{first=resolve;})});
  const newer=await controller.read({size:100,text:async()=>JSON.stringify(archive([session()]))});
  assert.equal(newer.status,'ready');
  first('{}');assert.deepEqual(await older,{status:'cancelled'});
});
