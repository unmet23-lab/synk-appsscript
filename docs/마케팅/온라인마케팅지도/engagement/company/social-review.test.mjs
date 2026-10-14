import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialReview} from './social-review.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const origin='http://127.0.0.1:4191',context={origin,clientKey:'127.0.0.1'};
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-social-review-')),store=new Store(directory),users={};
  for(const [id,role,teamId] of [['admin','admin',null],['manager','manager','a'],['writer','member','a'],['viewer','viewer','a'],['other','manager','b']])users[id]=store.createUser({email:id+'@review.test',name:id,role,teamId});
  for(const id of ['a','b'])store.put('teams',id,{id,active:true});
  for(const id of ['ig','fb'])store.put('channels',id,{id,displayName:'검토 계정 '+id,platform:id==='ig'?'instagram':'facebook',active:true,teamId:'a',ownerIds:[users.writer.id],connectionVersion:1,url:'https://example.test/'+id});
  let time='2026-10-13T00:00:00.000Z',review,reads=0,sends=0,sourceValid=true,mediaHook=null;
  let bytes=Buffer.from('verified local fixture media'),mimeType='image/png';
  const media={assetId:'private-asset',id:'private-asset',url:'/api/social/media/private-asset',sha256:digest(bytes),mimeType,type:'image',width:100,height:100};
  const validateSource=()=>{if(!sourceValid)throw Object.assign(Error('PRIVATE_SOURCE_DETAIL'),{status:403});};
  const publishing=createSocialPublishingService({store,clock:()=>time,provider:{capability:()=>({mode:'automatic',canPublish:true,formats:['image','post'],maxMediaCount:20,maxTextLength:30000}),publish:async()=>{sends++;return {status:'published',url:'https://www.instagram.com/p/ABC123/',publishedAt:time};}},validateSource,onApproved:args=>review.recordApproval(args),validateReview:args=>review.validateReview(args)});
  review=createSocialReview({store,publishing,clock:()=>time,origin,validateSource,resolveMedia:async(ref,args)=>{reads++;if(mediaHook)await mediaHook(ref,args);return {bytes,fileName:'fixture.png',mimeType};}});
  t.after(async()=>{await review.stop();await publishing.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const create=(extra={})=>publishing.savePost(users.writer,{title:'검토 제목',body:'공통 문구',source:{privateReference:'never-public'},variants:[{channelId:'ig',text:'검토 원고',format:'image',media:[media],options:{altText:'사진 설명',hashtags:'#검토'}}],...extra}).post;
  const link=async(post,extra={})=>{const result=await review.create(users.writer,{postId:post.id,revision:post.revision,...extra});return {...result,token:new URL(result.url).hash.split('=')[1]};};
  const approve=post=>publishing.action(users.manager,post.id,{revision:post.revision,action:'approve'}).post;
  const respond=(token,extra={})=>review.respond(token,{revision:1,requestId:'request-0001',decision:'approve',name:'고객',...extra},context);
  return {store,users,publishing,review,create,link,approve,respond,media,setTime:value=>time=value,now:()=>time,setBytes:value=>bytes=value,setMime:value=>mimeType=value,mediaHook:fn=>mediaHook=fn,sourceValid:value=>sourceValid=value,reads:()=>reads,sends:()=>sends};
}

test('review links store only token hashes and expose only the fixed post version',async t=>{
  const f=await fixture(t),post=f.create(),link=await f.link(post),opened=await f.review.open(link.token,context);
  assert.match(link.token,/^[A-Za-z0-9_-]{43}$/);assert.equal(link.link.required,true);assert.equal(link.requirement.ready,false);
  const serialized=JSON.stringify([...f.store.all('socialReviewLinks'),...f.store.all('socialReviewTokens')]);assert.ok(!serialized.includes(link.token));assert.ok(serialized.includes(digest(link.token)));
  const publicText=JSON.stringify(opened);for(const privateValue of [post.id,f.users.writer.id,'private-asset','privateReference','ownerId','sha256','tokenHash','integrationId'])assert.ok(!publicText.includes(privateValue),privateValue);
  assert.equal(opened.review.snapshot.variants[0].media[0].key,'v0m0');assert.equal(opened.review.snapshot.variants[0].text,'검토 원고');
  await assert.rejects(f.review.open(link.token,{...context,origin:'https://evil.test'}),{status:403});await assert.rejects(f.review.open(link.token,{clientKey:'x'}),{status:403});
  assert.throws(()=>f.review.workspace(f.users.other,{postId:post.id}),{status:404});assert.equal(f.review.workspace(f.users.viewer,{postId:post.id}).canCreate,false);
  await assert.rejects(f.review.create(f.users.viewer,{postId:post.id,revision:post.revision}),{status:403});
});

test('required review holds scheduled publishing and customer approval never replaces internal approval',async t=>{
  const f=await fixture(t),draft=f.create(),unapproved=await f.link(draft);await f.respond(unapproved.token);
  assert.throws(()=>f.publishing.action(f.users.manager,draft.id,{revision:draft.revision,action:'schedule',scheduledAt:f.now()}),{status:409});
  const post=f.approve(draft),scheduled=f.publishing.action(f.users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:f.now()});
  await f.publishing.tick();assert.equal(f.sends(),0);assert.equal(f.store.get('socialPublishJobs',scheduled.jobs[0].id).status,'scheduled');
  const next=await f.link(post);await f.respond(next.token);assert.equal(f.review.workspace(f.users.writer,{postId:post.id}).requirement.ready,true);
  await f.publishing.tick();assert.equal(f.sends(),1);assert.equal(f.store.get('socialPublishJobs',scheduled.jobs[0].id).status,'published');
});

