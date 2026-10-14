import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialWorkflowsService} from './social-workflows.mjs';

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-social-workflows-')),store=new Store(directory),users={};
  for(const [name,role,teamId] of [['admin','admin',null],['manager','manager','a'],['writer','member','a'],['other','manager','b'],['viewer','viewer','a']])users[name]=store.createUser({email:name+'@workflow.test',name,role,teamId});
  for(const id of ['a','b'])store.put('teams',id,{id,active:true});
  for(const [id,platform] of [['ig','instagram'],['yt','youtube']])store.put('channels',id,{id,platform,active:true,teamId:'a',ownerIds:[users.writer.id],connectionVersion:1});
  let time='2026-10-13T00:00:00.000Z';const calls=[],clock=()=>time;
  const provider={capability:()=>({mode:'automatic',canPublish:true,formats:['text','video','reel'],maxTextLength:5000,maxMediaCount:10}),publish:async input=>{calls.push(input);return {status:'published',url:'https://www.instagram.com/p/ABCDE/',publishedAt:time};},status:async()=>({status:'unknown'}),...options.provider};
  const publishing=createSocialPublishingService({store,clock,provider,onApproved:({post})=>store.put('testApprovalSnapshots',post.id,{id:post.id,version:post.contentVersion}),validateSource:options.validatePostInput,validateReview:options.validateReview});
  const workflows=createSocialWorkflowsService({store,publishing,clock,preparePost:options.preparePost,validatePostInput:options.validatePostInput});
  t.after(async()=>{await publishing.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const create=(overrides={})=>publishing.savePost(users.writer,{title:'확정 원고',body:'본문',category:'news',media:[],variants:[{channelId:'ig',format:'text',text:'본문',options:{}}],...overrides}).post;
  const approve=post=>publishing.action(users.manager,post.id,{action:'approve',revision:post.revision}).post;
  const schedule=(post,input={})=>publishing.action(users.manager,post.id,{action:'schedule',revision:post.revision,scheduledAt:time,timezone:'Asia/Seoul',...input}).jobs;
  return {directory,store,users,publishing,workflows,create,approve,schedule,calls,clock,setTime:value=>{time=value;}};
}

test('templates persist reusable content only and explicit apply creates one draft across duplicate requests',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),template=(await f.workflows.saveTemplate(f.users.writer,{name:'수업 공지',postId:post.id})).template;
  assert.equal(template.post.approval,undefined);assert.equal(template.post.status,undefined);assert.equal(f.store.all('socialPosts').length,1);
  assert.equal(f.workflows.workspace(f.users.other).templates.length,0);
  const preview=await f.workflows.templatePreview(f.users.writer,{templateId:template.id});assert.equal(preview.validCount,1);assert.equal(f.store.all('socialPosts').length,1);
  await assert.rejects(f.workflows.apply(f.users.writer,{previewId:preview.previewId}),{status:400});
  const one=await f.workflows.apply(f.users.writer,{previewId:preview.previewId,confirmed:true}),again=await f.workflows.apply(f.users.writer,{previewId:preview.previewId,confirmed:true});
  assert.equal(one.posts[0].status,'draft');assert.equal(one.posts[0].approval,null);assert.equal(again.existing,true);assert.equal(again.posts[0].id,one.posts[0].id);assert.equal(f.store.all('socialPosts').length,2);assert.equal(f.calls.length,0);
  assert.equal(f.store.get('socialWorkflowPlans',preview.previewId).commands,undefined);
});

