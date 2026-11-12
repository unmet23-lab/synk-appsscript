// 로그인 한 길(2026-11-12)의 화면 조각 시험 — 워크스페이스 로그인 뒤 돌아갈 곳(app.js), SYNK ID 왕복 실패 안내(synk-id.js),
// PULSE 직원 딥링크 되살리기(pulse-app/app.mjs)를 import 없이 잘라 vm에서 돌린다(다른 클라이언트 시험과 같은 꼴).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const between=(source,start,end)=>{const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from,`조각을 찾지 못함: ${start}`);return source.slice(from,to);};
const appSource=between(read('./public/app.js'),'// Which way this browser last came in','async function initialize()');
const synkSource=between(read('./public/synk-id.js'),'// A browser SYNK ID round trip','async function installSynkLogin(){');
const pulseSource=read('./public/pulse-app/app.mjs');
const staffSearchSource=between(pulseSource,"const STAFF_RETURN_KEY=","const openNotificationsOnStart=");
const staffClickSource=pulseSource.split(/\r?\n/).find(line=>line.includes("closest?.('[data-staff-login]')"));
const historySource=between(pulseSource,'function readStaffHistoryTarget(search){','\nfunction ');
const UUID_A='11111111-2222-4333-8444-555555555555',UUID_B='66666666-7777-4888-9999-aaaaaaaaaaaa';

function storage({broken=false}={}){
  const map=new Map(),fail=()=>{throw new Error('storage blocked');};
  return broken?{getItem:fail,setItem:fail,removeItem:fail,map}:{map,getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>{map.set(key,String(value));},removeItem:key=>{map.delete(key);}};
}
function page({search='',pathname='/',hash='',session=storage(),local=storage(),extra={}}={}){
  const replaced=[],moves=[],notices=[];
  const location={search,pathname,hash,replace(target){moves.push(target);}};
  const context=vm.createContext({URLSearchParams,JSON,Object,Date,location,sessionStorage:session,localStorage:local,
    history:{replaceState(_state,_title,url){replaced.push(url);const at=new URL(url,'http://x.test');location.search=at.search;location.pathname=at.pathname;}},
    notify(message){notices.push(message);},...extra});
  return {context,location,session,local,replaced,moves,notices,run:code=>vm.runInContext(code,context)};
}

test('워크스페이스 로그인 뒤 돌아갈 곳은 아는 이름만 15분 안에 한 번 쓴다',()=>{
  const p=page({search:'?tab=messenger&after=pulse-staff&section=x'});p.run(appSource);
  p.run('rememberAfterLogin()');
  assert.deepEqual(p.replaced,['/?tab=messenger&section=x']);
  assert.equal(JSON.parse(p.session.map.get('synk.workspace.after')).key,'pulse-staff');
  assert.equal(p.run('afterLoginTarget()'),'/pulse-app/?mode=staff');
  assert.equal(p.run('continueAfterLogin()'),true);assert.deepEqual(p.moves,['/pulse-app/?mode=staff']);
  assert.equal(p.run('continueAfterLogin()'),false);assert.equal(p.moves.length,1);

  const unknown=page({search:'?after=https://evil.example.test/'});unknown.run(appSource);unknown.run('rememberAfterLogin()');
  assert.deepEqual(unknown.replaced,['/']);assert.equal(unknown.session.map.size,0);assert.equal(unknown.run('continueAfterLogin()'),false);

  const old=page();old.run(appSource);old.session.map.set('synk.workspace.after',JSON.stringify({key:'pulse-staff',at:Date.now()-16*60_000}));
  assert.equal(old.run('afterLoginTarget()'),null);assert.equal(old.session.map.size,0);
  const future=page();future.run(appSource);future.session.map.set('synk.workspace.after',JSON.stringify({key:'pulse-staff',at:Date.now()+60_000}));
  assert.equal(future.run('afterLoginTarget()'),null);
  const forged=page();forged.run(appSource);forged.session.map.set('synk.workspace.after',JSON.stringify({key:'toString',at:Date.now()}));
  assert.equal(forged.run('afterLoginTarget()'),null);
  const blocked=page({search:'?after=pulse-staff',session:storage({broken:true})});blocked.run(appSource);
  blocked.run('rememberAfterLogin()');assert.equal(blocked.run('continueAfterLogin()'),false);
});

