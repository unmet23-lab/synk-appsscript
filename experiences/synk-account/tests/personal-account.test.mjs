import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductAccount } from '../src/product-account.mjs';
import { validatePersonalState } from '../src/personal-data.mjs';
const reply = data => new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const operations={load:'personalLoad',save:'personalSave',delete:'personalDelete'};
const empty={format:'synk-family-album-manifest',version:1,pages:[]};
const envelope=(accountId='fixture-owner',state=null)=>({ok:true,scope:'synk-personal',resource:'family-album',accountId,revision:0,updatedAt:null,state});

test('personal state rejects NUL and lone surrogates before PostgreSQL persistence', () => {
  for (const text of ['a\u0000b', 'a\ud800b', 'a\udc00b']) {
    assert.throws(() => validatePersonalState('family-album', { ...empty, [text]: 'value' }), { code: 'PERSONAL_DATA_INVALID' });
    assert.throws(() => validatePersonalState('family-album', { ...empty, pages: [{ title: text }] }), { code: 'PERSONAL_DATA_INVALID' });
  }
});
test('personal browser sends resource in GET query and POST body exclusively',async()=>{
  const config={version:1,supabaseUrl:'https://auth.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://api.example.test',portalUrl:'https://portal.example.test',clients:{'family-album':{clientId:'fixture-family',redirectUri:'http://127.0.0.1:4298/'}}};
  const values=new Map([['synk.oauth.session.family-album',JSON.stringify({access_token:'fixture-access',refresh_token:null,expires_at:Date.now()+3600000,configKey:[config.supabaseUrl,config.accountApiUrl,'fixture-family','http://127.0.0.1:4298/'].join('|')})]]),calls=[];
  const account=createProductAccount({clientKey:'family-album',resource:'family-album',endpoint:'synk-personal',scope:'synk-personal',validateState:v=>validatePersonalState('family-album',v),operations,getUrl:()=> 'http://127.0.0.1:4298/',storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},fetcher:async(input,init={})=>{
    const url=new URL(input);if(url.pathname==='/api/account-config')return reply(config);calls.push({url,init});assert.equal(url.pathname,'/functions/v1/synk-personal');
    if(init.method==='GET')assert.equal(url.search,'?resource=family-album');else{assert.equal(url.search,'');assert.equal(JSON.parse(init.body).resource,'family-album');}return reply(envelope());
  }});
  assert.equal((await account.start()).signedIn,true);await account.request('personalSave',{expected_revision:0,state:empty});await account.request('personalDelete',{expected_revision:0});assert.equal(calls.length,3);account.dispose();
});
test('native personal bridge request alias verifies its owner and fixed resource',async()=>{
  let callback;const calls=[];
  const bridge={getEnvironment:async()=>({clientId:'family-album'}),authStatus:async()=>({configured:true,signedIn:true,status:'signed-in',account:{synk_user_id:'fixture-owner'},sessionGeneration:1}),onAuthChanged:cb=>{callback=cb;return()=>{};},request:async(op,values)=>{calls.push({op,values});return envelope();}};
  const account=createProductAccount({clientKey:'family-album',resource:'family-album',endpoint:'synk-personal',scope:'synk-personal',validateState:v=>validatePersonalState('family-album',v),operations,bridge});
  assert.equal((await account.start()).accountId,'fixture-owner');await account.request('personalSave',{expected_revision:0,state:empty});assert.equal(calls[1].op,'personalSave');assert.equal(calls[1].values.resource,undefined);
  callback({configured:true,signedIn:false,status:'signed-out',sessionGeneration:2});assert.equal(account.status().signedIn,false);account.dispose();
});

test('browser and native document errors preserve only an identified missing original UUID',async()=>{
  const assetId='22222222-2222-4222-8222-222222222222';
  for(const native of [false,true]){
    let error=null;
    const config={version:1,supabaseUrl:'https://auth.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://api.example.test',portalUrl:'https://portal.example.test',clients:{'family-album':{clientId:'fixture-family',redirectUri:'http://127.0.0.1:4298/'}}};
    const values=new Map([['synk.oauth.session.family-album',JSON.stringify({access_token:'fixture-access',refresh_token:null,expires_at:Date.now()+3600000,configKey:[config.supabaseUrl,config.accountApiUrl,'fixture-family','http://127.0.0.1:4298/'].join('|')})]]);
    const bridge={getEnvironment:async()=>({clientId:'family-album'}),authStatus:async()=>({configured:true,signedIn:true,status:'signed-in',account:{synk_user_id:'fixture-owner'},sessionGeneration:1}),onAuthChanged:()=>()=>{},request:async()=>error?{ok:false,error}:envelope()};
    const account=createProductAccount({clientKey:'family-album',resource:'family-album',endpoint:'synk-personal',scope:'synk-personal',validateState:v=>validatePersonalState('family-album',v),operations,bridge:native?bridge:undefined,getUrl:()=> 'http://127.0.0.1:4298/',storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},fetcher:async(input)=>new URL(input).pathname==='/api/account-config'?reply(config):error?new Response(JSON.stringify({ok:false,error}),{status:404,headers:{'Content-Type':'application/json'}}):reply(envelope())});
    await account.start();
    for(const [code,id,expected] of [['ASSET_NOT_FOUND',assetId,assetId],['ASSET_NOT_CONFIRMED',assetId,assetId],['ASSET_NOT_FOUND','private/invalid',undefined],['NETWORK',assetId,undefined]]){
      error={code,assetId:id,private:'not returned'};
      await assert.rejects(account.request('personalSave',{expected_revision:0,state:empty}),problem=>problem.code===code&&problem.assetId===expected&&problem.private===undefined);
    }
    account.dispose();
  }
});
