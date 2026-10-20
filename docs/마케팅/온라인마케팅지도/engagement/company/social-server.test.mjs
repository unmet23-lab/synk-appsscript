import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createCompanyApp} from './server.mjs';
import dmRuntime from '../../../../../tools/lib/generated/talk-publication.cjs';

test('HTTP website inquiry reaches the permissioned inbox and confirmed conversion only after receipt',async t=>{
  const f=await fixture(t),site='https://site.example.test';
  await f.api(f.admin,'/api/social/tracking/configure',{enabled:true,allowedOrigins:[site]});
  assert.equal((await f.api(f.member,'/api/social/inquiries/configure',{revision:0,enabled:true,channelId:'ig'})).status,403);
  assert.equal((await f.api(f.admin,'/api/social/inquiries/configure',{revision:0,enabled:true,channelId:'ig'})).status,200);
  const post=(await f.api(f.member,'/api/social/posts',{title:'Inquiry',body:'Ask',variants:[{channelId:'ig',text:'Ask'}]})).data.post;
  const link=f.app.socialTracking.createLink(f.member,{postId:post.id,channelId:'ig',destination:site+'/lab/'}).link;
  const clickId=f.app.socialTracking.click(link.id).clickId;
  const payload={requestId:'12345678-1234-4234-8234-123456789012',name:'Test visitor',email:'private-visitor@example.test',message:'Private question',consent:true,clickId};
  const submit=async origin=>fetch(f.base+'/social-inquiry/submit',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal((await submit('https://evil.test')).status,403);
  const response=await submit(site);assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),site);
  const receipt=await response.json();assert.equal(receipt.accepted,true);
  const lookup=async input=>{const r=await fetch(f.base+'/social-inquiry/receipt',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:r.status,data:await r.json()};};
  const recovered=await lookup({requestId:payload.requestId});assert.equal(recovered.status,200);assert.equal(recovered.data.receiptId,receipt.receiptId);assert.equal(recovered.data.state,'received');assert.ok(!JSON.stringify(recovered.data).includes(payload.email));
  assert.equal((await lookup({receiptId:receipt.receiptId,deleteToken:'0'.repeat(64)})).status,403);
  const own=(await f.api(f.member,'/api/social/workspace')).data;
  assert.equal(own.inbox.length,1);assert.match(own.inbox[0].text,/Private question/);assert.equal(own.tracking.totals.verifiedEvents.inquiry,1);
  assert.equal((await f.api(f.outsider,'/api/social/workspace')).data.inbox.length,0);
  assert.equal((await f.api(f.outsider,'/api/social/inquiries/'+receipt.receiptId+'/delete',{})).status,403);
  assert.equal((await f.api(f.member,'/api/social/inquiries/'+receipt.receiptId+'/delete',{})).status,200);
  assert.equal(f.app.store.secret('social-inquiry:'+receipt.receiptId),null);
  assert.equal((await lookup({receiptId:receipt.receiptId,deleteToken:receipt.deleteToken})).data.state,'deleted');
});

