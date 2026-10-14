import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {createSocialInboxProvider} from './social-inbox-provider.mjs';
import {createHash} from 'node:crypto';
import {loadInboxProgress,validInboxCursor} from './social-inbox-progress.mjs';

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
function fixture(t,{platform='instagram',authType=platform==='instagram'?'instagram-login':'facebook-page',scope}={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-inbox-provider-')),store=new Store(directory);t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  const admin={id:'admin',role:'admin',active:true},member={id:'member',role:'member',active:true,teamId:'a'},viewer={id:'viewer',role:'viewer',active:true,teamId:'a'},other={id:'other',role:'member',active:true,teamId:'b'};
  for(const user of [admin,member,viewer,other])store.put('users',user.id,user);
  const channel={id:'channel',platform,externalId:'100',handle:'synk',ownerIds:[member.id],teamId:'a',active:true,connectionVersion:1};store.put('channels',channel.id,channel);
  const credentials={accessToken:'synthetic-meta-user-secret',authType,apiVersion:'v26.0',scope:scope??(platform==='instagram'?'instagram_business_basic instagram_business_manage_comments':'pages_show_list pages_read_engagement pages_read_user_content')};store.setSecret('channel:channel',credentials);
  const calls=[];let custom,at='2026-10-13T00:00:00.000Z';
  const fetchImpl=async(url,init)=>{
    calls.push({url,init});const parsed=new URL(url),path=parsed.pathname.replace(/^\/v[\d.]+\//,'');const special=await custom?.(path,parsed,init);if(special)return special;
    if(path==='me/accounts')return json({data:[{id:'100',access_token:'synthetic-meta-page-secret',tasks:['MODERATE']}]});
    if(path==='me'||path==='100')return json({id:'100',username:'synk',name:'SYNK'});
    if(path==='100/media')return json({data:[{id:'200',permalink:'https://www.instagram.com/p/SYNK1/',timestamp:at}]});
    if(path==='100/posts')return json({data:[{id:'100_200',permalink_url:'https://www.facebook.com/100/posts/200',created_time:at}]});
    if(path==='200/comments')return json({data:[{id:'300',text:'질문입니다',timestamp:'2026-10-13T00:00:00Z',username:'reader',replies:{data:[{id:'301',text:'추가 질문',timestamp:'2026-10-13T00:00:00Z',username:'reader'}]}}]});
    if(path==='100_200/comments')return json({data:[{id:'200_300',message:'페이지 문의',created_time:at,from:{name:'Reader'}},{id:'200_301',message:'덧붙입니다',created_time:at,parent:{id:'200_300'}}]});
    if(/^\d+\/replies$/.test(path))return json({data:[]});
    throw Error('Unexpected synthetic endpoint');
  };
  const create=options=>createSocialInboxProvider({store,fetchImpl,clock:()=>at,...options}),provider=create();
  return {store,admin,member,viewer,other,channel,credentials,calls,provider,create,setHandler:value=>{custom=value;},advance:ms=>{at=new Date(Date.parse(at)+ms).toISOString();},enable:()=>provider.configure(admin,{channelId:channel.id,enabled:true}),sync:(user=member,options={},context={})=>provider.sync(user,{channelId:channel.id,...options},context)};
}

test('comments require explicit opt-in and actual granted comment scopes, never collector config scopes',async t=>{
  const f=fixture(t,{scope:'instagram_business_basic instagram_business_manage_insights'});assert.equal(f.provider.capability(f.channel).available,false);f.enable();assert.equal(f.provider.capability(f.channel).available,false);await assert.rejects(f.sync(),{code:'SCOPES_REQUIRED'});assert.equal(f.calls.length,0);
  f.store.setSecret('channel:channel',{...f.credentials,scope:'',scopes:['instagram_business_basic','instagram_business_manage_comments']});assert.equal(f.provider.capability(f.channel).available,false);
  assert.deepEqual(f.provider.settings(f.other).channels,[]);assert.equal(f.provider.settings(f.viewer).channels[0].canConfigure,false);assert.equal(f.provider.settings(f.viewer).channels[0].canSync,false);assert.deepEqual(f.provider.settings(f.admin).supports,{comments:true,directMessages:false,replies:false});
});

test('IG Login imports by canonical user_id while /me id is app scoped',async t=>{
  const f=fixture(t);f.store.setSecret('channel:channel',{...f.credentials,accountId:'100',appScopedId:'900',metaIdentityVersion:1});f.setHandler(path=>path==='me'?json({id:'900',user_id:'100',username:'synk'}):null);f.enable();const result=await f.sync();assert.equal(result.imported,2);assert.ok(f.store.all('socialInbox').every(row=>row.sourceAccountId==='100'));assert.ok(f.calls.some(call=>new URL(call.url).pathname==='/v26.0/100/media'));
});

test('Instagram import reads comments and replies and links to original posts without sending',async t=>{
  const f=fixture(t);f.enable();f.store.put('posts','collector',{id:'collector',channelId:'channel',externalId:'200',source:'api:instagram'});f.store.put('socialPublishJobs','job',{id:'job',postId:'social-post',channelId:'channel',status:'published',publicationUrl:'https://www.instagram.com/p/SYNK1/'});
  const result=await f.sync();assert.equal(result.imported,2);assert.equal(result.coverage.completeHistory,false);assert.equal(result.coverage.includesMessages,false);assert.equal(result.status,'scanned');const rows=f.store.all('socialInbox');assert.equal(rows[0].postId,'social-post');assert.equal(rows[0].collectorPostId,'collector');assert.equal(rows[0].source,'api:instagram');assert.equal(rows[1].parentExternalId,'300');assert.ok(rows.every(row=>row.outboundSent===false));assert.ok(f.calls.every(call=>call.init.method==='GET'&&call.init.redirect==='error'&&!call.init.body&&new URL(call.url).origin==='https://graph.instagram.com'&&!call.url.includes('secret')));assert.ok(!JSON.stringify(result).includes('secret'));
});

test('reimport is idempotent and preserves local assignee, resolved state, draft and manual post mapping',async t=>{
  const f=fixture(t);f.enable();await f.sync();const old=f.store.all('socialInbox')[0];f.store.put('socialInbox',old.id,{...old,assigneeId:'admin',status:'resolved',replyDraft:'검토 중 답변',postId:'chosen-post',revision:5});f.advance(1000);
  const repeat=await f.sync();assert.equal(repeat.imported,0);assert.equal(repeat.updated,0);assert.equal(f.store.all('socialInbox').length,2);const same=f.store.get('socialInbox',old.id);assert.equal(same.status,'resolved');assert.equal(same.assigneeId,'admin');assert.equal(same.replyDraft,'검토 중 답변');assert.equal(same.postId,'chosen-post');assert.equal(same.revision,5);assert.notEqual(same.lastCollectedAt,same.importedAt);
  f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'수정된 질문',timestamp:'2026-10-13T00:00:00Z',username:'reader'}]}):null);const updated=await f.sync();assert.equal(updated.updated,1);const row=f.store.get('socialInbox',old.id);assert.equal(row.text,'수정된 질문');assert.equal(row.status,'resolved');assert.equal(row.revision,6);assert.equal(f.store.all('socialInbox').length,2);
});

