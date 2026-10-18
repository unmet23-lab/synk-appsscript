'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {createAiSubscriptions,parseClaudeUsage,parseResetText,codexWindows,parseAgyUsage,loginUrl,claudeNeedsLogin,commandFor,candidatePaths}=require('../src/ai-subscriptions.cjs');

const USAGE=`You are currently using your subscription to power your Claude Code usage

Current session: 51% used · resets Oct 17, 11:19am (Asia/Seoul)
Current week (all models): 31% used · resets Oct 22, 10:59am (Asia/Seoul)
Current week (Fable): 17% used · resets Oct 22, 10:59am (Asia/Seoul)`;
const NOW=new Date(2026,9,17,10,0).getTime();
// Antigravity CLI 1.4.0 `agy -p /usage --output-format json`의 실제 모양(값만 바꿈).
const AGY_USAGE=JSON.stringify({conversation_id:'',status:'SUCCESS',response:'Gemini Models\tWeekly Limit Remaining\t64%\t…',duration_seconds:0,num_turns:0,usage:{total_tokens:0},command:{name:'usage',data:{description:'Within each group, models share a weekly limit and a 5-hour limit.',groups:[
  {name:'Gemini Models',description:'Models within this group: Gemini Flash, Gemini Pro',buckets:[{id:'gemini-weekly',name:'Weekly Limit Remaining',window:'weekly',remaining_fraction:0.64,reset_time:'2026-10-24T02:25:55Z'},{id:'gemini-5h',name:'Five Hour Limit Remaining',window:'5h',remaining_fraction:0.1,reset_time:'2026-10-17T07:25:55Z'}]},
  {name:'Claude and GPT models',description:'Models within this group: Claude Opus, Claude Sonnet, GPT-OSS',buckets:[{id:'3p-weekly',name:'Weekly Limit Remaining',window:'weekly',remaining_fraction:1,reset_time:'2026-10-24T02:25:55Z'},{id:'3p-5h',name:'Five Hour Limit Remaining',window:'5h',remaining_fraction:1,reset_time:'2026-10-17T07:25:55Z'}]}]}}});

test('reads the official Claude Code usage text without touching credentials',()=>{
  const usage=parseClaudeUsage(USAGE,new Date(NOW));
  assert.equal(usage.session.usedPercent,51);
  assert.equal(usage.weekly.usedPercent,31);
  assert.equal(new Date(usage.weekly.resetsAt).getDate(),22);
  assert.equal(new Date(usage.weekly.resetsAt).getHours(),10);
  assert.equal(new Date(usage.weekly.resetsAt).getMinutes(),59);
  assert.deepEqual(usage.models.map(m=>[m.name,m.usedPercent]),[['Fable',17]]);
  assert.equal(new Date(parseResetText('Jan 3, 9am',new Date(2026,11,30))).getFullYear(),2027);
  assert.equal(parseClaudeUsage('Not logged in · Please run /login').weekly,null);
  assert.equal(claudeNeedsLogin('Not logged in · Please run /login'),true);
  assert.equal(claudeNeedsLogin(USAGE),false);
});

test('sorts Codex windows by length, not by primary or secondary order',()=>{
  const w=codexWindows({primary:{usedPercent:100,windowDurationMins:10080,resetsAt:1792742616},secondary:null});
  assert.equal(w.weekly.usedPercent,100);assert.equal(w.session,null);assert.equal(w.weekly.resetsAt,1792742616000);
  const both=codexWindows({primary:{usedPercent:12,windowDurationMins:300,resetsAt:1},secondary:{usedPercent:40,windowDurationMins:10080,resetsAt:2}});
  assert.equal(both.session.usedPercent,12);assert.equal(both.weekly.usedPercent,40);
  // 하나도 안 쓴 창은 초기화 시각이 「읽은 시각+기간」으로 밀려 오므로 비운다(10-18 실제 계정: 0%, 정확히 168시간 뒤).
  const at=Date.UTC(2026,9,18,2,7,22),sec=Math.floor(at/1000);
  const idle=codexWindows({primary:{usedPercent:0,windowDurationMins:10080,resetsAt:sec+10080*60}},at);
  assert.equal(idle.weekly.usedPercent,0);assert.equal(idle.weekly.resetsAt,null);
  // 0%여도 이미 시작한 창, 쓰기 시작한 창의 시각은 그대로 둔다.
  assert.equal(codexWindows({primary:{usedPercent:0,windowDurationMins:10080,resetsAt:sec+3*86400}},at).weekly.resetsAt,(sec+3*86400)*1000);
  assert.equal(codexWindows({primary:{usedPercent:3,windowDurationMins:10080,resetsAt:sec+10080*60}},at).weekly.resetsAt,(sec+10080*60)*1000);
});

