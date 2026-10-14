import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {createSocialProvider} from './social-provider.mjs';

const PNG=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const MP4=Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from('ftypisom00000000')]);
const admin={id:'admin',role:'admin',active:true};
const integration=(identifier='threads',id='integration-a',profile='synk')=>({id,name:'SYNK',identifier,profile,disabled:false});
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json',...headers}});
function fixture(t,options={}){
  const dir=mkdtempSync(join(tmpdir(),'synk-social-provider-')),store=new Store(dir),calls=[];t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  let now=Date.parse('2026-10-13T00:00:00.000Z'),rows=options.integrations||[integration()],handler=options.handler;
  store.put('users',admin.id,admin);store.put('channels','channel',{id:'channel',platform:options.platform||'threads',handle:'synk',displayName:'SYNK',active:true,ownerIds:[admin.id],connectionVersion:0});
  const fetchImpl=async(url,init)=>{calls.push({url,init});const intercepted=await handler?.(url,init);if(intercepted)return intercepted;if(url.endsWith('/me'))return json({organization:{id:'org-a',name:'SYNK test'},user:null});if(url.endsWith('/integrations'))return json(rows);if(url.endsWith('/upload'))return json({id:'media-one',path:'https://uploads.postiz.com/test.png'});if(url.endsWith('/upload-from-url'))return json({id:'remote-one',path:'https://uploads.postiz.com/remote.png'});if(init.method==='POST'&&url.endsWith('/posts'))return json([{postId:'provider-post',integration:'integration-a'}]);if(url.includes('/posts?'))return json({posts:[{id:'provider-post',integration:{id:'integration-a'},state:'PUBLISHED',publishDate:'2026-10-12T00:00:00.000Z',releaseURL:'https://www.threads.com/@synk/post/ABC123'}]});throw Error('Unexpected fake request');};
  const create=extra=>createSocialProvider({store,fetchImpl,clock:()=>new Date(now).toISOString(),resolveMedia:async()=>({bytes:PNG,fileName:'sample.png',mimeType:'image/png'}),...extra});
  const provider=create(options.providerOptions);
  return {store,calls,provider,create,advance:ms=>{now+=ms;},setRows:value=>{rows=value;},setHandler:value=>{handler=value;},channel:()=>store.get('channels','channel'),configure:()=>provider.configure(admin,{apiKey:'synthetic-secret-api-key'}),connect:()=>provider.connect(admin,{channelId:'channel',integrationId:'integration-a'}),input:(changes={})=>({channel:store.get('channels','channel'),post:{id:'post',ownerId:'admin',body:'안녕하세요',title:'시험 게시물'},variant:{channelId:'channel',text:'안녕하세요',format:'text',media:[],options:{}},job:{id:'job',idempotencyKey:'stable-reservation',contentVersion:1},...changes})};
}