test('reimport preserves a confirmed outbound reply and its original attempt association',async t=>{
  const f=fixture(t);f.enable();await f.sync();const old=f.store.all('socialInbox')[0];f.store.put('socialInbox',old.id,{...old,outboundSent:true,outboundAttemptId:'sent-attempt',outboundSentAt:'2026-10-13T00:01:00Z',replyDraft:'다음 검토 초안',revision:2});
  await f.sync();const same=f.store.get('socialInbox',old.id);assert.equal(same.outboundSent,true);assert.equal(same.outboundAttemptId,'sent-attempt');assert.equal(same.outboundSentAt,'2026-10-13T00:01:00Z');assert.equal(same.replyDraft,'다음 검토 초안');assert.equal(same.revision,2);
});

test('Facebook user credentials resolve a managed Page token and read all-level comments',async t=>{
  const f=fixture(t,{platform:'facebook',authType:'facebook-user'});f.enable();const result=await f.sync();assert.equal(result.imported,2);const calls=f.calls;assert.equal(calls[0].init.headers.Authorization,'Bearer synthetic-meta-user-secret');assert.equal(calls[1].init.headers.Authorization,'Bearer synthetic-meta-page-secret');const comments=calls.find(call=>call.url.includes('/comments?'));assert.equal(new URL(comments.url).searchParams.get('filter'),'stream');assert.equal(f.store.all('socialInbox')[1].parentExternalId,'200_300');assert.ok(!JSON.stringify(f.provider.settings(f.admin)).includes('secret'));
});

test('Facebook permalink identity keeps post query IDs and discards tracking parameters',async t=>{
  const f=fixture(t,{platform:'facebook'});f.enable();f.setHandler(path=>path==='100/posts'?json({data:[{id:'100_200',permalink_url:'https://www.facebook.com/story.php?story_fbid=200&id=100&access_token=do-not-store'}]}):null);
  for(const nativeId of ['199','200'])f.store.put('socialPublishJobs','job-'+nativeId,{id:'job-'+nativeId,channelId:'channel',postId:'post-'+nativeId,status:'published',publicationUrl:'https://www.facebook.com/story.php?id=100&story_fbid='+nativeId});
  await f.sync();const rows=f.store.all('socialInbox');assert.equal(rows[0].postId,'post-200');assert.ok(rows.every(row=>!row.url.includes('access_token')));
});

