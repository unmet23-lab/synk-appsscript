import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {verifyMetaConnection,createMetaConnectionService,hasVerifiedMetaComments,metaDataAccessExpired} from './meta-connection.mjs';
import {createSocialInboxProvider} from './social-inbox-provider.mjs';
import {createSocialReplies} from './social-replies.mjs';
import {refreshCredentials} from './oauth.mjs';
const now='2026-10-14T00:00:00.000Z',clock=()=>now;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
const ig={id:'ig',platform:'instagram',handle:'synk',ownerIds:['admin'],active:true,connectionVersion:2};
const input={accessToken:'synthetic-access',accountId:'100',authType:'instagram-login'};
const scope=['instagram_business_basic','instagram_business_manage_comments'];
function mock(overrides={}){const calls=[];return {calls,fetchImpl:async(raw,init)=>{const url=new URL(raw),path=url.pathname.replace(/^\/v[\d.]+\//,'');calls.push({url,init});if(overrides[path])return overrides[path](url,init);if(path==='me')return json({id:'900',user_id:'100',username:'synk'});if(path==='100/media')return json({data:[{id:'600'}]});if(path==='600')return json({id:'600',owner:{id:'900'}});if(path==='600/comments')return json({data:[]});throw Error('unexpected fake path');}};}
function fixture(t,mockOptions={}){const dir=mkdtempSync(join(tmpdir(),'synk-meta-connection-')),store=new Store(dir);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});const admin={id:'admin',role:'admin',active:true},member={id:'member',role:'member',active:true};store.put('users',admin.id,admin);store.put('users',member.id,member);store.put('channels',ig.id,ig);const api=mock(mockOptions),service=createMetaConnectionService({store,clock,fetchImpl:api.fetchImpl});return {store,admin,member,api,service};}

test('manual IG identity separates canonical user_id from app id and ignores asserted scope and expiry',async()=>{
  const api=mock(),result=await verifyMetaConnection({channel:ig,credentials:{...input,scope:'forged',expiresAt:'2099-01-01',appScopedId:'forged'},clock,...api});
  assert.equal(result.identity.id,'100');assert.equal(result.credentials.appScopedId,'900');assert.equal(result.credentials.scope,'');assert.equal(result.credentials.permissionsVerifiedAt,null);assert.equal(result.credentials.expiresAt,null);assert.equal(result.credentials.expiryStatus,'not-provided');assert.equal(result.credentials.refreshMode,'external-manual');assert.equal(result.credentials.capabilityVerification.replySendVerified,false);assert.ok(hasVerifiedMetaComments({...ig,externalId:'100'},result.credentials));assert.equal(hasVerifiedMetaComments({...ig,externalId:'101'},result.credentials),false);assert.equal(hasVerifiedMetaComments(ig,{...result.credentials,accessToken:'other-token'}),false);assert.ok(api.calls.every(c=>c.init.method==='GET'&&c.init.redirect==='error'&&!c.url.href.includes('synthetic-access')));
});
test('different account, username, missing canonical id, foreign media and denied comments cannot be stored',async()=>{
  for(const overrides of [{'me':()=>json({id:'900',user_id:'101',username:'synk'})},{'me':()=>json({id:'900',user_id:'100',username:'else'})},{'me':()=>json({id:'900',username:'synk'})},{'100/media':()=>json({data:[]})},{'600':()=>json({id:'600',owner:{id:'999'}})},{'600/comments':()=>json({error:{code:200}},403)}])await assert.rejects(verifyMetaConnection({channel:ig,credentials:input,clock,...mock(overrides)}));
});
test('unavailable comments and unsafe transport do not expose token or invent grants',async()=>{
  await assert.rejects(verifyMetaConnection({channel:ig,credentials:input,clock,...mock({'600/comments':()=>json({error:{code:100,message:'synthetic-access'}},400)})}),{code:'META_VERIFICATION_REJECTED'});
  await assert.rejects(verifyMetaConnection({channel:ig,credentials:input,clock,fetchImpl:async()=>{throw Object.assign(Error('synthetic-access'),{status:400});}}),error=>!error.message.includes('synthetic-access')&&error.code==='META_VERIFICATION_UNAVAILABLE');
});
test('only a live admin can directly connect; successful save is private and does not enable collection',async t=>{
  const f=fixture(t);await assert.rejects(f.service.connect(f.member,'ig',input),{code:'META_ADMIN_REQUIRED'});assert.equal(f.api.calls.length,0);await f.service.connect(f.admin,'ig',input);const stored=f.store.secret('channel:ig');assert.equal(stored.accountId,'100');assert.equal(stored.appScopedId,'900');assert.equal(stored.connectedBy,'admin');assert.equal(f.store.get('channels','ig').externalId,'100');assert.equal(f.store.get('channels','ig').connectionVersion,3);assert.equal(f.store.get('socialInboxConnections','ig'),null);assert.ok(!JSON.stringify(f.store.get('channels','ig')).includes('synthetic-access'));
});
test('session, connection version, active role and duplicate identity are rechecked after GET before save',async t=>{
  for(const change of ['session','version','role','duplicate']){
    let f,session=true;f=fixture(t,{'600/comments':()=>{if(change==='session')session=false;if(change==='version')f.store.put('channels','ig',{...ig,connectionVersion:3});if(change==='role')f.store.put('users','admin',{...f.admin,active:false});if(change==='duplicate')f.store.put('channels','other',{id:'other',platform:'instagram',externalId:'100',active:true});return json({data:[]});}});
    await assert.rejects(f.service.connect(f.admin,'ig',input,{authorize:()=>{if(!session)throw Object.assign(Error('signed out'),{status:401});}}));assert.equal(f.store.secret('channel:ig'),null);
  }
});

test('OAuth uses only the server exchange grants and expiry and permits an empty account',async()=>{
  const api=mock(),credentials={...input,scope:scope.join(' '),expiresAt:'2026-11-01T00:00:00Z',issuedAt:now,longLived:true};
  const verified=await verifyMetaConnection({channel:ig,credentials,clock,...api,trustedGrant:true,trustedExpiry:true});assert.equal(verified.credentials.scope,scope.join(' '));assert.equal(verified.credentials.capabilityVerification,null);assert.equal(verified.credentials.expiryStatus,'provider');assert.equal(api.calls.length,1);
  await assert.rejects(verifyMetaConnection({channel:ig,credentials:{...credentials,scope:scope[0]},clock,...mock(),trustedGrant:true,trustedExpiry:true}),{code:'META_SCOPES_REQUIRED'});
  await assert.rejects(verifyMetaConnection({channel:ig,credentials:{...credentials,expiresAt:'2020-01-01T00:00:00Z'},clock,...mock(),trustedGrant:true,trustedExpiry:true}),{code:'META_TOKEN_EXPIRED'});
});
test('Facebook page debug response binds app and actual account and checks actual token expiry',async()=>{
  const channel={id:'fb',platform:'facebook',externalId:'200'},credentials={accessToken:'page-token',authType:'facebook-page',accountId:'200'},provider={clientId:'app',clientSecret:'fixture-app-secret'};
  for(const invalid of [null,'app','expired','scope','account']){
    const fetchImpl=async(raw,init)=>{const url=new URL(raw);assert.equal(init.method,'GET');if(url.pathname.endsWith('/debug_token'))return json({data:{app_id:invalid==='app'?'other':'app',is_valid:true,expires_at:invalid==='expired'?1:0,data_access_expires_at:invalid==='data-expired'?1:0,scopes:invalid==='scope'?[]:['pages_read_engagement','pages_read_user_content','pages_manage_engagement']}});return json({id:invalid==='account'?'201':'200',name:'SYNK'});};
    if(invalid)await assert.rejects(verifyMetaConnection({channel,credentials,provider,clock,fetchImpl}));else{const result=await verifyMetaConnection({channel,credentials,provider,clock,fetchImpl});assert.equal(result.credentials.expiryStatus,'provider-no-expiry');assert.equal(result.credentials.accountId,'200');}
  }
  await assert.rejects(verifyMetaConnection({channel,credentials,clock,fetchImpl:async()=>assert.fail('must not call')}),{code:'META_APP_REQUIRED'});
});

test('Facebook Page connection keeps expired data access metadata for exempt publishing and comments only',async t=>{
  for(const authType of ['facebook-page','facebook-user'])for(const purpose of ['comments','publishing'])await t.test(authType+' '+purpose,async()=>{
    const calls=[],scopes=['pages_read_engagement','pages_read_user_content','pages_manage_engagement','pages_manage_posts','pages_show_list','email'];
    const fetchImpl=async(raw,init)=>{calls.push(init.method);const path=new URL(raw).pathname;if(path.endsWith('/debug_token'))return json({data:{is_valid:true,app_id:'app',expires_at:0,data_access_expires_at:1,scopes}});if(path.endsWith('/me/accounts'))return json({data:[{id:'200',access_token:'synthetic-page',tasks:['CREATE_CONTENT','MODERATE']}]});return json({id:'200',name:'SYNK'});};
    const result=await verifyMetaConnection({channel:{platform:'facebook',externalId:'200'},credentials:{authType,accessToken:'synthetic-token',accountId:'200'},provider:{clientId:'app',clientSecret:'synthetic-secret'},purpose,requireComments:true,clock,fetchImpl});
    assert.equal(result.credentials.dataAccessExpiresAt,'1970-01-01T00:00:01.000Z');assert.equal(result.credentials.expiryStatus,'provider-no-expiry');assert.ok(result.credentials.scope.includes('email'));assert.ok(calls.every(method=>method==='GET'));
  });
});

test('Page data-access policy is bounded by operation, required permissions, auth type and valid timestamp',()=>{
  const channel={platform:'facebook'},credentials={authType:'facebook-user',dataAccessExpiresAt:'2020-01-01T00:00:00Z',expiryStatus:'provider-no-expiry'},options={purpose:'comments',requiredScopes:['pages_read_engagement','pages_manage_engagement'],now};
  assert.equal(metaDataAccessExpired(channel,credentials,options),false);
  for(const change of [{purpose:'statistics'},{purpose:'profile'},{requiredScopes:[]},{requiredScopes:['email']},{requiredScopes:['pages_read_engagement','user_posts']}])assert.equal(metaDataAccessExpired(channel,credentials,{...options,...change}),true);
  for(const authType of ['instagram-login','instagram-facebook','user'])assert.equal(metaDataAccessExpired(channel,{...credentials,authType},options),true);
  assert.equal(metaDataAccessExpired({platform:'instagram'},{...credentials,authType:'facebook-page'},options),true);
  for(const dataAccessExpiresAt of ['invalid',-1,0,false,{}])assert.equal(metaDataAccessExpired(channel,{...credentials,dataAccessExpiresAt},options),true);
  for(const dataAccessExpiresAt of [null,undefined,''])assert.equal(metaDataAccessExpired(channel,{...credentials,dataAccessExpiresAt},options),false);
  assert.equal(metaDataAccessExpired(channel,{...credentials,dataAccessExpiresAt:'2099-01-01T00:00:00Z'},{...options,purpose:'profile'}),false);
});

test('Facebook data-access exemption retains token, app, scope, account, task and provider rejection checks',async t=>{
  for(const mode of ['expired-token','invalid-data-expiry','revoked','wrong-app','missing-scope','wrong-page','missing-task','denied','statistics'])await t.test(mode,async()=>{
    const scopes=['pages_show_list','pages_read_engagement','pages_manage_posts'];
    const fetchImpl=async raw=>{const path=new URL(raw).pathname;if(path.endsWith('/debug_token'))return json({data:{is_valid:mode!=='revoked',app_id:mode==='wrong-app'?'other':'app',expires_at:mode==='expired-token'?1:0,data_access_expires_at:mode==='invalid-data-expiry'?-1:1,scopes:mode==='missing-scope'?scopes.slice(0,2):scopes}});if(path.endsWith('/me/accounts'))return json({data:[{id:'200',access_token:'synthetic-page',tasks:mode==='missing-task'?['ANALYZE']:['CREATE_CONTENT']}]});return mode==='denied'?json({error:{code:190}},401):json({id:mode==='wrong-page'?'201':'200',name:'SYNK'});};
    await assert.rejects(verifyMetaConnection({channel:{platform:'facebook',externalId:'200'},credentials:{authType:'facebook-user',accessToken:'synthetic-token',accountId:'200'},provider:{clientId:'app',clientSecret:'synthetic-secret'},purpose:mode==='statistics'?'statistics':'publishing',clock,fetchImpl}));
  });
});

test('Facebook OAuth matches an official Page link without username and rejects lookalikes or changed Page IDs',async()=>{
  const provider={clientId:'app',clientSecret:'synthetic-secret'},credentials={accessToken:'synthetic-user',authType:'facebook-user'},grants=['pages_show_list','pages_read_engagement','pages_read_user_content','pages_manage_engagement'];
  for(const [link,changed,valid]of [['https://www.facebook.com/synk/',false,true],['https://m.facebook.com/synk',false,true],['https://facebook.com.evil.test/synk',false,false],['https://evil.test/synk',false,false],['http://www.facebook.com/synk',false,false],['https://user:pass@facebook.com/synk',false,false],['https://facebook.com/other?next=/synk',false,false],['https://facebook.com/synk/other',false,false],['https://facebook.com/synk',true,false]]){
    const fetchImpl=async raw=>{const path=new URL(raw).pathname;if(path.endsWith('/debug_token'))return json({data:{is_valid:true,app_id:'app',expires_at:0,scopes:grants}});if(path.endsWith('/me/accounts'))return json({data:[{id:'200',link,access_token:'synthetic-page',tasks:['MODERATE']}]});return json({id:changed?'201':'200',link});};
    // A different /me Page must not pass by sharing the same readable link.
    const verification=verifyMetaConnection({channel:{platform:'facebook',handle:'synk'},credentials,provider,clock,fetchImpl,trustedGrant:true});
    if(valid)assert.equal((await verification).identity.id,'200');else await assert.rejects(verification);
  }
  const fetchImpl=async raw=>new URL(raw).pathname.endsWith('/debug_token')?json({data:{is_valid:true,app_id:'app',expires_at:0,scopes:grants}}):json({id:'200',link:'https://www.facebook.com/profile.php?id=200'});
  assert.equal((await verifyMetaConnection({channel:{platform:'facebook',externalId:'200'},credentials:{accessToken:'synthetic-page',authType:'facebook-page',accountId:'200'},provider,clock,fetchImpl})).identity.id,'200');
});

test('Facebook publishing upgrade requires retained comment grants and moderation task before returning replacement credentials',async()=>{
  const provider={clientId:'app',clientSecret:'synthetic-secret'},channel={platform:'facebook',externalId:'200'},credentials={accessToken:'synthetic-user',authType:'facebook-user'},scopes=['pages_show_list','pages_read_engagement','pages_manage_posts','pages_read_user_content','pages_manage_engagement'];
  for(const kind of ['complete','missing-comment-grant','missing-moderation-task']){const fetchImpl=async raw=>{const path=new URL(raw).pathname;if(path.endsWith('/debug_token'))return json({data:{is_valid:true,app_id:'app',expires_at:0,scopes:kind==='missing-comment-grant'?scopes.filter(s=>s!=='pages_manage_engagement'):scopes}});if(path.endsWith('/me/accounts'))return json({data:[{id:'200',access_token:'synthetic-page',tasks:kind==='missing-moderation-task'?['CREATE_CONTENT']:['CREATE_CONTENT','MODERATE']}]});return json({id:'200',name:'Synthetic Page'});};
    const result=verifyMetaConnection({channel,credentials,provider,clock,fetchImpl,purpose:'publishing',requireComments:true,trustedGrant:true});if(kind==='complete')assert.equal((await result).identity.id,'200');else await assert.rejects(result,{code:kind==='missing-comment-grant'?'META_SCOPES_REQUIRED':'META_PAGE_ACCESS_REQUIRED'});
  }
});

test('verified manual capability supports collect, author fallback and explicit reply without scope invention or token refresh',async t=>{
  const f=fixture(t);await f.service.connect(f.admin,'ig',input);const calls=[];
  const fetchImpl=async(raw,init)=>{const url=new URL(raw),path=url.pathname.replace(/^\/v[\d.]+\//,'');calls.push({url,init});
    if(path==='me')return json({id:'900',user_id:'100',username:'synk'});
    if(path==='100/media')return json({data:[{id:'600',permalink:'https://www.instagram.com/p/SYNK/'}]});
    if(path==='600/comments')return json({data:[{id:'700',text:'합성 질문',from:{username:'synthetic-reader'}}]});
    if(path==='700')return json({id:'700',text:'합성 질문',media:{id:'600'}});
    if(path==='600')return json({id:'600',owner:{id:'900'}});
    if(path==='700/replies'&&init.method!=='POST')return json({data:[]});
    if(path==='700/replies'&&init.method==='POST')return json({id:'800'});
    assert.fail('unexpected fake request');
  };
  const getCredentials=async()=>refreshCredentials('instagram',f.store.secret('channel:ig'),{}, {fetchImpl:async()=>assert.fail('external-manual must not refresh')});
  const inbox=createSocialInboxProvider({store:f.store,clock,fetchImpl,getCredentials}),replies=createSocialReplies({store:f.store,clock,fetchImpl,getCredentials});t.after(async()=>{await inbox.stop();await replies.stop();});
  inbox.configure(f.admin,{channelId:'ig',enabled:true});assert.equal((await inbox.sync(f.admin,{channelId:'ig'})).imported,1);const row=f.store.all('socialInbox')[0];assert.equal(row.author,'synthetic-reader');assert.equal(row.sourceAccountId,'100');
  const preview=await replies.preview(f.admin,{inboxId:row.id,revision:row.revision,text:'합성 답장'});assert.equal(calls.filter(call=>call.init.method==='POST').length,0);
  assert.equal((await replies.send(f.admin,{previewId:preview.preview.id,confirmationToken:preview.confirmationToken,idempotencyKey:preview.idempotencyKey})).attempt.status,'sent');assert.equal(calls.filter(call=>call.init.method==='POST').length,1);
  const credentials=f.store.secret('channel:ig');assert.equal(credentials.scope,'');f.store.setSecret('channel:ig',{...credentials,accessToken:'substituted-synthetic'});assert.equal(inbox.capability(f.store.get('channels','ig')).canSync,false);assert.equal(replies.workspace(f.admin).items[0].canReply,false);
});
