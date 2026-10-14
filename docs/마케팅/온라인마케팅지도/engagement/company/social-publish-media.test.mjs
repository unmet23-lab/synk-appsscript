import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Writable} from 'node:stream';
import {createSocialPublishMedia} from './social-publish-media.mjs';
import {STUDIO_MEDIA_LIMIT} from './studio-media.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const copy=value=>value===undefined?undefined:structuredClone(value);
const origin='https://workspace.synk.im';
const png=()=>Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('private-approved-image-content')]);

class Response extends Writable{
  constructor(){super();this.headersSent=false;this.chunks=[];this.headers={};}
  writeHead(status,headers){this.status=status;this.headers=headers;this.headersSent=true;return this;}
  _write(chunk,encoding,done){this.chunks.push(Buffer.from(chunk));done();}
  get body(){return Buffer.concat(this.chunks);}
}

function fixture(t,options={}){
  const rows=new Map(),key=(kind,id)=>kind+':'+id;
  const store={get:(kind,id)=>copy(rows.get(key(kind,id))),put:(kind,id,value)=>{rows.set(key(kind,id),copy(value));return value;},all:kind=>[...rows.entries()].filter(([id])=>id.startsWith(kind+':')).map(([,value])=>copy(value)),remove:(kind,id)=>rows.delete(key(kind,id)),transaction:fn=>fn()};
  let time='2026-10-14T00:00:00.000Z',bytes=png(),mimeType='image/png',allowed=true,readHook,authorizeHook,reads=0;
  const phases=[];
  const ref={assetId:'asset-private',id:'asset-private',url:'/api/social/media/asset-private',sha256:digest(bytes),mimeType,byteSize:bytes.length,type:'image'};
  const channel={id:'ig',active:true,platform:'instagram',externalId:'account-private',connectionVersion:4};
  const variant={channelId:channel.id,text:'승인한 게시 내용',format:'image',media:[ref],options:{}};
  const snapshotPost={id:'post-private',ownerId:'owner-private',contentVersion:2,title:'게시물',body:'본문',variants:[variant]};
  const post={...snapshotPost,approval:{hash:'a'.repeat(64),contentVersion:2,byId:'approver-private',at:time,targets:[{channelId:'ig',connectionVersion:4}]}};
  const job={id:'job-private',postId:post.id,channelId:channel.id,contentVersion:2,approvalHash:post.approval.hash,idempotencyKey:'job-key-private',publisherId:'publisher-private',approverId:'approver-private',attempts:1,scheduleRevision:1,status:'publishing',snapshot:{post:snapshotPost,variant,channel:{id:channel.id}}};
  store.put('channels',channel.id,channel);store.put('socialPosts',post.id,post);store.put('socialPublishJobs',job.id,job);
  const service=createSocialPublishMedia({store,clock:()=>time,origin,resolveMedia:async(ref,context)=>{reads++;if(readHook)await readHook(ref,context);return {bytes,mimeType,fileName:'private-original-filename.png'};},authorizePublish:async context=>{phases.push(context.phase);if(authorizeHook)await authorizeHook(context);return allowed;},...options});
  t.after(()=>service.stop());
  const input=()=>({channel:store.get('channels',channel.id),post:store.get('socialPublishJobs',job.id).snapshot.post,variant:store.get('socialPublishJobs',job.id).snapshot.variant,job:store.get('socialPublishJobs',job.id)});
  const issue=(media=ref,context=input())=>service.issue(media,context);
  const request=async(url,method='GET',headers={},context={})=>{const response=new Response();const handled=await service.handle({method,headers},response,{url:new URL(url,origin),...context});return {response,handled};};
  const update=(kind,id,changes)=>store.put(kind,id,{...store.get(kind,id),...changes});
  return {store,service,issue,request,input,ref,post,job,channel,update,phases,reads:()=>reads,setTime:value=>time=value,setBytes:value=>bytes=value,setMime:value=>mimeType=value,setAllowed:value=>allowed=value,onRead:hook=>readHook=hook,onAuthorize:hook=>authorizeHook=hook};
}

