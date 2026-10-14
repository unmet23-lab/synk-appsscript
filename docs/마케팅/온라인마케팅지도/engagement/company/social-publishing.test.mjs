import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';

async function fixture(t,providerOptions={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-social-publish-')),store=new Store(directory),users={};
  for(const [id,role,teamId] of [['admin','admin',null],['manager','manager','a'],['writer','member','a'],['viewer','viewer','a'],['other','manager','b']])users[id]=store.createUser({email:id+'@social.test',name:id,role,teamId});
  for(const id of ['a','b'])store.put('teams',id,{id,active:true});
  store.put('channels','yt',{id:'yt',displayName:'합성 유튜브',platform:'youtube',active:true,teamId:'a',ownerIds:[users.writer.id],connectionVersion:1});
  store.put('channels','ig',{id:'ig',platform:'instagram',active:true,teamId:'a',ownerIds:[users.writer.id],connectionVersion:1});
  let time='2026-10-13T00:00:00.000Z',sends=[],outcomes=[];
  const provider={capability:()=>({mode:'automatic',canPublish:true,formats:['post','video','reel'],maxTextLength:5000,maxMediaCount:10}),publish:async args=>{sends.push(args);return {status:'published',url:args.channel.id==='yt'?'https://www.youtube.com/watch?v=abcdefghijk':'https://www.instagram.com/p/ABCDE/',publishedAt:time};},status:async()=>({status:'unknown',message:'아직 확인 중'}),...providerOptions};
  const service=createSocialPublishingService({store,clock:()=>time,provider,onPublished:async value=>{outcomes.push(value);return {performanceEntryId:'performance-'+value.job.id};}});
  t.after(async()=>{await service.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const input=(extra={})=>({title:'합성 듣기 콘텐츠',body:'확정된 교육 원고',purpose:'짧은 지시 듣기',language:'ko',brandId:'synk',category:'기초',campaignId:'launch',topikArea:'TOPIK I 듣기',variants:[{channelId:'yt',text:'첫 게시문',format:'video'}],...extra});
  const create=(extra={})=>service.savePost(users.writer,input(extra)).post;
  const approve=post=>service.action(users.manager,post.id,{revision:post.revision,action:'approve'}).post;
  const schedule=(post,extra={})=>service.action(users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:time,timezone:'Asia/Seoul',...extra}).jobs;
  return {directory,store,users,service,provider,input,create,approve,schedule,sends,outcomes,setTime:value=>time=value,now:()=>time};
}

test('new drafts canonicalize omitted performance formats and preserve explicit package detail on edits',async t=>{
  const f=await fixture(t);
  for(const [channelId,format,expected] of [['yt','video','youtube-video'],['yt','shorts','youtube-shorts'],['ig','reel','instagram-reels'],['ig','image','image']]){
    const post=f.create({variants:[{channelId,format,text:'확정 문구'}]});
    assert.equal(post.variants[0].publicationFormat,expected);
  }
  const specific=f.create({source:{packageId:'package'},variants:[{channelId:'yt',format:'video',publicationFormat:'youtube-shorts',text:'패키지 상세 분류'}]});
  const edited=f.service.savePost(f.users.writer,{revision:specific.revision,body:'본문만 수정'},specific.id).post;
  assert.equal(edited.variants[0].publicationFormat,'youtube-shorts');
});

test('bulk imports and source rules use canonical performance formats when inputs omit them',async t=>{
  const f=await fixture(t),rows=[f.input(),f.input({variants:[{channelId:'ig',format:'reel',text:'릴스 원문'}]})];
  const imported=f.service.bulkImport(f.users.writer,{rows,importKey:'canonical-formats'});
  assert.deepEqual(imported.posts.map(post=>post.variants[0].publicationFormat),['youtube-video','instagram-reels']);
  const rule=f.service.saveRule(f.users.manager,{title:'확정본',sourceId:'studio',scope:'all',channelIds:['yt','ig'],enabled:true,delayMinutes:0}).rule;
  const result=f.service.ingestSource(f.users.manager,{confirmed:true,sourceId:'studio',eventId:'canonical-source',ruleId:rule.id,post:{title:'확정본',body:'본문',variants:[{channelId:'yt',format:'shorts'},{channelId:'ig',format:'reel'}]}});
  const post=f.service.get(f.users.manager,result.results[0].postId).post;
  assert.deepEqual(post.variants.map(variant=>variant.publicationFormat),['youtube-shorts','instagram-reels']);
  assert.equal(post.status,'draft');assert.equal(f.store.all('socialPublishJobs').length,0);
});

test('approval is required across API paths, immutable snapshots persist and repeated scheduling publishes once',async t=>{
  const f=await fixture(t),draft=f.create();assert.throws(()=>f.schedule(draft),{status:409});
  assert.throws(()=>f.service.action(f.users.writer,draft.id,{revision:1,action:'approve'}),{status:403});
  const approved=f.approve(draft),jobs=f.schedule(approved);assert.equal(f.schedule(approved)[0].id,jobs[0].id);
  const mirror=new Store(f.directory);try{assert.equal(mirror.get('socialPublishJobs',jobs[0].id).snapshot.variant.text,'첫 게시문');}finally{mirror.close();}
  await f.service.tick();await f.service.tick();assert.equal(f.sends.length,1);assert.equal(f.outcomes.length,1);const job=f.service.get(f.users.manager,draft.id).jobs[0];assert.equal(job.status,'published');assert.equal(job.publicVerifiedAt,null);assert.ok(job.performanceEntryId);assert.equal(job.snapshot,undefined);
});

test('post edits invalidate approval and cancel pending jobs while preserving prior published snapshots',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),[job]=f.schedule(post,{scheduledAt:'2026-10-14T00:00:00Z'});
  const changed=f.service.savePost(f.users.writer,{revision:post.revision,body:'새 근거',variants:[{channelId:'yt',text:'새 문구',format:'video'}]},post.id).post;
  assert.equal(changed.status,'draft');assert.equal(changed.approval,null);assert.equal(changed.contentVersion,2);assert.equal(f.store.get('socialPublishJobs',job.id).status,'cancelled');assert.equal(f.store.get('socialPublishJobs',job.id).snapshot.variant.text,'첫 게시문');
  assert.throws(()=>f.service.savePost(f.users.writer,{revision:post.revision,title:'오래된 수정'},post.id),{status:409});
});

