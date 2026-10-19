import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductAccount } from '../src/product-account.mjs';
import { initialState } from '../../path-vr/model.mjs';
import { pathAccountState, validatePersonalState } from '../src/personal-data.mjs';
const reply = data => new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const operations={load:'personalLoad',save:'personalSave',delete:'personalDelete'};
const empty=pathAccountState(initialState());
const envelope=(accountId='fixture-owner',state=null)=>({ok:true,scope:'synk-personal',resource:'path',accountId,revision:0,updatedAt:null,state});

test('personal state rejects NUL and lone surrogates before PostgreSQL persistence', () => {
  for (const text of ['a\u0000b', 'a\ud800b', 'a\udc00b']) {
    assert.throws(() => validatePersonalState('path', { ...empty, [text]: 'value' }), { code: 'PERSONAL_DATA_INVALID' });
    assert.throws(() => validatePersonalState('path', { ...empty, answers: [{ at: text }] }), { code: 'PERSONAL_DATA_INVALID' });
  }
});
test('personal browser sends resource in GET query and POST body exclusively',async()=>{
  const config={version:1,supabaseUrl:'https://auth.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://api.example.test',portalUrl:'https://portal.example.test',clients:{'path':{clientId:'fixture-path',redirectUri:'http://127.0.0.1:4292/'}}};
  const values=new Map([['synk.oauth.session.path',JSON.stringify({access_token:'fixture-access',refresh_token:null,expires_at:Date.now()+3600000,configKey:[config.supabaseUrl,config.accountApiUrl,'fixture-path','http://127.0.0.1:4292/'].join('|')})]]),calls=[];
  const account=createProductAccount({clientKey:'path',resource:'path',endpoint:'synk-personal',scope:'synk-personal',validateState:v=>validatePersonalState('path',v),operations,getUrl:()=> 'http://127.0.0.1:4292/',storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},fetcher:async(input,init={})=>{
    const url=new URL(input);if(url.pathname==='/api/account-config')return reply(config);calls.push({url,init});assert.equal(url.pathname,'/functions/v1/synk-personal');
    if(init.method==='GET')assert.equal(url.search,'?resource=path');else{assert.equal(url.search,'');assert.equal(JSON.parse(init.body).resource,'path');}return reply(envelope());
  }});
  assert.equal((await account.start()).signedIn,true);await account.request('personalSave',{expected_revision:0,state:empty});await account.request('personalDelete',{expected_revision:0});assert.equal(calls.length,3);account.dispose();
});
test('native personal bridge request alias verifies its owner and fixed resource',async()=>{
  let callback;const calls=[];
  const bridge={getEnvironment:async()=>({clientId:'path'}),authStatus:async()=>({configured:true,signedIn:true,status:'signed-in',account:{synk_user_id:'fixture-owner'},sessionGeneration:1}),onAuthChanged:cb=>{callback=cb;return()=>{};},request:async(op,values)=>{calls.push({op,values});return envelope();}};
  const account=createProductAccount({clientKey:'path',resource:'path',endpoint:'synk-personal',scope:'synk-personal',validateState:v=>validatePersonalState('path',v),operations,bridge});
  assert.equal((await account.start()).accountId,'fixture-owner');await account.request('personalSave',{expected_revision:0,state:empty});assert.equal(calls[1].op,'personalSave');assert.equal(calls[1].values.resource,undefined);
  callback({configured:true,signedIn:false,status:'signed-out',sessionGeneration:2});assert.equal(account.status().signedIn,false);account.dispose();
});