test('지난 로그인 길과 SYNK ID를 못 쓰는 상태가 회사 비밀번호 줄을 연다',()=>{
  const p=page({extra:{synkCompanyStatus:null}});p.run(appSource);
  assert.equal(p.run('lastWorkspaceLogin()'),'');
  p.run("rememberWorkspaceLogin('password')");assert.equal(p.run('lastWorkspaceLogin()'),'password');
  p.run("rememberWorkspaceLogin('anything')");assert.equal(p.run('lastWorkspaceLogin()'),'password');
  assert.equal(p.run('synkLoginUnavailable()'),false);
  p.run('synkCompanyStatus={enabled:false}');assert.equal(p.run('synkLoginUnavailable()'),true);
  p.run('synkCompanyStatus={enabled:true,browserEnabled:false}');assert.equal(p.run('synkLoginUnavailable()'),true);
  p.context.getSynkDesktopBridge=()=>({});assert.equal(p.run('synkLoginUnavailable()'),false);
  p.run('synkCompanyStatus={enabled:true,browserEnabled:true}');delete p.context.getSynkDesktopBridge;assert.equal(p.run('synkLoginUnavailable()'),false);
});

function synkPage(search,action){
  const p=page({search});if(action!==undefined)p.session.map.set('synk.workspace.synkAction',action);
  p.run('let synkReturnFailure=null,synkReturnRead=false;\n'+synkSource);return p;
}
test('SYNK ID 로그인 실패 복귀는 주소에서 지우고 로그인 화면이 한 번 받는다',()=>{
  const p=synkPage('?tab=messenger&synkError=SYNK_NOT_LINKED','login');
  // 로그인 화면이 DOMContentLoaded보다 먼저 그려져도 같은 값을 받는다.
  assert.equal(p.run('takeSynkReturnFailure()'),'SYNK_NOT_LINKED');
  assert.deepEqual(p.replaced,['/?tab=messenger']);assert.deepEqual(p.notices,[]);assert.equal(p.session.map.size,0);
  p.run('consumeSynkReturn()');assert.equal(p.run('takeSynkReturnFailure()'),null);assert.equal(p.replaced.length,1);
  assert.match(p.run("synkLoginFailureText('SYNK_NOT_LINKED')"),/연결 관리/);
  assert.match(p.run("synkLoginFailureText('SYNK_INACTIVE')"),/관리자/);
  assert.match(p.run("synkLoginFailureText('SYNK_CALLBACK')"),/회사 비밀번호로 들어와/);
  assert.match(p.run("synkLoginFailureText('toString')"),/회사 비밀번호로 들어와/);
  const unnamed=synkPage('?tab=messenger&synkError=SYNK_FLOW');assert.equal(unnamed.run('takeSynkReturnFailure()'),'SYNK_FLOW');assert.deepEqual(unnamed.notices,[]);
});

test('SYNK ID 연결 · 해제 복귀는 알림으로 끝나고 로그인 성공에는 연결 알림을 띄우지 않는다',()=>{
  const failedLink=synkPage('?tab=messenger&synkError=SYNK_FLOW','link');failedLink.run('consumeSynkReturn()');
  assert.equal(failedLink.notices.length,1);assert.match(failedLink.notices[0],/완료하지 못했어요/);assert.equal(failedLink.run('takeSynkReturnFailure()'),null);
  const linked=synkPage('?tab=messenger&synkConnected=1','link');linked.run('consumeSynkReturn()');assert.deepEqual(linked.notices,['SYNK ID 연결을 완료했어요.']);
  const unlinked=synkPage('?tab=messenger&synkConnected=1','unlink');unlinked.run('consumeSynkReturn()');assert.deepEqual(unlinked.notices,['SYNK ID 연결을 해제했어요.']);
  const login=synkPage('?tab=messenger&synkConnected=1','login');login.run('consumeSynkReturn()');
  assert.deepEqual(login.notices,[]);assert.deepEqual(login.replaced,['/?tab=messenger']);assert.equal(login.session.map.size,0);
  const plain=synkPage('?tab=messenger','link');plain.run('consumeSynkReturn()');
  assert.deepEqual(plain.replaced,[]);assert.deepEqual(plain.notices,[]);assert.equal(plain.session.map.size,0);
});