test('current permissions and connection identity are enforced at execution and after approval',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),[job]=f.schedule(post);
  assert.equal(f.service.workspace(f.users.other).posts.length,0);assert.throws(()=>f.service.get(f.users.other,post.id),{status:404});assert.throws(()=>f.service.savePost(f.users.viewer,f.input()),{status:403});
  f.store.put('users',f.users.manager.id,{...f.users.manager,role:'viewer'});await f.service.tick();assert.equal(f.sends.length,0);assert.equal(f.store.get('socialPublishJobs',job.id).status,'failed');
  f.store.put('users',f.users.manager.id,f.users.manager);f.store.put('channels','yt',{...f.store.get('channels','yt'),connectionVersion:2});
  await assert.rejects(f.service.jobAction(f.users.manager,job.id,{action:'reschedule',scheduledAt:f.now()}),{status:409});
});

test('global pause is visible and a missed reservation requires an explicit user decision',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),[job]=f.schedule(post);
  f.service.saveSettings(f.users.admin,{scope:'global',paused:true});await f.service.tick();assert.equal(f.sends.length,0);assert.equal(f.service.get(f.users.writer,post.id).jobs[0].paused,true);
  f.setTime('2026-10-13T02:00:00.000Z');f.service.saveSettings(f.users.admin,{scope:'global',paused:false});await f.service.tick();assert.equal(f.store.get('socialPublishJobs',job.id).status,'missed');assert.equal(f.sends.length,0);
  await f.service.jobAction(f.users.manager,job.id,{action:'publish_now'});await f.service.tick();assert.equal(f.sends.length,1);
});

test('an unknown request is never automatically resent, restart reconciles instead',async t=>{
  const f=await fixture(t,{publish:async()=>{throw new Error('PRIVATE_TRANSPORT_VALUE');},status:async()=>({status:'published',url:'https://youtu.be/abcdefghijk',publishedAt:'2026-10-13T00:01:00Z'})}),post=f.approve(f.create()),[job]=f.schedule(post);
  await f.service.tick();let row=f.store.get('socialPublishJobs',job.id);assert.equal(row.status,'unknown');assert.doesNotMatch(JSON.stringify(row),/PRIVATE_TRANSPORT_VALUE/);
  await assert.rejects(f.service.jobAction(f.users.manager,job.id,{action:'retry'}),{status:409});
  f.setTime('2026-10-13T00:06:00Z');const restarted=createSocialPublishingService({store:f.store,clock:f.now,provider:f.provider});await restarted.tick();assert.equal(f.store.get('socialPublishJobs',job.id).status,'published');assert.equal(f.store.get('socialPublishJobs',job.id).attempts,1);await restarted.close();
});

