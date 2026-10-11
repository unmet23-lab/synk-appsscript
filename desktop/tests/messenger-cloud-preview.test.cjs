'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const {DEV_URLS,PLATFORM_ENTRY,MESSENGER_CLOUD_PREVIEW_ENTRY:entry,identity}=require('../src/catalog.cjs');
const {safeEntry,allowedNavigation,trustedEntry,assertSender,externalDestination}=require('../src/security.cjs');
const {createConnectionContent}=require('../src/connection-content.cjs');
const {createCompanyRequests}=require('../src/company-requests.cjs');
const {configuration}=require('../src/auth-config.cjs');
const {configFor,parseOptions,previewEntry}=require('../tools/package.cjs');
const enabled={clientId:'messenger',messengerCloudPreview:true};

test('cloud entry needs the exact Messenger development opt-in; other targets stay closed',()=>{
  assert.equal(safeEntry(entry,'development',enabled),true);
  for(const value of [undefined,false,'true',1,null])assert.equal(safeEntry(entry,'development',{clientId:'messenger',messengerCloudPreview:value}),false);
  for(const clientId of ['world','platform',undefined])assert.equal(safeEntry(entry,'development',{clientId,messengerCloudPreview:true}),false);
  assert.equal(safeEntry(entry,'release',enabled),false);
  for(const url of ['https://workspace.synk.im/','https://workspace.synk.im/?tab=workroom','https://workspace.synk.im/?tab=messenger#x','https://workspace.synk.im:443/?tab=messenger','https://workspace.synk.im:8443/?tab=messenger','http://workspace.synk.im/?tab=messenger','https://workspace.synk.im.evil.invalid/?tab=messenger','https://user@workspace.synk.im/?tab=messenger','https://workspace.synk.im/?tab=messenger&next=https://evil.invalid','https://workspace.synk.im/api/me',DEV_URLS.messenger,DEV_URLS.world,PLATFORM_ENTRY])assert.equal(safeEntry(url,'development',enabled),false,url);
  for(const [clientId,url] of Object.entries(DEV_URLS))assert.equal(safeEntry(url,'development',{clientId}),true);
  assert.equal(safeEntry('https://other.example.org/','release'),true);
});

test('CLI opt-in is explicit, rejects missing or wrong client/mode and arbitrary values',()=>{
  const parsed=parseOptions(['--client=messenger','--mode=development','--platform=win32','--arch=x64','--messenger-cloud-preview=true']);
  assert.equal(parsed.messengerCloudPreview,true);assert.equal(previewEntry('messenger',parsed),entry);
  for(const args of [['--messenger-cloud-preview=true'],['--client=world','--messenger-cloud-preview=true'],['--client=platform','--messenger-cloud-preview=true'],['--client=messenger','--mode=release','--messenger-cloud-preview=true'],['--client=messenger','--messenger-cloud-preview=https://evil.invalid/'],['--client=messenger','--messenger-cloud-preview=false']])assert.throws(()=>parseOptions(args),/Use --client=messenger/);
  for(const id of ['world','platform'])assert.throws(()=>previewEntry(id,{mode:'development',messengerCloudPreview:true}),/restricted/);
  assert.throws(()=>previewEntry('messenger',{mode:'release',messengerCloudPreview:true}),/restricted/);
  for(const id of ['world','platform','messenger'])assert.equal(previewEntry(id,{mode:'development'}),DEV_URLS[id]);
});

test('Preview identity and ad-hoc Mac development stay separate from mandatory publisher-signed release',()=>{
  for(const platform of ['win32','darwin']){
    const preview=configFor('messenger',{mode:'development',platform,messengerCloudPreview:true});
    assert.equal(preview.appId,'im.synk.messenger.preview');assert.equal(preview.executableName,'SYNKMessengerPreview');assert.equal(preview.forceCodeSigning,false);assert.equal(preview.win.signExecutable,false);assert.equal(preview.mac.identity,'-');assert.equal(preview.mac.hardenedRuntime,false);assert.equal(preview.publish,null);assert.equal(preview.nsis.runAfterFinish,false);assert.equal(preview.nsis.deleteAppDataOnUninstall,false);
    const release=configFor('messenger',{mode:'release',platform});assert.equal(release.forceCodeSigning,true);assert.equal(release.win.signExecutable,true);assert.equal(release.appId,'im.synk.messenger');
  }
  assert.equal(identity('messenger','development').sessionScope,'im.synk.messenger.preview');
});

