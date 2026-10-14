import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';

let JPEG,MP4,mediaDirectory;
before(()=>{
  mediaDirectory=mkdtempSync(join(tmpdir(),'synk-direct-media-fixture-'));
  const run=args=>execFileSync(process.env.SYNK_FFMPEG_EXE||'ffmpeg',['-hide_banner','-loglevel','error',...args],{windowsHide:true,timeout:30000});
  run(['-f','lavfi','-i','color=c=black:s=1080x1350','-frames:v','1','-threads','1',join(mediaDirectory,'image.jpg')]);
  run(['-f','lavfi','-i','color=c=black:s=360x640:r=5:d=3','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-threads','1',join(mediaDirectory,'video.mp4')]);
  JPEG=readFileSync(join(mediaDirectory,'image.jpg'));MP4=readFileSync(join(mediaDirectory,'video.mp4'));
});
after(()=>{if(mediaDirectory){assert.equal(dirname(resolve(mediaDirectory)),resolve(tmpdir()));rmSync(mediaDirectory,{recursive:true,force:true});}});
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json',...headers}});
async function fixture(t,{platform='instagram'}={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-direct-http-')),calls=[],grants=[];let at='2026-10-14T10:00:00.000Z',base,ready=true,uncertain=false,hook;
  const channelId=platform==='youtube'?'UCabcdefghijklmnopqrstuv':'100';
  const fakeFetch=async(raw,init={})=>{
    const url=new URL(raw),path=url.pathname.replace(/^\/v[\d.]+\//,''),params=new URLSearchParams(typeof init.body==='string'||init.body instanceof URLSearchParams?init.body:undefined);calls.push({path,method:init.method||'GET'});const intercepted=await hook?.({path,init});if(intercepted)return intercepted;
    if(path==='me'||path==='100')return json(platform==='instagram'?{id:'101',user_id:'100',username:'synk'}:{id:'100',name:'SYNK'});
    if(path==='100/media'||path==='100/photos'){
      const uri=params.get('image_url')||params.get('video_url')||params.get('url');assert.ok(uri?.startsWith('https://workspace.synk.im/social-publish-media/'));grants.push(uri);
      const file=await fetch(base+new URL(uri).pathname);assert.equal(file.status,200);assert.deepEqual(Buffer.from(await file.arrayBuffer()),platform==='instagram'&&params.get('media_type')==='REELS'?MP4:JPEG);
      return path==='100/photos'?json({id:'800',post_id:'100_700'}):json({id:'601'});
    }
    if(path==='601')return json({id:'601',status_code:ready?'FINISHED':'IN_PROGRESS'});
    if(path==='100/media_publish'||path==='100/feed'){if(uncertain)throw Error('synthetic response lost');return json({id:path==='100/feed'?'100_700':'700'});}
    if(path==='700')return json({id:'700',owner:{id:'101'},caption:'확정한 게시문',permalink:'https://www.instagram.com/p/SYNK123/',timestamp:at});
    if(path==='100_700')return json({id:'100_700',from:{id:'100'},message:'확정한 게시문',is_published:true,permalink_url:'https://www.facebook.com/100/posts/700',created_time:at});
    if(url.pathname==='/youtube/v3/channels')return json({items:[{id:channelId}]});
    if(url.pathname==='/upload/youtube/v3/videos'&&init.method==='POST')return json({},200,{location:'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=fixture'});
    if(url.pathname==='/upload/youtube/v3/videos'&&init.method==='PUT'){assert.deepEqual(Buffer.from(init.body),MP4);return json({id:'abcdefghijk'});}
    if(url.pathname==='/youtube/v3/videos')return json({items:[{id:'abcdefghijk',snippet:{channelId,title:'직접 발행 시험',description:'확정한 게시문',publishedAt:at},status:{uploadStatus:'processed',privacyStatus:'unlisted',selfDeclaredMadeForKids:false},processingDetails:{processingStatus:'succeeded'}}]});
    throw Error('Unexpected mocked endpoint: '+path);
  };
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,origin:'https://workspace.synk.im',schedule:false,clock:()=>at,socialProviderOptions:{fetchImpl:fakeFetch,wait:()=>Promise.resolve()},synkIdentityConfig:null,teachingConfig:null,synkCustomerIdentityConfig:null,workNotificationsEnabled:false,webPushEnabled:false,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));rmSync(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({email:'admin@direct.test',name:'합성 관리자',role:'admin'}),member=app.store.createUser({email:'member@direct.test',name:'합성 작성자',role:'member',teamId:'a'}),outsider=app.store.createUser({email:'outsider@direct.test',name:'다른 팀',role:'member',teamId:'b'});
  app.store.put('channels','channel',{id:'channel',platform,handle:'synk',displayName:'합성 SNS 계정',externalId:channelId,ownerIds:[member.id],teamId:'a',active:true,connectionVersion:1});
  app.store.setSecret('channel:channel',{accessToken:'private-synthetic-token',accountId:channelId,appScopedId:platform==='instagram'?'101':undefined,authType:platform==='instagram'?'instagram-login':platform==='youtube'?'google-oauth':'facebook-page',apiVersion:'v26.0',metaIdentityVersion:1,permissionsVerifiedAt:at,expiresAt:platform==='youtube'?'2099-01-01T00:00:00Z':null,scope:platform==='instagram'?'instagram_business_basic instagram_business_content_publish':platform==='youtube'?'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload':'pages_read_engagement pages_manage_posts'});
  const tokens=new Map([admin,member,outsider].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'test-csrf'},60)]));await app.start();base='http://127.0.0.1:'+app.server.address().port;
  async function api(user,path,input){const result=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:'synk_company_session='+tokens.get(user.id),Origin:app.origin,'X-CSRF-Token':'test-csrf',...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:result.status,data:await result.json()};}
  const connect=()=>api(admin,'/api/social/provider/connect',{channelId:'channel'});
  function asset(video=false){const id=randomUUID(),bytes=video?MP4:JPEG,diskName=id+(video?'.mp4':'.jpg');mkdirSync(join(directory,'studio-media'),{recursive:true});writeFileSync(join(directory,'studio-media',diskName),bytes);app.store.put('socialMedia',id,{id,ownerId:member.id,teamId:'a',diskName,fileName:diskName,mimeType:video?'video/mp4':'image/jpeg',byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),width:1080,height:video?1920:1350,...(video?{duration:30}:{})});return {assetId:id,url:'/api/social/media/'+id,type:video?'video':'image'};}
  async function prepare(variant={format:'image',media:[asset()]}){let r=await api(member,'/api/social/posts',{title:'직접 발행 시험',body:'확정한 게시문',variants:[{channelId:'channel',...variant}]});assert.equal(r.status,200,JSON.stringify(r.data));let post=r.data.post;r=await api(admin,`/api/social/posts/${post.id}/action`,{action:'approve',revision:post.revision});assert.equal(r.status,200,JSON.stringify(r.data));post=r.data.post;r=await api(admin,`/api/social/posts/${post.id}/action`,{action:'schedule',revision:post.revision,scheduledAt:at,timezone:'Asia/Seoul'});assert.equal(r.status,200,JSON.stringify(r.data));return {post,job:r.data.jobs[0]};}
  return {app,admin,member,outsider,api,connect,prepare,asset,calls,grants,base,setReady:value=>ready=value,setUncertain:value=>uncertain=value,setHook:value=>hook=value,advance:ms=>at=new Date(Date.parse(at)+ms).toISOString()};
}

