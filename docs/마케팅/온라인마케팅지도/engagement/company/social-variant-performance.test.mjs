import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createSocialPublishingService} from './social-publishing.mjs';
import {createSocialWorkflowsService} from './social-workflows.mjs';
import {createSocialVariantPerformanceService} from './social-variant-performance.mjs';
import {createSocialTracking,socialTrackingSignaturePayload} from './social-tracking.mjs';
import {createHmac} from 'node:crypto';

function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-copy-comparison-')),store=new Store(directory);
  t.after(()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const user=store.createUser({email:'writer@copy.test',name:'합성 작성자',role:'member',teamId:'a'}),other=store.createUser({email:'other@copy.test',name:'합성 다른 팀',role:'member',teamId:'b'}),viewer=store.createUser({email:'viewer@copy.test',name:'합성 열람자',role:'viewer',teamId:'a'});
  store.put('teams','a',{id:'a',active:true});store.put('teams','b',{id:'b',active:true});
  for(const [id,owner,teamId]of[['ch',user,'a'],['private',other,'b']])store.put('channels',id,{id,platform:'instagram',displayName:id==='ch'?'합성 계정':'다른 팀 비공개 계정',active:true,ownerIds:[owner.id],teamId});
  let time='2026-10-20T00:00:00.000Z';const entries=[],links=[],clock=()=>time;let forbiddenSource=false;
  const validatePostInput=(_user,post)=>{if(forbiddenSource&&post.source?.productionId)throw Object.assign(new Error('private source revoked'),{status:403});return post;};
  const publishing=createSocialPublishingService({store,clock,validateSource:validatePostInput}),performance={list:()=>({entries})},tracking={workspace:()=>({links})};
  const service=createSocialVariantPerformanceService({store,publishing,performance,tracking,validatePostInput,clock}),workflows=createSocialWorkflowsService({store,publishing,clock,validatePostInput});
  let counter=0;
  function seed({postId,channelId='ch',body='기본 문구',copyId='base',hours=24,value=0,metric='views',source='api:instagram',purpose='듣기 연습',format='image',media=[],publishedAt='2026-10-13T00:00:00.000Z',offsetMinutes=0,origin={},options={},status='recorded',reason=null,unit='count'}={}){
    const actor=channelId==='private'?other:user;let post=postId?publishing.get(actor,postId).post:publishing.savePost(actor,{title:'원본 제목',body:'현재 초안',purpose,language:'ko',source:origin,variants:[{channelId,format,text:'현재 문구',media,options:{}}]}).post;
    const id='job-'+(++counter),url='https://www.instagram.com/p/TEST'+counter+'/',observedAt=new Date(Date.parse(publishedAt)+hours*3600000+offsetMinutes*60000).toISOString();
    const snapshot={post:{...post,purpose,source:origin},variant:{channelId,format,publicationFormat:format,title:'게시 제목',text:body,media,options,selectedCopyId:copyId}};
    const job={id,postId:post.id,channelId,status:'published',publicationUrl:url,publishedAt,contentVersion:1,performanceEntryId:'metric-'+counter,snapshot};store.put('socialPublishJobs',id,job);
    const cp={hours,status,source,timing:offsetMinutes>15?'late':'on-time',observedAt,recordedAt:observedAt,metrics:{[metric]:value,reach:null},unavailableReasons:{...(reason?{[metric]:reason}:{}),reach:'현재 플랫폼 연결에서 제공하지 않는 지표입니다.'},metricProvenance:value===null?{}:{[metric]:{source,unit,observedAt,recordedAt:observedAt,timing:offsetMinutes>15?'late':'on-time',measurementWindowMissed:false}}};
    const entry={id:job.performanceEntryId,channelId,url,publishedAt,checkpoints:[cp]};entries.push(entry);return {post,job,entry,cp};
  }
  return {store,user,other,viewer,entries,links,publishing,service,workflows,seed,clock,setTime:value=>{time=value;},validatePostInput,denySource:()=>{forbiddenSource=true;}};
}
const copies=result=>result.groups.flatMap(group=>group.variants);
const observations=result=>copies(result).flatMap(copy=>copy.observations);

