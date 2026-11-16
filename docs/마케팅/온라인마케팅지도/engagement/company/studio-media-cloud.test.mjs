// 작업실 영상 클라우드(studio-media-cloud.mjs) — 가짜 GCS 서버를 localhost에 띄워 올리기 · 받아 놓기 · 비우기 · 하루 대조 · 스위치를 본다.
//   node --test studio-media-cloud.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,stat,utimes,chmod,symlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {createMediaCloud,gcsClient,MEDIA_CLOUD_KIND,SWITCH_FILE,ensureLocalMedia,registerMediaCloud,mediaPresent,mediaLedgerSha,bucketForProject,validObject} from './studio-media-cloud.mjs';

const BUCKET='synk-company-media-931078180935',KiB=1024;
const md5b64=b=>createHash('md5').update(b).digest('base64'),sha=b=>createHash('sha256').update(b).digest('hex');

// 가짜 GCS: 필요한 JSON API만. objects는 name → {bytes, generation, created}.
async function fakeGcs(){
  const objects=new Map(),calls={upload:0,download:0,list:0,stat:0};let generation=1000,hook=null,downloadHook=null;
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://x'),body=await new Promise(done=>{const parts=[];req.on('data',c=>parts.push(c));req.on('end',()=>done(Buffer.concat(parts)));});
    const send=(status,json,headers={})=>{res.writeHead(status,{'content-type':'application/json',...headers});res.end(json==null?'':JSON.stringify(json));};
    const meta=(name,o)=>({name,generation:String(o.generation),size:String(o.bytes.length),md5Hash:md5b64(o.bytes),timeCreated:o.created});
    if(req.headers.authorization!=='Bearer test-token')return send(401,{});
    let m;
    if(req.method==='POST'&&(m=/^\/upload\/storage\/v1\/b\/([^/]+)\/o$/.exec(url.pathname))){
      const want=JSON.parse(body.toString());if(url.searchParams.get('ifGenerationMatch')==='0'&&objects.has(want.name))return send(412,{});
      const id=randomUUID();sessions.set(id,{name:want.name,md5:want.md5Hash,size:Number(req.headers['x-upload-content-length'])});
      return send(200,{},{location:base+'/upload/storage/v1/b/'+m[1]+'/o?uploadType=resumable&upload_id='+id});
    }
    if(req.method==='PUT'&&url.pathname.startsWith('/upload/')){
      calls.upload++;const s=sessions.get(url.searchParams.get('upload_id'));if(!s)return send(404,{});
      if(hook)await hook('upload',s);
      if(body.length!==s.size||md5b64(body)!==s.md5)return send(400,{});if(objects.has(s.name))return send(412,{});
      const o={bytes:body,generation:++generation,created:new Date().toISOString()};objects.set(s.name,o);return send(200,meta(s.name,o));
    }
    if(req.method==='GET'&&(m=/^\/storage\/v1\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname))){
      const name=decodeURIComponent(m[2]),o=objects.get(name),gen=url.searchParams.get('generation');
      if(!o||(gen&&gen!==String(o.generation)))return send(404,{});
      if(url.searchParams.get('alt')==='media'){calls.download++;res.writeHead(200,{'content-type':'application/octet-stream'});
        // 받기 도중 고리: 앞 절반을 보낸 뒤 멈추고, 고리가 끝나면(또는 끊으면) 나머지를 보낸다.
        if(downloadHook){const half=Math.floor(o.bytes.length/2);res.write(o.bytes.subarray(0,half));const go=await downloadHook(name);if(go==='hang')return;return res.end(o.bytes.subarray(half));}
        return res.end(o.bytes);}
      calls.stat++;return send(200,meta(name,o));
    }
    if(req.method==='GET'&&(m=/^\/storage\/v1\/b\/([^/]+)\/o$/.exec(url.pathname))){
      calls.list++;const prefix=url.searchParams.get('prefix')||'',all=[...objects.keys()].filter(n=>n.startsWith(prefix)).sort(),from=Number(url.searchParams.get('pageToken')||0),page=all.slice(from,from+2);
      return send(200,{items:page.map(n=>meta(n,objects.get(n))),...(from+2<all.length?{nextPageToken:String(from+2)}:{})});
    }
    send(404,{});
  });
  const sessions=new Map();await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
  return {base,objects,calls,setHook:fn=>{hook=fn;},setDownloadHook:fn=>{downloadHook=fn;},close:()=>new Promise(done=>{server.closeAllConnections?.();server.close(done);})};
}

