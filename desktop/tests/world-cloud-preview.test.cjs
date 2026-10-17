'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const {DEV_URLS,PLATFORM_ENTRY,WORLD_CLOUD_PREVIEW_ENTRY:entry,WORLD_ACCOUNT_ENTRY:accountEntry}=require('../src/catalog.cjs');
const {safeEntry,allowedNavigation,trustedEntry,assertSender,externalDestination,downloadSpec,contentSecurityPolicy}=require('../src/security.cjs');
const {createConnectionContent}=require('../src/connection-content.cjs');
const {configFor,parseOptions,previewEntry}=require('../tools/package.cjs');
const enabled={clientId:'world',worldCloudPreview:true};

test('WORLD HTTPS Preview requires its explicit flag, exact tutor home URL and development identity',()=>{
  assert.equal(safeEntry(entry,'development',enabled),true);
  for(const worldCloudPreview of [undefined,false,'true',1,null])assert.equal(safeEntry(entry,'development',{clientId:'world',worldCloudPreview}),false);
  for(const clientId of ['platform','messenger',undefined])assert.equal(safeEntry(entry,'development',{clientId,worldCloudPreview:true}),false);
  assert.equal(safeEntry(entry,'release',enabled),false);
  for(const messengerCloudPreview of [true,'true',1,null])assert.equal(safeEntry(entry,'development',{...enabled,messengerCloudPreview}),false);
  for(const value of [accountEntry,'https://synk.im/world/mobile.html','https://synk.im/account/client.html?product=platform',entry+'?play=learning-hub',entry+'#x',entry.replace('synk.im','synk.im:443'),entry.replace('synk.im','user@synk.im'),entry.replace('synk.im','synk.im.evil.invalid'),entry.replace('https:','http:'),DEV_URLS.world,PLATFORM_ENTRY])assert.equal(safeEntry(value,'development',enabled),false,value);
  assert.equal(safeEntry(DEV_URLS.world,'development',{clientId:'world'}),true);
  assert.equal(safeEntry('https://release.example.org/','release'),true);
});

test('public game navigation permits named games but never grants game or subframe account IPC',()=>{
  const frame={url:entry},contents={mainFrame:frame},window={webContents:contents,isDestroyed:()=>false};
  assert.doesNotThrow(()=>assertSender({sender:contents,senderFrame:frame},window,entry,'world'));
  for(const slug of ['learning-hub','racing','runner','rhythm','order-rush','entry-check','story-classroom','blank-slice','talk-rally','word-magic','spaceship-coop']){
    for(const suffix of ['/','/index.html','/?assignment=synthetic']){
      const value='https://synk.im/try/'+slug+suffix;assert.equal(allowedNavigation(value,entry,'world'),true,value);assert.equal(trustedEntry(value,entry,'world'),false);
      assert.throws(()=>assertSender({sender:contents,senderFrame:{url:value}},window,entry,'world'),/UNTRUSTED_SENDER/);
    }
  }
  for(const value of ['https://synk.im/try/unknown/','https://synk.im/try/runner/private.html','https://synk.im/learning-hub/','https://synk.im/account/platform.html','https://synk.im/id/','https://evil.invalid/try/learning-hub/',DEV_URLS.world,entry+'&code=synthetic',entry+'&product=platform'])assert.equal(allowedNavigation(value,entry,'world'),false,value);
  for(const page of ['/try/order-rush/beginner.html','/try/learning-hub/collection.html']){
    const value='https://synk.im'+page;assert.equal(allowedNavigation(value,entry,'world'),true);assert.equal(trustedEntry(value,entry,'world'),false);
    assert.equal(allowedNavigation(value,DEV_URLS.world,'world'),false);
    for(const bad of [value+'/','https://evil.invalid'+page,value.replace('.html','-other.html'),value.replace('/try/','/private/')])assert.equal(allowedNavigation(bad,entry,'world'),false,bad);
  }
  assert.throws(()=>assertSender({sender:contents,senderFrame:{url:entry}},window,entry,'world'),/UNTRUSTED_SENDER/);
  assert.match(contentSecurityPolicy('subFrame'),/frame-src 'self'/);
  assert.match(contentSecurityPolicy('subFrame'),/frame-ancestors 'self'/);
});

