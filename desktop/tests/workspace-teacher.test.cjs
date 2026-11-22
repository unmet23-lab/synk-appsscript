'use strict';
// 검정 구 4단계 구현 설계 14.3: 창 안 Workspace 뷰의 「내 수업」 교사 로그인. 가짜 금고 · 로그인 · Suite 따라가기로 본다.
// - 따라가기는 사람이 로그인을 누르거나 저장된 교사 로그인이 있을 때만 켠다.
// - 시스템 브라우저 로그인은 사람이 누른 직후 한 번만 열린다. 따라가기가 혼자서는 열지 않는다(GPT pc-retire-workspace-20261123 GA2 · GA3).
// - 지금 플랫폼 계정과 다른 교사 로그인은 보이지도 쓰이지도 않고, 플랫폼 로그인이 바뀌면 바로 다시 따라간다(같은 검수 GA1).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createWorkspaceTeacher,WORKSPACE_TEACHER_SESSION_FILE}=require('../src/workspace-teacher.cjs');

const DIR=path.join('C:','synthetic','WorkspaceTeacher');
const CONFIG=Object.freeze({fingerprint:'synthetic-teacher',clientKey:'teacher'});
const IDLE={configured:true,signedIn:false,status:'signed-out',sessionGeneration:0,account:null,error:null};
const NONE={configured:false,signedIn:false,status:'unconfigured',sessionGeneration:0,account:null,error:null};
const A='synthetic-owner-a',B='synthetic-owner-b';
const signedIn=id=>({configured:true,signedIn:true,status:'signed-in',sessionGeneration:2,account:{synk_user_id:id,display_name:'합성 '+id}});
const signedOut={configured:true,signedIn:false,status:'signed-out',sessionGeneration:1,account:null};

// follower: 'restore'(저장된 로그인을 되살림) · 'none'(아무것도 안 함) · 'sign-in'(이 계정이 아니라서 로그인하려 함, 따라가기의 auth.signIn을 부른다)
function fixture({saved=false,config=CONFIG,suiteStore={},follower='restore',followerStart=null}={}){
  const log=[];let state={...signedOut},platform=A;const changes=[];let given=null,onChange=null;
  const auth={status:()=>({...state}),initialize:async()=>{log.push('initialize');return {...state};},signIn:async()=>{log.push('signIn');state=signedIn(platform);return {...state};},
    cancel:async()=>{log.push('cancel');return {...state};},signOut:async()=>{log.push('signOut');state={...signedOut};return {ok:true,serverRevoked:true};},
    bindPlatform:next=>{log.push(['bind',next]);return {...state};},getAccessToken:async()=>'SYNTHETIC',
    accountRequest:async(operation,params)=>{log.push(['accountRequest',operation,params]);return {ok:true,classes:[]};},dispose:()=>log.push('auth-dispose')};
  const teacher=createWorkspaceTeacher({config,directory:DIR,scope:'synthetic.workspace-teacher',safeStorage:{},openExternal:()=>{},appVersion:'0.0.0',getDevice:()=>'synthetic-device',
    getPlatformAccount:()=>platform,onChange:value=>changes.push(value),suiteStore,
    createTokenStore:options=>{log.push(['store',options.directory,options.scope,options.configFingerprint]);return {};},
    createAuthService:options=>{log.push(['auth',options.device]);onChange=options.onChange;return auth;},
    createSuiteFollower:({store,auth:wrapped})=>{assert.equal(store,suiteStore);assert.notEqual(wrapped,auth,'the follower gets a wrapped sign-in');given=wrapped;log.push('follower');
      const pass=async()=>{if(follower==='restore')state=signedIn(platform);else if(follower==='sign-in'){await wrapped.signOut();await wrapped.signIn();}};
      return {start:()=>{log.push('start');return followerStart?followerStart(wrapped):pass();},refresh:()=>{log.push('refresh');return pass();},dispose:()=>log.push('follower-dispose')};},
    exists:file=>{log.push(['exists',file]);return saved&&file===path.join(DIR,WORKSPACE_TEACHER_SESSION_FILE);}});
  return {teacher,log,changes,get given(){return given;},set state(value){state=value;},get state(){return state;},set platform(value){platform=value;},emit:value=>onChange(value)};
}
const made=log=>log.filter(entry=>Array.isArray(entry)&&entry[0]==='auth').length;
const browser=log=>log.filter(entry=>entry==='signIn').length;
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
  f.teacher.refresh();
  assert.equal(made(f.log),0,'no auth service');assert.equal(f.log.includes('start'),false,'no Suite following');assert.equal(f.log.includes('refresh'),false);assert.equal(f.teacher.started(),false);
});

test('a saved teacher login starts following on the first status, once',async()=>{
  const f=fixture({saved:true});
  f.teacher.status();await settle();
  assert.equal(f.teacher.status().signedIn,true);assert.equal(f.teacher.status().account.synk_user_id,A);
  assert.equal(f.log.filter(entry=>entry==='start').length,1);assert.equal(made(f.log),1);assert.equal(f.teacher.started(),true);
  assert.deepEqual(f.log.find(entry=>Array.isArray(entry)&&entry[0]==='store'),['store',DIR,'synthetic.workspace-teacher','synthetic-teacher']);
  assert.deepEqual(f.log.find(entry=>Array.isArray(entry)&&entry[0]==='auth'),['auth','synthetic-device']);
});

