import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createStaticResponder } from './static-response.mjs';
import { createCompanyApp } from './server.mjs';

async function fixture(t, bytes=Buffer.from('0123456789')) {
  const directory=await mkdtemp(join(tmpdir(),'synk-static-media-'));
  const file=join(directory,'movie.mp4');await writeFile(file,bytes);
  let reads=0;
  const respond=createStaticResponder({read:async path=>{reads++;return readFile(path);}});
  const server=createServer((req,res)=>{
    respond(req,res,{path:file,type:req.url==='/audio'?'audio/mpeg':'video/mp4',headers:{'X-Content-Type-Options':'nosniff'}})
      .catch(error=>{if(res.headersSent)res.destroy(error);else{res.writeHead(500);res.end();}});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  return{file,respond,bytes,reads:()=>reads,get:(headers={},options={})=>fetch(base+'/',{...options,headers}),audio:headers=>fetch(base+'/audio',{headers}),
    rawGet:headers=>new Promise((resolve,reject)=>{const req=request(base+'/',{headers},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}));});req.on('error',reject);req.end();})};
}

test('public media streams exact byte ranges without loading or caching the whole file',async t=>{
  const f=await fixture(t),response=await f.get({Range:'bytes=2-5','Accept-Encoding':'br, gzip'});
  assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 2-5/10');
  assert.equal(response.headers.get('content-length'),'4');assert.equal(response.headers.get('accept-ranges'),'bytes');
  assert.equal(response.headers.get('content-encoding'),null);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(await response.text(),'2345');assert.equal(f.reads(),0);assert.equal(f.respond.stats().bytes,0);
});

test('media accepts prefix probes, open-ended, suffix and oversized end ranges',async t=>{
  const f=await fixture(t);
  for(const [range,expected,contentRange]of[
    ['bytes=0-1','01','bytes 0-1/10'],['bytes=7-','789','bytes 7-9/10'],
    ['bytes=-3','789','bytes 7-9/10'],['bytes=8-999999999999999999999999','89','bytes 8-9/10'],
    ['bytes=-999999999999999999999999','0123456789','bytes 0-9/10'],
  ]){
    const response=await f.get({Range:range});assert.equal(response.status,206,range);
    assert.equal(response.headers.get('content-range'),contentRange);assert.equal(await response.text(),expected);
  }
});

test('unsatisfiable media ranges return 416 with the actual length and no bytes',async t=>{
  const f=await fixture(t);
  for(const range of ['bytes=10-','bytes=99-100','bytes=-0','bytes=8-3','bytes=999999999999999999999999-']){
    const response=await f.get({Range:range});assert.equal(response.status,416,range);
    assert.equal(response.headers.get('content-range'),'bytes */10');assert.equal(response.headers.get('content-length'),'0');
    assert.equal((await response.arrayBuffer()).byteLength,0);
  }
});

test('unknown, malformed and multiple ranges fall back to a complete representation',async t=>{
  const f=await fixture(t);
  for(const range of ['items=0-1','bytes=','bytes=-','bytes=first-last','bytes=0-1,4-5']){
    const response=await f.get({Range:range});assert.equal(response.status,200,range);
    assert.equal(response.headers.get('content-range'),null);assert.equal(await response.text(),'0123456789');
  }
});

test('HEAD ignores Range and media without Range streams the original file',async t=>{
  const f=await fixture(t),head=await f.get({Range:'bytes=0-1'},{method:'HEAD'});
  assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'10');
  assert.equal(head.headers.get('content-range'),null);assert.equal(head.headers.get('accept-ranges'),'bytes');
  assert.equal((await head.arrayBuffer()).byteLength,0);
  const full=await f.get();assert.equal(full.status,200);assert.deepEqual(Buffer.from(await full.arrayBuffer()),f.bytes);
  assert.equal(f.reads(),0);assert.equal(f.respond.stats().entries,0);
});

test('empty media responds without opening a read stream and ranges are unsatisfiable',async t=>{
  const f=await fixture(t,Buffer.alloc(0)),full=await f.get();assert.equal(full.status,200);assert.equal(await full.text(),'');
  const range=await f.get({Range:'bytes=0-1'});assert.equal(range.status,416);assert.equal(range.headers.get('content-range'),'bytes */0');await range.arrayBuffer();
});

