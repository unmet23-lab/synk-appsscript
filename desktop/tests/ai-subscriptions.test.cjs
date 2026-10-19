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
function fakeSystem({claudeLoggedIn=true,geminiLoggedIn=true,fetch=null,secrets=null,withNpm=true}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-subs-'));
  const home=path.join(root,'home'),bin=path.join(home,'.local','bin'),npm=path.join(root,'npm'),agyBin=path.join(root,'local','agy','bin');
  fs.mkdirSync(bin,{recursive:true});fs.mkdirSync(npm,{recursive:true});fs.mkdirSync(agyBin,{recursive:true});
  for(const file of [path.join(bin,'claude.exe'),path.join(npm,'codex.cmd'),path.join(npm,'higgsfield.exe'),...(withNpm?[path.join(npm,'npm.cmd')]:[]),path.join(agyBin,'agy.exe')])fs.writeFileSync(file,'');
  // higgsHomes: 홈 폴더(USERPROFILE)마다 Higgsfield 로그인. 기본 홈은 77@example.com.
  // consoles: 숨긴 PowerShell 런처가 Start-Process로 띄운 검은 창(스크립트·환경). freshPath: 다시 읽는 사용자·시스템 PATH.
  const calls=[],stdinWrites=[];let loginChild=null,pidSeq=4000;
  const state={claudeLoggedIn,geminiLoggedIn,higgsHomes:{},nextHiggsEmail:'second@example.com',claudeEmail:'member@example.com',freshPath:'',codexEmptyLimits:false,defaultHiggsNoWorkspace:false,consoles:[],killed:[],online:true,reachCalls:[],codexNoAccountTimes:0,claudeExpiredTimes:0,claudeUsageOverride:null,claudeAuthOverride:null};
  function spawn(command,argv,options){
    const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
    // 실제 ChildProcess처럼 끝나기 전에는 exitCode가 null이다(본체는 살아 있는 프로세스만 PID로 끈다).
    child.exitCode=null;child.signalCode=null;child.on('close',code=>{child.exitCode=code??1;});
    const call={command,argv,options,child};calls.push(call);
    const joined=[command,...argv].join(' ');
    const reply=(out,code=0,delay=0)=>(delay?fn=>setTimeout(fn,delay):setImmediate)(()=>{if(out)child.stdout.emit('data',out);child.emit('close',code);});
    child.kill=()=>setImmediate(()=>child.emit('close',null));child.unref=()=>{};
    child.stdin={write(text){stdinWrites.push(text);if(child.onInput)child.onInput(text);return true;},end(text){if(text!=null)stdinWrites.push(text);child.stdinEnded=true;}};
    if(command==='powershell.exe'&&argv.includes('-EncodedCommand')){
      // 런처: 창의 PID를 한 줄 찍고, WaitForExit면 창이 닫힐 때까지(시험이 닫을 때까지) 살아 있다.
      const script=Buffer.from(argv[argv.indexOf('-EncodedCommand')+1],'base64').toString('utf16le');
      const windowPid=++pidSeq;child.pid=++pidSeq;state.consoles.push({script,env:options.env,windowPid,launcher:child,close:()=>child.emit('close',0)});
      setImmediate(()=>{child.stdout.emit('data',windowPid+'\r\n');if(!/WaitForExit/.test(script))child.emit('close',0);});
    }
    else if(command==='powershell.exe')reply(argv.some(a=>/GetEnvironmentVariable/.test(a))?state.freshPath:'');
    else if(command==='taskkill'){state.killed.push(argv.join(' '));reply('');}
    else if(joined.includes('--version'))reply(command.endsWith('claude.exe')?'2.1.301 (Claude Code)\n':'1.0.0\n');
    else if(command.endsWith('agy.exe')){if(argv.includes('/usage'))reply(state.geminiLoggedIn?AGY_USAGE:'Error: not signed in. Run agy to sign in.\n',state.geminiLoggedIn?0:1);}
    else if(joined.includes('/usage')&&state.claudeExpiredTimes>0){state.claudeExpiredTimes--;reply('OAuth token has expired. Please obtain a new token or refresh your existing token.\n',1);}
    else if(joined.includes('/usage')&&state.claudeUsageOverride!=null)reply(state.claudeUsageOverride);
    else if(joined.includes('/usage'))reply(state.claudeLoggedIn?USAGE:'Not logged in · Please run /login\n',state.claudeLoggedIn?0:1,state.usageDelay||0);
    else if(joined.includes('auth status'))reply(state.claudeAuthOverride!=null?state.claudeAuthOverride:JSON.stringify({loggedIn:state.claudeLoggedIn,email:state.claudeEmail,subscriptionType:'max'}));
    else if(joined.includes('auth login')&&command.endsWith('claude.exe')){loginChild=child;child.pid=++pidSeq;setImmediate(()=>child.stdout.emit('data','Opening browser to sign in…\nIf the browser didn\'t open, visit: https://claude.com/cai/oauth/authorize?code=true&state=abc\nPaste code here if prompted > '));child.onInput=()=>{state.claudeLoggedIn=true;setImmediate(()=>child.emit('close',0));};}
    else if(joined.includes('app-server')){
      child.onInput=text=>{for(const line of text.split('\n').filter(Boolean)){const m=JSON.parse(line);
        const send=v=>setImmediate(()=>child.stdout.emit('data',JSON.stringify(v)+'\n'));
        if(m.method==='initialize')send({id:m.id,result:{}});
        else if(m.method==='account/read')send({id:m.id,result:state.codexNoAccountTimes>0?(state.codexNoAccountTimes--,{account:null,requiresOpenaiAuth:true}):{account:{type:'chatgpt',email:'synk@example.com',planType:'pro'}}});
        else if(m.method==='account/rateLimits/read')send({id:m.id,result:{rateLimits:state.codexEmptyLimits?{planType:'pro',primary:null,secondary:null}:{planType:'pro',primary:{usedPercent:100,windowDurationMins:10080,resetsAt:Math.floor(NOW/1000)+86400},secondary:null}}});}};
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
      if(!h)reply(...(state.defaultHiggsNoWorkspace?['Error: No workspace selected.\nHint: Run: higgsfield workspace set <workspace_id>\n',1]:[JSON.stringify({credits:0.22,email:'77@example.com',subscription_plan_type:'ultra'})]));
      else if(!h.workspace)reply('Error: No workspace selected.\nHint: Run: higgsfield workspace set <workspace_id>\n',1);
      else reply(JSON.stringify({credits:1373.34,email:h.email,subscription_plan_type:'ultra'}));
    }
    else reply('',1);
    return child;
  }
  const changes=[],opened=[];
  // 「로그인 필요」 뒤 인터넷이 닿는지 보는 고정 주소는 여기서 답한다(시험은 실제 망에 나가지 않는다). 나머지는 넘겨받은 가짜로.
  const reach=new Set(['https://api.anthropic.com/','https://auth.openai.com/','https://higgsfield.ai/','https://oauth2.googleapis.com/']);
  const fakeFetch=async(url,options)=>{if(reach.has(url)){state.reachCalls.push(url);if(!state.online)throw new TypeError('fetch failed');return {ok:true,status:200};}return fetch?fetch(url,options):{ok:false,status:404,json:async()=>({})};};
  const service=createAiSubscriptions({root:path.join(root,'data'),platform:'win32',env:{PATH:npm,APPDATA:path.join(root,'appdata'),LOCALAPPDATA:path.join(root,'local'),ComSpec:'cmd.exe',CLAUDECODE:'1',CLAUDE_CONFIG_DIR:'X'},home,spawn,fetch:fakeFetch,retryDelay:0,...(secrets?{secrets}:{}),now:()=>NOW,openExternal:async url=>opened.push(url),onChange:s=>changes.push(s)});
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
  // Max 등급은 공식 출력에 없어 Claude Code 설정 파일(.claude.json, 토큰 없음)의 등급 칸에서 읽는다.
  fs.writeFileSync(path.join(f.root,'home','.claude.json'),JSON.stringify({oauthAccount:{emailAddress:'member@example.com',organizationRateLimitTier:'default_claude_max_20x',userRateLimitTier:null}}));
  const firstChange=f.changes.length;
  const after=await f.service.check();
  // 확인을 시작하는 첫 알림부터 「확인 중」이어야 화면이 잠깐 끝난 것처럼 보이지 않는다.
  assert.equal(f.changes[firstChange].checking,true);
  // 돌려받는 결과는 확인이 끝난 상태이고 마지막 알림보다 번호가 크다. 늦게 도착해도 화면이 「확인 중」으로 돌아가지 않는다.
  assert.equal(after.checking,false);assert.equal(f.changes.at(-1).checking,false);assert.ok(after.seq>f.changes.at(-1).seq);
  assert.ok(f.changes.every((s,i)=>i===0||s.seq>f.changes[i-1].seq));
  // 확인 중 알림은 읽은 줄 수를 함께 보낸다(화면의 「읽는 중이에요… 2/3」). 끝나면 비운다.
  const during=f.changes.slice(firstChange).filter(s=>s.checking).map(s=>`${s.progress?.done}/${s.progress?.total}`);
  assert.deepEqual([during[0],during.at(-1)],['0/3','3/3']);assert.equal(after.progress,null);
  const by=Object.fromEntries(after.rows.map(r=>[r.service,r]));
  assert.equal(by.claude.plan,'max_20x');
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

test('a missing or odd Claude config keeps the Max plan without a tier',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('claude');
  const plan=async()=>(await f.service.check()).rows.find(r=>r.service==='claude').plan;
  assert.equal(await plan(),'max');
  fs.writeFileSync(path.join(f.root,'home','.claude.json'),'{not json');assert.equal(await plan(),'max');
  fs.writeFileSync(path.join(f.root,'home','.claude.json'),JSON.stringify({oauthAccount:{organizationRateLimitTier:'default_claude_max_5x'}}));assert.equal(await plan(),'max_5x');
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
  // npm 설치본(cmd → node)이어도 실제 CLI가 남지 않게 프로세스 묶음째 끈다.
  for(let i=0;i<20&&!f.state.killed.length;i++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(f.state.killed,[`/PID ${f.loginChild.pid} /T /F`]);
});

test('cancelling while the sign-in is being verified adds no row',async()=>{
  const f=fakeSystem({claudeLoggedIn:false});
  const started=await f.service.startLogin('claude');
  const folder=f.calls.find(c=>c.argv.includes('login')).options.env.CLAUDE_CONFIG_DIR;
  await new Promise(r=>setImmediate(r));
  f.service.submitCode(started.id,'abcDEF123456#state');
  await new Promise(r=>setImmediate(r));
  // 로그인 프로그램은 끝났고, 본체가 계정을 확인하는 중이다.
  assert.equal(f.changes.at(-1).login.message,'연결을 확인하고 있어요.');
  assert.deepEqual(f.service.cancelLogin(started.id),{ok:true});
  for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
  const snap=await f.service.snapshot();
  assert.equal(snap.login.stage,'cancelled');assert.equal(snap.rows.length,0);assert.equal(fs.existsSync(folder),false);
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
  assert.deepEqual(await f.service.openInstaller('constructor'),{ok:false,code:'UNKNOWN_SERVICE'});
  assert.deepEqual(await f.service.openInstaller('claude'),{ok:true});
  // 설치 창은 숨긴 런처가 Start-Process로 새로 띄운다. detached로 띄우면 콘솔이 없어 설치 스크립트가 한 줄도 돌지 않는다.
  const launcher=f.state.consoles.at(-1);
  assert.match(launcher.script,/^\$p=Start-Process -FilePath 'powershell\.exe' -ArgumentList '-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','[A-Za-z0-9+/=]+' -PassThru;/);
  const inner=Buffer.from(/'-EncodedCommand','([A-Za-z0-9+/=]+)'/.exec(launcher.script)[1],'base64').toString('utf16le');
  assert.match(inner,/^irm https:\/\/claude\.ai\/install\.ps1 \| iex;/);assert.match(inner,/「다시 확인」/);
  assert.ok(!f.calls.some(c=>c.options?.detached));assert.ok(f.calls.every(c=>c.options?.shell!==true));
});

test('tools installed while the app stays open are found on the next re-check',async()=>{
  const f=fakeSystem({withNpm:false});
  assert.deepEqual(await f.service.openInstaller('higgsfield'),{ok:false,code:'NODE_REQUIRED'});
  // 앱을 켠 채 Node.js를 설치해 시스템 PATH에 새 폴더가 생겼다.
  const nodeDir=path.join(f.root,'nodejs');fs.mkdirSync(nodeDir);fs.writeFileSync(path.join(nodeDir,'npm.cmd'),'');
  f.state.freshPath=nodeDir;
  assert.deepEqual(await f.service.openInstaller('higgsfield'),{ok:true});
  assert.equal(f.state.consoles.at(-1).env.PATH.split(';')[0],nodeDir);
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
  // agy는 로그인 명령이 없어 인자 없이 검은 창으로 켠다. 창은 숨긴 런처가 Start-Process로 띄우고(창이 닫힐 때까지 기다림),
  // 실행 폴더는 이 혜택의 데이터 폴더다.
  const win=f.state.consoles.at(-1),re=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  assert.match(win.script,new RegExp(`^\\$p=Start-Process -FilePath '${re(path.join(f.root,'local','agy','bin','agy.exe'))}' -WorkingDirectory '${re(path.join(f.root,'data'))}' -PassThru;`));
  assert.match(win.script,/\$p\.WaitForExit\(\)$/);assert.ok(!f.calls.some(c=>c.options?.detached));
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

/* ---------- 10-18 본체 검토에서 찾은 것 ---------- */
const writeBoard=(f,rows)=>{fs.mkdirSync(path.join(f.root,'data'),{recursive:true});fs.writeFileSync(path.join(f.root,'data','board.json'),JSON.stringify({version:1,rows,settings:{usdKrw:1400},check:null}));};

test('removing an account never follows a link out of its folder',async t=>{
  const f=fakeSystem();
  const accounts=path.join(f.root,'data','accounts'),outside=path.join(f.root,'outside');
  fs.mkdirSync(path.join(outside,'sub'),{recursive:true});fs.writeFileSync(path.join(outside,'keep.txt'),'k');fs.writeFileSync(path.join(outside,'sub','keep2.txt'),'k');
  // 계정 폴더 안의 링크가 바깥을 가리키는 경우와, 계정 폴더 자체가 링크인 경우.
  const inner=path.join(accounts,'claude-aaaaaaaa'),linked=path.join(accounts,'claude-bbbbbbbb');
  fs.mkdirSync(path.join(inner,'deep'),{recursive:true});fs.writeFileSync(path.join(inner,'deep','token.json'),'x');
  fs.symlinkSync(outside,path.join(inner,'deep','link-out'),'junction');fs.symlinkSync(outside,linked,'junction');
  writeBoard(f,[{id:'r-aaaaaaaa',service:'claude',source:'auto',folder:'claude-aaaaaaaa',email:'a@example.com'},{id:'r-bbbbbbbb',service:'claude',source:'auto',folder:'claude-bbbbbbbb',email:'b@example.com'}]);
  // 앱이 쓰는 Electron 44.5(Node 24.21)의 fs.rmSync는 junction을 따라가 바깥을 지운다(10-18 실측). 계정 폴더 지우기에 쓰지 않는지 본다.
  t.mock.method(fs,'rmSync',()=>{throw new Error('fs.rmSync must not delete account folders');});
  await f.service.save({remove:'r-aaaaaaaa'});await f.service.save({remove:'r-bbbbbbbb'});
  assert.equal(fs.existsSync(inner),false);assert.equal(fs.existsSync(linked),false);
  assert.equal(fs.readFileSync(path.join(outside,'keep.txt'),'utf8'),'k');assert.equal(fs.readFileSync(path.join(outside,'sub','keep2.txt'),'utf8'),'k');
});

test('a Claude row follows the account its login now belongs to and never doubles another row',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('claude');
  // 회원이 터미널에서 /login으로 기본 로그인을 다른 계정으로 바꿨다.
  f.state.claudeEmail='b@example.com';
  let rows=(await f.service.check()).rows.filter(r=>r.service==='claude');
  assert.deepEqual(rows.map(r=>[r.email,r.state]),[['b@example.com','ok']]);
  // 바뀐 계정이 이미 다른 줄에 있으면 같은 숫자를 두 줄에 세지 않고 알린다.
  const g=fakeSystem();
  writeBoard(g,[{id:'r-default1',service:'claude',source:'auto',folder:null,email:'a@example.com',plan:'max'},{id:'r-folder01',service:'claude',source:'auto',folder:'claude-cccccccc',email:'c@example.com',plan:'max'}]);
  g.state.claudeEmail='c@example.com';
  const by=Object.fromEntries((await g.service.check()).rows.map(r=>[r.id,r]));
  assert.equal(by['r-default1'].state,'error');assert.match(by['r-default1'].stateMessage,/c@example\.com 계정으로 바뀌었는데/);assert.equal(by['r-default1'].email,'a@example.com');
  assert.equal(by['r-folder01'].state,'ok');
});

test('an account connected while a full check runs is read right after it',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('claude');
  // Claude 읽기를 늦추고 그 읽기가 시작된 뒤에 GPT를 연결해, 연결이 반드시 전체 확인 도중(대상이 정해진 뒤)에 끝나게 한다.
  f.state.usageDelay=80;
  const usage=()=>f.calls.filter(c=>c.argv.includes('/usage')).length,before=usage();
  const running=f.service.check();
  for(let i=0;i<400&&usage()===before;i++)await new Promise(r=>setImmediate(r));
  assert.equal((await f.service.useExisting('gpt')).ok,true);
  await running;
  assert.ok(f.calls.filter(c=>c.argv.join(' ').includes('app-server')).length>=2);
  const snap=await f.service.snapshot(),row=snap.rows.find(r=>r.service==='gpt');
  assert.equal(row.state,'ok');assert.equal(row.live.weekly.usedPercent,100);
  // 요약은 판 전체로 센다(한 줄만 다시 읽어도 「1/1」로 줄지 않는다).
  assert.deepEqual([snap.check.total,snap.check.ok],[2,2]);
});

test('Codex without any limit window is a read failure, not a silent ok',async()=>{
  const f=fakeSystem();f.state.codexEmptyLimits=true;
  assert.equal((await f.service.useExisting('gpt')).ok,true);
  const snap=await f.service.snapshot(),row=snap.rows.find(r=>r.service==='gpt');
  assert.equal(row.state,'error');assert.match(row.stateMessage,/사용 한도를 알려 주지 않았어요/);
  assert.deepEqual([snap.check.total,snap.check.ok],[1,0]);
});

test('the default Higgsfield login is read as is and its selected workspace is never changed',async()=>{
  const f=fakeSystem();f.state.defaultHiggsNoWorkspace=true;
  assert.deepEqual(await f.service.useExisting('higgsfield'),{ok:false,code:'NO_WORKSPACE'});
  assert.ok(!f.calls.some(c=>c.argv[0]==='workspace'));
});

test('importing the default login of an account already connected in its own folder keeps that folder',async()=>{
  const f=fakeSystem({claudeLoggedIn:false});
  const started=await f.service.startLogin('claude',{email:'member@example.com'});
  const folder=f.calls.find(c=>c.argv.includes('login')).options.env.CLAUDE_CONFIG_DIR;
  await new Promise(r=>setImmediate(r));
  f.service.submitCode(started.id,'abcDEF123456#state');
  await settle(f);
  assert.equal((await f.service.useExisting('claude')).ok,true);
  const rows=(await f.service.snapshot()).rows.filter(r=>r.service==='claude');
  assert.deepEqual(rows.map(r=>[r.email,r.folder]),[['member@example.com',true]]);assert.ok(fs.existsSync(folder));
});

test('a new Typecast key entered from the row it replaces updates that row instead of adding one',async()=>{
  const tc=fakeTypecast(),f=fakeSystem({fetch:tc.fetch,secrets:tc.secrets});
  const first=await f.service.connectKey('typecast',tc.good);const id=first.id;
  tc.state.valid.clear();
  assert.equal((await f.service.check()).rows.find(r=>r.id===id).state,'needs-login');
  const fresh='tc-new-key-0987654321';tc.state.valid.add(fresh);
  const replaced=await f.service.connectKey('typecast',fresh,{replace:id});
  assert.deepEqual(replaced.snapshot.rows.filter(r=>r.service==='typecast').map(r=>[r.id,r.keyHint,r.state]),[[id,'…4321','ok']]);
  const accounts=path.join(f.root,'data','accounts');
  assert.equal(fs.readdirSync(accounts).filter(n=>n.startsWith('typecast-')).length,1);
  assert.equal((await f.service.check()).rows.find(r=>r.id===id).state,'ok');
  assert.equal(tc.state.calls.at(-1).options.headers['X-API-KEY'],fresh);
});

test('a board file that cannot be read is never replaced by an empty board',async()=>{
  const f=fakeSystem();
  const boardFile=path.join(f.root,'data','board.json');
  // 다른 프로그램이 잡고 있는 것처럼 ENOENT가 아닌 오류로 읽기가 실패한다.
  fs.mkdirSync(boardFile,{recursive:true});
  assert.deepEqual(await f.service.snapshot(),{ok:false,code:'BOARD_BUSY'});
  assert.deepEqual(await f.service.save({settings:{usdKrw:1380}}),{ok:false,code:'BOARD_BUSY'});
  assert.ok(fs.statSync(boardFile).isDirectory());
  fs.rmdirSync(boardFile);
  writeBoard(f,[{id:'m-suno0001',service:'suno',source:'manual',label:'Suno',kind:'credit'}]);
  assert.equal((await f.service.snapshot()).rows.length,1);
  // 깨진 파일은 옆에 남긴 뒤에만 새로 시작한다.
  const g=fakeSystem(),dir=path.join(g.root,'data');
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'board.json'),'{"rows":[{"id":"m-');
  assert.equal((await g.service.snapshot()).rows.length,0);
  const kept=fs.readdirSync(dir).filter(n=>n.startsWith('board.json.broken-'));
  assert.equal(kept.length,1);assert.equal(fs.readFileSync(path.join(dir,kept[0]),'utf8'),'{"rows":[{"id":"m-');
});

