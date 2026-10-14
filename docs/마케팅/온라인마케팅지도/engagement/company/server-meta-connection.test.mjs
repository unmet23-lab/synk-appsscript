import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCompanyApp} from './server.mjs';
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
async function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-meta-http-'));let hook,statistics=0;const calls=[];
  const metaConnectionFetch=async(raw,init)=>{const url=new URL(raw),path=url.pathname.replace(/^\/v[\d.]+\//,'');calls.push({path,init});await hook?.(path);if(path==='me')return json({id:'900',user_id:'100',username:'synk'});if(path==='100/media')return json({data:[{id:'600'}]});if(path==='600')return json({id:'600',owner:{id:'900'}});if(path==='600/comments')return json({data:[]});throw Error('unexpected fake read');};
  const oauthFetch=async raw=>String(raw).includes('api.instagram.com')?json({access_token:'short-synthetic',user_id:'100',permissions:['instagram_business_basic','instagram_business_manage_comments']}):json({access_token:'long-synthetic',expires_in:5184000});
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'https://workspace.example.test',schedule:false,metaConnectionFetch,oauthFetch,collector:async()=>{statistics++;throw Error('statistics must not be required for comments');},synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  t.after(async()=>{await app.stop();rmSync(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({email:'admin@meta.test',name:'합성 관리자',role:'admin'}),member=app.store.createUser({email:'member@meta.test',name:'합성 담당자',role:'member'});
  app.store.put('channels','ig',{id:'ig',platform:'instagram',handle:'synk',canonicalUrl:'https://www.instagram.com/synk/',ownerIds:[member.id],active:true,connectionVersion:2});
  const tokens=new Map([admin,member].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'csrf-synthetic'},60)]));await app.start();const base='http://127.0.0.1:'+app.server.address().port;
  const request=async(user,path,input)=>{const res=await fetch(base+path,{method:input===undefined?'GET':'POST',redirect:'manual',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'csrf-synthetic',...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:res.status,location:res.headers.get('location'),data:res.headers.get('content-type')?.includes('json')?await res.json():null};};
  return {app,admin,member,calls,request,setHook:value=>hook=value,get statistics(){return statistics;}};
}
const input={accessToken:'manual-synthetic',authType:'instagram-login',accountId:'100',scope:'forged',expiresAt:'2099-01-01'};
test('HTTP direct Meta connection verifies the account and capability without trusting client scope or running statistics',async t=>{
  const f=await fixture(t);assert.equal((await f.request(f.member,'/api/channels/ig/connection',input)).status,403);assert.equal(f.calls.length,0);
  const result=await f.request(f.admin,'/api/channels/ig/connection',input);assert.equal(result.status,200);const credential=f.app.store.secret('channel:ig');assert.equal(credential.scope,'');assert.equal(credential.expiresAt,null);assert.equal(credential.appScopedId,'900');assert.equal(credential.capabilityVerification.commentsRead,true);assert.equal(f.app.store.get('channels','ig').externalId,'100');assert.equal(f.statistics,0);assert.equal(f.app.store.get('socialInboxConnections','ig'),null);
  assert.equal(f.app.socialInboxProvider.configure(f.admin,{channelId:'ig',enabled:true}).canSync,true);assert.ok(!JSON.stringify((await f.request(f.admin,'/api/state')).data).includes('manual-synthetic'));
});
test('HTTP Meta verification cannot save after the requesting session is revoked or channel is reconnected',async t=>{
  for(const change of ['session','version']){const f=await fixture(t);f.setHook(path=>{if(path!=='600/comments')return;if(change==='session')f.app.store.revokeUser(f.admin.id);else f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),connectionVersion:3});});const r=await f.request(f.admin,'/api/channels/ig/connection',input);assert.equal(r.status,change==='session'?401:409);assert.equal(f.app.store.secret('channel:ig'),null);}
});
test('comment OAuth intention is state-bound and saves exact grant/identity without requiring insights',async t=>{
  const f=await fixture(t);f.app.store.setSecret('provider:instagram',{clientId:'synthetic-app',clientSecret:'synthetic-secret'});
  const started=await f.request(f.admin,'/api/oauth/instagram/start?channelId=ig&comments=1');assert.equal(started.status,302);const authUrl=new URL(started.location);assert.ok(authUrl.searchParams.get('scope').includes('instagram_business_manage_comments'));
  const done=await f.request(f.admin,'/api/oauth/instagram/callback?state='+encodeURIComponent(authUrl.searchParams.get('state'))+'&code=synthetic-code');assert.equal(done.status,302);assert.match(done.location,/connectionPurpose=comments/);assert.equal(f.statistics,0);assert.equal(f.app.store.all('runs').length,0);assert.equal(f.app.store.secret('channel:ig').accountId,'100');assert.equal(f.app.store.secret('channel:ig').scope,'instagram_business_basic instagram_business_manage_comments');assert.equal(f.app.store.get('channels','ig').connectionVersion,3);
});
