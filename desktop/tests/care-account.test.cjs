'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{EventEmitter}=require('node:events');
const {configuration}=require('../src/auth-config.cjs');
const {requestSpec}=require('../src/account-requests.cjs');
const {careAccountRequest,bindCareIPC,sendCareAuth}=require('../src/care-account.cjs');
const {PRODUCT_PREVIEWS,createProductPreviews}=require('../src/product-preview.cjs');
const raw={version:1,supabaseUrl:'https://synthetic.invalid',supabasePublishableKey:'sb_publishable_synthetic',clients:{platform:{clientId:'platform-only',redirectUri:'http://127.0.0.1:43821/synk/oauth/platform/callback'},care:{clientId:'care-only',redirectUri:'http://127.0.0.1:43826/synk/oauth/care/callback'}}};
const state={version:1,people:[],events:[],drafts:[],completions:[]};

test('care uses an isolated OAuth registration and fingerprint inside the existing platform product',()=>{
  const care=configuration(raw,'care','development'),platform=configuration(raw,'platform','development');
  assert.equal(care.product,'platform');assert.equal(care.clientKey,'care');assert.equal(care.clientId,'care-only');assert.notEqual(care.fingerprint,platform.fingerprint);
  assert.equal(configuration(null,'care','development'),null);
  assert.throws(()=>configuration({...raw,clients:{platform:raw.clients.platform}},'care','development'),{code:'AUTH_CONFIG_INVALID'});
  for(const changed of [{clientId:'platform-only'},{redirectUri:raw.clients.platform.redirectUri},{redirectUri:'http://localhost:43826/synk/oauth/care/callback'},{redirectUri:raw.clients.care.redirectUri+'?extra=1'}])assert.throws(()=>configuration({...raw,clients:{...raw.clients,care:{...raw.clients.care,...changed}}},'care','development'),{code:'AUTH_CONFIG_INVALID'});
});

test('care transport fixes route/action, snapshots state and preserves the CAS revision',()=>{
  assert.deepEqual(requestSpec('careLoad',{},'1.0','platform'),{path:'synk-care'});
  const input={expected_revision:4,state:structuredClone(state)},saved=requestSpec('careSave',input,'1.0','platform');
  assert.deepEqual(saved,{path:'synk-care',body:{action:'save',expected_revision:4,state}});
  input.state.people.push({name:'late renderer mutation'});assert.deepEqual(saved.body.state,state);
  assert.deepEqual(requestSpec('careDelete',{expected_revision:5},'1.0','platform'),{path:'synk-care',body:{action:'delete',expected_revision:5}});
  const extended={...state,sources:[],memories:[],activities:[],followups:[],preparations:[]};
  assert.deepEqual(requestSpec('careSave',{expected_revision:0,state:extended},'1.0','platform').body.state,extended);
  for(const [op,params,product]of [
    ['careLoad',{accountId:'another'},'platform'],['careLoad',{url:'https://untrusted.invalid'},'platform'],['careLoad',{},'world'],
    ['careSave',{expected_revision:-1,state},'platform'],['careSave',{expected_revision:0,state,action:'delete'},'platform'],
    ['careSave',{expected_revision:0,state:{...state,conversation:'private raw transcript'}},'platform'],
    ['careSave',{expected_revision:0,state:{...state,people:{}}},'platform'],
    ['careSave',{expected_revision:0,state:{...state,sources:{}}},'platform'],
    ['careSave',{expected_revision:0,state:{...state,followups:{}}},'platform'],
    ['careSave',{expected_revision:0,state:{...state,preparations:{}}},'platform'],
    ['careSave',{expected_revision:0,state:{...state,people:[{note:'x'.repeat(4*1024*1024+32768)}]}},'platform'],
    ['careSave',{expected_revision:0,state:{...state,people:[{note:NaN}]}},'platform'],
    ['careDelete',{expected_revision:'1'},'platform'],['careDelete',{expected_revision:0,accountId:'other'},'platform'],
  ])assert.throws(()=>requestSpec(op,params,'1.0',product),{code:'INVALID_REQUEST'});
});

