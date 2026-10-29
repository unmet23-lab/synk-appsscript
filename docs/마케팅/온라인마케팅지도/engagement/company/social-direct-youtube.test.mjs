import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createSocialDirectYouTube} from './social-direct-youtube.mjs';

const cid='UC1234567890123456789012',vid='video123456',session='https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=secret-upload-id';
function fixture(){
  const tables=new Map(),secrets=new Map(),requests=[],authorizations=[];let at=Date.parse('2026-10-14T00:00:00Z');
  const clone=value=>value==null?value:structuredClone(value);
  const store={get:(table,key)=>clone(tables.get(table)?.get(key)),all:table=>[...(tables.get(table)?.values()||[])].map(clone),put(table,key,value){if(!tables.has(table))tables.set(table,new Map());tables.get(table).set(key,clone(value));},secret:key=>clone(secrets.get(key)),setSecret:(key,value)=>secrets.set(key,clone(value)),transaction:fn=>fn()};
  const channel={id:'yt',platform:'youtube',externalId:cid,connectionVersion:1,active:true,ownerIds:['u']};
  store.put('channels','yt',channel);store.setSecret('channel:yt',{authType:'google-oauth',accountId:cid,accessToken:'synthetic-token',expiresAt:'2026-10-15T00:00:00Z',permissionsVerifiedAt:'2026-10-14T00:00:00Z',scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'});
  store.put('socialDirectConnections','yt',{enabled:true,version:1,connectionVersion:1,accountId:cid,authType:'google-oauth'});
  const bytes=Buffer.alloc(32);bytes.write('ftyp',4);bytes.write('isom',8);
  const ref={assetId:'video',mimeType:'video/mp4',byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const post={id:'p',ownerId:'u',title:'승인한 제목',body:'설명',media:[ref]},variant={channelId:'yt',format:'video',title:'승인한 제목',text:'설명',media:[ref],options:{privacy:'public',madeForKids:false}};
  const job={id:'j',idempotencyKey:'idem',publisherId:'u',contentVersion:1,approvalHash:'approval',snapshot:{post,variant}};
  const input={channel,post,variant,job};
  let hook=null,resolver=()=>({bytes}),authorize=()=>{};
  const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers});
  const video=()=>({id:vid,snippet:{channelId:cid,title:variant.title,description:variant.text,publishedAt:'2026-10-14T00:00:01Z'},status:{uploadStatus:'processed',privacyStatus:variant.options.privacy,selfDeclaredMadeForKids:variant.options.madeForKids},processingDetails:{processingStatus:'succeeded'}});
  async function fetchImpl(url,options){const request={url,method:options.method,headers:options.headers,body:options.body};requests.push(request);const intercepted=await hook?.(request);if(intercepted)return intercepted;if(new URL(url).pathname==='/youtube/v3/channels')return json({items:[{id:cid}]});if(new URL(url).pathname==='/youtube/v3/videos')return json({items:[video()]});if(options.method==='POST')return new Response('',{status:200,headers:{location:session}});if(options.method==='PUT')return json({id:vid},201);throw new Error('Unexpected endpoint');}
  const build=(options={})=>createSocialDirectYouTube({store,fetchImpl,clock:()=>new Date(at).toISOString(),getCredentials:async()=>store.secret('channel:yt'),resolveMedia:async(...args)=>resolver(...args),authorizePublish:async args=>{authorizations.push(args);await authorize(args);},...options});
  return {store,requests,authorizations,bytes,ref,input,json,video,build,adapter:build(),advance(ms){at+=ms;},setHook(value){hook=value;},setResolver(value){resolver=value;},setAuthorize(value){authorize=value;},row:()=>store.all('socialDirectPublishJobs')[0],mediaWrites:()=>requests.filter(r=>r.method==='PUT'&&r.body.length>0),probes:()=>requests.filter(r=>r.method==='PUT'&&r.body.length===0)};
}

test('YouTube needs verified upload and read scopes, the matching channel, and explicit publishing opt-in',()=>{
  const f=fixture();assert.equal(f.adapter.capability(f.input.channel).canPublish,true);
  let c=f.store.secret('channel:yt');delete c.permissionsVerifiedAt;f.store.setSecret('channel:yt',c);assert.equal(f.adapter.capability(f.input.channel).errorCode,'SCOPES_REQUIRED');
  c.permissionsVerifiedAt='2026-10-14T00:00:00Z';c.scope='https://www.googleapis.com/auth/youtube.readonly';f.store.setSecret('channel:yt',c);assert.equal(f.adapter.capability(f.input.channel).canPublish,false);
  c.scope+=' https://www.googleapis.com/auth/youtube.upload';c.accountId='UCabcdefghijklmnopqrstuv';f.store.setSecret('channel:yt',c);assert.equal(f.adapter.capability(f.input.channel).errorCode,'ACCOUNT_MISMATCH');
});
test('preflight requires explicit title/privacy/children choice and one approved MP4 below 100MiB',()=>{
  const f=fixture();assert.equal(f.adapter.preflight(f.input).valid,true);
  for(const change of [v=>{delete v.options.privacy;},v=>{delete v.options.madeForKids;},v=>{v.media[0].byteSize=101*1024*1024;},v=>{delete v.media[0].sha256;},v=>{v.media[0].mimeType='video/webm';},v=>{v.options.coverUrl='https://example.test/a.jpg';}]){const input=structuredClone(f.input);change(input.variant);assert.equal(f.adapter.preflight(input).valid,false);}
  const input=structuredClone(f.input);input.post.title='';input.variant.title='';assert.equal(f.adapter.preflight(input).valid,false);
});
test('checkConnection reads exact authenticated channel without enabling or uploading',async()=>{
  const f=fixture();f.store.put('socialDirectConnections','yt',{enabled:false});const checked=await f.adapter.checkConnection(f.input.channel);assert.equal(checked.accountId,cid);assert.equal(checked.canPublish,true);assert.equal(f.requests.length,1);assert.equal(f.store.get('socialDirectConnections','yt').enabled,false);
  f.setHook(r=>r.url.includes('/channels?')?f.json({items:[{id:'UCabcdefghijklmnopqrstuv'}]}):null);await assert.rejects(()=>f.adapter.checkConnection(f.input.channel),e=>e.code==='ACCOUNT_MISMATCH');
});

test('제목·설명 언어·영상 언어·카테고리는 넣은 판만 업로드 요청 snippet에 싣는다(2026-10-21)',async()=>{
  const f=fixture();Object.assign(f.input.variant.options,{language:'ko',audioLanguage:'en',categoryId:'22'});
  assert.equal((await f.adapter.publish(f.input)).status,'published');
  const sent=JSON.parse(f.requests.find(r=>r.method==='POST').body);
  assert.deepEqual([sent.snippet.defaultLanguage,sent.snippet.defaultAudioLanguage,sent.snippet.categoryId],['ko','en','22']);
  const plain=fixture();await plain.adapter.publish(plain.input);
  const bare=JSON.parse(plain.requests.find(r=>r.method==='POST').body);
  assert.deepEqual(['defaultLanguage','defaultAudioLanguage','categoryId'].filter(key=>key in bare.snippet),[]);
  for(const bad of [{language:'Korean'},{audioLanguage:1},{categoryId:'x'},{language:'ko-12'},{language:'en-US-US'},{audioLanguage:'ko-KR-Hans'}]){const input=structuredClone(plain.input);Object.assign(input.variant.options,bad);assert.equal(plain.adapter.preflight(input).valid,false,JSON.stringify(bad));}
  for(const good of ['en-US','zh-Hant','es-419']){const input=structuredClone(plain.input);Object.assign(input.variant.options,{language:good,audioLanguage:good});assert.equal(plain.adapter.preflight(input).valid,true,good);}
});
test('Shorts requires measured square or portrait media of at most three minutes',()=>{
  const f=fixture();for(const format of ['shorts','youtube-shorts']){
    const input=structuredClone(f.input);input.variant.format=format;
    for(const metadata of [{},{width:1920,height:1080,duration:30},{width:1080,height:1920,duration:181},{width:1080,height:1920,duration:0}]){Object.assign(input.variant.media[0],{width:undefined,height:undefined,duration:undefined},metadata);assert.equal(f.adapter.preflight(input).valid,false);}
    Object.assign(input.variant.media[0],{width:1080,height:1080,duration:180});const checked=f.adapter.preflight(input);assert.equal(checked.valid,true);assert.equal(checked.warnings[0].code,'SHORTS_CLASSIFICATION');
  }
});
test('successful upload verifies original channel, content and privacy, encrypts the session and deduplicates retries',async()=>{
  const f=fixture(),response=await f.adapter.publish(f.input);assert.equal(response.status,'published');assert.equal(response.provider,'youtube-direct');assert.equal(response.publicVerified,false);assert.equal(response.url,'https://www.youtube.com/watch?v='+vid);assert.equal(f.mediaWrites().length,1);
  assert.equal(f.store.secret('youtube-upload:'+f.row().id).url,session);assert.doesNotMatch(JSON.stringify(f.row()),/secret-upload-id|synthetic-token/);assert.doesNotMatch(JSON.stringify(response),/secret-upload-id|synthetic-token/);
  await f.adapter.publish(f.input);await f.build().publish(f.input);assert.equal(f.mediaWrites().length,1);assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
});
test('lost final media response is reconciled by empty status probe without sending the bytes again',async()=>{
  const f=fixture();let lost=true;f.setHook(r=>{if(r.method==='PUT'&&r.body.length&&lost){lost=false;throw new Error('token=do-not-expose');}});
  const first=await f.adapter.publish(f.input);assert.equal(first.status,'uncertain');assert.doesNotMatch(first.message,/token=/);
  const resumed=await f.build().status({channel:f.input.channel,job:f.input.job});assert.equal(resumed.status,'published');assert.equal(f.mediaWrites().length,1);assert.equal(f.probes().length,1);assert.equal(f.probes()[0].headers['Content-Range'],'bytes */32');
});
test('a partial upload resumes only from the server-confirmed next byte with current authorization',async()=>{
  const f=fixture();let writes=0;f.setHook(r=>{if(r.method==='PUT'&&r.body.length){writes++;if(writes===1)throw new Error('lost');}if(r.method==='PUT'&&!r.body.length)return new Response(null,{status:308,headers:{range:'bytes=0-15'}});});
  assert.equal((await f.adapter.publish(f.input)).status,'uncertain');assert.equal((await f.build().status({channel:f.input.channel,job:f.input.job})).status,'published');assert.equal(f.mediaWrites().length,2);assert.equal(f.mediaWrites()[1].headers['Content-Range'],'bytes 16-31/32');assert.equal(f.mediaWrites()[1].body.length,16);assert.equal(f.authorizations.at(-1).continuation,true);
});
test('a malicious upload session URL never receives credentials or media',async()=>{
  for(const bad of ['https://evil.example/upload/youtube/v3/videos?uploadType=resumable&upload_id=x','https://www.googleapis.com/other?uploadType=resumable&upload_id=x','https://www.googleapis.com@evil.example/upload/youtube/v3/videos?uploadType=resumable&upload_id=x','http://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=x']){
    const f=fixture();f.setHook(r=>r.method==='POST'?new Response('',{status:200,headers:{location:bad}}):null);const response=await f.adapter.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.errorCode,'YOUTUBE_SESSION_INVALID');assert.equal(f.mediaWrites().length,0);assert.equal(f.store.secret('youtube-upload:'+f.row().id),undefined);
  }
});
test('changed file bytes and invalid MP4 signatures are rejected before an upload session is created',async()=>{
  const f=fixture();f.setResolver(()=>({bytes:Buffer.alloc(f.bytes.length)}));const response=await f.adapter.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.errorCode,'MEDIA_CONTENT_CHANGED');assert.equal(f.requests.filter(r=>r.method==='POST').length,0);
});
test('revoked approval after the probe blocks continued media transmission',async()=>{
  const f=fixture();f.setHook(r=>{if(r.method==='PUT'&&r.body.length)throw new Error('lost');if(r.method==='PUT')return new Response(null,{status:308,headers:{range:'bytes=0-15'}});});await f.adapter.publish(f.input);f.setAuthorize(()=>{throw new Error('revoked');});assert.equal((await f.build().status({channel:f.input.channel,job:f.input.job})).status,'uncertain');assert.equal(f.mediaWrites().length,1);
});
test('changed channel connection prevents any old session probe or retransmission',async()=>{
  const f=fixture();f.setHook(r=>{if(r.method==='PUT'&&r.body.length)throw new Error('lost');});await f.adapter.publish(f.input);f.store.put('channels','yt',{...f.input.channel,connectionVersion:2});const response=await f.build().status({channel:f.input.channel,job:f.input.job});assert.equal(response.status,'uncertain');assert.equal(f.probes().length,0);assert.equal(f.mediaWrites().length,1);
});
test('processing videos are polled without another upload and require matching settings to finish',async()=>{
  const f=fixture();let processing=true;f.setHook(r=>r.method==='GET'&&r.url.includes('/youtube/v3/videos?')?f.json({items:[{...f.video(),status:{...f.video().status,uploadStatus:processing?'uploaded':'processed'},processingDetails:{processingStatus:processing?'processing':'succeeded'}}]}):null);
  assert.equal((await f.adapter.publish(f.input)).status,'processing');processing=false;assert.equal((await f.adapter.status({channel:f.input.channel,job:f.input.job})).status,'published');assert.equal(f.mediaWrites().length,1);
});
test('a different channel, content or privacy is never recorded as the approved publication',async()=>{
  for(const mutate of [v=>{v.snippet.channelId='UCabcdefghijklmnopqrstuv';},v=>{v.snippet.title='다른 제목';},v=>{v.status.privacyStatus='private';},v=>{delete v.status.selfDeclaredMadeForKids;}]){
    const f=fixture();f.setHook(r=>{if(r.method==='GET'&&r.url.includes('/youtube/v3/videos?')){const video=f.video();mutate(video);return f.json({items:[video]});}});assert.equal((await f.adapter.publish(f.input)).status,'uncertain');assert.equal(f.mediaWrites().length,1);
  }
});
test('expired sessions and invalid byte ranges stay unresolved and never restart an upload',async()=>{
  for(const response of [()=>new Response(null,{status:404}),()=>new Response(null,{status:308,headers:{range:'bytes=0-999'}}),()=>new Response(null,{status:308,headers:{range:'bytes=10-15'}})]){
    const f=fixture();f.setHook(r=>{if(r.method==='PUT'&&r.body.length)throw new Error('lost');if(r.method==='PUT')return response();});await f.adapter.publish(f.input);assert.equal((await f.build().status({channel:f.input.channel,job:f.input.job})).status,'uncertain');assert.equal(f.mediaWrites().length,1);assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
  }
});
test('process restart honors an active upload lease and probes after the lease expires',async()=>{
  const f=fixture();f.setHook(r=>{if(r.method==='PUT'&&r.body.length)throw new Error('lost');});await f.adapter.publish(f.input);const row=f.row();f.store.put('socialDirectPublishJobs',row.id,{...row,status:'uploading',leaseUntil:'2026-10-14T00:03:00Z'});
  assert.equal((await f.build().status({channel:f.input.channel,job:f.input.job})).status,'processing');assert.equal(f.probes().length,0);f.advance(180001);assert.equal((await f.build().status({channel:f.input.channel,job:f.input.job})).status,'published');assert.equal(f.mediaWrites().length,1);
});
test('concurrent calls share one media upload and never submit twice',async()=>{
  const f=fixture();const results=await Promise.all([f.adapter.publish(f.input),f.adapter.publish(f.input)]);assert.equal(results[0].status,'published');assert.equal(results[1].status,'published');assert.equal(f.mediaWrites().length,1);
});
test('the same job cannot resume with a changed approved snapshot',async()=>{
  const f=fixture();f.setHook(r=>{if(r.method==='PUT'&&r.body.length)throw new Error('lost');});await f.adapter.publish(f.input);const job=structuredClone(f.input.job);job.snapshot.variant.text='다른 설명';assert.equal((await f.build().status({channel:f.input.channel,job})).status,'uncertain');assert.equal(f.probes().length,0);assert.equal(f.mediaWrites().length,1);
});
test('two restarted workers cannot resume from the same stale byte probe',async()=>{
  const f=fixture();f.setHook(r=>{if(r.method==='PUT'&&r.body.length)throw new Error('lost');});await f.adapter.publish(f.input);
  f.setHook(r=>r.method==='PUT'?new Response(null,{status:308,headers:{range:r.body.length?'bytes=0-15':'bytes=0-7'}}):null);
  const release=[];f.setResolver(()=>new Promise(resolve=>release.push(()=>resolve({bytes:f.bytes}))));
  const a=f.build().status({channel:f.input.channel,job:f.input.job}),b=f.build().status({channel:f.input.channel,job:f.input.job});
  for(let i=0;i<20&&release.length<2;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(release.length,2);release[0]();await a;release[1]();await b;
  assert.equal(f.mediaWrites().length,2);assert.equal(f.mediaWrites()[1].headers['Content-Range'],'bytes 8-31/32');assert.equal(f.row().confirmedOffset,16);
});
test('server OAuth configuration metadata does not change the credential pin, but auth changes still do',async()=>{
  const f=fixture(),adapter=f.build({getCredentials:async()=>({...f.store.secret('channel:yt'),clientId:'synthetic-app',clientSecret:'synthetic-app-secret',redirectUri:'https://workspace.test/api/oauth/youtube/callback'})});
  assert.equal((await adapter.checkConnection(f.input.channel)).canPublish,true);
  assert.equal((await adapter.publish(f.input)).status,'published');
  const second=fixture();second.setHook(r=>{if(r.url.includes('/channels?'))second.store.setSecret('channel:yt',{...second.store.secret('channel:yt'),accessToken:'changed-synthetic-token'});});
  await assert.rejects(()=>second.adapter.checkConnection(second.input.channel),error=>error.code==='CONNECTION_CHANGED');
});

test('a definitively unsent failure opens a new session only after explicit reschedule and a new scheduler attempt',async()=>{
  const f=fixture();f.input.job.attempts=1;f.input.job.scheduleRevision=1;let down=true;f.setHook(r=>r.method==='POST'&&down?new Response('',{status:503}):null);
  const first=await f.adapter.publish(f.input);assert.equal(first.status,'failed');assert.equal(first.definitive,true);assert.equal(first.retryable,false);assert.equal(f.row().bytesAttempted,false);
  down=false;await f.build().status({channel:f.input.channel,job:f.input.job});await f.build().publish({...f.input,job:{...f.input.job,attempts:2}});await f.build().publish({...f.input,job:{...f.input.job,scheduleRevision:2}});assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
  const resumed=await f.build().publish({...f.input,job:{...f.input.job,attempts:2,scheduleRevision:2}});assert.equal(resumed.status,'published');assert.equal(f.requests.filter(r=>r.method==='POST').length,2);assert.equal(f.mediaWrites().length,1);assert.equal(f.row().attemptNumber,2);assert.equal(f.row().scheduleRevision,2);
});

test('rescheduling does not replace a session after any ambiguous video bytes',async()=>{
  const f=fixture();f.input.job.attempts=1;f.input.job.scheduleRevision=1;f.setHook(r=>{if(r.method==='PUT'&&r.body.length)throw Error('lost media response');if(r.method==='PUT')return new Response(null,{status:404});});
  assert.equal((await f.adapter.publish(f.input)).status,'uncertain');const response=await f.build().publish({...f.input,job:{...f.input.job,attempts:9,scheduleRevision:9}});assert.equal(response.status,'uncertain');assert.equal(f.requests.filter(r=>r.method==='POST').length,1);assert.equal(f.mediaWrites().length,1);
});

test('rescheduling clears an unused previous session before creating its replacement',async()=>{
  const f=fixture();f.input.job.attempts=1;f.input.job.scheduleRevision=1;f.setAuthorize(()=>{if(f.requests.some(r=>r.method==='POST'))throw Error('approval temporarily unavailable');});
  const first=await f.adapter.publish(f.input);assert.equal(first.status,'failed');assert.equal(first.definitive,true);assert.equal(f.row().bytesAttempted,false);assert.equal(f.store.secret('youtube-upload:'+f.row().id).url,session);
  f.setAuthorize(()=>{});f.setHook(r=>r.method==='POST'?new Response('',{status:503}):null);const second=await f.build().publish({...f.input,job:{...f.input.job,attempts:2,scheduleRevision:2}});assert.equal(second.status,'failed');assert.equal(f.store.secret('youtube-upload:'+f.row().id),null);assert.equal(f.mediaWrites().length,0);
});

test('competing explicit retries claim one replacement session',async()=>{
  const f=fixture();f.input.job.attempts=1;f.input.job.scheduleRevision=1;f.setHook(r=>r.method==='POST'?new Response('',{status:503}):null);await f.adapter.publish(f.input);f.setHook(null);
  const input={...f.input,job:{...f.input.job,attempts:2,scheduleRevision:2}};await Promise.all([f.build().publish(input),f.build().publish(input)]);assert.equal(f.requests.filter(r=>r.method==='POST').length,2);assert.equal(f.mediaWrites().length,1);
});

test('expired access token stays schedulable when a valid refresh grant can renew it',async()=>{
  const f=fixture();f.store.setSecret('channel:yt',{...f.store.secret('channel:yt'),expiresAt:'2026-10-13T23:00:00Z',refreshToken:'synthetic-refresh'});let refreshes=0;
  const adapter=f.build({getCredentials:async()=>{refreshes++;const next={...f.store.secret('channel:yt'),accessToken:'synthetic-renewed',expiresAt:'2026-10-14T01:00:00Z'};f.store.setSecret('channel:yt',next);return next;}});
  assert.equal(adapter.capability(f.input.channel).canPublish,true);assert.equal(adapter.capability(f.input.channel).needsTokenRefresh,true);assert.equal((await adapter.publish(f.input)).status,'published');assert.ok(refreshes>=1);assert.equal(adapter.capability(f.input.channel).needsTokenRefresh,false);assert.equal(f.mediaWrites().length,1);
});

test('expired or missing refresh grants do not advertise automatic publishing',()=>{
  for(const change of [{refreshToken:undefined},{refreshToken:'refresh',refreshExpiresAt:'2026-10-13T23:00:00Z'},{refreshToken:'refresh',refreshExpiresAt:'invalid'}]){const f=fixture();f.store.setSecret('channel:yt',{...f.store.secret('channel:yt'),expiresAt:'2026-10-13T23:00:00Z',...change});assert.equal(f.adapter.capability(f.input.channel).canPublish,false);}
  const f=fixture();f.store.setSecret('channel:yt',{...f.store.secret('channel:yt'),expiresAt:'2026-10-13T23:00:00Z',refreshToken:'refresh'});assert.equal(f.build({getCredentials:undefined}).capability(f.input.channel).canPublish,false);
});

test('failed token refresh cannot bypass the session expiry check',async()=>{
  const f=fixture();f.store.setSecret('channel:yt',{...f.store.secret('channel:yt'),expiresAt:'2026-10-13T23:00:00Z',refreshToken:'synthetic-refresh'});
  assert.equal(f.adapter.capability(f.input.channel).canPublish,true);const response=await f.adapter.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.errorCode,'AUTH_REQUIRED');assert.equal(f.requests.length,0);assert.equal(f.mediaWrites().length,0);
});

