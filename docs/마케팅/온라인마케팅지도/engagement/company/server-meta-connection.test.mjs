import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
async function fixture(t,options={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-meta-http-'));let hook,statistics=0,permissions=['instagram_business_basic','instagram_business_manage_comments'],identity={id:'900',user_id:'100',username:'synk'},commentRows=[];const calls=[],oauthCalls=[];
  const metaConnectionFetch=async(raw,init)=>{const url=new URL(raw),path=url.pathname.replace(/^\/v[\d.]+\//,'');calls.push({path,init});await hook?.(path);if(path==='me')return json(identity);if(path==='100/media')return json({data:[{id:'600',permalink:'https://www.instagram.com/p/SYNK/'}]});if(path==='600')return json({id:'600',owner:{id:'900'}});if(path==='600/comments')return json({data:commentRows});if(path==='700/replies')return json({data:[]});throw Error('unexpected fake read');};
  const oauthFetch=async(raw,init)=>{oauthCalls.push(String(raw));if(options.oauthFetch)return options.oauthFetch(raw,init);return String(raw).includes('api.instagram.com')?json({access_token:'short-synthetic',user_id:'100',permissions}):json({access_token:'long-synthetic',expires_in:5184000});};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'https://workspace.example.test',schedule:false,metaConnectionFetch,oauthFetch,socialInboxOptions:{fetchImpl:metaConnectionFetch},collector:async()=>{statistics++;throw Error('statistics must not be required for comments or publishing');},synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})},...(options.youtubeConnectionFetch?{youtubeConnectionFetch:options.youtubeConnectionFetch}:{})});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({email:'admin@meta.test',name:'합성 관리자',role:'admin'}),member=app.store.createUser({email:'member@meta.test',name:'합성 담당자',role:'member'});
  app.store.put('channels','ig',{id:'ig',platform:'instagram',handle:'synk',canonicalUrl:'https://www.instagram.com/synk/',ownerIds:[member.id],active:true,connectionVersion:2});
  const tokens=new Map([admin,member].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'csrf-synthetic'},60)]));await app.start();const base='http://127.0.0.1:'+app.server.address().port;
  const request=async(user,path,input)=>{const res=await fetch(base+path,{method:input===undefined?'GET':'POST',redirect:'manual',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'csrf-synthetic',...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:res.status,location:res.headers.get('location'),data:res.headers.get('content-type')?.includes('json')?await res.json():null};};
  return {app,admin,member,calls,oauthCalls,request,setHook:value=>hook=value,setPermissions:value=>permissions=value,setIdentity:value=>identity=value,setComments:value=>commentRows=value,get statistics(){return statistics;}};
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

const setupInstagram=f=>f.app.store.setSecret('provider:instagram',{clientId:'synthetic-app',clientSecret:'synthetic-secret'});
async function oauthStart(f,platform='instagram',channelId='ig',purpose='publishing'){
  const result=await f.request(f.admin,`/api/oauth/${platform}/start?channelId=${channelId}&${purpose}=1`);assert.equal(result.status,302);return new URL(result.location);
}
const oauthFinish=(f,url,platform='instagram',extra='')=>f.request(f.admin,`/api/oauth/${platform}/callback?state=${encodeURIComponent(url.searchParams.get('state'))}&code=synthetic-code${extra}`);

test('publishing OAuth verifies only granted publishing capability without a statistics request or automatic enablement',async t=>{
  const f=await fixture(t);setupInstagram(f);f.setPermissions(['instagram_business_basic','instagram_business_content_publish']);
  const url=await oauthStart(f);assert.deepEqual(url.searchParams.get('scope').split(','),['instagram_business_basic','instagram_business_content_publish']);
  const result=await oauthFinish(f,url);assert.match(result.location,/connectionPurpose=publishing/);assert.equal(f.statistics,0);assert.equal(f.app.store.all('runs').length,0);assert.deepEqual(f.calls.map(call=>call.path),['me']);
  const credential=f.app.store.secret('channel:ig');assert.equal(credential.accountId,'100');assert.equal(credential.appScopedId,'900');assert.equal(credential.scope,'instagram_business_basic instagram_business_content_publish');assert.ok(credential.permissionsVerifiedAt);assert.equal(credential.metaIdentityVersion,1);
  assert.equal(f.app.store.get('socialDirectConnections','ig'),null);assert.equal(f.app.store.get('socialInboxConnections','ig'),null);assert.equal(f.app.store.get('channels','ig').connectionVersion,3);
  const publicState=JSON.stringify((await f.request(f.admin,'/api/state')).data);assert.ok(!publicState.includes('short-synthetic'));assert.ok(!publicState.includes('long-synthetic'));
});

test('publishing OAuth preserves server-verified existing scopes while ignoring browser scope claims',async t=>{
  const f=await fixture(t);setupInstagram(f);
  f.app.store.setSecret('channel:ig',{scope:'instagram_business_manage_comments instagram_business_manage_insights forged',permissionsVerifiedAt:'2026-10-13T00:00:00.000Z'});
  const url=await oauthStart(f),scopes=url.searchParams.get('scope').split(',');assert.ok(scopes.includes('instagram_business_manage_comments'));assert.ok(scopes.includes('instagram_business_manage_insights'));assert.ok(!scopes.includes('forged'));
  const result=await oauthFinish(f,url,'instagram','&scope=instagram_business_content_publish&permissionsVerifiedAt=2099-01-01&publishing=1');
  assert.match(result.location,/connectionError=/);assert.ok(!result.location.includes('long-synthetic'));assert.equal(f.app.store.secret('channel:ig').permissionsVerifiedAt,'2026-10-13T00:00:00.000Z');assert.equal(f.app.store.get('channels','ig').connectionVersion,2);assert.equal(f.statistics,0);
});

async function connectedManualComments(f,{enabled=true}={}){
  setupInstagram(f);assert.equal((await f.request(f.admin,'/api/channels/ig/connection',input)).status,200);
  if(enabled)assert.equal(f.app.socialInboxProvider.configure(f.admin,{channelId:'ig',enabled:true}).canSync,true);
  return {credentials:structuredClone(f.app.store.secret('channel:ig')),credentialCiphertext:f.app.store.db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get('channel:ig').ciphertext,channel:structuredClone(f.app.store.get('channels','ig')),inbox:structuredClone(f.app.store.get('socialInboxConnections','ig'))};
}
const combinedInstagramScopes=['instagram_business_basic','instagram_business_content_publish','instagram_business_manage_comments'];

test('publishing OAuth preserves proven manual comment permissions and keeps the same account inbox running',async t=>{
  const f=await fixture(t),before=await connectedManualComments(f);assert.equal(before.credentials.permissionsVerifiedAt,null);assert.equal(before.credentials.scope,'');
  f.setPermissions(combinedInstagramScopes);const url=await oauthStart(f);assert.ok(url.searchParams.get('scope').split(',').includes('instagram_business_manage_comments'));
  const done=await oauthFinish(f,url);assert.match(done.location,/connectionPurpose=publishing/);
  const channel=f.app.store.get('channels','ig'),credentials=f.app.store.secret('channel:ig'),inbox=f.app.store.get('socialInboxConnections','ig');
  assert.ok(credentials.scope.includes('instagram_business_manage_comments'));assert.equal(inbox.enabled,true);assert.equal(inbox.connectionVersion,channel.connectionVersion);assert.notEqual(inbox.version,before.inbox.version);assert.equal(inbox.progress,null);assert.equal(f.app.socialInboxProvider.capability(channel).canSync,true);assert.equal(f.app.store.get('socialDirectConnections','ig'),null);assert.equal(f.statistics,0);
});

test('missing retained comment grant refuses publishing OAuth without replacing existing credentials or inbox settings',async t=>{
  const f=await fixture(t),before=await connectedManualComments(f);f.setPermissions(['instagram_business_basic','instagram_business_content_publish']);
  const done=await oauthFinish(f,await oauthStart(f));assert.match(done.location,/connectionError=/);
  assert.deepEqual(f.app.store.secret('channel:ig'),before.credentials);assert.equal(f.app.store.db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get('channel:ig').ciphertext,before.credentialCiphertext);assert.deepEqual(f.app.store.get('channels','ig'),before.channel);assert.deepEqual(f.app.store.get('socialInboxConnections','ig'),before.inbox);assert.equal(f.app.socialInboxProvider.capability(before.channel).canSync,true);
});

test('publishing OAuth retains verified comments even when automatic comment collection is off',async t=>{
  for(const explicitlyDisabled of [false,true]){const f=await fixture(t);await connectedManualComments(f,{enabled:false});if(explicitlyDisabled)f.app.socialInboxProvider.configure(f.admin,{channelId:'ig',enabled:false});const inbox=structuredClone(f.app.store.get('socialInboxConnections','ig'));f.setPermissions(combinedInstagramScopes);const url=await oauthStart(f);
    assert.ok(url.searchParams.get('scope').split(',').includes('instagram_business_manage_comments'));assert.match((await oauthFinish(f,url)).location,/connectionPurpose=publishing/);assert.deepEqual(f.app.store.get('socialInboxConnections','ig'),inbox);assert.ok(f.app.store.secret('channel:ig').scope.includes('instagram_business_manage_comments'));
  }
});

test('comment settings changed during publishing OAuth invalidate the callback before credentials can be replaced',async t=>{
  for(const phase of ['before-exchange','during-identity']){const f=await fixture(t),before=await connectedManualComments(f);f.setPermissions(combinedInstagramScopes);const url=await oauthStart(f);
    let changedInbox;const disable=()=>{f.app.socialInboxProvider.configure(f.admin,{channelId:'ig',enabled:false});changedInbox=structuredClone(f.app.store.get('socialInboxConnections','ig'));};if(phase==='before-exchange')disable();else f.setHook(path=>{if(path==='me')disable();});
    const done=await oauthFinish(f,url);assert.match(done.location,/connectionError=/);assert.deepEqual(f.app.store.secret('channel:ig'),before.credentials);assert.equal(f.app.store.db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get('channel:ig').ciphertext,before.credentialCiphertext);assert.deepEqual(f.app.store.get('channels','ig'),before.channel);assert.equal(f.app.store.get('socialInboxConnections','ig').enabled,false);assert.deepEqual(f.app.store.get('socialInboxConnections','ig'),changedInbox);if(phase==='before-exchange')assert.equal(f.oauthCalls.length,0);
  }
});

test('retained comment OAuth rejects a different account and preserves the existing encrypted connection and inbox',async t=>{
  const f=await fixture(t),before=await connectedManualComments(f);f.setPermissions(combinedInstagramScopes);const url=await oauthStart(f);f.setIdentity({id:'901',user_id:'101',username:'other-account'});
  assert.match((await oauthFinish(f,url)).location,/connectionError=/);assert.equal(f.app.store.db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get('channel:ig').ciphertext,before.credentialCiphertext);assert.deepEqual(f.app.store.get('channels','ig'),before.channel);assert.deepEqual(f.app.store.get('socialInboxConnections','ig'),before.inbox);
});

test('publishing permission upgrade retains collected comments and sent ledger while the restarted scan deduplicates them',async t=>{
  const f=await fixture(t);await connectedManualComments(f);f.setComments([{id:'700',text:'합성 문의',from:{id:'800',username:'synthetic-reader'},replies:{data:[]}}]);
  const collected=await f.request(f.admin,'/api/social/inbox/provider/sync',{channelId:'ig'});assert.equal(collected.status,200);const rows=f.app.store.all('socialInbox');assert.equal(rows.length,1);const row=rows[0];
  f.app.store.put('socialReplyAttempts','synthetic-sent',{id:'synthetic-sent',inboxId:row.id,status:'sent',providerReplyId:'701'});f.app.store.put('socialReplyDedupe','synthetic-dedupe',{id:'synthetic-dedupe',attemptId:'synthetic-sent',status:'sent'});
  const before={rows:structuredClone(f.app.store.all('socialInbox')),attempts:structuredClone(f.app.store.all('socialReplyAttempts')),dedupe:structuredClone(f.app.store.all('socialReplyDedupe'))};assert.ok(f.app.store.get('socialInboxConnections','ig').progress);
  f.setPermissions(combinedInstagramScopes);assert.match((await oauthFinish(f,await oauthStart(f))).location,/connectionPurpose=publishing/);
  assert.deepEqual(f.app.store.all('socialInbox'),before.rows);assert.deepEqual(f.app.store.all('socialReplyAttempts'),before.attempts);assert.deepEqual(f.app.store.all('socialReplyDedupe'),before.dedupe);assert.equal(f.app.store.get('socialInboxConnections','ig').progress,null);
  const repeated=await f.request(f.admin,'/api/social/inbox/provider/sync',{channelId:'ig'});assert.equal(repeated.status,200);assert.equal(f.app.store.all('socialInbox').length,1);assert.equal(f.app.store.all('socialInbox')[0].id,row.id);assert.deepEqual(f.app.store.all('socialReplyAttempts'),before.attempts);assert.deepEqual(f.app.store.all('socialReplyDedupe'),before.dedupe);assert.ok(f.calls.every(call=>call.init.method==='GET'));
});

test('callback query cannot change a comment flow into a publishing flow and state cannot be reused',async t=>{
  const f=await fixture(t);setupInstagram(f);const url=await oauthStart(f,'instagram','ig','comments');
  const result=await oauthFinish(f,url,'instagram','&publishing=1');assert.match(result.location,/connectionPurpose=comments/);assert.doesNotMatch(result.location,/connectionPurpose=publishing/);assert.ok(!f.app.store.secret('channel:ig').scope.includes('content_publish'));
  const before=f.oauthCalls.length,repeated=await oauthFinish(f,url);assert.equal(repeated.status,403);assert.equal(f.oauthCalls.length,before);
});

test('manual token submission cannot forge a publishing grant or permission verification',async t=>{
  const f=await fixture(t);const result=await f.request(f.admin,'/api/channels/ig/connection',{...input,publishing:true,scope:'instagram_business_basic instagram_business_content_publish',permissionsVerifiedAt:'2099-01-01T00:00:00Z',metaIdentityVersion:1});assert.equal(result.status,200);
  const credential=f.app.store.secret('channel:ig');assert.equal(credential.scope,'');assert.equal(credential.permissionsVerifiedAt,null);assert.equal(f.app.socialProvider.capability(f.app.store.get('channels','ig')).canPublish,false);assert.equal(f.statistics,0);
});

test('OAuth state binds the channel generation before exchange and again during identity verification',async t=>{
  for(const phase of ['before-exchange','during-identity']){
    const f=await fixture(t);setupInstagram(f);f.setPermissions(['instagram_business_basic','instagram_business_content_publish']);const url=await oauthStart(f);
    const change=()=>f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),connectionVersion:3});
    if(phase==='before-exchange')change();else f.setHook(path=>{if(path==='me')change();});
    const result=await oauthFinish(f,url);assert.match(result.location,/connectionError=/);assert.equal(f.app.store.secret('channel:ig'),null);assert.equal(f.statistics,0);if(phase==='before-exchange')assert.equal(f.oauthCalls.length,0);
  }
});