test('collector OAuth is not treated as publishing authorization',t=>{
  const f=fixture(t);f.store.setSecret('channel:channel',{accessToken:'collector-only'});const cap=f.provider.capability(f.channel());assert.equal(cap.mode,'manual');assert.equal(cap.canPublish,false);assert.equal(f.calls.length,0);
});
test('configuration verifies organization and integrations, encrypts credentials and filters account details',async t=>{
  const f=fixture(t),state=await f.configure();assert.equal(state.organization.id,'org-a');assert.equal(state.integrations.length,1);assert.ok(!JSON.stringify(state).includes('synthetic-secret'));
  const raw=f.store.db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get('social:postiz').ciphertext;assert.ok(!raw.includes('synthetic-secret'));assert.equal(f.provider.settings({id:'stranger',role:'member',active:true}).integrations.length,0);assert.equal(f.provider.settings({id:'stranger',role:'member'}).baseUrl,undefined);
  await f.connect();assert.equal(f.provider.capability(f.channel()).mode,'automatic');assert.equal(f.provider.settings(admin).integrations[0].profile,'synk');
  assert.ok(f.calls.every(call=>call.init.redirect==='error'&&call.init.headers.Authorization==='synthetic-secret-api-key'));
});
test('only deployment-allowlisted endpoints can receive credentials',async t=>{
  const f=fixture(t);for(const baseUrl of ['https://evil.example/public/v1','http://169.254.169.254/public/v1','https://user:pass@api.postiz.com/public/v1','https://api.postiz.com/public/v1?x=1','https://api.postiz.com.evil.test/public/v1'])await assert.rejects(f.provider.configure(admin,{apiKey:'test',baseUrl}));assert.equal(f.calls.length,0);
  const local=f.create({allowedBaseUrls:['http://127.0.0.1:4007/api/public/v1']});await local.configure(admin,{apiKey:'local-test',baseUrl:'http://127.0.0.1:4007/api/public/v1'});assert.ok(f.calls[0].url.startsWith('http://127.0.0.1:4007/api/public/v1/'));
});
test('connection mapping verifies the live integration, platform, profile and duplicate association',async t=>{
  const f=fixture(t);await f.configure();await assert.rejects(f.provider.connect(admin,{channelId:'channel',integrationId:'invented'}),{code:'INTEGRATION_UNAVAILABLE'});
  f.setRows([integration('youtube')]);await assert.rejects(f.connect(),{code:'INTEGRATION_PLATFORM_MISMATCH'});
  f.setRows([integration('threads','integration-a','somebody-else')]);await assert.rejects(f.connect(),{code:'ACCOUNT_CONFIRMATION_REQUIRED'});
  await f.provider.connect(admin,{channelId:'channel',integrationId:'integration-a',confirmedProfile:'somebody-else'});assert.equal(f.provider.capability(f.channel()).canPublish,true);
  f.store.put('channels','other',{...f.channel(),id:'other'});await assert.rejects(f.provider.connect(admin,{channelId:'other',integrationId:'integration-a',confirmedProfile:'somebody-else'}),{code:'INTEGRATION_ALREADY_MAPPED'});
  f.setRows([{...integration(),disabled:true}]);await f.provider.refresh(admin);assert.equal(f.provider.capability(f.channel()).canPublish,false);
});
test('authorization revocation during network work prevents settings and mapping writes',async t=>{
  const f=fixture(t);let allowed=true;f.setHandler((url)=>{if(url.endsWith('/integrations'))allowed=false;});const context={authorize(){if(!allowed)throw Object.assign(Error('revoked'),{status:401});}};
  await assert.rejects(f.provider.configure(admin,{apiKey:'secret'},context),{status:401});assert.equal(f.store.get('socialProviderSettings','postiz'),null);assert.equal(f.store.secret('social:postiz'),null);
});
test('publishing uploads authorized local media and maps per-channel content and first comment',async t=>{
  const f=fixture(t);await f.configure();await f.connect();const result=await f.provider.publish(f.input({variant:{channelId:'channel',text:'게시문',format:'image',media:[{assetId:'local-one',type:'image',alt:'대체 설명'}],options:{firstComment:'첫 댓글',hashtags:['#SYNK']}}}));
  assert.equal(result.status,'submitted');assert.equal(result.providerId,'provider-post');assert.ok(result.requestId);assert.equal(result.publicVerified,false);
  const upload=f.calls.find(call=>call.url.endsWith('/upload'));assert.ok(upload.init.body instanceof FormData);assert.equal(upload.init.body.get('file').type,'image/png');
  const send=f.calls.find(call=>call.url.endsWith('/posts')&&call.init.method==='POST'),body=JSON.parse(send.init.body);assert.equal(body.type,'now');assert.deepEqual(body.posts[0].integration,{id:'integration-a'});assert.equal(body.posts[0].value[0].content,'게시문\n\n#SYNK');assert.equal(body.posts[0].value[1].content,'첫 댓글');assert.equal(body.posts[0].value[0].image[0].id,'media-one');assert.equal(body.posts[0].value[0].image[0].alt,'대체 설명');
});
test('successful API acceptance is not publication; provider status keeps scheduled time separate',async t=>{
  const f=fixture(t);await f.configure();await f.connect();const input=f.input();assert.equal((await f.provider.publish(input)).status,'submitted');const result=await f.provider.status(input);assert.equal(result.status,'published');assert.equal(result.publishedAt,null);assert.equal(result.observedAt,'2026-10-13T00:00:00.000Z');assert.equal(result.publicVerified,false);assert.equal(result.url,'https://www.threads.com/@synk/post/ABC123');
});
test('verified media uploads reuse their provider IDs across channels and process restart',async t=>{
  const f=fixture(t);await f.configure();const one=await f.provider.uploadMedia({bytes:PNG,mimeType:'image/png'}),two=await f.create().uploadMedia({bytes:PNG,mimeType:'image/png'});assert.equal(one.id,two.id);assert.equal(f.calls.filter(call=>call.url.endsWith('/upload')).length,1);
});
test('timeout, HTTP 500 and malformed acceptance never blindly retry after restart',async t=>{
  for(const outcome of ['timeout','500','malformed']){
    const f=fixture(t);await f.configure();await f.connect();f.setHandler((url,init)=>{if(url.endsWith('/posts')&&init.method==='POST'){if(outcome==='timeout')throw new Error('leaked synthetic-secret-api-key');return outcome==='500'?json({message:'leaked-secret'},500):json({unexpected:'leaked-secret'});}});
    const input=f.input(),result=await f.provider.publish(input);assert.equal(result.status,'uncertain');assert.ok(!JSON.stringify(result).includes('secret'));await f.create().publish(input);await f.provider.publish(input);assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,1);assert.equal((await f.provider.status(input)).status,'uncertain');
  }
});
test('concurrent duplicate dispatch creates exactly one provider post',async t=>{
  const f=fixture(t);await f.configure();await f.connect();const input=f.input(),results=await Promise.all([f.provider.publish(input),f.provider.publish(input),f.create().publish(input)]);assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,1);assert.ok(results.every(result=>['submitted','processing','uncertain'].includes(result.status)));
});
test('only a durably pre-submission interrupted job becomes safely retryable after its lease',async t=>{
  const f=fixture(t);await f.configure();await f.connect();const input=f.input();await f.provider.publish(input);const ledger=f.store.all('socialProviderJobs')[0];f.store.put('socialProviderJobs',ledger.id,{...ledger,status:'preparing',providerId:null});f.advance(300001);const result=await f.create().status(input);assert.equal(result.status,'failed');assert.equal(result.definitive,true);assert.equal(result.retryable,true);
  f.store.put('socialProviderJobs',ledger.id,{...ledger,status:'submitting',providerId:null});const unknown=await f.create().status(input);assert.equal(unknown.status,'uncertain');assert.equal(unknown.definitive,false);
});
test('an expired preparer cannot send after another process claims the same reservation',async t=>{
  const f=fixture(t);await f.configure();await f.connect();let release,entered;const pending=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;}),slow=f.create({resolveMedia:async()=>{entered();await gate;return {bytes:PNG,mimeType:'image/png'};}}),input=f.input({variant:{text:'text',format:'image',media:[{assetId:'media'}]}}),old=slow.publish(input);await pending;f.advance(300001);const retry=f.create();assert.equal((await retry.status(input)).definitive,true);input.job.attempts=1;assert.equal((await retry.publish(input)).status,'submitted');release();await old;assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,1);assert.equal(f.store.all('socialProviderJobs')[0].status,'submitted');
});
test('HTTP rejection and auth errors are redacted and not treated as successful posts',async t=>{
  for(const code of [400,401,403]){const f=fixture(t);await f.configure();await f.connect();f.setHandler((url,init)=>url.endsWith('/posts')&&init.method==='POST'?json({error:'synthetic-secret-api-key'},code):null);const result=await f.provider.publish(f.input());assert.equal(result.status,'failed');assert.equal(result.retryable,false);assert.ok(!JSON.stringify(result).includes('synthetic-secret'));}
});
test('an explicit new attempt can retry a rejected request but never a provider-accepted error',async t=>{
  const f=fixture(t);await f.configure();await f.connect();f.setHandler((url,init)=>url.endsWith('/posts')&&init.method==='POST'?json({},401):null);const input=f.input();assert.equal((await f.provider.publish(input)).definitive,true);f.setHandler(null);await f.provider.publish(input);assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,1);
  input.job.attempts=1;assert.equal((await f.provider.publish(input)).status,'submitted');f.setHandler(url=>url.includes('/posts?')?json({posts:[{id:'provider-post',integration:{id:'integration-a'},state:'ERROR'}]}):null);assert.equal((await f.provider.status(input)).definitive,false);input.job.attempts=2;assert.equal((await f.provider.publish(input)).status,'failed');assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,2);
});
test('provider post lookup verifies its channel and never trusts a mismatched post',async t=>{
  const f=fixture(t);await f.configure();await f.connect();await f.provider.publish(f.input());f.setHandler(url=>url.includes('/posts?')?json({posts:[{id:'provider-post',integration:{id:'other-account'},state:'PUBLISHED',releaseURL:'https://evil.test/post'}]}):null);assert.equal((await f.provider.status(f.input())).status,'uncertain');
});
test('YouTube requires video, explicit privacy and made-for-kids declaration',async t=>{
  const f=fixture(t,{platform:'youtube',integrations:[integration('youtube')],providerOptions:{resolveMedia:async()=>({bytes:MP4,fileName:'test.mp4',mimeType:'video/mp4'})}});await f.configure();await f.connect();const variant={channelId:'channel',format:'youtube-shorts',media:[{assetId:'video',type:'video',width:1080,height:1920,durationSeconds:60}],options:{}};
  assert.equal((await f.provider.publish(f.input({variant}))).errorCode,'YOUTUBE_DECLARATION_REQUIRED');variant.options={privacy:'unlisted',madeForKids:false};assert.equal((await f.provider.publish(f.input({variant}))).status,'submitted');const request=f.calls.find(call=>call.url.endsWith('/posts'));assert.equal(JSON.parse(request.init.body).posts[0].settings.type,'unlisted');assert.equal(JSON.parse(request.init.body).posts[0].settings.selfDeclaredMadeForKids,'no');
});
test('TikTok stays a manual path and unsupported options do not vanish',async t=>{
  const f=fixture(t,{platform:'tiktok',integrations:[integration('tiktok')]});await f.configure();await f.connect();assert.equal((await f.provider.publish(f.input())).status,'manual_required');assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,0);
  const other=fixture(t);await other.configure();await other.connect();const result=await other.provider.publish(other.input({variant:{format:'text',text:'text',options:{music:'track'}}}));assert.equal(result.errorCode,'OPTIONS_MANUAL_REQUIRED');
});
test('private media URLs, forged MIME and arbitrary local resolver errors cannot leak or publish',async t=>{
  const f=fixture(t);await f.configure();await f.connect();for(const url of ['http://localhost/secret','https://127.0.0.1/secret','https://user:password@cdn.example/file.png']){const result=await f.provider.publish(f.input({variant:{text:'test',format:'image',media:[{url,type:'image'}]}}));assert.equal(result.status,'failed');}
  await assert.rejects(f.provider.uploadMedia({bytes:PNG,mimeType:'video/mp4'}),{code:'UNSUPPORTED_MEDIA'});await assert.rejects(f.provider.uploadMedia({bytes:Buffer.from('not-media'),mimeType:'image/png'}),{code:'UNSUPPORTED_MEDIA'});
  const provider=f.create({resolveMedia:()=>{throw Error('C:/private/secret-api-key');}}),result=await provider.publish(f.input({job:{id:'newjob'},variant:{text:'test',format:'image',media:[{assetId:'abc'}]}}));assert.ok(!JSON.stringify(result).includes('secret-api-key'));assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,0);
});
test('connection or publish permission changes during media upload stop the final send',async t=>{
  const f=fixture(t);await f.configure();await f.connect();let authorized=true;const provider=f.create({resolveMedia:async()=>{authorized=false;return {bytes:PNG,mimeType:'image/png'};},authorizePublish:()=>{if(!authorized)throw Error('revoked');}}),result=await provider.publish(f.input({variant:{text:'test',format:'image',media:[{assetId:'abc'}]}}));assert.equal(result.status,'failed');assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,0);
});
test('persistent API request budget prevents uncontrolled polling and reports retry time',async t=>{
  const f=fixture(t);await f.configure();for(let i=0;i<28;i++)await f.provider.refresh(admin);const before=f.calls.length;await assert.rejects(f.create().refresh(admin),error=>error.code==='PROVIDER_RATE_LIMIT'&&!!error.nextRetryAt);assert.equal(f.calls.length,before);f.advance(3601000);await f.provider.refresh(admin);assert.equal(f.calls.length,before+1);
});

