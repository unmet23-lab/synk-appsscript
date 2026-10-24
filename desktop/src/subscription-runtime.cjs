'use strict';
const fs=require('node:fs');
const {READ_TIMEOUT,OUTPUT_LIMIT,SERVICES,candidatePaths,cleanText,stripAnsi,commandFor}=require('./subscription-common.cjs');
const {providerPolicy}=require('./subscription-catalog.cjs');
// 프로세스·환경·도구 캐시는 실행 계층 한 곳에서 관리한다.
function createSubscriptionRuntime({platform,env,spawn,now,home}) {
  let tools=null,toolsAt=0,freshPath=null;
  /* 실행 */
  // force: 「다시 확인」·「지금 확인」·설치 창 열기 때마다 다시 읽는다. 한 번 읽은 값을 계속 쓰면 앱을 켠 채 설치한
  // Node.js·CLI를 앱을 다시 켤 때까지 못 찾는다.
  async function refreshPath(force=false){
    if(platform!=='win32')return '';
    if(freshPath!==null&&!force)return freshPath;
    // 설치 직후 앱을 다시 켜지 않아도 새 PATH를 보도록 사용자·시스템 PATH를 다시 읽는다(고정 명령).
    const r=await rawRun('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')"],{env,timeout:15000});
    if(r.code===0)freshPath=r.out.trim();else if(freshPath===null)freshPath='';
    return freshPath;
  }
  function childEnv(extra={}){
    const out={...env};
    for(const key of Object.keys(out))if(/^(ELECTRON_|CLAUDECODE$|CLAUDE_CODE_|CLAUDE_CONFIG_DIR$|CODEX_HOME$|NODE_OPTIONS$)/.test(key))delete out[key];
    if(freshPath)out.PATH=[freshPath,out.PATH||out.Path||''].filter(Boolean).join(';');
    out.NO_COLOR='1';out.FORCE_COLOR='0';
    return {...out,...extra};
  }
  function rawRun(command,argv,{env:runEnv,input=null,timeout=READ_TIMEOUT,verbatim=false,cwd}={}){
    return new Promise(resolve=>{
      let out='',err='',done=false,child;
      const finish=code=>{if(done)return;done=true;clearTimeout(timer);resolve({code,out,err});};
      try{child=spawn(command,argv,{env:runEnv,shell:false,windowsHide:true,windowsVerbatimArguments:verbatim,...(cwd?{cwd}:{})});}catch(error){resolve({code:-1,out:'',err:String(error?.message||error)});return;}
      const timer=setTimeout(()=>{stopProcess(child);finish(-2);},timeout);
      child.stdout?.on('data',d=>{if(out.length<OUTPUT_LIMIT)out+=d;});
      child.stderr?.on('data',d=>{if(err.length<OUTPUT_LIMIT)err+=d;});
      child.on('error',error=>{err+=String(error?.message||error);finish(-1);});
      child.on('close',code=>finish(code));
      // 넣을 것이 없어도 표준입력은 바로 닫는다. 열어 두면 Claude Code(-p)가 입력을 3초 기다린 뒤에야 답한다(10-18 실측).
      if(input!==null)child.stdin?.end(input);else child.stdin?.end();
    });
  }
  // Windows에서 npm 설치본(.cmd)은 cmd.exe가 실제 CLI(node)를 띄운다. cmd만 끄면 CLI가 남아 로그인 대기 포트를 잡고 있으므로
  // 프로세스 묶음째 끈다(10-18 실측: child.kill() 뒤에도 손자 CLI가 살아 있었다). pid만 있는 검은 창도 같은 길로 끈다.
  // taskkill이 묶음을 다 찾은 뒤에 child.kill()을 부른다(cmd를 먼저 끄면 손자와의 부모 연결이 끊겨 /T가 못 찾는다).
  // child가 아직 살아 있을 때만 PID로 끈다. 끝난 프로세스의 PID는 다른 프로그램에 다시 쓰일 수 있다.
  function stopProcess(child,pid=child?.pid){
    const kill=()=>{try{child?.kill();}catch{}};
    const alive=!!child&&child.exitCode===null&&child.signalCode===null;
    if(platform==='win32'&&alive&&Number.isInteger(pid)&&pid>0){
      try{const k=spawn('taskkill',['/PID',String(pid),'/T','/F'],{shell:false,windowsHide:true,stdio:'ignore'});k.on('close',kill);k.on('error',kill);return;}catch{}
    }
    kill();
  }
  // Windows 검은 창: 숨긴 PowerShell이 Start-Process로 새 창을 띄우고 그 PID를 알려 준다. Node의 detached는 DETACHED_PROCESS라
  // 콘솔이 아예 없어, 설치 PowerShell은 한 줄도 돌지 않고 로그인 CLI도 창 없이 뜬다(10-18 실측). 환경변수·작업 폴더는 그대로 물려받는다.
  // wait: 런처가 창이 닫힐 때까지 기다린다. 런처가 창 프로세스를 쥐고 있는 동안은 PID가 재사용되지 않으니 그동안만 PID로 끈다.
  const psQuote=value=>"'"+String(value).replace(/'/g,"''")+"'";
  const psEncoded=text=>Buffer.from(text,'utf16le').toString('base64');
  const winArg=value=>/[\s"]/.test(value)?'"'+String(value).replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/,'$1$1')+'"':String(value);
  function openWindowsConsole(file,args=[],{extraEnv={},cwd,wait=false}={}){
    const script=`$p=Start-Process -FilePath ${psQuote(file)}${args.length?' -ArgumentList '+args.map(a=>psQuote(winArg(a))).join(','):''}${cwd?' -WorkingDirectory '+psQuote(cwd):''} -PassThru; [Console]::Out.WriteLine($p.Id); [Console]::Out.Flush()${wait?'; $p.WaitForExit()':''}`;
    return new Promise(resolve=>{
      let child,out='',done=false;
      const pidIn=()=>{const m=/^\s*(\d+)\s*$/m.exec(out);return m?Number(m[1]):null;};
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
      try{child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',psEncoded(script)],{env:childEnv(extraEnv),shell:false,windowsHide:true});}catch{resolve({ok:false});return;}
      const timer=setTimeout(()=>{stopProcess(child);finish({ok:false});},30000);
      child.stdout?.on('data',d=>{out+=d;const pid=pidIn();if(pid)finish({ok:true,pid,child});});
      child.on('error',()=>finish({ok:false}));
      child.on('close',()=>{const pid=pidIn();finish(pid?{ok:true,pid,child}:{ok:false});});
    });
  }
  async function detectTools(force=false){
    if(tools&&!force&&now()-toolsAt<5*60*1000)return tools;
    await refreshPath(force||!tools);
    const searchEnv=childEnv();
    const next={};
    for(const [key,spec] of Object.entries(SERVICES)){
      if(!spec.bin){next[key]={path:null,version:null,api:true};continue;}
      const found=candidatePaths(spec.bin,{platform,env:searchEnv,home}).find(p=>{try{return fs.statSync(p).isFile();}catch{return false;}})||null;
      let version=null;
      if(found){const r=await runTool(found,['--version'],{timeout:20000});version=cleanText(stripAnsi(r.out||r.err).split(/\r?\n/)[0],60)||null;}
      next[key]={path:found,version};
    }
    for(const key of Object.keys(next))if(providerPolicy(key)?.requiresNpm)next[key].npm=!!candidatePaths('npm',{platform,env:searchEnv,home}).find(p=>{try{return fs.statSync(p).isFile();}catch{return false;}});
    tools=next;toolsAt=now();
    return tools;
  }
  function invalidateTools(){tools=null;}
  function runTool(file,args,{extraEnv={},input=null,timeout=READ_TIMEOUT,cwd}={}){
    const {command,argv,verbatim}=commandFor(file,args,{platform,env});
    return rawRun(command,argv,{env:childEnv(extraEnv),input,timeout,verbatim,cwd});
  }
  // macOS에는 따로 여는 검은 창이 없어 터미널 앱에 고정 명령을 넘긴다. 값은 셸 작은따옴표로 감싼다.
  const shQuote=value=>"'"+String(value).replace(/'/g,"'\\''")+"'";
  const asString=value=>'"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
  function spawnMacTerminal(file,args,extraEnv,cwd){
    const line=[cwd?`cd ${shQuote(cwd)} &&`:'',...Object.entries(extraEnv).map(([key,value])=>`${key}=${shQuote(value)}`),shQuote(file),...args.map(shQuote)].filter(Boolean).join(' ');
    return spawn('osascript',['-e',`tell application "Terminal" to do script ${asString(line)}`,'-e','tell application "Terminal" to activate'],{env:childEnv(),shell:false,detached:true,stdio:'ignore'});
  }


  return {get tools(){return tools;},invalidateTools,refreshPath,detectTools,runTool,childEnv,rawRun,stopProcess,openWindowsConsole,spawnMacTerminal,psEncoded};
}
module.exports={createSubscriptionRuntime};