test('applying a template to an approved post invalidates approval and pending reservations',async t=>{
  const f=await fixture(t),source=f.create({body:'재사용 원고',variants:[{channelId:'ig',format:'text',text:'재사용 원고'}]}),template=(await f.workflows.saveTemplate(f.users.writer,{name:'재사용',postId:source.id})).template;
  const target=f.approve(f.create()),[job]=f.schedule(target,{scheduledAt:'2026-10-14T00:00:00Z'});
  const preview=await f.workflows.templatePreview(f.users.manager,{templateId:template.id,postId:target.id});
  assert.equal(f.store.get('socialPublishJobs',job.id).status,'scheduled');
  const applied=await f.workflows.apply(f.users.manager,{previewId:preview.previewId,confirmed:true});
  assert.equal(applied.posts[0].body,'재사용 원고');assert.equal(applied.posts[0].status,'draft');assert.equal(applied.posts[0].approval,null);assert.equal(f.store.get('socialPublishJobs',job.id).status,'cancelled');
});

test('template revisions, source access and session changes are rechecked after preparation',async t=>{
  let allowed=true,hold=false,release,started;
  const entered=new Promise(resolve=>{started=resolve;});
  const f=await fixture(t,{validatePostInput:(_user,post)=>{if(post.source?.productionId&&!allowed)throw Object.assign(new Error('원본 권한이 회수됐습니다.'),{status:403});return post;},preparePost:async(_user,post)=>{if(hold){started();await new Promise(resolve=>{release=resolve;});}return post;}});
  const source=f.create({source:{productionId:'private'}}),template=(await f.workflows.saveTemplate(f.users.writer,{name:'원본',postId:source.id})).template;
  const preview=await f.workflows.templatePreview(f.users.writer,{templateId:template.id});await f.workflows.saveTemplate(f.users.writer,{name:'변경',revision:template.revision},template.id);
  await assert.rejects(f.workflows.apply(f.users.writer,{previewId:preview.previewId,confirmed:true}),{status:409});
  allowed=false;assert.equal(f.workflows.workspace(f.users.writer).templates.length,0);await assert.rejects(f.workflows.templatePreview(f.users.writer,{templateId:template.id}),{status:403});allowed=true;
  hold=true;let actor=f.users.writer;const pending=f.workflows.templatePreview(f.users.writer,{templateId:template.id},{authorize:()=>actor});await entered;actor=f.users.other;release();await assert.rejects(pending,{status:401});
});

test('bulk edit reports inaccessible rows and only explicit valid-row apply commits common-copy synchronization',async t=>{
  const f=await fixture(t),a=f.create(),b=f.create({title:'두 번째'}),preview=await f.workflows.bulkPreview(f.users.writer,{action:'edit',postIds:[a.id,'missing',b.id],patch:{body:'새 공통 본문',category:'tips'},syncCommonText:true});
  assert.equal(preview.validCount,2);assert.equal(preview.errorCount,1);assert.equal(f.store.get('socialPosts',a.id).body,'본문');
  await assert.rejects(f.workflows.apply(f.users.writer,{previewId:preview.previewId,confirmed:true}),{status:409});
  const result=await f.workflows.apply(f.users.writer,{previewId:preview.previewId,confirmed:true,skipInvalid:true});
  assert.equal(result.posts.length,2);assert.equal(result.posts[0].variants[0].text,'새 공통 본문');assert.equal(result.posts[0].status,'draft');assert.equal(f.calls.length,0);
});

test('bulk approval previews use real rules and roll back approval snapshots until confirmation',async t=>{
  const f=await fixture(t),posts=[f.create(),f.create({title:'둘째'})];
  const writerPreview=await f.workflows.bulkPreview(f.users.writer,{action:'approve',postIds:posts.map(post=>post.id)});assert.equal(writerPreview.validCount,0);
  const preview=await f.workflows.bulkPreview(f.users.manager,{action:'approve',postIds:posts.map(post=>post.id)});
  assert.equal(preview.validCount,2);assert.equal(f.store.all('testApprovalSnapshots').length,0);assert.ok(posts.every(post=>f.store.get('socialPosts',post.id).status==='draft'));
  const result=await f.workflows.apply(f.users.manager,{previewId:preview.previewId,confirmed:true});assert.ok(result.posts.every(post=>post.status==='approved'));assert.equal(f.store.all('testApprovalSnapshots').length,2);
});