test('a title and description that differ only by whitespace, CRLF and NFC still verify as published',async()=>{
  const f=fixture();f.setHook(r=>r.method==='GET'&&r.url.includes('/youtube/v3/videos?')?f.json({items:[{...f.video(),snippet:{...f.video().snippet,title:'승인한 제목'.normalize('NFD')+' ',description:' 설명 \r\n'}}]}):null);
  const response=await f.adapter.publish(f.input);assert.equal(response.status,'published');assert.equal(response.errorCode,null);assert.equal(f.mediaWrites().length,1);
});

test('a persistent description mismatch remains uncertain after repeated checks without another upload',async()=>{
  const f=fixture();f.setHook(r=>r.method==='GET'&&r.url.includes('/youtube/v3/videos?')?f.json({items:[{...f.video(),snippet:{...f.video().snippet,description:'다른 설명'}}]}):null);
  const first=await f.adapter.publish(f.input);assert.equal(first.status,'uncertain');assert.equal(first.errorCode,'PUBLICATION_PROOF_MISMATCH');
  assert.equal((await f.build().status({channel:f.input.channel,job:f.input.job})).status,'uncertain');
  const third=await f.build().status({channel:f.input.channel,job:f.input.job});assert.equal(third.status,'uncertain');assert.equal(third.errorCode,'PUBLICATION_PROOF_MISMATCH');assert.equal(third.providerId,vid);assert.match(third.message,/3회/);
  assert.equal((await f.build().status({channel:f.input.channel,job:f.input.job})).status,'uncertain');assert.equal(f.mediaWrites().length,1);
});

