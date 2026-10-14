import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSocialDirectMeta} from './social-direct-meta.mjs';

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
const asset=(id='image',bytes=JPEG)=>({id,assetId:id,sha256:digest(bytes),mimeType:bytes===MP4?'video/mp4':'image/jpeg',byteSize:bytes.length,width:1080,height:1350,...(bytes===MP4?{type:'video',duration:30}:{type:'image'}),url:'/api/social/media/'+id});
function fixture({platform='instagram',format=platform==='instagram'?'image':'text',media=platform==='instagram'?[asset()]:[],options={},handler,authorize,resolve,issueUrl,authType=platform==='instagram'?'instagram-login':'facebook-page'}={}){
  const store=new MemoryStore(),calls=[],authorizations=[];let at=Date.parse(NOW),nextContainer=600;
  const channel={id:'channel',platform,externalId:'100',handle:'synk',active:true,ownerIds:['admin'],connectionVersion:2};
  const credentials={accessToken:'secret-token-not-for-output',accountId:'100',appScopedId:platform==='instagram'?'101':undefined,authType,apiVersion:'v26.0',metaIdentityVersion:1,permissionsVerifiedAt:NOW,scope:platform==='instagram'?(authType==='instagram-login'?'instagram_business_basic instagram_business_content_publish':'instagram_basic instagram_content_publish pages_read_engagement'):'pages_manage_posts pages_read_engagement pages_show_list'};
  store.put('channels',channel.id,channel);store.setSecret('channel:'+channel.id,credentials);store.put('socialDirectConnections',channel.id,{id:channel.id,channelId:channel.id,provider:'meta-direct',enabled:true,connectionVersion:2,accountId:'100',authType,version:'connection-v1',verifiedAt:NOW});
  const post={id:'post',body:'확정 원문',ownerId:'admin'},variant={channelId:channel.id,format,text:'확정 원문',media,options},job={id:'job',idempotencyKey:'dedupe-key',channelId:channel.id,postId:post.id,contentVersion:1,approvalHash:'approved',attempts:1,publisherId:'admin',snapshot:{post,variant}},input={channel,post,variant,job};
  const fetchImpl=async(raw,init)=>{const url=new URL(raw),path=url.pathname.replace(/^\/v\d+\.\d+\//,''),params=init.method==='POST'?new URLSearchParams(init.body):url.searchParams;const call={url,init,path,params};calls.push(call);const intercepted=await handler?.(call,{store,input});if(intercepted!==undefined)return intercepted;
    if(path==='me/accounts')return json({data:[{id:'100',access_token:'page-derived-token',tasks:['CREATE_CONTENT']}]});
    if(path==='me'||path==='100'&&init.method==='GET')return json(platform==='instagram'?{id:authType==='instagram-login'?'101':'100',user_id:'100',username:'synk'}:{id:'100',name:'SYNK'});
    if(path==='100/media'&&init.method==='POST')return json({id:String(++nextContainer)});
    if(/^6\d\d$/.test(path))return json({id:path,status_code:'FINISHED'});
    if(path==='100/media_publish')return json({id:'700'});
    if(path==='100/feed')return json({id:'100_700'});
    if(path==='100/photos')return json({id:'800',post_id:'100_700'});
    if(path==='700')return json({id:'700',owner:{id:'101'},caption:'확정 원문',permalink:'https://www.instagram.com/p/ABC123/',timestamp:NOW});
    if(path==='100_700')return json({id:'100_700',from:{id:'100'},message:'확정 원문',is_published:true,permalink_url:'https://www.facebook.com/100/posts/700',created_time:NOW});
    if(path==='800')return json({id:'800',from:{id:'100'},name:'확정 원문',link:'https://www.facebook.com/photo.php?fbid=800',created_time:NOW});
    throw Error('Unexpected mocked request: '+path);
  };
  const create=extra=>createSocialDirectMeta({store,fetchImpl,clock:()=>new Date(at).toISOString(),authorizePublish:async context=>{authorizations.push(context);await authorize?.(context,{store,input});},resolveMedia:async(ref,context)=>resolve?resolve(ref,context):{bytes:ref.mimeType==='video/mp4'?MP4:JPEG},issueMediaUrl:async(ref,context)=>issueUrl?issueUrl(ref,context):{url:'https://workspace.synk.im/api/social/direct-media/'+ref.id+'/grant'},...extra});
  return {store,input,calls,authorizations,create,provider:create(),advance:ms=>at+=ms,credentials,posts:()=>calls.filter(c=>c.init.method==='POST'),ledger:()=>store.all('socialDirectPublishJobs')[0]};
}

test('posting requires verified publish scopes; comment-read proof cannot grant it',()=>{
  const f=fixture();f.store.setSecret('channel:channel',{...f.credentials,scope:'instagram_business_basic instagram_business_manage_comments',capabilityVerification:{commentsRead:true},permissionsVerifiedAt:NOW});
  const cap=f.provider.capability(f.input.channel);assert.equal(cap.canPublish,false);assert.equal(cap.errorCode,'SCOPES_REQUIRED');assert.deepEqual(cap.missingScopes,['instagram_business_content_publish']);assert.equal(f.calls.length,0);
});
test('checkConnection is read-only and works before opt-in',async()=>{
  const f=fixture();f.store.put('socialDirectConnections','channel',{...f.store.get('socialDirectConnections','channel'),enabled:false});
  assert.equal(f.provider.capability(f.input.channel).canPublish,false);const checked=await f.provider.checkConnection(f.input.channel);assert.equal(checked.accountId,'100');assert.equal(checked.authType,'instagram-login');assert.equal(f.posts().length,0);
});
test('Instagram single JPEG waits for container and verifies owner/body after publishing',async()=>{
  const f=fixture();const response=await f.provider.publish(f.input);assert.equal(response.status,'published');assert.equal(response.providerId,'700');assert.equal(response.publicVerified,false);assert.equal(response.publishedAt,NOW);assert.deepEqual(f.posts().map(c=>c.path),['100/media','100/media_publish']);
  assert.equal(f.posts()[0].params.get('image_url'),'https://workspace.synk.im/api/social/direct-media/image/grant');assert.equal(f.posts()[1].params.get('creation_id'),'601');assert.equal(f.ledger().containerId,'601');assert.ok(!JSON.stringify(f.ledger()).includes('/grant'));
  for(const call of f.calls){assert.ok(!call.url.href.includes(f.credentials.accessToken));assert.ok(!call.init.body?.includes(f.credentials.accessToken));assert.equal(call.init.redirect,'error');}
});
test('Facebook text and link post uses page feed with explicit published flag',async()=>{
  const f=fixture({platform:'facebook',options:{link:'https://synk.im/'}});const response=await f.provider.publish(f.input);assert.equal(response.status,'published');assert.equal(f.posts().length,1);assert.equal(f.posts()[0].path,'100/feed');assert.equal(f.posts()[0].params.get('link'),'https://synk.im/');assert.equal(f.posts()[0].params.get('published'),'true');
});
test('Facebook photo verifies returned post ID rather than assuming photo ID is a post',async()=>{
  const f=fixture({platform:'facebook',format:'image',media:[asset()],options:{altText:'그림 설명'}});const response=await f.provider.publish(f.input);assert.equal(response.status,'published');assert.equal(response.providerId,'100_700');assert.equal(f.posts()[0].path,'100/photos');assert.equal(f.posts()[0].params.get('caption'),'확정 원문');assert.equal(f.posts()[0].params.get('alt_text_custom'),'그림 설명');
});
test('Facebook photo-only ID uses photo proof fields and remote link',async()=>{
  const f=fixture({platform:'facebook',format:'image',media:[asset()],handler:call=>call.path==='100/photos'?json({id:'800'}):undefined});const response=await f.provider.publish(f.input);assert.equal(response.status,'published');assert.equal(response.providerId,'800');assert.ok(response.url.includes('fbid=800'));
});
test('pending Reel resumes from persisted container after restart with continuation authorization',async()=>{
  let finished=false;const f=fixture({format:'reel',media:[asset('video',MP4)],options:{thumbnailTimestamp:1000,shareToFeed:false},handler:call=>call.path==='601'?json({id:'601',status_code:finished?'FINISHED':'IN_PROGRESS'}):undefined});
  assert.equal((await f.provider.publish(f.input)).status,'processing');assert.equal(f.posts().length,1);assert.equal(f.posts()[0].params.get('media_type'),'REELS');assert.equal(f.posts()[0].params.get('share_to_feed'),'false');
  finished=true;const response=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(response.status,'published');assert.equal(f.posts().filter(c=>c.path==='100/media').length,1);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);assert.ok(f.authorizations.some(c=>c.continuation===true));
});
test('carousel children must all finish before parent is created and published',async()=>{
  let finished=false;const f=fixture({format:'carousel',media:[asset('one'),asset('two')],handler:call=>call.path==='602'?json({id:'602',status_code:finished?'FINISHED':'IN_PROGRESS'}):undefined});
  assert.equal((await f.provider.publish(f.input)).status,'processing');assert.equal(f.posts().length,2);assert.ok(f.posts().every(c=>c.params.get('is_carousel_item')==='true'));
  finished=true;assert.equal((await f.provider.status({channel:f.input.channel,job:f.input.job})).status,'published');const parent=f.posts().find(c=>c.params.get('media_type')==='CAROUSEL');assert.equal(parent.params.get('children'),'601,602');assert.equal(f.posts().at(-1).params.get('creation_id'),'603');
});
test('unsupported formats and first comment are explicit manual handoffs without requests',async()=>{
  for(const input of [{platform:'facebook',format:'video',media:[asset('video',MP4)]},{format:'story'},{options:{firstComment:'안내'}}]){const f=fixture(input);const response=await f.provider.publish(f.input);assert.equal(response.status,'manual_required');assert.equal(f.calls.length,0);}
});
test('unapproved external media and unsupported PNG fail preflight before network',()=>{
  const f=fixture();for(const media of [[{url:'https://example.com/test.jpg',mimeType:'image/jpeg',byteSize:100,width:1080,height:1080}],[{...asset(),mimeType:'image/png'}]]){const checked=f.provider.preflight({...f.input,variant:{...f.input.variant,media}});assert.equal(checked.valid,false);}assert.equal(f.calls.length,0);
});
test('modified approved bytes stop before any media POST or public URL is issued',async()=>{
  let issued=0;const f=fixture({resolve:async()=>({bytes:Buffer.from('tampered')}),issueUrl:async()=>{issued++;return {url:'https://example.com/a.jpg'};}});const response=await f.provider.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.errorCode,'MEDIA_CONTENT_CHANGED');assert.equal(f.posts().length,0);assert.equal(issued,0);
});
test('private or credential-bearing media grants are rejected before a POST',async()=>{
  for(const url of ['https://127.0.0.1/a.jpg','https://user:secret@example.com/a.jpg','http://example.com/a.jpg']){const f=fixture({issueUrl:async()=>({url})});const response=await f.provider.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.errorCode,'INVALID_MEDIA_URL');assert.equal(f.posts().length,0);}
});
test('connection change during media preparation prevents any POST',async()=>{
  const f=fixture({issueUrl:async()=>{f.store.put('socialDirectConnections','channel',{...f.store.get('socialDirectConnections','channel'),version:'reconnected'});return {url:'https://workspace.synk.im/approved.jpg'};}});const response=await f.provider.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.errorCode,'CONNECTION_CHANGED');assert.equal(f.posts().length,0);
});
test('revoked continuation approval prevents a ready Reel from publishing',async()=>{
  let finished=false;const f=fixture({format:'reel',media:[asset('video',MP4)],handler:c=>c.path==='601'?json({id:'601',status_code:finished?'FINISHED':'IN_PROGRESS'}):undefined,authorize:context=>{if(context.continuation)throw Error('approval revoked');}});
  assert.equal((await f.provider.publish(f.input)).status,'processing');finished=true;const response=await f.provider.status({channel:f.input.channel,job:f.input.job});assert.equal(response.status,'failed');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,0);
});
for(const [name,handler]of [['network',()=>{throw Error('network with secret-token-not-for-output');}],['server error',()=>json({error:{message:'private details'}},500)],['malformed success',()=>new Response('not-json',{status:200})],['missing ID',()=>json({success:true})]])test('ambiguous final '+name+' never retries, even with new process and larger attempt count',async()=>{
  const f=fixture({handler:c=>c.path==='100/media_publish'?handler():undefined});const first=await f.provider.publish(f.input);assert.equal(first.status,'uncertain');assert.equal(first.retryable,false);assert.equal(first.definitive,false);
  const next=f.create();assert.equal((await next.status({channel:f.input.channel,job:f.input.job})).status,'uncertain');assert.equal((await next.publish({...f.input,job:{...f.input.job,attempts:99}})).status,'uncertain');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);assert.ok(!JSON.stringify(first).includes('private details'));assert.ok(!JSON.stringify(first).includes(f.credentials.accessToken));
});
test('accepted ID with failing read stays submitted and only retries reads',async()=>{
  let unavailable=true;const f=fixture({handler:c=>c.path==='700'&&unavailable?json({error:{code:100}},400):undefined});const first=await f.provider.publish(f.input);assert.equal(first.status,'submitted');assert.equal(first.providerId,'700');unavailable=false;assert.equal((await f.create().status({channel:f.input.channel,job:f.input.job})).status,'published');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});