test('one stale bulk row prevents any writes and async media changes require a new preview',async t=>{
  let changed=false;const f=await fixture(t,{preparePost:async(_user,post)=>changed?{...post,title:'파일 준비 중 변경'}:post}),posts=[f.create(),f.create({title:'둘째'})];
  const preview=await f.workflows.bulkPreview(f.users.manager,{action:'edit',postIds:posts.map(post=>post.id),patch:{category:'tips'}});
  f.publishing.comment(f.users.writer,posts[1].id,{body:'새 검토'});await assert.rejects(f.workflows.apply(f.users.manager,{previewId:preview.previewId,confirmed:true}),{status:409});assert.equal(f.store.get('socialPosts',posts[0].id).category,'news');
  const fresh=await f.workflows.bulkPreview(f.users.manager,{action:'edit',postIds:[posts[0].id],patch:{category:'tips'}});changed=true;await assert.rejects(f.workflows.apply(f.users.manager,{previewId:fresh.previewId,confirmed:true}),{status:409});assert.equal(f.store.get('socialPosts',posts[0].id).category,'news');
});

test('bulk schedules only approved rows and protects preview times from newly occupied slots',async t=>{
  const f=await fixture(t),approved=f.approve(f.create()),draft=f.create({title:'미승인'});
  const preview=await f.workflows.bulkPreview(f.users.manager,{action:'schedule',postIds:[approved.id,draft.id],schedule:{scheduledAt:'2026-10-14T00:00:00Z',timezone:'Asia/Seoul'}});
  assert.equal(preview.validCount,1);assert.equal(preview.errorCount,1);assert.equal(f.store.all('socialPublishJobs').length,0);
  const result=await f.workflows.apply(f.users.manager,{previewId:preview.previewId,confirmed:true,skipInvalid:true});assert.equal(result.jobs.length,1);assert.equal(f.calls.length,0);
  f.publishing.saveSlots(f.users.manager,{channelId:'ig',timezone:'Asia/Seoul',slots:[{weekday:2,time:'09:05'},{weekday:2,time:'09:10'}]});
  const queued=f.approve(f.create({title:'큐 원고'})),queue=await f.workflows.bulkPreview(f.users.manager,{action:'schedule',postIds:[queued.id],schedule:{mode:'queue',timezone:'Asia/Seoul'}});
  f.schedule(f.approve(f.create({title:'먼저 선점'})),{mode:'queue'});await assert.rejects(f.workflows.apply(f.users.manager,{previewId:queue.previewId,confirmed:true}),{status:409});assert.equal(f.publishing.get(f.users.manager,queued.id).jobs.length,0);
});

test('weighted queue preview respects category slots, existing reservations and approved channel selection',async t=>{
  const f=await fixture(t),posts=[];
  f.workflows.saveQueuePolicy(f.users.manager,{channelId:'ig',minimumIntervalMinutes:0,categoryWeights:[{category:'news',weight:2},{category:'tips',weight:1}]});
  f.publishing.saveSlots(f.users.manager,{channelId:'ig',category:'news',timezone:'Asia/Seoul',slots:[{weekday:2,time:'09:05'},{weekday:2,time:'09:15'},{weekday:2,time:'09:25'}]});
  f.publishing.saveSlots(f.users.manager,{channelId:'ig',category:'tips',timezone:'Asia/Seoul',slots:[{weekday:2,time:'09:10'},{weekday:2,time:'09:20'}]});
  for(const category of ['news','news','tips'])posts.push(f.approve(f.create({category,variants:[{channelId:'ig',format:'text',text:category},{channelId:'yt',format:'video',text:category}]})));
  const preview=await f.workflows.queuePreview(f.users.manager,{channelId:'ig',postIds:posts.map(post=>post.id),from:f.clock(),timezone:'Asia/Seoul'});
  assert.deepEqual(preview.rows.map(row=>row.after.category),['news','tips','news']);assert.deepEqual(preview.rows.map(row=>row.jobs[0].scheduledAt),['2026-10-13T00:05:00.000Z','2026-10-13T00:10:00.000Z','2026-10-13T00:15:00.000Z']);assert.equal(f.store.all('socialPublishJobs').length,0);
  const result=await f.workflows.apply(f.users.manager,{previewId:preview.previewId,confirmed:true});assert.equal(result.jobs.length,3);assert.ok(result.jobs.every(job=>job.channelId==='ig'));assert.equal(f.calls.length,0);
});

