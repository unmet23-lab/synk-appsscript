import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHmac} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {socialTrackingSignaturePayload} from './social-tracking.mjs';

async function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-six-http-'));let at='2026-10-13T00:00:00.000Z',sent=0;
  const provider={settings:()=>({configured:true,integrations:[]}),capability:()=>({mode:'automatic',canPublish:true,formats:['text'],maxTextLength:5000}),publish:async()=>({status:'published',providerId:'fixture-'+(++sent),publicationUrl:'https://www.instagram.com/p/FIXTURE'+sent+'/',publishedAt:at}),status:async()=>({status:'unknown'})};
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'http://127.0.0.1:4191',schedule:false,socialProvider:provider,clock:()=>at,synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({email:'admin@six.test',name:'합성 관리자',role:'admin'}),writer=app.store.createUser({email:'writer@six.test',name:'합성 작성자',role:'member',teamId:'a'}),other=app.store.createUser({email:'other@six.test',name:'다른 팀',role:'member',teamId:'b'});
  app.store.put('channels','ig',{id:'ig',displayName:'시험 Instagram',platform:'instagram',handle:'fixture',ownerIds:[writer.id],teamId:'a',active:true});
  const tokens=new Map([admin,writer,other].map(u=>[u.id,app.store.mint('session',u.id,{csrfToken:'test-csrf'},60)]));await app.start();const base='http://127.0.0.1:'+app.server.address().port;
  async function api(user,path,input,headers={}){const r=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'test-csrf',...(input===undefined?{}:{'Content-Type':'application/json'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:r.status,data:await r.json()};}
  const draft={title:'검증 원고',body:'공통 본문',category:'news',variants:[{channelId:'ig',format:'text',title:'계정 제목',text:'승인할 본문'}]};
  async function post(){const r=await api(writer,'/api/social/posts',draft);assert.equal(r.status,200,JSON.stringify(r.data));return r.data.post;}
  async function publicApi(path,input,headers={}){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(input)});return {status:r.status,headers:r.headers,data:await r.json()};}
  return {app,base,admin,writer,other,api,publicApi,draft,post,now:()=>at,sent:()=>sent,advance(ms){at=new Date(Date.parse(at)+ms).toISOString();}};
}

test('HTTP autosave is private and encrypted, survives reload, detects stale tabs and never approves',async t=>{
  const f=await fixture(t),post=await f.post(),input={draftKey:'working-copy',postId:post.id,baseRevision:post.revision,revision:0,draft:{...f.draft,body:'미완성 비공개 문장'}};
  assert.equal((await f.api(f.writer,'/api/social/recovery/save',input,{'X-CSRF-Token':'bad'})).status,403);
  const saved=await f.api(f.writer,'/api/social/recovery/save',input);assert.equal(saved.status,200);assert.equal(saved.data.recovery.revision,1);
  assert.equal((await f.api(f.writer,'/api/social/recovery/save',input)).status,409);
  const mine=(await f.api(f.writer,'/api/social/workspace')).data,other=(await f.api(f.other,'/api/social/workspace')).data;
  assert.equal(mine.recovery.drafts[0].draft.body,input.draft.body);assert.equal(other.recovery.drafts.length,0);assert.ok(!JSON.stringify(f.app.store.all('socialRecoveryDrafts')).includes(input.draft.body));
  assert.equal(f.app.store.get('socialPosts',post.id).body,f.draft.body);assert.equal(f.app.store.all('socialPublishJobs').length,0);
  await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision});assert.equal((await f.api(f.writer,'/api/social/recovery')).data.drafts[0].conflict,true);
  assert.equal((await f.api(f.writer,'/api/social/recovery/discard',{draftKey:'working-copy',revision:1})).status,200);assert.equal((await f.api(f.writer,'/api/social/recovery')).data.drafts.length,0);
});