test('unexpected remote owner never becomes published',async()=>{
  const f=fixture({handler:c=>c.path==='700'?json({id:'700',owner:{id:'999'},caption:'확정 원문',timestamp:NOW,permalink:'https://www.instagram.com/p/wrong/'}):undefined});const response=await f.provider.publish(f.input);assert.equal(response.status,'submitted');assert.equal(response.errorCode,'PUBLICATION_PROOF_MISMATCH');assert.equal(response.publicVerified,false);
});
test('Instagram Facebook Login uses Facebook Graph and IG account identity',async()=>{
  const f=fixture({authType:'instagram-facebook',handler:c=>c.path==='700'?json({id:'700',owner:{id:'100'},caption:'확정 원문',permalink:'https://www.instagram.com/p/ABC123/',timestamp:NOW}):undefined});assert.equal((await f.provider.publish(f.input)).status,'published');assert.ok(f.calls.every(c=>c.url.hostname==='graph.facebook.com'));assert.equal(f.calls[0].path,'100');
});
test('Facebook user credentials resolve only the authorized Page with create-content task',async()=>{
  const f=fixture({platform:'facebook',authType:'facebook-user'});assert.equal((await f.provider.publish(f.input)).status,'published');assert.equal(f.calls[0].path,'me/accounts');assert.equal(f.posts()[0].init.headers.Authorization,'Bearer page-derived-token');
  const bad=fixture({platform:'facebook',authType:'facebook-user',handler:c=>c.path==='me/accounts'?json({data:[{id:'100',access_token:'page-token',tasks:['MODERATE']}]}):undefined});assert.equal((await bad.provider.publish(bad.input)).errorCode,'PAGE_ACCESS_REQUIRED');assert.equal(bad.posts().length,0);
});
test('two provider instances share durable send claims and emit only one final POST',async()=>{
  let release;const wait=new Promise(resolve=>release=resolve);const f=fixture({handler:async c=>{if(c.path==='100/media_publish'){await wait;return json({id:'700'});}}});
  const first=f.provider.publish(f.input);for(let n=0;n<100&&!f.posts().some(c=>c.path==='100/media_publish');n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
  const duplicate=await f.create().publish(f.input);assert.equal(duplicate.status,'uncertain');const resumed=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(resumed.status,'uncertain');release();assert.equal((await first).status,'published');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});
test('lost container creation response is safe to reschedule and never invokes publish',async()=>{
  const f=fixture({handler:c=>{if(c.path==='100/media')throw Error('lost');}});const response=await f.provider.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.definitive,true);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,0);
});
test('published container without a media ID stays uncertain and is never published again',async()=>{
  const f=fixture({handler:c=>c.path==='601'?json({id:'601',status_code:'PUBLISHED'}):undefined});assert.equal((await f.provider.publish(f.input)).status,'uncertain');assert.equal((await f.create().status({channel:f.input.channel,job:f.input.job})).status,'uncertain');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,0);
});
test('automatic token refresh with unchanged identity can continue; changed manual binding cannot',async()=>{
  let finished=false;const f=fixture({format:'reel',media:[asset('video',MP4)],handler:c=>c.path==='601'?json({id:'601',status_code:finished?'FINISHED':'IN_PROGRESS'}):undefined});assert.equal((await f.provider.publish(f.input)).status,'processing');finished=true;
  const refreshed=f.create({getCredentials:async()=>{const credentials={...f.store.secret('channel:channel'),accessToken:'rotated-token'};f.store.setSecret('channel:channel',credentials);return credentials;}});assert.equal((await refreshed.status({channel:f.input.channel,job:f.input.job})).status,'published');
});
test('configured API budget and upstream rate-limit cooldown stop repeated requests',async()=>{
  const f=fixture({platform:'facebook',handler:c=>c.path==='me'?json({error:{code:4}},429,{'retry-after':'60'}):undefined});const response=await f.provider.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.retryable,true);assert.equal(response.definitive,true);assert.equal(response.nextRetryAt,'2026-10-14T10:01:00.000Z');
  const before=f.calls.length;const retry=await f.provider.publish({...f.input,job:{...f.input.job,attempts:2}});assert.equal(retry.errorCode,'META_RATE_LIMIT');assert.equal(f.calls.length,before);
});

