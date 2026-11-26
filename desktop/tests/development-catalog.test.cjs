'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const libraryModule=import('../renderer/library.mjs');
const stateModule=import('../renderer/state.mjs');
const preview={clientId:'platform',mode:'development',nativeShell:true};
const signed=id=>({status:'signed-in',signedIn:true,account:{synk_user_id:id},library:{status:'ready',appIds:[]}});

test('a signed-in account with no menu grants sees all development apps without changing its auth projection',async()=>{
  const {resolveLibrary,libraryCopy,displayLibraryAppIds}=await libraryModule,{APP_IDS}=await stateModule;
  const auth=signed('member-with-no-grants'),before=JSON.stringify(auth);
  const library=resolveLibrary(auth,preview);
  assert.deepEqual(library.appIds,APP_IDS);assert.equal(library.owner,'member-with-no-grants');assert.equal(library.status,'ready');
  // PATH is temporarily hidden, WORLD is a phone app shown by the home's phone panel (2026-11-11); teacher opens inside Messenger's card; a fixed count broke whenever a benefit was added or retired.
  const cards=APP_IDS.filter(id=>!['teacher','path','world'].includes(id));
  assert.equal(library.developmentCatalog,true);assert.deepEqual(displayLibraryAppIds(library),cards);assert.ok(libraryCopy(library).note.includes('앱 '+cards.length+'개'));
  assert.equal(JSON.stringify(auth),before);assert.deepEqual(auth.library.appIds,[]);
});

test('development discovery survives logout and pending auth without manufacturing a member identity',async()=>{
  const {resolveLibrary}=await libraryModule,{APP_IDS}=await stateModule;
  for(const status of ['signed-out','unconfigured','restoring','signing-in','signing-out','error']){
    const library=resolveLibrary({status,signedIn:false},preview);
    assert.deepEqual(library.appIds,APP_IDS);
    assert.ok(library.owner===null||library.owner==='anonymous-local');assert.notEqual(library.status,'ready');
  }
});

test('release, browser, other clients and malformed development flags retain account-filtered visibility',async()=>{
  const {resolveLibrary}=await libraryModule;
  for(const environment of [undefined,{}, {...preview,mode:'release'}, {...preview,clientId:'messenger'}, {...preview,clientId:'world'}, {...preview,nativeShell:false}, {...preview,nativeShell:'true'}, {mode:'development'}]){
    assert.deepEqual(resolveLibrary(signed('empty'),environment).appIds,[]);
    assert.deepEqual(resolveLibrary({status:'signed-out',signedIn:false},environment).appIds,['pulse']);
  }
});

test('public apps offer a usable browser action while packaged and unsupported apps keep honest availability',async()=>{
  const {primaryAction,statusLabel}=await stateModule;
  const publicAppsAvailable=['care','fortune'];
  // 무료 운세는 다시 만드는 동안 앱 칸이 없어, 본체가 공개 웹 목록에 남아 있어도 열기를 내지 않는다(10-30).
  assert.deepEqual(primaryAction({id:'fortune'},{native:true,publicAppsAvailable}),{label:'이용할 수 없음',action:'none',disabled:true});
  for(const id of ['care']){
    const action=primaryAction({id},{native:true,publicAppsAvailable});
    assert.deepEqual(action,{label:'웹에서 열기',action:'public-web',disabled:false});
    assert.equal(statusLabel({id,publicWebAvailable:true}),'웹에서 열림');
    assert.equal(primaryAction({id},{native:false,publicAppsAvailable}).disabled,true);
    assert.equal(primaryAction({id},{busy:true,publicAppsAvailable}).disabled,true);
    assert.equal(primaryAction({id},{publicAppsAvailable,productPreviewsAvailable:[id]}).action,'product-preview');
  }
  const pathAction=primaryAction({id:'path'},{native:true,publicAppsAvailable:['path'],productPreviewsAvailable:['path']});
  assert.deepEqual(pathAction,{label:'PATH 열기',action:'public-web',disabled:false});
  for(const id of ['teacher','family-album','partners','unknown']){
    assert.equal(primaryAction({id},{publicAppsAvailable:[...publicAppsAvailable,id]}).disabled,true);
  }
  assert.equal(primaryAction({id:'pulse'},{publicAppsAvailable}).action,'pulse-app');
  for(const id of ['world','messenger'])assert.equal(primaryAction({id,canLaunch:true},{publicAppsAvailable}).action,'launch');
});