test('issues an unguessable bearer URL and persists only its hash and approval binding',async t=>{
  const f=fixture(t),result=await f.issue(),url=new URL(result.url),raw=url.pathname.split('/').at(-1);
  assert.deepEqual(Object.keys(result),['url']);assert.equal(url.origin,origin);assert.match(raw,/^[A-Za-z0-9_-]{43}$/);
  const grants=f.store.all('socialPublishMediaGrants');assert.equal(grants.length,1);assert.equal(grants[0].id,digest(raw));
  assert.equal(grants[0].expiresAt,'2026-10-14T01:00:00.000Z');assert.equal(grants[0].binding.connectionVersion,4);assert.equal(grants[0].binding.approvalHash,f.post.approval.hash);
  const saved=JSON.stringify(grants);assert.ok(!saved.includes(raw));assert.ok(!saved.includes(result.url));
  const {response,handled}=await f.request(result.url);assert.equal(handled,true);assert.equal(response.status,200);assert.deepEqual(response.body,png());
  assert.equal(response.headers['Content-Type'],'image/png');assert.match(response.headers['Cache-Control'],/no-store/);assert.equal(response.headers['Referrer-Policy'],'no-referrer');
  assert.equal(response.headers['Accept-Ranges'],'bytes');assert.equal(response.headers['Content-Length'],png().length);
  const headerText=JSON.stringify(response.headers);for(const hidden of [raw,'asset-private','job-private','post-private','account-private','private-original-filename'])assert.ok(!headerText.includes(hidden));
  assert.deepEqual(f.phases,['media-issue','media-issue','media-fetch','media-fetch']);
});

test('GET and HEAD support a single exact, suffix or open-ended byte range',async t=>{
  const f=fixture(t),{url}=await f.issue();
  for(const [range,start,end] of [['bytes=8-12',8,12],['bytes=8-',8,png().length-1],['bytes=-4',png().length-4,png().length-1],['bytes=0-9999',0,png().length-1]]){
    const {response}=await f.request(url,'GET',{range});assert.equal(response.status,206);assert.deepEqual(response.body,png().subarray(start,end+1));assert.equal(response.headers['Content-Range'],`bytes ${start}-${end}/${png().length}`);
  }
  const head=await f.request(url,'HEAD');assert.equal(head.response.status,200);assert.equal(head.response.body.length,0);assert.equal(head.response.headers['Content-Length'],png().length);
  const partialHead=await f.request(url,'HEAD',{range:'bytes=0-3'});assert.equal(partialHead.response.status,206);assert.equal(partialHead.response.body.length,0);assert.equal(partialHead.response.headers['Content-Length'],4);
  for(const range of ['bytes=0-1,3-4','bytes=-0','bytes=99999-','bytes=3-2','invalid']){const {response}=await f.request(url,'GET',{range});assert.equal(response.status,416);assert.equal(response.headers['Content-Range'],`bytes */${png().length}`);}
});

test('URL routing rejects malformed tokens, query credentials and unsupported methods without disclosing data',async t=>{
  const f=fixture(t),{url}=await f.issue(),before=f.reads();
  for(const target of [url+'?token=private',url+'/',origin+'/social-publish-media/short',origin+'/social-publish-media/'+'Z'.repeat(43)]){
    const {response,handled}=await f.request(target);assert.equal(handled,true);assert.equal(response.status,404);assert.ok(!response.body.toString().includes('private'));
  }
  const method=await f.request(url,'POST');assert.equal(method.response.status,405);assert.equal(method.response.headers.Allow,'GET, HEAD');
  const demo=await f.request(url,'GET',{'x-synk-demo':'1'});assert.equal(demo.response.status,404);
  assert.equal((await f.request('/api/social/media/asset-private')).handled,false);assert.equal(f.reads(),before);
});

test('media access continues only while the matching job is publishing or awaiting a result',async t=>{
  const f=fixture(t),{url}=await f.issue();
  for(const status of ['publishing','accepted','processing','unknown']){f.update('socialPublishJobs',f.job.id,{status});assert.equal((await f.request(url)).response.status,200);}
  for(const status of ['scheduled','published','failed','cancelled','skipped','expired','manual']){f.update('socialPublishJobs',f.job.id,{status});assert.equal((await f.request(url)).response.status,404);}
});

test('TTL ends bearer access exactly at expiry and configuration cannot exceed one hour',async t=>{
  const f=fixture(t),{url}=await f.issue();f.setTime('2026-10-14T00:59:59.999Z');assert.equal((await f.request(url)).response.status,200);
  f.setTime('2026-10-14T01:00:00.000Z');assert.equal((await f.request(url)).response.status,404);
  for(const ttlMs of [0,59999,3600001,Infinity])assert.throws(()=>createSocialPublishMedia({store:f.store,resolveMedia:()=>{},authorizePublish:()=>{},origin,ttlMs}),/TTL/);
});