test('required creation is refused after submission, while optional feedback creates no gate',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),jobs=f.publishing.action(f.users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:f.now()}).jobs;
  f.store.put('socialPublishJobs',jobs[0].id,{...f.store.get('socialPublishJobs',jobs[0].id),status:'unknown'});
  await assert.rejects(f.link(post),{status:409});assert.equal(f.store.all('socialReviewLinks').length,0);
  const optional=await f.link(post,{required:false});assert.equal(optional.requirement.required,false);assert.equal(f.review.validateReview({post}),undefined);
});

test('all active required reviewers must approve; revocation stays gated until a new review replaces it',async t=>{
  const f=await fixture(t),post=f.create(),a=await f.link(post),b=await f.link(post);await f.respond(a.token);
  assert.throws(()=>f.review.validateReview({post}),{code:'SOCIAL_REVIEW_REQUIRED'});await f.respond(b.token);assert.equal(f.review.validateReview({post}),undefined);
  f.review.revoke(f.users.writer,{id:a.link.id,revision:2});assert.throws(()=>f.review.validateReview({post}),{code:'SOCIAL_REVIEW_REQUIRED'});
  const replacement=await f.link(post);await f.respond(replacement.token);assert.equal(f.review.validateReview({post}),undefined);
});

test('internal approval snapshots survive edits and produce field-level text/account/media/options/schedule changes',async t=>{
  const f=await fixture(t),post=f.approve(f.create());assert.equal(f.store.all('socialReviewApprovals').length,1);
  f.publishing.action(f.users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:'2026-10-14T00:00:00Z'});
  const next=f.publishing.savePost(f.users.writer,{revision:post.revision,title:'새 제목',body:'수정 공통',variants:[{channelId:'fb',text:'새 계정 문구',format:'post',media:[],options:{firstComment:'첫 댓글'}}]},post.id).post;
  const comparison=f.review.workspace(f.users.writer,{postId:post.id}).comparison;assert.equal(comparison.hasBaseline,true);assert.equal(comparison.baseline.body,'공통 문구');assert.equal(comparison.current.body,'수정 공통');
  for(const field of ['title','body','accounts','variants.ig.media','variants.fb.options'])assert.ok(comparison.changes.some(row=>row.field===field),field);
  assert.equal(next.contentVersion,2);assert.equal(f.store.all('socialReviewApprovals').length,1);
  f.store.put('channels','ig',{...f.store.get('channels','ig'),ownerIds:[],teamId:'b'});assert.equal(f.review.workspace(f.users.writer,{postId:post.id}).comparison.hasBaseline,false);
});

test('approval hook participates in rolled-back bulk previews',async t=>{
  const f=await fixture(t),post=f.create();const result=f.publishing.batch(f.users.manager,[{postId:post.id,revision:post.revision,operation:'approve',input:{}}],{preview:true});
  assert.equal(result.rows[0].valid,true);assert.equal(f.store.all('socialReviewApprovals').length,0);assert.equal(f.store.get('socialPosts',post.id).approval,null);
});