test('expired in-flight lease after crash is polled without repeating the submission',async t=>{
  let polls=0;const f=await fixture(t,{status:async()=>{polls++;return {status:'processing',providerId:'remote-1'};}}),post=f.approve(f.create()),[job]=f.schedule(post);
  f.store.put('socialPublishJobs',job.id,{...f.store.get('socialPublishJobs',job.id),status:'publishing',attempts:1,leaseUntil:'2026-10-12T23:59:59Z'});await f.service.tick();assert.equal(polls,1);assert.equal(f.sends.length,0);assert.equal(f.store.get('socialPublishJobs',job.id).status,'processing');
});

test('independent channel jobs retain partial success and unsupported providers remain manual',async t=>{
  const f=await fixture(t,{capability:c=>({mode:c.id==='ig'?'manual':'automatic',canPublish:c.id!=='ig',reason:c.id==='ig'?'SNS 앱에서 음악 선택':''})});const post=f.approve(f.create({variants:[{channelId:'yt',text:'유튜브',format:'video'},{channelId:'ig',text:'릴스',format:'reel'}]}));f.schedule(post);await f.service.tick();const jobs=f.service.get(f.users.manager,post.id).jobs;assert.deepEqual(jobs.map(j=>j.status),['published','manual']);assert.equal(f.sends.length,1);
  const manual=jobs[1];await assert.rejects(f.service.jobAction(f.users.manager,manual.id,{action:'manual_complete',publicationUrl:'https://example.com/not-a-post',publishedAt:f.now()}),{status:400});await assert.rejects(f.service.jobAction(f.users.manager,manual.id,{action:'manual_complete',publicationUrl:'https://youtu.be/abcdefghijk',publishedAt:f.now()}),{status:400});
  const complete=await f.service.jobAction(f.users.manager,manual.id,{action:'manual_complete',publicationUrl:'https://www.instagram.com/p/ABCDE/',publishedAt:f.now()});assert.equal(complete.job.status,'published');assert.equal(complete.job.publicVerifiedAt,null);
});

test('weekly slots use local timezone, protect fixed appointments and reject stale bulk changes atomically',async t=>{
  const f=await fixture(t);f.service.saveSlots(f.users.manager,{channelId:'yt',category:'기초',timezone:'Asia/Seoul',slots:[{weekday:2,time:'09:05'},{weekday:2,time:'09:10'}]});
  const first=f.approve(f.create()),[a]=f.schedule(first,{mode:'queue'});assert.equal(a.scheduledAt,'2026-10-13T00:05:00.000Z');
  const second=f.approve(f.create()),[b]=f.schedule(second,{mode:'queue'});assert.equal(b.scheduledAt,'2026-10-13T00:10:00.000Z');
  const third=f.approve(f.create()),[c]=f.schedule(third,{scheduledAt:'2026-10-14T00:00:00Z'}),preview=f.service.reschedulePreview(f.users.manager,{jobIds:[a.id,c.id],shiftMinutes:60});assert.equal(preview.changes[1].excluded,true);
  const stale=clone(preview.changes);stale[0].updatedAt='2000-01-01T00:00:00Z';assert.throws(()=>f.service.rescheduleApply(f.users.manager,{changes:stale}),{status:409});assert.equal(f.store.get('socialPublishJobs',a.id).scheduledAt,a.scheduledAt);
  f.service.rescheduleApply(f.users.manager,preview);assert.equal(f.store.get('socialPublishJobs',c.id).scheduledAt,c.scheduledAt);assert.equal(f.store.get('socialPublishJobs',a.id).scheduledAt,'2026-10-13T01:05:00.000Z');
});
const clone=value=>JSON.parse(JSON.stringify(value));

test('DST spring gap is skipped instead of scheduling a different local hour',async t=>{
  const f=await fixture(t);f.setTime('2026-03-08T06:00:00Z');f.service.saveSlots(f.users.manager,{channelId:'yt',timezone:'America/New_York',slots:[{weekday:0,time:'02:30'}]});const post=f.approve(f.create()),[job]=f.schedule(post,{mode:'queue'});assert.equal(job.scheduledAt,'2026-03-15T06:30:00.000Z');
});