test('a caption that differs only by CRLF, trailing spaces and NFC still verifies as published',async()=>{
  const f=fixture({handler:c=>c.path==='700'?json({id:'700',owner:{id:'101'},caption:'확정 원문'.normalize('NFD')+'  \r\n',permalink:'https://www.instagram.com/p/ABC123/',timestamp:NOW}):undefined});
  const response=await f.provider.publish(f.input);assert.equal(response.status,'published');assert.equal(response.errorCode,null);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});

test('a persistent caption mismatch ends as published-unverified after three checks and stops requesting',async()=>{
  const f=fixture({handler:c=>c.path==='700'?json({id:'700',owner:{id:'101'},caption:'다른 글',permalink:'https://www.instagram.com/p/ABC123/',timestamp:NOW}):undefined});
  const first=await f.provider.publish(f.input);assert.equal(first.status,'submitted');assert.equal(first.errorCode,'PUBLICATION_PROOF_MISMATCH');
  assert.equal((await f.provider.status({channel:f.input.channel,job:f.input.job})).status,'submitted');
  const third=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(third.status,'published');assert.equal(third.errorCode,'PUBLICATION_PROOF_UNVERIFIED');assert.equal(third.providerId,'700');assert.match(third.message,/3회/);assert.equal(third.url,'https://www.instagram.com/p/ABC123/');
  const before=f.calls.length;assert.equal((await f.create().status({channel:f.input.channel,job:f.input.job})).status,'published');assert.equal(f.calls.length,before);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});

