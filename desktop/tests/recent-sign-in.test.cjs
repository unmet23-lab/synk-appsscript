'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const mod=import('../renderer/recent-sign-in.mjs');
const memory=()=>{const map=new Map();return {map,getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};};

test('the sign-in dialog remembers only a masked address and names the way only when there is one',async()=>{
  const {rememberSignIn,recentSignIn,recentSignInText,forgetSignIn,RECENT_SIGN_IN_KEY}=await mod,storage=memory();
  assert.equal(rememberSignIn(storage,{email:'member@synthetic.test',identities:[{provider:'google'}]},1000),true);
  assert.deepEqual(JSON.parse(storage.map.get(RECENT_SIGN_IN_KEY)),{v:1,masked:'me***@synthetic.test',way:'google',at:1000});
  assert.equal(recentSignInText(recentSignIn(storage)),'지난번 이 PC: me***@synthetic.test · Google — 브라우저의 SYNK ID에서 로그인했어요.');
  // An account with both ways: this app cannot know which one the browser used, so it does not say.
  rememberSignIn(storage,{email:'member@synthetic.test',identities:[{provider:'email'},{provider:'google'}]},2000);
  assert.equal(recentSignIn(storage).way,null);assert.doesNotMatch(recentSignInText(recentSignIn(storage)),/Google|이메일 ·/);
  assert.doesNotMatch(storage.map.get(RECENT_SIGN_IN_KEY),/member@/);
  forgetSignIn(storage);assert.equal(recentSignIn(storage),null);
});

test('foreign or broken values give no hint and storage failures never throw',async()=>{
  const {rememberSignIn,recentSignIn,RECENT_SIGN_IN_KEY}=await mod,storage=memory();
  for(const raw of ['{','null','{"v":1,"masked":"<b>@x","at":1}','{"v":2,"masked":"a*@b.test","at":1}','{"v":1,"masked":"full-address@b.test","at":1}'])
  {storage.map.set(RECENT_SIGN_IN_KEY,raw);assert.equal(recentSignIn(storage),null,raw);}
  assert.equal(rememberSignIn(storage,{email:'not-an-address'}),false);
  const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}};
  assert.equal(rememberSignIn(blocked,{email:'a@b.test',identities:[]}),false);assert.equal(recentSignIn(blocked),null);
});
