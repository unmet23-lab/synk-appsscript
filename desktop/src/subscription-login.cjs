'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {EMAIL,randomId,commandFor,OUTPUT_LIMIT,loginUrl,LOGIN_TIMEOUT}=require('./subscription-common.cjs');
// 로그인 한 회차의 프로세스·타이머·취소를 소유한다. 공급자는 명령/확인, 계정 포트는 연결/정리만 담당한다.
function createSubscriptionLogin({runtime,providers,accounts,system,now,onChange:emit,openExternal}) {
  const {detectTools,spawnMacTerminal,openWindowsConsole,stopProcess,childEnv}=runtime;
  const {accountsDir,agyCwd,homeEnv,rows,add:addRow,refresh:check,removeFolder}=accounts;
  const {platform,env,spawn}=system;
  const {verifyLogin}=providers;
  let login=null;
  async function startLogin(service,{email,console:useConsole=false}={}){
    const adapter=providers.get(service),spec=adapter?.spec,behavior=adapter?.policy.login;if(!spec||!behavior)return {ok:false,code:'UNKNOWN_SERVICE'};
    if(spec.consoleLogin)useConsole=true;
    if(login&&!['done','error','cancelled'].includes(login.stage))return {ok:false,code:'LOGIN_BUSY'};
    await detectTools();if(!runtime.tools[service].path)return {ok:false,code:'TOOL_MISSING'};
    if(email!==undefined&&email!==null&&email!==''&&!(behavior.acceptsEmail&&EMAIL.test(String(email))))return {ok:false,code:'INVALID_EMAIL'};
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
      if(useConsole&&platform==='darwin')current.child=spawnMacTerminal(runtime.tools[service].path,args,homeEnv(service,folder),cwd);
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
    }catch{finishLogin(current,'error','로그인 프로그램을 열지 못했어요.');return {ok:false,code:'SPAWN_FAILED'};}
    current.child.on('error',()=>finishLogin(current,'error','로그인 프로그램을 열지 못했어요.'));
    if(useConsole){
      current.stage='console';
      current.message=behavior.consoleMessage||'검은 창이 열렸어요. 브라우저에서 승인하고, 코드가 나오면 검은 창에 붙여 넣어 주세요.';
      // Windows: 런처가 끝나면 검은 창이 닫힌 것이다. 마지막으로 한 번 확인하고, 로그인이 안 됐으면 10분을 기다리지 않고 알린다.
      if(current.pid)current.child.on('close',async()=>{
        if(login!==current||['done','error','cancelled'].includes(current.stage))return;
        const v=await verifyLogin(service,folder);
        if(v.ok)connected(current,v);else finishLogin(current,'error','검은 창이 닫혔는데 로그인이 확인되지 않았어요. 다시 시도해 주세요.');
      });
      else current.child.unref?.();
      pollLogin(current);
    }
    else{
      const onData=data=>{
        current.output=(current.output+data).slice(-OUTPUT_LIMIT);
        const url=!current.url&&loginUrl(current.output,behavior.domains);
        if(url){current.url=url;current.stage='browser';current.needsCode=!!behavior.needsCode;current.message=behavior.browserMessage||'브라우저에서 로그인을 마치면 자동으로 넘어가요.';emit();}
        if(/port .*(in use|already)|address already in use|EADDRINUSE/i.test(current.output))finishLogin(current,'error','다른 로그인 창이 이미 열려 있어요. 그 창을 닫고 다시 시도해 주세요.');
      };
      current.child.stdout?.on('data',onData);current.child.stderr?.on('data',onData);
      current.child.on('close',async code=>{
        if(current.stage==='cancelled'||current.stage==='error'||current.stage==='done')return;
        current.stage='verifying';current.message='연결을 확인하고 있어요.';emit();
        const v=await verifyLogin(service,folder);
        if(v.ok)connected(current,v);
        else finishLogin(current,'error',code===0?'로그인을 확인하지 못했어요. 브라우저에서 연결할 계정이 맞는지 보고 다시 시도해 주세요.':'로그인을 마치지 못했어요. 가이드의 「막혔을 때」를 확인해 주세요.');
      });
    }
    // Gemini 계정 바꾸기를 연 채 같은 계정으로 두면 기다림이 끝나지 않는다. 10분이 지났을 때 로그인이 살아 있으면 그 계정으로 마치고,
    // 창은 회원이 agy를 쓰는 중일 수 있어 닫지 않는다(Fable 10-22 P3-2). 로그인이 없을 때만 지금처럼 창을 닫고 알린다.
    current.timer=setTimeout(async()=>{
      if(['done','error','cancelled'].includes(current.stage))return;
      if(behavior.acceptAtTimeout){const v=await verifyLogin(service,folder).catch(()=>({ok:false}));if(v.ok){connected(current,v);return;}if(['done','error','cancelled'].includes(current.stage))return;}
      stopProcess(current.child,current.pid||current.child?.pid);finishLogin(current,'error','10분 동안 로그인이 끝나지 않아 멈췄어요. 다시 시도해 주세요.');
    },LOGIN_TIMEOUT);
    emit();
    return {ok:true,id:current.id};
  }
  // 기다리는 동안의 확인. Gemini는 처음에 로그인돼 있던 계정과 다른 계정(메일로 가림)이 읽히거나, 기다리는 사이 「로그인 필요」를 한 번 본 뒤
  // (창에서 /logout을 했다) 다시 읽히면 연결로 본다 — 메일을 못 읽는 옛 agy도 /logout → /login으로 마칠 수 있게(Fable 10-22 P3-2). 처음에 로그인이 없었으면 어느 계정이든.
  async function switched(current,v){
    if(!current.before)return true;
    const before=await current.before,lower=value=>String(value||'').toLowerCase();
    return !before.ok||!!current.sawLogout||!!before.email&&!!v.email&&lower(before.email)!==lower(v.email);
  }
  function pollLogin(current){
    const tick=async()=>{
      if(login!==current||['done','error','cancelled'].includes(current.stage))return;
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
    try{rows();}catch{finishLogin(current,'error','계정판 파일을 잠깐 열지 못했어요. 잠시 뒤 다시 연결해 주세요.');return;}
    // 새 폴더로 로그인했는데 이미 잘 읽히던 계정이 또 붙었다면, 브라우저에 남은 로그인으로 승인된 것이다. 겹쳐 넣지 않고 알린다.
    const signedIn=v.email?String(v.email).toLowerCase():null;
    const dup=signedIn&&current.folder&&rows().find(row=>row.source==='auto'&&row.service===current.service&&row.state==='ok'&&row.folder!==current.folder&&String(row.email||'').toLowerCase()===signedIn);
    if(dup){finishLogin(current,'error',`이미 연결된 ${v.email} 계정으로 다시 로그인됐어요. 다른 계정을 더하려면 「주소 복사」로 로그인 주소를 시크릿 창에 붙여 넣고 그 계정으로 로그인해 주세요.`);return;}
    const row=addRow(current.service,current.folder,v);
    const wanted=current.email?current.email.toLowerCase():null,got=v.email?String(v.email).toLowerCase():null;
    if(wanted&&got&&wanted!==got)finishLogin(current,'error',`${current.email} 대신 브라우저에 로그인돼 있던 ${v.email} 계정으로 연결됐어요. ${current.email}를 연결하려면 브라우저에서 그 계정으로 바꾼 뒤 다시 시도해 주세요.`);
    else finishLogin(current,'done',`${v.email||providers.get(current.service).spec.label} 계정을 연결했어요.`);
    check({ids:[row.id]}).catch(()=>{});
  }
  function finishLogin(current,stage,message){
    if(!current||['done','error','cancelled'].includes(current.stage))return;
    current.stage=stage;current.message=message;current.needsCode=false;
    clearTimeout(current.timer);clearTimeout(current.poll);
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
    login.needsCode=false;login.stage='verifying';login.message='코드를 보냈어요. 연결을 확인하고 있어요.';emit();
    return {ok:true};
  }
  function cancelLogin(id){
    if(!login||login.id!==id)return {ok:false,code:'NO_LOGIN'};
    const current=login;stopProcess(current.child,current.pid||current.child?.pid);
    finishLogin(current,'cancelled','로그인을 취소했어요.');
    return {ok:true};
  }
  async function openLoginUrl(id){
    if(!login||login.id!==id||!login.url)return {ok:false,code:'NO_URL'};
    try{await openExternal(login.url);return {ok:true};}catch{return {ok:false,code:'OPEN_FAILED'};}
  }


  return {get state(){return login;},startLogin,submitCode,cancelLogin,openLoginUrl,dispose(){if(login){if(!['done','error','cancelled'].includes(login.stage))stopProcess(login.child,login.pid||login.child?.pid);clearTimeout(login.timer);clearTimeout(login.poll);}}};
}
module.exports={createSubscriptionLogin};