test('an unexpected remote owner never finalizes as published however often it is checked',async()=>{
  const f=fixture({handler:c=>c.path==='700'?json({id:'700',owner:{id:'999'},caption:'확정 원문',timestamp:NOW,permalink:'https://www.instagram.com/p/wrong/'}):undefined});assert.equal((await f.provider.publish(f.input)).status,'submitted');
  for(let n=0;n<4;n++){const response=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(response.status,'submitted');assert.equal(response.errorCode,'PUBLICATION_PROOF_MISMATCH');}
});

test('verification continues through a new session after the publishing link changes for the same account',async()=>{
  let unavailable=true;const f=fixture({handler:c=>c.path==='700'&&unavailable?json({error:{code:100}},400):undefined});assert.equal((await f.provider.publish(f.input)).status,'submitted');unavailable=false;
  f.store.put('socialDirectConnections','channel',{...f.store.get('socialDirectConnections','channel'),enabled:false,version:'reconnected'});
  const resumed=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(resumed.status,'published');assert.equal(resumed.providerId,'700');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});

test('a changed account after publishing stops verification without requests',async()=>{
  let unavailable=true;const f=fixture({handler:c=>c.path==='700'&&unavailable?json({error:{code:100}},400):undefined});assert.equal((await f.provider.publish(f.input)).status,'submitted');unavailable=false;
  f.store.put('channels','channel',{...f.store.get('channels','channel'),externalId:'999'});const before=f.calls.length;
  const response=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(response.status,'submitted');assert.equal(response.errorCode,'ACCOUNT_CHANGED');assert.equal(f.calls.length,before);
});

