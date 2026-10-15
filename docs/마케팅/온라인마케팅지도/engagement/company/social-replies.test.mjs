import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {createSocialReplies} from './social-replies.mjs';

const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}});
function fixture(t,{platform='instagram',authType=platform==='instagram'?'instagram-login':'facebook-page',scope}={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-social-replies-')),store=new Store(directory);
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  const admin={id:'admin',role:'admin',active:true},member={id:'member',role:'member',active:true,teamId:'a'},viewer={id:'viewer',role:'viewer',active:true,teamId:'a'},other={id:'other',role:'member',active:true,teamId:'b'};for(const user of [admin,member,viewer,other])store.put('users',user.id,user);
  const channel={id:'channel',platform,externalId:'100',handle:'synk',displayName:'SYNK',ownerIds:[member.id],teamId:'a',active:true,connectionVersion:1};store.put('channels',channel.id,channel);
  const credentials={accessToken:'synthetic-meta-secret',authType,apiVersion:'v26.0',scope:scope??(platform==='instagram'?'instagram_business_basic instagram_business_manage_comments':'pages_show_list pages_read_engagement pages_read_user_content pages_manage_engagement')};store.setSecret('channel:channel',credentials);
  const row={id:'inbox',channelId:'channel',revision:1,kind:'comment',source:'api:'+platform,sourceAccountId:'100',externalId:platform==='instagram'?'300':'200_300',nativePostId:platform==='instagram'?'200':'100_200',parentExternalId:null,text:'질문입니다',author:'reader',url:platform==='instagram'?'https://www.instagram.com/p/ABC/':'https://www.facebook.com/100/posts/200',importedAt:'2026-10-13T00:00:00.000Z',replyDraft:'저장된 초안',status:'open',assigneeId:member.id,outboundSent:false};store.put('socialInbox',row.id,row);
  let at='2026-10-13T00:00:00.000Z',handler;const calls=[];
  const fetchImpl=async(url,init)=>{calls.push({url,init});const parsed=new URL(url),path=parsed.pathname.replace(/^\/v[\d.]+\//,'');const special=await handler?.(path,parsed,init);if(special)return special;
    if(path==='me/accounts')return json({data:[{id:'100',access_token:'synthetic-page-secret',tasks:['MODERATE']}]});
    if(path==='me'||path==='100')return json({id:'100',username:'synk',name:'SYNK'});
    if(path==='300')return json({id:'300',text:row.text,username:'reader',media:{id:'200'}});
    if(path==='200_300')return json({id:'200_300',message:row.text,from:{id:'900'},object:{id:'100_200'},can_comment:true});
    if(path==='200')return json({id:'200',owner:{id:'100'}});
    if(path==='100_200')return json({id:'100_200',from:{id:'100'}});
    if(init.method==='POST'&&(path==='300/replies'||path==='200_300/comments'))return json({id:'400'});
    if(init.method==='GET'&&(path==='300/replies'||path==='200_300/comments'))return json({data:[]});
    if(path==='400')return json(platform==='instagram'?{id:'400',text:'최종 답장',parent_id:'300',media:{id:'200'},user:{id:'100'},timestamp:at}:{id:'400',message:'최종 답장',parent:{id:'200_300'},object:{id:'100_200'},from:{id:'100'},created_time:at});
    throw Error('Unexpected fake endpoint '+path);
  };
  const create=extra=>createSocialReplies({store,fetchImpl,clock:()=>at,...extra}),service=create();
  const preview=(message='최종 답장',user=member,context={})=>service.preview(user,{inboxId:'inbox',revision:store.get('socialInbox','inbox').revision,text:message},context);
  const send=(p,user=member,context={})=>service.send(user,{previewId:p.preview.id,confirmationToken:p.confirmationToken,idempotencyKey:p.idempotencyKey},context);
  return {store,admin,member,viewer,other,channel,credentials,row,calls,service,create,preview,send,setHandler:value=>handler=value,advance:ms=>at=new Date(Date.parse(at)+ms).toISOString(),enable:()=>store.put('socialInboxConnections','channel',{id:'channel',enabled:true,version:'config-1',updatedBy:'member'})};
}

test('Facebook object omission proves the original on every page of its owned post before preview and send',async t=>{
  const f=fixture(t,{platform:'facebook'});let lists=0;
  f.setHandler((path,url)=>{
    if(path==='200_300')return json({id:'200_300',message:f.row.text,from:{id:'900'},can_comment:true});
    if(path==='100_200/comments'){lists++;assert.equal(url.searchParams.get('filter'),'toplevel');return url.searchParams.get('after')?json({data:[{id:'200_300',message:f.row.text}]}):json({data:[{id:'200_299',message:'다른 댓글'}],paging:{next:'https://graph.facebook.com/unused',cursors:{after:'next-page'}}});}
  });
  const preview=await f.preview();assert.equal(lists,2);assert.ok(f.calls.every(c=>c.init.method==='GET'));assert.equal((await f.send(preview)).attempt.status,'sent');assert.equal(lists,4);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
});

test('Facebook object omission rejects incomplete or conflicting parent-post membership and never sends',async t=>{
  for(const mode of ['missing','wrong-text','nested','hidden','duplicate','missing-cursor','repeated-cursor','late-error','limit','account','explicit-object']){
    await t.test(mode,async t=>{const f=fixture(t,{platform:'facebook'});let lists=0;
      f.setHandler((path,url)=>{
        if(path==='200_300')return json({id:'200_300',message:f.row.text,from:{id:'900'},can_comment:true,...(mode==='explicit-object'?{object:{id:'999'}}:{})});
        if(path==='100_200'&&mode==='account')return json({id:'100_200',from:{id:'999'}});
        if(path!=='100_200/comments')return;
        lists++;const item={id:'200_300',message:mode==='wrong-text'?'바뀐 댓글':f.row.text,...(mode==='nested'?{parent:{id:'999'}}:{}),...(mode==='hidden'?{is_hidden:true}:{})};
        if(mode==='late-error'&&url.searchParams.has('after'))return json({error:{code:2}},503);
        const unfinished=['missing-cursor','repeated-cursor','late-error','limit'].includes(mode);
        return json({data:mode==='missing'?[]:mode==='duplicate'?[item,item]:lists===1||!unfinished?[item]:[],...(unfinished?{paging:{next:'https://graph.facebook.com/unused',...(mode==='missing-cursor'?{}:{cursors:{after:mode==='limit'?'page-'+lists:'same-cursor'}})}}:{})});
      });
      await assert.rejects(f.preview());assert.equal(f.store.all('socialReplyPreviews').length,0);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);assert.ok(lists<=4);if(['account','explicit-object'].includes(mode))assert.equal(lists,0);
    });
  }
});

test('Facebook object omission rechecks completed membership at send time',async t=>{
  const f=fixture(t,{platform:'facebook'});let exists=true;
  f.setHandler(path=>path==='200_300'?json({id:'200_300',message:f.row.text,can_comment:true}):path==='100_200/comments'?json({data:exists?[{id:'200_300',message:f.row.text}]:[]}):null);
  const preview=await f.preview();exists=false;const result=await f.send(preview);assert.equal(result.attempt.status,'failed');assert.equal(result.attempt.errorCode,'COMMENT_MISMATCH');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);
});

