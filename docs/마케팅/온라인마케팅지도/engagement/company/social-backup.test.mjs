import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {Writable} from 'node:stream';
import {Store} from './store.mjs';
import {createMessenger} from '../../../../../tools/company-messenger/server.mjs';
import {backupWorkspace} from './workspace-backup.mjs';
import {createSocialPublishMedia} from './social-publish-media.mjs';
import {createSocialDirectMeta} from './social-direct-meta.mjs';

test('workspace backup restores social upload bytes, durable jobs, rules and encrypted provider credentials',async()=>{
  const root=await mkdtemp(join(tmpdir(),'synk-social-backup-')),companyDir=join(root,'company'),messengerDir=join(root,'messenger');let store,messenger,restored;
  try{
    store=new Store(companyDir);messenger=createMessenger({dataDir:messengerDir,port:0});
    const media={id:'51234567-1234-4234-8234-123456789abc',diskName:'51234567-1234-4234-8234-123456789abc.png'},bytes=Buffer.from('synthetic social-only media');
    store.put('socialMedia',media.id,media);await mkdir(join(companyDir,'studio-media'));await writeFile(join(companyDir,'studio-media',media.diskName),bytes);
    const job={id:'synthetic-job',status:'scheduled',scheduledAt:'2026-10-14T00:00:00Z',idempotencyKey:'stable-key',attempts:0};store.put('socialPublishJobs',job.id,job);store.put('socialDistributionRules','rule',{id:'rule',enabled:true});store.setSecret('social:postiz',{apiKey:'synthetic-private-key'});
    const extensionKinds=['socialTemplates','socialQueuePolicies','socialWorkflowPlans','socialReviewApprovals','socialReviewLinks','socialReviewTokens','socialReviewRequirements','socialTrackingSettings','socialTrackingLinks','socialTrackingClicks','socialTrackingEvents','socialCapacityPlans','socialProviderHealth','socialNativeHealth','socialReplyPreviews','socialReplyAttempts','socialReplyDedupe','socialReplyRequests','socialFollowups','socialDirectConnections','socialDirectHealth','socialDirectPublishJobs','socialDirectPublishRequests','socialPublishMediaGrants'];
    for(const kind of extensionKinds)store.put(kind,'fixture',{id:'fixture',revision:2,fixture:kind});
    store.put('socialRecoveryDrafts','recovery',{id:'recovery',payload:store.encrypt({body:'synthetic private recovery'}),revision:3});store.setSecret('social-tracking:verification',{key:'synthetic-signing-key'});
    const target=await backupWorkspace({destination:join(root,'backups'),companyDataDir:companyDir,messengerDataDir:messengerDir});
    assert.deepEqual(await readFile(join(target,'company','studio-media',media.diskName)),bytes);restored=new Store(join(target,'company'));assert.deepEqual(restored.get('socialPublishJobs',job.id),job);assert.equal(restored.get('socialDistributionRules','rule').enabled,true);assert.equal(restored.secret('social:postiz').apiKey,'synthetic-private-key');
    for(const kind of extensionKinds)assert.deepEqual(restored.get(kind,'fixture'),store.get(kind,'fixture'));
    assert.equal(restored.decrypt(restored.get('socialRecoveryDrafts','recovery').payload).body,'synthetic private recovery');assert.equal(restored.secret('social-tracking:verification').key,'synthetic-signing-key');
    const manifest=JSON.parse(await readFile(join(target,'integration-manifest.json'),'utf8'));assert.equal(manifest.mediaCount,1);
  }finally{restored?.close();store?.close();await messenger?.close();assert.equal(dirname(resolve(root)),resolve(tmpdir()));await rm(root,{recursive:true,force:true});}
});