test('bulk preview reports row errors, import is idempotent, and invalid requests never create posts',async t=>{
  const f=await fixture(t),rows=[f.input(),f.input({title:''})],preview=f.service.bulkPreview(f.users.writer,{rows});assert.equal(preview.rows[0].valid,true);assert.equal(preview.rows[1].valid,false);assert.throws(()=>f.service.bulkImport(f.users.writer,{rows}),{status:400});assert.equal(f.store.all('socialPosts').length,0);
  const input={rows:[f.input(),f.input({title:'둘째'})],importKey:'same-batch'},first=f.service.bulkImport(f.users.writer,input),second=f.service.bulkImport(f.users.writer,input);assert.equal(first.posts.length,2);assert.equal(second.existing,true);assert.equal(f.store.all('socialPosts').length,2);
  assert.throws(()=>f.service.bulkImport(f.users.writer,{...input,rows:[f.input({title:'변경'})]}),{status:409});
});

test('repeat schedules preserve immutable approval and stop at count and expiry bounds',async t=>{
  const f=await fixture(t),post=f.approve(f.create({recurrence:{intervalDays:1,maxOccurrences:2,until:'2026-10-15T00:00:00Z'}}));f.schedule(post);await f.service.tick();let jobs=f.service.get(f.users.manager,post.id).jobs;assert.equal(jobs.length,2);assert.equal(jobs[1].occurrence,2);f.setTime('2026-10-14T00:00:00Z');await f.service.tick();jobs=f.service.get(f.users.manager,post.id).jobs;assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.status==='published'));
});

test('source rules produce reviewable drafts, deduplicate source events and preserve delay suggestions',async t=>{
  const f=await fixture(t);f.service.saveRule(f.users.manager,{title:'확정본 배포',sourceId:'studio',channelIds:['yt','ig'],scope:'new',delayMinutes:120,enabled:true});
  const input={sourceId:'studio',eventId:'final-v1',confirmed:true,post:{title:'완성본',body:'확정 문구'}},first=f.service.ingestSource(f.users.manager,input),again=f.service.ingestSource(f.users.manager,input);assert.equal(first.results.length,1);assert.equal(again.results[0].existing,true);assert.equal(f.store.all('socialPosts').length,1);assert.equal(f.store.all('socialPosts')[0].status,'draft');assert.equal(f.store.all('socialPublishJobs').length,0);assert.equal(f.store.all('socialSourceReceipts')[0].suggestedAt,'2026-10-13T02:00:00.000Z');
});

test('publication success survives failed performance linkage and retries only that linkage',async t=>{
  const f=await fixture(t);let links=0;const svc=createSocialPublishingService({store:f.store,clock:f.now,provider:f.provider,onPublished:async()=>{if(++links===1)throw new Error('private');return {performanceEntryId:'entry'};}}),post=f.approve(f.create());f.schedule(post);await svc.tick();assert.equal(f.store.all('socialPublishJobs')[0].status,'published');assert.ok(f.store.all('socialPublishJobs')[0].outcomeError);await svc.tick();assert.equal(f.sends.length,1);assert.equal(links,2);assert.equal(f.store.all('socialPublishJobs')[0].performanceEntryId,'entry');await svc.close();
});

test('second worker cannot duplicate a claimed job and pause during media preparation blocks send',async t=>{
  const f=await fixture(t);let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let svc,external=0;svc=createSocialPublishingService({store:f.store,clock:f.now,provider:{...f.provider,publish:async args=>{entered();await gate;svc.assertExecution(args);external++;return {status:'published'};}}});const post=f.approve(f.create());f.schedule(post);const executing=svc.tick();await ready;const other=createSocialPublishingService({store:f.store,clock:f.now,provider:f.provider});await other.tick();assert.equal(f.sends.length,0);f.service.saveSettings(f.users.admin,{scope:'global',paused:true});release();await executing;assert.equal(external,0);assert.equal(f.store.all('socialPublishJobs')[0].status,'unknown');await svc.close();await other.close();
});

