import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSocialDirectMeta,credentialFailure} from './social-direct-meta.mjs';
import {createSocialDirectYouTube} from './social-direct-youtube.mjs';

// 10-20 직접 게시 점검: 보내지 않았거나 이미 게시됐는데 결과 불명확에 갇히던 경로와 인증 갱신 실패 안내.
const NOW='2026-10-14T10:00:00.000Z',JPEG=Buffer.from([255,216,255,224,0,16,74,70,73,70,0]),MP4=Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from('ftypisom00000000')]);
const digest=value=>createHash('sha256').update(value).digest('hex');
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json',...headers}});
class MemoryStore{
  rows=new Map();secrets=new Map();
  get(table,id){const value=this.rows.get(table)?.get(id);return value?structuredClone(value):null;}
  put(table,id,value){if(!this.rows.has(table))this.rows.set(table,new Map());this.rows.get(table).set(id,structuredClone(value));}
  all(table){return [...(this.rows.get(table)?.values()||[])].map(value=>structuredClone(value));}
  setSecret(id,value){this.secrets.set(id,structuredClone(value));}
  secret(id){return structuredClone(this.secrets.get(id)||null);}
  transaction(fn){return fn();}
}
const asset=(id='video',bytes=MP4)=>({id,assetId:id,sha256:digest(bytes),mimeType:bytes===MP4?'video/mp4':'image/jpeg',byteSize:bytes.length,width:1080,height:1350,...(bytes===MP4?{type:'video',duration:30}:{type:'image'}),url:'/api/social/media/'+id});
function fixture({format='reel',media=[asset()],handler,getCredentials}={}){
  const store=new MemoryStore(),calls=[];let at=Date.parse(NOW),nextContainer=600;
  const channel={id:'channel',platform:'instagram',externalId:'100',handle:'synk',active:true,ownerIds:['admin'],connectionVersion:2};
  const credentials={accessToken:'secret-token-not-for-output',accountId:'100',appScopedId:'101',authType:'instagram-login',apiVersion:'v26.0',metaIdentityVersion:1,permissionsVerifiedAt:NOW,scope:'instagram_business_basic instagram_business_content_publish'};
  store.put('channels',channel.id,channel);store.setSecret('channel:'+channel.id,credentials);store.put('socialDirectConnections',channel.id,{id:channel.id,channelId:channel.id,provider:'meta-direct',enabled:true,connectionVersion:2,accountId:'100',authType:'instagram-login',version:'connection-v1',verifiedAt:NOW});
  const post={id:'post',body:'확정 원문',ownerId:'admin'},variant={channelId:channel.id,format,text:'확정 원문',media,options:{}},job={id:'job',idempotencyKey:'dedupe-key',channelId:channel.id,postId:post.id,contentVersion:1,approvalHash:'approved',attempts:1,publisherId:'admin',snapshot:{post,variant}},input={channel,post,variant,job};
  const fetchImpl=async(raw,init)=>{const url=new URL(raw),path=url.pathname.replace(/^\/v\d+\.\d+\//,''),call={url,init,path};calls.push(call);const intercepted=await handler?.(call);if(intercepted!==undefined)return intercepted;
    if(path==='me')return json({id:'101',user_id:'100',username:'synk'});
    if(path==='100/media'&&init.method==='POST')return json({id:String(++nextContainer)});
    if(/^6\d\d$/.test(path))return json({id:path,status_code:'FINISHED'});
    if(path==='100/media_publish')return json({id:'700'});
    if(path==='700')return json({id:'700',owner:{id:'101'},caption:'확정 원문',permalink:'https://www.instagram.com/p/ABC123/',timestamp:new Date(at).toISOString()});
    throw Error('Unexpected mocked request: '+path);
  };
  const create=extra=>createSocialDirectMeta({store,fetchImpl,clock:()=>new Date(at).toISOString(),authorizePublish:async()=>{},resolveMedia:async ref=>({bytes:ref.mimeType==='video/mp4'?MP4:JPEG}),issueMediaUrl:async ref=>({url:'https://workspace.synk.im/api/social/direct-media/'+ref.id+'/grant'}),...(getCredentials?{getCredentials}:{}),wait:async ms=>{at+=ms;},...extra});
  return {store,input,calls,create,advance:ms=>{at+=ms;},now:()=>at,ledger:()=>store.all('socialDirectPublishJobs')[0],finalPosts:()=>calls.filter(c=>c.path==='100/media_publish').length};
}

test('a final publish blocked by the local request budget before sending goes back to processing and is sent once later',async()=>{
  let finished=false;
  const f=fixture({handler:c=>c.path==='601'?json({id:'601',status_code:finished?'FINISHED':'IN_PROGRESS'}):undefined});
  assert.equal((await f.create().publish(f.input)).status,'processing');
  // 지난 1시간에 118회를 이미 써서 「me」·준비 파일 조회 뒤 최종 게시 요청 직전에 자체 한도에 닿는다.
  const t=f.now();f.store.put('socialDirectPublishRequests','channel',{times:Array.from({length:118},(_,i)=>t-1000*(i+1)),retryAt:null});
  finished=true;f.advance(60000);
  const blocked=await f.create().status({channel:f.input.channel,job:f.input.job});
  assert.equal(blocked.status,'processing');assert.equal(f.ledger().status,'processing');assert.equal(f.ledger().errorCode,'META_RATE_LIMIT');assert.equal(f.finalPosts(),0);
  f.advance(2*3600000);
  const sent=await f.create().status({channel:f.input.channel,job:f.input.job});
  assert.equal(sent.status,'published');assert.equal(f.finalPosts(),1,'sent exactly once after the budget frees');
});

test('a final write cut off by a process stop is turned into an automatic check instead of waiting forever',async()=>{
  let crashed=true;
  const recent={data:[{id:'700',caption:'확정 원문',timestamp:NOW,permalink:'https://www.instagram.com/p/ABC123/'}]};
  const f=fixture({format:'image',media:[asset('image',JPEG)],handler:c=>{
    if(c.path==='100/media_publish'&&crashed)return new Promise(()=>{});
    if(c.path==='601'&&!crashed)return json({id:'601',status_code:'PUBLISHED'});
    if(c.path==='100/media'&&c.init.method==='GET')return json(recent);
    if(c.path==='700')return json({id:'700',owner:{id:'101'},caption:'확정 원문',permalink:'https://www.instagram.com/p/ABC123/',timestamp:NOW});
  }});
  void f.create().publish(f.input);
  for(let n=0;n<500&&!f.finalPosts();n++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.ledger().status,'submitting');
  crashed=false;
  // 새 프로세스: 제한 시간 안에는 기다리고, 넉넉히 지나면 원문과 대조한다. 다시 보내지는 않는다.
  f.advance(2*60000);assert.equal((await f.create().status({channel:f.input.channel,job:f.input.job})).status,'uncertain');assert.equal(f.ledger().status,'submitting');
  f.advance(8*60000);const settled=await f.create().status({channel:f.input.channel,job:f.input.job});
  assert.equal(settled.status,'published');assert.equal(f.ledger().providerId,'700');assert.equal(f.finalPosts(),1);
});

test('a transient container read on the first pass keeps the reel processing like a continuation does',async()=>{
  let failNext=true;
  const failing=fixture({handler:c=>{if(c.path==='601'){if(failNext){failNext=false;return json({error:{message:'temporary'}},500);}return json({id:'601',status_code:'IN_PROGRESS'});}}});
  const first=await failing.create().publish(failing.input);
  assert.equal(first.status,'processing');assert.equal(failing.ledger().status,'processing');assert.equal(failing.ledger().containerId,'601');
  const controller=new AbortController();let reads=0;
  const aborted=fixture({handler:c=>{if(c.path==='601'&&++reads===2){controller.abort();throw new DOMException('aborted','AbortError');}if(c.path==='601')return json({id:'601',status_code:'IN_PROGRESS'});}});
  const stopped=await aborted.create().publish({...aborted.input,signal:controller.signal});
  assert.equal(stopped.status,'processing');assert.equal(aborted.ledger().status,'processing');
  // 파일 처리 실패는 여전히 확정 실패다.
  const broken=fixture({handler:c=>c.path==='601'?json({id:'601',status_code:'ERROR'}):undefined});
  const failed=await broken.create().publish(broken.input);
  assert.equal(failed.status,'failed');assert.equal(failed.errorCode,'MEDIA_PROCESSING_FAILED');
});

test('credential refresh problems tell the publisher to wait or reconnect instead of a generic failure',async()=>{
  const waiting=credentialFailure(Object.assign(new Error('x'),{code:'oauth_unavailable',retryable:true,nextRetryAt:'2026-10-14T10:15:00.000Z'}));
  assert.deepEqual([waiting.code,waiting.retryable,waiting.nextRetryAt,waiting.providerSafe],['CREDENTIAL_REFRESH_PENDING',true,'2026-10-14T10:15:00.000Z',true]);
  for(const code of ['token_exchange_failed','reconnect_required'])assert.equal(credentialFailure(Object.assign(new Error('x'),{code})).code,'AUTH_REQUIRED');
  const other=new Error('other');assert.equal(credentialFailure(other),other);
  const f=fixture({getCredentials:async()=>{throw Object.assign(new Error('x'),{code:'oauth_unavailable',retryable:true,nextRetryAt:'2026-10-14T10:15:00.000Z'});}});
  const result=await f.create().publish(f.input);
  assert.equal(result.status,'failed');assert.equal(result.errorCode,'CREDENTIAL_REFRESH_PENDING');assert.equal(result.retryable,true);assert.match(result.message,/게시 요청은 보내지 않았어요/);
  assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);
});