test('public privacy and required declarations cannot be confirmed by repeated mismatching reads',async()=>{
  for(const mutate of [v=>{v.status.privacyStatus='private';},v=>{v.status.privacyStatus='unlisted';},v=>{v.status.selfDeclaredMadeForKids=true;},v=>{delete v.status.selfDeclaredMadeForKids;}]){
    const f=fixture();let mismatching=true;
    f.setHook(r=>{if(r.method==='GET'&&r.url.includes('/youtube/v3/videos?')){const video=f.video();if(mismatching)mutate(video);return f.json({items:[video]});}});
    const initial=await f.adapter.publish(f.input);assert.equal(initial.status,'uncertain');
    for(let check=0;check<5;check++){
      const result=await f.build().status({channel:f.input.channel,job:f.input.job});
      assert.equal(result.status,'uncertain');assert.equal(result.errorCode,'PUBLICATION_OPTIONS_MISMATCH');assert.equal(result.retryable,false);assert.equal(result.publicVerified,false);
    }
    assert.equal(f.mediaWrites().length,1);assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
    mismatching=false;const resolved=await f.build().status({channel:f.input.channel,job:f.input.job});
    assert.equal(resolved.status,'published');assert.equal(resolved.errorCode,null);assert.equal(f.mediaWrites().length,1);
  }
});
// YouTube는 videos.list 읽기에 status.containsSyntheticMedia를 넣지 않는다(현장노트 10-13). 작업실은 판마다 madeWithAi를 싣기 때문에
// 없는 칸을 「다름」으로 세면 공개로 올라간 영상이 모두 PUBLICATION_OPTIONS_MISMATCH로 남았다(10-26~29).
test('AI 표시가 읽기에 없으면 확인할 수 없음으로 두고 게시로 닫되, 읽기에 나온 다른 AI 표시·공개 범위는 여전히 막는다(2026-10-29)',async()=>{
  const videosRead=(f,mutate)=>f.setHook(r=>{if(r.method==='GET'&&r.url.includes('/youtube/v3/videos?')){const video=f.video();mutate(video);return f.json({items:[video]});}});
  for(const madeWithAi of [true,false]){
    const f=fixture();f.input.variant.options.madeWithAi=madeWithAi;
    const done=await f.adapter.publish(f.input);
    assert.equal(JSON.parse(f.requests.find(r=>r.method==='POST').body).status.containsSyntheticMedia,madeWithAi);
    assert.equal(done.status,'published');assert.equal(done.errorCode,null);assert.match(done.message,/AI 표시는 .*시청 화면/);
  }
  const plain=fixture(),bare=await plain.adapter.publish(plain.input);
  assert.equal(bare.status,'published');assert.doesNotMatch(bare.message,/AI 표시/);
  const same=fixture();same.input.variant.options.madeWithAi=false;videosRead(same,v=>{v.status.containsSyntheticMedia=false;});
  const shown=await same.adapter.publish(same.input);assert.equal(shown.status,'published');assert.doesNotMatch(shown.message,/AI 표시/);
  for(const mutate of [v=>{v.status.containsSyntheticMedia=false;},v=>{v.status.containsSyntheticMedia=null;},v=>{v.status.privacyStatus='private';},v=>{v.status.selfDeclaredMadeForKids=true;}]){
    const f=fixture();f.input.variant.options.madeWithAi=true;videosRead(f,mutate);
    assert.equal((await f.adapter.publish(f.input)).status,'uncertain');
    for(let check=0;check<3;check++){const result=await f.build().status({channel:f.input.channel,job:f.input.job});assert.equal(result.status,'uncertain');assert.equal(result.errorCode,'PUBLICATION_OPTIONS_MISMATCH');}
    assert.equal(f.mediaWrites().length,1);
  }
});