const authFixture={version:1,supabaseUrl:'https://identity.example.org',accountApiUrl:'https://identity.example.org',supabasePublishableKey:'sb_publishable_synthetic',clients:{messenger:{clientId:'native-messenger-fixture',redirectUri:'http://127.0.0.1:43823/synk/oauth/messenger/callback'}}};
function packageHarness(){
  const file=path.resolve(__dirname,'../tools/package.cjs'),ownRequire=createRequire(file),writes=new Map(),operations=[];
  const mockFs={...fs,readFileSync:(p,...args)=>p==='synthetic-auth.json'?JSON.stringify(authFixture):fs.readFileSync(p,...args),rmSync:p=>operations.push(['remove-stage',p]),mkdirSync:p=>operations.push(['mkdir-stage',p]),cpSync:(a,b)=>operations.push(['copy-stage',a,b]),writeFileSync:(p,b)=>writes.set(p,b)};
  const module={exports:{}};
  const req=id=>id==='node:fs'?mockFs:id==='electron-builder'?{build:()=>{throw Error('Packaging execution is forbidden in this test');}}:id==='./source-hash.cjs'?{sourceHash:()=> 'f'.repeat(64)}:ownRequire(id);
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:req,module,exports:module.exports,__dirname:path.dirname(file),process,console,Buffer},{filename:file});
  return {...module.exports,writes,operations};
}
test('package preparation writes the exact entry and runtime opt-in with unchanged native auth',()=>{
  const h=packageHarness(),options={mode:'development',platform:'win32',arch:'x64',messengerCloudPreview:true,authConfig:'synthetic-auth.json'};
  const config=h.prepare('messenger',options),runtime=JSON.parse(h.writes.get(path.join(config.directories.app,'runtime.json'))),metadata=JSON.parse(h.writes.get(path.join(config.directories.app,'synk-install.json')));
  assert.equal(runtime.entry,entry);assert.equal(runtime.messengerCloudPreview,true);assert.equal(runtime.clientId,'messenger');assert.equal(runtime.mode,'development');assert.deepEqual(runtime.auth,authFixture);assert.equal(metadata.appId,'im.synk.messenger.preview');assert.equal(metadata.mode,'development');
  assert.equal(configuration(runtime.auth,'messenger','development').fingerprint,configuration(authFixture,'messenger','development').fingerprint);
  const legacy=packageHarness(),oldConfig=legacy.prepare('messenger',{mode:'development',platform:'win32',arch:'x64'}),oldRuntime=JSON.parse(legacy.writes.get(path.join(oldConfig.directories.app,'runtime.json')));assert.equal(oldRuntime.entry,DEV_URLS.messenger);assert.equal(Object.hasOwn(oldRuntime,'messengerCloudPreview'),false);
});
test('wrong client and release cloud flags reject before staging or signed release fallback',()=>{
  for(const [id,mode] of [['world','development'],['platform','development'],['messenger','release']]){const h=packageHarness();assert.throws(()=>h.prepare(id,{mode,platform:'win32',arch:'x64',messengerCloudPreview:true}),/restricted/);assert.equal(h.operations.length,0);assert.equal(h.writes.size,0);}
  const h=packageHarness();assert.throws(()=>h.prepare('messenger',{mode:'release',platform:'win32',arch:'x64'}),/not configured/);assert.equal(h.operations.length,0);
});

test('cloud retry page uses fixed HTTPS destination and internet guidance without gaining IPC',async()=>{
  const options={appRoot:path.resolve(__dirname,'..'),clientId:'messenger',mode:'development',entry,messengerCloudPreview:true},serve=createConnectionContent(options),response=await serve('synk-desktop://status/'),html=await response.text();
  assert.equal(response.status,200);assert.ok(html.includes('href="'+entry+'"'));assert.match(html,/인터넷 연결/);assert.doesNotMatch(html,/이 기기의 앱 서비스|<script|onclick=/);assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
  assert.throws(()=>createConnectionContent({...options,messengerCloudPreview:false}),/Invalid connection entry/);
  assert.equal(trustedEntry('synk-desktop://status/',entry,'messenger'),false);
});

test('cloud company navigation and IPC remain confined to the company root document',()=>{
  const same='https://workspace.synk.im/?tab=workroom&section=clients';assert.equal(allowedNavigation(same,entry,'messenger'),true);assert.equal(trustedEntry(same,entry,'messenger'),true);
  const frame={url:same},contents={mainFrame:frame},window={webContents:contents,isDestroyed:()=>false};assert.doesNotThrow(()=>assertSender({sender:contents,senderFrame:frame},window,entry,'messenger'));
  for(const url of ['https://workspace.synk.im/api/synk-id/callback?code=synthetic','https://workspace.synk.im/id/','https://identity.example.org/auth/v1/oauth/authorize','http://127.0.0.1:4191/?tab=messenger','https://workspace.synk.im.evil.invalid/']){assert.equal(allowedNavigation(url,entry,'messenger'),false,url);assert.equal(trustedEntry(url,entry,'messenger'),false,url);assert.equal(externalDestination(url,entry,'messenger','development'),null,url);}
  assert.throws(()=>assertSender({sender:contents,senderFrame:{url:same}},window,entry,'messenger'),/UNTRUSTED_SENDER/);
});

test('native company requests use the HTTPS origin and same cookie session without browser OAuth navigation',async()=>{
  const calls=[],session={fetch:async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>JSON.stringify({ok:true,enabled:true})};}},auth={getAccessToken:async()=> 'synthetic-native-token'};
  const request=createCompanyRequests({entry,clientId:'messenger',session,auth});await request('status');await request('exchange',{challenge:'synthetic-challenge',confirm:true});
  assert.equal(calls[0].url,'https://workspace.synk.im/api/synk-id/status');assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.headers.Origin,'https://workspace.synk.im');assert.equal(calls[0].options.credentials,'include');assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[1].url,'https://workspace.synk.im/api/synk-id/exchange');assert.equal(calls[1].options.headers.Authorization,'Bearer synthetic-native-token');assert.equal(calls[1].options.credentials,'include');
});