test('closing the console window without signing in ends the login, and cancel closes a live window',async()=>{
  const f=fakeSystem({geminiLoggedIn:false});
  assert.equal((await f.service.startLogin('gemini')).ok,true);
  f.state.consoles.at(-1).close();
  for(let i=0;i<60&&f.changes.at(-1)?.login?.stage==='console';i++)await new Promise(r=>setImmediate(r));
  const last=f.changes.at(-1).login;assert.equal(last.stage,'error');assert.match(last.message,/검은 창이 닫혔/);
  // 취소는 런처가 살아 있을 때(창 프로세스를 쥐고 있어 PID가 재사용되지 않을 때)만 창 PID를 묶음째 끈다.
  const again=await f.service.startLogin('gemini'),win=f.state.consoles.at(-1);
  assert.deepEqual(f.service.cancelLogin(again.id),{ok:true});
  for(let i=0;i<20&&!f.state.killed.length;i++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(f.state.killed,[`/PID ${win.windowPid} /T /F`]);
  f.service.dispose();
});

/* ---------- 잠깐 연결이 끊겼을 때 「다시 로그인」을 잘못 띄우지 않기(10-18) ---------- */
test('a sign-in that only looks lost for a moment is read again instead of asking to log in',async()=>{
  const f=fakeSystem();
  assert.equal((await f.service.useExisting('gpt')).ok,true);
  // 연결이 잠깐 흔들려 Codex가 계정을 한 번 못 줬다: 인터넷이 닿는지 보고, 한 번 더 읽어 그대로 읽힌다.
  f.state.codexNoAccountTimes=1;
  let row=(await f.service.check()).rows.find(r=>r.service==='gpt');
  assert.equal(row.state,'ok');assert.deepEqual(f.state.reachCalls,['https://auth.openai.com/']);
  // 인터넷이 안 닿으면 「다시 로그인」 대신 연결 문제로 알리고, 마지막으로 읽은 숫자는 그대로 둔다.
  f.state.codexNoAccountTimes=2;f.state.online=false;
  row=(await f.service.check()).rows.find(r=>r.service==='gpt');
  assert.equal(row.state,'error');assert.match(row.stateMessage,/인터넷에 연결되지 않아/);assert.equal(row.live.weekly.usedPercent,100);
  // 인터넷이 닿는데 다시 읽어도 계정이 없을 때만 「다시 로그인」이다.
  f.state.codexNoAccountTimes=2;f.state.online=true;
  row=(await f.service.check()).rows.find(r=>r.service==='gpt');
  assert.equal(row.state,'needs-login');
});

test('Claude saying its token expired while the internet is down is a connection problem, not a lost login',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('claude');
  f.state.claudeExpiredTimes=1;f.state.online=false;
  let row=(await f.service.check()).rows.find(r=>r.service==='claude');
  assert.equal(row.state,'error');assert.match(row.stateMessage,/로그인이 풀린 것은 아닐 수 있어요/);
  assert.deepEqual(f.state.reachCalls,['https://api.anthropic.com/']);
  f.state.online=true;
  row=(await f.service.check()).rows.find(r=>r.service==='claude');
  assert.equal(row.state,'ok');
});