test('changed queue policies, expired plans and revoked permissions cannot be applied or replayed',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),policy=f.workflows.saveQueuePolicy(f.users.manager,{channelId:'ig',minimumIntervalMinutes:0,categoryWeights:[{category:'news',weight:1}]}).policy;
  f.publishing.saveSlots(f.users.manager,{channelId:'ig',timezone:'Asia/Seoul',slots:[{weekday:2,time:'09:05'}]});const preview=await f.workflows.queuePreview(f.users.manager,{channelId:'ig',postIds:[post.id],from:f.clock()});
  f.workflows.saveQueuePolicy(f.users.manager,{...policy,minimumIntervalMinutes:60});await assert.rejects(f.workflows.apply(f.users.manager,{previewId:preview.previewId,confirmed:true}),{status:409});
  const edit=await f.workflows.bulkPreview(f.users.writer,{action:'edit',postIds:[post.id],patch:{title:'새 제목'}});f.setTime('2026-10-13T00:16:00Z');await assert.rejects(f.workflows.apply(f.users.writer,{previewId:edit.previewId,confirmed:true}),{status:409});
  f.setTime('2026-10-13T00:00:00Z');const another=await f.workflows.bulkPreview(f.users.writer,{action:'edit',postIds:[post.id],patch:{title:'새 제목'}});f.store.put('users',f.users.writer.id,{...f.users.writer,role:'viewer'});await assert.rejects(f.workflows.apply(f.users.writer,{previewId:another.previewId,confirmed:true}),{status:403});
});

test('account-wide repeated content spacing covers separate posts and unknown results indefinitely',async t=>{
  const f=await fixture(t);f.workflows.saveQueuePolicy(f.users.manager,{channelId:'ig',minimumIntervalMinutes:60,categoryWeights:[]});
  const first=f.approve(f.create()),[job]=f.schedule(first,{scheduledAt:'2026-10-13T01:00:00Z'}),copy=f.approve(f.create({title:'복제본'}));
  assert.throws(()=>f.schedule(copy,{scheduledAt:'2026-10-13T01:30:00Z'}),error=>error.code==='REPOST_INTERVAL');
  f.store.put('socialPublishJobs',job.id,{...f.store.get('socialPublishJobs',job.id),status:'unknown',attempts:1});
  assert.throws(()=>f.schedule(copy,{scheduledAt:'2027-10-13T01:30:00Z'}),error=>error.code==='REPOST_RESULT_UNKNOWN');
  const differentAccount=f.approve(f.create({variants:[{channelId:'yt',format:'video',text:'본문'}]}));assert.equal(f.schedule(differentAccount,{scheduledAt:'2026-10-13T01:00:00Z'}).length,1);
});

test('minimum spacing is enforced at execution after reservations predate the policy',async t=>{
  const f=await fixture(t),first=f.approve(f.create()),second=f.approve(f.create({title:'별도 초안'}));f.schedule(first);const [job]=f.schedule(second);
  f.workflows.saveQueuePolicy(f.users.manager,{channelId:'ig',minimumIntervalMinutes:60,categoryWeights:[]});await f.publishing.tick();
  assert.equal(f.calls.length,1);const jobs=f.store.all('socialPublishJobs');assert.equal(jobs.filter(row=>row.status==='published').length,1);assert.equal(jobs.find(row=>row.status==='failed').errorCode,'REPOST_INTERVAL');assert.equal(f.calls[0].variant.text,'본문');
});

