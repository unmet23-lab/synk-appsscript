import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t,{metaFetch}={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-four-http-'));let at='2026-10-13T00:00:00.000Z',sent=0,healthCalls=0;
  const provider={settings:()=>({configured:true,integrations:[],rateLimit:{requests:30}}),health:()=>({api:{state:'unchecked',stale:true},channels:[],canCheck:true}),checkHealth:async user=>{if(user.role!=='admin')throw Object.assign(new Error('관리자만 연결 점검을 실행할 수 있습니다.'),{status:403});healthCalls++;return provider.health();},capability:()=>({mode:'automatic',canPublish:true,formats:['text'],maxTextLength:5000}),publish:async()=>({status:'published',providerId:'fake-'+(++sent),publicationUrl:'https://www.instagram.com/p/FOUR'+sent+'/',publishedAt:at}),status:async()=>({status:'unknown'})};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'http://127.0.0.1:4191',schedule:false,socialProvider:provider,...(metaFetch?{metaConnectionFetch:metaFetch,socialInboxOptions:{fetchImpl:metaFetch},socialReplyOptions:{fetchImpl:metaFetch}}:{}),clock:()=>at,synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({email:'admin@four.test',name:'합성 관리자',role:'admin'}),writer=app.store.createUser({email:'writer@four.test',name:'합성 작성자',role:'member',teamId:'a'}),other=app.store.createUser({email:'other@four.test',name:'다른 팀',role:'member',teamId:'b'});
  app.store.put('channels','ig',{id:'ig',displayName:'합성 계정',platform:'instagram',handle:'fixture',ownerIds:[writer.id],teamId:'a',active:true});
  const tokens=new Map([admin,writer,other].map(u=>[u.id,app.store.mint('session',u.id,{csrfToken:'four-csrf'},60)]));await app.start();const base='http://127.0.0.1:'+app.server.address().port;
  async function api(user,path,input,headers={}){const r=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'four-csrf',...(input===undefined?{}:{'Content-Type':'application/json'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:r.status,data:await r.json()};}
  async function post(text='원래 승인 문구'){const r=await api(writer,'/api/social/posts',{title:'비교 원고',purpose:'상담',variants:[{channelId:'ig',format:'text',text}]});assert.equal(r.status,200);return r.data.post;}
  async function schedule(post,time='2026-10-13T01:00:00Z'){let r=await api(admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision});r=await api(admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:r.data.post.revision,scheduledAt:time});assert.equal(r.status,200);return r.data.jobs[0];}
  return {app,admin,writer,other,api,post,schedule,setTime:value=>at=value,get sent(){return sent;},get healthCalls(){return healthCalls;}};
}

test('HTTP reservation capacity previews and explicitly moves selected fixed jobs with CSRF and stale checks',async t=>{
  const f=await fixture(t),a=await f.schedule(await f.post()),b=await f.schedule(await f.post());
  let r=await f.api(f.admin,'/api/social/capacity/preview',{jobIds:[a.id,b.id]});assert.equal(r.status,200);assert.equal(r.data.validCount,0);
  r=await f.api(f.admin,'/api/social/capacity/preview',{jobIds:[a.id,b.id],includeFixedJobIds:[b.id]});assert.equal(r.status,200);assert.equal(r.data.validCount,1);const previewId=r.data.previewId;
  assert.equal((await f.api(f.admin,'/api/social/capacity/apply',{previewId,confirmed:true},{'X-CSRF-Token':'bad'})).status,403);
  assert.equal((await f.api(f.other,'/api/social/capacity/apply',{previewId,confirmed:true})).status,404);
  assert.equal((await f.api(f.admin,'/api/social/capacity/apply',{previewId,confirmed:true})).status,200);
  assert.equal(f.app.store.get('socialPublishJobs',a.id).scheduledAt,a.scheduledAt);assert.notEqual(f.app.store.get('socialPublishJobs',b.id).scheduledAt,b.scheduledAt);assert.equal(f.sent,0);
});

