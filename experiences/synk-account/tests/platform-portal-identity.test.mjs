import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVerifiedSynkId } from '../src/platform-portal.mjs';
const canonical='80000000-0000-4000-8000-000000000001';
const auth='90000000-0000-4000-8000-000000000002';
const other='70000000-0000-4000-8000-000000000003';
const jwt=sub=>'e30.'+Buffer.from(JSON.stringify({sub})).toString('base64url')+'.synthetic';
const identity={signedIn:true,status:'signed-in',accountId:canonical,accountKey:canonical};
const raw=JSON.stringify({access_token:jwt(auth),user:{id:auth}});
const account={isAccountBound:id=>id===canonical};
const extract=changes=>extractVerifiedSynkId({identity,rawSessionString:raw,account,...changes});

test('verified canonical identity is independent of the Auth UUID and matching JWT subject',()=>{
  assert.deepEqual(extract(),{synkId:canonical,mismatch:false});
});
test('a different Auth UUID without an account-manager binding cannot prove a canonical identity',()=>{
  assert.deepEqual(extract({account:null}),{synkId:null,mismatch:true});
});
test('raw Auth UUID and JWT subject never become the returned SYNK account identifier',()=>{
  const result=extract({identity:{...identity,accountId:'legacy-local',accountKey:'legacy-local'},account:{isAccountBound:()=>true}});
  assert.equal(result.synkId,null);assert.notEqual(result.synkId,auth);
});
test('conflicting canonical identifiers remain blocked even when a binding checker returns true',()=>{
  assert.equal(extract({identity:{...identity,accountKey:other}}).mismatch,true);
  assert.equal(extract({rawSessionString:JSON.stringify({access_token:jwt(auth),accountId:other})}).mismatch,true);
});
test('a revoked or failed account-manager proof never becomes a verified canonical result',()=>{
  for(const isAccountBound of [()=>false,()=>{throw Error('synthetic revoked binding');}])
    assert.deepEqual(extract({account:{isAccountBound}}),{synkId:null,mismatch:true});
});
test('malformed or inaccessible stored sessions remain blocked',()=>{
  for(const change of [{rawSessionString:'{'},{rawSessionString:'[]'},{storageError:true}])
    assert.deepEqual(extract(change),{synkId:null,mismatch:true});
});
test('contradictory Auth subject claims remain blocked within their own namespace',()=>{
  assert.deepEqual(extract({rawSessionString:JSON.stringify({access_token:jwt(auth),user:{id:other}})}),{synkId:null,mismatch:true});
});
test('unverified email metadata cannot override a canonical account-manager proof',()=>{
  assert.deepEqual(extract({identity:{...identity,email:'canonical@example.test'},rawSessionString:JSON.stringify({access_token:jwt(auth),user:{id:auth,email:'metadata@example.test'}})}),{synkId:canonical,mismatch:false});
});
