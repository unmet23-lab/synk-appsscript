import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createSignupConversion } from '../src/social-signup-conversion.mjs';
const stamp=Date.parse('2026-10-13T00:00:00Z'),clickId='a'.repeat(32);
const user={id:'synthetic-new-user',created_at:new Date(stamp).toISOString(),email_confirmed_at:new Date(stamp+1000).toISOString(),identities:[{provider:'email'}]};
function fixture(){const calls=[],data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};const conversion={attribution:()=>clickId,record:async(...args)=>{calls.push(args);return {ok:true};}};return {calls,data,storage,conversion,service:createSignupConversion({storage,conversion,cryptoAPI:webcrypto,now:()=>stamp+2000})};}
test('email request is pending until the same fresh account is verified; reload does not duplicate',async()=>{
  const f=fixture();await f.service.rememberEmail({data:{user}},stamp);assert.equal(f.calls.length,0);
  assert.equal((await f.service.confirmedUser({...user,email_confirmed_at:null})).ok,false);
  assert.equal((await f.service.confirmedUser({...user,id:'different-user'})).ok,false);
  const restored=createSignupConversion({...f,cryptoAPI:webcrypto,now:()=>stamp+2000});assert.equal((await restored.confirmedUser(user)).ok,true);assert.equal((await restored.confirmedUser(user)).ok,false);
  assert.equal(f.calls.length,1);assert.deepEqual(Object.keys(f.calls[0][1]).sort(),['clickId','eventId']);assert.doesNotMatch(JSON.stringify([...f.data.values()]),/synthetic-new-user/);
});
test('existing account responses, errors, and old creation dates never become signups',async()=>{
  for(const result of [{error:Error('failed'),data:{user}},{data:{user:{...user,identities:[]}}},{data:{user:{...user,created_at:'2020-01-01T00:00:00Z'}}}]){const f=fixture();assert.equal((await f.service.rememberEmail(result,stamp)).ok,false);await f.service.confirmedUser(user);assert.equal(f.calls.length,0);}
});
test('confirmed callback can race the signup digest without losing or duplicating the event',async()=>{
  const f=fixture();void f.service.rememberEmail({data:{user}},stamp);await Promise.all([f.service.confirmedUser(user),f.service.confirmedUser(user)]);assert.equal(f.calls.length,1);
});
test('Google event requires actual successful registration result; tracking failure remains isolated',async()=>{
  const f=fixture();for(const r of [{ok:true},{ok:false},{ok:true,account:{status:'active'},registration:null}])await f.service.googleCompleted(r);assert.equal(f.calls.length,0);
  await f.service.googleCompleted({ok:true,account:{status:'active'},registration:{version:'google-registration-1'}});assert.equal(f.calls.length,1);
  f.conversion.record=async()=>{throw Error('offline');};assert.equal((await f.service.googleCompleted({ok:true,account:{status:'active'},registration:{version:'google-registration-1'}})).ok,false);
});
