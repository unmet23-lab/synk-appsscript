'use strict';
const fs=require('node:fs'),path=require('node:path');
const spec=Object.freeze({label:'Gemini',kind:'weekly',bin:'agy',home:null,folders:false,consoleLogin:true});
const policy=Object.freeze({windowsDirectories:({env,home})=>{const local=env.LOCALAPPDATA||path.join(home,'AppData','Local');return [path.join(local,'agy','bin'),path.join(local,'Microsoft','WinGet','Links')];},installer:"irm https://antigravity.google/cli/install.ps1 | iex",macInstaller:"curl -fsSL https://antigravity.google/cli/install.sh | bash",reachable:"https://oauth2.googleapis.com/",login:{args:()=>[],trackPrevious:true,acceptAtTimeout:true,dataCwd:true,consoleMessage:'검은 창이 열렸어요. Enter로 「Google OAuth」를 고르고, 브라우저에서 계정을 고른 뒤 「로그인」을 눌러 주세요. 브라우저에 나온 코드를 「클립보드에 복사」해 검은 창에 붙여 넣고 Enter를 누르면 돼요(검은 창에서는 오른쪽 클릭이 붙여넣기예요).'},sharedAccount:{hiddenKey:'geminiHidden',hiddenMax:20,awayMessage:'지금 이 PC의 Antigravity에는 다른 계정이 로그인돼 있어요 — 마지막으로 읽은 값이에요.',nobodyMessage:'지금 이 PC의 Antigravity에 로그인된 계정이 없어요 — 마지막으로 읽은 값이에요.',unknownMessage:'Antigravity CLI에 어느 계정이 로그인돼 있는지 확인하지 못해 이번 값은 넣지 않았어요. 잠시 뒤 다시 확인해 주세요.'}});
// 공급자 명령·출력·로그인 방식은 이 어댑터가 함께 소유한다.
function create({runtime,accounts,system,now,helpers}){
 const {root,agyCwd}=accounts;

 const {runTool}=runtime;
 const {AGY_LOG_LIMIT,AGY_AUTH,EMAIL,AGY_LOG,AGY_LOG_STALE,randomId,parseAgyUsage,agyNeedsLogin}=helpers;
function takeAgyAccount(file){
    let text='';
    try{if(fs.statSync(file).size<=AGY_LOG_LIMIT)text=fs.readFileSync(file,'utf8');}catch{}
    try{fs.unlinkSync(file);}catch{}
    const all=[...text.matchAll(AGY_AUTH)],value=all.length?all[all.length-1][1].replace(/[.,;:)\]}'"]+$/,''):'';
    return EMAIL.test(value)?value:null;
  }

function sweepAgyLogs(){
    try{for(const name of fs.readdirSync(root)){if(!AGY_LOG.test(name))continue;const file=path.join(root,name);try{if(Date.now()-fs.statSync(file).mtimeMs>AGY_LOG_STALE)fs.unlinkSync(file);}catch{}}}catch{}
  }

async function readGemini(){
    const cwd=agyCwd(),log=cwd?path.join(cwd,`agy-${randomId()}.log`):null,args=['-p','/usage','--output-format','json'];
    sweepAgyLogs();
    let r=await runTool(runtime.tools.gemini.path,log?[...args,'--log-file',log]:args,{timeout:45000,cwd});
    let email=log?takeAgyAccount(log):null;
    // `--log-file`을 모르는 옛 판이면 그 인자 없이 한 번 더 읽는다(계정 메일은 모른 채).
    if(log&&/log-file/i.test(r.err+'\n'+r.out)&&/unknown (flag|option|argument)|flag provided but not defined/i.test(r.err+'\n'+r.out)){r=await runTool(runtime.tools.gemini.path,args,{timeout:45000,cwd});email=null;}
    const usage=parseAgyUsage(r.out);
    if(!usage||!usage.weekly&&!usage.session){
      if(agyNeedsLogin(r.out+'\n'+r.err))return {state:'needs-login',email,message:'Gemini(Antigravity) 로그인이 필요해요. 다시 연결해 주세요.'};
      return {state:'error',email,message:r.code===-2?'Antigravity CLI가 제때 답하지 않았어요. 잠시 뒤 다시 확인해 주세요.':'Antigravity CLI의 사용량을 읽지 못했어요.'};
    }
    return {state:'ok',email,live:{readAt:now(),session:usage.session,weekly:usage.weekly,models:usage.models}};
  }
 return {read:readGemini,verify:async()=>{const g=await readGemini();return g.state==='ok'?{ok:true,email:g.email||null,plan:null}:{ok:false,state:g.state};}};
}
module.exports={spec,policy,create};