test('a Reel still processing reports a growing checkAfterMs and polls the container briefly inside one call',async()=>{
  const waits=[],f=fixture({format:'reel',media:[asset('video',MP4)],handler:c=>c.path==='601'?json({id:'601',status_code:'IN_PROGRESS'}):undefined}),provider=f.create({wait:async ms=>{waits.push(ms);f.advance(ms);}});
  const first=await provider.publish(f.input);assert.equal(first.status,'processing');assert.equal(first.checkAfterMs,15000);assert.deepEqual(waits,[10000,10000]);assert.equal(f.calls.filter(c=>c.path==='601').length,3);
  for(const expected of [30000,60000,120000,120000,120000,undefined]){const response=await provider.status({channel:f.input.channel,job:f.input.job});assert.equal(response.status,'processing');assert.equal(response.checkAfterMs,expected);}
  assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,0);assert.equal(f.ledger().status,'processing');
});

test('a container that finishes during the brief poll is published in the same call',async()=>{
  let checks=0;const waits=[],f=fixture({format:'reel',media:[asset('video',MP4)],handler:c=>c.path==='601'?json({id:'601',status_code:++checks>=2?'FINISHED':'IN_PROGRESS'}):undefined}),provider=f.create({wait:async ms=>{waits.push(ms);f.advance(ms);}});
  const response=await provider.publish(f.input);assert.equal(response.status,'published');assert.equal(response.checkAfterMs,undefined);assert.deepEqual(waits,[10000]);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});

test('carousel children finishing during the brief poll are published in one call',async()=>{
  let checks=0;const f=fixture({format:'carousel',media:[asset('one'),asset('two')],handler:c=>c.path==='602'?json({id:'602',status_code:++checks>=2?'FINISHED':'IN_PROGRESS'}):undefined}),provider=f.create({wait:async ms=>f.advance(ms)});
  assert.equal((await provider.publish(f.input)).status,'published');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);assert.equal(f.posts().find(c=>c.params.get('media_type')==='CAROUSEL').params.get('children'),'601,602');
});

test('an interrupted check leaves a processing container for the next check instead of failing it',async()=>{
  const controller=new AbortController(),f=fixture({format:'reel',media:[asset('video',MP4)],handler:c=>c.path==='601'?json({id:'601',status_code:'IN_PROGRESS'}):undefined}),provider=f.create({wait:async()=>controller.abort()});
  const response=await provider.publish({...f.input,signal:controller.signal});assert.equal(response.status,'processing');assert.equal(response.checkAfterMs,15000);assert.equal(f.ledger().status,'processing');assert.equal(f.calls.filter(c=>c.path==='601').length,1);
  const resumed=await f.create({wait:async()=>{}}).status({channel:f.input.channel,job:f.input.job,signal:AbortSignal.abort()});assert.equal(resumed.status,'processing');assert.equal(f.ledger().status,'processing');
});

test('a busy media delivery slot is not a definitive failure: the job waits and the next check resumes preparation',async()=>{
  let busy=true;const contexts=[],f=fixture({issueUrl:async(ref,context)=>{contexts.push(context.continuation===true);if(busy)throw Object.assign(new Error('게시 파일을 준비하고 있어요. 잠시 후 다시 시도해 주세요.'),{status:429,code:'SOCIAL_MEDIA_BUSY'});return {url:'https://workspace.synk.im/api/social/direct-media/'+ref.id+'/grant'};}});
  const first=await f.provider.publish(f.input);assert.equal(first.status,'processing');assert.equal(first.errorCode,'MEDIA_DELIVERY_BUSY');assert.equal(first.retryable,true);assert.equal(first.definitive,false);assert.equal(first.checkAfterMs,15000);assert.equal(f.ledger().status,'preparing');assert.equal(f.posts().length,0);
  busy=false;const resumed=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(resumed.status,'published');assert.deepEqual(contexts,[false,true]);assert.ok(f.authorizations.some(c=>c.continuation===true));assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});