test('publishing OAuth refuses a different Meta identity or a revoked employee session',async t=>{
  for(const change of ['identity','session']){
    const f=await fixture(t);setupInstagram(f);f.setPermissions(['instagram_business_basic','instagram_business_content_publish']);const url=await oauthStart(f);
    if(change==='identity')f.setIdentity({id:'901',user_id:'101',username:'someone_else'});else f.setHook(path=>{if(path==='me')f.app.store.revokeUser(f.admin.id);});
    const result=await oauthFinish(f,url);assert.match(result.location,/connectionError=/);assert.equal(f.app.store.secret('channel:ig'),null);assert.equal(f.app.store.get('channels','ig').connectionVersion,2);assert.equal(f.statistics,0);
  }
});

const youtubeId='UC'+'A'.repeat(22),youtubeOther='UC'+'B'.repeat(22),youtubeScopes='https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload';
function setupYouTube(f){f.app.store.put('channels','yt',{id:'yt',platform:'youtube',handle:'@synk',canonicalUrl:'https://www.youtube.com/@synk',externalId:youtubeId,ownerIds:[f.admin.id],active:true,connectionVersion:2});f.app.store.setSecret('provider:youtube',{clientId:'synthetic-google-app',clientSecret:'synthetic-google-secret'});}

test('YouTube publishing OAuth stores only server-observed channel ownership and skips analytics',async t=>{
  const reads=[],f=await fixture(t,{oauthFetch:async()=>json({access_token:'synthetic-google-token',refresh_token:'synthetic-google-refresh',expires_in:3600,scope:youtubeScopes}),youtubeConnectionFetch:async(raw,init)=>{reads.push({url:new URL(raw),init});return json({items:[{id:youtubeId}]});}});setupYouTube(f);
  const url=await oauthStart(f,'youtube','yt');assert.ok(url.searchParams.get('scope').includes('youtube.upload'));
  const result=await oauthFinish(f,url,'youtube');assert.match(result.location,/connectionPurpose=publishing/);assert.equal(reads.length,2);assert.equal(reads[0].url.searchParams.get('id'),youtubeId);assert.equal(reads[1].url.searchParams.get('mine'),'true');assert.equal(f.statistics,0);assert.equal(f.app.store.all('runs').length,0);
  const credential=f.app.store.secret('channel:yt');assert.equal(credential.accountId,youtubeId);assert.equal(credential.scope,youtubeScopes);assert.equal(credential.authType,'google-oauth');assert.ok(credential.permissionsVerifiedAt);assert.equal(credential.refreshToken,'synthetic-google-refresh');assert.equal(f.app.store.get('channels','yt').connectionVersion,3);
  for(const call of reads){assert.equal(call.init.headers.Authorization,'Bearer synthetic-google-token');assert.ok(!call.url.href.includes('synthetic-google-token'));}
  assert.equal(f.app.store.get('socialDirectConnections','yt'),null);
});

test('YouTube callback cannot accept forged upload scope or an unrelated owned channel',async t=>{
  for(const kind of ['scope','identity']){
    let reads=0;const f=await fixture(t,{oauthFetch:async()=>json({access_token:'synthetic-google-token',expires_in:3600,scope:kind==='scope'?'https://www.googleapis.com/auth/youtube.readonly':youtubeScopes}),youtubeConnectionFetch:async()=>{reads++;return json({items:[{id:reads===1?youtubeId:youtubeOther}]});}});setupYouTube(f);
    const result=await oauthFinish(f,await oauthStart(f,'youtube','yt'),'youtube','&scope='+encodeURIComponent(youtubeScopes)+'&accountId='+youtubeId+'&permissionsVerifiedAt=2099-01-01');assert.match(result.location,/connectionError=/);assert.equal(f.app.store.secret('channel:yt'),null);assert.equal(f.app.store.get('channels','yt').connectionVersion,2);assert.equal(f.statistics,0);assert.equal(reads,kind==='scope'?0:2);
  }
});