test('a video on another channel never finalizes as published however often it is checked',async()=>{
  const f=fixture();f.setHook(r=>r.method==='GET'&&r.url.includes('/youtube/v3/videos?')?f.json({items:[{...f.video(),snippet:{...f.video().snippet,channelId:'UCabcdefghijklmnopqrstuv'}}]}):null);assert.equal((await f.adapter.publish(f.input)).status,'uncertain');
  for(let n=0;n<4;n++){const response=await f.build().status({channel:f.input.channel,job:f.input.job});assert.equal(response.status,'uncertain');assert.equal(response.errorCode,'PUBLICATION_PROOF_MISMATCH');}
});

test('verification continues through a new session after the publishing link changes for the same channel',async()=>{
  const f=fixture();let missing=true;f.setHook(r=>r.method==='GET'&&r.url.includes('/youtube/v3/videos?')&&missing?f.json({items:[]}):null);assert.equal((await f.adapter.publish(f.input)).status,'uncertain');missing=false;
  f.store.put('socialDirectConnections','yt',{...f.store.get('socialDirectConnections','yt'),enabled:false,version:2});
  const resumed=await f.build().status({channel:f.input.channel,job:f.input.job});assert.equal(resumed.status,'published');assert.equal(f.mediaWrites().length,1);assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
});