test('tutor home stays native while ID links leave only at fixed canonical destinations',()=>{
  assert.equal(externalDestination(entry,entry,'world','development'),null);
  assert.equal(externalDestination(entry,DEV_URLS.world,'world','development'),entry);
  for(const page of ['platform.html','index.html'])assert.equal(externalDestination('https://synk.im/account/'+page+'?token=synthetic#home',entry,'world','development'),'https://synk.im/account/'+page);
  for(const value of ['https://synk.im/account/client.html?product=platform','https://synk.im/account/unknown.html','https://synk.im/world/?token=synthetic','https://evil.invalid/account/platform.html','https://user@synk.im/account/index.html'])assert.equal(externalDestination(value,entry,'world','development'),null,value);
  assert.equal(externalDestination('https://synk.im/account/platform.html',DEV_URLS.world,'world','development'),null);
  const request={url:'blob:https://synk.im/synthetic',sourceUrl:entry,entry,clientId:'world',mime:'application/json',filename:'synk-connected-learning.json',size:100};
  assert.equal(downloadSpec(request).maxBytes,33554432);
  assert.equal(downloadSpec({...request,sourceUrl:'https://synk.im/account/platform.html'}),null);
  assert.equal(downloadSpec({...request,url:'blob:https://evil.invalid/synthetic'}),null);
});

test('returning from public games accepts one named play intent and rejects polluted query values',()=>{
  for(const play of ['learning-hub','korean-racing','korean-runner','korean-rhythm','order-rush','entry-check','story-classroom','blank-slice']){
    const value=accountEntry+'&play='+play;assert.equal(trustedEntry(value,entry,'world'),true);assert.equal(allowedNavigation(value,entry,'world'),true);
    const frame={url:value},contents={mainFrame:frame},window={webContents:contents,isDestroyed:()=>false};assert.doesNotThrow(()=>assertSender({sender:contents,senderFrame:frame},window,entry,'world'));
  }
  for(const suffix of ['&play=','&play=unknown','&play=https://evil.invalid','&play=../world','&play=learning-hub&play=learning-hub','&play=learning-hub&product=world','&play=learning-hub&code=synthetic','&play=learning-hub&next=https://evil.invalid']){assert.equal(trustedEntry(accountEntry+suffix,entry,'world'),false,suffix);assert.equal(allowedNavigation(accountEntry+suffix,entry,'world'),false,suffix);}
  assert.equal(trustedEntry(DEV_URLS.world+'&play=learning-hub',DEV_URLS.world,'world'),false);
});

test('native tutor trust covers exact home variants and denies polluted or game-frame senders',()=>{
  for(const page of ['','index.html','mobile.html','desktop.html'])for(const query of ['','?opening=off','?opening=replay&tutor=choose','?cafe=1','?wardrobe=1']){
    const url=entry+page+query;assert.equal(trustedEntry(url,entry,'world'),true,url);assert.equal(allowedNavigation(url,entry,'world'),true,url);
  }
  for(const suffix of ['?code=secret','?next=evil','?opening=off&opening=off','?tutor=other','?cafe=2','#callback','/','private.html','korean-runner/index.html'])assert.equal(trustedEntry(entry+suffix,entry,'world'),false,suffix);
  for(const slug of ['korean-runner','korean-rhythm','hangul-stage','town'])for(const ending of ['/','/index.html']){
    const url=entry+slug+ending;assert.equal(allowedNavigation(url,entry,'world'),true);assert.equal(trustedEntry(url,entry,'world'),false);
  }
  assert.doesNotMatch(contentSecurityPolicy('mainFrame').split(';').find(part=>part.trim().startsWith('script-src')),/unsafe-inline|unsafe-eval/);
});

test('WORLD cloud retry preserves the exact HTTPS entry and gives internet guidance',async()=>{
  const options={appRoot:path.resolve(__dirname,'..'),mode:'development',entry,...enabled};
  const response=await createConnectionContent(options)('synk-desktop://status/'),html=await response.text();
  assert.equal(response.status,200);assert.ok(html.includes('href="'+entry+'"'));assert.match(html,/인터넷 연결/);assert.doesNotMatch(html,/이 기기의 앱 서비스|<script|onclick=/);
  assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
  assert.equal(trustedEntry('synk-desktop://status/',entry,'world'),false);
  for(const override of [{worldCloudPreview:false},{worldCloudPreview:'true'},{clientId:'messenger'},{mode:'release'},{messengerCloudPreview:true},{entry:entry+'&next=evil'}])assert.throws(()=>createConnectionContent({...options,...override}),/Invalid connection entry/);
  assert.throws(()=>createConnectionContent({...options,clientId:'messenger',messengerCloudPreview:true,entry:'https://workspace.synk.im/?tab=teaching'}),/Invalid connection entry/);
});

