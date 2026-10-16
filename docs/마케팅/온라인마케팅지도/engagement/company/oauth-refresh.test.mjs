import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeCode,refreshCredentials} from './oauth.mjs';

const DAY=86400000,at=Date.parse('2026-10-16T00:00:00.000Z'),iso=ms=>new Date(ms).toISOString();
const config={clientId:'synthetic-client',clientSecret:'synthetic-secret',redirectUri:'https://example.test/api/oauth/youtube/callback',code:'synthetic-code'};
const response=data=>({ok:true,status:200,json:async()=>data});

test('Google time-based refresh token expiry is retained and stops refresh after it expires',async t=>{
  t.mock.method(Date,'now',()=>at);
  const first=await exchangeCode('youtube',config,{fetchImpl:async()=>response({access_token:'first',refresh_token:'refresh',expires_in:3600,refresh_token_expires_in:7*86400,scope:'granted'})});
  assert.equal(first.refreshExpiresAt,iso(at+7*DAY));
  let requests=0;const later=await refreshCredentials('youtube',first,config,{clock:()=>iso(at+DAY),fetchImpl:async()=>{requests++;return response({access_token:'second',expires_in:3600});}});
  assert.equal(requests,1);assert.equal(later.expiresAt,iso(at+DAY+3600000));assert.equal(later.refreshExpiresAt,first.refreshExpiresAt);assert.equal(later.refreshToken,'refresh');assert.equal(later.scope,'granted');
  await assert.rejects(refreshCredentials('youtube',later,config,{clock:()=>iso(at+7*DAY),fetchImpl:async()=>{requests++;throw Error('must not request');}}),{code:'reconnect_required'});assert.equal(requests,1);
});

test('Instagram long-lived tokens renew once before expiry over simulated weeks without inventing manual expiry',async()=>{
  let requests=0;const fetchImpl=async url=>{assert.equal(new URL(url).pathname,'/refresh_access_token');requests++;return response({access_token:'renewed-'+requests,expires_in:60*86400});};
  const first={accessToken:'long-lived',authType:'instagram-login',longLived:true,metaIdentityVersion:1,accountId:'100',scope:'instagram_business_basic instagram_business_manage_comments',issuedAt:iso(at),expiresAt:iso(at+60*DAY)};
  assert.deepEqual(await refreshCredentials('instagram',first,{}, {clock:()=>iso(at+52*DAY),fetchImpl}),first);assert.equal(requests,0);
  const renewed=await refreshCredentials('instagram',first,{}, {clock:()=>iso(at+53*DAY),fetchImpl});assert.equal(requests,1);assert.equal(renewed.expiresAt,iso(at+113*DAY));assert.equal(renewed.accountId,first.accountId);assert.equal(renewed.scope,first.scope);
  assert.deepEqual(await refreshCredentials('instagram',renewed,{}, {clock:()=>iso(at+54*DAY),fetchImpl}),renewed);assert.equal(requests,1);
  await assert.rejects(refreshCredentials('instagram',renewed,{}, {clock:()=>iso(at+113*DAY),fetchImpl}),{code:'reconnect_required'});assert.equal(requests,1);
  const manual={...first,longLived:false,expiresAt:null,issuedAt:null,refreshMode:'external-manual'};assert.deepEqual(await refreshCredentials('instagram',manual,{}, {clock:()=>iso(at+180*DAY),fetchImpl}),manual);assert.equal(requests,1);
});

test('malformed refresh replies do not replace an existing expiry or account identity',async()=>{
  const current={accessToken:'old',refreshToken:'refresh',expiresAt:iso(at-1),accountId:'100',scope:'granted'};
  for(const data of [{access_token:'new'},{access_token:'new',expires_in:0},{access_token:'new',expires_in:3600,user_id:'200'},...[0,-1,'invalid',null].map(value=>({access_token:'new',expires_in:3600,refresh_token_expires_in:value}))]){
    await assert.rejects(refreshCredentials('youtube',current,config,{clock:()=>iso(at),fetchImpl:async()=>response(data)}),{code:'token_exchange_failed'});
  }
  assert.equal(current.accessToken,'old');assert.equal(current.expiresAt,iso(at-1));
});