test('HTTP templates and bulk workflows preview without writes, then apply once using current roles',async t=>{
  const f=await fixture(t),a=await f.post(),b=await f.post();
  let r=await f.api(f.writer,'/api/social/templates',{name:'뉴스 기본 원고',postId:a.id});assert.equal(r.status,200);const template=r.data.template;
  r=await f.api(f.writer,'/api/social/templates/preview',{templateId:template.id});assert.equal(r.status,200);const templatePlan=r.data;assert.equal(f.app.store.all('socialPosts').length,2);
  assert.equal((await f.api(f.writer,'/api/social/workflow/apply',{previewId:templatePlan.previewId,confirmed:true})).status,200);
  assert.equal((await f.api(f.writer,'/api/social/workflow/apply',{previewId:templatePlan.previewId,confirmed:true})).data.existing,true);assert.equal(f.app.store.all('socialPosts').length,3);
  r=await f.api(f.writer,'/api/social/workflow/preview',{action:'edit',postIds:[a.id,b.id],patch:{body:'일괄 바뀐 본문'},syncCommonText:true});assert.equal(r.status,200);assert.equal(r.data.validCount,2);assert.equal(f.app.store.get('socialPosts',a.id).body,f.draft.body);
  assert.equal((await f.api(f.writer,'/api/social/workflow/apply',{previewId:r.data.previewId,confirmed:true})).status,200);assert.equal(f.app.store.get('socialPosts',b.id).variants[0].text,'일괄 바뀐 본문');
  r=await f.api(f.writer,'/api/social/workflow/preview',{action:'approve',postIds:[a.id,b.id]});assert.equal(r.data.validCount,0);
  r=await f.api(f.admin,'/api/social/workflow/preview',{action:'approve',postIds:[a.id,b.id]});assert.equal(r.data.validCount,2);assert.equal(f.app.store.all('socialReviewApprovals').length,0);
  assert.equal((await f.api(f.admin,'/api/social/workflow/apply',{previewId:r.data.previewId,confirmed:true})).status,200);
  assert.equal((await f.api(f.other,'/api/social/workspace')).data.workflows.templates.length,0);assert.equal(f.sent(),0);
});

test('HTTP local-only recovery inspection checks current account and private media access without saving',async t=>{
  const f=await fixture(t),input={postId:null,draft:f.draft};
  assert.equal((await f.api(f.writer,'/api/social/recovery/check',input)).status,200);assert.equal(f.app.store.all('socialRecoveryDrafts').length,0);assert.equal(f.app.store.all('socialPosts').length,0);
  f.app.store.put('socialMedia','private-file',{id:'private-file',ownerId:f.other.id,mimeType:'image/png',fileName:'private.png',byteSize:10});
  assert.equal((await f.api(f.writer,'/api/social/recovery/check',{postId:null,draft:{...f.draft,media:[{assetId:'private-file'}]}})).status,403);
  f.app.store.put('channels','ig',{...f.app.store.get('channels','ig'),ownerIds:[]});assert.equal((await f.api(f.writer,'/api/social/recovery/check',input)).status,403);assert.equal(f.app.store.all('socialRecoveryDrafts').length,0);
});

test('HTTP required external review gates scheduled send, exposes only its snapshot, and preserves approval diff',async t=>{
  const f=await fixture(t);let post=await f.post();post=(await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision})).data.post;
  const scheduled=await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt:'2026-10-13T00:01:00Z'});assert.equal(scheduled.status,200);
  let r=await f.api(f.writer,`/api/social/posts/${post.id}/review-links`,{revision:post.revision,label:'외부 검토'});assert.equal(r.status,200,JSON.stringify(r.data));const token=new URL(r.data.url).hash.split('=')[1],headers={Origin:f.app.origin,Authorization:'Bearer '+token};
  assert.equal((await f.publicApi('/api/social-review/open',{}, {...headers,Origin:'https://other.test'})).status,403);
  const opened=await f.publicApi('/api/social-review/open',{},headers);assert.equal(opened.status,200);assert.equal(opened.data.review.snapshot.variants[0].text,f.draft.variants[0].text);assert.ok(!JSON.stringify(opened.data).includes(post.id));assert.ok(!JSON.stringify(opened.data).includes(f.writer.id));
  f.advance(60000);await f.app.scanSocialPublishing();assert.equal(f.sent(),0);assert.equal(f.app.store.all('socialPublishJobs')[0].status,'scheduled');
  r=await f.publicApi('/api/social-review/respond',{revision:opened.data.review.revision,requestId:'review-approved-1',decision:'approve',name:'검토 고객'},headers);assert.equal(r.status,200,JSON.stringify(r.data));
  await f.app.scanSocialPublishing();assert.equal(f.sent(),1);const workspace=(await f.api(f.admin,'/api/social/workspace')).data;assert.equal(workspace.insights.records[0].title,'계정 제목');
  post=f.app.socialPublishing.get(f.writer,post.id).post;r=await f.api(f.writer,`/api/social/posts/${post.id}`,{...post,body:'승인 뒤 변경'});assert.equal(r.status,200);
  const comparison=(await f.api(f.writer,`/api/social/posts/${post.id}/review`)).data.comparison;assert.ok(comparison.changes.some(row=>row.field==='body'));assert.equal((await f.publicApi('/api/social-review/open',{},headers)).status,410);
});

