'use strict';
const {createSubscriptionStore}=require('./subscription-store.cjs');
const {createSubscriptionRuntime}=require('./subscription-runtime.cjs');
const {createSubscriptionProviders}=require('./subscription-providers.cjs');
const {createSubscriptionLogin}=require('./subscription-login.cjs');
const {providerPolicy}=require('./subscription-catalog.cjs');
const {createSharedAccounts,groupSubscriptionReads}=require('./subscription-shared-accounts.cjs');
// AI 구독 계정판(회원 혜택). 회원 PC에 설치된 공식 프로그램의 출력만 읽는다.
// - Claude: Claude Code `claude -p /usage` · `claude auth status --json`
// - GPT: Codex app-server `account/read` · `account/rateLimits/read`(한도와 초기화권 개수·만료일. 초기화권을 쓰는 요청은 보내지 않는다)
// - Higgsfield: `higgsfield account status --json` (계정마다 홈 폴더를 나눠 여러 계정)
// - Gemini: Antigravity CLI `agy -p /usage --output-format json --log-file <임시>`(모델 호출 없음, 토큰 0). 지금 로그인된 계정 메일은
//   그 실행이 남긴 CLI 기록의 `OAuth: authenticated successfully as <메일>` 줄에서 읽고 기록은 바로 지운다
// - Typecast: 공식 API `GET /v1/users/me/subscription` — 회원이 넣은 API 키로만, 키는 이 PC에 암호화해 둔다
// 토큰·자격 파일은 열지 않는다. 실행 대상과 인자는 고정이며, 화면에서 받은 값은 검증한 이메일과
// 로그인 코드(표준입력)·회원이 붙여 넣은 API 키뿐이다. 기록은 이 PC의 앱 데이터 폴더에만 둔다.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn:nodeSpawn}=require('node:child_process');
const {usageSummary}=require('./ai-usage.cjs');
const {PRICES_URL,DEFAULT_PRICES,validatePrices,mergePrices,readCapped}=require('./ai-prices.cjs');

const {
  SERVICES, serviceSpec, API_KEY, KINDS, INSTALLERS, MAC_INSTALLERS, HELP_LINKS, AUTO_EVERY, PRE_RESET, BILL_HOUR, DAY_MS, TIP_KEY, PRICE_EVERY, PRICE_TIMEOUT, GOALS, FOLDER, clampNumber, cleanText, randomId, parseResetText, parseClaudeUsage, claudeNeedsLogin, codexWindows, codexResets, parseAgyUsage, loginUrl, candidatePaths, commandFor,
}=require('./subscription-common.cjs');