test('a media delivery slot that stays busy ends as a definitive unsent failure that can be rescheduled',async()=>{
  const f=fixture({issueUrl:async()=>{throw Object.assign(new Error('busy'),{status:429,code:'SOCIAL_MEDIA_BUSY'});}});
  let response=await f.provider.publish(f.input),checks=0;while(response.status==='processing'&&checks<20){checks++;response=await f.create().status({channel:f.input.channel,job:f.input.job});}
  assert.equal(checks,9);assert.equal(response.status,'failed');assert.equal(response.errorCode,'MEDIA_DELIVERY_BUSY');assert.equal(response.definitive,true);assert.equal(response.retryable,true);assert.equal(f.posts().length,0);
  assert.equal((await f.create().publish({...f.input,job:{...f.input.job,attempts:2}})).status,'failed');assert.equal(f.ledger().attemptNumber,2);assert.equal(f.posts().length,0);
});

test('credential errors with a known code become a definitive retryable unsent failure carrying their message',async()=>{
  for(const code of ['CHANNEL_INACTIVE','COLLECTION_DISABLED','CONNECTION_CHANGED','CONNECTION_OWNER_INACTIVE']){
    const f=fixture(),provider=f.create({getCredentials:async()=>{throw Object.assign(new Error('연결한 담당자가 비활성 상태예요. 계정 연결을 다시 확인해 주세요.'),{code,status:400});}});
    const response=await provider.publish(f.input);assert.equal(response.status,'failed',code);assert.equal(response.errorCode,code);assert.equal(response.definitive,true);assert.equal(response.retryable,true);assert.match(response.message,/담당자가 비활성/);assert.equal(f.calls.length,0);assert.equal(f.ledger().status,'failed');
  }
  const f=fixture(),provider=f.create({getCredentials:async()=>{throw Object.assign(new Error('secret internal detail'),{status:400});}});const response=await provider.publish(f.input);assert.equal(response.status,'failed');assert.equal(response.errorCode,'META_PUBLISH_FAILED');assert.equal(response.retryable,false);assert.ok(!response.message.includes('secret internal detail'));assert.equal(f.calls.length,0);
});

test('transient Meta error codes on the final publish request stay uncertain and are never resent',async()=>{
  for(const code of [1,2,4,17,32,613]){
    const f=fixture({handler:c=>c.path==='100/media_publish'?json({error:{message:'temporary',code}},400):undefined});const first=await f.provider.publish(f.input);assert.equal(first.status,'uncertain',String(code));assert.equal(first.retryable,false);assert.equal(first.definitive,false);assert.ok(!JSON.stringify(first).includes('temporary'));
    const again=await f.create().publish({...f.input,job:{...f.input.job,attempts:2,scheduleRevision:2}});assert.equal(again.status,'uncertain');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
  }
  const container=fixture({handler:c=>c.path==='100/media'&&c.init.method==='POST'?json({error:{message:'temporary',code:2}},400):undefined});const lost=await container.provider.publish(container.input);assert.equal(lost.status,'failed');assert.equal(lost.definitive,true);assert.equal(container.posts().filter(c=>c.path==='100/media_publish').length,0);
});

test('an uncertain Instagram publish is confirmed from the account recent media',async()=>{
  let lost=true;const f=fixture({handler:c=>{if(c.path==='100/media_publish'&&lost)throw Error('lost');if(c.path==='601'&&!lost)return json({id:'601',status_code:'PUBLISHED'});if(c.path==='100/media'&&c.init.method==='GET')return json({data:[{id:'699',caption:'다른 글',timestamp:NOW,permalink:'https://www.instagram.com/p/OTHER/'},{id:'700',caption:'확정 원문 ',timestamp:NOW,permalink:'https://www.instagram.com/p/ABC123/'}]});}});
  const first=await f.provider.publish(f.input);assert.equal(first.status,'uncertain');assert.equal(first.errorCode,'SUBMISSION_RESULT_UNKNOWN');lost=false;f.advance(180000);
  const checked=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(checked.status,'published');assert.equal(checked.providerId,'700');assert.equal(checked.url,'https://www.instagram.com/p/ABC123/');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);assert.equal(f.ledger().autoChecks,1);
});

test('an uncertain Instagram publish whose container is still unpublished opens a retry after the recent media check',async()=>{
  let lost=true;const f=fixture({handler:c=>{if(c.path==='100/media_publish'&&lost)throw Error('lost');if(c.path==='100/media'&&c.init.method==='GET')return json({data:[{id:'699',caption:'다른 글',timestamp:NOW}]});}});
  assert.equal((await f.provider.publish(f.input)).status,'uncertain');lost=false;f.advance(180000);
  const checked=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(checked.status,'failed');assert.equal(checked.errorCode,'NOT_SUBMITTED');assert.equal(checked.definitive,true);assert.equal(checked.retryable,true);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
  const retried=await f.create().publish({...f.input,job:{...f.input.job,attempts:2,scheduleRevision:2}});assert.equal(retried.status,'published');assert.equal(f.posts().filter(c=>c.path==='100/media').length,2);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,2);
});