test('reads the Antigravity quota groups: Gemini as the main limit, Claude·GPT as a model line',()=>{
  const usage=parseAgyUsage(AGY_USAGE);
  assert.equal(usage.weekly.usedPercent,36);assert.equal(usage.weekly.resetsAt,Date.parse('2026-10-24T02:25:55Z'));
  assert.equal(usage.session.usedPercent,90);
  assert.deepEqual(usage.models.map(m=>[m.name,m.usedPercent]),[['Claude·GPT 모델',0]]);
  // 하나도 안 쓴 묶음은 기간이 시작되지 않아 초기화 시각을 비운다.
  assert.equal(usage.models[0].resetsAt,null);
  // 실패 응답이나 남은 비율이 없는 버킷은 숫자를 지어내지 않는다.
  assert.equal(parseAgyUsage(JSON.stringify({status:'ERROR',command:{data:{groups:[]}}})),null);
  assert.equal(parseAgyUsage('Not signed in'),null);
  const noFraction=parseAgyUsage(JSON.stringify({status:'SUCCESS',command:{data:{groups:[{name:'Gemini Models',buckets:[{window:'weekly',reset_time:'2026-10-24T02:25:55Z'}]}]}}}));
  assert.equal(noFraction.weekly,null);
  // 공식 설치 위치와 winget 링크 폴더에서도 agy를 찾는다.
  const found=candidatePaths('agy',{platform:'win32',env:{LOCALAPPDATA:'C:\\L'},home:'C:\\H'});
  assert.ok(found.includes(path.join('C:\\L','agy','bin','agy.exe')));assert.ok(found.includes(path.join('C:\\L','Microsoft','WinGet','Links','agy.exe')));
});

test('accepts login pages only from the official sign-in domains',()=>{
  assert.match(loginUrl('Opening browser… visit: https://claude.com/cai/oauth/authorize?code=true&x=1'),/^https:\/\/claude\.com\/cai\/oauth\/authorize/);
  assert.match(loginUrl('navigate to https://auth.openai.com/oauth/authorize?response_type=code'),/^https:\/\/auth\.openai\.com/);
  assert.equal(loginUrl('visit https://evil-claude.com.example/oauth/authorize'),null);
  assert.equal(loginUrl('visit http://claude.com/oauth'),null);
});

test('npm shims run through cmd with fixed quoted arguments and executables run directly',()=>{
  const direct=commandFor('C:\\Users\\a b\\.local\\bin\\claude.exe',['-p','/usage'],{platform:'win32',env:{}});
  assert.equal(direct.command,'C:\\Users\\a b\\.local\\bin\\claude.exe');assert.deepEqual(direct.argv,['-p','/usage']);
  const shim=commandFor('C:\\Users\\a b\\AppData\\Roaming\\npm\\codex.cmd',['app-server'],{platform:'win32',env:{ComSpec:'C:\\Windows\\cmd.exe'}});
  assert.equal(shim.command,'C:\\Windows\\cmd.exe');assert.equal(shim.verbatim,true);
  assert.equal(shim.argv.at(-1),'""C:\\Users\\a b\\AppData\\Roaming\\npm\\codex.cmd" app-server"');
});

