'use strict';
// AI 구독 계정판(회원 혜택). 회원 PC에 설치된 공식 프로그램의 출력만 읽는다.
// - Claude: Claude Code `claude -p /usage` · `claude auth status --json`
// - GPT: Codex app-server `account/read` · `account/rateLimits/read`
// - Higgsfield: `higgsfield account status --json` (계정마다 홈 폴더를 나눠 여러 계정)
// - Gemini: Antigravity CLI `agy -p /usage --output-format json`(모델 호출 없음, 토큰 0)
// - Typecast: 공식 API `GET /v1/users/me/subscription` — 회원이 넣은 API 키로만, 키는 이 PC에 암호화해 둔다
// 토큰·자격 파일은 열지 않는다. 실행 대상과 인자는 고정이며, 화면에서 받은 값은 검증한 이메일과
// 로그인 코드(표준입력)·회원이 붙여 넣은 API 키뿐이다. 기록은 이 PC의 앱 데이터 폴더에만 둔다.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn:nodeSpawn}=require('node:child_process');

const SERVICES=Object.freeze({
  claude:Object.freeze({label:'Claude',kind:'weekly',bin:'claude',home:'CLAUDE_CONFIG_DIR',folders:true}),
  gpt:Object.freeze({label:'GPT',kind:'weekly',bin:'codex',home:'CODEX_HOME',folders:true}),
  // Higgsfield CLI는 폴더를 고르는 설정이 없고 홈 폴더의 .config/higgsfield만 본다. 계정마다 홈을 그 계정 폴더로 바꾼다(10-17 실측).
  higgsfield:Object.freeze({label:'Higgsfield',kind:'credit',bin:'higgsfield',home:null,profileHome:true,folders:true}),
  // agy는 계정 폴더를 바꾸는 설정이 없어 PC당 한 계정이고, 로그인은 키 입력 화면이라 검은 창에서만 한다.
  gemini:Object.freeze({label:'Gemini',kind:'weekly',bin:'agy',home:null,folders:false,consoleLogin:true}),
  // 설치할 프로그램이 없다. 회원이 붙여 넣은 API 키로 공식 API만 부른다.
  typecast:Object.freeze({label:'Typecast',kind:'credit',bin:null,home:null,folders:true,apiKey:true}),
});
const TYPECAST_SUBSCRIPTION='https://api.typecast.ai/v1/users/me/subscription';
const API_KEY=/^[\x21-\x7e]{10,512}$/;
const KINDS=new Set(['weekly','credit','plan']);
const INSTALLERS=Object.freeze({
  claude:'irm https://claude.ai/install.ps1 | iex',
  gpt:'irm https://chatgpt.com/codex/install.ps1 | iex',
  higgsfield:'npm install -g @higgsfield/cli',
  gemini:'irm https://antigravity.google/cli/install.ps1 | iex',
});
const MAC_INSTALLERS=Object.freeze({
  claude:'curl -fsSL https://claude.ai/install.sh | bash',
  gpt:'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
  higgsfield:'curl -fsSL https://raw.githubusercontent.com/higgsfield-ai/cli/main/install.sh | sh',
  gemini:'curl -fsSL https://antigravity.google/cli/install.sh | bash',
});
const HELP_LINKS=Object.freeze({
  node:'https://nodejs.org/ko/download',
  'claude-plans':'https://claude.com/pricing',
  'chatgpt-plans':'https://chatgpt.com/pricing',
  'claude-install':'https://code.claude.com/docs/en/setup',
  'codex-install':'https://github.com/openai/codex#installing-and-running-codex-cli',
  'higgsfield-install':'https://github.com/higgsfield-ai/cli#install',
  'gemini-plans':'https://gemini.google/subscriptions/',
  'antigravity-install':'https://antigravity.google/docs/cli',
  'typecast-api':'https://studio.typecast.ai/developers/api',
});
const LOGIN_DOMAINS=['claude.com','claude.ai','anthropic.com','openai.com','chatgpt.com','higgsfield.ai'];
const FOLDER=/^(claude|gpt|higgsfield|typecast)-[a-z0-9]{8}$/;
const EMAIL=/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;
const MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
const LOGIN_TIMEOUT=10*60*1000,READ_TIMEOUT=60*1000,OUTPUT_LIMIT=512*1024;