test('automatic checks stop after three attempts and a published container never opens a retry',async()=>{
  let lost=true;const f=fixture({handler:c=>{if(c.path==='100/media_publish'&&lost)throw Error('lost');if(c.path==='100/media'&&c.init.method==='GET')return json({data:[]});if(c.path==='601')return json({id:'601',status_code:lost?'FINISHED':'PUBLISHED'});}});
  assert.equal((await f.provider.publish(f.input)).status,'uncertain');lost=false;f.advance(180000);
  for(let n=0;n<3;n++)assert.equal((await f.create().status({channel:f.input.channel,job:f.input.job})).status,'uncertain');
  const before=f.calls.length;assert.equal((await f.create().status({channel:f.input.channel,job:f.input.job})).status,'uncertain');assert.equal(f.calls.length,before);assert.equal(f.ledger().autoChecks,3);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});

const {metaRequestTimeout}=await import('./social-direct-meta.mjs');
test('media-bearing Meta requests get a longer timeout than plain requests',async()=>{
  const f=fixture({platform:'facebook',format:'image',media:[asset()]});assert.equal((await f.provider.publish(f.input)).status,'published');assert.equal(f.posts().find(c=>c.path==='100/photos').init.timeoutMs,75000);assert.equal(f.calls.find(c=>c.path==='me').init.timeoutMs,20000);
  const g=fixture();assert.equal((await g.provider.publish(g.input)).status,'published');assert.equal(g.posts().find(c=>c.path==='100/media').init.timeoutMs,75000);assert.equal(g.posts().find(c=>c.path==='100/media_publish').init.timeoutMs,20000);assert.equal(g.calls.find(c=>c.path==='601').init.timeoutMs,20000);
  assert.equal(metaRequestTimeout('POST',{video_url:'https://workspace.synk.im/a.mp4'}),75000);assert.equal(metaRequestTimeout('POST',{url:'https://workspace.synk.im/a.jpg'}),75000);assert.equal(metaRequestTimeout('POST',{creation_id:'1'}),20000);assert.equal(metaRequestTimeout('GET',{}),20000);
});

test('an uncertain Facebook publish is confirmed from the Page feed and otherwise stays unknown',async()=>{
  let lost=true;const f=fixture({platform:'facebook',handler:c=>{if(c.path==='100/feed'&&c.init.method==='POST'&&lost)throw Error('lost');if(c.path==='100/feed'&&c.init.method==='GET')return json({data:[{id:'100_699',message:'다른 글',created_time:NOW,is_published:true},{id:'100_700',message:'확정 원문 ',created_time:NOW,permalink_url:'https://www.facebook.com/100/posts/700',is_published:true}]});}});
  assert.equal((await f.provider.publish(f.input)).status,'uncertain');lost=false;
  const checked=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(checked.status,'published');assert.equal(checked.providerId,'100_700');assert.equal(f.posts().filter(c=>c.path==='100/feed').length,1);
  const g=fixture({platform:'facebook',handler:c=>{if(c.path==='100/feed'&&c.init.method==='POST')throw Error('lost');if(c.path==='100/feed'&&c.init.method==='GET')return json({data:[{id:'100_699',message:'다른 글',created_time:NOW}]});}});
  assert.equal((await g.provider.publish(g.input)).status,'uncertain');g.advance(180000);for(let n=0;n<4;n++){const response=await g.create().status({channel:g.input.channel,job:g.input.job});assert.equal(response.status,'uncertain');assert.equal(response.errorCode,'SUBMISSION_RESULT_UNKNOWN');}assert.equal(g.ledger().autoChecks,3);assert.equal(g.posts().filter(c=>c.path==='100/feed').length,1);
});

test('a check within three minutes of a lost final write never opens a retry and is not counted',async()=>{
  let lost=true;const f=fixture({handler:c=>{if(c.path==='100/media_publish'&&lost)throw Error('lost');if(c.path==='100/media'&&c.init.method==='GET')return json({data:[]});}});
  assert.equal((await f.provider.publish(f.input)).status,'uncertain');lost=false;assert.equal(f.ledger().submittedAt,NOW);
  f.advance(179000);for(let n=0;n<2;n++){const early=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(early.status,'uncertain');assert.equal(early.errorCode,'SUBMISSION_RESULT_UNKNOWN');}
  assert.equal(f.ledger().autoChecks||0,0);assert.equal(f.ledger().status,'uncertain');assert.equal(f.calls.filter(c=>c.path==='601').length,3);assert.equal(f.calls.filter(c=>c.path==='100/media'&&c.init.method==='GET').length,0,'an unpublished container is not matched to recent posts');
  f.advance(1000);const settled=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(settled.status,'failed');assert.equal(settled.errorCode,'NOT_SUBMITTED');assert.equal(f.ledger().autoChecks,1);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
  let lostAgain=true;const g=fixture({handler:c=>{if(c.path==='100/media_publish'&&lostAgain)throw Error('lost');if(c.path==='601'&&!lostAgain)return json({id:'601',status_code:'PUBLISHED'});if(c.path==='100/media'&&c.init.method==='GET')return json({data:[{id:'700',caption:'확정 원문',timestamp:NOW,permalink:'https://www.instagram.com/p/ABC123/'}]});}});
  assert.equal((await g.provider.publish(g.input)).status,'uncertain');lostAgain=false;g.advance(5000);const confirmed=await g.create().status({channel:g.input.channel,job:g.input.job});assert.equal(confirmed.status,'published');assert.equal(confirmed.providerId,'700');assert.equal(g.posts().filter(c=>c.path==='100/media_publish').length,1);
});