/* ---------- 가짜 공식 프로그램 ---------- */
function fakeSystem({claudeLoggedIn=true,geminiLoggedIn=true,fetch=null,secrets=null}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-subs-'));
  const home=path.join(root,'home'),bin=path.join(home,'.local','bin'),npm=path.join(root,'npm'),agyBin=path.join(root,'local','agy','bin');
  fs.mkdirSync(bin,{recursive:true});fs.mkdirSync(npm,{recursive:true});fs.mkdirSync(agyBin,{recursive:true});
  for(const file of [path.join(bin,'claude.exe'),path.join(npm,'codex.cmd'),path.join(npm,'higgsfield.exe'),path.join(npm,'npm.cmd'),path.join(agyBin,'agy.exe')])fs.writeFileSync(file,'');
  // higgsHomes: 홈 폴더(USERPROFILE)마다 Higgsfield 로그인. 기본 홈은 77@example.com.
  const calls=[],stdinWrites=[];let loginChild=null;const state={claudeLoggedIn,geminiLoggedIn,higgsHomes:{},nextHiggsEmail:'second@example.com'};
  function spawn(command,argv,options){
    const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
    const call={command,argv,options};calls.push(call);
    const joined=[command,...argv].join(' ');
    const reply=(out,code=0)=>setImmediate(()=>{if(out)child.stdout.emit('data',out);child.emit('close',code);});
    child.kill=()=>setImmediate(()=>child.emit('close',null));child.unref=()=>{};
    child.stdin={write(text){stdinWrites.push(text);if(child.onInput)child.onInput(text);return true;},end(){}};
    if(command==='powershell.exe')reply('');
    else if(joined.includes('--version'))reply(command.endsWith('claude.exe')?'2.1.301 (Claude Code)\n':'1.0.0\n');
    else if(command.endsWith('agy.exe')){if(argv.includes('/usage'))reply(state.geminiLoggedIn?AGY_USAGE:'Error: not signed in. Run agy to sign in.\n',state.geminiLoggedIn?0:1);}
    else if(joined.includes('/usage'))reply(state.claudeLoggedIn?USAGE:'Not logged in · Please run /login\n',state.claudeLoggedIn?0:1);
    else if(joined.includes('auth status'))reply(JSON.stringify({loggedIn:state.claudeLoggedIn,email:'member@example.com',subscriptionType:'max'}));
    else if(joined.includes('auth login')&&command.endsWith('claude.exe')){loginChild=child;setImmediate(()=>child.stdout.emit('data','Opening browser to sign in…\nIf the browser didn\'t open, visit: https://claude.com/cai/oauth/authorize?code=true&state=abc\nPaste code here if prompted > '));child.onInput=()=>{state.claudeLoggedIn=true;setImmediate(()=>child.emit('close',0));};}
    else if(joined.includes('app-server')){
      child.onInput=text=>{for(const line of text.split('\n').filter(Boolean)){const m=JSON.parse(line);
        const send=v=>setImmediate(()=>child.stdout.emit('data',JSON.stringify(v)+'\n'));
        if(m.method==='initialize')send({id:m.id,result:{}});
        else if(m.method==='account/read')send({id:m.id,result:{account:{type:'chatgpt',email:'synk@example.com',planType:'pro'}}});
        else if(m.method==='account/rateLimits/read')send({id:m.id,result:{rateLimits:{planType:'pro',primary:{usedPercent:100,windowDurationMins:10080,resetsAt:Math.floor(NOW/1000)+86400},secondary:null}}});}};
    }
    else if(joined.includes('auth login')&&command.endsWith('higgsfield.exe')){
      // 실제 CLI처럼 주소를 찍고, 브라우저 승인이 끝나면 그 홈에 로그인을 두고 끝난다(작업공간은 비어 있음).
      const homeDir=options.env.USERPROFILE;
      setImmediate(()=>child.stdout.emit('data','Opening browser for authentication...\nIf browser does not open, visit: https://clerk.higgsfield.ai/oauth/authorize?client_id=x&state=abc\nWaiting for approval...\n'));
      setTimeout(()=>{state.higgsHomes[homeDir]={email:state.nextHiggsEmail,workspace:null};child.emit('close',0);},10);
    }
    else if(joined.includes('workspace list'))reply(JSON.stringify([{id:'ws-member-0001',name:null,plan_type:'ultra',credits:1373.34,is_selected:false,user_role:'owner'}]));
    else if(joined.includes('workspace set')){const h=state.higgsHomes[options.env.USERPROFILE];if(h)h.workspace=argv.at(-1);reply('Selected workspace: '+argv.at(-1)+'\n',h?0:1);}
    else if(joined.includes('account status')){
      const h=state.higgsHomes[options.env.USERPROFILE];
      if(!h)reply(JSON.stringify({credits:0.22,email:'77@example.com',subscription_plan_type:'ultra'}));
      else if(!h.workspace)reply('Error: No workspace selected.\nHint: Run: higgsfield workspace set <workspace_id>\n',1);
      else reply(JSON.stringify({credits:1373.34,email:h.email,subscription_plan_type:'ultra'}));
    }
    else reply('',1);
    return child;
  }
  const changes=[],opened=[];
  const service=createAiSubscriptions({root:path.join(root,'data'),platform:'win32',env:{PATH:npm,APPDATA:path.join(root,'appdata'),LOCALAPPDATA:path.join(root,'local'),ComSpec:'cmd.exe',CLAUDECODE:'1',CLAUDE_CONFIG_DIR:'X'},home,spawn,...(fetch?{fetch}:{}),...(secrets?{secrets}:{}),now:()=>NOW,openExternal:async url=>opened.push(url),onChange:s=>changes.push(s)});
  return {root,service,calls,stdinWrites,changes,opened,state,get loginChild(){return loginChild;}};
}

