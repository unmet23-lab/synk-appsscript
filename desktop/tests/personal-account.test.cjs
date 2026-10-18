'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {configuration}=require('../src/auth-config.cjs');
const {requestSpec}=require('../src/account-requests.cjs');
const {createPersonalBroker,bindPersonalIPC}=require('../src/personal-account.cjs');
const {PRODUCT_PREVIEWS}=require('../src/product-preview.cjs');
const accountId='11111111-1111-4111-8111-111111111111';
function fixture(){const calls=[],auth={accountRequest:async(operation,params)=>{calls.push({operation,params});return {ok:true,scope:'synk-personal',resource:'path',accountId,revision:0,state:null};}};return {calls,auth,broker:createPersonalBroker({auth,resource:'path'})};}
test('PATH keeps its existing isolated OAuth callback; retired clients are refused',()=>{
  const raw={version:1,supabaseUrl:'https://synthetic.supabase.co',supabasePublishableKey:'sb_publishable_synthetic',clients:{path:{clientId:'public-path',redirectUri:'http://127.0.0.1:43829/synk/oauth/path/callback'}}};
  const selected=configuration(raw,'path','development');assert.equal(selected.product,'platform');assert.equal(selected.clientKey,'path');
  for(const id of ['rehearsal','family-album'])assert.throws(()=>configuration({...raw,clients:{...raw.clients,[id]:raw.clients.path}},id,'development'));
});
test('personal request scopes keep PATH and CAS bounds while retired resources and media operations are refused',()=>{
  assert.deepEqual(requestSpec('personalLoad',{},'1','platform','path'),{path:'synk-personal?resource=path'});
  const input={expected_revision:3,state:{version:1,sample:[]}},spec=requestSpec('personalSave',input,'1','platform','path');input.state.sample.push('late');assert.deepEqual(spec.body.state,{version:1,sample:[]});
  for(const resource of ['rehearsal','family-album']){assert.throws(()=>requestSpec('personalLoad',{},'1','platform',resource));assert.throws(()=>createPersonalBroker({auth:{},resource}));}
  for(const operation of ['personalAssetPrepare','personalAssetConfirm','personalAssetRead','personalAssetDelete'])assert.throws(()=>requestSpec(operation,{},'1','platform','path'));
  assert.throws(()=>requestSpec('personalDelete',{expected_revision:-1},'1','platform','path'));
  assert.throws(()=>requestSpec('personalSave',{expected_revision:0,state:{text:'x'.repeat(65536)}},'1','platform','path'));
});
test('removed media bridge operations never reach account dispatch',async()=>{
  const f=fixture();for(const op of ['assetUpload','assetRead','assetDelete','revokeAll'])assert.equal((await f.broker.request(op,{})).error.code,'INVALID_REQUEST');assert.equal(f.calls.length,0);
  assert.equal((await f.broker.request('personalLoad')).ok,true);f.broker.dispose();assert.equal((await f.broker.request('personalLoad')).ok,false);assert.equal(f.calls.length,1);
});
test('personal IPC still checks the owning window and main frame before dispatch',async()=>{
  const f=fixture(),handlers=new Map(),frame={url:PRODUCT_PREVIEWS.path.entry},webContents={mainFrame:frame},window={webContents,isDestroyed:()=>false};
  const unbind=bindPersonalIPC({ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)},getWindow:()=>window,auth:f.auth,resource:'path'});
  const handler=handlers.get('synk-personal:request'),trusted={sender:webContents,senderFrame:frame};assert.equal((await handler(trusted,'personalLoad',{})).ok,true);
  for(const event of [{sender:{},senderFrame:frame},{sender:webContents,senderFrame:{url:frame.url}}])await assert.rejects(handler(event,'personalLoad',{}),/UNTRUSTED_SENDER/);
  frame.url=PRODUCT_PREVIEWS.care.entry;await assert.rejects(handler(trusted,'personalLoad',{}),/UNTRUSTED_SENDER/);assert.equal(f.calls.length,1);unbind();assert.equal(handlers.size,0);
});
test('personal preload retains a fixed bridge without token getters',()=>{
  const exposed={},calls=[];vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/personal-preload.cjs'),'utf8'),{require:name=>({contextBridge:{exposeInMainWorld:(key,value)=>{exposed[key]=value;}},ipcRenderer:{invoke:(...args)=>calls.push(args),on(){},removeListener(){}}})});
  assert.ok(Object.isFrozen(exposed.synkPersonalAccount));assert.deepEqual(Object.keys(exposed.synkPersonalAccount).sort(),['getEnvironment','authStatus','authSignIn','authSignOut','request','onAuthChanged'].sort());
});