test('GA2: a company logout with a saved login never ends in a browser sign-in, even when following wants to sign in again',async()=>{
  // 저장된 로그인이 이 계정 것이 아니어서 따라가기가 끊고 다시 로그인하려 한다. 사람이 누르지 않았으니 브라우저는 열리지 않는다
  const f=fixture({saved:true,follower:'sign-in'});
  f.teacher.status();await settle();
  assert.equal((await f.teacher.signOut()).ok,true);await settle();
  assert.equal(browser(f.log),0,'no browser sign-in');assert.equal(f.teacher.status().signedIn,false);
  // 따로 켜지 않은 채 로그아웃만 하면 저장된 로그인을 되살려 끊고, 따라가기는 켜지 않는다
  const quiet=fixture({saved:true});
  assert.deepEqual(await quiet.teacher.signOut(),{ok:true,serverRevoked:true});
  assert.deepEqual(quiet.log.filter(entry=>typeof entry==='string'),['follower','initialize','signOut']);assert.equal(quiet.teacher.started(),false);assert.equal(browser(quiet.log),0);
});

test('GA3: after signing out of 내 수업, a new platform sign-in does not open the browser on its own',async()=>{
  const f=fixture({follower:'none'});
  assert.equal((await f.teacher.signIn()).signedIn,true);assert.equal(browser(f.log),1,'the press opened the browser once');
  await f.teacher.signOut();
  // 플랫폼이 다시 로그인했다 — 따라가기가 새 세대를 보고 로그인하려 한다
  f.state={...signedOut};await f.given.signIn();await f.given.signIn();
  assert.equal(browser(f.log),1,'following alone opens no browser');
  // 사람이 다시 누르면 한 번 연다
  assert.equal((await f.teacher.signIn()).signedIn,true);assert.equal(browser(f.log),2);
});

test('pressing sign-in waits for the first pass; following may use that one press, and the press is never used twice',async()=>{
  const restored=fixture();
  assert.equal((await restored.teacher.signIn()).signedIn,true);assert.equal(browser(restored.log),0,'a restored login needs no browser');
  const viaFollower=fixture({follower:'sign-in'});
  assert.equal((await viaFollower.teacher.signIn()).signedIn,true);assert.equal(browser(viaFollower.log),1,'following used the press');
  viaFollower.state={...signedOut};await viaFollower.given.signIn();assert.equal(browser(viaFollower.log),1,'the press is spent');
  // 따라가기가 아직 도는 동안 누르면 그 첫 차례를 기다리고, 이미 로그인 중이면 다시 시작하지 않는다
  let release;const slow=fixture({follower:'none',followerStart:()=>new Promise(resolve=>{release=resolve;})});
  const pending=slow.teacher.signIn();await settle();assert.equal(browser(slow.log),0);
  slow.state={...signedOut,status:'signing-in'};release();
  assert.equal((await pending).status,'signing-in');assert.equal(browser(slow.log),0);
  await slow.given.signIn();assert.equal(browser(slow.log),0,'a press that found a sign-in under way is spent');
  // 취소하면 표도 버린다
  const cancelled=fixture({follower:'none',followerStart:()=>new Promise(()=>{})});
  void cancelled.teacher.signIn();await settle();await cancelled.teacher.cancelSignIn();await cancelled.given.signIn();assert.equal(browser(cancelled.log),0);
});

test('GA1: a teacher login of another SYNK ID is neither shown nor used, and a platform change refreshes following at once',async()=>{
  const f=fixture({saved:true});f.teacher.status();await settle();
  assert.equal(f.teacher.status().account.synk_user_id,A);
  f.platform=B;
  const masked=f.teacher.status();assert.equal(masked.signedIn,false);assert.equal(masked.account,null);assert.equal(masked.status,'restoring');
  const before=f.log.length;
  assert.equal((await f.teacher.accountRequest('classroom',{operation:'classes'})).error.code,'AUTH_CHANGED');
  assert.equal(f.log.slice(before).some(entry=>Array.isArray(entry)&&entry[0]==='accountRequest'),false,'no request with the old token');
  f.emit(signedIn(A));assert.equal(f.changes.at(-1).signedIn,false,'a change notice for the old account is masked too');assert.equal(f.changes.at(-1).account,null);
  f.teacher.refresh();assert.equal(f.log.at(-1),'refresh');
  f.platform=null;assert.equal(f.teacher.status().signedIn,false,'no platform account, no teacher login');
});

test('classroom requests go through only after following started and for the platform account, and only classroom',async()=>{
  const f=fixture();await f.teacher.signIn();
  assert.deepEqual(await f.teacher.accountRequest('classroom',{operation:'classes'}),{ok:true,classes:[]});
  assert.deepEqual(f.log.at(-1),['accountRequest','classroom',{operation:'classes'}]);
  const before=f.log.length;
  for(const [operation,params] of [['load',{}],['revokeAll',{}],['classroom',null],['classroom',[]],['classroom',{operation:'deleteEverything'}]]){
    const result=await f.teacher.accountRequest(operation,params);assert.equal(result.ok,false,String(operation));assert.equal(result.error.code,'INVALID_REQUEST',String(operation));
  }
  assert.equal(f.log.length,before,'nothing reached the auth service');
  f.state={...signedOut};assert.equal((await f.teacher.accountRequest('classroom',{operation:'classes'})).error.code,'AUTH_REQUIRED');
});

test('it forwards login changes until it is disposed, then answers unconfigured',async()=>{
  const f=fixture({saved:true});f.teacher.status();await settle();
  f.emit(signedIn(A));assert.equal(f.changes.at(-1).signedIn,true);const count=f.changes.length;
  f.teacher.dispose();assert.ok(f.log.includes('follower-dispose')&&f.log.includes('auth-dispose'));
  f.emit(signedOut);assert.equal(f.changes.length,count);
  assert.deepEqual(f.teacher.status(),NONE);assert.deepEqual(await f.teacher.signIn(),NONE);
  f.teacher.refresh();assert.equal(f.log.includes('refresh'),false);
});
