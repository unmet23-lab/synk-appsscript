'use strict';
// Suite 따라가기의 한 번 더 돌리기(retry). Workspace 직원 초대가 로그인을 기다릴 때 부른다(4단계 GPT 엔진 검수 c GA1 · GA5)
const test=require('node:test'),assert=require('node:assert/strict');
const {createSuiteFollower}=require('../src/suite-session.cjs');
const ID='00000000-0000-4000-8000-00000000000a';
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};

function fakeAuth({stored=false,status='signed-out',error=null}={}){
  const log=[];let state={status,error,account:null,signedIn:false};let initialized=false;
  const auth={log,
    status:()=>({configured:true,signedIn:state.signedIn,status:state.status,account:state.account,error:state.error}),
    bindPlatform(){return {interrupted:false};},
    async initialize(){log.push('initialize');if(initialized)return;initialized=true;if(stored)state={status:'signed-in',error:null,account:{synk_user_id:ID},signedIn:true};},
    async signOut(){log.push('signOut');state={status:'signed-out',error:null,account:null,signedIn:false};},
    async signIn(){log.push('signIn');state={status:'signing-in',error:null,account:null,signedIn:false};},
    set(next){state={...state,...next};}};
  return auth;
}
const record={status:'signed-in',generation:'g1',accountId:ID};
const follower=(auth,t)=>{const value=createSuiteFollower({store:{read:()=>record},auth,schedule:()=>null,unschedule(){}});t.after(()=>value.dispose());return value;};

test('retry before the first follow restores a stored login instead of signing in again (c GA1)',async t=>{
  const auth=fakeAuth({stored:true}),f=follower(auth,t);
  f.start();f.retry();await settle();
  assert.deepEqual(auth.log,['initialize'],'the stored login is read first and is enough');
  assert.equal(auth.status().signedIn,true);
});

test('after the person signed Workspace out, the same platform generation is followed again only on retry',async t=>{
  const auth=fakeAuth({stored:true}),f=follower(auth,t);
  await f.start();await settle();auth.log.length=0;
  auth.set({status:'signed-out',signedIn:false,account:null});
  await f.refresh();await settle();assert.deepEqual(auth.log,[],'the timer alone does not sign in again for the same generation');
  f.retry();await settle();
  assert.deepEqual(auth.log,['initialize','signOut','signIn']);
});

test('a retryable error is left alone by the timer but retried on retry (c GA5)',async t=>{
  const auth=fakeAuth({status:'error',error:{retryable:true}}),f=follower(auth,t);
  await f.start();await settle();
  assert.deepEqual(auth.log,['initialize'],'the timer waits on a retryable error');
  auth.log.length=0;f.retry();await settle();
  assert.deepEqual(auth.log,['initialize','signOut','signIn']);
});

test('retry leaves a restore or a sign-in under way alone, and does nothing once disposed',async t=>{
  for(const status of ['restoring','signing-in']){
    const auth=fakeAuth({stored:true}),f=follower(auth,t);
    await f.start();await settle();auth.log.length=0;auth.set({status,signedIn:false,account:null});
    f.retry();await settle();assert.deepEqual(auth.log,[],status);
  }
  const auth=fakeAuth(),f=follower(auth,t);f.dispose();f.retry();await settle();assert.deepEqual(auth.log,[]);
  const broken=fakeAuth();broken.status=()=>{throw Error('합성');};const g=follower(broken,t);
  assert.doesNotThrow(()=>g.retry(),'an unreadable status does not throw');await settle();
});
