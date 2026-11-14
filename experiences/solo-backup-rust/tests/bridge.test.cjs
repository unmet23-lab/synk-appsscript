'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function load(tauri){const context={window:{__TAURI__:tauri},setTimeout};vm.runInNewContext(fs.readFileSync(path.join(root,'bridge/bridge.js'),'utf8'),context);return context.window.backup;}
test('bridge preserves argument values and both result envelopes',async()=>{
  const received=[];const api=load({core:{invoke:async(name,args)=>{received.push({name,...args});return {ok:true,value:7};}}});
  assert.equal(Object.isFrozen(api),true);
  assert.deepEqual(await api.setAutomatic(false),{ok:true,value:7});
  assert.equal(received[0].name,'backup_call');assert.equal(received[0].method,'setAutomatic');assert.deepEqual(Array.from(received[0].args),[false]);
  assert.equal(api.encrypt,undefined);assert.equal(api.spawn,undefined);assert.equal(api.boot,undefined);
  const error={ok:false,error:'fixture error',code:'CATALOG_EXPIRED'};
  assert.equal(await load({core:{invoke:async()=>error}}).getState(),error);
});
test('bridge never reveals raw transport exception or malformed responses',async()=>{
  for(const response of [null,{}, {ok:'true'}]){const out=await load({core:{invoke:async()=>response}}).getState();assert.equal(out.ok,false);}
  const out=await load({core:{invoke:async()=>{throw Error('SECRET_DO_NOT_SHOW');}}}).getState();
  assert.equal(out.ok,false);assert.ok(!JSON.stringify(out).includes('SECRET_DO_NOT_SHOW'));
});
test('awaited subscription cleanup releases once and stops late events',async()=>{
  let resolve,handler,released=0,events=0;
  const api=load({event:{listen:(_name,fn)=>{handler=fn;return new Promise(r=>{resolve=r;});}}});
  const subscribed=api.onState(()=>events++);handler({payload:1});assert.equal(events,1);
  resolve(()=>{released++;});const unsubscribe=await subscribed;
  unsubscribe();unsubscribe();handler({payload:2});await new Promise(setImmediate);
  assert.equal(events,1);assert.equal(released,1);
});
test('failed status subscription rejects so existing app activates polling fallback',async()=>{
  for(const tauri of [{},{event:{listen:()=>{throw Error('SECRET');}}},{event:{listen:async()=>{throw Error('SECRET');}}}]){
    let polling=false;
    try{await load(tauri).onState(()=>{});}catch(e){polling=true;assert.ok(!e.message.includes('SECRET'));}
    assert.equal(polling,true);
  }
});
test('bridge, worker and native method contract preserves all existing app actions',()=>{
  const contract=require('../contract/methods.json');const api=load({});
  const original=[...fs.readFileSync(path.resolve(root,'../solo-backup/src/preload.cjs'),'utf8').matchAll(/call\('([^']+)'\)/g)].map(m=>m[1]).sort();
  const expected=[...original,'previewRecommended','startRecommended','backupRecommended','restoreRecommended','addSources','removeSource'].sort();
  assert.deepEqual(Object.keys(contract).sort(),expected);
  assert.deepEqual(Object.keys(api).filter(x=>x!=='onState').sort(),expected);
  for(const name of ['backupNow','protectNow','startAutomatic','setupCloud','updateCloudCredentials','addSources','removeSource'])assert.equal(contract[name].allowedReadOnly,false);
  for(const name of ['restoreLatest','restoreSelected','openFileCatalog'])assert.equal(contract[name].allowedReadOnly,true);
});