async function fixture(t,options={}){const directory=mkdtempSync(join(tmpdir(),'synk-social-http-'));let at='2026-10-13T00:00:00.000Z',sent=0;const provider={settings:()=>({configured:true,integrations:[]}),capability:()=>({mode:'automatic',canPublish:true,formats:['text'],maxTextLength:5000}),publish:async({channel})=>{sent++;return {status:'published',providerId:'remote-'+sent,publicationUrl:channel.platform==='instagram'?'https://www.instagram.com/p/SYNKtest/':'https://www.youtube.com/watch?v=abcdefghijk',publishedAt:at};},status:async()=>({status:'unknown'})};const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'http://127.0.0.1:4191',schedule:false,socialProvider:provider,publicationLinkProbe:async()=>({status:'reachable',detail:'합성 HTTP 응답',httpStatus:200}),clock:()=>at,synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})},...options});t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});const admin=app.store.createUser({email:'admin@social.test',name:'합성 관리자',role:'admin'}),member=app.store.createUser({email:'member@social.test',name:'합성 담당자',role:'member',teamId:'a'}),outsider=app.store.createUser({email:'other@social.test',name:'다른 팀',role:'member',teamId:'b'}),viewer=app.store.createUser({email:'viewer@social.test',name:'열람자',role:'viewer',teamId:'a'});app.store.put('channels','ig',{id:'ig',displayName:'합성 Instagram',platform:'instagram',handle:'test',ownerIds:[member.id],teamId:'a',active:true});const tokens=new Map([admin,member,outsider,viewer].map(u=>[u.id,app.store.mint('session',u.id,{csrfToken:'synthetic-csrf'},60)]));await app.start();const base='http://127.0.0.1:'+app.server.address().port;async function api(user,path,input,headers={}){const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'synthetic-csrf',...(input===undefined?{}:{'Content-Type':'application/json'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});const data=await response.json();return {status:response.status,data};}return {app,directory,base,tokens,admin,member,outsider,viewer,api,get sent(){return sent;},advance(ms){at=new Date(Date.parse(at)+ms).toISOString();}};}
test('HTTP draft -> role-bound approval -> persisted schedule -> worker -> actual result and observation',async t=>{const f=await fixture(t);let r=await f.api(f.member,'/api/social/posts',{title:'예약 시험',body:'문구',variants:[{channelId:'ig',text:'문구',format:'text'}]});assert.equal(r.status,200);let post=r.data.post;assert.equal((await f.api(f.member,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision})).status,403);r=await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision});assert.equal(r.status,200);post=r.data.post;r=await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt:'2026-10-13T00:01:00Z',timezone:'Asia/Seoul'});assert.equal(r.status,200);assert.equal(f.sent,0);f.advance(60000);await f.app.scanSocialPublishing();assert.equal(f.sent,1);await f.app.scanSocialPublishing();assert.equal(f.sent,1);const view=(await f.api(f.admin,'/api/social/workspace')).data;assert.equal(view.jobs[0].status,'published');assert.equal(view.jobs[0].publicVerifiedAt,null);assert.equal(view.insights.records[0].checkpoints.length,2);assert.equal(view.insights.records[0].checkpoints[0].metrics.views,null);assert.equal(f.app.store.all('postPerformanceEntries').length,1);assert.equal(view.accounts[0].name,'합성 Instagram');});
test('read/write permissions, CSRF, demo and source references apply through HTTP',async t=>{const f=await fixture(t),input={title:'private',body:'private body',variants:[{channelId:'ig',text:'private body',format:'text'}]};assert.equal((await f.api(f.member,'/api/social/posts',input,{'X-CSRF-Token':'bad'})).status,403);assert.equal((await f.api(f.viewer,'/api/social/posts',input)).status,403);assert.equal((await f.api(f.member,'/api/social/posts',input,{'X-Synk-Demo':'1'})).status,403);assert.equal((await f.api(f.member,'/api/social/posts',input)).status,200);const other=(await f.api(f.outsider,'/api/social/workspace')).data;assert.deepEqual(other.posts,[]);assert.deepEqual(other.accounts,[]);assert.doesNotMatch(JSON.stringify(other),/private body|합성 Instagram/);const media={id:'private-asset',ownerId:f.outsider.id,mimeType:'image/png',fileName:'test.png',byteSize:20};f.app.store.put('socialMedia',media.id,media);assert.equal((await f.api(f.member,'/api/social/posts',{...input,media:[{assetId:media.id}]})).status,403);assert.equal((await f.api(f.member,'/api/social/bulk/import',{rows:[{...input,media:[{assetId:media.id}]}]})).status,409);});
test('pending jobs respect revoked permissions and remain separate from external completion',async t=>{const f=await fixture(t);let post=(await f.api(f.member,'/api/social/posts',{title:'정지 시험',body:'문구',variants:[{channelId:'ig',text:'문구',format:'text'}]})).data.post;post=(await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision})).data.post;await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt:'2026-10-13T00:01:00Z'});f.app.store.put('users',f.admin.id,{...f.admin,active:false});f.advance(60000);await f.app.scanSocialPublishing();assert.equal(f.sent,0);const job=f.app.store.all('socialPublishJobs')[0];assert.equal(job.status,'failed');assert.equal(job.errorCode,'PERMISSION_OR_VERSION_CHANGED');});

