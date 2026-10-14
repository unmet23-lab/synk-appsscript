import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from './store.mjs';
import {createMessenger} from '../../../../../tools/company-messenger/server.mjs';
import {backupWorkspace} from './workspace-backup.mjs';

test('workspace backup restores social upload bytes, durable jobs, rules and encrypted provider credentials',async()=>{
  const root=await mkdtemp(join(tmpdir(),'synk-social-backup-')),companyDir=join(root,'company'),messengerDir=join(root,'messenger');let store,messenger,restored;
  try{
    store=new Store(companyDir);messenger=createMessenger({dataDir:messengerDir,port:0});
    const media={id:'51234567-1234-4234-8234-123456789abc',diskName:'51234567-1234-4234-8234-123456789abc.png'},bytes=Buffer.from('synthetic social-only media');
    store.put('socialMedia',media.id,media);await mkdir(join(companyDir,'studio-media'));await writeFile(join(companyDir,'studio-media',media.diskName),bytes);
    const job={id:'synthetic-job',status:'scheduled',scheduledAt:'2026-10-14T00:00:00Z',idempotencyKey:'stable-key',attempts:0};store.put('socialPublishJobs',job.id,job);store.put('socialDistributionRules','rule',{id:'rule',enabled:true});store.setSecret('social:postiz',{apiKey:'synthetic-private-key'});
    const extensionKinds=['socialTemplates','socialQueuePolicies','socialWorkflowPlans','socialReviewApprovals','socialReviewLinks','socialReviewTokens','socialReviewRequirements','socialTrackingSettings','socialTrackingLinks','socialTrackingClicks','socialTrackingEvents','socialCapacityPlans','socialProviderHealth','socialNativeHealth','socialReplyPreviews','socialReplyAttempts','socialReplyDedupe','socialReplyRequests','socialFollowups'];
    for(const kind of extensionKinds)store.put(kind,'fixture',{id:'fixture',revision:2,fixture:kind});
    store.put('socialRecoveryDrafts','recovery',{id:'recovery',payload:store.encrypt({body:'synthetic private recovery'}),revision:3});store.setSecret('social-tracking:verification',{key:'synthetic-signing-key'});
    const target=await backupWorkspace({destination:join(root,'backups'),companyDataDir:companyDir,messengerDataDir:messengerDir});
    assert.deepEqual(await readFile(join(target,'company','studio-media',media.diskName)),bytes);restored=new Store(join(target,'company'));assert.deepEqual(restored.get('socialPublishJobs',job.id),job);assert.equal(restored.get('socialDistributionRules','rule').enabled,true);assert.equal(restored.secret('social:postiz').apiKey,'synthetic-private-key');
    for(const kind of extensionKinds)assert.deepEqual(restored.get(kind,'fixture'),store.get(kind,'fixture'));
    assert.equal(restored.decrypt(restored.get('socialRecoveryDrafts','recovery').payload).body,'synthetic private recovery');assert.equal(restored.secret('social-tracking:verification').key,'synthetic-signing-key');
    const manifest=JSON.parse(await readFile(join(target,'integration-manifest.json'),'utf8'));assert.equal(manifest.mediaCount,1);
  }finally{restored?.close();store?.close();await messenger?.close();assert.equal(dirname(resolve(root)),resolve(tmpdir()));await rm(root,{recursive:true,force:true});}
});