test('HTTP copy comparison uses published snapshot and saves its reviewed template through the existing path',async t=>{
  const f=await fixture(t),post=await f.post(),job=await f.schedule(post,'2026-10-13T00:01:00Z');f.setTime('2026-10-13T00:01:00.000Z');await f.app.scanSocialPublishing();
  const r=await f.api(f.writer,'/api/social/copy-insights?hours=24');assert.equal(r.status,200);assert.equal(r.data.groups.length,1);assert.equal(r.data.groups[0].variants[0].text,'원래 승인 문구');assert.equal(r.data.groups[0].variants[0].sampleCount,0);
  assert.deepEqual((await f.api(f.other,'/api/social/copy-insights')).data.groups,[]);assert.equal((await f.api(f.writer,'/api/social/copy-insights?hours=48')).status,400);
  const preview=await f.api(f.writer,'/api/social/copy-insights/template-preview',{jobId:job.id});assert.equal(preview.status,200);assert.equal(f.app.store.all('socialTemplates').length,0);
  const saved=await f.api(f.writer,'/api/social/templates',{name:'확인한 문구',post:preview.data.post});assert.equal(saved.status,200);assert.equal(saved.data.template.post.variants[0].text,'원래 승인 문구');assert.equal(saved.data.template.post.approval,undefined);assert.equal(f.sent,1);
});

test('HTTP health and reply entry points are authenticated, CSRF protected, and manual inbox cannot send',async t=>{
  const f=await fixture(t),view=await f.api(f.writer,'/api/social/workspace');assert.equal(view.status,200);assert.ok(view.data.capacity);assert.ok(view.data.replies);assert.ok(view.data.inboxHealth);assert.equal(view.data.connectionHealth.api.state,'unchecked');
  assert.equal((await f.api(f.admin,'/api/social/provider/health',{}, {'X-CSRF-Token':'bad'})).status,403);assert.equal(f.healthCalls,0);
  assert.equal((await f.api(f.writer,'/api/social/provider/health',{})).status,403);assert.equal((await f.api(f.admin,'/api/social/provider/health',{})).status,200);assert.equal(f.healthCalls,1);
  const item=(await f.api(f.writer,'/api/social/inbox',{channelId:'ig',kind:'comment',text:'수동 기록',replyDraft:'임시 답장'})).data.item;
  const preview=await f.api(f.writer,'/api/social/inbox/reply/preview',{inboxId:item.id,revision:item.revision,text:'최종 답장'});assert.ok(preview.status>=400);assert.equal(f.sent,0);
  assert.equal((await f.api(f.writer,'/api/social/inbox/reply/send',{previewId:'invalid',confirmationToken:'invalid',idempotencyKey:'invalid'},{'X-CSRF-Token':'bad'})).status,403);
});