test('published copy and fingerprint remain frozen when the current editor or repeated copy ID changes',t=>{
  const f=fixture(t),first=f.seed({body:'승인 당시 본문',copyId:'copy-1',value:0});
  f.seed({postId:first.post.id,body:'승인 당시 본문',copyId:'copy-1',value:10});
  f.seed({postId:first.post.id,body:'바뀐 승인 본문',copyId:'copy-1',value:100});
  f.publishing.savePost(f.user,{revision:first.post.revision,body:'현재 비공개 수정',variants:[{channelId:'ch',format:'image',text:'현재 비공개 수정',options:{}}]},first.post.id);
  const result=f.service.comparison(f.user),rows=copies(result);assert.equal(result.groups.length,1);assert.equal(rows.length,2);assert.equal(rows[0].sampleCount,2);assert.equal(rows[0].median,5);assert.equal(rows[0].status,'insufficient');assert.notEqual(rows[0].fingerprint,rows[1].fingerprint);assert.doesNotMatch(JSON.stringify(result),/현재 비공개 수정/);
});

test('comparison conditions separate account, original, format, purpose, source and observation delay',t=>{
  const f=fixture(t),first=f.seed({value:10});
  f.seed({postId:first.post.id,value:20});f.seed({postId:first.post.id,value:30,source:'manual'});f.seed({postId:first.post.id,value:40,offsetMinutes:60});f.seed({postId:first.post.id,value:50,purpose:'상담'});f.seed({postId:first.post.id,value:60,format:'reel'});f.seed({value:70});
  f.seed({postId:first.post.id,value:80,hours:72});
  const result=f.service.comparison(f.user);assert.equal(result.groups.filter(group=>group.condition.source==='manual').length,1);assert.equal(result.groups.filter(group=>group.condition.observationOffsetMinutes===60).length,1);assert.equal(result.groups.find(group=>group.condition.purpose==='상담').variants[0].median,50);
  assert.ok(copies(result).every(copy=>copy.sampleCount<=2));assert.equal(observations(f.service.comparison(f.user,{hours:72})).filter(row=>row.status==='measured').length,1);
});

test('zero, missing, unsupported and unusable provenance are not fabricated into equivalent values',t=>{
  const f=fixture(t);f.seed({value:0});f.seed({value:null,reason:'직접 확인한 값이 입력되지 않았습니다.'});f.seed({value:null,reason:'현재 플랫폼 연결에서 제공하지 않는 지표입니다.'});const invalid=f.seed({value:10});delete invalid.cp.metricProvenance.views.source;
  const rows=observations(f.service.comparison(f.user));assert.equal(rows.find(row=>row.status==='measured').value,0);assert.equal(rows.find(row=>row.status==='missing').value,null);assert.equal(rows.find(row=>row.status==='unsupported').value,null);assert.equal(rows.find(row=>row.status==='excluded').value,10);assert.equal(rows[0].denominator.impressions.value,null);assert.match(rows[0].denominator.note,/대체하거나/);
});

test('minimum sample labels and dates are evidence based; late missed windows do not enter medians',t=>{
  const f=fixture(t),a=f.seed({value:0});f.seed({postId:a.post.id,value:10});f.seed({postId:a.post.id,value:20});const missed=f.seed({postId:a.post.id,value:1000});missed.cp.metricProvenance.views.measurementWindowMissed=true;
  const row=copies(f.service.comparison(f.user))[0];assert.equal(row.sampleCount,3);assert.equal(row.median,10);assert.equal(row.status,'observed');assert.equal(row.excludedCount,1);assert.ok(row.observations.every(item=>item.observedAt&&item.recordedAt));
  assert.equal(f.service.comparison(f.user,{from:'2026-10-14'}).groups.length,0);assert.throws(()=>f.service.comparison(f.user,{from:'2026-02-30'}),{status:400});assert.throws(()=>f.service.comparison(f.user,{hours:48}),{status:400});
});