async function setup(t,{mode='upload',names=null,options={},clock=null}={}){
  const gcs=await fakeGcs(),dir=await mkdtemp(join(tmpdir(),'media-cloud-'));t.after(async()=>{cloud.stop();store.db.close();await gcs.close();await rm(dir,{recursive:true,force:true});});
  await mkdir(join(dir,'studio-media'),{recursive:true});const store=new Store(dir);
  const list=new Set(names||[]),now={t:Date.parse('2026-11-20T00:00:00Z')};
  const credentials={token:async()=>'test-token',bucket:async()=>BUCKET};
  const cloud=createMediaCloud({store,directory:dir,credentials,gcs:gcsClient({credentials,base:gcs.base}),clock:clock||(()=>now.t),namesOf:()=>[...list],
    options:{floorBytes:0,warnBytes:0,minCacheBytes:0,minEvictBytes:1,...options}});
  if(mode)await setMode(dir,mode);
  registerMediaCloud(dir,cloud);
  return {gcs,dir,store,cloud,list,now,
    async file(ext='mp4',bytes=Buffer.from(randomUUID().repeat(40))){const name=randomUUID()+'.'+ext;await writeFile(join(dir,'studio-media',name),bytes,{mode:0o600});list.add(name);return {name,bytes};}};
}
async function setMode(dir,mode,extra={}){const path=join(dir,SWITCH_FILE);await rm(path,{force:true});await writeFile(path,JSON.stringify({mode,...extra}),{mode:0o600});await chmod(path,0o600);}
const localPath=(ctx,name)=>join(ctx.dir,'studio-media',name);

test('bucket names come from the project number, object names keep the studio-media rule',()=>{
  assert.equal(bucketForProject('931078180935'),BUCKET);assert.throws(()=>bucketForProject('../x'),/프로젝트 번호/);
  assert.ok(validObject('studio-media/'+randomUUID()+'.mp4'));assert.ok(validObject('studio-media/'+randomUUID()+'.mp4~2'));
  assert.ok(!validObject('studio-media/../x.mp4'));assert.ok(!validObject('other/'+randomUUID()+'.mp4'));
});

test('upload: a referenced file goes up once and the ledger says verified with the bucket md5, generation and sha256',async t=>{
  const ctx=await setup(t),{name,bytes}=await ctx.file();
  assert.deepEqual((await ctx.cloud.tick()).uploaded,[name]);
  const row=ctx.store.get(MEDIA_CLOUD_KIND,name);
  assert.equal(row.state,'verified');assert.equal(row.object,'studio-media/'+name);assert.equal(row.sha256,sha(bytes));assert.equal(row.md5,md5b64(bytes));assert.equal(row.bytes,bytes.length);assert.match(row.generation,/^[0-9]+$/);
  assert.deepEqual(ctx.gcs.objects.get('studio-media/'+name).bytes,bytes);
  // a second tick finds nothing new to upload
  assert.deepEqual(await ctx.cloud.tick(),{idle:true});assert.equal(ctx.gcs.calls.upload,1);
});

test('upload: a file nobody references and a name outside the rule are never uploaded',async t=>{
  const ctx=await setup(t),{name}=await ctx.file();ctx.list.delete(name);ctx.list.add('../escape.mp4');
  assert.deepEqual(await ctx.cloud.tick(),{idle:true});assert.equal(ctx.gcs.objects.size,0);
});

test('upload: an existing object with the same bytes is verified, with other bytes it is a conflict that is never evicted',async t=>{
  const ctx=await setup(t),a=await ctx.file(),b=await ctx.file();
  ctx.gcs.objects.set('studio-media/'+a.name,{bytes:a.bytes,generation:7,created:'2026-11-19T12:00:00Z'});
  ctx.gcs.objects.set('studio-media/'+b.name,{bytes:Buffer.from('other'),generation:8,created:'2026-11-19T12:00:00Z'});
  await ctx.cloud.tick();
  assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,a.name).state,'verified');assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,a.name).generation,'7');
  assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,b.name).state,'conflict');
});

