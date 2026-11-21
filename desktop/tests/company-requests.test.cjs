'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCompanyRequests}=require('../src/company-requests.cjs');
function fixture(){
  const calls=[];let tokenCalls=0;
  const request=createCompanyRequests({entry:'https://company.example.invalid/?tab=messenger',clientId:'messenger',auth:{getAccessToken:async()=>{tokenCalls++;return 'synthetic-main-token';}},session:{fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({ok:true,access_token:'synthetic-redacted-token'}),{headers:{'Content-Type':'application/json'}});}}});
  return {request,calls,tokenCalls:()=>tokenCalls};
}
test('company rejects inherited, unknown and non-string operations before credentials or transport',async()=>{
  const f=fixture();let coerced=0;
  const inputs=['__proto__','constructor','toString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','__defineGetter__','../logout','https://other.example.invalid/','unknown','',undefined,null,0,Symbol('status'),['status'],new String('status'),{toString(){coerced++;return 'status';}}];
  for(const operation of inputs){const result=await f.request(operation,{});assert.equal(result.ok,false);assert.equal(result.error.code,'INVALID_REQUEST');}
  assert.equal(f.calls.length,0);assert.equal(f.tokenCalls(),0);assert.equal(coerced,0);
});
test('all existing company operations retain fixed routes, confirmations, CSRF and native token rules',async()=>{
  const f=fixture(),cases=[
    ['status',{},'/api/synk-id/status',null],
    ['challenge',{action:'login'},'/api/synk-id/challenge',{action:'login'}],
    ['challenge',{action:'link',currentPassword:'synthetic-password',csrfToken:'synthetic-csrf',confirm:true},'/api/synk-id/challenge',{action:'link',confirm:true,currentPassword:'synthetic-password'}],
    ['challenge',{action:'unlink',currentPassword:'synthetic-password',csrfToken:'synthetic-csrf',confirm:true},'/api/synk-id/challenge',{action:'unlink',confirm:true,currentPassword:'synthetic-password'}],
    ['exchange',{challenge:'synthetic-challenge',confirm:true},'/api/synk-id/exchange',{challenge:'synthetic-challenge',confirm:true}],
    ['renew',{csrfToken:'synthetic-csrf'},'/api/synk-id/renew',{}],
    ['logout',{csrfToken:'synthetic-csrf'},'/api/logout',{}],
  ];
  for(const [operation,params,route,body] of cases){
    const result=await f.request(operation,params);assert.equal(result.ok,true);assert.equal(result.access_token,undefined);
    const {url,options}=f.calls.at(-1);assert.equal(url,'https://company.example.invalid'+route);assert.equal(options.method,operation==='status'?'GET':'POST');
    assert.equal(options.headers.Origin,'https://company.example.invalid');assert.equal(options.credentials,'include');assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,['exchange','renew'].includes(operation)?'Bearer synthetic-main-token':undefined);
    assert.equal(options.headers['X-CSRF-Token'],params.csrfToken);assert.equal(options.headers['Content-Type'],operation==='status'?undefined:'application/json');
    if(body===null)assert.equal(options.body,undefined);else assert.deepEqual(JSON.parse(options.body),body);
  }
  assert.equal(f.calls.length,cases.length);assert.equal(f.tokenCalls(),2);
});

// 4단계 GPT 엔진 검수 c GA4 · d GA1: Workspace 뷰의 통은 보내기 바로 앞에서 지금 계정의 것인지 본다
test('a Workspace jar checks it is still current right before sending, after the token await',async()=>{
  const calls=[];let live=true;
  const request=createCompanyRequests({entry:'https://company.example.invalid/?tab=messenger',clientId:'messenger',
    auth:{getAccessToken:async()=>{queueMicrotask(()=>{live=false;});return 'synthetic-main-token';},current:()=>live},
    session:{fetch:async(url,options)=>{calls.push(url);return {ok:true,text:async()=>'{}'};}}});
  const renewed=await request('renew',{csrfToken:'synthetic-csrf'});
  assert.equal(renewed.ok,false);assert.equal(renewed.error.code,'WORKSPACE_ACCOUNT_CHANGED');
  assert.deepEqual(calls,[],'the account changed while the token was awaited, so nothing is sent');
  live=false;assert.equal((await request('logout',{csrfToken:'synthetic-csrf'})).error.code,'WORKSPACE_ACCOUNT_CHANGED');assert.deepEqual(calls,[]);
  live=true;const sent=createCompanyRequests({entry:'https://company.example.invalid/?tab=messenger',clientId:'messenger',
    auth:{getAccessToken:async()=>'synthetic-main-token',current:()=>live},session:{fetch:async url=>{calls.push(url);return {ok:true,text:async()=>'{}'};}}});
  assert.notEqual((await sent('renew',{csrfToken:'synthetic-csrf'})).ok,false);assert.equal(calls.length,1);
});
