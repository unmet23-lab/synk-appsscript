'use strict';
const path=require('node:path');
const {SERVICES,serviceSpec,providerPolicy}=require('./subscription-catalog.cjs');
const policyMap=field=>Object.freeze(Object.fromEntries(Object.keys(SERVICES).filter(id=>providerPolicy(id)?.[field]!==undefined).map(id=>[id,providerPolicy(id)[field]])));
const API_KEY=/^[\x21-\x7e]{10,512}$/;
const KINDS=new Set(['weekly','credit','plan']);
const INSTALLERS=policyMap('installer');
const MAC_INSTALLERS=policyMap('macInstaller');
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
  // 아끼는 팁의 근거(공식 도움말, 10-19 확인). Typecast 팁은 위 API 안내로 잇는다.
  'higgsfield-credits':'https://higgsfield.ai/creator-hub/help-center/credits/how-credits-work',
  // 초기화권(10-19 확인): GPT는 Codex가 개수·만료일을 알려 주고, Claude는 웹·데스크톱 설정 › 사용량에서만 보고 쓴다.
  'codex-resets':'https://help.openai.com/en/articles/20001498-how-banked-codex-resets-work',
  'claude-resets':'https://support.claude.com/en/articles/17007452-about-limit-resets',
  'claude-usage':'https://claude.ai/settings/usage',
  // Claude API 크레딧(10-28 확인): Max 요금제에 딸려 오는 금액·만료(공식 안내)와, 남은 금액이 보이는 유일한 곳인 Console 결제 화면.
  'claude-api-credits':'https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers',
  'claude-console-billing':'https://platform.claude.com/settings/billing',
  // GPT API 크레딧(10-29 확인): Pro 요금제에 딸려 오는 금액·만료(공식 안내)와, 남은 금액이 보이는 OpenAI 플랫폼 결제 › Credit grants. 공식 안내는 요금표의 출처로도 쓴다.
  'gpt-api-credits':'https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions',
  'gpt-credit-grants':'https://platform.openai.com/settings/organization/billing/credit-grants',
  // 요금표·연간 결제(3차, 10-19 확인): 요금표의 출처와 연간 결제 팁의 근거. 받은 요금표는 이 열쇠로만 출처를 가리킨다.
  'higgsfield-pricing':'https://higgsfield.ai/pricing',
  'higgsfield-annual':'https://higgsfield.ai/creator-hub/help-center/plans/can-i-switch-between-monthly-and-annual-billing',
  'typecast-api-pricing':'https://typecast.ai/kr/pricing/api/',
});
// 자동 읽기(사용 기록용): 앱이 켜 있는 동안 마지막 전체 확인에서 6시간이 지났을 때 · 계정마다 주간 초기화 10분 전 · 결제일 아침 9시 뒤 처음.
const AUTO_EVERY=6*3600*1000,PRE_RESET=10*60*1000,BILL_HOUR=9,DAY_MS=864e5;
// 팁 반응: 「도움 됐어요」는 같은 팁을 7일 쉬고(빈도를 늘리지 않는다), 「이런 팁 그만」은 4주, 두 번째부터 12주.
const TIP_KEY=new RegExp('^(spike|pace|pass|size|idle|annual):('+Object.keys(SERVICES).join('|')+')$');
// 3차(10-19): 요금표는 하루에 한 번까지만 synk.im에서 새로 받는다(계정판을 열 때·자동 읽기 때). 못 받으면 가진 것(앱 기본 사본·지난 갱신본)을 그대로 쓴다.
const PRICE_EVERY=24*3600*1000,PRICE_TIMEOUT=15000;
// 2차(10-19): 팁을 어느 쪽으로 드릴지(아끼기·막힘 없이 쓰기·아직 몰라요). 고르기 전은 비워 둔다.
const GOALS=new Set(['save','smooth','unsure']);
const LOGIN_DOMAINS=Object.freeze(Object.keys(SERVICES).flatMap(service=>providerPolicy(service)?.login?.domains||[]));
const FOLDER=new RegExp('^('+Object.keys(SERVICES).filter(id=>SERVICES[id].folders).join('|')+')-[a-z0-9]{8}$');
const EMAIL=/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;
const MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
const LOGIN_TIMEOUT=10*60*1000,READ_TIMEOUT=60*1000,OUTPUT_LIMIT=512*1024;
// agy 임시 기록: 이 혜택 데이터 폴더에 읽기마다 새 이름으로 만들고 읽은 뒤 지운다. 앱이 읽는 사이에 꺼져 남은 것은 10분 뒤 다음 읽기가 지운다.
const AGY_LOG=/^agy-[a-z0-9]{8}\.log$/,AGY_AUTH=/OAuth: authenticated successfully as (\S+)/g,AGY_LOG_LIMIT=16*1024*1024,AGY_LOG_STALE=10*60*1000;

