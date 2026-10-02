'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {companySessionAllowed,createDownloadHandler}=require('../src/downloads.cjs');
const entry='http://127.0.0.1:4191/?tab=messenger';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({user={id:'synthetic-member',active:true},fetch,sourceUrl=entry,...values}={}){
  let received=0,total=128,paused=false,cancelled=false,resumed=false,configured=0,prevented=false;
  const denied=[],requests=[],source={getURL:()=>sourceUrl,isDestroyed:()=>false},window={webContents:source,isDestroyed:()=>false},session={fetch:fetch||(async(url,options)=>{requests.push({url,options});return {ok:true,text:async()=>JSON.stringify({user})};})};
  const item=Object.assign(new EventEmitter(),{getURL:()=>values.url||'blob:http://127.0.0.1:4191/synthetic',getMimeType:()=>values.mime||'text/plain;charset=utf-8',getFilename:()=>values.filename||'synk-shift-practice.txt',getTotalBytes:()=>total,getReceivedBytes:()=>received,getState:()=>cancelled?'cancelled':'progressing',pause(){paused=true;},resume(){resumed=true;},cancel(){cancelled=true;}});
  const handler=createDownloadHandler({getWindow:()=>window,session,entry,clientId:'messenger',configureSave(){configured++;},onDenied:reason=>denied.push(reason)});
  return {item,window,source,requests,denied,start:()=>handler({preventDefault(){prevented=true;}},item,source),snapshot:()=>({paused,cancelled,resumed,configured,prevented}),grow(n){received=n;item.emit('updated');}};
}
test('workroom text waits for the owning company cookie session before resuming',async()=>{
  let resolve;const f=fixture({fetch:()=>new Promise(done=>{resolve=done;})});f.start();assert.deepEqual(f.snapshot(),{paused:true,cancelled:false,resumed:false,configured:1,prevented:false});
  resolve({ok:true,text:async()=>JSON.stringify({user:{id:'synthetic-member'}})});await settle();assert.equal(f.snapshot().resumed,true);assert.deepEqual(f.denied,[]);
  const normal=fixture();normal.start();await settle();assert.equal(normal.requests[0].url,'http://127.0.0.1:4191/api/me');assert.equal(normal.requests[0].options.credentials,'include');assert.equal(normal.requests[0].options.redirect,'error');
});
test('anonymous, disabled, malformed or failed company sessions cancel workroom exports',async()=>{
  for(const options of [{user:null},{user:{id:'',active:true}},{user:{id:'synthetic-member',active:false}},{fetch:async()=>({ok:false})},{fetch:async()=>{throw Error('offline');}},{fetch:async()=>({ok:true,text:async()=>'{bad'})}]){const f=fixture(options);f.start();await settle();assert.equal(f.snapshot().cancelled,true);assert.equal(f.snapshot().resumed,false);assert.deepEqual(f.denied,['session']);}
  assert.equal(await companySessionAllowed({fetch:async()=>({ok:true,text:async()=>'x'.repeat(65537)})},entry),false);
});
test('navigation while authentication is pending cancels the original export',async()=>{
  let resolve;const f=fixture({fetch:()=>new Promise(done=>{resolve=done;})});f.start();f.source.getURL=()=>entry+'&changed=1';resolve({ok:true,text:async()=>JSON.stringify({user:{id:'synthetic-member'}})});await settle();assert.equal(f.snapshot().cancelled,true);assert.equal(f.snapshot().resumed,false);
});
test('foreign files are rejected before save, and growing payloads cannot exceed 64 KiB',async()=>{
  const bad=fixture({filename:'malware.exe'});bad.start();assert.equal(bad.snapshot().prevented,true);assert.equal(bad.snapshot().configured,0);assert.equal(bad.requests.length,0);
  const f=fixture();f.start();await settle();f.grow(65537);assert.equal(f.snapshot().cancelled,true);assert.deepEqual(f.denied,['size']);
});