test('WORLD CLI flag cannot select other clients, signed releases or arbitrary URLs',()=>{
  const args=['--client=world','--mode=development','--platform=win32','--arch=x64','--world-cloud-preview=true'];
  const options=parseOptions(args);assert.equal(options.worldCloudPreview,true);assert.equal(previewEntry('world',options),entry);
  for(const values of [['--world-cloud-preview=true'],['--client=messenger','--world-cloud-preview=true'],['--client=platform','--world-cloud-preview=true'],['--client=world','--mode=release','--world-cloud-preview=true'],['--client=world','--world-cloud-preview=false'],['--client=world','--world-cloud-preview=https://evil.invalid/'],['--client=messenger','--world-cloud-preview=true','--messenger-cloud-preview=true']].map(values=>[...values,'--platform=win32']))assert.throws(()=>parseOptions(values),/Use --client=world/); // explicit target: the default is the host OS, and Linux is not a build target
  for(const clientId of ['platform','messenger'])assert.throws(()=>previewEntry(clientId,{mode:'development',worldCloudPreview:true}),/restricted/);
  assert.throws(()=>previewEntry('world',{mode:'release',worldCloudPreview:true}),/restricted/);
  assert.throws(()=>previewEntry('world',{mode:'development',worldCloudPreview:true,messengerCloudPreview:true}),/restricted/);
  assert.equal(previewEntry('world',{mode:'development'}),DEV_URLS.world);
  const preview=configFor('world',options);assert.equal(preview.forceCodeSigning,false);assert.equal(preview.appId,'im.synk.world.preview');assert.equal(preview.nsis.deleteAppDataOnUninstall,false);assert.equal(preview.nsis.runAfterFinish,false);
  assert.equal(configFor('world',{mode:'release'}).forceCodeSigning,true);
});

function packageHarness(){
  const file=path.resolve(__dirname,'../tools/package.cjs'),ownRequire=createRequire(file),writes=new Map(),operations=[];
  const mockFs={...fs,rmSync:p=>operations.push(['remove-stage',p]),mkdirSync:p=>operations.push(['mkdir-stage',p]),cpSync:(a,b)=>operations.push(['copy-stage',a,b]),writeFileSync:(p,b)=>writes.set(p,b)};
  const module={exports:{}};
  const req=id=>id==='node:fs'?mockFs:id==='electron-builder'?{build:()=>{throw Error('No actual package build in test');}}:id==='./source-hash.cjs'?{sourceHash:()=> 'f'.repeat(64)}:ownRequire(id);
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:req,module,exports:module.exports,__dirname:path.dirname(file),process,console,Buffer},{filename:file});
  return {...module.exports,writes,operations};
}
test('package preparation records WORLD opt-in without modifying legacy local runtime',()=>{
  const h=packageHarness(),c=h.prepare('world',{mode:'development',platform:'win32',arch:'x64',worldCloudPreview:true}),runtime=JSON.parse(h.writes.get(path.join(c.directories.app,'runtime.json')));
  assert.equal(runtime.entry,entry);assert.equal(runtime.worldCloudPreview,true);assert.equal(runtime.clientId,'world');assert.equal(runtime.mode,'development');assert.equal(Object.hasOwn(runtime,'messengerCloudPreview'),false);
  const old=packageHarness(),legacy=old.prepare('world',{mode:'development',platform:'win32',arch:'x64'}),local=JSON.parse(old.writes.get(path.join(legacy.directories.app,'runtime.json')));assert.equal(local.entry,DEV_URLS.world);assert.equal(Object.hasOwn(local,'worldCloudPreview'),false);
  for(const [id,mode]of [['platform','development'],['messenger','development'],['world','release']]){const invalid=packageHarness();assert.throws(()=>invalid.prepare(id,{mode,platform:'win32',arch:'x64',worldCloudPreview:true}),/restricted/);assert.equal(invalid.operations.length,0);}
});
