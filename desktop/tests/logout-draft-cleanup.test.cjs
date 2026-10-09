'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {publicError}=require('../src/auth-service.cjs');

// Execute the shipped main sign-out function and IPC error adapter with the
// actual recovery clearAccount implementation. Only fs.rm is synthetic: these
// tests cannot open a profile, delete device data, or decrypt a stored draft.
const mainSource=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
const start=mainSource.indexOf('async function signOutAccount('),end=mainSource.indexOf('function sendTeachingView(',start);
assert.ok(start>=0&&end>start,'the actual main sign-out function must be exercised');
const signOutSource=mainSource.slice(start,end);
const ipcStart=mainSource.indexOf('for(const [channel,handler]of Object.entries(handlers))');
const ipcEnd=mainSource.indexOf('  unbindTeacher?.();',ipcStart);
assert.ok(ipcStart>=0&&ipcEnd>ipcStart,'the actual main IPC result adapter must be exercised');
const ipcSource=mainSource.slice(ipcStart,ipcEnd);
const recoverySource=fs.readFileSync(path.join(__dirname,'../src/draft-recovery.cjs'),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const confirmed=()=>({ok:true,status:{configured:true,signedIn:false,status:'signed-out',sessionGeneration:2},serverRevoked:true,serverSessionRevoked:true,refreshRevoked:true});
const member=(id='synthetic-owner-a',generation=1)=>({signedIn:true,status:'signed-in',sessionGeneration:generation,account:{synk_user_id:id}});

function actor({result=confirmed(),rmCode='EPERM',owner='synthetic-owner-a',recoveryAbsent=false,suiteAllowed=true,authFailure=false,authWait,rmWait}={}){
  let state=owner?member(owner):{signedIn:false,status:'signed-out',sessionGeneration:1};
  const calls=[],removed=[],directory=path.join('synthetic-no-real-data','DraftRecovery'),configFingerprint='synthetic-binding';
  const secureStorage={isEncryptionAvailable(){assert.fail('must not query OS storage');},encryptString(){assert.fail('must not encrypt');},decryptString(){assert.fail('must not decrypt');},getSelectedStorageBackend(){assert.fail('must not query OS storage keys');}};
  const mockFS={async rm(file,options){calls.push('draft-rm');assert.equal(options.force,true);assert.deepEqual(Object.keys(options),['force']);removed.push(file);if(rmWait)await rmWait.promise;if(rmCode)throw Object.assign(Error('sensitive local filename and ciphertext must not cross IPC'),{code:rmCode,path:file});}};
  const recoveryContext={module:{exports:{}},require:name=>name==='node:fs/promises'?mockFS:require(name.startsWith('./')?path.join(__dirname,'../src',name):name)};
  vm.runInNewContext(recoverySource,recoveryContext,{filename:'desktop/src/draft-recovery.cjs'});
  const recovery=recoveryContext.module.exports.createDraftRecovery({directory,safeStorage:secureStorage,getAccount:()=>state,configFingerprint,platform:'win32'});
  const context={accountStatus:()=>state,suitePublisher:{signOut(){calls.push('suite-signed-out');return suiteAllowed;}},
    auth:{async signOut(){calls.push('auth-sign-out');if(authFailure)throw Object.assign(Error('synthetic auth failure'),{code:'AUTH_FAILED'});state=result.status;if(authWait)await authWait.promise;return result;}},draftRecovery:recoveryAbsent?undefined:recovery};
  vm.createContext(context);vm.runInContext(signOutSource,context,{filename:'desktop/src/main.cjs'});
  let handler;
  Object.assign(context,{handlers:{'synk:auth-sign-out':context.signOutAccount},ipcMain:{removeHandler(){},handle(channel,value){assert.equal(channel,'synk:auth-sign-out');handler=value;}},
    assertSender(){calls.push('sender-check');},window:{},entry:'synthetic://platform/',runtime:{clientId:'platform'},publicError});
  vm.runInContext(ipcSource,context,{filename:'desktop/src/main.cjs'});
  const expectedFile=id=>path.join(directory,crypto.createHash('sha256').update(configFingerprint+'\0'+id).digest('hex')+'.enc');
  return{calls,removed,result,expectedFile,invoke:()=>handler({synthetic:true}),state:()=>state,setState:value=>{state=value;}};
}

for(const rmCode of ['EPERM','EBUSY'])test(`${rmCode}: recovery cleanup failure preserves confirmed logout and all server flags`,async()=>{
  const f=actor({rmCode}),result=await f.invoke();
  assert.equal(result.ok,true);assert.equal(result.status.signedIn,false);assert.equal(result.serverRevoked,true);
  assert.equal(result.serverSessionRevoked,true);assert.equal(result.refreshRevoked,true);
  assert.equal(result.draftRecoveryCleanup.ok,false);assert.equal(result.draftRecoveryCleanup.code,'DRAFT_STORAGE_FAILED');
  assert.deepEqual(Object.keys(result.draftRecoveryCleanup).sort(),['code','ok']);
  assert.deepEqual(f.calls,['sender-check','suite-signed-out','auth-sign-out','draft-rm']);
  assert.deepEqual(f.removed,[f.expectedFile('synthetic-owner-a')]);
  for(const privateValue of [rmCode,'synthetic-owner-a','synthetic-binding','ciphertext','sensitive local filename',f.removed[0]])assert.equal(JSON.stringify(result).includes(privateValue),false);
});

test('failed draft cleanup does not upgrade incomplete server revocation',async()=>{
  const original={...confirmed(),serverRevoked:false,serverSessionRevoked:false,refreshRevoked:false},f=actor({result:original}),result=await f.invoke();
  assert.equal(result.ok,true);assert.equal(result.serverRevoked,false);assert.equal(result.serverSessionRevoked,false);assert.equal(result.refreshRevoked,false);
  assert.equal(result.draftRecoveryCleanup.ok,false);assert.equal(result.status,original.status);
});

test('failed authentication storage cleanup remains a failed logout with its original flags',async()=>{
  const original={...confirmed(),ok:false,error:{code:'AUTH_FAILED',message:'synthetic public authentication error'}},f=actor({result:original}),result=await f.invoke();
  assert.equal(result.ok,false);assert.equal(result.error,original.error);assert.equal(result.status,original.status);
  assert.equal(result.serverRevoked,true);assert.equal(result.serverSessionRevoked,true);assert.equal(result.refreshRevoked,true);
  assert.equal(result.draftRecoveryCleanup.ok,false);
});

test('successful encrypted draft cleanup returns the original authentication result without invented flags',async()=>{
  const f=actor({rmCode:null}),result=await f.invoke();assert.equal(result,f.result);
  assert.equal(Object.hasOwn(result,'draftRecoveryCleanup'),false);assert.deepEqual(f.removed,[f.expectedFile('synthetic-owner-a')]);
});

test('an absent owner or unavailable recovery service makes no deletion or cleanup-success claim',async()=>{
  for(const options of [{owner:null},{recoveryAbsent:true}]){
    const f=actor(options),result=await f.invoke();assert.equal(result,f.result);
    assert.equal(Object.hasOwn(result,'draftRecoveryCleanup'),false);assert.deepEqual(f.removed,[]);
  }
});

test('failed suite logout publication stops authentication and draft deletion',async()=>{
  const f=actor({suiteAllowed:false}),result=await f.invoke();assert.equal(result.ok,false);assert.equal(result.error.code,'SUITE_UNAVAILABLE');
  assert.equal(result.status.signedIn,true);assert.deepEqual(f.calls,['sender-check','suite-signed-out']);assert.deepEqual(f.removed,[]);
});

test('an authentication exception still becomes the ordinary IPC failure without draft deletion',async()=>{
  const f=actor({authFailure:true}),result=await f.invoke();assert.equal(result.ok,false);assert.equal(result.error.code,'AUTH_FAILED');
  assert.equal(Object.hasOwn(result,'draftRecoveryCleanup'),false);assert.deepEqual(f.removed,[]);
});

test('a newer account cannot become the old logout cleanup target or be overwritten by the result',async()=>{
  const authWait=deferred(),f=actor({authWait}),operation=f.invoke();
  const next=member('synthetic-owner-b',9);f.setState(next);authWait.resolve();const result=await operation;
  assert.equal(f.state(),next);assert.deepEqual(f.removed,[f.expectedFile('synthetic-owner-a')]);
  assert.notEqual(f.removed[0],f.expectedFile('synthetic-owner-b'));assert.equal(result.draftRecoveryCleanup.ok,false);
  assert.equal(result.serverRevoked,true);assert.equal(result.status,f.result.status);
});

test('a pending deletion keeps IPC pending and cannot erase the completed authentication flags',async()=>{
  const rmWait=deferred(),f=actor({rmCode:'EBUSY',rmWait});let resolved=false;
  const operation=f.invoke().then(value=>{resolved=true;return value;});
  for(let i=0;i<4;i++)await new Promise(setImmediate);
  assert.equal(f.state().signedIn,false);assert.equal(resolved,false);assert.equal(f.removed.length,1);
  rmWait.resolve();const result=await operation;assert.equal(result.ok,true);assert.equal(result.serverRevoked,true);assert.equal(result.draftRecoveryCleanup.ok,false);
});