test('Facebook object omission on reply proof uses its exact parent after current parent-post verification',async t=>{
  const f=fixture(t,{platform:'facebook'});let lost=false,wrongObject=true;
  f.setHandler((path,_url,init)=>{
    if(path==='200_300')return json({id:'200_300',message:f.row.text,can_comment:true});
    if(path==='100_200/comments')return json({data:[{id:'200_300',message:f.row.text}]});
    if(init.method==='POST'&&lost)throw Error('network lost');
    if(path==='400')return json({id:'400',message:'최종 답장',parent:{id:'200_300'},from:{id:'100'},created_time:'2026-10-13T00:00:00Z',...(wrongObject?{object:{id:'999'}}:{})});
  });
  const preview=await f.preview();lost=true;const {attempt}=await f.send(preview);assert.equal(attempt.status,'unknown');const before=f.calls.length;
  await assert.rejects(f.service.reconcile(f.member,{attemptId:attempt.id,remoteReplyId:'400'}),{code:'REPLY_PROOF_MISMATCH'});assert.equal(f.store.get('socialReplyAttempts',attempt.id).status,'unknown');
  wrongObject=false;const proved=await f.service.reconcile(f.member,{attemptId:attempt.id,remoteReplyId:'400'});assert.equal(proved.attempt.status,'sent');assert.ok(f.calls.slice(before).every(c=>c.init.method==='GET'));assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
});

test('explicit Instagram preview is read only, stores only token hash and sends final text once',async t=>{
  const f=fixture(t),p=await f.preview();assert.equal(p.preview.account.channelId,'channel');assert.equal(p.preview.comment.text,'질문입니다');assert.equal(p.preview.text,'최종 답장');assert.equal(f.calls.length,4);assert.ok(f.calls.every(c=>c.init.method==='GET'));
  const stored=f.store.get('socialReplyPreviews',p.preview.id);assert.notEqual(stored.tokenHash,p.confirmationToken);assert.ok(!JSON.stringify(stored).includes(p.confirmationToken));
  const {attempt}=await f.send(p);assert.equal(attempt.status,'sent');assert.equal(attempt.remoteReplyId,'400');const writes=f.calls.filter(c=>c.init.method==='POST');assert.equal(writes.length,1);assert.equal(new URL(writes[0].url).pathname,'/v26.0/300/replies');assert.equal(new URLSearchParams(writes[0].init.body).get('message'),'최종 답장');
  assert.ok(f.calls.every(c=>new URL(c.url).origin==='https://graph.instagram.com'&&c.init.redirect==='error'&&!c.url.includes('secret')));assert.ok(!JSON.stringify(attempt).includes('secret'));
  const row=f.store.get('socialInbox','inbox');assert.equal(row.replyDraft,'저장된 초안');assert.equal(row.status,'open');assert.equal(row.outboundSent,true);assert.equal(row.revision,2);assert.equal((await f.send(p)).attempt.id,attempt.id);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
});

