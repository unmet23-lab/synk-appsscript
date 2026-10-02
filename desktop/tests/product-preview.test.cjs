'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {PRODUCT_PREVIEWS,product,productPreviewAvailable,previewAccountAllowed,createProductPreviews,productDocument,productResource,productPolicy,assertProductSender,productBrowserDestination,productDownload,createProductBrowser}=require('../src/product-preview.cjs');
const {CLIENTS,identity}=require('../src/catalog.cjs');
const allowed={status:'signed-in',signedIn:true,account:{synk_user_id:'synthetic-staff'},library:{status:'ready',appIds:['path']}};
function fixture(overrides={}){const calls=[],options={packaged:false,mode:'development',clientId:'platform',executable:'C:\\fixed\\electron.exe',appRoot:path.resolve(__dirname,'..'),accountStatus:()=>allowed,spawn:(exe,args,opts)=>{calls.push({exe,args,opts});const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;},...overrides};return {calls,options,service:createProductPreviews(options)};}
test('PATH preview retains its separate profile from installed clients',()=>{
  assert.deepEqual(Object.keys(PRODUCT_PREVIEWS),['path']);
  assert.equal(PRODUCT_PREVIEWS.path.entry,'http://127.0.0.1:4292/');assert.equal(product('shift'),null);
  const scopes=Object.values(PRODUCT_PREVIEWS).map(p=>p.sessionScope);
  scopes.push(...Object.keys(CLIENTS).flatMap(id=>['development','release'].map(mode=>identity(id,mode).sessionScope)));
  assert.equal(scopes.length,new Set(scopes).size);
  assert.equal(product('__proto__'),null);assert.equal(product('teacher'),null);
});
test('only development platform starts fixed PATH process without shell or caller URL',async()=>{
  const {service,calls,options}=fixture();assert.deepEqual(service.available(),['path']);
  for(const id of ['path'])assert.deepEqual(await service.open(id),{ok:true,preview:true,separateClient:true,clientId:id});
  for(const [index,id]of ['path'].entries()){assert.equal(calls[index].exe,options.executable);assert.deepEqual(calls[index].args,[path.join(options.appRoot,'src','product-main.cjs'),'--synk-product-preview='+id]);assert.equal(calls[index].opts.shell,false);assert.equal(calls[index].opts.detached,true);}
  for(const id of ['shift','studio','world','teacher','path --inspect','../main.cjs','https://evil.invalid/',{id:'path'},null])assert.equal((await service.open(id)).code,'UNKNOWN_PREVIEW');
  assert.equal(calls.length,1);
  for(const change of [{packaged:true},{packaged:null},{mode:'release'},{clientId:'world'},{clientId:'messenger'},{clientId:'path'}]){const denied=fixture(change);assert.deepEqual(denied.service.available(),[]);assert.equal((await denied.service.open('path')).code,'PREVIEW_DEVELOPMENT_ONLY');assert.equal(denied.calls.length,0);}
  assert.equal(productPreviewAvailable({packaged:false,mode:'development',clientId:'platform'}),true);
});
test('platform menu grants are checked again in main and unrelated or missing account rights cannot spawn',async()=>{
  assert.equal(previewAccountAllowed('path',allowed),true);
  const cases=[null,{}, {...allowed,signedIn:false},{...allowed,status:'restoring'},{...allowed,account:null},{...allowed,library:{status:'unavailable',appIds:['path']}},{...allowed,library:{status:'ready',appIds:['teacher','world']}},{...allowed,library:{status:'ready',appIds:'path'}},{...allowed,library:null}];
  for(const snapshot of cases){const denied=fixture({accountStatus:()=>snapshot});assert.equal((await denied.service.open('path')).code,'PREVIEW_NOT_IN_LIBRARY');assert.equal(denied.calls.length,0);}
  let snapshot=allowed;const f=fixture({accountStatus:()=>snapshot});await f.service.open('path');snapshot={...allowed,library:{status:'ready',appIds:['shift']}};assert.equal((await f.service.open('path')).code,'PREVIEW_NOT_IN_LIBRARY');assert.equal((await f.service.open('shift')).code,'UNKNOWN_PREVIEW');assert.equal(f.calls.length,1);
});
test('repeated PATH clicks share a launch and errors allow retry',async()=>{
  const children=[];const f=fixture({spawn:(exe,args,opts)=>{f.calls.push({exe,args,opts});const child=new EventEmitter();child.unref=()=>{};children.push(child);return child;}});
  const first=f.service.open('path'),duplicate=f.service.open('path');assert.equal(first,duplicate);assert.equal(f.calls.length,1);assert.equal((await f.service.open('shift')).code,'UNKNOWN_PREVIEW');
  children[0].emit('error',Error('synthetic'));assert.equal((await first).code,'PREVIEW_LAUNCH_FAILED');
  const retry=f.service.open('path');children[1].emit('spawn');assert.equal((await retry).ok,true);
  const sync=fixture({spawn:()=>{throw Error('synthetic');}});assert.equal((await sync.service.open('path')).code,'PREVIEW_LAUNCH_FAILED');assert.equal((await sync.service.open('path')).code,'PREVIEW_LAUNCH_FAILED');
});
test('navigation and network stay inside the owning fixed product origin',()=>{
  for(const id of ['path']){
    const entry=PRODUCT_PREVIEWS[id].entry;
    for(const url of [entry,entry+'index.html',entry+'#work'])assert.equal(productDocument(id,url),true);
    for(const url of [entry+'?product=world',entry+'api/state',entry+'nested/index.html','http://127.0.0.1:4280/','http://127.0.0.1:4191/','http://127.0.0.1:4290/','http://127.0.0.1:4292.evil.invalid/','https://127.0.0.1:4292/','file:///local.txt','javascript:alert(1)'])assert.equal(productDocument(id,url),false,url);
    assert.equal(productResource(id,entry+'api/state'),true);assert.equal(productResource(id,entry+'vendor/three.module.js'),true);
    assert.equal(productResource(id,entry.replace('127.0.0.1','user@127.0.0.1')),false);
  }
  assert.equal(productResource('path','http://127.0.0.1:4293/'),false);assert.equal(productResource('shift',PRODUCT_PREVIEWS.path.entry),false);
  for(const url of ['https://external.invalid/','ws://127.0.0.1:4292/','file:///local.txt'])assert.equal(productResource('path',url),false);
  assert.match(productPolicy(),/connect-src 'self'/);assert.match(productPolicy(),/frame-src 'none'/);assert.doesNotMatch(productPolicy(),/script-src[^;]*unsafe-inline/);
});
test('product IPC refuses sibling windows, child frames and cross-product documents',()=>{
  for(const id of ['path']){
    const frame={url:PRODUCT_PREVIEWS[id].entry},webContents={mainFrame:frame},window={webContents,isDestroyed:()=>false},event={sender:webContents,senderFrame:frame};
    assert.doesNotThrow(()=>assertProductSender(event,window,id));
    for(const bad of [{...event,sender:{}},{...event,senderFrame:{url:frame.url}},{...event,senderFrame:null}])assert.throws(()=>assertProductSender(bad,window,id),/UNTRUSTED_SENDER/);
    assert.throws(()=>assertProductSender(event,{...window,isDestroyed:()=>true},id),/UNTRUSTED_SENDER/);
    frame.url='http://127.0.0.1:4293/';assert.throws(()=>assertProductSender(event,window,id),/UNTRUSTED_SENDER/);
  }
});
function preload(file){let bridge,name;const calls=[];vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src',file),'utf8'),{require:module=>{assert.equal(module,'electron');return {contextBridge:{exposeInMainWorld:(n,v)=>{name=n;bridge=v;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {ok:true};}}};}});return {bridge,name,calls};}
test('platform preload only forwards PATH and rejects retired SHIFT',async()=>{
  const p=preload('preload.cjs');assert.equal(p.name,'synkDesktop');await p.bridge.openProductPreview('path');
  for(const id of ['shift','studio','../main.cjs','teacher','https://evil.invalid/',{id:'path'}])assert.equal((await p.bridge.openProductPreview(id)).code,'UNKNOWN_PREVIEW');
  assert.deepEqual(p.calls,[['synk:product-preview','path']]);
});
test('product preload has only metadata and the argument-free browser action',async()=>{
  const p=preload('product-preload.cjs');assert.equal(p.name,'synkProduct');assert.deepEqual(Object.keys(p.bridge).sort(),['authStatus','getEnvironment','openInBrowser']);assert.equal(Object.isFrozen(p.bridge),true);
  await p.bridge.getEnvironment();await p.bridge.authStatus();await p.bridge.openInBrowser('https://evil.invalid/');assert.deepEqual(p.calls,[['synk-product:environment'],['synk-product:auth-status'],['synk-product:open-browser']]);
});
test('only PATH opens its fixed VR browser URL; repeated calls and failures stay bounded',async()=>{
  assert.equal(productBrowserDestination('path'),'http://127.0.0.1:4292/');assert.equal(productBrowserDestination('shift'),null);
  const calls=[];let clock=1000,resolve;const open=createProductBrowser({id:'path',now:()=>clock,openExternal:url=>{calls.push(url);return new Promise(r=>{resolve=r;});}});
  const first=open('https://evil.invalid/'),second=open();assert.equal(first,second);assert.deepEqual(calls,['http://127.0.0.1:4292/']);resolve();assert.equal((await first).ok,true);assert.equal((await open()).code,'BROWSER_RETRY_LATER');
  clock+=1500;const next=open();resolve();assert.equal((await next).ok,true);assert.equal(calls.length,2);
  assert.equal((await createProductBrowser({id:'shift',openExternal:()=>assert.fail('must not open')})()).code,'BROWSER_UNAVAILABLE');
  assert.equal((await createProductBrowser({id:'path',enabled:false,openExternal:()=>assert.fail('must not open')})()).code,'BROWSER_UNAVAILABLE');
  const failure=createProductBrowser({id:'path',openExternal:async()=>{throw Error('synthetic');}});assert.equal((await failure()).code,'BROWSER_OPEN_FAILED');assert.equal((await failure()).code,'BROWSER_OPEN_FAILED');
});
test('product previews no longer accept downloads from retired SHIFT or PATH',()=>{
  for(const id of ['shift','path'])assert.equal(productDownload({id,url:'blob:http://127.0.0.1:4293/synthetic',mime:'text/plain',filename:'synk-shift-practice.txt',size:128,sourceUrl:'http://127.0.0.1:4293/'}),false);
});