const stripAnsi=text=>String(text||'').replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g,'').replace(/\u001b\][^\u0007]*\u0007/g,'');
const isoOrNull=value=>{if(value==null||value==='')return null;const t=typeof value==='number'?(value<1e12?value*1000:value):Date.parse(value);return Number.isFinite(t)?t:null;};
const clampNumber=(value,min,max)=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
const cleanText=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const randomId=()=>Array.from({length:8},()=>'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join('');

/* ---------- 공식 출력 해석 ---------- */
function parseResetText(text,now=new Date()){
  // "Oct 22, 10:59am (Asia/Seoul)" — Claude Code는 PC의 지역 시간대로 보여 준다.
  const m=/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(String(text||''));
  if(!m||!Object.hasOwn(MONTHS,m[1].toLowerCase()))return null;
  let hour=Number(m[3]);if(m[5]){hour%=12;if(m[5].toLowerCase()==='pm')hour+=12;}
  const date=new Date(now.getFullYear(),MONTHS[m[1].toLowerCase()],Number(m[2]),hour,Number(m[4]||0),0,0);
  if(date.getTime()<now.getTime()-2*864e5)date.setFullYear(date.getFullYear()+1);
  return date.getTime();
}
function parseClaudeUsage(output,now=new Date()){
  const lines=stripAnsi(output).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const result={session:null,weekly:null,models:[]};
  for(const line of lines){
    const m=/^Current (session|week)(?:\s*\(([^)]+)\))?\s*:\s*(\d+(?:\.\d+)?)\s*%\s*used(?:\s*[·•|-]\s*resets?\s+(.+))?$/i.exec(line);
    if(!m)continue;
    const window={usedPercent:Number(m[3]),resetsAt:parseResetText(m[4],now)};
    if(m[1].toLowerCase()==='session')result.session=window;
    else if(!m[2]||/all models/i.test(m[2]))result.weekly=window;
    else if(result.models.length<6)result.models.push({name:cleanText(m[2],40),...window});
  }
  return result;
}
function claudeNeedsLogin(text){return /not logged in|please run \/login|invalid api key|oauth token (has )?expired|authentication_error|please (log|sign) ?in/i.test(stripAnsi(text));}
function parseJson(text){try{return JSON.parse(stripAnsi(text).trim());}catch{const m=/\{[\s\S]*\}/.exec(stripAnsi(text));if(!m)return null;try{return JSON.parse(m[0]);}catch{return null;}}}
// 하나도 안 쓴 창은 아직 시작되지 않아 resetsAt이 읽을 때마다 「지금+기간」으로 밀린다. 그런 시각은 비운다(agy와 같음, 10-18 실측).
function codexWindows(snapshot,at=Date.now()){
  const windows=[snapshot?.primary,snapshot?.secondary].filter(Boolean);
  const weekly=windows.find(w=>Number(w.windowDurationMins)>=6*1440)||null;
  const session=windows.find(w=>w!==weekly)||null;
  const shape=w=>{
    if(!w)return null;
    const usedPercent=Number(w.usedPercent),windowMins=Number(w.windowDurationMins)||null;
    let resetsAt=isoOrNull(w.resetsAt);
    if(usedPercent===0&&resetsAt!==null&&windowMins&&Math.abs(resetsAt-(at+windowMins*60000))<15*60000)resetsAt=null;
    return {usedPercent,resetsAt,windowMins};
  };
  return {session:shape(session),weekly:shape(weekly)};
}
// agy /usage: 묶음(Gemini 모델, Claude·GPT 모델)마다 주간·5시간 버킷과 남은 비율을 준다.
// Gemini 묶음을 본 한도로 쓰고, 나머지 묶음은 모델별 주간 줄로 보여 준다. 남은 비율이 없으면 모름(null)으로 둔다.
// 하나도 안 쓴 버킷은 창이 아직 시작되지 않아 초기화 시각이 부를 때마다 「지금+기간」으로 밀리므로 시각을 비운다(10-17 실측).
function parseAgyUsage(text){
  const data=parseJson(text),groups=data?.command?.data?.groups;
  if(!data||data.status!=='SUCCESS'||!Array.isArray(groups)||!groups.length)return null;
  const bucket=(group,window)=>{
    const b=(Array.isArray(group?.buckets)?group.buckets:[]).find(x=>x&&x.window===window);
    const left=b?clampNumber(b.remaining_fraction,0,1):null;
    return left===null?null:{usedPercent:Math.round((1-left)*1000)/10,resetsAt:left===1?null:isoOrNull(b.reset_time)};
  };
  const name=group=>/claude/i.test(group?.name||'')&&/gpt/i.test(group?.name||'')?'Claude·GPT 모델':cleanText(group?.name,40)||'다른 모델';
  const main=groups.find(g=>/gemini/i.test(g?.name||''))||groups[0];
  const models=groups.filter(g=>g!==main).slice(0,4).map(g=>{const w=bucket(g,'weekly');return w?{name:name(g),...w}:null;}).filter(Boolean);
  return {session:bucket(main,'5h'),weekly:bucket(main,'weekly'),models};
}
const agyNeedsLogin=text=>/not signed in|sign in|log ?in|unauthenticated|auth(entication)? (required|failed)/i.test(stripAnsi(text));
function loginUrl(text){
  for(const m of stripAnsi(text).matchAll(/https:\/\/[^\s"'<>`]+/g)){
    try{const url=new URL(m[0]);if(url.protocol==='https:'&&LOGIN_DOMAINS.some(d=>url.hostname===d||url.hostname.endsWith('.'+d)))return url.toString();}catch{}
  }
  return null;
}

/* ---------- 프로그램 찾기·실행 ---------- */
function candidatePaths(bin,{platform,env,home}){
  const out=[];
  if(platform==='win32'){
    // agy 공식 설치 위치(%LOCALAPPDATA%\agy\bin)와 winget 링크 폴더도 본다.
    const local=env.LOCALAPPDATA||path.join(home,'AppData','Local');
    const dirs=[path.join(home,'.local','bin'),env.APPDATA&&path.join(env.APPDATA,'npm'),path.join(home,'bin'),...(bin==='agy'?[path.join(local,'agy','bin'),path.join(local,'Microsoft','WinGet','Links')]:[]),...String(env.PATH||env.Path||'').split(';')].filter(Boolean);
    for(const dir of dirs)for(const ext of ['.exe','.cmd'])out.push(path.join(dir,bin+ext));
  }else{
    const dirs=[path.join(home,'.local','bin'),'/opt/homebrew/bin','/usr/local/bin',path.join(home,'bin'),...String(env.PATH||'').split(':')].filter(Boolean);
    for(const dir of dirs)out.push(path.join(dir,bin));
  }
  return [...new Set(out)];
}
const quoteCmd=value=>/^[A-Za-z0-9_\-./:=@]+$/.test(value)?value:'"'+String(value).replace(/"/g,'""')+'"';
function commandFor(file,args,{platform,env}){
  if(platform==='win32'&&/\.(cmd|bat)$/i.test(file))return {command:env.ComSpec||'cmd.exe',argv:['/d','/s','/c','"'+[quoteCmd(file),...args.map(quoteCmd)].join(' ')+'"'],verbatim:true};
  return {command:file,argv:args,verbatim:false};
}

// secrets: {available(),encrypt(text)->Buffer,decrypt(Buffer)->text} — 데스크톱 본체가 safeStorage로 넘긴다. 없으면 키를 받지 않는다.
function createAiSubscriptions({root,platform=process.platform,env=process.env,home,spawn=nodeSpawn,fetch:fetchImpl=globalThis.fetch,secrets=null,openExternal=async()=>{},now=()=>Date.now(),onChange=()=>{}}){
  if(!root)throw new TypeError('root is required');
  const boardFile=path.join(root,'board.json'),accountsDir=path.join(root,'accounts');
  let board=null,tools=null,toolsAt=0,freshPath=null,login=null,checking=null,seq=0;
  home=home||env.USERPROFILE||env.HOME||'';

  /* 저장 */
  function emptyBoard(){return {version:1,rows:[],settings:{usdKrw:1400},check:null};}
  function load(){
    if(board)return board;
    try{const raw=JSON.parse(fs.readFileSync(boardFile,'utf8'));board={...emptyBoard(),...raw,rows:Array.isArray(raw.rows)?raw.rows.map(normalizeRow).filter(Boolean):[]};}
    catch{board=emptyBoard();}
    return board;
  }
  function persist(){
    fs.mkdirSync(root,{recursive:true});
    const tmp=boardFile+'.'+process.pid+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(board,null,1));fs.renameSync(tmp,boardFile);
  }
  function normalizeRow(row){
    if(!row||typeof row!=='object'||typeof row.id!=='string')return null;
    const service=cleanText(row.service,40).toLowerCase()||'custom',known=SERVICES[service];
    const source=row.source==='auto'&&known?'auto':'manual';
    return {
      id:cleanText(row.id,40),service,source,
      label:cleanText(row.label,40)||known?.label||service,
      kind:KINDS.has(row.kind)?row.kind:known?.kind||'plan',
      folder:source==='auto'&&FOLDER.test(row.folder||'')?row.folder:null,
      email:cleanText(row.email,254)||null,plan:cleanText(row.plan,40)||null,
      price:clampNumber(row.price,0,1e8),currency:row.currency==='USD'?'USD':'KRW',
      billDay:clampNumber(row.billDay,1,31),credits:clampNumber(row.credits,-1e9,1e12),creditsAt:clampNumber(row.creditsAt,0,9e15),lowAt:clampNumber(row.lowAt,-1e9,1e12),
      resetDay:clampNumber(row.resetDay,0,6),resetHour:clampNumber(row.resetHour,0,23),resetMinute:clampNumber(row.resetMinute,0,59),
      usedUpAt:clampNumber(row.usedUpAt,0,9e15),note:cleanText(row.note,120),
      // API 키로 연결한 줄: 같은 키를 두 번 넣었는지 가리는 지문(화면에는 안 보냄)과 끝 네 글자.
      keyId:source==='auto'&&known?.apiKey&&/^[0-9a-f]{16}$/.test(row.keyId||'')?row.keyId:null,
      keyHint:source==='auto'&&known?.apiKey?cleanText(row.keyHint,8)||null:null,
      live:row.live&&typeof row.live==='object'?row.live:null,
      state:['ok','needs-login','error','unknown'].includes(row.state)?row.state:'unknown',stateMessage:cleanText(row.stateMessage,200),stateAt:clampNumber(row.stateAt,0,9e15),
    };
  }
  // seq: 화면은 알림(send)과 응답(invoke)을 따로 받아 도착 순서가 바뀔 수 있다. 번호가 작은 옛 스냅숏은 버리게 한다.
  function publicSnapshot(){
    const b=load();
    return {ok:true,seq:++seq,platform,tools:tools?Object.fromEntries(Object.entries(tools).map(([k,v])=>[k,{installed:!!v.path||!!v.api,version:v.version||null,npm:k==='higgsfield'?!!v.npm:undefined,api:v.api?true:undefined}])):null,
      rows:b.rows.map(({keyId,...row})=>({...row,folder:row.folder?true:false})),settings:b.settings,check:b.check,
      login:login?{id:login.id,service:login.service,stage:login.stage,url:login.url,needsCode:login.needsCode,message:login.message,console:!!login.console}:null,
      checking:!!checking};
  }
  const emit=()=>{try{onChange(publicSnapshot());}catch{}};

  /* 실행 */
  async function refreshPath(){
    if(freshPath!==null||platform!=='win32')return freshPath||'';
    // 설치 직후 앱을 다시 켜지 않아도 새 PATH를 보도록 사용자·시스템 PATH를 다시 읽는다(고정 명령).
    const r=await rawRun('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')"],{env,timeout:15000});
    freshPath=r.code===0?r.out.trim():'';
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
      const timer=setTimeout(()=>{try{child.kill();}catch{}finish(-2);},timeout);
      child.stdout?.on('data',d=>{if(out.length<OUTPUT_LIMIT)out+=d;});
      child.stderr?.on('data',d=>{if(err.length<OUTPUT_LIMIT)err+=d;});
      child.on('error',error=>{err+=String(error?.message||error);finish(-1);});
      child.on('close',code=>finish(code));
      if(input!==null)child.stdin?.end(input);
    });
  }
  async function detectTools(force=false){
    if(tools&&!force&&now()-toolsAt<5*60*1000)return tools;
    await refreshPath();
    const searchEnv=childEnv();
    const next={};
    for(const [key,spec] of Object.entries(SERVICES)){
      if(!spec.bin){next[key]={path:null,version:null,api:true};continue;}
      const found=candidatePaths(spec.bin,{platform,env:searchEnv,home}).find(p=>{try{return fs.statSync(p).isFile();}catch{return false;}})||null;
      let version=null;
      if(found){const r=await runTool(found,['--version'],{timeout:20000});version=cleanText(stripAnsi(r.out||r.err).split(/\r?\n/)[0],60)||null;}
      next[key]={path:found,version};
    }
    next.higgsfield.npm=!!candidatePaths('npm',{platform,env:searchEnv,home}).find(p=>{try{return fs.statSync(p).isFile();}catch{return false;}});
    tools=next;toolsAt=now();
    return tools;
  }
  function runTool(file,args,{extraEnv={},input=null,timeout=READ_TIMEOUT,cwd}={}){
    const {command,argv,verbatim}=commandFor(file,args,{platform,env});
    return rawRun(command,argv,{env:childEnv(extraEnv),input,timeout,verbatim,cwd});
  }
  // agy는 실행 폴더를 작업 공간으로 본다. 회원 파일이 있는 곳이 아니라 이 혜택의 데이터 폴더에서 돌린다.
  const agyCwd=()=>{try{fs.mkdirSync(root,{recursive:true});return root;}catch{return undefined;}};
  const homeEnv=(service,folder)=>{
    const spec=SERVICES[service];if(!folder||!spec)return {};
    const dir=path.join(accountsDir,folder);
    if(spec.profileHome)return {USERPROFILE:dir,HOME:dir};
    return spec.home?{[spec.home]:dir}:{};
  };

  /* 읽기 */
  async function claudeAccount(folder){
    const r=await runTool(tools.claude.path,['auth','status','--json'],{extraEnv:homeEnv('claude',folder),timeout:30000});
    const data=parseJson(r.out);
    return data&&typeof data==='object'?{loggedIn:data.loggedIn===true,email:typeof data.email==='string'?data.email:null,plan:typeof data.subscriptionType==='string'?data.subscriptionType:null}:{loggedIn:false};
  }
  async function readClaude(row){
    const r=await runTool(tools.claude.path,['-p','/usage'],{extraEnv:homeEnv('claude',row.folder)});
    const text=r.out+'\n'+r.err;
    if(claudeNeedsLogin(text))return {state:'needs-login',message:'Claude 로그인이 풀렸어요. 다시 연결해 주세요.'};
    const usage=parseClaudeUsage(r.out,new Date(now()));
    if(!usage.session&&!usage.weekly){
      const first=stripAnsi(text).split(/\r?\n/).map(l=>l.trim()).find(Boolean)||'';
      return {state:'error',message:r.code===-2?'Claude Code가 제때 답하지 않았어요. 잠시 뒤 다시 확인해 주세요.':/subscription|plan/i.test(first)?'이 계정은 Claude Pro·Max 구독 한도가 없어요.':'Claude Code의 사용량 화면을 읽지 못했어요.',detail:cleanText(first,160)};
    }
    let account=null;if(!row.email||!row.plan)account=await claudeAccount(row.folder);
    return {state:'ok',email:account?.email,plan:account?.plan,live:{readAt:now(),session:usage.session,weekly:usage.weekly,models:usage.models}};
  }
  function codexSession(folder,steps){
    // steps: [{method,params}] 순서대로 묻고 결과 배열을 돌려준다.
    return new Promise(resolve=>{
      const {command,argv,verbatim}=commandFor(tools.gpt.path,['app-server'],{platform,env});
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
    return {state:'ok',email:account.email||null,plan:snap.planType||account.planType||null,live:{readAt:now(),session:windows.session,weekly:windows.weekly,models:[],reached:snap.rateLimitReachedType||null}};
  }
  // 새 홈 폴더로 막 로그인하면 작업공간이 비어 「No workspace selected」가 난다. 내가 주인인 첫 작업공간을 고른다.
  async function pickHiggsfieldWorkspace(extraEnv){
    const list=parseJson((await runTool(tools.higgsfield.path,['workspace','list','--json'],{extraEnv,timeout:30000})).out);
    if(!Array.isArray(list))return false;
    const pick=list.find(w=>w&&w.user_role==='owner')||list[0];
    const id=typeof pick?.id==='string'&&/^[0-9A-Za-z-]{8,64}$/.test(pick.id)?pick.id:null;
    if(!id)return false;
    return (await runTool(tools.higgsfield.path,['workspace','set',id],{extraEnv,timeout:30000})).code===0;
  }
  async function readHiggsfield(folder=null){
    const extraEnv=homeEnv('higgsfield',folder);
    let r=await runTool(tools.higgsfield.path,['account','status','--json'],{extraEnv,timeout:30000});
    if(/no workspace selected/i.test(r.out+'\n'+r.err)&&await pickHiggsfieldWorkspace(extraEnv))r=await runTool(tools.higgsfield.path,['account','status','--json'],{extraEnv,timeout:30000});
    const data=parseJson(r.out);
    if(!data||typeof data!=='object'||data.credits===undefined)return /auth|login|expired|token/i.test(r.out+r.err)?{state:'needs-login',message:'Higgsfield 로그인이 필요해요. 다시 연결해 주세요.'}:{state:'error',message:'Higgsfield 계정 상태를 읽지 못했어요.'};
    return {state:'ok',email:typeof data.email==='string'?data.email:null,plan:typeof data.subscription_plan_type==='string'?data.subscription_plan_type:null,live:{readAt:now(),credits:clampNumber(data.credits,-1e9,1e12)}};
  }
  async function readGemini(){
    const r=await runTool(tools.gemini.path,['-p','/usage','--output-format','json'],{timeout:45000,cwd:agyCwd()});
    const usage=parseAgyUsage(r.out);
    if(!usage||!usage.weekly&&!usage.session){
      if(agyNeedsLogin(r.out+'\n'+r.err))return {state:'needs-login',message:'Gemini(Antigravity) 로그인이 필요해요. 다시 연결해 주세요.'};
      return {state:'error',message:r.code===-2?'Antigravity CLI가 제때 답하지 않았어요. 잠시 뒤 다시 확인해 주세요.':'Antigravity CLI의 사용량을 읽지 못했어요.'};
    }
    return {state:'ok',live:{readAt:now(),session:usage.session,weekly:usage.weekly,models:usage.models}};
  }
  /* Typecast: 공식 API에 회원의 키로 이번 달 남은 크레딧을 묻는다 */
  const secretsReady=()=>{try{return !!secrets&&secrets.available()===true;}catch{return false;}};
  const keyFile=folder=>path.join(accountsDir,folder,'key.bin');
  function readKey(folder){try{return String(secrets.decrypt(fs.readFileSync(keyFile(folder))));}catch{return null;}}
  async function typecastSubscription(key){
    if(typeof fetchImpl!=='function')return {ok:false,code:'NETWORK'};
    let res,data;
    try{res=await fetchImpl(TYPECAST_SUBSCRIPTION,{headers:{'X-API-KEY':key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});}
    catch{return {ok:false,code:'NETWORK'};}
    if(res.status===401||res.status===403)return {ok:false,code:'INVALID_KEY'};
    if(!res.ok)return {ok:false,code:'KEY_CHECK_FAILED'};
    try{data=await res.json();}catch{return {ok:false,code:'KEY_CHECK_FAILED'};}
    const total=clampNumber(data?.credits?.plan_credits,0,1e12),used=clampNumber(data?.credits?.used_credits,0,1e12);
    if(total===null||used===null)return {ok:false,code:'KEY_CHECK_FAILED'};
    const plan=typeof data.plan==='string'?data.plan:typeof data.plan?.name==='string'?data.plan.name:null;
    return {ok:true,plan:plan?cleanText(plan,40):null,credits:total-used};
  }
  async function readTypecast(row){
    if(!secretsReady())return {state:'error',message:'이 PC에서 저장한 API 키를 열 수 없어요. 키를 다시 넣어 주세요.'};
    const key=row.folder?readKey(row.folder):null;
    if(!key)return {state:'needs-login',message:'저장한 Typecast API 키를 찾지 못했어요. 키를 다시 넣어 주세요.'};
    const sub=await typecastSubscription(key);
    if(sub.ok)return {state:'ok',plan:sub.plan,live:{readAt:now(),credits:sub.credits}};
    if(sub.code==='INVALID_KEY')return {state:'needs-login',message:'Typecast API 키가 더 이상 맞지 않아요. 새 키로 다시 연결해 주세요.'};
    return {state:'error',message:sub.code==='NETWORK'?'Typecast에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 확인해 주세요.':'Typecast 크레딧을 읽지 못했어요. 잠시 뒤 다시 확인해 주세요.'};
  }
  async function readRow(row){
    const spec=SERVICES[row.service];
    if(!spec||row.source!=='auto')return null;
    if(spec.apiKey){try{return await readTypecast(row);}catch{return {state:'error',message:'읽는 중 문제가 생겼어요. 잠시 뒤 다시 확인해 주세요.'};}}
    if(!tools[row.service]?.path)return {state:'error',message:`${spec.label}용 공식 프로그램이 이 PC에서 보이지 않아요. 가이드의 설치 단계를 확인해 주세요.`};
    try{return row.service==='claude'?await readClaude(row):row.service==='gpt'?await readCodex(row):row.service==='gemini'?await readGemini(row):await readHiggsfield(row.folder);}
    catch{return {state:'error',message:'읽는 중 문제가 생겼어요. 잠시 뒤 다시 확인해 주세요.'};}
  }
  function applyRead(row,result){
    if(!result)return;
    row.state=result.state;row.stateMessage=result.state==='ok'?'':cleanText(result.message,200);row.stateAt=now();
    if(result.email)row.email=cleanText(result.email,254);
    if(result.plan)row.plan=cleanText(result.plan,40);
    if(result.state!=='ok'||!result.live)return;
    row.live=result.live;
    const weekly=result.live.weekly;
    if(weekly?.resetsAt){const d=new Date(Math.round(weekly.resetsAt/60000)*60000);row.resetDay=d.getDay();row.resetHour=d.getHours();row.resetMinute=d.getMinutes();}
    else if(weekly&&weekly.usedPercent===0){row.resetDay=null;row.resetHour=null;row.resetMinute=null;}
    if(weekly&&Number.isFinite(weekly.usedPercent))row.usedUpAt=weekly.usedPercent>=100?now():null;
    if(result.live.credits!==undefined&&result.live.credits!==null){row.credits=result.live.credits;row.creditsAt=now();}
  }
  // 돌려주는 스냅숏은 `checking`을 비운 뒤에 만든다. 안에서 만들면 「확인 중」인 채로 마지막 알림보다 늦게 도착해 화면이 멈춘다.
  async function check({ids}={}){
    if(checking){await checking.catch(()=>{});return publicSnapshot();}
    checking=(async()=>{
      // `checking`에 담긴 뒤에 알려야 첫 알림부터 「확인 중」이다(먼저 알리면 잠깐 확인이 끝난 것처럼 보인다).
      await null;emit();
      await detectTools(true);
      const b=load(),targets=b.rows.filter(row=>row.source==='auto'&&(!Array.isArray(ids)||ids.includes(row.id)));
      const queue=[...targets],results=[];
      const worker=async()=>{for(let row=queue.shift();row;row=queue.shift()){const result=await readRow(row);applyRead(row,result);results.push({id:row.id,state:row.state});emit();}};
      await Promise.all([worker(),worker()]);
      b.check={at:now(),total:targets.length,ok:results.filter(r=>r.state==='ok').length};
      persist();
    })();
    try{await checking;}finally{checking=null;emit();}
    return publicSnapshot();
  }

  /* 연결 */
  async function verifyLogin(service,folder){
    if(service==='claude'){const a=await claudeAccount(folder);return a.loggedIn?{ok:true,email:a.email,plan:a.plan}:{ok:false};}
    if(service==='gpt'){const r=await codexSession(folder,[{method:'account/read',params:{}}]);const acc=r.results[0]?.account;return acc?{ok:true,email:acc.email||null,plan:acc.planType||null}:{ok:false};}
    // agy는 계정 이메일을 공식 출력으로 내주지 않는다. 사용량이 읽히면 연결된 것으로 본다.
    if(service==='gemini'){const g=await readGemini();return g.state==='ok'?{ok:true,email:null,plan:null}:{ok:false};}
    const h=await readHiggsfield(folder);return h.state==='ok'?{ok:true,email:h.email,plan:h.plan}:{ok:false};
  }
  function addRow(service,folder,info){
    const b=load(),spec=SERVICES[service];
    const same=b.rows.find(row=>row.source==='auto'&&row.service===service&&(info.email&&row.email===info.email||!info.email&&row.folder===folder));
    if(same){if(folder&&same.folder!==folder)removeFolder(same.folder);same.folder=folder;same.state='unknown';if(info.plan)same.plan=info.plan;persist();return same;}
    const row=normalizeRow({id:'r-'+randomId(),service,source:'auto',label:spec.label,kind:spec.kind,folder,email:info.email,plan:info.plan});
    b.rows.push(row);persist();return row;
  }
  // 계정 폴더를 지운다. Higgsfield는 홈을 이 폴더로 바꿔 브라우저를 열어 Windows가 INetCache(숨김·시스템, Content.IE5 junction)를 만든다.
  // 10-17 개발 창 실측: 로그인 실패 뒤 rmSync가 EPERM으로 멈춰 폴더가 남았다(그 순간 무언가 캐시 폴더를 잡고 있었다).
  // 그래서 한 번에 지우기 → 아래부터 하나씩(링크는 따라가지 않고 링크만) → 잠시 뒤 몇 번 더 순으로 지운다.
  function removeTree(dir){
    let entries;
    try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
    for(const entry of entries){
      const item=path.join(dir,entry.name);
      if(entry.isSymbolicLink()){try{fs.unlinkSync(item);}catch{fs.rmdirSync(item);}}
      else if(entry.isDirectory())removeTree(item);
      else{try{fs.unlinkSync(item);}catch(error){if(error.code!=='EPERM')throw error;fs.chmodSync(item,0o666);fs.unlinkSync(item);}}
    }
    fs.rmdirSync(dir);
  }
  function removeFolder(folder){
    if(!folder||!FOLDER.test(folder))return;
    const dir=path.join(accountsDir,folder);
    const attempt=()=>{try{fs.rmSync(dir,{recursive:true,force:true});}catch{}if(fs.existsSync(dir))try{removeTree(dir);}catch{}return !fs.existsSync(dir);};
    if(attempt())return;
    let tries=0;
    const again=()=>{if(attempt()||++tries>=10)return;setTimeout(again,1000).unref?.();};
    setTimeout(again,1000).unref?.();
  }
  async function useExisting(service){
    const spec=SERVICES[service];if(!spec||spec.apiKey)return {ok:false,code:'UNKNOWN_SERVICE'};
    await detectTools();if(!tools[service].path)return {ok:false,code:'TOOL_MISSING'};
    const v=await verifyLogin(service,null);
    if(!v.ok)return {ok:false,code:'NOT_LOGGED_IN'};
    const row=addRow(service,null,v);
    await check({ids:[row.id]});
    return {ok:true,id:row.id,snapshot:publicSnapshot()};
  }
  async function startLogin(service,{email,console:useConsole=false}={}){
    const spec=SERVICES[service];if(!spec||spec.apiKey)return {ok:false,code:'UNKNOWN_SERVICE'};
    if(spec.consoleLogin)useConsole=true;
    if(login&&!['done','error','cancelled'].includes(login.stage))return {ok:false,code:'LOGIN_BUSY'};
    await detectTools();if(!tools[service].path)return {ok:false,code:'TOOL_MISSING'};
    if(email!==undefined&&email!==null&&email!==''&&!(service==='claude'&&EMAIL.test(String(email))))return {ok:false,code:'INVALID_EMAIL'};
    const folder=spec.folders?service+'-'+randomId():null;
    if(folder)fs.mkdirSync(path.join(accountsDir,folder),{recursive:true});
    // agy는 로그인 명령이 따로 없고, 처음 켜면 로그인 화면이 나온다.
    const args=service==='claude'?['auth','login',...(email?['--email',String(email)]:[])]:service==='gpt'?['login']:service==='gemini'?[]:['auth','login'];
    const current={id:'l-'+randomId(),service,folder,email:email?String(email):null,stage:'starting',url:null,needsCode:false,message:'',console:useConsole,child:null,startedAt:now(),output:''};
    login=current;
    const cwd=service==='gemini'?agyCwd():undefined;
    try{
      if(useConsole&&platform==='darwin')current.child=spawnMacTerminal(tools[service].path,args,homeEnv(service,folder),cwd);
      else{
        const {command,argv,verbatim}=commandFor(tools[service].path,args,{platform,env});
        current.child=spawn(command,argv,useConsole
          ?{env:childEnv(homeEnv(service,folder)),shell:false,detached:true,stdio:'ignore',windowsHide:false,windowsVerbatimArguments:verbatim,...(cwd?{cwd}:{})}
          :{env:childEnv(homeEnv(service,folder)),shell:false,windowsHide:true,windowsVerbatimArguments:verbatim});
      }
    }catch{finishLogin(current,'error','로그인 프로그램을 열지 못했어요.');return {ok:false,code:'SPAWN_FAILED'};}
    current.child.on('error',()=>finishLogin(current,'error','로그인 프로그램을 열지 못했어요.'));
    if(useConsole){
      current.stage='console';
      current.message=service==='gemini'
        ?'검은 창이 열렸어요. Enter로 「Google OAuth」를 고르고, 브라우저에서 계정을 고른 뒤 「로그인」을 눌러 주세요. 브라우저에 나온 코드를 「클립보드에 복사」해 검은 창에 붙여 넣고 Enter를 누르면 돼요(검은 창에서는 오른쪽 클릭이 붙여넣기예요).'
        :'검은 창이 열렸어요. 브라우저에서 승인하고, 코드가 나오면 검은 창에 붙여 넣어 주세요.';
      current.child.unref?.();pollLogin(current);
    }
    else{
      const onData=data=>{
        current.output=(current.output+data).slice(-OUTPUT_LIMIT);
        const url=!current.url&&loginUrl(current.output);
        if(url){current.url=url;current.stage='browser';current.needsCode=service==='claude';current.message=service==='claude'?'브라우저에서 승인하면 대부분 바로 연결돼요. 브라우저에 긴 코드가 보일 때만 아래 칸에 붙여 넣어 주세요.':'브라우저에서 로그인을 마치면 자동으로 넘어가요.';emit();}
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
    current.timer=setTimeout(()=>{if(!['done','error','cancelled'].includes(current.stage)){try{current.child?.kill();}catch{}finishLogin(current,'error','10분 동안 로그인이 끝나지 않아 멈췄어요. 다시 시도해 주세요.');}},LOGIN_TIMEOUT);
    emit();
    return {ok:true,id:current.id};
  }
  function pollLogin(current){
    const tick=async()=>{
      if(login!==current||['done','error','cancelled'].includes(current.stage))return;
      const v=await verifyLogin(current.service,current.folder);
      if(v.ok){connected(current,v);return;}
      current.poll=setTimeout(tick,4000);
    };
    current.poll=setTimeout(tick,6000);
  }
  // 이메일을 미리 채워도 브라우저에 이미 로그인된 계정으로 승인될 수 있다. 다르면 알려 준다(연결된 계정은 그대로 둔다).
  function connected(current,v){
    // 새 폴더로 로그인했는데 이미 잘 읽히던 계정이 또 붙었다면, 브라우저에 남은 로그인으로 승인된 것이다. 겹쳐 넣지 않고 알린다.
    const signedIn=v.email?String(v.email).toLowerCase():null;
    const dup=signedIn&&current.folder&&load().rows.find(row=>row.source==='auto'&&row.service===current.service&&row.state==='ok'&&row.folder!==current.folder&&String(row.email||'').toLowerCase()===signedIn);
    if(dup){finishLogin(current,'error',`이미 연결된 ${v.email} 계정으로 다시 로그인됐어요. 다른 계정을 더하려면 「주소 복사」로 로그인 주소를 시크릿 창에 붙여 넣고 그 계정으로 로그인해 주세요.`);return;}
    const row=addRow(current.service,current.folder,v);
    const wanted=current.email?current.email.toLowerCase():null,got=v.email?String(v.email).toLowerCase():null;
    if(wanted&&got&&wanted!==got)finishLogin(current,'error',`${current.email} 대신 브라우저에 로그인돼 있던 ${v.email} 계정으로 연결됐어요. ${current.email}를 연결하려면 브라우저에서 그 계정으로 바꾼 뒤 다시 시도해 주세요.`);
    else finishLogin(current,'done',`${v.email||SERVICES[current.service].label} 계정을 연결했어요.`);
    void check({ids:[row.id]});
  }
  function finishLogin(current,stage,message){
    if(!current||['done','error','cancelled'].includes(current.stage))return;
    current.stage=stage;current.message=message;current.needsCode=false;
    clearTimeout(current.timer);clearTimeout(current.poll);
    if(stage!=='done'&&current.folder&&!load().rows.some(row=>row.folder===current.folder))removeFolder(current.folder);
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
    const current=login;try{current.child?.kill();}catch{}
    finishLogin(current,'cancelled','로그인을 취소했어요.');
    return {ok:true};
  }
  async function openLoginUrl(id){
    if(!login||login.id!==id||!login.url)return {ok:false,code:'NO_URL'};
    try{await openExternal(login.url);return {ok:true};}catch{return {ok:false,code:'OPEN_FAILED'};}
  }

  // macOS에는 따로 여는 검은 창이 없어 터미널 앱에 고정 명령을 넘긴다. 값은 셸 작은따옴표로 감싼다.
  const shQuote=value=>"'"+String(value).replace(/'/g,"'\\''")+"'";
  const asString=value=>'"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
  function spawnMacTerminal(file,args,extraEnv,cwd){
    const line=[cwd?`cd ${shQuote(cwd)} &&`:'',...Object.entries(extraEnv).map(([key,value])=>`${key}=${shQuote(value)}`),shQuote(file),...args.map(shQuote)].filter(Boolean).join(' ');
    return spawn('osascript',['-e',`tell application "Terminal" to do script ${asString(line)}`,'-e','tell application "Terminal" to activate'],{env:childEnv(),shell:false,detached:true,stdio:'ignore'});
  }

  /* API 키 연결 — 키는 확인한 뒤에만 이 PC에 암호화해 두고, 화면·기록·로그에는 끝 네 글자만 남긴다 */
  async function connectKey(service,key){
    const spec=SERVICES[service];if(!spec?.apiKey)return {ok:false,code:'UNKNOWN_SERVICE'};
    const value=String(key??'').trim();
    if(!API_KEY.test(value))return {ok:false,code:'INVALID_KEY_FORMAT'};
    if(!secretsReady())return {ok:false,code:'SECURE_STORAGE_UNAVAILABLE'};
    const sub=await typecastSubscription(value);
    if(!sub.ok)return sub;
    const b=load(),keyId=crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
    let row=b.rows.find(r=>r.source==='auto'&&r.service===service&&r.keyId===keyId);
    const folder=row?.folder||service+'-'+randomId(),fresh=!row;
    try{fs.mkdirSync(path.join(accountsDir,folder),{recursive:true});fs.writeFileSync(keyFile(folder),secrets.encrypt(value));}
    catch{if(fresh)removeFolder(folder);return {ok:false,code:'SECURE_STORAGE_UNAVAILABLE'};}
    if(fresh){row=normalizeRow({id:'r-'+randomId(),service,source:'auto',label:spec.label,kind:spec.kind,folder,keyId,keyHint:'…'+value.slice(-4)});b.rows.push(row);}
    applyRead(row,{state:'ok',plan:sub.plan,live:{readAt:now(),credits:sub.credits}});
    persist();emit();
    return {ok:true,id:row.id,snapshot:publicSnapshot()};
  }

  /* 설치 도움 */
  async function openInstaller(service){
    if(!SERVICES[service]||!INSTALLERS[service])return {ok:false,code:'UNKNOWN_SERVICE'};
    await refreshPath();
    if(service==='higgsfield'){await detectTools(true);if(platform==='win32'&&!tools.higgsfield.npm)return {ok:false,code:'NODE_REQUIRED'};}
    try{
      if(platform==='win32'){
        const script=INSTALLERS[service]+"; Write-Host ''; Write-Host '설치가 끝나면 이 창을 닫고 SYNK로 돌아가 「다시 확인」을 눌러 주세요.'";
        const child=spawn('powershell.exe',['-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-Command',script],{env:childEnv(),shell:false,detached:true,stdio:'ignore',windowsHide:false});
        child.unref?.();
      }else if(platform==='darwin'){
        const child=spawn('osascript',['-e',`tell application "Terminal" to do script "${MAC_INSTALLERS[service]}"`,'-e','tell application "Terminal" to activate'],{env:childEnv(),shell:false,detached:true,stdio:'ignore'});
        child.unref?.();
      }else return {ok:false,code:'UNSUPPORTED_PLATFORM'};
      tools=null;
      return {ok:true};
    }catch{return {ok:false,code:'INSTALLER_FAILED'};}
  }
  async function openHelp(key){if(!Object.hasOwn(HELP_LINKS,key))return {ok:false,code:'UNKNOWN_LINK'};try{await openExternal(HELP_LINKS[key]);return {ok:true};}catch{return {ok:false,code:'OPEN_FAILED'};}}

  /* 직접 넣는 값 */
  function save(patch){
    const b=load();
    if(!patch||typeof patch!=='object')return {ok:false,code:'INVALID_REQUEST'};
    if(patch.settings&&typeof patch.settings==='object'){const rate=clampNumber(patch.settings.usdKrw,1,100000);if(rate)b.settings.usdKrw=Math.round(rate);}
    if(patch.add&&typeof patch.add==='object'){
      if(b.rows.length>=200)return {ok:false,code:'TOO_MANY_ROWS'};
      const label=cleanText(patch.add.label,40);if(!label)return {ok:false,code:'LABEL_REQUIRED'};
      const service=label.toLowerCase().replace(/\s+/g,'').slice(0,40)||'custom';
      const row=normalizeRow({...patch.add,id:'m-'+randomId(),service:SERVICES[service]?service+'-manual':service,source:'manual',label});
      b.rows.push(row);
    }
    if(patch.row&&typeof patch.row==='object'){
      const row=b.rows.find(r=>r.id===patch.row.id);if(!row)return {ok:false,code:'UNKNOWN_ROW'};
      const editable=['price','currency','billDay','credits','lowAt','note','resetDay','resetHour','resetMinute','usedUpAt',...(row.source==='manual'?['label','kind']:[])];
      const next={...row};for(const key of editable)if(Object.hasOwn(patch.row,key))next[key]=patch.row[key];
      if(Object.hasOwn(patch.row,'credits'))next.creditsAt=now();
      Object.assign(row,normalizeRow({...next,id:row.id,service:row.service,source:row.source,folder:row.folder,live:row.live,email:row.email}));
    }
    if(typeof patch.remove==='string'){
      const index=b.rows.findIndex(r=>r.id===patch.remove);if(index<0)return {ok:false,code:'UNKNOWN_ROW'};
      const [row]=b.rows.splice(index,1);if(row.folder&&!b.rows.some(r=>r.folder===row.folder))removeFolder(row.folder);
    }
    persist();emit();
    return publicSnapshot();
  }

  return {
    async snapshot({refreshTools=false}={}){await detectTools(refreshTools);return publicSnapshot();},
    check,useExisting,startLogin,submitCode,cancelLogin,openLoginUrl,openInstaller,openHelp,save,connectKey,
    dispose(){if(login){try{login.child?.kill();}catch{}clearTimeout(login.timer);clearTimeout(login.poll);}},
  };
}

module.exports={createAiSubscriptions,parseClaudeUsage,parseResetText,codexWindows,parseAgyUsage,loginUrl,claudeNeedsLogin,candidatePaths,commandFor,SERVICES,INSTALLERS,HELP_LINKS};