test('IG Login uses canonical user_id for binding and live app-scoped id for media ownership',async t=>{
  const f=fixture(t);f.store.setSecret('channel:channel',{...f.credentials,accountId:'100',appScopedId:'900',metaIdentityVersion:1});f.setHandler(path=>path==='me'?json({id:'900',user_id:'100',username:'synk'}):path==='200'?json({id:'200',owner:{id:'900'}}):null);const preview=await f.preview();assert.equal((await f.send(preview)).attempt.status,'sent');
  const g=fixture(t);g.store.setSecret('channel:channel',{...g.credentials,accountId:'100',appScopedId:'999',metaIdentityVersion:1});g.setHandler(path=>path==='me'?json({id:'900',user_id:'100',username:'synk'}):path==='200'?json({id:'200',owner:{id:'999'}}):null);await assert.rejects(g.preview(),{code:'ACCOUNT_MISMATCH'});assert.equal(g.calls.filter(call=>call.init.method==='POST').length,0);
});

test('Facebook user connection resolves Page MODERATE token and uses comment comments endpoint',async t=>{
  const f=fixture(t,{platform:'facebook',authType:'facebook-user'}),p=await f.preview();const result=await f.send(p);assert.equal(result.attempt.status,'sent');const post=f.calls.find(c=>c.init.method==='POST');assert.equal(new URL(post.url).pathname,'/v26.0/200_300/comments');assert.equal(post.init.headers.Authorization,'Bearer synthetic-page-secret');assert.ok(f.calls.every(c=>new URL(c.url).origin==='https://graph.facebook.com'));
});

test('manual records, messages, nested replies, missing write scopes and nonowners never call Meta',async t=>{
  for(const update of [{source:'manual'},{kind:'dm'},{parentExternalId:'299'},{deleted:true},{contentTruncated:true},{sourceAccountId:'999'}]){const f=fixture(t);f.store.put('socialInbox','inbox',{...f.row,...update});await assert.rejects(f.preview());assert.equal(f.calls.length,0);assert.equal(f.service.workspace(f.member).items[0].canReply,false);}
  const f=fixture(t,{platform:'facebook',scope:'pages_read_engagement pages_read_user_content'});await assert.rejects(f.preview(),{code:'SCOPES_REQUIRED'});assert.equal(f.calls.length,0);assert.deepEqual(f.service.workspace(f.member).items[0].missingScopes,['pages_manage_engagement']);
  await assert.rejects(f.preview('문구',f.viewer),{code:'CHANNEL_FORBIDDEN'});await assert.rejects(f.preview('문구',f.other),{code:'CHANNEL_FORBIDDEN'});assert.deepEqual(f.service.workspace(f.other),{items:[],attempts:[]});
});

test('remote original comment, post owner and Page moderation capability are verified',async t=>{
  for(const mode of ['account','post','comment','parent']){const f=fixture(t);f.setHandler(path=>mode==='account'&&path==='me'?json({id:'999',username:'other'}):mode==='post'&&path==='200'?json({id:'200',owner:{id:'999'}}):mode==='comment'&&path==='300'?json({id:'300',text:'수정됨',media:{id:'200'}}):mode==='parent'&&path==='300'?json({id:'300',text:f.row.text,media:{id:'999'}}):null);await assert.rejects(f.preview());assert.equal(f.store.all('socialReplyPreviews').length,0);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);}
  const f=fixture(t,{platform:'facebook',authType:'facebook-user'});f.setHandler(path=>path==='me/accounts'?json({data:[{id:'100',access_token:'secret',tasks:['ANALYZE']}]}):null);await assert.rejects(f.preview(),{code:'PAGE_ACCESS_REQUIRED'});
});

test('preview expires and draft or target changes require a fresh explicit confirmation',async t=>{
  for(const mode of ['expired','revision','credential','channel','token']){const f=fixture(t),p=await f.preview();if(mode==='expired')f.advance(120000);if(mode==='revision')f.store.put('socialInbox','inbox',{...f.row,revision:2,replyDraft:'새 초안'});if(mode==='credential')f.store.setSecret('channel:channel',{...f.credentials,accessToken:'new'});if(mode==='channel')f.store.put('channels','channel',{...f.channel,connectionVersion:2});if(mode==='token')p.confirmationToken='invalid';await assert.rejects(f.send(p));assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);}
});

test('revoked session and connection generation changes during preparation prevent submission',async t=>{
  for(const mode of ['session','user','config','credentials']){const f=fixture(t),p=await f.preview();let allowed=true;f.setHandler(path=>{if(path==='200'){if(mode==='session')allowed=false;if(mode==='user')f.store.put('users','member',{...f.member,active:false});if(mode==='config')f.store.put('socialInboxConnections','channel',{id:'channel',version:'new'});if(mode==='credentials')f.store.setSecret('channel:channel',{...f.credentials,accessToken:'changed'});}});const context={authorize(){if(!allowed)throw Object.assign(Error('revoked'),{status:401});}};try{await f.send(p,f.member,context);}catch{}assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);const ledger=f.store.all('socialReplyAttempts');assert.equal(ledger[0].status,'failed');assert.equal(ledger[0].retryable,true);}
});

test('same key and separate confirmed previews cannot duplicate a concurrent submission',async t=>{
  const f=fixture(t),first=await f.preview(),second=await f.preview();let release,entered;const reached=new Promise(r=>entered=r);f.setHandler((path,_url,init)=>{if(init.method==='POST'){entered();return new Promise(r=>release=()=>r(json({id:'400'})));}});
  const sending=f.send(first);await reached;const same=await f.send(first),other=await f.send(second);assert.equal(same.attempt.status,'submitting');assert.equal(other.attempt.id,same.attempt.id);await assert.rejects(f.preview('다른 문구'),{code:'REPLY_PENDING'});release();assert.equal((await sending).attempt.status,'sent');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
});

