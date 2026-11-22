'use strict';
// 검정 구 4단계 구현 설계 14.3: 창 안 Workspace 뷰의 「내 수업」 교사 로그인. 가짜 금고 · 로그인 · Suite 따라가기로 본다.
// 따라가기는 사람이 로그인을 누르거나 저장된 교사 로그인이 있을 때만 켠다. 회사 업무 로그아웃이 상태를 묻거나 로그아웃해도 켜지지 않는다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createWorkspaceTeacher,WORKSPACE_TEACHER_SESSION_FILE}=require('../src/workspace-teacher.cjs');

const DIR=path.join('C:','synthetic','WorkspaceTeacher');
const CONFIG=Object.freeze({fingerprint:'synthetic-teacher',clientKey:'teacher'});
const IDLE={configured:true,signedIn:false,status:'signed-out',sessionGeneration:0,account:null,error:null};
const NONE={configured:false,signedIn:false,status:'unconfigured',sessionGeneration:0,account:null,error:null};

function fixture({saved=false,config=CONFIG,suiteStore={},afterPass='signed-in',followerStart=null}={}){
  const log=[];let state={configured:true,signedIn:false,status:'signed-out',sessionGeneration:1},onChange=null;const changes=[];
  const auth={status:()=>({...state}),initialize:async()=>{log.push('initialize');return {...state};},signIn:async()=>{log.push('signIn');state={...state,signedIn:true,status:'signed-in'};return {...state};},
    cancel:async()=>{log.push('cancel');return {...state};},signOut:async()=>{log.push('signOut');state={...state,signedIn:false,status:'signed-out'};return {ok:true,serverRevoked:true};},
    accountRequest:async(operation,params)=>{log.push(['accountRequest',operation,params]);return {ok:true,classes:[]};},dispose:()=>log.push('auth-dispose')};
  const teacher=createWorkspaceTeacher({config,directory:DIR,scope:'synthetic.workspace-teacher',safeStorage:{},openExternal:()=>{},appVersion:'0.0.0',getDevice:()=>'synthetic-device',
    onChange:value=>changes.push(value),suiteStore,
    createTokenStore:options=>{log.push(['store',options.directory,options.scope,options.configFingerprint]);return {};},
    createAuthService:options=>{log.push(['auth',options.device]);onChange=options.onChange;return auth;},
    createSuiteFollower:({store,auth:given})=>{assert.equal(store,suiteStore);assert.equal(given,auth);log.push('follower');
      return {start:()=>{log.push('start');if(followerStart)return followerStart();if(afterPass==='signed-in')state={...state,signedIn:true,status:'signed-in'};return Promise.resolve();},dispose:()=>log.push('follower-dispose')};},
    exists:file=>{log.push(['exists',file]);return saved&&file===path.join(DIR,WORKSPACE_TEACHER_SESSION_FILE);}});
  return {teacher,log,changes,set state(value){state=value;},emit:value=>onChange(value)};
}
const made=log=>log.filter(entry=>Array.isArray(entry)&&entry[0]==='auth').length;
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('the session file it looks for is the one the token store writes',()=>{
  assert.match(fs.readFileSync(path.join(__dirname,'..','src','auth-store.cjs'),'utf8'),new RegExp("path\\.join\\(directory,'"+WORKSPACE_TEACHER_SESSION_FILE.replace('.','\\.')+"'\\)"));
});

test('without a teacher config or a Suite store it answers unconfigured and makes nothing',async()=>{
  for(const options of [{config:null},{suiteStore:null}]){
    const f=fixture(options);
    assert.deepEqual(f.teacher.status(),NONE);assert.deepEqual(await f.teacher.signIn(),NONE);
    assert.deepEqual(await f.teacher.signOut(),{ok:true,status:NONE});assert.equal((await f.teacher.accountRequest('classroom',{operation:'classes'})).error.code,'AUTH_REQUIRED');
    assert.equal(made(f.log),0);assert.equal(f.teacher.started(),false);
  }
});

