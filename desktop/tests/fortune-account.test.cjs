'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {configuration}=require('../src/auth-config.cjs');
const {requestSpec}=require('../src/account-requests.cjs');
const {PRODUCT_PREVIEWS,fortuneAccountRequest,bindFortuneIPC,sendFortuneAuth,productDownload,createProductDownloadHandler}=require('../src/product-preview.cjs');
const initial={version:1,profile:null,preferences:{mode:'western',signId:null},entries:[]};
const raw={version:1,supabaseUrl:'https://synthetic.invalid',supabasePublishableKey:'sb_publishable_synthetic',clients:{platform:{clientId:'platform-only',redirectUri:'http://127.0.0.1:43821/synk/oauth/platform/callback'},fortune:{clientId:'fortune-only',redirectUri:'http://127.0.0.1:43825/synk/oauth/fortune/callback'}}};

test('fortune has its own OAuth client and vault fingerprint in the platform API product',()=>{
  const fortune=configuration(raw,'fortune','development'),platform=configuration(raw,'platform','development');
  assert.equal(fortune.product,'platform');assert.equal(fortune.clientKey,'fortune');assert.equal(fortune.clientId,'fortune-only');assert.equal(fortune.redirectUri,'http://127.0.0.1:43825/synk/oauth/fortune/callback');
  assert.notEqual(fortune.fingerprint,platform.fingerprint);assert.equal(PRODUCT_PREVIEWS.fortune.sessionScope,'im.synk.fortune.preview');
  for(const clients of [{platform:raw.clients.platform},{...raw.clients,fortune:{...raw.clients.fortune,clientId:'platform-only'}},{...raw.clients,fortune:{...raw.clients.fortune,redirectUri:raw.clients.platform.redirectUri}}])assert.throws(()=>configuration({...raw,clients},'fortune','development'),{code:'AUTH_CONFIG_INVALID'});
});

test('fortune account requests use fixed routes, exact outer keys, revision and a 64 KiB UTF-8 body limit',()=>{
  assert.deepEqual(requestSpec('fortuneGet',{},'0.2.0','platform'),{path:'synk-fortune'});
  assert.deepEqual(requestSpec('fortunePut',{expected_revision:0,state:initial},'0.2.0','platform'),{path:'synk-fortune',body:{action:'save',expected_revision:0,state:initial}});
  assert.deepEqual(requestSpec('fortuneDelete',{expected_revision:3},'0.2.0','platform'),{path:'synk-fortune',body:{action:'delete',expected_revision:3}});
  const invalid=[['fortuneGet',{accountId:'other'}],['fortuneGet',{url:'https://external.invalid'}],['fortunePut',{expected_revision:-1,state:initial}],['fortunePut',{expected_revision:0,state:initial,headers:{Authorization:'forged'}}],['fortunePut',{expected_revision:0,state:{...initial,owner:'other'}}],['fortunePut',{expected_revision:0,state:{...initial,entries:Array(91).fill({})}}],['fortunePut',{expected_revision:0,state:{...initial,entries:[{note:'가'.repeat(23000)}]}}],['fortunePut',{expected_revision:0,state:{...initial,profile:[]}}],['fortunePut',{expected_revision:0,state:{...initial,entries:[undefined]}}],['fortunePut',{expected_revision:0,state:{...initial,entries:[{note:Infinity}]}}],['fortuneDelete',{expected_revision:1,action:'save'}],['fortuneDelete',{expected_revision:1,state:initial}],['fortuneDelete',{expected_revision:'1'}]];
  for(const [operation,params]of invalid)assert.throws(()=>requestSpec(operation,params,'0.2.0','platform'),{code:'INVALID_REQUEST'},operation);
  for(const product of ['world','messenger','teacher','fortune',undefined])for(const [op,params]of [['fortuneGet',{}],['fortunePut',{expected_revision:0,state:initial}],['fortuneDelete',{expected_revision:0}]])assert.throws(()=>requestSpec(op,params,'0.2.0',product),{code:'INVALID_REQUEST'});
});

test('fortune broker exposes only account load and its own stored-state operations',async()=>{
  const calls=[],auth={accountRequest:async(...args)=>{calls.push(args);return {ok:true};}};
  for(const operation of ['load','fortuneGet','fortunePut','fortuneDelete'])assert.equal((await fortuneAccountRequest(auth,operation)).ok,true);
  const count=calls.length;
  for(const operation of ['release','updateProfile','setLearning','learningGet','memoryGet','memoryPost','atlasSummary','revokeAll','requestDeletion','exportPage','classroom','companyRequest','fetch','__proto__'])assert.equal((await fortuneAccountRequest(auth,operation)).error.code,'INVALID_REQUEST');
  assert.equal(calls.length,count);
});