test('same public post cannot be counted twice and conflicting frozen copies are excluded',t=>{
  const f=fixture(t),a=f.seed({value:7});f.store.put('socialPublishJobs','duplicate',{...a.job,id:'duplicate'});
  assert.equal(copies(f.service.comparison(f.user))[0].sampleCount,1);assert.equal(f.service.comparison(f.user).excluded.duplicatePublications,1);
  f.store.put('socialPublishJobs','different',{...a.job,id:'different',snapshot:{...a.job.snapshot,variant:{...a.job.snapshot.variant,text:'충돌한 원문'}}});const result=f.service.comparison(f.user);assert.equal(result.groups.length,0);assert.equal(result.excluded.conflictingPublicationCopies,3);
});

test('performance entry channel, canonical post identity and publication time must all match',t=>{
  const f=fixture(t),a=f.seed({value:7});a.entry.url='https://www.instagram.com/reel/TEST1/';assert.equal(observations(f.service.comparison(f.user))[0].value,7);
  a.entry.channelId='private';assert.equal(observations(f.service.comparison(f.user))[0].status,'missing');a.entry.channelId='ch';a.entry.publishedAt='2026-10-12T00:00:00.000Z';assert.equal(observations(f.service.comparison(f.user))[0].status,'excluded');
});

test('current account, full post and source access apply before any copy or original identifier is returned',t=>{
  const f=fixture(t),a=f.seed({body:'공개 범위 문구'});f.seed({channelId:'private',body:'다른 팀 비공개 원문'});
  assert.doesNotMatch(JSON.stringify(f.service.comparison(f.user)),/다른 팀 비공개/);assert.throws(()=>f.service.comparison(f.user,{channelId:'private'}),{status:404});
  f.store.put('channels','ch',{...f.store.get('channels','ch'),ownerIds:[],teamId:'b'});assert.equal(f.service.comparison(f.user).groups.length,0);assert.throws(()=>f.service.templatePreview(f.user,{jobId:a.job.id}),{status:404});
  f.store.put('users',f.user.id,{...f.user,active:false});assert.throws(()=>f.service.comparison(f.user),{status:401});
});

test('revoked source hides historical copy and blocks template reuse even when channel is still readable',t=>{
  const f=fixture(t),a=f.seed({body:'private source text',origin:{productionId:'private-production',versionId:'private-version'}});f.denySource();assert.equal(f.service.comparison(f.user).groups.length,0);assert.throws(()=>f.service.templatePreview(f.user,{jobId:a.job.id}),{status:403});
});

test('first-party statistics stay separate, match frozen links, and reused links have no copy attribution',t=>{
  const f=fixture(t),a=f.seed({body:'링크 https://workspace.test/s/exact'});f.links.push({id:'exact',postId:a.post.id,channelId:'ch',shortUrl:'https://workspace.test/s/exact',label:'합성 링크',stats:{clicks:2,visits:1,browserEvents:{signup:1},verifiedEvents:{signup:0}},active:true});
  let row=observations(f.service.comparison(f.user))[0];assert.equal(row.tracking.status,'link-observations');assert.equal(row.tracking.links[0].stats.browserEvents.signup,1);assert.equal(row.tracking.links[0].stats.verifiedEvents.signup,0);assert.equal(row.value,0);
  f.seed({postId:a.post.id,copyId:'copy-1',body:'다른 문구 https://workspace.test/s/exact',publishedAt:'2026-10-14T00:00:00.000Z'});row=observations(f.service.comparison(f.user,{to:'2026-10-13'}))[0];assert.equal(row.tracking.status,'ambiguous');assert.equal(row.tracking.attributionKnown,false);
  const b=f.seed({body:'https://workspace.test/s/exact-extra'});assert.equal(observations(f.service.comparison(f.user,{postId:b.post.id}))[0].tracking.status,'unlinked');
});

