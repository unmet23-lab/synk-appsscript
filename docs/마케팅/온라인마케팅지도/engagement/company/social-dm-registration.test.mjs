import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialDmRegistration,createTalkPublicationAdapters} from './social-dm-registration.mjs';
import runtime from '../../../../../tools/lib/generated/talk-publication.cjs';

const DM={account_id:'100001',title:'승인한 자료',keyword:'자료',message:'이 자료를 확인해 주세요.',duration_mode:'evergreen',
  ends_at:null,opening_mode:'resource',resource:{kind:'url',url:'https://synk.im/builds/manual/',folder_id:'fixture_campaign_folder',library_root:'fixture_library_root'}};
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-dm-outbox-')),store=new Store(directory);
  const user=store.createUser({email:'fixture@local.test',name:'합성 담당자',role:'admin'});
  store.put('channels','ig',{id:'ig',platform:'instagram',externalId:'100001',handle:'@fixture',active:true,ownerIds:[user.id],connectionVersion:1});
  let stamp=Date.now(),remote=null,uploads=0,registrations=0,catchups=0,handoff,adapter,credentials=true;
  const outbox=createSocialDmRegistration({store,dataDir:directory,clock:()=>new Date(stamp).toISOString(),
    configuration:()=>credentials?{projectRef:'a'.repeat(20),serviceRoleKey:'fixture_service_key_'.repeat(3)}:{},
    adapterFactory:input=>{
      handoff=input.handoff;
      adapter={metadata:async()=>{throw Error('URL fixture');},inspectPost:async()=>({account_id:DM.account_id,media_id:'900001',permalink:handoff.post_url}),
        campaign:async()=>remote,upload:async()=>{uploads++;return {ok:true,private_verified:true,readback_verified:true};},
        registerFolder:async()=>{registrations++;remote=good();return {ok:true};},
        catchUp:async()=>{catchups++;return {ok:true,verified:true,has_more:false,queued:0,scanned:0};},
        ...overrides};
      return adapter;
    }});
  const good=()=>({...runtime.expected(runtime.inputFor(handoff)),enabled:true,copy_approved_at:new Date(stamp).toISOString(),routing_id:'12',media_id:null,
    dm_enabled:true,public_reply_enabled:true,conversation_enabled:true});
  const overrides={};
  const publishing=createSocialPublishingService({store,clock:()=>new Date(stamp).toISOString(),
    provider:{capability:()=>({mode:'automatic',canPublish:true,formats:['post']}),publish:async()=>({status:'published',providerId:'900001',
      url:'https://www.instagram.com/p/FixturePost/',publishedAt:new Date(stamp).toISOString()})},
    onPublished:value=>outbox.enqueue(value)});
  async function publish(dm=DM){
    let post=publishing.savePost(user,{title:'실제 원고',body:'게시문',variants:[{channelId:'ig',format:'post',text:'게시문',dm:structuredClone(dm)}]}).post;
    post=publishing.action(user,post.id,{revision:post.revision,action:'approve'}).post;
    const job=publishing.action(user,post.id,{revision:post.revision,action:'schedule',scheduledAt:new Date(stamp).toISOString()}).jobs[0];
    await publishing.tick();return {post,job:store.get('socialPublishJobs',job.id)};
  }
  t.after(async()=>{await publishing.close();await outbox.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  return {directory,store,user,outbox,publishing,publish,overrides,good,advance:()=>{stamp+=301000;},setRemote:value=>{remote=value;},
    setConfigured:value=>{credentials=value;},counts:()=>({uploads,registrations,catchups}),handoff:()=>handoff};
}
test('approved Workspace publication queues the exact DM contract and completes once through the existing Talk core',async t=>{
  const f=await fixture(t),{job}=await f.publish();
  assert.equal(job.status,'published');assert.equal(f.store.all('socialDmRegistrations').length,1);
  await f.outbox.tick();
  assert.equal(f.outbox.status(f.user).items[0].state,'registered');assert.equal(f.outbox.status(f.user).items[0].routingCode,'D0012');
  assert.deepEqual(f.counts(),{uploads:1,registrations:1,catchups:1});
  f.outbox.enqueue({job});await f.outbox.tick();assert.deepEqual(f.counts(),{uploads:1,registrations:1,catchups:1});
  assert.equal(f.handoff().campaign.resource.url,DM.resource.url);assert.equal(f.handoff().campaign.opening_mode,'resource');
  assert.ok(!JSON.stringify(f.outbox.status(f.user)).includes('fixture_service_key'));
});
test('DM edits revoke Workspace approval and a different account is rejected before a job exists',async t=>{
  const f=await fixture(t);
  const draft=f.publishing.savePost(f.user,{title:'검토용',variants:[{channelId:'ig',text:'본문',dm:structuredClone(DM)}]}).post;
  const approved=f.publishing.action(f.user,draft.id,{revision:draft.revision,action:'approve'}).post;
  const updated=f.publishing.savePost(f.user,{revision:approved.revision,variants:[{channelId:'ig',text:'본문',dm:{...DM,message:'바뀐 안내'}}]},draft.id).post;
  assert.equal(updated.approval,null);assert.equal(updated.status,'draft');
  assert.throws(()=>f.publishing.savePost(f.user,{title:'다른 계정',variants:[{channelId:'ig',dm:{...DM,account_id:'200001'}}]}),/계정/);
  assert.equal(f.store.all('socialPublishJobs').length,0);
});
test('an expired fixed contract is visible as expired and never relabelled as an approval edit',async t=>{
  const f=await fixture(t),{job}=await f.publish();
  const current=f.store.get('socialPublishJobs',job.id);
  current.snapshot.variant.dm={...current.snapshot.variant.dm,duration_mode:'fixed',ends_at:'2020-01-01T00:00:00.000Z'};
  f.store.put('socialPublishJobs',job.id,current);
  assert.doesNotThrow(()=>f.outbox.enqueue({job:current}));
  assert.equal(f.outbox.status(f.user).items[0].state,'material_expired');
  await f.outbox.tick();f.advance();await f.outbox.tick();
  assert.equal(f.outbox.status(f.user).items[0].state,'material_expired');
  assert.deepEqual(f.counts(),{uploads:0,registrations:0,catchups:0});
});
test('a changed completed receipt preserves the original binding and requires explicit reconciliation',async t=>{
  const f=await fixture(t),{job}=await f.publish(),prior=f.store.all('socialDmRegistrations')[0];
  f.store.put('socialPublishJobs',job.id,{...job,publicationUrl:'https://www.instagram.com/p/DifferentReceipt/'});
  assert.doesNotThrow(()=>f.outbox.enqueue({job}));
  const current=f.store.all('socialDmRegistrations')[0];
  assert.equal(current.state,'receipt_conflict');assert.equal(current.fingerprint,prior.fingerprint);
  await f.outbox.tick();assert.deepEqual(f.counts(),{uploads:0,registrations:0,catchups:0});
});
test('the same approved fixed contract can expire while registration waits without an approval-change warning',async t=>{
  const f=await fixture(t),{job}=await f.publish({...DM,duration_mode:'fixed',ends_at:new Date(Date.now()+120000).toISOString()});
  const fingerprint=f.store.all('socialDmRegistrations')[0].fingerprint;f.advance();await f.outbox.tick();
  assert.equal(f.store.get('socialPublishJobs',job.id).approvalHash,job.approvalHash);
  assert.equal(f.store.all('socialDmRegistrations')[0].fingerprint,fingerprint);
  assert.equal(f.outbox.status(f.user).items[0].state,'material_expired');
  assert.deepEqual(f.counts(),{uploads:0,registrations:0,catchups:0});
});
test('malformed contract requires verification without pretending the approval changed',async t=>{
  const f=await fixture(t),{job}=await f.publish(),current=f.store.get('socialPublishJobs',job.id);
  current.snapshot.variant.dm.resource=null;f.store.put('socialPublishJobs',job.id,current);
  await f.outbox.tick();assert.equal(f.outbox.status(f.user).items[0].state,'verification_required');
  assert.deepEqual(f.counts(),{uploads:0,registrations:0,catchups:0});
});
test('uncertain upload is never repeated; only exact remote proof resumes catch-up',async t=>{
  const f=await fixture(t);let attempts=0;
  f.overrides.upload=async()=>{attempts++;return {ok:false,error:'request_timeout'};};
  await f.publish();await f.outbox.tick();assert.equal(f.outbox.status(f.user).items[0].state,'needs_reconciliation');
  f.advance();await f.outbox.tick();assert.equal(attempts,1);assert.equal(f.counts().registrations,0);
  f.setRemote(f.good());f.advance();await f.outbox.tick();assert.equal(f.outbox.status(f.user).items[0].state,'registered');assert.equal(attempts,1);
});
test('restarting with an uploading intent only inspects and does not create another manifest',async t=>{
  const f=await fixture(t);await f.publish();
  f.overrides.upload=async()=>{throw Error('private provider text');};
  await f.outbox.tick();const row=f.store.all('socialDmRegistrations')[0];assert.equal(row.journal.stage,'uploading');
  f.store.put('socialDmRegistrations',row.id,{...row,state:'running',nextAttemptAt:null});
  let writes=0;f.overrides.upload=async()=>{writes++;return {ok:true};};
  await f.outbox.tick();assert.equal(writes,0);assert.equal(f.store.all('socialDmRegistrations')[0].state,'needs_reconciliation');
  assert.ok(!JSON.stringify(f.store.all('socialDmRegistrations')).includes('private provider text'));
});
test('changed receipt or account connection stops before upload even when changed during awaited inspection',async t=>{
  const f=await fixture(t),{job}=await f.publish();let writes=0;
  f.overrides.inspectPost=async()=>{const saved=f.store.get('socialPublishJobs',job.id);saved.snapshot.variant.dm.message='변경됨';f.store.put('socialPublishJobs',job.id,saved);
    return {account_id:DM.account_id,media_id:'900001',permalink:job.publicationUrl};};
  f.overrides.upload=async()=>{writes++;return {ok:true};};
  await f.outbox.tick();assert.equal(writes,0);assert.equal(f.outbox.status(f.user).items[0].state,'approval_changed');
});
test('pending catch-up persists its cursor and automatically continues on the next tick',async t=>{
  const f=await fixture(t);const inputs=[];
  f.overrides.catchUp=async input=>{inputs.push(input);return {ok:true,verified:true,has_more:inputs.length===1,queued:0,scanned:10,...(inputs.length===1?{cursor:'sealed-fixture-cursor'}:{})};};
  await f.publish();await f.outbox.tick();assert.equal(f.outbox.status(f.user).items[0].state,'pending_catchup');
  f.advance();await f.outbox.tick();assert.equal(f.outbox.status(f.user).items[0].state,'registered');assert.equal(inputs[1].cursor,'sealed-fixture-cursor');
  assert.equal(f.counts().uploads,1);
});
test('missing server credential leaves a visible connection step and resumes the same outbox after configuration',async t=>{
  const f=await fixture(t);f.setConfigured(false);await f.publish();await f.outbox.tick();
  assert.equal(f.outbox.status(f.user).configured,false);assert.equal(f.outbox.status(f.user).items[0].state,'connection_required');assert.equal(f.counts().uploads,0);
  f.setConfigured(true);f.advance();await f.outbox.tick();assert.equal(f.outbox.status(f.user).items[0].state,'registered');
});
test('HTTP adapter uses only pinned Talk endpoints, existing server credential, and no SQL/PAT endpoint',async t=>{
  const f=await fixture(t);await f.publish();await f.outbox.tick();const calls=[],secret='synthetic_server_secret_'.repeat(3);
  const adapter=createTalkPublicationAdapters({configuration:{projectRef:'b'.repeat(20),serviceRoleKey:secret},driveRegistry:join(f.directory,'unused.json'),
    mediaId:'900001',handoff:f.handoff(),fetchImpl:async(url,options)=>{
      calls.push({url,body:JSON.parse(options.body)});assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+secret);
      assert.equal(new URL(url).origin,'https://'+'b'.repeat(20)+'.supabase.co');
      return Response.json({ok:true,post:{account_id:DM.account_id,media_id:'900001',permalink:f.handoff().post_url},campaign:f.good()});
    }});
  await adapter.inspectPost();await adapter.campaign();await adapter.registerFolder({folder_id:DM.resource.folder_id});await adapter.catchUp({cursor:'sealed'});
  assert.deepEqual(calls.map(call=>new URL(call.url).searchParams.get('task')),['publication-inspect','publication-inspect','drive-register','publication-check']);
  assert.equal(calls[0].body.media_id,'900001');assert.equal(calls[0].body.campaign_id,f.handoff().campaign.campaign_id);
});
test('permission revoked while Drive preflight waits prevents the actual manifest POST',async t=>{
  const f=await fixture(t);await f.publish();await f.outbox.tick();
  const registry=join(f.directory,'drive-registry.json'),owner='unmet23@gmail.com';
  await writeFile(registry,JSON.stringify({connections:[{email:owner,credentials:{client_id:'fixture',client_secret:'synthetic',refresh_token:'synthetic'}}]}));
  let allow=true,release,entered;const waiting=new Promise(resolve=>{entered=resolve;});const gate=new Promise(resolve=>{release=resolve;});
  const writes=[],folders={
    fixture_library_root:{id:'fixture_library_root',name:'자료',parents:[]},
    fixture_release_folder:{id:'fixture_release_folder',name:'02_배포본',parents:['fixture_library_root']},
    fixture_campaign_folder:{id:'fixture_campaign_folder',name:'자료 원본',parents:['fixture_release_folder']}};
  const adapter=createTalkPublicationAdapters({configuration:{projectRef:'b'.repeat(20),serviceRoleKey:'synthetic_service_key_'.repeat(3)},
    driveRegistry:registry,mediaId:'900001',handoff:f.handoff(),authorize:()=>{if(!allow)throw Error('publication_permission_changed');},
    fetchImpl:async(url,options)=>{
      const u=new URL(url);
      if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'fixture',scope:'https://www.googleapis.com/auth/drive.file'});
      if(u.pathname.endsWith('/about'))return Response.json({user:{emailAddress:owner}});
      if(u.pathname==='/drive/v3/files'){entered();await gate;return Response.json({files:[]});}
      if(options.method==='POST'){writes.push(url);throw Error('must not create');}
      if(u.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:owner}]});
      const row=folders[u.pathname.split('/')[4]];
      assert.ok(row);return Response.json({...row,mimeType:'application/vnd.google-apps.folder',ownedByMe:true,owners:[{emailAddress:owner}],trashed:false});
    }});
  const upload=adapter.upload({input:runtime.inputFor(f.handoff()),folderId:DM.resource.folder_id,approve:true});
  await waiting;allow=false;release();const result=await upload;
  assert.equal(result.ok,false);assert.equal(writes.length,0);
});
test('shutdown while ownership inspection waits cannot start the next write',async t=>{
  const f=await fixture(t),{job}=await f.publish();let release,entered;
  const gate=new Promise(resolve=>{release=resolve;}),waiting=new Promise(resolve=>{entered=resolve;});
  f.overrides.inspectPost=async()=>{entered();await gate;return {account_id:DM.account_id,media_id:'900001',permalink:job.publicationUrl};};
  const tick=f.outbox.tick();await waiting;const closing=f.outbox.close();release();await Promise.all([tick,closing]);
  assert.equal(f.counts().uploads,0);assert.equal(f.counts().registrations,0);assert.equal(f.counts().catchups,0);
});
test('revoked approver permission is distinguished from an unknown write and restored permission resumes safely',async t=>{
  const f=await fixture(t);await f.publish();f.store.put('users',f.user.id,{...f.user,active:false});
  await f.outbox.tick();assert.equal(f.store.all('socialDmRegistrations')[0].state,'permission_required');assert.equal(f.counts().uploads,0);
  f.store.put('users',f.user.id,{...f.user,active:true});f.advance();await f.outbox.tick();
  assert.equal(f.outbox.status(f.user).items[0].state,'registered');
});