test('malformed dates, duplicate targets, unsafe URLs and excessive text reject without writes',async t=>{
  const f=await fixture(t);for(const extra of [{expiresAt:'2026-02-30T00:00:00Z'},{media:[{url:'javascript:alert(1)',type:'image'}]},{variants:[{channelId:'yt'},{channelId:'yt'}]},{title:'x'.repeat(301)}])assert.throws(()=>f.create(extra),{status:400});assert.equal(f.store.all('socialPosts').length,0);
  const post=f.create({media:[{assetId:'asset',id:'asset',url:'/api/social/media/asset',mimeType:'video/mp4',byteSize:1000,duration:10,sha256:'hash'}],variants:[{channelId:'yt',format:'video',options:{privacy:'unlisted',madeForKids:false}}]});assert.equal(post.media[0].assetId,'asset');assert.equal(post.variants[0].options.madeForKids,false);assert.equal(post.variants[0].media[0].type,'video');
});

test('accepted remote failures cannot be rescheduled as a new submission; definitive rejections can',async t=>{
  let attempts=0;const f=await fixture(t,{publish:async()=>{attempts++;return {status:'failed',message:'원격 처리 실패',retryable:false,definitive:false};}}),post=f.approve(f.create()),[job]=f.schedule(post);await f.service.tick();
  await assert.rejects(f.service.jobAction(f.users.manager,job.id,{action:'reschedule',scheduledAt:f.now()}),{status:409});assert.equal(attempts,1);
  f.store.put('socialPublishJobs',job.id,{...f.store.get('socialPublishJobs',job.id),definitiveFailure:true,retryable:true});await f.service.jobAction(f.users.manager,job.id,{action:'retry'});await f.service.tick();assert.equal(attempts,2);assert.equal(f.store.get('socialPublishJobs',job.id).attempts,2);
});

test('unknown reconciliation cannot overwrite a manual confirmation completed during the request',async t=>{
  let release;const gate=new Promise(resolve=>release=resolve);const f=await fixture(t,{publish:async()=>({status:'unknown'}),status:async()=>{await gate;return {status:'processing'};}}),post=f.approve(f.create()),[job]=f.schedule(post);await f.service.tick();
  const pending=f.service.jobAction(f.users.manager,job.id,{action:'reconcile'});await f.service.jobAction(f.users.manager,job.id,{action:'manual_complete',publicationUrl:'https://youtu.be/abcdefghijk',publishedAt:f.now()});release();await pending;assert.equal(f.store.get('socialPublishJobs',job.id).status,'published');assert.equal(f.store.get('socialPublishJobs',job.id).publicationUrl,'https://www.youtube.com/watch?v=abcdefghijk');
});

test('source authorization is rechecked for approval, schedule and immediately before provider send',async t=>{
  const f=await fixture(t);let allowed=true,calls=0;const service=createSocialPublishingService({store:f.store,clock:f.now,provider:f.provider,validateSource(user,post){calls++;assert.equal(post.source.clientProjectId,'client-project');if(!allowed)throw Object.assign(new Error('원본 접근 권한이 변경됐습니다.'),{status:403});}});
  const draft=service.savePost(f.users.writer,f.input({source:{clientProjectId:'client-project',clientVersionId:'version',clientApprovalId:'approval'}})).post;
  allowed=false;assert.throws(()=>service.action(f.users.manager,draft.id,{revision:draft.revision,action:'approve'}),{status:403});
  allowed=true;const post=service.action(f.users.manager,draft.id,{revision:draft.revision,action:'approve'}).post;
  allowed=false;assert.throws(()=>service.action(f.users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:f.now()}),{status:403});
  allowed=true;const [job]=service.action(f.users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:f.now()}).jobs;allowed=false;await service.tick();assert.equal(f.sends.length,0);assert.equal(f.store.get('socialPublishJobs',job.id).status,'failed');assert.ok(calls>=5);await service.close();
});


test('provider preflight blocks automatic approval but preserves explicit manual finishing and unknown options fail visibly',async t=>{
  const f=await fixture(t,{preflight:()=>({valid:false,errors:[{code:'MEDIA_UNSUPPORTED',message:'WebM은 MP4로 변환해 주세요.'}],warnings:[]})});
  assert.throws(()=>f.create({variants:[{channelId:'yt',text:'원고',format:'video',options:{music:'licensed-track'}}]}),{status:400});
  const draft=f.create();assert.equal(draft.validation.valid,false);assert.match(draft.validation.errors[0],/WebM/);assert.throws(()=>f.approve(draft),{status:400});
  const manual=f.create({variants:[{channelId:'yt',text:'수동 원고',format:'video',options:{notifyOnly:true}}]});
  assert.equal(manual.validation.valid,true);assert.match(manual.validation.warnings[0],/WebM/);f.schedule(f.approve(manual));await f.service.tick();assert.equal(f.sends.length,0);assert.equal(f.service.get(f.users.manager,manual.id).jobs[0].status,'manual');
});

