// WORLD 입장 관문의 offer 단계(공개판 설계 §2): 로그인 뒤 이 기기의 손님 기록을 옮길지 묻는 판은 튜터 고르기 앞에서 열리고,
// 고르거나 닫으면 관문이 이어진다. 그동안 계정이 바뀌면 옛 계정으로 들어가지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldEntryGate} from '../tutor-selection-sync.mjs';

function gate({offer=null,tutor='mongle'}={}){
 const states=[],entered=[];let identity={owner:'acct-a',generation:1,tutor},chooseCalls=0;
 const value=createWorldEntryGate({restore:async()=>{},prepare:async()=>true,read:()=>({...identity}),
  choose:async enter=>{chooseCalls++;identity={...identity,tutor:'mongle'};enter();},offer,
  onState:state=>states.push(state.phase),onEnter:latest=>entered.push(latest.owner)});
 return {gate:value,states,entered,set:next=>{identity={...identity,...next};},chooses:()=>chooseCalls};
}

test('without anything to offer the gate enters exactly as before',async()=>{
 const f=gate({offer:()=>null});
 assert.equal(await f.gate.start(),true);
 assert.deepEqual(f.states,['restoring','ready']);assert.deepEqual(f.entered,['acct-a']);
});

test('an offer shows between restoring and the tutor step, and the gate continues after it',async()=>{
 let finish;const offered=[];
 const f=gate({tutor:null,offer:value=>{offered.push(value.owner);return new Promise(resolve=>{finish=resolve;});}});
 const started=f.gate.start();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(f.states,['restoring','offering']);assert.equal(f.chooses(),0,'the tutor chooser waits for the offer');
 finish('moved');
 assert.equal(await started,true);
 assert.deepEqual(f.states,['restoring','offering','choosing','ready']);assert.deepEqual(offered,['acct-a']);assert.equal(f.chooses(),1);
});

test('a broken offer never blocks the entrance',async()=>{
 const sync=gate({offer:()=>{throw Error('synthetic');}});
 assert.equal(await sync.gate.start(),true);assert.deepEqual(sync.states,['restoring','ready']);
 const rejected=gate({offer:()=>Promise.reject(Error('synthetic'))});
 assert.equal(await rejected.gate.start(),true);assert.deepEqual(rejected.states,['restoring','offering','ready']);
});

test('an account change while the offer is open restarts the gate instead of entering the old account',async()=>{
 let finish,calls=0;
 const f=gate({offer:()=>{calls++;return calls===1?new Promise(resolve=>{finish=resolve;}):null;}});
 const started=f.gate.start();
 await new Promise(resolve=>setTimeout(resolve,0));
 f.set({owner:'acct-b',generation:2});finish('dismissed');
 assert.equal(await started,false);
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(f.entered,['acct-b'],'only the new account enters');assert.equal(calls,2,'the new account is asked on its own');
});

test('invalidating the gate during the offer drops that entrance',async()=>{
 let finish;const f=gate({offer:()=>new Promise(resolve=>{finish=resolve;})});
 const started=f.gate.start();
 await new Promise(resolve=>setTimeout(resolve,0));
 f.gate.invalidate();finish('kept');
 assert.equal(await started,false);assert.deepEqual(f.entered,[]);
});
