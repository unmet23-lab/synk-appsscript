import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductAccount} from '../experiences/synk-account/src/product-account.mjs';
import {emptyState, importBackup} from '../experiences/relationship-care/model.mjs';

const config={version:1,supabaseUrl:'https://auth.example.test',accountApiUrl:'https://api.example.test',supabasePublishableKey:'sb_publishable_fixture',portalUrl:'https://portal.example.test',clients:{care:{clientId:'fixture-care',redirectUri:'http://127.0.0.1:4296/'}}};
const sessionKey='synk.oauth.session.care';
const configKey=[config.supabaseUrl,config.accountApiUrl,config.clients.care.clientId,config.clients.care.redirectUri].join('|');
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(t,{session=true,read}={}){
  const values=new Map(),statuses=[];
  if(session)values.set(sessionKey,JSON.stringify({access_token:'synthetic-access',refresh_token:null,expires_at:Date.now()+3600000,configKey}));
  const account=createProductAccount({clientKey:'care',endpoint:'synk-care',scope:'synk-care',validateState:importBackup,
    getUrl:()=>config.clients.care.redirectUri,onStatus:value=>statuses.push(value),
    storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},
    fetcher:async url=>new URL(url).pathname==='/api/account-config'?response(config):read(),
  });
  t.after(()=>account.dispose());return {account,statuses,values};
}
const envelope=()=>response({ok:true,scope:'synk-care',accountId:'synthetic-a',revision:1,state:emptyState()});

test('saved browser login stays restoring until ownership verification, without publishing a false logout',async t=>{
  const gate=deferred(),f=fixture(t,{read:()=>gate.promise}),pending=f.account.start();
  t.after(()=>gate.resolve(envelope()));await settle();
  const waiting=f.account.status().status,loggedOutWhileWaiting=f.statuses.some(value=>value.status==='signed-out');
  gate.resolve(envelope());assert.equal((await pending).accountId,'synthetic-a');
  assert.equal(waiting,'restoring');
  assert.equal(loggedOutWhileWaiting,false,'A pending saved login is not a verified logout');
  assert.equal(f.statuses.some(value=>value.status==='signed-out'),false);
});

test('retry after a temporary saved-login failure never emits signed-out before verification',async t=>{
  let offline=true;const gate=deferred(),f=fixture(t,{read:()=>offline?response({ok:false},503):gate.promise});
  assert.equal((await f.account.start()).error.retryable,true);assert.ok(f.values.has(sessionKey));
  f.statuses.length=0;offline=false;const retry=f.account.signIn();t.after(()=>gate.resolve(envelope()));await settle();
  const loggedOutWhileWaiting=f.statuses.some(value=>value.status==='signed-out');
  gate.resolve(envelope());assert.equal((await retry).signedIn,true);
  assert.equal(loggedOutWhileWaiting,false);
  assert.equal(f.statuses.some(value=>value.status==='signed-out'),false);
});

for(const invalid of [false,true])test(`${invalid?'invalid':'absent'} saved credentials settle to signed-out without requesting private records`,async t=>{
  let reads=0;const f=fixture(t,{session:false,read:()=>{reads++;return envelope();}});
  if(invalid)f.values.set(sessionKey,'{"access_token":false}');
  const result=await f.account.start();assert.equal(result.status,'signed-out');assert.equal(result.signedIn,false);assert.equal(result.accountId,null);
  assert.equal(f.statuses.at(-1).status,'signed-out');assert.equal(reads,0);assert.equal(f.values.has(sessionKey),false);
});