test('HTTP official reply confirms the exact account and text once, then reconciles a lost provider response by GET',async t=>{
  let posts=0,lose=false;const response=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
  const metaFetch=async(url,init)=>{const path=new URL(url).pathname.split('/').slice(2).join('/');if(path==='me')return response({id:'100',username:'fixture'});if(path==='300'||path==='301')return response({id:path,text:'원댓글',media:{id:'200'}});if(path==='200')return response({id:'200',owner:{id:'100'}});if(init.method==='GET'&&/^30[01]\/replies$/.test(path))return response({data:[]});if(init.method==='POST'){posts++;assert.match(path,/^30[01]\/replies$/);assert.equal(new URLSearchParams(init.body).get('message'),'확인한 답장');if(lose)throw Error('synthetic connection lost after write');return response({id:'400'});}if(path==='401')return response({id:'401',parent_id:'301',media:{id:'200'},user:{id:'100'},text:'확인한 답장',timestamp:'2026-10-13T00:00:00.000Z'});throw Error('Unexpected fake Meta endpoint');};
  const f=await fixture(t,{metaFetch});f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),externalId:'100',connectionVersion:1});f.app.store.setSecret('channel:ig',{accessToken:'synthetic-four-meta-token',expiresAt:'2099-01-01T00:00:00.000Z',authType:'instagram-login',apiVersion:'v26.0',scope:'instagram_business_basic instagram_business_manage_comments'});
  for(const id of ['300','301'])f.app.store.put('socialInbox','inbox-'+id,{id:'inbox-'+id,channelId:'ig',revision:1,kind:'comment',source:'api:instagram',sourceAccountId:'100',externalId:id,nativePostId:'200',text:'원댓글',author:'reader',url:'https://www.instagram.com/p/FOUR/',importedAt:'2026-10-13T00:00:00Z',updatedAt:'2026-10-13T00:00:00Z',replyDraft:'저장된 초안',outboundSent:false});
  const preview=async id=>{const r=await f.api(f.writer,'/api/social/inbox/reply/preview',{inboxId:'inbox-'+id,revision:1,text:'확인한 답장'});assert.equal(r.status,200,JSON.stringify(r.data));return {previewId:r.data.preview.id,confirmationToken:r.data.confirmationToken,idempotencyKey:r.data.idempotencyKey};};
  const first=await preview('300');assert.equal(posts,0);const [a,b]=await Promise.all([f.api(f.writer,'/api/social/inbox/reply/send',first),f.api(f.writer,'/api/social/inbox/reply/send',first)]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(posts,1);
  let item=f.app.store.get('socialInbox','inbox-300');assert.equal(item.outboundSent,true);assert.equal(item.replyDraft,'저장된 초안');let edited=await f.api(f.writer,'/api/social/inbox/inbox-300',{revision:item.revision,replyDraft:'다음 초안'});assert.equal(edited.status,200);assert.equal(edited.data.item.outboundSent,true);
  lose=true;const second=await preview('301'),unknown=await f.api(f.writer,'/api/social/inbox/reply/send',second);assert.equal(unknown.status,200);assert.equal(unknown.data.attempt.status,'unknown');assert.equal(posts,2);
  const blocked=await f.api(f.writer,'/api/social/inbox/reply/preview',{inboxId:'inbox-301',revision:1,text:'문구를 바꿔도 차단'});assert.equal(blocked.status,409);assert.equal(posts,2);
  const early=await f.api(f.writer,'/api/social/inbox/reply/recheck',{attemptId:unknown.data.attempt.id});assert.equal(early.status,409,JSON.stringify(early.data));assert.equal(posts,2);assert.equal(f.app.store.get('socialReplyAttempts',unknown.data.attempt.id).status,'unknown');
  const recovered=await f.api(f.writer,'/api/social/inbox/reply/reconcile',{attemptId:unknown.data.attempt.id,remoteReplyId:'401'});assert.equal(recovered.status,200,JSON.stringify(recovered.data));assert.equal(recovered.data.attempt.status,'sent');assert.equal(posts,2);assert.equal(f.app.store.get('socialInbox','inbox-301').outboundSent,true);
});

test('HTTP observed replies return the confirmation code, answered state and preserved draft without posting',async t=>{
  let writes=0;const response=body=>new Response(JSON.stringify(body));
  const metaFetch=async(url,init)=>{const path=new URL(url).pathname.split('/').slice(2).join('/');if(init.method!=='GET'){writes++;throw Error('no send in this test');}if(path==='me')return response({id:'100',username:'fixture'});if(path==='300')return response({id:'300',text:'원댓글',media:{id:'200'}});if(path==='200')return response({id:'200',owner:{id:'100'}});if(path==='300/replies')return response({data:[{id:'500',from:{id:'100'},parent_id:'300'}]});throw Error('Unexpected fake Meta endpoint');};
  const f=await fixture(t,{metaFetch});f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),externalId:'100',connectionVersion:1});f.app.store.setSecret('channel:ig',{accessToken:'synthetic-four-token',expiresAt:'2099-01-01T00:00:00.000Z',authType:'instagram-login',scope:'instagram_business_basic instagram_business_manage_comments'});
  f.app.store.put('socialInbox','observed',{id:'observed',channelId:'ig',revision:1,kind:'comment',source:'api:instagram',sourceAccountId:'100',externalId:'300',nativePostId:'200',text:'원댓글',author:'reader',status:'open',replyDraft:'보존할 초안',importedAt:'2026-10-13T00:00:00Z',updatedAt:'2026-10-13T00:00:00Z'});
  let result=await f.api(f.writer,'/api/social/inbox/reply/preview',{inboxId:'observed',revision:1,text:'추가 답장'});assert.equal(result.status,409);assert.equal(result.data.code,'EXISTING_REPLY_REQUIRES_CONFIRMATION');
  const state=(await f.api(f.writer,'/api/social/workspace')).data,item=state.inbox.find(row=>row.id==='observed');assert.equal(item.effectiveStatus,'answered');assert.equal(item.status,'open');assert.equal(item.replyDraft,'보존할 초안');assert.notEqual(item.outboundSent,true);assert.equal(state.replies.attempts.length,0);
  assert.ok(f.app.store.get('socialInbox','observed').metaReplyProofIds.length);for(const key of ['metaReplyProofIds','metaReplyCompleteAt','metaAccountReply'])assert.equal(Object.hasOwn(item,key),false);
  result=await f.api(f.writer,'/api/social/inbox/reply/preview',{inboxId:'observed',revision:item.revision,text:'추가 답장',observedReplyAcknowledgmentKey:item.observedReplyAcknowledgmentKey});assert.equal(result.status,200);assert.equal(result.data.preview.observedReply.replyCount,1);assert.equal(writes,0);
});