test('an uncertain Instagram publish whose container is unpublished never takes another post with the same text',async()=>{
  let lost=true;const other={id:'555',caption:'확정 원문',timestamp:new Date(Date.parse(NOW)-3*60000).toISOString(),permalink:'https://www.instagram.com/p/OTHER_SAME/'};
  const f=fixture({handler:c=>{if(c.path==='100/media_publish'&&lost)throw Error('lost');if(c.path==='100/media'&&c.init.method==='GET')return json({data:[other]});if(c.path==='555')return json({id:'555',owner:{id:'101'},caption:'확정 원문',permalink:other.permalink,timestamp:other.timestamp});}});
  assert.equal((await f.provider.publish(f.input)).status,'uncertain');lost=false;
  f.advance(60000);const early=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(early.status,'uncertain');assert.equal(f.ledger().providerId||null,null);
  f.advance(120000);const settled=await f.create().status({channel:f.input.channel,job:f.input.job});assert.equal(settled.status,'failed');assert.equal(settled.errorCode,'NOT_SUBMITTED');assert.equal(f.ledger().providerId||null,null);
  assert.equal(f.calls.filter(c=>c.path==='555').length,0,'the other post is never verified as this job');assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});

test('a published Instagram container is matched only to one unclaimed post with its text around the final write',async()=>{
  let lost=true,recent=[];const f=fixture({handler:c=>{if(c.path==='100/media_publish'&&lost)throw Error('lost');if(c.path==='601'&&!lost)return json({id:'601',status_code:'PUBLISHED'});if(c.path==='100/media'&&c.init.method==='GET')return json({data:recent});}});
  assert.equal((await f.provider.publish(f.input)).status,'uncertain');lost=false;f.advance(180000);
  const item=(id,minutes)=>({id,caption:'확정 원문',timestamp:new Date(Date.parse(NOW)+minutes*60000).toISOString(),permalink:'https://www.instagram.com/p/P'+id+'/'});const check=()=>f.create().status({channel:f.input.channel,job:f.input.job});
  recent=[item('701',0),item('702',1)];assert.equal((await check()).status,'uncertain','two posts with the same text stay unknown');
  recent=[item('703',-10)];assert.equal((await check()).status,'uncertain','a post from well before the final write is not this one');
  f.store.put('socialDirectPublishJobs','other-row',{id:'other-row',provider:'meta-direct',status:'published',providerId:'704',accountId:'100'});recent=[item('704',0)];assert.equal((await check()).status,'uncertain','a post another job already holds is not this one');
  assert.equal(f.ledger().providerId||null,null);assert.equal(f.ledger().autoChecks,3);assert.equal(f.posts().filter(c=>c.path==='100/media_publish').length,1);
});

test('an uncertain Facebook publish is matched only to one unclaimed Page post with its text around the final write',async()=>{
  let lost=true,feed=[];const f=fixture({platform:'facebook',handler:c=>{if(c.path==='100/feed'&&c.init.method==='POST'&&lost)throw Error('lost');if(c.path==='100/feed'&&c.init.method==='GET')return json({data:feed});}});
  assert.equal((await f.provider.publish(f.input)).status,'uncertain');lost=false;
  const item=(id,minutes)=>({id,message:'확정 원문',created_time:new Date(Date.parse(NOW)+minutes*60000).toISOString(),permalink_url:'https://www.facebook.com/100/posts/'+id.split('_')[1],is_published:true});const check=()=>f.create().status({channel:f.input.channel,job:f.input.job});
  feed=[item('100_701',-30)];assert.equal((await check()).status,'uncertain','an older Page post with the same text is not this one');
  f.store.put('socialDirectPublishJobs','other-row',{id:'other-row',provider:'meta-direct',status:'published',providerId:'100_702',accountId:'100'});feed=[item('100_702',0)];assert.equal((await check()).status,'uncertain','a Page post another job already holds is not this one');
  feed=[item('100_702',0),item('100_700',1)];const found=await check();assert.equal(found.status,'published');assert.equal(found.providerId,'100_700');assert.equal(f.posts().filter(c=>c.path==='100/feed').length,1);
});
