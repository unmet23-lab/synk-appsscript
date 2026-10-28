'use strict';
const fs=require('node:fs'),path=require('node:path');
const spec=Object.freeze({label:'Claude',kind:'weekly',bin:'claude',home:'CLAUDE_CONFIG_DIR',folders:true});
const policy=Object.freeze({installer:"irm https://claude.ai/install.ps1 | iex",macInstaller:"curl -fsSL https://claude.ai/install.sh | bash",reachable:"https://api.anthropic.com/",login:{domains:["claude.com","claude.ai","anthropic.com"],args:email=>['auth','login',...(email?['--email',String(email)]:[])],acceptsEmail:true,needsCode:true,browserMessage:'브라우저에서 승인하면 대부분 바로 연결돼요. 브라우저에 긴 코드가 보일 때만 아래 칸에 붙여 넣어 주세요.'},editable:['passCount','passUntil','apiCredit','apiCreditUntil'],preservePlan:(old,next)=>/^max$/i.test(next)&&/^max_\d{1,2}x$/i.test(String(old||''))});
// 공급자 명령·출력·로그인 방식은 이 어댑터가 함께 소유한다.
function create({runtime,accounts,system,now,helpers}){
 const {accountsDir,home,homeEnv,rows}=accounts;

 const {runTool}=runtime;
 const {parseJson,claudeNeedsLogin,parseClaudeUsage,stripAnsi,cleanText}=helpers;
function claudeTier(folder){
    try{
      const account=JSON.parse(fs.readFileSync(folder?path.join(accountsDir,folder,'.claude.json'):path.join(home,'.claude.json'),'utf8'))?.oauthAccount||{};
      const match=/max_(\d{1,2})x\b/i.exec(String(account.userRateLimitTier||account.organizationRateLimitTier||''));
      return match?`${match[1]}x`:null;
    }catch{return null;}
  }

async function claudeAccount(folder){
    const r=await runTool(runtime.tools.claude.path,['auth','status','--json'],{extraEnv:homeEnv('claude',folder),timeout:30000});
    const data=parseJson(r.out);
    const plan=typeof data?.subscriptionType==='string'?data.subscriptionType:null,tier=plan&&/^max$/i.test(plan)?claudeTier(folder):null;
    // known: 공식 출력이 로그인 여부를 분명히 알려 줬는지. 못 읽었을 때를 「로그인 풀림」으로 착각하지 않게 나눈다.
    return data&&typeof data==='object'&&typeof data.loggedIn==='boolean'?{known:true,loggedIn:data.loggedIn,email:typeof data.email==='string'?data.email:null,plan:tier?`${plan}_${tier}`:plan}:{known:false,loggedIn:false};
  }

async function readClaude(row){
    const r=await runTool(runtime.tools.claude.path,['-p','/usage'],{extraEnv:homeEnv('claude',row.folder)});
    const text=r.out+'\n'+r.err;
    if(claudeNeedsLogin(text))return {state:'needs-login',message:'Claude 로그인이 풀렸어요. 다시 연결해 주세요.'};
    const usage=parseClaudeUsage(r.out,new Date(now()));
    if(!usage.session&&!usage.weekly){
      // 파이프로 부르면 로그인이 없어도 「Not logged in」 대신 비용 요약(Total cost …)이 나온다(10-18 실측, Claude Code 2.1.302).
      // 그래서 로그인 여부는 auth status로 본다. 로그인돼 있는데 숫자가 없으면 구독 한도가 없는 로그인(API 키 등)이다.
      const account=r.code===-2?{known:false}:await claudeAccount(row.folder);
      if(account.known&&!account.loggedIn)return {state:'needs-login',message:'Claude 로그인이 풀렸어요. 다시 연결해 주세요.'};
      const first=stripAnsi(text).split(/\r?\n/).map(l=>l.trim()).find(Boolean)||'';
      return {state:'error',message:r.code===-2?'Claude Code가 제때 답하지 않았어요. 잠시 뒤 다시 확인해 주세요.':account.known&&!account.plan||/subscription|plan/i.test(first)?'이 계정은 Claude Pro·Max 구독 한도가 없어요.':'Claude Code의 사용량 화면을 읽지 못했어요.',detail:cleanText(first,160)};
    }
    const account=await claudeAccount(row.folder);
    const email=account.loggedIn?account.email:null,lower=email?email.toLowerCase():null;
    // 바뀐 계정이 이미 다른 줄로 연결돼 있으면 같은 숫자를 두 줄에 세지 않고 알린다.
    if(lower&&String(row.email||'').toLowerCase()!==lower&&rows().some(other=>other!==row&&other.source==='auto'&&other.service==='claude'&&String(other.email||'').toLowerCase()===lower))
      return {state:'error',message:`이 줄의 로그인이 ${email} 계정으로 바뀌었는데, 그 계정은 이미 다른 줄에 있어요. 이 줄을 지우거나 원래 계정으로 다시 연결해 주세요.`};
    return {state:'ok',email,plan:account.loggedIn?account.plan:null,live:{readAt:now(),session:usage.session,weekly:usage.weekly,models:usage.models}};
  }
 return {read:readClaude,verify:async folder=>{const a=await claudeAccount(folder);return a.loggedIn?{ok:true,email:a.email,plan:a.plan}:{ok:false};}};
}
module.exports={spec,policy,create};