test('selected published copy previews a template only; explicit existing template save remains draft-only',async t=>{
  const f=fixture(t),a=f.seed({body:'채택할 고정 문구',copyId:'copy-2',options:{hashtags:'#연습'}}),before=f.store.all('socialTemplates').length;
  const preview=f.service.templatePreview(f.user,{jobId:a.job.id});assert.equal(preview.post.body,'채택할 고정 문구');assert.equal(preview.post.variants[0].copyVariants.length,0);assert.equal(preview.post.status,undefined);assert.equal(preview.post.approval,undefined);assert.equal(preview.post.recurrence,null);assert.equal(f.store.all('socialTemplates').length,before);
  const saved=await f.workflows.saveTemplate(f.user,{name:'검토 후 선택한 문구',post:preview.post});assert.equal(saved.template.post.variants[0].text,'채택할 고정 문구');assert.equal(f.store.all('socialPosts').length,1);assert.equal(f.store.all('socialPublishJobs').length,1);assert.equal(saved.template.post.approval,undefined);
  assert.throws(()=>f.service.templatePreview(f.viewer,{jobId:a.job.id}),{status:403});
});

test('template preview cannot save revoked media or bypass later permission checks in template API',async t=>{
  const f=fixture(t),a=f.seed({origin:{productionId:'source',versionId:'v1'}}),preview=f.service.templatePreview(f.user,{jobId:a.job.id});f.denySource();await assert.rejects(f.workflows.saveTemplate(f.user,{name:'오래된 제안',post:preview.post}),{status:403});assert.equal(f.store.all('socialTemplates').length,0);
});

test('copied tracking links across different posts or accounts cannot receive false original-copy attribution',t=>{
  const f=fixture(t),a=f.seed({body:'https://workspace.test/s/reused'});f.links.push({id:'reused',postId:a.post.id,channelId:'ch',shortUrl:'https://workspace.test/s/reused',stats:{clicks:30,visits:10,browserEvents:{signup:2},verifiedEvents:{signup:1}}});
  f.seed({channelId:'private',body:'secret copied link https://workspace.test/s/reused'});
  const result=f.service.comparison(f.user);assert.equal(observations(result)[0].tracking.status,'ambiguous');assert.doesNotMatch(JSON.stringify(result),/secret copied link|다른 팀 비공개/);
});

test('missing historical snapshots are excluded instead of substituting current text; cancelled sessions cannot preview',t=>{
  const f=fixture(t),a=f.seed();f.store.put('socialPublishJobs',a.job.id,{...a.job,snapshot:null});const result=f.service.comparison(f.user);assert.equal(result.groups.length,0);assert.equal(result.excluded.missingSnapshot,1);
  assert.throws(()=>f.service.templatePreview(f.user,{jobId:a.job.id},{signal:{aborted:true}}),{status:409});
  assert.throws(()=>f.service.templatePreview(f.user,{jobId:a.job.id},{authorize:()=>f.other}),{status:401});
});

function linked(f,options={}){
  const item=f.seed({body:'고정 문구 https://workspace.test/s/first',...options});
  f.links.push({id:'first',postId:item.post.id,channelId:item.job.channelId,shortUrl:'https://workspace.test/s/first',createdAt:'2026-10-12T00:00:00.000Z',stats:{clicks:999,visits:999,browserEvents:{signup:999},verifiedEvents:{signup:999}}});
  return item;
}
function click(f,id,at,linkId='first'){f.store.put('socialTrackingClicks',id,{id,linkId,createdAt:at});}
function event(f,id,clickId,at,{source='browser',kind='signup',linkId='first'}={}){f.store.put('socialTrackingEvents',id,{id,eventId:id,clickId,linkId,event:kind,source,createdAt:at});}
const value=(f,metric,filter={})=>observations(f.service.comparison(f.user,{metric,...filter}))[0];