test('requires an explicitly configured public HTTPS origin with a separate localhost test opt-in',async t=>{
  for(const rejected of [undefined,'http://workspace.synk.im','https://127.0.0.1','https://192.168.1.5','https://[::1]','https://host.internal','https://localhost','https://user:password@workspace.synk.im','https://workspace.synk.im/path','https://workspace.synk.im?x=1']){
    const f=fixture(t,{origin:rejected});assert.equal(f.service.ready,false);assert.match(f.service.unavailableReason,/HTTPS/);await assert.rejects(f.issue(),{code:'SOCIAL_MEDIA_ORIGIN_UNAVAILABLE'});assert.equal(f.reads(),0);
  }
  const local=fixture(t,{origin:'http://127.0.0.1:4191',allowLocalOrigin:true});assert.equal(local.service.ready,true);assert.match((await local.issue()).url,/^http:\/\/127\.0\.0\.1:4191\//);
  assert.equal(fixture(t,{origin:'http://workspace.synk.im',allowLocalOrigin:true}).service.ready,false);
});

test('changed approval, channel connection, publisher, snapshot or execution attempt revokes a grant',async t=>{
  const cases=[
    ['channels','ig',{connectionVersion:5}],['channels','ig',{externalId:'other-account'}],['channels','ig',{platform:'facebook'}],['channels','ig',{active:false}],['channels','ig',{hidden:true}],
    ['socialPosts','post-private',{approval:null}],['socialPosts','post-private',{contentVersion:3}],['socialPosts','post-private',{expiresAt:'2026-10-13T00:00:00.000Z'}],
    ['socialPublishJobs','job-private',{approvalHash:'b'.repeat(64)}],['socialPublishJobs','job-private',{publisherId:'other-publisher'}],['socialPublishJobs','job-private',{attempts:2}],['socialPublishJobs','job-private',{scheduleRevision:2}],['socialPublishJobs','job-private',{idempotencyKey:'changed'}]
  ];
  for(const [kind,id,change] of cases){const f=fixture(t),{url}=await f.issue();f.update(kind,id,change);assert.equal((await f.request(url)).response.status,404,JSON.stringify(change));}
  const f=fixture(t),{url}=await f.issue();f.update('socialPosts',f.post.id,{approval:{...f.post.approval,byId:'other-approver'}});assert.equal((await f.request(url)).response.status,404);
  const g=fixture(t),issued=await g.issue();g.update('socialPublishJobs',g.job.id,{snapshot:{...g.job.snapshot,variant:{...g.job.snapshot.variant,text:'changed'}}});assert.equal((await g.request(issued.url)).response.status,404);
});

test('deleting a post, job, channel or grant ends access',async t=>{
  for(const kind of ['socialPosts','socialPublishJobs','channels','socialPublishMediaGrants']){
    const f=fixture(t),{url}=await f.issue(),row=f.store.all(kind)[0];f.store.remove(kind,row.id);assert.equal((await f.request(url)).response.status,404,kind);
  }
});

test('issue accepts only the saved job snapshot and its approved local media',async t=>{
  const f=fixture(t),base=f.input();
  for(const context of [{...base,channel:{...base.channel,id:'different'}},{...base,channel:{...base.channel,connectionVersion:99}},{...base,channel:{...base.channel,externalId:'different'}},{...base,post:{...base.post,body:'different'}},{...base,variant:{...base.variant,text:'different'}},{...base,job:{...base.job,idempotencyKey:'different'}},{...base,job:{...base.job,attempts:0}}])await assert.rejects(f.issue(f.ref,context));
  await assert.rejects(f.issue({...f.ref,assetId:'unapproved',id:'unapproved'}));
  await assert.rejects(f.issue({...f.ref,sha256:'b'.repeat(64)}));
  await assert.rejects(f.issue({...f.ref,mimeType:'text/html'}),{code:'SOCIAL_MEDIA_NOT_VERIFIED'});
  await assert.rejects(f.issue({...f.ref,sha256:''}),{code:'SOCIAL_MEDIA_NOT_VERIFIED'});
  await assert.rejects(f.issue({...f.ref,byteSize:STUDIO_MEDIA_LIMIT+1}),{code:'SOCIAL_MEDIA_TOO_LARGE'});
  assert.equal(f.store.all('socialPublishMediaGrants').length,0);assert.equal(f.reads(),0);
});

test('checks bytes, declared MIME, actual signature and size rather than trusting the stored hash alone',async t=>{
  const changed=fixture(t),grant=await changed.issue();changed.setBytes(Buffer.from('changed-media'));assert.equal((await changed.request(grant.url)).response.status,404);
  const mime=fixture(t),mimeGrant=await mime.issue();mime.setMime('text/html');assert.equal((await mime.request(mimeGrant.url)).response.status,404);
  const signature=fixture(t),bytes=Buffer.from('<html>same-hash-is-not-a-png</html>'),bad={...signature.ref,sha256:digest(bytes),byteSize:bytes.length};
  signature.setBytes(bytes);const job=signature.store.get('socialPublishJobs',signature.job.id);job.snapshot.variant.media=[bad];job.snapshot.post.variants[0].media=[bad];signature.store.put('socialPublishJobs',job.id,job);
  await assert.rejects(signature.issue(bad),{status:404});assert.equal(signature.store.all('socialPublishMediaGrants').length,0);
});

test('current permission callback runs before and after media reads and private errors stay private',async t=>{
  const f=fixture(t),{url}=await f.issue(),before=f.reads();f.setAllowed(false);const denied=await f.request(url);assert.equal(denied.response.status,404);assert.equal(f.reads(),before);
  f.setAllowed(true);f.onRead(()=>f.setAllowed(false));assert.equal((await f.request(url)).response.status,404);
  f.onRead(null);f.setAllowed(true);f.onAuthorize(()=>{throw Error('SECRET internal token '+url);});const failed=await f.request(url);assert.equal(failed.response.status,404);assert.ok(!failed.response.body.toString().includes('SECRET'));assert.ok(!failed.response.body.toString().includes(url));
});

test('revocation during asynchronous media resolution cannot return bytes or issue a grant',async t=>{
  const f=fixture(t),{url}=await f.issue();f.onRead(()=>f.update('channels',f.channel.id,{connectionVersion:99}));const {response}=await f.request(url);assert.equal(response.status,404);assert.notDeepEqual(response.body,png());
  const g=fixture(t);g.onRead(()=>g.update('socialPublishJobs',g.job.id,{status:'cancelled'}));await assert.rejects(g.issue());assert.equal(g.store.all('socialPublishMediaGrants').length,0);
  const h=fixture(t),link=await h.issue();h.onRead(()=>h.store.remove('socialPublishMediaGrants',h.store.all('socialPublishMediaGrants')[0].id));assert.equal((await h.request(link.url)).response.status,404);
});

test('stop and caller abort prevent reads and outstanding responses',async t=>{
  const f=fixture(t),{url}=await f.issue(),controller=new AbortController();controller.abort();assert.equal((await f.request(url,'GET',{}, {signal:controller.signal})).response.status,503);
  await assert.rejects(f.issue(f.ref,{...f.input(),signal:controller.signal}),{status:503});
  let release;f.onRead(()=>new Promise(resolve=>{release=resolve;}));const pending=f.request(url);while(!release)await new Promise(resolve=>setImmediate(resolve));const stopped=f.service.stop();release();await stopped;assert.equal((await pending).response.status,503);assert.equal((await f.request(url)).response.status,503);await assert.rejects(f.issue(),{code:'SOCIAL_MEDIA_STOPPED'});
});

test('concurrent reads are bounded and freed after completion',async t=>{
  const f=fixture(t,{handleConcurrency:2}),{url}=await f.issue(),releases=[];f.onRead(()=>new Promise(resolve=>releases.push(resolve)));
  const a=f.request(url),b=f.request(url);while(releases.length<2)await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await f.request(url)).response.status,429);for(const release of releases)release();assert.equal((await a).response.status,200);assert.equal((await b).response.status,200);
  f.onRead(null);assert.equal((await f.request(url)).response.status,200);
});

