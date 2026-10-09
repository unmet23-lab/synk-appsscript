'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {CLIENTS,identity}=require('../src/catalog.cjs');
const {allowedUrl,safeEntry,assertSender,inside,preferences,allowedNavigation,externalDestination,allowedDownload,contentSecurityPolicy}=require('../src/security.cjs');
const {installationPaths,createInstallations}=require('../src/installations.cjs');
const {configFor,prepare}=require('../tools/package.cjs');
const {EventEmitter}=require('node:events');
test('three clients have independent app IDs, executables, profiles, installers and session scopes on both systems',()=>{
  for(const mode of ['development','release']) {
    const identities=Object.keys(CLIENTS).map(id=>identity(id,mode));
    for(const key of ['appId','executableName','productName','sessionScope'])assert.equal(new Set(identities.map(c=>c[key])).size,3);
    for(const platform of ['win32','darwin'])for(const arch of ['x64','arm64'])for(const id of Object.keys(CLIENTS)) {const config=configFor(id,{mode,platform,arch});assert.equal(config.appId,identity(id,mode).appId);assert.equal(config.nsis.runAfterFinish,false);assert.equal(config.publish,null);assert.equal(config.mac.hardenedRuntime,true);}
  }
  assert.notEqual(identity('world','development').sessionScope,identity('world','release').sessionScope);
});
test('release needs approved configuration and HTTPS; local addresses are development-only',()=>{
  assert.throws(()=>prepare('world',{mode:'release',platform:'win32',arch:'x64'}),/not configured/);
  assert.equal(safeEntry('http://127.0.0.1:4280/synk-account/platform.html','development'),true);
  for(const url of ['http://127.0.0.1:4280/','https://localhost/','https://127.0.0.1/','https://1.2.3.4/','https://user:pass@trusted.invalid/','file:///C:/a.exe','javascript:alert(1)'])assert.equal(safeEntry(url,'release'),false,url);
  assert.equal(safeEntry('https://desktop.example.invalid/platform','release'),true);
});
test('IPC rejects other WebContents, child frames, missing frames and host prefix tricks',()=>{
  const frame={url:'https://desktop.example.invalid/platform'},webContents={mainFrame:frame},window={webContents,isDestroyed:()=>false},event={sender:webContents,senderFrame:frame};
  assert.doesNotThrow(()=>assertSender(event,window,frame.url));
  for(const bad of [{...event,sender:{}},{...event,senderFrame:{...frame}},{...event,senderFrame:null}])assert.throws(()=>assertSender(bad,window,frame.url),/UNTRUSTED_SENDER/);
  assert.equal(allowedUrl('https://desktop.example.invalid.evil.invalid/','https://desktop.example.invalid/platform'),false);
  assert.equal(allowedUrl('https://desktop.example.invalid@evil.invalid/','https://desktop.example.invalid/platform'),false);
  assert.equal(allowedUrl('file:///C:/Windows/System32/cmd.exe','https://desktop.example.invalid/platform'),false);
});
test('renderer keeps sandbox, isolated context and no Node, subframe Node or webview',()=>{
  const p=preferences('/trusted/preload.cjs','persist:world');assert.equal(p.sandbox,true);assert.equal(p.contextIsolation,true);assert.equal(p.nodeIntegration,false);assert.equal(p.nodeIntegrationInSubFrames,false);assert.equal(p.webviewTag,false);assert.equal(p.webSecurity,true);assert.equal(p.allowRunningInsecureContent,false);
});
test('installation paths are fixed per application; parent traversal and outside roots fail',()=>{
  const win=installationPaths('world',{platform:'win32',mode:'release',programRoot:'C:\\Users\\fixture\\Programs'});
  assert.equal(win.executable,'C:\\Users\\fixture\\Programs\\SYNKWorld\\SYNKWorld.exe');
  const mac=installationPaths('messenger',{platform:'darwin',mode:'release',programRoot:'/Applications'});assert.equal(mac.executable,'/Applications/SYNKMessenger.app/Contents/MacOS/SYNKMessenger');
  assert.throws(()=>installationPaths('../cmd',{platform:'win32',mode:'release',programRoot:'C:\\Programs'}),/UNKNOWN_CLIENT/);
  assert.equal(inside('/Applications','/etc/evil'),false);assert.equal(inside('/Applications','/ApplicationsEvil/app'),false);
});
function fixture(overrides={}) {
  const release={id:'world',mode:'release',platform:'darwin',arch:'arm64',version:'0.1.0',executableSHA256:'a'.repeat(64),asarSHA256:'b'.repeat(64)},calls=[];
  const base={clientId:'platform',mode:'release',platform:'darwin',arch:'arm64',programRoot:'/Applications',releases:[release],realpath:async p=>p,readFile:async()=>JSON.stringify({clientId:'world',appId:'im.synk.world',version:'0.1.0',mode:'release',arch:'arm64',platform:'darwin'}),hash:async p=>p.endsWith('app.asar')?'b'.repeat(64):'a'.repeat(64),spawn:(exe,args,opts)=>{calls.push({exe,args,opts});const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;},...overrides};
  return {service:createInstallations(base),calls};
}
test('only pinned executable plus application archive and matching metadata can launch, with no shell',async()=>{
  const {service,calls}=fixture();const list=await service.getClients();assert.equal(list.find(c=>c.id==='world').canLaunch,true);assert.equal(JSON.stringify(list).includes('/Applications'),false);
  assert.deepEqual(await service.launch('world'),{ok:true});assert.equal(calls.length,1);assert.deepEqual(calls[0].args,[]);assert.equal(calls[0].opts.shell,false);
  assert.equal((await service.launch('C:/cmd.exe')).code,'UNKNOWN_CLIENT');assert.equal(calls.length,1);
});
test('missing release, missing install, tampered bytes, wrong app identity and symlink outside root never launch',async()=>{
  const cases=[{releases:[]},{realpath:async()=>{throw Object.assign(Error(),{code:'ENOENT'});}},{hash:async()=> 'c'.repeat(64)},{readFile:async()=>JSON.stringify({clientId:'messenger'})},{realpath:async p=>p.endsWith('SYNKWorld')?'/tmp/evil':p}];
  for(const overrides of cases){const {service,calls}=fixture(overrides);assert.equal((await service.launch('world')).ok,false);assert.equal(calls.length,0);}
});
test('WORLD and Messenger cannot become launchers, and spawn failures are visible',async()=>{
  assert.equal((await fixture({clientId:'messenger'}).service.launch('world')).code,'LAUNCHER_ONLY');
  const {service}=fixture({spawn:()=>{const child=new EventEmitter();queueMicrotask(()=>child.emit('error',Error('synthetic')));return child;}});assert.equal((await service.launch('world')).code,'LAUNCH_FAILED');
});
test('cross-client navigation never reuses desktop session; only fixed web previews leave in a browser',()=>{
  const p='http://127.0.0.1:4280/synk-account/platform.html',w='http://127.0.0.1:4280/synk-account/client.html?product=world';
  assert.equal(allowedNavigation(w,p,'platform'),false);assert.equal(allowedNavigation(p,w,'world'),false);
  assert.equal(allowedNavigation(w.replace('world','platform'),w,'world'),false);assert.equal(allowedNavigation('http://127.0.0.1:4280/korean-racing/',w,'world'),true);
  assert.equal(externalDestination('http://127.0.0.1:4280/learning-hub/?injected=1',p,'platform','development'),'http://127.0.0.1:4280/learning-hub/');
  assert.equal(externalDestination('file:///C:/malware.exe',p,'platform','development'),null);assert.equal(externalDestination('https://evil.invalid/',p,'platform','release'),null);
});
test('JSON exports allow known filenames from own origin while executable downloads and overlarge exports stay blocked',()=>{
  const entry='http://127.0.0.1:4280/synk-account/platform.html',request={entry,sourceUrl:entry,clientId:'platform',url:'blob:http://127.0.0.1:4280/synthetic',mime:'application/json',filename:'synk-platform-device-settings.json',size:500};
  assert.equal(allowedDownload(request),true);
  for(const bad of [{mime:'application/octet-stream'},{filename:'payload.exe'},{size:33554433},{url:'blob:https://evil.invalid/synthetic'},{sourceUrl:'http://127.0.0.1:4280/korean-racing/'}])assert.equal(allowedDownload({...request,...bad}),false);
});