test('ambiguous outcomes persist across restart and block even different text or keys',async t=>{
  for(const mode of ['network','500','malformed','no-id']){const f=fixture(t),p=await f.preview();f.setHandler((_path,_url,init)=>{if(init.method==='POST'){if(mode==='network')throw Error('private-secret');if(mode==='500')return json({error:{message:'private-secret'}},500);if(mode==='malformed')return new Response('private-secret');return json({ok:true});}});const result=await f.send(p);assert.equal(result.attempt.status,'unknown');assert.equal(result.attempt.retryable,false);assert.ok(!JSON.stringify(result).includes('secret'));const restarted=f.create();assert.equal((await restarted.send(f.member,{previewId:p.preview.id,confirmationToken:p.confirmationToken,idempotencyKey:p.idempotencyKey})).attempt.status,'unknown');await assert.rejects(restarted.preview(f.member,{inboxId:'inbox',revision:1,text:'다르게 쓴 문구'}),{code:'REPLY_PENDING'});assert.equal(restarted.workspace(f.member).items[0].canReply,false);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);}
});

test('unknown result reconciles only by read proof of exact account, parent, post and text',async t=>{
  for(const platform of ['instagram','facebook']){const f=fixture(t,{platform}),p=await f.preview();f.setHandler((_path,_url,init)=>{if(init.method==='POST')throw Error('lost');});const {attempt}=await f.send(p);f.setHandler(null);const before=f.calls.length,result=await f.service.reconcile(f.member,{attemptId:attempt.id,remoteReplyId:'400'});assert.equal(result.attempt.status,'sent');assert.equal(result.attempt.remoteReplyId,'400');assert.ok(f.calls.slice(before).every(c=>c.init.method==='GET'));assert.equal(f.store.get('socialInbox','inbox').outboundSent,true);assert.equal(f.service.workspace(f.member).items[0].canReply,true);}
});

test('reconciliation cannot attach another reply, old reply, arbitrary URL, or write after revocation',async t=>{
  for(const update of [{user:{id:'999'}},{parent_id:'999'},{text:'다른 문구'},{media:{id:'999'}},{timestamp:'2026-10-12T00:00:00Z'}]){const f=fixture(t),p=await f.preview();f.setHandler((_path,_url,init)=>{if(init.method==='POST')throw Error('lost');});const {attempt}=await f.send(p);f.setHandler(path=>path==='400'?json({id:'400',text:'최종 답장',parent_id:'300',media:{id:'200'},user:{id:'100'},...update}):null);await assert.rejects(f.service.reconcile(f.member,{attemptId:attempt.id,remoteReplyId:'400'}),{code:'REPLY_PROOF_MISMATCH'});assert.equal(f.store.get('socialReplyAttempts',attempt.id).status,'unknown');}
  const f=fixture(t),p=await f.preview();f.setHandler((_path,_url,init)=>{if(init.method==='POST')throw Error('lost');});const {attempt}=await f.send(p);const before=f.calls.length;await assert.rejects(f.service.reconcile(f.member,{attemptId:attempt.id,remoteReplyId:'https://evil.test/400'}),{code:'INVALID_REPLY_ID'});assert.equal(f.calls.length,before);f.setHandler(path=>{if(path==='400')f.store.put('users','member',{...f.member,active:false});});await assert.rejects(f.service.reconcile(f.member,{attemptId:attempt.id,remoteReplyId:'400'}));assert.equal(f.store.get('socialReplyAttempts',attempt.id).status,'unknown');
});

test('definitive rejection may be tried only through a fresh preview, and remote rate limit persists',async t=>{
  const f=fixture(t),p=await f.preview();f.setHandler((_path,_url,init)=>init.method==='POST'?json({error:{code:100,message:'private-secret'}},400):null);assert.equal((await f.send(p)).attempt.status,'failed');f.setHandler(null);assert.equal((await f.send(await f.preview())).attempt.status,'sent');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,2);
  const limited=fixture(t);limited.setHandler(path=>path==='me'?json({error:{code:613,message:'private-secret'}},429,{'retry-after':'600'}):null);await assert.rejects(limited.preview(),{code:'META_RATE_LIMIT'});const count=limited.calls.length;await assert.rejects(limited.create().preview(limited.member,{inboxId:'inbox',revision:1,text:'최종 답장'}),{code:'META_RATE_LIMIT'});assert.equal(limited.calls.length,count);assert.ok(limited.store.get('socialInboxRequests','channel').retryAt);assert.ok(limited.store.get('socialReplyRequests','channel').retryAt);
});

test('restart lease recovery distinguishes unsubmitted preparation from possible external submission',async t=>{
  for(const status of ['preparing','submitting']){const f=fixture(t);f.store.put('socialReplyAttempts','crashed',{id:'crashed',inboxId:'inbox',channelId:'channel',sourceAccountId:'100',externalId:'300',status,leaseUntil:'2026-10-12T00:00:00Z',text:'최종 답장'});const latest=f.service.workspace(f.member).items[0].latestAttempt;assert.equal(latest.status,status==='preparing'?'failed':'unknown');assert.equal(latest.retryable,status==='preparing');if(status==='submitting')await assert.rejects(f.preview('새 문구'),{code:'REPLY_PENDING'});else assert.ok((await f.preview()).confirmationToken);}
});