test('rotation approves every copy and freezes the selected copy for each repeat and manual handoff',async t=>{
  const f=await fixture(t),post=f.approve(f.create({recurrence:{intervalDays:1,maxOccurrences:3},variants:[{channelId:'ig',format:'text',title:'기본 제목',text:'기본 문구',options:{hashtags:'#기본'},copyVariants:[{id:'b',title:'변형 제목',text:'변형 문구',hashtags:'#변형'}]}]}));
  f.schedule(post);await f.publishing.tick();assert.equal(f.calls[0].variant.text,'기본 문구');
  f.setTime('2026-10-14T00:00:00Z');await f.publishing.tick();assert.equal(f.calls[1].variant.text,'변형 문구');assert.equal(f.calls[1].variant.options.hashtags,'#변형');assert.equal(f.calls[1].job.selectedCopyId,'b');
  f.setTime('2026-10-15T00:00:00Z');await f.publishing.tick();assert.equal(f.calls[2].variant.text,'기본 문구');
  const jobs=f.publishing.get(f.users.manager,post.id).jobs;assert.equal(jobs[1].handoff.text,'변형 문구');assert.equal(jobs[1].handoff.hashtags,'#변형');assert.equal(jobs[1].handoff.title,'변형 제목');
  const changed=f.publishing.savePost(f.users.writer,{revision:post.revision,variants:[{...post.variants[0],copyVariants:[{id:'b',text:'변경 문구'}]}]},post.id).post;assert.equal(changed.approval,null);assert.equal(f.store.get('socialPublishJobs',jobs[1].id).snapshot.variant.text,'변형 문구');
});

test('an invalid unused rotated copy prevents approval and approved hook failures roll back',async t=>{
  const f=await fixture(t,{provider:{preflight:({variant})=>({errors:variant.text==='금지'? [{message:'변형을 수정해 주세요.'}]:[]})}}),post=f.create({variants:[{channelId:'ig',format:'text',text:'정상',copyVariants:[{text:'금지'}]}]});
  assert.equal(post.validation.valid,false);assert.throws(()=>f.approve(post),/변형/);assert.equal(f.store.get('socialPosts',post.id).approval,null);
  const extra=createSocialPublishingService({store:f.store,onApproved:()=>{throw new Error('snapshot failure');}}),clean=f.create();assert.throws(()=>extra.action(f.users.manager,clean.id,{action:'approve',revision:clean.revision}),/snapshot failure/);assert.equal(f.store.get('socialPosts',clean.id).approval,null);await extra.close();
});

test('required external review keeps scheduled work waiting and cannot be bypassed before the provider send',async t=>{
  let accepted=false;const gate=()=>{if(!accepted)throw Object.assign(new Error('현재 일정의 고객 검토가 필요합니다.'),{status:409,code:'SOCIAL_REVIEW_REQUIRED'});};
  const f=await fixture(t,{validateReview:gate}),post=f.approve(f.create()),[job]=f.schedule(post);
  assert.equal(job.reviewWaiting,true);await f.publishing.tick();assert.equal(f.calls.length,0);assert.equal(f.store.get('socialPublishJobs',job.id).status,'scheduled');
  accepted=true;await f.publishing.tick();assert.equal(f.calls.length,1);assert.equal(f.store.get('socialPublishJobs',job.id).status,'published');
  const next=f.approve(f.create({title:'검토 중 변경',body:'다른 원고'})),[claim]=f.schedule(next);
  f.store.put('socialPublishJobs',claim.id,{...f.store.get('socialPublishJobs',claim.id),status:'publishing'});accepted=false;
  assert.throws(()=>f.publishing.assertExecution({job:claim}),error=>error.code==='SOCIAL_REVIEW_REQUIRED'&&error.providerSafe===true);
});

