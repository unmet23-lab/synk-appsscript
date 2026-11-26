'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {createSubscriptionProviders}=require('../src/subscription-providers.cjs');
const {createSubscriptionLogin}=require('../src/subscription-login.cjs');
const {createSharedAccounts,groupSubscriptionReads}=require('../src/subscription-shared-accounts.cjs');
const {createSubscriptionStore}=require('../src/subscription-store.cjs');

test('a registered provider participates in read retry and login verification without service-name branches',async()=>{
  const calls=[];
  const definitions={fixture:{spec:{label:'Fixture',bin:'fixture'},policy:{login:{args:()=>['sign-in']}},create:()=>({
    read:async row=>{calls.push(row.id);return {state:calls.length===1?'needs-login':'ok'};},
    verify:async folder=>({ok:true,email:folder+'@example.test'})
  })}};
  const providers=createSubscriptionProviders({definitions,runtime:{tools:{fixture:{path:'/fixture'}}},accounts:{},system:{},now:()=>10,retryDelay:0});
  assert.deepEqual(await providers.readConfirmed({id:'one',source:'auto',service:'fixture'}),{state:'ok'});
  assert.deepEqual(calls,['one','one']);
  assert.deepEqual(await providers.verifyLogin('fixture','profile'),{ok:true,email:'profile@example.test'});
  assert.equal(providers.get('constructor'),null);
  assert.equal((await providers.readConfirmed({id:'legacy',source:'auto',service:'constructor'})).state,'error');
  assert.equal(await providers.readConfirmed({id:'manual',source:'manual',service:'fixture'}),null);
});

test('login lifecycle uses the registered provider contract and publishes through account operations',async t=>{
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin={write(){}};child.unref=()=>{};
  const spawned=[],added=[],refreshed=[],changes=[];
  const runtime={tools:{fixture:{path:'/fixture'}},detectTools:async()=>{},childEnv:extra=>extra,stopProcess:()=>{},openWindowsConsole:async()=>{},spawnMacTerminal:()=>{}};
  const providers={get:()=>({spec:{label:'Fixture',folders:false},policy:{login:{args:email=>['sign-in',email],domains:['login.example.ai'],acceptsEmail:true,needsCode:true,browserMessage:'fixture message'}}}),verifyLogin:async()=>({ok:true,email:'one@example.test'})};
  const accounts={accountsDir:'/unused',homeEnv:()=>({FIXTURE:'1'}),agyCwd:()=>undefined,rows:()=>[],add:(...args)=>{added.push(args);return {id:'connected'};},refresh:async request=>{refreshed.push(request);},removeFolder:()=>assert.fail('no folder exists')};
  const login=createSubscriptionLogin({runtime,providers,accounts,system:{platform:'linux',env:{},spawn:(...args)=>{spawned.push(args);return child;}},now:()=>10,onChange:()=>changes.push(login.state.stage),openExternal:async()=>{}});
  t.after(()=>login.dispose());
  assert.equal((await login.startLogin('fixture',{email:'one@example.test'})).ok,true);
  assert.deepEqual(spawned[0].slice(0,2),['/fixture',['sign-in','one@example.test']]);
  child.stdout.emit('data','https://login.example.ai.evil.test/oauth\nhttp://login.example.ai/oauth\n');
  assert.equal(login.state.url,null);assert.equal(login.state.stage,'starting');
  child.stdout.emit('data','https://login.example.ai/oauth/authorize');
  assert.equal(login.state.url,'https://login.example.ai/oauth/authorize');
  assert.equal(login.state.needsCode,true);assert.equal(login.state.message,'fixture message');
  child.emit('close',0);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(login.state.stage,'done');
  assert.deepEqual(added,[['fixture',null,{ok:true,email:'one@example.test'}]]);
  // 막 연결한 줄은 도는 확인이 덮었어도 끝난 뒤 다시 읽는다(GPT solio-subs-agy-be-20261126 A4)
  assert.deepEqual(refreshed,[{ids:['connected'],fresh:true}]);
  assert.ok(changes.includes('browser')&&changes.includes('verifying')&&changes.includes('done'));
});