test('first-party compares exact completed 24/72-hour windows, never the rolling reference totals',t=>{
  const f=fixture(t);linked(f);click(f,'before','2026-10-12T23:00:00Z');click(f,'in24','2026-10-13T01:00:00Z');click(f,'in72','2026-10-14T01:00:00Z');click(f,'after72','2026-10-16T01:00:00Z');
  event(f,'before-event','before','2026-10-13T02:00:00Z');event(f,'first-event','in24','2026-10-13T02:00:00Z');event(f,'duplicate-kind','in24','2026-10-13T03:00:00Z');event(f,'later-event','in72','2026-10-14T02:00:00Z');
  assert.equal(value(f,'linkClicks').value,1);assert.equal(value(f,'linkClicks',{hours:'72'}).value,2);assert.equal(value(f,'browserSignup').value,1);assert.equal(value(f,'browserSignup',{hours:72}).value,2);
  assert.equal(value(f,'browserSignup').tracking.links[0].stats.browserEvents.signup,999);assert.equal(value(f,'browserSignup').windowTo,'2026-10-14T00:00:00.000Z');assert.equal(value(f,'browserSignup').observedAt,null);assert.equal(value(f,'browserSignup').lastEventAt,'2026-10-13T03:00:00Z');
});

test('site visits, browser reports and verified completions retain separate source and deduplication',t=>{
  const f=fixture(t);linked(f);click(f,'one','2026-10-13T01:00:00Z');click(f,'two','2026-10-13T02:00:00Z');
  event(f,'visit','one','2026-10-13T01:01:00Z',{kind:'visit'});event(f,'visit-again','one','2026-10-13T01:02:00Z',{kind:'visit'});event(f,'signup','one','2026-10-13T03:00:00Z');event(f,'verified','two','2026-10-13T03:00:00Z',{source:'verified'});event(f,'verified-again','two','2026-10-13T04:00:00Z',{source:'verified'});
  assert.equal(value(f,'siteVisits').value,1);assert.equal(value(f,'browserSignup').value,1);assert.equal(value(f,'verifiedSignup').value,1);assert.notEqual(value(f,'browserSignup').source,value(f,'verifiedSignup').source);assert.equal(value(f,'browserInquiry').value,null);assert.equal(value(f,'verifiedInquiry').value,null);
  assert.equal(value(f,'browserTrial').value,null);assert.equal(value(f,'verifiedTrial').value,null);
});

test('unfinished windows, retention boundaries and unobserved instrumentation stay unknown instead of zero',t=>{
  const f=fixture(t);linked(f);assert.equal(value(f,'linkClicks').value,0);assert.equal(value(f,'browserSignup').value,null);assert.match(value(f,'browserSignup').reason,/연결/);assert.equal(value(f,'verifiedSignup').value,null);
  f.setTime('2026-10-13T23:59:59.000Z');assert.equal(value(f,'linkClicks').value,null);assert.match(value(f,'linkClicks').reason,/끝나지/);
  f.setTime('2027-01-12T00:00:00.000Z');assert.equal(value(f,'linkClicks').value,null);assert.match(value(f,'linkClicks').reason,/보존/);
});

test('shared links outside filters, mismatched ownership and late-created links are excluded from copy metrics',t=>{
  const f=fixture(t),a=linked(f);click(f,'one','2026-10-13T01:00:00Z');
  f.seed({postId:a.post.id,copyId:'copy-1',body:'재사용 https://workspace.test/s/first',publishedAt:'2026-10-18T00:00:00Z'});assert.equal(value(f,'linkClicks',{to:'2026-10-14'}).status,'excluded');
  const other=fixture(t);linked(other);other.links[0].postId='wrong';assert.equal(value(other,'linkClicks').status,'excluded');other.links[0].postId=other.store.all('socialPosts')[0].id;other.links[0].createdAt='2026-10-13T01:00:00Z';assert.equal(value(other,'linkClicks').status,'excluded');
});

