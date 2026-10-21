import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, copyFile, rm, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { createCompanyApp } from './server.mjs';
import { createStaticSet, validateStaticManifest, STATIC_SET_SCHEMA } from './static-set.mjs';

const here=dirname(fileURLToPath(import.meta.url)),repository=resolve(here,'../../../../..');
const COMPANY='docs/마케팅/온라인마케팅지도/engagement/company',MESSENGER='tools/company-messenger/public';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const drive={active:async()=>null,status:async()=>({provider:'local',connections:[]})};
function wire(base,path,{headers={},method='GET'}={}){return new Promise((resolve,reject)=>{const outgoing=request(new URL(path,base),{method,headers,agent:false},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));});outgoing.on('error',reject);outgoing.end();});}
const decoded=response=>response.headers['content-encoding']==='br'?brotliDecompressSync(response.body):response.headers['content-encoding']==='gzip'?gunzipSync(response.body):response.body;
async function scratch(t,beforeCleanup){
  const root=await mkdtemp(join(tmpdir(),'synk-static-set-'));
  t.after(async()=>{await beforeCleanup?.();assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));await rm(root,{recursive:true,force:true});});
  return root;
}
async function files(directory,prefix=''){const out=[];for(const entry of await readdir(directory,{withFileTypes:true})){const name=prefix?prefix+'/'+entry.name:entry.name;if(entry.isDirectory())out.push(...await files(join(directory,entry.name),name));else if(entry.isFile())out.push(name);}return out;}
// Writes sets/<id> with the given repository-relative files and returns the id.
// A row's origin defaults to the bytes the repository (standing in for the image) holds now.
async function makeSet(root,contents,{origins={}}={}){
  const listed={};
  for(const [path,bytes] of Object.entries(contents)){
    let origin=origins[path];
    if(origin===undefined){try{origin=sha(await readFile(join(repository,...path.split('/'))));}catch{origin=null;}}
    listed[path]={sha256:sha(bytes),size:bytes.length,origin};
  }
  const id=sha(JSON.stringify(Object.entries(listed).sort())).slice(0,16),directory=join(root,'sets',id);
  for(const [path,bytes] of Object.entries(contents)){await mkdir(dirname(join(directory,...path.split('/'))),{recursive:true});await writeFile(join(directory,...path.split('/')),bytes);}
  await writeFile(join(directory,'manifest.json'),JSON.stringify({schema:STATIC_SET_SCHEMA,id,commit:'a'.repeat(40),files:listed}));
  return id;
}
// Production uses a relative symlink replaced by rename; Windows test runs need a junction.
const windows=process.platform==='win32';
async function link(root,target,path){await symlink(windows?join(root,...target.split('/')):target,path,windows?'junction':'dir');}
async function point(root,id){const next=join(root,'current.next');await rm(next,{force:true});await link(root,'sets/'+id,next);if(windows)await rm(join(root,'current'),{force:true});await rename(next,join(root,'current'));}

test('manifest validation rejects unsafe paths, wrong ids and rows without an origin',()=>{
  const row={sha256:'0'.repeat(64),size:1,origin:'1'.repeat(64)},valid={schema:STATIC_SET_SCHEMA,id:'0123456789abcdef',files:{'a/b.js':row,'a/new.js':{...row,origin:null}}};
  assert.equal(validateStaticManifest(valid,'0123456789abcdef').origins.get('a/b.js'),'1'.repeat(64));
  assert.equal(validateStaticManifest(valid).origins.get('a/new.js'),null);
  for(const [change,code] of [[{schema:'x'},'STATIC_SET_SCHEMA'],[{schema:'synk-company-static-set/v1'},'STATIC_SET_SCHEMA'],[{id:'XYZ'},'STATIC_SET_ID'],[{files:{}},'STATIC_SET_FILES'],[{files:{'../x.js':row}},'STATIC_SET_FILE'],[{files:{'/x.js':row}},'STATIC_SET_FILE'],[{files:{'a\\x.js':row}},'STATIC_SET_FILE'],[{files:{'a/./x.js':row}},'STATIC_SET_FILE'],[{files:{'a/x.js':{sha256:'zz',size:1,origin:null}}},'STATIC_SET_FILE'],[{files:{'a/x.js':{sha256:'0'.repeat(64),size:1}}},'STATIC_SET_FILE'],[{files:{'a/x.js':{...row,origin:'zz'}}},'STATIC_SET_FILE']])
    assert.throws(()=>validateStaticManifest({...valid,...change}),{message:code});
  assert.throws(()=>validateStaticManifest(valid,'fedcba9876543210'),{message:'STATIC_SET_ID'});
});