test('finds the official tools, reads existing logins and keeps tokens out of the snapshot',async()=>{
  const f=fakeSystem();
  const snap=await f.service.snapshot();
  assert.deepEqual(Object.fromEntries(Object.entries(snap.tools).map(([k,v])=>[k,v.installed])),{claude:true,gpt:true,higgsfield:true,gemini:true,typecast:true});
  assert.equal(snap.tools.typecast.api,true);
  const claude=await f.service.useExisting('claude');assert.equal(claude.ok,true);
  const gpt=await f.service.useExisting('gpt');assert.equal(gpt.ok,true);
  const higgs=await f.service.useExisting('higgsfield');assert.equal(higgs.ok,true);
  const firstChange=f.changes.length;
  const after=await f.service.check();
  // 확인을 시작하는 첫 알림부터 「확인 중」이어야 화면이 잠깐 끝난 것처럼 보이지 않는다.
  assert.equal(f.changes[firstChange].checking,true);
  // 돌려받는 결과는 확인이 끝난 상태이고 마지막 알림보다 번호가 크다. 늦게 도착해도 화면이 「확인 중」으로 돌아가지 않는다.
  assert.equal(after.checking,false);assert.equal(f.changes.at(-1).checking,false);assert.ok(after.seq>f.changes.at(-1).seq);
  assert.ok(f.changes.every((s,i)=>i===0||s.seq>f.changes[i-1].seq));
  const by=Object.fromEntries(after.rows.map(r=>[r.service,r]));
  assert.equal(by.claude.email,'member@example.com');assert.equal(by.claude.live.weekly.usedPercent,31);assert.equal(by.claude.resetDay,4);assert.equal(by.claude.resetHour,10);
  assert.equal(by.gpt.email,'synk@example.com');assert.equal(by.gpt.live.weekly.usedPercent,100);assert.equal(by.gpt.usedUpAt,NOW);
  assert.equal(by.higgsfield.credits,0.22);assert.equal(by.higgsfield.plan,'ultra');
  assert.equal(after.check.total,3);assert.equal(after.check.ok,3);
  // 자식 프로세스에는 개발 세션의 Claude 변수가 새지 않고, 기본 로그인은 기본 폴더를 쓴다.
  const usageCall=f.calls.find(c=>c.argv.includes('/usage'));
  assert.equal(usageCall.options.env.CLAUDECODE,undefined);assert.equal(usageCall.options.env.CLAUDE_CONFIG_DIR,undefined);assert.equal(usageCall.options.shell,false);
  assert.ok(!JSON.stringify(after).includes('Token'));
  // 저장 파일도 다시 읽힌다.
  const reread=createAiSubscriptions({root:path.join(f.root,'data'),platform:'win32',env:{},home:path.join(f.root,'home'),spawn:()=>{throw new Error('no spawn');},now:()=>NOW});
  assert.equal((await reread.save({settings:{usdKrw:1380}})).rows.length,3);
});