// secrets: {available(),encrypt(text)->Buffer,decrypt(Buffer)->text} — 데스크톱 본체가 safeStorage로 넘긴다. 없으면 키를 받지 않는다.
// retryDelay: 「로그인 필요」로 읽힌 줄을 다시 읽기 전에 기다리는 시간(ms).
// priceFetch: 요금표 갱신본을 받는 fetch(3차). 데스크톱 본체만 넘긴다 — 없으면 앱 기본 사본만 쓰고 밖으로 아무것도 묻지 않는다(시험이 인터넷에 닿지 않게).
function createAiSubscriptions({root,platform=process.platform,env=process.env,home,spawn=nodeSpawn,fetch:fetchImpl=globalThis.fetch,priceFetch=null,secrets=null,openExternal=async()=>{},now=()=>Date.now(),onChange=()=>{},retryDelay=3000}){
  if(!root)throw new TypeError('root is required');
  const accountsDir=path.join(root,'accounts'),pricesFile=path.join(root,'prices.json');
  // checkQuiet: 자동 읽기처럼 회원이 누르지 않은 확인. 화면에는 「확인 중」·진행 수를 보이지 않고, 알림에 quiet를 달아 숫자를 굴리지 않게 한다.
  // prices: 지금 쓰는 요금표(앱 기본 사본 + 지난 갱신본), pricesTried: 마지막으로 갱신본을 물은 때(이 실행 안에서만), pricesBusy: 받는 중인 약속.
  let checking=null,checkingIds=null,checkProgress=null,seq=0,checkQuiet=false,prices=null,pricesTried=-Infinity,pricesBusy=null;
  home=home||env.USERPROFILE||env.HOME||'';

  /* 요금표(3차) — 앱 기본 사본과 이 PC에 받아 둔 갱신본(prices.json) 가운데 서비스마다 더 최근에 확인한 쪽 */
  function loadPrices(){
    if(prices)return prices;
    let stored=null;
    try{stored=validatePrices(JSON.parse(fs.readFileSync(pricesFile,'utf8')),now());}catch{}
    prices=mergePrices(validatePrices(DEFAULT_PRICES,now(),{trusted:true}),stored);
    return prices;
  }
  // 고정 주소에서 요금표 갱신본을 받는다(하루 한 번까지, 로그인 정보·기록은 보내지 않는다). 받은 것은 검사한 뒤에만 이 PC에 두고, 바뀌었을 때만 화면에 알린다.
  function refreshPrices({force=false}={}){
    if(typeof priceFetch!=='function')return Promise.resolve(false);
    if(pricesBusy)return pricesBusy;
    if(!force&&now()-pricesTried<PRICE_EVERY)return Promise.resolve(false);
    pricesTried=now();
    pricesBusy=(async()=>{
      try{
        const res=await priceFetch(PRICES_URL,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(PRICE_TIMEOUT)});
        if(!res||res.status!==200)return false;
        const text=await readCapped(res);if(text===null)return false;
        const fresh=validatePrices(JSON.parse(text),now());if(!fresh)return false;
        try{fs.mkdirSync(root,{recursive:true});const tmp=pricesFile+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify({schemaVersion:1,kind:'synk-ai-prices',...fresh,fetchedAt:now()}));fs.renameSync(tmp,pricesFile);}catch{}
        const before=JSON.stringify(loadPrices());
        prices=mergePrices(validatePrices(DEFAULT_PRICES,now(),{trusted:true}),fresh);
        const changed=JSON.stringify(prices)!==before;
        if(changed)emit();
        return changed;
      }catch{return false;}
      finally{pricesBusy=null;}
    })();
    return pricesBusy;
  }
  function normalizeRow(row){
    if(!row||typeof row!=='object'||typeof row.id!=='string')return null;
    const service=cleanText(row.service,40).toLowerCase()||'custom',known=SERVICES[service];
    const source=row.source==='auto'&&known?'auto':'manual';
    // elsewhere: 지금 PC의 agy에 다른 계정이 로그인돼 있거나(awayReason 없음) 아무도 로그인돼 있지 않아(awayReason 'none') 마지막으로 읽은 값만 있는 Gemini 줄.
    const state=['ok','needs-login','error','unknown'].includes(row.state)||row.state==='elsewhere'&&source==='auto'&&providerPolicy(service)?.sharedAccount?row.state:'unknown';
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
      // Claude 주간 초기화권(회원이 넣음): Claude Code가 알려 주지 않아 claude.ai 설정 › 사용량을 보고 개수·만료 때를 넣는다.
      passCount:(n=>n===null?null:Math.round(n))(clampNumber(row.passCount,0,20)),passUntil:clampNumber(row.passUntil,0,9e15),
      // 결제 주기(3차): 회원이 「이미 연간이에요」로 연간 결제라고 알려 준 줄만 'annual'. 모르면 비운다(월 결제로 단정하지 않는다).
      cycle:row.cycle==='annual'?'annual':null,
      // API 키로 연결한 줄: 같은 키를 두 번 넣었는지 가리는 지문(화면에는 안 보냄)과 끝 네 글자.
      keyId:source==='auto'&&known?.apiKey&&/^[0-9a-f]{16}$/.test(row.keyId||'')?row.keyId:null,
      keyHint:source==='auto'&&known?.apiKey?cleanText(row.keyHint,8)||null:null,
      live:row.live&&typeof row.live==='object'?row.live:null,
      state,awayReason:state==='elsewhere'&&row.awayReason==='none'?'none':null,stateMessage:cleanText(row.stateMessage,200),stateAt:clampNumber(row.stateAt,0,9e15),
    };
  }
  // seq: 화면은 알림(send)과 응답(invoke)을 따로 받아 도착 순서가 바뀔 수 있다. 번호가 작은 옛 스냅숏은 버리게 한다.
  function publicSnapshot(){
    const b=load();
    return {ok:true,seq:++seq,platform,tools:runtime.tools?Object.fromEntries(Object.entries(runtime.tools).map(([k,v])=>[k,{installed:!!v.path||!!v.api,version:v.version||null,npm:providerPolicy(k)?.requiresNpm?!!v.npm:undefined,api:v.api?true:undefined}])):null,
      rows:b.rows.map(({keyId,...row})=>({...row,folder:row.folder?true:false})),settings:b.settings,check:b.check,
      usage:usageSummary({rows:b.rows,history:loadHistory(),now:now()}),prices:loadPrices(),
      login:loginCoordinator.state?{id:loginCoordinator.state.id,service:loginCoordinator.state.service,stage:loginCoordinator.state.stage,url:loginCoordinator.state.url,needsCode:loginCoordinator.state.needsCode,message:loginCoordinator.state.message,console:!!loginCoordinator.state.console}:null,
      checking:!!checking&&!checkQuiet,progress:checking&&!checkQuiet&&checkProgress?{...checkProgress}:null,quiet:checkQuiet};
  }
  const emit=()=>{try{onChange(publicSnapshot());}catch{}};

  // agy는 실행 폴더를 작업 공간으로 본다. 회원 파일이 있는 곳이 아니라 이 혜택의 데이터 폴더에서 돌린다.
  const agyCwd=()=>{try{fs.mkdirSync(root,{recursive:true});return root;}catch{return undefined;}};
  const homeEnv=(service,folder)=>{
    const spec=SERVICES[service];if(!folder||!spec)return {};
    const dir=path.join(accountsDir,folder);
    if(spec.profileHome)return {USERPROFILE:dir,HOME:dir};
    return spec.home?{[spec.home]:dir}:{};
  };


  const {load,persist,loadHistory,compactHistory,remember}=createSubscriptionStore({root,now,normalizeRow});
  const runtime=createSubscriptionRuntime({platform,env,spawn,now,home});
  const {refreshPath,detectTools,childEnv,openWindowsConsole,psEncoded}=runtime;
  const rows=()=>load().rows;
  const system={platform,env,spawn,fetch:fetchImpl};
  const accounts={accountsDir,home,homeEnv,rows,root,agyCwd,secrets};
  const providers=createSubscriptionProviders({runtime,accounts,system,now,retryDelay});
  const {readConfirmed,verifyLogin}=providers;
  const sharedAccounts=Object.assign(Object.create(null),Object.fromEntries(Object.keys(SERVICES).filter(service=>providerPolicy(service)?.sharedAccount).map(service=>[service,createSharedAccounts({service,policy:providerPolicy(service).sharedAccount,load,now,applyRead,addRow})])));
  const loginCoordinator=createSubscriptionLogin({runtime,providers,accounts:{...accounts,add:addRow,refresh:check,removeFolder},system,now,onChange:emit,openExternal});
  const {startLogin,submitCode,cancelLogin,openLoginUrl}=loginCoordinator;
  function applyRead(row,result){
    if(!result)return;
    // 읽은 결과가 들어오면 그 줄은 더는 「지금 로그인 안 됨」이 아니다(awayReason은 elsewhere 줄에만 둔다).
    row.state=result.state;row.awayReason=null;row.stateMessage=result.state==='ok'?'':cleanText(result.message,200);row.stateAt=now();
    if(result.email)row.email=cleanText(result.email,254);
    // Claude Max 등급(max_5x·max_20x)을 알던 줄에 이번 읽기만 등급 없이 「max」가 오면(설정 파일을 그 순간 못 읽음) 알던 등급을 지킨다.
    // 덮으면 기록에 무게가 다른 읽기가 섞여 사용량 막대가 부푼다(Fable 2차 검수 P1-4). 다른 요금제로 바뀐 것은 그대로 따른다.
    if(result.plan){const plan=cleanText(result.plan,40);if(!(providerPolicy(row.service)?.preservePlan?.(row.plan,plan)))row.plan=plan;}
    if(result.state!=='ok'||!result.live)return;
    row.live=result.live;
    const weekly=result.live.weekly;
    if(weekly?.resetsAt){const d=new Date(Math.round(weekly.resetsAt/60000)*60000);row.resetDay=d.getDay();row.resetHour=d.getHours();row.resetMinute=d.getMinutes();}
    else if(weekly&&weekly.usedPercent===0){row.resetDay=null;row.resetHour=null;row.resetMinute=null;}
    if(weekly&&Number.isFinite(weekly.usedPercent))row.usedUpAt=weekly.usedPercent>=100?now():null;
    if(result.live.credits!==undefined&&result.live.credits!==null){row.credits=result.live.credits;row.creditsAt=now();}
    remember(row);
  }
  // 돌려주는 스냅숏은 `checking`을 비운 뒤에 만든다. 안에서 만들면 「확인 중」인 채로 마지막 알림보다 늦게 도착해 화면이 멈춘다.
  // 확인 중에 들어온 확인은 끝나기를 기다린 뒤, 그 확인이 읽지 않은 줄(도는 사이 새로 연결한 계정 등)만 이어서 읽는다.
  async function check({ids,quiet=false}={}){
    const wanted=()=>load().rows.filter(row=>row.source==='auto'&&(!Array.isArray(ids)||ids.includes(row.id))).map(row=>row.id);
    if(checking){
      // 자동 읽기 중에 회원이 「지금 확인」을 누르면 그때부터 진행이 보이게 한다.
      if(!quiet&&checkQuiet){checkQuiet=false;emit();}
      const covered=checkingIds;await checking.catch(()=>{});
      const missing=wanted().filter(id=>!covered.has(id));
      return missing.length?check({ids:missing,quiet}):publicSnapshot();
    }
    checkQuiet=!!quiet;
    const full=!Array.isArray(ids),b=load(),targets=b.rows.filter(row=>row.source==='auto'&&(full||ids.includes(row.id)));
    const {groups,covered}=groupSubscriptionReads(targets,b.rows,sharedAccounts);
    checkingIds=covered;checkProgress={done:0,total:targets.length};
    checking=(async()=>{
      // checking을 배정한 뒤 첫 알림을 보낸다.
      await null;emit();
      await detectTools(true);
      const worker=async()=>{for(let group=groups.shift();group;group=groups.shift()){
        if(group.owner){
          const live=b.rows.find(row=>row.source==='auto'&&row.service===group.service);
          if(live)group.owner.apply(await readConfirmed(live));
        }else{
          if(!b.rows.includes(group.row))continue;
          applyRead(group.row,await readConfirmed(group.row));
        }
        checkProgress.done+=group.count;emit();
      }};
      await Promise.all([worker(),worker()]);
      // 요약은 지금 판 전체로 센다. 한 줄만 다시 읽었을 때는 「마지막 확인」 시각을 전체 확인 때 것으로 둔다.
      // 지금 로그인되지 않은 Gemini 계정(elsewhere)은 읽을 수 없는 게 맞아 「못 읽음」으로 세지 않는다.
      const autos=b.rows.filter(row=>row.source==='auto'&&row.state!=='elsewhere');
      b.check={at:full||!b.check?.at?now():b.check.at,total:autos.length,ok:autos.filter(row=>row.state==='ok').length};
      persist();
    })();
    // 마지막 알림까지 quiet를 단 뒤에 푼다(그래야 화면이 새 값을 굴리지 않고 그린다).
    try{await checking;}finally{checking=null;checkingIds=null;checkProgress=null;emit();checkQuiet=false;}
    return publicSnapshot();
  }

  /* 연결 */
  // 같은 계정(이메일은 대소문자 무시)이면 줄을 새로 만들지 않는다. 새 계정 폴더로 다시 로그인했으면 그 폴더로 옮기고 옛 폴더를 지운다.
  // 「기존 로그인 가져오기」(folder 없음)는 이미 자기 폴더로 읽던 줄을 기본 로그인으로 옮기지 않는다(옮기면 로그인 파일이 든 폴더가 주인 없이 남는다).
  // 계정 폴더가 없는 Gemini(agy는 한 번에 한 계정)는 메일이 빈 옛 줄이 처음 읽힌 계정의 메일을 받고, 처음 보는 메일이면 줄을 새로 만든다.
  // 메일을 못 읽었을 때는 메일 없는 줄(없으면 첫 Gemini 줄)을 그대로 쓴다.
  function addRow(service,folder,info){
    const b=load(),spec=SERVICES[service],email=info.email?String(info.email).toLowerCase():null;
    // 지운 뒤 다시 연결한 Gemini 계정은 「지운 계정」 목록에서 뺀다(그다음부터는 자동 확인이 그 줄에 넣는다).
    sharedAccounts[service]?.reconnect(email);
    const mine=row=>row.source==='auto'&&row.service===service;
    const same=b.rows.find(row=>mine(row)&&(email&&String(row.email||'').toLowerCase()===email||!email&&row.folder===folder&&(spec.folders||!row.email)))
      ||(!spec.folders?b.rows.find(row=>mine(row)&&!row.email)||(!email?b.rows.find(mine):null):null);
    if(same){if(folder&&same.folder!==folder){removeFolder(same.folder);same.folder=folder;}if(email&&!same.email)same.email=cleanText(info.email,254);same.state='unknown';if(info.plan)same.plan=info.plan;persist();return same;}
    const row=normalizeRow({id:'r-'+randomId(),service,source:'auto',label:spec.label,kind:spec.kind,folder,email:info.email,plan:info.plan});
    b.rows.push(row);persist();return row;
  }
  // 계정 폴더를 지운다. Higgsfield는 홈을 이 폴더로 바꿔 브라우저를 열어 Windows가 INetCache(숨김·시스템, Content.IE5 junction)를 만든다.
  // fs.rmSync(recursive)는 쓰지 않는다: 앱이 쓰는 Electron 44.5(Node 24.21)에서는 junction을 따라 들어가 폴더 밖 파일까지 지운다
  // (10-18 실측, 시스템 Node 24.20은 안 그럼). 링크는 따라가지 않고 링크만 지우며, 아래부터 하나씩 지운다.
  // 10-17 개발 창 실측: 로그인 실패 직후에는 무언가 캐시 폴더를 잡고 있어 EPERM이 났다. 그래서 잠시 뒤 몇 번 더 지운다.
  function removeTree(target){
    let stat;
    try{stat=fs.lstatSync(target);}catch(error){if(error.code==='ENOENT')return;throw error;}
    if(stat.isSymbolicLink()){try{fs.unlinkSync(target);}catch{fs.rmdirSync(target);}return;}
    if(!stat.isDirectory()){try{fs.unlinkSync(target);}catch(error){if(error.code!=='EPERM')throw error;fs.chmodSync(target,0o666);fs.unlinkSync(target);}return;}
    for(const name of fs.readdirSync(target))removeTree(path.join(target,name));
    try{fs.rmdirSync(target);}catch(error){if(error.code!=='EPERM')throw error;fs.chmodSync(target,0o777);fs.rmdirSync(target);}
  }
  function removeFolder(folder){
    if(!folder||!FOLDER.test(folder))return;
    const dir=path.join(accountsDir,folder);
    const attempt=()=>{try{removeTree(dir);}catch{}return !fs.existsSync(dir);};
    if(attempt())return;
    let tries=0;
    const again=()=>{if(attempt()||++tries>=10)return;setTimeout(again,1000).unref?.();};
    setTimeout(again,1000).unref?.();
  }
  async function useExisting(service){
    const spec=serviceSpec(service);if(!spec||spec.apiKey)return {ok:false,code:'UNKNOWN_SERVICE'};
    await detectTools();if(!runtime.tools[service].path)return {ok:false,code:'TOOL_MISSING'};
    const v=await verifyLogin(service,null);
    if(!v.ok)return {ok:false,code:v.code||'NOT_LOGGED_IN'};
    const row=addRow(service,null,v);
    await check({ids:[row.id]});
    return {ok:true,id:row.id,snapshot:publicSnapshot()};
  }
  /* API 키 연결 — 키는 확인한 뒤에만 이 PC에 암호화해 두고, 화면·기록·로그에는 끝 네 글자만 남긴다 */
  // replace: 「다시 연결」을 누른 줄의 id. 키를 새로 만들어 넣으면 지문이 달라도 그 줄의 키를 바꾼다(옛 줄이 남아 한 계정이 두 줄이 되지 않게).
  async function connectKey(service,key,{replace=null}={}){
    const spec=serviceSpec(service);if(!spec?.apiKey)return {ok:false,code:'UNKNOWN_SERVICE'};
    const value=String(key??'').trim();
    if(!API_KEY.test(value))return {ok:false,code:'INVALID_KEY_FORMAT'};
    const keyStore=providers.get(service).key;
    if(!keyStore.ready())return {ok:false,code:'SECURE_STORAGE_UNAVAILABLE'};
    const sub=await keyStore.validate(value);
    if(!sub.ok)return sub;
    const b=load(),keyId=crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
    let row=b.rows.find(r=>r.source==='auto'&&r.service===service&&r.keyId===keyId)
      ||(typeof replace==='string'?b.rows.find(r=>r.id===replace&&r.source==='auto'&&r.service===service)||null:null);
    const folder=row?.folder||service+'-'+randomId(),fresh=!row;
    try{fs.mkdirSync(path.join(accountsDir,folder),{recursive:true});fs.writeFileSync(keyStore.file(folder),secrets.encrypt(value));}
    catch{if(fresh)removeFolder(folder);return {ok:false,code:'SECURE_STORAGE_UNAVAILABLE'};}
    if(fresh){row=normalizeRow({id:'r-'+randomId(),service,source:'auto',label:spec.label,kind:spec.kind,folder,keyId,keyHint:'…'+value.slice(-4)});b.rows.push(row);}
    else{row.folder=folder;row.keyId=keyId;row.keyHint='…'+value.slice(-4);}
    applyRead(row,{state:'ok',plan:sub.plan,live:{readAt:now(),credits:sub.credits,planCredits:sub.planCredits}});
    persist();emit();
    return {ok:true,id:row.id,snapshot:publicSnapshot()};
  }

  /* 설치 도움 */
  async function openInstaller(service){
    if(!serviceSpec(service)||!Object.hasOwn(INSTALLERS,service))return {ok:false,code:'UNKNOWN_SERVICE'};
    if(providerPolicy(service)?.requiresNpm){await detectTools(true);if(platform==='win32'&&!runtime.tools[service].npm)return {ok:false,code:'NODE_REQUIRED'};}
    else await refreshPath(true);
    try{
      if(platform==='win32'){
        // 스크립트는 -EncodedCommand(UTF-16LE)로 넘겨 따옴표·한글이 깨지지 않게 한다.
        const script=INSTALLERS[service]+"; Write-Host ''; Write-Host '설치가 끝나면 이 창을 닫고 SYNK로 돌아가 「다시 확인」을 눌러 주세요.'";
        const opened=await openWindowsConsole('powershell.exe',['-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',psEncoded(script)]);
        if(!opened.ok)return {ok:false,code:'INSTALLER_FAILED'};
      }else if(platform==='darwin'){
        const child=spawn('osascript',['-e',`tell application "Terminal" to do script "${MAC_INSTALLERS[service]}"`,'-e','tell application "Terminal" to activate'],{env:childEnv(),shell:false,detached:true,stdio:'ignore'});
        child.unref?.();
      }else return {ok:false,code:'UNSUPPORTED_PLATFORM'};
      runtime.invalidateTools();
      return {ok:true};
    }catch{return {ok:false,code:'INSTALLER_FAILED'};}
  }
  async function openHelp(key){if(!Object.hasOwn(HELP_LINKS,key))return {ok:false,code:'UNKNOWN_LINK'};try{await openExternal(HELP_LINKS[key]);return {ok:true};}catch{return {ok:false,code:'OPEN_FAILED'};}}

  /* 직접 넣는 값 */
  function save(patch){
    const b=load();
    if(!patch||typeof patch!=='object')return {ok:false,code:'INVALID_REQUEST'};
    if(patch.settings&&typeof patch.settings==='object'){
      // 목표(아끼기·막힘 없이 쓰기·아직 몰라요)와 「팁 전부 끄기」, 3차 「한 달 요약 끄기」. 모르는 값이면 아무것도 바꾸지 않고 거절한다.
      // 요약을 꺼도 사용 기록은 지우지 않는다(끄는 것과 기록 지우기를 나눈다 — 스크린타임 불만 원문).
      const s=patch.settings,hasGoal=Object.hasOwn(s,'goal'),hasOff=Object.hasOwn(s,'tipsOff'),hasSummary=Object.hasOwn(s,'summaryOff');
      if((hasGoal&&s.goal!==null&&!GOALS.has(s.goal))||(hasOff&&typeof s.tipsOff!=='boolean')||(hasSummary&&typeof s.summaryOff!=='boolean'))return {ok:false,code:'INVALID_REQUEST'};
      const rate=clampNumber(s.usdKrw,1,100000);if(rate)b.settings.usdKrw=Math.round(rate);
      if(hasGoal)b.settings={...b.settings,goal:s.goal};
      if(hasOff)b.settings={...b.settings,tipsOff:s.tipsOff};
      if(hasSummary)b.settings={...b.settings,summaryOff:s.summaryOff};
    }
    if(patch.add&&typeof patch.add==='object'){
      if(b.rows.length>=200)return {ok:false,code:'TOO_MANY_ROWS'};
      const label=cleanText(patch.add.label,40);if(!label)return {ok:false,code:'LABEL_REQUIRED'};
      const service=label.toLowerCase().replace(/\s+/g,'').slice(0,40)||'custom';
      const row=normalizeRow({...patch.add,id:'m-'+randomId(),service:SERVICES[service]?service+'-manual':service,source:'manual',label});
      b.rows.push(row);
    }
    if(patch.row&&typeof patch.row==='object'){
      const row=b.rows.find(r=>r.id===patch.row.id);if(!row)return {ok:false,code:'UNKNOWN_ROW'};
      const editable=['price','currency','billDay','credits','lowAt','note','resetDay','resetHour','resetMinute','usedUpAt','cycle',...(row.source==='manual'?['label','kind']:[]),...(providerPolicy(row.service)?.editable||[])];
      const next={...row};for(const key of editable)if(Object.hasOwn(patch.row,key))next[key]=patch.row[key];
      if(Object.hasOwn(patch.row,'credits'))next.creditsAt=now();
      Object.assign(row,normalizeRow({...next,id:row.id,service:row.service,source:row.source,folder:row.folder,live:row.live,email:row.email}));
    }
    if(typeof patch.remove==='string'){
      const index=b.rows.findIndex(r=>r.id===patch.remove);if(index<0)return {ok:false,code:'UNKNOWN_ROW'};
      const [row]=b.rows.splice(index,1);if(row.folder&&!b.rows.some(r=>r.folder===row.folder))removeFolder(row.folder);
      // 지운 Gemini 계정은 agy에 로그인돼 있어도 자동 확인이 줄을 다시 만들지 않게 적어 둔다(「이 PC의 기존 로그인 쓰기」·로그인으로 다시 더하면 풀린다).
      sharedAccounts[row.service]?.remove(row);
      // 지운 계정의 사용 기록도 이 PC에서 지운다.
      compactHistory();
    }
    if(patch.tip&&typeof patch.tip==='object'){
      // 「다시 보기」: 쉬고 있는 팁을 모두 다시 보이게 한다(잘못 누른 「그만」을 되돌리는 길).
      if(patch.tip.action==='reset')b.settings={...b.settings,tips:{}};
      else{
        const key=typeof patch.tip.key==='string'?patch.tip.key:'';
        if(!TIP_KEY.test(key)||!['helpful','stop'].includes(patch.tip.action))return {ok:false,code:'INVALID_REQUEST'};
        const tips=b.settings.tips&&typeof b.settings.tips==='object'&&!Array.isArray(b.settings.tips)?b.settings.tips:{};
        const cur=tips[key]&&typeof tips[key]==='object'?tips[key]:{};
        if(patch.tip.action==='helpful')tips[key]={...cur,helpful:(Number(cur.helpful)||0)+1,until:now()+7*DAY_MS};
        else{const stops=(Number(cur.stops)||0)+1;tips[key]={...cur,stops,until:now()+(stops>1?84:28)*DAY_MS};}
        b.settings={...b.settings,tips};
      }
    }
    persist();emit();
    return publicSnapshot();
  }

  /* 자동 읽기 */
  // 지금 읽을 때인지: 마지막 전체 확인에서 6시간 · 결제일 아침 9시 뒤 첫 확인 → 전체, 주간 초기화 10분 전에 그 뒤로 안 읽은 계정 → 그 계정만.
  // 앱이 꺼져 있던 동안은 읽지 않는다(그 구간은 기록에서 「모르는 구간」으로 남는다).
  function autoDue(at=now()){
    const b=load(),autos=b.rows.filter(row=>row.source==='auto');
    if(!autos.length)return null;
    const last=b.check?.at||0;
    if(at-last>=AUTO_EVERY)return {};
    const morning=new Date(at);morning.setHours(BILL_HOUR,0,0,0);
    const billToday=day=>{const d=new Date(at),lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();return d.getDate()===Math.min(Number(day),lastDay);};
    if(at>=morning.getTime()&&last<morning.getTime()&&b.rows.some(row=>row.billDay&&billToday(row.billDay)))return {};
    // 지금 로그인되지 않은 Gemini 계정(elsewhere)은 읽어도 다른 계정이 읽히므로 초기화 전 읽기를 하지 않는다.
    const pre=autos.filter(row=>{const reset=row.live?.weekly?.resetsAt;return row.state!=='elsewhere'&&reset&&at>=reset-PRE_RESET&&at<reset&&(row.stateAt||0)<reset-PRE_RESET;}).map(row=>row.id);
    return pre.length?{ids:pre}:null;
  }
  async function autoTick(){
    void refreshPrices();
    if(checking||(loginCoordinator.state&&!['done','error','cancelled'].includes(loginCoordinator.state.stage)))return null;
    let due=null;try{due=autoDue();}catch{return null;}
    return due?check({...due,quiet:true}):null;
  }

  // 판 파일을 잠깐 못 읽으면(BOARD_BUSY) 화면에 「다시 시도」로 알린다. 다음 호출이 다시 읽는다.
  const guard=fn=>async(...args)=>{try{return await fn(...args);}catch(error){if(error?.code==='BOARD_BUSY')return {ok:false,code:'BOARD_BUSY'};throw error;}};
  return {
    // 계정판을 열 때 요금표 갱신본을 뒤에서 물어본다(하루 한 번까지). 화면은 기다리지 않고, 바뀌면 알림으로 다시 그린다.
    snapshot:guard(async({refreshTools=false}={})=>{await detectTools(refreshTools);void refreshPrices();return publicSnapshot();}),
    refreshPrices:guard(refreshPrices),
    check:guard(check),useExisting:guard(useExisting),startLogin,submitCode,cancelLogin,openLoginUrl,openInstaller,openHelp,save:guard(save),connectKey:guard(connectKey),
    autoTick:guard(autoTick),autoDue:guard(async at=>autoDue(at)),
    dispose(){loginCoordinator.dispose();},
  };
}

module.exports={createAiSubscriptions,parseClaudeUsage,parseResetText,codexWindows,codexResets,parseAgyUsage,loginUrl,claudeNeedsLogin,candidatePaths,commandFor,SERVICES,INSTALLERS,HELP_LINKS};