test('successful external acceptance is durable even if local access is revoked during POST',async t=>{
  const f=fixture(t),p=await f.preview();f.setHandler((_path,_url,init)=>{if(init.method==='POST'){f.store.put('users','member',{...f.member,active:false});return json({id:'400'});}});await assert.rejects(f.send(p),{code:'AUTH_REQUIRED'});assert.equal(f.store.get('socialReplyAttempts',p.idempotencyKey).status,'sent');assert.equal(f.store.get('socialInbox','inbox').outboundSent,true);
});

test('shutdown aborts active POST, waits for durable unknown state and refuses new work',async t=>{
  const f=fixture(t),p=await f.preview();let entered;const started=new Promise(r=>entered=r);f.setHandler((_path,_url,init)=>{if(init.method==='POST'){entered();return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});const sending=f.send(p);const rejected=assert.rejects(sending);await started;await f.service.stop();await rejected;await f.service.waitForIdle();assert.equal(f.store.get('socialReplyAttempts',p.idempotencyKey).status,'unknown');await assert.rejects(f.preview(),{code:'REPLY_STOPPED'});
});

test('native health separates local scope readiness, actual account match and cached API status',async t=>{
  const f=fixture(t);assert.equal(f.service.health(f.member).channels[0].stale,true);assert.equal(f.calls.length,0);const initial=await f.service.checkHealth(f.member,{channelId:'channel'});assert.equal(initial.channels[0].state,'connected');assert.equal(initial.channels[0].apiState,'connected');assert.equal(initial.channels[0].stale,false);const count=f.calls.length;assert.equal((await f.service.checkHealth(f.member,{channelId:'channel'})).cached,true);assert.equal(f.calls.length,count);
  f.advance(3600001);assert.equal(f.service.health(f.member).channels[0].stale,true);f.setHandler(path=>path==='me'?json({id:'999',username:'different'}):null);const mismatch=await f.service.checkHealth(f.member,{channelId:'channel'});assert.equal(mismatch.channels[0].apiState,'connected');assert.equal(mismatch.channels[0].state,'mismatch');assert.equal(mismatch.channels[0].stale,true);
  f.store.setSecret('channel:channel',{...f.credentials,accessToken:'new-generation'});assert.equal(f.service.health(f.member).channels[0].state,'unknown');assert.equal(f.service.health(f.member).channels[0].checkedAt,null);
});

test('native health generation/session races discard old results and joined callers reauthorize',async t=>{
  for(const mode of ['credentials','user','session']){const f=fixture(t);let allowed=true;f.setHandler(path=>{if(path==='me'){if(mode==='credentials')f.store.setSecret('channel:channel',{...f.credentials,accessToken:'new'});if(mode==='user')f.store.put('users','member',{...f.member,active:false});if(mode==='session')allowed=false;}});await assert.rejects(f.service.checkHealth(f.member,{channelId:'channel'},{authorize(){if(!allowed)throw Error('revoked');}}));assert.ok(!f.store.get('socialNativeHealth','channel').checkedAt);}
  const f=fixture(t);let release,entered,allowed=true;const started=new Promise(r=>entered=r);f.setHandler(path=>path==='me'?(entered(),new Promise(r=>release=()=>r(json({id:'100',username:'synk'})))):null);const first=f.service.checkHealth(f.member,{channelId:'channel'});await started;const second=f.service.checkHealth(f.member,{channelId:'channel'},{authorize(){if(!allowed)throw Error('revoked');}});const rejected=assert.rejects(second);allowed=false;release();await first;await rejected;assert.equal(f.calls.length,1);
});

test('native scans are opt in, bounded, fair, failure aware and skip unavailable credentials',async t=>{
  const f=fixture(t);assert.deepEqual(await f.service.scanHealthDue(),{checked:0,failed:0});assert.equal(f.calls.length,0);f.enable();f.setHandler(path=>path==='me'?json({error:{code:190}},400):null);assert.deepEqual(await f.service.scanHealthDue(),{checked:1,failed:1});assert.equal((await f.service.scanHealthDue()).checked,0);
  for(let i=1;i<=11;i++){const c={...f.channel,id:'channel-'+i};f.store.put('channels',c.id,c);f.store.setSecret('channel:'+c.id,f.credentials);f.store.put('socialInboxConnections',c.id,{id:c.id,enabled:true,version:'v',updatedBy:'member'});}f.setHandler(null);assert.equal((await f.service.scanHealthDue()).checked,10);f.advance(3600000);await f.service.scanHealthDue();assert.ok(f.store.get('socialNativeHealth','channel-11')?.checkedAt);
  f.store.setSecret('channel:channel',{...f.credentials,expiresAt:'2026-01-01T00:00:00Z'});f.advance(3600000);const before=f.calls.length;const result=await f.service.checkHealth(f.member,{channelId:'channel'});assert.equal(result.channels.find(c=>c.channelId==='channel').canCheck,false);assert.equal(f.calls.length,before);assert.ok(f.calls.every(c=>c.init.method==='GET'));
});

test('an observed native reply marks answered without forging a send and needs explicit acknowledgment',async t=>{
  const f=fixture(t);f.setHandler((path,_url,init)=>path==='300/replies'&&init.method==='GET'?json({data:[{id:'501',from:{id:'100'},parent_id:'300',timestamp:'2026-10-13T00:00:00Z'}]}):null);
  await assert.rejects(f.preview(),{code:'EXISTING_REPLY_REQUIRES_CONFIRMATION'});
  const item=f.service.workspace(f.member).items[0],row=f.store.get('socialInbox','inbox');
  assert.equal(item.alreadyAnswered,true);assert.equal(item.effectiveStatus,'answered');assert.equal(item.observedReply.knownLocal,false);
  assert.equal(row.status,'open');assert.equal(row.outboundSent,false);assert.equal(f.store.all('socialReplyAttempts').length,0);
  const p=await f.service.preview(f.member,{inboxId:'inbox',revision:row.revision,text:'추가 답변',observedReplyAcknowledgmentKey:item.observedReplyAcknowledgmentKey});
  assert.equal(p.preview.observedReply.replyCount,1);assert.equal((await f.send(p)).attempt.status,'sent');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
});

test('a reply created on Instagram after preview prevents POST and preserves the observation',async t=>{
  const f=fixture(t),p=await f.preview();f.setHandler((path,_url,init)=>path==='300/replies'&&init.method==='GET'?json({data:[{id:'502',user:{id:'100'},parent_id:'300'}]}):null);
  const result=await f.send(p);assert.equal(result.attempt.status,'failed');assert.equal(result.attempt.errorCode,'REPLY_HISTORY_CHANGED');
  assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);assert.equal(f.store.get('socialInbox','inbox').outboundSent,false);assert.equal(f.service.workspace(f.member).items[0].effectiveStatus,'answered');
});