test('HTTP first-party attribution requires exact CORS origin and HMAC server proof, with no fabricated conversions',async t=>{
  const f=await fixture(t),post=await f.post(),config={enabled:true,allowedOrigins:['https://destination.test'],revision:0};
  assert.equal((await f.api(f.writer,'/api/social/tracking/configure',config)).status,403);assert.equal((await f.api(f.admin,'/api/social/tracking/configure',config)).status,200);
  const made=await f.api(f.writer,'/api/social/tracking/links',{postId:post.id,channelId:'ig',destination:'https://destination.test/course?utm_campaign=news#start'});assert.equal(made.status,200);const link=made.data.link,path=new URL(link.shortUrl).pathname;
  const head=await fetch(f.base+path,{method:'HEAD',redirect:'manual'});assert.equal(head.status,302);assert.equal(f.app.store.all('socialTrackingClicks').length,0);
  const redirect=await fetch(f.base+path,{redirect:'manual'});assert.equal(redirect.status,302);const target=new URL(redirect.headers.get('location')),clickId=target.searchParams.get('synk_ref');assert.equal(target.hash,'#start');assert.equal(target.searchParams.get('utm_campaign'),'news');
  const preflight=await fetch(f.base+'/social-track/event',{method:'OPTIONS',headers:{Origin:'https://destination.test','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://destination.test');assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
  const visit={clickId,eventId:'visit-one',event:'visit'};assert.equal((await f.publicApi('/social-track/event',visit,{Origin:'https://other.test'})).status,403);
  const r=await f.publicApi('/social-track/event',visit,{Origin:'https://destination.test'});assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'https://destination.test');
  await f.publicApi('/social-track/event',{clickId,eventId:'browser-signup',event:'signup'},{Origin:'https://destination.test'});
  let totals=(await f.api(f.writer,'/api/social/workspace')).data.tracking.totals;assert.equal(totals.clicks,1);assert.equal(totals.visits,1);assert.equal(totals.browserEvents.signup,1);assert.equal(totals.verifiedEvents.signup,null);
  const key=(await f.api(f.admin,'/api/social/tracking/key',{rotate:true})).data.key,input={clickId,eventId:'server-signup',event:'signup'},timestamp=String(Date.parse(f.now())),signature=createHmac('sha256',key).update(socialTrackingSignaturePayload(timestamp,input)).digest('hex');
  assert.equal((await f.publicApi('/social-track/verified',input,{'X-Synk-Timestamp':timestamp,'X-Synk-Signature':'a'.repeat(64)})).status,401);
  assert.equal((await f.publicApi('/social-track/verified',input,{'X-Synk-Timestamp':timestamp,'X-Synk-Signature':signature})).status,200);
  assert.equal((await f.publicApi('/social-track/verified',input,{'X-Synk-Timestamp':timestamp,'X-Synk-Signature':signature})).data.duplicate,true);
  const view=(await f.api(f.admin,'/api/social/workspace')).data;totals=view.tracking.totals;assert.equal(totals.verifiedEvents.signup,1);assert.ok(!JSON.stringify(view).includes(key));assert.equal((await f.api(f.other,'/api/social/workspace')).data.tracking.links.length,0);
  assert.equal((await f.publicApi('/social-track/event',{...visit,email:'forbidden@example.test'},{Origin:'https://destination.test'})).status,400);
});

test('public review and attribution assets are served without a company session under restrictive response headers',async t=>{
  const f=await fixture(t);
  for(const path of ['/social-review','/social-review.js','/social-review.css','/social-tracking.js']){const r=await fetch(f.base+path);assert.equal(r.status,200,path);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok((await r.text()).length>100);}
  assert.equal((await fetch(f.base+'/api/social/recovery')).status,401);assert.equal((await f.publicApi('/api/social-review/open',{}, {Origin:f.app.origin})).status,401);
});