test('slow source and inbox scans do not delay the next due publication',async t=>{
  const f=await fixture(t);let release;const waiting=new Promise(resolve=>release=resolve);
  f.app.socialDistribution.scan=async()=>{await waiting;return {created:0,failed:0};};f.app.socialInboxProvider.scanDue=async()=>{await waiting;return {checked:0,imported:0,updated:0,failed:0};};
  try{
    let post=(await f.api(f.admin,'/api/social/posts',{title:'정시 게시',body:'문구',variants:[{channelId:'ig',text:'문구',format:'text'}]})).data.post;
    post=(await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision})).data.post;
    await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt:'2026-10-13T00:01:00Z'});
    await f.app.scanSocialPublishing();f.advance(60000);await f.app.scanSocialPublishing();assert.equal(f.sent,1);
  }finally{release();await f.app.waitForIdle();}
});

test('HTTP link response and explicit human public confirmation remain distinct',async t=>{
  const f=await fixture(t);let post=(await f.api(f.admin,'/api/social/posts',{title:'공개 확인',body:'문구',variants:[{channelId:'ig',text:'문구',format:'text'}]})).data.post;
  post=(await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision})).data.post;await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt:'2026-10-13T00:01:00Z'});f.advance(60000);await f.app.scanSocialPublishing();
  let job=(await f.api(f.admin,'/api/social/workspace')).data.jobs[0];assert.equal(job.publicVerifiedAt,null);
  assert.equal((await f.api(f.admin,`/api/social/jobs/${job.id}/link-check`,{})).status,200);
  job=(await f.api(f.admin,'/api/social/workspace')).data.jobs[0];assert.equal(job.linkCheck.status,'reachable');assert.equal(job.publicVerifiedAt,null);
  assert.equal((await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'confirm_public',publicationUrl:job.publicationUrl})).status,409);
  assert.equal((await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'confirm_public',confirmed:true,publicationUrl:job.publicationUrl,updatedAt:job.updatedAt})).status,200);
  const view=(await f.api(f.admin,'/api/social/workspace')).data;assert.ok(view.jobs[0].publicVerifiedAt);assert.equal(view.ai.canUse,false);assert.equal(view.inboxProvider.supports.directMessages,false);
});


test('app idle waits for source work started by the completing publication tick',async t=>{
  const f=await fixture(t);let releasePublish,releaseExtras,publishStarted,extrasStarted;
  const publishGate=new Promise(resolve=>releasePublish=resolve),extrasGate=new Promise(resolve=>releaseExtras=resolve),publishing=new Promise(resolve=>publishStarted=resolve),extras=new Promise(resolve=>extrasStarted=resolve),publish=f.app.socialProvider.publish;
  f.app.socialProvider.publish=async input=>{publishStarted();await publishGate;return publish(input);};
  f.app.socialDistribution.scan=async()=>{extrasStarted();await extrasGate;return {created:0,failed:0};};
  try{
    let post=(await f.api(f.admin,'/api/social/posts',{title:'대기 경합',body:'문구',variants:[{channelId:'ig',text:'문구',format:'text'}]})).data.post;
    post=(await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision})).data.post;
    await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt:'2026-10-13T00:01:00Z'});f.advance(60000);
    const tick=f.app.scanSocialPublishing();await publishing;let idleFinished=false;const idle=f.app.waitForIdle().then(()=>{idleFinished=true;});
    releasePublish();await extras;await tick;await nextTurn();assert.equal(idleFinished,false,'idle must include extras created after the initial wait call');
    releaseExtras();await idle;assert.equal(idleFinished,true);assert.equal(f.sent,1);
  }finally{releasePublish();releaseExtras();await f.app.waitForIdle();}
});


const handoffPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
function localAsset(f){const id=randomUUID(),diskName=id+'.png';mkdirSync(join(f.directory,'studio-media'),{recursive:true});writeFileSync(join(f.directory,'studio-media',diskName),handoffPng);f.app.store.put('socialMedia',id,{id,diskName,fileName:'승인 파일.png',ownerId:f.member.id,teamId:'a',mimeType:'image/png',byteSize:handoffPng.length,width:1,height:1,sha256:createHash('sha256').update(handoffPng).digest('hex')});return {id,assetId:id,url:'/api/social/media/'+id};}

test('HTTP handoff GET and HEAD return approved bytes and reject forbidden users or changed files',async t=>{
  const f=await fixture(t),ref=localAsset(f),input=f.app.socialMarketing.validatePostInput(f.member,{title:'승인 파일',variants:[{channelId:'ig',text:'승인한 문구',format:'text',media:[ref]}]});
  let post=f.app.socialPublishing.savePost(f.member,input).post;post=f.app.socialPublishing.action(f.admin,post.id,{action:'approve',revision:post.revision}).post;
  const [job]=f.app.socialPublishing.action(f.admin,post.id,{action:'schedule',revision:post.revision,scheduledAt:'2026-10-13T00:01:00Z'}).jobs;
  const path=`/api/social/jobs/${job.id}/media/0/download`,headers=user=>({Cookie:'synk_company_session='+f.tokens.get(user.id)});
  const response=await fetch(f.base+path,{headers:headers(f.admin)});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('content-length'),String(handoffPng.length));assert.match(response.headers.get('content-disposition'),/^attachment;/);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),handoffPng);
  const head=await fetch(f.base+path,{method:'HEAD',headers:headers(f.admin)});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(head.headers.get('content-length'),String(handoffPng.length));
  assert.equal((await fetch(f.base+path,{headers:headers(f.member)})).status,403);assert.equal((await fetch(f.base+path,{headers:headers(f.outsider)})).status,404);assert.equal((await fetch(f.base+`/api/social/jobs/${job.id}/media/1/download`,{headers:headers(f.admin)})).status,404);
  const changed=Buffer.from(handoffPng);changed[changed.length-1]^=1;writeFileSync(join(f.directory,'studio-media',ref.id+'.png'),changed);
  const denied=await fetch(f.base+path,{headers:headers(f.admin)});assert.equal(denied.status,409);assert.match(denied.headers.get('content-type'),/json/);assert.equal(denied.headers.get('content-disposition'),null);
});

test('HTTP post creation rechecks session and channel write access after asynchronous preparation',async t=>{
  for(const change of ['session','channel']){
    const f=await fixture(t),ref=localAsset(f);let release,started;const gate=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve);
    f.app.socialMarketing.prepareMedia=async()=>{started();await gate;return {media:[]};};
    try{
      const request=f.api(f.member,'/api/social/posts',{title:'준비 중 원고',variants:[{channelId:'ig',text:'문구',format:'text',media:[ref]}]});await began;
      if(change==='session')f.app.store.revokeUser(f.member.id);else f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),ownerIds:[]});
      release();const response=await request;assert.equal(response.status,change==='session'?401:404);assert.equal(f.app.store.all('socialPosts').length,0);
    }finally{release();}
  }
});