test('on macOS a new login replaces one still waiting on a Terminal window the app cannot watch, elsewhere it stays busy (GPT solio-subs-agy-be-20261126 A8)',async t=>{
  const make=platform=>{
    const opened=[],stopped=[];
    const child=()=>{const c=new EventEmitter();c.unref=()=>{};c.pid=undefined;return c;};
    const runtime={tools:{fixture:{path:'/fixture'}},detectTools:async()=>{},childEnv:extra=>extra,stopProcess:c=>stopped.push(c),openWindowsConsole:async()=>({ok:true,child:child(),pid:7}),spawnMacTerminal:()=>{const c=child();opened.push(c);return c;}};
    const providers={get:()=>({spec:{label:'Fixture',folders:false,consoleLogin:true},policy:{login:{args:()=>[]}}}),verifyLogin:async()=>({ok:false})};
    const accounts={accountsDir:'/unused',homeEnv:()=>({}),agyCwd:()=>undefined,rows:()=>[],add:()=>({id:'x'}),refresh:async()=>{},removeFolder:()=>{}};
    const login=createSubscriptionLogin({runtime,providers,accounts,system:{platform,env:{},spawn:()=>child()},now:()=>10,onChange:()=>{},openExternal:async()=>{}});
    t.after(()=>login.dispose());
    return {login,opened,stopped};
  };
  const mac=make('darwin');
  const first=await mac.login.startLogin('fixture');
  assert.equal(first.ok,true);assert.equal(mac.login.state.stage,'console');
  const firstId=mac.login.state.id;
  // 회원이 Terminal 창을 닫았다. 앱은 모르지만 다시 누르면 새 창으로 이어진다
  const again=await mac.login.startLogin('fixture');
  assert.equal(again.ok,true);
  assert.notEqual(mac.login.state.id,firstId);assert.equal(mac.login.state.stage,'console');
  assert.equal(mac.opened.length,2);assert.equal(mac.stopped[0],mac.opened[0]);
  // Windows는 창이 닫히면 런처가 알려 주므로, 창이 열려 있는 동안의 새 로그인은 전처럼 막는다
  const win=make('win32');
  assert.equal((await win.login.startLogin('fixture')).ok,true);
  assert.deepEqual(await win.login.startLogin('fixture'),{ok:false,code:'LOGIN_BUSY'});
});