test('upload: a file that changes while it is sent is not written to the ledger',async t=>{
  const ctx=await setup(t),{name}=await ctx.file();
  ctx.gcs.setHook(async()=>{await writeFile(localPath(ctx,name),Buffer.from('changed while uploading'));});
  const result=await ctx.cloud.tick();assert.equal(result.failed,name);assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,name),null);
});

test('switch: missing, broken, unknown mode and a link all mean off — nothing is uploaded',async t=>{
  const ctx=await setup(t,{mode:null}),{name}=await ctx.file();
  assert.deepEqual(await ctx.cloud.tick(),{skipped:'off'});
  await writeFile(join(ctx.dir,SWITCH_FILE),'{bad',{mode:0o600});ctx.now.t+=60000;assert.deepEqual(await ctx.cloud.tick(),{skipped:'off'});
  await setMode(ctx.dir,'everything');ctx.now.t+=60000;assert.deepEqual(await ctx.cloud.tick(),{skipped:'off'});
  if(process.platform!=='win32'){await rm(join(ctx.dir,SWITCH_FILE));const real=join(ctx.dir,'real.json');await writeFile(real,JSON.stringify({mode:'upload'}),{mode:0o600});await symlink(real,join(ctx.dir,SWITCH_FILE));ctx.now.t+=60000;assert.deepEqual(await ctx.cloud.tick(),{skipped:'off'});}
  assert.equal(ctx.gcs.objects.size,0);assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,name),null);
});

test('ensureLocal: a verified file that is not on disk is fetched, checked and placed under its own name; the ledger stamp follows the new file',async t=>{
  const ctx=await setup(t),{name,bytes}=await ctx.file();await ctx.cloud.tick();const before=ctx.store.get(MEDIA_CLOUD_KIND,name).localStamp;
  await rm(localPath(ctx,name));
  await ensureLocalMedia(ctx.dir,name);
  assert.deepEqual(await readFile(localPath(ctx,name)),bytes);
  const after=ctx.store.get(MEDIA_CLOUD_KIND,name).localStamp;assert.equal(after.size,bytes.length);assert.notDeepEqual(after,before);
  assert.deepEqual((await readdir(join(ctx.dir,'studio-media'))).filter(n=>n.startsWith('.fetch-')),[]);
  // already local: no second download
  await ensureLocalMedia(ctx.dir,name);assert.equal(ctx.gcs.calls.download,1);
});

test('ensureLocal: two readers at once share one download',async t=>{
  const ctx=await setup(t),{name}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));
  await Promise.all([ensureLocalMedia(ctx.dir,name),ensureLocalMedia(ctx.dir,name),ensureLocalMedia(ctx.dir,name)]);
  assert.equal(ctx.gcs.calls.download,1);
});

test('ensureLocal: wrong bytes from the bucket are not placed and leave no temporary file',async t=>{
  const ctx=await setup(t),{name}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));
  const object=ctx.gcs.objects.get('studio-media/'+name);object.bytes=Buffer.from('x'.repeat(object.bytes.length));
  await assert.rejects(ensureLocalMedia(ctx.dir,name),error=>error.code==='MEDIA_FETCH_MISMATCH');
  assert.ok(!existsSync(localPath(ctx,name)));assert.deepEqual((await readdir(join(ctx.dir,'studio-media'))).filter(n=>n.startsWith('.fetch-')),[]);
});

