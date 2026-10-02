'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const libraryModule=import('../renderer/library.mjs'),personalModule=import('../renderer/personalization.mjs');
const engine=require('../../atlas/personalization');
const signed=(id,appIds)=>({status:'signed-in',signedIn:true,account:{synk_user_id:id},library:{status:'ready',appIds}});

test('the guest entry never exposes the full app catalog and transient identity is closed',async()=>{
  const {resolveLibrary}=await libraryModule;
  for(const status of ['signed-out','unconfigured'])assert.deepEqual(resolveLibrary({status,signedIn:false}).appIds,['world']);
  for(const status of ['restoring','signing-in','signing-out','error','signed-in'])assert.deepEqual(resolveLibrary({status,signedIn:false}).appIds,[]);
  assert.deepEqual(resolveLibrary({status:'signed-out',signedIn:false,error:{code:'AUTH_REQUIRED'}}).appIds,[]);
  assert.deepEqual(resolveLibrary(undefined).appIds,[]);
});

test('verified projection is intersected with known IDs without inference from profile or storage',async()=>{
  const {resolveLibrary,visibleSelection}=await libraryModule;
  const student=signed('student',['world','world','unknown']);student.account.profile={role:'director'};
  assert.deepEqual(resolveLibrary(student).appIds,['world']);
  const teacher=resolveLibrary(signed('teacher',['teacher']));
  assert.equal(visibleSelection('messenger',teacher.appIds),'teacher');
  assert.equal(visibleSelection('world',[]),null);
  assert.deepEqual(resolveLibrary(signed('empty',[])).appIds,[]);
  assert.equal(resolveLibrary(signed('empty',[])).status,'ready');
  assert.equal(resolveLibrary({...signed('student',[]),library:undefined}).status,'unavailable');
  assert.deepEqual(resolveLibrary({...signed('student',['world']),account:null}).appIds,[]);
});

test('self-declared teacher or employee interests cannot reveal apps beyond account scope',async()=>{
  const mod=await personalModule,store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
  const host=mod.createPlatformPersonalization(engine,storage,{clock:()=> '2026-10-02T10:00:00.000Z'});
  for(const context of ['teacher','team','creator','customer','partner']){
    host.save({context,goal:'work',textSize:'large',explanation:'brief',motion:'reduced',consent:true});
    const student=host.current({appIds:['world']});assert.deepEqual(student.order,['world']);assert.equal(student.selected,'world');assert.equal(student.presentation.textSize,'large');
    const revoked=host.current({appIds:[]});assert.deepEqual(revoked.order,[]);assert.equal(revoked.selected,null);assert.equal(revoked.error,null);assert.equal(revoked.presentation.textSize,'large');
  }
});

test('account preferences restore only their owner and survive another account clearing its settings',async()=>{
  const {accountStorageKey}=await libraryModule,mod=await personalModule;
  const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
  const hostFor=id=>mod.createPlatformPersonalization(engine,storage,{clock:()=> '2026-10-02T10:00:00.000Z',scope:{...mod.PLATFORM_SCOPE,personId:id},key:accountStorageKey(mod.PERSONAL_KEY,id)});
  hostFor('teacher-a').save({context:'teacher',goal:'clarity',textSize:'large',explanation:'brief',motion:'reduced',consent:true});
  assert.equal(hostFor('student-b').current({appIds:['world']}).active,false);
  hostFor('student-b').clear();
  assert.equal(hostFor('teacher-a').current({appIds:['teacher']}).presentation.textSize,'large');
  const from=accountStorageKey(mod.PERSONAL_KEY,'teacher-a'),to=accountStorageKey(mod.PERSONAL_KEY,'student-b');
  store.set(to,store.get(from));assert.equal(hostFor('student-b').current({appIds:['world']}).active,false);
  assert.equal(accountStorageKey('view','anonymous-local'),'view');
  assert.notEqual(accountStorageKey('view','teacher/a'),accountStorageKey('view','teacher%2Fa'));
});