test('matching names cannot prove reply ownership and missing or conflicting author IDs fail closed',async t=>{
  const f=fixture(t);f.setHandler((path,_url,init)=>path==='300/replies'&&init.method==='GET'?json({data:[{id:'503',from:{id:'900'},username:'synk'}]}):null);
  const p=await f.preview();assert.equal(p.preview.observedReply,null);assert.equal(f.service.workspace(f.member).items[0].alreadyAnswered,false);
  for(const reply of [{id:'504',username:'synk'},{id:'505',from:{id:'100'},user:{id:'900'}},{id:'506',from:{id:'100'},parent_id:'999'}]){
    const g=fixture(t);g.setHandler((path,_url,init)=>path==='300/replies'&&init.method==='GET'?json({data:[reply]}):null);await assert.rejects(g.preview());assert.equal(g.calls.filter(c=>c.init.method==='POST').length,0);assert.equal(g.store.all('socialReplyPreviews').length,0);
  }
});

test('current canonical and live app-scoped IDs recognize owned replies, including Facebook',async t=>{
  const f=fixture(t);f.store.setSecret('channel:channel',{...f.credentials,accountId:'100',appScopedId:'901',metaIdentityVersion:1});
  f.setHandler((path,_url,init)=>path==='me'?json({id:'901',user_id:'100',username:'synk'}):path==='300/replies'&&init.method==='GET'?json({data:[{id:'507',from:{id:'901'}}]}):null);
  await assert.rejects(f.preview(),{code:'EXISTING_REPLY_REQUIRES_CONFIRMATION'});
  const g=fixture(t,{platform:'facebook'});g.setHandler((path,_url,init)=>path==='200_300/comments'&&init.method==='GET'?json({data:[{id:'200_507',from:{id:'100'},parent:{id:'200_300'}}]}):null);
  await assert.rejects(g.preview(),{code:'EXISTING_REPLY_REQUIRES_CONFIRMATION'});assert.equal(g.service.workspace(g.member).items[0].effectiveStatus,'answered');
});

test('reply history follows bounded cursors on the fixed origin and rejects incomplete histories',async t=>{
  const f=fixture(t);f.setHandler((path,url,init)=>path==='300/replies'&&init.method==='GET'?json(url.searchParams.get('after')?{data:[{id:'508',from:{id:'100'}}]}:{data:[{id:'509',from:{id:'900'}}],paging:{next:'https://untrusted.invalid/steal',cursors:{after:'page-2'}}}):null);
  await assert.rejects(f.preview(),{code:'EXISTING_REPLY_REQUIRES_CONFIRMATION'});assert.ok(f.calls.every(c=>new URL(c.url).origin==='https://graph.instagram.com'));
  for(const paging of [{next:'https://untrusted.invalid/'},{next:'https://untrusted.invalid/',cursors:{after:'same'}}]){
    const g=fixture(t);g.setHandler((path,_url,init)=>path==='300/replies'&&init.method==='GET'?json({data:[],paging}):null);await assert.rejects(g.preview(),{code:'REPLY_HISTORY_INCOMPLETE'});assert.equal(g.calls.filter(c=>c.init.method==='POST').length,0);
  }
});

test('authority or credentials revoked during history GET cannot save an observation or send',async t=>{
  for(const mode of ['credentials','role']){
    const f=fixture(t);f.setHandler((path,_url,init)=>{
      if(path!=='300/replies'||init.method!=='GET')return null;
      if(mode==='credentials')f.store.setSecret('channel:channel',{...f.credentials,accessToken:'changed'});
      else f.store.put('users','member',{...f.member,active:false});
      return json({data:[{id:'510',from:{id:'100'}}]});
    });
    await assert.rejects(f.preview());assert.equal(f.store.get('socialInbox','inbox').externalReplyEvidence,undefined);assert.equal(f.store.all('socialReplyPreviews').length,0);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);
  }
});

