'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {PRODUCT_PREVIEWS,productDownload,createProductDownloadHandler,previewAccountAllowed,productBrowserDestination}=require('../src/product-preview.cjs');

test('member benefit clients have fixed independent identities and cannot borrow each other rights',()=>{
  const state={status:'signed-in',signedIn:true,account:{synk_user_id:'synthetic'},library:{status:'ready',appIds:['rehearsal']}};
  assert.equal(PRODUCT_PREVIEWS.rehearsal.sessionScope,'im.synk.rehearsal.preview');assert.equal(productBrowserDestination('rehearsal'),'http://127.0.0.1:4297/');
  assert.equal(PRODUCT_PREVIEWS['family-album'].sessionScope,'im.synk.family-album.preview');assert.equal(productBrowserDestination('family-album'),'http://127.0.0.1:4298/');
  assert.equal(previewAccountAllowed('rehearsal',state),true);assert.equal(previewAccountAllowed('family-album',state),false);assert.equal(previewAccountAllowed('care',state),false);
});

test('family album export permits only bounded exact own-origin JSON from its own app document',()=>{
  const base={id:'family-album',url:'blob:http://127.0.0.1:4298/synthetic',mime:'application/json',filename:'synk-family-album.json',size:32*1024*1024,sourceUrl:'http://127.0.0.1:4298/'};
  assert.equal(productDownload(base).maxBytes,32*1024*1024);
  for(const patch of [{id:'rehearsal'},{id:'care'},{filename:'synk-care.json'},{filename:'../synk-family-album.json'},{mime:'text/json'},{size:32*1024*1024+1},{size:NaN},{size:-1},{size:1.5},{sourceUrl:'http://127.0.0.1:4298/?account=x'},{sourceUrl:'http://127.0.0.1:4297/'},{url:'blob:http://127.0.0.1:4297/synthetic'},{url:'http://127.0.0.1:4298/export.json'},{url:'blob:http://user@127.0.0.1:4298/synthetic'}])assert.equal(productDownload({...base,...patch}),false,JSON.stringify(patch));
});

test('family album download refuses foreign windows and cancels an oversized growing stream',()=>{
  const source={getURL:()=>PRODUCT_PREVIEWS['family-album'].entry},window={webContents:source,isDestroyed:()=>false},saved=[],denied=[];
  const handler=createProductDownloadHandler({id:'family-album',getWindow:()=>window,configureSave:(_item,spec)=>saved.push(spec),onDenied:reason=>denied.push(reason)});
  let received=100,cancelled=false,prevented=0;
  const item=Object.assign(new EventEmitter(),{getURL:()=> 'blob:http://127.0.0.1:4298/synthetic',getMimeType:()=> 'application/json',getFilename:()=> 'synk-family-album.json',getTotalBytes:()=>100,getReceivedBytes:()=>received,cancel:()=>{cancelled=true;}});
  const event={preventDefault:()=>prevented++};handler(event,item,{});assert.equal(prevented,1);assert.equal(saved.length,0);
  handler(event,item,source);assert.equal(saved.length,1);received=32*1024*1024+1;item.emit('updated');assert.equal(cancelled,true);assert.deepEqual(denied,['type','size']);
});

test('rehearsal export permits only its own fixed JSON filename and 500000-byte limit',()=>{
  const base={id:'rehearsal',url:'blob:http://127.0.0.1:4297/synthetic',mime:'application/json',filename:'synk-rehearsal.json',size:500000,sourceUrl:'http://127.0.0.1:4297/'};
  assert.equal(productDownload(base).maxBytes,500000);
  for(const patch of [{id:'care'},{id:'family-album'},{filename:'synk-rehearsal-2026-10-05.json'},{filename:'synk-family-album.json'},{mime:'text/plain'},{size:500001},{size:-1},{size:NaN},{sourceUrl:'http://127.0.0.1:4297/nested/'},{url:'blob:http://127.0.0.1:4298/synthetic'}])assert.equal(productDownload({...base,...patch}),false,JSON.stringify(patch));
});

test('take-home files use exact own-product names, types and finite byte limits',()=>{
  for(const [id,port,filename,mime,maxBytes] of [
    ['family-album',4298,'synk-family-album.zip','application/zip',64*1024*1024],
    ['rehearsal',4297,'synk-rehearsal-book.html','text/html',2*1024*1024],
  ]){
    const base={id,url:`blob:http://127.0.0.1:${port}/synthetic`,mime,filename,size:maxBytes,sourceUrl:`http://127.0.0.1:${port}/#takehome`};
    assert.equal(productDownload(base).maxBytes,maxBytes);
    for(const patch of [{size:maxBytes+1},{size:Infinity},{size:NaN},{filename:'../'+filename},{filename:'constructor'},{filename:'__proto__'},{mime:'application/octet-stream'},{id:id==='rehearsal'?'family-album':'rehearsal'},{url:'blob:https://example.com/synthetic'},{sourceUrl:`http://127.0.0.1:${port}/?unsafe=1`}])assert.equal(productDownload({...base,...patch}),false,JSON.stringify(patch));
  }
});

test('take-home archive growing past its allowance is cancelled without allowing other origins',()=>{
  const source={getURL:()=>PRODUCT_PREVIEWS['family-album'].entry},window={webContents:source,isDestroyed:()=>false};
  let received=100,cancelled=false,saved=0;
  const item=Object.assign(new EventEmitter(),{getURL:()=> 'blob:http://127.0.0.1:4298/synthetic',getMimeType:()=> 'application/zip',getFilename:()=> 'synk-family-album.zip',getTotalBytes:()=>100,getReceivedBytes:()=>received,cancel:()=>{cancelled=true;}});
  const handler=createProductDownloadHandler({id:'family-album',getWindow:()=>window,configureSave:()=>saved++});
  handler({preventDefault:()=>assert.fail('valid archive refused')},item,source);
  assert.equal(saved,1);received=64*1024*1024+1;item.emit('updated');assert.equal(cancelled,true);
});

test('local member benefits remain personalizable without creating unrelated access',async()=>{
  const {createPlatformPersonalization}=await import('../renderer/personalization.mjs'),engine=require('../../atlas/personalization'),map=new Map();
  const host=createPlatformPersonalization(engine,{getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
  host.save({context:'everyday',goal:'prepare',textSize:'standard',explanation:'standard',motion:'full',consent:true});
  for(const id of ['fortune','rehearsal','family-album']){const state=host.current({appIds:[id]});assert.equal(state.active,true);assert.equal(state.error,null);assert.deepEqual(state.order,[id]);assert.equal(state.selected,id);}
});
