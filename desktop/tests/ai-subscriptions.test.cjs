'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {createAiSubscriptions,parseClaudeUsage,parseResetText,codexWindows,loginUrl,claudeNeedsLogin,commandFor}=require('../src/ai-subscriptions.cjs');

const USAGE=`You are currently using your subscription to power your Claude Code usage

Current session: 51% used · resets Oct 17, 11:19am (Asia/Seoul)
Current week (all models): 31% used · resets Oct 22, 10:59am (Asia/Seoul)
Current week (Fable): 17% used · resets Oct 22, 10:59am (Asia/Seoul)`;
const NOW=new Date(2026,9,17,10,0).getTime();

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
function fakeSystem({claudeLoggedIn=true}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-subs-'));
  const home=path.join(root,'home'),bin=path.join(home,'.local','bin'),npm=path.join(root,'npm');
  fs.mkdirSync(bin,{recursive:true});fs.mkdirSync(npm,{recursive:true});
  for(const file of [path.join(bin,'claude.exe'),path.join(npm,'codex.cmd'),path.join(npm,'higgsfield.exe'),path.join(npm,'npm.cmd')])fs.writeFileSync(file,'');
  const calls=[],stdinWrites=[];let loginChild=null;const state={claudeLoggedIn};
  function spawn(command,argv,options){
    const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
    const call={command,argv,options};calls.push(call);
    const joined=[command,...argv].join(' ');
    const reply=(out,code=0)=>setImmediate(()=>{if(out)child.stdout.emit('data',out);child.emit('close',code);});
    child.kill=()=>setImmediate(()=>child.emit('close',null));child.unref=()=>{};
    child.stdin={write(text){stdinWrites.push(text);if(child.onInput)child.onInput(text);return true;},end(){}};
    if(command==='powershell.exe')reply('');
    else if(joined.includes('--version'))reply(command.endsWith('claude.exe')?'2.1.301 (Claude Code)\n':'1.0.0\n');
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
    else if(joined.includes('account status'))reply(JSON.stringify({credits:0.22,email:'77@example.com',subscription_plan_type:'ultra'}));
    else reply('',1);
    return child;
  }
  const changes=[],opened=[];
  const service=createAiSubscriptions({root:path.join(root,'data'),platform:'win32',env:{PATH:npm,APPDATA:path.join(root,'appdata'),ComSpec:'cmd.exe',CLAUDECODE:'1',CLAUDE_CONFIG_DIR:'X'},home,spawn,now:()=>NOW,openExternal:async url=>opened.push(url),onChange:s=>changes.push(s)});
  return {root,service,calls,stdinWrites,changes,opened,state,get loginChild(){return loginChild;}};
}

test('finds the official tools, reads existing logins and keeps tokens out of the snapshot',async()=>{
  const f=fakeSystem();
  const snap=await f.service.snapshot();
  assert.deepEqual(Object.fromEntries(Object.entries(snap.tools).map(([k,v])=>[k,v.installed])),{claude:true,gpt:true,higgsfield:true});
  const claude=await f.service.useExisting('claude');assert.equal(claude.ok,true);
  const gpt=await f.service.useExisting('gpt');assert.equal(gpt.ok,true);
  const higgs=await f.service.useExisting('higgsfield');assert.equal(higgs.ok,true);
  const after=await f.service.check();
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
