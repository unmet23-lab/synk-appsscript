import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./public/teaching.js',import.meta.url),'utf8');
test('company teaching boundary suspends temporary verification while retaining terminal logout semantics',async()=>{
 let state={signedIn:false,status:'restoring',account:{synk_user_id:'teacher-a'},error:{code:'ACCOUNT_VERIFY_UNAVAILABLE',message:'retry',retryable:true}},requests=0;
 const bridge={authStatus:async()=>state,accountRequest:async()=>{requests++;return {ok:true};}};
 const context=vm.createContext({state:{user:{id:'company-a'},synkUserId:'teacher-a'},window:{addEventListener(){}},bridge});
 vm.runInContext(source,context);const scoped=vm.runInContext('teachingBridgeForCompany(bridge,teachingOwner())',context);
 let result=await scoped.accountRequest('classroom',{operation:'classes'});assert.equal(result.error.status,503);assert.equal(result.error.retryable,true);assert.equal(requests,0);
 state={signedIn:false,status:'signed-out'};result=await scoped.accountRequest('classroom',{operation:'classes'});assert.equal(result.error.status,401);assert.equal(result.error.retryable,false);
 state={signedIn:true,status:'signed-in',account:{synk_user_id:'other'}};result=await scoped.accountRequest('classroom',{operation:'classes'});assert.equal(result.error.code,'ACCOUNT_MISMATCH');assert.equal(result.error.status,401);assert.equal(requests,0);
 state={signedIn:true,status:'signed-in',account:{synk_user_id:'teacher-a'}};assert.equal((await scoped.accountRequest('classroom',{operation:'classes'})).ok,true);assert.equal(requests,1);
});
