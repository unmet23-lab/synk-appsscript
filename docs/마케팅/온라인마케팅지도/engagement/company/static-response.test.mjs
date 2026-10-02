import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createStaticResponder } from './static-response.mjs';
import { createCompanyApp } from './server.mjs';

function reply(){return{status:null,headers:null,body:null,writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};}
function req(headers={},method='GET'){return{headers,method};}
async function fixture(t,beforeCleanup){
  const directory=await mkdtemp(join(tmpdir(),'synk-static-test-'));
  t.after(async()=>{await beforeCleanup?.();assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(),'synk-static-test-'))));await rm(directory,{recursive:true,force:true});});
  return directory;
}
test('public text assets are compressed, cached in memory and revalidated without retransmission',async t=>{
  const directory=await fixture(t),path=join(directory,'asset.js'),raw=Buffer.from('const value="싱ㅋ 작업실";\n'.repeat(100));await writeFile(path,raw);
  let reads=0;const respond=createStaticResponder({read:async file=>{reads++;return readFile(file);}}),first=reply();
  await respond(req({'accept-encoding':'br, gzip'}),first,{path,type:'text/javascript; charset=utf-8',headers:{'X-Content-Type-Options':'nosniff'}});
  assert.equal(first.status,200);assert.equal(first.headers['Content-Encoding'],'br');assert.equal(first.headers['Vary'],'Accept-Encoding');
  assert.match(first.headers['Cache-Control'],/max-age=0, must-revalidate/);assert.equal(first.headers['X-Content-Type-Options'],'nosniff');
  assert.ok(first.body.length<raw.length/3);assert.deepEqual(brotliDecompressSync(first.body),raw);
  for(const conditional of [first.headers.ETag,'W/'+first.headers.ETag,'"other", '+first.headers.ETag,'*']){
    const next=reply();await respond(req({'accept-encoding':'br, gzip','if-none-match':conditional}),next,{path,type:'text/javascript; charset=utf-8'});
    assert.equal(next.status,304);assert.equal(next.body,undefined);
  }
  assert.equal(reads,1);
});
test('encoding variants honor exclusions and cannot validate a different compressed representation',async t=>{
  const directory=await fixture(t),path=join(directory,'asset.css'),raw=Buffer.from('body{color:blue} '.repeat(100));await writeFile(path,raw);
  const respond=createStaticResponder(),br=reply(),gz=reply(),identity=reply();
  await respond(req({'accept-encoding':'br'}),br,{path,type:'text/css'});
  await respond(req({'accept-encoding':'br;q=0, gzip;q=0.5','if-none-match':br.headers.ETag}),gz,{path,type:'text/css'});
  assert.equal(gz.status,200);assert.equal(gz.headers['Content-Encoding'],'gzip');assert.deepEqual(gunzipSync(gz.body),raw);assert.notEqual(gz.headers.ETag,br.headers.ETag);
  await respond(req({'accept-encoding':'br;q=0, gzip;q=0'}),identity,{path,type:'text/css'});assert.equal(identity.status,200);assert.equal(identity.headers['Content-Encoding'],undefined);assert.deepEqual(identity.body,raw);
  const excluded=reply();await respond(req({'accept-encoding':'br;q=0, gzip;q=0, identity;q=0'}),excluded,{path,type:'text/css'});assert.equal(excluded.status,406);assert.equal(excluded.headers['Cache-Control'],'no-store');
  const preferredIdentity=reply();await respond(req({'accept-encoding':'br;q=0.2, gzip;q=0.5, identity;q=1'}),preferredIdentity,{path,type:'text/css'});assert.equal(preferredIdentity.headers['Content-Encoding'],undefined);assert.deepEqual(preferredIdentity.body,raw);
});
test('source edits invalidate bytes and ETag immediately while simultaneous requests share disk reads',async t=>{
  const directory=await fixture(t),path=join(directory,'asset.js');await writeFile(path,'const first=1;'.repeat(100));
  let reads=0,release;const held=new Promise(resolve=>{release=resolve;});
  const respond=createStaticResponder({read:async file=>{reads++;await held;return readFile(file);}});
  const responses=Array.from({length:12},()=>reply()),requests=responses.map(res=>respond(req(),res,{path,type:'text/javascript'}));
  release();await Promise.all(requests);assert.equal(reads,1);const before=responses[0].headers.ETag;
  await writeFile(path,'const second=2;'.repeat(101));const after=reply();await respond(req({'if-none-match':before}),after,{path,type:'text/javascript'});
  assert.equal(reads,2);assert.equal(after.status,200);assert.notEqual(after.headers.ETag,before);assert.match(after.body.toString(),/const second=2/);
});
test('HTML never becomes reusable through ETag and HEAD sends no body',async t=>{
  const directory=await fixture(t),path=join(directory,'index.html');await writeFile(path,'<main>싱ㅋ</main>'.repeat(100));
  const respond=createStaticResponder(),html=reply();await respond(req({'accept-encoding':'gzip','if-none-match':'*'}),html,{path,type:'text/html; charset=utf-8'});
  assert.equal(html.status,200);assert.equal(html.headers['Cache-Control'],'no-store');assert.equal(html.headers.ETag,undefined);assert.deepEqual(gunzipSync(html.body),await readFile(path));
  const head=reply();await respond(req({},'HEAD'),head,{path,type:'text/html; charset=utf-8'});assert.equal(head.status,200);assert.equal(head.body,undefined);assert.equal(Number(head.headers['Content-Length']),(await readFile(path)).length);
});
test('cache storage stays bounded as raw and compressed representations are added',async t=>{
  const directory=await fixture(t),respond=createStaticResponder({maxEntries:2,maxBytes:4096});
  for(let i=0;i<6;i++){
    const path=join(directory,`asset-${i}.js`);await writeFile(path,`const n=${i};`.repeat(100));
    await respond(req({'accept-encoding':'br'}),reply(),{path,type:'text/javascript'});
    assert.ok(respond.stats().entries<=2);assert.ok(respond.stats().bytes<=4096);
  }
  const large=join(directory,'large.txt');await writeFile(large,'x'.repeat(8192));await respond(req(),reply(),{path:large,type:'text/plain'});
  assert.ok(respond.stats().bytes<=4096);
});
test('company server limits cache permission to mapped public assets and retains security headers',async t=>{
  let app;const directory=await fixture(t,()=>app?.stop());app=createCompanyApp({dataDir:join(directory,'app'),port:0,allowTestHost:true,schedule:false});await app.start();
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const asset=await fetch(base+'/app.js',{headers:{'Accept-Encoding':'gzip'}});assert.equal(asset.status,200);assert.equal(asset.headers.get('content-encoding'),'gzip');assert.equal(asset.headers.get('x-content-type-options'),'nosniff');assert.match(asset.headers.get('content-security-policy'),/frame-ancestors 'none'/);await asset.text();
  const etag=asset.headers.get('etag'),repeat=await fetch(base+'/app.js',{headers:{'Accept-Encoding':'gzip','If-None-Match':etag}});assert.equal(repeat.status,304);assert.equal((await repeat.arrayBuffer()).byteLength,0);
  const head=await fetch(base+'/app.js',{method:'HEAD',headers:{'Accept-Encoding':'gzip'}});assert.equal(head.status,200);assert.equal(head.headers.get('etag'),etag);assert.equal((await head.arrayBuffer()).byteLength,0);
  for(const path of ['/','/api/health','/api/me','/api/state','/api/missing','/missing.css']){
    const response=await fetch(base+path,{headers:{'If-None-Match':'*'}});assert.equal(response.headers.get('cache-control'),'no-store',path);assert.equal(response.headers.get('etag'),null,path);await response.arrayBuffer();
  }
});