test('ensureLocal: not in the ledger, a conflict, or gone from the bucket returns without placing anything so the caller answers as before; gone marks the row lost',async t=>{
  const ctx=await setup(t),missing=randomUUID()+'.mp4';
  await ensureLocalMedia(ctx.dir,missing);assert.ok(!existsSync(localPath(ctx,missing)));assert.equal(ctx.gcs.calls.download||0,0);
  const {name}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));ctx.gcs.objects.delete('studio-media/'+name);
  await ensureLocalMedia(ctx.dir,name);assert.ok(!existsSync(localPath(ctx,name)));assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,name).state,'lost');
  const downloads=ctx.gcs.calls.download;await ensureLocalMedia(ctx.dir,name);assert.equal(ctx.gcs.calls.download,downloads,'a lost row is not fetched again');
  // something already at the path (here a folder) is left to the caller's own checks
  const other=randomUUID()+'.png';ctx.list.add(other);await mkdir(localPath(ctx,other));await ensureLocalMedia(ctx.dir,other);assert.equal(ctx.gcs.calls.download,downloads);
  // names outside the media rule are left to the caller (no throw, nothing fetched)
  await ensureLocalMedia(ctx.dir,randomUUID()+'.upload');
});

test('ensureLocal: below the free-space floor it answers 503 and places nothing',async t=>{
  const ctx=await setup(t,{options:{floorBytes:Number.MAX_SAFE_INTEGER}}),{name}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));
  await assert.rejects(ensureLocalMedia(ctx.dir,name),error=>error.status===503);assert.ok(!existsSync(localPath(ctx,name)));
});

test('present and ledgerSha: a verified file counts as present with its size even when evicted',async t=>{
  const ctx=await setup(t),{name,bytes}=await ctx.file();
  assert.equal(mediaPresent(ctx.dir,name,bytes.length),true);assert.equal(mediaLedgerSha(ctx.dir,name),null);
  await ctx.cloud.tick();await rm(localPath(ctx,name));
  assert.equal(mediaPresent(ctx.dir,name,bytes.length),true);assert.equal(mediaPresent(ctx.dir,name,bytes.length+1),false);assert.equal(mediaLedgerSha(ctx.dir,name),sha(bytes));
  assert.equal(mediaPresent(ctx.dir,randomUUID()+'.mp4',1),false);
});

test('evict: only when the switch says evict and the cache is over its limit; only old verified big media, never subtitles, drafts or recent ones',async t=>{
  const ctx=await setup(t,{mode:'upload'});
  const old=await ctx.file('mp4'),recent=await ctx.file('mp4'),sub=await ctx.file('srt'),draft=await ctx.file('webm'),unverified=randomUUID()+'.mp4';
  await writeFile(localPath(ctx,unverified),Buffer.from('not uploaded'));
  await ctx.cloud.tick();
  ctx.store.put('clientDeliveryDrafts','d1',{id:'d1',items:[{media:{diskName:draft.name}}]});
  assert.deepEqual(await ctx.cloud.evict(),{removed:0});
  await setMode(ctx.dir,'evict',{cacheBytes:1});ctx.now.t+=20*86400000;
  await ensureLocalMedia(ctx.dir,recent.name);
  // file times are the real wall clock; push the fake clock far enough that every file is idle except the one just used
  const result=await ctx.cloud.evict();
  assert.equal(result.removed,1);
  assert.ok(!existsSync(localPath(ctx,old.name)));
  for(const kept of [recent.name,sub.name,draft.name,unverified])assert.ok(existsSync(localPath(ctx,kept)),kept);
  // the evicted one comes back on the next read
  await ensureLocalMedia(ctx.dir,old.name);assert.deepEqual(await readFile(localPath(ctx,old.name)),old.bytes);
});

test('evict: a file whose disk stamp differs from the ledger, or whose object changed, is kept',async t=>{
  const ctx=await setup(t),a=await ctx.file(),b=await ctx.file();await ctx.cloud.tick();
  await setMode(ctx.dir,'evict',{cacheBytes:1});ctx.now.t+=20*86400000;
  const when=new Date(Date.now()-86400000);await utimes(localPath(ctx,a.name),when,when);
  ctx.gcs.objects.get('studio-media/'+b.name).generation=99999;
  assert.equal((await ctx.cloud.evict()).removed,0);assert.ok(existsSync(localPath(ctx,a.name)));assert.ok(existsSync(localPath(ctx,b.name)));
});