test('pagination rebuilds the fixed Graph endpoint and reports bounded or incomplete coverage',async t=>{
  const f=fixture(t);f.enable();let pages=0;f.setHandler((path,url)=>{if(path==='100/media')return json({data:[{id:'200',permalink:'https://www.instagram.com/p/SYNK1/'}],paging:{next:'https://evil.test/secret',cursors:{after:'older-posts'}}});if(path==='200/comments'){pages++;return url.searchParams.get('after')?json({data:[{id:'302',text:'second',timestamp:'2026-10-13T00:00:00Z'}]}):json({data:[{id:'300',text:'first',timestamp:'2026-10-13T00:00:00Z'}],paging:{next:'https://evil.test/steal?access_token=leaked',cursors:{after:'next-comment'}}});}});
  const result=await f.sync(f.member,{maxPosts:1,maxComments:10});assert.equal(result.imported,2);assert.equal(pages,2);assert.equal(result.status,'partial');assert.ok(f.calls.every(call=>new URL(call.url).origin==='https://graph.instagram.com'));assert.ok(f.calls.some(call=>new URL(call.url).searchParams.get('after')==='next-comment'));
});

test('nested Instagram replies paginate by trusted comment ID and deduplicate overlap',async t=>{
  const f=fixture(t);f.enable();f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'parent',replies:{data:[{id:'301',text:'first reply'}],paging:{next:'https://evil.test',cursors:{after:'reply-next'}}}}]}):path==='300/replies'?json({data:[{id:'301',text:'first reply'},{id:'302',text:'second reply'}]}):null);
  const result=await f.sync();assert.equal(result.imported,3);assert.equal(f.store.all('socialInbox').find(row=>row.externalId==='302').parentExternalId,'300');
});

test('account mismatch, missing Page moderation access and malformed IDs cannot import other accounts',async t=>{
  for(const mode of ['account','media']){const f=fixture(t);f.enable();f.setHandler(path=>path==='me'&&mode==='account'?json({id:'999',username:'foreign'}):path==='100/media'&&mode==='media'?json({data:[{id:'../../secrets',permalink:'https://evil.test'}]}):null);await assert.rejects(f.sync(),{code:'ACCOUNT_MISMATCH'});assert.equal(f.store.all('socialInbox').length,0);}
  const page=fixture(t,{platform:'facebook',authType:'facebook-user'});page.enable();page.setHandler(path=>path==='me/accounts'?json({data:[{id:'100',access_token:'secret',tasks:['ANALYZE']}]}):null);await assert.rejects(page.sync(),{code:'PAGE_ACCESS_REQUIRED'});assert.equal(page.store.all('socialInbox').length,0);
});

test('revoked session, reassigned channel and disconnected credential stop import after awaited work',async t=>{
  for(const mode of ['user','channel','token','session']){const f=fixture(t);f.enable();let permitted=true;f.setHandler(path=>{if(path==='200/comments'){if(mode==='user')f.store.put('users',f.member.id,{...f.member,active:false});if(mode==='channel')f.store.put('channels','channel',{...f.channel,connectionVersion:2});if(mode==='token')f.store.deleteSecret('channel:channel');if(mode==='session')permitted=false;}});await assert.rejects(f.sync(f.member,{}, {authorize(){if(!permitted)throw Error('revoked session secret');}}));assert.equal(f.store.all('socialInbox').length,0);}
});

test('provider errors are redacted, rate limits persist and unknown responses never become zero comments',async t=>{
  for(const mode of ['auth','rate','json']){const f=fixture(t);f.enable();f.setHandler(path=>path==='200/comments'?(mode==='json'?new Response('private token exposed',{status:200}):json({error:{message:'synthetic-meta-user-secret',code:mode==='auth'?190:613}},400)):null);let error;try{await f.sync();}catch(e){error=e;}assert.ok(error);assert.ok(!error.message.includes('secret'));assert.equal(f.store.all('socialInbox').length,0);assert.equal(f.provider.settings(f.admin).channels[0].lastStatus,'error');const before=f.calls.length;if(mode==='rate'){await assert.rejects(f.sync(),{code:'RATE_LIMIT'});assert.equal(f.calls.length,before);}if(mode==='auth')assert.equal(f.provider.capability(f.channel).available,false);}
});

test('manual records and inaccessible comment records are never deleted by a later empty scan',async t=>{
  const f=fixture(t);f.enable();f.store.put('socialInbox','manual',{id:'manual',channelId:'channel',source:'manual',text:'직접 남긴 문의'});await f.sync();f.setHandler(path=>path==='200/comments'?json({data:[]}):null);const result=await f.sync();assert.equal(result.imported,0);assert.equal(f.store.all('socialInbox').length,3);assert.equal(f.store.get('socialInbox','manual').text,'직접 남긴 문의');
});

