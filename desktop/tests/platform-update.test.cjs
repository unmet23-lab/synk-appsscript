'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {Readable}=require('node:stream'),{createHash}=require('node:crypto');
const {MANIFEST_URL,MAX_MANIFEST_BYTES,MAX_INSTALLER_BYTES,compareVersion,validateManifest,createPlatformUpdater}=require('../src/platform-update.cjs');
const payload=Buffer.from('synthetic public Signal installer'),sha=value=>createHash('sha256').update(value).digest('hex');
const now=Date.parse('2026-10-14T12:00:00.000Z');
function manifest({version='0.4.5',buildId='20261015.1',platform='win32',arch='x64',bytes=payload.length,hash=sha(payload)}={}){
  const releaseId=`platform-preview-${version}`;
  return {schemaVersion:1,product:'platform',channel:'preview',version,buildId,releaseId,publishedAt:'2026-10-14T11:00:00.000Z',artifacts:[{platform,arch,url:`https://github.com/unmet23-lab/synk-policy/releases/download/${releaseId}/SYNK-Platform-Preview-${version}.${platform==='win32'?'exe':'dmg'}`,bytes,sha256:hash,asarSHA256:'a'.repeat(64)}]};
}
const options={platform:'win32',arch:'x64',currentVersion:'0.4.4',currentBuildId:'20261014.1',now};
function response(data,{status=200,headers={}}={}){return {status,headers,body:Readable.from(Array.isArray(data)?data:[Buffer.isBuffer(data)?data:Buffer.from(typeof data==='string'?data:JSON.stringify(data))])};}
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const settled=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
async function fixture(t,{platform='win32',arch='x64',enabled=true,document=manifest({platform,arch}),request:customRequest,config:customConfig,...overrides}={}){
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'synk-platform-update-')),cacheRoot=path.join(directory,'updates'),requests=[],changes=[],installed=[],opened=[];let quits=0;
  const config=customConfig||{manifestUrl:MANIFEST_URL,channel:'preview',releaseId:'platform-preview-0.4.4',buildId:'20261014.1'};
  const request=async(url,requestOptions)=>{requests.push(url);return customRequest?customRequest(url,requestOptions):url===MANIFEST_URL?response(document):response(payload,{headers:{'content-length':String(payload.length)}});};
  const updater=createPlatformUpdater({enabled,config,currentVersion:'0.4.4',platform,arch,cacheRoot,request,now:()=>now,onChange:value=>changes.push(value),requestQuit:()=>{quits++;},openInstaller:async file=>{installed.push(file);},openDiskImage:async file=>{opened.push(file);return '';},...overrides});
  t.after(async()=>{updater.dispose();await fsp.rm(directory,{recursive:true,force:true});});
  return {updater,cacheRoot,directory,requests,changes,installed,opened,quits:()=>quits,document};
}
test('canonical versions compare numerically without accepting prereleases, coercion or leading zeroes',()=>{
  assert.equal(compareVersion('0.10.0','0.9.9'),1);assert.equal(compareVersion('0.4.4','0.4.4'),0);assert.equal(compareVersion('0.4.3','0.4.4'),-1);
  for(const version of ['v0.4.4','0.4.4-beta','00.4.4','0.4','0.4.4.1',null,[],{toString:()=> '0.4.4'}])assert.throws(()=>compareVersion(version,'0.4.4'));
});
test('manifest requires the matching product, channel, release, platform and canonical build',()=>{
  assert.equal(validateManifest(manifest(),options).current,false);
  assert.equal(validateManifest(manifest({version:'0.4.4',buildId:'20261014.1'}),options).current,true);
  const invalid=[{schemaVersion:2},{product:'world'},{channel:'stable'},{releaseId:'platform-preview-0.4.3'},{version:['0.4.5']},{buildId:['20261015.1']},{buildId:'../elsewhere'},{publishedAt:'tomorrow'},{publishedAt:'2026-10-20T00:00:00.000Z'},{artifacts:[]},{artifacts:Array(5).fill(manifest().artifacts[0])}];
  for(const patch of invalid)assert.throws(()=>validateManifest({...manifest(),...patch},options));
  assert.throws(()=>validateManifest(manifest({arch:'arm64'}),options),{updateCode:'UPDATE_PLATFORM_UNAVAILABLE'});
});
test('downgrades and same-version different builds cannot become install candidates',()=>{
  assert.throws(()=>validateManifest(manifest({version:'0.4.3'}),options),{updateCode:'UPDATE_DOWNGRADE_REJECTED'});
  assert.throws(()=>validateManifest(manifest({version:'0.4.4',buildId:'20261014.2'}),options),{updateCode:'UPDATE_BUILD_MISMATCH'});
});
test('artifact metadata rejects invalid size, hashes, duplicate target and URL injection',()=>{
  const original=manifest(),artifact=original.artifacts[0];
  const invalid=[{bytes:0},{bytes:-1},{bytes:1.2},{bytes:'32'},{bytes:MAX_INSTALLER_BYTES+1},{sha256:'A'.repeat(64)},{sha256:[sha(payload)]},{asarSHA256:'bad'},{platform:'linux'},{arch:'ia32'},
    ...['http://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.5/a.exe','https://github.com.evil.test/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.5/a.exe','https://github.com/other/repo/releases/download/platform-preview-0.4.5/a.exe','https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.4/a.exe','https://user@github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.5/a.exe','https://github.com:443/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.5/a.exe','https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.5/a.exe?redirect=evil','https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.5/a.cmd','https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.5/%2e%2e/a.exe'].map(url=>({url}))];
  for(const patch of invalid)assert.throws(()=>validateManifest({...original,artifacts:[{...artifact,...patch}]},options),JSON.stringify(patch));
  assert.throws(()=>validateManifest({...original,artifacts:[artifact,artifact]},options));
});
test('startup detects an update without downloading, opening, quitting or exposing installer paths',async t=>{
  let repeat,unrefs=0,clears=0;
  const f=await fixture(t,{setInterval:(fn,ms)=>{repeat=fn;assert.equal(ms,6*60*60*1000);return {unref(){unrefs++;}};},clearInterval:()=>clears++});
  f.updater.start();f.updater.start();await f.updater.checkForUpdate();
  assert.deepEqual(f.requests,[MANIFEST_URL]);assert.equal(f.updater.snapshot().state,'available');assert.equal(unrefs,1);assert.equal(f.quits(),0);assert.deepEqual(f.installed,[]);
  assert.equal(JSON.stringify(f.updater.snapshot()).includes('https://'),false);assert.equal(JSON.stringify(f.updater.snapshot()).includes(f.directory),false);
  repeat();await f.updater.checkForUpdate();assert.equal(f.requests.length,2);
  await f.updater.downloadUpdate();repeat();await settled();assert.equal(f.requests.length,3,'ready update is not displaced by periodic checking');
  f.updater.dispose();assert.equal(clears,1);
});
test('development, unknown OS and tampered runtime configuration remain disabled without network or cache writes',async t=>{
  for(const extra of [{enabled:false},{platform:'linux'},{config:{manifestUrl:'https://evil.test/preview.json',channel:'preview',releaseId:'platform-preview-0.4.4',buildId:'20261014.1'}},{config:{manifestUrl:MANIFEST_URL,channel:'stable',releaseId:'platform-preview-0.4.4',buildId:'20261014.1'}}]){
    const f=await fixture(t,extra);f.updater.start();assert.equal((await f.updater.checkForUpdate()).state,'disabled');assert.equal((await f.updater.downloadUpdate()).state,'disabled');assert.equal((await f.updater.installUpdate()).state,'disabled');assert.equal(f.requests.length,0);assert.equal(fs.existsSync(f.cacheRoot),false);assert.equal(f.quits(),0);
  }
});
test('an offline check can be retried explicitly and never starts a download',async t=>{
  let online=false;const f=await fixture(t,{request:async()=>{if(!online)throw Error('synthetic offline');return response(manifest());}});
  assert.equal((await f.updater.checkForUpdate()).code,'UPDATE_NETWORK_FAILED');online=true;
  assert.equal((await f.updater.checkForUpdate()).state,'available');assert.equal(f.requests.length,2);assert.equal(f.quits(),0);assert.deepEqual(f.installed,[]);
});
test('a stalled check is aborted within its bound and can be explicitly retried',async t=>{
  let stalled=true;const hold=setTimeout(()=>{},1000);t.after(()=>clearTimeout(hold));
  const f=await fixture(t,{timeoutMs:10,request:async(_url,{signal})=>{if(!stalled)return response(manifest());return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('synthetic aborted')),{once:true});});}});
  assert.equal((await f.updater.checkForUpdate()).code,'UPDATE_TIMEOUT');stalled=false;
  assert.equal((await f.updater.checkForUpdate()).state,'available');assert.equal(f.requests.length,2);
});
test('checking locks duplicate operations to one request and accepts no caller-supplied endpoint',async t=>{
  const wait=deferred();const f=await fixture(t,{request:async()=>{await wait.promise;return response(manifest());}});
  const first=f.updater.checkForUpdate('https://evil.test/'),second=f.updater.checkForUpdate();assert.equal(first,second);
  assert.equal((await f.updater.downloadUpdate()).code,'UPDATE_BUSY');wait.resolve();await first;assert.deepEqual(f.requests,[MANIFEST_URL]);
});
test('manifest response is bounded, rejects malformed JSON, and never follows a manifest redirect',async t=>{
  for(const [reply,code]of [[response('x'.repeat(MAX_MANIFEST_BYTES+1)),'UPDATE_MANIFEST_TOO_LARGE'],[response('{broken'),'UPDATE_INVALID_MANIFEST'],[response('',{status:302,headers:{location:'https://evil.test/manifest'}}),'UPDATE_UNTRUSTED_REDIRECT'],[response('',{status:503}),'UPDATE_HTTP_FAILED']]){
    const f=await fixture(t,{request:async()=>reply});assert.equal((await f.updater.checkForUpdate()).code,code);assert.equal(f.requests.length,1);
  }
});
test('download verifies the public installer bytes before ready and reuses only verified cached content',async t=>{
  const f=await fixture(t);assert.equal((await f.updater.downloadUpdate()).code,'UPDATE_NOT_AVAILABLE');await f.updater.checkForUpdate();
  assert.equal((await f.updater.downloadUpdate('C:\\untrusted.exe')).state,'ready');assert.equal(f.updater.snapshot().progress,100);
  assert.deepEqual(f.requests,[MANIFEST_URL,f.document.artifacts[0].url]);assert.equal(f.quits(),0);assert.deepEqual(f.installed,[]);
  const files=await fsp.readdir(f.cacheRoot);assert.equal(files.length,1);assert.match(files[0],/\.exe$/);assert.equal(sha(await fsp.readFile(path.join(f.cacheRoot,files[0]))),sha(payload));
  await f.updater.downloadUpdate();assert.equal(f.requests.length,2);
});
test('only a validated GitHub release asset redirect is downloaded',async t=>{
  const redirect='https://release-assets.githubusercontent.com/github-production-release-asset/123/synthetic?sig=synthetic';
  const f=await fixture(t,{request:async url=>url===MANIFEST_URL?response(manifest()):url.includes('github.com/')?response('',{status:302,headers:{location:redirect}}):response(payload)});
  await f.updater.checkForUpdate();assert.equal((await f.updater.downloadUpdate()).state,'ready');assert.equal(f.requests[2],redirect);
});
test('malicious redirects, response encodings and redirect loops never create a ready installer',async t=>{
  for(const location of ['http://release-assets.githubusercontent.com/github-production-release-asset/1/a','https://evil.test/a.exe','https://release-assets.githubusercontent.com.evil.test/github-production-release-asset/1/a','https://user@release-assets.githubusercontent.com/github-production-release-asset/1/a','https://release-assets.githubusercontent.com/arbitrary/a','https://github.com/evil/repo/releases/download/tag/file.exe']){
    const f=await fixture(t,{request:async url=>url===MANIFEST_URL?response(manifest()):response('',{status:302,headers:{location}})});
    await f.updater.checkForUpdate();assert.equal((await f.updater.downloadUpdate()).code,'UPDATE_UNTRUSTED_REDIRECT');assert.equal(f.requests.length,2);assert.deepEqual(await fsp.readdir(f.cacheRoot),[]);
  }
  const f=await fixture(t,{request:async url=>url===MANIFEST_URL?response(manifest()):response(payload,{headers:{'content-encoding':'gzip'}})});
  await f.updater.checkForUpdate();assert.equal((await f.updater.downloadUpdate()).code,'UPDATE_INVALID_RESPONSE');
  const loop=await fixture(t,{request:async url=>url===MANIFEST_URL?response(manifest()):response('',{status:302,headers:{location:url}})});
  await loop.updater.checkForUpdate();assert.equal((await loop.updater.downloadUpdate()).code,'UPDATE_UNTRUSTED_REDIRECT');assert.equal(loop.requests.length,5);
});
test('truncated, oversized, wrong-hash and wrong-length transfers delete partial files and can be retried',async t=>{
  for(const bad of [()=>response(payload.subarray(0,3)),()=>response(Buffer.concat([payload,Buffer.from('extra')])),()=>response(Buffer.alloc(payload.length)),()=>response(payload,{headers:{'content-length':'1'}})]){
    let broken=true;const f=await fixture(t,{request:async url=>url===MANIFEST_URL?response(manifest()):broken?bad():response(payload)});
    await f.updater.checkForUpdate();assert.equal((await f.updater.downloadUpdate()).code,'UPDATE_INTEGRITY_FAILED');assert.deepEqual(await fsp.readdir(f.cacheRoot),[]);assert.equal(f.quits(),0);
    broken=false;assert.equal((await f.updater.downloadUpdate()).state,'ready');
  }
});
test('concurrent downloads share one stream and cannot race a manifest refresh or installation',async t=>{
  const wait=deferred();const f=await fixture(t,{request:async url=>{if(url===MANIFEST_URL)return response(manifest());await wait.promise;return response(payload);}});
  await f.updater.checkForUpdate();const first=f.updater.downloadUpdate(),second=f.updater.downloadUpdate();assert.equal(first,second);
  assert.equal((await f.updater.checkForUpdate()).code,'UPDATE_BUSY');assert.equal((await f.updater.installUpdate()).code,'UPDATE_BUSY');wait.resolve();assert.equal((await first).state,'ready');assert.equal(f.requests.length,2);
});
test('installer remains unlaunched until normal quit guards accept; draft cancellation leaves verified download ready',async t=>{
  const f=await fixture(t);await f.updater.checkForUpdate();await f.updater.downloadUpdate();
  assert.equal((await f.updater.installUpdate()).state,'opening');assert.equal(f.quits(),1);assert.equal(f.installed.length,0);assert.equal(f.updater.needsInstallHandoff(),true);
  f.updater.cancelInstall();assert.equal(f.updater.snapshot().state,'ready');assert.equal(f.updater.snapshot().code,'UPDATE_EXIT_CANCELLED');assert.equal(f.updater.needsInstallHandoff(),false);
  assert.equal((await f.updater.completeInstall()).code,'UPDATE_NOT_READY');assert.equal(f.installed.length,0);
  await f.updater.installUpdate();assert.equal((await f.updater.completeInstall()).ok,true);assert.equal(f.installed.length,1);assert.equal(f.updater.needsInstallHandoff(),false);
  await f.updater.completeInstall();await f.updater.installUpdate();assert.equal(f.installed.length,1);assert.equal(f.quits(),2);
});
test('post-download tampering blocks quit and post-quit-guard tampering blocks installer execution',async t=>{
  const f=await fixture(t);await f.updater.checkForUpdate();await f.updater.downloadUpdate();const file=path.join(f.cacheRoot,(await fsp.readdir(f.cacheRoot))[0]);
  await fsp.writeFile(file,Buffer.alloc(payload.length));assert.equal((await f.updater.installUpdate()).code,'UPDATE_INTEGRITY_FAILED');assert.equal(f.quits(),0);
  await f.updater.downloadUpdate();await f.updater.installUpdate();await fsp.writeFile(file,Buffer.alloc(payload.length));
  assert.equal((await f.updater.completeInstall()).code,'UPDATE_INTEGRITY_FAILED');assert.equal(f.installed.length,0);
});
test('a failed installer handoff remains recoverable and never reports a completed installation',async t=>{
  let broken=true,launched=0;const f=await fixture(t,{openInstaller:async()=>{if(broken)throw Error('synthetic OS failure');launched++;}});
  await f.updater.checkForUpdate();await f.updater.downloadUpdate();await f.updater.installUpdate();
  assert.equal((await f.updater.completeInstall()).code,'UPDATE_OPEN_FAILED');assert.equal(f.updater.needsInstallHandoff(),false);
  broken=false;await f.updater.downloadUpdate();await f.updater.installUpdate();assert.equal((await f.updater.completeInstall()).ok,true);assert.equal(launched,1);
});
test('Mac opens the verified disk image for user installation without closing the app or claiming an automatic update',async t=>{
  const f=await fixture(t,{platform:'darwin',arch:'arm64'});await f.updater.checkForUpdate();await f.updater.downloadUpdate();
  assert.equal((await f.updater.installUpdate()).code,'UPDATE_MANUAL_INSTALL');assert.equal(f.opened.length,1);assert.match(f.opened[0],/\.dmg$/);assert.equal(f.quits(),0);assert.equal(f.installed.length,0);assert.equal(f.updater.needsInstallHandoff(),false);
});
test('current and same-version-conflicting manifests never download or quit',async t=>{
  for(const buildId of ['20261014.1','20261014.2']){
    const f=await fixture(t,{document:manifest({version:'0.4.4',buildId})});const status=await f.updater.checkForUpdate();assert.equal(status.state,buildId==='20261014.1'?'current':'error');
    assert.equal((await f.updater.downloadUpdate()).ok,false);assert.equal(f.requests.length,1);assert.equal((await f.updater.installUpdate()).ok,false);assert.equal(f.quits(),0);
  }
});
test('disposing aborts a pending transfer and prevents late UI writes or a ready installer',async t=>{
  const gate=deferred(),started=deferred();let aborted=false;const f=await fixture(t,{request:async(url,{signal})=>{if(url===MANIFEST_URL)return response(manifest());signal.addEventListener('abort',()=>{aborted=true;gate.resolve();},{once:true});started.resolve();await gate.promise;return response(payload);}});
  await f.updater.checkForUpdate();const pending=f.updater.downloadUpdate();await started.promise;const changes=f.changes.length;f.updater.dispose();await pending;
  assert.equal(aborted,true);assert.equal(f.changes.length,changes);assert.deepEqual(await fsp.readdir(f.cacheRoot),[]);assert.equal(f.quits(),0);
});
test('updater preload exposes fixed no-argument IPC only and a removable status subscription',()=>{
  let api;const calls=[],listeners=new Map();const ipcRenderer={invoke:(...args)=>{calls.push(args);return Promise.resolve({ok:true});},on:(name,fn)=>listeners.set(name,fn),removeListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(_name,value)=>{api=value;}},ipcRenderer};}});
  for(const method of ['updateStatus','checkForUpdate','downloadUpdate','installUpdate'])api[method]('https://evil.test/','C:\\arbitrary.exe');
  assert.deepEqual(calls,[['synk:update-status'],['synk:check-for-update'],['synk:download-update'],['synk:install-update']]);
  let observed;const stop=api.onUpdateChanged(value=>{observed=value;});listeners.get('synk:update-changed')({}, {state:'ready'});assert.equal(observed.state,'ready');stop();assert.equal(listeners.size,0);
});
test('main updater is platform-packaged only, uses existing trusted sender checks, and installs only after will-quit',()=>{
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
  assert.match(main,/if\(runtime\.clientId==='platform'\)\{[\s\S]*?platformUpdate=createPlatformUpdater\(\{enabled:packaged&&!smoke,config:runtime\.update/);
  assert.match(main,/app\.on\('will-quit',event=>\{[\s\S]*?event\.preventDefault\(\);[\s\S]*?platformUpdate\.completeInstall\(\)/);
  assert.match(main,/spawn\(file,\['--wait-pid='\+process\.pid\],\{detached:true,stdio:'ignore',windowsHide:true\}\)/);
  assert.match(main,/contents\.on\('will-prevent-unload',event=>\{if\(!event\.defaultPrevented\)platformUpdate\?\.cancelInstall\(\);\}\)/);
  assert.match(main,/ipcMain\.handle\(channel,async\(event,\.\.\.args\)=>\{assertSender\(event,window,entry,runtime\.clientId\)/);
  for(const operation of ['check-for-update','download-update','install-update'])assert.match(main,new RegExp("'synk:"+operation+"':\\(\\)=>platformUpdate\\?\\."));
});