test('preflight exposes exact media requirements and rejects impossible formats without a network call',t=>{
  const f=fixture(t),input=f.input(),image={assetId:'image',type:'image',mimeType:'image/png'},video={assetId:'video',type:'video',mimeType:'video/mp4'};
  const cases=[
    [{format:'text',media:[image]},'FORMAT_MEDIA_MISMATCH'],
    [{format:'image',media:[video]},'FORMAT_MEDIA_MISMATCH'],
    [{format:'carousel',media:[image]},'FORMAT_MEDIA_MISMATCH'],
    [{format:'video',media:[]},'FORMAT_MEDIA_MISMATCH'],
    [{format:'post',media:[{type:'audio',mimeType:'audio/mp3'}]},'UNSUPPORTED_MEDIA'],
    [{format:'post',media:[{...video,mimeType:'video/webm'}]},'MEDIA_CONVERSION_REQUIRED'],
    [{format:'post',media:[{...video,url:'https://cdn.example/video.webm'}]},'MEDIA_CONVERSION_REQUIRED'],
    [{format:'image',media:[{...image,byteSize:10000001}]},'MEDIA_TOO_LARGE'],
    [{format:'image',media:[{...image,mimeType:'video/mp4'}]},'MEDIA_TYPE_MISMATCH'],
    [{format:'post',media:[],options:{music:'track'}},'OPTIONS_MANUAL_REQUIRED'],
  ];
  for(const [variant,code] of cases){const checked=f.provider.preflight({...input,variant:{...input.variant,...variant}});assert.equal(checked.valid,false,code);assert.equal(checked.errors[0].code,code);}
  const cap=f.provider.capability(f.channel());assert.ok(cap.mediaTypes.includes('video/mp4'));assert.ok(!cap.mediaTypes.includes('video/webm'));assert.equal(cap.formatRules.carousel.minMediaCount,2);assert.equal(cap.formatRules.image.maxMediaCount,1);assert.equal(f.calls.length,0);
});