test('care broker cannot dispatch account-wide deletion, sibling data, learning or arbitrary API calls',async()=>{
  const calls=[],auth={accountRequest:async(...args)=>{calls.push(args);return{ok:true};}};
  for(const operation of ['load','careLoad','careSave','careDelete'])assert.equal((await careAccountRequest(auth,operation)).ok,true);
  const count=calls.length;
  for(const operation of ['requestDeletion','revokeAll','updateProfile','setLearning','learningGet','memoryPost','classroom','fortuneGet','companyRequest','fetch','__proto__'])assert.equal((await careAccountRequest(auth,operation)).error.code,'INVALID_REQUEST');
  assert.equal(calls.length,count);
});

test('Care native save forwards an explicit library capability while other operations reject it',()=>{
  const library={...state,people:[{id:'fixture-person',messageLibrary:[]}]};
  const request=requestSpec('careSave',{expected_revision:2,state:library,messageLibraryVersion:1},'1.0','platform','care');
  assert.deepEqual(request,{path:'synk-care',body:{action:'save',expected_revision:2,state:library,messageLibraryVersion:1}});
  for(const version of [0,2,'1',null,undefined,true])assert.throws(()=>requestSpec('careSave',{expected_revision:2,state:library,messageLibraryVersion:version},'1.0','platform','care'),{code:'INVALID_REQUEST'});
  for(const operation of ['careLoad','careDelete'])assert.throws(()=>requestSpec(operation,{...(operation==='careDelete'?{expected_revision:2}:{}),messageLibraryVersion:1},'1.0','platform','care'),{code:'INVALID_REQUEST'});
  assert.throws(()=>requestSpec('careSave',{expected_revision:2,state:library,messageLibraryVersion:1},'1.0','world','care'),{code:'INVALID_REQUEST'});
});

test('Care native save carries both capabilities and preserves an explicit disabled checkin preference',()=>{
  const notebook={...state,people:[{id:'fixture-person',messageLibrary:[],checkinIntervalDays:0}]};
  const params={expected_revision:3,state:notebook,messageLibraryVersion:1,checkinPreferenceVersion:1};
  const request=requestSpec('careSave',params,'1.0','platform','care');
  assert.deepEqual(request,{path:'synk-care',body:{action:'save',...params}});
  notebook.people[0].checkinIntervalDays=30;
  assert.equal(request.body.state.people[0].checkinIntervalDays,0,'the main-process request snapshots the preference');
  const optional=requestSpec('careSave',{expected_revision:3,state,checkinPreferenceVersion:1},'1.0','platform','care');
  assert.equal(optional.body.checkinPreferenceVersion,1);assert.equal(Object.hasOwn(optional.body,'messageLibraryVersion'),false);
  for(const value of [0,2,-1,1.5,'1',null,undefined,true,NaN])assert.throws(()=>requestSpec('careSave',{expected_revision:3,state,checkinPreferenceVersion:value},'1.0','platform','care'),{code:'INVALID_REQUEST'});
  for(const operation of ['careLoad','careDelete'])assert.throws(()=>requestSpec(operation,{...(operation==='careDelete'?{expected_revision:3}:{}),checkinPreferenceVersion:1},'1.0','platform','care'),{code:'INVALID_REQUEST'});
  for(const client of [undefined,'platform','path','rehearsal','family-album'])assert.throws(()=>requestSpec('careSave',{expected_revision:3,state,checkinPreferenceVersion:1},'1.0','platform',client),{code:'INVALID_REQUEST'});
  assert.throws(()=>requestSpec('careSave',{expected_revision:3,state,checkinPreferenceVersion:1},'1.0','world','care'),{code:'INVALID_REQUEST'});
  assert.equal(Object.hasOwn(requestSpec('careSave',{expected_revision:3,state},'1.0','platform').body,'checkinPreferenceVersion'),false);
});

