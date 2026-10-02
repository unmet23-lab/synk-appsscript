'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {PLATFORM_ENTRY,DEV_URLS}=require('../src/catalog.cjs');
const {safeEntry,trustedEntry,assertSender,allowedNavigation,nativeContentSecurityPolicy}=require('../src/security.cjs');
const {createNativeContent}=require('../src/native-content.cjs');
test('native platform uses its own exact bundled entry and never grants IPC to web or sibling custom origins',()=>{
  assert.equal(DEV_URLS.platform,PLATFORM_ENTRY);
  for(const mode of ['development','release'])assert.equal(safeEntry(PLATFORM_ENTRY,mode),true);
  assert.equal(trustedEntry(PLATFORM_ENTRY+'#library',PLATFORM_ENTRY,'platform'),true);
  const invalid=['synk-desktop://platform.evil/index.html','synk-desktop://world/index.html','synk-desktop://platform/assets/index.html','synk-desktop://user@platform/index.html','synk-desktop://platform/index.html?product=world','file:///index.html','http://127.0.0.1:4280/synk-account/platform.html'];
  for(const url of invalid){assert.equal(trustedEntry(url,PLATFORM_ENTRY,'platform'),false,url);assert.equal(allowedNavigation(url,PLATFORM_ENTRY,'platform'),false,url);}
  assert.equal(trustedEntry(PLATFORM_ENTRY,PLATFORM_ENTRY,'world'),false);
  const frame={url:PLATFORM_ENTRY},webContents={mainFrame:frame},window={webContents,isDestroyed:()=>false};
  assert.doesNotThrow(()=>assertSender({sender:webContents,senderFrame:frame},window,PLATFORM_ENTRY,'platform'));
  assert.throws(()=>assertSender({sender:webContents,senderFrame:{url:PLATFORM_ENTRY}},window,PLATFORM_ENTRY,'platform'),/UNTRUSTED_SENDER/);
  assert.match(nativeContentSecurityPolicy(),/connect-src 'none'/);assert.match(nativeContentSecurityPolicy(),/frame-src 'none'/);
});
test('native protocol serves only presentation assets with MIME and CSP and blocks main files, foreign hosts and path tricks',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'synk-native-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'renderer'),{recursive:true});await fs.mkdir(path.join(root,'assets','launcher'),{recursive:true});await fs.mkdir(path.join(root,'src'));
  await fs.writeFile(path.join(root,'renderer','index.html'),'<h1>SYNK Platform</h1>');await fs.writeFile(path.join(root,'renderer','launcher.mjs'),'export const ready=true;');await fs.writeFile(path.join(root,'assets','launcher','mark.svg'),'<svg/>');await fs.writeFile(path.join(root,'src','main.cjs'),'secret-main');
  const serve=createNativeContent({appRoot:root});
  const page=await serve(PLATFORM_ENTRY);assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/^text\/html/);assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(await page.text(),'<h1>SYNK Platform</h1>');
  assert.equal((await serve('synk-desktop://platform/launcher.mjs')).headers.get('content-type'),'text/javascript; charset=utf-8');
  assert.equal((await serve('synk-desktop://platform/assets/launcher/mark.svg')).status,200);
  for(const value of ['synk-desktop://world/index.html','synk-desktop://user@platform/index.html','synk-desktop://platform/index.html?injected=1','synk-desktop://platform/src/main.cjs','synk-desktop://platform/%2e%2e/src/main.cjs','synk-desktop://platform/%252e%252e/src/main.cjs','synk-desktop://platform/assets/..%5c..%5csrc/main.cjs','synk-desktop://platform/assets/sources.json','file:///C:/Windows/System32/cmd.exe'])assert.equal((await serve(value)).status,404,value);
  assert.equal((await serve({url:PLATFORM_ENTRY,method:'POST'})).status,405);
});
test('native protocol rejects asset symlink resolutions escaping their packaged directory',async()=>{
  const root=path.resolve('synthetic-root'),serve=createNativeContent({appRoot:root,readFile:async()=>Buffer.from('should not read'),realpath:async file=>file.endsWith('escape.svg')?path.resolve('outside.svg'):file});
  assert.equal((await serve('synk-desktop://platform/assets/escape.svg')).status,404);
});