test('Instagram story and carousel requirements also apply to default post and options',t=>{
  const f=fixture(t,{platform:'instagram'}),input=f.input(),image={assetId:'image',type:'image'},video={assetId:'video',type:'video'};
  for(const [variant,code] of [
    [{format:'post',media:[video,image]},'MIXED_MEDIA'],
    [{format:'story',media:[video]},'INVALID_INSTAGRAM_MEDIA'],
    [{format:'story',media:[image],options:{firstComment:'do not lose this'}},'OPTIONS_MANUAL_REQUIRED'],
    [{format:'reel',media:[{...video,durationSeconds:10}],options:{thumbnailTimestamp:10000}},'INVALID_COVER'],
  ])assert.equal(f.provider.preflight({...input,variant:{...input.variant,...variant}}).errors[0].code,code);
  assert.equal(f.provider.preflight({...input,variant:{format:'carousel',media:[image,image]}}).valid,true);
  assert.equal(f.provider.capability(f.channel()).formatRules.story.mediaKind,'image');
});

test('YouTube Shorts validates classification metadata instead of assuming an API flag exists',t=>{
  const f=fixture(t,{platform:'youtube'}),input=f.input(),variant={format:'youtube-shorts',options:{privacy:'unlisted',madeForKids:false}};
  for(const [media,code] of [[{type:'video'},'SHORTS_METADATA_REQUIRED'],[{type:'video',width:1920,height:1080,duration:60},'SHORTS_DIMENSIONS_INVALID'],[{type:'video',width:1080,height:1920,duration:181},'SHORTS_DIMENSIONS_INVALID']])assert.equal(f.provider.preflight({...input,variant:{...variant,media:[media]}}).errors[0].code,code);
  assert.equal(f.provider.preflight({...input,variant:{...variant,media:[{type:'video',width:1080,height:1080,duration:180}]}}).valid,true);
});