test('a Typecast key the server rejects asks to reconnect right away without probing',async()=>{
  const tc=fakeTypecast(),f=fakeSystem({fetch:tc.fetch,secrets:tc.secrets});
  const {id}=await f.service.connectKey('typecast',tc.good);
  tc.state.valid.clear();
  assert.equal((await f.service.check()).rows.find(r=>r.id===id).state,'needs-login');
  assert.deepEqual(f.state.reachCalls,[]);
});

test('a Claude login that is really gone is told apart from a usage screen that only failed to read',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('claude');
  const usageCalls=()=>f.calls.filter(c=>c.argv.includes('/usage'));
  // 파이프로 부르면 로그인이 없어도 비용 요약만 나온다(실제 Claude Code 2.1.302). auth status가 로그인 없음이라고 하면
  // 인터넷이 닿는지 보고 한 번 더 읽은 뒤 「다시 로그인」이다.
  f.state.claudeUsageOverride='Total cost:            $0.0000\nTotal duration (API):  0s\n';
  f.state.claudeAuthOverride=JSON.stringify({loggedIn:false,authMethod:'none'});
  let row=(await f.service.check()).rows.find(r=>r.service==='claude');
  assert.equal(row.state,'needs-login');assert.equal(usageCalls().length,3);
  // auth status를 못 읽었으면 로그인이 풀렸다고 단정하지 않는다.
  f.state.claudeAuthOverride='garbled';
  row=(await f.service.check()).rows.find(r=>r.service==='claude');
  assert.equal(row.state,'error');assert.match(row.stateMessage,/사용량 화면을 읽지 못했어요/);
  // 로그인돼 있는데 구독이 없으면(API 키 로그인) 그렇게 알린다.
  f.state.claudeAuthOverride=JSON.stringify({loggedIn:true,authMethod:'apiKey',subscriptionType:null});
  row=(await f.service.check()).rows.find(r=>r.service==='claude');
  assert.equal(row.state,'error');assert.match(row.stateMessage,/구독 한도가 없어요/);
  // 공식 프로그램의 표준입력은 바로 닫는다(열어 두면 Claude Code가 입력을 3초 기다린다).
  assert.ok(usageCalls().every(c=>c.child.stdinEnded));
});