test('HTTP reconnection checks current account and CSRF before resuming the prior collector selection',async t=>{
  const calls=[],response=body=>new Response(JSON.stringify(body));
  const metaFetch=async(url,init)=>{calls.push({url,method:init.method});assert.equal(init.method,'GET');const path=new URL(url).pathname.split('/').slice(2).join('/');if(path==='me')return response({id:'901',user_id:'100',username:'fixture'});if(path==='100/media')return response({data:[{id:'200',permalink:'https://www.instagram.com/p/FOLLOWUP/'}]});if(path==='200')return response({id:'200',owner:{id:'901'}});if(path==='200/comments')return response({data:[]});throw Error('Unexpected fake Meta endpoint '+path);};
  const f=await fixture(t,{metaFetch});f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),externalId:'100',connectionVersion:2});f.app.store.setSecret('channel:ig',{accessToken:'synthetic-new-token',expiresAt:'2099-01-01T00:00:00.000Z',authType:'instagram-login',accountId:'100',appScopedId:'901',metaIdentityVersion:1,scope:'instagram_business_basic instagram_business_manage_comments'});
  f.app.store.put('socialInboxConnections','ig',{id:'ig',enabled:true,version:'old-settings',connectionVersion:1,updatedBy:f.admin.id});
  let view=(await f.api(f.admin,'/api/social/workspace')).data.inboxProvider.channels.find(row=>row.channelId==='ig');assert.equal(view.recovery.state,'reconnected');const input={channelId:'ig',connectionVersion:2,settingsVersion:'old-settings'};
  assert.equal((await f.api(f.admin,'/api/social/inbox/provider/recovery/verify',input,{'X-CSRF-Token':'wrong'})).status,403);assert.equal(calls.length,0);
  assert.equal((await f.api(f.other,'/api/social/inbox/provider/recovery/verify',input)).status,403);assert.equal(calls.length,0);
  const verified=await f.api(f.admin,'/api/social/inbox/provider/recovery/verify',input);assert.equal(verified.status,200,JSON.stringify(verified.data));assert.equal(verified.data.recovery.canResume,true);assert.equal(f.app.store.get('socialInboxConnections','ig').connectionVersion,1);
  const resumed=await f.api(f.admin,'/api/social/inbox/provider/recovery/resume',{...input,recoveryId:verified.data.recovery.recoveryId});assert.equal(resumed.status,200,JSON.stringify(resumed.data));assert.equal(resumed.data.status,'resumed');assert.equal(f.app.store.get('socialInboxConnections','ig').connectionVersion,2);assert.equal(f.app.store.get('socialInboxConnections','ig').enabled,true);
  assert.ok(calls.every(call=>call.method==='GET'));assert.equal(f.app.store.all('socialReplyAttempts').length,0);
});

test('only requests that save something tell every screen to refresh',async()=>{
  const {socialChangeNotifies}=await import('./social-routes.mjs');
  for(const path of ['/api/social/queue/preview','/api/social/capacity/preview','/api/social/copy-insights/template-preview','/api/social/inbox/reply/preview','/api/social/workflow/preview','/api/social/ai/quote','/api/social/insights/variants','/api/social/recovery/save'])assert.equal(socialChangeNotifies(path),false,path);
  for(const path of ['/api/social/posts','/api/social/capacity/apply','/api/social/inbox/reply/send','/api/social/settings','/api/social/workflow/apply','/api/social/ai/generate','/api/social/media/prepare'])assert.equal(socialChangeNotifies(path),true,path);
});
