import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {createSocialProvider} from './social-provider.mjs';

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
async function fixture(t,{platform='threads',inboxFetch}={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-bridge-'));let at='2026-10-13T00:00:00.000Z',mode='ok',onUpload;
  const calls=[],posts=[],integration={id:'linked-account',identifier:platform,profile:'synk',name:'SYNK 합성 계정',disabled:false};
  const fakeFetch=async(url,init)=>{
    calls.push({url,init});if(url.endsWith('/me'))return json({organization:{id:'test-org',name:'검증용'},user:null});if(url.endsWith('/integrations'))return json([integration]);
    if(url.endsWith('/upload')){await onUpload?.();return json({id:'uploaded-asset',path:'https://uploads.postiz.com/synthetic.png'});}
    if(url.endsWith('/upload-from-url'))return json({id:'uploaded-url',path:'https://uploads.postiz.com/synthetic.png'});
    if(url.endsWith('/posts')&&init.method==='POST'){const data=JSON.parse(init.body);posts.push({id:'post-'+posts.length,content:data.posts[0].value[0].content,integration:{id:integration.id},state:'PUBLISHED',publishDate:at,releaseURL:platform==='youtube'?'https://www.youtube.com/watch?v=abcdefghijk':'https://www.threads.com/@synk/post/SYNK123'});if(mode==='unknown')throw Error('synthetic timeout');return json([{postId:posts.at(-1).id,integration:integration.id}]);}
    if(url.includes('/posts?'))return json({posts});throw Error('Unexpected fake endpoint');
  };
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'http://127.0.0.1:4191',schedule:false,clock:()=>at,socialProviderFactory:createSocialProvider,socialProviderOptions:{fetchImpl:fakeFetch},socialInboxOptions:{fetchImpl:inboxFetch||(()=>{throw Error('Unexpected fake Meta endpoint');}),getCredentials:async channel=>app.store.secret('channel:'+channel.id)},synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({email:'admin@bridge.test',name:'검증용 관리자',role:'admin'}),member=app.store.createUser({email:'member@bridge.test',name:'검증용 작성자',role:'member',teamId:'a'}),outsider=app.store.createUser({email:'outsider@bridge.test',name:'다른 팀',role:'member',teamId:'b'});
  app.store.put('channels','test-channel',{id:'test-channel',platform,handle:'synk',displayName:'검증용 계정',ownerIds:[member.id],teamId:'a',active:true});
  const tokens=new Map([admin,member,outsider].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'test-csrf'},60)]));await app.start();const origin='http://127.0.0.1:'+app.server.address().port;
  async function api(user,path,input){const result=await fetch(origin+path,{method:input===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'test-csrf',...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:result.status,data:await result.json()};}
  const configured=await api(admin,'/api/social/provider/configure',{apiKey:'synthetic-bridge-secret'});assert.equal(configured.status,200);assert.equal((await api(admin,'/api/social/provider/connect',{channelId:'test-channel',integrationId:integration.id})).status,200);
  async function prepare(variant={format:'post'}){let r=await api(member,'/api/social/posts',{title:'통합 발행 시험',body:'확정한 게시문',variants:[{channelId:'test-channel',...variant}]});assert.equal(r.status,200,JSON.stringify(r.data));let post=r.data.post;r=await api(admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision});assert.equal(r.status,200,JSON.stringify(r.data));post=r.data.post;r=await api(admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt:at,timezone:'Asia/Seoul'});assert.equal(r.status,200,JSON.stringify(r.data));return {post,job:r.data.jobs[0]};}
  function asset(){const id=randomUUID(),diskName=id+'.png';mkdirSync(join(directory,'studio-media'),{recursive:true});writeFileSync(join(directory,'studio-media',diskName),PNG);const row={id,ownerId:member.id,teamId:'a',diskName,fileName:'synthetic.png',mimeType:'image/png',byteSize:PNG.length,sha256:createHash('sha256').update(PNG).digest('hex'),width:1,height:1};app.store.put('socialMedia',id,row);return {assetId:id,url:'/api/social/media/'+id,type:'image'};}
  return {app,admin,member,outsider,api,prepare,asset,calls,posts,setMode:value=>{mode=value;},onUpload:value=>{onUpload=value;},advance:ms=>{at=new Date(Date.parse(at)+ms).toISOString();}};
}