test('shutdown aborts active reads and waits for cleanup before refusing new sync work',async t=>{
  const f=fixture(t);f.enable();let entered;const pending=new Promise(resolve=>{entered=resolve;});f.setHandler((path,_url,init)=>{if(path==='200/comments'){entered();return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted synthetic secret')),{once:true}));}});
  const active=f.sync();await pending;const stopped=f.provider.stop();await assert.rejects(active);await stopped;await f.provider.waitForIdle();assert.equal(f.store.all('socialInbox').length,0);const before=f.calls.length;await assert.rejects(f.sync(),{code:'INBOX_STOPPED'});assert.equal(f.calls.length,before);
});

test('scheduled scans run only opted-in authorized accounts at fifteen-minute intervals',async t=>{
  const f=fixture(t);assert.deepEqual(await f.provider.scanDue(),{checked:0,imported:0,updated:0,failed:0});assert.equal(f.calls.length,0);f.enable();const first=await f.provider.scanDue();assert.equal(first.checked,1);assert.equal(first.imported,2);const count=f.calls.length;assert.equal((await f.provider.scanDue()).checked,0);assert.equal(f.calls.length,count);
  f.advance(15*60000);assert.equal((await f.provider.scanDue()).checked,1);assert.equal(f.store.all('socialInbox').length,2);f.store.put('users','admin',{...f.admin,active:false});f.advance(15*60000);const before=f.calls.length;assert.equal((await f.provider.scanDue()).checked,0);assert.equal(f.calls.length,before);
});

test('one account failure cannot stop another and failure attempts are rate limited',async t=>{
  const f=fixture(t);f.enable();const second={...f.channel,id:'second',externalId:'101',handle:'synk2'};f.store.put('channels',second.id,second);f.store.setSecret('channel:second',{...f.credentials,accessToken:'second-synthetic-token'});f.provider.configure(f.admin,{channelId:'second',enabled:true});
  f.setHandler((path,_url,init)=>{if(init.headers.Authorization.includes('synthetic-meta-user-secret'))throw Error('network');if(path==='me')return json({id:'101',username:'synk2'});if(path==='101/media')return json({data:[{id:'201',permalink:'https://www.instagram.com/p/SYNK2/'}]});if(path==='201/comments')return json({data:[{id:'401',text:'다른 계정 문의'}]});});
  const result=await f.provider.scanDue();assert.deepEqual(result,{checked:2,imported:1,updated:0,failed:1});const count=f.calls.length;assert.equal((await f.provider.scanDue()).checked,0);assert.equal(f.calls.length,count);assert.ok(f.store.get('socialInboxConnections','channel').lastAttemptAt);
});

test('unavailable scopes and expired tokens are skipped without calls and stop waits for scans',async t=>{
  const f=fixture(t,{scope:'instagram_business_basic'});f.enable();assert.equal((await f.provider.scanDue()).checked,0);assert.equal(f.calls.length,0);f.store.setSecret('channel:channel',{...f.credentials,scope:'instagram_business_basic instagram_business_manage_comments',expiresAt:'2026-01-01T00:00:00Z'});assert.equal((await f.provider.scanDue()).checked,0);assert.equal(f.calls.length,0);
  f.store.setSecret('channel:channel',{...f.credentials,scope:'instagram_business_basic instagram_business_manage_comments'});let entered;const pending=new Promise(resolve=>{entered=resolve;});f.setHandler((path,_url,init)=>{if(path==='me'){entered();return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});const scanning=f.provider.scanDue();await pending;await f.provider.stop();await f.provider.waitForIdle();assert.equal((await scanning).failed,1);assert.equal((await f.provider.scanDue()).checked,0);
});

test('bounded history survives a new Store and always leaves fresh-head work at the default limits',async t=>{
  const f=fixture(t);f.enable();let fresh=false;
  f.setHandler((path,url)=>{
    if(path==='100/media'){const offset=Number(url.searchParams.get('after')||0),limit=Number(url.searchParams.get('limit')),posts=Array.from({length:20},(_,i)=>({id:String(200+i),permalink:`https://www.instagram.com/p/POST${i}/`}));return json({data:posts.slice(offset,offset+limit),...(offset+limit<20?{paging:{next:'https://untrusted.test/?access_token=never-follow',cursors:{after:String(offset+limit)}}}:{})});}
    if(/^2\d\d\/comments$/.test(path)){const post=path.split('/')[0];return json({data:[{id:String(Number(post)+1000),text:post==='200'&&fresh?'새 댓글 내용':'기존 댓글',replies:{data:[]}}]});}
  });
  const first=await f.sync();assert.equal(first.imported,10);assert.equal(first.coverage.postsChecked,10);assert.equal(first.coverage.progress.historyPending,true);assert.ok(f.calls.length<=40);
  const restored=new Store(f.store.directory),close=f.store.close.bind(f.store);f.store.close=()=>{restored.close();close();};const service=f.create({store:restored});fresh=true;
  const start=f.calls.length,result=await service.sync(f.member,{channelId:'channel'});assert.equal(result.imported,5);assert.equal(result.coverage.progress.recentPostsChecked,5);assert.equal(result.coverage.progress.historyPostsChecked,5);assert.equal(restored.all('socialInbox').find(row=>row.externalId==='1200').text,'새 댓글 내용');assert.equal(restored.all('socialInbox').length,15);assert.ok(f.calls.length-start<=40);
  const third=await service.sync(f.member,{channelId:'channel'});assert.equal(third.imported,5);assert.equal(third.coverage.progress.historyPending,false);assert.ok(third.coverage.progress.historyCompletedAt);assert.equal(restored.all('socialInbox').length,20);
  assert.ok(!JSON.stringify(service.settings(f.admin)).includes('cursors'));assert.ok(f.calls.every(call=>new URL(call.url).origin==='https://graph.instagram.com'));
});

test('completed comment pages and the next cursor commit together before a later request fails',async t=>{
  const f=fixture(t);f.enable();let rejectNext=true;
  f.setHandler((path,url)=>path==='200/comments'?(url.searchParams.get('after')?(rejectNext?json({error:{code:2}},503):json({data:[{id:'302',text:'second',replies:{data:[]}}]})):json({data:[{id:'300',text:'first',replies:{data:[]}}],paging:{next:'not-followed',cursors:{after:'page-two'}}})):null);
  await assert.rejects(f.sync(),{code:'PROVIDER_REJECTED'});assert.equal(f.store.all('socialInbox').length,1);const saved=f.store.get('socialInboxConnections','channel').progress;assert.equal(saved.history[0].after,'page-two');assert.ok(saved.lastCheckpointAt);
  rejectNext=false;const next=f.create();await next.sync(f.member,{channelId:'channel'});assert.equal(f.store.all('socialInbox').length,2);assert.equal(f.store.all('socialInbox').filter(row=>row.externalId==='300').length,1);
});

test('atomic checkpoint rolls back imported rows when progress storage fails',async t=>{
  const f=fixture(t);f.enable();const put=f.store.put.bind(f.store);let rejected=false;
  f.store.put=(kind,key,value)=>{if(kind==='socialInboxConnections'&&f.store.all('socialInbox').length&&!rejected){rejected=true;throw Error('synthetic disk failure');}return put(kind,key,value);};
  await assert.rejects(f.sync());assert.equal(f.store.all('socialInbox').length,0);assert.equal(f.store.get('socialInboxConnections','channel').progress.history[0].kind,'comments');
  f.store.put=put;await f.create().sync(f.member,{channelId:'channel'});assert.equal(f.store.all('socialInbox').length,2);
});

test('unfinished buffered replies consume the comment cap and resume without dropping the tail',async t=>{
  const f=fixture(t);f.enable();f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'parent',replies:{data:Array.from({length:6},(_,i)=>({id:String(301+i),text:'reply '+i,from:{id:'999'}}))}}]}):null);
  const one=await f.sync(f.member,{maxPosts:2,maxComments:4});assert.equal(one.coverage.commentsReceived,4);assert.equal(f.store.all('socialInbox').length,4);assert.ok(f.store.get('socialInboxConnections','channel').progress.history.some(task=>task.kind==='item'));
  for(let i=0;i<3;i++){const result=await f.create().sync(f.member,{channelId:'channel',maxPosts:2,maxComments:4});assert.ok(result.coverage.commentsReceived<=4);assert.ok(result.coverage.postsChecked<=2);}
  assert.equal(f.store.all('socialInbox').length,7);
});