test('a changed channel after uploading stops verification without requests',async()=>{
  const f=fixture();let missing=true;f.setHook(r=>r.method==='GET'&&r.url.includes('/youtube/v3/videos?')&&missing?f.json({items:[]}):null);assert.equal((await f.adapter.publish(f.input)).status,'uncertain');missing=false;
  f.store.put('channels','yt',{...f.input.channel,externalId:'UCabcdefghijklmnopqrstuv'});const before=f.requests.length;
  const response=await f.build().status({channel:f.input.channel,job:f.input.job});assert.equal(response.status,'uncertain');assert.equal(response.errorCode,'ACCOUNT_CHANGED');assert.equal(f.requests.length,before);
});

function chunkedFixture(){
  const f=fixture(),big=Buffer.alloc(655360,7);big.write('ftyp',4);big.write('isom',8);Object.assign(f.ref,{byteSize:big.length,sha256:createHash('sha256').update(big).digest('hex')});let reads=0;f.setResolver(()=>{reads++;return {bytes:big};});
  const chunkRange=r=>{const m=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(r.headers['Content-Range']);return {start:Number(m[1]),end:Number(m[2]),total:Number(m[3])};};
  const accept=r=>{const {end,total}=chunkRange(r);return end+1<total?new Response(null,{status:308,headers:{range:'bytes=0-'+end}}):f.json({id:vid},201);};
  return {...f,big,reads:()=>reads,chunkRange,accept,ranges:()=>f.mediaWrites().map(r=>r.headers['Content-Range'])};
}