test('a second check while one runs shares it and also gets the finished board',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('claude');
  const usage=()=>f.calls.filter(c=>c.argv.includes('/usage')).length,before=usage();
  const [a,b]=await Promise.all([f.service.check(),f.service.check()]);
  assert.equal(usage(),before+1);
  assert.equal(a.checking,false);assert.equal(b.checking,false);assert.equal(b.check.total,1);
});

test('signs in a new Claude account in its own folder with the code typed into the app',async()=>{
  const f=fakeSystem({claudeLoggedIn:false});
  assert.deepEqual(await f.service.startLogin('claude',{email:'bad email'}),{ok:false,code:'INVALID_EMAIL'});
  const started=await f.service.startLogin('claude',{email:'member@example.com'});assert.equal(started.ok,true);
  const loginCall=f.calls.find(c=>c.argv.includes('login'));
  assert.deepEqual(loginCall.argv,['auth','login','--email','member@example.com']);
  const folder=loginCall.options.env.CLAUDE_CONFIG_DIR;assert.match(path.basename(folder),/^claude-[a-z0-9]{8}$/);assert.ok(fs.existsSync(folder));
  await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
  const waiting=f.changes.at(-1).login;assert.equal(waiting.stage,'browser');assert.equal(waiting.needsCode,true);assert.match(waiting.url,/^https:\/\/claude\.com\//);
  assert.deepEqual(f.service.submitCode(started.id,'has space'),{ok:false,code:'INVALID_CODE'});
  assert.deepEqual(f.service.submitCode(started.id,'abcDEF123456#state'),{ok:true});
  assert.equal(f.stdinWrites.at(-1),'abcDEF123456#state\n');
  for(let i=0;i<40&&f.changes.at(-1)?.login?.stage!=='done';i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(f.changes.at(-1).login.stage,'done');
  const snap=await f.service.snapshot();const row=snap.rows.find(r=>r.service==='claude');
  assert.equal(row.email,'member@example.com');assert.equal(row.folder,true);
});

test('cancelled logins leave no empty account folder behind',async()=>{
  const f=fakeSystem({claudeLoggedIn:false});
  const started=await f.service.startLogin('claude');
  const folder=f.calls.find(c=>c.argv.includes('login')).options.env.CLAUDE_CONFIG_DIR;
  assert.deepEqual(f.service.cancelLogin(started.id),{ok:true});
  assert.equal(fs.existsSync(folder),false);
  assert.equal(f.changes.at(-1).login.stage,'cancelled');
});

test('manual subscriptions keep only validated fields',async()=>{
  const f=fakeSystem();
  let snap=await f.service.save({add:{label:'Suno',kind:'credit',price:30,currency:'USD',billDay:40,credits:2350,note:'x'.repeat(300)}});
  const row=snap.rows.find(r=>r.label==='Suno');
  assert.equal(row.source,'manual');assert.equal(row.kind,'credit');assert.equal(row.price,30);assert.equal(row.currency,'USD');assert.equal(row.billDay,null);assert.equal(row.note.length,120);
  snap=await f.service.save({row:{id:row.id,billDay:3,credits:100,folder:'../../etc',source:'auto'}});
  const updated=snap.rows.find(r=>r.id===row.id);assert.equal(updated.billDay,3);assert.equal(updated.credits,100);assert.equal(updated.source,'manual');assert.equal(updated.folder,false);
  snap=await f.service.save({remove:row.id});assert.equal(snap.rows.some(r=>r.id===row.id),false);
  assert.deepEqual(await f.service.save(null),{ok:false,code:'INVALID_REQUEST'});
});

test('help links and installers are fixed lists',async()=>{
  const f=fakeSystem();
  assert.deepEqual(await f.service.openHelp('https://evil.example'),{ok:false,code:'UNKNOWN_LINK'});
  assert.deepEqual(await f.service.openHelp('node'),{ok:true});assert.equal(f.opened.at(-1),'https://nodejs.org/ko/download');
  assert.deepEqual(await f.service.openInstaller('calc'),{ok:false,code:'UNKNOWN_SERVICE'});
  assert.deepEqual(await f.service.openInstaller('claude'),{ok:true});
  const install=f.calls.find(c=>c.command==='powershell.exe'&&c.argv.includes('-NoExit'));
  assert.match(install.argv.at(-1),/^irm https:\/\/claude\.ai\/install\.ps1 \| iex;/);assert.equal(install.options.shell,false);
});

test('a sign-in approved in the browser with a different account is reported, not hidden',async()=>{
  const f=fakeSystem({claudeLoggedIn:false});
  const started=await f.service.startLogin('claude',{email:'other@example.com'});
  await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
  f.service.submitCode(started.id,'abcDEF123456#state');
  for(let i=0;i<40&&!['done','error'].includes(f.changes.at(-1)?.login?.stage);i++)await new Promise(r=>setTimeout(r,5));
  const last=f.changes.at(-1).login;
  assert.equal(last.stage,'error');assert.match(last.message,/other@example.com 대신 브라우저에 로그인돼 있던 member@example.com/);
  const snap=await f.service.snapshot();assert.equal(snap.rows.filter(r=>r.email==='member@example.com').length,1);
});

test('Gemini reads the Antigravity quota from the app data folder and signs in through a console window',async t=>{
  const f=fakeSystem({geminiLoggedIn:false});
  t.mock.timers.enable({apis:['setTimeout']});
  assert.deepEqual(await f.service.useExisting('gemini'),{ok:false,code:'NOT_LOGGED_IN'});
  assert.deepEqual(await f.service.startLogin('gemini',{email:'member@example.com'}),{ok:false,code:'INVALID_EMAIL'});
  const started=await f.service.startLogin('gemini');assert.equal(started.ok,true);
  // agy는 로그인 명령이 없어 인자 없이 검은 창으로 켜고, 실행 폴더는 이 혜택의 데이터 폴더다.
  const call=f.calls.find(c=>c.command.endsWith('agy.exe')&&!c.argv.length);
  assert.equal(call.options.detached,true);assert.equal(call.options.windowsHide,false);assert.equal(call.options.cwd,path.join(f.root,'data'));
  assert.equal(f.changes.at(-1).login.stage,'console');assert.equal(f.changes.at(-1).login.console,true);
  f.state.geminiLoggedIn=true;
  t.mock.timers.tick(6000);
  for(let i=0;i<60&&f.changes.at(-1)?.login?.stage!=='done';i++)await new Promise(r=>setImmediate(r));
  assert.equal(f.changes.at(-1).login.stage,'done');
  const snap=await f.service.check();
  const row=snap.rows.find(r=>r.service==='gemini');
  assert.equal(row.state,'ok');assert.equal(row.email,null);assert.equal(row.folder,false);
  assert.equal(row.live.weekly.usedPercent,36);assert.equal(row.live.session.usedPercent,90);assert.equal(row.live.models[0].name,'Claude·GPT 모델');
  const usageCall=f.calls.find(c=>c.command.endsWith('agy.exe')&&c.argv.includes('/usage'));
  assert.deepEqual(usageCall.argv,['-p','/usage','--output-format','json']);assert.equal(usageCall.options.cwd,path.join(f.root,'data'));assert.equal(usageCall.options.shell,false);
});

/* ---------- Higgsfield 여러 계정 ---------- */
// 로그인이 끝나고, 연결 직후 저절로 도는 확인까지 끝날 때를 기다린다(진행 중인 확인은 본체에 직접 묻는다).
const settle=async(f,stages=['done'])=>{
  for(let i=0;i<400&&(!stages.includes(f.changes.at(-1)?.login?.stage)||f.changes.at(-1)?.checking);i++)await new Promise(r=>setTimeout(r,5));
  for(let i=0;i<400&&(await f.service.snapshot()).checking;i++)await new Promise(r=>setTimeout(r,5));
};

test('connects several Higgsfield accounts, each in its own home folder, and picks the new workspace',async()=>{
  const f=fakeSystem();
  assert.equal((await f.service.useExisting('higgsfield')).ok,true);
  f.state.nextHiggsEmail='founder@example.com';
  const started=await f.service.startLogin('higgsfield');assert.equal(started.ok,true);
  const loginCall=f.calls.find(c=>c.command.endsWith('higgsfield.exe')&&c.argv.join(' ')==='auth login');
  const home=loginCall.options.env.USERPROFILE;
  assert.match(path.basename(home),/^higgsfield-[a-z0-9]{8}$/);assert.equal(loginCall.options.env.HOME,home);assert.ok(fs.existsSync(home));
  await new Promise(r=>setImmediate(r));
  const browser=f.changes.map(c=>c.login).find(l=>l?.stage==='browser');
  // 화면이 이 주소로 「주소 복사」(시크릿 창) 단추를 띄운다.
  assert.match(browser.url,/^https:\/\/clerk\.higgsfield\.ai\//);
  await settle(f);
  assert.equal(f.changes.at(-1).login.stage,'done');
  // 새 홈은 작업공간이 비어 있어 내가 주인인 작업공간을 먼저 고른다.
  const set=f.calls.find(c=>c.argv.join(' ')==='workspace set ws-member-0001');
  assert.ok(set);assert.equal(set.options.env.USERPROFILE,home);
  const snap=await f.service.check();
  const rows=snap.rows.filter(r=>r.service==='higgsfield');
  assert.deepEqual(rows.map(r=>[r.email,r.credits,r.folder]).sort(),[['77@example.com',0.22,false],['founder@example.com',1373.34,true]]);
  assert.equal(snap.check.total,2);assert.equal(snap.check.ok,2);
  // 기본 로그인은 홈을 바꾸지 않고 읽는다.
  const defaultRead=f.calls.find(c=>c.argv.join(' ')==='account status --json'&&!c.options.env.USERPROFILE);
  assert.ok(defaultRead);
});

test('a new sign-in that lands on an already connected account is reported and leaves no extra folder',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('higgsfield');
  f.state.nextHiggsEmail='77@example.com';
  await f.service.startLogin('higgsfield');
  const home=f.calls.find(c=>c.command.endsWith('higgsfield.exe')&&c.argv.join(' ')==='auth login').options.env.USERPROFILE;
  await settle(f,['done','error']);
  const last=f.changes.at(-1).login;
  assert.equal(last.stage,'error');assert.match(last.message,/이미 연결된 77@example.com/);assert.match(last.message,/시크릿 창/);
  assert.equal(fs.existsSync(home),false);
  const snap=await f.service.snapshot();assert.equal(snap.rows.filter(r=>r.service==='higgsfield').length,1);
});

/* ---------- Typecast API 키 ---------- */
function fakeTypecast(){
  const good='tc-good-key-1234567890',state={valid:new Set([good]),calls:[]};
  const fetch=async(url,options)=>{
    state.calls.push({url,options});
    if(url!=='https://api.typecast.ai/v1/users/me/subscription')return {ok:false,status:404};
    if(!state.valid.has(options.headers['X-API-KEY']))return {ok:false,status:401,json:async()=>({})};
    return {ok:true,status:200,json:async()=>({plan:'lite',credits:{plan_credits:200000,used_credits:73584}})};
  };
  // 가짜 암호화: 거꾸로 뒤집어 base64로 둔다(평문 키가 파일에 남지 않는지만 본다).
  const secrets={available:()=>true,encrypt:text=>Buffer.from('enc:'+Buffer.from(text).reverse().toString('base64')),decrypt:data=>Buffer.from(String(data).slice(4),'base64').reverse().toString()};
  return {good,state,fetch,secrets};
}

test('Typecast connects with an API key kept encrypted on this PC and reads the credits left',async()=>{
  const tc=fakeTypecast(),f=fakeSystem({fetch:tc.fetch,secrets:tc.secrets});
  const accounts=path.join(f.root,'data','accounts');
  const typecastFolders=()=>fs.existsSync(accounts)?fs.readdirSync(accounts).filter(n=>n.startsWith('typecast-')):[];
  assert.deepEqual(await f.service.connectKey('typecast','has space key 123'),{ok:false,code:'INVALID_KEY_FORMAT'});
  assert.deepEqual(await f.service.connectKey('typecast','tc-wrong-key-000000'),{ok:false,code:'INVALID_KEY'});
  assert.deepEqual(typecastFolders(),[]);
  const done=await f.service.connectKey('typecast','  '+tc.good+'\n');assert.equal(done.ok,true);
  const row=done.snapshot.rows.find(r=>r.service==='typecast');
  assert.equal(row.credits,126416);assert.equal(row.plan,'lite');assert.equal(row.keyHint,'…7890');assert.equal(row.folder,true);assert.equal(row.state,'ok');assert.equal(row.kind,'credit');
  assert.equal(row.keyId,undefined);assert.ok(!JSON.stringify(done.snapshot).includes(tc.good));
  const [folder]=typecastFolders();
  assert.ok(!fs.readFileSync(path.join(accounts,folder,'key.bin')).toString().includes(tc.good));
  assert.ok(!fs.readFileSync(path.join(f.root,'data','board.json'),'utf8').includes(tc.good));
  // 같은 키를 또 넣어도 한 줄이다.
  assert.equal((await f.service.connectKey('typecast',tc.good)).snapshot.rows.filter(r=>r.service==='typecast').length,1);
  // 「지금 확인」이 저장한 키로 다시 읽고, 키가 폐기되면 다시 연결을 알린다.
  let snap=await f.service.check();assert.equal(snap.rows.find(r=>r.service==='typecast').state,'ok');
  const call=tc.state.calls.at(-1);assert.equal(call.options.headers['X-API-KEY'],tc.good);assert.equal(call.options.redirect,'error');
  tc.state.valid.clear();
  snap=await f.service.check();
  const revoked=snap.rows.find(r=>r.service==='typecast');assert.equal(revoked.state,'needs-login');assert.match(revoked.stateMessage,/새 키로 다시 연결/);
  // 지우면 키 파일도 사라진다.
  await f.service.save({remove:revoked.id});assert.equal(fs.existsSync(path.join(accounts,folder)),false);
  // 로그인·설치 길로는 들어오지 않는다.
  assert.deepEqual(await f.service.useExisting('typecast'),{ok:false,code:'UNKNOWN_SERVICE'});
  assert.deepEqual(await f.service.startLogin('typecast'),{ok:false,code:'UNKNOWN_SERVICE'});
  assert.deepEqual(await f.service.openInstaller('typecast'),{ok:false,code:'UNKNOWN_SERVICE'});
  assert.deepEqual(await f.service.connectKey('claude',tc.good),{ok:false,code:'UNKNOWN_SERVICE'});
});

test('without secure storage the API key is refused instead of being saved in plain text',async()=>{
  const tc=fakeTypecast();
  const locked=fakeSystem({fetch:tc.fetch,secrets:{...tc.secrets,available:()=>false}});
  assert.deepEqual(await locked.service.connectKey('typecast',tc.good),{ok:false,code:'SECURE_STORAGE_UNAVAILABLE'});
  const none=fakeSystem({fetch:tc.fetch});
  assert.deepEqual(await none.service.connectKey('typecast',tc.good),{ok:false,code:'SECURE_STORAGE_UNAVAILABLE'});
  assert.equal(tc.state.calls.length,0);
});

test('removing a connected Higgsfield account deletes its home folder, sign-in and Windows cache junction included',async()=>{
  const f=fakeSystem();
  f.state.nextHiggsEmail='founder@example.com';
  await f.service.startLogin('higgsfield');
  const home=f.calls.find(c=>c.command.endsWith('higgsfield.exe')&&c.argv.join(' ')==='auth login').options.env.USERPROFILE;
  await settle(f);
  // 실제 CLI가 남기는 로그인 파일과, 브라우저를 열 때 Windows가 만드는 캐시 폴더(숨김·시스템, Content.IE5 junction)
  fs.mkdirSync(path.join(home,'.config','higgsfield'),{recursive:true});
  fs.writeFileSync(path.join(home,'.config','higgsfield','credentials.json'),'{"access_token":"x"}');
  const cache=path.join(home,'AppData','Local','Microsoft','Windows','INetCache');
  fs.mkdirSync(path.join(cache,'IE'),{recursive:true});
  if(process.platform==='win32'){
    fs.symlinkSync(path.join(cache,'IE'),path.join(cache,'Content.IE5'),'junction');
    require('node:child_process').execFileSync('attrib',['+s','+h',path.join(cache,'IE')],{windowsHide:true});
  }
  const row=(await f.service.snapshot()).rows.find(r=>r.email==='founder@example.com');
  await f.service.save({remove:row.id});
  assert.equal(fs.existsSync(home),false);
});