test('platform can open only the exact public care entry without sharing its native session',()=>{
  const entry='synk-desktop://platform/index.html';
  for(const mode of ['development','release'])assert.equal(externalDestination('https://synk.im/care/',entry,'platform',mode),'https://synk.im/care/');
  for(const clientId of ['world','messenger'])assert.equal(externalDestination('https://synk.im/care/',entry,clientId,'release'),null);
  for(const url of ['http://synk.im/care/','https://synk.im/care/?token=secret','https://synk.im/care/#token','https://user:secret@synk.im/care/','https://synk.im.evil.invalid/care/','https://synk.im/care/other','https://synk.im/care/../id/','https://synk.im:444/care/'])assert.equal(externalDestination(url,entry,'platform','release'),null,url);
  assert.equal(allowedNavigation('https://synk.im/care/',entry,'platform'),false);
});
test('CSP allows same-origin game frames and the exact Three import map while top-level embedding stays blocked',()=>{
  assert.match(contentSecurityPolicy('mainFrame'),/frame-ancestors 'none'/);assert.match(contentSecurityPolicy('subFrame'),/frame-ancestors 'self'/);
  const importMap=require('node:fs').readFileSync(path.resolve(__dirname,'../../experiences/korean-racing/index.html'),'utf8').match(/<script type="importmap">([^<]+)<\/script>/)[1];
  const hash=require('node:crypto').createHash('sha256').update(importMap).digest('base64');assert.ok(contentSecurityPolicy('subFrame').includes("'sha256-"+hash+"'"));
  assert.doesNotMatch(contentSecurityPolicy('subFrame'),/script-src[^;]*unsafe-inline/);
});
test('installation directory is derived from the real Electron Builder and NSIS naming contract',()=>{
  const {AppInfo}=require('app-builder-lib/out/appInfo'),{getWindowsInstallationDirName}=require('app-builder-lib/out/targets/targetUtil');
  for(const mode of ['development','release'])for(const id of Object.keys(CLIENTS)){
    const config=configFor(id,{mode,platform:'win32',arch:'x64'}),appInfo=new AppInfo({config,metadata:{name:'synk-'+id,version:'0.1.0',author:{name:'SYNK'}}});
    const win=installationPaths(id,{platform:'win32',mode,programRoot:'C:\\Programs'}),mac=installationPaths(id,{platform:'darwin',mode,programRoot:'/Applications'});
    assert.equal(path.win32.basename(win.root),getWindowsInstallationDirName(appInfo,true));assert.equal(path.posix.basename(mac.root),appInfo.productFilename+'.app');
  }
});
test('approved icon derivatives have valid ICO/ICNS headers and are wired to every package',()=>{
  const fs=require('node:fs');for(const id of Object.keys(CLIENTS)){
    const ico=fs.readFileSync(path.resolve(__dirname,'../assets',id+'.ico')),icns=fs.readFileSync(path.resolve(__dirname,'../assets',id+'.icns'));assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),7);assert.equal(icns.subarray(0,4).toString(),'icns');assert.equal(icns.readUInt32BE(4),icns.length);
    const config=configFor(id);assert.equal(path.basename(config.win.icon),id+'.ico');assert.equal(path.basename(config.mac.icon),id+'.icns');
  }
});

test('Messenger permits only workroom TXT on its company document with bounded bytes',()=>{
  const entry='http://127.0.0.1:4191/?tab=messenger',request={entry,sourceUrl:'http://127.0.0.1:4191/?tab=workroom&section=practice',clientId:'messenger',url:'blob:http://127.0.0.1:4191/synthetic',mime:'text/plain;charset=utf-8',filename:'synk-shift-practice.txt',size:65536};
  assert.equal(allowedDownload(request),true);assert.equal(allowedDownload({...request,sourceUrl:entry}),true);
  for(const bad of [{clientId:'world'},{clientId:'platform'},{mime:'application/json'},{mime:'application/octet-stream'},{filename:'export.txt'},{filename:'../synk-shift-practice.txt'},{size:65537},{size:-1},{size:NaN},{url:'blob:http://127.0.0.1:4293/synthetic'},{url:'https://127.0.0.1:4191/file.txt'},{sourceUrl:'http://127.0.0.1:4191/api/me'},{sourceUrl:'http://127.0.0.1:4191/company-messenger/'},{sourceUrl:'http://user@127.0.0.1:4191/'}])assert.equal(allowedDownload({...request,...bad}),false,JSON.stringify(bad));
});