test('source rule selection is exact, returns safe delay receipts and rolls back drafts with a failed receipt',async t=>{
  const f=await fixture(t),rule=title=>f.service.saveRule(f.users.manager,{title,sourceId:'studio',scope:'all',channelIds:['yt'],enabled:true,delayMinutes:30}).rule;
  const one=rule('첫 규칙'),two=rule('두 번째 규칙');
  const input={confirmed:true,sourceId:'studio',eventId:'event',ruleId:one.id,post:{title:'확정 원본',body:'공통 본문',variants:[{channelId:'yt',text:'유튜브 전용 문구',format:'video',publicationFormat:'youtube-video'}]}};
  const result=f.service.ingestSource(f.users.manager,input);assert.equal(result.results.length,1);assert.equal(result.results[0].ruleId,one.id);assert.equal(result.results[0].suggestedAt,'2026-10-13T00:30:00.000Z');
  const post=f.service.get(f.users.manager,result.results[0].postId).post;assert.equal(post.variants[0].text,'유튜브 전용 문구');assert.equal(post.variants[0].publicationFormat,'youtube-video');assert.equal(post.status,'draft');
  assert.equal(f.service.ingestSource(f.users.manager,input).results[0].existing,true);
  assert.equal(f.service.workspace(f.users.other).sourceReceipts.length,0);assert.equal(f.service.workspace(f.users.manager).sourceReceipts.length,1);assert.equal(f.service.workspace(f.users.manager).sourceReceipts[0].eventId,undefined);
  assert.throws(()=>f.service.ingestSource(f.users.manager,{...input,ruleId:'missing'}),{status:404});
  assert.throws(()=>f.service.ingestSource(f.users.other,input),{status:404});
  const before=f.store.all('socialPosts').length,put=f.store.put.bind(f.store);f.store.put=(kind,...args)=>{if(kind==='socialSourceReceipts')throw new Error('synthetic receipt failure');return put(kind,...args);};
  try{assert.throws(()=>f.service.ingestSource(f.users.manager,{...input,eventId:'rollback',ruleId:two.id}),/synthetic receipt failure/);}finally{f.store.put=put;}
  assert.equal(f.store.all('socialPosts').length,before);assert.equal(f.store.all('socialSourceReceipts').length,1);
});

test('public verification requires current manager, exact completed URL, explicit confirmation and fresh state',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),[scheduled]=f.schedule(post);
  await assert.rejects(f.service.jobAction(f.users.manager,scheduled.id,{action:'confirm_public',confirmed:true,publicationUrl:'https://www.youtube.com/watch?v=abcdefghijk',updatedAt:scheduled.updatedAt}),{status:409});
  await f.service.tick();let job=f.service.get(f.users.manager,post.id).jobs[0];
  const input={action:'confirm_public',confirmed:true,publicationUrl:job.publicationUrl,updatedAt:job.updatedAt};
  await assert.rejects(f.service.jobAction(f.users.writer,job.id,input),{status:403});
  await assert.rejects(f.service.jobAction(f.users.manager,job.id,{...input,confirmed:false}),{status:409});
  await assert.rejects(f.service.jobAction(f.users.manager,job.id,{...input,publicationUrl:'https://www.youtube.com/watch?v=zzzzzzzzzzz'}),{status:409});
  await assert.rejects(f.service.jobAction(f.users.manager,job.id,{...input,updatedAt:'2026-10-12T00:00:00Z'}),{status:409});
  f.setTime('2026-10-13T01:00:00Z');job=(await f.service.jobAction(f.users.manager,job.id,input)).job;
  assert.equal(job.publicVerifiedAt,'2026-10-13T01:00:00.000Z');assert.equal(job.publicVerifiedById,f.users.manager.id);assert.equal(job.publicVerificationSource,'human-confirmed');assert.equal(f.sends.length,1);
});