const stripAnsi=text=>String(text||'').replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g,'').replace(/\u001b\][^\u0007]*\u0007/g,'');
const isoOrNull=value=>{if(value==null||value==='')return null;const t=typeof value==='number'?(value<1e12?value*1000:value):Date.parse(value);return Number.isFinite(t)?t:null;};
const clampNumber=(value,min,max)=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
const cleanText=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const randomId=()=>Array.from({length:8},()=>'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join('');

/* ---------- 공식 출력 해석 ---------- */
function parseResetText(text,now=new Date()){
  // "Oct 22, 10:59am (Asia/Seoul)" — Claude Code는 PC의 지역 시간대로 보여 준다.
  const m=/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(String(text||''));
  if(!m||!Object.hasOwn(MONTHS,m[1].toLowerCase())){
    // 날짜 없이 시각만(「resets 8:20pm」 — 오늘 풀리는 한도 한 줄)은 다가오는 그 시각이다(tools/크레딧실행.js 한도읽기와 같은 규칙, 10-29 Fable P2).
    const t=/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(String(text||''));
    if(!t)return null;
    const date=new Date(now.getFullYear(),now.getMonth(),now.getDate(),Number(t[1])%12+(t[3].toLowerCase()==='pm'?12:0),Number(t[2]||0),0,0);
    if(date.getTime()<=now.getTime())date.setDate(date.getDate()+1);
    return date.getTime();
  }
  let hour=Number(m[3]);if(m[5]){hour%=12;if(m[5].toLowerCase()==='pm')hour+=12;}
  const date=new Date(now.getFullYear(),MONTHS[m[1].toLowerCase()],Number(m[2]),hour,Number(m[4]||0),0,0);
  if(date.getTime()<now.getTime()-2*864e5)date.setFullYear(date.getFullYear()+1);
  return date.getTime();
}
// 모델별 주간 줄(「Current week (Fable)」 등)은 읽지 않는다 — 계정판은 전체 주간·5시간만 본다(2026-10-22 유호님). models는 Gemini와 모양을 맞춘 빈 목록.
function parseClaudeUsage(output,now=new Date()){
  const lines=stripAnsi(output).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const result={session:null,weekly:null,models:[]};
  for(const line of lines){
    // 한도를 다 쓴 계정은 가끔 표 대신 한 줄만 낸다 — 「You've hit your weekly limit · resets Nov 2, 12pm (Asia/Seoul)」(10-28 이 PC 실측).
    // 그 창을 100% 쓴 것으로 읽는다(표가 같이 오면 앞뒤 어느 쪽이든 표 값을 쓴다). session·5-hour는 5시간 창이다.
    // 창 이름 없이 「You've hit your limit · resets 3pm」만 오면 풀리는 때로 고른다 — 5시간(+10분) 안이면 5시간 창, 그보다 멀면 주간, 모르면 5시간 창(아르곤 A1).
    const hit=/^You['’]ve (?:hit|reached) your (?:(weekly|session|5-hour) )?limit(?:\s*[·•|-]\s*resets?\s+(.+))?$/i.exec(line);
    if(hit){
      const window={usedPercent:100,resetsAt:parseResetText(hit[2],now)};
      const weekly=hit[1]?hit[1].toLowerCase()==='weekly':window.resetsAt!==null&&window.resetsAt-now.getTime()>5*3600e3+10*60e3;
      if(weekly)result.weekly=result.weekly||window;else result.session=result.session||window;
      continue;
    }
    const m=/^Current (session|week)(?:\s*\(([^)]+)\))?\s*:\s*(\d+(?:\.\d+)?)\s*%\s*used(?:\s*[·•|-]\s*resets?\s+(.+))?$/i.exec(line);
    if(!m)continue;
    const window={usedPercent:Number(m[3]),resetsAt:parseResetText(m[4],now)};
    if(m[1].toLowerCase()==='session')result.session=window;
    else if(!m[2]||/all models/i.test(m[2]))result.weekly=window;
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
// Codex 초기화권(banked reset): 같은 rateLimits 응답의 rateLimitResetCredits. 개수는 늘 오고, 만료일은 백엔드가 줄 때만 온다.
// 쓸 수 있는(available) 것의 만료 시각만 남긴다(제목·설명·ID는 두지 않는다). 칸이 없으면 null — 0장과 다른 「모름」이다.
function codexResets(summary,at=Date.now()){
  if(!summary||typeof summary!=='object')return null;
  const count=clampNumber(summary.availableCount,0,99);
  if(count===null)return null;
  const until=Array.isArray(summary.credits)
    ?summary.credits.filter(c=>c&&c.status==='available').map(c=>isoOrNull(c.expiresAt)).filter(t=>t!==null&&t>at).sort((a,b)=>a-b).slice(0,10)
    :null;
  return {count:Math.round(count),until};
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
function loginUrl(text,additionalDomains=[]){
  // 기존 공개 helper의 도메인 합집합을 유지하고, 주입한 공급자의 정책도 함께 받는다.
  const domains=[...LOGIN_DOMAINS,...additionalDomains];
  for(const m of stripAnsi(text).matchAll(/https:\/\/[^\s"'<>`]+/g)){
    try{const url=new URL(m[0]);if(url.protocol==='https:'&&domains.some(d=>url.hostname===d||url.hostname.endsWith('.'+d)))return url.toString();}catch{}
  }
  return null;
}

/* ---------- 프로그램 찾기·실행 ---------- */
function candidatePaths(bin,{platform,env,home}){
  const out=[];
  if(platform==='win32'){
    const service=Object.keys(SERVICES).find(id=>SERVICES[id].bin===bin);
    const extra=providerPolicy(service)?.windowsDirectories?.({env,home})||[];
    const dirs=[path.join(home,'.local','bin'),env.APPDATA&&path.join(env.APPDATA,'npm'),path.join(home,'bin'),...extra,...String(env.PATH||env.Path||'').split(';')].filter(Boolean);
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


module.exports={SERVICES,serviceSpec,API_KEY,KINDS,INSTALLERS,MAC_INSTALLERS,HELP_LINKS,AUTO_EVERY,PRE_RESET,BILL_HOUR,DAY_MS,TIP_KEY,PRICE_EVERY,PRICE_TIMEOUT,GOALS,FOLDER,EMAIL,LOGIN_TIMEOUT,READ_TIMEOUT,OUTPUT_LIMIT,AGY_LOG,AGY_AUTH,AGY_LOG_LIMIT,AGY_LOG_STALE,stripAnsi,isoOrNull,clampNumber,cleanText,randomId,parseResetText,parseClaudeUsage,claudeNeedsLogin,parseJson,codexWindows,codexResets,parseAgyUsage,agyNeedsLogin,loginUrl,candidatePaths,commandFor};
