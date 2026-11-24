import assert from 'node:assert/strict';
import {setImmediate as settle} from 'node:timers/promises';
import {test} from 'node:test';
import {createOrbRooms} from '../renderer/orb-rooms.mjs';
import {settingsRoom} from '../renderer/solio-rooms.mjs';
const rowFor=(model,member=true)=>settingsRoom({member,chatgpt:model}).rows.find(v=>v.key==='chatgpt');
const acts=row=>row?.more.filter(([kind])=>kind==='acts').flatMap(([,list])=>list.map(entry=>entry[1]))||[];
test('member sees partner and entitlement states with only the corresponding action',()=>{
  const model=state=>({ok:true,state,verifiedAt:Date.UTC(2026,1,1)});
  assert.equal(rowFor(model('connected'),false),undefined);
  assert.equal(rowFor(null),undefined);
  for(const [state, expected] of [
    ['disconnected',['chatgpt-connect']],['connecting',['chatgpt-cancel']],
    ['connected',['chatgpt-disconnect']],['recheck',['chatgpt-connect','chatgpt-disconnect']]
  ]){
    const row=rowFor(model(state));
    assert.equal(row.nm,'ChatGPT 연결');assert.deepEqual(acts(row),expected);
    if(state==='connected')assert.match(JSON.stringify(row.more),/요금제/);
  }
  // 등록 전에는 누를 것이 없어 줄을 세우지 않고, 연결을 주지 않는 PC(Mac)의 답도 「상태 확인 필요」 줄이 되지 않는다
  assert.equal(rowFor(model('pending-approval')),undefined);
  assert.equal(rowFor({ok:true,state:'unavailable',code:'NOT_AVAILABLE'}),undefined);
  assert.equal(rowFor({ok:true,state:'unavailable',code:'IPC_FAILED'}).nm,'ChatGPT 연결','읽기 실패는 그대로 알린다');
});
test('settings follows status changes and rejects late replies, guest actions and stale connections',async()=>{
  const late=Promise.withResolvers();let reads=0,clicked=0,unsub=0,listener;
  let state='pending-approval';
  const chatgpt={status:()=>++reads===1?late.promise:Promise.resolve({ok:true,state}),connect:async()=>{clicked++;state='connecting';listener();return {ok:true,state};},cancel:async()=>{state='disconnected';listener();return {ok:true,state};},disconnect:async()=>({ok:false,code:'STORAGE_UNAVAILABLE'}),onChange:fn=>{listener=fn;return ()=>{unsub++;listener=null;};}};
  const rooms=createOrbRooms({pc:{chatgpt}});
  const scene=member=>rooms.scene({aside:'settings',member}).settings.rows.find(v=>v.key==='chatgpt');
  rooms.open('settings');scene(true);await settle();
  rooms.accountChanged();await settle();late.resolve({ok:true,state:'connected'});await settle();
  assert.deepEqual(acts(scene(true)),[]);
  await rooms.handle({key:'chatgpt',act:'chatgpt-connect'});assert.equal(clicked,0);
  state='disconnected';listener();await settle();
  assert.equal(scene(false),undefined);
  await rooms.handle({key:'chatgpt',act:'chatgpt-connect'});assert.equal(clicked,0);
  assert.deepEqual(acts(scene(true)),['chatgpt-connect']);
  await rooms.handle({key:'chatgpt',act:'chatgpt-connect'});await settle();
  assert.equal(clicked,1);assert.deepEqual(acts(scene(true)),['chatgpt-cancel']);
  await rooms.handle({key:'chatgpt',act:'chatgpt-cancel'});await settle();
  assert.deepEqual(acts(scene(true)),['chatgpt-connect']);
  state='connected';listener();await settle();
  await rooms.handle({key:'chatgpt',act:'chatgpt-disconnect'});
  const message=scene(true).more.find(([kind])=>kind==='live')?.[1];
  assert.match(message,/해제/);
  rooms.close();assert.equal(unsub,1);
});