test('the macOS Terminal runs one /bin/sh line: the script writes its whole number, execs only while the go mark is there, then becomes the CLI (GPT solio-subs-agy-be-20261126-b GA4 · -c GA2 · -f GA1 · -i GA1)',()=>{
  const {createSubscriptionRuntime}=require('../src/subscription-runtime.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-run-'));
  try{
    const calls=[];const rt=createSubscriptionRuntime({platform:'darwin',env:{},spawn:(cmd,argv)=>{calls.push([cmd,argv]);return new EventEmitter();},now:()=>0,home:'/h'});
    rt.spawnMacTerminal('/opt/tools=work/bin/agy',['-x'],{HOME:"/h/o'k",'BAD KEY':'x'},'/work',dir);
    const run=path.join(dir,'run.sh'),q=v=>"'"+String(v).replace(/'/g,"'\\''")+"'";
    // 회원의 셸이 무엇이든(fish 포함) Terminal에는 /bin/sh와 작은따옴표로 감싼 스크립트 경로만 간다
    assert.equal(calls[0][0],'osascript');
    assert.ok(calls[0][1][1].includes('/bin/sh '+q(run).replace(/\\/g,'\\\\')),calls[0][1][1]);
    assert.ok(!calls[0][1][1].includes('$$')&&!calls[0][1][1].includes(' env '),calls[0][1][1]);
    // 스크립트: 번호를 다 쓰고, go 표식이 있을 때만 이어 간다. env를 거치지 않아 CLI 경로에 =가 있어도 실행 파일이다. 이름 꼴이 아닌 키는 넣지 않는다
    assert.deepEqual(fs.readFileSync(run,'utf8').split('\n'),['#!/bin/sh',"cd '/work' || exit 1",'LC_ALL=C TZ=UTC /bin/ps -o lstart= -p $$ > '+q(path.join(dir,'stamp'))+' || exit 1','echo $$ > '+q(path.join(dir,'pid'))+' || exit 1','[ -e '+q(path.join(dir,'go'))+' ] || exit 0',"export HOME='/h/o'\\''k'","exec '/opt/tools=work/bin/agy' '-x'",'']);
    // 폴더를 주지 않으면 전과 같은 한 줄이다
    rt.spawnMacTerminal('/bin/agy',[],{HOME:'/h'},null);
    assert.ok(calls[1][1][1].includes("HOME='/h' '/bin/agy'")&&!calls[1][1][1].includes('/bin/sh'),calls[1][1][1]);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// macOS Terminal 로그인 가짜. 창 안의 스크립트를 run.sh와 같은 차례로 흉내 낸다(script: 번호 쓰기 → go 확인 → exec).
// pidOf가 번호를 주면 Terminal이 열리자마자 스크립트가 끝까지 돈다. live는 살아 있는 번호, killed는 보낸 신호, counts.verified는 확인 횟수다
function macLogin(t,{pidOf=null,tools=()=>({fixture:{path:'/fixture'}}),spec={label:'Fixture',folders:false,consoleLogin:true},verify=async()=>({ok:false})}={}){
  const opened=[],stopped=[],killed=[],live=new Set(),stamps=new Map(),ps={fail:false};let calls=0;const counts={verified:0},clock={now:10};
  const child=()=>{const c=new EventEmitter();c.unref=()=>{};c.pid=undefined;c.stdout=new EventEmitter();c.stderr=new EventEmitter();return c;};
  // run.sh의 차례: 번호를 쓰지 못하면 끝, go가 없으면 끝, 있으면 exec(살아 있는 번호가 된다)
  const script=(runDir,pid,{before}={})=>{try{fs.writeFileSync(path.join(runDir,'stamp'),'Wed Nov 26  0'+(stamps.get(pid)||'s1')+'\n');fs.writeFileSync(path.join(runDir,'pid'),String(pid));}catch{return 'no-folder';}before?.();if(!fs.existsSync(path.join(runDir,'go')))return 'stopped';live.add(pid);return 'exec';};
  const runtime={tools:tools(0),detectTools:async()=>{runtime.tools=tools(++calls);},childEnv:extra=>extra,stopProcess:c=>stopped.push(c),openWindowsConsole:async()=>({ok:true,child:child(),pid:7}),
    spawnMacTerminal:(file,args,env,cwd,runDir)=>{const c=child();opened.push({c,runDir});const pid=pidOf?.(opened.length);if(pid)script(runDir,pid);return c;}};
  const providers={get:()=>({spec,policy:{login:{args:()=>[]}}}),verifyLogin:async(...a)=>{counts.verified++;return verify(...a);}};
  const accounts={accountsDir:'/unused',homeEnv:()=>({}),agyCwd:()=>undefined,rows:()=>[],add:()=>({id:'x'}),refresh:async()=>{},removeFolder:()=>{}};
  const kill=(pid,signal)=>{if(signal!==0){killed.push([pid,signal]);live.delete(pid);return;}if(!live.has(pid)){const e=new Error('ESRCH');e.code='ESRCH';throw e;}};
  const login=createSubscriptionLogin({runtime,providers,accounts,system:{platform:'darwin',env:{},spawn:()=>child(),kill,processStamp:pid=>ps.fail||!live.has(pid)?null:'Wed Nov 26 0'+(stamps.get(pid)||'s1')},now:()=>clock.now,onChange:()=>{},openExternal:async()=>{}});
  t.after(()=>{login.dispose();for(const o of opened)if(o.runDir){fs.rmSync(o.runDir,{recursive:true,force:true});fs.rmSync(o.runDir+'-stop',{recursive:true,force:true});}});
  return {login,opened,stopped,killed,live,counts,clock,script,stamps,ps};
}
const SIGNALS=pid=>[[-pid,'SIGTERM'],[pid,'SIGTERM'],[-pid,'SIGHUP'],[pid,'SIGHUP']];

test('on macOS a failed new login request leaves the Terminal login it would replace untouched (GPT solio-subs-agy-be-20261126-b GA1 · -c GA4)',async t=>{
  // 둘째 요청 때 CLI가 없어진다
  const gone=macLogin(t,{tools:n=>({fixture:{path:n>=2?null:'/fixture'}})});
  assert.equal((await gone.login.startLogin('fixture')).ok,true);
  const first=gone.login.state;
  assert.deepEqual(await gone.login.startLogin('fixture'),{ok:false,code:'TOOL_MISSING'});
  assert.equal(gone.login.state,first);assert.equal(first.stage,'console');assert.equal(gone.stopped.length,0);
  assert.ok(fs.existsSync(path.join(gone.opened[0].runDir,'go')));
  // CLI는 있고 메일이 틀린 요청도 앞 로그인을 끝내지 않는다(메일 검사까지 간다)
  const mail=macLogin(t);
  assert.equal((await mail.login.startLogin('fixture')).ok,true);
  const kept=mail.login.state;
  assert.deepEqual(await mail.login.startLogin('fixture',{email:'not-mail'}),{ok:false,code:'INVALID_EMAIL'});
  assert.equal(mail.login.state,kept);assert.equal(kept.stage,'console');assert.equal(mail.stopped.length,0);
});

test('on macOS the app follows the CLI inside the Terminal window: busy while it runs, signalled at once on cancel, finished when the window closes (GPT solio-subs-agy-be-20261126-b GA4 · -c GA1 · -e GA2 · -g GA2)',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const m=macLogin(t,{pidOf:n=>4000+n});
  assert.equal((await m.login.startLogin('fixture')).ok,true);
  const first=m.login.state;
  assert.ok(m.live.has(4001));
  // 창 안의 CLI가 살아 있으면 Windows처럼 막는다
  assert.deepEqual(await m.login.startLogin('fixture'),{ok:false,code:'LOGIN_BUSY'});
  // 취소는 osascript가 아니라 창 안의 CLI와 그 묶음에 SIGTERM · SIGHUP을 같은 때 보내고 회차 폴더를 지운다. 늦게 보내는 신호는 없다
  assert.equal(m.login.cancelLogin(first.id).ok,true);
  assert.deepEqual(m.killed,SIGNALS(4001));assert.equal(first.stage,'cancelled');assert.equal(fs.existsSync(m.opened[0].runDir),false);
  m.live.add(4001);t.mock.timers.tick(10000);
  assert.deepEqual(m.killed,SIGNALS(4001));
  // 끝난 회차를 다시 취소해도 그 번호를 다시 끄지 않는다(번호가 다른 프로그램에 다시 쓰였을 수 있다)
  assert.equal(m.login.cancelLogin(first.id).ok,true);
  assert.deepEqual(m.killed,SIGNALS(4001));
  // 새 로그인: 회원이 창을 닫으면(CLI가 끝나면) 다음 확인에서 한 번 읽고 바로 알린다. 10분을 기다리지 않는다
  assert.equal((await m.login.startLogin('fixture')).ok,true);
  const second=m.login.state,before=m.counts.verified;
  m.live.delete(4002);
  t.mock.timers.tick(6000);
  for(let i=0;i<20&&second.stage==='console';i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(second.stage,'error');assert.match(second.message,/Terminal 창이 닫혔는데/);
  assert.equal(m.counts.verified,before+1);
  assert.equal(fs.existsSync(m.opened[1].runDir),false);
});

test('on macOS a cancel never lets the Terminal script start the CLI, whichever side moves first (GPT solio-subs-agy-be-20261126-c GA5 · GA8 · GA3, -g GA1 · GA5, -i GA1)',async t=>{
  // ① 스크립트가 아직 돌지 않았다: 취소 뒤 폴더가 없어 번호를 쓰지 못한다
  const a=macLogin(t);
  assert.equal((await a.login.startLogin('fixture')).ok,true);
  const ca=a.login.state,dirA=a.opened[0].runDir;
  assert.equal(a.login.cancelLogin(ca.id).ok,true);
  assert.equal(ca.stage,'cancelled');assert.deepEqual(a.killed,[]);assert.equal(fs.existsSync(dirA),false);
  assert.equal(a.script(dirA,4100),'no-folder');assert.equal(a.live.size,0);
  // ② 스크립트가 번호를 쓴 뒤 go를 보기 전에 취소가 왔다: go가 없어 스스로 끝난다(번호를 연 뒤 쓰기 전의 틈과 같다)
  const b=macLogin(t);
  assert.equal((await b.login.startLogin('fixture')).ok,true);
  const cb=b.login.state,dirB=b.opened[0].runDir;
  let outcome=null;
  outcome=b.script(dirB,4200,{before:()=>assert.equal(b.login.cancelLogin(cb.id).ok,true)});
  assert.equal(outcome,'stopped');assert.equal(b.live.size,0);assert.equal(cb.stage,'cancelled');
  // ③ 스크립트가 go를 본 뒤(exec 직전)에 취소가 왔다: 번호가 이미 다 쓰여 있어 앱이 읽고 끈다
  const c=macLogin(t);
  assert.equal((await c.login.startLogin('fixture')).ok,true);
  const cc=c.login.state,dirC=c.opened[0].runDir;
  assert.equal(c.script(dirC,4300),'exec');
  assert.equal(c.login.cancelLogin(cc.id).ok,true);
  assert.deepEqual(c.killed,SIGNALS(4300));assert.equal(c.live.size,0);assert.equal(fs.existsSync(dirC),false);
  // 번호를 모르는 Terminal 로그인은 새 요청이 바꾼다. 바뀐 회차도 같은 방법으로 막힌다
  assert.equal((await a.login.startLogin('fixture')).ok,true);
  const stale=a.login.state,staleDir=a.opened[1].runDir;
  assert.equal((await a.login.startLogin('fixture')).ok,true);
  assert.equal(stale.stage,'cancelled');assert.equal(fs.existsSync(staleDir),false);assert.notEqual(a.login.state,stale);
  assert.equal(a.script(staleDir,4400),'no-folder');
});

test('on macOS a refused Terminal (osascript fails) ends the login at once (설계 검토 P2-3)',async t=>{
  // Terminal 제어를 거절해 osascript가 1로 끝나고 스크립트가 번호를 쓰지 못했으면 바로 알린다
  const refused=macLogin(t);
  assert.equal((await refused.login.startLogin('fixture')).ok,true);
  const r=refused.login.state;
  refused.opened[0].c.emit('close',1);
  assert.equal(r.stage,'error');assert.match(r.message,/Terminal 창을 열지 못했습니다/);assert.equal(fs.existsSync(refused.opened[0].runDir),false);
  // osascript가 0으로 끝나면 그대로 기다린다
  const fine=macLogin(t);
  assert.equal((await fine.login.startLogin('fixture')).ok,true);
  fine.opened[0].c.emit('close',0);
  assert.equal(fine.login.state.stage,'console');
});

test('on macOS a window that never wrote its number ends 30 seconds after osascript opened it, without reading the account, and a late script stays stopped (GPT -g GA6 · -k GA1 · GA4 · -l GA2 · -n GA2 · GA4)',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const flush=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
  const quiet=macLogin(t);
  assert.equal((await quiet.login.startLogin('fixture')).ok,true);
  const q=quiet.login.state,qDir=quiet.opened[0].runDir;
  // osascript가 아직 끝나지 않았으면(Terminal 제어 허용을 묻는 중) 31초가 지나도 기다린다
  quiet.clock.now+=31000;t.mock.timers.tick(6000);await flush();
  assert.equal(q.stage,'console');
  // osascript가 0으로 끝난 때부터 센다: 29초에는 기다리고 31초에 끝낸다. 그 경로는 계정을 읽지 않는다
  quiet.opened[0].c.emit('close',0);
  quiet.clock.now+=29000;t.mock.timers.tick(4000);await flush();
  assert.equal(q.stage,'console');
  const before=quiet.counts.verified;
  quiet.clock.now+=2000;t.mock.timers.tick(4000);await flush();
  assert.equal(q.stage,'error');assert.match(q.message,/로그인이 시작되지 않았습니다/);
  assert.equal(quiet.counts.verified,before);assert.equal(fs.existsSync(qDir),false);
  // 그 뒤 늦게 뜬 스크립트는 CLI가 되지 않는다
  assert.equal(quiet.script(qDir,4600),'no-folder');assert.equal(quiet.live.size,0);
  // 30초 안에 창이 늦게 떠 CLI가 돌기 시작했으면 30초가 지나도 기다린다. 그 CLI가 끝나면 그때 한 번 읽고 마친다
  const slow=macLogin(t);
  assert.equal((await slow.login.startLogin('fixture')).ok,true);
  const w=slow.login.state,wDir=slow.opened[0].runDir;
  slow.opened[0].c.emit('close',0);
  slow.clock.now+=20000;assert.equal(slow.script(wDir,4700),'exec');
  slow.clock.now+=20000;t.mock.timers.tick(6000);await flush();
  assert.equal(w.stage,'console');assert.ok(slow.live.has(4700));assert.deepEqual(slow.killed,[]);
  const seen=slow.counts.verified;
  slow.live.delete(4700);t.mock.timers.tick(4000);await flush();
  assert.equal(w.stage,'error');assert.match(w.message,/Terminal 창이 닫혔는데/);assert.equal(slow.counts.verified,seen+1);
});

test('on macOS a number whose start time cannot be read is treated as still busy and never signalled (GPT solio-subs-agy-be-20261126-n GA1)',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const m=macLogin(t,{pidOf:n=>4900+n});
  assert.equal((await m.login.startLogin('fixture')).ok,true);
  const first=m.login.state;
  m.ps.fail=true;
  // 모르면 둘째 CLI를 열지 않고, 창이 닫힌 것으로도 보지 않는다
  assert.deepEqual(await m.login.startLogin('fixture'),{ok:false,code:'LOGIN_BUSY'});
  t.mock.timers.tick(6000);for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(first.stage,'console');
  // 취소는 회차를 끝내지만 누구 것인지 모르는 번호에는 신호를 보내지 않는다
  assert.equal(m.login.cancelLogin(first.id).ok,true);
  assert.equal(first.stage,'cancelled');assert.deepEqual(m.killed,[]);
});

test('on macOS a number reused by another program after the CLI ended is never signalled, and does not keep the login busy (GPT solio-subs-agy-be-20261126-k GA3)',async t=>{
  const m=macLogin(t,{pidOf:n=>4800+n});
  assert.equal((await m.login.startLogin('fixture')).ok,true);
  const first=m.login.state;
  // 처음 읽은 때의 시작 시각을 적는다(살아 있는 동안은 막는다)
  assert.deepEqual(await m.login.startLogin('fixture'),{ok:false,code:'LOGIN_BUSY'});
  // CLI가 끝나고 같은 번호가 다른 프로그램에 다시 쓰였다(살아 있지만 시작 시각이 다르다)
  m.stamps.set(4801,'other-program');
  assert.equal(m.login.cancelLogin(first.id).ok,true);
  assert.equal(first.stage,'cancelled');assert.deepEqual(m.killed,[]);
  // 바꾸기도 같은 판단이다: 다른 프로그램이 된 번호는 로그인을 붙잡지 않는다
  assert.equal((await m.login.startLogin('fixture')).ok,true);
  const second=m.login.state;
  assert.deepEqual(await m.login.startLogin('fixture'),{ok:false,code:'LOGIN_BUSY'});
  m.stamps.set(4802,'other-program');
  assert.equal((await m.login.startLogin('fixture')).ok,true);
  assert.equal(second.stage,'cancelled');assert.deepEqual(m.killed,[]);
});

test('on macOS stopping removes the go mark of this very run folder before it reads the number, so a script between the two can never exec (GPT solio-subs-agy-be-20261126-k GA2 · -l GA1 · -m GA1 · -q GA1)',async t=>{
  const m=macLogin(t);
  assert.equal((await m.login.startLogin('fixture')).ok,true);
  const current=m.login.state,dir=m.opened[0].runDir,log=[];
  const rm0=fs.rmSync,read0=fs.readFileSync;
  const go=path.join(dir,'go'),pidFile=path.join(dir,'pid');
  t.mock.method(fs,'rmSync',function(...a){if(String(a[0])===go)log.push('rm go');return rm0.apply(fs,a);});
  t.mock.method(fs,'readFileSync',function(...a){if(String(a[0])===pidFile)log.push('read pid');return read0.apply(fs,a);});
  assert.equal(m.login.cancelLogin(current.id).ok,true);
  t.mock.restoreAll();
  const goGone=log.indexOf('rm go'),pidRead=log.indexOf('read pid');
  assert.ok(goGone>=0&&pidRead>goGone,log.join(', '));
});

test('the generated run.sh really writes its number, stops when the go mark is gone, and otherwise becomes the CLI (설계 검토 P2-4, POSIX sh only)',{skip:process.platform==='win32'?'POSIX sh가 없는 Windows':false},()=>{
  const {createSubscriptionRuntime}=require('../src/subscription-runtime.cjs');
  const {spawnSync}=require('node:child_process');
  const q=v=>"'"+String(v).replace(/'/g,"'\\''")+"'";
  const make=go=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-run-'));if(go)fs.writeFileSync(path.join(dir,'go'),'');const rt=createSubscriptionRuntime({platform:'darwin',env:{},spawn:()=>new EventEmitter(),now:()=>0,home:'/h'});
    const out=path.join(dir,'out');rt.spawnMacTerminal('/bin/sh',['-c','echo "$$ $SYNK_T" > '+q(out)],{SYNK_T:"a'b"},dir,dir);return {dir,out};};
  const a=make(true);
  try{
    const r=spawnSync('/bin/sh',[path.join(a.dir,'run.sh')]);assert.equal(r.status,0);
    const [pid,value]=fs.readFileSync(a.out,'utf8').trim().split(' ');
    // exec 뒤에도 번호가 같고, 환경 값이 따옴표째 넘어간다
    assert.equal(pid,fs.readFileSync(path.join(a.dir,'pid'),'utf8').trim());assert.equal(value,"a'b");
    // C 로캘 · UTC의 lstart 꼴(예: Wed Nov 26 03:04:05 2026)
    assert.match(fs.readFileSync(path.join(a.dir,'stamp'),'utf8').trim(),/^[A-Z][a-z]{2} [A-Z][a-z]{2} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/);
  }finally{fs.rmSync(a.dir,{recursive:true,force:true});}
  const b=make(false);
  try{
    assert.equal(spawnSync('/bin/sh',[path.join(b.dir,'run.sh')]).status,0);
    assert.equal(fs.existsSync(b.out),false);
  }finally{fs.rmSync(b.dir,{recursive:true,force:true});}
});

test('on macOS a browser login still in progress is not replaced by a second request (GPT solio-subs-agy-be-20261126-d GA1)',async t=>{
  const m=macLogin(t,{spec:{label:'Fixture',folders:false,consoleLogin:false}});
  assert.equal((await m.login.startLogin('fixture')).ok,true);
  assert.notEqual(m.login.state.stage,'console');
  assert.deepEqual(await m.login.startLogin('fixture'),{ok:false,code:'LOGIN_BUSY'});
  assert.equal(m.stopped.length,0);
});

test('inherited object names never own shared account reads',()=>{
  const rows=['__proto__','constructor','toString'].map(service=>({id:service,service,source:'auto'}));
  const work=groupSubscriptionReads(rows,rows,{});
  assert.deepEqual(work.groups.map(group=>group.owner),[null,null,null]);
  assert.deepEqual(work.groups.map(group=>group.row),rows);
});

test('shared-login account owner preserves identity, hidden accounts, and read coverage for any provider',()=>{
  const a={id:'a',service:'fixture',source:'auto',email:'a@example.test',state:'ok',live:{used:20}};
  const b={id:'b',service:'fixture',source:'auto',email:'b@example.test',state:'elsewhere',live:{used:50}};
  const ordinary={id:'ordinary',service:'other',source:'auto'},board={rows:[a,ordinary,b],settings:{}};
  const policy={hiddenKey:'fixtureHidden',hiddenMax:20,awayMessage:'away',nobodyMessage:'nobody',unknownMessage:'unknown'};
  const owner=createSharedAccounts({service:'fixture',policy,load:()=>board,now:()=>42,applyRead:(row,result)=>Object.assign(row,result),addRow:()=>assert.fail('hidden account must not be recreated')});
  owner.apply({state:'ok',email:'B@example.test',live:{used:55}});
  assert.equal(a.state,'elsewhere');assert.deepEqual(a.live,{used:20});assert.deepEqual(b.live,{used:55});
  owner.remove(b);board.rows.splice(board.rows.indexOf(b),1);
  owner.apply({state:'ok',email:'B@example.test',live:{used:60}});
  assert.deepEqual(board.settings.fixtureHidden,['b@example.test']);assert.equal(board.rows.length,2);
  owner.reconnect('b@example.test');assert.deepEqual(board.settings.fixtureHidden,[]);
  board.rows.push(b);
  const work=groupSubscriptionReads([ordinary,b],board.rows,{fixture:owner});
  assert.deepEqual([...work.covered],['ordinary','b','a']);
  assert.equal(work.groups[0].row,ordinary);assert.equal(work.groups[1].owner,owner);assert.equal(work.groups[1].count,1);
});

test('persist before first explicit load keeps an existing board',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-store-first-save-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'board.json'),JSON.stringify({version:1,rows:[{id:'kept'}],settings:{usdKrw:1300}}));
  const store=createSubscriptionStore({root,now:()=>1,normalizeRow:row=>row});
  store.persist();
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'board.json'))).rows,[{id:'kept'}]);
});