test('without a root every path stays the image path',()=>{
  const set=createStaticSet({root:'',repository});
  assert.equal(set.file(join(here,'public/app.js')),join(here,'public/app.js'));
  assert.deepEqual(set.status(),{mode:'image',set:null,commit:null});
});

test('listed files come from the current set while the image holds their origin; flips are picked up; breakage falls back to the image',async t=>{
  const root=await scratch(t),first=await makeSet(root,{[COMPANY+'/public/app.js']:Buffer.from('one'),[MESSENGER+'/app.js']:Buffer.from('m'),[MESSENGER+'/not-in-image.js']:Buffer.from('new')});
  await point(root,first);
  const set=createStaticSet({root,repository,recheckMs:0}),image=join(here,'public/app.js');
  assert.equal(set.file(image),join(root,'sets',first,...COMPANY.split('/'),'public','app.js'));
  assert.equal(set.file(join(here,'public/style.css')),join(here,'public/style.css'));
  assert.equal(set.file(join(repository,MESSENGER,'app.js')),join(root,'sets',first,...MESSENGER.split('/'),'app.js'));
  assert.equal(set.file(join(repository,MESSENGER,'not-in-image.js')),join(root,'sets',first,...MESSENGER.split('/'),'not-in-image.js'));
  assert.equal(set.file(join(repository,'..','outside.js')),join(repository,'..','outside.js'));
  assert.deepEqual(set.status(),{mode:'host',set:first,commit:'a'.repeat(40)});
  const second=await makeSet(root,{[COMPANY+'/public/app.js']:Buffer.from('two')});await point(root,second);
  assert.equal(set.file(image),join(root,'sets',second,...COMPANY.split('/'),'public','app.js'));
  // An image release that changed a file (or added one the set also has) wins over the set.
  const stale=await makeSet(root,{[COMPANY+'/public/app.js']:Buffer.from('three'),[MESSENGER+'/app.js']:Buffer.from('m3')},{origins:{[COMPANY+'/public/app.js']:'0'.repeat(64),[MESSENGER+'/app.js']:null}});
  await point(root,stale);
  assert.equal(set.file(image),image);
  assert.equal(set.file(join(repository,MESSENGER,'app.js')),join(repository,MESSENGER,'app.js'));
  assert.equal(set.status().mode,'host');
  // A set directory is immutable once current; a broken one arrives as a new directory.
  await mkdir(join(root,'sets','00000000000000ff'),{recursive:true});await writeFile(join(root,'sets','00000000000000ff','manifest.json'),'{"schema":"x"}');await point(root,'00000000000000ff');
  assert.equal(set.file(image),image);assert.equal(set.status().mode,'image');assert.equal(set.status().error,'STATIC_SET_SCHEMA');
  await rm(join(root,'current'));
  assert.equal(set.file(image),image);assert.equal(set.status().error,'STATIC_SET_UNREADABLE');
  await mkdir(join(root,'elsewhere','0123456789abcdef'),{recursive:true});await link(root,'elsewhere/0123456789abcdef',join(root,'current'));
  assert.equal(set.file(image),image);assert.equal(set.status().error,'STATIC_SET_OUTSIDE');
});