test('a large upload goes out in 256KiB-multiple chunks confirmed by 308 ranges from a single file read',async()=>{
  const f=chunkedFixture();f.setHook(r=>r.method==='PUT'&&r.body.length?f.accept(r):null);
  const response=await f.build({uploadChunkBytes:262144}).publish(f.input);assert.equal(response.status,'published');assert.equal(f.reads(),1);assert.equal(f.probes().length,0);
  assert.deepEqual(f.ranges(),['bytes 0-262143/655360','bytes 262144-524287/655360','bytes 524288-655359/655360']);assert.deepEqual(f.mediaWrites().map(r=>r.body.length),[262144,262144,131072]);assert.equal(f.row().confirmedOffset,524288);
  for(const bad of [{uploadChunkBytes:100000},{uploadChunkBytes:0},{uploadBudgetMs:0}])assert.throws(()=>f.build(bad),/256KiB|uploadBudgetMs/);
});

test('a lost response on a middle chunk resumes from the probed offset instead of an unknown result',async()=>{
  const f=chunkedFixture();let lost=true;f.setHook(r=>{if(r.method!=='PUT')return null;if(!r.body.length)return new Response(null,{status:308,headers:{range:'bytes=0-262143'}});if(lost&&f.chunkRange(r).start===262144){lost=false;throw new Error('lost chunk');}return f.accept(r);});
  const first=await f.build({uploadChunkBytes:262144}).publish(f.input);assert.equal(first.status,'processing');assert.equal(first.errorCode,'YOUTUBE_UPLOAD_INTERRUPTED');assert.equal(first.checkAfterMs,15000);assert.equal(f.row().status,'processing');assert.equal(f.row().confirmedOffset,262144);assert.equal(f.row().bytesAttempted,true);
  const resumed=await f.build({uploadChunkBytes:262144}).status({channel:f.input.channel,job:f.input.job});assert.equal(resumed.status,'published');assert.equal(f.probes().length,1);assert.equal(f.probes()[0].headers['Content-Range'],'bytes */655360');
  assert.deepEqual(f.ranges(),['bytes 0-262143/655360','bytes 262144-524287/655360','bytes 262144-524287/655360','bytes 524288-655359/655360']);assert.equal(f.requests.filter(r=>r.method==='POST').length,1);assert.equal(f.reads(),2);
});