/* ---------- 사용 기록 · 팁 반응 · 자동 읽기 ---------- */
test('keeps a numbers-only usage record on this PC and shows the 7-day bars',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('claude');await f.service.useExisting('higgsfield');
  const after=await f.service.check();
  const file=path.join(f.root,'data','history.jsonl');
  const lines=fs.readFileSync(file,'utf8').trim().split('\n').map(line=>JSON.parse(line));
  // 한 줄은 읽은 숫자뿐이다(이메일·토큰·폴더 없음).
  assert.ok(lines.length>=2);
  assert.ok(lines.every(line=>Object.keys(line).every(key=>['t','id','s','p','w','wr','c'].includes(key))));
  assert.ok(!fs.readFileSync(file,'utf8').includes('@'));
  assert.ok(lines.some(line=>line.s==='claude'&&line.w===31)&&lines.some(line=>line.s==='higgsfield'&&line.c===0.22));
  // 지금 창(10/15 10:59 시작)의 31%가 지난 7일 막대에 들어가고, 기록이 막 시작돼 「일부」·비교 없음이다.
  assert.deepEqual(after.usage.services.claude.bars[4],{v:31,partial:true});
  assert.equal(after.usage.services.claude.base,null);
  assert.equal(after.usage.services.higgsfield.bars[4].v,0);
  // 다시 띄운 본체도 같은 기록을 읽는다.
  const reread=createAiSubscriptions({root:path.join(f.root,'data'),platform:'win32',env:{},home:path.join(f.root,'home'),spawn:()=>{throw new Error('no spawn');},now:()=>NOW});
  assert.equal((await reread.snapshot()).usage.services.claude.bars[4].v,31);
});