test('reconcile: an object that vanished is uploaded again under a new name when the local bytes match, otherwise the row is lost',async t=>{
  const ctx=await setup(t),a=await ctx.file(),b=await ctx.file();await ctx.cloud.tick();
  ctx.gcs.objects.delete('studio-media/'+a.name);ctx.gcs.objects.delete('studio-media/'+b.name);await rm(localPath(ctx,b.name));
  const result=await ctx.cloud.reconcile();
  assert.equal(result.reuploaded,1);assert.equal(result.lost,1);
  const row=ctx.store.get(MEDIA_CLOUD_KIND,a.name);assert.equal(row.state,'verified');assert.equal(row.object,'studio-media/'+a.name+'~1');assert.ok(ctx.gcs.objects.has(row.object));
  assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,b.name).state,'lost');
});

test('reconcile: a changed disk stamp with the same bytes is fixed, with other bytes the row becomes a conflict',async t=>{
  const ctx=await setup(t),a=await ctx.file(),b=await ctx.file();await ctx.cloud.tick();
  const when=new Date(Date.now()-3600000);await utimes(localPath(ctx,a.name),when,when);
  await writeFile(localPath(ctx,b.name),Buffer.from('replaced bytes'));
  const result=await ctx.cloud.reconcile();
  assert.equal(result.stampDrift,2);assert.equal(result.stampFixed,1);
  assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,a.name).localStamp.mtimeMs,Math.trunc((await stat(localPath(ctx,a.name))).mtimeMs));
  assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,b.name).state,'conflict');
});

test('reconcile: with an empty ledger nothing is listed; off still reads',async t=>{
  const ctx=await setup(t,{mode:null});const result=await ctx.cloud.reconcile();assert.equal(ctx.gcs.calls.list,0);assert.equal(result.verified,0);
  await setMode(ctx.dir,'upload');ctx.now.t+=60000;const {name}=await ctx.file();await ctx.cloud.tick();
  await setMode(ctx.dir,'off');ctx.now.t+=60000;const again=await ctx.cloud.reconcile();assert.equal(again.verified,1);assert.ok(ctx.gcs.calls.list>=1);
});

test('hydrate mode brings every evicted verified file back, one tick at a time',async t=>{
  const ctx=await setup(t),a=await ctx.file(),b=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,a.name));await rm(localPath(ctx,b.name));
  await setMode(ctx.dir,'hydrate');ctx.now.t+=60000;
  await ctx.cloud.tick();await ctx.cloud.tick();
  assert.ok(existsSync(localPath(ctx,a.name))&&existsSync(localPath(ctx,b.name)));
});

test('leftover fetch files older than an hour are removed at start; others stay',async t=>{
  const ctx=await setup(t,{clock:Date.now}),old=join(ctx.dir,'studio-media','.fetch-'+randomUUID()),fresh=join(ctx.dir,'studio-media','.fetch-'+randomUUID()),other=join(ctx.dir,'studio-media','.fetch-not-a-uuid');
  for(const p of [old,fresh,other])await writeFile(p,'x');const when=new Date(Date.now()-2*3600000);await utimes(old,when,when);
  assert.equal(await ctx.cloud.cleanLeftovers(),1);assert.ok(!existsSync(old));assert.ok(existsSync(fresh));assert.ok(existsSync(other));
});

test('a file the customer deleted while it was being fetched is not left on disk (3판 검토 1 · GPT 검수 GB1)',async t=>{
  const ctx=await setup(t),{name}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));
  // the DB still points at the name when the fetch starts, and stops pointing at it while the bytes are on their way
  let started=false;ctx.gcs.setDownloadHook(async()=>{started=true;ctx.list.delete(name);});
  await ensureLocalMedia(ctx.dir,name);
  assert.ok(started,'the deletion happened mid-download');
  assert.ok(!existsSync(localPath(ctx,name)));assert.deepEqual((await readdir(join(ctx.dir,'studio-media'))).filter(n=>n.startsWith('.fetch-')),[]);
});

test('two reads of the same evicted name share one download even when the switch is read first (GPT 검수 GA2)',async t=>{
  const ctx=await setup(t,{mode:'evict'}),{name,bytes}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));
  await Promise.all([ensureLocalMedia(ctx.dir,name),ensureLocalMedia(ctx.dir,name),ensureLocalMedia(ctx.dir,name)]);
  assert.equal(ctx.gcs.calls.download,1);assert.deepEqual(await readFile(localPath(ctx,name)),bytes);
});