test('a lost response on the final chunk stays unknown but is probed again soon through the same session',async()=>{
  const f=chunkedFixture();let lost=true;f.setHook(r=>{if(r.method!=='PUT')return null;if(!r.body.length)return new Response(null,{status:308,headers:{range:'bytes=0-524287'}});const {end,total}=f.chunkRange(r);if(lost&&end+1===total){lost=false;throw new Error('lost final chunk');}return f.accept(r);});
  const first=await f.build({uploadChunkBytes:262144}).publish(f.input);assert.equal(first.status,'uncertain');assert.equal(first.errorCode,'YOUTUBE_NETWORK');assert.equal(first.checkAfterMs,15000);assert.equal(first.retryable,false);assert.equal(f.row().status,'uncertain');
  const retried=await f.build({uploadChunkBytes:262144}).publish({...f.input,job:{...f.input.job,attempts:5,scheduleRevision:5}});assert.equal(retried.status,'published');assert.equal(retried.checkAfterMs,undefined);assert.equal(f.requests.filter(r=>r.method==='POST').length,1);assert.equal(f.probes().length,1);
  assert.deepEqual(f.ranges(),['bytes 0-262143/655360','bytes 262144-524287/655360','bytes 524288-655359/655360','bytes 524288-655359/655360']);
  const before=f.requests.length;assert.equal((await f.build({uploadChunkBytes:262144}).status({channel:f.input.channel,job:f.input.job})).status,'published');assert.equal(f.requests.length,before);
});

test('an upload pauses at its time budget and continues on the next check without resending bytes',async()=>{
  const f=chunkedFixture();f.setHook(r=>{if(r.method!=='PUT')return null;if(!r.body.length)return new Response(null,{status:308,headers:{range:'bytes=0-524287'}});f.advance(600);return f.accept(r);});
  const first=await f.build({uploadChunkBytes:262144,uploadBudgetMs:1000}).publish(f.input);assert.equal(first.status,'processing');assert.equal(first.checkAfterMs,15000);assert.match(first.message,/이어서/);assert.equal(f.row().confirmedOffset,524288);assert.equal(f.row().leaseUntil,null);
  const resumed=await f.build({uploadChunkBytes:262144,uploadBudgetMs:1000}).status({channel:f.input.channel,job:f.input.job});assert.equal(resumed.status,'published');assert.equal(f.probes().length,1);
  assert.deepEqual(f.ranges(),['bytes 0-262143/655360','bytes 262144-524287/655360','bytes 524288-655359/655360']);assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
});

test('a video still processing on YouTube reports a growing checkAfterMs',async()=>{
  const f=fixture();f.setHook(r=>r.method==='GET'&&r.url.includes('/youtube/v3/videos?')?f.json({items:[{...f.video(),status:{...f.video().status,uploadStatus:'uploaded'},processingDetails:{processingStatus:'processing'}}]}):null);
  const first=await f.adapter.publish(f.input);assert.equal(first.status,'processing');assert.equal(first.checkAfterMs,15000);
  for(const expected of [30000,60000,120000,120000,120000,undefined]){const response=await f.adapter.status({channel:f.input.channel,job:f.input.job});assert.equal(response.status,'processing');assert.equal(response.checkAfterMs,expected);}assert.equal(f.mediaWrites().length,1);
});