test('actual local file bytes must match the approved media kind before upload or posting',async t=>{
  const f=fixture(t,{providerOptions:{resolveMedia:async()=>({bytes:MP4,mimeType:'video/mp4'})}});await f.configure();await f.connect();
  const result=await f.provider.publish(f.input({variant:{format:'image',text:'image draft',media:[{assetId:'file',type:'image',mimeType:'image/png'}]}}));assert.equal(result.errorCode,'MEDIA_TYPE_MISMATCH');assert.equal(result.definitive,true);assert.ok(!f.calls.some(call=>call.url.endsWith('/upload')||call.url.endsWith('/posts')));
  await assert.rejects(f.provider.uploadMedia({bytes:Buffer.from([26,69,223,163]),mimeType:'video/webm'}),{code:'MEDIA_CONVERSION_REQUIRED'});
});

test('lease recovery cannot overwrite a concurrent transition from preparing to submitting',async t=>{
  const f=fixture(t);await f.configure();await f.connect();const input=f.input();await f.provider.publish(input);const ledger=f.store.all('socialProviderJobs')[0];f.store.put('socialProviderJobs',ledger.id,{...ledger,status:'preparing',providerId:null});f.advance(300001);
  const original=f.store.transaction.bind(f.store);let raced=false;f.store.transaction=fn=>{if(!raced){raced=true;const row=f.store.get('socialProviderJobs',ledger.id);original(()=>f.store.put('socialProviderJobs',ledger.id,{...row,status:'submitting',updatedAt:'2026-10-13T00:05:00.001Z'}));}return original(fn);};
  const result=await f.create().status(input);assert.equal(result.status,'uncertain');assert.equal(result.definitive,false);assert.equal(f.store.get('socialProviderJobs',ledger.id).status,'submitting');input.job.attempts=99;await f.create().publish(input);assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,1);
});