test('YouTube quota and rate limits are not reported as a lost connection',async()=>{
  const store=new MemoryStore(),channel={id:'yt',platform:'youtube',externalId:'UCabcdefghijklmnopqrstuv',active:true,ownerIds:['admin'],connectionVersion:1};
  store.put('channels',channel.id,channel);store.setSecret('channel:yt',{accessToken:'synthetic',refreshToken:'r',scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',accountId:channel.externalId,authType:'google-oauth',expiresAt:'2026-10-14T11:00:00.000Z',permissionsVerifiedAt:NOW});
  store.put('socialDirectConnections',channel.id,{id:channel.id,channelId:channel.id,provider:'youtube-direct',enabled:true,connectionVersion:1,accountId:channel.externalId,version:'v1',verifiedAt:NOW});
  for(const reason of ['quotaExceeded','rateLimitExceeded','dailyLimitExceeded']){
    const youtube=createSocialDirectYouTube({store,clock:()=>NOW,fetchImpl:async()=>json({error:{code:403,errors:[{reason}]}},403)});
    await assert.rejects(youtube.checkConnection(channel),error=>error.code==='YOUTUBE_QUOTA'&&error.retryable===true,reason);
  }
  const forbidden=createSocialDirectYouTube({store,clock:()=>NOW,fetchImpl:async()=>json({error:{code:403,errors:[{reason:'forbidden'}]}},403)});
  await assert.rejects(forbidden.checkConnection(channel),{code:'AUTH_REQUIRED'});
});