test('real routes, core and bridge publish the core default post format and keep actual time unconfirmed',async t=>{
  const f=await fixture(t),{job}=await f.prepare();await f.app.scanSocialPublishing();assert.equal(f.posts.length,1);let row=f.app.store.get('socialPublishJobs',job.id);assert.equal(row.status,'accepted');assert.equal(row.providerId,'post-0');assert.equal(row.publishedAt,null);
  const response=await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'reconcile'});assert.equal(response.status,200);row=response.data.job;assert.equal(row.status,'published');assert.equal(row.publishedAt,null);assert.equal(row.publicVerifiedAt,null);assert.equal(f.app.store.all('postPerformanceEntries').length,0);
  assert.equal((await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'manual_complete',publicationUrl:'https://www.threads.com/@synk/post/SYNK123',publishedAt:'2026-10-13T00:00:00Z'})).status,200);assert.equal(f.app.store.all('postPerformanceEntries').length,1);
  const view=(await f.api(f.member,'/api/social/workspace')).data;assert.equal(view.channels[0].capability.canPublish,true);assert.ok(!JSON.stringify(view).includes('synthetic-bridge-secret'));assert.equal(view.provider.baseUrl,undefined);assert.equal((await f.api(f.outsider,'/api/social/workspace')).data.provider.integrations.length,0);
});
test('real private-media resolver feeds multipart upload; foreign media and media changes are rejected',async t=>{
  const f=await fixture(t),media=f.asset(),{job}=await f.prepare({format:'image',media:[media],options:{firstComment:'검토한 첫 댓글',hashtags:'#SYNK'}});await f.app.scanSocialPublishing();assert.equal(f.app.store.get('socialPublishJobs',job.id).status,'accepted');assert.equal(f.posts.length,1);
  const upload=f.calls.find(call=>call.url.endsWith('/upload'));assert.ok(upload.init.body instanceof FormData);const body=JSON.parse(f.calls.find(call=>call.url.endsWith('/posts')).init.body);assert.equal(body.posts[0].value[0].image[0].id,'uploaded-asset');assert.equal(body.posts[0].value[1].content,'검토한 첫 댓글');assert.ok(!f.calls.some(call=>call.url.includes('/api/social/media/')));
  assert.equal((await f.api(f.outsider,'/api/social/posts',{title:'비공개 미디어',body:'',media:[media],variants:[]})).status,403);
});
test('unknown submission cannot resend, and explicit verified provider ID reconciles through HTTP',async t=>{
  const f=await fixture(t),{job}=await f.prepare();f.setMode('unknown');await f.app.scanSocialPublishing();assert.equal(f.app.store.get('socialPublishJobs',job.id).status,'unknown');assert.equal(f.posts.length,1);
  assert.equal((await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'publish_now'})).status,409);await f.app.scanSocialPublishing();assert.equal(f.posts.length,1);
  assert.equal((await f.api(f.member,'/api/social/provider/reconcile',{jobId:job.id,providerId:'post-0'})).status,403);
  const result=await f.api(f.admin,'/api/social/provider/reconcile',{jobId:job.id,providerId:'post-0'});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(f.app.store.get('socialPublishJobs',job.id).status,'published');assert.equal(f.posts.length,1);
});
test('remapping after approval blocks the existing reservation instead of publishing to a new binding',async t=>{
  const f=await fixture(t),{job}=await f.prepare();assert.equal((await f.api(f.admin,'/api/social/provider/connect',{channelId:'test-channel',integrationId:'linked-account'})).status,200);await f.app.scanSocialPublishing();assert.equal(f.posts.length,0);assert.equal(f.app.store.get('socialPublishJobs',job.id).errorCode,'PERMISSION_OR_VERSION_CHANGED');
});
test('emergency pause during multipart upload is checked before the external create request',async t=>{
  const f=await fixture(t),media=f.asset(),{job}=await f.prepare({format:'image',media:[media]});f.onUpload(()=>{f.app.store.put('socialPublishSettings','global',{paused:true});});await f.app.scanSocialPublishing();assert.equal(f.posts.length,0);assert.equal(f.app.store.get('socialPublishJobs',job.id).status,'failed');
});