test('connection, token, owner and setting-authority changes invalidate persisted cursors',async t=>{
  for(const mode of ['connection','token','owners','actor']){
    const f=fixture(t);f.enable();f.setHandler(path=>path==='100/media'?json({data:[{id:'200'}],paging:{next:'unused',cursors:{after:'old-cursor'}}}):null);await f.sync(f.member,{maxPosts:1});
    if(mode==='connection'){f.store.put('channels','channel',{...f.channel,connectionVersion:2});f.provider.configure(f.admin,{channelId:'channel',enabled:true});}
    if(mode==='token')f.store.setSecret('channel:channel',{...f.credentials,accessToken:'rotated-synthetic'});
    if(mode==='owners')f.store.put('channels','channel',{...f.channel,ownerIds:['member','other']});
    if(mode==='actor')f.store.put('users','admin',{...f.admin,teamId:'changed'});
    f.setHandler(path=>path==='100/media'?json({data:[]}):null);const start=f.calls.length;await f.sync();assert.ok(f.calls.slice(start).every(call=>!new URL(call.url).searchParams.has('after')));
  }
});

test('a revoked authority after an await keeps older checkpoints but does not save the new page',async t=>{
  const f=fixture(t);f.enable();f.setHandler((path,url)=>{if(path!=='200/comments')return null;if(!url.searchParams.has('after'))return json({data:[{id:'300',text:'safe first',replies:{data:[]}}],paging:{next:'unused',cursors:{after:'page2'}}});f.store.put('users','member',{...f.member,active:false});return json({data:[{id:'302',text:'must not save',replies:{data:[]}}]});});
  await assert.rejects(f.sync(),{code:'AUTH_REQUIRED'});assert.deepEqual(f.store.all('socialInbox').map(row=>row.externalId),['300']);assert.equal(f.store.get('socialInboxConnections','channel').progress.history[0].after,'page2');
});