test('default HTTP provider needs no Postiz settings; explicit opt-in enables approved Instagram media end to end',async t=>{
  const f=await fixture(t),view=(await f.api(f.admin,'/api/social/workspace')).data;assert.equal(view.provider.mode,'direct');assert.equal(view.channels[0].capability.canPublish,false);
  assert.equal((await f.api(f.admin,'/api/social/provider/configure',{apiKey:'must-not-store'})).status,400);
  assert.equal((await f.connect()).status,200);const {job}=await f.prepare();await f.app.scanSocialPublishing();const saved=f.app.store.get('socialPublishJobs',job.id);assert.equal(saved.status,'published',JSON.stringify(saved));assert.equal(saved.publicVerifiedAt,null);assert.equal(f.calls.filter(c=>c.path==='100/media_publish').length,1);
  assert.equal((await fetch(f.base+new URL(f.grants[0]).pathname)).status,404);
  const response=JSON.stringify((await f.api(f.admin,'/api/social/workspace')).data);for(const privateValue of ['private-synthetic-token','must-not-store',f.grants[0]])assert.ok(!response.includes(privateValue));assert.equal((await f.api(f.outsider,'/api/social/workspace')).data.provider.channels.length,0);
});

test('pending Reel can fetch its grant and finish through the existing reconciliation route once',async t=>{
  const f=await fixture(t);assert.equal((await f.connect()).status,200);f.setReady(false);const {job}=await f.prepare({format:'reel',media:[f.asset(true)],options:{shareToFeed:false}});await f.app.scanSocialPublishing();assert.equal(f.app.store.get('socialPublishJobs',job.id).status,'processing');
  assert.equal((await fetch(f.base+new URL(f.grants[0]).pathname)).status,200);f.setReady(true);const result=await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'reconcile'});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.job.status,'published');assert.equal(f.calls.filter(c=>c.path==='100/media').length,1);assert.equal(f.calls.filter(c=>c.path==='100/media_publish').length,1);
});