test('a stuck download times out, leaves no temporary file, and the next read tries again (GPT 검수 GA5)',async t=>{
  const ctx=await setup(t),{name,bytes}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));
  const fast=createMediaCloud({store:ctx.store,directory:ctx.dir,credentials:{token:async()=>'test-token',bucket:async()=>BUCKET},gcs:gcsClient({credentials:{token:async()=>'test-token'},base:ctx.gcs.base,timeoutMs:300,transferFloorMs:300}),namesOf:()=>[...ctx.list],options:{floorBytes:0}});
  ctx.gcs.setDownloadHook(async()=>'hang');
  await assert.rejects(fast.ensureLocal(name));
  assert.ok(!existsSync(localPath(ctx,name)));assert.deepEqual((await readdir(join(ctx.dir,'studio-media'))).filter(n=>n.startsWith('.fetch-')),[]);
  ctx.gcs.setDownloadHook(null);await fast.ensureLocal(name);assert.deepEqual(await readFile(localPath(ctx,name)),bytes);fast.stop();
});

test('stop cuts a download in progress (GPT 검수 GA5)',async t=>{
  const ctx=await setup(t),{name}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));
  ctx.cloud.start();let reached;const inside=new Promise(done=>{reached=done;});ctx.gcs.setDownloadHook(async()=>{reached();return 'hang';});
  const reading=ctx.cloud.ensureLocal(name);await inside;ctx.cloud.stop();
  await assert.rejects(reading);assert.deepEqual((await readdir(join(ctx.dir,'studio-media'))).filter(n=>n.startsWith('.fetch-')),[]);
});

test('a leftover temporary file is cleaned by the schedule, never one still being written (GPT 검수 GA3)',async t=>{
  const ctx=await setup(t),{name}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));
  const old=join(ctx.dir,'studio-media','.fetch-'+randomUUID());await writeFile(old,'partial');
  const past=new Date(ctx.now.t-2*3600000);await utimes(old,past,past);
  // a download in progress keeps its own temporary file even when it is old
  let reached,release;const inside=new Promise(done=>{reached=done;});const gate=new Promise(done=>{release=done;});
  ctx.gcs.setDownloadHook(async()=>{reached();await gate;});
  const reading=ctx.cloud.ensureLocal(name);await inside;
  const live=(await readdir(join(ctx.dir,'studio-media'))).filter(n=>n.startsWith('.fetch-')&&join(ctx.dir,'studio-media',n)!==old);
  for(const n of live)await utimes(join(ctx.dir,'studio-media',n),past,past);
  assert.equal(await ctx.cloud.cleanLeftovers(),1);assert.ok(!existsSync(old));
  for(const n of live)assert.ok(existsSync(join(ctx.dir,'studio-media',n)),'the temporary file of a running download stays');
  release();await reading;
});

test('a name still referenced but lost is counted on every reconcile and comes back when its bytes return (GPT 검수 GA4)',async t=>{
  const ctx=await setup(t),{name,bytes}=await ctx.file();await ctx.cloud.tick();await rm(localPath(ctx,name));ctx.gcs.objects.delete('studio-media/'+name);
  await ensureLocalMedia(ctx.dir,name);assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,name).state,'lost');
  assert.equal((await ctx.cloud.reconcile()).lost,1);assert.equal((await ctx.cloud.reconcile()).lost,1);
  await writeFile(localPath(ctx,name),bytes,{mode:0o600});
  const result=await ctx.cloud.reconcile();assert.deepEqual([result.lost,result.reuploaded],[0,1]);
  assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,name).state,'verified');
});