test('removed remote replies reset observed state only after a complete read and invalidate the old preview',async t=>{
  const f=fixture(t);f.setHandler((path,_url,init)=>path==='300/replies'&&init.method==='GET'?json({data:[{id:'511',from:{id:'100'}}]}):null);
  await assert.rejects(f.preview(),{code:'EXISTING_REPLY_REQUIRES_CONFIRMATION'});const item=f.service.workspace(f.member).items[0];
  assert.deepEqual(f.store.get('socialInbox','inbox').metaReplyProofIds,['511']);
  const parent=f.store.get('socialInbox','inbox');f.store.put('socialInbox','child',{...parent,id:'child',externalId:'511',parentExternalId:parent.externalId,metaAccountReply:{connectionVersion:f.channel.connectionVersion,confirmed:true,hidden:true}});
  const p=await f.service.preview(f.member,{inboxId:'inbox',revision:f.store.get('socialInbox','inbox').revision,text:'추가 답변',observedReplyAcknowledgmentKey:item.observedReplyAcknowledgmentKey});
  assert.equal(f.store.get('socialInbox','child').metaAccountReply.hidden,false);
  f.setHandler(null);const result=await f.send(p);assert.equal(result.attempt.errorCode,'REPLY_HISTORY_CHANGED');assert.equal(f.service.workspace(f.member).items[0].alreadyAnswered,false);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);
  assert.deepEqual(f.store.get('socialInbox','inbox').metaReplyProofIds,[]);assert.equal(f.store.get('socialInbox','child').metaAccountReply.confirmed,false);assert.ok(f.store.get('socialInbox','inbox').metaReplyCompleteAt);
});

test('observations from a previous connection or manual item do not mark the current inbox answered',async t=>{
  const f=fixture(t);f.setHandler((path,_url,init)=>path==='300/replies'&&init.method==='GET'?json({data:[{id:'512',from:{id:'100'}}]}):null);
  await assert.rejects(f.preview(),{code:'EXISTING_REPLY_REQUIRES_CONFIRMATION'});assert.equal(f.service.workspace(f.member).items[0].alreadyAnswered,true);
  f.store.put('channels','channel',{...f.channel,connectionVersion:2});assert.equal(f.service.workspace(f.member).items[0].alreadyAnswered,false);assert.equal(f.service.workspace(f.member).items[0].observedReplyAcknowledgmentKey,null);
  f.store.put('channels','channel',f.channel);const row=f.store.get('socialInbox','inbox');f.store.put('socialInbox','inbox',{...row,source:'manual'});assert.equal(f.service.workspace(f.member).items[0].effectiveStatus,'open');
  assert.equal(f.store.all('socialReplyAttempts').length,0);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);
});

test('confirmed current public own replies are not unanswered incoming work and never become local sends',async t=>{
  const f=fixture(t),parent=f.store.get('socialInbox','inbox'),child={...parent,id:'own-child',externalId:'513',parentExternalId:parent.externalId,metaAccountReply:{connectionVersion:f.channel.connectionVersion,confirmed:true,hidden:false}};
  f.store.put('socialInbox',child.id,child);const get=()=>f.service.workspace(f.member).items.find(row=>row.inboxId===child.id);
  assert.equal(get().isAccountReply,true);assert.equal(get().effectiveStatus,'answered');assert.notEqual(f.store.get('socialInbox',child.id).outboundSent,true);assert.equal(f.store.get('socialInbox',child.id).status,'open');
  for(const proof of [{...child.metaAccountReply,hidden:true},{...child.metaAccountReply,confirmed:false},{...child.metaAccountReply,connectionVersion:99}]){f.store.put('socialInbox',child.id,{...child,metaAccountReply:proof});assert.equal(get().isAccountReply,false);assert.equal(get().effectiveStatus,'open');}
  assert.equal(f.store.all('socialReplyAttempts').length,0);assert.equal(f.calls.length,0);
});