test('shutdown waits for in-flight extras and does not start extras after an interrupted publication tick',async t=>{
  const f=await fixture(t);let release,started,extrasCalls=0;const gate=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve);
  f.app.socialPublishing.tick=async()=>{started();await gate;return {processed:0};};
  f.app.socialDistribution.scan=async()=>{extrasCalls++;return {created:0,failed:0};};
  const tick=f.app.scanSocialPublishing();await began;let stopped=false;const stopping=f.app.stop().then(()=>{stopped=true;});
  await nextTurn();assert.equal(stopped,false);release();await tick;await stopping;assert.equal(extrasCalls,0);assert.equal(stopped,true);
  const g=await fixture(t);let releaseExtras,startedExtras;const extrasGate=new Promise(resolve=>releaseExtras=resolve),extrasBegan=new Promise(resolve=>startedExtras=resolve);
  g.app.socialDistribution.scan=async()=>{startedExtras();await extrasGate;return {created:0,failed:0};};
  await g.app.scanSocialPublishing();await extrasBegan;let extrasStopped=false;const stopExtras=g.app.stop().then(()=>{extrasStopped=true;});await nextTurn();assert.equal(extrasStopped,false);releaseExtras();await stopExtras;assert.equal(extrasStopped,true);
});


test('HTTP approved DM draft → successful provider receipt → existing worker registration → scoped status',async t=>{
  let remote=null,uploads=0,catchups=0;
  const f=await fixture(t,{socialDmRegistrationOptions:{configuration:()=>({projectRef:'a'.repeat(20),serviceRoleKey:'synthetic_service_key_'.repeat(3)}),
    adapterFactory:({handoff})=>({inspectPost:async()=>({account_id:'100001',media_id:'900001',permalink:handoff.post_url}),campaign:async()=>remote,
      metadata:async()=>{throw Error('URL material only');},upload:async()=>{uploads++;return {ok:true,private_verified:true,readback_verified:true};},
      registerFolder:async()=>{remote={...dmRuntime.expected(dmRuntime.inputFor(handoff)),enabled:true,copy_approved_at:new Date().toISOString(),routing_id:'17',media_id:'900001',dm_enabled:true};return {ok:true};},
      catchUp:async()=>{catchups++;return {ok:true,verified:true,has_more:false,queued:0,scanned:0};}})}});
  f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),externalId:'100001',handle:'fixture',connectionVersion:1});
  f.app.socialProvider.publish=async()=>({status:'published',providerId:'900001',publicationUrl:'https://www.instagram.com/p/FixtureDm/',publishedAt:'2026-10-13T00:01:00.000Z'});
  const dm={account_id:'100001',title:'검토 자료',keyword:'자료',message:'확정된 안내입니다.',duration_mode:'evergreen',ends_at:null,opening_mode:'resource',resource:{kind:'url',url:'https://synk.im/builds/manual/',folder_id:'fixture_campaign_folder',library_root:'fixture_library_root'}};
  let response=await f.api(f.member,'/api/social/posts',{title:'DM 연계',body:'실제 게시문',variants:[{channelId:'ig',text:'실제 게시문',format:'text',dm}]});
  assert.equal(response.status,200);let post=response.data.post;assert.equal(post.variants[0].dm.opening_mode,'resource');
  post=(await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision})).data.post;
  assert.equal((await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt:'2026-10-13T00:01:00Z'})).status,200);
  f.advance(60000);await f.app.scanSocialPublishing();
  const view=(await f.api(f.admin,'/api/social/workspace')).data;
  assert.equal(view.jobs[0].status,'published');assert.equal(view.dmRegistration.items[0].state,'registered');assert.equal(view.dmRegistration.items[0].routingCode,'D0017');
  assert.equal(f.app.store.all('postPerformanceEntries').length,1);assert.equal(uploads,1);assert.equal(catchups,1);
  await f.app.scanSocialPublishing();assert.equal(uploads,1);assert.equal(catchups,1);
  const foreign=(await f.api(f.outsider,'/api/social/workspace')).data;
  assert.deepEqual(foreign.dmRegistration.items,[]);assert.ok(!JSON.stringify(foreign).includes('확정된 안내'));
});
async function scheduleDmFixture(f,dm,scheduledAt='2026-10-13T00:01:00.000Z'){
  f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),externalId:'100001',handle:'fixture',connectionVersion:1});
  let r=await f.api(f.admin,'/api/social/posts',{title:'DM 결과 분리',body:'승인 본문',variants:[{channelId:'ig',text:'승인 본문',format:'text',dm}]});
  assert.equal(r.status,200);let post=r.data.post;
  post=(await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision})).data.post;
  r=await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt});
  assert.equal(r.status,200);return r.data.jobs[0];
}
const serverDm={account_id:'100001',title:'승인 자료',keyword:'자료',message:'승인한 안내',duration_mode:'evergreen',ends_at:null,
  resource:{kind:'url',url:'https://synk.im/builds/manual/',folder_id:'fixture_campaign_folder',library_root:'fixture_library_root'}};