test('care IPC rejects sibling windows, child frames and different documents before dispatch',async()=>{
  const handlers=new Map(),ipcMain={removeHandler:key=>handlers.delete(key),handle:(key,fn)=>handlers.set(key,fn)};
  const frame={url:PRODUCT_PREVIEWS.care.entry},webContents={mainFrame:frame},window={webContents,isDestroyed:()=>false};
  const calls=[],auth={status:()=>({configured:false}),accountRequest:async(...args)=>{calls.push(args);return{ok:true};}};
  const unbind=bindCareIPC({ipcMain,getWindow:()=>window,auth}),request=handlers.get('synk-care:account-request');
  const trusted={sender:webContents,senderFrame:frame};assert.equal((await request(trusted,'careLoad')).ok,true);
  for(const event of [{...trusted,sender:{}},{...trusted,senderFrame:{url:frame.url}},{...trusted,senderFrame:null}])await assert.rejects(request(event,'careLoad'),/UNTRUSTED_SENDER/);
  for(const url of [PRODUCT_PREVIEWS.fortune.entry,PRODUCT_PREVIEWS.path.entry,PRODUCT_PREVIEWS.care.entry+'?account=other',PRODUCT_PREVIEWS.care.entry+'api/state']){frame.url=url;await assert.rejects(request(trusted,'careLoad'),/UNTRUSTED_SENDER/);}
  assert.equal(calls.length,1);unbind();assert.equal(handlers.size,0);
});

test('care preload exposes only named operations and auth events, with no credential getter',async()=>{
  const exposed={},calls=[],listeners=new Map();
  const ipcRenderer={invoke:async(...args)=>{calls.push(args);return{ok:true};},on:(channel,fn)=>listeners.set(channel,fn),removeListener:(channel,fn)=>{if(listeners.get(channel)===fn)listeners.delete(channel);}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/care-preload.cjs'),'utf8'),{require:name=>{assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld:(key,value)=>{exposed[key]=value;}},ipcRenderer};}});
  const bridge=exposed.synkProduct;
  assert.equal(Object.isFrozen(bridge),true);assert.deepEqual(Object.keys(bridge).sort(),['accountRequest','authCancelSignIn','authSignIn','authSignOut','authStatus','getEnvironment','onAuthChanged','openInBrowser'].sort());
  await bridge.accountRequest('careLoad',{});assert.equal(calls[0][0],'synk-care:account-request');
  let received;const stop=bridge.onAuthChanged(value=>{received=value;});listeners.get('synk-care:auth-changed')({sender:'not forwarded'},{signedIn:false});assert.deepEqual(received,{signedIn:false});stop();assert.equal(listeners.size,0);
});

test('care auth changes are sent only to the fixed trusted document',()=>{
  const calls=[],webContents={getURL:()=>PRODUCT_PREVIEWS.care.entry,send:(...args)=>calls.push(args)},window={webContents,isDestroyed:()=>false};
  sendCareAuth(window,{signedIn:false});assert.deepEqual(calls,[['synk-care:auth-changed',{signedIn:false}]]);
  webContents.getURL=()=>PRODUCT_PREVIEWS.fortune.entry;sendCareAuth(window,{signedIn:true});assert.equal(calls.length,1);
});

test('launcher passes only the public configuration path to both care and personal previews',async()=>{
  const spawned=[],scope={status:'signed-in',signedIn:true,account:{synk_user_id:'synthetic'},library:{status:'ready',appIds:['care','path']}};
  const previews=createProductPreviews({packaged:false,mode:'development',clientId:'platform',executable:'electron',appRoot:path.resolve('desktop'),authConfigPath:'synthetic-public.json',accountStatus:()=>scope,spawn:(...args)=>{spawned.push(args);const child=Object.assign(new EventEmitter(),{unref(){}});queueMicrotask(()=>child.emit('spawn'));return child;}});
  assert.equal((await previews.open('care')).ok,true);assert.equal((await previews.open('path')).ok,true);
  assert.equal(spawned[0][1].includes('--auth-config='+path.resolve('synthetic-public.json')),true);
  assert.equal(spawned[1][1].includes('--auth-config='+path.resolve('synthetic-public.json')),true);
  assert.equal(spawned[0][2].shell,false);assert.equal(spawned[0][2].windowsHide,true);
  assert.doesNotMatch(JSON.stringify(spawned),/access_token|refresh_token|Bearer/);
});