function staffBoot(search,saved,{broken=false}={}){
  const session=storage({broken});if(saved!==undefined&&!broken)session.map.set('synk-pulse-staff-return',typeof saved==='string'?saved:JSON.stringify(saved));
  const p=page({search,pathname:'/pulse-app/',session});p.run(historySource+'\n'+staffSearchSource);
  return {...p,value:p.run('staffSearch'),saved:()=>p.session.map.get('synk-pulse-staff-return')};
}
test('PULSE 직원 딥링크는 로그인하고 꼬리 없이 돌아온 부팅에서 한 번 되살아난다',()=>{
  const deep=`mode=staff&project=${UUID_A}&tab=history&comment=${UUID_B}`;
  const back=staffBoot('?mode=staff',{search:deep,at:Date.now()});
  assert.equal(back.value,'?'+deep);assert.equal(back.saved(),undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(back.run('readStaffHistoryTarget(staffSearch)'))),{projectId:UUID_A,kind:'comment',id:UUID_B});
  assert.equal(staffBoot('?mode=staff',{search:deep,at:Date.now()-31*60_000}).value,'?mode=staff');
  assert.equal(staffBoot('?mode=staff',{search:deep,at:Date.now()+60_000}).value,'?mode=staff');
  assert.equal(staffBoot('?mode=staff',{search:'demo=gift&project=x',at:Date.now()}).value,'?mode=staff');
  assert.equal(staffBoot('?mode=staff','{not json').value,'?mode=staff');
  assert.equal(staffBoot('?mode=staff',undefined,{broken:true}).value,'?mode=staff');
  const fresh=staffBoot(`?mode=staff&project=${UUID_B}`,{search:deep,at:Date.now()});
  assert.equal(fresh.value,`?mode=staff&project=${UUID_B}`);assert.equal(fresh.saved(),undefined);
  const customer=staffBoot('?demo=gift',{search:deep,at:Date.now()});
  assert.equal(customer.value,'?demo=gift');assert.notEqual(customer.saved(),undefined);
});

test('직원 화면의 「SYNK ID로 로그인」은 아직 열지 못한 딥링크만 적어 둔다',()=>{
  assert.ok(staffClickSource,'로그인 단추 클릭 줄이 있어야 한다');
  const listeners=[],session=storage();
  const p=page({pathname:'/pulse-app/',session,extra:{document:{addEventListener(type,listener,capture){listeners.push({type,listener,capture});}}}});
  p.run(`const STAFF_RETURN_KEY='synk-pulse-staff-return';let staffReturnSearch='?mode=staff&project=${UUID_A}&tab=storyboard&scene=${UUID_B}';\n`+staffClickSource);
  assert.equal(listeners.length,1);assert.equal(listeners[0].type,'click');assert.equal(listeners[0].capture,true);
  const click=hit=>listeners[0].listener({target:{closest:selector=>hit&&selector==='[data-staff-login]'?{}:null}});
  click(false);assert.equal(session.map.size,0);
  click(true);const saved=JSON.parse(session.map.get('synk-pulse-staff-return'));
  assert.equal(saved.search,`mode=staff&project=${UUID_A}&tab=storyboard&scene=${UUID_B}`);assert.ok(Math.abs(Date.now()-saved.at)<5000);
  session.map.clear();p.run("staffReturnSearch='?mode=staff'");click(true);assert.equal(session.map.size,0);
  p.run("staffReturnSearch=''");click(true);assert.equal(session.map.size,0);
});