test('edits and connection remaps invalidate links and old customer approval cannot authorize a new version',async t=>{
  const f=await fixture(t),post=f.create(),link=await f.link(post);await f.respond(link.token);
  const next=f.publishing.savePost(f.users.writer,{revision:post.revision,body:'변경'},post.id).post;await assert.rejects(f.review.open(link.token,context),{status:410});assert.throws(()=>f.review.validateReview({post:next}),{code:'SOCIAL_REVIEW_REQUIRED'});
  const current=await f.link(next);f.store.put('channels','ig',{...f.store.get('channels','ig'),connectionVersion:2});await assert.rejects(f.respond(current.token),{status:410});
  assert.equal(f.review.workspace(f.users.writer,{postId:post.id}).links.every(row=>row.status==='stale'),true);
});

test('moving a schedule away and back invalidates its old review with a monotonic schedule revision',async t=>{
  const f=await fixture(t),post=f.approve(f.create()),job=f.publishing.action(f.users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:'2026-10-14T00:00:00Z'}).jobs[0],link=await f.link(post);await f.respond(link.token);
  await f.publishing.jobAction(f.users.manager,job.id,{action:'reschedule',scheduledAt:'2026-10-15T00:00:00Z'});await f.publishing.jobAction(f.users.manager,job.id,{action:'reschedule',scheduledAt:'2026-10-14T00:00:00Z'});
  await assert.rejects(f.review.open(link.token,context),{status:410});assert.ok(f.store.get('socialPublishJobs',job.id).scheduleRevision>=3);
});

test('expiry, explicit revoke, creator permissions, and source permission are enforced before reads',async t=>{
  for(const kind of ['expiry','revoke','creator','channel','source']){const f=await fixture(t),post=f.create(),link=await f.link(post);if(kind==='expiry')f.setTime('2026-10-21T00:00:00Z');if(kind==='revoke')f.review.revoke(f.users.writer,{id:link.link.id,revision:1});if(kind==='creator')f.store.put('users',f.users.writer.id,{...f.users.writer,role:'viewer'});if(kind==='channel')f.store.put('channels','ig',{...f.store.get('channels','ig'),ownerIds:[]});if(kind==='source')f.sourceValid(false);const before=f.reads();await assert.rejects(f.review.open(link.token,context),{status:410});assert.equal(f.reads(),before);}
});

test('media endpoint rechecks current bytes and permanently invalidates observed file tampering',async t=>{
  const f=await fixture(t),post=f.create(),link=await f.link(post),original=Buffer.from('verified local fixture media');await f.respond(link.token);
  const delivered=await f.review.media(link.token,{mediaKey:'v0m0'},context);assert.deepEqual(delivered.bytes,original);assert.equal(delivered.mimeType,'image/png');
  f.setBytes(Buffer.from('tampered bytes'));await assert.rejects(f.review.media(link.token,{mediaKey:'v0m0'},context),{status:410});f.setBytes(original);
  await assert.rejects(f.review.open(link.token,context),{status:410});assert.equal(f.review.workspace(f.users.writer,{postId:post.id}).links[0].status,'unavailable');assert.throws(()=>f.review.validateReview({post}),{code:'SOCIAL_REVIEW_REQUIRED'});
});

test('remote/unverified media are not published through a review link',async t=>{
  const f=await fixture(t),post=f.create({variants:[{channelId:'ig',text:'원격',format:'image',media:[{url:'https://external.test/secret.png',type:'image'}]}]});
  await assert.rejects(f.link(post),{status:422});assert.equal(f.reads(),0);assert.equal(f.store.all('socialReviewLinks').length,0);
});

test('feedback retries are idempotent, conflicts do not overwrite, and internal post stays untouched',async t=>{
  const f=await fixture(t),post=f.create(),link=await f.link(post),before=f.store.get('socialPosts',post.id);const first=await f.respond(link.token,{decision:'reject',comment:'<img src=x onerror=alert(1)>'});
  assert.equal(first.review.status,'rejected');const again=await f.respond(link.token,{decision:'reject',comment:'<img src=x onerror=alert(1)>'});assert.equal(again.review.feedback.length,1);
  await assert.rejects(f.respond(link.token,{decision:'approve'}),{status:409});await assert.rejects(f.respond(link.token,{requestId:'request-0002',decision:'comment',comment:'또다른 의견'}),{status:409});
  const approved=await f.respond(link.token,{revision:2,requestId:'request-0002'});assert.equal(approved.review.status,'approved');assert.deepEqual(f.store.get('socialPosts',post.id),before);assert.equal(f.sends(),0);
});

