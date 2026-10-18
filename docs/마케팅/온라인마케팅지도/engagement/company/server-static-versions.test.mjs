import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createCompanyApp } from './server.mjs';
import { createStaticResponder, publicScriptAndStylePaths } from './static-response.mjs';
import { createMessenger } from '../../../../../tools/company-messenger/server.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('base64url');
const drive={active:async()=>null,status:async()=>({provider:'local',connections:[]})};
function wire(base,path,{headers={},method='GET'}={}){return new Promise((resolve,reject)=>{const outgoing=request(new URL(path,base),{method,headers,agent:false},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));});outgoing.setTimeout(10000,()=>outgoing.destroy(new Error('Static version test timeout')));outgoing.on('error',reject);outgoing.end();});}
const decoded=response=>response.headers['content-encoding']==='br'?brotliDecompressSync(response.body):response.headers['content-encoding']==='gzip'?gunzipSync(response.body):response.body;
const closers=new Map();
async function directory(t){const root=await mkdtemp(join(tmpdir(),'synk-versioned-static-'));t.after(async()=>{await closers.get(root)?.();closers.delete(root);assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep)&&resolve(root).split(sep).at(-1).startsWith('synk-versioned-static-'));await rm(root,{recursive:true,force:true});});return root;}
async function companyFixture(t){const root=await directory(t),app=createCompanyApp({dataDir:root,port:0,allowTestHost:true,schedule:false,messengerDriveStorage:drive,synkIdentityConfig:null});closers.set(root,()=>app.stop());const address=await app.start();return {base:'http://127.0.0.1:'+address.port,app};}
function links(html,base){return [...html.toString().matchAll(/(?:src|href)=["']([^"']+[?]v=[A-Za-z0-9_-]{43})["']/g)].map(match=>new URL(match[1],base));}
async function unitResponse(respond,url,options={}){let status,headers,body;await respond({url,method:options.method||'GET',headers:options.headers||{}},{writeHead:(code,value)=>{status=code;headers=value;},end:value=>{body=value||Buffer.alloc(0);}},{path:'asset.js',type:'text/javascript; charset=utf-8',versioned:true,...options});return {status,headers:Object.fromEntries(Object.entries(headers).map(([key,value])=>[key.toLowerCase(),value])),body};}

test('both no-store entry documents version their public scripts and styles; exact wire bytes match every digest',async t=>{
  const {base}=await companyFixture(t);let count=0;
  for(const path of ['/','/messenger/']){
    const response=await wire(base,path);assert.equal(response.status,200);assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.headers.etag,undefined);
    const urls=links(response.body,new URL(path,base));assert.equal(urls.length,path==='/'?103:4);
    for(const url of urls){const asset=await wire(base,url.pathname+url.search,{headers:{'Accept-Encoding':'br'}});assert.equal(asset.status,200,url.pathname);assert.equal(asset.headers['cache-control'],'public, max-age=31536000, immutable',url.pathname);assert.equal(hash(decoded(asset)),url.searchParams.get('v'),url.pathname);count++;}
  }
  assert.equal(count,107);
});

test('wrong, truncated, duplicate, extra and unversioned queries retain revalidation; HEAD and representation-specific 304 remain correct',async t=>{
  const {base}=await companyFixture(t),html=await wire(base,'/'),url=links(html.body,base).find(url=>url.pathname==='/app.js'),digest=url.searchParams.get('v');
  for(const suffix of ['', '?v=bad', '?v='+digest.slice(0,42), '?v='+digest+'&v='+digest, '?v='+digest+'&other=1']){const response=await wire(base,'/app.js'+suffix);assert.equal(response.status,200);assert.equal(response.headers['cache-control'],'public, max-age=0, must-revalidate');}
  const br=await wire(base,url.pathname+url.search,{headers:{'Accept-Encoding':'br'}});assert.equal(br.headers.etag,'"'+digest+'.br"');
  const again=await wire(base,url.pathname+url.search,{headers:{'Accept-Encoding':'br','If-None-Match':br.headers.etag}});assert.equal(again.status,304);assert.equal(again.body.length,0);assert.equal(again.headers['cache-control'],'public, max-age=31536000, immutable');
  const gzip=await wire(base,url.pathname+url.search,{headers:{'Accept-Encoding':'gzip','If-None-Match':br.headers.etag}});assert.equal(gzip.status,200);assert.equal(gzip.headers.etag,'"'+digest+'.gzip"');assert.deepEqual(decoded(gzip),decoded(br));
  const head=await wire(base,url.pathname+url.search,{method:'HEAD',headers:{'Accept-Encoding':'gzip'}});assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(head.headers.etag,gzip.headers.etag);assert.equal(Number(head.headers['content-length']),gzip.body.length);
});

test('workers, dynamic modules, fonts, HTML, APIs, protected attachments and rejected assets never gain immutable policy',async t=>{
  const {base}=await companyFixture(t);
  for(const path of ['/notification-sw.js','/pulse-app/sw.js','/pulse-app/push-sw.js','/teaching-host.js','/font.woff2']){const first=await wire(base,path);assert.equal(first.status,200,path);const second=await wire(base,path+'?v='+hash(first.body));assert.notEqual(second.headers['cache-control'],'public, max-age=31536000, immutable',path);}
  for(const path of ['/','/messenger/','/api/me','/api/state','/messenger/api/bootstrap','/messenger/api/files/private-id','/messenger/missing.css']){const response=await wire(base,path+'?v='+'a'.repeat(43));assert.equal(response.headers['cache-control'],'no-store',path);assert.equal(response.headers.etag,undefined,path);}
  const raw=await wire(base,'/messenger/app.js');const denied=await wire(base,'/messenger/app.js?v='+hash(raw.body),{headers:{'sec-fetch-site':'cross-site'}});assert.equal(denied.status,403);assert.equal(denied.headers['cache-control'],'no-store');
});