test('schedule revisions increase when moving A to B and back, including bulk movement',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),[job]=f.schedule(post,{scheduledAt:'2026-10-14T00:00:00Z'});assert.equal(job.scheduleRevision,1);
  const b=await f.publishing.jobAction(f.users.manager,job.id,{action:'reschedule',scheduledAt:'2026-10-15T00:00:00Z'});assert.equal(b.job.scheduleRevision,2);
  const a=await f.publishing.jobAction(f.users.manager,job.id,{action:'reschedule',scheduledAt:'2026-10-14T00:00:00Z'});assert.equal(a.job.scheduleRevision,3);
  const preview=f.publishing.reschedulePreview(f.users.manager,{jobIds:[job.id],shiftMinutes:60,includeFixed:true});const moved=f.publishing.rescheduleApply(f.users.manager,preview);assert.equal(moved.jobs[0].scheduleRevision,4);
});

test('weighted ordering is retained even when category slots occur in the opposite order',async t=>{
  const f=await fixture(t);f.workflows.saveQueuePolicy(f.users.manager,{channelId:'ig',minimumIntervalMinutes:0,categoryWeights:[{category:'news',weight:3},{category:'tips',weight:1}]});
  f.publishing.saveSlots(f.users.manager,{channelId:'ig',category:'news',timezone:'Asia/Seoul',slots:[{weekday:2,time:'09:20'},{weekday:2,time:'09:40'}]});
  f.publishing.saveSlots(f.users.manager,{channelId:'ig',category:'tips',timezone:'Asia/Seoul',slots:[{weekday:2,time:'09:05'},{weekday:2,time:'09:30'}]});
  const a=f.approve(f.create()),b=f.approve(f.create({category:'tips'})),preview=await f.workflows.queuePreview(f.users.manager,{channelId:'ig',postIds:[a.id,b.id],from:f.clock()});
  assert.deepEqual(preview.rows.map(row=>row.jobs[0].scheduledAt),['2026-10-13T00:20:00.000Z','2026-10-13T00:30:00.000Z']);
});

test('permission revoked for an earlier row while another media preparation awaits prevents the whole apply',async t=>{
  let applying=false,revoked=false;
  const f=await fixture(t,{validatePostInput:(_user,post)=>{if(revoked&&post.source?.productionId==='first')throw Object.assign(new Error('첫 원본 권한 회수'),{status:403});return post;},preparePost:async(_user,post)=>{if(applying&&post.source?.productionId==='second'){await Promise.resolve();revoked=true;}return post;}});
  const first=f.create({source:{productionId:'first'}}),second=f.create({source:{productionId:'second'}});
  const preview=await f.workflows.bulkPreview(f.users.writer,{action:'edit',postIds:[first.id,second.id],patch:{category:'tips'}});applying=true;
  await assert.rejects(f.workflows.apply(f.users.writer,{previewId:preview.previewId,confirmed:true}),{status:403});
  assert.equal(f.store.get('socialPosts',first.id).category,'news');assert.equal(f.store.get('socialPosts',second.id).category,'news');
});

test('an apply that loses a race to the same apply reuses its jobs without rebuilding the publishing workspace',async t=>{
  let gateOn=false,release,entered;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r);
  const f=await fixture(t,{preparePost:async(_user,input)=>{if(gateOn){gateOn=false;entered();await gate;}return input;}});
  const post=f.approve(f.create({title:'경쟁'})),preview=await f.workflows.bulkPreview(f.users.manager,{action:'schedule',postIds:[post.id],schedule:{scheduledAt:'2026-10-20T00:00:00Z',timezone:'Asia/Seoul'}});
  gateOn=true;const slow=f.workflows.apply(f.users.manager,{previewId:preview.previewId,confirmed:true});await ready;
  const fast=await f.workflows.apply(f.users.manager,{previewId:preview.previewId,confirmed:true});assert.equal(fast.jobs.length,1);
  const original=f.publishing.workspace;let builds=0;f.publishing.workspace=(...args)=>{builds++;return original(...args);};
  try{release();const late=await slow;assert.equal(late.existing,true);assert.deepEqual(late.jobs.map(job=>job.id),fast.jobs.map(job=>job.id));}finally{f.publishing.workspace=original;}
  assert.equal(builds,0,'no full workspace build');
});