test('historical jobs remain private after the editable post moves to a different team channel',async t=>{
  const f=await fixture(t),post=f.approve(f.create());f.schedule(post);await f.service.tick();
  f.store.put('channels','private-b',{id:'private-b',platform:'instagram',active:true,teamId:'b',ownerIds:[]});
  const changed=f.service.savePost(f.users.admin,{revision:post.revision,title:'새 팀 원고',variants:[{channelId:'private-b',text:'새 원고',format:'post'}]},post.id).post;
  const social=f.service.workspace(f.users.other);assert.equal(social.posts.length,1);assert.equal(social.jobs.length,0);assert.equal(f.service.get(f.users.other,changed.id).jobs.length,0);
  const old=f.store.all('socialPublishJobs')[0];await assert.rejects(f.service.jobAction(f.users.other,old.id,{action:'confirm_public',confirmed:true,publicationUrl:old.publicationUrl,updatedAt:old.updatedAt}),{status:403});
  const job=f.service.workspace(f.users.admin).jobs[0];assert.equal(job.contentSummary.title,'합성 듣기 콘텐츠');assert.equal(job.contentSummary.format,'video');assert.equal(job.snapshot,undefined);assert.equal(job.contentSummary.body,undefined);assert.equal(job.contentSummary.source,undefined);
});

test('rate-limit retry guidance is retained without automatically resubmitting a failure',async t=>{
  const f=await fixture(t,{publish:async()=>({status:'failed',retryable:true,definitive:true,errorCode:'RATE_LIMIT',nextRetryAt:'2026-10-13T01:00:00Z'})}),post=f.approve(f.create());f.schedule(post);await f.service.tick();
  const job=f.service.get(f.users.manager,post.id).jobs[0];assert.equal(job.status,'failed');assert.equal(job.nextRetryAt,'2026-10-13T01:00:00.000Z');assert.equal(job.nextAttemptAt,null);
});


test('manual handoff exposes only immutable approved copy, media and account profile',async t=>{
  const f=await fixture(t),url='https://www.youtube.com/@approved-profile';f.store.put('channels','yt',{...f.store.get('channels','yt'),canonicalUrl:url});
  const ref={id:'asset',assetId:'asset',url:'/api/social/media/asset',type:'video',mimeType:'video/mp4',sha256:'a'.repeat(64),alt:'내부 미디어 메모'},post=f.approve(f.create({variants:[{channelId:'yt',title:'승인 제목',text:'승인한 게시 문구',format:'video',media:[ref],options:{hashtags:'#한국어 #듣기',firstComment:'첫 댓글'}}]})),[job]=f.schedule(post);
  f.service.savePost(f.users.writer,{revision:post.revision,title:'다음 원고',variants:[{channelId:'yt',text:'변경한 문구',format:'video'}]},post.id);
  f.store.put('channels','yt',{...f.store.get('channels','yt'),canonicalUrl:'https://www.youtube.com/@changed-profile'});
  const view=f.service.get(f.users.manager,post.id).jobs[0];assert.equal(view.handoff.title,'승인 제목');assert.equal(view.handoff.text,'승인한 게시 문구');assert.equal(view.handoff.hashtags,'#한국어 #듣기');assert.equal(view.handoff.profileUrl,url);assert.equal(view.handoff.contentVersion,post.contentVersion);
  assert.deepEqual(Object.keys(view.handoff.media[0]),['id','assetId','url','type','mimeType','sha256']);assert.equal(view.handoff.media[0].alt,undefined);assert.equal(view.handoff.source,undefined);assert.equal(view.snapshot,undefined);
  const context=f.service.handoff(f.users.manager,job.id);assert.equal(context.post.title,'합성 듣기 콘텐츠');assert.equal(context.variant.text,'승인한 게시 문구');assert.equal(context.channel.id,'yt');
  assert.throws(()=>f.service.handoff(f.users.writer,job.id),{status:403});assert.throws(()=>f.service.handoff(f.users.other,job.id),{status:404});
  f.store.put('users',f.users.manager.id,{...f.users.manager,role:'viewer'});assert.throws(()=>f.service.handoff(f.users.admin,job.id),{status:403});
});

test('legacy jobs without an approved snapshot ask for a new save and approval rather than using current draft files',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),[job]=f.schedule(post),saved=f.store.get('socialPublishJobs',job.id);delete saved.snapshot;f.store.put('socialPublishJobs',job.id,saved);
  assert.equal(f.service.get(f.users.manager,post.id).jobs[0].handoff,null);assert.throws(()=>f.service.handoff(f.users.manager,job.id),/다시 저장/);
});
