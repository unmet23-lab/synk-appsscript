'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {PRODUCT_PREVIEWS,productDownload,createProductDownloadHandler,previewAccountAllowed,productBrowserDestination,createProductBrowser}=require('../src/product-preview.cjs');
const origin='http://127.0.0.1:4296/',ics={id:'care',url:'blob:'+origin+'synthetic',mime:'text/calendar',filename:'synk-care.ics',size:100,sourceUrl:origin};
test('care uses an isolated identity and exact fixed browser entry',async()=>{
  assert.equal(PRODUCT_PREVIEWS.care.sessionScope,'im.synk.care.preview');assert.equal(PRODUCT_PREVIEWS.care.entry,origin);
  assert.equal(productBrowserDestination('care'),origin);
  const calls=[];await createProductBrowser({id:'care',openExternal:async url=>calls.push(url)})('https://ignored.invalid/');assert.deepEqual(calls,[origin]);
  const allowed={status:'signed-in',signedIn:true,account:{synk_user_id:'synthetic'},library:{status:'ready',appIds:['care']}};
  assert.equal(previewAccountAllowed('care',allowed),true);assert.equal(previewAccountAllowed('path',allowed),false);
});
test('care exports permit only bounded own-origin ICS and JSON files from the fixed document',()=>{
  assert.equal(productDownload(ics).extension,'ics');
  assert.equal(productDownload({...ics,mime:'application/json',filename:'synk-care.json',size:4*1024*1024}).extension,'json');
  assert.equal(productDownload({...ics,mime:'image/png',filename:'synk-care-memory.png',size:20*1024*1024}).extension,'png');
  assert.equal(productDownload({...ics,mime:'image/png',filename:'synk-care-memory.png',size:20*1024*1024+1}),false);
  assert.equal(productDownload({...ics,mime:'image/svg+xml',filename:'synk-care-memory.png',size:100}),false);
  for(const change of [{id:'path'},{url:origin+'export.ics'},{url:'blob:http://127.0.0.1:4292/test'},{sourceUrl:origin+'api/state'},{sourceUrl:origin+'?user=x'},{mime:'text/plain'},{filename:'other.ics'},{filename:'../synk-care.ics'},{size:1024*1024+1},{size:-1},{size:NaN},{size:null}])assert.equal(productDownload({...ics,...change}),false);
});
test('care download handler rejects sibling windows and cancels streams above the bound',()=>{
  const source={getURL:()=>origin},window={webContents:source,isDestroyed:()=>false},saved=[],denied=[];
  const handler=createProductDownloadHandler({id:'care',getWindow:()=>window,configureSave:(item,spec)=>saved.push(spec),onDenied:reason=>denied.push(reason)});
  let received=100,cancelled=false,prevented=0;
  const item=Object.assign(new EventEmitter(),{getURL:()=>ics.url,getMimeType:()=>ics.mime,getFilename:()=>ics.filename,getTotalBytes:()=>100,getReceivedBytes:()=>received,cancel:()=>{cancelled=true;}});
  const event={preventDefault:()=>prevented++};handler(event,item,{});assert.equal(prevented,1);assert.equal(saved.length,0);
  handler(event,item,source);assert.equal(saved.length,1);received=1024*1024+1;item.emit('updated');assert.equal(cancelled,true);assert.deepEqual(denied,['type','size']);
});
test('care is a local MVP with capability checks, personalizable without unrelated access',async()=>{
  const {primaryAction,matchesLibrary}=await import('../renderer/state.mjs'),{resolveLibrary}=await import('../renderer/library.mjs');
  assert.equal(matchesLibrary('care',{search:'경조사'}),true);
  assert.equal(primaryAction({id:'care',canLaunch:true}).disabled,true);
  assert.equal(primaryAction({id:'care'},{productPreviewsAvailable:['path']}).disabled,true);
  assert.deepEqual(primaryAction({id:'care'},{productPreviewsAvailable:['care']}),{label:'플레저 MVP 열기',action:'product-preview',disabled:false});
  assert.deepEqual(resolveLibrary({status:'signed-in',signedIn:true,account:{synk_user_id:'care-user'},library:{status:'ready',appIds:['care','unknown']}}).appIds,['care']);
  const {createPlatformPersonalization}=await import('../renderer/personalization.mjs'),engine=require('../../atlas/personalization'),map=new Map();
  const host=createPlatformPersonalization(engine,{getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
  host.save({context:'everyday',goal:'prepare',textSize:'standard',explanation:'standard',motion:'full',consent:true});
  const state=host.current({appIds:['care']});assert.equal(state.active,true);assert.equal(state.selected,'care');assert.equal(state.error,null);assert.deepEqual(state.order,['care']);
});