test('opaque cursors stay private, malformed progress resets, expired provider cursors restart boundedly',async t=>{
  assert.equal(validInboxCursor('abc\nsecret'),false);assert.equal(validInboxCursor('x'.repeat(2001)),false);assert.equal(loadInboxProgress({schema:1,binding:'x',revision:3,history:[{kind:'fetch',url:'https://evil.test'}]},'x').resetReason,'invalid-progress');
  const f=fixture(t);f.enable();let reject=false;f.setHandler((path,url)=>path==='200/comments'?(url.searchParams.has('after')?(reject?json({error:{code:100}},400):json({data:[{id:'302',text:'second',replies:{data:[]}}]})):json({data:[{id:'300',text:'first',replies:{data:[]}}],paging:{next:'https://evil.test',cursors:{after:'expired-cursor'}}})):null);
  await f.sync(f.member,{maxComments:1});reject=true;const result=await f.sync(f.member,{maxComments:4});assert.equal(result.coverage.progress.resetReason,'expired-cursor');assert.ok(!JSON.stringify(result).includes('expired-cursor"],'));assert.ok(f.calls.every(call=>call.init.method==='GET'&&new URL(call.url).origin==='https://graph.instagram.com'));
});

test('Meta scan has a hard forty-request cap and the hourly budget remains shared',async t=>{
  const f=fixture(t);f.enable();let number=0;f.setHandler(path=>path==='200/comments'?json({data:[{id:String(1000+number++),text:'paged',replies:{data:[]}}],paging:{next:'unused',cursors:{after:'cursor-'+number}}}):null);
  const first=await f.sync();assert.equal(f.calls.length,40);assert.equal(first.status,'partial');assert.ok(first.coverage.progress.historyPending);
  const state=f.store.get('socialInboxRequests','channel');f.store.put('socialInboxRequests','channel',{...state,times:Array(120).fill(Date.parse('2026-10-13T00:00:00Z'))});const before=f.calls.length;await assert.rejects(f.sync(),{code:'RATE_LIMIT'});assert.equal(f.calls.length,before);
});

test('only an observed account author ID becomes external reply proof; no outbound ledger is forged',async t=>{
  const f=fixture(t);f.store.setSecret('channel:channel',{...f.credentials,accountId:'100',appScopedId:'900',metaIdentityVersion:1});f.enable();
  f.setHandler(path=>path==='me'?json({id:'900',user_id:'100',username:'synk'}):path==='200/comments'?json({data:[{id:'300',text:'question',replies:{data:[{id:'301',text:'our native reply',from:{id:'900'},timestamp:'2026-10-13T00:02:00Z'},{id:'302',text:'our automation reply',user:{id:'100'},timestamp:'2026-10-13T00:01:00Z'},{id:'303',text:'impersonation',username:'synk',from:{id:'999'}}]}}]}):null);
  await f.sync();const row=f.store.all('socialInbox').find(item=>item.externalId==='300'),e=row.externalReplyEvidence;assert.deepEqual(e.replyIds,['301','302']);assert.equal(e.replyCount,2);assert.equal(e.latestReplyExternalId,'301');assert.equal(e.complete,true);assert.equal(e.replySetHash,createHash('sha256').update(JSON.stringify(['301','302'])).digest('hex'));assert.equal(e.source,'meta-read');assert.equal(row.outboundSent,false);assert.equal(row.status,'open');assert.equal(row.outboundAttemptId,undefined);assert.equal(f.store.all('socialReplyAttempts').length,0);assert.equal(f.store.all('socialReplyDedupe').length,0);
});

test('bounded external reply display preserves the complete set hash and count',async t=>{
  const f=fixture(t);f.enable();const replies=Array.from({length:25},(_,i)=>({id:String(400+i),from:{id:'100'},text:'own'}));f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'question',replies:{data:replies}}]}):null);
  await f.sync();const evidence=f.store.all('socialInbox').find(row=>row.externalId==='300').externalReplyEvidence;assert.equal(evidence.replyIds.length,20);assert.equal(evidence.replyCount,25);assert.equal(evidence.replySetHash,createHash('sha256').update(JSON.stringify(replies.map(row=>row.id).sort())).digest('hex'));
});

test('partial or missing author proof cannot erase observed replies; a complete empty reply edge can',async t=>{
  const f=fixture(t);f.enable();let phase='own';f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'question',replies:{data:phase==='own'?[{id:'301',from:{id:'100'},text:'ours'}]:phase==='unknown'?[{id:'301',username:'synk',text:'same but author unavailable'}]:[]}}]}):null);
  await f.sync();const parent=f.store.all('socialInbox').find(row=>row.externalId==='300');assert.equal(parent.externalReplyEvidence.replyCount,1);phase='unknown';await f.sync();assert.equal(f.store.get('socialInbox',parent.id).externalReplyEvidence.replyCount,1);
  phase='empty';await f.sync();const empty=f.store.get('socialInbox',parent.id);assert.equal(empty.externalReplyEvidence.complete,true);assert.equal(empty.externalReplyEvidence.replyCount,0);assert.equal(empty.outboundSent,false);
});