test('foreign clicks, spoofed source and impossible event chronology never inflate or establish conversion counts',t=>{
  const f=fixture(t);linked(f);click(f,'one','2026-10-13T01:00:00Z');click(f,'foreign','2026-10-13T01:00:00Z','private-link');
  event(f,'spoof','one','2026-10-13T02:00:00Z',{source:'client:verified'});event(f,'foreign-click','foreign','2026-10-13T02:00:00Z',{source:'verified'});event(f,'future-click','one','2026-10-13T00:00:00Z',{source:'verified'});event(f,'unsupported','one','2026-10-13T02:00:00Z',{source:'verified',kind:'fake'});
  assert.equal(value(f,'verifiedSignup').value,null);event(f,'real-inquiry','one','2026-10-13T03:00:00Z',{source:'verified',kind:'inquiry'});assert.equal(value(f,'verifiedSignup').value,null);assert.equal(value(f,'verifiedInquiry').value,1);
});

test('real tracking storage produces the same comparison without exposing click IDs or signing keys',t=>{
  const f=fixture(t),admin=f.store.createUser({email:'admin@copy.test',name:'합성 관리자',role:'admin'}),a=f.seed(),origin='https://workspace.test';
  f.setTime('2026-10-12T00:00:00Z');const tracking=createSocialTracking({store:f.store,publishing:f.publishing,clock:f.clock,origin});tracking.configure(admin,{enabled:true,allowedOrigins:['https://site.test']});const link=tracking.createLink(f.user,{postId:a.post.id,channelId:'ch',destination:'https://site.test/start'}).link;
  f.store.put('socialPublishJobs',a.job.id,{...a.job,snapshot:{...a.job.snapshot,variant:{...a.job.snapshot.variant,text:'명시적 링크 '+link.shortUrl}}});const service=createSocialVariantPerformanceService({...f,tracking,performance:{list:()=>({entries:f.entries})},validatePostInput:f.validatePostInput});
  f.setTime('2026-10-13T01:00:00Z');const hit=tracking.click(link.id);tracking.event({clickId:hit.clickId,eventId:'visit',event:'visit'},{origin:'https://site.test'});const key=tracking.rotateKey(admin,{rotate:true}).key,input={clickId:hit.clickId,eventId:'signup',event:'signup'},timestamp=String(Date.parse(f.clock())),signature=createHmac('sha256',key).update(socialTrackingSignaturePayload(timestamp,input)).digest('hex');tracking.event(input,{verified:true,timestamp,signature});
  f.setTime('2026-10-15T00:00:00Z');const result=service.comparison(f.user,{metric:'verifiedSignup'});assert.equal(observations(result)[0].value,1);assert.doesNotMatch(JSON.stringify(result),new RegExp(hit.clickId+'|'+key));assert.equal(observations(service.comparison(f.user,{metric:'browserSignup'}))[0].value,null);
});

test('zero conversion requires the same event kind and source to have been observed for each link',t=>{
  const f=fixture(t);linked(f);click(f,'prior','2026-10-12T12:00:00Z');
  event(f,'prior-inquiry','prior','2026-10-12T13:00:00Z',{source:'verified',kind:'inquiry'});
  assert.equal(value(f,'verifiedInquiry').value,0);assert.equal(value(f,'verifiedInquiry').status,'measured');
  assert.equal(value(f,'verifiedSignup').value,null);assert.equal(value(f,'browserInquiry').value,null);
  assert.match(value(f,'verifiedSignup').reason,/해당 종류/);
});