test('restored direct publishing preserves uncertain and completed receipts, encrypted Meta credentials and hashed media grants',async()=>{
  const root=await mkdtemp(join(tmpdir(),'synk-social-direct-backup-')),companyDir=join(root,'company'),messengerDir=join(root,'messenger');
  let store,messenger,restored,mediaService,restoredMedia;
  const hash=value=>createHash('sha256').update(value).digest('hex'),clock=()=> '2026-10-14T00:00:00.000Z';
  try{
    store=new Store(companyDir);messenger=createMessenger({dataDir:messengerDir,port:0});
    const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('approved direct publishing media')]);
    const media={id:'61234567-1234-4234-8234-123456789abc',diskName:'61234567-1234-4234-8234-123456789abc.png',mimeType:'image/png',byteSize:bytes.length,sha256:hash(bytes)};
    const ref={assetId:media.id,id:media.id,url:'/api/social/media/'+media.id,mimeType:media.mimeType,byteSize:media.byteSize,sha256:media.sha256};
    await mkdir(join(companyDir,'studio-media'));await writeFile(join(companyDir,'studio-media',media.diskName),bytes);store.put('socialMedia',media.id,media);
    const channel={id:'direct-ig',platform:'instagram',active:true,externalId:'123',connectionVersion:3};store.put('channels',channel.id,channel);
    const variant={channelId:channel.id,format:'image',media:[ref],text:'approved',options:{}},snapshot={id:'direct-post',ownerId:'owner',contentVersion:1,variants:[variant]};
    const post={...snapshot,approval:{hash:'a'.repeat(64),contentVersion:1,byId:'admin',at:clock(),targets:[{channelId:channel.id,connectionVersion:3}]}};store.put('socialPosts',post.id,post);
    const job={id:'media-job',postId:post.id,channelId:channel.id,idempotencyKey:'media-job-key',contentVersion:1,approvalHash:post.approval.hash,publisherId:'admin',approverId:'admin',attempts:1,scheduleRevision:1,status:'processing',snapshot:{post:snapshot,variant,channel:{id:channel.id}}};store.put('socialPublishJobs',job.id,job);
    const resolveMedia=directory=>async()=>({bytes:await readFile(join(directory,'studio-media',media.diskName)),mimeType:media.mimeType});
    mediaService=createSocialPublishMedia({store,clock,origin:'https://workspace.synk.im',resolveMedia:resolveMedia(companyDir),authorizePublish:()=>{}});
    const grant=await mediaService.issue(ref,{channel,post:snapshot,variant,job}),bearer=new URL(grant.url).pathname.split('/').at(-1);
    const credentials={accessToken:'synthetic-meta-token-must-remain-encrypted',authType:'instagram-login',accountId:'123',appScopedId:'456',metaIdentityVersion:1,scope:'instagram_business_basic instagram_business_content_publish',permissionsVerifiedAt:clock()};store.setSecret('channel:'+channel.id,credentials);
    const connection={id:channel.id,channelId:channel.id,version:'direct-v1',connectionVersion:3,enabled:true,accountId:'123',authType:'instagram-login'};store.put('socialDirectConnections',channel.id,connection);
    store.put('socialDirectHealth',channel.id,{id:channel.id,version:'direct-v1',state:'connected',checkedAt:clock()});
    store.put('socialDirectPublishRequests',channel.id,{times:[Date.parse(clock())],retryAt:Date.parse(clock())+60000});
    const inputs=[];
    for(const status of ['submitting','published']){
      const savedJob={...job,id:'receipt-'+status,idempotencyKey:'receipt-'+status,status:status==='published'?'published':'unknown'};store.put('socialPublishJobs',savedJob.id,savedJob);
      const id=hash(JSON.stringify(['meta-direct',channel.id,savedJob.idempotencyKey]));
      store.put('socialDirectPublishJobs',id,{id,jobId:savedJob.id,channelId:channel.id,status,providerId:status==='published'?'789':null,claimToken:'durable-'+status,attemptNumber:1,definitive:false,retryable:false,createdAt:clock(),updatedAt:clock()});inputs.push({channel,job:savedJob});
    }
    const target=await backupWorkspace({destination:join(root,'backups'),companyDataDir:companyDir,messengerDataDir:messengerDir}),restoredDir=join(target,'company');restored=new Store(restoredDir);
    for(const kind of ['socialDirectConnections','socialDirectHealth','socialDirectPublishJobs','socialDirectPublishRequests','socialPublishMediaGrants'])assert.deepEqual(restored.all(kind),store.all(kind),kind);
    assert.deepEqual(restored.secret('channel:'+channel.id),credentials);assert.deepEqual(restored.get('socialPublishJobs',job.id),job);
    const sqlite=await readFile(join(restoredDir,'company.sqlite'));assert.equal(sqlite.includes(Buffer.from(credentials.accessToken)),false);assert.equal(sqlite.includes(Buffer.from(bearer)),false);assert.equal(sqlite.includes(Buffer.from(grant.url)),false);
    let externalCalls=0;const provider=createSocialDirectMeta({store:restored,clock,fetchImpl:async()=>{externalCalls++;throw Error('network must not be used');},authorizePublish:()=>{throw Error('existing receipts must not send');}});
    for(const input of inputs){const expected=input.job.status==='published'?'published':'uncertain';assert.equal((await provider.publish(input)).status,expected);assert.equal((await provider.status(input)).status,expected);}
    assert.equal(externalCalls,0,'restoring a backup never permits an already submitted job to be sent again');
    restoredMedia=createSocialPublishMedia({store:restored,clock,origin:'https://workspace.synk.im',resolveMedia:resolveMedia(restoredDir),authorizePublish:()=>{}});
    const chunks=[],response=new Writable({write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});response.writeHead=(status,headers)=>{response.status=status;response.headers=headers;response.headersSent=true;};
    assert.equal(await restoredMedia.handle({method:'GET',headers:{}},response,{url:new URL(grant.url)}),true);assert.equal(response.status,200);assert.deepEqual(Buffer.concat(chunks),bytes);
  }finally{
    await mediaService?.stop();await restoredMedia?.stop();restored?.close();store?.close();await messenger?.close();
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));await rm(root,{recursive:true,force:true});
  }
});