test('revoked sessions and changed revisions during media inspection cannot create links',async t=>{
  const f=await fixture(t),post=f.create();let release,started;const start=new Promise(r=>started=r),block=new Promise(r=>release=r);let allowed=true;
  f.mediaHook(async()=>{started();await block;});const action=f.review.create(f.users.writer,{postId:post.id,revision:post.revision},{authorize:()=>{if(!allowed)throw Object.assign(Error('expired'),{status:401});return f.users.writer;}});await start;allowed=false;release();await assert.rejects(action,{status:401});assert.equal(f.store.all('socialReviewLinks').length,0);assert.equal(f.store.all('socialReviewRequirements').length,0);
});

test('revocation while a response waits prevents feedback writes',async t=>{
  const f=await fixture(t),post=f.create(),link=await f.link(post);let release,started;const start=new Promise(r=>started=r),block=new Promise(r=>release=r);f.mediaHook(async()=>{started();await block;});
  const response=f.respond(link.token);await start;f.review.revoke(f.users.writer,{id:link.link.id,revision:1});release();await assert.rejects(response,{status:410});assert.equal(f.store.get('socialReviewLinks',link.link.id).feedback.length,0);
});

test('stop aborts and waits for active media checks without saving feedback',async t=>{
  const f=await fixture(t),post=f.create(),link=await f.link(post);let started;const start=new Promise(r=>started=r);f.mediaHook(async(_,args)=>{started();await new Promise((resolve,reject)=>args.signal.addEventListener('abort',()=>reject(Error('stopped')),{once:true}));});
  const request=f.respond(link.token);await start;await f.review.stop();await assert.rejects(request,{status:410});assert.equal(f.store.get('socialReviewLinks',link.link.id).feedback.length,0);await assert.rejects(f.review.open(link.token,context),{status:503});
});

test('rate limits bound untrusted guesses and token mutations, then expire',async t=>{
  const f=await fixture(t),post=f.create({variants:[{channelId:'ig',text:'텍스트',format:'post',media:[]}]}),link=await f.link(post);
  for(let i=0;i<12;i++)await f.respond(link.token,{revision:i+1,requestId:'request-'+String(i).padStart(4,'0'),decision:'comment',comment:'의견'});
  await assert.rejects(f.respond(link.token,{revision:13,requestId:'request-rate',decision:'comment',comment:'의견'}),{status:429});
  const badContext={...context,clientKey:'guesser'};for(let i=0;i<120;i++)await assert.rejects(f.review.open('bad',badContext),{status:410});await assert.rejects(f.review.open('bad',badContext),{status:429});
  f.setTime('2026-10-13T00:02:00Z');const response=await f.respond(link.token,{revision:13,requestId:'request-new'});assert.equal(response.review.feedback.length,13);
});

test('approved recurring plans include automatic copies while manually changed occurrences require a fresh review',async t=>{
  const f=await fixture(t),post=f.approve(f.create({recurrence:{intervalDays:1,maxOccurrences:3},variants:[{channelId:'ig',text:'첫 문구',format:'image',media:[f.media],copyVariants:[{id:'second',text:'두 번째 문구'}]}]}));
  f.publishing.action(f.users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:f.now()});const link=await f.link(post);await f.respond(link.token);await f.publishing.tick();
  const second=f.store.all('socialPublishJobs').find(j=>j.occurrence===2);assert.ok(second);assert.equal(f.review.validateReview({post}),undefined);assert.equal((await f.review.open(link.token,context)).review.snapshot.variants[0].copyVariants[0].text,'두 번째 문구');
  await f.publishing.jobAction(f.users.manager,second.id,{action:'reschedule',scheduledAt:'2026-10-15T00:00:00Z'});assert.throws(()=>f.review.validateReview({post}),{code:'SOCIAL_REVIEW_REQUIRED'});await assert.rejects(f.review.open(link.token,context),{status:410});
});

test('legacy approval is not fabricated and same-timestamp reconnection approval records the newest account',async t=>{
  const f=await fixture(t),post=f.approve(f.create());for(const entry of f.store.all('socialReviewApprovals'))f.store.remove('socialReviewApprovals',entry.id);
  assert.equal(f.review.workspace(f.users.writer,{postId:post.id}).comparison.hasBaseline,false);
  const first=f.approve(post);f.store.put('channels','ig',{...f.store.get('channels','ig'),connectionVersion:2});const latest=f.approve(first);assert.equal(f.store.all('socialReviewApprovals').length,2);
  assert.equal(f.review.workspace(f.users.writer,{postId:latest.id}).comparison.baseline.accounts[0].connectionVersion,2);
});