test('emergency pause revokes pending media access and prevents continuation from making a public post',async t=>{
  const f=await fixture(t);await f.connect();f.setReady(false);const {job}=await f.prepare({format:'reel',media:[f.asset(true)]});await f.app.scanSocialPublishing();f.app.store.put('socialPublishSettings','global',{paused:true});f.setReady(true);
  assert.equal((await fetch(f.base+new URL(f.grants[0]).pathname)).status,404);await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'reconcile'});assert.equal(f.calls.filter(c=>c.path==='100/media_publish').length,0);
});

test('lost Facebook final response cannot cause a second public submission',async t=>{
  const f=await fixture(t,{platform:'facebook'});assert.equal((await f.connect()).status,200);const {job}=await f.prepare({format:'text',media:[]});f.setUncertain(true);await f.app.scanSocialPublishing();assert.equal(f.app.store.get('socialPublishJobs',job.id).status,'unknown');f.advance(300001);await f.app.scanSocialPublishing();await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'reconcile'});assert.equal((await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'publish_now'})).status,409);assert.equal(f.calls.filter(c=>c.path==='100/feed'&&c.method==='POST').length,1);
});

test('disconnecting only publishing preserves comments credentials and invalidates already approved jobs',async t=>{
  const f=await fixture(t,{platform:'facebook'});await f.connect();const {job}=await f.prepare({format:'text',media:[]});f.app.store.put('socialInboxConnections','channel',{id:'channel',enabled:true});assert.equal((await f.api(f.admin,'/api/social/provider/disconnect',{channelId:'channel'})).status,200);await f.app.scanSocialPublishing();assert.equal(f.calls.filter(c=>c.path==='100/feed').length,0);assert.equal(f.app.store.get('socialPublishJobs',job.id).errorCode,'PERMISSION_OR_VERSION_CHANGED');assert.equal(f.app.store.get('socialInboxConnections','channel').enabled,true);assert.equal(f.app.store.secret('channel:channel').accessToken,'private-synthetic-token');assert.equal(f.app.store.get('channels','channel').connectionVersion,1);
});

test('YouTube MP4 uses the same approval and scheduler flow with explicit audience and privacy',async t=>{
  const f=await fixture(t,{platform:'youtube'});const connected=await f.connect();assert.equal(connected.status,200,JSON.stringify(connected.data));const {job}=await f.prepare({format:'video',media:[f.asset(true)],options:{privacy:'unlisted',madeForKids:false}});await f.app.scanSocialPublishing();const saved=f.app.store.get('socialPublishJobs',job.id);assert.equal(saved.status,'published',JSON.stringify(saved));assert.equal(saved.publicVerifiedAt,null);assert.equal(f.calls.filter(c=>c.path==='/upload/youtube/v3/videos'&&c.method==='POST').length,1);const view=JSON.stringify((await f.api(f.admin,'/api/social/workspace')).data);assert.ok(!view.includes('upload_id=fixture'));assert.equal(f.grants.length,0);
});

test('an explicitly rescheduled unsent YouTube failure can publish through the real scheduler',async t=>{
  const f=await fixture(t,{platform:'youtube'});await f.connect();const {job}=await f.prepare({format:'video',media:[f.asset(true)],options:{privacy:'unlisted',madeForKids:false}});
  f.setHook(({path,init})=>path==='/upload/youtube/v3/videos'&&init.method==='POST'?json({},503):null);await f.app.scanSocialPublishing();assert.equal(f.app.store.get('socialPublishJobs',job.id).status,'failed');assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);
  f.setHook(null);const result=await f.api(f.admin,`/api/social/jobs/${job.id}/action`,{action:'reschedule',scheduledAt:'2026-10-14T10:00:01.000Z'});assert.equal(result.status,200,JSON.stringify(result.data));f.advance(1000);await f.app.scanSocialPublishing();assert.equal(f.app.store.get('socialPublishJobs',job.id).status,'published',JSON.stringify({job:f.app.store.get('socialPublishJobs',job.id),ledger:f.app.store.all('socialDirectPublishJobs')}));assert.equal(f.calls.filter(c=>c.path==='/upload/youtube/v3/videos'&&c.method==='POST').length,2);assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);
});