test('remembers tip answers without making tips come back more often',async()=>{
  const f=fakeSystem(),DAY=864e5;
  let snap=await f.service.save({tip:{key:'spike:higgsfield',action:'helpful'}});
  assert.equal(snap.settings.tips['spike:higgsfield'].until,NOW+7*DAY);
  snap=await f.service.save({tip:{key:'spike:higgsfield',action:'stop'}});
  assert.equal(snap.settings.tips['spike:higgsfield'].until,NOW+28*DAY);assert.equal(snap.settings.tips['spike:higgsfield'].stops,1);
  snap=await f.service.save({tip:{key:'spike:higgsfield',action:'stop'}});
  assert.equal(snap.settings.tips['spike:higgsfield'].until,NOW+84*DAY);
  assert.equal((await f.service.save({tip:{key:'__proto__',action:'stop'}})).code,'INVALID_REQUEST');
  assert.equal((await f.service.save({tip:{key:'spike:higgsfield',action:'more'}})).code,'INVALID_REQUEST');
});

test('forgets the usage record of a removed account',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('claude');await f.service.useExisting('higgsfield');
  const higgs=(await f.service.check()).rows.find(row=>row.service==='higgsfield');
  await f.service.save({remove:higgs.id});
  const lines=fs.readFileSync(path.join(f.root,'data','history.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  assert.ok(lines.length>0&&lines.every(line=>line.id!==higgs.id));
});

test('reads by itself every 6 hours, 10 minutes before a weekly reset and on a billing morning',async()=>{
  const HOUR=3600e3,start=new Date(2026,9,19,8,0).getTime(),reset=start+3*HOUR;
  const make=({check,clock})=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-subs-auto-'));fs.mkdirSync(path.join(root,'data'));
    fs.writeFileSync(path.join(root,'data','board.json'),JSON.stringify({version:1,settings:{usdKrw:1400},check:{at:check,total:2,ok:2},rows:[
      {id:'r-a',service:'claude',source:'auto',label:'Claude',kind:'weekly',state:'ok',stateAt:check,live:{readAt:check,weekly:{usedPercent:14,resetsAt:reset}}},
      {id:'r-t',service:'typecast',source:'auto',label:'Typecast',kind:'credit',state:'ok',stateAt:check,billDay:20,keyHint:'FjrE',live:{readAt:check,credits:5}}]}));
    return createAiSubscriptions({root:path.join(root,'data'),platform:'win32',env:{},home:path.join(root,'home'),spawn:()=>{throw new Error('no spawn');},now:()=>clock});
  };
  const s=make({check:start-HOUR,clock:start});
  assert.equal(await s.autoDue(start),null);                       // 한 시간 전에 읽음
  assert.equal(await s.autoTick(),null);
  assert.deepEqual(await s.autoDue(reset-5*60e3),{ids:['r-a']});   // 초기화 10분 전 안, 그 뒤로 안 읽음
  assert.equal(await s.autoDue(reset+60e3),null);                  // 초기화가 지나면 다음 때(6시간)를 기다린다
  assert.deepEqual(await s.autoDue(start-HOUR+6*HOUR),{});          // 마지막 확인에서 6시간
  // 결제일(20일) 아침: 그날 9시 전에 읽었으면 9시 뒤 첫 때에 전체를 읽는다. 9시 뒤에 읽었으면 다시 안 읽는다.
  const bill=new Date(2026,9,20,9,30).getTime();
  assert.deepEqual(await make({check:new Date(2026,9,20,8,0).getTime(),clock:bill}).autoDue(bill),{});
  assert.equal(await make({check:new Date(2026,9,20,9,10).getTime(),clock:bill}).autoDue(bill),null);
  // 계정을 하나도 연결하지 않았으면 읽지 않는다.
  const empty=fakeSystem();assert.equal(await empty.service.autoDue(NOW),null);
});