test('Facebook account-authored child comments are observed without asserting a full reply scan',async t=>{
  const f=fixture(t,{platform:'facebook'});f.enable();f.setHandler(path=>path==='100_200/comments'?json({data:[{id:'200_300',message:'root',from:{id:'999'}},{id:'200_301',message:'own reply',from:{id:'100'},parent:{id:'200_300'}}]}):null);
  await f.sync();const evidence=f.store.all('socialInbox').find(row=>row.externalId==='200_300').externalReplyEvidence;assert.equal(evidence.replyCount,1);assert.equal(evidence.complete,false);assert.deepEqual(evidence.replyIds,['200_301']);
});

test('one-item limits alternate head checks and historical work instead of starving either lane',async t=>{
  const f=fixture(t);f.enable();f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'parent',replies:{data:[{id:'301',text:'one'},{id:'302',text:'two'}]}}]}):null);
  await f.sync(f.member,{maxComments:1});const next=await f.sync(f.member,{maxComments:1});assert.equal(next.coverage.progress.historyCommentsReceived,1);const third=await f.sync(f.member,{maxComments:1});assert.equal(third.coverage.progress.recentCommentsReceived,1);await f.sync(f.member,{maxComments:1});assert.equal(f.store.all('socialInbox').length,3);
});

test('older buffered content and reply proof cannot supersede a newer complete observation',async t=>{
  const f=fixture(t);f.enable();let phase='old';f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:phase==='old'?'old question':'new question',replies:{data:phase==='old'?[{id:'301',text:'old reply',from:{id:'100'}},{id:'302',text:'deleted reply',from:{id:'100'}}]:[]}}]}):null);
  await f.sync(f.member,{maxComments:2});phase='new';f.advance(60000);await f.sync(f.member,{maxComments:4});const rows=f.store.all('socialInbox'),parent=rows.find(row=>row.externalId==='300');assert.equal(parent.text,'new question');assert.equal(parent.externalReplyEvidence.replyCount,0);assert.equal(parent.externalReplyEvidence.complete,true);assert.equal(rows.find(row=>row.externalId==='302').metaAccountReply,null);
});

test('Facebook child-before-parent order still records account-authored reply evidence',async t=>{
  const f=fixture(t,{platform:'facebook'});f.enable();f.setHandler(path=>path==='100_200/comments'?json({data:[{id:'200_301',message:'reply',from:{id:'100'},parent:{id:'200_300'}},{id:'200_300',message:'root',from:{id:'999'}}]}):null);
  await f.sync();assert.equal(f.store.all('socialInbox').find(row=>row.externalId==='200_300').externalReplyEvidence.replyCount,1);
});

test('two provider instances cannot overwrite a newer committed progress revision',async t=>{
  const f=fixture(t);f.enable();let entered,release,hold=true;const waiting=new Promise(resolve=>entered=resolve),resume=new Promise(resolve=>release=resolve);
  f.setHandler(async path=>{if(path==='200/comments'&&hold){hold=false;entered();await resume;}});
  const first=f.sync();await waiting;await f.create().sync(f.member,{channelId:'channel'});release();await assert.rejects(first,{code:'PROGRESS_CHANGED'});assert.equal(f.store.all('socialInbox').length,2);assert.equal(f.store.get('socialInboxConnections','channel').lastStatus,'scanned');
});

test('an empty full reply observation also blocks old buffered proof that was never imported',async t=>{
  const f=fixture(t);f.enable();let older=true;f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'root',replies:{data:older?[{id:'301',text:'deleted',from:{id:'100'}}]:[]}}]}):null);
  await f.sync(f.member,{maxComments:1});older=false;f.advance(60000);await f.sync(f.member,{maxComments:4});const parent=f.store.all('socialInbox').find(row=>row.externalId==='300');assert.equal(parent.externalReplyEvidence,undefined);assert.ok(parent.metaReplyCompleteAt);assert.equal(f.store.all('socialInbox').find(row=>row.externalId==='301').metaAccountReply,null);
});

test('a next-page marker without a cursor stays pending and never becomes a successful full scan',async t=>{
  const f=fixture(t);f.enable();f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'root',replies:{data:[]}}],paging:{next:'https://untrusted.test/next'}}):null);
  const result=await f.sync();assert.equal(result.status,'partial');assert.equal(result.coverage.progress.historyPending,true);assert.equal(f.store.all('socialInbox').length,1);assert.ok(f.calls.length<=40);
});

test('corrupt future or missing observation timestamps reset private progress before using buffered content',async t=>{
  for(const mode of ['missing','future','start']){
    const f=fixture(t);f.enable();await f.sync(f.member,{maxComments:1});const settings=f.store.get('socialInboxConnections','channel'),task=settings.progress.history.find(task=>task.kind==='item');
    if(mode==='missing')delete task.observedAt;else if(mode==='future')task.observedAt='2028-01-01T00:00:00.000Z';else task.startedAt='2028-01-01T00:00:00.000Z';
    f.store.put('socialInboxConnections','channel',settings);f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'current',replies:{data:[]}}]}):null);
    const result=await f.sync();assert.equal(result.coverage.progress.resetReason,'invalid-progress');assert.equal(f.store.all('socialInbox').some(row=>row.externalId==='301'),false);
  }
});