test('the company host serves screen and messenger files from the set without a restart',async t=>{
  let server;const root=await scratch(t,()=>server?.stop()),data=join(root,'data');await mkdir(data);
  const index=(await readFile(join(here,'public/index.html'),'utf8')).replace('</body>','<!-- static set one --></body>');
  const app=Buffer.from((await readFile(join(here,'public/app.js'),'utf8'))+'\n// static set one\n');
  const messenger={};for(const name of await files(join(repository,MESSENGER)))messenger[MESSENGER+'/'+name]=await readFile(join(repository,MESSENGER,...name.split('/')));
  messenger[MESSENGER+'/app.js']=Buffer.concat([messenger[MESSENGER+'/app.js'],Buffer.from('\n// messenger set one\n')]);
  const first=await makeSet(join(root,'static'),{[COMPANY+'/public/index.html']:Buffer.from(index),[COMPANY+'/public/app.js']:app,...messenger});
  await point(join(root,'static'),first);
  const staticSet=createStaticSet({root:join(root,'static'),repository,recheckMs:0});
  server=createCompanyApp({dataDir:data,port:0,allowTestHost:true,schedule:false,messengerDriveStorage:drive,synkIdentityConfig:null,staticSet});
  const address=await server.start(),base=`http://127.0.0.1:${address.port}`;
  const status=await wire(base,'/api/static-set');assert.equal(status.status,200);assert.equal(status.headers['cache-control'],'no-store');
  assert.deepEqual(JSON.parse(status.body),{mode:'host',set:first,commit:'a'.repeat(40)});
  const page=await wire(base,'/');assert.equal(page.status,200);assert.match(page.body.toString(),/static set one/);
  const link=page.body.toString().match(/src="\/app\.js\?v=([A-Za-z0-9_-]{43})"/);assert.ok(link,'app.js stays versioned');
  assert.equal(link[1],createHash('sha256').update(app).digest('base64url'));
  const script=await wire(base,'/app.js?v='+link[1],{headers:{'Accept-Encoding':'br'}});
  assert.deepEqual(decoded(script),app);assert.equal(script.headers['cache-control'],'public, max-age=31536000, immutable');
  const style=await wire(base,'/style.css',{headers:{'Accept-Encoding':'identity'}});assert.deepEqual(style.body,await readFile(join(here,'public/style.css')));
  const chat=await wire(base,'/messenger/app.js',{headers:{'Accept-Encoding':'identity'}});assert.equal(chat.status,200);assert.match(chat.body.toString(),/messenger set one/);
  const second=await makeSet(join(root,'static'),{[COMPANY+'/public/app.js']:Buffer.from('console.log("two");'),[COMPANY+'/public/style.css']:Buffer.from('body{}')},{origins:{[COMPANY+'/public/style.css']:'0'.repeat(64)}});await point(join(root,'static'),second);
  const again=await wire(base,'/app.js',{headers:{'Accept-Encoding':'identity'}});assert.equal(again.body.toString(),'console.log("two");');
  // style.css was made against other bytes than the image now holds, so the image copy wins.
  const imageStyle=await wire(base,'/style.css',{headers:{'Accept-Encoding':'identity'}});assert.deepEqual(imageStyle.body,await readFile(join(here,'public/style.css')));
  const entry=await wire(base,'/');assert.doesNotMatch(entry.body.toString(),/static set one/);
  const imageChat=await wire(base,'/messenger/app.js',{headers:{'Accept-Encoding':'identity'}});assert.doesNotMatch(imageChat.body.toString(),/messenger set one/);
  await rm(join(root,'static','current'));
  const fallback=await wire(base,'/app.js',{headers:{'Accept-Encoding':'identity'}});assert.deepEqual(fallback.body,await readFile(join(here,'public/app.js')));
  assert.equal(JSON.parse((await wire(base,'/api/static-set')).body).mode,'image');
});