test('an automatic read stays quiet on screen and gives way to a member\'s check',async()=>{
  const f=fakeSystem();
  await f.service.useExisting('claude');await f.service.useExisting('higgsfield');
  const first=f.changes.length;
  await f.service.check({quiet:true});
  const during=f.changes.slice(first);
  // 화면에는 「확인 중」·진행 수가 안 보이고, 마지막 알림까지 quiet가 달려 숫자를 굴리지 않는다.
  assert.ok(during.length>0&&during.every(s=>s.checking===false&&s.progress===null&&s.quiet===true));
  assert.equal((await f.service.snapshot()).quiet,false);
  // 자동 읽기 중에 회원이 「지금 확인」을 누르면 그때부터 진행이 보인다.
  f.state.usageDelay=30;const mark=f.changes.length;
  const auto=f.service.check({quiet:true});await new Promise(r=>setTimeout(r,5));
  const member=await f.service.check();await auto;
  assert.ok(f.changes.slice(mark).some(s=>s.checking===true&&s.quiet===false));
  assert.equal(member.checking,false);
});

test('rested tips come back with one press',async()=>{
  const f=fakeSystem();
  await f.service.save({tip:{key:'spike:higgsfield',action:'stop'}});await f.service.save({tip:{key:'pace:claude',action:'helpful'}});
  const snap=await f.service.save({tip:{action:'reset'}});
  assert.deepEqual(snap.settings.tips,{});
});
