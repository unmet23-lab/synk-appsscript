'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const libraryModule=import('../renderer/library.mjs');
const stateModule=import('../renderer/state.mjs');
const homeModule=import('../renderer/member-home.mjs');
const preview={clientId:'platform',mode:'development',nativeShell:true};
const signed=id=>({status:'signed-in',signedIn:true,account:{synk_user_id:id},library:{status:'ready',appIds:[]}});

test('a signed-in account with no menu grants sees all development apps without changing its auth projection',async()=>{
  const {resolveLibrary,libraryCopy,displayLibraryAppIds}=await libraryModule,{APP_IDS}=await stateModule;
  const auth=signed('member-with-no-grants'),before=JSON.stringify(auth);
  const library=resolveLibrary(auth,preview);
  assert.deepEqual(library.appIds,APP_IDS);assert.equal(library.owner,'member-with-no-grants');assert.equal(library.status,'ready');
  assert.equal(library.developmentCatalog,true);assert.equal(displayLibraryAppIds(library).length,8);assert.ok(libraryCopy(library).note.includes('지원 앱 8개'));
  assert.equal(JSON.stringify(auth),before);assert.deepEqual(auth.library.appIds,[]);
});

test('development discovery survives logout and pending auth without manufacturing a member identity',async()=>{
  const {resolveLibrary}=await libraryModule,{APP_IDS}=await stateModule,{createHomeStore}=await homeModule;
  const data=new Map(),store=createHomeStore({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)});
  for(const status of ['signed-out','unconfigured','restoring','signing-in','signing-out','error']){
    const library=resolveLibrary({status,signedIn:false},preview);
    assert.deepEqual(library.appIds,APP_IDS);
    assert.ok(library.owner===null||library.owner==='anonymous-local');assert.notEqual(library.status,'ready');
    assert.deepEqual(store.list(library),[]);
    assert.throws(()=>store.add(library,{appId:'messenger',kind:'note',title:'must not save',consent:true}),/로그인/);
  }
  assert.equal(data.size,0);
});

test('release, browser, other clients and malformed development flags retain account-filtered visibility',async()=>{
  const {resolveLibrary}=await libraryModule;
  for(const environment of [undefined,{}, {...preview,mode:'release'}, {...preview,clientId:'messenger'}, {...preview,clientId:'world'}, {...preview,nativeShell:false}, {...preview,nativeShell:'true'}, {mode:'development'}]){
    assert.deepEqual(resolveLibrary(signed('empty'),environment).appIds,[]);
    assert.deepEqual(resolveLibrary({status:'signed-out',signedIn:false},environment).appIds,['world']);
  }
});

test('full development discovery keeps local member records private across accounts and logout',async()=>{
  const {resolveLibrary}=await libraryModule,{createHomeStore}=await homeModule;
  const data=new Map(),store=createHomeStore({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},{clock:()=>1791475200000});
  const a=resolveLibrary(signed('member-a'),preview),b=resolveLibrary(signed('member-b'),preview);
  store.add(a,{kind:'note',appId:'messenger',title:'private A note',consent:true});
  assert.equal(store.list(a).length,1);assert.deepEqual(store.list(b),[]);
  assert.deepEqual(store.list(resolveLibrary({status:'signed-out',signedIn:false},preview)),[]);
  assert.equal(store.list(a)[0].title,'private A note');
});

test('public apps offer a usable browser action while packaged and unsupported apps keep honest availability',async()=>{
  const {primaryAction,statusLabel}=await stateModule,{canOpenFromHome}=await homeModule;
  const publicAppsAvailable=['care','fortune','rehearsal'];
  for(const id of publicAppsAvailable){
    const action=primaryAction({id},{native:true,publicAppsAvailable});
    assert.deepEqual(action,{label:'웹으로 열기',action:'public-web',disabled:false});
    assert.equal(canOpenFromHome(action),true);
    assert.equal(statusLabel({id,publicWebAvailable:true}),'웹에서 이용 가능');
    assert.equal(primaryAction({id},{native:false,publicAppsAvailable}).disabled,true);
    assert.equal(primaryAction({id},{busy:true,publicAppsAvailable}).disabled,true);
    assert.equal(primaryAction({id},{publicAppsAvailable,productPreviewsAvailable:[id]}).action,'product-preview');
  }
  for(const id of ['teacher','path','family-album','pulse','partners','unknown']){
    assert.equal(primaryAction({id},{publicAppsAvailable:[...publicAppsAvailable,id]}).disabled,true);
  }
  for(const id of ['world','messenger'])assert.equal(primaryAction({id,canLaunch:true},{publicAppsAvailable}).action,'launch');
});
