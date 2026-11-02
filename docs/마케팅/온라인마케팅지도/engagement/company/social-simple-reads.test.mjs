import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {createSocialSimple} from './social-simple.mjs';

const NOW='2026-11-02T06:00:00.000Z',PAST='2026-11-01T06:00:00.000Z';
function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'synk-simple-reads-')),store=new Store(dir);
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const user={id:'reader',role:'member',active:true};store.put('users',user.id,user);
  const channels=[{id:'visible',platform:'youtube',handle:'synkkorean',active:true}];
  const simple=createSocialSimple({store,publishing:{summary:()=>({jobs:[],posts:[]})},marketing:{inbox:()=>[]},clock:()=>NOW});
  const post=(id,channelId='visible',extra={})=>store.put('posts',id,{id,channelId,url:'https://youtu.be/'+id,publishedAt:PAST,...extra});
  const number=(kind,id,values)=>store.put(kind,id,{checkedAt:PAST,...values});
  return {store,user,channels,post,number,read:()=>store.readScope(()=>simple.workspace(user,{channels}))};
}
test('social overview keeps the last-four window, expiry boundary and newest usable source',t=>{
  const f=fixture(t);
  for(const id of ['valid','zero','four','tie','invalid-expiry'])f.post(id);
  f.number('snapshots','valid:z',{views:999,expiresAt:NOW});
  f.number('snapshots','valid:y',{views:null});
  f.number('snapshots','valid:x',{views:10,checkedAt:'2026-11-01T01:00:00Z'});
  f.number('hypeObservations','valid:z',{views:20,checkedAt:'2026-11-01T02:00:00Z'});
  f.number('snapshots','zero:z',{views:0});
  f.number('snapshots','zero:y',{views:500});
  for(const suffix of ['z','y','x','w'])f.number('snapshots','four:'+suffix,{views:900,expiresAt:NOW});
  f.number('snapshots','four:v',{views:700}); // The fifth row must stay outside the window.
  f.number('snapshots','tie:z',{views:30});f.number('hypeObservations','tie:z',{views:300});
  f.number('snapshots','invalid-expiry:z',{views:4,expiresAt:'unknown'});
  f.post('private','hidden');f.number('snapshots','private:z',{views:99999});
  f.post('expired','visible',{expiresAt:NOW});f.number('snapshots','expired:z',{views:99999});
  f.post('gone','visible',{unavailableAt:PAST});f.number('snapshots','gone:z',{views:99999});
  const first=f.read();assert.equal(first.accounts.length,1);assert.equal(first.accounts[0].posts30,5);
  assert.equal(first.accounts[0].views30,54);
  f.number('hypeObservations','zero:z',{views:7,checkedAt:NOW});
  assert.equal(f.read().accounts[0].views30,61,'the next request must see fresh metrics');
  f.store.put('users',f.user.id,{...f.user,active:false});
  assert.throws(f.read,error=>error.status===401);
});
test('social overview reads statistics in two calls for 160 posts and excludes unrelated keys',t=>{
  const f=fixture(t);let expected=0;
  for(let i=0;i<160;i++){const id='p'+i;f.post(id);f.number('snapshots',id+':2026-11-01',{views:i});expected+=i;}
  f.number('snapshots','p0;outside',{views:99999});
  const prepare=f.store.db.prepare.bind(f.store.db);let calls=0;
  f.store.db.prepare=sql=>{const statement=prepare(sql);if(/kind='(?:snapshots|hypeObservations)'/.test(sql)){const all=statement.all.bind(statement);statement.all=(...args)=>{calls++;return all(...args);};}return statement;};
  const result=f.read();assert.equal(result.accounts[0].posts30,160);assert.equal(result.accounts[0].views30,expected);assert.equal(calls,2);
});
