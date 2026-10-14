import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createStudioService} from './studio-service.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialMarketingService} from './social-marketing.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-social-edge-')),store=new Store(directory),user=store.createUser({email:'admin@social-edge.test',name:'관리자',role:'admin'}),now='2026-10-13T00:00:00.000Z';
  store.put('channels','ig',{id:'ig',platform:'instagram',active:true,ownerIds:[user.id],displayName:'검사용 IG'});
  const performance={list:()=>({entries:[],metricDefinitions:[]})},marketing=createSocialMarketingService({store,performance,clock:()=>now}),core=createSocialPublishingService({store,clock:()=>now,provider:{capability:()=>({mode:'automatic',canPublish:true,formats:['image','reel']}),publish:async({job})=>({status:'published',url:'https://www.instagram.com/p/'+job.id.slice(0,10)+'/',publishedAt:now})}});
  t.after(async()=>{await core.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  async function publish(format,extra={}){const draft=core.savePost(user,{title:'원래 제목',body:'확정 본문',purpose:'듣기 학습',category:'기초',language:'ko',variants:[{channelId:'ig',text:'문구',format}],...extra}).post,post=core.action(user,draft.id,{revision:draft.revision,action:'approve'}).post;core.action(user,post.id,{revision:post.revision,action:'schedule',scheduledAt:now});await core.tick();return core.get(user,post.id).post;}
  function measure(){performance.list=()=>({entries:store.all('socialPublishJobs').filter(j=>j.status==='published').map(j=>({id:'entry-'+j.id,channelId:j.channelId,url:j.publicationUrl,checkpoints:[{hours:24,status:'recorded',metrics:{views:10},metricProvenance:{views:{source:'api',unit:'count',timing:'on-time',measurementWindowMissed:false}}}]})),metricDefinitions:[]});}
  return {directory,store,user,marketing,core,publish,measure,performance,now};
}

test('real workspace insights keep image and reel observations in separate format groups',async t=>{
  const f=await fixture(t);await f.publish('image');await f.publish('reel');f.measure();const report=f.marketing.insights(f.user,f.core.workspace(f.user));
  assert.deepEqual(report.records.map(r=>r.format).sort(),['image','reel']);
  assert.equal(report.recommendations.length,2);
});

test('editing a published post does not rewrite the historic campaign or purpose attribution',async t=>{
  const f=await fixture(t),post=await f.publish('image',{campaignId:'original-campaign'});f.measure();f.core.savePost(f.user,{revision:post.revision,campaignId:'next-campaign',purpose:'새 목표',category:'뉴스',language:'en',title:'새 제목'},post.id);const row=f.marketing.insights(f.user,f.core.workspace(f.user)).records[0];
  assert.equal(row.campaignId,'original-campaign');assert.equal(row.purpose,'듣기 학습');assert.equal(row.title,'원래 제목');assert.equal(row.category,'기초');assert.equal(row.language,'ko');
});

test('campaign dates reject nonexistent calendar days instead of silently moving them to March',async t=>{
  const f=await fixture(t);assert.throws(()=>f.marketing.saveCampaign(f.user,{name:'잘못된 날짜',channelIds:['ig'],startAt:'2026-02-30',endAt:'2026-03-10'}),{status:400});
});


test('campaign calendar validation checks leap years, offsets and clock ranges',async t=>{
  const f=await fixture(t),save=startAt=>f.marketing.saveCampaign(f.user,{name:'날짜 검증',channelIds:['ig'],startAt});
  for(const value of ['2026-02-29','2026-04-31','2026-02-30T12:30:00+09:00','2026-10-13T24:00:00Z','2026-10-13T09:60:00Z','2026-10-13T09:00:00','2026-10-13 09:00Z',false])assert.throws(()=>save(value),{status:400});
  assert.equal(save('2028-02-29T09:00:00+09:00').campaign.startAt,'2028-02-29T09:00:00+09:00');
});

test('performance comparison preserves provenance, true even median, missing time and distinct publications',async t=>{
  const f=await fixture(t),jobs=[],entries=[];
  for(let i=0;i<10;i++){
    const url='https://www.instagram.com/p/test'+i+'/',entryId='e'+i;
    jobs.push({id:'j'+i,postId:'p'+i,channelId:'ig',status:'published',performanceEntryId:entryId,publicationUrl:url,publishedAt:i<2?'2026-10-12T00:00:00Z':null,updatedAt:f.now,contentSummary:{title:'기초',format:'image',purpose:'교육'}});
    entries.push({id:entryId,channelId:'ig',url,checkpoints:[{hours:24,status:'recorded',metrics:{views:i*10},metricProvenance:{views:{source:'manual',unit:'count',timing:'on-time'}}}]});
  }
  jobs.push({...jobs[0],id:'duplicate-job'});
  f.performance.list=()=>({entries,metricDefinitions:[]});
  const result=f.marketing.insights(f.user,{jobs});
  assert.equal(result.recommendations[0].sampleCount,10);assert.equal(result.recommendations[0].median,45);assert.deepEqual(result.recommendations[0].timeSlots,[]);
  entries[1].checkpoints[0].metricProvenance.views.source='api:instagram';
  assert.equal(f.marketing.insights(f.user,{jobs}).recommendations.length,2);
  jobs[0].publishedAt='2026-09-01T00:00:00Z';jobs[10].publishedAt=jobs[0].publishedAt;
  assert.equal(f.marketing.insights(f.user,{jobs}).weekly.published,1);
});

test('current channel access filters cached observations and private provenance',async t=>{
  const f=await fixture(t),member=f.store.createUser({email:'limited@edge.test',name:'담당자',role:'member',teamId:'a'});
  f.store.put('channels','ig',{...f.store.get('channels','ig'),ownerIds:[member.id]});
  const post=await f.publish('image');f.measure();const cached=f.core.workspace(member);
  assert.equal(f.marketing.insights(member,cached).records.length,1);
  f.store.put('channels','ig',{...f.store.get('channels','ig'),ownerIds:[]});
  assert.equal(f.marketing.insights(member,cached).records.length,0);assert.equal(f.marketing.notifications(member,cached).length,0);
  const asset={id:'private-media',ownerId:member.id,teamId:'a',fileName:'asset.png',diskName:'PRIVATE_DISK',mimeType:'image/png',byteSize:8,customerEmail:'PRIVATE_CUSTOMER',secret:'PRIVATE_TOKEN'};f.store.put('socialMedia',asset.id,asset);
  assert.doesNotMatch(JSON.stringify(f.marketing.assets(member)),/PRIVATE_DISK|PRIVATE_CUSTOMER|PRIVATE_TOKEN/);
  assert.equal(post.source?.clientProjectId,'');
});

test('PULSE preview cannot be published by omitting provenance and final approval is bound to the latest preview',async t=>{
  const f=await fixture(t),clientProjects=createClientProjectsService({store:f.store,clock:()=>f.now}),marketing=createSocialMarketingService({store:f.store,clientProjects,clock:()=>f.now});
  const media=id=>({id,fileName:id+'.png',mimeType:'image/png',byteSize:8});
  const project={id:'client',ownerId:f.user.id,stage:'delivered',versions:[{id:'preview-1',kind:'preview',approvedAt:f.now,media:media('preview-media')},{id:'final-1',kind:'final',approvedPreviewId:'preview-1',media:media('final-media')}]};
  f.store.put('clientProjects',project.id,project);
  assert.throws(()=>marketing.validatePostInput(f.user,{media:[{id:'preview-media'}]}),{status:409});
  assert.throws(()=>marketing.validateSource(f.user,{media:[{id:'final-media'}]}),{status:409});
  const post=marketing.validatePostInput(f.user,{media:[{id:'final-media'}]});
  assert.deepEqual(post.source,{clientProjectId:'client',clientVersionId:'final-1',clientApprovalId:'preview-1'});
  assert.equal(marketing.validateSource(f.user,post),true);
  assert.throws(()=>marketing.validatePostInput(f.user,{media:[{id:'final-media'}],source:{clientProjectId:'another'}}),{status:409});
  f.store.put('clientProjects',project.id,{...project,versions:[...project.versions,{id:'preview-2',kind:'preview'}]});
  assert.throws(()=>marketing.validateSource(f.user,post),{status:409});
  assert.throws(()=>marketing.ownMedia(f.user,'final-media'),{status:409});
});

test('private media read rechecks the original owner and media identity after filesystem await',async t=>{
  const f=await fixture(t),owner=f.store.createUser({email:'media-owner@edge.test',name:'원본 담당',role:'member',teamId:'a'}),id=randomUUID(),bytes=Buffer.from([137,80,78,71,13,10,26,10]),sha256=createHash('sha256').update(bytes).digest('hex');
  const metadata={id,ownerId:owner.id,teamId:'a',diskName:id+'.png',fileName:'asset.png',mimeType:'image/png',byteSize:bytes.length,sha256};
  await mkdir(join(f.directory,'studio-media'));await writeFile(join(f.directory,'studio-media',metadata.diskName),bytes);f.store.put('socialMedia',id,metadata);
  f.store.put('channels','ig',{...f.store.get('channels','ig'),ownerIds:[owner.id]});
  const args={post:{ownerId:owner.id,media:[{id}]},channel:{id:'ig'},job:{publisherId:f.user.id}};
  const pending=f.marketing.resolveMedia({id,sha256},args);
  f.store.put('channels','ig',{...f.store.get('channels','ig'),ownerIds:[]});
  await assert.rejects(pending,{status:403});
  f.store.put('channels','ig',{...f.store.get('channels','ig'),ownerIds:[owner.id]});
  const changed=f.marketing.resolveMedia({id,sha256},args);f.store.put('socialMedia',id,{...metadata,sha256:'f'.repeat(64)});
  await assert.rejects(changed,{status:409});
});

test('approval request notifications use current reviewer permission and per-user receipts',async t=>{
  const f=await fixture(t),manager=f.store.createUser({email:'reviewer@edge.test',name:'검토자',role:'manager',teamId:'a'}),writer=f.store.createUser({email:'writer@edge.test',name:'작성자',role:'member',teamId:'a'});
  f.store.put('channels','ig',{...f.store.get('channels','ig'),teamId:'a',ownerIds:[writer.id]});
  const draft=f.core.savePost(writer,{title:'승인 대기',variants:[{channelId:'ig',text:'문구',format:'image'}]}).post;
  f.core.action(writer,draft.id,{revision:draft.revision,action:'submit'});
  const social=f.core.workspace(manager),notes=f.marketing.notifications(manager,social);
  assert.equal(notes.length,1);assert.equal(notes[0].title,'SNS 승인 요청');
  f.marketing.readNotifications(manager,social,notes[0].id);assert.equal(f.marketing.notifications(manager,social)[0].unread,false);
  assert.equal(f.marketing.notifications(writer,f.core.workspace(writer)).length,0);
  f.store.put('users',manager.id,{...manager,teamId:'b'});
  assert.equal(f.marketing.notifications(manager,social).length,0);
});


test('editing collected inbox workflow preserves immutable source text and native deduplication IDs',async t=>{
  const f=await fixture(t),row={id:'imported-comment',revision:1,channelId:'ig',postId:'',kind:'comment',author:'고객',text:'실제 수집 원문',url:'https://www.instagram.com/p/ABCDE/',status:'open',assigneeId:f.user.id,replyDraft:'',source:'api:instagram',externalId:'comment-123',nativePostId:'post-456',collectorPostId:'collector-789',parentExternalId:'parent-000',remoteCreatedAt:f.now,importedAt:f.now,lastCollectedAt:f.now,createdAt:f.now,updatedAt:f.now};
  f.store.put('socialInbox',row.id,row);
  const next=f.marketing.saveInbox(f.user,{revision:1,status:'resolved',replyDraft:'확인했습니다.'},row.id).item;
  for(const field of ['source','externalId','nativePostId','collectorPostId','parentExternalId','remoteCreatedAt','importedAt','lastCollectedAt','text','author','url'])assert.equal(next[field],row[field]);
  assert.equal(next.status,'resolved');assert.equal(next.outboundSent,false);
  assert.throws(()=>f.marketing.saveInbox(f.user,{revision:2,text:'수정한 원문'},row.id),{status:400});
  assert.equal(f.store.get('socialInbox',row.id).text,row.text);
});


const realPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
let ffprobeAvailable=false;try{await promisify(execFile)(process.env.SYNK_FFPROBE_EXE||'ffprobe',['-version'],{windowsHide:true,timeout:5000});ffprobeAvailable=true;}catch{}
const needsProbe={skip:ffprobeAvailable?false:'FFprobe 미설치 환경에서는 실제 규격 검사 시험 생략'};
async function realMedia(f){const id=randomUUID(),media={id,diskName:id+'.png',fileName:'실제 원본.png',mimeType:'image/png',byteSize:realPng.length};await mkdir(join(f.directory,'studio-media'),{recursive:true});await writeFile(join(f.directory,'studio-media',media.diskName),realPng);return media;}

test('preparing existing Studio and PULSE media binds actual hash and dimensions without changing source content or approval',needsProbe,async t=>{
  const f=await fixture(t),studio=createStudioService({store:f.store}),clientProjects=createClientProjectsService({store:f.store}),marketing=createSocialMarketingService({store:f.store,studio,clientProjects,clock:()=>f.now});
  const studioMedia=await realMedia(f),production=studio.saveProduction(f.user,{title:'확정한 원고',stage:'ready'}).production;
  studio.addMedia(f.user,production.id,studioMedia,'확정본');const originalProduction=f.store.get('studioProductions',production.id);
  const clientMedia=await realMedia(f),project={id:'prepare-client',revision:7,ownerId:f.user.id,stage:'delivered',title:'고객 최종본',messages:[{id:'approval-record',text:'이대로 승인'}],versions:[{id:'preview',kind:'preview',approvedAt:f.now},{id:'final',kind:'final',approvedPreviewId:'preview',label:'최종본',media:clientMedia}]};
  f.store.put('clientProjects',project.id,project);
  const result=await marketing.prepareMedia(f.user,[studioMedia.id,clientMedia.id,studioMedia.id],{authorize:()=>f.user});
  assert.equal(result.media.length,2);
  for(const row of result.media){assert.equal(row.width,1);assert.equal(row.height,1);assert.equal(row.sha256,createHash('sha256').update(realPng).digest('hex'));assert.equal(row.url,'/api/social/media/'+row.id);assert.equal(row.assetId,row.id);}
  assert.deepEqual(f.store.get('studioProductions',production.id),originalProduction);assert.equal(f.store.get('studioMedia',studioMedia.id).sha256,result.media[0].sha256);
  const updated=f.store.get('clientProjects',project.id);assert.equal(updated.versions[1].media.sha256,result.media[1].sha256);updated.versions[1].media=clientMedia;assert.deepEqual(updated,project);
  assert.doesNotMatch(JSON.stringify(result),/diskName|ownerId|approval-record/);
  assert.equal(marketing.validatePostInput(f.user,{media:[{id:clientMedia.id}]}).media[0].sha256,result.media[1].sha256);
});

test('media preparation aborts after live account revocation without persisting unapproved metadata',needsProbe,async t=>{
  const f=await fixture(t),owner=f.store.createUser({email:'prepare-owner@edge.test',name:'담당자',role:'member'}),media=await realMedia(f);
  f.store.put('socialMedia',media.id,{...media,ownerId:owner.id});
  const pending=f.marketing.prepareMedia(owner,[media.id],{authorize:()=>owner});
  f.store.put('users',owner.id,{...owner,active:false});
  await assert.rejects(pending,{status:401});assert.equal(f.store.get('socialMedia',media.id).sha256,undefined);
});

test('media preparation detects a newly superseding PULSE preview and leaves its approval untouched',needsProbe,async t=>{
  const f=await fixture(t),clientProjects=createClientProjectsService({store:f.store}),marketing=createSocialMarketingService({store:f.store,clientProjects,clock:()=>f.now}),media=await realMedia(f),project={id:'prepare-race',ownerId:f.user.id,stage:'delivered',versions:[{id:'preview-1',kind:'preview',approvedAt:f.now},{id:'final',kind:'final',approvedPreviewId:'preview-1',media}]};
  f.store.put('clientProjects',project.id,project);const pending=marketing.prepareMedia(f.user,[media.id]);
  f.store.put('clientProjects',project.id,{...project,versions:[...project.versions,{id:'preview-2',kind:'preview'}]});
  await assert.rejects(pending,{status:409});assert.equal(f.store.get('clientProjects',project.id).versions[1].media.sha256,undefined);assert.equal(f.store.get('clientProjects',project.id).versions[0].approvedAt,f.now);
});

test('media preparation commits all metadata together and rejects malformed references',needsProbe,async t=>{
  const f=await fixture(t),media=await realMedia(f);f.store.put('socialMedia',media.id,{...media,ownerId:f.user.id});
  await assert.rejects(f.marketing.prepareMedia(f.user,[media.id,'missing']),{status:404});assert.equal(f.store.get('socialMedia',media.id).sha256,undefined);
  await assert.rejects(f.marketing.prepareMedia(f.user,[null]),{status:400});await assert.rejects(f.marketing.prepareMedia(f.user,Array(101).fill(media.id)),{status:400});
  const aborter=new AbortController();aborter.abort();await assert.rejects(f.marketing.prepareMedia(f.user,[media.id],{signal:aborter.signal}),{status:409});
});


async function handoffFixture(f,{owner=f.user}={}){
  const media=await realMedia(f),sha256=createHash('sha256').update(realPng).digest('hex');f.store.put('socialMedia',media.id,{...media,sha256,ownerId:owner.id,width:1,height:1});
  f.store.put('channels','ig',{...f.store.get('channels','ig'),teamId:'a',ownerIds:[owner.id],canonicalUrl:'https://www.instagram.com/approved/'});
  const ref={assetId:media.id,id:media.id,url:'/api/social/media/'+media.id,mimeType:'image/png',sha256},draft=f.core.savePost(owner,{title:'승인 제목',variants:[{channelId:'ig',text:'승인 문구',format:'image',media:[ref]}]}).post,post=f.core.action(f.user,draft.id,{revision:draft.revision,action:'approve'}).post;
  const [job]=f.core.action(f.user,post.id,{revision:post.revision,action:'schedule',scheduledAt:f.now}).jobs;
  return {media,ref,post,job,context:()=>f.core.handoff(f.user,job.id)};
}

test('manual download returns the approved local bytes even after the editable post changes',async t=>{
  const f=await fixture(t),h=await handoffFixture(f);f.core.savePost(f.user,{revision:h.post.revision,title:'새 제목',variants:[{channelId:'ig',text:'새 문구',format:'image'}]},h.post.id);
  const context=h.context(),result=await f.marketing.downloadHandoff(f.user,context.variant.media[0],{...context,authorize:()=>f.user});
  assert.deepEqual(result.bytes,realPng);assert.equal(result.mimeType,'image/png');assert.equal(result.fileName,'실제 원본.png');assert.equal(context.variant.text,'승인 문구');
  await assert.rejects(f.marketing.downloadHandoff(f.user,{...h.ref,sha256:'f'.repeat(64)},context),{status:409});
  const changed=Buffer.from(realPng);changed[changed.length-1]^=1;await writeFile(join(f.directory,'studio-media',h.media.diskName),changed);
  await assert.rejects(f.marketing.downloadHandoff(f.user,h.ref,h.context()),{status:409});
});

test('manual download rechecks the requesting session and the original author after filesystem awaits',async t=>{
  const f=await fixture(t),owner=f.store.createUser({email:'handoff-owner@edge.test',name:'원본 담당자',role:'member',teamId:'a'}),other=f.store.createUser({email:'handoff-other@edge.test',name:'다른 관리자',role:'admin'}),h=await handoffFixture(f,{owner});
  let sessionUser=f.user;const first=f.marketing.downloadHandoff(f.user,h.ref,{...h.context(),authorize:()=>sessionUser});sessionUser=other;await assert.rejects(first,{status:401});
  const second=f.marketing.downloadHandoff(f.user,h.ref,{...h.context(),authorize:()=>f.user});f.store.put('channels','ig',{...f.store.get('channels','ig'),ownerIds:[]});await assert.rejects(second,{status:403});
});

test('manual download preserves the original publisher permission requirement while reading bytes',async t=>{
  const f=await fixture(t),h=await handoffFixture(f),publisher=f.store.createUser({email:'handoff-publisher@edge.test',name:'발행 담당',role:'manager',teamId:'a'}),saved=f.store.get('socialPublishJobs',h.job.id);f.store.put('socialPublishJobs',saved.id,{...saved,publisherId:publisher.id});
  const pending=f.marketing.downloadHandoff(f.user,h.ref,h.context());f.store.put('users',publisher.id,{...publisher,role:'viewer'});await assert.rejects(pending,{status:403});
});

test('legacy local media without an approved hash and external URLs cannot masquerade as verified downloads',async t=>{
  const f=await fixture(t),h=await handoffFixture(f),saved=f.store.get('socialPublishJobs',h.job.id);delete saved.snapshot.variant.media[0].sha256;f.store.put('socialPublishJobs',saved.id,saved);
  const context=h.context();await assert.rejects(f.marketing.downloadHandoff(f.user,context.variant.media[0],context),/다시 저장/);
  await assert.rejects(f.marketing.downloadHandoff(f.user,{url:'https://example.test/original.png'},context),{status:422});
});