test('three unique verified links to the exact same destination count as one copy while retaining each frozen original',t=>{
  const f=fixture(t);let postId;
  for(let index=1;index<=3;index++){
    const shortUrl='https://workspace.test/s/copy'+index,item=f.seed({postId,body:'같은 안내 '+shortUrl,copyId:'local-copy-'+index,options:{link:shortUrl}});postId=item.post.id;
    f.links.push({id:'copy'+index,postId,channelId:'ch',shortUrl,destination:'https://site.test/start?utm_campaign=same#lesson',createdAt:'2026-10-12T00:00:00Z',stats:{clicks:1}});click(f,'click'+index,'2026-10-13T01:00:00Z','copy'+index);
  }
  const result=f.service.comparison(f.user,{metric:'linkClicks'}),row=copies(result)[0];assert.equal(result.groups.length,1);assert.equal(copies(result).length,1);assert.equal(row.sampleCount,3);assert.equal(row.median,1);assert.equal(row.status,'observed');assert.equal(row.copyIds.length,3);assert.equal(new Set(row.observations.map(observation=>observation.copy.fingerprint)).size,3);assert.ok(row.observations.every(observation=>observation.copy.text.includes('/s/copy')));
});

test('changed copy, destination, UTM or external URLs are not erased by comparison normalization',t=>{
  const f=fixture(t),source={packageId:'same-package'};
  const add=(id,body,destination,options={})=>{const url='https://workspace.test/s/'+id,item=f.seed({body:body+' '+url,origin:source,...options});f.links.push({id,postId:item.post.id,channelId:'ch',shortUrl:url,destination,createdAt:'2026-10-12T00:00:00Z',stats:{}});return item;};
  add('a','안내','https://site.test/start?utm_content=a');add('b','안내','https://site.test/start?utm_content=a',{copyId:'different-local-id'});add('c','다른 안내','https://site.test/start?utm_content=a');add('d','안내','https://site.test/other?utm_content=a');add('e','안내','https://site.test/start?utm_content=b');
  const rows=copies(f.service.comparison(f.user));assert.equal(rows.length,4);assert.equal(rows.find(row=>row.sampleCount===2).copyIds.length,2);
  const first=f.seed({body:'안내 https://external.test/s/a'});f.seed({postId:first.post.id,body:'안내 https://external.test/s/b'});assert.equal(copies(f.service.comparison(f.user,{postId:first.post.id})).length,2);
});

test('date-only filters cover the entire Korean calendar day while explicit zones keep their instant',t=>{
  const f=fixture(t);
  f.seed({body:'전날 끝',publishedAt:'2026-10-12T14:59:59.999Z'});
  f.seed({body:'한국 자정',publishedAt:'2026-10-12T15:00:00.000Z'});
  f.seed({body:'한국 오후',publishedAt:'2026-10-13T14:59:59.999Z'});
  f.seed({body:'다음날 시작',publishedAt:'2026-10-13T15:00:00.000Z'});
  const result=f.service.comparison(f.user,{from:'2026-10-13',to:'2026-10-13'});
  assert.equal(result.filters.from,'2026-10-12T15:00:00.000Z');assert.equal(result.filters.to,'2026-10-13T14:59:59.999Z');
  assert.deepEqual(new Set(copies(result).map(row=>row.text)),new Set(['한국 자정','한국 오후']));
  const explicit=f.service.comparison(f.user,{from:'2026-10-13T00:00:00Z',to:'2026-10-13T00:00:00-04:00'});
  assert.equal(explicit.filters.from,'2026-10-13T00:00:00.000Z');assert.equal(explicit.filters.to,'2026-10-13T04:00:00.000Z');assert.equal(explicit.groups.length,0);
});

test('tracking-linked template proposals keep the exact record and explain replacing the link for the next post',t=>{
  const f=fixture(t),a=linked(f),before=f.links.length;
  const proposal=f.service.templatePreview(f.user,{jobId:a.job.id});
  assert.equal(proposal.post.body,a.job.snapshot.variant.text);assert.match(proposal.notice,/기록 당시 추적 링크가 그대로/);assert.match(proposal.notice,/추적 링크를 새로 만들어/);assert.equal(f.links.length,before);assert.equal(f.store.all('socialTemplates').length,0);
  const ordinary=f.seed({body:'외부 링크 https://other.test/'});assert.doesNotMatch(f.service.templatePreview(f.user,{jobId:ordinary.job.id}).notice,/추적 링크를 새로/);
});