test('audio uses the same streaming and Range contract',async t=>{
  const f=await fixture(t),response=await f.audio({Range:'bytes=1-3'});
  assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.equal(await response.text(),'123');assert.equal(f.reads(),0);
});

test('media conditional requests precede Range and weak metadata cannot satisfy If-Range',async t=>{
  const f=await fixture(t),first=await f.get();await first.arrayBuffer();const etag=first.headers.get('etag');assert.match(etag,/^W\//);
  for(const value of [etag,etag.slice(2),'*']){
    const response=await f.get({'If-None-Match':value,Range:'bytes=1-3'});assert.equal(response.status,304);assert.equal((await response.arrayBuffer()).byteLength,0);
  }
  for(const value of [etag,'"stale"','Sun, 18 Oct 2026 00:00:00 GMT']){
    const response=await f.get({'If-Range':value,Range:'bytes=1-3'});assert.equal(response.status,200);assert.equal(await response.text(),'0123456789');
  }
  await writeFile(f.file,'changed media bytes');const edited=await f.get({'If-None-Match':etag,Range:'bytes=1-3'});
  assert.equal(edited.status,206);assert.notEqual(edited.headers.get('etag'),etag);assert.equal(await edited.text(),'han');
});

test('excluding the identity encoding does not serve an unaccepted media representation',async t=>{
  // fetch adds an identity encoding when Range is present; send the exact header.
  const f=await fixture(t),response=await f.rawGet({'Accept-Encoding':'identity;q=0, br, gzip',Range:'bytes=0-1'});
  assert.equal(response.status,406);assert.equal(response.headers['cache-control'],'no-store');assert.equal(f.reads(),0);
});

test('an interrupted large media stream leaves subsequent range requests usable',async t=>{
  const f=await fixture(t,Buffer.alloc(4*1024*1024,7)),abort=new AbortController();
  const response=await f.get({}, {signal:abort.signal});const reader=response.body.getReader();assert.equal((await reader.read()).done,false);
  abort.abort();await reader.cancel().catch(()=>{});
  const next=await f.get({Range:'bytes=0-1'});assert.equal(next.status,206);assert.deepEqual(Buffer.from(await next.arrayBuffer()),Buffer.from([7,7]));assert.equal(f.reads(),0);
});

test('company allowlist exposes exactly the three M03 release files with Range playback',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-m03-public-'));let app;
  t.after(async()=>{await app?.stop();await rm(directory,{recursive:true,force:true});});
  app=createCompanyApp({dataDir:join(directory,'app'),port:0,allowTestHost:true,schedule:false});await app.start();
  const base=`http://127.0.0.1:${app.server.address().port}`,media='/pulse-app/assets/casting/video/';
  for(const [name,digest]of[
    ['M03-mv-happy-gangster-poster-v1.webp','cab9f663ca559534948325e96b80ccc41e840ae5665472e39bdbc19f6fd46e50'],
    ['M03-mv-happy-gangster-excerpt-20s-v1.mp4','76c4e87d6002e3d0aa328a12b57d2601b792c980f0814e30fdf6d48689354dba'],
    ['M03-mv-happy-gangster-full-v1.mp4','583b940e21845b621a68a68730074be181b1bb4e0d57844a48da602192ac4c6d'],
  ]){
    const response=await fetch(base+media+name);assert.equal(response.status,200,name);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),digest,name);
    if(name.endsWith('.mp4')){
      const probe=await fetch(base+media+name,{headers:{Range:'bytes=0-1'}});assert.equal(probe.status,206);assert.match(probe.headers.get('content-range'),/^bytes 0-1\/[1-9]\d*$/);assert.equal((await probe.arrayBuffer()).byteLength,2);
    }
  }
  const existing=await fetch(base+media+'F02-ad-motion-5s-v1.mp4',{headers:{Range:'bytes=0-1'}});assert.equal(existing.status,206);await existing.arrayBuffer();
  const privateFile=await fetch(base+media+'unlisted.mp4',{headers:{Range:'bytes=0-1'}});assert.equal(privateFile.status,404);assert.equal(privateFile.headers.get('accept-ranges'),null);await privateFile.arrayBuffer();
});
