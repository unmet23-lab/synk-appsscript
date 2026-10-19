'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
// The 0.4.0 installed source lives only in a git-ignored 10-09 candidate folder, gone from this PC since before the 10-17 laptop move.
// Only the reproduction needs it; the current-source cases below always run (docs/현장노트/시험_화면확인.md).
const originalFile='C:/Users/q1212/Documents/SYNK-appsscript/desktop/artifacts/platform-convenience-candidate-2026-10-09T12-10-17-238Z/src/auth-service.cjs';
const originalMissing=!fs.existsSync(originalFile)&&'git-ignored 10-09 installed source is not on this PC: '+originalFile;
const loadOriginal=()=>{assert.equal(crypto.createHash('sha256').update(fs.readFileSync(originalFile)).digest('hex'),'d2b97ccdb468fce8ecc26ebc44d88a9f2f996c3e1fb9d989b9a3ae28509a1ffd');return require(originalFile).createAuthService;};
const candidate=require('../src/auth-service.cjs').createAuthService;
async function actor(t,factory,{reply={ok:true,current:true,refreshRevoked:true},status=200,providerStatus=403,offline=false}={}){
 let vault={refreshToken:'synthetic-restore-refresh',subject:'synthetic-subject'},otherVault='untouched-synthetic-other-product';const calls=[];
 const auth=factory({config:{supabaseUrl:'https://provider.example.invalid',accountApiUrl:'https://provider.example.invalid',publishableKey:'synthetic-public-key',clientId:'synthetic-platform-client',clientKey:'platform',product:'platform',redirectUri:'http://127.0.0.1:43821/synk/oauth/platform/callback'},appVersion:'0.4.0',store:{available:()=>true,load:async()=>vault,save:async value=>{vault=value;},clear:async()=>{vault=null;}},openExternal:async()=>{throw Error('No browser allowed');},fetcher:async(value,options={})=>{
  const url=new URL(value);assert.equal(url.origin,'https://provider.example.invalid');calls.push({path:url.pathname,scope:url.searchParams.get('scope'),method:options.method||'GET'});
  if(url.pathname==='/auth/v1/oauth/token')return Response.json({access_token:'synthetic-access-token',refresh_token:'synthetic-issued-refresh',expires_in:3600,token_type:'bearer'});
  if(url.pathname==='/auth/v1/user')return Response.json({id:'synthetic-subject'});
  if(url.pathname==='/functions/v1/synk-account'&&(!options.method||options.method==='GET'))return Response.json({ok:true,account:{synk_user_id:'00000000-0000-4000-8000-000000000001',profile:{}},memberships:[],entitlements:[],sessions:[{id:'00000000-0000-4000-8000-000000000002',current:true,revoked:false}]});
  if(url.pathname==='/functions/v1/synk-account'){assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{action:'revoke-session',session_id:'00000000-0000-4000-8000-000000000002'});if(offline)throw Error('synthetic transport loss');return Response.json(reply,{status});}
  if(url.pathname==='/auth/v1/logout'){assert.equal(options.method,'POST');assert.equal(url.search,'?scope=local');return providerStatus===204?new Response(null,{status:204}):Response.json({code:providerStatus===403?'session_not_found':'synthetic_provider_failure'},{status:providerStatus});}
  throw Error('Unexpected request');
 }});t.after(()=>auth.dispose());await auth.initialize();assert.equal(auth.status().signedIn,true);
 const logout=async()=>{const result=await auth.signOut();assert.equal(result.status.signedIn,false);assert.equal(vault,null);assert.equal(otherVault,'untouched-synthetic-other-product');assert.equal(JSON.stringify(result).includes('synthetic-access-token'),false);assert.equal(JSON.stringify(result).includes('synthetic-issued-refresh'),false);return result;};
 return{auth,calls,logout};
}

test('exact installed source reproduces false refresh report after server confirmed success and second logout403',{skip:originalMissing},async t=>{
 const f=await actor(t,loadOriginal()),result=await f.logout();assert.equal(result.serverSessionRevoked,true);assert.equal(result.refreshRevoked,false);assert.equal(result.serverRevoked,false);assert.equal(f.calls.filter(c=>c.path==='/auth/v1/logout').length,1);
});
test('candidate preserves current provider confirmation and avoids the duplicate request',async t=>{
 const f=await actor(t,candidate),result=await f.logout();assert.equal(result.serverSessionRevoked,true);assert.equal(result.refreshRevoked,true);assert.equal(result.serverRevoked,true);assert.equal(f.calls.filter(c=>c.path==='/auth/v1/logout').length,0);
});
test('explicit false provider flag still invokes one local fallback and can confirm successful cleanup',async t=>{
 const f=await actor(t,candidate,{reply:{ok:true,current:true,refreshRevoked:false},providerStatus:204}),result=await f.logout();assert.equal(result.serverRevoked,true);assert.equal(f.calls.filter(c=>c.path==='/auth/v1/logout').length,1);
});
test('missing server flag and unsuccessful fallback remain unconfirmed',async t=>{
 const f=await actor(t,candidate,{reply:{ok:true,current:true},providerStatus:503}),result=await f.logout();assert.equal(result.serverSessionRevoked,true);assert.equal(result.refreshRevoked,false);assert.equal(result.serverRevoked,false);
});
test('generic403 including session_not_found is not sufficient without the authoritative server flag',async t=>{
 const f=await actor(t,candidate,{reply:{ok:true,current:true,refreshRevoked:false}}),result=await f.logout();assert.equal(result.refreshRevoked,false);assert.equal(result.serverRevoked,false);
});
test('a different session confirmation cannot suppress the current local fallback',async t=>{
 const f=await actor(t,candidate,{reply:{ok:true,current:false,refreshRevoked:true}}),result=await f.logout();assert.equal(result.refreshRevoked,false);assert.equal(result.serverRevoked,false);assert.equal(f.calls.filter(c=>c.path==='/auth/v1/logout').length,1);
});
test('failed server response cannot confirm SYNK fence even if its JSON claims provider success',async t=>{
 const f=await actor(t,candidate,{status:500,providerStatus:204}),result=await f.logout();assert.equal(result.serverSessionRevoked,false);assert.equal(result.refreshRevoked,true);assert.equal(result.serverRevoked,false);assert.equal(f.calls.filter(c=>c.path==='/auth/v1/logout').length,1);
});
test('offline SYNK revocation still clears local memory and attempts local provider cleanup without claiming complete fence',async t=>{
 const f=await actor(t,candidate,{offline:true,providerStatus:204}),result=await f.logout();assert.equal(result.serverSessionRevoked,false);assert.equal(result.refreshRevoked,true);assert.equal(result.serverRevoked,false);
});
test('truthy flag values or missing ok cannot replace exact server confirmation',async t=>{
 for(const reply of [{ok:true,current:true,refreshRevoked:'true'},{ok:true,current:true,refreshRevoked:1},{ok:true,refreshRevoked:true},{ok:false,current:true,refreshRevoked:true}]){const f=await actor(t,candidate,{reply}),result=await f.logout();assert.equal(result.refreshRevoked,false);assert.equal(result.serverRevoked,false);assert.equal(f.calls.filter(c=>c.path==='/auth/v1/logout').length,1);}
});
