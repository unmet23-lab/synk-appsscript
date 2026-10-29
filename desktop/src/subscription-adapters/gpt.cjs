'use strict';
const spec=Object.freeze({label:'GPT',kind:'weekly',bin:'codex',home:'CODEX_HOME',folders:true});
// API 크레딧(10-29): Pro 요금제의 API 조직 크레딧은 Codex가 알려 주지 않아 회원이 OpenAI 플랫폼 Credit grants를 보고 넣는다(Claude 줄과 같은 칸).
const policy=Object.freeze({installer:"irm https://chatgpt.com/codex/install.ps1 | iex",macInstaller:"curl -fsSL https://chatgpt.com/codex/install.sh | sh",reachable:"https://auth.openai.com/",login:{domains:["openai.com","chatgpt.com"],args:()=>['login']},editable:['apiCredit','apiCreditUntil']});
// 공급자 명령·출력·로그인 방식은 이 어댑터가 함께 소유한다.
function create({runtime,accounts,system,now,helpers}){
 const {homeEnv}=accounts;
 const {platform,env,spawn}=system;
 const {childEnv}=runtime;
 const {commandFor,READ_TIMEOUT,codexWindows,codexResets}=helpers;
function codexSession(folder,steps){
    // steps: [{method,params}] 순서대로 묻고 결과 배열을 돌려준다.
    return new Promise(resolve=>{
      const {command,argv,verbatim}=commandFor(runtime.tools.gpt.path,['app-server'],{platform,env});
      let child,buffer='',index=0,done=false;const results=[];
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);try{child?.kill();}catch{}resolve(value);};
      const timer=setTimeout(()=>finish({ok:false,code:'TIMEOUT',results}),READ_TIMEOUT);
      try{child=spawn(command,argv,{env:childEnv(homeEnv('gpt',folder)),shell:false,windowsHide:true,windowsVerbatimArguments:verbatim});}catch{finish({ok:false,code:'SPAWN',results});return;}
      const send=message=>{try{child.stdin.write(JSON.stringify(message)+'\n');}catch{}};
      child.on('error',()=>finish({ok:false,code:'SPAWN',results}));
      child.on('close',()=>finish({ok:false,code:'CLOSED',results}));
      child.stdout.on('data',data=>{
        buffer+=data;let cut;
        while((cut=buffer.indexOf('\n'))>=0){
          const line=buffer.slice(0,cut).trim();buffer=buffer.slice(cut+1);if(!line)continue;
          let message;try{message=JSON.parse(line);}catch{continue;}
          if(message.id===0){send({method:'initialized'});if(steps.length)send({id:1,method:steps[0].method,params:steps[0].params||{}});else finish({ok:true,results});}
          else if(typeof message.id==='number'&&message.id===index+1){
            results.push(message.error?{error:message.error}:message.result);index++;
            if(index<steps.length)send({id:index+1,method:steps[index].method,params:steps[index].params||{}});else finish({ok:true,results});
          }
        }
      });
      send({id:0,method:'initialize',params:{clientInfo:{name:'synk-platform',title:'SYNK AI 구독 계정판',version:'1.0.0'}}});
    });
  }

async function readCodex(row){
    const r=await codexSession(row.folder,[{method:'account/read',params:{}},{method:'account/rateLimits/read',params:{}}]);
    if(!r.ok&&!r.results.length)return {state:'error',message:r.code==='TIMEOUT'?'Codex가 제때 답하지 않았어요. 잠시 뒤 다시 확인해 주세요.':'Codex를 실행하지 못했어요. 설치 상태를 확인해 주세요.'};
    const account=r.results[0]?.account;
    if(!account)return {state:'needs-login',message:'Codex(ChatGPT) 로그인이 필요해요. 다시 연결해 주세요.'};
    const limits=r.results[1];
    if(!limits||limits.error)return {state:'error',email:account.email||null,plan:account.planType||null,message:'Codex 사용 한도를 읽지 못했어요.'};
    const snap=limits.rateLimits||Object.values(limits.rateLimitsByLimitId||{})[0]||{};
    const windows=codexWindows(snap,now());
    // 한도 창을 하나도 주지 않으면 숫자 없이 「정상」으로 세지 않는다(Claude·Gemini와 같게).
    if(!windows.session&&!windows.weekly)return {state:'error',email:account.email||null,plan:account.planType||null,message:'Codex가 사용 한도를 알려 주지 않았어요. ChatGPT 요금제 계정으로 로그인했는지 확인해 주세요.'};
    return {state:'ok',email:account.email||null,plan:snap.planType||account.planType||null,live:{readAt:now(),session:windows.session,weekly:windows.weekly,models:[],reached:snap.rateLimitReachedType||null,resets:codexResets(limits.rateLimitResetCredits,now())}};
  }
 return {read:readCodex,verify:async folder=>{const r=await codexSession(folder,[{method:'account/read',params:{}}]);const acc=r.results[0]?.account;return acc?{ok:true,email:acc.email||null,plan:acc.planType||null}:{ok:false};}};
}
module.exports={spec,policy,create};