test('publication crosses DM expiry while provider waits: public result and performance persist with an expired DM status',async t=>{
  const f=await fixture(t),job=await scheduleDmFixture(f,{...serverDm,duration_mode:'fixed',ends_at:'2026-10-13T00:00:10.000Z'},'2026-10-13T00:00:05.000Z');
  f.app.socialProvider.publish=async()=>{f.advance(10000);return {status:'published',providerId:'900001',publicationUrl:'https://www.instagram.com/p/ExpiredDm/',publishedAt:'2026-10-13T00:00:15.000Z'};};
  f.advance(5000);await f.app.socialPublishing.tick();
  const result=f.app.store.get('socialPublishJobs',job.id);
  assert.equal(result.status,'published');assert.ok(result.outcomeLinkedAt);assert.equal(result.outcomeError,null);
  assert.equal(f.app.store.all('postPerformanceEntries').length,1);
  assert.equal(f.app.dmRegistration.status(f.admin).items[0].state,'material_expired');
  assert.equal((await f.app.dmRegistration.tick()).processed,0);
});
test('unexpected DM enqueue failure cannot suppress performance or expose provider text',async t=>{
  const f=await fixture(t);await scheduleDmFixture(f,serverDm);
  f.app.dmRegistration.enqueue=()=>{throw Error('private-provider-token');};
  f.advance(60000);await f.app.socialPublishing.tick();
  assert.equal(f.app.store.all('postPerformanceEntries').length,1);
  const view=f.app.dmRegistration.status(f.admin);assert.equal(view.items[0].state,'verification_required');
  assert.doesNotMatch(JSON.stringify(f.app.store.all('socialDmRegistrations')),/private-provider-token/);
});
test('performance retry after manual receipt correction keeps the old DM binding and records the new performance URL',async t=>{
  const f=await fixture(t),job=await scheduleDmFixture(f,serverDm);
  const register=f.app.postPerformance.register;let first=true;
  f.app.postPerformance.register=(...args)=>{if(first){first=false;throw Error('synthetic temporary failure');}return register(...args);};
  f.app.socialProvider.publish=async()=>({status:'published',providerId:'900001',publicationUrl:'https://www.instagram.com/p/FirstDm/',publishedAt:'2026-10-13T00:01:00.000Z'});
  f.advance(60000);await f.app.socialPublishing.tick();
  const prior=f.app.store.all('socialDmRegistrations')[0];assert.equal(prior.state,'pending');
  assert.ok(f.app.store.get('socialPublishJobs',job.id).outcomeError);
  const response=await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'manual_complete',publicationUrl:'https://www.instagram.com/p/CorrectedDm/',publishedAt:'2026-10-13T00:01:00.000Z'});
  assert.equal(response.status,200);assert.ok(f.app.store.get('socialPublishJobs',job.id).outcomeLinkedAt);
  assert.equal(f.app.store.all('postPerformanceEntries').length,1);
  const dm=f.app.store.all('socialDmRegistrations')[0];assert.equal(dm.state,'receipt_conflict');assert.equal(dm.fingerprint,prior.fingerprint);
  assert.equal((await f.app.dmRegistration.tick()).processed,0);
});