test('unchanged HTML gets a new dependency URL after asset bytes change and an old URL cannot grant immutable to new bytes',async()=>{
  let version=1,bytes=Buffer.from('window.value="first";');const responder=createStaticResponder({read:async()=>bytes,inspect:async()=>({size:bytes.length,mtimeNs:BigInt(version),ctimeNs:BigInt(version)})});
  const html=Buffer.from('<script src="/app.js"></script><link rel="stylesheet" href="https://other.invalid/a.css"><script src="/notification-sw.js"></script>'),settings={documentPath:'/',resolveAsset:path=>path==='/app.js'?'asset.js':null};
  const first=await responder.versionHTML(html,settings),oldHash=hash(bytes);assert.ok(first.includes('/app.js?v='+oldHash));assert.ok(first.includes('src="/notification-sw.js"'));
  bytes=Buffer.from('window.value="second";');version++;
  const second=await responder.versionHTML(html,settings);assert.ok(second.includes('/app.js?v='+hash(bytes)));assert.notDeepEqual(first,second);
  const response=await unitResponse(responder,'/app.js?v='+oldHash);assert.equal(response.headers['cache-control'],'public, max-age=0, must-revalidate');assert.deepEqual(response.body,bytes);
});

test('a stat-to-read replacement matches immutable against the actual response bytes rather than prior metadata',async()=>{
  const before=Buffer.from('first version'),after=Buffer.from('replacement version');let bytes=before,version=1;
  const responder=createStaticResponder({read:async()=>bytes,inspect:async()=>({size:bytes.length,mtimeNs:BigInt(version),ctimeNs:BigInt(version)})});
  const old=await responder.version('asset.js');bytes=after;version++;
  const response=await unitResponse(responder,'/app.js?v='+old);assert.deepEqual(response.body,after);assert.equal(response.headers['cache-control'],'public, max-age=0, must-revalidate');
  const direct=createStaticResponder({inspect:async()=>({size:before.length,mtimeNs:1n,ctimeNs:1n}),read:async()=>after});
  const raced=await unitResponse(direct,'/app.js?v='+hash(before));assert.deepEqual(raced.body,after);assert.equal(raced.headers['cache-control'],'public, max-age=0, must-revalidate');
});

test('digest metadata survives body-cache eviction, validates stats on reuse and remains bounded',async()=>{
  const bodies=new Map(Array.from({length:107},(_,i)=>['file'+i,Buffer.from('public '+i)]));let reads=0,stats=0;
  const responder=createStaticResponder({maxEntries:2,maxBytes:64,maxDigestEntries:128,read:async path=>{reads++;return bodies.get(path);},inspect:async path=>{stats++;return {size:bodies.get(path).length,mtimeNs:1n,ctimeNs:1n};}});
  for(const path of bodies.keys())await responder.version(path);const firstReads=reads;
  for(const path of bodies.keys())await responder.version(path);assert.equal(reads,firstReads);assert.ok(stats>=321);assert.equal(responder.stats().digestEntries,107);assert.ok(responder.stats().entries<=2&&responder.stats().bytes<=64);
  const bounded=createStaticResponder({maxDigestEntries:3,read:async path=>bodies.get(path),inspect:async path=>({size:bodies.get(path).length,mtimeNs:1n,ctimeNs:1n})});for(const path of bodies.keys())await bounded.version(path);assert.equal(bounded.stats().digestEntries,3);
});

test('HTML transform re-evaluates dependencies on each response and never receives an ETag or immutable policy',async()=>{
  let transformCalls=0;const html=Buffer.from('<script src="/app.js"></script>'),responder=createStaticResponder({read:async()=>html,inspect:async()=>({size:html.length,mtimeNs:1n,ctimeNs:1n})});
  const options={type:'text/html; charset=utf-8',versioned:true,transformHTML:async raw=>Buffer.concat([raw,Buffer.from(String(++transformCalls))])};
  const first=await unitResponse(responder,'/?v='+hash(html),options),second=await unitResponse(responder,'/?v='+hash(html),options);assert.notDeepEqual(first.body,second.body);assert.equal(first.headers['cache-control'],'no-store');assert.equal(second.headers.etag,undefined);assert.equal(transformCalls,2);
});

test('rewritten messenger CSS digest, compressed bytes and entry URLs use the same representation',async t=>{
  const root=await directory(t),source=join(root,'test.css'),raw=Buffer.from('.x{background:url("/assets/example.svg")}\n'.repeat(32));await writeFile(source,raw);
  const final=Buffer.from(raw.toString().replaceAll('/assets/','/messenger/assets/'));
  const app=createMessenger({dataDir:join(root,'data'),port:0,basePath:'/messenger',driveStorage:drive,backgroundJobsEnabled:false,staticResponderFactory:({read})=>createStaticResponder({read:()=>read(source),inspect:(_path,options)=>stat(source,options)})});closers.set(root,()=>app.close());const address=await app.listen();
  const response=await wire(address.url,'/messenger/styles.css?v='+hash(final),{headers:{'Accept-Encoding':'br'}});assert.equal(response.status,200);assert.equal(response.headers['cache-control'],'public, max-age=31536000, immutable');assert.deepEqual(decoded(response),final);assert.notEqual(hash(raw),hash(final));
  assert.deepEqual([...publicScriptAndStylePaths('<script src="/app.js"></script><img src="/logo.svg"><link href="https://elsewhere/a.css"><script src="/child.js?attempt=1"></script>','/')],['/app.js']);
});
