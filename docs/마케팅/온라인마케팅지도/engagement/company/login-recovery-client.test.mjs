import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// 2026-10-23 로그인 되찾기 화면: 재설정 링크는 플랫폼·SYNK 입구보다 먼저 열리고, 쓴 뒤에는 아이디를 채운 로그인으로 돌아간다.
const source=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const between=(start,end)=>{const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert.ok(from>=0&&to>from,start);return source.slice(from,to);};
const initializeSource=between('async function initialize()','async function loadState()');
const recoverySource=between('const untilFormatter','function shell(content)');
const membersSource=between('function membersPage()','function pulseAutoReplyPanel()');
const passwordSource=between('function passwordPanel()','function recentRuns(');
const reply=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});

function fixture({fetch,user=null}={}){
  const calls=[],renders=[],replaced=[];
  const context=vm.createContext({state:{user,csrf:'',authMode:'login',authToken:'',tab:'home'},URLSearchParams,Intl,Date,Number,String,Promise,
    location:{hash:'#reset=link-token-value',search:'',pathname:'/'},history:{replaceState:(a,b,url)=>replaced.push(url)},
    isDemoMode:()=>false,selectWorkspaceView(){},escape:value=>String(value??''),icon:()=>'',
    prepareSynkCompanyEntry:async()=>{calls.push('platform-entry');throw Error('the platform entry must not run before a reset link');},
    renderAuth(){renders.push({mode:context.state.authMode,link:context.state.resetLink});},
    $:()=>null,
    api:async(path,body)=>{calls.push(path);return fetch(path,body);},
  });
  vm.runInContext(recoverySource+'\n'+initializeSource,context);
  return {context,calls,renders,replaced,run:code=>vm.runInContext(code,context)};
}

test('a reset link opens its screen before the platform and SYNK entry, and removes itself from the address',async()=>{
  const f=fixture({fetch:async path=>{assert.equal(path,'/api/password-reset/inspect');return {name:'크루',loginId:'crew@example.test',expiresAt:'2026-10-23T12:00:00.000Z'};}});
  await f.run('initialize()');
  assert.deepEqual(f.calls,['/api/password-reset/inspect']);assert.deepEqual(f.replaced,['/']);
  assert.equal(f.context.state.authMode,'reset');assert.equal(f.context.state.authToken,'link-token-value');
  assert.deepEqual(f.renders.map(row=>row.mode),['reset','reset']);assert.equal(f.renders.at(-1).link.loginId,'crew@example.test');
});

test('a used or unknown link shows its message instead of a form',async()=>{
  const f=fixture({fetch:async()=>{throw Object.assign(Error('이 재설정 링크는 만료됐거나 이미 썼어요. 관리자에게 새 링크를 부탁해 주세요.'),{status:403});}});
  await f.run('initialize()');assert.match(f.context.state.resetLink.error,/만료됐거나 이미 썼어요/);assert.equal(f.context.state.resetLink.retry,undefined);
  const html=f.run('authResetBody()');assert.match(html,/만료됐거나 이미 썼어요/);assert.match(html,/data-action="auth-help"/);assert.doesNotMatch(html,/data-form="password-reset"|auth-reset-retry/);
});

test('a busy limit or a broken connection keeps the link and offers to check again (Fable F4)',async()=>{
  for(const [error,pattern] of [[Object.assign(Error('로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.'),{status:429}),/요청이 많습니다/],[new TypeError('Failed to fetch'),/연결이 끊겨 링크를 확인하지 못했어요/]]){
    const f=fixture({fetch:async()=>{throw error;}});await f.run('initialize()');
    assert.equal(f.context.state.resetLink.retry,true);assert.match(f.context.state.resetLink.error,pattern);assert.equal(f.context.state.authToken,'link-token-value');
    const html=f.run('authResetBody()');assert.match(html,/data-action="auth-reset-retry"/);assert.doesNotMatch(html,/Failed to fetch/);
  }
});

test('the reset form names the account for password managers and asks twice for the new password',()=>{
  const f=fixture();f.context.state.resetLink={name:'크루',loginId:'crew@example.test',expiresAt:'2026-10-23T12:30:00.000Z'};
  const html=f.run('authResetBody()');
  assert.match(html,/name="username" autocomplete="username" value="crew@example.test" readonly hidden/);
  assert.equal((html.match(/autocomplete="new-password"/g)||[]).length,2);assert.match(html,/21:30까지 한 번 쓸 수 있어요/);
  assert.match(f.run('authHelpBody()'),/60분 동안 한 번/);assert.match(f.run('authHelpBody()'),/회사 비밀번호를 정하기 전까지만/);
});

test('only an administrator sees the reset button, never on an administrator or a stopped crew',()=>{
  const members=[{id:'a',name:'관리자',email:'a@example.test',role:'admin',active:true},{id:'m',name:'크루',email:'m@example.test',role:'member',active:true},{id:'s',name:'멈춤',email:'s@example.test',role:'viewer',active:false}];
  const render=role=>{const context=vm.createContext({state:{user:{id:role==='admin'?'a':'m',role},data:{members,teams:[],channels:[],deployment:{}}},escape:value=>String(value??''),icon:()=>'',roleLabel:value=>value,number:String,isAdmin:()=>role==='admin',canManageTeam:()=>true,empty:()=>'',pageHeading:()=>'',button:(text,action,glyph,classes,attrs='')=>`<button data-action="${action}" ${attrs}>${text}</button>`});vm.runInContext(membersSource,context);return vm.runInContext('membersPage()',context);};
  const admin=render('admin');assert.equal((admin.match(/data-action="member-password-reset"/g)||[]).length,1);assert.match(admin,/data-action="member-password-reset" data-id="m"/);
  assert.doesNotMatch(render('manager'),/member-password-reset/);
});

test('without a password the form does not ask for the current one; with one it does, and an administrator is sent to the operator',()=>{
  let role='member';const context=vm.createContext({state:{user:{email:'crew@example.test'},passwordSet:false},escape:value=>String(value??''),overlay:null,$:()=>null,modal(){},api:async()=>({}),isAdmin:()=>role==='admin'});vm.runInContext(passwordSource,context);
  const without=vm.runInContext('passwordForm()',context);assert.doesNotMatch(without,/name="oldPassword"/);assert.match(without,/비밀번호 정하기/);
  context.state.passwordSet=true;const withOne=vm.runInContext('passwordForm()',context);assert.match(withOne,/name="oldPassword" type="password" required/);assert.match(withOne,/관리자에게 비밀번호 재설정 링크를 부탁해/);
  role='admin';const admin=vm.runInContext('passwordForm()',context);assert.match(admin,/운영 담당에게 「관리자 복구 링크」/);assert.doesNotMatch(admin,/관리자에게 비밀번호 재설정 링크/);
});