test('expired and completed grants are pruned when another file is issued',async t=>{
  const f=fixture(t);await f.issue();assert.equal(f.store.all('socialPublishMediaGrants').length,1);f.setTime('2026-10-14T01:00:00.000Z');await f.issue();assert.equal(f.store.all('socialPublishMediaGrants').length,1);
});

test('issuing a grant has its own slots and is not blocked by Meta downloads in flight',async t=>{
  const f=fixture(t),{url}=await f.issue(),releases=[];f.onRead(()=>new Promise(resolve=>releases.push(resolve)));
  const a=f.request(url),b=f.request(url);try{
    while(releases.length<2)await new Promise(resolve=>setImmediate(resolve));
    f.onRead(null);const second=await f.issue();assert.match(second.url,/\/social-publish-media\/[A-Za-z0-9_-]{43}$/);assert.notEqual(second.url,url);
  }finally{for(const release of releases)release();}
  assert.equal((await a).response.status,200);assert.equal((await b).response.status,200);
});

test('download slots are bounded by their own limit while issuing keeps working',async t=>{
  const f=fixture(t,{handleConcurrency:2,issueConcurrency:1}),{url}=await f.issue(),releases=[];f.onRead(()=>new Promise(resolve=>releases.push(resolve)));
  const a=f.request(url),b=f.request(url);try{
    while(releases.length<2)await new Promise(resolve=>setImmediate(resolve));
    assert.equal((await f.request(url,'HEAD')).response.status,429);f.onRead(null);assert.ok((await f.issue()).url);
  }finally{for(const release of releases)release();}
  assert.equal((await a).response.status,200);assert.equal((await b).response.status,200);assert.equal((await f.request(url,'HEAD')).response.status,200);
  for(const limits of [{handleConcurrency:0},{issueConcurrency:1.5},{cacheBytes:-1}])assert.throws(()=>createSocialPublishMedia({store:f.store,resolveMedia:()=>{},authorizePublish:()=>{},origin,...limits}),/limits/);
});