test('HTTP approval blocks provider-invalid media while an explicit manual workflow remains available',async t=>{
  const f=await fixture(t),media={url:'https://cdn.example.test/video.webm',type:'video',mimeType:'video/webm'};
  const created=await f.api(f.member,'/api/social/posts',{title:'WebM 검토',body:'영상',variants:[{channelId:'test-channel',format:'video',media:[media]}]});assert.equal(created.status,200);const post=created.data.post;
  const refused=await f.api(f.admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision});assert.equal(refused.status,400);assert.match(JSON.stringify(refused.data),/WebM|MP4/);
  const manual=await f.prepare({format:'video',media:[media],options:{notifyOnly:true}});await f.app.scanSocialPublishing();assert.equal(f.app.store.get('socialPublishJobs',manual.job.id).status,'manual');assert.equal(f.posts.length,0);
});

test('real inbox routes expose scope state, import native comments and preserve assignment edits',async t=>{
  const metaCalls=[],inboxFetch=async(url,init)=>{metaCalls.push({url,init});const path=new URL(url).pathname;if(path.endsWith('/me'))return json({id:'100',username:'synk'});if(path.endsWith('/100/media'))return json({data:[{id:'200',permalink:'https://www.instagram.com/p/SYNK1/'}]});if(path.endsWith('/200/comments'))return json({data:[{id:'300',text:'자동 수집 문의',timestamp:'2026-10-13T00:00:00Z',username:'reader'}]});if(path.endsWith('/300/replies'))return json({data:[]});throw Error('Unexpected fake Graph endpoint');};
  const f=await fixture(t,{platform:'instagram',inboxFetch});f.app.store.setSecret('channel:test-channel',{accessToken:'synthetic-inbox-secret',authType:'instagram-login',apiVersion:'v26.0',scope:'instagram_business_basic instagram_business_manage_comments'});
  assert.equal((await f.api(f.member,'/api/social/inbox/provider/configure',{channelId:'test-channel',enabled:true})).status,403);
  const configured=await f.api(f.admin,'/api/social/inbox/provider/configure',{channelId:'test-channel',enabled:true});assert.equal(configured.status,200);assert.equal(configured.data.available,true);
  const before=(await f.api(f.member,'/api/social/workspace')).data;assert.equal(before.inboxProvider.channels[0].canSync,true);assert.equal(before.inboxProvider.supports.directMessages,false);assert.ok(!JSON.stringify(before).includes('synthetic-inbox-secret'));assert.deepEqual((await f.api(f.outsider,'/api/social/workspace')).data.inboxProvider.channels,[]);
  const first=await f.api(f.member,'/api/social/inbox/provider/sync',{channelId:'test-channel'});assert.equal(first.status,200,JSON.stringify(first.data));assert.equal(first.data.imported,1);
  const inbox=(await f.api(f.member,'/api/social/workspace')).data.inbox,item=inbox[0];assert.equal(item.source,'api:instagram');assert.equal(item.nativePostId,'200');
  const edit=await f.api(f.member,'/api/social/inbox/'+item.id,{revision:item.revision,status:'resolved',assigneeId:f.admin.id,replyDraft:'검토 중'});assert.equal(edit.status,200,JSON.stringify(edit.data));assert.equal(edit.data.item.source,'api:instagram');
  const repeat=await f.api(f.member,'/api/social/inbox/provider/sync',{channelId:'test-channel'});assert.equal(repeat.status,200);assert.equal(repeat.data.imported,0);const saved=(await f.api(f.member,'/api/social/workspace')).data.inbox[0];assert.equal(saved.status,'resolved');assert.equal(saved.replyDraft,'검토 중');assert.equal(saved.externalId,'300');assert.ok(metaCalls.every(call=>call.init.method==='GET'));assert.equal(f.posts.length,0);
});