test('an unknown reply is rechecked on the platform: an exact own reply confirms it, no own reply clears it, anything else keeps it unknown',async t=>{
  const lost=async f=>{const p=await f.preview();f.setHandler((_path,_url,init)=>{if(init.method==='POST')throw Error('lost');});const {attempt}=await f.send(p);f.setHandler(null);assert.equal(attempt.status,'unknown');return attempt;};
  const listing=(f,data)=>f.setHandler((path,_url,init)=>init.method==='GET'&&path==='300/replies'?json({data}):path==='401'||path==='403'?json({id:path,text:'다른 문구',parent_id:'300',media:{id:'200'},user:{id:'100'},...(path==='401'?{timestamp:'2026-10-13T00:01:00Z'}:{})}):null);
  {const f=fixture(t),attempt=await lost(f),before=f.calls.length;await assert.rejects(f.service.recheck(f.member,{attemptId:attempt.id}),{code:'RECHECK_TOO_EARLY'});assert.equal(f.calls.length,before,'no Meta request before the settle window');assert.equal(f.store.get('socialReplyAttempts',attempt.id).status,'unknown');
    f.advance(11*60000);await assert.rejects(f.service.recheck(f.viewer,{attemptId:attempt.id}),{code:'CHANNEL_FORBIDDEN'});assert.equal(f.store.get('socialReplyAttempts',attempt.id).status,'unknown');}
  for(const platform of ['instagram','facebook']){const f=fixture(t,{platform}),attempt=await lost(f);f.advance(11*60000);const before=f.calls.length,{attempt:after}=await f.service.recheck(f.member,{attemptId:attempt.id});
    assert.equal(after.status,'failed');assert.equal(after.errorCode,'REPLY_NOT_POSTED');assert.ok(f.calls.slice(before).every(c=>c.init.method==='GET'),'rechecking never writes');assert.equal(f.service.workspace(f.member).items[0].canReply,true);
    await assert.rejects(f.service.recheck(f.member,{attemptId:attempt.id}),{code:'RECHECK_NOT_NEEDED'});const {attempt:second}=await f.send(await f.preview());assert.equal(second.status,'sent');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,2);}
  {const f=fixture(t),attempt=await lost(f);f.advance(11*60000);listing(f,[{id:'400',from:{id:'100'},parent_id:'300',timestamp:'2026-10-13T00:01:00Z'}]);const {attempt:after}=await f.service.recheck(f.member,{attemptId:attempt.id});
    assert.equal(after.status,'sent');assert.equal(after.remoteReplyId,'400');assert.equal(f.store.get('socialInbox','inbox').outboundSent,true);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);}
  for(const reply of [{id:'401',from:{id:'100'},parent_id:'300',timestamp:'2026-10-13T00:01:00Z'},{id:'403',from:{id:'100'},parent_id:'300'}]){
    const f=fixture(t),attempt=await lost(f);f.advance(11*60000);listing(f,[reply]);await assert.rejects(f.service.recheck(f.member,{attemptId:attempt.id}),{code:'RECHECK_AMBIGUOUS'});assert.equal(f.store.get('socialReplyAttempts',attempt.id).status,'unknown');assert.equal(f.service.workspace(f.member).items[0].canReply,false);}
  for(const reply of [{id:'402',from:{id:'777'},parent_id:'300',timestamp:'2026-10-13T00:01:00Z'},{id:'404',from:{id:'100'},parent_id:'300',timestamp:'2026-10-12T23:00:00Z'}]){
    const f=fixture(t),attempt=await lost(f);f.advance(11*60000);listing(f,[reply]);const {attempt:after}=await f.service.recheck(f.member,{attemptId:attempt.id});assert.equal(after.status,'failed',reply.id);assert.equal(f.service.workspace(f.member).items[0].canReply,true);}
});

test('a reply proven by its ID is recorded as sent even when a list check closed it first, and a hidden own reply counts as sent',async t=>{
  const lost=async f=>{const p=await f.preview();f.setHandler((_path,_url,init)=>{if(init.method==='POST')throw Error('lost');});const {attempt}=await f.send(p);f.setHandler(null);assert.equal(attempt.status,'unknown');return attempt;};
  {const f=fixture(t),attempt=await lost(f);f.advance(11*60000);let release,entered;const gate=new Promise(r=>release=r),reached=new Promise(r=>entered=r);
    f.setHandler(async(path,_url,init)=>{if(init.method==='GET'&&path==='400'){entered();await gate;}return null;});
    const proving=f.service.reconcile(f.member,{attemptId:attempt.id,remoteReplyId:'400'});await reached;
    const {attempt:listed}=await f.service.recheck(f.member,{attemptId:attempt.id});assert.equal(listed.status,'failed');assert.equal(listed.errorCode,'REPLY_NOT_POSTED','the late reply list closes it first');
    release();const {attempt:proved}=await proving;assert.equal(proved.status,'sent');assert.equal(proved.remoteReplyId,'400');
    assert.equal(f.store.get('socialReplyAttempts',attempt.id).verifiedAbsent,false);assert.equal(f.store.get('socialInbox','inbox').outboundSent,true);}
  const hidden={id:'400',text:'최종 답장',parent_id:'300',media:{id:'200'},user:{id:'100'},timestamp:'2026-10-13T00:00:00.000Z',hidden:true};
  {const f=fixture(t),attempt=await lost(f);f.advance(11*60000);
    f.setHandler((path,_url,init)=>init.method==='GET'&&path==='300/replies'?json({data:[{id:'400',from:{id:'100'},parent_id:'300',timestamp:'2026-10-13T00:00:00.000Z',hidden:true}]}):init.method==='GET'&&path==='400'?json(hidden):null);
    const {attempt:after}=await f.service.recheck(f.member,{attemptId:attempt.id});assert.equal(after.status,'sent');assert.match(after.message,/숨김/);assert.equal(f.store.get('socialReplyAttempts',attempt.id).hiddenOnPlatform,true);assert.equal(f.service.workspace(f.member).items[0].canReply,true);}
  {const f=fixture(t),attempt=await lost(f);f.setHandler((path,_url,init)=>init.method==='GET'&&path==='400'?json(hidden):null);
    const {attempt:after}=await f.service.reconcile(f.member,{attemptId:attempt.id,remoteReplyId:'400'});assert.equal(after.status,'sent');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);}
});