test('a verified download is kept for later HEAD, Range and GET requests without re-reading or re-hashing the file',async t=>{
  const f=fixture(t),{url}=await f.issue(),before=f.reads();
  assert.equal((await f.request(url)).response.status,200);assert.equal(f.reads(),before+1);assert.deepEqual(f.service.stats(),{cachedGrants:1,cachedBytes:png().length});
  const head=await f.request(url,'HEAD');assert.equal(head.response.status,200);assert.equal(head.response.headers['Content-Length'],png().length);
  const range=await f.request(url,'GET',{range:'bytes=3-5'});assert.equal(range.response.status,206);assert.deepEqual(range.response.body,png().subarray(3,6));assert.equal(range.response.headers['Content-Range'],`bytes 3-5/${png().length}`);
  assert.deepEqual((await f.request(url)).response.body,png());assert.equal(f.reads(),before+1);
  f.setBytes(Buffer.from('changed-after-the-verified-download'));assert.deepEqual((await f.request(url)).response.body,png());assert.equal(f.reads(),before+1);
  assert.deepEqual(f.phases.slice(-4),['media-fetch','media-fetch','media-fetch','media-fetch']);
});

test('kept bytes are dropped when the grant is removed, expires or the service stops, and the cache is bounded',async t=>{
  const f=fixture(t),{url}=await f.issue();await f.request(url);assert.equal(f.service.stats().cachedGrants,1);
  f.store.remove('socialPublishMediaGrants',f.store.all('socialPublishMediaGrants')[0].id);assert.equal((await f.request(url)).response.status,404);assert.deepEqual(f.service.stats(),{cachedGrants:0,cachedBytes:0});
  const g=fixture(t),expiring=await g.issue();await g.request(expiring.url);g.setTime('2026-10-14T01:00:00.000Z');assert.equal((await g.request(expiring.url)).response.status,404);assert.equal(g.service.stats().cachedGrants,0);
  const h=fixture(t),stopping=await h.issue();await h.request(stopping.url);await h.service.stop();assert.deepEqual(h.service.stats(),{cachedGrants:0,cachedBytes:0});
  const k=fixture(t,{cacheBytes:png().length}),first=await k.issue(),second=await k.issue();await k.request(first.url);await k.request(second.url);assert.deepEqual(k.service.stats(),{cachedGrants:1,cachedBytes:png().length});
  const reads=k.reads();assert.equal((await k.request(first.url)).response.status,200);assert.equal(k.reads(),reads+1);assert.equal((await k.request(first.url)).response.status,200);assert.equal(k.reads(),reads+1);
  const m=fixture(t,{cacheBytes:0}),never=await m.issue();await m.request(never.url);assert.deepEqual(m.service.stats(),{cachedGrants:0,cachedBytes:0});
});