test('credential errors with a known code become a definitive retryable unsent failure carrying their message',async()=>{
  for(const code of ['CHANNEL_INACTIVE','COLLECTION_DISABLED','CONNECTION_CHANGED','CONNECTION_OWNER_INACTIVE']){
    const f=fixture(),adapter=f.build({getCredentials:async()=>{throw Object.assign(new Error('채널 연결이 바뀌었어요. 다시 확인해 주세요.'),{code,status:400});}});
    const response=await adapter.publish(f.input);assert.equal(response.status,'failed',code);assert.equal(response.errorCode,code);assert.equal(response.definitive,true);assert.equal(response.retryable,true);assert.match(response.message,/다시 확인/);assert.equal(f.requests.length,0);assert.equal(f.row(),undefined);
  }
  const f=fixture(),adapter=f.build({getCredentials:async()=>{throw Object.assign(new Error('secret internal detail'),{status:400});}});const response=await adapter.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.errorCode,'YOUTUBE_FAILED');assert.equal(response.retryable,false);assert.ok(!response.message.includes('secret internal detail'));assert.equal(f.requests.length,0);
});
// Real Node fetch (not the fixture's Response stub) against a local stand-in for the upload API: the fixture
// returns 308 objects directly, so it never met undici's redirect check that broke 10-24's live uploads.
async function realYouTube(f,routes){
  const hits=[];const server=createServer((req,res)=>{const parts=[];req.on('data',c=>parts.push(c));req.on('end',()=>{const body=Buffer.concat(parts),url=new URL(req.url,'http://local');hits.push({method:req.method,path:url.pathname,range:req.headers['content-range']||'',bytes:body.length});const out=routes(req,url,body)||{status:404,body:{error:{message:'none'}}};res.writeHead(out.status,{'content-type':'application/json',...out.headers});res.end(out.body===undefined?'':JSON.stringify(out.body));});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,fetchImpl=(url,options)=>fetch(String(url).replace(/^https:\/\/(www|youtube)\.googleapis\.com/,base),options);
  return {hits,fetchImpl,close:()=>new Promise(resolve=>server.close(resolve))};
}
test('real fetch: a multi-chunk upload reads 308 Resume Incomplete between chunks and publishes once',async()=>{
  const f=fixture(),bytes=Buffer.alloc(3*262144+1000);bytes.write('ftyp',4);bytes.write('isom',8);
  const ref={...f.ref,byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},input=structuredClone(f.input);input.post.media=[ref];input.variant.media=[ref];input.job.snapshot={post:input.post,variant:input.variant};f.setResolver(()=>({bytes}));
  let received=0;
  const yt=await realYouTube(f,(req,url,body)=>{
    if(url.pathname==='/youtube/v3/channels')return {status:200,body:{items:[{id:cid}]}};
    if(url.pathname==='/youtube/v3/videos')return {status:200,body:{items:[f.video()]}};
    if(req.method==='POST'&&url.pathname==='/upload/youtube/v3/videos')return {status:200,body:{},headers:{location:session}};
    if(req.method==='PUT'&&url.pathname==='/upload/youtube/v3/videos'){received+=body.length;return received<bytes.length?{status:308,headers:{range:'bytes=0-'+(received-1)}}:{status:200,body:{id:vid}};}
  });
  try{
    const result=await f.build({fetchImpl:yt.fetchImpl,uploadChunkBytes:262144}).publish(input);
    assert.equal(result.status,'published');assert.equal(result.errorCode,null);assert.equal(received,bytes.length);
    assert.deepEqual(yt.hits.filter(h=>h.method==='PUT').map(h=>h.range),['bytes 0-262143/'+bytes.length,'bytes 262144-524287/'+bytes.length,'bytes 524288-786431/'+bytes.length,'bytes 786432-'+(bytes.length-1)+'/'+bytes.length]);
    assert.equal(yt.hits.filter(h=>h.method==='POST').length,1);assert.equal(f.row().status,'published');
  }finally{await yt.close();}
});
test('real fetch: a status probe after an interrupted chunk resumes from the 308 range instead of staying uncertain',async()=>{
  const f=fixture(),bytes=Buffer.alloc(2*262144+10);bytes.write('ftyp',4);bytes.write('isom',8);
  const ref={...f.ref,byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},input=structuredClone(f.input);input.post.media=[ref];input.variant.media=[ref];input.job.snapshot={post:input.post,variant:input.variant};f.setResolver(()=>({bytes}));
  let received=0,dropSecond=true;
  const yt=await realYouTube(f,(req,url,body)=>{
    if(url.pathname==='/youtube/v3/channels')return {status:200,body:{items:[{id:cid}]}};
    if(url.pathname==='/youtube/v3/videos')return {status:200,body:{items:[f.video()]}};
    if(req.method==='POST'&&url.pathname==='/upload/youtube/v3/videos')return {status:200,body:{},headers:{location:session}};
    if(req.method==='PUT'&&url.pathname==='/upload/youtube/v3/videos'){
      if(!body.length)return {status:308,headers:received?{range:'bytes=0-'+(received-1)}:{}};
      if(received===262144&&dropSecond){dropSecond=false;return {status:500,body:{error:{message:'synthetic'}}};}
      received+=body.length;return received<bytes.length?{status:308,headers:{range:'bytes=0-'+(received-1)}}:{status:200,body:{id:vid}};}
  });
  try{
    const adapter=f.build({fetchImpl:yt.fetchImpl,uploadChunkBytes:262144});
    const first=await adapter.publish(input);assert.notEqual(first.status,'published');assert.equal(received,262144);
    f.advance(60000);
    let last=first;for(let k=0;k<3&&last.status!=='published';k++){f.advance(60000);last=await adapter.status(input);}
    assert.equal(last.status,'published');assert.equal(received,bytes.length);
    assert.ok(yt.hits.some(h=>h.method==='PUT'&&h.bytes===0&&h.range==='bytes */'+bytes.length),'probe asks for the confirmed range');
    assert.equal(yt.hits.filter(h=>h.method==='POST').length,1);
  }finally{await yt.close();}
});
test('real fetch: a redirect with Location is never followed (manual mode keeps the token on Google hosts)',async()=>{
  const f=fixture();
  const yt=await realYouTube(f,(req,url)=>{
    if(url.pathname==='/youtube/v3/channels')return {status:302,headers:{location:'/elsewhere'}};
    if(url.pathname==='/elsewhere')return {status:200,body:{items:[{id:cid}]}};
  });
  try{
    await assert.rejects(()=>f.build({fetchImpl:yt.fetchImpl}).checkConnection(f.input.channel),e=>typeof e.code==='string'&&e.code.startsWith('YOUTUBE_'));
    assert.deepEqual(yt.hits.map(h=>h.path),['/youtube/v3/channels']);
  }finally{await yt.close();}
});