test('partial collection unions the complete ID set observed by reply preview even without child rows',async t=>{
  const f=fixture(t);f.enable();f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'root',replies:{data:[]}}]}):null);await f.sync();const parent=f.store.all('socialInbox')[0],ids=Array.from({length:25},(_,i)=>String(400+i)).sort();
  f.store.put('socialInbox',parent.id,{...parent,metaReplyProofIds:ids,externalReplyEvidence:{source:'meta-read',method:'author-id-match',sourceAccountId:'100',connectionVersion:1,replyCount:ids.length,replyIds:ids.slice(0,20),replySetHash:createHash('sha256').update(JSON.stringify(ids)).digest('hex'),latestReplyExternalId:'424',latestReplyAt:'2026-10-13T00:00:00.000Z',observedAt:'2026-10-13T00:00:00.000Z',complete:true}});
  f.advance(60000);f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'root',replies:{data:[{id:'499',text:'new reply',from:{id:'100'}}],paging:{next:'unused',cursors:{after:'remaining'}}}}]}):null);await f.sync(f.member,{maxComments:2});
  const evidence=f.store.get('socialInbox',parent.id).externalReplyEvidence;assert.equal(evidence.replyCount,26);assert.equal(evidence.replyIds.length,20);assert.equal(evidence.complete,false);assert.equal(evidence.replySetHash,createHash('sha256').update(JSON.stringify([...ids,'499'].sort())).digest('hex'));
});

test('explicitly observed hidden or private own replies stop counting as a public answer',async t=>{
  for(const flag of ['hidden','is_hidden','is_private']){
    const platform=flag==='hidden'?'instagram':'facebook',f=fixture(t,{platform});f.enable();let hidden=false;
    f.setHandler((path,url)=>{
      if(platform==='instagram'&&path==='200/comments'){assert.ok(url.searchParams.get('fields').includes('hidden'));return json({data:[{id:'300',text:'root',replies:{data:[{id:'301',from:{id:'100'},text:'own',hidden}]}}]});}
      if(platform==='facebook'&&path==='100_200/comments'){assert.ok(url.searchParams.get('fields').includes('is_hidden,is_private'));return json({data:[{id:'200_300',message:'root',from:{id:'999'}},{id:'200_301',message:'own',from:{id:'100'},parent:{id:'200_300'},[flag]:hidden}]});}
    });
    await f.sync();const parent=f.store.all('socialInbox').find(row=>!row.parentExternalId);assert.equal(parent.externalReplyEvidence.replyCount,1);hidden=true;f.advance(1000);await f.sync();const after=f.store.get('socialInbox',parent.id);assert.equal(after.externalReplyEvidence.replyCount,0);assert.deepEqual(after.metaReplyProofIds,[]);assert.equal(after.outboundSent,false);assert.equal(after.status,'open');assert.equal(f.store.all('socialReplyAttempts').length,0);
  }
});

test('a newer complete public-reply proof survives an older hidden reply buffer and later partial merges',async t=>{
  const f=fixture(t);f.enable();let hidden=false;
  f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'root',replies:{data:[{id:'301',text:'reply',from:{id:'100'},hidden}]}}]}):null);
  await f.sync();f.advance(60000);hidden=true;await f.sync(f.member,{maxComments:1});
  const parent=f.store.all('socialInbox').find(row=>row.externalId==='300'),child=f.store.all('socialInbox').find(row=>row.externalId==='301');
  // The explicit reply preview's fresh complete GET updates the parent proof and
  // child visibility, but does not pretend that the child body was reimported.
  f.advance(60000);const verifiedAt='2026-10-13T00:02:00.000Z';
  f.store.put('socialInbox',parent.id,{...parent,metaReplyCompleteAt:verifiedAt,metaReplyProofIds:['301'],externalReplyEvidence:{...parent.externalReplyEvidence,observedAt:verifiedAt,complete:true}});
  f.store.put('socialInbox',child.id,{...child,metaAccountReply:{...child.metaAccountReply,hidden:false,confirmed:true}});
  await f.sync(f.member,{maxComments:1});const after=f.store.get('socialInbox',child.id);assert.equal(after.metaAccountReply.hidden,false);assert.equal(after.metaAccountReply.confirmed,true);assert.equal(f.store.get('socialInbox',parent.id).externalReplyEvidence.replyCount,1);
  f.advance(60000);f.setHandler(path=>path==='200/comments'?json({data:[{id:'300',text:'root',replies:{data:[{id:'302',text:'new reply',from:{id:'100'}}],paging:{next:'unused',cursors:{after:'unfinished'}}}}]}):null);
  await f.sync(f.member,{maxComments:2});assert.deepEqual(f.store.get('socialInbox',parent.id).metaReplyProofIds,['301','302']);
});
