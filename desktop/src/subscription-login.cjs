'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {EMAIL,randomId,commandFor,OUTPUT_LIMIT,loginUrl,LOGIN_TIMEOUT}=require('./subscription-common.cjs');
// 로그인 한 회차의 프로세스·타이머·취소를 소유한다. 공급자는 명령/확인, 계정 포트는 연결/정리만 담당한다.
function createSubscriptionLogin({runtime,providers,accounts,system,now,onChange:emit,openExternal}) {
  const {detectTools,spawnMacTerminal,openWindowsConsole,stopProcess,childEnv}=runtime;
  const {accountsDir,agyCwd,homeEnv,rows,add:addRow,refresh:check,removeFolder}=accounts;
  const {platform,env,spawn}=system;
  const {verifyLogin}=providers;
  const kill=system.kill||((pid,signal)=>process.kill(pid,signal));
  const ended=current=>['done','error','cancelled'].includes(current.stage);
  let login=null;
  // 프로세스의 시작 시각(ps lstart). 같은 번호가 다른 프로그램에 다시 쓰였는지 가르는 데 쓴다. exec 뒤에도 바뀌지 않는다.
  // 스크립트와 같이 C 로캘 · UTC로 읽어 Terminal과 앱의 로캘 · 시간대가 달라도 같은 글이 된다. 공백은 하나로 맞춘다.
  // 읽지 못하면 null(모름)이다(GPT -n GA1 · -r GA1 · -t GA1)
  const stampText=text=>String(text||'').trim().replace(/\s+/g,' ')||null;
  const stampOf=system.processStamp||(pid=>{try{return stampText(require('node:child_process').execFileSync('/bin/ps',['-o','lstart=','-p',String(pid)],{encoding:'utf8',timeout:3000,env:{...process.env,LC_ALL:'C',TZ:'UTC'},stdio:['ignore','pipe','ignore']}));}catch{return null;}});
  // macOS Terminal 창 안의 로그인 CLI 번호와 시작 시각. 창의 스크립트가 자기 자신일 때 stamp(시작 시각)를 먼저 쓰고 pid(번호)를 쓴다.
  // 그래서 번호가 보이면 시작 시각은 이미 다 쓰여 있다. 앱이 처음 읽기 전에 번호가 재사용돼도 기준은 스크립트가 적은 값이다(GPT -n GA3)
  function macPid(current){
    if(!current.macPid&&current.runDir){try{
      const pid=Number(fs.readFileSync(path.join(current.runDir,'pid'),'utf8').trim());
      if(Number.isInteger(pid)&&pid>1){current.macStamp=stampText(fs.readFileSync(path.join(current.runDir,'stamp'),'utf8'));current.macPid=pid;}
    }catch{}}
    return current.macPid||null;
  }
  const alive=pid=>{try{kill(pid,0);return true;}catch(error){return error?.code==='EPERM';}};
  // 번호의 지금 주인: 'ours'(이 회차의 CLI) · 'gone'(끝났거나 다른 프로그램이 받음) · 'unknown'(살아 있으나 시작 시각을 읽지 못함).
  // 신호는 ours에만 보낸다. 끝난 것으로 보는 것은 gone뿐이다. unknown은 바쁜 것으로 두어 둘째 CLI를 열지 않는다(GPT -c GA1 · -g GA4 · -k GA3 · -n GA1)
  function owner(current){
    const pid=macPid(current);
    if(!pid)return null;
    if(!alive(pid))return 'gone';
    const now=stampText(stampOf(pid));
    if(now===null||!current.macStamp)return 'unknown';
    return now===current.macStamp?'ours':'gone';
  }
  const ours=current=>owner(current)==='ours';
  // 로그인 프로그램을 끈다. 끝난 회차는 건드리지 않는다(그 번호는 이미 다른 프로그램에 다시 쓰였을 수 있다, -c GA1).
  // macOS 차례: ① 회차 폴더의 go 표식을 지운다 ② 번호를 읽어 살아 있으면 끈다. 스크립트는 번호를 다 쓴 뒤 go가 있을 때만 exec한다.
  // 스크립트의 확인이 ①보다 앞섰으면 번호는 그 전에 다 쓰였으므로 ②에서 읽힌다. ①보다 뒤면 go가 없어 스스로 끝난다.
  // 번호 파일을 연 뒤 쓰기 전의 틈이나 폴더를 지우는 도중의 틈도 이 순서로 닫힌다(GPT -g GA1 · GA5 · GA6, -i GA1).
  // go를 지우지 못하면 폴더 이름을 바꿔 그 자리의 go를 없앤다. finishLogin이 폴더를 지운다
  function stopLogin(current){
    if(ended(current))return;
    stopProcess(current.child,current.pid||current.child?.pid);
    if(!current.runDir)return;
    const go=path.join(current.runDir,'go');
    try{fs.rmSync(go,{force:true});}catch{}
    if(fs.existsSync(go)){const moved=current.runDir+'-stop';try{fs.renameSync(current.runDir,moved);current.runDir=moved;}catch{}}
    if(ours(current))stopMacCli(current.macPid);
  }
  // 창 안의 CLI와 그 프로세스 묶음(CLI가 띄운 자식)에 SIGTERM과 SIGHUP(창을 닫을 때 Terminal이 보내는 신호)을 같은 때 보낸다.
  // 늦게 보내는 SIGKILL은 그사이 번호가 다른 프로그램에 다시 쓰일 수 있어 두지 않는다(설계 검토 P2-1, GPT -g GA2 · GA3 · GA4)
  function stopMacCli(pid){
    for(const signal of ['SIGTERM','SIGHUP'])for(const target of [-pid,pid]){try{kill(target,signal);}catch{}}
  }
  async function startLogin(service,{email,console:useConsole=false}={}){
    const adapter=providers.get(service),spec=adapter?.spec,behavior=adapter?.policy.login;if(!spec||!behavior)return {ok:false,code:'UNKNOWN_SERVICE'};
    if(spec.consoleLogin)useConsole=true;
    // 진행 중인 로그인이 있으면 막는다. macOS Terminal 로그인은 창 안의 CLI가 살아 있을 때만 막고, 번호를 모르거나 이미 끝났으면
    // 새 로그인이 바꾼다(회원이 창을 닫은 뒤 10분 동안 다음 연결이 막히지 않게, GPT solio-subs-agy-be-20261126 A8).
    // 바꾸기는 새 요청이 CLI 확인과 메일 확인을 통과한 뒤에 한다. 먼저 끝내면 새 요청이 TOOL_MISSING으로 끝날 때 앞 로그인만 잃었다(-b GA1)
    const busy=()=>login&&!ended(login);
    const replaceable=current=>platform==='darwin'&&current.stage==='console'&&!current.pid&&[null,'gone'].includes(owner(current));
    let stale=null;
    if(busy()){if(replaceable(login))stale=login;else return {ok:false,code:'LOGIN_BUSY'};}
    await detectTools();if(!runtime.tools[service].path)return {ok:false,code:'TOOL_MISSING'};
    if(email!==undefined&&email!==null&&email!==''&&!(behavior.acceptsEmail&&EMAIL.test(String(email))))return {ok:false,code:'INVALID_EMAIL'};
    if(busy()&&(login!==stale||!replaceable(login)))return {ok:false,code:'LOGIN_BUSY'};
    if(stale&&!ended(stale)){stopLogin(stale);finishLogin(stale,'cancelled','로그인을 새로 시작했습니다.');}
    const folder=spec.folders?service+'-'+randomId():null;
    if(folder)fs.mkdirSync(path.join(accountsDir,folder),{recursive:true});
    // agy는 로그인 명령이 따로 없고, 처음 켜면 로그인 화면이 나온다.
    const args=behavior.args(email);
    const current={id:'l-'+randomId(),service,folder,email:email?String(email):null,stage:'starting',url:null,needsCode:false,message:'',console:useConsole,child:null,startedAt:now(),output:''};
    login=current;
    // Gemini 계정 바꾸기: 창이 뜨는 동안 지금 로그인된 계정을 먼저 읽어 두고, 기다리는 동안에는 다른 계정이 로그인됐을 때만 연결로 본다
    // (이미 로그인된 채 창을 열면 바꾸기 전 계정이 곧바로 읽힌다). 창에서 /logout → /login을 하는 데는 이 읽기(몇 초)보다 오래 걸린다.
    // 창을 닫으면 그때 로그인된 계정으로 마친다.
    if(behavior.trackPrevious)current.before=verifyLogin(service,null).catch(()=>({ok:false}));
    const cwd=behavior.dataCwd?agyCwd():undefined;
    try{
      if(useConsole&&platform==='darwin'){current.runDir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-login-'));fs.writeFileSync(path.join(current.runDir,'go'),'');current.child=spawnMacTerminal(runtime.tools[service].path,args,homeEnv(service,folder),cwd,current.runDir);}
      else if(useConsole&&platform==='win32'){
        const opened=await openWindowsConsole(runtime.tools[service].path,args,{extraEnv:homeEnv(service,folder),cwd,wait:true});
        if(!opened.ok)throw new Error('console');
        current.child=opened.child;current.pid=opened.pid;
        // 창이 뜨는 사이에 취소했으면 방금 연 창도 닫는다.
        if(current.stage!=='starting'){stopProcess(current.child,current.pid);return {ok:false,code:'CANCELLED'};}
      }
      else{
        const {command,argv,verbatim}=commandFor(runtime.tools[service].path,args,{platform,env});
        current.child=spawn(command,argv,useConsole
          ?{env:childEnv(homeEnv(service,folder)),shell:false,detached:true,stdio:'ignore',windowsHide:false,windowsVerbatimArguments:verbatim,...(cwd?{cwd}:{})}
          :{env:childEnv(homeEnv(service,folder)),shell:false,windowsHide:true,windowsVerbatimArguments:verbatim});
      }
    }catch{finishLogin(current,'error','로그인 프로그램을 열지 못했습니다.');return {ok:false,code:'SPAWN_FAILED'};}
    current.child.on('error',()=>finishLogin(current,'error','로그인 프로그램을 열지 못했습니다.'));
    if(useConsole){
      current.stage='console';
      current.message=behavior.consoleMessage||'검은 창이 열렸습니다. 브라우저에서 승인하고, 코드가 나오면 검은 창에 붙여 넣어 주세요.';
      // Windows: 런처가 끝나면 검은 창이 닫힌 것이다. 마지막으로 한 번 확인하고, 로그인이 안 됐으면 10분을 기다리지 않고 알린다.
      if(current.pid)current.child.on('close',async()=>{
        if(login!==current||['done','error','cancelled'].includes(current.stage))return;
        const v=await verifyLogin(service,folder);
        if(v.ok)connected(current,v);else finishLogin(current,'error','검은 창이 닫혔는데 로그인이 확인되지 않았습니다. 다시 시도해 주세요.');
      });
      else{
        current.child.unref?.();
        // macOS: osascript가 실패로 끝나면(Terminal 제어 허용을 거절함 등) 창이 열리지 않은 것이다. 10분을 기다리지 않고 알린다(설계 검토 P2-3)
        if(current.runDir)current.child.on('close',code=>{
          // 0으로 끝난 때부터 「번호 없이 30초」를 센다. 처음 쓸 때 macOS가 Terminal 제어 허용을 묻는 동안은 osascript가 끝나지 않는다(GPT -n GA2)
          if(!code){current.openedAt=now();return;}
          if(login!==current||ended(current)||macPid(current))return;
          finishLogin(current,'error','Terminal 창을 열지 못했습니다. 시스템 설정의 「개인정보 보호 및 보안」 › 「자동화」에서 SYNK가 Terminal을 제어하도록 허용한 뒤 다시 시도해 주세요.');
        });
      }
      pollLogin(current);
    }
    else{
      const onData=data=>{
        current.output=(current.output+data).slice(-OUTPUT_LIMIT);
        const url=!current.url&&loginUrl(current.output,behavior.domains);
        if(url){current.url=url;current.stage='browser';current.needsCode=!!behavior.needsCode;current.message=behavior.browserMessage||'브라우저에서 로그인을 마치면 자동으로 넘어갑니다.';emit();}
        if(/port .*(in use|already)|address already in use|EADDRINUSE/i.test(current.output))finishLogin(current,'error','다른 로그인 창이 이미 열려 있습니다. 그 창을 닫고 다시 시도해 주세요.');
      };
      current.child.stdout?.on('data',onData);current.child.stderr?.on('data',onData);
      current.child.on('close',async code=>{
        if(current.stage==='cancelled'||current.stage==='error'||current.stage==='done')return;
        current.stage='verifying';current.message='연결을 확인하고 있습니다.';emit();
        const v=await verifyLogin(service,folder);
        if(v.ok)connected(current,v);
        else finishLogin(current,'error',code===0?'로그인을 확인하지 못했습니다. 브라우저에서 연결할 계정이 맞는지 보고 다시 시도해 주세요.':'로그인을 마치지 못했습니다. 계정 관리의 「막혔을 때」를 확인해 주세요.');
      });
    }
    // Gemini 계정 바꾸기를 연 채 같은 계정으로 두면 기다림이 끝나지 않는다. 10분이 지났을 때 로그인이 살아 있으면 그 계정으로 마치고,
    // 창은 회원이 agy를 쓰는 중일 수 있어 닫지 않는다(10-22 검수 P3-2). 로그인이 없을 때만 지금처럼 창을 닫고 알린다.
    current.timer=setTimeout(async()=>{
      if(['done','error','cancelled'].includes(current.stage))return;
      if(behavior.acceptAtTimeout){const v=await verifyLogin(service,folder).catch(()=>({ok:false}));if(v.ok){connected(current,v);return;}if(['done','error','cancelled'].includes(current.stage))return;}
      stopLogin(current);finishLogin(current,'error','10분 동안 로그인이 끝나지 않아 멈췄습니다. 다시 시도해 주세요.');
    },LOGIN_TIMEOUT);
    emit();
    return {ok:true,id:current.id};
  }
  // 기다리는 동안의 확인. Gemini는 처음에 로그인돼 있던 계정과 다른 계정(메일로 가림)이 읽히거나, 기다리는 사이 「로그인 필요」를 한 번 본 뒤
  // (창에서 /logout을 했다) 다시 읽히면 연결로 본다 — 메일을 못 읽는 옛 agy도 /logout → /login으로 마칠 수 있게(10-22 검수 P3-2). 처음에 로그인이 없었으면 어느 계정이든.
  async function switched(current,v){
    if(!current.before)return true;
    const before=await current.before,lower=value=>String(value||'').toLowerCase();
    return !before.ok||!!current.sawLogout||!!before.email&&!!v.email&&lower(before.email)!==lower(v.email);
  }
  function pollLogin(current){
    const tick=async()=>{
      if(login!==current||['done','error','cancelled'].includes(current.stage))return;
      // macOS: 창 안의 CLI가 끝났으면(창을 닫았다) Windows처럼 한 번 확인하고 마친다. 10분을 기다리지 않는다(GA4).
      // 30초가 지나도 스크립트가 번호를 쓰지 않았으면 창이 뜨자마자 닫혔거나 스크립트가 돌지 않은 것이다. 같은 방법으로 마친다(GPT -g GA6)
      const pid=macPid(current);
      // osascript가 창을 연 뒤 30초가 지나도 번호가 없으면 스크립트가 돌지 않은 것이다(창이 뜨자마자 닫힘 등). 확인하지 않고 끝낸다.
      // stopLogin이 go를 먼저 지우므로 그 사이 늦게 뜬 스크립트는 CLI가 되지 않고, 이미 go를 지났으면 번호가 있어 꺼진다(GPT -k GA1 · GA4 · -n GA2 · GA4)
      if(current.runDir&&!pid&&current.openedAt&&now()-current.openedAt>30000){
        stopLogin(current);
        if(ended(current))return;
        finishLogin(current,'error','Terminal 창에서 로그인이 시작되지 않았습니다. 창을 닫았다면 다시 시도해 주세요.');
        return;
      }
      if(pid&&owner(current)==='gone'){
        const v=await verifyLogin(current.service,current.folder).catch(()=>({ok:false}));
        if(login!==current||ended(current))return;
        if(v.ok){connected(current,v);return;}
        stopLogin(current);
        finishLogin(current,'error','Terminal 창이 닫혔는데 로그인이 확인되지 않았습니다. 다시 시도해 주세요.');
        return;
      }
      const v=await verifyLogin(current.service,current.folder);
      if(!v.ok&&v.state==='needs-login')current.sawLogout=true;
      if(v.ok&&await switched(current,v)){connected(current,v);return;}
      if(login!==current||['done','error','cancelled'].includes(current.stage))return;
      current.poll=setTimeout(tick,4000);
    };
    current.poll=setTimeout(tick,6000);
  }
  // 이메일을 미리 채워도 브라우저에 이미 로그인된 계정으로 승인될 수 있다. 다르면 알려 준다(연결된 계정은 그대로 둔다).
  function connected(current,v){
    // 확인을 기다리는 사이에 취소·시간 초과로 끝났으면 줄을 더하지 않는다(그 계정 폴더는 이미 지워졌다).
    if(login!==current||['done','error','cancelled'].includes(current.stage))return;
    try{rows();}catch{finishLogin(current,'error','AI 구독 관리 파일을 잠깐 열지 못했습니다. 잠시 뒤 다시 연결해 주세요.');return;}
    // 새 폴더로 로그인했는데 이미 잘 읽히던 계정이 또 붙었다면, 브라우저에 남은 로그인으로 승인된 것이다. 겹쳐 넣지 않고 알린다.
    // 다만 그 계정으로 로그인하겠다고 메일을 넣고 시작했으면(줄의 「다시 로그인」) 로그인 기한을 새로 받는 일이다(Claude 11-16 — 기한 전에 미리 다시 로그인).
    // 그때는 그 줄을 새 폴더로 옮긴다(addRow가 옛 폴더를 지운다).
    const signedIn=v.email?String(v.email).toLowerCase():null;
    const wanted=current.email?current.email.toLowerCase():null,got=signedIn;
    const dup=signedIn&&current.folder&&wanted!==signedIn&&rows().find(row=>row.source==='auto'&&row.service===current.service&&row.state==='ok'&&row.folder!==current.folder&&String(row.email||'').toLowerCase()===signedIn);
    if(dup){finishLogin(current,'error',`이미 연결된 ${v.email} 계정으로 다시 로그인됐습니다. 다른 계정을 더하려면 「주소 복사」로 로그인 주소를 시크릿 창에 붙여 넣고 그 계정으로 로그인해 주세요.`);return;}
    const row=addRow(current.service,current.folder,v);
    if(wanted&&got&&wanted!==got)finishLogin(current,'error',`${current.email} 대신 브라우저에 로그인되어 있던 ${v.email} 계정으로 연결됐습니다. ${current.email} 계정을 연결하려면 브라우저에서 그 계정으로 바꾼 뒤 다시 시도해 주세요.`);
    else finishLogin(current,'done',`${v.email||providers.get(current.service).spec.label} 계정을 연결했습니다.`);
    check({ids:[row.id],fresh:true}).catch(()=>{});
  }
  function finishLogin(current,stage,message){
    if(!current||['done','error','cancelled'].includes(current.stage))return;
    current.stage=stage;current.message=message;current.needsCode=false;
    clearTimeout(current.timer);clearTimeout(current.poll);
    if(current.runDir){macPid(current);try{fs.rmSync(current.runDir,{recursive:true,force:true});}catch{}}
    // 판을 못 읽으면 그 폴더를 쓰는 줄이 있는지 모르므로 지우지 않는다.
    let used=true;try{used=rows().some(row=>row.folder===current.folder);}catch{}
    if(stage!=='done'&&current.folder&&!used)removeFolder(current.folder);
    emit();
  }
  function submitCode(id,code){
    if(!login||login.id!==id||!login.needsCode||!login.child?.stdin)return {ok:false,code:'NO_LOGIN'};
    const value=String(code||'').trim();
    if(value.length<8||value.length>2048||/[\r\n\s]/.test(value))return {ok:false,code:'INVALID_CODE'};
    try{login.child.stdin.write(value+'\n');}catch{return {ok:false,code:'WRITE_FAILED'};}
    login.needsCode=false;login.stage='verifying';login.message='코드를 보냈습니다. 연결을 확인하고 있습니다.';emit();
    return {ok:true};
  }
  function cancelLogin(id){
    if(!login||login.id!==id)return {ok:false,code:'NO_LOGIN'};
    if(ended(login))return {ok:true};
    const current=login;stopLogin(current);
    finishLogin(current,'cancelled','로그인을 취소했습니다.');
    return {ok:true};
  }
  async function openLoginUrl(id){
    if(!login||login.id!==id||!login.url)return {ok:false,code:'NO_URL'};
    try{await openExternal(login.url);return {ok:true};}catch{return {ok:false,code:'OPEN_FAILED'};}
  }


  return {get state(){return login;},startLogin,submitCode,cancelLogin,openLoginUrl,dispose(){if(login){if(!['done','error','cancelled'].includes(login.stage))stopLogin(login);clearTimeout(login.timer);clearTimeout(login.poll);if(login.runDir)try{fs.rmSync(login.runDir,{recursive:true,force:true});}catch{}}}};
}
module.exports={createSubscriptionLogin};