test('definitive throttling supports an explicit later attempt and recurring jobs remain distinct',async t=>{
  const f=fixture(t);await f.configure();await f.connect();const input=f.input();f.setHandler((url,init)=>url.endsWith('/posts')&&init.method==='POST'?json({},429,{'retry-after':'60'}):null);
  const rejected=await f.provider.publish(input);assert.equal(rejected.definitive,true);assert.equal(rejected.retryable,true);assert.ok(rejected.nextRetryAt);await f.create().publish(input);assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,1);
  f.setHandler(null);f.advance(61000);input.job.attempts=1;assert.equal((await f.create().publish(input)).status,'submitted');await f.provider.publish(input);assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,2);
  const next={...input,job:{...input.job,id:'recurrence-two',idempotencyKey:'recurrence-two'}};assert.equal((await f.create().publish(next)).status,'submitted');await f.create().publish(next);assert.equal(f.calls.filter(call=>call.url.endsWith('/posts')).length,3);
});

test('result checks leave ten of the thirty hourly Postiz requests for publishing',async t=>{
  const f=fixture(t);await f.configure();await f.connect();const input=f.input();assert.equal((await f.provider.publish(input)).status,'submitted');
  f.advance(61000);f.store.put('socialProviderRequests','postiz',{times:Array(20).fill(Date.parse('2026-10-13T00:01:00.000Z')),retryAfter:null});
  const before=f.calls.length,checked=await f.provider.status(input);assert.equal(checked.errorCode,'PROVIDER_RATE_LIMIT');assert.equal(f.calls.length,before,'the 21st check waits');
  const second=f.input({job:{id:'job-2',idempotencyKey:'second-reservation',contentVersion:1}});assert.equal((await f.provider.publish(second)).status,'submitted','publishing still has its share');
});