test('with no saved teacher login, asking the status or signing out (a company logout) starts nothing and opens no browser',async()=>{
  const f=fixture();
  assert.deepEqual(f.teacher.status(),IDLE);
  assert.deepEqual(await f.teacher.signOut(),{ok:true,status:IDLE});
  assert.equal((await f.teacher.accountRequest('classroom',{operation:'classes'})).error.code,'AUTH_REQUIRED');
  assert.deepEqual(await f.teacher.cancelSignIn(),IDLE);
  assert.equal(made(f.log),0,'no auth service');assert.equal(f.log.includes('start'),false,'no Suite following');assert.equal(f.teacher.started(),false);
});

test('a saved teacher login starts following on the first status, once',async()=>{
  const f=fixture({saved:true});
  assert.equal(f.teacher.status().status,'signed-in');assert.equal(f.teacher.status().signedIn,true);
  assert.equal(f.log.filter(entry=>entry==='start').length,1);assert.equal(made(f.log),1);assert.equal(f.teacher.started(),true);
  assert.deepEqual(f.log.find(entry=>Array.isArray(entry)&&entry[0]==='store'),['store',DIR,'synthetic.workspace-teacher','synthetic-teacher']);
  assert.deepEqual(f.log.find(entry=>Array.isArray(entry)&&entry[0]==='auth'),['auth','synthetic-device']);
});

test('signing out with a saved login but no following restores and ends that login without starting to follow',async()=>{
  const f=fixture({saved:true});
  assert.deepEqual(await f.teacher.signOut(),{ok:true,serverRevoked:true});
  assert.deepEqual(f.log.filter(entry=>typeof entry==='string'),['follower','initialize','signOut']);assert.equal(f.teacher.started(),false);
});

test('signing in starts following and waits for its first pass; it signs in itself only when following did not',async()=>{
  const followed=fixture();
  assert.equal((await followed.teacher.signIn()).signedIn,true);
  assert.equal(followed.log.includes('signIn'),false,'the Suite following already signed in');
  const notYet=fixture({afterPass:'none'});
  assert.equal((await notYet.teacher.signIn()).signedIn,true);
  assert.deepEqual(notYet.log.filter(entry=>['start','signIn'].includes(entry)),['start','signIn']);
  // 따라가기가 아직 도는 동안 누르면 그 첫 차례를 기다린다
  let release;const slow=fixture({afterPass:'none',followerStart:()=>new Promise(resolve=>{release=resolve;})});
  const pending=slow.teacher.signIn();await settle();assert.equal(slow.log.includes('signIn'),false);
  slow.state={configured:true,signedIn:false,status:'signing-in',sessionGeneration:2};release();
  assert.equal((await pending).status,'signing-in');assert.equal(slow.log.includes('signIn'),false,'a sign-in already under way is not started twice');
});

test('classroom requests go through only after following started, and only classroom',async()=>{
  const f=fixture();await f.teacher.signIn();
  assert.deepEqual(await f.teacher.accountRequest('classroom',{operation:'classes'}),{ok:true,classes:[]});
  assert.deepEqual(f.log.at(-1),['accountRequest','classroom',{operation:'classes'}]);
  const before=f.log.length;
  for(const [operation,params] of [['load',{}],['revokeAll',{}],['classroom',null],['classroom',[]],['classroom',{operation:'deleteEverything'}]]){
    const result=await f.teacher.accountRequest(operation,params);assert.equal(result.ok,false,String(operation));assert.equal(result.error.code,'INVALID_REQUEST',String(operation));
  }
  assert.equal(f.log.length,before,'nothing reached the auth service');
});

test('it forwards login changes until it is disposed, then answers unconfigured',async()=>{
  const f=fixture({saved:true});f.teacher.status();
  f.emit({signedIn:true});assert.deepEqual(f.changes,[{signedIn:true}]);
  f.teacher.dispose();assert.ok(f.log.includes('follower-dispose')&&f.log.includes('auth-dispose'));
  f.emit({signedIn:false});assert.deepEqual(f.changes,[{signedIn:true}]);
  assert.deepEqual(f.teacher.status(),NONE);assert.deepEqual(await f.teacher.signIn(),NONE);
});