test('invalid token and wrong media key are safe failures without revoking a legitimate review',async t=>{
  const f=await fixture(t),post=f.create(),link=await f.link(post);await assert.rejects(f.review.open('z'.repeat(43),context),{status:410});await assert.rejects(f.review.media(link.token,{mediaKey:'v99m99'},context),{status:410});assert.equal((await f.review.open(link.token,context)).review.status,'pending');
});

test('a same-id feedback retry still rechecks current file integrity',async t=>{
  const f=await fixture(t),post=f.create(),link=await f.link(post);await f.respond(link.token);f.setBytes(Buffer.from('changed after approval'));await assert.rejects(f.respond(link.token),{status:410});assert.equal(f.store.get('socialReviewLinks',link.link.id).feedback.length,1);
});

test('approval survives bearer expiry and permits the unchanged later reservation while public access expires',async t=>{
  const f=await fixture(t),post=f.approve(f.create());f.publishing.action(f.users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:'2026-10-21T00:00:00Z'});
  const link=await f.link(post);assert.equal(link.link.expiresAt,'2026-10-16T00:00:00.000Z');await f.respond(link.token);f.setTime('2026-10-21T00:00:00Z');
  await assert.rejects(f.review.open(link.token,context),{status:410});await assert.rejects(f.review.media(link.token,{mediaKey:'v0m0'},context),{status:410});await assert.rejects(f.respond(link.token,{requestId:'request-after-expiry',revision:2}),{status:410});
  const view=f.review.workspace(f.users.writer,{postId:post.id});assert.equal(view.requirement.ready,true);assert.equal(view.links[0].status,'expired');assert.equal(view.links[0].accessExpired,true);assert.equal(view.links[0].approvalValid,true);
  await f.publishing.tick();assert.equal(f.sends(),1);
});

test('expired unapproved review still blocks and replacement retains approvals received before expiry',async t=>{
  const f=await fixture(t),post=f.create(),approved=await f.link(post),pending=await f.link(post);await f.respond(approved.token);f.setTime('2026-10-17T00:00:00Z');
  assert.throws(()=>f.review.validateReview({post}),{code:'SOCIAL_REVIEW_REQUIRED'});const replacement=await f.link(post);
  assert.deepEqual(replacement.requirement.linkIds,[approved.link.id,replacement.link.id]);assert.ok(!replacement.requirement.linkIds.includes(pending.link.id));await f.respond(replacement.token);
  assert.equal(f.review.workspace(f.users.writer,{postId:post.id}).requirement.ready,true);
});

test('expired approvals remain bound to revocation, content, schedule, connection, source and current permissions',async t=>{
  for(const kind of ['revoke','content','schedule','connection','source','permission','invalidated']){
    const f=await fixture(t),post=f.approve(f.create()),job=f.publishing.action(f.users.manager,post.id,{revision:post.revision,action:'schedule',scheduledAt:'2026-10-21T00:00:00Z'}).jobs[0],link=await f.link(post);await f.respond(link.token);f.setTime('2026-10-17T00:00:00Z');
    assert.equal(f.review.workspace(f.users.writer,{postId:post.id}).links[0].approvalValid,true);
    if(kind==='revoke')f.review.revoke(f.users.writer,{id:link.link.id,revision:2});
    if(kind==='content')f.publishing.savePost(f.users.writer,{revision:post.revision,body:'변경된 원고'},post.id);
    if(kind==='schedule')await f.publishing.jobAction(f.users.manager,job.id,{action:'reschedule',scheduledAt:'2026-10-22T00:00:00Z'});
    if(kind==='connection')f.store.put('channels','ig',{...f.store.get('channels','ig'),connectionVersion:2});
    if(kind==='source')f.sourceValid(false);
    if(kind==='permission')f.store.put('users',f.users.writer.id,{...f.users.writer,role:'viewer'});
    if(kind==='invalidated')f.store.put('socialReviewLinks',link.link.id,{...f.store.get('socialReviewLinks',link.link.id),invalidatedAt:f.now()});
    const live=f.store.get('socialPosts',post.id);assert.throws(()=>f.review.validateReview({post:live}),{code:'SOCIAL_REVIEW_REQUIRED'});assert.equal(f.review.workspace(f.users.manager,{postId:post.id}).links[0].approvalValid,false,kind);
  }
});