test('fortune IPC verifies owning window, exact document and top-level frame before dispatch',async()=>{
  const handlers=new Map(),ipcMain={removeHandler:name=>handlers.delete(name),handle:(name,fn)=>handlers.set(name,fn)};
  const frame={url:PRODUCT_PREVIEWS.fortune.entry},sent=[],contents={mainFrame:frame,getURL:()=>frame.url,send:(...args)=>sent.push(args)},window={webContents:contents,isDestroyed:()=>false};
  const calls=[],auth={status:()=>({signedIn:true}),signIn:async()=>({status:'signing-in'}),cancel:async()=>({status:'signed-out'}),signOut:async()=>({ok:true}),accountRequest:async(...args)=>{calls.push(args);return {ok:true};}};
  const unbind=bindFortuneIPC({ipcMain,getWindow:()=>window,auth}),good={sender:contents,senderFrame:frame};
  const request=handlers.get('synk-fortune:request');assert.equal((await request(good,'fortuneGet',{})).ok,true);
  for(const event of [{...good,sender:{}},{...good,senderFrame:{url:frame.url}},{...good,senderFrame:null}])await assert.rejects(request(event,'fortuneGet'),/UNTRUSTED_SENDER/);
  frame.url=PRODUCT_PREVIEWS.care.entry;await assert.rejects(request(good,'fortuneGet'),/UNTRUSTED_SENDER/);sendFortuneAuth(window,{signedIn:true});assert.equal(sent.length,0);
  frame.url=PRODUCT_PREVIEWS.fortune.entry+'?account=other';await assert.rejects(request(good,'fortuneGet'),/UNTRUSTED_SENDER/);
  frame.url=PRODUCT_PREVIEWS.fortune.entry;sendFortuneAuth(window,{signedIn:true});assert.deepEqual(sent,[['synk-fortune:auth-changed',{signedIn:true}]]);assert.equal(calls.length,1);
  assert.deepEqual(await handlers.get('synk-fortune:auth-status')(good),{signedIn:true});assert.deepEqual(await handlers.get('synk-fortune:auth-sign-in')(good),{status:'signing-in'});assert.deepEqual(await handlers.get('synk-fortune:auth-cancel')(good),{status:'signed-out'});assert.deepEqual(await handlers.get('synk-fortune:auth-sign-out')(good),{ok:true});
  unbind();assert.equal(handlers.size,0);
});

test('only the main-authorized fortune preload gets a token-free request and auth-change bridge',async()=>{
  function preload(argv){const exposed={},calls=[],listeners=new Map();vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/product-preload.cjs'),'utf8'),{process:{argv},require:name=>{assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld:(name,value)=>{exposed[name]=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return{ok:true};},on:(name,fn)=>listeners.set(name,fn),removeListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}}};}});return{exposed,calls,listeners};}
  assert.deepEqual(Object.keys(preload([]).exposed),['synkProduct']);
  const p=preload(['--synk-fortune-account']),bridge=p.exposed.synkFortuneAccount;
  assert.deepEqual(Object.keys(bridge).sort(),['authCancelSignIn','authSignIn','authSignOut','authStatus','onAuthChanged','request']);assert.equal(Object.isFrozen(bridge),true);
  await bridge.authStatus();await bridge.authSignIn();await bridge.authCancelSignIn();await bridge.authSignOut();await bridge.request('fortuneGet',{});
  assert.deepEqual(p.calls.map(call=>call[0]),['synk-fortune:auth-status','synk-fortune:auth-sign-in','synk-fortune:auth-cancel','synk-fortune:auth-sign-out','synk-fortune:request']);
  let observed;const unsubscribe=bridge.onAuthChanged(value=>{observed=value;}),state={signedIn:true};p.listeners.get('synk-fortune:auth-changed')({secret:'not exposed'},state);assert.equal(observed,state);unsubscribe();assert.equal(p.listeners.size,0);assert.throws(()=>bridge.onAuthChanged(null),/callback/);
});

test('fortune exports only its exact own JSON file and cancels streams that grow beyond 128 KiB',()=>{
  const valid={id:'fortune',url:'blob:http://127.0.0.1:4299/synthetic',mime:'application/json',filename:'synk-fortune.json',size:128*1024,sourceUrl:PRODUCT_PREVIEWS.fortune.entry};
  assert.deepEqual(productDownload(valid),{extension:'json',filterName:'운세 보관함',maxBytes:128*1024});
  for(const change of [{filename:'other.json'},{filename:'synk-fortune.html'},{mime:'text/plain'},{size:128*1024+1},{size:-1},{url:'https://external.invalid/synk-fortune.json'},{url:'blob:http://127.0.0.1:4296/synthetic'},{sourceUrl:PRODUCT_PREVIEWS.care.entry},{sourceUrl:PRODUCT_PREVIEWS.fortune.entry+'?injected=1'}])assert.equal(productDownload({...valid,...change}),false);
  let updated,cancelled=false,saved=false;const contents={getURL:()=>valid.sourceUrl},window={webContents:contents,isDestroyed:()=>false};
  const item={getURL:()=>valid.url,getMimeType:()=>valid.mime,getFilename:()=>valid.filename,getTotalBytes:()=>128,getReceivedBytes:()=>128*1024+1,on:(event,fn)=>{if(event==='updated')updated=fn;},cancel:()=>{cancelled=true;}};
  const handler=createProductDownloadHandler({id:'fortune',getWindow:()=>window,configureSave:()=>{saved=true;}});
  handler({preventDefault:()=>assert.fail('Valid own export must be offered')},item,contents);assert.equal(saved,true);updated();assert.equal(cancelled,true);
  let denied=false;handler({preventDefault:()=>{denied=true;}},item,{getURL:()=>valid.sourceUrl});assert.equal(denied,true);
});