test('reconcile: an unreferenced row gets its time; after three days a local copy is removed, after forty days a remaining object is reported and alerted once a day',async t=>{
  const alerts=[];const ctx=await setup(t);ctx.cloud.stop();
  const {store,dir}=ctx,credentials={token:async()=>'test-token',bucket:async()=>BUCKET};
  const cloud=createMediaCloud({store,directory:dir,credentials,gcs:gcsClient({credentials,base:ctx.gcs.base}),clock:()=>ctx.now.t,namesOf:()=>[...ctx.list],alert:async entry=>{alerts.push(entry.code);},
    options:{floorBytes:0,warnBytes:0,minCacheBytes:0,minEvictBytes:1}});
  const {name}=await ctx.file();await cloud.tick();ctx.list.delete(name);
  await cloud.reconcile();assert.ok(store.get(MEDIA_CLOUD_KIND,name).unreferencedAt);assert.ok(existsSync(localPath(ctx,name)));
  ctx.now.t+=4*86400000;assert.equal((await cloud.reconcile()).localRemoved,1);assert.ok(!existsSync(localPath(ctx,name)));
  ctx.now.t+=40*86400000;const late=await cloud.reconcile();assert.equal(late.staleObjects,1);assert.deepEqual(alerts,['MEDIA_STALE_OBJECTS']);
  ctx.now.t+=3600000;await cloud.reconcile();assert.deepEqual(alerts,['MEDIA_STALE_OBJECTS'],'once a day');
  // referenced again: the time is cleared
  ctx.list.add(name);await cloud.reconcile();assert.equal(store.get(MEDIA_CLOUD_KIND,name).unreferencedAt,null);
});

test('reconcile: re-upload of a vanished object also runs with the switch off; a vanished object with other local bytes is a conflict',async t=>{
  const ctx=await setup(t),a=await ctx.file(),b=await ctx.file();await ctx.cloud.tick();
  await setMode(ctx.dir,'off');ctx.now.t+=60000;
  ctx.gcs.objects.delete('studio-media/'+a.name);ctx.gcs.objects.delete('studio-media/'+b.name);await writeFile(localPath(ctx,b.name),Buffer.from('other bytes'));
  const result=await ctx.cloud.reconcile();assert.equal(result.reuploaded,1);assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,a.name).object,'studio-media/'+a.name+'~1');
  assert.equal(ctx.store.get(MEDIA_CLOUD_KIND,b.name).state,'conflict');
});

test('upload: an existing object older than two days is not taken over; the file goes up under a new name',async t=>{
  const ctx=await setup(t),{name,bytes}=await ctx.file();
  ctx.gcs.objects.set('studio-media/'+name,{bytes,generation:5,created:'2026-11-01T00:00:00Z'});
  await ctx.cloud.tick();const row=ctx.store.get(MEDIA_CLOUD_KIND,name);
  assert.equal(row.state,'verified');assert.equal(row.object,'studio-media/'+name+'~1');
});

test('reconcile: a cleanup run record older than seven days raises MEDIA_CLEANUP_STALE; no record yet means no alert',async t=>{
  const alerts=[];const ctx=await setup(t);ctx.cloud.stop();
  const {store,dir}=ctx,credentials={token:async()=>'test-token',bucket:async()=>BUCKET};
  const cloud=createMediaCloud({store,directory:dir,credentials,gcs:gcsClient({credentials,base:ctx.gcs.base}),clock:()=>ctx.now.t,namesOf:()=>[...ctx.list],alert:async entry=>{alerts.push(entry.code);},
    options:{floorBytes:0,warnBytes:0,minCacheBytes:0,minEvictBytes:1}});
  await ctx.file();await cloud.tick();
  assert.equal((await cloud.reconcile()).cleanupStale,false);assert.deepEqual(alerts,[]);
  ctx.gcs.objects.set('gc/runs/20261110T000000Z.json',{bytes:Buffer.from('{}'),generation:1,created:'2026-11-10T00:00:00Z'});
  const result=await cloud.reconcile();assert.equal(result.cleanupStale,true);assert.deepEqual(alerts,['MEDIA_CLEANUP_STALE']);
});

test('without a registered cloud the helpers do nothing (local development and older tests)',async()=>{
  const dir=join(tmpdir(),'no-cloud-'+randomUUID());await ensureLocalMedia(dir,randomUUID()+'.mp4');assert.equal(mediaPresent(dir,'x.mp4',1),null);assert.equal(mediaLedgerSha(dir,'x.mp4'),null);
});
