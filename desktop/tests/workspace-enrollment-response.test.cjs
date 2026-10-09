'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {redactAccountResponse,redact}=require('../src/account-requests.cjs');
test('native invitation result exposes only a validated teacher-issued enrollment code',()=>{
  const token='a'.repeat(32),payload={ok:true,invite:{token,expiresAt:'2099-01-01',access_token:'synthetic'},nested:{token:'synthetic',refresh_token:'synthetic'},token:'synthetic'};
  const result=redactAccountResponse(payload,'classroom',{operation:'enrollmentInvite'});
  assert.equal(result.invite.token,token);assert.equal(result.invite.expiresAt,'2099-01-01');assert.equal(result.invite.access_token,undefined);assert.deepEqual(result.nested,{});assert.equal(result.token,undefined);
  assert.equal(redact(payload).invite.token,undefined);
  assert.equal(redactAccountResponse(payload,'classroom',{operation:'classes'}).invite.token,undefined);
  assert.equal(redactAccountResponse(payload,'load',{operation:'enrollmentInvite'}).invite.token,undefined);
  for(const token of ['invalid','A'.repeat(32),'a'.repeat(33)])assert.equal(redactAccountResponse({ok:true,invite:{token}},'classroom',{operation:'enrollmentInvite'}).invite.token,undefined);
});
test('failed invitation responses cannot expose enrollment codes',()=>{
  assert.equal(redactAccountResponse({ok:false,invite:{token:'a'.repeat(32)}},'classroom',{operation:'enrollmentInvite'}).invite.token,undefined);
});
